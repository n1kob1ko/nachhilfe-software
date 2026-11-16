import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageStyle } from "@/components/arbeitsblatt/Sheet";
import { LernzettelInhalt } from "@/components/Lernzettel";
import { PrintButton } from "@/components/PrintButton";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { getStoffpaket } from "@/lib/stoffpaket";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = getStoffpaket(Number((await params).id));
  // der Titel wird zum Dateinamen, wenn das Blatt als PDF gespeichert wird
  return { title: { absolute: p?.lernzettel ? `Lernzettel – ${p.lernzettel.titel}` : "Lernzettel" } };
}

/** Der Lernzettel aus „Stoff vorbereiten“ (lib/stoffpaket.ts) als A4-Blatt zum Drucken oder als PDF. */
export default async function LernzettelDruck({ params }: Params) {
  await requireTeacher();
  const p = getStoffpaket(Number((await params).id));
  if (!p?.lernzettel) notFound();
  const student = repo.getStudent(p.student_id);
  const titel = `Lernzettel – ${p.lernzettel.titel}`;
  return (
    <div className="ab-screen">
      <PageStyle o={{ pages: true, title: titel }} />
      <aside className="ab-controls no-print grid content-start gap-3">
        <Link href={`/schueler/${p.student_id}/stoff/${p.id}`} className="btn btn-ghost btn-sm justify-self-start">
          <ArrowLeft size={15} aria-hidden /> Zur Vorschau
        </Link>
        <h1 className="text-[17px] font-semibold">Lernzettel drucken</h1>
        <p className="text-[13.5px] text-ink-2">Im Druckdialog „Als PDF speichern“ wählen, um ein PDF zu bekommen.</p>
        <PrintButton />
      </aside>
      <main className="ab-preview">
        <article className="ab-sheet" lang="de">
          <header className="ab-head">
            <div className="ab-head-main">
              <h1 className="ab-title">{p.lernzettel.titel}</h1>
              <p className="ab-meta">
                {[p.fach, "Lernzettel"].filter(Boolean).join(" · ")}
              </p>
            </div>
            {student && (
              <div className="ab-fields">
                <p className="ab-field">
                  <span>Name:</span>
                  <span className="ab-field-line">{student.name}</span>
                </p>
              </div>
            )}
          </header>
          <LernzettelInhalt z={p.lernzettel} titel={false} />
        </article>
      </main>
    </div>
  );
}
