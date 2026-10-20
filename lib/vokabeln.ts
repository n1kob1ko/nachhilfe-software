/**
 * Vokabeltrainer ohne KI: English and German words from a list, practised in four ways: German → English,
 * English → German, multiple choice and the word in a gap of its example sentence (when the word has one).
 * The lists are the topic lists (lib/vokabeln-themen.ts) and the teacher's own lists for one student
 * (lib/vokabellisten.ts). Both are written the same way, one pair per line:
 *
 *   mobile phone; cell phone = das Handy | My mobile phone is in my bag.
 *
 * English left, German right, alternatives with ";", the example sentence after "|". In the sentence the
 * word may stand in another form (cats, played); *…* marks the place when the app does not find it.
 *
 * The levels change which words come and how many: topic lists start with the first, most common words
 * and add the harder ones from "mittel" on; own lists use their first 8 words (sehr leicht), their first 15
 * (leicht) or all. Harder levels ask more often German → English, offer four instead of three options and
 * put the word into the gap in the form the sentence needs.
 *
 * How answers are checked: lib/vokabeln-pruefen.ts.
 */
import type { Difficulty } from "./curriculum";
import { edForm, ingForm, sForm, UNREGELMAESSIG } from "./englisch-woerter";
import { STUFE, type Rng } from "./schulbuch-zahlen";
import type { TaskDraft } from "./tasks";
import { artikelPasst, schluesselEn, teileDe, varianten, type Sprache, type VokabelSpec, type Wortart } from "./vokabeln-pruefen";

/** The gap of a gap text, the same as GAP in lib/tasks.ts (not imported: lib/tasks.ts imports the checker). */
const LUECKE = "___";

export { EIGENE_VOKABELN } from "./vokabeln-pruefen";
/** At most this many words in one list. */
export const MAX_WOERTER = 200;

export type Vokabel = {
  /** English, the first is the main form. */
  en: string[];
  /** German, the first is the main form ("der Hund"). */
  de: string[];
  /** English example sentence with the word (also in another form); *…* marks its place. */
  satz?: string;
  /** Topic lists: 0 = the first words, 1 = more, 2 = harder. */
  stufe?: 0 | 1 | 2;
  /** Line in the list (for messages). */
  zeile?: number;
};

export type Meldung = { zeile: number; text: string };
export type GeleseneListe = {
  eintraege: Vokabel[];
  fehler: Meldung[];
  hinweise: Meldung[];
};

// ---------- the list ----------
const teileSeite = (s: string) =>
  s
    .split(";")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    // "Hund, der" and "Hund (der)" as in some dictionaries: "der Hund"
    .map((x) => x.replace(/^(.+?),\s*(der|die|das)$/i, "$2 $1").replace(/^(.+?)\s*\(\s*(der|die|das)\s*\)$/i, "$2 $1"));

const deutschWirkt = (s: string) => /[äöüßÄÖÜ]/.test(s) || /^(der|die|das|ein|eine)\s+[A-ZÄÖÜ]/.test(s.trim());
const englischWirkt = (s: string) => /^(to|a|an|the)\s/i.test(s.trim());

/**
 * Reads a list: one pair per line, "english = deutsch | sentence" (also with a tab, or a dash with spaces,
 * between the two). Errors stop saving; hints are only shown.
 */
