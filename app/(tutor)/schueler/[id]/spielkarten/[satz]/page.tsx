import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteSpielkartenAction } from "@/app/spielkarten-actions";
import { SpielkartenForm } from "@/components/SpielkartenForm";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getStudent } from "@/lib/repo";
import { getSatz } from "@/lib/spielkarten";

export const metadata = { title: "Spielkarten" };

/** Spielkarten anlegen (/spielkarten/neu) oder ändern und löschen (/spielkarten/<id>). */
export default async function SpielkartenSatz({ params }: { params: Promise<{ id: string; satz: string }> }) {
  await requireTeacher();
  const { id, satz: sid } = await params;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const satz = sid === "neu" ? null : getSatz(Number(sid));
  if (sid !== "neu" && (!satz || satz.student_id !== student.id)) notFound();
  const first = student.name.split(" ")[0];
  const zurueck = `/schueler/${student.id}/spielkarten`;
  return (
    <>
      <PageHeader title={satz ? `${satz.titel} bearbeiten` : `Neue Spielkarten für ${first}`} back={{ href: zurueck, label: `Spielkarten von ${first}` }} />
      <SpielkartenForm
        key={satz?.id ?? "neu"}
        studentId={student.id}
        satz={satz ? { id: satz.id, titel: satz.titel, fach: satz.fach, text: satz.text, aktiv: !!satz.aktiv } : undefined}
        faecher={student.subjects}
        zurueck={zurueck}
      />
      {satz && (
        <details className="mt-10 max-w-[900px] border-t border-line pt-6">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-red">
            <Trash2 size={15} aria-hidden /> Karten löschen
          </summary>
          <form action={deleteSpielkartenAction.bind(null, satz.id)} className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-[14px] text-ink-2">Die Karten sind dann weg. Was {first} schon gespielt hat, bleibt im Lernverlauf.</p>
            <button className="btn btn-secondary text-red">Ja, Karten löschen</button>
          </form>
        </details>
      )}
    </>
  );
}
