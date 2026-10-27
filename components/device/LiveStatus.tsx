"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, CircleDashed, Eye, ListChecks, MonitorPlay, PenLine, Presentation, Printer, RotateCcw, SkipForward, Sparkles, TabletSmartphone, XCircle } from "lucide-react";
import { assignTabletAction, currentTaskToBoardAction, newExerciseAction, resendAction, retryTaskAction, sendNextTaskAction, showSolutionAction, tabletViewAction } from "@/app/device-actions";
import { ACTION_LABEL } from "@/lib/ai/labels";
import type { AILive } from "@/lib/ai/realtime";
import type { LiveSnapshot } from "@/lib/live";
import { LaptopAccess, type JoinInfo } from "./LaptopAccess";
import { ConnectTablet } from "./TabletSend";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Timer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{clock(now - Date.parse(since))}</span>;
}

/** Saved within the last 20 seconds: the student is writing right now (the editor saves every few seconds while typing). */
function Writing({ updatedAt }: { updatedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);
  const on = now - Date.parse(updatedAt) < 20_000;
  return (
    <span suppressHydrationWarning className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${on ? "text-green" : "text-ink-3"}`} data-testid="writing">
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-green" : "bg-ink-3"}`} aria-hidden />
      {on ? "schreibt gerade" : "schreibt gerade nicht"}
    </span>
  );
}

/**
 * What the student does on the tablet (or their own laptop) right now, live over the same stream hub
 * as the whiteboard. The teacher never chooses a student: the unit knows it, and the device is the
 * confirmed laptop of the unit, else the teacher's tablet.
 *
 * `kompakt` (geführter Unterricht): eine Zeile „Tablet verbunden · Übung „…“ · Aufgabe 2 von 4 · 1 Fehler ·
 * Letzte Antwort falsch“, die sich auf Tippen zu allem Übrigen öffnet. Eine falsche Antwort und „nicht
 * angekommen“ stehen rot schon in der Zeile.
 */
