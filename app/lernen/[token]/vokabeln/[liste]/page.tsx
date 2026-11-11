import { notFound } from "next/navigation";
import { VokabelTrainer } from "@/components/lernen/VokabelTrainer";
import * as repo from "@/lib/repo";
import { listenStand } from "@/lib/vokabel-training";
import { alleListenStand } from "@/lib/vokabel-training";
import { getListe } from "@/lib/vokabellisten";

/** Eine Vokabelliste üben (components/lernen/VokabelTrainer.tsx, lib/vokabel-training.ts). */
export default async function VokabelUebenSeite({
  params,
}: {
  params: Promise<{ token: string; liste: string }>;
}) {
  const { token, liste: lid } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const liste = getListe(Number(lid));
  if (!liste || liste.student_id !== student.id) notFound();
  const stand = listenStand(student.id, liste);
  if (!stand.woerter) notFound();
  const mehrere = alleListenStand(student.id).length > 1;
  return (
    <VokabelTrainer
      token={token}
      stand={stand}
      zurueck={mehrere ? `/lernen/${token}/vokabeln` : `/lernen/${token}`}
    />
  );
}
