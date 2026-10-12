"use client";

/**
 * Verfügbarkeits-Raster (portiert und neu gestaltet nach `AvailabilityTimetable.tsx` der
 * Tutoring-Plattform): Tage Mo–So als Spalten, Zeit in Schritten von 15 Minuten. Ziehen markiert
 * mehrere Felder auf einmal. Gespeichert wird das JSON aus `lib/planung/verfuegbarkeit.ts`
 * (ISO 1 = Montag … 7 = Sonntag, Minuten ab Mitternacht) — die Umrechnung der Wochentage passiert
 * ausschließlich in `lib/planung/zeit.ts`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, MousePointerClick } from "lucide-react";
import { parseVerfuegbarkeit, serializeVerfuegbarkeit, verfuegbarkeitLabel, verfuegbarkeitMinuten, type Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { TAG_SCHLUESSEL, WOCHENTAGE, WOCHENTAG_KURZ, tagAddieren, wochenstartVon, type TagSchluessel, type Wochentag } from "@/lib/planung/zeit";

const VON = 8 * 60;
const BIS = 21 * 60;
const SCHRITT = 15;
const FELDER = (BIS - VON) / SCHRITT;

function feldMinuten(index: number) {
  return VON + index * SCHRITT;
}

/** "2026-10-12" → "12.10." */
function kurzDatum(datum: string): string {
  return `${datum.slice(8, 10)}.${datum.slice(5, 7)}.`;
}

function minuteFeld(minuten: number) {
  return Math.max(0, Math.min(FELDER - 1, Math.floor((minuten - VON) / SCHRITT)));
}

/** JSON → Raster aus belegten Feldern. */
function alsRaster(json: string): Record<TagSchluessel, Set<number>> {
  const raster = {} as Record<TagSchluessel, Set<number>>;
  for (const tag of TAG_SCHLUESSEL) raster[tag] = new Set<number>();
  const v = parseVerfuegbarkeit(json);
  for (const tag of TAG_SCHLUESSEL) {
    for (const spanne of v[tag] ?? []) {
      const von = minuteFeld(spanne.start);
      const bis = minuteFeld(Math.max(spanne.start, spanne.end - 1));
      for (let f = von; f <= bis; f++) raster[tag].add(f);
    }
  }
  return raster;
}

/** Raster → JSON, zusammenhängende Felder werden zu einer Spanne. */
function alsJson(raster: Record<TagSchluessel, Set<number>>): string {
  const v: Verfuegbarkeit = {};
  for (const tag of TAG_SCHLUESSEL) {
    const felder = [...raster[tag]].sort((a, b) => a - b);
    if (!felder.length) continue;
    const spannen: { start: number; end: number }[] = [];
    let start = feldMinuten(felder[0]);
    let ende = start + SCHRITT;
    for (let i = 1; i < felder.length; i++) {
      if (felder[i] === felder[i - 1] + 1) ende = feldMinuten(felder[i]) + SCHRITT;
      else {
        spannen.push({ start, end: ende });
        start = feldMinuten(felder[i]);
        ende = start + SCHRITT;
      }
    }
    spannen.push({ start, end: ende });
    v[tag] = spannen;
  }
  return serializeVerfuegbarkeit(v);
}

