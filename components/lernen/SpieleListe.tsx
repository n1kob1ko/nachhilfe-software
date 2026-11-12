import "@/components/lernen/spiele.css";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flame } from "lucide-react";
import { serie, skillFuerSpiel, spielWoher } from "@/lib/lernspiele";
import { SPIEL_ARTEN, SPIEL_DEKO, SPIEL_FACH, SPIEL_KURZ, SPIEL_TITEL, type SpielArt, type SpielVorschlag } from "@/lib/lernspiele-typen";
import type * as repo from "@/lib/repo";

/** Warum ein Spiel gerade passt, kurz für das Schild auf der Kachel. */
const SCHILD: Partial<Record<SpielVorschlag["quelle"], string>> = { pruefung: "Schularbeit", stoff: "Dein Stoff", einheit: "Letzte Einheit", lernstand: "Üben lohnt sich" };

/**
 * Die Spiele eines Schülers: oben „Für dich“ das Spiel, das gerade zum Stoff passt, darunter alle Spiele als Kacheln
 * nach Fach. Im Tab „Spiele“ der Schüler-App und am Schüler-Tablet in der Einheit (app/geraet/page.tsx); `href` sagt,
 * wohin eine Kachel führt. `vorschlaege` darf nicht leer sein.
 */
export function SpieleListe({
  student,
  heute,
  lernstand,
  vorschlaege,
  href,
}: {
  student: repo.Student;
  heute: string;
  lernstand: Map<string, number | null>;
  vorschlaege: SpielVorschlag[];
  href: (art: SpielArt) => string;
}) {
  const erstes = vorschlaege[0];
  const tage = serie(student.id, heute);
  const grundVon = new Map(vorschlaege.map((v) => [v.art, v]));
  const faecher = [...new Set(SPIEL_ARTEN.map((a) => SPIEL_FACH[a]))]
    .map((fach) => ({ fach, spiele: SPIEL_ARTEN.filter((a) => SPIEL_FACH[a] === fach && grundVon.has(a)) }))
    .filter((f) => f.spiele.length > 0);
  return (
    <>
      {/* das Spiel, das gerade am besten passt */}
      <section className="buehne mt-6 px-6 py-6" aria-label="Für dich" data-testid="spiele-fuer-dich">
        <div className="relative z-10">
          <p className="buehne-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold tracking-wide uppercase">
            <span>Für dich</span>
            {tage > 0 && (
              <span className="inline-flex items-center gap-1 normal-case text-[#ffd34d]">
                <Flame size={15} fill="currentColor" aria-hidden />
                {tage === 1 ? "1 Tag in Folge" : `${tage} Tage in Folge`}
              </span>
            )}
          </p>
          <h2 className="display mt-1 text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{SPIEL_TITEL[erstes.art]}</h2>
          <p className="buehne-meta mt-1 flex items-center gap-1.5 text-[15px]">
            {erstes.quelle === "pruefung" && <CalendarDays size={15} aria-hidden />}
            {erstes.quelle === "fach" ? SPIEL_KURZ[erstes.art] : erstes.grund}
          </p>
          <Link href={href(erstes.art)} className="btn btn-primary btn-lg mt-5">
            Spielen <ChevronRight size={18} aria-hidden />
          </Link>
        </div>
        <Kaertchen art={erstes.art} gross />
      </section>

      {faecher.map(({ fach, spiele }) => (
        <section key={fach} className="mt-9" aria-labelledby={`spiele-${fach}`}>
          <h2 id={`spiele-${fach}`} className="mb-3 flex items-baseline gap-2 text-[18px] font-semibold">
            {fach}
            <span className="text-[14px] font-normal text-ink-3">{spiele.length === 1 ? "1 Spiel" : `${spiele.length} Spiele`}</span>
          </h2>
          <ul className="staffel grid grid-cols-2 gap-3 md:grid-cols-3" data-testid={`spiele-${fach.toLowerCase()}`}>
            {spiele.map((art) => {
              const stand = lernstand.get(skillFuerSpiel(student, art, heute)) ?? null;
              const schild = SCHILD[grundVon.get(art)!.quelle];
              return (
                <li key={art}>
                  <Link href={href(art)} className="sp-kachel panel" data-fach={fach}>
                    <Kaertchen art={art} />
                    <span className="sp-titel">{SPIEL_TITEL[art]}</span>
                    <span className="sp-kurz">{spielWoher(student, art, heute) ?? SPIEL_KURZ[art]}</span>
                    <span className="sp-fuss">
                      {schild ? <span className="sp-schild">{schild}</span> : <span />}
                      {stand === null ? (
                        <span className="text-ink-3">Neu</span>
                      ) : (
                        <span className="sp-stand" aria-label={`Dein Stand: ${Math.round(stand * 100)} Prozent`}>
                          {!schild && (
                            <span className="sp-balken" aria-hidden>
                              <i style={{ width: `${Math.max(4, Math.round(stand * 100))}%` }} />
                            </span>
                          )}
                          <span className="num">{Math.round(stand * 100)} %</span>
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Zwei, drei schräge Kärtchen mit Wörtern aus dem Spiel: jedes Spiel sieht auf einen Blick anders aus. */
function Kaertchen({ art, gross }: { art: SpielArt; gross?: boolean }) {
  return (
    <span className="sp-kaertchen" data-gross={gross ? "" : undefined} aria-hidden>
      {SPIEL_DEKO[art].slice(0, 3).map((w, i) => (
        <i key={w} data-i={i}>
          {w}
        </i>
      ))}
    </span>
  );
}
