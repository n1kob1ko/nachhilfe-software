"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { addExamAction, suggestSkillsAction, type TopicSuggestion } from "@/app/curriculum-actions";
import { Reveal } from "@/components/ui";

const KINDS = ["Schularbeit", "Test", "Vokabeltest", "Mündliche Prüfung", "Mitarbeit", "Zeugnis"];

/**
 * Quick entry of a Schularbeit/test: Art, Fach, Datum, Stoff. While the Stoff is typed, matching skills
 * appear as chips to tick; nothing is linked automatically. A result can be added right away.
 */
export function ExamForm({ studentId, subjects, today }: { studentId: number; subjects: string[]; today: string }) {
  const [subject, setSubject] = useState(subjects[0] ?? "Mathematik");
  const [topics, setTopics] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!topics.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => start(async () => setSuggestions(await suggestSkillsAction(studentId, subject, topics))), 350);
    return () => clearTimeout(t);
  }, [topics, subject, studentId]);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const shown = suggestions.flatMap((s) => s.skills);
  const unmatched = suggestions.filter((s) => s.skills.length === 0).map((s) => s.topic);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await addExamAction(fd);
        formRef.current?.reset();
        setTopics("");
        setChecked([]);
      }}
      className="panel grid gap-3 px-4 py-4"
      aria-label="Prüfung eintragen"
    >
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <select className="input" name="kind" aria-label="Art">
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select className="input" name="subject" aria-label="Fach" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input className="input col-span-2 sm:col-span-1" type="date" name="date" required defaultValue={today} aria-label="Datum" />
      </div>
      <input className="input" name="topics" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Stoff, z. B. Brüche, Prozent, Sachaufgaben" aria-label="Stoff" autoComplete="off" />
      {checked.filter((id) => !shown.some((s) => s.id === id)).map((id) => (
        <input key={id} type="hidden" name="skill_ids" value={id} />
      ))}
      {(shown.length > 0 || unmatched.length > 0) && (
        <div className="grid gap-1.5" aria-live="polite">
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <Sparkles size={13} aria-hidden /> Passende Fähigkeiten antippen, um sie zu verknüpfen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((s, i) => shown.findIndex((x) => x.id === s.id) === i)
              .map((s) => (
                <label key={s.id} className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                  <input type="checkbox" name="skill_ids" value={s.id} checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--accent)]" />
                  {s.name}
                  <span className="text-ink-3">· {s.area}</span>
                </label>
              ))}
          </div>
          {unmatched.length > 0 && <p className="text-[12.5px] text-ink-3">Ohne Vorschlag: {unmatched.join(", ")}. Bleibt als Stoff gespeichert.</p>}
        </div>
      )}
      {pending && shown.length === 0 && <p className="text-[12.5px] text-ink-3">Suche passende Fähigkeiten …</p>}
      <Reveal label="Schon geschrieben? Ergebnis eintragen">
        <div className="grid grid-cols-3 gap-3">
          <input className="input num" name="grade" type="number" min={1} max={5} placeholder="Note" aria-label="Note" />
          <input className="input num" name="points" inputMode="decimal" placeholder="Punkte" aria-label="Punkte" />
          <input className="input num" name="max_points" inputMode="decimal" placeholder="von" aria-label="Höchstpunkte" />
        </div>
      </Reveal>
      <button className="btn btn-primary justify-self-start">Eintragen</button>
    </form>
  );
}
