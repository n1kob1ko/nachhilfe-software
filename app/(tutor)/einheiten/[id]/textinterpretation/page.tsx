import { redirect } from "next/navigation";

/** The Textinterpretation is one of the Schreibaufträge now (app/(tutor)/einheiten/[id]/schreibauftrag); old links still work. */
export default async function OldInterpretationInUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/einheiten/${encodeURIComponent(id)}/schreibauftrag?sorte=textinterpretation`);
}
