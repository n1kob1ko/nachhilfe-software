/**
 * Vokabeltrainer: how an answer is compared with the words of a list (lib/vokabeln.ts builds the tasks).
 * niko's rule: a wrong correction is worse than a missing one. So an answer counts as wrong only when the
 * app knows why: another word of the same list (in an own list only when the topic lists know both words),
 * the wrong German article, the base form in a gap of a checked topic sentence, one letter wrong. Every other
 * answer that is not in the list may still be right: a synonym, another word of an own list that may mean
 * nearly the same (watch for look), the word of the question (clever, Shop and rucksack are the same in both
 * languages), singular for plural, another form in a gap. It goes to the teacher, like a free answer
 * (correct: null).
 *
 * What does not matter: upper and lower case, extra spaces and hyphens, a full stop at the end, British
 * or American spelling (colour, color), the English article before a noun (a, an, the), "to" before a
 * verb, the German article when none is written, text in brackets ("(to) look after (sb)"), placeholders
 * (sb, sth, jdn., etw.) and ae, oe, ue, ss for ä, ö, ü, ß.
 *
 * Only this file is needed to check an answer (lib/tasks.ts imports it); it holds no word lists.
 */
import { langform } from "./englisch-kurzformen";
import type { CheckResult } from "./tasks";

export type Sprache = "en" | "de";
export type Wortart = "nomen" | "verb";

/** The skill of the own lists (lib/vokabellisten.ts); its tasks come from the student's lists, never from the KI. Here, so the builder form needs no word lists. */
export const EIGENE_VOKABELN = "englisch.vocab.eigene";

/** What a vocabulary task needs for checking, stored in AnswerSpec.vokabel. The right answers stay in accepted (or blanks). */
export type VokabelSpec = {
  /** The language of the answer. */
  sprache: Sprache;
  /** nomen: the article is optional; verb: "to" is optional. */
  wortart?: Wortart;
  /** The word that was asked, in the other language (someone who copies it gets told). */
  frage?: string[];
  /** Also right: translations of the asked word in the topic lists (another meaning than the list's). */
  auch?: string[];
  /** The other words of the list: [word in the language of the answer, its translation]. Such an answer is wrong. */
  andere?: [string, string][];
  /** Other words of an own list that may mean nearly the same (look, watch): such an answer goes to the teacher. */
  andereUnsicher?: [string, string][];
  /** Gap: the base forms when the sentence needs another form (cats, played). */
  grundform?: string[];
  /** The base form in such a gap is certainly wrong (checked sentences of the topic lists); otherwise the teacher decides. */
  formSicher?: boolean;
  /** Gap: the other forms of the word (cried for cries): whether one fits too, the teacher decides. */
  formen?: string[];
};

// ---------- spelling ----------
/** British spelling → American, word by word (both count the same). storey and cheque are other words in American English. */
const AE: Record<string, string> = {
  grey: "gray",
  greyish: "grayish",
  programme: "program",
  programmes: "programs",
  practise: "practice",
  practised: "practiced",
  practises: "practices",
  practising: "practicing",
  jewellery: "jewelry",
  pyjamas: "pajamas",
  pyjama: "pajama",
  mum: "mom",
  mummy: "mommy",
  mums: "moms",
  maths: "math",
  tyre: "tire",
  tyres: "tires",
  aluminium: "aluminum",
  moustache: "mustache",
  doughnut: "donut",
  doughnuts: "donuts",
  cosy: "cozy",
  mould: "mold",
  sceptical: "skeptical",
  enrol: "enroll",
  fulfil: "fulfill",
  skilful: "skillful",
  woollen: "woolen",
  catalogue: "catalog",
  dialogue: "dialog",
  analyse: "analyze",
  analysed: "analyzed",
  defence: "defense",
  offence: "offense",
  licence: "license",
  plough: "plow",
  kerb: "curb",
  yoghurt: "yogurt",
  yoghurts: "yogurts",
  ageing: "aging",
  judgement: "judgment",
  towards: "toward",
  learnt: "learned",
  dreamt: "dreamed",
  spelt: "spelled",
  burnt: "burned",
  smelt: "smelled",
  spilt: "spilled",
  leapt: "leaped",
  aeroplane: "airplane",
  aeroplanes: "airplanes",
  axe: "ax",
  sulphur: "sulfur",
  manoeuvre: "maneuver",
  omelette: "omelet",
  omelettes: "omelets",
  cheerio: "cheerio",
};
const OUR = /^(col|fav|flav|hon|hum|lab|neighb|behavi|harb|rum|od|vap|arm|parl|sav|endeav|clam|val|rig|splend|tum|sav|savi)our(.*)$/;
const ISE =
  /^(organ|real|recogn|apolog|memor|critic|summar|special|categor|emphas|priorit|sympath|final|util|standard|modern|civil|familiar|personal|optim|minim|maxim|author|global|visual|symbol|fantas|ideal|computer|custom|mobil|neutral|natural|legal)is(e|ed|es|ing|ation|ations|er|ers)$/;
