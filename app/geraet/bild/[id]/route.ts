import { deviceContext } from "@/lib/device-context";
import { imageWithOwner } from "@/lib/picture-story";
import { notAllowed, sendImage } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

/** A picture on the student tablet: only of the student its teacher is teaching right now. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await deviceContext();
  if (!ctx) return notAllowed(401);
  const img = imageWithOwner(Number((await params).id));
  if (!img || !ctx.unit || ctx.unit.student_id !== img.student_id) return notAllowed();
  return sendImage(img);
}
