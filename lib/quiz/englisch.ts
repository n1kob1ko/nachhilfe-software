/** Alle Fragen des Englisch-Quiz (lib/lernspiele-quiz.ts), nach Schulstufen in eigenen Dateien. */
import type { QuizBank } from "../lernspiele-quiz";
import { ENGLISCH_OBERSTUFE_SCHREIBEN } from "./englisch-oberstufe-schreiben";
import { ENGLISCH_OBERSTUFE_SPRACHE } from "./englisch-oberstufe-sprache";
import { ENGLISCH_UNTERSTUFE } from "./englisch-unterstufe";

export const QUIZ_ENGLISCH: QuizBank = { ...ENGLISCH_UNTERSTUFE, ...ENGLISCH_OBERSTUFE_SPRACHE, ...ENGLISCH_OBERSTUFE_SCHREIBEN };
