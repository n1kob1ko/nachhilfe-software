import Link from "next/link";
import { Frisch } from "@/components/Frisch";
import { ChevronRight, Swords, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { BestenlisteTafel } from "@/components/lernen/BestenlisteTafel";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { SpieleListe } from "@/components/lernen/SpieleListe";
import { meineDuelle } from "@/lib/duelle";
import { blaetterWahl, glasThemen, phantomWahl, punkteBestenliste, spielVorschlaege, wortThemen } from "@/lib/lernspiele";
import { hatEndlos, torTauglich } from "@/lib/lernspiele-typen";
import { ligaTabelle } from "@/lib/liga";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";
import { BILDER, erlaubnis, profilVon } from "@/lib/spielprofil";

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
    // nur Biologie: dann gibt es „Blätter bestimmen“ allein
    const nurBlatt = blaetterWahl(student, heute);
    return (
      <>
        <Frisch />
        <SeitenKopf titel="Spiele" text="Kurze Runden zu dem, was du gerade lernst." />
        {nurBlatt ? (
          <Link href={`${base}/spiel?modus=blatt`} className="sp-block panel mt-6" data-testid="spiele-blaetter">
            <span className="sp-blatt-bild" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/spiele/blaetter/blatt-22.webp" alt="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="sp-titel">Blätter bestimmen</span>
              <span className="sp-kurz">Schau das Blatt an: welche Pflanze, welche Familie?</span>
              {nurBlatt.grund && <span className="mt-1 block text-[13px] font-semibold text-ink-2">{nurBlatt.grund}</span>}
            </span>
          </Link>
        ) : (
          <p className="panel mt-6 px-5 py-5 text-[16px] text-ink-2" data-testid="spiele-leer">
            Für deine Fächer gibt es noch kein Spiel. Sobald eines dazukommt, steht es hier.
          </p>
        )}
      </>
    );
  }

  // Gegeneinander: Duelle zuerst, die Liga klein darunter
  const darf = erlaubnis(student);
  const profil = darf.darf ? profilVon(student.id) : null;
  const duelle = profil?.duelle ? meineDuelle(student.id) : [];
  const dran = duelle.filter((d) => d.binDran).length;
  const liga = profil?.liga ? ligaTabelle(student, heute) : null;
  const ich = liga?.zeilen.find((z) => z.ich);
  // Blockwerk: die Bestenliste zum Anschauen, auch ohne zu spielen
  const blockArt = vorschlaege.find((v) => hatEndlos(v.art))?.art;
  const bestenliste = blockArt ? punkteBestenliste(student, "bloecke") : null;
  const blockLink = (art: string) => `${base}/spiel?modus=bloecke&art=${art}`;
  // Funkelfeld: genauso, mit eigener Bestenliste
  const funkelListe = blockArt ? punkteBestenliste(student, "funkel") : null;
  const funkelLink = (art: string) => `${base}/spiel?modus=funkel&art=${art}`;
  // Torlauf: nur mit einem Spiel, das Antworten zum Wählen hat
  const torArt = vorschlaege.find((v) => torTauglich(v.art))?.art;
  const torListe = torArt ? punkteBestenliste(student, "tor") : null;
  const torLink = (art: string) => `${base}/spiel?modus=tor&art=${art}`;
  // Glasklar: das passendste Thema und die eigene Bestenliste
  const glasThema = glasThemen(student, heute)[0];
  const glasListe = glasThema ? punkteBestenliste(student, "glas") : null;
  const glasLink = `${base}/spiel?modus=glas`;
  // Wortschloss: ebenso
  const wortThema = wortThemen(student, heute)[0];
  const wortListe = wortThema ? punkteBestenliste(student, "wort") : null;
  const wortLink = `${base}/spiel?modus=wort`;
  // Phantombild: für Deutsch in der Unterstufe, oder wenn die Personenbeschreibung Stoff ist
  const phantom = phantomWahl(student, heute);
  const phantomListe = phantom ? punkteBestenliste(student, "phantom") : null;
  const phantomLink = `${base}/spiel?modus=phantom`;
  // Blätter bestimmen: für Biologie (Profil, Test, Einheit)
  const blatt = blaetterWahl(student, heute);

  return (
    <>
      <Frisch />
      <SeitenKopf titel="Spiele" text="Kurze Runden zu dem, was du gerade lernst." />

      <SpieleListe student={student} heute={heute} lernstand={lernstand} vorschlaege={vorschlaege} href={(art) => `${base}/spiel?art=${art}`} bloecke={blockLink} blockPlatz={bestenliste?.ich ?? null} funkel={funkelLink} funkelPlatz={funkelListe?.ich ?? null} tor={torLink} torPlatz={torListe?.ich ?? null} glas={glasThema ? { href: glasLink, thema: glasThema.name, platz: glasListe?.ich ?? null } : undefined} wort={wortThema ? { href: wortLink, thema: wortThema.name, platz: wortListe?.ich ?? null } : undefined} phantom={phantom ? { href: phantomLink, grund: phantom.grund, platz: phantomListe?.ich ?? null } : undefined} blatt={blatt ? { href: `${base}/spiel?modus=blatt`, grund: blatt.grund } : undefined} />

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

      {bestenliste && blockArt && <BestenlisteTafel liste={bestenliste} spielen={blockLink(blockArt)} arena={`${base}/arena`} />}
      {torListe && torArt && <BestenlisteTafel liste={torListe} spielen={torLink(torArt)} arena={`${base}/arena`} spiel="Torlauf" />}
      {funkelListe && blockArt && <BestenlisteTafel liste={funkelListe} spielen={funkelLink(blockArt)} arena={`${base}/arena`} spiel="Funkelfeld" />}
      {glasListe && <BestenlisteTafel liste={glasListe} spielen={glasLink} arena={`${base}/arena`} spiel="Glasklar" />}
      {wortListe && <BestenlisteTafel liste={wortListe} spielen={wortLink} arena={`${base}/arena`} spiel="Wortschloss" />}
      {phantomListe && <BestenlisteTafel liste={phantomListe} spielen={phantomLink} arena={`${base}/arena`} spiel="Phantombild" />}
    </>
  );
}
