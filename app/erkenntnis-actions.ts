"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { setzeErkenntnisStatus } from "@/lib/erkenntnisse";

/** Eine Erkenntnis auf erledigt (der Fehler ist behoben) oder wieder auf offen setzen (lib/erkenntnisse.ts). */
export async function erkenntnisStatusAction(id: number, studentId: number, status: "offen" | "erledigt") {
  await requireTeacher();
  setzeErkenntnisStatus(id, studentId, status);
  revalidatePath(`/schueler/${studentId}`, "layout");
}
