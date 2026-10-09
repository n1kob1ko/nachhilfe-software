/**
 * Leseverständnis (Lernheft Phase 5C): a longer reading text with several questions about it.
 *
 * There is no separate store for reading texts: each question is an ordinary task whose data.passage holds
 * the text (and data.passageTitle its title), exactly like the short Textverständnis tasks before. A
 * worksheet whose tasks all share one text is a reading exercise ("Lesetext"): the student sees the text
 * next to the questions, the editor edits the text once for all questions, the A4 sheet prints it once.
 *
 * Everything here is deterministic: splitting the text into paragraphs, the questions without KI and the
 * checks that mark questions which do not fit the text (readingIssues).
 */
import type { Difficulty } from "./curriculum";
import { GAP, type TaskDraft } from "./tasks";

// ---------- what a question practises ----------
export const ASPECTS = {
  info: "Informationen aus Texten entnehmen",
  zusammenhang: "Zusammenhänge erkennen",
  schluss: "Schlussfolgerungen ziehen",
  wort: "Wortbedeutungen erschließen",
  beleg: "Textstellen als Beleg verwenden",
  zusammenfassen: "Inhalte zusammenfassen",
  begruenden: "Aussagen begründen",
} as const;
export type Aspect = keyof typeof ASPECTS;
export const ASPECT_KEYS = Object.keys(ASPECTS) as Aspect[];
export const isAspect = (x: unknown): x is Aspect => typeof x === "string" && x in ASPECTS;
/** Short names for chips and selects. */
export const ASPECT_SHORT: Record<Aspect, string> = {
  info: "Informationen finden",
  zusammenhang: "Zusammenhänge verstehen",
  schluss: "Schlussfolgern",
  wort: "Wörter erklären",
  beleg: "Textstelle als Beleg",
  zusammenfassen: "Zusammenfassen",
  begruenden: "Eigene Stellungnahme",
};
/** Questions about these have one answer in the text, so a passage (Beleg) is stored with them. */
export const NEEDS_EVIDENCE = new Set<Aspect>(["info", "zusammenhang", "beleg", "wort"]);
/** The KI notes "Verschiedene Antworten sind richtig …" in the Erwartungshorizont itself: then it is not said twice. */
export const severalNoted = (criteria: string[] | undefined) => Boolean(criteria?.some((c) => /^(verschiedene|mehrere) antworten/i.test(c.trim())));
/** Questions about these have more than one right answer (interpretation, opinion). */
export const OPEN_ASPECTS = new Set<Aspect>(["schluss", "begruenden"]);

/** The reading skills: the main skill of the subject and one Teilfähigkeit per aspect (lib/curriculum.ts). */
export const READING_SKILL: Record<string, string> = { Deutsch: "deutsch.text.verstehen", Englisch: "englisch.reading.comprehension" };
export const READING_SUBJECTS = Object.keys(READING_SKILL);
export const aspectSkill = (subject: string, aspect: Aspect) => `${READING_SKILL[subject] ?? READING_SKILL.Deutsch}.${aspect}`;
export function aspectOfSkill(skillId: string | null | undefined): Aspect | null {
  const last = skillId?.split(".").pop();
  return isAspect(last) && Object.values(READING_SKILL).some((s) => skillId === `${s}.${last}`) ? last : null;
}

// ---------- text types and lengths ----------
export const TEXT_TYPES = {
  erzaehlung: "Erzählung",
  kurzgeschichte: "Kurzgeschichte",
  sachtext: "Sachtext",
  zeitungsartikel: "Zeitungsartikel",
  argumentativ: "Argumentativer Text",
} as const;
export type TextType = keyof typeof TEXT_TYPES;
export const isTextType = (x: unknown): x is TextType => typeof x === "string" && x in TEXT_TYPES;
const STORY = new Set<TextType>(["erzaehlung", "kurzgeschichte"]);

