import type { WorksheetDefinition } from "@/lib/druckblatt/definition/types";
import type { LayoutModel } from "@/lib/druckblatt/rendering/layout-model";
import { PageView } from "./PageView";
import { PrintPageRule } from "./PrintPageRule";
import type { ZellOptik } from "./CellView";

/**
 * Einstiegspunkt des Bildschirm-Renderers für die Lesetabelle.
 *
 * Nimmt ein fertiges Layoutmodell plus die Definition entgegen und übersetzt
 * beides in DOM. Kennt weder Store noch Anwendungslogik — man kann ihn mit einem
 * handgeschriebenen Layoutmodell isoliert rendern.
 *
 * Die Darstellungsabsicht wird hier **einmal** aus der Definition gelesen und als
 * Prop nach unten gereicht. In der Quelldatei lag sie in einem React-Kontext; der
 * diente nur dem Theming und ist mit dem Umstieg auf die Tokens dieses Repos
 * verschwunden (Merge-Plan §3.2).
 */
export function WorksheetView({
  model,
  definition,
}: {
  readonly model: LayoutModel;
  readonly definition: WorksheetDefinition;
}) {
  const optik: ZellOptik = {
    typography: definition.typography,
    decoration: definition.grid.decoration,
    coloring: definition.coloring,
  };

  return (
    <>
      <PrintPageRule geometry={model.geometry} />
      {model.pages.map((page) => (
        <PageView
          key={page.index}
          page={page}
          geometry={model.geometry}
          metrics={model.metrics}
          totalPages={model.pages.length}
          optik={optik}
          showPageNumbers={definition.showPageNumbers}
        />
      ))}
    </>
  );
}
