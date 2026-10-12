import { NachmalblattGenerator } from "@/components/druckblatt/NachmalblattGenerator";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Nachmalblatt" };

/**
 * Das Nachmalblatt: Buchstaben, Silben oder Wörter zum Nachspuren.
 *
 * Die abnehmende Hilfe ist der Kern: Vorne steht die Vorlage kräftig, dann wird sie
 * blasser, hinten ist die Zeile leer. So löst sich das Kind beim Schreiben von der
 * Vorlage, statt bis zum Rand nachzufahren.
 */
export default function NachmalblattPage() {
  return (
    <>
      <PageHeader
        title="Nachmalblatt"
        subtitle="Buchstaben, Silben oder Wörter nachspuren — mit abnehmender Hilfe"
        back={{ href: "/blaetter", label: "Blätter erstellen" }}
        info={
          <>
            Zwei Einstellungen bestimmen das Blatt: die <b>Lineatur</b> (DIN 16552-1) und die{" "}
            <b>Schulschrift</b>. Aus dem Mittelband der Lineatur wird die Schriftgröße gerechnet, damit
            ein Kleinbuchstabe genau zwischen Mittel- und Grundlinie sitzt. Fehlt eine Schriftdatei,
            sagt die App das und druckt die Druckschrift — still ersetzen wäre hier besonders heikel,
            weil das Kind genau diese Formen nachmalen soll.
          </>
        }
      />
      <NachmalblattGenerator />
    </>
  );
}
