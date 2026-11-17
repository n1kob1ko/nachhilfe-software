/**
 * Das Lernspiel „Stilmittel“ (niko 2026-11-17: „ich möchte ein spiel für deutsch um stilmittel zu üben. es sollen sätze
 * kommen und man soll auswählen was das für ein stilmittel ist“). Ein Satz erscheint, die Stelle mit dem Stilmittel ist
 * angestrichen, darunter stehen vier Namen als Kacheln; ein Tipp zählt sofort. Dieselben Karten gehen in Blockwerk,
 * Funkelfeld, Torlauf, Endlos und Duelle wie jedes andere Spiel.
 *
 * - **Welche Stilmittel**: je Schulstufe die, die bis dahin dran waren (`ab`): in der 1. Klasse Vergleich, Metapher,
 *   Personifikation, Lautmalerei und Alliteration, bis zur Oberstufe 27 Stilmittel (die letzten fünf für die
 *   Textinterpretation: Wiederholung, Aufzählung, Parataxe, Hypotaxe, Symbol). Jede Regel nennt auch die Wirkung. Falsche Antworten sind nur
 *   Stilmittel, die der Schüler schon kennt, zuerst die, die man gern verwechselt (`verwechselt`).
 * - **Nie eine richtige Antwort als falsche**: viele Sätze haben mehr als ein Stilmittel („Ich kam, ich sah, ich siegte“
 *   ist Anapher, Parallelismus und Klimax). Was in einem Stilmittel meistens mitsteckt (`auch`), was im Satz zusätzlich
 *   steckt (` || ` in lib/stilmittel-saetze.ts) und was sich am Satz erkennen lässt (ein „wie“, ein Fragezeichen, gleiche
 *   Anlaute, gleiche Anfänge oder Enden der Satzteile), kommt nie als falsche Antwort.
 * - **Lernstand**: in der Unterstufe zählt jede Karte für „Sprachliche Bilder“ (deutsch.literatur.sprachbilder, die eine
 *   Fähigkeit des Lehrplans dazu); in der Oberstufe für ihre Gruppe: Klangfiguren, Satzfiguren, Gedankenfiguren oder
 *   bildhafte Sprache (deutsch.os.stil.*). Eine Runde mit gemischten Karten zählt je Fähigkeit (lib/lernspiele.ts
 *   `spielBelege`).
 *
 * Nur Reines (keine Datenbank), damit es sich testen lässt.
 */
import type { Stufe } from "./banken-regeln";
import type { Kandidat } from "./lernspiele-karten";
import { festerZufall, zahlAus, type SpielKarte } from "./lernspiele-typen";
import { STILMITTEL_SAETZE } from "./stilmittel-saetze";

export const STILMITTEL_IDS = [
  "vergleich",
  "personifikation",
  "metapher",
  "lautmalerei",
  "alliteration",
  "hyperbel",
  "rhetorisch",
  "anapher",
  "ironie",
  "antithese",
  "klimax",
  "parallelismus",
  "ellipse",
  "euphemismus",
  "oxymoron",
  "chiasmus",
  "epipher",
  "litotes",
  "inversion",
  "synaesthesie",
  "metonymie",
  "paradoxon",
  "wiederholung",
  "aufzaehlung",
  "parataxe",
  "hypotaxe",
  "symbol",
] as const;
export type StilmittelId = (typeof STILMITTEL_IDS)[number];

/** Die Gruppen der Oberstufe, je eine Fähigkeit im Lehrplan (lib/themen/deutsch-oberstufe.ts). */
export const STIL_GRUPPEN = {
  bilder: { skill: "deutsch.os.stil.bilder", name: "Bildhafte Sprache" },
  klang: { skill: "deutsch.os.stil.klang", name: "Klang- und Wiederholungsfiguren" },
  satz: { skill: "deutsch.os.stil.satzfiguren", name: "Satzfiguren" },
  gedanken: { skill: "deutsch.os.stil.gedankenfiguren", name: "Gedankenfiguren" },
} as const;
export type StilGruppe = keyof typeof STIL_GRUPPEN;

