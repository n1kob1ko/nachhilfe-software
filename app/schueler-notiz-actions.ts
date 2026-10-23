"use server";

import { revalidatePath } from "next/cache";
import * as repo from "@/lib/repo";
import { speichereNotiz, speichereWunsch, ueberspringeNotiz, type Speichern } from "@/lib/schueler-notiz";

// ---------- student side: „Was war heute schwer?“ and „Für nächstes Mal“ (lib/schueler-notiz.ts) ----------
// The secret link is the only key: the unit must be this student's last ended one, nothing else can be written.
// „Für nächstes Mal“ has no unit: it is the student's open one (`offenerWunsch`).

export type NotizState = Speichern | null;

function nachSpeichern(token: string, studentId: number, unitId?: number) {
  revalidatePath(`/lernen/${token}`);
  revalidatePath(`/schueler/${studentId}`, "layout");
  if (unitId) revalidatePath(`/einheiten/${unitId}`);
}

export async function notizSpeichernAction(token: string, unitId: number, _: NotizState, f: FormData): Promise<NotizState> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const out = speichereNotiz(student.id, Number(unitId), { auswahl: f.getAll("auswahl"), text: String(f.get("text") ?? "") });
  if ("ok" in out) nachSpeichern(token, student.id, Number(unitId));
  return out;
}

export async function notizUeberspringenAction(token: string, unitId: number): Promise<NotizState> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const out = ueberspringeNotiz(student.id, Number(unitId));
  if ("ok" in out) nachSpeichern(token, student.id, Number(unitId));
  return out;
}

export async function wunschSpeichernAction(token: string, _: NotizState, f: FormData): Promise<NotizState> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const out = speichereWunsch(student.id, String(f.get("text") ?? ""));
  nachSpeichern(token, student.id);
  return out;
}
