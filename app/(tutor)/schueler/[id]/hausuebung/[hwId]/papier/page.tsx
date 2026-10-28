import { notFound, redirect } from "next/navigation";
import { BlattEinlesen } from "@/components/BlattEinlesen";
import { PageHeader } from "@/components/ui";
import { parseTime } from "@/lib/analysis";
import { requireTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { blaetterOhneEinheit, papierTor } from "@/lib/papier-einheit";
import { notenschluessel } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Arbeit fotografieren" };

const tag = (s: string) => new Date(parseTime(s)).toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "Europe/Vienna" });

/**
 * Arbeit fotografieren für eine Hausübung, die auf Papier gemacht wurde, ohne laufende Einheit (Hausübung zurück, E2): derselbe Weg
 * wie im Unterricht (lib/papier-einheit.ts), gegen die Aufgaben der Hausübung. Die Antworten zählen wie am Gerät, unsichere kommen in
 * „Zu bewerten“. Läuft eine Einheit, gehört die Arbeit dorthin (das Blatt ist dort zur Wahl).
 */
export default async function HausuebungPapierPage({ params }: { params: Promise<{ id: string; hwId: string }> }) {
  const { id, hwId } = await params;
  await requireTeacher();
  const student = repo.getStudent(Number(id));
  const hw = repo.listHomework(Number(id)).find((h) => h.id === Number(hwId));
  if (!student || !hw?.assignment_id) notFound();
  const laufend = runningUnitForStudent(student.id);
  const a = repo.getAssignment(hw.assignment_id);
  if (laufend) redirect(`/einheiten/${laufend.id}/papier${a ? `?uebung=${a.worksheet_id}` : ""}`);
  // only this homework of this student, with open tasks
  const blaetter = blaetterOhneEinheit(student.id).filter((b) => b.homeworkId === hw.id);
  const tor = papierTor(student.id);
  const name = student.name.split(" ")[0];
  const fach = hw.subject || student.subjects[0] || "Mathematik";
  return (
    <div className="max-w-[820px]">
      <PageHeader
        title="Arbeit fotografieren"
        info={`Für eine Hausübung, die ${name} auf Papier gemacht hat. Die KI liest die Antworten gegen die Aufgaben der Hausübung und schlägt eine Bewertung vor; die App prüft nach, wo sie kann. Du prüfst, erst „Übernehmen“ zählt. Unsichere Antworten kommen in „Zu bewerten“.`}
        back={{ href: `/schueler/${student.id}?tab=schule`, label: "Zurück zum Profil" }}
      />
      {blaetter.length ? (
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
            blaetter: blaetter.map((b) => ({ key: b.key, titel: b.titel, wann: `Hausübung vom ${tag(b.am)}`, aufgaben: b.aufgaben, schonFertig: b.schonFertig })),
            vorwahl: blaetter[0].key,
            kosten: tor.erlaubt ? tor.kosten : null,
            fach,
          }}
        />
      ) : (
        <p className="panel px-5 py-4 text-[15px] text-ink-2">Zu dieser Hausübung ist keine Aufgabe mehr offen.</p>
      )}
    </div>
  );
}
