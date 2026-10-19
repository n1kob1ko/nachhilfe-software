/**
 * Textkorrektur: corrections of one frozen version of a Textarbeit. The text itself is never changed;
 * a correction keeps a snapshot of the version it refers to, so its marks never land at a wrong place
 * when the student writes on. Suggestions (from the KI or the teacher) are stored apart from the text,
 * each with the teacher's decision. Only accepted errors count: in the overview, in the Lernverlauf and
 * on the student's device. The Lernstand (mastery) is not touched by a text correction.
 *
 * The KI never places a mark itself: it quotes the wrong passage and the server looks that quote up in
 * the paragraph (lib/text-correction.ts anchorFindings). Whatever cannot be found or checked is dropped
 * or kept as a note without a place, never shown at a guessed position.
 */
import { after } from "next/server";
import { correctTextWithAI, estimateTokens, type AICorrection, type CorrectionRequest } from "./ai/textkorrektur";
import { correctThoroughly, englishText, estimateTokensThorough, thoroughVersion, type Analysis, type HiddenWord, type ThoroughVersion } from "./ai/textkorrektur-gruendlich";
import { costOf, FUNCTIONS, routeFor, type AIFunction } from "./ai/config";
import { acceptProblem, flagItems, notApplicable, setAside } from "./text-correction-checks";
import { PROVIDER_LABEL } from "./ai/providers";
import { aiEnabled, breakerState, budgetUsedUp } from "./ai/router";
import { db } from "./db";
import { skillsForPrompt } from "./lehrplan";
import { getSkill, getStudent } from "./repo";
import { detectNames } from "./name-detection";
import { blockText, parseDoc, type TextDoc } from "./text-doc";
import {
  anchorFindings,
  clip,
  failureText,
  maskedNames,
  maskText,
  NAME_PLACEHOLDER,
  namePattern,
  overlaps,
  placed,
  type AIStatus,
  type CorrectionItem,
  type CorrectionMethod,
  type NewItem,
  type VerifyStatus,
  type CorrectionRow,
  type ItemKind,
  type ItemStatus,
  type Overview,
  recommendationFrom,
  type Range,
} from "./text-correction-core";
import { categoryInfo, isTextCategory, levelFor, normalizeCategory, type Level } from "./text-correction-rules";
import { getText, type TextView } from "./texts";
import { pictureContext, storyLevel } from "./picture-story";

export * from "./text-correction-core";

const iso = (ms = Date.now()) => new Date(ms).toISOString();

/** At most this many words go to the KI in one correction (about four A4 pages). */
export const AI_MAX_WORDS = 2_500;
export const AI_MIN_WORDS = 10;

/** How the KI checks when the teacher does not choose: AI_TEXT_METHOD = einfach (one request, default) or gruendlich. */
export function defaultMethod(): CorrectionMethod {
  return process.env.AI_TEXT_METHOD?.trim().toLowerCase() === "gruendlich" ? "gruendlich" : "einfach";
}
const methodOf = (v: unknown): CorrectionMethod => (v === "gruendlich" ? "gruendlich" : "einfach");

/** How long a run may take before it counts as interrupted: one request, or the two of „gründlich“. */
const runLimitMs = (m: CorrectionMethod) => (m === "gruendlich" ? FUNCTIONS.textanalyse.timeoutMs + FUNCTIONS.textpruefung.timeoutMs : FUNCTIONS.textkorrektur.timeoutMs) + 60_000;

// ---------- storage ----------

export function getCorrection(id: number): CorrectionRow | null {
  return (db().prepare("SELECT * FROM text_corrections WHERE id = ?").get(id) as CorrectionRow | undefined) ?? null;
}

export function listItems(correctionId: number): CorrectionItem[] {
  return db()
    .prepare("SELECT * FROM text_correction_items WHERE correction_id = ? ORDER BY COALESCE(block, -1), COALESCE(pos_start, -1), id")
    .all(correctionId) as CorrectionItem[];
}

export function correctionsOfText(textId: number): CorrectionRow[] {
  return db().prepare("SELECT * FROM text_corrections WHERE text_id = ? ORDER BY version DESC").all(textId) as CorrectionRow[];
}

export const latestCorrection = (textId: number): CorrectionRow | null => correctionsOfText(textId)[0] ?? null;

export const snapshotDoc = (c: Pick<CorrectionRow, "body">) => parseDoc(c.body);

/** A KI run that has been "running" for longer than its timeout was interrupted (e.g. a restart). */
export function aiState(c: CorrectionRow, now = Date.now()): AIStatus {
  if (c.ai_status === "laeuft" && c.ai_started_at && now - Date.parse(c.ai_started_at) > runLimitMs(methodOf(c.method))) return "fehler";
  return c.ai_status;
}

/** How long „Erneut versuchen“ of the second check may take before it counts as interrupted. */
const verifyLimitMs = () => FUNCTIONS.textpruefung.timeoutMs + 60_000;

/** The second check of a „gründlich“ run; a repeat running longer than its timeout was interrupted (e.g. a restart). */
export function verifyState(c: CorrectionRow, now = Date.now()): VerifyStatus {
  if (c.verify_status === "laeuft" && (!c.ai_started_at || now - Date.parse(c.ai_started_at) > verifyLimitMs())) return "fehler";
  return c.verify_status;
}

type StoredAnalysis = { version: ThoroughVersion; data: Analysis };

