/**
 * Wortarten: which Wortarten a student practises (chosen by the teacher or by Schulstufe), real
 * determination tasks from an annotated sentence bank (no AI needed), and the checks every
 * AI-written Wortarten task has to pass, whatever the provider. Pure: no database, also used in the
 * browser (Übungs-Builder). Docs: docs/wortarten.md.
 */
import { levelOf, type Difficulty } from "./curriculum";
import { GAP, type TaskDraft } from "./tasks";

type Rng = () => number;

// ---------- Wortarten and their names ----------
export const WORTARTEN = ["nomen", "verb", "adjektiv", "artikel", "pronomen", "praeposition", "konjunktion", "adverb"] as const;
export type Wortart = (typeof WORTARTEN)[number];
export const isWortart = (x: unknown): x is Wortart => typeof x === "string" && (WORTARTEN as readonly string[]).includes(x);

export const WORTART_LABEL: Record<Wortart, string> = {
  nomen: "Nomen",
  verb: "Verb",
  adjektiv: "Adjektiv",
  artikel: "Artikel",
  pronomen: "Pronomen",
  praeposition: "Präposition",
  konjunktion: "Konjunktion",
  adverb: "Adverb",
};
export const WORTART_PLURAL: Record<Wortart, string> = {
  nomen: "Nomen",
  verb: "Verben",
  adjektiv: "Adjektive",
  artikel: "Artikel",
  pronomen: "Pronomen",
  praeposition: "Präpositionen",
  konjunktion: "Konjunktionen",
  adverb: "Adverbien",
};
/** Names used in Austrian schools; every one counts as the right answer in a gap. */
export const WORTART_NAMES: Record<Wortart, string[]> = {
  nomen: ["Nomen", "Namenwort", "Namenswort", "Hauptwort", "Substantiv"],
  verb: ["Verb", "Zeitwort", "Tunwort", "Tuwort", "Tätigkeitswort"],
  adjektiv: ["Adjektiv", "Eigenschaftswort", "Wiewort"],
  artikel: ["Artikel", "Begleiter", "Geschlechtswort"],
  pronomen: ["Pronomen", "Fürwort"],
  praeposition: ["Präposition", "Verhältniswort", "Vorwort"],
  konjunktion: ["Konjunktion", "Bindewort"],
  adverb: ["Adverb", "Umstandswort"],
};

/** Unterarten the app asks for (key "wortart.sub"), with the names that count. */
export const UNTERARTEN: Record<string, { of: Wortart; label: string; names: string[] }> = {
  "pronomen.personal": { of: "pronomen", label: "Personalpronomen", names: ["persönliches Fürwort"] },
  "pronomen.possessiv": { of: "pronomen", label: "Possessivpronomen", names: ["besitzanzeigendes Fürwort"] },
  "pronomen.demonstrativ": { of: "pronomen", label: "Demonstrativpronomen", names: ["hinweisendes Fürwort"] },
  "pronomen.relativ": { of: "pronomen", label: "Relativpronomen", names: ["bezügliches Fürwort"] },
  "pronomen.reflexiv": { of: "pronomen", label: "Reflexivpronomen", names: ["rückbezügliches Fürwort"] },
  "pronomen.frage": { of: "pronomen", label: "Interrogativpronomen", names: ["Fragepronomen", "Fragefürwort", "fragendes Fürwort"] },
  "pronomen.unbest": { of: "pronomen", label: "Indefinitpronomen", names: ["unbestimmtes Fürwort"] },
  "artikel.bestimmt": { of: "artikel", label: "bestimmter Artikel", names: ["bestimmter Begleiter"] },
  "artikel.unbestimmt": { of: "artikel", label: "unbestimmter Artikel", names: ["unbestimmter Begleiter"] },
  "verb.voll": { of: "verb", label: "Vollverb", names: [] },
  "verb.hilf": { of: "verb", label: "Hilfsverb", names: [] },
  "verb.modal": { of: "verb", label: "Modalverb", names: [] },
  "konjunktion.neben": { of: "konjunktion", label: "nebenordnende Konjunktion", names: ["beiordnende Konjunktion"] },
  "konjunktion.unter": { of: "konjunktion", label: "unterordnende Konjunktion", names: [] },
  "adverb.ort": { of: "adverb", label: "Adverb des Ortes", names: ["Lokaladverb"] },
  "adverb.zeit": { of: "adverb", label: "Adverb der Zeit", names: ["Temporaladverb"] },
  "adverb.art": { of: "adverb", label: "Adverb der Art und Weise", names: ["Modaladverb"] },
  "adverb.grund": { of: "adverb", label: "Adverb des Grundes", names: ["Kausaladverb"] },
};

/** What the student can test to find the Wortart (hints, explanations). */
export const PROBE: Record<Wortart, string> = {
  nomen: "Nomen: Man kann „der, die, das“ davorsetzen, und man schreibt sie groß (der Hund).",
  verb: "Verb: Man kann „ich“, „du“ oder „er“ davorsetzen, und das Wort verändert sich (ich laufe, er läuft).",
  adjektiv: "Adjektiv: Es sagt, wie etwas ist, und man kann es steigern (klein, kleiner, am kleinsten).",
  artikel: "Artikel: der, die, das, ein, eine begleiten ein Nomen.",
  pronomen: "Pronomen: Es steht für ein Nomen oder begleitet es (er, sie, mein, dieser).",
  praeposition: "Präposition: Es zeigt ein Verhältnis, oft einen Ort, und steht vor einem Nomen (auf dem Tisch, mit dem Rad).",
  konjunktion: "Konjunktion: Es verbindet Wörter oder Sätze (und, oder, weil, dass).",
  adverb: "Adverb: Es sagt, wann, wo, wie oder warum etwas geschieht, und verändert seine Form nicht (heute, hier, oft).",
};

/** Wortarten students easily mix up: who looks for X has to tell these apart from X. */
const CONFUSE: Record<Wortart, Wortart[]> = {
  nomen: ["pronomen"],
  verb: [],
  adjektiv: ["adverb"],
  artikel: ["pronomen"],
  pronomen: ["artikel", "nomen"],
  praeposition: ["adverb", "konjunktion"],
  konjunktion: ["praeposition", "adverb"],
  adverb: ["adjektiv", "praeposition", "konjunktion"],
};

// ---------- skills ----------
export const WORTARTEN_SKILL = "deutsch.wortarten.bestimmen";
export const NOMEN_SKILL = "deutsch.wortarten.nomen";
export const UNTERARTEN_SKILL = `${WORTARTEN_SKILL}.unterarten`;
export const wortartSkill = (w: Wortart) => `${WORTARTEN_SKILL}.${w}`;
export const isWortartenSkill = (id: string | null | undefined): boolean => Boolean(id) && (id === NOMEN_SKILL || id === WORTARTEN_SKILL || id!.startsWith(`${WORTARTEN_SKILL}.`));
export const wortartOfSkill = (id: string): Wortart | null => {
  const w = id.startsWith(`${WORTARTEN_SKILL}.`) ? id.slice(WORTARTEN_SKILL.length + 1) : "";
  return isWortart(w) ? w : null;
};

export type WortartSetting = {
  /** The Wortarten the tasks ask for; nothing else appears as an answer. */
  allowed: Wortart[];
  /** Unterarten (Pronomenarten, Artikel, Verbarten …) may be asked at higher difficulty. */
  unterarten: boolean;
  /** true = the teacher chose the Wortarten (Teilfähigkeiten), false = Grundeinstellung for the Schulstufe. */
  chosen: boolean;
  grade: number;
  /** Only „Nomen erkennen und großschreiben“: finding nouns and writing them with a capital letter. */
  nomenOnly?: boolean;
};

/**
 * Grundeinstellung by Schulstufe. Volksschule: Nomen, Verb, Adjektiv (Lehrplan VS: „die Wortarten wie
 * Nomen, Verb, Adjektiv … mit den Fachbegriffen benennen“). The Lehrplan of the Unterstufe only says
 * „Basisfertigkeiten“ (1. Klasse) and „differenzierte Fertigkeiten“ (2. Klasse) in Wort- und
 * Satzgrammatik, so the steps after that are our own didactic choice; the teacher can change them.
 */
export function defaultWortarten(grade: number): { allowed: Wortart[]; unterarten: boolean } {
  if (grade <= 4) return { allowed: ["nomen", "verb", "adjektiv"], unterarten: false };
  if (grade === 5) return { allowed: ["nomen", "verb", "adjektiv", "artikel", "pronomen", "praeposition"], unterarten: false };
  if (grade === 6) return { allowed: [...WORTARTEN], unterarten: false };
  return { allowed: [...WORTARTEN], unterarten: true };
}

/**
 * Which Wortarten a task may ask for. Teilfähigkeiten chosen by the teacher decide; otherwise the
 * Grundeinstellung of the Schulstufe plus what the student is doing in school right now (Aktueller
 * Stoff) and what was practised already. null when no Wortarten skill is chosen.
 */
