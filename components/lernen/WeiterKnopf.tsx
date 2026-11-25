"use client";

import { Play } from "lucide-react";

/**
 * „Weiterspielen“ für ein angefangenes Spiel (components/lernen/spielstand.ts), wie in der Spielschale: groß, mit dem
 * Stand darunter („Kärnten · Karte 5 von 14“).
 */
export function WeiterKnopf({ text, onClick, disabled, testid = "spiel-weiter", className = "" }: { text: string; onClick: () => void; disabled?: boolean; testid?: string; className?: string }) {
  return (
    <button type="button" className={`ls-knopf ls-los ls-weiter ${className}`} onClick={onClick} disabled={disabled} data-testid={testid}>
      <Play size={20} fill="currentColor" aria-hidden />
      <span>Weiterspielen</span>
      <small>{text}</small>
    </button>
  );
}
