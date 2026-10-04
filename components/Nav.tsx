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
    <nav className="flex gap-1 md:flex-col" aria-label="Hauptnavigation">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,29,35,0.08)]" : "text-ink-2 hover:bg-[#e6e2d8] hover:text-ink"
            }`}
          >
            <Icon size={17} strokeWidth={1.75} className={active ? "text-accent" : ""} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-3 text-[17px] font-semibold tracking-[-0.01em]">
      <NotebookPen size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
      Lernheft
    </Link>
  );
}
