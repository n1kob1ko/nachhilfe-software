/**
 * Die Karten der Deutsch-Lernspiele aus den Aufgabenbanken (data/banks/): dieselben geprüften Einträge wie in
 * den Übungen, ohne KI. Hier steht nur Reines (Karte bauen, Regel finden, Runde zusammenstellen), damit es sich
 * ohne Datenbank testen lässt; wer spielt und was gespeichert wird, steht in lib/lernspiele.ts.
 */
import { eintragFehler, bankStufe, grundformVon, satzVon, WECHSEL_PRAEPOSITION, type Stufe } from "./banken-regeln";
import {
  adjektivdeklinationItems,
  artikelItems,
  dasDassItems,
  hauptsatzGliedsatzItems,
  perfektItems,
  praepositionenItems,
  praeteritumItems,
  type AdjektivdeklinationItem,
  type ArtikelItem,
  type ClozeItem,
  type DasDassItem,
  type HauptsatzGliedsatzItem,
  type PraepositionenItem,
} from "./banks";
import { wahlFuerSpiel } from "./deutsch-satzlehre";
import { REIHE_TRENNER, type SpielArt, type SpielKarte } from "./lernspiele-typen";
import { SATZBAU, SATZBAU_MARKE, SATZBAU_REGEL, type SatzbauGruppe } from "./satzbau-saetze";

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

// ---------- Die vier Fälle ----------

export const FALL_FAECHER = ["Nominativ", "Genitiv", "Dativ", "Akkusativ"];
const FAELLE_SKILL = "deutsch.grammatik.faelle";
/** So viele Sätze werden einmal erzeugt; doppelte fallen weg. */
const FAELLE_VERSUCHE = 900;

