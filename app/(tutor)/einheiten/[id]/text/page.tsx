import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { StartTextForm } from "@/components/text/StartTextForm";
import { requireTeacher } from "@/lib/auth";
import { fachNamen } from "@/lib/faecher";
import { getStudent } from "@/lib/repo";
import { TEXT_KINDS } from "@/lib/texts";
import { studentDevice } from "@/lib/live";
import { canManageUnit, getUnit } from "@/lib/units";
import { schreibStartFuer } from "@/lib/textarbeit-ablauf";

export const metadata = { title: "Textarbeit starten" };

/** Texts are written in a language subject: the unit's if it is one, else the student's (Deutsch first). */
function textSubject(unitSubject: string, subjects: string[]) {
  const languages = ["Deutsch", "Englisch"];
  if (languages.includes(unitSubject)) return unitSubject;
  return languages.find((l) => subjects.includes(l)) ?? (unitSubject || "Deutsch");
}

export default async function StartTextPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ schreiben?: string }> }) {
  const { id } = await params;
  const { schreiben } = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  // „Schreibauftrag starten“ in a step of the guided lesson: prefilled from the Vorgabe, the exam material or the skill
  const start = schreiben ? schreibStartFuer(unit, schreiben) : null;
  if (start && start.art !== "text") redirect(start.href);
  const vorlage = start?.art === "text" ? { titel: start.titel, textsorte: start.textsorte, aufgabe: start.aufgabe, quelle: start.quelle } : null;
  return (
    <div className="max-w-[720px]">
      <PageHeader
        title={`Textarbeit für ${name}`}
        info="Ein längerer Text, den der Schüler in der Einheit schreibt. Er wird laufend gespeichert und kann in späteren Einheiten weitergeschrieben werden."
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }}
      />
      <StartTextForm
        unitId={unit.id}
        subject={start?.art === "text" ? start.fach : textSubject(unit.subject, student.subjects)}
        subjects={fachNamen()}
        kinds={TEXT_KINDS}
        device={studentDevice(unit)}
        name={name}
        vorlage={vorlage}
      />
    </div>
  );
}
