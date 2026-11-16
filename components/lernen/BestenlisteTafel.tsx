import Link from "next/link";
import { Trophy } from "lucide-react";
import type { Bestenliste } from "@/lib/lernspiele-typen";

/**
 * Die Blockwerk-Bestenliste im Tab „Spiele“ (niko 2026-11-16: „man soll wo auch das leaderboard sehen können“). Dieselbe
 * Liste wie am Anfang und Ende von Blockwerk (lib/lernspiele.ts bloeckeBestenliste): andere nur mit Spitzname und
 * Erlaubnis, die eigene Zeile immer.
 */
export function BestenlisteTafel({ liste, spielen, arena }: { liste: Bestenliste; spielen: string; arena: string }) {
  const ichUnten = liste.ich && !liste.zeilen.some((z) => z.ich) ? liste.ich : null;
  const zeilen = ichUnten ? [...liste.zeilen, ichUnten] : liste.zeilen;
  return (
    <section className="mt-9" aria-labelledby="spiele-bestenliste" data-testid="spiele-bestenliste">
      <h2 id="spiele-bestenliste" className="mb-3 flex items-center gap-2 text-[18px] font-semibold">
        <Trophy size={18} className="text-amber" aria-hidden /> Bestenliste Blockwerk
      </h2>
      {zeilen.length === 0 ? (
        <p className="panel px-5 py-4 text-[15px] text-ink-2">
          Noch hat niemand Punkte.{" "}
          <Link href={spielen} className="font-semibold text-accent underline">
            Spiel Blockwerk
          </Link>{" "}
          und hol dir Platz 1.
        </p>
      ) : (
        <div className="panel px-2 py-2">
          <ol className="grid gap-0.5">
            {zeilen.map((z, i) => (
              <li
                key={`${z.platz}-${z.name}`}
                className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-1.5 ${z.ich ? "bg-accent-wash" : ""} ${ichUnten && i === zeilen.length - 1 ? "mt-1.5 border-t border-line" : ""}`}
                aria-current={z.ich ? "true" : undefined}
              >
                <span className={`w-6 text-center text-[15px] font-extrabold tabular-nums ${z.platz <= 3 ? "text-amber" : "text-ink-3"}`}>{z.platz}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-panel text-[20px] leading-none" aria-hidden>
                  {z.bild}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                  {z.name}
                  {z.ich && z.name !== "Du" ? <span className="font-normal text-ink-3"> (du)</span> : null}
                </span>
                <span className={`text-[16px] font-bold tabular-nums ${z.ich ? "text-accent" : ""}`}>{z.punkte.toLocaleString("de-AT")}</span>
              </li>
            ))}
          </ol>
          {liste.profil !== "da" && (
            <p className="mt-1 px-3 pb-1.5 text-[13px] leading-snug text-ink-3">
              {liste.profil === "anlegen" ? (
                <>
                  Nur du siehst dich hier.{" "}
                  <Link href={arena} className="font-semibold text-accent underline">
                    Mit Spitzname mitspielen
                  </Link>
                  , dann sehen dich alle.
                </>
              ) : (
                "Nur du siehst dich hier. Dein Lehrer hat Liga und Duelle für dich ausgeschaltet."
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
