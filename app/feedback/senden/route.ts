import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { saveFeedback } from "@/lib/feedback";
import { MAX_UPLOAD_BYTES } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * The feedback button (components/FeedbackButton.tsx) sends here. A route handler, not a server action,
 * because a screenshot can be larger than an action's body limit; outside the proxy for the same reason,
 * so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) return fail(`Das Bild ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Das Feedback kam nicht vollständig an. Bitte noch einmal senden.");
  }
  const file = form.get("bild");
  let fehler: unknown = [];
  try {
    fehler = JSON.parse(String(form.get("fehler") ?? "[]"));
  } catch {
    fehler = [];
  }
  const res = saveFeedback({
    teacherId: teacher.id,
    art: String(form.get("art") ?? ""),
    text: String(form.get("text") ?? ""),
    seite: String(form.get("seite") ?? ""),
    bildschirm: String(form.get("bildschirm") ?? ""),
    modus: String(form.get("modus") ?? ""),
    browser: String(form.get("browser") ?? ""),
    fehler,
    bild: file instanceof File && file.size ? Buffer.from(await file.arrayBuffer()) : null,
  });
  if ("error" in res) return fail(res.error);
  revalidatePath("/mehr/feedback");
  revalidatePath("/mehr");
  return Response.json({ id: res.id });
}
