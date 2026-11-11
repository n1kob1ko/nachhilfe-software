/**
 * Die Karten der Englisch-Lernspiele mit Kisten („Irregular Verbs“, „English Tenses“, „English Grammar“): Sätze mit
 * einer Lücke aus den Englisch-Generatoren (lib/englisch-grammatik.ts), dieselben wie in den Übungen, ohne KI. Die
 * Kisten sind die richtige Form und zwei typische falsche („went“, „goed“, „gone“).
 *
 * „Tenses“ und „Grammar“ spielen je Runde **ein Thema** (eine Fähigkeit): das aus dem Stoff des Schülers, sonst das
 * nächste, das er noch nicht geschafft hat (`themenPlan` in lib/lernspiele.ts; die Themenlisten aller Spiele stehen in
 * lib/lernspiele-themen.ts). Hier steht nur Reines.
 */
import type { Stufe } from "./banken-regeln";
import { englischWahlFuerSpiel, type EnglischWahl } from "./englisch-grammatik";
import type { Kandidat } from "./lernspiele-karten";
import { festerZufall, zahlAus, type SpielKarte, type SpielThema } from "./lernspiele-typen";

export const IRREGULAR_SKILL = "englisch.vocab.irregular";

/** Die Zeiten in der Reihenfolge des Unterrichts (1. Klasse = 5. Schulstufe). */
export const ZEITEN_THEMEN: SpielThema[] = [
  { skill: "englisch.tenses.presentsimple", name: "Present Simple", ab: 5 },
  { skill: "englisch.tenses.presentprogressive", name: "Present Progressive", ab: 5 },
  { skill: "englisch.tenses.simple-progressive", name: "Present Simple oder Progressive", ab: 5 },
  { skill: "englisch.tenses.pastsimple", name: "Past Simple", ab: 6 },
  { skill: "englisch.tenses.future", name: "will oder going to", ab: 6, auch: ["englisch.tenses.future-present"] },
  { skill: "englisch.tenses.pastprogressive", name: "Past Progressive", ab: 7 },
  { skill: "englisch.tenses.past-simple-progressive", name: "Past Simple oder Progressive", ab: 7 },
  { skill: "englisch.tenses.presentperfect", name: "Present Perfect", ab: 7 },
  { skill: "englisch.tenses.perfect-past", name: "Present Perfect oder Past Simple", ab: 7 },
  { skill: "englisch.tenses.mixed", name: "Zeiten gemischt", ab: 7 },
  { skill: "englisch.tenses.pastperfect", name: "Past Perfect", ab: 8 },
  { skill: "englisch.tenses.usedto", name: "used to", ab: 8 },
  { skill: "englisch.tenses.perfectprogressive", name: "Present Perfect Progressive", ab: 8 },
];

/** Die Grammatik-Themen mit eigenen Sätzen, in der Reihenfolge des Unterrichts. */
export const GRAMMATIK_THEMEN: SpielThema[] = [
  { skill: "englisch.grammar.tobe", name: "am, is, are", ab: 5 },
  { skill: "englisch.grammar.havegot", name: "have got, has got", ab: 5 },
  { skill: "englisch.grammar.pronomen", name: "Pronomen", ab: 5 },
  { skill: "englisch.grammar.plural", name: "Plural", ab: 5 },
  { skill: "englisch.grammar.artikel", name: "a, an, the", ab: 5 },
  { skill: "englisch.grammar.genitiv", name: "s-Genitiv", ab: 5 },
  { skill: "englisch.grammar.praep-ort", name: "in, on, at (Ort)", ab: 5 },
  { skill: "englisch.grammar.praep-zeit", name: "at, on, in (Zeit)", ab: 5 },
  { skill: "englisch.grammar.fragen", name: "Fragewörter", ab: 5 },
  { skill: "englisch.grammar.modal-basics", name: "can, must, should", ab: 6 },
  { skill: "englisch.grammar.someany", name: "some oder any", ab: 6 },
  { skill: "englisch.grammar.muchmany", name: "much, many, a lot of", ab: 6 },
  { skill: "englisch.grammar.comparatives", name: "Steigerung", ab: 6 },
  { skill: "englisch.grammar.modal-must", name: "must, mustn't, have to", ab: 7 },
  { skill: "englisch.grammar.adverbs", name: "Adjektiv oder Adverb", ab: 7 },
  { skill: "englisch.grammar.if1", name: "if-Sätze Typ 1", ab: 7 },
  { skill: "englisch.grammar.relative", name: "who, which, whose", ab: 7 },
  { skill: "englisch.grammar.questiontags", name: "Question Tags", ab: 7 },
  { skill: "englisch.grammar.modal-substitutes", name: "be able to, have to", ab: 7 },
  { skill: "englisch.grammar.gerund", name: "Gerund oder Infinitiv", ab: 8 },
  { skill: "englisch.grammar.reflexive", name: "myself, each other", ab: 8 },
  { skill: "englisch.grammar.passive", name: "Passiv", ab: 8, auch: ["englisch.grammar.passive-tenses"] },
  { skill: "englisch.grammar.if2", name: "if-Sätze Typ 2", ab: 8 },
  { skill: "englisch.grammar.if3", name: "if-Sätze Typ 3", ab: 8 },
  { skill: "englisch.grammar.reported", name: "Reported Speech", ab: 8 },
];

