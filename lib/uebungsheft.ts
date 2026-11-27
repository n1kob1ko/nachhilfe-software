/**
 * **Übungsheft zu den Fehlern** (niko, 27.11.2026: ein in Claude erstelltes Blatt „Gruselgeschichte – Übungen zu deinen Fehlern“,
 * 15 Seiten mit Merke-Kästen, Sätzen aus den eigenen Geschichten, Fehlerdetektiv und Kontroll-Liste; „am besten wäre es ja
 * eigentlich wenn die software solche übungen selbst erstellt und der schüler direkt damit arbeiten kann“).
 *
 * Bisher machte „Übungen zu allen Fehlern senden“ (lib/text-uebung.ts) allgemeine Aufgaben je Fehlerbereich aus den Generatoren und
 * höchstens 4 Sätze aus dem Text. Hier baut die KI in EINER Anfrage (lib/ai/uebungsheft.ts) das ganze Heft aus dem Text des Schülers:
 *
 * - Quelle: der korrigierte Text von heute (Text, markierte Fehler, Zusammenfassung der Korrektur) oder die Fehlermuster mit den
 *   Stellen aus einer eingelesenen Schularbeit (Erkenntnisse, lib/erkenntnisse.ts). Der Name des Schülers ist ersetzt.
 * - Die App macht daraus eine gewöhnliche Übung: je Satz eine Aufgabe in einer Art, die sie selbst prüft (Satz richtig schreiben mit
 *   allen Satzzeichen, Lückentext, Auswahl, Fehler korrigieren) oder die Lehrkraft bewertet (Schreibaufgabe). Jede Aufgabe geht durch
 *   dieselbe Prüfung wie im Builder (`checkTask`); was nicht stimmt, fällt weg, nie das Heft.
 * - Teile, Merke-Kästen, „aus deinem Text“, Übungsanweisungen und die Kontroll-Liste stehen in `worksheets.settings.uebungsheft`; jede
 *   Aufgabe weiß über `data.heft` ihren Teil und ihre Übung. So zeigen Tablet, Vorschau und Ausdruck die Überschriften.
 * - Es läuft im Hintergrund (eine Anfrage dauert etwa eine Minute): die Karte „Üben“ zeigt „wird erstellt“, dann das fertige Heft.
 */
