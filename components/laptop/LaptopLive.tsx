"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Leave the laptop page on purpose: open texts save what they have, no "leave page?" question. */
export function leaveTo(href: string) {
  document.documentElement.dataset.leaving = "1";
  window.dispatchEvent(new Event("lernheft-save-now"));
  window.location.replace(href);
}

/**
 * Keeps the laptop in step with the unit: one live connection. A confirmation, a new exercise or text
 * reloads the view; the end of the access (unit over, teacher ended it) leaves the work area at once.
 */
export function LaptopLive({ state, view, children }: { state: "wartet" | "aktiv"; view: string; children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const es = new EventSource("/mitmachen/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as { type: string; state?: string; view?: string };
      if (ev.type === "ended") {
        es.close();
        leaveTo("/mitmachen");
      } else if (ev.type === "hello") {
        setOnline(true);
        // after being offline: catch up with what happened in the meantime
        if (ev.state !== state) leaveTo("/mitmachen");
        else if (ev.view !== view) router.refresh();
      } else if (ev.type === "refresh") {
        if (state === "wartet") leaveTo("/mitmachen");
        else router.refresh();
      }
    };
    const back = () => setOnline(true);
    const gone = () => setOnline(false);
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    return () => {
      es.close();
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
    };
  }, [router, state, view]);
  return (
    <>
      {children}
      <p
        role="status"
        data-testid="laptop-online"
        data-online={online ? "1" : "0"}
        className={`fixed right-4 bottom-4 z-[60] inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold shadow-[var(--shadow-card)] ${online ? "bg-surface text-ink-2" : "bg-red-wash text-red"}`}
      >
        <span className={`h-2 w-2 rounded-full ${online ? "bg-green" : "bg-red"}`} aria-hidden />
        {online ? "Verbunden" : "Keine Verbindung – deine Arbeit bleibt auf diesem Gerät, bis sie gespeichert ist"}
      </p>
    </>
  );
}
