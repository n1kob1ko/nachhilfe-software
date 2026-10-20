/**
 * Vornamen für Knöpfe, wenn ein Lehrer zwei Schüler gleichzeitig hat (D26): „An Anna senden“,
 * „Whiteboard von Ben“, „Wer arbeitet an diesem Gerät?“. Heißen beide gleich, steht der ganze Name da.
 * Ohne Datenbank, damit auch Client-Komponenten es nutzen können.
 */
export function shortNames(names: string[]): string[] {
  const first = names.map((n) => n.split(" ")[0]);
  return first.map((f, i) => (first.filter((x) => x === f).length > 1 ? names[i] : f));
}
