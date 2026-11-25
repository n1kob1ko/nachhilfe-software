/**
 * Lernspiel „ich gehe, du gehst“ für die Volksschule (niko 2026-11-25: „ein weiteres spiel mit sowas wie du gehst ich
 * gehe wir gehen usw“): ein Satz mit Lücke, die Grundform darunter („(gehen)“), die passende Personalform wählen. Wer
 * eine Karte schon einmal richtig hatte, schreibt sie beim nächsten Mal selbst (lib/antwort-schreiben.ts, streng).
 *
 * Alle Formen stehen ausgeschrieben in `VERBEN` (nichts wird geraten oder gebildet), in der Reihenfolge
 * ich, du, er/sie/es, wir, ihr, sie. Dazu typische falsche Formen, die Kinder schreiben („du fahrst“, „ihr seit“): sie
 * stehen als Kacheln da, damit man genau den Fehler übt.
 *
 * Stufen: 0 regelmäßige Verben mit ich, du, er, wir; 1 dazu ihr und sie (mehrere) und Verben wie tanzen (du tanzt) oder
 * arbeiten (du arbeitest); 2 Verben mit Wechsel des Selbstlauts (du liest, er fährt), sein und haben; 3 können, wollen,
 * müssen, dürfen, mögen, wissen. Steht das Verb vor der Person („Heute gehst du …“), ist die Karte eine Stufe schwerer.
 *
 * Rein (keine Datenbank). Docs: docs/lernspiele.md „ich gehe, du gehst (Volksschule)“.
 */
import type { Stufe } from "./banken-regeln";
import type { SpielKarte } from "./lernspiele-typen";

/** Die Fähigkeit im Lernstand: „Verben: Grundform und Personalformen“ (lib/themen/deutsch-unterstufe.ts, Volksschule). */
export const KONJUGIEREN_SKILL = "deutsch.vs.sprache.personalformen";

export const PERSONEN = ["ich", "du", "er", "wir", "ihr", "sie"] as const;
export type Person = (typeof PERSONEN)[number];

/**
 * `art`: regel (spielen), sz (Stamm auf s, ß, z: tanzen), td (Stamm auf t, d: arbeiten), wechsel (lesen, fahren),
 * eigen (sein, haben, die Modalverben, wissen).
 */
type VerbArt = "regel" | "sz" | "td" | "wechsel" | "eigen";
type Verb = { grundform: string; art: VerbArt; formen: string; saetze: [string, string]; falsch?: Partial<Record<Person, string>>; stufe?: Stufe };

const ART_STUFE: Record<VerbArt, Stufe> = { regel: 0, sz: 1, td: 1, wechsel: 2, eigen: 2 };

