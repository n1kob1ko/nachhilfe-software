/**
 * Leseverständnis with the KI: a new reading text, and questions about a text (the teacher's own or a new
 * one). The KI only gets the text, subject, level and topic – never a student's name or data. Everything
 * it returns is checked by lib/lesen.ts: questions asking the same thing are dropped, a Beleg is placed in
 * the paragraph it really stands in, and whatever does not fit the text is marked for the teacher.
 */
import { z } from "zod";
import type { Difficulty } from "../curriculum";
import { ASPECTS, ASPECT_KEYS, OPEN_ASPECTS, SIMILAR, aspectSkill, isAspect, joinParagraphs, paragraphsOf, placeEvidence, similarity, type Aspect, type TextType } from "../lesen";
import { GAP, type TaskDraft } from "../tasks";
import { runAI, unwrap, type AIMeta } from "./router";

// ---------- the text ----------
const TextSchema = z.object({
  title: z.string().describe("Titel des Textes"),
  paragraphs: z.array(z.string()).describe("Die Absätze des Textes, jeder ein zusammenhängender Absatz ohne Nummer"),
});

const TEXT_SYSTEM = `Du schreibst Lesetexte für Leseverständnisübungen in einer österreichischen Nachhilfe-Software.
Jeder Text ist neu und von dir selbst geschrieben: übernimm keine Texte, Liedtexte oder Buchstellen aus anderen Quellen, auch nicht teilweise, und ahme keine bekannten Werke nach.
Der Text ist zusammenhängend, altersgerecht und für Schülerinnen und Schüler der angegebenen Klasse gut lesbar: klare Absätze, ein roter Faden, keine Aufzählungen.
Personen in Erzählungen und Zeitungsartikeln sind erfunden; reale Personen kommen höchstens als allgemein bekannte historische Figuren vor. Keine Gewaltdarstellung, nichts Beängstigendes für Kinder.
Ein Text muss genug Stoff für verschiedene Fragen bieten: Informationen, Gründe und Folgen, Gefühle oder Meinungen, ein paar weniger alltägliche Wörter, die man aus dem Zusammenhang erschließen kann.
Verwende österreichische Begriffe (Jänner, Klasse, Schularbeit), außer bei englischen Texten.`;

const TEXT_STYLE: Record<TextType, string> = {
  erzaehlung: "Erzählung: eine Hauptfigur, ein Ort, ein Problem oder Erlebnis, das sich entwickelt; mit Gedanken und Gefühlen der Figur und wörtlicher Rede.",
  kurzgeschichte: "Kurzgeschichte: unmittelbarer Einstieg, Alltagssituation, ein Wendepunkt, offenes Ende, das zum Nachdenken anregt.",
  sachtext: "Sachtext: informiert sachlich über das Thema, mit Fakten, Beispielen, Ursachen und Folgen; neutrale Sprache.",
  zeitungsartikel: "Zeitungsartikel: Überschrift als Titel, die W-Fragen im ersten Absatz, danach Hintergründe und eine erfundene Stimme (Zitat); der Ort darf erfunden sein.",
  argumentativ: "Argumentativer Text: eine Frage, Argumente dafür und dagegen mit Beispielen, am Ende eine begründete Position.",
};

/** CEFR level of an English text by Schulstufe (Austrian lower and upper secondary). */
function cefr(schulstufe: number) {
  return schulstufe <= 5 ? "A1–A2" : schulstufe <= 6 ? "A2" : schulstufe <= 7 ? "A2–B1" : schulstufe <= 8 ? "B1" : schulstufe <= 10 ? "B1–B2" : "B2";
}

export type ReadingTextRequest = {
  subject: string;
  /** "2. Klasse Mittelschule" */
  level: string;
  schulstufe: number;
  topic: string;
  textType: TextType;
  difficulty: Difficulty;
  words: number;
};

export function readingTextPrompt(r: ReadingTextRequest): string {
  const en = r.subject === "Englisch";
  return `Schreibe einen Lesetext.
Fach: ${r.subject}${en ? ` (der Text ist auf Englisch, Niveau ${cefr(r.schulstufe)})` : ""}
Klasse: ${r.level} (Schulstufe ${r.schulstufe})
Thema: ${r.topic}
Textart: ${TEXT_STYLE[r.textType]}
Schwierigkeit: ${r.difficulty}${r.difficulty === "leicht" ? " (kurze Sätze, bekannte Wörter)" : r.difficulty === "schwer" ? " (längere Sätze, anspruchsvollere Wörter, mehr zwischen den Zeilen)" : ""}
Länge: ungefähr ${r.words} Wörter (zwischen ${Math.round(r.words * 0.85)} und ${Math.round(r.words * 1.15)}), in ${Math.max(3, Math.min(10, Math.round(r.words / 90)))} Absätzen.`;
}

