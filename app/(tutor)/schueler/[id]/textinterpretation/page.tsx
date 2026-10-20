import { notFound } from "next/navigation";
import { createInterpretationAction } from "@/app/textinterpretation-actions";
import { PageHeader } from "@/components/ui";
import { InterpretationForm } from "@/components/text/interpretation/InterpretationForm";
import { requireTeacher } from "@/lib/auth";
import { studentDevice } from "@/lib/live";
import { getStudent } from "@/lib/repo";
import { DEFAULT_TARGET } from "@/lib/textinterpretation";
import { textFotoLesbar } from "@/lib/textinterpretation-foto";
import { canManageUnit, runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Textinterpretation" };

/**
 * A Textinterpretation for a student outside a unit (from the builder or the student page). While a unit
 * with the student runs, the text belongs to it and can open on the student's device at once.
 */
export default async function NewInterpretationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const student = getStudent(Number(id));
  if (!student) notFound();
  const name = student.name.split(" ")[0];
  const running = runningUnitForStudent(student.id);
  const unit = running && canManageUnit(teacher, running) ? running : null;
  return (
    <div className="max-w-[860px]">
      <PageHeader
        title={`Textinterpretation für ${name}`}
        info="Ein Schreibauftrag wie bei der Schularbeit: Du fügst die ganze Geschichte ein, sie bekommt Zeilennummern. Beim Schreiben sieht der Schüler den Text, den Schreibplan und wie weit er ist."
        back={{ href: `/schueler/${student.id}`, label: student.name }}
      />
      <InterpretationForm
        action={createInterpretationAction.bind(null, { studentId: student.id })}
        defaults={{ title: "", author: "", year: "", kind: "Kurzgeschichte", story: "", countBlank: false, target: DEFAULT_TARGET, prompt: "", sourceNote: "" }}
        device={unit ? studentDevice(unit) : undefined}
        name={name}
        kiLiest={textFotoLesbar().ok}
        studentId={student.id}
        submitLabel="Schreibauftrag erstellen"
        note={unit ? undefined : `Gerade läuft keine Einheit mit ${name}. Der Schreibauftrag wartet im Lernverlauf und lässt sich in der nächsten Einheit am Tablet öffnen.`}
      />
    </div>
  );
}
