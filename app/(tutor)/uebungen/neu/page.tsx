import { BuilderForm } from "@/components/BuilderForm";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { listSkills, listStudents } from "@/lib/repo";

export const metadata = { title: "Übung erstellen" };

export default async function NewWorksheet({ searchParams }: { searchParams: Promise<{ schueler?: string; skill?: string }> }) {
  const sp = await searchParams;
  const ai = aiEnabled();
  return (
    <>
      <PageHeader
        title="Übung erstellen"
        subtitle={ai ? "Claude erstellt Aufgaben, Lösungswege, Hilfen und typische Fehler." : "Aufgaben und Lösungswege kommen aus den eingebauten Generatoren."}
        back={{ href: "/uebungen", label: "Übungen" }}
      />
      <BuilderForm
        skills={listSkills()}
        students={listStudents().map(({ id, name, grade, school_type, subjects }) => ({ id, name, grade, school_type, subjects }))}
        initialStudentId={sp.schueler ? Number(sp.schueler) : undefined}
        aiEnabled={ai}
        preset={sp.skill ? { skillIds: [sp.skill] } : undefined}
      />
    </>
  );
}
