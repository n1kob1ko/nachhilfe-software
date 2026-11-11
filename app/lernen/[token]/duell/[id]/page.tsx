import { notFound } from "next/navigation";
import { Duell } from "@/components/lernen/Duell";
import { duellSicht, duellTeilnehmer } from "@/lib/duelle";
import * as repo from "@/lib/repo";

/** Ein Duell (lib/duelle.ts): liegt wie die Lernspiele über der Seite (components/lernen/Duell.tsx). */
export default async function DuellSeite({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const t = duellTeilnehmer(Number(id));
  const vorname = (sid: number | null) => (sid ? (repo.getStudent(sid)?.name.split(" ")[0] ?? "") : "");
  const sicht = duellSicht(student.id, Number(id), t ? { von: vorname(t.von), gegen: vorname(t.gegen) } : undefined);
  if (!sicht) notFound();
  return <Duell token={token} start={sicht} />;
}
