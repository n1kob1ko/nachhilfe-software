/**
 * Wortlisten für die Deutsch-Satzlehre ohne KI (lib/deutsch-satzlehre.ts): erfundene Vornamen, Nomen mit
 * Geschlecht und Genitiv, die Begleiter der, ein und mein in allen vier Fällen, Verben mit Präsens,
 * Präteritum, Partizip II und Hilfsverb. Alle Wörter und Sätze sind selbst geschrieben.
 *
 * Österreichische Standardsprache: Jänner, Paradeiser, Marillen, Hausübung, Schularbeit, Turnsaal.
 * Verben, die in Österreich das Perfekt mit „sein“ bilden, in Deutschland oft mit „haben“ (sitzen,
 * liegen, stehen, schwimmen), haben `hilf: "beide"`: beide Hilfsverben gelten als richtig.
 */
import type { Rng } from "./schulbuch-zahlen";

export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// ---------- Namen ----------
export const MAEDCHEN = ["Lena", "Mia", "Emma", "Hannah", "Sophie", "Lara", "Anna", "Laura", "Nina", "Elif", "Marie", "Sarah", "Julia", "Leonie", "Mila"];
export const BUBEN = ["Jonas", "Paul", "Elias", "Felix", "Noah", "Lukas", "David", "Simon", "Ben", "Tobias", "Jakob", "Emil", "Amir", "Luka", "Max"];
export const NAMEN = [...MAEDCHEN, ...BUBEN];
/** Zwei verschiedene Namen (wer spricht, wer antwortet). */
export function zweiNamen(rng: Rng): [string, string] {
  const a = pick(rng, NAMEN);
  let b = pick(rng, NAMEN);
  while (b === a) b = pick(rng, NAMEN);
  return [a, b];
}

// ---------- Fälle und Begleiter ----------
export type Genus = "m" | "f" | "n";
export type Fall = "nom" | "gen" | "dat" | "akk";
export const FAELLE: Fall[] = ["nom", "gen", "dat", "akk"];
/** Wie die Fälle in der Schule heißen: Nominativ (1. Fall) … */
export const FALL_NAME: Record<Fall, string> = { nom: "Nominativ (1. Fall)", gen: "Genitiv (2. Fall)", dat: "Dativ (3. Fall)", akk: "Akkusativ (4. Fall)" };
export const FALL_KURZ: Record<Fall, string> = { nom: "Nominativ", gen: "Genitiv", dat: "Dativ", akk: "Akkusativ" };
/** Die Frage nach dem Fall. */
export const FALL_FRAGE: Record<Fall, string> = { nom: "Wer oder was?", gen: "Wessen?", dat: "Wem?", akk: "Wen oder was?" };

export type Begleiter = "der" | "ein" | "mein";
const B: Record<Begleiter, Record<Genus, Record<Fall, string>>> = {
  der: {
    m: { nom: "der", gen: "des", dat: "dem", akk: "den" },
    f: { nom: "die", gen: "der", dat: "der", akk: "die" },
    n: { nom: "das", gen: "des", dat: "dem", akk: "das" },
  },
  ein: {
    m: { nom: "ein", gen: "eines", dat: "einem", akk: "einen" },
    f: { nom: "eine", gen: "einer", dat: "einer", akk: "eine" },
    n: { nom: "ein", gen: "eines", dat: "einem", akk: "ein" },
  },
  mein: {
    m: { nom: "mein", gen: "meines", dat: "meinem", akk: "meinen" },
    f: { nom: "meine", gen: "meiner", dat: "meiner", akk: "meine" },
    n: { nom: "mein", gen: "meines", dat: "meinem", akk: "mein" },
  },
};
export const begleiter = (b: Begleiter, g: Genus, f: Fall) => B[b][g][f];

/**
 * Ein Nomen: Geschlecht, Genitiv (bei männlichen und sächlichen: „Buch[e]s“ heißt Buches und Buchs) und
 * was es ist (Person, Tier, Ding). Nur Nomen, die im Dativ und Akkusativ Einzahl gleich bleiben (keine
 * n-Deklination wie der Hase, des Hasen).
 */
export type Nomen = { wort: string; genus: Genus; gen: string[]; art: "person" | "tier" | "ding" };
const N = (wort: string, genus: Genus, art: Nomen["art"], gen?: string): Nomen => {
  const g = gen ?? (genus === "f" ? wort : `${wort}s`);
  const m = g.match(/^(.*)\[e\](.*)$/);
  return { wort, genus, art, gen: m ? [`${m[1]}e${m[2]}`, `${m[1]}${m[2]}`] : [g] };
};

