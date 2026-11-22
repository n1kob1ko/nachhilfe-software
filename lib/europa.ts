/**
 * Europa: Länder, Hauptstädte, Flaggen (niko 2026-11-22: „erstell ein geographie spiel man soll länder und hauptstädte
 * in europa lernen … mit einer karte und antippen“, dann „es soll ganz europa sein und vielleicht auch eine option mit
 * flaggen“). Alle 47 Staaten, die man in der Schule zu Europa zählt (mit Russland, der Türkei, Zypern und dem Kosovo).
 *
 * Je Land drei Teile, die man können muss: **Lage** (wo auf der Karte), **Hauptstadt** und **Flagge**. Ein Land ist
 * „erobert“, wenn alle drei sicher sitzen (`europaStand`). Gespielt wird in components/lernen/EuropaSpiel.tsx auf der
 * Karte aus lib/europa-karte.ts; die Flaggen liegen in public/spiele/europa/flaggen/ (flag-icons, MIT). Kein KI.
 *
 * Jede Karte hat als richtige Antwort einen Namen (Land oder Stadt), auch wenn man auf der Karte tippt oder eine Flagge
 * wählt: so lässt sich jede Wahl gleich prüfen und speichern, und aus falschen Wahlen werden Verwechslungen.
 */
import type { SpielKarte } from "./lernspiele-typen";

export type Rng = () => number;

/** Die Fähigkeit für den Lernstand (nicht aus dem Lehrplan). */
export const EUROPA_SKILL = "geo.europa";

export type Region = "nord" | "west" | "mitte" | "sued" | "suedost" | "ost";
export const REGIONEN: { id: Region; name: string }[] = [
  { id: "mitte", name: "Mitteleuropa" },
  { id: "west", name: "Westeuropa" },
  { id: "nord", name: "Nordeuropa" },
  { id: "sued", name: "Südeuropa" },
  { id: "suedost", name: "Südosteuropa" },
  { id: "ost", name: "Osteuropa" },
];

export type Land = {
  /** ISO-Kürzel, klein (auch der Name der Flagge) */
  code: string;
  name: string;
  /** für „Wo liegt …?“: mit Artikel, wo man einen sagt („die Schweiz“, „der Kosovo“) */
  wo: string;
  /** für „die Hauptstadt …“: „von Österreich“, „der Schweiz“ */
  von: string;
  /** „die Niederlande“: liegen, haben */
  mehrzahl?: true;
  hauptstadt: string;
  /** Länge und Breite der Hauptstadt (für den Punkt auf der Karte) */
  ort: [number, number];
  region: Region;
  /** Nachbarn an Land (nur Länder dieser Liste) */
  nachbarn: string[];
  /** liegt auf einer Insel oder Inselgruppe: statt der Nachbarn steht das da */
  insel?: string;
  /** zählt beim Schreiben auch (andere Namen, die in Büchern stehen) */
  auch?: string[];
  stadtAuch?: string[];
  /** bekannte Städte, die oft für die Hauptstadt gehalten werden (falsche Antworten beim Üben) */
  falle?: string[];
  /** so klein, dass es auf der Karte einen Kreis zum Antippen bekommt */
  klein?: true;
};

