import { Shapes } from "lucide-react";
import { spielUebersicht } from "@/lib/lernspiele";
import { SPIEL_ARTEN, SPIEL_TITEL } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";

/**
 * Im Profil unter Lernstand: was der Schüler in den letzten 30 Tagen gespielt hat (lib/lernspiele.ts) und welche
 * Lösungen öfter falsch waren. Ohne Runden steht hier nichts. Eine Runde zählt im Lernstand wie eine Stunde.
 */
export function LernspieleProfil({ studentId, name }: { studentId: number; name: string }) {
  const u = spielUebersicht(studentId, wienerDatum());
  if (!u.runden.length) return null;
  const tage = new Set(u.runden.map((r) => r.tag)).size;
  return (
    <section aria-labelledby="lernspiele-titel" data-testid="profil-lernspiele">
      <h2 id="lernspiele-titel" className="mb-3 flex items-center gap-2 text-[17px] font-semibold">
        <Shapes size={18} className="text-[var(--deutsch-fg)]" aria-hidden /> Lernspiele
      </h2>
      <p className="mb-4 text-[14px] text-ink-2">
        {name} hat in den letzten 30 Tagen {u.runden.length === 1 ? "eine Runde" : `${u.runden.length} Runden`} an {tage === 1 ? "einem Tag" : `${tage} Tagen`} gespielt. Gezählt wird
        die erste Antwort je Karte; eine Runde zählt im Lernstand so viel wie eine Stunde.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SPIEL_ARTEN.map((art) => {
          const r = u.runden.filter((x) => x.art === art);
          if (!r.length) return null;
          const richtig = r.reduce((s, x) => s + x.richtig, 0);
          const alle = r.reduce((s, x) => s + x.anzahl, 0);
          return (
            <div key={art} className="panel p-4">
              <p className="text-[14px] font-semibold">{SPIEL_TITEL[art]}</p>
              <p className="num mt-1 text-[22px] font-semibold">{alle ? Math.round((richtig / alle) * 100) : 0}&nbsp;%</p>
              <p className="text-[13px] text-ink-3">
                {r.length === 1 ? "1 Runde" : `${r.length} Runden`} · zuletzt {r[0].tag.split("-").reverse().slice(0, 2).join(".")}.
              </p>
            </div>
          );
        })}
      </div>
      {u.fehler.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[14px] text-ink-2">Öfter falsch (richtige Lösung):</p>
          <ul className="flex flex-wrap gap-2">
            {u.fehler.map((f) => (
              <li key={f.loesung} className="rounded-full bg-panel px-3 py-1 text-[14px]">
                {f.loesung}
                {f.mal > 1 && <span className="ml-1.5 text-ink-3">{f.mal}×</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
