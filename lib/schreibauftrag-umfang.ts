/**
 * Umfang eines Schreibauftrags (Plan 4.2, niko: „Die Länge des Ausgangstextes und der Schülerarbeit müssen getrennt
 * eingestellt werden.“): das Wortziel des Schülers und die Länge der Textbeilage sind zwei freie Zahlen. Die Vorgaben
 * richten sich nach der Schulstufe; ab der 12. Schulstufe gilt das Wortziel der Textsorte (lib/schreibauftrag.ts),
 * davor etwas weniger. Die Längen der Textbeilage sind eine Annahme (eine Kurzgeschichte der Oberstufe hat eher 600 bis
 * 1 000 Wörter, ein Zeitungsartikel 400 bis 800) und lassen sich je Auftrag ändern. Rein, für Formular und Server.
 */
import { SORTEN, type SorteKey } from "./schreibauftrag";
import { cleanTarget, MAX_TARGET, MIN_TARGET } from "./textinterpretation";

export const MIN_BEILAGE = 100;
export const MAX_BEILAGE = 6_000;

/** Anteil des Wortziels der Textsorte je Schulstufe (ab der 12. das ganze). */
const ANTEIL: Record<number, number> = { 9: 0.7, 10: 0.8, 11: 0.9 };
/** Länge der Textbeilage je Schulstufe: Geschichte und Sachtext. */
const BEILAGE: Record<number, [number, number]> = { 9: [600, 400], 10: [700, 500], 11: [800, 600], 12: [900, 700] };

const stufeIn = (schulstufe: number | null | undefined) => Math.min(12, Math.max(9, schulstufe ?? 12));

/** Die Vorgaben für einen neuen Auftrag: Wortziel des Schülers und Länge der Textbeilage, beide in Wörtern. */
export function umfangVorgabe(sorte: SorteKey, schulstufe: number | null | undefined): { target: number; beilage: number } {
  const st = stufeIn(schulstufe);
  const s = SORTEN[sorte];
  const target = Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round((s.target * (ANTEIL[st] ?? 1)) / 10) * 10));
  const [geschichte, sachtext] = BEILAGE[st];
  return { target: cleanTarget(target, s.target), beilage: s.beilage === "Geschichte" ? geschichte : sachtext };
}

/** Die Länge der Textbeilage aus dem Formular; leer oder unbrauchbar: keine Vorgabe. */
export function cleanBeilageZiel(v: unknown): number | null {
  const n = Math.round(Number(String(v ?? "").trim()));
  if (!String(v ?? "").trim() || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_BEILAGE, Math.max(MIN_BEILAGE, Math.round(n / 10) * 10));
}

/** Eine Zeile zur eingefügten Textbeilage: wie lang sie ist und ob das zur Vorgabe passt. Nur ein Hinweis. */
export function beilageLaenge(woerter: number, ziel: number | null): { text: string; passt: boolean } {
  const n = woerter.toLocaleString("de-AT");
  if (!ziel) return { text: `${n} Wörter`, passt: true };
  const z = ziel.toLocaleString("de-AT");
  if (woerter < ziel * 0.75) return { text: `${n} Wörter, kürzer als die geplanten ${z}`, passt: false };
  if (woerter > ziel * 1.5) return { text: `${n} Wörter, länger als die geplanten ${z}`, passt: false };
  return { text: `${n} Wörter (geplant: ${z})`, passt: true };
}
