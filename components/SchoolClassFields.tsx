"use client";

import { useState } from "react";
import { SCHOOL_TYPES, schoolType } from "@/lib/school";

type Props = {
  type?: string;
  klasse?: number | null;
  /** Controlled mode (exercise builder); uncontrolled when omitted. */
  onChange?: (type: string, klasse: number) => void;
};

/** Schultyp + Klasse, with the class list matching the school type (VS 1–4, Gymnasium 1–8, HTL/HAK 1–5 …). */
export function SchoolClassFields({ type: initialType, klasse: initialKlasse, onChange }: Props) {
  const [type, setType] = useState(schoolType(initialType ?? "")?.name ?? "Mittelschule");
  const [klasse, setKlasse] = useState(initialKlasse ?? 1);
  const t = schoolType(type)!;
  const update = (nextType: string, nextKlasse: number) => {
    const max = schoolType(nextType)?.classes ?? 13;
    const k = Math.min(max, Math.max(1, nextKlasse));
    setType(nextType);
    setKlasse(k);
    onChange?.(nextType, k);
  };
  return (
    <>
      <label className="field">
        <span className="label">Schultyp</span>
        <select className="input" name="school_type" value={type} onChange={(e) => update(e.target.value, klasse)}>
          {SCHOOL_TYPES.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Klasse</span>
        <select className="input num" name="klasse" value={klasse} onChange={(e) => update(type, Number(e.target.value))}>
          {Array.from({ length: t.classes }, (_, i) => i + 1).map((k) => (
            <option key={k} value={k}>
              {k}. Klasse{t.name === "Gymnasium" ? (k <= 4 ? " (Unterstufe)" : " (Oberstufe)") : ""}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
