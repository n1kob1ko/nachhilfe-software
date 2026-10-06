import { deviceBoardAccess } from "@/lib/device-board";
import { eventStream } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = await deviceBoardAccess(new URL(request.url).searchParams.get("einheit"));
  return "error" in a ? a.error : eventStream(a.board, a.viewer, request);
}