export function wortartenFor(skillIds: string[], grade: number, known: { practised?: string[]; current?: string[] } = {}): WortartSetting | null {
  if (!skillIds.some(isWortartenSkill)) return null;
  const order = (xs: Iterable<Wortart>) => WORTARTEN.filter((w) => new Set(xs).has(w));
  const bestimmen = skillIds.some((id) => id === WORTARTEN_SKILL || id.startsWith(`${WORTARTEN_SKILL}.`));
  const nomen = skillIds.includes(NOMEN_SKILL);
  if (!bestimmen) return { allowed: ["nomen"], unterarten: false, chosen: true, grade, nomenOnly: true };
  const picked = skillIds.map(wortartOfSkill).filter((w): w is Wortart => w !== null);
  if (picked.length) return { allowed: order([...picked, ...(nomen ? (["nomen"] as Wortart[]) : [])]), unterarten: skillIds.includes(UNTERARTEN_SKILL), chosen: true, grade };
  const base = defaultWortarten(grade);
  const extra = [...(known.current ?? []), ...(known.practised ?? [])];
  return {
    allowed: order([...base.allowed, ...extra.map(wortartOfSkill).filter((w): w is Wortart => w !== null)]),
    unterarten: base.unterarten || skillIds.includes(UNTERARTEN_SKILL) || extra.includes(UNTERARTEN_SKILL),
    chosen: false,
    grade,
  };
}

/** „kein Nomen“, „keine Präposition“. */
export const keinLabel = (w: Wortart) => `${w === "praeposition" || w === "konjunktion" ? "keine" : "kein"} ${WORTART_LABEL[w]}`;

export const listWortarten = (ws: Wortart[]) => ws.map((w) => WORTART_PLURAL[w]).join(", ");

// ---------- the sentence bank ----------
/**
 * Every word with its Wortart as it is taught in Austrian schools, written „Wort:tag“ (a digit after the
 * tag sets the difficulty of that word). Words tagged x are never asked: verb particles (vor in „liest
 * vor“) and a Präposition merged with an Artikel (im, beim, ins). Adjectives that say how something
 * happens („Er läuft schnell.“) stay Adjektive: adj.adv.
 */
const TAGS: Record<string, { wa: Wortart | null; sub: string | null; level: number; confuses?: Wortart[] }> = {
  n: { wa: "nomen", sub: null, level: 1 },
  v: { wa: "verb", sub: "voll", level: 1 },
  "v.hilf": { wa: "verb", sub: "hilf", level: 2 },
  "v.modal": { wa: "verb", sub: "modal", level: 2 },
  // sein as a full verb ("ist müde"): a Verb, but not asked for its Unterart
  "v.kop": { wa: "verb", sub: null, level: 2 },
  adj: { wa: "adjektiv", sub: null, level: 1 },
  "adj.adv": { wa: "adjektiv", sub: "adverbial", level: 2 },
  "art.b": { wa: "artikel", sub: "bestimmt", level: 1 },
  "art.u": { wa: "artikel", sub: "unbestimmt", level: 1 },
  "pron.pers": { wa: "pronomen", sub: "personal", level: 1 },
  "pron.poss": { wa: "pronomen", sub: "possessiv", level: 2 },
  "pron.dem": { wa: "pronomen", sub: "demonstrativ", level: 2 },
  "pron.rel": { wa: "pronomen", sub: "relativ", level: 3 },
  "pron.refl": { wa: "pronomen", sub: "reflexiv", level: 2 },
  "pron.frage": { wa: "pronomen", sub: "frage", level: 2 },
  "pron.unbest": { wa: "pronomen", sub: "unbest", level: 2 },
  praep: { wa: "praeposition", sub: null, level: 1 },
  "konj.neben": { wa: "konjunktion", sub: "neben", level: 1 },
  "konj.unter": { wa: "konjunktion", sub: "unter", level: 2 },
  "adv.ort": { wa: "adverb", sub: "ort", level: 1 },
  "adv.zeit": { wa: "adverb", sub: "zeit", level: 1 },
  "adv.art": { wa: "adverb", sub: "art", level: 1 },
  "adv.grund": { wa: "adverb", sub: "grund", level: 2 },
  adv: { wa: "adverb", sub: null, level: 2 },
  "x.pa": { wa: null, sub: null, level: 9, confuses: ["praeposition", "artikel"] },
  "x.vz": { wa: null, sub: null, level: 9, confuses: ["verb", "praeposition", "adverb"] },
};

const BANK_SRC = [
  "Der:art.b kleine:adj Hund:n schläft:v.",
  "Die:art.b Katze:n trinkt:v frische:adj Milch:n.",
  "Ein:art.u großer:adj Vogel:n singt:v.",
  "Die:art.b Kinder:n spielen:v im:x.pa Garten:n.",
  "Mama:n backt:v einen:art.u süßen:adj Kuchen:n.",
  "Der:art.b alte:adj Baum:n wächst:v langsam:adj.adv.",
  "Lisa:n liest:v ein:art.u spannendes:adj Buch:n.",
  "Das:art.b rote:adj Auto:n fährt:v schnell:adj.adv.",
  "Der:art.b Bauer:n füttert:v die:art.b hungrigen:adj Hühner:n.",
  "Die:art.b Sonne:n scheint:v hell:adj.adv.",
  "Tom:n malt:v ein:art.u buntes:adj Bild:n.",
  "Die:art.b gelben:adj Blumen:n blühen:v.",
  "Der:art.b Hund:n ist:v.kop müde:adj.",
  "Oma:n strickt:v einen:art.u warmen:adj Schal:n.",
  "Die:art.b Schüler:n schreiben:v einen:art.u kurzen:adj Text:n.",
  "Die:art.b Ente:n schwimmt:v auf:praep dem:art.b Teich:n.",
  "Mein:pron.poss Bruder:n spielt:v Fußball:n.",
  "Wir:pron.pers gehen:v heute:adv.zeit ins:x.pa Kino:n.",
  "Er:pron.pers wartet:v vor:praep der:art.b Schule:n.",
  "Sie:pron.pers kauft:v Brot:n und:konj.neben Butter:n.",
  "Ich:pron.pers lese:v gern:adv.art Comics:n.",
  "Die:art.b Kinder:n laufen:v schnell:adj.adv nach:praep Hause:n.",
  "Das:art.b Wetter:n ist:v.kop heute:adv.zeit sehr:adv schön:adj.",
  "Wir:pron.pers bleiben:v drinnen:adv.ort, weil:konj.unter es:pron.pers2 regnet:v.",
  "Der:art.b Lehrer:n erklärt:v die:art.b Aufgabe:n genau:adj.adv.",
  "Morgen:adv.zeit3 fahren:v wir:pron.pers mit:praep dem:art.b Zug:n nach:praep Wien:n.",
  "Die:art.b Katze:n versteckt:v sich:pron.refl unter:praep dem:art.b Sofa:n.",
  "Kannst:v.modal du:pron.pers mir:pron.pers helfen:v2?",
  "Wer:pron.frage hat:v.hilf mein:pron.poss Heft:n genommen:v2?",
  "Dieses:pron.dem Fahrrad:n gehört:v meiner:pron.poss Schwester:n.",
  "Das:art.b Mädchen:n, das:pron.rel neben:praep mir:pron.pers sitzt:v, heißt:v Anna:n.",
  "Jemand:pron.unbest hat:v.hilf an:praep die:art.b Tür:n geklopft:v2.",
  "Obwohl:konj.unter es:pron.pers2 kalt:adj war:v.kop, gingen:v wir:pron.pers schwimmen:v2.",
  "Beim:x.pa Lesen:n3 vergisst:v Paul:n oft:adv.zeit die:art.b Zeit:n.",
  "Das:art.b Laufen:n3 macht:v mir:pron.pers großen:adj Spaß:n.",
  "Sie:pron.pers singt:v laut:adj.adv, aber:konj.neben er:pron.pers flüstert:v.",
  "Der:art.b schnelle:adj Läufer:n gewinnt:v das:art.b Rennen:n2.",
  "Hier:adv.ort wohnt:v meine:pron.poss Tante:n.",
  "Deshalb:adv.grund bleibt:v er:pron.pers heute:adv.zeit daheim:adv.ort.",
  "Die:art.b müden:adj Wanderer:n rasten:v unter:praep einem:art.u Baum:n.",
  "Ich:pron.pers habe:v.hilf gestern:adv.zeit einen:art.u Brief:n geschrieben:v2.",
  "Der:art.b Ball:n liegt:v hinter:praep dem:art.b Zaun:n.",
  "Wenn:konj.unter du:pron.pers Zeit:n hast:v, besuchen:v wir:pron.pers den:art.b Zoo:n.",
  "Paul:n und:konj.neben Mia:n bauen:v eine:art.u hohe:adj Sandburg:n.",
  "Die:art.b Tomaten:n sind:v.kop reif:adj.",
  "Das:art.b Baby:n lacht:v fröhlich:adj.adv.",
  "Wir:pron.pers müssen:v.modal leise:adj sein:v.kop.",
  "Der:art.b Junge:n, der:pron.rel dort:adv.ort steht:v, ist:v.kop mein:pron.poss Cousin:n.",
  "Niemand:pron.unbest weiß:v, ob:konj.unter der:art.b Zug:n pünktlich:adj.adv kommt:v.",
  "Sein:pron.poss Hund:n bellt:v laut:adj.adv.",
  "Im:x.pa Winter:n ist:v.kop es:pron.pers2 draußen:adv.ort kalt:adj.",
  "Manchmal:adv.zeit regnet:v es:pron.pers2 den:art.b ganzen:adj Tag:n.",
  "Was:pron.frage möchtest:v.modal du:pron.pers essen:v2?",
  "Jeder:pron.unbest bekommt:v ein:art.u Eis:n.",
  "Wegen:praep des:art.b Regens:n bleiben:v wir:pron.pers drinnen:adv.ort.",
  "Die:art.b Freundin:n hilft:v ihrer:pron.poss Mutter:n beim:x.pa Kochen:n3.",
  "Der:art.b Igel:n frisst:v einen:art.u dicken:adj Wurm:n.",
  "Ein:art.u kleines:adj Mädchen:n pflückt:v bunte:adj Blumen:n.",
  "Die:art.b Feuerwehr:n kommt:v sofort:adv.zeit.",
  "Der:art.b Kuchen:n schmeckt:v lecker:adj.adv.",
  "Die:art.b Lehrerin:n liest:v den:art.b Kindern:n eine:art.u lustige:adj Geschichte:n vor:x.vz.",
  "Im:x.pa Herbst:n fallen:v die:art.b bunten:adj Blätter:n von:praep den:art.b Bäumen:n.",
  "Mein:pron.poss Opa:n erzählt:v spannende:adj Geschichten:n.",
  "Leider:adv hat:v.hilf es:pron.pers2 gestern:adv.zeit geregnet:v2.",
  "Der:art.b Hase:n springt:v hoch:adj.adv über:praep den:art.b Graben:n.",
  "Die:art.b Kinder:n freuen:v sich:pron.refl auf:praep die:art.b Ferien:n.",
  "Weil:konj.unter er:pron.pers krank:adj ist:v.kop, bleibt:v Max:n im:x.pa Bett:n.",
  "Unsere:pron.poss Klasse:n fährt:v bald:adv.zeit auf:praep Schullandwoche:n.",
  "Dort:adv.ort steht:v ein:art.u riesiger:adj Kran:n.",
  "Anna:n schreibt:v sorgfältig:adj.adv, denn:konj.neben sie:pron.pers will:v.modal alles:pron.unbest richtig:adj.adv machen:v2.",
  "Der:art.b Fuchs:n schleicht:v leise:adj.adv durch:praep den:art.b dunklen:adj Wald:n.",
  "Die:art.b Kinder:n singen:v ein:art.u fröhliches:adj Lied:n.",
  "Papa:n repariert:v das:art.b kaputte:adj Fahrrad:n.",
];

