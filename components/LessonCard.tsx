import Link from "next/link";
import { Pill, formatDate } from "@/components/ui";
import * as repo from "@/lib/repo";

export function LessonCard({ lesson, studentId }: { lesson: repo.Lesson; studentId: number }) {
  const skills = repo.listSkills();
  const auto = lesson.kind === "selbststaendig";
  const teacher = auto ? null : repo.getTeacher(lesson.teacher_id);
  return (
    <article className={`panel px-5 py-4 ${auto ? "border-dashed" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold">{formatDate(lesson.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          {auto && <Pill>selbstständig geübt · automatisch</Pill>}
          <span className="text-ink-2">
            {lesson.subject}
            {lesson.topic && ` · ${lesson.topic}`} · {lesson.duration_min} min
            {teacher && ` · ${teacher.name}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lesson.status === "geplant" ? <Pill tone="accent">geplant</Pill> : lesson.status === "abgesagt" ? <Pill>abgesagt</Pill> : lesson.understanding ? <Understanding value={lesson.understanding} /> : null}
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
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[150px_1fr]">
          {[
            ["Zusammenfassung", lesson.summary],
            ["Gemacht", lesson.activities],
            ["Fehler", lesson.mistakes],
            ["Beobachtungen", lesson.tutor_notes],
            ["Nächstes Mal", lesson.next_steps],
            ["Fähigkeiten", lesson.skill_ids.map((id) => skills.find((s) => s.id === id)?.name ?? id).join(", ")],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className={`whitespace-pre-line ${k === "Fehler" ? "text-red" : ""}`}>{v}</dd>
              </div>
            ))}
        </dl>
      )}
    </article>
  );
}

export function Understanding({ value }: { value: number }) {
  const labels = ["", "nicht verstanden", "kaum verstanden", "teilweise verstanden", "gut verstanden", "sehr gut verstanden"];
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-ink-2" title={`Verständnis ${value}/5`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i <= value ? "bg-[var(--bar)]" : "bg-[var(--bar-track)]"}`} />
        ))}
      </span>
      {labels[value]}
    </span>
  );
}

