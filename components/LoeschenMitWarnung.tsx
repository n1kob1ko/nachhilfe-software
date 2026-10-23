"use client";

import { Trash2 } from "lucide-react";

/**
 * Löschen, das Antworten und Dokumentation mitnimmt: fragt vorher nach und nennt „Archivieren“ als den
 * Weg, der nichts verliert (lib/archiv.ts).
 */
export function LoeschenMitWarnung({ action, label, frage, className = "btn btn-danger" }: { action: () => Promise<void>; label: string; frage: string; className?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(frage)) e.preventDefault();
      }}
    >
      <button className={className}>
        <Trash2 size={15} aria-hidden /> {label}
      </button>
    </form>
  );
}
