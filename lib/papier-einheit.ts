/**
 * **Arbeit fotografieren** im Unterricht (niko, Spezifikation Abschnitt 6: „Der Schüler darf am Tablet ODER auf Papier
 * arbeiten. Papierarbeit wird IN der laufenden Einheit fotografiert und wie digitale Arbeit bewertet.“). Kein zweites
 * Lesesystem: dieselben Seiten (Material des Schülers), dieselbe Route `/material/blatt`, dieselbe KI-Funktion `blatt`
 * und dieselbe Vorschau wie „Gelöstes Blatt einlesen“ (lib/blatt-einlesen.ts).
 *
 * - Welches Blatt: die Übungen dieser Einheit (gesendet, mit noch offenen Aufgaben), ihr gedruckter Minitest und Übungen, die
 *   während der Einheit für diesen Schüler erstellt und nicht gesendet wurden (`blaetterDerEinheit`). Nie das Blatt eines
 *   anderen Schülers. Ein Blatt, das die App nicht kennt („Ein anderes Blatt“), geht den Weg von „Gelöstes Blatt einlesen“.
 * - Gelesen wird gegen die ORIGINAL-Aufgaben: die Anfrage trägt Angabe, Lösung und Punkte je Aufgabe in ihrer Reihenfolge; die
 *   KI liest nur die Antwort je Nummer ab und schlägt richtig / teilweise / falsch / leer vor, „nicht lesbar“ ist nie falsch.
 *   Wo die App selbst prüfen kann (akzeptierte Antworten, Zahlen, Auswahl, Rechenweg), prüft sie die gelesene Antwort; sagt
 *   sie etwas anderes oder ist die Lesung unsicher, ist die Zeile gelb und ohne Vorwahl (`zusammenfuehren`).
 * - Nichts zählt vor „Übernehmen“, und solange eine Zeile gelb oder ohne Bewertung ist, geht „Übernehmen“ nicht: eine
 *   unsichere Lesung wird nie als Ergebnis gespeichert. Dann Antworten an DERSELBEN Zuweisung (unit_id der Einheit), wie am
 *   Gerät: Lernstand, Abschluss („Auf Papier: Übung „…“ 7 von 10, 2 unsicher geprüft“) und Dokumentation sehen sie.
 * - Ohne KI (aus, Budget, Grenze je Schüler, manueller Modus) dieselbe Vorschau zum Antippen. Die Kosten stehen vor dem Lesen
 *   neben dem Knopf; gelesen wird nur auf Tippen, nur mit „kein Name darauf“, und kein Name aus der App geht mit.
 */
