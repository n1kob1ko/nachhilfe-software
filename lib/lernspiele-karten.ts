/**
 * Die Karten der Deutsch-Lernspiele aus den Aufgabenbanken (data/banks/): dieselben geprüften Einträge wie in
 * den Übungen, ohne KI. Hier steht nur Reines (Karte bauen, Regel finden, Runde zusammenstellen), damit es sich
 * ohne Datenbank testen lässt; wer spielt und was gespeichert wird, steht in lib/lernspiele.ts.
 */
import { eintragFehler, bankStufe, WECHSEL_PRAEPOSITION, type Stufe } from "./banken-regeln";
import { adjektivdeklinationItems, artikelItems, praepositionenItems, type AdjektivdeklinationItem, type ArtikelItem, type PraepositionenItem } from "./banks";
import type { SpielArt, SpielKarte } from "./lernspiele-typen";

type Rng = () => number;

/** So viele Karten hat eine Runde: zwei bis vier Minuten. */
export const KARTEN_JE_RUNDE = 12;
/** Höchstens so viele Karten aus früheren Fehlern kommen in eine neue Runde. */
export const WIEDERHOLUNGEN_MAX = 4;

// ---------- der, die, das ----------

const ARTIKEL_FAECHER = ["der", "die", "das"];

/**
 * Endungen, die den Artikel fast immer festlegen. Die Regel erscheint nur, wenn sie zum Wort passt: „der Sprung“
 * endet auf -ung, bekommt die Regel aber nicht, weil der Artikel nicht „die“ ist.
 */
const ENDUNG_REGELN: { endung: string; artikel: "der" | "die" | "das" }[] = [
  { endung: "ung", artikel: "die" },
  { endung: "heit", artikel: "die" },
  { endung: "keit", artikel: "die" },
  { endung: "schaft", artikel: "die" },
  { endung: "ion", artikel: "die" },
  { endung: "tät", artikel: "die" },
  { endung: "chen", artikel: "das" },
  { endung: "lein", artikel: "das" },
  { endung: "ment", artikel: "das" },
  { endung: "ling", artikel: "der" },
  { endung: "ismus", artikel: "der" },
];

/** Das letzte Wort eines zusammengesetzten Nomens, wenn es selbst in der Bank steht (die Tür in „Haustür“). */
export function grundwortVon(item: ArtikelItem, bank: ArtikelItem[]): ArtikelItem | null {
  const wort = item.word.toLowerCase();
  let best: ArtikelItem | null = null;
  for (const b of bank) {
    if (b.word.length < 3 || b.word.length >= item.word.length || b.meaning || b.alsoArticle) continue;
    if (!wort.endsWith(b.word.toLowerCase())) continue;
    if (!best || b.word.length > best.word.length) best = b;
  }
  // ein Grundwort mit anderem Artikel wäre ein Fehler der Bank: dann lieber keine Regel
  return best && best.article === item.article ? best : null;
}

export function artikelRegel(item: ArtikelItem, bank: ArtikelItem[]): string {
  const grund = grundwortVon(item, bank);
  if (grund) return `Das letzte Wort bestimmt den Artikel: ${grund.article} ${grund.word} → ${item.article} ${item.word}.`;
  const lower = item.word.toLowerCase();
  const r = ENDUNG_REGELN.find((x) => lower.endsWith(x.endung) && lower.length > x.endung.length + 1);
  if (r && r.artikel === item.article) return `Nomen auf -${r.endung} haben fast immer „${r.artikel}“: ${item.article} ${item.word}.`;
  return `Lern das Wort immer mit Artikel: ${item.article} ${item.word}.`;
}

export const artikelKey = (item: ArtikelItem) => `artikel:${item.word}${item.meaning ? `:${item.meaning}` : ""}`;

export function artikelKarte(item: ArtikelItem, bank: ArtikelItem[]): SpielKarte {
  return {
    key: artikelKey(item),
    wort: item.word,
    bedeutung: item.meaning,
    vor: "",
    nach: "",
    faecher: ARTIKEL_FAECHER,
    richtig: item.article,
    loesung: `${item.article} ${item.word}`,
    regel: artikelRegel(item, bank),
  };
}

// ---------- Präposition und Fall ----------

/** Die Fächer in fester Reihenfolge; eine Karte zeigt die vier, die ihr Eintrag anbietet. */
const PRAEP_REIHE = ["der", "die", "das", "dem", "den"];

const DATIV_IMMER = new Set(["mit", "nach", "bei", "von", "zu", "aus", "seit", "gegenüber", "außer", "ab"]);
const AKKUSATIV_IMMER = new Set(["durch", "für", "gegen", "ohne", "um", "bis", "entlang"]);

export const praepositionVon = (item: Pick<PraepositionenItem, "prefix">) => item.prefix.trim().split(/\s+/).pop()!.toLowerCase();

