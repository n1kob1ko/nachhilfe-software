"use client";

import { ClipboardPaste } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { einheitAusTextAction, type EinheitTextStand } from "@/app/einheit-text-actions";
import { MAX_TEXT } from "@/lib/einheit-aus-text-regeln";

function Knopf() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending} data-testid="aus-text-lesen">
      {pending ? "Wird gelesen …" : "Formular ausfüllen"}
    </button>
  );
}

/**
 * „Aus Text übernehmen“ über dem Formular „Einheit nachtragen“: eine Zusammenfassung einfügen (z. B. aus einem
 * Claude-Chat), die KI füllt das Formular aus, die Lehrkraft prüft und speichert. `ki`: ob die KI gerade lesen kann.
 */
export function EinheitAusText({ studentId, vorgabe, ki }: { studentId: number; vorgabe: { datum?: string; start?: string; dauer?: string }; ki: { ok: true } | { ok: false; grund: string } }) {
  const [stand, action] = useActionState<EinheitTextStand, FormData>(einheitAusTextAction, null);
  return (
    <details className="panel mb-6 px-4 py-3" data-testid="aus-text" open={stand !== null}>
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold">
        <ClipboardPaste size={18} /> Aus Text übernehmen
      </summary>
      <form action={action} className="mt-2 grid gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        {Object.entries(vorgabe).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <p className="text-[13px] text-ink-2">
          Füg eine Zusammenfassung der Einheit ein, z. B. aus einem Chat mit Claude. {ki.ok ? "Die KI verteilt sie auf die Felder: Fehler einzeln mit Fähigkeit und Fehlerart, geübte Fähigkeiten, nächstes Mal und ein besprochenes Prüfungsergebnis. Namen werden vorher entfernt. Du prüfst alles, bevor es gespeichert wird." : `${ki.grund} Ohne KI kommt der Text Zeile für Zeile unter „Was wurde gemacht?“.`}
        </p>
        <textarea className="input min-h-[180px]" name="text" required maxLength={MAX_TEXT * 2} placeholder={"1. Schularbeit besprochen: 47 von 69 Punkten …\n2. Übungspaket bearbeitet …\n3. Erkenntnisse: …"} />
        {stand?.error && <p className="text-[13px] text-red">{stand.error}</p>}
        <div>
          <Knopf />
        </div>
      </form>
    </details>
  );
}
