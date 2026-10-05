import { saveStudentAction } from "@/app/actions";
import { SchoolClassFields } from "@/components/SchoolClassFields";
import { SUBJECTS } from "@/lib/curriculum";
import { listTeachers, type Student } from "@/lib/repo";

export function StudentForm({ student }: { student?: Student }) {
  const teachers = listTeachers();
  const others = student?.subjects.filter((s) => !(SUBJECTS as readonly string[]).includes(s)) ?? [];
  return (
    <form action={saveStudentAction} className="grid max-w-[760px] gap-6">
      {student && <input type="hidden" name="id" value={student.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="field">
          <span className="label">Name</span>
          <input className="input" name="name" required defaultValue={student?.name} autoFocus={!student} />
        </label>
        <label className="field">
          <span className="label">Lehrer</span>
          <select className="input" name="teacher_id" defaultValue={student?.teacher_id ?? teachers[0]?.id ?? ""}>
            <option value="">noch offen</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_200px]">
        <label className="field">
          <span className="label">Schule</span>
          <input className="input" name="school" defaultValue={student?.school} placeholder="z. B. MS Graz-St. Peter" />
        </label>
        <SchoolClassFields type={student?.school_type} klasse={student?.klasse} />
      </div>
      <fieldset className="field">
        <legend className="label mb-1.5">Fächer</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] has-checked:border-accent has-checked:bg-accent-wash">
              <input type="checkbox" name="subjects" value={s} defaultChecked={student?.subjects.includes(s)} className="accent-[var(--accent)]" />
              {s}
            </label>
          ))}
          <input className="input max-w-[240px]" name="subject_other" defaultValue={others.join(", ")} placeholder="Weitere, mit Beistrich getrennt" />
        </div>
      </fieldset>
      <label className="field">
        <span className="label">Aktuelle Themen</span>
        <input className="input" name="current_topics" defaultValue={student?.current_topics} placeholder="z. B. Bruchrechnung, Beistrichsetzung" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">Stärken (eigene Beobachtung)</span>
          <textarea className="input" name="strengths_note" defaultValue={student?.strengths_note} />
        </label>
        <label className="field">
          <span className="label">Schwächen (eigene Beobachtung)</span>
          <textarea className="input" name="weaknesses_note" defaultValue={student?.weaknesses_note} />
        </label>
      </div>
      <label className="field">
        <span className="label">Lernziele</span>
        <textarea className="input" name="goals" defaultValue={student?.goals} placeholder="z. B. Schularbeit im Dezember mindestens Note 3" />
      </label>
      <label className="field">
        <span className="label">Notizen</span>
        <textarea className="input" name="notes" defaultValue={student?.notes} placeholder="Interessen, Lerntyp, Kontakt zu Eltern …" />
      </label>
      <p className="-mt-2 text-[13px] text-ink-3">
        Stärken und Schwächen ergänzt die Software automatisch aus Übungen, Einheiten und Tests.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary">{student ? "Speichern" : "Schüler anlegen"}</button>
      </div>
    </form>
  );
}
