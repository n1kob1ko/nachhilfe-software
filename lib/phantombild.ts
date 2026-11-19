/**
 * Phantombild (niko 2026-11-19: „das mit dem Phantombild klingt gut“): ein Lernspiel zur Personenbeschreibung. Der
 * Schüler liest eine Zeugenaussage und baut die gesuchte Person Teil für Teil zusammen, in der Reihenfolge des Aufbaus
 * auf dem Arbeitsblatt der Schüler (niko 2026-11-19, Foto „Der Aufbau“):
 *
 * 1. Einleitung: Person vorstellen (Name), wichtigste Merkmale (Alter, Geschlecht, Körperbau, Hautfarbe)
 * 2. Hauptteil: zuerst obere Merkmale (Gesicht, Augen, Nase, Mund, Haare), danach untere (Kleidung)
 * 3. Schluss: besondere Merkmale (Brille, Schmuck, Piercings, Sommersprossen …)
 *
 * Jeder Tipp zählt sofort (kein „Prüfen“). Steht etwas nicht im Text, ist „keine“ richtig: „Erfinde keine Merkmale“.
 * Eine Stufe ist ein Fall (eine Runde am Server, wie bei Wortschloss); jedes Merkmal ist eine Karte. Ab Stufe
 * `MERKEN_AB` verschwindet die Aussage nach dem Lesen.
 *
 * Hier steht nur Reines (auch der Browser lädt es): die Merkmale, ein Fall, die Zeugenaussage und die Karten. Das
 * Gesicht zeichnet components/lernen/PhantomGesicht.tsx, die Vorlage zum Auswendiglernen steht in lib/phantom-vorlage.ts.
 */
import type { SpielKarte } from "./lernspiele-typen";

export type Rng = () => number;

export const PHANTOM_SKILL = "deutsch.beschreiben.person";

export type Teil = "Einleitung" | "Hauptteil" | "Schluss";

export const MERKMAL_IDS = ["person", "koerperbau", "haut", "gesicht", "augen", "nase", "mund", "frisur", "haarfarbe", "bart", "oberteil", "farbe", "brille", "schmuck", "besonderes"] as const;
export type Merkmal = (typeof MERKMAL_IDS)[number];

/** Ein Fall: der Wert jedes Merkmals (Haarfarbe „keine“ bei Glatze, Bart „kein“ ohne Bart), dazu Name und Alter. */
export type Fall = Record<Merkmal, string> & { name: string; alter: number };

export type Wert = { id: string; wort: string };
export type MerkmalInfo = {
  id: Merkmal;
  /** was über den Antworten steht */
  frage: string;
  /** kurz, für Karten und Schritte */
  name: string;
  teil: Teil;
  /** ab dieser Stufe wird es gefragt (vorher ist es schon eingezeichnet) */
  ab: number;
  werte: Wert[];
  /** gibt es nicht immer: dann steht kein Schritt dafür da */
  nurWenn?: (f: Fall) => boolean;
};

const PERSONEN: Wert[] = [
  { id: "junge", wort: "ein Junge" },
  { id: "maedchen", wort: "ein Mädchen" },
  { id: "jugendlicher", wort: "ein Jugendlicher" },
  { id: "jugendliche", wort: "eine Jugendliche" },
  { id: "mann", wort: "ein Mann" },
  { id: "frau", wort: "eine Frau" },
  { id: "alter_mann", wort: "ein älterer Mann" },
  { id: "alte_frau", wort: "eine ältere Frau" },
];

export const istWeiblich = (person: string) => person === "maedchen" || person === "jugendliche" || person === "frau" || person === "alte_frau";
export const istKind = (person: string) => person === "junge" || person === "maedchen";
export const istJugend = (person: string) => person === "jugendlicher" || person === "jugendliche";
export const istAlt = (person: string) => person === "alter_mann" || person === "alte_frau";
/** Kind 0, jugendlich 1, erwachsen 2, älter 3 (für naheliegende Antworten bei der Person). */
const ALTERS_STUFE: Record<string, number> = { junge: 0, maedchen: 0, jugendlicher: 1, jugendliche: 1, mann: 2, frau: 2, alter_mann: 3, alte_frau: 3 };
const kannBart = (person: string) => person === "mann" || person === "alter_mann";

