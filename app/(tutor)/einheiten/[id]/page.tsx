import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { UnitDocForm } from "@/components/UnitDocForm";
import { CancelUnit, UnitControl, UnitStatusPill } from "@/components/UnitControl";
import { UnitReportView } from "@/components/UnitReportView";
import { PageHeader, Pill, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { buildUnitReport, readReport } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { getUnit, unitDurationMs } from "@/lib/units";

export const metadata = { title: "Einheit" };

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  const student = repo.getStudent(unit.student_id)!;
  const lesson = repo.getLessonForUnit(unit.id);
  const running = unit.status === "gestartet";
  const report = running ? buildUnitReport(unit) : lesson ? readReport(lesson) : null;
  const minutes = Math.round(unitDurationMs(unit) / 60_000);

  return (
    <>
      <PageHeader
        back={{ href: `/schueler/${student.id}?tab=lernverlauf`, label: student.name }}
        title={`Einheit mit ${student.name}`}
        subtitle={formatDate(unit.started_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={running ? <UnitControl student={student} /> : undefined}
      />

      <section className="mb-10">
        <SectionTitle>Basis-Dokumentation</SectionTitle>
        <dl className="panel grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Datum", formatDate(unit.started_at, { day: "2-digit", month: "2-digit", year: "numeric" })],
            ["Lehrer", unit.teacher_name],
            ["Schüler", unit.student_name],
            ["Start", formatTime(unit.started_at)],
            ["Ende", unit.ended_at ? formatTime(unit.ended_at) : "läuft"],
            ["Dauer", `${minutes} min`],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3">
              <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
              <dd className="num mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Status: <UnitStatusPill status={unit.status} />
          {unit.end_reason && <span>{unit.end_reason}</span>}
          <span className="text-ink-3">(automatisch erfasst beim Starten und Beenden)</span>
        </p>
        {running && (
          <div className="mt-4">
            <CancelUnit unitId={unit.id} />
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionTitle>{running ? "Bisher gesammelt" : "Lern-Dokumentation"}</SectionTitle>
        {running && (
          <p className="-mt-1 mb-4 max-w-[72ch] text-[14px] text-ink-2">
            Alles, was {student.name.split(" ")[0]} im Übungsmodus bearbeitet, wird dieser Einheit zugeordnet. Beim Beenden entsteht daraus die Lern-Dokumentation.
          </p>
        )}
        {report ? <UnitReportView r={report} /> : <p className="text-[14px] text-ink-2">{unit.status === "abgebrochen" ? "Abgebrochene Einheiten haben keine Lern-Dokumentation." : "Keine Daten."}</p>}
      </section>

      {lesson && !running && (
        <section>
          <SectionTitle
            action={
              lesson.reviewed_at ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                  <CheckCircle2 size={14} aria-hidden /> ergänzt am {formatDate(lesson.reviewed_at, { day: "numeric", month: "short" })}
                </span>
              ) : (
                <Pill tone="amber">noch nicht ergänzt</Pill>
              )
            }
          >
            Ergänzung durch {unit.teacher_name}
          </SectionTitle>
          <UnitDocForm lesson={lesson} student={student} />
        </section>
      )}
      {!running && !lesson && unit.status === "beendet" && (
        <p className="text-[14px] text-ink-2">
          Keine Lern-Dokumentation gefunden. <Link href={`/schueler/${student.id}?tab=lernverlauf`} className="link">Zum Lernverlauf</Link>
        </p>
      )}
    </>
  );
}
