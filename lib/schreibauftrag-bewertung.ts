/**
 * Erwartungshorizont und Bewertung eines Schreibauftrags (Plan 4.2), gespeichert in `auftrag_erwartungen` und
 * `text_bewertungen`.
 *
 * - **Erwartungshorizont** je Auftrag und Kriterium: die Lehrkraft schreibt ihn (oder nimmt die Vorlage der Textsorte)
 *   oder lässt ihn mit KI vorschlagen. Ein Vorschlag ist „Ungeprüft“, bis die Lehrkraft speichert; nur Gespeichertes
 *   gilt. Schüler sehen ihn nur, wenn die Lehrkraft ihn freigibt, und dann nur die gespeicherten Punkte.
 * - **Bewertung** eines abgegebenen Texts: „Bewertung vorschlagen“ fragt die KI nach einer Stufe und einer Begründung
 *   je Kriterium. Das ist ein Vorschlag; als Bewertung gilt nur, was die Lehrkraft bestätigt. Nichts davon geht in
 *   den Lernstand, die Diagnose oder die Dokumentation.
 * - Jedes Zitat und jede Zeilenangabe der KI prüft die App im Text (lib/zitatpruefung.ts).
 * - **„Aufgabe erfüllt?“** (2026-10-23) ist dieselbe Bewertung, erweitert und für jede Textarbeit: je Arbeitsauftrag, den
 *   die App aus der Aufgabenstellung liest, ein Urteil der KI (erfüllt, teilweise, fehlt, nicht beurteilbar). Beim
 *   Schreibauftrag kommt es in derselben Anfrage wie die Stufen, bei einer anderen Textarbeit allein, mit der Angabe der
 *   Lehrkraft (`text_angaben`) oder den Bildbeschreibungen. Was fehlt, sagt die App (fehlendeAngaben); ohne
 *   Aufgabenstellung wird nichts gesendet. Die Prüfung läuft auf Klick im Hintergrund, mit der Korrektur der Sprache
 *   zusammen gestartet (app/correction-actions.ts) oder allein, und lässt sich einzeln wiederholen.
 * - **Note für jede Textarbeit** (2026-10-23, „Aufgabe und Note“): dieselbe Anfrage schlägt auch ohne Schreibauftrag die
 *   vier Kriterien (in den Worten der Schulstufe), eine Gesamtnote und damit das Urteil je Auftrag vor; liegt die
 *   Korrektur der Sprache schon vor, zählt ihre Fehlerzahl. „Bewertung übernehmen“ (bestaetigeBewertung) macht daraus die
 *   Bewertung der Lehrkraft. Erst dann steht sie in der Dokumentation der Einheit (lib/learning.ts textBewertungInDoku) und
 *   zählt für den Lernstand einer Fähigkeit (lib/text-note.ts); ein Vorschlag zählt nirgends.
 */