/**
 * Je Bereich nur vier oder fünf Wörter (niko 2026-11-19: „es sollten nicht zu viele Adjektive sein, damit sie nicht
 * überfordert sind; pro Bereich 4–5“). Die Zeugenaussage und die Vorlage nehmen genau diese Wörter, keine anderen.
 */
export const MERKMALE: MerkmalInfo[] = [
  { id: "person", frage: "Wer wird gesucht?", name: "Person und Alter", teil: "Einleitung", ab: 1, werte: PERSONEN },
  { id: "koerperbau", frage: "Wie ist der Körperbau?", name: "Körperbau", teil: "Einleitung", ab: 3, werte: [{ id: "zierlich", wort: "zierlich" }, { id: "schlank", wort: "schlank" }, { id: "kraeftig", wort: "kräftig" }, { id: "muskuloes", wort: "muskulös" }] },
  { id: "haut", frage: "Welche Hautfarbe?", name: "Hautfarbe", teil: "Einleitung", ab: 3, werte: [{ id: "blass", wort: "blass" }, { id: "hell", wort: "hell" }, { id: "gebraeunt", wort: "gebräunt" }, { id: "dunkel", wort: "dunkel" }] },
  { id: "gesicht", frage: "Welche Gesichtsform?", name: "Gesichtsform", teil: "Hauptteil", ab: 2, werte: [{ id: "rund", wort: "rund" }, { id: "oval", wort: "oval" }, { id: "eckig", wort: "eckig" }, { id: "schmal", wort: "schmal" }] },
  { id: "augen", frage: "Welche Augenfarbe?", name: "Augenfarbe", teil: "Hauptteil", ab: 1, werte: [{ id: "blau", wort: "blau" }, { id: "gruen", wort: "grün" }, { id: "braun", wort: "braun" }, { id: "grau", wort: "grau" }] },
  { id: "nase", frage: "Welche Nase?", name: "Nase", teil: "Hauptteil", ab: 3, werte: [{ id: "klein", wort: "klein" }, { id: "gross", wort: "groß" }, { id: "breit", wort: "breit" }, { id: "spitz", wort: "spitz" }] },
  { id: "mund", frage: "Wie ist der Mund?", name: "Mund", teil: "Hauptteil", ab: 2, werte: [{ id: "klein", wort: "klein" }, { id: "breit", wort: "breit" }, { id: "schmal", wort: "schmal" }, { id: "voll", wort: "volle Lippen" }] },
  {
    id: "frisur",
    frage: "Welche Frisur?",
    name: "Frisur",
    teil: "Hauptteil",
    ab: 1,
    werte: [{ id: "glatze", wort: "Glatze" }, { id: "kurz", wort: "kurz und glatt" }, { id: "locken", wort: "kurz und lockig" }, { id: "lang", wort: "lang und glatt" }, { id: "langlocken", wort: "lang und lockig" }],
  },
  {
    id: "haarfarbe",
    frage: "Welche Haarfarbe?",
    name: "Haarfarbe",
    teil: "Hauptteil",
    ab: 1,
    werte: [{ id: "schwarz", wort: "schwarz" }, { id: "braun", wort: "braun" }, { id: "blond", wort: "blond" }, { id: "rot", wort: "rot" }, { id: "grau", wort: "grau" }],
    nurWenn: (f) => f.frisur !== "glatze",
  },
  {
    id: "bart",
    frage: "Welcher Bart?",
    name: "Bart",
    teil: "Hauptteil",
    ab: 2,
    werte: [{ id: "kein", wort: "kein Bart" }, { id: "schnurrbart", wort: "Schnurrbart" }, { id: "vollbart", wort: "Vollbart" }, { id: "dreitage", wort: "Dreitagebart" }],
    nurWenn: (f) => kannBart(f.person),
  },
  {
    id: "oberteil",
    frage: "Was trägt die Person?",
    name: "Kleidung",
    teil: "Hauptteil",
    ab: 1,
    werte: [{ id: "tshirt", wort: "T-Shirt" }, { id: "hemd", wort: "Hemd" }, { id: "pullover", wort: "Pullover" }, { id: "kapuze", wort: "Kapuzenpullover" }, { id: "jacke", wort: "Jacke" }],
  },
  {
    id: "farbe",
    frage: "Welche Farbe hat die Kleidung?",
    name: "Farbe der Kleidung",
    teil: "Hauptteil",
    ab: 1,
    werte: [{ id: "rot", wort: "rot" }, { id: "blau", wort: "blau" }, { id: "gruen", wort: "grün" }, { id: "gelb", wort: "gelb" }, { id: "schwarz", wort: "schwarz" }],
  },
  { id: "brille", frage: "Trägt die Person eine Brille?", name: "Brille", teil: "Schluss", ab: 2, werte: [{ id: "keine", wort: "keine Brille" }, { id: "rund", wort: "runde Brille" }, { id: "eckig", wort: "eckige Brille" }] },
  { id: "schmuck", frage: "Schmuck oder Piercing?", name: "Schmuck", teil: "Schluss", ab: 3, werte: [{ id: "keiner", wort: "kein Schmuck" }, { id: "ohrringe", wort: "Ohrringe" }, { id: "kette", wort: "Halskette" }, { id: "piercing", wort: "Nasenpiercing" }] },
  { id: "besonderes", frage: "Was fällt im Gesicht auf?", name: "Besonderes", teil: "Schluss", ab: 3, werte: [{ id: "nichts", wort: "nichts" }, { id: "sommersprossen", wort: "Sommersprossen" }, { id: "narbe", wort: "Narbe" }, { id: "muttermal", wort: "Muttermal" }] },
];

