/**
 * Das Maskottchen in Blockwerk (niko 2026-11-18, Bilder mit Higgsfield gemacht, public/spiele/blockwerk/): ein blauer
 * Block mit Blitz-Abzeichen unter dem Brett. Er zeigt, wie es gerade läuft: ruhig, freut sich über Punkte, staunt bei
 * großen Momenten, hält beim Blitz den Blitz hoch, schwitzt, wenn das Brett voll wird oder Schutt fällt (falsche Antwort),
 * und ist traurig, wenn das Spiel aus ist.
 */

export const STIMMUNGEN = ["ruhig", "jubel", "staunt", "blitz", "nervoes", "traurig"] as const;
export type Stimmung = (typeof STIMMUNGEN)[number];

/** Ab so viel belegten Feldern (Anteil am Brett) wird das Maskottchen nervös. */
export const NERVOES_AB = 0.6;

/** Die große Ansage auf dem Brett, wie in components/lernen/BlockFeld.tsx */
export type AnsageArt = "punkte" | "kombo" | "blitz" | "frei" | "lob" | "fieber" | "schutt";

export function stimmung(o: {
  lage: "spiel" | "eng" | "frage" | "aus";
  /** die jüngste Ansage, solange sie zu sehen ist */
  ansage?: AnsageArt;
  /** der Blitz zielt gerade aufs Brett */
  zielen: boolean;
  /** Fieber läuft (Punkte mal zwei oder drei) */
  fieber: boolean;
  /** belegte Felder durch alle Felder (0 bis 1) */
  fuellung: number;
}): Stimmung {
  if (o.lage === "aus") return "traurig";
  if (o.ansage === "blitz" || o.zielen) return "blitz";
  if (o.ansage === "frei" || o.ansage === "fieber" || o.ansage === "lob") return "staunt";
  if (o.ansage === "punkte" || o.ansage === "kombo") return "jubel";
  // falsche Antwort: Schutt fällt aufs Brett
  if (o.ansage === "schutt" || o.lage === "eng" || o.fuellung >= NERVOES_AB) return "nervoes";
  if (o.fieber) return "jubel";
  return "ruhig";
}