/** Die eine Fähigkeit der Unterstufe zu Stilmitteln. */
export const STIL_UNTERSTUFE = "deutsch.literatur.sprachbilder";
/** Ab dieser Schulstufe zählen die Karten für die Gruppen der Oberstufe. */
export const STIL_OBERSTUFE_AB = 9;

export type Stilmittel = {
  id: StilmittelId;
  /** so steht es auf der Kachel */
  name: string;
  /** ab dieser Schulstufe im Spiel */
  ab: number;
  gruppe: StilGruppe;
  /** die Regel, die nach einem Fehler erscheint */
  merke: string;
  /** falsche Antworten, die gut passen, weil man sie gern verwechselt (in dieser Reihenfolge) */
  verwechselt: StilmittelId[];
  /** was in solchen Sätzen meistens mitsteckt: nie eine falsche Antwort */
  auch: StilmittelId[];
};

export const STILMITTEL: Record<StilmittelId, Stilmittel> = {
  vergleich: {
    id: "vergleich",
    name: "Vergleich",
    ab: 5,
    gruppe: "bilder",
    merke: "Vergleich: zwei Dinge werden mit „wie“ oder „als ob“ verbunden (stark wie ein Bär). Wirkung: macht etwas anschaulich und leicht vorstellbar.",
    verwechselt: ["metapher", "personifikation", "synaesthesie"],
    auch: ["hyperbel"],
  },
  personifikation: {
    id: "personifikation",
    name: "Personifikation",
    ab: 5,
    gruppe: "bilder",
    merke: "Personifikation: Dinge, Tiere oder die Natur denken, fühlen oder handeln wie Menschen (der Wind flüstert). Wirkung: die Dinge wirken lebendig und nah.",
    verwechselt: ["metapher", "vergleich", "metonymie"],
    auch: ["synaesthesie"],
  },
  metapher: {
    id: "metapher",
    name: "Metapher",
    ab: 5,
    gruppe: "bilder",
    merke: "Metapher: ein Wort steht in übertragener Bedeutung, ohne „wie“ (Er ist ein Fuchs: er ist schlau). Wirkung: verdichtet eine Aussage in einem Bild.",
    verwechselt: ["vergleich", "personifikation", "hyperbel"],
    auch: ["euphemismus", "metonymie", "synaesthesie", "symbol"],
  },
  lautmalerei: {
    id: "lautmalerei",
    name: "Lautmalerei",
    ab: 5,
    gruppe: "klang",
    merke: "Lautmalerei: das Wort klingt wie das Geräusch, das es meint (zischen, plumps, kikeriki). Wirkung: man hört die Szene beim Lesen mit.",
    verwechselt: ["alliteration", "vergleich", "metapher"],
    auch: ["personifikation", "alliteration"],
  },
  alliteration: {
    id: "alliteration",
    name: "Alliteration",
    ab: 5,
    gruppe: "klang",
    merke: "Alliteration: Wörter nebeneinander beginnen mit demselben Laut (Milch macht müde Männer munter). Wirkung: klingt einprägsam und hebt die Wörter hervor.",
    verwechselt: ["anapher", "lautmalerei", "epipher"],
    auch: [],
  },
  hyperbel: {
    id: "hyperbel",
    name: "Hyperbel",
    ab: 6,
    gruppe: "gedanken",
    merke: "Hyperbel: eine starke Übertreibung, die niemand wörtlich nimmt (Ich habe dir das schon tausendmal gesagt). Wirkung: betont stark, oft komisch oder dramatisch.",
    verwechselt: ["metapher", "litotes", "ironie", "vergleich"],
    auch: [],
  },
  rhetorisch: {
    id: "rhetorisch",
    name: "rhetorische Frage",
    ab: 6,
    gruppe: "gedanken",
    merke: "Rhetorische Frage: eine Frage, auf die keine Antwort erwartet wird, weil sie schon feststeht (Wer will schon verlieren?). Wirkung: zieht den Leser auf die eigene Seite.",
    verwechselt: ["ironie", "ellipse", "hyperbel"],
    auch: [],
  },
  anapher: {
    id: "anapher",
    name: "Anapher",
    ab: 7,
    gruppe: "klang",
    merke: "Anapher: mehrere Sätze oder Satzteile beginnen mit demselben Wort (Ich hoffe, ich warte, ich glaube). Wirkung: eindringlich, das wiederholte Wort wird betont.",
    verwechselt: ["epipher", "alliteration", "chiasmus"],
    auch: ["parallelismus", "klimax", "ellipse", "wiederholung"],
  },
  ironie: {
    id: "ironie",
    name: "Ironie",
    ab: 7,
    gruppe: "gedanken",
    merke: "Ironie: man sagt das Gegenteil von dem, was man meint; die Lage zeigt es (Na super! bei strömendem Regen). Wirkung: Kritik oder Spott, oft witzig.",
    verwechselt: ["euphemismus", "hyperbel", "rhetorisch", "litotes"],
    auch: [],
  },
  antithese: {
    id: "antithese",
    name: "Antithese",
    ab: 7,
    gruppe: "gedanken",
    merke: "Antithese: zwei Gegensätze werden einander gegenübergestellt (Der Mensch denkt, Gott lenkt). Wirkung: der Gegensatz wird scharf und deutlich.",
    verwechselt: ["oxymoron", "paradoxon", "vergleich"],
    auch: ["parallelismus", "chiasmus"],
  },
  klimax: {
    id: "klimax",
    name: "Klimax",
    ab: 7,
    gruppe: "satz",
    merke: "Klimax: eine Steigerung, meist in drei Schritten vom Schwächeren zum Stärkeren (Ich bitte, flehe, beschwöre dich). Wirkung: die Spannung oder das Gefühl steigt.",
    verwechselt: ["antithese", "alliteration", "chiasmus", "ironie"],
    // die letzte Stufe ist oft eine Übertreibung („einfach himmlisch“)
    auch: ["parallelismus", "anapher", "ellipse", "hyperbel", "aufzaehlung"],
  },
  parallelismus: {
    id: "parallelismus",
    name: "Parallelismus",
    ab: 8,
    gruppe: "satz",
    merke: "Parallelismus: Sätze oder Satzteile hintereinander sind gleich gebaut (Mama kocht das Essen, Papa deckt den Tisch). Wirkung: Ordnung und Rhythmus, die Teile lassen sich vergleichen.",
    verwechselt: ["chiasmus", "alliteration", "klimax"],
    auch: ["antithese", "anapher", "epipher", "ellipse", "parataxe"],
  },
  ellipse: {
    id: "ellipse",
    name: "Ellipse",
    ab: 8,
    gruppe: "satz",
    merke: "Ellipse: ein Satz ist bewusst unvollständig, das Fehlende denkt man sich dazu (Hände hoch! Ende gut, alles gut). Wirkung: knapp, wie gesprochen, oft aufgeregt.",
    verwechselt: ["rhetorisch", "inversion", "hyperbel", "lautmalerei"],
    auch: ["parallelismus", "epipher", "klimax", "anapher", "antithese"],
  },
  euphemismus: {
    id: "euphemismus",
    name: "Euphemismus",
    ab: 8,
    gruppe: "gedanken",
    merke: "Euphemismus: etwas Unangenehmes wird beschönigt (für immer eingeschlafen statt gestorben). Wirkung: schont den anderen oder verschleiert etwas.",
    verwechselt: ["ironie", "litotes", "hyperbel"],
    auch: ["metapher", "metonymie"],
  },
  oxymoron: {
    id: "oxymoron",
    name: "Oxymoron",
    ab: 8,
    gruppe: "gedanken",
    merke: "Oxymoron: zwei Wörter, die sich widersprechen, stehen in EINEM Ausdruck zusammen (bittersüß, ohrenbetäubende Stille). Wirkung: macht stutzig und zeigt einen inneren Zwiespalt.",
    verwechselt: ["antithese", "paradoxon", "hyperbel"],
    auch: ["synaesthesie"],
  },
  chiasmus: {
    id: "chiasmus",
    name: "Chiasmus",
    ab: 9,
    gruppe: "satz",
    merke: "Chiasmus: Satzglieder stehen über Kreuz, A B – B A (Die Kunst ist lang, und kurz ist unser Leben). Wirkung: betont einen Gegensatz oder eine Spiegelung.",
    verwechselt: ["parallelismus", "anapher", "epipher"],
    auch: ["antithese", "inversion"],
  },
  epipher: {
    id: "epipher",
    name: "Epipher",
    ab: 9,
    gruppe: "klang",
    merke: "Epipher: mehrere Sätze oder Satzteile enden mit demselben Wort (Du bist schuld, er ist schuld, ich bin schuld). Wirkung: das letzte Wort bleibt im Ohr.",
    verwechselt: ["anapher", "alliteration", "chiasmus"],
    auch: ["parallelismus", "ellipse", "klimax", "wiederholung"],
  },
  litotes: {
    id: "litotes",
    name: "Litotes",
    ab: 9,
    gruppe: "gedanken",
    merke: "Litotes: man verneint das Gegenteil und meint damit oft mehr (nicht schlecht = ziemlich gut). Wirkung: vorsichtig und untertreibend, oft höflich.",
    verwechselt: ["euphemismus", "ironie", "hyperbel"],
    auch: [],
  },
  inversion: {
    id: "inversion",
    name: "Inversion",
    ab: 9,
    gruppe: "satz",
    merke: "Inversion: die gewohnte Wortstellung ist umgedreht, damit ein Wort vorne betont wird (Groß war die Freude). Wirkung: das Wort vorne ist besonders betont.",
    verwechselt: ["chiasmus", "ellipse", "parallelismus"],
    auch: [],
  },
  synaesthesie: {
    id: "synaesthesie",
    name: "Synästhesie",
    ab: 9,
    gruppe: "bilder",
    merke: "Synästhesie: Eindrücke verschiedener Sinne werden vermischt (schreiendes Rot: Sehen und Hören). Wirkung: der Sinneseindruck wird stärker.",
    verwechselt: ["oxymoron", "metonymie", "lautmalerei", "vergleich"],
    auch: ["metapher", "personifikation"],
  },
  metonymie: {
    id: "metonymie",
    name: "Metonymie",
    ab: 9,
    gruppe: "bilder",
    merke: "Metonymie: ein Wort wird durch ein eng damit verbundenes ersetzt, etwa der Ort für die Menschen oder der Autor für sein Buch (Goethe lesen). Wirkung: knapp und anschaulich.",
    verwechselt: ["synaesthesie", "euphemismus", "hyperbel", "vergleich"],
    auch: ["metapher", "personifikation", "symbol"],
  },
  paradoxon: {
    id: "paradoxon",
    name: "Paradoxon",
    ab: 9,
    gruppe: "gedanken",
    merke: "Paradoxon: eine Aussage widerspricht sich scheinbar, hat aber einen tieferen Sinn (Weniger ist mehr). Wirkung: regt zum Nachdenken an.",
    verwechselt: ["ironie", "litotes", "hyperbel", "rhetorisch"],
    auch: ["antithese", "oxymoron"],
  },
  wiederholung: {
    id: "wiederholung",
    name: "Wiederholung",
    ab: 9,
    gruppe: "klang",
    merke: "Wiederholung: dasselbe Wort oder dieselbe Wortgruppe kommt mehrmals vor, nicht nur am Anfang der Satzteile (er lief und lief). Wirkung: betont und verstärkt, oft eindringlich.",
    verwechselt: ["anapher", "epipher", "klimax", "parallelismus"],
    auch: [],
  },
  aufzaehlung: {
    id: "aufzaehlung",
    name: "Aufzählung",
    ab: 9,
    gruppe: "satz",
    merke: "Aufzählung: mehrere Dinge derselben Art werden hintereinander genannt, ohne Steigerung (Brot, Käse und Äpfel). Wirkung: Fülle und Vielfalt, manchmal Überforderung.",
    verwechselt: ["klimax", "parallelismus", "anapher"],
    auch: [],
  },
  parataxe: {
    id: "parataxe",
    name: "Parataxe",
    ab: 9,
    gruppe: "satz",
    merke: "Parataxe: kurze Hauptsätze stehen nebeneinander, ohne Nebensätze (Der Zug hielt. Keiner stieg aus.). Wirkung: knapp, sachlich oder gehetzt.",
    verwechselt: ["ellipse", "hypotaxe", "klimax", "chiasmus"],
    auch: ["parallelismus"],
  },
  hypotaxe: {
    id: "hypotaxe",
    name: "Hypotaxe",
    ab: 9,
    gruppe: "satz",
    merke: "Hypotaxe: ein Hauptsatz mit mehreren, oft verschachtelten Nebensätzen (weil, obwohl, dass, der …). Wirkung: genau und nachdenklich, manchmal atemlos.",
    verwechselt: ["parataxe", "ellipse", "chiasmus"],
    auch: [],
  },
  symbol: {
    id: "symbol",
    name: "Symbol",
    ab: 9,
    gruppe: "bilder",
    merke: "Symbol: ein Gegenstand, der im Text wirklich vorkommt, steht zusätzlich für etwas Abstraktes (Taube für Frieden, Ring für Treue). Wirkung: der Text bekommt eine zweite Bedeutung.",
    verwechselt: ["metapher", "metonymie", "vergleich"],
    auch: [],
  },
};

