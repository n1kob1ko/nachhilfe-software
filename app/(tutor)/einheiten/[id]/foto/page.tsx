import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { FotoUebungForm } from "@/components/FotoUebungForm";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { fotoMoeglich } from "@/lib/foto-uebung";
import { getStudent } from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";

export const metadata = { title: "Foto vom Stoff" };

/** „Foto vom Stoff“ in a running unit (lib/foto-uebung.ts): photo in, draft exercise out, checked in the preview. */
export default async function FotoVomStoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unit.id}`);
  const student = getStudent(unit.student_id)!;
  const name = student.name.split(" ")[0];
  const geht = fotoMoeglich();
  return (
    <div className="max-w-[720px]">
      <PageHeader
        title="Foto vom Stoff"
        info={`Fotografiere, was ${name} gerade lernt. Die KI liest das Foto und erstellt neue Aufgaben in derselben Art. Du siehst sie zuerst in der Vorschau und sendest sie dann.`}
        back={{ href: `/einheiten/${unit.id}`, label: "Zurück zur Einheit" }}
      />
      {geht.ok ? (
        <FotoUebungForm unitId={unit.id} name={name} />
      ) : (
        <section className="panel grid gap-4 px-5 py-5" data-testid="foto-ohne-ki">
          <p className="text-[15px]">{geht.grund}</p>
          <p className="text-[14px] text-ink-2">Ohne Foto stellst du die Übung im Builder selbst zusammen.</p>
          <div>
            <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary">
              <Plus size={16} aria-hidden /> Übung ohne Foto erstellen
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
