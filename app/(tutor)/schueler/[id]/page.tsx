import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Art";
import {
  addHomeworkAction,
  applyRecommendationAction,
  deleteHomeworkAction,
  deleteTestAction,
  setHomeworkStatusAction,
} from "@/app/actions";
import { AIInsight } from "@/components/AIInsight";
import { Lernverlauf } from "@/components/Lernverlauf";
import { UnitControl } from "@/components/UnitControl";
import { ExamForm } from "@/components/ExamForm";
import { cancelExamAction, setExamResultAction } from "@/app/curriculum-actions";
import { CopyLink } from "@/components/CopyLink";
import { ProgressChart } from "@/components/ProgressChart";
import { Empty, LevelTag, MasteryBar, More, Pill, Reveal, SectionTitle, StatusChip, TrendBadge, formatDate, formatDuration, formatTime } from "@/components/ui";
import { Info } from "@/components/Info";
import { aiEnabled } from "@/lib/ai";
import { type Analysis, pct } from "@/lib/analysis";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { analyzeStudent } from "@/lib/service";
import { dayOf, daysUntil, examReminders, reminderStage, STAGE_LABEL, STAGE_TONE } from "@/lib/exams";
import { examThresholds } from "@/lib/lehrplan";
import { diagnosesOf } from "@/lib/diagnose";
import { nextSteps, RULE_LABEL, RULE_TONE, type NextStep } from "@/lib/recommend";
import { activeMaterial, materialHistory, materialLabel, MATERIAL_SOURCES, PRIORITY_LABEL, profileTopic } from "@/lib/current-material";
import { errorTypeLabel } from "@/lib/error-types";
import { textErrorsForStudent } from "@/lib/text-correction";
import { MaterialForm } from "@/components/MaterialForm";
import { endMaterialAction } from "@/app/learning-actions";
import { checkLevel } from "@/lib/school";

