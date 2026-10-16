import "./blaetter.css";

/**
 * "Blätter erstellen" bringt sein Blatt-CSS mit — dieselbe Aufteilung wie bei
 * `app/arbeitsblatt` (dort `layout.tsx` + `arbeitsblatt.css`): Die Regeln für
 * Papier und Ausdruck stehen neben der Route, die sie braucht, und nicht in
 * `globals.css`, wo sie jede Seite tragen würde.
 */
export default function BlaetterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
