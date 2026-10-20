/**
 * Englisch-Grammatik ohne KI: built-in tasks for the core grammar skills of the Unterstufe (tenses, to be,
 * have got, some/any, much/many, questions, modal verbs, comparison, adverbs of frequency, plural,
 * s-Genitiv, if-clauses, passive, reported speech, prepositions of time, irregular verbs). The sentences
 * are built from the word lists in lib/englisch-woerter.ts, so a skill has hundreds of different tasks
 * and every task knows its right answer and the typical errors students make.
 *
 * One sentence ("Satz") gives every format: a gap text with the base form in brackets, real multiple
 * choice whose wrong options are typical errors, "Fehler korrigieren" (one to three sentences, each with
 * one typical error) and, where it fits, a short answer (make the sentence negative, ask a question, put
 * it into the passive). The levels change the words (first year: play, go, have; later: lay, forgive,
 * steal) and the sentences: easy levels ask for one form in a short sentence with a clear signal word,
 * hard levels add negatives and questions, two clauses, traps like state verbs and instructions that do
 * not name the tense. Answers are checked with contractions (doesn't = does not), see
 * lib/englisch-kurzformen.ts.
 *
 * Own sentences and own didactic choices: nothing is taken from a school book (More!, Prime Time,
 * Way2Go …), IQS or Matura task. German texts (hints, rules, error labels) are short and use „du“.
 */
import type { Difficulty } from "./curriculum";
import { langform } from "./englisch-kurzformen";
import {
  BUBENNAMEN,
  DAMALS,
  EINST,
  HANDLUNGEN,
  MAEDCHENNAMEN,
  NOMEN,
  OBJ,
  OFT,
  PERSONEN,
  POSS,
  UNREGELMAESSIG,
  VERWECHSELT,
  ZUSTAENDE,
  adjektiv,
  dritte,
  falschesEd,
  klein,
  naivEd,
  naivIng,
  naivS,
  pick,
  verb,
  type Adjektiv,
  type Handlung,
  type Nomen,
  type Person,
  type Pronomen,
  type Verb,
  type WortStufe,
} from "./englisch-woerter";
import { closestVersion, expectedFixes } from "./fix-text";
import { STUFE, type Rng, type Stufe } from "./schulbuch-zahlen";
import { GAP, normalizeText, type TaskDraft } from "./tasks";

// ---------- the shape of a sentence ----------
/** A typical wrong answer. mc: false = never a wrong option; fix: false = never the error of a text to correct
 *  (the sentence would still be right English, only not what the gap text asks for). */
export type Fehler = { answer: string; label: string; mc?: false; fix?: false };
const F = (answer: string, label: string, o: { mc?: false; fix?: false } = {}): Fehler => ({ answer, label, ...o });

/** One gap: what is shown in brackets after it, the right answers (the first is shown) and the typical errors. */
type Luecke = { cue?: string; richtig: string[]; fehler: Fehler[] };
const L = (richtig: string | string[], fehler: Fehler[], cue?: string): Luecke => ({ cue, richtig: typeof richtig === "string" ? [richtig] : richtig, fehler });

/**
 * A sentence with one or two gaps (___). `regel` says why the answer is right (shown with the solution),
 * `hilfe` is the first hint. `titel` replaces the instruction of the skill for this sentence.
 * `fixExtra`: more errors for "Fehler korrigieren" that are not a gap ("taller then me").
 * `ohneLuecke`: the right answer is "no word" (on next Monday): only multiple choice and correction.
 * `tabelle`: a line of the verb table ("go, ___, ___"), not a sentence: no correction text.
 */
export type Satz = {
  text: string;
  luecken: Luecke[];
  regel: string;
  hilfe: string;
  titel?: string;
  fixExtra?: { von: string; zu: string; label: string }[];
  ohneLuecke?: boolean;
  tabelle?: boolean;
};
/** A short answer: an instruction, the sentence or word to work with, the right answers and the typical errors. */
export type Umformung = { auftrag: string; vorlage: string; richtig: string[]; fehler: Fehler[]; regel: string; hilfe: string };

type Faehigkeit = {
  /** instruction of the gap text */
  titel: (st: Stufe) => string;
  /** instruction of the multiple choice */
  wahl: (st: Stufe) => string;
  satz: (rng: Rng, st: Stufe) => Satz;
  kurz?: (rng: Rng, st: Stufe) => Umformung;
  /** German to English (irregular verbs) */
  uebersetzen?: (rng: Rng, st: Stufe) => Umformung;
  /** the task when no format is asked for: a gap text, or a short answer (irregular verbs) */
  standard?: "kurz";
};
const T = (s: string) => () => s;

// ---------- small helpers ----------
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const be = (p: Pronomen) => (p === "I" ? "am" : dritte(p) ? "is" : "are");
/** the wrong form of be a student often takes instead */
const anderesBe = (p: Pronomen) => (p === "I" ? "is" : dritte(p) ? "are" : "is");
const beNicht = (p: Pronomen) => (p === "I" ? "am not" : dritte(p) ? "isn't" : "aren't");
const war = (p: Pronomen) => (p === "I" || dritte(p) ? "was" : "were");
const anderesWar = (p: Pronomen) => (war(p) === "was" ? "were" : "was");
const tun = (p: Pronomen) => (dritte(p) ? "does" : "do");
const tunNicht = (p: Pronomen) => (dritte(p) ? "doesn't" : "don't");
const hat = (p: Pronomen) => (dritte(p) ? "has" : "have");
const anderesHat = (p: Pronomen) => (dritte(p) ? "have" : "has");
const simple = (v: Verb, p: Pronomen) => (v.base === "be" ? be(p) : dritte(p) ? v.s : v.base);
const mit = (text: string, p: Pronomen) => text.replace(/\{poss\}/g, POSS[p]);
/** The subject again as a pronoun in a second clause: "Lena …, but she …". */
const pron = (p: Pronomen) => p;
const zeit = (z: string) => (z ? ` ${z}` : "");
const regelBe = (p: Pronomen) => (p === "I" ? "Bei I steht am." : dritte(p) ? "Bei he, she, it steht is." : "Bei you, we, they steht are.");
const regelHat = (p: Pronomen) => (dritte(p) ? "Bei he, she, it steht has." : "Bei I, you, we, they steht have.");
const regelWar = (p: Pronomen) => (war(p) === "was" ? "Bei I, he, she, it steht was." : "Bei you, we, they steht were.");

/** One of several kinds, by weight: art(rng, { aussage: 2, frage: 1 }). */
function art<K extends string>(rng: Rng, gewichte: Partial<Record<K, number>>): K {
  const eintraege = (Object.entries(gewichte) as [K, number][]).filter(([, w]) => w > 0);
  let r = rng() * eintraege.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of eintraege) if ((r -= w) < 0) return k;
  return eintraege[eintraege.length - 1][0];
}

/** Which words a level uses: first year only the basic ones, the hard levels all. */
const WORT: Record<Stufe, WortStufe> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2 };
/** A word up to the level; on the hard levels mostly one of the harder words. */
function nachStufe<T>(rng: Rng, liste: readonly T[], st: Stufe, stufe: (x: T) => number): T {
  const erlaubt = liste.filter((x) => stufe(x) <= WORT[st]);
  const pool = erlaubt.length ? erlaubt : [...liste];
  const schwer = pool.filter((x) => stufe(x) >= 1);
  return pick(rng, st >= 3 && schwer.length && rng() < 0.6 ? schwer : pool);
}

type Wer = { tier?: boolean; erwachsen?: boolean; beruf?: boolean; dritte?: boolean; ohneIch?: boolean; kind?: boolean };
/** A subject: a name, a family member, a pronoun or an animal. */
function person(rng: Rng, o: Wer = {}): Person {
  const passt = (x: Person, mitDritte: boolean) =>
    Boolean(x.tier) === Boolean(o.tier) &&
    (!o.erwachsen || x.erwachsen) &&
    (!o.kind || !x.erwachsen) &&
    (!o.beruf || !x.pension) &&
    !(o.ohneIch && x.p === "I") &&
    (!mitDritte || o.dritte === undefined || dritte(x.p) === o.dritte);
  const liste = PERSONEN.filter((x) => passt(x, true));
  return pick(rng, liste.length ? liste : PERSONEN.filter((x) => passt(x, false)));
}
/** Who does an action: animals, grown-ups at work, otherwise children (a grandpa does not walk to school). */
const werFuer = (h: Handlung): Wer => (h.bereich === "tier" ? { tier: true } : h.bereich === "beruf" ? { erwachsen: true, beruf: true } : { kind: true });
const hStufe = (h: Handlung) => Math.max(h.stufe, verb(h.v).stufe);
/** An action that fits the tense: g = habit, j = going on now, v = once in the past. */
function handlung(rng: Rng, st: Stufe, zeitart: "g" | "j" | "v", passt: (h: Handlung) => boolean = () => true): Handlung {
  return nachStufe(rng, HANDLUNGEN.filter((h) => h.zeiten.includes(zeitart) && passt(h)), st, hStufe);
}
const oft = (rng: Rng, h: Handlung) => pick(rng, h.oft ?? OFT[h.bereich]);
const einst = (rng: Rng, h: Handlung) => pick(rng, h.einst ?? EINST[h.bereich]);
const JETZT = ["now", "right now", "at the moment"];

/** -s, -es, -ies, has: which rule a he/she/it form follows. */
function sRegel(v: Verb): string {
  if (v.base === "have") return "have wird bei he, she, it zu has";
  if (v.s.endsWith("ies")) return "Konsonant + y wird zu „-ies“";
  if (v.s.endsWith("es") && !v.base.endsWith("e")) return "Nach s, sh, ch, x und o kommt „-es“";
  return "Bei he, she, it kommt „-s“ dazu";
}
function ingRegel(v: Verb): string {
  if (/ie$/.test(v.base)) return "ie wird vor „-ing“ zu y";
  if (v.ing.length === v.base.length + 3 && /e$/.test(v.base)) return "Kein stummes e vor „-ing“ weglassen";
  if (/e$/.test(v.base) && !/ee$/.test(v.base)) return "Das stumme e fällt vor „-ing“ weg";
  if (v.ing.length === v.base.length + 4) return "Nach kurzem Vokal wird der Endbuchstabe verdoppelt";
  return "Schreibweise der „-ing“-Form";
}
function edRegel(v: Verb): string {
  if (/[^aeiou]y$/.test(v.base)) return "Konsonant + y wird zu „-ied“";
  if (/[aeiou]y$/.test(v.base)) return "Vokal + y: nur „-ed“";
  return "Nach kurzem Vokal wird der Endbuchstabe verdoppelt";
}
/** Wrong past forms of an irregular verb: made regular, the 3rd form, a similar verb. */
function falschePast(v: Verb): Fehler[] {
  if (!v.irregular) return [...(falschesEd(v.base) ? [F(falschesEd(v.base)!, edRegel(v))] : [])];
  const out: Fehler[] = [];
  if (v.base !== "be" && naivEd(v.base) !== v.past) out.push(F(naivEd(v.base), "Unregelmäßiges Verb regelmäßig gebildet"));
  if (v.pp !== v.past) out.push(F(v.pp, "3. Form statt 2. Form"));
  for (const x of VERWECHSELT[v.past] ?? []) out.push(F(x, x === v.base ? "Grundform statt 2. Form" : /ed$/.test(x) ? "Unregelmäßiges Verb regelmäßig gebildet" : "Ähnliche Form verwechselt"));
  return out;
}
/** Wrong past participles: the 2nd form, made regular, the base form. */
function falschePP(v: Verb): Fehler[] {
  const out: Fehler[] = [];
  if (v.past !== v.pp) out.push(F(v.past, "2. Form statt 3. Form"));
  if (v.irregular && v.base !== "be" && naivEd(v.base) !== v.pp) out.push(F(naivEd(v.base), "Unregelmäßiges Verb regelmäßig gebildet"));
  if (v.base !== v.pp) out.push(F(v.base, "Grundform statt 3. Form"));
  return out;
}
const formen = (v: Verb) => (v.base === "be" ? "be, was/were, been" : `${v.base}, ${[v.past, ...v.pastAlt].join("/")}, ${[v.pp, ...v.ppAlt].join("/")}`);
const vergangenheitsRegel = (v: Verb) => (v.irregular ? `${v.base} ist unregelmäßig: ${formen(v)}.` : `Regelmäßig: Grundform + „-ed“: ${v.past}.`);


// ---------- the formats: gap text, multiple choice, Fehler korrigieren, short answer ----------
/** The right answer "no word" (We are going to Italy ___ next summer.): only multiple choice and correction. */
const KEIN = "";
const KEIN_TEXT = "(no preposition)";

