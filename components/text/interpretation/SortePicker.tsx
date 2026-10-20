import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SORTE_KEYS, SORTEN } from "@/lib/schreibauftrag";
import { wordRange } from "@/lib/textinterpretation";

/** The Textsorten of the SRDP to choose from, each with what it is and its default length. */
export function SortePicker({ base }: { base: string }) {
  return (
    <ul className="panel divide-y divide-line" data-testid="textsorten">
      {SORTE_KEYS.map((k) => {
        const s = SORTEN[k];
        const { min, max } = wordRange(s.target);
        return (
          <li key={k}>
            <Link href={`${base}?sorte=${k}`} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-panel" data-testid={`sorte-${k}`}>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{s.name}</span>
                <span className="block text-[14px] text-ink-2">{s.beschreibung}</span>
              </span>
              <span className="num shrink-0 text-[13px] text-ink-2">
                {min} bis {max} Wörter
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
