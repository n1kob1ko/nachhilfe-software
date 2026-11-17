"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { testSchuelerEinstellen, testSpielstandLoeschen } from "@/lib/spiele-testen";

/**
 * Mehr › Spiele testen (lib/spiele-testen.ts): stellt den eigenen Test-Schüler auf die gewählte Klasse und öffnet
 * seine Spiele. `klasse` kommt als „Gymnasium:3“.
 */
export async function spieleTestenAction(formData: FormData) {
  const me = await requireTeacher();
  const [schulart, klasse] = String(formData.get("klasse") ?? "").split(":");
  const s = testSchuelerEinstellen(me, schulart ?? "", Number(klasse));
  revalidatePath("/mehr/spiele-testen");
  redirect(`/lernen/${encodeURIComponent(s.access_token)}/spiele`);
}

/** Rekorde, Serie und Endlos-Stände des Test-Schülers zurücksetzen. */
export async function testSpielstandLoeschenAction() {
  const me = await requireTeacher();
  const n = testSpielstandLoeschen(me.id);
  revalidatePath("/mehr/spiele-testen");
  redirect(`/mehr/spiele-testen?ok=${encodeURIComponent(n ? "Spielstand gelöscht. Du fängst bei null an." : "Es gab noch keinen Spielstand.")}`);
}
