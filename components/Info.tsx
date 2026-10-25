"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info as InfoIcon } from "lucide-react";

/**
 * Small ⓘ that shows a short explanation on tap or click; works on tablets, where hover tooltips never appear.
 * The button is 44 px on every device (not only on touch screens), with a margin of −6 px: it takes the room of 32 px
 * in the line, so the text around it does not move. The note opens to the side where it fits on the screen.
 */
export function Info({ children, label = "Mehr Infos", align = "left" }: { children: React.ReactNode; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [seite, setSeite] = useState(align);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const r = ref.current?.getBoundingClientRect();
          if (!open && r) {
            const breite = Math.min(320, window.innerWidth * 0.8);
            const rechtsPlatz = r.left + breite <= window.innerWidth - 8;
            const linksPlatz = r.right - breite >= 8;
            setSeite(align === "left" ? (rechtsPlatz || !linksPlatz ? "left" : "right") : linksPlatz || !rechtsPlatz ? "right" : "left");
          }
          setOpen((o) => !o);
        }}
        className="-m-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-panel hover:text-ink"
      >
        <InfoIcon size={16} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={`absolute top-9 z-30 w-[min(320px,80vw)] rounded-xl border border-line bg-surface px-4 py-3 text-left text-[13px] leading-relaxed font-normal tracking-normal text-ink-2 shadow-[var(--shadow-card)] ${
            seite === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