/** Recommended length in words by Schulstufe (a recommendation, never a limit). */
export function recommendedWords(schulstufe: number): { min: number; max: number; default: number; label: string } {
  if (schulstufe <= 4) return { min: 150, max: 400, default: 250, label: "Volksschule" };
  if (schulstufe <= 8) return { min: 300, max: 800, default: 500, label: "Unterstufe" };
  return { min: 600, max: 1500, default: 900, label: "Oberstufe" };
}
export const QUESTION_COUNTS = [4, 6, 8, 10, 12];

// ---------- the text ----------
export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** Paragraphs are separated by an empty line; a text without empty lines is split at its line breaks. */
export function paragraphsOf(text: string): string[] {
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const blocks = t.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  return t.split("\n").map((p) => p.trim()).filter(Boolean);
}
/** Paragraphs joined the way they are stored: one empty line between two. */
export const joinParagraphs = (ps: string[]) => ps.map((p) => p.trim()).filter(Boolean).join("\n\n");

/** Lower case, one kind of quote, dash and space, no soft hyphens: for finding a quote in the text. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[­​]/g, "")
    .replace(/[„“”"«»‚‘’'`´]/g, "'")
    .replace(/[–—‑]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}
const bare = (s: string) => normalizeText(s).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

/** The paragraph (1-based) a quote is taken from, or null when it is not in the text word for word. */
export function findQuote(text: string, quote: string): number | null {
  const q = bare(quote.replace(/^\s*(\.\.\.|…)|(\.\.\.|…)\s*$/g, ""));
  if (q.length < 3) return null;
  const ps = paragraphsOf(text);
  for (let i = 0; i < ps.length; i++) if (bare(ps[i]).includes(q)) return i + 1;
  return null;
}

// ---------- reading exercises ----------
export type Evidence = { paragraph: number; quote: string };
export type ReadingText = { title: string; text: string };

/** The shared text of a worksheet whose tasks all use the same one (at least two tasks), else null. */
export function readingSet(tasks: Pick<TaskDraft, "data">[]): ReadingText | null {
  if (tasks.length < 2) return null;
  const text = tasks[0].data.passage?.trim();
  if (!text || !tasks.every((t) => t.data.passage?.trim() === text)) return null;
  return { title: tasks.find((t) => t.data.passageTitle?.trim())?.data.passageTitle?.trim() ?? "", text };
}

// ---------- checks: questions that do not fit the text ----------
const ORDINALS: Record<string, number> = {
  ersten: 1, zweiten: 2, dritten: 3, vierten: 4, fünften: 5, sechsten: 6, siebten: 7, achten: 8, neunten: 9, zehnten: 10, elften: 11, zwölften: 12,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
};
/** Paragraph numbers a question names: "Abschnitt 3", "im dritten Absatz", "paragraph 2", "the second paragraph". */
export function paragraphRefs(prompt: string): number[] {
  const out: number[] = [];
  for (const m of prompt.matchAll(/(?:abschnitt|absatz|paragraph|zeile[n]?\s+des\s+abschnitts)\s*(\d{1,2})/giu)) out.push(Number(m[1]));
  for (const m of prompt.matchAll(/(\d{1,2})\.\s*(?:abschnitt|absatz)/giu)) out.push(Number(m[1]));
  for (const m of prompt.matchAll(/\b(\p{L}+)\s+(?:abschnitt|absatz|abschnitts|absatzes|paragraph)/giu)) {
    const n = ORDINALS[m[1].toLowerCase().replace(/(e[nrms]?)$/u, "en").replace(/enen$/, "en")] ?? ORDINALS[m[1].toLowerCase()];
    if (n) out.push(n);
  }
  return [...new Set(out)];
}
/** Words and phrases a question quotes: „zögerlich“, ‚zögerlich‘, "hesitant". */
export function quotedIn(prompt: string): string[] {
  const out: string[] = [];
  for (const m of prompt.matchAll(/[„“"‚‘']([^„“”"‚‘’']{2,80})[“”"‘’']/gu)) {
    const q = m[1].trim();
    // a quoted instruction like "richtig" / "falsch" is not taken from the text
    if (q && !/^(richtig|falsch|true|false|ja|nein|yes|no)$/i.test(q)) out.push(q);
  }
  return out;
}

