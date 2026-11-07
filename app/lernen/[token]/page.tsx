import Link from "next/link";
import { CalendarDays, CalendarPlus, CalendarSync, CheckCircle2, ChevronDown, ChevronRight, MapPin, Presentation, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { SubjectArt } from "@/components/Art";
import { MasteryBar, Pill, TrendBadge, formatDate } from "@/components/ui";
import { AppHinweis } from "@/components/AppHinweis";
import { Hausuebungen } from "@/components/lernen/Hausuebungen";
import { KommendePruefungen } from "@/components/lernen/KommendePruefungen";
import { Unterlagen } from "@/components/lernen/Unterlagen";
import { VergangeneEinheiten } from "@/components/lernen/VergangeneEinheiten";
import { NaechstesMal, SchuelerNotizFrage } from "@/components/SchuelerNotizFrage";
import { termineFuerSchueler } from "@/lib/planung/schueler-termine";
import { anfragbareTermine, anfragenFuerSchueler } from "@/lib/planung/terminanfragen";
import { antwortSchuelerAction, stelleSchuelerAnfrageAction } from "@/app/terminanfrage-actions";
import { AnfrageMeldung, AnfragenListe, TerminAendern } from "@/components/planung/Terminanfragen";
import { TauschAngebote, TerminTauschen } from "@/components/planung/Tauschboerse";
import { boerseFuerSchueler } from "@/lib/planung/tauschboerse";
import { bieteAnAction, nimmAngebotAction, zieheAngebotZurueckAction } from "@/app/tauschboerse-actions";
import { eintraegeFuerSchueler, STATUS_LABEL } from "@/lib/pruefliste";
import * as repo from "@/lib/repo";
import { activeMaterial, materialLabel } from "@/lib/current-material";
import { analyzeStudent } from "@/lib/service";
import { notizFuerSchueler, offenerWunsch } from "@/lib/schueler-notiz";
import { runningUnitForStudent } from "@/lib/units";


/** Das Thema zum Bild der Bühne: der aktuelle Stoff des Schülers (Thema und Unterthema). */
const bildThema = (studentId: number) => {
  const m = activeMaterial(studentId)[0];
  return m ? `${m.topic} ${materialLabel(m)}` : null;
};

export default async function LearnHome({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ anfrage_ok?: string; anfrage_fehler?: string; mehr?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const list = repo.listAssignments(student.id);
  const open = list.filter((a) => !a.completed_at);
  const done = list.filter((a) => a.completed_at).slice(0, 6);
  const a = analyzeStudent(student.id)!;
  const practiced = a.skills.filter((s) => s.tasksDone > 0).sort((x, y) => (y.lastPracticed ?? 0) - (x.lastPracticed ?? 0)).slice(0, 6);
  const first = student.name.split(" ")[0];
  const unit = runningUnitForStudent(student.id);

  // wo und wann: nur veröffentlichte Plätze, ohne Namen (lib/planung/schueler-termine.ts)
  const { naechster, wochen } = termineFuerSchueler(student.id);
  // Terminanfragen: verschieben oder tauschen; ein anderer Schüler erscheint nur als Zeit (lib/planung/terminanfragen.ts)
  const aenderbar = new Map(anfragbareTermine({ schuelerId: student.id }).map((t) => [t.id, t]));
  const anfragen = anfragenFuerSchueler(student.id);
  // Tauschbörse: Angebote anderer, die zu meinen Terminen passen, und meine eigenen; nur Zeiten (lib/planung/tauschboerse.ts)
  const boerse = boerseFuerSchueler(student.id);
  const anbietbar = new Map(boerse.anbietbar.map((x) => [x.platzId, x]));
  const angeboten = new Map(boerse.eigene.map((x) => [x.platzId, x]));
  const mitAnfrage = new Set(anfragen.filter((x) => x.status === "wartet" || x.status === "offen").flatMap((x) => x.platzIds));
  // eingetragene Prüfungen: nur die eigenen Angaben und der Stand (lib/pruefliste.ts)
  const pruefungen = eintraegeFuerSchueler(student.id);
  // „Was war heute schwer?“ nach der letzten Einheit und „Für nächstes Mal“, nur die eigenen (lib/schueler-notiz.ts)
  const notiz = notizFuerSchueler(student.id);

  // Audit 2026-11-07: zuerst, was zu tun ist (Übungen, Hausübungen), dann der nächste Termin und Tauschangebote, die
  // Frage „Was war heute schwer?“ nur am Tag der Einheit und am Tag danach; alles andere zugeklappt unter „Mehr“
  const notizFrisch = notiz !== null && (notiz.wann === "heute" || notiz.wann === "gestern");
  const mehrOffen = Boolean(sp.anfrage_ok || sp.anfrage_fehler || sp.mehr);
  const notizKarte = notiz && (
    <SchuelerNotizFrage
      token={token}
      unitId={notiz.unitId}
      wann={notiz.wann}
      notiz={notiz.notiz && { auswahl: notiz.notiz.auswahl, text: notiz.notiz.text, uebersprungen: notiz.notiz.uebersprungen }}
    />
  );
  return (
    <>
      <section className="buehne px-6 py-7 md:px-8 md:py-9">
        <div className="relative z-10 sm:pr-[170px]">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] md:text-[34px]">Hallo {first}!</h1>
          <p className="buehne-meta mt-1 text-[17px]">
            {open.length === 0 ? "Gerade ist nichts offen. Gut gemacht!" : open.length === 1 ? "Eine Übung wartet auf dich." : `${open.length} Übungen warten auf dich.`}
          </p>
        </div>
        <SubjectArt subject={student.subjects[0]} topic={bildThema(student.id)} seed={student.id} className="pointer-events-none absolute -right-4 -bottom-6 hidden h-[190px] w-[190px] sm:block" />
      </section>

      {unit && (
        <Link href={`/lernen/${token}/tafel`} className="panel mt-8 flex items-center gap-4 border-accent-bright/60 bg-accent-wash px-5 py-5 transition-colors hover:border-accent-bright">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-on-fill">
            <Presentation size={24} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold">Whiteboard öffnen</span>
            <span className="block text-[14px] text-ink-2">Deine Einheit läuft. Schreib und rechne gemeinsam mit {unit.teacher_name}.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-accent" aria-hidden />
        </Link>
      )}

      {open.length > 0 && (
        <ul className="mt-8 space-y-3" data-testid="offene-uebungen">
          {open.map((x) => (
            <li key={x.id}>
              <Link href={`/lernen/${token}/${x.id}`} className="panel flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{x.title}</p>
                  <p className="text-[14px] text-ink-2">
                    {x.task_count} Aufgaben · {x.difficulty}
                    {x.done_count > 0 && ` · ${x.done_count} schon erledigt`}
                  </p>
                  {x.done_count > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bar-track)]">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(x.done_count / x.task_count) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span className="btn btn-primary">
                  {x.done_count > 0 ? "Weitermachen" : "Starten"} <ChevronRight size={16} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Hausuebungen studentId={student.id} token={token} />

      {naechster && (
        <section className="panel mt-8 px-5 py-5 md:px-6" aria-label="Nächster Termin" data-testid="naechster-termin">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-accent">
            <CalendarDays size={17} aria-hidden /> {naechster.jetzt ? "Jetzt" : naechster.heute ? "Heute" : naechster.morgen ? "Morgen" : "Nächster Termin"}
          </p>
          {/* niko, 2026-11-03: Wochentag ausgeschrieben, darunter groß die Uhrzeit */}
          <p className="mt-2 text-[18px] font-semibold text-ink-2" data-testid="naechster-tag">
            {naechster.tagLang}
          </p>
          <p className="num mt-0.5 text-[32px] leading-tight font-semibold tracking-[-0.01em]" data-testid="naechster-zeit">
            {naechster.zeit.replace("–", " – ")}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]" data-testid="naechster-ort">
            <MapPin size={17} className="shrink-0 text-ink-3" aria-hidden />
            <span>{naechster.standort}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]" data-testid="naechster-lehrer">
            <UserRound size={17} className="shrink-0 text-ink-3" aria-hidden />
            <span>{naechster.lehrer}</span>
          </p>
          <p className="mt-3 text-[14px]">
            <a href={`/lernen/${token}?mehr=1#terminanfragen`} className="inline-flex min-h-[44px] items-center font-semibold text-accent hover:underline">
              Alle Termine und Termin ändern
            </a>
          </p>
        </section>
      )}

      <TauschAngebote passend={boerse.passend} nehmen={(p) => nimmAngebotAction.bind(null, token, p.angebotId, p.platzId)} />

      {notizFrisch && notizKarte}

      {/* Übersicht (lib/schuelerportal.ts): Prüfungen gleich nach dem nächsten Termin */}
      <KommendePruefungen studentId={student.id} />

      <NaechstesMal token={token} text={offenerWunsch(student.id)?.text ?? null} />

      <details id="mehr" className="group mt-10 scroll-mt-4" open={mehrOffen} data-testid="mehr">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 rounded-2xl border border-line bg-surface px-5 text-[17px] font-semibold">
          <ChevronDown size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
          Mehr
          <span className="min-w-0 truncate text-[14px] font-normal text-ink-2">Alle Termine, Prüfungen eintragen, Unterlagen, Fortschritt</span>
        </summary>

        <section id="terminanfragen" className="panel mt-4 scroll-mt-4 px-5 py-5" aria-label="Deine Termine" data-testid="termine">
          <h2 className="flex items-center gap-2 text-[18px] font-semibold">
            <CalendarDays size={18} className="text-accent" aria-hidden /> Deine Termine
          </h2>
          <AnfrageMeldung ok={sp.anfrage_ok} fehler={sp.anfrage_fehler} />
          {wochen.map((w) => (
            <div key={w.wochenstart} className="mt-4">
              <p className="text-[13px] font-semibold text-ink-2">
                {w.titel} <span className="font-normal">· {w.label}</span>
              </p>
              {w.termine.length === 0 ? (
                <p className="mt-2 text-[15px] text-ink-2">Diese Woche ist nichts geplant.</p>
              ) : (
                <ul className="mt-1 divide-y divide-line">
                  {w.termine.map((t) => {
                    // Audit 2026-11-07: ein Eingang „Termin ändern“ je Termin, darin Tauschen und Andere Zeit anfragen
                    const kannTauschen = anbietbar.has(t.id) && !angeboten.has(t.id);
                    const kannAnfragen = aenderbar.has(t.id) && !angeboten.has(t.id);
                    return (
                      <li key={t.id} className={`grid gap-1 py-3 text-[15px] ${t.vorbei ? "text-ink-3" : ""}`}>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="num font-semibold">{t.label}</span>
                          <span className="num">{t.zeit}</span>
                          {t.heute && !t.vorbei && <Pill tone="accent">heute</Pill>}
                          {mitAnfrage.has(t.id) && <Pill tone="amber">Anfrage offen</Pill>}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
                          <MapPin size={15} className="shrink-0 text-ink-3" aria-hidden />
                          <span>{t.standort}</span>
                          <span aria-hidden>·</span>
                          <UserRound size={15} className="shrink-0 text-ink-3" aria-hidden />
                          <span>{t.lehrer}</span>
                        </span>
                        {angeboten.has(t.id) && (
                          <TerminTauschen eigenes={angeboten.get(t.id)} anbieten={bieteAnAction.bind(null, token, t.id)} zuruecknehmen={zieheAngebotZurueckAction.bind(null, token, angeboten.get(t.id)?.id ?? 0)} />
                        )}
                        {(kannTauschen || kannAnfragen) && (
                          <details className="group mt-1" data-testid="termin-aendern-schueler">
                            <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent">
                              <CalendarSync size={17} aria-hidden /> Termin ändern
                            </summary>
                            <div className="mt-1 grid gap-4">
                              {kannTauschen && <TerminTauschen inline anbietbar={anbietbar.get(t.id)} anbieten={bieteAnAction.bind(null, token, t.id)} zuruecknehmen={zieheAngebotZurueckAction.bind(null, token, 0)} />}
                              {kannAnfragen && <TerminAendern inline termin={aenderbar.get(t.id)!} aktion={stelleSchuelerAnfrageAction.bind(null, token)} schueler />}
                            </div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
          {anfragen.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[13px] font-semibold text-ink-2">Deine Anfragen</p>
              <AnfragenListe anfragen={anfragen} antwort={(a, was) => antwortSchuelerAction.bind(null, token, a.id, was)} schueler />
            </div>
          )}
        </section>

        {!notizFrisch && notizKarte}

        <section id="pruefungen" className="mt-8 scroll-mt-6" aria-label="Von dir eingetragen" data-testid="pruefung-eintraege">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-semibold">Von dir eingetragen</h2>
            <Link href={`/lernen/${token}/pruefung`} className="btn btn-secondary" data-testid="pruefung-eintragen">
              <CalendarPlus size={17} aria-hidden /> Prüfung eintragen
            </Link>
          </div>
          {pruefungen.length === 0 ? (
            <p className="text-[15px] text-ink-2">Steht eine Schularbeit oder ein Test an? Trag sie hier ein, mit einem Foto vom Stoffzettel.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {pruefungen.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {p.art} {p.fach}
                    </span>
                    <span className="block text-[14px] break-words text-ink-2">
                      <span className="num">{p.datum ? formatDate(p.datum, { weekday: "short", day: "numeric", month: "short" }) : "Datum offen"}</span>
                      {p.stoff && ` · ${p.stoff}`}
                    </span>
                  </span>
                  <Pill tone={p.status === "uebernommen" || p.status === "automatisch" ? "green" : p.status === "eingereicht" ? "accent" : "neutral"}>{STATUS_LABEL[p.status]}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Unterlagen studentId={student.id} token={token} />
        <VergangeneEinheiten studentId={student.id} />

        {practiced.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[18px] font-semibold">Dein Fortschritt</h2>
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
        )}

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
      </details>

      <AppHinweis />
    </>
  );
}
