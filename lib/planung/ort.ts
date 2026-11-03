/**
 * Der **Ort** eines Termins, wie ihn Lehrer und Schüler sehen: das Gebäude des Raums (z. B. „Kagraner Platz“),
 * online „Online“. niko, 2026-11-03: „Raum und Ort trennen und einfach nur Ort anzeigen, da Raum nur wichtig
 * ist für die Planung vom Stundenplan.“ Den Raumnamen zeigen nur noch Planung und Filter (Raum wählen,
 * Belegung prüfen). Rein, ohne Datenbank: auch im Browser nutzbar.
 */
export const ORT_OFFEN = "Ort noch offen";

export function ortName(raum: string | null | undefined, gebaeude: string | null | undefined, online: boolean): string {
  if (!raum) return online ? "Online" : ORT_OFFEN;
  if (online) return "Online";
  return gebaeude?.trim() || raum;
}