export function leseListe(text: string): GeleseneListe {
  const eintraege: Vokabel[] = [];
  const fehler: Meldung[] = [];
  const hinweise: Meldung[] = [];
  const gesehen = new Map<string, number>();
  const zeilen = text.replace(/\r\n?/g, "\n").split("\n");
  zeilen.forEach((roh, i) => {
    const zeile = i + 1;
    const line = roh.trim();
    if (!line || line.startsWith("#")) return;
    let links: string;
    let rechts: string;
    let satz: string | undefined;
    if (line.includes("\t")) {
      const spalten = line.split(/\t+/).map((s) => s.trim());
      [links, rechts] = [spalten[0] ?? "", spalten[1] ?? ""];
      satz = spalten.slice(2).join(" ").trim() || undefined;
      if (spalten.length < 2)
        return void fehler.push({
          zeile,
          text: `Zeile ${zeile}: Es fehlt das „=“ zwischen Englisch und Deutsch.`,
        });
    } else {
      const strich = line.indexOf("|");
      const paar = strich >= 0 ? line.slice(0, strich) : line;
      if (strich >= 0) satz = line.slice(strich + 1).trim() || undefined;
      const gleich = paar.split("=");
      if (gleich.length > 2)
        return void fehler.push({
          zeile,
          text: `Zeile ${zeile}: Es steht mehr als ein „=“ in der Zeile.`,
        });
      if (gleich.length === 2) [links, rechts] = gleich;
      else {
        const m = paar.match(/^(.*?)\s+[-–—]\s+(.*)$/);
        if (!m)
          return void fehler.push({
            zeile,
            text: `Zeile ${zeile}: Es fehlt das „=“ zwischen Englisch und Deutsch.`,
          });
        [links, rechts] = [m[1], m[2]];
      }
    }
    const en = teileSeite(links);
    const de = teileSeite(rechts);
    if (!en.length)
      return void fehler.push({
        zeile,
        text: `Zeile ${zeile}: Vor dem „=“ fehlt das englische Wort.`,
      });
    if (!de.length)
      return void fehler.push({
        zeile,
        text: `Zeile ${zeile}: Nach dem „=“ fehlt das deutsche Wort.`,
      });
    if (eintraege.length >= MAX_WOERTER) {
      if (eintraege.length === MAX_WOERTER)
        fehler.push({
          zeile,
          text: `Eine Liste hat höchstens ${MAX_WOERTER} Wörter. Ab Zeile ${zeile} teil sie auf eine zweite Liste auf.`,
        });
      eintraege.push({ en, de });
      return;
    }
    if ([links, rechts].some((s) => /,/.test(s) && !/^(.+?),\s*(der|die|das)$/i.test(s.trim())))
      hinweise.push({
        zeile,
        text: `Zeile ${zeile}: Ein Beistrich trennt keine Bedeutungen. Für zwei Bedeutungen schreib „;“ dazwischen.`,
      });
    if ([links, rechts].some((s) => s.includes("/")))
      hinweise.push({
        zeile,
        text: `Zeile ${zeile}: Für zwei Bedeutungen schreib „;“ statt „/“.`,
      });
    // nach teileSeite: „Hund, der“ steht schon als „der Hund“ da
    if ((en.some(deutschWirkt) && !de.some(deutschWirkt)) || (de.some(englischWirkt) && !en.some(englischWirkt)))
      hinweise.push({
        zeile,
        text: `Zeile ${zeile}: Links steht wohl das deutsche Wort. Englisch kommt links, Deutsch rechts.`,
      });
    const key = `${en.map((x) => schluesselEn(x)).join(";")}=${de.map((x) => teileDe(x).key).join(";")}`;
    if (gesehen.has(key)) {
      hinweise.push({
        zeile,
        text: `Zeile ${zeile}: Dieses Wortpaar steht schon in Zeile ${gesehen.get(key)}. Es zählt nur einmal.`,
      });
      return;
    }
    gesehen.set(key, zeile);
    const e: Vokabel = { en, de, zeile, ...(satz ? { satz } : {}) };
    if (satz) {
      const f = fundstelle(e);
      if (f === "mehrfach")
        hinweise.push({
          zeile,
          text: `Zeile ${zeile}: „${en[0]}“ kommt im Beispielsatz mehrmals vor. Markier die Stelle für die Lücke mit Sternchen, z. B. *${en[0]}*.`,
        });
      else if (!f)
        hinweise.push({
          zeile,
          text: `Zeile ${zeile}: „${ohneTo(en[0])}“ kommt im Beispielsatz nicht vor. Markier das Wort im Satz mit Sternchen, z. B. *${ohneTo(en[0])}s*, sonst gibt es keine Lücke mit diesem Satz.`,
        });
    }
    eintraege.push(e);
  });
  return { eintraege: eintraege.slice(0, MAX_WOERTER), fehler, hinweise };
}

/** Writes entries back as list text (for the teacher's editor and the tests). */
export function alsText(e: Vokabel): string {
  return `${e.en.join("; ")} = ${e.de.join("; ")}${e.satz ? ` | ${e.satz}` : ""}`;
}

// ---------- word class ----------
/** German adjectives and participles on -en: no verbs ("open" for offen, never "to open"). */
const ADJ_EN = new Set(
  "sieben zwischen schüchtern nüchtern modern albern extern intern verlegen offen trocken golden silbern hölzern eisern seiden selten eben eigen verboten verschieden zufrieden erwachsen betrunken gelegen geboren verloren gestohlen gebrochen geschlossen gefroren morgen gestern oben unten neben gegen wegen trotzdem dagegen daneben übrigen".split(
    " ",
  ),
);
const GE_VERBEN = new Set("gehen geben gewinnen genießen gefallen gehören gewöhnen gestehen geschehen gelingen gelten gebrauchen gestalten gelangen".split(" "));

