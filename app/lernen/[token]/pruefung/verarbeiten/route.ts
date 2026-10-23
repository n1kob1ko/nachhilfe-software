import { revalidatePath } from "next/cache";
import { wienerDatum } from "@/lib/planung/zeit";
import { foreignRequest } from "@/lib/picture-story-routes";
import { getEinreichung, verarbeite } from "@/lib/pruefliste";
import { getStudentByToken } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Gleich nach dem Eintragen, ohne Knopf: die Fotos eines eigenen Eintrags werden gelesen und, wenn alles klar ist,
 * wird gleich eine Prüfung daraus (lib/pruefliste.ts `verarbeite`). Die Antwort sagt nur, ob ein Lehrer noch prüft.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const student = getStudentByToken((await params).token);
  if (!student) return Response.json({ error: "Diesen Link gibt es nicht mehr." }, { status: 404 });
  if (foreignRequest(request)) return Response.json({ error: "Nicht erlaubt." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const e = Number.isInteger(id) && id > 0 ? getEinreichung(id) : null;
  if (!e || e.studentId !== student.id) return Response.json({ error: "Diesen Eintrag gibt es nicht." }, { status: 404 });
  const status = await verarbeite(id, { heute: wienerDatum() });
  revalidatePath(`/schueler/${student.id}`);
  revalidatePath("/");
  return Response.json({ ok: true, eingetragen: status === "automatisch" });
}