export function LiveStatus({ unitId, initial, join, kompakt = false }: { unitId: number; initial: LiveSnapshot; join: JoinInfo; kompakt?: boolean }) {
  const [s, setS] = useState(initial);
  const [auf, setAuf] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const answers = useRef(initial.answers);

  useEffect(() => {
    const es = new EventSource(`/einheiten/${unitId}/live`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as { type: string; snapshot?: LiveSnapshot | null };
      if (e.type !== "live" || !e.snapshot) return;
      setS(e.snapshot);
      // a new answer: the result lists below come from the server
      if (e.snapshot.answers !== answers.current) {
        answers.current = e.snapshot.answers;
        router.refresh();
      }
      if (!e.snapshot.running) router.refresh();
    };
    return () => es.close();
  }, [unitId, router]);

  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const c = s.current;
  // two units at once (D26): no tablet is on this unit yet, the other student has it or it asks „Wer arbeitet …?“
  const parallel = s.parallel.units.length > 1;
  const noTabletHere = parallel && s.tablet.paired && !s.parallel.tablets.some((t) => t.unitId === unitId);
  const tablet = !s.tablet.paired ? "kein" : noTabletHere ? "anderswo" : s.tablet.online ? "online" : "offline";
  const onLaptop = s.device === "laptop";
  const dev = onLaptop ? "Laptop" : "Tablet";
  const devOnline = onLaptop ? Boolean(s.laptop.active?.online) : tablet === "online";

  const inhalt = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tablet === "kein" && onLaptop ? null : tablet === "kein" ? (
          <>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
              <TabletSmartphone size={18} aria-hidden /> Noch kein Schülergerät verbunden
            </span>
            <ConnectTablet />
          </>
        ) : tablet === "anderswo" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-panel px-3 py-1 text-[13px] font-semibold text-ink-2">
            <TabletSmartphone size={14} aria-hidden /> Kein Tablet bei {s.student}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${tablet === "online" ? "bg-green-wash text-green" : "bg-red-wash text-red"}`}>
            <span className={`h-2 w-2 rounded-full ${tablet === "online" ? "bg-green" : "bg-red"}`} aria-hidden />
            {tablet === "online" ? "Tablet verbunden" : "Tablet offline"}
          </span>
        )}
        {(tablet !== "kein" || onLaptop) && (
          <div className="ml-auto flex gap-1 rounded-full bg-panel p-1" role="group" aria-label={`${dev} zeigt`}>
            {s.text && <ViewButton on={s.view === "text"} disabled={pending} onClick={() => run(() => tabletViewAction(unitId, `text:${s.text!.id}`))} icon={<PenLine size={16} aria-hidden />} label="Text" />}
            <ViewButton on={s.view !== "tafel" && s.view !== "text" && s.view !== "praesentation"} disabled={pending} onClick={() => run(() => tabletViewAction(unitId, c ? `aufgabe:${c.assignmentId}` : ""))} icon={<ListChecks size={16} aria-hidden />} label="Aufgaben" />
            {tablet !== "kein" && (
              <ViewButton on={s.view === "tafel"} disabled={pending} onClick={() => run(() => tabletViewAction(unitId, "tafel"))} icon={<Presentation size={16} aria-hidden />} label="Whiteboard" />
            )}
          </div>
        )}
      </div>
      {s.praesentation && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
          <MonitorPlay size={16} className="text-accent" aria-hidden />
          <span>
            {dev} zeigt „{s.praesentation.title}“, Folie <span className="num">{s.praesentation.folie}</span>
          </span>
          <Link href={`/mehr/praesentationen/${s.praesentation.id}`} className="font-semibold text-accent hover:underline">
            Vortrag öffnen
          </Link>
        </p>
      )}
      {s.running && parallel && s.parallel.tablets.length > 0 && <TabletChoice parallel={s.parallel} pending={pending} run={run} />}
      {s.running && <LaptopAccess unitId={unitId} student={s.student} laptop={s.laptop} join={join} />}

      {s.text ? (
        <div className="mt-4">
          <p className="text-[13px] text-ink-3">
            {s.student} · Textarbeit{onLaptop ? " · am eigenen Laptop" : ""}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate text-[17px] font-semibold" title={s.text.title}>
              {s.text.title}
            </span>
            <Writing updatedAt={s.text.updatedAt} />
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Metric label="Wörter" value={s.text.words.toLocaleString("de-AT")} />
            <Metric label="Zuletzt gespeichert" value={new Date(s.text.updatedAt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" })} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/texte/${s.text.id}`} className="btn btn-primary">
              <Eye size={16} aria-hidden /> Mitlesen
            </Link>
            <Link href={`/arbeitsblatt/text/${s.text.id}`} target="_blank" className="btn btn-secondary">
              <Printer size={16} aria-hidden /> PDF / Drucken
            </Link>
          </div>
        </div>
      ) : c ? (
        <div className="mt-4">
          <p className="text-[13px] text-ink-3">
            {s.student} · {c.probe ? "Probeschularbeit" : c.kontrolle ? "Lernkontrolle" : c.test ? "Minitest" : c.single ? "Einzelaufgabe" : "Übung"}
            {onLaptop ? " · am eigenen Laptop" : ""}
          </p>
          <p className="truncate text-[17px] font-semibold" title={c.title}>
            {c.title}
          </p>
          <dl className={`mt-3 grid grid-cols-2 gap-2 ${c.test ? "sm:grid-cols-5" : "sm:grid-cols-6"}`}>
            <Metric label="Aufgabe" value={`${Math.min(c.taskNo, c.total)} von ${c.total}`} />
            <Metric label="Abgegeben" value={`${c.done} von ${c.total}`} />
            <Metric
              label="Status"
              value={c.state}
              tone={c.state === "nicht angekommen" ? "text-red" : c.state === "fertig" ? "text-green" : undefined}
            />
            <Metric label="Zeit" value={c.since && c.state === "arbeitet" ? <Timer since={c.since} /> : "–"} />
            {c.test ? (
              // ein Versuch, keine Tipps: im Minitest zählt nur, was schon richtig ist
              <Metric label="Richtig" value={`${c.correct} von ${c.done}`} />
            ) : (
              <>
                <Metric label="Versuche" value={String(c.tries)} />
                <Metric label="Hilfen" value={String(c.hints)} />
              </>
            )}
          </dl>
          {c.last && (
            <p className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold ${c.last.pending ? "text-ink-2" : c.last.correct ? "text-green" : "text-red"}`} role="status">
              {c.last.pending ? <CircleDashed size={16} aria-hidden /> : c.last.correct ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
              {c.last.pending ? "Letzte Antwort gespeichert, du bewertest sie" : `Letzte Antwort ${c.last.correct ? "richtig" : "falsch"}`}
              {!c.last.pending && !c.last.correct && !c.last.final && " – versucht es nochmal"}
              <span className="num font-normal text-ink-3" suppressHydrationWarning>
                {" "}
                · {new Date(c.last.at).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" })}
              </span>
            </p>
          )}

          {c.state === "nicht angekommen" ? (
            <div role="alert" className="mt-4 rounded-2xl bg-red-wash px-4 py-3">
              <p className="text-[15px] font-semibold text-red">
                {devOnline ? `Noch nicht auf dem ${dev} angekommen` : `${dev} offline – noch nicht angekommen`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => resendAction(c.assignmentId))}>
                  Erneut senden
                </button>
                {!onLaptop && (
                  <Link href="/mehr/geraete" className="btn btn-secondary btn-sm">
                    Verbindung prüfen
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[13px] text-ink-2">Später senden: nichts tun. Die Übung erscheint, sobald das {dev} wieder verbunden ist.</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {c.single && c.hasNext && (
                <button className="btn btn-primary" disabled={pending} onClick={() => run(() => sendNextTaskAction(unitId))}>
                  <SkipForward size={16} aria-hidden /> Nächste Aufgabe senden
                </button>
              )}
              {c.single && (
                <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => retryTaskAction(unitId))}>
                  <RotateCcw size={16} aria-hidden /> Nochmal versuchen
                </button>
              )}
              {!c.solutionsVisible && !c.test && (
                <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => showSolutionAction(unitId))}>
                  <Eye size={16} aria-hidden /> Lösung zeigen
                </button>
              )}
              <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => currentTaskToBoardAction(unitId))}>
                <Presentation size={16} aria-hidden /> Auf Whiteboard
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[15px] text-ink-2">Noch nichts gesendet. Öffne eine Übung und tippe auf „An {s.student} senden“.</p>
      )}
      {s.ai.on && s.running && <AIHint unitId={unitId} ai={s.ai} />}
    </>
  );
  if (!kompakt) {
    return (
      <section aria-label="Live-Status" className="panel mb-8 px-5 py-4">
        {inhalt}
      </section>
    );
  }

  // the one line: device, what is on it, and how the last answer went
  const geraet =
    tablet === "kein" && !onLaptop
      ? { text: "Kein Schülergerät", ton: "text-ink-3", punkt: "bg-ink-3" }
      : tablet === "anderswo" && !onLaptop
        ? { text: `Kein Tablet bei ${s.student}`, ton: "text-ink-3", punkt: "bg-ink-3" }
        : devOnline
          ? { text: `${dev} verbunden`, ton: "text-green", punkt: "bg-green" }
          : { text: `${dev} offline`, ton: "text-red", punkt: "bg-red" };
  const fehler = c && !c.test ? Math.max(0, c.done - c.correct) : 0;
  const teile: { text: string; ton?: string }[] = [];
  if (s.text) teile.push({ text: `Textarbeit „${s.text.title}“ · ${s.text.words.toLocaleString("de-AT")} Wörter` });
  else if (c) {
    teile.push({ text: `${c.probe ? "Probeschularbeit" : c.kontrolle ? "Lernkontrolle" : c.test ? "Minitest" : "Übung"} „${c.title}“` });
    if (c.state === "nicht angekommen") teile.push({ text: "nicht angekommen", ton: "font-semibold text-red" });
    else if (c.state === "fertig") teile.push({ text: `fertig · ${c.correct} von ${c.total} richtig`, ton: "text-green" });
    else teile.push({ text: `Aufgabe ${Math.min(c.taskNo, c.total)} von ${c.total}` });
    if (fehler > 0 && c.state !== "fertig") teile.push({ text: `${fehler} Fehler`, ton: "text-red" });
    if (c.last && !c.last.pending && c.state !== "fertig") teile.push(c.last.correct ? { text: "Letzte Antwort richtig", ton: "text-green" } : { text: "Letzte Antwort falsch", ton: "font-semibold text-red" });
    if (c.last?.pending) teile.push({ text: "Antwort wartet auf dich", ton: "text-amber" });
  } else teile.push({ text: "Noch nichts gesendet" });
  return (
    <section aria-label="Live-Status" className="panel mb-5 px-4 py-1.5 sm:px-5" data-testid="live-kompakt">
      <button type="button" aria-expanded={auf} onClick={() => setAuf((x) => !x)} className="flex min-h-[48px] w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-[14.5px]">
        <span className={`inline-flex items-center gap-1.5 font-semibold ${geraet.ton}`}>
          <span className={`h-2 w-2 rounded-full ${geraet.punkt}`} aria-hidden />
          {geraet.text}
        </span>
        {teile.map((t, i) => (
          <span key={i} className={`min-w-0 ${t.ton ?? "text-ink-2"}`}>
            <span className="text-ink-3" aria-hidden>
              ·{" "}
            </span>
            {t.text}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 pl-2 text-[13px] font-medium text-accent">
          {auf ? "Weniger" : tablet === "kein" && !onLaptop ? "Gerät verbinden" : "Details"}
          <ChevronDown size={15} className={`transition-transform ${auf ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {auf && <div className="border-t border-line pt-3 pb-3">{inhalt}</div>}
    </section>
  );
}

/** Zwei Schüler gleichzeitig (D26): which student each of the teacher's tablets is for; one tap switches it. */
function TabletChoice({ parallel, pending, run }: { parallel: LiveSnapshot["parallel"]; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  return (
    <div className="mt-3 grid gap-2 rounded-2xl bg-panel px-4 py-3" aria-label="Tablets bei zwei Einheiten">
      <p className="text-[13px] text-ink-2">Zwei Einheiten laufen. Jedes Tablet zeigt einen Schüler:</p>
      {parallel.tablets.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[14px] font-semibold">
            <span className={`h-2 w-2 shrink-0 rounded-full ${t.online ? "bg-green" : "bg-ink-3"}`} aria-label={t.online ? "verbunden" : "offline"} />
            <span className="truncate">{t.name}</span>
          </span>
          <div className="flex gap-1 rounded-full bg-surface p-1" role="group" aria-label={`${t.name} ist für`}>
            {parallel.units.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={t.unitId === u.id}
                disabled={pending}
                onClick={() => run(() => assignTabletAction(t.id, u.id))}
                className={`flex min-h-[36px] items-center rounded-full px-3 text-[13px] font-semibold ${t.unitId === u.id ? "bg-accent text-on-fill" : "text-ink-2 hover:text-ink"}`}
              >
                {u.student}
              </button>
            ))}
          </div>
          {t.unitId === null && <span className="text-[13px] text-ink-3">fragt „Wer arbeitet an diesem Gerät?“</span>}
        </div>
      ))}
    </div>
  );
}

