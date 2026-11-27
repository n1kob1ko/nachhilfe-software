/**
 * Lernspiel „Satzglieder bestimmen“ (niko 2026-11-27, Stoff der 2. Deutschschularbeit einer 4. Klasse Volksschule:
 * „Satzglieder bestimmen (Subjekt, Prädikat, Objekte im 3. und im 4. Fall)“). Ein Satz, ein Satzglied ist markiert,
 * darunter immer dieselben vier Kacheln: Subjekt, Prädikat, Objekt 3. Fall, Objekt 4. Fall. Ohne KI.
 *
 * Die Sätze stehen unten, jedes fragbare Satzglied in eckigen Klammern mit Etikett:
 * `s` Subjekt, `p` Prädikat (immer ein Wort, kein „ruft … an“), `d` Objekt im 3. Fall (Wem?), `a` Objekt im 4. Fall
 * (Wen oder was?). Was ohne Klammern dasteht (am Morgen, im Garten, gern), wird nie gefragt: Orts- und Zeitangaben sind
 * in der Volksschule kein Stoff dieser Schularbeit.
 *
 * Eine Ziffer nach dem Etikett setzt die Stufe; sonst gilt: 0 für Sätze mit Subjekt, Prädikat und Objekt im 4. Fall,
 * 1 mit einem Objekt im 3. Fall, 2, wenn der Satz nicht mit dem Subjekt beginnt („Am Morgen [trinkt]p [Opa]s …“),
 * 3, wenn ein Objekt vorne steht („[Den Ball]a [wirft]p [Tom]s.“).
 *
 * Die Regel nach einem Fehler fragt mit dem Prädikat des Satzes: „Wer oder was bellt? Der kleine Hund: das Subjekt.“,
 * „Wem hilft Lisa? Ihrer Oma: Objekt im 3. Fall.“
 *
 * Rein (keine Datenbank). Docs: docs/lernspiele.md „Satzglieder bestimmen (Volksschule)“.
 */
import type { Stufe } from "./banken-regeln";
import type { SpielKarte } from "./lernspiele-typen";

export const SATZGLIED_FAECHER = ["Subjekt", "Prädikat", "Objekt 3. Fall", "Objekt 4. Fall"] as const;
export type Satzglied = (typeof SATZGLIED_FAECHER)[number];
type Etikett = "s" | "p" | "d" | "a";
const NAME: Record<Etikett, Satzglied> = { s: "Subjekt", p: "Prädikat", d: "Objekt 3. Fall", a: "Objekt 4. Fall" };

