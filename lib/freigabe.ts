/**
 * Freigabe in Stufen (Plan 2.3): was ein Schüler zu einer zugewiesenen Übung sehen darf, über die Aufgabe hinaus.
 * Der Lehrer stellt sie je zugewiesener Übung ein (Übung › Weitere Aktionen › Gesendet an; am Tablet „Lösung zeigen“).
 *
 * - nichts: keine Hilfen, keine Lösung vorab.
 * - hilfen: die Hilfen auf Tipp, eine nach der anderen. So war es vor den Stufen ohne „Lösungen zeigen“.
 * - loesung: dazu Lösung und Ergebnis jeder Aufgabe, auch vor dem Lösen (früher „Lösungen zeigen“).
 * - alles: dazu Lösungsschritte, andere Wege und die Erklärung (lib/loesungsdaten.ts).
 *
 * Nach dem letzten Versuch sieht der Schüler in jeder Stufe wie bisher, ob es stimmt, und die Lösung der Aufgabe.
 * Ein Minitest oder eine Probeschularbeit (mode 'test') bleibt ohne Hilfen und ohne Lösung, egal was eingestellt ist.
 *
 * Was nicht freigegeben ist, geht gar nicht erst an die Schülerseiten (lib/solver-tasks.ts clientTasks), es wird
 * nicht nur ausgeblendet. Eine ältere Zeile ohne Stufe gilt als „hilfen“ oder, mit solutions_visible, als „loesung“.
 */
export type Freigabe = "nichts" | "hilfen" | "loesung" | "alles";

export const FREIGABEN: readonly Freigabe[] = ["nichts", "hilfen", "loesung", "alles"];

export const FREIGABE_LABEL: Record<Freigabe, string> = {
  nichts: "Nichts",
  hilfen: "Nur Hilfen",
  loesung: "Hilfen und Lösung",
  alles: "Alles",
};

/** Ein Satz je Stufe für den Lehrer: was der Schüler damit sieht. */
export const FREIGABE_INFO: Record<Freigabe, string> = {
  nichts: "Keine Hilfen und keine Lösung vorab. Die Lösung sieht der Schüler erst nach seinem letzten Versuch.",
  hilfen: "Hilfen eine nach der anderen, die Lösung erst nach dem letzten Versuch. So war es bisher.",
  loesung: "Dazu die Lösung jeder Aufgabe, auch bevor er sie gelöst hat.",
  alles: "Dazu Lösungsschritte, andere Wege und deine Erklärung.",
};

export const isFreigabe = (x: unknown): x is Freigabe => typeof x === "string" && (FREIGABEN as readonly string[]).includes(x);

/** Die Stufe einer zugewiesenen Übung; ältere Zeilen ohne Stufe wie bisher über solutions_visible. */
export function freigabeVon(a: { freigabe?: string | null; solutions_visible?: number | boolean | null }): Freigabe {
  if (isFreigabe(a.freigabe)) return a.freigabe;
  return a.solutions_visible ? "loesung" : "hilfen";
}

const RANG: Record<Freigabe, number> = { nichts: 0, hilfen: 1, loesung: 2, alles: 3 };
export const zeigtHilfen = (f: Freigabe) => RANG[f] >= RANG.hilfen;
export const zeigtLoesung = (f: Freigabe) => RANG[f] >= RANG.loesung;
export const zeigtAlles = (f: Freigabe) => f === "alles";
/** Die höhere von zwei Stufen („Lösung zeigen“ am Tablet nimmt nichts zurück, was schon freigegeben ist). */
export const hoehere = (a: Freigabe, b: Freigabe): Freigabe => (RANG[a] >= RANG[b] ? a : b);
