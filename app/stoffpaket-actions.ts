"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { getStoffpaket, starteStoffpaket, uebernimmStoffpaket, verwirfStoffpaket } from "@/lib/stoffpaket";

const seite = (studentId: number, id: number, q = "") => `/schueler/${studentId}/stoff/${id}${q ? `?${q}` : ""}`;

/** „Alles übernehmen“ (lib/stoffpaket.ts uebernimmStoffpaket). */
export async function uebernimmStoffpaketAction(id: number) {
  const t = await requireTeacher();
  const p = getStoffpaket(id);
  if (!p) redirect("/");
  const out = uebernimmStoffpaket(id, t.id);
  revalidatePath(`/schueler/${p.student_id}`);
  revalidatePath("/");
  if ("fehler" in out) redirect(seite(p.student_id, id, `fehler=${encodeURIComponent(out.fehler)}`));
  redirect(seite(p.student_id, id, out.ziel ? `ziel=${encodeURIComponent(out.ziel)}` : ""));
}

/** „Verwerfen“: Entwürfe weg, nichts beim Schüler. */
export async function verwirfStoffpaketAction(id: number) {
  await requireTeacher();
  const p = getStoffpaket(id);
  if (!p) redirect("/");
  verwirfStoffpaket(id);
  revalidatePath(`/schueler/${p.student_id}`);
  redirect(`/schueler/${p.student_id}/stoff?verworfen=1`);
}

/** „Noch einmal“ nach einem Fehler: dieselben Fotos, derselbe Text, dieselben Teile (kein Name war schon bestätigt). */
export async function nochmalStoffpaketAction(id: number) {
  const t = await requireTeacher();
  const p = getStoffpaket(id);
  if (!p) redirect("/");
  const out = starteStoffpaket({ studentId: p.student_id, teacherId: t.id, unitId: p.unit_id, fach: p.fach, anweisung: p.anweisung, materialIds: p.dateien, teile: p.teile, keinName: true });
  if ("fehler" in out) redirect(seite(p.student_id, id, `fehler=${encodeURIComponent(out.fehler)}`));
  redirect(seite(p.student_id, out.id));
}
