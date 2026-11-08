"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { PaketStand } from "@/app/uebungspaket-actions";

function Knopf({ text, laeuft, testId }: { text: string; laeuft: string; testId: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-lg" disabled={pending} data-testid={testId}>
      {pending ? laeuft : text}
    </button>
  );
}

/** Ein Formular mit Server-Aktion, das während der KI-Anfrage „läuft“ zeigt und einen Fehler in einem Satz. */
export function PaketFormular({ action, children, text, laeuft, testId }: { action: (prev: PaketStand, fd: FormData) => Promise<PaketStand>; children: ReactNode; text: string; laeuft: string; testId: string }) {
  const [stand, run] = useActionState<PaketStand, FormData>(action, null);
  return (
    <form action={run} className="grid gap-5">
      {children}
      {stand?.error && (
        <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red">
          {stand.error}
        </p>
      )}
      <div>
        <Knopf text={text} laeuft={laeuft} testId={testId} />
      </div>
    </form>
  );
}
