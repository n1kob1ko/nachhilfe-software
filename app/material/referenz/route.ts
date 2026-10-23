import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { MAX_ANALYSIS_PDF_BYTES } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { liesReferenz } from "@/lib/referenz";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Referenzsammlung (lib/referenz.ts): ein PDF oder Foto mit Aufgaben kommt herein, die KI liest es einmal, jede Aufgabe
 * wird ein ungeprüfter Eintrag. Die Datei wird nirgends gespeichert. Ein Route Handler, kein Server Action, weil ein
 * PDF größer sein kann als deren Grenze; außerhalb des Proxys, darum prüft er die Anmeldung selbst.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_ANALYSIS_PDF_BYTES + 1024 * 1024) return fail(`Die Datei ist zu groß (höchstens ${MAX_ANALYSIS_PDF_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Datei kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return fail("Bitte eine Datei auswählen.");
  try {
    const out = await liesReferenz({
      datei: { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
      fach: String(form.get("fach") ?? ""),
      quelle: String(form.get("quelle") ?? ""),
      teacherId: teacher.id,
    });
    revalidatePath("/mehr/referenzen", "layout");
    return Response.json({ anzahl: out.ids.length, hinweise: out.hinweise });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
  }
}