/** Noun (the English article is optional), verb ("to" is optional) or something else. */
export function wortartVon(e: Pick<Vokabel, "en" | "de">): Wortart | undefined {
  if (e.en.some((x) => /^to\s/i.test(x.trim()))) return "verb";
  const d = (e.de[0] ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const t = teileDe(d);
  if (t.nomen) return "nomen";
  const worte = d.split(" ");
  const letztes = worte[worte.length - 1] ?? "";
  if (/^[a-zäöüß]+(en|ern|eln)$/.test(letztes) && !ADJ_EN.has(letztes) && !(/^ge[a-zäöüß]+en$/.test(letztes) && !GE_VERBEN.has(letztes))) return "verb";
  return undefined;
}

const ohneTo = (s: string) => s.replace(/^to\s+/i, "");
const ohneArtikelEn = (s: string) => (/^(a|an|the)\s+\S/i.test(s) ? s.replace(/^(a|an|the)\s+/i, "") : s);
/** The listed English form without "to" and article, as it stands in a sentence. */
const imSatz = (s: string, w: Wortart | undefined) => (w === "verb" ? ohneTo(s) : w === "nomen" ? ohneArtikelEn(s) : ohneTo(s));
/** The example sentence as the student sees it (without the *…* marks). */
export const sauberSatz = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim();

// ---------- the word in its sentence ----------
const UNR = new Map(UNREGELMAESSIG.map((u) => [u.base, u]));
const PLURAL_UNR: Record<string, string> = {
  child: "children",
  man: "men",
  woman: "women",
  foot: "feet",
  tooth: "teeth",
  mouse: "mice",
  person: "people",
  goose: "geese",
  sheep: "sheep",
  fish: "fish",
  policeman: "policemen",
  policewoman: "policewomen",
  fireman: "firemen",
  postman: "postmen",
};
type Regel = "s" | "ed" | "ing" | "unr";

/** The other forms of one word that may stand in a sentence: plural or he/she/it -s, -ed, -ing, irregular forms. */
function formenVon(w: string, art: Wortart | undefined): { form: string; regel: Regel }[] {
  const out = new Map<string, Regel>();
  const add = (form: string, regel: Regel) => form !== w && !out.has(form) && out.set(form, regel);
  if (PLURAL_UNR[w]) add(PLURAL_UNR[w], "unr");
  add(sForm(w), "s");
  add(`${w}s`, "s");
  if (/(s|sh|ch|x|z|o)$/.test(w)) add(`${w}es`, "s");
  if (/[^aeiou]y$/.test(w)) add(`${w.slice(0, -1)}ies`, "s");
  if (/fe?$/.test(w) && art !== "verb") add(w.replace(/fe?$/, "ves"), "s");
  if (art === "nomen") return [...out].map(([form, regel]) => ({ form, regel }));
  const u = UNR.get(w);
  if (u) for (const f of [...u.past, ...u.pp]) add(f, "unr");
  add(edForm(w), "ed");
  add(/e$/.test(w) ? `${w}d` : `${w}ed`, "ed");
  if (/[^aeiou]y$/.test(w)) add(`${w.slice(0, -1)}ied`, "ed");
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) {
    add(`${w}${w.slice(-1)}ed`, "ed");
    add(`${w}${w.slice(-1)}ing`, "ing");
  }
  add(ingForm(w), "ing");
  add(/[^e]e$/.test(w) ? `${w.slice(0, -1)}ing` : `${w}ing`, "ing");
  if (/ie$/.test(w)) add(`${w.slice(0, -2)}ying`, "ing");
  return [...out].map(([form, regel]) => ({ form, regel }));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function stellen(satz: string, form: string): number[] {
  if (!form.trim()) return [];
  const re = new RegExp(`(?<![A-Za-zÀ-ÿ])${escape(form).replace(/ /g, "\\s+")}(?![A-Za-zÀ-ÿ])`, "gi");
  return [...satz.matchAll(re)].map((m) => m.index ?? 0);
}

/** Where the word stands in its sentence (in the sentence without *…*): the gap and its right answers. */
export type Fund = {
  start: number;
  ende: number;
  text: string;
  gebeugt: boolean;
  antworten: string[];
  grund: string[];
};

/**
 * Finds the word in the example sentence: *…* marked, a ___ the teacher wrote, the listed form or another form
 * of it (plural, -s, -ed, -ing, irregular). "mehrfach": it stands there more than once; null: not there.
 */
export function fundstelle(e: Pick<Vokabel, "en" | "de" | "satz">): Fund | "mehrfach" | null {
  if (!e.satz) return null;
  const art = wortartVon(e);
  const grundformen = [...new Set(e.en.flatMap(varianten).map((x) => imSatz(x, art)))];
  const markiert = e.satz.match(/\*([^*]+)\*/);
  const satz = sauberSatz(e.satz);
  if (markiert) {
    const innen = markiert[1].replace(/\s+/g, " ");
    const text = innen.trim();
    // the place in the sentence without marks: what stands before the first *, plus spaces inside the marks
    const vorher = e.satz
      .slice(0, markiert.index ?? 0)
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .replace(/^ /, "");
    let start = vorher.length + (innen.length - innen.trimStart().length);
    if (satz.slice(start, start + text.length) !== text) start = satz.indexOf(text);
    if (!text || start < 0) return null;
    const basis = grundformen.some((g) => g.toLowerCase() === text.toLowerCase());
    return {
      start,
      ende: start + text.length,
      text,
      gebeugt: !basis,
      antworten: basis ? grundformen : [text],
      grund: grundformen,
    };
  }
  if (satz.includes(LUECKE)) {
    const start = satz.indexOf(LUECKE);
    if (satz.indexOf(LUECKE, start + 1) >= 0) return "mehrfach";
    return {
      start,
      ende: start + LUECKE.length,
      text: "",
      gebeugt: false,
      antworten: grundformen,
      grund: grundformen,
    };
  }
  type Kandidat = {
    start: number;
    ende: number;
    text: string;
    gebeugt: boolean;
  };
  const kandidaten: Kandidat[] = [];
  for (const g of grundformen) {
    const worte = g.split(" ");
    for (const at of stellen(satz, g))
      kandidaten.push({
        start: at,
        ende: at + satz.slice(at).match(new RegExp(`^${escape(g).replace(/ /g, "\\s+")}`, "i"))![0].length,
        text: "",
        gebeugt: false,
      });
    // the head of a word group changes: mobile phones, gets up
    const koepfe = art === "nomen" ? [worte.length - 1] : art === "verb" ? [0] : [...new Set([worte.length - 1, 0])];
    for (const k of koepfe) {
      for (const { form } of formenVon(worte[k].toLowerCase(), art)) {
        const neu = worte.map((w, i) => (i === k ? form : w)).join(" ");
        for (const at of stellen(satz, neu))
          kandidaten.push({
            start: at,
            ende: at + satz.slice(at).match(new RegExp(`^${escape(neu).replace(/ /g, "\\s+")}`, "i"))![0].length,
            text: "",
            gebeugt: true,
          });
      }
    }
  }
  // the longest match wins where two overlap (mobile phone before phone)
  const gewaehlt: Kandidat[] = [];
  for (const k of kandidaten.sort((a, b) => b.ende - b.start - (a.ende - a.start) || Number(a.gebeugt) - Number(b.gebeugt))) {
    if (!gewaehlt.some((x) => k.start < x.ende && x.start < k.ende)) gewaehlt.push(k);
  }
  if (!gewaehlt.length) return null;
  if (gewaehlt.length > 1) return "mehrfach";
  const f = gewaehlt[0];
  const text = satz.slice(f.start, f.ende);
  return {
    start: f.start,
    ende: f.ende,
    text,
    gebeugt: f.gebeugt,
    antworten: f.gebeugt ? [text] : grundformen,
    grund: grundformen,
  };
}

/** All other forms of the word (cats, collected, cried): in a gap the teacher decides whether one fits. */
function andereFormen(f: Fund, art: Wortart | undefined): string[] {
  const out = new Set<string>();
  for (const g of f.grund) {
    const worte = g.split(" ");
    const koepfe = art === "nomen" ? [worte.length - 1] : art === "verb" ? [0] : [...new Set([worte.length - 1, 0])];
    out.add(g);
    for (const k of koepfe) for (const { form } of formenVon(worte[k].toLowerCase(), art)) out.add(worte.map((w, i) => (i === k ? form : w)).join(" "));
  }
  const richtig = new Set(f.antworten.map((x) => schluesselEn(x)));
  return [...out].filter((x) => !richtig.has(schluesselEn(x)));
}

/** The base form may also be a past form (hurt, cut, read): then it can fit into the sentence. */
const auchVergangenheit = (f: Fund) => f.grund.some((g) => g.split(" ").some((w) => (UNR.get(w.toLowerCase())?.past ?? []).includes(w.toLowerCase())));

// ---------- words that mean the same ----------
/** All topic lists together: what else a word may mean (a German word with two meanings, two English words for one German). */
export type Lexikon = {
  nachDe: Map<string, Vokabel[]>;
  nachEn: Map<string, Vokabel[]>;
};

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const l = m.get(k);
  if (!l) m.set(k, [v]);
  else if (!l.includes(v)) l.push(v);
};
const deFormen = (e: Vokabel) => e.de.flatMap(varianten).map(teileDe);
const enKeys = (e: Vokabel) => new Set(e.en.flatMap(varianten).map((x) => schluesselEn(x, wortartVon(e))));

