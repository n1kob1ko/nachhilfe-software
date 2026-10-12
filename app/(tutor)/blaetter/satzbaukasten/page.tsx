import { SatzbaukastenGenerator } from "@/components/druckblatt/SatzbaukastenGenerator";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Satzbaukasten" };

/**
 * Der Satzbaukasten: Spalten mit Wörtern, darunter Zeilen zum Aufschreiben.
 *
 * Ausdrücklich nicht die Satzbau-Aufgaben der **Schnellrunde**: Das eine ist ein
 * Blatt zum Ausdrucken, das andere eine Übung am Bildschirm (CONTEXT.md).
 */
export default function SatzbaukastenPage() {
  return (
    <>
      <PageHeader
        title="Satzbaukasten"
        subtitle="Spalten mit Wörtern oder Satzteilen, aus denen Sätze gebaut werden"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Der Reiz dieser Übung ist das Kreuzprodukt: drei Verben und sechs Objekte ergeben achtzehn
            Sätze. Die Spalten dürfen deshalb unterschiedlich lang sein. Bei den Nomen tippt man das
            Geschlecht mit („der Hund“) — welcher Artikel daraus wird, rechnet die App aus Fall und
            Artikelart, und sie meldet, was sie nicht sicher weiß.
          </>
        }
      />
      <SatzbaukastenGenerator />
    </>
  );
}