export const LAENDER: Land[] = [
  { code: "al", name: "Albanien", wo: "Albanien", von: "von Albanien", hauptstadt: "Tirana", ort: [19.82, 41.33], region: "suedost", nachbarn: ["me", "xk", "mk", "gr"] },
  { code: "ad", name: "Andorra", wo: "Andorra", von: "von Andorra", hauptstadt: "Andorra la Vella", ort: [1.52, 42.51], region: "sued", nachbarn: ["fr", "es"], klein: true },
  { code: "at", name: "Österreich", wo: "Österreich", von: "von Österreich", hauptstadt: "Wien", ort: [16.37, 48.21], region: "mitte", nachbarn: ["de", "cz", "sk", "hu", "si", "it", "ch", "li"], falle: ["Salzburg"] },
  { code: "be", name: "Belgien", wo: "Belgien", von: "von Belgien", hauptstadt: "Brüssel", ort: [4.35, 50.85], region: "west", nachbarn: ["fr", "lu", "de", "nl"], falle: ["Antwerpen"] },
  { code: "ba", name: "Bosnien und Herzegowina", wo: "Bosnien und Herzegowina", von: "von Bosnien und Herzegowina", hauptstadt: "Sarajevo", ort: [18.41, 43.86], region: "suedost", nachbarn: ["hr", "rs", "me"], auch: ["Bosnien-Herzegowina", "Bosnien"] },
  { code: "bg", name: "Bulgarien", wo: "Bulgarien", von: "von Bulgarien", hauptstadt: "Sofia", ort: [23.32, 42.7], region: "suedost", nachbarn: ["ro", "rs", "mk", "gr", "tr"] },
  { code: "by", name: "Belarus", wo: "Belarus", von: "von Belarus", hauptstadt: "Minsk", ort: [27.57, 53.9], region: "ost", nachbarn: ["pl", "lt", "lv", "ru", "ua"], auch: ["Weißrussland"] },
  { code: "ch", name: "Schweiz", wo: "die Schweiz", von: "der Schweiz", hauptstadt: "Bern", ort: [7.45, 46.95], region: "mitte", nachbarn: ["de", "at", "li", "it", "fr"], falle: ["Zürich", "Genf"] },
  { code: "cy", name: "Zypern", wo: "Zypern", von: "von Zypern", hauptstadt: "Nikosia", ort: [33.36, 35.17], region: "sued", nachbarn: [], insel: "eine Insel im östlichen Mittelmeer, südlich der Türkei", stadtAuch: ["Nicosia"] },
  { code: "cz", name: "Tschechien", wo: "Tschechien", von: "von Tschechien", hauptstadt: "Prag", ort: [14.44, 50.08], region: "mitte", nachbarn: ["de", "pl", "sk", "at"], auch: ["Tschechische Republik"], stadtAuch: ["Praha"] },
  { code: "de", name: "Deutschland", wo: "Deutschland", von: "von Deutschland", hauptstadt: "Berlin", ort: [13.4, 52.52], region: "mitte", nachbarn: ["dk", "pl", "cz", "at", "ch", "fr", "lu", "be", "nl"], falle: ["München", "Hamburg"] },
  { code: "dk", name: "Dänemark", wo: "Dänemark", von: "von Dänemark", hauptstadt: "Kopenhagen", ort: [12.57, 55.68], region: "nord", nachbarn: ["de"] },
  { code: "ee", name: "Estland", wo: "Estland", von: "von Estland", hauptstadt: "Tallinn", ort: [24.75, 59.44], region: "nord", nachbarn: ["ru", "lv"] },
  { code: "es", name: "Spanien", wo: "Spanien", von: "von Spanien", hauptstadt: "Madrid", ort: [-3.7, 40.42], region: "sued", nachbarn: ["pt", "fr", "ad"], falle: ["Barcelona"] },
  { code: "fi", name: "Finnland", wo: "Finnland", von: "von Finnland", hauptstadt: "Helsinki", ort: [24.94, 60.17], region: "nord", nachbarn: ["se", "no", "ru"] },
  { code: "fr", name: "Frankreich", wo: "Frankreich", von: "von Frankreich", hauptstadt: "Paris", ort: [2.35, 48.86], region: "west", nachbarn: ["be", "lu", "de", "ch", "it", "mc", "es", "ad"], falle: ["Marseille"] },
  { code: "gb", name: "Vereinigtes Königreich", wo: "das Vereinigte Königreich", von: "des Vereinigten Königreichs", hauptstadt: "London", ort: [-0.13, 51.51], region: "west", nachbarn: ["ie"], auch: ["Großbritannien", "Vereinigte Königreich"] },
  { code: "gr", name: "Griechenland", wo: "Griechenland", von: "von Griechenland", hauptstadt: "Athen", ort: [23.73, 37.98], region: "sued", nachbarn: ["al", "mk", "bg", "tr"] },
  { code: "hr", name: "Kroatien", wo: "Kroatien", von: "von Kroatien", hauptstadt: "Zagreb", ort: [15.98, 45.81], region: "suedost", nachbarn: ["si", "hu", "rs", "ba", "me"], falle: ["Split"] },
  { code: "hu", name: "Ungarn", wo: "Ungarn", von: "von Ungarn", hauptstadt: "Budapest", ort: [19.04, 47.5], region: "mitte", nachbarn: ["at", "sk", "ua", "ro", "rs", "hr", "si"] },
  { code: "ie", name: "Irland", wo: "Irland", von: "von Irland", hauptstadt: "Dublin", ort: [-6.26, 53.35], region: "west", nachbarn: ["gb"] },
  { code: "is", name: "Island", wo: "Island", von: "von Island", hauptstadt: "Reykjavík", ort: [-21.94, 64.15], region: "nord", nachbarn: [], insel: "eine Insel im Nordatlantik, weit im Nordwesten" },
  { code: "it", name: "Italien", wo: "Italien", von: "von Italien", hauptstadt: "Rom", ort: [12.5, 41.9], region: "sued", nachbarn: ["fr", "ch", "at", "si", "sm", "va"], stadtAuch: ["Roma"], falle: ["Mailand"] },
  { code: "xk", name: "Kosovo", wo: "der Kosovo", von: "des Kosovo", hauptstadt: "Pristina", ort: [21.17, 42.66], region: "suedost", nachbarn: ["rs", "me", "al", "mk"], stadtAuch: ["Prishtina"] },
  { code: "lv", name: "Lettland", wo: "Lettland", von: "von Lettland", hauptstadt: "Riga", ort: [24.11, 56.95], region: "nord", nachbarn: ["ee", "lt", "by", "ru"] },
  { code: "li", name: "Liechtenstein", wo: "Liechtenstein", von: "von Liechtenstein", hauptstadt: "Vaduz", ort: [9.52, 47.14], region: "mitte", nachbarn: ["ch", "at"], klein: true },
  { code: "lt", name: "Litauen", wo: "Litauen", von: "von Litauen", hauptstadt: "Vilnius", ort: [25.28, 54.69], region: "nord", nachbarn: ["lv", "by", "pl", "ru"], stadtAuch: ["Wilna"] },
  { code: "lu", name: "Luxemburg", wo: "Luxemburg", von: "von Luxemburg", hauptstadt: "Luxemburg", ort: [6.13, 49.61], region: "west", nachbarn: ["be", "de", "fr"], stadtAuch: ["Luxembourg"], klein: true },
  { code: "mt", name: "Malta", wo: "Malta", von: "von Malta", hauptstadt: "Valletta", ort: [14.51, 35.9], region: "sued", nachbarn: [], insel: "eine kleine Insel im Mittelmeer, südlich von Sizilien", klein: true },
  { code: "md", name: "Moldau", wo: "Moldau", von: "von Moldau", hauptstadt: "Chișinău", ort: [28.86, 47.01], region: "ost", nachbarn: ["ro", "ua"], auch: ["Moldawien", "Republik Moldau", "Moldova"], stadtAuch: ["Kischinau", "Kischinjow"] },
  { code: "mc", name: "Monaco", wo: "Monaco", von: "von Monaco", hauptstadt: "Monaco", ort: [7.42, 43.73], region: "west", nachbarn: ["fr"], klein: true },
  { code: "me", name: "Montenegro", wo: "Montenegro", von: "von Montenegro", hauptstadt: "Podgorica", ort: [19.26, 42.44], region: "suedost", nachbarn: ["hr", "ba", "rs", "xk", "al"] },
  { code: "nl", name: "Niederlande", wo: "die Niederlande", von: "der Niederlande", mehrzahl: true, hauptstadt: "Amsterdam", ort: [4.9, 52.37], region: "west", nachbarn: ["de", "be"], auch: ["Holland"], falle: ["Den Haag", "Rotterdam"] },
  { code: "mk", name: "Nordmazedonien", wo: "Nordmazedonien", von: "von Nordmazedonien", hauptstadt: "Skopje", ort: [21.43, 42.0], region: "suedost", nachbarn: ["rs", "xk", "al", "gr", "bg"], auch: ["Mazedonien"] },
  { code: "no", name: "Norwegen", wo: "Norwegen", von: "von Norwegen", hauptstadt: "Oslo", ort: [10.75, 59.91], region: "nord", nachbarn: ["se", "fi", "ru"], falle: ["Bergen"] },
  { code: "pl", name: "Polen", wo: "Polen", von: "von Polen", hauptstadt: "Warschau", ort: [21.01, 52.23], region: "mitte", nachbarn: ["de", "cz", "sk", "ua", "by", "lt", "ru"], stadtAuch: ["Warszawa"], falle: ["Krakau"] },
  { code: "pt", name: "Portugal", wo: "Portugal", von: "von Portugal", hauptstadt: "Lissabon", ort: [-9.14, 38.72], region: "sued", nachbarn: ["es"], stadtAuch: ["Lisboa"], falle: ["Porto"] },
  { code: "ro", name: "Rumänien", wo: "Rumänien", von: "von Rumänien", hauptstadt: "Bukarest", ort: [26.1, 44.43], region: "suedost", nachbarn: ["hu", "ua", "md", "bg", "rs"] },
  { code: "ru", name: "Russland", wo: "Russland", von: "von Russland", hauptstadt: "Moskau", ort: [37.62, 55.76], region: "ost", nachbarn: ["no", "fi", "ee", "lv", "lt", "pl", "by", "ua"], falle: ["Sankt Petersburg"] },
  { code: "sm", name: "San Marino", wo: "San Marino", von: "von San Marino", hauptstadt: "San Marino", ort: [12.45, 43.94], region: "sued", nachbarn: ["it"], klein: true },
  { code: "se", name: "Schweden", wo: "Schweden", von: "von Schweden", hauptstadt: "Stockholm", ort: [18.07, 59.33], region: "nord", nachbarn: ["no", "fi"] },
  { code: "rs", name: "Serbien", wo: "Serbien", von: "von Serbien", hauptstadt: "Belgrad", ort: [20.45, 44.79], region: "suedost", nachbarn: ["hu", "ro", "bg", "mk", "xk", "me", "ba", "hr"], stadtAuch: ["Beograd"] },
  { code: "sk", name: "Slowakei", wo: "die Slowakei", von: "der Slowakei", hauptstadt: "Bratislava", ort: [17.11, 48.15], region: "mitte", nachbarn: ["cz", "pl", "ua", "hu", "at"], stadtAuch: ["Pressburg"] },
  { code: "si", name: "Slowenien", wo: "Slowenien", von: "von Slowenien", hauptstadt: "Ljubljana", ort: [14.51, 46.06], region: "mitte", nachbarn: ["it", "at", "hu", "hr"], stadtAuch: ["Laibach"] },
  { code: "tr", name: "Türkei", wo: "die Türkei", von: "der Türkei", hauptstadt: "Ankara", ort: [32.86, 39.93], region: "suedost", nachbarn: ["gr", "bg"], falle: ["Istanbul"] },
  { code: "ua", name: "Ukraine", wo: "die Ukraine", von: "der Ukraine", hauptstadt: "Kiew", ort: [30.52, 50.45], region: "ost", nachbarn: ["by", "ru", "pl", "sk", "hu", "ro", "md"], stadtAuch: ["Kyjiw", "Kyiv", "Kiev"] },
  { code: "va", name: "Vatikanstadt", wo: "die Vatikanstadt", von: "der Vatikanstadt", hauptstadt: "Vatikanstadt", ort: [12.45, 41.9], region: "sued", nachbarn: ["it"], auch: ["Vatikan", "Vatikanstaat"], stadtAuch: ["Vatikan"], klein: true },
];

