import { pageBelongsTo, pagePreview } from "@/lib/whiteboard";
import { teacherAccess } from "@/lib/whiteboard-access";
import { previewResponse } from "@/lib/whiteboard-routes";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ unitId: string; pageId: string }> }) {
  const { unitId, pageId } = await params;
  const a = await teacherAccess(unitId);
  if ("error" in a) return a.error;
  if (!pageBelongsTo(Number(pageId), a.board.id)) return new Response("Nicht gefunden.", { status: 404 });
  return previewResponse(pagePreview(Number(pageId)));
}
