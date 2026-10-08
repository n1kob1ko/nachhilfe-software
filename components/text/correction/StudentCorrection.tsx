import { ChevronDown } from "lucide-react";
import { sharedCorrection } from "@/lib/text-correction";
import { categoryLabel } from "@/lib/text-correction-rules";

/**
 * On the student's laptop or tablet: the corrections the teacher accepted and chose to show, each with
 * what was written, the better version and why. Read only; the student improves the text in the editor.
 */
export function StudentCorrection({ textId, large }: { textId: number; large?: boolean }) {
  const shared = sharedCorrection(textId);
  if (!shared || !shared.items.length) return null;
  const places = shared.items.filter((i) => i.kind !== "hinweis" && i.quote);
  const notes = shared.items.filter((i) => i.kind === "hinweis" || !i.quote);
  return (
    <details open className="reveal mb-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]" data-testid="schueler-korrektur">
      <summary className={`font-semibold ${large ? "text-[18px]" : "text-[16px]"}`}>
        <ChevronDown size={16} aria-hidden className="reveal-chevron" />
        Korrektur: {places.length} {places.length === 1 ? "Stelle" : "Stellen"} zum Verbessern
      </summary>
      <ol className={`mt-3 grid max-h-[45vh] gap-3 overflow-y-auto pr-1 ${large ? "text-[17px]" : "text-[15px]"}`}>
        {places.map((i, n) => (
          <li key={i.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
            <span className="num pt-0.5 text-[13px] font-semibold text-ink-3">{n + 1}.</span>
            <div>
              <p>
                <span className="text-ink-2 line-through decoration-red/60">{i.quote}</span> → <b className="text-green">{i.replacement || "streichen"}</b>
                <span className="ml-2 text-[13px] text-ink-3">
                  {categoryLabel(i.category)}
                  {i.kind === "stil" ? ", Vorschlag" : ""}
                </span>
              </p>
              {i.explanation && <p className="text-ink-2">{i.explanation}</p>}
            </div>
          </li>
        ))}
      </ol>
      {notes.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[14px] font-semibold">Zum ganzen Text</p>
          <ul className="mt-1 list-disc pl-5 text-[15px] text-ink-2">
            {notes.map((i) => (
              <li key={i.id}>{i.explanation}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
