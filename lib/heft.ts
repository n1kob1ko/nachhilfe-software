/**
 * **Heft am Tablet** (niko, 26.11.2026: Mathe mit Stift; am Whiteboard „ist es nicht so frei, man ist so restriktiv“ und die KI
 * prüft „immer nur pro Aufgabe, also muss ich immer öfters drücken“). Eine Übung kommt am Schüler-Tablet als karierte Seite: die
 * Aufgaben untereinander, unter jeder Platz zum Rechnen, der Stift schreibt frei, der Finger blättert. Beim „Fertig“ gehen die
 * Seiten als Bilder an denselben Weg wie „Arbeit fotografieren“ (lib/papier-einheit.ts): die KI liest alle Aufgaben in einem
 * Lauf gegen die Original-Aufgaben, die App prüft nach, wo sie kann.
 *
 * - Anders als beim Foto übernimmt die App das Ergebnis selbst, damit der Lehrer nicht tippen muss: was sicher gelesen und
 *   nicht widersprochen ist, zählt gleich; was unsicher ist, wird eine offene Antwort, die auf den Lehrer wartet („Zu bewerten“,
 *   zählt nirgends), wie beim Übernehmen einer Papierarbeit.
 * - Gespeichert werden die Striche je Aufgabe (laufend, damit nichts verloren geht) und beim Abgeben die Seiten als Material
 *   des Schülers. Kein Name kommt auf die Seiten: oben steht nur der Titel der Übung ohne Vornamen und je Aufgabe die Nummer.
 * - Ohne KI (aus, Budget, Grenze je Schüler) wird keine Übung als Heft gesendet (`heftMoeglich`).
 */
import { BLATT_TITEL } from "./blatt-einlesen";
import { frageText } from "./cockpit";
import { db, json } from "./db";
import { notifyUnitTablets, pushLive } from "./live";
import { saveUpload } from "./materials";
import { activeLaptop } from "./laptop";
import { liesPapier, papierTor, speicherePapier } from "./papier-einheit";
import * as repo from "./repo";
import { getUnit } from "./units";
import { abschnitte, auftragVon, heftInfo, ohneAuftrag, type Abschnitt } from "./uebungsheft-ansicht";

/** Breite einer Heftseite in Heft-Einheiten; Höhen und Striche zählen in derselben Einheit. */
export const HEFT_BREITE = 1000;
/** So hoch ist der Platz unter einer Aufgabe zuerst, so viel bringt „Mehr Platz“, so hoch höchstens. */
export const HEFT_HOEHE = 520;
export const HEFT_MEHR = 360;
export const HEFT_MAX_HOEHE = 2600;
/** So klein darf ein Feld sein (ein Wort im Übungsheft, liniert). */
export const HEFT_MIN_HOEHE = 160;
/** Zahlen (x und y) höchstens je Strich und je Heft: ein voll geschriebenes Heft bleibt weit darunter. */
const MAX_JE_STRICH = 6000;
const MAX_ZAHLEN = 400_000;
/** Seiten höchstens, und Bytes höchstens je Seite (PNG). */
export const HEFT_MAX_SEITEN = 8;
const MAX_SEITE_BYTES = 4 * 1024 * 1024;

/** Ein Strich: x und y abwechselnd, in Heft-Einheiten. */
export type Strich = number[];
export type HeftFeld = { taskId: number; hoehe: number; striche: Strich[] };
export type HeftStatus = "schreibt" | "pruefen" | "geprueft" | "fehler";
export type HeftUrteil = "richtig" | "teilweise" | "falsch" | "offen";
/** `abschnitt`: beim Übungsheft zu den Fehlern (lib/uebungsheft.ts) der Teil (Merke) und die Übung vor ihrer ersten Aufgabe. */
export type HeftAufgabe = { taskId: number; nr: string; text: string; urteil: HeftUrteil | null; abschnitt?: Abschnitt | null };
export type Heft = {
  assignmentId: number;
  unitId: number | null;
  studentId: number;
  titel: string;
  status: HeftStatus;
  grund: string;
  version: number;
  felder: HeftFeld[];
  aufgaben: HeftAufgabe[];
  materialIds: number[];
  /** liniert (Deutsch, Englisch …) statt kariert (Mathe) */
  linien: boolean;
  /** Übungsheft zu den Fehlern: was oben steht, und die Kontroll-Liste unten */
  vorweg: string;
  kontrolle: string[];
};

type Row = { assignment_id: number; unit_id: number | null; student_id: number; felder: string; version: number; status: HeftStatus; grund: string; material_ids: string };

