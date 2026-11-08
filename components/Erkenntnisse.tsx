import Link from "next/link";
import { Check, Package, RotateCcw } from "lucide-react";
import { erkenntnisStatusAction } from "@/app/erkenntnis-actions";
import { datumKurz } from "@/lib/datum";
import { errorTypeLabel } from "@/lib/error-types";
import { listErkenntnisse, type Erkenntnis } from "@/lib/erkenntnisse";
import * as repo from "@/lib/repo";
import { paketErgebnis, paketeVon } from "@/lib/uebungspaket";

const QUELLE: Record<Erkenntnis["quelle"], string> = { einheit: "Einheit", blatt: "Blatt", paket: "Übungspaket" };

/**
 * Die **Erkenntnisse** eines Schülers im Profil (Fortschritt): offene Fehlermuster mit Fähigkeit, Fehlerart und Herkunft,
 * die Stärken und, zugeklappt, was schon erledigt ist. Ein Tippen setzt einen Fehler auf erledigt oder wieder offen.
 * Darunter die Übungspakete (lib/uebungspaket.ts) mit Ergebnis und „Auswerten“, darüber „Übungspaket erstellen“.
 */
export function Erkenntnisse({ studentId }: { studentId: number }) {
  const alle = listErkenntnisse(studentId);
  const pakete = paketeVon(studentId).slice(0, 5);
  if (!alle.length && !pakete.length) return null;
  const offen = alle.filter((e) => e.art === "fehler" && e.status === "offen");
  const staerken = alle.filter((e) => e.art === "staerke").slice(0, 6);
  const erledigt = alle.filter((e) => e.art === "fehler" && e.status === "erledigt");
  const skill = (id: string | null) => (id ? repo.getSkill(id)?.name : null);
  return (
    <section aria-labelledby="erkenntnisse-titel" data-testid="erkenntnisse">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="erkenntnisse-titel" className="gruppe-titel">
          Erkenntnisse
        </h2>
        {offen.length > 0 && (
          <Link href={`/schueler/${studentId}/paket`} className="btn btn-primary btn-sm" data-testid="paket-neu">
            <Package size={16} aria-hidden /> Übungspaket erstellen
          </Link>
        )}
      </div>
      {offen.length ? (
        <ul className="grid gap-2">
          {offen.map((e) => (
            <Zeile key={e.id} e={e} skill={skill(e.skill_id)} studentId={studentId} />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-3">Keine offenen Fehler.</p>
      )}
      {staerken.length > 0 && (
        <p className="mt-3 text-[14px] text-ink-2">
          <span className="font-semibold text-green">Gut: </span>
          {staerken.map((e) => e.text).join(" · ")}
        </p>
      )}
      {pakete.length > 0 && (
        <ul className="mt-4 grid gap-1.5" data-testid="pakete">
          {pakete.map((p) => {
            const e = paketErgebnis(p.id);
            const stand = p.paket.ausgewertetAm ? "ausgewertet" : e.beantwortet ? "auswerten" : p.status === "entwurf" ? "Entwurf" : "noch nicht gelöst";
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
                <Package size={15} className="text-ink-3" aria-hidden />
                <Link href={`/schueler/${studentId}/paket/${p.id}`} className="underline">
                  Übungspaket {p.paket.nr}
                </Link>
                <span className="text-ink-3">
                  {p.paket.fach}
                  {e.beantwortet ? ` · ${e.richtig} von ${e.aufgaben.length} richtig` : ""}
                </span>
                {stand === "auswerten" ? (
                  <Link href={`/schueler/${studentId}/paket/${p.id}`} className="btn btn-ghost btn-sm" data-testid="paket-auswerten-link">
                    Auswerten
                  </Link>
                ) : (
                  <span className="text-[12px] text-ink-3">{stand}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {erledigt.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] text-ink-3">{erledigt.length} erledigt</summary>
          <ul className="mt-2 grid gap-2 opacity-70">
            {erledigt.map((e) => (
              <Zeile key={e.id} e={e} skill={skill(e.skill_id)} studentId={studentId} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Zeile({ e, skill, studentId }: { e: Erkenntnis; skill: string | null | undefined; studentId: number }) {
  const offen = e.status === "offen";
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2" data-testid="erkenntnis">
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] ${offen ? "" : "line-through"}`}>{e.text}</p>
        <p className="text-[12px] text-ink-3">
          {[skill, e.error_type ? errorTypeLabel(e.error_type) : null, `${QUELLE[e.quelle]} ${datumKurz(e.created_at.slice(0, 10))}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <form action={erkenntnisStatusAction.bind(null, e.id, studentId, offen ? "erledigt" : "offen")}>
        <button className="btn btn-ghost btn-sm" aria-label={offen ? "Als erledigt markieren" : "Wieder öffnen"}>
          {offen ? <Check size={16} aria-hidden /> : <RotateCcw size={16} aria-hidden />} {offen ? "Erledigt" : "Offen"}
        </button>
      </form>
    </li>
  );
}
