"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Follows a text that is written somewhere else (the student at the tablet). A newer version is loaded
 * as data and handed to the editor (event "lernheft-text-remote"); the page itself is not reloaded, so
 * a weak connection never costs what is typed here. Only a changed title or task reloads the page.
 */
export function TextLive({ textId }: { textId: number }) {
  const router = useRouter();
  useEffect(() => {
    let loading = false;
    let wanted = 0;
    const load = async (version: number) => {
      wanted = Math.max(wanted, version);
      if (loading) return;
      loading = true;
      try {
        const res = await fetch(`/texte/${textId}/speichern`, { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (data && typeof data.version === "number") window.dispatchEvent(new CustomEvent("lernheft-text-remote", { detail: { textId, ...data } }));
      } catch {
        // no connection: the next event (or the hello after reconnecting) tries again
      } finally {
        loading = false;
      }
    };
    const es = new EventSource(`/texte/${textId}/events`);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as { type: string; version?: number };
      if (ev.type === "text" && ev.version) void load(ev.version);
      else if (ev.type === "info" && navigator.onLine) router.refresh();
    };
    return () => es.close();
  }, [router, textId]);
  return null;
}
