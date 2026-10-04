import { deleteLessonAction, saveLessonAction } from "@/app/actions";
import { SkillPicker } from "@/components/SkillPicker";
import { practiceOnDay } from "@/lib/autodoc";
import * as repo from "@/lib/repo";

const UNDERSTANDING = ["nicht verstanden", "kaum", "teilweise", "gut", "sehr gut"];

function localNow() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

export function LessonForm({ student, lesson }: { student: repo.Student; lesson?: repo.Lesson }) {
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const skills = repo.listSkills().filter((s) => subjects.includes(s.subject));
  const previous = repo.listLessons(student.id).find((l) => l.kind === "stunde" && l.status === "abgeschlossen" && l.id !== lesson?.id && l.next_steps);
  const documenting = !lesson || lesson.status === "geplant";
  const teachers = repo.listTeachers();
  // what the student practised on their own that day goes straight into the documentation
  const day = (lesson?.starts_at ?? localNow()).slice(0, 10);
  const practice = documenting ? practiceOnDay(student.id, day) : [];
  const prefill = (pick: (l: repo.Lesson) => string) => practice.map(pick).filter(Boolean).join("\n");
  const activities = lesson?.activities || prefill((l) => l.activities);
  const mistakes = lesson?.mistakes || prefill((l) => l.mistakes);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form action={saveLessonAction} className="grid gap-6">
        {lesson && <input type="hidden" name="id" value={lesson.id} />}
        <input type="hidden" name="student_id" value={student.id} />
        <div className="grid gap-4 sm:grid-cols-[1fr_120px_1fr]">
          <label className="field">
            <span className="label">Datum und Uhrzeit</span>
            <input className="input num" type="datetime-local" name="starts_at" required defaultValue={lesson?.starts_at ?? localNow()} />
          </label>
          <label className="field">
            <span className="label">Dauer (min)</span>
            <input className="input num" type="number" name="duration_min" min={15} step={5} defaultValue={lesson?.duration_min ?? 60} />
          </label>
          <label className="field">
            <span className="label">Fach</span>
            <select className="input" name="subject" defaultValue={lesson?.subject ?? subjects[0]}>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
          <label className="field">
            <span className="label">Thema</span>
            <input className="input" name="topic" defaultValue={lesson?.topic} placeholder="z. B. Division von Brüchen" />
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select className="input" name="status" defaultValue={documenting ? "abgeschlossen" : lesson?.status}>
              <option value="geplant">geplant</option>
              <option value="abgeschlossen">stattgefunden</option>
              <option value="abgesagt">abgesagt</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Lehrer</span>
            <select className="input" name="teacher_id" defaultValue={lesson?.teacher_id ?? student.teacher_id ?? ""}>
              <option value="">noch offen</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {practice.length > 0 && (
          <p className="-mt-2 rounded-lg bg-accent-wash px-3 py-2 text-[13px] text-accent">
            {student.name.split(" ")[0]} hat an diesem Tag selbstständig geübt. Was dabei gemacht wurde und welche Fehler passiert sind, ist unten schon eingetragen.
          </p>
        )}
        <label className="field">
          <span className="label">Was wurde gemacht?</span>
          <textarea className="input" name="activities" defaultValue={activities} placeholder="Inhalte, Übungen, Methoden" />
        </label>
        <label className="field">
          <span className="label">Welche Fehler sind passiert?</span>
          <textarea className="input" name="mistakes" defaultValue={mistakes} placeholder={"Ein Fehler pro Zeile, z. B.\nKehrwert vergessen\nVorzeichen beim Umformen"} />
          <span className="text-[12px] text-ink-3">Jede Zeile wird in der Fehleranalyse mitgezählt.</span>
        </label>
        <fieldset className="field">
          <legend className="label mb-1.5">Wie gut wurde das Thema verstanden?</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {UNDERSTANDING.map((label, i) => (
              <label
                key={label}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-line-strong bg-surface px-2 py-2 text-center text-[12px] text-ink-2 has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent"
              >
                <input type="radio" name="understanding" value={i + 1} defaultChecked={lesson?.understanding === i + 1} className="sr-only" />
                <span className="num text-[17px] font-semibold">{i + 1}</span>
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="label">Geübte Fähigkeiten</legend>
          <span className="text-[12px] text-ink-3">Das Verständnis fließt in den Fortschritt dieser Fähigkeiten ein.</span>
          <SkillPicker skills={skills} selected={lesson?.skill_ids} />
        </fieldset>
        <label className="field">
          <span className="label">Beobachtungen</span>
          <textarea className="input" name="tutor_notes" defaultValue={lesson?.tutor_notes} placeholder="Arbeitshaltung, Stimmung, Absprachen" />
          <span className="text-[12px] text-ink-3">Steht zusammen mit Tag, Lehrer, Schüler und Thema in der Abrechnung.</span>
        </label>
        <label className="field">
          <span className="label">Was soll beim nächsten Mal gemacht werden?</span>
          <textarea className="input" name="next_steps" defaultValue={lesson?.next_steps} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary">Speichern</button>
        </div>
      </form>
      <aside className="space-y-6">
        {previous && (
          <div className="panel px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink-2">Vorgenommen in der letzten Stunde</h2>
            <p className="mt-1 whitespace-pre-line">{previous.next_steps}</p>
            {previous.mistakes && (
              <>
                <h2 className="mt-3 text-[13px] font-semibold text-ink-2">Fehler zuletzt</h2>
                <p className="mt-1 whitespace-pre-line text-red">{previous.mistakes}</p>
              </>
            )}
          </div>
        )}
        {lesson && (
          <form action={deleteLessonAction.bind(null, lesson.id, student.id)}>
            <button className="btn btn-danger btn-sm">Stunde löschen</button>
          </form>
        )}
      </aside>
    </div>
  );
}
