/** Alle Fragen des Mathe-Quiz (lib/lernspiele-quiz.ts), nach Schulstufen in eigenen Dateien. */
import type { QuizBank } from "../lernspiele-quiz";
import { MATHE_OBERSTUFE_ALGEBRA } from "./mathe-oberstufe-algebra";
import { MATHE_OBERSTUFE_GEOMETRIE } from "./mathe-oberstufe-geometrie";
import { MATHE_OBERSTUFE_ANALYSIS } from "./mathe-oberstufe-analysis";
import { MATHE_OBERSTUFE_STOCHASTIK } from "./mathe-oberstufe-stochastik";
import { MATHE_UNTERSTUFE_GEOMETRIE } from "./mathe-unterstufe-geometrie";
import { MATHE_UNTERSTUFE_ZAHLEN } from "./mathe-unterstufe-zahlen";
import { MATHE_VS } from "./mathe-vs";

export const QUIZ_MATHE: QuizBank = { ...MATHE_VS, ...MATHE_UNTERSTUFE_ZAHLEN, ...MATHE_UNTERSTUFE_GEOMETRIE, ...MATHE_OBERSTUFE_ALGEBRA, ...MATHE_OBERSTUFE_GEOMETRIE, ...MATHE_OBERSTUFE_ANALYSIS, ...MATHE_OBERSTUFE_STOCHASTIK };
