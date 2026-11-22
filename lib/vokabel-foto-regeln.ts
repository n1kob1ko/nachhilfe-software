/**
 * Vokabeln vom Foto (lib/vokabel-foto.ts): the parts the browser needs too, without server code. The app turns what
 * the KI read into lines of the list editor („dog = der Hund | My *dog* …“) and never adds a word: what is not on the
 * photo is not in the list. A word that is on the photo without German (niko 2026-11-22: the yellow phrases above the
 * Word File table) gets the KI's own translation; those lines stand under the comment KI_ERGAENZT, so the teacher sees
 * which German is not from the book.
 */
import type { VokabelFotoGelesen } from "./ai/features";
import { leseListe, MAX_WOERTER } from "./vokabeln";

/** Up to this many photos or PDF pages at once (a unit's word list is often two to four pages). */
export const MAX_VOKABEL_SEITEN = 6;
/** An unreadable word stands as this in the list; a list with it cannot be saved. */
export const UNLESBAR = "[?]";
/** The teacher's hint (only Unit 3, only the left column) has at most this many characters. */
export const MAX_HINWEIS = 200;
/** Comment line above words the KI translated itself (no German on the photo). „#“ lines are not words (lib/vokabeln.ts). */
export const KI_ERGAENZT = "# Von der KI übersetzt (nicht im Buch), bitte prüfen:";
/** Comment line where the words from the book go on after such a block. */
export const AUS_DEM_BUCH = "# Aus dem Buch:";

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

/** German abbreviations written out, so the student learns and types the whole word. */
const AUSGESCHRIEBEN: [RegExp, string][] = [
  [/\bjdn\./g, "jemanden"],
  [/\bjdm\./g, "jemandem"],
  [/\bjds\./g, "jemandes"],
  [/\betw\./g, "etwas"],
];
const ARTIKEL = "(?:der|die|das)\\s+";
const ZWEI_FORMEN = new RegExp(`^((?:${ARTIKEL})?[\\p{L}-]+)\\s*/\\s*((?:${ARTIKEL})?[\\p{L}-]+)$`, "u");

/**
 * The German side as a student learns it (niko 2026-11-22): „hier:“ and the like gone, jdn./etw. written out,
 * „Einwanderer/Einwanderin“ as two answers. The KI is told the same; this catches what it leaves.
 */
export function deutschSauber(de: string): string {
  let s = de.replace(/(^|;\s*)(?:hier|auch|bes\.|ugs\.)\s*:\s*/gi, "$1");
  for (const [re, voll] of AUSGESCHRIEBEN) s = s.replace(re, voll);
  return s
    .split(/\s*;\s*/)
    .map((teil) => {
      const m = teil.match(ZWEI_FORMEN);
      return m ? `${m[1]}; ${m[2]}` : teil;
    })
    .join("; ");
}

const schluessel = (z: string) => z.split("|")[0].toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Makes the editor lines from what the KI read: one word per line, English left, German right, the example sentence
 * after „|“. An entry without English or German is left out (and named); the same word twice stays once.
 */
export function textAusVokabelFoto(g: VokabelFotoGelesen): VokabelFotoVorschlag {
  const hinweise: string[] = [];
  const eintraege: { zeile: string; ergaenzt: boolean }[] = [];
  const gesehen = new Set<string>();
  let ohneDe = 0;
  for (const p of g.paare ?? []) {
    const en = feld(p?.en, 120);
    const de = feld(deutschSauber(feld(p?.de, 200)), 160);
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
    eintraege.push({ zeile, ergaenzt: p?.ergaenzt === true });
  }
  let kurz = eintraege;
  if (kurz.length > MAX_WOERTER) {
    kurz = kurz.slice(0, MAX_WOERTER);
    hinweise.push(`Eine Liste hat höchstens ${MAX_WOERTER} Wörter. Die übrigen ${eintraege.length - MAX_WOERTER} bitte als zweite Liste lesen.`);
  }
  // a block of translated words gets the comment above it; when book words follow, „# Aus dem Buch:“
  const zeilen: string[] = [];
  let vorher: boolean | null = null;
  for (const e of kurz) {
    if (e.ergaenzt && vorher !== true) zeilen.push(KI_ERGAENZT);
    else if (!e.ergaenzt && vorher === true) zeilen.push(AUS_DEM_BUCH);
    zeilen.push(e.zeile);
    vorher = e.ergaenzt;
  }
  const text = zeilen.join("\n");
  if (!kurz.length) hinweise.push("Auf den Fotos wurden keine Vokabeln gefunden.");
  const ergaenzt = kurz.filter((e) => e.ergaenzt).length;
  if (ergaenzt)
    hinweise.push(
      ergaenzt === 1
        ? "Ein Wort stand ohne Deutsch da. Die KI hat es übersetzt und einen Satz dazugeschrieben (unter „Von der KI übersetzt“). Bitte prüfen."
        : `${ergaenzt} Wörter standen ohne Deutsch da. Die KI hat sie übersetzt und Sätze dazugeschrieben (unter „Von der KI übersetzt“). Bitte prüfen.`,
    );
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
  const kommentar = (z: string) => z.startsWith("#");
  const da = new Set(
    alt
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z && !kommentar(z))
      .map(schluessel),
  );
  const neuZeilen = neu
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z && (kommentar(z) || !da.has(schluessel(z))));
  // a comment stays only when a word follows it before the next comment
  const dazuZeilen = neuZeilen.filter((z, i) => !kommentar(z) || (i + 1 < neuZeilen.length && !kommentar(neuZeilen[i + 1])));
  // „# Aus dem Buch:“ at the very start (the translated block above it was all there already) says nothing
  if (dazuZeilen[0] === AUS_DEM_BUCH) dazuZeilen.shift();
  const dazu = dazuZeilen.filter((z) => !kommentar(z)).length;
  if (!alt.trim()) return { text: dazuZeilen.join("\n"), dazu };
  return { text: dazu ? `${alt.trimEnd()}\n${dazuZeilen.join("\n")}` : alt, dazu };
}
