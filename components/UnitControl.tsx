import Link from "next/link";
import { ExternalLink, Play, Presentation, Square } from "lucide-react";
import { cancelUnitAction, endUnitAction, startUnitAction } from "@/app/session-actions";
import { Pill, formatTime } from "@/components/ui";
import type { Student } from "@/lib/repo";
import { currentTeacher } from "@/lib/auth";
import { canManageUnit, runningUnitForStudent } from "@/lib/units";

/** Start / end a unit for one student. Starting writes the Basis-Dokumentation immediately. */
export async function UnitControl({ student, compact, onUnitPage }: { student: Student; compact?: boolean; onUnitPage?: boolean }) {
  const unit = runningUnitForStudent(student.id);
  const teacher = await currentTeacher();
  if (!unit) {
    return (
      <form action={startUnitAction.bind(null, student.id)}>
        <button className={`btn btn-primary ${compact ? "btn-sm" : ""}`}>
          <Play size={14} aria-hidden /> Einheit starten
        </button>
      </form>
    );
  }
  const mine = teacher ? canManageUnit(teacher, unit) : false;
  if (compact || !mine) {
    return (
      <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary btn-sm">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> läuft seit {formatTime(unit.started_at)}
        {unit.teacher_id !== teacher?.id && ` (${unit.teacher_name})`}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/tafel/${unit.id}`} className="btn btn-secondary">
        <Presentation size={14} aria-hidden /> Whiteboard
      </Link>
      <a href={`/lernen/${student.access_token}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
        <ExternalLink size={14} aria-hidden /> Übungsmodus öffnen
      </a>
      {!onUnitPage && (
        <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary">
          Live-Daten
        </Link>
      )}
      <form action={endUnitAction.bind(null, unit.id)}>
        <button className="btn btn-primary">
          <Square size={13} aria-hidden /> Einheit beenden
        </button>
      </form>
    </div>
  );
}

export function CancelUnit({ unitId }: { unitId: number }) {
  return (
    <details className="text-[14px]">
      <summary className="cursor-pointer text-ink-2 hover:text-ink">Einheit abbrechen …</summary>
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
