import { deckDatei } from "@/lib/praesentationen";
import { DECK_PFAD, deckAuslieferbar, deckCsp } from "@/lib/praesentation-host";

export const dynamic = "force-dynamic";

const nichtGefunden = () => new Response("Nicht gefunden.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * A file of an uploaded presentation. Answers only on the presentation address (PRESENTATION_ORIGIN), never
 * on the app's own, reads no cookie and serves only files listed for the deck, with a strict CSP that also
 * sandboxes the page when it is opened on its own (lib/praesentation-host.ts, docs/praesentation-format.md).
 */
export async function GET(request: Request) {
  if (!deckAuslieferbar({ host: request.headers.get("host"), forwardedHost: request.headers.get("x-forwarded-host") })) return nichtGefunden();
  const teile = new URL(request.url).pathname.slice(DECK_PFAD.length).split("/");
  let token: string;
  let pfad: string[];
  try {
    [token, ...pfad] = teile.map((t) => decodeURIComponent(t));
  } catch {
    return nichtGefunden();
  }
  const f = deckDatei(token, pfad);
  if (!f) return nichtGefunden();
  const headers: Record<string, string> = {
    "Content-Type": f.typ,
    "Content-Security-Policy": deckCsp(token),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // the files of a deck never change (a new upload gets a new address)
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };
  // fonts and module scripts are loaded with CORS from the sandboxed (origin "null") page
  if (!f.typ.startsWith("text/html")) headers["Access-Control-Allow-Origin"] = "*";
  // audio and video: browsers (Safari above all) ask for parts
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const n = f.daten.length;
    let start = range[1] ? Number(range[1]) : Math.max(0, n - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), n - 1) : n - 1;
    if (!range[1]) end = n - 1;
    if (start >= n || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${n}` } });
    start = Math.max(0, start);
    end = Math.max(start, end);
    return new Response(new Uint8Array(f.daten.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${n}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(f.daten), { headers: { ...headers, "Content-Length": String(f.daten.length) } });
}
