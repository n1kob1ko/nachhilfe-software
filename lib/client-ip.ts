/**
 * The visitor's address for rate limits. Behind Railway's proxy, X-Real-IP is set by the proxy.
 * Otherwise the last X-Forwarded-For entry is the one our own proxy added; earlier entries come
 * from the client and could be made up to dodge the limit.
 */
export function clientIp(h: Pick<Headers, "get">): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "local";
}
