import { notFound } from "next/navigation";
import { ProbeExtern } from "@/components/ProbeExtern";
import { PageHeader, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { faehigkeitenZurProbe, probeTor } from "@/lib/probe-extern";
import * as repo from "@/lib/repo";
import { getUnit } from "@/lib/units";

export const metadata = { title: "Eigene Probeschularbeit" };

/**
 * Eigene Probeschularbeit hochladen (lib/probe-extern.ts): Angabe und Musterlösung zu einer eingetragenen Schularbeit, dann die
 * Prüfansicht. Erreichbar von der Vorbereitung der Schularbeit und im Unterricht unter „Was steht heute an?“ (`einheit`: zurück
 * in den Unterricht).
 */
export default async function EigeneProbePage({ params, searchParams }: { params: Promise<{ id: string; testId: string }>; searchParams: Promise<{ einheit?: string }> }) {
  await requireTeacher();
  const { id, testId } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  const test = repo.getTest(Number(testId));
  if (!student || !test || test.student_id !== student.id) notFound();
  const unit = sp.einheit ? getUnit(Number(sp.einheit)) : null;
  const ausUnterricht = unit && unit.student_id === student.id && unit.status === "gestartet" ? unit : null;
  const tor = probeTor(student.id);
  const name = test.title || `${test.kind} ${test.subject}`;
  return (
    <div className="max-w-[1180px]">
      <PageHeader
        title="Eigene Probeschularbeit"
        subtitle={`${name} am ${formatDate(test.date, { day: "numeric", month: "long" })} · ${student.name.split(" ")[0]}`}
        back={ausUnterricht ? { href: `/einheiten/${ausUnterricht.id}`, label: "Zurück zum Unterricht" } : { href: `/schueler/${student.id}/pruefung/${test.id}#probeschularbeit`, label: "Vorbereitung" }}
        info="Für eine Probeschularbeit, die du außerhalb der App gemacht hast: die Angabe und die Musterlösung als PDF oder Fotos. Ein PDF mit Text liest die App selbst; sonst liest die KI auf Tippen. Du prüfst jede Teilaufgabe mit Punkten und Lösung, erst „Übernehmen“ legt sie an. Der Schüler schreibt sie am Gerät oder auf Papier, die Musterlösung sieht er nicht."
      />
      <ProbeExtern studentId={student.id} testId={test.id} titelVorschlag={name} skills={faehigkeitenZurProbe(student, test)} kiGrund={tor.erlaubt ? null : tor.grund} />
    </div>
  );
}
