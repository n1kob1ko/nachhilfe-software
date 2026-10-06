"use client";

import { useState, useTransition } from "react";
import { Copy, Sparkles } from "lucide-react";
import { generateFamilyNoteAction, saveFamilyNoteAction, type NoteState } from "@/app/summary-actions";

const SOURCE_LABEL: Record<string, string> = { fakten: "aus den Fakten erstellt", ki: "von Claude formuliert, bitte prüfen", lehrer: "von dir geschrieben" };

/**
 * Note for parents or the student after a unit. "Aus den Fakten" works without AI; "Mit Claude
 * formulieren" sends only the data lines of the summary, without names.
 */
export function FamilyNote({ lessonId, initial, source, ai }: { lessonId: number; initial: string; source: string; ai: boolean }) {
  const [text, setText] = useState(initial);
  const [src, setSrc] = useState(source);
  const [audience, setAudience] = useState<"eltern" | "schueler">("eltern");
  const [state, setState] = useState<NoteState>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<NoteState>) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (r && r.note !== undefined) {
        setText(r.note);
        setSrc(r.source ?? "");
      }
    });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink-2">Für</span>
        {(["eltern", "schueler"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={audience === a}
            onClick={() => setAudience(a)}
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium ${audience === a ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
          >
            {a === "eltern" ? "Eltern" : "Schüler"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => generateFamilyNoteAction(lessonId, "fakten", audience))}>
          Aus den Fakten
        </button>
        {ai && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => generateFamilyNoteAction(lessonId, "ki", audience))} title="Claude bekommt nur die Fakten ohne Namen und ohne deine Notizen">
            <Sparkles size={14} aria-hidden /> Mit Claude formulieren
          </button>
        )}
      </div>
      <textarea className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Notiz für Eltern oder Schüler" placeholder="Noch keine Notiz." />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => saveFamilyNoteAction(lessonId, text))}>
          Speichern
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!text.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setState({ error: "Kopieren nicht möglich. Bitte den Text markieren und kopieren." });
            }
          }}
        >
          <Copy size={14} aria-hidden /> {copied ? "Kopiert" : "Kopieren"}
        </button>
        {src && SOURCE_LABEL[src] && <span className="text-[13px] text-ink-3">{SOURCE_LABEL[src]}</span>}
      </div>
      {state?.error && (
        <p className="text-[13px] text-red" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && !state.error && (
        <p className="text-[13px] text-green" role="status">
          {state.ok}
        </p>
      )}
    </div>
  );
}
