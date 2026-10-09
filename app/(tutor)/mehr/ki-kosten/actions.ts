"use server";

import { revalidatePath } from "next/cache";
import { aiEnabled } from "@/lib/ai";
import { qualityState, startQualityTest, type RunState } from "@/lib/ai/qualitaetstest";
import { runSelfTest, type TestStep } from "@/lib/ai/selbsttest";
import { startTextTest, textTestState } from "@/lib/ai/textkorrektur-test";
import type { TextTestState } from "@/lib/ai/textkorrektur-test-types";
import { requireTeacher } from "@/lib/auth";

export type SelfTestState = { steps: TestStep[] } | { error: string } | null;

// one test at a time, and not twice within a minute (each run costs a little)
const shared = globalThis as unknown as { __aiSelfTest?: { running: boolean; at: number } };
const guard = (shared.__aiSelfTest ??= { running: false, at: 0 });

/** Mehr › KI-Kosten › KI testen: only the administration; results also go to the server log, without the key. */
export async function selfTestAction(): Promise<SelfTestState> {
  const teacher = await requireTeacher();
  if (!teacher.is_admin) return { error: "Nur die Administration kann den KI-Test starten." };
  if (!aiEnabled()) return { error: "Die KI ist aus: kein Schlüssel hinterlegt oder AI_DISABLED gesetzt." };
  if (guard.running || Date.now() - guard.at < 60_000) return { error: "Der KI-Test lief gerade. Bitte in einer Minute noch einmal." };
  guard.running = true;
  try {
    const steps = await runSelfTest({ teacherId: teacher.id });
    for (const s of steps) console.info(`[KI-Selbsttest] ${JSON.stringify(s)}`);
    revalidatePath("/mehr/ki-kosten");
    return { steps };
  } finally {
    guard.running = false;
    guard.at = Date.now();
  }
}

export type QualityTestState = { state: RunState | null } | { error: string };

/** Mehr › KI-Kosten › KI-Qualitätstest: 20 lessons with invented data, in the background; at most 1 €. */
export async function startQualityTestAction(): Promise<QualityTestState> {
  const teacher = await requireTeacher();
  if (!teacher.is_admin) return { error: "Nur die Administration kann den Qualitätstest starten." };
  if (!aiEnabled()) return { error: "Die KI ist aus: kein Schlüssel hinterlegt oder AI_DISABLED gesetzt." };
  if (!startQualityTest({ teacherId: teacher.id })) return { error: "Der Qualitätstest läuft bereits." };
  return { state: qualityState() };
}

/** The state of the running or last run (until the server restarts). */
export async function qualityTestStateAction(): Promise<QualityTestState> {
  const teacher = await requireTeacher();
  if (!teacher.is_admin) return { error: "Nur die Administration sieht den Qualitätstest." };
  return { state: qualityState() };
}

export type TextTestResult = { state: TextTestState | null } | { error: string };

/** Mehr › KI-Kosten › Textkorrektur-Test: the synthetic texts with their key, one-step against „gründlich“; at most 2 €. */
export async function startTextTestAction(): Promise<TextTestResult> {
  const teacher = await requireTeacher();
  if (!teacher.is_admin) return { error: "Nur die Administration kann den Textkorrektur-Test starten." };
  if (!aiEnabled()) return { error: "Die KI ist aus: kein Schlüssel hinterlegt oder AI_DISABLED gesetzt." };
  if (!startTextTest(teacher.id)) return { error: "Der Textkorrektur-Test läuft bereits." };
  return { state: textTestState() };
}

export async function textTestStateAction(): Promise<TextTestResult> {
  const teacher = await requireTeacher();
  if (!teacher.is_admin) return { error: "Nur die Administration sieht den Textkorrektur-Test." };
  return { state: textTestState() };
}
