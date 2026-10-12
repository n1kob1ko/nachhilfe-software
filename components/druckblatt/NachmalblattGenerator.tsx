"use client";

import { useMemo, useReducer, type Dispatch } from "react";
import {
  ALPHABET_LOWER,
  ALPHABET_UPPER,
  FADE_MODES,
  TRACE_UNITS,
  UMLAUTS_LOWER,
  UMLAUTS_UPPER,
  type FadeMode,
  type TraceUnit,
} from "@/lib/druckblatt/content/tracing";
import { CONSTRAINTS } from "@/lib/druckblatt/definition/constraints";
import { fehlendeSchriftHinweis, pruefeNachmalblatt } from "@/lib/druckblatt/definition/schemas";
import type { TracingDefinition } from "@/lib/druckblatt/definition/tracing-types";
import {
  HANDWRITING_SCRIPTS,
  SCRIPT_IDS,
  type ScriptId,
} from "@/lib/druckblatt/rendering/handwriting-scripts";
import { LINEATUREN, LINEATUR_IDS, type LineaturId } from "@/lib/druckblatt/rendering/lineatur";
import { baueNachmalblatt, gezeichneteZeichen } from "@/lib/druckblatt/state/aufbau";
import {
  NACHMALBLATT_START,
  nachmalblattReducer,
  type NachmalblattAktion,
} from "@/lib/druckblatt/state/tracing-state";
import { BlattFehler, BlattSeite } from "./BlattSeite";
import { BlattPanel } from "./BlattPanel";
import { Auswahl, Panel, Schalter, Textbereich, Warnung, Zahlenfeld } from "./Felder";
import { TracingView } from "./TracingView";

/**
 * Das Nachmalblatt: Buchstaben, Silben oder Wörter zum Nachspuren, mit von Zeile
 * zu Zeile abnehmender Hilfe.
 *
 * Der Kern dieses Blattes ist ein Zusammenspiel: Die Lineatur gibt das Mittelband
 * vor, aus dem die Schriftgröße gerechnet wird. Deshalb steht die Lineatur hier
 * bei den Hilfen und nicht beim Blatt — sie ist Lerninhalt, nicht Papier.
 *
 * Eine fehlende Schriftdatei wird gemeldet, nicht still ersetzt: Das Kind soll
 * genau diese Formen nachmalen (siehe `handwriting-scripts.ts`).
 */
