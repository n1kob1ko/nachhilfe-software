/**
 * **Anpassung im Unterricht**: der Vorschlag für die laufende Einheit aus den Regeln (lib/steuerung-regeln.ts) und woher
 * die Aufgabe dazu kommt. Erst vorhandene Aufgaben (A: Schritte des Lernpakets, freigegebene Übungen, Bibliothek), dann
 * die eingebauten Generatoren und Banken (B), neue Aufgaben der KI (C) nur, wenn A und B nichts Passendes haben, der
 * Lehrer tippt und Budget, Grenze des Schülers und KI-Modus es erlauben. Nichts hier fragt die KI von selbst.
 *
 * Schlecht bewertete Aufgaben (lib/bewertungen.ts) kommen nie in die Auswahl, Aufgaben mit „Bitte prüfen“ auch nicht.
 * Jede Aufgabe geht an den Schüler **dieser** Einheit, auch bei zwei Einheiten zugleich.
 */
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { latestInsight } from "./ai/insights";
import { ACTION_LABEL } from "./ai/labels";
import { aiEnabled, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { aufgabeSchluessel, ausgeblendet } from "./bewertungen";
import { aufgabeFuerSchueler, reagiert, type CockpitDaten } from "./cockpit";
import { zurFaehigkeit } from "./cockpit-vorschlag";
import { DIFFICULTIES, levelOf } from "./curriculum";
import { db } from "./db";
import { correctionTask, generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { prerequisitesOf } from "./lehrplan";
import { wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { analyzeStudent } from "./service";
import { MIT_AUFGABE, quelleFuer, schlageVor, type Antwort, type Art, type Ausloeser, type KiTor, type Lage, type Option, type Quelle } from "./steuerung-regeln";
import type { TaskDraft } from "./tasks";
import { getUnit } from "./units";
import { vorgabeDerEinheit } from "./vorgabe";

/** So viele Aufgaben gehen mit einem Tippen zum Schüler. */
export const ANZAHL = 3;
/** Eine Prüfung bis so viele Tage voraus gehört zu den Fähigkeiten von heute. */
export const PRUEFUNG_TAGE = 30;

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const first = (n: string) => n.split(" ")[0];

/** Die zuletzt gesendete Übung der Einheit (ohne Minitest und Probeschularbeit); null, wenn noch nichts gesendet ist. */
export function aktuelleUebung(unitId: number): { assignmentId: number; worksheetId: number } | null {
  const r = db().prepare("SELECT id, worksheet_id FROM assignments WHERE unit_id = ? AND mode <> 'test' ORDER BY id DESC LIMIT 1").get(unitId) as { id: number; worksheet_id: number } | undefined;
  return r ? { assignmentId: r.id, worksheetId: r.worksheet_id } : null;
}

type Versuch = Pick<repo.Attempt, "id" | "task_id" | "skill_id" | "correct" | "hints_used" | "time_ms" | "solution_viewed" | "error_type" | "error_label">;

const stufeVon = (t: Pick<repo.Task, "level" | "difficulty">) => t.level ?? levelOf(t.difficulty);
const mitte = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

/** Die nächste Prüfung im Fach der Einheit (bis 30 Tage), deren Fähigkeiten zum Stoff von heute zählen. */
function naechstePruefung(studentId: number, fach: string | null, heute: string): repo.TestResult | null {
  const bis = new Date(Date.parse(`${heute}T12:00:00Z`) + PRUEFUNG_TAGE * 86_400_000).toISOString().slice(0, 10);
  return (
    repo
      .listTests(studentId)
      .filter((t) => t.date >= heute && t.date <= bis && t.status !== "abgesagt" && t.status !== "geschrieben" && (!fach || !t.subject || t.subject === fach))
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

/**
 * Alles, was die Regeln brauchen, für den Schritt auf dem Schirm. Null, solange es nichts zu beurteilen gibt: keine
 * Antwort seit der letzten Reaktion und kein Zeichen des Lehrers zum Schritt.
 */
export function lageDerEinheit(unitId: number, c: CockpitDaten): (Lage & { uebung: ReturnType<typeof aktuelleUebung> }) | null {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return null;
  const st = c.stand.steuerung;
  const schritt = c.paket ? c.aktuell : null;
  const plan = c.paket ? null : c.planAktuell;
  const schrittId = schritt?.id ?? plan?.id ?? null;
  const lehrer = st.signal && st.signal.schritt === schrittId ? st.signal.art : null;
  const uebung = aktuelleUebung(unitId);
  const versuche = uebung
    ? (db()
        .prepare(`SELECT id, task_id, skill_id, correct, hints_used, time_ms, solution_viewed, error_type, error_label FROM attempts WHERE assignment_id = ? AND id > ? AND ${repo.COUNTED} ORDER BY id`)
        .all(uebung.assignmentId, st.bis) as Versuch[])
    : [];
  if (!versuche.length && !lehrer) return null;

  const tasks = uebung ? repo.listTasks(uebung.worksheetId) : [];
  const taskSkill = new Map(tasks.map((t) => [t.id, t.skillId ?? null]));
  const antworten: Antwort[] = versuche.map((v) => ({
    taskId: v.task_id,
    skillId: v.skill_id ?? taskSkill.get(v.task_id) ?? null,
    correct: Boolean(v.correct),
    hints: v.hints_used,
    timeMs: v.time_ms,
    solutionViewed: Boolean(v.solution_viewed),
    errorType: v.error_type ?? null,
    errorLabel: v.error_label,
  }));
  const schrittSkills = schritt
    ? uniq(schritt.aufgaben.flatMap((a) => [a.skillId, ...(a.skillIds ?? [])]).filter((x): x is string => Boolean(x)))
    : plan?.skillId
      ? [plan.skillId]
      : c.stand.skill_id
        ? [c.stand.skill_id]
        : [];
  if (schritt && !schrittSkills.length) schrittSkills.push(...c.paket!.skill_ids.slice(0, 1));

  // die Stufe je Fähigkeit: aus den Aufgaben der Übung, für den Schritt sonst aus dem Paket
  const stufen: Record<string, number> = {};
  const jeSkill = new Map<string, number[]>();
  for (const t of tasks) for (const id of uniq([t.skillId, ...(t.skillIds ?? [])].filter((x): x is string => Boolean(x)))) jeSkill.set(id, [...(jeSkill.get(id) ?? []), stufeVon(t)]);
  for (const [id, xs] of jeSkill) stufen[id] = mitte(xs);
  if (c.paket) for (const id of schrittSkills) stufen[id] ??= levelOf(c.paket.schwierigkeit);

  const heute = wienerDatum();
  const vorgabe = vorgabeDerEinheit(unitId)?.skillIds ?? [];
  const pruefung = naechstePruefung(unit.student_id, unit.subject, heute)?.skill_ids ?? [];
  const alle = uniq([...vorgabe, ...schrittSkills, ...pruefung, ...antworten.map((a) => a.skillId).filter((x): x is string => Boolean(x))]);
  const voraussetzungen = Object.fromEntries(alle.map((id) => [id, prerequisitesOf(id).filter((p) => repo.getSkill(p))]));
  const lernstand: Record<string, number | null> = {};
  for (const s of analyzeStudent(unit.student_id)?.skills ?? []) lernstand[s.skill.id] = s.mastery;
  const skillId = schrittSkills[0] ?? antworten[0]?.skillId ?? null;
  const f = zurFaehigkeit(skillId);
  const ids = c.paket ? c.schritte.map((s) => s.id) : c.plan.map((s) => s.id);
  const offen = (id: number) => !c.stand.erledigt.includes(id) && !c.stand.uebersprungen.includes(id);
  return {
    uebung,
    antworten,
    aufgaben: tasks.length,
    skillId,
    stufen,
    heute: { vorgabe, schritt: schrittSkills, pruefung },
    voraussetzungen,
    lernstand,
    hilfe: Boolean(schritt?.bei_fehler.trim() || f.erklaerung?.trim() || f.typischeFehler?.some((x) => x.trim())),
    naechsterSchritt: ids.some((id) => id !== schrittId && offen(id)),
    fehlerAufgaben: alle.filter((id) => correctionTask(id, "mittel") !== null),
    lehrer,
  };
}

// ---------- A: vorhandene Aufgaben ----------

/** Die Schlüssel der Aufgaben, die in dieser Einheit schon beim Schüler waren (lib/bewertungen.ts aufgabeSchluessel). */
function schonGesendet(unitId: number): Set<string> {
  const ws = db().prepare("SELECT DISTINCT worksheet_id FROM assignments WHERE unit_id = ?").all(unitId) as { worksheet_id: number }[];
  return new Set(ws.flatMap((w) => repo.listTasks(w.worksheet_id).map(aufgabeSchluessel)));
}

/**
 * A: vorhandene Aufgaben zur Fähigkeit und Stufe, höchstens `ANZAHL`: zuerst aus den Schritten des Lernpakets der Einheit,
 * dann aus freigegebenen Übungen (allgemeine oder die des Schülers) und der Bibliothek. Nicht, was in dieser Einheit schon
 * gesendet wurde, nichts schlecht Bewertetes, nichts mit „Bitte prüfen“.
 */
export function bestand(unitId: number, o: Pick<Option, "skillId" | "level">, c?: Pick<CockpitDaten, "paket">): TaskDraft[] {
  const unit = getUnit(unitId);
  if (!unit || !o.skillId || !o.level) return [];
  const weg = new Set([...schonGesendet(unitId), ...ausgeblendet()]);
  const out: TaskDraft[] = [];
  const nimm = (t: TaskDraft) => {
    const k = aufgabeSchluessel(t);
    if (out.length >= ANZAHL || weg.has(k) || t.data?.pruefen?.length) return;
    weg.add(k);
    out.push(t);
  };
  const paket = c?.paket ?? null;
  if (paket)
    for (const s of paket.schritte)
      for (const a of s.aufgaben) if ((a.skillId === o.skillId || a.skillIds?.includes(o.skillId)) && levelOf(a.difficulty ?? paket.schwierigkeit) === o.level) nimm(aufgabeFuerSchueler(a, paket.quelle));
  if (out.length >= ANZAHL) return out;
  const ids = db()
    .prepare(
      `SELECT t.id FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id
       WHERE w.archived_at IS NULL AND (w.status = 'freigegeben' OR w.kind = 'bibliothek') AND w.kind IN ('uebung', 'ueberpruefung', 'bibliothek')
         AND w.probe_test_id IS NULL AND (w.student_id IS NULL OR w.student_id = ?)
         AND COALESCE(t.level, 3) = ? AND EXISTS (SELECT 1 FROM task_skills ts WHERE ts.task_id = t.id AND ts.skill_id = ?)
       ORDER BY w.kind = 'bibliothek' DESC, t.id DESC LIMIT 60`,
    )
    .all(unit.student_id, o.level, o.skillId) as { id: number }[];
  for (const { id } of ids) {
    const t = repo.getTask(id);
    if (!t) continue;
    const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = t;
    void _i, void _w, void _p, void _l;
    nimm(draft);
  }
  return out;
}

// ---------- B: Generatoren und Banken ----------

/** Kann ein eingebauter Generator (oder eine Bank) Aufgaben dafür bauen? Für „Aufgabe zu diesem Fehler“: Fehler korrigieren. */
export const generatorKann = (o: Pick<Option, "art" | "skillId">) => Boolean(o.skillId) && (o.art === "fehler" ? correctionTask(o.skillId!, "mittel") !== null : hasBuiltInGenerator(o.skillId!));

/** B: neue Aufgaben aus den Generatoren, ohne KI; nicht schlecht bewertete und keine, die schon gesendet waren. */
export function ausGenerator(unitId: number, o: Pick<Option, "art" | "skillId" | "level">): TaskDraft[] {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  const skill = o.skillId ? repo.getSkill(o.skillId) : null;
  if (!student || !skill || !o.level) return [];
  const difficulty = DIFFICULTIES[Math.max(1, Math.min(5, o.level)) - 1];
  const weg = new Set([...schonGesendet(unitId), ...ausgeblendet()]);
  const roh =
    o.art === "fehler"
      ? Array.from({ length: ANZAHL * 4 }, () => correctionTask(skill.id, difficulty)).filter((t): t is TaskDraft => t !== null)
      : generateBuiltIn({ subject: skill.subject, skills: [{ id: skill.id, name: skill.name }], difficulty, count: ANZAHL * 2, taskType: "mixed", grade: schulstufe(student.school_type, student.klasse ?? 1) });
  const out: TaskDraft[] = [];
  for (const t of roh) {
    const k = aufgabeSchluessel(t);
    if (weg.has(k)) continue;
    weg.add(k);
    out.push({ ...t, skillId: t.skillId ?? skill.id, difficulty: t.difficulty ?? difficulty });
    if (out.length >= ANZAHL) break;
  }
  return out;
}

// ---------- C: die KI, nur auf Tippen ----------

/** Typische Größe einer Anfrage „Neue Aufgabe in der Einheit“ (zwei Aufgaben, mit Lernstand und Fehler). */
export const TYPISCH_EIN = 3_000;
export const TYPISCH_AUS = 3_500;

/** Was zwei neue Aufgaben der KI etwa kosten: gemessen (Ø der letzten 60 Tage, ab drei Aufrufen), sonst geschätzt. */
export function kostenNeueAufgabe(now = Date.now()): string {
  const route = routeFor("neue_aufgabe");
  if (route.provider === "manual") return "kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "kostet nichts (lokales Modell)";
  const seit = new Date(now - 60 * 86_400_000).toISOString();
  const m = db().prepare("SELECT COUNT(*) AS n, AVG(cost_usd) AS usd FROM ai_calls WHERE fn = 'neue_aufgabe' AND status = 'ok' AND test = 0 AND cost_usd > 0 AND created_at >= ?").get(seit) as { n: number; usd: number | null };
  const usd = m.n >= 3 && m.usd !== null ? m.usd : costOf(route.model, "standard", { input: TYPISCH_EIN, output: TYPISCH_AUS, cacheWrite: 0, cacheRead: 0 });
  return `ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent`;
}

/**
 * Darf die KI für diesen Schüler jetzt neue Aufgaben machen (C)? Nicht, wenn sie aus ist, im manuellen Modus (im
 * Unterricht zu langsam), wenn das Budget aufgebraucht oder die Grenze des Schülers erreicht ist.
 */
export function kiTor(studentId: number): KiTor {
  if (!aiEnabled("neue_aufgabe")) return { erlaubt: false, grund: "Die KI ist aus." };
  if (routeFor("neue_aufgabe").provider === "manual") return { erlaubt: false, grund: "Im manuellen KI-Modus nicht im Unterricht." };
  if (budgetUsedUp("neue_aufgabe")) return { erlaubt: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (schuelerGestoppt("neue_aufgabe", studentId)) return { erlaubt: false, grund: grenzeErreichtText() };
  return { erlaubt: true, kosten: kostenNeueAufgabe() };
}

// ---------- was der Unterricht zeigt ----------

export type Knopf = { option: Option; label: string; quelle: Quelle | null; gesperrt: string | null; kosten: string | null };
export type Anzeige = {
  grund: string;
  ausloeser: Ausloeser;
  /** die Fähigkeit des Vorschlags, als Name */
  faehigkeit: string | null;
  /** der eine Knopf; null nur, wenn es allein neue Aufgaben der KI gäbe */
  haupt: Knopf | null;
  /** unter „Andere Möglichkeit“, zuletzt C */
  andere: Knopf[];
  /** der KI-Hinweis der Live-Analyse zur aktuellen Übung, als Zusatz unter dem Vorschlag */
  zusatz: string | null;
};

/** Der Text auf dem Knopf. */
export function knopfText(o: Option, name: string | null = null): string {
  const L: Record<Art, string> = {
    leichter: "Leichtere Aufgabe senden",
    voraussetzung: name ? `Erst ${name} üben` : "Voraussetzung üben",
    fehler: "Aufgabe zu diesem Fehler senden",
    erklaeren: "Einfacher erklären",
    tafel: "Gemeinsam an der Tafel",
    schwerer: "Schwerere Aufgabe senden",
    weiter: "Weiter zum nächsten Schritt",
  };
  return L[o.art];
}

/**
 * Der Vorschlag für den Unterricht, mit der Quelle jeder Aufgabe (A → B → C). Neue Aufgaben der KI stehen nur unter
 * „Andere Möglichkeit“ und nur, wenn weder A noch B für eine der Möglichkeiten etwas haben. Fragt nie die KI.
 */
export function vorschlagDerEinheit(unitId: number, c: CockpitDaten): Anzeige | null {
  const lage = lageDerEinheit(unitId, c);
  const v = lage ? schlageVor(lage) : null;
  const unit = getUnit(unitId);
  if (!lage || !v || !unit) return null;
  const name = (id: string | null) => (id ? (repo.getSkill(id)?.name ?? null) : null);
  const tor = kiTor(unit.student_id);
  const knoepfe: Knopf[] = [];
  let ohneQuelle: Option | null = null;
  for (const o of [v.haupt, ...v.andere]) {
    if (!MIT_AUFGABE.includes(o.art)) {
      knoepfe.push({ option: o, label: knopfText(o), quelle: null, gesperrt: null, kosten: null });
      continue;
    }
    const q = quelleFuer({ bestand: bestand(unitId, o, c).length, generator: generatorKann(o), ki: tor });
    if (q.quelle === "C") ohneQuelle ??= o;
    else knoepfe.push({ option: o, label: knopfText(o, name(o.skillId)), quelle: q.quelle, gesperrt: null, kosten: null });
  }
  // C: nur, wenn keine Möglichkeit mit Aufgabe aus A oder B kommt
  const neu: Knopf | null =
    ohneQuelle && !knoepfe.some((k) => k.quelle)
      ? { option: ohneQuelle, label: "Neue passende Aufgabe erstellen", quelle: "C", gesperrt: tor.erlaubt ? null : tor.grund, kosten: tor.erlaubt ? tor.kosten : null }
      : null;
  const ziel = v.haupt.skillId ?? lage.skillId;
  return { grund: v.grund, ausloeser: v.ausloeser, faehigkeit: name(ziel), haupt: knoepfe[0] ?? null, andere: [...knoepfe.slice(1), ...(neu ? [neu] : [])], zusatz: zusatzHinweis(unitId, lage.uebung?.assignmentId ?? null) };
}

/** Der letzte KI-Hinweis der Live-Analyse (lib/ai/realtime.ts) zur aktuellen Übung, als ein Satz; sonst null. */
function zusatzHinweis(unitId: number, assignmentId: number | null): string | null {
  const i = assignmentId ? latestInsight(unitId, "echtzeit") : null;
  if (!i || i.assignmentId !== assignmentId) return null;
  return [ACTION_LABEL[i.data.recommended_action], i.data.misconception, i.data.hint ? `Denkanstoß: „${i.data.hint}“` : null].filter(Boolean).join(" · ");
}

// ---------- senden ----------

// Der Schüler sieht den Titel: kein „Leichter“ oder „Schwerer“ darin, nur was geübt wird.
const TITEL: Partial<Record<Art, string>> = { voraussetzung: "Grundlage" };

/**
 * Eine Aufgabe zum Vorschlag an den Schüler dieser Einheit: aus A, sonst aus B. Danach zählt für den nächsten Vorschlag
 * nur, was der Schüler ab jetzt antwortet (`reagiert`).
 */
export function sendeAngepasst(unitId: number, o: Option, teacherId: number | null, c?: Pick<CockpitDaten, "paket">): { worksheetId: number; assignmentId: number; quelle: "A" | "B" } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const skill = o.skillId ? repo.getSkill(o.skillId) : null;
  if (!student || !skill || !MIT_AUFGABE.includes(o.art) || !o.level || o.level < 1 || o.level > 5) return { fehler: "Diese Fähigkeit gibt es nicht." };
  const paket = c?.paket ?? null;
  let quelle: "A" | "B" = "A";
  let tasks = bestand(unitId, o, { paket });
  if (!tasks.length) {
    quelle = "B";
    tasks = generatorKann(o) ? ausGenerator(unitId, o) : [];
  }
  if (!tasks.length) return { fehler: "Dazu gibt es gerade keine passende Aufgabe ohne KI." };
  const difficulty = DIFFICULTIES[o.level - 1];
  let worksheetId = 0;
  let assignmentId = 0;
  db().transaction(() => {
    worksheetId = repo.createWorksheet(
      {
        title: `${first(student.name)} – ${TITEL[o.art] ?? "Üben"}: ${skill.name}`.slice(0, 160),
        subject: skill.subject,
        grade: schulstufe(student.school_type, student.klasse ?? 1),
        school_type: student.school_type,
        klasse: student.klasse,
        topic: skill.area,
        difficulty,
        task_type: o.art === "fehler" ? "fix" : "mixed",
        kind: "uebung",
        source: quelle === "B" ? "generator" : "manuell",
        skill_ids: [skill.id],
        student_id: student.id,
        teacher_id: teacherId,
        status: "freigegeben",
      },
      tasks,
    );
    assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  })();
  reagiert(unitId);
  return { worksheetId, assignmentId, quelle };
}
