/**
 * The exercise builder: settings → student context → tasks (AI or built-in generators) → draft
 * exercise the teacher checks, edits and releases. Works without AI; with a key, Claude gets the
 * student's context and returns structured tasks (lib/ai.ts).
 */
import { aiEnabled, generatePlanWithAI, type AIMeta } from "./ai";
import { DIFFICULTIES, categoriesFor, difficultyFor, mixFor, type Category, type Difficulty, type TaskType } from "./curriculum";
import { generateForSlot } from "./generators";
import { expectedFixes } from "./fix-text";
import { checkOwnSolution } from "./math-task";
import { regenerateReadingQuestion } from "./lesen-draft";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { activeMaterial, materialLabel, materialSkills, MATERIAL_SOURCES } from "./current-material";
import { daysUntil, dayOf } from "./exams";
import { nextSteps } from "./recommend";
import { masteryStatus } from "./mastery";
import { analyzeStudent } from "./service";
import { gapCount, GAP, type TaskDraft } from "./tasks";
import { runningUnitForStudent } from "./units";

export const AUTO = "automatisch";
export type DifficultyChoice = Difficulty | typeof AUTO;
export const COUNT_CHOICES = [5, 10, 15, 20];

export type BuilderSettings = {
  studentId: number | null;
  subject: string;
  schoolType: string;
  klasse: number;
  skillIds: string[];
  difficulty: DifficultyChoice;
  count: number;
  /** Task types (CATEGORIES keys); empty = mixed. */
  categories: string[];
  focus: string;
  useAI: boolean;
  title: string;
};

export function settingsFromForm(f: FormData): BuilderSettings {
  const str = (k: string) => String(f.get(k) ?? "").trim();
  const difficulty = str("difficulty");
  return {
    studentId: Number(f.get("student_id")) || null,
    subject: str("subject"),
    schoolType: str("school_type") || "Mittelschule",
    klasse: Number(f.get("klasse")) || 1,
    skillIds: f.getAll("skill_ids").map(String).filter(Boolean),
    difficulty: difficulty === AUTO || (DIFFICULTIES as readonly string[]).includes(difficulty) ? (difficulty as DifficultyChoice) : "mittel",
    count: Math.max(1, Math.min(30, Number(f.get("count")) || 10)),
    categories: f.getAll("categories").map(String).filter(Boolean),
    focus: str("focus").slice(0, 500),
    useAI: f.get("use_ai") === "on",
    title: str("title").slice(0, 120),
  };
}

export function parseSettings(raw: string | null | undefined): Partial<BuilderSettings> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<BuilderSettings>;
  } catch {
    return {};
  }
}

// ---------- student context ----------
export type Suggestion = { key: string; skillIds: string[]; title: string; reason: string; difficulty: DifficultyChoice; categories: string[] };
export type StudentContext = {
  studentId: number;
  name: string;
  first: string;
  level: string;
  schoolType: string;
  klasse: number;
  subjects: string[];
  topics: string;
  weaknessesNote: string;
  strengthsNote: string;
  goals: string;
  weakSkills: { id: string; label: string; mastery: number }[];
  strongSkills: { id: string; label: string; mastery: number }[];
  errors: { label: string; count: number; skillIds: string[] }[];
  mastery: Record<string, number | null>;
  suggestions: Suggestion[];
  /** Aktueller Stoff per subject (lib/current-material.ts). */
  current: { subject: string; label: string; skillIds: string[] }[];
  /** Planned Schularbeiten/tests in the next 30 days, soonest first. */
  exams: (repo.TestResult & { days: number })[];
};

/** Words too general to tie an error to a skill ("Bruch" is in every fraction skill). */
const GENERIC = new Set(["bruch", "brüche", "zahlen", "ganze", "richtig", "falsch", "falschen", "rechnen"]);
/** How errors are usually written vs. the word in the skill name. */
const SYNONYMS: Record<string, string> = { umgedreht: "kehrwert", umdrehen: "kehrwert", hauptnenner: "nenner", gleichnamig: "nenner" };
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((w) => w.length >= 5 && !GENERIC.has(w))
    .map((w) => SYNONYMS[w] ?? w);
/** "Textaufgaben" in a note → textaufgabe; used to suggest task types from what the teacher wrote. */
const CATEGORY_WORDS: [RegExp, string][] = [
  [/textaufgabe|sachaufgabe/i, "textaufgabe"],
  [/rechtschreib/i, "rechtschreibung"],
  [/wortart/i, "wortarten"],
  [/lesen|textverständnis|reading/i, "textverstaendnis"],
  [/vokabel|vocab/i, "vocabulary"],
  [/übersetz|translation/i, "translation"],
];

const formatDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("de-AT", { day: "numeric", month: "short" });

