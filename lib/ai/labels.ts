/** Words for the KI suggestions; no server imports, the live status in the browser uses them too. */
export type Action = "weiter" | "hilfe_geben" | "erklaeren" | "leichter" | "schwerer" | "neue_aufgabe" | "grundlage_wiederholen" | "pause";
export const ACTIONS: Action[] = ["weiter", "hilfe_geben", "erklaeren", "leichter", "schwerer", "neue_aufgabe", "grundlage_wiederholen", "pause"];
export const ACTION_LABEL: Record<Action, string> = {
  weiter: "Weiterarbeiten lassen",
  hilfe_geben: "Hilfe geben",
  erklaeren: "Kurz erklären",
  leichter: "Leichter weitermachen",
  schwerer: "Schwerer weitermachen",
  neue_aufgabe: "Neue Aufgabe",
  grundlage_wiederholen: "Grundlage wiederholen",
  pause: "Kurze Pause",
};
