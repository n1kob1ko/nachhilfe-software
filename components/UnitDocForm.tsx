import { saveUnitDocAction } from "@/app/session-actions";
import { SkillPicker } from "@/components/SkillPicker";
import * as repo from "@/lib/repo";

const SCALES = {
  understanding: ["nicht verstanden", "kaum", "teilweise", "gut", "sehr gut"],
  concentration: ["sehr abgelenkt", "oft abgelenkt", "wechselnd", "konzentriert", "sehr konzentriert"],
  motivation: ["sehr gering", "gering", "mittel", "hoch", "sehr hoch"],
  participation: ["kaum", "wenig", "teilweise", "aktiv", "sehr aktiv"],
} as const;

function Scale({ name, legend, value }: { name: keyof typeof SCALES; legend: string; value: number | null }) {
  return (
    <fieldset className="field">
      <legend className="label mb-1.5">{legend}</legend>
      <div className="grid grid-cols-5 gap-1">
        {SCALES[name].map((label, i) => (
          <label
            key={label}
            className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-line-strong bg-surface px-1 py-1.5 text-center text-[11px] leading-tight text-ink-2 has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent"
          >
            <input type="radio" name={name} value={i + 1} defaultChecked={value === i + 1} className="sr-only" />
            <span className="num text-[15px] font-semibold">{i + 1}</span>
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Teacher completes the generated Lern-Dokumentation. Generated data is shown above and not typed again. */
export function UnitDocForm({ lesson, student }: { lesson: repo.Lesson; student: repo.Student }) {
  const subjects = student.subjects.length ? student.subjects : [lesson.subject];
  const skills = repo.listSkills().filter((s) => subjects.includes(s.subject) || lesson.skill_ids.includes(s.id));
  return (
    <form action={saveUnitDocAction.bind(null, lesson.id)} className="grid gap-6">
      <label className="field">
        <span className="label">Zusammenfassung</span>
        <textarea className="input min-h-[140px]" name="summary" defaultValue={lesson.summary} />
        <span className="text-[12px] text-ink-3">Automatisch aus den Übungsdaten geschrieben. Du kannst sie anpassen; sie wird im Schülerprofil gespeichert.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">Thema</span>
          <input className="input" name="topic" defaultValue={lesson.topic} />
        </label>
        <label className="field">
          <span className="label">Was wurde zusätzlich gemacht?</span>
          <input className="input" name="activities" defaultValue={lesson.activities} placeholder="z. B. Kehrwert an der Tafel erklärt" />
        </label>
      </div>
      <label className="field">
        <span className="label">Beobachtungen</span>
        <textarea className="input" name="tutor_notes" defaultValue={lesson.tutor_notes} placeholder="Wie wurde gearbeitet, was ist aufgefallen?" />
        <span className="text-[12px] text-ink-3">Steht auch in der Abrechnung.</span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <Scale name="concentration" legend="Konzentration" value={lesson.concentration} />
        <Scale name="motivation" legend="Motivation" value={lesson.motivation} />
        <Scale name="participation" legend="Mitarbeit" value={lesson.participation} />
        <Scale name="understanding" legend="Verständnis (deine Einschätzung)" value={lesson.understanding} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">Besondere Schwierigkeiten</span>
          <textarea className="input" name="difficulties" defaultValue={lesson.difficulties} />
        </label>
        <label className="field">
          <span className="label">Positive Entwicklungen</span>
          <textarea className="input" name="positives" defaultValue={lesson.positives} />
        </label>
        <label className="field">
          <span className="label">Weitere Fehler (nicht am Gerät)</span>
          <textarea className="input" name="mistakes" defaultValue={lesson.mistakes} placeholder="Ein Fehler pro Zeile" />
          <span className="text-[12px] text-ink-3">Fehler aus den Übungen sind oben schon erfasst.</span>
        </label>
        <label className="field">
          <span className="label">Empfohlene Wiederholungen</span>
          <textarea className="input" name="review_topics" defaultValue={lesson.review_topics} />
        </label>
        <label className="field">
          <span className="label">Nächstes Lernziel</span>
          <textarea className="input" name="next_steps" defaultValue={lesson.next_steps} />
        </label>
        <div className="field">
          <label className="field">
            <span className="label">Hausübung / Übungsempfehlung</span>
            <textarea className="input" name="homework_note" defaultValue={lesson.homework_note} />
          </label>
          {!lesson.homework_note && (
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="as_homework" className="accent-[var(--accent)]" /> als Hausübung eintragen, fällig am
              </label>
              <input className="input num w-auto py-1" type="date" name="homework_due" aria-label="Fällig am" />
            </div>
          )}
        </div>
      </div>
      <fieldset className="field">
        <legend className="label">Geübte Fähigkeiten</legend>
        <span className="text-[12px] text-ink-3">Am Gerät geübte Fähigkeiten sind schon markiert. Deine Verständnis-Einschätzung zählt für die markierten Fähigkeiten.</span>
        <SkillPicker skills={skills} selected={lesson.skill_ids} />
      </fieldset>
      <div>
        <button className="btn btn-primary">Dokumentation speichern</button>
      </div>
    </form>
  );
}
