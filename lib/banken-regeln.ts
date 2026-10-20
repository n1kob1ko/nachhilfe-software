/**
 * Fachliche Regeln der Aufgabenbanken (`data/banks/`), ohne KI.
 *
 * `eintragFehler()` sagt, was an einem Eintrag nicht stimmt: ein Satz, der sich aus seinen Teilen nicht
 * wieder zu seiner Lösung zusammensetzen lässt, eine richtige Antwort, die zugleich als Fehler gilt, eine
 * Lücke, die „-“ oder nichts erwartet, ein Wort mit zwei Bedeutungen ohne Hinweis, ein Satz, in dem
 * Dativ und Akkusativ passen … Geprüft wird jeder Eintrag der Dateien (`lib/banken.test.ts`) und jeder
 * Eintrag, den die KI in Bankform liefert (`lib/ai/banken.ts`). Die Regel des Projekts: lieber eine
 * Aufgabe weniger als eine, die Richtiges als falsch anstreicht.
 *
 * `bankStufe()` schätzt, wie schwer ein Eintrag ist (0 = sehr leicht … 3 = schwer), damit die
 * Generatoren die eingestellte Schwierigkeit einhalten (`lib/generators.ts`). Die Stufe kommt aus den
 * Daten selbst (Thema des Wortes, Fall, Verbform), nicht aus einem eigenen Feld.
 *
 * Was hier geprüft wird und warum, steht in docs/banks-pruefung.md.
 */
import { GAP, gapCount } from "./tasks";
import type { AdjektivdeklinationItem, ArtikelItem, BankId, BankItem, ClozeItem, DasDassItem, HauptsatzGliedsatzItem, PraepositionenItem } from "./banks";

type Artikel = "der" | "die" | "das";

// ---------- Artikel ----------

/**
 * Wörter mit zwei Bedeutungen und verschiedenem Artikel (der See, die See). Ohne `meaning` in der Aufgabe
 * ist hier mehr als ein Artikel richtig.
 */
export const ZWEI_BEDEUTUNGEN = new Set([
  "Band", "Bauer", "Bord", "Bulle", "Bund", "Ekel", "Elf", "Erbe", "Flur", "Gefallen", "Gehalt", "Golf", "Harz", "Heide",
  "Hut", "Junge", "Kiefer", "Kiwi", "Korn", "Kristall", "Kunde", "Lama", "Laster", "Leiter", "Mangel", "Mark", "Marsch",
  "Mast", "Messer", "Moment", "Otter", "Plastik", "Pony", "Reis", "Schild", "See", "Service", "Single", "Steuer", "Stift", "Tau",
  "Tor", "Verdienst", "Wehr", "Weise",
]);

/**
 * Wörter, die mit mehr als einem Artikel richtig sind (Duden oder Österreichisches Wörterbuch): jeder
 * davon muss angenommen werden. In der Bank steht der zweite Artikel in `alsoArticle`.
 */
export const MEHRERE_ARTIKEL: Record<string, Artikel[]> = {
  // in Österreich üblich, im Duden als österreichisch vermerkt
  Keks: ["der", "das"],
  Polster: ["das", "der"],
  Paprika: ["die", "der"],
  Sakko: ["das", "der"],
  Gulasch: ["das", "der"],
  Vokabel: ["die", "das"],
  "E-Mail": ["die", "das"],
  SMS: ["die", "das"],
  Cola: ["die", "das"],
  Prospekt: ["der", "das"],
  Pyjama: ["der", "das"],
  // im Duden mit drei Artikeln (die Joghurt österreichisch): keine Aufgabe möglich
  Joghurt: ["der", "das", "die"],
  // im Duden mit zwei Artikeln
  Dschungel: ["der", "das"],
  Bonbon: ["das", "der"],
  Teil: ["der", "das"],
  Virus: ["das", "der"],
  Blog: ["der", "das"],
  Laptop: ["der", "das"],
  App: ["die", "das"],
  Thermostat: ["der", "das"],
  Abscheu: ["der", "die"],
  Gummi: ["der", "das"],
  Haargummi: ["das", "der"],
  Kaugummi: ["der", "das"],
  Liter: ["der", "das"],
  Meter: ["der", "das"],
  Spray: ["das", "der"],
  Gelee: ["das", "der"],
  Ketchup: ["der", "das"],
  Curry: ["das", "der"],
  Filter: ["der", "das"],
  Burnout: ["das", "der"],
  Event: ["das", "der"],
  Dotter: ["der", "das"],
  Knäuel: ["der", "das"],
  Hektar: ["der", "das"],
  Spind: ["der", "das"],
  Katapult: ["das", "der"],
  Radar: ["der", "das"],
  Match: ["das", "der"],
};

/** Nomen, die es nur im Plural gibt (oder hier im Plural stehen): „die“ ist dann kein Genus. */
export const NUR_PLURAL = new Set(["Eltern", "Leute", "Ferien", "Kosten", "Geschwister", "Finanzen", "Schulden", "Vitamine", "Alpen", "Masern", "Spaghetti", "Pommes", "Shorts", "Trümmer", "Zwillinge", "Kenntnisse"]);

