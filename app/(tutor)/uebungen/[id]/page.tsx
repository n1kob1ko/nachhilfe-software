import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Copy, Eye, EyeOff, Send, Sparkles } from "lucide-react";
import { activeUnitForTeacher, runningUnitForStudent } from "@/lib/units";
import { SendResult, TabletSend } from "@/components/device/TabletSend";
import type { SendState } from "@/app/device-actions";
import { hasDevice } from "@/lib/devices";
import { tabletOnline } from "@/lib/live";
import { assignWorksheetAction, deleteWorksheetAction } from "@/app/actions";
import { copyAsDraftAction, setSolutionsVisibleAction } from "@/app/builder-actions";
import { PrintButton } from "@/components/PrintButton";
import { SendToBoard } from "@/components/SendToBoard";
import { FlowSteps } from "@/components/FlowSteps";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { WorksheetEditor } from "@/components/WorksheetEditor";
import { ReleasePanel, SaveTemplatePanel } from "@/components/WorksheetPanels";
import { aiEnabled } from "@/lib/ai";
import * as repo from "@/lib/repo";
import { requireTeacher } from "@/lib/auth";
import { klassenLabel, stufeLabel } from "@/lib/school";
import { GAP } from "@/lib/tasks";
import { runningBoardsFor } from "@/lib/whiteboard";

