/**
 * Lernspiel „Nomen bestimmen“ (niko 2026-11-27, Stoff der 2. Deutschschularbeit einer 4. Klasse Volksschule:
 * „Geschlecht-, Zahl- und Fallbestimmungen von Nomen“). Ein Nomen im Satz ist markiert, dazu kommen drei kurze Fragen
 * gleich hintereinander, wie in der Schularbeit: Welches Geschlecht? (männlich, weiblich, sächlich), Einzahl oder
 * Mehrzahl? (wischen), In welchem Fall? (1. bis 4. Fall). Ohne KI.
 *
 * Die Sätze stehen unten, das Nomen mit seinem Begleiter in eckigen Klammern, dahinter in geschweiften Klammern
 * Geschlecht (m, w, s), Zahl (ez, mz), Fall (1–4) und, wenn es nicht schon so dasteht, die Grundform mit „der“, „die“
 * oder „das“: „Lisa hilft [dem Opa]{m,ez,3,der Opa}.“, „[Die Kinder]{s,mz,1,das Kind} spielen.“
 *
 * Stufen: 0 Einzahl im 1. und 4. Fall; 1 der 3. Fall und die Mehrzahl; 2 nach einer Präposition („mit dem Ball“);
 * 3 der 2. Fall („das Auto des Nachbarn“).
 *
 * Die drei Karten eines Nomens bilden eine Kette (`folge` in lib/lernspiele-karten.ts): sie kommen zusammen und
 * in dieser Reihenfolge in eine Runde.
 *
 * Rein (keine Datenbank). Docs: docs/lernspiele.md „Nomen bestimmen (Volksschule)“.
 */
import type { Stufe } from "./banken-regeln";
import type { SpielKarte } from "./lernspiele-typen";

export const NOMEN_SKILL = "deutsch.wortarten.nomen";
export const GESCHLECHT_FAECHER = ["männlich", "weiblich", "sächlich"] as const;
export const ZAHL_FAECHER = ["Einzahl", "Mehrzahl"] as const;
export const FALL_FAECHER_VS = ["1. Fall", "2. Fall", "3. Fall", "4. Fall"] as const;
type G = "m" | "w" | "s";
const GESCHLECHT: Record<G, { name: (typeof GESCHLECHT_FAECHER)[number]; artikel: string }> = {
  m: { name: "männlich", artikel: "der" },
  w: { name: "weiblich", artikel: "die" },
  s: { name: "sächlich", artikel: "das" },
};
const FRAGE = ["", "Wer oder was?", "Wessen?", "Wem?", "Wen oder was?"];
const FALL_NAME = ["", "Wer-Fall", "Wessen-Fall", "Wem-Fall", "Wen-Fall"];
const PRAEPOSITIONEN = new Set(["mit", "von", "vom", "zu", "zum", "zur", "bei", "beim", "aus", "nach", "seit", "für", "durch", "ohne", "gegen", "um", "in", "im", "auf", "an", "am", "unter", "über", "vor", "hinter", "neben", "zwischen"]);