export const merkmal = (id: Merkmal): MerkmalInfo => MERKMALE.find((m) => m.id === id)!;
export const wertWort = (m: Merkmal, id: string) => merkmal(m).werte.find((w) => w.id === id)?.wort ?? id;

/** Werte, die für „nichts davon“ stehen. */
const LEER = new Set(["keine", "keiner", "kein", "nichts"]);
export const istLeer = (wert: string) => LEER.has(wert);

// ---------- Stufen und Punkte ----------

/** So viele Herzen hat ein Spiel; ein Fall ohne Fehler bringt eines zurück. */
export const PHANTOM_HERZEN = 3;
/** Ab dieser Stufe verschwindet die Zeugenaussage nach dem Lesen. */
export const MERKEN_AB = 4;
/** Ab dieser Stufe zeigen die Antworten nur noch Bilder (das Wort liest man im Text). */
export const NUR_BILD_AB = 3;
export const PHANTOM_PUNKTE = { richtig: 100, fall: 300 } as const;
export const PHANTOM_PUNKTE_MAX = 3_000_000;
export const gueltigePhantomPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(PHANTOM_PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);
/** Punkte für ein Merkmal beim ersten Versuch; aus dem Gedächtnis (ohne nochmal zu lesen) das Anderthalbfache. */
export const merkmalPunkte = (stufe: number, ausDemKopf: boolean) => Math.round(PHANTOM_PUNKTE.richtig * Math.max(1, stufe) * (ausDemKopf ? 1.5 : 1));
/** So viele Antworten stehen zur Wahl. */
export const optionenFuer = (stufe: number) => (stufe >= NUR_BILD_AB ? 4 : 3);

/** Die Merkmale, nach denen in dieser Stufe gefragt wird, in der Reihenfolge des Aufbaus. */
export function gefragt(fall: Fall, stufe: number): Merkmal[] {
  return MERKMALE.filter((m) => m.ab <= stufe && (!m.nurWenn || m.nurWenn(fall))).map((m) => m.id);
}

// ---------- ein Fall ----------

const NAMEN = {
  m: ["Lukas Gruber", "Felix Huber", "Jonas Bauer", "David Wagner", "Elias Pichler", "Paul Steiner", "Tobias Moser", "Simon Hofer", "Leon Berger", "Fabian Eder", "Daniel Fuchs", "Florian Winkler", "Max Schwarz", "Noah Weber", "Stefan Lang"],
  w: ["Anna Maier", "Lena Gruber", "Sophie Huber", "Laura Wimmer", "Emma Brunner", "Marie Lehner", "Julia Haas", "Hannah Schmid", "Sarah Leitner", "Lisa Koller", "Nina Auer", "Eva Reiter", "Mia Pfeiffer", "Clara Holzer", "Katharina Wolf"],
};

