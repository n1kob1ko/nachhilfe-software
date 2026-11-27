"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveLernwoerterAction, type LernwoerterState } from "@/app/lernwoerter-actions";
import { LERNWORT_BEISPIEL, leseLernwoerter, lernwortRegel, stelleImSatz, type GeleseneLernwoerter } from "@/lib/lernwoerter-text";

/**
 * Die Lernwörter eines Schülers schreiben (lib/lernwoerter-text.ts): links die Liste, ein Wort pro Zeile, rechts gleich
 * die Karten, so wie die App sie zeigt. Gebaut wie das Fehlerprotokoll (components/FehlerprotokollForm.tsx).
 */
export function LernwoerterForm({ studentId, text: start, zurueck }: { studentId: number; text: string; zurueck: string }) {
  const [state, action] = useActionState<LernwoerterState, FormData>(saveLernwoerterAction, null);
  const [text, setText] = useState(start);
  const [gesendet, setGesendet] = useState("");
  const zeigeFehler = Boolean(state?.fehler.length) && gesendet === text;
  const gelesen = useMemo(() => leseLernwoerter(text), [text]);
  return (
    <form action={action} onSubmit={() => setGesendet(text)} className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid min-w-0 gap-4">
        <label className="field">
          <span className="label">Lernwörter, eines pro Zeile (Satz dazu nach einem Doppelpunkt)</span>
          <textarea
            className="input font-mono text-[14px] leading-relaxed"
            name="text"
            rows={16}
            wrap="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={LERNWORT_BEISPIEL}
            spellCheck={false}
            data-testid="lernwoerter-text"
          />
        </label>
        <details className="rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2" open={!start}>
          <summary className="cursor-pointer font-semibold text-ink">So schreibst du die Liste</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>Schreib jedes Wort genau so, wie es richtig ist, auch groß und klein. Das Spiel prüft jeden Buchstaben.</li>
            <li>Nach einem Doppelpunkt ein kurzer Satz mit dem Wort: dann schreibt das Kind das Wort in die Lücke im Satz.</li>
            <li>Das Spiel zeigt jedes neue Wort zuerst und liest es vor. War es beim letzten Mal richtig, wird es nur noch vorgelesen, wie beim Diktat.</li>
            <li>Ein leeres Feld löscht die Liste; dann übt das Kind wieder die Wörter der App.</li>
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
    <button className="btn btn-primary" disabled={pending} data-testid="lernwoerter-speichern">
      {pending ? "Wird gespeichert …" : "Liste speichern"}
    </button>
  );
}

function Vorschau({ gelesen }: { gelesen: GeleseneLernwoerter }) {
  const { eintraege, fehler, hinweise } = gelesen;
  return (
    <section className="panel min-w-0 px-4 py-4" aria-label="Vorschau" data-testid="lernwoerter-vorschau">
      <h2 className="text-[15px] font-semibold">Vorschau · {eintraege.length} {eintraege.length === 1 ? "Wort" : "Wörter"}</h2>
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
          {eintraege.map((e) => {
            const i = e.satz ? stelleImSatz(e.satz, e.wort) : -1;
            return (
              <li key={e.zeile} className="rounded-lg border border-line px-3 py-2 text-[14px] [overflow-wrap:anywhere]">
                <p className="font-semibold">{e.wort}</p>
                {i >= 0 && (
                  <p className="mt-0.5 text-ink-2">
                    {e.satz.slice(0, i)}
                    <span className="rounded bg-accent-wash px-1.5 text-ink-3">___</span>
                    {e.satz.slice(i + e.wort.length)}
                  </p>
                )}
                <p className="mt-1 text-[12.5px] text-ink-3">{lernwortRegel(e.wort)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