// ---------- Karten ----------

/** So viele Sätze werden je Stufe einmal erzeugt; doppelte fallen weg. */
const VERSUCHE_JE_STUFE = 160;
/** Längere Aufschriften passen nicht mehr auf eine Kiste, längere Sätze nicht auf die Karte. */
const KISTE_MAX = 24;
const SATZ_MAX = 120;
/** Von Sätzen, die sich nur im Namen unterscheiden („Paul …“, „Lena …“), bleiben so viele. */
const JE_VORLAGE = 2;
const ZEIT_NAMEN = ["present perfect progressive", "present perfect", "past perfect", "present progressive", "past progressive", "present simple", "past simple", "going to", "used to", "will"];
/**
 * Die Zeit, die die Regel nennt („Past Simple“): steht nach der richtigen Antwort als Schild auf der Karte. Nennt die
 * Regel zwei Zeiten (Past Simple und Past Progressive in einem Satz), gibt es kein Schild.
 */
export function zeitAus(regel: string): string | undefined {
  let rest = regel.toLowerCase();
  const gefunden: string[] = [];
  for (const n of ZEIT_NAMEN) {
    if (!new RegExp(`\\b${n}\\b`).test(rest)) continue;
    gefunden.push(n);
    rest = rest.split(n).join(" ");
  }
  if (gefunden.length !== 1) return undefined;
  const z = gefunden[0];
  return z.includes(" to") || z === "will" ? z : z.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Eine Karte aus einem Satz des Generators: die richtige Form und zwei falsche als Kisten. Die erste falsche ist der
 * häufigste Fehler (die andere Zeit, die regelmäßig gebildete Form), die zweite wechselt; die Kisten einer Karte
 * stehen immer gleich.
 */
export function englischKarte(skill: string, w: EnglischWahl): SpielKarte | null {
  const h = zahlAus(w.satz + w.richtig);
  const rest = w.falsch.slice(1);
  const zwei = [w.falsch[0], rest[h % rest.length]];
  const faecher = [...zwei];
  faecher.splice(h % 3, 0, w.richtig);
  if (new Set(faecher.map((f) => f.toLowerCase())).size !== 3 || faecher.some((f) => f.length > KISTE_MAX) || w.satz.length > SATZ_MAX) return null;
  return {
    key: `en:${skill}:${w.vor}_${w.nach}`,
    skill,
    vor: w.vor,
    nach: w.nach.trimStart(),
    faecher,
    richtig: w.richtig,
    hinweis: w.cue ? `(${w.cue})` : undefined,
    loesung: w.satz,
    regel: w.regel,
    marke: skill.startsWith("englisch.tenses.") ? zeitAus(w.regel) : undefined,
    kurz: w.richtig,
  };
}

const cache = new Map<string, Kandidat[]>();

/**
 * Alle Karten einer Englisch-Fähigkeit (einmal erzeugt, dann aus dem Speicher), jede mit der niedrigsten Stufe, auf
 * der der Generator sie baut. `gruppe` ist die Vorlage des Satzes: zwei Karten daraus kommen nie in eine Runde.
 */
export function englischKandidaten(skill: string): Kandidat[] {
  const c = cache.get(skill);
  if (c) return c;
  const rng = festerZufall(20261111 + (zahlAus(skill) % 1000));
  const out = new Map<string, Kandidat>();
  const jeVorlage = new Map<string, number>();
  for (const stufe of [0, 1, 2, 3] as Stufe[]) {
    for (let i = 0; i < VERSUCHE_JE_STUFE; i++) {
      const w = englischWahlFuerSpiel(skill, stufe, rng);
      const karte = w && englischKarte(skill, w);
      if (!w || !karte || out.has(karte.key)) continue;
      const gruppe = `${skill}|${w.cue ?? ""}|${w.nach.trim()}|${w.richtig.toLowerCase()}`;
      const n = jeVorlage.get(gruppe) ?? 0;
      if (n >= JE_VORLAGE) continue;
      jeVorlage.set(gruppe, n + 1);
      out.set(karte.key, { karte, stufe, gruppe });
    }
  }
  const liste = [...out.values()];
  cache.set(skill, liste);
  return liste;
}
