"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, House, Menu, NotebookPen, ReceiptText, Users } from "lucide-react";

/** The whole main navigation. Everything rarely needed (skills, unit log, teachers, export) lives under "Mehr". */
const ITEMS = [
  { href: "/", label: "Start", icon: House, match: ["/"] },
  { href: "/schueler", label: "Schüler", icon: Users, match: ["/schueler", "/einheiten/"] },
  { href: "/uebungen", label: "Übungen", icon: BookOpenCheck, match: ["/uebungen"] },
  { href: "/abrechnung", label: "Abrechnung", icon: ReceiptText, match: ["/abrechnung"] },
  { href: "/mehr", label: "Mehr", icon: Menu, match: ["/mehr", "/faehigkeiten", "/lehrer", "/export"] },
];

const isActive = (path: string, match: string[]) =>
  match.some((m) => (m === "/" ? path === "/" : m.endsWith("/") ? path.startsWith(m) : path === m || path.startsWith(`${m}/`))) ||
  (match.includes("/mehr") && path === "/einheiten");

/** Bottom tab bar on phones and small tablets: five big targets within thumb reach. */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Hauptnavigation">
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = isActive(path, match);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${active ? "text-accent" : "text-ink-2"}`}>
            <span className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-accent-wash" : ""}`}>
              <Icon size={20} strokeWidth={1.9} aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1.5" aria-label="Hauptnavigation">
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = isActive(path, match);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-[48px] shrink-0 items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-[15px] font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                active ? "bg-accent-bright text-white shadow-[0_6px_14px_-6px_rgba(238,122,69,0.9)]" : "bg-surface text-ink-2 group-hover:text-accent"
              }`}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden />
            </span>
            <span className={active ? "font-semibold" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.01em]">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-card)]">
        <NotebookPen size={20} strokeWidth={2} className="text-accent-bright" aria-hidden />
      </span>
      <span className="display">Lernheft</span>
    </Link>
  );
}
