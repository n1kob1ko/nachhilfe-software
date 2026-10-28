import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { BLATT_TITEL, blattLesbar, liesBlatt, MAX_SEITEN } from "@/lib/blatt-einlesen";
import { getMaterial, hatDatei, MAX_UPLOAD_BYTES, saveUpload, sniffType } from "@/lib/materials";
import { ANDERES_BLATT, blattFehler, liesPapier, papierTor } from "@/lib/papier-einheit";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, materials?: number[]) => Response.json({ error, materials }, { status });

/**
 * Gelöstes Blatt einlesen (lib/blatt-einlesen.ts): the pages come in and are stored as the student's material; the
 * KI reads them and the answer is the preview. A second try sends the stored pages' ids instead of the files.
 * Nothing goes into the profile here: the teacher takes it over after checking the preview. A route handler, not a
 * server action, because photos can be larger than an action's body limit; outside the proxy for the same reason,
 * so it checks the session itself.
 *
 * Arbeit fotografieren (lib/papier-einheit.ts): with `einheit` (a running unit of this teacher) and `blatt` (a sheet of
 * that unit), the KI reads the pages against the sheet's original tasks; with `blatt` = „anders“ as above. The student is
 * always the unit's student, and the same limits apply (KI on, budget, the limit per student).
 *
 * Without a unit (Gemeinsame Bewertung, C3): with `probe` = 1 and `blatt` (a Probeschularbeit of `schueler` with open tasks)
 * the same reading against its tasks and the Musterlösung, from the exam card.
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
  // in a running unit: only its teacher (or the administration), only its student
  const unit = form.get("einheit") ? getUnit(Number(form.get("einheit"))) : null;
  if (form.get("einheit") && (!unit || unit.status !== "gestartet")) return fail("Die Einheit läuft nicht mehr.", 404);
  if (unit && !canManageUnit(teacher, unit)) return notAllowed();
  const student = repo.getStudent(unit ? unit.student_id : Number(form.get("schueler")));
  if (!student) return fail("Diesen Schüler gibt es nicht.", 404);
  if (unit && Number(form.get("schueler")) !== student.id) return fail("Dieser Schüler gehört nicht zu dieser Einheit.");
  // a Probeschularbeit on paper outside a unit: a sheet of this student, never „another sheet“
  const probe = !unit && form.get("probe") === "1";
  const blatt = unit || probe ? String(form.get("blatt") ?? "") : "";
  if (probe && (!blatt || blatt === ANDERES_BLATT)) return fail("Bitte die Probeschularbeit wählen.");
  const fach = String(form.get("fach") ?? "").trim() || (unit?.subject ?? "");
  if (!fach && !probe && (!unit || blatt === ANDERES_BLATT)) return fail("Bitte das Fach wählen.");
  if (form.get("keine_namen") !== "1") return fail("Bitte bestätigen, dass auf den Seiten kein Name steht.");
  const geht = unit || probe ? papierTor(student.id) : blattLesbar();
  if ("grund" in geht) return fail(geht.grund);
  // a sheet of this unit (or an open Probeschularbeit of this student) before any page is stored: a rejected request keeps nothing
  const fremd = (unit || probe) && blatt !== ANDERES_BLATT ? blattFehler({ unitId: unit?.id ?? null, studentId: student.id, blattKey: blatt }) : null;
  if (fremd) return fail(fremd);

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
    const vorschlag =
      (unit || probe) && blatt !== ANDERES_BLATT
        ? await liesPapier({ unitId: unit?.id ?? null, studentId: student.id, blattKey: blatt, materialIds: materials, teacherId: teacher.id })
        : await liesBlatt({ materialIds: materials, studentId: student.id, teacherId: teacher.id, fach, unitId: unit?.id ?? null });
    return Response.json({ materials, vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte das Blatt nicht lesen.", 400, materials);
  }
}