/** Substantivierte Adjektive und Partizipien: der Bekannte und die Bekannte sind beide richtig. */
export const BEIDE_GESCHLECHTER = new Set([
  "Abgeordnete", "Angeklagte", "Angestellte", "Beamte", "Bekannte", "Deutsche", "Erwachsene", "Fremde", "Gefangene",
  "Geliebte", "Jugendliche", "Kranke", "Reisende", "Verdächtige", "Verletzte", "Verlobte", "Verstorbene", "Verwandte",
  "Vorgesetzte", "Vorsitzende", "Ahne", "Waise",
]);

function artikelFehler(item: ArtikelItem): string[] {
  const out: string[] = [];
  const word = item.word;
  if (word !== word.trim() || /\s{2,}/.test(word)) out.push(`„${word}“: Leerzeichen am Rand oder doppelt`);
  if (!/^[A-ZÄÖÜ]/.test(word)) out.push(`„${word}“: ein Nomen beginnt mit einem Großbuchstaben`);
  if (NUR_PLURAL.has(word)) out.push(`„${word}“ steht im Plural: „die“ ist hier kein Genus`);
  if (BEIDE_GESCHLECHTER.has(word)) out.push(`„${word}“: der und die sind beide richtig (eine Person kann Mann oder Frau sein)`);
  if (ZWEI_BEDEUTUNGEN.has(word) && !item.meaning?.trim()) out.push(`„${word}“ hat zwei Bedeutungen mit verschiedenem Artikel: die Aufgabe braucht „meaning“`);
  const auch = item.alsoArticle ?? [];
  if (auch.includes(item.article)) out.push(`„${word}“: alsoArticle wiederholt den Artikel „${item.article}“`);
  if (new Set(auch).size !== auch.length) out.push(`„${word}“: alsoArticle doppelt`);
  const richtig = MEHRERE_ARTIKEL[word];
  if (richtig?.length === 3) out.push(`„${word}“: der, die und das sind alle richtig, das Wort ist keine Aufgabe`);
  else if (richtig) {
    const hier = new Set([item.article, ...auch]);
    const fehlt = richtig.filter((a) => !hier.has(a));
    if (fehlt.length) out.push(`„${word}“: auch ${fehlt.map((a) => `„${a}“`).join(" und ")} ist richtig und muss in alsoArticle stehen`);
  } else if (auch.length) {
    out.push(`„${word}“: alsoArticle nur für Wörter aus MEHRERE_ARTIKEL (lib/banken-regeln.ts), damit jede Ausnahme geprüft ist`);
  }
  if (item.meaning !== undefined && (!item.meaning.trim() || /[()]/.test(item.meaning))) out.push(`„${word}“: meaning leer oder mit Klammern`);
  return out;
}

// ---------- Adjektivdeklination ----------

/** Eine Endung in der Schreibweise der Bank: „-en“, „-s“ oder „-“ für keine Endung. */
const ENDUNG = /^-[a-zäöüß]*$/;
/** Die Endung ohne Bindestrich, so wie sie im Satz steht („-“ wird zu nichts). */
export const endungImSatz = (e: string) => e.replace(/^-/, "");

/** Begleiter im Dativ Singular (dem, einem, meinem …) und die Verschmelzungen (im, am, vom …). */
const DATIV_BEGLEITER = /^(?:[a-zäöü]*em|im|am|vom|zum|beim)$/i;

/** Präpositionen mit Genitiv: der Satz übt dann den Genitiv. */
const GENITIV_PRAEPOSITION = new Set(["wegen", "trotz", "während", "statt", "anstatt", "anstelle", "aufgrund", "anlässlich", "infolge", "innerhalb", "außerhalb", "jenseits", "oberhalb", "unterhalb", "inmitten", "mithilfe", "ungeachtet", "bezüglich"]);

/**
 * Welche Genitivendungen ein Nomen (der/das, Singular) annimmt. Nach s, ß, x, z und sch nur -es; nach
 * Vokal, nach unbetontem -el, -er, -en, -em, -ig (Lehrer, Honig, aber nicht Tier, Spiel, Teig), nach
 * -chen, -lein, -ling und lateinischem -um (Museum, aber nicht Baum) nur -s; sonst sind -s und -es beide
 * richtig (des Tags, des Tages). Wenige Wörter nehmen nur -s.
 */
export function genitivEndungen(nomen: string): ("-s" | "-es")[] {
  const n = nomen.trim();
  const l = n.toLowerCase();
  if (/(s|ß|x|z|sch)$/.test(l)) return ["-es"];
  if (/[aeiouäöüy]$/.test(l) || /((?<![aeiouäöü])(el|er|en|em|ig)|chen|lein|ling|(?<!a)um)$/.test(l) || NUR_GENITIV_S.has(n)) return ["-s"];
  return ["-s", "-es"];
}
const NUR_GENITIV_S = new Set(["Restaurant", "Chef", "Grill", "Hotel", "Abend", "Kamin"]);

