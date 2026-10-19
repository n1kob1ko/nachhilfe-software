import type { CurriculumSkill } from "../curriculum";
import { bereichSuchwoerterAus, erklaerungenAus, faehigkeitenAus, fehlerAus, suchwoerterAus, type Modul } from "./bauen";
import { DEUTSCH_OBERSTUFE } from "./deutsch-oberstufe";
import { DEUTSCH_UNTERSTUFE } from "./deutsch-unterstufe";
import { ENGLISCH_OBERSTUFE } from "./englisch-oberstufe";
import { ENGLISCH_UNTERSTUFE } from "./englisch-unterstufe";
import { MATHE_OBERSTUFE } from "./mathe-oberstufe";
import { MATHE_UNTERSTUFE } from "./mathe-unterstufe";
import { MATHE_VS } from "./mathe-vs";

/**
 * All topic modules (lib/themen/*.ts): skills with explanation and typical errors for Mathematik,
 * Deutsch and Englisch. New modules go at the end, because the seed numbers the skills in this order
 * once (skills.sort).
 *
 * Used by: the skill list (lib/curriculum.ts), the sample answer of „Erkläre …“ tasks (EXPLAIN in
 * lib/generators.ts), the KI exercise prompt (lib/ai/features.ts), the skill page and matching the
 * Stoff of a Schularbeit to skills (SUCHWOERTER in lib/lehrplan.ts).
 */
export const MODULE: Modul[] = [MATHE_UNTERSTUFE, MATHE_VS, MATHE_OBERSTUFE, DEUTSCH_UNTERSTUFE, DEUTSCH_OBERSTUFE, ENGLISCH_UNTERSTUFE, ENGLISCH_OBERSTUFE];

export const THEMEN: CurriculumSkill[] = MODULE.flatMap(faehigkeitenAus);
export const ERKLAERUNG: Record<string, string> = Object.assign({}, ...MODULE.map(erklaerungenAus));
export const TYPISCHE_FEHLER: Record<string, string[]> = Object.assign({}, ...MODULE.map(fehlerAus));
export const VORAUSSETZUNGEN: [string, string][] = MODULE.flatMap((m) => m.voraussetzungen ?? []);
/** Other words for a skill as they stand on a Stoffzettel; matchSkills (lib/lehrplan.ts) compares them like the name. */
export const SUCHWOERTER: Record<string, string[]> = Object.assign({}, ...MODULE.map(suchwoerterAus));
/** Other names of a whole Thema, keyed „Fach|Thema“ („Deutsch|Beistrichsetzung“: Kommasetzung). */
export const BEREICH_SUCHWOERTER: Record<string, string[]> = Object.assign({}, ...MODULE.map(bereichSuchwoerterAus));

/** Typical errors of a skill; a Teilfähigkeit without its own gets those of its skill. */
export function typischeFehler(skillId: string): string[] {
  for (let id = skillId; id.split(".").length >= 3; id = id.slice(0, id.lastIndexOf("."))) {
    if (TYPISCHE_FEHLER[id]) return TYPISCHE_FEHLER[id];
  }
  return [];
}