const NACH_CODE = new Map(LAENDER.map((l) => [l.code, l]));
const NACH_NAME = new Map(LAENDER.map((l) => [l.name, l]));
const NACH_STADT = new Map(LAENDER.map((l) => [l.hauptstadt, l]));
export const land = (code: string): Land | undefined => NACH_CODE.get(code);
export const landVonName = (name: string): Land | undefined => NACH_NAME.get(name);
/** Das Land zu einer Antwort: Ländername oder Hauptstadt (bei Monaco, San Marino, Luxemburg, Vatikanstadt dasselbe). */
export const landVonAntwort = (wert: string): Land | undefined => NACH_NAME.get(wert) ?? NACH_STADT.get(wert);
/** Die Flagge: einfache als SVG, die mit Wappen als kleines WebP (scripts/europa-karte.mjs). */
const FLAGGE_WEBP = new Set(["ad", "hr", "mt", "md", "me", "sm", "rs", "es", "va"]);
export const flagge = (code: string) => `/spiele/europa/flaggen/${code}.${FLAGGE_WEBP.has(code) ? "webp" : "svg"}`;

/** „Wo liegt die Schweiz?“, „Wo liegen die Niederlande?“ */
export const woLiegt = (l: Land) => `Wo ${l.mehrzahl ? "liegen" : "liegt"} ${l.wo}?`;
/** Großer Anfangsbuchstabe („Die Schweiz grenzt …“). */
export const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const TEILE = ["lage", "hauptstadt", "flagge"] as const;
export type Teil = (typeof TEILE)[number];
export const TEIL_NAME: Record<Teil, string> = { lage: "Lage", hauptstadt: "Hauptstadt", flagge: "Flagge" };

