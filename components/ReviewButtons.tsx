"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewAnswerAction } from "@/app/learning-actions";
import { punkteText } from "@/lib/probeschularbeit-regeln";
import { REVIEWS, type Review } from "@/lib/tasks";

const TONE: Record<Review, string> = {
  richtig: "border-green bg-green-wash text-green",
  teilweise: "border-amber bg-amber-wash text-amber",
  falsch: "border-red bg-red-wash text-red",
};

/** „Zu bewerten“ (lib/zu-bewerten.ts): kurz und mit Großbuchstaben, wie die Knöpfe beim Papier. */
const KURZ: Record<Review, string> = { richtig: "Richtig", teilweise: "Teilweise", falsch: "Falsch" };

/** Die Punkte, die eine Bewertung bringt: alle, die Hälfte (wie lib/blatt-regeln.ts erreichtVon), keine. */
const punkteFuer = (r: Review, max: number) => (r === "richtig" ? max : r === "teilweise" ? Math.round(max) / 2 : 0);

/**
 * Lehrerbewertung of one answer. Until the teacher picks one, a free answer counts nowhere; a correction keeps
 * the app's check. A grade can be changed later. `kurz` (the list „Zu bewerten“): Richtig / Teilweise / Falsch, with the
 * points each brings where the task has points (`max`).
 */
export function ReviewButtons({ attemptId, review, kurz = false, max = null }: { attemptId: number; review: string | null; kurz?: boolean; max?: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(review);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (next: Review) =>
    start(async () => {
      const before = value;
      setValue(next);
      setError(null);
      const res = await reviewAnswerAction(attemptId, next);
      if ("error" in res) {
        setValue(before);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  return (
    <div className="no-print">
      <div role="group" aria-label="Deine Bewertung" className="inline-flex flex-wrap gap-1.5">
        {(Object.keys(REVIEWS) as Review[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            aria-pressed={value === r}
            onClick={() => save(r)}
            className={`btn btn-sm min-h-[44px] border ${value === r ? TONE[r] : "border-line-strong bg-surface text-ink-2"}`}
          >
            {kurz ? KURZ[r] : REVIEWS[r]}
            {max != null && <span className="num font-normal">· {punkteText(punkteFuer(r, max))} P.</span>}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-red">
          {error}
        </p>
      )}
    </div>
  );
}
