import { parseWordList } from "../content/word-list";
import { clamp, clampInt } from "../definition/constraints";
import { DEFAULT_WORKSHEET } from "../definition/defaults";
import { pruefeLesetabelle } from "../definition/schemas";
import {
  sanitizePage,
  sanitizeTypography,
  withUniformMargins,
  type MarginsInput,
  type PageInput,
  type TypographyInput,
} from "../definition/sanitize";
import type { SyllableMatrixConfig } from "../content/matrix";
import type {
  CellDecoration,
  ContentSource,
  GridConfig,
  SyllableColoring,
  WorksheetDefinition,
} from "../definition/types";
import { mm } from "../units";
import { begrenzeZoom, zoomFuerBreite } from "./zoom";

/**
 * Der Zustand der Lesetabelle als `useReducer` — Port des Zustand-Slices aus
 * `aufgaben_webseite/src/features/worksheet-generator/store/`.
 *
 * WAS SICH GEGENÜBER DER QUELLE ÄNDERT:
 *   - Zustand → ein reiner `(zustand, aktion) => zustand`. Damit ist der Zustand
 *     ohne React und ohne Store-Bibliothek prüfbar (`node:test`), und die Seite
 *     hängt ihn mit `useReducer` ein.
 *   - Die deutschen Aktionsnamen statt Setter-Namen. Die Aufteilung bleibt:
 *     **ein Patch je Teilbereich**, nicht ein Setter je Feld.
 *   - `localStorage`/`persist` fehlt hier bewusst: Speichern ist ein eigener
 *     Schritt (D21, `materials`), nicht Aufgabe des Generators.
 *
 * ZUSTÄNDIGKEIT UNVERÄNDERT: rohe Nutzereingaben in einen für die Domain
 * gültigen Zustand überführen. Alle Begrenzungen passieren hier, damit
 * `buildLayoutModel` nie einen unmöglichen Wert sieht.
 */

/* --- Eingabetypen --------------------------------------------------------- */

export interface GridInput {
  readonly columns?: number;
  /** Millimeter. */
  readonly columnGap?: number;
  readonly rowGap?: number;
  readonly rowHeight?: number;
  readonly decoration?: CellDecoration;
}

export type MetaInput = Partial<
  Pick<WorksheetDefinition, "title" | "subtitle" | "showTitle" | "showPageNumbers"> & {
    coloring: SyllableColoring;
  }
>;

/** Form, in der eine Definition von außen ankommen kann — möglicherweise
 *  unvollständig oder aus einer älteren Programmversion. */
export interface StoredDefinition extends MetaInput {
  readonly page?: PageInput;
  readonly grid?: GridInput;
  readonly typography?: TypographyInput;
  readonly content?: ContentSource;
}

/* --- Begrenzen und Zusammenführen (Port) ---------------------------------- */

export function sanitizeGrid(current: GridConfig, patch: GridInput = {}): GridConfig {
  return {
    columns: clampInt(patch.columns ?? current.columns, "columns"),
    columnGap: mm(clamp(patch.columnGap ?? current.columnGap, "gap")),
    rowGap: mm(clamp(patch.rowGap ?? current.rowGap, "gap")),
    rowHeight: mm(clamp(patch.rowHeight ?? current.rowHeight, "rowHeight")),
    decoration: patch.decoration ?? current.decoration,
  };
}

/**
 * Führt einen gespeicherten — möglicherweise unvollständigen — Stand mit den
 * Vorgaben zusammen und begrenzt alle Werte.
 *
 * Das ist der **weiche** Weg für alte Stände (Browser-Speicher, ältere
 * Programmversion). Der harte Weg ist `pruefeLesetabelle`: der nimmt nur
 * Vollständiges an und sagt sonst, was fehlt.
 */
