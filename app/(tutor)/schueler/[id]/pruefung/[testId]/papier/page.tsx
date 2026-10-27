import { notFound, redirect } from "next/navigation";
import { BlattEinlesen } from "@/components/BlattEinlesen";
import { PageHeader } from "@/components/ui";
import { parseTime } from "@/lib/analysis";
import { requireTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { blaetterOhneEinheit, blattZurUebung, papierTor } from "@/lib/papier-einheit";
import { notenschluessel, probeTestId } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Arbeit fotografieren" };

const tag = (s: string) => new Date(parseTime(s)).toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "Europe/Vienna" });

/**
 * Arbeit fotografieren für eine Probeschularbeit dieser Schularbeit, ohne laufende Einheit (Gemeinsame Bewertung, C3): derselbe
 * Weg wie im Unterricht (lib/papier-einheit.ts), gegen ihre Aufgaben und die Musterlösung. Das Ergebnis steht auf der
 * Prüfungskarte, offene Antworten in „Zu bewerten“. Läuft eine Einheit, gehört die Arbeit dorthin.
 */
export default async function ProbePapierPage({ params, searchParams }: { params: Promise<{ id: string; testId: string }>; searchParams: Promise<{ uebung?: string }> }) {
  const { id, testId } = await params;
  const sp = await searchParams;
  await requireTeacher();
  const student = repo.getStudent(Number(id));
  const test = repo.getTest(Number(testId));
  if (!student || !test || test.student_id !== student.id) notFound();
  const laufend = runningUnitForStudent(student.id);
  if (laufend) redirect(`/einheiten/${laufend.id}/papier${sp.uebung ? `?uebung=${Number(sp.uebung)}` : ""}`);
  // only the Probeschularbeiten of this Schularbeit, of this student, with open tasks
  const blaetter = blaetterOhneEinheit(student.id).filter((b) => probeTestId(b.worksheetId) === test.id);
  const vor = blattZurUebung(blaetter, Number(sp.uebung) || null) ?? blaetter[0] ?? null;
  const tor = papierTor(student.id);
  const name = student.name.split(" ")[0];
  const fach = test.subject || student.subjects[0] || "Mathematik";
  return (
    <div className="max-w-[820px]">
      <PageHeader
        title="Arbeit fotografieren"
        info={`Für eine Probeschularbeit, die ${name} auf Papier geschrieben hat. Die KI liest die Antworten gegen die Aufgaben und die Musterlösung und schlägt eine Bewertung vor; die App prüft nach, wo sie kann. Du prüfst, erst „Übernehmen“ zählt. Unsichere Antworten kommen in „Zu bewerten“.`}
        back={{ href: `/schueler/${student.id}/pruefung/${test.id}#probeschularbeit`, label: "Zurück zur Vorbereitung" }}
      />
      <BlattEinlesen
        studentId={student.id}
        subjects={[fach]}
        today={dayOf(new Date())}
        tests={[]}
        vorauswahl={null}
        faehigkeiten={{}}
        grenzen={notenschluessel()}
        kiGrund={tor.erlaubt ? null : tor.grund}
        einheit={{
          unitId: null,
          blaetter: blaetter.map((b) => ({ key: b.key, titel: b.titel, wann: `Probeschularbeit vom ${tag(b.am)}`, aufgaben: b.aufgaben, schonFertig: b.schonFertig })),
          vorwahl: vor?.key ?? "",
          kosten: tor.erlaubt ? tor.kosten : null,
          fach,
        }}
      />
    </div>
  );
}
