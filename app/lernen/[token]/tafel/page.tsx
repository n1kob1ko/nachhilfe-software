import { notFound } from "next/navigation";
import { WaitForBoard } from "@/components/whiteboard/WaitForBoard";
import { WhiteboardLoader } from "@/components/whiteboard/WhiteboardLoader";
import { getStudentByToken } from "@/lib/repo";
import { runningUnitForStudent } from "@/lib/units";
import { ensureBoardForUnit } from "@/lib/whiteboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tafel", appleWebApp: { capable: true, title: "Tafel" } };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

/** The student's tablet view: the board of the running unit, or a wait screen until the teacher starts one. */
export default async function StudentBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = getStudentByToken(token);
  if (!student) notFound();
  const unit = runningUnitForStudent(student.id);
  if (!unit) return <WaitForBoard name={student.name.split(" ")[0]} backHref={`/lernen/${token}`} />;
  ensureBoardForUnit(unit.id);
  return <WhiteboardLoader role="schueler" endpoint={`/lernen/${token}/tafel`} query={`?einheit=${unit.id}`} studentName={student.name} backHref={`/lernen/${token}`} />;
}
