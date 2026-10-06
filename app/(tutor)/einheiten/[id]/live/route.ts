import { currentTeacher } from "@/lib/auth";
import { liveSnapshot, unitChannel } from "@/lib/live";
import { getUnit } from "@/lib/units";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

/** Live status of a unit for the teacher's laptop: tablet, current task, tries, hints, answers. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const unit = getUnit(Number((await params).id));
  if (!unit) return new Response("Nicht gefunden.", { status: 404 });
  return stream(unitChannel(unit.id), request, {
    role: "lehrer",
    name: teacher.name,
    hello: () => ({ type: "live", snapshot: liveSnapshot(unit.id) }),
  });
}
