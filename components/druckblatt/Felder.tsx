"use client";

import { useId, type ReactNode } from "react";
import type { Range } from "@/lib/druckblatt/definition/constraints";

/**
 * Die Bedienelemente der Blattgeneratoren.
 *
 * Ein Satz Primitive, dreimal benutzt: Lesetabelle, Satzbaukasten und Nachmalblatt
 * haben verschiedene Dokumente, aber dieselbe Art, sie einzustellen. Die Quelle
 * hatte dafür `shared/ui`; hier sind es fünf kleine Bausteine mit den
 * Formularstilen aus `app/globals.css` (`.input`, `.panel`).
 *
 * KEINE MILLIMETER-Umrechnung in Sicht: Ein Zahlenfeld zeigt die Zahl, die in der
 * Definition steht (der Reducer begrenzt sie), und die Einheit steht daneben.
 */

export function Panel({
  titel,
  hinweis,
  children,
}: {
  readonly titel: string;
  readonly hinweis?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="panel px-4 py-3.5">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.02em] text-ink-2 uppercase">{titel}</h2>
      <div className="grid gap-3">
        {children}
        {hinweis && <p className="text-[12px] text-ink-3">{hinweis}</p>}
      </div>
    </section>
  );
}

export function Feld({
  label,
  hinweis,
  children,
}: {
  readonly label: string;
  readonly hinweis?: string;
  readonly children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hinweis && <p className="text-[12px] text-ink-3">{hinweis}</p>}
    </div>
  );
}

export function Zahlenfeld({
  label,
  wert,
  bereich,
  einheit,
  hinweis,
  disabled,
  onWert,
}: {
  readonly label: string;
  readonly wert: number;
  readonly bereich: Range;
  readonly einheit?: "mm" | "pt";
  readonly hinweis?: string;
  readonly disabled?: boolean;
  readonly onWert: (wert: number) => void;
}) {
  return (
    <Feld label={einheit ? `${label} (${einheit})` : label} hinweis={hinweis}>
      {(id) => (
        <input
          id={id}
          className="input num"
          type="number"
          inputMode="decimal"
          value={wert}
          disabled={disabled}
          min={bereich.min}
          max={bereich.max}
          step={bereich.step}
          onChange={(ereignis) => {
            const roh = ereignis.currentTarget.value;
            /* Ein leeres Feld ist ein Zwischenstand beim Tippen, kein Wert:
             * die Anzeige bleibt stehen, statt auf das Minimum zu springen. */
            if (roh.trim() === "") return;
            const zahl = Number(roh);
            if (Number.isFinite(zahl)) onWert(zahl);
          }}
        />
      )}
    </Feld>
  );
}

export interface AuswahlOption<T extends string> {
  readonly wert: T;
  readonly text: string;
}

export function Auswahl<T extends string>({
  label,
  wert,
  optionen,
  hinweis,
  ariaLabel,
  disabled,
  onWert,
}: {
  readonly label?: string;
  readonly wert: T;
  readonly optionen: readonly AuswahlOption<T>[];
  readonly hinweis?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly onWert: (wert: T) => void;
}) {
  const id = useId();
  const feld = (
    <select
      id={id}
      className="input"
      value={wert}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onChange={(ereignis) => onWert(ereignis.currentTarget.value as T)}
    >
      {optionen.map((option) => (
        <option key={option.wert} value={option.wert}>
          {option.text}
        </option>
      ))}
    </select>
  );

  if (!label) return feld;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {feld}
      {hinweis && <p className="text-[12px] text-ink-3">{hinweis}</p>}
    </div>
  );
}

export function Schalter({
  label,
  wert,
  hinweis,
  onWert,
}: {
  readonly label: string;
  readonly wert: boolean;
  readonly hinweis?: string;
  readonly onWert: (wert: boolean) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="h-5 w-5 shrink-0"
          style={{ accentColor: "var(--accent)" }}
          checked={wert}
          onChange={(ereignis) => onWert(ereignis.currentTarget.checked)}
        />
        <label htmlFor={id} className="text-[14px]">
          {label}
        </label>
      </div>
      {hinweis && <p className="mt-1 ml-[30px] text-[12px] text-ink-3">{hinweis}</p>}
    </div>
  );
}

export function Textfeld({
  label,
  wert,
  platzhalter,
  hinweis,
  onWert,
}: {
  readonly label: string;
  readonly wert: string;
  readonly platzhalter?: string;
  readonly hinweis?: string;
  readonly onWert: (wert: string) => void;
}) {
  return (
    <Feld label={label} hinweis={hinweis}>
      {(id) => (
        <input
          id={id}
          className="input"
          type="text"
          value={wert}
          placeholder={platzhalter}
          onChange={(ereignis) => onWert(ereignis.currentTarget.value)}
        />
      )}
    </Feld>
  );
}

export function Textbereich({
  label,
  wert,
  zeilen = 4,
  hinweis,
  onWert,
}: {
  readonly label: string;
  readonly wert: string;
  readonly zeilen?: number;
  readonly hinweis?: string;
  readonly onWert: (wert: string) => void;
}) {
  return (
    <Feld label={label} hinweis={hinweis}>
      {(id) => (
        <textarea
          id={id}
          className="input"
          rows={zeilen}
          value={wert}
          onChange={(ereignis) => onWert(ereignis.currentTarget.value)}
        />
      )}
    </Feld>
  );
}

/** Ein Hinweis in Rot — für Mängel und abgelehnte Definitionen. */
export function Warnung({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-2xl px-3.5 py-2.5 text-[13px] text-red" style={{ background: "var(--red-wash)" }} role="alert">
      {children}
    </p>
  );
}
