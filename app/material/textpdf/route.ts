import { currentTeacher } from "@/lib/auth";
import { MAX_ANALYSIS_PDF_BYTES, sniffType } from "@/lib/materials";
import { liesPdfText, PdfFehler } from "@/lib/pdf-text";
import { foreignRequest, notAllowed } from "@/lib/picture-story-routes";
import { textAusGelesen } from "@/lib/textinterpretation-foto";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Text aus einem PDF für einen Schreibauftrag (lib/pdf-text.ts): the PDF comes in, the app reads the text stored in it,
 * without KI, line by line, and the answer goes into the form. Nothing is stored here, not even the PDF; the teacher
 * checks the text and saves it with the form. A route handler like „Vom Foto lesen“, because a PDF can be larger than an
 * action's body limit; outside the proxy for the same reason, so it checks the session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return notAllowed(401);
  if (foreignRequest(request)) return notAllowed();
  const max = MAX_ANALYSIS_PDF_BYTES;
  const zuGross = `Das PDF ist zu groß (höchstens ${max / 1024 / 1024} MB).`;
  if (Number(request.headers.get("content-length") ?? 0) > max + 1024 * 1024) return fail(zuGross, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Die Datei kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return fail("Bitte ein PDF wählen.");
  if (file.size > max) return fail(zuGross, 413);
  const data = Buffer.from(await file.arrayBuffer());
  if (sniffType(data)?.mime !== "application/pdf") return fail("Das ist keine PDF-Datei. Fotos liest „Vom Foto lesen“.");
  try {
    const g = liesPdfText(data);
    const vorschlag = textAusGelesen({ titel: g.titel, zeilen: g.zeilen, unsicher: [] });
    for (const h of g.hinweise) if (!vorschlag.hinweise.includes(h)) vorschlag.hinweise.push(h);
    return Response.json({ vorschlag, seiten: g.seiten });
  } catch (e) {
    return fail(e instanceof PdfFehler ? e.message : "Das PDF ließ sich nicht lesen. Kopier den Text heraus und füg ihn ein.");
  }
}
