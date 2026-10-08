import { FlowSteps } from "@/components/FlowSteps";
import { ReadingBuilderForm } from "@/components/ReadingBuilderForm";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { getStudent, listStudents } from "@/lib/repo";

export const metadata = { title: "Leseverständnis erstellen" };

export default async function NewReading({ searchParams }: { searchParams: Promise<{ schueler?: string }> }) {
  const sp = await searchParams;
  const studentId = Number(sp.schueler) || null;
  const student = studentId ? getStudent(studentId) : null;
  return (
    <>
      <PageHeader
        title="Leseverständnis erstellen"
        info="Ein längerer Text mit mehreren Fragen dazu, wie ein Arbeitsblatt in der Schule. Am Laptop sieht der Schüler den Text links und die Fragen rechts."
        back={student ? { href: `/schueler/${student.id}`, label: student.name } : { href: "/uebungen/neu", label: "Übung erstellen" }}
      />
      <FlowSteps current={1} />
      <ReadingBuilderForm
        students={listStudents().map((s) => ({ id: s.id, name: s.name, schoolType: s.school_type, klasse: s.klasse, subjects: s.subjects }))}
        studentId={student?.id ?? null}
        aiEnabled={aiEnabled("lesen")}
      />
    </>
  );
}