/** Two answers are the same when they are the same in the long form (doesn't = does not). */
const schluessel = (x: string) => langform(normalizeText(x));
/** Typical errors without the ones that are right after all, each once. */
function sauber(richtig: readonly string[], fehler: readonly Fehler[]): Fehler[] {
  const seen = new Set(richtig.map(schluessel));
  return fehler.filter((f) => {
    const k = schluessel(f.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A capital letter where a sentence starts: "does Lena …" becomes "Does Lena …". */
const grossAnfang = (t: string) => t.replace(/(^|[.!?] +)([“"]?)([a-z])/g, (_, a: string, q: string, c: string) => a + q + c.toUpperCase());
/** The sentence with its gaps filled; an empty value ("no preposition") takes the gap and its space away. */
function fuellen(s: Satz, werte: readonly string[]): string {
  let i = 0;
  const text = s.text.replace(/ ?___/g, (m) => {
    const w = werte[i++] ?? "";
    return w ? m.replace(GAP, w) : "";
  });
  return grossAnfang(text.replace(/ {2,}/g, " ").replace(/ ([,.!?])/g, "$1").trim());
}
/** The gap text as the student sees it: the base form (or what to use) in brackets after each gap. */
function mitCues(s: Satz): string {
  let i = 0;
  return s.text.replace(/___/g, () => {
    const l = s.luecken[i++];
    return l?.cue ? `${GAP} (${l.cue})` : GAP;
  });
}
/** The first gap stands at the start of a sentence (its option starts with a capital letter). */
const amAnfang = (s: Satz) => /(^|[.!?] +)[“"]?$/.test(s.text.slice(0, s.text.indexOf(GAP)));

/** Gap text: one sentence (or two), the base form in brackets, every right form counts. */
function lueckentext(skillId: string, difficulty: Difficulty, titel: string, s: Satz): TaskDraft {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  return {
    type: "cloze",
    skillId,
    difficulty,
    prompt: `${titel}\n${mitCues(s)}`,
    data: {},
    answer: { blanks: s.luecken.map((l) => l.richtig), mode: "text", contractions: true },
    solution: `${fuellen(s, rechts)}\n${s.regel}`,
    hints: [s.hilfe, s.regel],
    // several gaps: the error stands with the other gaps right ("has | ate"), so the label is found for the whole answer
    errorMap: s.luecken.flatMap((l, i) =>
      sauber(l.richtig, l.fehler).map((f) => ({ answer: s.luecken.length === 1 ? f.answer : rechts.map((r, j) => (j === i ? f.answer : r)).join(" | "), label: f.label })),
    ),
  };
}

/** Multiple choice: the wrong options are typical errors of this sentence. Null when there are fewer than two. */
function auswahl(skillId: string, difficulty: Difficulty, titel: string, s: Satz, rng: Rng): TaskDraft | null {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const zeige = (werte: string[]) => werte.map((w, i) => (w === KEIN ? KEIN_TEXT : i === 0 && amAnfang(s) ? cap(w) : w)).join(" … ");
  const richtig = zeige(rechts);
  const seen = new Set([schluessel(richtig)]);
  const falsche = shuffle(
    rng,
    s.luecken.flatMap((l, i) => sauber(l.richtig, l.fehler).filter((f) => f.mc !== false).map((f) => ({ text: zeige(rechts.map((r, j) => (j === i ? f.answer : r))), label: f.label }))),
  ).filter((f) => {
    const k = schluessel(f.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (falsche.length < 2) return null;
  const options = shuffle(rng, [richtig, ...falsche.slice(0, 3).map((f) => f.text)]);
  return {
    type: "mc",
    skillId,
    difficulty,
    prompt: `${titel}\n${s.text}`,
    data: { options },
    answer: { correct: options.indexOf(richtig) },
    solution: `${fuellen(s, rechts)}\n${s.regel}`,
    hints: [s.hilfe, s.regel],
    errorMap: falsche.slice(0, 3).map((f) => ({ answer: String(options.indexOf(f.text)), label: f.label })),
  };
}

const ersetzen = (text: string, von: string, zu: string) => text.replace(new RegExp(`\\b${von.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), zu);

/** One sentence with one typical error, for "Fehler korrigieren": the wrong text, the right versions and what the error is. */
function mitFehler(s: Satz, rng: Rng): { falsch: string; richtig: string[]; label: string } | null {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const korrekt = fuellen(s, rechts);
  const moeglich = [
    ...s.luecken.flatMap((l, i) =>
      sauber(l.richtig, l.fehler)
        .filter((f) => f.fix !== false)
        .map(() => i),
    ),
    ...(s.fixExtra ?? []).filter((x) => ersetzen(korrekt, x.von, x.zu) !== korrekt).map(() => -1),
  ];
  if (!moeglich.length) return null;
  const k = Math.floor(rng() * moeglich.length);
  const i = moeglich[k];
  if (i === -1) {
    const extra = (s.fixExtra ?? []).filter((x) => ersetzen(korrekt, x.von, x.zu) !== korrekt);
    const x = extra[k - (moeglich.length - extra.length)];
    return { falsch: ersetzen(korrekt, x.von, x.zu), richtig: [korrekt], label: x.label };
  }
  const fehler = sauber(s.luecken[i].richtig, s.luecken[i].fehler).filter((f) => f.fix !== false);
  const f = fehler[k - moeglich.indexOf(i)];
  const mit = (w: string) => fuellen(s, rechts.map((r, j) => (j === i ? w : r)));
  // every right form of the gap counts (learnt and learned); first the one closest to the error, it explains it
  const falsch = mit(f.answer);
  const richtig = [...new Set(s.luecken[i].richtig.map(mit))];
  const naechste = closestVersion(richtig, falsch) ?? richtig[0];
  return { falsch, richtig: [naechste, ...richtig.filter((r) => r !== naechste)], label: f.label };
}

/**
 * "Fehler korrigieren": one to three sentences, each with one typical error. Like the other skills
 * (lib/generators.ts correctionTask), harder levels have more sentences.
 */
function korrektur(skillId: string, difficulty: Difficulty, saetze: Satz[], rng: Rng): TaskDraft | null {
  const teile = saetze.map((s) => mitFehler(s, rng)).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!teile.length) return null;
  const n = teile.length;
  // all combinations of the right versions (at most a few: learnt/learned in one sentence)
  const versionen = teile.reduce<string[]>((acc, t) => acc.flatMap((a) => t.richtig.map((r) => (a ? `${a} ${r}` : r))), [""]).slice(0, 24);
  const faulty = teile.map((t) => t.falsch).join(" ");
  return {
    type: "fix",
    skillId,
    category: "korrigieren",
    difficulty,
    prompt: n === 1 ? "Find the mistake and write the sentence correctly." : "Find the mistakes and write the text correctly.",
    data: { faulty },
    answer: {
      accepted: versionen,
      mode: "exact",
      contractions: true,
      fixes: teile.flatMap((t) => expectedFixes(t.falsch, t.richtig[0]).map((f) => ({ ...f, label: t.label, errorType: "grammatik" }))),
      criteria: [n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, "Richtiges wurde nicht verändert."],
    },
    solution: teile.map((t) => `${t.richtig[0]}\n→ ${t.label}`).join("\n"),
    hints: ["Lies Satz für Satz. Passt jedes Wort?", n === 1 ? "Es ist genau ein Fehler." : `Es sind ${n} Fehler, in jedem Satz einer.`],
    errorMap: [],
  };
}

/** Short answer: change a sentence (negative, question, passive …) or give a form. */
function kurzantwort(skillId: string, difficulty: Difficulty, u: Umformung): TaskDraft {
  return {
    type: "grammar",
    skillId,
    difficulty,
    prompt: `${u.auftrag}\n${u.vorlage}`,
    data: {},
    answer: { accepted: u.richtig, mode: "text", contractions: true },
    solution: `${u.richtig[0]}\n${u.regel}`,
    hints: [u.hilfe, u.regel],
    errorMap: sauber(u.richtig, u.fehler).map(({ answer, label }) => ({ answer, label })),
  };
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// ---------- Present Simple ----------
/** Things somebody likes or not, and the pronoun for them ("… but my brothers don't like them"). */
const MOEGEN: [string, string][] = [
  ["horses", "them"],
  ["pizza", "it"],
  ["football", "it"],
  ["maths", "it"],
  ["spiders", "them"],
  ["computer games", "them"],
  ["winter", "it"],
  ["cats", "them"],
  ["fish", "it"],
  ["rap music", "it"],
  ["tomatoes", "them"],
  ["history", "it"],
  ["horror films", "them"],
  ["snow", "it"],
];

const psRegel = (v: Verb, p: Pronomen) =>
  !dritte(p) ? `Bei I, you, we, they bleibt die Grundform: ${v.base}.` : v.base === "have" ? "Bei he, she, it heißt es has." : `${sRegel(v)}: ${v.s}.`;
const psFehler = (v: Verb, p: Pronomen): Fehler[] =>
  dritte(p)
    ? [F(v.base, "„-s“ bei he, she, it vergessen"), F(naivS(v.base), sRegel(v)), F(`${be(p)} ${v.ing}`, "Present Progressive statt Present Simple", { fix: false })]
    : [F(v.s, "„-s“ nur bei he, she, it"), F(`${be(p)} ${v.ing}`, "Present Progressive statt Present Simple", { fix: false })];
const psNichtFehler = (v: Verb, p: Pronomen): Fehler[] => [
  F(`${tunNicht(p)} ${v.s}`, "Nach don't und doesn't steht die Grundform"),
  F(`${dritte(p) ? "don't" : "doesn't"} ${v.base}`, dritte(p) ? "Bei he, she, it: doesn't" : "doesn't nur bei he, she, it"),
  F(`not ${simple(v, p)}`, "Verneinung ohne do oder does"),
  F(`${beNicht(p)} ${v.base}`, "Verneinung mit be statt mit do"),
];
const psFrageFehler = (v: Verb, p: Pronomen): [Fehler[], Fehler[]] => [
  [F(dritte(p) ? "do" : "does", dritte(p) ? "Bei he, she, it fragt man mit does" : "does nur bei he, she, it"), F(be(p), "Frage mit be statt mit do")],
  [F(v.s, "Nach do und does steht die Grundform"), F(v.ing, "„-ing“-Form statt Grundform")],
];
const PS_HILFE = "Wer tut es? Bei he, she, it braucht das Verb ein „-s“.";

type PsArt = "aussage" | "verneinung" | "frage" | "kurz" | "zwei" | "zweiSelbst";
/** A habit with a time phrase; negatives, questions and short answers; two clauses on the hard levels. */
function presentSimpleSatz(rng: Rng, st: Stufe, nur?: "s" | "fragen"): Satz {
  const kind =
    nur === "s"
      ? "aussage"
      : nur === "fragen"
        ? art<PsArt>(rng, { verneinung: 2, frage: 2, kurz: st >= 1 ? 1 : 0, zweiSelbst: st >= 3 ? 1 : 0 })
        : art<PsArt>(rng, { aussage: st === 0 ? 1 : 3, verneinung: st >= 1 ? 1 : 0, frage: st >= 2 ? 1 : 0, zwei: st >= 3 ? 1 : 0 });
  if (kind === "zwei" || kind === "zweiSelbst") {
    const [a, b] = shuffle(rng, MOEGEN);
    const p = person(rng, { kind: true });
    const q = kind === "zweiSelbst" ? p : person(rng, { kind: true, dritte: !dritte(p.p) });
    const v = verb("like");
    return {
      text: `${p.text} ___ ${a[0]}, but ${kind === "zweiSelbst" ? `${pron(p.p)} ___ ${b[0]}` : `${klein(q)} ___ ${a[1]}`}.`,
      luecken: [L(simple(v, p.p), psFehler(v, p.p), "like"), L(`${tunNicht(q.p)} like`, psNichtFehler(v, q.p), "not / like")],
      regel: `${psRegel(v, p.p)} Verneinung: ${tunNicht(q.p)} + Grundform.`,
      hilfe: PS_HILFE,
    };
  }
  // the 3rd person -s: on the harder levels mostly verbs with -es, -ies or has
  const spezial = nur === "s" && st >= 2 && rng() < 0.6;
  const h = handlung(rng, st, "g", spezial ? (x) => verb(x.v).s !== `${x.v}s` : undefined);
  const v = verb(h.v);
  const p = person(rng, { ...werFuer(h), ...(kind === "frage" || kind === "kurz" ? { ohneIch: true } : {}), ...(nur === "s" && rng() < 0.8 ? { dritte: true } : {}) });
  const rest = mit(h.rest, p.p);
  const z = zeit(oft(rng, h));
  if (kind === "verneinung")
    return {
      text: `${p.text} ___ ${rest}${z}.`,
      luecken: [L(`${tunNicht(p.p)} ${v.base}`, psNichtFehler(v, p.p), `not / ${v.base}`)],
      regel: `Verneinung: ${tunNicht(p.p)} + Grundform (${tunNicht(p.p)} ${v.base}).`,
      hilfe: "Verneint wird mit don't oder doesn't. Welche Form hat das Verb danach?",
    };
  if (kind === "frage") {
    const [f1, f2] = psFrageFehler(v, p.p);
    return {
      text: `___ ${klein(p)} ___ ${rest}${z}?`,
      luecken: [L(tun(p.p), f1), L(v.base, f2, v.base)],
      regel: `Frage: ${cap(tun(p.p))} + ${klein(p)} + Grundform (${cap(tun(p.p))} ${klein(p)} ${v.base} …?).`,
      hilfe: "Fragen im Present Simple brauchen do oder does. Welche Form hat das Verb danach?",
    };
  }
  if (kind === "kurz") {
    const ja = rng() < 0.5;
    const ap: Pronomen = p.p === "you" ? "I" : p.p;
    const antwort = ja ? tun(ap) : tunNicht(ap);
    return {
      text: `${cap(tun(p.p))} ${klein(p)} ${v.base} ${rest}? ${ja ? "Yes" : "No"}, ${ap} ___.`,
      luecken: [
        L(
          antwort,
          ja
            ? [F(dritte(ap) ? "do" : "does", dritte(ap) ? "Bei he, she, it: does" : "does nur bei he, she, it"), F(be(ap), "Kurzantwort mit be statt mit do"), F(simple(v, ap), "Die Kurzantwort braucht do oder does", { fix: false })]
            : [F(dritte(ap) ? "don't" : "doesn't", dritte(ap) ? "Bei he, she, it: doesn't" : "doesn't nur bei he, she, it"), F(beNicht(ap), "Kurzantwort mit be statt mit do"), F("not", "Die Kurzantwort braucht don't oder doesn't")],
        ),
      ],
      regel: `Kurzantwort mit dem Hilfsverb der Frage: ${ja ? "Yes" : "No"}, ${ap} ${antwort}.`,
      hilfe: "Schau auf die Frage: Mit welchem Hilfsverb beginnt sie?",
    };
  }
  return { text: `${p.text} ___ ${rest}${z}.`, luecken: [L(simple(v, p.p), psFehler(v, p.p), v.base)], regel: psRegel(v, p.p), hilfe: PS_HILFE };
}

/** Short answers: make the sentence negative, ask a question, or (3rd person -s) start with another subject. */
function presentSimpleKurz(rng: Rng, st: Stufe, nur?: "s" | "fragen"): Umformung {
  const h = handlung(rng, st, "g");
  const v = verb(h.v);
  const z = zeit(oft(rng, h));
  if (nur === "s") {
    const g = handlung(rng, st, "g", (x) => x.bereich !== "tier" && x.bereich !== "beruf");
    const w = verb(g.v);
    const gz = zeit(oft(rng, g));
    const von = pick(rng, PERSONEN.filter((x) => ["I", "We", "You", "They"].includes(x.text)));
    const zu = person(rng, { kind: true, dritte: true });
    const satz = (pers: Person, form: string, poss: Pronomen = pers.p) => `${pers.text} ${form} ${mit(g.rest, poss)}${gz}.`;
    return {
      auftrag: `Write the sentence again. Start with “${zu.text}”.`,
      vorlage: satz(von, simple(w, von.p)),
      richtig: [satz(zu, w.s)],
      fehler: [
        F(satz(zu, w.base), "„-s“ bei he, she, it vergessen"),
        F(satz(zu, naivS(w.base)), sRegel(w)),
        ...(g.rest.includes("{poss}") && POSS[von.p] !== POSS[zu.p] ? [F(satz(zu, w.s, von.p), `Begleiter nicht angepasst: ${POSS[zu.p]} statt ${POSS[von.p]}`)] : []),
      ],
      regel: psRegel(w, zu.p),
      hilfe: "Bei he, she, it bekommt das Verb ein „-s“. Passen my, our … noch?",
    };
  }
  const frage = nur === "fragen" ? rng() < 0.5 : st >= 1 && rng() < 0.5;
  const p = person(rng, { ...werFuer(h), ohneIch: frage, ...(st === 0 ? { dritte: true } : {}) });
  const rest = mit(h.rest, p.p);
  const vorlage = `${p.text} ${simple(v, p.p)} ${rest}${z}.`;
  if (frage)
    return {
      auftrag: "Ask a question.",
      vorlage,
      richtig: [`${cap(tun(p.p))} ${klein(p)} ${v.base} ${rest}${z}?`],
      fehler: [
        F(`${cap(tun(p.p))} ${klein(p)} ${v.s} ${rest}${z}?`, "Nach do und does steht die Grundform"),
        F(`${cap(dritte(p.p) ? "do" : "does")} ${klein(p)} ${v.base} ${rest}${z}?`, dritte(p.p) ? "Bei he, she, it fragt man mit does" : "does nur bei he, she, it"),
        F(`${cap(simple(v, p.p))} ${klein(p)} ${rest}${z}?`, "Frage ohne do oder does (wie im Deutschen)"),
      ],
      regel: `Frage: ${cap(tun(p.p))} + Subjekt + Grundform.`,
      hilfe: "Fragen im Present Simple beginnen mit do oder does.",
    };
  return {
    auftrag: "Make the sentence negative.",
    vorlage,
    richtig: [`${p.text} ${tunNicht(p.p)} ${v.base} ${rest}${z}.`],
    fehler: psNichtFehler(v, p.p).map((f) => F(`${p.text} ${f.answer} ${rest}${z}.`, f.label)),
    regel: `Verneinung: ${tunNicht(p.p)} + Grundform.`,
    hilfe: "Verneint wird mit don't oder doesn't. Welche Form hat das Verb danach?",
  };
}

// ---------- Present Progressive ----------
const progRichtig = (v: Verb, p: Pronomen) => [`${be(p)} ${v.ing}`, ...v.ingAlt.map((x) => `${be(p)} ${x}`)];
const progFehler = (v: Verb, p: Pronomen): Fehler[] => [
  F(v.ing, "am, is oder are vergessen"),
  F(`${be(p)} ${naivIng(v.base)}`, ingRegel(v)),
  F(`${anderesBe(p)} ${v.ing}`, regelBe(p)),
  F(`${be(p)} ${v.base}`, "„-ing“ vergessen"),
  F(simple(v, p), "Present Simple statt Present Progressive", { fix: false }),
];
const PROG_HILFE = "Passiert es gerade jetzt? Dann brauchst du am, is oder are und die „-ing“-Form.";
/** On the harder levels mostly verbs whose -ing form changes (making, running, lying). */
const ingSchwer = (rng: Rng, st: Stufe) => (st >= 2 && rng() < 0.5 ? (x: Handlung) => verb(x.v).ing !== `${x.v}ing` : undefined);
/** "Look! …", "Listen! …" or "… now". */
function jetztRahmen(rng: Rng, h: Handlung): { vorn: string; hinten: string } {
  if (h.laut && rng() < 0.5) return { vorn: "Listen! ", hinten: "" };
  if (!h.drinnen && rng() < 0.4) return { vorn: "Look! ", hinten: "" };
  return { vorn: "", hinten: ` ${pick(rng, JETZT)}` };
}

function progressiveSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { aussage: 3, verneinung: st >= 1 ? 1 : 0, frage: st >= 2 ? 1 : 0, zwei: st >= 3 ? 1 : 0 });
  const h = handlung(rng, st, "j", ingSchwer(rng, st));
  const v = verb(h.v);
  const p = person(rng, { ...werFuer(h), ...(kind === "frage" ? { ohneIch: true } : {}) });
  const rest = mit(h.rest, p.p);
  const regel = `Present Progressive: ${be(p.p)} + „-ing“-Form (${be(p.p)} ${v.ing}).${v.ing !== `${v.base}ing` ? ` ${ingRegel(v)}.` : ""}`;
  if (kind === "verneinung")
    return {
      text: `${p.text} ___ ${rest} ${pick(rng, JETZT)}.`,
      luecken: [
        L(`${beNicht(p.p)} ${v.ing}`, [
          F(`${tunNicht(p.p)} ${v.base}`, "Present Simple statt Present Progressive", { fix: false }),
          F(`not ${v.ing}`, "am, is oder are vergessen"),
          F(`${beNicht(p.p)} ${v.base}`, "„-ing“ vergessen"),
          F(`${anderesBe(p.p)}n't ${v.ing}`, regelBe(p.p)),
        ], `not / ${v.base}`),
      ],
      regel,
      hilfe: "Verneinung: am not, isn't oder aren't und die „-ing“-Form.",
    };
  if (kind === "frage")
    return {
      text: `___ ${klein(p)} ___ ${rest} ${pick(rng, JETZT)}?`,
      luecken: [L(be(p.p), [F(tun(p.p), "Frage mit do statt mit be"), F(anderesBe(p.p), regelBe(p.p))]), L(progRichtig(v, p.p).map((x) => x.split(" ")[1]), [F(v.base, "„-ing“ vergessen"), F(naivIng(v.base), ingRegel(v))], v.base)],
      regel,
      hilfe: "Fragen im Present Progressive beginnen mit am, is oder are.",
    };
  if (kind === "zwei") {
    const h2 = handlung(rng, st, "j", (x) => x.bereich === h.bereich && x.v !== h.v);
    const v2 = verb(h2.v);
    const q = person(rng, { ...werFuer(h2), dritte: !dritte(p.p) });
    return {
      text: `${cap(pick(rng, ["right now", "at the moment"]))} ${klein(p)} ___ ${rest} and ${klein(q)} ___ ${mit(h2.rest, q.p)}.`,
      luecken: [L(progRichtig(v, p.p), progFehler(v, p.p), v.base), L(progRichtig(v2, q.p), progFehler(v2, q.p), v2.base)],
      regel: `Present Progressive: am, is oder are + „-ing“-Form (${be(p.p)} ${v.ing}, ${be(q.p)} ${v2.ing}).`,
      hilfe: PROG_HILFE,
    };
  }
  const r = jetztRahmen(rng, h);
  return { text: `${r.vorn}${p.text} ___ ${rest}${r.hinten}.`, luecken: [L(progRichtig(v, p.p), progFehler(v, p.p), v.base)], regel, hilfe: PROG_HILFE };
}

function progressiveKurz(rng: Rng, st: Stufe): Umformung {
  const h = handlung(rng, st, "j", ingSchwer(rng, st));
  const v = verb(h.v);
  const frage = st >= 1 && rng() < 0.5;
  const p = person(rng, { ...werFuer(h), ohneIch: frage });
  const rest = mit(h.rest, p.p);
  const jetzt = pick(rng, JETZT);
  const vorlage = `${p.text} ${be(p.p)} ${v.ing} ${rest} ${jetzt}.`;
  if (frage)
    return {
      auftrag: "Ask a question.",
      vorlage,
      richtig: [`${cap(be(p.p))} ${klein(p)} ${v.ing} ${rest} ${jetzt}?`],
      fehler: [F(`${cap(tun(p.p))} ${klein(p)} ${v.ing} ${rest} ${jetzt}?`, "Frage mit do statt mit be"), F(`${cap(tun(p.p))} ${klein(p)} ${v.base} ${rest} ${jetzt}?`, "Present Simple statt Present Progressive")],
      regel: "Frage: am, is oder are kommt vor das Subjekt.",
      hilfe: "Stell am, is oder are an den Anfang.",
    };
  return {
    auftrag: "Make the sentence negative.",
    vorlage,
    richtig: [`${p.text} ${beNicht(p.p)} ${v.ing} ${rest} ${jetzt}.`],
    fehler: [F(`${p.text} ${tunNicht(p.p)} ${v.ing} ${rest} ${jetzt}.`, "Verneinung mit do statt mit be"), F(`${p.text} ${tunNicht(p.p)} ${v.base} ${rest} ${jetzt}.`, "Present Simple statt Present Progressive")],
    regel: "Verneinung: am not, isn't oder aren't + „-ing“-Form.",
    hilfe: "Das not kommt nach am, is oder are.",
  };
}

// ---------- Present Simple oder Present Progressive ----------
/** "usually …, but today …": a habit and what is different now. [verb, rest, now, verb, rest, grown-ups only] */
const HEUTE_ANDERS: [string, string, string, string, string, boolean?][] = [
  ["walk", "to school", "today", "take", "the bus"],
  ["have", "lunch at school", "today", "eat", "at home"],
  ["drink", "tea for breakfast", "this morning", "drink", "hot chocolate"],
  ["play", "football after school", "today", "do", "{poss} homework"],
  ["read", "comics", "at the moment", "read", "a book about dinosaurs"],
  ["ride", "{poss} bike to school", "today", "walk", "because it is raining"],
  ["help", "{poss} mum in the kitchen", "right now", "tidy", "{poss} room"],
  ["sleep", "in {poss} own room", "this week", "sleep", "on the sofa"],
  ["wear", "trainers", "today", "wear", "boots because it is snowing"],
  ["watch", "TV in the evening", "at the moment", "play", "cards with {poss} grandma"],
  ["sit", "next to the window", "today", "sit", "in the front row"],
  ["practise", "the piano on Mondays", "this week", "practise", "every day for a concert"],
  ["work", "in Vienna", "this week", "work", "in Linz", true],
  ["cook", "dinner", "today", "order", "a pizza", true],
];
/** Facts: always present simple. [subject, pronoun, verb, rest] */
const FAKTEN: [string, Pronomen, string, string][] = [
  ["Water", "it", "boil", "at 100 degrees Celsius"],
  ["The sun", "it", "rise", "in the east"],
  ["The Danube", "it", "flow", "through Vienna"],
  ["Bees", "they", "make", "honey"],
  ["Spiders", "they", "have", "eight legs"],
  ["A year", "it", "have", "twelve months"],
  ["Most shops in Austria", "they", "close", "on Sundays"],
  ["The school year in Austria", "it", "start", "in September"],
  ["Cows", "they", "eat", "grass"],
  ["It", "it", "snow", "a lot in the Alps in winter"],
  ["The moon", "it", "go", "round the Earth"],
  ["Penguins", "they", "live", "in the south of the world"],
  ["A spider", "it", "have", "eight legs"],
  ["Our school", "it", "start", "at eight o'clock"],
];
const NUR_SIMPLE = "Für Gewohnheiten und Tatsachen steht das Present Simple";
const GERADE_JETZT = "Für das, was gerade passiert, steht das Present Progressive";

function simpleProgressiveSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { gewohnheit: 2, jetzt: 2, heute: st >= 1 ? 2 : 0, fakt: 1, zustand: st >= 2 ? 1 : 0 });
  const hilfe = "Gewohnheit oder Tatsache: Present Simple. Gerade jetzt: Present Progressive. Achte auf die Signalwörter.";
  const simpleL = (v: Verb, p: Pronomen, label = NUR_SIMPLE) =>
    L(simple(v, p), [F(`${be(p)} ${v.ing}`, label), ...psFehler(v, p).filter((f) => f.fix !== false)], v.base);
  const progL = (v: Verb, p: Pronomen) => L(progRichtig(v, p), [F(simple(v, p), GERADE_JETZT), ...progFehler(v, p).filter((f) => f.fix !== false)], v.base);
  if (kind === "heute") {
    const [v1, r1, jetzt, v2, r2, gross] = pick(rng, HEUTE_ANDERS.filter((x) => st >= 2 || !x[5]));
    const p = person(rng, gross ? { erwachsen: true } : { kind: true });
    const a = verb(v1);
    const b = verb(v2);
    return {
      text: `${p.text} usually ___ ${mit(r1, p.p)}, but ${jetzt} ${pron(p.p)} ___ ${mit(r2, p.p)}.`,
      luecken: [simpleL(a, p.p, "Für Gewohnheiten (usually) steht das Present Simple"), progL(b, p.p)],
      regel: `usually: Present Simple (${simple(a, p.p)}). ${cap(jetzt)}: Present Progressive (${be(p.p)} ${b.ing}).`,
      hilfe,
    };
  }
  if (kind === "fakt") {
    const [s, p, v0, rest] = pick(rng, FAKTEN);
    const v = verb(v0);
    return { text: `${s} ___ ${rest}.`, luecken: [simpleL(v, p, "Für Tatsachen steht das Present Simple")], regel: `Eine Tatsache, die immer gilt: Present Simple (${simple(v, p)}).`, hilfe };
  }
  if (kind === "zustand") {
    // "is living" can be right (for a while), so live is no trap here
    const z = nachStufe(rng, ZUSTAENDE.filter((x) => x.v !== "live"), st, (x) => x.stufe);
    const v = verb(z.v);
    const p = person(rng, { kind: true });
    const jetzt = ["want", "need", "know", "understand"].includes(z.v) ? " now" : "";
    return {
      text: `${p.text} ___ ${mit(z.rest, p.p)}${jetzt}.`,
      luecken: [simpleL(v, p.p, `${v.base} ist ein Zustandsverb: keine „-ing“-Form`)],
      regel: `${v.base} beschreibt einen Zustand, keine Handlung: nur Present Simple (${simple(v, p.p)}).`,
      hilfe,
    };
  }
  const h = handlung(rng, st, kind === "jetzt" ? "j" : "g", (x) => x.zeiten.includes("g") && x.zeiten.includes("j"));
  const v = verb(h.v);
  const p = person(rng, werFuer(h));
  const rest = mit(h.rest, p.p);
  if (kind === "jetzt") {
    const r = jetztRahmen(rng, h);
    return { text: `${r.vorn}${p.text} ___ ${rest}${r.hinten}.`, luecken: [progL(v, p.p)], regel: `Gerade jetzt: Present Progressive (${be(p.p)} ${v.ing}).`, hilfe };
  }
  const z = oft(rng, h) || "every day";
  return { text: `${p.text} ___ ${rest} ${z}.`, luecken: [simpleL(v, p.p, "Für Gewohnheiten steht das Present Simple")], regel: `Eine Gewohnheit (${z}): Present Simple (${simple(v, p.p)}).`, hilfe };
}

// ---------- Past Simple ----------
const kleinAnfang = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const ZEIT_VORN = ["Yesterday", "Last week", "Two days ago", "Last Monday", "Last weekend"];
/** Where somebody was: was/were. */
const WAR_ORTE = ["at the cinema", "at home", "at the swimming pool", "ill", "very tired", "late for school", "at the zoo", "in Vienna", "at a birthday party", "very happy"];
const pastRichtig = (v: Verb) => [v.past, ...v.pastAlt];
function pastFehler(v: Verb, p: Pronomen): Fehler[] {
  return [
    ...falschePast(v),
    F(v.base, v.irregular ? "Grundform statt 2. Form" : "„-ed“ vergessen"),
    ...(v.s !== v.base ? [F(v.s, "Present statt Past Simple")] : []),
    F(`${war(p)} ${v.ing}`, "Past Progressive statt Past Simple", { fix: false }),
  ];
}
const pastNichtFehler = (v: Verb): Fehler[] => [
  F(`didn't ${v.past}`, "Nach didn't steht die Grundform"),
  F(`doesn't ${v.base}`, "Present statt Past Simple"),
  F(`not ${v.past}`, "Verneinung ohne did"),
];
const PAST_HILFE = "Signalwörter wie yesterday, last week oder ago zeigen das Past Simple. Ist das Verb unregelmäßig?";

/** Sentences about the past: regular and irregular verbs, was/were, negatives with didn't, questions with did. */
function pastSimpleSatz(rng: Rng, st: Stufe, nurUnregelmaessig = false): Satz {
  const kind = art(rng, { aussage: 4, be: !nurUnregelmaessig && st >= 1 ? 1 : 0, verneinung: st >= 1 ? 1 : 0, frage: st >= 2 ? 1 : 0, zwei: !nurUnregelmaessig && st >= 3 ? 1 : 0 });
  if (kind === "be") {
    const p = person(rng, { kind: true });
    const t = pick(rng, ["yesterday", "last weekend", "last Monday", "two days ago"]);
    const nicht = st >= 2 && rng() < 0.4;
    return {
      text: `${p.text} ___ ${pick(rng, WAR_ORTE)} ${t}.`,
      luecken: [
        nicht
          ? L(`${war(p.p)}n't`, [F(`${anderesWar(p.p)}n't`, regelWar(p.p)), F("didn't be", "Verneinung von was und were ohne did"), F(`${beNicht(p.p)}`, "Present statt Past Simple")], "not / be")
          : L(war(p.p), [F(anderesWar(p.p), regelWar(p.p)), F(be(p.p), "Present statt Past Simple"), F("been", "3. Form statt 2. Form"), F("be", "Grundform statt Past Simple")], "be"),
      ],
      regel: `Past Simple von be: ${regelWar(p.p)}`,
      hilfe: "be hat im Past Simple zwei Formen: was und were.",
    };
  }
  if (kind === "zwei") {
    const h1 = handlung(rng, st, "v", (x) => x.bereich !== "tier" && x.bereich !== "beruf");
    const h2 = handlung(rng, st, "v", (x) => x.bereich !== "tier" && x.bereich !== "beruf" && x.v !== h1.v);
    const [v1, v2] = [verb(h1.v), verb(h2.v)];
    const q = person(rng, { kind: true });
    return {
      text: `${cap(einst(rng, h1))} ${klein(q)} ___ ${mit(h1.rest, q.p)} and then ___ ${mit(h2.rest, q.p)}.`,
      luecken: [L(pastRichtig(v1), pastFehler(v1, q.p), v1.base), L(pastRichtig(v2), pastFehler(v2, q.p), v2.base)],
      regel: `${vergangenheitsRegel(v1)} ${vergangenheitsRegel(v2)}`,
      hilfe: PAST_HILFE,
    };
  }
  // the verb: an irregular one with its own sentence part, or an action of a person
  const ohneIch = kind === "frage";
  const satz = (): { v: Verb; p: Person; rest: string; t: string; vorn: boolean } => {
    if (nurUnregelmaessig || (st >= 1 && rng() < 0.4)) {
      const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.objekt), st, (x) => x.stufe);
      const p = person(rng, u.base === "drive" ? { erwachsen: true } : { kind: true, ohneIch });
      return { v: verb(u.base), p, rest: mit(u.objekt!, p.p), t: pick(rng, ZEIT_VORN), vorn: true };
    }
    const h = handlung(rng, st, "v");
    const p = person(rng, { ...werFuer(h), ohneIch });
    return { v: verb(h.v), p, rest: mit(h.rest, p.p), t: einst(rng, h), vorn: rng() < 0.5 };
  };
  const { v, p, rest, t, vorn } = satz();
  const hinten = kleinAnfang(t);
  const text = (ende = ".") => (vorn ? `${cap(t)} ${klein(p)} ___ ${rest}${ende}` : `${p.text} ___ ${rest} ${hinten}${ende}`);
  if (kind === "verneinung")
    return { text: text(), luecken: [L(`didn't ${v.base}`, pastNichtFehler(v), `not / ${v.base}`)], regel: `Verneinung: didn't + Grundform (didn't ${v.base}).`, hilfe: "Verneint wird mit didn't. Welche Form hat das Verb danach?" };
  if (kind === "frage")
    return {
      text: vorn ? `${cap(t)}, ___ ${klein(p)} ___ ${rest}?` : `___ ${klein(p)} ___ ${rest} ${hinten}?`,
      luecken: [L("did", [F(tun(p.p), "Present statt Past Simple"), F(war(p.p), "Frage mit was statt mit did")]), L(v.base, [F(v.past, "Nach did steht die Grundform")], v.base)],
      regel: `Frage: Did + Subjekt + Grundform (did … ${v.base}).`,
      hilfe: "Fragen im Past Simple beginnen mit did. Welche Form hat das Verb danach?",
    };
  return { text: text(), luecken: [L(pastRichtig(v), pastFehler(v, p.p), v.base)], regel: vergangenheitsRegel(v), hilfe: PAST_HILFE };
}

function pastSimpleKurz(rng: Rng, st: Stufe, nurUnregelmaessig = false): Umformung {
  const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.objekt && (nurUnregelmaessig || x.stufe <= 1)), st, (x) => x.stufe);
  const v = verb(u.base);
  const p = person(rng, u.base === "drive" ? { erwachsen: true } : { kind: true, ohneIch: true });
  const rest = mit(u.objekt!, p.p);
  const t = pick(rng, ZEIT_VORN);
  const vorlage = `${t} ${klein(p)} ${v.past} ${rest}.`;
  if (!nurUnregelmaessig && st >= 1 && rng() < 0.5)
    return {
      auftrag: "Ask a question.",
      vorlage,
      richtig: [`${t}, did ${klein(p)} ${v.base} ${rest}?`, `${t} did ${klein(p)} ${v.base} ${rest}?`, `Did ${klein(p)} ${v.base} ${rest} ${kleinAnfang(t)}?`],
      fehler: [F(`Did ${klein(p)} ${v.past} ${rest} ${kleinAnfang(t)}?`, "Nach did steht die Grundform"), F(`${cap(tun(p.p))} ${klein(p)} ${v.base} ${rest} ${kleinAnfang(t)}?`, "Present statt Past Simple")],
      regel: "Frage: Did + Subjekt + Grundform.",
      hilfe: "Fragen im Past Simple beginnen mit did.",
    };
  return {
    auftrag: "Make the sentence negative.",
    vorlage,
    richtig: [`${t} ${klein(p)} didn't ${v.base} ${rest}.`],
    fehler: pastNichtFehler(v).map((f) => F(`${t} ${klein(p)} ${f.answer} ${rest}.`, f.label)),
    regel: `Verneinung: didn't + Grundform (didn't ${v.base}).`,
    hilfe: "Verneint wird mit didn't. Welche Form hat das Verb danach?",
  };
}

// ---------- Past Progressive ----------
const ppRichtig = (v: Verb, p: Pronomen) => [`${war(p)} ${v.ing}`, ...v.ingAlt.map((x) => `${war(p)} ${x}`)];
const ppFehler = (v: Verb, p: Pronomen): Fehler[] => [
  F(`${anderesWar(p)} ${v.ing}`, regelWar(p)),
  F(`${war(p)} ${v.base}`, "„-ing“ vergessen"),
  F(v.ing, "was oder were vergessen"),
  F(`${war(p)} ${naivIng(v.base)}`, ingRegel(v)),
  F(v.past, "Past Simple statt Past Progressive", { fix: false }),
  F(`${be(p)} ${v.ing}`, "Present Progressive statt Past Progressive"),
];
const PP_HILFE = "Was war zu diesem Zeitpunkt gerade im Gange? was oder were + „-ing“-Form.";

function pastProgressiveSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { aussage: 3, verneinung: st >= 1 ? 1 : 0, frage: st >= 2 ? 1 : 0, wfrage: st >= 2 ? 1 : 0, zwei: st >= 3 ? 1 : 0 });
  const h = handlung(rng, st, "j", ingSchwer(rng, st));
  const v = verb(h.v);
  const p = person(rng, { ...werFuer(h), ...(kind === "frage" || kind === "wfrage" ? { ohneIch: true } : {}) });
  const rest = mit(h.rest, p.p);
  const damals = pick(rng, DAMALS[h.bereich]);
  const regel = `Past Progressive: ${war(p.p)} + „-ing“-Form (${war(p.p)} ${v.ing}).`;
  if (kind === "verneinung")
    return {
      text: `${damals}, ${klein(p)} ___ ${rest}.`,
      luecken: [
        L(`${war(p.p)}n't ${v.ing}`, [
          F(`didn't ${v.base}`, "Past Simple statt Past Progressive", { fix: false }),
          F(`didn't ${v.ing}`, "Verneinung mit did statt mit was oder were"),
          F(`${anderesWar(p.p)}n't ${v.ing}`, regelWar(p.p)),
          F(`not ${v.ing}`, "was oder were vergessen"),
        ], `not / ${v.base}`),
      ],
      regel,
      hilfe: "Verneinung: wasn't oder weren't und die „-ing“-Form.",
    };
  if (kind === "frage")
    return {
      text: `___ ${klein(p)} ___ ${rest} ${kleinAnfang(damals)}?`,
      luecken: [L(war(p.p), [F("did", "Frage mit did statt mit was oder were"), F(anderesWar(p.p), regelWar(p.p))]), L(ppRichtig(v, p.p).map((x) => x.split(" ")[1]), [F(v.base, "„-ing“ vergessen"), F(naivIng(v.base), ingRegel(v))], v.base)],
      regel,
      hilfe: "Fragen im Past Progressive beginnen mit was oder were.",
    };
  if (kind === "wfrage")
    return {
      text: `What ___ ${klein(p)} ___ ${kleinAnfang(damals)}?`,
      luecken: [L(war(p.p), [F("did", "Frage mit did statt mit was oder were"), F(anderesWar(p.p), regelWar(p.p))]), L("doing", [F("do", "„-ing“ vergessen"), F("did", "Past Simple statt Past Progressive")], "do")],
      regel: `Frage: What + ${war(p.p)} + Subjekt + doing?`,
      hilfe: "Nach dem Fragewort kommt was oder were, dann das Subjekt und die „-ing“-Form.",
    };
  if (kind === "zwei") {
    const h2 = handlung(rng, st, "j", (x) => x.bereich === h.bereich && x.v !== h.v);
    const v2 = verb(h2.v);
    const q = person(rng, { ...werFuer(h2), dritte: !dritte(p.p) });
    return {
      text: `${damals}, ${klein(p)} ___ ${rest} and ${klein(q)} ___ ${mit(h2.rest, q.p)}.`,
      luecken: [L(ppRichtig(v, p.p), ppFehler(v, p.p), v.base), L(ppRichtig(v2, q.p), ppFehler(v2, q.p), v2.base)],
      regel: `Past Progressive: was oder were + „-ing“-Form (${war(p.p)} ${v.ing}, ${war(q.p)} ${v2.ing}).`,
      hilfe: PP_HILFE,
    };
  }
  return { text: `${damals}, ${klein(p)} ___ ${rest}.`, luecken: [L(ppRichtig(v, p.p), ppFehler(v, p.p), v.base)], regel, hilfe: PP_HILFE };
}

