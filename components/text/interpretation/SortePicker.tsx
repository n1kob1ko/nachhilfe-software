import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SORTE_KEYS, SORTEN } from "@/lib/schreibauftrag";
import { umfangVorgabe } from "@/lib/schreibauftrag-umfang";
import { wordRange } from "@/lib/textinterpretation";

/**
 * The Textsorten of the SRDP to choose from, each with what it is and its default length (for the student's
 * Schulstufe, when known). `pruefung`: the Auftrag will belong to this Prüfung.
 */
export function SortePicker({ base, stufe, pruefung }: { base: string; stufe?: number | null; pruefung?: number }) {
  return (
    <ul className="panel divide-y divide-line" data-testid="textsorten">
      {SORTE_KEYS.map((k) => {
        const s = SORTEN[k];
        const { min, max } = wordRange(stufe === undefined ? s.target : umfangVorgabe(k, stufe).target);
        return (
          <li key={k}>
            <Link href={`${base}?sorte=${k}${pruefung ? `&pruefung=${pruefung}` : ""}`} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-panel" data-testid={`sorte-${k}`}>
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
