/**
 * KI-Selbsttest (Mehr › KI-Kosten, nur Administration): first one tiny request to see that the provider
 * answers, then one real request of each kind with invented data: a Deutsch exercise (Volksschule,
 * Wortarten), a Mathematik exercise (Rechenweg and Sachaufgabe) and a short Textkorrektur. Each runs
 * through the same functions and checks as in the app, and each is one paid request that counts for the
 * budget. No student, no name: the data below is made up.
 */
import { z } from "zod";
import { categoriesFor, type Difficulty } from "../curriculum";
import { klassenLabel, schulstufe } from "../school";
import type { TaskDraft } from "../tasks";
import { levelFor } from "../text-correction-rules";
import { isPlaceholder, WORTARTEN_SKILL, wortartenFor, wortartenIn } from "../wortarten";
import { generatePlanWithAI } from "./features";
import { callById, lastCallOf } from "./log";
import { runAI, type AIMeta } from "./router";
import { correctTextWithAI } from "./textkorrektur";

export type TestStep = {
  key: "verbindung" | "deutsch" | "mathe" | "text";
  label: string;
  ok: boolean;
  /** one sentence: what came back and whether it passed the checks */
  message: string;
  model: string;
  ms: number;
  usd: number;
  /** the tasks or corrections that came back, to judge the quality */
  details: string[];
};

const TRIGGER = "selbsttest";

/** Model, duration and cost of the request a step made (its row in ai_calls). */
function costOf(callId: number | null) {
  const row = callId ? callById(callId) : null;
  return { model: row?.model ?? "", ms: row?.duration_ms ?? 0, usd: row?.cost_usd ?? 0 };
}

const taskLines = (ts: TaskDraft[]) =>
  ts.flatMap((t, i) => [
    `${i + 1}. ${[t.prompt, t.data.start, ...(t.data.parts ?? []).map((p) => `${p.label} ${p.prompt}`)].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 500)}`,
    `   Lösung: ${(t.answer.accepted?.length ? t.answer.accepted.join(" | ") : t.solution).replace(/\s+/g, " ").slice(0, 300)}`,
    ...(t.data.pruefen?.length ? [`   Bitte prüfen: ${t.data.pruefen.join("; ")}`] : []),
  ]);