function adjektivFehler(item: AdjektivdeklinationItem): string[] {
  const out: string[] = [];
  const kurz = item.solution;
  const teile = [item.prefix, item.middle, item.suffix];
  if (teile.some((t) => /\.\.\.|…/.test(t))) out.push(`${kurz}: Auslassungspunkte im Satz (die Lücke sitzt an der falschen Stelle)`);
  for (const [name, list, correct] of [
    ["options1", item.options1, item.correct1],
    ["options2", item.options2, item.correct2],
  ] as const) {
    if (!list.every((o) => ENDUNG.test(o))) out.push(`${kurz}: ${name} enthält etwas anderes als Endungen (${list.join(", ")})`);
    if (new Set(list).size !== list.length) out.push(`${kurz}: ${name} enthält eine Endung doppelt`);
    if (list.filter((o) => o === correct).length !== 1) out.push(`${kurz}: die richtige Endung „${correct}“ steht nicht genau einmal in ${name}`);
  }
  if (!ENDUNG.test(item.correct1) || item.correct1 === "-") out.push(`${kurz}: correct1 „${item.correct1}“ ist keine Adjektivendung`);
  if (!ENDUNG.test(item.correct2)) out.push(`${kurz}: correct2 „${item.correct2}“ ist keine Endung`);
  for (const e of item.alsoCorrect2 ?? []) {
    if (!ENDUNG.test(e) || e === item.correct2) out.push(`${kurz}: alsoCorrect2 „${e}“ ist keine weitere Endung`);
    if (item.options2.includes(e)) out.push(`${kurz}: „${e}“ ist richtig und steht trotzdem als falsche Option in options2`);
  }
  // der Satz aus seinen Teilen mit den richtigen Endungen muss genau die Lösung sein
  const satz = `${item.prefix}${endungImSatz(item.correct1)}${item.middle}${endungImSatz(item.correct2)}${item.suffix}`;
  if (satz !== item.solution) out.push(`${kurz}: aus den Teilen wird „${satz}“`);
  for (const e of item.alsoCorrect2 ?? []) {
    const auch = `${item.prefix}${endungImSatz(item.correct1)}${item.middle}${endungImSatz(e)}${item.suffix}`;
    if (auch === item.solution) out.push(`${kurz}: alsoCorrect2 „${e}“ ergibt denselben Satz`);
  }
  if (!/[a-zäöüß]$/i.test(item.prefix)) out.push(`${kurz}: der Teil vor der ersten Lücke endet nicht mit dem Adjektivstamm`);
  if (!/^ [A-ZÄÖÜ]/.test(item.middle)) out.push(`${kurz}: der Teil zwischen den Lücken ist kein Nomen („${item.middle}“)`);
  if (!/^([ ,.!?;:]|$)/.test(item.suffix)) out.push(`${kurz}: nach dem Nomen fehlt ein Leerzeichen oder Satzzeichen`);
  // die Genitivendung: -s und -es, wenn beide richtig sind
  const nomen = item.middle.trim();
  const woerter = item.prefix.trim().split(/\s+/);
  const begleiter = woerter.length >= 2 ? woerter[woerter.length - 2] : "";
  if (item.correct2 === "-s" || item.correct2 === "-es") {
    const richtig = genitivEndungen(nomen);
    const angenommen = new Set([item.correct2, ...(item.alsoCorrect2 ?? [])]);
    for (const r of richtig) if (!angenommen.has(r)) out.push(`${kurz}: „${nomen}${endungImSatz(r)}“ ist auch richtig und wird nicht angenommen`);
    for (const a of angenommen) if ((a === "-s" || a === "-es") && !(richtig as string[]).includes(a)) out.push(`${kurz}: „${nomen}${endungImSatz(a)}“ gilt als richtig, ist es aber nicht`);
  }
  // Dativ Singular: „dem Kinde“ ist veraltet, aber nicht falsch: „-e“ ist dort keine gute falsche Option
  if (DATIV_BEGLEITER.test(begleiter) && item.correct2 === "-" && item.options2.includes("-e")) out.push(`${kurz}: „${nomen}e“ (Dativ-e) ist veraltet, aber nicht falsch: „-e“ nicht als falsche Option`);
  // Sätze, in denen eine andere Kombination der beiden Endungen auch richtig ist. Die Lücken werden
  // einzeln geprüft, darum muss jede Lücke genau eine Lösung haben, die zur anderen passt.
  if (!ADJEKTIV_EINDEUTIG.has(item.solution)) {
    if (!BEGLEITER.test(begleiter)) out.push(`${kurz}: ohne Begleiter passen oft mehrere Endungen (kühles Wasser, kühlen Wassers, Einzahl oder Mehrzahl): nur von Hand geprüfte Sätze`);
    else if (SCHWANKENDER_BEGLEITER.test(begleiter)) out.push(`${kurz}: nach „${begleiter}“ schwankt die Adjektivendung`);
    else if (DER_ODER_MEHRZAHL.test(begleiter) && genitivVor(woerter)) out.push(`${kurz}: „${begleiter}“ im Genitiv passt zu Einzahl und Mehrzahl (der roten Rose, der roten Rosen)`);
    else if (DIE_ODER_MEHRZAHL.test(begleiter)) out.push(`${kurz}: „${begleiter}“ passt zu Einzahl und Mehrzahl (die rote Rose, die roten Rosen)`);
  }
  if (SCHWANKENDES_NOMEN.has(nomen)) out.push(`${kurz}: „${nomen}“ wird auf zwei Arten dekliniert (des Nachbarn, des Nachbars)`);
  return out;
}

