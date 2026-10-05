import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { UnitDocForm } from "@/components/UnitDocForm";
import { CancelUnit, UnitControl, UnitStatusPill } from "@/components/UnitControl";
import { UnitReportView } from "@/components/UnitReportView";
import { PageHeader, Pill, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { buildUnitReport, readReport } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { requireTeacher } from "@/lib/auth";
import { Elapsed } from "@/components/Elapsed";
import { UnitExercises } from "@/components/UnitExercises";
import { canManageUnit, getUnit, unitDurationMs } from "@/lib/units";

export const metadata = { title: "Einheit" };

export default async function UnitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bereits?: string; fremd?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  const mayManage = canManageUnit(teacher, unit);
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
        actions={running && mayManage ? <UnitControl student={student} onUnitPage /> : undefined}
      />

      {sp.bereits && running && (
        <div role="alert" className="mb-8 rounded-xl border border-amber/40 bg-amber-wash px-4 py-3 text-[14px]">
          <p className="font-semibold">
            Mit {student.name} läuft bereits seit <span className="num">{formatTime(unit.started_at)}</span> eine Einheit
            {unit.teacher_id !== teacher.id ? ` (von ${unit.teacher_name})` : ""}. Es wurde keine zweite gestartet.
          </p>
          <p className="mt-1 text-ink-2">{mayManage ? "Du kannst hier weiterarbeiten oder sie oben beenden." : `Nur ${unit.teacher_name} oder die Verwaltung kann sie beenden.`}</p>
        </div>
      )}
      {sp.fremd && (
        <div role="alert" className="mb-8 rounded-xl border border-amber/40 bg-amber-wash px-4 py-3 text-[14px] font-semibold">
          Diese Einheit gehört {unit.teacher_name}. Nur {unit.teacher_name} oder die Verwaltung kann sie beenden oder ergänzen.
        </div>
      )}

      <section className="mb-10">
        <SectionTitle>Basis-Dokumentation</SectionTitle>
        <dl className="panel grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4 lg:grid-cols-8">
          {(
            [
            ["Datum", formatDate(unit.started_at, { day: "2-digit", month: "2-digit", year: "numeric" })],
            ["Lehrer", unit.teacher_name],
            ["Schüler", unit.student_name],
            ["Fach", unit.subject || "–"],
            ["Start", formatTime(unit.started_at)],
            ["Ende", unit.ended_at ? `${unit.end_estimated ? "ca. " : ""}${formatTime(unit.ended_at)}` : "läuft"],
            ["Dauer", running ? <Elapsed since={unit.started_at} /> : `${unit.end_estimated ? "ca. " : ""}${minutes} min`],
            ["Beendet", running ? "–" : unit.ended_by === "automatisch" ? "automatisch" : unit.status === "abgebrochen" ? "abgebrochen" : "vom Lehrer"],
            ] as [string, React.ReactNode][]
          ).map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3">
              <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
              <dd className="num mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Status: <UnitStatusPill status={unit.status} />
          {unit.ended_by === "automatisch" && <Pill tone="amber">automatisch beendet</Pill>}
          {unit.end_estimated ? <Pill tone="amber">Endzeit geschätzt</Pill> : null}
          {unit.ended_by === "lehrer" && unit.ended_by_teacher_id && unit.ended_by_teacher_id !== unit.teacher_id && (
            <span>beendet von {repo.getTeacher(unit.ended_by_teacher_id)?.name}</span>
          )}
          <span className="text-ink-3">(automatisch erfasst beim Starten und Beenden)</span>
        </p>
        {unit.end_reason && <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">Grund: {unit.end_reason}</p>}
        {running && mayManage && (
          <div className="mt-4">
            <CancelUnit unitId={unit.id} />
          </div>
        )}
      </section>

      {running && <UnitExercises unit={unit} />}

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
          {mayManage ? (
            <UnitDocForm lesson={lesson} student={student} />
          ) : (
            <p className="text-[14px] text-ink-2">Nur {unit.teacher_name} oder die Verwaltung kann diese Dokumentation ergänzen. Die Ergänzungen stehen im Lernverlauf.</p>
          )}
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
