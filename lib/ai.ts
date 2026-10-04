import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Difficulty, TaskType } from "./curriculum";
import { TASK_TYPES } from "./curriculum";
import type { TaskDraft } from "./tasks";
import { GAP, gapCount } from "./tasks";

const MODEL = "claude-opus-5-5";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

/** One structured request with server-side fallback on refusals. Returns null when the model declines. */
async function ask<T extends z.ZodType>(schema: T, system: string, prompt: string, maxTokens = 16000, effort: "low" | "medium" = "medium") {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return null;
  return res.parsed_output as z.infer<T>;
}

// ---------- exercise generation ----------
const TaskSchema = z.object({
  type: z.enum(["mc", "calc", "free", "cloze", "grammar", "reading"]),
  skill_id: z.string().describe("Eine der vorgegebenen Skill-IDs"),
  prompt: z.string().describe(`Aufgabenstellung. Bei Lückentext jede Lücke als ${GAP} schreiben.`),
  passage: z.string().nullable().describe("Nur bei Textverständnis: der Lesetext (bei allen Fragen zum selben Text identisch)"),
  options: z.array(z.string()).nullable().describe("Nur bei Multiple Choice / Textverständnis mit Auswahl: 3-4 Antwortoptionen"),
  correct_option: z.number().int().nullable().describe("Index (0-basiert) der richtigen Option"),
  accepted_answers: z.array(z.string()).nullable().describe("Bei Rechnung/Grammatik (Kurzantwort): alle akzeptierten Lösungen"),
  numeric: z.boolean().describe("true, wenn die Kurzantwort eine Zahl/ein Bruch ist und wertgleiche Antworten zählen"),
  blanks: z.array(z.array(z.string())).nullable().describe("Bei Lückentext: pro Lücke die akzeptierten Lösungen"),
  sample_answer: z.string().nullable().describe("Bei Freitext: Musterlösung bzw. Erwartungshorizont"),
  solution: z.string().describe("Vollständiger Lösungsweg Schritt für Schritt, schülergerecht"),
  hints: z.array(z.string()).describe("1-2 gestufte Hilfen, die nicht die Lösung verraten"),
  common_errors: z
    .array(z.object({ answer: z.string(), label: z.string() }))
    .describe("Typische falsche Antworten und der dahinterliegende Fehler (kurzes Etikett, z. B. „Kehrwert vergessen“). Bei Multiple Choice: answer = Index der falschen Option als Zahl-String."),
});
const WorksheetSchema = z.object({ tasks: z.array(TaskSchema) });

export type AIGenerateRequest = {
  subject: string;
  /** e.g. "2. Klasse Mittelschule" */
  level: string;
  topic: string;
  skills: { id: string; name: string; area: string }[];
  difficulty: Difficulty;
  count: number;
  taskType: TaskType | "mixed";
  focusNote?: string;
};

const GEN_SYSTEM = `Du bist eine erfahrene Nachhilfelehrerin im österreichischen Schulsystem und erstellst Übungsaufgaben für eine Nachhilfe-Software.
Die Aufgaben werden automatisch korrigiert, daher müssen Lösungen eindeutig und fehlerfrei sein.
Schreib auf Deutsch (bei Englisch-Übungen sind Aufgaben und Texte auf Englisch, Erklärungen dürfen Deutsch sein).
Verwende österreichische Begriffe (Klasse, Hausübung, Schularbeit, Beistrich, Jänner).
Prüfe jede Lösung selbst nach, bevor du sie ausgibst. Bei Brüchen sind Ergebnisse vollständig gekürzt.
Lösungswege sind kurz, Schritt für Schritt und so formuliert, dass ein Kind der angegebenen Klasse und Schulform sie versteht.
Die typischen Fehler beschreiben echte Denkfehler, die Schülerinnen und Schüler bei diesem Thema machen.`;

