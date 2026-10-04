import { notFound } from "next/navigation";
import { LessonForm } from "@/components/LessonForm";
import { PageHeader } from "@/components/ui";
import { getStudent } from "@/lib/repo";

export default async function NewLesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = getStudent(Number(id));
  if (!student) notFound();
  return (
    <>
      <PageHeader title="Nachhilfestunde" subtitle={student.name} back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }} />
      <LessonForm student={student} />
    </>
  );
}