const STOP = new Set(
  "aber alle allem allen aller alles als also auch auf aus bei beim bist dann das dass dein deine dem den denen der des deshalb dich die dies diese diesem diesen dieser dieses doch dort durch eine einem einen einer eines einige erkläre erklären etwas euch fasse finde findest frage für gibt habe haben hast hat hier ihm ihn ihr ihre im immer in ist jede jeder jedes kann kannst kein keine man mehr mein meine mit muss nach nicht noch nun nur oder ohne schreibe sein seine sich sie sind so über um und uns unter vom von vor war waren warum was weil welche welcher welches wenn wer werden wie wieder will wird wo worden wurde zu zum zur zwei drei text textes abschnitt abschnitts absatz stelle stellen worte worten wörter eigenen deiner deine begründe begründung antwort nenne beschreibe gib meinung hauptfigur geschichte about after again also answer because before being between both could does each explain find from have give into most only other paragraph should some than that their them then there these they this those through what when where which while text with would write your words own reason".split(
    " ",
  ),
);
const contentWords = (s: string, min = 5) => new Set((bare(s).match(/\p{L}+/gu) ?? []).filter((w) => w.length >= min && !STOP.has(w)));

/** How alike two questions are (0–1), by their content words. */
export function similarity(a: string, b: string): number {
  const x = contentWords(a, 4);
  const y = contentWords(b, 4);
  if (!x.size || !y.size) return bare(a) === bare(b) ? 1 : 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size) * (common / Math.max(x.size, y.size)) ** 0.5;
}
/** Two questions this alike ask the same thing. */
export const SIMILAR = 0.7;

type Q = Pick<TaskDraft, "type" | "prompt" | "data" | "answer" | "solution">;

/**
 * What the teacher should look at before the question is used: references to the text that do not exist,
 * a Beleg that is not in the text, a missing sample answer, a question very much like another one.
 * Empty = nothing found. These are hints for the teacher, the question is never changed by them.
 */
export function readingIssues(task: Q, text: string, others: Q[] = []): string[] {
  const out: string[] = [];
  const ps = paragraphsOf(text);
  const aspect = isAspect(task.data.aspect) ? task.data.aspect : null;
  const shown = task.prompt.replaceAll(GAP, " ");
  for (const n of paragraphRefs(shown)) if (n < 1 || n > ps.length) out.push(`Die Frage nennt Abschnitt ${n}, der Text hat ${ps.length === 1 ? "nur einen Abschnitt" : `${ps.length} Abschnitte`}.`);
  const plain = bare(text);
  for (const q of quotedIn(shown)) if (!plain.includes(bare(q))) out.push(`„${q}“ kommt im Text nicht vor.`);
  const evidence = task.answer.evidence ?? [];
  for (const e of evidence) {
    if (!e.quote.trim()) continue;
    const at = findQuote(text, e.quote);
    if (at === null) out.push(`Der Beleg „${e.quote.length > 60 ? `${e.quote.slice(0, 57)}…` : e.quote}“ steht so nicht im Text.`);
    else if (e.paragraph && e.paragraph !== at) out.push(`Der Beleg steht in Abschnitt ${at}, nicht in Abschnitt ${e.paragraph}.`);
  }
  if (aspect && NEEDS_EVIDENCE.has(aspect) && task.type !== "cloze" && !evidence.some((e) => e.quote.trim())) out.push("Es fehlt eine Textstelle als Beleg.");
  if (task.type === "free" && !task.answer.sample?.trim() && !task.answer.criteria?.some((c) => c.trim()) && !task.solution.trim()) out.push("Musterlösung oder Erwartungshorizont fehlt.");
  else if (task.type === "free" && aspect && NEEDS_EVIDENCE.has(aspect) && !task.answer.sample?.trim()) out.push("Musterlösung ergänzen: die Frage hat eine Antwort im Text.");
  if (task.type === "cloze") {
    // the gaps come from the text: then the words in the text are the answers and the check is reliable
    const lines = task.prompt.split("\n").filter((l) => l.includes(GAP));
    const blanks = task.answer.blanks ?? [];
    let k = 0;
    for (const line of lines) {
      const parts = line.split(GAP);
      const filled = parts.map((p, i) => (i < parts.length - 1 ? p + (blanks[k + i]?.[0] ?? "") : p)).join("");
      k += parts.length - 1;
      if (!plain.includes(bare(filled))) {
        out.push("Der Lückensatz steht so nicht im Text: andere richtige Wörter wären möglich, die App bewertet dann vielleicht falsch.");
        break;
      }
    }
  }
  if (task.data.options && !evidence.length) out.push("Multiple Choice ohne Beleg: welche Stelle zeigt die richtige Antwort?");
  if (aspect && (aspect === "info" || aspect === "zusammenhang" || aspect === "beleg") && task.type === "free") {
    // a question about the text names something from it
    const words = contentWords(shown);
    const inText = contentWords(text, 5);
    if (words.size && ![...words].some((w) => inText.has(w) || [...inText].some((t) => t.startsWith(w.slice(0, 6)) && w.length >= 6))) out.push("Die Frage nennt nichts, was im Text vorkommt.");
  }
  // the question itself is in the list too (the same object, or the same stored task)
  const id = (x: Q) => (x as { id?: number }).id;
  const twin = others.findIndex((o) => o !== task && !(id(o) !== undefined && id(o) === id(task)) && similarity(o.prompt, task.prompt) >= SIMILAR);
  if (twin >= 0) out.push(`Sehr ähnlich wie Frage ${twin + 1}.`);
  return [...new Set(out)];
}

