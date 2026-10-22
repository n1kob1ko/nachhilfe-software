import { currentTeacher } from "@/lib/auth";
import { exportDateiname, exportiereLernpaket } from "@/lib/lernpakete";

export const dynamic = "force-dynamic";

/** Downloads a Lernpaket as a JSON file in the import format (docs/lernpaket-format.md). Layouts do not cover route handlers, so the session is checked here. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const { id } = await params;
  const datei = exportiereLernpaket(Number(id));
  if (!datei) return new Response("Dieses Lernpaket gibt es nicht.", { status: 404 });
  return new Response(JSON.stringify(datei, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportDateiname({ title: datei.titel })}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
