"use client";

import { useEffect, useMemo, useReducer, useRef, type Dispatch } from "react";
import type { ArticleMode, Kasus } from "@/lib/german-nouns";
import {
  ROLE_TAKES_ARTICLE,
  collectEntryIssues,
  resolveSentenceBox,
  sampleSentence,
  sentenceCombinations,
  type ColumnRole,
} from "@/lib/druckblatt/content/sentence-box";
import { CONSTRAINTS } from "@/lib/druckblatt/definition/constraints";
import { pruefeSatzbaukasten } from "@/lib/druckblatt/definition/schemas";
import type { SentenceBoxDefinition, TableBorders } from "@/lib/druckblatt/definition/sentence-box-types";
import { LINEATUREN, LINEATUR_IDS, type LineaturId } from "@/lib/druckblatt/rendering/lineatur";
import { baueSatzbaukasten } from "@/lib/druckblatt/state/aufbau";
import {
  SATZBAUKASTEN_START,
  satzbaukastenReducer,
  type SatzbaukastenAktion,
} from "@/lib/druckblatt/state/sentence-state";
import { BlattFehler, BlattSeite } from "./BlattSeite";
import { BlattPanel } from "./BlattPanel";
import { Auswahl, Panel, Schalter, Textbereich, Textfeld, Warnung, Zahlenfeld } from "./Felder";
import { SpaltenVorschlagPanel } from "./KiVorschlag";
import { SentenceBoxView } from "./SentenceBoxView";
import { SpeichernPanel } from "./SpeichernPanel";

/** Was die Seite an den Generator übergibt: ein geöffnetes Blatt, die KI-Lage, die Schülerliste. */
export interface SatzbaukastenSeiteProps {
  readonly blatt?: { readonly id: number; readonly definition: SentenceBoxDefinition; readonly hinweis: string | null };
  readonly studenten: readonly { readonly id: number; readonly name: string }[];
  readonly kiVerfuegbar: boolean;
  readonly gespeichert?: "vorlage" | "zuweisen" | null;
  readonly gespeichertFuer?: string | null;
  readonly fehler?: string | null;
}

/**
 * Der Satzbaukasten: Spalten mit Wörtern oder Satzteilen, darunter Schreibzeilen.
 *
 * Zustand und Rechnen kommen von außen — `satzbaukastenReducer` (Port des
 * Zustand-Slices) und `baueSatzbaukasten`. Diese Komponente verdrahtet beides.
 *
 * Ganz oben in der Seitenleiste stehen Beispielsatz und Mängel: Wer „Ich habe einen
 * Blume" sieht, findet den Fehler sofort — ohne alle Kombinationen im Kopf zu
 * bilden.
 */
