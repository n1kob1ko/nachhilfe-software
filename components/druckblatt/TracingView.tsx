import type { TracingDefinition } from "@/lib/druckblatt/definition/tracing-types";
import type { TracingLayoutModel } from "@/lib/druckblatt/rendering/build-tracing-layout";
import { PrintPageRule } from "./PrintPageRule";
import { TracingPageView } from "./TracingPageView";

/**
 * Einstiegspunkt des Bildschirm-Renderers für das Nachmalblatt.
 *
 * Layoutmodell rein, DOM raus — wie bei den anderen Blatttypen. Kennt weder Store
 * noch Anwendungslogik.
 *
 * Ohne eigenen Darstellungskontext: Dieses Blatt hat so wenige
 * Optik-Entscheidungen, dass zwei Eigenschaften reichen. Sie kommen direkt aus der
 * Definition.
 */
export function TracingView({
  model,
  definition,
}: {
  readonly model: TracingLayoutModel;
  readonly definition: TracingDefinition;
}) {
  return (
    <>
      <PrintPageRule geometry={model.geometry} />
      {model.pages.map((page) => (
        <TracingPageView
          key={page.index}
          page={page}
          geometry={model.geometry}
          metrics={model.metrics}
          typography={definition.typography}
          showPageNumbers={definition.showPageNumbers}
          totalPages={model.pages.length}
        />
      ))}
    </>
  );
}