export function skillLabel(s: repo.Skill, all: repo.Skill[]): string {
  const parent = s.parent_id ? all.find((p) => p.id === s.parent_id) : null;
  return parent ? `${parent.name} › ${s.name}` : s.name;
}

export function studentContext(studentId: number): StudentContext | null {
  const student = repo.getStudent(studentId);
  const analysis = analyzeStudent(studentId);
  if (!student || !analysis) return null;
  const all = repo.listSkills();
  const mastery: Record<string, number | null> = {};
  for (const st of analysis.skills) mastery[st.skill.id] = st.mastery;
  const klasse = student.klasse ?? 1;
  const suggestions: Suggestion[] = [];
  const add = (sg: Suggestion) => {
    if (!suggestions.some((x) => x.skillIds.join() === sg.skillIds.join())) suggestions.push(sg);
  };
  // 0) the current material comes first and is preselected (Aktueller Stoff, per subject)
  const current = activeMaterial(studentId);
  for (const cm of current) {
    // no skills chosen yet: the best match for the topic, also above the student's class, as a suggestion only
    const { ids, suggested } = materialSkills(cm, student);
    const reason = `Aktueller Stoff seit ${formatDay(cm.since)} · ${MATERIAL_SOURCES[cm.source] ?? cm.source}${suggested ? " · passende Fähigkeit vorgeschlagen" : ""}`;
    if (ids.length) add({ key: `stoff:${cm.id}`, skillIds: ids, title: `Aktueller Stoff: ${materialLabel(cm)}`, reason, difficulty: AUTO, categories: [] });
  }
  // 1) frequent errors that match a sub-skill ("Kehrwert vergessen" → "Kehrwert korrekt bilden")
  for (const e of analysis.errors.filter((x) => x.count >= 2).slice(0, 6)) {
    const ew = new Set(words(e.label));
    const subs = all.filter((s) => s.parent_id && e.skillIds.includes(s.parent_id));
    const score = (s: repo.Skill) => words(s.name).filter((w) => ew.has(w)).length;
    const sub = subs.filter((s) => score(s) > 0).sort((a, b) => score(b) - score(a))[0];
    if (sub) {
      const parentMastery = mastery[sub.parent_id!] ?? null;
      add({ key: `fehler:${sub.id}`, skillIds: [sub.id], title: skillLabel(sub, all), reason: `Fehler „${e.label}“ ${e.count}× gemacht`, difficulty: AUTO, categories: ["fehler", "rechnung"].filter((c) => categoriesFor(sub.subject).some((x) => x.key === c)) });
      void parentMastery;
    }
  }
  // 2) the central recommendation (lib/recommend.ts): exam, current material, weak skills …
  for (const r of nextSteps(studentId, { today: dayOf(new Date()), limit: 4 })) {
    add({ key: `empfehlung:${r.skill.id}`, skillIds: [r.skill.id], title: skillLabel(r.skill, all), reason: r.reason, difficulty: AUTO, categories: [] });
  }
  // 3) what the teacher wrote in the profile (current topics, weaknesses, goals)
  const noteText = `${student.current_topics}\n${student.weaknesses_note}\n${student.goals}`;
  const noteWords = new Set(words(noteText));
  const noteCategories = CATEGORY_WORDS.filter(([re]) => re.test(noteText)).map(([, c]) => c);
  for (const s of all.filter((x) => student.subjects.includes(x.subject) && klasse > 0)) {
    const hit = words(s.name).some((w) => noteWords.has(w)) || (!s.parent_id && words(s.area).some((w) => noteWords.has(w)) && words(s.name).some((w) => noteText.toLowerCase().includes(w.slice(0, 6))));
    if (hit) add({ key: `profil:${s.id}`, skillIds: [s.id], title: skillLabel(s, all), reason: "steht im Profil (Themen, Schwächen oder Ziele)", difficulty: AUTO, categories: noteCategories.filter((c) => categoriesFor(s.subject).some((x) => x.key === c)) });
  }
  return {
    studentId,
    name: student.name,
    first: student.name.split(" ")[0],
    level: klassenLabel(student.school_type, student.klasse),
    schoolType: student.school_type,
    klasse,
    subjects: student.subjects,
    topics: student.current_topics,
    weaknessesNote: student.weaknesses_note,
    strengthsNote: student.strengths_note,
    goals: student.goals,
    weakSkills: analysis.weaknesses.slice(0, 5).map((w) => ({ id: w.skill.id, label: skillLabel(w.skill, all), mastery: w.mastery! })),
    strongSkills: analysis.strengths.slice(0, 5).map((w) => ({ id: w.skill.id, label: skillLabel(w.skill, all), mastery: w.mastery! })),
    errors: analysis.errors.slice(0, 6).map((e) => ({ label: e.label, count: e.count, skillIds: e.skillIds })),
    mastery,
    suggestions: suggestions.slice(0, 6),
    current: current.map((cm) => ({ subject: cm.subject, label: materialLabel(cm), skillIds: cm.skill_ids })),
    exams: repo
      .upcomingTests(dayOf(new Date()), studentId)
      .map((t) => ({ ...t, days: daysUntil(t.date, dayOf(new Date())) }))
      .filter((t) => t.days <= 30),
  };
}


