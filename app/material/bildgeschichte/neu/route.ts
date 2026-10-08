import { currentTeacher } from "@/lib/auth";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet, studentDevice } from "@/lib/live";
import { createPictureStory, MAX_REQUEST_BYTES } from "@/lib/picture-story";
import { foreignRequest, notAllowed, readStoryForm } from "@/lib/picture-story-routes";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * "Bildgeschichte erstellen" in a running unit: the pictures and settings in one form post. A route
 * handler, not a server action, because pictures can be larger than an action's body limit; outside
 * the proxy for the same reason, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return fail(`Die Bilder sind zusammen zu groß (höchstens ${MAX_REQUEST_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Bilder kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const unit = getUnit(Number(form.get("einheit")));
  if (!unit) return fail("Diese Einheit gibt es nicht.", 404);
  if (!canManageUnit(teacher, unit)) return fail("Das ist die Einheit eines anderen Lehrers.", 403);
  if (unit.status !== "gestartet") return fail("Diese Einheit ist schon beendet.");
  const f = await readStoryForm(form);
  if (!f.title) return fail("Bitte einen Titel eingeben.");
  const files = f.order.flatMap((e) => ("upload" in e && f.uploads[e.upload] ? [{ ...f.uploads[e.upload], caption: e.caption }] : []));
  try {
    const text = createPictureStory({ studentId: unit.student_id, teacherId: teacher.id, unitId: unit.id, subject: f.subject || "Deutsch", title: f.title, prompt: f.prompt, settings: f.settings, images: files });
    noteActivity(unit.student_id);
    const show = f.show && studentDevice(unit) !== null;
    if (show) showOnTablet(unit, { kind: "text", textId: text.id });
    else pushLive(unit.id);
    return Response.json({ redirect: show ? `/einheiten/${unit.id}?text=${text.id}` : `/texte/${text.id}` });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Bildgeschichte konnte nicht gespeichert werden.");
  }
}
