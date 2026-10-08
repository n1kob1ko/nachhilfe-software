import { markStudentText, type Mark } from "@/lib/fix-text";

/** A text with marked words: corrected (green), still or newly wrong (red). Spaces as written. */
export function Marked({ marks, className = "" }: { marks: Mark[]; className?: string }) {
  return (
    <p className={`whitespace-pre-line ${className}`}>
      {marks.map((m, i) => (
        <span key={i}>
          {i > 0 && (m.pre || (/^[.,;:!?)\]]$/.test(m.text) ? "" : " "))}
          {m.kind === "same" ? m.text : <span className={m.kind === "fixed" ? "fx-fixed" : "fx-wrong"}>{m.text}</span>}
        </span>
      ))}
    </p>
  );
}

/** Fehler korrigieren, after the answer: the student's text next to the right one, the differences marked. */
export function FixCompare({ faulty, given, expected, caseSensitive = true, className = "" }: { faulty: string; given: string; expected: string; caseSensitive?: boolean; className?: string }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-2">Deine Fassung</p>
        <Marked marks={markStudentText(faulty, expected, given, caseSensitive)} className="mt-1 text-[16px] leading-relaxed" />
      </div>
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-[13px] font-semibold text-ink-2">Richtig</p>
        <Marked marks={markStudentText(faulty, expected, expected, caseSensitive)} className="mt-1 text-[16px] leading-relaxed" />
      </div>
    </div>
  );
}
