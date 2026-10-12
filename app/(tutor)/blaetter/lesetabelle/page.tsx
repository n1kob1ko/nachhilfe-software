import { LesetabelleGenerator } from "@/components/druckblatt/LesetabelleGenerator";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Lesetabelle" };

/**
 * Die Lesetabelle: Einstellungen links, Vorschau rechts, Drucken oben.
 *
 * Die Seite selbst ist eine Server-Komponente (nur so trägt sie einen Titel); die
 * Arbeit steckt in `LesetabelleGenerator` — dieselbe Aufteilung wie bei den
 * Übungs-Buildern dieses Repos.
 */
export default function LesetabellePage() {
  return (
    <>
      <PageHeader
        title="Lesetabelle"
        subtitle="Silben oder Wörter in einem gleichmäßigen Raster, laut zu lesen"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Eine Silbenmatrix kombiniert Anlaute mit Vokalen; die Leserichtung bestimmt, was geübt wird.
            Eine eigene Wortliste wird Zeile für Zeile übernommen. Die Silbenfarben zeigen die
            Silbengrenzen — zwei Farben im Wechsel, nach dem Silbenbogen-Prinzip.
          </>
        }
      />
      <LesetabelleGenerator />
    </>
  );
}