const wahl = <T>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length) % xs.length];

/** Ein Alter, das zur Person passt. */
function alterFuer(person: string, rng: Rng): number {
  if (istKind(person)) return 8 + Math.floor(rng() * 5);
  if (istJugend(person)) return 14 + Math.floor(rng() * 4);
  if (istAlt(person)) return 65 + 5 * Math.floor(rng() * 4);
  return 25 + 5 * Math.floor(rng() * 6);
}

/** Werte, die zu dieser Person passen (keine Glatze bei Kindern, graue Haare nur im Alter …). */
export function passendeWerte(m: Merkmal, f: Pick<Fall, "person" | "frisur">): string[] {
  const alle = merkmal(m).werte.map((w) => w.id);
  if (m === "frisur") return alle.filter((w) => w !== "glatze" || f.person === "mann" || f.person === "alter_mann");
  // im Alter meist grau
  if (m === "haarfarbe") return istAlt(f.person) ? ["grau", "grau", "grau", "braun", "blond"] : alle.filter((w) => w !== "grau");
  if (m === "bart") return kannBart(f.person) ? alle : ["kein"];
  if (m === "schmuck") return istKind(f.person) ? ["keiner", "keiner", "kette", "ohrringe"] : alle;
  return alle;
}

/**
 * Ein zufälliger Fall. `vorrang`: Werte, die zuletzt falsch waren („haarfarbe:rot“); sie kommen bevorzugt wieder,
 * wenn sie zur Person passen. „Nichts davon“ kommt bei Brille, Schmuck und Besonderem etwa jedes zweite Mal.
 */
export function neuerFall(rng: Rng, vorrang: string[] = []): Fall {
  const will = new Map<string, string>();
  for (const v of vorrang) {
    const [m, w] = v.split(":");
    if (m && w && !will.has(m)) will.set(m, w);
  }
  const nimm = (m: Merkmal, moeglich: string[]) => {
    const w = will.get(m);
    return w && moeglich.includes(w) ? w : wahl(moeglich, rng);
  };
  const person = nimm("person", merkmal("person").werte.map((w) => w.id));
  const teil: Pick<Fall, "person" | "frisur"> = { person, frisur: "" };
  // Frisuren: lang und Pferdeschwanz öfter bei Mädchen und Frauen, kurz öfter bei Buben und Männern (nie nur so)
  const frisuren = passendeWerte("frisur", teil);
  const gewichtet = istWeiblich(person) ? [...frisuren, "lang", "langlocken"] : [...frisuren, "kurz", "locken"];
  teil.frisur = nimm("frisur", gewichtet.filter((w) => frisuren.includes(w)));
  const mitLeer = (m: Merkmal, leer: string) => (rng() < 0.45 && !will.has(m) ? leer : nimm(m, passendeWerte(m, teil).filter((w) => w !== leer)));
  const fall: Fall = {
    name: wahl(NAMEN[istWeiblich(person) ? "w" : "m"], rng),
    alter: alterFuer(person, rng),
    person,
    koerperbau: nimm("koerperbau", passendeWerte("koerperbau", teil)),
    haut: nimm("haut", passendeWerte("haut", teil)),
    gesicht: nimm("gesicht", passendeWerte("gesicht", teil)),
    augen: nimm("augen", passendeWerte("augen", teil)),
    nase: nimm("nase", passendeWerte("nase", teil)),
    mund: nimm("mund", passendeWerte("mund", teil)),
    frisur: teil.frisur,
    haarfarbe: teil.frisur === "glatze" ? "keine" : nimm("haarfarbe", passendeWerte("haarfarbe", teil)),
    bart: kannBart(person) ? (rng() < 0.35 && !will.has("bart") ? "kein" : nimm("bart", passendeWerte("bart", teil).filter((w) => w !== "kein"))) : "kein",
    oberteil: nimm("oberteil", passendeWerte("oberteil", teil)),
    farbe: nimm("farbe", passendeWerte("farbe", teil)),
    brille: mitLeer("brille", "keine"),
    schmuck: mitLeer("schmuck", "keiner"),
    besonderes: mitLeer("besonderes", "nichts"),
  };
  return fall;
}