export function baueLexikon(listen: Vokabel[][]): Lexikon {
  const lex: Lexikon = { nachDe: new Map(), nachEn: new Map() };
  for (const e of listen.flat()) {
    for (const t of deFormen(e)) push(lex.nachDe, t.key, e);
    for (const k of enKeys(e)) push(lex.nachEn, k, e);
  }
  return lex;
}

/** a and b share a German form (with a fitting article) or an English one: they are taken as one word. */
export function gleicheBedeutung(a: Vokabel, b: Vokabel): boolean {
  if (a === b) return true;
  const ka = enKeys(a);
  for (const k of enKeys(b)) if (ka.has(k)) return true;
  const da = deFormen(a);
  return deFormen(b).some((x) => da.some((y) => y.key === x.key && (!x.artikel || !y.artikel || artikelPasst(x.artikel, y.artikel))));
}

/** x has the form (German with a fitting article, English by its key). */
function hatForm(x: Vokabel, form: string, sprache: Sprache): boolean {
  if (sprache === "en") {
    const wa = wortartVon(x);
    const ks = new Set(varianten(form).map((v) => schluesselEn(v, wa)));
    return x.en.flatMap(varianten).some((v) => ks.has(schluesselEn(v, wa)));
  }
  const ts = varianten(form).map(teileDe);
  return deFormen(x).some((y) => ts.some((t) => t.key === y.key && (!t.artikel || !y.artikel || artikelPasst(t.artikel, y.artikel))));
}

