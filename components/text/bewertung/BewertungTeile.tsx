"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Sparkles } from "lucide-react";
import type { BewertungState } from "@/app/textbewertung-actions";
import { KRITERIEN, schnitt, STUFEN, stufeOf, type Erwartung, type KriteriumKey, type Stufe } from "@/lib/bewertung-kriterien";
import type { GefundenerBeleg } from "@/lib/zitatpruefung";

type Action = (prev: BewertungState, f: FormData) => Promise<BewertungState>;

function Meldung({ state }: { state: BewertungState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-[13.5px] ${state.ok ? "text-ink-2" : "text-red"}`} data-testid="meldung">
      {state.meldung}
    </p>
  );
}

function Senden({ label, pending: pendingLabel, primary, icon, testid, disabled }: { label: string; pending: string; primary?: boolean; icon?: React.ReactNode; testid?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${primary ? "btn-primary" : "btn-secondary"} w-fit`} disabled={pending || disabled} data-testid={testid}>
      {icon} {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Ein Knopf, der die KI fragt (nur auf Klick). `zustimmung`: ein Haken, ohne den nichts gesendet wird. `grund`: warum
 * es gerade nicht geht; dann steht der Grund statt des Knopfs.
 */
export function KiKnopf({ action, label, wartend, zustimmung, grund, testid }: { action: Action; label: string; wartend: string; zustimmung?: string; grund?: string | null; testid: string }) {
  const [state, formAction] = useActionState<BewertungState, FormData>(action, null);
  const [ja, setJa] = useState(false);
  if (grund) return <p className="text-[13.5px] text-ink-2" data-testid={`${testid}-grund`}>{grund}</p>;
  return (
    <form action={formAction} className="grid gap-2">
      {zustimmung && (
        <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
          <input type="checkbox" name="zustimmung" value="1" checked={ja} onChange={(e) => setJa(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid={`${testid}-zustimmung`} />
          <span>{zustimmung}</span>
        </label>
      )}
      <Senden label={label} pending={wartend} icon={<Sparkles size={16} aria-hidden />} testid={testid} disabled={Boolean(zustimmung) && !ja} />
      <Meldung state={state} />
    </form>
  );
}

/**
 * Der Erwartungshorizont je Kriterium, ein Punkt je Zeile. Gespeichert ist er geprüft; „frei“: der Schüler sieht ihn
 * beim Schreiben.
 */
export function ErwartungForm({ action, werte, freigegeben, name }: { action: Action; werte: Erwartung; freigegeben: boolean; name: string }) {
  const [state, formAction] = useActionState<BewertungState, FormData>(action, null);
  return (
    <form action={formAction} className="grid gap-4" data-testid="erwartung-form">
      {KRITERIEN.map((k) => (
        <label key={k.key} className="field">
          <span className="label">{k.name}</span>
          <span className="text-[13px] text-ink-2">{k.frage}. Ein Punkt je Zeile.</span>
          <textarea className="input leading-relaxed" name={`e_${k.key}`} rows={Math.min(10, Math.max(3, werte[k.key].length + 1))} defaultValue={werte[k.key].join("\n")} data-testid={`erwartung-${k.key}`} />
        </label>
      ))}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" name="frei" value="1" defaultChecked={freigegeben} className="h-5 w-5 accent-[var(--accent)]" data-testid="erwartung-frei" />
        {name} sieht ihn beim Schreiben (freigeben)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Senden label="Erwartungshorizont speichern" pending="Wird gespeichert …" primary icon={<Check size={16} aria-hidden />} testid="erwartung-speichern" />
        <Meldung state={state} />
      </div>
    </form>
  );
}

export type BewertungWerte = Record<KriteriumKey, { stufe: Stufe | null; begruendung: string; belege: GefundenerBeleg[] }>;

/** Stufe und Begründung je Kriterium, die Gesamtnote; erst „Bewertung bestätigen“ macht daraus die Bewertung. */
export function BewertungForm({ action, werte, note, name }: { action: Action; werte: BewertungWerte; note: Stufe | null; name: string }) {
  const [state, formAction] = useActionState<BewertungState, FormData>(action, null);
  const [stufen, setStufen] = useState<Record<KriteriumKey, Stufe | null>>(() => Object.fromEntries(KRITERIEN.map((k) => [k.key, werte[k.key].stufe])) as Record<KriteriumKey, Stufe | null>);
  const s = schnitt(KRITERIEN.map((k) => ({ stufe: stufen[k.key] })));
  return (
    <form action={formAction} className="grid gap-5" data-testid="bewertung-form">
      {KRITERIEN.map((k) => (
        <fieldset key={k.key} className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
          <legend className="text-[16px] font-semibold">{k.name}</legend>
          <p className="text-[13px] text-ink-2">{k.frage}</p>
          <label className="field max-w-[340px]">
            <span className="label">Stufe</span>
            <select
              className="input"
              name={`s_${k.key}`}
              required
              value={stufen[k.key] ?? ""}
              onChange={(e) => setStufen((x) => ({ ...x, [k.key]: stufeOf(e.target.value) }))}
              data-testid={`stufe-${k.key}`}
            >
              <option value="">Bitte wählen</option>
              {STUFEN.map((st) => (
                <option key={st.wert} value={st.wert}>
                  {st.wert} · {st.name}: {st.text}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Begründung</span>
            <textarea className="input leading-relaxed" name={`b_${k.key}`} rows={3} defaultValue={werte[k.key].begruendung} data-testid={`begruendung-${k.key}`} />
          </label>
          {werte[k.key].belege.length > 0 && (
            <ul className="grid gap-1 text-[13.5px]" data-testid={`belege-${k.key}`}>
              {werte[k.key].belege.map((b) => (
                <li key={b.zitat} className="text-ink-2">
                  „{b.zitat}“ <span className="text-ink-3">· {b.quelle === "textbeilage" ? `Textbeilage${b.stelle ? `, ${b.stelle}` : ""}` : `im Text von ${name}`}</span>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      ))}
      <div className="grid gap-2 border-t border-line pt-4">
        <label className="field max-w-[340px]">
          <span className="label">Gesamtnote (wenn du eine gibst)</span>
          <select className="input" name="note" defaultValue={note ?? ""} data-testid="gesamtnote">
            <option value="">Keine</option>
            {STUFEN.map((st) => (
              <option key={st.wert} value={st.wert}>
                {st.wert} · {st.name}
              </option>
            ))}
          </select>
        </label>
        {s !== null && <p className="num text-[13px] text-ink-2">Schnitt der Kriterien: {s.toLocaleString("de-AT")} (nur als Hilfe)</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Senden label="Bewertung bestätigen" pending="Wird gespeichert …" primary icon={<Check size={16} aria-hidden />} testid="bewertung-bestaetigen" />
        <Meldung state={state} />
      </div>
    </form>
  );
}
