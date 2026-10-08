import Link from "next/link";
import { notFound } from "next/navigation";
import { runningUnitForStudent } from "@/lib/units";
import { CheckCircle2, CircleDashed, Lightbulb, Plus, XCircle } from "lucide-react";
import { deleteAssignmentAction } from "@/app/actions";
import { answerText } from "@/components/TaskPreview";
import { ErrorTypeSelect } from "@/components/ErrorTypeSelect";
import { FixCompare } from "@/components/FixMarks";
import { closestVersion } from "@/lib/fix-text";
import { ReviewButtons } from "@/components/ReviewButtons";
import { PageHeader, formatDate, formatDuration } from "@/components/ui";
import * as repo from "@/lib/repo";
import { GAP, HINT_LABELS, REVIEWS, TEACHER_GRADED, isReview } from "@/lib/tasks";
import { MathText } from "@/components/MathText";
import { MathWork } from "@/components/MathWork";
import { readMathAnswer } from "@/lib/math-check";
import { gradeMathTask } from "@/lib/math-task";

const isMath = (t: repo.Task) => t.type === "rechenweg" || t.type === "sachaufgabe";

function shownAnswer(t: repo.Task, raw: string) {
  if (isMath(t)) {
    // the short form per try; the full working of the last try is shown below
    const a = readMathAnswer(raw);
    if (t.type === "sachaufgabe") return (t.data.parts ?? []).map((p, i) => `${p.label || `${String.fromCharCode(97 + i)})`} ${(p.kind === "text" ? a.parts?.[i]?.text : a.parts?.[i]?.result) || "–"}`).join("  ·  ");
    const steps = a.steps?.filter((l) => l.trim()).length ?? 0;
    return `${a.result?.trim() || "kein Ergebnis"}${steps ? ` (${steps} ${steps === 1 ? "Zeile" : "Zeilen"} Rechenweg)` : a.board ? " (Rechenweg am Whiteboard)" : ""}`;
  }
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
  const toReview = finals.filter((a) => a.review === "offen").length;
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
        {w.kind === "diagnose" && (
          <Link href={`/diagnose/${assignment.id}`} className="btn btn-secondary btn-lg">
            Diagnose-Auswertung
          </Link>
        )}
        {unit && (
          <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary btn-lg">
            Zurück zur Einheit
          </Link>
        )}
      </div>
      {assignment.note && <p className="-mt-4 mb-6 text-[14px] text-ink-2">{assignment.note}</p>}
      <dl className={`mb-8 grid grid-cols-2 gap-4 ${toReview ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        {[
          ["Richtig", `${correct} von ${tasks.length}`],
          ...(toReview ? [["Zu bewerten", `${toReview}`]] : []),
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
              : fin.review === "offen"
                ? { icon: CircleDashed, cls: "text-amber", text: "wartet auf deine Bewertung" }
                : isReview(fin.review)
                  ? { icon: fin.review === "richtig" ? CheckCircle2 : fin.review === "teilweise" ? CircleDashed : XCircle, cls: fin.review === "richtig" ? "text-green" : fin.review === "teilweise" ? "text-amber" : "text-red", text: `${fin.review_by ? "von dir bewertet" : "automatisch"}: ${REVIEWS[fin.review]}` }
                  : fin.correct
                ? { icon: CheckCircle2, cls: "text-green", text: fin.attempt_no === 1 ? "im 1. Versuch richtig" : `richtig nach ${fin.attempt_no} Versuchen` }
                : { icon: XCircle, cls: "text-red", text: "falsch" };
          const Icon = status.icon;
          const time = Math.round(tries.reduce((s, a) => s + a.time_ms, 0) / 1000);
          return (
            <li key={t.id} className="grid gap-3 px-5 py-4 md:grid-cols-[32px_1fr_220px]">
              <span className="num font-semibold text-ink-3">{i + 1}.</span>
              <div className="min-w-0">
                <p className="max-w-[70ch] whitespace-pre-line"><MathText text={t.prompt.split(GAP).join("____")} /></p>
                {t.type === "rechenweg" && t.data.start && (
                  <p className="mt-1 text-[17px] font-semibold">
                    <MathText text={t.data.start} />
                  </p>
                )}
                {tries.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[14px]">
                    {tries.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-ink-3">Versuch {a.attempt_no}:</span>
                        <span className={a.review === "offen" ? "whitespace-pre-line text-ink" : a.review === "teilweise" ? "text-amber" : a.correct ? "text-green" : "text-red"}>{a.solution_viewed ? "aufgegeben" : <MathText text={shownAnswer(t, a.answer) || "–"} />}</span>
                        {a.error_label && <span className="text-ink-2">→ {a.error_label}</span>}
                        {!a.correct && !a.solution_viewed && a.review !== "offen" && (
                          <span className="no-print">
                            <ErrorTypeSelect attemptId={a.id} type={a.error_type ?? null} source={a.error_type_source ?? null} suggested={a.error_type_suggested ?? null} suggestedSource={a.error_type_suggested_source ?? null} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {isMath(t) && tries.length > 0 && !(fin ?? tries[tries.length - 1]).solution_viewed && (() => {
                  const last = fin ?? tries[tries.length - 1];
                  return <MathWork task={t} view={gradeMathTask(t, last.answer).view} board={readMathAnswer(last.answer).board} />;
                })()}
                {isMath(t) && t.solution && (
                  <details className="no-print mt-2 max-w-[70ch] text-[13px]">
                    <summary className="cursor-pointer font-semibold text-ink-2">Lösungsweg</summary>
                    <p className="mt-1 whitespace-pre-line text-ink-2">
                      <MathText text={t.solution} />
                    </p>
                  </details>
                )}
                {t.type === "fix" && fin && !fin.solution_viewed && t.data.faulty && t.answer.accepted?.[0] && (
                  <FixCompare faulty={t.data.faulty} given={fin.answer} expected={closestVersion(t.answer.accepted, fin.answer, t.answer.mode !== "text") ?? t.answer.accepted[0]} caseSensitive={t.answer.mode !== "text"} className="mt-3 max-w-[90ch]" />
                )}
                {(t.type !== "fix" || !fin || Boolean(fin.solution_viewed)) && answerText(t) && <p className="mt-1 text-[13px] text-ink-3">Richtige Lösung: <MathText text={answerText(t)} /></p>}
                {(t.answer.sample || t.answer.criteria?.length) && !answerText(t) ? (
                  <div className="mt-2 max-w-[70ch] rounded-lg bg-paper px-3 py-2 text-[13px] text-ink-2">
                    {t.answer.sample && (
                      <p>
                        <span className="font-semibold">Musterlösung:</span> <MathText text={t.answer.sample} />
                      </p>
                    )}
                    {t.answer.criteria && t.answer.criteria.length > 0 && (
                      <>
                        <p className="mt-1 font-semibold">Darauf kommt es an:</p>
                        <ul className="list-disc pl-5">
                          {t.answer.criteria.map((c, k) => (
                            <li key={k}>{c}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : null}
                {fin && !fin.solution_viewed && (TEACHER_GRADED.has(t.type) || fin.review) && (
                  <div className="mt-3">
                    <ReviewButtons attemptId={fin.id} review={fin.review ?? null} />
                  </div>
                )}
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
