import Link from "next/link";
import { CheckCircle2, ChevronRight, Presentation } from "lucide-react";
import { notFound } from "next/navigation";
import { SubjectArt } from "@/components/Art";
import { MasteryBar, TrendBadge, formatDate } from "@/components/ui";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { runningUnitForStudent } from "@/lib/units";

export default async function LearnHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const list = repo.listAssignments(student.id);
  const open = list.filter((a) => !a.completed_at);
  const done = list.filter((a) => a.completed_at).slice(0, 6);
  const a = analyzeStudent(student.id)!;
  const practiced = a.skills.filter((s) => s.tasksDone > 0).sort((x, y) => (y.lastPracticed ?? 0) - (x.lastPracticed ?? 0)).slice(0, 6);
  const first = student.name.split(" ")[0];
  const unit = runningUnitForStudent(student.id);

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] bg-accent-wash px-6 py-7 md:px-8 md:py-9">
        <div className="relative z-10 sm:pr-[170px]">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] md:text-[34px]">Hallo {first}!</h1>
          <p className="mt-1 text-[17px] text-ink-2">
            {open.length === 0 ? "Gerade ist nichts offen. Gut gemacht!" : open.length === 1 ? "Eine Übung wartet auf dich." : `${open.length} Übungen warten auf dich.`}
          </p>
        </div>
        <SubjectArt subject={student.subjects[0]} className="pointer-events-none absolute -right-4 -bottom-6 hidden h-[190px] w-[190px] sm:block" />
      </section>

      {unit && (
        <Link href={`/lernen/${token}/tafel`} className="panel mt-8 flex items-center gap-4 border-accent/40 bg-accent-wash px-5 py-5 transition-colors hover:border-accent">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <Presentation size={24} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold">Whiteboard öffnen</span>
            <span className="block text-[14px] text-ink-2">Deine Einheit läuft. Schreib und rechne gemeinsam mit {unit.teacher_name}.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-accent" aria-hidden />
        </Link>
      )}

      {open.length > 0 && (
        <ul className="mt-8 space-y-3">
          {open.map((x) => (
            <li key={x.id}>
              <Link href={`/lernen/${token}/${x.id}`} className="panel flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{x.title}</p>
                  <p className="text-[14px] text-ink-2">
                    {x.task_count} Aufgaben · {x.difficulty}
                    {x.done_count > 0 && ` · ${x.done_count} schon erledigt`}
                  </p>
                  {x.done_count > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bar-track)]">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(x.done_count / x.task_count) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span className="btn btn-primary">
                  {x.done_count > 0 ? "Weitermachen" : "Starten"} <ChevronRight size={16} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {practiced.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-[18px] font-semibold">Dein Fortschritt</h2>
          <ul className="panel divide-y divide-line">
            {practiced.map((s) => (
              <li key={s.skill.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[1fr_minmax(120px,220px)_auto]">
                <span>
                  {s.skill.name} <span className="text-ink-3">· {s.skill.area}</span>
                </span>
                <span className="sm:order-last">
                  <TrendBadge trend={s.trend} compact />
                </span>
                <span className="col-span-2 sm:col-span-1">
                  <MasteryBar value={s.mastery} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-[18px] font-semibold">Erledigt</h2>
          <ul className="space-y-2">
            {done.map((x) => (
              <li key={x.id} className="flex flex-col gap-x-4 text-[15px] sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-1 shrink-0 text-green" aria-hidden />
                  {x.title}
                </span>
                <span className="num shrink-0 pl-6 text-[14px] text-ink-2 sm:pl-0">
                  {x.correct_count}/{x.task_count} richtig · {formatDate(x.completed_at!, { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
