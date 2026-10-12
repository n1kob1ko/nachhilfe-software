import { z } from "zod";
import { COLUMN_ROLES } from "../content/sentence-box";
import { FADE_MODES, TRACE_UNITS } from "../content/tracing";
import { PAGE_SIZES } from "../rendering/geometry";
import { HANDWRITING_SCRIPTS, SCRIPT_IDS } from "../rendering/handwriting-scripts";
import { LINEATUR_IDS } from "../rendering/lineatur";
import { mm, pt } from "../units";
import { CONSTRAINTS, type ConstraintKey } from "./constraints";
import type { SentenceBoxDefinition } from "./sentence-box-types";
import type { TracingDefinition } from "./tracing-types";
import type {
  CellDecoration,
  ContentSource,
  Margins,
  Orientation,
  PageConfig,
  PageSizeId,
  TypographyConfig,
  WorksheetDefinition,
} from "./types";

/**
 * Die drei Blattdefinitionen als zod-4-Schemas.
 *
 * WARUM ERST JETZT: Die Quelldatei kannte keine Validierung — die Definitionen
 * wurden nie geprüft, sondern nur beim Laden mit Vorgaben zusammengeführt und
 * begrenzt (`mergeDefinition` und Verwandte in `state/`). Das reicht für einen
 * halbfertigen Stand aus dem Browser-Speicher, aber nicht für eine Definition,
 * die als **Druckblatt** gespeichert, kopiert und wieder geöffnet wird: dort
 * kommt fremdes JSON an (D21).
 *
 * ZWEI WEGE, EINE WAHRHEIT — sie schließen einander nicht aus:
 *   - `mergeX(...)` in `state/` — **begrenzen**: ergänzt fehlende Felder aus den
 *     Vorgaben und zieht Zahlen in den erlaubten Bereich. Für alte, unvollständige
 *     Stände.
 *   - `pruefeX(...)` hier — **prüfen**: nimmt nur an, was vollständig und gültig
 *     ist, und sagt sonst auf Deutsch, was fehlt. Für die Grenze „Definition rein /
 *     Definition raus" (Laden eines gespeicherten Druckblatts, Drucken).
 *
 * Die Grenzen der Zahlen kommen aus `constraints.ts` — dieselben, die auch die
 * Reducer klemmen. Zwei Listen wären zwei Stellen, an denen sie auseinanderlaufen.
 *
 * EINHEITEN: Die Schemas arbeiten mit nackten `number`, so wie JSON sie liefert.
 * Erst `alsX(...)` setzt die Einheiten (`mm`, `pt`) — genau eine Stelle, an der
 * aus geprüften Zahlen eine getypte Definition wird.
 */

export const BLATTARTEN = ["lesetabelle", "satzbaukasten", "nachmalblatt"] as const;
export type Blattart = (typeof BLATTARTEN)[number];

export const BLATTART_LABEL: Record<Blattart, string> = {
  lesetabelle: "Lesetabelle",
  satzbaukasten: "Satzbaukasten",
  nachmalblatt: "Nachmalblatt",
};

/* --- Bausteine ------------------------------------------------------------ */

/**
 * Die zwei einstellbaren Darstellungen einer Wiederholung.
 *
 * `model` und `empty` entstehen beim Rechnen (`buildTraceRow`) und werden nie
 * eingestellt — deshalb stehen sie hier nicht, obwohl `TRACE_STYLES` sie kennt.
 */
const TRACE_ROW_STYLES = ["ghost", "outline"] as const;

/** Zahl mit den Grenzen aus `constraints.ts`. */
function zahl(key: ConstraintKey, ganzzahl = false) {
  const { min, max } = CONSTRAINTS[key];
  return (ganzzahl ? z.number().int() : z.number()).min(min).max(max);
}

const text = z.string();
const kennung = z.string().min(1);

const seiteSchema = z.object({
  size: z.enum(Object.keys(PAGE_SIZES) as [PageSizeId, ...PageSizeId[]]),
  orientation: z.enum(["portrait", "landscape"] satisfies Orientation[]),
  margins: z.object({
    top: zahl("margin"),
    right: zahl("margin"),
    bottom: zahl("margin"),
    left: zahl("margin"),
  }),
});

const typografieSchema = z.object({
  fontSize: zahl("fontSize"),
  lineHeight: zahl("lineHeight"),
  letterSpacing: zahl("letterSpacing"),
  bold: z.boolean(),
});

const inhaltSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wordList"), words: z.array(text) }),
  z.object({
    kind: z.literal("matrix"),
    config: z.object({
      onsets: z.array(text),
      nuclei: z.array(text),
      coda: text,
      order: z.enum(["onset-major", "nucleus-major"]),
      capitalize: z.boolean(),
    }),
  }),
]);

/* --- Lesetabelle ---------------------------------------------------------- */

export const lesetabelleSchema = z.object({
  title: text,
  subtitle: text,
  showTitle: z.boolean(),
  showPageNumbers: z.boolean(),
  page: seiteSchema,
  grid: z.object({
    columns: zahl("columns", true),
    columnGap: zahl("gap"),
    rowGap: zahl("gap"),
    rowHeight: zahl("rowHeight"),
    decoration: z.enum(["none", "baseline", "box"] satisfies CellDecoration[]),
  }),
  typography: typografieSchema,
  coloring: z.enum(["none", "alternating"]),
  content: inhaltSchema,
});

/* --- Satzbaukasten -------------------------------------------------------- */

const spalteSchema = z.object({
  id: kennung,
  role: z.enum(COLUMN_ROLES),
  heading: text,
  entries: z.array(text),
  kasus: z.enum(["nominativ", "akkusativ", "dativ"]),
  article: z.enum(["bestimmt", "unbestimmt", "ohne"]),
});

const spaltenSchema = z
  .array(spalteSchema)
  .min(CONSTRAINTS.sentenceColumns.min)
  .max(CONSTRAINTS.sentenceColumns.max)
  .refine((spalten) => new Set(spalten.map((spalte) => spalte.id)).size === spalten.length, {
    error: "Spalten-Kennungen müssen verschieden sein.",
  });

export const satzbaukastenSchema = z.object({
  title: text,
  showTitle: z.boolean(),
  instruction: text,
  boxHeading: text,
  linesHeading: text,
  showPageNumbers: z.boolean(),
  page: seiteSchema,
  typography: typografieSchema,
  table: z.object({
    rowHeight: zahl("rowHeight"),
    borders: z.enum(["all", "outline", "columns", "none"]),
    showHeadings: z.boolean(),
  }),
  columns: spaltenSchema,
  lines: z.object({
    count: zahl("writingLines", true),
    lineatur: z.enum(LINEATUR_IDS),
    /** `null` heißt ausdrücklich: Vorgabe der Lineatur nehmen. */
    spacing: zahl("gap").nullable(),
    numbered: z.boolean(),
  }),
});

/* --- Nachmalblatt --------------------------------------------------------- */

export const nachmalblattSchema = z.object({
  title: text,
  showTitle: z.boolean(),
  instruction: text,
  showPageNumbers: z.boolean(),
  page: seiteSchema,
  typography: typografieSchema,
  script: z.enum(SCRIPT_IDS),
  sizeAdjust: zahl("sizeAdjust"),
  unit: z.enum(TRACE_UNITS),
  content: text,
  rows: z.object({
    repeats: zahl("traceRepeats", true),
    showModel: z.boolean(),
    /* `model` und `empty` entstehen beim Rechnen — eingestellt wird nur, wie die
     * Wiederholungen nach der Vorlage aussehen. */
    style: z.enum(TRACE_ROW_STYLES),
    fade: z.enum(FADE_MODES),
    freeRows: zahl("traceFreeRows", true),
  }),
  lines: z.object({
    lineatur: z.enum(LINEATUR_IDS),
    spacing: zahl("gap").nullable(),
  }),
});

/* --- Aus geprüften Zahlen werden getypte Definitionen --------------------- */

function alsSeite(wert: z.infer<typeof seiteSchema>): PageConfig {
  const margins: Margins = {
    top: mm(wert.margins.top),
    right: mm(wert.margins.right),
    bottom: mm(wert.margins.bottom),
    left: mm(wert.margins.left),
  };
  return { size: wert.size, orientation: wert.orientation, margins };
}

function alsTypografie(wert: z.infer<typeof typografieSchema>): TypographyConfig {
  return {
    fontSize: pt(wert.fontSize),
    lineHeight: wert.lineHeight,
    letterSpacing: pt(wert.letterSpacing),
    bold: wert.bold,
  };
}

