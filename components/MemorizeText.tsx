"use client";

import { MEMORIZE_LEVELS, maskPassage, type MemorizeLevel } from "@/lib/memorize";
import { MathText } from "./MathText";

/**
 * Der Text einer Auswendig-schreiben-Aufgabe auf der Stufe, die der Schüler gewählt hat: erst ist er
 * ganz zu lesen, dann verschwinden nach und nach Wörter und Buchstaben, bis nichts mehr dasteht
 * (lib/memorize.ts maskPassage). Die Knöpfe sind groß genug fürs Tablet.
 */
export function MemorizeTextBox({
  passage,
  level,
  onChange,
  disabled = false,
}: {
  passage: string;
  level: MemorizeLevel;
  onChange: (level: MemorizeLevel) => void;
  disabled?: boolean;
}) {
  const masked = maskPassage(passage, level);
  return (
    <section className="mb-6" aria-label="Text zum Auswendiglernen">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wie viel Hilfe bleibt?">
        {MEMORIZE_LEVELS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={level === i}
            disabled={disabled}
            onClick={() => onChange(i as MemorizeLevel)}
            className={`min-h-[44px] rounded-lg border px-3 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
              level === i ? "border-accent bg-accent-wash text-accent" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ruled mt-3 rounded-xl border border-line bg-surface px-5 py-3 text-[18px] leading-[1.9] whitespace-pre-line">
        {masked ? <MathText text={masked} /> : <span className="text-ink-3">Der Text ist ganz ausgeblendet. Schreib ihn aus dem Gedächtnis auf.</span>}
      </div>
    </section>
  );
}