/** Step 1's answer kept while the second check is owed (text_corrections.analysis); null when there is none or it is unreadable. */
function storedAnalysis(c: Pick<CorrectionRow, "analysis">): StoredAnalysis | null {
  if (!c.analysis) return null;
  try {
    const v = JSON.parse(c.analysis) as Partial<StoredAnalysis> | null;
    return (v?.version === "neu" || v?.version === "bisher") && v.data && Array.isArray(v.data.sentences) ? (v as StoredAnalysis) : null;
  } catch {
    return null;
  }
}

/**
 * What „Erneut versuchen“ repeats: pruefung = only the failed second check of a „gründlich“ run, with step 1's stored
 * answer (step 1 is not paid again); ganz = the whole failed correction, as the teacher agreed to it. null = nothing to repeat.
 */
export type RetryKind = "pruefung" | "ganz";
export function retryKind(c: CorrectionRow, now = Date.now()): RetryKind | null {
  const state = aiState(c, now);
  if (state === "fertig" && c.method === "gruendlich" && verifyState(c, now) === "fehler" && storedAnalysis(c)) return "pruefung";
  if (state === "fehler" && c.ai_consent_at) return "ganz";
  return null;
}

/**
 * Why nothing should be sent to the KI right now: not set up, the month's budget used up, or paused after outages.
 * Checked before a run is claimed, so a refused start sends nothing and leaves no row in the cost log.
 */
function sendBlocked(fn: AIFunction): string | null {
  if (!aiEnabled(fn)) return "Die KI ist nicht eingerichtet. Du kannst den Text selbst korrigieren.";
  if (budgetUsedUp(fn)) return "Das KI-Budget für diesen Monat ist aufgebraucht. Es wurde nichts an die KI gesendet.";
  if (breakerState().paused) return "Die KI war zuletzt mehrmals nicht erreichbar und macht ein paar Minuten Pause. Es wurde nichts gesendet; bitte später nochmal versuchen.";
  return null;
}

/** The level of the student the text belongs to. */
export function levelOfText(text: Pick<TextView, "student_id"> & { id?: number }): Level {
  // a Bildgeschichte may name its own Schulart and Klasse
  const own = text.id ? storyLevel(text.id) : null;
  if (own) return levelFor(own.schoolType, own.klasse);
  const s = getStudent(text.student_id);
  return levelFor(s?.school_type ?? "", s?.klasse ?? null);
}

/**
 * The correction of the text's current version, created when there is none. Decisions on paragraphs
 * that did not change since the previous correction are carried over (with their status), so a text
 * the student continued does not have to be checked from scratch.
 */
