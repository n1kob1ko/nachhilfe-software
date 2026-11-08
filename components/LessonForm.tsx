import { deleteLessonAction, saveLessonAction } from "@/app/actions";
import { EinzelterminPruefung } from "@/components/EinzelterminPruefung";
import { FachFeld } from "@/components/FachFeld";
import { FehlerZeilen } from "@/components/FehlerZeilen";
import { SkillPicker } from "@/components/SkillPicker";
import { practiceOnDay } from "@/lib/autodoc";
import { currentTeacher } from "@/lib/auth";
import { beobachtungenText, gemachtText, type EinheitEntwurf } from "@/lib/einheit-aus-text-regeln";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";

const UNDERSTANDING = ["nicht verstanden", "kaum", "teilweise", "gut", "sehr gut"];

function localNow() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/**
 * `vorgabe`: Datum, Uhrzeit und Dauer eines Wochenplan-Platzes beim Nachtragen (app/(tutor)/schueler/[id]/stunden/neu).
 * `entwurf`: was „Aus Text übernehmen“ (lib/einheit-aus-text.ts) aus einer Zusammenfassung gemacht hat; dann stehen die Fehler
 * einzeln mit Fähigkeit und Fehlerart da, und ein besprochenes Prüfungsergebnis kann gleich mit eingetragen werden.
 */