const NACH_NAME = new Map(STILMITTEL_IDS.map((id) => [STILMITTEL[id].name.toLocaleLowerCase("de"), id]));
/** Das Stilmittel zu einem Namen („Hyperbel“, „rhetorische Frage“), sonst undefined. */
export const stilmittelVonName = (name: string): StilmittelId | undefined => NACH_NAME.get(name.trim().toLocaleLowerCase("de"));

/** Ein Satz der Sammlung: der Text ohne Klammern, die angestrichene Stelle, das Stilmittel, was sonst drinsteckt, Stufe. */
export type StilSatz = { id: StilmittelId; satz: string; vor: string; mitte: string; nach: string; auch: StilmittelId[]; stufe: Stufe; zeile: string };

/** Liest eine Zeile („Er ist [stark wie ein Bär]. || Hyperbel“); Fehler als Text (für den Test). */
export function leseSatz(id: StilmittelId, zeile: string, stufe: Stufe): StilSatz | string {
  const [text, rest = ""] = zeile.split(" || ");
  const auch: StilmittelId[] = [];
  for (const name of rest.split(",").map((s) => s.trim()).filter(Boolean)) {
    const a = stilmittelVonName(name);
    if (!a) return `unbekanntes Stilmittel „${name}“`;
    auch.push(a);
  }
  const teile = text.split(/[[\]]/);
  if (teile.length % 2 !== 1 || /\][^[]*\]|\[[^\]]*\[/.test(text)) return "Klammern passen nicht zusammen";
  const satz = teile.join("").replace(/\s+/g, " ").trim();
  if (!satz) return "leer";
  if (teile.length === 1) return { id, satz, vor: "", mitte: satz, nach: "", auch, stufe, zeile };
  // die erste bis letzte Klammer ist angestrichen (bei mehreren Klammern auch das dazwischen)
  const ersteAuf = text.indexOf("[");
  const letzteZu = text.lastIndexOf("]");
  const vor = text.slice(0, ersteAuf);
  const mitte = text.slice(ersteAuf + 1, letzteZu).replace(/[[\]]/g, "");
  const nach = text.slice(letzteZu + 1).split(" || ")[0];
  return { id, satz, vor, mitte, nach, auch, stufe, zeile };
}

