"use client";

import { Lightbulb, Search, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createDraftAction, type ActionResult } from "@/app/builder-actions";
import { SchoolClassFields } from "@/components/SchoolClassFields";
import type { StudentContext, Suggestion } from "@/lib/builder";
import { categoriesFor, DIFFICULTIES, difficultyFor } from "@/lib/curriculum";
import { klassenLabel, schulstufe } from "@/lib/school";

type Skill = { id: string; subject: string; area: string; name: string; grade_min: number; grade_max: number; parent_id: string | null };
type Student = { id: number; name: string };
export type BuilderPreset = { skillIds?: string[]; subject?: string; difficulty?: string; count?: number; categories?: string[] };

const AUTO = "automatisch";
const COUNTS = [5, 10, 15, 20];
const chip =
  "cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[14px] transition-colors hover:border-ink-3 has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent";
const pct = (m: number | null | undefined) => (m == null ? null : `${Math.round(m * 100)} %`);

export function BuilderForm({ skills, students, ctx, aiEnabled, preset }: { skills: Skill[]; students: Student[]; ctx: StudentContext | null; aiEnabled: boolean; preset?: BuilderPreset }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(createDraftAction, null);
  const subjects = useMemo(() => [...new Set(skills.map((s) => s.subject))], [skills]);
  // the first suggestion is preselected, unless the page was opened for a specific skill
  const first = !preset?.skillIds?.length ? ctx?.suggestions[0] : undefined;
  const firstSkill = skills.find((s) => s.id === (preset?.skillIds?.[0] ?? first?.skillIds[0]));
  const [subject, setSubject] = useState(preset?.subject ?? firstSkill?.subject ?? ctx?.subjects.find((x) => subjects.includes(x)) ?? subjects[0]);
  const [level, setLevel] = useState({ type: ctx?.schoolType || "Mittelschule", klasse: ctx?.klasse ?? 2 });
  const [selected, setSelected] = useState<string[]>(preset?.skillIds ?? first?.skillIds ?? []);
  const [applied, setApplied] = useState<string | null>(first?.key ?? null);
  const [difficulty, setDifficulty] = useState<string>(preset?.difficulty ?? (ctx ? AUTO : "mittel"));
  const [count, setCount] = useState(preset?.count ?? 10);
  const [customCount, setCustomCount] = useState(!COUNTS.includes(preset?.count ?? 10));
  const [cats, setCats] = useState<string[]>(preset?.categories ?? first?.categories ?? []);
  const [useAI, setUseAI] = useState(aiEnabled);
  const [query, setQuery] = useState("");
  const grade = schulstufe(level.type, level.klasse);
  const categories = categoriesFor(subject);

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const mastery = (id: string) => {
    if (!ctx) return null;
    const own = ctx.mastery[id];
    if (own != null) return own;
    const p = byId.get(id)?.parent_id;
    return p ? (ctx.mastery[p] ?? null) : null;
  };

  // Fach › Thema › Fähigkeit › Teilfähigkeit; topics for the student's class first
  const areas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = new Map<string, { skill: Skill; subs: Skill[] }[]>();
    for (const s of skills.filter((x) => x.subject === subject && !x.parent_id)) {
      const subs = skills.filter((x) => x.parent_id === s.id);
      if (q && ![s, ...subs].some((x) => `${x.area} ${x.name}`.toLowerCase().includes(q))) continue;
      m.set(s.area, [...(m.get(s.area) ?? []), { skill: s, subs }]);
    }
    const fits = (list: { skill: Skill }[]) => list.some(({ skill }) => grade >= skill.grade_min && grade <= skill.grade_max);
    return [...m].sort(([, a], [, b]) => Number(fits(b)) - Number(fits(a)));
  }, [skills, subject, query, grade]);

  const toggle = (id: string) => {
    setApplied(null);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const apply = (sg: Suggestion) => {
    const sk = byId.get(sg.skillIds[0]);
    if (sk && sk.subject !== subject) setSubject(sk.subject);
    setSelected(sg.skillIds);
    setCats(sg.categories);
    setDifficulty(sg.difficulty);
    setApplied(sg.key);
  };
  const changeSubject = (s: string) => {
    setSubject(s);
    setSelected([]);
    setCats([]);
    setApplied(null);
  };

  const chosen = selected.map((id) => byId.get(id)).filter((x): x is Skill => Boolean(x));
  const labelOf = (s: Skill) => (s.parent_id ? `${byId.get(s.parent_id)?.name} › ${s.name}` : s.name);
  const levelText = klassenLabel(level.type, level.klasse);
  const request = chosen.length
    ? `Erstelle ${count} Übungen${ctx ? ` für ${ctx.first}` : ""}, ${levelText}, ${subject}: ${chosen.map(labelOf).join(", ")}.`
    : null;

  return (
    <form action={action} className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="count" value={count} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="skill_ids" value={id} />
      ))}

      <ol className="grid gap-8">
        {/* 1 · Schüler */}
        <Step n={1} title="Schüler">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="field">
              <span className="label">Schüler</span>
              <select
                className="input"
                name="student_id"
                value={ctx?.studentId ?? ""}
                onChange={(e) => router.replace(e.target.value ? `/uebungen/neu?schueler=${e.target.value}` : "/uebungen/neu")}
              >
                <option value="">Ohne Schüler (allgemeine Übung)</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <SchoolClassFields key={String(ctx?.studentId)} type={level.type} klasse={level.klasse} onChange={(type, klasse) => setLevel({ type, klasse })} />
            </div>
          </div>
          {ctx && <ContextCard ctx={ctx} />}
          {ctx && ctx.suggestions.length > 0 && (
            <div className="mt-4">
              <p className="label mb-2 flex items-center gap-1.5">
                <Lightbulb size={14} aria-hidden /> Vorschläge für {ctx.first}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ctx.suggestions.map((sg) => (
                  <button
                    key={sg.key}
                    type="button"
                    onClick={() => apply(sg)}
                    aria-pressed={applied === sg.key}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${applied === sg.key ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-ink-3"}`}
                  >
                    <span className="block text-[14px] font-semibold">{sg.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-2">{sg.reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Step>

        {/* 2 · Fach */}
        <Step n={2} title="Fach">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Fach">
            {subjects.map((s) => (
              <label key={s} className={chip}>
                <input type="radio" name="_subject" value={s} checked={subject === s} onChange={() => changeSubject(s)} className="sr-only" />
                {s}
                {ctx && !ctx.subjects.includes(s) && <span className="ml-1 text-[12px] text-ink-3">(nicht im Profil)</span>}
              </label>
            ))}
          </div>
        </Step>

        {/* 3 · Thema und Fähigkeit */}
        <Step n={3} title="Thema und Fähigkeit" note="Jede Aufgabe gehört zu einer genauen Fähigkeit. Teilfähigkeiten zählen auch für die übergeordnete Fähigkeit.">
          <div className="relative mb-3 max-w-[360px]">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input" style={{ paddingLeft: 36 }} type="search" placeholder="Thema oder Fähigkeit suchen" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Fähigkeit suchen" />
          </div>
          {chosen.length > 0 && (
            <p className="mb-3 text-[13px] text-ink-2">
              Gewählt: <span className="font-semibold text-ink">{chosen.map(labelOf).join(" · ")}</span>
            </p>
          )}
          <div className="grid items-start gap-3 md:grid-cols-2">
            {areas.map(([area, list]) => {
              const fits = list.some(({ skill }) => grade >= skill.grade_min && grade <= skill.grade_max);
              const open = query.trim() !== "" || list.some(({ skill, subs }) => [skill, ...subs].some((x) => selected.includes(x.id)));
              return (
                <details key={area} open={open} className={`panel group px-4 py-3 ${fits ? "" : "opacity-75"}`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
                    <span>
                      {area}
                      {!fits && <span className="ml-2 text-[12px] font-normal text-ink-3">andere Schulstufe</span>}
                    </span>
                    <span className="text-[12px] font-normal text-ink-3 group-open:hidden">{list.length} Fähigkeiten</span>
                  </summary>
                  <ul className="mt-2 grid gap-1">
                    {list.map(({ skill, subs }) => (
                      <li key={skill.id}>
                        <SkillRow skill={skill} checked={selected.includes(skill.id)} onToggle={toggle} mastery={mastery(skill.id)} hasCtx={Boolean(ctx)} />
                        {subs.length > 0 && (
                          <ul className="ml-6 grid gap-1 border-l border-line pl-2">
                            {subs.map((s) => (
                              <li key={s.id}>
                                <SkillRow skill={s} checked={selected.includes(s.id)} onToggle={toggle} mastery={ctx?.mastery[s.id] ?? null} hasCtx={Boolean(ctx)} small />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
            {areas.length === 0 && <p className="text-[14px] text-ink-3">Keine Fähigkeit passt zur Suche.</p>}
          </div>
        </Step>

        {/* 4 · Schwierigkeit */}
        <Step n={4} title="Schwierigkeit">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Schwierigkeit">
            {[...DIFFICULTIES, AUTO].map((d) => (
              <label key={d} className={chip}>
                <input type="radio" name="difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} className="sr-only" />
                {d === AUTO ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Wand2 size={14} aria-hidden /> automatisch an Schüler anpassen
                  </span>
                ) : (
                  d
                )}
              </label>
            ))}
          </div>
          {difficulty === AUTO && (
            <p className="mt-2 text-[13px] text-ink-2">
              {!ctx
                ? "Ohne Schüler gibt es keinen Lernstand; es wird „leicht“ verwendet."
                : chosen.length
                  ? chosen.map((s) => `${labelOf(s)}: ${difficultyFor(mastery(s.id))}${pct(mastery(s.id)) ? ` (Lernstand ${pct(mastery(s.id))})` : " (noch keine Daten)"}`).join(" · ")
                  : "Richtet sich nach dem Lernstand in jeder gewählten Fähigkeit."}
            </p>
          )}
        </Step>

        {/* 5 · Anzahl */}
        <Step n={5} title="Anzahl">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Anzahl">
            {COUNTS.map((n) => (
              <label key={n} className={`${chip} num min-w-12 text-center`}>
                <input
                  type="radio"
                  name="_count"
                  checked={!customCount && count === n}
                  onChange={() => {
                    setCustomCount(false);
                    setCount(n);
                  }}
                  className="sr-only"
                />
                {n}
              </label>
            ))}
            <label className={chip}>
              <input type="radio" name="_count" checked={customCount} onChange={() => setCustomCount(true)} className="sr-only" />
              benutzerdefiniert
            </label>
            {customCount && (
              <input
                className="input num w-20"
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                aria-label="Anzahl Aufgaben"
                autoFocus
              />
            )}
          </div>
        </Step>

        {/* 6 · Aufgabentyp */}
        <Step n={6} title="Aufgabentyp" note="Mehrere möglich. Ohne Auswahl wird gemischt.">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <label key={c.key} className={chip} title={c.hint}>
                <input
                  type="checkbox"
                  name="categories"
                  value={c.key}
                  checked={cats.includes(c.key)}
                  onChange={() => setCats((cur) => (cur.includes(c.key) ? cur.filter((x) => x !== c.key) : [...cur, c.key]))}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
          {cats.length > 0 && (
            <ul className="mt-2 grid gap-0.5 text-[13px] text-ink-2">
              {categories
                .filter((c) => cats.includes(c.key))
                .map((c) => (
                  <li key={c.key}>
                    <span className="font-semibold text-ink">{c.label}:</span> {c.hint}
                  </li>
                ))}
            </ul>
          )}
        </Step>
      </ol>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6">
        <div className="panel grid gap-4 px-4 py-4">
          <label className="field">
            <span className="label">Hinweis an die KI (optional)</span>
            <textarea
              className="input min-h-[72px]"
              name="focus"
              placeholder={ctx?.errors[0] ? `z. B. besonders auf „${ctx.errors[0].label}“ achten` : "z. B. Textaufgaben mit Fußball"}
              disabled={!useAI}
            />
          </label>
          <label className="field">
            <span className="label">Titel (optional)</span>
            <input className="input" name="title" placeholder="Wird sonst automatisch vergeben" />
          </label>
          <label className={`flex items-center gap-2 text-[14px] ${aiEnabled ? "cursor-pointer" : "text-ink-3"}`}>
            <input type="checkbox" name="use_ai" checked={useAI} disabled={!aiEnabled} onChange={(e) => setUseAI(e.target.checked)} className="accent-[var(--accent)]" />
            <Sparkles size={15} className={useAI ? "text-accent" : ""} aria-hidden />
            Mit Claude erstellen
          </label>
          {!aiEnabled && <p className="-mt-2 text-[12px] text-ink-3">Kein API-Schlüssel hinterlegt: Die Aufgaben kommen aus den eingebauten Generatoren.</p>}
          {request && (
            <div className="rounded-lg bg-paper px-3 py-2.5 text-[13px] text-ink-2">
              <p className="text-ink">{request}</p>
              {useAI && ctx && <p className="mt-1">Dazu bekommt Claude {ctx.first}s Lernstand, Schwächen, Ziele und häufigste Fehler (nur der Vorname).</p>}
            </div>
          )}
          <div className="grid gap-2">
            <Submit disabled={selected.length === 0} ai={useAI && aiEnabled} count={count} />
            <EmptyButton />
          </div>
          {selected.length === 0 && <p className="text-[13px] text-ink-3">Wähle mindestens eine Fähigkeit.</p>}
          {state?.error && (
            <p className="text-[14px] text-red" role="alert">
              {state.error}
            </p>
          )}
          <p className="text-[12px] text-ink-3">Die Übung ist zuerst ein Entwurf. Du siehst zuerst eine Vorschau und sendest sie dann an den Schüler.</p>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
      <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-surface" aria-hidden>
        {n}
      </span>
      <section aria-label={title}>
        <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
        <div className="mt-3">{children}</div>
      </section>
    </li>
  );
}

function SkillRow({ skill, checked, onToggle, mastery, hasCtx, small }: { skill: { id: string; name: string }; checked: boolean; onToggle: (id: string) => void; mastery: number | null; hasCtx: boolean; small?: boolean }) {
  const tone = mastery == null ? "text-ink-3" : mastery < 0.6 ? "text-red" : mastery < 0.8 ? "text-amber" : "text-green";
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface has-checked:bg-accent-wash ${small ? "text-[13px]" : "text-[14px]"}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(skill.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">{skill.name}</span>
      {hasCtx && mastery != null && <span className={`num shrink-0 text-[12px] font-semibold ${tone}`}>{Math.round(mastery * 100)} %</span>}
    </label>
  );
}

function ContextCard({ ctx }: { ctx: StudentContext }) {
  const rows: [string, React.ReactNode][] = [
    ["Schule", ctx.level],
    ["Fächer", ctx.subjects.join(", ") || "–"],
    ["Aktuelle Themen", ctx.topics || "–"],
    ["Bekannte Schwächen", [ctx.weaknessesNote, ...ctx.weakSkills.map((w) => `${w.label} (${Math.round(w.mastery * 100)} %)`)].filter(Boolean).join(" · ") || "–"],
    ["Lernziele", ctx.goals || "–"],
  ];
  if (ctx.errors.length) rows.push(["Häufige Fehler", ctx.errors.slice(0, 4).map((e) => `${e.label} (${e.count}×)`).join(" · ")]);
  if (ctx.strongSkills.length) rows.push(["Kann schon gut", ctx.strongSkills.slice(0, 3).map((s) => s.label).join(" · ")]);
  return (
    <dl className="mt-4 grid gap-x-4 gap-y-1.5 rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] sm:grid-cols-[150px_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Submit({ disabled, ai, count }: { disabled: boolean; ai: boolean; count: number }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("mode") !== "leer";
  return (
    <button className="btn btn-primary btn-lg" name="mode" value="generieren" disabled={disabled || pending}>
      <Sparkles size={17} aria-hidden />
      {mine ? (ai ? `Claude erstellt ${count} Aufgaben …` : "Wird erstellt …") : "Übung erstellen und Vorschau zeigen"}
    </button>
  );
}

function EmptyButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost" name="mode" value="leer" disabled={pending} formNoValidate>
      Leer beginnen und selbst schreiben
    </button>
  );
}