export function mergeDefinition(stored: StoredDefinition): WorksheetDefinition {
  const base = DEFAULT_WORKSHEET;
  return {
    title: stored.title ?? base.title,
    subtitle: stored.subtitle ?? base.subtitle,
    showTitle: stored.showTitle ?? base.showTitle,
    showPageNumbers: stored.showPageNumbers ?? base.showPageNumbers,
    coloring: stored.coloring ?? base.coloring,
    page: sanitizePage(base.page, stored.page),
    grid: sanitizeGrid(base.grid, stored.grid),
    typography: sanitizeTypography(base.typography, stored.typography),
    content: stored.content ?? base.content,
  };
}

/* --- Zustand und Aktionen ------------------------------------------------- */

export interface LesetabelleZustand {
  readonly definition: WorksheetDefinition;
  /** 1 = Originalgröße. Flüchtig, gehört nicht in die Definition. */
  readonly zoom: number;
  /** Was beim Laden einer gespeicherten Definition schiefging. */
  readonly fehler: string | null;
}

export type LesetabelleAktion =
  | { readonly art: "meta"; readonly patch: MetaInput }
  | { readonly art: "seite"; readonly patch: PageInput }
  | { readonly art: "raender"; readonly patch: MarginsInput }
  | { readonly art: "alleRaender"; readonly millimeter: number }
  | { readonly art: "raster"; readonly patch: GridInput }
  | { readonly art: "schrift"; readonly patch: TypographyInput }
  | { readonly art: "inhalt"; readonly content: ContentSource }
  | { readonly art: "woerter"; readonly text: string }
  | { readonly art: "matrix"; readonly patch: Partial<SyllableMatrixConfig> }
  /** Ein vollständiges Blatt übernehmen — etwa ein geöffnetes Druckblatt. */
  | { readonly art: "laden"; readonly definition: unknown }
  | { readonly art: "zuruecksetzen" }
  | { readonly art: "zoom"; readonly faktor: number }
  | { readonly art: "zoomEinpassen"; readonly breitePx: number; readonly seiteMm: number }
  | { readonly art: "fehlerGelesen" };

export const LESETABELLE_START: LesetabelleZustand = {
  definition: DEFAULT_WORKSHEET,
  zoom: 1,
  fehler: null,
};

export function lesetabelleReducer(
  zustand: LesetabelleZustand,
  aktion: LesetabelleAktion,
): LesetabelleZustand {
  const update = (rezept: (definition: WorksheetDefinition) => WorksheetDefinition) => ({
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

    case "raender":
      return update((definition) => ({
        ...definition,
        page: sanitizePage(definition.page, { margins: aktion.patch }),
      }));

    case "alleRaender":
      return update((definition) => ({
        ...definition,
        page: withUniformMargins(definition.page, aktion.millimeter),
      }));

    case "raster":
      return update((definition) => ({
        ...definition,
        grid: sanitizeGrid(definition.grid, aktion.patch),
      }));

    case "schrift":
      return update((definition) => ({
        ...definition,
        typography: sanitizeTypography(definition.typography, aktion.patch),
      }));

    case "inhalt":
      return update((definition) => ({ ...definition, content: aktion.content }));

    case "woerter":
      return update((definition) => ({
        ...definition,
        content: { kind: "wordList", words: parseWordList(aktion.text) },
      }));

    /*
     * Wirkt nur, wenn gerade eine Matrix aktiv ist. Ein stiller No-op ist hier
     * richtig: die Matrix-Bedienelemente sind dann gar nicht sichtbar, ein
     * Aufruf wäre ein Programmierfehler an anderer Stelle — den soll aber nicht
     * die Lehrkraft als Absturz erleben.
     */
    case "matrix":
      return update((definition) => {
        if (definition.content.kind !== "matrix") return definition;
        return {
          ...definition,
          content: { kind: "matrix", config: { ...definition.content.config, ...aktion.patch } },
        };
      });

    case "laden": {
      const geprueft = pruefeLesetabelle(aktion.definition);
      if (!geprueft.ok) return { ...zustand, fehler: geprueft.fehler.join(" ") };
      return { definition: geprueft.definition, zoom: zustand.zoom, fehler: null };
    }

    case "zuruecksetzen":
      return { definition: DEFAULT_WORKSHEET, zoom: zustand.zoom, fehler: null };

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
