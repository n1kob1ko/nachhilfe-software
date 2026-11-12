"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SpiegelAufnahme } from "./SpiegelAufnahme";

/**
 * Keeps the tablet in step with the teacher: one live connection; whenever the teacher starts or ends
 * a unit or sends something, the view is loaded again (without reloading the page).
 */
export function DeviceLive({ unitId, choosing = false, view, children }: { unitId: number | null; choosing?: boolean; view?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  // Schüler-Bildschirm (lib/spiegel.ts): the teacher watches, so this page records itself; `neu` asks for a fresh picture
  const [spiegel, setSpiegel] = useState(false);
  const [neu, setNeu] = useState(0);
  const spiegelAus = useCallback(() => setSpiegel(false), []);
  useEffect(() => {
    const es = new EventSource("/geraet/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as { type: string; unitId?: number | null; choosing?: boolean; reason?: string; view?: string; spiegel?: boolean; an?: boolean; neu?: boolean; c?: unknown };
      if (ev.type === "hello") {
        setOnline(true);
        // a unit page watches (also after a reconnect): record, starting with a full picture
        setSpiegel(Boolean(ev.spiegel) && unitId !== null);
        if (ev.spiegel) setNeu((n) => n + 1);
        // after being offline: catch up if a unit started or ended (or a second one started) in the meantime,
        // or the presentation on show moved on
        if ((ev.unitId ?? null) !== unitId || Boolean(ev.choosing) !== choosing || (view?.startsWith("praesentation:") && ev.view !== view)) router.refresh();
      } else if (ev.type === "folie") {
        // the teacher turned the slide: the presentation follows without a reload (components/praesentation/SchuelerDeck.tsx)
        window.dispatchEvent(new CustomEvent("lernheft-folie", { detail: ev }));
      } else if (ev.type === "spiegel") {
        setSpiegel(Boolean(ev.an) && unitId !== null);
        if (ev.neu) setNeu((n) => n + 1);
      } else if (ev.type === "steuern") {
        // Eingreifen: the teacher taps or types on this page (SpiegelAufnahme plays it)
        window.dispatchEvent(new CustomEvent("dreamstudy-steuern", { detail: ev.c }));
      } else if (ev.type === "refresh") {
        if (ev.reason === "getrennt") window.location.replace("/geraet");
        else router.refresh();
      }
    };
    return () => es.close();
  }, [router, unitId, choosing, view]);
  return (
    <>
      {children}
      <SpiegelAufnahme an={spiegel} neu={neu} aus={spiegelAus} />
      <span
        className={`fixed right-3 bottom-3 z-[60] h-2.5 w-2.5 rounded-full ${online ? "bg-green" : "bg-red"}`}
        role="status"
        aria-label={online ? "Tablet verbunden" : "Tablet nicht verbunden"}
        title={online ? "verbunden" : "Verbindung unterbrochen"}
      />
    </>
  );
}