export default async function WorksheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loesungen?: string; hinweis?: string; gesendet?: string; ausgelassen?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const w = repo.getWorksheet(Number(id));
  if (!w) notFound();
  if (w.kind === "bibliothek") redirect(`/uebungen/bibliothek/${w.id}`);
  const tasks = repo.listTasks(w.id);
  const skills = repo.listSkills().filter((s) => s.subject === w.subject);
  const students = repo.listStudents().map(({ id, name }) => ({ id, name }));
  const draft = w.status === "entwurf";
  const editable = repo.worksheetAttemptCount(w.id) === 0;
  // drafts are checked with solutions in view; printed sheets usually without
  const showSolutions = sp.loesungen ? sp.loesungen !== "0" : true;
  const assignments = repo.listAssignmentsForWorksheet(w.id);
  const units = runningBoardsFor(teacher.id);
  // during a unit everything goes to its student on the teacher's tablet: no student to choose
  const active = activeUnitForTeacher(teacher.id);
  const activeFirst = active?.student_name.split(" ")[0] ?? "";
  const inActive = active ? assignments.find((x) => x.unit_id === active.id) : undefined;
  // after "An Max senden": did it reach the tablet? (from the database, so a reload shows the same)
  const delivery: SendState =
    active && inActive
      ? {
          status: !hasDevice(active.teacher_id) ? "kein-geraet" : inActive.delivered_at || inActive.started_at || tabletOnline(active.teacher_id) ? "gesendet" : "offline",
          assignmentId: inActive.id,
          unitId: active.id,
          student: activeFirst,
        }
      : null;
  const forStudent = w.student_id ? students.find((s) => s.id === w.student_id) : null;
  const first = forStudent?.name.split(" ")[0];
  const baseTitle = first && w.title.startsWith(`${first} – `) ? w.title.slice(first.length + 3) : w.title;

  const sentTo = sp.gesendet ? students.find((x) => x.id === Number(sp.gesendet)) : null;
  // the next step, depending on where the exercise stands
  const mainAssignment = assignments.find((x) => x.student_id === w.student_id) ?? assignments[0];
  const unit = mainAssignment ? runningUnitForStudent(mainAssignment.student_id) : null;
  const mainName = mainAssignment?.student_name.split(" ")[0];
  const finished = mainAssignment ? mainAssignment.done_count >= tasks.length && tasks.length > 0 : false;

  return (
    <>
      <PageHeader
        back={forStudent ? { href: `/schueler/${forStudent.id}?tab=uebungen`, label: forStudent.name } : { href: "/uebungen", label: "Übungen" }}
        title={w.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {draft ? <Pill tone="amber">Entwurf</Pill> : <Pill tone="green">gesendet</Pill>}
            {w.kind === "diagnose" && <Pill tone="accent">Diagnose</Pill>}
            {w.subject} · {w.klasse ? klassenLabel(w.school_type, w.klasse) : stufeLabel(w.grade)} · {w.difficulty} · {tasks.length} Aufgaben
            {w.source === "ki" && (
              <Pill tone="accent">
                <Sparkles size={11} aria-hidden /> mit Claude erstellt
              </Pill>
            )}
          </span>
        }
      />
      {sp.hinweis === "fach" && (
        <p className="no-print mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber">
          {Number(sp.ausgelassen) === 1 ? "Eine Aufgabe" : `${Number(sp.ausgelassen) || "Einige"} Aufgaben`} aus einem anderen Fach {Number(sp.ausgelassen) === 1 ? "wurde" : "wurden"} nicht übernommen.
        </p>
      )}
      {sp.hinweis === "ki" && (
        <p className="no-print mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber">Claude war nicht erreichbar. Die Aufgaben stammen aus den eingebauten Generatoren.</p>
      )}

      <FlowSteps current={draft ? 2 : !mainAssignment ? 3 : 4} />
      <section className="no-print mb-10 rounded-[24px] bg-accent-wash px-5 py-5 md:px-6" aria-label="Nächster Schritt">
        {draft ? (
          <>
            <h2 className="mb-1 text-[18px] font-semibold">Vorschau prüfen, dann senden</h2>
            <p className="mb-4 text-[14px] text-ink-2">Aufgaben unten bei Bedarf ändern.</p>
            {active ? (
              <>
                <TabletSend student={activeFirst} unitId={active.id} worksheetId={w.id} />
                <Reveal label="An jemand anderen senden" className="mt-4">
                  <ReleasePanel worksheetId={w.id} students={students} defaultStudentId={null} taskCount={tasks.length} />
                </Reveal>
              </>
            ) : (
              <ReleasePanel worksheetId={w.id} students={students} defaultStudentId={w.student_id} taskCount={tasks.length} />
            )}
          </>
        ) : mainAssignment ? (
          <>
            {sentTo !== undefined && sp.gesendet !== undefined && (
              <p className="mb-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
                <CheckCircle2 size={16} aria-hidden /> {sentTo ? `An ${sentTo.name} gesendet.` : "Fertiggestellt."}
              </p>
            )}
            <h2 className="mb-1 text-[18px] font-semibold">
              {finished ? `${mainName} ist fertig` : `${mainName} bearbeitet die Übung`}
            </h2>
            <p className="num mb-4 text-[15px] text-ink-2">
              {mainAssignment.done_count} von {tasks.length} Aufgaben bearbeitet · {mainAssignment.correct_count} richtig
            </p>
            {active && (
              <div className="mb-4">
                {inActive ? <SendResult state={delivery} unitId={active.id} unitLink={false} /> : <TabletSend student={activeFirst} unitId={active.id} worksheetId={w.id} />}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {unit && !finished ? (
                <Link href={`/einheiten/${unit.id}`} className="btn btn-primary btn-lg">
                  Zurück zur Einheit <ArrowRight size={18} aria-hidden />
                </Link>
              ) : (
                <Link href={`/schueler/${mainAssignment.student_id}/ergebnis/${mainAssignment.id}`} className="btn btn-primary btn-lg">
                  Ergebnis ansehen <ArrowRight size={18} aria-hidden />
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-[18px] font-semibold">Noch an niemanden gesendet</h2>
            {active && (
              <div className="mb-4">
                <TabletSend student={activeFirst} unitId={active.id} worksheetId={w.id} />
              </div>
            )}
            <p className="mb-4 text-[14px] text-ink-2">{active ? "Oder an jemand anderen:" : "Wähle, wer die Übung bekommt."}</p>
            <form action={assignWorksheetAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="worksheet_id" value={w.id} />
              <label className="field min-w-[220px]">
                <span className="label">An wen senden?</span>
                <select className="input" name="student_id" required defaultValue="">
                  <option value="" disabled>
                    Schüler wählen
                  </option>
                  {students.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary btn-lg">
                <Send size={18} aria-hidden /> Senden
              </button>
            </form>
          </>
        )}
      </section>

      {!editable && (
        <p className="no-print mb-6 max-w-[80ch] text-[14px] text-ink-2">
          Schon bearbeitet, Aufgaben bleiben fix. Zum Ändern: „Weitere Aktionen“ › Kopie anlegen.
        </p>
      )}

      <WorksheetEditor
        worksheetId={w.id}
        subject={w.subject}
        editable={editable}
        tasks={tasks}
        skills={skills.map(({ id, name, area, parent_id }) => ({ id, name, area, parent_id }))}
        students={students}
        defaultStudentId={w.student_id}
        units={units}
        active={active ? { unitId: active.id, student: activeFirst } : null}
        showSolutions={showSolutions}
        aiEnabled={aiEnabled()}
      />

      <details className="no-print group mt-12 rounded-2xl border border-line bg-surface px-5 py-1">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
          Weitere Aktionen
          <span className="text-[13px] font-normal text-ink-3 group-open:hidden">Lösungen, Drucken, Whiteboard, Kopieren, Vorlage, Löschen</span>
        </summary>
        <div className="grid gap-8 pt-3 pb-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <span className="label">Ansicht</span>
            <div className="flex flex-wrap gap-2">
              <Link href={`/uebungen/${w.id}?loesungen=${showSolutions ? "0" : "1"}`} className="btn btn-secondary">
                {showSolutions ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                {showSolutions ? "Lösungen ausblenden" : "Lösungen zeigen"}
              </Link>
              <PrintButton />
            </div>
          </div>
          {!draft && (
            <div className="grid content-start gap-3">
              <span className="label">Gesendet an</span>
              {assignments.length === 0 && <p className="text-[13px] text-ink-3">Noch niemanden.</p>}
              <ul className="grid gap-2.5">
                {assignments.map((x) => (
                  <li key={x.id} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      <Link href={`/schueler/${x.student_id}/ergebnis/${x.id}`} className="font-medium hover:text-accent">
                        {x.student_name}
                      </Link>
                      <span className="num text-[12px] text-ink-3">
                        {x.done_count}/{tasks.length} · {x.correct_count} richtig
                      </span>
                    </div>
                    <form action={setSolutionsVisibleAction.bind(null, x.id, !x.solutions_visible)}>
                      <button className={`min-h-[36px] text-[13px] font-semibold hover:underline ${x.solutions_visible ? "text-green" : "text-accent"}`}>
                        {x.solutions_visible ? "Lösungen sichtbar · wieder verbergen" : "Lösungen für den Schüler zeigen"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={assignWorksheetAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="worksheet_id" value={w.id} />
                <label className="field min-w-[180px] flex-1">
                  <span className="label">An weiteren Schüler senden</span>
                  <select className="input" name="student_id" required defaultValue="">
                    <option value="" disabled>
                      Schüler wählen
                    </option>
                    {students.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-secondary">Senden</button>
              </form>
            </div>
          )}
          {tasks.length > 0 && units.length > 0 && <SendToBoard worksheetId={w.id} tasks={tasks.map((t) => ({ id: t.id, label: t.prompt.replaceAll(GAP, "…") }))} units={units} />}
          <div className="grid content-start gap-3">
            <span className="label flex items-center gap-1.5">
              <Copy size={14} aria-hidden /> Wiederverwenden
            </span>
            <form action={copyAsDraftAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="worksheet_id" value={w.id} />
              <select className="input min-w-[180px] flex-1" name="student_id" defaultValue="" aria-label="Für Schüler">
                <option value="">Für Schüler wählen …</option>
                {students
                  .filter((x) => x.id !== w.student_id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <button className="btn btn-secondary">Kopie für anderen Schüler</button>
            </form>
            {!draft && (
              <form action={copyAsDraftAction}>
                <input type="hidden" name="worksheet_id" value={w.id} />
                {w.student_id && <input type="hidden" name="student_id" value={w.student_id} />}
                <button className="btn btn-secondary">Kopie zum Ändern anlegen</button>
              </form>
            )}
            <div className="border-t border-line pt-3">
              <SaveTemplatePanel worksheetId={w.id} suggestion={`${baseTitle} · ${tasks.length} Aufgaben`} />
            </div>
          </div>
          <form action={deleteWorksheetAction.bind(null, w.id)} className="self-end">
            <button className="btn btn-danger">Übung löschen</button>
          </form>
        </div>
      </details>
    </>
  );
}
