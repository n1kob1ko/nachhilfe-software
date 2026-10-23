/**
 * Deutsch-Satzlehre ohne KI: built-in tasks for Satzglieder, Objekte, adverbiale Bestimmungen, Fälle,
 * Zeitformen (Futur, Plusquamperfekt), Aktiv und Passiv and the punctuation of direkte Rede. The sentences
 * are built from the word lists in lib/deutsch-woerter.ts and from own sentence patterns, so every task
 * knows its one right answer (or all right answers) and the typical errors, each with a German label.
 *
 * The formats are the ones of lib/englisch-grammatik.ts: Lückentext, Multiple Choice, Fehler korrigieren
 * (lib/fix-text.ts) and Kurzantwort. Determination skills (Satzglied, Fall, Zeitform bestimmen) ask with
 * multiple choice; forming skills (Futur, Passiv, direkte Rede) with a gap text.
 *
 * Wrong corrections are worse than few tasks: a sentence only goes in when it has exactly one reading.
 * The patterns avoid what can be read two ways: Präpositionalobjekt or adverbiale Bestimmung, Dativ or
 * Akkusativ after Wechselpräpositionen, Zustandspassiv, an object that could be the subject (only
 * masculine animate objects: „den Hund“), a Wortgruppe with a preposition right after a noun (it could be an
 * attribute: „das Buch im Garten“), a feminine Dativ right after a noun (it could be a Genitiv). An error of
 * „Fehler korrigieren“ is never a form that is right in another reading („Lena hilft mein Opa“ can mean
 * „Mein Opa hilft Lena“: never an error). Verbs with „sein“ in Austria and „haben“ elsewhere (sitzen,
 * schwimmen) take both.
 *
 * Terms as in lib/themen/ and in Austrian schools: Nominativ (1. Fall), Präteritum (Mitvergangenheit),
 * Beistrich, Rufzeichen. Own sentences: nothing is taken from a school book, IQS or Matura task.
 */
import type { Difficulty } from "./curriculum";
import {
  BUBEN,
  DINGE,
  FALL_FRAGE,
  FALL_KURZ,
  FALL_NAME,
  GRUPPEN,
  HABEN,
  SCHUL_GRUPPEN,
  MAEDCHEN,
  NAMEN,
  PERSONEN,
  SEIN,
  VERBEN,
  WERDEN,
  begleiter,
  schulisch,
  form,
  formen,
  hilfsverben,
  np,
  pick,
  praesens,
  praeteritum,
  zweiNamen,
  type Begleiter,
  type Fall,
  type NP,
  type Person,
  type Verb,
} from "./deutsch-woerter";
import { closestVersion, expectedFixes, tokenize } from "./fix-text";
import { STUFE, type Rng, type Stufe } from "./schulbuch-zahlen";
import { GAP, normalizeText, type TaskDraft } from "./tasks";

// ---------- the shape of a task ----------
/** A typical wrong answer. mc: false = never a wrong option; fix: false = never the error of a text to correct. */
export type Fehler = { answer: string; label: string; mc?: false; fix?: false };
const F = (answer: string, label: string, o: { mc?: false; fix?: false } = {}): Fehler => ({ answer, label, ...o });

/** One gap: the right answers (the first is shown), the typical errors and what stands in brackets after it. */
type Luecke = { richtig: string[]; fehler: Fehler[]; cue?: string };
const L = (richtig: string | string[], fehler: Fehler[], cue?: string): Luecke => ({ richtig: typeof richtig === "string" ? [richtig] : richtig, fehler, cue });

/**
 * A sentence with gaps (___). `regel` says why the answer is right, `hilfe` is the first hint. `tipp` is the
 * second hint when `regel` names the answer: the rule as a question to ask or on another example, so no
 * hint gives the answer away (lib/hinweise-loesung.test.ts). `titel` is the instruction of the gap text,
 * `cueEnde` stands in brackets at the end ("lesen, Futur I").
 */
export type Satz = { text: string; luecken: Luecke[]; regel: string; hilfe: string; tipp?: string; titel: string; cueEnde?: string };
/** A short answer: instruction, the sentence or words to work with, the right answers and the typical errors. */
export type Umformung = { auftrag: string; vorlage: string; richtig: string[]; fehler: Fehler[]; regel: string; hilfe: string; tipp?: string };
/** Multiple choice: the question, the sentence, the right option and wrong options with what they reveal. */
export type Wahl = { titel: string; text: string; richtig: string; falsch: Fehler[]; regel: string; hilfe: string; tipp?: string };

type Faehigkeit = {
  luecke: (rng: Rng, st: Stufe) => Satz;
  wahl: (rng: Rng, st: Stufe) => Wahl | null;
  kurz: (rng: Rng, st: Stufe) => Umformung;
  /** a sentence whose gap errors (fix !== false) give "Fehler korrigieren"; none = no correction tasks */
  fix?: (rng: Rng, st: Stufe) => Satz;
  /** the instruction of "Fehler korrigieren" (n = number of sentences) */
  fixAuftrag?: (n: number) => string;
  /** the task when no format is asked for */
  standard: "mc" | "cloze";
  /** Grammatik: determination skills ask with multiple choice, the others with a short answer */
  bestimmen: boolean;
  /** direkte Rede: every punctuation mark counts (AnswerSpec.satzzeichen) */
  zeichen?: boolean;
};

// ---------- small helpers ----------
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const rint = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** One of several kinds, by weight. */
function art<K extends string>(rng: Rng, gewichte: Partial<Record<K, number>>): K {
  const e = (Object.entries(gewichte) as [K, number][]).filter(([, w]) => w > 0);
  let r = rng() * e.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of e) if ((r -= w) < 0) return k;
  return e[e.length - 1][0];
}
const istName = (w: string) => NAMEN.includes(w);
const maedchen = (name: string) => MAEDCHEN.includes(name);

