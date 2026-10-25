import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { MAX_DATEIEN, MAX_GESAMT_BYTES } from "@/lib/pruefungsstoff";
import { canManageUnit, getUnit } from "@/lib/units";
import { speichereVorgabe } from "@/lib/vorgabe";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * „Was steht heute an?“ (lib/vorgabe.ts) für eine laufende Einheit: der getippte Text (`text`), Fotos oder PDFs
 * (`datei`, bis MAX_DATEIEN, gespeichert als Material des Schülers), eine gewählte Prüfung (`pruefung`) und ob auf den
 * Fotos kein Name steht (`keine_namen`). Ein Route Handler, kein Server Action, weil Fotos größer sein können als das
 * Limit einer Action; außerhalb des Proxys aus demselben Grund, daher prüft er die Sitzung selbst.
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
  const unit = getUnit(Number(form.get("einheit")));
  if (!unit) return fail("Diese Einheit gibt es nicht.", 404);
  if (!canManageUnit(teacher, unit)) return notAllowed();
  if (unit.status !== "gestartet") return fail("Diese Einheit läuft nicht mehr.");

  const files = form.getAll("datei").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_DATEIEN) return fail(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.`);
  const materialIds: number[] = [];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)) return fail("Bitte Fotos (JPG, PNG, WebP) oder PDFs wählen.");
    try {
      const id = saveUpload({ name: file.name, data }, { title: "Für heute", subject: unit.subject, studentId: unit.student_id, teacherId: teacher.id }).id;
      if (!materialIds.includes(id)) materialIds.push(id);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Die Datei konnte nicht gespeichert werden.");
    }
  }
  if (files.length) revalidatePath("/mehr/material", "layout");

  const pruefung = Number(form.get("pruefung"));
  const out = await speichereVorgabe({
    unitId: unit.id,
    teacherId: teacher.id,
    text: String(form.get("text") ?? ""),
    materialIds,
    testId: Number.isInteger(pruefung) && pruefung > 0 ? pruefung : null,
    keinName: form.get("keine_namen") === "1",
    heute: dayOf(new Date()),
  });
  if ("fehler" in out) return fail(out.fehler);
  revalidatePath(`/einheiten/${unit.id}`);
  return Response.json({ ok: true, angewendet: out.angewendet });
}
