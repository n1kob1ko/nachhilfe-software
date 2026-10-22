"use client";

import { useEffect, useRef } from "react";
import { geheZu, leseDeckNachricht, vonDeck, type Stelle } from "@/lib/praesentation-protokoll";

/**
 * An uploaded presentation in its sandbox: scripts may run, nothing else (no same origin, no forms, no
 * popups, no navigation of the page). Speaks the small protocol of lib/praesentation-protokoll.ts: it
 * reports where the deck is (`onStelle`) and sends the deck to `ziel` when that changes from outside.
 * `senden` gets a function for other messages („weiter“, „zurueck“).
 */
export function DeckFrame({
  src,
  deckOrigin,
  ziel,
  title,
  onStelle,
  onBereit,
  senden,
}: {
  src: string;
  deckOrigin: string | null;
  /** where the app wants the deck; it is sent there when this changes */
  ziel: Stelle;
  title: string;
  onStelle?: (s: Stelle, folien: number | null) => void;
  onBereit?: (folien: number | null) => void;
  senden?: React.RefObject<((m: object) => void) | null>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // where the deck last said it is: sending that back would only make it jump
  const gemeldet = useRef<Stelle | null>(null);
  const soll = useRef(ziel);
  const cb = useRef({ onStelle, onBereit });
  useEffect(() => {
    cb.current = { onStelle, onBereit };
  });

  useEffect(() => {
    // the sandboxed deck has an opaque origin, so it cannot be named as target; the messages only hold numbers
    const post = (m: object) => frame.current?.contentWindow?.postMessage(m, "*");
    if (senden) senden.current = post;
    const hoer = (e: MessageEvent) => {
      if (!vonDeck(e, frame.current?.contentWindow, deckOrigin)) return;
      const m = leseDeckNachricht(e.data);
      if (!m) return;
      if (m.typ === "bereit") {
        cb.current.onBereit?.(m.folien);
        // the deck has just loaded: bring it to where the app is
        if (soll.current.folie > 1 || soll.current.schritt !== null) post(geheZu(soll.current));
      } else {
        gemeldet.current = { folie: m.folie, schritt: m.schritt };
        cb.current.onStelle?.({ folie: m.folie, schritt: m.schritt }, m.folien);
      }
    };
    window.addEventListener("message", hoer);
    return () => {
      window.removeEventListener("message", hoer);
      if (senden) senden.current = null;
    };
  }, [deckOrigin, senden]);

  useEffect(() => {
    soll.current = { folie: ziel.folie, schritt: ziel.schritt };
    const g = gemeldet.current;
    if (g && g.folie === ziel.folie && g.schritt === ziel.schritt) return;
    frame.current?.contentWindow?.postMessage(geheZu(ziel), "*");
  }, [ziel.folie, ziel.schritt]);

  return <iframe ref={frame} src={src} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer" className="block h-full w-full border-0" />;
}