/** Translations of the asked form of e in the topic lists, in the language of the answer. */
function ausLexikon(lex: Lexikon | undefined, e: Vokabel, richtung: Richtung): string[] {
  if (!lex) return [];
  const out = new Set<string>();
  if (richtung === "de-en") {
    for (const t of varianten(e.de[0]).map(teileDe)) for (const l of lex.nachDe.get(t.key) ?? []) if (hatForm(l, e.de[0], "de")) l.en.forEach((x) => out.add(x));
  } else {
    const wa = wortartVon(e);
    for (const v of varianten(e.en[0])) for (const l of lex.nachEn.get(schluesselEn(v, wa)) ?? []) if (hatForm(l, e.en[0], "en")) l.de.forEach((x) => out.add(x));
  }
  return [...out];
}

// ---------- levels ----------
export type Richtung = "de-en" | "en-de";
export type Quelle = {
  eintraege: Vokabel[];
  /** Topic list: levels per word and checked sentences (a wrong form in a gap is certainly wrong). */
  thema: boolean;
  lexikon?: Lexikon;
  /** Volksschule: more multiple choice and English → German. */
  vs?: boolean;
};

/** The words for a level (see the top of the file). Topic words of a higher level come twice as often at "schwer". */
export function woerterFuer(q: Pick<Quelle, "eintraege" | "thema">, difficulty: Difficulty): Vokabel[] {
  const st = STUFE[difficulty] ?? 2;
  const alle = q.eintraege;
  if (!q.thema) return st === 0 ? alle.slice(0, 8) : st === 1 ? alle.slice(0, 15) : alle;
  const s0 = alle.filter((e) => (e.stufe ?? 0) === 0);
  const bis1 = alle.filter((e) => (e.stufe ?? 0) <= 1);
  const hoch = alle.filter((e) => (e.stufe ?? 0) >= 1);
  const pool = st === 0 ? s0.slice(0, 10) : st === 1 ? s0 : st === 2 ? bis1 : st === 3 ? [...alle, ...hoch] : hoch.length >= 6 ? hoch : alle;
  return pool.length ? pool : alle;
}

/** Share of German → English among the written answers, and of multiple choice in "Vocabulary", per level. */
const DE_EN = [0.25, 0.4, 0.5, 0.65, 0.8];
const DE_EN_VS = [0.15, 0.25, 0.35, 0.5, 0.6];
const MC = [0.5, 0.35, 0.2, 0.1, 0];
const MC_VS = [0.7, 0.55, 0.4, 0.25, 0.15];

const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const uniq = (xs: string[]) => [...new Set(xs)];

// ---------- tasks ----------
/**
 * The answers of e in the language of the answer: its own and those of the entries with the same asked
 * form ("die Bank" for bench and bank), plus the translations the topic lists give for it (auch). The other
 * words of the list (fremd) never share a form with e and are no translation of it in the topic lists.
 */
function antworten(q: Quelle, e: Vokabel, richtung: Richtung) {
  const fragSprache: Sprache = richtung === "de-en" ? "de" : "en";
  const gefragt = richtung === "de-en" ? e.de[0] : e.en[0];
  const g = [e, ...q.eintraege.filter((x) => x !== e && hatForm(x, gefragt, fragSprache))];
  const richtig = uniq(g.flatMap((x) => (richtung === "de-en" ? x.en : x.de)));
  const frage = uniq(g.flatMap((x) => (richtung === "de-en" ? x.de : x.en)));
  const sprache: Sprache = richtung === "de-en" ? "en" : "de";
  const wa = wortartVon(e);
  const key = (s: string) => (sprache === "en" ? schluesselEn(s, wa) : teileDe(s).key);
  const richtigeKeys = new Set(richtig.flatMap(varianten).map(key));
  const lexikon = ausLexikon(q.lexikon, e, richtung);
  const auch = uniq(lexikon.filter((x) => !richtigeKeys.has(key(x))));
  const erlaubt = new Set([...richtigeKeys, ...lexikon.flatMap(varianten).map(key)]);
  const fremd = q.eintraege.filter((x) => !g.includes(x) && !gleicheBedeutung(x, e) && !(richtung === "de-en" ? x.en : x.de).flatMap(varianten).some((y) => erlaubt.has(key(y))));
  return { richtig, frage, auch, fremd, sprache, wa };
}

const anfang = (s: string) => {
  const t = teileDe(s);
  const ohne = t.artikel ? s.trim().split(/\s+/).slice(1).join(" ") : ohneTo(ohneArtikelEn(s.trim()));
  return ohne.charAt(0);
};
const buchstaben = (s: string) => {
  const w = s.trim().split(/\s+/);
  return w.length > 1 ? `Es sind ${w.length} Wörter.` : `Es hat ${[...s.trim()].length} Buchstaben.`;
};

