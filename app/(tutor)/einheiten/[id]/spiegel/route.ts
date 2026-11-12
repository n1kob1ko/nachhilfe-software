import { currentTeacher } from "@/lib/auth";
import { studentDevice, tabletOnline } from "@/lib/live";
import { spiegelChannel, spiegelMelden } from "@/lib/spiegel";
import { canManageUnit, getUnit } from "@/lib/units";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

/**
 * The student screen of a running unit (lib/spiegel.ts), for the teacher: while this stream is open the
 * tablet records its page and the events arrive here. Opening it asks the tablet for a fresh full picture.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const unit = getUnit(Number((await params).id));
  if (!unit) return new Response("Nicht gefunden.", { status: 404 });
  if (!canManageUnit(teacher, unit)) return new Response("Nicht erlaubt.", { status: 403 });
  if (unit.status !== "gestartet") return new Response("Einheit läuft nicht.", { status: 409 });
  return stream(spiegelChannel(unit.id), request, {
    role: "lehrer",
    name: teacher.name,
    hello: () => ({ type: "hallo", tablet: tabletOnline(unit), laptop: studentDevice(unit) === "laptop" }),
    // after subscribing and after leaving: the tablet starts (with a fresh picture) or stops recording
    onPresence: () => spiegelMelden(unit),
  });
}
