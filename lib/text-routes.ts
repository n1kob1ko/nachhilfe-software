/**
 * Saving a Textarbeit over HTTP, shared by the teacher's route (/texte/<id>/speichern) and the
 * tablet's (/geraet/text/<id>). The browser sends { version, body, force? } as JSON and gets back the
 * new version, or 409 with the stored text when it was changed elsewhere in the meantime.
 */
import { notifyTablet, parseView, pushLive } from "./live";
import { validateDoc } from "./text-doc";
import { getText, saveText, type TextView } from "./texts";
import { runningUnitForStudent } from "./units";
import { publish } from "./whiteboard-hub";

export const textChannel = (textId: number) => `text:${textId}`;

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Larger than any text we accept (MAX_CHARS plus JSON overhead), smaller than anything harmful. */
const MAX_BYTES = 2_000_000;

export async function handleTextSave(request: Request, textId: number, o: { mayWrite: (t: TextView) => boolean; by: "lehrer" | "schueler" }): Promise<Response> {
  // a save only ever comes from our own pages
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return json({ error: "Nicht erlaubt." }, 403);
  const text = Number.isInteger(textId) ? getText(textId) : null;
  if (!text) return json({ error: "Diesen Text gibt es nicht." }, 404);
  if (!o.mayWrite(text)) return json({ error: "Dieser Text kann hier gerade nicht bearbeitet werden." }, 403);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: "Der Text ist zu lang." }, 413);
  let data: { version?: unknown; body?: unknown; force?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  if (typeof data.version !== "number" || !Number.isInteger(data.version)) return json({ error: "Ungültige Anfrage." }, 400);
  const checked = validateDoc(data.body);
  if ("error" in checked) return json({ error: checked.error }, 400);

  const result = saveText(text.id, checked.doc, data.version, { force: data.force === true });
  if (!result.ok) return result.reason === "fehlt" ? json({ error: "Diesen Text gibt es nicht." }, 404) : json(result, 409);
  if (!result.unchanged) afterSave(text, result.version, o.by);
  return json(result);
}

/** Others who look at the text follow along: the teacher's text page, the unit's live status, the tablet. */
function afterSave(text: TextView, version: number, by: "lehrer" | "schueler") {
  publish(textChannel(text.id), { type: "text", version });
  const unit = runningUnitForStudent(text.student_id);
  if (!unit) return;
  pushLive(unit.id);
  // the teacher wrote: a tablet that shows this text loads it again
  const view = parseView(unit.device_view);
  if (by === "lehrer" && view.kind === "text" && view.textId === text.id) notifyTablet(unit.teacher_id, "text");
}
