import type { FadeMode, TraceUnit } from "../content/tracing";
import { clamp, clampInt } from "../definition/constraints";
import { DEFAULT_TRACING } from "../definition/tracing-defaults";
import { pruefeNachmalblatt } from "../definition/schemas";
import {
  sanitizePage,
  sanitizeTypography,
  withUniformMargins,
  type PageInput,
  type TypographyInput,
} from "../definition/sanitize";
import type {
  TracingDefinition,
  TracingLinesConfig,
  TracingRowsConfig,
} from "../definition/tracing-types";
import type { ScriptId } from "../rendering/handwriting-scripts";
import type { LineaturId } from "../rendering/lineatur";
import { mm } from "../units";
import { begrenzeZoom, zoomFuerBreite } from "./zoom";

/**
 * Der Zustand des Nachmalblatts als `useReducer` — Port des Zustand-Slices aus
 * `aufgaben_webseite/src/features/letter-tracing/store/tracing-slice.ts`.
 *
 * Gleiche Aufgabenteilung wie bei den anderen Generatoren: Hier werden rohe
 * Eingaben begrenzt und mit ihrer Einheit versehen, damit
 * `buildTracingLayout` nie einen unmöglichen Wert sieht — dort hängt die
 * Schriftgröße am Mittelband der Lineatur, ein unbegrenzter Wert wäre also
 * unmittelbar sichtbar.
 */

/* --- Eingabetypen --------------------------------------------------------- */

export interface RowsInput {
  readonly repeats?: number;
  readonly showModel?: boolean;
  readonly style?: TracingRowsConfig["style"];
  readonly fade?: FadeMode;
  readonly freeRows?: number;
}

export interface TracingLinesInput {
  readonly lineatur?: LineaturId;
  /** Millimeter. `null` heißt ausdrücklich: Vorgabe der Lineatur. */
  readonly spacing?: number | null;
}

export type TracingMetaInput = Partial<
  Pick<TracingDefinition, "title" | "showTitle" | "instruction" | "showPageNumbers">
>;

/** Form, in der eine Definition von außen ankommen kann. */
export interface StoredTracing extends TracingMetaInput {
  readonly page?: PageInput;
  readonly typography?: TypographyInput;
  readonly script?: ScriptId;
  readonly sizeAdjust?: number;
  readonly unit?: TraceUnit;
  readonly content?: string;
  readonly rows?: RowsInput;
  readonly lines?: TracingLinesInput;
}

/* --- Begrenzen und Zusammenführen (Port) ---------------------------------- */

export function sanitizeRows(current: TracingRowsConfig, patch: RowsInput = {}): TracingRowsConfig {
  return {
    repeats: clampInt(patch.repeats ?? current.repeats, "traceRepeats"),
    showModel: patch.showModel ?? current.showModel,
    style: patch.style ?? current.style,
    fade: patch.fade ?? current.fade,
    freeRows: clampInt(patch.freeRows ?? current.freeRows, "traceFreeRows"),
  };
}

export function sanitizeTracingLines(
  current: TracingLinesConfig,
  patch: TracingLinesInput = {},
): TracingLinesConfig {
  /* `null` und `undefined` bedeuten Verschiedenes — siehe Satzbaukasten. */
  const spacing = patch.spacing === undefined ? current.spacing : patch.spacing;
  return {
    lineatur: patch.lineatur ?? current.lineatur,
    spacing: spacing === null ? null : mm(clamp(spacing, "gap")),
  };
}

export function mergeTracing(stored: StoredTracing): TracingDefinition {
  const base = DEFAULT_TRACING;
  return {
    title: stored.title ?? base.title,
    showTitle: stored.showTitle ?? base.showTitle,
    instruction: stored.instruction ?? base.instruction,
    showPageNumbers: stored.showPageNumbers ?? base.showPageNumbers,
    page: sanitizePage(base.page, stored.page),
    typography: sanitizeTypography(base.typography, stored.typography),
    script: stored.script ?? base.script,
    sizeAdjust: clamp(stored.sizeAdjust ?? base.sizeAdjust, "sizeAdjust"),
    unit: stored.unit ?? base.unit,
    content: stored.content ?? base.content,
    rows: sanitizeRows(base.rows, stored.rows),
    lines: sanitizeTracingLines(base.lines, stored.lines),
  };
}

/* --- Zustand und Aktionen ------------------------------------------------- */