const RE = /^(cent|theat|met|kilomet|centimet|millimet|lit|fib|somb|spect|lust|calib)re(s|d)?$/;
const LL = /^(travel|cancel|label|model|quarrel|fuel|marvel|jewel|signal|tunnel|level|counsel|dial|duel|equal|panel|pedal|total|channel|shovel|snorkel|yodel)l(ed|ing|er|ers|ous)$/;

export function amerikanisch(word: string): string {
  if (AE[word]) return AE[word];
  return word.replace(OUR, "$1or$2").replace(ISE, "$1iz$2").replace(RE, "$1er$2").replace(LL, "$1$2");
}

/** Both German spellings are right (Duden), the second becomes the first. */
const DE_VARIANTEN: [RegExp, string][] = [
  [/delphin/g, "delfin"],
  [/photo/g, "foto"],
  [/graphik/g, "grafik"],
  [/spagetti/g, "spaghetti"],
  [/jogurt/g, "joghurt"],
  [/tunfisch/g, "thunfisch"],
  [/panter/g, "panther"],
  [/portmonee/g, "portemonnaie"],
  [/majonaese/g, "mayonnaise"],
  [/ketschup/g, "ketchup"],
  [/saxophon/g, "saxofon"],
  [/telephon/g, "telefon"],
  [/geographie/g, "geografie"],
  [/mikrophon/g, "mikrofon"],
];

/**
 * Nouns whose gender differs by region (Austria, Germany) or is free, and "Möbel", whose plural (die) and
 * singular (das) are both used: every article counts.
 */
const GENUS_FREI = new Set(
  "joghurt cola mail email radio sms keks virus liter meter kilometer zentimeter kaugummi radiergummi polster couch bonbon spray gummi prospekt match ketchup paprika sakko spital gulasch blog event puzzle service dotter pyjama laptop sandwich app möbel"
    .split(" ")
    .map((w) => w.replace(/ö/g, "oe")),
);

/** Words for "somebody" and "something": optional in a vocabulary answer (look after sb = look after). */
const PLATZHALTER_EN = new Set(["sb", "sth", "somebody", "someone", "something", "sb's", "somebody's", "someone's", "one's", "sth's"]);
const PLATZHALTER_DE = new Set(["jdn", "jdm", "jds", "jmdn", "jmdm", "jmds", "jemanden", "jemandem", "jemandes", "jemand", "etw", "etwas"]);
/** Fixed phrases whose article is part of them. */
const FESTE = new Set(["a lot", "a few", "a little", "a bit", "a couple", "the same", "the other", "a while", "the rest", "a lot of", "the others"]);
const ARTIKEL_DE = new Set(["der", "die", "das", "ein", "eine"]);

