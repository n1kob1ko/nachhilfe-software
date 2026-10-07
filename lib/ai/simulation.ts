/**
 * 60-minute test mode: a whole unit with one (made-up) student, played through the real app code:
 * submitAnswer, hints, the live triggers, bundling, reuse, the budget check and the cost log. Only the
 * clock runs faster and, unless `real` is set, Claude is replaced by a stand-in that answers with valid
 * JSON and estimates the tokens from the real prompts. Run it with `npm run ai:simulate`.
 *
 * The database must be a test database (DATABASE_PATH=":memory:" or a temp file): the caller sets it.
 */
import { z } from "zod";
import { DIFFICULTIES, type Difficulty } from "../curriculum";
import { db } from "../db";
import { ERROR_TYPES } from "../error-types";
import * as repo from "../repo";
import type { TaskDraft } from "../tasks";
import { FUNCTIONS, modelFor, type AIFunction, type Usage } from "./config";
import { latestInsight } from "./insights";
import { liveStats, newExerciseForUnit, onHint, resetLiveStats, setScheduler, settle } from "./realtime";
import { clockNow, resetRouter, setClock, setTestRun, setTransport, type Transport } from "./router";

export type SimOptions = {
  minutes?: number;
  seed?: number;
  /** real requests with ANTHROPIC_API_KEY (costs money) instead of the stand-in */
  real?: boolean;
  /** every request fails: shows that the unit still runs without KI */
  outage?: boolean;
};

export type SimRow = { fn: AIFunction; label: string; model: string; calls: number; reused: number; blocked: number; failed: number; input: number; output: number; cacheRead: number; cacheWrite: number; usd: number; avgMs: number };
export type SimReport = {
  minutes: number;
  real: boolean;
  outage: boolean;
  answers: number;
  hints: number;
  tasks: number;
  exercises: number;
  events: typeof liveStats;
  rows: SimRow[];
  total: { calls: number; reused: number; blocked: number; failed: number; input: number; output: number; cacheRead: number; cacheWrite: number; usd: number };
  /** what one request per answer and hint would have meant (no filter, no bundling) */
  naive: { calls: number; usd: number };
  selfAssessed: number;
  generatorFallbacks: number;
};

// ---------- deterministic randomness ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- virtual clock ----------
function virtualTime(start: number) {
  let now = start;
  let seq = 0;
  const queue: { id: number; due: number; fn: () => Promise<void> }[] = [];
  return {
    now: () => now,
    scheduler: {
      after(ms: number, fn: () => Promise<void>) {
        const id = ++seq;
        queue.push({ id, due: now + Math.max(0, ms), fn });
        return id;
      },
      cancel(id: unknown) {
        const i = queue.findIndex((q) => q.id === id);
        if (i >= 0) queue.splice(i, 1);
      },
    },
    /** runs every timer up to `target`, each at its own moment, and waits for the KI work it starts */
    async advanceTo(target: number) {
      for (;;) {
        queue.sort((a, b) => a.due - b.due || a.id - b.id);
        const next = queue[0];
        if (!next || next.due > target) break;
        queue.shift();
        now = Math.max(now, next.due);
        await next.fn();
        await settle();
      }
      now = Math.max(now, target);
    },
  };
}

// ---------- stand-in for Claude ----------
const tokens = (s: string) => Math.ceil(s.length / 3.2);
const schemaText = new WeakMap<z.ZodType, string>();
function schemaOf(schema: z.ZodType) {
  let s = schemaText.get(schema);
  if (!s) schemaText.set(schema, (s = JSON.stringify(z.toJSONSchema(schema))));
  return s;
}

/**
 * Valid answers for every KI function, sized like real ones. Tokens: about 3.2 characters per token
 * for German JSON; the output schema counts as input; thinking adds 80 % to the output of functions
 * that think (estimates, a real run with --echt measures them).
 */