export const SATZGLIED_SAETZE: string[] = [
  // Subjekt, Prädikat, Objekt im 4. Fall
  "[Der Hund]s [frisst]p [einen Knochen]a.",
  "[Die Katze]s [fängt]p [eine Maus]a.",
  "[Mama]s [kocht]p [eine Suppe]a.",
  "[Papa]s [liest]p [die Zeitung]a.",
  "[Lisa]s [malt]p [ein Bild]a.",
  "[Der Bauer]s [melkt]p [die Kuh]a.",
  "[Wir]s [bauen]p [eine Sandburg]a.",
  "[Ich]s [esse]p [einen Apfel]a.",
  "[Tom]s [trinkt]p [ein Glas Milch]a.",
  "[Die Kinder]s [singen]p [ein Lied]a.",
  "[Der Lehrer]s [öffnet]p [das Fenster]a.",
  "[Oma]s [strickt]p [einen Schal]a.",
  "[Mein Bruder]s [sucht]p [seinen Schuh]a.",
  "[Die Biene]s [sammelt]p [Honig]a.",
  "[Der Igel]s [frisst]p [einen Wurm]a.",
  "[Ben]s [wirft]p [den Ball]a.",
  "[Die Ente]s [sieht]p [einen Fisch]a.",
  "[Du]s [putzt]p [deine Zähne]a.",
  "[Der Opa]s [gießt]p [die Blumen]a.",
  "[Mia]s [findet]p [einen Stein]a.",
  "[Die Feuerwehr]s [löscht]p [das Feuer]a.",
  "[Der Bäcker]s [backt]p [frisches Brot]a.",
  "[Unsere Klasse]s [besucht]p [den Zoo]a.",
  "[Der kleine Hund]s [jagt]p [die Katze]a.",
  "[Meine Schwester]s [braucht]p [einen neuen Stift]a.",
  "[Der Wind]s [bewegt]p [die Blätter]a.",
  "[Die Lehrerin]s [lobt]p [die Kinder]a.",
  "[Lea und Ben]s [bauen]p [einen Schneemann]a.",
  "[Das Baby]s [hält]p [eine Rassel]a.",
  "[Der Maler]s [streicht]p [die Wand]a.",
  // Subjekt und Prädikat allein, dazu eine Angabe, die nicht gefragt wird
  "[Der Hund]s [bellt]p laut.",
  "[Die Sonne]s [scheint]p.",
  "[Das Baby]s [schläft]p im Kinderwagen.",
  "[Die Vögel]s [singen]p am Morgen.",
  "[Der Zug]s [fährt]p schnell.",
  "[Die Kinder]s [spielen]p im Garten.",
  "[Mein Freund]s [wohnt]p in Wien.",
  "[Es]s [regnet]p seit gestern.",
  // mit Objekt im 3. Fall
  "[Lisa]s [hilft]p [ihrer Oma]d.",
  "[Das Fahrrad]s [gehört]p [meinem Bruder]d.",
  "[Tom]s [dankt]p [seiner Lehrerin]d.",
  "[Die Kinder]s [winken]p [dem Busfahrer]d.",
  "[Der Kuchen]s [schmeckt]p [den Gästen]d.",
  "[Ich]s [helfe]p [meinem Papa]d.",
  "[Der Hund]s [folgt]p [dem Jäger]d.",
  "[Die Jacke]s [passt]p [meiner Schwester]d.",
  "[Mia]s [gratuliert]p [ihrem Freund]d.",
  "[Wir]s [antworten]p [der Lehrerin]d.",
  "[Der Ball]s [gehört]p [den Kindern]d.",
  "[Die Katze]s [vertraut]p [dem Mädchen]d.",
  // mit Objekt im 3. und im 4. Fall
  "[Lisa]s [gibt]p [ihrem Bruder]d [einen Apfel]a.",
  "[Mama]s [schenkt]p [der Oma]d [Blumen]a.",
  "[Der Opa]s [erzählt]p [den Kindern]d [eine Geschichte]a.",
  "[Ich]s [zeige]p [meinem Freund]d [mein Zimmer]a.",
  "[Tom]s [bringt]p [der Lehrerin]d [das Heft]a.",
  "[Die Mutter]s [kauft]p [dem Kind]d [ein Eis]a.",
  "[Der Briefträger]s [bringt]p [der Nachbarin]d [ein Paket]a.",
  "[Wir]s [schreiben]p [unserer Tante]d [einen Brief]a.",
  "[Ben]s [leiht]p [seiner Freundin]d [ein Buch]a.",
  "[Die Lehrerin]s [erklärt]p [den Kindern]d [die Aufgabe]a.",
  "[Papa]s [kocht]p [dem Baby]d [einen Brei]a.",
  "[Der Kellner]s [bringt]p [dem Gast]d [die Suppe]a.",
  "[Mia]s [schickt]p [ihrer Oma]d [ein Foto]a.",
  "[Du]s [gibst]p [dem Hund]d [einen Knochen]a.",
  // der Satz beginnt nicht mit dem Subjekt
  "Am Morgen [trinkt]p [Opa]s [einen Kaffee]a.",
  "Heute [besucht]p [Lisa]s [ihre Tante]a.",
  "Im Garten [pflückt]p [Mama]s [Erdbeeren]a.",
  "Nach der Schule [spielt]p [Tom]s [Fußball]a.",
  "Am Abend [liest]p [Papa]s [ein Buch]a.",
  "Im Winter [füttern]p [wir]s [die Vögel]a.",
  "Morgen [schreiben]p [wir]s [eine Schularbeit]a.",
  "Gestern [feierte]p [Ben]s [seinen Geburtstag]a.",
  "Zum Geburtstag [schenkt]p [Mia]s [ihrer Mutter]d [eine Kerze]a.",
  "Am Sonntag [hilft]p [Lea]s [ihrem Opa]d im Garten.",
  "Jeden Tag [bringt]p [der Briefträger]s [uns]d [die Post]a.",
  "In der Pause [isst]p [Max]s [ein Brot]a.",
  "Leider [regnet]p [es]s heute.",
  "Im Zoo [füttert]p [der Tierpfleger]s [die Affen]a.",
  // ein Objekt steht vorne
  "[Den Ball]a3 [wirft]p [Tom]s.",
  "[Das Buch]a3 [liest]p [Lisa]s gern.",
  "[Dem Hund]d3 [gibt]p [Ben]s [einen Knochen]a.",
  "[Der Oma]d3 [schenken]p [wir]s [Blumen]a.",
  "[Die Suppe]a3 [kocht]p heute [Papa]s.",
  "[Meinem Freund]d3 [helfe]p [ich]s gern.",
];