export async function generateReadingText(r: ReadingTextRequest, meta: AIMeta = {}): Promise<{ title: string; text: string } | { error: string }> {
  const out = await runAI("lesen", TextSchema, TEXT_SYSTEM, readingTextPrompt(r), { maxTokens: Math.min(24_000, 4_000 + r.words * 6), meta: { ...meta, trigger: meta.trigger ?? "lesetext" } });
  if (!out.ok) return { error: out.message };
  const text = joinParagraphs(out.data.paragraphs.map((p) => p.replace(/^\s*(\[\d+\]|\d+[.)])\s*/, "")));
  if (paragraphsOf(text).length < 2) return { error: "Die KI hat keinen brauchbaren Text geliefert." };
  return { title: out.data.title.trim().replace(/^["„]|["“]$/g, ""), text };
}

// ---------- the questions ----------
const FORMATS = ["offen", "lueckentext", "mc"] as const;
type Format = (typeof FORMATS)[number];
const QuestionSchema = z.object({
  slot: z.number().int().describe("Nummer der Frage im Fragenplan"),
  aspect: z.enum(ASPECT_KEYS as [Aspect, ...Aspect[]]),
  format: z.enum(FORMATS),
  prompt: z.string().describe("Die Frage bzw. Aufgabenstellung, wie der Schüler sie liest. Bei lueckentext nur die Anweisung."),
  sample_answer: z.string().nullable().describe("Musterlösung: eine richtige Antwort in Schülersprache (bei mc und lueckentext null)"),
  criteria: z.array(z.string()).describe("Erwartungshorizont: 2–3 Punkte, woran die Lehrkraft eine richtige Antwort erkennt"),
  several_answers_right: z.boolean().describe("true bei Interpretation, Vermutung oder Meinung: verschiedene Antworten sind richtig, wenn sie begründet sind"),
  evidence: z.array(z.object({ paragraph: z.number().int().describe("Nummer des Absatzes"), quote: z.string().describe("WÖRTLICH aus dem Text kopiert, 3–25 Wörter") })).describe("Textstellen, die die Antwort belegen; leer nur bei Meinungsfragen"),
  gap_text: z.string().nullable().describe("Nur bei lueckentext: ein bis zwei Sätze WÖRTLICH aus dem Text, die Lückenwörter in doppelten eckigen Klammern, z. B. Sie ging [[zögerlich]] zur Tür."),
  options: z.array(z.string()).nullable().describe("Nur bei mc: 3–4 Antworten"),
  correct_option: z.number().int().nullable().describe("Nur bei mc: Index (0-basiert) der richtigen Antwort"),
  answer_lines: z.number().int().nullable().describe("Nur bei offen: Zeilen für die Antwort (2 = ein Satz, 4 = einige Sätze, 6 = längere Antwort)"),
  hint: z.string().nullable().describe("Eine Hilfe, die sagt, wo im Text man nachlesen soll, ohne die Antwort zu verraten"),
});
const QuestionsSchema = z.object({ questions: z.array(QuestionSchema) });
export type AIQuestion = z.infer<typeof QuestionSchema>;

const QUESTION_SYSTEM = `Du erstellst Fragen zu einem Lesetext für eine Leseverständnisübung, wie auf einem guten Schul-Arbeitsblatt.
Regeln:
- Jede Frage bezieht sich auf genau diesen Text. Setze nichts voraus, was nicht im Text steht, und erfinde keine Personen, Orte oder Ereignisse dazu.
- Die Fragen sind verschieden: keine zwei fragen dasselbe, auch nicht mit anderen Worten. Sie gehen der Reihe nach durch den Text, wo das passt.
- Halte dich genau an den Fragenplan: jede Frage hat die verlangte Art (aspect) und das verlangte Format, in dieser Reihenfolge, mit slot = Nummer im Plan.
- Belege (evidence) und Lückensätze kopierst du Zeichen für Zeichen aus dem Text; die Absatznummer ist die Nummer in eckigen Klammern.
- Bei Fragen mit einer eindeutigen Antwort im Text gibt es eine Musterlösung und mindestens einen Beleg. Bei Vermutungen, Deutungen und Meinungen sind mehrere Antworten richtig: dann beschreibt der Erwartungshorizont, was eine gute Antwort ausmacht, und die Musterlösung ist ein Beispiel.
- Antworten in eigenen Worten müssen möglich sein: frage nicht nach einem bestimmten Wortlaut.
- Ein Lückentext verwendet Sätze wörtlich aus dem Text, Lückenwörter sind eindeutige Inhaltswörter (keine Artikel, keine Füllwörter).
- Multiple Choice nur, wenn der Plan es verlangt; die falschen Antworten sind plausibel, aber durch den Text klar widerlegt.
- Fragen und Antworten sind in der Sprache des Textes (bei englischen Texten auf Englisch), Erwartungshorizont und Hilfen dürfen Deutsch sein.
- Kein LaTeX, keine Nummern vor den Fragen.`;