export function alsLesetabelle(wert: z.infer<typeof lesetabelleSchema>): WorksheetDefinition {
  const content: ContentSource =
    wert.content.kind === "wordList"
      ? { kind: "wordList", words: wert.content.words }
      : { kind: "matrix", config: { ...wert.content.config } };

  return {
    title: wert.title,
    subtitle: wert.subtitle,
    showTitle: wert.showTitle,
    showPageNumbers: wert.showPageNumbers,
    page: alsSeite(wert.page),
    grid: {
      columns: wert.grid.columns,
      columnGap: mm(wert.grid.columnGap),
      rowGap: mm(wert.grid.rowGap),
      rowHeight: mm(wert.grid.rowHeight),
      decoration: wert.grid.decoration,
    },
    typography: alsTypografie(wert.typography),
    coloring: wert.coloring,
    content,
  };
}

export function alsSatzbaukasten(wert: z.infer<typeof satzbaukastenSchema>): SentenceBoxDefinition {
  return {
    title: wert.title,
    showTitle: wert.showTitle,
    instruction: wert.instruction,
    boxHeading: wert.boxHeading,
    linesHeading: wert.linesHeading,
    showPageNumbers: wert.showPageNumbers,
    page: alsSeite(wert.page),
    typography: alsTypografie(wert.typography),
    table: {
      rowHeight: mm(wert.table.rowHeight),
      borders: wert.table.borders,
      showHeadings: wert.table.showHeadings,
    },
    columns: wert.columns.map((spalte) => ({
      id: spalte.id,
      role: spalte.role,
      heading: spalte.heading,
      entries: spalte.entries,
      kasus: spalte.kasus,
      article: spalte.article,
    })),
    lines: {
      count: wert.lines.count,
      lineatur: wert.lines.lineatur,
      spacing: wert.lines.spacing === null ? null : mm(wert.lines.spacing),
      numbered: wert.lines.numbered,
    },
  };
}

export function alsNachmalblatt(wert: z.infer<typeof nachmalblattSchema>): TracingDefinition {
  return {
    title: wert.title,
    showTitle: wert.showTitle,
    instruction: wert.instruction,
    showPageNumbers: wert.showPageNumbers,
    page: alsSeite(wert.page),
    typography: alsTypografie(wert.typography),
    script: wert.script,
    sizeAdjust: wert.sizeAdjust,
    unit: wert.unit,
    content: wert.content,
    rows: { ...wert.rows },
    lines: {
      lineatur: wert.lines.lineatur,
      spacing: wert.lines.spacing === null ? null : mm(wert.lines.spacing),
    },
  };
}

/* --- Prüfen und dabei Deutsch reden --------------------------------------- */

export type PruefErgebnis<T> = { readonly ok: true; readonly definition: T } | { readonly ok: false; readonly fehler: readonly string[] };

/** Deutsche Namen der Felder — ein Pfad wie `grid.columns` heißt „Spalten“. */
const FELD_LABEL: Record<string, string> = {
  title: "Titel",
  subtitle: "Untertitel",
  showTitle: "Titel zeigen",
  showPageNumbers: "Seitenzahlen",
  showHeadings: "Spaltenüberschriften",
  showModel: "Vorlage am Zeilenanfang",
  page: "Seitenformat",
  size: "Papierformat",
  orientation: "Ausrichtung",
  margins: "Seitenrand",
  top: "Seitenrand oben",
  right: "Seitenrand rechts",
  bottom: "Seitenrand unten",
  left: "Seitenrand links",
  grid: "Raster",
  columns: "Spalten",
  columnGap: "Spaltenabstand",
  rowGap: "Zeilenabstand",
  rowHeight: "Zeilenhöhe",
  decoration: "Zellrahmen",
  typography: "Schrift",
  fontSize: "Schriftgröße",
  lineHeight: "Zeilenhöhe der Schrift",
  letterSpacing: "Laufweite",
  bold: "Fett",
  coloring: "Silbenfarben",
  content: "Inhalt",
  kind: "Inhaltsart",
  words: "Wörter",
  config: "Silbenmatrix",
  onsets: "Anlaute",
  nuclei: "Vokale",
  coda: "Auslaut",
  order: "Reihenfolge",
  capitalize: "Großschreiben",
  instruction: "Arbeitsauftrag",
  boxHeading: "Überschrift über dem Kasten",
  linesHeading: "Überschrift über den Schreibzeilen",
  table: "Tabelle",
  borders: "Rahmen",
  lines: "Schreibzeilen",
  count: "Anzahl der Schreibzeilen",
  lineatur: "Lineatur",
  spacing: "Zeilenabstand",
  numbered: "Zeilen nummerieren",
  script: "Schulschrift",
  sizeAdjust: "Schriftgröße feinjustieren",
  unit: "Übungseinheit",
  rows: "Übungszeilen",
  repeats: "Wiederholungen",
  style: "Darstellung",
  fade: "Abnehmende Hilfe",
  freeRows: "Freie Zeilen",
  id: "Kennung",
  role: "Rolle",
  heading: "Überschrift",
  entries: "Einträge",
  kasus: "Fall",
  article: "Artikel",
};