/** Lower case, one space, straight apostrophes, no quotation marks and no full stop at the end. */
function grund(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’`´ʼ]/g, "'")
    .replace(/[„“”"«»]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;:,]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * The ways a listed answer may be written: text in brackets with and without it ("(to) look after (sb)"),
 * at most three brackets (more are kept as one text).
 */
export function varianten(s: string): string[] {
  const teile = s.split(/(\([^()]*\))/);
  const klammern = teile.map((t, i) => (t.startsWith("(") && t.endsWith(")") ? i : -1)).filter((i) => i >= 0);
  if (!klammern.length) return [s];
  if (klammern.length > 3) return [s.replace(/[()]/g, "")];
  const out = new Set<string>();
  for (let maske = 0; maske < 1 << klammern.length; maske++) {
    const text = teile.map((t, i) => {
      const k = klammern.indexOf(i);
      if (k < 0) return t;
      return maske & (1 << k) ? t.slice(1, -1) : " ";
    });
    const v = text.join("").replace(/\s+/g, " ").trim();
    if (v) out.add(v);
  }
  return [...out];
}

const ohnePlatzhalter = (tokens: string[], liste: Set<string>) => {
  const rest = tokens.filter((t) => !liste.has(t.replace(/\.$/, "")));
  return rest.length ? rest : tokens;
};

/** The English key of an answer: no spaces, American spelling, long forms; article (nouns) and "to" (verbs) left out. */
export function schluesselEn(s: string, wortart?: Wortart): string {
  let t = grund(s)
    .replace(/[-‐–—/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = langform(t).toLowerCase();
  let tokens = t.split(" ").filter(Boolean).map(amerikanisch);
  tokens = ohnePlatzhalter(tokens, PLATZHALTER_EN);
  const satz = tokens.join(" ");
  if (wortart === "nomen" && tokens.length > 1 && /^(a|an|the)$/.test(tokens[0]) && !FESTE.has(satz)) tokens = tokens.slice(1);
  if (wortart === "verb" && tokens.length > 1 && tokens[0] === "to") tokens = tokens.slice(1);
  return tokens.join("").replace(/[^\p{L}\p{N}']/gu, "");
}

/** A German answer taken apart: its article (only before a noun) and the key of the rest. */
export type DeTeile = { artikel: string | null; key: string; nomen: boolean };

const umlaute = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
function deKey(tokens: string[]): string {
  let k = umlaute(ohnePlatzhalter(tokens, PLATZHALTER_DE).join("")).replace(/[^\p{L}\p{N}]/gu, "");
  for (const [re, zu] of DE_VARIANTEN) k = k.replace(re, zu);
  return k;
}

/**
 * The listed German form: "der Hund" and "der erste Schultag" are nouns with an article (the last word
 * is written with a capital letter), "Eltern" is a noun without one, "das ist gut" is no noun.
 */
export function teileDe(s: string): DeTeile {
  const roh = s
    .normalize("NFC")
    .replace(/[„“”"«»*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;:,]+$/, "")
    .trim();
  const worte = roh.split(" ").filter(Boolean);
  const letztes = worte[worte.length - 1] ?? "";
  const gross = /^[A-ZÄÖÜ]/.test(letztes);
  const tokens = worte.map((w) => w.toLowerCase());
  if (worte.length > 1 && ARTIKEL_DE.has(tokens[0]) && gross) return { artikel: tokens[0], key: deKey(tokens.slice(1)), nomen: true };
  return {
    artikel: null,
    key: deKey(tokens),
    nomen: worte.length === 1 && gross,
  };
}

/** The given German answer, read like the listed form it is compared with. */
function gegebenDe(s: string, nachNomen: boolean): { artikel: string | null; key: string } {
  const tokens = grund(s)
    .replace(/[-‐–—/]/g, " ")
    .split(" ")
    .filter(Boolean);
  if (nachNomen && tokens.length > 1 && ARTIKEL_DE.has(tokens[0])) return { artikel: tokens[0], key: deKey(tokens.slice(1)) };
  return { artikel: null, key: deKey(tokens) };
}

/** The given article fits the listed one: der/das with ein, die with eine. */
export function artikelPasst(gegeben: string, gelistet: string): boolean {
  if (gegeben === gelistet) return true;
  const g = gegeben === "ein" ? ["der", "das"] : gegeben === "eine" ? ["die"] : [gegeben];
  const l = gelistet === "ein" ? ["der", "das"] : gelistet === "eine" ? ["die"] : [gelistet];
  return g.some((x) => l.includes(x));
}

export type Treffer = "ja" | "artikel" | "nein";

/** Compares a given answer with one listed answer. "artikel": the German word is right, its article not. */
export function vergleiche(gegeben: string, gelistet: string, sprache: Sprache, wortart?: Wortart): Treffer {
  let artikel = false;
  for (const g of varianten(gegeben)) {
    for (const l of varianten(gelistet)) {
      if (sprache === "en") {
        if (schluesselEn(g, wortart) === schluesselEn(l, wortart) && schluesselEn(l, wortart)) return "ja";
        continue;
      }
      const lt = teileDe(l);
      const gt = gegebenDe(g, lt.nomen);
      if (!lt.key || gt.key !== lt.key) continue;
      if (!gt.artikel || !lt.artikel || artikelPasst(gt.artikel, lt.artikel) || GENUS_FREI.has(lt.key)) return "ja";
      artikel = true;
    }
  }
  return artikel ? "artikel" : "nein";
}

/** The key that decides "one letter wrong": without article, "to" and spaces. */
function tippKey(s: string, sprache: Sprache, wortart?: Wortart): string {
  if (sprache === "en") return schluesselEn(s, wortart);
  return gegebenDe(s, true).key;
}

/** Damerau distance of at most one (one letter wrong, missing, extra or two swapped letters). */
export function einBuchstabe(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [kurz, lang] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < kurz.length && kurz[i] === lang[i]) i++;
  return kurz.slice(i) === lang.slice(i + 1);
}

function tippfehler(gegeben: string, gelistet: string, sprache: Sprache, wortart?: Wortart): boolean {
  for (const l of varianten(gelistet)) {
    const k = tippKey(l, sprache, wortart);
    if (k.length >= 3 && einBuchstabe(tippKey(gegeben, sprache, wortart), k)) return true;
  }
  return false;
}

export const OFFEN_TEXT = "Diese Antwort steht nicht in der Liste. Ob sie auch passt, schaut sich deine Lehrerin bzw. dein Lehrer an.";

/** The value of a gap (the answer of a gap text is a JSON array). */
function wertDerLuecke(given: string): string {
  try {
    const v = JSON.parse(given);
    return Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : given;
  } catch {
    return given;
  }
}

/**
 * Singular and plural of the same word (dogs for dog, Katzen for Katze, Äpfel for Apfel): no spelling mistake
 * and no other word. Whether the number fits, the teacher decides.
 */
function zahlVariante(gegeben: string, gelistet: string, sprache: Sprache, wortart?: Wortart): boolean {
  const a = tippKey(gegeben, sprache, wortart);
  for (const l of varianten(gelistet)) {
    const b = tippKey(l, sprache, wortart);
    if (!a || !b || a === b) continue;
    if (sprache === "en") {
      const mehr = (x: string) => [`${x}s`, `${x}es`, x.replace(/y$/, "ies"), x.replace(/fe?$/, "ves")];
      if (mehr(a).includes(b) || mehr(b).includes(a)) return true;
      continue;
    }
    const ohneUmlaut = (x: string) => x.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
    const [kurz, lang] = [ohneUmlaut(a), ohneUmlaut(b)].sort((x, y) => x.length - y.length);
    if (kurz === lang || ["e", "n", "en", "er", "s", "nen", "ern"].some((endung) => kurz + endung === lang)) return true;
  }
  return false;
}

/** An English word that looks like a plural (trousers, headphones, children): its German may stand in the plural with "die". */
function englischeMehrzahl(wort: string): boolean {
  const w = grund(wort).split(" ").pop() ?? "";
  return (/s$/.test(w) && !/(ss|us|is|ous)$/.test(w)) || ["people", "children", "men", "women", "teeth", "feet", "mice", "geese"].includes(w);
}

/** Checks the answer of a vocabulary task (short answer or one gap). */
export function pruefeVokabel(
  task: {
    answer: { accepted?: string[]; blanks?: string[][]; vokabel?: VokabelSpec };
  },
  given: string,
): CheckResult {
  const a = task.answer;
  const v = a.vokabel!;
  const luecke = Array.isArray(a.blanks);
  const wert = luecke ? wertDerLuecke(given) : given;
  const richtig = ((luecke ? a.blanks![0] : a.accepted) ?? []).filter((x) => x.trim());
  // in a gap the article and "to" belong to the sentence: "the dog" does not fit into "My ___ loves …"
  const wa = luecke ? undefined : v.wortart;
  const falsch = (errorLabel: string | null, feedback: string, errorType: string | null = null): CheckResult => ({
    correct: false,
    errorLabel,
    feedback,
    errorType,
    ...(luecke ? { wrongGaps: [1] } : {}),
  });
  const offen = (feedback = OFFEN_TEXT): CheckResult => ({
    correct: null,
    errorLabel: null,
    feedback,
  });
  if (!wert.trim()) return falsch(null, "Schreib ein Wort in das Feld.");

  let artikelFehler = false;
  let artikelUnsicher = false;
  for (const r of richtig) {
    const t = vergleiche(wert, r, v.sprache, wa);
    if (t === "ja")
      return {
        correct: true,
        errorLabel: null,
        feedback: lob(richtig, r, wert, v.sprache),
      };
    if (t !== "artikel") continue;
    // "der Kopfhörer" for headphones (die Kopfhörer): the singular, no wrong article
    if (teileDe(r).artikel === "die" && (v.frage ?? []).some(englischeMehrzahl)) artikelUnsicher = true;
    else artikelFehler = true;
  }
  for (const r of v.auch ?? []) {
    if (vergleiche(wert, r, v.sprache, wa) === "ja")
      return {
        correct: true,
        errorLabel: null,
        feedback: `Richtig! In der Liste steht: ${richtig.slice(0, 3).join(", ")}.`,
      };
  }
  // a gap: the word in another form (collect for collects, cried for cries)
  if (luecke && (v.grundform ?? []).some((g) => vergleiche(wert, g, "en") === "ja")) {
    if (v.formSicher) return falsch("Falsche Form im Satz", "Das Wort stimmt, aber die Form passt nicht in den Satz.", "grammatik");
    return offen("Das Wort stimmt. Ob die Form in den Satz passt, schaut sich deine Lehrerin bzw. dein Lehrer an.");
  }
  if (luecke && (v.formen ?? []).some((g) => vergleiche(wert, g, "en") === "ja")) {
    return offen("Das Wort stimmt. Ob die Form in den Satz passt, schaut sich deine Lehrerin bzw. dein Lehrer an.");
  }
  const sicher = [...richtig, ...(v.auch ?? [])];
  if (artikelUnsicher || sicher.some((r) => zahlVariante(wert, r, v.sprache, wa))) return offen();
  // another word of the same list: the commonest mix-up, and the label says what the word means
  for (const [wort, bedeutung] of v.andere ?? []) {
    if (vergleiche(wert, wort, v.sprache, wa) !== "ja") continue;
    const label = v.sprache === "en" ? `„${wort}“ heißt „${bedeutung}“` : `„${wort}“ heißt auf Englisch „${bedeutung}“`;
    return falsch(label, `Leider nicht richtig. ${label}.`, "wortschatz");
  }
  for (const [wort, bedeutung] of v.andereUnsicher ?? []) {
    if (vergleiche(wert, wort, v.sprache, wa) === "ja") return offen(`In der Liste steht „${wort}“ bei „${bedeutung}“. Ob es hier auch passt, schaut sich deine Lehrerin bzw. dein Lehrer an.`);
  }
  if (artikelFehler) return falsch("Falscher Artikel", "Das Wort stimmt, aber der Artikel nicht.", "grammatik");
  // the word of the question: often copied, but some words are the same in both languages (clever, Shop, rucksack)
  const andereSprache: Sprache = v.sprache === "en" ? "de" : "en";
  if ((v.frage ?? []).some((f) => vergleiche(wert, f, andereSprache, v.wortart) === "ja")) {
    return offen(
      v.sprache === "en"
        ? "Das ist das Wort aus der Frage. Gesucht ist das englische Wort. Ob es auf Englisch auch so heißt, schaut sich deine Lehrerin bzw. dein Lehrer an."
        : "Das ist das Wort aus der Frage. Gesucht ist das deutsche Wort. Ob es auf Deutsch auch so heißt, schaut sich deine Lehrerin bzw. dein Lehrer an.",
    );
  }
  if (sicher.some((r) => tippfehler(wert, r, v.sprache, wa))) return falsch("Ein Buchstabe falsch", "Fast! Ein Buchstabe stimmt nicht.", "rechtschreibung");
  return offen();
}

/** Feedback for a right answer: the German article when it was left out, and the other right answers. */
function lob(richtig: string[], getroffen: string, wert: string, sprache: Sprache): string {
  const teile = ["Richtig!"];
  const t = sprache === "de" ? teileDe(getroffen) : null;
  if (t?.artikel && !gegebenDe(wert, true).artikel) teile.push(`Mit Artikel: ${getroffen}.`);
  const sonst = richtig.filter((r) => r !== getroffen).slice(0, 3);
  if (sonst.length) teile.push(`Auch richtig: ${sonst.join(", ")}.`);
  return teile.join(" ");
}
