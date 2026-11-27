/**
 * Lernspiel „Groß oder klein?“ (niko 2026-11-27, Stoff der 2. Deutschschularbeit einer 4. Klasse Volksschule:
 * „Nominalisierung von Verben nach zum, beim, vom und das“). Ein Satz mit Lücke, darunter dasselbe Verb zweimal:
 * groß und klein. Die Karte wird gewischt (links groß, rechts klein), ohne KI.
 *
 * Die Sätze stehen unten, das gefragte Wort in eckigen Klammern, so geschrieben, wie es richtig ist:
 * „Beim [Spielen] habe ich mir wehgetan.“ (groß), „Wir wollen heute [spielen].“ (klein). Die andere Kachel ist
 * dasselbe Wort mit dem anderen Anfangsbuchstaben.
 *
 * Die Regel nach einem Fehler sagt genau, was im Satz den Ausschlag gibt:
 * - groß: das Signalwort davor (zum, beim, vom, das), auch mit einem Adjektiv dazwischen („beim schnellen Laufen“);
 * - klein nach „zu“: „zu“ ist nicht „zum“ („Ich habe keine Lust zu lesen.“);
 * - sonst klein: hier ist es ein Verb, es sagt, was jemand tut.
 *
 * Stufen: 0 beim und zum, dagegen kurze Sätze mit dem Verb; 1 vom und das, dazu „zu“ gegen „zum“; 2 ein Adjektiv
 * zwischen Signalwort und Verb, längere Sätze, Signalwort am Satzanfang („Das Warten …“).
 *
 * Rein (keine Datenbank). Docs: docs/lernspiele.md „Groß oder klein? (Volksschule)“.
 */
import type { Stufe } from "./banken-regeln";
import type { SpielKarte } from "./lernspiele-typen";

/** Lernstand: Groß- und Kleinschreibung (lib/curriculum.ts). */
export const GROSS_SKILL = "deutsch.recht.gross";
/** Die Signalwörter vom Stoffzettel; „Das“ am Satzanfang zählt mit. */
export const SIGNALE = ["zum", "beim", "vom", "das"] as const;

