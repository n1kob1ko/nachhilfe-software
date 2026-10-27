"use client";

/**
 * Die Art einer Datei der Vorgabe („erklärt ein Thema“) als kleine Auswahl: ein Tippen ändert sie, ohne eigenen Knopf
 * (app/vorgabe-actions.ts `rolleAendernAction`). Die Texte kommen vom Server (lib/pruefungsstoff.ts `ROLLE_SATZ`).
 */
export function RolleWahl({ action, rolle, optionen, label }: { action: (form: FormData) => Promise<void>; rolle: string; optionen: { wert: string; text: string }[]; label: string }) {
  return (
    <form action={action} className="min-w-0">
      <select
        name="rolle"
        defaultValue={rolle}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input input-sm max-w-full"
        aria-label={label}
        data-testid="vorgabe-rolle"
      >
        {!rolle && (
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
