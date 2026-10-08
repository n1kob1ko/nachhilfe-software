import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { StartTextForm } from "@/components/text/StartTextForm";
import { requireTeacher } from "@/lib/auth";
import { SUBJECTS } from "@/lib/curriculum";
import { hasDevice } from "@/lib/devices";
import { getStudent } from "@/lib/repo";
import { TEXT_KINDS } from "@/lib/texts";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Textarbeit starten" };

/** Texts are written in a language subject: the unit's if it is one, else the student's (Deutsch first). */
function textSubject(unitSubject: string, subjects: string[]) {
  const languages = ["Deutsch", "Englisch"];
  if (languages.includes(unitSubject)) return unitSubject;
  return languages.find((l) => subjects.includes(l)) ?? (unitSubject || "Deutsch");
}

export default async function StartTextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  return (
    <div className="max-w-[720px]">
      <PageHeader
        title={`Textarbeit für ${name}`}
        info="Ein längerer Text, den der Schüler in der Einheit schreibt. Er wird laufend gespeichert und kann in späteren Einheiten weitergeschrieben werden."
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }}
      />
      <StartTextForm unitId={unit.id} subject={textSubject(unit.subject, student.subjects)} subjects={[...SUBJECTS]} kinds={TEXT_KINDS} paired={hasDevice(unit.teacher_id)} name={name} />
    </div>
  );
}
