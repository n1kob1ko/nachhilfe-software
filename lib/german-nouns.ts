/**
 * Deutsche Nomen: Genus, Kasus, Artikel.
 *
 * WOZU: Im Satzbaukasten steht in der Objektspalte „einen Hund", aber „eine
 * Blume" und „ein Auto". Das ist Akkusativ, und welche Form es wird, haengt am
 * Genus des Nomens. Wer das von Hand tippt, produziert frueher oder spaeter
 * „einen Blume" auf einem Blatt fuer die erste Klasse.
 *
 * Deshalb wird der Artikel gerechnet, nicht getippt. Eingegeben wird das
 * Nomen mit seinem Genus -- in der Schreibweise, die aus jedem Woerterbuch
 * vertraut ist:
 *
 *   "der Hund"    -> Genus aus dem bestimmten Artikel
 *   "Hund (m)"    -> Genus als Kuerzel
 *   "Hund"        -> Genus unbekannt, wird gemeldet statt geraten
 *
 * BEWUSSTE GRENZEN -- bitte vor dem Erweitern lesen:
 *
 *   - Kein Woerterbuch. Ohne Angabe bleibt das Genus unbekannt; wir raten
 *     nicht. Ein falsch geratener Artikel auf einem Arbeitsblatt ist
 *     schlimmer als ein sichtbar fehlender.
 *   - Keine Deklination des Nomens selbst. Der Dativ Plural verlangt
 *     eigentlich ein angehaengtes -n ("den Hunden"); das haengt an der
 *     Pluralbildung und die ist ohne Woerterbuch nicht zu haben. Wir bilden
 *     nur den Artikel und melden diesen Fall.
 *   - Keine Adjektive. "einen grossen Hund" braucht die Adjektivdeklination
 *     -- ein eigenes Kapitel, das die Zielklassenstufe nicht braucht.
 *
 * Reine Funktionen: keine Uhr, kein Zufall, kein Zustand.
 *
 * Herkunft: aus `aufgaben_webseite/src/domain/language/german-nouns.ts`
 * uebernommen (Merge-Plan tommys-merge.md, §3.2). Der Plan wollte die Datei
 * zunaechst unter `lib/druckblatt/language/`; sie steht jetzt direkt unter
 * `lib/`, weil sie ausser Phase 5 (Satzbaukasten) auch die Artikelbank prueft
 * (Phase 1, Schritt 6). Am Code hat sich nichts geaendert.
 */

export const GENERA = ["m", "f", "n", "plural"] as const;
export type Genus = (typeof GENERA)[number];

export const KASUS = ["nominativ", "akkusativ", "dativ"] as const;
export type Kasus = (typeof KASUS)[number];

/** Welcher Artikel vor das Nomen tritt -- oder gar keiner. */
export const ARTICLE_MODES = ["bestimmt", "unbestimmt", "ohne"] as const;
export type ArticleMode = (typeof ARTICLE_MODES)[number];

/* --- Artikeltabellen ---------------------------------------------------------
 * Ausgeschrieben statt gerechnet. Die deutschen Artikelformen sind eine
 * Tabelle mit zwoelf Feldern, keine Regel -- sie so hinzuschreiben ist
 * nachlesbar und nicht laenger als jede Ableitung.
 */

const DEFINITE: Record<Kasus, Record<Genus, string>> = {
  nominativ: { m: "der", f: "die", n: "das", plural: "die" },
  akkusativ: { m: "den", f: "die", n: "das", plural: "die" },
  dativ: { m: "dem", f: "der", n: "dem", plural: "den" },
};

/**
 * Der unbestimmte Artikel hat keinen Plural. `null` heisst hier deshalb nicht
 * „unbekannt", sondern „gibt es nicht" -- im Plural steht das blosse Nomen.
 */
const INDEFINITE: Record<Kasus, Record<Genus, string | null>> = {
  nominativ: { m: "ein", f: "eine", n: "ein", plural: null },
  akkusativ: { m: "einen", f: "eine", n: "ein", plural: null },
  dativ: { m: "einem", f: "einer", n: "einem", plural: null },
};

/** Bestimmte Artikel im Nominativ -- die Schreibweise, mit der Genus notiert wird. */
const GENUS_BY_ARTICLE: Record<string, Genus> = {
  der: "m",
  die: "f",
  das: "n",
  /*
   * „die" ist zweideutig (Femininum oder Plural). Der Konflikt wird oben
   * zugunsten des Femininums entschieden, weil das im Grundwortschatz der
   * ersten Klassen der weit haeufigere Fall ist. Wer den Plural meint,
   * schreibt „(pl)".
   */
};

const GENUS_BY_MARKER: Record<string, Genus> = {
  m: "m",
  mask: "m",
  maskulin: "m",
  f: "f",
  fem: "f",
  feminin: "f",
  n: "n",
  neutr: "n",
  neutrum: "n",
  pl: "plural",
  plural: "plural",
};

/* --- Pronomen ----------------------------------------------------------------
 * Ein Pronomen IST bereits eine vollstaendige Nominalphrase -- „ich" bekommt
 * keinen Artikel. Ohne diese Liste wuerde jede Subjektspalte der ersten
 * Klasse („Ich", „Du", „Wir") als „Genus unbekannt" beanstandet, und die
 * Warnung waere binnen einer Minute nur noch Rauschen, das niemand liest.
 */
const PRONOUNS = new Set(["ich", "du", "er", "sie", "es", "wir", "ihr", "man"]);

