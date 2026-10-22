"use client";

import { useEffect, useState } from "react";
import type { Stelle } from "@/lib/praesentation-protokoll";
import { DeckFrame } from "./DeckFrame";

/**
 * The presentation on the student device (tablet or own laptop): only the slides, never the Vortragstext.
 * It follows the teacher: DeviceLive / LaptopLive pass the teacher's „folie“ events on as a window event.
 */
export function SchuelerDeck({ praesId, title, src, deckOrigin, folie }: { praesId: number; title: string; src: string; deckOrigin: string | null; folie: number }) {
  const [ziel, setZiel] = useState<Stelle>({ folie, schritt: null });
  useEffect(() => setZiel({ folie, schritt: null }), [folie]);
  useEffect(() => {
    const folge = (e: Event) => {
      const d = (e as CustomEvent<{ praesentation?: unknown; folie?: unknown; schritt?: unknown }>).detail;
      if (!d || d.praesentation !== praesId || typeof d.folie !== "number") return;
      setZiel({ folie: d.folie, schritt: typeof d.schritt === "number" ? d.schritt : null });
    };
    window.addEventListener("lernheft-folie", folge);
    return () => window.removeEventListener("lernheft-folie", folge);
  }, [praesId]);
  return (
    <div className="aspect-video w-full overflow-hidden rounded-[18px] border border-line bg-black">
      <DeckFrame src={src} deckOrigin={deckOrigin} ziel={ziel} title={title} />
    </div>
  );
}
