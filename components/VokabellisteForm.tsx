"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveVokabellisteAction, type VokabelState } from "@/app/vokabel-actions";
import { fundstelle, leseListe, sauberSatz, type GeleseneListe, type Vokabel } from "@/lib/vokabeln";

const BEISPIEL = `dog = der Hund | My dog loves long walks.
mobile phone; cell phone = das Handy | My mobile phone is in my bag.
to look after = auf jemanden aufpassen | I look after my little sister.`;

/**
 * Eine eigene Vokabelliste schreiben oder ändern: links der Text (eintippen oder aus Word, Excel oder dem
 * Heft-Abschreiben einfügen), rechts gleich die Vorschau, so wie die App die Zeilen liest.
 */
export function VokabellisteForm({ studentId, liste, zurueck }: { studentId: number; liste?: { id: number; title: string; text: string }; zurueck: string }) {
  const [state, action] = useActionState<VokabelState, FormData>(saveVokabellisteAction, null);
  // both fields keep their text after a failed save (React resets a form after its action)
  const [title, setTitle] = useState(liste?.title ?? "");
  const [text, setText] = useState(liste?.text ?? "");
  // the server's errors belong to the text that was sent; after a change the preview says what is wrong
  const [gesendet, setGesendet] = useState("");
  const zeigeFehler = Boolean(state?.fehler.length) && gesendet === `${title}\n${text}`;
  const gelesen = useMemo(() => leseListe(text), [text]);
  return (
    <form action={action} onSubmit={() => setGesendet(`${title}\n${text}`)} className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="student_id" value={studentId} />
      {liste && <input type="hidden" name="id" value={liste.id} />}
      <div className="grid min-w-0 gap-4">
        <label className="field">
          <span className="label">Name der Liste</span>
          <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} placeholder="z. B. Unit 3 oder Schularbeit Jänner" />
        </label>
        <label className="field">
          <span className="label">Wörter, eins pro Zeile</span>
          <textarea
            className="input font-mono text-[14px] leading-relaxed"
            name="text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={BEISPIEL}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            data-testid="vokabel-text"
          />
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
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Liste speichern"}
    </button>
  );
}

function Hilfe() {
  return (
    <details className="rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px] text-ink-2" open>
      <summary className="cursor-pointer font-semibold text-ink">So schreibst du die Liste</summary>
      <ul className="mt-2 grid list-disc gap-1 pl-5">
        <li>Links Englisch, rechts Deutsch, dazwischen „=“.</li>
        <li>Mehrere richtige Antworten trennst du mit „;“: mobile phone; cell phone = das Handy</li>
        <li>Nach „|“ steht ein Beispielsatz. Dann gibt es auch Aufgaben mit einer Lücke im Satz.</li>
        <li>Steht das Wort im Satz zweimal oder in einer Form, die die App nicht findet, markier es mit Sternchen: I *went* home.</li>
        <li>Spalten aus Excel oder Word (Englisch, Deutsch, Satz) kannst du direkt einfügen.</li>
        <li>Schreib zum deutschen Nomen den Artikel: der Hund. Bei der Antwort zählt nicht, ob „a“, „the“ oder „to“ davorsteht.</li>
      </ul>
    </details>
  );
}

function Vorschau({ gelesen }: { gelesen: GeleseneListe }) {
  const { eintraege, fehler, hinweise } = gelesen;
  const mitLuecke = eintraege.filter((e) => {
    const f = fundstelle(e);
    return f && f !== "mehrfach";
  }).length;
  return (
    <section className="panel min-w-0 px-4 py-4" aria-label="Vorschau" data-testid="vokabel-vorschau">
      <h2 className="text-[15px] font-semibold">
        Vorschau · {eintraege.length} {eintraege.length === 1 ? "Wort" : "Wörter"}
        {eintraege.length > 0 && <span className="font-normal text-ink-3"> · {mitLuecke} mit Satz für die Lücke</span>}
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
        <p className="mt-3 text-[14px] text-ink-3">Hier siehst du gleich, wie die App deine Zeilen liest.</p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {eintraege.map((e, i) => (
            <Zeile key={`${e.zeile ?? i}`} e={e} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Zeile({ e }: { e: Vokabel }) {
  const f = e.satz ? fundstelle(e) : null;
  const satz = e.satz ? sauberSatz(e.satz) : null;
  return (
    <li className="rounded-lg border border-line px-3 py-2 text-[14px] [overflow-wrap:anywhere]">
      <p>
        <span className="font-semibold">{e.en.join("; ")}</span>
        <span className="text-ink-3"> = </span>
        {e.de.join("; ")}
      </p>
      {satz && (
        <p className="mt-0.5 text-[13px] text-ink-2">
          {f && f !== "mehrfach" ? (
            <>
              {satz.slice(0, f.start)}
              <mark className="rounded bg-accent-wash px-0.5 font-semibold text-accent">{satz.slice(f.start, f.ende) || "___"}</mark>
              {satz.slice(f.ende)}
            </>
          ) : (
            <>
              {satz} <span className="text-amber">(keine Lücke)</span>
            </>
          )}
        </p>
      )}
    </li>
  );
}
