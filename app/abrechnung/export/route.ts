import { currentTeacher } from "@/lib/auth";
import { billingCsv, resolveBilling, scopeToViewer } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Route handlers are not covered by the (tutor) layout, so the session is checked here.
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  const sp = new URL(request.url).searchParams;
  const b = resolveBilling(scopeToViewer({ monat: sp.get("monat") ?? undefined, lehrer: sp.get("lehrer") ?? undefined, schueler: sp.get("schueler") ?? undefined }, teacher));
  return new Response(billingCsv(b.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abrechnung-${b.monat}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
