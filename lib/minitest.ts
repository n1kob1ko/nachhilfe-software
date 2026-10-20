/**
 * **Minitest** am Anfang der Einheit: ein paar Aufgaben über den Stoff der letzten Einheit, ohne Tipps
 * und mit einem Versuch je Aufgabe, wie eine kleine Schularbeit. niko, 2026-10-19: „um die Nervosität
 * von Schülern von Tests wegzukriegen, ist, dass jedes Mal am Anfang der Einheit gleich eine
 * Probeschularbeit sozusagen oder ein Minitest geschrieben wird über den Stoff, der zuletzt gemacht
 * wurde“.
 *
 * Ein Minitest ist eine gewöhnliche Übung (kind 'ueberpruefung', `worksheets.minitest_unit_id` = die
 * Einheit, für die er gemacht wurde). Am Gerät läuft er über eine Zuweisung im Modus 'test'
 * (lib/quick-round.ts): dieselbe Abgabe und dasselbe Tracking wie sonst, nur ohne Tipps und mit einem
 * Versuch (lib/service.ts triesFor). Gedruckt gibt es keine Zuweisung, die Übung gehört trotzdem zur Einheit.
 *
 * Die Aufgaben kommen ohne KI und kosten nichts: je Aufgabe der letzten Einheit eine neue Variante aus
 * den Generatoren, sonst eine noch nicht gesehene aus der Aufgabenbibliothek, sonst die Aufgabe selbst.
 * Falsch gelöste Fähigkeiten kommen zuerst dran.
 */
import { db } from "./db";
import { libraryTask, taskKey } from "./diagnose";
import { DIFFICULTIES, type Difficulty, type TaskType } from "./curriculum";
import { aufgabenSchluessel } from "./figur";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { isMinitest } from "./quick-round";
import * as repo from "./repo";
import { schulstufe } from "./school";
import type { TaskDraft } from "./tasks";
import { getUnit, listUnits, type UnitView } from "./units";

/** So viele Aufgaben kann der Lehrer wählen; 6 passt in die ersten zehn Minuten. */
export const MINITEST_ANZAHL = [5, 6, 8] as const;
export const MINITEST_STANDARD = 6;
/** So viele frühere Einheiten werden nach Stoff durchsucht. */
const SUCHE_EINHEITEN = 10;

export type StoffAufgabe = { task: repo.Task; fach: string; richtig: boolean };

/** Der Stoff der letzten Einheit: ihre Aufgaben in einem Fach, die falsch gelösten zuerst. */
export type Stoff = {
  unit: UnitView;
  fach: string;
  aufgaben: StoffAufgabe[];
  /** die Fähigkeiten mit Namen und Thema, schwache zuerst, dann die häufigsten */
  faehigkeiten: { id: string; name: string; area: string; anzahl: number; falsch: number }[];
};

/** Die gelösten Aufgaben einer Einheit (ohne ihren eigenen Minitest), je Aufgabe einmal, mit Fach. */
function aufgabenDerEinheit(unitId: number): StoffAufgabe[] {
  const fach = new Map<number, string | null>();
  const out = new Map<number, StoffAufgabe>();
  for (const a of repo.listAttemptsForUnit(unitId)) {
    if (!fach.has(a.assignment_id)) {
      const as = repo.getAssignment(a.assignment_id);
      fach.set(a.assignment_id, as && !isMinitest(as.mode) ? (repo.getWorksheet(as.worksheet_id)?.subject ?? null) : null);
    }
    const f = fach.get(a.assignment_id);
    if (!f) continue;
    const task = out.get(a.task_id)?.task ?? repo.getTask(a.task_id);
    if (!task) continue;
    // richtig = am Ende richtig, ohne Lösung anzusehen; der letzte Versuch zählt
    out.set(a.task_id, { task, fach: f, richtig: Boolean(a.correct) && !a.solution_viewed });
  }
  return [...out.values()];
}