export const PERSONEN: Nomen[] = [
  N("Opa", "m", "person"),
  N("Bruder", "m", "person"),
  N("Onkel", "m", "person"),
  N("Vater", "m", "person"),
  N("Freund", "m", "person", "Freund[e]s"),
  N("Lehrer", "m", "person"),
  N("Trainer", "m", "person"),
  N("Cousin", "m", "person"),
  N("Oma", "f", "person"),
  N("Schwester", "f", "person"),
  N("Tante", "f", "person"),
  N("Mutter", "f", "person"),
  N("Freundin", "f", "person"),
  N("Lehrerin", "f", "person"),
  N("Trainerin", "f", "person"),
  N("Cousine", "f", "person"),
  N("Nachbarin", "f", "person"),
];
export const TIERE: Nomen[] = [N("Hund", "m", "tier", "Hund[e]s"), N("Kater", "m", "tier"), N("Vogel", "m", "tier"), N("Katze", "f", "tier"), N("Pferd", "n", "tier", "Pferd[e]s")];
export const DINGE: Nomen[] = [
  N("Ball", "m", "ding", "Ball[e]s"),
  N("Apfel", "m", "ding"),
  N("Brief", "m", "ding", "Brief[e]s"),
  N("Schlüssel", "m", "ding"),
  N("Schal", "m", "ding"),
  N("Rucksack", "m", "ding", "Rucksack[e]s"),
  N("Bleistift", "m", "ding", "Bleistift[e]s"),
  N("Radiergummi", "m", "ding"),
  N("Comic", "m", "ding"),
  N("Kuchen", "m", "ding"),
  N("Tee", "m", "ding"),
  N("Witz", "m", "ding", "Witzes"),
  N("Weg", "m", "ding", "Weg[e]s"),
  N("Test", "m", "ding", "Test[e]s"),
  N("Zaun", "m", "ding", "Zaun[e]s"),
  N("Stuhl", "m", "ding", "Stuhl[e]s"),
  N("Salat", "m", "ding", "Salat[e]s"),
  N("Christbaum", "m", "ding", "Christbaum[e]s"),
  N("Garten", "m", "ding"),
  N("Park", "m", "ding"),
  N("Jacke", "f", "ding"),
  N("Tasche", "f", "ding"),
  N("Zeitung", "f", "ding"),
  N("Blume", "f", "ding"),
  N("Karte", "f", "ding"),
  N("Kappe", "f", "ding"),
  N("Uhr", "f", "ding"),
  N("Aufgabe", "f", "ding"),
  N("Regel", "f", "ding"),
  N("Geschichte", "f", "ding"),
  N("Nachricht", "f", "ding"),
  N("Suppe", "f", "ding"),
  N("Hausübung", "f", "ding"),
  N("Zeichnung", "f", "ding"),
  N("Lampe", "f", "ding"),
  N("Brille", "f", "ding"),
  N("Semmel", "f", "ding"),
  N("Buch", "n", "ding", "Buch[e]s"),
  N("Heft", "n", "ding", "Heft[e]s"),
  N("Fahrrad", "n", "ding", "Fahrrad[e]s"),
  N("Geschenk", "n", "ding", "Geschenk[e]s"),
  N("Foto", "n", "ding"),
  N("Handy", "n", "ding"),
  N("Bild", "n", "ding", "Bild[e]s"),
  N("Spiel", "n", "ding", "Spiel[e]s"),
  N("Märchen", "n", "ding"),
  N("Paket", "n", "ding", "Paket[e]s"),
  N("Gedicht", "n", "ding", "Gedicht[e]s"),
  N("Eis", "n", "ding", "Eises"),
];
export const ALLE_NOMEN = [...PERSONEN, ...TIERE, ...DINGE];
export function nomen(wort: string): Nomen {
  const n = ALLE_NOMEN.find((x) => x.wort === wort);
  if (!n) throw new Error(`Nomen fehlt: ${wort}`);
  return n;
}

/** Eine Wortgruppe aus Begleiter und Nomen in einem Fall, z. B. np("mein", "Opa", "dat") = „meinem Opa“. */
export type NP = { b: Begleiter; n: Nomen };
export const np = (b: Begleiter, wort: string): NP => ({ b, n: nomen(wort) });
/** Alle richtigen Formen der Wortgruppe (Genitiv: meines Buches und meines Buchs), die übliche zuerst. */
export function formen(x: NP, f: Fall): string[] {
  const art = begleiter(x.b, x.n.genus, f);
  return f === "gen" ? x.n.gen.map((g) => `${art} ${g}`) : [`${art} ${x.n.wort}`];
}
export const form = (x: NP, f: Fall) => formen(x, f)[0];

