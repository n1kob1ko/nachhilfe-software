import { notFound } from "next/navigation";
import { createAuftragAction } from "@/app/schreibauftrag-actions";
import { PageHeader } from "@/components/ui";
import { SchreibauftragForm } from "@/components/text/interpretation/SchreibauftragForm";
import { SortePicker } from "@/components/text/interpretation/SortePicker";
import { requireTeacher } from "@/lib/auth";
import { studentDevice } from "@/lib/live";
import { getStudent } from "@/lib/repo";
import { isSorte, SORTEN } from "@/lib/schreibauftrag";
import { pruefungenFuerAuftrag } from "@/lib/schreibauftrag-store";
import { schulstufe } from "@/lib/school";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { canManageUnit, runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Schreibauftrag" };

const INFO = "Ein Schreibauftrag wie bei der Schularbeit und der Matura: Du fügst die ganze Textbeilage ein, sie bekommt Zeilennummern. Beim Schreiben sieht der Schüler den Text, den Schreibplan und wie weit er ist.";

/**
 * A Schreibauftrag for a student outside a unit (from the builder or the student page). While a unit with the
 * student runs, the text belongs to it and can open on the student's device at once.
 */
export default async function NewAuftragPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sorte?: string; pruefung?: string }> }) {
  const { id } = await params;
  const { sorte, pruefung } = await searchParams;
  const teacher = await requireTeacher();
  const student = getStudent(Number(id));
  if (!student) notFound();
  const name = student.name.split(" ")[0];
  if (!isSorte(sorte)) {
    return (
      <div className="max-w-[860px]">
        <PageHeader title={`Schreibauftrag für ${name}`} subtitle="Welche Textsorte soll geschrieben werden?" info={INFO} back={{ href: `/schueler/${student.id}`, label: student.name }} />
        <SortePicker base={`/schueler/${student.id}/schreibauftrag`} stufe={student.klasse ? schulstufe(student.school_type, student.klasse) : null} pruefung={Number(pruefung) || undefined} />
      </div>
    );
  }
  const running = runningUnitForStudent(student.id);
  const unit = running && canManageUnit(teacher, running) ? running : null;
  const pruefungen = pruefungenFuerAuftrag(student.id);
  return (
    <div className="max-w-[860px]">
      <PageHeader title={`${SORTEN[sorte].name} für ${name}`} info={INFO} back={{ href: `/schueler/${student.id}/schreibauftrag`, label: "Andere Textsorte" }} />
      <SchreibauftragForm
        sorte={sorte}
        action={createAuftragAction.bind(null, sorte, { studentId: student.id })}
        device={unit ? studentDevice(unit) : undefined}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={student.id}
        stufe={student.klasse ? schulstufe(student.school_type, student.klasse) : null}
        pruefungen={pruefungen}
        pruefung={pruefungen.some((p) => p.id === Number(pruefung)) ? Number(pruefung) : null}
        submitLabel="Schreibauftrag erstellen"
        note={unit ? undefined : `Gerade läuft keine Einheit mit ${name}. Der Schreibauftrag wartet im Lernverlauf und lässt sich in der nächsten Einheit am Tablet öffnen.`}
      />
    </div>
  );
}
