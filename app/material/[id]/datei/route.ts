import fs from "node:fs";
import { currentTeacher } from "@/lib/auth";
import { getMaterial, materialFile, sniffType } from "@/lib/materials";

export const dynamic = "force-dynamic";

/** The uploaded file, for teachers only. Served with the type found when it was uploaded, never as HTML. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const m = getMaterial(Number((await params).id));
  if (!m) return new Response("Nicht gefunden.", { status: 404 });
  let data: Buffer;
  try {
    data = fs.readFileSync(materialFile(m));
  } catch {
    return new Response("Die Datei fehlt.", { status: 404 });
  }
  const type = sniffType(data);
  if (!type || type.mime !== m.mime) return new Response("Die Datei passt nicht.", { status: 409 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(m.file_name)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // a PDF may be shown in the preview frame of this site, nowhere else
      "Content-Security-Policy": type.mime === "application/pdf" ? "frame-ancestors 'self'" : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
