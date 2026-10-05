import { studentAccess } from "@/lib/whiteboard-access";
import { sync } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const a = studentAccess((await params).token, new URL(request.url).searchParams.get("einheit"));
  return "error" in a ? a.error : sync(a.board, a.viewer, request);
}
