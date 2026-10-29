import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { fotoMoeglich, uebungAusFoto } from "@/lib/foto-uebung";
import { keinNameGilt } from "@/lib/kein-name";
import { getMaterial, MAX_ANALYSIS_IMAGE_BYTES, MAX_UPLOAD_BYTES, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, material?: number) => Response.json({ error, material }, { status });

/**
 * „Foto vom Stoff“ in a running unit (lib/foto-uebung.ts): the photo comes in, is stored as the student's
 * material, the KI reads it and the builder makes a draft exercise; the answer names the preview to open.
 * A second try after a failure sends the stored photo's id instead of the file. A route handler, not a
 * server action, because a photo can be larger than an action's body limit; outside the proxy for the same
 * reason, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) return fail(`Das Foto ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Das Foto kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const unit = getUnit(Number(form.get("einheit")));
  if (!unit) return fail("Diese Einheit gibt es nicht.", 404);
  if (!canManageUnit(teacher, unit)) return fail("Das ist die Einheit eines anderen Lehrers.", 403);
  if (unit.status !== "gestartet") return fail("Diese Einheit ist schon beendet.");
  // „kein Name“ einmal je Einheit (lib/kein-name.ts)
  if (!keinNameGilt({ unitId: unit.id, studentId: unit.student_id, teacher, haken: form.get("keine_namen") === "1" })) return fail("Bitte bestätigen, dass auf dem Foto keine Namen stehen.");
  const geht = fotoMoeglich();
  if (!geht.ok) return fail(geht.grund);

  let materialId = Number(form.get("material")) || 0;
  const file = form.get("datei");
  if (file instanceof File && file.size) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)?.mime.startsWith("image/")) return fail("Bitte ein Foto wählen (JPG, PNG oder WebP).");
    if (data.length > MAX_ANALYSIS_IMAGE_BYTES) return fail(`Das Foto ist zu groß für die KI (höchstens ${MAX_ANALYSIS_IMAGE_BYTES / 1024 / 1024} MB).`);
    try {
      materialId = saveUpload({ name: file.name, data }, { title: "Foto vom Stoff", kind: "foto", subject: unit.subject, studentId: unit.student_id, teacherId: teacher.id }).id;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Das Foto konnte nicht gespeichert werden.");
    }
    revalidatePath("/mehr/material", "layout");
  } else if (!materialId || !getMaterial(materialId)) {
    return fail("Bitte ein Foto aufnehmen oder auswählen.");
  }

  try {
    const out = await uebungAusFoto({ unitId: unit.id, teacherId: teacher.id, materialId, anzahl: Number(form.get("anzahl")), hinweis: String(form.get("hinweis") ?? "") });
    revalidatePath("/uebungen");
    return Response.json({ redirect: `/uebungen/${out.worksheetId}${out.aiError ? "?hinweis=ki" : ""}` });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden.", 400, materialId);
  }
}
