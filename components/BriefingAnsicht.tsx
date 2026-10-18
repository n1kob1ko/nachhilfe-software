"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { briefingAction } from "@/app/(tutor)/schueler/[id]/briefing/actions";
import { ManualAustausch } from "@/components/ai/ManualAustausch";
import { Pill, Reveal } from "@/components/ui";
import type { BriefingInhalt, GespeichertesBriefing, UebungLink } from "@/lib/briefing";

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`;
const zahl = (n: number) => n.toLocaleString("de-AT");
const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });

/**
 * Das Tagesbriefing eines Schülers (lib/briefing.ts). Die Version aus den Daten steht sofort da; die
 * KI-Fassung kommt dazu, sobald sie da ist. Ist für heute schon eine gespeichert, wird sie gezeigt und
 * nichts neu gefragt; neu fragt nur „Neu erstellen“. Mit `start` (Knopf „Briefing“ auf der Startseite)
 * fragt die Seite einmal von selbst, wenn es noch keine gibt.
 */
export function BriefingAnsicht(props: {
  studentId: number;
  platzId: number | null;
  einfach: BriefingInhalt;
  gespeichert: GespeichertesBriefing | null;
  /** seit dem gespeicherten Briefing gibt es neue Einträge */
  veraltet: boolean;
  uebungen: Record<string, UebungLink>;
  /** null: die KI kann gefragt werden; sonst warum nicht */
  kiAus: string | null;
  /** „ca. 0,03 $“ oder „kostet nichts (manueller Modus)“ */
  kosten: string;
  start: boolean;
}) {
  const [briefing, setBriefing] = useState(props.gespeichert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();
  const unterwegs = useRef(false);

  const fragen = (neu: boolean) => {
    // a second click while the first is on its way does nothing (the server would wait for the same request anyway)
    if (unterwegs.current) return;
    unterwegs.current = true;
    setFehler(null);
    starten(async () => {
      try {
        const res = await briefingAction(props.studentId, props.platzId, neu);
        if (res.ok) setBriefing(res.briefing);
        else setFehler(res.error);
      } catch {
        setFehler("Das Briefing konnte nicht geladen werden.");
      } finally {
        unterwegs.current = false;
      }
    });
  };

  useEffect(() => {
    if (!props.start) return;
    // the address without ?start=1, so reloading the page does not ask again
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState(null, "", url.toString());
    if (!props.gespeichert && !props.kiAus) fragen(false);
    // only once, when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inhalt = briefing?.inhalt ?? props.einfach;
  const k = briefing?.kosten;
  // today's stock, and what a saved briefing named when it was made
  const links = { ...(briefing?.links ?? {}), ...props.uebungen };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <ManualAustausch aktiv={laeuft} />

      <div className="panel flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4" aria-live="polite">
        {laeuft ? (
          <p className="flex min-w-[16rem] flex-1 items-center gap-2 text-[14.5px]">
            <Loader2 size={18} className="shrink-0 animate-spin text-accent" aria-hidden />
            Die KI erstellt das Briefing. Bis dahin siehst du die Version aus den Daten.
          </p>
        ) : briefing ? (
          <div className="min-w-[16rem] flex-1 text-[14px]">
            <p className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">
                <Sparkles size={13} aria-hidden /> KI-Briefing
              </Pill>
              <span className="text-ink-2">
                von <span className="num">{uhrzeit(briefing.createdAt)}</span>, für {briefing.minuten} min
              </span>
            </p>
            {k && (
              <p className="mt-1 text-[13px] text-ink-3" data-testid="briefing-kosten">
                Kosten <span className="num">{usd(k.usd)}</span> · <span className="num">{zahl(k.tokensEin)}</span> Tokens ein, <span className="num">{zahl(k.tokensAus)}</span> aus
                {k.denken ? (
                  <>
                    {" "}
                    (davon <span className="num">{zahl(k.denken)}</span> Denken)
                  </>
                ) : null}
              </p>
            )}
            {briefing.verworfen > 0 && (
              <p className="mt-1 text-[13px] text-ink-3" data-testid="briefing-verworfen">
                {briefing.verworfen === 1
                  ? "Ein Vorschlag der KI stand nicht im Bestand und wurde weggelassen."
                  : `${briefing.verworfen} Vorschläge der KI standen nicht im Bestand und wurden weggelassen.`}
              </p>
            )}
            {props.veraltet && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-amber">
                <AlertTriangle size={14} aria-hidden /> Seit diesem Briefing gibt es neue Einträge (Dokumentation, Schularbeit oder Lernstand).
              </p>
            )}
          </div>
        ) : (
          <p className="min-w-[16rem] flex-1 text-[14px] text-ink-2">{props.kiAus ? `${props.kiAus} Unten steht die Version aus den Daten.` : "Unten steht die Version aus den Daten. Die KI fasst zusätzlich Dokumentationen und Lernverlauf zusammen."}</p>
        )}
        {!laeuft && !props.kiAus && (
          <button className={briefing ? "btn btn-secondary" : "btn btn-primary"} onClick={() => fragen(Boolean(briefing))} title={props.kosten}>
            {briefing ? (
              <>
                <RotateCcw size={16} aria-hidden /> Neu erstellen
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden /> KI-Briefing erstellen
              </>
            )}
            <span className="font-normal opacity-80">· {props.kosten}</span>
          </button>
        )}
        {fehler && (
          <p className="w-full text-[14px] text-red" role="alert">
            {fehler} {briefing ? "Das gespeicherte Briefing bleibt stehen." : "Die Version aus den Daten bleibt stehen."}
          </p>
        )}
      </div>

      <BriefingInhaltAnsicht inhalt={inhalt} uebungen={links} quelle={briefing ? "ki" : "daten"} />

      {briefing && (
        <Reveal label="Version aus den Daten ansehen">
          <div className="mt-4">
            <BriefingInhaltAnsicht inhalt={props.einfach} uebungen={props.uebungen} quelle="daten" />
          </div>
        </Reveal>
      )}
    </div>
  );
}

function Liste({ titel, punkte }: { titel: string; punkte: string[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">{titel}</h2>
      {punkte.length ? (
        <ul className="space-y-1.5 text-[14.5px]">
          {punkte.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-3">–</p>
      )}
    </section>
  );
}

function BriefingInhaltAnsicht({ inhalt, uebungen, quelle }: { inhalt: BriefingInhalt; uebungen: Record<string, UebungLink>; quelle: "ki" | "daten" }) {
  const summe = inhalt.plan.reduce((a, p) => a + p.minuten, 0);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" data-testid={`briefing-${quelle}`}>
      <div className="grid content-start gap-7">
        {inhalt.hinweis && <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px]">{inhalt.hinweis}</p>}
        <Liste titel="Letzter Stand" punkte={inhalt.letzterStand} />
        <Liste titel="Wo es hakt" punkte={inhalt.woEsHakt} />
        <section>
          <h2 className="mb-2 text-[15px] font-semibold">Nächste Schularbeit</h2>
          <p className="text-[14.5px]">{inhalt.schularbeit ?? <span className="text-ink-3">keine eingetragen</span>}</p>
        </section>
      </div>
      <div className="grid content-start gap-7">
        <section>
          <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
            Plan für heute <span className="num text-[13px] font-normal text-ink-3">{summe} min</span>
          </h2>
          <ol className="panel divide-y divide-line">
            {inhalt.plan.map((p, i) => {
              const u = p.uebung ? uebungen[p.uebung] : null;
              return (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span className="num w-[52px] shrink-0 pt-px text-[15px] font-semibold">{p.minuten} min</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.titel}</span>
                    {p.beschreibung && <span className="block text-[14px] text-ink-2">{p.beschreibung}</span>}
                    {u && (
                      <Link href={u.href} className="link mt-1 inline-flex items-center gap-1 text-[13.5px] font-medium">
                        {u.art}: {u.titel} <ArrowRight size={13} aria-hidden />
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
        <section>
          <h2 className="mb-2 text-[15px] font-semibold">Übungsvorschläge aus dem Bestand</h2>
          {inhalt.uebungen.length ? (
            <ul className="panel divide-y divide-line">
              {inhalt.uebungen.map((x) => {
                const u = uebungen[x.id];
                if (!u) return null;
                return (
                  <li key={x.id}>
                    <Link href={u.href} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 hover:bg-panel/60">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{u.titel}</span>
                        <span className="block text-[13px] text-ink-2">
                          {u.art} · {u.info}
                        </span>
                        {x.warum && <span className="block text-[13px] text-ink-3">{x.warum}</span>}
                      </span>
                      <ArrowRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-ink-3">Im Bestand passt nichts. Über „Übung erstellen“ entsteht eine neue.</p>
          )}
        </section>
      </div>
    </div>
  );
}
