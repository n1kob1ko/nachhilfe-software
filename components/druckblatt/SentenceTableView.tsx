import type { TableBorders } from "@/lib/druckblatt/definition/sentence-box-types";
import type { TypographyConfig } from "@/lib/druckblatt/definition/types";
import type { SentenceLayoutTable } from "@/lib/druckblatt/rendering/sentence-layout-model";
import { cssMm, cssPt, pt } from "@/lib/druckblatt/units";
import { klassen } from "./klassen";

/**
 * Der Satzbaukasten als Raster.
 *
 * Bewusst `div`-Raster statt `<table>`: Die Zellen tragen keine Beziehung
 * zueinander, die ein Screenreader als Tabelle vorlesen sollte — es ist ein
 * Wortvorrat, kein Datensatz. Ein `<table>` würde „Zeile 3, Spalte 2" ansagen,
 * was hier nichts bedeutet.
 *
 * Geometrie in Millimetern aus dem Layoutmodell, Rahmen und Farben aus Tokens.
 */

export interface SatzOptik {
  readonly typography: TypographyConfig;
  readonly borders: TableBorders;
  readonly numbered: boolean;
  readonly showPageNumbers: boolean;
}

interface Rahmen {
  readonly aussen: string;
  readonly zelle: string;
}

const RAHMEN: Record<TableBorders, Rahmen> = {
  all: { aussen: "border-t border-l border-ink-3", zelle: "border-r border-b border-ink-3" },
  outline: { aussen: "border border-ink-3", zelle: "" },
  columns: { aussen: "border-l border-ink-3", zelle: "border-r border-ink-3" },
  none: { aussen: "", zelle: "" },
};

/** Überschriften sind Wegweiser für die Lehrkraft, nicht Lesestoff für das Kind. */
const UEBERSCHRIFT_FAKTOR = 0.8;

export function SentenceTableView({
  table,
  optik,
}: {
  readonly table: SentenceLayoutTable;
  readonly optik: SatzOptik;
}) {
  const rahmen = RAHMEN[optik.borders];

  const zellStil = {
    width: cssMm(table.columnWidth),
    height: cssMm(table.rowHeight),
    fontSize: cssPt(optik.typography.fontSize),
    letterSpacing: cssPt(optik.typography.letterSpacing),
  };

  return (
    <div className={klassen("flex flex-col", rahmen.aussen)}>
      {table.headings !== null && (
        <div className="flex">
          {table.headings.map((ueberschrift, position) => (
            <div
              key={`ueberschrift-${position}`}
              className={klassen(
                "flex items-center justify-center overflow-hidden px-1 text-center leading-tight font-semibold text-ink-2",
                rahmen.zelle,
              )}
              style={{
                width: cssMm(table.columnWidth),
                height: cssMm(table.rowHeight),
                fontSize: cssPt(pt(optik.typography.fontSize * UEBERSCHRIFT_FAKTOR)),
              }}
            >
              {ueberschrift}
            </div>
          ))}
        </div>
      )}

      {table.rows.map((row) => (
        <div key={row.index} className="flex">
          {row.cells.map((cell) => (
            <div
              key={cell.id}
              className={klassen(
                "flex items-center justify-center overflow-hidden px-1 text-center leading-tight",
                rahmen.zelle,
                optik.typography.bold && "font-bold",
              )}
              style={zellStil}
            >
              {cell.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
