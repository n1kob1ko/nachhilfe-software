/**
 * Handgeschriebenen Text einlesen (lib/handschrift.ts): the parts the browser needs too, without server code.
 * The app tidies what the KI read (spaces, empty entries) and never changes a word: the mistakes of the student
 * are what the teacher corrects afterwards.
 */
import type { HandschriftGelesen } from "./ai/features";
import { MAX_CHARS } from "./text-doc";

/** Up to this many photos or PDF pages at once. */
export const MAX_HANDSCHRIFT_SEITEN = 4;
/** An unreadable word stands as this in the transcript. */
export const UNLESBAR = "[?]";

/** What the preview gets: the text (one paragraph or line per line) and what the teacher should check. */
export type HandschriftVorschlag = { text: string; absaetze: number; hinweise: string[] };

const eineZeile = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** How many unreadable places ([?]) are still in the text. */
export const offeneStellen = (text: string) => text.split(UNLESBAR).length - 1;

/**
 * Makes the preview text from what the KI read: one paragraph per line, no empty paragraphs, spaces inside a
 * paragraph tidied. Spelling, grammar and punctuation stay exactly as read.
 */
export function textAusHandschrift(g: HandschriftGelesen): HandschriftVorschlag {
  const hinweise: string[] = [];
  const absaetze = g.absaetze
    .flatMap((a) => String(a ?? "").split(/\r?\n/))
    // „[ ? ]“ or „[?? ]“ is the same mark
    .map((a) => a.replace(/[ \t ]+/g, " ").replace(/\[\s*\?+\s*\]/g, UNLESBAR).trim())
    .filter(Boolean);
  let text = absaetze.join("\n");
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS).replace(/\n[^\n]*$/, "");
    hinweise.push("Der Text war zu lang und wurde gekürzt.");
  }
  if (!text) hinweise.push("Auf den Fotos wurde kein handgeschriebener Text gefunden.");
  const offen = offeneStellen(text);
  if (offen) hinweise.push(offen === 1 ? `Ein Wort war nicht lesbar und steht als ${UNLESBAR} da. Bitte mit dem Foto vergleichen.` : `${offen} Wörter waren nicht lesbar und stehen als ${UNLESBAR} da. Bitte mit dem Foto vergleichen.`);
  for (const u of g.unsicher.slice(0, 6)) {
    const t = eineZeile(String(u ?? ""), 140);
    if (t) hinweise.push(`Unsicher: ${t}`);
  }
  return { text, absaetze: text ? text.split("\n").length : 0, hinweise };
}

/** „ca. 4 Cent“; a price below half a cent is never shown as nothing. */
export const centText = (c: number) => (c <= 0 ? "kostenlos" : c < 0.5 ? "unter 1 Cent" : `ca. ${Math.round(c)} Cent`);
