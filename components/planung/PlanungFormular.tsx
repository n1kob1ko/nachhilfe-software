"use client";

/**
 * Der Abschnitt „Planung“ einer Schülerin/eines Schülers: Einheiten pro Woche, geplante Dauer,
 * Modus, erlaubte Lehrer und die Verfügbarkeit. Einheiten pro Woche × geplante Dauer ist der
 * Wochenbedarf (D18); die geplante Dauer schreibt die echte Einheit nicht vor (D3).
 */
import { useState } from "react";
import { Save } from "lucide-react";
import { saveStudentPlanningAction } from "@/app/planung-actions";
import { VerfuegbarkeitEditor } from "./VerfuegbarkeitEditor";
import type { ModusWunsch, SchuelerPlanung } from "@/lib/planung/repo";

const MODI: { wert: ModusWunsch; label: string; hinweis: string }[] = [
  { wert: "vor_ort", label: "vor Ort", hinweis: "möglichst in einem Raum im Haus" },
  { wert: "online", label: "online", hinweis: "möglichst ein Online-Raum" },
  { wert: "egal", label: "egal", hinweis: "beides möglich" },
];

export function PlanungFormular({
  studentId,
  planung,
  lehrer,
  zurueck,
}: {
  studentId: number;
  planung: SchuelerPlanung;
  /** Alle Lehrer zur Auswahl „erlaubte Lehrer“. */
  lehrer: { id: number; name: string; active: number }[];
  zurueck: string;
}) {
  const [verfuegbarkeit, setVerfuegbarkeit] = useState(JSON.stringify(planung.availability));
  const [erlaubte, setErlaubte] = useState<number[]>(planung.erlaubte_lehrer);
  const bedarf = planung.einheiten_pro_woche * planung.geplante_dauer;

  return (
    <form action={saveStudentPlanningAction.bind(null, studentId)} className="grid max-w-[860px] gap-6">
      <input type="hidden" name="zurueck" value={zurueck} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          <span className="label">Einheiten pro Woche</span>
          <input className="input" type="number" name="einheiten_pro_woche" min={0} max={40} step={1} defaultValue={planung.einheiten_pro_woche} />
        </label>
        <label className="field">
          <span className="label">Geplante Dauer (Minuten)</span>
          <input className="input" type="number" name="geplante_dauer" min={1} max={300} step={1} defaultValue={planung.geplante_dauer} />
          <span className="text-[12px] text-ink-3">Vorgabe 100, erlaubt 1–300. Die echte Einheit bleibt davon unberührt.</span>
        </label>
        <div className="field">
          <span className="label">Wochenbedarf</span>
          <p className="num text-[15px] font-semibold">
            {planung.einheiten_pro_woche} × {planung.geplante_dauer} min = {Math.floor(bedarf / 60)} h {bedarf % 60 ? `${bedarf % 60} min` : ""}
          </p>
          <span className="text-[12px] text-ink-3">Einheiten pro Woche × geplante Dauer.</span>
        </div>
      </div>

      <fieldset className="field">
        <legend className="label mb-1.5">Modus</legend>
        <div className="flex flex-wrap gap-2">
          {MODI.map((m) => (
            <label
              key={m.wert}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-2 text-[14px] has-checked:border-accent has-checked:bg-accent-wash"
              title={m.hinweis}
            >
              <input type="radio" name="modus_wunsch" value={m.wert} defaultChecked={planung.modus_wunsch === m.wert} className="accent-[var(--accent)]" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="label mb-1.5">Erlaubte Lehrer</legend>
        <p className="mb-1.5 text-[13px] text-ink-2">Leer heißt: jede Lehrerin und jeder Lehrer darf eingeplant werden.</p>
        <div className="flex flex-wrap gap-2">
          {lehrer.map((t) => {
            const an = erlaubte.includes(t.id);
            return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[14px] ${an ? "border-accent bg-accent-wash" : "border-line-strong bg-surface"}`}
              >
                <input
                  type="checkbox"
                  name="erlaubte_lehrer"
                  value={t.id}
                  checked={an}
                  onChange={(e) => setErlaubte(e.target.checked ? [...erlaubte, t.id] : erlaubte.filter((id) => id !== t.id))}
                  className="accent-[var(--accent)]"
                />
                {t.name}
                {!t.active && <span className="text-[12px] text-ink-3">deaktiviert</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <span className="label">Verfügbarkeit</span>
        <VerfuegbarkeitEditor value={verfuegbarkeit} onChange={setVerfuegbarkeit} name="availability" />
      </div>

      <div>
        <button className="btn btn-primary">
          <Save size={16} aria-hidden /> Planung speichern
        </button>
      </div>
    </form>
  );
}
