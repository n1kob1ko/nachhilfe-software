"use client";

import { FileCheck2 } from "lucide-react";
import { useState } from "react";
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

const KARTE = "flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] has-checked:border-accent has-checked:bg-accent-wash";

/**
 * Dauer, woher die Aufgaben kommen und KI für eine neue Probeschularbeit (lib/probeschularbeit.ts). „Vom Stoffzettel“
 * (`stoff`: so viele Zeilen hat der Stoff): die KI schreibt alle Aufgaben, jede Zeile kommt dran. `nurStoff`: der Stoff
 * ist noch keinen Fähigkeiten zugeordnet, „Aus der App“ geht erst danach. Während sie entsteht, ist der Knopf gesperrt,
 * damit ein doppelter Tipp nur eine macht.
 */
export function ProbeschularbeitForm({ action, ai, again, stoff = 0, nurStoff = false }: { action: (f: FormData) => Promise<void>; ai: boolean; again: boolean; stoff?: number; nurStoff?: boolean }) {
  const vomStoff = ai && stoff > 0;
  const [art, setArt] = useState<"stoff" | "app">(vomStoff ? "stoff" : "app");
  return (
    <form action={action} className="grid gap-3">
      {vomStoff && (
        <fieldset className="grid gap-1.5" data-testid="probe-aufgaben">
          <legend className="mb-1.5 text-[13.5px] font-medium text-ink-2">Aufgaben</legend>
          <label className={KARTE}>
            <input type="radio" name="aufgaben" value="stoff" checked={art === "stoff"} onChange={() => setArt("stoff")} className="mt-1 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">Vom Stoffzettel</span>
              <span className="block text-[13px] text-ink-2">
                Die KI schreibt alle Aufgaben, jede der <span className="num">{stoff}</span> Zeilen kommt dran, auch ohne passende Fähigkeit.
              </span>
            </span>
          </label>
          {nurStoff ? (
            <p className="px-1 text-[13px] text-ink-3">„Aus der App“ geht, sobald der Stoff oben Fähigkeiten zugeordnet ist.</p>
          ) : (
            <label className={KARTE}>
              <input type="radio" name="aufgaben" value="app" checked={art === "app"} onChange={() => setArt("app")} className="mt-1 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">Aus der App</span>
                <span className="block text-[13px] text-ink-2">Aufgaben zu den zugeordneten Fähigkeiten, aus der Sammlung und den eingebauten Aufgaben.</span>
              </span>
            </label>
          )}
        </fieldset>
      )}
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
      {ai && art === "app" && (
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
