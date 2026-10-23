import Link from "next/link";
import { notFound } from "next/navigation";
import { PruefungEintragen } from "@/components/PruefungEintragen";
import { weitereFaecher } from "@/lib/faecher";
import { getStudentByToken } from "@/lib/repo";

/** Der Schüler trägt eine Prüfung ein (lib/pruefliste.ts); sein Lehrer sieht sie in der Prüfliste. */
export default async function PruefungEintragenSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = getStudentByToken(token);
  if (!student) notFound();
  const faecher = student.subjects.length ? student.subjects : ["Mathematik"];
  return (
    <>
      <Link href={`/lernen/${token}`} className="mb-3 inline-flex min-h-[36px] items-center gap-1 text-[15px] font-medium text-ink-2 hover:text-ink">
        ← Zurück
      </Link>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Prüfung eintragen</h1>
      <p className="mt-1 mb-6 text-[16px] text-ink-2">Schularbeit, Test, Referat oder eine andere Prüfung: Trag ein, was du schon weißt, oder fotografiere den Stoffzettel.</p>
      <PruefungEintragen token={token} faecher={faecher} weitere={weitereFaecher(faecher)} />
    </>
  );
}