const TABS = [
  ["ueberblick", "Überblick"],
  ["fortschritt", "Lernstand"],
  ["stoff", "Aktueller Stoff"],
  ["schule", "Prüfungen"],
  ["uebungen", "Übungen"],
  ["lernverlauf", "Lernverlauf"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Builder prefilled for a recommendation: student, skill, number of tasks. */
const builderHref = (studentId: number, r: Pick<NextStep, "skill" | "count">) => `/uebungen/neu?schueler=${studentId}&skill=${encodeURIComponent(r.skill.id)}&anzahl=${r.count}`;

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; zugewiesen?: string; art?: string; bearbeiten?: string; fehler?: string }> }) {
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
          {(() => {
            const level = checkLevel(student.school_type, student.klasse, student.grade);
            return level.status === "unklar" ? (
              <Link href={`/schueler/${student.id}/bearbeiten`} className="mt-1.5 inline-flex" title={level.reason}>
                <Pill tone="amber">Schulstufe unklar · bitte Schulart und Klasse prüfen</Pill>
              </Link>
            ) : null;
          })()}
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
          <AnalysisTab student={student} a={a} assignedId={sp.zugewiesen} error={sp.fehler} />
        </div>
      )}
      {tab === "lernverlauf" && <Lessons student={student} filter={sp.art} />}
      {tab === "schule" && <School student={student} />}
      {tab === "stoff" && <CurrentMaterialTab student={student} edit={Number(sp.bearbeiten) || null} />}
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
  const today = dayOf(new Date());
  const material = activeMaterial(student.id);
  const exam = examReminders(today, { studentId: student.id })[0] ?? repo.upcomingTests(today, student.id)[0];
  const step = nextSteps(student.id, { today, limit: 1 })[0];
  const dueHw = [...hw].sort((x, y) => (x.due_date ?? "9999").localeCompare(y.due_date ?? "9999"))[0];
  // the most important first: what is going on at school now, the next exam, what to practise
  const rows: [string, React.ReactNode][] = [];
  if (material.length) {
    for (const m of material) {
      rows.push([
        `Aktuell in ${m.subject}`,
        <span key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{materialLabel(m)}</span>
          {m.subtopic && <span className="text-ink-2">({m.topic})</span>}
          {m.priority === 1 && <Pill tone="accent">wichtig</Pill>}
          <span className="text-[13px] text-ink-3">seit {formatDate(m.since, { day: "numeric", month: "short" })}</span>
        </span>,
      ]);
    }
  } else {
    rows.push([
      "Fach und Themen",
      <span key="topics">
        {[student.subjects.join(", "), student.current_topics].filter(Boolean).join(" · ") || "–"}{" "}
        <Link href={`/schueler/${student.id}?tab=stoff`} className="link font-medium whitespace-nowrap">
          Aktuellen Stoff festlegen ›
        </Link>
      </span>,
    ]);
  }
  if (exam) {
    const days = daysUntil(exam.date, today);
    const stage = reminderStage(days);
    rows.push([
      "Nächste Prüfung",
      <span key="exam" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {exam.title || `${exam.kind} ${exam.subject}`}
        <span className="num text-ink-2">{days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`}</span>
        {stage && <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>}
        <Link href={`/schueler/${student.id}/pruefung/${exam.id}`} className="link font-medium whitespace-nowrap">
          Vorbereitung ›
        </Link>
      </span>,
    ]);
  }
  if (step) {
    rows.push([
      "Empfohlen",
      <span key="next" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{step.skill.name}</span>
        <Pill tone={RULE_TONE[step.rule]}>{step.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[step.rule]}</Pill>
        <Link href={builderHref(student.id, step)} className="link font-medium whitespace-nowrap">
          Übung erstellen ›
        </Link>
        <span className="basis-full text-[13px] text-ink-2">Grund: {step.reason}</span>
      </span>,
    ]);
  }
  if (dueHw) {
    rows.push([
      "Offene Hausübung",
      <span key="hw">
        {dueHw.description}
        <span className="text-[13px] text-ink-3">
          {" "}
          · {dueHw.subject}
          {dueHw.due_date && `, fällig ${formatDate(dueHw.due_date, { day: "numeric", month: "short" })}`}
          {hw.length > 1 && ` · ${hw.length} offen`}
        </span>
      </span>,
    ]);
  }
  rows.push(
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
  );
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
            <Info label="Wie wird der Lernstand berechnet?">
              Gewichteter Schnitt aus Übungen (1. Versuch ohne Hilfe zählt voll, weitere Versuche und Hilfen weniger, schwere Aufgaben mehr), dokumentiertem Verständnis in Einheiten und Testergebnissen. Neuere Daten zählen stärker, die Arbeitszeit zählt nicht. Ab 85 % sicher, ab 70 % gut, ab 50 % üben, darunter kritisch.
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
          <div className="space-y-3">
            {subj.areas
              .filter((ar) => ar.mastery !== null)
              .map((area) => {
                const practiced = area.skills.filter((s) => s.mastery !== null);
                const open = area.skills.filter((s) => s.mastery === null);
                return (
                  <details key={area.area} className="panel group">
                    <summary className="flex min-h-[52px] cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3 group-open:border-b group-open:border-line">
                      <h3 className="font-semibold">
                        {area.area} <StatusChip mastery={area.mastery} />
                      </h3>
                      <div className="flex items-center gap-4">
                        <TrendBadge trend={area.trend} delta={area.delta} />
                        <span className="text-[13px] font-medium text-accent">
                          <span className="group-open:hidden">Details ›</span>
                          <span className="hidden group-open:inline">Weniger</span>
                        </span>
                      </div>
                    </summary>
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
                  </details>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Diagnoses of the student and the way to start one; for a student without data this is the first step. */
function DiagnosisSection({ student, tested }: { student: repo.Student; tested: boolean }) {
  const list = diagnosesOf(student.id).slice(0, 4);
  const first = student.name.split(" ")[0];
  const start = (
    <Link href={`/diagnose?schueler=${student.id}`} className={`btn btn-sm ${tested ? "btn-secondary" : "btn-primary"}`}>
      Diagnose starten
    </Link>
  );
  if (!list.length && tested) {
    return (
      <p className="flex flex-wrap items-center gap-3 text-[14px] text-ink-2">
        Neues Thema, Stand unklar? {start}
      </p>
    );
  }
  return (
    <section aria-label="Diagnose">
      <SectionTitle action={start}>
        <span>
          Diagnose
          <Info label="Info zur Diagnose">Ein kurzer Test mit 5 bis 10 Aufgaben zu gewählten Themen. Die Antworten zählen normal zum Lernstand und sind als Diagnose markiert.</Info>
        </span>
      </SectionTitle>
      {list.length === 0 ? (
        <p className="text-[14px] text-ink-2">Zu {first} gibt es noch keinen Lernstand. Eine Diagnose zeigt in wenigen Minuten, was sitzt und wo Lücken sind.</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {list.map((d) => (
            <li key={d.id}>
              <Link href={`/diagnose/${d.id}`} className="flex min-h-[52px] items-center gap-3 px-4 py-2 hover:bg-panel/60">
                <span className="min-w-0 flex-1 truncate font-medium">{d.title.replace(`${first} – `, "")}</span>
                <span className="num text-[13px] text-ink-3">{formatDate(d.assigned_at, { day: "numeric", month: "short" })}</span>
                {d.done_count >= d.task_count ? <Pill tone="green">fertig</Pill> : <Pill tone="amber">{d.done_count}/{d.task_count}</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnalysisTab({ student, a, assignedId, error }: { student: repo.Student; a: Analysis; assignedId?: string; error?: string }) {
  const first = student.name.split(" ")[0];
  const steps = nextSteps(student.id, { today: dayOf(new Date()), limit: 6 });
  const textErrors = textErrorsForStudent(student.id);
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
      {error && (
        <p className="rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
          {error}
        </p>
      )}
      <section>
        <SectionTitle>
          <span>
            Empfohlene Übungen
            <Info label="Wie entsteht die Empfehlung?">
              Ohne KI, nach Priorität: 1. bevorstehende Prüfung, 2. aktueller Stoff, 3. schwache Fähigkeiten, 4. wiederholte Fehler, 5. fehlende Voraussetzungen, 6. lange nicht geübt, 7. nächster sinnvoller Schritt.
            </Info>
          </span>
        </SectionTitle>
        {steps.length === 0 ? (
          <p className="text-[14px] text-ink-3">Keine Empfehlung offen.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {steps.map((r) => (
              <li key={r.key} className="panel px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={RULE_TONE[r.rule]}>{r.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[r.rule]}</Pill>
                  <span className="font-semibold">{r.skill.name}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] text-ink-2">{r.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={builderHref(student.id, r)} className="btn btn-primary btn-sm">
                    Übung erstellen
                  </Link>
                  {r.openAssignmentId ? (
                    <Link href={`/schueler/${student.id}/ergebnis/${r.openAssignmentId}`} className="btn btn-ghost btn-sm">
                      Gesendet, offen
                    </Link>
                  ) : (
                    <form action={applyRecommendationAction.bind(null, student.id, r.key, null)}>
                      <button className="btn btn-secondary btn-sm" title={`${r.count} Aufgaben, ${r.difficulty}, sofort senden`}>
                        Direkt an {first} senden
                      </button>
                    </form>
                  )}
                  <span className="text-[13px] text-ink-3">
                    <span className="num">{r.count}</span> Aufg. · {r.difficulty}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DiagnosisSection student={student} tested={a.skills.some((x) => x.mastery !== null)} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>
            <span>
              Häufige Fehler
              <Info label="Info zu Fehlerarten">Fehlerarten schlägt die App vor, wo eine Regel eindeutig ist. In jedem Ergebnis kannst du sie bestätigen oder ändern. „In Texten“ zählt nur Korrekturen, die du in einer Textkorrektur übernommen hast; sie ändern den Lernstand nicht.</Info>
            </span>
          </SectionTitle>
          {a.errorTypes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Fehlerarten">
              {a.errorTypes.slice(0, 6).map((e) => (
                <Pill key={e.type} tone={e.confirmed ? "amber" : "neutral"} title={e.confirmed ? `${e.confirmed} vom Lehrer bestätigt` : "Vorschläge der App, noch nicht bestätigt"}>
                  {errorTypeLabel(e.type)} <span className="num">{e.count}×</span>
                </Pill>
              ))}
            </div>
          )}
          {textErrors.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Fehler in Texten" data-testid="textfehler">
              <span className="text-[13px] font-semibold text-ink-2">In Texten:</span>
              {textErrors.map((e) => (
                <Pill key={e.category} tone="amber" title={`${e.count} bestätigte Fehler in ${e.texts === 1 ? "einem Text" : `${e.texts} Texten`} (Textkorrektur)`}>
                  {e.label} <span className="num">{e.count}×</span>
                </Pill>
              ))}
            </div>
          )}
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

/** Aktueller Stoff per subject: what the school is doing now, on top of the official curriculum. */
function CurrentMaterialTab({ student, edit }: { student: repo.Student; edit: number | null }) {
  const active = activeMaterial(student.id);
  const history = materialHistory(student.id);
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const skills = repo.listSkills().map(({ id, name, area, subject }) => ({ id, name, area, subject }));
  const a = analyzeStudent(student.id)!;
  const m = (id: string) => a.skills.find((s) => s.skill.id === id)?.mastery ?? null;
  const today = dayOf(new Date());
  const editing = active.find((x) => x.id === edit);
  const open = subjects.filter((s) => !active.some((x) => x.subject === s));
  // the free-text topics of the profile prefill the Thema once (the teacher still saves it); a second
  // topic is another topic, not the Unterthema, and the full text stays visible above the form
  const pTopic = profileTopic(student.current_topics);
  const fromProfile = active.length === 0 && pTopic ? { subject: open[0] ?? subjects[0], topic: pTopic, subtopic: "", skill_ids: [], since: today, priority: 2, note: "", source: "unterricht" } : undefined;
  return (
    <div className="grid max-w-[920px] gap-10">
      <section aria-label="Aktueller Stoff">
        <SectionTitle>
          <span>
            Aktueller Stoff
            <Info label="Info zum aktuellen Stoff">Was in der Schule gerade dran ist, pro Fach. Der offizielle Lehrplan bleibt unverändert. Die Fähigkeiten werden im Übungs-Builder vorausgewählt und fließen in die Empfehlung ein.</Info>
          </span>
        </SectionTitle>
        {active.length === 0 && <p className="text-[14px] text-ink-3">Noch kein aktueller Stoff festgelegt.{student.current_topics && ` Im Profil steht: „${student.current_topics}“.`}</p>}
        <ul className="grid gap-3">
          {active.map((cm) => (
            <li key={cm.id} className="panel px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold text-ink-2">Aktuell in {cm.subject}:</span>
                <span className="text-[17px] font-semibold">{materialLabel(cm)}</span>
                {cm.subtopic && <span className="text-ink-2">({cm.topic})</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                <Pill>seit {formatDate(cm.since, { day: "numeric", month: "short" })}</Pill>
                <Pill>{MATERIAL_SOURCES[cm.source] ?? cm.source}</Pill>
                <Pill tone={cm.priority === 1 ? "accent" : "neutral"}>Priorität {PRIORITY_LABEL[cm.priority]}</Pill>
              </div>
              {cm.skill_ids.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {cm.skill_ids.map((id) => {
                    const sk = skills.find((x) => x.id === id);
                    return sk ? (
                      <span key={id} className="inline-flex items-center gap-1.5 text-[14px]">
                        {sk.name} <StatusChip mastery={m(id)} />
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {cm.note && <p className="mt-2 text-[14px] text-ink-2">{cm.note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/uebungen/neu?schueler=${student.id}&stoff=${cm.id}`} className="btn btn-primary btn-sm">
                  Übung dazu erstellen
                </Link>
                <Link href={`/schueler/${student.id}?tab=stoff&bearbeiten=${cm.id}`} className="btn btn-ghost btn-sm">
                  <Pencil size={14} aria-hidden /> Bearbeiten
                </Link>
                <form action={endMaterialAction.bind(null, cm.id)} className="ml-auto">
                  <button className="btn btn-ghost btn-sm" title="Kommt in den Verlauf">
                    Abgeschlossen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={editing ? "Stoff bearbeiten" : "Neuer Stoff"}>
        <SectionTitle>{editing ? `${editing.subject}: Stoff bearbeiten` : active.length ? "Neuer Stoff" : "Stoff festlegen"}</SectionTitle>
        {!editing && active.length > 0 && <p className="-mt-1 mb-3 text-[13.5px] text-ink-2">Ein neuer Stoff im selben Fach ersetzt den bisherigen; der kommt in den Verlauf.</p>}
        <MaterialForm
          key={editing?.id ?? "neu"}
          studentId={student.id}
          subjects={editing ? [editing.subject] : [...open, ...subjects.filter((x) => !open.includes(x))]}
          skills={skills}
          today={today}
          initial={editing ? { ...editing } : fromProfile}
        />
      </section>

      {history.length > 0 && (
        <section aria-label="Verlauf">
          <SectionTitle>Verlauf</SectionTitle>
          <ul className="panel divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-[14px]">
                <span>
                  <span className="text-ink-2">{h.subject}:</span> <span className="font-medium">{materialLabel(h)}</span>
                  {h.subtopic && <span className="text-ink-3"> ({h.topic})</span>}
                </span>
                <span className="num text-[13px] text-ink-3">
                  {formatDate(h.since, { day: "numeric", month: "short" })} – {formatDate(h.ended_at!, { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Lessons({ student, filter }: { student: repo.Student; filter?: string }) {
  return <Lernverlauf student={student} filter={filter} />;
}

function School({ student }: { student: repo.Student }) {
  const homework = repo.listHomework(student.id);
  const tests = repo.listTests(student.id);
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const today = dayOf(new Date());
  const upcoming = tests.filter((t) => t.status === "geplant").sort((x, y) => x.date.localeCompare(y.date));
  const written = tests.filter((t) => t.status !== "geplant" && t.status !== "abgesagt");
  const a = analyzeStudent(student.id)!;
  const m = (id: string) => a.skills.find((s) => s.skill.id === id)?.mastery ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-2">
      <section aria-label="Prüfungen">
        <SectionTitle>
          <span>
            Schularbeiten und Tests
            <Info label="Info zu Prüfungen">
              Ab {examThresholds()[0]} Tagen vorher erinnert die Startseite an die Vorbereitung, ab {examThresholds()[1]} Tagen mit höherer Priorität, ab {examThresholds()[2]} Tagen als „Prüfung bald“.
            </Info>
          </span>
        </SectionTitle>
        <ul className="mb-5 grid gap-3">
          {upcoming.length === 0 && <li className="text-[14px] text-ink-3">Keine Prüfung geplant.</li>}
          {upcoming.map((t) => {
            const days = daysUntil(t.date, today);
            const stage = reminderStage(days);
            const skills = t.skill_ids.map((id) => repo.getSkill(id)).filter((x): x is repo.Skill => Boolean(x));
            return (
              <li key={t.id} className="panel px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {t.title || `${t.kind} ${t.subject}`}
                  </span>
                  <span className="num text-[14px] text-ink-2">
                    {formatDate(t.date, { weekday: "short", day: "numeric", month: "short" })} · {days < 0 ? "vorbei" : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`}
                  </span>
                  {stage && <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>}
                </div>
                {(t.topics?.length ?? 0) > 0 && <p className="mt-1 text-[13.5px] text-ink-2">Stoff: {t.topics!.join(", ")}</p>}
                {skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skills.map((sk) => (
                      <span key={sk.id} className="inline-flex items-center gap-1 text-[13px]">
                        {sk.name} <StatusChip mastery={m(sk.id)} />
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/schueler/${student.id}/pruefung/${t.id}`} className="btn btn-primary btn-sm">
                    Vorbereitung starten
                  </Link>
                  <Reveal label="Ergebnis eintragen">
                    <form action={setExamResultAction.bind(null, t.id)} className="flex flex-wrap items-center gap-2">
                      <input className="input num w-[84px]" name="grade" type="number" min={1} max={5} placeholder="Note" aria-label="Note" />
                      <input className="input num w-[84px]" name="points" inputMode="decimal" placeholder="Punkte" aria-label="Punkte" />
                      <input className="input num w-[84px]" name="max_points" inputMode="decimal" placeholder="von" aria-label="Höchstpunkte" />
                      <button className="btn btn-secondary btn-sm">Speichern</button>
                    </form>
                  </Reveal>
                  <form action={cancelExamAction.bind(null, t.id)} className="ml-auto">
                    <button className="btn btn-ghost btn-sm">Absagen</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
        <ExamForm studentId={student.id} subjects={subjects} today={today} />
        <h3 className="mt-8 mb-1 text-[15px] font-semibold">Ergebnisse</h3>
        <ul className="divide-y divide-line">
          {written.length === 0 && <li className="py-2 text-[14px] text-ink-3">Noch keine Ergebnisse eingetragen.</li>}
          {written.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2.5 text-[14px]">
              <div>
                <span className="font-medium">
                  {t.title || `${t.kind} ${t.subject}`}
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
                  <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label="Löschen">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
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
                  <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label="Löschen">
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
          <Link href={`/lernen/${student.access_token}`} target="_blank" className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label="Schüleransicht öffnen">
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
                      {x.kind === "diagnose" && (
                        <>
                          {" · "}
                          <Link href={`/diagnose/${x.id}`} className="font-semibold text-accent hover:underline">
                            Diagnose-Auswertung
                          </Link>
                        </>
                      )}
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
