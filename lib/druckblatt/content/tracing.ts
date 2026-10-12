/**
 * Nachmal-Zeilen -- was in einer Uebungszeile steht und wie viel Hilfe.
 *
 * Der didaktische Kern dieser Uebung ist die ABNEHMENDE HILFE: Vorne steht
 * die Vorlage kraeftig, dann wird sie blasser, hinten ist die Zeile leer. Das
 * Kind loest sich beim Schreiben von der Vorlage, statt bis zum Rand
 * nachzufahren.
 *
 * Was diese Datei liefert: je Position eine STAERKE zwischen 0 und 1.
 * Was sie NICHT liefert: eine Farbe oder Deckkraft. Wie aus Staerke Optik
 * wird, entscheidet der Renderer -- auf Papier braucht es andere Werte als
 * auf dem Bildschirm, und ein blasser Grauton ist im Schuldrucker schnell
 * gar nicht mehr da.
 *
 * Reine Funktionen: keine Uhr, kein Zufall, kein Zustand.
 */

/** Wie ein Element dargestellt wird. */
export const TRACE_STYLES = [
  /** Volle Staerke -- die Vorlage am Zeilenanfang. */
  'model',
  /** Blass zum Nachfahren. */
  'ghost',
  /** Hohl mit Umriss, zum Ausmalen. */
  'outline',
  /** Nichts -- das Kind schreibt frei. */
  'empty',
] as const;
export type TraceStyle = (typeof TRACE_STYLES)[number];

/** Womit geuebt wird. Aendert nur, wie die Eingabe zerlegt wird. */
export const TRACE_UNITS = ['letter', 'syllable', 'word'] as const;
export type TraceUnit = (typeof TRACE_UNITS)[number];

/** Wie die Hilfe ueber die Zeile abnimmt. */
export const FADE_MODES = [
  /** Alle Wiederholungen gleich stark. */
  'off',
  /** Gleichmaessig abnehmend bis zum Zeilenende. */
  'linear',
  /** Erste Haelfte mit Hilfe, zweite Haelfte leer. */
  'half',
] as const;
export type FadeMode = (typeof FADE_MODES)[number];

export interface TraceRowConfig {
  /** Wiederholungen je Zeile, die Vorlage eingerechnet. */
  readonly repeats: number;
  /** Ob die erste Wiederholung als kraeftige Vorlage steht. */
  readonly showModel: boolean;
  /** Darstellung der Wiederholungen nach der Vorlage. */
  readonly style: Extract<TraceStyle, 'ghost' | 'outline'>;
  readonly fade: FadeMode;
}

export interface TraceCell {
  /** Laufende Position in der Zeile, 0-basiert. */
  readonly index: number;
  readonly text: string;
  readonly style: TraceStyle;
  /**
   * Wie kraeftig, 0 bis 1. Bei `empty` immer 0.
   *
   * Bewusst eine Zahl und kein Farbwert: Der Renderer entscheidet, ab wann
   * etwas noch druckbar ist.
   */
  readonly strength: number;
}

/** Unter diesem Wert waere auf Papier nichts mehr zu sehen. */
const MIN_VISIBLE = 0.15;

/**
 * Baut eine Uebungszeile.
 *
 * Die Vorlage zaehlt als erste Wiederholung, nicht zusaetzlich: Wer „6 mal"
 * einstellt, bekommt sechs Zeichen auf der Zeile -- nicht sieben.
 */
export function buildTraceRow(text: string, config: TraceRowConfig): readonly TraceCell[] {
  const item = text.trim();
  const count = Math.max(0, Math.trunc(config.repeats));
  if (item === '' || count === 0) return [];

  return Array.from({ length: count }, (_, index) => {
    if (config.showModel && index === 0) {
      return { index, text: item, style: 'model' as const, strength: 1 };
    }

    const strength = strengthAt(index, count, config);
    if (strength <= 0) {
      /* Leere Positionen tragen trotzdem ihren Text -- der Renderer braucht
       * ihn, um den Platz freizuhalten. Sichtbar ist er nicht. */
      return { index, text: item, style: 'empty' as const, strength: 0 };
    }
    return { index, text: item, style: config.style, strength };
  });
}

/**
 * Der Verlauf der Hilfe.
 *
 * Gerechnet wird ueber die Positionen NACH der Vorlage: Sonst waere bei
 * abgeschalteter Vorlage der erste Buchstabe schwaecher als bei
 * eingeschalteter, und dieselbe Einstellung saehe zweimal anders aus.
 */
function strengthAt(index: number, count: number, config: TraceRowConfig): number {
  const first = config.showModel ? 1 : 0;
  const total = count - first;
  if (total <= 0) return 0;

  const position = index - first;

  switch (config.fade) {
    case 'off':
      return 1;

    case 'half':
      /* Aufgerundet: Bei ungerader Anzahl bekommt das Kind lieber eine Hilfe
       * mehr als eine zu wenig. */
      return position < Math.ceil(total / 2) ? 1 : 0;

    case 'linear': {
      if (total === 1) return 1;
      /* Von voller Staerke bis auf 0 am letzten Platz. */
      const value = 1 - position / (total - 1);
      return value < MIN_VISIBLE ? 0 : value;
    }
  }
}

/* --- Eingabe zerlegen -------------------------------------------------------- */

/**
 * Macht aus der Eingabe der Lehrkraft die Uebungselemente -- eines je Zeile
 * des Blatts.
 *
 * Bei Buchstaben wird jedes Zeichen einzeln geuebt, bei Silben und Woertern
 * das, was zwischen den Trennern steht. Getrennt wird an Komma, Leerzeichen
 * und Zeilenumbruch -- alle drei sind im Umlauf, und niemand soll raten
 * muessen, welcher gilt.
 */
export function splitTraceItems(input: string, unit: TraceUnit): readonly string[] {
  if (unit === 'letter') {
    /* `[...string]` statt `split('')`: Trennt nach Zeichen, nicht nach
     * UTF-16-Einheiten -- sonst zerfielen zusammengesetzte Zeichen. */
    return [...input].map((char) => char.trim()).filter((char) => char !== '');
  }

  return input
    .split(/[\s,;]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/* --- Fertige Vorlagen -------------------------------------------------------- */

/**
 * Das deutsche Alphabet als Schnellauswahl.
 *
 * Umlaute und ß stehen dahinter statt einsortiert: Sie werden spaeter
 * eingefuehrt, und ein Blatt „A bis Z" soll nicht ploetzlich ein ß enthalten.
 */
export const ALPHABET_LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const ALPHABET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const UMLAUTS_LOWER = 'äöüß';
export const UMLAUTS_UPPER = 'ÄÖÜ';
