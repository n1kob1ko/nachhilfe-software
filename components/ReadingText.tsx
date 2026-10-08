import { paragraphsOf, wordCount } from "@/lib/lesen";

/**
 * A reading text the way a school sheet shows it: the title, then the paragraphs with their number in the
 * margin, so questions ("im 3. Abschnitt") and Belege can point at them.
 */
export function ReadingTextView({ title, text, size = "md", meta = false, lang = "de" }: { title: string; text: string; size?: "md" | "lg"; meta?: boolean; lang?: string }) {
  const ps = paragraphsOf(text);
  return (
    <article className="lesetext" lang={lang}>
      {title && <h2 className={`mb-3 font-semibold tracking-[-0.01em] ${size === "lg" ? "text-[22px]" : "text-[19px]"}`}>{title}</h2>}
      {meta && (
        <p className="num mb-3 text-[12.5px] text-ink-3">
          {wordCount(text)} Wörter · {ps.length} {ps.length === 1 ? "Abschnitt" : "Abschnitte"}
        </p>
      )}
      <div className={`grid gap-3.5 ${size === "lg" ? "text-[17.5px] leading-[1.7]" : "text-[16px] leading-[1.65]"}`}>
        {ps.map((p, i) => (
          <p key={i} id={`absatz-${i + 1}`} className="relative max-w-[68ch] pl-8">
            <span className="num absolute top-[0.2em] left-0 w-6 text-right text-[12px] font-semibold text-ink-3 select-none" aria-label={`Abschnitt ${i + 1}`}>
              {i + 1}
            </span>
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
