"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { buildWorksheetAction, type BuildState } from "@/app/actions";
import { DIFFICULTIES, TASK_TYPES } from "@/lib/curriculum";

type Skill = { id: string; subject: string; area: string; name: string; grade_min: number; grade_max: number };
type Student = { id: number; name: string; grade: number; school_type: string; subjects: string[] };

export function BuilderForm({ skills, students, initialStudentId, aiEnabled, preset }: {
  skills: Skill[];
  students: Student[];
  initialStudentId?: number;
  aiEnabled: boolean;
  preset?: { skillIds?: string[]; difficulty?: string; count?: number };
}) {
  const [state, action] = useActionState<BuildState, FormData>(buildWorksheetAction, null);
  const subjects = useMemo(() => [...new Set(skills.map((s) => s.subject))], [skills]);
  const initialStudent = students.find((s) => s.id === initialStudentId);
  const [studentId, setStudentId] = useState<number | "">(initialStudent?.id ?? "");
  const student = students.find((s) => s.id === studentId);
  const [subject, setSubject] = useState(
    preset?.skillIds?.length ? skills.find((s) => s.id === preset.skillIds![0])?.subject ?? subjects[0] : initialStudent?.subjects.find((s) => subjects.includes(s)) ?? subjects[0],
  );
  const [grade, setGrade] = useState(initialStudent?.grade ?? 6);
  const [selected, setSelected] = useState<string[]>(preset?.skillIds ?? []);
  const [type, setType] = useState<string>("mixed");
  const [useAI, setUseAI] = useState(aiEnabled);

  const areas = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of skills.filter((s) => s.subject === subject)) m.set(s.area, [...(m.get(s.area) ?? []), s]);
    return [...m];
  }, [skills, subject]);

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleArea = (list: Skill[]) => {
    const all = list.every((s) => selected.includes(s.id));
    setSelected((cur) => (all ? cur.filter((x) => !list.some((s) => s.id === x)) : [...new Set([...cur, ...list.map((s) => s.id)])]));
  };

  return (
    <form action={action} className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          <span className="label">Für Schüler (optional)</span>
          <select
            className="input"
            name="student_id"
            value={studentId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : "";
              setStudentId(id);
              const s = students.find((x) => x.id === id);
              if (s) {
                setGrade(s.grade);
                const subj = s.subjects.find((x) => subjects.includes(x));
                if (subj && subj !== subject) {
                  setSubject(subj);
                  setSelected([]);
                }
              }
            }}
          >
            <option value="">Nur erstellen, nicht zuweisen</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Fach</span>
          <select
            className="input"
            name="subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setSelected([]);
            }}
          >
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Schulstufe</span>
          <input className="input num" type="number" name="grade" min={1} max={13} value={grade} onChange={(e) => setGrade(Number(e.target.value))} />
        </label>
        <input type="hidden" name="school_type" value={student?.school_type ?? ""} />
      </section>

      <fieldset>
        <legend className="label mb-2">Thema und Fähigkeiten</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {areas.map(([area, list]) => {
            const all = list.every((s) => selected.includes(s.id));
            const outOfGrade = list.every((s) => grade < s.grade_min || grade > s.grade_max);
            return (
              <div key={area} className={`panel px-4 py-3 ${outOfGrade ? "opacity-70" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold">{area}</span>
                  <button type="button" className="text-[12px] font-semibold text-accent hover:underline" onClick={() => toggleArea(list)}>
                    {all ? "Keine" : "Ganzes Thema"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                      <input type="checkbox" name="skill_ids" value={s.id} checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--accent)]" />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <section className="grid gap-6 md:grid-cols-[1fr_140px]">
        <fieldset>
          <legend className="label mb-2">Schwierigkeit</legend>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[14px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent">
                <input type="radio" name="difficulty" value={d} defaultChecked={d === (preset?.difficulty ?? "mittel")} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="label">Anzahl Aufgaben</span>
          <input className="input num" type="number" name="count" min={1} max={30} defaultValue={preset?.count ?? 8} />
        </label>
      </section>

      <fieldset>
        <legend className="label mb-2">Aufgabentyp</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TASK_TYPES).map(([k, label]) => (
            <label key={k} className="cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[14px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent">
              <input type="radio" name="task_type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        {!useAI && (type === "grammar" || type === "reading" || type === "free") && (
          <p className="mt-2 text-[13px] text-ink-3">
            Ohne KI: {type === "reading" ? "ein eingebauter Lesetext pro Sprache." : type === "free" ? "Erklär- und Begründungsaufgaben; der Schüler vergleicht mit der Musterlösung." : "Kurzantworten, wo der Generator sie unterstützt."}
          </p>
        )}
      </fieldset>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="label">Titel (optional)</span>
          <input className="input" name="title" placeholder="Wird sonst automatisch vergeben" />
        </label>
        <label className="field">
          <span className="label">Hinweis an die KI (optional)</span>
          <input className="input" name="focus" placeholder="z. B. Textaufgaben mit Fußball, Fokus auf Kehrwert" disabled={!useAI} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Submit disabled={selected.length === 0} ai={useAI} assign={Boolean(student)} />
        <label className={`flex items-center gap-2 text-[14px] ${aiEnabled ? "cursor-pointer" : "text-ink-3"}`}>
          <input type="checkbox" name="use_ai" checked={useAI} disabled={!aiEnabled} onChange={(e) => setUseAI(e.target.checked)} className="accent-[var(--accent)]" />
          <Sparkles size={15} className={useAI ? "text-accent" : ""} aria-hidden />
          Mit Claude erstellen
          {!aiEnabled && <span className="text-[12px]">(kein API-Schlüssel hinterlegt)</span>}
        </label>
        {selected.length === 0 && <span className="text-[13px] text-ink-3">Wähle mindestens eine Fähigkeit.</span>}
        {state?.error && <p className="w-full text-[14px] text-red">{state.error}</p>}
      </div>
    </form>
  );
}

function Submit({ disabled, ai, assign }: { disabled: boolean; ai: boolean; assign: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={disabled || pending}>
      {pending ? (ai ? "Claude erstellt Aufgaben und Lösungen …" : "Wird erstellt …") : assign ? "Erstellen und zuweisen" : "Übung erstellen"}
    </button>
  );
}
