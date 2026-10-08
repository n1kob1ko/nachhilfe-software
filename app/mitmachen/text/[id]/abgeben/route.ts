import { currentLaptop } from "@/lib/laptop-context";
import { laptopMayWrite } from "@/lib/laptop";
import { handleHandIn } from "@/lib/text-routes";

export const dynamic = "force-dynamic";

/** "Abgeben" of a Bildgeschichte on the student's own laptop. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentLaptop();
  if (!session) return Response.json({ error: "Dieses Gerät ist nicht verbunden." }, { status: 401 });
  return handleHandIn(request, Number((await params).id), { mayWrite: (t) => laptopMayWrite(session, t) });
}
