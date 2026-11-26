"use client";

import { useEffect } from "react";
import { versatzUnten } from "@/lib/unten-fest";

/**
 * Hält jede Leiste mit `data-unten-fest` am unteren Rand des sichtbaren Bereichs, auch wenn iOS 26 die fixierten
 * Elemente verschiebt (lib/unten-fest.ts). Einmal im Root-Layout; ohne `visualViewport` tut es nichts.
 */
export function UntenFest() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let bild = 0;
    const schreibt = () => {
      const a = document.activeElement;
      return a instanceof HTMLElement && (a.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !(a as HTMLInputElement).readOnly));
    };
    const setzen = () => {
      bild = 0;
      const d = versatzUnten(vv, window.innerHeight, schreibt());
      document.querySelectorAll<HTMLElement>("[data-unten-fest]").forEach((el) => {
        el.style.translate = d ? `0 ${d}px` : "";
      });
    };
    const bald = () => {
      if (!bild) bild = requestAnimationFrame(setzen);
    };
    vv.addEventListener("resize", bald);
    vv.addEventListener("scroll", bald);
    window.addEventListener("scroll", bald, { passive: true });
    window.addEventListener("resize", bald);
    document.addEventListener("focusin", bald);
    document.addEventListener("focusout", bald);
    setzen();
    return () => {
      cancelAnimationFrame(bild);
      vv.removeEventListener("resize", bald);
      vv.removeEventListener("scroll", bald);
      window.removeEventListener("scroll", bald);
      window.removeEventListener("resize", bald);
      document.removeEventListener("focusin", bald);
      document.removeEventListener("focusout", bald);
    };
  }, []);
  return null;
}
