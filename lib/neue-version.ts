/**
 * Regeln für components/NeueVersion.tsx (ohne Browser, damit sie testbar sind).
 */
export type Bereich = "schueler" | "lehrer";

/**
 * Darf die Seite von selbst neu laden, nachdem eine neue Version da ist? Nur bei Schülern (Tablet, Schüler-App,
 * Laptop), nur wenn niemand schreibt und `leerlaufGrenzeMs` lang niemand getippt hat. Lehrer laden selbst oder
 * beim Zurückkommen zum Tab.
 */
export function sollSelbstNeuLaden(z: { bereich: Bereich; leerlaufMs: number; schreibt: boolean }, leerlaufGrenzeMs = 30_000): boolean {
  return z.bereich === "schueler" && !z.schreibt && z.leerlaufMs >= leerlaufGrenzeMs;
}

/** Ist dieser Fehler ein Klick auf eine Server Action, die der Server nach einem Update nicht mehr kennt? */
export function istVeralteteAktion(grund: unknown): boolean {
  const text = grund instanceof Error ? grund.message : typeof grund === "string" ? grund : "";
  return /failed-to-find-server-action|Server Action ".*" was not found on the server/i.test(text);
}
