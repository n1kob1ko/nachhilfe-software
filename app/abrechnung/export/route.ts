import { billingCsv, resolveBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const b = resolveBilling({ monat: sp.get("monat") ?? undefined, lehrer: sp.get("lehrer") ?? undefined, schueler: sp.get("schueler") ?? undefined });
  return new Response(billingCsv(b.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abrechnung-${b.monat}.csv"`,
    },
  });
}