export async function LessonForm({
  student,
  lesson,
  fehler,
  vorgabe,
  entwurf,
}: {
  student: repo.Student;
  lesson?: repo.Lesson;
  fehler?: string;
  vorgabe?: { starts_at: string; duration_min: number };
  entwurf?: EinheitEntwurf & { id: number; pruefungen: repo.TestResult[] };
}) {
  const subjects = student.subjects.length ? student.subjects : ["Mathematik"];
  const skills = repo.listSkills().filter((s) => subjects.includes(s.subject));
  const previous = repo.listLessons(student.id).find((l) => l.kind === "stunde" && l.status === "abgeschlossen" && l.id !== lesson?.id && l.next_steps);
  const documenting = !lesson || lesson.status === "geplant";
  const teachers = repo.listTeachers();
  const me = await currentTeacher();
  // what the student practised on their own that day goes straight into the documentation
  const startsAt = lesson?.starts_at ?? (entwurf?.datum ? `${entwurf.datum}T${(vorgabe?.starts_at ?? localNow()).slice(11, 16)}` : undefined) ?? vorgabe?.starts_at ?? localNow();
  const day = startsAt.slice(0, 10);
  const practice = documenting ? practiceOnDay(student.id, day) : [];
  const prefill = (pick: (l: repo.Lesson) => string) => practice.map(pick).filter(Boolean).join("\n");
  const activities = lesson?.activities || [entwurf ? gemachtText(entwurf) : "", prefill((l) => l.activities)].filter(Boolean).join("\n");
  const mistakes = lesson?.mistakes || prefill((l) => l.mistakes);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form action={saveLessonAction} className="grid gap-6">
        {lesson && <input type="hidden" name="id" value={lesson.id} />}
        <input type="hidden" name="student_id" value={student.id} />
        {entwurf && <input type="hidden" name="entwurf_id" value={entwurf.id} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_120px_1fr]">
          <label className="field">
            <span className="label">Datum und Uhrzeit</span>
            <input className="input num" type="datetime-local" name="starts_at" required defaultValue={startsAt} />
          </label>
          <label className="field">
            <span className="label">Dauer (min)</span>
            <input className="input num" type="number" name="duration_min" min={15} step={5} defaultValue={lesson?.duration_min || vorgabe?.duration_min || 60} />
          </label>
          <label className="field">
            <span className="label">Fach</span>
            <FachFeld id="einheit" eigene={student.subjects} wert={lesson?.subject ?? entwurf?.fach ?? subjects[0]} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
          <label className="field">
            <span className="label">Thema</span>
            <input className="input" name="topic" defaultValue={lesson?.topic ?? entwurf?.thema} placeholder="z. B. Division von Brüchen" />
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
            <select className="input" name="teacher_id" defaultValue={lesson?.teacher_id ?? me?.id ?? student.teacher_id ?? ""}>
              <option value="">noch offen</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="-mt-2 flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] text-ink-2">
          <input type="checkbox" name="gleichzeitig" value="1" className="h-4 w-4 accent-[var(--accent)]" />
          Gleichzeitig mit einem anderen Schüler (nur bei „geplant“: der Lehrer hat zu dieser Zeit zwei Schüler)
        </label>
        {practice.length > 0 && (
          <p className="-mt-2 rounded-lg bg-accent-wash px-3 py-2 text-[13px] text-accent">
            {student.name.split(" ")[0]} hat selbstständig geübt. Inhalte und Fehler sind schon eingetragen.
          </p>
        )}
        <label className="field">
          <span className="label">Was wurde gemacht?</span>
          <textarea className="input" name="activities" defaultValue={activities} placeholder="Inhalte, Übungen, Methoden" />
        </label>
        {entwurf ? (
          <>
            <fieldset className="field">
              <legend className="label">Welche Fehler sind passiert?</legend>
              <span className="text-[12px] text-ink-3">Jeder Fehler zählt in der Fehleranalyse und wird eine Erkenntnis: der Schwerpunkt für die nächsten Übungen.</span>
              {mistakes && <input type="hidden" name="mistakes" value={mistakes} />}
              <FehlerZeilen start={entwurf.fehler} skills={skills.map((s) => ({ id: s.id, name: s.name, area: `${s.subject} › ${s.area}` }))} />
            </fieldset>
            <label className="field">
              <span className="label">Was lief gut?</span>
              <textarea className="input" name="ek_gut" defaultValue={entwurf.gut.join("\n")} placeholder="Ein Punkt pro Zeile" />
              <span className="text-[12px] text-ink-3">Kommt zu den Beobachtungen und wird als Stärke gemerkt.</span>
            </label>
          </>
        ) : (
          <label className="field">
            <span className="label">Welche Fehler sind passiert?</span>
            <textarea className="input" name="mistakes" defaultValue={mistakes} placeholder={"Ein Fehler pro Zeile, z. B.\nKehrwert vergessen\nVorzeichen beim Umformen"} />
            <span className="text-[12px] text-ink-3">Jede Zeile wird in der Fehleranalyse mitgezählt.</span>
          </label>
        )}
        <fieldset className="field">
          <legend className="label mb-1.5">Wie gut wurde das Thema verstanden?</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {UNDERSTANDING.map((label, i) => (
              <label
                key={label}
                className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-line-strong bg-surface px-2 py-2 text-center text-[12px] text-ink-2 has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent"
              >
                <input type="radio" name="understanding" value={i + 1} defaultChecked={(lesson?.understanding ?? entwurf?.verstaendnis) === i + 1} className="sr-only" />
                <span className="num text-[17px] font-semibold">{i + 1}</span>
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="label">Geübte Fähigkeiten</legend>
          <span className="text-[12px] text-ink-3">Das Verständnis fließt in den Fortschritt dieser Fähigkeiten ein.</span>
          <SkillPicker skills={skills} selected={lesson?.skill_ids ?? entwurf?.skillIds} />
        </fieldset>
        <label className="field">
          <span className="label">Beobachtungen</span>
          <textarea className="input" name="tutor_notes" defaultValue={lesson?.tutor_notes ?? (entwurf ? beobachtungenText({ ...entwurf, gut: [] }) : undefined)} placeholder="Arbeitshaltung, Stimmung, Absprachen" />
          <span className="text-[12px] text-ink-3">Steht zusammen mit Tag, Lehrer, Schüler und Thema in der Abrechnung.</span>
        </label>
        <label className="field">
          <span className="label">Was soll beim nächsten Mal gemacht werden?</span>
          <textarea className="input" name="next_steps" defaultValue={lesson?.next_steps ?? entwurf?.naechstesMal} />
        </label>
        {entwurf?.pruefung && <PruefungAusText p={entwurf.pruefung} pruefungen={entwurf.pruefungen} tag={day} />}
        {/* geplante Einheiten werden auf Überschneidung geprüft (Plan 3.3); die Absage steht beim Knopf */}
        <EinzelterminPruefung fehler={fehler} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary">Speichern</button>
        </div>
      </form>
      <aside className="space-y-6">
        {previous && (
          <div className="panel px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink-2">Vorgenommen in der letzten Einheit</h2>
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
            <button className="btn btn-danger btn-sm">Einheit löschen</button>
          </form>
        )}
      </aside>
    </div>
  );
}

const fmtZahl = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

/** Ein besprochenes Prüfungsergebnis aus dem Text: bei einer eingetragenen Prüfung ohne Note oder als neue Prüfung. */
function PruefungAusText({ p, pruefungen, tag }: { p: NonNullable<EinheitEntwurf["pruefung"]>; pruefungen: repo.TestResult[]; tag: string }) {
  const heute = wienerDatum();
  return (
    <fieldset className="field rounded-lg border border-line bg-paper p-3" data-testid="pruefung-aus-text">
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" name="pr_an" value="1" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
        {p.art}-Ergebnis eintragen
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <label className="field">
          <span className="label">Prüfung</span>
          <select className="input" name="pr_test" defaultValue={pruefungen[0]?.id ?? "neu"}>
            {pruefungen.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || t.kind} {t.subject}, {t.date.split("-").reverse().join(".")}
              </option>
            ))}
            <option value="neu">Neu eintragen</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Datum (bei neu)</span>
          <input className="input num" type="date" name="pr_datum" max={heute} defaultValue={tag <= heute ? tag : heute} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="field">
          <span className="label">Punkte</span>
          <input className="input num" name="pr_punkte" inputMode="decimal" defaultValue={fmtZahl(p.punkte)} />
        </label>
        <label className="field">
          <span className="label">von</span>
          <input className="input num" name="pr_max" inputMode="decimal" defaultValue={fmtZahl(p.max)} />
        </label>
        <label className="field">
          <span className="label">Note</span>
          <input className="input num" name="pr_note" type="number" min={1} max={5} defaultValue={p.note ?? ""} />
        </label>
      </div>
      <input type="hidden" name="pr_art" value={p.art} />
      <input type="hidden" name="pr_teile" value={p.teile.join("\n")} />
      {p.teile.length > 0 && <p className="text-[13px] text-ink-2">Teile: {p.teile.join(" · ")}</p>}
    </fieldset>
  );
}