import { leseBlattMitAufgaben, type BlattMitAufgabenGelesen } from "./ai";
import { budget, costOf, FUNCTIONS, isLocalModel, routeFor } from "./ai/config";
import { breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { documentAssignment } from "./autodoc";
import { BLATT_TITEL, blattLesbar, PAPIER_ANTWORT, seitenFuerKi, speichereBlatt } from "./blatt-einlesen";
import { istBewertung, MAX_SEITEN, papierErgebnis, unsichereZuerst, zusammenfuehren, type AppUrteil, type BlattVorschlag, type BlattZeile, type PapierAufgabe, type PapierErgebnis } from "./blatt-regeln";
import { frageText, loesungText } from "./cockpit";
import { levelOf } from "./curriculum";
import { db } from "./db";
import { dayOf } from "./exams";
import { getMaterial, hatDatei } from "./materials";
import { gradeMathTask } from "./math-task";
import { punkteDerAufgaben } from "./probeschularbeit";
import * as repo from "./repo";
import { checkAnswer, type TaskDraft } from "./tasks";
import { getUnit, touchUnit, type UnitView } from "./units";

/** Ein Blatt, das in dieser Einheit auf Papier gelöst worden sein kann. `key`: „z12“ (Zuweisung) oder „u34“ (Übung, nicht gesendet). */
export type PapierBlatt = {
  key: string;
  worksheetId: number;
  assignmentId: number | null;
  titel: string;
  /**
   * gesendet: an den Schüler gesendet; minitest: der gedruckte Minitest; erstellt: in der Einheit erstellt, nicht gesendet;
   * probe: eine Probeschularbeit dieses Schülers mit offenen Aufgaben (auch eine eigene, lib/probe-extern.ts), von wann auch immer
   */
  art: "gesendet" | "minitest" | "erstellt" | "probe";
  /** wann gesendet oder erstellt (wie gespeichert) */
  am: string;
  /** die Aufgaben ohne fertige Antwort, in der Reihenfolge des Blatts */
  aufgaben: PapierAufgabe[];
  /** so viele Aufgaben sind schon am Gerät fertig und fehlen deshalb */
  schonFertig: number;
};

/** Der Wert für „Ein anderes Blatt“ (nicht aus dieser Einheit): wie „Gelöstes Blatt einlesen“. */
export const ANDERES_BLATT = "anders";

const eineZeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Der Titel ohne den Vornamen davor („Mia – Brüche“ → „Brüche“), wie auf dem gedruckten Blatt. */
function blattTitel(w: repo.Worksheet, student: repo.Student) {
  const first = student.name.split(" ")[0];
  return w.title.startsWith(`${first} – `) ? w.title.slice(first.length + 3) : w.title;
}

/** Die Höchstpunkte je Aufgabe: eingetragen; bei einer Probeschularbeit sonst die üblichen; sonst keine. */
function punkteVon(w: repo.Worksheet, tasks: repo.Task[]): Map<number, number | null> {
  if (w.probe_test_id) return punkteDerAufgaben(w.id, tasks);
  const rows = db().prepare("SELECT id, points FROM tasks WHERE worksheet_id = ?").all(w.id) as { id: number; points: number | null }[];
  return new Map(rows.map((r) => [r.id, r.points]));
}

function blattAus(w: repo.Worksheet, student: repo.Student, art: PapierBlatt["art"], am: string, assignmentId: number | null): PapierBlatt | null {
  if (w.archived_at) return null;
  // never the sheet of another student
  if (w.student_id != null && w.student_id !== student.id) return null;
  const tasks = repo.listTasks(w.id);
  if (!tasks.length) return null;
  const fertig = new Set(assignmentId ? repo.listAttemptsForAssignment(assignmentId).filter((a) => a.final).map((a) => a.task_id) : []);
  const punkte = punkteVon(w, tasks);
  const aufgaben = tasks
    .map((t, i) => ({ t, nr: String(i + 1) }))
    .filter(({ t }) => !fertig.has(t.id))
    // an own Probeschularbeit keeps the numbers of its sheet („1a“), so the reading finds them on the photo
    .map(({ t, nr }) => ({ taskId: t.id, nr: t.data.nummer?.trim() || nr, aufgabe: frageText(t), loesung: loesungText(t), max: punkte.get(t.id) ?? null, skillId: t.skillId }));
  if (!aufgaben.length) return null;
  return { key: assignmentId ? `z${assignmentId}` : `u${w.id}`, worksheetId: w.id, assignmentId, titel: blattTitel(w, student), art, am, aufgaben, schonFertig: fertig.size };
}

/**
 * Die Blätter, die in dieser Einheit auf Papier gelöst worden sein können, das neueste zuerst: die in der Einheit gesendeten
 * Übungen mit noch offenen Aufgaben, der gedruckte Minitest und Übungen, die während der Einheit für diesen Schüler erstellt
 * und nicht gesendet wurden. Nur Blätter dieses Schülers (oder ohne Schüler, aus dem Bestand); nie die eines anderen.
 */
export function blaetterDerEinheit(unitId: number): PapierBlatt[] {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !student) return [];
  const out: PapierBlatt[] = [];
  const gesehen = new Set<number>();
  const zuweisungen = db()
    .prepare("SELECT id, worksheet_id, assigned_at FROM assignments WHERE unit_id = ? AND student_id = ? AND archived_at IS NULL ORDER BY assigned_at DESC, id DESC")
    .all(unit.id, student.id) as { id: number; worksheet_id: number; assigned_at: string }[];
  for (const a of zuweisungen) {
    gesehen.add(a.worksheet_id);
    const w = repo.getWorksheet(a.worksheet_id);
    const b = w ? blattAus(w, student, "gesendet", a.assigned_at, a.id) : null;
    if (b) out.push(b);
  }
  // printed, never sent: the unit's Minitest, and exercises made for this student during the unit without any assignment
  const gedruckt = db()
    .prepare(
      `SELECT w.id, w.created_at, (w.minitest_unit_id = ?) AS minitest FROM worksheets w
       WHERE (w.minitest_unit_id = ? OR (w.student_id = ? AND datetime(w.created_at) >= datetime(?)))
         AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.worksheet_id = w.id AND a.student_id = ?)
       ORDER BY w.created_at DESC, w.id DESC`,
    )
    .all(unit.id, unit.id, student.id, unit.started_at, student.id) as { id: number; created_at: string; minitest: number }[];
  for (const r of gedruckt) {
    if (gesehen.has(r.id)) continue;
    const w = repo.getWorksheet(r.id);
    const b = w && w.kind !== "bibliothek" ? blattAus(w, student, r.minitest ? "minitest" : w.probe_test_id ? "probe" : "erstellt", r.created_at, null) : null;
    if (b) gesehen.add(r.id);
    if (b) out.push(b);
  }
  // a Probeschularbeit of this student (made in the app or uploaded, lib/probe-extern.ts) is often written on paper at any time:
  // with its assignment when it was sent (the open tasks go on there), else printed
  const proben = db()
    .prepare("SELECT id, created_at FROM worksheets WHERE probe_test_id IS NOT NULL AND student_id = ? AND archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 10")
    .all(student.id) as { id: number; created_at: string }[];
  for (const r of proben) {
    if (gesehen.has(r.id)) continue;
    const w = repo.getWorksheet(r.id);
    const a = db().prepare("SELECT id FROM assignments WHERE worksheet_id = ? AND student_id = ? AND archived_at IS NULL ORDER BY id DESC LIMIT 1").get(r.id, student.id) as { id: number } | undefined;
    const b = w ? blattAus(w, student, "probe", r.created_at, a?.id ?? null) : null;
    if (b) out.push(b);
  }
  // newest first over both kinds (assigned_at and created_at are both UTC „YYYY-MM-DD HH:MM:SS“)
  return out.sort((x, y) => (x.am < y.am ? 1 : x.am > y.am ? -1 : 0));
}

