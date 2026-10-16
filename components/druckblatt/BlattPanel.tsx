"use client";

import { CONSTRAINTS } from "@/lib/druckblatt/definition/constraints";
import type { PageInput, TypographyInput } from "@/lib/druckblatt/definition/sanitize";
import type {
  Orientation,
  PageConfig,
  PageSizeId,
} from "@/lib/druckblatt/definition/types";
import { PAGE_SIZES } from "@/lib/druckblatt/rendering/geometry";
import type { ReactNode } from "react";
import { Auswahl, Panel, Schalter, Textfeld, Zahlenfeld } from "./Felder";

/**
 * Das Blatt selbst: Papierformat, Ränder, Titel, Seitenzahlen.
 *
 * Dieses Panel ist für alle drei Blatttypen dasselbe — Papier ist Papier. Die
 * Quelle hatte dafür zwei fast gleiche Panels (`PagePanel` und `SheetPanel`);
 * hier steht es einmal, und jeder Generator reicht seine eigenen Aktionen hinein.
 *
 * Die Millimeter der Ränder sind hier eine **Eingabe**, nicht die Geometrie des
 * Blattes: Was daraus wird, rechnet der Layouter.
 */

const RAENDER = ["top", "right", "bottom", "left"] as const;
type Rand = (typeof RAENDER)[number];

const RAND_LABEL: Record<Rand, string> = {
  top: "oben",
  right: "rechts",
  bottom: "unten",
  left: "links",
};

const FORMAT_OPTIONEN = Object.entries(PAGE_SIZES).map(([wert, groesse]) => ({
  wert: wert as PageSizeId,
  text: groesse.label,
}));

export function BlattPanel({
  titel,
  showTitle,
  showPageNumbers,
  page,
  onTitel,
  onTitelZeigen,
  onSeitenzahlen,
  onSeite,
  onAlleRaender,
  typografie,
  onTypografie,
  zusatz,
}: {
  readonly titel: string;
  readonly showTitle: boolean;
  readonly showPageNumbers: boolean;
  readonly page: PageConfig;
  readonly onTitel: (titel: string) => void;
  readonly onTitelZeigen: (wert: boolean) => void;
  readonly onSeitenzahlen: (wert: boolean) => void;
  readonly onSeite: (patch: PageInput) => void;
  readonly onAlleRaender?: (millimeter: number) => void;
  readonly typografie?: { readonly fontSize: number; readonly bold: boolean };
  readonly onTypografie?: (patch: TypographyInput) => void;
  /** Felder, die nur diesen Blatttyp betreffen (Arbeitsauftrag, Überschriften). */
  readonly zusatz?: ReactNode;
}) {
  return (
    <Panel titel="Blatt">
      <Textfeld label="Blatttitel" wert={titel} onWert={onTitel} />
      {zusatz}

      <div className="grid grid-cols-2 gap-3">
        <Auswahl
          label="Papierformat"
          wert={page.size}
          optionen={FORMAT_OPTIONEN}
          onWert={(size) => onSeite({ size })}
        />
        <Auswahl
          label="Ausrichtung"
          wert={page.orientation}
          optionen={[
            { wert: "portrait" as Orientation, text: "hoch" },
            { wert: "landscape" as Orientation, text: "quer" },
          ]}
          onWert={(orientation) => onSeite({ orientation })}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {RAENDER.map((rand) => (
          <Zahlenfeld
            key={rand}
            label={RAND_LABEL[rand]}
            wert={page.margins[rand]}
            bereich={CONSTRAINTS.margin}
            einheit="mm"
            onWert={(millimeter) => onSeite({ margins: { [rand]: millimeter } })}
          />
        ))}
      </div>

      {onAlleRaender && (
        <Zahlenfeld
          label="Alle Ränder gleich"
          wert={page.margins.left}
          bereich={CONSTRAINTS.margin}
          einheit="mm"
          hinweis="Setzt alle vier Ränder auf denselben Wert."
          onWert={onAlleRaender}
        />
      )}

      {typografie && onTypografie && (
        <div className="grid grid-cols-2 items-end gap-3">
          <Zahlenfeld
            label="Schriftgröße"
            wert={typografie.fontSize}
            bereich={CONSTRAINTS.fontSize}
            einheit="pt"
            hinweis="Gilt für Titel und Arbeitsauftrag; die Zeilen richten sich nach der Lineatur."
            onWert={(fontSize) => onTypografie({ fontSize })}
          />
          <Schalter label="fett" wert={typografie.bold} onWert={(bold) => onTypografie({ bold })} />
        </div>
      )}

      <Schalter
        label="Titel zeigen"
        wert={showTitle}
        hinweis="Ohne Titel bleibt der Kopfbereich leer — die Zeilen rücken nach oben."
        onWert={onTitelZeigen}
      />
      <Schalter
        label="Seitenzahlen zeigen"
        wert={showPageNumbers}
        hinweis="Erscheinen nur, wenn das Blatt mehr als eine Seite hat."
        onWert={onSeitenzahlen}
      />
    </Panel>
  );
}