export async function generateWithAI(req: AIGenerateRequest): Promise<TaskDraft[] | null> {
  const typeText = req.taskType === "mixed" ? "gemischt (Rechnung, Multiple Choice, Lückentext je nach Eignung)" : TASK_TYPES[req.taskType];
  const prompt = `Erstelle ${req.count} Aufgaben.
Fach: ${req.subject}
Klasse: ${req.level}
Thema: ${req.topic}
Schwierigkeit: ${req.difficulty}
Aufgabentyp: ${typeText}
Fähigkeiten (skill_id: Name) – verteile die Aufgaben auf diese:
${req.skills.map((s) => `- ${s.id}: ${s.area} › ${s.name}`).join("\n")}
${req.focusNote ? `\nBesonderer Fokus: ${req.focusNote}` : ""}

Regeln je Typ:
- mc: options + correct_option
- calc / grammar: accepted_answers (Kurzantwort, numeric=true bei Zahlen)
- cloze: prompt mit ${GAP} pro Lücke + blanks
- free: sample_answer
- reading: passage + options + correct_option (oder sample_answer für offene Fragen)`;
  const out = await ask(WorksheetSchema, GEN_SYSTEM, prompt, 32000);
  if (!out) return null;
  const validSkills = new Set(req.skills.map((s) => s.id));
  return out.tasks
    .map((t): TaskDraft | null => {
      const skillId = validSkills.has(t.skill_id) ? t.skill_id : (req.skills[0]?.id ?? null);
      const base = {
        skillId,
        difficulty: req.difficulty,
        prompt: t.prompt,
        solution: t.solution,
        hints: t.hints,
        errorMap: t.common_errors,
      };
      if (t.options && t.options.length >= 2 && t.correct_option !== null && t.correct_option < t.options.length) {
        return { ...base, type: t.type === "reading" ? "reading" : "mc", data: { options: t.options, passage: t.passage ?? undefined }, answer: { correct: t.correct_option } };
      }
      if (t.blanks && t.blanks.length > 0 && gapCount(t.prompt) === t.blanks.length) {
        return { ...base, type: "cloze", data: {}, answer: { blanks: t.blanks, mode: "text" } };
      }
      if (t.accepted_answers && t.accepted_answers.length > 0) {
        return { ...base, type: t.type === "grammar" ? "grammar" : "calc", data: {}, answer: { accepted: t.accepted_answers, mode: t.numeric ? "value" : "text" } };
      }
      const sample = t.sample_answer ?? t.solution;
      return { ...base, type: t.type === "reading" ? "reading" : "free", data: { passage: t.passage ?? undefined }, answer: { sample } };
    })
    .filter((t): t is TaskDraft => t !== null);
}

// ---------- free-text grading ----------
const GradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().describe("1-2 Sätze Rückmeldung direkt an die Schülerin / den Schüler (du-Form)"),
  error_label: z.string().nullable().describe("Kurzes Fehler-Etikett, wenn falsch, sonst null"),
});

export async function gradeFreeText(task: { prompt: string; passage?: string; sample: string }, answer: string) {
  return ask(
    GradeSchema,
    "Du korrigierst Schülerantworten in einer Nachhilfe-Software. Sei fair: inhaltlich richtige Antworten in eigenen Worten zählen als richtig. Rechtschreibfehler nur bewerten, wenn die Aufgabe Rechtschreibung prüft.",
    `${task.passage ? `Text:\n${task.passage}\n\n` : ""}Aufgabe:\n${task.prompt}\n\nErwartungshorizont:\n${task.sample}\n\nAntwort der Schülerin / des Schülers:\n${answer}`,
    2000,
    "low",
  );
}

// ---------- tutor-facing analysis ----------
const InsightSchema = z.object({
  summary: z.string().describe("3-5 Sätze Gesamteinschätzung für die Nachhilfelehrkraft"),
  next_lesson_plan: z.array(z.string()).describe("3-5 konkrete Schritte für die nächste Nachhilfestunde"),
  parent_note: z.string().describe("2-3 freundliche Sätze für die Eltern"),
});

export async function analyzeWithAI(studentContext: string) {
  return ask(
    InsightSchema,
    "Du unterstützt eine Nachhilfelehrkraft in Österreich. Du bekommst Lerndaten einer Schülerin / eines Schülers und formulierst eine präzise, ehrliche, ermutigende Einschätzung. Stütze dich nur auf die Daten.",
    studentContext,
    4000,
  );
}
