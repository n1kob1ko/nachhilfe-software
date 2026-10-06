/** Whiteboard access for a tablet: only the board of its teacher's running unit. */
import { deviceContext } from "./device-context";
import type { Access } from "./whiteboard-access";
import { ensureBoardForUnit } from "./whiteboard";

export async function deviceBoardAccess(unitIdRaw: string | null): Promise<Access> {
  const ctx = await deviceContext();
  if (!ctx) return { error: new Response("Nicht verbunden.", { status: 401 }) };
  // the unit in the address must be the one running now: an old board never reconnects to a new student
  if (!ctx.unit || !ctx.student || ctx.unit.id !== Number(unitIdRaw)) return { error: new Response("Nicht gefunden.", { status: 404 }) };
  const board = ensureBoardForUnit(ctx.unit.id);
  if (!board) return { error: new Response("Nicht gefunden.", { status: 404 }) };
  return { board, viewer: { role: "schueler", name: ctx.student.name.split(" ")[0], canWrite: true } };
}
