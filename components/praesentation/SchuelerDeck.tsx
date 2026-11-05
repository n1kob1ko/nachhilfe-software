"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Stelle } from "@/lib/praesentation-protokoll";
import { DeckFrame } from "./DeckFrame";

type VollbildElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type VollbildDokument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
const imVollbild = () => Boolean(document.fullscreenElement ?? (document as VollbildDokument).webkitFullscreenElement);

/**
 * The presentation on the student device (tablet or own laptop): only the slides, never the Vortragstext.
 * It follows the teacher: DeviceLive / LaptopLive pass the teacher's „folie“ events on as a window event.
 * The student cannot turn the slides: a layer above the frame takes every tap, and the deck is sent back
 * when it moves on its own. „Vollbild“ shows the slides on the whole screen (real fullscreen where the
 * browser allows it, otherwise the page is covered).
 */
export function SchuelerDeck({ praesId, title, src, deckOrigin, folie }: { praesId: number; title: string; src: string; deckOrigin: string | null; folie: number }) {
  const [ziel, setZiel] = useState<Stelle>({ folie, schritt: null });
  const [voll, setVoll] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const geaendert = () => {
      if (!imVollbild()) setVoll(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVoll(false);
    };
    document.addEventListener("fullscreenchange", geaendert);
    document.addEventListener("webkitfullscreenchange", geaendert);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("fullscreenchange", geaendert);
      document.removeEventListener("webkitfullscreenchange", geaendert);
      document.removeEventListener("keydown", taste);
    };
  }, []);

  const umschalten = async () => {
    const an = !voll;
    setVoll(an);
    const el = huelle.current as VollbildElement | null;
    const doc = document as VollbildDokument;
    try {
      if (an && el && !imVollbild()) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else await el.webkitRequestFullscreen?.();
        // a tablet held upright: turn the slides sideways where the browser allows it
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => {});
      }
      if (!an && imVollbild()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      }
    } catch {
      // no real fullscreen (iPhone): the slides still cover the page
    }
  };

  return (
    <div
      ref={huelle}
      className={voll ? "fixed inset-0 z-[100] flex items-center justify-center bg-black" : "relative"}
    >
      <div
        className={voll ? "relative aspect-video overflow-hidden bg-black" : "relative aspect-video w-full overflow-hidden rounded-[18px] border border-line bg-black"}
        style={voll ? { width: "min(100vw, calc(100dvh * 16 / 9))" } : undefined}
      >
        <DeckFrame src={src} deckOrigin={deckOrigin} ziel={ziel} title={title} nurFolgen />
        {/* takes every tap, so only the teacher turns the slides */}
        <div className="absolute inset-0" aria-hidden onPointerDown={(e) => e.preventDefault()} />
      </div>
      <button
        type="button"
        onClick={umschalten}
        className={
          voll
            ? "absolute right-3 top-3 flex min-h-11 items-center gap-2 rounded-full bg-black/60 px-4 text-[15px] font-semibold text-white"
            : "mt-3 flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-[15px] font-semibold"
        }
      >
        {voll ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
        {voll ? "Vollbild beenden" : "Vollbild"}
      </button>
    </div>
  );
}
