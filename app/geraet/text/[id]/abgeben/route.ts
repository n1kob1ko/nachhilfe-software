import { currentDevice } from "@/lib/devices";
import { handleHandIn } from "@/lib/text-routes";
import { deviceMayWrite } from "@/lib/texts";

export const dynamic = "force-dynamic";

/** "Abgeben" of a Bildgeschichte on the student tablet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await currentDevice();
  if (!device) return Response.json({ error: "Dieses Tablet ist nicht verbunden." }, { status: 401 });
  return handleHandIn(request, Number((await params).id), { mayWrite: (t) => deviceMayWrite(device.teacher_id, t) });
}
