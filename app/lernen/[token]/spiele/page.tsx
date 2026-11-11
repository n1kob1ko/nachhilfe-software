import "@/components/lernen/spiele.css";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flame, Swords, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { meineDuelle } from "@/lib/duelle";
import { serie, skillFuerSpiel, spielVorschlaege, vokabelPlan } from "@/lib/lernspiele";
import { SPIEL_ARTEN, SPIEL_DEKO, SPIEL_FACH, SPIEL_KURZ, SPIEL_TITEL, type SpielArt, type SpielVorschlag } from "@/lib/lernspiele-typen";
import { ligaTabelle } from "@/lib/liga";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { BILDER, erlaubnis, profilVon } from "@/lib/spielprofil";

/** Warum ein Spiel gerade passt, kurz für das Schild auf der Kachel. */
const SCHILD: Partial<Record<SpielVorschlag["quelle"], string>> = { pruefung: "Schularbeit", stoff: "Dein Stoff", einheit: "Letzte Einheit", lernstand: "Üben lohnt sich" };

/**
 * Der Tab „Spiele“ der Schüler-App (niko 2026-11-11: „es sollte übersichtlicher sein, wo Spiele sind, und besser
 * getrennt“). Oben das Spiel, das gerade zum Stoff passt, darunter alle Spiele nach Fach, dann „Gegeneinander“ mit den
 * Duellen. Die Wochenliga steht nur als kleine Zeile da („Ranking muss jetzt nicht sein“).
 */
export default async function SpieleSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const heute = wienerDatum();
  const analyse = analyzeStudent(student.id);
  const lernstand = new Map((analyse?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  const vorschlaege = spielVorschlaege(student, { heute, lernstand });
  const base = `/lernen/${token}`;

  if (!vorschlaege.length) {
    return (
      <>
        <SeitenKopf titel="Spiele" text="Kurze Runden zu dem, was du gerade lernst." />
        <p className="panel mt-6 px-5 py-5 text-[16px] text-ink-2" data-testid="spiele-leer">
          Für deine Fächer gibt es noch kein Spiel. Sobald eines dazukommt, steht es hier.
        </p>
      </>
    );
  }

  const erstes = vorschlaege[0];
  const tage = serie(student.id, heute);
  const grundVon = new Map(vorschlaege.map((v) => [v.art, v]));
  const faecher = [...new Set(SPIEL_ARTEN.map((a) => SPIEL_FACH[a]))]
    .map((fach) => ({ fach, spiele: SPIEL_ARTEN.filter((a) => SPIEL_FACH[a] === fach && grundVon.has(a)) }))
    .filter((f) => f.spiele.length > 0);

  // Gegeneinander: Duelle zuerst, die Liga klein darunter
  const darf = erlaubnis(student);
  const profil = darf.darf ? profilVon(student.id) : null;
  const duelle = profil?.duelle ? meineDuelle(student.id) : [];
  const dran = duelle.filter((d) => d.binDran).length;
  const liga = profil?.liga ? ligaTabelle(student, heute) : null;
  const ich = liga?.zeilen.find((z) => z.ich);

  return (
    <>
      <SeitenKopf titel="Spiele" text="Kurze Runden zu dem, was du gerade lernst." />

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
          <Link href={`${base}/spiel?art=${erstes.art}`} className="btn btn-primary btn-lg mt-5">
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
                  <Link href={`${base}/spiel?art=${art}`} className="sp-kachel panel" data-fach={fach}>
                    <Kaertchen art={art} />
                    <span className="sp-titel">{SPIEL_TITEL[art]}</span>
                    <span className="sp-kurz">{art === "vokabeln" ? vokabelPlan(student, heute).titel : SPIEL_KURZ[art]}</span>
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

      <section className="mt-9" aria-labelledby="spiele-gegeneinander" data-testid="spiele-gegeneinander">
        <h2 id="spiele-gegeneinander" className="mb-3 text-[18px] font-semibold">
          Gegeneinander
        </h2>
        {!darf.darf ? (
          <p className="panel px-5 py-4 text-[15px] text-ink-2">
            <b className="text-ink">Duelle</b> gibt es für dich noch nicht. {darf.grund}
          </p>
        ) : (
          <div className="panel divide-y divide-line">
            <Link href={`${base}/arena`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-panel">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-[24px] text-accent">{profil ? BILDER[profil.bild] : <Swords size={24} aria-hidden />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">Duelle</span>
                <span className="block text-[14px] text-ink-2">
                  {!profil
                    ? "Fordere jemanden heraus. Du spielst mit einem Spitznamen."
                    : !profil.duelle
                      ? "Ausgeschaltet. Antippen, um sie wieder einzuschalten."
                      : dran > 0
                        ? dran === 1
                          ? "1 Duell wartet auf dich"
                          : `${dran} Duelle warten auf dich`
                        : duelle.length > 0
                          ? "Kein Duell wartet. Fordere jemanden heraus."
                          : "Beide spielen dieselben 12 Karten. Wer mehr richtig hat, gewinnt."}
                </span>
              </span>
              {dran > 0 ? <span className="btn btn-primary">Spielen</span> : <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />}
            </Link>
            {liga && ich && (
              <Link href={`${base}/arena`} className="flex items-center gap-3 px-5 py-3 text-[14px] text-ink-2 transition-colors hover:bg-panel">
                <Trophy size={16} className="shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  Wochenliga: Platz {ich.platz} in der {liga.stufenName}-Liga · {ich.punkte} Punkte
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </section>
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
