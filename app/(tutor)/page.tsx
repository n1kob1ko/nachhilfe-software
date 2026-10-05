import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, ClipboardCheck, Plus, Presentation, Square, Users } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { endUnitAction } from "@/app/session-actions";
import { Avatar, SubjectArt, TileArt } from "@/components/Art";
import { DayPlan, MonthCalendar, dayKey, subjectTone } from "@/components/Calendar";
import { Elapsed } from "@/components/Elapsed";
import { UnitControl } from "@/components/UnitControl";
import { Empty, MasteryBar, Pill, SectionTitle, TrendBadge, formatDate, formatTime } from "@/components/ui";
import { pct } from "@/lib/analysis";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { analyzeStudent } from "@/lib/service";
import { runningUnits } from "@/lib/units";

const parseLocal = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(" ", "T") : s);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ monat?: string; tag?: string }> }) {
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const students = repo.listStudents();
  const now = new Date();
  const today = dayKey(now);

  if (students.length === 0) {
    return (
      <>
        <Greeting name={teacher.name} subtitle="Hier siehst du später auf einen Blick, wer heute kommt, wo es hakt und was als Nächstes dran ist." />
        <Empty
          title="Noch keine Schüler angelegt"
          action={
            <>
              <Link href="/schueler/neu" className="btn btn-primary">
                <Plus size={16} aria-hidden /> Ersten Schüler anlegen
              </Link>
              <form action={loadDemoData}>
                <button className="btn btn-secondary">Mit Demo-Daten ausprobieren</button>
              </form>
            </>
          }
        >
          Lege einen Schüler an, dokumentiere die erste Stunde und erstelle eine Übung. Mit den Demo-Daten siehst du sofort, wie Analyse und Empfehlungen aussehen.
        </Empty>
      </>
    );
  }

  const isLesson = (l: repo.Lesson) => l.kind === "stunde" && l.status !== "abgesagt";
  const lessons = repo.lessonsBetween(`${today}T00:00`, `${dayKey(addDays(now, 1))}T00:00`).filter(isLesson);
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const weekLessons = repo.lessonsBetween(`${dayKey(monday)}T00:00`, `${dayKey(addDays(monday, 7))}T00:00`).filter(isLesson);
  const dueSoon = repo.openHomeworkDue(dayKey(addDays(now, 3)));
  const activity = repo.recentActivity(6);
  const freshResults = repo.recentActivity(50).filter((x) => now.getTime() - parseLocal(x.completed_at).getTime() < 48 * 3600_000);
  const rows = students.map((s) => ({ s, a: analyzeStudent(s.id)! }));
  const byId = new Map(rows.map((r) => [r.s.id, r]));
  const withProblem = rows.filter((r) => r.a.mainProblem);
  const running = runningUnits(teacher.id);

  // calendar: month and chosen day come from the URL so the page stays server-rendered
  const month = /^\d{4}-\d{2}$/.test(sp.monat ?? "") ? sp.monat! : today.slice(0, 7);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.tag ?? "") ? sp.tag! : month === today.slice(0, 7) ? today : `${month}-01`;
  const [my, mm] = month.split("-").map(Number);
  const monthLessons = repo.lessonsBetween(`${month}-01T00:00`, `${dayKey(new Date(my, mm, 1))}T00:00`).filter(isLesson);
  const busy = new Set(monthLessons.map((l) => l.starts_at.slice(0, 10)));
  const dayLessons = repo.lessonsBetween(`${selected}T00:00`, `${dayKey(addDays(parseLocal(`${selected}T12:00`), 1))}T00:00`).filter(isLesson);
  const calHref = (m: string, d?: string) => `/?monat=${m}${d ? `&tag=${d}` : ""}#kalender`;
  const selectedText = selected === today ? "Heute" : parseLocal(`${selected}T12:00`).toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" });

  const next = lessons.find((l) => l.status !== "abgeschlossen" && parseLocal(l.starts_at).getTime() + l.duration_min * 60_000 > now.getTime());

  return (
    <>
      <Greeting
        name={teacher.name}
        subtitle={lessons.length === 0 ? "Heute sind keine Nachhilfestunden geplant." : `Heute ${lessons.length === 1 ? "steht eine Nachhilfestunde" : `stehen ${lessons.length} Nachhilfestunden`} an.`}
        date={now.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* minmax(0, …) keeps long titles from widening the columns */}
        <div className="min-w-0 space-y-8">
          <Hero running={running} next={next} byId={byId} />

          <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile href="#hausuebungen" value={dueSoon.length} label={dueSoon.length === 1 ? "Hausübung fällig" : "Hausübungen fällig"} hint="nächste 3 Tage" bg="var(--tile-pink)" fg="#6b2320" art="alert" />
            <Tile href="#zuletzt" value={freshResults.length} label={freshResults.length === 1 ? "neues Ergebnis" : "neue Ergebnisse"} hint="seit gestern" bg="var(--tile-mint)" fg="#164f2e" art="sheet" />
            <Tile href="/schueler" value={withProblem.length} label={withProblem.length === 1 ? "Schüler mit Schwäche" : "Schüler mit Schwächen"} hint={`von ${students.length}`} bg="var(--tile-lilac)" fg="#3a2d86" art="target" />
            <Tile href="#kalender" value={weekLessons.length} label={weekLessons.length === 1 ? "Stunde diese Woche" : "Stunden diese Woche"} hint={`${weekLessons.filter((l) => l.status === "abgeschlossen").length} schon dokumentiert`} bg="var(--tile-peach)" fg="#6e3212" art="calendar" />
          </section>

          <section>
            <SectionTitle action={<Link href="/einheiten" className="link inline-flex items-center gap-1 text-[13px] font-medium">Alle Einheiten <ArrowRight size={13} aria-hidden /></Link>}>Stunden heute</SectionTitle>
            {lessons.length === 0 ? (
              <p className="panel px-5 py-5 text-[14px] text-ink-2">Heute keine Stunden. Im Kalender rechts siehst du die nächsten Termine.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {lessons.map((l) => {
                  const r = byId.get(l.student_id);
                  const problem = r?.a.mainProblem;
                  const done = l.status === "abgeschlossen";
                  const start = parseLocal(l.starts_at);
                  const end = new Date(start.getTime() + l.duration_min * 60_000);
                  const tone = subjectTone(l.subject);
                  return (
                    <li key={l.id} className="panel flex flex-col gap-3 px-5 py-4">
                      <div className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
                        <span className="num">
                          {formatTime(start.toISOString())} – {formatTime(end.toISOString())}
                          {r && ` · ${klassenLabel(r.s.school_type, r.s.klasse, { short: true })}`}
                        </span>
                        <Avatar name={l.student_name} size={30} />
                      </div>
                      <div>
                        <h3 className="text-[18px] leading-snug font-semibold">{l.topic || `${l.subject} mit ${l.student_name.split(" ")[0]}`}</h3>
                        <p className="mt-0.5 text-[14px] text-ink-2">
                          <Link href={`/schueler/${l.student_id}`} className="font-medium text-ink hover:text-accent">
                            {l.student_name}
                          </Link>
                          {l.teacher_name && ` · bei ${l.teacher_name}`}
                          {r && (
                            <span className="ml-2 inline-block align-middle">
                              <TrendBadge trend={r.a.overall.trend} compact />
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: tone.soft, color: tone.fg }}>
                          {l.subject}
                        </span>
                        {done ? (
                          <Pill tone="green">dokumentiert</Pill>
                        ) : problem ? (
                          <span className="rounded-full bg-red-wash px-2.5 py-1 text-[12px] font-semibold text-red">Problem: {problem.skill.name}</span>
                        ) : null}
                        <span className="ml-auto flex items-center gap-2">
                          {done ? (
                            <Link href={l.unit_id ? `/einheiten/${l.unit_id}` : `/schueler/${l.student_id}/stunden/${l.id}`} className="btn btn-ghost btn-sm">
                              <ClipboardCheck size={15} aria-hidden /> Dokumentation
                            </Link>
                          ) : r ? (
                            <UnitControl student={r.s} compact />
                          ) : null}
                          <Link href={`/schueler/${l.student_id}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bright text-white transition-transform hover:scale-105" aria-label={`Profil von ${l.student_name}`}>
                            <ArrowRight size={16} aria-hidden />
                          </Link>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle action={<Link href="/schueler" className="link inline-flex items-center gap-1 text-[13px] font-medium">Alle Schüler <ArrowRight size={13} aria-hidden /></Link>}>Deine Schüler</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ s, a }) => (
                <li key={s.id}>
                  <Link href={`/schueler/${s.id}`} className="panel group flex h-full flex-col gap-3 px-4 py-4 transition-shadow hover:shadow-[var(--shadow-pop)]">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size={40} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold group-hover:text-accent">{s.name}</div>
                        <div className="truncate text-[12.5px] text-ink-3">
                          {klassenLabel(s.school_type, s.klasse, { short: true })} · {s.subjects.join(", ") || "–"}
                        </div>
                      </div>
                      <span className="ml-auto">
                        <TrendBadge trend={a.overall.trend} compact />
                      </span>
                    </div>
                    <div>
                      <div className="mb-1 text-[12px] text-ink-3">Gesamtstand</div>
                      <MasteryBar value={a.overall.mastery} size="sm" />
                    </div>
                    <p className="text-[13px]">
                      {a.mainProblem ? (
                        <>
                          <span className="text-ink-3">Problem: </span>
                          <span className="font-medium text-red">{a.mainProblem.skill.name}</span>
                          <span className="text-ink-3"> · {a.mainProblem.skill.area}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">Kein Problem erkannt</span>
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle>Empfohlene nächste Übungen</SectionTitle>
            <RecommendationList rows={rows} />
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section id="kalender" className="panel scroll-mt-6 px-4 py-4" aria-label="Kalender">
            <MonthCalendar month={month} selected={selected} today={today} busy={busy} href={calHref} />
          </section>

          <section className="panel px-4 py-4" aria-label={`Tagesplan ${selectedText}`}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold">{selectedText}</h2>
              <span className="text-[12.5px] text-ink-3">
                {dayLessons.length === 0 ? "keine Stunden" : `${dayLessons.length} ${dayLessons.length === 1 ? "Stunde" : "Stunden"}`}
              </span>
            </div>
            <DayPlan
              now={selected === today ? now : undefined}
              items={dayLessons.map((l) => ({
                id: l.id,
                start: parseLocal(l.starts_at),
                minutes: l.duration_min,
                title: `${l.subject} · ${l.student_name}`,
                subtitle: `${formatTime(parseLocal(l.starts_at).toISOString())} – ${formatTime(new Date(parseLocal(l.starts_at).getTime() + l.duration_min * 60_000).toISOString())}${l.topic ? ` · ${l.topic}` : ""}`,
                subject: l.subject,
                href: l.status === "abgeschlossen" && l.unit_id ? `/einheiten/${l.unit_id}` : `/schueler/${l.student_id}`,
                done: l.status === "abgeschlossen",
              }))}
            />
          </section>

          <section id="zuletzt" className="panel scroll-mt-6 px-4 py-4">
            <h2 className="mb-3 text-[16px] font-semibold">Zuletzt bearbeitet</h2>
            {activity.length === 0 ? (
              <p className="text-[14px] text-ink-2">Noch keine Übungen abgeschlossen.</p>
            ) : (
              <ul className="-mx-2 grid grid-cols-[minmax(0,1fr)] gap-1">
                {activity.map((x) => {
                  const ratio = x.task_count ? x.correct_count / x.task_count : 0;
                  return (
                    <li key={x.assignment_id}>
                      <Link href={`/schueler/${x.student_id}/ergebnis/${x.assignment_id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-panel">
                        <Avatar name={x.student_name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{x.title}</span>
                          <span className="block text-[12px] text-ink-3">
                            {x.student_name.split(" ")[0]} · {formatDate(x.completed_at, { day: "numeric", month: "short" })}
                          </span>
                        </span>
                        <span className={`num shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${ratio < 0.6 ? "bg-red-wash text-red" : ratio < 0.8 ? "bg-amber-wash text-amber" : "bg-green-wash text-green"}`}>
                          {x.correct_count}/{x.task_count}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="hausuebungen" className="panel scroll-mt-6 px-4 py-4">
            <h2 className="mb-3 text-[16px] font-semibold">Hausübungen fällig</h2>
            {dueSoon.length === 0 ? (
              <p className="text-[14px] text-ink-2">In den nächsten drei Tagen ist nichts fällig.</p>
            ) : (
              <ul className="grid gap-3">
                {dueSoon.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${h.due_date! < today ? "bg-red-wash text-red" : "bg-panel text-ink-2"}`}>
                      <CalendarClock size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 text-[14px]">
                      <Link href={`/schueler/${h.student_id}?tab=schule`} className="font-semibold hover:text-accent">
                        {h.student_name}
                      </Link>
                      <span className={h.due_date! < today ? "font-medium text-red" : "text-ink-3"}> · {h.due_date! < today ? "überfällig" : formatDate(h.due_date!, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <div className="text-ink-2">{h.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Greeting({ name, subtitle, date }: { name: string; subtitle: string; date?: string }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">Hallo, {name.split(" ")[0]}</h1>
        <p className="mt-1 text-ink-2">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {date && <span className="text-[14px] font-medium text-ink-2 capitalize">{date}</span>}
        <Link href="/uebungen/neu" className="btn btn-primary">
          <Plus size={16} aria-hidden /> Übung erstellen
        </Link>
      </div>
    </header>
  );
}

type Row = { s: repo.Student; a: NonNullable<ReturnType<typeof analyzeStudent>> };

/** The big card: the running unit, otherwise the next lesson today, otherwise a quiet day. */
function Hero({ running, next, byId }: { running: ReturnType<typeof runningUnits>; next: (repo.Lesson & { student_name: string; teacher_name: string | null }) | undefined; byId: Map<number, Row> }) {
  const unit = running[0];
  const student = unit ? byId.get(unit.student_id) : next ? byId.get(next.student_id) : undefined;
  const subject = unit?.subject || next?.subject || student?.s.subjects[0] || null;
  const chips: [string, React.ReactNode][] = [];
  if (student) {
    chips.push(["Schüler", student.s.name], ["Klasse", klassenLabel(student.s.school_type, student.s.klasse, { short: true })]);
    if (subject) chips.push(["Fach", subject]);
    if (unit) chips.push(["Übungen offen", String(unit.open_exercises)]);
    else if (student.a.mainProblem) chips.push(["Schwerpunkt", student.a.mainProblem.skill.name]);
  }
  const title = unit ? (next && next.student_id === unit.student_id && next.topic ? next.topic : `${subject ?? "Einheit"} mit ${unit.student_name.split(" ")[0]}`) : next ? next.topic || `${next.subject} mit ${next.student_name.split(" ")[0]}` : "Kein Termin mehr heute";
  return (
    <section
      className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#fde8d6_0%,#fbd3b4_55%,#f8c19b_100%)] px-6 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7"
      role="region"
      aria-label={unit ? "Aktive Einheiten" : "Nächste Stunde"}
    >
      <div className="relative z-10 md:pr-[230px] lg:pr-[260px]">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#6e3212]">
          {unit ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-semibold text-green">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-40 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                </span>
                Läuft gerade
              </span>
              <span className="num">
                seit {formatTime(unit.started_at)} (<Elapsed since={unit.started_at} />)
              </span>
            </>
          ) : next ? (
            <>
              <span className="rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-semibold text-accent">Als Nächstes</span>
              <span className="num">
                {formatTime(parseLocal(next.starts_at).toISOString())} – {formatTime(new Date(parseLocal(next.starts_at).getTime() + next.duration_min * 60_000).toISOString())}
              </span>
            </>
          ) : (
            <span className="rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-semibold text-accent">Heute frei</span>
          )}
        </div>
        <h2 className="mt-3 text-[32px] leading-[1.1] font-bold tracking-[-0.02em] text-balance sm:text-[40px]">{title}</h2>
        {chips.length > 0 && (
          <dl className="mt-5 flex flex-wrap gap-2">
            {chips.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/55 px-3.5 py-2 backdrop-blur-sm">
                <dt className="text-[11.5px] text-[#7a4426]">{k}</dt>
                <dd className="text-[14px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {!student && <p className="mt-3 max-w-[46ch] text-[15px] text-[#6e3212]">Zeit für Vorbereitung: Übungen erstellen, Ergebnisse ansehen oder Empfehlungen zuweisen.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {unit ? (
            <>
              <Link href={`/tafel/${unit.id}`} className="btn btn-primary !pr-1.5">
                <Presentation size={15} aria-hidden /> Whiteboard
                <span className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-accent">
                  <ArrowUpRight size={15} aria-hidden />
                </span>
              </Link>
              <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary">
                Einheit öffnen
              </Link>
              <form action={endUnitAction.bind(null, unit.id)}>
                <button className="btn btn-secondary">
                  <Square size={13} aria-hidden /> Einheit beenden
                </button>
              </form>
            </>
          ) : student ? (
            <>
              <UnitControl student={student.s} />
              <Link href={`/schueler/${student.s.id}`} className="btn btn-secondary">
                Profil ansehen
              </Link>
            </>
          ) : (
            <>
              <Link href="/uebungen/neu" className="btn btn-primary">
                <Plus size={15} aria-hidden /> Übung erstellen
              </Link>
              <Link href="/schueler" className="btn btn-secondary">
                <Users size={15} aria-hidden /> Schüler
              </Link>
            </>
          )}
        </div>
        {running.length > 1 && (
          <ul className="mt-4 grid gap-1 text-[13px] text-[#6e3212]">
            {running.slice(1).map((u) => (
              <li key={u.id}>
                Außerdem läuft:{" "}
                <Link href={`/einheiten/${u.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {u.student_name}
                </Link>{" "}
                seit {formatTime(u.started_at)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <SubjectArt subject={subject} className="pointer-events-none absolute -right-6 -bottom-8 hidden h-[260px] w-[260px] drop-shadow-[0_18px_24px_rgba(140,60,20,0.18)] md:block lg:right-4 lg:h-[280px] lg:w-[280px]" />
    </section>
  );
}

function Tile({ href, value, label, hint, bg, fg, art }: { href: string; value: number; label: string; hint: string; bg: string; fg: string; art: "alert" | "sheet" | "target" | "calendar" }) {
  return (
    <Link href={href} className="relative block min-h-[132px] overflow-hidden rounded-[22px] px-4 py-4 transition-transform hover:-translate-y-0.5 sm:px-5" style={{ background: bg, color: fg }}>
      <span className="display num block text-[34px] leading-none font-semibold">{value}</span>
      <span className="mt-2 block max-w-[62%] text-[14px] leading-snug font-medium">{label}</span>
      <span className="mt-1 block max-w-[62%] text-[12px] opacity-80">{hint}</span>
      <TileArt kind={art} />
    </Link>
  );
}

function RecommendationList({ rows }: { rows: Row[] }) {
  const recs = rows.flatMap(({ s, a }) => a.recommendations.slice(0, 2).map((r) => ({ s, r })));
  if (recs.length === 0) return <p className="panel px-5 py-5 text-[14px] text-ink-2">Keine offenen Empfehlungen. Sobald Schwächen erkannt werden, erscheinen sie hier.</p>;
  return (
    <ul className="panel divide-y divide-line">
      {recs.map(({ s, r }) => (
        <li key={`${s.id}-${r.key}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
          <Avatar name={s.name} size={34} />
          <span className="min-w-0 flex-1 text-[14px]">
            <span className="font-semibold">{s.name.split(" ")[0]}</span>
            <span className="text-ink-3"> · </span>
            <span className="text-ink-2">{r.skill.area} › </span>
            <span className="font-medium">{r.skill.name}</span> <span className="num text-ink-3">({pct(r.mastery)})</span>
            <span className="block text-[13px] text-ink-2">
              {r.kind === "ueberpruefung" ? "Überprüfung" : r.kind === "wiederholung" ? "Wiederholung" : "Training"}: {r.count} Aufgaben, {r.difficulty}
            </span>
          </span>
          {r.openAssignmentId ? (
            <Pill tone="accent">zugewiesen</Pill>
          ) : (
            <Link href={`/schueler/${s.id}?tab=analyse`} className="btn btn-secondary btn-sm">
              Ansehen und zuweisen
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
