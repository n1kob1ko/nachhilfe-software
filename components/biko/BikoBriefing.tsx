import { CalendarClock, ListChecks } from "lucide-react";
import { mitNamen, type BikoAuftrag, type BriefingBiko } from "@/lib/biko";

/**
 * Das Tagesbriefing von Biko (lib/biko.ts): Überblick, je Schüler Schwerpunkt, Punkte und was vorzubereiten ist, dazu
 * Hinweise für den Tag. Biko schreibt S1, S2 …; die Namen setzt erst diese Ansicht ein.
 */
export function BikoBriefing({ a, kompakt = false }: { a: BikoAuftrag; kompakt?: boolean }) {
  const b = a.ergebnis as BriefingBiko | null;
  if (!b) return null;
  const n = (t: string) => mitNamen(t, a.zuordnung);
  return (
    <div className="grid gap-4" data-testid="biko-briefing">
      {b.ueberblick && <p className="text-[15px] leading-relaxed">{n(b.ueberblick)}</p>}
      {b.hinweise.length > 0 && (
        <ul className="grid gap-1.5 rounded-2xl bg-accent-wash px-4 py-3 text-[14px] text-accent">
          {b.hinweise.map((h, i) => (
            <li key={i} className="flex gap-2">
              <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden /> {n(h)}
            </li>
          ))}
        </ul>
      )}
      <ul className="grid gap-3">
        {b.schueler.map((s) => (
          <li key={s.kennung} className="rounded-2xl border border-line px-4 py-3">
            <p className="font-semibold">{n(s.kennung)}</p>
            {s.schwerpunkt && <p className="mt-0.5 text-[14.5px]">{n(s.schwerpunkt)}</p>}
            {!kompakt && s.punkte.length > 0 && (
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-[14px] text-ink-2">
                {s.punkte.map((p, i) => (
                  <li key={i}>{n(p)}</li>
                ))}
              </ul>
            )}
            {s.vorbereiten.length > 0 && (
              <p className="mt-2 flex gap-2 text-[13.5px] text-ink-2">
                <ListChecks size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>Vorbereiten: {s.vorbereiten.map(n).join(" · ")}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
