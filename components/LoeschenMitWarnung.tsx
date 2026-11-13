"use client";

import { Trash2 } from "lucide-react";
import { WegForm } from "@/components/Meldung";

/**
 * Löschen auf der Seite der Sache selbst (eine Übung, ein Ergebnis, ein Referenz-Eintrag). Statt „Wirklich löschen?“:
 * die Seite wechselt gleich zur Liste (`danach`), dort fehlt die Zeile (`zeile`, wie sie in der Liste als `data-zeile`
 * steht), und unten steht sechs Sekunden „Rückgängig“. Erst danach wird gelöscht (components/Meldung.tsx).
 * Die Aktion darf nicht umleiten. „Archivieren“ daneben bleibt der Weg, der nichts verliert (lib/archiv.ts).
 */
export function LoeschenMitWarnung({ action, label, text, zeile, danach, className = "btn btn-danger" }: { action: () => Promise<unknown>; label: string; text: string; zeile: string; danach: string; className?: string }) {
  return (
    <WegForm action={action} zeile={zeile} text={text} danach={danach}>
      <button className={className}>
        <Trash2 size={15} aria-hidden /> {label}
      </button>
    </WegForm>
  );
}
