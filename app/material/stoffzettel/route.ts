import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { getMaterial, hatDatei, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";
import { MAX_DATEIEN, MAX_GESAMT_BYTES } from "@/lib/pruefungsstoff";
import { liesStoffzettel, STOFFZETTEL_TITEL, stoffzettelLesbar } from "@/lib/stoffzettel";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, materialien: number[] = []) => Response.json({ error, material: materialien[0], materialien }, { status });

/**
 * Stoffzettel einer Schularbeit (lib/stoffzettel.ts): one or more photos or PDFs (`datei`, up to MAX_DATEIEN: the
 * Stoffzettel, a table of contents, more pages) come in and are stored as the student's material; with `lesen=1` the
 * KI reads all of them together (lib/pruefungsstoff.ts) and the answer is the suggestion for the form plus `erkannt`
 * (the reading's id and how many points are mapped). A second try sends the stored files' ids (`material`) instead of
 * the files. Nothing is entered here: the teacher saves the Schularbeit with the form.
 * A route handler, not a server action, because a photo can be larger than an action's body limit; outside the
 * proxy for the same reason, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_GESAMT_BYTES + 1024 * 1024) return fail(`Die Dateien sind zusammen zu groß (höchstens ${MAX_GESAMT_BYTES / 1024 / 1024} MB).`, 413);
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

  const materialien = form
    .getAll("material")
    .map((x) => Number(x))
    .filter((id) => Number.isInteger(id) && id > 0);
  const files = form.getAll("datei").filter((f): f is File => f instanceof File && f.size > 0);
  if (materialien.length + files.length > MAX_DATEIEN) return fail(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.`);
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)) return fail("Bitte ein Foto (JPG, PNG, WebP) oder ein PDF wählen.", 400, materialien);
    try {
      const id = saveUpload({ name: file.name, data }, { title: STOFFZETTEL_TITEL, subject: String(form.get("fach") ?? ""), studentId: student.id, teacherId: teacher.id }).id;
      if (!materialien.includes(id)) materialien.push(id);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Der Zettel konnte nicht gespeichert werden.", 400, materialien);
    }
  }
  if (files.length) revalidatePath("/mehr/material", "layout");
  if (!materialien.length || materialien.some((id) => !getMaterial(id) || !hatDatei(getMaterial(id)!))) return fail("Bitte den Zettel fotografieren oder auswählen.", 400, materialien);
  if (!lesen) return Response.json({ material: materialien[0], materialien });

  try {
    const vorschlag = await liesStoffzettel({ materialIds: materialien, studentId: student.id, teacherId: teacher.id, heute: dayOf(new Date()), fach: String(form.get("fach") ?? "") || undefined });
    return Response.json({ material: materialien[0], materialien, vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte den Zettel nicht lesen.", 400, materialien);
  }
}
