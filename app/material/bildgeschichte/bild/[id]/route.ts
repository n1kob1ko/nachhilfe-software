import { currentTeacher } from "@/lib/auth";
import { imageWithOwner } from "@/lib/picture-story";
import { notAllowed, sendImage } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

/** A picture of a Bildgeschichte, for teachers (editor, read along, print). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  const img = imageWithOwner(Number((await params).id));
  return img ? sendImage(img) : new Response("Nicht gefunden.", { status: 404 });
}
