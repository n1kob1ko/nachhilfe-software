import { notFound, redirect } from "next/navigation";
import { createInterpretationAction } from "@/app/textinterpretation-actions";
import { PageHeader } from "@/components/ui";
import { InterpretationForm } from "@/components/text/interpretation/InterpretationForm";
import { requireTeacher } from "@/lib/auth";
import { studentDevice } from "@/lib/live";
import { getStudent } from "@/lib/repo";
import { DEFAULT_TARGET } from "@/lib/textinterpretation";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Textinterpretation" };

export default async function NewInterpretationInUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  return (
    <div className="max-w-[860px]">
      <PageHeader
        title={`Textinterpretation für ${name}`}
        info="Ein Schreibauftrag wie bei der Schularbeit: Du fügst die ganze Geschichte ein, sie bekommt Zeilennummern. Beim Schreiben sieht der Schüler den Text, den Schreibplan und wie weit er ist."
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }}
      />
      <InterpretationForm
        action={createInterpretationAction.bind(null, { unitId: unit.id })}
        defaults={{ title: "", author: "", year: "", kind: "Kurzgeschichte", story: "", countBlank: false, target: DEFAULT_TARGET, prompt: "", sourceNote: "" }}
        device={studentDevice(unit)}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={student.id}
        submitLabel="Schreibauftrag erstellen"
      />
    </div>
  );
}
