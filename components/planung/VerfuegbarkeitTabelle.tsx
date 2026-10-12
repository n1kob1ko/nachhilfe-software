/**
 * Verfügbarkeit als ruhige Übersicht (read-only): je Tag die Spannen als Pill.
 * Für Stellen, an denen niemand etwas ändern darf — z. B. wenn ein Lehrer die Planung eines
 * fremden Schülers nur ansieht. Das Raster zum Bearbeiten ist `VerfuegbarkeitEditor.tsx`.
 */
import { Pill } from "@/components/ui";
import { spannenFuerTag, type Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { WOCHENTAGE, WOCHENTAG_KURZ, WOCHENTAG_LANG, minutenLabel } from "@/lib/planung/zeit";

export function VerfuegbarkeitTabelle({ verfuegbarkeit, kompakt = false }: { verfuegbarkeit: Verfuegbarkeit; kompakt?: boolean }) {
  const tage = WOCHENTAGE.filter((tag) => spannenFuerTag(verfuegbarkeit, tag).length);
  if (!tage.length) return <p className="text-[14px] text-ink-3">Keine Verfügbarkeit eingetragen.</p>;
  return (
    <ul className="grid gap-1.5">
      {tage.map((tag) => (
        <li key={tag} className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[14px] font-semibold text-ink-2">{kompakt ? WOCHENTAG_KURZ[tag] : WOCHENTAG_LANG[tag]}</span>
          <span className="flex flex-wrap gap-1.5">
            {spannenFuerTag(verfuegbarkeit, tag).map((s, i) => (
              <Pill key={i} tone="neutral">
                <span className="num">
                  {minutenLabel(s.start)}–{minutenLabel(s.end)}
                </span>
              </Pill>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