/** Ob gerade eine Übung als Heft gehen kann: nur mit KI, die Bilder liest (sonst prüft niemand die Seiten). */
export function heftMoeglich(studentId: number): boolean {
  return papierTor(studentId).erlaubt;
}

/**
 * Mathe am Tablet geht als Heft (beim Senden aus dem geführten Ablauf): nur mit KI, die Bilder liest, und nicht, wenn der Schüler
 * am eigenen Laptop arbeitet (dort gibt es keinen Stift). „Lieber tippen“ sendet dieselbe Übung mit Antwortfeldern.
 */
export const gehtAlsHeft = (unit: { id: number; student_id: number; subject: string | null }) => unit.subject === "Mathematik" && stiftGeht(unit);

/**
 * Ob der Schüler gerade mit dem Stift am Tablet schreiben kann (KI liest Bilder, kein eigener Laptop). Das Übungsheft zu den Fehlern
 * (lib/uebungsheft.ts) geht in jedem Fach so, mit Linien statt Kästchen; „Lieber tippen“ sendet es mit Antwortfeldern.
 */
export const stiftGeht = (unit: { id: number; student_id: number }) => !activeLaptop(unit.id) && heftMoeglich(unit.student_id);

/**
 * Die Angabe im Übungsheft: ohne die Anweisung (sie steht über der Übung) und der Satz mit Fehlern ohne „ “ darum, denn er hat oft
 * selbst eine direkte Rede („„Wo bist du?“ fragte Ben.“ wäre verwirrend).
 */
function heftText(t: repo.Task, auftrag: string | undefined): string {
  const angabe = ohneAuftrag(t.prompt, auftrag);
  const faulty = t.data.faulty?.trim();
  return frageText({ ...t, prompt: faulty ? [angabe, faulty].filter(Boolean).join("\n") : angabe, data: { ...t.data, faulty: undefined } });
}

/** Wie viel Platz eine Aufgabe zuerst bekommt: Mathe immer gleich viel zum Rechnen; sonst nach der Art (Wort, Satz, Absatz, Text). */
function startHoehe(type: string, linien: boolean): number {
  if (!linien) return HEFT_HOEHE;
  if (type === "cloze" || type === "mc") return 200;
  if (type === "fix") return 380;
  if (type === "free") return 720;
  return 270;
}

/** Eine gesendete Übung wird ein Heft (vor dem ersten Anzeigen am Tablet). */
export function alsHeft(assignmentId: number) {
  const a = repo.getAssignment(assignmentId);
  if (!a) return;
  db().prepare("INSERT OR IGNORE INTO hefte (assignment_id, unit_id, student_id) VALUES (?, ?, ?)").run(a.id, a.unit_id, a.student_id);
}

export const istHeft = (assignmentId: number) => Boolean(db().prepare("SELECT 1 FROM hefte WHERE assignment_id = ?").get(assignmentId));

/** Der Titel ohne den Vornamen davor („Mia – Brüche“ → „Brüche“): auf der Seite steht kein Name. */
function ohneVorname(titel: string, studentId: number) {
  const vorname = repo.getStudent(studentId)?.name.split(" ")[0] ?? "";
  return vorname && titel.startsWith(`${vorname} – `) ? titel.slice(vorname.length + 3) : titel;
}

/** Wie eine Aufgabe ausgegangen ist (die letzte endgültige Antwort): eine offene Antwort wartet auf den Lehrer. */
function urteilVon(versuche: repo.Attempt[], taskId: number): HeftUrteil | null {
  const f = [...versuche].reverse().find((v) => v.task_id === taskId && v.final);
  if (!f) return null;
  if (f.review === "offen") return "offen";
  if (f.review === "teilweise") return "teilweise";
  return f.correct ? "richtig" : "falsch";
}

export function getHeft(assignmentId: number): Heft | null {
  const r = db().prepare("SELECT * FROM hefte WHERE assignment_id = ?").get(assignmentId) as Row | undefined;
  const a = r ? repo.getAssignment(assignmentId) : null;
  const w = a ? repo.getWorksheet(a.worksheet_id) : null;
  if (!r || !a || !w) return null;
  const versuche = repo.listAttemptsForAssignment(a.id);
  const tasks = repo.listTasks(w.id);
  const info = heftInfo(w.settings);
  const kopf = abschnitte(info, tasks.map((t) => t.data.heft));
  const linien = w.subject !== "Mathematik";
  const aufgaben: HeftAufgabe[] = tasks.map((t, i) => ({
    taskId: t.id,
    nr: t.data.nummer?.trim() || String(i + 1),
    // im Übungsheft steht die Anweisung einmal über der Übung, nicht über jeder Aufgabe
    text: info ? heftText(t, auftragVon(info, t.data.heft)) : frageText(t),
    urteil: urteilVon(versuche, t.id),
    ...(info ? { abschnitt: kopf[i] } : {}),
  }));
  const felder = json<HeftFeld[]>(r.felder, []);
  return {
    assignmentId: a.id,
    unitId: r.unit_id,
    studentId: r.student_id,
    titel: ohneVorname(w.title, a.student_id),
    status: r.status,
    grund: r.grund,
    version: r.version,
    // je Aufgabe ein Feld, in der Reihenfolge des Blatts
    felder: aufgaben.map((x, i) => felder.find((f) => f.taskId === x.taskId) ?? { taskId: x.taskId, hoehe: startHoehe(tasks[i].type, linien), striche: [] }),
    aufgaben,
    materialIds: json<number[]>(r.material_ids, []),
    linien,
    vorweg: info?.vorweg ?? "",
    kontrolle: info?.kontrolle ?? [],
  };
}

