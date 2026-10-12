import type { CellDecoration, SyllableColoring, TypographyConfig } from "@/lib/druckblatt/definition/types";
import type { LayoutCell } from "@/lib/druckblatt/rendering/layout-model";
import { cssMm, cssPt, type Mm } from "@/lib/druckblatt/units";
import { klassen } from "./klassen";

/**
 * Eine Zelle der Lesetabelle.
 *
 * GEOMETRIE (Breite, Höhe, Schriftgrad, Laufweite) kommt als Inline-Style aus dem
 * Layoutmodell — das sind Dokumentdaten in Millimetern bzw. Punkt.
 * OPTIK (Farbe, Schriftfamilie, Rahmen) kommt ausschließlich aus Design-Tokens
 * (`app/globals.css` über Tailwind-Klassen).
 *
 * Die Darstellungsabsicht kommt als Prop, nicht mehr über einen React-Kontext:
 * Der Kontext diente nur dazu, dieselbe Struktur durch drei Ebenen zu reichen.
 * Ein einfaches Prop tut dasselbe, ohne dass die Zelle ihre Eltern kennen muss.
 */

export interface ZellOptik {
  readonly typography: TypographyConfig;
  readonly decoration: CellDecoration;
  readonly coloring: SyllableColoring;
}

/** Rahmen: `border-ink-3` und `border-line-strong` sind Tokens, keine Farbwerte. */
const ZELLRAHMEN: Record<CellDecoration, string> = {
  none: "",
  baseline: "border-b border-ink-3",
  box: "border border-ink-3",
};

/**
 * Silbenfarben im Wechsel — das Silbenbogen-Prinzip als Farbwechsel.
 *
 * Zwei klar unterscheidbare Töne aus den Tokens; Rot bleibt Fehlern vorbehalten
 * (DESIGN.md).
 */
const SILBENFARBE = ["text-accent", "text-violet"] as const;

export function CellView({
  cell,
  width,
  height,
  optik,
}: {
  readonly cell: LayoutCell;
  readonly width: Mm;
  readonly height: Mm;
  readonly optik: ZellOptik;
}) {
  return (
    <div
      className={klassen(
        "flex items-center justify-center overflow-hidden text-center leading-none",
        ZELLRAHMEN[optik.decoration],
        optik.typography.bold && "font-bold",
      )}
      style={{
        width: cssMm(width),
        height: cssMm(height),
        fontSize: cssPt(optik.typography.fontSize),
        letterSpacing: cssPt(optik.typography.letterSpacing),
      }}
    >
      {optik.coloring === "none" ? (
        <span>{cell.text}</span>
      ) : (
        <span>
          {cell.syllables.map((silbe, index) => (
            <span
              /* Silben haben keine eigene Identität; ihre Position IST ihre
                 Identität. */
              key={`${cell.id}-${index}`}
              className={SILBENFARBE[index % SILBENFARBE.length]}
            >
              {silbe}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
