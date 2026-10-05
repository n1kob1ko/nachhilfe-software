import { BookmarkCheck, Trash2 } from "lucide-react";
import { deleteTemplateAction, useTemplateAction } from "@/app/builder-actions";
import { BuilderForm } from "@/components/BuilderForm";
import { FlowSteps } from "@/components/FlowSteps";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { parseSettings, studentContext } from "@/lib/builder";
import { categoryLabel } from "@/lib/curriculum";
import { getSkill, listSkills, listStudents, listTemplates } from "@/lib/repo";

export const metadata = { title: "Übung erstellen" };

export default async function NewWorksheet({ searchParams }: { searchParams: Promise<{ schueler?: string; skill?: string }> }) {
  const sp = await searchParams;
  const ai = aiEnabled();
  const studentId = Number(sp.schueler) || null;
  const ctx = studentId ? studentContext(studentId) : null;
  const skill = sp.skill ? getSkill(sp.skill) : null;
  const templates = listTemplates();
  return (
    <>
      <PageHeader
        title={ctx ? `Übung für ${ctx.first}` : "Übung erstellen"}
        subtitle={ai ? "Claude erstellt die Aufgaben. Du siehst sie zuerst in einer Vorschau und sendest sie dann." : "Die Aufgaben kommen aus den eingebauten Generatoren. Du siehst sie zuerst in einer Vorschau und sendest sie dann."}
        back={ctx ? { href: `/schueler/${ctx.studentId}`, label: ctx.name } : { href: "/uebungen", label: "Übungen" }}
      />
      <FlowSteps current={1} />
      {templates.length > 0 && (
        <details className="group mb-8" aria-label="Vorlagen">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-accent">
            <BookmarkCheck size={16} aria-hidden /> Gespeicherte Vorlage verwenden ({templates.length})
          </summary>
          <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {templates.map((t) => {
              const s = parseSettings(t.settings);
              const what = [t.subject, s.count && `${t.task_count ?? s.count} Aufgaben`, s.difficulty, ...(s.categories ?? []).map((c) => categoryLabel(t.subject, c))].filter(Boolean).join(" · ");
              return (
                <li key={t.id} className="panel flex w-[260px] shrink-0 flex-col gap-2 px-4 py-3">
                  <p className="font-semibold leading-snug">{t.name}</p>
                  <p className="text-[12.5px] text-ink-2">{what}</p>
                  <p className="text-[12px] text-ink-3">{t.source_worksheet_id ? "mit festen Aufgaben" : "Aufgaben werden neu erstellt"}{t.used_count ? ` · ${t.used_count}× verwendet` : ""}</p>
                  <div className="mt-auto flex items-center gap-2">
                    <form action={useTemplateAction} className="flex-1">
                      <input type="hidden" name="template_id" value={t.id} />
                      {studentId && <input type="hidden" name="student_id" value={studentId} />}
                      <button className="btn btn-secondary w-full">Verwenden</button>
                    </form>
                    <form action={deleteTemplateAction.bind(null, t.id)}>
                      <button className="btn btn-ghost btn-sm" aria-label={`Vorlage ${t.name} löschen`} title="Vorlage löschen">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <BuilderForm
        key={studentId ?? 0}
        skills={listSkills()}
        students={listStudents().map(({ id, name }) => ({ id, name }))}
        ctx={ctx}
        aiEnabled={ai}
        preset={skill ? { skillIds: [skill.id], subject: skill.subject } : undefined}
      />
    </>
  );
}
