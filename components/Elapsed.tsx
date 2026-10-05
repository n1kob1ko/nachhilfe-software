"use client";

import { useEffect, useState } from "react";

function label(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
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
