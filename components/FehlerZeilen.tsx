"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { EntwurfFehler } from "@/lib/einheit-aus-text-regeln";
import { ERROR_TYPES } from "@/lib/error-types";

/**
 * Die Fehler einer Einheit aus „Einheit aus Text übernehmen“: je Fehler eine Zeile mit Text, Fähigkeit und Fehlerart, die
 * die Lehrkraft ändern, löschen oder ergänzen kann. Gespeichert werden sie als Fehler der Einheit (eine Zeile je Fehler)
 * und als Erkenntnisse (lib/erkenntnisse.ts). Die drei Felder stehen in jeder Zeile, damit die Listen gleich lang bleiben.
 */
export function FehlerZeilen({ start, skills }: { start: EntwurfFehler[]; skills: { id: string; name: string; area: string }[] }) {
  const [zeilen, setZeilen] = useState(() => (start.length ? start : [{ text: "", skillId: null, fehlerart: null }]).map((z, i) => ({ ...z, key: i })));
  const [naechster, setNaechster] = useState(zeilen.length);
  const bereiche = [...new Set(skills.map((s) => s.area))];
  return (
    <div className="grid gap-2" data-testid="fehler-zeilen">
      {zeilen.map((z) => (
        <div key={z.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
          <input className="input col-span-2 sm:col-span-3" name="ek_text" defaultValue={z.text} aria-label="Fehler" placeholder="z. B. Bestimmt den Fall über den Begleiter statt über die Frage" maxLength={300} />
          <select className="input col-span-2 sm:col-span-1" name="ek_skill" defaultValue={z.skillId ?? ""} aria-label="Fähigkeit">
            <option value="">Fähigkeit: keine</option>
            {bereiche.map((b) => (
              <optgroup key={b} label={b}>
                {skills
                  .filter((s) => s.area === b)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <select className="input" name="ek_art" defaultValue={z.fehlerart ?? ""} aria-label="Fehlerart">
            <option value="">Fehlerart: offen</option>
            {ERROR_TYPES.filter((e) => e.key !== "unbekannt").map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm justify-self-end" aria-label="Zeile entfernen" onClick={() => setZeilen((a) => a.filter((x) => x.key !== z.key))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm justify-self-start"
        onClick={() => {
          setZeilen((a) => [...a, { text: "", skillId: null, fehlerart: null, key: naechster }]);
          setNaechster((n) => n + 1);
        }}
      >
        <Plus size={16} /> Fehler dazu
      </button>
    </div>
  );
}