function standIn(random: () => number): Transport {
  const cached = new Map<string, number>();
  return async (p, o) => {
    const prompt = typeof p.messages[0].content === "string" ? p.messages[0].content : JSON.stringify(p.messages[0].content);
    const system = p.system.map((b) => b.text).join("\n");
    const parsed = fake(o.fn, prompt, random);
    const prefix = tokens(system) + tokens(schemaOf(o.schema));
    let input = prefix + tokens(prompt) + 12;
    let cacheWrite = 0;
    let cacheWrite1h = 0;
    let cacheRead = 0;
    // with cache_control, a system prompt plus schema long enough for the model is cached (5 min or 1 h)
    const ttl = p.system[0].cache_control?.ttl ?? (p.system[0].cache_control ? "5m" : null);
    const min = /haiku/.test(p.model) ? 4096 : 512;
    if (ttl && prefix >= min) {
      const key = `${p.model}|${o.fn}`;
      const last = cached.get(key);
      if (last !== undefined && clockNow() - last < (ttl === "1h" ? 60 : 5) * 60_000) cacheRead = prefix;
      else if (ttl === "1h") cacheWrite1h = prefix;
      else cacheWrite = prefix;
      input -= prefix;
      cached.set(key, clockNow());
    }
    let output = tokens(JSON.stringify(parsed));
    if (p.thinking?.type === "adaptive") output = Math.round(output * 1.8);
    output = Math.min(output, p.max_tokens);
    const usage: Usage = { input, output, cacheWrite, cacheWrite1h, cacheRead };
    const speed = /haiku/.test(p.model) ? [600, 6] : /opus/.test(p.model) ? [2000, 20] : [1200, 12];
    return { parsed, refusal: false, model: p.model, usage, simulatedMs: speed[0] + output * speed[1] };
  };
}

const pick = <T,>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)];

function fake(fn: AIFunction, prompt: string, r: () => number): unknown {
  switch (fn) {
    case "echtzeit": {
      const urgent = /wiederholt/.test(prompt);
      return {
        error_type: pick(ERROR_TYPES, r).key,
        misconception: "Beim Zusammenfassen wird das Vorzeichen der zweiten Zahl übernommen statt verrechnet.",
        confidence: Math.round((0.55 + r() * 0.4) * 100) / 100,
        recommended_action: urgent ? pick(["erklaeren", "leichter", "grundlage_wiederholen"] as const, r) : pick(["weiter", "hilfe_geben"] as const, r),
        difficulty_adjustment: urgent ? -1 : 0,
        hint: "Schau zuerst, welche der beiden Zahlen den größeren Betrag hat.",
        next_skill: null,
        needs_new_exercise: urgent && r() < 0.5,
        teacher_note: "Fehler beim Vorzeichen, kurz an der Zahlengeraden zeigen.",
      };
    }
    case "block":
      return {
        summary: "Die Übung lief überwiegend sicher. Fehler traten vor allem bei negativen Ergebnissen auf.",
        strengths: ["Gleichnamige Brüche addieren", "Kürzen am Ende"],
        gaps: ["Vorzeichen bei negativen Ergebnissen"],
        recommended_action: pick(["weiter", "leichter", "neue_aufgabe"] as const, r),
        difficulty_adjustment: pick([-1, 0, 0, 1] as const, r),
        next_skill: null,
        needs_new_exercise: r() < 0.5,
      };
    case "einheit":
      return {
        summary: "In dieser Einheit wurden Bruchrechnung und negative Zahlen geübt. Brüche addieren klappt gut, bei Vorzeichen braucht es noch Übung. Hilfen wurden vor allem bei negativen Zahlen genutzt.",
        next_steps: ["Vorzeichenregeln an der Zahlengeraden wiederholen", "Gemischte Übung Brüche und negative Zahlen", "Kurze Überprüfung Dividieren"],
        next_skill: "Negative Zahlen › Addieren und Subtrahieren",
        homework: "Fünf Aufgaben zu Vorzeichenregeln",
      };
    case "freitext": {
      const wrong = /weiß nicht/i.test(prompt.split("Antwort der Schülerin / des Schülers:").at(-1) ?? "");
      return { correct: !wrong, feedback: wrong ? "Da fehlt noch, wie man den gemeinsamen Nenner findet." : "Gut erklärt, der gemeinsame Nenner ist der Kern.", error_label: wrong ? "Nenner fehlt" : null, error_type: wrong ? "regel" : null };
    }
    case "aufgaben":
    case "neue_aufgabe": {
      const count = Number(/Erstelle genau (\d+)/.exec(prompt)?.[1] ?? 1);
      const lines = [...prompt.matchAll(/^- (\S+): .*? – (.+)$/gm)];
      return {
        tasks: Array.from({ length: count }, (_, i) => {
          const [, id, level] = lines[i % Math.max(1, lines.length)] ?? [null, "", "mittel"];
          const a = Math.floor(r() * 20) - 10;
          const b = Math.floor(r() * 20) - 10;
          return {
            category: "rechnung",
            format: "calc",
            skill_ids: id ? [id] : [],
            topic: "Negative Zahlen",
            difficulty: (DIFFICULTIES as readonly string[]).includes(level) ? level : "mittel",
            prompt: `Berechne (${a}) + (${b}).`,
            passage: null,
            options: null,
            correct_option: null,
            accepted_answers: [String(a + b)],
            numeric: true,
            blanks: null,
            sample_answer: null,
            steps: null,
            solution: `Die Beträge werden verrechnet: (${a}) + (${b}) = ${a + b}.`,
            solution_steps: ["Vorzeichen beider Zahlen ansehen", "Beträge addieren oder subtrahieren", `Ergebnis: ${a + b}`],
            estimated_time_sec: 60,
            hints: ["Welche Zahl hat den größeren Betrag?", "Bei verschiedenen Vorzeichen: Beträge subtrahieren.", "Das Ergebnis bekommt das Vorzeichen der Zahl mit dem größeren Betrag."],
            common_errors: [{ answer: String(-(a + b)), label: "Vorzeichen vertauscht" }],
          };
        }),
      };
    }
    default:
      return { summary: "–", next_lesson_plan: ["–"], parent_note: "–", note: "–" };
  }
}

