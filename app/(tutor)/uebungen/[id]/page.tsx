import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { assignWorksheetAction, deleteWorksheetAction } from "@/app/actions";
import { copyAsDraftAction, setSolutionsVisibleAction } from "@/app/builder-actions";
import { PrintButton } from "@/components/PrintButton";
import { SendToBoard } from "@/components/SendToBoard";
import { PageHeader, Pill } from "@/components/ui";
import { WorksheetEditor } from "@/components/WorksheetEditor";
import { ReleasePanel, SaveTemplatePanel } from "@/components/WorksheetPanels";
import { aiEnabled } from "@/lib/ai";
import { worksheetTypeLabel } from "@/lib/curriculum";
import * as repo from "@/lib/repo";
import { requireTeacher } from "@/lib/auth";
import { klassenLabel, stufeLabel } from "@/lib/school";
import { GAP } from "@/lib/tasks";
import { runningBoardsFor } from "@/lib/whiteboard";

export default async function WorksheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loesungen?: string; hinweis?: string; freigegeben?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const w = repo.getWorksheet(Number(id));
  if (!w) notFound();
  const tasks = repo.listTasks(w.id);
  const skills = repo.listSkills().filter((s) => s.subject === w.subject);
  const students = repo.listStudents().map(({ id, name }) => ({ id, name }));
  const draft = w.status === "entwurf";
  const editable = repo.worksheetAttemptCount(w.id) === 0;
  // drafts are checked with solutions in view; printed sheets usually without
  const showSolutions = sp.loesungen ? sp.loesungen !== "0" : true;
  const assignments = repo.listAssignmentsForWorksheet(w.id);
  const units = runningBoardsFor(teacher.id);
  const forStudent = w.student_id ? students.find((s) => s.id === w.student_id) : null;
  const first = forStudent?.name.split(" ")[0];
  const baseTitle = first && w.title.startsWith(`${first} – `) ? w.title.slice(first.length + 3) : w.title;

  return (
    <>
      <PageHeader
        back={forStudent ? { href: `/schueler/${forStudent.id}?tab=uebungen`, label: forStudent.name } : { href: "/uebungen", label: "Übungen" }}
        title={w.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {draft ? <Pill tone="amber">Entwurf</Pill> : <Pill tone="green">Freigegeben</Pill>}
            {w.subject} · {w.klasse ? klassenLabel(w.school_type, w.klasse) : stufeLabel(w.grade)} · {w.difficulty} · {worksheetTypeLabel(w.subject, w.task_type)} · {tasks.length} Aufgaben
            {w.source === "ki" && (
              <Pill tone="accent">
                <Sparkles size={11} aria-hidden /> mit Claude erstellt
              </Pill>
            )}
          </span>
        }
        actions={
          <>
            <Link href={`/uebungen/${w.id}?loesungen=${showSolutions ? "0" : "1"}`} className="btn btn-secondary">
              {showSolutions ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              {showSolutions ? "Lösungen ausblenden" : "Lösungen zeigen"}
            </Link>
            <PrintButton />
          </>
        }
      />
      {sp.hinweis === "ki" && (
        <p className="no-print mb-6 rounded-lg bg-amber-wash px-4 py-3 text-[14px] text-amber">Claude war nicht erreichbar. Die Aufgaben stammen aus den eingebauten Generatoren.</p>
      )}
      {sp.freigegeben !== undefined && !draft && (
        <p className="no-print mb-6 rounded-lg bg-green-wash px-4 py-3 text-[14px] font-medium text-green" role="status">
          {Number(sp.freigegeben) ? `Freigegeben und an ${students.find((s) => s.id === Number(sp.freigegeben))?.name ?? "den Schüler"} gesendet.` : "Freigegeben."} Lösungen bleiben verborgen, bis du sie freigibst.
        </p>
      )}
      {draft && (
        <p className="no-print mb-6 max-w-[80ch] text-[14px] text-ink-2">
          Prüfe die Aufgaben: bearbeiten, löschen, verschieben, neu erstellen oder die Schwierigkeit ändern. {forStudent ? `${forStudent.name} sieht` : "Schüler sehen"} die Übung erst nach der Freigabe.
        </p>
      )}
      {!editable && (
        <p className="no-print mb-6 max-w-[80ch] rounded-lg bg-paper px-4 py-3 text-[14px] text-ink-2">
          Diese Übung wurde schon bearbeitet, deshalb bleiben die Aufgaben unverändert (die Ergebnisse beziehen sich darauf). Mit „Anpassen“ entsteht eine Kopie, die du ändern kannst.
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <WorksheetEditor
          worksheetId={w.id}
          subject={w.subject}
          editable={editable}
          tasks={tasks}
          skills={skills.map(({ id, name, area, parent_id }) => ({ id, name, area, parent_id }))}
          students={students}
          defaultStudentId={w.student_id}
          units={units}
          showSolutions={showSolutions}
          aiEnabled={aiEnabled()}
        />
        <aside className="no-print space-y-6">
          {draft ? (
            <ReleasePanel worksheetId={w.id} students={students} defaultStudentId={w.student_id} taskCount={tasks.length} />
          ) : (
            <div className="panel grid gap-3 px-4 py-4">
              <span className="label">Zugewiesen</span>
              {assignments.length === 0 && <p className="text-[13px] text-ink-3">Noch niemandem.</p>}
              <ul className="grid gap-2.5">
                {assignments.map((a) => (
                  <li key={a.id} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      <Link href={`/schueler/${a.student_id}/ergebnis/${a.id}`} className="font-medium hover:text-accent">
                        {a.student_name}
                      </Link>
                      <span className="num text-[12px] text-ink-3">
                        {a.done_count}/{tasks.length} · {a.correct_count} richtig
                      </span>
                    </div>
                    <form action={setSolutionsVisibleAction.bind(null, a.id, !a.solutions_visible)}>
                      <button className={`text-[12.5px] font-semibold hover:underline ${a.solutions_visible ? "text-green" : "text-accent"}`}>
                        {a.solutions_visible ? "Lösungen sichtbar · wieder verbergen" : "Lösungen für Schüler freigeben"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={assignWorksheetAction} className="grid gap-2 border-t border-line pt-3">
                <input type="hidden" name="worksheet_id" value={w.id} />
                <label className="field">
                  <span className="label">Weiterem Schüler zuweisen</span>
                  <select className="input" name="student_id" required defaultValue="">
                    <option value="" disabled>
                      Schüler wählen
                    </option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-secondary btn-sm justify-self-start">Zuweisen</button>
              </form>
            </div>
          )}
          {tasks.length > 0 && <SendToBoard worksheetId={w.id} tasks={tasks.map((t) => ({ id: t.id, label: t.prompt.replaceAll(GAP, "…") }))} units={units} />}
          <div className="panel grid gap-4 px-4 py-4">
            <span className="label flex items-center gap-1.5">
              <Copy size={14} aria-hidden /> Wiederverwenden
            </span>
            <form action={copyAsDraftAction} className="grid gap-2">
              <input type="hidden" name="worksheet_id" value={w.id} />
              <select className="input" name="student_id" defaultValue="" aria-label="Für Schüler">
                <option value="">Für Schüler wählen …</option>
                {students
                  .filter((s) => s.id !== w.student_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              <button className="btn btn-secondary btn-sm justify-self-start">Für anderen Schüler kopieren</button>
            </form>
            {!draft && (
              <form action={copyAsDraftAction}>
                <input type="hidden" name="worksheet_id" value={w.id} />
                {w.student_id && <input type="hidden" name="student_id" value={w.student_id} />}
                <button className="btn btn-secondary btn-sm">Anpassen (Kopie als Entwurf)</button>
              </form>
            )}
            <div className="border-t border-line pt-3">
              <SaveTemplatePanel worksheetId={w.id} suggestion={`${baseTitle} · ${tasks.length} Aufgaben`} />
            </div>
          </div>
          <form action={deleteWorksheetAction.bind(null, w.id)}>
            <button className="btn btn-danger btn-sm">Übung löschen</button>
          </form>
        </aside>
      </div>
    </>
  );
}
