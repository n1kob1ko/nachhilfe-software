/**
 * Printable A4 worksheets: settings, how much room each task gets and the document a sheet is drawn
 * from. Built on demand from the exercise (or library entries); nothing is stored, the exercise stays
 * the source. Works the same for generated, hand-made and KI tasks.
 */
import { categoryLabel, TASK_TYPES } from "./curriculum";
import { textBlocks } from "./math-format";
import { GAP, type TaskDraft } from "./tasks";

export type Space = "klein" | "mittel" | "gross";
export type SolutionMode = "keine" | "seite" | "lehrer";
/** Extra field for working (Rechenfeld): auto = squared for maths, none for languages. */
export type FieldKind = "auto" | "kariert" | "liniert" | "leer" | "keins";

export type SheetOptions = {
  title: string;
  name: boolean;
  date: boolean;
  subject: boolean;
  klasse: boolean;
  topic: boolean;
  skill: boolean;
  numbers: boolean;
  space: Space;
  solutions: SolutionMode;
  pages: boolean;
  field: FieldKind;
  /** which document: the student sheet, or (with solutions = lehrer) the teacher version */
  fassung: "schueler" | "lehrer";
};

export const SPACE_LABEL: Record<Space, string> = {
  klein: "klein",
  mittel: "mittel",
  gross: "groß",
};
export const SOLUTION_LABEL: Record<SolutionMode, string> = {
  keine: "keine",
  seite: "separate Lösungsseite",
  lehrer: "separate Lehrerfassung",
};
export const FIELD_LABEL: Record<FieldKind, string> = {
  auto: "auto",
  kariert: "kariert",
  liniert: "liniert",
  leer: "leer",
  keins: "keins",
};

/** Defaults: a ready student sheet without changing anything. */
export const DEFAULTS: Omit<SheetOptions, "title"> = {
  name: true,
  date: true,
  subject: true,
  klasse: true,
  topic: true,
  skill: false,
  numbers: true,
  space: "mittel",
  solutions: "keine",
  pages: true,
  field: "auto",
  fassung: "schueler",
};

