import { bikoAn, letzterAbruf, zugangOk } from "@/lib/biko";

export const dynamic = "force-dynamic";

const antwort = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Biko prüft hier die Verbindung (lib/biko.ts). Ohne BIKO_TOKEN gibt es die Tür nicht. */
export async function GET(request: Request) {
  if (!bikoAn()) return antwort(404, { fehler: "Nicht gefunden." });
  if (!zugangOk(request.headers.get("authorization"))) return antwort(401, { fehler: "Falscher Schlüssel." });
  return antwort(200, { ok: true, app: "DreamStudy", letzter_abruf: letzterAbruf() });
}
