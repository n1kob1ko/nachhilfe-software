import { notFound, redirect } from "next/navigation";
import { createAuftragAction } from "@/app/schreibauftrag-actions";
import { PageHeader } from "@/components/ui";
import { SchreibauftragForm } from "@/components/text/interpretation/SchreibauftragForm";
import { SortePicker } from "@/components/text/interpretation/SortePicker";
import { requireTeacher } from "@/lib/auth";
import { studentDevice } from "@/lib/live";
import { getStudent } from "@/lib/repo";
import { isSorte, SORTEN } from "@/lib/schreibauftrag";
import { beilageZurPruefung, pruefungenFuerAuftrag } from "@/lib/schreibauftrag-store";
import { schulstufe } from "@/lib/school";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Schreibauftrag" };

const INFO = "Ein Schreibauftrag wie bei der Schularbeit und der Matura: Du fügst die ganze Textbeilage ein, sie bekommt Zeilennummern. Beim Schreiben sieht der Schüler den Text, den Schreibplan und wie weit er ist.";

/** A Schreibauftrag in a running unit: first the Textsorte, then Textbeilage and Arbeitsauftrag. */
export default async function NewAuftragInUnitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sorte?: string; pruefung?: string }> }) {
  const { id } = await params;
  const { sorte, pruefung } = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  if (!isSorte(sorte)) {
    return (
      <div className="max-w-[860px]">
        <PageHeader title={`Schreibauftrag für ${name}`} subtitle="Welche Textsorte soll geschrieben werden?" info={INFO} back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }} />
        <SortePicker base={`/einheiten/${unit.id}/schreibauftrag`} stufe={student.klasse ? schulstufe(student.school_type, student.klasse) : null} pruefung={Number(pruefung) || undefined} />
      </div>
    );
  }
  const pruefungen = pruefungenFuerAuftrag(student.id);
  const pruefungId = pruefungen.some((p) => p.id === Number(pruefung)) ? Number(pruefung) : null;
  return (
    <div className="max-w-[860px]">
      <PageHeader title={`${SORTEN[sorte].name} für ${name}`} info={INFO} back={{ href: `/einheiten/${unit.id}/schreibauftrag`, label: "Andere Textsorte" }} />
      <SchreibauftragForm
        sorte={sorte}
        action={createAuftragAction.bind(null, sorte, { unitId: unit.id })}
        device={studentDevice(unit)}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={student.id}
        stufe={student.klasse ? schulstufe(student.school_type, student.klasse) : null}
        pruefungen={pruefungen}
        pruefung={pruefungId}
        vorlage={pruefungId ? beilageZurPruefung(pruefungId, sorte) : null}
        submitLabel="Schreibauftrag erstellen"
      />
    </div>
  );
}
