import Link from "next/link";
import { Square } from "lucide-react";
import { endUnitAction } from "@/app/session-actions";
import { formatTime } from "@/components/ui";
import type { UnitView } from "@/lib/units";

/** Shown on every page while the logged-in teacher has a unit running. */
export function RunningUnits({ units }: { units: UnitView[] }) {
  if (units.length === 0) return null;
  return (
    <div className="no-print mb-6 grid gap-2">
      {units.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-accent/30 bg-accent-wash px-4 py-2.5 text-[14px]">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="min-w-0 flex-1">
            Einheit mit{" "}
            <Link href={`/schueler/${u.student_id}`} className="font-semibold hover:underline">
              {u.student_name}
            </Link>{" "}
            läuft seit <span className="num">{formatTime(u.started_at)}</span>
          </span>
          <form action={endUnitAction.bind(null, u.id)}>
            <button className="btn btn-primary btn-sm">
              <Square size={13} aria-hidden /> Einheit beenden
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
