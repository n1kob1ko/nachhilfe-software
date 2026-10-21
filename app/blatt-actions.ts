"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { speichereBlatt, type BlattEingabe } from "@/lib/blatt-einlesen";

/** Takes a checked solved sheet over into the student's profile (lib/blatt-einlesen.ts). */
export async function speichereBlattAction(e: Omit<BlattEingabe, "teacherId">): Promise<{ error: string } | { href: string }> {
  const teacher = await requireTeacher();
  const out = speichereBlatt({ ...e, teacherId: teacher.id });
  if ("error" in out) return out;
  revalidatePath(`/schueler/${e.studentId}`, "layout");
  revalidatePath("/");
  return { href: `/schueler/${e.studentId}?tab=${e.art === "pruefung" ? "schule" : "lernverlauf"}` };
}
