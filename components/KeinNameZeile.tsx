import { ShieldCheck } from "lucide-react";

/**
 * Statt des Häkchens „kein Name“, wenn es für die laufende Einheit schon bestätigt ist (lib/kein-name.ts): eine ruhige Zeile,
 * die trotzdem bei jedem Foto ans Abdecken erinnert. Nur für Lehrkräfte.
 */
export function KeinNameZeile({ wo = "auf den Seiten" }: { wo?: string }) {
  return (
    <p className="flex items-start gap-2 text-[14px] text-ink-2" data-testid="kein-name-bestaetigt">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
      <span>Kein Name {wo}: für diese Einheit bestätigt. Bitte trotzdem abdecken.</span>
    </p>
  );
}