/** Alle Sätze der Sammlung (die Zeilen, die sich nicht lesen lassen, fehlen; der Test meldet sie). */
export function stilSaetze(): StilSatz[] {
  return STILMITTEL_IDS.flatMap((id) =>
    STILMITTEL_SAETZE[id]
      .split(/^#\s*schwer\s*$/im)
      .flatMap((teil, i) =>
        teil
          .split("\n")
          .map((z) => z.trim())
          .filter(Boolean)
          .map((z) => leseSatz(id, z, (i === 0 ? 1 : 2) as Stufe)),
      )
      .filter((s): s is StilSatz => typeof s !== "string"),
  );
}

// ---------- was am Satz zu sehen ist ----------

const WOERTER = (s: string): string[] => s.toLocaleLowerCase("de").match(/[a-zäöüß]+/g) ?? [];
/** Die Teile eines Satzes zwischen Satzzeichen, als Wörter. */
const teileVon = (s: string) =>
  s
    .split(/[,;.!?:–—]/)
    .map(WOERTER)
    .filter((w) => w.length > 0);

const FUELLWOERTER = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "und", "oder"]);
/** Wörter, die einen Nebensatz einleiten (großzügig: „als“ und „da“ auch, wenn sie keinen einleiten). */
const UNTERORDNEND = new Set(["dass", "weil", "obwohl", "obgleich", "wenn", "als", "nachdem", "während", "bevor", "ehe", "damit", "ob", "da", "sodass", "bis", "seit", "seitdem", "indem", "falls", "sobald", "solange", "warum", "wohin", "woher", "wo", "wer", "was"]);
/** Gegenstände, die oft für etwas stehen: in solchen Sätzen ist „Symbol“ nie eine falsche Antwort. */
const SYMBOLE = new Set(["taube", "ring", "ehering", "kreuz", "rose", "rosen", "kerze", "kerzen", "herz", "anker", "licht", "regenbogen", "mauer", "tür", "uhr", "schwarz", "weiß", "fenster", "brücke", "weg", "nacht", "winter", "frühling"]);

