"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveFehlerprotokollAction, type FehlerprotokollState } from "@/app/fehlerprotokoll-actions";
import { BEISPIEL, leseFehler, RAUS_NACH, type GeleseneFehler } from "@/lib/fehlerprotokoll-text";

/**
 * Das Fehlerprotokoll schreiben (lib/fehlerprotokoll-text.ts): links der Text, ein Fehler pro Zeile („falsch → richtig“),
 * rechts gleich die Karten, so wie die App sie zeigt: der Satz mit Lücke, darunter die richtige und die falsche Form.
 * Gebaut wie die Spielkarten (components/SpielkartenForm.tsx).
 */
export function FehlerprotokollForm({ studentId, text: start, zurueck }: { studentId: number; text: string; zurueck: string }) {
  const [state, action] = useActionState<FehlerprotokollState, FormData>(saveFehlerprotokollAction, null);
  const [text, setText] = useState(start);
  const [gesendet, setGesendet] = useState("");
  const zeigeFehler = Boolean(state?.fehler.length) && gesendet === text;
  const gelesen = useMemo(() => leseFehler(text), [text]);
  return (
    <form action={action} onSubmit={() => setGesendet(text)} className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid min-w-0 gap-4">
        <label className="field">
          <span className="label">Fehler, einer pro Zeile: falsch → richtig</span>
          <textarea
            className="input font-mono text-[14px] leading-relaxed"
            name="text"
            rows={16}
            wrap="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={BEISPIEL}
            spellCheck={false}
            data-testid="fehlerprotokoll-text"
          />
        </label>
        <details className="rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2" open={!start}>
          <summary className="cursor-pointer font-semibold text-ink">So schreibst du das Protokoll</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>Links die Stelle, wie sie im Text stand, dann „→“ (oder „-&gt;“), rechts die richtige Form.</li>
            <li>Nimm nur den Satzteil mit dem Fehler. Was links und rechts gleich ist, bleibt im Spiel stehen; der Unterschied wird zur Lücke.</li>
            <li>„Merke: …“ in der Zeile darunter zeigt die App nach einem Fehler, zum Beispiel „unterstützen + Akkusativ (wen?)“.</li>
            <li>Ein Fehler fliegt raus, wenn er {RAUS_NACH}× hintereinander richtig war. Er bleibt hier stehen und ist unten abgehakt.</li>
          </ul>
        </details>
        {zeigeFehler && state && (
          <ul className="grid gap-1 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
            {state.fehler.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Speichern />
          <Link href={zurueck} className="btn btn-ghost">
            Abbrechen
          </Link>
        </div>
      </div>
      <Vorschau gelesen={gelesen} />
    </form>
  );
}

function Speichern() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending} data-testid="fehlerprotokoll-speichern">
      {pending ? "Wird gespeichert …" : "Protokoll speichern"}
    </button>
  );
}

function Vorschau({ gelesen }: { gelesen: GeleseneFehler }) {
  const { eintraege, fehler, hinweise } = gelesen;
  return (
    <section className="panel min-w-0 px-4 py-4" aria-label="Vorschau" data-testid="fehlerprotokoll-vorschau">
      <h2 className="text-[15px] font-semibold">
        Vorschau · {eintraege.length} Fehler
      </h2>
      {fehler.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-lg bg-red-wash px-3 py-2 text-[13.5px] text-red">
          {fehler.map((m) => (
            <li key={`f${m.zeile}${m.text}`}>{m.text}</li>
          ))}
        </ul>
      )}
      {hinweise.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13.5px] text-amber">
          {hinweise.map((m) => (
            <li key={`h${m.zeile}${m.text}`}>{m.text}</li>
          ))}
        </ul>
      )}
      {eintraege.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-3">Hier siehst du gleich die Karten, so wie sie im Spiel kommen.</p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {eintraege.map((e) => (
            <li key={e.zeile} className="rounded-lg border border-line px-3 py-2 text-[14px] [overflow-wrap:anywhere]">
              <p className="font-medium">
                {e.vor} <span className="rounded bg-accent-wash px-1.5 text-ink-3">___</span> {e.nach}
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5 text-[13px]">
                <span className="rounded-md bg-green-wash px-1.5 py-0.5 font-semibold text-green">{e.stelleRichtig}</span>
                <span className="rounded-md border border-line px-1.5 py-0.5 text-ink-2 line-through decoration-red/60">{e.stelleFalsch}</span>
              </p>
              {e.merke && <p className="mt-1 text-[12.5px] text-ink-3">Merke: {e.merke}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
