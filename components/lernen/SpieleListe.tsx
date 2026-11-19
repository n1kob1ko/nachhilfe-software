import "@/components/lernen/spiele.css";
import "@/components/lernen/torlauf.css";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flame } from "lucide-react";
import { serie, skillFuerSpiel, spielWoher } from "@/lib/lernspiele";
import { hatEndlos, torTauglich, type BestenZeile, SPIEL_ARTEN, SPIEL_DEKO, SPIEL_FACH, SPIEL_KURZ, SPIEL_TITEL, type SpielArt, type SpielVorschlag } from "@/lib/lernspiele-typen";
import type * as repo from "@/lib/repo";
import { SteinBild } from "./FunkelSteine";
import { PhantomGesicht } from "./PhantomGesicht";

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
  bloecke,
  blockPlatz,
  funkel,
  funkelPlatz,
  tor,
  torPlatz,
  glas,
  wort,
  phantom,
}: {
  student: repo.Student;
  heute: string;
  lernstand: Map<string, number | null>;
  vorschlaege: SpielVorschlag[];
  href: (art: SpielArt) => string;
  /** Blockwerk mit den Karten eines Spiels; ohne Angabe keine Kachel */
  bloecke?: (art: SpielArt) => string;
  /** Blockwerk: der eigene Platz in der Bestenliste (steht dann auf der Kachel) */
  blockPlatz?: BestenZeile | null;
  /** Funkelfeld: wie `bloecke` (lib/funkelfeld.ts); ohne Angabe keine Kachel */
  funkel?: (art: SpielArt) => string;
  funkelPlatz?: BestenZeile | null;
  /** Torlauf: wie `bloecke` (lib/torlauf.ts), mit einem Spiel, das Antworten zum Wählen hat; ohne Angabe keine Kachel */
  tor?: (art: SpielArt) => string;
  torPlatz?: BestenZeile | null;
  /** Glasklar (lib/glasklar.ts): wohin die Kachel führt, das passendste Thema und der eigene Platz; ohne Angabe keine Kachel */
  glas?: { href: string; thema: string; platz?: BestenZeile | null };
  /** Wortschloss (lib/wortschloss.ts): wie `glas` */
  wort?: { href: string; thema: string; platz?: BestenZeile | null };
  /** Phantombild (lib/phantombild.ts): wohin die Kachel führt, warum gerade (dann steht sie ganz oben) und der eigene Platz */
  phantom?: { href: string; grund?: string; platz?: BestenZeile | null };
}) {
  const erstes = vorschlaege[0];
  const tage = serie(student.id, heute);
  const grundVon = new Map(vorschlaege.map((v) => [v.art, v]));
  // Blockwerk: die Fragen kommen aus dem Spiel, das am besten passt (nur Spiele mit einzelnen Karten)
  const blockArt = vorschlaege.find((v) => hatEndlos(v.art))?.art;
  const torArt = vorschlaege.find((v) => torTauglich(v.art))?.art;
  const faecher = [...new Set(SPIEL_ARTEN.map((a) => SPIEL_FACH[a]))]
    .map((fach) => ({ fach, spiele: SPIEL_ARTEN.filter((a) => SPIEL_FACH[a] === fach && grundVon.has(a)) }))
    .filter((f) => f.spiele.length > 0);
  const phantomKachel = phantom && (
    <Link href={phantom.href} className="sp-block panel mt-3" data-testid="spiele-phantombild">
      <span className="sp-phantom-bild" aria-hidden>
        <PhantomGesicht bau={KACHEL_GESICHT} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="sp-titel">Phantombild</span>
          <span className="sp-schild">{phantom.grund ? "Dein Stoff" : "Neu"}</span>
        </span>
        <span className="sp-kurz">Personenbeschreibung: lies die Zeugenaussage, bau die Person und lern deinen Text auswendig.</span>
        {phantom.grund && <span className="mt-1 block text-[13px] font-semibold text-ink-2">{phantom.grund}</span>}
        {phantom.platz && (
          <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-phantombild-platz">
            Platz {phantom.platz.platz} · Rekord {phantom.platz.punkte.toLocaleString("de-AT")}
          </span>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
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

      {phantom?.grund && phantomKachel}

      {bloecke && blockArt && (
        <Link href={bloecke(blockArt)} className="sp-block panel mt-3" data-testid="spiele-blockwerk">
          <span className="sp-block-bild" aria-hidden>
            {[0, 0, 3, 1, 1, 1, 2, 4, 2].map((f, i) => (
              <i key={i} data-f={f} data-leer={[2, 6].includes(i) ? "" : undefined} />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="sp-titel">Blockwerk</span>
              <span className="sp-schild">Neu</span>
            </span>
            <span className="sp-kurz">Teile legen, Reihen räumen. Neue Teile gibt es für Fragen aus {SPIEL_TITEL[blockArt]}.</span>
            {blockPlatz && (
              <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-blockwerk-platz">
                Platz {blockPlatz.platz} · Rekord {blockPlatz.punkte.toLocaleString("de-AT")}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      )}

      {tor && torArt && (
        <Link href={tor(torArt)} className="sp-block panel mt-3" data-testid="spiele-torlauf">
          <span className="sp-tor-bild" aria-hidden>
            <span className="tl-mini">
              <i />
              <i />
              <i />
              <b />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="sp-titel">Torlauf</span>
              <span className="sp-schild">Neu</span>
            </span>
            <span className="sp-kurz">Lauf durch das Tor mit der richtigen Antwort. Fragen aus {SPIEL_TITEL[torArt]}.</span>
            {torPlatz && (
              <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-torlauf-platz">
                Platz {torPlatz.platz} · Rekord {torPlatz.punkte.toLocaleString("de-AT")}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      )}

      {funkel && blockArt && (
        <Link href={funkel(blockArt)} className="sp-block panel mt-3" data-testid="spiele-funkelfeld">
          <span className="sp-funkel-bild" aria-hidden>
            {[0, 1, 0, 2, 2, 2, 3, 4, 1].map((f, i) => (
              <span key={i} className="ff-mini-stein" data-f={f} data-an={i >= 3 && i <= 5 ? "" : undefined}>
                <SteinBild f={f} />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="sp-titel">Funkelfeld</span>
              <span className="sp-schild">Neu</span>
            </span>
            <span className="sp-kurz">Drei gleiche Steine in eine Linie. Neue Züge gibt es für Fragen aus {SPIEL_TITEL[blockArt]}.</span>
            {funkelPlatz && (
              <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-funkelfeld-platz">
                Platz {funkelPlatz.platz} · Rekord {funkelPlatz.punkte.toLocaleString("de-AT")}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      )}

      {glas && (
        <Link href={glas.href} className="sp-block panel mt-3" data-testid="spiele-glasklar">
          <span className="sp-glas-bild" aria-hidden>
            {[
              [0, 1, 0],
              [1, 0, 1],
              [2, 2, 2],
            ].map((r, i) => (
              <span key={i} data-zu={i === 2 ? "" : undefined}>
                {r.map((f, j) => (
                  <i key={j} data-f={f} />
                ))}
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="sp-titel">Glasklar</span>
              <span className="sp-schild">Neu</span>
            </span>
            <span className="sp-kurz">Sortier die Begriffe in die richtigen Gläser: {glas.thema}.</span>
            {glas.platz && (
              <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-glasklar-platz">
                Platz {glas.platz.platz} · Rekord {glas.platz.punkte.toLocaleString("de-AT")}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      )}

      {wort && (
        <Link href={wort.href} className="sp-block panel mt-3" data-testid="spiele-wortschloss">
          <span className="sp-wort-bild" aria-hidden>
            {(["ja", "nein", "fast", "ja"] as const).map((f, i) => (
              <i key={i} data-f={f}>
                {"WORT"[i]}
              </i>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="sp-titel">Wortschloss</span>
              <span className="sp-schild">Neu</span>
            </span>
            <span className="sp-kurz">Errate das Wort zum Hinweis in sechs Versuchen: {wort.thema}.</span>
            {wort.platz && (
              <span className="mt-1 block text-[13px] font-semibold text-ink-2" data-testid="spiele-wortschloss-platz">
                Platz {wort.platz.platz} · Rekord {wort.platz.punkte.toLocaleString("de-AT")}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      )}

      {phantom && !phantom.grund && phantomKachel}

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

/** Das Gesicht auf der Kachel von Phantombild. */
const KACHEL_GESICHT = { person: "frau", koerperbau: "schlank", haut: "gebraeunt", gesicht: "oval", augen: "braun", nase: "klein", mund: "voll", frisur: "langlocken", haarfarbe: "schwarz", bart: "kein", oberteil: "jacke", farbe: "rot", brille: "eckig", schmuck: "ohrringe", besonderes: "nichts" } as const;
