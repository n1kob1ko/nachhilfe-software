import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { getMaterial, hatDatei, MAX_UPLOAD_BYTES, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";
import { liesStoffzettel, STOFFZETTEL_TITEL, stoffzettelLesbar } from "@/lib/stoffzettel";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, material?: number) => Response.json({ error, material }, { status });

/**
 * Stoffzettel einer Schularbeit (lib/stoffzettel.ts): the photo or PDF comes in and is stored as the student's
 * material; with `lesen=1` the KI reads it and the answer is the suggestion for the form. A second try sends the
 * stored file's id instead of the file. Nothing is entered here: the teacher saves the Schularbeit with the form.
 * A route handler, not a server action, because a photo can be larger than an action's body limit; outside the
 * proxy for the same reason, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) return fail(`Die Datei ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Datei kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const student = repo.getStudent(Number(form.get("schueler")));
  if (!student) return fail("Diesen Schüler gibt es nicht.", 404);
  const lesen = form.get("lesen") === "1";
  if (lesen) {
    if (form.get("keine_namen") !== "1") return fail("Bitte bestätigen, dass auf dem Zettel kein Name steht.");
    const geht = stoffzettelLesbar();
    if (!geht.ok) return fail(geht.grund);
  }

  let materialId = Number(form.get("material")) || 0;
  const file = form.get("datei");
  if (file instanceof File && file.size) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)) return fail("Bitte ein Foto (JPG, PNG, WebP) oder ein PDF wählen.");
    try {
      materialId = saveUpload({ name: file.name, data }, { title: STOFFZETTEL_TITEL, subject: String(form.get("fach") ?? ""), studentId: student.id, teacherId: teacher.id }).id;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Der Zettel konnte nicht gespeichert werden.");
    }
    revalidatePath("/mehr/material", "layout");
  } else {
    const m = materialId ? getMaterial(materialId) : null;
    if (!m || !hatDatei(m)) return fail("Bitte den Zettel fotografieren oder auswählen.");
  }
  if (!lesen) return Response.json({ material: materialId });

  try {
    const vorschlag = await liesStoffzettel({ materialId, studentId: student.id, teacherId: teacher.id, heute: dayOf(new Date()) });
    return Response.json({ material: materialId, vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte den Zettel nicht lesen.", 400, materialId);
  }
}