// ---------- Past Simple oder Past Progressive ----------
type Ereignis = { s: string; p: Pronomen; v: string; rest: string; passt: (h: Handlung) => boolean; stufe: WortStufe };
const E = (s: string, p: Pronomen, v: string, rest: string, passt: (h: Handlung) => boolean = () => true, stufe: WortStufe = 0): Ereignis => ({ s, p, v, rest, passt, stufe });
/** The short action that interrupts: "… when the doorbell rang". {obj} is the person of the long action. */
const EREIGNISSE: Ereignis[] = [
  E("the doorbell", "it", "ring", "", (h) => Boolean(h.drinnen)),
  E("it", "it", "start", "to rain", (h) => !h.drinnen),
  E("Mum", "she", "come", "home", (h) => Boolean(h.drinnen) && h.bereich !== "tier" && h.bereich !== "schule"),
  E("the lights", "they", "go", "out", (h) => Boolean(h.drinnen)),
  E("the phone", "it", "ring", "", (h) => h.bereich !== "tier"),
  E("my friend Tim", "he", "call", "{obj}", (h) => h.bereich !== "tier"),
  E("a bee", "it", "sting", "{obj}", (h) => !h.drinnen && h.bereich !== "tier", 2),
  E("{pron}", "he", "find", "a wallet", (h) => !h.drinnen && ["freizeit", "schule"].includes(h.bereich), 1),
  E("the bell", "it", "ring", "", (h) => h.bereich === "schule"),
  E("{pron}", "he", "hear", "a strange noise", (h) => h.bereich !== "tier", 1),
  E("{pron}", "he", "see", "a fox", (h) => !h.drinnen && h.bereich !== "beruf", 1),
];

function pastSimpleProgressiveSatz(rng: Rng, st: Stufe): Satz {
  const h = handlung(rng, st, "j", (x) => EREIGNISSE.some((e) => e.passt(x) && e.stufe <= WORT[st]));
  const e = pick(rng, EREIGNISSE.filter((x) => x.passt(h) && x.stufe <= WORT[st]));
  const v = verb(h.v);
  const ev = verb(e.v);
  // never the person of the interruption itself ("my friend Tim … when my friend Tim called him")
  const selbst = (x: Person) => new RegExp(`\\b${x.text.replace(/^My /, "")}\\b`, "i").test(e.s) && x.text !== "I" && x.text !== "It";
  let p = person(rng, werFuer(h));
  for (let k = 0; k < 10 && selbst(p); k++) p = person(rng, werFuer(h));
  const rest = mit(h.rest, p.p);
  const es = e.s === "{pron}" ? pron(p.p) : e.s;
  const er = e.rest.replace("{obj}", OBJ[p.p]);
  const lang = L(ppRichtig(v, p.p), [F(v.past, "Die länger dauernde Handlung steht im Past Progressive", { fix: false }), ...ppFehler(v, p.p).filter((f) => f.fix !== false)], v.base);
  const evP = e.s === "{pron}" ? p.p : e.p;
  const kurz = L(pastRichtig(ev), [F(`${war(evP)} ${ev.ing}`, "Die kurze Handlung, die dazwischenkommt, steht im Past Simple", { fix: false }), ...falschePast(ev), F(ev.base, ev.irregular ? "Grundform statt 2. Form" : "„-ed“ vergessen")], ev.base);
  const regel = `Die lange Handlung im Past Progressive (${war(p.p)} ${v.ing}), die kurze, die dazwischenkommt, im Past Simple (${ev.past}).`;
  const hilfe = "Was dauerte länger, was kam kurz dazwischen? Nach while steht meist das Progressive, nach when meist das Simple.";
  const ende = er ? ` ${er}` : "";
  if (st >= 2 && rng() < 0.4)
    return { text: `While ${klein(p)} ___ ${rest}, ${es} ___${ende}.`, luecken: [lang, kurz], regel, hilfe };
  return { text: `${p.text} ___ ${rest} when ${es} ___${ende}.`, luecken: [lang, kurz], regel, hilfe };
}

// ---------- Present Perfect ----------
/** Regular verbs with a sentence part: something done already, something never done. */
const SCHON_REGELMAESSIG: [string, string][] = [
  ["tidy", "{poss} room"],
  ["clean", "the kitchen"],
  ["finish", "{poss} homework"],
  ["wash", "the dishes"],
  ["book", "the tickets for the concert"],
  ["order", "the pizza"],
  ["phone", "{poss} grandma"],
  ["open", "{poss} presents"],
  ["water", "the flowers"],
  ["invite", "all {poss} friends"],
];
const NIE_REGELMAESSIG: [string, string][] = [
  ["visit", "London"],
  ["travel", "by plane"],
  ["try", "sushi"],
  ["play", "golf"],
  ["climb", "a mountain"],
  ["cook", "dinner for the whole family"],
  ["watch", "a horror film"],
  ["touch", "a snake"],
  ["be", "to London"],
  ["be", "on a big ship"],
  ["be", "to the top of a mountain"],
];
/** have/has + participle for a while until now: [verb, rest, since …, for …] */
const DAUER: [string, string, string[], string[]][] = [
  ["live", "in this town", ["2019", "last summer"], ["three years", "a long time", "ten years"]],
  ["know", "{poss} best friend", ["kindergarten", "2020"], ["five years", "a long time"]],
  ["have", "{poss} dog", ["last Christmas", "March"], ["two years", "six months"]],
  ["be", "in the school choir", ["September", "last year"], ["two years", "a few months"]],
  ["learn", "English", ["2021", "the first class"], ["four years", "a long time"]],
  ["play", "the guitar", ["2022", "last summer"], ["three years", "a long time"]],
  ["wait", "for the bus", ["eight o'clock", "half past seven"], ["twenty minutes", "half an hour"]],
  ["be", "ill", ["Monday", "the weekend"], ["three days", "a week"]],
  ["want", "a puppy", ["last summer", "Christmas"], ["a long time", "two years"]],
];
const ppRichtigPerfekt = (v: Verb) => [v.pp, ...v.ppAlt];
const perfektRegel = (v: Verb, p: Pronomen) =>
  `Present Perfect: ${hat(p)} + 3. Form (${hat(p)} ${v.pp}).${v.irregular ? ` ${formen(v)}.` : ""}`;
const hatFehler = (v: Verb, p: Pronomen): Fehler[] => [F(anderesHat(p), regelHat(p)), ...(v.base !== "go" ? [F(be(p), "have oder has, nicht be")] : [])];
const PERF_HILFE = "Present Perfect: have oder has und die 3. Form. Ist das Verb unregelmäßig?";

type Perfekt = { v: Verb; rest: string };
function perfektVerb(rng: Rng, st: Stufe, art: "nie" | "schon", p: Pronomen): Perfekt {
  if (rng() < 0.65) {
    const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.perfekt === art && x.base !== "drive"), st, (x) => x.stufe);
    return { v: verb(u.base), rest: mit(u.objekt!, p) };
  }
  const [b, rest] = pick(rng, art === "nie" ? NIE_REGELMAESSIG : SCHON_REGELMAESSIG);
  return { v: verb(b), rest: mit(rest, p) };
}

function presentPerfectSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { nie: 2, schon: 2, frage: st >= 1 ? 1 : 0, seitfor: st >= 1 ? 1 : 0, yet: st >= 2 ? 1 : 0, seit: st >= 2 ? 1 : 0 });
  if (kind === "seit" || kind === "seitfor") {
    const [b, r, since, fuer] = pick(rng, DAUER);
    const v = verb(b);
    const p = person(rng, { kind: true });
    const mitSince = rng() < 0.5;
    const dauer = pick(rng, mitSince ? since : fuer);
    const rest = mit(r, p.p);
    if (kind === "seitfor")
      return {
        text: `${p.text} ${hat(p.p)} ${v.pp} ${rest} ___ ${dauer}.`,
        luecken: [L(mitSince ? "since" : "for", [F(mitSince ? "for" : "since", mitSince ? "since für einen Zeitpunkt (seit 2019)" : "for für eine Zeitdauer (seit drei Jahren)"), F("from", "seit heißt since oder for")])],
        regel: mitSince ? `since für einen Zeitpunkt: since ${dauer}.` : `for für eine Zeitdauer: for ${dauer}.`,
        hilfe: "Ist es ein Zeitpunkt (since) oder eine Zeitdauer (for)?",
      };
    return {
      text: `${p.text} ___ ${rest} ${mitSince ? "since" : "for"} ${dauer}.`,
      luecken: [
        L(`${hat(p.p)} ${v.pp}`, [
          F(simple(v, p.p), "Present statt Present Perfect (seit: have oder has + 3. Form)"),
          F(v.past, "Past Simple statt Present Perfect"),
          ...(["live", "learn", "play", "wait"].includes(v.base) ? [F(`${be(p.p)} ${v.ing}`, "Present Progressive statt Present Perfect")] : []),
          F(`${anderesHat(p.p)} ${v.pp}`, regelHat(p.p)),
          ...(v.past !== v.pp ? [F(`${hat(p.p)} ${v.past}`, "2. Form statt 3. Form")] : []),
        ], v.base),
      ],
      regel: `Mit since und for für etwas, das bis jetzt andauert: Present Perfect (${hat(p.p)} ${v.pp}).`,
      hilfe: "Seit wann oder wie lange schon? Das ist im Englischen Present Perfect, nicht Present.",
    };
  }
  const p = person(rng, { kind: true, ...(kind === "frage" ? { ohneIch: true } : {}) });
  const { v, rest } = perfektVerb(rng, st, kind === "nie" || kind === "frage" ? "nie" : "schon", p.p);
  const pp = L(ppRichtigPerfekt(v), falschePP(v), v.base);
  const regel = perfektRegel(v, p.p);
  if (kind === "frage")
    return {
      text: `___ ${klein(p)} ever ___ ${rest}?`,
      luecken: [L(hat(p.p), [F(tun(p.p), "Frage mit do statt mit have oder has"), F(anderesHat(p.p), regelHat(p.p))]), pp],
      regel,
      hilfe: PERF_HILFE,
    };
  if (kind === "yet")
    return rng() < 0.5 && p.p !== "I"
      ? { text: `___ ${klein(p)} ___ ${rest} yet?`, luecken: [L(hat(p.p), [F(tun(p.p), "Frage mit do statt mit have oder has"), F(anderesHat(p.p), regelHat(p.p))]), pp], regel, hilfe: PERF_HILFE }
      : {
          text: `${p.text} ___ ${rest} yet.`,
          luecken: [
            L(`${hat(p.p)}n't ${v.pp}`, [
              F(`didn't ${v.base}`, "Mit yet steht das Present Perfect", { fix: false }),
              F(`${anderesHat(p.p)}n't ${v.pp}`, regelHat(p.p)),
              ...(v.past !== v.pp ? [F(`${hat(p.p)}n't ${v.past}`, "2. Form statt 3. Form")] : []),
              F(`${tunNicht(p.p)} ${v.base}`, "Mit yet steht das Present Perfect"),
            ], `not / ${v.base}`),
          ],
          regel: `Verneinung: ${hat(p.p)}n't + 3. Form (${hat(p.p)}n't ${v.pp}).`,
          hilfe: PERF_HILFE,
        };
  const wort = kind === "nie" ? "never" : "already";
  // the easiest level: only the 3rd form
  if (st === 0) return { text: `${p.text} ${hat(p.p)} ${wort} ___ ${rest}.`, luecken: [pp], regel, hilfe: PERF_HILFE };
  return { text: `${p.text} ___ ${wort} ___ ${rest}.`, luecken: [L(hat(p.p), hatFehler(v, p.p)), pp], regel, hilfe: PERF_HILFE };
}

// ---------- going to und will ----------
/** A plan that is already made: [verb, rest, what is done already] */
const PLAENE: [string, string, string][] = [
  ["visit", "{poss} grandparents in Tyrol next weekend", "bought the train tickets"],
  ["have", "a party on Saturday", "invited all {poss} friends"],
  ["paint", "{poss} room blue", "bought the paint"],
  ["buy", "a new bike", "saved enough money"],
  ["travel", "to Italy by train in the summer", "booked the tickets"],
  ["bake", "a cake for Grandma's birthday", "bought the eggs and the flour"],
  ["learn", "the guitar", "found a teacher"],
  ["watch", "the match on Saturday", "got the tickets"],
  ["make", "pancakes for breakfast", "bought the eggs"],
  ["go", "camping in August", "packed the tent"],
];
/** You can see it coming: going to. [text before the gap, subject pronoun, verb, rest] */
const ANZEICHEN: [string, Pronomen, string, string][] = [
  ["Look at those dark clouds! It", "it", "rain", ""],
  ["Be careful! You", "you", "fall", "off the wall"],
  ["Look at the score! Our team", "it", "win", "the match"],
  ["Oh no, the glass is at the edge of the table. It", "it", "fall", ""],
  ["Look at Tom! He is standing on the diving board. He", "he", "jump", "into the pool"],
  ["The sky is very grey. It", "it", "snow", ""],
  ["It's ten to eight and Lena is still at home. She", "she", "be", "late for school"],
];
/**
 * will: a spontaneous decision or a promise. [text before the gap, pronoun, verb, rest, negative]
 * No predictions with „I think“ or „I'm sure“: there going to is right too.
 */
const WILL: [string, Pronomen, string, string, boolean?][] = [
  ["The phone is ringing. I", "I", "answer", "it"],
  ["It's cold in here. I", "I", "close", "the window"],
  ["You look hungry. I", "I", "make", "you a sandwich"],
  ["Your bags look heavy. I", "I", "carry", "them for you"],
  ["Don't worry, I", "I", "tell", "anybody", true],
  ["I promise I", "I", "forget", "your birthday", true],
  ["Wait, I", "I", "help", "you with your bag"],
];

function futureSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { plan: 2, anzeichen: 1, will: 2 });
  const titel = st >= 2 ? undefined : kind === "will" ? "Fill in will." : "Fill in going to.";
  const hilfe = "going to für Pläne und für das, was man schon kommen sieht; will für spontane Entschlüsse und Versprechen.";
  const goingTo = (v: Verb, p: Pronomen, label: string): Luecke =>
    L(`${be(p)} going to ${v.base}`, [
      F(`will ${v.base}`, label, { fix: false }),
      F(`going to ${v.base}`, "am, is oder are vergessen"),
      F(`${be(p)} going ${v.base}`, "to vergessen"),
      F(`${be(p)} going to ${v.s}`, "Nach going to steht die Grundform"),
      F(`${anderesBe(p)} going to ${v.base}`, regelBe(p)),
    ], v.base);
  if (kind === "will") {
    const [vor, p, b, rest, nicht] = pick(rng, WILL);
    const v = verb(b);
    return {
      text: `${vor} ___${rest ? ` ${rest}` : ""}.`,
      luecken: [
        nicht
          ? L(`won't ${v.base}`, [F(`don't ${v.base}`, "Für ein Versprechen steht will (won't)", { fix: false }), F(`won't ${v.s}`, "Nach won't steht die Grundform"), F(`won't to ${v.base}`, "Nach won't kein to"), F(`will not to ${v.base}`, "Nach will kein to")], `not / ${v.base}`)
          : L(`will ${v.base}`, [
              F(`will ${v.s}`, "Nach will steht die Grundform"),
              F(`will to ${v.base}`, "Nach will kein to"),
              F(`${be(p)} going to ${v.base}`, "Spontan entschieden oder versprochen: will", { fix: false }),
              F(simple(v, p), "will vergessen", { fix: false }),
            ], v.base),
      ],
      regel: `will + Grundform (${nicht ? "won't" : "will"} ${v.base}): ${nicht ? "ein Versprechen" : "spontan entschieden"}.`,
      hilfe,
      titel,
    };
  }
  if (kind === "anzeichen") {
    const [vor, p, b, rest] = pick(rng, ANZEICHEN);
    const v = verb(b);
    return {
      text: `${vor} ___${rest ? ` ${rest}` : ""}.`,
      luecken: [goingTo(v, p, "Man sieht es schon kommen: going to")],
      regel: `Man sieht schon, dass es passiert: going to (${be(p)} going to ${v.base}).`,
      hilfe,
      titel,
    };
  }
  const [b, r, schon] = pick(rng, PLAENE);
  const v = verb(b);
  const p = person(rng, { kind: true });
  return {
    text: `${p.text} ___ ${mit(r, p.p)}. ${cap(pron(p.p))} ${hat(p.p)} already ${mit(schon, p.p)}.`,
    luecken: [goingTo(v, p.p, "Ein Plan, der schon feststeht: going to")],
    regel: `Ein Plan, der schon feststeht: going to (${be(p.p)} going to ${v.base}).`,
    hilfe,
    titel,
  };
}


// ---------- to be und there is / there are ----------
/** What follows am, is, are: [text, for animals too] */
const PRAEDIKATE: [string, boolean][] = [
  ["twelve years old", false],
  ["in the garden", true],
  ["at school", false],
  ["very tired", true],
  ["hungry", true],
  ["from Austria", false],
  ["good at maths", false],
  ["late for the bus", false],
  ["in the kitchen", true],
  ["at the swimming pool", false],
  ["really happy today", true],
  ["under the bed", true],
  ["in the same class", false],
  ["ill today", false],
];
/** There is / there are: [what, singular] */
const ES_GIBT: [string, boolean][] = [
  ["two cats in the garden", false],
  ["a big tree in front of our school", true],
  ["twenty-two students in my class", false],
  ["a new girl in our class", true],
  ["some milk in the fridge", true],
  ["three bedrooms in our flat", false],
  ["a swimming pool near our house", true],
  ["a lot of books on the shelf", false],
  ["a spider in the bath", true],
  ["two bakeries in our street", false],
  ["a castle on the hill", true],
  ["many tourists in Salzburg in summer", false],
];
const alleBe = (p: Pronomen): Fehler[] => (["am", "is", "are"] as const).filter((x) => x !== be(p)).map((x) => F(x, regelBe(p)));

function toBeSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { aussage: 3, gibt: 2, verneinung: st >= 1 ? 1 : 0, frage: st >= 1 ? 1 : 0, kurz: st >= 2 ? 1 : 0 });
  const hilfe = "I am, you are, he/she/it is, we are, they are.";
  if (kind === "gibt") {
    const [was, eins] = pick(rng, ES_GIBT);
    const nicht = st >= 3 && rng() < 0.4 && !/^(some|many|a lot)/.test(was);
    const richtig = eins ? (nicht ? "isn't" : "is") : nicht ? "aren't" : "are";
    const anders = eins ? (nicht ? "aren't" : "are") : nicht ? "isn't" : "is";
    return {
      text: `There ___ ${was}.`,
      luecken: [L(richtig, [F(anders, eins ? "there is bei einem Ding" : "there are bei mehreren Dingen"), F(nicht ? "doesn't" : "has", nicht ? "Verneinung von be ohne do" : "es gibt heißt there is oder there are")], nicht ? "not" : undefined)],
      regel: eins ? "Eines: there is." : "Mehrere: there are.",
      hilfe: "Ist es eines oder sind es mehrere?",
    };
  }
  const tierOk = rng() < 0.2;
  const [praed] = pick(rng, PRAEDIKATE.filter(([, t]) => !tierOk || t));
  const p = person(rng, { tier: tierOk, ...(kind === "frage" || kind === "kurz" ? { ohneIch: true } : {}) });
  if (kind === "verneinung")
    return {
      text: `${p.text} ___ ${praed}.`,
      luecken: [L(beNicht(p.p), [F(tunNicht(p.p), "Verneinung von be ohne do"), F(`not`, "am, is oder are vergessen"), F(`${anderesBe(p.p)} not`, regelBe(p.p))], "not")],
      regel: `Verneinung: ${beNicht(p.p)}. ${regelBe(p.p)}`,
      hilfe: "Das not kommt direkt nach am, is oder are.",
    };
  if (kind === "frage")
    return {
      text: `___ ${klein(p)} ${praed}?`,
      luecken: [L(be(p.p), [F(tun(p.p), "Frage mit be ohne do"), ...alleBe(p.p)])],
      regel: `Frage: ${cap(be(p.p))} kommt vor das Subjekt. ${regelBe(p.p)}`,
      hilfe,
    };
  if (kind === "kurz") {
    const ja = rng() < 0.5;
    const ap: Pronomen = p.p === "you" ? "I" : p.p;
    return {
      text: `${cap(be(p.p))} ${klein(p)} ${praed}? ${ja ? "Yes" : "No"}, ${ap} ___.`,
      luecken: [L(ja ? be(ap) : beNicht(ap), ja ? [F(tun(ap), "Kurzantwort mit do statt mit be"), ...alleBe(ap)] : [F(tunNicht(ap), "Kurzantwort mit do statt mit be"), F("not", "am, is oder are vergessen")])],
      regel: `Kurzantwort mit be: ${ja ? "Yes" : "No"}, ${ap} ${ja ? be(ap) : beNicht(ap)}.`,
      hilfe: "Die Frage beginnt mit am, is oder are. Damit antwortest du auch.",
    };
  }
  return { text: `${p.text} ___ ${praed}.`, luecken: [L(be(p.p), [...alleBe(p.p), F("be", "Grundform statt am, is oder are")])], regel: regelBe(p.p), hilfe };
}

// ---------- have got ----------
/** What somebody has got: [thing, for animals too] */
const BESITZ: [string, boolean][] = [
  ["a dog", false],
  ["two brothers", false],
  ["a new bike", false],
  ["blue eyes", true],
  ["long hair", false],
  ["a cold", false],
  ["a lot of friends", false],
  ["a big garden", false],
  ["a tree house", false],
  ["a long tail", true],
  ["a new phone", false],
  ["three cousins in Linz", false],
  ["a headache", false],
  ["a pet rabbit", false],
];

function haveGotSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { aussage: 3, verneinung: st >= 1 ? 2 : 0, frage: st >= 1 ? 1 : 0, kurz: st >= 2 ? 1 : 0 });
  const tierOk = rng() < 0.15;
  const [ding] = pick(rng, BESITZ.filter(([, t]) => !tierOk || t));
  const p = person(rng, { tier: tierOk, ...(kind === "frage" || kind === "kurz" ? { ohneIch: true } : {}) });
  const hilfe = "have got heißt besitzen. Bei he, she, it: has got.";
  if (kind === "verneinung")
    return {
      text: `${p.text} ___ ${ding}.`,
      luecken: [
        L(`${hat(p.p)}n't got`, [F(`${tunNicht(p.p)} have got`, "have got wird ohne do verneint"), F(`${anderesHat(p.p)}n't got`, regelHat(p.p)), F(`${hat(p.p)} not get`, "got vergessen"), F(`${beNicht(p.p)} got`, "have got mit be verwechselt")], "not / have got"),
      ],
      regel: `Verneinung: ${hat(p.p)}n't got.`,
      hilfe,
    };
  if (kind === "frage")
    return {
      text: `___ ${klein(p)} got ${ding}?`,
      luecken: [L(hat(p.p), [F(tun(p.p), "Fragen mit have got ohne do"), F(anderesHat(p.p), regelHat(p.p)), F(be(p.p), "have got mit be verwechselt")])],
      regel: `Frage: ${cap(hat(p.p))} + Subjekt + got …?`,
      hilfe,
    };
  if (kind === "kurz") {
    const ja = rng() < 0.5;
    const ap: Pronomen = p.p === "you" ? "I" : p.p;
    return {
      text: `${cap(hat(p.p))} ${klein(p)} got ${ding}? ${ja ? "Yes" : "No"}, ${ap} ___.`,
      luecken: [
        L(ja ? hat(ap) : `${hat(ap)}n't`, ja ? [F(tun(ap), "Kurzantwort mit have got ohne do"), F(`${hat(ap)} got`, "In der Kurzantwort fällt got weg"), F(anderesHat(ap), regelHat(ap))] : [F(tunNicht(ap), "Kurzantwort mit have got ohne do"), F(`${hat(ap)}n't got`, "In der Kurzantwort fällt got weg"), F(`${anderesHat(ap)}n't`, regelHat(ap))]),
      ],
      regel: `Kurzantwort: ${ja ? "Yes" : "No"}, ${ap} ${ja ? hat(ap) : `${hat(ap)}n't`}. Ohne got.`,
      hilfe: "Die Kurzantwort nimmt have oder has aus der Frage, ohne got.",
    };
  }
  return {
    text: `${p.text} ___ ${ding}.`,
    luecken: [L(`${hat(p.p)} got`, [F(`${anderesHat(p.p)} got`, regelHat(p.p)), F(`${be(p.p)} got`, "have got mit be verwechselt"), F(`${hat(p.p)} get`, "have got: immer got")], "have got")],
    regel: regelHat(p.p).replace("has.", "has got.").replace("have.", "have got."),
    hilfe,
  };
}

// ---------- Plural der Nomen ----------
const PLURAL_REGEL: Record<Nomen["art"], string> = {
  s: "Meist kommt „-s“ dazu",
  es: "Nach s, sh, ch und x kommt „-es“",
  ies: "Konsonant + y wird zu „-ies“",
  ves: "f oder fe wird oft zu „-ves“",
  o: "Diese Wörter auf o bekommen „-es“",
  unr: "Unregelmäßige Mehrzahl",
  gleich: "Diese Mehrzahl ist gleich wie die Einzahl",
};
function pluralFehler(n: Nomen): Fehler[] {
  const out: Fehler[] = [F(n.sg, "Mehrzahl vergessen")];
  const naiv = `${n.sg}s`;
  if (n.art === "s" && /y$/.test(n.sg)) out.push(F(`${n.sg.slice(0, -1)}ies`, "Vokal + y: nur „-s“"));
  if (n.art === "es") out.push(F(naiv, PLURAL_REGEL.es));
  if (n.art === "ies") out.push(F(naiv, PLURAL_REGEL.ies), F(`${n.sg}es`, PLURAL_REGEL.ies));
  if (n.art === "ves") out.push(F(naiv, PLURAL_REGEL.ves));
  if (n.art === "o") out.push(n.pl.endsWith("es") ? F(naiv, PLURAL_REGEL.o) : F(`${n.sg}es`, "photo und piano: nur „-s“"));
  if (n.art === "unr") out.push(F(naiv, `Unregelmäßig: ${n.sg}, ${n.pl}`), F(`${n.pl}s`, `${n.pl} ist schon die Mehrzahl`));
  if (n.art === "gleich") out.push(F(naiv, `${n.sg} bleibt in der Mehrzahl gleich`), ...(n.sg.endsWith("sh") ? [F(`${n.sg}es`, `${n.sg} bleibt in der Mehrzahl gleich`)] : []));
  if (n.art === "s" && /[^aeiouy]$/.test(n.sg)) out.push(F(`${n.sg}es`, "Meist kommt nur „-s“ dazu"));
  return out;
}

function pluralSatz(rng: Rng, st: Stufe): Satz {
  // the harder levels: mostly the special plurals
  const liste = st >= 2 && rng() < 0.75 ? NOMEN.filter((n) => n.art !== "s") : NOMEN;
  const n = nachStufe(rng, liste, st, (x) => x.stufe);
  return {
    text: n.satz,
    luecken: [L(n.pl, pluralFehler(n), n.sg)],
    regel: `${PLURAL_REGEL[n.art]}: ${n.sg}, ${n.pl}.`,
    hilfe: "Wie endet das Wort? s, sh, ch, x, y, f oder o? Oder ist es unregelmäßig?",
  };
}

// ---------- s-Genitiv ----------
type Besitzer = { text: string; art: "einzahl" | "mehrzahl" | "unr"; gross?: boolean };
const BESITZER: Besitzer[] = [
  ...[...MAEDCHENNAMEN, ...BUBENNAMEN].filter((n) => !/s$/.test(n)).map((text): Besitzer => ({ text, art: "einzahl" })),
  { text: "my brother", art: "einzahl" },
  { text: "my sister", art: "einzahl" },
  { text: "my best friend", art: "einzahl" },
  { text: "Mr Wagner", art: "einzahl", gross: true },
  { text: "Ms Berger", art: "einzahl", gross: true },
  { text: "my grandma", art: "einzahl", gross: true },
  { text: "my parents", art: "mehrzahl", gross: true },
  { text: "my grandparents", art: "mehrzahl", gross: true },
  { text: "the girls", art: "mehrzahl" },
  { text: "the boys", art: "mehrzahl" },
  { text: "my cousins", art: "mehrzahl" },
  { text: "the children", art: "unr" },
  { text: "the women", art: "unr", gross: true },
  { text: "the men", art: "unr", gross: true },
];
/** [thing, what is said about it, for grown-ups only] */
const DINGE: [string, string, boolean?][] = [
  ["bike", "red"],
  ["room", "very tidy"],
  ["phone", "on the table"],
  ["school bag", "very heavy"],
  ["jacket", "in the hall"],
  ["dog", "really cute"],
  ["car", "in the garage", true],
  ["house", "next to the school", true],
  ["cat", "on the sofa"],
  ["birthday party", "on Saturday"],
  ["favourite film", "very funny"],
  ["trainers", "under the bed"],
];
const genitiv = (b: Besitzer) => (b.art === "mehrzahl" ? `${b.text}'` : `${b.text}'s`);

