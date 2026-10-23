"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { bewerte, bewertungInfos, entferneBewertung, type BewertungEingabe } from "@/lib/bewertungen";
import type { BewertungInfo, BewertungZiel } from "@/lib/bewertung-regeln";
import { getLernpaket, getSchritt } from "@/lib/lernpakete";
import * as repo from "@/lib/repo";
import type { TaskDraft } from "@/lib/tasks";

/** The rated task, read on the server (never taken from the browser), with its subject. */
function aufgabeVon(ziel: BewertungZiel): { aufgabe: TaskDraft; fach: string } | null {
  if (ziel.art === "aufgabe") {
    const t = repo.getTask(Number(ziel.id));
    const w = t ? repo.getWorksheet(t.worksheet_id) : null;
    return t && w ? { aufgabe: t, fach: w.subject } : null;
  }
  const s = getSchritt(Number(ziel.id));
  const a = s?.aufgaben[Number(ziel.index)];
  const p = s && a ? getLernpaket(s.paket_id) : null;
  return a && p ? { aufgabe: a, fach: p.fach } : null;
}

/** „Aufgabe bewerten“: stores or changes the teacher's own rating; touches nothing of the students. */
export async function bewerteAufgabeAction(ziel: BewertungZiel, e: BewertungEingabe): Promise<{ info: BewertungInfo } | { fehler: string }> {
  const teacher = await requireTeacher();
  const z = aufgabeVon(ziel);
  if (!z) return { fehler: "Aufgabe nicht gefunden." };
  const out = bewerte(z.aufgabe, z.fach, teacher.id, e);
  if ("fehler" in out) return out;
  revalidatePath("/uebungen/bibliothek", "layout");
  return { info: bewertungInfos([z.aufgabe], teacher.id)[0] };
}

/** Takes the teacher's own rating back. */
export async function entferneBewertungAction(ziel: BewertungZiel): Promise<{ info: BewertungInfo } | { fehler: string }> {
  const teacher = await requireTeacher();
  const z = aufgabeVon(ziel);
  if (!z) return { fehler: "Aufgabe nicht gefunden." };
  entferneBewertung(z.aufgabe, teacher.id);
  revalidatePath("/uebungen/bibliothek", "layout");
  return { info: bewertungInfos([z.aufgabe], teacher.id)[0] };
}
