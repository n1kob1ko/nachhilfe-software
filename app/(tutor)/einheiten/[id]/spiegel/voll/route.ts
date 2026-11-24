import { currentTeacher } from "@/lib/auth";
import { spiegelMelden } from "@/lib/spiegel";
import { canManageUnit, getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

/**
 * The teacher's copy of the student screen lost a packet (lib/spiegel-reihe.ts) or never got a full picture:
 * the tablet sends a fresh one.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return Response.json({ ok: false }, { status: 401 });
  const unit = getUnit(Number((await params).id));
  if (!unit || !canManageUnit(teacher, unit)) return Response.json({ ok: false }, { status: 403 });
  if (unit.status !== "gestartet") return Response.json({ ok: false }, { status: 409 });
  spiegelMelden(unit);
  return Response.json({ ok: true });
}
