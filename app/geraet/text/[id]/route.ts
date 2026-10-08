import { currentDevice } from "@/lib/devices";
import { handleTextSave } from "@/lib/text-routes";
import { deviceMayWrite } from "@/lib/texts";

export const dynamic = "force-dynamic";

/** Autosave of a Textarbeit on the student tablet: only texts of the student the tablet's teacher is teaching. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await currentDevice();
  if (!device) return Response.json({ error: "Dieses Tablet ist nicht verbunden." }, { status: 401 });
  return handleTextSave(request, Number((await params).id), { mayWrite: (t) => deviceMayWrite(device.teacher_id, t), by: "schueler" });
}
