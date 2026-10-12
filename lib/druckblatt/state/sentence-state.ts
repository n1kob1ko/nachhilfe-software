import {
  ROLE_DEFAULT_ARTICLE,
  ROLE_DEFAULT_KASUS,
  type ColumnRole,
  type SentenceColumn,
} from "../content/sentence-box";
import { type ArticleMode, type Kasus } from "../../german-nouns";
import { CONSTRAINTS, clamp, clampInt } from "../definition/constraints";
import { DEFAULT_SENTENCE_BOX } from "../definition/sentence-box-defaults";
import type {
  SentenceBoxDefinition,
  SentenceTableConfig,
  TableBorders,
  WritingLinesConfig,
} from "../definition/sentence-box-types";
import { pruefeSatzbaukasten } from "../definition/schemas";
import {
  sanitizePage,
  sanitizeTypography,
  withUniformMargins,
  type PageInput,
  type TypographyInput,
} from "../definition/sanitize";
import type { LineaturId } from "../rendering/lineatur";
import { mm } from "../units";
import { begrenzeZoom, zoomFuerBreite } from "./zoom";

/**
 * Der Zustand des Satzbaukastens als `useReducer` — Port des Zustand-Slices aus
 * `aufgaben_webseite/src/features/sentence-builder/store/sentence-slice.ts`.
 *
 * Gleiche Aufgabenteilung wie bei der Lesetabelle: Diese Schicht überführt rohe
 * Nutzereingaben in einen für die Domain gültigen Zustand, damit
 * `buildSentenceLayout` nie einen unmöglichen Wert sieht. `sanitizePage` und
 * `sanitizeTypography` werden mit der Lesetabelle geteilt — Seitenformat und
 * Typografie sind Eigenschaften des Papiers.
 *
 * EINE ABWEICHUNG VON DER QUELLE: Spalten-Kennungen. Die Quelle baute
 * `spalte-<zähler>-<Date.now()>`; in einem reinen Reducer wäre die Uhr eine
 * versteckte Eingabe und der Zustand nicht reproduzierbar. Stattdessen wird die
 * nächste freie Nummer aus den vorhandenen Kennungen abgeleitet — gleiches
 * Ergebnis (nie zwei gleiche Kennungen in einem Zustand), aber prüfbar.
 */

/* --- Eingabetypen --------------------------------------------------------- */

export interface TableInput {
  /** Millimeter. */
  readonly rowHeight?: number;
  readonly borders?: TableBorders;
  readonly showHeadings?: boolean;
}

export interface LinesInput {
  readonly count?: number;
  readonly lineatur?: LineaturId;
  /** Millimeter. `null` heißt ausdrücklich: Vorgabe der Lineatur nehmen. */
  readonly spacing?: number | null;
  readonly numbered?: boolean;
}

export type SentenceMetaInput = Partial<
  Pick<
    SentenceBoxDefinition,
    "title" | "showTitle" | "instruction" | "boxHeading" | "linesHeading" | "showPageNumbers"
  >
>;

/** Was an einer Spalte geändert werden kann — ohne die Einträge. */
export interface ColumnInput {
  readonly heading?: string;
  readonly kasus?: Kasus;
  readonly article?: ArticleMode;
}

/** Form, in der eine Definition von außen ankommen kann. */
export interface StoredSentenceBox extends SentenceMetaInput {
  readonly page?: PageInput;
  readonly typography?: TypographyInput;
  readonly table?: TableInput;
  readonly lines?: LinesInput;
  readonly columns?: readonly SentenceColumn[];
}

/* --- Begrenzen und Zusammenführen (Port) ---------------------------------- */

export function sanitizeTable(
  current: SentenceTableConfig,
  patch: TableInput = {},
): SentenceTableConfig {
  return {
    rowHeight: mm(clamp(patch.rowHeight ?? current.rowHeight, "rowHeight")),
    borders: patch.borders ?? current.borders,
    showHeadings: patch.showHeadings ?? current.showHeadings,
  };
}

