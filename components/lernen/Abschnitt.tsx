import type { LucideIcon } from "lucide-react";

/**
 * Ein Abschnitt der Übersicht in der Schüler-App (components/lernen): eine Karte mit Überschrift, Symbol und
 * Anzahl, wie „Deine Termine“. Die Inhalte bleiben kurz; was über drei Zeilen geht, steht hinter „mehr“.
 */
export function Abschnitt({ titel, icon: Icon, anzahl, testId, children }: { titel: string; icon: LucideIcon; anzahl?: number; testId: string; children: React.ReactNode }) {
  return (
    <section className="panel mt-8 px-5 py-5" aria-label={titel} data-testid={testId}>
      <h2 className="flex items-center gap-2 text-[18px] font-semibold">
        <Icon size={18} className="shrink-0 text-accent" aria-hidden /> {titel}
        {anzahl !== undefined && anzahl > 0 && <span className="num rounded-full bg-accent-wash px-2 py-0.5 text-[13px] font-semibold text-accent">{anzahl}</span>}
      </h2>
      {children}
    </section>
  );
}

/** „2026-10-29“ als Kalendertag, nicht in der Zeitzone des Servers verschoben. */
const tag = (datum: string, o: Intl.DateTimeFormatOptions) => new Date(`${datum.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-AT", { ...o, timeZone: "UTC" });

/** „Do., 29. Okt.“ */
export const tagLabel = (datum: string) => tag(datum, { weekday: "short", day: "numeric", month: "short" });

/** Die Teile für ein kleines Kalenderblatt: „Do.“, „29“, „Okt.“ */
export const kalenderblatt = (datum: string) => ({ wochentag: tag(datum, { weekday: "short" }), tag: String(Number(datum.slice(8, 10))), monat: tag(datum, { month: "short" }) });
