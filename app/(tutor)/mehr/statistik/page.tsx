import Link from "next/link";
import { Info } from "@/components/Info";
import { PageHeader, Pill, Reveal, SectionTitle, formatDuration } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { levelName } from "@/lib/curriculum";
import { masteryStatus } from "@/lib/mastery";
import { DIAGNOSIS_FILTERS, EXPECTED_SUCCESS, SKILL_MIN, statistics, TASK_MIN, UNUSUAL_DEVIATION, type DiagnosisFilter, type SkillRef, type TaskRow, type TopicRow } from "@/lib/statistik";

export const metadata = { title: "Statistik" };

type Params = { fach?: string; tage?: string; diagnose?: string };
const BASE = "/mehr/statistik";
const DAYS: [string, string][] = [["30", "30 Tage"], ["90", "90 Tage"], ["365", "365 Tage"], ["", "alles"]];
const DIAGNOSIS_LABEL: Record<DiagnosisFilter, string> = { mit: "mit", ohne: "ohne", nur: "nur" };
const TOP = 5;
const MAX_ROWS = 50;

const one = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const href = (p: Params) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `${BASE}?${q}` : BASE;
};
const pct = (x: number) => `${Math.round(x * 100)}\u00a0%`;
const dec = (x: number) => x.toLocaleString("de-AT", { maximumFractionDigits: 1 });
const skillLabel = (s: SkillRef) => (s.parent ? `${s.parent} › ${s.name}` : s.name);

/**
 * Mehr › Statistik: sums over all students to improve the tutoring and the tasks. Only counts and
 * rates, never names or a comparison of students (lib/statistik.ts).
 */