/** Notes about the whole exercise: too much multiple choice, too few kinds of questions. */
export function readingSetIssues(tasks: Q[]): string[] {
  const out: string[] = [];
  const mc = tasks.filter((t) => t.data.options?.length).length;
  if (tasks.length >= 4 && mc > Math.max(1, Math.floor(tasks.length / 4))) out.push(`${mc} von ${tasks.length} Fragen sind Multiple Choice. Offene Fragen zeigen besser, ob der Text verstanden wurde.`);
  const kinds = new Set(tasks.map((t) => t.data.aspect).filter(isAspect));
  if (tasks.length >= 6 && kinds.size < 3) out.push("Die Fragen üben kaum verschiedene Dinge: auch Zusammenhänge, Wortbedeutungen oder eine Stellungnahme fragen.");
  return out;
}

// ---------- questions without KI ----------
type Lang = "de" | "en";
const langOf = (subject: string): Lang => (subject === "Englisch" ? "en" : "de");

/** The usual order of the aspects; a set of n questions takes the first n (round after round). */
export const ASPECT_PLAN: Aspect[] = ["info", "zusammenhang", "wort", "beleg", "schluss", "zusammenfassen", "begruenden", "info", "zusammenhang", "schluss", "wort", "beleg"];
export function planAspects(n: number): Aspect[] {
  return Array.from({ length: n }, (_, i) => ASPECT_PLAN[i % ASPECT_PLAN.length]);
}

