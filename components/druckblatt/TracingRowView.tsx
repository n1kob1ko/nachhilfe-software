import type { TraceCell } from "@/lib/druckblatt/content/tracing";
import type { ScriptId } from "@/lib/druckblatt/rendering/handwriting-scripts";
import type { LineRole } from "@/lib/druckblatt/rendering/lineatur";
import type { TracingLayoutRow } from "@/lib/druckblatt/rendering/build-tracing-layout";
import { cssMm, cssPt, mm, subMm, type Mm, type Pt } from "@/lib/druckblatt/units";
import { klassen } from "./klassen";

/**
 * Eine Übungszeile: Lineatur plus die Zeichen darauf.
 *
 * GEOMETRIE (Linienpositionen, Feldbreite, Schriftgröße) kommt aus dem
 * Layoutmodell — die Schriftgröße ist dort aus dem Mittelband gerechnet, damit die
 * Buchstaben auf den Linien sitzen.
 *
 * OPTIK kommt aus Tokens. Die einzige Rechnung hier ist Stärke → Deckkraft, und
 * die gehört hierher: Die Domain weiß, WIE VIEL Hilfe eine Position bekommt; wie
 * blass das auf Papier sein darf, weiß nur die Ausgabe.
 */

const LINIENFARBE: Record<LineRole, string> = {
  grundlinie: "border-ink-3",
  oberlinie: "border-line-strong",
  mittellinie: "border-line-strong",
  unterlinie: "border-line-strong",
};

/**
 * Welche Schrift gesetzt wird. Die Kennung kommt aus dem Layoutmodell — fehlt die
 * Datei, ist das dort schon auf die Druckschrift umgestellt und gemeldet
 * (`scriptSubstituted`). Die Klassen stehen hier bereit, damit eine später
 * ergänzte Schriftdatei nur `@font-face` und diese Zuordnung braucht.
 */
const SCHRIFTKLASSE: Record<ScriptId, string> = {
  druckschrift: "db-schrift-druckschrift",
  va: "db-schrift-va",
  sas: "db-schrift-sas",
  la: "db-schrift-la",
};

/**
 * Untergrenze der Deckkraft.
 *
 * Ein Schuldrucker bringt unter etwa 25 Prozent nichts Erkennbares mehr aufs
 * Papier. Die Domain rechnet bis 0,15 herunter — hier wird der Bereich auf das
 * gestreckt, was tatsächlich sichtbar ankommt.
 */
const MIN_DECKKRAFT = 0.25;
const MAX_DECKKRAFT = 0.85;

function deckkraft(zelle: TraceCell): number {
  if (zelle.style === "model") return 1;
  if (zelle.style === "empty") return 0;
  return MIN_DECKKRAFT + zelle.strength * (MAX_DECKKRAFT - MIN_DECKKRAFT);
}

/**
 * Konturschrift über `-webkit-text-stroke`.
 *
 * WARUM NICHT EINE EIGENE UMRISS-SCHRIFT: Die gäbe es je Schulschrift extra und
 * meist nur gekauft. Der Textumriss funktioniert mit JEDER Schrift, auch mit einer,
 * die erst später dazukommt.
 *
 * Der Eigenschaftsname trägt ein Herstellerpräfix, wird aber von allen aktuellen
 * Browsern unterstützt und druckt zuverlässig. Ohne Unterstützung bleibt der
 * Buchstabe gefüllt — unschön, aber nicht kaputt.
 */
function umriss(zelle: TraceCell): React.CSSProperties {
  if (zelle.style !== "outline") return {};
  return {
    WebkitTextStrokeWidth: "0.4pt",
    WebkitTextStrokeColor: "currentColor",
    color: "transparent",
  };
}

/** Abstand der Grundlinie von der Unterkante der Zeile. */
function grundlinienAbstand(row: TracingLayoutRow): Mm {
  const grundlinie = row.lines.find((linie) => linie.role === "grundlinie");
  if (grundlinie === undefined) return mm(0);
  return subMm(row.bandHeight, grundlinie.offset);
}

export function TracingRowView({
  row,
  fontSize,
  script,
  width,
}: {
  readonly row: TracingLayoutRow;
  readonly fontSize: Pt;
  readonly script: ScriptId;
  readonly width: Mm;
}) {
  return (
    <div className="relative" style={{ height: cssMm(row.bandHeight), width: cssMm(width) }}>
      {/* Linien zuerst — die Zeichen liegen darüber. */}
      {row.lines.map((linie) => (
        <div
          key={linie.role}
          aria-hidden
          className={klassen("absolute inset-x-0 h-0 border-t", LINIENFARBE[linie.role])}
          style={{ top: cssMm(linie.offset) }}
        />
      ))}

      {row.cells.map((zelle) => (
        <span
          key={zelle.index}
          className={klassen("absolute text-center leading-none", SCHRIFTKLASSE[script])}
          style={{
            left: cssMm(mm(zelle.index * row.cellWidth)),
            width: cssMm(row.cellWidth),
            /*
             * An der Grundlinie ausgerichtet, nicht am Zeilenkasten: Genau dort
             * sitzt die Schrift auch beim Schreiben. Ohne das schwebten die
             * Buchstaben je nach Lineatur unterschiedlich hoch.
             */
            bottom: cssMm(grundlinienAbstand(row)),
            fontSize: cssPt(fontSize),
            opacity: deckkraft(zelle),
            ...umriss(zelle),
          }}
        >
          {zelle.style === "empty" ? "" : zelle.text}
        </span>
      ))}
    </div>
  );
}
