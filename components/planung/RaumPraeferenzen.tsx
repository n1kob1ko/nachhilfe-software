"use client";

/**
 * Raumwünsche eines Lehrers (portiert und neu gestaltet nach `PreferredRoomsEditor.tsx` der
 * Tutoring-Plattform): eine geordnete Liste — der erste Raum ist der liebste. Die Reihenfolge ist
 * die Vorliebe; der Generator (Phase 4) nimmt sie als Wunsch, nicht als Bedingung.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Save, X } from "lucide-react";
import { saveTeacherPreferredRoomsAction } from "@/app/planung-actions";
import { Pill } from "@/components/ui";
import type { Raum } from "@/lib/planung/repo";

export function RaumPraeferenzen({ teacherId, raeume, value, zurueck }: { teacherId: number; raeume: Raum[]; value: number[]; zurueck: string }) {
  const [liste, setListe] = useState<number[]>(value);
  const nach = (i: number, j: number) => {
    if (j < 0 || j >= liste.length) return;
    const next = [...liste];
    [next[i], next[j]] = [next[j], next[i]];
    setListe(next);
  };
  const frei = raeume.filter((r) => !liste.includes(r.id));
  const name = (id: number) => raeume.find((r) => r.id === id)?.name ?? `Raum ${id}`;

  return (
    <form action={saveTeacherPreferredRoomsAction.bind(null, teacherId)} className="grid gap-3">
      <input type="hidden" name="zurueck" value={zurueck} />
      {liste.map((id) => (
        <input key={id} type="hidden" name="room_ids" value={id} />
      ))}
      {liste.length === 0 ? (
        <p className="text-[14px] text-ink-3">Keine Raumwünsche — es wird jeder Raum genommen.</p>
      ) : (
        <ol className="grid gap-2">
          {liste.map((id, i) => {
            const raum = raeume.find((r) => r.id === id);
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
                <span className="num w-5 text-[13px] font-semibold text-ink-3">{i + 1}.</span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold">{name(id)}</span>
                {raum && <Pill tone={raum.mode === "online" ? "accent" : "neutral"}>{raum.mode === "online" ? "online" : "vor Ort"}</Pill>}
                {raum && <span className="text-[13px] text-ink-3">{raum.building}</span>}
                <span className="flex items-center gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nach(i, i - 1)} disabled={i === 0} aria-label={`${name(id)} nach oben`}>
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nach(i, i + 1)} disabled={i === liste.length - 1} aria-label={`${name(id)} nach unten`}>
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setListe(liste.filter((x) => x !== id))} aria-label={`${name(id)} entfernen`}>
                    <X size={15} aria-hidden />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {frei.length > 0 && (
        <label className="field max-w-[280px]">
          <span className="label">Raum hinzufügen</span>
          <select className="input" value="" onChange={(e) => e.target.value && setListe([...liste, Number(e.target.value)])}>
            <option value="">Bitte wählen …</option>
            {frei.map((r) => (
              <option key={r.id} value={r.id}>
                {r.building} · {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <button className="btn btn-primary btn-sm">
          <Save size={15} aria-hidden /> Raumwünsche speichern
        </button>
      </div>
    </form>
  );
}
