import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, PenLine, Plus, Printer, SpellCheck } from "lucide-react";
import { LessonCard, rateTone } from "@/components/LessonCard";
import { Info } from "@/components/Info";
import { BoardThumbs } from "@/components/BoardThumbs";
import { UnitStatusPill } from "@/components/UnitControl";
import { Empty, More, Pill, Reveal, SectionTitle, formatDate } from "@/components/ui";
import { pct } from "@/lib/analysis";
import { progressOverview, readReport } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { textsForStudent, textsForUnit, wordsLabel } from "@/lib/texts";
import { correctionInfoForStudent, type TextCorrectionInfo } from "@/lib/text-correction";
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
  const results = new Map(repo.listAssignments(student.id).map((x) => [x.id, { done: x.done_count, correct: x.correct_count }]));
  const VISIBLE = 8;
  const item = (e: Entry) =>
    e.kind === "unit" ? (
      <li key={`u${e.unit.id}`} id={`einheit-${e.unit.id}`} className="scroll-mt-6">
        <UnitEntry unit={e.unit} lesson={e.lesson} />
      </li>
    ) : (
      <li key={`l${e.lesson.id}`}>
        <LessonCard lesson={e.lesson} studentId={student.id} result={e.lesson.assignment_id ? results.get(e.lesson.assignment_id) : undefined} />
      </li>
    );

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

      <StudentTexts studentId={student.id} />

      <section>
        <SectionTitle
          action={
            <Link href={`/schueler/${student.id}/stunden/neu`} className="btn btn-ghost btn-sm">
              <Plus size={14} aria-hidden /> Einheit nachtragen oder planen
            </Link>
          }
        >
          <span>
            Dokumentation
            <Info label="Info zur Dokumentation">Jede Einheit wird beim Starten automatisch protokolliert. Beim Beenden entsteht die Dokumentation aus den Übungsdaten, der Lehrer ergänzt seine Beobachtungen.</Info>
          </span>
        </SectionTitle>
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Einträge filtern">
          {FILTERS.map(([k, label]) => (
            <Link
              key={k}
              href={`/schueler/${student.id}?tab=lernverlauf${k === "alle" ? "" : `&art=${k}`}`}
              aria-current={art === k ? "true" : undefined}
              className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-[13px] font-medium ${art === k ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
            >
              {label}
              <span className="num ml-1.5 opacity-70">{count[k]}</span>
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? (
          <Empty title="Noch nichts dokumentiert">Starte im Profil eine Einheit.</Empty>
        ) : (
          <>
            <ol className="space-y-3">{shown.slice(0, VISIBLE).map(item)}</ol>
            {shown.length > VISIBLE && (
              <Reveal label={`Ältere Einträge (${shown.length - VISIBLE})`} className="mt-3">
                <ol className="space-y-3">{shown.slice(VISIBLE).map(item)}</ol>
              </Reveal>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function UnitEntry({ unit, lesson }: { unit: UnitView; lesson: repo.Lesson | null }) {
  const r = lesson ? readReport(lesson) : null;
  const minutes = Math.round(unitDurationMs(unit) / 60_000);
  const topic = lesson ? [lesson.subject, lesson.topic].filter(Boolean).join(" · ") : unit.subject;
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[14px]">
        <span className="font-semibold">{formatDate(unit.started_at, { weekday: "short", day: "numeric", month: "numeric" })}</span>
        <span className="num text-ink-2" title={unit.end_estimated ? "Ende geschätzt" : undefined}>
          {clock(unit.started_at)}–{unit.ended_at ? `${unit.end_estimated ? "ca. " : ""}${clock(unit.ended_at)}` : "…"} · {minutes} min
        </span>
        <span className="text-ink-2">{unit.teacher_name}</span>
        {topic && <span className="text-ink-2">{topic}</span>}
      </div>
      <div className="flex items-center gap-2">
        {unit.status !== "beendet" ? (
          <UnitStatusPill status={unit.status} />
        ) : lesson && !lesson.reviewed_at ? (
          <Pill tone="amber">noch ergänzen</Pill>
        ) : lesson ? (
          <Pill tone="green" title="Dokumentation abgeschlossen">
            <CheckCircle2 size={12} aria-hidden /> dokumentiert
          </Pill>
        ) : null}
        {unit.status !== "abgebrochen" && (
          <Link href={`/einheiten/${unit.id}`} className="btn btn-ghost btn-sm">
            {unit.status === "gestartet" ? "Öffnen" : lesson?.reviewed_at ? "Öffnen" : "Abschließen"}
          </Link>
        )}
      </div>
    </div>
  );
  if (unit.status === "abgebrochen") {
    return (
      <article className="panel border-dashed px-5 py-3">
        {head}
        {unit.end_reason && <p className="mt-1 truncate text-[14px] text-ink-2" title={unit.end_reason}>{unit.end_reason}</p>}
      </article>
    );
  }
  if (!lesson) {
    return (
      <article className="panel px-5 py-3.5">
        {head}
        <UnitTextLinks unitId={unit.id} />
        <BoardThumbs unitId={unit.id} size="sm" />
      </article>
    );
  }
  const problems = r?.skills.filter((s) => s.state === "problem").map((s) => s.name) ?? [];
  const errs = r?.errors.map((e) => (e.count > 1 ? `${e.label} ${e.count}×` : e.label)) ?? [];
  const keyDifficulties = [...problems, ...errs];
  const moved = r?.skills.filter((s) => s.before !== null && s.after !== null) ?? [];
  const gain = moved.length ? Math.round((moved.reduce((sum, s) => sum + (s.after! - s.before!), 0) / moved.length) * 100) : null;
  const ratings = [
    lesson.concentration && `Konz. ${lesson.concentration}/5`,
    lesson.motivation && `Motiv. ${lesson.motivation}/5`,
    lesson.participation && `Mitarbeit ${lesson.participation}/5`,
  ].filter(Boolean) as string[];
  const progress = moved.map((s) => `${s.name} ${pct(s.before)} → ${pct(s.after)}`).join(", ");
  const rows: [string, string][] = [
    ["Zusammenfassung", lesson.summary],
    ["Schwierigkeiten", [problems.length ? `Schwierig: ${problems.join(", ")}` : "", r?.errors.length ? `Fehler: ${r.errors.map((e) => (e.count > 1 ? `${e.label} (${e.count}×)` : e.label)).join(", ")}` : "", lesson.difficulties].filter(Boolean).join("\n")],
    ["Fortschritt", progress],
    ["Beobachtungen", [lesson.tutor_notes, ratings.join(" · "), lesson.positives && `Positiv: ${lesson.positives}`].filter(Boolean).join("\n")],
    ["Nächste Lernziele", [lesson.next_steps, lesson.review_topics && `Wiederholen: ${lesson.review_topics}`, lesson.homework_note && `Hausübung: ${lesson.homework_note}`].filter(Boolean).join("\n")],
  ];
  const fehler = r ? r.tasksDone - r.correct : 0;
  return (
    <article className="panel px-5 py-3.5">
      {head}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r && r.tasksDone > 0 && (
          <Pill tone={rateTone(r.correct, r.tasksDone)} title={`Erfolgsquote ${pct(r.successRate)}`}>
            <span className="num">
              {r.correct}/{r.tasksDone}
            </span>{" "}
            richtig
          </Pill>
        )}
        {r && r.tasksDone > 0 && (
          <Pill title="Aufgaben, bei denen eine Hilfe genutzt wurde">
            Hilfe <span className="num">{r.help.tasks}</span>
          </Pill>
        )}
        {r && r.tasksDone > 0 && (
          <Pill title="Nicht richtig gelöste Aufgaben">
            Fehler <span className="num">{fehler}</span>
          </Pill>
        )}
        {gain !== null && (
          <Pill tone={gain >= 3 ? "green" : gain <= -3 ? "red" : "neutral"} title={progress}>
            Fortschritt{" "}
            <span className="num">
              {gain > 0 ? "+" : ""}
              {gain} %
            </span>
          </Pill>
        )}
        {ratings.slice(0, 2).map((x) => (
          <Pill key={x}>{x}</Pill>
        ))}
      </div>
      {keyDifficulties.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {keyDifficulties.slice(0, 3).map((d) => (
            <Pill key={d} tone="red">
              {d}
            </Pill>
          ))}
          {keyDifficulties.length > 3 && <span className="text-[12px] text-ink-3">+{keyDifficulties.length - 3}</span>}
        </div>
      )}
      <UnitTextLinks unitId={unit.id} />
      {lesson.next_steps && (
        <p className="mt-1.5 truncate text-[14px]" title={lesson.next_steps}>
          <span className="text-ink-3">Nächstes:</span> {lesson.next_steps}
        </p>
      )}
      <BoardThumbs unitId={unit.id} size="sm" />
      <Reveal label="Details anzeigen" className="mt-1">
        <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[150px_1fr]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className={`max-w-[80ch] whitespace-pre-line ${k === "Schwierigkeiten" ? "text-red" : ""}`}>{v}</dd>
              </div>
            ))}
        </dl>
      </Reveal>
    </article>
  );
}

function Overview({ student }: { student: repo.Student }) {
  const a = analyzeStudent(student.id)!;
  const p = progressOverview(student.id);
  const named = (name: string, value: React.ReactNode, cls = "") => (
    <span className="flex items-baseline justify-between gap-3 text-[14px]">
      <span className="min-w-0 truncate">{name}</span>
      <span className={`num shrink-0 font-semibold ${cls}`}>{value}</span>
    </span>
  );
  const blocks: [string, React.ReactNode[]][] = [
    ["Stärken", a.strengths.map((s) => named(s.skill.name, pct(s.mastery), "text-green"))],
    ["Schwächen", a.weaknesses.map((s) => named(s.skill.name, pct(s.mastery), "text-red"))],
    ["Häufigste Fehler", a.errors.map((e) => named(e.label, `${e.count}×`))],
    ["Größte Verbesserung", p.improved.map((x) => named(x.name, `${pct(x.from)} → ${pct(x.to)}`, "text-green"))],
    ["Ohne Fortschritt", p.stalled.map((x) => named(x.name, `${pct(x.to)} · ${x.units} Einh.`))],
    ["Wiederholen", a.review.map((s) => named(s.skill.name, s.trend === "down" ? "sinkt" : "lange her", "text-amber"))],
  ];
  // most relevant first: practised in the latest unit, then the biggest change
  const last = p.units.length - 1;
  const ranked = [...p.rows].sort((x, y) => Number(y.practiced[last] ?? false) - Number(x.practiced[last] ?? false) || Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0));
  const cols = p.units.map((_, i) => i).slice(-4);
  const table = (rows: typeof p.rows, idx: number[]) => (
    <div className="panel overflow-x-auto">
      <table className="num w-full text-left text-[14px]" style={{ minWidth: 260 + idx.length * 56 }}>
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-3">
            <th className="px-4 py-2.5 font-sans font-semibold">Fähigkeit</th>
            {idx.map((i) => (
              <th key={p.units[i].unitId} className="px-2 py-2.5 text-right font-semibold">
                <Link href={`/einheiten/${p.units[i].unitId}`} className="hover:text-accent" title={`Einheit ${i + 1}`}>
                  {formatDate(p.units[i].at, { day: "numeric", month: "numeric" })}
                </Link>
              </th>
            ))}
            <th className="px-4 py-2.5 text-right font-sans font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.skillId}>
              <td className="px-4 py-2 font-sans" title={r.area}>
                {r.name}
              </td>
              {idx.map((i) => (
                <td key={i} className={`px-2 py-2 text-right ${r.practiced[i] ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {r.values[i] === null ? "–" : Math.round(r.values[i]! * 100)}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-sans">
                <Direction delta={r.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <section className="space-y-10">
      <div>
        <SectionTitle>Gesamtauswertung</SectionTitle>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map(([title, items]) => (
            <div key={title}>
              <h3 className="mb-1 text-[13px] font-semibold text-ink-3">{title}</h3>
              <More items={items} />
            </div>
          ))}
        </div>
      </div>
      {p.rows.length > 0 && p.units.length > 0 && (
        <div>
          <SectionTitle>
            <span>
              Langfristige Entwicklung
              <Info label="Info zur Entwicklung">Beherrschung jeder Fähigkeit in Prozent nach den letzten Einheiten. Fett: in dieser Einheit geübt.</Info>
            </span>
          </SectionTitle>
          {table(ranked.slice(0, 5), cols)}
          {(p.rows.length > 5 || p.units.length > cols.length) && (
            <Reveal label={`Alle ${p.rows.length} Fähigkeiten und ${p.units.length} Einheiten`} className="mt-2">
              {table(p.rows, p.units.map((_, i) => i))}
            </Reveal>
          )}
        </div>
      )}
    </section>
  );
}

function Direction({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-ink-3">–</span>;
  const d = Math.round(delta * 100);
  const [Icon, cls, word] = d >= 3 ? [ArrowUpRight, "text-green", "verbessert"] : d <= -3 ? [ArrowDownRight, "text-red", "verschlechtert"] : [ArrowRight, "text-ink-2", "gleich"];
  return (
    <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold ${cls}`} title={`${word} (${d > 0 ? "+" : ""}${d})`}>
      <Icon size={15} aria-hidden />
      <span className="num">{d > 0 ? `+${d}` : d === 0 ? "±0" : d}</span>
      <span className="sr-only">{word}</span>
    </span>
  );
}

/** Texts written or continued in a unit, as links. */
function UnitTextLinks({ unitId }: { unitId: number }) {
  const texts = textsForUnit(unitId);
  if (!texts.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {texts.map((t) => (
        <Link key={t.id} href={`/texte/${t.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-accent-wash px-3.5 text-[13px] font-semibold text-accent hover:underline">
          <PenLine size={13} aria-hidden /> {t.title} · <span className="num">{wordsLabel(t.words_after)}</span>
        </Link>
      ))}
    </div>
  );
}

/** The newest correction of a text in one link: confirmed errors, suggestions still open. */
function CorrectionLink({ textId, info }: { textId: number; info: TextCorrectionInfo }) {
  const parts = [info.fehler ? `${info.fehler} ${"Fehler"}` : "", info.stil ? `${info.stil} ${info.stil === 1 ? "Vorschlag" : "Vorschläge"}` : "", info.open ? `${info.open} offen` : ""].filter(Boolean);
  return (
    <Link href={`/texte/${textId}/korrektur?k=${info.correctionId}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-panel px-3.5 text-[13px] font-semibold text-ink-2 hover:text-ink" title="Korrektur öffnen">
      <SpellCheck size={14} aria-hidden /> Korrektur{parts.length ? `: ${parts.join(", ")}` : ""}
    </Link>
  );
}

/** All Textarbeiten of the student: unfinished first, then the newest. */
function StudentTexts({ studentId }: { studentId: number }) {
  const texts = textsForStudent(studentId).sort((a, b) => (a.status === b.status ? 0 : a.status === "offen" ? -1 : 1));
  if (!texts.length) return null;
  const corrections = correctionInfoForStudent(studentId);
  const VISIBLE = 5;
  const row = (t: (typeof texts)[number]) => (
    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <PenLine size={18} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t.title}</span>
        <span className="num block text-[14px] text-ink-2">
          {[t.subject, t.topic, wordsLabel(t.words), `zuletzt ${formatDate(t.updated_at, { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {t.status === "fertig" ? <Pill tone="green">fertig</Pill> : <Pill tone="amber">in Arbeit</Pill>}
      {corrections.has(t.id) && <CorrectionLink textId={t.id} info={corrections.get(t.id)!} />}
      <Link href={`/texte/${t.id}`} className="btn btn-secondary btn-sm">
        Öffnen
      </Link>
      <Link href={`/arbeitsblatt/text/${t.id}`} target="_blank" className="btn btn-ghost btn-sm" aria-label={`${t.title}: PDF / Drucken`}>
        <Printer size={14} aria-hidden /> PDF
      </Link>
    </li>
  );
  return (
    <section>
      <SectionTitle>
        <span>
          Texte
          <Info label="Info zu Texten">Textarbeiten aus den Einheiten. Unfertige Texte stehen oben und können in der nächsten Einheit am Tablet weitergeschrieben werden.</Info>
        </span>
      </SectionTitle>
      <ul className="panel divide-y divide-line">{texts.slice(0, VISIBLE).map(row)}</ul>
      {texts.length > VISIBLE && (
        <Reveal label={`Weitere Texte (${texts.length - VISIBLE})`} className="mt-3">
          <ul className="panel divide-y divide-line">{texts.slice(VISIBLE).map(row)}</ul>
        </Reveal>
      )}
    </section>
  );
}