function genitivSatz(rng: Rng, st: Stufe): Satz {
  const arten = st === 0 ? ["einzahl"] : st === 1 ? ["einzahl", "mehrzahl"] : ["einzahl", "mehrzahl", "unr", "mehrzahl"];
  const b = pick(rng, BESITZER.filter((x) => arten.includes(x.art)));
  const [ding, aussage] = pick(rng, DINGE.filter(([, , g]) => !g || b.gross));
  const fehler: Fehler[] =
    b.art === "einzahl"
      ? [F(`${b.text}s`, "Apostroph vergessen"), F(`${b.text}'`, "Bei der Einzahl: „'s“"), F(b.text, "„'s“ vergessen")]
      : b.art === "mehrzahl"
        ? [F(`${b.text}'s`, "Mehrzahl auf s: nur der Apostroph"), F(`${b.text.slice(0, -1)}'s`, "Der Apostroph steht nach dem s der Mehrzahl"), F(b.text, "Apostroph vergessen")]
        : [F(`${b.text}s'`, `${b.text.split(" ").pop()} ist schon die Mehrzahl: „'s“`), F(`${b.text}'`, "Unregelmäßige Mehrzahl: „'s“"), F(b.text, "„'s“ vergessen")];
  const vorn = rng() < 0.5;
  const sind = ding === "trainers" ? "are" : "is";
  return {
    text: vorn ? `___ ${ding} ${sind} ${aussage}.` : `${ding === "trainers" ? "These are" : "This is"} ___ ${ding}.`,
    luecken: [L(genitiv(b), fehler, b.text)],
    regel: b.art === "mehrzahl" ? `Mehrzahl auf s: nur der Apostroph (${genitiv(b)} ${ding}).` : `Besitz: „'s“ (${genitiv(b)} ${ding}).`,
    hilfe: "Wem gehört es? Einzahl: „'s“. Mehrzahl auf s: nur der Apostroph.",
    fixExtra: vorn ? [] : [{ von: `${genitiv(b)} ${ding}`, zu: `the ${ding} of ${b.text}`, label: "Bei Personen steht der s-Genitiv" }],
  };
}

// ---------- Präpositionen der Zeit ----------
type ZeitArt = "uhr" | "at" | "on" | "in" | "kein";
const ZEIT_REGEL: Record<ZeitArt, string> = {
  uhr: "Bei Uhrzeiten steht at",
  at: "at night, at Christmas, at lunchtime: mit at",
  on: "Bei Tagen und beim Datum steht on",
  in: "Bei Monaten, Jahreszeiten, Jahren und Tageszeiten steht in",
  kein: "Vor next, last, this, every, tomorrow und yesterday steht keine Präposition",
};
/** [sentence with ___, kind, level] */
const ZEITSAETZE: [string, ZeitArt, WortStufe][] = [
  ["School starts ___ eight o'clock.", "uhr", 0],
  ["We have lunch ___ half past twelve.", "uhr", 0],
  ["The film starts ___ quarter past eight.", "uhr", 1],
  ["I usually go to bed ___ nine o'clock.", "uhr", 0],
  ["The shop closes ___ six o'clock.", "uhr", 0],
  ["Owls hunt ___ night.", "at", 1],
  ["We open our presents ___ Christmas.", "at", 1],
  ["I always feel hungry ___ lunchtime.", "at", 1],
  ["We have a party ___ midnight on New Year's Eve.", "at", 2],
  ["We have PE ___ Monday.", "on", 0],
  ["My birthday is ___ 12th March.", "on", 1],
  ["We go swimming ___ Friday afternoons.", "on", 1],
  ["There is no school ___ Sunday.", "on", 0],
  ["I got a new bike ___ my birthday.", "on", 1],
  ["The concert is ___ Saturday evening.", "on", 1],
  ["We visit Grandma ___ Christmas Day.", "on", 2],
  ["My birthday is ___ July.", "in", 0],
  ["It often snows ___ winter.", "in", 0],
  ["My grandpa was born ___ 1958.", "in", 1],
  ["I do my homework ___ the afternoon.", "in", 0],
  ["We often go to the lake ___ summer.", "in", 0],
  ["Leaves fall from the trees ___ autumn.", "in", 1],
  ["Mozart was born ___ 1756.", "in", 1],
  ["I read in bed ___ the evening.", "in", 0],
  ["We have breakfast ___ seven o'clock.", "uhr", 0],
  ["My party starts ___ three o'clock.", "uhr", 0],
  ["The bus leaves ___ ten past seven.", "uhr", 1],
  ["We get up early ___ the morning.", "in", 0],
  ["We go skiing ___ February.", "in", 0],
  ["It gets dark early ___ December.", "in", 0],
  ["Our music lesson is ___ Wednesday.", "on", 0],
  ["We play football ___ Thursday afternoon.", "on", 1],
  ["My sister was born ___ May.", "in", 0],
  ["We go to the cinema ___ Saturday.", "on", 0],
  ["It is very hot here ___ August.", "in", 0],
  ["The museum is closed ___ Monday.", "on", 0],
  ["We are going to Italy ___ next summer.", "kein", 1],
  ["We have a test ___ tomorrow.", "kein", 1],
  ["I visited my aunt ___ last weekend.", "kein", 1],
  ["We play tennis ___ every Tuesday.", "kein", 2],
  ["Are you free ___ this evening?", "kein", 2],
  ["We moved to Graz ___ last year.", "kein", 2],
];
const ZEIT_RICHTIG: Record<ZeitArt, string> = { uhr: "at", at: "at", on: "on", in: "in", kein: KEIN };

function praepZeitSatz(rng: Rng, st: Stufe): Satz {
  const [text, za] = nachStufe(rng, ZEITSAETZE, st, (x) => x[2]);
  const richtig = ZEIT_RICHTIG[za];
  return {
    text,
    luecken: [L(richtig, (["at", "on", "in"] as const).filter((x) => x !== richtig).map((x) => F(x, ZEIT_REGEL[za])))],
    regel: `${ZEIT_REGEL[za]}.`,
    hilfe: "Uhrzeit: at. Tag und Datum: on. Monat, Jahreszeit, Jahr, Tageszeit: in.",
    ohneLuecke: za === "kein",
  };
}

// ---------- Adverbien der Häufigkeit ----------
const ADVERBIEN: [string, WortStufe][] = [
  ["always", 0],
  ["usually", 0],
  ["often", 0],
  ["sometimes", 0],
  ["never", 0],
  ["rarely", 2],
  ["hardly ever", 2],
];
/** What somebody is (with be): the adverb comes after am, is, are. */
const BE_ZUSTAND = ["late for school", "tired after PE", "hungry after school", "happy on Fridays", "at home on Sundays", "in a hurry in the morning", "nervous before a test", "on time", "in bed before ten"];

function haeufigkeitSatz(rng: Rng, st: Stufe): Satz {
  const [adv] = nachStufe(rng, ADVERBIEN, st, (x) => x[1]);
  const hilfe = "Das Adverb steht vor dem Vollverb, aber nach am, is oder are.";
  if (rng() < (st >= 1 ? 0.4 : 0.25)) {
    const p = person(rng, { kind: true });
    const b = be(p.p);
    return {
      text: `${p.text} ___ ${pick(rng, BE_ZUSTAND)}.`,
      luecken: [L(`${b} ${adv}`, [F(`${adv} ${b}`, "Nach am, is oder are steht das Adverb"), F(adv, "am, is oder are vergessen")], `be / ${adv}`)],
      regel: `Nach am, is oder are steht das Adverb: ${b} ${adv}.`,
      hilfe,
    };
  }
  const h = handlung(rng, st, "g");
  const v = verb(h.v);
  const p = person(rng, werFuer(h));
  return {
    text: `${p.text} ___ ${mit(h.rest, p.p)}.`,
    luecken: [
      L(`${adv} ${simple(v, p.p)}`, [
        F(`${simple(v, p.p)} ${adv}`, "Das Adverb steht vor dem Vollverb"),
        ...(dritte(p.p) ? [F(`${adv} ${v.base}`, "„-s“ bei he, she, it vergessen")] : [F(`${adv} ${v.s}`, "„-s“ nur bei he, she, it")]),
        F(`${be(p.p)} ${adv} ${v.base}`, "Das Adverb braucht kein am, is oder are"),
      ], `${adv} / ${v.base}`),
    ],
    regel: `Das Adverb steht vor dem Vollverb: ${adv} ${simple(v, p.p)}.`,
    hilfe,
  };
}

function haeufigkeitKurz(rng: Rng, st: Stufe): Umformung {
  const [adv] = nachStufe(rng, ADVERBIEN, st, (x) => x[1]);
  const auftrag = `Put “${adv}” in the right place.`;
  if (rng() < 0.4) {
    const p = person(rng, { kind: true });
    const zustand = pick(rng, BE_ZUSTAND);
    const b = be(p.p);
    return {
      auftrag,
      vorlage: `${p.text} ${b} ${zustand}.`,
      richtig: [`${p.text} ${b} ${adv} ${zustand}.`],
      fehler: [F(`${p.text} ${adv} ${b} ${zustand}.`, "Nach am, is oder are steht das Adverb"), F(`${p.text} ${b} ${zustand} ${adv}.`, "Das Adverb steht nach am, is oder are")],
      regel: "Nach am, is oder are steht das Adverb.",
      hilfe: "Steht im Satz am, is oder are?",
    };
  }
  const h = handlung(rng, st, "g");
  const v = verb(h.v);
  const p = person(rng, werFuer(h));
  const form = simple(v, p.p);
  const rest = mit(h.rest, p.p);
  return {
    auftrag,
    vorlage: `${p.text} ${form} ${rest}.`,
    richtig: [`${p.text} ${adv} ${form} ${rest}.`],
    fehler: [F(`${p.text} ${form} ${adv} ${rest}.`, "Das Adverb steht vor dem Vollverb"), F(`${cap(adv)} ${klein(p)} ${form} ${rest}.`, "Das Adverb steht vor dem Vollverb")],
    regel: "Das Adverb steht vor dem Vollverb.",
    hilfe: "Wo steht das Verb? Das Adverb kommt direkt davor.",
  };
}

// ---------- Fragen mit Fragewörtern ----------
const FRAGEWORT: Record<string, string> = {
  where: "wo",
  when: "wann",
  what: "was",
  who: "wer",
  why: "warum",
  how: "wie",
  "how often": "wie oft",
  "what time": "um wie viel Uhr",
  "how many": "wie viele",
  "how much": "wie viel",
  whose: "wessen",
  which: "welcher, welche, welches",
};
/** Questions with do/does: [question word, verb, rest, answer, time for a question about the past (null: none)] */
const W_FRAGEN: [string, string, string, string, string | null][] = [
  ["where", "live", "", "In a small village near Salzburg.", null],
  ["when", "get", "up", "At half past six.", "yesterday"],
  ["what", "have", "for breakfast", "Cornflakes and a banana.", "yesterday"],
  ["how", "get", "to school", "By bus.", "yesterday"],
  ["how often", "play", "tennis", "Twice a week.", null],
  ["what time", "go", "to bed", "At nine o'clock.", "last night"],
  ["why", "like", "maths", "Because it's easy.", null],
  ["what", "want", "for {poss} birthday", "A new skateboard.", null],
  ["where", "spend", "the summer holidays", "At a lake in Carinthia.", "last year"],
  ["how many", "cousins", "", "Five.", null],
  ["when", "practise", "the piano", "After school.", "yesterday"],
  ["what", "do", "at the weekend", "Hiking in the mountains.", ""],
  ["where", "meet", "{poss} friends", "At the park.", "yesterday"],
  ["what", "eat", "for lunch", "Spaghetti.", "yesterday"],
];
/** Questions with be: [question word, rest with {be}, answer, plural] */
const BE_FRAGEN: [string, string, string, boolean][] = [
  ["where", "my keys", "They are on the table.", true],
  ["how old", "your sister", "She is ten.", false],
  ["where", "the bus stop", "It's next to the bakery.", false],
  ["what", "your favourite subject", "It's English.", false],
  ["who", "those boys", "They are my cousins.", true],
  ["why", "you so tired", "Because I went to bed late.", false],
];
/** Questions about the subject, without do: [question word, verb, rest, answer] */
const SUBJEKT_FRAGEN: [string, string, string, string, boolean][] = [
  ["who", "live", "next door", "Mr Wagner lives next door.", false],
  ["who", "teach", "you maths", "Ms Berger teaches us maths.", false],
  ["who", "win", "the match yesterday", "Our team won.", true],
  ["what", "happen", "in the film", "A dog finds its way home.", false],
  ["who", "make", "this cake", "My grandma made it.", true],
  ["who", "eat", "my sandwich", "The dog ate it.", true],
  ["who", "sit", "next to you in class", "Lena sits next to me.", false],
  ["who", "break", "the window", "Tom broke it.", true],
];
const WORT_VERWECHSELT: Record<string, string[]> = {
  where: ["when", "who"],
  when: ["where", "what"],
  what: ["where", "who"],
  who: ["what", "where"],
  why: ["how", "what"],
  how: ["who", "what"],
  "how often": ["how many", "when"],
  "what time": ["what", "where"],
  "how many": ["how much", "how often"],
  "how old": ["how many", "when"],
};

function fragenSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { hilfsverb: 3, fragewort: st >= 1 ? 2 : 1, be: 1, subjekt: st >= 3 ? 1 : 0, vergangenheit: st >= 2 ? 1 : 0 });
  const hilfe = "Fragewort, dann das Hilfsverb (do, does, did oder am, is, are), dann das Subjekt.";
  if (kind === "be") {
    const [w, rest, antwort, mehr] = pick(rng, BE_FRAGEN);
    const b = rest.startsWith("you") ? "are" : mehr ? "are" : "is";
    return {
      text: `${cap(w)} ___ ${rest}? ${antwort}`,
      luecken: [L(b, [F(mehr ? "does" : "do", "Fragen mit be ohne do"), F(b === "is" ? "are" : "is", b === "is" ? "Bei einem Ding oder einer Person: is" : "Bei mehreren und bei you: are")])],
      regel: "Fragen mit be: Fragewort + am, is oder are + Subjekt.",
      hilfe,
    };
  }
  if (kind === "subjekt") {
    const [w, b, rest, antwort, past] = pick(rng, SUBJEKT_FRAGEN);
    const v = verb(b);
    const richtig = past ? v.past : v.s;
    return {
      text: `${cap(w)} ___ ${rest}? ${antwort}`,
      luecken: [L(richtig, [F(`${past ? "did" : "does"} ${v.base}`, "Fragt man nach dem Subjekt, fällt do weg", { fix: false }), F(v.base, past ? "Grundform statt Past Simple" : "Bei who und what als Subjekt: „-s“")], v.base)],
      regel: `Fragt man nach dem Subjekt (${w}?), gibt es kein do: ${cap(w)} ${richtig} …?`,
      hilfe: "Fragst du nach dem, der etwas tut? Dann fällt do weg.",
    };
  }
  const vergangen = kind === "vergangenheit";
  const [w, b, r, antwort, damals] = pick(rng, W_FRAGEN.filter((x) => !vergangen || x[4] !== null));
  const p = person(rng, { kind: true, ohneIch: true });
  const rest = mit(r, p.p);
  // "How many cousins has Lena got?": have got, not do
  if (b === "cousins") {
    return {
      text: `How many cousins ___ ${klein(p)} got? ${antwort}`,
      luecken: [L(hat(p.p), [F(tun(p.p), "have got: Frage ohne do"), F(anderesHat(p.p), regelHat(p.p))])],
      regel: `Mit have got: How many … ${hat(p.p)} … got?`,
      hilfe,
    };
  }
  const v = verb(b);
  const hv = vergangen ? "did" : tun(p.p);
  const ende = `${klein(p)} ${v.base}${rest ? ` ${rest}` : ""}${vergangen && damals ? ` ${damals}` : ""}?`;
  const antwortText = vergangen ? "" : ` ${antwort}`;
  if (kind === "fragewort" && !vergangen)
    return {
      text: `___ ${tun(p.p)} ${ende}${antwortText}`,
      luecken: [L(w, (WORT_VERWECHSELT[w] ?? []).map((x) => F(x, `Fragewort verwechselt: ${w} heißt „${FRAGEWORT[w]}“`)))],
      regel: `${cap(w)} heißt „${FRAGEWORT[w]}“. Die Antwort sagt, wonach gefragt wird.`,
      hilfe: "Lies die Antwort: Wonach wird gefragt?",
    };
  return {
    text: `${cap(w)} ___ ${ende}${antwortText}`,
    luecken: [
      L(hv, vergangen ? [F(tun(p.p), "Present statt Past Simple"), F(war(p.p), "Frage mit was statt mit did")] : [F(dritte(p.p) ? "do" : "does", dritte(p.p) ? "Bei he, she, it: does" : "does nur bei he, she, it"), F(be(p.p), "Frage mit be statt mit do")]),
    ],
    regel: `Fragewort + ${hv} + Subjekt + Grundform: ${cap(w)} ${hv} ${klein(p)} ${v.base} …?`,
    hilfe,
  };
}

function fragenKurz(rng: Rng, st: Stufe): Umformung {
  const [w, b, r] = pick(rng, W_FRAGEN.filter((x) => x[1] !== "cousins"));
  const v = verb(b);
  const p = person(rng, { kind: true, ohneIch: true, ...(st <= 1 ? { dritte: true } : {}) });
  const rest = mit(r, p.p);
  const teile = [klein(p), w, `${v.base}${rest ? ` ${rest}` : ""}`];
  const hv = tun(p.p);
  const ende = rest ? ` ${rest}` : "";
  return {
    auftrag: "Write the question.",
    vorlage: `(${teile.join(" / ")})`,
    richtig: [`${cap(w)} ${hv} ${klein(p)} ${v.base}${ende}?`],
    fehler: [
      F(`${cap(w)} ${klein(p)} ${simple(v, p.p)}${ende}?`, "Hilfsverb do oder does vergessen"),
      F(`${cap(w)} ${hv} ${klein(p)} ${v.s}${ende}?`, "Nach do und does steht die Grundform"),
      F(`${cap(w)} ${simple(v, p.p)} ${klein(p)}${ende}?`, "Wortstellung wie im Deutschen: Fragen brauchen do oder does"),
      F(`${cap(w)} ${dritte(p.p) ? "do" : "does"} ${klein(p)} ${v.base}${ende}?`, dritte(p.p) ? "Bei he, she, it: does" : "does nur bei he, she, it"),
    ],
    regel: "Fragewort + do oder does + Subjekt + Grundform.",
    hilfe: "Beginne mit dem Fragewort. Dann kommt do oder does.",
  };
}

// ---------- Modalverben: can, must, should ----------
/** [verb, rest] for can (and can't on the harder levels) */
const KOENNEN: [string, string][] = [
  ["swim", "very well"],
  ["ride", "a horse"],
  ["play", "the piano"],
  ["speak", "three languages"],
  ["cook", "spaghetti"],
  ["run", "very fast"],
  ["dance", "really well"],
  ["draw", "horses"],
  ["sing", "really well"],
  ["climb", "trees"],
  ["skate", "backwards"],
  ["read", "music"],
];
/** advice: [situation, verb, rest, negative] */
const RATSCHLAG: [string, string, string, boolean][] = [
  ["You have got a cold.", "stay", "in bed", false],
  ["You look tired.", "go", "to bed early", false],
  ["Your room is a mess.", "tidy", "it", false],
  ["The test is tomorrow.", "study", "tonight", false],
  ["It is very cold outside.", "wear", "a warm jacket", false],
  ["Sweets are bad for your teeth.", "eat", "so many sweets", true],
  ["It is late.", "watch", "TV now", true],
  ["You have got a test tomorrow.", "go", "to bed so late", true],
  ["The dog is hungry.", "feed", "it", false],
  ["You don't know the answer.", "ask", "your teacher", false],
];
/** must: [situation, subject, pronoun, verb, rest] */
const PFLICHT: [string, string, Pronomen, string, string][] = [
  ["The film starts in five minutes.", "We", "we", "hurry", ""],
  ["Lena's bus leaves at seven.", "She", "she", "get", "up early"],
  ["My little brother is ill.", "He", "he", "stay", "at home"],
  ["The library closes at six.", "I", "I", "bring", "the books back today"],
  ["Our cat is very hungry.", "We", "we", "feed", "it"],
  ["The test is on Monday.", "Tom", "he", "learn", "the new words"],
  ["It is very late.", "You", "you", "go", "to bed now"],
];

function modalSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { can: 3, should: 2, must: st >= 1 ? 1 : 0, nicht: st >= 1 ? 2 : 0, frage: st >= 2 ? 1 : 0, could: st >= 3 ? 1 : 0 });
  const hilfe = "Nach can, must und should steht die Grundform ohne to. Modalverben haben kein „-s“.";
  const modalL = (m: string, v: Verb, p: Pronomen): Luecke =>
    L(`${m} ${v.base}`, [
      ...(dritte(p) ? [F(`${m}s ${v.base}`, "Modalverben bekommen kein „-s“"), F(`${m} ${v.s}`, "Nach dem Modalverb steht die Grundform")] : []),
      F(`${m} to ${v.base}`, `Nach ${m} kein to`),
      F(`${m} ${v.ing}`, "Nach dem Modalverb steht die Grundform"),
    ], `${m} / ${v.base}`);
  if (kind === "should") {
    const [lage, b, rest, nicht] = pick(rng, RATSCHLAG.filter((x) => st >= 1 || !x[3]));
    const v = verb(b);
    return {
      text: `${lage} You ___ ${rest}.`,
      luecken: [
        nicht
          ? L(`shouldn't ${v.base}`, [F(`don't should ${v.base}`, "Modalverben werden ohne do verneint"), F(`shouldn't to ${v.base}`, "Nach shouldn't kein to"), F(`shouldn't ${v.ing}`, "Nach shouldn't steht die Grundform")], `should / not / ${v.base}`)
          : modalL("should", v, "you"),
      ],
      regel: `should + Grundform für einen Rat: You ${nicht ? "shouldn't" : "should"} ${v.base} …`,
      hilfe,
    };
  }
  if (kind === "must") {
    const [lage, s, p, b, rest] = pick(rng, PFLICHT);
    const v = verb(b);
    return { text: `${lage} ${s} ___${rest ? ` ${rest}` : ""}.`, luecken: [modalL("must", v, p)], regel: `must + Grundform: ${s} must ${v.base}.`, hilfe };
  }
  const [b, rest] = pick(rng, KOENNEN);
  const v = verb(b);
  if (kind === "frage") {
    const p = person(rng, { kind: true, ohneIch: true });
    return {
      text: `___ ${klein(p)} ___ ${rest}?`,
      luecken: [L("can", [F(tun(p.p), "Fragen mit can ohne do"), F(be(p.p), "Fragen mit can ohne be")]), L(v.base, [F(`to ${v.base}`, "Nach can kein to"), F(v.s, "Nach can steht die Grundform"), F(v.ing, "Nach can steht die Grundform")], v.base)],
      regel: "Frage: Can + Subjekt + Grundform, ohne do.",
      hilfe,
    };
  }
  if (kind === "could") {
    const p = person(rng, { erwachsen: true });
    return {
      text: `When ${klein(p)} ${war(p.p)} young, ${pron(p.p)} ___ ${rest}.`,
      luecken: [L(`could ${v.base}`, [F(`can ${v.base}`, "Für die Vergangenheit: could"), F(`could ${v.past}`, "Nach could steht die Grundform"), F(`could to ${v.base}`, "Nach could kein to")], `can / ${v.base}`)],
      regel: `Vergangenheit von can: could + Grundform (could ${v.base}).`,
      hilfe,
    };
  }
  const p = person(rng, { kind: true });
  if (kind === "nicht")
    return {
      text: `${p.text} ___ ${rest}.`,
      luecken: [L(`can't ${v.base}`, [F(`${tunNicht(p.p)} can ${v.base}`, "Modalverben werden ohne do verneint"), F(`can't ${dritte(p.p) ? v.s : v.ing}`, "Nach can't steht die Grundform"), F(`can't to ${v.base}`, "Nach can't kein to")], `can / not / ${v.base}`)],
      regel: `Verneinung: can't (cannot) + Grundform.`,
      hilfe,
    };
  return { text: `${p.text} ___ ${rest}.`, luecken: [modalL("can", v, p.p)], regel: `can + Grundform: ${klein(p)} can ${v.base}.`, hilfe };
}

// ---------- must, mustn't, have to, don't have to ----------
/** [sentence with {S} and ___, kind, subject is he/she/it]; verbot = mustn't, frei = don't have to, pflicht = must/have to */
type MussArt = "verbot" | "frei" | "pflicht" | "musste";
const MUSS: [string, MussArt, boolean][] = [
  ["You ___ use your phone during the test.", "verbot", false],
  ["You ___ swim in this lake. It is dangerous.", "verbot", false],
  ["We ___ be late for the bus.", "verbot", false],
  ["You ___ feed the animals at the zoo.", "verbot", false],
  ["Visitors ___ touch the paintings in the museum.", "verbot", false],
  ["You ___ ride your bike on the footpath. It is only for people on foot.", "verbot", false],
  ["Students ___ run in the corridors. Someone could get hurt.", "verbot", false],
  ["You ___ shout in the hospital. The people there are ill.", "verbot", false],
  ["We ___ cross the road when the light is red.", "verbot", false],
  ["You ___ eat in the computer room. Food is not allowed there.", "verbot", false],
  ["You ___ wash the dishes. We have got a dishwasher.", "frei", false],
  ["I ___ take the bus today. My mum is driving me to school.", "frei", false],
  ["Paul ___ cook dinner tonight. His dad is cooking.", "frei", true],
  ["Emma ___ buy a ticket. Children under six travel for free.", "frei", true],
  ["It is Saturday tomorrow, so I ___ get up early.", "frei", false],
  ["You ___ bring anything. We have got enough food.", "frei", false],
  ["Lena ___ help in the kitchen today. Her brother is doing it.", "frei", true],
  ["There are no school uniforms at our school, so we ___ wear one.", "frei", false],
  ["You ___ pay. The museum is free for children.", "frei", false],
  ["My dad ___ work on Sundays. His office is closed.", "frei", true],
  ["Tom ___ do any homework this weekend. The teacher is ill.", "frei", true],
  ["Lena ___ do her homework before dinner.", "pflicht", true],
  ["In Austria, you ___ go to school for nine years.", "pflicht", false],
  ["My brother ___ wear glasses.", "pflicht", true],
  ["We ___ be quiet in the library.", "pflicht", false],
  ["Yesterday I ___ walk home because I missed the bus.", "musste", false],
  ["Last week Lena ___ stay in bed for three days.", "musste", true],
  ["We ___ wait for an hour at the doctor's yesterday.", "musste", false],
];

function mussSatz(rng: Rng, st: Stufe): Satz {
  const arten: MussArt[] = st === 0 ? ["verbot", "frei"] : ["verbot", "frei", "pflicht", ...(st >= 2 ? (["musste"] as MussArt[]) : [])];
  const [text, ma, er] = pick(rng, MUSS.filter((x) => arten.includes(x[1])));
  const nichtMuessen = er ? "doesn't have to" : "don't have to";
  const hilfe = "mustn't heißt „nicht dürfen“, don't have to heißt „nicht müssen“.";
  if (ma === "verbot")
    return {
      text,
      luecken: [L("mustn't", [F(nichtMuessen, "Ein Verbot: mustn't (don't have to heißt nicht müssen)"), F("don't must", "must wird ohne do verneint"), F("mustn't to", "Nach mustn't kein to")])],
      regel: "Ein Verbot: mustn't (nicht dürfen).",
      hilfe,
      titel: "Fill in mustn't or don't have to.",
    };
  if (ma === "frei")
    return {
      text,
      luecken: [L(nichtMuessen, [F("mustn't", "Es ist nicht nötig: don't have to (mustn't heißt nicht dürfen)"), F(er ? "don't have to" : "doesn't have to", er ? "Bei he, she, it: doesn't have to" : "doesn't nur bei he, she, it"), F(er ? "doesn't has to" : "don't has to", "Nach don't und doesn't: have to")])],
      regel: `Es ist nicht nötig: ${nichtMuessen} (nicht müssen).`,
      hilfe,
      titel: "Fill in mustn't or don't have to.",
    };
  if (ma === "musste")
    return {
      text,
      luecken: [L("had to", [F("must", "must gibt es nicht in der Vergangenheit: had to"), F("have to", "Vergangenheit: had to"), F("musted", "must gibt es nicht in der Vergangenheit: had to")])],
      regel: "Vergangenheit von must und have to: had to.",
      hilfe: "Steht der Satz in der Vergangenheit? must hat keine Vergangenheitsform.",
      titel: "Fill in must, have to or had to.",
    };
  return {
    text,
    luecken: [L(er ? ["has to", "must"] : ["have to", "must"], [F(er ? "have to" : "has to", er ? "Bei he, she, it: has to" : "has to nur bei he, she, it"), F("must to", "Nach must kein to"), F("mustn't", "mustn't heißt nicht dürfen", { fix: false })])],
    regel: `Eine Pflicht: must oder ${er ? "has to" : "have to"}.`,
    hilfe,
    titel: "Fill in must, have to or had to.",
  };
}

// ---------- some und any ----------
type SomeArt = "aussage" | "verneinung" | "frage" | "angebot";
/** [sentence with ___, kind, compound (…thing, …body, …where) or null] */
const SOME_ANY: [string, SomeArt, string | null][] = [
  ["There are ___ apples in the bowl.", "aussage", null],
  ["I have got ___ new friends at my new school.", "aussage", null],
  ["We need ___ eggs for the cake.", "aussage", null],
  ["There is ___ milk in the fridge.", "aussage", null],
  ["I need ___ new pencils.", "aussage", null],
  ["She has got ___ nice posters in her room.", "aussage", null],
  ["We haven't got ___ homework today.", "verneinung", null],
  ["Is there ___ juice in the fridge?", "frage", null],
  ["There isn't ___ bread left.", "verneinung", null],
  ["I haven't got ___ brothers or sisters.", "verneinung", null],
  ["We didn't see ___ animals in the forest.", "verneinung", null],
  ["Have we got ___ cheese?", "frage", null],
  ["Are there ___ shops near your house?", "frage", null],
  ["Did you buy ___ bananas?", "frage", null],
  ["Would you like ___ tea?", "angebot", null],
  ["Can I have ___ water, please?", "angebot", null],
  ["Would you like ___ cookies?", "angebot", null],
  ["I'm hungry. I want to eat ___.", "aussage", "thing"],
  ["There is ___ at the door.", "aussage", "body"],
  ["I can't find my keys ___.", "verneinung", "where"],
  ["Is there ___ in the box?", "frage", "thing"],
  ["I didn't see ___ in the garden.", "verneinung", "body"],
  ["Does ___ want an ice cream?", "frage", "body"],
  ["Let's go ___ nice at the weekend.", "aussage", "where"],
  ["Would you like ___ to drink?", "angebot", "thing"],
];
/** Two gaps in one sentence: often one some and one any ("I've got some apples, but I haven't got any bananas."). */
const SOME_ANY_PAARE: [string, SomeArt, SomeArt][] = [
  ["I've got ___ apples, but I haven't got ___ bananas.", "aussage", "verneinung"],
  ["There is ___ cheese in the fridge, but there isn't ___ butter.", "aussage", "verneinung"],
  ["Have you got ___ pets? Yes, I've got ___ goldfish.", "frage", "aussage"],
  ["We didn't buy ___ bread, but we bought ___ rolls.", "verneinung", "aussage"],
  ["Are there ___ biscuits left? No, there aren't ___ biscuits left.", "frage", "verneinung"],
  ["Mia has got ___ stickers, but she hasn't got ___ posters.", "aussage", "verneinung"],
  ["Is there ___ juice? Yes, there is ___ juice in the fridge.", "frage", "aussage"],
  ["My brother doesn't eat ___ vegetables, but he eats ___ fruit.", "verneinung", "aussage"],
  ["We need ___ eggs. Have we got ___ flour?", "aussage", "frage"],
  ["I didn't get ___ emails today, but I got ___ messages.", "verneinung", "aussage"],
  ["Would you like ___ grapes? There aren't ___ strawberries left.", "angebot", "verneinung"],
  ["Can I have ___ crisps, please? I didn't have ___ lunch today.", "angebot", "verneinung"],
];
const SOME_REGEL: Record<SomeArt, string> = {
  aussage: "In bejahten Sätzen steht some",
  verneinung: "In verneinten Sätzen steht any",
  frage: "In Fragen steht meist any",
  angebot: "Bei Angeboten und Bitten steht some",
};

function someAnySatz(rng: Rng, st: Stufe): Satz {
  if (rng() < (st <= 1 ? 0.4 : 0.2)) {
    const [text, a1, a2] = pick(rng, SOME_ANY_PAARE.filter(([, x, y]) => st >= 1 || (x !== "angebot" && y !== "angebot")));
    const wort = (a: SomeArt) => (a === "aussage" || a === "angebot" ? "some" : "any");
    const luecke = (a: SomeArt) =>
      L(wort(a), [F(wort(a) === "some" ? "any" : "some", SOME_REGEL[a]), ...(a === "verneinung" ? [F("no", "Doppelte Verneinung: nach not steht any")] : [])]);
    return {
      text,
      luecken: [luecke(a1), luecke(a2)],
      regel: `${SOME_REGEL[a1]}: ${wort(a1)}. ${SOME_REGEL[a2]}: ${wort(a2)}.`,
      hilfe: "Bejaht, verneint, Frage oder Angebot? Schau dir jeden Satzteil einzeln an.",
    };
  }
  const liste = SOME_ANY.filter(([, a, c]) => (st >= 2 || !c) && (st >= 1 || a === "aussage" || a === "verneinung" || a === "frage"));
  const [text, sa, c] = pick(rng, st >= 3 ? liste.filter((x) => x[2] || rng() < 0.5) : liste);
  const some = sa === "aussage" || sa === "angebot";
  const wort = (anfang: string) => (c === "body" ? [`${anfang}body`, anfang === "no" ? "no one" : `${anfang}one`] : [`${anfang}${c ?? ""}`]);
  const richtig = wort(some ? "some" : "any");
  return {
    text,
    luecken: [L(richtig, [...wort(some ? "any" : "some").map((x) => F(x, SOME_REGEL[sa])), ...(sa === "verneinung" ? wort("no").map((x) => F(x, "Doppelte Verneinung: nach not steht any")) : [])], c ? `…${c}` : undefined)],
    regel: `${SOME_REGEL[sa]}: ${richtig[0]}.`,
    hilfe: "Bejaht, verneint, Frage oder Angebot?",
  };
}

// ---------- much, many, a lot of ----------
/** [sentence with ___, countable, kind]; frage and verneinung: many/much; aussage: a lot of */
const MENGE: [string, boolean, "frage" | "verneinung" | "aussage"][] = [
  ["How ___ apples do we need?", true, "frage"],
  ["How ___ money have you got?", false, "frage"],
  ["How ___ brothers and sisters have you got?", true, "frage"],
  ["How ___ milk is in the fridge?", false, "frage"],
  ["How ___ time do we have?", false, "frage"],
  ["How ___ people were at the concert?", true, "frage"],
  ["How ___ sugar do you take in your tea?", false, "frage"],
  ["How ___ students are in your class?", true, "frage"],
  ["How ___ cousins have you got?", true, "frage"],
  ["How ___ juice is left?", false, "frage"],
  ["How ___ homework do you get every day?", false, "frage"],
  ["We haven't got ___ bread left.", false, "verneinung"],
  ["There aren't ___ trees in our street.", true, "verneinung"],
  ["My little sister doesn't eat ___ vegetables.", true, "verneinung"],
  ["I didn't get ___ presents for my birthday.", true, "verneinung"],
  ["We haven't got ___ eggs.", true, "verneinung"],
  ["There isn't ___ water in the bottle.", false, "verneinung"],
  ["We haven't got ___ time.", false, "verneinung"],
  ["There aren't ___ people at the pool today.", true, "verneinung"],
  ["I didn't make ___ mistakes in the test.", true, "verneinung"],
  ["There isn't ___ snow this winter.", false, "verneinung"],
  ["My grandpa doesn't drink ___ coffee.", false, "verneinung"],
  ["Lena has got ___ friends.", true, "aussage"],
  ["There is ___ traffic in the city today.", false, "aussage"],
  ["We ate ___ ice cream on holiday.", false, "aussage"],
  ["There are ___ tourists in Salzburg in summer.", true, "aussage"],
  ["I have got ___ homework today.", false, "aussage"],
];

function muchManySatz(rng: Rng, st: Stufe): Satz {
  const [text, zaehlbar, ma] = pick(rng, MENGE.filter((x) => st >= 1 || x[2] !== "aussage"));
  const hilfe = "Kann man es zählen (apples, friends)? Dann many. Nicht zählbar (money, time)? Dann much. In bejahten Sätzen meist a lot of.";
  const art0 = zaehlbar ? "many" : "much";
  if (ma === "aussage")
    return {
      text,
      luecken: [L(["a lot of", "lots of", ...(zaehlbar ? ["many"] : [])], [F("much", zaehlbar ? "much nur bei nicht zählbaren Nomen" : "In bejahten Sätzen steht a lot of"), ...(zaehlbar ? [] : [F("many", "many nur bei zählbaren Nomen")]), F("a lot", "a lot of: of vergessen")])],
      regel: `In bejahten Sätzen meist a lot of${zaehlbar ? " (auch many)" : ""}.`,
      hilfe,
    };
  // a lot of also fits a negative sentence
  return {
    text,
    luecken: [
      L(ma === "frage" ? art0 : [art0, "a lot of"], [
        F(zaehlbar ? "much" : "many", zaehlbar ? "Bei zählbaren Nomen steht many" : "Bei nicht zählbaren Nomen steht much"),
        ma === "frage" ? F("a lot of", "Nach How steht much oder many") : F("a lot", "a lot of: of vergessen"),
      ]),
    ],
    regel: zaehlbar ? "Zählbar: many." : "Nicht zählbar: much.",
    hilfe,
  };
}

// ---------- Steigerung (comparatives, superlatives) ----------
/** [adjective, A, B, what comes after the adjective] for "A is ___ than B." */
const VERGLEICHE: [string, string, string, string?][] = [
  ["tall", "My brother", "my sister"],
  ["tall", "A giraffe", "an elephant"],
  ["small", "A mouse", "a rat"],
  ["old", "My grandpa", "my dad"],
  ["young", "My sister", "me"],
  ["fast", "A cheetah", "a horse"],
  ["cheap", "The bus", "a taxi"],
  ["long", "The Danube", "the Inn"],
  ["short", "A day in winter", "a day in summer"],
  ["cold", "January", "April"],
  ["high", "The Grossglockner", "the Schneeberg"],
  ["strong", "An elephant", "a horse"],
  ["slow", "A snail", "a tortoise"],
  ["nice", "This café", "the one at the station"],
  ["large", "Vienna", "Graz"],
  ["cute", "Our new puppy", "our old dog"],
  ["safe", "The bike path", "the main road"],
  ["big", "An elephant", "a horse"],
  ["hot", "Summer", "spring"],
  ["thin", "My new phone", "my old one"],
  ["sad", "The end of the film", "the beginning"],
  ["wet", "This summer", "last summer"],
  ["happy", "Our dog", "our cat"],
  ["easy", "The maths test", "the English test"],
  ["funny", "This comic", "the film"],
  ["heavy", "My school bag", "my sister's bag"],
  ["busy", "Saturday", "Sunday"],
  ["dirty", "My trainers", "my brother's trainers"],
  ["noisy", "The city", "our village"],
  ["lazy", "Our cat", "our dog"],
  ["interesting", "History", "geography"],
  ["beautiful", "The lake", "the swimming pool"],
  ["expensive", "A new bike", "a skateboard"],
  ["difficult", "Maths", "English"],
  ["dangerous", "A shark", "a dolphin"],
  ["exciting", "Football", "golf"],
  ["famous", "Mozart", "my piano teacher"],
  ["important", "Sleep", "computer games"],
  ["comfortable", "My bed", "the sofa"],
  ["popular", "Football", "handball"],
  ["boring", "The second film", "the first one"],
  ["good", "My new bike", "my old one"],
  ["bad", "The weather today", "yesterday"],
  ["far", "Salzburg", "Linz", " from Vienna"],
];
/** [adjective, sentence with ___] for the superlative */
const SPITZE: [string, string][] = [
  ["tall", "Lena is ___ girl in our class."],
  ["good", "This is ___ day of my life."],
  ["difficult", "Maths is ___ subject for me."],
  ["fast", "The cheetah is ___ land animal in the world."],
  ["big", "The blue whale is ___ animal in the world."],
  ["big", "Vienna is ___ city in Austria."],
  ["high", "The Grossglockner is ___ mountain in Austria."],
  ["cold", "January is often ___ month of the year."],
  ["funny", "This is ___ film I have ever seen."],
  ["easy", "That was ___ test of the year."],
  ["bad", "That was ___ joke of the evening."],
  ["beautiful", "This is ___ beach in Croatia."],
  ["expensive", "This is ___ bike in the shop."],
  ["old", "My grandpa is ___ person in our family."],
  ["happy", "Today is ___ day of my holidays."],
  ["exciting", "That was ___ match of the season."],
];
function komparativFehler(a: Adjektiv): Fehler[] {
  const k = a.komp[0];
  switch (a.art) {
    case "kurz":
      return [F(`more ${a.a}`, "Kurze Adjektive: „-er“"), F(`more ${k}`, "Doppelt gesteigert"), F(a.sup[0], "Superlativ statt Komparativ")];
    case "e":
      return [F(`${a.a}er`, "Endet auf e: nur „-r“"), F(`more ${a.a}`, "Kurze Adjektive: „-r“ oder „-er“"), F(a.sup[0], "Superlativ statt Komparativ")];
    case "doppelt":
      return [F(`${a.a}er`, "Nach kurzem Vokal wird der Endbuchstabe verdoppelt"), F(`more ${a.a}`, "Kurze Adjektive: „-er“"), F(a.sup[0], "Superlativ statt Komparativ")];
    case "y":
      return [F(`${a.a}er`, "y wird zu „-ier“"), F(`more ${a.a}`, "Adjektive auf y: „-ier“"), F(a.sup[0], "Superlativ statt Komparativ")];
    case "lang":
      return [F(`${a.a}er`, "Lange Adjektive: more"), F(`more ${a.a}er`, "Doppelt gesteigert"), F(`most ${a.a}`, "Superlativ statt Komparativ")];
    default:
      return [F(`${a.a}er`, `Unregelmäßig: ${a.a}, ${k}, ${a.sup[0]}`), F(`more ${a.a}`, `Unregelmäßig: ${a.a}, ${k}, ${a.sup[0]}`), F(`more ${k}`, "Doppelt gesteigert"), ...(a.a === "far" ? [] : [F(a.sup[0], "Superlativ statt Komparativ")])];
  }
}
function superlativFehler(a: Adjektiv): Fehler[] {
  const s = a.sup[0];
  const out = [F(s, "the vergessen"), F(`the ${a.komp[0]}`, "Komparativ statt Superlativ")];
  if (a.art === "lang") return [...out, F(`the ${a.a}est`, "Lange Adjektive: the most")];
  if (a.art === "unr") return [...out, F(`the ${a.a}est`, `Unregelmäßig: ${a.a}, ${a.komp[0]}, ${s}`), F(`the most ${a.a}`, `Unregelmäßig: ${a.a}, ${a.komp[0]}, ${s}`)];
  if (a.art === "y") return [...out, F(`the ${a.a}est`, "y wird zu „-iest“")];
  if (a.art === "doppelt") return [...out, F(`the ${a.a}est`, "Nach kurzem Vokal wird der Endbuchstabe verdoppelt")];
  return [...out, F(`the most ${a.a}`, "Kurze Adjektive: the „-est“")];
}