export function SatzbaukastenGenerator({ blatt, studenten, kiVerfuegbar, gespeichert, gespeichertFuer, fehler }: SatzbaukastenSeiteProps) {
  const [zustand, dispatch] = useReducer(satzbaukastenReducer, SATZBAUKASTEN_START);
  const aufbau = useMemo(() => baueSatzbaukasten(zustand.definition), [zustand.definition]);
  const { definition } = zustand;

  /* Ein geöffnetes Druckblatt kommt über `laden` herein — dieselbe Grenze wie beim Drucken. */
  const geladen = useRef<number | null>(null);
  useEffect(() => {
    if (!blatt || geladen.current === blatt.id) return;
    geladen.current = blatt.id;
    dispatch({ art: "laden", definition: blatt.definition });
  }, [blatt]);

  const spalten = useMemo(() => resolveSentenceBox(definition.columns), [definition.columns]);
  const kombinationen = sentenceCombinations(spalten);
  const beispiel = sampleSentence(spalten);
  const maengel = collectEntryIssues(spalten);

  return (
    <BlattSeite
      kennzahl={
        aufbau.ok
          ? `${kombinationen} ${kombinationen === 1 ? "Satz" : "Sätze"} möglich · ${aufbau.model.placedLines} Schreibzeilen · ${seitenText(aufbau.model.pages.length)}`
          : "noch kein Blatt"
      }
      seiteMm={aufbau.ok ? aufbau.model.geometry.pageWidth : 0}
      zoom={zustand.zoom}
      onZoom={(faktor) => dispatch({ art: "zoom", faktor })}
      onZuruecksetzen={() => dispatch({ art: "zuruecksetzen" })}
      fehler={zustand.fehler ?? blatt?.hinweis ?? fehler ?? null}
      pruefen={() => {
        const geprueft = pruefeSatzbaukasten(definition);
        return geprueft.ok ? null : geprueft.fehler.join(" ");
      }}
      einstellungen={
        <>
          {beispiel !== "" && (
            <p className="panel px-4 py-3 text-[13px]">
              <span className="text-ink-2">Beispielsatz: </span>
              {beispiel}
            </p>
          )}

          {maengel.length > 0 && (
            <div className="grid gap-1.5">
              <Warnung>
                {maengel.length === 1 ? "Ein Eintrag ist unklar:" : `${maengel.length} Einträge sind unklar:`}
                <span className="mt-1 block">
                  {maengel.slice(0, 6).map((mangel) => (
                    <span key={mangel.entryId} className="block">
                      {mangel.source} — {MANGEL_TEXT[mangel.issue]}
                    </span>
                  ))}
                  {maengel.length > 6 && <span className="block">… und {maengel.length - 6} weitere</span>}
                </span>
              </Warnung>
            </div>
          )}

          <SpaltenVorschlagPanel definition={definition} dispatch={dispatch} kiVerfuegbar={kiVerfuegbar} />
          <SpaltenPanel definition={definition} dispatch={dispatch} />
          <ZeilenPanel definition={definition} dispatch={dispatch} />
          <TabellePanel definition={definition} dispatch={dispatch} />
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
              <>
                <Textbereich
                  label="Arbeitsauftrag"
                  zeilen={3}
                  hinweis="Der Text, der die Übung erklärt. Ohne ihn ist eine Tabelle mit Wörtern nur eine Tabelle mit Wörtern."
                  wert={definition.instruction}
                  onWert={(instruction) => dispatch({ art: "meta", patch: { instruction } })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Textfeld
                    label="Überschrift Kasten"
                    wert={definition.boxHeading}
                    onWert={(boxHeading) => dispatch({ art: "meta", patch: { boxHeading } })}
                  />
                  <Textfeld
                    label="Überschrift Zeilen"
                    wert={definition.linesHeading}
                    onWert={(linesHeading) => dispatch({ art: "meta", patch: { linesHeading } })}
                  />
                </div>
              </>
            }
          />
          <SpeichernPanel
            blattart="satzbaukasten"
            definition={definition}
            titel={definition.title}
            studenten={studenten}
            gespeichertId={blatt?.id ?? null}
            gespeichertFuer={gespeichertFuer ?? null}
            meldung={gespeichert ? (gespeichert === "zuweisen" ? "Gespeichert und dem Schüler zugewiesen." : "Als Vorlage gespeichert.") : null}
            fehler={null}
          />
        </>
      }
      vorschau={
        aufbau.ok ? (
          <SentenceBoxView model={aufbau.model} definition={definition} />
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

/* --- Wörter und Rollen in der Sprache der Lehrkraft ----------------------- */

const ROLLEN_TEXT: Record<ColumnRole, string> = {
  subjekt: "Subjekt (Wer?)",
  verb: "Verb (Was tue ich?)",
  objekt: "Objekt (Wen oder was?)",
  ergaenzung: "Ergänzung (Wo, wann, wie?)",
};

const KASUS_TEXT: Record<Kasus, string> = {
  nominativ: "Nominativ (wer oder was)",
  akkusativ: "Akkusativ (wen oder was)",
  dativ: "Dativ (wem)",
};

const ARTIKEL_TEXT: Record<ArticleMode, string> = {
  bestimmt: "bestimmt (der, die, das)",
  unbestimmt: "unbestimmt (ein, eine)",
  ohne: "ohne Artikel",
};

const MANGEL_TEXT = {
  genusUnbekannt: "das Geschlecht ist unbekannt — „der/die/das“ davorschreiben",
  keinUnbestimmterPlural: "„ein/eine“ gibt es im Plural nicht — bestimmten Artikel nehmen",
  dativPlural: "im Dativ Plural bekommt das Nomen ein „n“ (den Kindern)",
} as const;

const RAHMEN_TEXT: Record<TableBorders, string> = {
  all: "alle Linien",
  outline: "nur außen",
  columns: "nur Spalten",
  none: "ohne",
};

const LINEATUR_TEXT: Record<LineaturId, string> = {
  blanko: "blanko (nur Zeilenabstand)",
  lineatur0: "Lineatur 0 — vier Linien, 6 mm (1. Klasse)",
  lineatur1: "Lineatur 1 — vier Linien, 5 mm (1. Klasse)",
  lineatur2: "Lineatur 2 — vier Linien, 4 mm (2. Klasse)",
  lineatur3: "Lineatur 3 — zwei Linien, 3,5 mm (3. Klasse)",
  lineatur4: "Lineatur 4 — eine Linie, 10 mm Abstand (4. Klasse)",
};

/* --- Spalten --------------------------------------------------------------- */

function SpaltenPanel({
  definition,
  dispatch,
}: {
  readonly definition: SentenceBoxDefinition;
  readonly dispatch: Dispatch<SatzbaukastenAktion>;
}) {
  const spalten = definition.columns;
  const kannHinzufuegen = spalten.length < CONSTRAINTS.sentenceColumns.max;

  return (
    <Panel titel="Spalten">
      {spalten.map((spalte, index) => {
        const mitArtikel = ROLE_TAKES_ARTICLE[spalte.role];
        return (
          <fieldset key={spalte.id} className="grid gap-2.5 rounded-2xl border border-line p-3">
            <legend className="px-1 text-[12px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
              Spalte {index + 1}
            </legend>

            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Auswahl
                  ariaLabel={`Rolle der Spalte ${index + 1}`}
                  wert={spalte.role}
                  optionen={Object.entries(ROLLEN_TEXT).map(([wert, text]) => ({
                    wert: wert as ColumnRole,
                    text,
                  }))}
                  onWert={(rolle) => dispatch({ art: "spalteRolle", kennung: spalte.id, rolle })}
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Spalte ${index + 1} nach links`}
                title="nach links"
                disabled={index === 0}
                onClick={() => dispatch({ art: "spalteVerschieben", kennung: spalte.id, richtung: -1 })}
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Spalte ${index + 1} nach rechts`}
                title="nach rechts"
                disabled={index === spalten.length - 1}
                onClick={() => dispatch({ art: "spalteVerschieben", kennung: spalte.id, richtung: 1 })}
              >
                →
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Spalte ${index + 1} entfernen`}
                title="entfernen"
                /* Die letzte Spalte bleibt: Ein Satzbaukasten ohne Spalte wäre
                   kein Baukasten mehr, nur noch ein Blatt mit Linien. */
                disabled={spalten.length <= CONSTRAINTS.sentenceColumns.min}
                onClick={() => dispatch({ art: "spalteEntfernen", kennung: spalte.id })}
              >
                ✕
              </button>
            </div>

            <Textfeld
              label="Überschrift"
              hinweis="Leer lassen heißt: keine Überschrift über dieser Spalte."
              wert={spalte.heading}
              onWert={(heading) => dispatch({ art: "spalteAendern", kennung: spalte.id, patch: { heading } })}
            />

            <Textbereich
              label="Einträge"
              zeilen={Math.min(10, Math.max(3, spalte.entries.length + 1))}
              hinweis={
                mitArtikel
                  ? "Ein Eintrag je Zeile, mit Geschlecht: „der Hund“. Den Rest („einen Hund“) rechnet die App."
                  : "Ein Eintrag je Zeile."
              }
              wert={spalte.entries.join("\n")}
              onWert={(text) => dispatch({ art: "spalteEintraege", kennung: spalte.id, text })}
            />

            {mitArtikel && (
              <div className="grid grid-cols-2 gap-2">
                <Auswahl
                  label="Fall"
                  wert={spalte.kasus}
                  optionen={Object.entries(KASUS_TEXT).map(([wert, text]) => ({ wert: wert as Kasus, text }))}
                  onWert={(kasus) => dispatch({ art: "spalteAendern", kennung: spalte.id, patch: { kasus } })}
                />
                <Auswahl
                  label="Artikel"
                  wert={spalte.article}
                  optionen={Object.entries(ARTIKEL_TEXT).map(([wert, text]) => ({
                    wert: wert as ArticleMode,
                    text,
                  }))}
                  onWert={(article) =>
                    dispatch({ art: "spalteAendern", kennung: spalte.id, patch: { article } })
                  }
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <button
        type="button"
        className="btn btn-secondary"
        disabled={!kannHinzufuegen}
        onClick={() => dispatch({ art: "spalteHinzufuegen", rolle: "ergaenzung" })}
      >
        Spalte hinzufügen
      </button>
      {!kannHinzufuegen && (
        <p className="text-[12px] text-ink-3">
          Mehr als {CONSTRAINTS.sentenceColumns.max} Spalten ergeben keinen Satz mehr, sondern eine Zumutung.
        </p>
      )}
    </Panel>
  );
}

/* --- Schreibzeilen --------------------------------------------------------- */

function ZeilenPanel({
  definition,
  dispatch,
}: {
  readonly definition: SentenceBoxDefinition;
  readonly dispatch: Dispatch<SatzbaukastenAktion>;
}) {
  const { lines } = definition;
  const vorgabe = lines.spacing === null;

  return (
    <Panel titel="Schreibzeilen">
      <Auswahl
        label="Lineatur"
        hinweis="Sie bestimmt, wie groß ein Kind schreiben kann — und damit, wie viele Zeilen aufs Blatt passen."
        wert={lines.lineatur}
        optionen={LINEATUR_IDS.map((id) => ({ wert: id, text: LINEATUR_TEXT[id] }))}
        onWert={(lineatur) => dispatch({ art: "zeilen", patch: { lineatur } })}
      />

      <Zahlenfeld
        label="Anzahl"
        hinweis="0 heißt: keine Schreibzeilen, nur der Kasten."
        wert={lines.count}
        bereich={CONSTRAINTS.writingLines}
        onWert={(count) => dispatch({ art: "zeilen", patch: { count } })}
      />

      <Schalter
        label="Abstand wie im Heft"
        hinweis="Nimmt den Zeilenabstand der Lineatur — ein gleichmäßiges Raster."
        wert={vorgabe}
        onWert={(an) =>
          dispatch({ art: "zeilen", patch: { spacing: an ? null : LINEATUREN[lines.lineatur].spacing } })
        }
      />

      {!vorgabe && (
        <Zahlenfeld
          label="Zeilenabstand"
          einheit="mm"
          wert={lines.spacing ?? LINEATUREN[lines.lineatur].spacing}
          bereich={CONSTRAINTS.gap}
          onWert={(spacing) => dispatch({ art: "zeilen", patch: { spacing } })}
        />
      )}

      <Schalter
        label="Zeilen nummerieren"
        wert={lines.numbered}
        onWert={(numbered) => dispatch({ art: "zeilen", patch: { numbered } })}
      />
    </Panel>
  );
}

/* --- Tabelle --------------------------------------------------------------- */

function TabellePanel({
  definition,
  dispatch,
}: {
  readonly definition: SentenceBoxDefinition;
  readonly dispatch: Dispatch<SatzbaukastenAktion>;
}) {
  const { table } = definition;

  return (
    <Panel titel="Kasten">
      <div className="grid grid-cols-2 gap-3">
        <Zahlenfeld
          label="Zeilenhöhe"
          einheit="mm"
          wert={table.rowHeight}
          bereich={CONSTRAINTS.rowHeight}
          onWert={(rowHeight) => dispatch({ art: "tabelle", patch: { rowHeight } })}
        />
        <Auswahl
          label="Rahmen"
          wert={table.borders}
          optionen={Object.entries(RAHMEN_TEXT).map(([wert, text]) => ({
            wert: wert as TableBorders,
            text,
          }))}
          onWert={(borders) => dispatch({ art: "tabelle", patch: { borders } })}
        />
      </div>

      <Schalter
        label="Spaltenüberschriften zeigen"
        hinweis="Nur sinnvoll, wenn Überschriften eingetragen sind."
        wert={table.showHeadings}
        onWert={(showHeadings) => dispatch({ art: "tabelle", patch: { showHeadings } })}
      />
    </Panel>
  );
}
