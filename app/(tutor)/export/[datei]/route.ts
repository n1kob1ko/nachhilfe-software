import { currentTeacher } from "@/lib/auth";
import { flushBoard } from "@/lib/whiteboard";
import { exportBackup } from "@/lib/backup";
import { datasetCsv } from "@/lib/exports";

export const dynamic = "force-dynamic";

const stamp = () => new Date().toISOString().slice(0, 10);

/** Downloads for the Datenexport page. Only for administrators; checked here because layouts do not cover route handlers. */
export async function GET(_request: Request, { params }: { params: Promise<{ datei: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  if (!teacher.is_admin) return new Response("Nur für die Verwaltung.", { status: 403 });
  const { datei } = await params;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (datei === "backup.json") {
    flushBoard(); // whiteboard strokes are written to the database a moment after drawing
    const body = JSON.stringify(exportBackup(), null, 1);
    return new Response(body, {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="lernheft-sicherung-${stamp()}.json"` },
    });
  }
  const m = /^([a-z-]+)\.csv$/.exec(datei);
  const csv = m ? datasetCsv(m[1]) : null;
  if (!csv) return new Response("Unbekannter Export.", { status: 404 });
  return new Response(csv.body, {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lernheft-${stamp()}-${csv.filename}"` },
  });
}
