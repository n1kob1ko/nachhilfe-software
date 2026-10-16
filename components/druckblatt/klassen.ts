/**
 * Klassennamen zusammensetzen.
 *
 * Winzling mit Absicht: Die Quelldatei hatte dafür ein `cn` in `shared/lib`. Für
 * die paar Stellen in diesem Ordner reicht diese Funktion, und sie bleibt ohne
 * zusätzliche Abhängigkeit.
 */
export const klassen = (...teile: readonly (string | false | null | undefined)[]): string =>
  teile.filter((teil): teil is string => typeof teil === "string" && teil !== "").join(" ");
