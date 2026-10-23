"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { addFach, setFachAktiv, type FachErgebnis } from "@/lib/faecher";

/** Mehr › Fächer: nur die Verwaltung legt an oder deaktiviert; die Seite zeigt die Rückmeldung. */
function zurueck(e: FachErgebnis): never {
  // jedes Fach-Feld liest die Liste: Profil, Einheit, Schularbeit, Material, Texte
  revalidatePath("/", "layout");
  redirect(`/mehr/faecher?${e.ok ? `ok=${encodeURIComponent(e.hinweis)}` : `fehler=${encodeURIComponent(e.fehler)}`}`);
}

export async function addFachAction(formData: FormData) {
  await requireAdmin();
  zurueck(addFach(String(formData.get("name") ?? "")));
}

export async function setFachAktivAction(id: number, aktiv: boolean) {
  await requireAdmin();
  zurueck(setFachAktiv(id, aktiv));
}
