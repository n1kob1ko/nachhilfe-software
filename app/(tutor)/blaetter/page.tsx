import Link from "next/link";
import { ChevronRight, FileText, Info } from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import { GEPLANT, VERFUEGBAR, geplanteNachFach } from "./katalog";

export const metadata = { title: "Blätter erstellen" };

/**
 * Die Übersicht der Blattgeneratoren.
 *
 * Oben die drei, die es gibt — jede Karte führt in den Generator. Darunter die
 * geplanten als **nicht anklickbare** Karten: Der Zurückstand steht damit im
 * Produkt statt nur in einer Datei (Merge-Plan §4 Phase 5 Schritt 3, Herkunft
 * `src/catalog/generators.ts`).
 *
 * Der bestehende A4-Druck einer **Übung** bleibt davon getrennt (D20): Dort wird
 * eine gestellte Übung gedruckt, hier ein Blatt erzeugt.
 */
export default function BlaetterPage() {
  return (
    <>
      <PageHeader
        title="Blätter erstellen"
        subtitle="Lesetabelle, Satzbaukasten und Nachmalblatt — einstellen, ansehen, drucken"
        back={{ href: "/mehr", label: "Mehr" }}
        info={
          <>
            Ein Blatt entsteht hier aus Einstellungen; gedruckt wird es über den Browser. Die Vorschau
            zeigt dasselbe Blatt wie der Ausdruck, in A4. Der A4-Druck einer <b>Übung</b> liegt weiterhin
            unter „Übungen“ — das eine ist ein gestelltes Arbeitsblatt, das andere ein Blatt zum Üben.
          </>
        }
      />

      <section className="mb-10">
        <h2 className="mb-3 text-[15px] font-semibold text-ink-2">Verfügbar</h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {VERFUEGBAR.map((eintrag) => (
            <li key={eintrag.id}>
              <Link
                href={`/blaetter/${eintrag.id}`}
                className="panel flex h-full min-h-[168px] flex-col gap-2 px-5 py-4 transition-shadow hover:shadow-[var(--shadow-pop)]"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "var(--tile-peach)" }}>
                    <FileText size={19} className="text-accent" aria-hidden />
                  </span>
                  {/* Bewusst der neutrale Pill: `accent` auf `accent-wash` erreicht
                      nur 3,79:1 und wäre damit zu blass für Text. */}
                  <Pill>{eintrag.fach}</Pill>
                </span>
                <span className="display text-[17px] font-semibold">{eintrag.label}</span>
                <span className="text-[13px] text-ink-2">{eintrag.hint}</span>
                <span className="num mt-auto flex items-center justify-between text-[12px] text-ink-3">
                  {eintrag.klasse}
                  <ChevronRight size={16} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-[15px] font-semibold text-ink-2">Geplant</h2>
        <p className="mb-3 flex items-start gap-2 text-[13px] text-ink-2">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          Diese Blätter gibt es noch nicht. Sie stehen hier als Zurückstand — nicht anklickbar, damit
          niemand auf eine leere Seite gerät.
        </p>

        <div className="grid gap-6">
          {geplanteNachFach().map((gruppe) => (
            <div key={gruppe.fach}>
              <h3 className="mb-2 text-[13px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
                {gruppe.fach}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {gruppe.eintraege.map((eintrag) => (
                  <li
                    key={eintrag.id}
                    aria-disabled
                    className="flex flex-col gap-1 rounded-2xl border border-dashed border-line-strong px-4 py-3"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[15px] font-semibold text-ink-2">{eintrag.label}</span>
                      <Pill>geplant</Pill>
                    </span>
                    <span className="text-[13px] text-ink-3">{eintrag.hint}</span>
                    <span className="num mt-1 text-[12px] text-ink-3">{eintrag.klasse}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[12px] text-ink-3">
          {GEPLANT.length} geplante Blätter. Die Reihenfolge ist keine Zusage.
        </p>
      </section>
    </>
  );
}
