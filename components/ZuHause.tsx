import { House } from "lucide-react";
import type { ZuHause } from "@/lib/zu-hause";

/**
 * Was seit der letzten Einheit zu Hause geübt wurde (lib/zu-hause.ts): eine Zeile mit Tagen, Minuten und Quote, darunter
 * die meistgeübten Spiele. In der laufenden Einheit oben (`kompakt`) und in „Mehr Details“.
 */
export function ZuHauseZeile({ z, vorname, kompakt }: { z: ZuHause | null; vorname: string; kompakt?: boolean }) {
  if (!z || (z.tage === 0 && !z.seitEinheit)) return null;
  const zeitraum = z.seitEinheit ? "Seit der letzten Einheit" : "In den letzten 14 Tagen";
  return (
    <section className={`panel px-5 py-4 ${kompakt ? "mb-4" : ""}`} aria-label="Zu Hause geübt" data-testid="zu-hause">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
        <House size={16} className="shrink-0 text-ink-3" aria-hidden />
        <span className="text-ink-2">{zeitraum} zu Hause:</span>
        {z.tage === 0 ? (
          <b className="font-semibold">nicht geübt</b>
        ) : (
          <b className="font-semibold">
            an {z.tage === 1 ? "1 Tag" : `${z.tage} Tagen`} geübt{z.minuten >= 1 ? `, ${z.minuten} min` : ""}
            {z.anzahl > 0 ? `, ${Math.round((z.richtig / z.anzahl) * 100)} % richtig` : ""}
          </b>
        )}
      </p>
      {z.was.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Was ${vorname} geübt hat`}>
          {z.was.map((w) => (
            <li key={w.titel} className="rounded-full bg-panel px-2.5 py-0.5 text-[13px] text-ink-2">
              {w.titel}
              <span className="num text-ink-3"> · {w.minuten >= 1 ? `${w.minuten} min` : `${w.anzahl}×`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
