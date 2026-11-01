"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, GraduationCap, LayoutGrid, Users } from "lucide-react";
import { BrandMark } from "@/components/Brand";

/**
 * Die ganze Navigation: drei Bereiche für den Unterricht und „Erweitert“ (niko, 25.10.2026: „Normale Lehrkräfte
 * bekommen nur Heute, Unterricht und Abschluss. Alles andere kommt nach Erweitert und wird nie gelöscht.“).
 *
 * - **Heute** (`/`): die heutigen Schüler, je mit „Einheit starten“.
 * - **Unterricht** (`/unterricht`): führt zur laufenden Einheit; aktiv auf jeder Seite einer laufenden Einheit.
 * - **Abschluss** (`/abschluss`): führt zur beendeten, noch nicht bestätigten Einheit; aktiv auf jeder beendeten.
 * - **Schüler** (`/schueler`, niko, 01.11.2026: „bei den Kategorien sollte Schüler angezeigt werden“): die Liste und
 *   jedes Profil; aktiv auf allen Seiten unter `/schueler`.
 * - **Erweitert** (`/mehr`): alles Bisherige, also Übungen, Abrechnung, Planung, Lernpakete, Verwaltung
 *   und so weiter; aktiv überall sonst.
 *
 * `TabBar` ist auf dem Telefon ein `grid-cols-5` mit genau diesen fünf Einträgen (fünf Daumenziele); ein sechster
 * Eintrag gehört auf die Seite `/mehr`, nicht hierher. Dunkelmodus und Feedback stehen neben dem Konto.
 */
type Bereich = "heute" | "unterricht" | "abschluss" | "schueler" | "erweitert";
const ITEMS: { key: Bereich; href: string; label: string; icon: typeof CalendarDays }[] = [
  { key: "heute", href: "/", label: "Heute", icon: CalendarDays },
  { key: "unterricht", href: "/unterricht", label: "Unterricht", icon: GraduationCap },
  { key: "abschluss", href: "/abschluss", label: "Abschluss", icon: ClipboardCheck },
  { key: "schueler", href: "/schueler", label: "Schüler", icon: Users },
  { key: "erweitert", href: "/mehr", label: "Erweitert", icon: LayoutGrid },
];

/**
 * Welcher Bereich zu einer Seite gehört. Eine Einheit (`/einheiten/12`, auch Foto, Textarbeit …) ist Unterricht,
 * solange sie läuft (`laufend`: die Ids aller laufenden Einheiten), danach Abschluss.
 */
export function bereichVon(path: string, laufend: number[]): Bereich {
  if (path === "/" || path === "/jetzt") return "heute";
  if (path === "/unterricht") return "unterricht";
  if (path === "/abschluss") return "abschluss";
  if (path === "/schueler" || path.startsWith("/schueler/")) return "schueler";
  const einheit = /^\/einheiten\/(\d+)(\/|$)/.exec(path);
  if (einheit) return laufend.includes(Number(einheit[1])) ? "unterricht" : "abschluss";
  return "erweitert";
}

/** Bottom tab bar on phones: five big targets within thumb reach. */
export function TabBar({ laufend = [] }: { laufend?: number[] }) {
  const path = usePathname();
  const aktiv = bereichVon(path, laufend);
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Hauptnavigation">
      {ITEMS.map(({ key, href, label, icon: Icon }) => {
        const active = aktiv === key;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${active ? "text-ink" : "text-ink-3"}`}>
            <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-bright text-on-bright" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav({ laufend = [] }: { laufend?: number[] }) {
  const path = usePathname();
  const aktiv = bereichVon(path, laufend);
  return (
    <nav className="flex flex-col gap-1" aria-label="Hauptnavigation">
      {ITEMS.map(({ key, href, label, icon: Icon }) => {
        const active = aktiv === key;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-[46px] shrink-0 items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-[15px] font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                active ? "bg-accent-bright text-on-bright" : "text-ink-3 group-hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            </span>
            <span className={active ? "font-semibold" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Logo-Zeichen von MC Dream Education, darunter der Name der App und des Instituts. Führt dorthin, wo die Lehrkraft
 * gerade gebraucht wird (`/jetzt`: laufende Einheit, offener Abschluss oder Heute).
 */
export function Brand() {
  return (
    <Link href="/jetzt" className="flex items-center gap-2.5 rounded-2xl">
      <BrandMark height={38} />
      <span className="leading-tight">
        <span className="display block text-[18px] font-semibold tracking-[-0.01em]">DreamStudy</span>
        <span className="block text-[11.5px] font-medium whitespace-nowrap text-ink-3">MC Dream Education</span>
      </span>
    </Link>
  );
}
