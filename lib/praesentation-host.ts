/**
 * Two origins for one server (docs/praesentation-format.md, „Sicherheit“). Uploaded presentations are
 * HTML with their own scripts, so they never run on the app's address: they are served only on a second
 * address, PRESENTATION_ORIGIN (e.g. https://folien.example.at; locally http://127.0.0.1:3000 next to
 * http://localhost:3000). The app tells the two apart by the Host header:
 * - on the presentation host only /deck/… answers; every other path (pages, login, student links) is 404,
 * - on the app's host /deck/… is 404: a deck is never served from the app's own address,
 * - without PRESENTATION_ORIGIN no deck is served at all.
 * The session cookies are host-only (no Domain attribute), so they never reach the presentation host.
 * Pure functions: proxy.ts, the deck route and the tests use them.
 */

export type Env = Record<string, string | undefined>;

/** Where the deck files live on the presentation host: /deck/<token>/<file>. */
export const DECK_PFAD = "/deck/";

/**
 * Paths the app answers without a teacher session (the student areas, login, health, material files and
 * feedback that check the session themselves, static files). The same list as the matcher in proxy.ts,
 * which must stay a literal there; lib/praesentationen.test.ts checks that both agree.
 */
export const OFFENE_PFADE = "login|health|lernen|geraet|mitmachen|material/|feedback/|excalidraw-assets|_next/static|_next/image|favicon.ico|icon|.*\\.(?:png|svg|ico|webmanifest)$";
const OFFEN = new RegExp(`^/(?:${OFFENE_PFADE})`);

/** An http(s) origin from a setting, or null when it is missing or not an address. */
export function originAus(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** The presentation address from PRESENTATION_ORIGIN, or null (then no deck is ever served). */
export function praesentationsOrigin(env: Env = process.env): string | null {
  return originAus(env.PRESENTATION_ORIGIN);
}

/** host[:port] in lower case, without the default ports, so „Folien.example.at:443“ equals „folien.example.at“. */
export function hostNorm(raw: string | null | undefined): string | null {
  const v = raw?.split(",")[0]?.trim().toLowerCase();
  if (!v) return null;
  return v.replace(/:(80|443)$/, "");
}

const hostname = (hostPort: string) => hostPort.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1").replace(/:\d+$/, "");

/** Host of the presentation address (host[:port]), or null when none is set. */
export function deckHost(env: Env = process.env): string | null {
  const o = praesentationsOrigin(env);
  return o ? hostNorm(new URL(o).host) : null;
}

export type Anfrage = { host: string | null; forwardedHost?: string | null };

/** Is this request for the presentation address? Either header naming it is enough (refusing more is safe). */
export function aufDeckHost(a: Anfrage, env: Env = process.env): boolean {
  const deck = deckHost(env);
  if (!deck) return false;
  return hostNorm(a.host) === deck || hostNorm(a.forwardedHost) === deck;
}

/** Origins of the app itself: PUBLIC_URL and the Railway domain. Empty when neither is set (local use). */
export function appOrigins(env: Env = process.env): string[] {
  const list = [originAus(env.PUBLIC_URL), env.RAILWAY_PUBLIC_DOMAIN?.trim() ? originAus(`https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`) : null];
  return [...new Set(list.filter((o): o is string => Boolean(o)))];
}

/** Without PUBLIC_URL (a computer at home or in the institute): the app runs on a loopback address, any port. */
const LOKAL = ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"];

/** Who may show a deck in a frame (CSP frame-ancestors): the app's origins, locally the loopback addresses. */
export function rahmenErlaubt(env: Env = process.env): string[] {
  const o = appOrigins(env);
  return o.length ? o : LOKAL;
}

/**
 * Is the deck shown on a page at this address allowed to load (frame-ancestors would let it)?
 * The teacher's page checks it to show a hint for the administrator instead of an empty frame.
 */
export function appAdresseErlaubt(appHost: string | null, proto: string | null, env: Env = process.env): boolean {
  const h = hostNorm(appHost);
  if (!h) return false;
  const o = appOrigins(env);
  if (!o.length) return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h);
  const p = (proto?.split(",")[0]?.trim() || "https").replace(/:$/, "");
  return o.some((x) => x === `${p}://${h}` || hostNorm(new URL(x).host) === h);
}

