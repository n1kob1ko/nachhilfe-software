import { currentTeacher } from "@/lib/auth";
import { sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { darfWochenplanBearbeiten } from "@/lib/planung/berechtigungen";
import { liesFoto, MAX_FOTO_BYTES, stundenplanFotoMoeglich } from "@/lib/planung/stundenplan-foto";
import { listStudents, listTeachers } from "@/lib/repo";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });
const BILDER = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Stundenplan-Fotos (lib/planung/stundenplan-foto.ts): ein Foto kommt herein, die KI liest es, zurück geht der
 * Vorschlag für die Vorschau. Das Foto wird nirgends gespeichert. Ein Route Handler, kein Server Action, weil ein
 * Foto größer sein kann als deren Grenze; je Foto eine Anfrage, damit die Seite den Fortschritt zeigt.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (!darfWochenplanBearbeiten(teacher)) return fail("Den Wochenplan ändert nur die Verwaltung.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FOTO_BYTES + 1024 * 1024) return fail(`Das Foto ist zu groß (höchstens ${MAX_FOTO_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Das Foto kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  if (form.get("vornamen") !== "1") return fail("Bitte bestätigen, dass die Vornamen auf dem Foto an die KI gehen dürfen.");
  const geht = stundenplanFotoMoeglich();
  if (!geht.ok) return fail(geht.grund);
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return fail("Bitte ein Foto auswählen.");
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffType(data)?.mime;
  const bild = BILDER.find((b) => b === mime);
  if (!bild) return fail("Bitte ein Foto wählen (JPG, PNG oder WebP).");
  try {
    const vorschlag = await liesFoto(
      { mime: bild, data },
      {
        teacherId: teacher.id,
        schueler: listStudents().map((s) => ({ id: s.id, name: s.name, teacher_id: s.teacher_id })),
        lehrerIds: listTeachers().map((t) => t.id),
      },
    );
    return Response.json({ vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Das Foto konnte nicht gelesen werden.");
  }
}
