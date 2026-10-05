import { notFound } from "next/navigation";
import { endUnitAction } from "@/app/session-actions";
import { WhiteboardLoader } from "@/components/whiteboard/WhiteboardLoader";
import { requireTeacher } from "@/lib/auth";
import { getStudent } from "@/lib/repo";
import { getUnit } from "@/lib/units";
import { ensureBoardForUnit } from "@/lib/whiteboard";
import { worksheetsForBoard } from "@/lib/whiteboard-content";

export const metadata = { title: "Whiteboard" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

/** The teacher's view of the unit's whiteboard (full screen, without the app's side bar). */
export default async function TeacherBoardPage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<{ seite?: string }> }) {
  await requireTeacher();
  const unit = getUnit(Number((await params).unitId));
  if (!unit || !ensureBoardForUnit(unit.id)) notFound();
  const student = getStudent(unit.student_id)!;
  return (
    <WhiteboardLoader
      role="lehrer"
      endpoint={`/tafel/${unit.id}`}
      query=""
      studentName={student.name}
      backHref={`/einheiten/${unit.id}`}
      initialPageId={Number((await searchParams).seite) || undefined}
      worksheets={worksheetsForBoard(student.id)}
      endUnit={unit.status === "gestartet" ? endUnitAction.bind(null, unit.id) : undefined}
    />
  );
}
