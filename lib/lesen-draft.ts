/**
 * Creating and changing a Leseverständnis exercise. It is an ordinary exercise draft (lib/builder.ts):
 * the teacher checks it in the preview, edits text, questions and sample answers, then sends it.
 */
import { aiEnabled } from "./ai";
import { generateReadingQuestions, generateReadingText, questionPlan } from "./ai/lesen";
import type { Difficulty } from "./curriculum";
import { aspectSkill, isAspect, isTextType, joinParagraphs, paragraphsOf, planAspects, READING_SKILL, readingSet, recommendedWords, templateQuestions, TEXT_TYPES, withText, wordCount, type Aspect, type ReadingText, type TextType } from "./lesen";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import type { TaskDraft } from "./tasks";

export type ReadingSettings = {
  studentId: number | null;
  subject: string;
  schoolType: string;
  klasse: number;
  /** eigen: the teacher's text, ki: a new text by the KI */
  textSource: "eigen" | "ki";
  title: string;
  text: string;
  topic: string;
  textType: TextType;
  difficulty: Difficulty;
  words: number;
  count: number;
  /** ki: the KI writes the questions, vorlage: question templates without KI */
  questions: "ki" | "vorlage";
  /** multiple choice allowed (at most one in four questions) */
  mc: boolean;
};

export function readingSettingsFromForm(f: FormData): ReadingSettings {
  const str = (k: string) => String(f.get(k) ?? "").trim();
  const schoolType = str("school_type") || "Mittelschule";
  const klasse = Number(f.get("klasse")) || 1;
  const rec = recommendedWords(schulstufe(schoolType, klasse));
  const difficulty = str("difficulty");
  const subject = str("subject");
  return {
    studentId: Number(f.get("student_id")) || null,
    subject: subject in READING_SKILL ? subject : "Deutsch",
    schoolType,
    klasse,
    textSource: str("text_source") === "ki" ? "ki" : "eigen",
    title: str("title").slice(0, 160),
    text: joinParagraphs(paragraphsOf(String(f.get("text") ?? "").slice(0, 30_000))),
    topic: str("topic").slice(0, 200),
    textType: isTextType(str("text_type")) ? (str("text_type") as TextType) : "erzaehlung",
    difficulty: difficulty === "leicht" || difficulty === "schwer" ? difficulty : "mittel",
    words: Math.max(80, Math.min(2000, Number(f.get("words")) || rec.default)),
    count: Math.max(2, Math.min(15, Number(f.get("count")) || 8)),
    questions: str("questions") === "ki" ? "ki" : "vorlage",
    mc: f.get("mc") === "on",
  };
}

/** Why the settings cannot be used yet, or null. */
export function readingProblem(s: ReadingSettings): string | null {
  if (s.textSource === "eigen") {
    if (!s.text) return "Füge den Lesetext ein.";
    if (wordCount(s.text) < 40) return "Der Text ist sehr kurz. Für mehrere Fragen braucht es mindestens 40 Wörter.";
  } else {
    if (!s.topic) return "Gib ein Thema für den Text an.";
    if (!aiEnabled("lesen")) return "Für einen neuen Text braucht es die KI. Ohne KI kannst du einen eigenen Text einfügen.";
  }
  return null;
}

export async function createReadingDraft(s: ReadingSettings, teacherId: number | null): Promise<{ id?: number; error?: string; warning?: "ki" | "weniger"; got?: number }> {
  const problem = readingProblem(s);
  if (problem) return { error: problem };
  const stufe = schulstufe(s.schoolType, s.klasse);
  const level = klassenLabel(s.schoolType, s.klasse);
  const meta = { teacherId, trigger: "leseverstaendnis" };
  let r: ReadingText = { title: s.title, text: s.text };
  if (s.textSource === "ki") {
    const made = await generateReadingText({ subject: s.subject, level, schulstufe: stufe, topic: s.topic, textType: s.textType, difficulty: s.difficulty, words: s.words }, meta);
    if ("error" in made) return { error: `Der Text konnte nicht erstellt werden: ${made.error}` };
    r = { title: s.title || made.title, text: made.text };
  }
  let warning: "ki" | "weniger" | undefined;
  let tasks: TaskDraft[] = [];
  let fromKI = false;
  if (s.questions === "ki" && aiEnabled("lesen")) {
    const plan = questionPlan(planAspects(s.count), { cloze: true, mc: s.mc });
    const out = await generateReadingQuestions({ subject: s.subject, level, title: r.title, text: r.text, difficulty: s.difficulty, plan }, meta);
    if ("error" in out || !out.tasks.length) warning = "ki";
    else {
      tasks = out.tasks;
      fromKI = true;
      if (tasks.length < s.count) warning = "weniger";
    }
  }
  if (!tasks.length) tasks = templateQuestions({ subject: s.subject, title: r.title, text: r.text, textType: s.textType, difficulty: s.difficulty, count: s.count, cloze: true });
  const student = s.studentId ? repo.getStudent(s.studentId) : null;
  const firstName = student?.name.split(" ")[0];
  const title = `${firstName ? `${firstName} – ` : ""}${s.subject === "Englisch" ? "Reading" : "Leseverständnis"}: ${r.title || s.topic || TEXT_TYPES[s.textType]}`.slice(0, 120);
  const skillIds = [...new Set(tasks.map((t) => t.skillId).filter((x): x is string => Boolean(x)))];
  const id = repo.createWorksheet(
    {
      title,
      subject: s.subject,
      grade: stufe,
      school_type: s.schoolType,
      klasse: s.klasse,
      topic: s.topic || r.title || "Leseverständnis",
      difficulty: s.difficulty,
      task_type: s.subject === "Englisch" ? "reading" : "textverstaendnis",
      kind: "uebung",
      source: fromKI || s.textSource === "ki" ? "ki" : "manuell",
      skill_ids: skillIds,
      student_id: s.studentId,
      status: "entwurf",
      teacher_id: teacherId,
      // builder settings so "Kopie" and templates keep working; lesen: how the text was made
      settings: JSON.stringify({
        studentId: s.studentId, subject: s.subject, schoolType: s.schoolType, klasse: s.klasse, skillIds: [READING_SKILL[s.subject]], difficulty: s.difficulty, count: tasks.length,
        categories: [s.subject === "Englisch" ? "reading" : "textverstaendnis"], focus: "", useAI: fromKI, title,
        lesen: { textSource: s.textSource, textType: s.textType, words: wordCount(r.text), questions: fromKI ? "ki" : "vorlage" },
      }),
    },
    tasks,
  );
  return { id, warning, got: tasks.length };
}

