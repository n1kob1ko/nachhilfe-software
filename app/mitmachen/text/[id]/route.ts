import { currentLaptop } from "@/lib/laptop-context";
import { laptopMayWrite } from "@/lib/laptop";
import { handleTextSave } from "@/lib/text-routes";

export const dynamic = "force-dynamic";

/** Autosave of a Textarbeit on a student's laptop: only texts of the student of the unit it was confirmed for. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentLaptop();
  if (!session) return Response.json({ error: "Dieses Gerät ist nicht verbunden." }, { status: 401 });
  return handleTextSave(request, Number((await params).id), { mayWrite: (t) => laptopMayWrite(session, t), by: "schueler" });
}
