"use client";

/**
 * Die Randstücke der Wochenansicht: die Kennzahlen der Woche und das **Offen-Schubfach** (Schüler,
 * deren Bedarf die Woche nicht deckt, D18). Beide bekommen fertige Zahlen aus
 * `lib/planung/uebersicht.ts` und rechnen nicht selbst.
 */
import { AlertTriangle, CheckCircle2, DoorOpen, X } from "lucide-react";
import type { UebersichtOffen, WochenUebersicht } from "@/lib/planung/uebersicht";

/** Das Schubfach der nicht gedeckten Schüler — die Liste kommt aus der Datenbank, nicht aus dem letzten Lauf. */
export function OffenSchubfach({ offen, istOffen, onSchliessen }: { offen: UebersichtOffen[]; istOffen: boolean; onSchliessen: () => void }) {
  if (!istOffen) return null;
  const fehlend = offen.reduce((summe, o) => summe + Math.max(0, o.benoetigteMinuten - o.geplanteMinuten), 0);
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Offene Schüler">
      <button type="button" className="absolute inset-0 bg-ink/20" aria-label="Schließen" onClick={onSchliessen} />
      <div className="relative h-full w-full max-w-[420px] overflow-y-auto bg-surface px-5 py-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Offen</h2>
            <p className="text-[13px] text-ink-2">
              {offen.length === 0 ? "Alle Schüler sind eingeplant." : `${offen.length} ${offen.length === 1 ? "Schüler hat" : "Schüler haben"} noch Bedarf — zusammen ${fehlend} min.`}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSchliessen} aria-label="Schließen">
            <X size={16} aria-hidden />
          </button>
        </div>

        {offen.length === 0 ? (
          <p className="flex items-center gap-2 text-[14px] text-green">
            <CheckCircle2 size={17} aria-hidden /> Der Bedarf dieser Woche ist gedeckt.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {offen.map((o) => (
              <li key={o.studentId} className="py-3">
                <div className="font-semibold">{o.studentName}</div>
                <div className="num text-[13px] text-ink-2">
                  {o.geplanteEinheiten}/{o.einheitenProWoche} Einheiten · {o.geplanteMinuten} von {o.benoetigteMinuten} min
                </div>
                {o.grund && (
                  <div className="mt-1 flex items-start gap-1.5 text-[12px] text-amber">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {o.grund}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-[12px] text-ink-3">
          Ein Platz von Hand (gesperrt) zählt mit. „Neu generieren“ lässt gesperrte Plätze stehen und füllt den Rest.
        </p>
      </div>
    </div>
  );
}

/**
 * Die Kennzahlen der Woche in einer Zeile über dem Gitter. „… noch offen“ öffnet das Schubfach; die
 * Liste kommt aus der Datenbank, nicht aus dem letzten Lauf.
 */
export function WochenKennzahlen({ uebersicht, onOffen }: { uebersicht: WochenUebersicht; onOffen: () => void }) {
  const { summen, offen, raeume } = uebersicht;
  const online = raeume.filter((r) => r.mode === "online").length;
  const belegt = summen.einheiten > 0;
  return (
    <div className="no-print flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-2">
      {belegt ? (
        <span>
          <strong className="num font-semibold text-ink">{summen.einheiten}</strong> {summen.einheiten === 1 ? "Einheit" : "Einheiten"} · <span className="num">{summen.minuten}</span> min
        </span>
      ) : (
        <span>Noch keine Plätze in dieser Woche.</span>
      )}
      {belegt && (
        <span title="Geplante Minuten im Verhältnis zu geplanten Minuten und unnützen Lücken, an Tagen, an denen der Lehrer unterrichtet">
          Auslastung <strong className="num font-semibold text-ink">{summen.auslastung}&nbsp;%</strong>
        </span>
      )}
      {summen.lueckenMinuten > 0 && <span className="num font-medium text-amber">Lücken {summen.lueckenMinuten} min</span>}
      {summen.nichtStattgefunden > 0 && (
        <span className="font-medium text-red">
          <strong className="num">{summen.nichtStattgefunden}</strong> nicht stattgefunden
        </span>
      )}
      {offen.length > 0 ? (
        <button type="button" onClick={onOffen} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-amber-wash px-3 font-semibold text-amber transition-[filter] hover:brightness-95">
          <AlertTriangle size={14} aria-hidden /> {offen.length} Schüler noch offen
        </button>
      ) : belegt ? (
        <span className="flex items-center gap-1 font-medium text-green">
          <CheckCircle2 size={15} aria-hidden /> alle Schüler eingeplant
        </span>
      ) : null}
      <span className="flex items-center gap-1 text-ink-3">
        <DoorOpen size={14} aria-hidden /> {raeume.length} Räume{online ? `, ${online} online` : ""}
      </span>
    </div>
  );
}
