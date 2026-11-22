import { notFound, redirect } from "next/navigation";
import { GlasSpiel } from "@/components/lernen/GlasSpiel";
import { Lernspiel } from "@/components/lernen/Lernspiel";
import { WortSchloss } from "@/components/lernen/WortSchloss";
import { PhantomSpiel } from "@/components/lernen/PhantomSpiel";
import { BlattSpiel } from "@/components/lernen/BlattSpiel";
import { EuropaSpiel } from "@/components/lernen/EuropaSpiel";
import { europaRekorde, europaSitzt, europaVerwechsler, europaWahl, blaetterWahl, geseheneBlaetter, sichereBlaetter, bloeckeRekord, endlosRekord, glasThemen, phantomWahl, punkteBestenliste, vorlageGeschafft, punkteRekord, serie, skillFuerSpiel, spielAntwort, spielVorschau, spielVorschlaege, spielWoher, wortThemen } from "@/lib/lernspiele";
import { offenesBlockwerk } from "@/lib/blockwerk-stand";
import { hatEndlos, istSpielArt, torTauglich, type SpielArt } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

/**
 * Ein Lernspiel in der Schüler-App (lib/lernspiele.ts). Ohne `art` das Spiel, das am besten zum Stoff passt;
 * gespielt wird über der Seite (components/lernen/Lernspiel.tsx). Das Kreuz führt zum Tab „Spiele“, mit `?von=start`
 * (Karte auf dem Start) zurück zum Start.
 */
