/**
 * CSV for Excel with Austrian/German settings: semicolon separated, UTF-8 with BOM, CRLF.
 * Text that a spreadsheet would run as a formula (=, +, -, @ at the start) gets a leading
 * apostrophe, so an exported note can never execute anything when the file is opened.
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

/** "2026-10-04T13:03:00.000Z" → "2026-10-04 15:03" in server time; local stamps pass through. */
export function localTime(v: string | null | undefined): string {
  if (!v) return "";
  if (!/[zZ]$|[+-]\d\d:\d\d$/.test(v)) return v.replace("T", " ").slice(0, 16);
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
