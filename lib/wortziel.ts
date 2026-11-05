/**
 * Das Wortziel aus der Aufgabenstellung einer Textarbeit, wenn es kein eigenes Feld dafür gibt: „ca. 120 Wörter“,
 * „(mindestens 200 Wörter)“, „250–300 Wörter“ (die Mitte), „about 150 words“. Das Tablet zeigt dann „77 Wörter
 * (Ziel: ca. 120)“ statt nur der Zahl. Keine Zahl vor „Wörter“/„words“ → null.
 */
export function wortzielAusAufgabe(aufgabe: string | null | undefined): number | null {
  if (!aufgabe) return null;
  const m = aufgabe.match(/(\d{2,4})(?:\s*(?:[–-]|bis|to)\s*(\d{2,4}))?\s*(?:Wörter|Worte|words)\b/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : null;
  const ziel = b && b > a ? Math.round((a + b) / 2 / 10) * 10 : a;
  return ziel >= 20 && ziel <= 3000 ? ziel : null;
}