/**
 * Stilmittel, die man am Satz selbst erkennt, auch wenn sie nicht gemeint sind: ein „wie“ oder „als ob“ (Vergleich),
 * ein Fragezeichen (rhetorische Frage), zwei Wörter nebeneinander mit gleichem Anlaut (Alliteration), Satzteile mit
 * gleichem ersten (Anapher) oder letzten Wort (Epipher), gleich lange Satzteile (Parallelismus), ein Wort zweimal
 * (Wiederholung), Kommas mit „und“ (Aufzählung), ein Nebensatz (Hypotaxe) oder mehrere Hauptsätze (Parataxe), ein
 * Gegenstand, der oft für etwas steht (Symbol). Sie kommen nie als
 * falsche Antwort, damit keine richtige Beobachtung als Fehler zählt.
 */
export function siehtAus(satz: string): Set<StilmittelId> {
  const out = new Set<StilmittelId>();
  const w = WOERTER(satz);
  if (w.includes("wie") || /\bals (ob|wäre|hätte|würde)/i.test(satz)) out.add("vergleich");
  if (satz.includes("?")) out.add("rhetorisch");
  for (let i = 1; i < w.length; i++) if (w[i].length >= 3 && w[i - 1].length >= 3 && w[i][0] === w[i - 1][0]) out.add("alliteration");
  const teile = teileVon(satz);
  const anfang = teile.map((t) => t[0]);
  const ende = teile.map((t) => t[t.length - 1]);
  if (new Set(anfang).size < anfang.length) out.add("anapher");
  if (new Set(ende).size < ende.length) out.add("epipher");
  for (let i = 1; i < teile.length; i++) if (teile[i].length >= 2 && teile[i].length === teile[i - 1].length) out.add("parallelismus");
  // ein Wort zweimal (ohne Artikel und „und“): Wiederholung
  const inhalt = w.filter((x) => !FUELLWOERTER.has(x));
  if (new Set(inhalt).size < inhalt.length) out.add("wiederholung");
  // zwei Kommas oder Komma und „und“: Aufzählung
  if ((satz.match(/,/g) ?? []).length >= 2 || (satz.includes(",") && w.includes("und"))) out.add("aufzaehlung");
  // ein Nebensatz: Hypotaxe; sonst mehrere Satzteile mit mindestens zwei Wörtern: Parataxe
  if (w.some((x) => UNTERORDNEND.has(x)) || /,\s*(der|die|das|den|dem|dessen|deren|welche[rsmn]?|um|ohne|statt)\b/i.test(satz)) out.add("hypotaxe");
  else if (teile.filter((t) => t.length >= 2).length >= 2) out.add("parataxe");
  if (w.some((x) => SYMBOLE.has(x))) out.add("symbol");
  return out;
}

