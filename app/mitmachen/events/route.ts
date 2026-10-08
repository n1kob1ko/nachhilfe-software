import { currentLaptop } from "@/lib/laptop-context";
import { getLaptop, laptopChannel, laptopState, touchLaptop } from "@/lib/laptop";
import { pushLive } from "@/lib/live";
import { getUnit } from "@/lib/units";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

const ended = () =>
  new Response(`data: ${JSON.stringify({ type: "ended" })}\n\n`, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" } });

/** Live stream of a student laptop: confirmed, new exercise or text, access over. */
export async function GET(request: Request) {
  const session = await currentLaptop();
  const state = session ? laptopState(session) : null;
  // no access (any more): the page leaves the work area
  if (!session || (state !== "wartet" && state !== "aktiv")) return ended();
  return stream(laptopChannel(session.id), request, {
    role: "schueler",
    name: session.label,
    // the laptop compares this with what it shows, so nothing is missed while it was offline
    hello: () => {
      const now = getLaptop(session.id);
      const s = now ? laptopState(now) : "beendet";
      return { type: "hello", state: s, view: s === "aktiv" ? (getUnit(session.unit_id)?.device_view ?? "") : "" };
    },
    onAlive: () => touchLaptop(session.id),
    // the teacher sees "Laptop verbunden / offline"
    onPresence: () => pushLive(session.unit_id),
  });
}
