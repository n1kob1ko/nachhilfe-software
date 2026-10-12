import type { PageGeometry } from "@/lib/druckblatt/rendering/geometry";
import type {
  SentenceLayoutMetrics,
  SentenceLayoutPage,
} from "@/lib/druckblatt/rendering/sentence-layout-model";
import { cssMm, cssPt, pt } from "@/lib/druckblatt/units";
import type { SatzOptik } from "./SentenceTableView";
import { SentenceTableView } from "./SentenceTableView";
import { WritingLinesView } from "./WritingLinesView";

/**
 * Ein physisches Blatt des Satzbaukastens.
 *
 * Aufbau wie bei der Lesetabelle: Das Blatt hat exakt die Papiermaße, der
 * Satzspiegel liegt absolut positioniert darin. Zusammen mit `@page { margin: 0 }`
 * bestimmt nicht der Browser die Seitenränder, sondern wir — deshalb ist die
 * Vorschau geometrisch identisch mit dem Ausdruck.
 *
 * Die Abstände zwischen Kopf, Kasten und Schreibzeilen kommen als `rowGap` aus dem
 * Modell (`sectionGap`), nicht aus einer Klasse: Der Umbruch wurde damit gerechnet.
 */

const TITEL_FAKTOR = 1.15;
const UNTERTITEL_FAKTOR = 0.8;
const FUSS_FAKTOR = 0.8;

export function SentencePageView({
  page,
  geometry,
  metrics,
  totalPages,
  optik,
}: {
  readonly page: SentenceLayoutPage;
  readonly geometry: PageGeometry;
  readonly metrics: SentenceLayoutMetrics;
  readonly totalPages: number;
  readonly optik: SatzOptik;
}) {
  const { typography } = optik;

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
          rowGap: cssMm(metrics.sectionGap),
        }}
      >
        {page.header !== null && (
          <header className="flex shrink-0 flex-col gap-1">
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

        {page.table !== null && (
          <section className="flex shrink-0 flex-col gap-1">
            {page.boxHeading !== null && (
              <h3
                className="font-semibold text-ink-2"
                style={{ fontSize: cssPt(pt(typography.fontSize * UNTERTITEL_FAKTOR)) }}
              >
                {page.boxHeading}
              </h3>
            )}
            <SentenceTableView table={page.table} optik={optik} />
          </section>
        )}

        {page.writingLines.length > 0 && (
          <section className="flex shrink-0 flex-col gap-1">
            {page.linesHeading !== null && (
              <h3
                className="font-semibold text-ink-2"
                style={{ fontSize: cssPt(pt(typography.fontSize * UNTERTITEL_FAKTOR)) }}
              >
                {page.linesHeading}
              </h3>
            )}
            <WritingLinesView
              blocks={page.writingLines}
              pitch={metrics.linePitch}
              width={geometry.contentWidth}
              typography={typography}
              numbered={optik.numbered}
            />
          </section>
        )}

        {optik.showPageNumbers && totalPages > 1 && (
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