const FORMAT_LABEL: Record<Format, string> = { offen: "offene Frage, Antwort in eigenen Worten", lueckentext: "Lückentext mit Wörtern aus dem Text", mc: "Multiple Choice" };

export type QuestionSlot = { aspect: Aspect; format: Format };

/** The plan: aspects in turn, one Lückentext among five questions or more, multiple choice only when allowed (at most one in four). */
export function questionPlan(aspects: Aspect[], o: { cloze: boolean; mc: boolean }): QuestionSlot[] {
  const plan: QuestionSlot[] = aspects.map((a) => ({ aspect: a, format: "offen" }));
  if (o.cloze && plan.length >= 5) {
    const i = plan.findIndex((p) => p.aspect === "info" || p.aspect === "wort");
    if (i >= 0) plan[i].format = "lueckentext";
  }
  if (o.mc) {
    let left = Math.max(1, Math.floor(plan.length / 4));
    for (const p of plan) if (left > 0 && p.format === "offen" && (p.aspect === "info" || p.aspect === "zusammenhang")) (p.format = "mc"), left--;
  }
  return plan;
}

export type ReadingQuestionsRequest = { subject: string; level: string; title: string; text: string; difficulty: Difficulty; plan: QuestionSlot[]; avoid?: string[] };

export function readingQuestionsPrompt(r: ReadingQuestionsRequest): string {
  const ps = paragraphsOf(r.text);
  return `Fach: ${r.subject}
Klasse: ${r.level}
Schwierigkeit: ${r.difficulty}

Text${r.title ? ` „${r.title}“` : ""} (Absätze nummeriert):
${ps.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")}

Fragenplan (${r.plan.length} ${r.plan.length === 1 ? "Frage" : "Fragen"}):
${r.plan.map((p, i) => `${i + 1}. aspect=${p.aspect} (${ASPECTS[p.aspect]}), format=${p.format} (${FORMAT_LABEL[p.format]})`).join("\n")}

Beispiele für die Arten:
- info: „Warum ging die Hauptfigur nicht zur Schule?“
- zusammenhang: „Warum verändert sich die Stimmung der Hauptfigur?“
- schluss: „Was könnte die Hauptfigur als Nächstes tun? Begründe deine Vermutung.“
- wort: „Was bedeutet das Wort ‚zögerlich‘ in diesem Abschnitt?“
- beleg: „Welche Stelle im Text zeigt, dass die Hauptfigur Angst hat?“
- zusammenfassen: „Fasse den dritten Abschnitt in eigenen Worten zusammen.“
- begruenden: „Findest du die Entscheidung der Hauptfigur richtig? Begründe deine Meinung.“${r.avoid?.length ? `\n\nDiese Fragen gibt es schon, frag etwas anderes:\n${r.avoid.map((a) => `- ${a.slice(0, 200)}`).join("\n")}` : ""}`;
}

/** "[[zögerlich]]" and "[[sehr|ganz]]" → ___ with the accepted words. */
export function clozeFrom(gapText: string): { text: string; blanks: string[][] } | null {
  const blanks: string[][] = [];
  const text = gapText.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    blanks.push(inner.split("|").map((x) => x.trim()).filter(Boolean));
    return GAP;
  });
  return blanks.length && blanks.every((b) => b.length) ? { text: text.trim(), blanks } : null;
}

/** For the teacher: an interpretation or opinion has more than one right answer. */
export const SEVERAL = "Verschiedene Antworten sind richtig, wenn sie zum Text passen und begründet sind.";

const linesFor = (a: Aspect) => (a === "zusammenfassen" ? 6 : OPEN_ASPECTS.has(a) ? 5 : a === "wort" ? 2 : 3);