/**
 * Der Stoff, der zuletzt gemacht wurde: die neueste beendete Einheit vor `unitId` mit Aufgaben am
 * Gerät, im Fach der laufenden Einheit, wenn sie eines hat, sonst im häufigsten Fach. `null`, wenn
 * es keine gibt (dann gibt es keinen Minitest).
 */
export function letzterStoff(studentId: number, unitId: number | null): Stoff | null {
  const jetzt = unitId ? getUnit(unitId) : null;
  const vorher = listUnits({ studentId, status: "beendet" })
    .filter((u) => u.id !== unitId && (!jetzt || u.started_at < jetzt.started_at))
    .slice(0, SUCHE_EINHEITEN);
  for (const unit of vorher) {
    const alle = aufgabenDerEinheit(unit.id);
    if (!alle.length) continue;
    const zaehler = new Map<string, number>();
    for (const a of alle) zaehler.set(a.fach, (zaehler.get(a.fach) ?? 0) + 1);
    const fach = jetzt?.subject ? jetzt.subject : [...zaehler].sort((a, b) => b[1] - a[1])[0][0];
    const aufgaben = alle.filter((a) => a.fach === fach).sort((a, b) => Number(a.richtig) - Number(b.richtig));
    if (!aufgaben.length) continue;
    const faehigkeiten = new Map<string, Stoff["faehigkeiten"][number]>();
    for (const a of aufgaben) {
      if (!a.task.skillId) continue;
      const s = faehigkeiten.get(a.task.skillId) ?? (() => {
        const skill = repo.getSkill(a.task.skillId!);
        return { id: a.task.skillId!, name: skill?.name ?? a.task.skillId!, area: skill?.area ?? "", anzahl: 0, falsch: 0 };
      })();
      s.anzahl++;
      if (!a.richtig) s.falsch++;
      faehigkeiten.set(s.id, s);
    }
    return { unit, fach, aufgaben, faehigkeiten: [...faehigkeiten.values()].sort((a, b) => b.falsch - a.falsch || b.anzahl - a.anzahl) };
  }
  return null;
}

/** Die gespeicherten Daten einer Aufgabe (JSON); kaputte Daten zählen als leer. */
function datenVon(raw: string): { figure?: unknown } {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as { figure?: unknown }) : {};
  } catch {
    return {};
  }
}

const schwierigkeit = (d: string): Difficulty => ((DIFFICULTIES as readonly string[]).includes(d) ? (d as Difficulty) : "mittel");
/** Antwortformate, in denen die Generatoren neue Varianten machen; alles andere als Rechnung. Zuordnung: Matura-Format (lib/mathe-matura.ts). */
const FORMAT: Partial<Record<TaskType, TaskType>> = { calc: "calc", mc: "mc", cloze: "cloze", rechenweg: "rechenweg", sachaufgabe: "sachaufgabe", zuordnung: "zuordnung" };

/**
 * Die Reihenfolge der Vorlagen: reihum über die Fähigkeiten (schwache zuerst), je Fähigkeit die falsch
 * gelösten Aufgaben zuerst, bis `anzahl` erreicht ist. Aufgaben ohne Fähigkeit bilden je eine eigene Gruppe.
 */
export function vorlagen(stoff: Pick<Stoff, "aufgaben" | "faehigkeiten">, anzahl: number): StoffAufgabe[] {
  const gruppen = new Map<string, StoffAufgabe[]>();
  for (const f of stoff.faehigkeiten) gruppen.set(f.id, []);
  for (const a of stoff.aufgaben) {
    const key = a.task.skillId ?? `aufgabe:${a.task.id}`;
    gruppen.set(key, [...(gruppen.get(key) ?? []), a]);
  }
  const listen = [...gruppen.values()].filter((l) => l.length);
  const out: StoffAufgabe[] = [];
  for (let runde = 0; out.length < anzahl && runde < anzahl; runde++) {
    for (const l of listen) if (out.length < anzahl) out.push(l[runde % l.length]);
  }
  return out;
}

