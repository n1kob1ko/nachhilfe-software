"use client";

import "./arena.css";
import Link from "next/link";
import { ChevronRight, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { liveDuellAction } from "@/app/wettspiel-actions";

/**
 * Auf dem Start der Schüler-App: startet der Lehrer im Unterricht ein Live-Duell (lib/duelle.ts), erscheint es hier
 * von selbst (alle 3 Sekunden nachfragen, solange die Seite offen und sichtbar ist).
 */
export function LiveDuellRuf({ token, anfang }: { token: string; anfang: number | null }) {
  const [id, setId] = useState(anfang);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void liveDuellAction(token).then(setId);
    }, 3000);
    return () => clearInterval(t);
  }, [token]);
  if (!id) return null;
  return (
    <Link href={`/lernen/${token}/duell/${id}`} className="ar-ruf mt-6" data-testid="live-duell-ruf">
      <Swords size={28} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-wide uppercase opacity-85">Live-Duell</span>
        <span className="block text-[18px] font-bold">Ein Duell wartet auf dich</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#1f5fd0]">
        Mitmachen <ChevronRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
