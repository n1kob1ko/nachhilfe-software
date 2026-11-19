"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { speichereVorlage } from "@/lib/lernspiele";

/**
 * Mehr › Phantombild-Vorlage: die Personenbeschreibung, die die Schüler im Spiel „Text lernen“ auswendig lernen
 * (lib/phantom-vorlage.ts). Leer oder „Zurücksetzen“: wieder die Vorlage von Claude.
 */
export async function vorlageSpeichernAction(formData: FormData) {
  await requireTeacher();
  const zurueck = formData.get("zurueck") === "1";
  const r = speichereVorlage(zurueck ? "" : String(formData.get("text") ?? ""));
  revalidatePath("/mehr/phantombild-vorlage");
  if ("fehler" in r) redirect(`/mehr/phantombild-vorlage?fehler=${encodeURIComponent(r.fehler)}`);
  redirect(`/mehr/phantombild-vorlage?ok=${encodeURIComponent(zurueck ? "Wieder die Vorlage von Claude." : "Gespeichert. Ab der nächsten Runde lernen die Schüler diesen Text.")}`);
}
