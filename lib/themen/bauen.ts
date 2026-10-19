import type { CurriculumSkill } from "../curriculum";

/**
 * The shape of a topic module in lib/themen/: per Thema (area) the skills, each with a short
 * explanation and the typical errors students make. Own structure and own wording; the links to the
 * Lehrplan are in scripts/lehrplan_mapping.json.
 */
export type Teil = { id: string; name: string; erklaerung: string; suchwoerter?: string[] };
export type Thema = {
  id: string;
  name: string;
  /** first and last Schulstufe (1–13) */
  stufen: [number, number];
  /** only these school types (lib/school.ts names); none = every school type of these Schulstufen */
  schularten?: string[];
  erklaerung: string;
  fehler: string[];
  teile?: Teil[];
  /**
   * Other words for the same thing, as they stand on a Stoffzettel or in a book's table of contents
   * („Stellenwerttafel“, „dekadisches Zahlensystem“). Only for matching the Stoff (matchSkills), never shown.
   */
  suchwoerter?: string[];
};
export type Bereich = {
  area: string;
  /** other names of the whole Thema („Kommasetzung“ for Beistrichsetzung); only for matching the Stoff */
  suchwoerter?: string[];
  themen: Thema[];
};
export type Modul = {
  fach: "Mathematik" | "Deutsch" | "Englisch";
  bereiche: Bereich[];
  /** typical errors of skills that were there before (lib/curriculum.ts, the Volksschule package) */
  fehlerBisher?: Record<string, string[]>;
  /** explanations of skills that were there before and have none in EXPLAIN (lib/generators.ts) */
  erklaerungBisher?: Record<string, string>;
  /** Suchwörter of skills that were there before (lib/curriculum.ts) */
  suchwoerterBisher?: Record<string, string[]>;
  /** [skill, skill that should sit before it]: own didactic choices, like PREREQUISITES */
  voraussetzungen?: [string, string][];
};

/** The skills of a module, in its order; Teilfähigkeiten directly after their skill. */
export const faehigkeitenAus = (m: Modul): CurriculumSkill[] =>
  m.bereiche.flatMap(({ area, themen }) =>
    themen.flatMap((t) => {
      const skill: CurriculumSkill = { id: t.id, subject: m.fach, area, name: t.name, gradeMin: t.stufen[0], gradeMax: t.stufen[1], ...(t.schularten ? { schoolTypes: t.schularten } : {}) };
      return [skill, ...(t.teile ?? []).map((p) => ({ ...skill, id: `${t.id}.${p.id}`, name: p.name, parentId: t.id }))];
    }),
  );

/** Short explanation with an example, per skill (also the sample answer of „Erkläre …“ tasks). */
export const erklaerungenAus = (m: Modul): Record<string, string> => ({
  ...m.erklaerungBisher,
  ...Object.fromEntries(m.bereiche.flatMap(({ themen }) => themen.flatMap((t) => [[t.id, t.erklaerung], ...(t.teile ?? []).map((p) => [`${t.id}.${p.id}`, p.erklaerung])]))),
});

/** Typical errors per skill, each with a short example. */
export const fehlerAus = (m: Modul): Record<string, string[]> => ({
  ...m.fehlerBisher,
  ...Object.fromEntries(m.bereiche.flatMap(({ themen }) => themen.map((t) => [t.id, t.fehler]))),
});

/** Suchwörter per skill (only for matching the Stoff to skills). */
export const suchwoerterAus = (m: Modul): Record<string, string[]> => ({
  ...m.suchwoerterBisher,
  ...Object.fromEntries(
    m.bereiche.flatMap(({ themen }) =>
      themen.flatMap((t) => [...(t.suchwoerter ? [[t.id, t.suchwoerter]] : []), ...(t.teile ?? []).filter((p) => p.suchwoerter).map((p) => [`${t.id}.${p.id}`, p.suchwoerter!])]),
    ),
  ),
});

/** Suchwörter per Thema, keyed „Fach|Thema“, since lib/curriculum.ts uses the same Thema names. */
export const bereichSuchwoerterAus = (m: Modul): Record<string, string[]> =>
  Object.fromEntries(m.bereiche.filter((b) => b.suchwoerter).map((b) => [`${m.fach}|${b.area}`, b.suchwoerter!]));