export function ensureCorrection(textId: number, teacherId: number | null, unitId: number | null = null): CorrectionRow {
  const conn = db();
  return conn.transaction(() => {
    const text = getText(textId);
    if (!text) throw new Error("Text nicht gefunden.");
    const existing = conn.prepare("SELECT * FROM text_corrections WHERE text_id = ? AND version = ?").get(textId, text.version) as CorrectionRow | undefined;
    if (existing) return existing;
    const now = iso();
    const res = conn
      .prepare("INSERT INTO text_corrections (text_id, version, body, words, level, unit_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(textId, text.version, text.body, text.words, levelOfText(text).label, unitId, teacherId, now, now);
    const id = Number(res.lastInsertRowid);
    const previous = conn.prepare("SELECT * FROM text_corrections WHERE text_id = ? AND version < ? ORDER BY version DESC LIMIT 1").get(textId, text.version) as CorrectionRow | undefined;
    if (previous) carryOver(previous, id, parseDoc(text.body));
    return getCorrection(id)!;
  })();
}

/** Places in unchanged paragraphs keep their suggestion and decision in the new correction. */
function carryOver(previous: CorrectionRow, toId: number, doc: TextDoc) {
  const old = parseDoc(previous.body).map(blockText);
  const used = new Set<number>();
  const moved = new Map<number, number>();
  doc.forEach((b, j) => {
    const t = blockText(b);
    if (!t.trim()) return;
    const i = old[j] === t && !used.has(j) ? j : old.findIndex((x, k) => x === t && !used.has(k));
    if (i >= 0) {
      used.add(i);
      moved.set(i, j);
    }
  });
  const insert = db().prepare(
    `INSERT INTO text_correction_items (correction_id, block, pos_start, pos_end, quote, replacement, category, kind, rule, explanation, skill_id, status, source, origin, review, review_note, decided_by, decided_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const it of listItems(previous.id)) {
    if (!placed(it) || !moved.has(it.block)) continue;
    insert.run(toId, moved.get(it.block)!, it.pos_start, it.pos_end, it.quote, it.replacement, it.category, it.kind, it.rule, it.explanation, it.skill_id, it.status, it.source, it.origin, it.review, it.review_note, it.decided_by, it.decided_at, it.created_at);
  }
}

// ---------- the KI run ----------

/**
 * What the teacher sees before agreeing: what goes out, to whom, about what it costs. kept: the further names
 * she confirmed for this correction before („Gründlich nachprüfen“), else all the app finds.
 */
export function aiPreview(text: TextView, kept: string[] | null = null) {
  const route = routeFor("textkorrektur");
  const doc = parseDoc(text.body);
  // the known names replaced; the dialog replaces the found ones the teacher keeps (lib/name-detection.ts)
  const req = correctionRequest(text, doc, []);
  const t = estimateTokens(text.words);
  const g = estimateTokensThorough(text.words);
  const blocked = text.words < AI_MIN_WORDS ? `Für die KI-Korrektur braucht der Text mindestens ${AI_MIN_WORDS} Wörter.` : text.words > AI_MAX_WORDS ? `Für die KI-Korrektur ist der Text zu lang (höchstens ${AI_MAX_WORDS.toLocaleString("de-AT")} Wörter).` : null;
  return {
    provider: PROVIDER_LABEL[route.provider],
    model: route.model,
    enabled: aiEnabled("textkorrektur"),
    blocked,
    words: text.words,
    costUsd: costOf(route.model, FUNCTIONS.textkorrektur.tier, { input: t.input, output: t.output, cacheWrite: 0, cacheRead: 0 }),
    costThoroughUsd: costOf(routeFor("textanalyse").model, FUNCTIONS.textanalyse.tier, { input: g.input, output: g.output, cacheWrite: 0, cacheRead: 0 }),
    method: defaultMethod(),
    masked: req.blocks.filter((b) => b.text.trim()).map((b) => b.text),
    pictures: req.pictures ? req.pictures.captions.map((c, i) => `Bild ${i + 1}: ${c || "(keine Beschreibung)"}`) : null,
    hidden: `die Namen von ${text.student_name} und den Lehrkräften`,
    names: [...new Set([...foundNames(text, doc), ...(kept ?? [])])],
    kept: kept ?? foundNames(text, doc),
  };
}

function teacherNames(): string[] {
  return (db().prepare("SELECT name FROM teachers").all() as { name: string }[]).map((t) => t.name);
}

export function namesToHide(text: Pick<TextView, "student_name">): string[] {
  return [text.student_name, ...teacherNames()];
}

/** Further names the app finds in the text, the task and the picture descriptions (lib/name-detection.ts), without the known ones. */
export function foundNames(text: TextView, doc: TextDoc): string[] {
  const known = namePattern(namesToHide(text));
  const pictures = pictureContext(text.id)?.captions ?? [];
  return detectNames([text.prompt, ...doc.map(blockText), ...pictures]).filter((n) => maskText(n, known).masked !== NAME_PLACEHOLDER);
}

/** Bildgeschichte: the descriptions of the pictures, names masked like in the text. */
function picturesFor(textId: number, pattern: RegExp | null) {
  const p = pictureContext(textId);
  return p ? { count: p.count, captions: p.captions.map((c) => maskText(c, pattern).masked) } : null;
}

/**
 * The request for the KI: masked paragraphs, level, kind of text, task and the student's skills. Replaced are
 * the names of the student and the teachers and the further names (by default those the app finds).
 */
export function correctionRequest(text: TextView, doc: TextDoc, names: string[] = foundNames(text, doc)): CorrectionRequest {
  const pattern = namePattern([...namesToHide(text), ...names]);
  const student = getStudent(text.student_id);
  const subject = text.subject || "Deutsch";
  const skills = student ? skillsForPrompt(student, subject) : [];
  return {
    subject,
    kind: text.topic,
    task: maskText(text.prompt, pattern).masked,
    level: levelOfText(text),
    blocks: doc.map((b) => ({ text: maskText(blockText(b), pattern).masked.replace(/\n/g, " "), heading: b.t === "h" })),
    skills: skills.slice(0, 60).map((s) => ({ id: s.id, name: `${s.area} › ${s.name}` })),
    pictures: picturesFor(text.id, pattern),
  };
}

export type StartResult = { ok: true; correctionId: number; reused: boolean } | { ok: false; error: string };

/**
 * Starts the KI on the text's current version, after the teacher's consent. Returns at once; the
 * result arrives in the background (the page asks again). A version the KI already checked is not
 * sent again.
 */
export function startAICorrection(
  textId: number,
  teacherId: number,
  o: { consent: boolean; unitId?: number | null; wait?: boolean; method?: CorrectionMethod; names?: string[] },
): StartResult | Promise<StartResult> {
  if (!o.consent) return { ok: false, error: "Bitte zuerst bestätigen, dass der Text an die KI gesendet werden darf." };
  if (!aiEnabled("textkorrektur")) return { ok: false, error: "Die KI ist nicht eingerichtet. Du kannst den Text selbst korrigieren." };
  const text = getText(textId);
  if (!text) return { ok: false, error: "Text nicht gefunden." };
  if (text.words < AI_MIN_WORDS) return { ok: false, error: `Für die KI-Korrektur braucht der Text mindestens ${AI_MIN_WORDS} Wörter.` };
  if (text.words > AI_MAX_WORDS) return { ok: false, error: `Der Text ist für die KI-Korrektur zu lang (höchstens ${AI_MAX_WORDS.toLocaleString("de-AT")} Wörter). Du kannst ihn selbst korrigieren.` };
  const c = ensureCorrection(textId, teacherId, o.unitId ?? null);
  const state = aiState(c);
  if (state === "fertig" || state === "laeuft") return { ok: true, correctionId: c.id, reused: true };
  const method = o.method ? methodOf(o.method) : defaultMethod();
  const blocked = sendBlocked(method === "gruendlich" ? "textanalyse" : "textkorrektur");
  if (blocked) return { ok: false, error: blocked };
  const now = iso();
  const claimed = db()
    .prepare(
      `UPDATE text_corrections SET ai_status = 'laeuft', ai_error = NULL, ai_started_at = ?, ai_consent_by = ?, ai_consent_at = ?, method = ?,
       masked_names = COALESCE(?, masked_names), updated_at = ?
       WHERE id = ? AND (ai_status IN ('keine', 'fehler') OR (ai_status = 'laeuft' AND ai_started_at < ?))`,
    )
    .run(now, teacherId, now, method, o.names ? JSON.stringify(o.names) : null, now, c.id, iso(Date.now() - runLimitMs(methodOf(c.method))));
  if (!claimed.changes) return { ok: true, correctionId: c.id, reused: true };
  return launch(c.id, teacherId, o.wait);
}

function launch(correctionId: number, teacherId: number, wait?: boolean, o: { retry?: boolean } = {}): StartResult | Promise<StartResult> {
  const run = runCorrection(correctionId, teacherId, o).then(() => ({ ok: true as const, correctionId, reused: false }));
  if (wait) return run;
  try {
    after(() => run);
  } catch {
    // outside a request (tests, scripts): the promise runs on by itself
  }
  return { ok: true, correctionId, reused: false };
}

/**
 * „Gründlich nachprüfen“: the open KI suggestions of a finished correction (and those the check sorted
 * out) are replaced by a „gründlich“ run; everything the teacher decided stays and is not suggested again.
 */
export function startThoroughRecheck(correctionId: number, teacherId: number, o: { consent: boolean; wait?: boolean; names?: string[] }): StartResult | Promise<StartResult> {
  if (!o.consent) return { ok: false, error: "Bitte zuerst bestätigen, dass der Text an die KI gesendet werden darf." };
  if (!aiEnabled("textanalyse")) return { ok: false, error: "Die KI ist nicht eingerichtet." };
  const c = getCorrection(correctionId);
  if (!c) return { ok: false, error: "Korrektur nicht gefunden." };
  if (c.words > AI_MAX_WORDS || c.words < AI_MIN_WORDS) return { ok: false, error: "Diese Fassung kann die KI nicht korrigieren (Länge)." };
  if (aiState(c) === "laeuft" || verifyState(c) === "laeuft") return { ok: true, correctionId, reused: true };
  const blocked = sendBlocked("textanalyse");
  if (blocked) return { ok: false, error: blocked };
  const conn = db();
  const now = iso();
  const claimed = conn.transaction(() => {
    const r = conn
      .prepare(
        `UPDATE text_corrections SET ai_status = 'laeuft', ai_error = NULL, ai_started_at = ?, ai_consent_by = ?, ai_consent_at = ?, method = 'gruendlich',
         masked_names = COALESCE(?, masked_names), updated_at = ?
         WHERE id = ? AND ai_status IN ('keine', 'fertig', 'fehler')`,
      )
      .run(now, teacherId, now, o.names ? JSON.stringify(o.names) : null, now, correctionId);
    if (!r.changes) return false;
    conn
      .prepare("DELETE FROM text_correction_items WHERE correction_id = ? AND source = 'ki' AND (status = 'offen' OR (status = 'abgelehnt' AND review IN ('verworfen', 'unpassend') AND decided_by IS NULL))")
      .run(correctionId);
    return true;
  })();
  if (!claimed) return { ok: true, correctionId, reused: true };
  return launch(correctionId, teacherId, o.wait);
}

/**
 * „Erneut versuchen“ after a failure (never automatically): pruefung repeats only the second check with step 1's stored
 * answer, ganz the whole correction with the method and names the teacher agreed to. Nothing is sent when the KI is off,
 * the budget is used up or the KI pauses after outages; a second click while it runs sends nothing either (reused).
 * The teacher's decisions stay; only the KI's undecided suggestions are replaced, and only when the repeat succeeds.
 */
export function retryAICorrection(correctionId: number, teacherId: number, o: { wait?: boolean } = {}): StartResult | Promise<StartResult> {
  const c = getCorrection(correctionId);
  if (!c) return { ok: false, error: "Korrektur nicht gefunden." };
  if (aiState(c) === "laeuft" || verifyState(c) === "laeuft") return { ok: true, correctionId, reused: true };
  const kind = retryKind(c);
  if (!kind) return { ok: false, error: "Hier ist nichts fehlgeschlagen, das sich wiederholen lässt." };
  const blocked = sendBlocked(kind === "pruefung" ? "textpruefung" : c.method === "gruendlich" ? "textanalyse" : "textkorrektur");
  if (blocked) return { ok: false, error: blocked };
  const now = iso();
  const claimed =
    kind === "pruefung"
      ? db()
          .prepare(
            `UPDATE text_corrections SET verify_status = 'laeuft', verify_error = '', ai_started_at = ?, updated_at = ?
             WHERE id = ? AND ai_status = 'fertig' AND analysis <> '' AND (verify_status = 'fehler' OR (verify_status = 'laeuft' AND ai_started_at < ?))`,
          )
          .run(now, now, correctionId, iso(Date.now() - verifyLimitMs()))
      : db()
          .prepare(
            `UPDATE text_corrections SET ai_status = 'laeuft', ai_error = NULL, ai_started_at = ?, updated_at = ?
             WHERE id = ? AND ai_consent_at IS NOT NULL AND (ai_status = 'fehler' OR (ai_status = 'laeuft' AND ai_started_at < ?))`,
          )
          .run(now, now, correctionId, iso(Date.now() - runLimitMs(methodOf(c.method))));
  if (!claimed.changes) return { ok: true, correctionId, reused: true };
  return launch(correctionId, teacherId, o.wait, { retry: kind === "pruefung" });
}

/**
 * About what „Erneut versuchen“ costs, in US dollars, for the button. The second check alone is about 40 % of a
 * „gründlich“ run (measured 2026-10-11 on 28 texts: 0.017–0.030 $ of 0.042–0.075 $).
 */
export function retryCostUsd(c: CorrectionRow, kind: RetryKind): number {
  const fn = methodOf(c.method) === "gruendlich" ? "textanalyse" : "textkorrektur";
  const t = fn === "textanalyse" ? estimateTokensThorough(c.words) : estimateTokens(c.words);
  const whole = costOf(routeFor(fn).model, FUNCTIONS[fn].tier, { input: t.input, output: t.output, cacheWrite: 0, cacheRead: 0 });
  return kind === "pruefung" ? whole * 0.4 : whole;
}

/** The KI's suggestions the teacher has not decided: what a repeat of the second check replaces. */
const UNDECIDED_KI = "source = 'ki' AND decided_by IS NULL";
const undecidedKI = (i: CorrectionItem) => i.source === "ki" && i.decided_by === null;

/** A new suggestion of a repeat where one that stays already is: at an overlapping place, or the same note without a place. */
function alreadyThere(i: NewItem, stays: CorrectionItem[]): boolean {
  if (i.block !== null && i.pos_start !== null && i.pos_end !== null) {
    const at = { start: i.pos_start, end: i.pos_end };
    return stays.some((s) => placed(s) && s.block === i.block && overlaps({ start: s.pos_start, end: s.pos_end }, at));
  }
  return stays.some((s) => !placed(s) && s.kind === i.kind && s.category === i.category && s.explanation === i.explanation);
}

/**
 * Asks the KI and stores the checked suggestions. Never throws; a failure is kept on the correction. retry: only the
 * second check, with step 1's stored answer; when it fails again nothing but the reason changes.
 */
export async function runCorrection(correctionId: number, teacherId: number | null, o: { retry?: boolean } = {}): Promise<void> {
  const c = getCorrection(correctionId);
  const text = c && getText(c.text_id);
  if (!c || !text) return;
  const doc = parseDoc(c.body);
  const fail = (message: string) =>
    db().prepare("UPDATE text_corrections SET ai_status = 'fehler', ai_error = ?, updated_at = ? WHERE id = ?").run(message.slice(0, 300), iso(), correctionId);
  // a repeated second check that fails: the suggestions of step 1 and every decision stay as they are
  const checkFailed = (message: string) =>
    db().prepare("UPDATE text_corrections SET verify_status = 'fehler', verify_error = ?, updated_at = ? WHERE id = ?").run(message.slice(0, 300), iso(), correctionId);
  try {
    // the snapshot, not the live text: the student may write on in the meantime
    const snapshot = { ...text, body: c.body };
    // the further names as the teacher confirmed them in the consent dialog, else what the app finds
    const names = maskedNames(c.masked_names) ?? foundNames(snapshot, doc);
    const req = correctionRequest(snapshot, doc, names);
    const method = methodOf(c.method);
    const meta = { teacherId, unitId: c.unit_id, studentId: text.student_id };
    const stored = o.retry ? storedAnalysis(c) : null;
    if (o.retry && !stored) {
      checkFailed("Die erste Prüfung ist nicht mehr gespeichert. Bitte selbst durchsehen.");
      return;
    }
    // a repeat replaces only the KI's undecided suggestions: every other place is taken, also one the teacher rejected
    const taken = new Map<number, Range[]>();
    for (const i of listItems(correctionId)) if (placed(i) && (o.retry ? !undecidedKI(i) : i.status !== "abgelehnt")) taken.set(i.block, [...(taken.get(i.block) ?? []), { start: i.pos_start, end: i.pos_end }]);
    const skills = new Set(req.skills.map((s) => s.id));
    const pattern = namePattern([...namesToHide(text), ...names]);
    let result: {
      items: NewItem[];
      data: Pick<AICorrection, "strengths" | "main_issue" | "recommendation" | "recommendation_skill_id">;
      dropped: number;
      callId: number | null;
      unchecked: string[];
      hidden: HiddenWord[];
      verify: "" | "ok" | "fehler";
      verifyError: string;
      analysis: string;
    };
    if (method === "gruendlich") {
      const out = await correctThoroughly(req, doc, { pattern, level: req.level, skills, taken, meta, version: stored?.version ?? thoroughVersion(), ...(stored ? { analysis: stored.data } : {}) });
      if (!out.ok) {
        (o.retry ? checkFailed : fail)(failureText(out.cause, out.code));
        return;
      }
      const verifyError = out.verify === "fehler" ? failureText(out.verifyCause ?? "unbrauchbar", out.verifyCode) : "";
      if (o.retry && out.verify === "fehler") {
        checkFailed(verifyError);
        return;
      }
      result = {
        items: out.items,
        data: out.data,
        dropped: out.dropped,
        // a repeat keeps the first run's call: that is the one the correction rests on
        callId: o.retry ? c.ai_call_id : (out.callIds[0] ?? null),
        unchecked: out.unchecked,
        hidden: out.hidden,
        verify: out.verify,
        verifyError,
        // step 1's answer stays only while the second check is owed
        analysis: out.verify === "fehler" ? JSON.stringify({ version: out.version, data: out.data } satisfies StoredAnalysis) : "",
      };
    } else {
      const out = await correctTextWithAI(req, meta);
      if (!out.ok) {
        fail(failureText(out.cause, out.code));
        return;
      }
      const anchored = anchorFindings(doc, out.data, { pattern, level: req.level, skills, taken });
      // the program's checks mark what does not fit, also here
      result = { items: flagItems(doc.map(blockText), anchored.items, { english: englishText(req) }), data: out.data, dropped: anchored.dropped, callId: out.callId, unchecked: [], hidden: [], verify: "", verifyError: "", analysis: "" };
    }
    const conn = db();
    conn.transaction(() => {
      const now = iso();
      // a repeat: the undecided suggestions of step 1 make way; what the teacher decided, also while it ran, stays
      if (o.retry) conn.prepare(`DELETE FROM text_correction_items WHERE correction_id = ? AND ${UNDECIDED_KI}`).run(correctionId);
      const stays = o.retry ? listItems(correctionId) : [];
      const insert = conn.prepare(
        `INSERT INTO text_correction_items (correction_id, block, pos_start, pos_end, quote, replacement, category, kind, rule, explanation, skill_id, status, source, origin, review, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ki', ?, ?, ?, ?)`,
      );
      for (const i of result.items) {
        if (o.retry && alreadyThere(i, stays)) continue;
        insert.run(correctionId, i.block, i.pos_start, i.pos_end, i.quote, i.replacement, i.category, i.kind, i.rule, i.explanation, i.skill_id, setAside(i) ? "abgelehnt" : "offen", i.origin, i.review, i.review_note, now);
      }
      const d = result.data;
      const recSkill = typeof d.recommendation_skill_id === "string" && skills.has(d.recommendation_skill_id) ? d.recommendation_skill_id : null;
      // who answered, as the teacher reads it: "Anthropic · claude-…"
      const route = routeFor(method === "gruendlich" ? "textanalyse" : "textkorrektur");
      const model = `${PROVIDER_LABEL[route.provider]} · ${route.model}`;
      conn
        .prepare(
          `UPDATE text_corrections SET ai_status = 'fertig', ai_error = NULL, ai_model = ?, ai_call_id = ?, summary = ?, main_issue = ?, recommendation = ?,
           recommendation_skill = ?, dropped = ?, unchecked = ?, hidden_words = ?, verify_status = ?, verify_error = ?, analysis = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          model,
          result.callId,
          (Array.isArray(d.strengths) ? d.strengths : []).map((s) => clip(s, 200)).filter(Boolean).slice(0, 3).join("\n"),
          clip(d.main_issue, 80),
          clip(d.recommendation, 200),
          recSkill,
          result.dropped,
          result.unchecked.join(","),
          result.hidden.length ? JSON.stringify(result.hidden.map((h) => ({ para: h.para, text: h.text, grammar: h.grammar }))) : "",
          result.verify,
          result.verifyError,
          result.analysis,
          now,
          correctionId,
        );
    })();
  } catch (e) {
    // the reason in the server log only; the teacher reads a plain sentence
    console.error(`[Textkorrektur] Speichern fehlgeschlagen (Korrektur ${correctionId}): ${e instanceof Error ? e.message : String(e)}`);
    (o.retry ? checkFailed : fail)(failureText("speichern"));
  }
}

// ---------- the teacher's decisions ----------

/** What the teacher reads when a suggestion cannot be accepted. */
export const NOT_APPLICABLE = "Dieser Vorschlag passt nicht an seine Stelle im Text und kann nicht übernommen werden. Du kannst die Stelle selbst korrigieren.";

/**
 * Whether the change of a placed suggestion can go into the Endfassung, checked once more right before it is accepted
 * (lib/text-correction-checks.ts acceptProblem): the place in the snapshot still holds the quoted words, the replacement
 * fits there and together with the changes already accepted in that paragraph (`accepted`, without the item itself).
 */
function acceptCheck(doc: TextDoc, item: CorrectionItem & { block: number; pos_start: number; pos_end: number }, replacement: string, accepted: CorrectionItem[]) {
  const b = doc[item.block];
  if (!b) return { why: "Die Stelle gibt es im Text nicht.", alone: true };
  const others = accepted.filter((i) => i.id !== item.id && i.status === "uebernommen" && placed(i) && i.block === item.block).map((i) => ({ start: i.pos_start!, end: i.pos_end!, replacement: i.replacement }));
  return acceptProblem(blockText(b), { start: item.pos_start, end: item.pos_end, replacement, quote: item.quote }, others);
}

/** A stored suggestion that does not fit its place (one from before this check, 2026-10-11) is set aside for good. */
function setAsideUnfit(item: CorrectionItem, why: string) {
  const it = notApplicable(item, why);
  db().prepare("UPDATE text_correction_items SET status = 'abgelehnt', review = ?, review_note = ? WHERE id = ?").run(it.review, it.review_note, item.id);
  return db().prepare("SELECT * FROM text_correction_items WHERE id = ?").get(item.id) as CorrectionItem;
}

export type DecideResult = { item: CorrectionItem } | { error: string; item?: CorrectionItem };

/**
 * Accept or reject one suggestion (or set it back to open). An accepted one may carry the teacher's own wording.
 * Before a placed one is accepted its change is checked once more against the snapshot (acceptCheck); one that does
 * not fit is not accepted and nothing else changes. A not applicable one (review „unpassend“) cannot be decided at all.
 * null: no such suggestion in this correction.
 */
export function decideItem(correctionId: number, itemId: number, status: ItemStatus, teacherId: number, replacement?: string): DecideResult | null {
  const conn = db();
  const item = conn.prepare("SELECT * FROM text_correction_items WHERE id = ? AND correction_id = ?").get(itemId, correctionId) as CorrectionItem | undefined;
  const c = getCorrection(correctionId);
  if (!item || !c) return null;
  if (item.review === "unpassend") return { error: NOT_APPLICABLE, item };
  const now = iso();
  const own = replacement !== undefined && status === "uebernommen" && placed(item) ? replacement.replace(/\s+/g, " ").slice(0, 200) : null;
  const text = own ?? item.replacement;
  if (status === "uebernommen" && placed(item)) {
    const problem = acceptCheck(snapshotDoc(c), item, text, listItems(correctionId));
    if (problem) {
      // the stored suggestion itself does not fit: set aside; the teacher's own wording or a clash with an accepted one: only refused
      if (problem.alone && own === null) return { error: `Nicht übernommen: ${problem.why} Der Vorschlag ist jetzt als nicht anwendbar markiert. Du kannst die Stelle selbst korrigieren.`, item: setAsideUnfit(item, problem.why) };
      return { error: `Nicht übernommen: ${problem.why}` };
    }
  }
  // one the check sorted out and the teacher brings back stays marked for a close look
  const review = item.review === "verworfen" && status !== "abgelehnt" ? "lehrer" : item.review;
  conn
    .prepare("UPDATE text_correction_items SET status = ?, replacement = ?, review = ?, decided_by = ?, decided_at = ? WHERE id = ?")
    .run(status, text, review, status === "offen" ? null : teacherId, status === "offen" ? null : now, itemId);
  conn.prepare("UPDATE text_corrections SET updated_at = ? WHERE id = ?").run(now, correctionId);
  return { item: conn.prepare("SELECT * FROM text_correction_items WHERE id = ?").get(itemId) as CorrectionItem };
}

/**
 * „Alle übernehmen“ / „Alle ablehnen“: every open suggestion, optionally of one category or kind. Accepting checks
 * every placed one as decideItem does, in the order of the text and with the ones accepted before it; what does not
 * fit stays open (or is set aside when it does not fit by itself). The number of suggestions decided.
 */
export function decideAll(correctionId: number, status: "uebernommen" | "abgelehnt", teacherId: number, filter: { category?: string; kind?: ItemKind } = {}): number {
  const where = ["correction_id = ?", "status = 'offen'"];
  const args: (string | number)[] = [correctionId];
  if (filter.category && isTextCategory(filter.category)) {
    where.push("category = ?");
    args.push(filter.category);
  }
  if (filter.kind) {
    where.push("kind = ?");
    args.push(filter.kind);
  }
  // what the teacher must look at closely is never accepted in bulk
  if (status === "uebernommen") where.push("review = ''");
  const now = iso();
  const conn = db();
  const c = getCorrection(correctionId);
  if (!c) return 0;
  const n = conn.transaction(() => {
    const these = conn.prepare(`SELECT * FROM text_correction_items WHERE ${where.join(" AND ")} ORDER BY COALESCE(block, -1), COALESCE(pos_start, -1), id`).all(...args) as CorrectionItem[];
    const all = listItems(correctionId);
    const doc = snapshotDoc(c);
    const decide = conn.prepare("UPDATE text_correction_items SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?");
    let done = 0;
    for (const it of these) {
      if (status === "uebernommen" && placed(it)) {
        const problem = acceptCheck(doc, it, it.replacement, all);
        if (problem) {
          if (problem.alone) setAsideUnfit(it, problem.why);
          continue;
        }
      }
      decide.run(status, teacherId, now, it.id);
      const at = all.findIndex((x) => x.id === it.id);
      if (at >= 0) all[at] = { ...all[at], status };
      done++;
    }
    return done;
  })();
  conn.prepare("UPDATE text_corrections SET updated_at = ? WHERE id = ?").run(now, correctionId);
  return n;
}

export type TeacherItemInput = { block: number | null; start: number | null; end: number | null; category: string; kind: ItemKind; replacement: string; explanation: string; rule?: string };

/** The teacher's own correction (with or without KI): a place in the snapshot, or a note on the whole text. Accepted at once. */
export function addTeacherItem(correctionId: number, input: TeacherItemInput, teacherId: number): { item: CorrectionItem } | { error: string } {
  const c = getCorrection(correctionId);
  if (!c) return { error: "Korrektur nicht gefunden." };
  const category = normalizeCategory(input.category);
  if (!category) return { error: "Bitte eine Kategorie wählen." };
  const kind: ItemKind = input.kind === "stil" ? "stil" : input.kind === "hinweis" || input.start === null ? "hinweis" : "fehler";
  const explanation = clip(input.explanation, 300);
  const doc = parseDoc(c.body);
  let quote = "";
  let replacement = "";
  if (kind !== "hinweis") {
    const b = input.block;
    if (b === null || !Number.isInteger(b) || b < 0 || b >= doc.length) return { error: "Diese Stelle gibt es im Text nicht." };
    const t = blockText(doc[b]);
    const s = input.start ?? -1;
    const e = input.end ?? -1;
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e <= s || e > t.length) return { error: "Bitte eine Stelle im Text markieren." };
    quote = t.slice(s, e);
    replacement = input.replacement.replace(/\s+/g, " ").slice(0, 200);
    if (replacement === quote) return { error: "Die Verbesserung ist gleich wie der Text." };
    const all = listItems(correctionId);
    const clash = all.some((i) => placed(i) && i.block === b && i.status !== "abgelehnt" && overlaps({ start: i.pos_start, end: i.pos_end }, { start: s, end: e }));
    if (clash) return { error: "An dieser Stelle gibt es schon eine Korrektur." };
    // accepted at once: checked like every accepted suggestion
    const accepted = all.filter((i) => placed(i) && i.block === b && i.status === "uebernommen").map((i) => ({ start: i.pos_start!, end: i.pos_end!, replacement: i.replacement }));
    const problem = acceptProblem(t, { start: s, end: e, replacement }, accepted);
    if (problem) return { error: `Nicht gespeichert: ${problem.why}` };
  } else if (!explanation) return { error: "Bitte einen Hinweis eingeben." };
  const now = iso();
  const res = db()
    .prepare(
      `INSERT INTO text_correction_items (correction_id, block, pos_start, pos_end, quote, replacement, category, kind, rule, explanation, skill_id, status, source, decided_by, decided_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'uebernommen', 'lehrer', ?, ?, ?)`,
    )
    .run(correctionId, kind === "hinweis" ? (input.block ?? null) : input.block, kind === "hinweis" ? null : input.start, kind === "hinweis" ? null : input.end, quote, replacement, category, kind, clip(input.rule, 60), explanation, teacherId, now, now);
  db().prepare("UPDATE text_corrections SET updated_at = ? WHERE id = ?").run(now, correctionId);
  return { item: db().prepare("SELECT * FROM text_correction_items WHERE id = ?").get(Number(res.lastInsertRowid)) as CorrectionItem };
}

/** Removes one of the teacher's own corrections (KI suggestions are rejected, not removed). */
export function removeTeacherItem(correctionId: number, itemId: number): boolean {
  return db().prepare("DELETE FROM text_correction_items WHERE id = ? AND correction_id = ? AND source = 'lehrer'").run(itemId, correctionId).changes > 0;
}

/** Shows the accepted corrections on the student's device (or hides them again). */
export function setShared(correctionId: number, on: boolean) {
  db().prepare("UPDATE text_corrections SET shared_at = ?, updated_at = ? WHERE id = ?").run(on ? iso() : null, iso(), correctionId);
}

// ---------- for the student and the Lernverlauf ----------

/** The newest correction of a text that the teacher showed the student, with its accepted items. */
export function sharedCorrection(textId: number): { correction: CorrectionRow; items: CorrectionItem[] } | null {
  const c = db().prepare("SELECT * FROM text_corrections WHERE text_id = ? AND shared_at IS NOT NULL ORDER BY version DESC LIMIT 1").get(textId) as CorrectionRow | undefined;
  if (!c) return null;
  return { correction: c, items: listItems(c.id).filter((i) => i.status === "uebernommen") };
}

export type TextCorrectionInfo = { correctionId: number; version: number; fehler: number; stil: number; open: number; shared: boolean };

/** Per text of a student: its newest correction in numbers (accepted errors and suggestions, still open). */
export function correctionInfoForStudent(studentId: number): Map<number, TextCorrectionInfo> {
  const rows = db()
    .prepare(
      `SELECT c.id, c.text_id, c.version, c.shared_at,
        SUM(i.status = 'uebernommen' AND i.kind = 'fehler') AS fehler,
        SUM(i.status = 'uebernommen' AND i.kind = 'stil') AS stil,
        SUM(i.status = 'offen') AS open
       FROM text_corrections c JOIN texts x ON x.id = c.text_id LEFT JOIN text_correction_items i ON i.correction_id = c.id
       WHERE x.student_id = ? AND c.version = (SELECT MAX(version) FROM text_corrections WHERE text_id = c.text_id)
       GROUP BY c.id`,
    )
    .all(studentId) as { id: number; text_id: number; version: number; shared_at: string | null; fehler: number | null; stil: number | null; open: number | null }[];
  return new Map(rows.map((r) => [r.text_id, { correctionId: r.id, version: r.version, fehler: r.fehler ?? 0, stil: r.stil ?? 0, open: r.open ?? 0, shared: Boolean(r.shared_at) }]));
}

/**
 * Confirmed text errors of a student by category (newest correction of each text, accepted errors only),
 * for "Häufige Fehler" in the Lernverlauf. The Lernstand is not changed by them.
 */
export function textErrorsForStudent(studentId: number): { category: string; label: string; count: number; texts: number }[] {
  const rows = db()
    .prepare(
      `SELECT i.category, COUNT(*) AS count, COUNT(DISTINCT c.text_id) AS texts
       FROM text_correction_items i JOIN text_corrections c ON c.id = i.correction_id JOIN texts x ON x.id = c.text_id
       WHERE x.student_id = ? AND i.status = 'uebernommen' AND i.kind = 'fehler'
         AND c.version = (SELECT MAX(version) FROM text_corrections WHERE text_id = c.text_id)
       GROUP BY i.category ORDER BY count DESC`,
    )
    .all(studentId) as { category: string; count: number; texts: number }[];
  return rows.map((r) => ({ ...r, label: categoryInfo(r.category)?.label ?? r.category }));
}

/** The exercise suggested by a correction (see recommendationFrom), with skill names from the database. */
export const recommendationOf = (c: Pick<CorrectionRow, "recommendation" | "recommendation_skill">, o: Overview) => recommendationFrom(c, o, (id) => getSkill(id)?.name ?? null);
