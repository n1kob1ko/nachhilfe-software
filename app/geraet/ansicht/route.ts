import { deviceContext } from "@/lib/device-context";
import { parseView, showOnTablet, unitAssignment } from "@/lib/live";

/** The student switches between the exercises and the whiteboard on the tablet. */
export async function GET(request: Request) {
  // a prefetch is no tap: it must not switch the tablet
  if (request.headers.get("next-router-prefetch") || /prefetch/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "")) {
    return new Response(null, { status: 204 });
  }
  const ctx = await deviceContext();
  const view = parseView(new URL(request.url).searchParams.get("zu") ?? "");
  if (ctx?.unit && (view.kind !== "aufgabe" || unitAssignment(ctx.unit.id, view.assignmentId))) showOnTablet(ctx.unit, view);
  return new Response(null, { status: 303, headers: { Location: "/geraet", "Cache-Control": "no-store" } });
}
