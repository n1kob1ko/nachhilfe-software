"use server";

import { revalidatePath } from "next/cache";
import { aiEnabled } from "@/lib/ai";
import { runSelfTest, type TestStep } from "@/lib/ai/selbsttest";
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
