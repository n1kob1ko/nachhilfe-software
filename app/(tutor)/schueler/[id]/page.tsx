import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Art";
import {
  addHomeworkAction,
  addTestAction,
  applyRecommendationAction,
  deleteHomeworkAction,
  deleteTestAction,
  setHomeworkStatusAction,
} from "@/app/actions";
import { AIInsight } from "@/components/AIInsight";
import { Lernverlauf } from "@/components/Lernverlauf";
import { UnitControl } from "@/components/UnitControl";
import { SkillPicker } from "@/components/SkillPicker";
import { CopyLink } from "@/components/CopyLink";
import { ProgressChart } from "@/components/ProgressChart";
import { Empty, LevelTag, MasteryBar, More, Pill, Reveal, SectionTitle, TrendBadge, formatDate, formatDuration, formatTime } from "@/components/ui";
import { Info } from "@/components/Info";
import { aiEnabled } from "@/lib/ai";
import { type Analysis, pct } from "@/lib/analysis";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { analyzeStudent } from "@/lib/service";

const TABS = [
  ["ueberblick", "Überblick"],
  ["lernverlauf", "Lernverlauf"],
  ["uebungen", "Übungen"],
  ["schule", "Hausübungen & Tests"],
  ["fortschritt", "Fortschritt"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; zugewiesen?: string; art?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  if (!student) notFound();
  // old addresses keep working: "stunden" is now the Lernverlauf, "analyse" is part of Fortschritt
  const requested = sp.tab === "stunden" ? "lernverlauf" : sp.tab === "analyse" ? "fortschritt" : sp.tab;
  const tab: Tab = (TABS.find(([k]) => k === requested)?.[0] ?? "ueberblick") as Tab;
  const a = analyzeStudent(student.id)!;
  const teacher = repo.getTeacher(student.teacher_id);

  return (
    <>
      <Link href="/schueler" className="no-print mb-3 inline-flex min-h-[36px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
        ← Alle Schüler
      </Link>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={student.name} size={56} />
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{student.name}</h1>
          <p className="mt-0.5 text-[15px] text-ink-2">
            {klassenLabel(student.school_type, student.klasse)}
            {student.subjects.length > 0 && ` · ${student.subjects.join(", ")}`}
            {teacher && ` · bei ${teacher.name}`}
          </p>
        </div>
      </header>
      <div className="no-print mb-8 flex flex-wrap gap-3">
        <UnitControl student={student} />
        <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-secondary btn-lg">
          <Plus size={18} aria-hidden /> Übung erstellen
        </Link>
        <Link href={`/schueler/${student.id}?tab=lernverlauf`} className="btn btn-secondary btn-lg">
          <History size={18} aria-hidden /> Lernverlauf ansehen
        </Link>
      </div>
      <nav className="no-print mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1" aria-label="Bereiche">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/schueler/${student.id}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors ${
              tab === key ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "ueberblick" && <Overview student={student} a={a} />}
      {tab === "fortschritt" && (
        <div className="space-y-14">
          <Progress a={a} />
          <AnalysisTab student={student} a={a} assignedId={sp.zugewiesen} />
        </div>
      )}
      {tab === "lernverlauf" && <Lessons student={student} filter={sp.art} />}
      {tab === "schule" && <School student={student} a={a} />}
      {tab === "uebungen" && <Exercises student={student} />}
    </>
  );
}

/** Only what a teacher needs before a unit; everything else is one click away under "Weitere Angaben". */
function Overview({ student, a }: { student: repo.Student; a: Analysis }) {
  const lessons = repo.listLessons(student.id).filter((l) => l.kind === "stunde");
  const lastDone = lessons.find((l) => l.status === "abgeschlossen");
  const next = [...lessons].reverse().find((l) => l.status === "geplant" && l.starts_at >= new Date().toISOString().slice(0, 10));
  const tests = repo.listTests(student.id);
  const hw = repo.listHomework(student.id).filter((h) => h.status === "offen");
  const first = student.name.split(" ")[0];
  const skillList = (list: typeof a.strengths, cls: string, empty: string, note: string) =>
    list.length ? (
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {list.slice(0, 3).map((s) => (
          <span key={s.skill.id}>
            {s.skill.name} <span className={`num font-semibold ${cls}`}>{pct(s.mastery)}</span>
          </span>
        ))}
      </span>
    ) : (
      note || <span className="text-ink-3">{empty}</span>
    );
  const rows: [string, React.ReactNode][] = [
    ["Fach und Themen", [student.subjects.join(", "), student.current_topics].filter(Boolean).join(" · ") || "–"],
    ["Stärken", skillList(a.strengths, "text-green", "noch keine gesicherten Stärken", student.strengths_note)],
    ["Schwierigkeiten", skillList(a.weaknesses, "text-red", "keine erkannt", student.weaknesses_note)],
    [
      "Letzte Einheit",
      lastDone ? (
        <span>
          {formatDate(lastDone.starts_at, { weekday: "short", day: "numeric", month: "short" })}
          {lastDone.topic && ` · ${lastDone.topic}`}{" "}
          <Link href={lastDone.unit_id ? `/einheiten/${lastDone.unit_id}` : `/schueler/${student.id}?tab=lernverlauf`} className="link font-medium whitespace-nowrap">
            ansehen
          </Link>
        </span>
      ) : (
        <span className="text-ink-3">noch keine</span>
      ),
    ],
    ["Nächstes Lernziel", lastDone?.next_steps || student.goals || <span className="text-ink-3">noch nicht festgelegt</span>],
  ];
  return (
    <div className="grid max-w-[860px] gap-8">
      <dl className="panel grid gap-x-6 gap-y-4 px-5 py-5 text-[15px] sm:grid-cols-[170px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-ink-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <details className="group rounded-2xl border border-line bg-surface px-5 py-1">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
          Weitere Angaben
          <span className="text-[13px] font-normal text-ink-3 group-open:hidden">Einschätzung, Termine, Tests, Notizen, Link</span>
        </summary>
        <div className="grid gap-6 pt-2 pb-5">
          {a.summary.length > 0 && (
            <ul className="space-y-1.5">
              {a.summary.map((s, i) => (
                <li key={i} className="max-w-[72ch] text-[15px] leading-relaxed">
                  {s}
                </li>
              ))}
            </ul>
          )}
          <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[170px_minmax(0,1fr)]">
            {(
              [
                ["Lernziele", student.goals || "–"],
                ["Nächster Termin", next ? `${formatDate(next.starts_at, { weekday: "short", day: "numeric", month: "short" })}, ${formatTime(next.starts_at)}` : "nicht geplant"],
                ["Einheiten bisher", String(lessons.filter((l) => l.status === "abgeschlossen").length)],
                ["Offene Hausübungen", String(hw.length)],
                ["Letzter Test", tests[0] ? `${tests[0].kind} ${tests[0].subject}: ${tests[0].grade ? `Note ${tests[0].grade}` : ""}${tests[0].points != null ? ` (${tests[0].points}/${tests[0].max_points})` : ""}` : "–"],
                ["Schule", student.school || "–"],
                ["Notizen", student.notes || "–"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-2">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-[14px] font-semibold">
              Link für das Gerät von {first}
              <Info label="Info zum Link">Auf diesem Link sieht {first} die gesendeten Übungen.</Info>
            </h3>
            <div className="max-w-[520px]">
              <CopyLink path={`/lernen/${student.access_token}`} />
            </div>
          </div>
          <Link href={`/schueler/${student.id}/bearbeiten`} className="btn btn-secondary w-fit">
            <Pencil size={15} aria-hidden /> Profil bearbeiten
          </Link>
        </div>
      </details>
    </div>
  );
}

function Progress({ a }: { a: Analysis }) {
  const subjects = a.subjects.filter((s) => s.areas.some((ar) => ar.mastery !== null));
  return (
    <div className="space-y-10">
      <section>
        <SectionTitle>
          <span>
            Verlauf nach Themen
            <Info label="Wie wird die Beherrschung berechnet?">
              Gewichteter Schnitt aus Übungen (1. Versuch ohne Hilfe zählt voll, weitere Versuche und Hilfen weniger), dokumentiertem Verständnis in Einheiten und Testergebnissen. Neuere Daten zählen stärker. Markierungen bei 60 % und 80 %.
            </Info>
          </span>
        </SectionTitle>
        <div className="panel px-5 py-5">
          <ProgressChart series={a.history} />
        </div>
      </section>
      {subjects.length === 0 && <Empty title="Noch keine Fortschrittsdaten">Sende eine Übung oder dokumentiere eine Einheit.</Empty>}
      {subjects.map((subj) => (
        <section key={subj.subject}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{subj.subject}</h2>
            <span className="num text-ink-2">{pct(subj.mastery)}</span>
            <TrendBadge trend={subj.trend} delta={subj.delta} />
          </div>
          <div className="space-y-4">
            {subj.areas
              .filter((ar) => ar.mastery !== null)
              .map((area) => {
                const practiced = area.skills.filter((s) => s.mastery !== null);
                const open = area.skills.filter((s) => s.mastery === null);
                return (
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
                          <th>Stufe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practiced.map((s, i) => (
                          <tr key={s.skill.id} className={i > 0 ? "border-t border-line" : ""}>
                            <td className="w-[40%] py-2.5 pr-3 pl-5">{s.skill.name}</td>
                            <td className="px-3 py-2.5">
                              <MasteryBar value={s.mastery} />
                            </td>
                            <td className="hidden py-2.5 pr-5 pl-3 sm:table-cell">
                              <LevelTag mastery={s.mastery} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex flex-wrap gap-x-6 border-t border-line px-5 py-1">
                      {practiced.some((s) => s.tasksDone > 0) && (
                        <Reveal label="Kennzahlen" className="open:basis-full">
                          <div className="overflow-x-auto pb-3">
                            <table className="num w-full min-w-[480px] text-left text-[13px]">
                              <thead>
                                <tr className="text-[12px] text-ink-3">
                                  <th className="py-1.5 pr-3 font-sans font-semibold">Fähigkeit</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Aufg.</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">1. Versuch</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Ø Zeit</th>
                                  <th className="py-1.5 pl-2 text-right font-semibold">Hilfe</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line">
                                {practiced.map((s) => (
                                  <tr key={s.skill.id}>
                                    <td className="py-1.5 pr-3 font-sans">{s.skill.name}</td>
                                    {s.tasksDone > 0 ? (
                                      <>
                                        <td className="px-2 py-1.5 text-right">{s.tasksDone}</td>
                                        <td className="px-2 py-1.5 text-right">{pct(s.firstTryRate)}</td>
                                        <td className="px-2 py-1.5 text-right">{formatDuration(s.avgTimeSec)}</td>
                                        <td className="py-1.5 pl-2 text-right">{pct(s.hintRate)}</td>
                                      </>
                                    ) : (
                                      <td colSpan={4} className="py-1.5 pl-2 text-right font-sans text-ink-3">
                                        aus Einheiten/Tests
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Reveal>
                      )}
                      {open.length > 0 && (
                        <Reveal label={`${open.length} noch nicht geübt`} className="open:basis-full">
                          <div className="flex flex-wrap gap-1.5 pb-3">
                            {open.map((s) => (
                              <Pill key={s.skill.id}>{s.skill.name}</Pill>
                            ))}
                          </div>
                        </Reveal>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function AnalysisTab({ student, a, assignedId }: { student: repo.Student; a: Analysis; assignedId?: string }) {
  const first = student.name.split(" ")[0];
  const KIND = {
    ueberpruefung: ["green", "Überprüfung"],
    wiederholung: ["amber", "Wiederholung"],
    schwaeche: ["red", "Schwäche"],
  } as const;
  return (
    <div className="space-y-10">
      {assignedId && (
        <p className="flex items-center gap-2 rounded-lg bg-green-wash px-4 py-3 text-[14px] text-green">
          <CheckCircle2 size={16} aria-hidden /> Übung erstellt und an {first} gesendet.{" "}
          <Link className="font-semibold underline underline-offset-2" href={`/uebungen/${assignedId}`}>
            Übung ansehen
          </Link>
        </p>
      )}
      <section>
        <SectionTitle>
          <span>
            Empfehlungen
            <Info label="Wann gibt es Empfehlungen?">Sobald eine Fähigkeit unter 60 % fällt oder länger nicht wiederholt wurde, schlägt die Software passende Übungen vor.</Info>
          </span>
        </SectionTitle>
        {a.recommendations.length === 0 ? (
          <p className="text-[14px] text-ink-3">Keine Empfehlung offen.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {a.recommendations.map((r) => {
              const [tone, label] = KIND[r.kind as keyof typeof KIND] ?? KIND.schwaeche;
              return (
                <li key={r.key} className="panel px-5 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={tone}>{label}</Pill>
                    <span className="font-semibold">{r.skill.name}</span>
                    <span className="num text-[14px] font-semibold text-ink-2">{pct(r.mastery)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.openAssignmentId ? (
                      <Link href={`/schueler/${student.id}?tab=uebungen`} className="btn btn-ghost btn-sm">
                        Gesendet, offen
                      </Link>
                    ) : (
                      <form action={applyRecommendationAction.bind(null, student.id, r.key)}>
                        <button className="btn btn-primary btn-sm">An {first} senden</button>
                      </form>
                    )}
                    <span className="text-[13px] text-ink-2">
                      <span className="num">{r.count}</span> Aufg. · {r.difficulty}
                    </span>
                  </div>
                  <Reveal label="Warum?" className="mt-1">
                    <p className="text-[14px] text-ink-2">
                      {r.skill.area} › {r.skill.name}: {r.reason}
                    </p>
                    <p className="mt-1 text-[14px] text-ink-2">Danach: {r.then}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Häufige Fehler</SectionTitle>
          <More
            className="divide-y divide-line"
            empty="Noch keine Fehler erfasst."
            items={a.errors.map((e) => {
              const skills = e.skillIds.map((id) => a.skills.find((s) => s.skill.id === id)?.skill.name).filter(Boolean);
              return (
                <span key={e.label} className="flex items-baseline justify-between gap-4 py-2 text-[14px]" title={skills.length ? `Bei: ${skills.join(", ")}` : undefined}>
                  <span className="font-medium">{e.label}</span>
                  <span className="num shrink-0 font-semibold">{e.count}×</span>
                </span>
              );
            })}
          />
        </section>
        <section>
          <SectionTitle>Wiederholen</SectionTitle>
          <More
            className="divide-y divide-line"
            empty="Nichts Dringendes."
            items={a.review.map((s) => (
              <span key={s.skill.id} className="flex items-center justify-between gap-4 py-2 text-[14px]">
                <span>{s.skill.name}</span>
                <span className="flex items-center gap-3">
                  <TrendBadge trend={s.trend} compact />
                  <span className="num font-semibold">{pct(s.mastery)}</span>
                </span>
              </span>
            ))}
          />
        </section>
      </div>

      <section>
        <SectionTitle>Einschätzung</SectionTitle>
        <AIInsight studentId={student.id} enabled={aiEnabled()} />
        {a.summary.length > 0 && (
          <Reveal label="Einschätzung in Sätzen" className="mt-2">
            <ul className="space-y-1.5">
              {a.summary.map((s, i) => (
                <li key={i} className="max-w-[72ch] text-[15px]">
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
        )}
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
            <summary className="cursor-pointer text-[13px] text-ink-2">Mit Fähigkeiten verknüpfen</summary>
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
          <p className="font-semibold">
            Link für das Gerät von {first}
            <Info label="Info zum Link">Über diesen Link sieht {first} alle gesendeten Übungen und kann sie selbst bearbeiten.</Info>
          </p>
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
            <p className="text-[13px] font-semibold text-ink-2">Entwürfe für {first}, noch nicht gesendet</p>
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
          title="Noch keine Übungen gesendet"
          action={
            <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary">
              Übung erstellen
            </Link>
          }
        >
          Oder übernimm eine Empfehlung unter Fortschritt.
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
