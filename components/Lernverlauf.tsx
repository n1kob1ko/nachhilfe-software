import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { LessonCard } from "@/components/LessonCard";
import { BoardThumbs } from "@/components/BoardThumbs";
import { UnitStatusPill } from "@/components/UnitControl";
import { Empty, Pill, SectionTitle, formatDate } from "@/components/ui";
import { pct } from "@/lib/analysis";
import { progressOverview, readReport } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { listUnits, unitDurationMs, type UnitView } from "@/lib/units";

const FILTERS = [
  ["alle", "Alle"],
  ["einheiten", "Einheiten"],
  ["selbststaendig", "Selbstständig geübt"],
] as const;

const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

type Entry = { at: number; kind: "unit"; unit: UnitView; lesson: repo.Lesson | null } | { at: number; kind: "lesson"; lesson: repo.Lesson };

/** Lernverlauf: overall evaluation, long-term development per skill and all units, newest first. */
export function Lernverlauf({ student, filter }: { student: repo.Student; filter?: string }) {
  const art = FILTERS.find(([k]) => k === filter)?.[0] ?? "alle";
  const lessons = repo.listLessons(student.id);
  const units = listUnits({ studentId: student.id });
  const planned = lessons.filter((l) => l.status === "geplant" && l.kind === "stunde").reverse();
  const entries: Entry[] = [
    ...units.map((u) => ({ at: Date.parse(u.started_at), kind: "unit" as const, unit: u, lesson: repo.getLessonForUnit(u.id) })),
    ...lessons.filter((l) => l.status !== "geplant" && !l.unit_id).map((l) => ({ at: Date.parse(l.starts_at), kind: "lesson" as const, lesson: l })),
  ].sort((a, b) => b.at - a.at);
  const isPractice = (e: Entry) => e.kind === "lesson" && e.lesson.kind === "selbststaendig";
  const count = { alle: entries.length, einheiten: entries.filter((e) => !isPractice(e)).length, selbststaendig: entries.filter(isPractice).length };
  const shown = entries.filter((e) => art === "alle" || (art === "selbststaendig" ? isPractice(e) : !isPractice(e)));

  return (
    <div className="space-y-12">
      <Overview student={student} />

      {planned.length > 0 && (
        <section>
          <SectionTitle>Geplant</SectionTitle>
          <div className="space-y-3">
            {planned.map((l) => (
              <LessonCard key={l.id} lesson={l} studentId={student.id} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          action={
            <Link href={`/schueler/${student.id}/stunden/neu`} className="btn btn-ghost btn-sm">
              <Plus size={14} aria-hidden /> Einheit nachtragen oder planen
            </Link>
          }
        >
          Dokumentation
        </SectionTitle>
        <p className="-mt-1 mb-4 max-w-[72ch] text-[14px] text-ink-2">
          Jede Einheit wird beim Starten automatisch protokolliert. Beim Beenden entsteht die Dokumentation aus den Übungsdaten, der Lehrer ergänzt seine Beobachtungen.
        </p>
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Einträge filtern">
          {FILTERS.map(([k, label]) => (
            <Link
              key={k}
              href={`/schueler/${student.id}?tab=lernverlauf${k === "alle" ? "" : `&art=${k}`}`}
              aria-current={art === k ? "true" : undefined}
              className={`rounded-md px-2.5 py-1 text-[13px] font-medium ${art === k ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
            >
              {label}
              <span className="num ml-1.5 opacity-70">{count[k]}</span>
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? (
          <Empty title="Noch nichts dokumentiert">Starte im Profil eine Einheit. Alles Weitere wird mitgeschrieben.</Empty>
        ) : (
          <ol className="space-y-3">
            {shown.map((e) =>
              e.kind === "unit" ? (
                <li key={`u${e.unit.id}`} id={`einheit-${e.unit.id}`} className="scroll-mt-6">
                  <UnitEntry unit={e.unit} lesson={e.lesson} />
                </li>
              ) : (
                <li key={`l${e.lesson.id}`}>
                  <LessonCard lesson={e.lesson} studentId={student.id} />
                </li>
              ),
            )}
          </ol>
        )}
      </section>
    </div>
  );
}

function UnitEntry({ unit, lesson }: { unit: UnitView; lesson: repo.Lesson | null }) {
  const r = lesson ? readReport(lesson) : null;
  const minutes = Math.round(unitDurationMs(unit) / 60_000);
  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{formatDate(unit.started_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        <span className="num text-ink-2">
          {clock(unit.started_at)}–{unit.ended_at ? `${unit.end_estimated ? "ca. " : ""}${clock(unit.ended_at)}` : "…"} · {unit.end_estimated ? "ca. " : ""}
          {minutes} min
        </span>
        <span className="text-ink-2">{unit.teacher_name}</span>
        {unit.status !== "beendet" && <UnitStatusPill status={unit.status} />}
      </div>
      <div className="flex items-center gap-3">
        {r && r.tasksDone > 0 && (
          <span className="num text-[14px] font-semibold">
            {r.correct}/{r.tasksDone} richtig <span className="text-ink-3">· {pct(r.successRate)}</span>
          </span>
        )}
        {lesson && !lesson.reviewed_at && <Pill tone="amber">noch nicht ergänzt</Pill>}
        {unit.status !== "abgebrochen" && (
          <Link href={`/einheiten/${unit.id}`} className="btn btn-ghost btn-sm">
            {unit.status === "gestartet" ? "Öffnen" : lesson?.reviewed_at ? "Details" : "Abschließen"}
          </Link>
        )}
      </div>
    </div>
  );
  if (unit.status === "abgebrochen") {
    return (
      <article className="panel border-dashed px-5 py-3">
        {head}
        {unit.end_reason && <p className="mt-1 text-[14px] text-ink-2">{unit.end_reason}</p>}
      </article>
    );
  }
  if (!lesson) {
    return (
      <article className="panel px-5 py-4">
        {head}
        <BoardThumbs unitId={unit.id} />
      </article>
    );
  }
  const problems = r?.skills.filter((s) => s.state === "problem").map((s) => s.name) ?? [];
  const errs = r?.errors.slice(0, 3).map((e) => (e.count > 1 ? `${e.label} (${e.count}×)` : e.label)) ?? [];
  const difficulties = [problems.length ? `Schwierig: ${problems.join(", ")}` : "", errs.length ? `Fehler: ${errs.join(", ")}` : "", lesson.difficulties].filter(Boolean).join("\n");
  const progress = r?.skills
    .filter((s) => s.before !== null && s.after !== null)
    .map((s) => `${s.name} ${pct(s.before)} → ${pct(s.after)}`)
    .join(", ");
  const ratings = [
    lesson.concentration && `Konzentration ${lesson.concentration}/5`,
    lesson.motivation && `Motivation ${lesson.motivation}/5`,
    lesson.participation && `Mitarbeit ${lesson.participation}/5`,
  ].filter(Boolean);
  const rows: [string, string][] = [
    ["Fach / Thema", [lesson.subject, lesson.topic].filter(Boolean).join(" · ")],
    ["Zusammenfassung", lesson.summary],
    ["Schwierigkeiten", difficulties],
    ["Fortschritt", progress ?? ""],
    ["Beobachtungen", [lesson.tutor_notes, ratings.join(" · "), lesson.positives && `Positiv: ${lesson.positives}`].filter(Boolean).join("\n")],
    ["Nächste Lernziele", [lesson.next_steps, lesson.review_topics && `Wiederholen: ${lesson.review_topics}`, lesson.homework_note && `Hausübung: ${lesson.homework_note}`].filter(Boolean).join("\n")],
  ];
  return (
    <article className="panel px-5 py-4">
      {head}
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[150px_1fr]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className={`max-w-[80ch] whitespace-pre-line ${k === "Schwierigkeiten" ? "text-red" : ""}`}>{v}</dd>
            </div>
          ))}
      </dl>
      <BoardThumbs unitId={unit.id} />
    </article>
  );
}

function Overview({ student }: { student: repo.Student }) {
  const a = analyzeStudent(student.id)!;
  const p = progressOverview(student.id);
  const List = ({ items, empty, tone }: { items: React.ReactNode[]; empty: string; tone?: string }) =>
    items.length ? (
      <ul className={`space-y-1 text-[14px] ${tone ?? ""}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    ) : (
      <p className="text-[14px] text-ink-3">{empty}</p>
    );
  const blocks: [string, React.ReactNode][] = [
    ["Aktuelle Stärken", <List key="s" items={a.strengths.slice(0, 4).map((s) => `${s.skill.name} (${pct(s.mastery)})`)} empty="Noch keine gesicherten Stärken." />],
    ["Aktuelle Schwächen", <List key="w" items={a.weaknesses.slice(0, 4).map((s) => `${s.skill.name} (${pct(s.mastery)})`)} empty="Keine Schwäche erkannt." />],
    ["Größte Verbesserung", <List key="i" items={p.improved.map((x) => `${x.name}: ${pct(x.from)} → ${pct(x.to)}`)} empty="Noch zu wenige Einheiten." />],
    ["Ohne Fortschritt", <List key="n" items={p.stalled.map((x) => `${x.name}: ${pct(x.from)} → ${pct(x.to)} in ${x.units} Einheiten`)} empty="Keine Fähigkeit stagniert." />],
    ["Häufigste Fehler", <List key="e" items={a.errors.slice(0, 4).map((e) => `${e.label} (${e.count}×)`)} empty="Keine Fehlerhäufung." />],
    ["Wiederholen", <List key="r" items={a.review.slice(0, 4).map((s) => `${s.skill.name}${s.trend === "down" ? " (sinkt)" : " (lange nicht geübt)"}`)} empty="Nichts Dringendes." />],
  ];
  return (
    <section className="space-y-8">
      <div>
        <SectionTitle>Gesamtauswertung</SectionTitle>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map(([title, body]) => (
            <div key={title}>
              <h3 className="mb-1.5 text-[13px] font-semibold text-ink-2">{title}</h3>
              {body}
            </div>
          ))}
        </div>
      </div>
      {p.rows.length > 0 && p.units.length > 0 && (
        <div>
          <SectionTitle>Langfristige Entwicklung</SectionTitle>
          <p className="-mt-1 mb-3 text-[13px] text-ink-2">Stand jeder Fähigkeit nach den letzten Einheiten. Fett: in dieser Einheit geübt.</p>
          <div className="panel overflow-x-auto">
            <table className="num w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-4 py-2.5 font-sans font-semibold">Fähigkeit</th>
                  {p.units.map((u, i) => (
                    <th key={u.unitId} className="px-2 py-2.5 text-right font-semibold">
                      <Link href={`/einheiten/${u.unitId}`} className="hover:text-accent" title={`Einheit ${i + 1}`}>
                        {formatDate(u.at, { day: "numeric", month: "numeric" })}
                      </Link>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-sans font-semibold">Entwicklung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.rows.map((r) => (
                  <tr key={r.skillId}>
                    <td className="px-4 py-2 font-sans">
                      {r.name} <span className="text-ink-3">· {r.area}</span>
                    </td>
                    {r.values.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-right ${r.practiced[i] ? "font-semibold text-ink" : "text-ink-3"}`}>
                        {v === null ? "–" : Math.round(v * 100)}
                      </td>
                    ))}
                    <td className="px-4 py-2 font-sans">
                      <Direction delta={r.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Direction({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-ink-3">–</span>;
  const d = Math.round(delta * 100);
  if (d >= 3)
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
        <ArrowUpRight size={15} aria-hidden /> verbessert (+{d})
      </span>
    );
  if (d <= -3)
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-red">
        <ArrowDownRight size={15} aria-hidden /> verschlechtert ({d})
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2">
      <ArrowRight size={15} aria-hidden /> gleich
    </span>
  );
}
