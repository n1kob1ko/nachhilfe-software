"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gamepad2, GraduationCap, House, TrendingUp } from "lucide-react";
import { Gleiter } from "@/components/Bewegung";
import { useNavZiel, useVorladen } from "@/components/Navigation";

/**
 * Die fünf Seiten der Schüler-App (niko 2026-11-08: eine lange Seite mit allem war zu unübersichtlich): Start,
 * Termine, Spiele, Prüfungen, Fortschritt. „Spiele“ kam am 2026-11-11 dazu („es sollte übersichtlicher sein, wo
 * Spiele sind, und besser getrennt“): alle Lernspiele und die Duelle an einem Ort. Am Handy eine Leiste unten wie in der Lehrer-App (components/Nav.tsx), am
 * Laptop eine Reihe unter dem Kopf. Unterseiten (eine Übung, Prüfung eintragen, eine Präsentation) haben keine
 * eigene Marke; die Leiste bleibt trotzdem da, damit der Weg zurück immer sichtbar ist.
 */
// `vor`: Seiten zum Lesen, die `<Frisch />` tragen, werden beim Berühren vorgeladen (components/Navigation.tsx).
// Termine nicht: dort tauscht und fragt man an, das kommt immer frisch.
const SEITEN = [
  { key: "", label: "Start", icon: House, vor: true },
  { key: "termine", label: "Termine", icon: CalendarDays, vor: false },
  { key: "spiele", label: "Spiele", icon: Gamepad2, vor: true },
  { key: "pruefungen", label: "Prüfungen", icon: GraduationCap, vor: true },
  { key: "fortschritt", label: "Fortschritt", icon: TrendingUp, vor: true },
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
  if (erster === "spiel" || erster === "arena" || erster === "duell") return "spiele";
  return null;
}

/** Ein Tab, der seine Seite beim Zeigen oder Berühren vorlädt (components/Navigation.tsx). */
function Vor({ href, vor, ...rest }: { href: string; vor: boolean } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return <Link href={href} {...useVorladen(vor ? href : null)} {...rest} />;
}

/** `spieleHinweis`: so viele Duelle warten auf den Schüler (ein Punkt am Tab „Spiele“). */
export function SchuelerNav({ token, spieleHinweis = 0 }: { token: string; spieleHinweis?: number }) {
  const base = `/lernen/${token}`;
  // schon beim Tipp steht die Marke am neuen Tab
  const hier = usePathname();
  const aktiv = aktiveSeite(useNavZiel() ?? hier, base);
  const href = (key: string) => (key ? `${base}/${key}` : base);
  return (
    <>
      {/* Laptop und Tablet: Reihe unter dem Kopf */}
      <Gleiter as="nav" marke="bg-surface shadow-[var(--shadow-card)]" className="no-print relative mb-8 hidden w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1 md:flex" aria-label="Schüler-App">
        {SEITEN.map(({ key, label, icon: Icon, vor }) => {
          const active = aktiv === key;
          return (
            <Vor key={key} vor={vor} href={href(key)} aria-current={active ? "page" : undefined} data-gleit-ziel className={`treffer inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}>
              <Icon size={17} aria-hidden /> {label}
              {key === "spiele" && spieleHinweis > 0 && <span className="h-2 w-2 rounded-full bg-[var(--red)]" aria-label={spieleHinweis === 1 ? "ein Duell wartet" : `${spieleHinweis} Duelle warten`} />}
            </Vor>
          );
        })}
      </Gleiter>
      {/* Handy: Leiste unten, über dem Home-Balken (viewport-fit=cover in layout.tsx) */}
      <Gleiter as="nav" marke="bg-accent-bright" className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[max(8px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur md:hidden" aria-label="Schüler-App" data-testid="schueler-leiste">
        {SEITEN.map(({ key, label, icon: Icon, vor }) => {
          const active = aktiv === key;
          return (
            <Vor key={key} vor={vor} href={href(key)} aria-current={active ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11.5px] font-medium ${active ? "text-ink" : "text-ink-3"}`}>
              <span data-gleit-ziel className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-bright text-on-bright" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                {key === "spiele" && spieleHinweis > 0 && <span className="absolute top-0.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-[var(--red)]" aria-label={spieleHinweis === 1 ? "ein Duell wartet" : `${spieleHinweis} Duelle warten`} />}
              </span>
              {label}
            </Vor>
          );
        })}
      </Gleiter>
    </>
  );
}