export default async function StatisticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const fach = one(sp.fach);
  const tage = DAYS.some(([k]) => k && k === one(sp.tage)) ? one(sp.tage) : undefined;
  const diagnosis: DiagnosisFilter = (DIAGNOSIS_FILTERS as readonly string[]).includes(one(sp.diagnose) ?? "") ? (sp.diagnose as DiagnosisFilter) : "mit";
  const s = statistics({ subject: fach, days: tage ? Number(tage) : null, diagnosis });
  const current: Params = { fach, tage, diagnose: diagnosis === "mit" ? undefined : diagnosis };
  const subjects = fach && !s.subjects.includes(fach) ? [...s.subjects, fach] : s.subjects;
  const expected = ([1, 2, 3, 4, 5] as const).map((l) => `${levelName(l)} ${pct(EXPECTED_SUCCESS[l])}`).join(", ");
  const maxArea = Math.max(1, ...s.tests.areas.map((t) => t.tests));
  const maxTopic = Math.max(1, ...s.tests.topics.map((t) => t.tests));
  const enough = s.tasks.filter((t) => t.answers >= TASK_MIN);
  const few = s.tasks.filter((t) => t.answers < TASK_MIN);

  return (
    <>
      <PageHeader
        title="Statistik"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Nur Summen über alle Schüler, keine Namen. Hilft, Aufgaben und Nachhilfe zu verbessern."
        subtitle={
          <span className="num text-[14px]">
            {s.totals.answers} {s.totals.answers === 1 ? "Aufgabe" : "Aufgaben"} bearbeitet · {s.totals.students} Schüler · {s.tests.total} {s.tests.total === 1 ? "Prüfung" : "Prüfungen"}
          </span>
        }
      />

      <div className="-mt-2 mb-10 grid gap-2">
        <Chips
          label="Fach"
          items={[["", "Alle"], ...subjects.map((x): [string, string] => [x, x])].map(([k, l]) => ({ key: k, label: l, href: href({ ...current, fach: k || undefined }), active: (fach ?? "") === k }))}
        />
        <Chips label="Zeitraum" items={DAYS.map(([k, l]) => ({ key: k, label: l, href: href({ ...current, tage: k || undefined }), active: (tage ?? "") === k }))} />
        <Chips
          label="Diagnose"
          items={DIAGNOSIS_FILTERS.map((k) => ({ key: k, label: DIAGNOSIS_LABEL[k], href: href({ ...current, diagnose: k === "mit" ? undefined : k }), active: diagnosis === k }))}
        />
      </div>

      <div className="grid max-w-[920px] gap-10">
        <section aria-label="Schwierige Fähigkeiten">
          <Title info={`Ab ${SKILL_MIN} bearbeiteten Aufgaben, schwerste zuerst. Erfolg: am Ende richtig, ohne Lösung anzusehen. 1. Versuch: sofort richtig, ohne Hilfe. Zeit: Median pro Aufgabe.`}>Schwierige Fähigkeiten</Title>
          <TopList
            empty={`Noch keine Fähigkeit mit ${SKILL_MIN} bearbeiteten Aufgaben.`}
            rows={s.skills.rows.map((r) => (
              <StatRow key={r.skill.id} title={<SkillLink skill={r.skill} />} value={pct(r.successRate)} ratio={r.successRate}>
                <span>{r.skill.area}</span>
                <span className="num">n = {r.answers}</span>
                <span className="num">{r.students} Schüler</span>
                <span className="num">1. Versuch {pct(r.firstTryRate)}</span>
                <span className="num">{dec(r.hintsPerTask)} Hilfen</span>
                {r.medianTimeSec !== null && <span className="num">Zeit {formatDuration(r.medianTimeSec)}</span>}
              </StatRow>
            ))}
          />
        </section>

        <section aria-label="Häufige Fehlerarten">
          <Title info="Falsche Versuche je Fehlerart. Bestätigt: vom Lehrer gesetzt oder bestätigt, der Rest sind Vorschläge der App.">Häufige Fehlerarten</Title>
          <TopList
            empty={s.errorTypes.wrong ? "Noch keine Fehlerart erfasst." : "Keine falschen Versuche."}
            rows={s.errorTypes.rows.map((r) => (
              <StatRow key={r.type} title={<span className="font-medium">{r.label}</span>} value={`${r.count}\u00a0×`} ratio={r.count / Math.max(1, s.errorTypes.wrong)}>
                <span className="num">{pct(r.count / Math.max(1, s.errorTypes.wrong))} der Fehler</span>
                <span className="num">{r.confirmed} bestätigt</span>
                {r.skills.length > 0 && <span>meist bei {r.skills.map((x) => `${skillLabel(x.skill)} (${x.count})`).join(", ")}</span>}
              </StatRow>
            ))}
          />
          {s.errorTypes.wrong > 0 && (
            <p className="num mt-2 text-[13px] text-ink-3">
              Ohne Fehlerart: {s.errorTypes.withoutType} von {s.errorTypes.wrong} falschen Versuchen
            </p>
          )}
        </section>

        <section aria-label="Lernstand pro Fähigkeit">
          <Title info="Durchschnitt über die Schüler, die zu dieser Fähigkeit schon Daten haben (n). Lernstand von heute: nur der Fach-Filter gilt hier.">Lernstand pro Fähigkeit</Title>
          <TopList
            empty="Noch kein Lernstand vorhanden."
            rows={s.mastery.map((r) => (
              <StatRow key={r.skill.id} title={<SkillLink skill={r.skill} />} value={pct(r.mean)} ratio={r.mean}>
                <span>{r.skill.area}</span>
                <span className="num">n = {r.students}</span>
                <span>{masteryStatus(r.mean)}</span>
              </StatRow>
            ))}
          />
        </section>

        <section aria-label="Aufgaben">
          <Title
            info={`Gleiche Aufgaben aus mehreren Übungen zählen zusammen. Auffällig ab ${TASK_MIN} Antworten, wenn der Erfolg um mindestens ${Math.round(UNUSUAL_DEVIATION * 100)} Prozentpunkte vom erwarteten abweicht (Strich im Balken). Erwartet: ${expected}.`}
          >
            Aufgaben
          </Title>
          <TopList empty={few.length ? `Noch keine Aufgabe mit ${TASK_MIN} Antworten.` : "Noch keine bearbeiteten Aufgaben."} rows={enough.map((t) => <TaskLine key={t.taskId} t={t} />)} />
          {few.length > 0 && (
            <Reveal label={`Weniger als ${TASK_MIN} Antworten (${few.length})`} className="mt-2">
              <CappedList rows={few.map((t) => <TaskLine key={t.taskId} t={t} />)} />
            </Reveal>
          )}
        </section>

        <section aria-label="Themen in Tests und Schularbeiten">
          <Title info="Stoff der eingetragenen Schularbeiten und Tests, abgesagte nicht. Themen kommen über die verknüpften Fähigkeiten, Stichwörter so wie eingetippt.">Themen in Tests und Schularbeiten</Title>
          {s.tests.total === 0 ? (
            <p className="text-[14px] text-ink-3">Keine Prüfungen eingetragen.</p>
          ) : (
            <>
              <p className="num mb-3 text-[13px] text-ink-2">
                {s.tests.total} {s.tests.total === 1 ? "Prüfung" : "Prüfungen"}: {s.tests.byKind.map((k) => `${k.kind} ${k.tests}`).join(" · ")}
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold text-ink-2">Themen</h3>
                  <TopList empty="Keine Fähigkeiten verknüpft." rows={s.tests.areas.map((t) => <TopicLine key={`${t.subject}|${t.label}`} t={t} max={maxArea} showSubject={!fach} />)} />
                </div>
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold text-ink-2">Stichwörter</h3>
                  <TopList empty="Kein Stoff eingetragen." rows={s.tests.topics.map((t) => <TopicLine key={`${t.subject}|${t.label}`} t={t} max={maxTopic} showSubject={!fach} />)} />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Chips({ label, items }: { label: string; items: { key: string; label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-[76px] shrink-0 text-[13px] font-semibold text-ink-3">{label}</span>
      {items.map((i) => (
        <Link
          key={i.key || "alle"}
          href={i.href}
          aria-current={i.active ? "true" : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium ${i.active ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

function Title({ children, info }: { children: string; info: string }) {
  return (
    <SectionTitle>
      <span>
        {children}
        <Info label={`Info zu ${children}`}>{info}</Info>
      </span>
    </SectionTitle>
  );
}

function SkillLink({ skill }: { skill: SkillRef }) {
  return (
    <Link href={`/faehigkeiten/${encodeURIComponent(skill.id)}`} className="-my-2.5 inline-block py-2.5 font-medium hover:text-accent">
      {skillLabel(skill)}
    </Link>
  );
}

/** The first rows, the rest behind "Alle anzeigen". */
function TopList({ rows, empty }: { rows: React.ReactNode[]; empty: string }) {
  if (!rows.length) return <p className="text-[14px] text-ink-3">{empty}</p>;
  return (
    <div className="grid gap-2">
      <ul className="panel divide-y divide-line">
        {rows.slice(0, TOP).map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      {rows.length > TOP && (
        <Reveal label={`Alle anzeigen (${rows.length})`}>
          <CappedList rows={rows.slice(TOP)} />
        </Reveal>
      )}
    </div>
  );
}

/** At most MAX_ROWS rows, so a long list does not make the page heavy. */
function CappedList({ rows }: { rows: React.ReactNode[] }) {
  return (
    <>
      <ul className="panel divide-y divide-line">
        {rows.slice(0, MAX_ROWS).map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      {rows.length > MAX_ROWS && <p className="num mt-2 text-[13px] text-ink-3">Gezeigt: {MAX_ROWS} von {rows.length}</p>}
    </>
  );
}

function TaskLine({ t }: { t: TaskRow }) {
  return (
    <StatRow
      title={
        <Link href={`/uebungen/${t.worksheetId}`} className="-my-2.5 block py-2.5 font-medium hover:text-accent">
          <span className="line-clamp-2">{t.prompt}</span>
        </Link>
      }
      value={pct(t.successRate)}
      ratio={t.successRate}
      mark={t.expected}
    >
      {t.unusual && <Pill tone={t.unusual === "schwer" ? "red" : "amber"}>ungewöhnlich {t.unusual}</Pill>}
      <Pill>{levelName(t.level)}</Pill>
      <span className="num">erwartet {pct(t.expected)}</span>
      <span className="num">n = {t.answers}</span>
      <span className="num">{dec(t.hintsPerTask)} Hilfen</span>
      {t.medianTimeSec !== null && <span className="num">Zeit {formatDuration(t.medianTimeSec)}</span>}
      {t.skill && <span>{skillLabel(t.skill)}</span>}
      {t.copies > 1 && <span className="num">in {t.copies} Übungen</span>}
      {t.suggestedLevel !== null && t.suggestedLevel !== t.level && <span>gemessen: {levelName(t.suggestedLevel)}</span>}
      {t.libraryId !== null && (
        <Link href={`/uebungen/bibliothek/${t.libraryId}`} className="link -my-3.5 inline-flex items-center py-3.5">
          In der Bibliothek
        </Link>
      )}
    </StatRow>
  );
}

/** One line: name and value as text, a bar for the size, details below. `mark` draws a tick (expected value). */
function StatRow({ title, value, ratio, mark, children }: { title: React.ReactNode; value: string; ratio: number; mark?: number; children?: React.ReactNode }) {
  const width = ratio > 0 ? Math.max(2, Math.min(100, Math.round(ratio * 100))) : 0;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 break-words">{title}</div>
        <span className="num shrink-0 text-[14px] font-semibold text-ink">{value}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bar-track)]" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]" style={{ width: `${width}%` }} />
        {mark !== undefined && <div className="absolute inset-y-0 w-0.5 bg-ink-3" style={{ left: `${Math.min(99, Math.round(mark * 100))}%` }} />}
      </div>
      {children && <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-2">{children}</div>}
    </div>
  );
}

function TopicLine({ t, max, showSubject }: { t: TopicRow; max: number; showSubject: boolean }) {
  return (
    <StatRow title={<span className="font-medium">{t.label}</span>} value={`${t.tests}\u00a0×`} ratio={t.tests / max}>
      {showSubject && <span>{t.subject}</span>}
      <span className="num">{t.students} Schüler</span>
      <span className="num">{t.byKind.map((k) => `${k.kind} ${k.tests}`).join(" · ")}</span>
    </StatRow>
  );
}
