import { currentTeacher } from "@/lib/auth";
import { bildfolgeBild } from "@/lib/bildfolge";
import { notAllowed, sendImage } from "@/lib/picture-story-routes";

export const dynamic = "force-dynamic";

/** A picture the app made (lib/bildfolge.ts) before the story is saved, for teachers only; sent like every story picture. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  const img = bildfolgeBild(Number((await params).id));
  return img ? sendImage(img) : new Response("Nicht gefunden.", { status: 404 });
}
