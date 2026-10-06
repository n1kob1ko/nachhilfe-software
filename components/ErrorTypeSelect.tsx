"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { setErrorTypeAction } from "@/app/learning-actions";
import { ERROR_TYPES, errorTypeLabel } from "@/lib/error-types";

/**
 * Fehlerart of one wrong answer. A suggestion of the app is shown as such and can be confirmed with
 * one tap or changed; what the teacher picks is stored as their decision (error_type_source = lehrer).
 */
export function ErrorTypeSelect({ attemptId, type, source, suggested }: { attemptId: number; type: string | null; source: string | null; suggested: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(type ?? "");
  const [src, setSrc] = useState(source);
  const [pending, start] = useTransition();
  const save = (next: string) =>
    start(async () => {
      setValue(next);
      const res = await setErrorTypeAction(attemptId, next);
      if ("ok" in res) {
        setSrc(next ? "lehrer" : null);
        router.refresh();
      }
    });
  const unconfirmed = value && src !== "lehrer";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        className={`min-h-[36px] rounded-md border px-2 text-[13px] ${unconfirmed ? "border-dashed border-line-strong bg-surface text-ink-2" : value ? "border-amber/40 bg-amber-wash text-amber" : "border-line bg-surface text-ink-3"}`}
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        aria-label="Fehlerart"
        title={src === "lehrer" && suggested && suggested !== value ? `Vorschlag der App war: ${errorTypeLabel(suggested)}` : undefined}
      >
        <option value="">Fehlerart …</option>
        {ERROR_TYPES.map((e) => (
          <option key={e.key} value={e.key}>
            {e.label}
          </option>
        ))}
      </select>
      {unconfirmed && (
        <>
          <span className="text-[12px] text-ink-3">{src === "ki" ? "KI-Vorschlag" : "Vorschlag"}</span>
          <button type="button" onClick={() => save(value)} disabled={pending} className="btn btn-ghost btn-sm !min-h-[36px] !px-2" aria-label={`Fehlerart ${errorTypeLabel(value)} bestätigen`} title="Bestätigen">
            <Check size={14} aria-hidden />
          </button>
        </>
      )}
    </span>
  );
}
