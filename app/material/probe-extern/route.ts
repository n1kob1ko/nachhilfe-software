import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, saveUpload, sniffType } from "@/lib/materials";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { DATEI_TITEL, dateiInfo, eigeneDateien, kostenProbe, liesProbe, MAX_DATEIEN, probeTor } from "@/lib/probe-extern";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400, dateien?: { angabe: number[]; loesung: number[] }) => Response.json({ error, ...dateien }, { status });
const ids = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

/**
 * Eigene Probeschularbeit (lib/probe-extern.ts): Angabe and Musterlösung come in (PDF or photos) and are stored as the student's
 * material; the app reads the text of a PDF itself, and with `ki` = 1 (the teacher's tap, after the cost was shown and the tick
 * „kein Name darauf“) the KI reads what the app could not, one request per field. The answer is the rows of the check view;
 * nothing else is created here. A second request sends the stored files' ids instead of the files. A route handler, not a server
 * action, because PDFs and photos can be larger than an action's body limit; outside the proxy, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  if (Number(request.headers.get("content-length") ?? 0) > 2 * MAX_DATEIEN * MAX_UPLOAD_BYTES + 1024 * 1024) return fail("Die Dateien sind zu groß.", 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Dateien kamen nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const student = repo.getStudent(Number(form.get("schueler")));
  if (!student) return fail("Diesen Schüler gibt es nicht.", 404);
  const test = repo.getTest(Number(form.get("pruefung")));
  if (!test || test.student_id !== student.id) return fail("Diese Schularbeit gehört zu einem anderen Schüler.", 404);
  const ki = form.get("ki") === "1";
  if (ki && form.get("keine_namen") !== "1") return fail("Bitte bestätigen, dass auf den Seiten kein Name steht.");

  // stored files first (a second request), then new ones; only this student's
  const dateien = { angabe: eigeneDateien(ids(form.get("materialien_angabe")), student.id), loesung: eigeneDateien(ids(form.get("materialien_loesung")), student.id) };
  for (const feld of ["angabe", "loesung"] as const) {
    const files = form.getAll(feld).filter((f): f is File => f instanceof File && f.size > 0);
    if (dateien[feld].length + files.length > MAX_DATEIEN) return fail(`Höchstens ${MAX_DATEIEN} Dateien je Feld.`, 400, dateien);
    for (const file of files) {
      const data = Buffer.from(await file.arrayBuffer());
      if (!sniffType(data)) return fail("Bitte PDFs oder Fotos (JPG, PNG, WebP) wählen.", 400, dateien);
      try {
        const id = saveUpload({ name: file.name, data }, { title: DATEI_TITEL[feld], subject: test.subject, studentId: student.id, teacherId: teacher.id }).id;
        if (!dateien[feld].includes(id)) dateien[feld].push(id);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Eine Datei konnte nicht gespeichert werden.", 400, dateien);
      }
    }
    if (files.length) revalidatePath("/mehr/material", "layout");
  }
  if (!dateien.angabe.length) return fail("Bitte die Angabe wählen.", 400, dateien);
  // the same file as Angabe and as Musterlösung: once is enough
  dateien.loesung = dateien.loesung.filter((id) => !dateien.angabe.includes(id));

  try {
    const lesung = await liesProbe({ studentId: student.id, testId: test.id, teacherId: teacher.id, angabeIds: dateien.angabe, loesungIds: dateien.loesung, ki });
    const tor = probeTor(student.id);
    const zuLesen = lesung.offen.angabe + lesung.offen.loesung > 0;
    return Response.json({
      ...dateien,
      seiten: { angabe: dateiInfo(dateien.angabe), loesung: dateiInfo(dateien.loesung) },
      lesung,
      kosten: zuLesen && tor.erlaubt ? kostenProbe(lesung.offen) : null,
      kiGrund: zuLesen && !tor.erlaubt ? tor.grund : null,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Dateien ließen sich nicht lesen.", 400, dateien);
  }
}
