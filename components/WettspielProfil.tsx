import { Swords } from "lucide-react";
import { spielprofilLoeschenAction, wettspielSetzenAction } from "@/app/wettspiel-actions";
import { ligaTabelle } from "@/lib/liga";
import type { Student } from "@/lib/repo";
import { AB_SCHULSTUFE, BILDER, erlaubnis, profilVon, wettspielEinstellung, type Wettspiel } from "@/lib/spielprofil";

/**
 * Im Profil unter Lernstand: ob der Schüler bei Wochenliga und Duellen mitmachen darf (lib/spielprofil.ts). Standard:
 * ab der 9. Schulstufe; Jüngere erst mit „Erlaubt“, wenn die Eltern einverstanden sind. Dazu sein Spitzname, damit der
 * Lehrer ihn in der Liga wiedererkennt, und „Zurücksetzen“, falls ein Name nicht passt.
 */
export function WettspielProfil({ student }: { student: Student }) {
  const e = wettspielEinstellung(student.id);
  const darf = erlaubnis(student).darf;
  const p = profilVon(student.id);
  const liga = p?.liga && darf ? ligaTabelle(student) : null;
  const ich = liga?.zeilen.find((z) => z.ich);
  const first = student.name.split(" ")[0];
  const wahl: { wert: Wettspiel; text: string }[] = [
    { wert: "", text: `Standard (ab ${AB_SCHULSTUFE}. Schulstufe)` },
    { wert: "ja", text: "Erlaubt (Eltern einverstanden)" },
    { wert: "nein", text: "Aus" },
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
            : `${first} darf mitmachen, hat aber noch keinen Spielnamen gewählt.`
          : `${first} spielt nur allein. Andere sehen nie den echten Namen, nur einen Spitznamen aus einer Liste.`}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Liga und Duelle erlauben">
        {wahl.map((w) => (
          <form key={w.wert || "standard"} action={wettspielSetzenAction.bind(null, student.id, w.wert)}>
            <button
              type="submit"
              aria-pressed={e === w.wert}
              className={`min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold ${e === w.wert ? "bg-ink text-surface" : "bg-panel text-ink hover:bg-line"}`}
            >
              {w.text}
            </button>
          </form>
        ))}
        {p && (
          <form action={spielprofilLoeschenAction.bind(null, student.id)}>
            <button type="submit" className="min-h-[40px] px-2 text-[14px] font-medium text-accent hover:underline">
              Spielnamen zurücksetzen
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
