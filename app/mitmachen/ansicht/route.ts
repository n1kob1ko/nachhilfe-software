import { laptopContext } from "@/lib/laptop-context";
import { parseView, showOnTablet, unitAssignment, unitText } from "@/lib/live";

/** The student switches between the exercises and texts of the unit on the laptop. */
export async function GET(request: Request) {
  // a prefetch is no click: it must not switch anything
  if (request.headers.get("next-router-prefetch") || /prefetch/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "")) {
    return new Response(null, { status: 204 });
  }
  const ctx = await laptopContext();
  const view = parseView(new URL(request.url).searchParams.get("zu") ?? "");
  // the laptop shows exercises and texts of its unit, never the board and never anything else
  const allowed = view.kind === "aufgabe" ? unitAssignment(ctx?.unit.id ?? 0, view.assignmentId) : view.kind === "text" ? ctx && unitText(ctx.unit, view.textId) : view.kind === "start";
  if (ctx && allowed) showOnTablet(ctx.unit, view);
  return new Response(null, { status: 303, headers: { Location: "/mitmachen", "Cache-Control": "no-store" } });
}
