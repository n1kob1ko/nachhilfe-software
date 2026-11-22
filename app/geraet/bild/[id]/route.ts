import { currentTeacher } from "@/lib/auth";
import { deviceContext } from "@/lib/device-context";
import { imageWithOwner } from "@/lib/picture-story";
import { notAllowed, sendImage } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

/**
 * A picture on the student tablet: only of the student its teacher is teaching right now. The teacher's
 * copy of the tablet screen (Schüler-Bildschirm, lib/spiegel.ts) asks for the same address without the
 * tablet cookie: a signed-in teacher gets it as from /material/bildgeschichte/bild.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = imageWithOwner(Number((await params).id));
  const ctx = await deviceContext();
  if (ctx) {
    if (!img || !ctx.unit || ctx.unit.student_id !== img.student_id) return notAllowed();
    return sendImage(img);
  }
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  return img ? sendImage(img) : new Response("Nicht gefunden.", { status: 404 });
}