export function sanitizeLines(
  current: WritingLinesConfig,
  patch: LinesInput = {},
): WritingLinesConfig {
  /*
   * `null` und `undefined` bedeuten hier VERSCHIEDENES: `undefined` heißt
   * „nicht angefasst“, `null` heißt „ausdrücklich auf die Vorgabe der Lineatur
   * zurück“. Ein `??` würde beides zusammenwerfen.
   */
  const spacing = patch.spacing === undefined ? current.spacing : patch.spacing;

  return {
    count: clampInt(patch.count ?? current.count, "writingLines"),
    lineatur: patch.lineatur ?? current.lineatur,
    spacing: spacing === null ? null : mm(clamp(spacing, "gap")),
    numbered: patch.numbered ?? current.numbered,
  };
}

/** Eine mehrzeilige Eingabe in Einträge zerlegen — eine Zeile, ein Eintrag. */
export function parseEntries(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function mergeSentenceBox(stored: StoredSentenceBox): SentenceBoxDefinition {
  const base = DEFAULT_SENTENCE_BOX;
  return {
    title: stored.title ?? base.title,
    showTitle: stored.showTitle ?? base.showTitle,
    instruction: stored.instruction ?? base.instruction,
    boxHeading: stored.boxHeading ?? base.boxHeading,
    linesHeading: stored.linesHeading ?? base.linesHeading,
    showPageNumbers: stored.showPageNumbers ?? base.showPageNumbers,
    page: sanitizePage(base.page, stored.page),
    typography: sanitizeTypography(base.typography, stored.typography),
    table: sanitizeTable(base.table, stored.table),
    lines: sanitizeLines(base.lines, stored.lines),
    columns: stored.columns ?? base.columns,
  };
}

/**
 * Nächste freie Spaltenkennung.
 *
 * Gezählt wird über die schon vorhandenen Kennungen, nicht über ein Modul-Zähler:
 * Damit ist derselbe Zustand immer derselbe und ein Test kann ihn festnageln.
 */
export function naechsteSpaltenKennung(spalten: readonly SentenceColumn[]): string {
  const nummern = spalten
    .map((spalte) => /^spalte-(\d+)/.exec(spalte.id)?.[1])
    .filter((nummer): nummer is string => nummer !== undefined)
    .map((nummer) => Number(nummer));
  const hoechste = nummern.length > 0 ? Math.max(...nummern) : 0;
  return `spalte-${hoechste + 1}`;
}

/* --- Zustand und Aktionen ------------------------------------------------- */

export interface SatzbaukastenZustand {
  readonly definition: SentenceBoxDefinition;
  readonly zoom: number;
  readonly fehler: string | null;
}

export type SatzbaukastenAktion =
  | { readonly art: "meta"; readonly patch: SentenceMetaInput }
  | { readonly art: "seite"; readonly patch: PageInput }
  | { readonly art: "alleRaender"; readonly millimeter: number }
  | { readonly art: "schrift"; readonly patch: TypographyInput }
  | { readonly art: "tabelle"; readonly patch: TableInput }
  | { readonly art: "zeilen"; readonly patch: LinesInput }
  | { readonly art: "spalteHinzufuegen"; readonly rolle: ColumnRole }
  | { readonly art: "spalteEntfernen"; readonly kennung: string }
  | { readonly art: "spalteVerschieben"; readonly kennung: string; readonly richtung: -1 | 1 }
  | { readonly art: "spalteAendern"; readonly kennung: string; readonly patch: ColumnInput }
  /** Rolle wechseln — setzt Fall und Artikel auf die Vorgaben der neuen Rolle. */
  | { readonly art: "spalteRolle"; readonly kennung: string; readonly rolle: ColumnRole }
  | { readonly art: "spalteEintraege"; readonly kennung: string; readonly text: string }
  | { readonly art: "laden"; readonly definition: unknown }
  | { readonly art: "zuruecksetzen" }
  | { readonly art: "zoom"; readonly faktor: number }
  | { readonly art: "zoomEinpassen"; readonly breitePx: number; readonly seiteMm: number }
  | { readonly art: "fehlerGelesen" };

export const SATZBAUKASTEN_START: SatzbaukastenZustand = {
  definition: DEFAULT_SENTENCE_BOX,
  zoom: 1,
  fehler: null,
};

export function satzbaukastenReducer(
  zustand: SatzbaukastenZustand,
  aktion: SatzbaukastenAktion,
): SatzbaukastenZustand {
  const update = (rezept: (definition: SentenceBoxDefinition) => SentenceBoxDefinition) => ({
    ...zustand,
    definition: rezept(zustand.definition),
    fehler: null,
  });

  const updateSpalten = (
    rezept: (spalten: readonly SentenceColumn[]) => readonly SentenceColumn[],
  ) => update((definition) => ({ ...definition, columns: rezept(definition.columns) }));

  const mapSpalte = (kennung: string, rezept: (spalte: SentenceColumn) => SentenceColumn) =>
    updateSpalten((spalten) =>
      spalten.map((spalte) => (spalte.id === kennung ? rezept(spalte) : spalte)),
    );

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

    case "tabelle":
      return update((definition) => ({
        ...definition,
        table: sanitizeTable(definition.table, aktion.patch),
      }));

    case "zeilen":
      return update((definition) => ({
        ...definition,
        lines: sanitizeLines(definition.lines, aktion.patch),
      }));

    case "spalteHinzufuegen":
      return updateSpalten((spalten) => {
        /* Still nichts tun statt scheitern: Der Knopf ist dann ohnehin
         * abgeschaltet, ein Aufruf wäre ein Fehler an anderer Stelle. */
        if (spalten.length >= CONSTRAINTS.sentenceColumns.max) return spalten;
        return [
          ...spalten,
          {
            id: naechsteSpaltenKennung(spalten),
            role: aktion.rolle,
            heading: "",
            entries: [],
            kasus: ROLE_DEFAULT_KASUS[aktion.rolle],
            article: ROLE_DEFAULT_ARTICLE[aktion.rolle],
          },
        ];
      });

    case "spalteEntfernen":
      return updateSpalten((spalten) => spalten.filter((spalte) => spalte.id !== aktion.kennung));

    case "spalteVerschieben":
      return updateSpalten((spalten) => {
        const index = spalten.findIndex((spalte) => spalte.id === aktion.kennung);
        const ziel = index + aktion.richtung;
        if (index === -1 || ziel < 0 || ziel >= spalten.length) return spalten;

        const umsortiert = [...spalten];
        const [bewegt] = umsortiert.splice(index, 1);
        if (bewegt === undefined) return spalten;
        umsortiert.splice(ziel, 0, bewegt);
        return umsortiert;
      });

    case "spalteAendern":
      return mapSpalte(aktion.kennung, (spalte) => ({ ...spalte, ...aktion.patch }));

    /*
     * Beim Rollenwechsel werden Fall und Artikel mitgezogen. Sonst bliebe nach
     * „Objekt -> Verb -> Objekt“ der Dativ stehen, den irgendwann jemand gesetzt
     * hat — und niemand fände den Grund für „einem Hund“.
     */
    case "spalteRolle":
      return mapSpalte(aktion.kennung, (spalte) => ({
        ...spalte,
        role: aktion.rolle,
        kasus: ROLE_DEFAULT_KASUS[aktion.rolle],
        article: ROLE_DEFAULT_ARTICLE[aktion.rolle],
      }));

    case "spalteEintraege":
      return mapSpalte(aktion.kennung, (spalte) => ({
        ...spalte,
        entries: parseEntries(aktion.text),
      }));

    case "laden": {
      const geprueft = pruefeSatzbaukasten(aktion.definition);
      if (!geprueft.ok) return { ...zustand, fehler: geprueft.fehler.join(" ") };
      return { definition: geprueft.definition, zoom: zustand.zoom, fehler: null };
    }

    case "zuruecksetzen":
      return { definition: DEFAULT_SENTENCE_BOX, zoom: zustand.zoom, fehler: null };

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
