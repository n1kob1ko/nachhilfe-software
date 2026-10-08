"use client";

import { useRef, useState } from "react";
import { Download, LogOut } from "lucide-react";
import { saveTextFile } from "@/components/text/save-file";
import { DISCARD_FLAG, readDrafts, removeDraft } from "./drafts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Abmelden": first everything is saved (texts are saved right away), then the access ends, the cookie
 * is removed and nothing of the unit stays on this laptop. Without a connection the student chooses:
 * wait, or sign out and drop what is not saved.
 */
export function LeaveButton({ textIds, label = "Abmelden" }: { textIds: number[]; label?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"bereit" | "speichert" | "offen">("bereit");

  const unsaved = () => {
    const editors = [...document.querySelectorAll('[data-testid="text-editor"]')];
    return editors.some((e) => e.getAttribute("data-status") !== "gespeichert") || readDrafts().some((d) => textIds.includes(d.textId));
  };
  const submit = () => {
    document.documentElement.dataset.leaving = "1";
    form.current?.requestSubmit();
  };

  const leave = async () => {
    setState("speichert");
    window.dispatchEvent(new Event("lernheft-save-now"));
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      if (!unsaved()) return submit();
    }
    setState("offen");
  };

  // before signing out without a connection: the unsaved texts as files on this laptop
  const keepFiles = () => {
    for (const d of readDrafts()) if (textIds.includes(d.textId)) saveTextFile(d.title, d.body);
  };

  const drop = () => {
    try {
      sessionStorage.setItem(DISCARD_FLAG, "1");
    } catch {
      // the next page cleans up by age then
    }
    textIds.forEach(removeDraft);
    submit();
  };

  return (
    <div className="relative">
      <form ref={form} method="post" action="/mitmachen/abmelden">
        <button type="button" className="btn btn-secondary" onClick={() => void leave()} disabled={state === "speichert"}>
          <LogOut size={16} aria-hidden /> {state === "speichert" ? "Wird gespeichert …" : label}
        </button>
      </form>
      {state === "offen" && (
        <div role="alert" className="absolute right-0 z-30 mt-2 w-[min(90vw,360px)] rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
          <p className="text-[15px] font-semibold">Noch nicht alles gespeichert</p>
          <p className="mt-1 text-[14px] text-ink-2">
            Gerade fehlt die Verbindung. Warte kurz, dann wird dein Text gespeichert. Wenn du gehen musst, sichere ihn vorher als Datei.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void leave()}>
              Nochmal versuchen
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={keepFiles}>
              <Download size={14} aria-hidden /> Als Datei sichern
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setState("bereit")}>
              Weiterarbeiten
            </button>
            <button type="button" className="btn btn-ghost btn-sm text-red" onClick={drop}>
              Trotzdem abmelden, Ungespeichertes löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
