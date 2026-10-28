"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createDiagnosis, DIAGNOSE_MAX } from "@/lib/diagnose";
import { diagnoseVorschau } from "@/lib/ki-vorschau";
import { noteActivity } from "@/lib/learning";
import { deliverIfRunning, pushLive } from "@/lib/live";
import * as repo from "@/lib/repo";
import { schoolType } from "@/lib/school";
import { runningUnitForStudent } from "@/lib/units";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * "Diagnose starten": creates the diagnosis, sends it (in a running unit straight to the tablet) and opens its result page.
 * With new tasks of the KI the whole sheet comes as a preview first (lib/ki-vorschau.ts); it goes out with „Senden“ there.
 */
export async function startDiagnosisAction(f: FormData) {
  const teacher = await requireTeacher();
  const studentId = Number(f.get("student_id"));
  const back = str(f, "back") || "/diagnose";
  const fail = (msg: string) => redirect(`${back}${back.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(msg)}`);
  if (!repo.getStudent(studentId)) fail("Schüler nicht gefunden.");
  const type = schoolType(str(f, "school_type"))?.name;
  const klasse = Number(f.get("klasse"));
  if (!type || !klasse) fail("Bitte Schulart und Klasse wählen.");
  const skillIds = f.getAll("skill_ids").map(String).filter(Boolean);
  if (!skillIds.length) fail("Bitte mindestens eine Fähigkeit wählen.");
  if (skillIds.length > DIAGNOSE_MAX) fail(`Höchstens ${DIAGNOSE_MAX} Fähigkeiten, damit die Diagnose kurz bleibt.`);
  const input = {
    studentId,
    subject: str(f, "subject"),
    schoolType: type!,
    klasse,
    skillIds,
    topics: f.getAll("topics").map(String).filter(Boolean),
    teacherId: teacher.id,
    useAI: f.get("use_ai") === "1",
  };
  let out: Awaited<ReturnType<typeof createDiagnosis>>;
  let vorschau: Awaited<ReturnType<typeof diagnoseVorschau>> = null;
  try {
    vorschau = await diagnoseVorschau(input);
    if (!vorschau) out = await createDiagnosis(input);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Diagnose konnte nicht erstellt werden.");
  }
  if (vorschau) {
    // nothing is sent yet: the preview waits on the diagnosis page; a failure says why
    if ("fehler" in vorschau) fail(`Es wurde nichts gesendet: ${vorschau.fehler}`);
    else if (vorschau.vorschau.status === "fehler") fail(`Die KI hat gerade keine Aufgaben erstellt: ${vorschau.vorschau.problem} Es wurde nichts gesendet. Ohne den Haken bei Claude geht es ohne KI.`);
    else redirect(`${back}${back.includes("?") ? "&" : "?"}vorschau=${vorschau.vorschau.id}`);
  }
  noteActivity(studentId);
  deliverIfRunning(studentId, out!.assignmentId);
  const unit = runningUnitForStudent(studentId);
  if (unit) pushLive(unit.id);
  revalidatePath("/", "layout");
  redirect(`/diagnose/${out!.assignmentId}`);
}