export type Tok = { w: string; wa: Wortart | null; sub: string | null; level: number; confuses: Wortart[]; punct: string };
export type Sentence = { text: string; toks: Tok[] };

function parse(src: string): Sentence {
  const toks = src.split(/\s+/).map((part) => {
    const m = part.match(/^(.+?):([a-z.]+?)(\d)?([.,!?]*)$/);
    if (!m) throw new Error(`Wortarten-Satzbank: „${part}“ hat kein Etikett`);
    const tag = TAGS[m[2]];
    if (!tag) throw new Error(`Wortarten-Satzbank: Etikett „${m[2]}“ unbekannt`);
    return { w: m[1], wa: tag.wa, sub: tag.sub, level: m[3] ? Number(m[3]) : tag.level, confuses: tag.confuses ?? [], punct: m[4] };
  });
  return { text: toks.map((t) => t.w + t.punct).join(" "), toks };
}
export const BANK: Sentence[] = BANK_SRC.map(parse);

/** Single words whose Wortart is clear without a sentence (for sorting). „das“ is left out: Artikel or Pronomen. */
const WORDS: Record<Wortart, string[]> = {
  nomen: ["Baum", "Schule", "Fahrrad", "Freundin", "Apfel", "Fenster", "Garten", "Lehrer", "Blume", "Ball", "Stadt", "Wolke"],
  verb: ["laufen", "schreiben", "singen", "lachen", "essen", "spielen", "bauen", "fahren", "malen", "schlafen", "springen", "rufen"],
  adjektiv: ["groß", "klein", "laut", "leise", "bunt", "schnell", "müde", "warm", "süß", "freundlich", "lustig", "dunkel"],
  artikel: ["ein", "eine", "einen", "einem"],
  pronomen: ["ich", "du", "wir", "ihr", "mich", "uns", "dich", "euch"],
  praeposition: ["auf", "unter", "neben", "hinter", "mit", "ohne", "für", "zwischen", "wegen"],
  konjunktion: ["und", "oder", "aber", "weil", "dass", "obwohl", "wenn"],
  adverb: ["heute", "gestern", "hier", "dort", "oft", "gern", "bald", "immer", "draußen", "manchmal", "deshalb", "nie"],
};

/** Adjectives often called „Adverb“ when they say how something happens; their comparatives too. */
const ADJEKTIVE = new Set(
  "schnell langsam laut leise gut schön schlecht hell dunkel fröhlich traurig genau richtig falsch ruhig deutlich pünktlich freundlich vorsichtig sorgfältig leicht schwer lang kurz warm kalt heiß glücklich fleißig gründlich sauber ordentlich klug mutig höflich wild still kräftig weit nah hoch tief klar eifrig geduldig heftig plötzlich selten regelmäßig lecker müde fest stark schwach sicher wütend aufmerksam ängstlich neugierig lustig sanft hart weich bunt groß klein".split(" "),
);
/** Words that are Adverbien (some also something else: „morgen“ / „der Morgen“). */
const ADVERBIEN = new Set(
  "heute gestern morgen hier dort da oft gern gerne bald immer nie niemals draußen drinnen manchmal deshalb daher darum sehr auch schon noch jetzt sofort oben unten links rechts vielleicht leider bereits damals abends morgens nachts überall irgendwo hinten vorne montags trotzdem kaum fast ziemlich daheim gleich zuerst dann danach sonst überhaupt".split(" "),
);

/** What the app knows a word can be, from the bank and the word lists. */
const LEXICON: Map<string, Set<Wortart>> = (() => {
  const m = new Map<string, Set<Wortart>>();
  const add = (w: string, wa: Wortart) => m.set(w.toLowerCase(), new Set([...(m.get(w.toLowerCase()) ?? []), wa]));
  for (const s of BANK) for (const t of s.toks) if (t.wa) add(t.w, t.wa);
  for (const wa of WORTARTEN) for (const w of WORDS[wa]) add(w, wa);
  for (const w of ADJEKTIVE) add(w, "adjektiv");
  for (const w of ADVERBIEN) add(w, "adverb");
  return m;
})();
/** „schneller“ → schnell: comparatives used like an adverb are still Adjektive. */
function lexicon(word: string): Set<Wortart> | null {
  const w = word.toLowerCase();
  if (LEXICON.has(w)) return LEXICON.get(w)!;
  const base = w.replace(/(er|sten|ste|st)$/, "");
  return ADJEKTIVE.has(base) && !ADVERBIEN.has(w) ? new Set<Wortart>(["adjektiv"]) : null;
}

// ---------- generating tasks ----------
const LEVELS = { maxLevel: [1, 1, 2, 3, 3], ask: [2, 3, 4, 5, 6], maxWords: [6, 8, 10, 13, 99], minWords: [0, 0, 5, 6, 7] };
const lvOf = (d: Difficulty) => Math.max(0, Math.min(4, levelOf(d) - 1));
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const words = (s: Sentence) => s.toks.length;
const quote = (s: Sentence) => `„${s.text}“`;
const answerNames = (w: Wortart) => WORTART_NAMES[w];

/** Why a word is what it is, where it is easy to get wrong. */
function reason(t: Tok, s: Sentence): string | null {
  if (t.wa === "adjektiv" && t.sub === "adverbial")
    return `„${t.w}“ ist ein Adjektiv. Hier sagt es, wie etwas geschieht (adverbial gebraucht), es bleibt aber ein Adjektiv: Man kann es steigern und vor ein Nomen stellen.`;
  if (t.wa === "nomen" && t.level >= 3) return `„${t.w}“ ist hier ein Nomen: Davor steht ein Artikel oder „beim/zum“ (das ${t.w}, beim ${t.w}), darum schreibt man es groß.`;
  if (t.wa === "pronomen" && t.sub === "relativ") {
    const i = s.toks.indexOf(t);
    const noun = [...s.toks.slice(0, i)].reverse().find((x) => x.wa === "nomen");
    return `„${t.w}“ ist hier ein Relativpronomen: Es leitet einen Nebensatz ein${noun ? ` und bezieht sich auf „${noun.w}“` : ""}. Man kann „welcher/welche/welches“ einsetzen.`;
  }
  if (t.wa === "artikel" && s.toks.some((x) => x.sub === "relativ" && x.w.toLowerCase() === t.w.toLowerCase())) return `„${t.w}“ ist hier ein Artikel: Es begleitet das Nomen danach.`;
  if (t.wa === "verb" && t.sub === "hilf") return `„${t.w}“ ist ein Verb (Hilfsverb): Es bildet mit einem zweiten Verb die Zeitform.`;
  if (t.wa === "verb" && t.sub === "modal") return `„${t.w}“ ist ein Verb (Modalverb wie können, müssen, wollen).`;
  if (t.wa === "verb" && t.level >= 2 && t.sub === null) return `„${t.w}“ ist ein Verb (eine Form von „sein“).`;
  if (t.wa === "adverb" && t.level >= 3) return `„${t.w}“ ist hier ein Adverb (wann?). Es steht nur am Satzanfang groß.`;
  return null;
}

