import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { PictureStoryForm } from "@/components/text/story/PictureStoryForm";
import { requireTeacher } from "@/lib/auth";
import { SUBJECTS } from "@/lib/curriculum";
import { studentDevice } from "@/lib/live";
import { LINE_CHOICES, SOURCE_KINDS } from "@/lib/picture-story";
import { getStudent } from "@/lib/repo";
import { levelFor } from "@/lib/text-correction-rules";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Bildgeschichte erstellen" };

/** Room to write on paper by default: younger students write shorter stories. */
const defaultLines = (band: string) => (band === "volksschule" ? 14 : band === "unterstufe" ? 26 : 40);

export default async function NewPictureStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  const level = levelFor(student.school_type, student.klasse);
  return (
    <div className="max-w-[980px]">
      <PageHeader
        title={`Bildgeschichte für ${name}`}
        info="Eine Bilderfolge, zu der der Schüler eine Geschichte schreibt. Die Bilder bleiben beim Schreiben sichtbar, der Text wird laufend gespeichert und lässt sich korrigieren und auf A4 drucken."
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }}
      />
      <PictureStoryForm
        action="/material/bildgeschichte/neu"
        unitId={unit.id}
        defaults={{
          title: "",
          subject: student.subjects.includes("Deutsch") || !student.subjects.includes("Englisch") ? "Deutsch" : "Englisch",
          prompt: "Schau dir die Bilder genau an. Schreibe dazu eine spannende Geschichte mit Einleitung, Hauptteil und Schluss. Gib ihr eine passende Überschrift.",
          schoolType: student.school_type,
          klasse: student.klasse,
          targetWords: null,
          starters: [],
          hints: "",
          lines: defaultLines(level.band),
          sourceKind: "",
          sourceNote: "",
        }}
        subjects={[...SUBJECTS]}
        lineChoices={LINE_CHOICES}
        sourceKinds={SOURCE_KINDS}
        device={studentDevice(unit)}
        name={name}
        submitLabel="Bildgeschichte erstellen"
        cancelHref={`/einheiten/${unit.id}`}
      />
    </div>
  );
}
