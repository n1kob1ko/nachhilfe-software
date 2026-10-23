import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, NotebookPen } from "lucide-react";
import { More, Pill } from "@/components/ui";
import { daysUntil } from "@/lib/exams";
import { wienerDatum } from "@/lib/planung/zeit";
import { hausuebungen, type PortalHausuebung } from "@/lib/schuelerportal";
import { Abschnitt, tagLabel } from "./Abschnitt";

/**
 * Hausübungen in der Schüler-App: die offenen zuerst (früheste Fälligkeit oben), die erledigten im Verlauf
 * „Erledigt“ darunter. Gehört eine Übung dazu, führt die Zeile zu ihr. Ohne jede Hausübung kein Abschnitt.
 */
export function Hausuebungen({ studentId, token }: { studentId: number; token: string }) {
  const heute = wienerDatum();
  const { offen, erledigt } = hausuebungen(studentId, heute);
  if (offen.length === 0 && erledigt.length === 0) return null;
  return (
    <Abschnitt titel="Hausübungen" icon={NotebookPen} anzahl={offen.length} testId="hausuebungen">
      {offen.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">Alles erledigt. Gut gemacht!</p>
      ) : (
        <div className="mt-1">
          <More limit={3} className="divide-y divide-line" items={offen.map((h) => <Offen key={h.id} h={h} heute={heute} token={token} />)} />
        </div>
      )}
      {erledigt.length > 0 && (
        <details className="group mt-2" data-testid="hausuebungen-erledigt">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:text-ink">
            Erledigt <span className="num">({erledigt.length})</span> <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-2 pb-1">
            {erledigt.slice(0, 20).map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-[15px] text-ink-2">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-green" aria-hidden />
                <span className="min-w-0">
                  {h.beschreibung} <span className="text-[13px] text-ink-3">· {h.fach}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Abschnitt>
  );
}

function Offen({ h, heute, token }: { h: PortalHausuebung; heute: string; token: string }) {
  const tage = h.faellig ? daysUntil(h.faellig, heute) : null;
  const inhalt = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold break-words">{h.beschreibung}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
          <span>{h.fach}</span>
          {h.faellig && <span className="num">· bis {tagLabel(h.faellig)}</span>}
          {h.zustand === "ueberfaellig" ? <Pill tone="red">überfällig</Pill> : tage === 0 ? <Pill tone="amber">heute</Pill> : tage === 1 ? <Pill tone="amber">morgen</Pill> : null}
        </span>
      </span>
      {h.uebungId && (
        <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-accent">
          Zur Übung <ChevronRight size={16} aria-hidden />
        </span>
      )}
    </>
  );
  return h.uebungId ? (
    <Link href={`/lernen/${token}/${h.uebungId}`} className="flex items-center gap-3 py-3 hover:text-accent">
      {inhalt}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-3">{inhalt}</div>
  );
}
