import { teacherAccess } from "@/lib/whiteboard-access";
import { sync } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const a = await teacherAccess((await params).unitId);
  return "error" in a ? a.error : sync(a.board, a.viewer, request);
}