/** Answers compared like the check does: punctuation exactly for direkte Rede, otherwise as normalizeText. */
const schluessel = (x: string, zeichen = false) =>
  zeichen
    ? tokenize(x)
        .map((t) => t.text.replace(/[„“”"«»‟]/g, '"').toLowerCase())
        .join(" ")
    : normalizeText(x);
/** Typical errors without the ones that are right after all, each once. */
function sauber(richtig: readonly string[], fehler: readonly Fehler[], zeichen = false): Fehler[] {
  const seen = new Set(richtig.map((r) => schluessel(r, zeichen)));
  return fehler.filter((f) => {
    const k = schluessel(f.answer, zeichen);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A capital letter at the very start of the text, also after an opening quotation mark. */
const grossAnfang = (t: string) => t.replace(/^([„"»]?)(\p{Ll})/u, (_, q: string, c: string) => q + c.toUpperCase());
/** The sentence with its gaps filled. */
function fuellen(s: Satz, werte: readonly string[]): string {
  let i = 0;
  const text = s.text.replace(/___/g, () => werte[i++] ?? "");
  return grossAnfang(text.replace(/ {2,}/g, " ").replace(/ ([,.!?])(?=\s|$)/g, "$1").trim());
}
/** The gap text as the student sees it: what to use in brackets after a gap or at the end. */
function mitCues(s: Satz): string {
  let i = 0;
  const text = s.text.replace(/___/g, () => {
    const l = s.luecken[i++];
    return l?.cue ? `${GAP} (${l.cue})` : GAP;
  });
  return s.cueEnde ? `${text} (${s.cueEnde})` : text;
}

// ---------- the formats ----------
/** The solution: the answer, then the rule, without saying the answer twice („Im Garten spielt Mila.“). */
function loesung(antwort: string, regel: string): string {
  const letzte = antwort.split("\n").pop()!;
  const rest = regel.startsWith(letzte) ? regel.slice(letzte.length).trim() : regel.endsWith(letzte) ? regel.slice(0, -letzte.length).trim() : regel;
  return rest ? `${antwort}\n${rest}` : antwort;
}
/** Gap text: every right answer of a gap counts; several gaps: the error label stands with the other gaps right. */
function lueckentext(skillId: string, difficulty: Difficulty, s: Satz, zeichen = false): TaskDraft {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  return {
    type: "cloze",
    skillId,
    difficulty,
    prompt: `${s.titel}\n${mitCues(s)}`,
    data: {},
    answer: { blanks: s.luecken.map((l) => l.richtig), mode: "text", ...(zeichen ? { satzzeichen: true } : {}) },
    solution: loesung(fuellen(s, rechts), s.regel),
    hints: [s.hilfe, s.tipp ?? s.regel],
    errorMap: s.luecken.flatMap((l, i) =>
      sauber(l.richtig, l.fehler, zeichen).map((f) => ({ answer: s.luecken.length === 1 ? f.answer : rechts.map((r, j) => (j === i ? f.answer : r)).join(" | "), label: f.label })),
    ),
  };
}

/** Multiple choice: the right option and up to three typical errors. Null when there are fewer than two. */
function auswahl(skillId: string, difficulty: Difficulty, w: Wahl, rng: Rng, zeichen = false): TaskDraft | null {
  const seen = new Set([schluessel(w.richtig, zeichen)]);
  const falsche = shuffle(
    rng,
    w.falsch.filter((f) => f.mc !== false),
  ).filter((f) => {
    const k = schluessel(f.answer, zeichen);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (falsche.length < 2) return null;
  const gezeigt = falsche.slice(0, 3);
  const options = shuffle(rng, [w.richtig, ...gezeigt.map((f) => f.answer)]);
  return {
    type: "mc",
    skillId,
    difficulty,
    prompt: w.text ? `${w.titel}\n${w.text}` : w.titel,
    data: { options },
    answer: { correct: options.indexOf(w.richtig) },
    solution: loesung(w.richtig, w.regel),
    hints: [w.hilfe, w.tipp ?? w.regel],
    errorMap: gezeigt.map((f) => ({ answer: String(options.indexOf(f.answer)), label: f.label })),
  };
}

/** Multiple choice from a gap text: the options are the gaps filled ("wird … lesen") or whole sentences. */
function wahlAusSatz(s: Satz, titel: string, ganz = false): Wahl {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const zeige = (werte: string[]) => (ganz ? fuellen(s, werte) : werte.join(" … "));
  return {
    titel,
    text: ganz ? "" : mitCues(s),
    richtig: zeige(rechts),
    falsch: s.luecken.flatMap((l, i) => sauber(l.richtig, l.fehler, ganz).map((f) => ({ ...f, answer: zeige(rechts.map((r, j) => (j === i ? f.answer : r))) }))),
    regel: s.regel,
    hilfe: s.hilfe,
    tipp: s.tipp,
  };
}

/** One sentence with one typical error: the wrong text, the right versions and what the error is. */
function mitFehler(s: Satz, rng: Rng, zeichen = false): { falsch: string; richtig: string[]; label: string } | null {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const moeglich = s.luecken.flatMap((l, i) =>
    sauber(l.richtig, l.fehler, zeichen)
      .filter((f) => f.fix !== false)
      .map((f) => ({ i, f })),
  );
  if (!moeglich.length) return null;
  const { i, f } = pick(rng, moeglich);
  const mit = (w: string) => fuellen(s, rechts.map((r, j) => (j === i ? w : r)));
  const falsch = mit(f.answer);
  const richtig = [...new Set(s.luecken[i].richtig.map(mit))];
  const naechste = closestVersion(richtig, falsch) ?? richtig[0];
  return { falsch, richtig: [naechste, ...richtig.filter((r) => r !== naechste)], label: f.label };
}

/** "Fehler korrigieren": one to three sentences, each with one typical error (more on the harder levels). */
function korrektur(skillId: string, difficulty: Difficulty, teile: { falsch: string; richtig: string[]; label: string }[], auftrag: string): TaskDraft {
  const n = teile.length;
  const versionen = teile.reduce<string[]>((acc, t) => acc.flatMap((a) => t.richtig.map((r) => (a ? `${a} ${r}` : r))), [""]).slice(0, 24);
  return {
    type: "fix",
    skillId,
    category: "korrigieren",
    difficulty,
    prompt: auftrag,
    data: { faulty: teile.map((t) => t.falsch).join(" ") },
    answer: {
      accepted: versionen,
      mode: "exact",
      fixes: teile.flatMap((t) => expectedFixes(t.falsch, t.richtig[0]).map((f) => ({ ...f, label: t.label, errorType: "grammatik" }))),
      criteria: [n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, "Richtiges wurde nicht verändert."],
    },
    solution: teile.map((t) => `${t.richtig[0]}\n→ ${t.label}`).join("\n"),
    hints: ["Lies Satz für Satz. Passt jedes Wort und jedes Satzzeichen?", n === 1 ? "Es ist genau ein Fehler." : `Es sind ${n} Fehler, in jedem Satz einer.`],
    errorMap: [],
  };
}

/** Short answer: a form, a Satzglied or a sentence to write. */
function kurzantwort(skillId: string, difficulty: Difficulty, u: Umformung, zeichen = false): TaskDraft {
  return {
    type: "grammar",
    skillId,
    difficulty,
    prompt: `${u.auftrag}\n${u.vorlage}`,
    data: {},
    answer: { accepted: u.richtig, mode: "text", ...(zeichen ? { satzzeichen: true } : {}) },
    solution: loesung(u.richtig[0], u.regel),
    hints: [u.hilfe, u.tipp ?? u.regel],
    errorMap: sauber(u.richtig, u.fehler, zeichen).map(({ answer, label }) => ({ answer, label })),
  };
}

/**
 * The orders of a statement: a Satzglied in front, the others in any order, the finite verb second and
 * the rest of the Prädikat at the end. The first is the given order. At most four Satzglieder (24
 * orders). `passt` leaves out the orders that read two ways („Gestern hat die Zeitung Lena gelesen“).
 */
function stellungen(glieder: readonly string[], finit: string, ende: string, passt: (vorn: string, mittel: string[]) => boolean = () => true): string[] {
  const perms = (xs: readonly string[]): string[][] => (xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  const satz = (vorn: string, rest: string[]) => `${cap([vorn, finit, ...rest, ende].filter(Boolean).join(" "))}.`;
  const out = passt(glieder[0], glieder.slice(1)) ? [satz(glieder[0], glieder.slice(1))] : [];
  for (let i = 0; i < glieder.length; i++) for (const p of perms(glieder.filter((_, j) => j !== i))) if (passt(glieder[i], p)) out.push(satz(glieder[i], p));
  return [...new Set(out)];
}

// =====================================================================
// ---------- Satzglieder: the sentence patterns ----------
// =====================================================================
type Rolle = "S" | "D" | "A" | "Z" | "O" | "W" | "G";
type AdvArt = "zeit" | "dauer" | "wo" | "wohin" | "woher" | "wie" | "grund";
type Glied = { text: string; rolle: Rolle; adv?: AdvArt; np?: NP; fall?: Fall };

const ADV_ROLLE: Record<AdvArt, Rolle> = { zeit: "Z", dauer: "Z", wo: "O", wohin: "O", woher: "O", wie: "W", grund: "G" };
/** The Frageprobe of an adverbiale Bestimmung: the question word and the other right ones. */
const ADV_FRAGE: Record<AdvArt, string[]> = {
  zeit: ["Wann"],
  dauer: ["Wie lange"],
  wo: ["Wo"],
  wohin: ["Wohin"],
  woher: ["Woher"],
  wie: ["Wie", "Auf welche Weise", "Auf welche Art und Weise", "Auf welche Art"],
  grund: ["Warum", "Weshalb", "Wieso", "Weswegen", "Aus welchem Grund"],
};
type AdvTyp = "zeit" | "ort" | "wie" | "grund";
const ADV_TYP: Record<AdvArt, AdvTyp> = { zeit: "zeit", dauer: "zeit", wo: "ort", wohin: "ort", woher: "ort", wie: "wie", grund: "grund" };
/** The four kinds of adverbiale Bestimmungen, as options. */
const TYP_NAME: Record<AdvTyp, string> = { zeit: "Zeit (Wann? Wie lange?)", ort: "Ort (Wo? Wohin? Woher?)", wie: "Art und Weise (Wie?)", grund: "Grund (Warum?)" };
const TYP_KURZ: Record<AdvTyp, string> = { zeit: "Zeit", ort: "Ort", wie: "Art und Weise", grund: "Grund" };
const TYP_GENITIV: Record<AdvTyp, string> = { zeit: "der Zeit", ort: "des Ortes", wie: "der Art und Weise", grund: "des Grundes" };

/**
 * A pattern: the verb (3. Person Einzahl, Verbzusatz, Perfekt), whether it has a Dativobjekt (a person)
 * and which Akkusativobjekte fit. Animate Akkusativobjekte are masculine only („den Hund“), so they can
 * never be read as the subject. `subjekt`: a thing as subject (gehören, gefallen); otherwise a name.
 * `adv`: the adverbiale Bestimmungen that fit; `braucht`: one the verb needs (fahren nach Wien).
 */
type Rahmen = {
  praes: string;
  teil?: string;
  hilf: "hat" | "ist";
  p2: string;
  dat?: true;
  akk?: [Begleiter, string][];
  subjekt?: [Begleiter, string][];
  adv: Partial<Record<AdvArt, string[]>>;
  braucht?: AdvArt;
  stufe: 0 | 1 | 2;
  /** the Akkusativobjekt in the Dativ is not wrong in every reading (jemandem öffnen) */
  akkImDativOk?: true;
};
const R = (praes: string, hilf: "hat" | "ist", p2: string, o: Omit<Rahmen, "praes" | "hilf" | "p2">): Rahmen => ({ praes, hilf, p2, ...o });
const RAHMEN: Rahmen[] = [
  R("schenkt", "hat", "geschenkt", { dat: true, akk: [["ein", "Buch"], ["ein", "Schal"], ["ein", "Kappe"], ["ein", "Spiel"], ["ein", "Uhr"], ["ein", "Ball"]], adv: { zeit: ["am Abend", "am Sonntag", "im Sommer"], wie: ["heimlich"] }, stufe: 0 }),
  R("gibt", "hat", "gegeben", { dat: true, akk: [["der", "Schlüssel"], ["der", "Heft"], ["ein", "Apfel"], ["der", "Jacke"], ["der", "Ball"]], adv: { zeit: ["in der Pause", "am Morgen", "nach der Schule"], wie: ["schnell", "heimlich"] }, stufe: 0 }),
  R("gibt", "hat", "zurückgegeben", { teil: "zurück", dat: true, akk: [["der", "Heft"], ["der", "Bleistift"], ["der", "Buch"], ["der", "Radiergummi"]], adv: { zeit: ["am Montag", "in der Pause"], wie: ["schnell"] }, stufe: 1 }),
  R("zeigt", "hat", "gezeigt", { dat: true, akk: [["der", "Foto"], ["ein", "Bild"], ["der", "Weg"], ["der", "Zeichnung"]], adv: { zeit: ["am Abend", "in der Pause"], wo: ["im Park", "in der Küche"] }, stufe: 0 }),
  R("erklärt", "hat", "erklärt", { dat: true, akk: [["der", "Aufgabe"], ["der", "Spiel"], ["der", "Regel"], ["der", "Weg"]], adv: { zeit: ["in der Pause", "nach der Schule"], wo: ["in der Bibliothek"], wie: ["geduldig", "langsam"] }, stufe: 0 }),
  R("erzählt", "hat", "erzählt", { dat: true, akk: [["ein", "Geschichte"], ["ein", "Witz"], ["ein", "Märchen"]], adv: { zeit: ["am Abend"], wo: ["im Garten"], wie: ["leise", "fröhlich"] }, stufe: 0 }),
  R("bringt", "hat", "gebracht", { dat: true, akk: [["ein", "Tee"], ["ein", "Suppe"], ["der", "Zeitung"], ["der", "Heft"]], adv: { zeit: ["am Morgen", "am Abend"], wie: ["vorsichtig", "schnell"] }, stufe: 0 }),
  R("leiht", "hat", "geliehen", { dat: true, akk: [["ein", "Bleistift"], ["der", "Fahrrad"], ["ein", "Buch"], ["der", "Radiergummi"]], adv: { zeit: ["am Montag", "in der Pause"] }, stufe: 1 }),
  R("schreibt", "hat", "geschrieben", { dat: true, akk: [["ein", "Brief"], ["ein", "Karte"], ["ein", "Nachricht"]], adv: { zeit: ["am Sonntag", "am Abend"], wo: ["in der Küche"], wie: ["sorgfältig"] }, stufe: 0 }),
  R("hilft", "hat", "geholfen", { dat: true, adv: { zeit: ["nach der Schule", "am Samstag"], wo: ["im Garten", "in der Küche"], wie: ["geduldig"] }, stufe: 0 }),
  R("dankt", "hat", "gedankt", { dat: true, adv: { zeit: ["am Abend"], wie: ["herzlich"] }, stufe: 0 }),
  R("gratuliert", "hat", "gratuliert", { dat: true, adv: { zeit: ["am Morgen", "in der Pause"], wie: ["fröhlich"] }, stufe: 1 }),
  R("hört", "hat", "zugehört", { teil: "zu", dat: true, adv: { zeit: ["am Abend"], wie: ["aufmerksam", "geduldig"] }, stufe: 1 }),
  R("antwortet", "hat", "geantwortet", { dat: true, adv: { zeit: ["am Abend"], wie: ["schnell", "leise"] }, stufe: 1 }),
  R("liest", "hat", "gelesen", { akk: [["ein", "Buch"], ["ein", "Comic"], ["der", "Zeitung"], ["ein", "Brief"]], adv: { zeit: ["am Abend", "am Sonntag"], dauer: ["zwei Stunden lang", "den ganzen Nachmittag"], wo: ["im Garten", "in der Bibliothek", "zu Hause"], wie: ["leise", "langsam"] }, stufe: 0 }),
  R("isst", "hat", "gegessen", { akk: [["ein", "Apfel"], ["ein", "Semmel"], ["ein", "Eis"], ["ein", "Suppe"]], adv: { zeit: ["in der Pause", "am Abend"], wo: ["in der Küche", "im Garten"], wie: ["langsam", "schnell"] }, stufe: 0 }),
  R("sucht", "hat", "gesucht", { akk: [["der", "Schlüssel"], ["der", "Brille"], ["der", "Handy"], ["der", "Ball"]], adv: { zeit: ["am Morgen"], dauer: ["eine Stunde lang", "den ganzen Nachmittag"], wo: ["im Garten", "in der Küche"], wie: ["geduldig"] }, stufe: 0 }),
  R("besucht", "hat", "besucht", { akk: [["der", "Opa"], ["mein", "Onkel"], ["ein", "Freund"], ["mein", "Bruder"]], adv: { zeit: ["am Sonntag", "im Sommer"], wo: ["in Graz", "in Linz"] }, stufe: 0 }),
  R("füttert", "hat", "gefüttert", { akk: [["der", "Hund"], ["der", "Kater"], ["der", "Vogel"]], adv: { zeit: ["am Morgen", "am Abend"], wo: ["im Garten"], wie: ["vorsichtig"] }, stufe: 0 }),
  R("öffnet", "hat", "geöffnet", { akk: [["der", "Paket"], ["der", "Brief"]], adv: { zeit: ["am Abend"], wie: ["vorsichtig", "heimlich"], grund: ["aus Neugier"] }, stufe: 1, akkImDativOk: true }),
  R("putzt", "hat", "geputzt", { akk: [["der", "Fahrrad"], ["der", "Brille"], ["der", "Stuhl"]], adv: { zeit: ["am Samstag"], wo: ["im Garten"], wie: ["gründlich", "sorgfältig"] }, stufe: 1 }),
  R("malt", "hat", "gemalt", { akk: [["ein", "Bild"], ["ein", "Blume"]], adv: { zeit: ["am Nachmittag"], wo: ["im Garten"], wie: ["sorgfältig"] }, stufe: 0 }),
  R("spielt", "hat", "gespielt", { adv: { zeit: ["nach der Schule", "in der Pause"], wo: ["im Garten", "im Park", "im Turnsaal"], wie: ["fröhlich", "leise"], grund: ["wegen des Regens"] }, braucht: "wo", stufe: 0 }),
  R("bleibt", "ist", "geblieben", { adv: { zeit: ["heute", "am Sonntag"], wo: ["zu Hause", "im Bett"], grund: ["wegen des Regens", "wegen einer Erkältung", "wegen der Hitze"] }, braucht: "wo", stufe: 1 }),
  R("fährt", "ist", "gefahren", { adv: { zeit: ["am Montag", "im Sommer"], wohin: ["nach Wien", "nach Graz", "in die Stadt"], wie: ["langsam", "vorsichtig"] }, braucht: "wohin", stufe: 0 }),
  R("geht", "ist", "gegangen", { adv: { zeit: ["nach der Schule", "am Abend"], wohin: ["nach Hause", "ins Kino", "in den Park"], wie: ["langsam", "schnell"], grund: ["wegen des Regens"] }, braucht: "wohin", stufe: 0 }),
  R("kommt", "ist", "gekommen", { adv: { zeit: ["am Abend", "um vier Uhr"], woher: ["aus Linz", "aus der Schule", "vom Training"], wie: ["schnell", "zu Fuß"] }, braucht: "woher", stufe: 1 }),
  R("zittert", "hat", "gezittert", { adv: { wo: ["an der Haltestelle", "im Garten"], grund: ["vor Kälte", "vor Angst"] }, braucht: "grund", stufe: 1 }),
  R("weint", "hat", "geweint", { adv: { zeit: ["am Ende"], wo: ["im Kino"], grund: ["vor Freude"] }, braucht: "grund", stufe: 1 }),
  R("schläft", "hat", "geschlafen", { adv: { zeit: ["am Nachmittag"], dauer: ["zwei Stunden lang"], wo: ["im Zelt", "auf dem Sofa"], wie: ["ruhig"] }, stufe: 0 }),
  R("gehört", "hat", "gehört", { dat: true, subjekt: [["der", "Fahrrad"], ["der", "Ball"], ["der", "Jacke"], ["der", "Handy"]], adv: {}, stufe: 2 }),
  R("gefällt", "hat", "gefallen", { dat: true, subjekt: [["der", "Buch"], ["der", "Geschichte"], ["der", "Spiel"], ["der", "Bild"]], adv: {}, stufe: 2 }),
  R("schmeckt", "hat", "geschmeckt", { dat: true, subjekt: [["der", "Suppe"], ["der", "Kuchen"], ["der", "Eis"], ["der", "Salat"]], adv: {}, stufe: 2 }),
];

/** Prepositions that start a Wortgruppe (am Abend, zu Hause, wegen des Regens). */
const PRAEP = new Set(["am", "im", "in", "ins", "nach", "zu", "zum", "zur", "aus", "vom", "von", "wegen", "vor", "auf", "an", "um", "mit", "bei", "für"]);
const istPP = (g: Glied) => PRAEP.has(g.text.split(" ")[0]);
/** The Glied ends with a noun that could take an attribute after it (not a name). */
const nomenAmEnde = (g: Glied) => {
  const w = g.text.split(" ").at(-1)!;
  return /^\p{Lu}/u.test(w) && !istName(w);
};
const femDativ = (g: Glied) => g.fall === "dat" && g.np?.n.genus === "f";
/**
 * Only orders with one reading: no Wortgruppe with a preposition and no feminine Dativ right after a noun
 * (attribute, Genitiv), no „aus Linz“ right after a name (Lena aus Linz), an Akkusativobjekt in front only
 * when it shows its case (den, einen, meinen).
 */
function eindeutig(vorfeld: Glied, mittel: readonly Glied[]): boolean {
  if (vorfeld.rolle === "A" && !/^(den|einen|meinen) /.test(vorfeld.text)) return false;
  for (let i = 1; i < mittel.length; i++) {
    const [a, b] = [mittel[i - 1], mittel[i]];
    if ((istPP(b) || femDativ(b)) && nomenAmEnde(a)) return false;
    if (b.adv === "woher" && a.rolle === "S") return false;
  }
  return true;
}

type Bau = { r: Rahmen; vorfeld: Glied; finit: string; mittel: Glied[]; ende: string };
const npGlied = ([b, w]: [Begleiter, string], fall: Fall, rolle: Rolle): Glied => {
  const x = np(b, w);
  return { text: form(x, fall), rolle, np: x, fall };
};
/** A person as Dativobjekt: meinem Opa, der Lehrerin, einem Freund. */
function datPerson(rng: Rng): Glied {
  const n = pick(rng, PERSONEN);
  const b: Begleiter = ["Opa", "Oma", "Lehrerin", "Lehrer", "Trainer", "Trainerin", "Nachbarin"].includes(n.wort) ? pick(rng, ["der", "mein"] as const) : n.wort.startsWith("Freund") ? pick(rng, ["ein", "mein"] as const) : "mein";
  return npGlied([b, n.wort], "dat", "D");
}
const REIHE: (Rolle | AdvArt)[] = ["S", "zeit", "dauer", "grund", "wo", "D", "wie", "A", "wohin", "woher"];
const platz = (g: Glied) => REIHE.indexOf(g.adv ?? g.rolle);
const gliedText = (g: Glied) => g.text;

type BauWunsch = {
  passt?: (r: Rahmen) => boolean;
  /** how many adverbiale Bestimmungen */
  adv?: number;
  /** which Satzglied stands in front: the subject, an adverbiale Bestimmung, an object or any */
  vorn?: "S" | "adv" | "obj" | "frei";
  perfekt?: boolean;
  /** these kinds must be there */
  mit?: AdvArt[];
  /** the text of a kind (den ganzen Nachmittag) */
  text?: Partial<Record<AdvArt, string>>;
};
/** A sentence from a pattern; tries again until the order has only one reading. */
function bauen(rng: Rng, st: Stufe, w: BauWunsch = {}): Bau {
  const rahmen = RAHMEN.filter((x) => x.stufe <= Math.min(st, 2) && (w.passt?.(x) ?? true));
  if (!rahmen.length) throw new Error("Kein Satzmuster passt");
  for (let k = 0; k < 400; k++) {
    const r = pick(rng, rahmen);
    const S: Glied = r.subjekt ? npGlied(pick(rng, r.subjekt), "nom", "S") : { text: pick(rng, NAMEN), rolle: "S" };
    const objekte = [...(r.dat ? [datPerson(rng)] : []), ...(r.akk ? [npGlied(pick(rng, r.akk), "akk", "A")] : [])];
    const moeglich = Object.keys(r.adv) as AdvArt[];
    const pflicht = [...new Set([...(r.braucht ? [r.braucht] : []), ...(w.mit ?? [])])];
    if (pflicht.some((p) => !moeglich.includes(p)) || Object.keys(w.text ?? {}).some((a) => !r.adv[a as AdvArt]?.includes(w.text![a as AdvArt]!))) continue;
    // as many as asked for (a pattern with fewer kinds does not fit); without a wish as many as the pattern has, up to the level's number
    const typen = new Set(moeglich.map((a) => ADV_TYP[a])).size;
    const anzahl = Math.max(pflicht.length, w.adv ?? Math.min(typen, st === 0 ? rint(rng, 0, 1) : st <= 2 ? rint(rng, 1, 2) : 2));
    // one of each kind (Zeit and Dauer are both Zeit, Wo/Wohin/Woher all Ort)
    const arten: AdvArt[] = [...pflicht];
    for (const a of shuffle(rng, moeglich)) if (arten.length < anzahl && !arten.some((x) => ADV_TYP[x] === ADV_TYP[a])) arten.push(a);
    if (arten.length !== anzahl) continue;
    const adv: Glied[] = arten.map((a) => ({ text: w.text?.[a] ?? pick(rng, r.adv[a]!), rolle: ADV_ROLLE[a], adv: a }));
    const perfekt = w.perfekt ?? (st >= 1 && rng() < 0.4);
    const finit = perfekt ? r.hilf : r.praes;
    const ende = perfekt ? r.p2 : (r.teil ?? "");
    const alle = [S, ...objekte, ...adv];
    // the thing as subject (das Fahrrad gehört …) stays in front: „Seit gestern gehört das Fahrrad meiner Schwester“ reads two ways
    const vornArt = r.subjekt ? "S" : (w.vorn ?? (st === 0 ? "S" : st <= 2 ? art(rng, { S: 3, adv: 2 }) : art(rng, { S: 2, adv: 2, obj: 1 })));
    const kandidaten = vornArt === "S" ? [S] : vornArt === "adv" ? adv : vornArt === "obj" ? objekte : alle;
    if (!kandidaten.length) continue;
    const vorfeld = pick(rng, kandidaten);
    const mittel = alle.filter((g) => g !== vorfeld).sort((a, b) => platz(a) - platz(b));
    if (!eindeutig(vorfeld, mittel)) continue;
    return { r, vorfeld, finit, mittel, ende };
  }
  throw new Error("Kein eindeutiger Satz gefunden");
}
const gliederVon = (b: Bau) => [b.vorfeld, ...b.mittel];
const satzVon = (b: Bau) => `${cap([b.vorfeld.text, b.finit, ...b.mittel.map(gliedText), b.ende].filter(Boolean).join(" "))}.`;
/** The Prädikat as the solution writes it: „hat … geschenkt“, „schenkt“. */
const praedikatVon = (b: Bau) => (b.ende ? `${b.finit} … ${b.ende}` : b.finit);
/** Every way to write a two-part Prädikat: hat geschenkt, hat … geschenkt, hat...geschenkt, geschenkt hat … */
function praedikatVarianten(b: Bau): string[] {
  if (!b.ende) return [b.finit];
  const out: string[] = [];
  for (const [x, y] of [
    [b.finit, b.ende],
    [b.ende, b.finit],
  ])
    for (const t of [" ", " … ", "…", " ... ", "...", " - ", "-", " + ", ", ", " und "]) out.push(`${x}${t}${y}`);
  return out;
}
/** The sentence as a question for one Satzglied: „___ schenkt Lena ein Buch?“ */
function frage(b: Bau, ohne: Glied): string | null {
  const rest = gliederVon(b).filter((g) => g !== ohne);
  const S = rest.find((g) => g.rolle === "S")!;
  const mittel = [S, ...rest.filter((g) => g !== S).sort((x, y) => platz(x) - platz(y))];
  if (!eindeutig(S, mittel.slice(1)) || !eindeutig(S, mittel)) return null;
  return `${GAP} ${[b.finit, ...mittel.map(gliedText), b.ende].filter(Boolean).join(" ")}?`;
}
const zitat = (g: Glied) => `„${g.text}“`;
/** The hint for a question word to fill in: try them, without naming the right one. */
const FRAGEWORT_TIPP = (g: Glied) => `Setz die Fragewörter nacheinander ein und lies die Frage ganz. Bei welchem passt ${zitat(g)} als Antwort?`;
/** The Frageprobe as a sentence: „Wem hat Julia am Abend gedankt?“ (without the asked Satzglied). */
function frageMit(b: Bau, ohne: Glied, wort: string): string {
  const rest = gliederVon(b).filter((g) => g !== ohne);
  const S = rest.find((g) => g.rolle === "S")!;
  const mittel = [S, ...rest.filter((g) => g !== S).sort((x, y) => platz(x) - platz(y))];
  return `${[wort, b.finit, ...mittel.map(gliedText), b.ende].filter(Boolean).join(" ")}?`;
}

/** What a Satzglied is, for the labels. */
const ROLLE_NAME: Record<Rolle, string> = { S: "Subjekt", D: "Dativobjekt", A: "Akkusativobjekt", Z: "Zeitangabe", O: "Ortsangabe", W: "Angabe der Art und Weise", G: "Angabe des Grundes" };
const rolleName = (g: Glied) => (g.adv === "dauer" && g.fall === undefined && /^den /.test(g.text) ? "Zeitangabe" : ROLLE_NAME[g.rolle]);
const ROLLE_FRAGE: Record<Rolle, string> = { S: "Wer oder was?", D: "Wem?", A: "Wen oder was?", Z: "Wann?", O: "Wo?", W: "Wie?", G: "Warum?" };
const gliedFrage = (g: Glied) => (g.adv ? `${ADV_FRAGE[g.adv][0]}?` : ROLLE_FRAGE[g.rolle]);

// ---------- Satzglieder bestimmen ----------
const SG_REGEL = "Was beim Umstellen zusammenbleibt, ist ein Satzglied. Das Subjekt erfragst du mit „Wer oder was?“, das gebeugte Verb steht an zweiter Stelle.";
const SG_HILFE = "Stell den Satz um: Welche Wörter bleiben zusammen? Frag dann mit „Wer oder was?“ und dem Prädikat.";
const PRAEDIKAT_TIPP = "Das Prädikat kann zwei Teile haben: Der gebeugte Teil steht an zweiter Stelle, der andere am Satzende.";

function subjektFehler(b: Bau, g: Glied): Fehler {
  const vorn = g === b.vorfeld ? "Das erste Satzglied ist nicht immer das Subjekt. " : "";
  return F(g.text, `${vorn}${zitat(g)} ist ${g.rolle === "A" || g.rolle === "D" ? "das" : "eine"} ${rolleName(g)}: Frag „Wer oder was ${praedikatVon(b)}?“`.replace(/ +/g, " "));
}
function satzgliederWahl(rng: Rng, st: Stufe): Wahl {
  const kind = st === 0 ? "subjekt" : art(rng, { subjekt: 2, praedikat: st >= 1 ? 2 : 0, einteilung: st >= 2 ? 2 : 0 });
  if (kind === "praedikat") {
    const b = bauen(rng, st, { perfekt: true, adv: st >= 3 ? 2 : 1 });
    const obj = b.mittel.find((g) => g.rolle === "A" || g.rolle === "D") ?? b.mittel.find((g) => g.rolle !== "S") ?? gliederVon(b).find((g) => g.rolle !== "S")!;
    return {
      titel: "Wie heißt das Prädikat?",
      text: satzVon(b),
      richtig: praedikatVon(b),
      falsch: [
        F(b.finit, "Nur den gebeugten Teil genommen: Das Prädikat hat hier zwei Teile"),
        F(b.ende, "Den gebeugten Teil vergessen: Er steht an zweiter Stelle"),
        F(`${b.finit} … ${obj.text} ${b.ende}`, `${zitat(obj)} gehört nicht zum Prädikat, es ist ein eigenes Satzglied`),
      ],
      regel: `Das Prädikat ist zweiteilig: ${praedikatVon(b)}. Der gebeugte Teil steht an zweiter Stelle, der andere am Ende.`,
      hilfe: "Welches Verb steht an zweiter Stelle? Gehört noch ein Teil am Satzende dazu?",
      tipp: PRAEDIKAT_TIPP,
    };
  }
  if (kind === "einteilung") {
    const b = bauen(rng, st, { adv: st >= 3 ? 2 : 1 });
    const teile = [b.vorfeld.text, b.finit, ...b.mittel.map(gliedText), ...(b.ende ? [b.ende] : [])];
    const zeige = (xs: string[]) => `${cap(xs.join(" | "))}.`;
    const falsch: Fehler[] = [];
    // a Satzglied of several words split up
    const lang = teile.map((t, i) => ({ t, i })).filter(({ t }) => t.includes(" "));
    for (const { t, i } of shuffle(rng, lang).slice(0, 2)) {
      const [a, ...rest] = t.split(" ");
      falsch.push(F(zeige([...teile.slice(0, i), a, rest.join(" "), ...teile.slice(i + 1)]), `Zusammengehörende Wörter getrennt: „${t}“ bleibt beim Umstellen zusammen`));
    }
    // two Satzglieder of the Mittelfeld taken as one
    const start = b.ende ? teile.length - 2 : teile.length - 1;
    for (let i = 2; i < start; i++) {
      falsch.push(F(zeige([...teile.slice(0, i), `${teile[i]} ${teile[i + 1]}`, ...teile.slice(i + 2)]), `Zwei Satzglieder zusammengefasst: „${teile[i]}“ und „${teile[i + 1]}“ kann man einzeln umstellen`));
    }
    return {
      titel: "Wo sind die Satzglieder richtig getrennt?",
      text: satzVon(b),
      richtig: zeige(teile),
      falsch: shuffle(rng, falsch),
      regel: `Mit der Umstellprobe: ${zeige(teile)} Jedes Satzglied kann man als Ganzes an den Anfang stellen.`,
      hilfe: "Stell den Satz um. Welche Wörter kannst du nur gemeinsam verschieben?",
      tipp: "Mit der Umstellprobe: Jedes Satzglied kann man als Ganzes an den Anfang stellen. Probier es mit jeder Wortgruppe aus.",
    };
  }
  const b = bauen(rng, st, { adv: st === 0 ? 1 : undefined });
  const andere = gliederVon(b).filter((g) => g.rolle !== "S");
  const S = gliederVon(b).find((g) => g.rolle === "S")!;
  return {
    titel: "Welches Satzglied ist das Subjekt?",
    text: satzVon(b),
    richtig: S.text,
    falsch: andere.map((g) => subjektFehler(b, g)),
    regel: `Wer oder was ${b.finit}${b.ende ? ` … ${b.ende}` : ""}? ${cap(S.text)}. Das Subjekt steht im Nominativ.`,
    hilfe: "Frag mit „Wer oder was?“ und dem Prädikat.",
    tipp: `Frag: Wer oder was ${b.finit}${b.ende ? ` … ${b.ende}` : ""}? Das Subjekt steht im Nominativ.`,
  };
}
function satzgliederLuecke(rng: Rng, st: Stufe): Satz {
  const b = bauen(rng, st, { perfekt: st >= 1 ? rng() < 0.6 : false, adv: st === 0 ? 1 : undefined });
  const S = gliederVon(b).find((g) => g.rolle === "S")!;
  const andere = gliederVon(b).filter((g) => g.rolle !== "S");
  const pr = praedikatVon(b);
  return {
    titel: "Schreib das Subjekt und das Prädikat heraus.",
    text: `${satzVon(b)}\nSubjekt: ${GAP}\nPrädikat: ${GAP}`,
    luecken: [
      L([S.text], andere.map((g) => subjektFehler(b, g))),
      L(
        praedikatVarianten(b),
        b.ende
          ? [F(b.finit, "Nur den gebeugten Teil genommen: Das Prädikat hat hier zwei Teile"), F(b.ende, "Den gebeugten Teil vergessen: Er steht an zweiter Stelle")]
          : [F(`${b.finit} ${b.mittel.at(-1)!.text}`, `${zitat(b.mittel.at(-1)!)} gehört nicht zum Prädikat`)],
      ),
    ],
    regel: `Subjekt: ${S.text} (Wer oder was ${pr}?). Prädikat: ${pr}.`,
    hilfe: SG_HILFE,
    tipp: `Das Prädikat ist das gebeugte Verb an zweiter Stelle, bei zwei Teilen auch der Teil am Satzende. Das Subjekt findest du mit „Wer oder was?“ und dem Prädikat.`,
  };
}
function satzgliederKurz(rng: Rng, st: Stufe): Umformung {
  const kind = art(rng, { umstellen: 2, praedikat: st >= 1 ? 1 : 0, subjekt: 1 });
  if (kind === "umstellen") {
    // three or four Satzglieder: every order with the verb second counts
    // an Akkusativobjekt goes in front only when it shows its case
    const vornMoeglich = (x: Bau) => gliederVon(x).filter((g) => g !== x.vorfeld && (g.rolle !== "A" || /^(den|einen|meinen) /.test(g.text)));
    let b = bauen(rng, st, { adv: 1, vorn: "S", passt: (r) => !r.dat || !r.akk });
    while (!vornMoeglich(b).length) b = bauen(rng, st, { adv: 1, vorn: "S", passt: (r) => !r.dat || !r.akk });
    const glieder = gliederVon(b);
    const neu = pick(rng, vornMoeglich(b));
    const ordnung = [neu, ...glieder.filter((g) => g !== neu)];
    // starts with the asked Satzglied; the name before the objects („hilft meiner Cousine Nina“ could be one Wortgruppe)
    const von = new Map(glieder.map((g) => [g.text, g]));
    const richtig = stellungen(ordnung.map(gliedText), b.finit, b.ende, (v, m) => {
      const mittel = m.map((x) => von.get(x)!);
      const s = mittel.findIndex((g) => g.rolle === "S");
      return v === neu.text && eindeutig(neu, mittel) && mittel.every((g, i) => !(g.rolle === "D" || g.rolle === "A") || s < 0 || s < i);
    });
    const ohneVerbZwei = `${cap([neu.text, ...glieder.filter((g) => g !== neu).map(gliedText), b.finit, b.ende].filter(Boolean).join(" "))}.`;
    const fehler = [F(ohneVerbZwei, "Das gebeugte Verb steht an zweiter Stelle, gleich nach dem ersten Satzglied")];
    if (b.ende) fehler.push(F(`${cap([neu.text, b.finit, b.ende, ...glieder.filter((g) => g !== neu).map(gliedText)].join(" "))}.`, "Der zweite Teil des Prädikats steht am Satzende"));
    return {
      auftrag: `Mach die Umstellprobe. Beginne mit „${cap(neu.text)}“.`,
      vorlage: satzVon(b),
      richtig,
      fehler,
      regel: `${richtig[0]} Die Satzglieder bleiben beim Umstellen zusammen, das gebeugte Verb bleibt an zweiter Stelle.`,
      hilfe: "Stell das Satzglied an den Anfang. Was steht dann an zweiter Stelle?",
      tipp: "Die Satzglieder bleiben beim Umstellen zusammen, das gebeugte Verb bleibt an zweiter Stelle.",
    };
  }
  if (kind === "praedikat") {
    const b = bauen(rng, st, { perfekt: true });
    const obj = b.mittel.find((g) => g.rolle !== "S") ?? b.vorfeld;
    return {
      auftrag: "Schreib das Prädikat heraus. Es hat zwei Teile.",
      vorlage: satzVon(b),
      richtig: praedikatVarianten(b),
      fehler: [F(b.finit, "Nur den gebeugten Teil genommen: Das Prädikat hat hier zwei Teile"), F(b.ende, "Den gebeugten Teil vergessen: Er steht an zweiter Stelle"), F(`${b.finit} ${obj.text} ${b.ende}`, `${zitat(obj)} gehört nicht zum Prädikat`)],
      regel: `Das Prädikat ist ${praedikatVon(b)}: der gebeugte Teil an zweiter Stelle, der andere am Ende.`,
      hilfe: "Welches Verb steht an zweiter Stelle? Welcher Teil gehört am Ende dazu?",
      tipp: PRAEDIKAT_TIPP,
    };
  }
  const b = bauen(rng, st, { vorn: st >= 1 ? "adv" : "S", adv: st >= 1 ? 1 : undefined });
  const S = gliederVon(b).find((g) => g.rolle === "S")!;
  return {
    auftrag: "Schreib das Subjekt heraus.",
    vorlage: satzVon(b),
    richtig: [S.text],
    fehler: gliederVon(b)
      .filter((g) => g !== S)
      .map((g) => subjektFehler(b, g)),
    regel: `Wer oder was ${praedikatVon(b)}? ${cap(S.text)}.`,
    hilfe: "Frag mit „Wer oder was?“ und dem Prädikat.",
    tipp: `Frag: Wer oder was ${praedikatVon(b)}?`,
  };
}

// ---------- Objekte ----------
/** A time in the Akkusativ: answers „Wie lange?“, not „Wen oder was?“ (a trap from level 3). */
const DAUER_AKK = "den ganzen Nachmittag";
const OBJ_REGEL = "„Wem?“ fragt nach dem Dativobjekt, „Wen oder was?“ nach dem Akkusativobjekt. Frag immer mit dem ganzen Prädikat.";
function objektFehler(g: Glied, gesucht: "D" | "A"): Fehler {
  if (g.rolle === "A" && gesucht === "D") return F(g.text, "Akkusativobjekt statt Dativobjekt: Das Dativobjekt antwortet auf „Wem?“");
  if (g.rolle === "D" && gesucht === "A") return F(g.text, "Dativobjekt statt Akkusativobjekt: Das Akkusativobjekt antwortet auf „Wen oder was?“");
  if (g.rolle === "S") return F(g.text, "Das ist das Subjekt (Wer oder was?)");
  if (g.adv === "dauer" && /^den /.test(g.text)) return F(g.text, "Eine Zeitangabe im Akkusativ ist kein Objekt: Sie antwortet auf „Wie lange?“");
  return F(g.text, `Das ist eine adverbiale Bestimmung (${gliedFrage(g)}), kein Objekt`);
}
function objekteWahl(rng: Rng, st: Stufe): Wahl {
  const kind = art(rng, { welches: 3, was: st >= 1 ? 2 : 0 });
  const gesucht: "D" | "A" = rng() < 0.5 ? "D" : "A";
  // an Akkusativ time („den ganzen Nachmittag“) as a trap from level 3
  const falle = st >= 3 && gesucht === "A" && rng() < 0.4;
  const b = falle
    ? bauen(rng, st, { passt: (r) => Boolean(r.akk && r.adv.dauer?.includes(DAUER_AKK)), mit: ["dauer"], text: { dauer: DAUER_AKK } })
    : bauen(rng, st, { passt: (r) => (kind === "welches" && st >= 2 ? Boolean(r.dat && r.akk) : gesucht === "D" ? Boolean(r.dat) : Boolean(r.akk)) });
  if (kind === "was") {
    const kandidaten = gliederVon(b).filter((g) => ["S", "D", "A"].includes(g.rolle) || g.adv);
    const g = pick(rng, kandidaten);
    const name = (x: Glied) => (x.rolle === "S" ? "Subjekt" : x.rolle === "D" ? "Dativobjekt" : x.rolle === "A" ? "Akkusativobjekt" : "adverbiale Bestimmung");
    const richtig = name(g);
    const labels: Record<string, string> = {
      Subjekt: `${zitat(g)} antwortet nicht auf „Wer oder was?“`,
      Dativobjekt: `${zitat(g)} antwortet nicht auf „Wem?“`,
      Akkusativobjekt: g.adv === "dauer" ? "Eine Zeitangabe im Akkusativ ist kein Objekt: Sie antwortet auf „Wie lange?“" : `${zitat(g)} antwortet nicht auf „Wen oder was?“`,
      "adverbiale Bestimmung": `${zitat(g)} ist ${g.rolle === "S" ? "das Subjekt" : "ein Objekt"}, keine Angabe von Zeit, Ort, Art und Weise oder Grund`,
    };
    return {
      titel: `Welches Satzglied ist ${zitat(g)}?`,
      text: satzVon(b),
      richtig,
      falsch: ["Subjekt", "Dativobjekt", "Akkusativobjekt", "adverbiale Bestimmung"].filter((x) => x !== richtig).map((x) => F(x, labels[x])),
      regel: `${gliedFrage(g)} ${cap(g.text)}: ${richtig === "adverbiale Bestimmung" ? `eine ${rolleName(g)}` : `das ${richtig}`}.`,
      hilfe: "Frag mit dem ganzen Prädikat: Wer oder was? Wem? Wen oder was? Wann, wo, wie, warum?",
      tipp: `Stell die Fragen mit dem ganzen Prädikat (${praedikatVon(b)}). Auf welche antwortet ${zitat(g)}?`,
    };
  }
  const ziel = gliederVon(b).find((g) => g.rolle === gesucht)!;
  return {
    titel: `Welches Satzglied ist das ${gesucht === "D" ? "Dativobjekt" : "Akkusativobjekt"}?`,
    text: satzVon(b),
    richtig: ziel.text,
    falsch: gliederVon(b)
      .filter((g) => g !== ziel)
      .map((g) => objektFehler(g, gesucht)),
    regel: `${frageMit(b, ziel, gesucht === "D" ? "Wem" : "Wen oder was")} ${cap(ziel.text)}.`,
    hilfe: OBJ_REGEL,
    tipp: `Frag: ${frageMit(b, ziel, gesucht === "D" ? "Wem" : "Wen oder was")}`,
  };
}
/** The question words for an object: Wem? Wen oder was? (things: also Was?, persons: also Wen?). */
function objektFragen(g: Glied): { richtig: string[]; fehler: Fehler[] } {
  const person = g.np?.n.art === "person";
  // after an animal both are heard: Wen füttert Lena? Was füttert Lena?
  const tier = g.np?.n.art === "tier";
  if (g.rolle === "D")
    return {
      richtig: ["Wem"],
      fehler: [F("Wen oder was", "„Wen oder was?“ fragt nach dem Akkusativobjekt"), F("Wen", "„Wen?“ fragt nach dem Akkusativobjekt"), F("Wer oder was", "„Wer oder was?“ fragt nach dem Subjekt"), F("Wer", "„Wer?“ fragt nach dem Subjekt"), F("Wessen", "„Wessen?“ fragt nach dem Genitiv")],
    };
  return {
    richtig: ["Wen oder was", ...(tier ? ["Wen", "Was"] : [person ? "Wen" : "Was"])],
    fehler: [
      F("Wem", "„Wem?“ fragt nach dem Dativobjekt"),
      F("Wer oder was", "„Wer oder was?“ fragt nach dem Subjekt"),
      F("Wer", "„Wer?“ fragt nach dem Subjekt"),
      ...(tier ? [] : [person ? F("Was", "Nach einer Person fragst du mit „Wen?“") : F("Wen", "Nach einem Ding fragst du mit „Was?“")]),
    ],
  };
}
function objekteLuecke(rng: Rng, st: Stufe): Satz {
  for (let k = 0; k < 500; k++) {
    const gesucht: "D" | "A" = rng() < 0.5 ? "D" : "A";
    const b = bauen(rng, st, { passt: (r) => (gesucht === "D" ? Boolean(r.dat) : Boolean(r.akk)) && (st >= 2 || !(r.dat && r.akk) || rng() < 0.5) });
    const ziel = gliederVon(b).find((g) => g.rolle === gesucht)!;
    const q = frage(b, ziel);
    if (!q) continue;
    const { richtig, fehler } = objektFragen(ziel);
    return {
      titel: `Mit welcher Frage findest du ${zitat(ziel)}? Setze das Fragewort ein.`,
      text: `${satzVon(b)}\n${q}`,
      luecken: [L(richtig, fehler)],
      regel: `${richtig[0]} ${q.slice(GAP.length + 1)} ${cap(ziel.text)}: das ${gesucht === "D" ? "Dativobjekt" : "Akkusativobjekt"}.`,
      hilfe: OBJ_REGEL,
      tipp: FRAGEWORT_TIPP(ziel),
    };
  }
  throw new Error("Kein passender Satz gefunden");
}
function objekteKurz(rng: Rng, st: Stufe): Umformung {
  const gesucht: "D" | "A" = rng() < 0.5 ? "D" : "A";
  const b = bauen(rng, st, { passt: (r) => (st >= 1 ? Boolean(r.dat && r.akk) : gesucht === "D" ? Boolean(r.dat) : Boolean(r.akk)) });
  const ziel = gliederVon(b).find((g) => g.rolle === gesucht)!;
  return {
    auftrag: `Schreib das ${gesucht === "D" ? "Dativobjekt" : "Akkusativobjekt"} heraus.`,
    vorlage: satzVon(b),
    richtig: [ziel.text],
    fehler: gliederVon(b)
      .filter((g) => g !== ziel)
      .map((g) => objektFehler(g, gesucht)),
    regel: `${frageMit(b, ziel, gesucht === "D" ? "Wem" : "Wen oder was")} ${cap(ziel.text)}.`,
    hilfe: OBJ_REGEL,
    tipp: `Frag: ${frageMit(b, ziel, gesucht === "D" ? "Wem" : "Wen oder was")}`,
  };
}
/**
 * An object in the wrong case. Only errors that are wrong in every reading: a masculine Dativobjekt in
 * the Akkusativ (meinen Opa), an Akkusativobjekt in the Dativ. Never a feminine or neuter Dativobjekt in
 * the Nominativ or Akkusativ: „Lena hilft meine Oma“ can mean „Meine Oma hilft Lena“.
 */
function objektFehlerSatz(rng: Rng, st: Stufe): Satz {
  for (let k = 0; k < 500; k++) {
    const b = bauen(rng, st, { vorn: "S", passt: (r) => Boolean(r.dat || r.akk) && !r.subjekt });
    const ziele = b.mittel.filter((g) => (g.rolle === "D" && g.np?.n.genus === "m") || (g.rolle === "A" && !b.r.akkImDativOk));
    if (!ziele.length) continue;
    const ziel = pick(rng, ziele);
    const x = ziel.np!;
    const falsch = ziel.rolle === "D" ? form(x, "akk") : form(x, "dat");
    const i = b.mittel.indexOf(ziel);
    const text = `${cap([b.vorfeld.text, b.finit, ...b.mittel.map((g, j) => (j === i ? GAP : g.text)), b.ende].filter(Boolean).join(" "))}.`;
    const label = ziel.rolle === "D" ? "Akkusativ statt Dativ: Das Dativobjekt antwortet auf „Wem?“" : "Dativ statt Akkusativ: Das Akkusativobjekt antwortet auf „Wen oder was?“";
    return { titel: "", text, luecken: [L(ziel.text, [F(falsch, label)])], regel: OBJ_REGEL, hilfe: OBJ_REGEL };
  }
  throw new Error("Kein passender Satz gefunden");
}

// ---------- adverbiale Bestimmungen ----------
const ADV_REGEL = "Zeit: Wann? Wie lange? Ort: Wo? Wohin? Woher? Art und Weise: Wie? Grund: Warum?";
function typFehler(g: Glied, gewaehlt: AdvTyp): Fehler {
  const richtig = ADV_TYP[g.adv!];
  const frage = `„${ADV_FRAGE[g.adv!][0]}?“`;
  if (richtig === "grund" && gewaehlt === "ort") return F(TYP_NAME[gewaehlt], `Nicht jede Wortgruppe mit Präposition ist eine Ortsangabe: ${zitat(g)} antwortet auf ${frage}`);
  return F(TYP_NAME[gewaehlt], `${TYP_KURZ[gewaehlt]} statt ${TYP_KURZ[richtig]}: ${zitat(g)} antwortet auf ${frage}`);
}
function adverbialeWahl(rng: Rng, st: Stufe): Wahl {
  const kind = art(rng, { typ: 3, welches: st >= 1 ? 2 : 0 });
  const b = bauen(rng, st, { adv: kind === "welches" ? 2 : st === 0 ? 1 : undefined, mit: st >= 2 && rng() < 0.4 ? ["grund"] : undefined });
  const advs = gliederVon(b).filter((g) => g.adv);
  if (!advs.length || (kind === "welches" && advs.length < 2)) return adverbialeWahl(rng, st);
  if (kind === "welches") {
    const ziel = pick(rng, advs);
    const typ = ADV_TYP[ziel.adv!];
    return {
      titel: `Welches Satzglied ist die adverbiale Bestimmung ${TYP_GENITIV[typ]}?`,
      text: satzVon(b),
      richtig: ziel.text,
      falsch: gliederVon(b)
        .filter((g) => g !== ziel)
        .map((g) => F(g.text, g.adv ? `${zitat(g)} ist eine Angabe ${TYP_GENITIV[ADV_TYP[g.adv]]} (${gliedFrage(g)})` : `${zitat(g)} ist das ${ROLLE_NAME[g.rolle]} (${gliedFrage(g)})`)),
      regel: `${ADV_FRAGE[ziel.adv!][0]}? ${cap(ziel.text)}: eine adverbiale Bestimmung ${TYP_GENITIV[typ]}.`,
      hilfe: ADV_REGEL,
      tipp: `Frag: ${frageMit(b, ziel, ADV_FRAGE[ziel.adv!][0])}`,
    };
  }
  // the Grund first when there is one (the trap with a preposition), otherwise any
  const ziel = advs.find((g) => g.adv === "grund" && st >= 2) ?? pick(rng, advs);
  const typ = ADV_TYP[ziel.adv!];
  return {
    titel: `Welche adverbiale Bestimmung ist ${zitat(ziel)}?`,
    text: satzVon(b),
    richtig: TYP_NAME[typ],
    falsch: (Object.keys(TYP_NAME) as AdvTyp[]).filter((t) => t !== typ).map((t) => typFehler(ziel, t)),
    regel: `${frageMit(b, ziel, ADV_FRAGE[ziel.adv!][0])} ${cap(ziel.text)}: adverbiale Bestimmung ${TYP_GENITIV[typ]}.`,
    hilfe: ADV_REGEL,
    tipp: `Stell die Fragen mit dem ganzen Prädikat (${praedikatVon(b)}). Auf welche antwortet ${zitat(ziel)}?`,
  };
}
/** The wrong question words for an adverbiale Bestimmung. */
function advFrageFehler(a: AdvArt): Fehler[] {
  const alle: [string, string][] = [
    ["Wann", "„Wann?“ fragt nach der Zeit"],
    ["Wie lange", "„Wie lange?“ fragt nach der Dauer"],
    ["Wo", "„Wo?“ fragt nach dem Ort, an dem etwas passiert"],
    ["Wohin", "„Wohin?“ fragt nach dem Ziel"],
    ["Woher", "„Woher?“ fragt nach der Herkunft"],
    ["Wie", "„Wie?“ fragt nach der Art und Weise"],
    ["Warum", "„Warum?“ fragt nach dem Grund"],
    ["Wer", "„Wer?“ fragt nach dem Subjekt"],
    ["Was", "„Was?“ fragt nach dem Subjekt oder dem Akkusativobjekt"],
  ];
  return alle.filter(([w]) => !ADV_FRAGE[a].includes(w)).map(([w, l]) => F(w, l));
}
function adverbialeLuecke(rng: Rng, st: Stufe): Satz {
  for (let k = 0; k < 500; k++) {
    const b = bauen(rng, st, { mit: st >= 2 && rng() < 0.3 ? ["grund"] : undefined, adv: st === 0 ? 1 : undefined });
    const advs = gliederVon(b).filter((g) => g.adv);
    if (!advs.length) continue;
    const ziel = pick(rng, advs);
    const q = frage(b, ziel);
    if (!q) continue;
    const richtig = [...ADV_FRAGE[ziel.adv!], ...(/^um .* Uhr$/.test(ziel.text) ? ["Um wie viel Uhr"] : [])];
    return {
      titel: `Mit welcher Frage findest du ${zitat(ziel)}? Setze das Fragewort ein.`,
      text: `${satzVon(b)}\n${q}`,
      luecken: [L(richtig, advFrageFehler(ziel.adv!))],
      regel: `${richtig[0]} ${q.slice(GAP.length + 1)} ${cap(ziel.text)}: adverbiale Bestimmung ${TYP_GENITIV[ADV_TYP[ziel.adv!]]}.`,
      hilfe: ADV_REGEL,
      tipp: FRAGEWORT_TIPP(ziel),
    };
  }
  throw new Error("Kein passender Satz gefunden");
}
function adverbialeKurz(rng: Rng, st: Stufe): Umformung {
  const b = bauen(rng, st, { adv: st === 0 ? 1 : 2, mit: st >= 2 && rng() < 0.4 ? ["grund"] : undefined });
  const advs = gliederVon(b).filter((g) => g.adv);
  const ziel = pick(rng, advs);
  const typ = ADV_TYP[ziel.adv!];
  return {
    auftrag: `Schreib die adverbiale Bestimmung ${TYP_GENITIV[typ]} heraus.`,
    vorlage: satzVon(b),
    richtig: [ziel.text],
    fehler: gliederVon(b)
      .filter((g) => g !== ziel)
      .map((g) => F(g.text, g.adv ? `${zitat(g)} ist eine Angabe ${TYP_GENITIV[ADV_TYP[g.adv]]} (${gliedFrage(g)})` : `${zitat(g)} ist das ${ROLLE_NAME[g.rolle]} (${gliedFrage(g)})`)),
    regel: `${ADV_FRAGE[ziel.adv!][0]}? ${cap(ziel.text)}.`,
    hilfe: ADV_REGEL,
    tipp: `Frag: ${frageMit(b, ziel, ADV_FRAGE[ziel.adv!][0])}`,
  };
}

// =====================================================================
// ---------- Fälle ----------
// =====================================================================
const FALL_NR: Record<Fall, number> = { nom: 1, gen: 2, dat: 3, akk: 4 };
const FALL_REGEL = "Frag mit dem ganzen Prädikat: Wer oder was? (Nominativ), Wessen? (Genitiv), Wem? (Dativ), Wen oder was? (Akkusativ).";
const FALL_ERSATZPROBE = "Ersatzprobe: Setz statt der Wortgruppe „ich“, „mir“ oder „mich“ ein. Passt „ich“, ist es der Nominativ, bei „mir“ der Dativ, bei „mich“ der Akkusativ. Antwortet sie auf „Wessen?“, ist es der Genitiv.";
/** Another noun of the same genus: the case shown on a word that is not asked. */
const BSP_NOMEN: Record<NP["n"]["genus"], string[]> = { m: ["Hund", "Kater"], f: ["Katze", "Tante"], n: ["Pferd", "Heft"] };
const bspNp = (x: NP): NP => np(x.b, BSP_NOMEN[x.n.genus].find((w) => w !== x.n.wort)!);
/** The subjects of the Fälle sentences: ich, wir, a name or „mein Bruder“; `markiert`: the subject shows its case. */
type FallSubjekt = { text: string; p: 0 | 3 | 2; markiert: boolean };
function fallSubjekt(rng: Rng): FallSubjekt {
  return pick(rng, [
    { text: "ich", p: 0, markiert: true },
    { text: "wir", p: 3, markiert: true },
    { text: pick(rng, NAMEN), p: 2, markiert: false },
    { text: pick(rng, ["mein Bruder", "mein Onkel", "der Trainer"]), p: 2, markiert: true },
  ] as FallSubjekt[]);
}
const vf = (formen3: [string, string, string], s: FallSubjekt) => formen3[s.p === 0 ? 0 : s.p === 3 ? 1 : 2];
/** Verbs with a Dativobjekt (and maybe an Akkusativobjekt): forms for ich, wir, er; Verbzusatz; what follows. */
const DAT_VERBEN: { f: [string, string, string]; teil?: string; nach?: string; akk?: string }[] = [
  { f: ["helfe", "helfen", "hilft"], nach: "beim Kochen" },
  { f: ["danke", "danken", "dankt"], nach: "für das Geschenk" },
  { f: ["gratuliere", "gratulieren", "gratuliert"], nach: "zum Geburtstag" },
  { f: ["glaube", "glauben", "glaubt"] },
  { f: ["höre", "hören", "hört"], teil: "zu" },
  { f: ["gebe", "geben", "gibt"], akk: "das Heft" },
  { f: ["schenke", "schenken", "schenkt"], akk: "eine Blume" },
  { f: ["zeige", "zeigen", "zeigt"], akk: "das Foto" },
  { f: ["erkläre", "erklären", "erklärt"], akk: "die Aufgabe" },
];
/** Verbs with an Akkusativobjekt (a masculine one: the feminine and neuter Akkusativ looks like the Nominativ). */
const AKK_VERBEN: { f: [string, string, string]; nach?: string; was: "person" | "ding" }[] = [
  { f: ["besuche", "besuchen", "besucht"], nach: "am Sonntag", was: "person" },
  { f: ["frage", "fragen", "fragt"], nach: "nach dem Weg", was: "person" },
  { f: ["treffe", "treffen", "trifft"], nach: "nach der Schule", was: "person" },
  { f: ["suche", "suchen", "sucht"], was: "ding" },
  { f: ["finde", "finden", "findet"], nach: "nicht", was: "ding" },
];
/** Prepositions with one case and sentences for them ({S} is a name, ___ the Wortgruppe). */
const PRAEP_SAETZE: { p: string; fall: "dat" | "akk"; satz: string; was: "person" | "ding" | "ort" }[] = [
  { p: "mit", fall: "dat", satz: "{S} geht mit ___ spazieren.", was: "person" },
  { p: "bei", fall: "dat", satz: "{S} übernachtet bei ___.", was: "person" },
  { p: "zu", fall: "dat", satz: "{S} fährt am Sonntag zu ___.", was: "person" },
  { p: "von", fall: "dat", satz: "{S} bekommt ein Geschenk von ___.", was: "person" },
  { p: "aus", fall: "dat", satz: "{S} nimmt das Heft aus ___.", was: "ort" },
  { p: "für", fall: "akk", satz: "{S} kauft eine Blume für ___.", was: "person" },
  { p: "ohne", fall: "akk", satz: "{S} fährt ohne ___ nach Wien.", was: "person" },
  { p: "gegen", fall: "akk", satz: "{S} spielt Tischtennis gegen ___.", was: "person" },
  { p: "durch", fall: "akk", satz: "Der Hund läuft durch ___.", was: "ort" },
];
const ORTE_DAT = [["der", "Rucksack"], ["der", "Tasche"], ["mein", "Rucksack"], ["mein", "Tasche"]] as [Begleiter, string][];
const ORTE_AKK = [["der", "Garten"], ["der", "Park"]] as [Begleiter, string][];
/** Personal pronouns: Dativ and Akkusativ. */
const PRONOMEN: Record<"ich" | "du" | "er", { dat: string; akk: string }> = { ich: { dat: "mir", akk: "mich" }, du: { dat: "dir", akk: "dich" }, er: { dat: "ihm", akk: "ihn" } };
const PRON_SAETZE: { satz: string; fall: "dat" | "akk"; pron: "ich" | "du" | "er" }[] = [
  { satz: "Kannst du ___ helfen?", fall: "dat", pron: "ich" },
  { satz: "Lena gibt ___ den Ball.", fall: "dat", pron: "du" },
  { satz: "Das Fahrrad gehört ___.", fall: "dat", pron: "er" },
  { satz: "Der Kuchen schmeckt ___.", fall: "dat", pron: "ich" },
  { satz: "Ich danke ___ für das Geschenk.", fall: "dat", pron: "du" },
  { satz: "Wir vertrauen ___.", fall: "dat", pron: "er" },
  { satz: "Ich besuche ___ am Sonntag.", fall: "akk", pron: "du" },
  { satz: "Jonas fragt ___ nach dem Weg.", fall: "akk", pron: "ich" },
  { satz: "Wir sehen ___ im Park.", fall: "akk", pron: "er" },
  { satz: "Der Hund kennt ___ schon.", fall: "akk", pron: "du" },
  { satz: "Hast du ___ gesehen?", fall: "akk", pron: "ich" },
  { satz: "Mia ruft ___ zum Essen.", fall: "akk", pron: "er" },
];
const anderer = (f: "dat" | "akk") => (f === "dat" ? "akk" : "dat");
const verwechselt = (f: Fall, statt: Fall) => `${FALL_KURZ[statt]} statt ${FALL_KURZ[f]}: ${FALL_FRAGE[f].replace("?", "")}? Das verlangt den ${FALL_KURZ[f]}`;
/**
 * A Fälle sentence with one gap: the Begleiter (meinem), a pronoun (mir) or, for "Fehler korrigieren", the
 * whole Wortgruppe. `ziel` is the Wortgruppe as it stands in the right sentence (for multiple choice).
 */
type FallLuecke = { satz: Satz; ziel: string; fall: Fall; praep?: string; vorlage?: { x: NP; fall: Fall } };
function fallSatz(rng: Rng, st: Stufe, fuerFix = false): FallLuecke {
  const kind = art(rng, { dat: 3, akk: 2, praep: st >= 1 ? 3 : 0, pron: 2, gen: st >= 2 && !fuerFix ? 2 : 0 });
  const titel = "Setze das Wort in Klammern im richtigen Fall ein.";
  if (kind === "pron") {
    const p = pick(rng, PRON_SAETZE);
    const richtig = PRONOMEN[p.pron][p.fall];
    const falsch = PRONOMEN[p.pron][anderer(p.fall)];
    return {
      satz: {
        titel,
        text: p.satz,
        luecken: [L(richtig, [F(falsch, verwechselt(p.fall, anderer(p.fall))), F(p.pron, `Das ist der Nominativ: ${FALL_FRAGE[p.fall]} ${richtig}`, { fix: false })], fuerFix ? undefined : p.pron)],
        regel: `${FALL_FRAGE[p.fall]} ${richtig}: ${FALL_NAME[p.fall]}.`,
        hilfe: FALL_REGEL,
        tipp: `Frag mit dem Prädikat: Wem? oder Wen oder was? Dann setz „${p.pron}“ in diesen Fall.`,
      },
      ziel: richtig,
      fall: p.fall,
    };
  }
  if (kind === "praep") {
    const p = pick(rng, PRAEP_SAETZE);
    const ort = p.was === "ort" ? pick(rng, p.fall === "dat" ? ORTE_DAT : ORTE_AKK) : null;
    const person = pick(rng, PERSONEN.filter((n) => n.wort !== "Mutter" && n.wort !== "Vater"));
    // „zu dem Lehrer“ is mostly „zum Lehrer“: zu, von and bei only with „mein“
    const x = ort ? np(ort[0], ort[1]) : np(["zu", "von", "bei"].includes(p.p) ? "mein" : pick(rng, ["mein", "der"] as const), person.wort);
    const s = p.satz.replace("{S}", pick(rng, NAMEN));
    const richtigNp = form(x, p.fall);
    const falschNp = form(x, anderer(p.fall));
    const label = `Nach „${p.p}“ steht immer der ${FALL_KURZ[p.fall]}`;
    const regel = `„${p.p}“ verlangt den ${FALL_NAME[p.fall]}: ${p.p} ${richtigNp}.`;
    if (fuerFix) return { satz: { titel, text: s, luecken: [L(richtigNp, [F(falschNp, label)])], regel, hilfe: FALL_REGEL }, ziel: richtigNp, fall: p.fall, praep: p.p };
    const art0 = begleiter(x.b, x.n.genus, p.fall);
    return {
      satz: {
        titel,
        text: s.replace(GAP, `${GAP} ${x.n.wort}`),
        luecken: [L(art0, [F(begleiter(x.b, x.n.genus, anderer(p.fall)), label), F(begleiter(x.b, x.n.genus, "nom"), `Das ist der Nominativ: ${label}`)], x.b)],
        regel,
        hilfe: FALL_REGEL,
        tipp: `„${p.p}“ verlangt den ${FALL_NAME[p.fall]}. Wie heißt „${x.b}“ in diesem Fall vor „${x.n.wort}“?`,
      },
      ziel: richtigNp,
      fall: p.fall,
      praep: p.p,
      vorlage: { x, fall: p.fall },
    };
  }
  if (kind === "gen") {
    // Wessen …? the noun of a person whose Genitiv is not its plural (Opas, Cousins could be both)
    const person = pick(rng, PERSONEN.filter((n) => !["Opa", "Cousin"].includes(n.wort)));
    const ding = pick(rng, DINGE.filter((n) => ["Fahrrad", "Jacke", "Handy", "Rucksack", "Schal", "Buch", "Tasche", "Kappe", "Uhr", "Heft"].includes(n.wort)));
    const dingNp = form(np("der", ding.wort), "nom");
    const x = np(pick(rng, ["mein", "der"] as const), person.wort);
    const richtig = begleiter(x.b, x.n.genus, "gen");
    const wessen = `Wessen ${ding.wort}?`;
    const fehler = person.genus === "f" ? [F(begleiter(x.b, "f", "nom"), `${wessen} Das verlangt den Genitiv: ${form(x, "gen")}`)] : [F(begleiter(x.b, "m", "dat"), `Dativ statt Genitiv: ${wessen} ${form(x, "gen")}`), F(begleiter(x.b, "m", "akk"), `Akkusativ statt Genitiv: ${wessen} ${form(x, "gen")}`)];
    return {
      satz: {
        titel,
        text: `Das ist ${dingNp} ${GAP} ${x.n.gen[0]}.`,
        luecken: [L(richtig, fehler, x.b)],
        regel: `${wessen} ${cap(form(x, "gen"))}: ${FALL_NAME.gen}.`,
        hilfe: FALL_REGEL,
        tipp: `Frag: ${wessen} Darauf antwortet der Genitiv. Wie heißt „${x.b}“ im Genitiv vor „${x.n.wort}“?`,
      },
      ziel: form(x, "gen"),
      fall: "gen",
      vorlage: { x, fall: "gen" },
    };
  }
  const s = fallSubjekt(rng);
  if (kind === "dat") {
    const v = pick(rng, DAT_VERBEN);
    // a feminine Dativobjekt in the Akkusativ is only sure to be wrong when the subject shows its case
    const n = pick(rng, PERSONEN.filter((x) => (!fuerFix || x.genus === "m" || s.markiert) && !s.text.endsWith(` ${x.wort}`)));
    const x = np(pick(rng, ["mein", "der"] as const), n.wort);
    const teile = [cap(s.text), vf(v.f, s), GAP, v.akk ?? "", v.nach ?? "", v.teil ?? ""].filter(Boolean);
    const text = `${teile.join(" ")}.`;
    const richtigNp = form(x, "dat");
    const verbInf = v.f[1];
    const label = `„${verbInf}“ verlangt ein Dativobjekt: Wem? ${richtigNp}`;
    if (fuerFix) return { satz: { titel, text, luecken: [L(richtigNp, [F(form(x, "akk"), label)])], regel: `Wem? ${richtigNp}: ${FALL_NAME.dat}.`, hilfe: FALL_REGEL }, ziel: richtigNp, fall: "dat" };
    return {
      satz: {
        titel,
        text: text.replace(GAP, `${GAP} ${x.n.wort}`),
        luecken: [L(begleiter(x.b, x.n.genus, "dat"), [F(begleiter(x.b, x.n.genus, "akk"), label), F(begleiter(x.b, x.n.genus, "nom"), `Das ist der Nominativ: ${label}`), F(begleiter(x.b, x.n.genus, "gen"), `Das ist der Genitiv: ${label}`)], x.b)],
        regel: `Wem? ${richtigNp}: ${FALL_NAME.dat}.`,
        hilfe: FALL_REGEL,
        tipp: `„${verbInf}“ verlangt ein Dativobjekt: Frag „Wem?“. Wie heißt „${x.b}“ im Dativ vor „${x.n.wort}“?`,
      },
      ziel: richtigNp,
      fall: "dat",
      vorlage: { x, fall: "dat" },
    };
  }
  // Akkusativ: masculine (the feminine and neuter Akkusativ looks like the Nominativ)
  const v = pick(rng, AKK_VERBEN);
  const n = pick(rng, v.was === "person" ? PERSONEN.filter((x) => x.genus === "m" && !s.text.endsWith(` ${x.wort}`)) : DINGE.filter((x) => x.genus === "m" && ["Schlüssel", "Ball", "Rucksack", "Bleistift", "Schal"].includes(x.wort)));
  const x = np(pick(rng, ["mein", "der"] as const), n.wort);
  const text = `${[cap(s.text), vf(v.f, s), GAP, v.nach ?? ""].filter(Boolean).join(" ")}.`;
  const richtigNp = form(x, "akk");
  const label = `„${v.f[1]}“ verlangt ein Akkusativobjekt: Wen oder was? ${richtigNp}`;
  // the Nominativ is an error only when the subject shows its case („Lena besucht mein Opa“ can mean „Mein Opa besucht Lena“)
  const nomFix = s.markiert ? {} : ({ fix: false } as const);
  if (fuerFix) return { satz: { titel, text, luecken: [L(richtigNp, [F(form(x, "dat"), label), F(form(x, "nom"), `Das ist der Nominativ: ${label}`, nomFix)])], regel: `Wen oder was? ${richtigNp}: ${FALL_NAME.akk}.`, hilfe: FALL_REGEL }, ziel: richtigNp, fall: "akk" };
  return {
    satz: {
      titel,
      text: text.replace(GAP, `${GAP} ${x.n.wort}`),
      luecken: [L(begleiter(x.b, "m", "akk"), [F(begleiter(x.b, "m", "dat"), label), F(begleiter(x.b, "m", "nom"), `Das ist der Nominativ: ${label}`)], x.b)],
      regel: `Wen oder was? ${richtigNp}: ${FALL_NAME.akk}.`,
      hilfe: FALL_REGEL,
      tipp: `„${v.f[1]}“ verlangt ein Akkusativobjekt: Frag „Wen oder was?“. Wie heißt „${x.b}“ im Akkusativ vor „${x.n.wort}“?`,
    },
    ziel: richtigNp,
    fall: "akk",
    vorlage: { x, fall: "akk" },
  };
}
function fallLabel(f: Fall, gewaehlt: Fall, praep?: string): string {
  if (praep) return `„${praep}“ verlangt den ${FALL_KURZ[f]}`;
  if ((f === "dat" && gewaehlt === "akk") || (f === "akk" && gewaehlt === "dat")) return "Dativ und Akkusativ verwechselt: Frag „Wem?“ oder „Wen oder was?“";
  if ((f === "nom" && gewaehlt === "akk") || (f === "akk" && gewaehlt === "nom")) return "Nominativ und Akkusativ verwechselt: Frag mit dem ganzen Prädikat „Wer oder was?“ oder „Wen oder was?“";
  if (f === "gen" && gewaehlt === "dat") return "Genitiv und Dativ sehen bei weiblichen Nomen gleich aus: Frag „Wessen?“";
  return `${FALL_KURZ[gewaehlt]} statt ${FALL_KURZ[f]}: Frag „${FALL_FRAGE[f]}“`;
}
function faelleWahl(rng: Rng, st: Stufe): Wahl {
  const titel = (z: string) => `In welchem Fall steht „${z}“?`;
  const mit = (text: string, ziel: string, f: Fall, praep?: string, extra?: Partial<Record<Fall, string>>): Wahl => ({
    titel: titel(ziel),
    text,
    richtig: FALL_NAME[f],
    falsch: (["nom", "gen", "dat", "akk"] as Fall[]).filter((x) => x !== f).map((x) => F(FALL_NAME[x], extra?.[x] ?? fallLabel(f, x, praep))),
    regel: praep ? `„${praep}“ verlangt den ${FALL_NAME[f]}.` : `${FALL_FRAGE[f]} ${cap(ziel)}: ${FALL_NAME[f]}.`,
    hilfe: FALL_REGEL,
    tipp: praep ? `Frag mit der Präposition: „${praep} wem?“ oder „${praep} wen?“ Was klingt richtig?` : FALL_ERSATZPROBE,
  });
  const kind = art(rng, { satz: 4, satzglied: 3, falle: st >= 3 ? 2 : 0 });
  if (kind === "falle") {
    const t = rint(rng, 0, 2);
    const name = pick(rng, NAMEN);
    if (t === 0) {
      const p = pick(rng, PERSONEN.filter((n) => n.genus === "m"));
      const z = form(np("mein", p.wort), "dat");
      return mit(`${name} bekommt ein Geschenk von ${z}.`, z, "dat", undefined, { gen: "„von“ verlangt den Dativ: „von meinem …“ ist kein Genitiv" });
    }
    if (t === 1) {
      const z = pick(rng, ["des Regens", "der Hitze", "des Gewitters"]);
      // the Ersatzprobe would lead to the Dativ here („wegen mir“ is spoken language)
      return {
        ...mit(`Wegen ${z} bleibt ${name} zu Hause.`, z, "gen", undefined, { dat: "„wegen“ verlangt in der geschriebenen Sprache den Genitiv" }),
        tipp: "Bei „wegen“ hilft die Ersatzprobe nicht: „wegen mir“ ist Umgangssprache. Stell die Fragen Wem?, Wen oder was? und Wessen? an die Wortgruppe. Welche passt?",
      };
    }
    const p = pick(rng, PERSONEN.filter((n) => n.genus === "f"));
    const z = form(np("mein", p.wort), "gen");
    return mit(`Das ist das Fahrrad ${z}.`, z, "gen");
  }
  if (kind === "satzglied") {
    // a Satzglied of a pattern: subject (as Wortgruppe), Dativ- or Akkusativobjekt
    const b = bauen(rng, Math.min(st, 2) as Stufe, { vorn: "S", adv: rint(rng, 0, 1), passt: (r) => Boolean(r.dat || r.akk) });
    const ziele = gliederVon(b).filter((g) => g.np && g.fall);
    // a name has no Begleiter that shows the case: the subject becomes „mein Bruder“
    if (b.vorfeld.rolle === "S" && !b.r.subjekt && rng() < 0.4) {
      const s = pick(rng, ["mein Bruder", "meine Schwester", "die Lehrerin", "der Trainer", "meine Oma"].filter((x) => !gliederVon(b).some((g) => g.np?.n.wort === x.split(" ")[1])));
      const text = satzVon({ ...b, vorfeld: { text: s, rolle: "S" } });
      return mit(text, s, "nom");
    }
    if (!ziele.length) return faelleWahl(rng, st);
    const g = pick(rng, ziele);
    return mit(satzVon(b), g.text, g.fall!);
  }
  const f = fallSatz(rng, st);
  return mit(fuellen(f.satz, f.satz.luecken.map((l) => l.richtig[0])), f.ziel, f.fall, f.praep);
}
function faelleKurz(rng: Rng, st: Stufe): Umformung {
  const n = pick(rng, [...PERSONEN.filter((x) => !["Opa", "Cousin"].includes(x.wort)), ...DINGE.filter((x) => x.art === "ding" && x.wort.length > 2)]);
  const b = pick(rng, ["der", "ein", "mein"] as Begleiter[]);
  const x = np(b, n.wort);
  const ziele: Fall[] = st === 0 ? ["dat", "akk"] : ["gen", "dat", "akk"];
  const f = pick(rng, ziele.filter((z) => !(z === "akk" && n.genus !== "m" && st < 3)));
  return {
    auftrag: `Setze „${form(x, "nom")}“ in den ${FALL_NAME[f]}.`,
    vorlage: `${FALL_FRAGE[f]} ${GAP}`,
    richtig: formen(x, f),
    fehler: (["nom", "gen", "dat", "akk"] as Fall[])
      .filter((z) => z !== f)
      .flatMap((z) => formen(x, z))
      .map((w) => F(w, `Das ist der ${(["nom", "gen", "dat", "akk"] as Fall[]).filter((z) => formen(x, z).includes(w)).map((z) => FALL_NAME[z]).join(" oder der ")}`)),
    regel: `${FALL_NAME[f]}: ${formen(x, f).join(" oder ")}.`,
    hilfe: `Der ${FALL_NR[f]}. Fall antwortet auf „${FALL_FRAGE[f]}“. Wie heißt dann der Begleiter?`,
    tipp: `Zum Vergleich ein anderes Nomen im ${FALL_NAME[f]}: ${form(bspNp(x), "nom")} → ${FALL_FRAGE[f]} ${form(bspNp(x), f)}.`,
  };
}

// =====================================================================
// ---------- Zeitformen ----------
// =====================================================================
type Tempus = "praesens" | "praeteritum" | "perfekt" | "plusquamperfekt" | "futur1" | "futur2";
const TEMPUS_NAME: Record<Tempus, string> = {
  praesens: "Präsens (Gegenwart)",
  praeteritum: "Präteritum (Mitvergangenheit)",
  perfekt: "Perfekt (Vergangenheit)",
  plusquamperfekt: "Plusquamperfekt (Vorvergangenheit)",
  futur1: "Futur I (Zukunft)",
  futur2: "Futur II (Vorzukunft)",
};
const TEMPUS_KURZ: Record<Tempus, string> = { praesens: "Präsens", praeteritum: "Präteritum", perfekt: "Perfekt", plusquamperfekt: "Plusquamperfekt", futur1: "Futur I", futur2: "Futur II" };
const TEMPUS_BAU: Record<Tempus, string> = {
  praesens: "Präsens: eine Verbform ohne Hilfsverb (liest)",
  praeteritum: "Präteritum: eine Verbform ohne Hilfsverb (las)",
  perfekt: "Perfekt: „haben“ oder „sein“ im Präsens und das Partizip II (hat gelesen)",
  plusquamperfekt: "Plusquamperfekt: „hatte“ oder „war“ und das Partizip II (hatte gelesen)",
  futur1: "Futur I: „werden“ und die Grundform (wird lesen)",
  futur2: "Futur II: „werden“, das Partizip II und „haben“ oder „sein“ (wird gelesen haben)",
};
/** Time words that fit the tense; null = none. */
const SIGNAL: Record<Tempus, (string | null)[]> = {
  praesens: ["heute", "jetzt", null, null],
  praeteritum: ["gestern", "letzte Woche", "am Montag", "vor zwei Tagen"],
  perfekt: ["gestern", "letzte Woche", "am Montag", "vor zwei Tagen"],
  plusquamperfekt: [null],
  futur1: ["morgen", "nächste Woche", "bald", "am Wochenende"],
  futur2: ["bis Freitag", "bis morgen", "bis zum Abend"],
};
type ZSubjekt = { p: Person; text: string; pron: string };
function zSubjekt(rng: Rng, erlaubt: Person[], rest = ""): ZSubjekt {
  const p = pick(rng, erlaubt);
  if (p === 2) {
    const name = pick(rng, NAMEN);
    return { p, text: name, pron: maedchen(name) ? "sie" : "er" };
  }
  if (p === 5) return { p, text: pick(rng, schulisch(rest) ? SCHUL_GRUPPEN : GRUPPEN), pron: "sie" };
  return { p, text: ["ich", "du", "", "wir", "ihr"][p], pron: ["ich", "du", "", "wir", "ihr"][p] };
}
const hilfForm = (h: "haben" | "sein", p: Person, zeit: "praes" | "praet") => (h === "haben" ? HABEN : SEIN)[zeit][p];
/** The finite part and the end of the Prädikat; several when two Hilfsverben are right (ist oder hat gesessen). */
function verbformen(v: Verb, p: Person, t: Tempus): { finit: string[]; ende: string[] } {
  switch (t) {
    case "praesens":
      return { finit: [praesens(v, p)], ende: [v.teil ?? ""] };
    case "praeteritum":
      return { finit: [praeteritum(v, p)], ende: [v.teil ?? ""] };
    case "perfekt":
      return { finit: hilfsverben(v).map((h) => hilfForm(h, p, "praes")), ende: [v.p2] };
    case "plusquamperfekt":
      return { finit: hilfsverben(v).map((h) => hilfForm(h, p, "praet")), ende: [v.p2] };
    case "futur1":
      return { finit: [WERDEN.praes[p]], ende: [v.inf] };
    case "futur2":
      return { finit: [WERDEN.praes[p]], ende: hilfsverben(v).map((h) => `${v.p2} ${h}`) };
  }
}
/** The right pairs of finite verb and end: „bin … gesessen“, „habe … gesessen“; „werde … gesessen sein“, „werde … gesessen haben“. */
const formPaare = (f: { finit: string[]; ende: string[] }): [string, string][] =>
  f.finit.length >= f.ende.length ? f.finit.map((fi, i) => [fi, f.ende[Math.min(i, f.ende.length - 1)]]) : f.ende.map((en, i) => [f.finit[Math.min(i, f.finit.length - 1)], en]);
/** A sentence in a tense: Vorfeld (time word or subject), the finite verb, the Mittelfeld, the end of the Prädikat. */
type ZBau = { v: Verb; s: ZSubjekt; t: Tempus; vorn: string; mittel: string[]; rest: string; signal: string | null; vor?: string };
const PERSONEN_PRAET: Person[] = [0, 2, 3, 5];
function zBauen(rng: Rng, st: Stufe, t: Tempus, o: { verb?: (v: Verb) => boolean; personen?: Person[]; signal?: boolean } = {}): ZBau {
  const personen = o.personen ?? (t === "praeteritum" || t === "plusquamperfekt" ? PERSONEN_PRAET : st === 0 ? [0, 2, 3] : [0, 1, 2, 3, 4, 5]);
  const v = pick(rng, VERBEN.filter((x) => x.stufe <= Math.min(st, 2) && (o.verb?.(x) ?? true)));
  const rest = pick(rng, v.rest);
  const s = zSubjekt(rng, personen, rest);
  const signal = o.signal === false ? null : pick(rng, SIGNAL[t]);
  if (t === "plusquamperfekt") {
    // „Als Mia kam, hatte Lena das Buch schon gelesen.“
    const andere = pick(rng, NAMEN.filter((n) => n !== s.text));
    const als = pick(rng, [`Als ${andere} kam`, `Als ${andere} anrief`, ...(rest === "nach Hause" ? [] : [`Als ${andere} nach Hause kam`])]);
    if (o.signal !== false && rng() < 0.6) return { v, s, t, vorn: `${als},`, mittel: [s.text, "schon", rest], rest, signal: null, vor: als };
    return { v, s, t, vorn: s.text, mittel: ["schon", rest], rest, signal: null };
  }
  if (signal && rng() < 0.6) return { v, s, t, vorn: signal, mittel: [s.text, rest], rest, signal };
  return { v, s, t, vorn: s.text, mittel: signal ? [signal, rest] : [rest], rest, signal };
}
const zText = (z: ZBau, finit: string, ende: string) => `${cap([z.vorn, finit, ...z.mittel, ende].filter(Boolean).join(" "))}.`;
const zSatz = (z: ZBau) => {
  const f = verbformen(z.v, z.s.p, z.t);
  return zText(z, f.finit[0], f.ende[0]);
};
const akkMask = (rest: string) => /^(den|einen|meinen) /.test(rest);

/** The typical errors of the finite part and the end of the Prädikat, by tense. */
function zeitFehler(z: ZBau): { finit: Fehler[]; ende: Fehler[] } {
  const { v, s, t } = z;
  const p = s.p;
  const richtig = verbformen(v, p, t);
  const andere = ([0, 1, 2, 3, 4, 5] as Person[]).filter((x) => x !== p);
  const wer = `„${s.text}“`;
  const personFehler = (formen: string[], was: string) =>
    [...new Set(andere.map((x) => formen[x]))].filter((x) => x !== formen[p]).map((x) => F(x, `${was} passt nicht zu ${wer}: ${formen[p]}`));
  const finit: Fehler[] = [];
  const ende: Fehler[] = [];
  const auxRegel = (h: "haben" | "sein") => (v.bewegung && h === "sein" ? `„${v.inf}“ ist ein Verb der Bewegung: ${h === "sein" ? "„sein“" : "„haben“"}` : `„${v.inf}“ bildet das ${TEMPUS_KURZ[t]} mit „${h}“`);
  switch (t) {
    case "praesens": {
      // Stammvokal: „lest“ statt „liest“ (also the ihr-form): first, so it keeps this label
      // a verb changes its vowel when „er liest“ and „ihr lest“ differ; the wrong form keeps the vowel of the Grundform
      if ((p === 1 || p === 2) && v.praes[2] !== v.praes[4]) {
        const ohneWechsel = p === 2 ? v.praes[4] : v.praes[3].replace(/en$/, "st").replace(/sst$/, "st");
        finit.push(F(ohneWechsel, `„${v.inf}“ ändert bei du und er, sie, es den Selbstlaut: ${v.praes[p]}`));
      }
      finit.push(...personFehler(v.praes, "Die Form"));
      finit.push(F(praeteritum(v, p), `Das ist das Präteritum, gefragt ist das Präsens: ${v.praes[p]}`, { fix: false }));
      break;
    }
    case "praeteritum": {
      if (v.falschPraet) finit.push(F(p === 3 || p === 5 ? `${v.falschPraet}n` : v.falschPraet, `„${v.inf}“ ist ein starkes oder unregelmäßiges Verb: ${praeteritum(v, p)}`));
      finit.push(...[...new Set(PERSONEN_PRAET.filter((x) => x !== p).map((x) => praeteritum(v, x)))].filter((x) => x !== praeteritum(v, p)).map((x) => F(x, `Die Form passt nicht zu ${wer}: ${praeteritum(v, p)}`)));
      finit.push(F(praesens(v, p), `Das ist das Präsens, gefragt ist das Präteritum: ${praeteritum(v, p)}`, { fix: false }));
      break;
    }
    case "perfekt":
    case "plusquamperfekt": {
      const zeit = t === "perfekt" ? "praes" : "praet";
      if (v.hilf !== "beide") {
        const falsch = v.hilf === "haben" ? "sein" : "haben";
        // „Lena ist den Brief geschrieben“: only with an object (without one „ist … gelesen“ could be a Zustandspassiv)
        const sicher = falsch === "haben" || akkMask(z.rest);
        finit.push(F(hilfForm(falsch, p, zeit), auxRegel(v.hilf), sicher ? {} : { fix: false }));
      }
      for (const h of hilfsverben(v)) finit.push(...personFehler((h === "haben" ? HABEN : SEIN)[zeit], "Das Hilfsverb"));
      if (t === "perfekt") for (const h of hilfsverben(v)) finit.push(F(hilfForm(h, p, "praet"), `Mit „${hilfForm(h, p, "praet")}“ ist es das Plusquamperfekt, gefragt ist das Perfekt`, { fix: false }));
      else for (const h of hilfsverben(v)) finit.push(F(hilfForm(h, p, "praes"), `Mit „${hilfForm(h, p, "praes")}“ ist es das Perfekt. Im Plusquamperfekt steht „hatte“ oder „war“`, { fix: false }));
      if (v.falschP2) ende.push(F(v.falschP2, `Das Partizip II von „${v.inf}“ heißt „${v.p2}“`));
      ende.push(F(v.inf, `Hier steht das Partizip II: ${v.p2}`, { fix: false }));
      break;
    }
    case "futur1": {
      finit.push(...personFehler(WERDEN.praes, "Die Form von „werden“"));
      // „Lena wird den Brief geschrieben“: wrong in every reading only with a masculine object (otherwise it could be a Passiv)
      ende.push(F(v.p2, `Nach „werden“ steht im Futur I die Grundform, nicht das Partizip: ${v.inf}`, akkMask(z.rest) ? {} : { fix: false }));
      const finitForm = [praesens(v, p), v.teil].filter(Boolean).join(" ");
      if (!v.teil) ende.push(F(finitForm, `Nach „werden“ steht die Grundform: ${v.inf}`));
      break;
    }
    case "futur2": {
      finit.push(...personFehler(WERDEN.praes, "Die Form von „werden“"));
      ende.push(F(v.p2, "Im Futur II fehlt „haben“ oder „sein“", akkMask(z.rest) ? {} : { fix: false }));
      if (v.hilf !== "beide") ende.push(F(`${v.p2} ${v.hilf === "haben" ? "sein" : "haben"}`, `„${v.inf}“ bildet das Futur II mit „${v.hilf}“: ${v.p2} ${v.hilf}`, v.hilf === "sein" || akkMask(z.rest) ? {} : { fix: false }));
      ende.push(F(`${v.inf} haben`, `Im Futur II steht das Partizip II: ${v.p2} ${hilfsverben(v)[0]}`, { fix: false }));
      break;
    }
  }
  return { finit: sauber(richtig.finit, finit), ende: sauber(richtig.ende, ende) };
}
const ZEIT_HILFE = "Welche Zeitform ist gefragt? Brauchst du ein Hilfsverb (haben, sein, werden)?";
/** The forms of „spielen“ for the hint when the task's verb is „lesen“, the example of TEMPUS_BAU. */
const SPIELEN: Record<Tempus, string> = { praesens: "spielt", praeteritum: "spielte", perfekt: "hat gespielt", plusquamperfekt: "hatte gespielt", futur1: "wird spielen", futur2: "wird gespielt haben" };
/** How the tense is built, shown on another verb than the task's. */
const tempusTipp = (t: Tempus, v: Verb) => `${v.inf === "lesen" ? TEMPUS_BAU[t].replace(/\(.*\)$/, `(${SPIELEN[t]})`) : TEMPUS_BAU[t]}.`;
const TEMPUS_TIPP =
  "Präsens und Präteritum haben kein Hilfsverb. Perfekt: „haben“ oder „sein“ im Präsens und das Partizip II. Plusquamperfekt: „hatte“ oder „war“ und das Partizip II. Futur I: „werden“ und die Grundform. Futur II: „werden“, das Partizip II und „haben“ oder „sein“.";
/** A gap text: the finite verb and (if there is one) the end of the Prädikat are gaps; the verb and the tense in brackets. */
function zeitLuecke(z: ZBau, titel = "Setze das Verb in der angegebenen Zeitform ein."): Satz {
  const f = verbformen(z.v, z.s.p, z.t);
  const fe = zeitFehler(z);
  const zweiteilig = Boolean(f.ende[0]);
  return {
    titel,
    text: zText(z, GAP, zweiteilig ? GAP : ""),
    luecken: [L(f.finit, fe.finit), ...(zweiteilig ? [L(f.ende, fe.ende)] : [])],
    cueEnde: `${z.v.inf}, ${TEMPUS_KURZ[z.t]}`,
    regel: `${TEMPUS_BAU[z.t]}. ${zSatz(z)}`,
    hilfe: ZEIT_HILFE,
    tipp: tempusTipp(z.t, z.v),
  };
}
/** Recognise the tense: the sentence and four of the six tenses. */
function zeitErkennen(rng: Rng, st: Stufe, nur?: Tempus[]): Wahl {
  const moeglich: Tempus[] = nur ?? (st <= 1 ? ["praesens", "praeteritum", "perfekt", "futur1"] : st === 2 ? ["praesens", "praeteritum", "perfekt", "plusquamperfekt", "futur1"] : ["praesens", "praeteritum", "perfekt", "plusquamperfekt", "futur1", "futur2"]);
  const t = pick(rng, moeglich);
  let text: string;
  let falle: string | null = null;
  let tipp = TEMPUS_TIPP;
  // traps from level 3: „werden“ with a Partizip (Passiv) or as a Vollverb, a future time with the Präsens
  if (!nur && t === "praesens" && st >= 3 && rng() < 0.6) {
    const k = rint(rng, 0, 2);
    if (k === 0) {
      const p = pick(rng, PASSIV_RAHMEN);
      const pat = pick(rng, p.patienten);
      text = `${cap(pat.nom)} ${pat.pl ? "werden" : "wird"} ${p.taeter.von[0]} ${p.p2}.`;
      falle = "Nicht jede Form mit „werden“ ist Futur: Hier steht „werden“ mit dem Partizip II (Passiv), die Zeitform ist Präsens";
      tipp = "Nicht jede Form mit „werden“ ist Futur. Steht „werden“ hier mit der Grundform oder mit dem Partizip II?";
    } else if (k === 1) {
      text = pick(rng, ["Mein Bruder wird bald zwölf.", "Im Herbst wird es früh dunkel.", `${pick(rng, MAEDCHEN)} wird Tierärztin.`]);
      falle = "„werden“ ist hier ein Vollverb ohne Grundform: Präsens";
      tipp = "„werden“ kann auch ein Vollverb sein (groß werden, zwölf werden). Steht eine Grundform dabei?";
    } else {
      const z = zBauen(rng, st, "praesens", { verb: (v) => Boolean(v.bewegung), signal: false });
      text = zSatz({ ...z, vorn: "morgen", mittel: [z.s.text, z.rest] });
      falle = "Die Zeitform erkennst du an der Verbform, nicht an „morgen“: Das ist das Präsens";
      tipp = "Die Zeitform erkennst du an der Verbform, nicht an einem Zeitwort wie „morgen“.";
    }
  } else text = zSatz(zBauen(rng, st, t));
  const verwechslung: Partial<Record<Tempus, Partial<Record<Tempus, string>>>> = {
    perfekt: { praeteritum: "Perfekt und Präteritum verwechselt: Das Perfekt hat zwei Teile (hat … gelesen)", plusquamperfekt: "Perfekt und Plusquamperfekt verwechselt: Das Hilfsverb steht im Präsens (hat, ist)" },
    praeteritum: { perfekt: "Präteritum und Perfekt verwechselt: Das Präteritum hat kein Hilfsverb", praesens: "Präteritum und Präsens verwechselt: Das ist eine Vergangenheitsform" },
    plusquamperfekt: { perfekt: "Plusquamperfekt und Perfekt verwechselt: Das Hilfsverb steht im Präteritum (hatte, war)", praeteritum: "Das Plusquamperfekt hat zwei Teile: hatte oder war und das Partizip II" },
    futur1: { praesens: "„werden“ und die Grundform: Das ist das Futur I", futur2: "Im Futur I steht nur die Grundform, kein „haben“ oder „sein“" },
    futur2: { futur1: "Das Futur II hat drei Teile: werden, das Partizip II und haben oder sein", perfekt: "Mit „werden“ ist es eine Zukunftsform: Futur II" },
    praesens: { futur1: falle ?? "„werden“ fehlt: Das ist das Präsens", praeteritum: "Das ist eine Gegenwartsform: Präsens" },
  };
  const andere = (Object.keys(TEMPUS_NAME) as Tempus[]).filter((x) => x !== t && (moeglich.includes(x) || x === "futur1"));
  // the typical confusions first, then others
  const typisch = Object.keys(verwechslung[t] ?? {}) as Tempus[];
  const wahl = [...typisch.filter((x) => andere.includes(x)), ...shuffle(rng, andere.filter((x) => !typisch.includes(x)))].slice(0, 3);
  return {
    titel: "In welcher Zeitform steht der Satz?",
    text,
    richtig: TEMPUS_NAME[t],
    falsch: wahl.map((x) => F(TEMPUS_NAME[x], verwechslung[t]?.[x] ?? `${TEMPUS_KURZ[x]} statt ${TEMPUS_KURZ[t]}. ${TEMPUS_BAU[t]}`)),
    regel: falle ? `${falle}.` : `${TEMPUS_BAU[t]}.`,
    hilfe: "Gibt es ein Hilfsverb (haben, sein, werden)? In welcher Form steht es? Wie viele Teile hat das Prädikat?",
    tipp,
  };
}
/** Rewrite a sentence in another tense; every order of the Satzglieder counts. */
function zeitUmformen(rng: Rng, st: Stufe, von: Tempus, nach: Tempus): Umformung {
  // a time word that fits both tenses, or none
  const passt = SIGNAL[von].filter((x) => x && SIGNAL[nach].includes(x));
  const z0 = zBauen(rng, st, von, { signal: false, personen: von === "praeteritum" || nach === "praeteritum" || nach === "plusquamperfekt" ? PERSONEN_PRAET : undefined });
  const signal = passt.length && rng() < 0.6 ? pick(rng, passt as string[]) : null;
  const z: ZBau = signal && rng() < 0.5 ? { ...z0, vorn: signal, mittel: [z0.s.text, z0.rest], signal } : { ...z0, vorn: z0.s.text, mittel: [...(signal ? [signal] : []), z0.rest], signal };
  const ordnung = [z.vorn, ...z.mittel];
  const vonF = verbformen(z.v, z.s.p, von);
  const nachF = verbformen(z.v, z.s.p, nach);
  const vorlage = zText(z, vonF.finit[0], vonF.ende[0]);
  // the subject before the rest („Gestern hat die Zeitung Lena gelesen“ reads two ways); „Die Zeitung hat Lena …“ only with ich, du, wir, ihr
  const pronomen = z.s.p !== 2 && z.s.p !== 5;
  const eindeutigeStellung = (v: string, m: string[]) => (v !== z.rest || pronomen || !/^(die|das|ein|eine) /.test(z.rest)) && (!m.includes(z.s.text) || !m.includes(z.rest) || m.indexOf(z.s.text) < m.indexOf(z.rest));
  const richtig = [...new Set(formPaare(nachF).flatMap(([fi, en]) => stellungen(ordnung, fi, en, eindeutigeStellung)))];
  const fe = zeitFehler({ ...z, t: nach });
  const fehler: Fehler[] = [
    ...fe.finit.map((f) => F(zText(z, f.answer, nachF.ende[0]), f.label)),
    ...fe.ende.map((f) => F(zText(z, nachF.finit[0], f.answer), f.label)),
    ...(["praesens", "praeteritum", "perfekt", "futur1"] as Tempus[])
      .filter((x) => x !== nach && x !== von && !(x === "praeteritum" && ![0, 2, 3, 5].includes(z.s.p)))
      .map((x) => {
        const f = verbformen(z.v, z.s.p, x);
        return F(zText(z, f.finit[0], f.ende[0]), `Das ist das ${TEMPUS_KURZ[x]}, gefragt ist das ${TEMPUS_KURZ[nach]}`);
      }),
    F(vorlage, `Der Satz steht noch im ${TEMPUS_KURZ[von]}`),
  ];
  return {
    auftrag: `Setze den Satz ins ${TEMPUS_KURZ[nach]}.`,
    vorlage,
    richtig,
    fehler,
    regel: `${TEMPUS_BAU[nach]}. ${richtig[0]}`,
    hilfe: ZEIT_HILFE,
    tipp: tempusTipp(nach, z.v),
  };
}
function zeitenLuecke(rng: Rng, st: Stufe): Satz {
  const t = pick(rng, (st <= 1 ? ["praesens", "praeteritum", "perfekt", "futur1"] : st === 2 ? ["praeteritum", "perfekt", "plusquamperfekt", "futur1"] : ["praeteritum", "perfekt", "plusquamperfekt", "futur1", "futur2"]) as Tempus[]);
  return zeitLuecke(zBauen(rng, st, t));
}
function zeitenKurz(rng: Rng, st: Stufe): Umformung {
  const paare: [Tempus, Tempus][] =
    st <= 1
      ? [["praesens", "perfekt"], ["praesens", "praeteritum"], ["praesens", "futur1"]]
      : [["praesens", "perfekt"], ["praeteritum", "perfekt"], ["perfekt", "praeteritum"], ["praesens", "futur1"], ["praeteritum", "plusquamperfekt"], ...(st >= 3 ? ([["futur1", "futur2"]] as [Tempus, Tempus][]) : [])];
  const [von, nach] = pick(rng, paare);
  return zeitUmformen(rng, st, von, nach);
}
/** "Fehler korrigieren" for the tenses: all sentences in one tense, each with one error of forming it. */
function zeitFixSatz(t: Tempus) {
  return (rng: Rng, st: Stufe): Satz => {
    for (let k = 0; k < 500; k++) {
      const z = zBauen(rng, st, t);
      const s = zeitLuecke(z);
      if (s.luecken.some((l) => l.fehler.some((f) => f.fix !== false))) return s;
    }
    throw new Error("Kein passender Satz gefunden");
  };
}

// ---------- Futur ----------
function futurTempus(rng: Rng, st: Stufe): Tempus {
  return st <= 1 ? "futur1" : st === 2 ? (rng() < 0.7 ? "futur1" : "futur2") : rng() < 0.5 ? "futur1" : "futur2";
}
function futurLuecke(rng: Rng, st: Stufe): Satz {
  return zeitLuecke(zBauen(rng, st, futurTempus(rng, st)), "Setze das Verb im Futur ein.");
}
function futurWahl(rng: Rng, st: Stufe): Wahl {
  if (st >= 2 && rng() < 0.35) return zeitErkennen(rng, st, ["futur1", "futur2", "praesens", "perfekt"]);
  const s = futurLuecke(rng, st);
  return wahlAusSatz(s, "Welche Form passt in die Lücken?");
}
function futurKurz(rng: Rng, st: Stufe): Umformung {
  const t = futurTempus(rng, st);
  return zeitUmformen(rng, st, t === "futur1" ? "praesens" : "futur1", t);
}

// ---------- Plusquamperfekt ----------
/** Main clauses in the Präteritum after „nachdem“: [Einzahl, Mehrzahl, Rest]. */
const DANACH: [string, string, string, string][] = [
  ["ging", "gingen", "in den Park", "gehen"],
  ["aß", "aßen", "eine Jause", "essen"],
  ["spielte", "spielten", "im Garten", "spielen"],
  ["schlief", "schliefen", "sofort ein", "schlafen"],
  ["las", "lasen", "ein Buch", "lesen"],
];
function nachdemSatz(rng: Rng, st: Stufe): Satz {
  const v = pick(rng, VERBEN.filter((x) => x.stufe <= Math.min(st, 2) && x.hilf !== "beide"));
  const rest = pick(rng, v.rest);
  const s = zSubjekt(rng, PERSONEN_PRAET, rest);
  const [sg, pl, danachRest] = pick(rng, DANACH.filter((d) => d[3] !== v.inf));
  const hilf = hilfForm(v.hilf as "haben" | "sein", s.p, "praet");
  const hilfPraes = hilfForm(v.hilf as "haben" | "sein", s.p, "praes");
  const andereHilf = hilfForm(v.hilf === "haben" ? "sein" : "haben", s.p, "praet");
  const haupt = `${s.p === 3 || s.p === 5 ? pl : sg} ${s.pron} ${danachRest}`;
  const sicher = v.hilf === "sein" || akkMask(rest);
  return {
    titel: "Setze das Verb im Plusquamperfekt ein.",
    text: `Nachdem ${s.text} ${rest} ${GAP}, ${haupt}.`,
    luecken: [
      L(`${v.p2} ${hilf}`, [
        F(`${hilf} ${v.p2}`, "Im Gliedsatz mit „nachdem“ steht das gebeugte Verb am Ende"),
        F(`${v.p2} ${hilfPraes}`, `Nach „nachdem“ steht das Plusquamperfekt, wenn der Hauptsatz im Präteritum steht: ${v.p2} ${hilf}`, { fix: false }),
        F(`${v.p2} ${andereHilf}`, `„${v.inf}“ bildet das Plusquamperfekt mit „${v.hilf}“: ${v.p2} ${hilf}`, sicher ? {} : { fix: false }),
        ...(v.falschP2 ? [F(`${v.falschP2} ${hilf}`, `Das Partizip II von „${v.inf}“ heißt „${v.p2}“`)] : []),
      ]),
    ],
    cueEnde: `${v.inf}, Plusquamperfekt`,
    regel: `Was zuerst geschah, steht im Plusquamperfekt: ${v.p2} ${hilf}. Danach im Präteritum: ${s.p === 3 || s.p === 5 ? pl : sg}.`,
    hilfe: "Was geschah zuerst? Dafür brauchst du „hatte“ oder „war“ und das Partizip II.",
    tipp: "Im Gliedsatz mit „nachdem“ steht das gebeugte Verb am Ende: zuerst das Partizip II, dann „hatte“ oder „war“ in der passenden Form.",
  };
}
function plusquamperfektLuecke(rng: Rng, st: Stufe): Satz {
  if (st >= 1 && rng() < 0.45) return nachdemSatz(rng, st);
  return zeitLuecke(zBauen(rng, st, "plusquamperfekt", { verb: (v) => v.hilf !== "beide" || st >= 2 }), "Setze das Verb im Plusquamperfekt ein.");
}
function plusquamperfektWahl(rng: Rng, st: Stufe): Wahl {
  if (st >= 2 && rng() < 0.3) return zeitErkennen(rng, st, ["plusquamperfekt", "perfekt", "praeteritum", "futur2"]);
  return wahlAusSatz(plusquamperfektLuecke(rng, st), "Welche Form passt?");
}
function plusquamperfektKurz(rng: Rng, st: Stufe): Umformung {
  return zeitUmformen(rng, st, st >= 2 && rng() < 0.4 ? "perfekt" : "praeteritum", "plusquamperfekt");
}

// =====================================================================
// ---------- Aktiv und Passiv ----------
// =====================================================================
/**
 * A pattern for the Vorgangspassiv: who does it (as Nominativ and with „von“; „durch“ only for causes
 * and institutions, where both are right), the Aktiv forms (3. Person), the Partizip II and what is done.
 */
type Patient = { nom: string; akk: string; pl?: boolean };
type PassivRahmen = {
  taeter: { nom: string; akk: string; von: string[]; durch?: string[]; pl?: boolean };
  aktiv: { praes: string; praet: string; teil?: string };
  inf: string;
  p2: string;
  patienten: Patient[];
};
const P = (nom: string, akk = nom, pl = false): Patient => ({ nom, akk, ...(pl ? { pl } : {}) });
const PASSIV_RAHMEN: PassivRahmen[] = [
  { taeter: { nom: "der Koch", akk: "den Koch", von: ["vom Koch", "von dem Koch"] }, aktiv: { praes: "bereitet", praet: "bereitete", teil: "zu" }, inf: "zubereiten", p2: "zubereitet", patienten: [P("die Suppe"), P("der Salat", "den Salat"), P("das Essen")] },
  { taeter: { nom: "der Opa", akk: "den Opa", von: ["vom Opa", "von dem Opa"] }, aktiv: { praes: "repariert", praet: "reparierte" }, inf: "reparieren", p2: "repariert", patienten: [P("das Fahrrad"), P("der Stuhl", "den Stuhl"), P("die Lampe")] },
  { taeter: { nom: "die Lehrerin", akk: "die Lehrerin", von: ["von der Lehrerin"] }, aktiv: { praes: "korrigiert", praet: "korrigierte" }, inf: "korrigieren", p2: "korrigiert", patienten: [P("die Schularbeit"), P("der Test", "den Test"), P("die Hefte", "die Hefte", true)] },
  { taeter: { nom: "die Oma", akk: "die Oma", von: ["von der Oma"] }, aktiv: { praes: "bäckt", praet: "backte" }, inf: "backen", p2: "gebacken", patienten: [P("der Kuchen", "den Kuchen"), P("die Kekse", "die Kekse", true)] },
  { taeter: { nom: "die Gärtnerin", akk: "die Gärtnerin", von: ["von der Gärtnerin"] }, aktiv: { praes: "gießt", praet: "goss" }, inf: "gießen", p2: "gegossen", patienten: [P("die Blumen", "die Blumen", true), P("der Rasen", "den Rasen"), P("das Beet")] },
  { taeter: { nom: "die Kinder", akk: "die Kinder", von: ["von den Kindern"], pl: true }, aktiv: { praes: "schmücken", praet: "schmückten" }, inf: "schmücken", p2: "geschmückt", patienten: [P("der Christbaum", "den Christbaum"), P("das Klassenzimmer")] },
  { taeter: { nom: "der Schulwart", akk: "den Schulwart", von: ["vom Schulwart", "von dem Schulwart"] }, aktiv: { praes: "sperrt", praet: "sperrte", teil: "auf" }, inf: "aufsperren", p2: "aufgesperrt", patienten: [P("das Tor"), P("der Turnsaal", "den Turnsaal"), P("die Tür")] },
  { taeter: { nom: "der Bauer", akk: "den Bauern", von: ["vom Bauern", "von dem Bauern"] }, aktiv: { praes: "erntet", praet: "erntete" }, inf: "ernten", p2: "geerntet", patienten: [P("die Paradeiser", "die Paradeiser", true), P("die Marillen", "die Marillen", true), P("der Salat", "den Salat")] },
  { taeter: { nom: "mein Bruder", akk: "meinen Bruder", von: ["von meinem Bruder"] }, aktiv: { praes: "streicht", praet: "strich" }, inf: "streichen", p2: "gestrichen", patienten: [P("der Zaun", "den Zaun"), P("die Wand")] },
  { taeter: { nom: "die Feuerwehr", akk: "die Feuerwehr", von: ["von der Feuerwehr"], durch: ["durch die Feuerwehr"] }, aktiv: { praes: "löscht", praet: "löschte" }, inf: "löschen", p2: "gelöscht", patienten: [P("das Feuer"), P("der Brand", "den Brand")] },
  { taeter: { nom: "die Polizei", akk: "die Polizei", von: ["von der Polizei"], durch: ["durch die Polizei"] }, aktiv: { praes: "fängt", praet: "fing" }, inf: "fangen", p2: "gefangen", patienten: [P("der Dieb", "den Dieb"), P("die Diebe", "die Diebe", true)] },
  { taeter: { nom: "der Sturm", akk: "den Sturm", von: ["vom Sturm", "von dem Sturm"], durch: ["durch den Sturm"] }, aktiv: { praes: "beschädigt", praet: "beschädigte" }, inf: "beschädigen", p2: "beschädigt", patienten: [P("das Dach"), P("der Zaun", "den Zaun")] },
  { taeter: { nom: "der Hagel", akk: "den Hagel", von: ["vom Hagel", "von dem Hagel"], durch: ["durch den Hagel"] }, aktiv: { praes: "zerstört", praet: "zerstörte" }, inf: "zerstören", p2: "zerstört", patienten: [P("die Ernte"), P("die Paradeiser", "die Paradeiser", true)] },
];
type PTempus = "praesens" | "praeteritum" | "perfekt";
const PASSIV_HILFE = "Im Passiv steht im Vordergrund, was geschieht. Du brauchst „werden“ und das Partizip II.";
const PASSIV_BAU: Record<PTempus, string> = {
  praesens: "Passiv Präsens: wird oder werden und das Partizip II",
  praeteritum: "Passiv Präteritum: wurde oder wurden und das Partizip II",
  perfekt: "Passiv Perfekt: ist oder sind, das Partizip II und „worden“",
};
function passivFormen(p: PassivRahmen, pat: Patient, t: PTempus): { finit: string; ende: string } {
  const pl = Boolean(pat.pl);
  if (t === "praesens") return { finit: pl ? "werden" : "wird", ende: p.p2 };
  if (t === "praeteritum") return { finit: pl ? "wurden" : "wurde", ende: p.p2 };
  return { finit: pl ? "sind" : "ist", ende: `${p.p2} worden` };
}
function passivFehler(p: PassivRahmen, pat: Patient, t: PTempus): { finit: Fehler[]; ende: Fehler[] } {
  const pl = Boolean(pat.pl);
  const zahl = pl ? `Das Subjekt „${pat.nom}“ steht in der Mehrzahl` : `Das Subjekt „${pat.nom}“ steht in der Einzahl`;
  const finit: Fehler[] = [];
  const ende: Fehler[] = [];
  if (t === "praesens") {
    finit.push(F(pl ? "wird" : "werden", `${zahl}: ${pl ? "werden" : "wird"}`), F(pl ? "wurden" : "wurde", "Das ist das Präteritum, gefragt ist das Präsens", { fix: false }));
    ende.push(F(p.inf, `Im Passiv steht das Partizip II: ${p.p2}`, { fix: false }));
  } else if (t === "praeteritum") {
    finit.push(F(pl ? "wurde" : "wurden", `${zahl}: ${pl ? "wurden" : "wurde"}`), F(pl ? "werden" : "wird", "Das ist das Präsens, gefragt ist das Präteritum", { fix: false }));
    ende.push(F(p.inf, `Im Passiv steht das Partizip II: ${p.p2}`, { fix: false }));
  } else {
    finit.push(F(pl ? "haben" : "hat", "Das Passiv Perfekt bildet man mit „sein“: ist … worden"), F(pl ? "ist" : "sind", `${zahl}: ${pl ? "sind" : "ist"}`), F(pl ? "werden" : "wird", "Das ist das Präsens, gefragt ist das Perfekt", { fix: false }));
    ende.push(F(`${p.p2} geworden`, "Im Passiv Perfekt steht „worden“, nicht „geworden“"), F(p.p2, "Im Passiv Perfekt fehlt „worden“", { fix: false }));
  }
  return { finit, ende };
}
function passivBau(rng: Rng, st: Stufe): { p: PassivRahmen; pat: Patient; t: PTempus; taeter: boolean; zeit: string | null } {
  const p = pick(rng, PASSIV_RAHMEN);
  const pat = pick(rng, p.patienten.filter((x) => st >= 1 || !x.pl));
  const t = pick(rng, (st === 0 ? ["praesens"] : st === 1 ? ["praesens", "praeteritum"] : ["praesens", "praeteritum", "perfekt"]) as PTempus[]);
  const zeit = st >= 2 && rng() < 0.3 ? pick(rng, t === "praesens" ? ["heute", "gerade"] : ["gestern", "am Montag"]) : null;
  return { p, pat, t, taeter: rng() < 0.6, zeit };
}
function passivLuecke(rng: Rng, st: Stufe): Satz {
  const { p, pat, t, taeter, zeit } = passivBau(rng, st);
  const f = passivFormen(p, pat, t);
  const fe = passivFehler(p, pat, t);
  const vorn = zeit ? [zeit, GAP, pat.nom] : [pat.nom, GAP];
  const teile = [...vorn, ...(taeter ? [p.taeter.von[0]] : []), GAP];
  const fertig = (fi: string, en: string) => `${cap([...(zeit ? [zeit, fi, pat.nom] : [pat.nom, fi]), ...(taeter ? [p.taeter.von[0]] : []), en].join(" "))}.`;
  return {
    titel: "Setze das Verb im Passiv ein.",
    text: `${cap(teile.join(" "))}.`,
    luecken: [L(f.finit, fe.finit), L(f.ende, fe.ende)],
    cueEnde: `${p.inf}, ${TEMPUS_KURZ[t]}`,
    regel: `${PASSIV_BAU[t]}. ${fertig(f.finit, f.ende)}`,
    hilfe: PASSIV_HILFE,
    tipp: `${PASSIV_BAU[t]}.`,
  };
}
function aktivSatz(p: PassivRahmen, pat: Patient, t: PTempus, zeit: string | null): string {
  const finit = t === "praesens" ? p.aktiv.praes : t === "praeteritum" ? p.aktiv.praet : p.taeter.pl ? "haben" : "hat";
  const ende = t === "perfekt" ? p.p2 : (p.aktiv.teil ?? "");
  return `${cap([...(zeit ? [zeit, finit, p.taeter.nom] : [p.taeter.nom, finit]), pat.akk, ende].filter(Boolean).join(" "))}.`;
}
function passivWahl(rng: Rng, st: Stufe): Wahl {
  if (st >= 1 && rng() < 0.35) {
    // the same in the Passiv: not „werden“ with the Grundform (Futur I), not the Perfekt, not another tense
    const p = pick(rng, PASSIV_RAHMEN.filter((x) => !x.taeter.durch));
    const pat = pick(rng, p.patienten);
    const t = pick(rng, ["praesens", "praeteritum"] as PTempus[]);
    const f = passivFormen(p, pat, t);
    const richtig = `${cap(pat.nom)} ${f.finit} ${p.taeter.von[0]} ${f.ende}.`;
    const andere = passivFormen(p, pat, t === "praesens" ? "praeteritum" : "praesens");
    return {
      titel: "Welcher Satz sagt dasselbe im Passiv? Die Zeitform bleibt gleich.",
      text: aktivSatz(p, pat, t, null),
      richtig,
      falsch: [
        F(`${cap(p.taeter.nom)} ${p.taeter.pl ? "werden" : "wird"} ${pat.akk} ${p.inf}.`, "„werden“ mit der Grundform ist das Futur I im Aktiv"),
        F(`${cap(p.taeter.nom)} ${p.taeter.pl ? "haben" : "hat"} ${pat.akk} ${p.p2}.`, "„haben“ mit dem Partizip II ist das Perfekt im Aktiv"),
        F(`${cap(pat.nom)} ${andere.finit} ${p.taeter.von[0]} ${andere.ende}.`, `Beim Umformen bleibt die Zeitform gleich: ${t === "praesens" ? "Präsens" : "Präteritum"}`),
      ],
      regel: `${richtig} Passiv: „werden“ und das Partizip II.`,
      hilfe: PASSIV_HILFE,
      tipp: "Im Passiv wird das Akkusativobjekt zum Subjekt, wer es tut, steht mit „von“. Dazu „werden“ in derselben Zeitform und das Partizip II.",
    };
  }
  return wahlAusSatz(passivLuecke(rng, st), "Welche Form passt in die Lücken?");
}
function passivKurz(rng: Rng, st: Stufe): Umformung {
  const { p, pat, t, zeit } = passivBau(rng, st);
  const mitTaeter = st >= 2 && rng() < 0.5;
  const f = passivFormen(p, pat, t);
  const vorlage = aktivSatz(p, pat, t, zeit);
  const taeter = [...p.taeter.von, ...(p.taeter.durch ?? [])];
  const richtig = [
    ...taeter.flatMap((x) => stellungen([pat.nom, ...(zeit ? [zeit] : []), x], f.finit, f.ende)),
    ...(mitTaeter ? [] : stellungen([pat.nom, ...(zeit ? [zeit] : [])], f.finit, f.ende)),
  ];
  // the given order first: subject, (time), with or without the doer
  const erst = `${cap([pat.nom, f.finit, ...(zeit ? [zeit] : []), ...(mitTaeter || rng() < 0.5 ? [p.taeter.von[0]] : []), f.ende].join(" "))}.`;
  const satz = (subj: string, fi: string, en: string, t2 = p.taeter.von[0]) => `${cap([subj, fi, ...(zeit ? [zeit] : []), t2, en].filter(Boolean).join(" "))}.`;
  const fe = passivFehler(p, pat, t);
  const fehler: Fehler[] = [
    ...(pat.akk !== pat.nom ? [F(satz(pat.akk, f.finit, f.ende), "Das Akkusativobjekt wird zum Subjekt (Nominativ): " + pat.nom)] : []),
    ...fe.finit.map((x) => F(satz(pat.nom, x.answer, f.ende), x.label)),
    ...fe.ende.map((x) => F(satz(pat.nom, f.finit, x.answer), x.label)),
    ...(t !== "praesens" ? [F(satz(pat.nom, pat.pl ? "werden" : "wird", p.p2), "Beim Umformen bleibt die Zeitform gleich")] : []),
    ...(t === "praesens" ? [F(satz(pat.nom, pat.pl ? "wurden" : "wurde", p.p2), "Beim Umformen bleibt die Zeitform gleich")] : []),
    F(satz(pat.nom, f.finit, f.ende, p.taeter.nom), "Den Täter schließt du mit „von“ an"),
    // „durch“ only where both are right (Feuerwehr, Sturm); a person who does it herself takes „von“
    ...(p.taeter.durch ? [] : [F(satz(pat.nom, f.finit, f.ende, `durch ${p.taeter.akk}`), "Wer etwas selbst tut, schließt du im Passiv mit „von“ an")]),
    ...(mitTaeter ? [F(satz(pat.nom, f.finit, f.ende, ""), "Der Täter fehlt: Nenne ihn mit „von“")] : []),
  ];
  return {
    auftrag: mitTaeter ? "Forme den Satz ins Passiv um. Die Zeitform bleibt gleich. Nenne auch, von wem es gemacht wird." : "Forme den Satz ins Passiv um. Die Zeitform bleibt gleich.",
    vorlage,
    richtig: [...new Set([erst, ...richtig])],
    fehler,
    regel: `${PASSIV_BAU[t]}. Das Akkusativobjekt (${pat.akk}) wird zum Subjekt (${pat.nom}).`,
    hilfe: "Was wird gemacht? Das wird das Subjekt. Welche Zeitform hat der Satz?",
  };
}

// =====================================================================
// ---------- direkte Rede ----------
// =====================================================================
type Redeart = "aussage" | "frage" | "ausruf";
const REDEN: Record<Redeart, string[]> = {
  aussage: ["Ich komme morgen mit", "Das Spiel beginnt um drei Uhr", "Wir treffen uns im Park", "Ich habe die Hausübung schon gemacht", "Der Bus ist schon weg", "Morgen schreiben wir eine Schularbeit", "Die Paradeiser sind schon reif", "Ich habe meinen Turnbeutel vergessen", "Heute ist es sehr kalt", "Im Jänner fahren wir Schi"],
  frage: ["Kommst du morgen mit", "Hast du die Hausübung schon gemacht", "Wann beginnt das Spiel", "Wo ist mein Turnbeutel", "Gehen wir heute in den Park", "Kannst du mir helfen", "Wie spät ist es"],
  ausruf: ["Pass auf", "Komm schnell her", "Das ist super", "Hör auf damit", "Beeil dich"],
};
/** Two parts of one sentence, for the Begleitsatz in the middle; the last is a question. */
const GETEILT: [string, string, boolean?][] = [
  ["Ich komme mit", "aber erst morgen"],
  ["Am Samstag", "fahren wir nach Wien"],
  ["Wenn du willst", "kannst du mitkommen"],
  ["Die Schularbeit", "ist erst am Freitag"],
  ["Morgen", "gehen wir schwimmen"],
  ["Kommst du mit", "oder bleibst du zu Hause", true],
  ["Hast du Zeit", "oder musst du lernen", true],
];
const BEGLEIT: Record<Redeart, [string, string][]> = {
  aussage: [["sagt", "sagte"], ["erklärt", "erklärte"], ["meint", "meinte"], ["antwortet", "antwortete"]],
  frage: [["fragt", "fragte"]],
  ausruf: [["ruft", "rief"]],
};
const RD_REGEL: Record<"vorn" | "hinten" | "mitte", string> = {
  vorn: "Steht der Begleitsatz vorn, folgt ein Doppelpunkt. Die Rede steht zwischen Anführungszeichen, ihr Satzzeichen vor dem schließenden Anführungszeichen.",
  hinten: "Steht der Begleitsatz hinten, trennt ihn ein Beistrich nach dem Anführungszeichen ab. Der Punkt der Rede fällt weg, Frage- und Rufzeichen bleiben.",
  mitte: "Steht der Begleitsatz in der Mitte, steht vor und nach ihm ein Beistrich. Die Rede geht danach weiter, darum ohne Punkt.",
};
const RD_HILFE = "Wo beginnt und wo endet die Rede? Steht der Begleitsatz vorn, hinten oder in der Mitte?";
/** The end of the speech: a question only „?“, the others „.“ or „!“ (an Aufforderung may end with either). */
const schluss = (a: Redeart) => (a === "frage" ? ["?"] : a === "ausruf" ? ["!", "."] : [".", "!"]);
/** A sentence with direkte Rede and gaps where its punctuation goes. Level 0: the quotation marks are given. */
function redeSatz(rng: Rng, st: Stufe, nur?: "vorn" | "hinten" | "mitte"): Satz {
  const stelle = nur ?? (st === 0 ? "vorn" : st === 1 ? art(rng, { vorn: 1, hinten: 1 }) : st === 2 ? art(rng, { vorn: 1, hinten: 2 }) : art(rng, { vorn: 1, hinten: 2, mitte: 2 }));
  const name = pick(rng, NAMEN);
  const praet = rng() < 0.5 ? 1 : 0;
  const titel = st === 0 ? "Setze die fehlenden Satzzeichen ein." : "Setze die Satzzeichen der direkten Rede ein: Doppelpunkt, Anführungszeichen, Beistrich und Schlusszeichen.";
  if (stelle === "mitte") {
    const [a, b, frage] = pick(rng, GETEILT);
    const verb = frage ? BEGLEIT.frage[0][praet] : pick(rng, BEGLEIT.aussage)[praet];
    const end = frage ? "?" : ".";
    return {
      titel,
      text: `„${a}${GAP} ${verb} ${name}${GAP}${b}${end}“`,
      luecken: [
        L("“,", [F("“", "Beistrich nach dem Anführungszeichen vergessen"), F(".“,", "Die Rede ist hier noch nicht zu Ende: kein Punkt"), F(",“", "Der Beistrich gehört hinter das Anführungszeichen", { fix: false })]),
        L(", „", [F(" „", "Beistrich nach dem eingeschobenen Begleitsatz vergessen"), F(". „", "Punkt statt Beistrich: Die Rede geht im selben Satz weiter"), F(", ", "Anführungszeichen vor dem zweiten Teil der Rede vergessen")]),
      ],
      regel: RD_REGEL.mitte,
      hilfe: RD_HILFE,
    };
  }
  const redeart = st <= 1 ? "aussage" : art(rng, { aussage: 2, frage: 2, ausruf: 1 });
  const rede = pick(rng, REDEN[redeart]);
  const verb = pick(rng, BEGLEIT[redeart])[praet];
  const ende = schluss(redeart);
  if (stelle === "vorn") {
    const zeichenFehler: Fehler[] =
      redeart === "frage"
        ? [F(".“", "Fragezeichen vergessen: Die Rede ist eine Frage"), F("“?", "Das Fragezeichen gehört vor das schließende Anführungszeichen", { fix: false }), F("?", "Schließendes Anführungszeichen vergessen", { fix: false })]
        : [F("“.", "Der Punkt gehört vor das schließende Anführungszeichen", { fix: false }), F("“", "Das Satzzeichen am Ende der Rede fehlt"), F(".", "Schließendes Anführungszeichen vergessen", { fix: false })];
    if (st === 0)
      return {
        titel,
        text: `${name} ${verb}${GAP} „${rede}${GAP}“`,
        luecken: [L(":", [F(",", "Beistrich statt Doppelpunkt: Nach dem Begleitsatz vorn steht ein Doppelpunkt"), F(".", "Punkt statt Doppelpunkt: Die Rede gehört zum Satz")]), L(ende, redeart === "frage" ? [F(".", "Fragezeichen vergessen: Die Rede ist eine Frage")] : [F(",", "Am Ende der Rede steht ein Punkt")])],
        regel: RD_REGEL.vorn,
        hilfe: RD_HILFE,
      };
    return {
      titel,
      text: `${name} ${verb}${GAP}${rede}${GAP}`,
      luecken: [
        L(": „", [F(" „", "Doppelpunkt nach dem Begleitsatz vergessen"), F(", „", "Beistrich statt Doppelpunkt: Nach dem Begleitsatz vorn steht ein Doppelpunkt"), F(": ", "Anführungszeichen am Anfang der Rede vergessen")]),
        L(
          ende.map((e) => `${e}“`),
          zeichenFehler,
        ),
      ],
      regel: RD_REGEL.vorn,
      hilfe: RD_HILFE,
    };
  }
  // hinten: „…“, sagt Lena.
  const zeichenFehler: Fehler[] =
    redeart === "frage"
      ? [F("?“", "Beistrich nach dem Anführungszeichen vergessen: Auch nach dem Fragezeichen steht ein Beistrich"), F("“,", "Fragezeichen der Rede vergessen: Es bleibt vor dem Anführungszeichen"), F("?,“", "Der Beistrich gehört hinter das Anführungszeichen", { fix: false }), F(".“,", "Fragezeichen der Rede vergessen: Die Rede ist eine Frage")]
      : redeart === "ausruf"
        ? [F("!“", "Beistrich nach dem Anführungszeichen vergessen: Auch nach dem Rufzeichen steht ein Beistrich"), F(".“,", "Der Punkt der Rede fällt weg, wenn der Begleitsatz folgt"), F("!,“", "Der Beistrich gehört hinter das Anführungszeichen", { fix: false })]
        : [F(".“,", "Der Punkt der Rede fällt weg, wenn der Begleitsatz folgt"), F("“", "Beistrich nach dem Anführungszeichen vergessen"), F(",“", "Der Beistrich gehört hinter das Anführungszeichen", { fix: false }), F(".“", "Punkt statt Beistrich: Nach der Rede geht der Satz mit dem Begleitsatz weiter", { fix: false })];
  return {
    titel,
    text: `${GAP}${rede}${GAP} ${verb} ${name}.`,
    luecken: [
      L("„", [F("", "Anführungszeichen am Anfang der Rede vergessen", { mc: false })]),
      L(
        redeart === "frage" ? ["?“,"] : redeart === "ausruf" ? ["!“,", "“,"] : ["“,", "!“,"],
        zeichenFehler,
      ),
    ],
    regel: RD_REGEL.hinten,
    hilfe: RD_HILFE,
  };
}
/**
 * Level 0 has the quotation marks in the text; the multiple choice and the correction need the full gaps.
 * „sehr leicht“ stays with the Begleitsatz in front.
 */
const redeVoll = (rng: Rng, st: Stufe) => redeSatz(rng, Math.max(st, 1) as Stufe, st === 0 ? "vorn" : undefined);
/** The sentence without the punctuation of the direkte Rede: „Lena fragt Wann beginnt das Spiel“. */
const ohneZeichen = (s: Satz) =>
  fuellen(
    s,
    s.luecken.map(() => " "),
  )
    .replace(/[„“":,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function redeWahl(rng: Rng, st: Stufe): Wahl {
  const s = redeVoll(rng, st);
  return { ...wahlAusSatz(s, "Welcher Satz hat die richtigen Satzzeichen?", true), text: ohneZeichen(s) };
}
function redeKurz(rng: Rng, st: Stufe): Umformung {
  const kind = st === 0 ? "abschreiben" : art(rng, { abschreiben: 2, umstellen: st >= 1 ? 2 : 0 });
  if (kind === "umstellen") {
    // the Begleitsatz moves: vorn → hinten (from level 2 also hinten → vorn)
    const nachVorn = st >= 2 && rng() < 0.4;
    const redeart: Redeart = st <= 1 ? "aussage" : art(rng, { aussage: 2, frage: 1 });
    const rede = pick(rng, REDEN[redeart]);
    const name = pick(rng, NAMEN);
    const verb = pick(rng, BEGLEIT[redeart])[rng() < 0.5 ? 1 : 0];
    const e = redeart === "frage" ? "?" : ".";
    const vorn = `${name} ${verb}: „${rede}${e}“`;
    const hintenE = redeart === "frage" ? ["?"] : ["", "!"];
    const hinten = hintenE.map((x) => `„${rede}${x}“, ${verb} ${name}.`);
    if (nachVorn)
      return {
        auftrag: "Stell den Begleitsatz nach vorn. Achte auf die Satzzeichen.",
        vorlage: hinten[0],
        richtig: redeart === "frage" ? [vorn] : [vorn, `${name} ${verb}: „${rede}!“`],
        fehler: [
          F(`${name} ${verb} „${rede}${e}“`, "Doppelpunkt nach dem Begleitsatz vergessen"),
          F(`${name} ${verb}, „${rede}${e}“`, "Beistrich statt Doppelpunkt: Nach dem Begleitsatz vorn steht ein Doppelpunkt"),
          F(`${name} ${verb}: „${rede}“${e}`, `Das ${e === "?" ? "Fragezeichen" : "Satzzeichen"} der Rede gehört vor das schließende Anführungszeichen`),
          F(`${name} ${verb}: „${rede}“`, "Das Satzzeichen am Ende der Rede fehlt"),
          F(`${cap(verb)} ${name}: „${rede}${e}“`, `Steht der Begleitsatz vorn, beginnt er mit dem Namen: ${name} ${verb}`),
        ],
        regel: `${vorn} ${RD_REGEL.vorn}`,
        hilfe: RD_HILFE,
        tipp: RD_REGEL.vorn,
      };
    return {
      auftrag: "Stell den Begleitsatz nach hinten. Achte auf die Satzzeichen.",
      vorlage: vorn,
      richtig: hinten,
      fehler: [
        ...(redeart === "frage" ? [F(`„${rede}?“ ${verb} ${name}.`, "Beistrich nach dem Anführungszeichen vergessen: Auch nach dem Fragezeichen steht ein Beistrich")] : [F(`„${rede}.“, ${verb} ${name}.`, "Der Punkt der Rede fällt weg, wenn der Begleitsatz folgt"), F(`„${rede}“ ${verb} ${name}.`, "Beistrich nach dem Anführungszeichen vergessen")]),
        F(`„${rede}${redeart === "frage" ? "?" : ""}“, ${name} ${verb}.`, `Nach der Rede steht das Verb vor dem Namen: ${verb} ${name}`),
        F(`„${rede}${redeart === "frage" ? "?" : ""}“, ${verb} ${name}`, "Am Ende des Begleitsatzes fehlt der Punkt"),
      ],
      regel: `${hinten[0]} ${RD_REGEL.hinten}`,
      hilfe: RD_HILFE,
      tipp: RD_REGEL.hinten,
    };
  }
  // write the sentence with all its punctuation; not with the Begleitsatz in the middle: without marks
  // „Am Samstag sagt Lena fahren wir nach Wien“ can also be „Am Samstag sagt Lena: „Fahren wir …“
  const s = redeSatz(rng, Math.max(st, 1) as Stufe, st === 0 || rng() < 0.5 ? "vorn" : "hinten");
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const ohne = ohneZeichen(s);
  const kombis = s.luecken.reduce<string[][]>((acc, l) => acc.flatMap((a) => l.richtig.map((r) => [...a, r])), [[]]);
  return {
    auftrag: "Schreib den Satz mit den Satzzeichen der direkten Rede ab.",
    vorlage: ohne,
    richtig: kombis.map((k) => fuellen(s, k)),
    fehler: s.luecken.flatMap((l, i) => sauber(l.richtig, l.fehler, true).map((f) => F(fuellen(s, rechts.map((r, j) => (j === i ? f.answer : r))), f.label))),
    regel: `${fuellen(s, rechts)} ${s.regel}`,
    hilfe: RD_HILFE,
    tipp: s.regel,
  };
}

// =====================================================================
// ---------- the skills ----------
// =====================================================================
const FAEHIGKEITEN: Record<string, Faehigkeit> = {
  "deutsch.satz.satzglieder": { luecke: satzgliederLuecke, wahl: satzgliederWahl, kurz: satzgliederKurz, standard: "mc", bestimmen: true },
  "deutsch.satz.objekte": {
    luecke: objekteLuecke,
    wahl: objekteWahl,
    kurz: objekteKurz,
    fix: objektFehlerSatz,
    fixAuftrag: (n) => (n === 1 ? "Im Satz steht ein Objekt im falschen Fall. Schreib den Satz richtig." : "In jedem Satz steht ein Objekt im falschen Fall. Schreib den Text richtig."),
    standard: "mc",
    bestimmen: true,
  },
  "deutsch.satz.adverbiale": { luecke: adverbialeLuecke, wahl: adverbialeWahl, kurz: adverbialeKurz, standard: "mc", bestimmen: true },
  "deutsch.grammatik.faelle": {
    luecke: (rng, st) => fallSatz(rng, st).satz,
    wahl: faelleWahl,
    kurz: faelleKurz,
    fix: (rng, st) => fallSatz(rng, st, true).satz,
    fixAuftrag: (n) => (n === 1 ? "Im Satz steht ein Wort im falschen Fall. Schreib den Satz richtig." : "In jedem Satz steht ein Wort im falschen Fall. Schreib den Text richtig."),
    standard: "mc",
    bestimmen: true,
  },
  "deutsch.grammatik.zeiten": {
    luecke: zeitenLuecke,
    wahl: (rng, st) => zeitErkennen(rng, st),
    kurz: zeitenKurz,
    standard: "mc",
    bestimmen: true,
  },
  "deutsch.grammatik.futur": {
    luecke: futurLuecke,
    wahl: futurWahl,
    kurz: futurKurz,
    fix: (rng, st) => zeitFixSatz(futurTempus(rng, st))(rng, st),
    fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fehler beim Futur. Schreib den Satz richtig." : "In jedem Satz ist ein Fehler beim Futur. Schreib den Text richtig."),
    standard: "cloze",
    bestimmen: false,
  },
  "deutsch.grammatik.plusquamperfekt": {
    luecke: plusquamperfektLuecke,
    wahl: plusquamperfektWahl,
    kurz: plusquamperfektKurz,
    fix: plusquamperfektLuecke,
    fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fehler beim Plusquamperfekt. Schreib den Satz richtig." : "In jedem Satz ist ein Fehler beim Plusquamperfekt. Schreib den Text richtig."),
    standard: "cloze",
    bestimmen: false,
  },
  "deutsch.grammatik.aktiv-passiv": {
    luecke: passivLuecke,
    wahl: passivWahl,
    kurz: passivKurz,
    fix: passivLuecke,
    fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fehler beim Passiv. Schreib den Satz richtig." : "In jedem Satz ist ein Fehler beim Passiv. Schreib den Text richtig."),
    standard: "cloze",
    bestimmen: false,
  },
  "deutsch.beistrich.direkte-rede": {
    luecke: redeSatz,
    wahl: redeWahl,
    kurz: redeKurz,
    fix: redeVoll,
    fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fehler bei den Satzzeichen. Schreib den Satz richtig." : "In jedem Satz ist ein Fehler bei den Satzzeichen. Schreib den Text richtig."),
    standard: "cloze",
    bestimmen: false,
    zeichen: true,
  },
};
// Zeitformen: "Fehler korrigieren" with one tense per task, named in the instruction
const ZEIT_FIX_TEMPORA: Tempus[] = ["praeteritum", "perfekt", "futur1"];

/** How a task is answered: gap text, multiple choice, Fehler korrigieren, short answer. */
export type DeutschFormat = "cloze" | "mc" | "fix" | "kurz";

export const istDeutschSatzlehre = (skillId: string | null | undefined): boolean => Boolean(skillId && FAEHIGKEITEN[skillId]);
/** The skills with built-in Satzlehre tasks. */
export const DEUTSCH_SATZLEHRE_IDS = Object.keys(FAEHIGKEITEN);
const hatFix = (skillId: string) => Boolean(FAEHIGKEITEN[skillId]?.fix) || skillId === "deutsch.grammatik.zeiten";
/** The formats a skill has: every one gap text, multiple choice and short answer; most also correction. */
export function deutschFormate(skillId: string): DeutschFormat[] {
  if (!FAEHIGKEITEN[skillId]) return [];
  return ["cloze", "mc", "kurz", ...(hatFix(skillId) ? (["fix"] as const) : [])];
}

/** "Fehler korrigieren": one sentence, two on the middle level, three on the hard ones; never the same error twice. */
function fixAufgabe(skillId: string, difficulty: Difficulty, rng: Rng): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  const st = STUFE[difficulty];
  const n = st >= 3 ? 3 : st >= 2 ? 2 : 1;
  let quelle = f.fix;
  let auftrag = f.fixAuftrag;
  if (skillId === "deutsch.grammatik.zeiten") {
    const t = pick(rng, ZEIT_FIX_TEMPORA.filter((x) => st >= 1 || x !== "futur1"));
    quelle = zeitFixSatz(t);
    const name = TEMPUS_KURZ[t];
    auftrag = (k) => (k === 1 ? `Der Satz soll im ${name} stehen. Er hat einen Fehler. Schreib ihn richtig.` : `Die Sätze sollen im ${name} stehen. In jedem Satz ist ein Fehler. Schreib den Text richtig.`);
  }
  if (!quelle || !auftrag) return null;
  const teile: { falsch: string; richtig: string[]; label: string }[] = [];
  const schon = new Set<string>();
  for (let k = 0; teile.length < n && k < 80; k++) {
    const s = quelle(rng, st);
    const t = mitFehler(s, rng, f.zeichen);
    if (!t) continue;
    // two sentences with the same error would make the labels ambiguous; the same sentence twice is dull
    const fixes = expectedFixes(t.falsch, t.richtig[0]).map((x) => `${x.wrong}→${x.right}`.toLowerCase());
    if (fixes.length !== 1 || fixes.some((x) => schon.has(x)) || teile.some((x) => x.richtig[0] === t.richtig[0])) continue;
    fixes.forEach((x) => schon.add(x));
    teile.push(t);
  }
  return teile.length ? korrektur(skillId, difficulty, teile, auftrag(teile.length)) : null;
}

/** One task of a skill in a format; null when the skill does not have the format. */
export function deutschAufgabe(skillId: string, format: DeutschFormat, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  if (!f) return null;
  const st = STUFE[difficulty];
  if (format === "fix") return fixAufgabe(skillId, difficulty, rng);
  if (format === "kurz") return kurzantwort(skillId, difficulty, f.kurz(rng, st), f.zeichen);
  if (format === "mc") {
    for (let k = 0; k < 40; k++) {
      const w = f.wahl(rng, st);
      const t = w && auswahl(skillId, difficulty, w, rng, f.zeichen);
      if (t) return t;
    }
    return null;
  }
  return lueckentext(skillId, difficulty, f.luecke(rng, st), f.zeichen);
}

/** One sentence with one error to write correctly (Fehler finden, Satz verbessern); null without such sentences. */
function satzMitFehler(skillId: string, difficulty: Difficulty, rng: Rng, category: string): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  if (!hatFix(skillId)) return null;
  const st = STUFE[difficulty];
  for (let k = 0; k < 40; k++) {
    // Zeitformen: the tense the sentence should have is named
    const tempus = skillId === "deutsch.grammatik.zeiten" ? pick(rng, ZEIT_FIX_TEMPORA.filter((x) => st >= 1 || x !== "futur1")) : null;
    const t = mitFehler((tempus ? zeitFixSatz(tempus) : f.fix!)(rng, st), rng, f.zeichen);
    if (!t || expectedFixes(t.falsch, t.richtig[0]).length !== 1) continue;
    const auftrag = tempus ? `Der Satz soll im ${TEMPUS_KURZ[tempus]} stehen. Er hat einen Fehler. Schreib ihn richtig.` : (f.fixAuftrag?.(1) ?? "Im Satz ist ein Fehler. Schreib den Satz richtig.");
    return {
      type: "grammar",
      skillId,
      category,
      difficulty,
      prompt: `${auftrag}\n${t.falsch}`,
      data: {},
      answer: { accepted: t.richtig, mode: "text", ...(f.zeichen ? { satzzeichen: true } : {}) },
      solution: `${t.richtig[0]}\n→ ${t.label}`,
      hints: ["Lies den Satz langsam. Wo stimmt etwas nicht?", "Es ist genau ein Fehler."],
      errorMap: [{ answer: t.falsch, label: `Den Fehler nicht gefunden: ${t.label}` }],
    };
  }
  return null;
}

/**
 * "Fehler finden": determination skills show someone's wrong choice („Jonas hat … gewählt“), the student
 * picks the right one; forming skills show a sentence with one error to write correctly.
 */
function fehlerFinden(skillId: string, difficulty: Difficulty, rng: Rng): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  if (!f.bestimmen && hatFix(skillId)) return satzMitFehler(skillId, difficulty, rng, "fehler");
  const mc = deutschAufgabe(skillId, "mc", difficulty, rng);
  if (!mc || !mc.errorMap.length) return mc;
  const e = pick(rng, mc.errorMap);
  const name = pick(rng, [...MAEDCHEN.slice(0, 6), ...BUBEN.slice(0, 6)]);
  const gewaehlt = mc.data.options![Number(e.answer)];
  // the label often names the right answer („Genitiv statt Dativ: Frag „Wem?““): then only the part after
  // it, or the hints of the task when that names it too
  const richtig = mc.data.options![mc.answer.correct!].replace(/\s*\([^)]*\)/g, "").toLowerCase();
  const nennt = (x: string) => x.toLowerCase().includes(richtig);
  const rest = e.label.replace(/^[^:.]*[:.]\s*/, "");
  const warum = !nennt(e.label) ? e.label : rest !== e.label && !nennt(rest) ? rest : null;
  return {
    ...mc,
    category: "fehler",
    prompt: `${mc.prompt}\n${name} hat „${gewaehlt}“ gewählt. Das stimmt nicht. Was ist richtig?`,
    hints: warum ? [`Warum stimmt „${gewaehlt}“ nicht? ${warum}.`, ...mc.hints.slice(0, 1)] : mc.hints.slice(0, 2),
    errorMap: [{ answer: e.answer, label: `Fehler übernommen: ${e.label}` }, ...mc.errorMap.filter((x) => x !== e)],
  };
}

/** The task a skill gives when no format is asked for. */
export const DEUTSCH_SATZLEHRE: Record<string, (rng: Rng, difficulty: Difficulty) => TaskDraft> = Object.fromEntries(
  Object.entries(FAEHIGKEITEN).map(([id, f]) => [id, (rng: Rng, difficulty: Difficulty) => deutschAufgabe(id, f.standard, difficulty, rng) ?? deutschAufgabe(id, "cloze", difficulty, rng)!]),
);

/**
 * A task for a task type of the builder (lib/curriculum.ts CATEGORIES, Deutsch) and the task type it
 * really is. Grammatik: determination skills ask with multiple choice (sometimes a short answer), forming
 * skills with a short answer. A type the skill has no task for becomes a gap text, so the builder can say so.
 */
export function deutschFuerKategorie(skillId: string, category: string | null, difficulty: Difficulty, rng: Rng = Math.random): { task: TaskDraft; category: string | null } {
  const f = FAEHIGKEITEN[skillId]!;
  const als = (format: DeutschFormat, cat: string | null) => {
    const task = deutschAufgabe(skillId, format, difficulty, rng);
    return task ? { task: { ...task, category: cat }, category: cat } : null;
  };
  const luecke = () => als("cloze", "lueckentext")!;
  switch (category) {
    case "grammatik":
      return f.bestimmen ? (rng() < 0.7 ? als("mc", "grammatik") : null) ?? als("kurz", "grammatik")! : als("kurz", "grammatik")!;
    case "lueckentext":
      return luecke();
    case "korrigieren":
      return als("fix", "korrigieren") ?? luecke();
    case "fehler": {
      const task = fehlerFinden(skillId, difficulty, rng);
      return task ? { task, category: "fehler" } : luecke();
    }
    case "satz": {
      // Satz verbessern: a sentence with an error to write correctly; without one the short answer
      const task = satzMitFehler(skillId, difficulty, rng, "satz");
      return task ? { task, category: "satz" } : als("kurz", "grammatik")!;
    }
    case "rechtschreibung":
      return f.zeichen ? als("cloze", "rechtschreibung")! : luecke();
    case null:
      return als(f.standard, null) ?? luecke();
    default:
      return luecke();
  }
}

/** A task for an answer format of generateBuiltIn (mixed: gap text, multiple choice or short answer). */
export function deutschFuerTyp(skillId: string, taskType: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft {
  const f = FAEHIGKEITEN[skillId]!;
  const format: DeutschFormat =
    taskType === "mixed" ? pick(rng, ["cloze", "mc", "kurz"] as const) : taskType === "mc" ? "mc" : taskType === "cloze" ? "cloze" : taskType === "grammar" ? "kurz" : taskType === "fix" ? "fix" : f.standard;
  return deutschAufgabe(skillId, format, difficulty, rng) ?? deutschAufgabe(skillId, f.standard, difficulty, rng) ?? deutschAufgabe(skillId, "cloze", difficulty, rng)!;
}
