import Link from "next/link";
import { CalendarClock, ClipboardCheck, NotebookText, Plus } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { Empty, MasteryBar, PageHeader, Pill, SectionTitle, TrendBadge, formatDate, formatTime } from "@/components/ui";
import { pct } from "@/lib/analysis";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

function dayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Dashboard() {
  const students = repo.listStudents();
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const lessons = repo.lessonsBetween(`${today}T00:00`, `${tomorrow}T00:00`).filter((l) => l.status !== "abgesagt");
  const dueSoon = repo.openHomeworkDue(dayKey(new Date(now.getTime() + 3 * 86_400_000)));
  const activity = repo.recentActivity(6);
  const rows = students.map((s) => ({ s, a: analyzeStudent(s.id)! }));
  const byId = new Map(rows.map((r) => [r.s.id, r]));
  const dateText = now.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" });

  if (students.length === 0) {
    return (
      <>
        <PageHeader title="Willkommen im Lernheft" subtitle="Hier siehst du später auf einen Blick, wer heute kommt, wo es hakt und was als Nächstes dran ist." />
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

  return (
    <>
      <PageHeader
        title={dateText}
        subtitle={
          lessons.length === 0 ? "Heute sind keine Nachhilfestunden geplant." : `Heute ${lessons.length === 1 ? "eine Nachhilfestunde" : `${lessons.length} Nachhilfestunden`}.`
        }
        actions={
          <Link href="/uebungen/neu" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Übung erstellen
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          {lessons.length > 0 && (
            <section>
              <SectionTitle>Heute</SectionTitle>
              <ol className="panel divide-y divide-line">
                {lessons.map((l) => {
                  const r = byId.get(l.student_id);
                  const problem = r?.a.mainProblem;
                  const done = l.status === "abgeschlossen";
                  return (
                    <li key={l.id} className="grid grid-cols-[48px_1fr] items-start gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[56px_1fr_auto]">
                      <span className="num pt-0.5 text-[15px] font-semibold">{formatTime(l.starts_at)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <Link href={`/schueler/${l.student_id}`} className="text-[16px] font-semibold hover:text-accent">
                            {l.student_name}
                          </Link>
                          <span className="text-ink-2">{l.subject}</span>
                          {r && <TrendBadge trend={r.a.overall.trend} compact />}
                        </div>
                        <p className="mt-1 text-[14px] text-ink-2">
                          {l.topic ? <>Thema: {l.topic}</> : "Thema noch offen"}
                          {problem && (
                            <>
                              {" · "}
                              <span className="text-red">Problem: {problem.skill.area === problem.skill.name ? problem.skill.name : `${problem.skill.name} (${problem.skill.area})`}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <Link href={`/schueler/${l.student_id}/stunden/${l.id}`} className={`btn btn-sm col-start-2 justify-self-start sm:col-start-3 ${done ? "btn-ghost" : "btn-secondary"}`}>
                        {done ? <ClipboardCheck size={15} aria-hidden /> : <NotebookText size={15} aria-hidden />}
                        {done ? "Dokumentiert" : "Dokumentieren"}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section>
            <SectionTitle action={<Link href="/schueler" className="link text-[13px] font-medium">Alle Schüler</Link>}>Schüler</SectionTitle>
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Fach</th>
                    <th className="px-3 py-3 font-semibold">Fortschritt</th>
                    <th className="px-3 py-3 font-semibold">Problem</th>
                    <th className="w-[180px] px-5 py-3 font-semibold">Gesamtstand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ s, a }) => (
                    <tr key={s.id} className="group">
                      <td className="px-5 py-3.5">
                        <Link href={`/schueler/${s.id}`} className="font-semibold whitespace-nowrap group-hover:text-accent">
                          {s.name}
                        </Link>
                        <div className="text-[12px] text-ink-3">{s.grade}. Schulstufe</div>
                      </td>
                      <td className="px-3 py-3.5 text-ink-2">{s.subjects.join(", ") || "–"}</td>
                      <td className="px-3 py-3.5">
                        <TrendBadge trend={a.overall.trend} delta={a.overall.delta} />
                      </td>
                      <td className="px-3 py-3.5 text-[14px]">
                        {a.mainProblem ? (
                          <Link href={`/schueler/${s.id}?tab=analyse`} className="hover:underline">
                            <span className="font-medium text-red">{a.mainProblem.skill.name}</span>
                            <span className="text-ink-3"> · {a.mainProblem.skill.area}</span>
                          </Link>
                        ) : (
                          <span className="text-ink-3">keines erkannt</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <MasteryBar value={a.overall.mastery} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionTitle>Empfohlene nächste Übungen</SectionTitle>
            <RecommendationList rows={rows} />
          </section>
        </div>

        <aside className="space-y-10">
          <section>
            <SectionTitle>Zuletzt bearbeitet</SectionTitle>
            {activity.length === 0 ? (
              <p className="text-[14px] text-ink-2">Noch keine Übungen abgeschlossen.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((x) => {
                  const ratio = x.task_count ? x.correct_count / x.task_count : 0;
                  return (
                    <li key={x.assignment_id}>
                      <Link href={`/schueler/${x.student_id}/ergebnis/${x.assignment_id}`} className="block rounded-lg py-1.5 hover:text-accent">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{x.student_name}</span>
                          <span className={`num text-[13px] font-semibold ${ratio < 0.6 ? "text-red" : ratio < 0.8 ? "text-amber" : "text-green"}`}>
                            {x.correct_count}/{x.task_count} richtig
                          </span>
                        </div>
                        <div className="truncate text-[13px] text-ink-2">{x.title}</div>
                        <div className="text-[12px] text-ink-3">{formatDate(x.completed_at, { day: "numeric", month: "short" })}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle>Hausübungen fällig</SectionTitle>
            {dueSoon.length === 0 ? (
              <p className="text-[14px] text-ink-2">In den nächsten drei Tagen ist nichts fällig.</p>
            ) : (
              <ul className="space-y-3">
                {dueSoon.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <CalendarClock size={16} className={`mt-0.5 shrink-0 ${h.due_date! < today ? "text-red" : "text-ink-3"}`} aria-hidden />
                    <div className="min-w-0 text-[14px]">
                      <Link href={`/schueler/${h.student_id}?tab=schule`} className="font-semibold hover:text-accent">
                        {h.student_name}
                      </Link>
                      <span className="text-ink-3"> · {h.due_date! < today ? "überfällig" : formatDate(h.due_date!, { weekday: "short", day: "numeric", month: "short" })}</span>
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

function RecommendationList({ rows }: { rows: { s: repo.Student; a: NonNullable<ReturnType<typeof analyzeStudent>> }[] }) {
  const recs = rows.flatMap(({ s, a }) => a.recommendations.slice(0, 2).map((r) => ({ s, r })));
  if (recs.length === 0) return <p className="text-[14px] text-ink-2">Keine offenen Empfehlungen. Sobald Schwächen erkannt werden, erscheinen sie hier.</p>;
  return (
    <ul className="panel divide-y divide-line">
      {recs.map(({ s, r }) => (
        <li key={`${s.id}-${r.key}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
          <span className="w-16 shrink-0 font-semibold">{s.name.split(" ")[0]}</span>
          <span className="min-w-0 flex-1 text-[14px]">
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