export interface NachmalblattZustand {
  readonly definition: TracingDefinition;
  readonly zoom: number;
  readonly fehler: string | null;
}

export type NachmalblattAktion =
  | { readonly art: "meta"; readonly patch: TracingMetaInput }
  | { readonly art: "seite"; readonly patch: PageInput }
  | { readonly art: "alleRaender"; readonly millimeter: number }
  | { readonly art: "schrift"; readonly patch: TypographyInput }
  | { readonly art: "schulschrift"; readonly script: ScriptId }
  | { readonly art: "groesseJustieren"; readonly wert: number }
  | { readonly art: "einheit"; readonly unit: TraceUnit }
  | { readonly art: "inhalt"; readonly content: string }
  /** Vorlage anhängen statt ersetzen — etwa „Alphabet klein“. */
  | { readonly art: "inhaltAnhaengen"; readonly text: string }
  | { readonly art: "uebungszeilen"; readonly patch: RowsInput }
  | { readonly art: "zeilen"; readonly patch: TracingLinesInput }
  | { readonly art: "laden"; readonly definition: unknown }
  | { readonly art: "zuruecksetzen" }
  | { readonly art: "zoom"; readonly faktor: number }
  | { readonly art: "zoomEinpassen"; readonly breitePx: number; readonly seiteMm: number }
  | { readonly art: "fehlerGelesen" };

export const NACHMALBLATT_START: NachmalblattZustand = {
  definition: DEFAULT_TRACING,
  zoom: 1,
  fehler: null,
};

export function nachmalblattReducer(
  zustand: NachmalblattZustand,
  aktion: NachmalblattAktion,
): NachmalblattZustand {
  const update = (rezept: (definition: TracingDefinition) => TracingDefinition) => ({
    ...zustand,
    definition: rezept(zustand.definition),
    fehler: null,
  });

  switch (aktion.art) {
    case "meta":
      return update((definition) => ({ ...definition, ...aktion.patch }));

    case "seite":
      return update((definition) => ({
        ...definition,
        page: sanitizePage(definition.page, aktion.patch),
      }));

    case "alleRaender":
      return update((definition) => ({
        ...definition,
        page: withUniformMargins(definition.page, aktion.millimeter),
      }));

    case "schrift":
      return update((definition) => ({
        ...definition,
        typography: sanitizeTypography(definition.typography, aktion.patch),
      }));

    case "schulschrift":
      return update((definition) => ({ ...definition, script: aktion.script }));

    case "groesseJustieren":
      return update((definition) => ({
        ...definition,
        sizeAdjust: clamp(aktion.wert, "sizeAdjust"),
      }));

    case "einheit":
      return update((definition) => ({ ...definition, unit: aktion.unit }));

    case "inhalt":
      return update((definition) => ({ ...definition, content: aktion.content }));

    /*
     * Anhängen statt ersetzen: Wer „Alphabet klein“ wählt und danach „Umlaute“,
     * will beides — nicht nur das zweite. Ein Leerzeichen dazwischen, damit auch
     * bei Silben und Wörtern getrennt wird.
     */
    case "inhaltAnhaengen":
      return update((definition) => {
        const bisher = definition.content.trim();
        return {
          ...definition,
          content: bisher === "" ? aktion.text : `${bisher} ${aktion.text}`,
        };
      });

    case "uebungszeilen":
      return update((definition) => ({
        ...definition,
        rows: sanitizeRows(definition.rows, aktion.patch),
      }));

    case "zeilen":
      return update((definition) => ({
        ...definition,
        lines: sanitizeTracingLines(definition.lines, aktion.patch),
      }));

    case "laden": {
      const geprueft = pruefeNachmalblatt(aktion.definition);
      if (!geprueft.ok) return { ...zustand, fehler: geprueft.fehler.join(" ") };
      return { definition: geprueft.definition, zoom: zustand.zoom, fehler: null };
    }

    case "zuruecksetzen":
      return { definition: DEFAULT_TRACING, zoom: zustand.zoom, fehler: null };

    case "zoom":
      return { ...zustand, zoom: begrenzeZoom(aktion.faktor) };

    case "zoomEinpassen": {
      const faktor = zoomFuerBreite(aktion.breitePx, aktion.seiteMm);
      return faktor === null ? zustand : { ...zustand, zoom: faktor };
    }

    case "fehlerGelesen":
      return { ...zustand, fehler: null };
  }
}