/** Begleiter: Artikel, Possessiv- und Demonstrativwörter, Verschmelzungen. Ohne ihn steht das Adjektiv allein. */
const BEGLEITER = /^(der|die|das|den|dem|des|ein|im|am|vom|zum|beim|zur|ins|ans|aufs|(ein|kein|mein|dein|sein|ihr|unser|eur|euer|dies|jen|jed|welch|manch)(e|en|em|er|es)?)$/i;
/** Nach diesen Wörtern schwankt die Endung (alle guten / alle gute, beide neuen / beide neue). */
const SCHWANKENDER_BEGLEITER = /^(alle|beide|einige|manche|mehrere|viele|wenige|solche|sämtliche|folgende|andere|irgendwelche)$/i;
/** Genitiv/Dativ feminin und Genitiv Plural sehen gleich aus: der Rose, der Rosen. */
const DER_ODER_MEHRZAHL = /^(der|dieser|jener|keiner|meiner|deiner|seiner|ihrer|unserer|eurer)$/i;
/** Nominativ/Akkusativ feminin und Plural sehen gleich aus: die Rose, die Rosen. */
const DIE_ODER_MEHRZAHL = /^(die|diese|jene|keine|meine|deine|seine|ihre|unsere|eure)$/i;
/** Nomen, die stark und schwach dekliniert werden (des Nachbarn und des Nachbars). */
const SCHWANKENDES_NOMEN = new Set(["Nachbar", "Bauer", "Bär", "Spatz", "Fels", "Oberst", "Untertan"]);

/** Steht der Begleiter (vorletztes Wort) im Genitiv? Davor steht dann ein Nomen oder eine Präposition mit Genitiv. */
function genitivVor(woerter: string[]): boolean {
  if (woerter.length < 3) return false;
  const davor = woerter[woerter.length - 3];
  return GENITIV_PRAEPOSITION.has(davor.toLowerCase()) || (woerter.length > 3 && /^[A-ZÄÖÜ]/.test(davor));
}

/**
 * Sätze ohne Begleiter oder mit „der“/„die“, die von Hand geprüft sind: nur eine Kombination der
 * Endungen ist richtig (das Verb in der Einzahl, ein Plural mit Umlaut, „viel“ vor dem Adjektiv).
 */
const ADJEKTIV_EINDEUTIG = new Set<string>([
  "Der Geschmack der exotischen Frucht war sehr süß.",
  "Dunkle Wolken ziehen am Himmel auf.",
  "Kühles Wasser erfrischt an heißen Tagen.",
  "Kaltes Wasser hilft gegen Verbrennungen.",
  "Flüssiger Honig lässt sich leicht verteilen.",
  "Frischer Saft enthält viele Vitamine.",
  "Frisches Brot riecht einfach wunderbar.",
  "Frischer Schinken schmeckt am besten.",
  "Warmer Kakao ist mein Lieblingsgetränk.",
  "Kalter Tee schmeckt im Sommer gut.",
  "Kalte Milch schmeckt mir am besten.",
  "Scharfes Essen ist nichts für mich.",
  "Süßer Nachtisch schmeckt fast allen Kindern.",
  "Mit viel geduldiger Arbeit schafft man alles.",
]);

// ---------- Präposition und Kasus ----------

const DATIV_PRAEPOSITION = new Set(["mit", "nach", "bei", "von", "zu", "aus", "seit", "gegenüber", "außer", "ab"]);
const AKKUSATIV_PRAEPOSITION = new Set(["durch", "für", "gegen", "ohne", "um", "bis", "entlang"]);
export const WECHSEL_PRAEPOSITION = new Set(["an", "auf", "hinter", "in", "neben", "über", "unter", "vor", "zwischen"]);

/** Der bestimmte Artikel je Genus und Fall. */
const FORM: Record<Artikel, { Nominativ: string; Akkusativ: string; Dativ: string }> = {
  der: { Nominativ: "der", Akkusativ: "den", Dativ: "dem" },
  die: { Nominativ: "die", Akkusativ: "die", Dativ: "der" },
  das: { Nominativ: "das", Akkusativ: "das", Dativ: "dem" },
};
/** Der Artikel für Genus und Fall (Singular). */
export const artikelForm = (genus: Artikel, kasus: "Dativ" | "Akkusativ") => FORM[genus][kasus];
/** In welchem Fall ein Artikel bei diesem Genus steht (null: passt zu keinem Fall dieses Genus). */
export function fallVon(genus: Artikel, artikel: string): "Nominativ" | "Akkusativ" | "Dativ" | null {
  const f = FORM[genus];
  if (artikel === f.Dativ && artikel !== f.Nominativ) return "Dativ";
  if (artikel === f.Akkusativ && artikel !== f.Nominativ) return "Akkusativ";
  if (artikel === f.Nominativ) return "Nominativ";
  return null;
}