/** Eine neue Variante aus den Generatoren, im selben Antwortformat wie die Vorlage, wenn es geht. */
function neueVariante(v: StoffAufgabe, grade: number, schonDa: Set<string>, gesehen: Set<string>, seed: number | undefined): TaskDraft | null {
  const skillId = v.task.skillId;
  if (!skillId || !hasBuiltInGenerator(skillId)) return null;
  const name = repo.getSkill(skillId)?.name ?? skillId;
  const formate = [...new Set([FORMAT[v.task.type] ?? "calc", "calc"] as TaskType[])];
  for (const format of formate) {
    for (let k = 0; k < 6; k++) {
      const [t] = generateBuiltIn({ subject: v.fach, skills: [{ id: skillId, name }], difficulty: schwierigkeit(v.task.difficulty), count: 1, taskType: format, seed: seed === undefined ? undefined : seed + k, grade });
      // Erklärungsaufgaben (frei) und ganze Lesetexte passen nicht in einen kurzen Test
      if (!t || ((t.type === "free" || t.type === "reading") && t.type !== v.task.type)) break;
      if (schonDa.has(taskKey(t)) || gesehen.has(aufgabenSchluessel(t))) continue;
      return { ...t, skillId, sourceType: "eigen" };
    }
  }
  return null;
}

/** Die Aufgabe der letzten Einheit selbst, als neue Aufgabe (ohne ihre Nummer und Übung). */
function kopie(t: repo.Task): TaskDraft {
  const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = t;
  void _i, void _w, void _p, void _l;
  return draft;
}

/** Die Aufgaben des Minitests aus dem Stoff: neue Varianten, sonst Bibliothek, sonst die Aufgabe selbst. */
export function minitestAufgaben(stoff: Stoff, anzahl: number, grade: number, seed?: number): TaskDraft[] {
  // schon bearbeitete Aufgaben; Aufgaben mit Bild haben oft denselben Text und zählen mit ihrem Bild (aufgabenSchluessel)
  const gesehen = new Set(
    (db().prepare("SELECT DISTINCT t.prompt, t.data, t.category FROM attempts a JOIN tasks t ON t.id = a.task_id WHERE a.student_id = ?").all(stoff.unit.student_id) as { prompt: string; data: string; category: string | null }[]).map((r) =>
      aufgabenSchluessel({ prompt: r.prompt, category: r.category, data: datenVon(r.data) }),
    ),
  );
  const schonDa = new Set<string>();
  const benutzt = new Set<number>();
  const out: TaskDraft[] = [];
  vorlagen(stoff, anzahl).forEach((v, i) => {
    const t =
      neueVariante(v, grade, schonDa, gesehen, seed === undefined ? undefined : seed + i * 11) ??
      (v.task.skillId ? libraryTask(v.fach, { skillId: v.task.skillId, difficulty: schwierigkeit(v.task.difficulty) }, benutzt, gesehen) : null) ??
      kopie(v.task);
    if (schonDa.has(taskKey(t))) return;
    schonDa.add(taskKey(t));
    out.push(t);
  });
  return out;
}

/** Die Themen des Stoffs für den Titel: höchstens zwei, sonst „…“. */
export function stoffThemen(stoff: Pick<Stoff, "faehigkeiten" | "aufgaben">): string {
  const themen = [...new Set(stoff.faehigkeiten.map((f) => f.area || f.name).filter(Boolean))];
  if (!themen.length) return [...new Set(stoff.aufgaben.map((a) => a.task.category || "").filter(Boolean))][0] ?? "Wiederholung";
  return themen.length > 2 ? `${themen.slice(0, 2).join(", ")} …` : themen.join(", ");
}

/** „vom 12.10.“: wann der Stoff dran war, kurz für die Karte und den Titel. */
export function stoffDatum(stoff: Pick<Stoff, "unit">): string {
  return new Date(stoff.unit.started_at).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Vienna" });
}