export const NOMEN_SAETZE: string[] = [
  // Einzahl, 1. und 4. Fall
  "[Der Hund]{m,ez,1} bellt laut.",
  "[Die Katze]{w,ez,1} schläft auf dem Sofa.",
  "[Das Pferd]{s,ez,1} frisst Heu.",
  "Tom isst [einen Apfel]{m,ez,4,der Apfel}.",
  "Lisa liest [ein Buch]{s,ez,4,das Buch}.",
  "Mama kauft [eine Hose]{w,ez,4,die Hose}.",
  "[Der Lehrer]{m,ez,1} schreibt an die Tafel.",
  "Wir sehen [den Mond]{m,ez,4,der Mond}.",
  "[Die Sonne]{w,ez,1} scheint hell.",
  "Ben sucht [seinen Schuh]{m,ez,4,der Schuh}.",
  "[Das Baby]{s,ez,1} lacht.",
  "Oma backt [einen Kuchen]{m,ez,4,der Kuchen}.",
  "Ich male [ein Haus]{s,ez,4,das Haus}.",
  "[Meine Schwester]{w,ez,1,die Schwester} singt ein Lied.",
  "Papa repariert [das Fahrrad]{s,ez,4}.",
  "[Der Igel]{m,ez,1} sucht Futter.",
  "Mia gießt [die Blume]{w,ez,4}.",
  "Der Bauer füttert [das Schwein]{s,ez,4}.",
  "[Ein Vogel]{m,ez,1,der Vogel} sitzt auf dem Dach.",
  "Wir besuchen [die Oma]{w,ez,4}.",
  // 3. Fall
  "Lisa hilft [dem Opa]{m,ez,3,der Opa}.",
  "Das Rad gehört [meiner Schwester]{w,ez,3,die Schwester}.",
  "Tom gibt [dem Hund]{m,ez,3,der Hund} einen Knochen.",
  "Wir danken [der Lehrerin]{w,ez,3,die Lehrerin}.",
  "Mama schenkt [dem Baby]{s,ez,3,das Baby} eine Rassel.",
  "Ben winkt [dem Busfahrer]{m,ez,3,der Busfahrer}.",
  "Ich zeige [meinem Freund]{m,ez,3,der Freund} mein Zimmer.",
  "Die Jacke passt [dem Mädchen]{s,ez,3,das Mädchen}.",
  // Mehrzahl
  "[Die Kinder]{s,mz,1,das Kind} spielen im Hof.",
  "[Die Hunde]{m,mz,1,der Hund} bellen.",
  "Opa gießt [die Blumen]{w,mz,4,die Blume}.",
  "Wir pflücken [Äpfel]{m,mz,4,der Apfel}.",
  "[Die Vögel]{m,mz,1,der Vogel} singen am Morgen.",
  "Lisa sammelt [Steine]{m,mz,4,der Stein}.",
  "Der Bauer füttert [die Hühner]{s,mz,4,das Huhn}.",
  "[Die Bäume]{m,mz,1,der Baum} verlieren ihre Blätter.",
  "Ich putze [meine Zähne]{m,mz,4,der Zahn}.",
  "[Die Mädchen]{s,mz,1,das Mädchen} lachen laut.",
  "Die Lehrerin lobt [die Schüler]{m,mz,4,der Schüler}.",
  "Oma erzählt [den Kindern]{s,mz,3,das Kind} eine Geschichte.",
  "Der Ball gehört [den Buben]{m,mz,3,der Bub}.",
  "Wir helfen [den Nachbarn]{m,mz,3,der Nachbar}.",
  "[Die Katzen]{w,mz,1,die Katze} trinken Milch.",
  "Tom kauft [Bananen]{w,mz,4,die Banane}.",
  "[Die Autos]{s,mz,1,das Auto} stehen im Stau.",
  // nach einer Präposition
  "Tom spielt mit [dem Ball]{m,ez,3,der Ball}.",
  "Lisa wohnt bei [ihrer Tante]{w,ez,3,die Tante}.",
  "Wir fahren mit [dem Zug]{m,ez,3,der Zug} nach Graz.",
  "Ich kaufe Blumen für [die Mama]{w,ez,4}.",
  "Der Brief ist von [meinem Opa]{m,ez,3,der Opa}.",
  "Mia geht ohne [ihren Bruder]{m,ez,4,der Bruder} in die Schule.",
  "Die Kinder laufen durch [den Wald]{m,ez,4,der Wald}.",
  "Ben fährt mit [dem Fahrrad]{s,ez,3,das Fahrrad} zur Schule.",
  "Der Hund läuft um [das Haus]{s,ez,4}.",
  "Wir spielen mit [den Kindern]{s,mz,3,das Kind}.",
  "Das Geschenk ist für [die Kinder]{s,mz,4,das Kind}.",
  "Die Katze schläft neben [dem Ofen]{m,ez,3,der Ofen}.",
  // 2. Fall
  "Das ist das Auto [des Nachbarn]{m,ez,2,der Nachbar}.",
  "Die Farbe [der Blume]{w,ez,2,die Blume} ist rot.",
  "Der Schwanz [des Hundes]{m,ez,2,der Hund} wackelt.",
  "Das Dach [des Hauses]{s,ez,2,das Haus} ist neu.",
  "Die Stimme [der Lehrerin]{w,ez,2,die Lehrerin} ist leise.",
  "Das Spielzeug [der Kinder]{s,mz,2,das Kind} liegt am Boden.",
  "Die Ohren [des Hasen]{m,ez,2,der Hase} sind lang.",
  "Das Fell [der Katze]{w,ez,2,die Katze} ist weich.",
];

export type NomenTeil = { vor: string; mitte: string; nach: string; g: G; mz: boolean; fall: 1 | 2 | 3 | 4; grund: string; stufe: Stufe; text: string };

