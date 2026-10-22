/**
 * Is the current request for the presentation address? Then no session counts: proxy.ts already answers
 * nothing there but deck files, and this keeps teacher, tablet and laptop sessions out even if a cookie
 * for that host exists (e.g. from before PRESENTATION_ORIGIN was set). Server side only.
 */
import { headers } from "next/headers";
import { aufDeckHost } from "./praesentation-host";

export async function aufPraesentationsAdresse(): Promise<boolean> {
  if (!process.env.PRESENTATION_ORIGIN) return false;
  const h = await headers();
  return aufDeckHost({ host: h.get("host"), forwardedHost: h.get("x-forwarded-host") });
}