/** Die Sätze nach Stufe; das gefragte Wort in eckigen Klammern, richtig geschrieben. */
export const GROSS_SAETZE: Record<Stufe, string[]> = {
  0: [
    // beim
    "Beim [Spielen] habe ich mir das Knie aufgeschürft.",
    "Beim [Essen] spricht man nicht mit vollem Mund.",
    "Lisa hilft Mama beim [Kochen].",
    "Beim [Lesen] vergesse ich die Zeit.",
    "Tom singt gern beim [Duschen].",
    "Beim [Turnen] brauchen wir Turnschuhe.",
    "Opa schläft beim [Fernsehen] ein.",
    "Beim [Malen] ist mein Pullover bunt geworden.",
    "Papa pfeift beim [Autofahren].",
    "Beim [Schwimmen] trage ich eine Badehaube.",
    "Ich helfe meinem Bruder beim [Aufräumen].",
    "Beim [Rechnen] bin ich schnell.",
    "Die Katze schaut mir beim [Schreiben] zu.",
    "Beim [Laufen] ist Ben hingefallen.",
    "Mia hat beim [Basteln] Kleber an den Fingern.",
    // zum
    "Wir gehen zum [Schwimmen] ins Hallenbad.",
    "Ich brauche eine Schere zum [Schneiden].",
    "Das Wasser ist zum [Trinken] da.",
    "Die Kinder gehen zum [Spielen] in den Hof.",
    "Ich habe einen Stift zum [Zeichnen].",
    "Oma kommt am Sonntag zum [Essen].",
    "Der Schnee ist gut zum [Rodeln].",
    "Wir treffen uns um drei Uhr zum [Lernen].",
    "Das Buch ist zum [Vorlesen] gemacht.",
    "Am Samstag fahren wir zum [Eislaufen].",
    "Ich nehme einen Ball zum [Fußballspielen] mit.",
    "Mein Hund hat eine Decke zum [Schlafen].",
    // klein: das Verb im Satz
    "Wir wollen heute [spielen].",
    "Ich kann schon gut [lesen].",
    "Lea möchte ein Bild [malen].",
    "Morgen gehen wir [schwimmen].",
    "Du musst die Hausübung noch [schreiben].",
    "Die Kinder dürfen im Garten [spielen].",
    "Kannst du mir beim Tragen [helfen]?",
    "Wir wollen am Abend Pizza [essen].",
    "Ich soll mein Zimmer [aufräumen].",
    "Max will im Winter [rodeln].",
    "Mama und ich gehen am Montag [einkaufen].",
    "Kannst du schon [rechnen]?",
    "Ich darf heute länger [aufbleiben].",
    "Wir gehen am Nachmittag [laufen].",
    "Im Sommer will ich jeden Tag [baden].",
    "Die Babys müssen viel [schlafen].",
    "Papa kann gut [kochen].",
    "Wir dürfen heute im Turnsaal [turnen].",
    "Ich muss noch Vokabeln [lernen].",
    "Kannst du mir das Buch [vorlesen]?",
    "Lisa möchte gern [tanzen].",
    "Wir sollen leise [sein].",
    "Ich will heute Abend [fernsehen].",
    "Der Hund möchte im Park [laufen].",
    "Ben kann schon gut [schwimmen].",
    "Ich gehe mit Opa [spazieren].",
  ],
  1: [
    // vom
    "Vom [Laufen] habe ich müde Beine.",
    "Ich bin ganz nass vom [Schwitzen].",
    "Mein Bauch tut weh vom [Lachen].",
    "Vom [Lesen] im Dunkeln bekommt man Kopfweh.",
    "Die Hände sind schmutzig vom [Gärtnern].",
    "Lisa ist heiser vom [Schreien].",
    "Ich bin vom [Warten] schon ganz ungeduldig.",
    "Vom [Schaukeln] wird mir schwindlig.",
    "Meine Finger sind kalt vom [Schneeballwerfen].",
    "Tom ist rot im Gesicht vom [Rennen].",
    // das
    "Das [Lachen] meiner Schwester steckt alle an.",
    "Mir gefällt das [Singen] im Chor.",
    "Das [Schwimmen] macht mir großen Spaß.",
    "Ich mag das [Rascheln] der Blätter.",
    "Das [Zuhören] fällt mir manchmal schwer.",
    "Das [Bellen] des Hundes weckt mich auf.",
    "Wir üben das [Schreiben] von Briefen.",
    "Das [Rechnen] im Kopf geht schon gut.",
    "Für das [Turnen] brauche ich eine Hose.",
    "Das [Klatschen] war sehr laut.",
    "Mama hört das [Klopfen] an der Tür.",
    "Das [Radfahren] habe ich im Sommer gelernt.",
    "Ich finde das [Aufräumen] langweilig.",
    // klein nach „zu“
    "Ich habe keine Lust zu [lesen].",
    "Es beginnt zu [regnen].",
    "Vergiss nicht, die Blumen zu [gießen].",
    "Ben hat keine Zeit zu [spielen].",
    "Hör auf zu [schreien]!",
    "Es ist schön, mit dir zu [tanzen].",
    "Lisa versucht, leise zu [sein].",
    "Ich fange an zu [lernen].",
    // klein: das Verb im Satz (auch nach Nomen und Adjektiven)
    "Die Vögel [singen] am Morgen.",
    "Meine Freunde [lachen] über den Witz.",
    "Im Herbst [fallen] die Blätter.",
    "Wir [warten] auf den Bus.",
    "Die Hunde [bellen] laut.",
    "Kinder, ihr sollt leise [sein]!",
    "Wir [turnen] jeden Dienstag.",
    "Am Abend [lesen] wir eine Geschichte.",
  ],
  2: [
    // ein Adjektiv zwischen Signalwort und Verb
    "Beim schnellen [Laufen] verliere ich oft die Mütze.",
    "Das laute [Schnarchen] von Opa weckt alle auf.",
    "Vom langen [Sitzen] tut mir der Rücken weh.",
    "Zum genauen [Messen] brauchst du ein Lineal.",
    "Das schöne [Singen] der Amsel hört man im Garten.",
    "Beim lauten [Lesen] stottere ich manchmal.",
    "Vom vielen [Lachen] habe ich Bauchweh.",
    "Das ewige [Warten] beim Arzt ist langweilig.",
    "Zum gemütlichen [Frühstücken] setzen wir uns auf den Balkon.",
    "Beim leisen [Flüstern] versteht man nichts.",
    "Das tägliche [Üben] macht dich sicher.",
    "Vom kalten [Baden] im See bekomme ich Gänsehaut.",
    // längere Sätze
    "Nach dem Mittagessen gehen wir zum [Spazieren] in den Park.",
    "Meine Schwester hat beim [Zähneputzen] gesungen.",
    "Im Sommer fahren wir zum [Zelten] an den See.",
    "Ich bin nach dem Ausflug müde vom [Wandern].",
    "Mein Bruder hat beim [Fußballspielen] ein Tor geschossen.",
    "Die Lehrerin lobt uns für das schöne [Schreiben].",
    // klein gegen groß im selben Satzbau
    "Wir gehen jetzt [essen], weil wir Hunger haben.",
    "Lisa will heute nicht [turnen], weil ihr der Fuß wehtut.",
    "Wenn es schneit, können wir [rodeln].",
    "Weil es so heiß ist, wollen alle [baden].",
    "Am Wochenende möchte ich lange [schlafen].",
    "Ich verspreche dir, pünktlich zu [kommen].",
    "Es macht Spaß, im Schnee zu [spielen].",
    "Bevor wir [essen], waschen wir die Hände.",
    "Nach der Schule wollen wir im Park Fußball [spielen].",
    "Weil es regnet, können wir nicht [grillen].",
    "Ich habe vergessen, die Katze zu [füttern].",
    "Wenn die Sonne scheint, gehen wir [wandern].",
    "Am Sonntag möchte Oma mit uns Kuchen [backen].",
    "Mein Bruder hat keine Lust, sein Zimmer [aufzuräumen].",
    "Kommst du morgen mit uns [eislaufen]?",
    "Weil ich müde bin, will ich früh [schlafen].",
  ],
  3: [],
};

