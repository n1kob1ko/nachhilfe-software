import { notFound, redirect } from "next/navigation";
import { BlattEinlesen } from "@/components/BlattEinlesen";
import { PageHeader } from "@/components/ui";
import { parseTime } from "@/lib/analysis";
import { requireTeacher } from "@/lib/auth";
import { faehigkeitenFuer } from "@/lib/blatt-einlesen";
import { dayOf } from "@/lib/exams";
import { ANDERES_BLATT, blaetterDerEinheit, blattZurUebung, papierTor, type PapierBlatt } from "@/lib/papier-einheit";
import { notenschluessel } from "@/lib/probeschularbeit";
import { getStudent } from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Arbeit fotografieren" };

const uhr = (s: string) => new Date(parseTime(s)).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
const WANN: Record<PapierBlatt["art"], string> = { gesendet: "gesendet um", minitest: "Minitest, erstellt um", gedruckt: "gedruckt um", erstellt: "erstellt um", probe: "Probeschularbeit vom" };
const tag = (s: string) => new Date(parseTime(s)).toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "Europe/Vienna" });

/**
 * Arbeit fotografieren (lib/papier-einheit.ts) in a running unit: the sheet the student solved on paper (one of the unit,
 * the latest or the one of the step preselected), its pages, then the same preview as „Gelöstes Blatt einlesen“ with the
 * original tasks. Nothing counts before „Übernehmen“.
 */
export default async function PapierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ uebung?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  const blaetter = blaetterDerEinheit(unit.id);
  // the sheet of the step it was opened from, else the latest
  const vor = blattZurUebung(blaetter, Number(sp.uebung) || null) ?? blaetter[0] ?? null;
  const tor = papierTor(student.id);
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const fach = unit.subject && subjects.includes(unit.subject) ? unit.subject : subjects[0];
  const faehigkeiten = Object.fromEntries(subjects.map((f) => [f, faehigkeitenFuer(student, f)]));
  return (
    <div className="max-w-[820px]">
      <PageHeader
        title="Arbeit fotografieren"
        info={`Für eine Übung, die ${name} auf Papier gelöst hat. Die KI liest die Antworten gegen die Aufgaben des Blatts und schlägt eine Bewertung vor; die App prüft nach, wo sie kann. Du prüfst, erst „Übernehmen“ zählt: wie am Gerät, im Lernstand und im Abschluss.`}
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zum Unterricht" }}
      />
      <BlattEinlesen
        studentId={student.id}
        subjects={subjects}
        today={dayOf(new Date())}
        tests={[]}
        vorauswahl={null}
        faehigkeiten={faehigkeiten}
        grenzen={notenschluessel()}
        kiGrund={tor.erlaubt ? null : tor.grund}
        einheit={{
          unitId: unit.id,
          blaetter: blaetter.map((b) => ({ key: b.key, titel: b.titel, wann: `${WANN[b.art]} ${b.art === "probe" ? tag(b.am) : uhr(b.am)}`, aufgaben: b.aufgaben, schonFertig: b.schonFertig })),
          vorwahl: vor?.key ?? ANDERES_BLATT,
          kosten: tor.erlaubt ? tor.kosten : null,
          fach,
        }}
      />
    </div>
  );
}
