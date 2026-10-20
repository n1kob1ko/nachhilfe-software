import { redirect } from "next/navigation";

/** Text und Auftrag of every Schreibauftrag is app/(tutor)/texte/[id]/schreibauftrag now; old links still work. */
export default async function OldEditInterpretationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/texte/${encodeURIComponent(id)}/schreibauftrag`);
}