export default async function SpielSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ art?: string; von?: string; modus?: string; thema?: string; teil?: string; weiter?: string }> }) {
  const { token } = await params;
  const { art: gewuenscht, von, modus, thema, teil, weiter } = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const heute = wienerDatum();
  const analyse = analyzeStudent(student.id);
  const lernstand = new Map((analyse?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  // Glasklar (lib/glasklar.ts): ein eigenes Spielfeld mit Themen statt Spielen
  if (modus === "glas" || gewuenscht === "glas") {
    const themen = glasThemen(student, heute);
    if (!themen.length) redirect(`/lernen/${token}/spiele`);
    const gewaehlt = themen.find((t) => t.id === thema) ?? themen[0];
    return (
      <GlasSpiel
        key={gewaehlt.id}
        token={token}
        themen={themen}
        thema={gewaehlt.id}
        serie={serie(student.id, heute)}
        lernstand={lernstand.get(gewaehlt.skill) ?? null}
        rekord={punkteRekord(student.id, "glas")}
        bestenliste={punkteBestenliste(student, "glas")}
        zurueck={von === "start" ? `/lernen/${token}` : undefined}
        themaLink={`/lernen/${token}/spiel?modus=glas${von === "start" ? "&von=start" : ""}&thema=`}
        arenaLink={`/lernen/${token}/arena`}
      />
    );
  }
  // Wortschloss (lib/wortschloss.ts): ebenso mit Themen
  if (modus === "wort" || gewuenscht === "wort") {
    const themen = wortThemen(student, heute);
    if (!themen.length) redirect(`/lernen/${token}/spiele`);
    const gewaehlt = themen.find((t) => t.id === thema) ?? themen[0];
    return (
      <WortSchloss
        key={gewaehlt.id}
        token={token}
        themen={themen}
        thema={gewaehlt.id}
        serie={serie(student.id, heute)}
        rekord={punkteRekord(student.id, "wort")}
        bestenliste={punkteBestenliste(student, "wort")}
        zurueck={von === "start" ? `/lernen/${token}` : undefined}
        themaLink={`/lernen/${token}/spiel?modus=wort${von === "start" ? "&von=start" : ""}&thema=`}
        arenaLink={`/lernen/${token}/arena`}
      />
    );
  }
  // Europa (lib/europa.ts): für alle
  if (modus === "europa" || gewuenscht === "europa") {
    return (
      <EuropaSpiel
        token={token}
        serie={serie(student.id, heute)}
        sitzt={europaSitzt(student.id)}
        rekorde={europaRekorde(student.id)}
        eigeneVerwechsler={europaVerwechsler(student.id).length}
        grund={europaWahl(student, heute).grund}
        zurueck={von === "start" ? `/lernen/${token}` : undefined}
      />
    );
  }
  // Blätter bestimmen (lib/blaetter.ts)
  if (modus === "blatt" || gewuenscht === "blatt") {
    const wahl = blaetterWahl(student, heute);
    if (!wahl) redirect(`/lernen/${token}/spiele`);
    return (
      <BlattSpiel
        token={token}
        serie={serie(student.id, heute)}
        sicher={sichereBlaetter(student.id)}
        gesehen={geseheneBlaetter(student.id)}
        grund={wahl.grund}
        zurueck={von === "start" ? `/lernen/${token}` : undefined}
      />
    );
  }
  // Phantombild (lib/phantombild.ts): Fall lösen oder „Text lernen“ (teil=text)
  if (modus === "phantom" || gewuenscht === "phantom" || gewuenscht === "vorlage") {
    const wahl = phantomWahl(student, heute);
    if (!wahl) redirect(`/lernen/${token}/spiele`);
    return (
      <PhantomSpiel
        token={token}
        teil={teil === "text" || gewuenscht === "vorlage" ? "text" : "fall"}
        serie={serie(student.id, heute)}
        rekord={punkteRekord(student.id, "phantom")}
        bestenliste={punkteBestenliste(student, "phantom")}
        geschafft={vorlageGeschafft(student.id)}
        grund={wahl.grund}
        zurueck={von === "start" ? `/lernen/${token}` : undefined}
        arenaLink={`/lernen/${token}/arena`}
      />
    );
  }
  const vorschlaege = spielVorschlaege(student, { heute, lernstand });
  if (!vorschlaege.length) redirect(`/lernen/${token}`);
  // Blockwerk und Funkelfeld brauchen ein Spiel mit einzelnen Karten (nicht die Vokabel-Paare), Torlauf eines mit
  // Antworten zum Wählen (kein Satzbau, kein Zahlenstrahl)
  const brett = modus === "bloecke" || modus === "funkel" || modus === "tor" ? modus : undefined;
  const passt = (a: SpielArt) => (brett === "tor" ? torTauglich(a) : hatEndlos(a));
  const art = istSpielArt(gewuenscht) && (!brett || passt(gewuenscht)) ? gewuenscht : brett ? (vorschlaege.find((v) => passt(v.art))?.art ?? vorschlaege[0].art) : vorschlaege[0].art;
  // Blockwerk: ein angefangenes Spiel zum Weiterspielen (lib/blockwerk-stand.ts)
  const offen = brett === "bloecke" ? offenesBlockwerk(student.id) : null;
  return (
    <Lernspiel
      key={`${art}-${modus ?? ""}`}
      token={token}
      art={art}
      vorschlaege={vorschlaege}
      serie={serie(student.id, heute)}
      lernstand={lernstand.get(skillFuerSpiel(student, art, heute)) ?? null}
      woher={spielWoher(student, art, heute)}
      vorschau={spielVorschau(student, art, heute)}
      antwort={spielAntwort(student, art, heute)}
      rekord={endlosRekord(student.id, art)}
      zurueck={von === "start" ? `/lernen/${token}` : undefined}
      modus={brett}
      bloeckeRekord={bloeckeRekord(student.id)}
      funkelRekord={punkteRekord(student.id, "funkel")}
      torRekord={punkteRekord(student.id, "tor")}
      bestenliste={brett ? punkteBestenliste(student, brett) : undefined}
      arenaLink={`/lernen/${token}/arena`}
      bloeckeLink={`/lernen/${token}/spiel?modus=bloecke${von === "start" ? "&von=start" : ""}&art=`}
      funkelLink={`/lernen/${token}/spiel?modus=funkel${von === "start" ? "&von=start" : ""}&art=`}
      torLink={`/lernen/${token}/spiel?modus=tor${von === "start" ? "&von=start" : ""}&art=`}
      blockOffen={offen ? { art: offen.art, punkte: offen.punkte } : null}
      weiter={weiter === "1"}
    />
  );
}
