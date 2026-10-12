"use client";

import { flushSync } from "react-dom";
import type { RefObject } from "react";

/**
 * Umlautleiste für Textantworten: ä ö ü ß Ä Ö Ü. Eine Tablet-Tastatur gibt sie oft nicht her, und ohne
 * sie lässt sich ein deutscher Text nicht schreiben (Idee aus Artikel Trainers `keyboard_logic.js`).
 *
 * Dieselbe Bauart wie die Zeichenleiste für Rechenaufgaben (`components/MathAnswer.tsx`, SignBar): der
 * Knopf schreibt an der Schreibmarke in das Feld, das zuletzt den Fokus hatte, und lässt den Fokus dort
 * — sonst klappt die Tablet-Tastatur zu. Die Rechenzeichen stehen dort, weil sie zum Rechnen gehören;
 * die Umlaute hier, weil sie zum Schreiben gehören.
 */

/** Das Feld, in das die Leiste schreibt: das Element und der Zustandsschreiber, der dazu gehört. */
export type TextTarget = { el: HTMLInputElement | HTMLTextAreaElement; set: (v: string) => void };

/** Die Zeichen, die eine deutsche Tastatur auf dem Tablet vermissen lässt. */
export const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"] as const;

export function UmlautBar({ target, className = "" }: { target: RefObject<TextTarget | null>; className?: string }) {
  const put = (insert: string) => {
    const t = target.current;
    if (!t || !t.el.isConnected || t.el.disabled) return;
    const v = t.el.value;
    const from = t.el.selectionStart ?? v.length;
    const to = t.el.selectionEnd ?? v.length;
    const next = v.slice(0, from) + insert + v.slice(to);
    // der neue Wert steht sofort im Feld, damit die Schreibmarke hinter das Zeichen kann
    flushSync(() => t.set(next));
    const caret = from + insert.length;
    t.el.focus();
    t.el.setSelectionRange(caret, caret);
  };
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="toolbar" aria-label="Umlaute">
      {UMLAUTS.map((u) => (
        <button
          key={u}
          type="button"
          // hält die Schreibmarke (und die Tablet-Tastatur) im Feld
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => put(u)}
          className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-2.5 text-[18px] font-semibold text-ink hover:border-accent hover:text-accent"
          aria-label={`${u} einfügen`}
          title={`${u} einfügen`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
