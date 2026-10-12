"use client";

/**
 * Verfügbarkeit bearbeiten: das Raster (`VerfuegbarkeitEditor`) in einem Formular, das eine
 * Server Action aufruft. Der Wert lebt im Client-Zustand und geht als verstecktes Feld mit.
 */
import { useState } from "react";
import { Save } from "lucide-react";
import { VerfuegbarkeitEditor } from "./VerfuegbarkeitEditor";

export function VerfuegbarkeitFormular({
  action,
  value,
  zurueck,
  weekStart,
  hinweis,
  submitLabel = "Verfügbarkeit speichern",
  readOnly = false,
}: {
  /** Server Action, in der Seite schon an Lehrer/Schüler gebunden. */
  action: (formData: FormData) => Promise<void>;
  /** Verfügbarkeit als JSON. */
  value: string;
  /** Wohin nach dem Speichern zurückgeleitet wird (Pfad in der App). */
  zurueck: string;
  weekStart?: string;
  hinweis?: string;
  submitLabel?: string;
  readOnly?: boolean;
}) {
  const [wert, setWert] = useState(value);
  if (readOnly) return <VerfuegbarkeitEditor value={wert} weekStart={weekStart} readOnly />;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="zurueck" value={zurueck} />
      <VerfuegbarkeitEditor value={wert} onChange={setWert} weekStart={weekStart} name="availability" hinweis={hinweis} />
      <div>
        <button className="btn btn-primary btn-sm">
          <Save size={15} aria-hidden /> {submitLabel}
        </button>
      </div>
    </form>
  );
}
