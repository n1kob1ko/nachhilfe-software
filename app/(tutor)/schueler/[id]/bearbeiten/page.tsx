import { notFound } from "next/navigation";
import { deleteStudentAction } from "@/app/actions";
import { StudentForm } from "@/components/StudentForm";
import { PageHeader } from "@/components/ui";
import { getStudent } from "@/lib/repo";

export default async function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = getStudent(Number(id));
  if (!student) notFound();
  return (
    <>
      <PageHeader title={`${student.name} bearbeiten`} back={{ href: `/schueler/${student.id}`, label: student.name }} />
      <StudentForm student={student} />
      <form action={deleteStudentAction.bind(null, student.id)} className="mt-12 max-w-[760px] border-t border-line pt-6">
        <p className="mb-3 text-[14px] text-ink-2">Löscht den Schüler mit allen Einheiten, Hausübungen, Tests und Übungsergebnissen.</p>
        <button className="btn btn-danger border border-[#e8c3bf]">Schüler endgültig löschen</button>
      </form>
    </>
  );
}