/** known: what the student has learnt by now (Grundeinstellung of the Schulstufe and the chosen ones); relaxed: last try, any sentence length rule but the hardest word. */
type Ctx = { setting: WortartSetting; lv: number; focus: Wortart; rng: Rng; known: Set<Wortart>; relaxed?: boolean };
type Made = Omit<TaskDraft, "skillId" | "difficulty"> & { asked: Wortart[] };

/** Words of a sentence the task may ask about: allowed, not too hard, each word only once in the sentence. */
function askable(s: Sentence, c: Ctx): Tok[] {
  const count = (w: string) => s.toks.filter((t) => t.w.toLowerCase() === w.toLowerCase()).length;
  return s.toks.filter((t) => t.wa && c.setting.allowed.includes(t.wa) && t.level <= LEVELS.maxLevel[c.lv] && count(t.w) === 1);
}
/**
 * Does the sentence fit the difficulty? Length, the hardest word in it (a relative clause is not for
 * „leicht“, even when its words are not asked) and, at the easy levels, few words of Wortarten the
 * student has not learnt yet (Artikel count as known: they show the Nomen).
 */
function fitsLength(s: Sentence, c: Ctx) {
  const hardest = Math.max(...s.toks.filter((t) => t.wa).map((t) => t.level));
  const unknown = s.toks.filter((t) => t.wa && t.wa !== "artikel" && !c.known.has(t.wa)).length;
  if (c.relaxed) return hardest <= LEVELS.maxLevel[c.lv] && words(s) <= LEVELS.maxWords[Math.min(4, c.lv + 1)];
  return words(s) <= LEVELS.maxWords[c.lv] && words(s) >= LEVELS.minWords[c.lv] && hardest <= LEVELS.maxLevel[c.lv] && unknown <= [0, 1, 2, 9, 9][c.lv];
}
/** Names: Nomen, but no example for „Einzahl und Mehrzahl“. */
const NAMES = new Set(["Mama", "Papa", "Oma", "Opa", "Lisa", "Tom", "Paul", "Mia", "Anna", "Max", "Wien"]);
/**
 * May a student look for all words of `target` in this sentence? Every such word must be easy enough,
 * and no word may be of a Wortart the student does not know yet that looks like the target.
 */
function findable(s: Sentence, target: Wortart, c: Ctx): Tok[] | null {
  const hits = s.toks.filter((t) => t.wa === target);
  if (!hits.length || hits.some((t) => t.level > LEVELS.maxLevel[c.lv])) return null;
  for (const t of s.toks) {
    if (t.confuses.includes(target)) return null;
    if (t.wa && t.wa !== target && CONFUSE[target].includes(t.wa) && (!c.setting.allowed.includes(t.wa) || t.level > LEVELS.maxLevel[c.lv])) return null;
    // the trap „schnell“ (Adjektiv) among Adverbien is for advanced students only
    if (target === "adverb" && t.wa === "adjektiv" && t.sub === "adverbial" && c.lv < 3) return null;
  }
  const seen = new Set<string>();
  for (const t of hits) {
    if (seen.has(t.w.toLowerCase())) return null;
    seen.add(t.w.toLowerCase());
  }
  return hits;
}
/** Sentences that fit, harder words first when the difficulty asks for them. */
function candidates(c: Ctx, ok: (s: Sentence) => boolean): Sentence[] {
  const fit = shuffle(c.rng, BANK.filter((s) => ok(s)));
  const hard = (s: Sentence) => askable(s, c).some((t) => t.level >= 2);
  return c.lv >= 2 ? [...fit.filter(hard), ...fit.filter((s) => !hard(s))] : fit;
}
function hintsFor(ws: Wortart[]): string[] {
  const uniq = WORTARTEN.filter((w) => ws.includes(w));
  return [uniq.slice(0, 2).map((w) => PROBE[w]).join(" "), uniq.slice(2).map((w) => PROBE[w]).join(" ")].filter(Boolean).concat(["Bestimme ein Wort nach dem anderen und lies den ganzen Satz mit."]).slice(0, 3);
}
/** „Wort = Wortart“ per line, then why for the tricky words (only words of the chosen Wortarten: the explanation names their Wortart). */
const solutionLines = (toks: Tok[], s: Sentence, label: (t: Tok) => string, allowed: Wortart[]) =>
  [...toks.map((t) => `${t.w} = ${label(t)}`), ...toks.filter((t) => t.wa && allowed.includes(t.wa)).map((t) => reason(t, s)).filter((x): x is string => Boolean(x))].join("\n");

/** „Bestimme die Wortarten“: each asked word gets a gap for its Wortart. */
function zuordnen(c: Ctx): Made | null {
  // with one Wortart every gap would have the same answer: „finden“ asks that better
  if (c.setting.allowed.length < 2) return null;
  const n = LEVELS.ask[c.lv];
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const pool = askable(s, c);
    if (!pool.some((t) => t.wa === c.focus)) continue;
    if (c.setting.allowed.length > 1 && new Set(pool.map((t) => t.wa)).size < 2) continue;
    // the focus first, then the harder words, then the rest; shown in the order of the sentence
    const first = pool.filter((t) => t.wa === c.focus).slice(0, 2);
    const rest = shuffle(c.rng, pool.filter((t) => !first.includes(t))).sort((a, b) => (c.lv >= 2 ? b.level - a.level : 0));
    const keep = new Set([...first, ...rest].slice(0, n));
    const chosen = pool.filter((t) => keep.has(t));
    if (chosen.length < 2) continue;
    if (c.setting.allowed.length > 1 && new Set(chosen.map((t) => t.wa)).size < 2) continue;
    const list = c.lv <= 2 ? `\nWortarten: ${c.setting.allowed.map((w) => WORTART_LABEL[w]).join(", ")}` : "";
    return {
      type: "cloze",
      category: "wortarten",
      prompt: `Bestimme die Wortarten.\n${quote(s)}${list}\n${chosen.map((t) => `${t.w}: ${GAP}`).join("\n")}`,
      data: {},
      answer: { blanks: chosen.map((t) => answerNames(t.wa!)), mode: "text", criteria: ["Jedes Wort hat die richtige Wortart."] },
      solution: solutionLines(chosen, s, (t) => WORTART_LABEL[t.wa!], c.setting.allowed),
      hints: hintsFor(chosen.map((t) => t.wa!)),
      errorMap: [],
      asked: chosen.map((t) => t.wa!),
    };
  }
  return null;
}

/** One word in [brackets]: which Wortart is it? Only allowed Wortarten are offered. */
function markiert(c: Ctx): Made | null {
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const pool = askable(s, c);
    const single = c.setting.allowed.length === 1;
    // with one Wortart only: „Verb“ or „kein Verb“, so sometimes a word of another Wortart is marked
    const asks = single ? s.toks.filter((t) => t.wa && t.level <= LEVELS.maxLevel[c.lv] && (t.wa === c.focus || !CONFUSE[c.focus].includes(t.wa))) : pool.filter((t) => t.wa === c.focus);
    if (!asks.length) continue;
    const t = c.lv >= 2 ? [...asks].sort((a, b) => b.level - a.level)[0] : pick(c.rng, asks);
    const right = single ? (t.wa === c.focus ? WORTART_LABEL[c.focus] : keinLabel(c.focus)) : WORTART_LABEL[t.wa!];
    const others = single
      ? [t.wa === c.focus ? keinLabel(c.focus) : WORTART_LABEL[c.focus]]
      : [...CONFUSE[t.wa!].filter((w) => c.setting.allowed.includes(w)), ...shuffle(c.rng, c.setting.allowed.filter((w) => w !== t.wa && !CONFUSE[t.wa!].includes(w)))].slice(0, 3).map((w) => WORTART_LABEL[w]);
    if (!others.length) continue;
    const options = shuffle(c.rng, [right, ...others]);
    const marked = s.toks.map((x) => (x === t ? `[${x.w}]` : x.w) + x.punct).join(" ");
    return {
      type: "mc",
      category: "wortarten",
      prompt: `Welche Wortart hat das Wort in eckigen Klammern?\n„${marked}“`,
      data: { options },
      answer: { correct: options.indexOf(right) },
      solution: [`${t.w} = ${right}`, single && t.wa !== c.focus ? null : reason(t, s)].filter(Boolean).join("\n"),
      hints: hintsFor(single ? [c.focus] : [t.wa!, ...CONFUSE[t.wa!].filter((w) => c.setting.allowed.includes(w))]),
      errorMap: single ? [] : options.flatMap((o, i) => (o === right ? [] : [{ answer: String(i), label: `${right} und ${o} verwechselt` }])),
      asked: [single ? c.focus : t.wa!],
    };
  }
  return null;
}

