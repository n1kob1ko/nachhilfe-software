"use client";

import { FileCheck2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ANZAHL, DAUER, DAUER_STANDARD } from "@/lib/probeschularbeit-regeln";

function Erstellen({ again }: { again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={again ? "btn btn-secondary" : "btn btn-primary"} disabled={pending}>
      <FileCheck2 size={17} aria-hidden />
      {pending ? "Wird erstellt …" : again ? "Noch eine erstellen" : "Probeschularbeit erstellen"}
    </button>
  );
}

/**
 * Dauer und KI für eine neue Probeschularbeit (lib/probeschularbeit.ts). Während sie entsteht, ist der
 * Knopf gesperrt, damit ein doppelter Tipp nur eine macht.
 */
export function ProbeschularbeitForm({ action, ai, again }: { action: (f: FormData) => Promise<void>; ai: boolean; again: boolean }) {
  return (
    <form action={action} className="grid gap-3">
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="mb-1.5 text-[13.5px] font-medium text-ink-2">Dauer</legend>
        {DAUER.map((d) => (
          <label key={d} className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[14px] has-checked:border-accent has-checked:bg-accent-wash">
            <input type="radio" name="dauer" value={d} defaultChecked={d === DAUER_STANDARD} className="accent-[var(--accent)]" />
            <span className="num">{d} Min</span>
            <span className="num text-ink-3">· {ANZAHL[d]} Aufgaben</span>
          </label>
        ))}
      </fieldset>
      {ai && (
        <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
          <input type="checkbox" name="ki" value="1" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
          Mit KI: Aufgaben für Themen ohne eingebaute Aufgaben
        </label>
      )}
      <div>
        <Erstellen again={again} />
      </div>
    </form>
  );
}
