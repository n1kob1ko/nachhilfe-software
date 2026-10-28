import Link from "next/link";
import { AIQualityTest } from "@/components/AIQualityTest";
import { AISelfTest } from "@/components/AISelfTest";
import { AITextTest } from "@/components/AITextTest";
import { EinheitBudgetForm } from "@/components/ai/EinheitBudgetForm";
import { KiAnbieterWahl, type AnbieterOption } from "@/components/ai/KiAnbieterWahl";
import { Info } from "@/components/Info";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { AREA_LABEL, FUNCTIONS, aiSwitchedOff, budget, imagePrice, imageRoute, mainProvider, poolOf, priceFor, routeFor, type AIFunction, type Area, type BudgetPool } from "@/lib/ai/config";
import { BUDGET_MAX_EUR, euro, standardBudgetEur } from "@/lib/ai/einheit-budget";
import { budgetState, costByDay, costByFunction, costByMonth, costByStudent, costByTeacher, recentCalls, type Sum } from "@/lib/ai/log";
import { schuelerGrenze, schuelerStand } from "@/lib/ai/schueler-kosten";
import { KI_MODUS_LABEL, kiModus } from "@/lib/ai/modus";
import { budgetName, PROVIDER_LABEL, providerReady } from "@/lib/ai/providers";
import { aiEnabled, breakerState } from "@/lib/ai/router";
import { requireTeacher } from "@/lib/auth";
import { autoBriefingAn, autoKosten, AUTO_SPERRE_TEXT, BRIEFINGS_IM_MONAT, TYPISCH_TOKENS_AUS, TYPISCH_TOKENS_EIN, type AutoSperre } from "@/lib/briefing-auto";
import { setAutoBriefingAction, setEinheitBudgetAction } from "./actions";

