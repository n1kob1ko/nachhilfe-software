import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Check, FileText, Plus, Printer } from "lucide-react";
import { setExamSkillsAction } from "@/app/curriculum-actions";
import { probeschularbeitAction } from "@/app/probeschularbeit-actions";
import { Info } from "@/components/Info";
import { ProbeschularbeitForm } from "@/components/ProbeschularbeitForm";
import { FaehigkeitWaehlen, hauptThema, StoffChip, StoffWahl, StoffZeile } from "@/components/StoffZuordnung";
import { PageHeader, Pill, Reveal, SectionTitle, StatusChip, formatDate } from "@/components/ui";
import { dayOf, examPrep, PLAN_COUNTS, STAGE_LABEL, STAGE_TONE } from "@/lib/exams";
import { aiEnabled } from "@/lib/ai";
import { matchSkills, skillsForStudent, stoffVorschlag } from "@/lib/lehrplan";
import { probeschularbeitenZu, punkteText } from "@/lib/probeschularbeit";
import { stoffDerPruefung } from "@/lib/pruefungsstoff";
import type { Skill } from "@/lib/repo";
import { auftraegeZurPruefung } from "@/lib/schreibauftrag-store";

export const metadata = { title: "Vorbereitung" };

/** "Vorbereitung starten": days left, Stoff, Lernstand per skill, untested skills and a rule-based plan. */
export default async function ExamPrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; testId: string }>;
  searchParams: Promise<{ fehler?: string; ziel?: string; zugeordnet?: string }>;
}) {
  const { id, testId } = await params;
  const sp = await searchParams;
  const prep = examPrep(Number(testId), dayOf(new Date()));
  if (!prep || prep.student.id !== Number(id)) notFound();
  const { test, student, days, stage, skills, untested, plan, totalTasks } = prep;
  const first = student.name.split(" ")[0];
  const when = days < 0 ? "vorbei" : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`;
  const topics = test.topics?.length ? test.topics : [test.topic].filter(Boolean);
  const pool = skillsForStudent(student, test.subject, { earlier: true });
  const names = new Map(pool.map((s) => [s.id, s.name]));
  const label = (s: { name: string; parent_id: string | null }) => (s.parent_id ? `${names.get(s.parent_id) ?? ""} › ${s.name}` : s.name);
  // nothing linked yet (a Stoffzettel saved without ticks): per topic the suggestions, the sure ones ticked
  const zuordnen = test.skill_ids.length === 0;
  const vorschlag = zuordnen ? stoffVorschlag(topics, test.subject, student) : [];
  const thema = hauptThema(vorschlag);
  const chip = (i: number, ticked: boolean) => (s: Skill) => (
    <StoffChip key={s.id} name={`stoff_${i}`} value={s.id} label={label(s)} area={s.area === thema ? undefined : s.area} defaultChecked={ticked} />
  );
  // linked already: the linked skills and the suggestions for the topics, to change
  const offered = zuordnen ? [] : [...new Map([...skills.map((s) => s.skill), ...topics.flatMap((t) => matchSkills(t, test.subject, { student, limit: 6 }).map((m) => m.skill))].map((s) => [s.id, s])).values()];
  const zugeordnet = sp.zugeordnet !== undefined ? Number(sp.zugeordnet) : null;
  const proben = probeschularbeitenZu(test.id);
  const auftraege = auftraegeZurPruefung(test.id);
  // read from its documents (lib/pruefungsstoff.ts): the view „Erkannt“ with every point and what is still to confirm
  const erkannt = stoffDerPruefung(test.id);
  const zuBestaetigen = erkannt.filter((z) => (z.zuordnung === "unklar" && z.status !== "ausgeschlossen" && z.vorschlaege.length) || z.status === "unklar").length;
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
        {erkannt.length > 0 && (
          <Link href={`/schueler/${student.id}/pruefung/${test.id}/stoff`} className="panel flex min-h-[52px] flex-wrap items-center gap-x-2 px-4 py-2" data-testid="zu-erkannt">
            <FileText size={18} className="text-ink-2" aria-hidden />
            <span className="text-[15px] font-semibold">Erkannt: {erkannt.length} Punkte aus den Unterlagen</span>
            {zuBestaetigen > 0 && <Pill tone="amber">{zuBestaetigen} offen</Pill>}
          </Link>
        )}
        {((test.topics?.length ?? 0) > 0 || test.material_id) && (
          <p className="flex flex-wrap items-center gap-1.5 text-[15px]">
            {(test.topics?.length ?? 0) > 0 && <span className="font-medium text-ink-2">Stoff:</span>}
            {test.topics?.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
            {test.material_id && (
              <a href={`/material/${test.material_id}/datei`} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline">
                <FileText size={14} aria-hidden /> Stoffzettel
              </a>
            )}
          </p>
        )}

        {zugeordnet !== null && !zuordnen && (
          <p role="status" className="-mt-4 flex items-center gap-2 rounded-lg bg-green-wash px-3 py-2 text-[14px] text-green" data-testid="zugeordnet">
            <Check size={16} aria-hidden /> {zugeordnet === 1 ? "1 Fähigkeit" : `${zugeordnet} Fähigkeiten`} verknüpft. Plan und Probeschularbeit sind bereit.
          </p>
        )}

        {zuordnen && (
          <section id="stoff-zuordnen" aria-label="Stoff zuordnen" className="scroll-mt-24">
            <SectionTitle>
              <span>
                Stoff zuordnen
                <Info label="Wie entstehen die Vorschläge?">
                  Ohne KI, aus den Wörtern des Stoffs: Name und andere Bezeichnungen der Fähigkeiten (z. B. Stellenwerttafel), das Thema und die anderen Punkte der Schularbeit. Angehakt ist nur, was eindeutig passt. Was du anders wählst, merkt sich die App für den nächsten Stoffzettel mit denselben Wörtern.
                </Info>
              </span>
            </SectionTitle>
            <form action={setExamSkillsAction.bind(null, test.id)} className="panel grid px-4 pt-3" data-testid="stoff-zuordnen">
              {sp.ziel === "probe" && <input type="hidden" name="ziel" value="probe" />}
              <p className="text-[14px] text-ink-2">Plan und Probeschularbeit brauchen Fähigkeiten. Was passt, ist angehakt. Prüf es kurz und tippe auf „Zuordnen“.</p>
              {vorschlag.length > 0 && (
                <div className="mt-1 divide-y divide-line">
                  {vorschlag.map((v, i) => (
                    <StoffZeile key={`${i}-${v.topic}`} topic={v.topic} index={i} auto={v.best}>
                      <StoffWahl sichtbar={v.skills.filter((s) => v.best.includes(s.id)).map(chip(i, true))} weitere={v.skills.filter((s) => !v.best.includes(s.id)).map(chip(i, false))} />
                      {v.skills.length === 0 && <FaehigkeitWaehlen name={`stoff_${i}`} pool={pool} label={`Fähigkeit für ${v.topic}`} placeholder="Kein Vorschlag. Fähigkeit wählen …" />}
                    </StoffZeile>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-line py-3">
                <button className="btn btn-primary" data-testid="stoff-zuordnen-speichern">
                  Zuordnen
                </button>
                <FaehigkeitWaehlen name="skill_ids" pool={pool} label="Weitere Fähigkeit" placeholder={vorschlag.length ? "Weitere Fähigkeit …" : "Fähigkeit wählen …"} />
              </div>
            </form>
          </section>
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
            <p className="text-[14px] text-ink-3">Noch keine Fähigkeiten verknüpft. Oben den Stoff zuordnen, dann entsteht der Plan.</p>
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

        <section id="probeschularbeit" aria-label="Probeschularbeit" className="scroll-mt-24">
          <SectionTitle>
            <span>
              Probeschularbeit
              <Info label="Was ist eine Probeschularbeit?">
                Ein ganzer Test zum Stoff, wie eine echte Schularbeit: leichte Aufgaben zuerst, schwere am Ende, jede mit Punkten, dazu der Notenschlüssel. Sie entsteht als Entwurf. Du prüfst sie, dann druckst du sie oder sendest sie aufs Gerät. Dort läuft sie wie ein Minitest: ohne Tipps, ein Versuch je Aufgabe.
              </Info>
            </span>
          </SectionTitle>
          {sp.fehler && (
            <p role="alert" className="mb-3 rounded-lg bg-red-wash px-3 py-2 text-[14px] text-red">
              {sp.fehler}
            </p>
          )}
          {proben.length > 0 && (
            <ul className="panel mb-4 divide-y divide-line">
              {proben.map(({ worksheet: w, punkte, assignment: a, ergebnis: e }) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <Link href={`/uebungen/${w.id}`} className="block font-medium hover:underline">
                      Probeschularbeit vom {formatDate(w.created_at, { day: "numeric", month: "short" })}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
                      {w.status === "entwurf" ? <Pill tone="amber">Entwurf</Pill> : a ? <Pill tone="green">gesendet</Pill> : <Pill>freigegeben</Pill>}
                      <span className="num">{punkteText(punkte)} Punkte</span>
                      {e && e.bearbeitet > 0 && (
                        <span className="num">
                          · {punkteText(e.erreicht)} von {punkteText(e.gesamt)} Punkten
                          {e.note ? ` · Note ${e.note.note} (${e.note.label})` : e.offen ? ` · noch ${e.offen} zu bewerten` : e.bearbeitet < e.aufgaben ? ` · ${e.bearbeitet} von ${e.aufgaben} Aufgaben` : ""}
                        </span>
                      )}
                    </span>
                  </span>
                  {a && e && e.bearbeitet > 0 && (
                    <Link href={`/schueler/${student.id}/ergebnis/${a.id}`} className="btn btn-ghost btn-sm">
                      Ergebnis
                    </Link>
                  )}
                  <Link href={`/arbeitsblatt/${w.id}`} className="btn btn-secondary btn-sm">
                    <Printer size={15} aria-hidden /> Drucken
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {zuordnen ? (
            <p className="text-[14px] text-ink-3">
              Ordne zuerst den Stoff Fähigkeiten zu, dann kannst du eine Probeschularbeit erstellen.{" "}
              <a href="#stoff-zuordnen" className="font-semibold text-accent hover:underline">
                Zum Zuordnen
              </a>
            </p>
          ) : (
            <div className="panel px-4 py-4">
              <ProbeschularbeitForm action={probeschularbeitAction.bind(null, test.id)} ai={aiEnabled()} again={proben.length > 0} />
            </div>
          )}
        </section>

        {(auftraege.length > 0 || /deutsch/i.test(test.subject)) && (
          <section aria-label="Schreibaufträge" data-testid="pruefung-schreibauftraege">
            <SectionTitle
              action={
                <Link href={`/schueler/${student.id}/schreibauftrag?pruefung=${test.id}`} className="btn btn-secondary btn-sm">
                  <Plus size={15} aria-hidden /> Schreibauftrag dazu
                </Link>
              }
            >
              Schreibaufträge
            </SectionTitle>
            {auftraege.length > 0 ? (
              <ul className="panel divide-y divide-line">
                {auftraege.map((a) => (
                  <li key={a.textId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <Link href={`/texte/${a.textId}`} className="min-w-0 flex-1 font-medium hover:underline">
                      {a.title}
                    </Link>
                    <span className="num text-[13px] text-ink-2">{a.words.toLocaleString("de-AT")} Wörter</span>
                    {a.status === "fertig" ? <Pill tone="green">abgegeben</Pill> : <Pill tone="amber">in Arbeit</Pill>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-3">Noch keiner. Ein Schreibauftrag in der Textsorte der Schularbeit, mit eigener Textbeilage.</p>
            )}
          </section>
        )}

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

        {!zuordnen && (
          <Reveal label="Fähigkeiten der Prüfung ändern">
            <form action={setExamSkillsAction.bind(null, test.id)} className="panel grid gap-3 px-4 py-4" data-testid="faehigkeiten-aendern">
              <div className="flex flex-wrap gap-1.5">
                {offered.map((s) => (
                  <StoffChip key={s.id} name="skill_ids" value={s.id} label={label(s)} area={s.area} defaultChecked={test.skill_ids.includes(s.id)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-secondary">Speichern</button>
                <FaehigkeitWaehlen name="skill_ids" pool={pool} label="Weitere Fähigkeit" placeholder="Weitere Fähigkeit …" />
              </div>
            </form>
          </Reveal>
        )}
        <p className="text-[13px] text-ink-3">Vorschläge kommen aus dem Stoff, den du eingetragen hast. Verknüpft wird nur, was du für {first} anhakst.</p>
      </div>
    </>
  );
}