/**
 * Verben der Bewegung: nach einer Wechselpräposition passen Dativ (wo?) und Akkusativ (wohin?), wenn kein
 * Richtungswort (hinein, hinauf …) den Fall festlegt. „Er läuft in das Haus“ und „Er läuft in dem Haus“
 * sind beide richtig.
 */
const BEWEGUNG = /(?<![\wäöüß])(geh|ging|lauf|läuf|lief|renn|rann|flieg|flog|fahr|fähr|fuhr|schwimm|schwamm|spring|sprang|kletter|spazier|wander|schleich|schlich|hüpf|kriech|kroch|reit|ritt|roll|tanz|jogg|rutsch|segel|paddel|steig|stieg|verschwind|verschwand)/;
const RICHTUNGSWORT = /(?<![\wäöüß])(hinein|hinauf|hinunter|hinüber|hinaus|hinab|herein|herauf|herunter|herüber|heraus|herab)(?![\wäöüß])/;
/** Verben der Lage (wo?): mit Akkusativ ist der Satz falsch oder doppeldeutig. */
const LAGE = /(?<![\wäöüß])(steh|stand|lieg|lag|sitz|saß|wohn|wart|arbeit|schläf|schlaf|parkt|klebt|lehnt|wächst|bleib|blieb|treff|bade|ankert|spiel|hält|halt)/;
/** Verben der Richtung (wohin?): mit Dativ ist der Satz falsch oder doppeldeutig. */
const RICHTUNG = /(?<![\wäöüß])(stell|leg|setz|werf|wirf|warf|steck|schieb|gieß|schütt|bring|füll|pack|räum|kleb|häng)/;
/** Verben, bei denen beide Fälle üblich sind (auf einen/einem Zettel schreiben, in das/dem Zimmer passen). */
const BEIDE_FAELLE = /(?<![\wäöüß])(pass|park|schreib|versteck)/;

function praepositionFehler(item: PraepositionenItem): string[] {
  const out: string[] = [];
  const kurz = item.solution;
  const satz = `${item.prefix}${item.correct} ${item.noun}${item.suffix}`;
  if (satz !== item.solution) out.push(`${kurz}: aus den Teilen wird „${satz}“`);
  if (!item.prefix.endsWith(" ")) out.push(`${kurz}: der Teil vor der Lücke endet nicht mit einem Leerzeichen`);
  if (/\.\.\.|…/.test(item.prefix + item.suffix)) out.push(`${kurz}: Auslassungspunkte im Satz`);
  if (new Set(item.options).size !== item.options.length) out.push(`${kurz}: eine Option steht doppelt`);
  if (item.options.filter((o) => o === item.correct).length !== 1) out.push(`${kurz}: die Lösung steht nicht genau einmal in den Optionen`);
  const praeposition = item.prefix.trim().split(/\s+/).pop()!.toLowerCase();
  const wechsel = WECHSEL_PRAEPOSITION.has(praeposition);
  if (!wechsel && !DATIV_PRAEPOSITION.has(praeposition) && !AKKUSATIV_PRAEPOSITION.has(praeposition)) out.push(`${kurz}: „${praeposition}“ vor der Lücke ist keine bekannte Präposition`);
  if (item.kasus === null) {
    out.push(`${kurz}: der Fall fehlt`);
    return out;
  }
  if (DATIV_PRAEPOSITION.has(praeposition) && item.kasus !== "Dativ") out.push(`${kurz}: „${praeposition}“ verlangt den Dativ`);
  if (AKKUSATIV_PRAEPOSITION.has(praeposition) && item.kasus !== "Akkusativ") out.push(`${kurz}: „${praeposition}“ verlangt den Akkusativ`);
  if (item.correct !== artikelForm(item.article, item.kasus)) out.push(`${kurz}: „${item.correct}“ ist nicht der ${item.kasus} von „${item.article} ${item.noun}“`);
  if (wechsel) {
    // Verben klein, Nomen groß: am Satzanfang wird der erste Buchstabe klein gelesen („Stell …“)
    const rest = `${item.prefix.charAt(0).toLowerCase()}${item.prefix.slice(1)} ${item.suffix}`;
    if (BEIDE_FAELLE.test(rest) && !EINDEUTIG.has(item.solution)) out.push(`${kurz}: bei diesem Verb passen nach „${praeposition}“ oft Dativ und Akkusativ`);
    if (BEWEGUNG.test(rest) && !RICHTUNGSWORT.test(rest) && !EINDEUTIG.has(item.solution))
      out.push(`${kurz}: Bewegungsverb ohne Richtungswort nach „${praeposition}“: Dativ und Akkusativ passen`);
    if (item.kasus === "Akkusativ" && LAGE.test(rest) && !RICHTUNG.test(rest) && !EINDEUTIG.has(item.solution)) out.push(`${kurz}: Akkusativ bei einem Verb der Lage`);
    if (item.kasus === "Dativ" && RICHTUNG.test(rest) && !LAGE.test(rest) && !EINDEUTIG.has(item.solution)) out.push(`${kurz}: Dativ bei einem Verb der Richtung`);
  }
  return out;
}

/**
 * Sätze mit Wechselpräposition, die die Regeln oben verdächtig finden, die aber von Hand geprüft und
 * eindeutig sind (zum Beispiel hängen: „Die Jacke hängt“ ist Lage, „Ich hänge die Jacke“ Richtung).
 */
