"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { IconWechsel } from "@/components/Bewegung";

/**
 * Der Knopf eines Formulars, der sofort zeigt, dass der Tipp angekommen ist (niko, 13.11.2026: jeder Klick wirkt sofort):
 * solange die Aktion läuft, dreht sich an der Stelle des Icons ein Kreis, und der Knopf nimmt keinen zweiten Tipp an
 * (keine zwei Einheiten durch Doppeltipp). Für Aktionen, nach denen die Seite wechselt („Einheit starten“,
 * „Ja, beenden“); was nur eine Zeile betrifft, nimmt `WegForm` (components/Meldung.tsx).
 */
export function FormKnopf({ icon, children, className = "btn btn-primary", disabled, ...rest }: { icon?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} disabled={pending || disabled} aria-busy={pending || undefined}>
      {icon !== undefined ? <IconWechsel an={pending} aus={icon} ein={<Loader2 size={17} className="animate-spin" aria-hidden />} /> : pending && <Loader2 size={17} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
