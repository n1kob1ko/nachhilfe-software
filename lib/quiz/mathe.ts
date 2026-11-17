/** Alle Fragen des Mathe-Quiz (lib/lernspiele-quiz.ts), nach Schulstufen in eigenen Dateien. */
import type { QuizBank } from "../lernspiele-quiz";
import { MATHE_UNTERSTUFE_GEOMETRIE } from "./mathe-unterstufe-geometrie";
import { MATHE_UNTERSTUFE_ZAHLEN } from "./mathe-unterstufe-zahlen";
import { MATHE_VS } from "./mathe-vs";

export const QUIZ_MATHE: QuizBank = { ...MATHE_VS, ...MATHE_UNTERSTUFE_ZAHLEN, ...MATHE_UNTERSTUFE_GEOMETRIE };
