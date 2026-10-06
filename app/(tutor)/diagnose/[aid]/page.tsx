import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { applyRecommendationAction } from "@/app/actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIAGNOSIS_STATUS_LABEL, DIAGNOSIS_TONE, diagnosisResult, type DiagnosisSkillResult, type DiagnosisStatus } from "@/lib/diagnose";
import { errorTypeLabel } from "@/lib/error-types";
import { dayOf } from "@/lib/exams";
import { RULE_LABEL, RULE_TONE } from "@/lib/recommend";
import { klassenLabel } from "@/lib/school";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Diagnose" };

const pct = (m: number | null) => (m === null ? "–" : `${Math.round(m * 100)} %`);
const GROUPS: DiagnosisStatus[] = ["sicher", "unsicher", "kritisch", "offen"];
const builder = (studentId: number, skillId: string, count = 6) => `/uebungen/neu?schueler=${studentId}&skill=${encodeURIComponent(skillId)}&anzahl=${count}`;

/**
 * Result of a diagnosis: sichere, unsichere and kritische Fähigkeiten, possible gaps and the next
 * exercises. While the student is still working it shows what is there so far.
 */
export default async function DiagnosisResultPage({ params, searchParams }: { params: Promise<{ aid: string }>; searchParams: Promise<{ hinweis?: string; fehler?: string }> }) {
  await requireTeacher();
  const { aid } = await params;
  const sp = await searchParams;
  const r = diagnosisResult(Number(aid), { today: dayOf(new Date()) });
  if (!r) notFound();
  const { student, worksheet: w } = r;
  const first = student.name.split(" ")[0];
  const unit = runningUnitForStudent(student.id);
  const groups = GROUPS.map((g) => ({ g, list: r.skills.filter((s) => s.status === g) })).filter((x) => x.list.length > 0);

  return (
    <>
      <PageHeader
        back={{ href: `/schueler/${student.id}?tab=fortschritt`, label: student.name }}
        title={`Diagnose: ${w.topic}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">Diagnose</Pill>
            {student.name} · {w.subject}
            {w.klasse ? ` · ${klassenLabel(w.school_type, w.klasse)}` : ""} · {formatDate(r.assignment.assigned_at)}
          </span>
        }
      />
      {sp.hinweis === "ki" && <p className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber">Claude war nicht erreichbar. Fehlende Aufgaben kommen aus den eingebauten Generatoren.</p>}
      {sp.fehler && (
        <p className="mb-6 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}

      <section className="mb-10 rounded-[24px] bg-accent-wash px-5 py-5 md:px-6" aria-label="Stand">
        {r.finished ? (
          <h2 className="text-[18px] font-semibold">
            {first} hat alle <span className="num">{r.total}</span> Aufgaben bearbeitet.
          </h2>
        ) : (
          <>
            <h2 className="mb-1 text-[18px] font-semibold">
              {r.done === 0 ? `${first} hat noch nicht begonnen` : `${first} ist dabei`}: <span className="num">{r.done}</span> von <span className="num">{r.total}</span> Aufgaben
            </h2>
            <p className="text-[14px] text-ink-2">{r.done > 0 ? "Das Ergebnis unten ist vorläufig." : "Das Ergebnis erscheint, sobald Antworten da sind."}</p>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {unit && !r.finished && (
            <Link href={`/einheiten/${unit.id}`} className="btn btn-primary">
              Zur Einheit <ArrowRight size={16} aria-hidden />
            </Link>
          )}
          <Link href={`/schueler/${student.id}/ergebnis/${r.assignment.id}`} className="btn btn-secondary">
            Antworten im Detail
          </Link>
        </div>
      </section>

      {groups.length > 0 && (
        <section className="mb-10" aria-label="Fähigkeiten">
          <SectionTitle>
            <span>
              Fähigkeiten
              <Info label="Wie wird eingestuft?">
                Je Fähigkeit zählen die Diagnose-Aufgaben, schwere stärker als leichte. Sicher: fast alles beim ersten Versuch richtig. Kritisch: kaum etwas richtig. Dazwischen: unsicher. Der Lernstand rechts berücksichtigt alles, was es zu {first} schon gibt.
              </Info>
            </span>
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            {groups.map(({ g, list }) => (
              <div key={g} className="panel px-4 py-4">
                <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
                  <Pill tone={DIAGNOSIS_TONE[g]}>{DIAGNOSIS_STATUS_LABEL[g]}</Pill>
                  <span className="num text-ink-3">{list.length}</span>
                </h3>
                <ul className="grid gap-3">
                  {list.map((s) => (
                    <SkillRow key={s.skill.id} s={s} studentId={student.id} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.gaps.length > 0 && (
        <section className="mb-10" aria-label="Mögliche Wissenslücken">
          <SectionTitle>
            <span>
              Mögliche Wissenslücken
              <Info label="Wie entstehen die Wissenslücken?">Voraussetzungen der unsicheren und kritischen Fähigkeiten, die selbst schwach oder noch nie geprüft sind. Die Voraussetzungen pflegst du bei jeder Fähigkeit.</Info>
            </span>
          </SectionTitle>
          <ul className="panel divide-y divide-line">
            {r.gaps.map((g) => (
              <li key={g.skill.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link href={`/faehigkeiten/${encodeURIComponent(g.skill.id)}`} className="font-medium hover:text-accent">
                    {g.skill.name}
                  </Link>
                  <span className="block text-[13px] text-ink-2">Voraussetzung für {g.for.map((x) => x.name).join(", ")}</span>
                </span>
                <Pill tone={g.inDiagnosis || (g.mastery ?? 1) < 0.5 ? "red" : "amber"}>{g.reason}</Pill>
                <Link href={builder(student.id, g.skill.id, g.mastery === null ? 4 : 6)} className="btn btn-ghost btn-sm">
                  {g.mastery === null && !g.inDiagnosis ? "Kurz prüfen" : "Übung erstellen"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.next.length > 0 && r.done > 0 && (
        <section aria-label="Empfohlene nächste Übungen">
          <SectionTitle>Empfohlene nächste Übungen</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {r.next.map((n) => (
              <li key={n.key} className="panel px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={RULE_TONE[n.rule]}>{n.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[n.rule]}</Pill>
                  <span className="font-semibold">{n.skill.name}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] text-ink-2">{n.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={builder(student.id, n.skill.id, n.count)} className="btn btn-primary btn-sm">
                    Übung erstellen
                  </Link>
                  {!n.openAssignmentId && (
                    <form action={applyRecommendationAction.bind(null, student.id, n.key, r.assignment.id)}>
                      <button className="btn btn-secondary btn-sm">Direkt an {first} senden</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SkillRow({ s, studentId }: { s: DiagnosisSkillResult; studentId: number }) {
  const errors = [...new Set(s.tasks.map((t) => (t.errorType ? errorTypeLabel(t.errorType) : t.errorLabel)).filter(Boolean))];
  return (
    <li>
      <Link href={`/faehigkeiten/${encodeURIComponent(s.skill.id)}`} className="font-medium hover:text-accent">
        {s.skill.name}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
        {s.tasks.map((t) => (
          <span
            key={t.taskId}
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 ${t.correct === true ? "bg-green-wash text-green" : t.correct === false ? "bg-red-wash text-red" : "bg-panel text-ink-3"}`}
          >
            {t.correct === true ? <Check size={11} aria-hidden /> : t.correct === false ? <X size={11} aria-hidden /> : <Minus size={11} aria-hidden />}
            {t.difficulty}
            <span className="sr-only">: {t.correct === true ? "richtig" : t.correct === false ? "falsch" : "offen"}</span>
            {t.tries > 1 && <span className="num">· {t.tries} Versuche</span>}
            {t.hints > 0 && (
              <span className="num">
                · {t.hints} {t.hints === 1 ? "Hilfe" : "Hilfen"}
              </span>
            )}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Lernstand jetzt {pct(s.mastery)}
        {errors.length > 0 && ` · ${errors.join(", ")}`}
      </p>
      {s.status !== "sicher" && s.status !== "offen" && (
        <Link href={builder(studentId, s.skill.id)} className="mt-1 inline-flex min-h-[32px] items-center text-[13px] font-semibold text-accent hover:underline">
          Übung erstellen ›
        </Link>
      )}
    </li>
  );
}
