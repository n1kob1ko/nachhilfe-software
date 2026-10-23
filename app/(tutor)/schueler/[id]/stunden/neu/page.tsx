import { notFound } from "next/navigation";
import { LessonForm } from "@/components/LessonForm";
import { PageHeader } from "@/components/ui";
import { getStudent } from "@/lib/repo";

export default async function NewLesson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const { id } = await params;
  const { fehler } = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  return (
    <>
      <PageHeader title="Einheit nachtragen oder planen" subtitle={student.name} back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }} />
      <LessonForm fehler={fehler} student={student} />
    </>
  );
}
