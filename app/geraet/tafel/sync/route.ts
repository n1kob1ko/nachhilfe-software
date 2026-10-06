import { deviceBoardAccess } from "@/lib/device-board";
import { sync } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const a = await deviceBoardAccess(new URL(request.url).searchParams.get("einheit"));
  return "error" in a ? a.error : sync(a.board, a.viewer, request);
}