import { createHash } from "node:crypto";
import { after } from "next/server";
import { costOf, FUNCTIONS, routeFor } from "./ai/config";
import { PROVIDER_LABEL } from "./ai/providers";
import { aiEnabled, breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { estimateTokensBewertung, kiAufgaben, kiBewertung, kiErwartung, type AuftragDaten, type AuftragErgebnis, type KriteriumVorschlag, type Sprachbefund } from "./ai/schreibauftrag-bewertung";
import {
  erwartungLeer,
  fehlendeAngaben,
  KRITERIEN,
  kriterienFuer,
  parseBewertung,
  parseErwartung,
  stufeOf,
  vorlageFor,
  type Bewertung,
  type Erwartung,
  type FehlendeAngaben,
  type FehltZeile,
  type KriteriumText,
  type Stufe,
} from "./bewertung-kriterien";
import { db } from "./db";
import { textBewertungInDoku } from "./learning";
import { pictureContext } from "./picture-story";
import { listSkills } from "./repo";
import { auftragFor } from "./schreibauftrag-store";
import { SORTEN, type AuftragView } from "./schreibauftrag";
import { skillFuerText, type SkillInfo } from "./text-note";
import { blockText, parseDoc } from "./text-doc";
import { foundNames, levelOfText, maskText, namePattern, namesToHide, startAICorrection, type CorrectionMethod, type StartResult } from "./text-correction";
import { bareText, cleanStory } from "./textinterpretation";
import { getText, setTextStatus, type TextView } from "./texts";
import { pruefgrundlage, type GefundenerBeleg } from "./zitatpruefung";

const iso = () => new Date().toISOString();

/** Woran die App merkt, dass die Textbeilage seit dem Speichern geändert wurde (Zeilenangaben prüfen). */
export const beilageHash = (a: Pick<AuftragView, "text" | "countBlank">) => createHash("sha256").update(`${a.countBlank ? 1 : 0}\n${cleanStory(a.text)}`).digest("hex").slice(0, 16);

// ---------- Erwartungshorizont ----------

type ErwartungRow = {
  text_id: number;
  kriterien: string;
  beilage_hash: string;
  gespeichert_at: string | null;
  freigegeben: number;
  vorschlag: string;
  vorschlag_verworfen: number;
  vorschlag_at: string | null;
};

export type ErwartungInfo = {
  /** was die Lehrkraft gespeichert hat; null: noch nichts */
  gespeichert: Erwartung | null;
  gespeichertAt: string | null;
  freigegeben: boolean;
  /** der Vorschlag der KI, ungeprüft, bis die Lehrkraft speichert */
  vorschlag: Erwartung | null;
  /** so viele Punkte hat die Zitatprüfung aus dem Vorschlag genommen */
  verworfen: number;
  vorschlagAt: string | null;
  /** die Vorlage aus der Textsorte (ohne KI), für ein leeres Formular */
  vorlage: Erwartung;
  /** die Textbeilage wurde nach dem Speichern geändert */
  beilageGeaendert: boolean;
};

const erwartungRow = (textId: number) => (db().prepare("SELECT * FROM auftrag_erwartungen WHERE text_id = ?").get(textId) as ErwartungRow | undefined) ?? null;

export function erwartungInfo(textId: number): ErwartungInfo | null {
  const a = auftragFor(textId);
  const text = getText(textId);
  if (!a || !text) return null;
  const r = erwartungRow(textId);
  const gespeichert = parseErwartung(r?.kriterien);
  return {
    gespeichert,
    gespeichertAt: r?.gespeichert_at ?? null,
    freigegeben: Boolean(r?.freigegeben) && gespeichert !== null,
    vorschlag: parseErwartung(r?.vorschlag),
    verworfen: r?.vorschlag ? r.vorschlag_verworfen : 0,
    vorschlagAt: r?.vorschlag ? r.vorschlag_at : null,
    vorlage: vorlageFor(a, text.prompt),
    beilageGeaendert: Boolean(gespeichert && r?.beilage_hash && r.beilage_hash !== beilageHash(a)),
  };
}

function ensureErwartung(textId: number) {
  db().prepare("INSERT OR IGNORE INTO auftrag_erwartungen (text_id) VALUES (?)").run(textId);
}

/** Speichert den Erwartungshorizont der Lehrkraft; ein offener Vorschlag ist damit erledigt. Alles leer: gelöscht. */
export function speichereErwartung(textId: number, e: Erwartung, teacherId: number | null): boolean {
  const a = auftragFor(textId);
  if (!a) return false;
  ensureErwartung(textId);
  if (erwartungLeer(e)) {
    db().prepare("UPDATE auftrag_erwartungen SET kriterien = '', freigegeben = 0, gespeichert_at = NULL, vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?").run(textId);
    return true;
  }
  db()
    .prepare("UPDATE auftrag_erwartungen SET kriterien = ?, beilage_hash = ?, gespeichert_at = ?, gespeichert_von = ?, vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?")
    .run(JSON.stringify(e), beilageHash(a), iso(), teacherId, textId);
  return true;
}

/** Freigeben für den Schüler, nur einen gespeicherten Erwartungshorizont. */
export function setzeFreigabe(textId: number, on: boolean): boolean {
  const r = erwartungRow(textId);
  if (on && !parseErwartung(r?.kriterien)) return false;
  if (!r) return !on;
  db().prepare("UPDATE auftrag_erwartungen SET freigegeben = ? WHERE text_id = ?").run(on ? 1 : 0, textId);
  return true;
}

export function verwirfErwartungVorschlag(textId: number) {
  db().prepare("UPDATE auftrag_erwartungen SET vorschlag = '', vorschlag_at = NULL, vorschlag_verworfen = 0 WHERE text_id = ?").run(textId);
}

/**
 * Was der Schüler beim Schreiben sieht: nur ein gespeicherter und freigegebener Erwartungshorizont, nie ein Vorschlag.
 * null: nichts freigegeben.
 */
export function freigegebeneErwartung(textId: number): { name: string; punkte: string[] }[] | null {
  const r = erwartungRow(textId);
  if (!r?.freigegeben) return null;
  const e = parseErwartung(r.kriterien);
  if (!e) return null;
  return KRITERIEN.map((k) => ({ name: k.name, punkte: e[k.key] })).filter((k) => k.punkte.length);
}

// ---------- KI: whether it can be asked, and what it gets ----------

/** Ob die KI jetzt gefragt werden kann; sonst der Grund in Worten. */
export function kiStatus(fn: "erwartung" | "bewertung", studentId: number): { moeglich: boolean; grund: string | null } {
  const grund = !aiEnabled(fn)
    ? "Die KI ist aus oder nicht eingerichtet. Du kannst alles selbst eintragen."
    : budgetUsedUp(fn)
      ? "Das KI-Budget für diesen Monat ist aufgebraucht. Du kannst alles selbst eintragen."
      : schuelerGestoppt(fn, studentId)
        ? grenzeErreichtText()
        : breakerState().paused
          ? "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten."
          : null;
  return { moeglich: grund === null, grund };
}

/**
 * Wer verborgen wird: Schüler, Lehrkräfte und weitere Namen, die die App im Text findet, außer Namen, die in der
 * Textbeilage stehen (Figuren, Autorin): die Textbeilage geht ohnehin mit, und Zitate daraus müssen sich finden lassen.
 */
function namenMuster(text: TextView, a: Pick<AuftragView, "text" | "author">, gewaehlt: string[] | null = null): RegExp | null {
  const beilage = ` ${bareText(`${a.text} ${a.author}`)} `;
  // gewaehlt: die Namen, die die Lehrkraft in der Freigabe der Korrektur verbergen ließ; sonst alle, die die App findet
  const gefunden = (gewaehlt ?? foundNames(text, parseDoc(text.body))).filter((n) => !bareText(n).split(" ").every((w) => beilage.includes(` ${w} `)));
  return namePattern([...namesToHide(text), ...gefunden]);
}

function auftragDaten(text: TextView, a: AuftragView, muster: RegExp | null): AuftragDaten {
  return {
    auftrag: { ...a, situation: maskText(a.situation, muster).masked },
    arbeitsauftrag: maskText(text.prompt, muster).masked,
    stufe: levelOfText(text).label,
  };
}

const laufend = new Map<string, Promise<VorschlagErgebnis>>();
export type VorschlagErgebnis = { ok: true; verworfen: number } | { ok: false; error: string };

/** „Mit KI vorschlagen“: ein Vorschlag für den Erwartungshorizont, ungeprüft, bis die Lehrkraft speichert. */
export function erwartungVorschlagen(textId: number, teacherId: number | null): Promise<VorschlagErgebnis> {
  const key = `e${textId}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<VorschlagErgebnis> => {
    const text = getText(textId);
    const a = auftragFor(textId);
    if (!text || !a) return { ok: false, error: "Diesen Schreibauftrag gibt es nicht." };
    const geht = kiStatus("erwartung", text.student_id);
    if (!geht.moeglich) return { ok: false, error: geht.grund! };
    const muster = namenMuster(text, a);
    const g = pruefgrundlage({ beilage: a.text, countBlank: a.countBlank, titel: a.title, medium: a.medium });
    const out = await kiErwartung(auftragDaten(text, a, muster), g, { teacherId, studentId: text.student_id, trigger: "erwartung" });
    if (!out.ok) return { ok: false, error: out.error };
    ensureErwartung(textId);
    db().prepare("UPDATE auftrag_erwartungen SET vorschlag = ?, vorschlag_verworfen = ?, vorschlag_at = ?, vorschlag_call_id = ? WHERE text_id = ?").run(JSON.stringify(out.erwartung), out.verworfen, iso(), out.callId, textId);
    return { ok: true, verworfen: out.verworfen };
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

// ---------- Bewertung ----------

type BewertungRow = {
  text_id: number;
  kriterien: string;
  note: number | null;
  version: number | null;
  bestaetigt_at: string | null;
  vorschlag: string;
  vorschlag_version: number | null;
  vorschlag_verworfen: number;
  vorschlag_at: string | null;
  vorschlag_note: number | null;
  vorschlag_ohne_inhalt: number;
  lernstand_skill: string;
};

export type BewertungVorschlag = {
  kriterien: KriteriumVorschlag[];
  /** die Gesamtnote, die die KI vorschlägt; null: keine (etwa weil der Inhalt nicht zu beurteilen war) */
  note: Stufe | null;
  /** die App hat den Vorschlag für Inhalt weggelassen: ein Auftrag war nicht zu beurteilen */
  ohneInhalt: boolean;
  verworfen: number;
  version: number | null;
  at: string | null;
};

export type BewertungInfo = {
  /** nur das zählt: von der Lehrkraft bestätigt */
  bestaetigt: Bewertung | null;
  bestaetigtAt: string | null;
  /** die Fassung des Texts, die bestätigt wurde */
  version: number | null;
  vorschlag: BewertungVorschlag | null;
  /** die Fähigkeit, für die die bestätigte Note im Lernstand zählt; '' = keine */
  lernstandSkill: string;
};

const bewertungRow = (textId: number) => (db().prepare("SELECT * FROM text_bewertungen WHERE text_id = ?").get(textId) as BewertungRow | undefined) ?? null;

function parseVorschlag(json: string): KriteriumVorschlag[] | null {
  if (!json) return null;
  try {
    const list = JSON.parse(json) as KriteriumVorschlag[];
    return Array.isArray(list) ? list.map((k) => ({ ...k, belege: Array.isArray(k.belege) ? (k.belege as GefundenerBeleg[]) : [] })) : null;
  } catch {
    return null;
  }
}

export function bewertungInfo(textId: number): BewertungInfo {
  const r = bewertungRow(textId);
  const v = parseVorschlag(r?.vorschlag ?? "");
  return {
    bestaetigt: parseBewertung(r?.kriterien),
    bestaetigtAt: r?.bestaetigt_at ?? null,
    version: r?.version ?? null,
    vorschlag: v && r ? { kriterien: v, note: stufeOf(r.vorschlag_note), ohneInhalt: Boolean(r.vorschlag_ohne_inhalt), verworfen: r.vorschlag_verworfen, version: r.vorschlag_version, at: r.vorschlag_at } : null,
    lernstandSkill: r?.bestaetigt_at ? r.lernstand_skill : "",
  };
}

/** Die vier Kriterien in den Worten der Schulstufe dieses Texts (Oberstufe: die der SRDP). */
export const kriterienDesTexts = (text: TextView): KriteriumText[] => kriterienFuer(levelOfText(text).band);

/**
 * Die Fähigkeit, für die die Note dieses Texts im Lernstand zählt (lib/text-note.ts skillFuerText): beim Schreibauftrag
 * die seiner Textsorte, sonst die Textsorte bei der Schulstufe des Schülers. null: keine passende, die Note zählt nicht.
 */
export function lernstandSkillFuer(text: TextView, skills: SkillInfo[] = listSkills()): SkillInfo | null {
  const a = auftragFor(text.id);
  return skillFuerText(
    { fach: text.subject, textsorte: text.topic, schulstufe: levelOfText(text).schulstufe, sorteSkill: a ? SORTEN[a.sorte].skill : null, bildgeschichte: Boolean(pictureContext(text.id)) },
    skills,
  );
}

/**
 * Was die Korrektur der Sprache an der aktuellen Fassung gefunden hat, wenn sie fertig ist: Fehler (keine Stilvorschläge),
 * die nicht abgelehnt wurden. null: noch keine fertige Korrektur dieser Fassung.
 */
export function sprachBefund(text: Pick<TextView, "id" | "version">): Sprachbefund | null {
  const r = db()
    .prepare(
      `SELECT c.words, c.ai_status, SUM(i.kind = 'fehler' AND i.status <> 'abgelehnt') AS fehler, COUNT(i.id) AS alle
       FROM text_corrections c LEFT JOIN text_correction_items i ON i.correction_id = c.id WHERE c.text_id = ? AND c.version = ? GROUP BY c.id`,
    )
    .get(text.id, text.version) as { words: number; ai_status: string; fehler: number | null; alle: number } | undefined;
  // fertig: die KI hat geprüft, oder die Lehrkraft hat selbst korrigiert und Markierungen gesetzt
  if (!r || !r.words || !(r.ai_status === "fertig" || (r.ai_status === "keine" && r.alle > 0))) return null;
  return { fehler: r.fehler ?? 0, woerter: r.words };
}

/** Ab so vielen Wörtern gibt es einen Vorschlag; die Lehrkraft kann jeden Text selbst bewerten. */
export const BEWERTUNG_MIN_WORDS = 30;
export const BEWERTUNG_MAX_WORDS = 2_500;

/** Ob „Bewertung vorschlagen“ für diesen Text geht; sonst der Grund. */
export function bewertungMoeglich(text: TextView): string | null {
  if (text.status !== "fertig") return "Den Vorschlag gibt es, sobald der Text abgegeben ist.";
  if (text.words < BEWERTUNG_MIN_WORDS) return `Für einen Vorschlag braucht der Text mindestens ${BEWERTUNG_MIN_WORDS} Wörter.`;
  if (text.words > BEWERTUNG_MAX_WORDS) return `Für einen Vorschlag ist der Text zu lang (höchstens ${BEWERTUNG_MAX_WORDS.toLocaleString("de-AT")} Wörter).`;
  return kiStatus("bewertung", text.student_id).grund;
}

/**
 * „Bewertung vorschlagen“, nach der Zustimmung der Lehrkraft, und wartet auf das Ergebnis: dieselbe Prüfung wie
 * „Aufgabe erfüllt?“ (startAufgabenPruefung). Der Text ohne Namen, der Erwartungshorizont (gespeichert, sonst die Vorlage
 * der Textsorte, nie ein ungeprüfter Vorschlag) und die Textbeilage gehen an die KI. Der Vorschlag ersetzt einen
 * älteren Vorschlag; eine bestätigte Bewertung bleibt, bis die Lehrkraft eine neue bestätigt.
 */
export async function bewertungVorschlagen(textId: number, teacherId: number | null, o: { zustimmung: boolean }): Promise<VorschlagErgebnis> {
  if (!o.zustimmung) return { ok: false, error: "Bitte zuerst bestätigen, dass der Text ohne Namen an die KI gehen darf." };
  const text = getText(textId);
  if (!text) return { ok: false, error: "Diesen Text gibt es nicht." };
  const nicht = bewertungMoeglich(text);
  if (nicht) return { ok: false, error: nicht };
  const r = await startAufgabenPruefung(textId, teacherId, { consent: true, wait: true, neu: true });
  if (!r.ok) return { ok: false, error: r.error };
  const p = pruefungInfo(textId);
  if (p.status !== "fertig") return { ok: false, error: p.status === "laeuft" ? "Die Prüfung läuft schon." : p.fehler || "Die KI hat keine brauchbare Bewertung geliefert." };
  return { ok: true, verworfen: (bewertungInfo(textId).vorschlag?.verworfen ?? 0) + p.verworfen };
}

const OHNE_VORSCHLAG = "vorschlag = '', vorschlag_version = NULL, vorschlag_verworfen = 0, vorschlag_at = NULL, vorschlag_note = NULL, vorschlag_ohne_inhalt = 0";

/**
 * „Bewertung übernehmen“: die Lehrkraft bestätigt Stufen, Note und das Urteil je Auftrag (bei jeder Textarbeit). Nur diese
 * Werte gelten; ein offener Vorschlag ist damit erledigt. Die Note zählt ab jetzt für den Lernstand der Fähigkeit des Texts
 * (ersetzt eine frühere Bestätigung, zählt nie doppelt) und steht in der Dokumentation der Einheit, in der der Text
 * geschrieben wurde; dort ändert sich nur, was die App selbst geschrieben hat.
 */
export function bestaetigeBewertung(textId: number, b: Bewertung, teacherId: number | null): boolean {
  const text = getText(textId);
  if (!text) return false;
  db().prepare("INSERT OR IGNORE INTO text_bewertungen (text_id) VALUES (?)").run(textId);
  db()
    .prepare(`UPDATE text_bewertungen SET kriterien = ?, note = ?, version = ?, bestaetigt_at = ?, bestaetigt_von = ?, lernstand_skill = ?, ${OHNE_VORSCHLAG} WHERE text_id = ?`)
    .run(JSON.stringify(b), b.note, text.version, iso(), teacherId, lernstandSkillFuer(text)?.id ?? "", textId);
  // eine übernommene Note heißt: der Text ist fertig (sonst steht er weiter „in Arbeit“ in Lernverlauf und Liste)
  if (text.status !== "fertig") setTextStatus(textId, "fertig");
  textBewertungInDoku(textId);
  return true;
}

/** „Bewertung zurücknehmen“: die Note gilt nicht mehr, weder in der Dokumentation noch im Lernstand. */
export function nimmBewertungZurueck(textId: number): boolean {
  const r = db().prepare("UPDATE text_bewertungen SET kriterien = '', note = NULL, version = NULL, bestaetigt_at = NULL, bestaetigt_von = NULL, lernstand_skill = '' WHERE text_id = ? AND bestaetigt_at IS NOT NULL").run(textId);
  if (r.changes) textBewertungInDoku(textId);
  return r.changes > 0;
}

export function verwirfBewertungVorschlag(textId: number) {
  db().prepare(`UPDATE text_bewertungen SET ${OHNE_VORSCHLAG} WHERE text_id = ?`).run(textId);
}

// ---------- Angabe / Textvorlage einer Textarbeit ----------

export const MAX_ANGABE = 30_000;

/** Die Angabe aus dem Formular: Zeilen bleiben (für die Zeilennummern), Leerraum am Zeilenende und viele Leerzeilen nicht. */
export const cleanAngabe = (v: unknown) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_ANGABE);

/** Was die Lehrkraft als Angabe oder Textvorlage eingefügt hat; '' = nichts. Nur für Lehrkraft und KI-Prüfung. */
export function angabeOf(textId: number): string {
  return (db().prepare("SELECT text FROM text_angaben WHERE text_id = ?").get(textId) as { text: string } | undefined)?.text ?? "";
}

export function speichereAngabe(textId: number, text: string, teacherId: number | null) {
  db()
    .prepare("INSERT INTO text_angaben (text_id, text, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(text_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
    .run(textId, cleanAngabe(text), iso(), teacherId);
}

// ---------- „Aufgabe erfüllt?“ ----------

export type PruefungArt = "schreibauftrag" | "bildgeschichte" | "text";

/** Woran die Aufgabe gemessen wird: die Art des Texts, die Vorlage und was fehlt (lib/bewertung-kriterien.ts). */
export type AufgabeGrundlage = {
  art: PruefungArt;
  /** die Textbeilage, die Bildbeschreibungen („Bild 1: …“) oder die Angabe der Lehrkraft; '' = keine */
  vorlage: string;
  countBlank: boolean;
  auftrag: AuftragView | null;
  fehlend: FehlendeAngaben;
};

const wortzahl = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function aufgabeGrundlage(text: TextView): AufgabeGrundlage {
  const a = auftragFor(text.id);
  const p = a ? null : pictureContext(text.id);
  const art: PruefungArt = a ? "schreibauftrag" : p ? "bildgeschichte" : "text";
  const vorlage = a ? a.text : p ? p.captions.map((c, i) => (c.trim() ? `Bild ${i + 1}: ${c.replace(/\s+/g, " ").trim()}` : "")).filter(Boolean).join("\n") : angabeOf(text.id);
  const fehlend = fehlendeAngaben({
    prompt: text.prompt,
    art,
    vorlage,
    erwartungGespeichert: a ? erwartungInfo(text.id)?.gespeichert != null : undefined,
    fertig: text.status === "fertig",
    woerter: text.words,
    minWoerter: BEWERTUNG_MIN_WORDS,
    maxWoerter: BEWERTUNG_MAX_WORDS,
  });
  return { art, vorlage, countBlank: a?.countBlank ?? false, auftrag: a, fehlend };
}

export type PruefungStatus = "keine" | "laeuft" | "fertig" | "fehler";

type PruefungRow = {
  auftraege: string;
  auftraege_version: number | null;
  auftraege_at: string | null;
  pruefung_status: string;
  pruefung_fehler: string;
  pruefung_start: string | null;
  pruefung_freigabe_at: string | null;
  pruefung_namen: string;
};

export type PruefungInfo = {
  status: PruefungStatus;
  /** warum sie fehlgeschlagen ist, wie die Lehrkraft es liest */
  fehler: string;
  startedAt: string | null;
  /** das letzte Ergebnis (bleibt bei einem Fehler danach stehen); null: noch keines */
  auftraege: AuftragErgebnis[] | null;
  verworfen: number;
  /** was bei diesem Ergebnis fehlte („Was gefehlt hat“), wie die App es beim Prüfen bestimmt hat */
  fehlte: FehltZeile[];
  /** die Fassung des Texts, die geprüft wurde */
  version: number | null;
  at: string | null;
  /** die Lehrkraft hat zugestimmt: „Erneut versuchen“ braucht keinen neuen Haken */
  freigegeben: boolean;
};

/** So lange darf eine Prüfung laufen, dann gilt sie als unterbrochen. */
const pruefungLimitMs = () => FUNCTIONS.bewertung.timeoutMs + 60_000;

const pruefungRow = (textId: number) =>
  (db().prepare("SELECT auftraege, auftraege_version, auftraege_at, pruefung_status, pruefung_fehler, pruefung_start, pruefung_freigabe_at, pruefung_namen FROM text_bewertungen WHERE text_id = ?").get(textId) as PruefungRow | undefined) ?? null;

type Ergebnis = { auftraege: AuftragErgebnis[]; verworfen: number; fehlte: FehltZeile[] };

function parseAuftraege(json: string): Ergebnis | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<Ergebnis>;
    return Array.isArray(raw.auftraege)
      ? { auftraege: raw.auftraege.map((x) => ({ ...x, belege: Array.isArray(x.belege) ? x.belege : [] })), verworfen: Number(raw.verworfen) || 0, fehlte: Array.isArray(raw.fehlte) ? raw.fehlte : [] }
      : null;
  } catch {
    return null;
  }
}

export function pruefungInfo(textId: number, now = Date.now()): PruefungInfo {
  const r = pruefungRow(textId);
  const ergebnis = parseAuftraege(r?.auftraege ?? "");
  let status: PruefungStatus = r && ["laeuft", "fertig", "fehler"].includes(r.pruefung_status) ? (r.pruefung_status as PruefungStatus) : "keine";
  let fehler = r?.pruefung_fehler ?? "";
  if (status === "laeuft" && (!r?.pruefung_start || Date.parse(r.pruefung_start) < now - pruefungLimitMs())) {
    status = "fehler";
    fehler = "Die Prüfung wurde unterbrochen.";
  }
  return {
    status,
    fehler,
    startedAt: r?.pruefung_start ?? null,
    auftraege: ergebnis?.auftraege ?? null,
    verworfen: ergebnis?.verworfen ?? 0,
    fehlte: ergebnis?.fehlte ?? [],
    version: r?.auftraege_version ?? null,
    at: r?.auftraege_at ?? null,
    freigegeben: Boolean(r?.pruefung_freigabe_at),
  };
}

/** Was die Lehrkraft in der Freigabe sieht: was fehlt, welche Aufträge die KI prüft, was es etwa kostet. */
export type AufgabeVorschau = {
  pruefbar: boolean;
  zeilen: FehlendeAngaben["zeilen"];
  punkte: string[];
  art: PruefungArt;
  /** „die Textbeilage“, „die Bildbeschreibungen“, „die Angabe“; null: keine Vorlage */
  vorlage: string | null;
  costUsd: number;
  provider: string;
  model: string;
  /** für diese Fassung schon geprüft oder läuft gerade: der Klick sendet sie nicht noch einmal */
  schonDa: boolean;
  /** warum die KI gerade nicht kann (aus, Budget, Grenze je Schüler) */
  grund: string | null;
};

export function aufgabeVorschau(text: TextView): AufgabeVorschau {
  const g = aufgabeGrundlage(text);
  const route = routeFor("bewertung");
  const t = estimateTokensBewertung({ woerter: text.words, vorlageWoerter: wortzahl(g.vorlage), auftraege: g.fehlend.auftraege.punkte.length, srdp: g.art === "schreibauftrag" });
  const p = pruefungInfo(text.id);
  return {
    pruefbar: g.fehlend.pruefbar,
    zeilen: g.fehlend.zeilen,
    punkte: g.fehlend.auftraege.punkte,
    art: g.art,
    vorlage: !g.vorlage.trim() ? null : g.art === "schreibauftrag" ? "die Textbeilage" : g.art === "bildgeschichte" ? "die Bildbeschreibungen" : "die Angabe",
    costUsd: costOf(route.model, FUNCTIONS.bewertung.tier, { input: t.input, output: t.output, cacheWrite: 0, cacheRead: 0 }),
    provider: PROVIDER_LABEL[route.provider],
    model: route.model,
    schonDa: p.status === "laeuft" || (p.status === "fertig" && p.version === text.version),
    grund: kiStatus("bewertung", text.student_id).grund,
  };
}

export type PruefungStart = { ok: true; reused: boolean } | { ok: false; error: string; uebersprungen?: boolean };

const isoAt = (ms: number) => new Date(ms).toISOString();

/**
 * Startet „Aufgabe erfüllt?“ nach der Zustimmung der Lehrkraft und kehrt gleich zurück; das Ergebnis kommt im
 * Hintergrund (die Seite fragt nach). Ohne Aufgabenstellung (oder bei einem Text, der nicht abgegeben ist) wird nichts
 * gesendet: `uebersprungen`. Eine Fassung, die schon geprüft ist, wird nicht noch einmal gesendet, außer mit `neu`
 * („Neu prüfen“). names: die Namen aus der Freigabe der Korrektur, die verborgen werden.
 */
export function startAufgabenPruefung(textId: number, teacherId: number | null, o: { consent: boolean; names?: string[]; wait?: boolean; neu?: boolean }): PruefungStart | Promise<PruefungStart> {
  if (!o.consent) return { ok: false, error: "Bitte zuerst bestätigen, dass der Text ohne Namen an die KI gehen darf." };
  const text = getText(textId);
  if (!text) return { ok: false, error: "Text nicht gefunden." };
  const g = aufgabeGrundlage(text);
  if (!g.fehlend.pruefbar) return { ok: false, error: g.fehlend.zeilen.find((z) => z.ton === "stopp")?.text ?? "Diese Aufgabe lässt sich nicht prüfen.", uebersprungen: true };
  const grund = kiStatus("bewertung", text.student_id).grund;
  if (grund) return { ok: false, error: grund };
  const p = pruefungInfo(textId);
  if (p.status === "laeuft" || (p.status === "fertig" && p.version === text.version && !o.neu)) return { ok: true, reused: true };
  db().prepare("INSERT OR IGNORE INTO text_bewertungen (text_id) VALUES (?)").run(textId);
  const now = Date.now();
  const claimed = db()
    .prepare(
      `UPDATE text_bewertungen SET pruefung_status = 'laeuft', pruefung_fehler = '', pruefung_start = ?, pruefung_freigabe_at = ?, pruefung_freigabe_von = ?,
       pruefung_namen = COALESCE(?, pruefung_namen)
       WHERE text_id = ? AND (pruefung_status IN ('keine', 'fertig', 'fehler') OR (pruefung_status = 'laeuft' AND (pruefung_start IS NULL OR pruefung_start < ?)))`,
    )
    .run(isoAt(now), isoAt(now), teacherId, o.names ? JSON.stringify(o.names) : null, textId, isoAt(now - pruefungLimitMs()));
  if (!claimed.changes) return { ok: true, reused: true };
  const run = runAufgabenPruefung(textId, teacherId).then((): PruefungStart => ({ ok: true, reused: false }));
  if (o.wait) return run;
  try {
    after(() => run);
  } catch {
    // außerhalb einer Anfrage (Tests, Skripte): das Promise läuft von selbst weiter
  }
  return { ok: true, reused: false };
}

/**
 * „Korrigieren“ nach der Freigabe: ein Klick startet beide Teile, die Korrektur der Sprache (lib/text-correction.ts,
 * unverändert, im gewählten Verfahren) und mit `aufgabe` „Aufgabe erfüllt?“, mit derselben Zustimmung und denselben
 * Namen. Scheitert der Start der Sprache, wird nichts weiter gesendet. Fehlt die Aufgabenstellung, überspringt die App
 * die Aufgabe von selbst (`uebersprungen`). Jeder Teil läuft für sich im Hintergrund und behält sein Ergebnis oder seinen Fehler.
 */
export async function korrigierenStarten(
  textId: number,
  teacherId: number,
  o: { consent: boolean; unitId?: number | null; method?: CorrectionMethod; names?: string[]; aufgabe: boolean; wait?: boolean },
): Promise<{ sprache: StartResult; aufgabe: PruefungStart | null }> {
  const sprache = await startAICorrection(textId, teacherId, { consent: o.consent, unitId: o.unitId, method: o.method, names: o.names, wait: o.wait });
  if (!sprache.ok || !o.aufgabe) return { sprache, aufgabe: null };
  return { sprache, aufgabe: await startAufgabenPruefung(textId, teacherId, { consent: o.consent, names: o.names, wait: o.wait }) };
}

/** „Erneut versuchen“ nach einem Fehler, nur auf Klick: mit der Zustimmung und den Namen von vorhin. */
export function retryAufgabenPruefung(textId: number, teacherId: number | null, o: { wait?: boolean } = {}): PruefungStart | Promise<PruefungStart> {
  const p = pruefungInfo(textId);
  if (p.status === "laeuft") return { ok: true, reused: true };
  if (p.status !== "fehler" || !p.freigegeben) return { ok: false, error: "Hier ist nichts fehlgeschlagen, das sich wiederholen lässt." };
  return startAufgabenPruefung(textId, teacherId, { consent: true, wait: o.wait, neu: true });
}

function gewaehlteNamen(json: string): string[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
}

/**
 * Fragt die KI und speichert das geprüfte Ergebnis. Wirft nie; ein Fehler bleibt mit Grund an der Zeile, ein früheres
 * Ergebnis bleibt stehen. Beim Schreibauftrag füllt dieselbe Antwort auch den Vorschlag der Bewertung.
 */
export async function runAufgabenPruefung(textId: number, teacherId: number | null): Promise<void> {
  const fail = (m: string) => db().prepare("UPDATE text_bewertungen SET pruefung_status = 'fehler', pruefung_fehler = ? WHERE text_id = ?").run(m.slice(0, 300), textId);
  try {
    const text = getText(textId);
    if (!text) return void fail("Text nicht gefunden.");
    const g = aufgabeGrundlage(text);
    if (!g.fehlend.pruefbar) return void fail(g.fehlend.zeilen.find((z) => z.ton === "stopp")?.text ?? "Diese Aufgabe lässt sich nicht prüfen.");
    const namen = gewaehlteNamen(pruefungRow(textId)?.pruefung_namen ?? "");
    const punkte = g.fehlend.auftraege.punkte;
    const meta = { teacherId, studentId: text.student_id, trigger: "bewertung" };
    const a = g.auftrag;
    // die Fremdnamen, die auch in der Vorlage stehen (Figuren, Autorin, die Firma der Stellenanzeige), bleiben stehen,
    // damit Zitate daraus auffindbar sind; die Vorlage geht ohnehin mit
    const muster = namenMuster(text, a ?? { text: g.art === "text" ? g.vorlage : "", author: "" }, namen);
    const absaetze = parseDoc(text.body)
      .map((b) => maskText(blockText(b), muster).masked.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    const masked = (x: string) => maskText(x, muster).masked;
    let ergebnis: Ergebnis;
    const now = iso();
    // die Korrektur der Sprache, wenn sie schon fertig ist (meist läuft sie gleichzeitig: dann beurteilt die KI selbst)
    const sprache = sprachBefund(text);
    const vorschlagSpeichern = (o: { kriterien: KriteriumVorschlag[]; note: Stufe | null; ohneInhalt: boolean; verworfen: number; callId: number | null }) =>
      db()
        .prepare("UPDATE text_bewertungen SET vorschlag = ?, vorschlag_version = ?, vorschlag_verworfen = ?, vorschlag_at = ?, vorschlag_call_id = ?, vorschlag_note = ?, vorschlag_ohne_inhalt = ? WHERE text_id = ?")
        .run(o.kriterien.length ? JSON.stringify(o.kriterien) : "", text.version, o.verworfen, o.kriterien.length ? now : null, o.callId, o.note, o.ohneInhalt ? 1 : 0, textId);
    if (a) {
      const e = erwartungInfo(textId)!;
      const pg = pruefgrundlage({ beilage: a.text, countBlank: a.countBlank, schueler: absaetze, titel: a.title, medium: a.medium });
      const out = await kiBewertung({ ...auftragDaten(text, a, muster), erwartung: e.gespeichert ?? e.vorlage, erwartungGespeichert: e.gespeichert !== null, absaetze, woerter: text.words, punkte: punkte.map(masked), sprache }, pg, meta);
      if (!out.ok) return void fail(out.error);
      ergebnis = { auftraege: out.auftraege, verworfen: out.auftraegeVerworfen, fehlte: g.fehlend.zeilen };
      vorschlagSpeichern(out);
    } else {
      // Bildbeschreibungen mit allen Namen verborgen wie bei der Korrektur der Sprache; die Angabe nur ohne Schüler- und Lehrernamen
      const vorlage = g.art === "bildgeschichte" ? masked(g.vorlage) : maskText(g.vorlage, namePattern(namesToHide(text))).masked;
      const pg = pruefgrundlage({ beilage: vorlage, schueler: absaetze });
      const level = levelOfText(text);
      const out = await kiAufgaben(
        { fach: text.subject || "Deutsch", textsorte: text.topic, stufe: level.label, band: level.band, sprache, rahmen: g.fehlend.auftraege.rahmen.map(masked), punkte: punkte.map(masked), vorlage, absaetze, woerter: text.words },
        pg,
        meta,
      );
      if (!out.ok) return void fail(out.error);
      ergebnis = { auftraege: out.auftraege, verworfen: out.verworfen, fehlte: g.fehlend.zeilen };
      vorschlagSpeichern({ ...out, verworfen: out.kriterienVerworfen });
    }
    // die Aufträge, wie die App sie gelesen hat (ohne [Name]), nicht wie sie an die KI gingen
    ergebnis.auftraege = ergebnis.auftraege.map((x, i) => ({ ...x, text: punkte[i] ?? x.text }));
    db()
      .prepare("UPDATE text_bewertungen SET auftraege = ?, auftraege_version = ?, auftraege_at = ?, pruefung_status = 'fertig', pruefung_fehler = '' WHERE text_id = ?")
      .run(JSON.stringify(ergebnis), text.version, now, textId);
  } catch (e) {
    fail(e instanceof Error && e.message ? `Die Prüfung ist fehlgeschlagen (${e.message}).` : "Die Prüfung ist fehlgeschlagen.");
  }
}

/** Was „Erneut versuchen“ etwa kostet, in US-Cent, mindestens 1. */
export const aufgabeCents = (v: Pick<AufgabeVorschau, "costUsd">) => Math.max(1, Math.round(v.costUsd * 100));

/** Zusammengezählt, für den Knopf auf der Textseite: wie viele Aufträge erfüllt sind. */
export function aufgabeStand(p: PruefungInfo): { erfuellt: number; von: number } | null {
  return p.auftraege ? { erfuellt: p.auftraege.filter((a) => a.status === "erfuellt").length, von: p.auftraege.length } : null;
}