/** Ob das Wort ohne Artikel auskommt, weil es selbst schon eine Phrase ist. */
export function isPronoun(word: string): boolean {
  return PRONOUNS.has(word.trim().toLowerCase());
}

/* --- Einlesen ---------------------------------------------------------------- */

export interface ParsedNoun {
  /** Das Nomen ohne Artikel und ohne Genuskuerzel. */
  readonly noun: string;
  /** `null`, wenn die Eingabe kein Genus mitgeteilt hat. */
  readonly genus: Genus | null;
}

/** Klammerzusatz am Ende: „Hund (m)". */
const MARKER_PATTERN = /^(.*?)\s*[([]\s*([a-zA-ZäöüÄÖÜ.]+)\s*[)\]]\s*$/u;

/**
 * Liest ein Nomen samt Genus aus der Eingabe der Lehrkraft.
 *
 * Erkennt nichts, was nicht dasteht: Ohne Artikel und ohne Kuerzel bleibt
 * `genus` auf `null`. Der Aufrufer entscheidet, ob er das meldet.
 */
export function parseNoun(input: string): ParsedNoun {
  const trimmed = input.trim().replace(/\s+/gu, " ");
  if (trimmed === "") return { noun: "", genus: null };

  /* Zuerst das Kuerzel: „der Hund (pl)" soll den Plural gewinnen lassen,
   * denn das Kuerzel ist die ausdruecklichere Angabe. */
  const marked = MARKER_PATTERN.exec(trimmed);
  if (marked !== null) {
    const rest = marked[1] ?? "";
    const genus = GENUS_BY_MARKER[(marked[2] ?? "").toLowerCase().replace(/\.$/u, "")];
    if (genus !== undefined) {
      /* Ein zusaetzlicher Artikel davor wird verworfen, nicht beachtet. */
      return { noun: stripArticle(rest).noun, genus };
    }
    /* Unbekanntes Kuerzel -- Klammer gehoert offenbar zum Wort. */
    return stripArticle(trimmed);
  }

  return stripArticle(trimmed);
}

function stripArticle(text: string): ParsedNoun {
  const parts = text.split(" ");
  const first = (parts[0] ?? "").toLowerCase();
  const genus = GENUS_BY_ARTICLE[first];

  if (genus !== undefined && parts.length > 1) {
    return { noun: parts.slice(1).join(" "), genus };
  }
  return { noun: text, genus: null };
}

/* --- Ausgeben ---------------------------------------------------------------- */

/** Warum eine Nomenphrase nicht vollstaendig gebildet werden konnte. */
export const NOUN_ISSUES = ["genusUnbekannt", "keinUnbestimmterPlural", "dativPlural"] as const;
export type NounIssue = (typeof NOUN_ISSUES)[number];

export interface NounPhrase {
  /** Was auf dem Blatt steht. Nie leer, solange das Nomen nicht leer war. */
  readonly text: string;
  /**
   * Was dabei nicht sauber ging. Leer heisst: die Form stimmt.
   * Die Oberflaeche zeigt das an -- verschwiegen wird nichts, sonst waere
   * derselbe Fehler wieder unsichtbar, nur eine Ebene tiefer.
   */
  readonly issues: readonly NounIssue[];
}

export interface NounPhraseOptions {
  readonly kasus: Kasus;
  readonly article: ArticleMode;
}

/**
 * Bildet die Nomenphrase.
 *
 * Ohne Genus wird das Nomen unveraendert durchgereicht statt mit einem
 * geratenen Artikel versehen: Ein sichtbar fehlender Artikel ist ein Fehler,
 * den die Lehrkraft in der Vorschau bemerkt. Ein falscher ist einer, den das
 * Kind lernt.
 */
export function buildNounPhrase(parsed: ParsedNoun, options: NounPhraseOptions): NounPhrase {
  const noun = parsed.noun.trim();
  if (noun === "") return { text: "", issues: [] };
  if (options.article === "ohne") return { text: noun, issues: [] };
  /* Pronomen brauchen keinen Artikel und sind deshalb auch kein Mangel. */
  if (parsed.genus === null && isPronoun(noun)) return { text: noun, issues: [] };
  if (parsed.genus === null) return { text: noun, issues: ["genusUnbekannt"] };

  if (options.article === "bestimmt") {
    const article = DEFINITE[options.kasus][parsed.genus];
    /* Der Dativ Plural verlangt am Nomen ein -n ("den Hunden"). Ohne
     * Pluralwissen bilden wir nur den Artikel -- und sagen es. */
    const issues: NounIssue[] = options.kasus === "dativ" && parsed.genus === "plural" ? ["dativPlural"] : [];
    return { text: `${article} ${noun}`, issues };
  }

  const article = INDEFINITE[options.kasus][parsed.genus];
  if (article === null) return { text: noun, issues: ["keinUnbestimmterPlural"] };
  return { text: `${article} ${noun}`, issues: [] };
}

/** Bequemlichkeit fuer den haeufigen Fall „Rohtext rein, Anzeigetext raus". */
export function nounPhraseFrom(input: string, options: NounPhraseOptions): NounPhrase {
  return buildNounPhrase(parseNoun(input), options);
}

/** Der bestimmte Artikel im Nominativ -- die Schreibweise fuer Wortlisten. */
export function genusMarker(genus: Genus): string {
  return DEFINITE.nominativ[genus];
}
