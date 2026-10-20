import { currentDevice, deviceUnit, touchDevice } from "@/lib/devices";
import { deviceChannel, pushTabletPresence } from "@/lib/live";
import { stream } from "@/lib/whiteboard-hub";

export const dynamic = "force-dynamic";

/** Live stream of a tablet: it is told when its teacher starts or ends a unit or sends something to its unit. */
export async function GET(request: Request) {
  const device = await currentDevice();
  if (!device) return new Response("Nicht verbunden.", { status: 401 });
  return stream(deviceChannel(device.id), request, {
    role: "schueler",
    name: device.name,
    // the tablet compares this with what it shows, so nothing is missed while it was offline
    hello: () => {
      const { unit, choices } = deviceUnit(device);
      return { type: "hello", unitId: unit?.id ?? null, choosing: choices.length > 0 };
    },
    onAlive: () => touchDevice(device.id),
    onPresence: () => pushTabletPresence(device.teacher_id),
  });
}