/** Unterart of a word in [brackets] (Pronomenarten, Artikel, Verbarten …): advanced students only. */
function unterart(c: Ctx): Made | null {
  if (!c.setting.unterarten || c.lv < 3) return null;
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const pool = askable(s, c).filter((t) => t.sub && UNTERARTEN[`${t.wa}.${t.sub}`]);
    const withFocus = pool.filter((t) => t.wa === c.focus);
    const t = withFocus.length ? pick(c.rng, withFocus) : pool.find((x) => x.wa === "pronomen");
    if (!t) continue;
    const key = `${t.wa}.${t.sub}`;
    const right = UNTERARTEN[key].label;
    const others = shuffle(
      c.rng,
      Object.entries(UNTERARTEN)
        .filter(([k, v]) => v.of === t.wa && k !== key)
        .map(([, v]) => v.label),
    ).slice(0, 3);
    if (!others.length) continue;
    const options = shuffle(c.rng, [right, ...others]);
    const marked = s.toks.map((x) => (x === t ? `[${x.w}]` : x.w) + x.punct).join(" ");
    return {
      type: "mc",
      category: "wortarten",
      prompt: `Das Wort in eckigen Klammern ist ein ${WORTART_LABEL[t.wa!]}. Bestimme es genauer.\n„${marked}“`,
      data: { options },
      answer: { correct: options.indexOf(right) },
      solution: [`${t.w} = ${right}`, reason(t, s)].filter(Boolean).join("\n"),
      hints: [PROBE[t.wa!], "Frag: Wofür steht das Wort, worauf weist es hin, wem gehört etwas?"],
      errorMap: [],
      asked: [t.wa!],
    };
  }
  return null;
}

/** All words of one Wortart from a sentence, in the order they stand. */
function finden(c: Ctx): Made | null {
  const fits = candidates(c, (x) => fitsLength(x, c) || (c.lv >= 2 && words(x) <= LEVELS.maxWords[c.lv]));
  const two = (x: Sentence) => (findable(x, c.focus, c)?.length ?? 0) >= 2;
  for (const s of [...fits.filter(two), ...fits.filter((x) => !two(x))]) {
    const hits = findable(s, c.focus, c);
    if (!hits || hits.length > 5) continue;
    const many = hits.length > 1;
    const name = many ? WORTART_PLURAL[c.focus] : WORTART_LABEL[c.focus];
    return {
      type: "cloze",
      category: "wortarten",
      prompt: `Schreib ${many ? `alle ${name}` : `${c.focus === "artikel" ? "den" : c.focus === "praeposition" || c.focus === "konjunktion" ? "die" : "das"} ${WORTART_LABEL[c.focus]}`} aus dem Satz heraus${many ? ", in der Reihenfolge, in der sie im Satz stehen" : ""}.\n${quote(s)}\n${name}: ${hits.map(() => GAP).join(", ")}`,
      data: {},
      answer: { blanks: hits.map((t) => [t.w]), mode: "text", criteria: [many ? `Alle ${name} des Satzes, kein anderes Wort.` : `Das richtige Wort, kein anderes.`] },
      solution: [`${name}: ${hits.map((t) => t.w).join(", ")}`, ...hits.map((t) => reason(t, s)).filter(Boolean)].join("\n"),
      hints: hintsFor([c.focus]),
      errorMap: [],
      asked: [c.focus],
    };
  }
  return null;
}

/** A list of single words, sorted into the Wortarten. */
function sortieren(c: Ctx): Made | null {
  if (c.setting.allowed.length < 2) return null;
  const n = c.lv >= 3 ? 4 : c.lv >= 2 ? 3 : 2;
  const cats = [c.focus, ...shuffle(c.rng, c.setting.allowed.filter((w) => w !== c.focus))].slice(0, n);
  const per = c.lv === 0 ? 2 : c.lv >= 3 ? 3 : 2 + (c.lv >= 2 ? 1 : 0);
  // „der/die“ are Artikel or Pronomen: with Pronomen in the list only „ein, eine …“
  const groups = cats.map((w) => ({ w, list: shuffle(c.rng, WORDS[w]).slice(0, Math.min(per, WORDS[w].length)) }));
  const all = shuffle(c.rng, groups.flatMap((g) => g.list));
  const ordered = groups.map((g) => ({ ...g, list: all.filter((x) => g.list.includes(x)) }));
  return {
    type: "cloze",
    category: "wortarten",
    prompt: `Sortiere die Wörter nach Wortarten. Schreib sie in der Reihenfolge, in der sie in der Liste stehen.\n${all.join(" – ")}\n${ordered.map((g) => `${WORTART_PLURAL[g.w]}: ${g.list.map(() => GAP).join(", ")}`).join("\n")}`,
    data: {},
    answer: { blanks: ordered.flatMap((g) => g.list.map((x) => [x])), mode: "text", criteria: ["Jedes Wort steht bei seiner Wortart."] },
    solution: ordered.map((g) => `${WORTART_PLURAL[g.w]}: ${g.list.join(", ")}`).join("\n"),
    hints: hintsFor(cats),
    errorMap: [],
    asked: cats,
  };
}

/** Someone determined the Wortarten; one or two are wrong. The student writes the list correctly. */
function korrektur(c: Ctx): Made | null {
  const single = c.setting.allowed.length === 1;
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const pool = single ? s.toks.filter((t) => t.wa && t.level <= LEVELS.maxLevel[c.lv] && (t.wa === c.focus || !CONFUSE[c.focus].includes(t.wa))) : askable(s, c);
    const n = Math.min(LEVELS.ask[c.lv] + 1, pool.length);
    if (n < 3 || !pool.some((t) => t.wa === c.focus)) continue;
    const lead = pool.filter((x) => x.wa === c.focus).slice(0, 1);
    const chosen = pool.filter((t) => [...lead, ...shuffle(c.rng, pool.filter((x) => !lead.includes(x)))].slice(0, n).includes(t));
    if (!single && new Set(chosen.map((t) => t.wa)).size < 2) continue;
    const label = (t: Tok) => (single ? (t.wa === c.focus ? WORTART_LABEL[c.focus] : keinLabel(c.focus)) : WORTART_LABEL[t.wa!]);
    const wrongCount = c.lv <= 1 ? 1 : 2;
    const wrongAt = new Set(shuffle(c.rng, chosen.map((_, i) => i)).slice(0, wrongCount));
    const wrongLabel = (t: Tok) => {
      if (single) return t.wa === c.focus ? keinLabel(c.focus) : WORTART_LABEL[c.focus];
      const near = CONFUSE[t.wa!].filter((w) => c.setting.allowed.includes(w));
      return WORTART_LABEL[near.length ? pick(c.rng, near) : pick(c.rng, c.setting.allowed.filter((w) => w !== t.wa))];
    };
    const faultyLines = chosen.map((t, i) => `${t.w} = ${wrongAt.has(i) ? wrongLabel(t) : label(t)}`);
    const rightLines = chosen.map((t) => `${t.w} = ${label(t)}`);
    const fixes = chosen
      .map((t, i) => (wrongAt.has(i) ? { wrong: faultyLines[i].split(" = ")[1], right: label(t), label: `„${t.w}“ ist ${single && t.wa !== c.focus ? keinLabel(c.focus) : `ein${t.wa === "konjunktion" || t.wa === "praeposition" ? "e" : ""} ${WORTART_LABEL[t.wa!]}`}`, errorType: "grammatik" } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const name = pick(c.rng, ["Jonas", "Lena", "Emma", "Paul", "Mia", "Elias"]);
    return {
      type: "fix",
      category: "korrigieren",
      prompt: `${name} hat die Wortarten bestimmt. ${wrongCount === 1 ? "Eine Angabe ist falsch" : `${wrongCount} Angaben sind falsch`}. Verbessere sie.\n${quote(s)}`,
      data: { faulty: faultyLines.join("\n") },
      answer: { accepted: [rightLines.join("\n")], mode: "text", fixes, criteria: [wrongCount === 1 ? "Die falsche Angabe ist verbessert." : "Beide falschen Angaben sind verbessert.", "Richtige Angaben sind unverändert."] },
      solution: solutionLines(chosen, s, label, c.setting.allowed),
      hints: hintsFor(single ? [c.focus] : chosen.map((t) => t.wa!)),
      errorMap: [],
      asked: single ? [c.focus] : chosen.map((t) => t.wa!),
    };
  }
  return null;
}

/** „Fehler finden“: which of the stated Wortarten is wrong? (multiple choice) */
function fehlerfinden(c: Ctx): Made | null {
  if (c.setting.allowed.length < 2) return null;
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const pool = askable(s, c);
    if (pool.length < 3 || !pool.some((t) => t.wa === c.focus)) continue;
    const lead = pool.filter((x) => x.wa === c.focus).slice(0, 1);
    const chosen = pool.filter((t) => [...lead, ...shuffle(c.rng, pool.filter((x) => !lead.includes(x)))].slice(0, 4).includes(t));
    if (chosen.length < 3 || new Set(chosen.map((t) => t.wa)).size < 2) continue;
    const bad = chosen.find((t) => t.wa === c.focus)!;
    const near = CONFUSE[bad.wa!].filter((w) => c.setting.allowed.includes(w));
    const wrong = near.length ? pick(c.rng, near) : pick(c.rng, c.setting.allowed.filter((w) => w !== bad.wa));
    const options = chosen.map((t) => `${t.w} = ${WORTART_LABEL[t === bad ? wrong : t.wa!]}`);
    const name = pick(c.rng, ["Jonas", "Lena", "Emma", "Paul", "Mia", "Elias"]);
    return {
      type: "mc",
      category: "fehler",
      prompt: `${name} hat die Wortarten bestimmt. Eine Angabe ist falsch. Welche?\n${quote(s)}`,
      data: { options },
      answer: { correct: chosen.indexOf(bad) },
      solution: [`Falsch: ${options[chosen.indexOf(bad)]}. Richtig: ${bad.w} = ${WORTART_LABEL[bad.wa!]}.`, reason(bad, s)].filter(Boolean).join("\n"),
      hints: hintsFor(chosen.map((t) => t.wa!)),
      errorMap: [],
      asked: chosen.map((t) => t.wa!),
    };
  }
  return null;
}

