/**
 * **Empfehlung und Diagnose: KI-Aufgaben nur mit Vorschau** (E0; niko: nichts von der KI geht ungeprüft an den Schüler, „Keine
 * Hausübung darf ohne ausreichende fachliche Prüfung ungeprüft veröffentlicht werden.“). „Direkt an … senden“ bei einer Empfehlung
 * (Profil, Ergebnis einer Diagnose) und „Diagnose starten“ schickten Aufgaben der KI bisher sofort an den Schüler. Jetzt liegen sie
 * wie im Unterricht (lib/ki-nachschub.ts) als „neu erstellt, ungeprüft“ in `einheit_ki_aufgaben`, hier ohne Einheit (`unit_id`
 * NULL, mit `student_id`), und gehen erst mit „Senden“ an den Schüler, genau so, wie die Vorschau sie zeigt.
 *
 * - Aufgaben ohne KI (Bibliothek, Generator, eigene Vokabeln, Schreibaufträge) gehen wie bisher gleich.
 * - Ein Blatt mit beiden (Diagnose) wartet ganz auf die Vorschau; die Aufgaben der KI sind darin markiert.
 * - Die Kosten stehen vorher auf dem Knopf (dieselbe Schätzung wie im Unterricht); Monatsbudget und Grenze des Schülers gelten.
 * - Die KI-Anfrage trägt den Schüler (`ai_calls.student_id`), in einer laufenden Einheit auch die Einheit (lib/ai/router.ts).
 * - Geht die KI nicht, steht der Grund da und nichts ist gesendet; ohne KI geht es nur, wenn die Lehrkraft es wählt.
 * - KI aus: alles wie bisher, nur Bibliothek und Generator.
 */
