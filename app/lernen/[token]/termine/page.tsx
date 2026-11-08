import { CalendarDays, CalendarSync, MapPin, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { Pill } from "@/components/ui";
import { NaechsterTermin } from "@/components/lernen/NaechsterTermin";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { NaechstesMal } from "@/components/SchuelerNotizFrage";
import { termineFuerSchueler } from "@/lib/planung/schueler-termine";
import { anfragbareTermine, anfragenFuerSchueler } from "@/lib/planung/terminanfragen";
import { antwortSchuelerAction, stelleSchuelerAnfrageAction } from "@/app/terminanfrage-actions";
import { AnfrageMeldung, AnfragenListe, TerminAendern } from "@/components/planung/Terminanfragen";
import { TauschAngebote, TerminTauschen } from "@/components/planung/Tauschboerse";
import { boerseFuerSchueler } from "@/lib/planung/tauschboerse";
import { bieteAnAction, nimmAngebotAction, zieheAngebotZurueckAction } from "@/app/tauschboerse-actions";
import * as repo from "@/lib/repo";
import { offenerWunsch } from "@/lib/schueler-notiz";

/**
 * Termine in der Schüler-App: der nächste groß, dann diese und die nächste veröffentlichte Woche, je Termin ein
 * Eingang „Termin ändern“ (Tauschen, andere Zeit anfragen), die eigenen Anfragen und „Für nächstes Mal“.
 * Nur veröffentlichte Plätze, keine Namen anderer Schüler (D17/D23).
 */
export default async function TerminePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ anfrage_ok?: string; anfrage_fehler?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const { naechster, wochen } = termineFuerSchueler(student.id);
  // Terminanfragen: verschieben oder tauschen; ein anderer Schüler erscheint nur als Zeit (lib/planung/terminanfragen.ts)
  const aenderbar = new Map(anfragbareTermine({ schuelerId: student.id }).map((t) => [t.id, t]));
  const anfragen = anfragenFuerSchueler(student.id);
  // Tauschbörse: Angebote anderer, die zu meinen Terminen passen, und meine eigenen; nur Zeiten (lib/planung/tauschboerse.ts)
  const boerse = boerseFuerSchueler(student.id);
  const anbietbar = new Map(boerse.anbietbar.map((x) => [x.platzId, x]));
  const angeboten = new Map(boerse.eigene.map((x) => [x.platzId, x]));
  const mitAnfrage = new Set(anfragen.filter((x) => x.status === "wartet" || x.status === "offen").flatMap((x) => x.platzIds));

  return (
    <>
      <SeitenKopf titel="Deine Termine" text="Wann und wo du Nachhilfe hast. Passt ein Termin nicht, kannst du ihn hier ändern." />
      <AnfrageMeldung ok={sp.anfrage_ok} fehler={sp.anfrage_fehler} />

      {naechster ? <NaechsterTermin naechster={naechster} token={token} /> : <p className="panel mt-6 px-5 py-5 text-[15px] text-ink-2">Gerade ist kein Termin veröffentlicht.</p>}

      <TauschAngebote passend={boerse.passend} nehmen={(p) => nimmAngebotAction.bind(null, token, p.angebotId, p.platzId)} />

      <section id="terminanfragen" className="panel mt-8 scroll-mt-4 px-5 py-5" aria-label="Alle Termine" data-testid="termine">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold">
          <CalendarDays size={18} className="text-accent" aria-hidden /> Alle Termine
        </h2>
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

      <NaechstesMal token={token} text={offenerWunsch(student.id)?.text ?? null} />
    </>
  );
}
