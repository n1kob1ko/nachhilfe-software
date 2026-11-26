"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { briefingNeu, lernzettelUebernehmen, materialAnBiko } from "@/lib/biko";

const q = (s: string) => encodeURIComponent(s);

/** Materialseite: das Dokument an Biko geben (Zusammenfassung und Lernzettel für einen Schüler). */
export async function bikoMaterialAction(materialId: number, f: FormData) {
  const teacher = await requireTeacher();
  const r = materialAnBiko({
    materialId,
    studentId: Number(f.get("student_id")),
    teacherId: teacher.id,
    wunsch: String(f.get("wunsch") ?? ""),
    keineNamen: f.get("keine_namen") === "1",
  });
  if ("error" in r) redirect(`/mehr/material/${materialId}?fehler=${q(r.error)}#biko`);
  revalidatePath(`/mehr/material/${materialId}`);
  redirect(`/mehr/material/${materialId}?biko=1#biko`);
}

/** Heute oder Mehr › Biko: das heutige Briefing mit dem jetzigen Stand neu schreiben lassen. */
export async function bikoBriefingNeuAction() {
  const teacher = await requireTeacher();
  const r = briefingNeu(teacher.id);
  if ("error" in r) redirect(`/mehr/biko?fehler=${q(r.error)}`);
  revalidatePath("/");
  redirect("/mehr/biko?neu=1");
}

/** Mehr › Biko: den Lernzettel für den Schüler übernehmen (Schüler-App und Drucken). */
export async function bikoUebernehmenAction(id: number) {
  const teacher = await requireTeacher();
  const r = lernzettelUebernehmen(id, teacher.id);
  if ("error" in r) redirect(`/mehr/biko/${id}?fehler=${q(r.error)}`);
  revalidatePath(`/mehr/biko/${id}`);
  redirect(`/mehr/biko/${id}?uebernommen=1`);
}