export function praepositionRegel(item: PraepositionenItem): string {
  const p = praepositionVon(item);
  const form = `${item.correct} ${item.noun}`;
  if (DATIV_IMMER.has(p)) return `„${p}“ verlangt immer den Dativ: ${p} ${form}.`;
  if (AKKUSATIV_IMMER.has(p)) return `„${p}“ verlangt immer den Akkusativ: ${p} ${form}.`;
  if (WECHSEL_PRAEPOSITION.has(p))
    return item.kasus === "Dativ" ? `„${p}“ + Wo? (Ort) → Dativ: ${p} ${form}.` : `„${p}“ + Wohin? (Richtung) → Akkusativ: ${p} ${form}.`;
  return `Richtig ist: ${item.solution}`;
}

export const praepositionKey = (item: PraepositionenItem) => `praepositionen:${item.solution}`;

export function praepositionKarte(item: PraepositionenItem): SpielKarte {
  return {
    key: praepositionKey(item),
    vor: item.prefix,
    nach: `${item.noun}${item.suffix}`,
    faecher: PRAEP_REIHE.filter((f) => item.options.includes(f)),
    richtig: item.correct,
    loesung: item.solution,
    regel: praepositionRegel(item),
    marke: item.kasus ?? undefined,
  };
}

// ---------- Adjektiv-Endungen ----------

const ENDUNG_REIHE = ["-e", "-en", "-er", "-es", "-em"];

const BESTIMMT_EN = new Set(["dem", "den", "des", "diesem", "diesen", "dieses", "jedem", "jeden", "jedes", "welchem", "welchen"]);
const EIN_EN = /^(ein|kein|mein|dein|sein|ihr|unser|euer|eur)(en|em|er|es)$/;
const BESTIMMT = new Set(["der", "die", "das", "dem", "den", "des", "dieser", "diese", "dieses", "diesem", "diesen", "jeder", "jede", "jedes", "jedem", "jeden"]);
const EIN_WORT = /^(ein|kein|mein|dein|sein|ihr|unser|euer|eur)(e|en|em|er|es)?$/;
const ARTIKEL_ZU_ENDUNG: Record<string, string> = { "-er": "der", "-es": "das", "-e": "die", "-em": "dem" };

/** Das Nomen hinter der Lücke mit seiner Endung (des Tag + -es = des Tages). */
export const nomenTeil = (item: AdjektivdeklinationItem) => item.middle + (item.correct2 === "-" ? "" : item.correct2.slice(1));

/** Ob Lücke, Endung und Satz zusammen genau die Lösung ergeben; sonst taugt der Eintrag nicht für das Spiel. */
export const deklinationStimmt = (item: AdjektivdeklinationItem) => item.prefix + item.correct1.slice(1) + nomenTeil(item) + item.suffix === item.solution;

/** Das Wort vor dem Adjektiv (der Begleiter), klein geschrieben; leer, wenn das Adjektiv vorne steht. */
export function begleiterVon(item: Pick<AdjektivdeklinationItem, "prefix">): string {
  const w = item.prefix.trim().split(/\s+/);
  return w.length >= 2 ? w[w.length - 2].toLowerCase().replace(/[^a-zäöüß]/g, "") : "";
}

export function deklinationRegel(item: AdjektivdeklinationItem): string {
  const b = begleiterVon(item);
  const adj = item.prefix.trim().split(/\s+/).pop()! + item.correct1.slice(1);
  if (BESTIMMT_EN.has(b) || EIN_EN.test(b)) return `Nach „${b}“ endet das Adjektiv immer auf -en: ${b} ${adj}.`;
  if (b === "eine") return `Nach „eine“ endet das Adjektiv auf -e: eine ${adj}.`;
  const nomen = nomenTeil(item).trim().split(/\s+/)[0] ?? "";
  if (/^(ein|kein|mein|dein|sein|ihr|unser|euer)$/.test(b) && (item.correct1 === "-er" || item.correct1 === "-es") && nomen)
    return `Nach „${b}“ zeigt das Adjektiv den Artikel: ${ARTIKEL_ZU_ENDUNG[item.correct1]} ${nomen} → ${b} ${adj} ${nomen}.`;
  if (BESTIMMT.has(b)) return `Nach dem bestimmten Artikel endet das Adjektiv auf -e oder -en. Richtig: ${b} ${adj}.`;
  if (!EIN_WORT.test(b) && ARTIKEL_ZU_ENDUNG[item.correct1]) {
    const art = ARTIKEL_ZU_ENDUNG[item.correct1];
    return `Ohne Artikel bekommt das Adjektiv die Endung des Artikels: ${art} → ${adj}.`;
  }
  return `Richtig ist: ${item.solution}`;
}

export const deklinationKey = (item: AdjektivdeklinationItem) => `deklination:${item.solution}`;

export function deklinationKarte(item: AdjektivdeklinationItem): SpielKarte {
  return {
    key: deklinationKey(item),
    vor: item.prefix,
    nach: nomenTeil(item) + item.suffix,
    faecher: ENDUNG_REIHE.filter((f) => item.options1.includes(f)),
    richtig: item.correct1,
    loesung: item.solution,
    regel: deklinationRegel(item),
  };
}

// ---------- Auswahl ----------

/** Ein Eintrag, der im Spiel taugt: nur eine richtige Antwort, keine Beanstandung der Regeln. */
type Kandidat = { karte: SpielKarte; stufe: Stufe };

