"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireTeacher } from "@/lib/auth";
import { erstelleProbeschularbeit, setNotenschluessel, setzePunkte } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";

/**
 * „Probeschularbeit erstellen“ auf der Vorbereitung einer Schularbeit (lib/probeschularbeit.ts): der Entwurf
 * öffnet sich in der Vorschau, wo der Lehrer ihn prüft und sendet oder druckt.
 */
export async function probeschularbeitAction(testId: number, f: FormData) {
  const teacher = await requireTeacher();
  const test = repo.getTest(testId);
  if (!test) redirect("/schueler");
  const back = `/schueler/${test.student_id}/pruefung/${test.id}`;
  let out: Awaited<ReturnType<typeof erstelleProbeschularbeit>> | null = null;
  let fehler = "";
  try {
    // vom Stoffzettel: die KI schreibt alle Aufgaben, jede Zeile des Stoffs kommt dran
    const vomStoff = f.get("aufgaben") === "stoff";
    out = await erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: Number(f.get("dauer")), useAI: vomStoff || f.get("ki") === "1", vomStoff });
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Die Probeschularbeit konnte nicht erstellt werden.";
  }
  if (!out) redirect(`${back}?fehler=${encodeURIComponent(fehler)}#probeschularbeit`);
  revalidatePath(back);
  const hinweis = out.stoff
    ? `?hinweis=stoff&zeilen=${out.stoff.zeilen}&aufgaben=${out.stoff.aufgaben}&ersetzt=${out.stoff.ersetzt}&anzahl=${out.ohneKi}${out.aiError ? "&ki=0" : ""}`
    : out.aiError
      ? "?hinweis=ki"
      : out.ohneKi
        ? `?hinweis=erklaeren&anzahl=${out.ohneKi}`
        : "";
  redirect(`/uebungen/${out.worksheetId}${hinweis}`);
}

/** Punkte einer Aufgabe in der Probeschularbeit. */
export async function setzePunkteAction(taskId: number, punkte: number): Promise<{ error?: string }> {
  await requireTeacher();
  const task = repo.getTask(taskId);
  if (!task) return { error: "Aufgabe nicht gefunden." };
  try {
    setzePunkte(taskId, punkte);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Die Punkte konnten nicht gespeichert werden." };
  }
  revalidatePath(`/uebungen/${task.worksheet_id}`);
  return {};
}

/** Notenschlüssel unter Mehr › Curriculum / Lehrplan › Einstellungen. */
export async function setNotenschluesselAction(f: FormData) {
  await requireAdmin();
  try {
    setNotenschluessel(["n1", "n2", "n3", "n4"].map((k) => Number(String(f.get(k) ?? "").replace(",", "."))));
  } catch (e) {
    redirect(`/mehr/lehrplan?tab=einstellungen&fehler=${encodeURIComponent(e instanceof Error ? e.message : "Bitte vier Zahlen eingeben.")}#notenschluessel`);
  }
  revalidatePath("/mehr/lehrplan");
  redirect("/mehr/lehrplan?tab=einstellungen&gespeichert=notenschluessel#notenschluessel");
}