/** Fester Zufall: dieselben Karten nach jedem Neustart, damit Fehler aus früheren Runden wiederkommen können. */
function festerZufall(seed: number): Rng {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/** Wo `teil` im Satz steht, wenn er genau einmal vorkommt (am Satzanfang auch groß geschrieben). */
function teile(satz: string, teil: string): { vor: string; mitte: string; nach: string } | null {
  const klein = satz.toLowerCase();
  const i = klein.indexOf(teil.toLowerCase());
  if (i < 0 || klein.indexOf(teil.toLowerCase(), i + 1) >= 0) return null;
  // nur ganze Wörter: „der“ soll nicht in „wieder“ gefunden werden
  const davor = satz[i - 1];
  const danach = satz[i + teil.length];
  if ((davor && /[\p{L}]/u.test(davor)) || (danach && /[\p{L}]/u.test(danach))) return null;
  return { vor: satz.slice(0, i), mitte: satz.slice(i, i + teil.length), nach: satz.slice(i + teil.length) };
}

/**
 * Sätze aus dem Satzlehre-Generator (lib/deutsch-satzlehre.ts „Fälle bestimmen“), dieselben wie in den Übungen:
 * ein markierter Teil, vier Kisten. Die Regel ist die des Generators (Frageprobe oder „mit verlangt den Dativ“).
 */
function faelleKandidaten(): Kandidat[] {
  const rng = festerZufall(20261111);
  const out = new Map<string, Kandidat>();
  for (let i = 0; i < FAELLE_VERSUCHE; i++) {
    const stufe = ((i % 3) + 1) as Stufe;
    const w = wahlFuerSpiel(FAELLE_SKILL, stufe, rng);
    const ziel = w?.titel.match(/„(.+?)“/)?.[1];
    const richtig = FALL_FAECHER.find((f) => w?.richtig.startsWith(f));
    if (!w || !ziel || !richtig || w.text.includes("\n")) continue;
    const t = teile(w.text, ziel);
    if (!t) continue;
    const key = `faelle:${w.text}|${t.mitte}`;
    if (out.has(key)) continue;
    out.set(key, {
      karte: { key, ...t, faecher: FALL_FAECHER, richtig, loesung: `„${t.mitte}“: ${richtig}`, regel: w.regel, kurz: t.mitte },
      stufe,
    });
  }
  return [...out.values()];
}

// ---------- das oder dass ----------

const DASDASS_FAECHER = ["das", "dass"];
const LUECKE = "___";

/** Je Lücke eine Karte; die anderen Lücken des Satzes sind schon gefüllt. */
export function dasDassKarten(item: DasDassItem): SpielKarte[] {
  const satz = satzVon(item.q);
  const stuecke = satz.split(LUECKE);
  if (stuecke.length !== item.blanks.length + 1) return [];
  const worte = item.blanks.map((b) => b[0]);
  if (!worte.every((w) => DASDASS_FAECHER.includes(w.toLowerCase())) || item.blanks.some((b) => b.length !== 1)) return [];
  const ganz = stuecke.reduce((a, st, i) => a + st + (worte[i] ?? ""), "");
  return worte.map((wort, n) => {
    const vor = stuecke.slice(0, n + 1).reduce((a, st, i) => a + st + (i < n ? worte[i] : ""), "");
    const nach = stuecke.slice(n + 1).reduce((a, st, i) => a + (i > 0 ? worte[n + i] : "") + st, "");
    const richtig = wort.toLowerCase();
    return {
      key: `dasdass:${ganz}${worte.length > 1 ? `#${n}` : ""}`,
      vor,
      nach: nach.trimStart(),
      faecher: DASDASS_FAECHER,
      richtig,
      einsatz: wort,
      loesung: ganz,
      regel:
        richtig === "das"
          ? "Probe: „dieses“ oder „welches“ passt hier. Dann schreibt man „das“ mit einem s."
          : "Probe: „dieses“ oder „welches“ passt hier nicht. Dann schreibt man „dass“ mit zwei s.",
      kurz: `${wort} ${nach.trim().split(/[\s,.!?]/)[0] ?? ""}`.trim(),
    };
  });
}

// ---------- Hauptsatz oder Gliedsatz ----------

const SATZTEIL_FAECHER = ["Hauptsatz", "Gliedsatz"];
const kleinerAnfang = (s: string) => s.replace(/[,.!?]+$/, "");

/** Beide Teile eines Satzes als Karten: der ganze Satz steht da, ein Teil ist markiert. */
export function satzteilKarten(item: HauptsatzGliedsatzItem): SpielKarte[] {
  const [a, b] = item.parts;
  const gs = item.parts.find((p) => p.type === "GS")!;
  const einleiter = gs.text.trim().split(/\s+/)[0].replace(/[^\p{L}]/gu, "").toLowerCase();
  const satz = `${a.text} ${b.text}`;
  return item.parts.map((teil, n) => {
    const richtig = teil.type === "HS" ? "Hauptsatz" : "Gliedsatz";
    return {
      key: `satzteile:${satz}#${n}`,
      vor: n === 0 ? "" : `${a.text} `,
      // Komma und Punkt gehören nicht zur Markierung
      mitte: kleinerAnfang(teil.text),
      nach: teil.text.slice(kleinerAnfang(teil.text).length) + (n === 0 ? ` ${b.text}` : ""),
      faecher: SATZTEIL_FAECHER,
      richtig,
      loesung: `„${kleinerAnfang(teil.text)}“: ${richtig}`,
      regel:
        teil.type === "GS"
          ? `Der Gliedsatz beginnt mit „${einleiter}“ und kann nicht allein stehen.`
          : `Der Hauptsatz kann allein stehen. Der Gliedsatz ist der Teil mit „${einleiter}“.`,
      kurz: kleinerAnfang(teil.text),
    };
  });
}

// ---------- Perfekt: haben oder sein ----------

const PERFEKT_FAECHER = ["haben", "sein"];
const HABEN_FORM = new Set(["habe", "hast", "hat", "haben", "habt"]);
const SEIN_FORM = new Set(["bin", "bist", "ist", "sind", "seid"]);

/** Der Satz mit dem Partizip, die Lücke ist das Hilfsverb. Nur Einträge, in denen das Hilfsverb zuerst steht. */
export function perfektKarte(item: ClozeItem): SpielKarte | null {
  const stuecke = satzVon(item.q).split(LUECKE);
  const grundform = grundformVon(item.q);
  if (stuecke.length !== 3 || item.blanks.length !== 2 || item.blanks.some((b) => b.length !== 1) || !grundform) return null;
  const [hilfsverb, partizip] = [item.blanks[0][0], item.blanks[1][0]];
  const richtig = HABEN_FORM.has(hilfsverb.toLowerCase()) ? "haben" : SEIN_FORM.has(hilfsverb.toLowerCase()) ? "sein" : null;
  if (!richtig) return null;
  const nach = (stuecke[1] + partizip + stuecke[2]).trimStart();
  const ganz = stuecke[0] + hilfsverb + stuecke[1] + partizip + stuecke[2];
  return {
    key: `perfekt:${ganz}`,
    vor: stuecke[0],
    nach,
    faecher: PERFEKT_FAECHER,
    richtig,
    einsatz: hilfsverb,
    hinweis: `(${grundform})`,
    loesung: ganz,
    regel: `„${grundform}“ bildet das Perfekt mit „${richtig}“: ${hilfsverb.toLowerCase()} … ${partizip}.`,
    kurz: `${hilfsverb.toLowerCase()} ${partizip}`,
  };
}

// ---------- Präteritum ----------

/** Eine Zahl aus einem Text, damit die Kisten einer Karte immer gleich stehen. */
function zahlAus(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 2147483647;
  return h;
}

/** Falsche Formen, die im Satz doch stimmen könnten: „wurde krank“ statt „war krank“, „schloß“ in alter Schreibung. */
const PRAETERITUM_AUCH_MOEGLICH = new Set(["wurde", "wurdest", "wurden", "wurdet"]);
const passtAuch = (falsch: string, richtig: string) => PRAETERITUM_AUCH_MOEGLICH.has(falsch.toLowerCase()) || falsch.replace(/ß/g, "ss") === richtig.replace(/ß/g, "ss");

/**
 * Drei Formen, eine stimmt: die richtige aus der Bank und zwei falsche aus ihrer Fehlerliste (typische Fehler wie
 * „fahrte“ oder die Gegenwartsform). Die Kisten heißen wie die Formen und stehen je Karte immer gleich.
 */
export function praeteritumKarte(item: ClozeItem): SpielKarte | null {
  const stuecke = satzVon(item.q).split(LUECKE);
  const grundform = grundformVon(item.q);
  if (stuecke.length !== 2 || item.blanks.length !== 1 || item.blanks[0].length !== 1 || !grundform) return null;
  const richtig = item.blanks[0][0];
  const falsch = Object.keys(item.errors ?? {}).filter((f) => f.toLowerCase() !== richtig.toLowerCase() && !/\s/.test(f) && !passtAuch(f, richtig));
  if (falsch.length < 2) return null;
  const ganz = stuecke[0] + richtig + stuecke[1];
  const h = zahlAus(ganz);
  const zwei = [falsch[h % falsch.length], falsch[(h + 1) % falsch.length]];
  const faecher = [...zwei];
  faecher.splice(h % 3, 0, richtig);
  return {
    key: `praeteritum:${ganz}`,
    vor: stuecke[0],
    nach: stuecke[1].trimStart(),
    faecher,
    richtig,
    hinweis: `(${grundform})`,
    loesung: ganz,
    regel: `Präteritum von „${grundform}“: ${richtig}.`,
    kurz: richtig,
  };
}

// ---------- Satzbau ----------

/**
 * Eine Karte aus einem Satz der Liste („Heute | gehen | wir | ins Kino.“): der erste Teil steht fest, die übrigen liegen
 * gemischt bereit, nie schon in der richtigen Reihenfolge.
 */
export function satzbauKarte(satz: string, gruppe: Pick<SatzbauGruppe, "typ">, nr: number): SpielKarte {
  const roh = satz.split("|").map((t) => t.trim());
  const zeichen = roh[roh.length - 1].match(/[.?!]$/)?.[0] ?? "";
  const teile = roh.slice(1).map((t, i, a) => (i === a.length - 1 ? t.slice(0, t.length - zeichen.length) : t));
  const rng = festerZufall(nr * 7919 + 13);
  let gemischt = mischen(teile, rng);
  for (let i = 0; i < 6 && gemischt.every((t, j) => t === teile[j]); i++) gemischt = mischen(teile, rng);
  if (gemischt.every((t, j) => t === teile[j])) gemischt = [...teile.slice(1), teile[0]];
  const loesung = `${roh[0]} ${teile.join(" ")}${zeichen}`;
  return {
    key: `satzbau:${loesung}`,
    form: "reihe",
    vor: roh[0],
    nach: zeichen,
    faecher: gemischt,
    richtig: teile.join(REIHE_TRENNER),
    loesung,
    regel: SATZBAU_REGEL[gruppe.typ],
    marke: SATZBAU_MARKE[gruppe.typ],
    kurz: teile[0],
  };
}

function satzbauKandidaten(): Kandidat[] {
  let nr = 0;
  return SATZBAU.flatMap((g) => g.saetze.map((satz) => ({ karte: satzbauKarte(satz, g, ++nr), stufe: g.stufe as Stufe })));
}

// ---------- Auswahl ----------

/**
 * Ein Eintrag, der im Spiel taugt: nur eine richtige Antwort, keine Beanstandung der Regeln. Karten mit derselben
 * `gruppe` (die zwei Teile eines Satzes) kommen nicht zusammen in eine Runde.
 */
type Kandidat = { karte: SpielKarte; stufe: Stufe; gruppe?: string };

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
  } else if (art === "deklination") {
    out = adjektivdeklinationItems()
      .filter((i) => deklinationStimmt(i) && eintragFehler("adjektivdeklination", i).length === 0 && i.options1.includes(i.correct1))
      .map((i) => ({ karte: deklinationKarte(i), stufe: bankStufe("adjektivdeklination", i) ?? 2 }));
  } else if (art === "faelle") {
    out = faelleKandidaten();
  } else if (art === "dasdass") {
    out = dasDassItems()
      .filter((i) => eintragFehler("das-dass", i).length === 0)
      .flatMap((i) => dasDassKarten(i).map((karte) => ({ karte, stufe: (i.blanks.length > 1 ? 2 : 1) as Stufe, gruppe: karte.loesung })));
  } else if (art === "satzteile") {
    out = hauptsatzGliedsatzItems()
      .filter((i) => eintragFehler("hauptsatz-gliedsatz", i).length === 0)
      .flatMap((i) => satzteilKarten(i).map((karte) => ({ karte, stufe: bankStufe("hauptsatz-gliedsatz", i) ?? 2, gruppe: karte.key.split("#")[0] })));
  } else if (art === "satzbau") {
    out = satzbauKandidaten();
  } else if (art === "vokabeln") {
    // Vokabel-Paare haben keinen festen Vorrat: die Wörter kommen aus den Listen des Schülers (lib/lernspiele.ts)
    out = [];
  } else if (art === "perfekt") {
    out = perfektItems()
      .filter((i) => eintragFehler("perfekt", i).length === 0)
      .flatMap((i) => {
        const karte = perfektKarte(i);
        return karte ? [{ karte, stufe: bankStufe("perfekt", i) ?? 2 }] : [];
      });
  } else {
    out = praeteritumItems()
      .filter((i) => eintragFehler("praeteritum", i).length === 0)
      .flatMap((i) => {
        const karte = praeteritumKarte(i);
        return karte ? [{ karte, stufe: bankStufe("praeteritum", i) ?? 2 }] : [];
      });
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
  // Satzbau: Stufe 1 hat drei Teile, 2 die Satzklammer nach einem anderen Anfang und den Gliedsatz, 3 beides zusammen
  if (art === "satzbau") {
    if (schulstufe <= 4) return lernstand !== null && lernstand >= 0.75 ? [1, 2] : [1];
    if (lernstand !== null && lernstand < 0.5) return [1, 2];
    return lernstand !== null && lernstand >= 0.75 ? [2, 3] : [1, 2, 3];
  }
  if (art === "deklination") return lernstand !== null && lernstand < 0.5 ? [1, 2] : lernstand !== null && lernstand >= 0.75 ? [2, 3] : [1, 2, 3];
  // Perfekt: Stufe 1 hat nur „haben“ (regelmäßige Verben), darum ist Stufe 2 immer dabei
  if (art === "perfekt") return lernstand !== null && lernstand >= 0.75 ? [1, 2, 3] : [1, 2];
  // die übrigen Spiele: unsicher die leichten, sicher auch die schweren
  if (lernstand !== null && lernstand < 0.5) return [0, 1];
  return lernstand !== null && lernstand >= 0.75 ? [1, 2, 3] : [0, 1, 2];
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
  const gruppen = new Set<string>();
  // bei nur zwei Kisten wären genau sechs und sechs zu durchschaubar: bis zu sieben von einer
  const zweiKisten = alle.length > 0 && alle.every((k) => k.karte.faecher.length === 2);
  const grenze = zweiKisten ? Math.ceil(anzahl * 0.58) : Math.ceil(anzahl / 2);
  const nimm = (k: Kandidat) => {
    gewaehlt.push(k.karte);
    genommen.add(k.karte.key);
    if (k.gruppe) gruppen.add(k.gruppe);
    proAntwort.set(k.karte.richtig, (proAntwort.get(k.karte.richtig) ?? 0) + 1);
  };

  for (const key of o.wiederholen ?? []) {
    const k = byKey.get(key);
    if (k && !genommen.has(key) && !(k.gruppe && gruppen.has(k.gruppe)) && gewaehlt.length < Math.min(WIEDERHOLUNGEN_MAX, anzahl)) nimm(k);
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
        if (k.gruppe && gruppen.has(k.gruppe)) continue;
        nimm(k);
      }
      if (gewaehlt.length >= anzahl) break;
    }
    if (gewaehlt.length >= anzahl) break;
  }
  // die Wiederholungen nicht alle vorne: gemischt, aber nie zwei gleiche Wörter nacheinander (gibt es nicht)
  return mischen(gewaehlt, rng);
}
