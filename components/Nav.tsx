"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Clock3, GitBranch, LayoutDashboard, NotebookPen, ReceiptText, Users } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/schueler", label: "Schüler", icon: Users },
  { href: "/uebungen", label: "Übungen", icon: BookOpenCheck },
  { href: "/faehigkeiten", label: "Fähigkeiten", icon: GitBranch },
  { href: "/einheiten", label: "Einheiten", icon: Clock3 },
  { href: "/abrechnung", label: "Abrechnung", icon: ReceiptText },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1.5 md:flex-col" aria-label="Hauptnavigation">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-[14px] font-medium transition-colors ${
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