const EINDEUTIG = new Set<string>([
  "Das Handtuch hängt neben der Dusche.",
  "Der Spiegel hängt in dem Vorzimmer.",
  "Die Jacke hängt an der Garderobe.",
  "Die Lampe hängt über dem Esstisch.",
  "Das Poster klebt an der Tür.",
  "Das Bild hängt schief an der Wand.",
  "Der Mantel hängt hinter der Tür.",
  "Das Auto parkt vor dem Haus.",
]);

// ---------- Lückentexte: Präteritum, Perfekt, das/dass ----------

const HILFSVERB_HABEN = new Set(["habe", "hast", "hat", "haben", "habt"]);
const HILFSVERB_SEIN = new Set(["bin", "bist", "ist", "sind", "seid"]);
/** Verben, die das Perfekt in Österreich mit „sein“, in Deutschland mit „haben“ bilden (oder je nach Satz). */
const SEIN_ODER_HABEN = new Set(["sitzen", "liegen", "stehen", "schwimmen", "hängen", "tanzen", "reiten", "joggen", "paddeln", "segeln", "rudern"]);

/** Die Grundform in der Klammer am Satzende: „(fahren)“ oder „(fahren, Präteritum)“. */
export function grundformVon(q: string): string | null {
  return q.match(/\(([a-zäöüß]+)(?:, [A-ZÄÖÜ][a-zäöü]+)?\)\s*$/)?.[1] ?? null;
}

/** Der Satz eines Lückentexts ohne die Anweisung davor („Setze … ein: “) und ohne die Klammer am Ende. */
export const satzVon = (q: string) => q.replace(/^[^:]*:\s+(?=\S)/, "").replace(/\s*\([^)]*\)\s*$/, "");

function lueckentextFehler(id: "praeteritum" | "perfekt" | "das-dass", item: ClozeItem): string[] {
  const out: string[] = [];
  const kurz = item.q;
  const gaps = gapCount(item.q);
  if (gaps !== item.blanks.length) out.push(`${kurz}: ${gaps} Lücken im Satz, aber ${item.blanks.length} Lösungen`);
  if (/\.\.\.|…/.test(item.q)) out.push(`${kurz}: Auslassungspunkte im Satz`);
  if (/ {2,}/.test(item.q) || item.q !== item.q.trim()) out.push(`${kurz}: doppeltes Leerzeichen oder Leerzeichen am Rand`);
  if (id !== "das-dass" && new RegExp(`${GAP}\\s*${GAP}`).test(item.q)) out.push(`${kurz}: zwei Lücken direkt hintereinander`);
  const caseSensitive = id !== "das-dass";
  const norm = (s: string) => (caseSensitive ? s.trim() : s.trim().toLowerCase());
  const richtig = new Set(item.blanks.flat().map(norm));
  for (const blank of item.blanks) {
    for (const alt of blank) if (/^[-–—]?$/.test(alt.trim())) out.push(`${kurz}: eine Lücke erwartet „${alt}“ (nichts oder einen Strich)`);
    if (new Set(blank.map(norm)).size !== blank.length) out.push(`${kurz}: eine Lösung steht doppelt in derselben Lücke`);
  }
  for (const [answer, label] of Object.entries(item.errors ?? {})) {
    if (richtig.has(norm(answer))) out.push(`${kurz}: „${answer}“ ist richtig und steht zugleich als Fehler („${label}“)`);
    if (!label.trim()) out.push(`${kurz}: Fehler „${answer}“ ohne Bezeichnung`);
  }
  if (!item.hint.trim()) out.push(`${kurz}: keine Hilfe`);
  for (const blank of item.blanks) if (!norm(item.solution).includes(norm(blank[0]))) out.push(`${kurz}: die Lösung „${item.solution}“ nennt „${blank[0]}“ nicht`);
  if (id === "praeteritum" || id === "perfekt") {
    const grundform = grundformVon(item.q);
    if (!grundform) out.push(`${kurz}: die Grundform des Verbs steht nicht in Klammern am Satzende`);
    // der Fehlertext nennt das Verb aus der Klammer (anrufen, nicht rufen)
    for (const label of Object.values(item.errors ?? {})) {
      const verb = /von „([^“]+)“/.exec(label)?.[1];
      if (grundform && verb && verb !== grundform) out.push(`${kurz}: der Fehlertext nennt „${verb}“, in der Klammer steht „${grundform}“`);
    }
    // „Sie ___“ oder „___ sie“: sie (Einzahl) und sie/Sie (Mehrzahl) sind beide möglich
    if (/(^|\s)[Ss]ie ___|___ [Ss]ie(?![\wäöüß])/.test(satzVon(item.q)) && item.blanks[0].length < 2) out.push(`${kurz}: „sie“ als Subjekt ist Einzahl oder Mehrzahl, angenommen wird nur eine Form`);
    if (id === "perfekt") {
      const hilfsverb = item.blanks[0];
      const haben = hilfsverb.some((h) => HILFSVERB_HABEN.has(h));
      const sein = hilfsverb.some((h) => HILFSVERB_SEIN.has(h));
      if (item.blanks.length !== 2) out.push(`${kurz}: Perfekt braucht zwei Lücken (Hilfsverb und Partizip II)`);
      else if (!haben && !sein) out.push(`${kurz}: die erste Lücke ist kein Hilfsverb (haben oder sein)`);
      if (grundform && SEIN_ODER_HABEN.has(grundform) && !(haben && sein)) out.push(`${kurz}: „${grundform}“ bildet das Perfekt mit sein oder haben, angenommen wird nur eines`);
    }
  }
  if (id === "das-dass") {
    if (!item.q.startsWith("Setze „das“ oder „dass“ ein: ")) out.push(`${kurz}: die Anweisung fehlt`);
    for (const alt of item.blanks.flat()) if (!/^(das|dass)$/i.test(alt)) out.push(`${kurz}: „${alt}“ ist weder das noch dass`);
    // die Lösung ist der ganze Satz, außer bei den Einträgen, die eine Begründung als Lösung haben
    if (!/→|: |„/.test(item.solution)) {
      let s = satzVon(item.q);
      for (const b of item.blanks) s = s.replace(GAP, b[0]);
      if (s !== item.solution) out.push(`${kurz}: aus Satz und Lösungen wird „${s}“`);
    }
  }
  return out;
}

