import { ExternalLink } from "lucide-react";
import { Pill, SectionTitle, formatTime } from "@/components/ui";
import * as repo from "@/lib/repo";
import type { UnitView } from "@/lib/units";

/** Exercises of a running unit: open ones and those already worked on in this unit. */
export function UnitExercises({ unit }: { unit: UnitView }) {
  const student = repo.getStudent(unit.student_id)!;
  const attempts = repo.listAttemptsForUnit(unit.id);
  const lastBy = new Map<number, string>();
  for (const a of attempts) if (!lastBy.has(a.assignment_id) || a.created_at > lastBy.get(a.assignment_id)!) lastBy.set(a.assignment_id, a.created_at);
  const rows = repo.listAssignments(unit.student_id).filter((a) => !a.completed_at || lastBy.has(a.id));
  return (
    <section className="mb-10">
      <SectionTitle
        action={
          <a href={`/lernen/${student.access_token}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <ExternalLink size={14} aria-hidden /> Übungsmodus öffnen
          </a>
        }
      >
        Laufende Übungen
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="text-[14px] text-ink-2">Keine offene Übung. Erstelle oder weise eine Übung zu, damit {student.name.split(" ")[0]} im Übungsmodus arbeiten kann.</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]">
              <span className="min-w-0 flex-1 font-medium">{a.title}</span>
              <span className="num text-ink-2">
                {a.done_count}/{a.task_count} Aufgaben
              </span>
              {lastBy.has(a.id) ? (
                <Pill tone="accent">zuletzt {formatTime(lastBy.get(a.id)!)}</Pill>
              ) : a.started_at ? (
                <Pill>begonnen</Pill>
              ) : (
                <Pill>noch nicht begonnen</Pill>
              )}
              {a.completed_at && <Pill tone="green">fertig</Pill>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
