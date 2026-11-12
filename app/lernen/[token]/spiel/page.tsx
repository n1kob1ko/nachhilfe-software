import { notFound, redirect } from "next/navigation";
import { Lernspiel } from "@/components/lernen/Lernspiel";
import { endlosRekord, serie, skillFuerSpiel, spielAntwort, spielVorschau, spielVorschlaege, spielWoher } from "@/lib/lernspiele";
import { istSpielArt } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

/**
 * Ein Lernspiel in der Schüler-App (lib/lernspiele.ts). Ohne `art` das Spiel, das am besten zum Stoff passt;
 * gespielt wird über der Seite (components/lernen/Lernspiel.tsx). Das Kreuz führt zum Tab „Spiele“, mit `?von=start`
 * (Karte auf dem Start) zurück zum Start.
 */
export default async function SpielSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ art?: string; von?: string }> }) {
  const { token } = await params;
  const { art: gewuenscht, von } = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const heute = wienerDatum();
  const analyse = analyzeStudent(student.id);
  const lernstand = new Map((analyse?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  const vorschlaege = spielVorschlaege(student, { heute, lernstand });
  if (!vorschlaege.length) redirect(`/lernen/${token}`);
  const art = istSpielArt(gewuenscht) ? gewuenscht : vorschlaege[0].art;
  return (
    <Lernspiel
      key={art}
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
    />
  );
}
