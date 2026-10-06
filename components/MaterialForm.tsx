"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { suggestSkillsAction, type TopicSuggestion } from "@/app/curriculum-actions";
import { saveMaterialAction, type MaterialState } from "@/app/learning-actions";
import { Reveal } from "@/components/ui";

type SkillOption = { id: string; name: string; area: string; subject: string };
export type MaterialValues = { id?: number; subject: string; topic: string; subtopic: string; skill_ids: string[]; since: string; priority: number; note: string; source: string };

const SOURCES: [string, string][] = [
  ["unterricht", "Unterricht"],
  ["hausuebung", "Hausübung"],
  ["test", "Test"],
  ["schularbeit", "Schularbeit"],
  ["einschaetzung", "Eigene Einschätzung"],
];
const PRIORITIES: [number, string][] = [
  [1, "hoch"],
  [2, "normal"],
  [3, "niedrig"],
];
const chip = "flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent";

/**
 * Aktueller Stoff of one subject: Thema and Unterthema as the school calls them; matching skills
 * appear as chips to tick (nothing is linked automatically), the rest is optional.
 */
export function MaterialForm({ studentId, subjects, skills, initial, today }: { studentId: number; subjects: string[]; skills: SkillOption[]; initial?: MaterialValues; today: string }) {
  const [state, action, saving] = useActionState<MaterialState, FormData>(saveMaterialAction, null);
  const [subject, setSubject] = useState(initial?.subject ?? subjects[0] ?? "Mathematik");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [subtopic, setSubtopic] = useState(initial?.subtopic ?? "");
  const [checked, setChecked] = useState<string[]>(initial?.skill_ids ?? []);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const text = [topic, subtopic].filter((x) => x.trim()).join(", ");
    if (!text) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => start(async () => setSuggestions(await suggestSkillsAction(studentId, subject, text))), 350);
    return () => clearTimeout(t);
  }, [topic, subtopic, subject, studentId]);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const suggested = suggestions.flatMap((s) => s.skills).filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const extra = checked.filter((id) => !suggested.some((s) => s.id === id));
  const ofSubject = skills.filter((s) => s.subject === subject);
  const areas = [...new Set(ofSubject.map((s) => s.area))];

  return (
    <form action={action} className="panel grid gap-4 px-4 py-4" aria-label={initial?.id ? "Aktuellen Stoff bearbeiten" : "Aktuellen Stoff festlegen"}>
      <input type="hidden" name="student_id" value={studentId} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {checked.map((id) => (
        <input key={id} type="hidden" name="skill_ids" value={id} />
      ))}
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="field">
          <span className="label">Fach</span>
          {initial?.id ? (
            <input className="input" name="subject" value={subject} readOnly />
          ) : (
            <select className="input" name="subject" value={subject} onChange={(e) => (setSubject(e.target.value), setChecked([]))}>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </label>
        <label className="field">
          <span className="label">Thema</span>
          <input className="input" name="topic" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z. B. Gleichungen" autoComplete="off" />
        </label>
        <label className="field">
          <span className="label">Unterthema</span>
          <input className="input" name="subtopic" value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="z. B. Gleichungen mit Klammern" autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-1.5" aria-live="polite">
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Sparkles size={13} aria-hidden /> Fähigkeiten antippen, die dazugehören
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...suggested, ...extra.map((id) => byId.get(id)).filter((x): x is SkillOption => Boolean(x))].map((s) => (
            <label key={s.id} className={chip}>
              <input type="checkbox" checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--accent)]" />
              {s.name}
              <span className="text-ink-3">· {s.area}</span>
            </label>
          ))}
          {suggested.length === 0 && extra.length === 0 && <span className="text-[13px] text-ink-3">{pending ? "Suche passende Fähigkeiten …" : topic ? "Kein Vorschlag. Wähle unten aus der Liste." : "Erscheinen, sobald du ein Thema eingibst."}</span>}
        </div>
        <Reveal label="Aus allen Fähigkeiten wählen">
          <div className="grid max-h-[280px] gap-3 overflow-y-auto rounded-lg border border-line bg-paper p-3">
            {areas.map((area) => (
              <fieldset key={area}>
                <legend className="mb-1 text-[12px] font-semibold text-ink-3">{area}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {ofSubject
                    .filter((s) => s.area === area)
                    .map((s) => (
                      <label key={s.id} className="flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                        <input type="checkbox" checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--accent)]" />
                        {s.name}
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field">
          <span className="label">Seit</span>
          <input className="input" type="date" name="since" defaultValue={initial?.since ?? today} />
        </label>
        <label className="field">
          <span className="label">Quelle</span>
          <select className="input" name="source" defaultValue={initial?.source ?? "unterricht"}>
            {SOURCES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend className="label">Priorität</legend>
          <div className="flex gap-1.5">
            {PRIORITIES.map(([p, l]) => (
              <label key={p} className={chip}>
                <input type="radio" name="priority" value={p} defaultChecked={(initial?.priority ?? 2) === p} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="field">
        <span className="label">Kurze Notiz (optional)</span>
        <input className="input" name="note" defaultValue={initial?.note} placeholder="z. B. Lehrerin legt Wert auf Probe" maxLength={500} />
      </label>
      {state && "error" in state && <p className="text-[14px] text-red">{state.error}</p>}
      <button className="btn btn-primary justify-self-start" disabled={saving}>
        {initial?.id ? "Änderungen speichern" : "Als aktuellen Stoff speichern"}
      </button>
    </form>
  );
}
