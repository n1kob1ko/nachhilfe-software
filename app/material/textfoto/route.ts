import { currentTeacher } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import * as repo from "@/lib/repo";
import { liesTextFoto, textFotoLesbar } from "@/lib/textinterpretation-foto";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Text vom Foto für eine Textinterpretation (lib/textinterpretation-foto.ts): the photo or PDF of the printed story
 * comes in, the KI writes it down line by line and the answer goes into the form. Nothing is stored here, not even
 * the photo; the teacher checks the text and saves it with the form. A route handler, not a server action, because a
 * photo can be larger than an action's body limit; outside the proxy for the same reason, so it checks the session itself.
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
  if (form.get("keine_namen") !== "1") return fail("Bitte bestätigen, dass auf der Seite kein Name und nichts Handgeschriebenes steht.");
  const geht = textFotoLesbar();
  if (!geht.ok) return fail(geht.grund);
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return fail("Bitte die Seite fotografieren oder ein PDF wählen.");
  const studentId = Number(form.get("schueler")) || 0;
  const student = studentId ? repo.getStudent(studentId) : null;
  try {
    const vorschlag = await liesTextFoto({ data: Buffer.from(await file.arrayBuffer()), teacherId: teacher.id, studentId: student?.id ?? null });
    return Response.json({ vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte den Text nicht lesen.");
  }
}
