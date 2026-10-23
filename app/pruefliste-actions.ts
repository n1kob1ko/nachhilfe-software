"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { darfPruefliste, getEinreichung, liesFotos, uebernimm, verwirf } from "@/lib/pruefliste";

/**
 * Die Prüfliste (lib/pruefliste.ts): was ein Schüler in seiner App eingetragen hat, lesen lassen, übernehmen oder
 * verwerfen. Nur die Lehrer des Schülers und der Admin.
 */
export type PrueflisteStand = { fehler?: string; gelesen?: number } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function erlaubt(id: number) {
  const teacher = await requireTeacher();
  const e = getEinreichung(id);
  if (!e) return { fehler: "Diesen Eintrag gibt es nicht mehr." } as const;
  if (!darfPruefliste(teacher, e.studentId)) return { fehler: "Das dürfen nur die Lehrer dieses Schülers." } as const;
  return { teacher, e } as const;
}

const neuLaden = (studentId: number) => {
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
};

/** Liest die Fotos (jedes höchstens einmal), erst nach dem Haken „kein Name darauf“. */
export async function prueflisteLesenAction(id: number, _: PrueflisteStand, formData: FormData): Promise<PrueflisteStand> {
  const a = await erlaubt(id);
  if ("fehler" in a) return { fehler: a.fehler };
  if (str(formData, "keine_namen") !== "1") return { fehler: "Bitte bestätigen, dass auf den Fotos kein Name steht." };
  try {
    const gelesen = await liesFotos(id, { teacherId: a.teacher.id, heute: dayOf(new Date()) });
    neuLaden(a.e.studentId);
    return { gelesen };
  } catch (e) {
    neuLaden(a.e.studentId);
    return { fehler: e instanceof Error ? e.message : "Die Fotos konnten nicht gelesen werden." };
  }
}

/** Übernimmt den Eintrag mit den Werten aus dem Formular als Schularbeit. */
export async function prueflisteUebernehmenAction(id: number, _: PrueflisteStand, formData: FormData): Promise<PrueflisteStand> {
  const a = await erlaubt(id);
  if ("fehler" in a) return { fehler: a.fehler };
  const r = uebernimm(id, a.teacher.id, { art: str(formData, "art"), fach: str(formData, "fach"), datum: str(formData, "datum"), titel: str(formData, "titel"), stoff: str(formData, "stoff"), notiz: str(formData, "notiz") });
  if ("fehler" in r) return { fehler: r.fehler };
  neuLaden(a.e.studentId);
  revalidatePath("/mehr/material", "layout");
  return null;
}

export async function prueflisteVerwerfenAction(id: number): Promise<PrueflisteStand> {
  const a = await erlaubt(id);
  if ("fehler" in a) return { fehler: a.fehler };
  const r = verwirf(id, a.teacher.id);
  if ("fehler" in r) return { fehler: r.fehler };
  neuLaden(a.e.studentId);
  revalidatePath("/mehr/material", "layout");
  return null;
}