function steigerungSatz(rng: Rng, st: Stufe): Satz {
  const kind = art(rng, { komp: 3, sup: st >= 1 ? 2 : 0, wie: st >= 3 ? 1 : 0 });
  const hilfe = "Kurze Adjektive: „-er“ und „-est“. Lange Adjektive: more und most. good, bad und far sind unregelmäßig.";
  if (kind === "sup") {
    const [a0, text] = nachStufe(rng, SPITZE, st, (x) => adjektiv(x[0]).stufe);
    const a = adjektiv(a0);
    return { text, luecken: [L(a.sup.map((x) => `the ${x}`), superlativFehler(a), a.a)], regel: `Superlativ: the ${a.sup[0]}.`, hilfe };
  }
  const wie = kind === "wie";
  // as … as: "An elephant is not as tall as a giraffe." (B first, so the sentence stays true)
  const [a0, x, y, nach] = nachStufe(rng, VERGLEICHE.filter((v) => !wie || (!v[3] && !["me", "yesterday", "last summer"].includes(v[2]))), st, (v) => adjektiv(v[0]).stufe);
  const a = adjektiv(a0);
  const ist = (s: string) => (/trainers$/.test(s) ? "are" : "is");
  if (wie)
    return {
      text: `${cap(y)} ${ist(y)} not as ___ as ${kleinVorn(x)}.`,
      luecken: [L(a.a, [F(a.komp[0], "Nach as … as steht die Grundform"), F(`more ${a.a}`, "Nach as … as steht die Grundform")], a.a)],
      regel: `as … as: die Grundform (as ${a.a} as).`,
      hilfe: "Bei as … as wird nicht gesteigert.",
    };
  return {
    text: `${x} ${ist(x)} ___${nach ?? ""} than ${y}.`,
    luecken: [L(a.komp, komparativFehler(a), a.a)],
    regel: `Komparativ: ${a.komp.join(" oder ")}.`,
    hilfe,
    fixExtra: [{ von: "than", zu: "then", label: "than (als) mit then (dann) verwechselt" }],
  };
}
/** "The Danube" inside a sentence: "the Danube"; names, months and days keep their capital letter. */
const kleinVorn = (s: string) => (/^(Mozart|Vienna|Graz|Linz|Salzburg|January|April|Saturday|Sunday|English)\b/.test(s) ? s : kleinAnfang(s));

// ---------- if-Sätze Typ 1 und 2 ----------
/** Type 1: [if subject, pronoun, verb, rest, main subject, pronoun, verb, rest, negative in the main clause] */
const IF1: [string, Pronomen, string, string, string, Pronomen, string, string, boolean?][] = [
  ["it", "it", "rain", "tomorrow", "we", "we", "stay", "at home"],
  ["you", "you", "hurry", "", "you", "you", "catch", "the bus"],
  ["Lena", "she", "study", "hard", "she", "she", "pass", "the test"],
  ["we", "we", "miss", "the bus", "we", "we", "be", "late for school"],
  ["you", "you", "eat", "too many sweets", "you", "you", "get", "a stomach ache"],
  ["it", "it", "snow", "at the weekend", "we", "we", "go", "skiing"],
  ["Tom", "he", "feel", "better", "he", "he", "come", "to the party"],
  ["you", "you", "help", "me", "I", "I", "help", "you with your maths homework"],
  ["my parents", "they", "say", "yes", "I", "I", "get", "a puppy"],
  ["it", "it", "rain", "", "we", "we", "play", "football", true],
  ["you", "you", "go", "to bed so late", "you", "you", "be", "tired tomorrow"],
  ["the weather", "it", "be", "nice", "we", "we", "have", "a picnic"],
  ["Grandma", "she", "visit", "us", "she", "she", "bake", "a cake"],
  ["you", "you", "touch", "the dog", "it", "it", "bite", "you"],
  ["Mia", "she", "practise", "every day", "she", "she", "win", "the competition"],
  ["we", "we", "leave", "now", "we", "we", "catch", "the train"],
  ["the bus", "it", "be", "late", "I", "I", "walk", "to school"],
  ["Paul", "he", "forget", "his key", "he", "he", "wait", "outside"],
  ["you", "you", "ask", "nicely", "I", "I", "lend", "you my bike"],
  ["it", "it", "be", "sunny", "we", "we", "go", "to the lake"],
];
/** Type 2: the same, unreal ("If I had more money …"); be: were */
const IF2: [string, Pronomen, string, string, string, Pronomen, string, string][] = [
  ["I", "I", "have", "more money", "I", "I", "buy", "a new bike"],
  ["I", "I", "be", "you", "I", "I", "ask", "the teacher"],
  ["we", "we", "live", "by the sea", "we", "we", "go", "swimming every day"],
  ["Lena", "she", "have", "a dog", "she", "she", "take", "it for a walk every day"],
  ["I", "I", "win", "the lottery", "I", "I", "travel", "around the world"],
  ["I", "I", "be", "a bird", "I", "I", "fly", "over the mountains"],
  ["we", "we", "have", "a garden", "we", "we", "grow", "our own vegetables"],
  ["my dad", "he", "have", "more time", "he", "he", "play", "football with us"],
  ["I", "I", "know", "the answer", "I", "I", "tell", "you"],
  ["it", "it", "be", "warmer", "we", "we", "swim", "in the lake"],
  ["Tom", "he", "live", "in Vienna", "he", "he", "visit", "us more often"],
  ["my sister", "she", "be", "older", "she", "she", "go", "to the concert"],
  ["I", "I", "speak", "Italian", "I", "I", "talk", "to the waiter"],
  ["we", "we", "have", "a car", "we", "we", "drive", "to the lake"],
  ["I", "I", "find", "a wallet", "I", "I", "take", "it to the police"],
  ["Emma", "she", "know", "his number", "she", "she", "call", "him"],
  ["it", "it", "be", "sunny", "we", "we", "have", "a picnic"],
  ["I", "I", "have", "a million euros", "I", "I", "give", "some of it to my friends"],
];

function ifSatz(rng: Rng, st: Stufe, typ: 1 | 2): Satz {
  const zwei = st >= 2 || rng() < 0.3;
  const hinten = st >= 3 && rng() < 0.4;
  const hilfe = typ === 1 ? "Im if-Satz das Present Simple, im Hauptsatz will + Grundform." : "Im if-Satz das Past Simple, im Hauptsatz would + Grundform.";
  let ifL: Luecke;
  let mainL: Luecke;
  let ifForm: string;
  let mainForm: string;
  let s1: string, r1: string, s2: string, r2: string;
  if (typ === 1) {
    const [a, p1, v1b, ra, b, p2, v2b, rb, nicht] = pick(rng, IF1);
    const v1 = verb(v1b);
    const v2 = verb(v2b);
    ifForm = simple(v1, p1);
    mainForm = `${nicht ? "won't" : "will"} ${v2.base}`;
    ifL = L(ifForm, [F(`will ${v1.base}`, "Im if-Satz kein will"), ...(dritte(p1) ? [F(v1.base, v1.base === "be" ? "Bei he, she, it: is" : "„-s“ bei he, she, it vergessen")] : []), F(`would ${v1.base}`, "Im if-Satz kein would")], v1.base);
    mainL = L(mainForm, [F(nicht ? `don't ${v2.base}` : simple(v2, p2), "will vergessen"), F(`${nicht ? "won't" : "will"} ${v2.s}`, "Nach will steht die Grundform"), F(`${nicht ? "won't" : "will"} to ${v2.base}`, "Nach will kein to"), F(`${nicht ? "wouldn't" : "would"} ${v2.base}`, "Typ 2 statt Typ 1")], nicht ? `not / ${v2.base}` : v2.base);
    [s1, r1, s2, r2] = [a, ra, b, rb];
  } else {
    const [a, p1, v1b, ra, b, p2, v2b, rb] = pick(rng, IF2);
    const v1 = verb(v1b);
    const v2 = verb(v2b);
    void p2;
    ifForm = v1.base === "be" ? "were" : v1.past;
    const ifRichtig = v1.base === "be" ? (ra === "you" ? ["were"] : ["were", "was"].filter((x) => x === "were" || p1 === "I" || dritte(p1))) : [v1.past];
    mainForm = `would ${v2.base}`;
    ifL = L(ifRichtig, [F(simple(v1, p1), "Typ 2: im if-Satz das Past Simple"), F(`would ${v1.base}`, "Im if-Satz kein would"), F(`will ${v1.base}`, "Im if-Satz kein will"), ...(ra === "you" ? [F("was", "If I were you: immer were")] : [])], v1.base);
    mainL = L(mainForm, [F(`will ${v2.base}`, "Typ 1 statt Typ 2"), F(`would ${v2.past}`, "Nach would steht die Grundform"), F(v2.past, "would vergessen"), F(`would to ${v2.base}`, "Nach would kein to")], v2.base);
    [s1, r1, s2, r2] = [a, ra, b, rb];
  }
  const regel = typ === 1 ? `if-Satz Typ 1: if + Present Simple (${ifForm}), Hauptsatz will + Grundform (${mainForm}).` : `if-Satz Typ 2: if + Past Simple (${ifForm}), Hauptsatz would + Grundform (${mainForm}).`;
  const ifTeil = (luecke: boolean) => `if ${s1} ${luecke ? "___" : ifForm}${r1 ? ` ${r1}` : ""}`;
  const mainTeil = (luecke: boolean) => `${s2} ${luecke ? "___" : mainForm}${r2 ? ` ${r2}` : ""}`;
  // only one gap on the easy levels: either the if-clause or the main clause
  const imIf = zwei || rng() < 0.5;
  const imMain = zwei || !imIf;
  const luecken = hinten ? [...(imMain ? [mainL] : []), ...(imIf ? [ifL] : [])] : [...(imIf ? [ifL] : []), ...(imMain ? [mainL] : [])];
  return {
    text: hinten ? `${cap(mainTeil(imMain))} ${ifTeil(imIf)}.` : `${cap(ifTeil(imIf))}, ${mainTeil(imMain)}.`,
    luecken,
    regel,
    hilfe,
  };
}

// ---------- Passive (Present Simple und Past Simple) ----------
/** [subject, plural, verb, rest, past, by …] */
const PASSIV: [string, boolean, string, string, boolean, string?][] = [
  ["English", false, "speak", "in many countries", false],
  ["Our classroom", false, "clean", "every evening", false],
  ["These cars", true, "make", "in Graz", false],
  ["The school bus", false, "drive", "", false, "Mr Wagner"],
  ["Pizza", false, "eat", "all over the world", false],
  ["Our lunch", false, "cook", "", false, "Ms Berger"],
  ["Mozart chocolates", true, "sell", "in many shops in Salzburg", false],
  ["The windows", true, "open", "every morning", false],
  ["Many vegetables", true, "grow", "in the south of Austria", false],
  ["The post", false, "bring", "every morning", false],
  ["Football", false, "play", "all over the world", false],
  ["The cows", true, "feed", "twice a day", false],
  ["Bread", false, "sell", "at the bakery", false],
  ["The rubbish", false, "collect", "on Mondays", false],
  ["These T-shirts", true, "wash", "every week", false],
  ["The grass", false, "cut", "", false, "our neighbour"],
  ["Apple strudel", false, "make", "with apples and cinnamon", false],
  ["Many emails", true, "write", "every day", false],
  ["The castle", false, "build", "in 1520", true],
  ["My bike", false, "steal", "last week", true],
  ["The telephone", false, "invent", "", true, "Alexander Graham Bell"],
  ["The window", false, "break", "", true, "a football"],
  ["These photos", true, "take", "in Croatia", true],
  ["The match", false, "win", "", true, "our team"],
  ["The cake", false, "eat", "", true, "the children"],
  ["The thief", false, "catch", "", true, "the police"],
  ["The letters", true, "send", "yesterday", true],
  ["The tickets", true, "buy", "", true, "my dad"],
  ["The presents", true, "hide", "under the bed", true],
  ["This house", false, "build", "", true, "my grandpa"],
  ["The trees", true, "plant", "last spring", true],
  ["The ball", false, "find", "", true, "our dog"],
  ["The song", false, "write", "", true, "my favourite band"],
];

function passivSatz(rng: Rng, st: Stufe): Satz {
  const [s, mehr, b, rest, past, von] = pick(rng, PASSIV.filter((x) => st >= 1 || !x[4]));
  const v = verb(b);
  const hv = past ? (mehr ? "were" : "was") : mehr ? "are" : "is";
  const anders = past ? (mehr ? "was" : "were") : mehr ? "is" : "are";
  const ende = `${rest ? ` ${rest}` : ""}${von ? ` by ${von}` : ""}`;
  return {
    text: `${s} ___${ende}.`,
    luecken: [
      L(`${hv} ${v.pp}`, [
        F(`${hv} ${v.base}`, "3. Form vergessen"),
        F(v.pp, `${hv} vergessen`),
        ...(v.past !== v.pp ? [F(`${hv} ${v.past}`, "2. Form statt 3. Form")] : []),
        ...(v.irregular && naivEd(v.base) !== v.pp ? [F(`${hv} ${naivEd(v.base)}`, "Unregelmäßiges Verb regelmäßig gebildet")] : []),
        F(`${anders} ${v.pp}`, mehr ? "Mehrzahl: are oder were" : "Einzahl: is oder was"),
        F(past ? v.past : simple(v, mehr ? "they" : "it"), "Aktiv statt Passiv"),
      ], v.base),
    ],
    regel: `Passiv: ${hv} + 3. Form (${hv} ${v.pp}).`,
    hilfe: past ? "Passiv in der Vergangenheit: was oder were + 3. Form." : "Passiv: am, is oder are + 3. Form.",
    fixExtra: von ? [{ von: `by ${von}`, zu: `from ${von}`, label: "Wer es tut, steht nach by (nicht from)" }] : [],
    titel: st >= 1 ? "Fill in the passive (present simple or past simple)." : undefined,
  };
}

/** Active into passive: [active subject, verb, object, passive subject, plural, past, rest] */
/** An active sentence for the passive: who does it (inside a sentence), several of them, verb, object, several, past. */
type Aktiv = { wer: string; werMehrere: boolean; v: string; was: string; mehr: boolean; past: boolean };
const A = (wer: string, werMehrere: boolean, v: string, was: string, mehr: boolean, past: boolean): Aktiv => ({ wer, werMehrere, v, was, mehr, past });
const AKTIV: Aktiv[] = [
  A("Mr Wagner", false, "drive", "the school bus", false, false),
  A("my grandma", false, "make", "these cookies", true, false),
  A("the students", true, "clean", "the classroom", false, false),
  A("Ms Berger", false, "teach", "our English class", false, false),
  A("many tourists", true, "visit", "Salzburg", false, false),
  A("the farmer", false, "feed", "the cows", true, false),
  A("my brother", false, "wash", "the car", false, false),
  A("my parents", true, "grow", "the tomatoes", true, false),
  A("our neighbour", false, "cut", "the grass", false, false),
  A("millions of people", true, "speak", "English", false, false),
  A("the police", true, "catch", "the thief", false, true),
  A("my dad", false, "buy", "the tickets", true, true),
  A("Ms Berger", false, "write", "the test", false, true),
  A("the children", true, "eat", "the cake", false, true),
  A("our team", true, "win", "the match", false, true),
  A("a storm", false, "break", "the window", false, true),
  A("Lena", false, "draw", "this picture", false, true),
  A("my uncle", false, "build", "this house", false, true),
  A("a bee", false, "sting", "my sister", false, true),
  A("our dog", false, "find", "the ball", false, true),
];
function passivKurz(rng: Rng, st: Stufe): Umformung {
  const { wer, werMehrere, v: b, was, mehr, past } = pick(rng, AKTIV.filter((x) => st >= 1 || !x.past));
  const v = verb(b);
  const hv = past ? (mehr ? "were" : "was") : mehr ? "are" : "is";
  const aktivForm = past ? v.past : simple(v, werMehrere ? "they" : "it");
  const ps = cap(was);
  return {
    auftrag: "Write the sentence in the passive.",
    vorlage: `${cap(wer)} ${aktivForm} ${was}.`,
    richtig: [`${ps} ${hv} ${v.pp} by ${wer}.`],
    fehler: [
      F(`${ps} ${hv} ${past ? v.past : v.base} by ${wer}.`, "3. Form vergessen"),
      F(`${ps} ${past ? (mehr ? "are" : "is") : mehr ? "were" : "was"} ${v.pp} by ${wer}.`, "Die Zeit bleibt gleich: nur be ändert sich"),
      F(`${ps} ${hv} ${v.pp} from ${wer}.`, "Wer es tut, steht nach by (nicht from)"),
      F(`${ps} ${v.pp} by ${wer}.`, `${hv} vergessen`),
    ],
    regel: `Passiv: Das Objekt wird zum Subjekt, dann ${hv} + 3. Form, wer es tut nach by.`,
    hilfe: "Womit beginnt der Satz im Passiv? Mit dem, was etwas „erleidet“.",
  };
}

// ---------- Reported Speech ----------
/** [direct speech, reported part with {er} {sein} and ___, right answers, errors, rule, level] */
type Bericht = { direkt: string; satz: string; richtig: string[]; fehler: Fehler[]; regel: string; stufe: WortStufe };
const R = (direkt: string, satz: string, richtig: string | string[], fehler: Fehler[], regel: string, stufe: WortStufe = 0): Bericht => ({ direkt, satz, richtig: typeof richtig === "string" ? [richtig] : richtig, fehler, regel, stufe });
const ZURUECK = "Die Zeit rückt zurück";
const BERICHTE: Bericht[] = [
  R("I am hungry.", "{Name} said that {er} ___ hungry.", "was", [F("is", `${ZURUECK}: am wird zu was`, { fix: false }), F("were", "Bei he, she: was")], "am und is werden zu was."),
  R("I like horses.", "{Name} said that {er} ___ horses.", "liked", [F("likes", `${ZURUECK}: Present Simple wird Past Simple`, { fix: false }), F("like", `${ZURUECK}: Present Simple wird Past Simple`)], "Present Simple wird Past Simple."),
  R("I live in Graz.", "{Name} said that {er} ___ in Graz.", "lived", [F("lives", `${ZURUECK}: Present Simple wird Past Simple`, { fix: false }), F("has lived", "Present Simple wird Past Simple")], "Present Simple wird Past Simple."),
  R("I am reading a book.", "{Name} said that {er} ___ a book.", "was reading", [F("is reading", `${ZURUECK}: is reading wird was reading`, { fix: false }), F("read", "Die Verlaufsform bleibt: was reading")], "Present Progressive wird Past Progressive."),
  R("I will help you.", "{Name} said that {er} ___ me.", "would help", [F("will help", `${ZURUECK}: will wird would`, { fix: false }), F("would helped", "Nach would steht die Grundform")], "will wird would.", 1),
  R("I can swim.", "{Name} said that {er} ___.", "could swim", [F("can swim", `${ZURUECK}: can wird could`, { fix: false }), F("could swam", "Nach could steht die Grundform")], "can wird could.", 1),
  R("I lost my keys.", "{Name} said that {er} ___ {sein} keys.", "had lost", [F("lost", `${ZURUECK}: Past Simple wird Past Perfect`, { fix: false }), F("has lost", "Past Perfect: had + 3. Form")], "Past Simple wird Past Perfect (had + 3. Form).", 2),
  R("I have finished my homework.", "{Name} said that {er} ___ {sein} homework.", "had finished", [F("has finished", `${ZURUECK}: has finished wird had finished`, { fix: false }), F("had finish", "Past Perfect: had + 3. Form")], "Present Perfect wird Past Perfect (had + 3. Form).", 2),
  R("I am going to visit my aunt.", "{Name} said that {er} ___ {sein} aunt.", "was going to visit", [F("is going to visit", `${ZURUECK}: is going to wird was going to`, { fix: false }), F("was going to visited", "Nach going to steht die Grundform")], "am going to wird was going to.", 1),
  R("I will call you tomorrow.", "{Name} said that {er} would call me ___.", ["the next day", "the following day"], [F("tomorrow", "tomorrow wird zu the next day", { fix: false }), F("the day before", "the day before heißt am Tag davor")], "tomorrow wird the next day.", 2),
  R("I was ill yesterday.", "{Name} said that {er} had been ill ___.", ["the day before", "the previous day"], [F("yesterday", "yesterday wird zu the day before", { fix: false }), F("the next day", "the next day heißt am nächsten Tag")], "yesterday wird the day before.", 2),
  R("My brother is twelve.", "{Name} said that {sein} brother ___ twelve.", "was", [F("is", `${ZURUECK}: is wird was`, { fix: false }), F("were", "Bei einer Person: was")], "is wird was."),
  R("I don't like spinach.", "{Name} said that {er} ___ spinach.", "didn't like", [F("doesn't like", `${ZURUECK}: doesn't wird didn't`, { fix: false }), F("didn't liked", "Nach didn't steht die Grundform")], "don't und doesn't werden didn't.", 1),
  R("I'm tired.", "{Name} said that ___ was tired.", "{er}", [F("I", "Das Pronomen passt sich an: I wird he oder she")], "Das Pronomen passt sich an: I wird he oder she.", 1),
];
const SAGEN: [string, boolean][] = [
  ["{Name} ___ me that {er} was tired.", true],
  ["{Name} ___ that {er} was tired.", false],
  ["{Name} ___ us that {er} had a new dog.", true],
  ["{Name} ___ that {er} liked the film.", false],
  ["{Name} ___ the teacher that {er} had forgotten {sein} book.", true],
  ["{Name} ___ that it was very cold.", false],
];

