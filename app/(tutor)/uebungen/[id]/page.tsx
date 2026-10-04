import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { assignWorksheetAction, deleteWorksheetAction } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { TaskPreview } from "@/components/TaskPreview";
import { PageHeader, Pill } from "@/components/ui";
import { TASK_TYPES } from "@/lib/curriculum";
import * as repo from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";

export default async function WorksheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loesungen?: string; hinweis?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const w = repo.getWorksheet(Number(id));
  if (!w) notFound();
  const tasks = repo.listTasks(w.id);
  const skills = repo.listSkills();
  const students = repo.listStudents();
  const showSolutions = sp.loesungen !== "0";
  const passages = new Set<string>();

  return (
    <>
      <PageHeader
        back={{ href: "/uebungen", label: "Übungen" }}
        title={w.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {w.subject} · {w.klasse ? klassenLabel(w.school_type, w.klasse) : stufeLabel(w.grade)} · {w.difficulty} · {TASK_TYPES[w.task_type as keyof typeof TASK_TYPES] ?? w.task_type} · {tasks.length} Aufgaben
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
        <p className="no-print mb-6 rounded-lg bg-amber-wash px-4 py-3 text-[14px] text-amber">
          Claude war nicht erreichbar. Die Aufgaben stammen aus den eingebauten Generatoren.
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ol className="panel divide-y divide-line px-5">
          {tasks.map((t, i) => {
            const shown = t.data.passage ? passages.has(t.data.passage) : false;
            if (t.data.passage) passages.add(t.data.passage);
            return <TaskPreview key={t.id} task={t} index={i + 1} showSolution={showSolutions} skillName={skills.find((s) => s.id === t.skillId)?.name} passageShown={shown} />;
          })}
        </ol>
        <aside className="no-print space-y-6">
          <form action={assignWorksheetAction} className="panel grid gap-3 px-4 py-4">
            <input type="hidden" name="worksheet_id" value={w.id} />
            <label className="field">
              <span className="label">Einem Schüler zuweisen</span>
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
            <button className="btn btn-primary">Zuweisen</button>
            <p className="text-[12px] text-ink-3">Der Schüler sieht die Übung über seinen persönlichen Link und bearbeitet sie dort.</p>
          </form>
          <form action={deleteWorksheetAction.bind(null, w.id)}>
            <button className="btn btn-danger btn-sm">Übung löschen</button>
          </form>
        </aside>
      </div>
    </>
  );
}
