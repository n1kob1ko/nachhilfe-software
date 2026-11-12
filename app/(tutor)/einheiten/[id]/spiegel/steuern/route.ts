import { currentTeacher } from "@/lib/auth";
import { pruefeSteuernListe, steuern } from "@/lib/spiegel";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

/** Eingreifen: one tap, drag step, key, pasted text or scroll of the teacher, played on the unit's tablet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return Response.json({ ok: false }, { status: 401 });
  const unit = getUnit(Number((await params).id));
  if (!unit || !canManageUnit(teacher, unit)) return Response.json({ ok: false }, { status: 403 });
  if (unit.status !== "gestartet") return Response.json({ ok: false }, { status: 409 });
  const c = pruefeSteuernListe(await request.json().catch(() => null));
  if (!c) return Response.json({ ok: false }, { status: 400 });
  return Response.json({ ok: steuern(unit, c) > 0 });
}