/** Nomen erkennen und großschreiben: a sentence with the nouns written small. */
function grossschreiben(c: Ctx): Made | null {
  for (const s of candidates(c, (x) => fitsLength(x, c))) {
    const nouns = s.toks.filter((t, i) => t.wa === "nomen" && i > 0 && t.level <= LEVELS.maxLevel[c.lv]);
    if (nouns.length < 2 || s.toks.some((t) => t.wa === "nomen" && t.level > LEVELS.maxLevel[c.lv])) continue;
    const faulty = s.toks.map((t) => (nouns.includes(t) ? t.w.toLowerCase() : t.w) + t.punct).join(" ");
    return {
      type: "fix",
      category: "korrigieren",
      prompt: "Im Satz sind die Nomen kleingeschrieben. Schreib den Satz richtig.",
      data: { faulty },
      answer: { accepted: [s.text], mode: "exact", fixes: nouns.map((t) => ({ wrong: t.w.toLowerCase(), right: t.w, label: `„${t.w}“ ist ein Nomen: groß`, errorType: "rechtschreibung" })), criteria: ["Alle Nomen sind großgeschrieben.", "Sonst ist nichts verändert."] },
      solution: `${s.text}\nNomen: ${nouns.map((t) => t.w).join(", ")}`,
      hints: [PROBE.nomen, `Es sind ${nouns.length} Nomen.`],
      errorMap: [],
      asked: ["nomen"],
    };
  }
  return null;
}

/** Only when the teacher chose Freie Antwort: explain with the Proben, always with a concrete sample. */
function erklaeren(c: Ctx, variant: number): Made | null {
  const own = c.setting.allowed.length >= 2 && variant % 2 === 1;
  if (own) {
    const wanted = [c.focus, ...c.setting.allowed.filter((w) => w !== c.focus)].slice(0, 3);
    const has = (x: Sentence, w: Wortart) => x.toks.some((t) => t.wa === w && t.level <= 2);
    const s = [...BANK].sort((a, b) => words(a) - words(b)).find((x) => wanted.every((w) => has(x, w))) ?? [...BANK].sort((a, b) => words(a) - words(b)).find((x) => has(x, c.focus))!;
    const ws = wanted.filter((w) => has(s, w));
    const ex = ws.map((w) => s.toks.find((t) => t.wa === w && t.level <= 2)!);
    return {
      type: "free",
      category: "offen",
      prompt: `Schreib einen eigenen Satz mit ${ws.map((w) => `${w === "konjunktion" || w === "praeposition" ? "einer" : "einem"} ${WORTART_LABEL[w]}`).join(", ").replace(/, ([^,]*)$/, " und $1")}. Schreib darunter, welches Wort welche Wortart ist.`,
      data: { lines: 4 },
      answer: { sample: `${s.text}\n${ex.map((t) => `${t.w} = ${WORTART_LABEL[t.wa!]}`).join(", ")}`, criteria: ["Der Satz ist vollständig und richtig geschrieben.", `Je ein Wort der Wortarten ${ws.map((w) => WORTART_LABEL[w]).join(", ")} ist dabei.`, "Die Wörter sind richtig zugeordnet."] },
      solution: `Beispiel: ${s.text}\n${ex.map((t) => `${t.w} = ${WORTART_LABEL[t.wa!]}`).join(", ")}`,
      hints: hintsFor(ws),
      errorMap: [],
      asked: ws,
    };
  }
  // the adverbial adjective, for students who know Adverbien
  if (c.setting.allowed.includes("adjektiv") && c.setting.allowed.includes("adverb") && c.lv >= 3 && c.focus !== "nomen") {
    const s = BANK.find((x) => x.toks.some((t) => t.sub === "adverbial") && x.toks.some((t) => t.wa === "adverb")) ?? BANK.find((x) => x.toks.some((t) => t.sub === "adverbial"))!;
    const adj = s.toks.find((t) => t.sub === "adverbial")!;
    return {
      type: "free",
      category: "offen",
      prompt: `${quote(s)}\nIst „${adj.w}“ in diesem Satz ein Adjektiv oder ein Adverb? Begründe mit einer Probe.`,
      data: { lines: 4 },
      answer: {
        sample: `„${adj.w}“ ist ein Adjektiv. Es sagt hier zwar, wie etwas geschieht (adverbial gebraucht), aber man kann es steigern (${adj.w}, ${adj.w}er) und vor ein Nomen stellen (der ${adj.w}e …). Ein Adverb wie „heute“ oder „gern“ kann man nicht vor ein Nomen stellen.`,
        criteria: ["Nennt „Adjektiv“.", "Begründet mit einer Probe: steigern oder vor ein Nomen stellen.", "Unterscheidet Wortart (Adjektiv) und Gebrauch (adverbial)."],
      },
      solution: reason(adj, s)!,
      hints: [PROBE.adjektiv, PROBE.adverb],
      errorMap: [],
      asked: ["adjektiv", "adverb"],
    };
  }
  const s = candidates(c, (x) => fitsLength(x, c) && askable(x, c).some((t) => t.wa === c.focus && t.level === 1 && !NAMES.has(t.w)))[0] ?? BANK.find((x) => x.toks.some((t) => t.wa === c.focus && !NAMES.has(t.w)))!;
  const t = s.toks.find((x) => x.wa === c.focus && x.level <= 2 && !NAMES.has(x.w)) ?? s.toks.find((x) => x.wa === c.focus)!;
  const SAMPLE: Record<Wortart, (w: string) => string> = {
    nomen: (w) => `„${w}“ ist ein Nomen: Man kann einen Artikel davorsetzen, man schreibt es groß, und es gibt Einzahl und Mehrzahl.`,
    verb: (w) => `„${w}“ ist ein Verb: Es sagt, was jemand tut, und verändert sich mit der Person (ich …, du …, er …) und mit der Zeit (heute, gestern).`,
    adjektiv: (w) => `„${w}“ ist ein Adjektiv: Es sagt, wie etwas ist, und man kann es steigern. Man kann es zwischen Artikel und Nomen stellen.`,
    artikel: (w) => `„${w}“ ist ein Artikel: Es begleitet das Nomen danach und zeigt sein Geschlecht (der, die, das) oder steht als „ein/eine“ davor.`,
    pronomen: (w) => `„${w}“ ist ein Pronomen: Es steht für ein Nomen oder begleitet es. Man kann es durch ein Nomen ersetzen oder es zeigt, wem etwas gehört.`,
    praeposition: (w) => `„${w}“ ist eine Präposition: Es steht vor einem Nomen (z. B. hinter dem Zaun) und zeigt ein Verhältnis, zum Beispiel einen Ort. Es verändert sich nicht.`,
    konjunktion: (w) => `„${w}“ ist eine Konjunktion: Es verbindet zwei Wörter oder Sätze und verändert sich nicht.`,
    adverb: (w) => `„${w}“ ist ein Adverb: Es sagt, wann, wo, wie oder warum etwas geschieht. Es verändert sich nicht und kann nicht zwischen Artikel und Nomen stehen.`,
  };
  return {
    type: "free",
    category: "offen",
    prompt: `${quote(s)}\nWoran erkennst du, dass „${t.w}“ ${t.wa === "konjunktion" || t.wa === "praeposition" ? "eine" : "ein"} ${WORTART_LABEL[t.wa!]} ist? Nenne zwei Merkmale.`,
    data: { lines: 3 },
    answer: { sample: SAMPLE[t.wa!](t.w), criteria: ["Nennt zwei passende Merkmale oder Proben.", "Bezieht sich auf das Wort im Satz."] },
    solution: `${PROBE[t.wa!]}${reason(t, s) ? `\n${reason(t, s)}` : ""}`,
    hints: [PROBE[t.wa!]],
    errorMap: [],
    asked: [t.wa!],
  };
}

