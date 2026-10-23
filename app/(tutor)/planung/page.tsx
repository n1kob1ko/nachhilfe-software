import { Wochenplan, type PlanungFilterWerte, type Vorgabe } from "@/components/planung/Wochenplan";
import { antwortLehrerAction, bestaetigeAnfrageAction } from "@/app/terminanfrage-actions";
import { AnfrageMeldung, AnfragenListe } from "@/components/planung/Terminanfragen";
import { PageHeader, SectionTitle } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfWocheSehen, darfWochenplanBearbeiten } from "@/lib/planung/berechtigungen";
import { leseRegeln, pruefeRegeln, regelnJson } from "@/lib/planung/regeln";
import { listRaeume } from "@/lib/planung/repo";
import { anfragenFuerVerwaltung } from "@/lib/planung/terminanfragen";
import { wochenUebersicht } from "@/lib/planung/uebersicht";
import { istDatum, wochenstartVon, wienerWochenstart, type Wochentag } from "@/lib/planung/zeit";

export const metadata = { title: "Planung" };

/**
 * Die Wochenansicht (Phase 4): **eine** Seite für alles. Statuskarte mit dem nächsten Schritt,
 * Filter nach Lehrer, Raum und Schüler, Offen-Schubfach und die Werkzeuge; am Laptop das Gitter
 * (Zeilen = Lehrer, Spalten = Tage), auf Telefon und Tablet ein Tag als Liste.
 *
 * Die Sicht hängt an der Rolle (D23): die Verwaltung sieht Entwurf **und** veröffentlichte Woche
 * und darf alles ändern; ein Lehrer sieht ausschließlich seine **eigene veröffentlichte** Woche und
 * nur zu. Die Filter stehen in der Adresse (`?woche=&lehrer=&raum=&schueler=`), damit die
 * Rückleitung nach einer Aktion sie behält.
 */
