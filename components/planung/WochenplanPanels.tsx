"use client";

/**
 * Die Randstücke der Wochenansicht: die **Statuskarte** der Woche (Zustand, der nächste Schritt und
 * die Kennzahlen) und das **Offen-Schubfach** (Schüler, deren Bedarf die Woche nicht deckt, D18).
 * Beide bekommen fertige Zahlen aus `lib/planung/uebersicht.ts` und rechnen nicht selbst.
 */
import { useEffect, useRef } from "react";
import { AlertTriangle, CalendarCheck2, CalendarPlus, CheckCircle2, DoorOpen, FilePenLine, X } from "lucide-react";
import type { UebersichtOffen, WochenUebersicht } from "@/lib/planung/uebersicht";

/** Das Schubfach der nicht gedeckten Schüler. Die Liste kommt aus der Datenbank, nicht aus dem letzten Lauf. */
export function OffenSchubfach({ offen, istOffen, onSchliessen }: { offen: UebersichtOffen[]; istOffen: boolean; onSchliessen: () => void }) {
  const schliessenKnopf = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!istOffen) return;
    schliessenKnopf.current?.focus();
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSchliessen();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [istOffen, onSchliessen]);

  if (!istOffen) return null;
  const fehlend = offen.reduce((summe, o) => summe + Math.max(0, o.benoetigteMinuten - o.geplanteMinuten), 0);
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Offene Schüler">
      <button type="button" tabIndex={-1} className="schleier absolute inset-0 bg-ink/20" aria-label="Schließen" onClick={onSchliessen} />
      <div className="schubfach relative h-full w-full max-w-[420px] overflow-y-auto bg-surface px-5 py-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Noch offen</h2>
            <p className="text-[13px] text-ink-2">
              {offen.length === 0 ? "Alle Schüler sind eingeplant." : `${offen.length} ${offen.length === 1 ? "Schüler hat" : "Schüler haben"} noch Bedarf, zusammen ${fehlend} min.`}
            </p>
          </div>
          <button ref={schliessenKnopf} type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={onSchliessen} aria-label="Schließen">
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
                  <div className="mt-1 flex items-start gap-1.5 text-[12.5px] text-amber">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {o.grund}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-[12.5px] text-ink-3">Ein Platz von Hand (gesperrt) zählt mit. „Neu generieren“ lässt gesperrte Plätze stehen und füllt den Rest.</p>
      </div>
    </div>
  );
}

/** Was die Statuskarte je Zustand sagt. Die Verwaltung bekommt den nächsten Schritt, ein Lehrer nur den Stand. */
function zustandText(status: WochenUebersicht["status"], darfBearbeiten: boolean): { titel: string; text: string } {
  if (!darfBearbeiten)
    return status === "leer"
      ? { titel: "Noch nichts veröffentlicht", text: "Sobald die Verwaltung den Plan veröffentlicht, stehen deine Plätze hier." }
      : { titel: "Deine Woche", text: "Veröffentlicht. Ändern kann sie die Verwaltung." };
  if (status === "leer") return { titel: "Noch kein Plan für diese Woche", text: "Generieren schlägt Plätze aus Verfügbarkeit und Bedarf vor. Oder du übernimmst die Vorwoche." };
  if (status === "entwurf") return { titel: "Entwurf", text: "Lehrer sehen ihn noch nicht. Plätze prüfen und verschieben, dann veröffentlichen." };
  return { titel: "Veröffentlicht", text: "Jeder Lehrer sieht seine Plätze dieser Woche." };
}

const ZUSTAND_FARBE = {
  leer: { icon: CalendarPlus, flaeche: "var(--panel)", farbe: "var(--ink-2)" },
  entwurf: { icon: FilePenLine, flaeche: "var(--amber-wash)", farbe: "var(--amber)" },
  veroeffentlicht: { icon: CalendarCheck2, flaeche: "var(--green-wash)", farbe: "var(--green)" },
} as const;

/**
 * Die Karte über dem Plan: in welchem Zustand die Woche ist, was als Nächstes zu tun ist (die
 * Knöpfe kommen als `aktionen` herein) und darunter die Kennzahlen. „… noch offen“ öffnet das Schubfach.
 */
export function WochenStatus({ uebersicht, darfBearbeiten, aktionen, onOffen }: { uebersicht: WochenUebersicht; darfBearbeiten: boolean; aktionen?: React.ReactNode; onOffen: () => void }) {
  const { titel, text } = zustandText(uebersicht.status, darfBearbeiten);
  const { icon: Icon, flaeche, farbe } = ZUSTAND_FARBE[uebersicht.status];
  return (
    <section className="no-print panel px-4 py-4 sm:px-5" aria-label="Stand der Woche">
      {/* the buttons wrap below the text as soon as the text would get narrower than ~300 px */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex min-w-[min(100%,300px)] flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: flaeche, color: farbe }}>
            <Icon size={19} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] leading-snug font-semibold text-balance">{titel}</h3>
            <p className="text-[13.5px] text-pretty text-ink-2">{text}</p>
          </div>
        </div>
        {aktionen && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{aktionen}</div>}
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <WochenKennzahlen uebersicht={uebersicht} onOffen={onOffen} />
      </div>
    </section>
  );
}

/** Die Kennzahlen der Woche in einer Zeile. Die Liste „offen“ kommt aus der Datenbank, nicht aus dem letzten Lauf. */
export function WochenKennzahlen({ uebersicht, onOffen }: { uebersicht: WochenUebersicht; onOffen: () => void }) {
  const { summen, offen, raeume } = uebersicht;
  const online = raeume.filter((r) => r.mode === "online").length;
  const belegt = summen.einheiten > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-2">
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
        <button type="button" onClick={onOffen} className="drueck inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-amber-wash px-3 font-semibold text-amber transition-[filter] hover:brightness-95">
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
