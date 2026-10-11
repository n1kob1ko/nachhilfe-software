"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { retryAICorrectionAction } from "@/app/correction-actions";

/**
 * „Erneut versuchen“ after a failed KI run: only on a click, never by itself. While it starts the button is off, and a
 * second click sends nothing; the server claims the run once as well (lib/text-correction.ts retryAICorrection).
 */
export function RetryButton({ correctionId, kind, cents }: { correctionId: number; kind: "pruefung" | "ganz"; cents: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const retry = () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    start(async () => {
      try {
        const res = await retryAICorrectionAction(correctionId);
        if (res?.error) setError(res.error);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };
  return (
    <div className="mt-2">
      <button type="button" className="btn btn-secondary" disabled={pending} onClick={retry} data-testid="erneut-versuchen">
        <RotateCcw size={16} aria-hidden /> {pending ? "Wird gestartet …" : "Erneut versuchen"}
      </button>
      <p className="mt-1 text-[13px] text-ink-2">
        {kind === "pruefung" ? (
          <>
            Nur die zweite Prüfung wird wiederholt, etwa <span className="num">{cents}</span> US-Cent. Die erste Prüfung wird nicht noch einmal bezahlt.
          </>
        ) : (
          <>
            Die KI-Korrektur wird noch einmal gestartet, etwa <span className="num">{cents}</span> US-Cent.
          </>
        )}
      </p>
      {error && (
        <p className="mt-1 text-[13px] text-red" role="alert" data-testid="erneut-fehler">
          {error}
        </p>
      )}
    </div>
  );
}
