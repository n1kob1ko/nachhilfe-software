"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { appBackupPaths, backupNow } from "@/lib/sicherungen-app";
import { cancelRestore, stageRestore } from "@/lib/sicherungen";
import type { FormState } from "./session-actions";

export async function backupNowAction(_prev: FormState): Promise<FormState> {
  await requireAdmin();
  try {
    const b = backupNow();
    revalidatePath("/export");
    return { ok: `Gesichert: ${b.counts.students ?? 0} Schüler, ${b.files} ${b.files === 1 ? "Datei" : "Dateien"}.` };
  } catch {
    return { error: "Die Sicherung hat nicht geklappt. Bitte später erneut versuchen." };
  }
}

export async function stageRestoreAction(name: string, _prev: FormState): Promise<FormState> {
  await requireAdmin();
  const out = stageRestore(name, appBackupPaths());
  revalidatePath("/export");
  if ("error" in out) return { error: out.error };
  return { ok: "Vorgemerkt. Die Sicherung wird beim nächsten Neustart des Servers eingespielt." };
}

export async function cancelRestoreAction() {
  await requireAdmin();
  cancelRestore(appBackupPaths().dbFile);
  revalidatePath("/export");
}