type Kind = "zuordnen" | "markiert" | "finden" | "sortieren" | "unterart" | "korrektur" | "fehler" | "gross" | "erklaeren";
const CLOZE_KINDS: Kind[] = ["zuordnen", "finden", "sortieren"];

/**
 * A Wortarten task for one slot of the builder, without AI. Every task asks for real words; only
 * „Freie Antwort“ (offen, schreiben) gives an explanation task, and that one has a concrete sample.
 */
export function wortartenTask(o: { skillId: string; setting: WortartSetting; difficulty: Difficulty; category: string | null; variant: number }, rng: Rng = Math.random): TaskDraft {
  const { setting } = o;
  const lv = lvOf(o.difficulty);
  const own = wortartOfSkill(o.skillId);
  const focus = own && setting.allowed.includes(own) ? own : setting.allowed[o.variant % setting.allowed.length];
  const c: Ctx = { setting, lv, focus, rng, known: new Set([...defaultWortarten(setting.grade).allowed, ...setting.allowed]) };
  const cat = o.category ?? "wortarten";
  // the kinds of the task type in turn; when one does not fit, the others of the same answer format
  // (the builder's task types take turns with the same counter: every second slot is „Wortarten“, so the
  // counter is spread to reach every kind)
  const turn = o.variant + Math.floor(o.variant / 2);
  const rotate = (list: Kind[]) => [list[turn % list.length], ...list.filter((k, i) => i !== turn % list.length)];
  let kinds: Kind[];
  if (setting.nomenOnly) kinds = cat === "korrigieren" || cat === "rechtschreibung" ? ["gross"] : rotate(["finden", "gross"]);
  else if (cat === "offen" || cat === "schreiben") kinds = ["erklaeren"];
  else if (cat === "korrigieren" || cat === "satz") kinds = ["korrektur"];
  else if (cat === "fehler") kinds = ["fehler", "markiert"];
  else if (cat === "lueckentext" || cat === "gap") kinds = rotate(CLOZE_KINDS);
  else if (cat === "mc") kinds = rotate(setting.unterarten && lv >= 3 ? ["markiert", "unterart"] : ["markiert"]);
  else kinds = rotate(["zuordnen", "markiert", "finden", "sortieren", ...(setting.unterarten && lv >= 3 ? (["unterart"] as Kind[]) : [])]);
  const make = (k: Kind, x: Ctx): Made | null => ({ zuordnen, markiert, finden, sortieren, unterart, korrektur, fehler: fehlerfinden, gross: grossschreiben, erklaeren: (y: Ctx) => erklaeren(y, o.variant) })[k](x);
  let made: Made | null = null;
  for (const k of kinds) if ((made = make(k, c))) break;
  // a narrow choice (e.g. only Konjunktionen in a low class): sentences may also hold words of Wortarten
  // not learnt yet; they are not asked
  if (!made) for (const k of kinds) if ((made = make(k, { ...c, relaxed: true }))) break;
  // still nothing at a high level: one level easier
  if (!made && lv > 0) return wortartenTask({ ...o, difficulty: (["sehr leicht", "leicht", "mittel", "schwer"] as const)[lv - 1] }, rng);
  // sehr leicht and still nothing (a focus no sentence fits): another allowed Wortart as focus
  for (const relaxed of [false, true])
    for (const f of setting.allowed) {
      const x = { ...c, focus: f, relaxed };
      if (!made) made = (setting.nomenOnly ? (finden(x) ?? grossschreiben(x)) : null) ?? zuordnen(x) ?? finden(x) ?? korrektur(x);
    }
  if (!made) throw new Error(`Keine Wortarten-Aufgabe für ${setting.allowed.join(", ")}`);
  const { asked, ...task } = made;
  task.category = o.category ?? task.category;
  const subs = setting.nomenOnly ? [] : [...new Set(asked)].map(wortartSkill);
  const parent = o.skillId === NOMEN_SKILL ? [] : [WORTARTEN_SKILL];
  return { ...task, skillId: o.skillId, skillIds: [...new Set([o.skillId, ...parent, ...subs])], difficulty: o.difficulty, sourceType: "eigen" };
}

// ---------- checking AI tasks (any provider) ----------
const TERMS: [Wortart, RegExp][] = [
  ["nomen", /(?<!pro)nomen\b|namens?wort|hauptwort|substantiv/i],
  ["verb", /(?<!ad)verb(en|s|form|formen)?\b|zeitwort|tunwort|tuwort|tätigkeitswort/i],
  ["adjektiv", /adjektiv|eigenschaftswort|wiewort/i],
  ["artikel", /artikel|begleiter|geschlechtswort/i],
  ["pronomen", /pronomen|fürwort/i],
  ["praeposition", /präposition|verhältniswort|\bvorwort/i],
  ["konjunktion", /konjunktion|bindewort/i],
  ["adverb", /adverb(?!ial)|umstandswort/i],
];
const OTHER_TERMS = /numerale|zahlwort|interjektion|ausrufewort|partikel/i;

/** The Wortarten a text names (also inside „Personalpronomen“, „Hilfsverb“ …). */
export function wortartenIn(text: string): Wortart[] {
  return TERMS.filter(([, re]) => re.test(text)).map(([w]) => w);
}
/** The Wortart an answer names, if the answer is just a Wortart (or an Unterart) name. */
function termOf(answer: string): Wortart | null {
  const a = answer.trim().replace(/^(ein|eine|kein|keine)\s+/i, "");
  if (a.split(/\s+/).length > 4) return null;
  const hits = wortartenIn(a);
  return hits.length === 1 ? hits[0] : null;
}

/** Sample answers that are no answer: „Eine passende Antwort“, „Individuelle Schülerlösung“ … */
export function isPlaceholder(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (/individuelle\s+(schüler)?(lösung|antwort)|antworten\s+(können|werden)\s+variieren|je nach schüler|schülerabhängig/i.test(t)) return true;
  return t.length <= 120 && /^(z\.\s*b\.\s*)?(eine?|die|der|das|individuelle|freie|eigene)\s+((passende|korrekte|richtige|sinnvolle|individuelle|eigene|beliebige|mögliche|vollständige|nachvollziehbare|schlüssige)[rsnm]?\s+)+(antwort|erklärung|lösung|schülerlösung|beispiel|beispielsatz|satz|begründung|beschreibung|darstellung)/i.test(t);
}

