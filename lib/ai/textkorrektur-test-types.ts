/** What the Textkorrektur-Test reports (lib/ai/textkorrektur-test.ts), without server code, for the page. */

export const WAYS = [
  { key: "einfach", label: "Normal (ein Schritt)" },
  { key: "schritt1", label: "Gründlich bisher, nur Schritt 1" },
  { key: "gruendlich", label: "Gründlich bisher" },
  { key: "schritt1_neu", label: "Gründlich neu, Schritt 1, nur Liste" },
  { key: "fassung_neu", label: "Gründlich neu, Schritt 1 mit Fassungsvergleich" },
  { key: "gruendlich_neu", label: "Gründlich neu" },
] as const;
export type WayKey = (typeof WAYS)[number]["key"];

export type Score = {
  /** built-in errors (optional ones not counted) */
  errors: number;
  found: number;
  /** found, and the text after the suggestion is one of the accepted corrections */
  fixed: number;
  /** found, but the text after the suggestion is not an accepted correction (check by hand) */
  wrongFix: number;
  missed: number;
  /** correct places that a suggestion changes */
  traps: number;
  /** suggestions at no error, correct place or open place (check by hand: missing in the key, or wrong) */
  extraFehler: number;
  extraStil: number;
  /** suggestions without a place (notes) */
  unplaced: number;
  /** marked for the teacher: among the correct fixes (extra work) and among the doubtful suggestions (protection) */
  flaggedFixed: number;
  flaggedDoubtful: number;
  /** doubtful suggestions shown without a mark: the dangerous ones */
  unflaggedDoubtful: number;
  /** sorted out by the second check: correct fixes lost, doubtful ones removed */
  sortedOutFixed: number;
  sortedOutDoubtful: number;
};

export type WayResult = { way: WayKey; score: Score; usd: number; ms: number; calls: number; reasoning: number; output: number };
export type CaseRun = { nr: string; title: string; level: string; status: "fertig" | "fehler" | "übersprungen"; summary: string; ways: WayResult[]; lines: string[] };
export type TextTestState = { running: boolean; startedAt: number; finishedAt: number | null; total: number; capUsd: number; results: CaseRun[]; active: string[]; totals: Record<WayKey, WayResult> | null };