// ---------- Karten ----------

/** Die Stilmittel, die bis zu dieser Schulstufe dran waren. */
export const stilmittelBis = (schulstufe: number): StilmittelId[] => STILMITTEL_IDS.filter((id) => STILMITTEL[id].ab <= Math.max(5, schulstufe));

/** So viele Kacheln hat eine Karte höchstens (BrettFrage zeigt vier). */
export const STIL_KACHELN = 4;
/** Darunter ist eine Karte zu leicht: sie kommt nicht ins Spiel. */
export const STIL_KACHELN_MIN = 3;

/** Die Fähigkeit einer Karte: Unterstufe „Sprachliche Bilder“, Oberstufe die Gruppe des Stilmittels. */
export const stilSkill = (id: StilmittelId, schulstufe: number) => (schulstufe >= STIL_OBERSTUFE_AB ? STIL_GRUPPEN[STILMITTEL[id].gruppe].skill : STIL_UNTERSTUFE);

/** Was nie eine falsche Antwort sein darf: das Stilmittel, was meistens mitsteckt, was im Satz steckt oder zu sehen ist. */
export function nieFalsch(s: Pick<StilSatz, "id" | "satz" | "auch">): Set<StilmittelId> {
  return new Set<StilmittelId>([s.id, ...STILMITTEL[s.id].auch, ...s.auch, ...siehtAus(s.satz)]);
}