// ---------- Sprache ----------

export type Pronomen = { er: string; Er: string; sein: string; Sein: string };
export const pronomen = (person: string): Pronomen => (istWeiblich(person) ? { er: "sie", Er: "Sie", sein: "ihr", Sein: "Ihr" } : { er: "er", Er: "Er", sein: "sein", Sein: "Sein" });

const HAARFARBE: Record<string, string> = { schwarz: "schwarz", braun: "braun", blond: "blond", rot: "rot", grau: "grau" };
const KLEIDFARBE: Record<string, string> = { rot: "rot", blau: "blau", gruen: "grün", gelb: "gelb", schwarz: "schwarz" };
const AUGENFARBE: Record<string, string> = { blau: "blau", gruen: "grün", braun: "braun", grau: "grau" };
/** Geschlecht des Kleidungsstücks und sein Wort. */
const KLEID: Record<string, { g: "m" | "f" | "n"; wort: string }> = {
  tshirt: { g: "n", wort: "T-Shirt" },
  hemd: { g: "n", wort: "Hemd" },
  pullover: { g: "m", wort: "Pullover" },
  kapuze: { g: "m", wort: "Kapuzenpullover" },
  jacke: { g: "f", wort: "Jacke" },
};

/** „ein rotes T-Shirt“, „einen blauen Pullover“, „eine grüne Jacke“ (Akkusativ, unbestimmt). */
export function kleidungAkk(oberteil: string, farbe: string): string {
  const k = KLEID[oberteil] ?? KLEID.tshirt;
  const a = KLEIDFARBE[farbe] ?? farbe;
  return k.g === "m" ? `einen ${a}en ${k.wort}` : k.g === "f" ? `eine ${a}e ${k.wort}` : `ein ${a}es ${k.wort}`;
}
/** „einem roten T-Shirt“, „einer grünen Jacke“ (Dativ, unbestimmt). */
export function kleidungDat(oberteil: string, farbe: string): string {
  const k = KLEID[oberteil] ?? KLEID.tshirt;
  const a = KLEIDFARBE[farbe] ?? farbe;
  return k.g === "f" ? `einer ${a}en ${k.wort}` : `einem ${a}en ${k.wort}`;
}

/** Die Haare als Ergänzung zu „hat“: „kurze, lockige, rote Haare“, „eine Glatze“, „einen blonden Pferdeschwanz“. */
export function haareAkk(frisur: string, haarfarbe: string): string {
  const f = HAARFARBE[haarfarbe] ?? haarfarbe;
  switch (frisur) {
    case "glatze":
      return "eine Glatze";
    case "kurz":
      return `kurze, glatte, ${f}e Haare`;
    case "locken":
      return `kurze, lockige, ${f}e Haare`;
    case "lang":
      return `lange, glatte, ${f}e Haare`;
    default:
      return `lange, lockige, ${f}e Haare`;
  }
}

