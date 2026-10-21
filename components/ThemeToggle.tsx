"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
  const wechseln = () => {
    const next: Theme = dark ? "light" : "dark";
    anwenden(next);
    try {
      localStorage.setItem(SCHLUESSEL, next);
    } catch {
      // privates Fenster: dann gilt die Wahl nur bis zum Schließen
    }
    setTheme(next);
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
      {dark ? <Sun size={18} strokeWidth={2} aria-hidden /> : <Moon size={18} strokeWidth={2} aria-hidden />}
    </button>
  );
}
