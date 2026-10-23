"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import type { BewertungState } from "@/app/textbewertung-actions";
import { PdfLesen } from "@/components/text/interpretation/PdfLesen";

/** Mirrors MAX_ANGABE in lib/schreibauftrag-bewertung.ts (kept here so the browser does not load server code). */
const MAX_ANGABE = 30_000;

/**
 * „Angabe / Textvorlage“ einer Textarbeit (wahlweise): was zur Aufgabe gehört, etwa die Stellenanzeige und die Notizen
 * eines Arbeitsblatts. Nur für die Lehrkraft; „Aufgabe erfüllt?“ prüft damit den Bezug und die Zitate. „Aus PDF
 * übernehmen“ liest den Text einer PDF ohne KI (lib/pdf-text.ts) und hängt ihn an.
 */
export function AngabeFeld({ defaultValue = "", rows = 5 }: { defaultValue?: string; rows?: number }) {
  const [wert, setWert] = useState(defaultValue);
  return (
    <div className="field">
      <label className="label" htmlFor="angabe-feld">
        Angabe / Textvorlage <span className="font-normal text-ink-3">(wahlweise)</span>
      </label>
      <span className="text-[13px] text-ink-2">Zum Beispiel die Stellenanzeige oder die Notizen vom Arbeitsblatt. Nur du siehst sie; „Aufgabe erfüllt?“ prüft damit den Bezug und die Zitate.</span>
      <textarea
        id="angabe-feld"
        className="input leading-relaxed"
        name="angabe"
        rows={rows}
        maxLength={MAX_ANGABE}
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        data-testid="angabe"
      />
      <PdfLesen onText={(v) => setWert((alt) => [alt.trim(), [v.titel, v.text].filter(Boolean).join("\n")].filter(Boolean).join("\n\n"))} kiLiest={false} />
    </div>
  );
}

function Speichern() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary w-fit" disabled={pending} data-testid="angabe-speichern">
      <Check size={16} aria-hidden /> {pending ? "Wird gespeichert …" : "Angabe speichern"}
    </button>
  );
}

/** Die Angabe in „Aufgabe erfüllt?“ ändern, ohne zur Textseite zu wechseln. */
export function AngabeForm({ action, angabe }: { action: (prev: BewertungState, f: FormData) => Promise<BewertungState>; angabe: string }) {
  const [state, formAction] = useActionState<BewertungState, FormData>(action, null);
  return (
    <form action={formAction} className="grid gap-3" data-testid="angabe-form">
      <AngabeFeld defaultValue={angabe} />
      <div className="flex flex-wrap items-center gap-3">
        <Speichern />
        {state && (
          <p role={state.ok ? "status" : "alert"} className={`text-[13.5px] ${state.ok ? "text-ink-2" : "text-red"}`}>
            {state.meldung}
          </p>
        )}
      </div>
    </form>
  );
}
