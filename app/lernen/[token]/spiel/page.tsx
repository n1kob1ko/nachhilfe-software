import { notFound, redirect } from "next/navigation";
import { Lernspiel } from "@/components/lernen/Lernspiel";
import { bloeckeBestenliste, bloeckeRekord, endlosRekord, serie, skillFuerSpiel, spielAntwort, spielVorschau, spielVorschlaege, spielWoher } from "@/lib/lernspiele";
import { hatEndlos, istSpielArt } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

/**
 * Ein Lernspiel in der Schüler-App (lib/lernspiele.ts). Ohne `art` das Spiel, das am besten zum Stoff passt;
 * gespielt wird über der Seite (components/lernen/Lernspiel.tsx). Das Kreuz führt zum Tab „Spiele“, mit `?von=start`
 * (Karte auf dem Start) zurück zum Start.
 */
export default async function SpielSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ art?: string; von?: string; modus?: string }> }) {
  const { token } = await params;
  const { art: gewuenscht, von, modus } = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const heute = wienerDatum();
  const analyse = analyzeStudent(student.id);
  const lernstand = new Map((analyse?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  const vorschlaege = spielVorschlaege(student, { heute, lernstand });
  if (!vorschlaege.length) redirect(`/lernen/${token}`);
  // Blockwerk braucht ein Spiel mit einzelnen Karten (nicht die Vokabel-Paare)
  const art = istSpielArt(gewuenscht) ? gewuenscht : modus === "bloecke" ? (vorschlaege.find((v) => hatEndlos(v.art))?.art ?? vorschlaege[0].art) : vorschlaege[0].art;
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
      modus={modus === "bloecke" ? "bloecke" : undefined}
      bloeckeRekord={bloeckeRekord(student.id)}
      bestenliste={modus === "bloecke" ? bloeckeBestenliste(student) : undefined}
      arenaLink={`/lernen/${token}/arena`}
      bloeckeLink={`/lernen/${token}/spiel?modus=bloecke${von === "start" ? "&von=start" : ""}&art=`}
    />
  );
}