/** Die Verben: Formen ich du er wir ihr sie, zwei Satzenden (was nach dem Verb kommt). */
export const VERBEN: Verb[] = [
  { grundform: "spielen", art: "regel", formen: "spiele spielst spielt spielen spielt spielen", saetze: ["gern Fußball", "im Garten"] },
  { grundform: "malen", art: "regel", formen: "male malst malt malen malt malen", saetze: ["ein Bild", "mit Wasserfarben"] },
  { grundform: "lachen", art: "regel", formen: "lache lachst lacht lachen lacht lachen", saetze: ["über den Witz", "sehr laut"] },
  { grundform: "kochen", art: "regel", formen: "koche kochst kocht kochen kocht kochen", saetze: ["Nudeln", "das Mittagessen"] },
  { grundform: "machen", art: "regel", formen: "mache machst macht machen macht machen", saetze: ["die Hausübung", "einen Ausflug"] },
  { grundform: "hören", art: "regel", formen: "höre hörst hört hören hört hören", saetze: ["Musik", "eine Geschichte"] },
  { grundform: "singen", art: "regel", formen: "singe singst singt singen singt singen", saetze: ["ein Lied", "im Chor"] },
  { grundform: "springen", art: "regel", formen: "springe springst springt springen springt springen", saetze: ["über den Bach", "ins Wasser"] },
  { grundform: "trinken", art: "regel", formen: "trinke trinkst trinkt trinken trinkt trinken", saetze: ["Apfelsaft", "ein Glas Milch"] },
  { grundform: "schwimmen", art: "regel", formen: "schwimme schwimmst schwimmt schwimmen schwimmt schwimmen", saetze: ["im See", "sehr schnell"] },
  { grundform: "gehen", art: "regel", formen: "gehe gehst geht gehen geht gehen", saetze: ["in die Schule", "nach Hause"] },
  { grundform: "kommen", art: "regel", formen: "komme kommst kommt kommen kommt kommen", saetze: ["aus Wien", "zu spät"] },
  { grundform: "bauen", art: "regel", formen: "baue baust baut bauen baut bauen", saetze: ["eine Sandburg", "ein Baumhaus"] },
  { grundform: "kaufen", art: "regel", formen: "kaufe kaufst kauft kaufen kauft kaufen", saetze: ["Brot", "ein Eis"] },
  { grundform: "lernen", art: "regel", formen: "lerne lernst lernt lernen lernt lernen", saetze: ["das Einmaleins", "für den Test"] },
  { grundform: "wohnen", art: "regel", formen: "wohne wohnst wohnt wohnen wohnt wohnen", saetze: ["in Graz", "in einem Haus"] },
  { grundform: "schreiben", art: "regel", formen: "schreibe schreibst schreibt schreiben schreibt schreiben", saetze: ["einen Brief", "eine Geschichte"] },
  { grundform: "fliegen", art: "regel", formen: "fliege fliegst fliegt fliegen fliegt fliegen", saetze: ["nach Spanien", "mit dem Flugzeug"] },
  { grundform: "suchen", art: "regel", formen: "suche suchst sucht suchen sucht suchen", saetze: ["den Ball", "Ostereier"] },
  { grundform: "turnen", art: "regel", formen: "turne turnst turnt turnen turnt turnen", saetze: ["im Turnsaal", "am Reck"] },
  { grundform: "rechnen", art: "td", formen: "rechne rechnest rechnet rechnen rechnet rechnen", saetze: ["im Kopf", "eine Aufgabe"], falsch: { du: "rechnst" } },
  { grundform: "tanzen", art: "sz", formen: "tanze tanzt tanzt tanzen tanzt tanzen", saetze: ["im Turnsaal", "sehr gern"], falsch: { du: "tanzst" } },
  { grundform: "sitzen", art: "sz", formen: "sitze sitzt sitzt sitzen sitzt sitzen", saetze: ["auf dem Sessel", "in der ersten Reihe"], falsch: { du: "sitzst" } },
  { grundform: "putzen", art: "sz", formen: "putze putzt putzt putzen putzt putzen", saetze: ["die Zähne", "das Fenster"], falsch: { du: "putzst" } },
  { grundform: "arbeiten", art: "td", formen: "arbeite arbeitest arbeitet arbeiten arbeitet arbeiten", saetze: ["im Garten", "sehr fleißig"], falsch: { du: "arbeitst" } },
  { grundform: "finden", art: "td", formen: "finde findest findet finden findet finden", saetze: ["den Schlüssel", "einen Stein"], falsch: { du: "findst" } },
  { grundform: "warten", art: "td", formen: "warte wartest wartet warten wartet warten", saetze: ["auf den Bus", "vor der Schule"], falsch: { du: "wartst" } },
  { grundform: "lesen", art: "wechsel", formen: "lese liest liest lesen lest lesen", saetze: ["ein Buch", "einen Comic"] },
  { grundform: "sehen", art: "wechsel", formen: "sehe siehst sieht sehen seht sehen", saetze: ["einen Regenbogen", "die Berge"], falsch: { du: "sehst" } },
  { grundform: "essen", art: "wechsel", formen: "esse isst isst essen esst essen", saetze: ["einen Apfel", "Spaghetti"] },
  { grundform: "geben", art: "wechsel", formen: "gebe gibst gibt geben gebt geben", saetze: ["dem Hund Futter", "der Lehrerin das Heft"], falsch: { du: "gebst" } },
  { grundform: "nehmen", art: "wechsel", formen: "nehme nimmst nimmt nehmen nehmt nehmen", saetze: ["den Bus", "ein Stück Kuchen"], falsch: { du: "nehmst" } },
  { grundform: "sprechen", art: "wechsel", formen: "spreche sprichst spricht sprechen sprecht sprechen", saetze: ["Deutsch", "sehr leise"], falsch: { du: "sprechst" } },
  { grundform: "helfen", art: "wechsel", formen: "helfe hilfst hilft helfen helft helfen", saetze: ["der Oma", "beim Kochen"], falsch: { du: "helfst" } },
  { grundform: "fahren", art: "wechsel", formen: "fahre fährst fährt fahren fahrt fahren", saetze: ["mit dem Rad", "nach Salzburg"], falsch: { du: "fahrst" } },
  { grundform: "laufen", art: "wechsel", formen: "laufe läufst läuft laufen lauft laufen", saetze: ["in den Wald", "sehr schnell"], falsch: { du: "laufst" } },
  { grundform: "schlafen", art: "wechsel", formen: "schlafe schläfst schläft schlafen schlaft schlafen", saetze: ["sehr lange", "im Zelt"], falsch: { du: "schlafst" } },
  { grundform: "tragen", art: "wechsel", formen: "trage trägst trägt tragen tragt tragen", saetze: ["die Schultasche", "einen Rucksack"], falsch: { du: "tragst" } },
  { grundform: "sein", art: "eigen", formen: "bin bist ist sind seid sind", saetze: ["in der Schule", "sehr müde"], falsch: { ihr: "seit" } },
  { grundform: "haben", art: "eigen", formen: "habe hast hat haben habt haben", saetze: ["Hunger", "einen Hund"], falsch: { du: "habst" } },
  { grundform: "können", art: "eigen", stufe: 3, formen: "kann kannst kann können könnt können", saetze: ["gut schwimmen", "schon lesen"], falsch: { er: "kannt" } },
  { grundform: "wollen", art: "eigen", stufe: 3, formen: "will willst will wollen wollt wollen", saetze: ["ein Eis essen", "draußen spielen"], falsch: { er: "willt" } },
  { grundform: "müssen", art: "eigen", stufe: 3, formen: "muss musst muss müssen müsst müssen", saetze: ["die Hausübung machen", "früh aufstehen"] },
  { grundform: "dürfen", art: "eigen", stufe: 3, formen: "darf darfst darf dürfen dürft dürfen", saetze: ["lange aufbleiben", "mitspielen"], falsch: { er: "darft" } },
  { grundform: "mögen", art: "eigen", stufe: 3, formen: "mag magst mag mögen mögt mögen", saetze: ["Schokolade", "Katzen"], falsch: { er: "magt" } },
  { grundform: "wissen", art: "eigen", stufe: 3, formen: "weiß weißt weiß wissen wisst wissen", saetze: ["die Antwort", "den Weg"] },
];

