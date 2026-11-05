import { hostNorm, originAus, type Env } from "@/lib/praesentation-host";

/**
 * The app answers on its own domain (PUBLIC_URL, e.g. https://dreamstudy.at) and still on the address Railway
 * generated (…up.railway.app). A device opened on that old address cannot show presentations: the deck's
 * frame-ancestors name only PUBLIC_URL. So every request on a *.up.railway.app host goes to PUBLIC_URL instead
 * (307, not cached for good, so a later change of PUBLIC_URL still works). /health stays, Railway's check uses it.
 * Without PUBLIC_URL, or when PUBLIC_URL is itself a Railway address, nothing is redirected.
 */
export function umleitungZurApp(a: { host: string | null; pfad: string; suche: string }, env: Env = process.env): string | null {
  const host = hostNorm(a.host);
  if (!host || !/\.up\.railway\.app$/.test(host)) return null;
  if (a.pfad === "/health" || a.pfad.startsWith("/health/")) return null;
  const app = originAus(env.PUBLIC_URL);
  if (!app || hostNorm(new URL(app).host) === host || /\.up\.railway\.app$/.test(new URL(app).hostname)) return null;
  return `${app}${a.pfad}${a.suche}`;
}
