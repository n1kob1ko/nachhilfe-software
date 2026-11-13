import { FrischStand } from "@/components/Navigation";

/**
 * Kennzeichnet eine Seite zum Lesen: sie darf sofort aus dem Vorrat erscheinen (vorgeladen über `useVorladen`, Zurück-Taste)
 * und holt sich danach selbst den frischen Stand (components/Navigation.tsx, Punkt 3). Einmal irgendwo in die Seite setzen.
 * Nicht auf Seiten mit Eingaben, die ihren Anfangswert vom Server bekommen.
 */
export function Frisch() {
  return <FrischStand t={Date.now()} />;
}
