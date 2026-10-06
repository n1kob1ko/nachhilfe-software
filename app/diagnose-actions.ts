"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createDiagnosis, DIAGNOSE_MAX } from "@/lib/diagnose";
import { noteActivity } from "@/lib/learning";
import { deliverIfRunning, pushLive } from "@/lib/live";
import * as repo from "@/lib/repo";
import { schoolType } from "@/lib/school";
import { runningUnitForStudent } from "@/lib/units";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** "Diagnose starten": creates the diagnosis, sends it (in a running unit straight to the tablet) and opens its result page. */
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
  let out: Awaited<ReturnType<typeof createDiagnosis>>;
  try {
    out = await createDiagnosis({
      studentId,
      subject: str(f, "subject"),
      schoolType: type!,
      klasse,
      skillIds,
      topics: f.getAll("topics").map(String).filter(Boolean),
      teacherId: teacher.id,
      useAI: f.get("use_ai") === "1",
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Diagnose konnte nicht erstellt werden.");
  }
  noteActivity(studentId);
  deliverIfRunning(studentId, out.assignmentId);
  const unit = runningUnitForStudent(studentId);
  if (unit) pushLive(unit.id);
  revalidatePath("/", "layout");
  redirect(`/diagnose/${out.assignmentId}${out.aiError ? "?hinweis=ki" : ""}`);
}
