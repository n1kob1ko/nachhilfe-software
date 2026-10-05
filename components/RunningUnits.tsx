import Link from "next/link";
import { ArrowRight, Presentation, Square } from "lucide-react";
import { endUnitAction } from "@/app/session-actions";
import { Elapsed } from "@/components/Elapsed";
import { HideOn } from "@/components/HideOn";
import { formatTime } from "@/components/ui";
import type { UnitView } from "@/lib/units";

export type RunningUnit = UnitView & { open_exercises: number };

/**
 * Shown at the top of every page while the logged-in teacher has a unit running. Everything comes
 * from the database, so it survives reloads, a closed browser and logging in again on another device.
 */
export function RunningUnits({ units }: { units: RunningUnit[] }) {
  if (units.length === 0) return null;
  // the overview shows the running unit in its large card instead
  return (
    <HideOn paths={["/"]}>
    <div className="no-print sticky top-0 z-20 -mx-4 mb-6 grid gap-2 bg-paper/90 px-4 pt-2 pb-1 backdrop-blur md:-mx-8 md:px-8" role="region" aria-label="Aktive Einheiten">
      {units.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[linear-gradient(100deg,#fde3cf,#fbd2b4)] px-4 py-2.5 text-[14px] shadow-[var(--shadow-card)]">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-bright opacity-50 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-bright" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ink-2">Aktive Einheit: </span>
            <Link href={`/schueler/${u.student_id}`} className="font-semibold hover:underline">
              {u.student_name}
            </Link>
            {u.subject && <span> – {u.subject}</span>} – seit <span className="num">{formatTime(u.started_at)}</span>
            <span className="text-ink-2">
              {" "}
              (<Elapsed since={u.started_at} />
              {u.open_exercises > 0 && `, ${u.open_exercises} ${u.open_exercises === 1 ? "Übung" : "Übungen"} offen`})
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            <Link href={`/tafel/${u.id}`} className="btn btn-secondary btn-sm">
              <Presentation size={13} aria-hidden /> Whiteboard
            </Link>
            <Link href={`/einheiten/${u.id}`} className="btn btn-secondary btn-sm">
              Einheit öffnen <ArrowRight size={13} aria-hidden />
            </Link>
            <form action={endUnitAction.bind(null, u.id)}>
              <button className="btn btn-primary btn-sm">
                <Square size={13} aria-hidden /> Einheit beenden
              </button>
            </form>
          </span>
        </div>
      ))}
    </div>
    </HideOn>
  );
}
