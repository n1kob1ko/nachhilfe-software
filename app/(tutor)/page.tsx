import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, ChevronDown, ClipboardPen, FileCheck2, NotebookPen, Play, Plus, Presentation } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { startUnitAction } from "@/app/session-actions";
import { Avatar, SubjectArt } from "@/components/Art";
import { dayKey } from "@/components/Calendar";
import { Elapsed } from "@/components/Elapsed";
import { StudentFocus } from "@/components/StudentFocus";
import { Empty, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { listUnits, runningUnits } from "@/lib/units";
import { examReminders, STAGE_LABEL } from "@/lib/exams";

const parseLocal = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(" ", "T") : s);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const firstName = (n: string) => n.split(" ")[0];

type TodoItem = { key: string; href: string; icon: typeof ClipboardPen; text: React.ReactNode; when: string };

/**
 * The start page answers one question: what do I do now? A running unit, or the big
 * "Einheit starten" button; below it only today, recently used students and open to-dos.
 */
export default async function StartPage() {
  const teacher = await requireTeacher();
  const students = repo.listStudents();
  const now = new Date();
  const today = dayKey(now);

  if (students.length === 0) {
    return (
      <>
        <Greeting name={teacher.name} date={now} />
        <Empty
          title="Noch keine Schüler angelegt"
          action={
            <>
              <Link href="/schueler/neu" className="btn btn-primary btn-lg">
                <Plus size={18} aria-hidden /> Ersten Schüler anlegen
              </Link>
              <form action={loadDemoData}>
                <button className="btn btn-secondary btn-lg">Mit Beispiel-Schülern ausprobieren</button>
              </form>
            </>
          }
        >
          Lege einen Schüler an. Danach startest du hier mit einem Klick die erste Einheit.
        </Empty>
      </>
    );
  }

  const byId = new Map(students.map((s) => [s.id, s]));
  const running = runningUnits(teacher.id);
  const todays = repo.lessonsBetween(`${today}T00:00`, `${dayKey(addDays(now, 1))}T00:00`).filter((l) => l.status !== "abgesagt" && (!l.teacher_id || l.teacher_id === teacher.id));
  const next = todays.find((l) => l.status !== "abgeschlossen" && parseLocal(l.starts_at).getTime() + l.duration_min * 60_000 > now.getTime());

  // recently used = the students of my latest units, then everyone else
  const myUnits = listUnits({ teacherId: teacher.id });
  const recentIds = [...new Set(myUnits.map((u) => u.student_id))].filter((id) => byId.has(id));
  const ordered = [...new Set([...(next ? [next.student_id] : []), ...todays.map((l) => l.student_id), ...recentIds, ...students.map((s) => s.id)])].map((id) => byId.get(id)!);

  // to-dos: exams ahead (14/7/3 days, Mehr › Lehrplan), documentation not yet completed, fresh results, homework due
  const todos: TodoItem[] = [];
  for (const e of examReminders(today, { teacherId: teacher.id })) {
    todos.push({
      key: `p${e.id}`,
      href: `/schueler/${e.student_id}/pruefung/${e.id}`,
      icon: CalendarClock,
      text: (
        <>
          <span className={`font-semibold ${e.stage === "bald" ? "text-red" : e.stage === "prioritaet" ? "text-amber" : ""}`}>{STAGE_LABEL[e.stage]}:</span> {e.kind} {e.subject} von <b>{firstName(e.student_name)}</b>{" "}
          {e.days === 0 ? "heute" : e.days === 1 ? "morgen" : `in ${e.days} Tagen`}
        </>
      ),
      when: formatDate(e.date, { day: "numeric", month: "short" }),
    });
  }
  for (const u of myUnits.filter((u) => u.status === "beendet").slice(0, 30)) {
    const lesson = repo.getLessonForUnit(u.id);
    if (lesson && !lesson.reviewed_at) {
      todos.push({ key: `u${u.id}`, href: `/einheiten/${u.id}`, icon: ClipboardPen, text: <>Dokumentation der Einheit mit <b>{u.student_name}</b> abschließen</>, when: formatDate(u.started_at, { day: "numeric", month: "short" }) });
    }
  }
  for (const r of repo.recentActivity(20).filter((x) => now.getTime() - parseLocal(x.completed_at).getTime() < 48 * 3600_000)) {
    todos.push({
      key: `a${r.assignment_id}`,
      href: `/schueler/${r.student_id}/ergebnis/${r.assignment_id}`,
      icon: FileCheck2,
      text: (
        <>
          Ergebnis von <b>{firstName(r.student_name)}</b> ansehen: {r.title} ({r.correct_count}/{r.task_count} richtig)
        </>
      ),
      when: formatDate(r.completed_at, { day: "numeric", month: "short" }),
    });
  }
  for (const h of repo.openHomeworkDue(dayKey(addDays(now, 1)))) {
    todos.push({ key: `h${h.id}`, href: `/schueler/${h.student_id}?tab=schule`, icon: NotebookPen, text: <>Hausübung von <b>{firstName(h.student_name)}</b> kontrollieren: {h.description}</>, when: h.due_date ? formatDate(h.due_date, { day: "numeric", month: "short" }) : "" });
  }

  return (
    <>
      <Greeting name={teacher.name} date={now} />

      <div className="space-y-10">
        {running.length > 0 ? (
          running.map((u) => (
            <section key={u.id} className="relative overflow-hidden rounded-[28px] bg-accent-wash px-6 py-7 md:px-8" aria-label="Laufende Einheit">
              <div className="relative z-10 md:pr-[220px]">
                <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-green">
                  <span className="h-2 w-2 rounded-full bg-green" aria-hidden /> Einheit läuft
                </p>
                <h2 className="mt-3 text-[28px] leading-tight font-semibold md:text-[32px]">Einheit mit {firstName(u.student_name)}</h2>
                <p className="mt-1 text-[16px] text-ink-2">
                  seit <span className="num">{formatTime(u.started_at)}</span> (<Elapsed since={u.started_at} />){u.subject && ` · ${u.subject}`}
                </p>
                <StudentFocus studentId={u.student_id} />
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={`/einheiten/${u.id}`} className="btn btn-primary btn-lg">
                    Zur Einheit <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link href={`/tafel/${u.id}`} className="btn btn-secondary btn-lg">
                    <Presentation size={18} aria-hidden /> Whiteboard
                  </Link>
                </div>
              </div>
              <SubjectArt subject={u.subject} className="pointer-events-none absolute -right-2 -bottom-6 hidden h-[220px] w-[220px] md:block" />
            </section>
          ))
        ) : (
          <section className="relative overflow-hidden rounded-[28px] bg-accent-wash px-6 py-7 md:px-8" aria-label="Einheit starten">
            <div className="relative z-10 md:pr-[220px]">
              {next ? (
                <>
                  <p className="text-[15px] font-semibold text-ink-2">
                    Als Nächstes · <span className="num">{formatTime(parseLocal(next.starts_at).toISOString())}</span>
                  </p>
                  <h2 className="mt-1 text-[28px] leading-tight font-semibold md:text-[32px]">{next.student_name}</h2>
                  <p className="mt-1 text-[16px] text-ink-2">{next.topic || next.subject}</p>
                  <StudentFocus studentId={next.student_id} />
                  <div className="mt-6 flex flex-wrap items-start gap-3">
                    <form action={startUnitAction.bind(null, next.student_id)}>
                      <button className="btn btn-primary btn-lg">
                        <Play size={18} aria-hidden /> Einheit mit {firstName(next.student_name)} starten
                      </button>
                    </form>
                  </div>
                  <StudentPicker students={ordered.filter((s) => s.id !== next.student_id)} label="Anderen Schüler wählen" />
                </>
              ) : (
                <>
                  <h2 className="text-[28px] leading-tight font-semibold md:text-[32px]">Einheit starten</h2>
                  <p className="mt-1 text-[16px] text-ink-2">Wähle den Schüler, mit dem du jetzt arbeitest.</p>
                  <StudentPicker students={ordered} open />
                </>
              )}
            </div>
            <SubjectArt subject={next?.subject ?? ordered[0]?.subjects[0]} className="pointer-events-none absolute -right-2 -bottom-6 hidden h-[220px] w-[220px] md:block" />
          </section>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
          <section>
            <SectionTitle>Heute</SectionTitle>
            {todays.length === 0 ? (
              <p className="text-[15px] text-ink-2">Heute sind keine Einheiten eingeplant.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {todays.map((l) => {
                  const done = l.status === "abgeschlossen";
                  return (
                    <li key={l.id}>
                      <Link href={`/schueler/${l.student_id}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-panel/60">
                        <span className="num w-12 shrink-0 text-[15px] font-semibold">{formatTime(parseLocal(l.starts_at).toISOString())}</span>
                        <Avatar name={l.student_name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{l.student_name}</span>
                          <span className="block truncate text-[13px] text-ink-2">{l.topic || l.subject}</span>
                        </span>
                        {done && (
                          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                            <CheckCircle2 size={15} aria-hidden /> erledigt
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle>Zu erledigen</SectionTitle>
            {todos.length === 0 ? (
              <p className="text-[15px] text-ink-2">Nichts offen.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {todos.slice(0, 6).map(({ key, href, icon: Icon, text, when }) => (
                  <li key={key}>
                    <Link href={href} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-panel/60">
                      <Icon size={19} className="shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0 flex-1">{text}</span>
                      <span className="num shrink-0 text-[13px] text-ink-3">{when}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {recentIds.length > 0 && (
          <section>
            <SectionTitle action={<Link href="/schueler" className="link text-[14px] font-medium">Alle Schüler</Link>}>Zuletzt verwendet</SectionTitle>
            <ul className="flex flex-wrap gap-3">
              {recentIds.slice(0, 6).map((id) => {
                const s = byId.get(id)!;
                return (
                  <li key={id}>
                    <Link href={`/schueler/${id}`} className="panel flex min-h-[60px] items-center gap-3 py-2 pr-5 pl-2.5 hover:border-line-strong">
                      <Avatar name={s.name} size={40} />
                      <span>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="block text-[13px] text-ink-2">{klassenLabel(s.school_type, s.klasse, { short: true })}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function Greeting({ name, date }: { name: string; date: Date }) {
  return (
    <header className="mb-7">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Hallo, {firstName(name)}</h1>
      <p className="mt-1 text-[15px] text-ink-2">{date.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}</p>
    </header>
  );
}

/** One tap starts the unit: every student is its own big button. */
function StudentPicker({ students, open, label }: { students: repo.Student[]; open?: boolean; label?: string }) {
  const list = (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {students.slice(0, 8).map((s) => (
        <li key={s.id}>
          <form action={startUnitAction.bind(null, s.id)}>
            <button className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-panel" aria-label={`Einheit mit ${s.name} starten`}>
              <Avatar name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-[13px] text-ink-2">{s.subjects.join(", ") || klassenLabel(s.school_type, s.klasse, { short: true })}</span>
              </span>
              <Play size={18} className="shrink-0 text-accent" aria-hidden />
            </button>
          </form>
        </li>
      ))}
      {students.length > 8 && (
        <li className="sm:col-span-2">
          <Link href="/schueler" className="link text-[14px] font-medium">
            Alle {students.length} Schüler anzeigen
          </Link>
        </li>
      )}
    </ul>
  );
  if (open) return list;
  return (
    <details className="group mt-4">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent">
        {label} <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {list}
    </details>
  );
}
