import { ChevronDown } from "lucide-react";
import { wechsleFachAction } from "@/app/cockpit-actions";
import { FachFeld } from "@/components/FachFeld";
import { SUBJECTS } from "@/lib/curriculum";

/**
 * „Fach ändern“ oben in der laufenden Einheit (niko, 12.11.2026): die App startet die Einheit im Fach des Plans, der
 * Vorbereitung oder dem ersten Fach im Profil; braucht der Schüler heute ein anderes, genügt ein Tippen. Die Fächer des
 * Schülers und Mathematik, Deutsch, Englisch stehen als Knöpfe da, jedes andere Fach lässt sich eintippen. Danach fängt
 * der Plan im neuen Fach von vorne an (lib/cockpit.ts `wechsleFach`).
 */
export function FachWechsel({ unitId, fach, eigene }: { unitId: number; fach: string; eigene: string[] }) {
  const knoepfe = [...new Set([...eigene, ...SUBJECTS])].filter((f) => f && f !== fach);
  const action = wechsleFachAction.bind(null, unitId);
  return (
    // on a phone the panel hangs from the whole (sticky) header, so it never reaches past the screen
    <details className="schwebend group sm:relative" data-testid="fach-wechsel">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 rounded-full border border-line-strong bg-surface px-3 text-[14px] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        {fach ? "Fach ändern" : "Fach wählen"}
        <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute top-full right-4 left-4 z-30 mt-2 grid gap-3 sm:right-auto sm:left-0 sm:w-[400px] rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="text-[14px] text-ink-2">
          {fach ? <>Gerade: <span className="font-semibold text-ink">{fach}</span>. </> : null}
          Der Plan fängt im neuen Fach neu an. Notizen und gesendete Übungen bleiben.
        </p>
        <div className="flex flex-wrap gap-2">
          {knoepfe.map((f) => (
            <form key={f} action={action}>
              <input type="hidden" name="subject" value={f} />
              <button className="btn btn-secondary min-h-[48px]" data-testid="fach-knopf">
                {f}
              </button>
            </form>
          ))}
        </div>
        <form action={action} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <FachFeld id={`wechsel-${unitId}`} eigene={eigene} ariaLabel="Anderes Fach" />
          </div>
          <button className="btn btn-ghost min-h-[48px]">Übernehmen</button>
        </form>
      </div>
    </details>
  );
}
