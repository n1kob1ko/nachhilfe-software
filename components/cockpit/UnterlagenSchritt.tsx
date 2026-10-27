import { FileText } from "lucide-react";
import { zeigeUnterlageAction } from "@/app/unterlagen-actions";
import type { Unterlage } from "@/lib/unterlagen-unterricht";

const tagMonat = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

/**
 * Mitgebrachte Unterlagen unter „Das zeigst du“ (lib/unterlagen-unterricht.ts): je Unterlage ein kleines Bild (Foto) oder „PDF“, der
 * Titel und „Öffnen“ zur ruhigen Ansicht im Unterricht (nur lesen, nur für Lehrer). Öffnen wird vermerkt, damit der Abschluss es nennen kann.
 */
export function UnterlagenListe({ unitId, schrittId, unterlagen }: { unitId: number; schrittId: number; unterlagen: Unterlage[] }) {
  return (
    <ul className="grid gap-2" data-testid="unterlagen-schritt">
      {unterlagen.map((u) => (
        <li key={u.materialId}>
          <form action={zeigeUnterlageAction.bind(null, unitId, schrittId, u.materialId)}>
            <button className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-line bg-surface px-2 py-2 text-left hover:bg-panel" data-testid="unterlage-oeffnen">
              {u.art === "Foto" ? (
                // eslint-disable-next-line @next/next/no-img-element -- the teacher-only file route, no optimiser
                <img src={`/material/${u.materialId}/datei`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-line bg-paper object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-wash text-[12px] font-semibold text-accent" aria-hidden>
                  PDF
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-semibold">{u.titel}</span>
                <span className="block text-[13px] text-ink-3">
                  {u.art} · {u.heute ? "heute mitgebracht" : `vom ${tagMonat(u.datum)}`}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 pr-1 text-[14.5px] font-semibold text-accent">
                <FileText size={15} aria-hidden /> Öffnen
              </span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