/** Das Blatt der Einheit zu einer Übung (z. B. der eben gesendeten): das neueste mit dieser Übung, sonst null. */
export const blattZurUebung = (blaetter: PapierBlatt[], worksheetId: number | null) => (worksheetId ? (blaetter.find((b) => b.worksheetId === worksheetId) ?? null) : null);

// ---------- KI: Tor und Kosten ----------

/** Typische Größe einer Lesung mit zwei Seiten: Fotos, Aufgabenliste, Antwort mit Nachdenken. */
const TYPISCH_SEITE = 1_700;
const TYPISCH_TEXT = 2_500;
const TYPISCH_AUS = 4_000;

/** Was das Lesen eines Blatts etwa kostet („Lesen kostet ca. 3 Cent“): der Schnitt der letzten Lesungen, sonst aus dem Preis des Modells. */
export function kostenPapier(seiten = 2, now = Date.now()): string {
  const route = routeFor("blatt");
  if (route.provider === "manual") return "Lesen kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "Lesen kostet nichts (lokales Modell)";
  const seit = new Date(now - 60 * 86_400_000).toISOString();
  const m = db().prepare("SELECT COUNT(*) AS n, AVG(cost_usd) AS usd FROM ai_calls WHERE fn = 'blatt' AND status = 'ok' AND test = 0 AND cost_usd > 0 AND created_at >= ?").get(seit) as { n: number; usd: number | null };
  const usd = m.n >= 3 && m.usd !== null ? m.usd : costOf(route.model, FUNCTIONS.blatt.tier, { input: seiten * TYPISCH_SEITE + TYPISCH_TEXT, output: TYPISCH_AUS, cacheWrite: 0, cacheRead: 0 });
  return `Lesen kostet ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent`;
}

/**
 * Darf die KI dieses Blatt jetzt lesen? Sonst der Grund in einem Satz, und die Lehrkraft trägt die Bewertung selbst ein:
 * KI aus oder ohne Fotos, Monatsbudget aufgebraucht, Grenze je Schüler erreicht, nach Ausfällen pausiert.
 */