// ---------- Hauptsatz und Gliedsatz ----------

const EINLEITEWORT = new Set(["weil", "dass", "obwohl", "wenn", "da", "damit", "nachdem", "während", "als", "ob", "bevor", "falls", "sobald", "seit", "seitdem", "bis", "sodass", "indem", "solange", "der", "die", "das", "wer", "was", "wo", "wie"]);

function satzteileFehler(item: HauptsatzGliedsatzItem): string[] {
  const out: string[] = [];
  const kurz = item.parts.map((p) => p.text).join(" ");
  for (const p of item.parts) if (p.text !== p.text.trim() || / {2,}/.test(p.text) || /\.\.\.|…/.test(p.text)) out.push(`${kurz}: „${p.text}“ hat Leerzeichen am Rand, doppelte Leerzeichen oder Auslassungspunkte`);
  const gs = item.parts.find((p) => p.type === "GS");
  const erstes = gs?.text.split(/\s+/)[0].replace(/[,]/g, "").toLowerCase() ?? "";
  if (!EINLEITEWORT.has(erstes)) out.push(`${kurz}: der Gliedsatz beginnt nicht mit einem Einleitewort („${erstes}“)`);
  if (!/[.!?]$/.test(item.parts[1].text)) out.push(`${kurz}: der Satz endet nicht mit einem Satzzeichen`);
  if (!item.parts[0].text.endsWith(",")) out.push(`${kurz}: zwischen Haupt- und Gliedsatz fehlt der Beistrich`);
  return out;
}

// ---------- alle Banken ----------

/** Was an einem Eintrag nicht stimmt; leer, wenn er in Ordnung ist. */
export function eintragFehler<K extends BankId>(id: K, item: BankItem<K>): string[] {
  switch (id) {
    case "artikel":
      return artikelFehler(item as ArtikelItem);
    case "adjektivdeklination":
      return adjektivFehler(item as AdjektivdeklinationItem);
    case "praepositionen":
      return praepositionFehler(item as PraepositionenItem);
    case "praeteritum":
    case "perfekt":
      return lueckentextFehler(id, item as ClozeItem);
    case "das-dass":
      return lueckentextFehler("das-dass", item as DasDassItem);
    case "hauptsatz-gliedsatz":
      return satzteileFehler(item as HauptsatzGliedsatzItem);
    default:
      return [];
  }
}

// ---------- Schwierigkeit ----------

/** 0 = sehr leicht, 1 = leicht, 2 = mittel, 3 = schwer. */
export type Stufe = 0 | 1 | 2 | 3;

/** Endungen abstrakter Nomen (Freiheit, Ehrlichkeit, Bedeutung, Toleranz …): für Kinder schwerer. */
const ABSTRAKT = /(heit|keit|ung|ion|ismus|ität|schaft|nis|tum|enz|anz|ik|ie|ur)$/;
/** Wörter mit dem Thema „Einfach“, die ein Kind kennt, die aber nicht zu den ersten Wörtern gehören. */
const NICHT_SEHR_LEICHT = new Set(["Napf", "Pedal", "Plastik", "Rinde", "Samen", "Sattel", "Segel", "Senf", "Stamm", "Fels", "Asche", "Essig", "Hüfte", "Knöchel", "Muster", "Stoff", "Stecker", "Schein", "Kreide", "Laster"]);
/** Wörter mit dem Thema „Einfach“, die kein Alltagswort für ein Kind sind (Werkstatt, Bau, Körper innen). */
const NICHT_LEICHT = new Set(["Abgas", "Airbag", "Beton", "Diesel", "Dünger", "Feile", "Gips", "Hobel", "Kleister", "Lack", "Laminat", "Pollen", "Zement", "Visum", "Farn", "Kompost", "Mast", "Schilf", "Harke", "Parkett", "Zapfen", "Ziegel", "Acker", "Ahorn", "Alge", "Anker", "Leber", "Lunge", "Niere", "Wade", "Ferse", "Trichter", "Ruder", "Reibe", "Thermostat", "Scheuermilch", "Blitzableiter", "Kehrblech", "Satellitenschüssel", "Kennzeichen"]);

