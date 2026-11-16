"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveSpielkartenAction, type SpielkartenState } from "@/app/spielkarten-actions";
import { ANTWORTEN_MAX, BEISPIEL, KARTEN_MIN, leseKarten, TEILE_MAX, type EigeneKarte, type GeleseneKarten } from "@/lib/spielkarten-text";

const FAECHER = ["Biologie", "Geschichte", "Geografie", "Physik", "Chemie", "Deutsch", "Englisch", "Mathematik", "Französisch", "Latein", "Religion"];

/**
 * Spielkarten schreiben oder ändern (lib/spielkarten-text.ts): links der Text, eine Karte pro Zeile, rechts gleich die
 * Vorschau, so wie die App die Zeilen liest. Gebaut wie die Vokabellisten (components/VokabellisteForm.tsx).
 */
export function SpielkartenForm({
  studentId,
  satz,
  faecher,
  zurueck,
}: {
  studentId: number;
  satz?: { id: number; titel: string; fach: string; text: string; aktiv: boolean };
  faecher: string[];
  zurueck: string;
}) {
  const [state, action] = useActionState<SpielkartenState, FormData>(saveSpielkartenAction, null);
  // die Felder behalten ihren Text nach einem misslungenen Speichern (React setzt ein Formular nach seiner Aktion zurück)
  const [titel, setTitel] = useState(satz?.titel ?? "");
  const [fach, setFach] = useState(satz?.fach ?? "");
  const [text, setText] = useState(satz?.text ?? "");
  const [aktiv, setAktiv] = useState(satz?.aktiv ?? true);
  const [gesendet, setGesendet] = useState("");
  const zeigeFehler = Boolean(state?.fehler.length) && gesendet === `${titel}\n${text}`;
  const gelesen = useMemo(() => leseKarten(text), [text]);
  const vorschlaege = [...new Set([...FAECHER, ...faecher])];
  return (
    <form action={action} onSubmit={() => setGesendet(`${titel}\n${text}`)} className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="student_id" value={studentId} />
      {satz && <input type="hidden" name="id" value={satz.id} />}
      <div className="grid min-w-0 gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="field">
            <span className="label">Name</span>
            <input className="input" name="titel" value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={80} placeholder="z. B. Evolution" data-testid="spielkarten-titel" />
          </label>
          <label className="field">
            <span className="label">Fach</span>
            <input className="input" name="fach" value={fach} onChange={(e) => setFach(e.target.value)} maxLength={40} list="spielkarten-faecher" placeholder="Biologie" />
            <datalist id="spielkarten-faecher">
              {vorschlaege.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="field">
          <span className="label">Karten, eine pro Zeile</span>
          <textarea
            className="input font-mono text-[14px] leading-relaxed"
            name="text"
            rows={16}
            wrap="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={BEISPIEL}
            spellCheck={false}
            data-testid="spielkarten-text"
          />
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
          <input type="checkbox" name="aktiv" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} className="size-4" />
          Im Spiel: als „Dein Stoff“ und im Blockwerk in der Schüler-App
        </label>
        <Hilfe />
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
    <button className="btn btn-primary" disabled={pending} data-testid="spielkarten-speichern">
      {pending ? "Wird gespeichert …" : "Karten speichern"}
    </button>
  );
}

function Hilfe() {
  return (
    <details className="rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2" open>
      <summary className="cursor-pointer font-semibold text-ink">So schreibst du die Karten</summary>
      <ul className="mt-2 grid list-disc gap-1 pl-5">
        <li>
          Frage, dann „=“, dann die <b>richtige</b> Antwort zuerst und die falschen dahinter, getrennt mit „|“. 2 bis {ANTWORTEN_MAX} Antworten. Die App mischt sie im Spiel.
        </li>
        <li>Mit „___“ in der Frage kommt die Antwort in die Lücke: Magma ist Gestein ___ der Erde. = im Inneren | an der Oberfläche</li>
        <li>
          Reihenfolge: Auftrag, Doppelpunkt, dann die Teile in der richtigen Reihenfolge mit „&gt;“ dazwischen (3 bis {TEILE_MAX}): Ordne das Zeitseil: Erdurzeit &gt; Erdaltertum &gt; Erdneuzeit
        </li>
        <li>„Merke: …“ in der Zeile darunter zeigt die App nach einem Fehler bei dieser Karte.</li>
        <li>Gute falsche Antworten sind die, die Schüler wirklich verwechseln (Lamarck und Darwin, Mutation und Selektion).</li>
      </ul>
    </details>
  );
}

function Vorschau({ gelesen }: { gelesen: GeleseneKarten }) {
  const { karten, fehler, hinweise } = gelesen;
  return (
    <section className="panel min-w-0 px-4 py-4" aria-label="Vorschau" data-testid="spielkarten-vorschau">
      <h2 className="text-[15px] font-semibold">
        Vorschau · {karten.length} {karten.length === 1 ? "Karte" : "Karten"}
        {karten.length > 0 && karten.length < KARTEN_MIN && <span className="font-normal text-ink-3"> · ins Spiel ab {KARTEN_MIN}</span>}
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
      {karten.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-3">Hier siehst du gleich, wie die App deine Zeilen liest.</p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {karten.map((k, i) => (
            <Zeile key={`${k.zeile ?? i}`} k={k} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Zeile({ k }: { k: EigeneKarte }) {
  return (
    <li className="rounded-lg border border-line px-3 py-2 text-[14px] [overflow-wrap:anywhere]">
      <p className="font-medium">{k.frage}</p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-[13px]">
        {k.art === "wahl" ? (
          <>
            <span className="rounded-md bg-green-wash px-1.5 py-0.5 font-semibold text-green">{k.richtig}</span>
            {k.falsch.map((f) => (
              <span key={f} className="rounded-md border border-line px-1.5 py-0.5 text-ink-2">
                {f}
              </span>
            ))}
          </>
        ) : (
          <span className="text-ink-2">{k.teile.join(" → ")}</span>
        )}
      </p>
      {k.merke && <p className="mt-1 text-[12.5px] text-ink-3">Merke: {k.merke}</p>}
    </li>
  );
}