export default async function PlanungPage({
  searchParams,
}: {
  searchParams: Promise<{ woche?: string; lehrer?: string; raum?: string; schueler?: string; neu?: string; bei?: string; tag?: string; um?: string; platz?: string; regeln?: string; ok?: string; fehler?: string; anfrage_ok?: string; anfrage_fehler?: string }>;
}) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const darfBearbeiten = darfWochenplanBearbeiten(me);

  const woche = sp.woche && istDatum(sp.woche) ? wochenstartVon(sp.woche) : wienerWochenstart();
  // D23: eine fremde Woche darf ein Lehrer nicht sehen — ein `?lehrer=`-Wunsch wird dann ignoriert.
  const gewuenschterLehrer = Number(sp.lehrer) || 0;
  const fremdeWoche = !darfBearbeiten && gewuenschterLehrer > 0 && !darfWocheSehen(me, gewuenschterLehrer);
  const uebersicht = wochenUebersicht(woche, darfBearbeiten ? { status: "alle" } : { status: "veroeffentlicht", nurLehrerId: me.id });
  // Filter nur auf Ids, die es in dieser Ansicht wirklich gibt
  const filter: PlanungFilterWerte = {
    lehrer: uebersicht.lehrer.some((l) => l.id === Number(sp.lehrer)) ? Number(sp.lehrer) : 0,
    raum: uebersicht.raeume.some((r) => r.id === Number(sp.raum)) ? Number(sp.raum) : 0,
    schueler: uebersicht.schueler.some((s) => s.id === Number(sp.schueler)) ? Number(sp.schueler) : 0,
  };

  const teile = [`woche=${woche}`];
  if (filter.lehrer) teile.push(`lehrer=${filter.lehrer}`);
  if (filter.raum) teile.push(`raum=${filter.raum}`);
  if (filter.schueler) teile.push(`schueler=${filter.schueler}`);
  const zurueck = `/planung?${teile.join("&")}`;

  // Vorgaben für einen neuen Platz (Klick auf freie Zeit): nur, was es in dieser Woche gibt
  const tag = Number(sp.tag);
  const um = Number(sp.um);
  const vorgabe: Vorgabe = {
    teacherId: uebersicht.lehrer.some((l) => l.id === Number(sp.bei)) ? Number(sp.bei) : undefined,
    weekday: uebersicht.tage.some((t) => t.tag === tag) ? (tag as Wochentag) : undefined,
    startMin: sp.um && Number.isInteger(um) && um >= 0 && um < 1440 ? um : undefined,
  };

  // Terminanfragen (lib/planung/terminanfragen.ts): hier bestätigt oder lehnt die Verwaltung ab
  const anfragen = darfBearbeiten ? anfragenFuerVerwaltung() : [];
  const offeneAnfragen = anfragen.filter((a) => a.status === "offen" || a.status === "wartet");
  const erledigteAnfragen = anfragen.filter((a) => a.status !== "offen" && a.status !== "wartet");

  const regelnRoh = regelnJson();
  const regelnGebrochen = !!regelnRoh && !pruefeRegeln(regelnRoh).ok;

  return (
    <>
      <PageHeader
        title="Planung"
        subtitle={darfBearbeiten ? "Wochenplan aller Lehrer" : "Deine veröffentlichte Woche"}
        back={{ href: "/mehr", label: "Mehr" }}
        info={
          <>
            Eine Woche ist entweder <b>Entwurf</b> oder <b>veröffentlicht</b>. Die Verwaltung generiert, verschiebt und veröffentlicht; ein Lehrer sieht nur seine eigene veröffentlichte Woche.
            Am Laptop verschiebt Ziehen einen Platz auf einen anderen Tag, eine andere Zeit oder einen anderen Lehrer; unzulässige Ziele werden geprüft (Lehrer, Schüler, Raum) und rot markiert. Ein Klick auf freie Zeit legt dort einen Platz an. Auf Telefon und Tablet steht ein Tag als Liste; antippen öffnet den Platz.
            Gesperrte Plätze bleiben bei „Neu generieren“ stehen. Weiß ist die Zeit, in der ein Lehrer kann, schraffiert die übrige. Zeiten sind lokale Zeiten (Europe/Vienna). Die geplante Dauer (1–300 Minuten) ist der Vorschlag; abgerechnet wird nur die echte Einheit.
          </>
        }
      />

      {fremdeWoche && (
        <p className="mb-4 rounded-2xl px-4 py-3 text-[14px] text-amber" role="status" style={{ background: "var(--amber-wash)" }}>
          Die Woche eines anderen Lehrers ist hier nicht sichtbar. Du siehst deine eigene veröffentlichte Woche.
        </p>
      )}

      {darfBearbeiten && (anfragen.length > 0 || sp.anfrage_ok || sp.anfrage_fehler) && (
        <section id="terminanfragen" className="mb-8 scroll-mt-4" aria-label="Terminanfragen">
          <SectionTitle>{offeneAnfragen.length ? `Terminanfragen: ${offeneAnfragen.length} offen` : "Terminanfragen"}</SectionTitle>
          <AnfrageMeldung ok={sp.anfrage_ok} fehler={sp.anfrage_fehler} />
          {offeneAnfragen.length > 0 && (
            <div className="mt-3">
              <AnfragenListe
                anfragen={offeneAnfragen}
                antwort={(a) => antwortLehrerAction.bind(null, a.id)}
                bestaetigen={(a) => bestaetigeAnfrageAction.bind(null, a.id)}
                zurueck={zurueck}
                raeume={listRaeume()}
              />
            </div>
          )}
          {erledigteAnfragen.length > 0 && (
            <details className="group mt-3">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-[14px] font-medium text-ink-2 hover:text-ink">
                Entschieden <span className="num ml-1">({erledigteAnfragen.length})</span>
              </summary>
              <AnfragenListe anfragen={erledigteAnfragen} antwort={(a) => antwortLehrerAction.bind(null, a.id)} />
            </details>
          )}
        </section>
      )}

      <Wochenplan
        uebersicht={uebersicht}
        darfBearbeiten={darfBearbeiten}
        basisPfad="/planung"
        druckHref={`/planung/drucken?woche=${woche}`}
        aktuelleWoche={wienerWochenstart()}
        zurueck={zurueck}
        filter={filter}
        meldung={{ ok: sp.ok, fehler: sp.fehler }}
        regeln={leseRegeln()}
        regelnGebrochen={regelnGebrochen}
        dialog={{ neu: sp.neu === "1", platzId: Number(sp.platz) || 0, regeln: sp.regeln === "1", vorgabe }}
      />
    </>
  );
}