/**
 * Wie gefragt wird:
 * - `wo`: „Wo liegt Ungarn?“, man tippt auf der Karte (Lage)
 * - `welches`: ein Land leuchtet auf der Karte, man nennt es (Lage)
 * - `stadt`: „Wie heißt die Hauptstadt von Ungarn?“ (Hauptstadt)
 * - `stadtWo`: „Budapest ist die Hauptstadt von …“, man tippt das Land auf der Karte (Hauptstadt)
 * - `flaggeLand`: eine Flagge, man nennt das Land oder tippt es auf der Karte (Flagge)
 * - `landFlagge`: „Welche Flagge hat Ungarn?“, vier Flaggen zur Wahl (Flagge)
 */
export type FrageArt = "wo" | "welches" | "stadt" | "stadtWo" | "flaggeLand" | "landFlagge";
/** Wie geantwortet wird: auf der Karte tippen, eine von vier Kacheln, eine von vier Flaggen, selbst schreiben. */
export type AntwortArt = "karte" | "kacheln" | "flaggen" | "schreiben";

/**
 * - `ueben`: gemischt, mit Kacheln und der Karte
 * - `test`: wie im Test, Namen und Städte selbst schreiben
 * - `gross`: großer Test, jedes Land einmal, mit Note
 * - `rennen`: 60 Sekunden, so viele wie möglich
 * - `verwechsler`: Paare, die man verwechselt, direkt nebeneinander
 * - `duell`: zwei Schüler, dieselben Karten (lib/duelle.ts)
 */
export type EuropaModus = "ueben" | "test" | "gross" | "rennen" | "verwechsler" | "duell";
export type EuropaThema = Teil | "alles";

/** Was die Karte zum Land mitbringt (SpielKarte.europa). */
export type EuropaDaten = { land: string; teil: Teil; frage: FrageArt; antwort: AntwortArt; modus: EuropaModus; thema?: EuropaThema; tipp?: string };

export const europaKey = (code: string, teil: Teil) => `europa:${code}:${teil}`;
export function vonKey(key: string): { code: string; teil: Teil } | null {
  const m = /^europa:([a-z]{2}):(lage|hauptstadt|flagge)$/.exec(key);
  return m && land(m[1]) ? { code: m[1], teil: m[2] as Teil } : null;
}

/** So viele Länder hat eine Runde zum Üben (je drei Karten). */
export const LAENDER_JE_RUNDE = 8;
/** So viele Antworten stehen beim Üben zur Wahl. */
export const KACHELN = 4;
/** Ein Teil sitzt, wenn er so oft hintereinander beim ersten Versuch stimmte. */
export const SICHER_NACH = 2;
/** So lange dauert ein Rennen. */
export const RENNEN_SEKUNDEN = 60;

// ---------- Flaggen, die man leicht verwechselt ----------

/** Gruppen ähnlicher Flaggen: daraus kommen beim Üben die falschen Flaggen. */
export const FLAGGEN_AEHNLICH: string[][] = [
  ["ru", "sk", "si", "rs"],
  ["pl", "mc", "at", "lv"],
  ["it", "ie", "fr", "hu"],
  ["ro", "md", "ad", "be"],
  ["nl", "lu", "hr", "fr"],
  ["dk", "no", "is", "se", "fi", "ch"],
  ["de", "be", "lt"],
  ["hu", "bg", "it"],
  ["cy", "xk", "ba"],
  ["al", "me", "mt"],
  ["ua", "se", "va"],
  ["gr", "fi", "is"],
  ["tr", "ch", "dk", "al"],
  ["mk", "es", "md"],
  ["sm", "ee", "gr"],
  ["gb", "is", "no"],
  ["by", "lt", "pt"],
];

/** Paare, die viele verwechseln, mit einer Merkhilfe. Ohne eigene Verwechslungen übt „Verwechsler“ diese. */
export const TYPISCHE_PAARE: { teil: Teil; a: string; b: string; tipp: string }[] = [
  { teil: "lage", a: "sk", b: "si", tipp: "Die Slowakei liegt nördlich von Ungarn. Slowenien liegt südlich von Österreich und hat ein Stück Meer." },
  { teil: "lage", a: "lv", b: "lt", tipp: "Von Norden nach Süden wie im Alphabet: Estland, Lettland, Litauen." },
  { teil: "lage", a: "ee", b: "lv", tipp: "Von Norden nach Süden wie im Alphabet: Estland, Lettland, Litauen." },
  { teil: "lage", a: "nl", b: "be", tipp: "Die Niederlande liegen nördlich von Belgien." },
  { teil: "lage", a: "me", b: "mk", tipp: "Montenegro liegt am Meer. Nordmazedonien hat kein Meer und liegt nördlich von Griechenland." },
  { teil: "lage", a: "hr", b: "rs", tipp: "Kroatien liegt wie ein Bogen an der Adria. Serbien hat kein Meer." },
  { teil: "lage", a: "md", b: "ro", tipp: "Moldau ist das kleine Land zwischen Rumänien und der Ukraine." },
  { teil: "hauptstadt", a: "sk", b: "si", tipp: "Slowakei: Bratislava. Slowenien: Ljubljana." },
  { teil: "hauptstadt", a: "lv", b: "lt", tipp: "Lettland: Riga. Litauen: Vilnius." },
  { teil: "hauptstadt", a: "hu", b: "ro", tipp: "Ungarn: Budapest. Rumänien: Bukarest. Beide beginnen mit B und enden auf -est." },
  { teil: "hauptstadt", a: "ee", b: "fi", tipp: "Estland: Tallinn. Finnland: Helsinki. Die beiden Städte liegen sich über das Meer gegenüber." },
  { teil: "hauptstadt", a: "rs", b: "hr", tipp: "Serbien: Belgrad. Kroatien: Zagreb." },
  { teil: "hauptstadt", a: "mk", b: "me", tipp: "Nordmazedonien: Skopje. Montenegro: Podgorica." },
  { teil: "hauptstadt", a: "bg", b: "ro", tipp: "Bulgarien: Sofia. Rumänien: Bukarest." },
  { teil: "flagge", a: "ro", b: "md", tipp: "Blau, Gelb, Rot: Moldau hat in der Mitte ein Wappen mit Adler, Rumänien nicht." },
  { teil: "flagge", a: "pl", b: "mc", tipp: "Polen: oben Weiß, unten Rot. Monaco: oben Rot, unten Weiß." },
  { teil: "flagge", a: "it", b: "ie", tipp: "Italien: Grün, Weiß, Rot. Irland: Grün, Weiß, Orange." },
  { teil: "flagge", a: "nl", b: "lu", tipp: "Luxemburg hat unten Hellblau, die Niederlande Dunkelblau." },
  { teil: "flagge", a: "sk", b: "si", tipp: "Weiß, Blau, Rot: die Slowakei hat ein großes Wappen mit Doppelkreuz, Slowenien ein kleines mit Berg und Sternen." },
  { teil: "flagge", a: "ru", b: "sk", tipp: "Weiß, Blau, Rot: Russland hat kein Wappen, die Slowakei ein großes mit Doppelkreuz." },
  { teil: "flagge", a: "at", b: "lv", tipp: "Österreich: helles Rot, der weiße Streifen ist gleich breit. Lettland: dunkles Weinrot, schmaler weißer Streifen." },
  { teil: "flagge", a: "no", b: "is", tipp: "Norwegen: rot mit blauem Kreuz. Island: blau mit rotem Kreuz." },
  { teil: "flagge", a: "hu", b: "bg", tipp: "Ungarn: oben Rot, unten Grün. Bulgarien: oben Weiß, unten Rot." },
  { teil: "flagge", a: "dk", b: "ch", tipp: "Dänemark: das weiße Kreuz ist zur Seite verschoben. Schweiz: kurzes weißes Kreuz in der Mitte." },
];

