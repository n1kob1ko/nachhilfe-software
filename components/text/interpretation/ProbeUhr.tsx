"use client";

import { useEffect, useState } from "react";
import { ListChecks, Timer } from "lucide-react";
import { abgabeCheckliste, type Aufbau } from "@/lib/textinterpretation";

/**
 * Probe-Schularbeit: the time for the writing, counted from the first word on this device (kept on the device, so a
 * reload does not start it again). Only a clock: when the time is up, the student can still write and hand in.
 */
export function ProbeUhr({ minuten, storageKey, words }: { minuten: number; storageKey: string; words: number }) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved > 0) setStart(saved);
    } catch {
      // no storage: the clock starts with the next word
    }
  }, [storageKey]);

  useEffect(() => {
    if (start !== null || words === 0) return;
    const t = Date.now();
    setStart(t);
    try {
      localStorage.setItem(storageKey, String(t));
    } catch {
      // only for this visit
    }
  }, [start, words, storageKey]);

  useEffect(() => {
    if (start === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [start]);

  const rest = start === null ? minuten : Math.min(minuten, Math.ceil((start + minuten * 60_000 - now) / 60_000));
  const state = start === null ? "wartet" : rest <= 0 ? "um" : rest <= 10 ? "knapp" : "laeuft";
  return (
    <div className="ti-box ti-planbox flex items-start gap-3" data-testid="probe-uhr" data-state={state}>
      <Timer size={20} aria-hidden className={`mt-0.5 shrink-0 ${state === "um" || state === "knapp" ? "text-amber" : "text-accent"}`} />
      <div>
        <p className="text-[15px] font-semibold" aria-live="polite">
          {state === "wartet" ? `Probe-Schularbeit: ${minuten} Minuten` : state === "um" ? "Die Zeit ist um." : `Noch ${rest} ${rest === 1 ? "Minute" : "Minuten"}`}
        </p>
        <p className="text-[13px] text-ink-2">
          {state === "wartet"
            ? "Wie bei der Schularbeit, ohne Schreibplan und ohne Hinweise. Die Zeit startet mit deinem ersten Wort."
            : state === "um"
              ? "Geh die Liste „Vor der Abgabe“ durch und gib dann ab."
              : "Schreibplan, Hinweise und Beispiel siehst du nach der Abgabe."}
        </p>
      </div>
    </div>
  );
}

/** „Vor der Abgabe“: what to check before handing in, as at the Schularbeit. Ticks stay on this page only. */
export function AbgabeCheckliste({ aufbau, open = false }: { aufbau: Aufbau; open?: boolean }) {
  const punkte = abgabeCheckliste(aufbau);
  const [ok, setOk] = useState<boolean[]>(() => punkte.map(() => false));
  const n = ok.filter(Boolean).length;
  return (
    <details className="ti-box" open={open} data-testid="abgabe-checkliste">
      <summary className="ti-summary">
        <ListChecks size={16} aria-hidden className="mr-1.5 inline align-[-3px]" />
        Vor der Abgabe prüfen{" "}
        <span className="num text-[13px] font-normal text-ink-2">
          {n} von {punkte.length}
        </span>
      </summary>
      <ul className="mt-2 grid gap-1">
        {punkte.map((p, i) => (
          <li key={p}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
              <input type="checkbox" checked={ok[i]} onChange={(e) => setOk((o) => o.map((v, j) => (j === i ? e.target.checked : v)))} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
              {p}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