const outageTransport: Transport = async () => {
  throw new Error("Simulierter Ausfall");
};

// ---------- the student ----------
function rightAnswer(t: repo.Task): string {
  const a = t.answer;
  if (t.data.options && typeof a.correct === "number") return String(a.correct);
  if (a.steps && t.data.steps) return JSON.stringify(a.steps.map((s) => t.data.steps!.indexOf(s)));
  if (a.blanks) return JSON.stringify(a.blanks.map((b) => b[0]));
  if (a.accepted?.length) return a.accepted[0];
  return a.sample ?? t.solution;
}
function wrongAnswer(t: repo.Task, sign: boolean): string {
  const a = t.answer;
  if (t.data.options && typeof a.correct === "number") return String((a.correct + 1) % t.data.options.length);
  if (a.steps && t.data.steps) return JSON.stringify(a.steps.map((s) => t.data.steps!.indexOf(s)).reverse());
  if (a.blanks) return JSON.stringify(a.blanks.map(() => "x"));
  if (a.accepted?.length) {
    const v = a.accepted[0];
    return sign ? (v.startsWith("-") ? v.slice(1) : `-${v}`) : `${v}1`;
  }
  return "Ich weiß nicht genau.";
}

const FREE: (skillId: string) => TaskDraft = (skillId) => ({
  type: "free",
  skillId,
  difficulty: "mittel",
  prompt: "Erkläre in eigenen Worten, wie man zwei Brüche mit verschiedenen Nennern addiert.",
  data: {},
  answer: { sample: "Man sucht einen gemeinsamen Nenner, erweitert beide Brüche darauf und addiert dann die Zähler." },
  solution: "Gemeinsamen Nenner suchen, beide Brüche erweitern, Zähler addieren, Nenner bleibt.",
  hints: ["Was muss bei beiden Brüchen gleich sein?"],
  errorMap: [],
});

/** Skill, how often the student gets it right at once, and whether errors are sign errors. */
const PLAN: { skill: string; first: number; sign: boolean; free: number }[] = [
  { skill: "mathe.brueche.addieren", first: 0.75, sign: false, free: 0 },
  { skill: "mathe.negativ.addieren", first: 0.45, sign: true, free: 2 },
  { skill: "mathe.brueche.dividieren", first: 0.6, sign: false, free: 0 },
  { skill: "mathe.negativ.addieren", first: 0.55, sign: true, free: 2 },
];
const BLOCK_SIZE = 12;