export type GrossTeil = { vor: string; wort: string; nach: string; text: string; gross: boolean };

/** Liest einen Satz: Text ohne Klammern, das Wort und was davor und danach steht. */
export function leseGrossSatz(src: string): GrossTeil {
  const m = /^(.*)\[([^\]]+)\](.*)$/.exec(src);
  if (!m) throw new Error(`Groß oder klein: keine Klammern in „${src}“`);
  const [, vor, wort, nach] = m;
  return { vor, wort, nach, text: vor + wort + nach, gross: wort[0] !== wort[0].toLowerCase() };
}

const anders = (wort: string) => (wort[0] === wort[0].toLowerCase() ? wort[0].toUpperCase() : wort[0].toLowerCase()) + wort.slice(1);
const woerterVor = (vor: string) => vor.replace(/[,.!?„“"]/g, " ").trim().split(/\s+/).filter(Boolean);

/** Das Signalwort vor dem Verb (bis zu zwei Wörter davor: „beim schnellen Laufen“) und ob ein Adjektiv dazwischen steht. */
export function signalVor(vor: string): { signal: string; adjektiv: string | null } | null {
  const w = woerterVor(vor);
  const a = w.at(-1)?.toLowerCase();
  if (a && (SIGNALE as readonly string[]).includes(a)) return { signal: a, adjektiv: null };
  const b = w.at(-2)?.toLowerCase();
  if (b && (SIGNALE as readonly string[]).includes(b) && /^[a-zäöüß]/.test(w.at(-1) ?? "")) return { signal: b, adjektiv: w.at(-1)! };
  return null;
}

/** Was nach einem Fehler erscheint: nur, was für diesen Satz sicher stimmt. */
export function grossRegel(t: GrossTeil): string {
  const w = `„${t.wort}“`;
  if (t.gross) {
    const s = signalVor(t.vor);
    if (!s) return `${w} ist hier ein Nomen und wird großgeschrieben.`;
    if (s.adjektiv) return `„${s.signal}“ gehört zu ${w}, dazwischen steht nur das Adjektiv „${s.adjektiv}“. Das Verb wird zum Nomen: groß.`;
    return `Vor ${w} steht „${s.signal}“: Das Verb wird zum Nomen und wird großgeschrieben (${s.signal} ${t.wort}).`;
  }
  const davor = woerterVor(t.vor).at(-1)?.toLowerCase();
  if (davor === "zu") return `Nach „zu“ bleibt das Verb klein. Nur „zum“ (= zu dem) macht es zum Nomen: zu ${t.wort}, aber zum ${anders(t.wort)}.`;
  return `${w} ist hier ein Verb: Es sagt, was jemand tut. Kein zum, beim, vom oder das davor: klein.`;
}

export const grossKey = (text: string) => `gross:${text}`;

/** Alle Karten, je Satz eine; die Kacheln stehen immer gleich: links groß, rechts klein. */
export function grossKandidaten(): { karte: SpielKarte; stufe: Stufe }[] {
  return (Object.entries(GROSS_SAETZE) as [string, string[]][]).flatMap(([stufe, saetze]) =>
    saetze.map((src) => {
      const t = leseGrossSatz(src);
      const gross = t.gross ? t.wort : anders(t.wort);
      const klein = t.gross ? anders(t.wort) : t.wort;
      return {
        karte: {
          key: grossKey(t.text),
          vor: t.vor,
          nach: t.nach,
          form: "wischen" as const,
          faecher: [gross, klein],
          richtig: t.wort,
          loesung: t.text,
          regel: grossRegel(t),
          marke: t.gross ? "groß" : "klein",
        },
        stufe: Number(stufe) as Stufe,
      };
    }),
  );
}
