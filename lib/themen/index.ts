import type { CurriculumSkill } from "../curriculum";
import { erklaerungenAus, faehigkeitenAus, fehlerAus, type Modul } from "./bauen";
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
 * lib/generators.ts), the KI exercise prompt (lib/ai/features.ts) and the skill page.
 */
export const MODULE: Modul[] = [MATHE_UNTERSTUFE, MATHE_VS, MATHE_OBERSTUFE, DEUTSCH_UNTERSTUFE, DEUTSCH_OBERSTUFE, ENGLISCH_UNTERSTUFE, ENGLISCH_OBERSTUFE];

export const THEMEN: CurriculumSkill[] = MODULE.flatMap(faehigkeitenAus);
export const ERKLAERUNG: Record<string, string> = Object.assign({}, ...MODULE.map(erklaerungenAus));
export const TYPISCHE_FEHLER: Record<string, string[]> = Object.assign({}, ...MODULE.map(fehlerAus));
export const VORAUSSETZUNGEN: [string, string][] = MODULE.flatMap((m) => m.voraussetzungen ?? []);

/** Typical errors of a skill; a Teilfähigkeit without its own gets those of its skill. */
export function typischeFehler(skillId: string): string[] {
  for (let id = skillId; id.split(".").length >= 3; id = id.slice(0, id.lastIndexOf("."))) {
    if (TYPISCHE_FEHLER[id]) return TYPISCHE_FEHLER[id];
  }
  return [];
}
