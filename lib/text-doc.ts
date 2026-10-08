/**
 * The content of a Textarbeit: a list of blocks (paragraph or heading), each a list of runs with
 * bold, italic and underline. Stored as JSON, never as HTML, so nothing a student pastes can end up
 * as markup on a teacher's page. Pure functions, used by the server and the browser.
 */

export type Run = { x: string; b?: 1; i?: 1; u?: 1 };
export type Block = { t: "p" | "h"; r: Run[] };
export type TextDoc = Block[];

export const MAX_CHARS = 200_000;
export const MAX_BLOCKS = 5_000;

export const blockText = (b: Block) => b.r.map((r) => r.x).join("");
export const plainText = (doc: TextDoc) => doc.map(blockText).join("\n");

const WORD = /[\p{L}\p{N}]+(?:[-'’.][\p{L}\p{N}]+)*/gu;

/** Words as a teacher would count them: "Schul-Ausflug" and "z.B." are one word each. */
export function countWords(doc: TextDoc | string): number {
  const text = typeof doc === "string" ? doc : plainText(doc);
  return text.match(WORD)?.length ?? 0;
}

/** Characters with spaces, without line breaks. */
export function countChars(doc: TextDoc | string): number {
  const text = typeof doc === "string" ? doc : doc.map(blockText).join("");
  return [...text.replace(/\n/g, "")].length;
}

const same = (a: Run, b: Run) => Boolean(a.b) === Boolean(b.b) && Boolean(a.i) === Boolean(b.i) && Boolean(a.u) === Boolean(b.u);

/** Merges neighbouring runs with the same marks and drops empty ones; marks are 1 or absent. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.x) continue;
    const clean: Run = { x: r.x, ...(r.b ? { b: 1 } : {}), ...(r.i ? { i: 1 } : {}), ...(r.u ? { u: 1 } : {}) };
    const last = out.at(-1);
    if (last && same(last, clean)) last.x += clean.x;
    else out.push(clean);
  }
  return out;
}

// control characters other than tab and line break never belong in a text
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Cleans a document: known block types, merged runs, no control characters, no trailing empty blocks. */
export function normalizeDoc(doc: TextDoc): TextDoc {
  const out = doc.map((b) => ({ t: b.t === "h" ? ("h" as const) : ("p" as const), r: normalizeRuns(b.r.map((r) => ({ ...r, x: r.x.replace(/\r\n?/g, "\n").replace(CONTROL, "") }))) }));
  while (out.length && !blockText(out[out.length - 1]).trim()) out.pop();
  return out;
}

export const docKey = (doc: TextDoc) => JSON.stringify(normalizeDoc(doc));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML for the editor (contentEditable). Text is escaped; only p, h2, b, i, u and br are produced. */
export function docToHtml(doc: TextDoc): string {
  if (!doc.length) return "<p><br></p>";
  return doc
    .map((b) => {
      const tag = b.t === "h" ? "h2" : "p";
      const inner = b.r
        .map((r) => {
          let s = esc(r.x).replace(/\n/g, "<br>");
          if (r.u) s = `<u>${s}</u>`;
          if (r.i) s = `<i>${s}</i>`;
          if (r.b) s = `<b>${s}</b>`;
          return s;
        })
        .join("");
      // a trailing <br> is invisible in contentEditable: an extra one keeps an empty last line
      return `<${tag}>${inner && !inner.endsWith("<br>") ? inner : `${inner}<br>`}</${tag}>`;
    })
    .join("");
}

/** A plain-text document, one paragraph per line (used for tests and when nothing was written yet). */
export function docFromText(text: string): TextDoc {
  return normalizeDoc(text.split(/\n/).map((line) => ({ t: "p" as const, r: [{ x: line }] })));
}

/**
 * Checks a document sent by a browser: only known fields, sensible sizes. Returns the cleaned
 * document or a reason why it was refused.
 */
export function validateDoc(v: unknown): { doc: TextDoc } | { error: string } {
  if (!Array.isArray(v)) return { error: "Kein Text." };
  if (v.length > MAX_BLOCKS) return { error: "Der Text hat zu viele Absätze." };
  const doc: TextDoc = [];
  let chars = 0;
  for (const b of v) {
    if (!b || typeof b !== "object" || (b.t !== "p" && b.t !== "h") || !Array.isArray(b.r) || b.r.length > 2_000) return { error: "Ungültiger Absatz." };
    const runs: Run[] = [];
    for (const r of b.r) {
      if (!r || typeof r !== "object" || typeof r.x !== "string") return { error: "Ungültiger Text." };
      for (const k of Object.keys(r)) if (!["x", "b", "i", "u"].includes(k)) return { error: "Ungültige Formatierung." };
      chars += r.x.length;
      runs.push({ x: r.x, ...(r.b ? { b: 1 } : {}), ...(r.i ? { i: 1 } : {}), ...(r.u ? { u: 1 } : {}) });
    }
    doc.push({ t: b.t, r: runs });
  }
  if (chars > MAX_CHARS) return { error: "Der Text ist zu lang." };
  return { doc: normalizeDoc(doc) };
}

/** Parses stored JSON; anything unreadable becomes an empty document. */
export function parseDoc(raw: string | null | undefined): TextDoc {
  try {
    const v = validateDoc(JSON.parse(raw ?? "[]"));
    return "doc" in v ? v.doc : [];
  } catch {
    return [];
  }
}