/** One question of the KI as a task; null when it cannot be used (no prompt, no gaps, a broken choice). */
export function aiQuestionToDraft(q: AIQuestion, ctx: { subject: string; title: string; text: string; difficulty: Difficulty; slot?: QuestionSlot }): TaskDraft | null {
  const aspect: Aspect = isAspect(q.aspect) ? q.aspect : (ctx.slot?.aspect ?? "info");
  const prompt = q.prompt.trim();
  const evidence = placeEvidence(ctx.text, (q.evidence ?? []).filter((e) => e.quote?.trim()));
  const criteria = [...(q.several_answers_right ? [SEVERAL] : []), ...(q.criteria ?? []).map((c) => c.trim()).filter(Boolean)];
  const sample = q.sample_answer?.trim() ?? "";
  const firstPara = evidence[0]?.paragraph ?? null;
  const hint = q.hint?.trim() || (firstPara ? (ctx.subject === "Englisch" ? `Read paragraph ${firstPara} again.` : `Lies Abschnitt ${firstPara} noch einmal.`) : "");
  const base: TaskDraft = {
    type: "free",
    skillId: aspectSkill(ctx.subject, aspect),
    skillIds: [aspectSkill(ctx.subject, aspect)],
    category: ctx.subject === "Englisch" ? "reading" : "textverstaendnis",
    difficulty: ctx.difficulty,
    prompt,
    data: { passage: ctx.text, passageTitle: ctx.title || undefined, aspect, lines: Math.max(1, Math.min(12, q.answer_lines ?? linesFor(aspect))) },
    answer: { sample, criteria, evidence },
    solution: "",
    hints: hint ? [hint] : [],
    errorMap: [],
    sourceType: "ki",
  };
  if (q.format === "lueckentext") {
    const c = q.gap_text ? clozeFrom(q.gap_text) : null;
    if (!c) return null;
    const intro = prompt || (ctx.subject === "Englisch" ? "Fill in the gaps with words from the text." : "Ergänze die Lücken mit Wörtern aus dem Text.");
    return { ...base, type: "cloze", prompt: `${intro}\n${c.text}`, data: { passage: ctx.text, passageTitle: ctx.title || undefined, aspect }, answer: { blanks: c.blanks, mode: "text", evidence, criteria } };
  }
  if (!prompt) return null;
  if (q.format === "mc") {
    const options = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
    const ok = options.length >= 3 && options.length <= 5 && new Set(options.map((o) => o.toLowerCase())).size === options.length && typeof q.correct_option === "number" && q.correct_option >= 0 && q.correct_option < options.length;
    if (ok) return { ...base, type: "reading", data: { passage: ctx.text, passageTitle: ctx.title || undefined, aspect, options }, answer: { correct: q.correct_option!, evidence, criteria } };
    // a broken choice becomes an open question when there is an answer to it
    if (!sample) return null;
  }
  if (!sample && !criteria.length) return null;
  return base;
}

/** Questions for a text. Questions asking the same are dropped; missing ones are asked for once more. */
export async function generateReadingQuestions(r: ReadingQuestionsRequest, meta: AIMeta = {}): Promise<{ tasks: TaskDraft[]; dropped: number } | { error: string }> {
  // each question goes to its slot of the plan; the plan decides aspect and format
  const ask = async (slots: number[], avoid: string[]): Promise<[number, TaskDraft][] | { error: string }> => {
    const plan = slots.map((i) => r.plan[i]);
    const out = await runAI("lesen", QuestionsSchema, QUESTION_SYSTEM, readingQuestionsPrompt({ ...r, plan, avoid }), {
      maxTokens: Math.min(24_000, 3_000 + plan.length * 900 + Math.round(r.text.length / 3)),
      meta: { ...meta, trigger: meta.trigger ?? "lesefragen" },
    });
    if (!out.ok) return { error: out.message };
    const got = new Map<number, TaskDraft>();
    for (const q of out.data.questions) {
      const k = q.slot - 1;
      if (k < 0 || k >= slots.length || got.has(slots[k])) continue;
      const slot = r.plan[slots[k]];
      const d = aiQuestionToDraft({ ...q, aspect: slot.aspect, format: slot.format }, { subject: r.subject, title: r.title, text: r.text, difficulty: r.difficulty, slot });
      if (d) got.set(slots[k], d);
    }
    return [...got.entries()];
  };
  const kept = new Map<number, TaskDraft>();
  let dropped = 0;
  const take = (entries: [number, TaskDraft][]) => {
    for (const [i, d] of entries.sort(([a], [b]) => a - b)) {
      if ([...kept.values()].some((k) => similarity(k.prompt, d.prompt) >= SIMILAR)) dropped++;
      else kept.set(i, d);
    }
  };
  const all = r.plan.map((_, i) => i);
  const first = await ask(all, r.avoid ?? []);
  if ("error" in first) return first;
  take(first);
  // fewer than asked for (unusable, or asking the same as another): once more for the missing ones, never more
  const missing = all.filter((i) => !kept.has(i));
  if (missing.length) {
    const again = await ask(missing, [...(r.avoid ?? []), ...[...kept.values()].map((t) => t.prompt)]);
    if (!("error" in again)) take(again);
  }
  return { tasks: [...kept.entries()].sort(([a], [b]) => a - b).map(([, d]) => d), dropped };
}
