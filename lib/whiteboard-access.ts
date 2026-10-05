/** Works out who opens a board: a logged-in teacher (by unit) or a student (by their secret link). */
import { currentTeacher } from "./auth";
import { getStudentByToken } from "./repo";
import { canManageUnit, getUnit } from "./units";
import { ensureBoardForUnit, type Board } from "./whiteboard";
import type { Viewer } from "./whiteboard-routes";

export type Access = { board: Board; viewer: Viewer } | { error: Response };

export async function teacherAccess(unitIdRaw: string): Promise<Access> {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return { error: new Response("Nicht angemeldet.", { status: 401 }) };
  const unit = getUnit(Number(unitIdRaw));
  const board = unit ? ensureBoardForUnit(unit.id) : null;
  if (!unit || !board) return { error: new Response("Nicht gefunden.", { status: 404 }) };
  // colleagues may look at the board; the unit's teacher and the admin may work on it
  return { board, viewer: { role: "lehrer", name: teacher.name, canWrite: canManageUnit(teacher, unit) } };
}

export function studentAccess(token: string, unitIdRaw: string | null): Access {
  const student = getStudentByToken(token);
  const unit = getUnit(Number(unitIdRaw));
  if (!student || !unit || unit.student_id !== student.id) return { error: new Response("Nicht gefunden.", { status: 404 }) };
  const board = ensureBoardForUnit(unit.id);
  if (!board) return { error: new Response("Nicht gefunden.", { status: 404 }) };
  // students write only while the unit runs; afterwards their board is kept and can only be looked at
  return { board, viewer: { role: "schueler", name: student.name.split(" ")[0], canWrite: unit.status === "gestartet" } };
}