/**
 * A key for the word of a task (data.wort): on one sheet a word comes once, in any direction and format
 * (lib/figur.ts aufgabenSchluessel). A hash, because the data of a task goes to the student's device.
 */
export function wortSchluessel(e: Pick<Vokabel, "en" | "de">): string {
  let h = 0x811c9dc5;
  for (const c of `${e.en[0]}=${e.de[0]}`) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193) >>> 0;
  return `Vokabel ${h.toString(36)}`;
}

/** e is in the topic lists with this meaning: an entry there has its English and its German. */
function bekannt(lex: Lexikon | undefined, e: Vokabel): boolean {
  const de = deFormen(e);
  for (const k of enKeys(e)) {
    for (const l of lex?.nachEn.get(k) ?? []) if (deFormen(l).some((x) => de.some((y) => y.key === x.key && (!x.artikel || !y.artikel || artikelPasst(x.artikel, y.artikel))))) return true;
  }
  return false;
}

/**
 * The other words of the list, split: an answer from sicher is certainly wrong, one from unsicher goes to the
 * teacher. In an own list two words may mean nearly the same (look = schauen, watch = anschauen), so a word
 * is only certainly another one when the checked topic lists know both words.
 */
function teileFremd(q: Quelle, e: Vokabel, fremd: Vokabel[]): { sicher: Vokabel[]; unsicher: Vokabel[] } {
  if (q.thema) return { sicher: fremd, unsicher: [] };
  if (!bekannt(q.lexikon, e)) return { sicher: [], unsicher: fremd };
  const sicher = fremd.filter((x) => bekannt(q.lexikon, x));
  return { sicher, unsicher: fremd.filter((x) => !sicher.includes(x)) };
}

/** The other words of the list as [answer, translation], words of the same class first, at most 120. */
function andere(fremd: Vokabel[], richtung: Richtung, wa: Wortart | undefined): [string, string][] {
  const sortiert = [...fremd.filter((x) => wortartVon(x) === wa), ...fremd.filter((x) => wortartVon(x) !== wa)];
  const out: [string, string][] = [];
  for (const x of sortiert) for (const w of richtung === "de-en" ? x.en : x.de) out.push([w, richtung === "de-en" ? x.de[0] : x.en[0]]);
  return out.slice(0, 120);
}

function kurzantwort(q: Quelle, e: Vokabel, richtung: Richtung): TaskDraft {
  const { richtig, frage, auch, fremd, sprache, wa } = antworten(q, e, richtung);
  const { sicher, unsicher } = teileFremd(q, e, fremd);
  const gefragt = richtung === "de-en" ? e.de[0] : e.en[0];
  const satz = e.satz ? sauberSatz(e.satz) : null;
  const f = e.satz ? fundstelle(e) : null;
  const satzMitLuecke = f && f !== "mehrfach" && satz ? `${satz.slice(0, f.start)}${LUECKE}${satz.slice(f.ende)}` : null;
  const vokabel: VokabelSpec = {
    sprache,
    ...(wa ? { wortart: wa } : {}),
    frage,
    ...(auch.length ? { auch } : {}),
    andere: andere(sicher, richtung, wa),
    ...(unsicher.length ? { andereUnsicher: andere(unsicher, richtung, wa) } : {}),
  };
  const hints =
    richtung === "de-en"
      ? [`Es beginnt mit „${anfang(richtig[0])}“.`, satzMitLuecke ? `Im Satz: ${satzMitLuecke}` : buchstaben(ohneTo(richtig[0]))]
      : [...(satz ? [`Im Satz: ${satz}`] : []), `Es beginnt mit „${anfang(richtig[0])}“.`];
  return {
    type: "grammar",
    skillId: null,
    difficulty: "mittel",
    prompt: `${richtung === "de-en" ? "Wie heißt das auf Englisch?" : "Was heißt das auf Deutsch?"}\n${gefragt}`,
    data: { wort: wortSchluessel(e) },
    answer: { accepted: richtig, mode: "text", vokabel },
    solution: `${gefragt} = ${richtig.join(", ")}${satz ? `\nBeispiel: ${satz}` : ""}`,
    hints,
    errorMap: [],
    estimatedTimeSec: 20,
    sourceType: "eigen",
  };
}