const label = (pfad: readonly PropertyKey[]): string => {
  const letzter = pfad.length > 0 ? String(pfad[pfad.length - 1]) : "";
  return FELD_LABEL[letzter] ?? (letzter === "" ? "Definition" : letzter);
};

/** Ein zod-Problem als deutscher Satz. */
export function fehlerText(issue: z.core.$ZodIssue): string {
  const feld = label(issue.path);
  switch (issue.code) {
    case "too_small":
      return `${feld}: mindestens ${String(issue.minimum)}${issue.inclusive ? "" : " (ausschließlich)"} erlaubt.`;
    case "too_big":
      return `${feld}: höchstens ${String(issue.maximum)} erlaubt.`;
    case "invalid_value":
      return `${feld}: muss einer von ${issue.values.map((wert) => `„${String(wert)}“`).join(", ")} sein.`;
    case "invalid_type":
      return `${feld}: fehlt oder hat die falsche Art (erwartet ${issue.expected}).`;
    case "unrecognized_keys":
      return `${feld}: unbekannte Felder ${issue.keys.join(", ")}.`;
    default:
      return `${feld}: ${issue.message}`;
  }
}

function pruefe<T>(schema: z.ZodType, wert: unknown, als: (geprueft: never) => T): PruefErgebnis<T> {
  const ergebnis = schema.safeParse(wert);
  if (!ergebnis.success) {
    return { ok: false, fehler: ergebnis.error.issues.map(fehlerText) };
  }
  return { ok: true, definition: als(ergebnis.data as never) };
}

export function pruefeLesetabelle(wert: unknown): PruefErgebnis<WorksheetDefinition> {
  return pruefe(lesetabelleSchema, wert, alsLesetabelle as (geprueft: never) => WorksheetDefinition);
}

export function pruefeSatzbaukasten(wert: unknown): PruefErgebnis<SentenceBoxDefinition> {
  return pruefe(satzbaukastenSchema, wert, alsSatzbaukasten as (geprueft: never) => SentenceBoxDefinition);
}

export function pruefeNachmalblatt(wert: unknown): PruefErgebnis<TracingDefinition> {
  return pruefe(nachmalblattSchema, wert, alsNachmalblatt as (geprueft: never) => TracingDefinition);
}

/** Prüft eine Definition gegen die Schemas ihrer Blattart. */
export function pruefeBlatt(
  art: Blattart,
  wert: unknown,
): PruefErgebnis<WorksheetDefinition | SentenceBoxDefinition | TracingDefinition> {
  switch (art) {
    case "lesetabelle":
      return pruefeLesetabelle(wert);
    case "satzbaukasten":
      return pruefeSatzbaukasten(wert);
    case "nachmalblatt":
      return pruefeNachmalblatt(wert);
  }
}

/**
 * Prüft eine serialisierte Definition (JSON aus einem gespeicherten Druckblatt).
 *
 * Ungültiges JSON ist derselbe Fall wie eine ungültige Definition: eine
 * deutsche Meldung, kein Absturz.
 */
export function pruefeJson(
  art: Blattart,
  json: string,
): PruefErgebnis<WorksheetDefinition | SentenceBoxDefinition | TracingDefinition> {
  let wert: unknown;
  try {
    wert = JSON.parse(json);
  } catch {
    return { ok: false, fehler: [`${BLATTART_LABEL[art]}: der gespeicherte Inhalt ist kein gültiges JSON.`] };
  }
  return pruefeBlatt(art, wert);
}

/** Nur die Schriften, deren Datei wirklich im Projekt liegt (siehe `handwriting-scripts.ts`). */
export function fehlendeSchriftHinweis(id: (typeof SCRIPT_IDS)[number]): string | null {
  const schrift = HANDWRITING_SCRIPTS[id];
  if (schrift.bundled) return null;
  return `${schrift.source ?? "Keine Schriftdatei im Projekt"} — bis dahin wird die Druckschrift gesetzt.`;
}