const KLAMMER = /\[([^\]]+)\]\{([mws]),(ez|mz),([1-4])(?:,([^}]+))?\}/g;

/** Liest einen Satz: Text ohne Klammern und je Nomen, was davor und danach steht. */
export function leseNomenSatz(src: string): { text: string; teile: NomenTeil[] } {
  const text = src.replace(KLAMMER, "$1");
  const teile: NomenTeil[] = [];
  let versatz = 0;
  for (const m of src.matchAll(KLAMMER)) {
    const start = m.index! - versatz;
    versatz += m[0].length - m[1].length;
    const [, mitte, g, z, f, grund] = m;
    const vor = text.slice(0, start);
    const fall = Number(f) as 1 | 2 | 3 | 4;
    const davor = vor.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
    const stufe: Stufe = fall === 2 ? 3 : PRAEPOSITIONEN.has(davor) ? 2 : fall === 3 || z === "mz" ? 1 : 0;
    teile.push({ vor, mitte, nach: text.slice(start + mitte.length), g: g as G, mz: z === "mz", fall, grund: grund ?? mitte.replace(/^D/, "d"), stufe, text });
  }
  return { text, teile };
}


export function geschlechtRegel(t: NomenTeil): string {
  const { name, artikel } = GESCHLECHT[t.g];
  if (t.mz) return `In der Mehrzahl heißt es immer „die“. Das Geschlecht siehst du an der Einzahl: „${t.grund}“, also ${name}.`;
  return `Probe mit der Grundform: „${t.grund}“. Mit „${artikel}“ ist das Nomen ${name}.`;
}
export function zahlRegel(t: NomenTeil): string {
  return t.mz ? `„${t.mitte}“ meint mehrere (Einzahl: ${t.grund}): Mehrzahl.` : `„${t.mitte}“ meint nur eines (${t.grund}): Einzahl.`;
}
export function fallRegel(t: NomenTeil): string {
  const davor = t.vor.trim().split(/\s+/).pop() ?? "";
  const praep = PRAEPOSITIONEN.has(davor.toLowerCase()) ? ` Nach „${davor}“ steht hier der ${t.fall}. Fall.` : "";
  return `„${t.mitte}“ antwortet auf „${FRAGE[t.fall]}“: ${t.fall}. Fall (${FALL_NAME[t.fall]}).${praep}`;
}

export const nomenKey = (text: string, teil: string, was: "g" | "z" | "f") => `nomen:${text}|${teil}#${was}`;

/** Je Nomen eine Kette aus drei Karten: Geschlecht (Kacheln), Zahl (wischen), Fall (Kacheln). */
export function nomenKandidaten(): { karte: SpielKarte; stufe: Stufe; gruppe: string; folge: SpielKarte[] }[] {
  return NOMEN_SAETZE.flatMap((src) => {
    const { text, teile } = leseNomenSatz(src);
    return teile.map((t) => {
      const basis = { vor: t.vor, mitte: t.mitte, nach: t.nach, kurz: t.mitte };
      const geschlecht: SpielKarte = {
        ...basis,
        key: nomenKey(text, t.mitte, "g"),
        form: "kacheln",
        auftrag: "Welches Geschlecht hat das Nomen?",
        faecher: [...GESCHLECHT_FAECHER],
        richtig: GESCHLECHT[t.g].name,
        loesung: `${t.grund}: ${GESCHLECHT[t.g].name}`,
        regel: geschlechtRegel(t),
      };
      const zahl: SpielKarte = {
        ...basis,
        key: nomenKey(text, t.mitte, "z"),
        form: "wischen",
        auftrag: "Einzahl oder Mehrzahl?",
        faecher: [...ZAHL_FAECHER],
        richtig: t.mz ? "Mehrzahl" : "Einzahl",
        loesung: `„${t.mitte}“: ${t.mz ? "Mehrzahl" : "Einzahl"}`,
        regel: zahlRegel(t),
      };
      const fall: SpielKarte = {
        ...basis,
        key: nomenKey(text, t.mitte, "f"),
        form: "kacheln",
        auftrag: "In welchem Fall steht das Nomen?",
        faecher: [...FALL_FAECHER_VS],
        richtig: `${t.fall}. Fall`,
        loesung: `„${t.mitte}“: ${t.fall}. Fall`,
        regel: fallRegel(t),
      };
      return { karte: geschlecht, stufe: t.stufe, gruppe: `nomen:${text}`, folge: [zahl, fall] };
    });
  });
}