async function exercise(o: { subject: string; schoolType: string; klasse: number; skills: { id: string; name: string; area: string; difficulty: Difficulty }[]; plan: string[]; trigger: string }, meta: AIMeta) {
  const grade = schulstufe(o.schoolType, o.klasse);
  const plan = o.plan.map((category, i) => ({ skillId: o.skills[i % o.skills.length].id, category }));
  const before = lastCallOf(o.trigger)?.id ?? 0;
  let tasks: (TaskDraft | null)[] | null = null;
  let error = "";
  try {
    tasks = await generatePlanWithAI(
      {
        subject: o.subject,
        level: klassenLabel(o.schoolType, o.klasse),
        skills: o.skills,
        count: plan.length,
        categories: categoriesFor(o.subject).filter((c) => o.plan.includes(c.key)),
        plan,
        wortarten: wortartenFor(o.skills.map((s) => s.id), grade),
      },
      { ...meta, trigger: o.trigger },
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const row = lastCallOf(o.trigger);
  const mine = row && row.id > before ? row : null;
  // what the provider's answer lacked (cut off, wrong shape …), from the cost log
  return { tasks, error, call: mine?.id ?? null, problem: mine?.error ?? "" };
}

export async function runSelfTest(meta: AIMeta = {}): Promise<TestStep[]> {
  const steps: TestStep[] = [];

  // 1. one tiny request: does the provider answer at all?
  const ping = await runAI("verbindungstest", z.object({ ok: z.boolean() }), "Antworte ausschließlich im verlangten JSON-Format.", 'Antworte mit {"ok": true}.', { meta: { ...meta, trigger: TRIGGER } });
  steps.push({
    key: "verbindung",
    label: "Verbindung",
    ok: ping.ok && ping.data.ok === true,
    message: ping.ok ? (ping.data.ok ? "Der Anbieter antwortet im verlangten Format." : "Der Anbieter antwortet, aber nicht wie verlangt.") : ping.message,
    ...costOf(ping.callId),
    details: [],
  });
  if (!steps[0].ok) return steps;

  // 2. Deutsch, 3. Klasse Volksschule, Wortarten: only Nomen, Verb and Adjektiv may come up
  const de = await exercise(
    {
      subject: "Deutsch",
      schoolType: "Volksschule",
      klasse: 3,
      skills: [{ id: WORTARTEN_SKILL, name: "Wortarten bestimmen", area: "Wortarten", difficulty: "leicht" }],
      plan: ["wortarten", "wortarten"],
      trigger: `${TRIGGER}-deutsch`,
    },
    meta,
  );
  const deTasks = (de.tasks ?? []).filter((t): t is TaskDraft => t !== null);
  const allowed = new Set(["nomen", "verb", "adjektiv"]);
  const tooAdvanced = deTasks.filter((t) => wortartenIn(`${t.prompt} ${t.solution}`).some((w) => !allowed.has(w)));
  const placeholders = deTasks.filter((t) => isPlaceholder(t.solution));
  steps.push({
    key: "deutsch",
    label: "Deutsch: Wortarten, 3. Klasse Volksschule",
    ok: deTasks.length > 0 && !tooAdvanced.length && !placeholders.length,
    message: de.error || (de.tasks ? `${deTasks.length} von 2 Aufgaben bestehen die Prüfung der App${tooAdvanced.length ? `, ${tooAdvanced.length} fragen andere Wortarten ab` : ""}${placeholders.length ? `, ${placeholders.length} mit Platzhalter-Lösung` : ""}.` : "Keine verwertbare Antwort.") + (de.problem ? ` (${de.problem})` : ""),
    ...costOf(de.call),
    details: taskLines(deTasks),
  });

  // 3. Mathematik, 3. Klasse Mittelschule: the app recomputes every line of the AI's own working
  const ma = await exercise(
    {
      subject: "Mathematik",
      schoolType: "Mittelschule",
      klasse: 3,
      skills: [
        { id: "mathe.gleichungen.einfach", name: "Einfache lineare Gleichungen", area: "Gleichungen", difficulty: "mittel" },
        { id: "mathe.gleichungen.text", name: "Textaufgaben", area: "Gleichungen", difficulty: "mittel" },
      ],
      plan: ["rechenweg", "sachaufgabe"],
      trigger: `${TRIGGER}-mathe`,
    },
    meta,
  );
  const maTasks = (ma.tasks ?? []).filter((t): t is TaskDraft => t !== null);
  steps.push({
    key: "mathe",
    label: "Mathematik: Gleichungen, 3. Klasse Mittelschule",
    ok: maTasks.length === 2,
    message: ma.error || (ma.tasks ? `${maTasks.length} von 2 Aufgaben bestehen die Nachrechnung der App.` : "Keine verwertbare Antwort.") + (ma.problem ? ` (${ma.problem})` : ""),
    ...costOf(ma.call),
    details: taskLines(maTasks),
  });

  // 4. Textkorrektur, 4. Klasse Volksschule: four errors are known
  const text = "Am Samstag bin ich mit meinem Hunt in den Park gegangen. Dort haben wir einen grosen Ball gefunden. Mein Hund ist schnell gelaufen und hat den Ball geholt dan sind wir nach hause gegangen.";
  const known: [wrong: string, right: string][] = [
    ["Hunt", "Hund"],
    ["grosen", "großen"],
    ["dan", "dann"],
    ["hause", "Hause"],
  ];
  const tk = await correctTextWithAI(
    { subject: "Deutsch", kind: "Erlebniserzählung", task: "Erzähle von einem Ausflug.", level: levelFor("Volksschule", 4), blocks: [{ text, heading: false }], skills: [] },
    { ...meta, trigger: `${TRIGGER}-text` },
  );
  const findings = tk.ok ? tk.data.findings : [];
  // "dan" → "Dann" counts too: after the missing full stop it starts a sentence
  const found = known.filter(([w, r]) => findings.some((f) => f.quote.includes(w) && (w === "dan" ? f.replacement.toLowerCase() : f.replacement).includes(r)));
  steps.push({
    key: "text",
    label: "Textkorrektur, 4. Klasse Volksschule",
    ok: tk.ok && found.length >= 3,
    message: tk.ok ? `${found.length} von ${known.length} eingebauten Fehlern gefunden, ${findings.length} Markierungen insgesamt.` : tk.message,
    ...costOf(tk.callId),
    details: findings.map((f) => `„${f.quote}“ → „${f.replacement}“ (${f.kind}): ${f.explanation}`),
  });
  return steps;
}
