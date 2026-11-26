import { abholen, bikoAn, zugangOk } from "@/lib/biko";

export const dynamic = "force-dynamic";

const antwort = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Biko holt offene Aufträge ab (lib/biko.ts `abholen`): Texte ohne Namen, Schüler als S1, S2 … */
export async function GET(request: Request) {
  if (!bikoAn()) return antwort(404, { fehler: "Nicht gefunden." });
  if (!zugangOk(request.headers.get("authorization"))) return antwort(401, { fehler: "Falscher Schlüssel." });
  return antwort(200, { auftraege: abholen() });
}