/** Die Merkhilfe zu einem Paar (egal in welcher Reihenfolge). */
export function paarTipp(teil: Teil, a: string, b: string): string | undefined {
  return TYPISCHE_PAARE.find((p) => p.teil === teil && ((p.a === a && p.b === b) || (p.a === b && p.b === a)))?.tipp;
}

// ---------- Karten ----------

function mische<T>(a: T[], rng: Rng): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Wählt nach Gewicht: [[wert, gewicht], …] */
function nachGewicht<T>(liste: [T, number][], rng: Rng): T {
  const summe = liste.reduce((s, [, g]) => s + g, 0);
  let r = rng() * summe;
  for (const [w, g] of liste) {
    r -= g;
    if (r < 0) return w;
  }
  return liste[liste.length - 1][0];
}

/** Die Länder, die für die falschen Antworten zu einem Land am besten passen (die schwersten zuerst). */
function aehnliche(l: Land, teil: Teil, verwechselt: string[]): string[] {
  const flaggen = FLAGGEN_AEHNLICH.filter((g) => g.includes(l.code)).flat();
  const typisch = TYPISCHE_PAARE.filter((p) => p.teil === teil && (p.a === l.code || p.b === l.code)).map((p) => (p.a === l.code ? p.b : p.a));
  const nah = teil === "flagge" ? flaggen : [...l.nachbarn, ...LAENDER.filter((x) => x.region === l.region).map((x) => x.code)];
  return [...new Set([...verwechselt, ...typisch, ...nah])].filter((c) => c !== l.code && land(c));
}

/**
 * Die Antworten zur Wahl: die richtige und `anzahl - 1` falsche. Zuerst die, die der Schüler schon verwechselt hat,
 * dann typische Verwechsler, dann Nachbarn oder ähnliche Flaggen, dann irgendein Land. Bei der Hauptstadt kann eine
 * „Falle“ dabei sein (Zürich für die Schweiz). Nie zweimal dasselbe.
 */
export function wahlFuer(l: Land, frage: FrageArt, rng: Rng, o: { anzahl?: number; verwechselt?: string[]; nur?: string[] } = {}): string[] {
  const anzahl = o.anzahl ?? KACHELN;
  const teil = teilVon(frage);
  const stadt = frage === "stadt";
  const wert = (x: Land) => (stadt ? x.hauptstadt : x.name);
  const richtig = wert(l);
  if (o.nur) return mische([richtig, ...o.nur.map((c) => land(c)).filter((x): x is Land => !!x).map(wert)].filter((w, i, a) => a.indexOf(w) === i), rng);
  const falsch: string[] = [];
  const nimm = (w: string | undefined) => {
    if (w && falsch.length < anzahl - 1 && w !== richtig && !falsch.includes(w)) falsch.push(w);
  };
  const nahe = aehnliche(l, teil, o.verwechselt ?? []);
  // die eigenen Verwechsler immer, dann zwei aus den ähnlichen, gemischt
  for (const c of (o.verwechselt ?? []).slice(0, 2)) nimm(wert(land(c)!));
  if (stadt && l.falle?.length && rng() < 0.5) nimm(l.falle[Math.floor(rng() * l.falle.length)]);
  for (const c of mische(nahe.slice(0, 6), rng)) nimm(wert(land(c)!));
  for (const x of mische(LAENDER, rng)) nimm(wert(x));
  return mische([richtig, ...falsch], rng);
}

export const teilVon = (frage: FrageArt): Teil => (frage === "wo" || frage === "welches" ? "lage" : frage === "stadt" || frage === "stadtWo" ? "hauptstadt" : "flagge");