/** Der Minitest einer Einheit, falls schon einer gemacht wurde (am Gerät oder nur gedruckt). */
export function minitestDerEinheit(unitId: number): { worksheet: repo.Worksheet; assignment: repo.Assignment | null } | null {
  const row = db().prepare("SELECT id FROM worksheets WHERE minitest_unit_id = ? ORDER BY id DESC LIMIT 1").get(unitId) as { id: number } | undefined;
  const worksheet = row ? repo.getWorksheet(row.id) : null;
  if (!worksheet) return null;
  const a = db().prepare("SELECT id FROM assignments WHERE worksheet_id = ? AND unit_id = ? AND mode = 'test' ORDER BY id DESC LIMIT 1").get(worksheet.id, unitId) as { id: number } | undefined;
  return { worksheet, assignment: a ? repo.getAssignment(a.id) : null };
}

export type MinitestInput = {
  unitId: number;
  teacherId: number | null;
  anzahl?: number;
  /** "geraet": als Minitest an den Schüler (Modus 'test'); "druck": nur die Übung, zum Drucken */
  ziel: "geraet" | "druck";
  /** für Tests: macht die Aufgaben wiederholbar */
  seed?: number;
};

/**
 * Erstellt den Minitest für eine laufende Einheit. Für das Gerät mit einer Zuweisung im Modus 'test';
 * auf das Tablet bringt ihn die Aktion (lib/live.ts). Gibt es schon einen, wird kein zweiter gemacht:
 * dann kommt der vorhandene zurück, für das Gerät bei Bedarf noch zugewiesen.
 */
export function erstelleMinitest(input: MinitestInput): { worksheetId: number; assignmentId: number | null; neu: boolean } {
  const unit = getUnit(input.unitId);
  if (!unit || unit.status !== "gestartet") throw new Error("Die Einheit läuft nicht mehr.");
  const student = repo.getStudent(unit.student_id);
  if (!student) throw new Error("Schüler nicht gefunden.");
  const zuweisen = (worksheetId: number) => repo.assignWorksheet(worksheetId, student.id, "Minitest", unit.id, "test");

  const da = minitestDerEinheit(unit.id);
  if (da) {
    const assignmentId = da.assignment?.id ?? (input.ziel === "geraet" ? zuweisen(da.worksheet.id) : null);
    return { worksheetId: da.worksheet.id, assignmentId, neu: false };
  }

  const stoff = letzterStoff(student.id, unit.id);
  if (!stoff) throw new Error("Es gibt noch keine frühere Einheit mit Aufgaben am Gerät.");
  const anzahl = (MINITEST_ANZAHL as readonly number[]).includes(input.anzahl ?? 0) ? input.anzahl! : MINITEST_STANDARD;
  const grade = student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade;
  const tasks = minitestAufgaben(stoff, anzahl, grade, input.seed);
  if (!tasks.length) throw new Error("Aus dem Stoff der letzten Einheit ließ sich kein Minitest machen.");
  const first = student.name.split(" ")[0];
  const themen = stoffThemen(stoff);
  const worksheetId = repo.createWorksheet(
    {
      title: `${first} – Minitest: ${themen}`,
      subject: stoff.fach,
      grade,
      school_type: student.school_type,
      klasse: student.klasse,
      topic: themen,
      difficulty: "gemischt",
      task_type: "mixed",
      kind: "ueberpruefung",
      source: "generator",
      skill_ids: [...new Set(tasks.map((t) => t.skillId).filter((x): x is string => Boolean(x)))],
      student_id: student.id,
      teacher_id: input.teacherId,
      status: "freigegeben",
    },
    tasks,
  );
  db().prepare("UPDATE worksheets SET minitest_unit_id = ? WHERE id = ?").run(unit.id, worksheetId);
  return { worksheetId, assignmentId: input.ziel === "geraet" ? zuweisen(worksheetId) : null, neu: true };
}
