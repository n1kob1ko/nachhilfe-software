/**
 * Vokabeln vom Foto (lib/vokabel-foto.ts): the parts the browser needs too, without server code. The app turns what
 * the KI read into lines of the list editor („dog = der Hund | My *dog* …“) and never adds a word: what is not on the
 * photo is not in the list.
 */
import type { VokabelFotoGelesen } from "./ai/features";
import { leseListe, MAX_WOERTER } from "./vokabeln";

/** Up to this many photos or PDF pages at once (a unit's word list is often two to four pages). */
export const MAX_VOKABEL_SEITEN = 6;
/** An unreadable word stands as this in the list; a list with it cannot be saved. */
export const UNLESBAR = "[?]";
/** The teacher's hint (only Unit 3, only the left column) has at most this many characters. */
export const MAX_HINWEIS = 200;

/** What the editor gets: the lines, how many words they are, a title when the page has one, and what to check. */
export type VokabelFotoVorschlag = { titel: string; text: string; woerter: number; hinweise: string[] };

/** How many unreadable places ([?]) are in the text. */
export const offeneStellen = (text: string) => text.split(UNLESBAR).length - 1;

/** One field of a line: one line, no „=“ or „|“ (they divide a line), „[ ? ]“ written the same way. */
const feld = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[=|\t\r\n]+/g, " ")
    .replace(/\[\s*\?+\s*\]/g, UNLESBAR)
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+/g, " ")
    .replace(/^[;\s]+|[;\s]+$/g, "")
    .trim()
    .slice(0, max);

const schluessel = (z: string) => z.split("|")[0].toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Makes the editor lines from what the KI read: one word per line, English left, German right, the example sentence
 * after „|“. An entry without English or German is left out (and named); the same word twice stays once.
 */
export function textAusVokabelFoto(g: VokabelFotoGelesen): VokabelFotoVorschlag {
  const hinweise: string[] = [];
  const zeilen: string[] = [];
  const gesehen = new Set<string>();
  let ohneDe = 0;
  for (const p of g.paare ?? []) {
    const en = feld(p?.en, 120);
    const de = feld(p?.de, 160);
    const satz = feld(p?.satz, 300);
    if (!en && !de) continue;
    if (!en || !de) {
      ohneDe++;
      continue;
    }
    const zeile = `${en} = ${de}${satz ? ` | ${satz}` : ""}`;
    const key = schluessel(zeile);
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    zeilen.push(zeile);
  }
  let kurz = zeilen;
  if (kurz.length > MAX_WOERTER) {
    kurz = kurz.slice(0, MAX_WOERTER);
    hinweise.push(`Eine Liste hat höchstens ${MAX_WOERTER} Wörter. Die übrigen ${zeilen.length - MAX_WOERTER} bitte als zweite Liste lesen.`);
  }
  const text = kurz.join("\n");
  if (!kurz.length) hinweise.push("Auf den Fotos wurden keine Vokabeln mit deutscher Bedeutung gefunden.");
  if (ohneDe) hinweise.push(ohneDe === 1 ? "Bei einem Wort fehlte Englisch oder Deutsch. Es ist nicht in der Liste." : `Bei ${ohneDe} Wörtern fehlte Englisch oder Deutsch. Sie sind nicht in der Liste.`);
  const offen = offeneStellen(text);
  if (offen) hinweise.push(offen === 1 ? `Ein Wort war nicht lesbar und steht als ${UNLESBAR} da.` : `${offen} Wörter waren nicht lesbar und stehen als ${UNLESBAR} da.`);
  for (const u of (g.unsicher ?? []).map((x) => feld(x, 160)).filter(Boolean).slice(0, 8)) hinweise.push(u);
  return { titel: feld(g.titel, 80), text, woerter: leseListe(text).eintraege.length, hinweise };
}

/**
 * Puts the read lines into the editor: an empty editor gets them, otherwise they come after the lines already there,
 * without a word that is already in the list.
 */
export function mitGelesen(alt: string, neu: string): { text: string; dazu: number } {
  const da = new Set(
    alt
      .split("\n")
      .map((z) => z.trim())
      .filter(Boolean)
      .map(schluessel),
  );
  const dazu = neu
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z && !da.has(schluessel(z)));
  if (!alt.trim()) return { text: dazu.join("\n"), dazu: dazu.length };
  return { text: dazu.length ? `${alt.trimEnd()}\n${dazu.join("\n")}` : alt, dazu: dazu.length };
}
