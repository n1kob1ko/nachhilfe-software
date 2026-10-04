/**
 * Austrian school system. Tutors think in "2. Klasse Mittelschule", the curriculum
 * internally uses the continuous Schulstufe (1–13) so skills can span school types.
 */
export type SchoolType = { name: string; short: string; classes: number; offset: number };

export const SCHOOL_TYPES: SchoolType[] = [
  { name: "Volksschule", short: "VS", classes: 4, offset: 0 },
  { name: "Mittelschule", short: "MS", classes: 4, offset: 4 },
  { name: "Gymnasium", short: "AHS", classes: 8, offset: 4 },
  { name: "HTL", short: "HTL", classes: 5, offset: 8 },
  { name: "HAK", short: "HAK", classes: 5, offset: 8 },
];

export function schoolType(name: string): SchoolType | null {
  return SCHOOL_TYPES.find((t) => t.name === name) ?? null;
}

/** Internal Schulstufe for a class of a school type (falls back to the class number). */
export function schulstufe(type: string, klasse: number): number {
  const t = schoolType(type);
  const k = Math.max(1, Math.min(t?.classes ?? 13, Math.round(klasse) || 1));
  return (t?.offset ?? 0) + k;
}

/** "2. Klasse Mittelschule", "6. Klasse Gymnasium (Oberstufe)". */
export function klassenLabel(type: string, klasse: number | null | undefined, opts: { short?: boolean } = {}): string {
  const t = schoolType(type);
  if (!t || !klasse) return type ? `${type}${klasse ? `, ${klasse}. Klasse` : ""}` : klasse ? `${klasse}. Klasse` : "";
  if (opts.short) return `${klasse}. Kl. ${t.short}`;
  const stufe = t.name === "Gymnasium" ? (klasse <= 4 ? " (Unterstufe)" : " (Oberstufe)") : "";
  return `${klasse}. Klasse ${t.name}${stufe}`;
}

/** School types with identical class ranges (HTL and HAK) are shown together. */
function groups() {
  const out: { short: string; offset: number; classes: number }[] = [];
  for (const t of SCHOOL_TYPES) {
    const same = out.find((g) => g.offset === t.offset && g.classes === t.classes);
    if (same) same.short += `/${t.short}`;
    else out.push({ short: t.short, offset: t.offset, classes: t.classes });
  }
  return out;
}

/** Which classes of which school types a Schulstufe range covers, e.g. "MS 1–4 · AHS 1–5 · HTL/HAK 1". */
export function rangeLabel(min: number, max: number): string {
  const parts = groups().flatMap((t) => {
    const from = Math.max(1, min - t.offset);
    const to = Math.min(t.classes, max - t.offset);
    if (from > to) return [];
    return [`${t.short} ${from === to ? from : `${from}–${to}`}`];
  });
  return parts.join(" · ") || `Schulstufe ${min}–${max}`;
}

/** Option text for one Schulstufe, e.g. 9 → "5. Kl. AHS / 1. Kl. HTL/HAK". */
export function stufeLabel(stufe: number): string {
  const byClass = new Map<number, string[]>();
  for (const g of groups()) {
    const k = stufe - g.offset;
    if (k >= 1 && k <= g.classes) byClass.set(k, [...(byClass.get(k) ?? []), g.short]);
  }
  return [...byClass].map(([k, types]) => `${k}. Kl. ${types.join(", ")}`).join(" / ") || `${stufe}. Schulstufe`;
}

export const MAX_STUFE = Math.max(...SCHOOL_TYPES.map((t) => t.offset + t.classes));

/** Best guess for rows saved before school types and classes existed. */
export function migrateLegacy(type: string, grade: number): { type: string; klasse: number } {
  const g = Math.max(1, grade || 1);
  if (/volksschule/i.test(type)) return { type: "Volksschule", klasse: Math.min(4, g) };
  if (/mittelschule/i.test(type)) return { type: "Mittelschule", klasse: Math.min(4, Math.max(1, g - 4)) };
  if (/ahs|gymnas/i.test(type)) return { type: "Gymnasium", klasse: Math.min(8, Math.max(1, g - 4)) };
  if (/hak/i.test(type) && !/htl/i.test(type)) return { type: "HAK", klasse: Math.min(5, Math.max(1, g - 8)) };
  if (/bhs|htl/i.test(type)) return { type: "HTL", klasse: Math.min(5, Math.max(1, g - 8)) };
  if (g <= 4) return { type: "Volksschule", klasse: g };
  if (g <= 8) return { type: "Mittelschule", klasse: g - 4 };
  return { type: "Gymnasium", klasse: Math.min(8, g - 4) };
}
