import { teacherAccess } from "@/lib/whiteboard-access";
import { eventStream } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const a = await teacherAccess((await params).unitId);
  return "error" in a ? a.error : eventStream(a.board, a.viewer, request);
}
