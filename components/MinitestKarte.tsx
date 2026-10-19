import Link from "next/link";
import { ClipboardCheck, Printer, Send } from "lucide-react";
import { minitestAction } from "@/app/minitest-actions";
import { MINITEST_ANZAHL, MINITEST_STANDARD, stoffDatum, stoffThemen, type Stoff } from "@/lib/minitest";
import type * as repo from "@/lib/repo";

type Geraet = "tablet" | "laptop" | null;

const zielText = (g: Geraet) => (g === "laptop" ? "Auf den Laptop" : g === "tablet" ? "Auf das Tablet" : "Senden");

/**
 * Minitest am Anfang der Einheit (lib/minitest.ts): solange in der Einheit noch nichts beantwortet ist,
 * mit einem Klick aus dem Stoff der letzten Einheit. Ist er nur gedruckt, bleibt eine kurze Zeile zum
 * Nochmal-Drucken oder Senden.
 */
export function MinitestKarte({ unitId, name, geraet, stoff, gedruckt }: { unitId: number; name: string; geraet: Geraet; stoff: Stoff | null; gedruckt: { worksheet: repo.Worksheet; tasks: number } | null }) {
  if (gedruckt) {
    return (
      <section className="panel flex flex-wrap items-center gap-3 px-5 py-4" data-testid="minitest-gedruckt">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent" aria-hidden>
          <ClipboardCheck size={20} />
        </span>
        <p className="min-w-0 flex-1 text-[15px]">
          <span className="font-semibold">Minitest gedruckt</span>
          <span className="num text-ink-2"> · {gedruckt.tasks} Aufgaben</span>
        </p>
        <Link href={`/arbeitsblatt/${gedruckt.worksheet.id}?einheit=${unitId}`} className="btn btn-secondary">
          <Printer size={16} aria-hidden /> Drucken
        </Link>
        <form action={minitestAction}>
          <input type="hidden" name="unit_id" value={unitId} />
          <button name="ziel" value="geraet" className="btn btn-ghost" data-testid="minitest-doch-geraet">
            <Send size={16} aria-hidden /> {zielText(geraet)}
          </button>
        </form>
      </section>
    );
  }
  if (!stoff) return null;
  // „Brüche: Kürzen, Addieren“: die Fähigkeiten nach Thema, höchstens drei
  const themen = new Map<string, string[]>();
  for (const f of stoff.faehigkeiten.slice(0, 3)) themen.set(f.area, [...(themen.get(f.area) ?? []), f.name]);
  const inhalt = themen.size
    ? `${[...themen].map(([area, namen]) => (area ? `${area}: ${namen.join(", ")}` : namen.join(", "))).join(" · ")}${stoff.faehigkeiten.length > 3 ? " …" : ""}`
    : stoffThemen(stoff);
  return (
    <section className="panel" aria-labelledby="minitest-titel" data-testid="minitest-karte">
      <div className="flex items-start gap-4 px-5 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent" aria-hidden>
          <ClipboardCheck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="minitest-titel" className="text-[18px] font-semibold">
            Minitest zum Start
          </h2>
          <p className="mt-0.5 text-[14px] text-ink-2">
            <span className="num">Stoff vom {stoffDatum(stoff)}</span> · {stoff.fach}
            <span className="block text-ink">{inhalt}</span>
          </p>
        </div>
      </div>
      <form action={minitestAction} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-4 pb-5">
        <input type="hidden" name="unit_id" value={unitId} />
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Wie viele Aufgaben</legend>
          <span className="flex rounded-full bg-panel p-1">
            {MINITEST_ANZAHL.map((n) => (
              <label
                key={n}
                className="num flex h-10 min-w-11 cursor-pointer items-center justify-center rounded-full px-3 text-[15px] font-semibold text-ink-2 transition-colors has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-[var(--shadow-card)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
              >
                <input type="radio" name="anzahl" value={n} defaultChecked={n === MINITEST_STANDARD} className="sr-only" data-testid={`minitest-anzahl-${n}`} />
                {n}
              </label>
            ))}
          </span>
          <span className="text-[14px] text-ink-2">Aufgaben</span>
        </fieldset>
        <span className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-1 sm:justify-end">
          <button name="ziel" value="druck" className="btn btn-secondary" data-testid="minitest-drucken">
            <Printer size={16} aria-hidden /> Drucken
          </button>
          <button name="ziel" value="geraet" className="btn btn-primary" data-testid="minitest-senden">
            <Send size={16} aria-hidden /> {zielText(geraet)}
          </button>
        </span>
      </form>
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Ohne Tipps und mit einem Versuch je Aufgabe. Wie es gelaufen ist, sieht {name} erst am Ende.</p>
    </section>
  );
}
