/**
 * KI prüfen am Whiteboard (niko, 19.10.2026, after „Warum liest die KI das whiteboard nicht?“ he chose „Bauen“).
 * Next to Richtig, Teilweise and Falsch the teacher taps „KI prüfen“: the board sends the picture of that one task
 * with the student's handwriting under it, the KI reads it, compares it with the task's solution and suggests a
 * grade with a short reason. The teacher takes it over with one tap or grades otherwise (lib/whiteboard-grades.ts).
 *
 * - Nothing is stored here and the Lernstand does not change: only the teacher's grade counts.
 * - Only the picture of the task goes to the KI, with the task's text and solution; no name from the app.
 * - „unklar“ (not readable, nothing there, not sure) is a valid answer: then the teacher grades. Wrong grades are
 *   worse than none (niko's rule for the Textkorrektur, kept here).
 * - Without KI, or with a provider that cannot read pictures (manual mode, DeepSeek), there is no button.
 */
import { aiReadsImages, pruefeWhiteboard } from "./ai";
import { MAX_ANALYSIS_IMAGE_BYTES, sniffType } from "./materials";
import * as repo from "./repo";
import type { Review } from "./tasks";
import { boardTask } from "./whiteboard-content";

/** The KI's suggestion for one task, as the teacher sees it. */
export type BoardCheck = { bewertung: Review | "unklar"; grund: string; gelesen: string; ergebnis: string | null };

/** Whether the board offers „KI prüfen“: KI on for it and its provider reads pictures. */
export function boardCheckAvailable(): boolean {
  return aiReadsImages("whiteboard");
}

const oneLine = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** The picture from the board: a data URL of a PNG or JPEG, checked by its first bytes, at most 5 MB. */
export function boardPicture(raw: unknown): { mime: "image/png" | "image/jpeg"; base64: string } | null {
  if (typeof raw !== "string") return null;
  const m = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(raw);
  if (!m || m[1].length > Math.ceil((MAX_ANALYSIS_IMAGE_BYTES * 4) / 3)) return null;
  const type = sniffType(Buffer.from(m[1].slice(0, 32), "base64"))?.mime;
  return type === "image/png" || type === "image/jpeg" ? { mime: type, base64: m[1] } : null;
}

/** Asks the KI about one task the student worked out on the board. */
export async function checkBoardTask(o: { studentId: number; unitId: number; teacherId: number; taskId: number; image: unknown }): Promise<{ ok: true; check: BoardCheck } | { error: string }> {
  if (!boardCheckAvailable()) return { error: "Die KI ist gerade nicht eingerichtet oder kann im eingestellten Modus keine Bilder lesen." };
  const task = repo.getTask(o.taskId);
  if (!task) return { error: "Diese Aufgabe gibt es nicht mehr." };
  const picture = boardPicture(o.image);
  if (!picture) return { error: "Das Bild vom Whiteboard ist nicht angekommen. Bitte noch einmal tippen." };
  const solution = [task.solution, ...(task.solutionSteps ?? [])].map((s) => s.trim()).filter(Boolean).join("\n");
  if (!solution) return { error: "Zu dieser Aufgabe ist keine Lösung gespeichert. Bitte selbst bewerten." };
  const t = boardTask(task);
  const r = await pruefeWhiteboard(picture, { text: t.prompt, optionen: t.options, loesung: solution }, { teacherId: o.teacherId, unitId: o.unitId, studentId: o.studentId, trigger: "whiteboard" });
  if (!r.ok) {
    // an outage in plain words; the technical detail stays in the KI log (ai_calls)
    const down = r.cause === "nicht_erreichbar" || r.cause === "anbieter";
    return { error: down ? "Die KI ist gerade nicht erreichbar. Bewerte bitte selbst oder tippe später noch einmal." : r.message };
  }
  const k = r.data;
  return { ok: true, check: { bewertung: k.bewertung, grund: oneLine(k.grund, 400), gelesen: oneLine(k.gelesen, 400), ergebnis: k.ergebnis ? oneLine(k.ergebnis, 120) : null } };
}
