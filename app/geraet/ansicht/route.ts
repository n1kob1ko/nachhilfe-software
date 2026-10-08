import { deviceContext } from "@/lib/device-context";
import { activeLaptop } from "@/lib/laptop";
import { parseView, showOnTablet, unitAssignment, unitText } from "@/lib/live";

/** The student switches between the exercises, a Textarbeit and the whiteboard on the tablet. */
export async function GET(request: Request) {
  // a prefetch is no tap: it must not switch the tablet
  if (request.headers.get("next-router-prefetch") || /prefetch/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "")) {
    return new Response(null, { status: 204 });
  }
  const ctx = await deviceContext();
  const view = parseView(new URL(request.url).searchParams.get("zu") ?? "");
  const allowed = view.kind === "aufgabe" ? unitAssignment(ctx?.unit?.id ?? 0, view.assignmentId) : view.kind === "text" ? ctx?.unit && unitText(ctx.unit, view.textId) : true;
  // while the student works on a laptop the tablet only opens and leaves the board, it never moves the laptop on
  const laptop = ctx?.unit ? activeLaptop(ctx.unit.id) : null;
  const tabletOnly = !laptop || view.kind === "tafel" || (view.kind === "start" && ctx?.unit?.device_view === "tafel");
  if (ctx?.unit && allowed && tabletOnly) showOnTablet(ctx.unit, view);
  return new Response(null, { status: 303, headers: { Location: "/geraet", "Cache-Control": "no-store" } });
}
