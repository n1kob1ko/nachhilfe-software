import { notFound, redirect } from "next/navigation";
import { GlasSpiel } from "@/components/lernen/GlasSpiel";
import { Lernspiel } from "@/components/lernen/Lernspiel";
import { WortSchloss } from "@/components/lernen/WortSchloss";
import { bloeckeRekord, endlosRekord, glasThemen, punkteBestenliste, punkteRekord, serie, skillFuerSpiel, spielAntwort, spielVorschau, spielVorschlaege, spielWoher, wortThemen } from "@/lib/lernspiele";
import { hatEndlos, istSpielArt } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

/**
 * Ein Lernspiel in der Schüler-App (lib/lernspiele.ts). Ohne `art` das Spiel, das am besten zum Stoff passt;
 * gespielt wird über der Seite (components/lernen/Lernspiel.tsx). Das Kreuz führt zum Tab „Spiele“, mit `?von=start`
 * (Karte auf dem Start) zurück zum Start.
 */
export default async function SpielSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ art?: string; von?: string; modus?: string; thema?: string }> }) {
  const { token } = await params;
  const { art: gewuenscht, von, modus, thema } = await searchParams;
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
  const vorschlaege = spielVorschlaege(student, { heute, lernstand });
  if (!vorschlaege.length) redirect(`/lernen/${token}`);
  // Blockwerk und Funkelfeld brauchen ein Spiel mit einzelnen Karten (nicht die Vokabel-Paare)
  const brett = modus === "bloecke" || modus === "funkel" ? modus : undefined;
  const art = istSpielArt(gewuenscht) ? gewuenscht : brett ? (vorschlaege.find((v) => hatEndlos(v.art))?.art ?? vorschlaege[0].art) : vorschlaege[0].art;
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
      bestenliste={brett ? punkteBestenliste(student, brett) : undefined}
      arenaLink={`/lernen/${token}/arena`}
      bloeckeLink={`/lernen/${token}/spiel?modus=bloecke${von === "start" ? "&von=start" : ""}&art=`}
      funkelLink={`/lernen/${token}/spiel?modus=funkel${von === "start" ? "&von=start" : ""}&art=`}
    />
  );
}