export async function simulateLesson(o: SimOptions = {}): Promise<SimReport> {
  const minutes = o.minutes ?? 60;
  const random = rng(o.seed ?? 7);
  const start = Date.parse("2026-10-07T14:00:00Z");
  const clock = virtualTime(start);
  setClock(clock.now);
  setScheduler(clock.scheduler);
  setTransport(o.outage ? outageTransport : o.real ? null : standIn(random));
  setTestRun(true);
  resetRouter();
  resetLiveStats();

  const { startUnit } = await import("../units");
  const { endUnit } = await import("../learning");
  const { submitAnswer } = await import("../service");
  const { generateBuiltIn } = await import("../generators");

  const teacher = repo.listTeachers().find((t) => t.name === "Niko") ?? repo.listTeachers()[0];
  const studentId = repo.createStudent({
    name: "Testschüler Simulation",
    grade: 6,
    klasse: 2,
    teacher_id: teacher.id,
    school: "",
    school_type: "Mittelschule",
    subjects: ["Mathematik"],
    current_topics: "",
    strengths_note: "",
    weaknesses_note: "",
    goals: "",
    notes: "",
  });
  const student = repo.getStudent(studentId)!;
  const unit = startUnit(teacher.id, studentId, { subject: "Mathematik" }).unit;
  const end = start + minutes * 60_000;
  let answers = 0;
  let hints = 0;
  let tasksDone = 0;
  let selfAssessed = 0;
  let generatorFallbacks = 0;
  let clicks = 0;
  let lastClick = -Infinity;

  const work = async (assignmentId: number, plan: (typeof PLAN)[number]) => {
    const a = repo.getAssignment(assignmentId)!;
    for (const t of repo.listTasks(a.worksheet_id)) {
      if (clockNow() >= end) return;
      tasksDone++;
      const struggling = random() > plan.first;
      // hints: more often when it is hard
      if (t.hints.length && random() < (struggling ? 0.45 : 0.1)) {
        await clock.advanceTo(clockNow() + 15_000 + random() * 15_000);
        repo.recordHintUse({ assignment_id: a.id, task_id: t.id, student_id: studentId, hint_index: 0, unit_id: unit.id });
        onHint({ unitId: unit.id, teacherId: teacher.id, taskId: t.id, assignmentId: a.id, hintIndex: 0 });
        hints++;
        if (t.hints.length > 1 && random() < 0.3) {
          await clock.advanceTo(clockNow() + 10_000);
          repo.recordHintUse({ assignment_id: a.id, task_id: t.id, student_id: studentId, hint_index: 1, unit_id: unit.id });
          onHint({ unitId: unit.id, teacherId: teacher.id, taskId: t.id, assignmentId: a.id, hintIndex: 1 });
          hints++;
        }
      }
      for (let attempt = 1; attempt <= 3; attempt++) {
        await clock.advanceTo(clockNow() + 25_000 + random() * 35_000);
        if (clockNow() >= end) return;
        const right = attempt === 1 ? !struggling : random() < 0.6;
        const answer = right ? rightAnswer(t) : wrongAnswer(t, plan.sign);
        let res = await submitAnswer({ token: student.access_token, assignmentId: a.id, taskId: t.id, answer, timeMs: 40_000, hintsUsed: 0 });
        if (res.needsSelfAssessment) {
          selfAssessed++;
          res = await submitAnswer({ token: student.access_token, assignmentId: a.id, taskId: t.id, answer, timeMs: 40_000, hintsUsed: 0, selfAssessed: right });
        }
        answers++;
        if (res.final) break;
      }
      // the teacher reads the KI hint and asks for a fitting exercise, at most 3 times and not too often
      const hint = latestInsight(unit.id, "echtzeit")?.data ?? latestInsight(unit.id, "block")?.data;
      if (hint?.needs_new_exercise && clicks < 3 && clockNow() - lastClick > 8 * 60_000) {
        clicks++;
        lastClick = clockNow();
        const out = await newExerciseForUnit(unit.id, teacher.id);
        await settle();
        if (out.ok) {
          if (out.source === "generator") generatorFallbacks++;
          await work(out.assignmentId, plan);
        }
      }
    }
  };

  for (const [i, plan] of PLAN.entries()) {
    if (clockNow() >= end) break;
    const skill = repo.getSkill(plan.skill)!;
    const difficulty: Difficulty = i === 0 ? "leicht" : "mittel";
    const drafts = generateBuiltIn({ subject: "Mathematik", skills: [{ id: skill.id, name: skill.name }], difficulty, count: BLOCK_SIZE - plan.free, taskType: "mixed", seed: (o.seed ?? 7) + i });
    for (let k = 0; k < plan.free; k++) drafts.splice(3 + k * 4, 0, FREE("mathe.brueche.addieren"));
    const wid = repo.createWorksheet(
      { title: `${skill.area}: ${skill.name}`, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: skill.area, difficulty, task_type: "mixed", kind: "uebung", source: "generator", skill_ids: [skill.id], student_id: studentId, teacher_id: teacher.id },
      drafts,
    );
    await work(repo.assignWorksheet(wid, studentId, "", unit.id), plan);
    // the teacher explains something at the whiteboard between two exercises
    await clock.advanceTo(clockNow() + 3 * 60_000);
  }
  await clock.advanceTo(Math.max(clockNow(), end));
  endUnit(unit.id, { byTeacherId: teacher.id, at: Date.now() });
  await settle();
  await clock.advanceTo(clockNow() + 60_000);

  const report = summarize(unit.id, { minutes, real: Boolean(o.real), outage: Boolean(o.outage), answers, hints, tasks: tasksDone, exercises: repo.listAssignments(studentId).length, selfAssessed, generatorFallbacks });
  setTransport(null);
  setTestRun(false);
  setClock(null);
  setScheduler(null);
  return report;
}

