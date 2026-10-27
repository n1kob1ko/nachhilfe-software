/**
 * **Material passt** (Phase A, offener Punkt 1): eine Übung aus dem Bestand geht im Unterricht nur mit Aufgaben der Fähigkeit
 * des Schritts hinaus. Eine gemischte Übung („Einheit: Past Simple“ mit „Write the 3rd form“ zu Irregular verbs) wird auf die
 * passenden Aufgaben gekürzt, wenn mindestens drei bleiben; sonst kommt die nächste Quelle (andere Übung, Bibliothek,
 * Generator). Eine Übung, die für einen anderen Schüler gemacht wurde, kommt nur, wenn sie allgemeines Material ist.
 *
 * Woran die App „allgemein“ erkennt (es gibt kein eigenes Feld): ein Eintrag der Aufgabenbibliothek, eine Übung für diesen
 * Schüler, oder eine Übung ohne Schüler, die noch keinem anderen Schüler zugewiesen wurde. Was davon nicht sicher allgemein
 * ist, bleibt weg: lieber Bibliothek und Generator als das Blatt eines anderen Schülers.
 */
import { db } from "./db";
import * as repo from "./repo";
import type { TaskDraft } from "./tasks";

/** So viele Aufgaben der Fähigkeit muss eine gemischte Übung mindestens haben, damit sie gekürzt hinausgeht. */
export const MIN_PASSEND = 3;

type MitSkill = Pick<TaskDraft, "skillId" | "skillIds">;

/**
 * Übt die Aufgabe die Fähigkeit des Schritts? Ihre Fähigkeit oder eine ihrer weiteren (`task_skills`) ist genau diese oder
 * eine Teilfähigkeit davon. Eine Aufgabe ohne Fähigkeit passt nicht (man weiß nicht, was sie übt).
 */
export function passtZurFaehigkeit(t: MitSkill, skillId: string, oberVon: (id: string) => string | null): boolean {
  return [t.skillId, ...(t.skillIds ?? [])].some((id) => Boolean(id) && (id === skillId || oberVon(id!) === skillId));
}

export type Auswahl<T> = { aufgaben: T[]; gekuerzt: boolean };

/** Die Aufgaben einer Übung zur Fähigkeit: alle, wenn alle passen; gekürzt, wenn mindestens drei passen; sonst null. */
export function auswahlZur<T extends MitSkill>(aufgaben: T[], skillId: string, oberVon: (id: string) => string | null): Auswahl<T> | null {
  const passend = aufgaben.filter((t) => passtZurFaehigkeit(t, skillId, oberVon));
  if (passend.length && passend.length === aufgaben.length) return { aufgaben: passend, gekuerzt: false };
  return passend.length >= MIN_PASSEND ? { aufgaben: passend, gekuerzt: true } : null;
}

/** Die Oberfähigkeit, aus dem Lehrplan der App. */
export const oberfaehigkeit = (id: string): string | null => repo.getSkill(id)?.parent_id ?? null;

/**
 * Darf die Übung für diesen Schüler wieder hinaus? Bibliothek, eine Übung für ihn, oder eine ohne Schüler, die keinem anderen
 * zugewiesen ist. Ein Blatt eines anderen Schülers nicht.
 */
export function fuerSchuelerNutzbar(ws: Pick<repo.Worksheet, "id" | "kind" | "student_id">, studentId: number): boolean {
  if (ws.kind === "bibliothek" || ws.student_id === studentId) return true;
  if (ws.student_id !== null) return false;
  return !db().prepare("SELECT 1 FROM assignments WHERE worksheet_id = ? AND student_id <> ? LIMIT 1").get(ws.id, studentId);
}

/** Dieselbe Regel als SQL für eine Abfrage über Übungen `w` (Parameter: zweimal die Id des Schülers). */
export const NUTZBAR_SQL = "(w.kind = 'bibliothek' OR w.student_id = ? OR (w.student_id IS NULL AND NOT EXISTS (SELECT 1 FROM assignments x WHERE x.worksheet_id = w.id AND x.student_id <> ?)))";

/**
 * Eine Übung aus dem Bestand für einen Schritt mit Fähigkeit: freigegeben, nicht archiviert, keine Probeschularbeit, für den
 * Schüler nutzbar, und mit Aufgaben dieser Fähigkeit (alle oder gekürzt). Ohne Fähigkeit (ein alter Plan) die ganze Übung.
 */
export function bestandZur(ws: repo.Worksheet | null, skillId: string | null, studentId: number): (Auswahl<repo.Task> & { blatt: repo.Worksheet }) | null {
  if (!ws || ws.status !== "freigegeben" || ws.archived_at || ws.kind === "bibliothek" || ws.probe_test_id || !fuerSchuelerNutzbar(ws, studentId)) return null;
  const aufgaben = repo.listTasks(ws.id);
  if (!aufgaben.length) return null;
  if (!skillId) return { blatt: ws, aufgaben, gekuerzt: false };
  const a = auswahlZur(aufgaben, skillId, oberfaehigkeit);
  return a ? { ...a, blatt: ws } : null;
}

/** Eine gespeicherte Aufgabe als Entwurf für eine neue Übung (ohne Id, Übung, Platz und Stufe; die Herkunft bleibt). */
export function alsEntwurf(t: repo.Task): TaskDraft {
  const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = t;
  void _i, void _w, void _p, void _l;
  return draft;
}
