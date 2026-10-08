import { laptopContext } from "@/lib/laptop-context";
import { imageWithOwner } from "@/lib/picture-story";
import { notAllowed, sendImage } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

/** A picture on the student's own laptop: only of that student, only while the access is active. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await laptopContext();
  if (!ctx) return notAllowed(401);
  const img = imageWithOwner(Number((await params).id));
  if (!img || img.student_id !== ctx.student.id) return notAllowed();
  return sendImage(img);
}