function summarize(unitId: number, base: Omit<SimReport, "events" | "rows" | "total" | "naive">): SimReport {
  type R = { fn: AIFunction; model: string; status: string; n: number; input: number; output: number; cacheRead: number; cacheWrite: number; usd: number; ms: number };
  const raw = db()
    .prepare(
      `SELECT fn, model, status, COUNT(*) AS n, SUM(input_tokens) AS input, SUM(output_tokens) AS output, SUM(cache_read_tokens) AS cacheRead,
        SUM(cache_write_tokens) AS cacheWrite, SUM(cost_usd) AS usd, SUM(duration_ms) AS ms FROM ai_calls WHERE unit_id = ? GROUP BY fn, model, status`,
    )
    .all(unitId) as R[];
  const rows = new Map<string, SimRow>();
  for (const r of raw) {
    const key = `${r.fn}|${r.model}`;
    const row = rows.get(key) ?? { fn: r.fn, label: FUNCTIONS[r.fn]?.label ?? r.fn, model: r.model, calls: 0, reused: 0, blocked: 0, failed: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0, avgMs: 0 };
    if (r.status === "ok" || r.status === "abgelehnt") {
      row.avgMs = (row.avgMs * row.calls + r.ms) / (row.calls + r.n);
      row.calls += r.n;
    } else if (r.status === "cache") row.reused += r.n;
    else if (r.status === "budget" || r.status === "pausiert") row.blocked += r.n;
    else row.failed += r.n;
    row.input += r.input;
    row.output += r.output;
    row.cacheRead += r.cacheRead;
    row.cacheWrite += r.cacheWrite;
    row.usd += r.usd;
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => b.usd - a.usd);
  const total = list.reduce(
    (t, r) => ({ calls: t.calls + r.calls, reused: t.reused + r.reused, blocked: t.blocked + r.blocked, failed: t.failed + r.failed, input: t.input + r.input, output: t.output + r.output, cacheRead: t.cacheRead + r.cacheRead, cacheWrite: t.cacheWrite + r.cacheWrite, usd: t.usd + r.usd }),
    { calls: 0, reused: 0, blocked: 0, failed: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 },
  );
  // without the router: one live request per answer and per hint
  const live = list.find((r) => r.fn === "echtzeit");
  const perLive = live && live.calls ? live.usd / live.calls : 0;
  const naiveLive = base.answers + base.hints;
  const naive = { calls: total.calls - (live?.calls ?? 0) + naiveLive, usd: total.usd - (live?.usd ?? 0) + naiveLive * perLive };
  return { ...base, events: { ...liveStats }, rows: list, total, naive };
}

// ---------- report ----------

