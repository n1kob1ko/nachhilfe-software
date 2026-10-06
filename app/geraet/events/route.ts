import { currentDevice, touchDevice } from "@/lib/devices";
import { deviceChannel, pushTabletPresence } from "@/lib/live";
import { activeUnitForTeacher } from "@/lib/units";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

/** Live stream of a tablet: it is told when its teacher starts or ends a unit or sends something. */
export async function GET(request: Request) {
  const device = await currentDevice();
  if (!device) return new Response("Nicht verbunden.", { status: 401 });
  return stream(deviceChannel(device.teacher_id), request, {
    role: "schueler",
    name: device.name,
    // the tablet compares this with what it shows, so nothing is missed while it was offline
    hello: () => ({ type: "hello", unitId: activeUnitForTeacher(device.teacher_id)?.id ?? null }),
    onAlive: () => touchDevice(device.id),
    onPresence: () => pushTabletPresence(device.teacher_id),
  });
}