const runde = (n: number) => Math.round(n * 10) / 10;

/** Was der Browser schickt, auf die Aufgaben dieses Hefts gebracht: unbekannte Aufgaben fallen weg, Zahlen bleiben auf der Seite. */
export function bereinige(roh: unknown, taskIds: number[]): HeftFeld[] | null {
  if (!Array.isArray(roh)) return null;
  let zahlen = 0;
  const out: HeftFeld[] = [];
  for (const id of taskIds) {
    const f = roh.find((x) => x && typeof x === "object" && (x as HeftFeld).taskId === id) as Partial<HeftFeld> | undefined;
    const hoehe = Math.min(HEFT_MAX_HOEHE, Math.max(HEFT_MIN_HOEHE, Math.round(Number(f?.hoehe) || HEFT_HOEHE)));
    const striche: Strich[] = [];
    for (const s of Array.isArray(f?.striche) ? f.striche : []) {
      if (!Array.isArray(s) || s.length < 2) continue;
      const p: number[] = [];
      for (let i = 0; i + 1 < Math.min(s.length, MAX_JE_STRICH); i += 2) {
        const x = Number(s[i]);
        const y = Number(s[i + 1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        p.push(runde(Math.min(HEFT_BREITE, Math.max(0, x))), runde(Math.min(hoehe, Math.max(0, y))));
      }
      zahlen += p.length;
      if (zahlen > MAX_ZAHLEN) return null;
      if (p.length) striche.push(p);
    }
    out.push({ taskId: id, hoehe, striche });
  }
  return out;
}

/** Das Heft gehört zu einer laufenden Einheit des Lehrers, dem das Tablet gehört. */
export function heftAmGeraet(assignmentId: number, deviceTeacherId: number): Heft | null {
  const h = getHeft(assignmentId);
  const unit = h?.unitId ? getUnit(h.unitId) : null;
  if (!h || !unit || unit.teacher_id !== deviceTeacherId || unit.status !== "gestartet" || unit.student_id !== h.studentId) return null;
  return h;
}

/** Laufend speichern, solange der Schüler schreibt. */
export function speichereHeft(h: Heft, roh: unknown): { version: number } | { fehler: string } {
  if (h.status !== "schreibt") return { fehler: "Das Heft ist schon abgegeben." };
  const felder = bereinige(roh, h.aufgaben.map((a) => a.taskId));
  if (!felder) return { fehler: "Das Heft ist zu voll." };
  db().prepare("UPDATE hefte SET felder = ?, version = version + 1, updated_at = datetime('now') WHERE assignment_id = ? AND status = 'schreibt'").run(JSON.stringify(felder), h.assignmentId);
  return { version: h.version + 1 };
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * „Fertig“: die Striche und die Seiten (PNG) speichern, dann prüfen (im Hintergrund; die Einheit zeigt „wird geprüft“). Die Seiten
 * werden Material des Schülers, wie fotografierte Seiten.
 */
export function gibAb(h: Heft, roh: unknown, seiten: Buffer[]): { ok: true } | { fehler: string } {
  if (h.status !== "schreibt") return { fehler: "Das Heft ist schon abgegeben." };
  const felder = bereinige(roh, h.aufgaben.map((a) => a.taskId));
  if (!felder) return { fehler: "Das Heft ist zu voll." };
  if (!seiten.length || seiten.length > HEFT_MAX_SEITEN || seiten.some((s) => s.length > MAX_SEITE_BYTES || !s.subarray(0, 4).equals(PNG))) return { fehler: "Die Seiten sind nicht angekommen. Bitte noch einmal „Fertig“." };
  const unit = h.unitId ? getUnit(h.unitId) : null;
  if (!unit) return { fehler: "Die Einheit läuft nicht mehr." };
  const ids = [...new Set(seiten.map((data, i) => saveUpload({ name: `heft-${h.assignmentId}-${i + 1}.png`, data }, { title: BLATT_TITEL, subject: unit.subject ?? "", studentId: h.studentId, teacherId: unit.teacher_id }).id))];
  const r = db()
    .prepare("UPDATE hefte SET felder = ?, version = version + 1, status = 'pruefen', grund = '', material_ids = ?, abgegeben_at = datetime('now'), updated_at = datetime('now') WHERE assignment_id = ? AND status = 'schreibt'")
    .run(JSON.stringify(felder), JSON.stringify(ids), h.assignmentId);
  if (!r.changes) return { fehler: "Das Heft ist schon abgegeben." };
  repo.markAssignmentStarted(h.assignmentId);
  pushLive(unit.id);
  laufend.set(h.assignmentId, pruefeHeft(h.assignmentId).finally(() => laufend.delete(h.assignmentId)));
  return { ok: true };
}

const laufend = new Map<number, Promise<void>>();

/** Für Tests: warten, bis die Prüfung eines Hefts fertig ist. */
export const warteAufHeft = (assignmentId: number) => laufend.get(assignmentId) ?? Promise.resolve();

/**
 * Die Seiten lesen (eine Anfrage für alle Aufgaben) und das Ergebnis übernehmen: sicher gelesen zählt, unsicher wartet auf den
 * Lehrer. Geht das nicht (KI aus, Fehler), steht der Grund am Heft und der Lehrer kann es noch einmal prüfen lassen.
 */
export async function pruefeHeft(assignmentId: number): Promise<void> {
  const h = getHeft(assignmentId);
  const unit = h?.unitId ? getUnit(h.unitId) : null;
  if (!h || !unit || (h.status !== "pruefen" && h.status !== "fehler")) return;
  db().prepare("UPDATE hefte SET status = 'pruefen', grund = '', updated_at = datetime('now') WHERE assignment_id = ?").run(assignmentId);
  const fehler = (grund: string) => {
    db().prepare("UPDATE hefte SET status = 'fehler', grund = ?, updated_at = datetime('now') WHERE assignment_id = ?").run(grund.slice(0, 300), assignmentId);
    pushLive(unit.id);
    notifyUnitTablets(unit, "heft");
  };
  try {
    const blatt = `z${assignmentId}`;
    const v = await liesPapier({ unitId: unit.id, blattKey: blatt, materialIds: h.materialIds, teacherId: unit.teacher_id });
    // Ein Feld ohne Strich ist nicht bearbeitet, was immer die Lesung dazu sagt; ebenso eine Aufgabe, die die Lesung sicher als leer
    // sieht. Solche Aufgaben zählen weder als richtig noch als falsch (Test mit echter KI, 27.11.2026: die leere Aufgabe galt als Fehler).
    const ohneStrich = new Set(h.felder.filter((f) => !f.striche.length).map((f) => f.taskId));
    const zeilen = v.zeilen.map((z) => (z.taskId != null && (ohneStrich.has(z.taskId) || (z.bewertung === "leer" && !z.pruefen && !z.offen)) ? { ...z, antwort: "", bewertung: "leer" as const, pruefen: false, offen: false, grund: "", fehler: "" } : z));
    const out = speicherePapier({ unitId: unit.id, teacherId: unit.teacher_id, blatt, zeilen, materialIds: h.materialIds, gelesen: "ki", leerZaehltNicht: true });
    if ("error" in out) return fehler(out.error);
    db().prepare("UPDATE hefte SET status = 'geprueft', papier_id = ?, updated_at = datetime('now') WHERE assignment_id = ?").run(out.papierId, assignmentId);
    pushLive(unit.id);
    // das Tablet zeigt jetzt je Aufgabe, wie sie ausgegangen ist
    notifyUnitTablets(unit, "heft");
  } catch (e) {
    // ein Satz für den Lehrer, ohne die technische Antwort des Anbieters dahinter
    const satz = (e instanceof Error ? e.message : "").replace(/\s*\(.*$/s, "").trim();
    fehler(`${satz || "Das Heft konnte nicht geprüft werden"}${/[.!?]$/.test(satz) ? "" : "."} Tippe auf „Noch einmal prüfen“.`);
  }
}

/** Das Heft dieser Einheit, das gerade läuft oder zuletzt geprüft wurde (für die Karte „Üben“). */
export function heftDerEinheit(unitId: number): Heft | null {
  const r = db().prepare("SELECT assignment_id FROM hefte WHERE unit_id = ? ORDER BY assignment_id DESC LIMIT 1").get(unitId) as { assignment_id: number } | undefined;
  return r ? getHeft(r.assignment_id) : null;
}
