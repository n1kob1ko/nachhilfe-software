import { notFound, redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { getText } from "@/lib/texts";

export const metadata = { title: "Bewertung" };

/**
 * Die alte Adresse von Erwartungshorizont und Bewertung: beides steht jetzt in „Aufgabe erfüllt?“ der Korrekturseite
 * (components/text/bewertung/AufgabeTeil.tsx), für jede Textarbeit. Gespeicherte Links führen dorthin.
 */
export default async function BewertungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher();
  const text = getText(Number(id));
  if (!text) notFound();
  redirect(`/texte/${text.id}/korrektur?teil=aufgabe`);
}
