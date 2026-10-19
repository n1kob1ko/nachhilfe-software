import { fachVorschlaege } from "@/lib/school";

/**
 * Das Fach einer Einheit oder Hausübung: frei eintippbar, mit Vorschlägen (die Fächer des Schülers
 * zuerst, dann die übrigen Schulfächer). Eine einmalige Einheit in Biologie ändert die Fächer im
 * Profil nicht.
 */
export function FachFeld({ id, eigene, wert, className = "input", ariaLabel }: { id: string; eigene: string[]; wert?: string; className?: string; ariaLabel?: string }) {
  const liste = `faecher-${id}`;
  return (
    <>
      <input className={className} name="subject" list={liste} maxLength={60} required autoComplete="off" defaultValue={wert} aria-label={ariaLabel} placeholder="z. B. Biologie" />
      <datalist id={liste}>
        {fachVorschlaege(eigene).map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </>
  );
}