export function VerfuegbarkeitEditor({
  value,
  onChange,
  weekStart,
  name,
  readOnly = false,
  hinweis,
}: {
  value: string;
  onChange?: (json: string) => void;
  /** Montag der gezeigten Woche (YYYY-MM-DD) – nur für die Datumszeile im Kopf. */
  weekStart?: string;
  /** Name eines versteckten Feldes, damit das Raster in einem einfachen Formular funktioniert. */
  name?: string;
  readOnly?: boolean;
  hinweis?: React.ReactNode;
}) {
  const raster = useMemo(() => alsRaster(value), [value]);
  const rasterRef = useRef(raster);
  rasterRef.current = raster;
  const [ziehen, setZiehen] = useState<boolean | null>(null);

  useEffect(() => {
    if (ziehen === null) return;
    const ende = () => setZiehen(null);
    document.addEventListener("pointerup", ende);
    document.addEventListener("pointercancel", ende);
    return () => {
      document.removeEventListener("pointerup", ende);
      document.removeEventListener("pointercancel", ende);
    };
  }, [ziehen]);

  const setzen = (tag: TagSchluessel, feld: number, belegt: boolean) => {
    const next = {} as Record<TagSchluessel, Set<number>>;
    for (const t of TAG_SCHLUESSEL) next[t] = new Set(rasterRef.current[t]);
    if (belegt) next[tag].add(feld);
    else next[tag].delete(feld);
    rasterRef.current = next;
    onChange?.(alsJson(next));
  };

  const ganzenTag = (tag: TagSchluessel, belegt: boolean) => {
    const next = {} as Record<TagSchluessel, Set<number>>;
    for (const t of TAG_SCHLUESSEL) next[t] = new Set(rasterRef.current[t]);
    next[tag] = belegt ? new Set(Array.from({ length: FELDER }, (_, i) => i)) : new Set<number>();
    rasterRef.current = next;
    onChange?.(alsJson(next));
  };

  const vorlage = (vonStunde: number, bisStunde: number) => {
    const next = {} as Record<TagSchluessel, Set<number>>;
    for (const t of TAG_SCHLUESSEL) next[t] = new Set(rasterRef.current[t]);
    for (const tag of ["1", "2", "3", "4", "5"] as TagSchluessel[]) {
      for (let f = 0; f < FELDER; f++) {
        const m = feldMinuten(f);
        if (m >= vonStunde * 60 && m < bisStunde * 60) next[tag].add(f);
      }
    }
    rasterRef.current = next;
    onChange?.(alsJson(next));
  };

  const leeren = () => {
    const next = {} as Record<TagSchluessel, Set<number>>;
    for (const t of TAG_SCHLUESSEL) next[t] = new Set<number>();
    rasterRef.current = next;
    onChange?.("");
  };

  const v = parseVerfuegbarkeit(value);
  const minuten = verfuegbarkeitMinuten(v);
  const start = weekStart ? wochenstartVon(weekStart) : null;

  return (
    <div className="grid gap-3">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {hinweis ?? "Klicken oder ziehen markiert die Zeiten, in denen eingeplant werden darf."}{" "}
          <span className="text-ink-3">
            <MousePointerClick size={13} className="mr-1 inline align-[-2px]" aria-hidden />
            {minuten ? `${Math.round((minuten / 60) * 10) / 10} Stunden in der Woche` : "noch nichts eingetragen"}
          </span>
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => vorlage(14, 18)}>
              Mo–Fr 14–18
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => vorlage(8, 12)}>
              Mo–Fr 8–12
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leeren}>
              <Eraser size={15} aria-hidden /> Leeren
            </button>
          </div>
        )}
      </div>

      <div className={`overflow-auto rounded-2xl border border-line bg-surface ${ziehen !== null ? "select-none" : ""}`} style={{ touchAction: ziehen !== null ? "none" : undefined }}>
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th className="w-14 border-b border-r border-line px-1 py-1.5 text-left font-semibold text-ink-2">Zeit</th>
              {WOCHENTAGE.map((tag: Wochentag) => {
                const schluessel = String(tag) as TagSchluessel;
                const ganz = raster[schluessel].size === FELDER;
                return (
                  <th key={tag} className="border-b border-line px-1 py-1.5 text-center font-semibold text-ink-2">
                    {readOnly ? (
                      <span>
                        {WOCHENTAG_KURZ[tag]}
                        {start && <span className="block text-[11px] font-normal text-ink-3">{kurzDatum(tagAddieren(start, tag - 1))}</span>}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="w-full rounded-lg px-1 py-0.5 hover:bg-accent-wash"
                        title={ganz ? `${WOCHENTAG_KURZ[tag]} leeren` : `${WOCHENTAG_KURZ[tag]} ganzer Tag`}
                        onClick={() => ganzenTag(schluessel, !ganz)}
                      >
                        {WOCHENTAG_KURZ[tag]}
                        <span className="block text-[11px] font-normal text-ink-3">{start ? kurzDatum(tagAddieren(start, tag - 1)) : "ganzer Tag"}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: FELDER }, (_, feld) => (
              <tr key={feld} className={feld % 4 === 0 ? "border-t border-line" : ""}>
                <td className="border-r border-line px-1 py-0 text-right text-[11px] whitespace-nowrap text-ink-3">{feld % 4 === 0 ? `${String(Math.floor(feldMinuten(feld) / 60)).padStart(2, "0")}:00` : ""}</td>
                {WOCHENTAGE.map((tag: Wochentag) => {
                  const schluessel = String(tag) as TagSchluessel;
                  const belegt = raster[schluessel].has(feld);
                  return (
                    <td key={tag} className="p-px">
                      <button
                        type="button"
                        disabled={readOnly}
                        aria-pressed={belegt}
                        title={`${WOCHENTAG_KURZ[tag]} ${String(Math.floor(feldMinuten(feld) / 60)).padStart(2, "0")}:${String(feldMinuten(feld) % 60).padStart(2, "0")}`}
                        onPointerDown={(e) => {
                          if (readOnly) return;
                          e.preventDefault();
                          const neu = !rasterRef.current[schluessel].has(feld);
                          setzen(schluessel, feld, neu);
                          setZiehen(neu);
                        }}
                        onPointerEnter={() => {
                          if (readOnly || ziehen === null) return;
                          if (rasterRef.current[schluessel].has(feld) !== ziehen) setzen(schluessel, feld, ziehen);
                        }}
                        className={`block h-4 w-full rounded-[4px] border transition-colors ${
                          belegt ? "border-accent bg-accent-bright" : "border-line bg-paper hover:bg-accent-wash"
                        } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold text-ink-2">Eingetragen:</span>
        <span className="text-ink-2">{verfuegbarkeitLabel(v)}</span>
      </div>
    </div>
  );
}
