import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addHomeworkAction,
  addTestAction,
  applyRecommendationAction,
  deleteHomeworkAction,
  deleteTestAction,
  setHomeworkStatusAction,
} from "@/app/actions";
import { AIInsight } from "@/components/AIInsight";
import { LessonCard } from "@/components/LessonCard";
import { Lernverlauf } from "@/components/Lernverlauf";
import { UnitControl } from "@/components/UnitControl";
import { SkillPicker } from "@/components/SkillPicker";
import { CopyLink } from "@/components/CopyLink";
import { ProgressChart } from "@/components/ProgressChart";
import { Empty, LevelTag, MasteryBar, PageHeader, Pill, SectionTitle, TrendBadge, formatDate, formatDuration, formatTime } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { type Analysis, pct } from "@/lib/analysis";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { analyzeStudent } from "@/lib/service";

const TABS = [
  ["ueberblick", "Überblick"],
  ["fortschritt", "Fortschritt"],
  ["analyse", "Analyse & Empfehlungen"],
  ["lernverlauf", "Lernverlauf"],
  ["schule", "Hausübungen & Tests"],
  ["uebungen", "Übungen"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; zugewiesen?: string; art?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  if (!student) notFound();
  const requested = sp.tab === "stunden" ? "lernverlauf" : sp.tab;
  const tab: Tab = (TABS.find(([k]) => k === requested)?.[0] ?? "ueberblick") as Tab;
  const a = analyzeStudent(student.id)!;
  const teacher = repo.getTeacher(student.teacher_id);

  return (
    <>
      <PageHeader
        back={{ href: "/schueler", label: "Schüler" }}
        title={student.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {klassenLabel(student.school_type, student.klasse)}
              {student.school && ` · ${student.school}`}
              {teacher && ` · Lehrer: ${teacher.name}`}
            </span>
            <TrendBadge trend={a.overall.trend} delta={a.overall.delta} />
          </span>
        }
        actions={
          <>
            <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-secondary">
              <Plus size={15} aria-hidden /> Übung erstellen
            </Link>
            <UnitControl student={student} />
          </>
        }
      />
      <nav className="no-print -mt-3 mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1" aria-label="Bereiche">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/schueler/${student.id}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors ${
              tab === key ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "ueberblick" && <Overview student={student} a={a} />}
      {tab === "fortschritt" && <Progress a={a} />}
      {tab === "analyse" && <AnalysisTab student={student} a={a} assignedId={sp.zugewiesen} />}
      {tab === "lernverlauf" && <Lessons student={student} filter={sp.art} />}
      {tab === "schule" && <School student={student} a={a} />}
      {tab === "uebungen" && <Exercises student={student} />}
    </>
  );
}

function Overview({ student, a }: { student: repo.Student; a: Analysis }) {
  const lessons = repo.listLessons(student.id).filter((l) => l.kind === "stunde");
  const lastDone = lessons.find((l) => l.status === "abgeschlossen");
  const next = [...lessons].reverse().find((l) => l.status === "geplant" && l.starts_at >= new Date().toISOString().slice(0, 10));
  const tests = repo.listTests(student.id);
  const hw = repo.listHomework(student.id).filter((h) => h.status === "offen");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-10">
        <section>
          <SectionTitle>Auf einen Blick</SectionTitle>
          <ul className="space-y-2">
            {a.summary.map((s, i) => (
              <li key={i} className="max-w-[72ch] text-[16px] leading-relaxed">
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <SectionTitle>Stärken</SectionTitle>
            {a.strengths.length > 0 ? (
              <ul className="space-y-1.5">
                {a.strengths.slice(0, 5).map((s) => (
                  <li key={s.skill.id} className="flex justify-between gap-3 text-[14px]">
                    <span>
                      {s.skill.name} <span className="text-ink-3">· {s.skill.area}</span>
                    </span>
                    <span className="num font-semibold text-green">{pct(s.mastery)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-3">Noch keine gesicherten Stärken.</p>
            )}
            {student.strengths_note && <p className="mt-3 border-t border-line pt-3 text-[14px] text-ink-2">{student.strengths_note}</p>}
          </div>
          <div>
            <SectionTitle>Schwächen</SectionTitle>
            {a.weaknesses.length > 0 ? (
              <ul className="space-y-1.5">
                {a.weaknesses.slice(0, 5).map((s) => (
                  <li key={s.skill.id} className="flex justify-between gap-3 text-[14px]">
                    <span>
                      {s.skill.name} <span className="text-ink-3">· {s.skill.area}</span>
                    </span>
                    <span className="num font-semibold text-red">{pct(s.mastery)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-3">Keine Schwäche erkannt.</p>
            )}
            {student.weaknesses_note && <p className="mt-3 border-t border-line pt-3 text-[14px] text-ink-2">{student.weaknesses_note}</p>}
          </div>
        </section>
        {lastDone && (
          <section>
            <SectionTitle action={<Link className="link text-[13px] font-medium" href={`/schueler/${student.id}?tab=lernverlauf`}>Lernverlauf</Link>}>Letzte Stunde</SectionTitle>
            <LessonCard lesson={lastDone} studentId={student.id} />
          </section>
        )}
      </div>
      <aside className="space-y-8">
        <dl className="panel divide-y divide-line text-[14px]">
          {[
            ["Fächer", student.subjects.join(", ") || "–"],
            ["Aktuelle Themen", student.current_topics || "–"],
            ["Lernziele", student.goals || "–"],
            ["Nächste Stunde", next ? `${formatDate(next.starts_at, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(next.starts_at)}` : "nicht geplant"],
            ["Stunden bisher", String(lessons.filter((l) => l.status === "abgeschlossen").length)],
            ["Offene Hausübungen", String(hw.length)],
            ["Letzter Test", tests[0] ? `${tests[0].kind} ${tests[0].subject}: ${tests[0].grade ? `Note ${tests[0].grade}` : ""}${tests[0].points != null ? ` (${tests[0].points}/${tests[0].max_points})` : ""}` : "–"],
            ["Notizen", student.notes || "–"],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-2.5">
              <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-2">Zugang für {student.name.split(" ")[0]}</h3>
          <CopyLink path={`/lernen/${student.access_token}`} />
          <p className="mt-2 text-[12px] text-ink-3">Über diesen Link bearbeitet {student.name.split(" ")[0]} die zugewiesenen Übungen.</p>
        </div>
        <Link href={`/schueler/${student.id}/bearbeiten`} className="btn btn-ghost btn-sm">
          <Pencil size={14} aria-hidden /> Profil bearbeiten
        </Link>
      </aside>
    </div>
  );
}

function Progress({ a }: { a: Analysis }) {
  const subjects = a.subjects.filter((s) => s.areas.some((ar) => ar.mastery !== null));
  return (
    <div className="space-y-12">
      <section>
        <SectionTitle>Verlauf nach Themen</SectionTitle>
        <div className="panel px-5 py-5">
          <ProgressChart series={a.history} />
        </div>
      </section>
      {subjects.length === 0 && <Empty title="Noch keine Fortschrittsdaten">Weise eine Übung zu oder dokumentiere eine Stunde mit verknüpften Fähigkeiten.</Empty>}
      {subjects.map((subj) => (
        <section key={subj.subject}>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{subj.subject}</h2>
            <span className="num text-ink-2">{pct(subj.mastery)}</span>
            <TrendBadge trend={subj.trend} delta={subj.delta} />
          </div>
          <div className="space-y-6">
            {subj.areas
              .filter((ar) => ar.mastery !== null)
              .map((area) => (
                <div key={area.area} className="panel">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                    <h3 className="font-semibold">{area.area}</h3>
                    <div className="flex items-center gap-4">
                      <TrendBadge trend={area.trend} delta={area.delta} />
                      <span className="num w-11 text-right font-semibold">{pct(area.mastery)}</span>
                    </div>
                  </div>
                  <table className="w-full text-left text-[14px]">
                    <thead className="sr-only">
                      <tr>
                        <th>Fähigkeit</th>
                        <th>Beherrschung</th>
                        <th>Trend</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.skills.map((s, i) => (
                        <tr key={s.skill.id} className={i > 0 ? "border-t border-line" : ""}>
                          <td className="w-[34%] py-2.5 pr-3 pl-5">
                            <span className="text-ink-3" aria-hidden>
                              {i === area.skills.length - 1 ? "└─ " : "├─ "}
                            </span>
                            {s.skill.name}
                          </td>
                          <td className="w-[36%] px-3 py-2.5">
                            <MasteryBar value={s.mastery} />
                          </td>
                          <td className="hidden px-3 py-2.5 sm:table-cell">
                            <LevelTag mastery={s.mastery} />
                          </td>
                          <td className="hidden py-2.5 pr-5 pl-3 text-right text-[12px] whitespace-nowrap text-ink-3 xl:table-cell">
                            {s.tasksDone > 0 ? (
                              <span className="num">
                                {s.tasksDone} Aufg. · {pct(s.firstTryRate)} im 1. Versuch · Ø {formatDuration(s.avgTimeSec)}/Aufg. · Hilfe {pct(s.hintRate)}
                              </span>
                            ) : s.mastery !== null ? (
                              "aus Stunden/Tests"
                            ) : (
                              "noch nicht geübt"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </section>
      ))}
      <p className="text-[13px] text-ink-3">
        Beherrschung: gewichteter Schnitt aus Übungen (1. Versuch ohne Hilfe zählt voll, weitere Versuche und Hilfen weniger), dokumentiertem Verständnis in Stunden und Testergebnissen. Neuere Daten zählen stärker. Markierungen bei 60 % und 80 %.
      </p>
    </div>
  );
}

function AnalysisTab({ student, a, assignedId }: { student: repo.Student; a: Analysis; assignedId?: string }) {
  const first = student.name.split(" ")[0];
  return (
    <div className="space-y-12">
      {assignedId && (
        <p className="flex items-center gap-2 rounded-lg bg-green-wash px-4 py-3 text-[14px] text-green">
          <CheckCircle2 size={16} aria-hidden /> Übung erstellt und {first} zugewiesen.{" "}
          <Link className="font-semibold underline underline-offset-2" href={`/uebungen/${assignedId}`}>
            Übung ansehen
          </Link>
        </p>
      )}
      <section>
        <SectionTitle>Empfehlungen</SectionTitle>
        {a.recommendations.length === 0 ? (
          <Empty title="Keine Empfehlung offen">Sobald eine Fähigkeit unter 60 % fällt oder länger nicht wiederholt wurde, schlägt die Software hier passende Übungen vor.</Empty>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {a.recommendations.map((r) => (
              <li key={r.key} className="panel flex flex-col px-5 py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Pill tone={r.kind === "ueberpruefung" ? "green" : r.kind === "wiederholung" ? "amber" : "red"}>
                    {r.kind === "ueberpruefung" ? "Überprüfung" : r.kind === "wiederholung" ? "Wiederholung" : "Schwäche erkannt"}
                  </Pill>
                  <span className="num text-[13px] text-ink-2">aktuell {pct(r.mastery)}</span>
                </div>
                <h3 className="text-[16px] font-semibold">
                  {r.skill.area} › {r.skill.name}
                </h3>
                <p className="mt-1 text-[14px] text-ink-2">{r.reason}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
                  <dt className="text-ink-3">Empfehlung</dt>
                  <dd>
                    {r.count} Aufgaben, Schwierigkeit {r.difficulty}
                  </dd>
                  <dt className="text-ink-3">Danach</dt>
                  <dd>{r.then}</dd>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                  {r.openAssignmentId ? (
                    <span className="text-[13px] text-ink-2">
                      Bereits zugewiesen, wartet auf Bearbeitung.{" "}
                      <Link href={`/schueler/${student.id}?tab=uebungen`} className="link font-semibold">
                        Übungen
                      </Link>
                    </span>
                  ) : (
                    <form action={applyRecommendationAction.bind(null, student.id, r.key)}>
                      <button className="btn btn-primary btn-sm">Erstellen und {first} zuweisen</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Häufige Fehler</SectionTitle>
          {a.errors.length === 0 ? (
            <p className="text-[14px] text-ink-3">Noch keine Fehler erfasst.</p>
          ) : (
            <ol className="space-y-2">
              {a.errors.slice(0, 8).map((e) => {
                const skills = e.skillIds.map((id) => a.skills.find((s) => s.skill.id === id)?.skill.name).filter(Boolean);
                return (
                  <li key={e.label} className="flex items-baseline justify-between gap-4 border-b border-line pb-2 text-[14px]">
                    <span>
                      <span className="font-medium">{e.label}</span>
                      {skills.length > 0 && <span className="text-ink-3"> · {skills.join(", ")}</span>}
                    </span>
                    <span className="num shrink-0 font-semibold">{e.count}×</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section>
          <SectionTitle>Wiederholen</SectionTitle>
          {a.review.length === 0 ? (
            <p className="text-[14px] text-ink-3">Nichts, das gerade verloren zu gehen droht.</p>
          ) : (
            <ul className="space-y-2">
              {a.review.map((s) => (
                <li key={s.skill.id} className="flex items-center justify-between gap-4 border-b border-line pb-2 text-[14px]">
                  <span>
                    {s.skill.name} <span className="text-ink-3">· {s.skill.area}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <TrendBadge trend={s.trend} compact />
                    <span className="num font-semibold">{pct(s.mastery)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <SectionTitle>Einschätzung</SectionTitle>
        <ul className="mb-6 space-y-2">
          {a.summary.map((s, i) => (
            <li key={i} className="max-w-[72ch]">
              {s}
            </li>
          ))}
        </ul>
        <AIInsight studentId={student.id} enabled={aiEnabled()} />
      </section>
    </div>
  );
}

function Lessons({ student, filter }: { student: repo.Student; filter?: string }) {
  return <Lernverlauf student={student} filter={filter} />;
}

function School({ student, a }: { student: repo.Student; a: Analysis }) {
  const homework = repo.listHomework(student.id);
  const tests = repo.listTests(student.id);
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const skills = a.skills.map((s) => s.skill);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section>
        <SectionTitle>Hausübungen</SectionTitle>
        <ul className="mb-5 divide-y divide-line">
          {homework.length === 0 && <li className="py-2 text-[14px] text-ink-3">Keine Hausübungen eingetragen.</li>}
          {homework.map((h) => {
            const done = h.status === "erledigt";
            return (
              <li key={h.id} className="flex items-start gap-3 py-2.5">
                <form action={setHomeworkStatusAction.bind(null, h.id, student.id, done ? "offen" : "erledigt")}>
                  <button className={`mt-0.5 ${done ? "text-green" : "text-ink-3 hover:text-ink"}`} aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}>
                    {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                </form>
                <div className={`min-w-0 flex-1 text-[14px] ${done ? "text-ink-3 line-through" : ""}`}>
                  {h.description}
                  <div className="text-[12px] text-ink-3 no-underline">
                    {h.subject}
                    {h.due_date && ` · fällig ${formatDate(h.due_date, { day: "numeric", month: "short" })}`}
                    {!done && h.due_date && h.due_date < today && <span className="font-semibold text-red"> · überfällig</span>}
                  </div>
                </div>
                <form action={deleteHomeworkAction.bind(null, h.id, student.id)}>
                  <button className="btn btn-ghost btn-sm !px-2" aria-label="Löschen">
                    <Trash2 size={14} />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <form action={addHomeworkAction} className="panel grid gap-3 px-4 py-4">
          <input type="hidden" name="student_id" value={student.id} />
          <label className="field">
            <span className="label">Neue Hausübung</span>
            <input className="input" name="description" required placeholder="z. B. Buch S. 84, Nr. 3–7" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" name="subject" aria-label="Fach">
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input className="input" type="date" name="due_date" aria-label="Fällig am" />
          </div>
          <button className="btn btn-secondary justify-self-start">Hinzufügen</button>
        </form>
      </section>
      <section>
        <SectionTitle>Testergebnisse</SectionTitle>
        <ul className="mb-5 divide-y divide-line">
          {tests.length === 0 && <li className="py-2 text-[14px] text-ink-3">Noch keine Tests eingetragen.</li>}
          {tests.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2.5 text-[14px]">
              <div>
                <span className="font-medium">
                  {t.kind} {t.subject}
                </span>
                {t.topic && <span className="text-ink-2"> · {t.topic}</span>}
                <div className="text-[12px] text-ink-3">
                  {formatDate(t.date)}
                  {t.notes && ` · ${t.notes}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="num text-right">
                  {t.grade && <span className="font-semibold">Note {t.grade}</span>}
                  {t.points != null && (
                    <span className="block text-[12px] text-ink-3">
                      {t.points}/{t.max_points} P.
                    </span>
                  )}
                </span>
                <form action={deleteTestAction.bind(null, t.id, student.id)}>
                  <button className="btn btn-ghost btn-sm !px-2" aria-label="Löschen">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form action={addTestAction} className="panel grid gap-3 px-4 py-4">
          <input type="hidden" name="student_id" value={student.id} />
          <span className="label">Neues Ergebnis</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <select className="input" name="kind" aria-label="Art">
              {["Schularbeit", "Test", "Vokabeltest", "Mitarbeit", "Zeugnis"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <select className="input" name="subject" aria-label="Fach">
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input className="input" type="date" name="date" required defaultValue={today} aria-label="Datum" />
          </div>
          <input className="input" name="topic" placeholder="Stoff, z. B. Bruchrechnung" />
          <div className="grid grid-cols-3 gap-3">
            <input className="input num" name="grade" type="number" min={1} max={5} placeholder="Note" />
            <input className="input num" name="points" inputMode="decimal" placeholder="Punkte" />
            <input className="input num" name="max_points" inputMode="decimal" placeholder="von" />
          </div>
          <details>
            <summary className="cursor-pointer text-[13px] text-ink-2">Mit Fähigkeiten verknüpfen (fließt in den Fortschritt ein)</summary>
            <SkillPicker skills={skills} />
          </details>
          <button className="btn btn-secondary justify-self-start">Speichern</button>
        </form>
      </section>
    </div>
  );
}

function Exercises({ student }: { student: repo.Student }) {
  const list = repo.listAssignments(student.id);
  const first = student.name.split(" ")[0];
  return (
    <div className="space-y-8">
      <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Zugang für {first}</p>
          <p className="text-[13px] text-ink-2">Über diesen Link sieht {first} alle zugewiesenen Übungen und kann sie selbst bearbeiten.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-[440px]">
          <CopyLink path={`/lernen/${student.access_token}`} />
          <Link href={`/lernen/${student.access_token}`} target="_blank" className="btn btn-ghost btn-sm !px-2" aria-label="Schüleransicht öffnen">
            <ExternalLink size={15} />
          </Link>
        </div>
      </div>
      {(() => {
        const drafts = repo.listWorksheets().filter((w) => w.student_id === student.id && w.status === "entwurf");
        if (!drafts.length) return null;
        return (
          <div className="mb-6 rounded-xl border border-dashed border-line-strong px-5 py-3">
            <p className="text-[13px] font-semibold text-ink-2">Entwürfe für {first}, noch nicht freigegeben</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {drafts.map((w) => (
                <li key={w.id}>
                  <Link href={`/uebungen/${w.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-amber-wash px-2.5 py-1 text-[13px] font-medium text-amber hover:underline">
                    <Pencil size={12} aria-hidden /> {w.title} · {w.task_count} Aufgaben
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
      {list.length === 0 ? (
        <Empty
          title="Noch keine Übungen zugewiesen"
          action={
            <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary">
              Übung erstellen
            </Link>
          }
        >
          Erstelle eine Übung oder übernimm eine Empfehlung aus der Analyse.
        </Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-5 py-3 font-semibold">Übung</th>
                <th className="px-3 py-3 font-semibold">Zugewiesen</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Ergebnis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((x) => (
                <tr key={x.id}>
                  <td className="px-5 py-3">
                    <Link href={`/schueler/${student.id}/ergebnis/${x.id}`} className="font-medium hover:text-accent">
                      {x.title}
                    </Link>
                    <div className="text-[12px] text-ink-3">
                      {x.task_count} Aufgaben · {x.difficulty}
                      {x.kind === "ueberpruefung" && " · Überprüfung"}
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-ink-2">{formatDate(x.assigned_at, { day: "numeric", month: "short" })}</td>
                  <td className="px-3 py-3">
                    {x.completed_at ? <Pill tone="green">erledigt</Pill> : x.done_count > 0 ? <Pill tone="amber">{x.done_count}/{x.task_count} bearbeitet</Pill> : <Pill>offen</Pill>}
                  </td>
                  <td className="num px-5 py-3 text-right font-semibold">{x.done_count > 0 ? `${x.correct_count}/${x.done_count} richtig` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
