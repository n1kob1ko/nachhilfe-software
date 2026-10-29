import { currentTeacher } from "@/lib/auth";
import { handschriftLesbar, KEIN_NAME_FEHLT, liesHandschrift, MAX_HANDSCHRIFT_SEITEN } from "@/lib/handschrift";
import { keinNameGilt } from "@/lib/kein-name";
import { MAX_UPLOAD_BYTES } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { getText } from "@/lib/texts";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Handgeschriebenen Text einlesen (lib/handschrift.ts): the photos or PDF pages of a text the student wrote on paper
 * come in, the KI writes it down word for word and the answer goes into the preview. Nothing is stored here, not even
 * the photos; the teacher checks the text and takes it over with „Als Text übernehmen“. A route handler, not a server
 * action, because photos can be larger than an action's body limit; outside the proxy for the same reason, so it
 * checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_HANDSCHRIFT_SEITEN * MAX_UPLOAD_BYTES + 1024 * 1024) return fail("Die Fotos sind zu groß.", 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Fotos kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const text = getText(Number(form.get("text")));
  if (!text) return fail("Diesen Text gibt es nicht.", 404);
  // „kein Name“: aus dem Unterricht geöffnet (`einheit`) einmal je Einheit (lib/kein-name.ts prüft, dass sie läuft und zu ihm gehört)
  const keinName = keinNameGilt({ unitId: Number(form.get("einheit")) || null, studentId: text.student_id, teacher, haken: form.get("keine_namen") === "1" });
  if (!keinName) return fail(KEIN_NAME_FEHLT);
  const geht = handschriftLesbar(text.student_id);
  if (!geht.ok) return fail(geht.grund);
  const files = form.getAll("seite").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("Bitte die Seiten fotografieren oder auswählen.");
  if (files.length > MAX_HANDSCHRIFT_SEITEN) return fail(`Höchstens ${MAX_HANDSCHRIFT_SEITEN} Seiten auf einmal.`);
  try {
    const dateien = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    const vorschlag = await liesHandschrift({ dateien, teacherId: teacher.id, studentId: text.student_id, keinName });
    return Response.json({ vorschlag });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die KI konnte den Text nicht lesen.");
  }
}
