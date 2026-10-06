import { BRIEF_QUESTIONS, type UnitBrief } from "@/lib/summary";

/** The six questions after a unit, answered from the data; lines the teacher wrote are marked. */
export function UnitBriefView({ brief }: { brief: UnitBrief }) {
  return (
    <dl className="panel grid gap-x-6 gap-y-3 px-5 py-4 text-[15px] sm:grid-cols-[210px_minmax(0,1fr)]">
      {BRIEF_QUESTIONS.map(([key, question]) => (
        <div key={key} className="contents">
          <dt className="text-ink-2">{question}</dt>
          <dd>
            {brief[key].length === 0 ? (
              <span className="text-ink-3">–</span>
            ) : (
              <ul className="grid gap-0.5">
                {brief[key].map((l, i) => (
                  <li key={i} className={l.from === "lehrer" ? "text-ink-2" : "font-medium"}>
                    {l.text}
                    {l.from === "lehrer" && <span className="ml-1.5 text-[12px] text-ink-3">(deine Notiz)</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
