/**
 * Alle eigenen Tests der App (lib/eigene-tests.ts). Nur am Server: die Dateien enthalten die Lösungen. Ein neuer Test ist
 * eine Datei in lib/eigene-tests/ und eine Zeile hier.
 */
import type { EigenerTest } from "./eigene-tests";
import { CHEMIE_PROBETEST_5 } from "./eigene-tests/chemie-probetest-5";
import { EUROPE_GEOGRAPHY } from "./eigene-tests/europe-geography";

export const EIGENE_TESTS: EigenerTest[] = [EUROPE_GEOGRAPHY, CHEMIE_PROBETEST_5];

export const eigenerTest = (key: string): EigenerTest | null => EIGENE_TESTS.find((t) => t.key === key) ?? null;
