/**
 * **Beispielnamen** für Aufgaben und Folien der KI (Test mit echter KI, 27.11.2026: die KI nahm gern „Lena“, auch bei der
 * Schülerin Lena; am Blatt stand dann „Lena rechnet … Das ist falsch.“). Die App gibt der KI ein paar Vornamen vor, und keiner
 * davon gehört einem Schüler oder einer Lehrkraft der App. So verlässt kein echter Name die App (die Liste nennt nur erfundene),
 * und kein Kind liest seinen eigenen Namen in einer Fehler-Aufgabe. Ohne Datenbank; die bekannten Namen kommen vom Aufrufer.
 */
const VORRAT = ["Jonas", "Mia", "Emil", "Sara", "Felix", "Nora", "Timo", "Ida", "Moritz", "Clara", "Samuel", "Hanna", "Leon", "Zoe", "Fabian", "Marlene", "Oskar", "Greta", "Valentin", "Livia", "Anton", "Rosalie", "Jakob", "Paula"];

/** `n` Vornamen aus dem Vorrat, die in keinem bekannten Namen vorkommen (Vor- oder Nachname); `lauf` wählt, welche. */
export function beispielNamen(bekannt: string[], lauf = 0, n = 4): string[] {
  const echt = new Set(bekannt.flatMap((x) => x.toLowerCase().split(/[\s-]+/)).filter(Boolean));
  const frei = VORRAT.filter((v) => !echt.has(v.toLowerCase()));
  if (!frei.length) return [];
  // jeder fünfte ab `lauf`: nebeneinander stehen im Vorrat Bub und Mädchen, so bleibt die Auswahl gemischt
  const start = Math.abs(Math.trunc(lauf)) % frei.length;
  const out: string[] = [];
  for (let i = 0; out.length < Math.min(n, frei.length) && i < frei.length * 5; i++) {
    const v = frei[(start + i * 5) % frei.length];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Die Zeile in der Anfrage; leer ohne Namen. */
export function beispielNamenZeile(namen: string[]): string {
  return namen.length ? `Braucht ein Beispiel oder eine Aufgabe einen Vornamen, nimm nur einen von diesen: ${namen.join(", ")}. Andere Vornamen kommen nicht vor.` : "";
}