// short query keys, so a sheet can be linked and reloaded with its settings
const BOOL_KEYS = {
  name: "name",
  date: "datum",
  subject: "fach",
  klasse: "klasse",
  topic: "thema",
  skill: "skill",
  numbers: "nr",
  pages: "seiten",
} as const;
type BoolKey = keyof typeof BOOL_KEYS;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(
  v: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function readOptions(sp: Params, defaultTitle: string): SheetOptions {
  const o = {
    ...DEFAULTS,
    title: one(sp.titel)?.trim().slice(0, 140) || defaultTitle,
  };
  for (const k of Object.keys(BOOL_KEYS) as BoolKey[]) {
    const v = one(sp[BOOL_KEYS[k]]);
    if (v === "1" || v === "0") o[k] = v === "1";
  }
  o.space = pick(one(sp.platz), ["klein", "mittel", "gross"], DEFAULTS.space);
  o.solutions = pick(
    one(sp.loesungen),
    ["keine", "seite", "lehrer"],
    DEFAULTS.solutions,
  );
  o.field = pick(
    one(sp.feld),
    ["auto", "kariert", "liniert", "leer", "keins"],
    DEFAULTS.field,
  );
  // the teacher version exists only when it was chosen; everything else prints the student sheet
  o.fassung =
    o.solutions === "lehrer" && one(sp.fassung) === "lehrer"
      ? "lehrer"
      : "schueler";
  return o;
}

/** Query string of the settings that differ from the defaults (and the title, if changed). */
export function optionsQuery(
  o: SheetOptions,
  defaultTitle: string,
  extra: [string, string][] = [],
): string {
  const q = new URLSearchParams(extra);
  if (o.title !== defaultTitle) q.set("titel", o.title);
  for (const k of Object.keys(BOOL_KEYS) as BoolKey[])
    if (o[k] !== DEFAULTS[k]) q.set(BOOL_KEYS[k], o[k] ? "1" : "0");
  if (o.space !== DEFAULTS.space) q.set("platz", o.space);
  if (o.solutions !== DEFAULTS.solutions) q.set("loesungen", o.solutions);
  if (o.field !== DEFAULTS.field) q.set("feld", o.field);
  if (o.fassung === "lehrer") q.set("fassung", "lehrer");
  return q.toString();
}

// ---------- room for answers ----------

export type WorkArea = {
  kind: "kariert" | "liniert" | "leer" | "koordinaten";
  heightMm: number;
};
export type TaskPlan = {
  /** field for working out (Rechenfeld, coordinate system) */
  area: WorkArea | null;
  /** writing lines under the task (answers, texts) */
  lines: number;
  /** label in front of a single answer line */
  answerLabel: string | null;
  /** width in mm of each ___ gap in the prompt */
  gapsMm: number[];
  /** multiple choice in two columns when all options are short */
  optionColumns: 1 | 2;
  /** the field goes above the last line of the prompt ("Ergebnis: ___"), so the result comes last */
  areaBeforeLastLine: boolean;
};

/** Height of one writing line in mm (school lines, room for handwriting). */
export const LINE_MM = 9;

const SCALE: Record<Space, number> = { klein: 0.7, mittel: 1, gross: 1.4 };
const CALC_MM: Record<Space, number> = { klein: 20, mittel: 35, gross: 60 };
const SMALL_MM: Record<Space, number> = { klein: 0, mittel: 15, gross: 30 };
const COORD_MM: Record<Space, number> = { klein: 50, mittel: 70, gross: 100 };

const COORDINATES =
  /koordinat|graph(en)?\b|zeichne[^.]*\b(gerade|funktion|parabel|punkt)|trage[^.]*\bpunkt|punkte?\s+[A-Z]\s*\(\s*[−-]?\d/i;
const LONG_WRITING =
  /aufsatz|erörterung|erzählung|geschichte|brief\b|bericht|beschreibung|zusammenfassung|inhaltsangabe|stellungnahme|essay|letter|story|e-?mail|write (a|an|about)|describe|text über/i;
const WORDS = /(\d{2,3})\s*(wörter|worte|words)/i;

/** Writing lines for a free-text answer: from the length of the sample answer and the kind of text asked for. */
export function writingLines(
  task: Pick<TaskDraft, "prompt" | "answer">,
  space: Space,
): number {
  const sample = task.answer.sample ?? task.answer.accepted?.[0] ?? "";
  // about 60 handwritten characters fit on one line
  let base = Math.ceil(sample.length / 55) + 2;
  const words = task.prompt.match(WORDS);
  if (words) base = Math.max(base, Math.ceil(Number(words[1]) / 9) + 1);
  else if (LONG_WRITING.test(task.prompt)) base = Math.max(base, 12);
  return Math.max(2, Math.min(20, Math.round(base * SCALE[space])));
}

function gapWidth(expected: string | undefined) {
  if (!expected) return 32;
  return Math.max(14, Math.min(70, Math.round(expected.length * 2.6 + 10)));
}

export function planTask(
  task: TaskDraft,
  subject: string,
  o: Pick<SheetOptions, "space" | "field">,
): TaskPlan {
  const math = subject === "Mathematik";
  const text = `${task.prompt}\n${task.data.passage ?? ""}`;
  const gaps = task.prompt.split(GAP).length - 1;
  const gapsMm = Array.from({ length: gaps }, (_, i) =>
    gapWidth(
      // room for the longest right answer of the gap
      [...(task.answer.blanks?.[i] ?? [])].sort((x, y) => y.length - x.length)[0] ??
        (gaps === 1 ? task.answer.accepted?.[0] : undefined),
    ),
  );
  const options = task.data.options ?? [];
  const plan: TaskPlan = {
    area: null,
    lines: 0,
    answerLabel: null,
    gapsMm,
    optionColumns:
      options.length >= 4 && options.every((x) => x.length <= 22) ? 2 : 1,
    areaBeforeLastLine: false,
  };
  const lastLine = task.prompt.trimEnd().split("\n").pop() ?? "";
  const resultLine =
    !options.length &&
    task.prompt.includes("\n") &&
    lastLine.includes(GAP) &&
    !lastLine.trim().startsWith("|");

  // the kind of the extra field; "auto" means squared paper for maths and none for languages
  const kind =
    o.field === "auto"
      ? math
        ? "kariert"
        : null
      : o.field === "keins"
        ? null
        : o.field;
  const area = (mm: number): WorkArea | null =>
    kind && mm > 0 ? { kind, heightMm: mm } : null;

  if (math && o.field !== "keins" && COORDINATES.test(text))
    plan.area = { kind: "koordinaten", heightMm: COORD_MM[o.space] };

  if (options.length) {
    if (math && !plan.area) plan.area = area(SMALL_MM[o.space]);
    return plan;
  }
  if (task.data.steps) return plan;
  if (task.type === "free") {
    // the teacher's choice of answer field wins (one line, a few sentences, a longer text); room for the sample answer at least
    const sample = task.answer.sample ?? "";
    plan.lines =
      task.data.lines === 1
        ? o.space === "gross" ? 2 : 1
        : task.data.lines
          ? Math.max(2, Math.min(20, Math.round(Math.max(task.data.lines, Math.ceil(sample.length / 55) + 1) * SCALE[o.space])))
          : writingLines(task, o.space);
    return plan;
  }
  if (task.type === "fix") {
    // the whole text is written again, corrected: as many lines as it takes, plus one
    const len = (task.data.faulty ?? "").length;
    plan.lines = Math.max(2, Math.min(20, Math.round((Math.ceil(len / 55) + 1) * Math.max(1, SCALE[o.space]))));
    return plan;
  }
  if (task.answer.blanks && !(math && resultLine)) {
    // gaps in a table (Wertetabelle) are filled in place, without a field for working
    if (
      math &&
      !plan.area &&
      !textBlocks(task.prompt).some((b) => b.t === "table")
    )
      plan.area = area(SMALL_MM[o.space]);
    return plan;
  }
  // short answers (calculations, grammar, vocabulary); a closing "Ergebnis: ___" gets the full field above it
  if (math && !plan.area) plan.area = area(CALC_MM[o.space]);
  plan.areaBeforeLastLine = Boolean(plan.area) && resultLine;
  if (!gaps) {
    plan.lines = o.space === "gross" && !math ? 2 : 1;
    plan.answerLabel = math ? "Ergebnis:" : null;
  }
  return plan;
}

// ---------- the document ----------

export type SheetTask = {
  n: number;
  task: TaskDraft;
  /** shown above this task: the reading text, the first time it is used */
  passage: string | null;
  skillName: string | null;
  typeLabel: string;
  plan: TaskPlan;
};

export type SheetDoc = {
  defaultTitle: string;
  subject: string;
  klasseLabel: string;
  topic: string;
  skills: string[];
  studentName: string | null;
  tasks: SheetTask[];
};

export function buildSheet(
  src: {
    title: string;
    subject: string;
    klasseLabel: string;
    topic: string;
    studentName: string | null;
    tasks: TaskDraft[];
    subjectOf?: (i: number) => string;
  },
  skillName: (id: string) => string | null,
  o: Pick<SheetOptions, "space" | "field">,
): SheetDoc {
  const seen = new Set<string>();
  const tasks = src.tasks.map((task, i): SheetTask => {
    const subject = src.subjectOf?.(i) ?? src.subject;
    const passage =
      task.data.passage && !seen.has(task.data.passage)
        ? task.data.passage
        : null;
    if (task.data.passage) seen.add(task.data.passage);
    const cat = categoryLabel(subject, task.category);
    return {
      n: i + 1,
      task,
      passage,
      skillName: task.skillId ? skillName(task.skillId) : null,
      typeLabel: cat ?? TASK_TYPES[task.type],
      plan: planTask(task, subject, o),
    };
  });
  const skills = [
    ...new Set(
      tasks.map((t) => t.skillName).filter((x): x is string => Boolean(x)),
    ),
  ];
  return {
    defaultTitle: src.title,
    subject: src.subject,
    klasseLabel: src.klasseLabel,
    topic: src.topic,
    skills,
    studentName: src.studentName,
    tasks,
  };
}

/** The answer of a task in one line (as on the solution page). */
export function shortAnswer(
  t: Pick<TaskDraft, "data" | "answer">,
): string | null {
  if (t.data.options && typeof t.answer.correct === "number")
    return `${String.fromCharCode(97 + t.answer.correct)}) ${t.data.options[t.answer.correct]}`;
  if (t.answer.steps)
    return t.answer.steps.map((s, i) => `${i + 1}. ${s}`).join("   ");
  if (t.answer.blanks) return t.answer.blanks.map((b) => b[0]).join(" · ");
  if (t.answer.accepted?.length) return t.answer.accepted[0];
  return null;
}
