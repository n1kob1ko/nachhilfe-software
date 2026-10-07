import { Info } from "@/components/Info";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { AREA_LABEL, FUNCTIONS, aiSwitchedOff, budget, priceFor, routeFor, type AIFunction, type Area } from "@/lib/ai/config";
import { budgetState, costByDay, costByFunction, costByMonth, costByTeacher, recentCalls, type Sum } from "@/lib/ai/log";
import { PROVIDER_LABEL, providerReady } from "@/lib/ai/providers";
import { anyProviderKey, breakerState } from "@/lib/ai/router";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "KI-Kosten" };
export const dynamic = "force-dynamic";

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`;
const n = (x: number) => Math.round(x).toLocaleString("de-AT");
const STATUS_LABEL: Record<string, string> = { ok: "ok", cache: "aus Speicher", abgelehnt: "keine Antwort", fehler: "Fehler", timeout: "Zeit überschritten", budget: "Budget", pausiert: "pausiert" };

/**
 * Mehr › KI-Kosten: every request to Claude with model, tokens, duration and estimated cost, per day,
 * month, teacher and function, against the monthly budget. Teachers see their own requests, the
 * administration sees all.
 */
export default async function AICostPage() {
  const teacher = await requireTeacher();
  const f = { teacherId: teacher.is_admin ? null : teacher.id };
  const month = new Date().toISOString().slice(0, 7);
  const b = budgetState();
  const conf = budget();
  const paused = breakerState();
  const state = aiSwitchedOff() ? "ausgeschaltet (AI_DISABLED)" : !anyProviderKey() ? "aus: kein Schlüssel hinterlegt" : paused.paused ? "pausiert: der Anbieter war nicht erreichbar" : "an";
  const byFn = costByFunction(month, f);
  const days = costByDay(14, f);
  const months = costByMonth(6, f);
  const teachers = teacher.is_admin ? costByTeacher(month) : [];
  const calls = recentCalls(25, f);
  const share = Math.min(1, b.share);

  return (
    <>
      <PageHeader title="KI-Kosten" back={{ href: "/mehr", label: "Mehr" }} info="Jeder KI-Aufruf mit Modell, Tokens, Dauer und geschätzten Kosten. Ohne Namen und ohne Inhalte der Anfragen." />

      <section aria-label="Budget" className="panel mb-10 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[14px] text-ink-2">
            KI: <span className="font-semibold text-ink">{state}</span>
          </span>
          {b.level === "warnung" && <Pill tone="amber">Über {Math.round(conf.warnAt * 100)}&nbsp;% des Budgets</Pill>}
          {b.level === "echtzeit-aus" && <Pill tone="red">Budget erreicht: Echtzeit-Analyse aus</Pill>}
          {b.level === "aus" && <Pill tone="red">Budget weit überschritten: alle KI-Aufrufe aus</Pill>}
        </div>
        <p className="mt-3 text-[15px]">
          <span className="num text-[22px] font-semibold">{usd(b.spent)}</span> <span className="text-ink-2">von {usd(b.budget)} in diesem Monat</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label="Anteil am Monatsbudget">
          <div className={`h-full rounded-full ${b.level === "ok" ? "bg-green" : b.level === "warnung" ? "bg-amber" : "bg-red"}`} style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          Budget und Warnschwelle über AI_MONTHLY_BUDGET_USD und AI_BUDGET_WARN. Ab 100&nbsp;% läuft keine Echtzeit-Analyse mehr, ab {Math.round(conf.hardAt * 100)}&nbsp;% gar kein KI-Aufruf. Die App arbeitet dann mit Messwerten und Generatoren weiter.
        </p>
      </section>

      <section className="mb-10">
        <SectionTitle>
          <span>
            Anbieter und Modelle
            <Info label="Wie ändere ich Anbieter oder Modell?">
              In Railway unter Variables, je Bereich: AI_REALTIME_PROVIDER und AI_REALTIME_MODEL, ebenso EXERCISE, ANALYSIS, DEEP und MATERIAL. Anbieter: anthropic, openrouter, deepseek oder compatible. AI_PROVIDER gilt für alle Bereiche ohne eigenen Eintrag. Nach dem nächsten Start gilt die neue Einstellung, ohne Code-Änderung.
            </Info>
          </span>
        </SectionTitle>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-5 py-3 font-semibold">Bereich</th>
                <th className="px-3 py-3 font-semibold">Anbieter</th>
                <th className="px-3 py-3 font-semibold">Modell</th>
                <th className="px-3 py-3 text-right font-semibold">Preis je 1 Mio. Tokens</th>
                <th className="px-5 py-3 font-semibold">Wofür</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(Object.keys(AREA_LABEL) as Area[]).map((a) => {
                const fns = (Object.keys(FUNCTIONS) as AIFunction[]).filter((f) => FUNCTIONS[f].area === a);
                const route = routeFor(fns[0]);
                const tier = FUNCTIONS[fns[0]].tier;
                const p = priceFor(route.model, tier);
                return (
                  <tr key={a}>
                    <td className="px-5 py-3 font-semibold">{AREA_LABEL[a]}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {PROVIDER_LABEL[route.provider]}
                      {!providerReady(route.provider) && <span className="block text-[12px] text-ink-3">kein Schlüssel</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px]">{route.model || <span className="font-sans text-ink-3">nicht eingestellt</span>}</td>
                    <td className="num px-3 py-3 text-right">
                      {route.provider === "openrouter" && !p.known ? (
                        <span className="text-ink-2">vom Anbieter gemeldet</span>
                      ) : (
                        <>
                          {usd(p.price.in)} / {usd(p.price.out)}
                          {!p.known && <span className="block text-[12px] text-ink-3">geschätzt</span>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-2">{fns.map((f) => FUNCTIONS[f].label).join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-ink-3">Preise: Eingabe / Ausgabe. Wiederverwendete Teile (Cache) kosten 10&nbsp;% der Eingabe. Für Modelle ohne bekannten Preis gilt AI_PRICES_JSON oder eine Schätzung.</p>
      </section>

      <section className="mb-10">
        <SectionTitle>Pro KI-Funktion, dieser Monat</SectionTitle>
        {byFn.length ? <SumTable rows={byFn.map((r) => ({ ...r, key: r.label, sub: r.models.join(", ") }))} first="Funktion" /> : <p className="text-[14px] text-ink-2">In diesem Monat noch keine KI-Aufrufe.</p>}
      </section>

      {teachers.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Pro Lehrer, dieser Monat</SectionTitle>
          <SumTable rows={teachers} first="Lehrer" />
        </section>
      )}

      <section className="mb-10">
        <SectionTitle>Pro Tag, letzte 14 Tage</SectionTitle>
        {days.length ? <SumTable rows={days} first="Tag" /> : <p className="text-[14px] text-ink-2">Keine Aufrufe in den letzten 14 Tagen.</p>}
      </section>

      {months.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Pro Monat</SectionTitle>
          <SumTable rows={months} first="Monat" />
        </section>
      )}

      {calls.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Letzte Aufrufe</SectionTitle>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-5 py-3 font-semibold">Zeit</th>
                  <th className="px-3 py-3 font-semibold">Funktion</th>
                  <th className="px-3 py-3 font-semibold">Modell</th>
                  <th className="px-3 py-3 text-right font-semibold">Tokens ein / aus</th>
                  <th className="px-3 py-3 text-right font-semibold">Dauer</th>
                  <th className="px-3 py-3 text-right font-semibold">Kosten</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="num px-5 py-2.5 whitespace-nowrap" suppressHydrationWarning>
                      {new Date(c.created_at).toLocaleString("de-AT", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2.5">{FUNCTIONS[c.fn]?.label ?? c.fn}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px]">{c.model}</td>
                    <td className="num px-3 py-2.5 text-right">
                      {n(c.input_tokens)} / {n(c.output_tokens)}
                    </td>
                    <td className="num px-3 py-2.5 text-right">{c.duration_ms ? `${(c.duration_ms / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })} s` : "–"}</td>
                    <td className="num px-3 py-2.5 text-right">{usd(c.cost_usd)}</td>
                    <td className="px-5 py-2.5" title={c.error || undefined}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function SumTable({ rows, first }: { rows: (Sum & { key: string; sub?: string })[]; first: string }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[14px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-3">
            <th className="px-5 py-3 font-semibold">{first}</th>
            <th className="px-3 py-3 text-right font-semibold">API-Aufrufe</th>
            <th className="px-3 py-3 text-right font-semibold">aus Speicher</th>
            <th className="px-3 py-3 text-right font-semibold">Tokens ein</th>
            <th className="px-3 py-3 text-right font-semibold">Tokens aus</th>
            <th className="px-3 py-3 text-right font-semibold">Ø Dauer</th>
            <th className="px-3 py-3 text-right font-semibold">Fehler</th>
            <th className="px-5 py-3 text-right font-semibold">Kosten</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-5 py-2.5">
                {r.key}
                {r.sub && <span className="block font-mono text-[12px] text-ink-3">{r.sub}</span>}
              </td>
              <td className="num px-3 py-2.5 text-right">{n(r.paid + r.errors)}</td>
              <td className="num px-3 py-2.5 text-right">{n(r.reused)}</td>
              <td className="num px-3 py-2.5 text-right">{n(r.input + r.cacheRead)}</td>
              <td className="num px-3 py-2.5 text-right">{n(r.output)}</td>
              <td className="num px-3 py-2.5 text-right">{r.avgMs ? `${(r.avgMs / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })} s` : "–"}</td>
              <td className={`num px-3 py-2.5 text-right ${r.errors ? "text-red" : ""}`}>{n(r.errors)}</td>
              <td className="num px-5 py-2.5 text-right font-semibold">{usd(r.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