export function NachmalblattGenerator() {
  const [zustand, dispatch] = useReducer(nachmalblattReducer, NACHMALBLATT_START);
  const aufbau = useMemo(() => baueNachmalblatt(zustand.definition), [zustand.definition]);
  const { definition } = zustand;

  return (
    <BlattSeite
      kennzahl={
        aufbau.ok
          ? `${aufbau.model.itemCount} ${aufbau.model.itemCount === 1 ? "Vorlage" : "Vorlagen"} · ${gezeichneteZeichen(aufbau.model)} Zeichen · ${seitenText(aufbau.model.pages.length)}`
          : "noch kein Blatt"
      }
      seiteMm={aufbau.ok ? aufbau.model.geometry.pageWidth : 0}
      zoom={zustand.zoom}
      onZoom={(faktor) => dispatch({ art: "zoom", faktor })}
      onZuruecksetzen={() => dispatch({ art: "zuruecksetzen" })}
      fehler={zustand.fehler}
      pruefen={() => {
        const geprueft = pruefeNachmalblatt(definition);
        return geprueft.ok ? null : geprueft.fehler.join(" ");
      }}
      einstellungen={
        <>
          <SchulschriftPanel definition={definition} dispatch={dispatch} />
          <InhaltPanel definition={definition} dispatch={dispatch} />
          <HilfenPanel definition={definition} dispatch={dispatch} />
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
            typografie={{ fontSize: definition.typography.fontSize, bold: definition.typography.bold }}
            onTypografie={(patch) => dispatch({ art: "schrift", patch })}
            zusatz={
              <Textbereich
                label="Arbeitsauftrag"
                zeilen={2}
                wert={definition.instruction}
                onWert={(instruction) => dispatch({ art: "meta", patch: { instruction } })}
              />
            }
          />
        </>
      }
      vorschau={
        aufbau.ok ? (
          <TracingView model={aufbau.model} definition={definition} />
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

const SCHRIFT_TEXT: Record<ScriptId, string> = {
  druckschrift: "Druckschrift",
  va: "Vereinfachte Ausgangsschrift",
  sas: "Schulausgangsschrift",
  la: "Lateinische Ausgangsschrift",
};

const EINHEIT_TEXT: Record<TraceUnit, string> = {
  letter: "Buchstaben",
  syllable: "Silben",
  word: "Wörter",
};

const VERLAUF_TEXT: Record<FadeMode, string> = {
  off: "gleich stark (keine Abnahme)",
  linear: "gleichmäßig abnehmend",
  half: "erste Hälfte mit Hilfe, zweite leer",
};

const LINEATUR_TEXT: Record<LineaturId, string> = {
  blanko: "blanko (nur Zeilenabstand)",
  lineatur0: "Lineatur 0 — vier Linien, 6 mm (1. Klasse)",
  lineatur1: "Lineatur 1 — vier Linien, 5 mm (1. Klasse)",
  lineatur2: "Lineatur 2 — vier Linien, 4 mm (2. Klasse)",
  lineatur3: "Lineatur 3 — zwei Linien, 3,5 mm (3. Klasse)",
  lineatur4: "Lineatur 4 — eine Linie, 10 mm Abstand (4. Klasse)",
};

/* --- Schulschrift ---------------------------------------------------------- */

function SchulschriftPanel({
  definition,
  dispatch,
}: {
  readonly definition: TracingDefinition;
  readonly dispatch: Dispatch<NachmalblattAktion>;
}) {
  const hinweis = fehlendeSchriftHinweis(definition.script);

  return (
    <Panel titel="Schulschrift">
      <Auswahl
        label="Schrift"
        wert={definition.script}
        optionen={SCRIPT_IDS.map((id) => ({
          wert: id,
          text: HANDWRITING_SCRIPTS[id].bundled ? SCHRIFT_TEXT[id] : `${SCHRIFT_TEXT[id]} — Datei fehlt`,
        }))}
        onWert={(script) => dispatch({ art: "schulschrift", script })}
      />

      {/* Ehrlich sein, bevor gedruckt wird: Ein Nachmalblatt in der falschen
          Schrift wäre schlimmer als eines, das sagt, dass die Schrift fehlt. */}
      {hinweis !== null && <Warnung>{hinweis}</Warnung>}

      <Zahlenfeld
        label="Schriftgröße feinjustieren"
        hinweis="1 = genau ins Mittelband gerechnet. Die Rechnung ist eine Näherung; hier lässt sie sich korrigieren."
        wert={definition.sizeAdjust}
        bereich={CONSTRAINTS.sizeAdjust}
        onWert={(wert) => dispatch({ art: "groesseJustieren", wert })}
      />
    </Panel>
  );
}

/* --- Inhalt ---------------------------------------------------------------- */

function InhaltPanel({
  definition,
  dispatch,
}: {
  readonly definition: TracingDefinition;
  readonly dispatch: Dispatch<NachmalblattAktion>;
}) {
  /* Aus einem Buchstabenband eine getrennte Liste machen — so bleibt die Eingabe
     auch bei Silben und Wörtern lesbar. */
  const gespreizt = (buchstaben: string): string => [...buchstaben].join(" ");

  return (
    <Panel titel="Inhalt">
      <Auswahl
        label="Womit geübt wird"
        wert={definition.unit}
        optionen={TRACE_UNITS.map((unit) => ({ wert: unit, text: EINHEIT_TEXT[unit] }))}
        onWert={(unit) => dispatch({ art: "einheit", unit })}
      />

      <Textbereich
        label="Vorlage"
        zeilen={4}
        hinweis={
          definition.unit === "letter"
            ? "Jedes Zeichen wird einzeln geübt. Getrennt wird an Leerzeichen, Komma und Zeilenumbruch."
            : "Getrennt wird an Leerzeichen, Komma und Zeilenumbruch."
        }
        wert={definition.content}
        onWert={(content) => dispatch({ art: "inhalt", content })}
      />

      {/* Ein Alphabet von Hand zu tippen ist Fleißarbeit ohne Erkenntnis. */}
      {definition.unit === "letter" && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dispatch({ art: "inhaltAnhaengen", text: gespreizt(ALPHABET_LOWER) })}
          >
            a–z
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dispatch({ art: "inhaltAnhaengen", text: gespreizt(ALPHABET_UPPER) })}
          >
            A–Z
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              dispatch({ art: "inhaltAnhaengen", text: gespreizt(UMLAUTS_LOWER + UMLAUTS_UPPER) })
            }
          >
            ä ö ü ß
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ art: "inhalt", content: "" })}
          >
            Leeren
          </button>
        </div>
      )}
    </Panel>
  );
}