/** Welche Frage und welche Antwort für einen Teil, je nach Modus. */
export function frageFuer(teil: Teil, modus: EuropaModus, rng: Rng): { frage: FrageArt; antwort: AntwortArt } {
  if (modus === "test" || modus === "gross") {
    if (teil === "lage") return modus === "gross" || rng() < 0.5 ? { frage: "welches", antwort: "schreiben" } : { frage: "wo", antwort: "karte" };
    if (teil === "hauptstadt") return { frage: "stadt", antwort: "schreiben" };
    return { frage: "flaggeLand", antwort: "schreiben" };
  }
  if (modus === "rennen") {
    if (teil === "lage") return { frage: "wo", antwort: "karte" };
    if (teil === "hauptstadt") return { frage: "stadt", antwort: "kacheln" };
    return { frage: "flaggeLand", antwort: "kacheln" };
  }
  if (teil === "lage")
    return nachGewicht<{ frage: FrageArt; antwort: AntwortArt }>(
      [
        [{ frage: "wo", antwort: "karte" }, 5],
        [{ frage: "welches", antwort: "kacheln" }, 5],
      ],
      rng,
    );
  if (teil === "hauptstadt")
    return nachGewicht<{ frage: FrageArt; antwort: AntwortArt }>(
      [
        [{ frage: "stadt", antwort: "kacheln" }, 7],
        [{ frage: "stadtWo", antwort: "karte" }, 3],
      ],
      rng,
    );
  return nachGewicht<{ frage: FrageArt; antwort: AntwortArt }>(
    [
      [{ frage: "flaggeLand", antwort: "kacheln" }, 4],
      [{ frage: "flaggeLand", antwort: "karte" }, 2],
      [{ frage: "landFlagge", antwort: "flaggen" }, 4],
    ],
    rng,
  );
}

/** Die Frage als Satz (für Karte, Ende und den Lehrer). */
export function frageText(l: Land, frage: FrageArt): string {
  switch (frage) {
    case "wo":
      return woLiegt(l);
    case "welches":
      return "Welches Land leuchtet?";
    case "stadt":
      return `Wie heißt die Hauptstadt ${l.von}?`;
    case "stadtWo":
      return `${l.hauptstadt} ist die Hauptstadt von …`;
    case "flaggeLand":
      return "Zu welchem Land gehört diese Flagge?";
    case "landFlagge":
      return `Welche Flagge ${l.mehrzahl ? "haben" : "hat"} ${l.wo}?`;
  }
}