/** The editor changes the text (and title) once: every question of the exercise gets it. */
export function saveReadingText(worksheetId: number, r: ReadingText): { error?: string } {
  const tasks = repo.listTasks(worksheetId);
  if (!readingSet(tasks)) return { error: "Diese Übung hat keinen gemeinsamen Lesetext." };
  const text = joinParagraphs(paragraphsOf(r.text));
  if (wordCount(text) < 20) return { error: "Der Text ist zu kurz." };
  for (const t of withText(tasks, { title: r.title.trim(), text })) {
    const { id, worksheet_id: _w, position: _p, ...draft } = t;
    void _w, void _p;
    repo.updateTask(id, draft);
  }
  return {};
}

/** A new question for the text of a reading exercise: of the aspect asked for, with the text already in it. */
export function readingBlankQuestion(worksheetId: number, aspect: Aspect, format: "free" | "cloze" | "reading"): TaskDraft | null {
  const w = repo.getWorksheet(worksheetId);
  const r = readingSet(repo.listTasks(worksheetId));
  if (!w || !r) return null;
  const skill = aspectSkill(w.subject, aspect);
  const base = { skillId: skill, skillIds: [skill], category: w.subject === "Englisch" ? "reading" : "textverstaendnis", difficulty: (w.difficulty as Difficulty) || "mittel", prompt: "", solution: "", hints: [], errorMap: [], sourceType: "eigen" };
  const data = { passage: r.text, passageTitle: r.title || undefined, aspect };
  if (format === "cloze") return { ...base, type: "cloze", prompt: "Ergänze die Lücken mit Wörtern aus dem Text.\n… ___ …", data, answer: { blanks: [[""]], mode: "text", evidence: [] } };
  if (format === "reading") return { ...base, type: "reading", data: { ...data, options: ["", "", ""] }, answer: { correct: 0, evidence: [] } };
  return { ...base, type: "free", data: { ...data, lines: 4 }, answer: { sample: "", criteria: [], evidence: [] } };
}

/** "Neu erstellen" on a question of a reading exercise: another question of the same kind about the same text. */
export async function regenerateReadingQuestion(taskId: number, teacherId: number | null, difficulty?: Difficulty): Promise<{ ok: boolean; aiError?: string } | null> {
  const task = repo.getTask(taskId);
  const w = task ? repo.getWorksheet(task.worksheet_id) : null;
  if (!task || !w) return null;
  const tasks = repo.listTasks(w.id);
  const r = readingSet(tasks);
  if (!r) return null;
  const aspect: Aspect = isAspect(task.data.aspect) ? task.data.aspect : "info";
  const level = difficulty ?? (task.difficulty as Difficulty);
  const others = tasks.filter((t) => t.id !== taskId).map((t) => t.prompt);
  let next: TaskDraft | null = null;
  let aiError: string | undefined;
  if (aiEnabled("lesen")) {
    const format = task.type === "cloze" ? "lueckentext" : task.type === "reading" && task.data.options ? "mc" : "offen";
    const out = await generateReadingQuestions(
      { subject: w.subject, level: w.klasse ? klassenLabel(w.school_type, w.klasse) : `Schulstufe ${w.grade}`, title: r.title, text: r.text, difficulty: level, plan: [{ aspect, format }], avoid: [...others, task.prompt] },
      { teacherId, trigger: "neu_erstellen" },
    );
    if ("error" in out) aiError = out.error;
    else next = out.tasks[0] ?? null;
  }
  if (!next) {
    // without KI: a question template of this kind that the exercise does not have yet
    const settings = JSON.parse(w.settings || "{}") as { lesen?: { textType?: string } };
    const textType = isTextType(settings.lesen?.textType) ? (settings.lesen!.textType as TextType) : "erzaehlung";
    const pool = templateQuestions({ subject: w.subject, title: r.title, text: r.text, textType, difficulty: level, count: 12, cloze: task.type === "cloze" });
    const taken = new Set([...others, task.prompt]);
    next = pool.find((q) => q.data.aspect === aspect && !taken.has(q.prompt)) ?? pool.find((q) => !taken.has(q.prompt)) ?? null;
  }
  if (!next) return { ok: false, aiError };
  next = { ...next, difficulty: level };
  repo.updateTask(taskId, next);
  repo.setTaskOrigin(taskId, { sourceType: next.sourceType ?? "eigen" });
  return { ok: true, aiError };
}