/** Wer im Satz vorne steht, je Person; bei er und sie (mehrere) auch Namen, nie das mehrdeutige „Sie“ am Satzanfang. */
const SUBJEKTE: Record<Person, { wort: string; als?: string }[]> = {
  ich: [{ wort: "ich" }],
  du: [{ wort: "du" }],
  er: [{ wort: "er" }, { wort: "Lisa", als: "sie" }, { wort: "Tom", als: "er" }, { wort: "die Oma", als: "sie" }, { wort: "mein Bruder", als: "er" }],
  wir: [{ wort: "wir" }],
  ihr: [{ wort: "ihr" }],
  sie: [{ wort: "die Kinder" }, { wort: "Lea und Ben" }, { wort: "meine Freunde" }],
};
/** So beginnt ein Satz, in dem das Verb vor der Person steht. */
const ANFAENGE = ["Heute", "Jetzt", "Am Montag", "Im Sommer", "Am Nachmittag"];

const PERSON_STUFE: Record<Person, Stufe> = { ich: 0, du: 0, er: 0, wir: 0, ihr: 1, sie: 1 };
const PERSON_NAME: Record<Person, string> = { ich: "ich", du: "du", er: "er, sie, es", wir: "wir", ihr: "ihr", sie: "sie (mehrere)" };
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formenVon(v: Pick<Verb, "formen">): Record<Person, string> {
  const f = v.formen.split(" ");
  if (f.length !== 6) throw new Error(`Verben beugen: „${v.formen}“ hat nicht sechs Formen`);
  return Object.fromEntries(PERSONEN.map((p, i) => [p, f[i]])) as Record<Person, string>;
}

/**
 * Die Kacheln einer Karte: die richtige Form, die typische falsche für diese Person und die übrigen Formen des Verbs,
 * höchstens vier. Sie stehen immer in derselben Reihenfolge (ich, du, er … mit der falschen neben der richtigen), damit
 * die Hand sich die Plätze merkt.
 */
export function kachelnFuer(v: Verb, person: Person): string[] {
  const f = formenVon(v);
  const reihe: string[] = [];
  for (const p of PERSONEN) {
    if (!reihe.includes(f[p])) reihe.push(f[p]);
    const falsch = v.falsch?.[p];
    if (falsch && !reihe.includes(falsch)) reihe.push(falsch);
  }
  const richtig = f[person];
  const vorrang = [richtig, v.falsch?.[person], ...reihe].filter((x): x is string => Boolean(x));
  const vier = [...new Set(vorrang)].slice(0, 4);
  return reihe.filter((x) => vier.includes(x));
}

