"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck, Sparkles, X } from "lucide-react";
import { startAICorrectionAction, type StartState } from "@/app/correction-actions";
import { Info } from "@/components/Info";

export type AIPreview = {
  /** "Anthropic" */
  provider: string;
  model: string;
  enabled: boolean;
  /** why the KI cannot run (no key, too short, too long) */
  blocked: string | null;
  words: number;
  /** estimated cost in US dollars */
  costUsd: number;
  /** the paragraphs exactly as they are sent, names replaced */
  masked: string[];
  /** whose names are replaced */
  hidden: string;
  /** Bildgeschichte: the teacher's short descriptions of the pictures (sent instead of the pictures) */
  pictures?: string[] | null;
};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={disabled || pending} data-testid="ki-senden">
      <Sparkles size={16} aria-hidden /> {pending ? "Wird gestartet …" : "An die KI senden"}
    </button>
  );
}

/**
 * „Mit KI korrigieren“: nothing is sent before the teacher has seen what goes out, to whom, and ticked
 * the box. Without a key (or for a text that is too short or long) the button explains why it is off.
 */
export function AIStartButton({ textId, preview, label = "Mit KI korrigieren", variant = "primary" }: { textId: number; preview: AIPreview; label?: string; variant?: "primary" | "secondary" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ok, setOk] = useState(false);
  const [state, action] = useActionState<StartState, FormData>(startAICorrectionAction.bind(null, textId), null);
  const off = !preview.enabled || Boolean(preview.blocked);
  const cents = Math.max(1, Math.round(preview.costUsd * 100));
  return (
    <>
      <button type="button" className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"} w-full sm:w-auto`} disabled={off} onClick={() => dialog.current?.showModal()} data-testid="ki-korrigieren">
        <Sparkles size={16} aria-hidden /> {label}
      </button>
      {off && <p className="mt-1.5 text-[13px] text-ink-2">{preview.blocked ?? "Die KI ist nicht eingerichtet (kein API-Schlüssel). Du kannst den Text selbst korrigieren."}</p>}
      {state?.error && (
        <p className="mt-1.5 text-[13px] text-red" role="alert">
          {state.error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto w-[min(620px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-black/30" aria-labelledby={`ki-titel-${textId}`} data-testid="ki-freigabe">
        <form action={action} className="grid gap-4 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`ki-titel-${textId}`} className="text-[20px] font-semibold">
              Text an die KI senden?
            </h2>
            <button type="button" className="btn btn-ghost -mr-3 !px-3" aria-label="Schließen" onClick={() => dialog.current?.close()}>
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="grid gap-3 text-[15px]">
            <div>
              <p className="font-semibold">Gesendet wird</p>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                <li>
                  der Text dieser Fassung (<span className="num">{preview.words.toLocaleString("de-AT")}</span> Wörter); {preview.hidden} werden durch [Name] ersetzt
                </li>
                <li>Fach, Schulstufe, Textsorte und Aufgabenstellung</li>
                {preview.pictures && <li>die kurzen Bildbeschreibungen ({preview.pictures.length} Bilder), nicht die Bilder selbst</li>}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Nicht gesendet</p>
              <p className="text-ink-2">Name des Schülers, Notizen, Lernverlauf, Noten{preview.pictures ? ", die Bilder" : ""}.</p>
            </div>
            <p className="rounded-xl bg-panel px-4 py-3 text-[14px]">
              Empfänger: <b>{preview.provider}</b> · Modell <span className="font-mono text-[13px]">{preview.model}</span> · etwa <span className="num">{cents}</span> US-Cent
              <Info label="Info zum Datenschutz" align="right">
                Der Anbieter verarbeitet den Text, um die Korrektur zu erstellen. Vor dem Einsatz mit echten Schülertexten müssen Auftragsverarbeitung, Bedingungen des Anbieters und die Einwilligung (bzw. Rechtsgrundlage) geklärt sein. Ohne KI kannst du jederzeit selbst korrigieren.
              </Info>
            </p>
            <p className="text-[14px] text-amber">Andere Namen, Orte oder persönliche Angaben im Text (Freunde, Familie, Adressen) erkennt die App nicht. Bitte vorher durchsehen.</p>
            <details className="reveal">
              <summary>Gesendeten Text ansehen</summary>
              <div className="mt-2 max-h-[240px] overflow-y-auto rounded-xl border border-line px-4 py-3 text-[14px] whitespace-pre-wrap" data-testid="ki-vorschau">
                {preview.masked.map((m, i) => (
                  <p key={i} className="mb-2">
                    {m}
                  </p>
                ))}
                {preview.pictures && (
                  <div className="mt-3 border-t border-line pt-2 text-ink-2" data-testid="ki-vorschau-bilder">
                    {preview.pictures.map((c, i) => (
                      <p key={i}>{c}</p>
                    ))}
                  </div>
                )}
              </div>
            </details>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-4 py-2">
              <input type="checkbox" name="consent" value="1" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="ki-einwilligung" />
              <span>
                <ShieldCheck size={16} className="mr-1 inline text-green" aria-hidden />
                Ich habe den Text geprüft und gebe ihn für diese Korrektur frei.
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Submit disabled={!ok} />
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Abbrechen
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