function auswahl(q: Quelle, e: Vokabel, richtung: Richtung, rng: Rng, anzahl: number): TaskDraft | null {
  const { fremd, wa } = antworten(q, e, richtung);
  const zeige = (x: Vokabel) => (richtung === "de-en" ? x.en[0] : x.de[0]);
  const richtig = zeige(e);
  const key = (s: string) => (richtung === "de-en" ? schluesselEn(s) : teileDe(s).key);
  const seen = new Set([key(richtig)]);
  // words of the same class first: "cat, horse, bird" for dog, not "blue"
  const gleich = shuffle(
    rng,
    fremd.filter((x) => wortartVon(x) === wa),
  );
  const sonst = shuffle(
    rng,
    fremd.filter((x) => wortartVon(x) !== wa),
  );
  const falsche: Vokabel[] = [];
  for (const x of [...gleich, ...sonst]) {
    if (falsche.length >= anzahl - 1) break;
    const k = key(zeige(x));
    if (seen.has(k)) continue;
    seen.add(k);
    falsche.push(x);
  }
  if (falsche.length < 2) return null;
  const options = shuffle(rng, [richtig, ...falsche.map(zeige)]);
  const gefragt = richtung === "de-en" ? e.de[0] : e.en[0];
  const label = (x: Vokabel) => (richtung === "de-en" ? `„${x.en[0]}“ heißt „${x.de[0]}“` : `„${x.de[0]}“ heißt auf Englisch „${x.en[0]}“`);
  const satz = e.satz ? sauberSatz(e.satz) : null;
  return {
    type: "mc",
    skillId: null,
    difficulty: "mittel",
    prompt: `${richtung === "de-en" ? "Welches englische Wort passt?" : "Welche deutsche Bedeutung passt?"}\n${gefragt}`,
    data: { options, wort: wortSchluessel(e) },
    answer: { correct: options.indexOf(richtig) },
    solution: `${gefragt} = ${richtig}${satz ? `\nBeispiel: ${satz}` : ""}`,
    hints: [richtung === "en-de" && satz ? `Im Satz: ${satz}` : `Es beginnt mit „${anfang(richtig)}“.`],
    errorMap: falsche.map((x) => ({
      answer: String(options.indexOf(zeige(x))),
      label: label(x),
    })),
    estimatedTimeSec: 15,
    sourceType: "eigen",
  };
}

/** Whether e has a gap at this level: from "mittel" on also in another form than the listed one. */
function lueckeMoeglich(e: Vokabel, st: number): boolean {
  const f = e.satz ? fundstelle(e) : null;
  return Boolean(f && f !== "mehrfach" && (st >= 2 || !f.gebeugt));
}

function luecke(q: Quelle, e: Vokabel, st: number): TaskDraft | null {
  const f = e.satz ? fundstelle(e) : null;
  if (!f || f === "mehrfach" || (st < 2 && f.gebeugt)) return null;
  const satz = sauberSatz(e.satz!);
  const cue = e.de[0].replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const hinweis = (teileDe(cue).artikel ? cue.split(" ").slice(1).join(" ") : cue).trim();
  const { fremd, wa } = antworten(q, e, "de-en");
  const { sicher, unsicher } = teileFremd(q, e, fremd);
  const formen = andereFormen(f, wa);
  const fuerDenSatz = (xs: Vokabel[]) => andere(xs, "de-en", wa).map(([w, d]) => [imSatz(w, wortartVon({ en: [w], de: [d] })), d] as [string, string]);
  const vokabel: VokabelSpec = {
    sprache: "en",
    ...(wa ? { wortart: wa } : {}),
    frage: uniq([...e.de, hinweis]),
    andere: fuerDenSatz(sicher),
    ...(unsicher.length ? { andereUnsicher: fuerDenSatz(unsicher) } : {}),
    ...(f.gebeugt ? { grundform: f.grund, formSicher: q.thema && !auchVergangenheit(f) } : {}),
    ...(formen.length ? { formen } : {}),
  };
  const ganz = f.text ? satz : `${satz.slice(0, f.start)}${f.antworten[0]}${satz.slice(f.ende)}`;
  return {
    type: "cloze",
    skillId: null,
    difficulty: "mittel",
    prompt: `Setz das passende englische Wort ein.\n${satz.slice(0, f.start)}${LUECKE} (${hinweis})${satz.slice(f.ende)}`,
    data: { wort: wortSchluessel(e) },
    answer: { blanks: [f.antworten], mode: "text", vokabel },
    solution: `${ganz}\n${e.en[0]} = ${e.de[0]}`,
    hints: [`Es beginnt mit „${f.antworten[0].charAt(0).toLowerCase()}“.`, f.gebeugt ? `Die Grundform ist „${f.grund[0]}“. Pass sie an den Satz an.` : buchstaben(f.antworten[0])],
    errorMap: [],
    estimatedTimeSec: 30,
    sourceType: "eigen",
  };
}

type Art = "mc" | "luecke" | Richtung;
/** What a task type of the builder becomes. Null: a free answer (lib/generators.ts makes it). */
function artFuer(category: string | null, st: number, vs: boolean, rng: Rng): Art | null {
  if (category && ["offen", "writing", "schreiben", "auswendig"].includes(category)) return null;
  const deEn = () => (rng() < (vs ? DE_EN_VS : DE_EN)[st] ? "de-en" : "en-de");
  if (category === "mc") return "mc";
  // a written answer (generateBuiltIn asks for one with "grammar" or "calc")
  if (category === "kurz") return deEn();
  if (category === "gap" || category === "lueckentext" || category === "grammar") return "luecke";
  if (category === "translation") return "de-en";
  return rng() < (vs ? MC_VS : MC)[st] ? "mc" : deEn();
}

