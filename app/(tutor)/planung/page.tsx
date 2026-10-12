import { CalendarDays } from "lucide-react";
import { Wochenplan, type PlanungFilterWerte } from "@/components/planung/Wochenplan";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfWocheSehen, darfWochenplanBearbeiten } from "@/lib/planung/berechtigungen";
import { leseRegeln, pruefeRegeln, regelnJson } from "@/lib/planung/regeln";
import { wochenUebersicht } from "@/lib/planung/uebersicht";
import { istDatum, wochenstartVon, wienerWochenstart } from "@/lib/planung/zeit";

export const metadata = { title: "Planung" };

/**
 * Die Wochenansicht (Phase 4): **eine** Seite für alles — Zeilen = Lehrer, Spalten = Tage, Filter
 * nach Lehrer, Raum und Schüler, Seitenleiste, Offen-Schubfach, Summenfuß und die Werkzeuge.
 *
 * Die Sicht hängt an der Rolle (D23): die Verwaltung sieht Entwurf **und** veröffentlichte Woche
 * und darf alles ändern; ein Lehrer sieht ausschließlich seine **eigene veröffentlichte** Woche und
 * nur zu. Die Filter stehen in der Adresse (`?woche=&lehrer=&raum=&schueler=`), damit die
 * Rückleitung nach einer Aktion sie behält.
 */
export default async function PlanungPage({
  searchParams,
}: {
  searchParams: Promise<{ woche?: string; lehrer?: string; raum?: string; schueler?: string; neu?: string; platz?: string; regeln?: string; ok?: string; fehler?: string }>;
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

  const regelnRoh = regelnJson();
  const regelnGebrochen = !!regelnRoh && !pruefeRegeln(regelnRoh).ok;

  return (
    <>
      <PageHeader
        title="Planung"
        subtitle={darfBearbeiten ? "Wochenplan: generieren, verschieben, sperren, veröffentlichen" : "Deine veröffentlichte Woche (nur lesen)"}
        back={{ href: "/mehr", label: "Mehr" }}
        info={
          <>
            Eine Woche ist entweder <b>Entwurf</b> oder <b>veröffentlicht</b>. Die Verwaltung generiert, verschiebt und veröffentlicht; ein Lehrer sieht nur seine eigene veröffentlichte Woche.
            Ziehen verschiebt einen Platz auf einen anderen Tag, eine andere Zeit oder einen anderen Lehrer — unzulässige Ziele werden geprüft (Lehrer, Schüler, Raum) und ausgeblendet. Gesperrte Plätze bleiben bei „Neu generieren“ stehen.
          </>
        }
      />
      <p className="mb-4 flex items-start gap-2 text-[13px] text-ink-2">
        <CalendarDays size={15} className="mt-0.5 shrink-0" aria-hidden />
        Zeiten sind lokale Zeiten (Europe/Vienna). Die geplante Dauer (1–300 Minuten) ist der Vorschlag; abgerechnet wird nur die echte Einheit.
      </p>

      {fremdeWoche && (
        <p className="mb-4 rounded-2xl px-4 py-3 text-[14px] text-amber" role="status" style={{ background: "var(--amber-wash)" }}>
          Die Woche eines anderen Lehrers ist hier nicht sichtbar. Du siehst deine eigene veröffentlichte Woche.
        </p>
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
        dialog={{ neu: sp.neu === "1", platzId: Number(sp.platz) || 0, regeln: sp.regeln === "1" }}
      />
    </>
  );
}
