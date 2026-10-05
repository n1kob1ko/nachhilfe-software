import Link from "next/link";
import { Play } from "lucide-react";
import { cancelUnitAction, startUnitAction } from "@/app/session-actions";
import { Pill, formatTime } from "@/components/ui";
import type { Student } from "@/lib/repo";
import { currentTeacher } from "@/lib/auth";
import { runningUnitForStudent } from "@/lib/units";

/** Starts a unit for one student, or leads into the one already running. Ending happens inside the unit. */
export async function UnitControl({ student, size = "lg" }: { student: Student; size?: "lg" | "md" }) {
  const unit = runningUnitForStudent(student.id);
  const teacher = await currentTeacher();
  const cls = size === "lg" ? "btn-lg" : "";
  if (!unit) {
    return (
      <form action={startUnitAction.bind(null, student.id)}>
        <button className={`btn btn-primary ${cls}`}>
          <Play size={size === "lg" ? 18 : 15} aria-hidden /> Einheit starten
        </button>
      </form>
    );
  }
  return (
    <Link href={`/einheiten/${unit.id}`} className={`btn btn-primary ${cls}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden /> Einheit läuft seit {formatTime(unit.started_at)}
      {unit.teacher_id !== teacher?.id && ` (${unit.teacher_name})`}
    </Link>
  );
}

export function CancelUnit({ unitId }: { unitId: number }) {
  return (
    <details className="text-[14px]">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-ink-2 hover:text-ink">Einheit abbrechen (z. B. Schüler nicht erschienen) …</summary>
      <form action={cancelUnitAction.bind(null, unitId)} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="field min-w-[220px] flex-1">
          <span className="label">Grund</span>
          <input className="input" name="reason" placeholder="z. B. Schüler nicht erschienen" />
        </label>
        <button className="btn btn-danger">Abbrechen</button>
      </form>
      <p className="mt-1 text-[12px] text-ink-3">Abgebrochene Einheiten bleiben im Protokoll, werden aber nicht abgerechnet.</p>
    </details>
  );
}

export function UnitStatusPill({ status }: { status: string }) {
  return status === "gestartet" ? <Pill tone="accent">läuft</Pill> : status === "beendet" ? <Pill tone="green">beendet</Pill> : <Pill tone="red">abgebrochen</Pill>;
}
