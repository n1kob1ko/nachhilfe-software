import { currentTeacher } from "@/lib/auth";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

/** The teacher's text page follows what the student writes on the tablet. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const text = getText(Number((await params).id));
  if (!text) return new Response("Nicht gefunden.", { status: 404 });
  return stream(textChannel(text.id), request, {
    role: "lehrer",
    name: teacher.name,
    hello: () => ({ type: "text", version: getText(text.id)?.version ?? 0 }),
  });
}