function artikelStufe(item: ArtikelItem): Stufe {
  const tags = new Set(item.tags);
  if (tags.has("Einfach")) {
    if (NICHT_LEICHT.has(item.word)) return 2;
    return item.word.length <= 6 && !NICHT_SEHR_LEICHT.has(item.word) && !item.meaning ? 0 : 1;
  }
  if (tags.has("charkteresierung") && !tags.has("Tiere") && !tags.has("Grusel")) return 3;
  return ABSTRAKT.test(item.word) ? 3 : 2;
}

function adjektivStufe(item: AdjektivdeklinationItem): Stufe {
  const woerter = item.prefix.trim().split(/\s+/).map((w) => w.toLowerCase());
  const begleiter = woerter.length >= 2 ? woerter[woerter.length - 2] : "";
  const genitiv =
    item.correct2 === "-s" ||
    item.correct2 === "-es" ||
    /^(des|eines|[a-zäöü]*es)$/.test(begleiter) ||
    woerter.some((w) => GENITIV_PRAEPOSITION.has(w)) ||
    /^(der|die|das) [a-zäöü]+ (der|des|eines|einer|meiner|meines|deiner|seiner|seines|ihrer|ihres|unserer|unseres)\b/i.test(item.prefix);
  if (genitiv) return 3;
  // n-Deklination (dem Jungen, den Kollegen) und Plural im Dativ
  if (item.correct2 === "-n" || item.correct2 === "-en" || item.correct2 === "-ns") return 3;
  if (DATIV_BEGLEITER.test(begleiter) || (begleiter === "der" && item.correct1 === "-en") || begleiter === "einer") return 2;
  // ohne Begleiter (Nullartikel): kaltes Wasser, frischer Saft
  if (!/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|mein|meine|meinen|dein|sein|ihr|unser|euer|jedem|jeder|jedes|diese|dieser|dieses|diesen)$/.test(begleiter)) return 2;
  return 1;
}

function praepositionStufe(item: PraepositionenItem): Stufe {
  const praeposition = item.prefix.trim().split(/\s+/).pop()!.toLowerCase();
  return WECHSEL_PRAEPOSITION.has(praeposition) ? 2 : 1;
}

/** Präteritum: schwache Verben leicht, starke und gemischte mittel, du und ihr schwer. */
function praeteritumStufe(item: ClozeItem): Stufe {
  const satz = satzVon(item.q);
  if (/^(Du|Ihr) /.test(satz) || /\b(du|ihr)\b/.test(satz)) return 3;
  const grundform = grundformVon(item.q);
  const form = item.blanks[0][0];
  const stamm = grundform?.replace(/e?n$/, "") ?? "";
  const schwach = stamm.length > 0 && form.startsWith(stamm) && /te(n|st|t)?$/.test(form);
  return schwach ? 1 : 2;
}

/** Perfekt: regelmäßig mit haben leicht, unregelmäßig oder mit sein mittel, trennbar, untrennbar und -ieren schwer. */
function perfektStufe(item: ClozeItem): Stufe {
  const grundform = grundformVon(item.q);
  const [hilfsverb, partizip] = [item.blanks[0]?.[0] ?? "", item.blanks[1]?.[0] ?? ""];
  if (!grundform || !partizip) return 2;
  // trennbar (aufgeräumt), untrennbar (verstanden, gewonnen) und -ieren (probiert): ohne ge- vorne;
  // bei gehen und geben steht das ge- vor dem Stamm (gegangen, gegeben), bei gewinnen nicht (gewonnen)
  if (!partizip.startsWith("ge") || (grundform.startsWith("ge") && !partizip.slice(2).startsWith("g"))) return 3;
  const stamm = grundform.replace(/(e?n)$/, "");
  const regelmaessig = partizip === `ge${stamm}t` || partizip === `ge${stamm}et`;
  return regelmaessig && HILFSVERB_HABEN.has(hilfsverb) ? 1 : 2;
}

function satzteileStufe(item: HauptsatzGliedsatzItem): Stufe {
  const gs = item.parts.find((p) => p.type === "GS")!;
  return /^(weil|wenn|dass)\b/i.test(gs.text) ? 1 : 2;
}

/** Wie schwer ein Eintrag ist; null, wo die Daten es nicht hergeben (das/dass). */
export function bankStufe<K extends BankId>(id: K, item: BankItem<K>): Stufe | null {
  switch (id) {
    case "artikel":
      return artikelStufe(item as ArtikelItem);
    case "adjektivdeklination":
      return adjektivStufe(item as AdjektivdeklinationItem);
    case "praepositionen":
      return praepositionStufe(item as PraepositionenItem);
    case "praeteritum":
      return praeteritumStufe(item as ClozeItem);
    case "perfekt":
      return perfektStufe(item as ClozeItem);
    case "hauptsatz-gliedsatz":
      return satzteileStufe(item as HauptsatzGliedsatzItem);
    default:
      return null;
  }
}
