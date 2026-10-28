import Link from "next/link";
import { ClipboardCheck, ScanLine } from "lucide-react";
import { Reveal } from "@/components/ui";
import { antwortAnzeige } from "@/lib/antwort-text";
import { frageText, loesungText } from "@/lib/cockpit";
import { besprechenSchritt, briefingZeile, quelleText, zusammenLoesen, type HuErgebnis } from "@/lib/hausuebung-zurueck";
import * as repo from "@/lib/repo";

const BEWERTUNG: Record<string, string> = { falsch: "falsch", teilweise: "teilweise richtig" };

/**
 * Die Hausübung von letztem Mal in einer Zeile über dem Plan (lib/hausuebung-zurueck.ts): „Hausübung: 6 von 9 richtig · Past Simple
 * Questions noch schwierig“ und woher. Nur für die Lehrkraft.
 */
export function HausuebungZeile({ e }: { e: HuErgebnis }) {
  return (
    <p className="text-[14px] text-ink-2" data-testid="hausuebung-zeile">
      <span className="font-semibold text-ink">{briefingZeile(e)}</span> <span className="text-[12.5px] whitespace-nowrap text-ink-3">{quelleText(e)}</span>
    </p>
  );
}

/**
 * Die Aufgaben im Schritt „Hausübung besprechen“: die falsch oder teilweise gelösten mit der Antwort des Schülers und der Lösung,
 * nichts eingegeben (fällig heute, nicht abgegeben): bis zu drei zum gemeinsamen Lösen, die Lösung erst auf Tippen. Dazu „Arbeit fotografieren“, solange Aufgaben
 * offen sind (auf Papier gemacht), und das Ergebnis der Übung. Nur für die Lehrkraft der Einheit; nichts davon geht an den Schüler.
 */
export function HausuebungAufgaben({ e, unitId }: { e: HuErgebnis; unitId: number }) {
  const s = besprechenSchritt(e);
  const tasks = new Map(repo.listTasks(e.worksheetId).map((t) => [t.id, t] as const));
  const stand = new Map(e.aufgabenStand.map((x) => [x.taskId, x] as const));
  const liste = s.taskIds.flatMap((id) => {
    const t = tasks.get(id);
    const x = stand.get(id);
    return t && x ? [{ t, x }] : [];
  });
  const zusammen = zusammenLoesen(e);
  const offeneAufgaben = e.aufgabenStand.some((x) => x.bewertung === "unbearbeitet");
  return (
    <div className="mt-4 grid gap-3" data-testid="hausuebung-aufgaben">
      {liste.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2">{zusammen ? "Gemeinsam lösen" : "Zum Besprechen"}</p>
          <ol className="mt-1 grid gap-2">
            {liste.map(({ t, x }) => (
              <li key={t.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] text-[15px] leading-snug">
                <span className="num text-ink-3">{x.nr}.</span>
                <span className="min-w-0">
                  <span className="block whitespace-pre-line">{frageText(t)}</span>
                  {!zusammen && x.antwort !== null && (
                    <span className="mt-0.5 block text-[14px] text-red">
                      {BEWERTUNG[x.bewertung] ?? ""}: <span className="text-ink-2">{antwortAnzeige(t, x.antwort) || "–"}</span>
                    </span>
                  )}
                  {zusammen ? (
                    <Reveal label="Lösung">
                      <span className="block font-medium whitespace-pre-line text-green">{loesungText(t) || "–"}</span>
                    </Reveal>
                  ) : (
                    <span className="mt-0.5 block font-medium whitespace-pre-line text-green">{loesungText(t) || "–"}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="flex flex-wrap gap-x-5 text-[14px]">
        {offeneAufgaben && (
          <Link href={`/einheiten/${unitId}/papier?uebung=${e.worksheetId}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-accent hover:underline" data-testid="hausuebung-fotografieren">
            <ScanLine size={16} aria-hidden /> Auf Papier gemacht? Arbeit fotografieren
          </Link>
        )}
        {e.bearbeitet > 0 && (
          <Link href={`/schueler/${e.studentId}/ergebnis/${e.assignmentId}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-ink-2 hover:text-ink hover:underline">
            <ClipboardCheck size={16} aria-hidden /> Alle Antworten
          </Link>
        )}
      </p>
    </div>
  );
}