export type SatzgliedTeil = { vor: string; mitte: string; nach: string; glied: Satzglied; etikett: Etikett; stufe: Stufe };
export type GelesenerSatz = { text: string; teile: SatzgliedTeil[]; subjekt: string | null; praedikat: string | null };

const KLAMMER = /\[([^\]]+)\]([spda])([0-3])?/g;

/** Liest einen Satz: Text ohne Klammern und je Satzglied, was davor und danach steht. */
export function leseSatzgliedSatz(src: string): GelesenerSatz {
  const text = src.replace(KLAMMER, "$1");
  const roh: { wort: string; etikett: Etikett; stufe?: number; start: number }[] = [];
  let versatz = 0;
  for (const m of src.matchAll(KLAMMER)) {
    const start = m.index! - versatz;
    roh.push({ wort: m[1], etikett: m[2] as Etikett, stufe: m[3] === undefined ? undefined : Number(m[3]), start });
    versatz += m[0].length - m[1].length;
  }
  const erstes = roh.find((r) => r.start === 0);
  const mitDativ = roh.some((r) => r.etikett === "d");
  const grund: Stufe = erstes?.etikett === "s" ? (mitDativ ? 1 : 0) : erstes ? 3 : 2;
  const teile = roh.map((r) => ({
    vor: text.slice(0, r.start),
    mitte: r.wort,
    nach: text.slice(r.start + r.wort.length),
    glied: NAME[r.etikett],
    etikett: r.etikett,
    stufe: (r.stufe ?? grund) as Stufe,
  }));
  return { text, teile, subjekt: roh.find((r) => r.etikett === "s")?.wort ?? null, praedikat: roh.find((r) => r.etikett === "p")?.wort ?? null };
}

/** Am Satzanfang großgeschrieben, in der Frage klein: Artikel und Fürwörter („Der Hund“ → „der Hund“), Namen nicht. */
const KLEIN_IN_FRAGE = /^(Der|Die|Das|Den|Dem|Ein|Eine|Einen|Einem|Mein|Meine|Meinem|Dein|Deine|Sein|Seine|Ihr|Ihre|Unser|Unsere|Ich|Du|Er|Sie|Es|Wir)\b/;
const inFrage = (s: string) => (KLEIN_IN_FRAGE.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const amAnfang = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Was nach einem Fehler erscheint: die Frage mit dem Prädikat dieses Satzes. */
export function satzgliedRegel(t: Pick<SatzgliedTeil, "mitte" | "etikett">, satz: Pick<GelesenerSatz, "subjekt" | "praedikat">): string {
  const teil = amAnfang(inFrage(t.mitte));
  const p = satz.praedikat ?? "…";
  const s = satz.subjekt ? inFrage(satz.subjekt) : "";
  switch (t.etikett) {
    case "s":
      return `Frag: Wer oder was ${p}? ${teil}. Das ist das Subjekt (der Satzgegenstand).`;
    case "p":
      return `„${t.mitte}“ ist das Prädikat (die Satzaussage): das Verb. Im Aussagesatz steht es an zweiter Stelle.`;
    case "d":
      return `Frag: Wem ${p} ${s}? ${teil}. Das ist das Objekt im 3. Fall (Wem-Fall).`;
    case "a":
      return `Frag: Wen oder was ${p} ${s}? ${teil}. Das ist das Objekt im 4. Fall (Wen-Fall).`;
  }
}

export const satzgliedKey = (text: string, teil: string) => `satzglieder:${text}|${teil}`;

/** Alle Karten, je Satzglied eine; Karten aus demselben Satz kommen nicht zusammen in eine Runde (`gruppe`). */
export function satzgliedKandidaten(): { karte: SpielKarte; stufe: Stufe; gruppe: string }[] {
  return SATZGLIED_SAETZE.flatMap((src) => {
    const satz = leseSatzgliedSatz(src);
    return satz.teile.map((t) => ({
      karte: {
        key: satzgliedKey(satz.text, t.mitte),
        vor: t.vor,
        mitte: t.mitte,
        nach: t.nach,
        form: "kacheln" as const,
        faecher: [...SATZGLIED_FAECHER],
        richtig: t.glied,
        loesung: `„${t.mitte}“: ${t.glied}`,
        regel: satzgliedRegel(t, satz),
        kurz: t.mitte,
      },
      stufe: t.stufe,
      gruppe: `satzglieder:${satz.text}`,
    }));
  });
}