/** Who said it: a name or "my sister", never a bare he or she (Report what he said: who is he?). */
function berichtPerson(rng: Rng): { name: string; klein: string; er: string; sein: string } {
  let p = person(rng, { kind: true, dritte: true });
  for (let k = 0; k < 10 && (p.text === "He" || p.text === "She"); k++) p = person(rng, { kind: true, dritte: true });
  const er = p.p === "she" ? "she" : "he";
  return { name: p.text, klein: klein(p), er, sein: POSS[p.p] };
}
const einsetzen = (t: string, b: { name: string; er: string; sein: string }) => t.replace(/\{Name\}/g, b.name).replace(/\{er\}/g, b.er).replace(/\{sein\}/g, b.sein);

function reportedSatz(rng: Rng, st: Stufe): Satz {
  const b = berichtPerson(rng);
  if (st >= 2 && rng() < 0.3) {
    const [t, mitPerson] = pick(rng, SAGEN);
    return {
      text: einsetzen(t, b),
      luecken: [L(mitPerson ? "told" : "said", [F(mitPerson ? "said" : "told", mitPerson ? "Mit Person (me, us): tell, also told me" : "told braucht eine Person (told me)"), F(mitPerson ? "tell" : "say", "Past Simple: said oder told")], "say / tell")],
      regel: mitPerson ? "Mit Person: told me, told us." : "Ohne Person: said.",
      hilfe: "Steht nach dem Verb eine Person (me, us, the teacher)? Dann told, sonst said.",
      titel: "Fill in said or told.",
    };
  }
  const r = nachStufe(rng, BERICHTE, st, (x) => x.stufe);
  return {
    text: `“${r.direkt}” ${einsetzen(r.satz, b)}`,
    luecken: [L(r.richtig.map((x) => einsetzen(x, b)), r.fehler)],
    regel: `${r.regel}`,
    hilfe: "said steht in der Vergangenheit: Die Zeit rückt einen Schritt zurück. Passen die Pronomen?",
  };
}

function reportedKurz(rng: Rng, st: Stufe): Umformung {
  const b = berichtPerson(rng);
  const r = nachStufe(rng, BERICHTE.filter((x) => !x.richtig[0].includes("{") && x.satz.includes("{er} ___")), st, (x) => x.stufe);
  const fertig = (w: string, that = true) => einsetzen(r.satz.replace(" that", that ? " that" : ""), b).replace(GAP, w);
  const richtig = r.richtig.flatMap((w) => [fertig(w), fertig(w, false)]);
  return {
    auftrag: `Report what ${b.klein} said. Start with “${b.name} said” and move the tense one step back.`,
    vorlage: `“${r.direkt}”`,
    richtig,
    fehler: r.fehler.map((f) => F(fertig(f.answer), f.label)).concat([F(einsetzen(r.satz, { ...b, er: "I", sein: "my" }).replace(GAP, r.richtig[0]), "Das Pronomen passt sich an: I wird he oder she")]),
    regel: r.regel,
    hilfe: "said steht in der Vergangenheit: Die Zeit rückt zurück, I wird he oder she.",
  };
}


// ---------- Irregular verbs ----------
const UNR_HILFE = "Unregelmäßige Verben lernst du in drei Formen: Grundform, 2. Form (Past Simple), 3. Form (Past Participle).";

/** A line of the verb table ("go, ___, ___") or a sentence with the 2nd or 3rd form. */
function irregularSatz(rng: Rng, st: Stufe): Satz {
  if (rng() < 0.5) {
    const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.base !== "be"), st, (x) => x.stufe);
    const v = verb(u.base);
    const past = L(pastRichtig(v), [...falschePast(v), F(v.base, "Grundform statt 2. Form")]);
    const pp = L(ppRichtigPerfekt(v), falschePP(v));
    const welche = st >= 2 ? "beide" : st === 1 && rng() < 0.5 ? "pp" : "past";
    return {
      text: welche === "beide" ? `${v.base}, ___, ___` : welche === "past" ? `${v.base}, ___, ${v.pp}` : `${v.base}, ${v.past}, ___`,
      luecken: welche === "beide" ? [past, pp] : welche === "past" ? [past] : [pp],
      regel: `${formen(v)} (${u.de}).`,
      hilfe: UNR_HILFE,
      tabelle: true,
    };
  }
  const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.objekt), st, (x) => x.stufe);
  const v = verb(u.base);
  const p = person(rng, u.base === "drive" ? { erwachsen: true } : { kind: true });
  const rest = mit(u.objekt!, p.p);
  if (st >= 2 && u.perfekt && rng() < 0.5)
    return {
      text: `${p.text} ${hat(p.p)} ${u.perfekt === "nie" ? "never" : "already"} ___ ${rest}.`,
      luecken: [L(ppRichtigPerfekt(v), falschePP(v), v.base)],
      regel: `Nach have oder has steht die 3. Form: ${formen(v)}.`,
      hilfe: UNR_HILFE,
      titel: "Fill in the right form of the verb.",
    };
  return {
    text: `${pick(rng, ZEIT_VORN)} ${klein(p)} ___ ${rest}.`,
    luecken: [L(pastRichtig(v), pastFehler(v, p.p), v.base)],
    regel: `Past Simple: die 2. Form. ${formen(v)}.`,
    hilfe: UNR_HILFE,
    titel: st >= 2 ? "Fill in the right form of the verb." : "Fill in the past simple.",
  };
}

/** Several forms in one answer, with every right variant: "won, won", "won won", "won – won", "won/won" … all count. */
const inFormen = (listen: string[][]) =>
  [", ", " ", " - ", " – ", "/", " / ", "; "].flatMap((sep) => listen.reduce<string[]>((acc, l) => acc.flatMap((a) => l.map((x) => (a ? `${a}${sep}${x}` : x))), [""]));

/** The 2nd or 3rd form of a verb; on the hard levels both. */
function irregularKurz(rng: Rng, st: Stufe): Umformung {
  const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => x.base !== "be"), st, (x) => x.stufe);
  const v = verb(u.base);
  const regel = `${formen(v)}.`;
  if (st >= 3)
    return {
      auftrag: "Write the 2nd and the 3rd form.",
      vorlage: `${v.base} (${u.de})`,
      richtig: inFormen([pastRichtig(v), ppRichtigPerfekt(v)]),
      fehler: [
        ...(v.past !== v.pp ? [F(`${v.pp}, ${v.past}`, "2. und 3. Form vertauscht")] : []),
        ...(naivEd(v.base) !== v.past ? [F(`${naivEd(v.base)}, ${naivEd(v.base)}`, "Unregelmäßiges Verb regelmäßig gebildet")] : []),
        ...(v.past !== v.pp ? [F(`${v.past}, ${v.past}`, "2. Form statt 3. Form")] : []),
      ],
      regel,
      hilfe: UNR_HILFE,
    };
  const pp = st >= 1 && rng() < 0.5;
  return {
    auftrag: pp ? "Write the 3rd form (past participle)." : "Write the 2nd form (past simple).",
    vorlage: `${v.base} (${u.de})`,
    richtig: pp ? ppRichtigPerfekt(v) : pastRichtig(v),
    fehler: pp ? falschePP(v) : [...falschePast(v), F(v.base, "Grundform statt 2. Form")],
    regel,
    hilfe: UNR_HILFE,
  };
}

/** German meanings that are easily mixed up with another English verb. */
const VERWECHSELTE_BEDEUTUNG: Record<string, Fehler[]> = {
  get: [F("become", "False Friend: become heißt werden")],
  become: [F("will", "will steht für die Zukunft; etwas werden heißt become")],
  lend: [F("borrow", "borrow heißt sich etwas ausborgen")],
  learn: [F("teach", "teach heißt lehren")],
  teach: [F("learn", "learn heißt lernen")],
  do: [F("make", "make heißt herstellen, z. B. einen Kuchen")],
  make: [F("do", "do heißt tun, z. B. die Hausübung")],
  wear: [F("carry", "carry heißt schleppen, etwas Schweres tragen")],
  lie: [F("lay", "lay heißt legen")],
  lay: [F("lie", "lie heißt liegen")],
  drive: [F("ride", "ride heißt reiten oder Rad fahren")],
  ride: [F("drive", "drive heißt mit dem Auto fahren")],
  hear: [F("listen", "listen heißt zuhören")],
  meet: [F("hit", "hit heißt schlagen oder treffen (mit dem Ball)")],
  think: [F("thank", "thank heißt danken")],
};
/** Verbs with a German meaning that fits other English verbs as well (hinlegen: put, lay, set): not asked. */
const NICHT_UEBERSETZEN = new Set(["put", "set", "hit", "lead", "rise"]);

/** German to English: the irregular verb (from the 4th level with its three forms). */
function irregularUebersetzen(rng: Rng, st: Stufe): Umformung {
  const alleDrei = st >= 3;
  const u = nachStufe(rng, UNREGELMAESSIG.filter((x) => !NICHT_UEBERSETZEN.has(x.base) && !(alleDrei && x.base === "be")), st, (x) => x.stufe);
  const v = verb(u.base);
  const falsch = VERWECHSELTE_BEDEUTUNG[u.base] ?? [];
  if (alleDrei)
    return {
      auftrag: "Which irregular verb is it? Write its three forms in English.",
      vorlage: u.de,
      richtig: inFormen([[v.base, `to ${v.base}`], pastRichtig(v), ppRichtigPerfekt(v)]),
      fehler: [
        ...falsch.map((f) => F(f.answer, f.label)),
        ...(naivEd(v.base) !== v.past ? [F(`${v.base}, ${naivEd(v.base)}, ${naivEd(v.base)}`, "Unregelmäßiges Verb regelmäßig gebildet")] : []),
      ],
      regel: `${u.de}: ${formen(v)}.`,
      hilfe: "Es ist ein unregelmäßiges Verb. Denk an einen Satz, in dem du es verwendest.",
    };
  return {
    auftrag: "Which irregular verb is it? Write the English base form.",
    vorlage: u.de,
    richtig: [v.base, `to ${v.base}`],
    fehler: [...falsch, F(v.past, "2. Form statt Grundform"), ...(v.pp !== v.past && v.pp !== v.base ? [F(v.pp, "3. Form statt Grundform")] : [])],
    regel: `${u.de}: ${formen(v)}.`,
    hilfe: "Es ist ein unregelmäßiges Verb. Denk an einen Satz, in dem du es verwendest.",
  };
}

// ---------- the skills ----------
const FAEHIGKEITEN: Record<string, Faehigkeit> = {
  "englisch.tenses.presentsimple": { titel: T("Fill in the present simple."), wahl: T("Choose the present simple form."), satz: (r, s) => presentSimpleSatz(r, s), kurz: (r, s) => presentSimpleKurz(r, s) },
  "englisch.tenses.presentsimple.s": { titel: T("Fill in the present simple."), wahl: T("Choose the present simple form."), satz: (r, s) => presentSimpleSatz(r, s, "s"), kurz: (r, s) => presentSimpleKurz(r, s, "s") },
  "englisch.tenses.presentsimple.fragen": { titel: T("Fill in the present simple."), wahl: T("Choose the right form."), satz: (r, s) => presentSimpleSatz(r, s, "fragen"), kurz: (r, s) => presentSimpleKurz(r, s, "fragen") },
  "englisch.tenses.presentprogressive": { titel: T("Fill in the present progressive."), wahl: T("Choose the present progressive form."), satz: progressiveSatz, kurz: progressiveKurz },
  "englisch.tenses.simple-progressive": {
    titel: (st) => (st >= 3 ? "Fill in the right form of the verb." : "Present simple or present progressive? Fill in the right form."),
    wahl: T("Choose the right form."),
    satz: simpleProgressiveSatz,
  },
  "englisch.tenses.pastsimple": { titel: T("Fill in the past simple."), wahl: T("Choose the past simple form."), satz: (r, s) => pastSimpleSatz(r, s), kurz: (r, s) => pastSimpleKurz(r, s) },
  "englisch.tenses.pastsimple.irregular": { titel: T("Fill in the past simple."), wahl: T("Choose the past simple form."), satz: (r, s) => pastSimpleSatz(r, s, true), kurz: (r, s) => pastSimpleKurz(r, s, true) },
  "englisch.tenses.pastprogressive": { titel: T("Fill in the past progressive."), wahl: T("Choose the past progressive form."), satz: pastProgressiveSatz },
  "englisch.tenses.past-simple-progressive": {
    titel: (st) => (st >= 3 ? "Fill in the right form of the verbs." : "Past simple or past progressive? Fill in the right forms."),
    wahl: T("Choose the right forms."),
    satz: pastSimpleProgressiveSatz,
  },
  "englisch.tenses.presentperfect": { titel: T("Fill in the present perfect."), wahl: T("Choose the right form."), satz: presentPerfectSatz },
  "englisch.tenses.future": { titel: T("Fill in will or going to."), wahl: T("Choose the right form."), satz: futureSatz },
  "englisch.grammar.tobe": { titel: T("Fill in am, is or are."), wahl: T("Choose the right form."), satz: toBeSatz },
  "englisch.grammar.havegot": { titel: T("Fill in the right form of have got."), wahl: T("Choose the right form."), satz: haveGotSatz },
  "englisch.grammar.plural": { titel: T("Write the plural."), wahl: T("Choose the right plural."), satz: pluralSatz },
  "englisch.grammar.genitiv": { titel: T("Fill in the possessive form ('s or ')."), wahl: T("Choose the right form."), satz: genitivSatz },
  "englisch.grammar.praep-zeit": { titel: T("Fill in at, on or in."), wahl: T("Choose the right preposition."), satz: praepZeitSatz },
  "englisch.grammar.haeufigkeit": { titel: T("Fill in the words in the right order."), wahl: T("Choose the right word order."), satz: haeufigkeitSatz, kurz: haeufigkeitKurz },
  "englisch.grammar.fragen": { titel: T("Fill in the missing word."), wahl: T("Choose the right word."), satz: fragenSatz, kurz: fragenKurz },
  "englisch.grammar.modal-basics": { titel: T("Fill in the modal verb and the verb."), wahl: T("Choose the right form."), satz: modalSatz },
  "englisch.grammar.modal-must": { titel: T("Fill in the right modal verb."), wahl: T("Choose the right modal verb."), satz: mussSatz },
  "englisch.grammar.someany": { titel: (st) => (st >= 2 ? "Fill in some or any (or a word like something or anything)." : "Fill in some or any."), wahl: T("Choose the right word."), satz: someAnySatz },
  "englisch.grammar.muchmany": { titel: T("Fill in much, many or a lot of."), wahl: T("Choose the right word."), satz: muchManySatz },
  "englisch.grammar.comparatives": { titel: T("Fill in the right form of the adjective."), wahl: T("Choose the right form."), satz: steigerungSatz },
  "englisch.grammar.if1": { titel: T("Fill in the verbs (if-clause type 1)."), wahl: T("Choose the right forms."), satz: (r, s) => ifSatz(r, s, 1) },
  "englisch.grammar.if2": { titel: T("Fill in the verbs (if-clause type 2)."), wahl: T("Choose the right forms."), satz: (r, s) => ifSatz(r, s, 2) },
  "englisch.grammar.passive": { titel: T("Fill in the passive (present simple)."), wahl: T("Choose the passive form."), satz: passivSatz, kurz: passivKurz },
  "englisch.grammar.reported": { titel: T("Report what they said. Move the tense one step back."), wahl: T("Report what they said. Move the tense one step back."), satz: reportedSatz, kurz: reportedKurz },
  "englisch.vocab.irregular": { titel: T("Fill in the missing forms."), wahl: T("Choose the right form."), satz: irregularSatz, kurz: irregularKurz, uebersetzen: irregularUebersetzen, standard: "kurz" },
};

/** How a task is answered: gap text, multiple choice, Fehler korrigieren, short answer, German to English. */
export type EnglischFormat = "cloze" | "mc" | "fix" | "kurz" | "uebersetzen";

export const istEnglischGrammatik = (skillId: string | null | undefined): boolean => Boolean(skillId && FAEHIGKEITEN[skillId]);
/** The skills with built-in English grammar tasks. */
export const ENGLISCH_GRAMMATIK_IDS = Object.keys(FAEHIGKEITEN);
/** The formats a skill has: every one has gap text, multiple choice and correction; some a short answer or translation. */
export function englischFormate(skillId: string): EnglischFormat[] {
  const f = FAEHIGKEITEN[skillId];
  return f ? ["cloze", "mc", "fix", ...(f.kurz ? (["kurz"] as const) : []), ...(f.uebersetzen ? (["uebersetzen"] as const) : [])] : [];
}

/** One task of a skill in a format; null when the skill does not have the format. */
export function englischAufgabe(skillId: string, format: EnglischFormat, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  if (!f) return null;
  const st = STUFE[difficulty];
  if (format === "kurz") return f.kurz ? kurzantwort(skillId, difficulty, f.kurz(rng, st)) : null;
  if (format === "uebersetzen") return f.uebersetzen ? kurzantwort(skillId, difficulty, f.uebersetzen(rng, st)) : null;
  if (format === "fix") {
    // like the other skills: one sentence, two on the middle level, three on the hard ones
    const n = st >= 3 ? 3 : st >= 2 ? 2 : 1;
    const saetze: Satz[] = [];
    for (let k = 0; saetze.length < n && k < 80; k++) {
      const s = f.satz(rng, st);
      if (s.tabelle || saetze.some((x) => x.text === s.text || x.regel === s.regel) || !mitFehler(s, rng)) continue;
      saetze.push(s);
    }
    return korrektur(skillId, difficulty, saetze, rng);
  }
  for (let k = 0; k < 40; k++) {
    const s = f.satz(rng, st);
    if (format === "mc") {
      // two gaps: "Choose the right words."
      const wahl = s.luecken.length > 1 ? f.wahl(st).replace(/\b(word|form|preposition)\.$/, "$1s.") : f.wahl(st);
      const t = auswahl(skillId, difficulty, wahl, s, rng);
      if (t) return t;
    } else if (!s.ohneLuecke) return lueckentext(skillId, difficulty, s.titel ?? f.titel(st), s);
  }
  return null;
}

/** The task a skill gives when no format is asked for (a gap text; irregular verbs: a short answer). */
export const ENGLISCH_GRAMMATIK: Record<string, (rng: Rng, difficulty: Difficulty) => TaskDraft> = Object.fromEntries(
  Object.entries(FAEHIGKEITEN).map(([id, f]) => [id, (rng: Rng, difficulty: Difficulty) => englischAufgabe(id, f.standard ?? "cloze", difficulty, rng)!]),
);

/**
 * A task for a task type of the builder (lib/curriculum.ts CATEGORIES, Englisch) and the task type it
 * really is: a type the skill has no task for becomes a gap text, so the builder can say so ("Ohne KI gibt
 * es Translation für diese Fähigkeit nicht …"). Only the irregular verbs have Vocabulary and Translation.
 */
export function englischFuerKategorie(skillId: string, category: string | null, difficulty: Difficulty, rng: Rng = Math.random): { task: TaskDraft; category: string | null } {
  const f = FAEHIGKEITEN[skillId]!;
  const als = (format: EnglischFormat, cat: string | null) => {
    const task = englischAufgabe(skillId, format, difficulty, rng);
    return task ? { task, category: cat } : null;
  };
  const luecke = () => als("cloze", "gap")!;
  switch (category) {
    case "mc":
      return als("mc", "mc") ?? luecke();
    case "grammar":
      // Grammar allows a short answer, a gap text or multiple choice: the short answer where there is one
      return als("kurz", "grammar") ?? als("cloze", "grammar")!;
    case "korrigieren":
      return als("fix", "korrigieren") ?? luecke();
    case "translation":
      return als("uebersetzen", "translation") ?? luecke();
    case "vocabulary":
      return f.uebersetzen ? als("kurz", "vocabulary")! : luecke();
    case "gap":
    case "lueckentext":
      return als("cloze", category)!;
    case "reading":
      return luecke();
    default:
      return als(f.standard ?? "cloze", category)!;
  }
}

/** A task for an answer format of generateBuiltIn (mixed: gap text, multiple choice or short answer). */
export function englischFuerTyp(skillId: string, taskType: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft {
  const f = FAEHIGKEITEN[skillId]!;
  const format: EnglischFormat =
    taskType === "mixed"
      ? (["cloze", "mc", ...(f.kurz ? (["kurz"] as const) : [])] as EnglischFormat[])[Math.floor(rng() * (f.kurz ? 3 : 2))]
      : taskType === "mc"
        ? "mc"
        : taskType === "cloze"
          ? "cloze"
          : taskType === "grammar"
            ? "kurz"
            : taskType === "fix"
              ? "fix"
              : (f.standard ?? "cloze");
  return englischAufgabe(skillId, format, difficulty, rng) ?? englischAufgabe(skillId, "cloze", difficulty, rng)!;
}
