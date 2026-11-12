import { deviceContext } from "@/lib/device-context";
import { spiegelAktiv, spiegelSenden } from "@/lib/spiegel";

export const dynamic = "force-dynamic";

/** Generous: a full picture with the images of a page inlined can be a few MB. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * The tablet sends what it recorded of its own page (lib/spiegel.ts). Only while its unit runs and a
 * teacher watches; otherwise the answer tells the tablet to stop recording.
 */
export async function POST(request: Request) {
  const ctx = await deviceContext();
  if (!ctx?.unit || ctx.unit.status !== "gestartet") return Response.json({ an: false });
  if (!spiegelAktiv(ctx.unit.id)) return Response.json({ an: false });
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return Response.json({ an: true, zuGross: true }, { status: 413 });
  const body = (await request.json().catch(() => null)) as { events?: unknown } | null;
  if (!body || !Array.isArray(body.events) || !body.events.length) return Response.json({ an: true });
  spiegelSenden(ctx.unit.id, body.events);
  return Response.json({ an: true });
}
