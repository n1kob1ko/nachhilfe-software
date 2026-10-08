import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Elapsed } from "@/components/Elapsed";
import { HideOn } from "@/components/HideOn";
import { formatTime } from "@/components/ui";
import type { UnitView } from "@/lib/units";

export type RunningUnit = UnitView & { open_exercises: number };

/**
 * While the teacher has a unit running, every page says so at the top, with one way back into it.
 * Hidden on the start page (its main card shows the unit), inside the unit itself and on a Textarbeit
 * (its writing toolbar sits at the top; the page links back to the unit).
 */
export function RunningUnits({ units }: { units: RunningUnit[] }) {
  if (units.length === 0) return null;
  return (
    <HideOn paths={["/", ...units.map((u) => `/einheiten/${u.id}`)]} prefixes={["/texte/"]}>
      <div className="no-print sticky top-0 z-20 -mx-4 mb-6 grid gap-2 bg-paper/90 px-4 pt-2 pb-1 backdrop-blur md:-mx-8 md:px-8" role="region" aria-label="Aktive Einheiten">
        {units.map((u) => (
          <Link
            key={u.id}
            href={`/einheiten/${u.id}`}
            className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-accent px-4 py-2 text-[15px] text-white shadow-[var(--shadow-card)] transition-colors hover:bg-accent-hover"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">Einheit mit {u.student_name.split(" ")[0]}</span> – seit <span className="num">{formatTime(u.started_at)}</span>
              <span className="hidden opacity-85 sm:inline">
                {" "}
                (<Elapsed since={u.started_at} />)
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold">
              Zur Einheit <ArrowRight size={16} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </HideOn>
  );
}
