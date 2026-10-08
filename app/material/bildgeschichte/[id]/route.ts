import { currentTeacher } from "@/lib/auth";
import { notifyStudent, parseView, pushLive } from "@/lib/live";
import { MAX_REQUEST_BYTES, updatePictureStory } from "@/lib/picture-story";
import { foreignRequest, notAllowed, readStoryForm } from "@/lib/picture-story-routes";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Changes a Bildgeschichte (order, pictures, settings); the student's device and the teacher's page follow. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return fail(`Die Bilder sind zusammen zu groß (höchstens ${MAX_REQUEST_BYTES / 1024 / 1024} MB).`, 413);
  const text = getText(Number((await params).id));
  if (!text) return fail("Diese Bildgeschichte gibt es nicht.", 404);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Bilder kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const f = await readStoryForm(form);
  if (!f.title) return fail("Bitte einen Titel eingeben.");
  try {
    updatePictureStory(text.id, { title: f.title, subject: f.subject || text.subject, prompt: f.prompt, settings: f.settings, order: f.order, uploads: f.uploads });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Änderung konnte nicht gespeichert werden.");
  }
  publish(textChannel(text.id), { type: "info" });
  const unit = runningUnitForStudent(text.student_id);
  if (unit) {
    pushLive(unit.id);
    const view = parseView(unit.device_view);
    if (view.kind === "text" && view.textId === text.id) notifyStudent(unit, "text");
  }
  return Response.json({ redirect: `/texte/${text.id}` });
}
