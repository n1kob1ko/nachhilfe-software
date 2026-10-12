/**
 * Raum anlegen oder ändern (portiert und neu gestaltet nach `RoomForm.tsx` der Tutoring-Plattform).
 * Gebäude, Name und ob vor Ort oder online. Nur die Verwaltung sieht dieses Formular.
 */
import { saveRoomAction } from "@/app/planung-actions";
import { Save } from "lucide-react";
import type { Raum } from "@/lib/planung/repo";

const GEBAEUDE_VORSCHLAG = ["Hauptgebäude", "Nebengebäude", "Online"];

export function RaumForm({ raum, gebaeude, zurueck }: { raum?: Raum; gebaeude?: string[]; zurueck: string }) {
  const vorschlaege = [...new Set([...(gebaeude ?? []), ...GEBAEUDE_VORSCHLAG])];
  const listenId = `gebaeude-liste-${raum?.id ?? "neu"}`;
  return (
    <form action={saveRoomAction} className="grid gap-4">
      <input type="hidden" name="zurueck" value={zurueck} />
      {raum && <input type="hidden" name="id" value={raum.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
        <label className="field">
          <span className="label">Gebäude</span>
          <input className="input" name="building" list={listenId} required maxLength={80} defaultValue={raum?.building ?? "Hauptgebäude"} />
          <datalist id={listenId}>
            {vorschlaege.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="label">Raumname</span>
          <input className="input" name="name" required maxLength={80} defaultValue={raum?.name} placeholder="z. B. Gruppe 2" autoFocus={!raum} />
        </label>
        <label className="field">
          <span className="label">Art</span>
          <select className="input" name="mode" defaultValue={raum?.mode ?? "vor_ort"}>
            <option value="vor_ort">vor Ort</option>
            <option value="online">online</option>
          </select>
        </label>
      </div>
      <div>
        <button className="btn btn-primary btn-sm">
          <Save size={15} aria-hidden /> {raum ? "Raum speichern" : "Raum anlegen"}
        </button>
      </div>
    </form>
  );
}
