import Link from "next/link";
import { notFound } from "next/navigation";
import { runningUnitForStudent } from "@/lib/units";
import { CheckCircle2, CircleDashed, Lightbulb, Plus, XCircle } from "lucide-react";
import { deleteAssignmentAction } from "@/app/actions";
import { answerText } from "@/components/TaskPreview";
import { ErrorTypeSelect } from "@/components/ErrorTypeSelect";
import { PageHeader, formatDate, formatDuration } from "@/components/ui";
import * as repo from "@/lib/repo";
import { GAP, HINT_LABELS } from "@/lib/tasks";

function shownAnswer(t: repo.Task, raw: string) {
  if (t.data.options) {
    const i = Number(raw);
    return Number.isInteger(i) && t.data.options[i] !== undefined ? `${String.fromCharCode(97 + i)}) ${t.data.options[i]}` : raw;
  }
  if (t.data.steps) {
    try {
      return (JSON.parse(raw) as number[]).map((i, n) => `${n + 1}. ${t.data.steps![i]}`).join("  ");
    } catch {
      return raw;
    }
  }
  if (t.answer.blanks) {
    try {
      return (JSON.parse(raw) as string[]).join(" · ");
    } catch {
      return raw;
    }
  }
  return raw;
}

export default async function ResultPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  const student = repo.getStudent(Number(id));
  const assignment = repo.getAssignment(Number(aid));
  if (!student || !assignment || assignment.student_id !== student.id) notFound();
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const tasks = repo.listTasks(w.id);
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  const finals = attempts.filter((a) => a.final);
  const hintUses = repo.hintUsesForAssignment(assignment.id);
  const correct = finals.filter((a) => a.correct).length;
  const totalSec = Math.round(attempts.reduce((s, a) => s + a.time_ms, 0) / 1000);
  const withHelp = finals.filter((a) => a.hints_used > 0 || a.solution_viewed).length;
  const unit = runningUnitForStudent(student.id);

  return (
    <>
      <PageHeader
        back={{ href: `/schueler/${student.id}?tab=uebungen`, label: student.name }}
        title={w.title}
        subtitle={`${student.name} · gesendet am ${formatDate(assignment.assigned_at)}${assignment.completed_at ? ` · fertig am ${formatDate(assignment.completed_at)}` : ""}`}
      />
      <div className="no-print -mt-2 mb-8 flex flex-wrap gap-3">
        <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary btn-lg">
          <Plus size={18} aria-hidden /> Nächste Übung erstellen
        </Link>
        {unit && (
          <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary btn-lg">
            Zurück zur Einheit
          </Link>
        )}
      </div>
      {assignment.note && <p className="-mt-4 mb-6 text-[14px] text-ink-2">{assignment.note}</p>}
      <dl className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Richtig", `${correct} von ${tasks.length}`],
          ["Bearbeitet", `${finals.length} von ${tasks.length}`],
          ["Zeit gesamt", formatDuration(totalSec)],
          ["Mit Hilfe gelöst", `${withHelp}`],
        ].map(([k, v]) => (
          <div key={k} className="panel px-4 py-3">
            <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
            <dd className="num mt-0.5 text-[20px] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <ol className="panel divide-y divide-line">
        {tasks.map((t, i) => {
          const tries = attempts.filter((a) => a.task_id === t.id);
          const fin = tries.find((a) => a.final);
          const status = !fin
            ? { icon: CircleDashed, cls: "text-ink-3", text: "nicht bearbeitet" }
            : fin.solution_viewed
              ? { icon: XCircle, cls: "text-red", text: "Lösung angesehen" }
              : fin.correct
                ? { icon: CheckCircle2, cls: "text-green", text: fin.attempt_no === 1 ? "im 1. Versuch richtig" : `richtig nach ${fin.attempt_no} Versuchen` }
                : { icon: XCircle, cls: "text-red", text: "falsch" };
          const Icon = status.icon;
          const time = Math.round(tries.reduce((s, a) => s + a.time_ms, 0) / 1000);
          return (
            <li key={t.id} className="grid gap-3 px-5 py-4 md:grid-cols-[32px_1fr_220px]">
              <span className="num font-semibold text-ink-3">{i + 1}.</span>
              <div className="min-w-0">
                <p className="max-w-[70ch] whitespace-pre-line">{t.prompt.split(GAP).join("____")}</p>
                {tries.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[14px]">
                    {tries.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-ink-3">Versuch {a.attempt_no}:</span>
                        <span className={a.correct ? "text-green" : "text-red"}>{a.solution_viewed ? "aufgegeben" : shownAnswer(t, a.answer) || "–"}</span>
                        {a.error_label && <span className="text-ink-2">→ {a.error_label}</span>}
                        {!a.correct && !a.solution_viewed && (
                          <span className="no-print">
                            <ErrorTypeSelect attemptId={a.id} type={a.error_type ?? null} source={a.error_type_source ?? null} suggested={a.error_type_suggested ?? null} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {answerText(t) && <p className="mt-1 text-[13px] text-ink-3">Richtige Lösung: {answerText(t)}</p>}
              </div>
              <div className="space-y-1 text-[13px] md:text-right">
                <p className={`inline-flex items-center gap-1.5 font-semibold ${status.cls}`}>
                  <Icon size={15} aria-hidden /> {status.text}
                </p>
                {fin && <p className="num text-ink-2">{formatDuration(time)}</p>}
                {(() => {
                  // which hints were opened (stored per hint), older answers only have the count
                  const used = [...new Set(hintUses.filter((h) => h.task_id === t.id).map((h) => h.hint_index))].sort();
                  const n = used.length || fin?.hints_used || 0;
                  if (!n) return null;
                  return (
                    <p className="inline-flex items-center gap-1 text-amber" title={used.map((h) => `Hilfe ${h + 1}: ${t.hints[h] ?? ""}`).join("\n")}>
                      <Lightbulb size={13} aria-hidden />
                      {used.length ? used.map((h) => `Hilfe ${h + 1}${HINT_LABELS[h] ? ` (${HINT_LABELS[h]})` : ""}`).join(", ") : `${n} ${n === 1 ? "Hilfe" : "Hilfen"}`}
                    </p>
                  );
                })()}
              </div>
            </li>
          );
        })}
      </ol>
      <form action={deleteAssignmentAction.bind(null, assignment.id, student.id)} className="mt-8">
        <button className="btn btn-danger btn-sm">Übung beim Schüler entfernen (mit Ergebnissen)</button>
      </form>
    </>
  );
}
