"use client";

/**
 * Die Art einer Datei der Vorgabe („erklärt ein Thema“) als kleine Auswahl: ein Tippen ändert sie, ohne eigenen Knopf
 * (app/vorgabe-actions.ts `rolleAendernAction`). Die Texte kommen vom Server (lib/pruefungsstoff.ts `ROLLE_SATZ`). Ebenso „Passt zu
 * welchem Schritt?“ (`name` schritt, `leer` als wählbare leere Option).
 */
export function RolleWahl({
  action,
  rolle,
  optionen,
  label,
  name = "rolle",
  testid = "vorgabe-rolle",
  leer,
}: {
  action: (form: FormData) => Promise<void>;
  rolle: string;
  optionen: { wert: string; text: string }[];
  label: string;
  name?: string;
  testid?: string;
  /** eine leere Option, die man wählen kann („Zu keinem“); ohne: „Art wählen“, nur solange nichts gewählt ist */
  leer?: string;
}) {
  return (
    <form action={action} className="min-w-0">
      <select
        name={name}
        defaultValue={rolle}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input input-sm max-w-full"
        aria-label={label}
        data-testid={testid}
      >
        {leer !== undefined && <option value="">{leer}</option>}
        {leer === undefined && !rolle && (
          <option value="" disabled>
            Art wählen
          </option>
        )}
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </form>
  );
}