/** The builder's task type for an answer format (generateBuiltIn: recommendations, Überprüfungen). "mixed": written, multiple choice or a gap. */
export function kategorieFuerTyp(taskType: string, rng: Rng): string {
  if (taskType === "mc") return "mc";
  if (taskType === "cloze") return "gap";
  if (taskType === "grammar" || taskType === "calc") return "kurz";
  if (taskType === "mixed") return pick(rng, ["vocabulary", "vocabulary", "gap"]);
  return "vocabulary";
}

/** Picks a word of the level; the harder topic words come more often at "schwer" (they are twice in the pool). */
const wortFuer = (q: Quelle, difficulty: Difficulty, rng: Rng, passt: (e: Vokabel) => boolean = () => true) => {
  const pool = woerterFuer(q, difficulty).filter(passt);
  return pool.length ? pick(rng, pool) : null;
};

/**
 * One task from a list for a task type of the builder (vocabulary, mc, gap, translation …). `wort`: this word
 * (null when it does not fit the type and `streng`). The returned category is the type the task has:
 * a word without a sentence becomes German → English instead of a gap.
 */
export function vokabelAufgabe(
  q: Quelle,
  o: {
    category: string | null;
    difficulty: Difficulty;
    rng: Rng;
    wort?: Vokabel;
    streng?: boolean;
  },
): { task: TaskDraft; category: string } | null {
  const st = STUFE[o.difficulty] ?? 2;
  if (!q.eintraege.length) return null;
  const art = artFuer(o.category, st, Boolean(q.vs), o.rng);
  if (!art) return null;
  const fertig = (t: TaskDraft, category: string) => ({
    task: { ...t, difficulty: o.difficulty },
    category,
  });
  const deEn = () => (o.rng() < (q.vs ? DE_EN_VS : DE_EN)[st] ? "de-en" : "en-de");
  if (art === "luecke") {
    const e = o.wort ? (lueckeMoeglich(o.wort, st) ? o.wort : null) : wortFuer(q, o.difficulty, o.rng, (x) => lueckeMoeglich(x, st));
    const t = e ? luecke(q, e, st) : null;
    if (t) return fertig(t, o.category ?? "gap");
    if (o.streng) return null;
    // no word with a sentence at this level: German → English instead (the builder says so)
    const w = o.wort ?? wortFuer(q, o.difficulty, o.rng)!;
    return fertig(kurzantwort(q, w, "de-en"), "translation");
  }
  const e = o.wort ?? wortFuer(q, o.difficulty, o.rng)!;
  if (art === "mc") {
    const t = auswahl(q, e, q.vs ? (o.rng() < 0.25 ? "de-en" : "en-de") : deEn(), o.rng, st <= 1 ? 3 : 4);
    if (t) return fertig(t, o.category === "mc" ? "mc" : "vocabulary");
    // a list with fewer than three words has no multiple choice
    if (o.streng && o.category === "mc") return null;
    return fertig(kurzantwort(q, e, deEn()), "vocabulary");
  }
  return fertig(kurzantwort(q, e, art), o.category === "translation" ? "translation" : "vocabulary");
}

/**
 * Tasks for several places of one exercise: every word of the level once before one comes again, and never
 * the same task twice. avoid: the tasks that are there already, as prompts or as their word key (data.wort,
 * lib/figur.ts aufgabenSchluessel); a word of another task comes again only when every word is used.
 */
export function vokabelAufgabenFuerPlaetze(
  q: Quelle,
  plaetze: { category: string | null; difficulty: Difficulty }[],
  o: { rng?: Rng; avoid?: Set<string> } = {},
): ({ task: TaskDraft; category: string } | null)[] {
  const rng = o.rng ?? Math.random;
  const avoid = new Set(o.avoid ?? []);
  const reihen = new Map<string, { woerter: Vokabel[]; zeiger: number }>();
  return plaetze.map((p) => {
    let r = reihen.get(p.difficulty);
    if (!r)
      reihen.set(
        p.difficulty,
        (r = {
          woerter: shuffle(rng, [...new Set(woerterFuer(q, p.difficulty))]),
          zeiger: 0,
        }),
      );
    for (const auchDasWort of [false, true])
      for (let k = 0; k < r.woerter.length; k++) {
        const i = (r.zeiger + k) % r.woerter.length;
        const out = vokabelAufgabe(q, {
          ...p,
          rng,
          wort: r.woerter[i],
          streng: true,
        });
        if (out && !avoid.has(out.task.prompt) && (auchDasWort || !avoid.has(String(out.task.data.wort)))) {
          r.zeiger = i + 1;
          avoid.add(out.task.prompt);
          return out;
        }
      }
    const out = vokabelAufgabe(q, { ...p, rng });
    if (out) avoid.add(out.task.prompt);
    return out;
  });
}
