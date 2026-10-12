"use client";

import { useMemo, useReducer, type Dispatch } from "react";
import { formatWordList, parseWordList } from "@/lib/druckblatt/content/word-list";
import type { SyllableMatrixConfig } from "@/lib/druckblatt/content/matrix";
import { CONSTRAINTS } from "@/lib/druckblatt/definition/constraints";
import { DEFAULT_MATRIX_CONTENT, DEFAULT_WORD_LIST } from "@/lib/druckblatt/definition/defaults";
import { pruefeLesetabelle } from "@/lib/druckblatt/definition/schemas";
import type { CellDecoration, SyllableColoring, WorksheetDefinition } from "@/lib/druckblatt/definition/types";
import { baueLesetabelle } from "@/lib/druckblatt/state/aufbau";
import {
  LESETABELLE_START,
  lesetabelleReducer,
  type LesetabelleAktion,
} from "@/lib/druckblatt/state/worksheet-state";
import { BlattFehler, BlattSeite } from "./BlattSeite";
import { BlattPanel } from "./BlattPanel";
import { Auswahl, Panel, Schalter, Textbereich, Textfeld, Zahlenfeld } from "./Felder";
import { WorksheetView } from "./WorksheetView";

/**
 * Die Lesetabelle: Silben oder Wörter in einem gleichmäßigen Raster.
 *
 * Zustand und Rechnen kommen von außen — `lesetabelleReducer` (Port des
 * Zustand-Slices) und `baueLesetabelle` (Layout mit Netz). Diese Komponente
 * verdrahtet beides mit den Panels und der Vorschau.
 *
 * Dieselbe Datei enthält die vier Panels: Sie greifen alle auf denselben Reducer
 * zu, und getrennte Dateien hätten nur Requisiten hin und her gereicht.
 */
export function LesetabelleGenerator() {
  const [zustand, dispatch] = useReducer(lesetabelleReducer, LESETABELLE_START);
  const aufbau = useMemo(() => baueLesetabelle(zustand.definition), [zustand.definition]);
  const { definition } = zustand;

  return (
    <BlattSeite
      kennzahl={
        aufbau.ok
          ? `${aufbau.model.cellCount} ${aufbau.model.cellCount === 1 ? "Zelle" : "Zellen"} · ${seitenText(aufbau.model.pages.length)}`
          : "noch kein Blatt"
      }
      seiteMm={aufbau.ok ? aufbau.model.geometry.pageWidth : 0}
      zoom={zustand.zoom}
      onZoom={(faktor) => dispatch({ art: "zoom", faktor })}
      onZuruecksetzen={() => dispatch({ art: "zuruecksetzen" })}
      fehler={zustand.fehler}
      pruefen={() => {
        /* Grenze „Definition raus": gedruckt wird nur, was das Schema annimmt. */
        const geprueft = pruefeLesetabelle(definition);
        return geprueft.ok ? null : geprueft.fehler.join(" ");
      }}
      einstellungen={
        <>
          <InhaltPanel definition={definition} dispatch={dispatch} />
          <RasterPanel definition={definition} dispatch={dispatch} />
          <SchriftPanel definition={definition} dispatch={dispatch} />
          <BlattPanel
            titel={definition.title}
            showTitle={definition.showTitle}
            showPageNumbers={definition.showPageNumbers}
            page={definition.page}
            onTitel={(title) => dispatch({ art: "meta", patch: { title } })}
            onTitelZeigen={(showTitle) => dispatch({ art: "meta", patch: { showTitle } })}
            onSeitenzahlen={(showPageNumbers) => dispatch({ art: "meta", patch: { showPageNumbers } })}
            onSeite={(patch) => dispatch({ art: "seite", patch })}
            onAlleRaender={(millimeter) => dispatch({ art: "alleRaender", millimeter })}
            zusatz={
              <Textfeld
                label="Untertitel"
                wert={definition.subtitle}
                onWert={(subtitle) => dispatch({ art: "meta", patch: { subtitle } })}
              />
            }
          />
        </>
      }
      vorschau={
        aufbau.ok ? (
          <WorksheetView model={aufbau.model} definition={definition} />
        ) : (
          <BlattFehler text={aufbau.fehler} />
        )
      }
    />
  );
}

function seitenText(anzahl: number): string {
  return anzahl === 1 ? "1 Seite" : `${anzahl} Seiten`;
}

/* --- Inhalt ---------------------------------------------------------------- */

