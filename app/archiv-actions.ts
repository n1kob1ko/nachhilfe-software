"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveAssignment, archiveText, archiveWorksheet, restoreAssignment, restoreText, restoreWorksheet, type ArchivErgebnis } from "@/lib/archiv";
import { requireTeacher } from "@/lib/auth";
import { notifyStudent, parseView, pushLive, showOnTablet, unitAssignment, unitText } from "@/lib/live";
import * as repo from "@/lib/repo";
import { getText } from "@/lib/texts";
import { runningUnitForStudent } from "@/lib/units";

/** Back to the page the button was on (only our own paths), with the outcome in the query. */
function zurueck(path: string, r: ArchivErgebnis, ok: string): never {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const [base, hash] = safe.split("#");
  const url = new URL(base, "http://x");
  if (r.ok) url.searchParams.set("archiv", ok);
  else url.searchParams.set("fehler", r.error);
  revalidatePath("/", "layout");
  // "/.//host" turns into "//host" here: never leave the app.
  const pfad = url.pathname.startsWith("//") ? "/" : url.pathname;
  redirect(`${pfad}${url.search}${hash ? `#${hash}` : ""}`);
}

/**
 * The student's tablet or laptop follows at once: what it shows and is now archived goes back to the start,
 * otherwise its list loads again without the archived item. The teacher's live status updates too.
 */
function geraeteNachziehen(studentIds: number[]) {
  for (const id of new Set(studentIds)) {
    const unit = runningUnitForStudent(id);
    if (!unit) continue;
    const v = parseView(unit.device_view);
    const weg = (v.kind === "aufgabe" && !unitAssignment(unit.id, v.assignmentId)) || (v.kind === "text" && !unitText(unit, v.textId));
    if (weg) showOnTablet(unit, { kind: "start" });
    else {
      notifyStudent(unit, "archiv");
      pushLive(unit.id);
    }
  }
}

const studentsOf = (worksheetId: number) => repo.listAssignmentsForWorksheet(worksheetId).map((a) => a.student_id);

export async function archiveWorksheetAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = archiveWorksheet(id, t);
  if (r.ok) geraeteNachziehen(studentsOf(id));
  zurueck(back, r, "archiviert");
}

export async function restoreWorksheetAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = restoreWorksheet(id, t);
  if (r.ok) geraeteNachziehen(studentsOf(id));
  zurueck(back, r, "wiederhergestellt");
}

export async function archiveAssignmentAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = archiveAssignment(id, t);
  const a = repo.getAssignment(id);
  if (r.ok && a) geraeteNachziehen([a.student_id]);
  zurueck(back, r, "archiviert");
}

export async function restoreAssignmentAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = restoreAssignment(id, t);
  const a = repo.getAssignment(id);
  if (r.ok && a) geraeteNachziehen([a.student_id]);
  zurueck(back, r, "wiederhergestellt");
}

export async function archiveTextAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = archiveText(id, t);
  const x = getText(id);
  if (r.ok && x) geraeteNachziehen([x.student_id]);
  zurueck(back, r, "archiviert");
}

export async function restoreTextAction(id: number, back: string) {
  const t = await requireTeacher();
  const r = restoreText(id, t);
  const x = getText(id);
  if (r.ok && x) geraeteNachziehen([x.student_id]);
  zurueck(back, r, "wiederhergestellt");
}
