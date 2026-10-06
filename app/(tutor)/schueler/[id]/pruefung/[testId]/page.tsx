import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { setExamSkillsAction } from "@/app/curriculum-actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, Reveal, SectionTitle, StatusChip, formatDate } from "@/components/ui";
import { dayOf, examPrep, PLAN_COUNTS, STAGE_LABEL, STAGE_TONE } from "@/lib/exams";
import { matchSkills } from "@/lib/lehrplan";

export const metadata = { title: "Vorbereitung" };

/** "Vorbereitung starten": days left, Stoff, Lernstand per skill, untested skills and a rule-based plan. */
export default async function ExamPrepPage({ params }: { params: Promise<{ id: string; testId: string }> }) {
  const { id, testId } = await params;
  const prep = examPrep(Number(testId), dayOf(new Date()));
  if (!prep || prep.student.id !== Number(id)) notFound();
  const { test, student, days, stage, skills, untested, plan, totalTasks } = prep;
  const first = student.name.split(" ")[0];
  const when = days < 0 ? "vorbei" : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`;
  // topics of the exam that are not linked to a skill yet: suggestions to tick
  const suggestions = (test.topics?.length ? test.topics : [test.topic].filter(Boolean)).map((topic) => ({
    topic,
    skills: matchSkills(topic, test.subject, { student, limit: 6 }).map((m) => m.skill),
  }));
  const offered = [...new Map([...skills.map((s) => s.skill), ...suggestions.flatMap((s) => s.skills)].map((s) => [s.id, s])).values()];
  const builder = `/uebungen/neu?schueler=${student.id}&skills=${plan.map((p) => encodeURIComponent(p.skill.id)).join(",")}&anzahl=${Math.min(30, totalTasks)}`;

  return (
    <>
      <PageHeader
        title={`Vorbereitung: ${test.title || `${test.kind} ${test.subject}`}`}
        back={{ href: `/schueler/${student.id}?tab=schule`, label: student.name }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <CalendarClock size={16} aria-hidden />
            <span className="num">{formatDate(test.date, { weekday: "long", day: "numeric", month: "long" })}</span> · {when}
            {stage && <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>}
          </span>
        }
      />
      <div className="grid max-w-[920px] grid-cols-[minmax(0,1fr)] gap-10">
        {(test.topics?.length ?? 0) > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-[15px]">
            <span className="font-medium text-ink-2">Stoff:</span>
            {test.topics!.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </p>
        )}

        <section aria-label="Plan">
          <SectionTitle
            action={
              plan.length > 0 && (
                <Link href={builder} className="btn btn-primary">
                  <Plus size={17} aria-hidden /> Übung erstellen
                </Link>
              )
            }
          >
            <span>
              Plan · <span className="num">{totalTasks}</span> Aufgaben
              <Info label="Wie entsteht der Plan?">
                Regeln ohne KI: zuerst unsichere Voraussetzungen (je 3 Aufgaben), dann jede Prüfungs-Fähigkeit nach Lernstand: kritisch {PLAN_COUNTS.kritisch}, üben {PLAN_COUNTS["üben"]}, nicht getestet {PLAN_COUNTS["nicht getestet"]}, gut {PLAN_COUNTS.gut}, sicher {PLAN_COUNTS.sicher}. In den letzten 3 Tagen fallen sichere Fähigkeiten weg.
              </Info>
            </span>
          </SectionTitle>
          {plan.length === 0 ? (
            <p className="text-[14px] text-ink-3">Noch keine Fähigkeiten verknüpft. Unten den Stoff zuordnen, dann entsteht der Plan.</p>
          ) : (
            <ol className="panel divide-y divide-line">
              {plan.map((p) => (
                <li key={p.skill.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="num w-9 shrink-0 text-[17px] font-semibold">{p.count}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.skill.name}</span>
                    <span className="block text-[13px] text-ink-2">
                      {p.skill.area} · {p.reason} · {p.difficulty}
                    </span>
                  </span>
                  <Link href={`/uebungen/neu?schueler=${student.id}&skill=${encodeURIComponent(p.skill.id)}&anzahl=${p.count}`} className="btn btn-ghost btn-sm">
                    Nur diese
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-label="Lernstand im Stoff">
          <SectionTitle>Lernstand im Stoff</SectionTitle>
          {skills.length === 0 ? (
            <p className="text-[14px] text-ink-3">–</p>
          ) : (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
              {skills.map((s) => (
                <li key={s.skill.id} className="inline-flex items-center gap-1.5">
                  {s.skill.name} <StatusChip mastery={s.mastery} />
                </li>
              ))}
            </ul>
          )}
          {untested.length > 0 && (
            <p className="mt-3 text-[14px] text-ink-2">
              Noch nicht getestet: {untested.map((s) => s.skill.name).join(", ")}. Der Plan beginnt dort mit einer kurzen Überprüfung.
            </p>
          )}
        </section>

        <Reveal label={skills.length ? "Fähigkeiten der Prüfung ändern" : "Stoff zu Fähigkeiten zuordnen"}>
          <form action={setExamSkillsAction.bind(null, test.id)} className="panel grid gap-3 px-4 py-4">
            {suggestions.some((s) => s.skills.length === 0) && (
              <p className="text-[13px] text-ink-3">Ohne Vorschlag: {suggestions.filter((s) => s.skills.length === 0).map((s) => s.topic).join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {offered.map((s) => (
                <label key={s.id} className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash">
                  <input type="checkbox" name="skill_ids" value={s.id} defaultChecked={test.skill_ids.includes(s.id)} className="accent-[var(--accent)]" />
                  {s.name}
                  <span className="text-ink-3">· {s.area}</span>
                </label>
              ))}
              {offered.length === 0 && <p className="text-[13px] text-ink-3">Keine passenden Fähigkeiten gefunden. Unter Mehr › Themen und Fähigkeiten lassen sich eigene anlegen.</p>}
            </div>
            <button className="btn btn-secondary justify-self-start">Speichern</button>
          </form>
        </Reveal>
        <p className="text-[13px] text-ink-3">Vorschläge kommen aus dem Stoff, den du eingetragen hast. Verknüpft wird nur, was du für {first} anhakst.</p>
      </div>
    </>
  );
}
