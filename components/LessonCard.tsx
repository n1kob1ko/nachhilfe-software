import Link from "next/link";
import { Pill, Reveal, formatDate } from "@/components/ui";
import * as repo from "@/lib/repo";

/** Rate → chip colour: the score reads at a glance without the teacher doing maths. */
export function rateTone(correct: number, done: number): "green" | "amber" | "red" {
  const r = done ? correct / done : 0;
  return r >= 0.8 ? "green" : r >= 0.6 ? "amber" : "red";
}

/** "Kehrwert vergessen (3×)" lines from a lesson's mistakes field. */
export function mistakeLines(text: string) {
  return text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** One entry of the Lernverlauf that is not a unit: self-practice, a recorded or a planned lesson. Key facts in two lines, the rest under "Details anzeigen". */
export function LessonCard({ lesson, studentId, result }: { lesson: repo.Lesson; studentId: number; result?: { done: number; correct: number } }) {
  const skills = repo.listSkills();
  const auto = lesson.kind === "selbststaendig";
  const teacher = auto ? null : repo.getTeacher(lesson.teacher_id);
  const mistakes = mistakeLines(lesson.mistakes);
  const rows = [
    ["Zusammenfassung", lesson.summary],
    ["Gemacht", lesson.activities],
    ["Fehler", lesson.mistakes],
    ["Beobachtungen", lesson.tutor_notes],
    ["Nächstes Mal", lesson.next_steps],
    ["Verständnis", lesson.understanding ? `${lesson.understanding}/5 · ${UNDERSTANDING[lesson.understanding]}` : ""],
    ["Fähigkeiten", lesson.skill_ids.map((id) => skills.find((s) => s.id === id)?.name ?? id).join(", ")],
  ].filter(([, v]) => v);
  return (
    <article className={`panel px-5 py-3.5 ${auto ? "border-dashed" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[14px]">
          <span className="font-semibold">{formatDate(lesson.starts_at, { weekday: "short", day: "numeric", month: "numeric" })}</span>
          <span className="num text-ink-2">{lesson.duration_min} min</span>
          {teacher && <span className="text-ink-2">{teacher.name}</span>}
          <span className="text-ink-2">{[lesson.subject, lesson.topic].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="flex items-center gap-2">
          {lesson.status === "geplant" ? <Pill tone="accent">geplant</Pill> : lesson.status === "abgesagt" ? <Pill>abgesagt</Pill> : auto ? <Pill>Selbstständig</Pill> : null}
          {auto && lesson.assignment_id ? (
            <Link href={`/schueler/${studentId}/ergebnis/${lesson.assignment_id}`} className="btn btn-ghost btn-sm">
              Ergebnis
            </Link>
          ) : lesson.unit_id ? (
            <Link href={`/einheiten/${lesson.unit_id}`} className="btn btn-ghost btn-sm">
              Einheit
            </Link>
          ) : (
            <Link href={`/schueler/${studentId}/stunden/${lesson.id}`} className="btn btn-ghost btn-sm">
              {lesson.status === "geplant" ? "Dokumentieren" : "Bearbeiten"}
            </Link>
          )}
        </div>
      </div>
      {lesson.status === "abgeschlossen" && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {result && result.done > 0 && (
              <Pill tone={rateTone(result.correct, result.done)}>
                <span className="num">
                  {result.correct}/{result.done}
                </span>{" "}
                richtig
              </Pill>
            )}
            {mistakes.length > 0 && <Pill>Fehlerarten {mistakes.length}</Pill>}
            {lesson.understanding ? <Understanding value={lesson.understanding} /> : null}
            {mistakes.slice(0, 3).map((m) => (
              <Pill key={m} tone="red">
                {m}
              </Pill>
            ))}
          </div>
          {!auto && lesson.next_steps && (
            <p className="mt-1.5 truncate text-[14px]" title={lesson.next_steps}>
              <span className="text-ink-3">Nächstes:</span> {lesson.next_steps}
            </p>
          )}
          {rows.length > 0 && (
            <Reveal label="Details anzeigen" className="mt-1">
              <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[150px_1fr]">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className={`whitespace-pre-line ${k === "Fehler" ? "text-red" : ""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          )}
        </>
      )}
    </article>
  );
}

const UNDERSTANDING = ["", "nicht verstanden", "kaum verstanden", "teilweise verstanden", "gut verstanden", "sehr gut verstanden"];

export function Understanding({ value }: { value: number }) {
  const labels = UNDERSTANDING;
  return (
    <span className="inline-flex items-center gap-1.5 px-1 text-[12px] text-ink-2" title={`Verständnis ${value}/5: ${labels[value]}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i <= value ? "bg-[var(--bar)]" : "bg-[var(--bar-track)]"}`} />
        ))}
      </span>
      <span className="sr-only">Verständnis {value} von 5</span>
    </span>
  );
}
