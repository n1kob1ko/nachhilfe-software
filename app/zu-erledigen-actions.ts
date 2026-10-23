"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { getText } from "@/lib/texts";
import { markiereGesehen, type Abhaken } from "@/lib/zu-erledigen";

/**
 * „Abhaken“ in „Zu erledigen“ (lib/zu-erledigen.ts): eine Hausübung wird erledigt wie mit dem Häkchen im
 * Profil, ein Ergebnis oder ein abgegebener Text gilt für diesen Lehrer als gesehen.
 */
export async function abhakenAction(a: Abhaken) {
  const t = await requireTeacher();
  if (a.art === "hausuebung") {
    repo.setHomeworkStatus(a.id, "erledigt");
    revalidatePath(`/schueler/${a.studentId}`);
  } else if (a.art === "ergebnis" ? repo.getAssignment(a.id) : getText(a.id)) {
    markiereGesehen(t.id, a.art, a.id);
  }
  revalidatePath("/");
}

/** Der Lehrer hat das Ergebnis einer Übung geöffnet: es verlässt die offene Liste (außer es wartet auf seine Bewertung). */
export async function ergebnisGesehenAction(assignmentId: number) {
  const t = await requireTeacher();
  if (!repo.getAssignment(assignmentId)) return;
  markiereGesehen(t.id, "ergebnis", assignmentId);
  revalidatePath("/");
}
