import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { keinNameGilt } from "@/lib/kein-name";
import { getMaterial, hatDatei, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";
import { ALLE_TEILE, MAX_DATEIEN, MAX_GESAMT_BYTES, starteStoffpaket, type Teil } from "@/lib/stoffpaket";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, materials?: number[]) => Response.json({ error, materials }, { status });

/** So heißen die Fotos beim Schüler (Mehr › Material). */
const TITEL = "Stoff vorbereiten";

/**
 * „Stoff vorbereiten“ (lib/stoffpaket.ts): Fotos oder PDFs (`datei`, gespeichert als Material des Schülers), vorhandenes
 * Material (`material`), der Text der Lehrkraft (`text`), das Fach (`fach`), die gewählten Teile (`teil`) und ob auf den
 * Blättern kein Name steht (`keine_namen`). Startet den Lauf und gibt seine Id zurück; die Seite des Laufs zeigt den
 * Fortschritt. Ein Route Handler, kein Server Action, weil Fotos größer sein können als das Limit einer Action; außerhalb
 * des Proxys aus demselben Grund, daher prüft er die Sitzung selbst.
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
    return fail("Die Dateien kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const student = repo.getStudent(Number(form.get("schueler")));
  if (!student) return fail("Diesen Schüler gibt es nicht.", 404);
  // aus einer laufenden Einheit: nur ihre Lehrkraft (oder die Verwaltung), nur ihr Schüler
  const unit = form.get("einheit") ? getUnit(Number(form.get("einheit"))) : null;
  if (unit && (unit.student_id !== student.id || unit.status !== "gestartet")) return fail("Diese Einheit läuft nicht mehr.");
  if (unit && !canManageUnit(teacher, unit)) return notAllowed();

  const files = form.getAll("datei").filter((f): f is File => f instanceof File && f.size > 0);
  // vorhandenes Material des Schülers (auch ein zweiter Versuch: die schon gespeicherten Fotos)
  const vorhanden = [...new Set(form.getAll("material").map(Number))].filter((id) => {
    const m = Number.isInteger(id) && id > 0 ? getMaterial(id) : null;
    return m && m.student_id === student.id && hatDatei(m);
  });
  if (files.length + vorhanden.length > MAX_DATEIEN) return fail(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs auf einmal.`);
  const keinName = keinNameGilt({ unitId: unit?.id ?? null, studentId: student.id, teacher, haken: form.get("keine_namen") === "1" });
  if (files.length + vorhanden.length > 0 && !keinName) return fail("Bitte bestätigen, dass auf den Blättern kein Name steht (oder er abgedeckt ist).");
  const fach = String(form.get("fach") ?? "").trim();
  if (!fach) return fail("Bitte ein Fach wählen.");
  const materialIds: number[] = [...vorhanden];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    if (!sniffType(data)) return fail("Bitte Fotos (JPG, PNG, WebP) oder PDFs wählen.", 400, materialIds);
    try {
      const id = saveUpload({ name: file.name, data }, { title: TITEL, subject: fach, studentId: student.id, teacherId: teacher.id }).id;
      if (!materialIds.includes(id)) materialIds.push(id);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Eine Datei konnte nicht gespeichert werden.", 400, materialIds);
    }
  }
  if (files.length) revalidatePath("/mehr/material", "layout");
  const teile = form.getAll("teil").map(String).filter((t): t is Teil => (ALLE_TEILE as string[]).includes(t));
  const out = starteStoffpaket({
    studentId: student.id,
    teacherId: teacher.id,
    unitId: unit?.id ?? null,
    fach,
    anweisung: String(form.get("text") ?? ""),
    materialIds,
    teile,
    keinName,
  });
  if ("fehler" in out) return fail(out.fehler, 400, materialIds);
  revalidatePath(`/schueler/${student.id}`);
  return Response.json({ ok: true, id: out.id, url: `/schueler/${student.id}/stoff/${out.id}` });
}
