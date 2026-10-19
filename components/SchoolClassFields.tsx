"use client";

import { useState } from "react";
import { SCHOOL_TYPES, schoolType } from "@/lib/school";

type Props = {
  type?: string;
  klasse?: number | null;
  /** Controlled mode (exercise builder); uncontrolled when omitted. */
  onChange?: (type: string, klasse: number) => void;
  /** Student form: show the internal Schulstufe and flag an old, unclear school type. */
  showStufe?: boolean;
  /**
   * Student form: Schultyp and Klasse may stay „noch nicht bekannt“ (value ""). The student keeps an
   * unclear Schulstufe and shows up under „Klasse fehlt“ until both are filled in.
   */
  offenErlaubt?: boolean;
};

const OFFEN = "noch nicht bekannt";

/** Schultyp + Klasse, with the class list matching the school type (VS 1–4, Gymnasium 1–8, HTL/HAK 1–5 …). */
export function SchoolClassFields({ type: initialType, klasse: initialKlasse, onChange, showStufe, offenErlaubt }: Props) {
  // an existing student without a known type or class opens as „noch nicht bekannt“; a new one as before
  const bestehend = offenErlaubt && initialType !== undefined;
  const [type, setType] = useState(schoolType(initialType ?? "")?.name ?? (bestehend ? "" : "Mittelschule"));
  const [klasse, setKlasse] = useState<number | null>(initialKlasse ?? (bestehend ? null : 1));
  const t = schoolType(type);
  const update = (nextType: string, nextKlasse: number | null) => {
    const max = schoolType(nextType)?.classes ?? 13;
    const k = nextKlasse === null ? null : Math.min(max, Math.max(1, nextKlasse));
    setType(nextType);
    setKlasse(k);
    if (k !== null) onChange?.(nextType, k);
  };
  return (
    <>
      <label className="field">
        <span className="label">Schultyp</span>
        <select className="input" name="school_type" value={type} onChange={(e) => update(e.target.value, klasse)}>
          {offenErlaubt && <option value="">{OFFEN}</option>}
          {SCHOOL_TYPES.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Klasse</span>
        <select className="input num" name="klasse" value={klasse ?? ""} onChange={(e) => update(type, e.target.value ? Number(e.target.value) : null)}>
          {offenErlaubt && <option value="">{OFFEN}</option>}
          {Array.from({ length: t?.classes ?? 13 }, (_, i) => i + 1).map((k) => (
            <option key={k} value={k}>
              {k}. Klasse{t?.name === "Gymnasium" ? (k <= 4 ? " (Unterstufe)" : " (Oberstufe)") : ""}
            </option>
          ))}
        </select>
        {showStufe &&
          (t && klasse !== null ? (
            <span className="num text-[12.5px] text-ink-3">= Schulstufe {t.offset + klasse}</span>
          ) : (
            <span className="text-[12.5px] text-amber">Schulstufe noch offen</span>
          ))}
      </label>
      {showStufe && initialType && !schoolType(initialType) && (
        <p className="text-[13px] text-amber sm:col-span-3">
          Bisher gespeichert: „{initialType}“. Das war nicht eindeutig, bitte Schultyp und Klasse wählen und speichern.
        </p>
      )}
    </>
  );
}
