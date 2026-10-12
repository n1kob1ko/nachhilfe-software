import type { PageGeometry } from "@/lib/druckblatt/rendering/geometry";
import type {
  TracingLayoutMetrics,
  TracingLayoutPage,
} from "@/lib/druckblatt/rendering/build-tracing-layout";
import type { TypographyConfig } from "@/lib/druckblatt/definition/types";
import { cssMm, cssPt, mm, pt } from "@/lib/druckblatt/units";
import { TracingRowView } from "./TracingRowView";

/**
 * Ein physisches Blatt des Nachmalbogens.
 *
 * Aufbau wie bei den anderen Blatttypen: Papiermaße außen, Satzspiegel absolut
 * darin, `@page { margin: 0 }` — damit ist die Vorschau geometrisch identisch mit
 * dem Ausdruck.
 *
 * Der Kopfbereich hat hier keine feste Höhe im Modell: Der Nachmal-Layouter
 * schätzt ihn (Titel, Arbeitsauftrag und ein fester Abstand) und zieht ihn von der
 * Zeilenzahl der ersten Seite ab. Der Abstand darunter steht deshalb als Millimeter
 * am Element — derselbe Wert, mit dem dort gerechnet wurde.
 */

/** Wie HEADER_GAP in `rendering/build-tracing-layout.ts`. */
const KOPF_ABSTAND = mm(6);

const TITEL_FAKTOR = 1.15;
const FUSS_FAKTOR = 0.8;

export function TracingPageView({
  page,
  geometry,
  metrics,
  typography,
  showPageNumbers,
  totalPages,
}: {
  readonly page: TracingLayoutPage;
  readonly geometry: PageGeometry;
  readonly metrics: TracingLayoutMetrics;
  readonly typography: TypographyConfig;
  readonly showPageNumbers: boolean;
  readonly totalPages: number;
}) {
  /* Luft zwischen zwei Zeilen — Zeilenabstand minus Bandhöhe. */
  const band = page.rows[0]?.bandHeight ?? mm(0);
  const luecke = mm(Math.max(0, metrics.pitch - band));

  return (
    <div
      className="db-sheet"
      style={{ width: cssMm(geometry.pageWidth), height: cssMm(geometry.pageHeight) }}
    >
      <div
        className="db-satzspiegel"
        style={{
          top: cssMm(geometry.margins.top),
          left: cssMm(geometry.margins.left),
          width: cssMm(geometry.contentWidth),
          height: cssMm(geometry.contentHeight),
        }}
      >
        {page.header !== null && (
          <header
            className="flex shrink-0 flex-col gap-1"
            style={{ marginBottom: cssMm(KOPF_ABSTAND) }}
          >
            {page.header.title !== "" && (
              <h2
                className="leading-tight font-bold"
                style={{ fontSize: cssPt(pt(typography.fontSize * TITEL_FAKTOR)) }}
              >
                {page.header.title}
              </h2>
            )}
            {page.header.instruction !== "" && (
              <p className="leading-snug" style={{ fontSize: cssPt(typography.fontSize) }}>
                {page.header.instruction}
              </p>
            )}
          </header>
        )}

        <div className="flex flex-col" style={{ rowGap: cssMm(luecke) }}>
          {page.rows.map((row) => (
            <TracingRowView
              key={row.index}
              row={row}
              fontSize={metrics.fontSize}
              script={metrics.script}
              width={geometry.contentWidth}
            />
          ))}
        </div>

        {showPageNumbers && totalPages > 1 && (
          <footer
            className="mt-auto shrink-0 text-center text-ink-3"
            style={{ fontSize: cssPt(pt(typography.fontSize * FUSS_FAKTOR)) }}
          >
            {page.pageNumber} / {totalPages}
          </footer>
        )}
      </div>
    </div>
  );
}
