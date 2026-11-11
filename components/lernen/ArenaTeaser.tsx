import Link from "next/link";
import { ChevronRight, Swords } from "lucide-react";
import { meineDuelle } from "@/lib/duelle";
import { ligaTabelle } from "@/lib/liga";
import { spielVorschlaege } from "@/lib/lernspiele";
import { wienerDatum } from "@/lib/planung/zeit";
import type { Student } from "@/lib/repo";
import { aktivesProfil, BILDER } from "@/lib/spielprofil";

/**
 * Auf dem Start der Schüler-App, unter dem Lernspiel: der Weg zu Liga und Duellen (lib/liga.ts, lib/duelle.ts). Mit
 * Profil steht der eigene Platz da und wie viele Duelle auf einen warten. Ohne Lernspiel (kein Deutsch) nichts.
 */
export function ArenaTeaser({ student, token }: { student: Student; token: string }) {
  const heute = wienerDatum();
  if (!spielVorschlaege(student, { heute }).length) return null;
  const p = aktivesProfil(student);
  const liga = p?.liga ? ligaTabelle(student, heute) : null;
  const ich = liga?.zeilen.find((z) => z.ich);
  const dran = p?.duelle ? meineDuelle(student.id).filter((d) => d.binDran).length : 0;
  return (
    <Link href={`/lernen/${token}/arena`} className="panel mt-3 flex items-center gap-4 px-5 py-3.5 transition-colors hover:border-accent" data-testid="arena-teaser">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-[22px] text-accent">{p ? BILDER[p.bild] : <Swords size={22} aria-hidden />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">Liga und Duelle</span>
        <span className="block text-[14px] text-ink-2">
          {!p
            ? "Spiel gegen andere, mit Spitzname"
            : [ich && liga ? `Platz ${ich.platz} in der ${liga.stufenName}-Liga · ${ich.punkte} Punkte` : "", dran ? (dran === 1 ? "1 Duell wartet auf dich" : `${dran} Duelle warten auf dich`) : ""].filter(Boolean).join(" · ") ||
              "Fordere jemanden heraus"}
        </span>
      </span>
      <ChevronRight size={18} className="text-ink-3" aria-hidden />
    </Link>
  );
}
