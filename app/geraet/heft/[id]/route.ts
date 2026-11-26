import { currentDevice } from "@/lib/devices";
import { heftAmGeraet, speichereHeft } from "@/lib/heft";

export const dynamic = "force-dynamic";

/** Heft am Tablet (lib/heft.ts): laufend speichern, nur für ein Heft der laufenden Einheit des Lehrers, dem das Tablet gehört. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await currentDevice();
  if (!device) return Response.json({ error: "Dieses Tablet ist nicht verbunden." }, { status: 401 });
  const h = heftAmGeraet(Number((await params).id), device.teacher_id);
  if (!h) return Response.json({ error: "Dieses Heft gibt es hier nicht." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { felder?: unknown } | null;
  const out = speichereHeft(h, body?.felder);
  return "fehler" in out ? Response.json({ error: out.fehler }, { status: 409 }) : Response.json(out);
}