/** Nase und Mund mit genau den Wörtern der Antworten: „Die Nase ist groß“, „eine große Nase“, „einen kleinen Mund“. */
export const NASE: Record<string, string> = { klein: "klein", gross: "groß", breit: "breit", spitz: "spitz" };
export const NASE_AKK: Record<string, string> = { klein: "eine kleine Nase", gross: "eine große Nase", breit: "eine breite Nase", spitz: "eine spitze Nase" };
export const MUND_AKK: Record<string, string> = { klein: "einen kleinen Mund", breit: "einen breiten Mund", schmal: "einen schmalen Mund", voll: "volle Lippen" };
const MUND_SATZ = (sein: string, mund: string) => (mund === "voll" ? `${sein}e Lippen sind voll` : `${sein} Mund ist ${mund}`);
const GESICHT: Record<string, string> = { rund: "rund", oval: "oval", eckig: "eckig", schmal: "schmal" };
const HAUT: Record<string, string> = { blass: "blass", hell: "hell", gebraeunt: "gebräunt", dunkel: "dunkel" };
/** „blasse Haut“, „helle Haut“, „gebräunte Haut“, „dunkle Haut“ */
export const HAUT_ATTR: Record<string, string> = { blass: "blasse", hell: "helle", gebraeunt: "gebräunte", dunkel: "dunkle" };
export const KOERPERBAU: Record<string, string> = { zierlich: "zierlich", schlank: "schlank", kraeftig: "kräftig", muskuloes: "muskulös" };
const BART_AKK: Record<string, string> = { schnurrbart: "einen Schnurrbart", vollbart: "einen dichten Vollbart", dreitage: "einen Dreitagebart" };
const BRILLE_AKK: Record<string, string> = { rund: "eine runde Brille", eckig: "eine eckige Brille" };
const SCHMUCK_AKK: Record<string, string> = { ohrringe: "kleine, goldene Ohrringe", kette: "eine silberne Halskette", piercing: "ein Piercing in der Nase" };
const BESONDERS_AKK: Record<string, string> = { sommersprossen: "viele Sommersprossen", narbe: "eine Narbe auf der Wange", muttermal: "ein Muttermal neben dem Mund" };

/** „ein Junge“, „eine ältere Frau“ … */
export const personNom = (person: string) => PERSONEN.find((p) => p.id === person)?.wort ?? "eine Person";

/** Was am meisten auffällt, für die persönliche Bemerkung: „seine roten Haare“, „ihre runde Brille“. */
export function auffaelligAkk(f: Fall): string {
  const p = pronomen(f.person);
  const s = p.sein;
  if (f.besonderes === "sommersprossen") return `${s}e vielen Sommersprossen`;
  if (f.besonderes === "narbe") return `die Narbe auf ${s}er Wange`;
  if (f.schmuck === "piercing") return `das Piercing in ${s}er Nase`;
  if (f.brille !== "keine") return `${s}e ${f.brille === "rund" ? "runde" : "eckige"} Brille`;
  if (f.bart === "vollbart") return `${s}en dichten Vollbart`;
  if (f.frisur === "glatze") return `${s}e Glatze`;
  if (f.haarfarbe === "rot") return `${s}e roten Haare`;
  if (f.frisur === "langlocken" || f.frisur === "locken") return `${s}e Locken`;
  if (f.nase === "gross") return `${s}e große Nase`;
  return `${s}e ${AUGENFARBE[f.augen]}en Augen`;
}

/** Zahlwort bis zwanzig, sonst die Ziffern („etwa zwölf Jahre“, „etwa 35 Jahre“). */
const ZAHLWORT = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"];
export const alterWort = (n: number) => ZAHLWORT[n] ?? String(n);

/** Die Sätze der Zeugenaussage, nach Teil, und welcher Satz welches Merkmal nennt. */
export type Aussage = { saetze: { teil: Teil; text: string; merkmale: Merkmal[] }[] };

/**
 * Die Zeugenaussage zu einem Fall, sachlich und im Präsens, in der Reihenfolge des Aufbaus. Je Satz zwei oder drei
 * Fassungen (abwechselnde Satzanfänge); was die Person nicht hat (Brille, Schmuck, Besonderes), steht in einem Satz am
 * Schluss, damit „keine“ eindeutig ist.
 */
