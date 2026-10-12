import { cssMm, cssPt, pt } from "@/lib/druckblatt/units";
import type { LayoutMetrics, LayoutPage } from "@/lib/druckblatt/rendering/layout-model";
import type { PageGeometry } from "@/lib/druckblatt/rendering/geometry";
import { CellView, type ZellOptik } from "./CellView";

/**
 * Ein physisches Blatt der Lesetabelle.
 *
 * Aufbau: Das Blatt hat exakt die Papiermaße (inline in Millimetern), der
 * Satzspiegel liegt absolut positioniert darin. Zusammen mit `@page { margin: 0 }`
 * bedeutet das: Nicht der Browser bestimmt die Seitenränder, sondern wir. Die
 * Vorschau ist dadurch geometrisch identisch mit dem Ausdruck.
 *
 * Der Kopfbereich hat eine feste Höhe aus dem Layoutmodell. Seine Schriftgrößen
 * sind daraus abgeleitet (dieselben Faktoren, mit denen `deriveHeaderHeight` die
 * Höhe schätzt) — sie stehen als Inline-Style am Element, weil sie zum Dokument
 * gehören und nicht zur Gestaltung.
 */

/** Wie `deriveHeaderHeight` in `rendering/geometry.ts` rechnet: Titel 1,15-fach. */
const TITEL_FAKTOR = 1.15;
/** Untertitel und Kopfzeile kleiner als der Lesetext. */
const UNTERTITEL_FAKTOR = 0.85;
const FUSS_FAKTOR = 0.8;

export function PageView({
  page,
  geometry,
  metrics,
  totalPages,
  optik,
  showPageNumbers,
}: {
  readonly page: LayoutPage;
  readonly geometry: PageGeometry;
  readonly metrics: LayoutMetrics;
  readonly totalPages: number;
  readonly optik: ZellOptik;
  readonly showPageNumbers: boolean;
}) {
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
            className="flex shrink-0 flex-col items-center justify-start"
            style={{ height: cssMm(geometry.headerHeight) }}
          >
            <h2
              className="leading-tight"
              style={{ fontSize: cssPt(pt(optik.typography.fontSize * TITEL_FAKTOR)) }}
            >
              {page.header.title}
            </h2>
            {page.header.subtitle !== "" && (
              <p
                className="text-ink-2"
                style={{ fontSize: cssPt(pt(optik.typography.fontSize * UNTERTITEL_FAKTOR)) }}
              >
                {page.header.subtitle}
              </p>
            )}
          </header>
        )}

        <div className="flex flex-col" style={{ rowGap: cssMm(metrics.rowGap) }}>
          {page.rows.map((row) => (
            <div key={row.index} className="flex" style={{ columnGap: cssMm(metrics.columnGap) }}>
              {row.cells.map((cell) => (
                <CellView
                  key={cell.id}
                  cell={cell}
                  width={metrics.cellWidth}
                  height={metrics.rowHeight}
                  optik={optik}
                />
              ))}
            </div>
          ))}
        </div>

        {showPageNumbers && totalPages > 1 && (
          <footer
            className="mt-auto shrink-0 text-center text-ink-3"
            style={{ fontSize: cssPt(pt(optik.typography.fontSize * FUSS_FAKTOR)) }}
          >
            {page.pageNumber} / {totalPages}
          </footer>
        )}
      </div>
    </div>
  );
}
