import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { MasteryBar, TrendBadge, formatDate } from "@/components/ui";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { VergangeneEinheiten } from "@/components/lernen/VergangeneEinheiten";
import { SchuelerNotizFrage } from "@/components/SchuelerNotizFrage";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { notizFuerSchueler } from "@/lib/schueler-notiz";

/**
 * Fortschritt in der Schüler-App: die zuletzt geübten Fähigkeiten mit Stand und Trend, die vergangenen Einheiten,
 * die erledigten Übungen und die eigene Notiz „Was war heute schwer?“ (änderbar bis zur nächsten Einheit).
 */
export default async function FortschrittPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const done = repo.listAssignments(student.id).filter((a) => a.completed_at).slice(0, 6);
  const a = analyzeStudent(student.id)!;
  const practiced = a.skills.filter((s) => s.tasksDone > 0).sort((x, y) => (y.lastPracticed ?? 0) - (x.lastPracticed ?? 0)).slice(0, 6);
  const notiz = notizFuerSchueler(student.id);

  return (
    <>
      <SeitenKopf titel="Dein Fortschritt" text="Was du geübt hast und wie es läuft." />

      {practiced.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-[18px] font-semibold">Deine Fähigkeiten</h2>
          <ul className="panel divide-y divide-line">
            {practiced.map((s) => (
              <li key={s.skill.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[1fr_minmax(120px,220px)_auto]">
                <span>
                  {s.skill.name} <span className="text-ink-3">· {s.skill.area}</span>
                </span>
                <span className="sm:order-last">
                  <TrendBadge trend={s.trend} compact />
                </span>
                <span className="col-span-2 sm:col-span-1">
                  <MasteryBar value={s.mastery} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="panel mt-6 px-5 py-5 text-[15px] text-ink-2">Sobald du Übungen gelöst hast, siehst du hier, wie es läuft.</p>
      )}

      {notiz && (
        <SchuelerNotizFrage
          token={token}
          unitId={notiz.unitId}
          wann={notiz.wann}
          notiz={notiz.notiz && { auswahl: notiz.notiz.auswahl, text: notiz.notiz.text, uebersprungen: notiz.notiz.uebersprungen }}
        />
      )}

      <VergangeneEinheiten studentId={student.id} />

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[18px] font-semibold">Erledigt</h2>
          <ul className="space-y-2">
            {done.map((x) => (
              <li key={x.id} className="flex flex-col gap-x-4 text-[15px] sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-1 shrink-0 text-green" aria-hidden />
                  {x.title}
                </span>
                <span className="num shrink-0 pl-6 text-[14px] text-ink-2 sm:pl-0">
                  {x.correct_count}/{x.task_count} richtig · {formatDate(x.completed_at!, { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
