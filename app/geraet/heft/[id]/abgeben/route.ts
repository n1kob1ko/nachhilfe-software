import { currentDevice } from "@/lib/devices";
import { gibAb, heftAmGeraet, HEFT_MAX_SEITEN } from "@/lib/heft";
import { pushLive } from "@/lib/live";

export const dynamic = "force-dynamic";

/** „Fertig“ im Heft am Tablet: die Striche und die Seiten als PNG; geprüft wird danach im Hintergrund (lib/heft.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await currentDevice();
  if (!device) return Response.json({ error: "Dieses Tablet ist nicht verbunden." }, { status: 401 });
  const h = heftAmGeraet(Number((await params).id), device.teacher_id);
  if (!h) return Response.json({ error: "Dieses Heft gibt es hier nicht." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { felder?: unknown; seiten?: unknown } | null;
  const seiten = Array.isArray(body?.seiten)
    ? body.seiten.slice(0, HEFT_MAX_SEITEN + 1).map((s) => Buffer.from(String(s).replace(/^data:image\/png;base64,/, ""), "base64"))
    : [];
  const out = gibAb(h, body?.felder, seiten);
  if ("fehler" in out) return Response.json({ error: out.fehler }, { status: 409 });
  if (h.unitId) pushLive(h.unitId);
  return Response.json({ ok: true });
}