function mischen<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Die Karte zu einem Satz für eine Schulstufe; null, wenn das Stilmittel noch nicht dran ist oder es zu wenige falsche
 * Antworten gibt. Die falschen: bis zu zwei, die man verwechselt, dann andere, die der Schüler kennt (fester Zufall).
 */
export function stilKarte(s: StilSatz, schulstufe: number): SpielKarte | null {
  const sm = STILMITTEL[s.id];
  if (sm.ab > Math.max(5, schulstufe)) return null;
  const bekannt = new Set(stilmittelBis(schulstufe));
  const verboten = nieFalsch(s);
  const darf = (id: StilmittelId) => bekannt.has(id) && !verboten.has(id);
  const key = `stilmittel:${zahlAus(s.satz)}`;
  const rng = festerZufall(zahlAus(key) + schulstufe);
  // höchstens zwei aus `verwechselt`: sonst hätte jedes Stilmittel immer dieselben drei falschen, und man erkennte die
  // richtige Antwort an den anderen Kacheln statt am Satz
  const nah = mischen(sm.verwechselt.filter(darf), rng).slice(0, 2);
  const falsche = [...new Set([...nah, ...mischen(STILMITTEL_IDS.filter(darf), rng)])].slice(0, STIL_KACHELN - 1);
  if (falsche.length + 1 < STIL_KACHELN_MIN) return null;
  const faecher = mischen([s.id, ...falsche], rng).map((id) => STILMITTEL[id].name);
  return {
    key,
    skill: stilSkill(s.id, schulstufe),
    form: "kacheln",
    vor: s.vor,
    mitte: s.mitte,
    nach: s.nach,
    faecher,
    richtig: sm.name,
    loesung: `${s.satz} → ${sm.name}`,
    regel: sm.merke,
    kurz: sm.name,
  };
}

const cache = new Map<number, Kandidat[]>();
/** Alle spielbaren Karten für eine Schulstufe (einmal gebaut, dann aus dem Speicher). */
export function stilmittelKandidaten(schulstufe: number): Kandidat[] {
  const stufe = Math.min(13, Math.max(5, Math.round(schulstufe)));
  const c = cache.get(stufe);
  if (c) return c;
  const out = stilSaetze().flatMap((s) => {
    const karte = stilKarte(s, stufe);
    return karte ? [{ karte, stufe: s.stufe }] : [];
  });
  cache.set(stufe, out);
  return out;
}

/** Das Stilmittel einer Karte (aus der richtigen Antwort). */
export const stilmittelVonKarte = (karte: Pick<SpielKarte, "richtig">) => stilmittelVonName(karte.richtig);

/** Die Fähigkeiten, die zu diesem Spiel führen (im Stoff, in einer Prüfung). */
export const STIL_SKILLS = [STIL_UNTERSTUFE, ...Object.values(STIL_GRUPPEN).map((g) => g.skill), "deutsch.os.stil.wirkung"];

/** Die Gruppe zu einer Fähigkeit der Oberstufe (für eine Runde mit Schwerpunkt), sonst undefined. */
export const gruppeVonSkill = (skill: string): StilGruppe | undefined => (Object.keys(STIL_GRUPPEN) as StilGruppe[]).find((g) => STIL_GRUPPEN[g].skill === skill);