export function zeugenaussage(f: Fall, rng: Rng): Aussage {
  const p = pronomen(f.person);
  const vorname = f.name.split(" ")[0];
  const saetze: Aussage["saetze"] = [];
  const add = (teil: Teil, merkmale: Merkmal[], fassungen: string[]) => saetze.push({ teil, text: wahl(fassungen, rng), merkmale });
  const alter = alterWort(f.alter);
  add("Einleitung", [], [`Gesucht wird ${f.name}.`, `Die gesuchte Person heißt ${f.name}.`]);
  add("Einleitung", ["person"], [`${vorname} ist ${personNom(f.person)} und etwa ${alter} Jahre alt.`, `${p.Er} ist ${personNom(f.person)} von ungefähr ${alter} Jahren.`]);
  const kb = KOERPERBAU[f.koerperbau] ?? f.koerperbau;
  add("Einleitung", ["koerperbau", "haut"], [`${p.Er} ist ${kb} und hat ${HAUT_ATTR[f.haut]} Haut.`, `${p.Sein}e Haut ist ${HAUT[f.haut]}, ${p.er} ist ${kb}.`]);
  add("Hauptteil", ["gesicht"], [`${p.Sein} Gesicht ist ${GESICHT[f.gesicht]}.`, `${p.Er} hat ein ${GESICHT[f.gesicht]}es Gesicht.`]);
  add("Hauptteil", ["augen"], [`${p.Sein}e Augen sind ${AUGENFARBE[f.augen]}.`, `${p.Er} hat ${AUGENFARBE[f.augen]}e Augen.`]);
  add("Hauptteil", ["nase", "mund"], [`${p.Er} hat ${NASE_AKK[f.nase]} und ${MUND_AKK[f.mund]}.`, `${p.Sein}e Nase ist ${NASE[f.nase]} und ${MUND_SATZ(p.sein, f.mund)}.`]);
  const haare: Merkmal[] = f.frisur === "glatze" ? ["frisur"] : ["frisur", "haarfarbe"];
  add("Hauptteil", haare, [`${p.Er} hat ${haareAkk(f.frisur, f.haarfarbe)}.`, `Auf dem Kopf hat ${p.er} ${haareAkk(f.frisur, f.haarfarbe)}.`]);
  if (f.bart !== "kein") add("Hauptteil", ["bart"], [`Im Gesicht trägt ${p.er} ${BART_AKK[f.bart]}.`, `Auffällig ist auch, dass ${p.er} ${BART_AKK[f.bart]} trägt.`]);
  else if (kannBart(f.person)) add("Hauptteil", ["bart"], [`Einen Bart hat ${p.er} nicht.`, `${p.Sein} Gesicht ist glatt rasiert.`]);
  add("Hauptteil", ["oberteil", "farbe"], [`${p.Er} trägt ${kleidungAkk(f.oberteil, f.farbe)}.`, `Bekleidet ist ${p.er} mit ${kleidungDat(f.oberteil, f.farbe)}.`, `Am Oberkörper trägt ${p.er} ${kleidungAkk(f.oberteil, f.farbe)}.`]);
  const ohne: string[] = [];
  const ohneM: Merkmal[] = [];
  if (f.brille !== "keine") add("Schluss", ["brille"], [`${p.Er} trägt ${BRILLE_AKK[f.brille]}.`, `Besonders auffällig ist ${p.sein}e ${f.brille === "rund" ? "runde" : "eckige"} Brille.`]);
  else (ohne.push("eine Brille"), ohneM.push("brille"));
  if (f.schmuck !== "keiner") add("Schluss", ["schmuck"], [`Außerdem trägt ${p.er} ${SCHMUCK_AKK[f.schmuck]}.`, `Als Schmuck trägt ${p.er} ${SCHMUCK_AKK[f.schmuck]}.`]);
  else (ohne.push("Schmuck"), ohneM.push("schmuck"));
  if (f.besonderes !== "nichts") add("Schluss", ["besonderes"], [`Im Gesicht hat ${p.er} ${BESONDERS_AKK[f.besonderes]}.`, f.besonderes === "sommersprossen" ? "Auffällig sind die vielen Sommersprossen." : `Auffällig ist ${f.besonderes === "narbe" ? `die Narbe auf ${p.sein}er Wange` : `das Muttermal neben ${p.sein}em Mund`}.`]);
  else (ohne.push("andere Besonderheiten im Gesicht"), ohneM.push("besonderes"));
  if (ohne.length) {
    const liste = ohne.length === 1 ? ohne[0] : `${ohne.slice(0, -1).join(", ")} oder ${ohne[ohne.length - 1]}`;
    add("Schluss", ohneM, [`${liste.charAt(0).toUpperCase()}${liste.slice(1)} hat ${p.er} nicht.`]);
  }
  return { saetze };
}

/** Der Satz, der dieses Merkmal nennt (für das Blatt nach einem Fehler). */
export const satzFuer = (a: Aussage, m: Merkmal) => a.saetze.find((s) => s.merkmale.includes(m))?.text ?? "";

