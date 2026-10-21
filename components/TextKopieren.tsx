"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A button that copies a prepared text, e.g. all open feedback to paste into a chat. */
export function TextKopieren({ text, label }: { text: string; label: string }) {
  const [stand, setStand] = useState<"ok" | "fehler" | null>(null);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStand("ok");
        } catch {
          setStand("fehler");
        }
        setTimeout(() => setStand(null), 2000);
      }}
    >
      {stand === "ok" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {stand === "ok" ? "Kopiert" : stand === "fehler" ? "Kopieren ging nicht" : label}
    </button>
  );
}
