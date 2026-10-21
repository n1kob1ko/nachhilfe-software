import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { BLATT_TITEL, blattLesbar, liesBlatt, MAX_SEITEN } from "@/lib/blatt-einlesen";
import { getMaterial, hatDatei, MAX_UPLOAD_BYTES, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, materials?: number[]) => Response.json({ error, materials }, { status });

/**
 * Gelöstes Blatt einlesen (lib/blatt-einlesen.ts): the pages come in and are stored as the student's material; the
 * KI reads them and the answer is the preview. A second try sends the stored pages' ids instead of the files.
 * Nothing goes into the profile here: the teacher takes it over after checking the preview. A route handler, not a
 * server action, because photos can be larger than an action's body limit; outside the proxy for the same reason,
 * so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_SEITEN * MAX_UPLOAD_BYTES + 1024 * 1024) return fail("Die Fotos sind zu groß.", 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Fotos kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const student = repo.getStudent(Number(form.get("schueler")));
  if (!student) return fail("Diesen Schüler gibt es nicht.", 404);
  const fach = String(form.get("fach") ?? "").trim();
  if (!fach) return fail("Bitte das Fach wählen.");
  if (form.get("keine_namen") !== "1") return fail("Bitte bestätigen, dass auf den Seiten kein Name steht.");
  const geht = blattLesbar();
  if (!geht.ok) return fail(geht.grund);

  // schon gespeicherte Seiten (zweiter Versuch), dann neue
  const materials = String(form.get("materialien") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => {
      const m = id ? getMaterial(id) : null;
      return m && hatDatei(m) && (m.student_id == null || m.student_id === student.id);
    });
  const files = form.getAll("seite").filter((f): f is File => f instanceof File && f.size > 0);
  if (materials.length + files.length > MAX_SEITEN) return fail(`Höchstens ${MAX_SEITEN} Seiten auf einmal.`);
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)) return fail("Bitte Fotos (JPG, PNG, WebP) oder ein PDF wählen.", 400, materials);
    try {
      materials.push(saveUpload({ name: file.name, data }, { title: BLATT_TITEL, subject: fach, studentId: student.id, teacherId: teacher.id }).id);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Eine Seite konnte nicht gespeichert werden.", 400, materials);
    }
  }
  if (files.length) revalidatePath("/mehr/material", "layout");
  if (!materials.length) return fail("Bitte die Seiten fotografieren oder auswählen.");

  try {
    const vorschlag = await liesBlatt({ materialIds: materials, studentId: student.id, teacherId: teacher.id, fach });
    return Response.json({ materials, vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte das Blatt nicht lesen.", 400, materials);
  }
}
