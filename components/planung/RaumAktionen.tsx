"use client";

/**
 * Raum-Aktionen (portiert und neu gestaltet nach `DeleteRoomButton.tsx` der Tutoring-Plattform):
 * deaktivieren/aktivieren und — nur solange kein Platz auf den Raum zeigt — löschen.
 * Das Löschen fragt nach und lehnt serverseitig ab, sobald Plätze auf den Raum zeigen
 * (`lib/planung/aktionen.ts`), damit kein Platz ins Leere zeigt.
 */
import { setRoomActiveAction, deleteRoomAction } from "@/app/planung-actions";
import { Power, Trash2 } from "lucide-react";

export function RaumAktionen({ roomId, active, verweise, zurueck }: { roomId: number; active: boolean; verweise: number; zurueck: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setRoomActiveAction.bind(null, roomId, !active)}>
        <input type="hidden" name="zurueck" value={zurueck} />
        <button className="btn btn-secondary btn-sm">
          <Power size={15} aria-hidden /> {active ? "Deaktivieren" : "Aktivieren"}
        </button>
      </form>
      {verweise === 0 ? (
        <form
          action={deleteRoomAction.bind(null, roomId)}
          onSubmit={(e) => {
            if (!confirm("Diesen Raum endgültig löschen? Er wird von keiner geplanten Einheit verwendet.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="zurueck" value={zurueck} />
          <button className="btn btn-danger btn-sm border border-red/30">
            <Trash2 size={15} aria-hidden /> Löschen
          </button>
        </form>
      ) : (
        <span className="text-[13px] text-ink-3">wird verwendet – nur deaktivierbar</span>
      )}
    </div>
  );
}