export function papierTor(studentId: number): { erlaubt: true; kosten: string } | { erlaubt: false; grund: string } {
  const geht = blattLesbar();
  if (!geht.ok) return { erlaubt: false, grund: geht.grund.replace("Trag die Aufgaben selbst ein.", "Trag die Bewertung selbst ein.") };
  if (budgetUsedUp("blatt")) return { erlaubt: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht. Trag die Bewertung selbst ein." };
  if (schuelerGestoppt("blatt", studentId)) return { erlaubt: false, grund: `${grenzeErreichtText()} Trag die Bewertung selbst ein.` };
  if (breakerState().paused) return { erlaubt: false, grund: "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten. Trag die Bewertung selbst ein." };
  return { erlaubt: true, kosten: kostenPapier() };
}

// ---------- Lesen ----------

/** Name und Nachname des Schülers aus einem Text, falls eine Aufgabe ihn nennt: an die KI geht kein Name aus der App. */
export function ohneNamen(text: string, name: string): string {
  let out = text;
  for (const teil of name.split(/\s+/).filter((t) => t.length >= 3)) out = out.replace(new RegExp(`(?<![\\p{L}])${teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu"), "…");
  return out;
}

/** Ein Buchstabe („B“, „b)“) oder der Text einer Auswahl → ihr Index; sonst -1. */
function auswahlIndex(options: string[], antwort: string): number {
  const a = antwort.trim().toLowerCase();
  const buchstabe = /^([a-z])(\)|\.|:)?(\s|$)/.exec(a);
  if (buchstabe) {
    const i = buchstabe[1].charCodeAt(0) - 97;
    if (i < options.length) return i;
  }
  return options.findIndex((o) => o.trim().toLowerCase() === a);
}

/**
 * Was die App selbst zur gelesenen Antwort sagt, wo sie es kann: akzeptierte Antworten und Zahlen (wie am Gerät), eine
 * Auswahl, eine einzelne Lücke, der Rechenweg (lib/math-task.ts mit den gelesenen Zeilen). Sonst null: dann zählt die Lesung,
 * und die Lehrkraft sieht sie in der Vorschau.
 */
export function appUrteil(task: Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">, antwort: string, weg: string[] = []): AppUrteil {
  const a = task.answer;
  if (!antwort.trim() && !weg.some((z) => z.trim())) return null;
  const ja = (c: boolean | null | undefined): AppUrteil => (c === true ? "richtig" : c === false ? "falsch" : null);
  try {
    if (task.type === "rechenweg") {
      const r = gradeMathTask(task, JSON.stringify({ steps: weg.map((z) => z.trim()).filter(Boolean), result: antwort.trim() })).check;
      return r.correct === true ? "richtig" : r.correct === false ? (r.onFinal === "teilweise" ? "teilweise" : "falsch") : null;
    }
    if (task.type === "sachaufgabe" || task.type === "free" || task.type === "fix" || task.type === "memorize" || task.type === "zuordnung" || task.type === "order") return null;
    if (task.data.options?.length) {
      if (a.correctAll?.length || typeof a.correct !== "number") return null;
      const i = auswahlIndex(task.data.options, antwort);
      return i < 0 ? null : ja(checkAnswer(task, String(i)).correct);
    }
    if (a.blanks) return a.blanks.length === 1 && !a.maxWords && !task.data.editing && !task.data.wortliste && !a.teilpunkte ? ja(checkAnswer(task, JSON.stringify([antwort.trim()])).correct) : null;
    if (a.accepted?.length) return ja(checkAnswer(task, antwort.trim()).correct);
  } catch {
    return null;
  }
  return null;
}

/**
 * Aus der Lesung die Zeilen der Vorschau, genau eine je offener Aufgabe des Blatts (nie eine erfundene): die gelesene Antwort,
 * die eigene Prüfung der App, der Vorschlag und warum eine Zeile gelb ist. Unsichere Zeilen zuerst.
 */
export function vorschlagMitAufgaben(g: BlattMitAufgabenGelesen, blatt: Pick<PapierBlatt, "titel" | "aufgaben">, tasks: Map<number, Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">>): BlattVorschlag {
  const hinweise: string[] = [];
  const zeilen: BlattZeile[] = blatt.aufgaben.map((a, i) => {
    const k = g.aufgaben.find((x) => Math.round(x.nr) === i + 1);
    const basis = { nr: a.nr, aufgabe: a.aufgabe, punkte: null, max: a.max, skillId: a.skillId, taskId: a.taskId, loesung: a.loesung };
    if (!k) return { ...basis, antwort: "", bewertung: "falsch" as const, fehler: "", pruefen: true, offen: true, warUnsicher: true, grund: "Nicht gelesen" };
    const antwort = eineZeile(k.antwort, 200);
    const weg = (k.rechenweg ?? []).map((z) => eineZeile(z, 200)).filter(Boolean).slice(0, 20);
    const task = tasks.get(a.taskId);
    const app = k.bewertung === "nicht_lesbar" || k.bewertung === "leer" || !task ? null : appUrteil(task, antwort, weg);
    const z = zusammenfuehren({ bewertung: k.bewertung, unsicher: k.unsicher || g.anderes_blatt, grund: k.grund }, app);
    return { ...basis, antwort, bewertung: z.bewertung, pruefen: z.pruefen, offen: z.offen, warUnsicher: z.warUnsicher, grund: z.pruefen ? z.grund : "", fehler: !z.pruefen && z.bewertung !== "richtig" ? (z.grund ?? "") : "" };
  });
  if (g.anderes_blatt) hinweise.push("Die Fotos zeigen vielleicht ein anderes Blatt. Bitte jede Zeile prüfen.");
  if (g.aufgaben.some((x) => !(Math.round(x.nr) >= 1 && Math.round(x.nr) <= blatt.aufgaben.length))) hinweise.push("Die Lesung nannte Aufgaben, die nicht auf diesem Blatt stehen. Sie sind weggelassen.");
  const gelb = zeilen.filter((z) => z.pruefen).length;
  if (gelb) hinweise.push(gelb === 1 ? "Eine Zeile ist unsicher und steht oben. Bitte prüfen, dann zählt sie." : `${gelb} Zeilen sind unsicher und stehen oben. Bitte prüfen, dann zählen sie.`);
  return { titel: blatt.titel, zeilen: unsichereZuerst(zeilen), gesamt: null, gesamtMax: null, note: null, hinweise };
}

/** Die laufende Einheit und ihr Schüler, oder ein Satz für die Lehrkraft. */
function laufend(unitId: number): { unit: UnitView; student: repo.Student } | { error: string } {
  const unit = getUnit(unitId);
  if (!unit) return { error: "Diese Einheit gibt es nicht." };
  if (unit.status !== "gestartet") return { error: "Die Einheit ist schon beendet." };
  const student = repo.getStudent(unit.student_id);
  if (!student) return { error: "Diesen Schüler gibt es nicht." };
  return { unit, student };
}

/**
 * Liest die gespeicherten Seiten gegen die Aufgaben eines Blatts der Einheit (`blattKey`). Wirft einen Fehler mit einem Satz
 * für die Lehrkraft; die Seiten bleiben dann gespeichert. Speichert nichts außer dem Protokoll der KI.
 */
export async function liesPapier(o: { unitId: number; blattKey: string; materialIds: number[]; teacherId: number }): Promise<BlattVorschlag> {
  const l = laufend(o.unitId);
  if ("error" in l) throw new Error(l.error);
  const blatt = blaetterDerEinheit(l.unit.id).find((b) => b.key === o.blattKey);
  if (!blatt) throw new Error("Dieses Blatt gehört nicht zu dieser Einheit.");
  const tor = papierTor(l.student.id);
  if (!tor.erlaubt) throw new Error(tor.grund);
  const seiten = seitenFuerKi(o.materialIds, l.student.id);
  const tasks = new Map(repo.listTasks(blatt.worksheetId).map((t) => [t.id, t] as const));
  const w = repo.getWorksheet(blatt.worksheetId)!;
  const aufgaben = blatt.aufgaben.map((a) => ({ angabe: ohneNamen(a.aufgabe, l.student.name), loesung: ohneNamen(a.loesung, l.student.name), punkte: a.max, nummer: a.nr }));
  touchUnit(l.unit.id);
  const gelesen = await leseBlattMitAufgaben(seiten, { fach: l.unit.subject || w.subject, aufgaben }, { teacherId: o.teacherId, studentId: l.student.id, unitId: l.unit.id, trigger: "papier" });
  if (!gelesen) throw new Error("Die KI hat das Blatt nicht gelesen. Trag die Bewertung bitte selbst ein.");
  return vorschlagMitAufgaben(gelesen, blatt, tasks);
}

// ---------- Übernehmen ----------

export type PapierEingabe = {
  unitId: number;
  teacherId: number;
  /** `PapierBlatt.key` oder `ANDERES_BLATT` */
  blatt: string;
  zeilen: BlattZeile[];
  materialIds: number[];
  /** ki: aus der Lesung; hand: selbst eingetragen */
  gelesen: "ki" | "hand";
  /** nur bei „Ein anderes Blatt“: Fach und Titel wie bei „Gelöstes Blatt einlesen“ */
  fach?: string;
  titel?: string;
};

const nurEigene = (ids: number[], studentId: number) =>
  [...new Set(ids)].slice(0, MAX_SEITEN).filter((id) => {
    const m = getMaterial(id);
    return m && hatDatei(m) && m.student_id === studentId;
  });

function merke(unit: UnitView, assignmentId: number, e: PapierEingabe, bekannt: boolean, ergebnis: PapierErgebnis, materialIds: number[]): number {
  const r = db()
    .prepare(
      `INSERT INTO papier_arbeiten (unit_id, assignment_id, student_id, titel, bekannt, gelesen, material_ids, von, richtig, teilweise, punkte, max_punkte, unsicher, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(unit.id, assignmentId, unit.student_id, ergebnis.titel, bekannt ? 1 : 0, e.gelesen === "ki" ? "ki" : "hand", JSON.stringify(materialIds), ergebnis.von, ergebnis.richtig, ergebnis.teilweise, ergebnis.punkte, ergebnis.max, ergebnis.unsicher, e.teacherId);
  for (const id of materialIds) db().prepare("UPDATE materials SET title = ? WHERE id = ? AND title = ?").run(`${BLATT_TITEL}: ${ergebnis.titel}`.slice(0, 120), id, BLATT_TITEL);
  return Number(r.lastInsertRowid);
}

/**
 * „Übernehmen“: die geprüften Zeilen als Antworten an derselben Zuweisung der Einheit (ein nicht gesendetes Blatt bekommt jetzt
 * eine, schon „angekommen“ und erledigt), mit der Bewertung der Lehrkraft (teilweise = halbe Punkte), dazu die Zeile für den
 * Abschluss. Eine gelbe Zeile oder eine ohne Bewertung wird nie gespeichert. Alles oder nichts.
 */
export function speicherePapier(e: PapierEingabe): { assignmentId: number; papierId: number } | { error: string } {
  const l = laufend(e.unitId);
  if ("error" in l) return l;
  const { unit, student } = l;
  if (e.zeilen.some((z) => z.pruefen)) return { error: "Bitte zuerst die gelb markierten Zeilen prüfen." };
  if (e.zeilen.some((z) => z.offen)) return { error: "Bitte jede Aufgabe bewerten." };
  if (e.zeilen.some((z) => !istBewertung(z.bewertung))) return { error: "Unbekannte Bewertung." };
  const materialIds = nurEigene(e.materialIds, student.id);

  // ein Blatt, das die App nicht kennt: wie „Gelöstes Blatt einlesen“, aber in dieser Einheit
  if (e.blatt === ANDERES_BLATT) {
    const fach = eineZeile(e.fach || unit.subject, 60);
    const titel = eineZeile(e.titel, 100) || "Blatt auf Papier";
    const zeilen = e.zeilen.map((z) => ({ ...z, taskId: undefined }));
    const out = speichereBlatt({ studentId: student.id, teacherId: e.teacherId, fach, datum: dayOf(new Date()), titel, art: "probe", testId: null, note: null, gesamt: null, gesamtMax: null, zeilen, materialIds, unitId: unit.id });
    if ("error" in out) return out;
    const papierId = merke(unit, out.assignmentId, e, false, papierErgebnis(titel, zeilen.filter((z) => z.aufgabe.trim())), materialIds);
    touchUnit(unit.id);
    return { assignmentId: out.assignmentId, papierId };
  }

  const blatt = blaetterDerEinheit(unit.id).find((b) => b.key === e.blatt);
  if (!blatt) return { error: "Dieses Blatt gehört nicht zu dieser Einheit, oder es ist schon ganz bewertet." };
  const offen = new Map(blatt.aufgaben.map((a) => [a.taskId, a]));
  const zeilen = e.zeilen.filter((z) => z.taskId != null);
  if (zeilen.length !== e.zeilen.length || zeilen.some((z) => !offen.has(z.taskId!)) || new Set(zeilen.map((z) => z.taskId)).size !== zeilen.length || zeilen.length !== offen.size)
    return { error: "Die Zeilen passen nicht mehr zum Blatt. Bitte die Seite neu laden." };
  // die Aufgabe und die Höchstpunkte kommen vom Blatt, nie aus dem Browser; teilweise = halbe Punkte
  const geprueft = blatt.aufgaben.map((a) => {
    const z = zeilen.find((x) => x.taskId === a.taskId)!;
    return { ...z, nr: a.nr, aufgabe: a.aufgabe, max: a.max, punkte: null, antwort: eineZeile(z.antwort, 200), fehler: z.bewertung === "richtig" ? "" : eineZeile(z.fehler, 200) };
  });
  const tasks = new Map(repo.listTasks(blatt.worksheetId).map((t) => [t.id, t] as const));
  const w = repo.getWorksheet(blatt.worksheetId)!;

  const out = db().transaction(() => {
    let assignmentId = blatt.assignmentId;
    if (assignmentId === null) {
      // printed, not sent: now an assignment of this unit, already „arrived“, so it never pops up on the device
      assignmentId = repo.assignWorksheet(w.id, student.id, PAPIER_ANTWORT, unit.id, blatt.art === "minitest" ? "test" : "normal");
      db().prepare("UPDATE assignments SET delivered_at = datetime('now') WHERE id = ?").run(assignmentId);
    }
    repo.markAssignmentStarted(assignmentId);
    const vorher = repo.listAttemptsForAssignment(assignmentId);
    for (const z of geprueft) {
      const t = tasks.get(z.taskId!)!;
      const review = z.bewertung === "leer" ? "falsch" : z.bewertung;
      const attemptId = repo.recordAttempt({
        assignment_id: assignmentId,
        task_id: t.id,
        student_id: student.id,
        skill_id: t.skillId,
        attempt_no: vorher.filter((a) => a.task_id === t.id).length + 1,
        answer: z.bewertung === "leer" ? "(nicht bearbeitet)" : z.antwort || PAPIER_ANTWORT,
        correct: review === "richtig" ? 1 : 0,
        final: 1,
        time_ms: 0,
        hints_used: 0,
        solution_viewed: 0,
        error_label: null,
        feedback: z.fehler,
        teacher_id: e.teacherId,
        level: t.level ?? levelOf(t.difficulty),
        unit_id: unit.id,
      });
      repo.setAttemptReview(attemptId, review, e.teacherId);
    }
    repo.completeAssignmentIfDone(assignmentId);
    const papierId = merke(unit, assignmentId, e, true, papierErgebnis(blatt.titel, geprueft), materialIds);
    return { assignmentId, papierId };
  })();
  touchUnit(unit.id);
  documentAssignment(out.assignmentId);
  return out;
}

// ---------- Abschluss ----------

/** Die auf Papier gelösten Übungen einer Einheit, wie der Abschluss sie nennt (nur übernommene). */
export function papierDerEinheit(unitId: number, nurId?: number): PapierErgebnis[] {
  const rows = db()
    .prepare(`SELECT assignment_id, titel, von, richtig, teilweise, punkte, max_punkte, unsicher FROM papier_arbeiten WHERE unit_id = ?${nurId ? " AND id = ?" : ""} ORDER BY id`)
    .all(...(nurId ? [unitId, nurId] : [unitId])) as {
    assignment_id: number;
    titel: string;
    von: number;
    richtig: number;
    teilweise: number;
    punkte: number | null;
    max_punkte: number | null;
    unsicher: number;
  }[];
  return rows.map((r) => ({ titel: r.titel, von: r.von, richtig: r.richtig, teilweise: r.teilweise, punkte: r.punkte, max: r.max_punkte, unsicher: r.unsicher, assignmentId: r.assignment_id }));
}

/** Eine übernommene Papierarbeit dieser Einheit (für die Meldung nach „Übernehmen“). */
export function papierArbeit(id: number, unitId: number): PapierErgebnis | null {
  return papierDerEinheit(unitId, id)[0] ?? null;
}