/**
 * What Claude learns about the student: structured learning data only. No name, no free-text
 * notes from the profile (they can hold personal details); the chosen skills with their
 * Lernstand, typical errors and an upcoming exam are enough to fit the tasks.
 */
export type AIStudentData = {
  school_type: string;
  klasse: number;
  official_grade: number;
  subject: string;
  topics: string[];
  skills: { skill_id: string; name: string; student_skill_score: number | null; status: string }[];
  common_errors: { label: string; count: number }[];
  exam_in_days: number | null;
  exam_topics: string[];
  /** Aktueller Stoff in this subject (Thema/Unterthema only; the teacher's note is not sent). */
  current_topic: string | null;
};
export function aiStudentData(ctx: StudentContext, skillIds: string[]): AIStudentData {
  const all = repo.listSkills();
  const chosen = all.filter((s) => skillIds.includes(s.id));
  // the chosen skills, their parents and their neighbours in the same topic
  const related = all.filter((s) => chosen.some((c) => c.area === s.area && c.subject === s.subject));
  const subject = chosen[0]?.subject ?? ctx.subjects[0] ?? "";
  const ids = new Set(related.map((s) => s.id));
  const exam = ctx.exams.find((e) => e.subject === subject || e.skill_ids.some((id) => ids.has(id)));
  return {
    school_type: ctx.schoolType,
    klasse: ctx.klasse,
    official_grade: schulstufe(ctx.schoolType, ctx.klasse),
    subject,
    topics: [...new Set(chosen.map((s) => s.area))],
    skills: related.map((s) => ({ skill_id: s.id, name: skillLabel(s, all), student_skill_score: ctx.mastery[s.id] == null ? null : Math.round(ctx.mastery[s.id]! * 100) / 100, status: masteryStatus(ctx.mastery[s.id] ?? null) })),
    common_errors: ctx.errors.filter((e) => e.skillIds.some((id) => ids.has(id))).map((e) => ({ label: e.label, count: e.count })),
    exam_in_days: exam ? exam.days : null,
    exam_topics: exam ? (exam.topics?.length ? exam.topics : [exam.topic].filter(Boolean)) : [],
    current_topic: ctx.current.find((c) => c.subject === subject)?.label ?? null,
  };
}
export function contextForAI(ctx: StudentContext, skillIds: string[]): string {
  const d = aiStudentData(ctx, skillIds);
  const lines = [
    `Schulart: ${d.school_type}, ${d.klasse}. Klasse (Schulstufe ${d.official_grade})`,
    `Fach: ${d.subject}${d.topics.length ? ` · Thema: ${d.topics.join(", ")}` : ""}`,
    `Lernstand (skill_id: Fähigkeit – Wert 0–1, Status):`,
    ...d.skills.map((s) => `- ${s.skill_id}: ${s.name} – ${s.student_skill_score ?? "keine Daten"}, ${s.status}`),
    d.common_errors.length ? `Typische Fehler: ${d.common_errors.map((e) => `${e.label} (${e.count}×)`).join(", ")}` : "",
    d.current_topic ? `Aktueller Stoff in der Schule: ${d.current_topic}` : "",
    d.exam_in_days !== null ? `Prüfung in ${d.exam_in_days} Tagen${d.exam_topics.length ? `, Stoff: ${d.exam_topics.join(", ")}` : ""}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------- generating ----------
type ResolvedSkill = { skill: repo.Skill; parent: repo.Skill | null; difficulty: Difficulty };

function resolveSkills(s: BuilderSettings, ctx: StudentContext | null): ResolvedSkill[] {
  const all = repo.listSkills();
  return s.skillIds
    .map((id) => all.find((x) => x.id === id))
    .filter((x): x is repo.Skill => Boolean(x))
    .map((skill) => {
      const parent = skill.parent_id ? (all.find((p) => p.id === skill.parent_id) ?? null) : null;
      const m = ctx ? (ctx.mastery[skill.id] ?? (parent ? ctx.mastery[parent.id] : null) ?? null) : null;
      return { skill, parent, difficulty: s.difficulty === AUTO ? difficultyFor(m) : s.difficulty };
    });
}

export type PlanSlot = { skill: ResolvedSkill; category: string | null };

/**
 * The type of each task before anything is generated. Chosen types take turns; "Gemischte Aufgaben"
 * (no type chosen) takes the types that fit each skill in turn (lib/curriculum.ts mixFor), so the
 * exercise gets gap texts, corrections and free answers instead of mostly multiple choice.
 */
export function planSlots(subject: string, skills: ResolvedSkill[], cats: Category[], count: number): PlanSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const skill = skills[i % skills.length];
    // the types rotate across the tasks and across the skills, so every type comes about equally often
    // and every skill gets different types
    const turn = Math.floor(i / skills.length) + (i % skills.length);
    if (cats.length) return { skill, category: cats[turn % cats.length].key };
    const mix = mixFor(subject, skill.skill.id);
    return { skill, category: mix[turn % mix.length] ?? null };
  });
}

const typeName = (subject: string, key: string | null) => (key ? (categoriesFor(subject).find((c) => c.key === key)?.label ?? key) : "");

export async function generateTasks(
  s: BuilderSettings,
  ctx: StudentContext | null,
  o: { count?: number; avoid?: string[]; skillIds?: string[]; categories?: string[]; difficulty?: DifficultyChoice; meta?: AIMeta } = {},
): Promise<{ tasks: TaskDraft[]; source: "ki" | "generator"; aiError?: string }> {
  const settings = { ...s, skillIds: o.skillIds ?? s.skillIds, categories: o.categories ?? s.categories, difficulty: o.difficulty ?? s.difficulty };
  const skills = resolveSkills(settings, ctx);
  if (!skills.length) throw new Error("Bitte mindestens eine Fähigkeit auswählen.");
  const count = Math.max(1, Math.min(30, o.count ?? settings.count));
  const cats: Category[] = categoriesFor(settings.subject).filter((c) => settings.categories.includes(c.key));
  const plan = planSlots(settings.subject, skills, cats, count);
  const slots: (TaskDraft | null)[] = plan.map(() => null);
  let aiError: string | undefined;
  let fromAI = 0;

  if (settings.useAI && aiEnabled()) {
    try {
      // the AI gets the plan; what does not come back in its type is asked for once more
      for (let round = 0; round < 2; round++) {
        const open = plan.map((p, i) => i).filter((i) => !slots[i]);
        if (!open.length) break;
        const got = await generatePlanWithAI(
          {
            subject: settings.subject,
            level: klassenLabel(settings.schoolType, settings.klasse),
            skills: skills.map((r) => ({ id: r.skill.id, name: r.skill.name, area: r.skill.area, parentName: r.parent?.name, difficulty: r.difficulty })),
            count: open.length,
            categories: cats,
            plan: open.map((i) => ({ skillId: plan[i].skill.skill.id, category: plan[i].category ?? categoriesFor(settings.subject)[0]?.key ?? "" })),
            studentContext: ctx ? contextForAI(ctx, skills.map((r) => r.skill.id)) : null,
            focusNote: settings.focus,
            avoid: [...(o.avoid ?? []), ...slots.filter((t): t is TaskDraft => Boolean(t)).map((t) => t.prompt)],
          },
          o.meta,
        );
        if (!got) break;
        got.forEach((t, k) => {
          if (t) slots[open[k]] = t;
        });
      }
      fromAI = slots.filter(Boolean).length;
      if (!fromAI) aiError = "Die KI hat keine Aufgaben geliefert.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  // the rest (or everything without AI) from the built-in generators, slot by slot
  const avoid = new Set([...(o.avoid ?? []), ...slots.filter((t): t is TaskDraft => Boolean(t)).map((t) => t.prompt)]);
  const missedType: string[] = [];
  for (let i = 0; i < plan.length; i++) {
    if (slots[i]) continue;
    const { skill: r, category } = plan[i];
    let t: TaskDraft | null = null;
    for (let guard = 0; guard < 12; guard++) {
      t = generateForSlot({ skillId: r.skill.id, skillName: r.skill.name, generatorSkillId: r.parent?.id, difficulty: r.difficulty, category, subject: settings.subject }, Math.random, Math.floor(i / skills.length) + guard);
      if (!avoid.has(t.prompt) || guard >= 10) break;
    }
    avoid.add(t!.prompt);
    if (category && t!.category !== category) missedType.push(typeName(settings.subject, category));
    slots[i] = t;
  }
  // parents count too, so the progress of "Dividieren" also moves when "Kehrwert" is practised
  const tasks = slots.map((t) => ({ ...t!, skillIds: [...new Set([...(t!.skillIds ?? []), ...(t!.skillIds ?? []).map((id) => skills.find((r) => r.skill.id === id)?.parent?.id).filter((x): x is string => Boolean(x))])] }));
  const notes = [
    aiError,
    fromAI && fromAI < count ? `${count - fromAI} ${count - fromAI === 1 ? "Aufgabe kam" : "Aufgaben kamen"} von der KI nicht im gewünschten Typ und ${count - fromAI === 1 ? "wurde" : "wurden"} ohne KI erstellt.` : "",
    missedType.length ? `Ohne KI gibt es ${[...new Set(missedType)].join(" und ")} für diese Fähigkeit nicht: ${missedType.length === 1 ? "eine Aufgabe ist" : `${missedType.length} Aufgaben sind`} stattdessen eine freie Antwort.` : "",
  ].filter(Boolean);
  return { tasks, source: fromAI ? "ki" : "generator", aiError: notes.length ? notes.join(" ") : undefined };
}

function autoTitle(s: BuilderSettings, ctx: StudentContext | null) {
  const all = repo.listSkills();
  const chosen = all.filter((x) => s.skillIds.includes(x.id));
  const areas = [...new Set(chosen.map((x) => x.area))];
  const what = chosen.length === 1 ? `${chosen[0].area}: ${skillLabel(chosen[0], all)}` : areas.length === 1 ? `${areas[0]}: ${chosen.map((x) => x.name).join(", ")}` : areas.join(", ");
  return `${ctx ? `${ctx.first} – ` : ""}${what}`.slice(0, 120);
}

/** Generates tasks and stores them as a draft exercise for the preview. */
export async function createDraft(s: BuilderSettings, teacherId: number | null, o: { empty?: boolean } = {}): Promise<{ id: number; aiError?: string }> {
  const ctx = s.studentId ? studentContext(s.studentId) : null;
  const all = repo.listSkills();
  const chosen = all.filter((x) => s.skillIds.includes(x.id));
  let tasks: TaskDraft[] = [];
  let source: repo.Worksheet["source"] = "manuell";
  let aiError: string | undefined;
  if (!o.empty) {
    const out = await generateTasks(s, ctx, { meta: { teacherId, trigger: "uebung" } });
    tasks = out.tasks;
    source = out.source;
    aiError = out.aiError;
  }
  const id = repo.createWorksheet(
    {
      title: s.title || autoTitle(s, ctx),
      subject: s.subject,
      grade: schulstufe(s.schoolType, s.klasse),
      school_type: s.schoolType,
      klasse: s.klasse,
      topic: [...new Set(chosen.map((x) => x.area))].join(", "),
      difficulty: s.difficulty,
      task_type: s.categories.length ? s.categories.join(",") : "mixed",
      kind: "uebung",
      source,
      skill_ids: chosen.map((x) => x.id),
      student_id: s.studentId,
      status: "entwurf",
      teacher_id: teacherId,
      settings: JSON.stringify(s),
    },
    tasks,
  );
  return { id, aiError };
}

/** Settings of an exercise for regenerating tasks; older exercises get them rebuilt from their columns. */
export function settingsOf(w: repo.Worksheet): BuilderSettings {
  const saved = parseSettings(w.settings);
  return {
    studentId: w.student_id,
    subject: w.subject,
    schoolType: w.school_type || "Mittelschule",
    klasse: w.klasse ?? 1,
    skillIds: w.skill_ids,
    // library and diagnosis exercises mix difficulties ("gemischt"): new tasks then come at "mittel"
    difficulty: w.difficulty === AUTO || (DIFFICULTIES as readonly string[]).includes(w.difficulty) ? (w.difficulty as DifficultyChoice) : "mittel",
    count: 10,
    categories: [],
    focus: "",
    useAI: aiEnabled(),
    title: w.title,
    ...saved,
  };
}

/** Replaces one task by a new one for the same skill and type (optionally at another difficulty). */
export async function regenerateTask(taskId: number, o: { difficulty?: Difficulty; useAI?: boolean; teacherId?: number | null } = {}): Promise<{ ok: boolean; aiError?: string }> {
  // a question about the shared reading text: another question about the same text (lib/lesen-draft.ts)
  const reading = await regenerateReadingQuestion(taskId, o.teacherId ?? null, o.difficulty);
  if (reading) return reading;
  const task = repo.getTask(taskId);
  const w = task ? repo.getWorksheet(task.worksheet_id) : null;
  if (!task || !w) return { ok: false };
  const s = { ...settingsOf(w), useAI: o.useAI ?? settingsOf(w).useAI };
  const ctx = s.studentId ? studentContext(s.studentId) : null;
  const skillIds = task.skillId ? [task.skillId] : s.skillIds;
  const difficulty = o.difficulty ?? (task.difficulty as Difficulty);
  const others = repo.listTasks(w.id).map((t) => t.prompt);
  const out = await generateTasks(s, ctx, { count: 1, avoid: others, skillIds, categories: task.category ? [task.category] : [], difficulty, meta: { teacherId: o.teacherId ?? null, trigger: "neu_erstellen" } });
  const next = out.tasks[0];
  if (!next) return { ok: false, aiError: out.aiError };
  repo.updateTask(taskId, { ...next, difficulty });
  // new content, new origin: the old source and licence (e.g. an imported OER task) do not apply any more
  repo.setTaskOrigin(taskId, { sourceType: next.sourceType ?? "eigen" });
  return { ok: true, aiError: out.aiError };
}

// ---------- manual tasks and checks ----------
export function blankTask(format: TaskType, skillId: string | null, category: string | null, difficulty: Difficulty): TaskDraft {
  const base = { skillId, skillIds: skillId ? [skillId] : [], category, difficulty, prompt: "", data: {}, solution: "", hints: [], errorMap: [] };
  switch (format) {
    case "mc":
      return { ...base, type: "mc", data: { options: ["", "", ""] }, answer: { correct: 0 } };
    case "reading":
      return { ...base, type: "reading", data: { passage: "", options: ["", "", ""] }, answer: { correct: 0 } };
    case "cloze":
      return { ...base, type: "cloze", prompt: `… ${GAP} …`, answer: { blanks: [[""]], mode: "text" } };
    case "free":
      return { ...base, type: "free", data: { lines: 5 }, answer: { sample: "", criteria: [] } };
    case "fix":
      return { ...base, type: "fix", prompt: "Im Text sind Fehler. Schreibe ihn richtig.", data: { faulty: "" }, answer: { accepted: [""], mode: "exact", fixes: [], criteria: [] } };
    case "order":
      return { ...base, type: "order", data: { steps: ["", "", ""] }, answer: { steps: ["", "", ""] } };
    case "rechenweg":
      return { ...base, type: "rechenweg", prompt: "Löse die Gleichung. Schreib jeden Rechenschritt in eine eigene Zeile.", data: { start: "" }, answer: { accepted: [""], needWay: true }, solutionSteps: [] };
    case "sachaufgabe":
      return {
        ...base,
        type: "sachaufgabe",
        data: { parts: [{ label: "a)", prompt: "", kind: "zahl" }, { label: "b)", prompt: "", kind: "zahl" }, { label: "c)", prompt: "", kind: "text", lines: 3 }] },
        answer: { parts: [{ accepted: [""] }, { accepted: [""] }, { sample: "" }] },
      };
    case "grammar":
      return { ...base, type: "grammar", answer: { accepted: [""], mode: "text" } };
    default:
      return { ...base, type: "calc", answer: { accepted: [""], mode: "value" } };
  }
}

/** What is missing before a task can be given to a student; null when it is complete. */
export function checkTask(t: TaskDraft): string | null {
  if (!t.prompt.trim() || t.prompt.trim() === `… ${GAP} …`) return "Die Aufgabenstellung fehlt.";
  if (!t.skillId) return "Bitte eine Fähigkeit zuordnen.";
  if (t.type === "mc" || t.type === "reading") {
    if (t.data.options) {
      if (t.data.options.filter((o) => o.trim()).length < 2 || t.data.options.some((o) => !o.trim())) return "Jede Antwortmöglichkeit braucht einen Text (mindestens zwei).";
      if (typeof t.answer.correct !== "number" || t.answer.correct < 0 || t.answer.correct >= t.data.options.length) return "Bitte die richtige Antwort markieren.";
    } else if (!t.answer.sample?.trim()) return "Die Musterlösung fehlt.";
    if (t.type === "reading" && !t.data.passage?.trim()) return "Der Lesetext fehlt.";
  }
  if (t.type === "calc" || t.type === "grammar") {
    if (!t.answer.accepted?.some((a) => a.trim())) return "Die richtige Antwort fehlt.";
  }
  if (t.type === "cloze") {
    const gaps = gapCount(t.prompt);
    if (gaps === 0) return `Der Lückentext braucht mindestens eine Lücke (${GAP}).`;
    if (!t.answer.blanks || t.answer.blanks.length !== gaps || t.answer.blanks.some((b) => !b.some((x) => x.trim()))) return `Für jede der ${gaps} Lücken braucht es eine Lösung.`;
  }
  if (t.type === "free" && !(t.answer.sample?.trim() || t.solution.trim() || t.answer.criteria?.some((c) => c.trim()))) return "Musterlösung, Erwartung oder Lösungsweg fehlt.";
  if (t.type === "fix") {
    if (!t.data.faulty?.trim()) return "Der Text mit Fehlern fehlt.";
    const right = (t.answer.accepted ?? []).filter((a) => a.trim());
    if (!right.length) return "Der verbesserte Text fehlt.";
    if (right.some((a) => expectedFixes(t.data.faulty!, a, t.answer.mode !== "text").length === 0)) return "Der verbesserte Text ist gleich wie der Text mit Fehlern.";
  }
  if (t.type === "rechenweg" || t.type === "sachaufgabe") {
    const problem = checkOwnSolution(t);
    if (problem) return problem;
  }
  if (t.type === "order" && (!t.answer.steps || t.answer.steps.filter((x) => x.trim()).length < 2 || t.answer.steps.some((x) => !x.trim()))) return "Mindestens zwei Schritte, jeder mit Text.";
  return null;
}

/** Cleans an edited task: trims, drops empty extras, shuffles order steps for the student. */
export function normalizeTask(t: TaskDraft): TaskDraft {
  const out: TaskDraft = { ...t, prompt: t.prompt.trim(), solution: t.solution.trim(), hints: t.hints.map((h) => h.trim()).filter(Boolean), errorMap: t.errorMap.filter((e) => e.answer.trim() && e.label.trim()) };
  out.skillIds = [...new Set([t.skillId, ...(t.skillIds ?? [])].filter((x): x is string => Boolean(x)))];
  if (out.type === "calc" || out.type === "grammar") out.answer = { ...out.answer, accepted: (out.answer.accepted ?? []).map((a) => a.trim()).filter(Boolean) };
  if (out.answer.criteria) out.answer = { ...out.answer, criteria: out.answer.criteria.map((c) => c.trim()).filter(Boolean) };
  // Leseverständnis: Belege without text are dropped, the paragraph is a number from 1
  if (out.answer.evidence) out.answer = { ...out.answer, evidence: out.answer.evidence.map((e) => ({ paragraph: Math.max(1, Math.round(Number(e.paragraph)) || 1), quote: String(e.quote ?? "").trim().slice(0, 600) })).filter((e) => e.quote) };
  if (out.type === "fix" && out.data.faulty) {
    // the described errors follow the texts: one per difference, the teacher's labels kept
    const faulty = out.data.faulty.trim();
    const accepted = (out.answer.accepted ?? []).map((a) => a.trim()).filter(Boolean);
    const cs = out.answer.mode !== "text";
    const old = out.answer.fixes ?? [];
    const fixes = accepted[0] ? expectedFixes(faulty, accepted[0], cs).map((f) => ({ ...f, label: old.find((o) => o.wrong === f.wrong && o.right === f.right)?.label?.trim() ?? "", errorType: old.find((o) => o.wrong === f.wrong && o.right === f.right)?.errorType ?? null })) : [];
    out.data = { ...out.data, faulty };
    out.answer = { ...out.answer, accepted, fixes };
  }
  if (out.type === "rechenweg") {
    out.data = { ...(out.data.start?.trim() ? { start: out.data.start.trim() } : {}), ...(out.data.variable?.trim() ? { variable: out.data.variable.trim().slice(0, 1) } : {}) };
    out.answer = { ...out.answer, accepted: (out.answer.accepted ?? []).map((a) => a.trim()).filter(Boolean), unit: out.answer.unit?.trim() || null };
    out.solutionSteps = (out.solutionSteps ?? []).map((l) => l.trim()).filter(Boolean);
  }
  if (out.type === "sachaufgabe") {
    const views = out.data.parts ?? [];
    out.data = { ...out.data, parts: views.map((v, i) => ({ ...v, label: v.label.trim() || `${String.fromCharCode(97 + i)})`, prompt: v.prompt.trim() })) };
    out.answer = {
      ...out.answer,
      parts: views.map((v, i) => {
        const p = out.answer.parts?.[i] ?? {};
        return v.kind === "text"
          ? { sample: p.sample?.trim() ?? "", criteria: (p.criteria ?? []).map((c) => c.trim()).filter(Boolean), solution: p.solution?.trim() }
          : { ...p, accepted: (p.accepted ?? []).map((a) => a.trim()).filter(Boolean), unit: p.unit?.trim() || null, follow: p.follow?.trim() || null, solution: p.solution?.trim() };
      }),
    };
  }
  if (out.type === "order" && out.answer.steps) {
    const steps = out.answer.steps.map((x) => x.trim());
    const same = out.data.steps && out.data.steps.length === steps.length && [...out.data.steps].sort().join("\u0000") === [...steps].sort().join("\u0000");
    let shown = same ? out.data.steps! : [...steps];
    if (!same || shown.every((x, i) => x === steps[i])) {
      for (let tries = 0; tries < 6 && (tries === 0 || shown.every((x, i) => x === steps[i])); tries++) {
        shown = [...steps];
        for (let i = shown.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shown[i], shown[j]] = [shown[j], shown[i]];
        }
      }
    }
    out.answer = { steps };
    out.data = { ...out.data, steps: shown };
  }
  return out;
}

/** Makes an exercise visible for students and, if a student is given, assigns it. */
export function releaseWorksheet(worksheetId: number, studentId: number | null): { error?: string; assignmentId?: number } {
  const tasks = repo.listTasks(worksheetId);
  if (!tasks.length) return { error: "Die Übung hat noch keine Aufgaben." };
  const bad = tasks.map((t, i) => [i + 1, checkTask(t)] as const).filter(([, e]) => e);
  if (bad.length) return { error: `Aufgabe ${bad[0][0]}: ${bad[0][1]}` };
  repo.updateWorksheetMeta(worksheetId, { status: "freigegeben" });
  if (!studentId) return {};
  const unit = runningUnitForStudent(studentId);
  return { assignmentId: repo.assignWorksheet(worksheetId, studentId, "", unit?.id ?? null) };
}

/** "An Schüler senden" for one task: a small released exercise with just this task. */
export function sendSingleTask(taskId: number, studentId: number, teacherId: number | null): { error?: string; worksheetId?: number; assignmentId?: number } {
  const task = repo.getTask(taskId);
  const w = task ? repo.getWorksheet(task.worksheet_id) : null;
  if (!task || !w) return { error: "Aufgabe nicht gefunden." };
  const problem = checkTask(task);
  if (problem) return { error: problem };
  const id = repo.duplicateWorksheet(w.id, { taskIds: [taskId], studentId, teacherId, status: "freigegeben", title: `${w.title} · Aufgabe ${task.position}` });
  if (!id) return { error: "Aufgabe nicht gefunden." };
  repo.setSourceTask(id, taskId);
  const unit = runningUnitForStudent(studentId);
  return { worksheetId: id, assignmentId: repo.assignWorksheet(id, studentId, "", unit?.id ?? null) };
}

// ---------- reuse ----------
/** Title of a copy for another student: "Max – Brüche" becomes "Lea – Brüche". */
function retitle(title: string, fromStudentId: number | null, toStudentId: number | null): string {
  const from = fromStudentId ? repo.getStudent(fromStudentId)?.name.split(" ")[0] : null;
  const to = toStudentId ? repo.getStudent(toStudentId)?.name.split(" ")[0] : null;
  const base = from && title.startsWith(`${from} – `) ? title.slice(from.length + 3) : title;
  return to ? `${to} – ${base}` : base;
}

/** Copy of an exercise as a new draft, for the same or another student. */
export function copyAsDraft(worksheetId: number, studentId: number | null, teacherId: number | null): number | null {
  const w = repo.getWorksheet(worksheetId);
  if (!w) return null;
  const id = repo.duplicateWorksheet(worksheetId, { studentId, teacherId, status: "entwurf", title: retitle(w.title, w.student_id, studentId) });
  if (id) repo.updateWorksheetMeta(id, { settings: JSON.stringify({ ...settingsOf(w), studentId }) });
  return id;
}

/** Saves the settings (and, if wanted, the tasks) of an exercise as a template. */
export function saveTemplate(worksheetId: number, name: string, withTasks: boolean, teacherId: number | null): number | null {
  const w = repo.getWorksheet(worksheetId);
  if (!w) return null;
  const { studentId: _s, title: _t, ...settings } = settingsOf(w);
  void _s;
  void _t;
  const count = repo.listTasks(worksheetId).length;
  return repo.createTemplate({ name: name.trim() || w.title, subject: w.subject, settings: JSON.stringify({ ...settings, count: count || settings.count }), source_worksheet_id: withTasks ? worksheetId : null, teacher_id: teacherId });
}

/** "Verwenden": a draft for the student, from the template's tasks or freshly generated from its settings. */
export async function draftFromTemplate(templateId: number, studentId: number | null, teacherId: number | null): Promise<{ id?: number; aiError?: string; error?: string }> {
  const tp = repo.getTemplate(templateId);
  if (!tp) return { error: "Vorlage nicht gefunden." };
  repo.noteTemplateUsed(templateId);
  const student = studentId ? repo.getStudent(studentId) : null;
  const first = student?.name.split(" ")[0];
  const title = first ? `${first} – ${tp.name}` : tp.name;
  if (tp.source_worksheet_id && repo.getWorksheet(tp.source_worksheet_id)) {
    const id = repo.duplicateWorksheet(tp.source_worksheet_id, { studentId, teacherId, status: "entwurf", title });
    return id ? { id } : { error: "Die Aufgaben der Vorlage gibt es nicht mehr." };
  }
  const saved = parseSettings(tp.settings);
  const s: BuilderSettings = {
    subject: tp.subject,
    skillIds: [],
    difficulty: AUTO,
    count: 10,
    categories: [],
    focus: "",
    useAI: aiEnabled(),
    ...saved,
    studentId,
    schoolType: student?.school_type || saved.schoolType || "Mittelschule",
    klasse: student?.klasse ?? saved.klasse ?? 1,
    title,
  };
  try {
    return await createDraft(s, teacherId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
