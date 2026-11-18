/**
 * Spielmusik für Blockwerk (niko 2026-11-18, mit Higgsfield gemacht): zwei ruhige Stücke zu je einer Minute
 * (public/spiele/blockwerk/musik-a.mp3, musik-b.mp3), die sich abwechseln. Leise, damit die Töne aus klang.ts darüber
 * gut zu hören sind.
 *
 * An und aus mit dem Noten-Knopf im Kopf des Spiels; die Wahl merkt sich das Gerät (localStorage „ls-musik“). Sind
 * die Töne aus (Lautsprecher-Knopf), schweigt auch die Musik. Browser spielen erst nach einem Tippen: klappt der Start
 * nicht, kommt die Musik beim nächsten Tippen aufs Spiel. Ist die Seite verdeckt (anderer Tab, Handy gesperrt), pausiert sie.
 */

import { aufTon, tonAn } from "./klang";

export const STUECKE = ["/spiele/blockwerk/musik-a.mp3", "/spiele/blockwerk/musik-b.mp3"];
const LAUT = 0.32;
const SCHLUESSEL = "ls-musik";

let aus: boolean | null = null;
const hoerer = new Set<(an: boolean) => void>();

export function musikAn(): boolean {
  if (aus === null) {
    try {
      aus = window.localStorage.getItem(SCHLUESSEL) === "aus";
    } catch {
      aus = false;
    }
  }
  return !aus;
}

export function setzeMusik(an: boolean) {
  aus = !an;
  try {
    window.localStorage.setItem(SCHLUESSEL, an ? "an" : "aus");
  } catch {
    // privates Fenster: gilt nur für diesen Besuch
  }
  for (const h of hoerer) h(an);
}

/** Für den Knopf: meldet jede Änderung. */
export function aufMusik(h: (an: boolean) => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/**
 * Lässt die Musik laufen, solange das Spiel offen ist. Gibt eine Funktion zum Aufhören zurück (für useEffect).
 */
export function spieleMusik(): () => void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return () => {};
  let nr = 0;
  let el: HTMLAudioElement | null = null;
  let vorbei = false;

  const soll = () => !vorbei && musikAn() && tonAn() && document.visibilityState !== "hidden";

  const stueck = () => {
    if (!el) {
      el = new Audio(STUECKE[nr % STUECKE.length]);
      el.volume = LAUT;
      el.preload = "auto";
      // nach einer Minute kommt das andere Stück
      el.addEventListener("ended", () => {
        nr++;
        el = null;
        pruefe();
      });
    }
    return el;
  };

  // klappt das Abspielen nicht (noch kein Tippen), beim nächsten Tippen nochmal
  const beimTippen = () => pruefe();
  const warteAufTippen = () => document.addEventListener("pointerdown", beimTippen, { once: true, capture: true });

  function pruefe() {
    if (soll()) {
      const a = stueck();
      if (a.paused) {
        a.play().catch(() => {
          if (!vorbei) warteAufTippen();
        });
      }
    } else {
      el?.pause();
    }
  }

  const ohneTon = aufTon(pruefe);
  const ohneMusik = aufMusik(pruefe);
  document.addEventListener("visibilitychange", pruefe);
  pruefe();

  return () => {
    vorbei = true;
    ohneTon();
    ohneMusik();
    document.removeEventListener("visibilitychange", pruefe);
    document.removeEventListener("pointerdown", beimTippen, { capture: true });
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      el = null;
    }
  };
}
