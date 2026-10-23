"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Send, SlidersHorizontal } from "lucide-react";
import type { AnpassenState } from "@/app/cockpit-actions";
import type { SendState } from "@/app/device-actions";
import { SendResult } from "@/components/device/TabletSend";

function SendenKnopf({ label, primary }: { label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn ${primary ? "btn-primary" : "btn-secondary"} w-fit`} disabled={pending}>
      <Send size={16} aria-hidden /> {pending ? "Wird gesendet …" : label}
    </button>
  );
}

/**
 * „Übung senden“ im Cockpit: die Aktion ist schon an Einheit und Schritt (oder Fähigkeit) gebunden, also
 * geht die Übung an den Schüler dieser Einheit. Zeigt ehrlich, ob sie am Gerät angekommen ist.
 */
export function CockpitSenden({ action, unitId, label, primary }: { action: (prev: SendState, form: FormData) => Promise<SendState>; unitId: number; label: string; primary?: boolean }) {
  const [state, formAction] = useActionState<SendState, FormData>(action, null);
  return (
    <div className="grid gap-2">
      <form action={formAction}>
        <SendenKnopf label={label} primary={primary} />
      </form>
      <SendResult state={state} unitId={unitId} unitLink={false} />
    </div>
  );
}

function AnpassenSenden({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary w-fit" disabled={pending} data-testid="anpassen">
      <SlidersHorizontal size={16} aria-hidden /> {pending ? "Vorschläge werden erstellt …" : label}
    </button>
  );
}

/**
 * „Anpassen“ im Cockpit: eine Anfrage an die KI, nur auf Klick. Die Vorschläge zeigt danach die Seite selbst
 * (sie wird neu geladen); hier steht nur, ob es geklappt hat.
 */
export function AnpassenKnopf({ action, label }: { action: (prev: AnpassenState, form: FormData) => Promise<AnpassenState>; label: string }) {
  const [state, formAction] = useActionState<AnpassenState, FormData>(action, null);
  return (
    <div className="grid gap-1.5">
      <form action={formAction}>
        <AnpassenSenden label={label} />
      </form>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`text-[13.5px] ${state.ok ? "text-ink-2" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </div>
  );
}

/** Die Notiz des Lehrers zu einem Schritt: speichert beim Verlassen des Felds oder auf Knopfdruck. Nur für den Lehrer. */
export function SchrittNotiz({ speichern, initial }: { speichern: (text: string) => Promise<{ ok: boolean }>; initial: string }) {
  const [text, setText] = useState(initial);
  const gesichert = useRef(initial);
  const [status, setStatus] = useState<"" | "gespeichert" | "fehler">("");
  const [pending, start] = useTransition();
  const sichern = () => {
    if (text.trim() === gesichert.current.trim()) return;
    const wert = text;
    start(async () => {
      try {
        const r = await speichern(wert);
        if (r.ok) gesichert.current = wert;
        setStatus(r.ok ? "gespeichert" : "fehler");
      } catch {
        setStatus("fehler");
      }
    });
  };
  return (
    <div className="grid gap-1.5">
      <label className="field">
        <span className="label">Deine Notiz zu diesem Schritt</span>
        <textarea
          className="input min-h-[84px]"
          value={text}
          maxLength={2000}
          placeholder="z. B. Genitiv noch unsicher, beim nächsten Mal mit Bildern"
          onChange={(e) => {
            setText(e.target.value);
            setStatus("");
          }}
          onBlur={sichern}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <button type="button" className="btn btn-ghost btn-sm" onClick={sichern} disabled={pending || text.trim() === gesichert.current.trim()}>
          Notiz speichern
        </button>
        {pending && <span className="text-ink-3">Wird gespeichert …</span>}
        {!pending && status === "gespeichert" && (
          <span className="inline-flex items-center gap-1 font-medium text-green" role="status">
            <Check size={14} aria-hidden /> gespeichert
          </span>
        )}
        {!pending && status === "fehler" && (
          <span className="text-red" role="alert">
            Nicht gespeichert. Läuft die Einheit noch?
          </span>
        )}
      </div>
    </div>
  );
}