/* --- Hilfen ---------------------------------------------------------------- */

function HilfenPanel({
  definition,
  dispatch,
}: {
  readonly definition: TracingDefinition;
  readonly dispatch: Dispatch<NachmalblattAktion>;
}) {
  const { rows, lines } = definition;
  const spezifikation = LINEATUREN[lines.lineatur];

  return (
    <Panel titel="Hilfen">
      <div className="grid grid-cols-2 gap-3">
        <Zahlenfeld
          label="Zeichen je Zeile"
          hinweis="Die Vorlage zählt mit."
          wert={rows.repeats}
          bereich={CONSTRAINTS.traceRepeats}
          onWert={(repeats) => dispatch({ art: "uebungszeilen", patch: { repeats } })}
        />
        <Zahlenfeld
          label="Freie Zeilen"
          hinweis="Nach jeder Vorlagenzeile."
          wert={rows.freeRows}
          bereich={CONSTRAINTS.traceFreeRows}
          onWert={(freeRows) => dispatch({ art: "uebungszeilen", patch: { freeRows } })}
        />
      </div>

      <Auswahl
        label="Darstellung"
        hinweis="Blass zum Nachfahren oder hohl zum Ausmalen."
        wert={rows.style}
        optionen={[
          { wert: "ghost", text: "blass nachfahren" },
          { wert: "outline", text: "Umriss zum Ausmalen" },
        ]}
        onWert={(style) => dispatch({ art: "uebungszeilen", patch: { style } })}
      />

      <Auswahl
        label="Abnehmende Hilfe"
        hinweis="Der Kern der Übung: Das Kind löst sich beim Schreiben von der Vorlage."
        wert={rows.fade}
        optionen={FADE_MODES.map((mode) => ({ wert: mode, text: VERLAUF_TEXT[mode] }))}
        onWert={(fade) => dispatch({ art: "uebungszeilen", patch: { fade } })}
      />

      <Schalter
        label="Vorlage am Zeilenanfang"
        wert={rows.showModel}
        onWert={(showModel) => dispatch({ art: "uebungszeilen", patch: { showModel } })}
      />

      <Auswahl
        label="Lineatur"
        hinweis="Sie gibt das Mittelband vor und bestimmt damit die Schriftgröße."
        wert={lines.lineatur}
        optionen={LINEATUR_IDS.map((id) => ({ wert: id, text: LINEATUR_TEXT[id] }))}
        onWert={(lineatur) => dispatch({ art: "zeilen", patch: { lineatur } })}
      />

      {/* Die Maße nennen, statt sie zu verstecken: Wer weiß, dass Lineatur 1
          fünf Millimeter bedeutet, kann sie mit dem Heft des Kindes vergleichen. */}
      {spezifikation.roles.length > 0 && (
        <p className="text-[12px] text-ink-3">
          {spezifikation.roles.length} Linien im Abstand von {spezifikation.gap} mm — die Schriftgröße
          wird daraus gerechnet.
        </p>
      )}
    </Panel>
  );
}
