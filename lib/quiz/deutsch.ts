/** Alle Fragen des Deutsch-Quiz (lib/lernspiele-quiz.ts), nach Schulstufen in eigenen Dateien. */
import type { QuizBank } from "../lernspiele-quiz";
import { DEUTSCH_OBERSTUFE_LITERATUR } from "./deutsch-oberstufe-literatur";
import { DEUTSCH_OBERSTUFE_SPRACHE } from "./deutsch-oberstufe-sprache";
import { DEUTSCH_UNTERSTUFE } from "./deutsch-unterstufe";

export const QUIZ_DEUTSCH: QuizBank = { ...DEUTSCH_UNTERSTUFE, ...DEUTSCH_OBERSTUFE_LITERATUR, ...DEUTSCH_OBERSTUFE_SPRACHE };
