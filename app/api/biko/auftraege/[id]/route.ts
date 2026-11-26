import { bikoAn, rueckmeldung, RueckmeldungSchema, zugangOk } from "@/lib/biko";

export const dynamic = "force-dynamic";

const antwort = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Biko schickt ein Ergebnis oder einen Fehler zurück (lib/biko.ts `rueckmeldung`). Höchstens 1 MB. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!bikoAn()) return antwort(404, { fehler: "Nicht gefunden." });
  if (!zugangOk(request.headers.get("authorization"))) return antwort(401, { fehler: "Falscher Schlüssel." });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return antwort(404, { fehler: "Diesen Auftrag gibt es nicht." });
  const text = await request.text();
  if (text.length > 1_000_000) return antwort(413, { fehler: "Zu groß." });
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return antwort(400, { fehler: "Kein JSON." });
  }
  const r = RueckmeldungSchema.safeParse(roh);
  if (!r.success) return antwort(400, { fehler: "Die Rückmeldung passt nicht." });
  const e = rueckmeldung(id, r.data);
  return "error" in e ? antwort(e.status, { fehler: e.error }) : antwort(200, { ok: true });
}
