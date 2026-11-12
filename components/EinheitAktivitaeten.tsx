import { SectionTitle } from "@/components/ui";
import { aktivitaetDauer, aktivitaetenDerEinheit, aktivitaetErgebnis, aktivitaetName, dauerText, gesamtDauer, uhrzeit } from "@/lib/einheit-aktivitaeten";

/**
 * „Was Max gemacht hat“ (niko 2026-11-12): jede Tätigkeit der Einheit in der Reihenfolge, in der sie lief, mit Uhrzeit, Ergebnis
 * und wie lange es gedauert hat (lib/einheit-aktivitaeten.ts). Übungen, Minitest, Whiteboard, Lernspiele, Vokabeln, Textarbeit.
 */
export function EinheitAktivitaeten({ unitId, vorname }: { unitId: number; vorname: string }) {
  const xs = aktivitaetenDerEinheit(unitId);
  if (!xs.length) return null;
  const zusammen = gesamtDauer(xs);
  return (
    <section aria-label="Was gemacht wurde" data-testid="einheit-aktivitaeten">
      <SectionTitle action={zusammen > 0 ? <span className="num text-[14px] text-ink-2">zusammen {dauerText(zusammen)}</span> : undefined}>Was {vorname} gemacht hat</SectionTitle>
      <ol className="panel divide-y divide-line">
        {xs.map((a, i) => {
          const dauer = aktivitaetDauer(a);
          return (
            <li key={i} className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-x-3 px-4 py-2.5 text-[15px]" data-testid="aktivitaet">
              <span className="num text-[13.5px] text-ink-3">{uhrzeit(a.start)}</span>
              <span className="min-w-0">
                <span className="font-medium">{aktivitaetName(a)}</span>
                <span className="text-ink-2"> · {aktivitaetErgebnis(a)}</span>
              </span>
              <span className="num text-[14px] whitespace-nowrap text-ink-2">{dauer || "–"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
