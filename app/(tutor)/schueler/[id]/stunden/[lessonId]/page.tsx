import { notFound } from "next/navigation";
import { LessonForm } from "@/components/LessonForm";
import { PageHeader, formatDate } from "@/components/ui";
import { getLesson, getStudent } from "@/lib/repo";

export default async function EditLesson({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const student = getStudent(Number(id));
  const lesson = getLesson(Number(lessonId));
  if (!student || !lesson || lesson.student_id !== student.id) notFound();
  return (
    <>
      <PageHeader
        title={lesson.status === "geplant" ? "Stunde dokumentieren" : "Stunde bearbeiten"}
        subtitle={`${student.name} · ${formatDate(lesson.starts_at, { weekday: "long", day: "numeric", month: "long" })}`}
        back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }}
      />
      <LessonForm student={student} lesson={lesson} />
    </>
  );
}