/** Die Regel nach einem Fehler, für genau diese Form. `als`: für wen ein Name steht („Lisa“ → sie). */
export function beugenRegel(v: Verb, person: Person, subjekt: { wort: string; als?: string }): string {
  const f = formenVon(v);
  const form = f[person];
  const pron = person === "er" ? (subjekt.als ?? subjekt.wort) : person === "sie" ? "sie" : person;
  const wer = subjekt.wort.toLowerCase() !== pron ? `„${gross(subjekt.wort)}“ ist wie „${pron}“${person === "sie" ? " (mehrere)" : ""}. ` : "";
  const g = `„${v.grundform}“`;
  if (v.art === "eigen") {
    const alle = `ich ${f.ich}, du ${f.du}, er ${f.er}, wir ${f.wir}, ihr ${f.ihr}, sie ${f.sie}`;
    const extra = v.grundform === "sein" && person === "ihr" ? " „seid“ schreibt man mit d. „seit“ mit t heißt: seit gestern." : "";
    return `${wer}${g} hat eigene Formen: ${alle}.${extra}`;
  }
  if (v.art === "wechsel" && (person === "du" || person === "er")) return `${wer}${g} ändert bei „du“ und „er, sie, es“ den Selbstlaut: du ${f.du}, er ${f.er}.`;
  if (v.art === "wechsel") return `${wer}Bei „${PERSON_NAME[person]}“ bleibt der Selbstlaut wie in ${g}: ${pron} ${form}.`;
  if (v.art === "sz" && person === "du") return `${g} hat schon ein ${v.grundform.includes("z") ? "z" : "s"} am Ende des Stamms. Bei „du“ kommt darum nur -t dazu: du ${form}.`;
  if (v.art === "td" && (person === "du" || person === "er" || person === "ihr"))
    return `${wer}Bei ${g} kommt ein e dazu, damit man es gut sprechen kann: du ${f.du}, er ${f.er}, ihr ${f.ihr}.`;
  switch (person) {
    case "ich":
      return `Bei „ich“ endet das Verb auf -e: ich ${form}.`;
    case "du":
      return `Bei „du“ endet das Verb auf -st: du ${form}.`;
    case "er":
      return `${wer}Bei „er, sie, es“ endet das Verb auf -t: ${pron} ${form}.`;
    case "wir":
      return `Bei „wir“ heißt das Verb wie die Grundform: wir ${form}.`;
    case "ihr":
      return `Bei „ihr“ endet das Verb auf -t: ihr ${form}.`;
    case "sie":
      return `${wer}Bei „sie“ (mehrere) heißt das Verb wie die Grundform: sie ${form}.`;
  }
}

export const beugenKey = (loesung: string) => `konjugieren:${loesung}`;

/**
 * Alle Karten: je Verb und Person beide Satzenden, und das erste noch einmal mit dem Verb vor der Person („Heute gehst
 * du in die Schule.“). Dasselbe Verb mit derselben Person kommt nicht zweimal in eine Runde (`gruppe`).
 */
export function beugenKandidaten(): { karte: SpielKarte; stufe: Stufe; gruppe: string }[] {
  const out: { karte: SpielKarte; stufe: Stufe; gruppe: string }[] = [];
  let nr = 0;
  for (const v of VERBEN) {
    const f = formenVon(v);
    const grund = Math.max(ART_STUFE[v.art], v.stufe ?? 0);
    for (const person of PERSONEN) {
      const faecher = kachelnFuer(v, person);
      const varianten: { ende: string; anfang?: string }[] = [{ ende: v.saetze[0] }, { ende: v.saetze[1] }, { ende: v.saetze[0], anfang: ANFAENGE[nr % ANFAENGE.length] }];
      for (const [i, va] of varianten.entries()) {
        const subjekt = SUBJEKTE[person][(nr + i) % SUBJEKTE[person].length];
        nr++;
        const form = f[person];
        // „Ich ___ gern Fußball.“ oder „Heute ___ ich gern Fußball.“
        const vor = va.anfang ? `${va.anfang} ` : `${gross(subjekt.wort)} `;
        const nach = va.anfang ? ` ${subjekt.wort} ${va.ende}.` : ` ${va.ende}.`;
        const loesung = `${vor}${form}${nach}`;
        out.push({
          karte: {
            key: beugenKey(loesung),
            vor,
            nach,
            hinweis: `(${v.grundform})`,
            faecher,
            richtig: form,
            loesung,
            regel: beugenRegel(v, person, subjekt),
            kurz: `${person === "er" || person === "sie" ? (person === "er" ? (subjekt.als ?? "er") : "sie") : person} ${form}`,
          },
          stufe: Math.min(3, Math.max(grund, PERSON_STUFE[person]) + (va.anfang ? 1 : 0)) as Stufe,
          gruppe: `konjugieren:${v.grundform}:${person}`,
        });
      }
    }
  }
  return out;
}