// ---------- die Karten eines Falls ----------

/** Was die erste Karte eines Falls mitbringt: der ganze Fall und die Aussage. */
export type PhantomDaten = { fall: Fall; aussage: Aussage; stufe: number };

/** Kurze Regel je Teil, für das Blatt nach einem Fehler. */
const REGEL: Record<Teil, string> = {
  Einleitung: "Einleitung: zuerst die Person vorstellen, mit Name, Alter, Geschlecht, Körperbau und Hautfarbe.",
  Hauptteil: "Hauptteil: zuerst oben (Gesicht, Augen, Nase, Mund, Haare), danach unten (Kleidung).",
  Schluss: "Schluss: die besonderen Merkmale wie Brille, Schmuck und Piercings. Was nicht im Text steht, gibt es nicht.",
};

function mische<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Die Antworten zu einem Merkmal: die richtige und passende andere, gemischt. */
export function optionen(m: Merkmal, f: Fall, anzahl: number, rng: Rng): string[] {
  const richtig = f[m];
  // bei der Person die naheliegenden zuerst: gleiches Alter, anderes Geschlecht, oder gleiches Geschlecht, anderes Alter
  const passend =
    m === "person"
      ? PERSONEN.map((p) => p.id).filter((w) => w !== richtig && (istWeiblich(w) === istWeiblich(richtig) ? Math.abs(ALTERS_STUFE[w] - ALTERS_STUFE[richtig]) === 1 : ALTERS_STUFE[w] === ALTERS_STUFE[richtig]))
      : [...new Set(passendeWerte(m, f))].filter((w) => w !== richtig);
  const andere = merkmal(m).werte.map((w) => w.id).filter((w) => w !== richtig && !passend.includes(w));
  const rest = [...mische(passend, rng), ...mische(andere, rng)].slice(0, Math.max(1, anzahl - 1));
  return mische([richtig, ...rest], rng);
}

/** Die Karten eines Falls: je gefragtes Merkmal eine, in der Reihenfolge des Aufbaus. Die erste trägt `phantom`. */
export function fallKarten(fall: Fall, stufe: number, rng: Rng): SpielKarte[] {
  const aussage = zeugenaussage(fall, rng);
  const n = optionenFuer(stufe);
  return gefragt(fall, stufe).map((m, i) => {
    const info = merkmal(m);
    const k: SpielKarte = {
      key: `phantom:${m}:${fall[m]}`,
      skill: PHANTOM_SKILL,
      wort: info.frage,
      marke: info.teil,
      vor: satzFuer(aussage, m),
      nach: "",
      kurz: wertWort(m, fall[m]),
      faecher: optionen(m, fall, n, rng),
      richtig: fall[m],
      loesung: `${info.name}: ${wertWort(m, fall[m])}`,
      regel: REGEL[info.teil],
    };
    if (i === 0) k.phantom = { fall, aussage, stufe };
    return k;
  });
}

/** Das Merkmal einer Karte („phantom:haarfarbe:rot“ → „haarfarbe“). */
export const merkmalVonKey = (key: string): Merkmal | null => {
  const m = /^phantom:([a-z]+):/.exec(key)?.[1];
  return m && (MERKMAL_IDS as readonly string[]).includes(m) ? (m as Merkmal) : null;
};

/** Der Fall, wie er gerade gebaut ist: was schon gewählt ist, sonst leer (`null` = noch nicht dran). */
export type Bau = Partial<Record<Merkmal, string>>;

/** Was vor dem ersten Schritt schon eingezeichnet ist: alle Merkmale, nach denen in dieser Stufe nicht gefragt wird. */
export function vorgezeichnet(fall: Fall, stufe: number): Bau {
  const frage = new Set(gefragt(fall, stufe));
  const out: Bau = {};
  for (const m of MERKMAL_IDS) if (!frage.has(m)) out[m] = fall[m];
  return out;
}

/** Ein Zufall aus einer Zahl (für Tests und ein Vorschaubild, das bei jedem Laden gleich ist; mulberry32). */
export function zufall(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
