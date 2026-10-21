"use client";

/**
 * „Diese Woche abweichend“ (Glossar: **Verfügbarkeit**): für eine einzelne Woche gilt eine eigene
 * Verfügbarkeit; sie ersetzt für diese Woche die Regelverfügbarkeit. Gespeichert wird sie in
 * `availability_overrides` (Schlüssel: Eigentümer + Wochenstart, Montag).
 *
 * Die Woche wird über die Adresse gewählt (`?woche=YYYY-MM-DD`) — die Seite lädt die Abweichung
 * serverseitig, dieses Bauteil hält nur den bearbeiteten Wert. Deshalb bekommt es in der Seite
 * `key={weekStart}`, damit beim Wochenwechsel nichts von der alten Woche stehen bleibt.
 */
import { useState } from "react";
import Link from "next/link";
import { CalendarRange, RotateCcw, Save, Trash2 } from "lucide-react";
import { clearOverrideAction, saveOverrideAction } from "@/app/planung-actions";
import { Pill } from "@/components/ui";
import { VerfuegbarkeitEditor } from "./VerfuegbarkeitEditor";
import { VerfuegbarkeitTabelle } from "./VerfuegbarkeitTabelle";
import { parseVerfuegbarkeit, type Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { tagAddieren, wienerWochenstart, wochenLabel, wochenstartVon } from "@/lib/planung/zeit";

export function WochenAbweichung({
  ownerType,
  ownerId,
  weekStart,
  basis,
  abweichung,
  darfBearbeiten,
  basisHref,
  extra = {},
}: {
  ownerType: "teacher" | "student";
  ownerId: number;
  /** Montag der gezeigten Woche (YYYY-MM-DD). */
  weekStart: string;
  /** Regelverfügbarkeit als JSON. */
  basis: string;
  /** Abweichung dieser Woche als JSON, null wenn es keine gibt. */
  abweichung: string | null;
  darfBearbeiten: boolean;
  /** Pfad der Seite ohne Abfrage, z. B. "/lehrer". */
  basisHref: string;
  /** Was in den Wochen-Links sonst noch mit muss (z. B. { lehrer: "3" }). */
  extra?: Record<string, string>;
}) {
  const start = wochenstartVon(weekStart);
  const [wert, setWert] = useState(abweichung ?? "");
  const [laeuft, setLaeuft] = useState(false);

  const link = (woche: string) => {
    const p = new URLSearchParams(extra);
    p.set("woche", woche);
    return `${basisHref}?${p.toString()}`;
  };
  const zurueck = link(start);
  const gespeichert = abweichung !== null;
  const wirksam: Verfuegbarkeit = gespeichert ? parseVerfuegbarkeit(abweichung) : parseVerfuegbarkeit(basis);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={link(tagAddieren(start, -7))} className="btn btn-secondary btn-sm">
          ← Vorwoche
        </Link>
        <span className="text-[15px] font-semibold">
          <CalendarRange size={15} className="mr-1 inline align-[-2px] text-ink-3" aria-hidden />
          {wochenLabel(start)}
        </span>
        <Link href={link(tagAddieren(start, 7))} className="btn btn-secondary btn-sm">
          Nachwoche →
        </Link>
        <Link href={link(wienerWochenstart())} className="btn btn-ghost btn-sm">
          Diese Woche
        </Link>
        <form method="get" action={basisHref} className="flex items-end gap-2">
          {Object.entries(extra).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="field">
            <span className="label">Woche wählen</span>
            <input type="date" className="input" name="woche" defaultValue={start} />
          </label>
          <button className="btn btn-secondary btn-sm">Anzeigen</button>
        </form>
        <Pill tone={gespeichert ? "amber" : "neutral"}>{gespeichert ? "diese Woche abweichend" : "Regelverfügbarkeit"}</Pill>
      </div>

      {!darfBearbeiten ? (
        <VerfuegbarkeitTabelle verfuegbarkeit={wirksam} />
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            {gespeichert
              ? "Für diese Woche gilt die Abweichung unten. Sie ersetzt die Regelverfügbarkeit nur für diese Woche."
              : "Noch keine Abweichung: es gilt die Regelverfügbarkeit. Unten eintragen, um nur diese Woche zu ändern."}
          </p>
          <VerfuegbarkeitEditor value={wert} onChange={setWert} weekStart={start} />
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWert(basis)}>
              <RotateCcw size={15} aria-hidden /> Von der Regelverfügbarkeit übernehmen
            </button>
            <form
              action={saveOverrideAction.bind(null, ownerType, ownerId, start)}
              onSubmit={() => setLaeuft(true)}
              className="contents"
            >
              <input type="hidden" name="zurueck" value={zurueck} />
              <input type="hidden" name="availability" value={wert} />
              <button className="btn btn-primary btn-sm" disabled={laeuft}>
                <Save size={15} aria-hidden /> Abweichung speichern
              </button>
            </form>
            {gespeichert && (
              <form
                action={clearOverrideAction.bind(null, ownerType, ownerId, start)}
                className="contents"
                onSubmit={(e) => {
                  if (!confirm("Abweichung dieser Woche entfernen? Es gilt dann wieder die Regelverfügbarkeit.")) e.preventDefault();
                }}
              >
                <input type="hidden" name="zurueck" value={zurueck} />
                <button className="btn btn-danger btn-sm border border-red/30">
                  <Trash2 size={15} aria-hidden /> Abweichung entfernen
                </button>
              </form>
            )}
          </div>
          <details className="text-[13px] text-ink-2">
            <summary className="cursor-pointer">Regelverfügbarkeit ansehen</summary>
            <div className="pt-2">
              <VerfuegbarkeitTabelle verfuegbarkeit={parseVerfuegbarkeit(basis)} kompakt />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
