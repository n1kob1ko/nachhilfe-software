import Link from "next/link";
import { Info } from "@/components/Info";
import { notFound } from "next/navigation";
import { BookOpenCheck, CheckCircle2, ChartNoAxesColumn, ExternalLink, Plus, Presentation, Square } from "lucide-react";
import { endUnitAction } from "@/app/session-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BoardThumbs } from "@/components/BoardThumbs";
import { CopyLink } from "@/components/CopyLink";
import { Elapsed } from "@/components/Elapsed";
import { UnitDocForm } from "@/components/UnitDocForm";
import { CancelUnit } from "@/components/UnitControl";
import { UnitReportView } from "@/components/UnitReportView";
import { UnitSummary } from "@/components/UnitSummary";
import { Pill, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { buildUnitReport, readReport } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { requireTeacher } from "@/lib/auth";
import { canManageUnit, getUnit, unitDurationMs, type UnitView } from "@/lib/units";

export const metadata = { title: "Einheit" };

const first = (n: string) => n.split(" ")[0];

/**
 * One page per unit, in three states:
 * running → everything for the unit in one place (Übungen, Whiteboard, Fortschritt, Einheit beenden);
 * just ended → closing screen (recorded automatically + five fields to complete);
 * documented → the documentation, editable on request.
 */
export default async function UnitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bereits?: string; fremd?: string; bereich?: string; gesendet?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  const mayManage = canManageUnit(teacher, unit);
  const student = repo.getStudent(unit.student_id)!;
  const lesson = repo.getLessonForUnit(unit.id);
  const running = unit.status === "gestartet";

  const sent = sp.gesendet ? repo.getWorksheet(Number(sp.gesendet)) : null;
  const notices = (
    <>
      {sent && running && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-2xl bg-green-wash px-4 py-3 text-[15px] font-medium text-green">
          <CheckCircle2 size={18} aria-hidden /> „{sent.title}“ ist an {first(student.name)} gesendet. Die Ergebnisse erscheinen unten, sobald {first(student.name)} arbeitet.
        </div>
      )}
      {sp.bereits && running && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px]">
          Mit {student.name} läuft schon seit <span className="num">{formatTime(unit.started_at)}</span> eine Einheit
          {unit.teacher_id !== teacher.id ? ` (von ${unit.teacher_name})` : ""}. Es wurde keine zweite gestartet.
        </div>
      )}
      {sp.fremd && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px] font-semibold">
          Diese Einheit gehört {unit.teacher_name}. Nur {unit.teacher_name} oder die Verwaltung kann sie beenden oder ergänzen.
        </div>
      )}
    </>
  );

  if (running) {
    const area = sp.bereich === "fortschritt" ? "fortschritt" : "uebungen";
    return (
      <>
        <AutoRefresh seconds={10} />
        <header className="sticky top-0 z-20 -mx-4 mb-6 bg-paper/95 px-4 pt-1 pb-4 backdrop-blur md:-mx-8 md:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-40 motion-reduce:hidden" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green" />
            </span>
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] md:text-[28px]">
              Einheit mit {first(student.name)} – seit <span className="num">{formatTime(unit.started_at)}</span>
            </h1>
            <span className="num text-[15px] text-ink-2">
              <Elapsed since={unit.started_at} />
              {unit.subject && ` · ${unit.subject}`}
              {unit.teacher_id !== teacher.id && ` · ${unit.teacher_name}`}
            </span>
          </div>
          {mayManage ? (
            <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Einheit">
              <AreaLink href={`/einheiten/${unit.id}`} on={area === "uebungen"} icon={<BookOpenCheck size={20} aria-hidden />} label="Übungen" />
              <AreaLink href={`/tafel/${unit.id}`} icon={<Presentation size={20} aria-hidden />} label="Whiteboard" />
              <AreaLink href={`/einheiten/${unit.id}?bereich=fortschritt`} on={area === "fortschritt"} icon={<ChartNoAxesColumn size={20} aria-hidden />} label="Fortschritt" />
              <form action={endUnitAction.bind(null, unit.id)} className="contents">
                <button className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-ink px-3 text-[15px] font-semibold text-white transition-colors hover:bg-ink-2">
                  <Square size={18} aria-hidden /> Einheit beenden
                </button>
              </form>
            </nav>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">Diese Einheit gehört {unit.teacher_name}. Du kannst mitlesen, aber nicht beenden.</p>
          )}
        </header>
        {notices}
        {area === "uebungen" ? <UnitExercisesArea unit={unit} student={student} mayManage={mayManage} /> : <UnitProgressArea unit={unit} studentName={student.name} />}
        {mayManage && (
          <div className="mt-14 border-t border-line pt-5">
            <CancelUnit unitId={unit.id} />
          </div>
        )}
      </>
    );
  }

  // ended or cancelled
  const report = lesson ? readReport(lesson) : null;
  const minutes = Math.round(unitDurationMs(unit) / 60_000);
  const date = formatDate(unit.started_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const facts = (
    <p className="mt-1 text-[15px] text-ink-2">
      {date} · <span className="num">{formatTime(unit.started_at)}</span>–<span className="num">{unit.ended_at ? formatTime(unit.ended_at) : "?"}</span> ·{" "}
      {unit.end_estimated ? "ca. " : ""}
      {minutes} min · {unit.teacher_name}
      {unit.ended_by === "automatisch" && " · automatisch beendet"}
      {unit.ended_by === "automatisch" && unit.end_reason && <span className="block text-[13px]">Grund: {unit.end_reason}</span>}
    </p>
  );
  const back = (
    <Link href={`/schueler/${student.id}?tab=lernverlauf`} className="no-print mb-3 inline-flex min-h-[36px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
      ← Lernverlauf von {student.name}
    </Link>
  );

  if (unit.status === "abgebrochen") {
    return (
      <>
        {back}
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Einheit mit {student.name} abgebrochen</h1>
        {facts}
        {unit.end_reason && <p className="mt-4 text-[15px]">Grund: {unit.end_reason}</p>}
        <p className="mt-2 text-[14px] text-ink-2">Wird nicht abgerechnet, keine Dokumentation.</p>
      </>
    );
  }

  const toComplete = lesson && !lesson.reviewed_at && mayManage;
  if (toComplete) {
    return (
      <>
        {notices}
        <header className="mb-8">
          <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-green">
            <CheckCircle2 size={18} aria-hidden /> Einheit beendet
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Einheit mit {student.name} abschließen</h1>
          {facts}
        </header>
        <div className="grid max-w-[820px] gap-10">
          <section>
            <SectionTitle>Automatisch erfasst</SectionTitle>
            {report ? <UnitSummary r={report} /> : <p className="text-[15px] text-ink-2">Keine Daten.</p>}
            <BoardThumbs unitId={unit.id} max={4} />
            {report && report.tasks.length > 0 && (
              <details className="mt-3">
                <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Alle Aufgaben und Fähigkeiten anzeigen</summary>
                <div className="mt-3">
                  <UnitReportView r={report} />
                </div>
              </details>
            )}
          </section>
          <section>
            <SectionTitle>Von dir ergänzen</SectionTitle>
            <UnitDocForm lesson={lesson} student={student} />
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      {notices}
      {back}
      <header className="mb-8">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Einheit mit {student.name}</h1>
        {facts}
      </header>
      <div className="grid max-w-[820px] gap-10">
        {lesson ? (
          <section>
            <SectionTitle
              action={
                lesson.reviewed_at ? (
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                    <CheckCircle2 size={14} aria-hidden /> abgeschlossen am {formatDate(lesson.reviewed_at, { day: "numeric", month: "short" })}
                  </span>
                ) : (
                  <Pill tone="amber">noch nicht abgeschlossen</Pill>
                )
              }
            >
              Dokumentation
            </SectionTitle>
            <DocView lesson={lesson} />
            {mayManage && (
              <details className="mt-4">
                <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Dokumentation bearbeiten</summary>
                <div className="mt-4">
                  <UnitDocForm lesson={lesson} student={student} />
                </div>
              </details>
            )}
          </section>
        ) : (
          <p className="text-[15px] text-ink-2">Zu dieser Einheit gibt es keine Dokumentation.</p>
        )}
        {report && (
          <section>
            <SectionTitle>Automatisch erfasst</SectionTitle>
            <UnitSummary r={report} />
            {report.tasks.length > 0 && (
              <details className="mt-3">
                <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Alle Aufgaben und Fähigkeiten anzeigen</summary>
                <div className="mt-3">
                  <UnitReportView r={report} />
                </div>
              </details>
            )}
          </section>
        )}
        <section>
          <SectionTitle>Whiteboard</SectionTitle>
          <BoardThumbs unitId={unit.id} max={8} alwaysLink />
        </section>
      </div>
    </>
  );
}

function AreaLink({ href, on, icon, label }: { href: string; on?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex min-h-[60px] items-center justify-center gap-2 rounded-2xl px-3 text-[15px] font-semibold transition-colors ${
        on ? "bg-accent text-white shadow-[0_8px_18px_-10px_rgba(201,79,23,0.9)]" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

/** Exercises inside a running unit: the student's link, the exercises with live results, and one way to add a new one. */
function UnitExercisesArea({ unit, student, mayManage }: { unit: UnitView; student: repo.Student; mayManage: boolean }) {
  const attempts = repo.listAttemptsForUnit(unit.id);
  const lastBy = new Map<number, string>();
  for (const a of attempts) if (!lastBy.has(a.assignment_id) || a.created_at > lastBy.get(a.assignment_id)!) lastBy.set(a.assignment_id, a.created_at);
  const rows = repo.listAssignments(unit.student_id).filter((a) => !a.completed_at || lastBy.has(a.id));
  const name = first(student.name);
  return (
    <div className="grid gap-10">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold">Übungen für {name}</h2>
          {mayManage && (
            <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary btn-lg">
              <Plus size={18} aria-hidden /> Neue Übung erstellen
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="panel px-5 py-5 text-[15px] text-ink-2">Noch keine Übung gesendet.</p>
        ) : (
          <ul className="panel divide-y divide-line">
            {rows.map((a) => {
              const done = Boolean(a.completed_at);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.title}</span>
                    <span className="num block text-[14px] text-ink-2">
                      {a.done_count} von {a.task_count} Aufgaben bearbeitet
                      {lastBy.has(a.id) ? ` · zuletzt ${formatTime(lastBy.get(a.id)!)}` : a.started_at ? "" : ` · ${name} hat noch nicht begonnen`}
                    </span>
                  </span>
                  {done && <Pill tone="green">fertig</Pill>}
                  <Link href={`/schueler/${student.id}/ergebnis/${a.id}`} className={`btn ${done ? "btn-primary" : "btn-secondary"}`}>
                    Ergebnis ansehen
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-[17px] font-semibold">
          Link für das Gerät von {name}
          <Info label="Info zum Link">Auf diesem Link sieht {name} die gesendeten Übungen und das Whiteboard. Einmal am Tablet öffnen genügt.</Info>
        </h2>
        <div className="flex max-w-[620px] flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <CopyLink path={`/lernen/${student.access_token}`} />
          </div>
          <a href={`/lernen/${student.access_token}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <ExternalLink size={14} aria-hidden /> Ansicht öffnen
          </a>
        </div>
      </section>
    </div>
  );
}

function UnitProgressArea({ unit, studentName }: { unit: UnitView; studentName: string }) {
  const report = buildUnitReport(unit);
  return (
    <section className="grid max-w-[900px] gap-4">
      <h2 className="text-[20px] font-semibold">Fortschritt in dieser Einheit</h2>
      {report.tasksDone === 0 ? (
        <p className="panel px-5 py-5 text-[15px] text-ink-2">{first(studentName)} hat in dieser Einheit noch keine Aufgabe am Gerät bearbeitet.</p>
      ) : (
        <>
          <UnitSummary r={report} />
          <details>
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Alle Aufgaben und Fähigkeiten anzeigen</summary>
            <div className="mt-3">
              <UnitReportView r={report} />
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function DocView({ lesson }: { lesson: repo.Lesson }) {
  const scale = (v: number | null) => (v ? `${v} von 5` : "–");
  const rows: [string, string][] = [
    ["Zusammenfassung", lesson.summary],
    ["Beobachtungen", lesson.tutor_notes],
    ["Konzentration", scale(lesson.concentration)],
    ["Motivation", scale(lesson.motivation)],
    ["Nächstes Lernziel", lesson.next_steps],
    ["Hausübung", lesson.homework_note],
  ];
  return (
    <dl className="panel grid gap-x-6 gap-y-3 px-5 py-4 text-[15px] sm:grid-cols-[180px_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">{k}</dt>
          <dd className="whitespace-pre-line">{v || "–"}</dd>
        </div>
      ))}
    </dl>
  );
}
