/**
 * Übungen aufs Whiteboard der Einheit (niko 2026-11-03: Lernkontrolle aufs Tablet gesendet, dann aufs Whiteboard
 * gewechselt; dort war nur Aufgabe 1, und jedes weitere Senden brachte wieder nur Aufgabe 1: „Aufgabe 1 / 1 / 1“).
 *
 * - Eine Übung kommt immer mit allen Aufgaben aufs Whiteboard, die dort noch nicht stehen; was schon da ist, kommt
 *   nicht ein zweites Mal.
 * - Zeigt das Tablet gerade das Whiteboard, landet eine neu gesendete Übung dort und das Tablet bleibt am Whiteboard.
 */
import { activeLaptop } from "./laptop";
import { parseView, showOnTablet, type Delivery } from "./live";
import * as repo from "./repo";
import { runningUnitForStudent, type UnitView } from "./units";
import { ensureBoardForUnit, listPages, pageElements, pendingInserts, queueInsert, taskTag } from "./whiteboard";
import { boardTaskForStudent } from "./whiteboard-content";

/** Die Aufgaben (task ids), die schon auf einer Seite des Whiteboards stehen oder gleich gezeichnet werden. */
export function aufgabenAmWhiteboard(boardId: number): Set<number> {
  const ids = new Set<number>();
  for (const p of listPages(boardId))
    for (const e of pageElements(p.id)) {
      if (e.isDeleted) continue;
      const tag = taskTag(e.customData);
      if (tag?.task) ids.add(tag.task);
    }
  for (const ins of pendingInserts(boardId)) if (ins.payload.kind === "tasks") for (const t of ins.payload.tasks) if (t.taskId) ids.add(t.taskId);
  return ids;
}

/** Bringt alle Aufgaben dieser Übung aufs Whiteboard der Einheit, die dort noch fehlen. Gibt zurück, wie viele dazukamen. */
export function uebungAufsWhiteboard(unitId: number, assignmentId: number): number {
  const a = repo.getAssignment(assignmentId);
  const board = ensureBoardForUnit(unitId);
  if (!a || !board) return 0;
  const da = aufgabenAmWhiteboard(board.id);
  const neu = repo.listTasks(a.worksheet_id).filter((t) => !da.has(t.id));
  if (!neu.length) return 0;
  queueInsert(board.id, { kind: "tasks", title: repo.getWorksheet(a.worksheet_id)?.title ?? "Aufgaben", worksheetId: a.worksheet_id, tasks: neu.map(boardTaskForStudent) });
  return neu.length;
}

/** Ob das Gerät der Einheit gerade das Whiteboard zeigt. */
export const zeigtWhiteboard = (unit: Pick<UnitView, "device_view">) => parseView(unit.device_view).kind === "tafel";

/**
 * Eine eben gesendete Übung aufs Gerät der Einheit: wie bisher in der Aufgabenansicht, außer das Tablet zeigt gerade
 * das Whiteboard. Dann kommen ihre Aufgaben aufs Whiteboard und das Tablet bleibt dort.
 */
export function zeigeUebung(unit: UnitView, assignmentId: number): Delivery {
  // der Laptop hat kein Whiteboard
  if (unit.status === "gestartet" && zeigtWhiteboard(unit) && !activeLaptop(unit.id)) {
    uebungAufsWhiteboard(unit.id, assignmentId);
    return showOnTablet(unit, { kind: "tafel" });
  }
  return showOnTablet(unit, { kind: "aufgabe", assignmentId });
}

/** Etwas wurde einem Schüler auf dem klassischen Weg gesendet: läuft eine Einheit mit ihm, kommt es auch auf ihr Gerät. */
export function deliverIfRunning(studentId: number, assignmentId: number | undefined): Delivery | null {
  const unit = runningUnitForStudent(studentId);
  return unit && assignmentId ? zeigeUebung(unit, assignmentId) : null;
}