/** Was nach einem Fehler hilft: die Nachbarn, die Insel, die Hauptstadt, eine Merkhilfe. */
export function lageText(l: Land): string {
  if (l.insel) return `${gross(l.wo)} ${l.mehrzahl ? "sind" : "ist"} ${l.insel}.`;
  const n = l.nachbarn.map((c) => land(c)!.name);
  if (n.length === 1) return `${gross(l.wo)} ${l.mehrzahl ? "grenzen" : "grenzt"} nur an ${n[0]}.`;
  const liste = `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
  return `${gross(l.wo)} ${l.mehrzahl ? "grenzen" : "grenzt"} an ${liste}.`;
}

/** Eine Karte zu einem Land und Teil. `verwechselt`: Länder, die der Schüler damit schon verwechselt hat. */
export function europaKarte(code: string, teil: Teil, modus: EuropaModus, rng: Rng, o: { verwechselt?: string[]; frage?: { frage: FrageArt; antwort: AntwortArt }; nur?: string[]; thema?: EuropaThema; tipp?: string } = {}): SpielKarte | null {
  const l = land(code);
  if (!l) return null;
  const f = o.frage ?? frageFuer(teil, modus, rng);
  const richtig = f.frage === "stadt" ? l.hauptstadt : l.name;
  const faecher = f.antwort === "kacheln" || f.antwort === "flaggen" ? wahlFuer(l, f.frage, rng, { verwechselt: o.verwechselt, nur: o.nur }) : [richtig];
  return {
    key: europaKey(code, teil),
    skill: EUROPA_SKILL,
    vor: "",
    nach: "",
    faecher,
    richtig,
    loesung: teil === "hauptstadt" ? `${l.name}: ${l.hauptstadt}` : l.name,
    regel: teil === "hauptstadt" ? `Die Hauptstadt ${l.von} ist ${l.hauptstadt}.` : lageText(l),
    europa: { land: code, teil, frage: f.frage, antwort: f.antwort, modus, thema: o.thema, tipp: o.tipp },
  };
}

/**
 * Eine Runde zum Üben oder wie im Test: je Land drei Karten (Lage, Hauptstadt, Flagge), so gemischt, dass dasselbe Land
 * nicht direkt hintereinander kommt (sonst verrät die eine Karte die andere).
 */
export function europaRunde(codes: string[], modus: "ueben" | "test", rng: Rng, verwechselt: Map<string, string[]> = new Map()): SpielKarte[] {
  const karten: SpielKarte[] = [];
  for (const code of codes)
    for (const teil of TEILE) {
      const k = europaKarte(code, teil, modus, rng, { verwechselt: verwechselt.get(`${code}:${teil}`) });
      if (k) karten.push(k);
    }
  return abstandHalten(mische(karten, rng), 2);
}

/**
 * Ordnet so um, dass zwischen zwei Karten desselben Landes mindestens `abstand` andere liegen (so gut es geht): als
 * Nächstes kommt das Land mit den meisten übrigen Karten, das gerade nicht dran war (sonst bleiben am Ende nur Karten
 * eines Landes übrig). Die Reihenfolge innerhalb gleich vieler bleibt.
 */
export function abstandHalten(karten: SpielKarte[], abstand: number): SpielKarte[] {
  const rest = [...karten];
  const out: SpielKarte[] = [];
  const zahl = (c: string | undefined) => rest.filter((k) => k.europa?.land === c).length;
  while (rest.length) {
    const zuletzt = out.slice(-abstand).map((k) => k.europa?.land);
    let beste = -1;
    for (let i = 0; i < rest.length; i++) {
      if (zuletzt.includes(rest[i].europa?.land)) continue;
      if (beste < 0 || zahl(rest[i].europa?.land) > zahl(rest[beste].europa?.land)) beste = i;
    }
    out.push(...rest.splice(beste < 0 ? 0 : beste, 1));
  }
  return out;
}

/** Der große Test: jedes Land (der Auswahl) einmal; bei „alles“ wechselt der Teil reihum. */
export function grosserTest(codes: string[], thema: EuropaThema, rng: Rng): SpielKarte[] {
  const reihenfolge = mische(codes, rng);
  const teile = mische([...TEILE], rng);
  return reihenfolge
    .map((code, i) => europaKarte(code, thema === "alles" ? teile[i % 3] : thema, "gross", rng, { thema }))
    .filter((k): k is SpielKarte => !!k);
}

/** Ein Rennen: alle Länder gemischt, dann noch einmal (so viele schafft niemand in 60 Sekunden). */
export function rennenKarten(thema: Teil, rng: Rng, codes: string[] = LAENDER.map((l) => l.code)): SpielKarte[] {
  const reihe = [...mische(codes, rng), ...mische(codes, rng)].slice(0, 90);
  // dasselbe Land nicht zweimal am Stück (an der Naht)
  for (let i = 1; i < reihe.length; i++) if (reihe[i] === reihe[i - 1]) [reihe[i], reihe[(i + 5) % reihe.length]] = [reihe[(i + 5) % reihe.length], reihe[i]];
  // gleiche Keys sind in einer Runde nicht erlaubt (Antworten werden je Key gezählt): die zweite Runde hängt „~2“ an
  const gesehen = new Set<string>();
  return reihe
    .map((code) => europaKarte(code, thema, "rennen", rng, { thema }))
    .filter((k): k is SpielKarte => !!k)
    .map((k) => {
      if (gesehen.has(k.key)) return { ...k, key: `${k.key}~2` };
      gesehen.add(k.key);
      return k;
    });
}

/** Ein Paar, das der Schüler verwechselt (oder ein typisches): beide Länder, ein Teil. */
export type Paar = { teil: Teil; a: string; b: string; mal: number; tipp?: string };

/**
 * Verwechsler üben: je Paar beide Länder im verwechselten Teil, nur die beiden als Antworten (bei der Lage tippt man auf
 * der Karte). Höchstens sechs Paare; jedes Land und jeder Teil einmal.
 */
export function verwechslerKarten(paare: Paar[], rng: Rng): SpielKarte[] {
  const karten: SpielKarte[] = [];
  const keys = new Set<string>();
  for (const p of paare.slice(0, 6)) {
    for (const [code, anderer] of [
      [p.a, p.b],
      [p.b, p.a],
    ]) {
      const key = europaKey(code, p.teil);
      if (keys.has(key)) continue;
      const frage: { frage: FrageArt; antwort: AntwortArt } =
        p.teil === "lage" ? { frage: "wo", antwort: "karte" } : p.teil === "hauptstadt" ? { frage: "stadt", antwort: "kacheln" } : rng() < 0.5 ? { frage: "landFlagge", antwort: "flaggen" } : { frage: "flaggeLand", antwort: "kacheln" };
      const k = europaKarte(code, p.teil, "verwechsler", rng, { frage, nur: [anderer], tipp: p.tipp ?? paarTipp(p.teil, p.a, p.b) });
      if (k) {
        keys.add(key);
        karten.push(k);
      }
    }
  }
  // die zwei Karten eines Paars nicht direkt hintereinander, aber nah beieinander
  return abstandHalten(mische(karten, rng), 1);
}

// ---------- Stand: was sitzt, was ist erobert ----------

/** Was der Schüler über einen Teil eines Landes schon kann. */
export type TeilStand = { gesehen: number; sicher: boolean; zuletzt: number; letztesMalRichtig: boolean };

/**
 * Der Stand je Key (`europa:at:lage`) aus den beendeten Runden (älteste zuerst). Zählt die erste Wahl; sicher nach
 * `SICHER_NACH` richtigen Runden hintereinander. Rennen zählen mit („~2“ ist dieselbe Karte).
 */
export function europaStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Map<string, TeilStand> {
  const verlauf = new Map<string, { ergebnisse: boolean[]; zuletzt: number }>();
  runden.forEach((r, i) => {
    const je = new Map<string, boolean>();
    for (const a of r.antworten) {
      const key = a.key.replace(/~\d+$/, "");
      if (!vonKey(key)) continue;
      je.set(key, (je.get(key) ?? true) && a.richtig);
    }
    for (const [key, ok] of je) {
      const v = verlauf.get(key) ?? { ergebnisse: [], zuletzt: 0 };
      v.ergebnisse.push(ok);
      v.zuletzt = i + 1;
      verlauf.set(key, v);
    }
  });
  const out = new Map<string, TeilStand>();
  for (const [key, v] of verlauf) {
    const letzte = v.ergebnisse.slice(-SICHER_NACH);
    out.set(key, { gesehen: v.ergebnisse.length, sicher: letzte.length === SICHER_NACH && letzte.every(Boolean), zuletzt: v.zuletzt, letztesMalRichtig: v.ergebnisse[v.ergebnisse.length - 1] });
  }
  return out;
}

/** Je Land, welche Teile sitzen (für die Karte „erobert“). */
export type LandStand = Record<string, Teil[]>;
export function sitzt(stand: Map<string, TeilStand>): LandStand {
  const out: LandStand = {};
  for (const l of LAENDER) {
    const t = TEILE.filter((teil) => stand.get(europaKey(l.code, teil))?.sicher);
    if (t.length) out[l.code] = t;
  }
  return out;
}
export const erobert = (s: LandStand) => Object.values(s).filter((t) => t.length === 3).length;

/**
 * Welche Länder in die nächste Runde kommen: zuerst die mit zuletzt falschen Karten (`wiederholen`), dann die noch nicht
 * eroberten (die nie gesehenen und am längsten nicht gesehenen zuerst), dann die eroberten, die am längsten her sind.
 */
export function waehleLaender(stand: Map<string, TeilStand>, o: { anzahl: number; wiederholen?: string[]; codes?: string[]; rng: Rng }): string[] {
  const alle = mische(o.codes ?? LAENDER.map((l) => l.code), o.rng);
  const zuletzt = (c: string) => Math.max(...TEILE.map((t) => stand.get(europaKey(c, t))?.zuletzt ?? 0));
  const offen = (c: string) => TEILE.filter((t) => !stand.get(europaKey(c, t))?.sicher).length;
  const nichtErobert = alle.filter((c) => offen(c) > 0).sort((a, b) => zuletzt(a) - zuletzt(b));
  const fertig = alle.filter((c) => offen(c) === 0).sort((a, b) => zuletzt(a) - zuletzt(b));
  const out: string[] = [];
  for (const c of [...(o.wiederholen ?? []), ...nichtErobert, ...fertig]) if (alle.includes(c) && !out.includes(c) && out.length < o.anzahl) out.push(c);
  return mische(out, o.rng);
}

/**
 * Verwechslungen aus den beendeten Runden: wer auf eine Karte zu Land A zuerst Land B (oder Bs Hauptstadt) gewählt hat,
 * hat A und B verwechselt. Je Paar und Teil gezählt, die häufigsten und neuesten zuerst. Paare, die seither zweimal
 * hintereinander richtig waren, fallen weg.
 */
export function verwechslungen(runden: { karten: { key: string; europa?: { land: string } }[]; antworten: { key: string; wahl: string; richtig: boolean }[] }[], stand: Map<string, TeilStand>): Paar[] {
  const zaehler = new Map<string, Paar & { zuletzt: number }>();
  runden.forEach((r, i) => {
    for (const a of r.antworten) {
      if (a.richtig) continue;
      const k = vonKey(a.key.replace(/~\d+$/, ""));
      const anderes = landVonAntwort(a.wahl);
      if (!k || !anderes || anderes.code === k.code) continue;
      const [x, y] = [k.code, anderes.code].sort();
      const id = `${k.teil}:${x}:${y}`;
      const z = zaehler.get(id) ?? { teil: k.teil, a: x, b: y, mal: 0, zuletzt: 0 };
      z.mal++;
      z.zuletzt = i;
      zaehler.set(id, z);
    }
  });
  return [...zaehler.values()]
    .filter((p) => !(stand.get(europaKey(p.a, p.teil))?.sicher && stand.get(europaKey(p.b, p.teil))?.sicher))
    .sort((p, q) => q.mal - p.mal || q.zuletzt - p.zuletzt)
    .map(({ teil, a, b, mal }) => ({ teil, a, b, mal, tipp: paarTipp(teil, a, b) }));
}

/** Je `code:teil` die Länder, die damit verwechselt wurden (für die falschen Antworten beim Üben). */
export function verwechseltMit(paare: Paar[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (k: string, c: string) => out.set(k, [...(out.get(k) ?? []), c]);
  for (const p of paare) {
    add(`${p.a}:${p.teil}`, p.b);
    add(`${p.b}:${p.teil}`, p.a);
  }
  return out;
}

// ---------- Note beim großen Test ----------

/** Österreichische Notenstufen nach Prozent (wie bei vielen Tests in der Schule). */
export function note(richtig: number, anzahl: number): { note: 1 | 2 | 3 | 4 | 5; wort: string } {
  const p = anzahl ? richtig / anzahl : 0;
  if (p >= 0.9) return { note: 1, wort: "Sehr gut" };
  if (p >= 0.8) return { note: 2, wort: "Gut" };
  if (p >= 0.65) return { note: 3, wort: "Befriedigend" };
  if (p >= 0.5) return { note: 4, wort: "Genügend" };
  return { note: 5, wort: "Nicht genügend" };
}

// ---------- Schreiben wie im Test ----------

/** Für den Vergleich: klein, ä = ae, Akzente weg (Reykjavík = Reykjavik), ß = ss, ohne Leerzeichen und Bindestriche. */
export const normal = (s: string) =>
  s
    .toLocaleLowerCase("de-AT")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Stimmt das Geschriebene? „richtig“: genau, oder ein anderer gültiger Name („Holland“, „Weißrussland“, „Kyjiw“).
 * „fast“: ein, bei langen Wörtern zwei Buchstaben daneben („Tallin“, „Lisabon“): zählt, aber die Schreibweise wird
 * gezeigt. Ein anderes Land oder eine andere Hauptstadt ist nie „fast“ (Slowakei ≠ Slowenien).
 */
export function pruefeGeschrieben(eingabe: string, l: Land, was: "land" | "stadt"): "richtig" | "fast" | "falsch" {
  const e = normal(eingabe);
  if (!e) return "falsch";
  const gueltig = (was === "land" ? [l.name, ...(l.auch ?? [])] : [l.hauptstadt, ...(l.stadtAuch ?? [])]).map(normal);
  if (gueltig.includes(e)) return "richtig";
  const andere = LAENDER.filter((x) => x.code !== l.code)
    .flatMap((x) => (was === "land" ? [x.name, ...(x.auch ?? [])] : [x.hauptstadt, ...(x.stadtAuch ?? []), ...(x.falle ?? [])]))
    .map(normal)
    .filter((x) => !gueltig.includes(x));
  if (andere.includes(e)) return "falsch";
  const d = Math.min(...gueltig.map((g) => abstand(e, g)));
  const r = gueltig[0];
  const erlaubt = r.length >= 10 ? 2 : r.length >= 5 ? 1 : 0;
  if (andere.some((x) => abstand(e, x) < d)) return "falsch";
  return d <= erlaubt ? "fast" : "falsch";
}

/** Welches Land war gemeint, wenn etwas Falsches geschrieben wurde (für die Verwechslungen)? Sonst der Text. */
export function geschriebenAls(eingabe: string, was: "land" | "stadt"): string {
  const e = normal(eingabe);
  for (const x of LAENDER) {
    const namen = was === "land" ? [x.name, ...(x.auch ?? [])] : [x.hauptstadt, ...(x.stadtAuch ?? [])];
    if (namen.some((n) => normal(n) === e)) return was === "land" ? x.name : x.hauptstadt;
  }
  return eingabe.trim().slice(0, 40);
}
