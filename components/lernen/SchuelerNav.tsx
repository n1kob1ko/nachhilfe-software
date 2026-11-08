"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, House, TrendingUp } from "lucide-react";

/**
 * Die vier Seiten der Schüler-App (niko 2026-11-08: eine lange Seite mit allem war zu unübersichtlich): Start,
 * Termine, Prüfungen, Fortschritt. Am Handy eine Leiste unten wie in der Lehrer-App (components/Nav.tsx), am
 * Laptop eine Reihe unter dem Kopf. Unterseiten (eine Übung, Prüfung eintragen, eine Präsentation) haben keine
 * eigene Marke; die Leiste bleibt trotzdem da, damit der Weg zurück immer sichtbar ist.
 */
const SEITEN = [
  { key: "", label: "Start", icon: House },
  { key: "termine", label: "Termine", icon: CalendarDays },
  { key: "pruefungen", label: "Prüfungen", icon: GraduationCap },
  { key: "fortschritt", label: "Fortschritt", icon: TrendingUp },
] as const;

function aktiveSeite(path: string, base: string): string | null {
  if (!path.startsWith(base)) return null;
  const rest = path.slice(base.length).replace(/^\//, "");
  const erster = rest.split("/")[0];
  if (erster === "") return "";
  if (SEITEN.some((s) => s.key === erster)) return erster;
  // Unterseiten leuchten dort, wo man hergekommen ist: eine Übung und die Tafel bei Start, Eintragen und Präsentation bei Prüfungen
  if (/^\d+$/.test(erster) || erster === "tafel") return "";
  if (erster === "pruefung" || erster === "praesentation") return "pruefungen";
  return null;
}

export function SchuelerNav({ token }: { token: string }) {
  const base = `/lernen/${token}`;
  const aktiv = aktiveSeite(usePathname(), base);
  const href = (key: string) => (key ? `${base}/${key}` : base);
  return (
    <>
      {/* Laptop und Tablet: Reihe unter dem Kopf */}
      <nav className="no-print mb-8 hidden w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1 md:flex" aria-label="Schüler-App">
        {SEITEN.map(({ key, label, icon: Icon }) => {
          const active = aktiv === key;
          return (
            <Link key={key} href={href(key)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}>
              <Icon size={17} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
      {/* Handy: Leiste unten, über dem Home-Balken (viewport-fit=cover in layout.tsx) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 pb-[max(8px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur md:hidden" aria-label="Schüler-App" data-testid="schueler-leiste">
        {SEITEN.map(({ key, label, icon: Icon }) => {
          const active = aktiv === key;
          return (
            <Link key={key} href={href(key)} aria-current={active ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${active ? "text-ink" : "text-ink-3"}`}>
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-bright text-on-bright" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
