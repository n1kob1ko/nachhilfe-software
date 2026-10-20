/**
 * English contractions (Kurzformen): the answers of English tasks are compared in the long form, so
 * "doesn't" counts the same as "does not", "I'm" as "I am", "won't" as "will not" and "can't",
 * "cannot" and "can not" are all the same. Only where the contraction is right:
 *
 * - never at the end of a clause: "Yes, I am." is right, "Yes, I'm." is not;
 * - not when the verb stands in front of its subject: "Don't you like it?" stays as it is;
 * - 's, 've and 'd stand for has, have and had only before a past participle (or got, been, better):
 *   "She's got a dog." is "She has got a dog.", but "He's a dog." is never "He has a dog.";
 * - the possessive 's (Tom's bike) and "its" are no contractions and stay as they are.
 *
 * A contraction becomes exactly one long form, so a wrong form can never meet a right one. Expected
 * answers are written in the long form or with contractions that stand for one thing only (doesn't,
 * isn't, I'm), never with an ambiguous one like "he's" before "finished".
 */

/** The negative contractions and their verb: "doesn't" is "does not". */
const NOT: Record<string, string> = {
  "don't": "do",
  "doesn't": "does",
  "didn't": "did",
  "isn't": "is",
  "aren't": "are",
  "wasn't": "was",
  "weren't": "were",
  "haven't": "have",
  "hasn't": "has",
  "hadn't": "had",
  "won't": "will",
  "wouldn't": "would",
  "can't": "can",
  "couldn't": "could",
  "shouldn't": "should",
  "mustn't": "must",
  "needn't": "need",
  "mightn't": "might",
  "shan't": "shall",
};

/** Subjects a verb can stand in front of in a question ("isn't it", "don't you"): then a contraction stays. */
const SUBJECT = new Set(["i", "you", "he", "she", "it", "we", "they", "there"]);

/** Which subjects take which short verb form: "I'm", "you're", "he's", "they've", "she'll", "we'd". */
const SHORT: Record<string, Set<string>> = {
  m: new Set(["i"]),
  re: new Set(["you", "we", "they"]),
  s: new Set(["he", "she", "it", "there", "that", "what", "who", "where", "how", "here"]),
  ve: new Set(["i", "you", "we", "they"]),
  ll: new Set(["i", "you", "he", "she", "it", "we", "they", "there", "that"]),
  d: new Set(["i", "you", "he", "she", "it", "we", "they"]),
};

/**
 * Past participles of the irregular verbs (the 3rd form; lib/englisch-woerter.ts has the whole table and a
 * test checks that each of its participles is here). Regular ones end in -ed.
 */
export const PARTIZIPIEN = new Set(
  (
    "been beaten become begun bent bet bitten bled blown broken brought built burnt bought caught chosen come cost cut dug done drawn dreamt " +
    "drunk driven eaten fallen fed felt fought found flown forgotten forgiven frozen got gotten given gone grown hung had heard hidden hit " +
    "held hurt kept known laid led learnt left lent let lain lit lost made meant met paid put read ridden rung risen run said seen sold sent " +
    "set shaken shone shot shown shut sung sunk sat slept smelt spoken spelt spent spilt stood stolen stuck stung swum taken taught torn told " +
    "thought thrown understood woken worn won written"
  ).split(" "),
);

/** Adjectives on -ed that follow "is" ("He's tired."), not "has". */
const ED_ADJECTIVES = new Set("tired bored interested excited worried scared surprised married pleased annoyed frightened disappointed embarrassed confused amazed".split(" "));

/** After 's, 've or 'd: a past participle (or "better" in "you'd better") makes it has, have or had. */
const participle = (word: string) => word === "better" || PARTIZIPIEN.has(word) || (/ed$/.test(word) && !ED_ADJECTIVES.has(word));

const WORD = /[\p{L}\p{N}]+(?:'[\p{L}]+)*/gu;
/** Keeps an upper-case first letter: "Doesn't" becomes "Does not". */
const sameCase = (from: string, to: string) => (from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);

/** The long form of one contraction, or the word itself when it is none or may not be written out. */
function longWord(word: string, following: string | undefined): string {
  const lower = word.toLowerCase();
  if (lower === "cannot") return sameCase(word, "can not");
  // "Don't you …?", "isn't it": the verb in front of its subject stays a contraction
  if (NOT[lower]) return following && SUBJECT.has(following) ? word : sameCase(word, `${NOT[lower]} not`);
  const short = lower.match(/^([a-z]+)'(m|re|s|ve|ll|d)$/);
  // at the end of a clause ("Yes, I am.") the long form is the only right one
  if (!short || !SHORT[short[2]].has(short[1]) || !following) return word;
  const perfect = participle(following);
  const verb = { m: "am", re: "are", ll: "will", s: perfect ? "has" : "is", d: perfect ? "had" : "would", ve: perfect ? "have" : "" }[short[2] as "m"];
  return verb ? `${word.slice(0, short[1].length)} ${verb}` : word;
}

/**
 * The text with its contractions written out ("She doesn't like it." becomes "She does not like it.").
 * Curly and straight apostrophes count the same. A contraction that may not be written out stays.
 */
export function langform(text: string): string {
  const s = text.replace(/[‘’`´ʼ]/g, "'");
  const words = [...s.matchAll(WORD)];
  let out = "";
  let last = 0;
  words.forEach((m, i) => {
    const at = m.index ?? 0;
    const next = words[i + 1];
    // the next word, unless a punctuation mark or the end of the text comes first
    const between = s.slice(at + m[0].length, next ? next.index : s.length);
    const following = next && !/[.,!?;:)"–-]/.test(between) ? next[0].toLowerCase() : undefined;
    out += s.slice(last, at) + longWord(m[0], following);
    last = at + m[0].length;
  });
  return out + s.slice(last);
}