const sentencesOf = (p: string) => (p.match(/[^.!?…]+[.!?…]+["“”'’»]?|[^.!?…]+$/gu) ?? []).map((s) => s.trim()).filter(Boolean);
const wordsOf = (s: string) => s.match(/\p{L}[\p{L}'’-]*/gu) ?? [];

/** A word worth explaining: long, not a name (in German: not capitalised in the middle of a sentence unless a noun is wanted), once in the text. */
function pickWord(ps: string[], lang: Lang): { word: string; paragraph: number } | null {
  const all = normalizeText(ps.join(" "));
  const min = lang === "de" ? 8 : 7;
  let best: { word: string; paragraph: number; score: number } | null = null;
  ps.forEach((p, i) => {
    for (const s of sentencesOf(p)) {
      const ws = wordsOf(s);
      ws.forEach((w, j) => {
        if (j === 0 || w.length < min) return;
        // German: lower-case words are adjectives, verbs, adverbs (good to explain); English: skip names
        if (lang === "en" && /^\p{Lu}/u.test(w)) return;
        const lower = w.toLowerCase();
        if (STOP.has(lower)) return;
        const count = all.split(lower).length - 1;
        const score = w.length + (count === 1 ? 4 : 0) + (lang === "de" && /^\p{Ll}/u.test(w) ? 3 : 0) + (i > 0 ? 1 : 0);
        if (!best || score > best.score) best = { word: w, paragraph: i + 1, score };
      });
    }
  });
  const b = best as { word: string; paragraph: number } | null;
  return b ? { word: b.word, paragraph: b.paragraph } : null;
}

/** A sentence from the middle of the text with its two longest words as gaps (the answers are in the text). */
function pickCloze(ps: string[]): { sentence: string; gaps: string[]; paragraph: number } | null {
  const order = ps.map((_, i) => i).sort((a, b) => Math.abs(a - (ps.length - 1) / 2) - Math.abs(b - (ps.length - 1) / 2));
  for (const i of order) {
    for (const s of sentencesOf(ps[i])) {
      const ws = wordsOf(s);
      if (ws.length < 8 || ws.length > 24 || /[„“"‚‘]/.test(s)) continue;
      const cand = [...new Set(ws.slice(1))].filter((w) => w.length >= 5 && !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length).slice(0, 2);
      if (cand.length < 2) continue;
      return { sentence: s, gaps: cand, paragraph: i + 1 };
    }
  }
  return null;
}

/** Replaces each gap word (first time it occurs, whole word) with ___, in the order it appears. */
function gapSentence(sentence: string, gaps: string[]): { prompt: string; blanks: string[][] } {
  const marks: { at: number; word: string }[] = [];
  for (const g of gaps) {
    const m = new RegExp(`(?<![\\p{L}])${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").exec(sentence);
    if (m) marks.push({ at: m.index, word: g });
  }
  marks.sort((a, b) => a.at - b.at);
  let out = "";
  let pos = 0;
  for (const m of marks) {
    out += sentence.slice(pos, m.at) + GAP;
    pos = m.at + m.word.length;
  }
  return { prompt: out + sentence.slice(pos), blanks: marks.map((m) => [m.word]) };
}

const T = {
  de: {
    info: ["Wo und wann spielt die Geschichte? Schreibe auf, was du im Text darüber erfährst.", "Nenne drei wichtige Informationen, die du in diesem Text erfährst."],
    zusammenhang: ["Warum handelt die Hauptfigur so, wie sie handelt? Erkläre mit Hilfe des Textes.", "Welche Ursache und welche Folge beschreibt der Text? Erkläre einen Zusammenhang mit eigenen Worten."],
    wort: (w: string, p: number) => `Was bedeutet das Wort „${w}“ in Abschnitt ${p}? Erkläre es mit eigenen Worten.`,
    beleg: ["Welche Stelle im Text zeigt, wie sich die Hauptfigur fühlt? Schreibe sie ab und gib den Abschnitt an.", "Welche Stelle im Text belegt die wichtigste Aussage? Schreibe sie ab und gib den Abschnitt an."],
    schluss: ["Wie könnte die Geschichte weitergehen? Begründe deine Vermutung mit dem Text.", "Was kannst du aus dem Text schließen, auch wenn es dort nicht direkt steht? Begründe mit dem Text."],
    zusammenfassen: (p: number) => `Fasse Abschnitt ${p} in zwei bis drei Sätzen mit eigenen Worten zusammen.`,
    begruenden: ["Findest du das Verhalten der Hauptfigur richtig? Begründe deine Meinung.", "Wie stehst du zu dem, was der Text beschreibt? Begründe deine Meinung mit zwei Argumenten."],
    argumentativ: "Welchem Argument des Textes stimmst du am meisten zu? Begründe deine Meinung.",
    cloze: (p: number) => `Ergänze die Lücken mit den Wörtern aus Abschnitt ${p}.`,
    criteria: {
      info: ["nennt Angaben, die wirklich im Text stehen"],
      zusammenhang: ["erklärt Grund und Folge", "stützt sich auf den Text"],
      wort: ["erklärt die Bedeutung passend zum Satz im Text", "eigene Worte oder ein passendes anderes Wort"],
      beleg: ["schreibt eine passende Stelle wörtlich ab", "gibt den Abschnitt an"],
      schluss: ["nennt eine Vermutung, die zum Text passt", "begründet sie mit einer Stelle aus dem Text"],
      zusammenfassen: ["gibt die wichtigsten Inhalte des Abschnitts wieder", "mit eigenen Worten, nicht abgeschrieben", "zwei bis drei Sätze"],
      begruenden: ["sagt klar die eigene Meinung", "begründet sie (mit dem Text oder eigener Erfahrung)"],
    } as Record<Aspect, string[]>,
    hint: (p: number | null) => (p ? `Lies Abschnitt ${p} noch einmal genau.` : "Lies die passende Stelle im Text noch einmal."),
  },
  en: {
    info: ["Where and when does the story take place? Write down what the text tells you.", "Name three important pieces of information you learn from the text."],
    zusammenhang: ["Why does the main character act the way they do? Explain with the help of the text.", "Which cause and which effect does the text describe? Explain one connection in your own words."],
    wort: (w: string, p: number) => `What does the word "${w}" mean in paragraph ${p}? Explain it in your own words.`,
    beleg: ["Which part of the text shows how the main character feels? Copy it and say which paragraph it is in.", "Which part of the text supports its main point? Copy it and say which paragraph it is in."],
    schluss: ["What might happen next? Give a reason from the text for your guess.", "What can you conclude from the text, even though it does not say so directly? Give a reason from the text."],
    zusammenfassen: (p: number) => `Summarise paragraph ${p} in two or three sentences in your own words.`,
    begruenden: ["Do you think the main character made the right decision? Give reasons for your opinion.", "What do you think about the topic of the text? Give two reasons for your opinion."],
    argumentativ: "Which argument in the text do you agree with most? Give reasons for your opinion.",
    cloze: (p: number) => `Fill in the gaps with words from paragraph ${p}.`,
    criteria: {
      info: ["gives information that is really in the text"],
      zusammenhang: ["explains cause and effect", "uses the text"],
      wort: ["explains the meaning that fits the sentence", "own words or a matching synonym"],
      beleg: ["copies a fitting part of the text word for word", "names the paragraph"],
      schluss: ["makes a guess that fits the text", "supports it with the text"],
      zusammenfassen: ["gives the main points of the paragraph", "in own words, not copied", "two or three sentences"],
      begruenden: ["states a clear opinion", "gives reasons (from the text or own experience)"],
    } as Record<Aspect, string[]>,
    hint: (p: number | null) => (p ? `Read paragraph ${p} again carefully.` : "Read the part of the text again."),
  },
};

export type ReadingRequest = {
  subject: string;
  title: string;
  text: string;
  textType: TextType;
  difficulty: Difficulty;
  count: number;
  /** a Lückentext with words from the text (checked automatically) among the questions */
  cloze?: boolean;
};

/**
 * Questions without KI: one per aspect, worded for stories or for factual texts, with real paragraph
 * numbers and a real word from the text. Open questions get a Erwartungshorizont; where the answer is in
 * the text the teacher adds the sample answer (the editor says so).
 */
export function templateQuestions(req: ReadingRequest): TaskDraft[] {
  const lang = langOf(req.subject);
  const t = T[lang];
  const ps = paragraphsOf(req.text);
  const story = STORY.has(req.textType);
  const word = pickWord(ps, lang);
  const cloze = req.cloze !== false ? pickCloze(ps) : null;
  const middle = Math.max(1, Math.min(ps.length, Math.ceil(ps.length / 2)));
  const base = (aspect: Aspect, prompt: string, extra: Partial<TaskDraft> = {}): TaskDraft => ({
    type: "free",
    skillId: aspectSkill(req.subject, aspect),
    skillIds: [aspectSkill(req.subject, aspect)],
    category: req.subject === "Englisch" ? "reading" : "textverstaendnis",
    difficulty: req.difficulty,
    prompt,
    data: { passage: req.text, passageTitle: req.title || undefined, aspect, lines: aspect === "zusammenfassen" || OPEN_ASPECTS.has(aspect) ? 5 : 3 },
    answer: { sample: "", criteria: t.criteria[aspect] },
    solution: "",
    hints: [t.hint(null)],
    errorMap: [],
    sourceType: "eigen",
    ...extra,
  });
  const used = new Set<string>();
  const out: TaskDraft[] = [];
  // the two wordings of an aspect (story / factual text first); a wording is used once
  const wordings = (a: Aspect): string[] => {
    if (a === "begruenden" && req.textType === "argumentativ") return [t.argumentativ, ...t.begruenden];
    const pair = (t as unknown as Record<string, string[]>)[a];
    return Array.isArray(pair) ? (story ? pair : [pair[1], pair[0]]) : [];
  };
  const ask = (a: Aspect): boolean => {
    const prompt = wordings(a).find((x) => !used.has(x));
    if (!prompt) return false;
    used.add(prompt);
    out.push(base(a, prompt));
    return true;
  };
  let summaries = 0;
  for (const aspect of planAspects(req.count)) {
    if (aspect === "wort") {
      if (word && !used.has(`wort:${word.word}`)) {
        used.add(`wort:${word.word}`);
        out.push(base("wort", t.wort(word.word, word.paragraph), { answer: { sample: "", criteria: t.criteria.wort, evidence: [{ paragraph: word.paragraph, quote: word.word }] }, hints: [t.hint(word.paragraph)] }));
      } else ask("schluss");
      continue;
    }
    if (aspect === "info" && cloze && !used.has("cloze")) {
      used.add("cloze");
      const g = gapSentence(cloze.sentence, cloze.gaps);
      out.push({
        ...base("info", `${t.cloze(cloze.paragraph)}\n${g.prompt}`),
        type: "cloze",
        data: { passage: req.text, passageTitle: req.title || undefined, aspect: "info" },
        answer: { blanks: g.blanks, mode: "text", evidence: [{ paragraph: cloze.paragraph, quote: cloze.sentence }] },
        hints: [t.hint(cloze.paragraph)],
      });
      continue;
    }
    if (aspect === "zusammenfassen") {
      const p = Math.min(ps.length, middle + summaries++);
      if (!used.has(`zf:${p}`)) {
        used.add(`zf:${p}`);
        out.push(base("zusammenfassen", t.zusammenfassen(p), { hints: [t.hint(p)] }));
      } else ask("zusammenhang");
      continue;
    }
    ask(aspect);
  }
  return out;
}

// ---------- after the KI or the teacher: one list of questions ----------

/** Drops questions that ask what another one already asks (the earlier one stays). */
export function dropTwins<T extends { prompt: string }>(list: T[]): { kept: T[]; dropped: number } {
  const kept: T[] = [];
  for (const q of list) if (!kept.some((k) => similarity(k.prompt, q.prompt) >= SIMILAR)) kept.push(q);
  return { kept, dropped: list.length - kept.length };
}

/** Puts the Beleg where it really is: the paragraph a quote is in (the KI sometimes counts wrong). */
export function placeEvidence(text: string, evidence: Evidence[]): Evidence[] {
  return evidence
    .map((e) => ({ quote: e.quote.trim(), paragraph: findQuote(text, e.quote) ?? e.paragraph }))
    .filter((e) => e.quote);
}

/** Gives every question of a set the (edited) text and title. */
export function withText<T extends Pick<TaskDraft, "data">>(tasks: T[], r: ReadingText): T[] {
  return tasks.map((t) => ({ ...t, data: { ...t.data, passage: r.text, passageTitle: r.title || undefined } }));
}
