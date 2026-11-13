"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, GraduationCap, LayoutGrid, Users } from "lucide-react";
import { BrandMark } from "@/components/Brand";
import { Gleiter } from "@/components/Bewegung";
import { useNavZiel, useVorladen } from "@/components/Navigation";

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
// `vor`: Seiten zum Lesen werden beim Zeigen oder Berühren ganz vorgeladen und sind dann sofort da (components/Navigation.tsx).
// Unterricht und Abschluss führen oft weiter in eine Einheit mit Eingaben; die kommt immer frisch.
const ITEMS: { key: Bereich; href: string; label: string; icon: typeof CalendarDays; vor?: boolean }[] = [
  { key: "heute", href: "/", label: "Heute", icon: CalendarDays, vor: true },
  { key: "unterricht", href: "/unterricht", label: "Unterricht", icon: GraduationCap },
  { key: "abschluss", href: "/abschluss", label: "Abschluss", icon: ClipboardCheck },
  { key: "schueler", href: "/schueler", label: "Schüler", icon: Users, vor: true },
  { key: "erweitert", href: "/mehr", label: "Erweitert", icon: LayoutGrid, vor: true },
];

type Eintrag = (typeof ITEMS)[number];

/** Ein Eintrag der Leiste unten am Telefon. */
function TabEintrag({ item: { href, label, icon: Icon, vor }, active }: { item: Eintrag; active: boolean }) {
  return (
    <Link href={href} {...useVorladen(vor ? href : null)} aria-current={active ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${active ? "text-ink" : "text-ink-3"}`}>
      <span data-gleit-ziel className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-accent-bright text-on-bright" : ""}`}>
        <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
      </span>
      {label}
    </Link>
  );
}

/** Ein Eintrag der Leiste links am Laptop. */
function NavEintrag({ item: { href, label, icon: Icon, vor }, active }: { item: Eintrag; active: boolean }) {
  return (
    <Link
      href={href}
      {...useVorladen(vor ? href : null)}
      aria-current={active ? "page" : undefined}
      data-gleit-ziel
      className={`group flex min-h-[46px] shrink-0 items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-[15px] font-medium transition-colors ${
        active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
      }`}
    >
      <span
        data-gleit-ziel
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          active ? "bg-accent-bright text-on-bright" : "text-ink-3 group-hover:text-ink"
        }`}
      >
        <Icon size={17} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
      </span>
      <span className={active ? "font-semibold" : ""}>{label}</span>
    </Link>
  );
}

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
  // schon beim Tipp steht die Marke am neuen Eintrag, nicht erst, wenn die Seite geladen ist
  const hier = usePathname();
  const path = useNavZiel() ?? hier;
  const aktiv = bereichVon(path, laufend);
  return (
    <Gleiter as="nav" marke="bg-accent-bright" className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[max(8px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur md:hidden" aria-label="Hauptnavigation">
      {ITEMS.map((item) => (
        <TabEintrag key={item.href} item={item} active={aktiv === item.key} />
      ))}
    </Gleiter>
  );
}

export function Nav({ laufend = [] }: { laufend?: number[] }) {
  // schon beim Tipp steht die Marke am neuen Eintrag, nicht erst, wenn die Seite geladen ist
  const hier = usePathname();
  const path = useNavZiel() ?? hier;
  const aktiv = bereichVon(path, laufend);
  return (
    <Gleiter as="nav" marke="gleit-nav bg-surface shadow-[var(--shadow-card)]" className="relative flex flex-col gap-1" aria-label="Hauptnavigation">
      {ITEMS.map((item) => (
        <NavEintrag key={item.href} item={item} active={aktiv === item.key} />
      ))}
    </Gleiter>
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