const SAVINGS: Partial<Record<AIFunction, string>> = {
  aufgaben: "Aufgaben vor der Stunde über die Batch-API erzeugen (halber Preis) oder passende Aufgaben aus der Bibliothek wiederverwenden.",
  neue_aufgabe: "Erst in der Aufgabenbibliothek nach einer passenden Aufgabe suchen und nur ohne Treffer neu erzeugen; weniger Denkaufwand oder das schnelle Modell für einfache Rechenaufgaben.",
  echtzeit: "Erste Fehlversuche und erste Hilfen nur regelbasiert auswerten und die KI erst ab dem zweiten Fehlversuch oder der zweiten Hilfe fragen.",
  block: "Blockauswertung mit dem schnellen Modell statt dem Standard-Modell (eigene Stufe für diese Funktion).",
  freitext: "Kurze Freitexte zuerst mit der Musterlösung vergleichen und nur bei Abweichung Claude fragen.",
  einheit: "Zusammenfassung nur auf Klick statt bei jedem Ende der Einheit.",
};

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} $`;
const int = (x: number) => Math.round(x).toLocaleString("de-AT");

export function reportMarkdown(r: SimReport, outage?: SimReport): string {
  const perMonth = r.total.usd * 40;
  const top = r.rows.filter((x) => x.usd > 0).slice(0, 3);
  const lines = [
    `# KI-Simulation: ${r.minutes} Minuten Nachhilfe`,
    "",
    r.real
      ? "Echtlauf: alle Aufrufe gingen an Claude, Tokens und Kosten sind gemessen."
      : "Probelauf ohne API-Schlüssel: der Router, die Auslöser, die Bündelung und das Log sind echt, Claude ist durch einen Platzhalter ersetzt. Die Tokens sind aus den echten Prompts geschätzt (etwa 3,2 Zeichen pro Token, Ausgabeschema zählt als Eingabe, Denken bei Aufgabenerstellung +80 %). Ein Echtlauf mit `npm run ai:simulate -- --echt` misst sie.",
    "",
    `Modelle: schnell = \`${modelFor("fast")}\`, standard = \`${modelFor("standard")}\`, tief = \`${modelFor("deep")}\`.`,
    "",
    "## Ablauf",
    "",
    `- ${int(r.answers)} Antworten auf ${int(r.tasks)} Aufgaben in ${int(r.exercises)} Übungen, ${int(r.hints)} Hilfen geöffnet`,
    `- ${int(r.events.events)} Ereignisse an die KI-Schicht, davon ${int(r.events.triggers)} Auslöser für eine Analyse`,
    `- ${int(r.events.analyses)} Echtzeit-Analysen; ${int(r.events.bundled)} Auslöser wurden mit anderen gebündelt, ${int(r.events.skippedSolved)} entfielen, weil die Aufgabe inzwischen gelöst war`,
    `- ${int(r.events.blocks)} Blockauswertungen, ${int(r.events.newTasks)} Mal „Passende Aufgabe senden“, ${int(r.events.units)} Zusammenfassung am Ende`,
    "",
    "## 1. API-Aufrufe",
    "",
    `**${int(r.total.calls)} Aufrufe** in ${r.minutes} Minuten, dazu ${int(r.total.reused)} aus dem Speicher beantwortet (keine Kosten). Ohne Filter und Bündelung wären es etwa ${int(r.naive.calls)} gewesen (eine Analyse pro Antwort und Hilfe).`,
    "",
    "## 2. Tokens",
    "",
    `**${int(r.total.input)} Input** zum vollen Preis, dazu ${int(r.total.cacheWrite)} in den Cache geschrieben und ${int(r.total.cacheRead)} aus dem Cache gelesen (10 % des Preises); **${int(r.total.output)} Output**.`,
    "",
    "## 3. Kosten",
    "",
    `**${usd(r.total.usd)} pro Stunde** (geschätzt). Bei 40 Stunden im Monat etwa ${perMonth.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $. Ohne Router etwa ${usd(r.naive.usd)} pro Stunde.`,
    "",
    "## 4. Funktionen und Modelle",
    "",
    "| Funktion | Modell | Aufrufe | aus Speicher | Input | Cache gelesen | Output | Ø Dauer | Kosten |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...r.rows.map((x) => `| ${x.label} | \`${x.model}\` | ${int(x.calls)} | ${int(x.reused)} | ${int(x.input)} | ${int(x.cacheRead)} | ${int(x.output)} | ${(x.avgMs / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })} s | ${usd(x.usd)} |`),
    `| **Summe** | | **${int(r.total.calls)}** | ${int(r.total.reused)} | ${int(r.total.input)} | ${int(r.total.cacheRead)} | ${int(r.total.output)} | | **${usd(r.total.usd)}** |`,
    "",
    "## 5. Wo es noch günstiger geht",
    "",
    ...top.map((x, i) => `${i + 1}. **${x.label}** (${usd(x.usd)}, ${Math.round((x.usd / Math.max(r.total.usd, 1e-9)) * 100)} %): ${SAVINGS[x.fn] ?? "–"}`),
  ];
  if (outage) {
    lines.push(
      "",
      "## Ausfalltest",
      "",
      `Derselbe Ablauf, jeder KI-Aufruf schlägt fehl. Die Einheit lief bis zum Ende: ${int(outage.answers)} Antworten, ${int(outage.selfAssessed)} Freitexte per Selbsteinschätzung, ${int(outage.generatorFallbacks)} Mal neue Aufgaben aus dem Generator. ` +
        `${int(outage.total.failed)} Aufrufe schlugen fehl, danach pausierte die KI und ${int(outage.total.blocked)} weitere wurden gar nicht erst versucht.`,
    );
  }
  return lines.join("\n") + "\n";
}
