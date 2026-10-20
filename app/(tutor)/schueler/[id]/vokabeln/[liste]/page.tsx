import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteVokabellisteAction } from "@/app/vokabel-actions";
import { PageHeader } from "@/components/ui";
import { VokabellisteForm } from "@/components/VokabellisteForm";
import { requireTeacher } from "@/lib/auth";
import { getStudent } from "@/lib/repo";
import { getListe } from "@/lib/vokabellisten";

export const metadata = { title: "Vokabelliste" };

/** Eine Vokabelliste anlegen (/vokabeln/neu) oder ändern und löschen (/vokabeln/<id>). */
export default async function Vokabelliste({ params }: { params: Promise<{ id: string; liste: string }> }) {
  await requireTeacher();
  const { id, liste: lid } = await params;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const liste = lid === "neu" ? null : getListe(Number(lid));
  if (lid !== "neu" && (!liste || liste.student_id !== student.id)) notFound();
  const first = student.name.split(" ")[0];
  const zurueck = `/schueler/${student.id}/vokabeln`;
  return (
    <>
      <PageHeader title={liste ? `${liste.title} bearbeiten` : `Neue Vokabelliste für ${first}`} back={{ href: zurueck, label: `Vokabellisten von ${first}` }} />
      <VokabellisteForm key={liste?.id ?? "neu"} studentId={student.id} liste={liste ? { id: liste.id, title: liste.title, text: liste.text } : undefined} zurueck={zurueck} />
      {liste && (
        <details className="mt-10 max-w-[900px] border-t border-line pt-6">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-red">
            <Trash2 size={15} aria-hidden /> Liste löschen
          </summary>
          <form action={deleteVokabellisteAction.bind(null, liste.id)} className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-[14px] text-ink-2">Die Liste ist dann weg. Übungen, die schon daraus erstellt sind, bleiben.</p>
            <button className="btn btn-secondary text-red">Ja, Liste löschen</button>
          </form>
        </details>
      )}
    </>
  );
}