// ---------- Personen und Hilfsverben ----------
/** ich, du, er/sie (ein Name), wir, ihr, sie (Mehrzahl, eine Wortgruppe wie „meine Eltern“). */
export type Person = 0 | 1 | 2 | 3 | 4 | 5;
export const HABEN = { praes: ["habe", "hast", "hat", "haben", "habt", "haben"], praet: ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"] };
export const SEIN = { praes: ["bin", "bist", "ist", "sind", "seid", "sind"], praet: ["war", "warst", "war", "waren", "wart", "waren"] };
export const WERDEN = { praes: ["werde", "wirst", "wird", "werden", "werdet", "werden"], praet: ["wurde", "wurdest", "wurde", "wurden", "wurdet", "wurden"] };
/** Gruppen in der Mehrzahl (3. Person Mehrzahl). */
export const GRUPPEN = ["meine Eltern", "die Kinder", "meine Freunde", "unsere Nachbarn", "die Schülerinnen"];
/** Schule und Hausübung passen nur zu Kindern: nicht „unsere Nachbarn … an die Schularbeit“. */
export const SCHUL_GRUPPEN = ["die Kinder", "meine Freunde", "die Schülerinnen"];
export const schulisch = (rest: string) => /Schul|Hausübung|Turnbeutel/.test(rest);

// ---------- Verben für die Zeitformen ----------
/**
 * Ein Verb mit seinen Formen. praes: ich|du|er|wir|ihr|sie; praet: er|sie (Einzahl|Mehrzahl, nur für ich,
 * er/sie, wir, sie). teil: der Verbzusatz trennbarer Verben (steht … auf). hilf: das Hilfsverb im Perfekt;
 * „beide“, wenn in Österreich „sein“ und anderswo „haben“ üblich ist. falsch: typische falsche Formen.
 * rest: was zum Satz gehört (Objekt oder Ortsangabe).
 */
export type Verb = {
  inf: string;
  praes: string[];
  praet: [string, string];
  p2: string;
  hilf: "haben" | "sein" | "beide";
  teil?: string;
  rest: string[];
  /** Fortbewegung (für den Hinweis auf „sein“) */
  bewegung?: boolean;
  falschPraet?: string;
  falschP2?: string;
  stufe: 0 | 1 | 2;
};
const V = (
  inf: string,
  praes: string,
  praet: string,
  p2: string,
  hilf: Verb["hilf"],
  rest: string[],
  o: { teil?: string; bewegung?: boolean; falschPraet?: string; falschP2?: string; stufe?: 0 | 1 | 2 } = {},
): Verb => ({ inf, praes: praes.split(" "), praet: praet.split(" ") as [string, string], p2, hilf, rest, stufe: o.stufe ?? 0, ...o });

export const VERBEN: Verb[] = [
  V("lesen", "lese liest liest lesen lest lesen", "las lasen", "gelesen", "haben", ["ein Buch", "die Zeitung", "einen Comic"], { falschPraet: "leste", falschP2: "gelest" }),
  V("schreiben", "schreibe schreibst schreibt schreiben schreibt schreiben", "schrieb schrieben", "geschrieben", "haben", ["einen Brief", "eine Nachricht"], { falschPraet: "schreibte", falschP2: "geschreibt" }),
  V("essen", "esse isst isst essen esst essen", "aß aßen", "gegessen", "haben", ["einen Apfel", "eine Semmel"], { falschPraet: "esste", falschP2: "geesst" }),
  V("trinken", "trinke trinkst trinkt trinken trinkt trinken", "trank tranken", "getrunken", "haben", ["einen Tee", "ein Glas Milch"], { falschPraet: "trinkte", falschP2: "getrinkt" }),
  V("kaufen", "kaufe kaufst kauft kaufen kauft kaufen", "kaufte kauften", "gekauft", "haben", ["ein Heft", "einen Radiergummi"]),
  V("machen", "mache machst macht machen macht machen", "machte machten", "gemacht", "haben", ["die Hausübung"]),
  V("spielen", "spiele spielst spielt spielen spielt spielen", "spielte spielten", "gespielt", "haben", ["im Garten", "im Park"]),
  V("finden", "finde findest findet finden findet finden", "fand fanden", "gefunden", "haben", ["den Schlüssel", "einen Euro"], { falschPraet: "findete", falschP2: "gefindet", stufe: 1 }),
  V("bringen", "bringe bringst bringt bringen bringt bringen", "brachte brachten", "gebracht", "haben", ["den Ball", "einen Kuchen"], { falschPraet: "bringte", falschP2: "gebringt", stufe: 1 }),
  V("helfen", "helfe hilfst hilft helfen helft helfen", "half halfen", "geholfen", "haben", ["meiner Oma", "dem Trainer"], { falschPraet: "helfte", falschP2: "gehelft", stufe: 1 }),
  V("sehen", "sehe siehst sieht sehen seht sehen", "sah sahen", "gesehen", "haben", ["einen Film", "den Hund"], { falschPraet: "sehte", falschP2: "gesieht" }),
  V("gehen", "gehe gehst geht gehen geht gehen", "ging gingen", "gegangen", "sein", ["nach Hause", "in die Schule"], { bewegung: true, falschPraet: "gehte", falschP2: "gegeht" }),
  V("fahren", "fahre fährst fährt fahren fahrt fahren", "fuhr fuhren", "gefahren", "sein", ["nach Wien", "nach Graz"], { bewegung: true, falschPraet: "fahrte", falschP2: "gefahrt" }),
  V("laufen", "laufe läufst läuft laufen lauft laufen", "lief liefen", "gelaufen", "sein", ["nach Hause", "zum Bahnhof"], { bewegung: true, falschPraet: "laufte", falschP2: "gelauft" }),
  V("kommen", "komme kommst kommt kommen kommt kommen", "kam kamen", "gekommen", "sein", ["nach Hause", "aus der Schule"], { bewegung: true, falschPraet: "kommte", falschP2: "gekommt" }),
  V("bleiben", "bleibe bleibst bleibt bleiben bleibt bleiben", "blieb blieben", "geblieben", "sein", ["zu Hause"], { falschPraet: "bleibte", falschP2: "gebleibt", stufe: 1 }),
  V("fliegen", "fliege fliegst fliegt fliegen fliegt fliegen", "flog flogen", "geflogen", "sein", ["nach Rom", "nach London"], { bewegung: true, falschPraet: "fliegte", falschP2: "gefliegt", stufe: 1 }),
  V("schwimmen", "schwimme schwimmst schwimmt schwimmen schwimmt schwimmen", "schwamm schwammen", "geschwommen", "beide", ["im See"], { falschPraet: "schwimmte", falschP2: "geschwimmt", stufe: 1 }),
  V("sitzen", "sitze sitzt sitzt sitzen sitzt sitzen", "saß saßen", "gesessen", "beide", ["auf der Bank"], { falschPraet: "sitzte", falschP2: "gesitzt", stufe: 1 }),
  V("aufstehen", "stehe stehst steht stehen steht stehen", "stand standen", "aufgestanden", "sein", ["um sieben Uhr"], { teil: "auf", stufe: 1 }),
  V("einkaufen", "kaufe kaufst kauft kaufen kauft kaufen", "kaufte kauften", "eingekauft", "haben", ["im Supermarkt"], { teil: "ein", stufe: 1 }),
  V("ankommen", "komme kommst kommt kommen kommt kommen", "kam kamen", "angekommen", "sein", ["in Wien", "am Bahnhof"], { teil: "an", bewegung: true, stufe: 2 }),
  V("abfahren", "fahre fährst fährt fahren fahrt fahren", "fuhr fuhren", "abgefahren", "sein", ["um acht Uhr"], { teil: "ab", bewegung: true, stufe: 2 }),
  V("vergessen", "vergesse vergisst vergisst vergessen vergesst vergessen", "vergaß vergaßen", "vergessen", "haben", ["den Schlüssel", "den Turnbeutel"], { falschP2: "gevergessen", stufe: 2 }),
  V("besuchen", "besuche besuchst besucht besuchen besucht besuchen", "besuchte besuchten", "besucht", "haben", ["den Opa", "meinen Onkel"], { falschP2: "gebesucht", stufe: 2 }),
  V("telefonieren", "telefoniere telefonierst telefoniert telefonieren telefoniert telefonieren", "telefonierte telefonierten", "telefoniert", "haben", ["mit der Oma"], { falschP2: "getelefoniert", stufe: 2 }),
  V("denken", "denke denkst denkt denken denkt denken", "dachte dachten", "gedacht", "haben", ["an die Schularbeit"], { falschPraet: "denkte", falschP2: "gedenkt", stufe: 2 }),
  V("rennen", "renne rennst rennt rennen rennt rennen", "rannte rannten", "gerannt", "sein", ["zum Bus"], { bewegung: true, falschPraet: "rennte", falschP2: "gerennt", stufe: 2 }),
];
export const verb = (inf: string) => {
  const v = VERBEN.find((x) => x.inf === inf);
  if (!v) throw new Error(`Verb fehlt: ${inf}`);
  return v;
};
/** Präsens oder Präteritum, die gebeugte Form (ohne Verbzusatz). */
export const praesens = (v: Verb, p: Person) => v.praes[p];
export const praeteritum = (v: Verb, p: Person) => v.praet[p === 3 || p === 5 ? 1 : 0];
/** Die Hilfsverben, die im Perfekt richtig sind. */
export const hilfsverben = (v: Verb): ("haben" | "sein")[] => (v.hilf === "beide" ? ["sein", "haben"] : [v.hilf]);
