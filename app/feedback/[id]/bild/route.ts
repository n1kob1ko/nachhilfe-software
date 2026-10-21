import fs from "node:fs";
import { currentTeacher } from "@/lib/auth";
import { feedbackBildDatei, getFeedback } from "@/lib/feedback";
import { sniffType } from "@/lib/materials";

export const dynamic = "force-dynamic";

/** The screenshot of one feedback: for the Verwaltung and for the teacher who sent it, never as HTML. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const f = getFeedback(Number((await params).id));
  if (!f?.bild || (!teacher.is_admin && f.teacher_id !== teacher.id)) return new Response("Nicht gefunden.", { status: 404 });
  let data: Buffer;
  try {
    data = fs.readFileSync(feedbackBildDatei(f.bild));
  } catch {
    return new Response("Das Bild fehlt.", { status: 404 });
  }
  const type = sniffType(data);
  if (!type?.mime.startsWith("image/")) return new Response("Das Bild passt nicht.", { status: 409 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type.mime,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