const NOT_WORDS = new Set(["es", "er", "sie", "das", "dies", "dieses", "wort", "antwort", "lösung", "beispiel", "richtig", "falsch"]);
/** Pairs „word → Wortart“ the task's answer key states, to check them against what the app knows. */
function answerPairs(d: TaskDraft): { word: string; wa: Wortart }[] {
  const out: { word: string; wa: Wortart }[] = [];
  const marked = d.prompt.match(/\[([A-Za-zÄÖÜäöüß]+)\]/)?.[1] ?? d.prompt.match(/„([A-Za-zÄÖÜäöüß]+)“/)?.[1] ?? null;
  if (d.answer.blanks) {
    const parts = d.prompt.split(GAP);
    const target = wortartenIn(parts[0].split("\n")[0]);
    d.answer.blanks.forEach((alts, i) => {
      const wa = termOf(alts[0] ?? "");
      const before = parts[i]?.split("\n").pop() ?? "";
      // „Katze“ ein ___: the gap belongs to the quoted word, not to the article in front of it
      const last = before.match(/([A-Za-zÄÖÜäöüß]+)[“"]?\s*[:=–-]?\s*$/)?.[1];
      const word = last && /^(ein|eine|einer|ist|sind)$/i.test(last) ? (before.match(/„([A-Za-zÄÖÜäöüß]+)“[^„]*$/)?.[1] ?? null) : last;
      if (wa && word && !termOf(word)) out.push({ word, wa });
      // „Schreib alle Adjektive heraus“: the words in the gaps are of that Wortart
      else if (!wa && target.length === 1 && alts[0]) out.push({ word: alts[0], wa: target[0] });
    });
  }
  if (marked && d.data.options && typeof d.answer.correct === "number") {
    const wa = termOf(d.data.options[d.answer.correct] ?? "");
    if (wa && !/^kein/i.test(d.data.options[d.answer.correct])) out.push({ word: marked, wa });
  }
  if (marked && d.answer.accepted?.[0] && d.type !== "fix") {
    const wa = termOf(d.answer.accepted[0]);
    if (wa) out.push({ word: marked, wa });
  }
  const key = [d.solution, d.type === "fix" ? (d.answer.accepted?.[0] ?? "") : "", d.answer.sample ?? ""].join("\n");
  for (const m of key.matchAll(/([A-Za-zÄÖÜäöüß]{2,})[“"]?\s*(?:=|:|→|ist ein(?:e)?)\s*([A-Za-zÄÖÜäöüß]+(?:\s+[A-Za-zÄÖÜäöüß]+)?)/g)) {
    const wa = /^keine?\s/i.test(m[2]) ? null : termOf(m[2]);
    if (wa && !termOf(m[1]) && !NOT_WORDS.has(m[1].toLowerCase())) out.push({ word: m[1], wa });
  }
  return out;
}

export type WortartCheck = { reject: string[]; review: string[] };

/**
 * Checks a Wortarten task the AI wrote, whatever the provider. reject: the task is not used (made
 * again or by the generator); review: the teacher has to look at it before it can be sent.
 */
export function checkWortartTask(d: TaskDraft, setting: WortartSetting, category: string | null): WortartCheck {
  const reject: string[] = [];
  const review: string[] = [];
  const open = category === "offen" || category === "schreiben";
  const allowed = new Set<Wortart>(setting.allowed);
  const answerText = [...(d.data.options ?? []), ...(d.answer.blanks ?? []).flat(), ...(d.answer.accepted ?? []), ...(d.data.faulty ? [d.data.faulty] : [])].join("\n");
  const explainText = [d.prompt, d.solution, d.answer.sample ?? "", ...(d.answer.criteria ?? []), ...d.hints, ...(d.solutionSteps ?? [])].join("\n");
  // 1. only the chosen Wortarten (an explanation may say „Artikel“ and „Nomen“: „der Hund“ shows the Nomen)
  const inAnswers = wortartenIn(answerText);
  const named = new Set([...inAnswers, ...wortartenIn(explainText).filter((w) => (w !== "artikel" && w !== "nomen") || inAnswers.includes(w))]);
  const extra = [...named].filter((w) => !allowed.has(w));
  if (extra.length) reject.push(`nennt ${extra.map((w) => WORTART_PLURAL[w]).join(", ")}, die nicht gewählt sind`);
  if (OTHER_TERMS.test(answerText + explainText)) reject.push("nennt eine Wortart, die nicht gewählt ist");
  if (!setting.unterarten && Object.values(UNTERARTEN).some((u) => new RegExp(u.label, "i").test(answerText))) reject.push("fragt nach Unterarten, die nicht gewählt sind");
  // 2. a determination task, not an explanation
  if (!open && (d.type === "free" || /^(\S+\s+)?(erkläre|beschreibe|was (ist|sind|versteht man)|wie (erkennt|bestimmt|unterscheidet) man|woran erkennst|nenne die regel)/im.test(d.prompt))) reject.push("ist eine Erklärungsfrage statt einer Bestimmungsaufgabe");
  // 3. a real solution
  if (isPlaceholder(d.answer.sample) || isPlaceholder(d.solution)) reject.push("hat keine konkrete Musterlösung");
  if (d.type === "free" && (d.answer.sample ?? "").trim().length < 25) reject.push("hat keine vollständige Musterlösung");
  if (d.answer.blanks) {
    const prompt = d.prompt.toLowerCase();
    if (d.answer.blanks.some((alts) => !termOf(alts[0] ?? "") && !prompt.includes((alts[0] ?? "").toLowerCase()))) reject.push("hat Lösungen, die weder eine Wortart noch ein Wort aus der Aufgabe sind");
  }
  if (d.data.options && typeof d.answer.correct === "number") {
    const right = d.data.options[d.answer.correct] ?? "";
    if (!termOf(right) && !Object.values(UNTERARTEN).some((u) => u.label.toLowerCase() === right.trim().toLowerCase()) && !d.prompt.toLowerCase().includes(right.trim().toLowerCase())) reject.push("die richtige Antwort ist keine Wortart");
  }
  // 4. grammar: adverbially used Adjektive are no Adverbien; other doubtful pairs go to the teacher
  for (const p of answerPairs(d)) {
    const known = lexicon(p.word);
    if (p.wa === "adverb" && known?.has("adjektiv") && !known.has("adverb")) reject.push(`„${p.word}“ ist ein Adjektiv (adverbial gebraucht), kein Adverb`);
    else if (p.wa === "adjektiv" && known?.has("adverb") && !known.has("adjektiv")) reject.push(`„${p.word}“ ist ein Adverb, kein Adjektiv`);
    else if (known && !known.has(p.wa)) review.push(`Ist „${p.word}“ hier wirklich ${p.wa === "konjunktion" || p.wa === "praeposition" ? "eine" : "ein"} ${WORTART_LABEL[p.wa]}? Bekannt als ${[...known].map((w) => WORTART_LABEL[w]).join(" oder ")}.`);
    else if (!known && p.wa === "adverb") review.push(`Ist „${p.word}“ ein Adverb oder ein adverbial gebrauchtes Adjektiv? Bitte prüfen.`);
  }
  return { reject: [...new Set(reject)], review: [...new Set(review)] };
}

/** Gaps naming a Wortart accept the other school names too (Eigenschaftswort, Tunwort …). */
export function widenNames(d: TaskDraft): TaskDraft {
  if (!d.answer.blanks) return d;
  const blanks = d.answer.blanks.map((alts) => {
    const wa = termOf(alts[0] ?? "");
    return wa && WORTART_NAMES[wa].some((n) => n.toLowerCase() === alts[0].trim().toLowerCase()) ? [...new Set([...alts, ...WORTART_NAMES[wa]])] : alts;
  });
  return { ...d, answer: { ...d.answer, blanks, mode: blanks.some((b, i) => b !== d.answer.blanks![i]) && d.answer.mode === "exact" ? "text" : d.answer.mode } };
}

/** The Teilfähigkeiten of the Wortarten a task asks for, so the Lernstand moves for each of them. */
export function wortartSkillsOf(d: TaskDraft, setting: WortartSetting): string[] {
  if (setting.nomenOnly) return [];
  const answers = [...(d.data.options && typeof d.answer.correct === "number" ? [d.data.options[d.answer.correct]] : []), ...(d.answer.blanks ?? []).map((b) => b[0] ?? ""), d.answer.accepted?.[0] ?? ""];
  const ws = new Set([...answers.map(termOf).filter((w): w is Wortart => w !== null), ...answerPairs(d).map((p) => p.wa)]);
  return [...ws].filter((w) => setting.allowed.includes(w)).map(wortartSkill);
}

/** What the AI is told for Wortarten tasks (lib/ai/features.ts buildPrompt). */
export function wortartenPromptRules(setting: WortartSetting): string {
  const names = setting.allowed.map((w) => WORTART_LABEL[w]);
  const not = WORTARTEN.filter((w) => !setting.allowed.includes(w)).map((w) => WORTART_LABEL[w]);
  return [
    "Wortarten-Aufgaben:",
    `- Erlaubte Wortarten: ${names.join(", ")}.${not.length ? ` Andere Wortarten (${not.join(", ")}) kommen in Aufgaben, Antwortmöglichkeiten, Lösungen und Hilfen nicht vor; nur „der, die, das“ als Begleiter des Nomens darf eine Hilfe nennen.` : ""}${setting.unterarten ? " Unterarten (z. B. Personal-, Possessiv-, Relativpronomen; Hilfs- und Modalverb) sind ab „schwer“ erlaubt." : " Keine Unterarten (keine Pronomenarten, Verbarten …)."}`,
    "- Der Schüler bestimmt echte Wörter: die Wortart eines Wortes in [eckigen Klammern], die Wörter eines Satzes zuordnen (je Zeile „Wort: ___“), alle Wörter einer Wortart aus einem Satz heraussuchen (in der Reihenfolge im Satz), Wörter nach Wortarten sortieren oder falsch bestimmte Wortarten verbessern.",
    "- Keine Erklärungsfragen („Erkläre, wie man …“, „Was ist ein …“), außer der Aufgabentyp ist offen.",
    "- Jede Lösung ist konkret: jedes Wort mit seiner Wortart, z. B. „kleine = Adjektiv, Hund = Nomen, schläft = Verb“. Nie Platzhalter wie „Eine passende Antwort“ oder „Individuelle Schülerlösung“. Bei offenen Aufgaben ein vollständiges Beispiel und Bewertungskriterien.",
    "- Frag nur nach Wörtern mit eindeutiger Wortart. Adjektive, die sagen, wie etwas geschieht („Er läuft schnell.“), sind Adjektive (adverbial gebraucht), keine Adverbien. Adverbien sind z. B. heute, hier, dort, gern, oft, deshalb.",
    "- Schwierigkeit über die Grammatik, nicht nur über die Satzlänge: sehr leicht und leicht = kurze Sätze, typische Wörter; mittel = gebeugte Formen, zusammengesetzte Zeitformen, mehr Wörter; schwer und sehr schwer = Nominalisierungen (beim Lesen), adverbial gebrauchte Adjektive, „das“ als Artikel oder Relativpronomen.",
    "- Im Lückentext steht in jeder Lücke der Fachbegriff (Nomen, Verb, Adjektiv …) oder das gesuchte Wort aus dem Satz. Keine Lücken, in die der Schüler selbst ein passendes Wort einsetzt („Setze ein passendes Verb ein: Der Hase ___ Karotten.“): Dafür gibt es viele richtige Antworten.",
  ].join("\n");
}
