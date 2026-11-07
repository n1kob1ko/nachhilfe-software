import { notFound } from "next/navigation";
import { LessonForm } from "@/components/LessonForm";
import { PageHeader } from "@/components/ui";
import { getStudent } from "@/lib/repo";
import { istDatum, minutenLabel } from "@/lib/planung/zeit";

export default async function NewLesson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; datum?: string; start?: string; dauer?: string }> }) {
  const { id } = await params;
  const { fehler, datum, start, dauer } = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  // „Nachtragen“ zu einem Platz ohne Einheit (lib/heute.ts nachtragenHref): Datum, Uhrzeit und Dauer stehen schon da
  const startMin = Number(start);
  const vorgabe = datum && istDatum(datum) && Number.isInteger(startMin) && startMin >= 0 ? { starts_at: `${datum}T${minutenLabel(startMin)}`, duration_min: Math.max(0, Math.round(Number(dauer))) || 0 } : undefined;
  return (
    <>
      <PageHeader title="Einheit nachtragen oder planen" subtitle={student.name} back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }} />
      <LessonForm fehler={fehler} student={student} vorgabe={vorgabe} />
    </>
  );
}
