/**
 * CSV for Excel with Austrian/German settings: semicolon separated, UTF-8 with BOM, CRLF.
 * Text that a spreadsheet would run as a formula (=, +, -, @ at the start) gets a leading
 * apostrophe, so an exported note can never execute anything when the file is opened.
 *
 * `parseCsv` reads exactly that format back (Phase 7: the CSV import of students and teachers).
 */
export type Cell = string | number | boolean | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

/**
 * The separator of a file, read from its first line (outside quotes): a comma when the line has
 * more commas than semicolons — what Google Sheets writes („Datei › Herunterladen › CSV“) —
 * otherwise the semicolon of `toCsv`, Excel and Numbers with German settings.
 */
export function separatorOf(text: string): ";" | "," {
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;
  for (const c of text) {
    if (c === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (c === "\n" || c === "\r") break;
    else if (c === ";") semicolons++;
    else if (c === ",") commas++;
  }
  return commas > semicolons ? "," : ";";
}

/**
 * Reads the format `toCsv` writes — and what Excel and Numbers produce with German settings:
 * semicolon separated, fields in `"…"` with `""` for an embedded quote, `;` and line breaks
 * allowed inside quotes, CRLF or LF line endings, UTF-8 with or without BOM. A trailing line
 * break makes no empty row; every cell comes back as a string, never as a number. A file whose
 * first line is comma separated (Google Sheets) is read with the comma (`separatorOf`).
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const sep = separatorOf(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let zelle = "";
  let inAnfuehrung = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inAnfuehrung) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          zelle += '"';
          i++;
        } else inAnfuehrung = false;
      } else zelle += c;
      continue;
    }
    // a quote only opens a field at its very start; inside a field it stays a normal character
    if (c === '"' && zelle === "") inAnfuehrung = true;
    else if (c === sep) {
      row.push(zelle);
      zelle = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(zelle);
      rows.push(row);
      row = [];
      zelle = "";
    } else zelle += c;
  }
  // the last line break does not make a row of its own
  if (zelle !== "" || row.length) rows.push([...row, zelle]);
  return rows;
}

/**
 * The counterpart of the leading apostrophe `toCsv` writes before `=`, `+`, `-` and `@`: it is
 * removed again on reading, so a cell stays the **text** it was. A cell is never turned into a
 * number or a formula, on the way in or on the way out (Phase 7).
 */
export function unprotectCell(v: string): string {
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}

/** "2026-10-04T13:03:00.000Z" → "2026-10-04 15:03" in server time; local stamps pass through. */
export function localTime(v: string | null | undefined): string {
  if (!v) return "";
  if (!/[zZ]$|[+-]\d\d:\d\d$/.test(v)) return v.replace("T", " ").slice(0, 16);
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
