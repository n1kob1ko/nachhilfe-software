"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewAnswerAction } from "@/app/learning-actions";
import { REVIEWS, type Review } from "@/lib/tasks";

const TONE: Record<Review, string> = {
  richtig: "border-green bg-green-wash text-green",
  teilweise: "border-amber bg-amber-wash text-amber",
  falsch: "border-red bg-red-wash text-red",
};

/**
 * Lehrerbewertung of one answer. Until the teacher picks one, a free answer counts nowhere; a correction keeps
 * the app's check. A grade can be changed later.
 */
export function ReviewButtons({ attemptId, review }: { attemptId: number; review: string | null }) {
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
            {REVIEWS[r]}
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
