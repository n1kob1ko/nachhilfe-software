import { revalidatePath } from "next/cache";
import { wienerDatum } from "@/lib/planung/zeit";
import { foreignRequest } from "@/lib/picture-story-routes";
import { MAX_FOTOS, MAX_PDF_BYTES, reicheEin, type FotoDatei } from "@/lib/pruefliste";
import { getStudentByToken } from "@/lib/repo";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Der Schüler trägt in seiner App eine Prüfung ein (lib/pruefliste.ts): Art, Fach, Datum, Stoff, Notiz und bis zu
 * MAX_FOTOS Fotos (`foto`), dazu `keine_namen` (auf den Fotos steht kein Name). Gespeichert wird hier; ohne Fotos wird
 * gleich entschieden, ob es eine Prüfung wird. Die Fotos liest danach `verarbeiten` (die Seite ruft es gleich auf).
 * Ein Route Handler, keine Server Action, weil Fotos größer sein können als deren Grenze.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const student = getStudentByToken((await params).token);
  if (!student) return fail("Diesen Link gibt es nicht mehr.", 404);
  if (foreignRequest(request)) return fail("Nicht erlaubt.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FOTOS * MAX_PDF_BYTES + 1024 * 1024) return fail("Die Fotos sind zusammen zu groß.", 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Das kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const s = (k: string) => String(form.get(k) ?? "");
  const dateien = form.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
  if (dateien.length > MAX_FOTOS) return fail(`Höchstens ${MAX_FOTOS} Fotos.`);
  const fotos: FotoDatei[] = await Promise.all(dateien.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) })));
  let r: { id: number; verarbeiten: boolean };
  try {
    r = reicheEin(student.id, { art: s("art"), fach: s("fach"), datum: s("datum"), stoff: s("stoff"), notiz: s("notiz") }, fotos, { keineNamen: s("keine_namen") === "1", heute: wienerDatum() });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Das ging nicht. Bitte noch einmal versuchen.");
  }
  revalidatePath(`/schueler/${student.id}`);
  revalidatePath("/");
  return Response.json({ ok: true, id: r.id, verarbeiten: r.verarbeiten });
}
