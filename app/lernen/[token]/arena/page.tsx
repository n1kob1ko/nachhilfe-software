import { notFound } from "next/navigation";
import { Arena } from "@/components/lernen/Arena";
import { meineDuelle } from "@/lib/duelle";
import { ligaTabelle } from "@/lib/liga";
import { spielVorschlaege } from "@/lib/lernspiele";
import { DUELL_ARTEN } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { erlaubnis, profilVon, spielName, vorschlag } from "@/lib/spielprofil";

/**
 * Liga und Duelle (lib/spielprofil.ts, lib/liga.ts, lib/duelle.ts): liegt wie die Lernspiele über der Seite. Ohne
 * Profil zuerst „Mitspielen?“, mit `?bearbeiten=1` Bild und Schalter ändern. Gezeigt wird der echte Name („Max M.“).
 */
export default async function ArenaSeite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ bearbeiten?: string }> }) {
  const { token } = await params;
  const { bearbeiten } = await searchParams;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const darf = erlaubnis(student);
  const p = profilVon(student.id);
  const profil = p ? { bild: p.bild, liga: p.liga, duelle: p.duelle, name: p.name } : null;
  const heute = wienerDatum();
  // zuerst die Spiele, die zum Stoff passen; sonst alle
  const passend = spielVorschlaege(student, { heute }).map((v) => v.art).filter((a) => DUELL_ARTEN.includes(a));
  const spiele = [...new Set([...passend, ...DUELL_ARTEN])];
  return (
    <Arena
      token={token}
      erlaubnis={darf}
      profil={darf.darf ? profil : null}
      vorschlag={{ bild: vorschlag().bild, name: spielName(student.name) }}
      bearbeiten={!!bearbeiten && !!profil}
      liga={darf.darf && profil?.liga ? ligaTabelle(student, heute) : null}
      duelle={darf.darf && profil?.duelle ? meineDuelle(student.id) : []}
      spiele={spiele}
    />
  );
}
