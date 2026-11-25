import { Swords } from "lucide-react";
import { spielprofilLoeschenAction, wettspielSetzenAction } from "@/app/wettspiel-actions";
import { ligaTabelle } from "@/lib/liga";
import type { Student } from "@/lib/repo";
import { BILDER, erlaubnis, profilVon, spielName, wettspielEinstellung, type Wettspiel } from "@/lib/spielprofil";

/**
 * Im Profil unter Lernstand: ob der Schüler bei Wochenliga und Duellen mitmachen darf (lib/spielprofil.ts), für alle
 * an, „Aus“ sperrt es. Andere sehen seinen Namen („Max M.“) und sein Tierbild; „Zurücksetzen“ setzt Bild und Schalter zurück.
 */
export function WettspielProfil({ student }: { student: Student }) {
  const e = wettspielEinstellung(student.id);
  const darf = erlaubnis(student).darf;
  const p = profilVon(student.id);
  const liga = p?.liga && darf ? ligaTabelle(student) : null;
  const ich = liga?.zeilen.find((z) => z.ich);
  const first = student.name.split(" ")[0];
  // für alle erlaubt (niko 2026-11-16); „ja“ von früher zählt wie „An“
  const wahl: { wert: Wettspiel; text: string; an: boolean }[] = [
    { wert: "", text: "An", an: e !== "nein" },
    { wert: "nein", text: "Aus", an: e === "nein" },
  ];
  return (
    <section aria-labelledby="wettspiel-titel" data-testid="profil-wettspiel">
      <h2 id="wettspiel-titel" className="mb-2 flex items-center gap-2 text-[17px] font-semibold">
        <Swords size={18} className="text-accent" aria-hidden /> Liga und Duelle
      </h2>
      <p className="mb-3 text-[14px] text-ink-2">
        {darf
          ? p
            ? `${first} spielt als ${BILDER[p.bild] ?? ""} ${p.name}${ich && liga ? `, diese Woche Platz ${ich.platz} in der ${liga.stufenName}-Liga mit ${ich.punkte} Punkten` : ""}.`
            : `${first} darf mitmachen und steht mit den ersten Blockwerk-Punkten als „${spielName(student.name)}“ in der Bestenliste.`
          : `${first} spielt nur allein (ausgeschaltet) und steht in keiner Bestenliste.`}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Liga und Duelle erlauben">
        {wahl.map((w) => (
          <form key={w.wert || "standard"} action={wettspielSetzenAction.bind(null, student.id, w.wert)}>
            <button
              type="submit"
              aria-pressed={w.an}
              className={`treffer min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold ${w.an ? "bg-ink text-surface" : "bg-panel text-ink hover:bg-line"}`}
            >
              {w.text}
            </button>
          </form>
        ))}
        {p && (
          <form action={spielprofilLoeschenAction.bind(null, student.id)}>
            <button type="submit" className="treffer min-h-[40px] px-2 text-[14px] font-medium text-accent hover:underline">
              Spielprofil zurücksetzen
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
