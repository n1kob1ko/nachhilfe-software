import Link from "next/link";
import { CalendarDays, ChevronRight, Flame, Shapes } from "lucide-react";
import { serie, spielVorschlaege } from "@/lib/lernspiele";
import { SPIEL_TITEL } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import type { Student } from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

/**
 * Auf dem Start der Schüler-App: das Lernspiel, das gerade zum Stoff passt, mit dem Grund („Schularbeit in 9 Tagen“)
 * und der Serie. Alle Spiele und die Duelle stehen im Tab „Spiele“. Ohne passendes Spiel (kein Deutsch) steht hier nichts.
 */
export function LernspielTeaser({ student, token }: { student: Student; token: string }) {
  const heute = wienerDatum();
  const analyse = analyzeStudent(student.id);
  const lernstand = new Map((analyse?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  const v = spielVorschlaege(student, { heute, lernstand })[0];
  if (!v) return null;
  const tage = serie(student.id, heute);
  return (
    <Link href={`/lernen/${token}/spiel?art=${v.art}&von=start`} className="panel mt-8 flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent" data-testid="lernspiel-teaser">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--deutsch-soft)] text-[var(--deutsch-fg)]">
        <Shapes size={24} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Lernspiel</span>
        <span className="block text-[17px] font-semibold">{SPIEL_TITEL[v.art]}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[14px] text-ink-2">
          {v.quelle !== "fach" && (
            <span className="inline-flex items-center gap-1">
              {v.quelle === "pruefung" && <CalendarDays size={14} aria-hidden />}
              {v.grund}
            </span>
          )}
          {tage > 0 && (
            <span className="inline-flex items-center gap-1 text-amber">
              <Flame size={14} aria-hidden />
              {tage === 1 ? "1 Tag" : `${tage} Tage`}
            </span>
          )}
        </span>
      </span>
      <span className="btn btn-primary">
        Spielen <ChevronRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
