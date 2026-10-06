"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Keeps the tablet in step with the teacher: one live connection; whenever the teacher starts or ends
 * a unit or sends something, the view is loaded again (without reloading the page).
 */
export function DeviceLive({ unitId, children }: { unitId: number | null; children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const es = new EventSource("/geraet/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as { type: string; unitId?: number | null; reason?: string };
      if (ev.type === "hello") {
        setOnline(true);
        // after being offline: catch up if a unit started or ended in the meantime
        if ((ev.unitId ?? null) !== unitId) router.refresh();
      } else if (ev.type === "refresh") {
        if (ev.reason === "getrennt") window.location.replace("/geraet");
        else router.refresh();
      }
    };
    return () => es.close();
  }, [router, unitId]);
  return (
    <>
      {children}
      <span
        className={`fixed right-3 bottom-3 z-[60] h-2.5 w-2.5 rounded-full ${online ? "bg-green" : "bg-red"}`}
        role="status"
        aria-label={online ? "Tablet verbunden" : "Tablet nicht verbunden"}
        title={online ? "verbunden" : "Verbindung unterbrochen"}
      />
    </>
  );
}