function ViewButton({ on, onClick, icon, label, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold ${on ? "bg-surface shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-panel px-3 py-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className={`num text-[17px] font-semibold ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

const AI_STATE: Record<AILive["state"], string> = {
  bereit: "",
  denkt: "schaut sich das an …",
  budget: "Budget aufgebraucht, nur Messwerte",
  pausiert: "Claude nicht erreichbar, pausiert",
};

/** What the KI noticed last, and the button for a fitting new exercise (only on click, it costs a request). */
function AIHint({ unitId, ai }: { unitId: number; ai: AILive }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const h = ai.hint;
  const wantsNew = Boolean(h?.needs_new_exercise || ai.block?.needs_new_exercise);
  const step = (d: -1 | 0 | 1) => (d === 1 ? <ArrowUp size={14} aria-label="schwerer" /> : d === -1 ? <ArrowDown size={14} aria-label="leichter" /> : null);
  return (
    <div className="mt-4 rounded-2xl bg-panel px-4 py-3" aria-live="polite">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <Sparkles size={16} aria-hidden /> KI-Hinweis
        {AI_STATE[ai.state] && <span className="ml-auto font-normal text-ink-3">{AI_STATE[ai.state]}</span>}
      </p>
      {h ? (
        <div className="mt-1">
          <p className="inline-flex items-center gap-1 text-[15px] font-semibold">
            {ACTION_LABEL[h.recommended_action]} {step(h.difficulty_adjustment)}
          </p>
          {h.misconception && <p className="text-[14px] text-ink-2">{h.misconception}</p>}
          {h.hint && <p className="mt-1 text-[14px]">Denkanstoß: „{h.hint}“</p>}
          {h.nextSkillName && <p className="mt-1 text-[13px] text-ink-3">Danach: {h.nextSkillName}</p>}
        </div>
      ) : (
        <p className="mt-1 text-[14px] text-ink-2">Meldet sich, sobald Fehler oder Hilfen auftauchen.</p>
      )}
      {ai.block && (
        <p className="mt-2 text-[13px] text-ink-2">
          <span className="font-semibold">Letzte Übung:</span> {ai.block.summary}
        </p>
      )}
      {(h || ai.block) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className={`btn ${wantsNew ? "btn-primary" : "btn-secondary"}`}
            disabled={pending}
            onClick={() => start(async () => setMsg(await newExerciseAction(unitId)))}
          >
            <Sparkles size={16} aria-hidden /> {pending ? "Wird erstellt …" : "Passende Aufgabe senden"}
          </button>
          {msg && <span className={`text-[13px] ${msg.error ? "text-red" : "text-ink-2"}`}>{msg.error ?? msg.ok}</span>}
        </div>
      )}
    </div>
  );
}
