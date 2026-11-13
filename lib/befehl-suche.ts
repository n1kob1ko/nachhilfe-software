/**
 * Die Suche im Befehlsmenü (components/Befehle.tsx): Treffer ohne Raten. Jedes getippte Wort muss vorkommen:
 * am Anfang des Namens zählt am meisten, dann am Anfang eines Worts, dann mitten im Namen (erst ab drei Buchstaben,
 * für zusammengesetzte Wörter wie „Schülergeräte“), zuletzt am Anfang eines Worts in der Beschreibung der Seite.
 * 0 heißt: kein Treffer. (Die unscharfe Suche von cmdk fand für „ann“ fast jede Seite.)
 */

/** „schuler“ findet „Schüler“, „strasse“ findet „Straße“. */
const schlicht = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");

const woerterVon = (s: string) => schlicht(s).split(/[^a-z0-9]+/).filter(Boolean);

export function befehlTreffer(wert: string, suche: string, beschreibung?: string[]): number {
  const w = schlicht(wert);
  const teile = woerterVon(wert);
  const neben = (beschreibung ?? []).flatMap(woerterVon);
  let punkte = 1;
  for (const t of woerterVon(suche)) {
    if (w.startsWith(t)) continue;
    if (teile.some((x) => x.startsWith(t))) punkte *= 0.9;
    else if (t.length >= 3 && w.includes(t)) punkte *= 0.7;
    else if (neben.some((x) => x.startsWith(t))) punkte *= 0.4;
    else return 0;
  }
  return punkte;
}
