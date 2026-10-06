/**
 * Stable, readable codes for skills and curriculum passages, e.g.
 *   AT-MAT-05-BRUCHRECHNUNG-DIVIDIEREN   (a skill: subject, first Schulstufe, Thema, Fähigkeit)
 *   AT-MS-MAT-06-…                        (a passage of the Mittelschule curriculum, 2. Klasse = Schulstufe 6)
 * A code is computed once and stored; renaming a skill later does not change it.
 * Skills carry no school type in their code: they are shared across school types and compared
 * by Schulstufe. The school type belongs to the curriculum passage they are linked to.
 */
const SUBJECT_CODES: Record<string, string> = { Mathematik: "MAT", Deutsch: "DEU", Englisch: "ENG" };
const SCHOOL_CODES: Record<string, string> = { Volksschule: "VS", Mittelschule: "MS", Gymnasium: "AHS", HTL: "HTL", HAK: "HAK" };

export const subjectCode = (subject: string) => SUBJECT_CODES[subject] ?? slug(subject).slice(0, 3);
export const schoolCode = (type: string) => SCHOOL_CODES[type] ?? slug(type).slice(0, 4);

export function slug(text: string): string {
  return text
    .toUpperCase()
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS")
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function skillCode(s: { subject: string; area: string; name: string; grade_min: number; parentName?: string | null }): string {
  const stufe = String(Math.max(1, s.grade_min)).padStart(2, "0");
  const parts = [s.area, s.parentName, s.name].filter(Boolean).map((p) => slug(p!));
  return ["AT", subjectCode(s.subject), stufe, ...parts].join("-");
}
