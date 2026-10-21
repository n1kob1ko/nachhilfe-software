"use client";

import { useEffect, useState } from "react";

function label(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/**
 * „noch 38 min“ bis zum geplanten Ende, danach „12 min über der Zeit“. Der Server gibt die Minuten
 * zum Zeitpunkt `ab` mit (Europe/Vienna, lib/planung/heute.ts); hier läuft die Uhr weiter, damit die
 * Zahl ohne Neuladen stimmt. Nach dem Ende wird die Schrift rot, aber nur leicht: es ist ein Hinweis.
 */
export function Restzeit({ rest, ab, className = "" }: { rest: number; ab: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  const min = Math.round(rest - (now - ab) / 60_000);
  const ueber = min < 0;
  return (
    <span className={`num ${ueber ? "font-semibold" : ""} ${className}`} suppressHydrationWarning data-testid="restzeit">
      {ueber ? `${-min} min über der Zeit` : min === 0 ? "Zeit ist um" : `noch ${min} min`}
    </span>
  );
}

/** Running duration since `since`, refreshed every 20 s. Computed from the stored start time, so a reload changes nothing. */
export function Elapsed({ since }: { since: string }) {
  const start = Date.parse(since);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="num" suppressHydrationWarning>
      {label(now - start)}
    </span>
  );
}
