"use client";

/**
 * Der Dialog für **einen** Platz: anlegen (Lehrer, Schüler, Raum, Wochentag, Start, geplante Dauer)
 * oder bearbeiten/verschieben. Ob er offen ist, steht in der Adresse (`?neu=1` bzw. `?platz=<id>`)
 * — so schließt er sich nach dem Speichern von selbst, weil die Aktion ohne diesen Parameter
 * zurückleitet.
 *
 * Die geplante Dauer (D3) wird beim Schülerwechsel auf dessen eingestellte Dauer gesetzt; gefüllt
 * wird sie vom Server (`students.geplante_dauer`).
 */
import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createSlotAction, editSlotAction } from "@/app/planung-actions";
import type { UebersichtLehrer, UebersichtPlatz, UebersichtRaum, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import { labelMinuten, minutenLabel } from "@/lib/planung/zeit";
import { LoeschenFormular } from "./WochenplanGitter";

export function PlatzDialog({
  platz,
  neu,
  woche,
  zurueck,
  schliessenHref,
  tage,
  lehrer,
  schueler,
  raeume,
}: {
  /** null = ein neuer Platz. */
  platz: UebersichtPlatz | null;
  neu: boolean;
  woche: string;
  zurueck: string;
  schliessenHref: string;
  tage: UebersichtTage[];
  lehrer: UebersichtLehrer[];
  schueler: UebersichtSchueler[];
  raeume: UebersichtRaum[];
}) {
  const ersterSchueler = schueler.find((s) => s.id === platz?.studentId);
  const [dauer, setDauer] = useState<number>(platz?.dauer ?? ersterSchueler?.geplanteDauer ?? 100);
  const [start, setStart] = useState<string>(minutenLabel(platz?.startMin ?? 14 * 60));
  if (!neu && !platz) return null;
  const startMinuten = labelMinuten(start) ?? 0;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/20 px-4 py-8" role="dialog" aria-modal="true" aria-label={platz ? "Platz bearbeiten" : "Platz anlegen"}>
      <div className="w-full max-w-[520px] rounded-[20px] bg-surface px-5 py-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">{platz ? "Platz bearbeiten" : "Platz anlegen"}</h2>
            <p className="text-[13px] text-ink-2">
              Von Hand gesetzte Plätze sperren — dann lässt „Neu generieren“ sie stehen. Die geplante Dauer schreibt die echte Einheit nicht vor.
            </p>
          </div>
          <Link href={schliessenHref} className="btn btn-ghost btn-sm" aria-label="Schließen">
            <X size={16} aria-hidden />
          </Link>
        </div>

        <form action={platz ? editSlotAction : createSlotAction} className="grid gap-3">
          <input type="hidden" name="woche" value={woche} />
          <input type="hidden" name="zurueck" value={zurueck} />
          {platz && <input type="hidden" name="id" value={platz.id} />}

          <label className="field">
            <span className="label">Lehrer</span>
            <select name="teacher_id" defaultValue={platz?.teacherId ?? lehrer[0]?.id} required className="input">
              {lehrer.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Schüler</span>
            <select
              name="student_id"
              defaultValue={platz?.studentId ?? schueler[0]?.id}
              required
              className="input"
              onChange={(e) => {
                const gewaehlt = schueler.find((s) => s.id === Number(e.currentTarget.value));
                if (gewaehlt) setDauer(gewaehlt.geplanteDauer);
              }}
            >
              {schueler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.einheitenProWoche > 0 ? ` (${s.einheiten} von ${s.einheitenProWoche} geplant)` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Raum</span>
            <select name="room_id" defaultValue={platz?.roomId ?? ""} className="input">
              <option value="">kein Raum</option>
              {raeume.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.building} · {r.mode === "online" ? "online" : "vor Ort"}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="field">
              <span className="label">Wochentag</span>
              <select name="weekday" defaultValue={platz?.weekday ?? 1} className="input">
                {tage.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Start</span>
              <input type="time" name="start" step={600} value={start} onChange={(e) => setStart(e.currentTarget.value)} className="input" required />
            </label>
            <label className="field">
              <span className="label">geplante Dauer</span>
              <input type="number" name="geplante_dauer" min={1} max={300} step={1} value={dauer} onChange={(e) => setDauer(Number(e.currentTarget.value))} className="input" required />
            </label>
          </div>

          <p className="num text-[12px] text-ink-3">
            Geplant: {start}–{minutenLabel(startMinuten + dauer)} ({dauer} min)
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                {platz ? "Speichern" : "Platz anlegen"}
              </button>
              <Link href={schliessenHref} className="btn btn-secondary">
                Abbrechen
              </Link>
            </div>
            {platz && <LoeschenFormular id={platz.id} woche={woche} zurueck={zurueck} />}
          </div>
        </form>

        {platz && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-[12px] text-ink-2">
            <span>{platz.locked ? "gesperrt" : "nicht gesperrt"}</span>
            <span>·</span>
            <span>{platz.status === "veroeffentlicht" ? "veröffentlicht" : "Entwurf"}</span>
            <span>·</span>
            <span>{platz.unitId ? `mit Einheit #${platz.unitId} verknüpft` : "noch ohne Einheit"}</span>
            {platz.nichtStattgefunden && <span className="font-semibold text-red">nicht stattgefunden</span>}
            <span>·</span>
            <span>
              {platz.studentName} bei {platz.teacherName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