function InhaltPanel({
  definition,
  dispatch,
}: {
  readonly definition: WorksheetDefinition;
  readonly dispatch: Dispatch<LesetabelleAktion>;
}) {
  const { content } = definition;

  return (
    <Panel titel="Inhalt">
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn btn-sm flex-1 ${content.kind === "matrix" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => dispatch({ art: "inhalt", content: DEFAULT_MATRIX_CONTENT })}
        >
          Silben
        </button>
        <button
          type="button"
          className={`btn btn-sm flex-1 ${content.kind === "wordList" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => dispatch({ art: "inhalt", content: DEFAULT_WORD_LIST })}
        >
          Wörter
        </button>
      </div>

      {content.kind === "wordList" ? (
        <Textbereich
          label="Wörter"
          hinweis="Ein Eintrag je Zeile. Komma, Semikolon und Tabulator trennen ebenfalls — eingefügte Listen aus Word oder Excel funktionieren damit unverändert."
          wert={formatWordList(content.words)}
          onWert={(text) => dispatch({ art: "woerter", text })}
        />
      ) : (
        <>
          <Textfeld
            label="Anlaute"
            hinweis="Was vor dem Vokal steht: M, L, S …"
            wert={content.config.onsets.join(", ")}
            onWert={(wert) => dispatch({ art: "matrix", patch: { onsets: parseWordList(wert) } })}
          />
          <Textfeld
            label="Vokale"
            wert={content.config.nuclei.join(", ")}
            onWert={(wert) => dispatch({ art: "matrix", patch: { nuclei: parseWordList(wert) } })}
          />
          <Textfeld
            label="Auslaut"
            hinweis="Optional. „n“ ergibt Man, Men, Min …"
            wert={content.config.coda}
            onWert={(coda) => dispatch({ art: "matrix", patch: { coda } })}
          />
          <Auswahl
            label="Reihenfolge"
            wert={content.config.order}
            optionen={[
              { wert: "onset-major" as SyllableMatrixConfig["order"], text: "Anlaut zuerst (Ma Me Mi …)" },
              { wert: "nucleus-major" as SyllableMatrixConfig["order"], text: "Vokal zuerst (Ma La Sa …)" },
            ]}
            onWert={(order) => dispatch({ art: "matrix", patch: { order } })}
          />
          <Schalter
            label="Ersten Buchstaben großschreiben"
            wert={content.config.capitalize}
            onWert={(capitalize) => dispatch({ art: "matrix", patch: { capitalize } })}
          />
        </>
      )}
    </Panel>
  );
}

/* --- Raster ---------------------------------------------------------------- */

function RasterPanel({
  definition,
  dispatch,
}: {
  readonly definition: WorksheetDefinition;
  readonly dispatch: Dispatch<LesetabelleAktion>;
}) {
  const { grid, content } = definition;
  const durchMatrix = content.kind === "matrix";

  return (
    <Panel titel="Raster">
      <div className="grid grid-cols-2 gap-3">
        <Zahlenfeld
          label="Spalten"
          wert={grid.columns}
          bereich={CONSTRAINTS.columns}
          disabled={durchMatrix}
          hinweis={durchMatrix ? "Die Silbenmatrix gibt die Spaltenzahl vor." : undefined}
          onWert={(columns) => dispatch({ art: "raster", patch: { columns } })}
        />
        <Zahlenfeld
          label="Zeilenhöhe"
          wert={grid.rowHeight}
          bereich={CONSTRAINTS.rowHeight}
          einheit="mm"
          onWert={(rowHeight) => dispatch({ art: "raster", patch: { rowHeight } })}
        />
        <Zahlenfeld
          label="Spaltenabstand"
          wert={grid.columnGap}
          bereich={CONSTRAINTS.gap}
          einheit="mm"
          onWert={(columnGap) => dispatch({ art: "raster", patch: { columnGap } })}
        />
        <Zahlenfeld
          label="Zeilenabstand"
          wert={grid.rowGap}
          bereich={CONSTRAINTS.gap}
          einheit="mm"
          onWert={(rowGap) => dispatch({ art: "raster", patch: { rowGap } })}
        />
      </div>

      <Auswahl
        label="Zellrahmen"
        wert={grid.decoration}
        optionen={[
          { wert: "none" as CellDecoration, text: "ohne" },
          { wert: "baseline" as CellDecoration, text: "Grundlinie" },
          { wert: "box" as CellDecoration, text: "Kasten" },
        ]}
        onWert={(decoration) => dispatch({ art: "raster", patch: { decoration } })}
      />
    </Panel>
  );
}

/* --- Schrift --------------------------------------------------------------- */

function SchriftPanel({
  definition,
  dispatch,
}: {
  readonly definition: WorksheetDefinition;
  readonly dispatch: Dispatch<LesetabelleAktion>;
}) {
  const { typography, coloring } = definition;

  return (
    <Panel titel="Schrift">
      <div className="grid grid-cols-3 gap-3">
        <Zahlenfeld
          label="Größe"
          wert={typography.fontSize}
          bereich={CONSTRAINTS.fontSize}
          einheit="pt"
          onWert={(fontSize) => dispatch({ art: "schrift", patch: { fontSize } })}
        />
        <Zahlenfeld
          label="Zeilenhöhe"
          wert={typography.lineHeight}
          bereich={CONSTRAINTS.lineHeight}
          onWert={(lineHeight) => dispatch({ art: "schrift", patch: { lineHeight } })}
        />
        <Zahlenfeld
          label="Laufweite"
          wert={typography.letterSpacing}
          bereich={CONSTRAINTS.letterSpacing}
          einheit="pt"
          onWert={(letterSpacing) => dispatch({ art: "schrift", patch: { letterSpacing } })}
        />
      </div>

      <Auswahl
        label="Silbenfarben"
        hinweis="Zwei Farben im Wechsel zeigen die Silbengrenzen (Silbenbogen-Prinzip)."
        wert={coloring}
        optionen={[
          { wert: "none" as SyllableColoring, text: "einfärbig" },
          { wert: "alternating" as SyllableColoring, text: "im Wechsel" },
        ]}
        onWert={(wert) => dispatch({ art: "meta", patch: { coloring: wert } })}
      />

      <Schalter
        label="fett"
        wert={typography.bold}
        onWert={(bold) => dispatch({ art: "schrift", patch: { bold } })}
      />
    </Panel>
  );
}
