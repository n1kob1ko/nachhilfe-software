import { redirect } from "next/navigation";

/** The Textinterpretation is one of the Schreibaufträge now (app/(tutor)/schueler/[id]/schreibauftrag); old links still work. */
export default async function OldInterpretationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/schueler/${encodeURIComponent(id)}/schreibauftrag?sorte=textinterpretation`);
}
