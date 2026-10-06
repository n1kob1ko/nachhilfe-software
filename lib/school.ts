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

/**
 * The branches tutors pick from when browsing skills: like SCHOOL_TYPES, but the Gymnasium is split
 * into Unterstufe and Oberstufe, because its eight classes are two different stages for a tutor.
 */
export type SchoolBranch = { key: string; label: string; short: string; schoolType: string; classes: number[]; roman?: boolean };
export const SCHOOL_BRANCHES: SchoolBranch[] = [
  { key: "volksschule", label: "Volksschule", short: "VS", schoolType: "Volksschule", classes: [1, 2, 3, 4] },
  { key: "mittelschule", label: "Mittelschule", short: "MS", schoolType: "Mittelschule", classes: [1, 2, 3, 4] },
  { key: "ahs-unterstufe", label: "AHS Unterstufe", short: "AHS", schoolType: "Gymnasium", classes: [1, 2, 3, 4] },
  { key: "ahs-oberstufe", label: "AHS Oberstufe", short: "AHS", schoolType: "Gymnasium", classes: [5, 6, 7, 8] },
  { key: "htl", label: "HTL", short: "HTL", schoolType: "HTL", classes: [1, 2, 3, 4, 5], roman: true },
  { key: "hak", label: "HAK", short: "HAK", schoolType: "HAK", classes: [1, 2, 3, 4, 5], roman: true },
];
export const schoolBranch = (key: string) => SCHOOL_BRANCHES.find((b) => b.key === key) ?? null;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
/** "3. Klasse" in a school, "III. Jahrgang" in HTL and HAK. */
export const klasseLabel = (b: SchoolBranch, klasse: number) => (b.roman ? `${ROMAN[klasse - 1]}. Jahrgang` : `${klasse}. Klasse`);
/** "1.–4. Klasse", "I.–V. Jahrgang". */
export const klassenRange = (b: SchoolBranch) => {
  const [a, z] = [b.classes[0], b.classes[b.classes.length - 1]];
  return a === z ? klasseLabel(b, a) : `${klasseLabel(b, a).split(" ")[0]}–${klasseLabel(b, z)}`;
};

export const MAX_STUFE = Math.max(...SCHOOL_TYPES.map((t) => t.offset + t.classes));

/**
 * Rows saved before school types and classes existed only had a Schulstufe and a free text.
 * Mapped only when the text names exactly one school type; anything else stays open ("unklar")
 * instead of being guessed.
 */
export function migrateLegacy(type: string, grade: number): { type: string; klasse: number } | null {
  const named = SCHOOL_TYPES.filter((t) => new RegExp(LEGACY_NAMES[t.name], "i").test(type));
  if (named.length !== 1) return null;
  const t = named[0];
  const klasse = Math.round(grade || 0) - t.offset;
  return klasse >= 1 && klasse <= t.classes ? { type: t.name, klasse } : null;
}
const LEGACY_NAMES: Record<string, string> = {
  Volksschule: "volksschule|\\bVS\\b",
  Mittelschule: "mittelschule|\\bNMS\\b|\\bMS\\b",
  Gymnasium: "gymnas|\\bAHS",
  HTL: "\\bHTL\\b",
  HAK: "\\bHAK\\b",
};

export type LevelCheck = { status: "eindeutig" | "unklar"; schulstufe: number | null; reason?: string };

/**
 * Is a student's level clear enough to pick curriculum content for it? School type and class
 * must be known and in range; the stored Schulstufe (students.grade) must agree with them.
 */
export function checkLevel(type: string, klasse: number | null | undefined, grade?: number | null): LevelCheck {
  const t = schoolType(type);
  if (!t) return { status: "unklar", schulstufe: null, reason: type ? `Schulart „${type}“ unbekannt` : "Schulart fehlt" };
  if (!klasse || klasse < 1 || klasse > t.classes) return { status: "unklar", schulstufe: null, reason: `Klasse fehlt oder passt nicht zu ${t.name}` };
  const stufe = t.offset + klasse;
  if (grade != null && grade !== stufe) return { status: "unklar", schulstufe: null, reason: `gespeicherte Schulstufe ${grade} passt nicht zu ${klasse}. Klasse ${t.name}` };
  return { status: "eindeutig", schulstufe: stufe };
}

/** Unterstufe (Schulstufe 5–8) or Oberstufe (9–13); Volksschule is Primarstufe. */
export function stufenbereich(schulstufe: number): "Primarstufe" | "Sekundarstufe I" | "Sekundarstufe II" {
  return schulstufe <= 4 ? "Primarstufe" : schulstufe <= 8 ? "Sekundarstufe I" : "Sekundarstufe II";
}
