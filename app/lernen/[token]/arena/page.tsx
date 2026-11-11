import { notFound } from "next/navigation";
import { Arena } from "@/components/lernen/Arena";
import { meineDuelle } from "@/lib/duelle";
import { ligaTabelle } from "@/lib/liga";
import { spielVorschlaege } from "@/lib/lernspiele";
import { SPIEL_ARTEN } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { erlaubnis, namensTeile, profilVon, vorschlag } from "@/lib/spielprofil";

/**
 * Liga und Duelle (lib/spielprofil.ts, lib/liga.ts, lib/duelle.ts): liegt wie die Lernspiele über der Seite. Ohne
 * Profil zuerst „Mitspielen?“, mit `?bearbeiten=1` Spitzname und Schalter ändern.
 */
export default async function ArenaSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ bearbeiten?: string }> }) {
  const { token } = await params;
  const { bearbeiten } = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const darf = erlaubnis(student);
  const p = profilVon(student.id);
  const teile = p ? namensTeile(p.name) : null;
  const profil = p && teile ? { ...teile, bild: p.bild, liga: p.liga, duelle: p.duelle, name: p.name } : null;
  const heute = wienerDatum();
  // zuerst die Spiele, die zum Stoff passen; sonst alle
  const passend = spielVorschlaege(student, { heute }).map((v) => v.art);
  const spiele = [...new Set([...passend, ...SPIEL_ARTEN])];
  return (
    <Arena
      token={token}
      erlaubnis={darf}
      profil={darf.darf ? profil : null}
      vorschlag={vorschlag()}
      bearbeiten={!!bearbeiten && !!profil}
      liga={darf.darf && profil?.liga ? ligaTabelle(student, heute) : null}
      duelle={darf.darf && profil?.duelle ? meineDuelle(student.id) : []}
      spiele={spiele}
    />
  );
}
