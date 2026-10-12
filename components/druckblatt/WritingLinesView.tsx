import type { TypographyConfig } from "@/lib/druckblatt/definition/types";
import type { LineRole } from "@/lib/druckblatt/rendering/lineatur";
import type { WritingLineBlock } from "@/lib/druckblatt/rendering/sentence-layout-model";
import { cssMm, cssPt, mm, ptToMm, scaleMm, subMm, type Mm } from "@/lib/druckblatt/units";
import { klassen } from "./klassen";

/**
 * Schreibzeilen mit Schullineatur.
 *
 * GEOMETRIE (Abstände der Linien, Bandhöhe) kommt in Millimetern aus dem
 * Layoutmodell — sie folgt DIN 16552-1 und darf nicht von der Optik abhängen.
 * OPTIK (Farbe) kommt ausschließlich aus Tokens, abgeleitet aus der **Rolle** der
 * Linie.
 *
 * Warum die Rolle und nicht eine Strichstärke im Modell steht: Die Grundlinie muss
 * kräftiger sein als die Hilfslinien — aber wie viel kräftiger, ist eine Frage der
 * Ausgabe und keine des Dokuments.
 *
 * Die Linien sind Ränder, keine Hintergründe: Ein `border-top` druckt auch dann,
 * wenn der Drucker „Hintergrundgrafiken" nicht mitdruckt.
 */

const LINIENFARBE: Record<LineRole, string> = {
  /* Die Grundlinie trägt die Schrift und muss auf einen Blick zu finden sein. */
  grundlinie: "border-ink-3",
  oberlinie: "border-line-strong",
  mittellinie: "border-line-strong",
  unterlinie: "border-line-strong",
};

/**
 * Abstand der Ziffer von der Unterkante des Bandes.
 *
 * Die Ziffer soll auf der Grundlinie sitzen. Die liegt bei vier Linien eine
 * Unterlänge über dem Bandende, bei einer einzelnen Linie genau darauf.
 */
function numberBottom(block: WritingLineBlock): Mm {
  const grundlinie = block.lines.find((linie) => linie.role === "grundlinie");
  if (grundlinie === undefined) return mm(0);
  return subMm(block.bandHeight, grundlinie.offset);
}

export function WritingLinesView({
  blocks,
  pitch,
  width,
  typography,
  numbered,
}: {
  readonly blocks: readonly WritingLineBlock[];
  readonly pitch: Mm;
  readonly width: Mm;
  readonly typography: TypographyConfig;
  readonly numbered: boolean;
}) {
  if (blocks.length === 0) return null;

  /*
   * Der Platz für die Nummer wächst mit der Schrift mit. Feste Millimeter würden
   * bei großer Fibelschrift die Ziffer an die Linie quetschen.
   */
  const nummernBreite = numbered ? scaleMm(ptToMm(typography.fontSize), 1.6) : mm(0);
  const band = blocks[0]?.bandHeight ?? mm(0);
  const luecke = mm(Math.max(0, pitch - band));

  return (
    <div className="flex flex-col" style={{ rowGap: cssMm(luecke) }}>
      {blocks.map((block) => (
        <div
          key={block.number}
          className="relative"
          style={{ height: cssMm(block.bandHeight), width: cssMm(width) }}
        >
          {numbered && (
            <span
              className="absolute left-0 leading-none text-ink-2"
              style={{
                bottom: cssMm(numberBottom(block)),
                fontSize: cssPt(typography.fontSize),
              }}
            >
              {block.number}.
            </span>
          )}

          {/* Bei `blanko` ist die Liste leer: kein Strich, aber die Zeile
              beansprucht trotzdem ihren Platz. */}
          {block.lines.map((linie) => (
            <div
              key={linie.role}
              aria-hidden
              className={klassen("absolute right-0 h-0 border-t", LINIENFARBE[linie.role])}
              style={{ top: cssMm(linie.offset), left: cssMm(nummernBreite) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
