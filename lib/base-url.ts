import { networkInterfaces } from "node:os";

/**
 * The address a student tablet can open. Order:
 * 1. PUBLIC_URL, when set (own domain, or a local server behind Docker),
 * 2. RAILWAY_PUBLIC_DOMAIN, which Railway sets for the public domain,
 * 3. the address the teacher used, with localhost swapped for this computer's address in the network,
 *    because "localhost" on the tablet would be the tablet itself.
 */

export type BaseUrl = {
  url: string;
  /** still localhost: a tablet cannot reach it */
  localOnly: boolean;
};

type Input = {
  host: string | null;
  proto: string | null;
  /** PUBLIC_URL and RAILWAY_PUBLIC_DOMAIN are read */
  env?: Record<string, string | undefined>;
  lanAddress?: () => string | null;
};

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$/i;
const HOST = /^[a-z0-9.-]+$|^\[[0-9a-f:.]+\]$/i;

function splitHost(raw: string): { name: string; port: string } | null {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d{1,5}))?$/.exec(raw.trim());
  if (!m || !HOST.test(m[1])) return null;
  return { name: m[1], port: m[2] ?? "" };
}

function fromUrl(raw: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw))
    return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Private IPv4 of this computer, preferring the usual home and school networks. */
export function lanAddress(): string | null {
  const found: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? [])
      if (a.family === "IPv4" && !a.internal) found.push(a.address);
  }
  const rank = (ip: string) =>
    ip.startsWith("192.168.")
      ? 0
      : ip.startsWith("10.")
        ? 1
        : /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
          ? 2
          : 3;
  return found.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function baseUrl({
  host,
  proto,
  env = process.env,
  lanAddress: lan = lanAddress,
}: Input): BaseUrl {
  const configured = env.PUBLIC_URL?.trim() && fromUrl(env.PUBLIC_URL.trim());
  if (configured) return { url: configured, localOnly: false };
  const railway =
    env.RAILWAY_PUBLIC_DOMAIN?.trim() &&
    fromUrl(`https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`);
  if (railway) return { url: railway, localOnly: false };

  const scheme =
    proto?.split(",")[0].trim().toLowerCase() === "https" ? "https" : "http";
  const h = splitHost(host ?? "") ?? { name: "localhost", port: "" };
  let name = h.name;
  if (LOOPBACK.test(name)) {
    const ip = lan();
    if (ip) name = ip;
  }
  const port =
    h.port &&
    !(
      (scheme === "http" && h.port === "80") ||
      (scheme === "https" && h.port === "443")
    )
      ? `:${h.port}`
      : "";
  return { url: `${scheme}://${name}${port}`, localOnly: LOOPBACK.test(name) };
}