import { budget, isLocalModel, routeFor } from "./ai/config";
import { generateWithAI, type AIGenerateRequest } from "./ai/features";
import { kiGrund, protokolliere } from "./ai/grund";
import { aiEnabled, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { RECOMMENDATION_NOTE } from "./analysis";
import { ohneAusgeblendete } from "./bewertungen";
import { levelOf } from "./curriculum";
import { db } from "./db";
import { completeDiagnosis, diagnosisDraft, type DiagnosisInput } from "./diagnose";
import { nachschub, schaetzungUsd, vorschauAufgaben, type Nachschub, type NachschubZiel, type VorschauBlatt } from "./ki-nachschub";
import { oberfaehigkeit, passtZurFaehigkeit } from "./material-passt";
import { findNextStep, type NextStep } from "./recommend";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { buildWorksheet, fragtKi, kiAnfrage, type BuildRequest } from "./service";
import type { KiTor } from "./steuerung-regeln";
import type { TaskDraft } from "./tasks";
import { runningUnitForStudent } from "./units";

export const schluesselEmpfehlung = (key: string) => `empfehlung:${key}`;
export const schluesselDiagnose = (subject: string, skillIds: string[]) => `diagnose:${subject}:${[...new Set(skillIds)].sort().join(",")}`;

/** Eine Anfrage, die so lange „läuft“, ist abgebrochen (Server neu gestartet): sie hält nichts mehr auf. */
const HAENGT_MIN = 10;

// ---------- darf die KI, was kostet es ----------

/** „ca. 3 Cent“ für `anzahl` Aufgaben: dieselbe Schätzung wie „Neue Aufgaben erstellen“ im Unterricht (lib/ki-nachschub.ts). */
export function kostenOhneEinheit(anzahl: number): string {
  const route = routeFor("aufgaben");
  if (route.provider === "manual") return "kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "kostet nichts (lokales Modell)";
  return `ca. ${Math.max(1, Math.round((schaetzungUsd(anzahl) / budget().usdPerEur) * 100))} Cent`;
}

/** Darf die KI für diesen Schüler jetzt Aufgaben erstellen (ohne Einheit, Funktion „aufgaben“ wie bisher)? Mit Kosten oder dem Grund. */
export function kiTorOhneEinheit(studentId: number, anzahl: number): KiTor {
  if (!aiEnabled("aufgaben")) return { erlaubt: false, grund: "Die KI ist aus." };
  if (budgetUsedUp("aufgaben")) return { erlaubt: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (schuelerGestoppt("aufgaben", studentId)) return { erlaubt: false, grund: grenzeErreichtText() };
  return { erlaubt: true, kosten: kostenOhneEinheit(anzahl) };
}

// ---------- Vorschau ohne Einheit ----------

/** Der neueste Eintrag zu diesem Schlüssel beim Schüler (ohne Einheit), oder null. */
export function vorschauZu(studentId: number, schluessel: string): Nachschub | null {
  const id = db().prepare("SELECT id FROM einheit_ki_aufgaben WHERE unit_id IS NULL AND student_id = ? AND schluessel = ? ORDER BY id DESC LIMIT 1").pluck().get(studentId, schluessel) as number | undefined;
  return id ? nachschub(id) : null;
}

/** Läuft die Anfrage wirklich noch (nicht älter als HAENGT_MIN Minuten)? */
export function laeuftNoch(n: Nachschub, now = Date.now()): boolean {
  return n.status === "laeuft" && now - Date.parse(`${n.createdAt.replace(" ", "T")}Z`) < HAENGT_MIN * 60_000;
}

/** Was beim Schüler noch auf die Lehrkraft wartet (bereit) oder gerade entsteht, älteste zuerst. */
export function offeneVorschauen(studentId: number): Nachschub[] {
  const ids = db().prepare("SELECT id FROM einheit_ki_aufgaben WHERE unit_id IS NULL AND student_id = ? AND status IN ('laeuft', 'bereit') ORDER BY id").pluck().all(studentId) as number[];
  return ids.map((id) => nachschub(id)!).filter((n) => n.status === "bereit" || laeuftNoch(n));
}

export type VorschauAuftrag = {
  schluessel: string;
  ziel: NachschubZiel & { blatt: VorschauBlatt };
  anfrage: AIGenerateRequest;
  trigger: string;
  /** aus den brauchbaren Aufgaben der KI: die neuen, die ohne KI und die Reihenfolge; keine neuen = nichts Passendes */
  fertig: (ki: TaskDraft[]) => { aufgaben: TaskDraft[]; dazu: TaskDraft[]; reihenfolge?: number[] };
};

/**
 * Fragt die KI und legt die Antwort als Vorschau ab; an den Schüler geht nichts. Läuft schon eine Anfrage zu diesem Schlüssel oder
 * liegt eine Vorschau bereit, kommt sie zurück, ohne neu zu fragen (doppeltes Tippen). Aufgaben, die die App zum Prüfen markiert oder
 * die Lehrkräfte ausgeblendet haben, fallen weg. Geht es nicht, steht der Grund im Eintrag (status „fehler“).
 */
export async function erstelleVorschau(studentId: number, a: VorschauAuftrag, teacherId: number | null): Promise<Nachschub | { fehler: string }> {
  const schon = vorschauZu(studentId, a.schluessel);
  if (schon && (schon.status === "bereit" || laeuftNoch(schon))) return schon;
  const tor = kiTorOhneEinheit(studentId, a.ziel.anzahl);
  if (!tor.erlaubt) return { fehler: tor.grund };
  // check and insert without waiting in between: a second tap finds this row
  const id = Number(
    db()
      .prepare("INSERT INTO einheit_ki_aufgaben (unit_id, student_id, schluessel, ziel, automatisch, status, teacher_id) VALUES (NULL, ?, ?, ?, 0, 'laeuft', ?)")
      .run(studentId, a.schluessel, JSON.stringify(a.ziel), teacherId).lastInsertRowid,
  );
  const vorher = db().prepare("SELECT COALESCE(MAX(id), 0) FROM ai_calls").pluck().get() as number;
  let ki: TaskDraft[] = [];
  let problem = "";
  try {
    ki = (await generateWithAI(a.anfrage, { teacherId, studentId, trigger: a.trigger })) ?? [];
  } catch (e) {
    protokolliere("Vorschau neuer Aufgaben", e);
    problem = kiGrund(e);
  }
  const call = db().prepare("SELECT id FROM ai_calls WHERE id > ? AND fn = 'aufgaben' AND student_id = ? ORDER BY id DESC LIMIT 1").pluck().get(vorher, studentId) as number | undefined;
  const gut = ohneAusgeblendete(ki).filter((t) => !t.data.pruefen?.length);
  const f = gut.length ? a.fertig(gut) : null;
  if (f?.aufgaben.length) {
    const ziel = { ...a.ziel, blatt: { ...a.ziel.blatt, reihenfolge: f.reihenfolge } };
    db().prepare("UPDATE einheit_ki_aufgaben SET status = 'bereit', aufgaben = ?, dazu = ?, ziel = ?, call_id = ? WHERE id = ?").run(JSON.stringify(f.aufgaben), JSON.stringify(f.dazu), JSON.stringify(ziel), call ?? null, id);
  } else db().prepare("UPDATE einheit_ki_aufgaben SET status = 'fehler', fehler = ?, call_id = ? WHERE id = ?").run((problem || "Die KI hat keine passenden Aufgaben geliefert.").slice(0, 300), call ?? null, id);
  return nachschub(id)!;
}

/**
 * „Senden“: genau die Aufgaben der Vorschau, in ihrer Reihenfolge, als eine Übung an den Schüler (in einer laufenden Einheit zu ihr).
 * Nur einmal: ein zweites Tippen findet sie schon gesendet.
 */
export function sendeVorschau(studentId: number, id: number, teacherId: number | null): { worksheetId: number; assignmentId: number; art: NachschubZiel["art"] } | { fehler: string } {
  const n = nachschub(id);
  const b = n?.ziel.blatt;
  if (!n || n.unitId !== null || n.studentId !== studentId || !b) return { fehler: "Diese Aufgaben gehören nicht zu diesem Schüler." };
  if (n.status !== "bereit") return { fehler: n.status === "gesendet" ? "Diese Aufgaben sind schon gesendet." : "Diese Aufgaben gibt es nicht mehr." };
  const student = repo.getStudent(studentId);
  if (!student) return { fehler: "Schüler nicht gefunden." };
  let out: { worksheetId: number; assignmentId: number } | null = null;
  db().transaction(() => {
    // a double tap sends once
    if (!db().prepare("UPDATE einheit_ki_aufgaben SET status = 'gesendet' WHERE id = ? AND status = 'bereit'").run(id).changes) return;
    const worksheetId = repo.createWorksheet(
      {
        title: b.titel,
        subject: b.subject,
        grade: schulstufe(b.schoolType, b.klasse),
        school_type: b.schoolType,
        klasse: b.klasse,
        topic: b.topic,
        difficulty: b.difficulty,
        task_type: b.taskType,
        kind: b.kind,
        source: "ki",
        skill_ids: b.skillIds,
        ...(b.fuerSchueler ? { student_id: studentId, teacher_id: teacherId, status: "freigegeben" } : {}),
      },
      vorschauAufgaben(n).map((x) => x.t),
    );
    const assignmentId = repo.assignWorksheet(worksheetId, studentId, b.notiz, runningUnitForStudent(studentId)?.id ?? null);
    db().prepare("UPDATE einheit_ki_aufgaben SET worksheet_id = ? WHERE id = ?").run(worksheetId, id);
    out = { worksheetId, assignmentId };
  })();
  return out ? { ...(out as { worksheetId: number; assignmentId: number }), art: n.ziel.art } : { fehler: "Diese Aufgaben sind schon gesendet." };
}

/** „Verwerfen“: die Vorschau weg, nichts geht an den Schüler. */
export function verwirfVorschau(studentId: number, id: number): boolean {
  return db().prepare("UPDATE einheit_ki_aufgaben SET status = 'verworfen' WHERE id = ? AND student_id = ? AND unit_id IS NULL AND status IN ('bereit', 'fehler')").run(id, studentId).changes > 0;
}

/** Ein früherer Fehler zu diesem Schlüssel ist erledigt (die Lehrkraft hat ohne KI gesendet): sein Grund steht nicht mehr da. */
function fehlerErledigt(studentId: number, schluessel: string) {
  db().prepare("UPDATE einheit_ki_aufgaben SET status = 'verworfen' WHERE unit_id IS NULL AND student_id = ? AND schluessel = ? AND status = 'fehler'").run(studentId, schluessel);
}

// ---------- Empfehlung ----------

/** Die Übung zu einer Empfehlung, wie „Direkt an … senden“ sie immer gebaut hat. */
export function empfehlungAnfrage(student: repo.Student, rec: NextStep, teacherId: number | null): BuildRequest {
  return {
    subject: rec.skill.subject,
    schoolType: student.school_type,
    klasse: student.klasse ?? 1,
    skillIds: [rec.skill.id],
    difficulty: rec.difficulty,
    count: rec.count,
    taskType: "mixed",
    kind: rec.kind,
    title: rec.kind === "ueberpruefung" ? `Überprüfung: ${rec.skill.name}` : rec.rule === 6 ? `Wiederholung: ${rec.skill.name}` : `Training: ${rec.skill.area} › ${rec.skill.name}`,
    focusNote: rec.focusNote,
    teacherId,
    studentId: student.id,
  };
}

export const empfehlungNotiz = (rec: NextStep) => `${RECOMMENDATION_NOTE} (${rec.skill.area} › ${rec.skill.name}): ${rec.reason}`;

/**
 * Wie „Direkt an … senden“ jetzt geht: mit KI (`ki`, Kosten vorher) über die Vorschau, sonst ohne KI gleich wie bisher. `grund`: warum
 * ohne KI, obwohl sie an ist (Monatsbudget, Grenze des Schülers); null, wenn die KI aus ist oder hier nie gefragt wird.
 */
export function empfehlungWeg(studentId: number, rec: Pick<NextStep, "skill" | "count">): { ki: true; kosten: string } | { ki: false; grund: string | null } {
  if (!fragtKi([rec.skill.id])) return { ki: false, grund: null };
  const tor = kiTorOhneEinheit(studentId, rec.count);
  if (!tor.erlaubt) return { ki: false, grund: tor.grund === "Die KI ist aus." ? null : tor.grund };
  return { ki: true, kosten: tor.kosten };
}

/**
 * „Direkt an … senden“ bei einer Empfehlung. Mit KI: nur die Vorschau (`vorschau`), gesendet wird mit „Senden“. Ohne KI (aus, gesperrt,
 * eigene Vokabeln, Schreibauftrag, oder die Lehrkraft wählt „Ohne KI senden“): Generator wie bisher, gleich zugewiesen.
 */
export async function empfehlungUebernehmen(
  studentId: number,
  key: string,
  o: { teacherId: number | null; today: string; ohneKi?: boolean },
): Promise<{ worksheetId: number; assignmentId: number } | { vorschau: Nachschub } | { fehler: string }> {
  const student = repo.getStudent(studentId);
  const rec = student ? findNextStep(studentId, key, { today: o.today }) : null;
  if (!student || !rec) return { fehler: "Diese Empfehlung gilt nicht mehr, es wurde nichts gesendet. Die Liste ist jetzt aktuell." };
  const req = empfehlungAnfrage(student, rec, o.teacherId);
  const schluessel = schluesselEmpfehlung(key);
  if (!o.ohneKi && empfehlungWeg(studentId, rec).ki) {
    const skill = rec.skill;
    const r = await erstelleVorschau(
      studentId,
      {
        schluessel,
        ziel: {
          art: "empfehlung",
          skillId: skill.id,
          level: levelOf(rec.difficulty),
          fokus: rec.focusNote ?? null,
          kontrolle: false,
          anzahl: rec.count,
          blatt: { titel: req.title!, subject: skill.subject, schoolType: req.schoolType, klasse: req.klasse, topic: skill.area, difficulty: rec.difficulty, taskType: "mixed", kind: rec.kind, skillIds: [skill.id], notiz: empfehlungNotiz(rec), fuerSchueler: false },
        },
        anfrage: kiAnfrage(req, [skill]),
        trigger: "empfehlung",
        fertig: (ki) => ({ aufgaben: ki.map((t) => (t.skillId ? t : { ...t, skillId: skill.id })).filter((t) => passtZurFaehigkeit(t, skill.id, oberfaehigkeit)).slice(0, rec.count), dazu: [] }),
      },
      o.teacherId,
    );
    return "fehler" in r ? r : { vorschau: r };
  }
  const result = await buildWorksheet({ ...req, useAI: false });
  const assignmentId = repo.assignWorksheet(result.id, studentId, empfehlungNotiz(rec), runningUnitForStudent(studentId)?.id ?? null);
  fehlerErledigt(studentId, schluessel);
  return { worksheetId: result.id, assignmentId };
}

// ---------- Diagnose ----------

/**
 * „Diagnose starten“ mit KI: Bibliothek zuerst, die KI nur für Fähigkeiten ohne eigenen Generator, der Rest aus den Generatoren; das
 * ganze Blatt kommt als Vorschau (die neuen Aufgaben markiert), in der Reihenfolge der Diagnose. null: hier braucht es keine KI (oder
 * sie ist aus, oder nicht gewählt), dann wie bisher `createDiagnosis`.
 */
export async function diagnoseVorschau(input: DiagnosisInput): Promise<{ vorschau: Nachschub } | { fehler: string } | null> {
  if (!(input.useAI ?? true) || !aiEnabled("aufgaben")) return null;
  const d = diagnosisDraft(input);
  if (!d.forAI.length) return null;
  const r = await erstelleVorschau(
    d.student.id,
    {
      schluessel: schluesselDiagnose(input.subject, input.skillIds),
      ziel: { art: "diagnose", skillId: d.forAI[0].item.skillId, level: 3, fokus: null, kontrolle: false, anzahl: d.forAI.length, blatt: d.sheet },
      anfrage: {
        subject: input.subject,
        level: klassenLabel(input.schoolType, input.klasse),
        skills: d.forAI.map(({ item }) => ({ id: item.skillId, name: d.all.get(item.skillId)!.name, area: d.all.get(item.skillId)!.area, difficulty: item.difficulty })),
        count: d.forAI.length,
        categories: [],
        focusNote: "Kurze Diagnose: je Fähigkeit genau eine Aufgabe in der angegebenen Schwierigkeit, eindeutig auswertbar, möglichst kein Freitext.",
      },
      trigger: "diagnose",
      fertig: (ki) => {
        const drafts = [...d.drafts];
        const vonKi = new Set<number>();
        for (const t of ki) {
          const slot = d.forAI.find(({ item, i }) => !drafts[i] && item.skillId === t.skillId);
          if (!slot) continue;
          drafts[slot.i] = { ...t, difficulty: slot.item.difficulty };
          vonKi.add(slot.i);
        }
        const alle = completeDiagnosis(input, d, drafts).map((t, i) => ({ t, i })).filter((x): x is { t: TaskDraft; i: number } => x.t !== null);
        const dazu = alle.filter((x) => !vonKi.has(x.i));
        const neu = alle.filter((x) => vonKi.has(x.i));
        const stelle = new Map([...dazu, ...neu].map((x, k) => [x.i, k]));
        return { aufgaben: neu.map((x) => x.t), dazu: dazu.map((x) => x.t), reihenfolge: alle.map((x) => stelle.get(x.i)!) };
      },
    },
    input.teacherId,
  );
  return "fehler" in r ? r : { vorschau: r };
}

