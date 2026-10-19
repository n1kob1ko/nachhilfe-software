"use client";

/**
 * Der Dialog für **einen** Platz: anlegen (Lehrer, Schüler, Raum, Wochentag, Start, geplante Dauer)
 * oder bearbeiten/verschieben, sperren und löschen. Ob er offen ist, steht in der Adresse (`?neu=1`
 * bzw. `?platz=<id>`): So schließt er sich nach dem Speichern von selbst, weil die Aktion ohne diesen
 * Parameter zurückleitet. Ein Klick auf freie Zeit im Gitter gibt Lehrer, Tag und Start mit
 * (`vorgabe`); Escape schließt ihn.
 *
 * Die geplante Dauer (D3) wird beim Schülerwechsel auf dessen eingestellte Dauer gesetzt; gefüllt
 * wird sie vom Server (`students.geplante_dauer`).
 *
 * Der Haken „Gleichzeitig mit einem anderen Schüler“ (D26) erlaubt dem Lehrer zu dieser Zeit einen
 * zweiten Schüler; geprüft wird das nur im Server (`lib/planung/repo.ts`).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, X } from "lucide-react";
import { createSlotAction, deleteSlotAction, editSlotAction, lockSlotAction } from "@/app/planung-actions";
import type { UebersichtLehrer, UebersichtPlatz, UebersichtRaum, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import { labelMinuten, minutenLabel } from "@/lib/planung/zeit";
import type { Vorgabe } from "./Wochenplan";

export function PlatzDialog({
  platz,
  neu,
  woche,
  zurueck,
  schliessenHref,
  vorgabe,
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
  /** Lehrer, Tag und Start für einen neuen Platz (Klick ins Gitter oder „Platz bei …“). */
  vorgabe?: Vorgabe;
  tage: UebersichtTage[];
  lehrer: UebersichtLehrer[];
  schueler: UebersichtSchueler[];
  raeume: UebersichtRaum[];
}) {
  const ersterSchueler = schueler.find((s) => s.id === platz?.studentId);
  const [dauer, setDauer] = useState<number>(platz?.dauer ?? ersterSchueler?.geplanteDauer ?? 100);
  const [start, setStart] = useState<string>(minutenLabel(platz?.startMin ?? vorgabe?.startMin ?? 14 * 60));
  const router = useRouter();
  const offen = neu || !!platz;
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(schliessenHref, { scroll: false });
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen, router, schliessenHref]);
  if (!offen) return null;
  const startMinuten = labelMinuten(start) ?? 0;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/20 px-4 py-8" role="dialog" aria-modal="true" aria-label={platz ? "Platz bearbeiten" : "Platz anlegen"}>
      <div className="dialog-karte w-full max-w-[520px] rounded-[20px] bg-surface px-5 py-5 shadow-[var(--shadow-pop)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">{platz ? "Platz bearbeiten" : "Platz anlegen"}</h2>
            <p className="text-[13px] text-ink-2">
              Gesperrte Plätze lässt „Neu generieren“ stehen. Die geplante Dauer schreibt die echte Einheit nicht vor.
            </p>
          </div>
          <Link href={schliessenHref} scroll={false} className="btn btn-ghost btn-sm !px-2.5" aria-label="Schließen">
            <X size={16} aria-hidden />
          </Link>
        </div>

        <form action={platz ? editSlotAction : createSlotAction} className="grid gap-3">
          <input type="hidden" name="woche" value={woche} />
          <input type="hidden" name="zurueck" value={zurueck} />
          {platz && <input type="hidden" name="id" value={platz.id} />}

          <label className="field">
            <span className="label">Lehrer</span>
            <select name="teacher_id" defaultValue={platz?.teacherId ?? vorgabe?.teacherId ?? lehrer[0]?.id} required className="input">
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="field col-span-2 sm:col-span-1">
              <span className="label">Wochentag</span>
              <select name="weekday" defaultValue={platz?.weekday ?? vorgabe?.weekday ?? 1} className="input">
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

          <label className="flex min-h-[44px] items-start gap-2 text-[14px]">
            <input type="checkbox" name="gleichzeitig" defaultChecked={platz?.gleichzeitig ?? false} className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <span>
              Gleichzeitig mit einem anderen Schüler
              <span className="block text-[12.5px] text-ink-2">
                {platz?.zugleichMit.length
                  ? `Zur selben Zeit beim selben Lehrer: ${platz.zugleichMit.join(", ")}.`
                  : "Der Lehrer darf zu dieser Zeit einen zweiten Schüler haben, auch im selben Raum. Mehr als zwei gehen nicht."}{" "}
                Beide Plätze werden gesperrt.
              </span>
            </span>
          </label>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                {platz ? "Speichern" : "Platz anlegen"}
              </button>
              <Link href={schliessenHref} scroll={false} className="btn btn-secondary">
                Abbrechen
              </Link>
            </div>
            {/* sends the separate delete form below: a form inside a form is not allowed in HTML */}
            {platz && (
              <button type="submit" form="platz-loeschen" className="btn btn-danger btn-sm">
                Platz löschen
              </button>
            )}
          </div>
        </form>

        {platz && (
          <form id="platz-loeschen" action={deleteSlotAction.bind(null, platz.id)} hidden>
            <input type="hidden" name="woche" value={woche} />
            <input type="hidden" name="zurueck" value={zurueck} />
          </form>
        )}

        {platz && (
          <form action={lockSlotAction.bind(null, platz.id, !platz.locked)} className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel px-3.5 py-2.5">
            <input type="hidden" name="woche" value={woche} />
            <input type="hidden" name="zurueck" value={zurueck} />
            <span className="flex items-center gap-2 text-[13.5px]">
              {platz.locked ? <Lock size={15} aria-hidden /> : <LockOpen size={15} className="text-ink-3" aria-hidden />}
              {platz.locked ? "Gesperrt: bleibt bei „Neu generieren“ stehen." : "Nicht gesperrt: „Neu generieren“ darf ihn verschieben."}
            </span>
            <button type="submit" className="btn btn-secondary btn-sm">
              {platz.locked ? "Entsperren" : "Sperren"}
            </button>
          </form>
        )}

        {platz && (
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-ink-2">
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
