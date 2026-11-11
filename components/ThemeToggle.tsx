"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { IconWechsel } from "@/components/Bewegung";

/**
 * Der Knopf für den Dunkelmodus (niko, 21.10.2026): Mond heißt „dunkel schalten“, Sonne „hell schalten“.
 * Die Wahl steht als `data-theme` am <html> (die Farben dazu in app/globals.css) und wird je Gerät im
 * Browser gemerkt; beim nächsten Öffnen setzt das kleine Skript in app/layout.tsx sie vor dem ersten Bild.
 * Ohne Wahl bleibt die App hell.
 */
const SCHLUESSEL = "lernheft-theme";
const LEISTENFARBE = { light: "#f5f8fc", dark: "#0f1620" } as const;
type Theme = keyof typeof LEISTENFARBE;

function anwenden(theme: Theme) {
  const html = document.documentElement;
  if (theme === "dark") html.dataset.theme = "dark";
  else delete html.dataset.theme;
  // die Farbe der Browserleiste am Handy folgt mit
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", LEISTENFARBE[theme]));
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // der Server kennt die Wahl nicht; erst nach dem ersten Bild zeigt der Knopf das richtige Symbol
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const t: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(t);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", LEISTENFARBE[t]));
  }, []);
  const dark = theme === "dark";
  const wechseln = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = dark ? "light" : "dark";
    const umschalten = () => {
      anwenden(next);
      try {
        localStorage.setItem(SCHLUESSEL, next);
      } catch {
        // privates Fenster: dann gilt die Wahl nur bis zum Schließen
      }
      setTheme(next);
    };
    // Die neue Ansicht deckt sich als Kreis vom Knopf aus auf, die alte bleibt darunter stehen (Bewegung, Regeln 16 und 17).
    // Wo der Browser das nicht kann oder „weniger Bewegung“ gilt, schaltet es wie bisher sofort um.
    const html = document.documentElement;
    if (typeof document.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      umschalten();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    html.dataset.themenwechsel = "";
    const vt = document.startViewTransition(umschalten);
    vt.ready
      .then(() =>
        html.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
    vt.finished.finally(() => delete html.dataset.themenwechsel).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={wechseln}
      aria-label={dark ? "Hell schalten" : "Dunkel schalten"}
      title={dark ? "Hell schalten" : "Dunkel schalten"}
      aria-pressed={dark}
      className={`drueck flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink ${className}`}
    >
      <IconWechsel an={dark} aus={<Moon size={18} strokeWidth={2} aria-hidden />} ein={<Sun size={18} strokeWidth={2} aria-hidden />} />
    </button>
  );
}
