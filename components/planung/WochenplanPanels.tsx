"use client";

/**
 * Die Randstücke der Wochenansicht: Seitenleiste (Lehrer und Schüler mit „x/y Einheiten geplant“),
 * das **Offen-Schubfach** (Schüler, deren Bedarf die Woche nicht deckt, D18) und der Fuß mit den
 * Summen. Alles bekommt fertige Zahlen aus `lib/planung/uebersicht.ts` und rechnet nicht selbst.
 */
import { AlertTriangle, CheckCircle2, DoorOpen, X } from "lucide-react";
import { Pill } from "@/components/ui";
import type { UebersichtLehrer, UebersichtOffen, UebersichtSchueler, WochenSummen } from "@/lib/planung/uebersicht";

/** „3/2“ heißt: drei Plätze von zwei verlangten. */
const paar = (ist: number, soll: number) => `${ist}/${soll}`;

export function WochenplanSeitenleiste({
  lehrer,
  schueler,
  onLehrerWaehlen,
  onSchuelerWaehlen,
  gewaehlterLehrer,
  gewaehlterSchueler,
}: {
  lehrer: UebersichtLehrer[];
  schueler: UebersichtSchueler[];
  gewaehlterLehrer?: number;
  gewaehlterSchueler?: number;
  onLehrerWaehlen?: (id: number) => void;
  onSchuelerWaehlen?: (id: number) => void;
}) {
  return (
    <aside className="no-print hidden w-[248px] shrink-0 flex-col gap-4 lg:flex">
      <section className="panel px-3 py-3">
        <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Lehrer</h2>
        <ul className="space-y-0.5">
          {lehrer.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onLehrerWaehlen?.(l.id)}
                aria-pressed={gewaehlterLehrer === l.id}
                title="Nur diesen Lehrer anzeigen"
                className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-panel ${gewaehlterLehrer === l.id ? "bg-panel" : ""}`}
              >
                <span className="block truncate font-medium text-ink">{l.name}</span>
                <span className="num block text-[12px] text-ink-2">
                  {l.einheiten} Einheiten · {l.minuten}
                  {l.zielMin ? `/${l.zielMin}` : ""} min
                </span>
                {l.lueckenMinuten > 0 && <span className="block text-[11px] text-amber">Lücken {l.lueckenMinuten} min</span>}
              </button>
            </li>
          ))}
          {!lehrer.length && <li className="px-2 py-1 text-[13px] text-ink-3">Keine Lehrer.</li>}
        </ul>
      </section>

      <section className="panel px-3 py-3">
        <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Schüler</h2>
        <ul className="space-y-0.5">
          {schueler.map((s) => {
            const offen = s.einheitenProWoche > 0 && s.einheiten < s.einheitenProWoche;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSchuelerWaehlen?.(s.id)}
                  aria-pressed={gewaehlterSchueler === s.id}
                  title="Nur diesen Schüler anzeigen"
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-panel ${gewaehlterSchueler === s.id ? "bg-panel" : ""}`}
                >
                  <span className="block truncate font-medium text-ink">{s.name}</span>
                  <span className="num block text-[12px] text-ink-2">
                    {s.einheitenProWoche > 0 ? `${paar(s.einheiten, s.einheitenProWoche)} Einheiten geplant` : `${s.einheiten} Einheiten (kein Bedarf)`}
                  </span>
                  {offen && (
                    <Pill tone="amber" title="Der Bedarf dieser Woche ist noch nicht gedeckt">
                      offen
                    </Pill>
                  )}
                </button>
              </li>
            );
          })}
          {!schueler.length && <li className="px-2 py-1 text-[13px] text-ink-3">Keine Schüler.</li>}
        </ul>
      </section>
    </aside>
  );
}

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

export function WochenplanFuss({ summen, raeume }: { summen: WochenSummen; raeume: { id: number; name: string; mode: string }[] }) {
  const online = raeume.filter((r) => r.mode === "online").length;
  return (
    <footer className="no-print panel mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[13px]">
      <span className="font-medium text-ink">
        <strong className="num">{summen.einheiten}</strong> geplante Einheiten · <span className="num">{summen.minuten}</span> min
      </span>
      <span className="text-ink-2">
        Auslastung <strong className="num">{summen.auslastung}&nbsp;%</strong> (geschlossene Lehrertage)
      </span>
      <span className="num text-ink-2">Lücken {summen.lueckenMinuten} min</span>
      {summen.unterBedarf > 0 ? (
        <span className="text-amber">
          <strong className="num">{summen.unterBedarf}</strong> Schüler unter Bedarf
        </span>
      ) : (
        <span className="flex items-center gap-1 text-green">
          <CheckCircle2 size={15} aria-hidden /> alle Schüler eingeplant
        </span>
      )}
      {summen.nichtStattgefunden > 0 && (
        <span className="text-red">
          <strong className="num">{summen.nichtStattgefunden}</strong> nicht stattgefunden
        </span>
      )}
      <span className="flex items-center gap-1 text-ink-3">
        <DoorOpen size={14} aria-hidden /> {raeume.length} Räume{online ? `, ${online} online` : ""}
      </span>
    </footer>
  );
}
