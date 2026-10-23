import { AlertTriangle } from "lucide-react";
import type { FehltZeile } from "@/lib/bewertung-kriterien";

/**
 * Der Kasten „Was fehlt“ (vor der Prüfung, in der Freigabe) und „Was gefehlt hat“ (über dem Ergebnis) von
 * „Aufgabe erfüllt?“. Die Zeilen bestimmt die App (lib/bewertung-kriterien.ts fehlendeAngaben), nie die KI. Ohne Zeilen
 * nichts. Ohne Hooks, damit Server- und Client-Komponenten ihn zeigen.
 */
export function WasFehlt({ zeilen, titel, children }: { zeilen: FehltZeile[]; titel: string; children?: React.ReactNode }) {
  if (!zeilen.length && !children) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-amber-wash px-4 py-3 text-[14px]" role="note" data-testid="was-fehlt">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber" aria-hidden />
      <div className="grid min-w-0 gap-1">
        <p className="font-semibold">{titel}</p>
        <ul className="grid gap-1">
          {zeilen.map((z) => (
            <li key={z.text} className={z.ton === "stopp" ? "font-medium" : "text-ink-2"} data-ton={z.ton}>
              {z.text}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}
