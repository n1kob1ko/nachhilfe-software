"use client";

import { useFormStatus } from "react-dom";

/** Ein Knopf in „Hausübung vorbereitet“ (components/Hausuebung.tsx): zeigt, dass die Aktion läuft, und ist dann gesperrt. */
export function HausuebungKnopf({ label, laeuft = "Einen Moment …", art = "secondary", gesperrt = false, testid, icon, klein = false }: { label: string; laeuft?: string; art?: "primary" | "secondary" | "ghost"; gesperrt?: boolean; testid?: string; icon?: React.ReactNode; klein?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn btn-${art} ${klein ? "btn-sm" : ""} ${art === "primary" && !klein ? "btn-lg" : ""}`} style={{ whiteSpace: "normal", textAlign: "center" }} disabled={pending || gesperrt} data-testid={testid}>
      {icon} {pending ? laeuft : label}
    </button>
  );
}
