import type { SentenceBoxDefinition } from "@/lib/druckblatt/definition/sentence-box-types";
import type { SentenceLayoutModel } from "@/lib/druckblatt/rendering/sentence-layout-model";
import { PrintPageRule } from "./PrintPageRule";
import { SentencePageView } from "./SentencePageView";
import type { SatzOptik } from "./SentenceTableView";

/**
 * Einstiegspunkt des Bildschirm-Renderers für den Satzbaukasten.
 *
 * Layoutmodell rein, DOM raus — wie bei der Lesetabelle. Die
 * Darstellungsabsicht wird hier einmal aus der Definition gelesen und als Prop
 * weitergereicht; der React-Kontext der Quelldatei ist damit weg (Merge-Plan §3.2).
 *
 * `PrintPageRule` wird mit den anderen Blatttypen geteilt: Die `@page`-Regel hängt
 * nur am Papierformat, nicht am Blatttyp.
 */
export function SentenceBoxView({
  model,
  definition,
}: {
  readonly model: SentenceLayoutModel;
  readonly definition: SentenceBoxDefinition;
}) {
  const optik: SatzOptik = {
    typography: definition.typography,
    borders: definition.table.borders,
    numbered: definition.lines.numbered,
    showPageNumbers: definition.showPageNumbers,
  };

  return (
    <>
      <PrintPageRule geometry={model.geometry} />
      {model.pages.map((page) => (
        <SentencePageView
          key={page.index}
          page={page}
          geometry={model.geometry}
          metrics={model.metrics}
          totalPages={model.pages.length}
          optik={optik}
        />
      ))}
    </>
  );
}
