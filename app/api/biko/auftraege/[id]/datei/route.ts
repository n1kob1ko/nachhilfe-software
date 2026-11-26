import { bikoAn, dateiFuerBiko, zugangOk } from "@/lib/biko";

export const dynamic = "force-dynamic";

/** Die Datei eines abgeholten Dokument-Auftrags, nur für Biko (lib/biko.ts `dateiFuerBiko`). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!bikoAn()) return new Response("Nicht gefunden.", { status: 404 });
  if (!zugangOk(request.headers.get("authorization"))) return new Response("Falscher Schlüssel.", { status: 401 });
  const d = dateiFuerBiko(Number((await params).id));
  if (!d) return new Response("Nicht gefunden.", { status: 404 });
  return new Response(new Uint8Array(d.data), {
    headers: { "Content-Type": d.mime, "Content-Length": String(d.data.length), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