import { aiEnabled } from "./ai";
import { entwerfeUebungsheft, HEFT_ARTEN, type HeftArt, type HeftQuelle, type UebungsheftKi } from "./ai/uebungsheft";
import { budgetUsedUp, breakerState, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { checkTask } from "./builder";
import { db } from "./db";
import { belegeVon, listErkenntnisse } from "./erkenntnisse";
import { expectedFixes } from "./fix-text";
import { matchSkills, skillsForPrompt } from "./lehrplan";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { latestCorrection, listItems, snapshotDoc } from "./text-correction";
import { maskText, namePattern } from "./text-correction-core";
import { categoryLabel } from "./text-correction-rules";
import { plainText } from "./text-doc";
import { GAP, type TaskDraft } from "./tasks";
import { getText } from "./texts";
import { getUnit } from "./units";
import { skillAusStelle } from "./einheit-ablauf";

export { heftInfo, type HeftInfo } from "./uebungsheft-ansicht";
import type { HeftInfo } from "./uebungsheft-ansicht";

/** Höchstens so viele Aufgaben übernimmt die App aus einer Antwort. */
export const MAX_AUFGABEN = 70;

const zeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Mehrzeilig erlaubt (Fehlerdetektiv-Absatz, Schreibaufgabe), Leerraum je Zeile zusammengezogen. */
const absatz = (s: unknown, max: number) =>
  String(s ?? "")
    .split("\n")
    .map((z) => z.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
/** Ein Lückenzeichen der KI („___“, „____“, „…“ mit Unterstrichen) wird genau „___“. */
const luecken = (s: string) => s.replace(/_{2,}/g, GAP);
const anzahlLuecken = (s: string) => s.split(GAP).length - 1;

// ---------- Antwort → Aufgaben ----------

type Ziel = { erlaubt: Set<string>; fach: string; student: Pick<repo.Student, "school_type" | "klasse" | "grade">; ersatz: string | null };

/** Die Fähigkeit einer Übung: aus der Liste, sonst nach Titel und Teil, sonst die häufigste der Fehler. */
function faehigkeitVon(id: string | null, suche: string, z: Ziel): string | null {
  if (id && z.erlaubt.has(id)) return id;
  const treffer = matchSkills(suche, z.fach, { student: z.student, limit: 3 }).find((m) => z.erlaubt.has(m.skill.id));
  return treffer?.skill.id ?? z.ersatz;
}

/**
 * Eine Aufgabe der KI als Aufgabe der App, oder null (mit Grund), wenn sie nicht eindeutig ist: Satz ohne Lösung, Lücken, die nicht
 * zu den Lösungen passen, eine Auswahl ohne die richtige Wahl, ein „Fehler“-Satz ohne Fehler.
 */
export function aufgabeAus(
  art: HeftArt,
  o: { auftrag: string; vorgabe: string; loesung: string[]; optionen: string[] | null; satzzeichen: boolean; skillId: string; teil: number; uebung: number; deutsch: boolean },
): TaskDraft | null {
  const auftrag = zeile(o.auftrag, 300);
  const vorgabe = art === "fehler" || art === "schreiben" ? absatz(o.vorgabe, 1500) : zeile(o.vorgabe, 400);
  const loesungen = [...new Set(o.loesung.map((l) => (art === "fehler" || art === "schreiben" ? absatz(l, 2000) : zeile(l, 400))).filter(Boolean))].slice(0, 6);
  if (!vorgabe || !loesungen.length) return null;
  const basis = {
    skillId: o.skillId,
    skillIds: [o.skillId],
    difficulty: "mittel" as const,
    hints: [] as string[],
    errorMap: [],
  };
  const heft = { teil: o.teil, uebung: o.uebung };
  const prompt = auftrag ? `${auftrag}\n${vorgabe}` : vorgabe;
  let d: TaskDraft;
  if (art === "satz") {
    // derselbe Satz ohne jede Änderung ist keine Aufgabe
    if (loesungen.every((l) => l === vorgabe)) return null;
    d = { ...basis, type: "grammar", category: "satz", prompt, data: { heft }, answer: { accepted: loesungen, mode: o.deutsch ? "exact" : "text", ...(o.satzzeichen ? { satzzeichen: true } : {}) }, solution: loesungen[0] };
  } else if (art === "luecke") {
    const text = luecken(vorgabe);
    const n = anzahlLuecken(text);
    if (!n || n !== loesungen.length) return null;
    const blanks = loesungen.map((l) => [...new Set(l.split("|").map((x) => x.trim()).filter(Boolean))]);
    if (blanks.some((b) => !b.length)) return null;
    // eine Lücke direkt an einem Wort („d___ Wald“): eine Endung, ein Bindestrich davor zählt nicht
    const endungen = /\p{L}___/u.test(text) && blanks.every((b) => b.every((x) => x.replace(/^-/, "").length <= 4));
    d = { ...basis, type: "cloze", category: "lueckentext", prompt: auftrag ? `${auftrag}\n${text}` : text, data: { heft }, answer: { blanks, mode: o.deutsch ? "exact" : "text", ...(endungen ? { endings: true } : {}) }, solution: blanks.map((b) => b[0]).join(", ") };
  } else if (art === "auswahl") {
    const options = [...new Set((o.optionen ?? []).map((x) => zeile(x, 120)).filter(Boolean))].slice(0, 4);
    const correct = options.indexOf(loesungen[0]);
    if (options.length < 2 || correct < 0) return null;
    d = { ...basis, type: "mc", category: o.deutsch ? "grammatik" : "mc", prompt, data: { heft, options }, answer: { correct }, solution: options[correct] };
  } else if (art === "fehler") {
    const right = loesungen.filter((l) => expectedFixes(vorgabe, l, true).length > 0);
    if (!right.length) return null;
    const fixes = expectedFixes(vorgabe, right[0], true);
    if (fixes.length > 15) return null;
    d = {
      ...basis,
      type: "fix",
      category: "korrigieren",
      prompt: auftrag || "Finde die Fehler und schreib den Text richtig.",
      data: { heft, faulty: vorgabe },
      answer: { accepted: right, mode: "exact", fixes: fixes.map((f) => ({ ...f, label: "", errorType: null })), criteria: [fixes.length === 1 ? "Der Fehler ist verbessert." : `Alle ${fixes.length} Fehler sind verbessert.`, "Richtiges wurde nicht verändert."] },
      solution: right[0],
    };
  } else {
    const lang = loesungen[0].length > 220 || /geschichte|absatz|text/i.test(auftrag);
    d = { ...basis, type: "free", category: o.deutsch ? "schreiben" : "free", prompt, data: { heft, lines: lang ? 10 : 4 }, answer: { sample: loesungen[0], criteria: [] }, solution: loesungen[0] };
  }
  return checkTask(d) ? null : d;
}

/** Die Antwort der KI als Aufgaben und Heft-Info; leere Teile und Übungen fallen weg, die Nummern bleiben dicht. */
export function heftAusKi(ki: UebungsheftKi, z: Ziel & { quelle: HeftInfo["quelle"] }): { aufgaben: TaskDraft[]; info: HeftInfo; verworfen: number } {
  const deutsch = !/englisch|english/i.test(z.fach);
  const aufgaben: TaskDraft[] = [];
  const teile: HeftInfo["teile"] = [];
  let verworfen = 0;
  for (const t of ki.teile.slice(0, 8)) {
    const teil = { titel: zeile(t.titel, 80), merke: t.merke.map((m) => zeile(m, 240)).filter(Boolean).slice(0, 8), beispiele: t.aus_deinem_text.map((b) => ({ falsch: zeile(b.falsch, 240), richtig: zeile(b.richtig, 240) })).filter((b) => b.falsch && b.richtig).slice(0, 4), uebungen: [] as HeftInfo["teile"][number]["uebungen"] };
    const ti = teile.length;
    for (const u of t.uebungen.slice(0, 4)) {
      if (!HEFT_ARTEN.includes(u.art)) continue;
      const skillId = faehigkeitVon(u.faehigkeit, `${u.titel} ${teil.titel}`, z);
      const ui = teil.uebungen.length;
      let drin = 0;
      for (const a of u.aufgaben.slice(0, 14)) {
        if (aufgaben.length >= MAX_AUFGABEN) break;
        const d = skillId ? aufgabeAus(u.art, { auftrag: u.auftrag, vorgabe: a.vorgabe, loesung: a.loesung, optionen: a.optionen, satzzeichen: u.satzzeichen_zaehlen, skillId, teil: ti, uebung: ui, deutsch }) : null;
        if (!d) {
          verworfen++;
          continue;
        }
        aufgaben.push(d);
        drin++;
      }
      if (drin) teil.uebungen.push({ titel: zeile(u.titel, 120), auftrag: zeile(u.auftrag, 300), beispiel: u.beispiel ? zeile(u.beispiel, 300) : null });
    }
    if (teil.uebungen.length) teile.push(teil);
  }
  return {
    aufgaben,
    info: { vorweg: zeile(ki.vorweg, 600), teile, kontrolle: ki.kontrollliste.map((k) => zeile(k, 200)).filter(Boolean).slice(0, 10), pruefen: ki.pruefen.map((p) => zeile(p, 200)).filter(Boolean).slice(0, 6), quelle: z.quelle },
    verworfen,
  };
}

// ---------- Quelle ----------

/** Die Quelle eines Hefts; `bereiche`: die Fähigkeiten der Fehler, die mit dem Heft als geübt gelten (Text von heute, lib/einheit-ablauf.ts). */
type Quelle = { quelle: HeftQuelle; student: repo.Student; ersatz: string | null; bereiche: string[] };

const stufeVon = (s: repo.Student) => [klassenLabel(s.school_type, s.klasse), s.grade ? `Schulstufe ${s.grade}` : ""].filter(Boolean).join(", ");

/** Der korrigierte Text als Quelle: der Text (Name ersetzt), die markierten Fehler (nicht abgelehnt), was gut war. Null ohne Korrektur. */
export function quelleAusText(textId: number): Quelle | { fehler: string } {
  const t = getText(textId);
  const student = t ? repo.getStudent(t.student_id) : null;
  if (!t || !student) return { fehler: "Diesen Text gibt es nicht." };
  const c = latestCorrection(t.id);
  if (!c) return { fehler: "Der Text ist noch nicht korrigiert." };
  const muster = namePattern([student.name]);
  const ohneName = (s: string) => maskText(s, muster).masked;
  const items = listItems(c.id).filter((i) => i.kind === "fehler" && i.status !== "abgelehnt" && i.quote.trim());
  if (!items.length) return { fehler: "In der Korrektur ist kein Fehler markiert." };
  const fach = t.subject || "Deutsch";
  const skills = skillsForPrompt(student, fach).map((s) => ({ id: s.id, name: s.name, area: s.area }));
  // die häufigste Fähigkeit der Fehler trägt Übungen, zu denen die KI keine nennt
  const zahl = new Map<string, number>();
  for (const i of items) if (i.skill_id && repo.getSkill(i.skill_id)) zahl.set(i.skill_id, (zahl.get(i.skill_id) ?? 0) + 1);
  const ersatz = [...zahl].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (c.recommendation_skill && repo.getSkill(c.recommendation_skill) ? c.recommendation_skill : null);
  const deutsch = fach === "Deutsch";
  const bereiche = [...new Set(items.map((i) => (i.skill_id && repo.getSkill(i.skill_id) ? i.skill_id : deutsch ? skillAusStelle(i) : null)).filter((x): x is string => Boolean(x)))];
  return {
    student,
    ersatz,
    bereiche,
    quelle: {
      fach,
      stufe: stufeVon(student),
      thema: zeile(ohneName([t.topic, t.title].filter(Boolean).join(" – ")), 160),
      text: ohneName(plainText(snapshotDoc(c))),
      fehler: items.map((i) => ({ falsch: ohneName(i.quote), richtig: ohneName(i.replacement), bereich: categoryLabel(i.category), regel: zeile(ohneName(i.rule || i.explanation), 160) })),
      muster: [],
      lob: [c.summary].map((s) => zeile(ohneName(s ?? ""), 400)).filter(Boolean),
      skills,
    },
  };
}

/** Offene Fehlermuster mit Stellen (eingelesene Schularbeit) als Quelle. */
export function quelleAusMustern(studentId: number, fach: string, erkenntnisIds: number[]): Quelle | { fehler: string } {
  const student = repo.getStudent(studentId);
  if (!student) return { fehler: "Diesen Schüler gibt es nicht." };
  const alle = listErkenntnisse(studentId, { status: "offen", art: "fehler" }).filter((e) => e.subject === fach && erkenntnisIds.includes(e.id));
  if (!alle.length) return { fehler: "Bitte mindestens einen Fehler ankreuzen." };
  const muster = namePattern([student.name]);
  const ohneName = (s: string) => maskText(s, muster).masked;
  const staerken = listErkenntnisse(studentId, { art: "staerke", subject: fach }).slice(0, 3).map((s) => ohneName(s.text));
  return {
    student,
    ersatz: alle.find((e) => e.skill_id && repo.getSkill(e.skill_id))?.skill_id ?? null,
    bereiche: [...new Set(alle.map((e) => e.skill_id).filter((x): x is string => Boolean(x && repo.getSkill(x))))],
    quelle: {
      fach,
      stufe: stufeVon(student),
      thema: "",
      text: "",
      fehler: [],
      muster: alle.map((e) => ({ text: ohneName(e.text), belege: belegeVon(e).map((b) => ({ falsch: ohneName(b.falsch), richtig: ohneName(b.richtig) })) })),
      lob: staerken,
      skills: skillsForPrompt(student, fach).map((s) => ({ id: s.id, name: s.name, area: s.area })),
    },
  };
}

// ---------- Erstellen (im Hintergrund) ----------

export type HeftLauf = { id: number; studentId: number; unitId: number | null; textId: number | null; status: "laeuft" | "fertig" | "fehler"; worksheetId: number | null; fehler: string; createdAt: string };
type LaufRow = { id: number; student_id: number; unit_id: number | null; text_id: number | null; status: HeftLauf["status"]; worksheet_id: number | null; fehler: string; created_at: string };
const alsLauf = (r: LaufRow): HeftLauf => ({ id: r.id, studentId: r.student_id, unitId: r.unit_id, textId: r.text_id, status: r.status, worksheetId: r.worksheet_id, fehler: r.fehler, createdAt: r.created_at });

/** Ein Lauf, der länger hängt, gilt als abgebrochen (Neustart des Servers mitten im Lauf). */
const HAENGT_MIN = 8;

/** Ob die KI jetzt ein Heft machen kann; sonst der Grund in einem Satz. */
export function heftMoeglich(studentId: number): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("uebungsheft")) return { ok: false, grund: "Das Übungsheft macht die KI, und die ist gerade nicht eingerichtet." };
  if (budgetUsedUp("uebungsheft")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (schuelerGestoppt("uebungsheft", studentId)) return { ok: false, grund: grenzeErreichtText() };
  if (breakerState().paused) return { ok: false, grund: "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten." };
  return { ok: true };
}

/** Der letzte Lauf zu diesem Text (für die Karte „Üben“ und die Korrektur-Seite). */
export function heftLaufZumText(textId: number): HeftLauf | null {
  const r = db().prepare("SELECT * FROM uebungshefte WHERE text_id = ? ORDER BY id DESC LIMIT 1").get(textId) as LaufRow | undefined;
  if (!r) return null;
  // abgebrochen (Server neu gestartet): als Fehler zeigen, damit „Noch einmal“ geht
  if (r.status === "laeuft" && !laufend.has(r.id) && Date.parse(`${r.created_at.replace(" ", "T")}Z`) < Date.now() - HAENGT_MIN * 60_000) return { ...alsLauf(r), status: "fehler", fehler: "Das Erstellen wurde unterbrochen. Bitte noch einmal." };
  // ein gelöschtes Heft gibt es nicht mehr
  if (r.status === "fertig" && (!r.worksheet_id || !repo.getWorksheet(r.worksheet_id))) return null;
  return alsLauf(r);
}

export function getHeftLauf(id: number): HeftLauf | null {
  const r = db().prepare("SELECT * FROM uebungshefte WHERE id = ?").get(id) as LaufRow | undefined;
  return r ? alsLauf(r) : null;
}

const laufend = ((globalThis as unknown as { __uebungsheftLaufend?: Map<number, Promise<unknown>> }).__uebungsheftLaufend ??= new Map());
/** Für die Tests: warten, bis ein Lauf fertig ist. */
export const warteAufHeft = (id: number) => laufend.get(id) ?? Promise.resolve();

/**
 * Startet das Heft zum korrigierten Text (`textId`) oder zu Fehlermustern (`muster`), im Hintergrund. Ein zweiter Tipp, während einer
 * läuft, startet keinen zweiten (zahlt nicht doppelt).
 */
export function starteUebungsheft(e: { teacherId: number | null; unitId?: number | null } & ({ textId: number } | { studentId: number; fach: string; erkenntnisIds: number[] })): { id: number } | { fehler: string } {
  const q = "textId" in e ? quelleAusText(e.textId) : quelleAusMustern(e.studentId, e.fach, e.erkenntnisIds);
  if ("fehler" in q) return q;
  const geht = heftMoeglich(q.student.id);
  if (!geht.ok) return { fehler: geht.grund };
  const textId = "textId" in e ? e.textId : null;
  const laeuft = db().prepare("SELECT id FROM uebungshefte WHERE student_id = ? AND status = 'laeuft' AND created_at >= datetime('now', ?)").get(q.student.id, `-${HAENGT_MIN} minutes`) as { id: number } | undefined;
  if (laeuft) return { id: laeuft.id };
  const unit = e.unitId ? getUnit(e.unitId) : null;
  const id = Number(
    db()
      .prepare("INSERT INTO uebungshefte (student_id, teacher_id, unit_id, text_id, status) VALUES (?, ?, ?, ?, 'laeuft')")
      .run(q.student.id, e.teacherId, unit && unit.student_id === q.student.id ? unit.id : null, textId).lastInsertRowid,
  );
  const quelle: HeftInfo["quelle"] = "textId" in e ? { art: "text", textId: e.textId } : { art: "muster", erkenntnisIds: e.erkenntnisIds };
  const job = fuehreAus(id, q, quelle, e.teacherId).catch((err) => {
    console.error("[Übungsheft]", err instanceof Error ? err.message : err);
    setzeFehler(id, err instanceof Error && err.message.length < 200 ? err.message : "Das Erstellen ging nicht. Bitte noch einmal versuchen.");
  });
  laufend.set(id, job);
  void job.finally(() => laufend.delete(id));
  return { id };
}

function setzeFehler(id: number, fehler: string) {
  db().prepare("UPDATE uebungshefte SET status = 'fehler', fehler = ?, updated_at = datetime('now') WHERE id = ?").run(fehler.slice(0, 300), id);
}

async function fuehreAus(id: number, q: Quelle, quelle: HeftInfo["quelle"], teacherId: number | null) {
  const run = getHeftLauf(id);
  const ki = await entwerfeUebungsheft(q.quelle, { teacherId, studentId: q.student.id, unitId: run?.unitId ?? null, trigger: "uebungsheft" });
  if (!ki) return setzeFehler(id, "Die KI hat kein Heft geliefert. Bitte noch einmal versuchen.");
  const s = q.student;
  const out = heftAusKi(ki, { erlaubt: new Set(q.quelle.skills.map((x) => x.id)), fach: q.quelle.fach, student: s, ersatz: q.ersatz, quelle });
  if (out.aufgaben.length < 3) return setzeFehler(id, "Die KI hat zu wenige brauchbare Aufgaben geliefert. Bitte noch einmal versuchen.");
  const skillIds = [...new Set(out.aufgaben.map((a) => a.skillId).filter((x): x is string => Boolean(x)))];
  const titel = zeile(ki.titel, 90) || "Übungen zu deinen Fehlern";
  const worksheetId = repo.createWorksheet(
    {
      title: `${s.name.split(" ")[0]} – ${titel}`.slice(0, 120),
      subject: q.quelle.fach,
      grade: schulstufe(s.school_type, s.klasse ?? 1),
      school_type: s.school_type,
      klasse: s.klasse ?? 1,
      topic: out.info.teile.map((t) => t.titel).join(", ").slice(0, 200),
      difficulty: "mittel",
      task_type: "mixed",
      kind: "uebung",
      source: "ki",
      skill_ids: skillIds,
      student_id: s.id,
      teacher_id: teacherId,
      status: "entwurf",
      // am Tablet als ganzes Blatt, wie auf Papier (lib/blatt.ts)
      settings: JSON.stringify({ uebungsheft: out.info, blatt: true }),
    },
    out.aufgaben,
  );
  // die Fehlerbereiche des Texts gelten mit dem Heft als geübt (die Aufgaben tragen oft eine genauere Fähigkeit)
  const alle = [...new Set([...repo.listTasks(worksheetId).flatMap((t) => t.skillIds ?? (t.skillId ? [t.skillId] : [])), ...q.bereiche])];
  db().prepare("UPDATE worksheets SET skill_ids = ? WHERE id = ?").run(JSON.stringify(alle), worksheetId);
  db().prepare("UPDATE uebungshefte SET status = 'fertig', worksheet_id = ?, verworfen = ?, updated_at = datetime('now') WHERE id = ?").run(worksheetId, out.verworfen, id);
}