/**
 * What is wrong with the setup for playing presentations on this app address, or null when nothing is.
 * Shown to the administrator; a teacher sees a short note.
 */
export function deckEinrichtungsProblem(appHost: string | null, proto: string | null, env: Env = process.env): string | null {
  const deck = deckHost(env);
  if (!deck) return "Die Präsentations-Adresse fehlt: PRESENTATION_ORIGIN ist nicht gesetzt (siehe docs/praesentation-format.md).";
  const app = hostNorm(appHost);
  if (app && hostname(app) === hostname(deck))
    return "PRESENTATION_ORIGIN muss ein anderer Rechnername sein als die App (ein anderer Port reicht nicht, weil Cookies für alle Ports gelten).";
  if (!appAdresseErlaubt(appHost, proto, env)) return "Diese App-Adresse steht nicht in PUBLIC_URL: die Präsentation darf hier nicht angezeigt werden. PUBLIC_URL auf diese Adresse setzen.";
  return null;
}

/**
 * May the deck route answer this request? Only on the presentation host, never on the app's: the Host
 * header must name it, and so must X-Forwarded-Host when a proxy in front sets one. The app's own
 * origins never count as presentation host, not even with another port.
 */
export function deckAuslieferbar(a: Anfrage, env: Env = process.env): boolean {
  const deck = deckHost(env);
  if (!deck || hostNorm(a.host) !== deck) return false;
  if (a.forwardedHost && hostNorm(a.forwardedHost) !== deck) return false;
  return !appOrigins(env).some((o) => hostname(hostNorm(new URL(o).host)!) === hostname(deck));
}

export type Entscheidung = "weiter" | "anmelden" | "nicht-gefunden";

/**
 * What proxy.ts does with a request. On the presentation host only deck files, nothing else (no page, no
 * login, no student link); on the app's host no deck file; otherwise the usual check for a teacher session.
 */
export function proxyEntscheidung(a: Anfrage & { pfad: string; angemeldet: boolean }, env: Env = process.env): Entscheidung {
  const deckPfad = a.pfad.startsWith(DECK_PFAD);
  if (aufDeckHost(a, env)) return deckPfad ? "weiter" : "nicht-gefunden";
  if (deckPfad) return "nicht-gefunden";
  if (!a.angemeldet && !OFFEN.test(a.pfad)) return "anmelden";
  return "weiter";
}

/** The address of a deck's start file for the frame, or null without presentation address. */
export function deckUrl(token: string, start: string, env: Env = process.env): string | null {
  const o = praesentationsOrigin(env);
  if (!o) return null;
  return `${o}${DECK_PFAD}${token}/${start.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Content-Security-Policy of every deck file. The deck runs as its own sandbox (an opaque origin, even
 * when opened directly), may load scripts, styles, pictures, fonts and media only from its own folder
 * (inline code is allowed, generated decks need it), may not connect anywhere, open frames, send forms
 * or set a base address, and may only be shown in a frame of the app.
 */
export function deckCsp(token: string, env: Env = process.env): string {
  const o = praesentationsOrigin(env);
  const eigen = o ? `${o}${DECK_PFAD}${token}/` : "'none'";
  return [
    "sandbox allow-scripts",
    "default-src 'none'",
    `script-src ${eigen} 'unsafe-inline'`,
    `style-src ${eigen} 'unsafe-inline'`,
    `img-src ${eigen} data: blob:`,
    `font-src ${eigen} data:`,
    `media-src ${eigen} data: blob:`,
    "connect-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${rahmenErlaubt(env).join(" ")}`,
  ].join("; ");
}
