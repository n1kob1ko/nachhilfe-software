import { currentTeacher } from "@/lib/auth";
import { handleTextSave } from "@/lib/text-routes";
import { getText, textDoc } from "@/lib/texts";

export const dynamic = "force-dynamic";

/** Autosave and "Speichern" of a Textarbeit on the teacher's laptop. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  return handleTextSave(request, Number((await params).id), { mayWrite: () => true, by: "lehrer" });
}

/** The stored text, for the editor that follows what is written on the tablet. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const text = getText(Number((await params).id));
  if (!text) return Response.json({ error: "Diesen Text gibt es nicht." }, { status: 404 });
  return Response.json({ version: text.version, updatedAt: text.updated_at, body: textDoc(text) }, { headers: { "Cache-Control": "no-store" } });
}