const cache = new Map<SpielArt, Kandidat[]>();

/** Alle spielbaren Karten einer Art (einmal gebaut, dann aus dem Speicher). */
export function kandidaten(art: SpielArt): Kandidat[] {
  const c = cache.get(art);
  if (c) return c;
  let out: Kandidat[];
  if (art === "artikel") {
    const bank = artikelItems();
    out = bank.filter((i) => !i.alsoArticle && eintragFehler("artikel", i).length === 0).map((i) => ({ karte: artikelKarte(i, bank), stufe: bankStufe("artikel", i) ?? 2 }));
  } else if (art === "praepositionen") {
    out = praepositionenItems()
      .filter((i) => i.kasus && eintragFehler("praepositionen", i).length === 0 && i.options.includes(i.correct))
      .map((i) => ({ karte: praepositionKarte(i), stufe: bankStufe("praepositionen", i) ?? 2 }));
  } else {
    out = adjektivdeklinationItems()
      .filter((i) => deklinationStimmt(i) && eintragFehler("adjektivdeklination", i).length === 0 && i.options1.includes(i.correct1))
      .map((i) => ({ karte: deklinationKarte(i), stufe: bankStufe("adjektivdeklination", i) ?? 2 }));
  }
  cache.set(art, out);
  return out;
}

/** Nur für Tests: baut die Karten beim nächsten Zugriff neu (nach `useBankContentForTest`). */
export const leereKartenCache = () => cache.clear();

/**
 * Welche Stufen in eine Runde kommen: nach Schulstufe und Lernstand der Fähigkeit. Wer unsicher ist, bekommt die
 * leichteren Karten; wer sicher ist, auch die schweren. Ohne Lernstand die Mitte.
 */
export function stufenFuer(art: SpielArt, schulstufe: number, lernstand: number | null): Stufe[] {
  if (art === "artikel") {
    if (schulstufe <= 2) return [0];
    if (schulstufe <= 4) return lernstand !== null && lernstand >= 0.75 ? [0, 1, 2] : [0, 1];
    if (lernstand === null) return [1, 2];
    return lernstand < 0.5 ? [0, 1] : lernstand < 0.75 ? [1, 2] : [2, 3];
  }
  if (art === "praepositionen") return lernstand !== null && lernstand < 0.5 ? [1] : [1, 2];
  return lernstand !== null && lernstand < 0.5 ? [1, 2] : lernstand !== null && lernstand >= 0.75 ? [2, 3] : [1, 2, 3];
}

function mischen<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Eine Runde: zuerst Karten, die zuletzt falsch waren (`wiederholen`, höchstens vier), dann neue aus den passenden
 * Stufen, ohne die zuletzt gespielten (`zuletzt`). Keine Antwort steht öfter als in der Hälfte der Karten
 * (sonst gewinnt bei den Endungen „-en“ fast immer), und reicht eine Stufe nicht, kommt die nächste dazu.
 */
export function waehleKarten(art: SpielArt, o: { stufen: Stufe[]; wiederholen?: string[]; zuletzt?: string[]; rng?: Rng; anzahl?: number }): SpielKarte[] {
  const rng = o.rng ?? Math.random;
  const anzahl = o.anzahl ?? KARTEN_JE_RUNDE;
  const alle = kandidaten(art);
  const byKey = new Map(alle.map((k) => [k.karte.key, k]));
  const gewaehlt: SpielKarte[] = [];
  const genommen = new Set<string>();
  const proAntwort = new Map<string, number>();
  const grenze = Math.ceil(anzahl / 2);
  const nimm = (k: SpielKarte) => {
    gewaehlt.push(k);
    genommen.add(k.key);
    proAntwort.set(k.richtig, (proAntwort.get(k.richtig) ?? 0) + 1);
  };

  for (const key of o.wiederholen ?? []) {
    const k = byKey.get(key);
    if (k && !genommen.has(key) && gewaehlt.length < Math.min(WIEDERHOLUNGEN_MAX, anzahl)) nimm(k.karte);
  }

  const zuletzt = new Set(o.zuletzt ?? []);
  const reihen: Stufe[][] = [o.stufen, [0, 1, 2, 3].filter((s) => !o.stufen.includes(s as Stufe)) as Stufe[]];
  for (const stufen of reihen) {
    for (const ohneZuletzt of [true, false]) {
      const pool = mischen(
        alle.filter((k) => stufen.includes(k.stufe) && !genommen.has(k.karte.key) && (!ohneZuletzt || !zuletzt.has(k.karte.key))),
        rng,
      );
      for (const k of pool) {
        if (gewaehlt.length >= anzahl) break;
        if ((proAntwort.get(k.karte.richtig) ?? 0) >= grenze) continue;
        nimm(k.karte);
      }
      if (gewaehlt.length >= anzahl) break;
    }
    if (gewaehlt.length >= anzahl) break;
  }
  // die Wiederholungen nicht alle vorne: gemischt, aber nie zwei gleiche Wörter nacheinander (gibt es nicht)
  return mischen(gewaehlt, rng);
}