export const metadata = { title: "KI-Kosten" };
export const dynamic = "force-dynamic";

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`;
const eur = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const n = (x: number) => Math.round(x).toLocaleString("de-AT");
const STATUS_LABEL: Record<string, string> = { ok: "ok", cache: "aus Speicher", abgelehnt: "keine Antwort", fehler: "Fehler", timeout: "Zeit überschritten", budget: "Budget", pausiert: "pausiert" };

/**
 * Mehr › KI-Kosten: every request to the KI with provider, model, tokens, duration and cost, per day,
 * month, teacher and function, against the monthly budgets (Anthropic and the general one). Teachers
 * see their own requests, the administration sees all.
 */
export default async function AICostPage() {
  const teacher = await requireTeacher();
  const f = { teacherId: teacher.is_admin ? null : teacher.id };
  const month = new Date().toISOString().slice(0, 7);
  const paused = breakerState();
  const modus = kiModus();
  const aktiv = mainProvider();
  const manuellEingestellt = aktiv === "manual";
  // der manuelle Modus kann je Bereich (AI_<AREA>_PROVIDER=manual) oder für alle (Wahl) gelten
  const manuellAktiv = (Object.keys(FUNCTIONS) as AIFunction[]).some((fn) => routeFor(fn).provider === "manual");
  const state = aiSwitchedOff()
    ? "ausgeschaltet (AI_DISABLED)"
    : manuellEingestellt
      ? "an (manueller Modus: Prompt kopieren, Antwort einfügen)"
      : !providerReady(aktiv)
        ? `aus: kein Schlüssel für ${PROVIDER_LABEL[aktiv]} hinterlegt`
        : paused.paused
          ? "pausiert: der Anbieter war nicht erreichbar"
          : manuellAktiv
            ? `an (${PROVIDER_LABEL[aktiv]}, teils manuell)`
            : `an (${PROVIDER_LABEL[aktiv]})`;
  // das Budget des aktiven Anbieters zuerst; der manuelle Modus kostet nichts, dort steht Anthropic vorne
  const ersterPool = aktiv === "manual" ? "anthropic" : poolOf(aktiv);
  const pools = [ersterPool, ...(["anthropic", "allgemein"] as BudgetPool[]).filter((p) => p !== ersterPool)];
  // the general budget is named after the providers that use it now, not always OpenRouter
  const genutzt = [aktiv, ...(Object.keys(FUNCTIONS) as AIFunction[]).map((fn) => routeFor(fn).provider)];
  const budgets = pools.map((pool) => ({ pool, state: budgetState(Date.now(), pool), conf: budget(pool), name: budgetName(pool, genutzt) }));
  const vorrang = process.env.AI_PROVIDER?.trim()
    ? `AI_PROVIDER=${process.env.AI_PROVIDER.trim()} ist in den Umgebungsvariablen gesetzt und hat Vorrang vor dieser Wahl.`
    : (Object.keys(AREA_LABEL) as Area[]).some((a) => process.env[`AI_${a}_PROVIDER`]?.trim())
      ? `Für ${(Object.keys(AREA_LABEL) as Area[])
          .filter((a) => process.env[`AI_${a}_PROVIDER`]?.trim())
          .map((a) => AREA_LABEL[a])
          .join(", ")} gilt per Umgebungsvariable ein eigener Anbieter.`
      : null;
  const optionen: AnbieterOption[] = [
    { modus: "anthropic", name: KI_MODUS_LABEL.anthropic, was: `Standard, Sonnet 5.5, eigenes Budget ${usd(budget("anthropic").monthlyUsd)} im Monat`, bereit: providerReady("anthropic"), fehlt: "Kein Schlüssel hinterlegt: ANTHROPIC_API_KEY in Railway eintragen." },
    { modus: "openrouter", name: KI_MODUS_LABEL.openrouter, was: `Haiku 5.5 und Sonnet 5.5, Budget ${eur(budget("allgemein").monthlyEur)} im Monat`, bereit: providerReady("openrouter"), fehlt: "Kein Schlüssel hinterlegt: OPENROUTER_API_KEY in Railway eintragen." },
    { modus: "manual", name: KI_MODUS_LABEL.manual, was: "Prompt kopieren, Antwort einfügen, keine Kosten", bereit: true },
  ];
  const byFn = costByFunction(month, f);
  const days = costByDay(14, f);
  const months = costByMonth(6, f);
  const teachers = teacher.is_admin ? costByTeacher(month) : [];
  const students = costByStudent(month, f);
  const grenze = schuelerGrenze();
  const calls = recentCalls(25, f);
  const autoAn = autoBriefingAn();
  const autoK = autoKosten();
  // what keeps it from running for everyone right now (the per-student limit is checked per student)
  const autoGesperrt: AutoSperre | null = !aiEnabled("briefing") ? "ki_aus" : routeFor("briefing").provider === "manual" ? "manuell" : budgetState(Date.now(), poolOf(routeFor("briefing").provider)).level !== "ok" ? "budget" : null;
  const cent = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Cent`;

  return (
    <>
      <PageHeader
        title="KI-Kosten"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Jeder KI-Aufruf mit Anbieter, Modell, Tokens, Dauer und Kosten, ohne Namen und ohne Inhalte der Anfragen. Die Tokens meldet der Anbieter bei jedem Aufruf. Die Kosten sind bei Anthropic diese Tokens mal Preisliste (so rechnet Anthropic ab), bei OpenRouter der Preis, den OpenRouter meldet."
      />

      <section aria-label="Budget" className="panel mb-10 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[14px] text-ink-2">
            KI: <span className="font-semibold text-ink">{state}</span>
          </span>
        </div>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          {budgets.map(({ pool, state: b, conf, name }) => {
            const share = Math.min(1, b.share);
            return (
              <div key={pool} data-testid={`budget-${pool}`}>
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-2">
                  Budget {name}
                  {b.level === "warnung" && <Pill tone="amber">Über {Math.round(conf.warnAt * 100)}&nbsp;%</Pill>}
                  {b.level === "aus" && <Pill tone="red">Erreicht: KI-Aufrufe gestoppt</Pill>}
                </p>
                {conf.currency === "eur" ? (
                  <p className="mt-1 text-[15px]">
                    <span className="num text-[22px] font-semibold">{eur(b.spent / conf.usdPerEur)}</span> <span className="text-ink-2">von {eur(conf.monthlyEur)} in diesem Monat</span>
                    <span className="num ml-2 text-[13px] text-ink-3">
                      ({usd(b.spent)} von {usd(b.budget)})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-[15px]">
                    <span className="num text-[22px] font-semibold">{usd(b.spent)}</span> <span className="text-ink-2">von {usd(b.budget)} in diesem Monat</span>
                  </p>
                )}
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label={`Anteil am Monatsbudget ${name}`}>
                  <div className={`h-full rounded-full ${b.level === "ok" ? "bg-green" : b.level === "warnung" ? "bg-amber" : "bg-red"}`} style={{ width: `${share * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-ink-3">
          Jedes Budget beginnt am 1. des Monats neu. Anthropic hat ein eigenes Budget (ANTHROPIC_MONTHLY_BUDGET_USD, Standard 90&nbsp;$), weil die monatlichen Anthropic-Credits nicht in den nächsten Monat
          übergehen. OpenRouter und andere Anbieter teilen sich das allgemeine Budget (AI_MONTHLY_BUDGET_EUR). Warnung ab {Math.round(budget().warnAt * 100)}&nbsp;% (AI_BUDGET_WARN), ab 100&nbsp;% läuft bei diesem
          Anbieter kein kostenpflichtiger KI-Aufruf mehr; die App arbeitet dann mit Messwerten und Generatoren weiter. Die Anbieter rechnen in US-Dollar ab (Kurs 1&nbsp;€ ={" "}
          {budget().usdPerEur.toLocaleString("de-AT")}&nbsp;$), die Tabellen unten zeigen US-Dollar.
        </p>
      </section>

      {teacher.is_admin && (
        <section className="mb-10">
          <SectionTitle>KI-Anbieter</SectionTitle>
          <KiAnbieterWahl modus={modus} optionen={optionen} vorrang={vorrang} />
        </section>
      )}

      <section className="mb-10" aria-label="Briefings automatisch" data-testid="briefing-auto">
        <SectionTitle>
          <span>
            Briefings automatisch mit KI vorbereiten
            <Info label="Was passiert dabei?">
              Öffnet eine Lehrkraft Heute, fragt die App für die heutigen Schüler, die noch nicht begonnen haben, im Hintergrund das KI-Briefing, wenn es zum jetzigen Datenstand noch keines gibt. Heute wartet nie
              darauf; bis es da ist, gilt die Fassung aus den Daten. Ein Briefing gilt, bis sich die Daten des Schülers ändern (Dokumentation, Antworten, Prüfung, Hausübung, Wunsch). Nicht im manuellen Modus, nicht
              über der Warnschwelle des Monatsbudgets und nicht ab {eur(grenze.warnEur)} KI-Kosten eines Schülers im Monat; dann nur noch auf Klick. Die KI ändert nichts an Lernstand oder Dokumentation.
            </Info>
          </span>
        </SectionTitle>
        <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
          <div className="min-w-[16rem] flex-1 text-[14px]">
            <p>
              <span className="font-semibold">{autoAn ? "An" : "Aus"}</span>
              {autoAn && autoGesperrt && <span className="text-ink-2"> · gerade nicht: {AUTO_SPERRE_TEXT[autoGesperrt]}</span>}
            </p>
            <p className="mt-1 text-ink-2" data-testid="briefing-auto-kosten">
              {autoK.quelle === "kostenlos" ? (
                "Kostet nichts mit dem eingestellten Anbieter."
              ) : (
                <>
                  {autoK.quelle === "gemessen" ? "Ø " : "ca. "}
                  <span className="num">{cent(autoK.cent)}</span> je Briefing
                  {autoK.quelle === "gemessen" ? ` (gemessen, ${autoK.aufrufe} Aufrufe in 60 Tagen)` : ` (geschätzt: ${autoK.modell}, rund ${n(TYPISCH_TOKENS_EIN)} Tokens ein, ${n(TYPISCH_TOKENS_AUS)} aus)`}; bei 20 Schülern an jedem
                  Schultag (<span className="num">{n(BRIEFINGS_IM_MONAT)}</span> Briefings) etwa <span className="num">{eur(autoK.monatEuro)}</span> im Monat.
                </>
              )}
            </p>
          </div>
          {teacher.is_admin && (
            <form action={setAutoBriefingAction.bind(null, !autoAn)}>
              <button className={`btn ${autoAn ? "btn-secondary" : "btn-primary"}`}>{autoAn ? "Ausschalten" : "Einschalten"}</button>
            </form>
          )}
        </div>
      </section>

      <section className="mb-10" aria-label="Automatisch je Einheit" data-testid="einheit-budget">
        <SectionTitle>
          <span>
            KI-Budget je Einheit
            <Info label="Was passiert dabei?">
              Fehlen in einer laufenden Einheit passende Aufgaben (aus Bestand und Generator weniger als drei), erstellt die KI bis zu diesem Betrag je Einheit von selbst neue. Sie kommen immer zuerst als Vorschau mit
              Lösungen, „neu erstellt, ungeprüft“; an den Schüler geht erst etwas mit „Senden“. Ist der Betrag erreicht, nur noch auf Tippen, mit Kosten. Briefing und Live-Analyse zählen mit. Die Grenze je Schüler im Monat
              und das Monatsbudget gelten weiter. In einer Einheit kann die Lehrkraft den Betrag senken, erhöhen nur die Administration.
            </Info>
          </span>
        </SectionTitle>
        <div className="panel px-5 py-4 text-[14px]">
          {teacher.is_admin ? (
            <EinheitBudgetForm action={setEinheitBudgetAction} eur={standardBudgetEur()} max={BUDGET_MAX_EUR} />
          ) : (
            <p data-testid="einheit-budget-wert">
              Automatisch je Einheit bis <span className="num font-semibold">{euro(standardBudgetEur())}</span>
              {standardBudgetEur() === 0 && <span className="text-ink-2"> · automatisch aus, neue Aufgaben nur auf Tippen</span>}
            </p>
          )}
        </div>
      </section>

      {!teacher.is_admin && manuellEingestellt && (
        <section className="mb-10">
          <SectionTitle>KI-Modus</SectionTitle>
          <p className="panel px-5 py-4 text-[14px] text-ink-2">Der manuelle KI-Modus ist eingeschaltet: Die App zeigt den Prompt zum Kopieren und prüft die eingefügte Antwort. Es entstehen keine Kosten.</p>
        </section>
      )}

      {teacher.is_admin && (
        <section className="mb-10">
          <SectionTitle>KI testen</SectionTitle>
          <AISelfTest enabled={aiEnabled()} />
        </section>
      )}

      {teacher.is_admin && (
        <section className="mb-10">
          <SectionTitle>KI-Qualitätstest</SectionTitle>
          <AIQualityTest enabled={aiEnabled()} />
        </section>
      )}

      {teacher.is_admin && (
        <section className="mb-10">
          <SectionTitle>Textkorrektur-Test</SectionTitle>
          <AITextTest enabled={aiEnabled()} />
        </section>
      )}

      <section className="mb-10">
        <SectionTitle>
          <span>
            Anbieter und Modelle
            <Info label="Wie ändere ich Anbieter oder Modell?">
              In Railway unter Variables, je Bereich: AI_REALTIME_PROVIDER und AI_REALTIME_MODEL, ebenso EXERCISE, ANALYSIS, DEEP, MATERIAL und TEXT. Anbieter: anthropic, openrouter, deepseek, compatible oder manual. AI_PROVIDER gilt für alle Bereiche ohne eigenen Eintrag; ohne AI_PROVIDER gilt die Anbieterwahl auf dieser Seite (Standard: Anthropic). Ein Modell aus AI_&lt;BEREICH&gt;_MODEL oder AI_MODEL_FAST/STANDARD/DEEP gilt nur beim Anbieter, zu dem es passt: ein OpenRouter-Name wie anthropic/claude-sonnet-5.5 wird bei Anthropic zu claude-sonnet-5-5, ein Name ohne Anbieter-Vorsatz gilt bei OpenRouter nicht. „manual" ist der manuelle KI-Modus (ADR 0009): Der Prompt wird zum Kopieren gezeigt, die eingefügte Antwort mit derselben Prüfung übernommen, ohne Kosten. Nach dem nächsten Start gilt die neue Einstellung, ohne Code-Änderung.
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
                // Bilder laufen immer über OpenRouter mit eigenem Modell (Zeile unter der Tabelle)
                const fns = (Object.keys(FUNCTIONS) as AIFunction[]).filter((f) => FUNCTIONS[f].area === a && f !== "bild");
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
                      {route.provider === "manual" ? (
                        <span className="text-ink-2">kostenlos</span>
                      ) : route.provider === "openrouter" && !p.known ? (
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
        <p className="mt-1 text-[13px] text-ink-3" data-testid="bilder-modell">
          Bilder für Bildgeschichten: immer OpenRouter, Modell <span className="font-mono">{imageRoute().model}</span>, etwa <span className="num">{usd(imagePrice(imageRoute().model).usd)}</span> je Bild
          {providerReady("openrouter") ? "" : " (nicht eingerichtet: kein OpenRouter-Schlüssel)"}. Zählt zum allgemeinen Budget.
        </p>
      </section>

      <section className="mb-10">
        <SectionTitle>Pro KI-Funktion, dieser Monat</SectionTitle>
        {byFn.length ? <SumTable rows={byFn.map((r) => ({ ...r, key: r.label, sub: r.models.join(", ") }))} first="Funktion" perCall /> : <p className="text-[14px] text-ink-2">In diesem Monat noch keine KI-Aufrufe.</p>}
      </section>

      {teachers.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Pro Lehrer, dieser Monat</SectionTitle>
          <SumTable rows={teachers} first="Lehrer" />
        </section>
      )}

      <section className="mb-10" data-testid="pro-schueler">
        <SectionTitle>
          <span>
            Pro Schüler, dieser Monat
            <Info label="Grenze je Schüler">
              Zusätzlich zum Monatsbudget gilt je Schüler eine Grenze: ab {eur(grenze.warnEur)} sehen Lehrer im Cockpit und im Schülerprofil einen Hinweis (AI_STUDENT_WARN_EUR), ab {eur(grenze.stopEur)} lehnt jede
              KI-Funktion für diesen Schüler bis zum Monatsende ab (AI_STUDENT_LIMIT_EUR). Die App arbeitet dann ohne KI weiter. Gezählt werden alle Aufrufe zu diesem Schüler, von jedem Lehrer; Kurs 1&nbsp;€ ={" "}
              {grenze.usdPerEur.toLocaleString("de-AT")}&nbsp;$ (AI_USD_PER_EUR).
            </Info>
          </span>
        </SectionTitle>
        {students.length ? (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th className="px-5 py-3 font-semibold">Schüler</th>
                  <th className="px-3 py-3 text-right font-semibold">API-Aufrufe</th>
                  <th className="px-3 py-3 text-right font-semibold">aus Speicher</th>
                  <th className="px-3 py-3 text-right font-semibold">Kosten</th>
                  <th className="px-5 py-3 font-semibold">Grenze ({eur(grenze.stopEur)})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((r) => {
                  const s = schuelerStand(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5">
                        <Link href={`/schueler/${r.id}`} className="hover:text-accent">
                          {r.key}
                        </Link>
                      </td>
                      <td className="num px-3 py-2.5 text-right">{n(r.paid + r.errors)}</td>
                      <td className="num px-3 py-2.5 text-right">{n(r.reused)}</td>
                      <td className="num px-3 py-2.5 text-right font-semibold">
                        {eur(r.usd / grenze.usdPerEur)}
                        <span className="block text-[12px] font-normal text-ink-3">{usd(r.usd)}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        {s.stufe === "aus" ? <Pill tone="red">Gestoppt</Pill> : s.stufe === "warnung" ? <Pill tone="amber">Über {eur(grenze.warnEur)}</Pill> : <span className="text-ink-3">ok</span>}
                        <span className="num ml-2 text-[13px] text-ink-2">{eur(s.eur)} gesamt</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[14px] text-ink-2">In diesem Monat noch keine KI-Aufrufe zu einem Schüler.</p>
        )}
      </section>

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
                  <th className="px-3 py-3 font-semibold">Anbieter, Modell</th>
                  <th className="px-3 py-3 text-right font-semibold">Tokens ein</th>
                  <th className="px-3 py-3 text-right font-semibold">Tokens aus</th>
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
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {c.provider && <span className="block text-[12px] text-ink-3">{PROVIDER_LABEL[c.provider] ?? c.provider}</span>}
                      <span className="font-mono text-[12px]">{c.model}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {n(c.input_tokens + c.cache_write_tokens + c.cache_read_tokens)}
                      {c.cache_write_tokens + c.cache_read_tokens > 0 && <span className="block text-[12px] text-ink-3">davon {n(c.cache_write_tokens + c.cache_read_tokens)} Cache</span>}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {n(c.output_tokens)}
                      {c.thinking_tokens ? <span className="block text-[12px] text-ink-3">davon {n(c.thinking_tokens)} Denken</span> : null}
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

/** perCall: a column with the average cost of one paid request (what one Briefing, one Textkorrektur … costs). */
function SumTable({ rows, first, perCall }: { rows: (Sum & { key: string; sub?: string })[]; first: string; perCall?: boolean }) {
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
            {perCall && <th className="px-3 py-3 text-right font-semibold">Ø je Aufruf</th>}
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
              {perCall && <td className="num px-3 py-2.5 text-right">{r.paid ? usd(r.usd / r.paid) : "–"}</td>}
              <td className="num px-5 py-2.5 text-right font-semibold">{usd(r.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
