"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Eye, ListChecks, Presentation, RotateCcw, SkipForward, TabletSmartphone, XCircle } from "lucide-react";
import { currentTaskToBoardAction, resendAction, retryTaskAction, sendNextTaskAction, showSolutionAction, tabletViewAction } from "@/app/device-actions";
import type { LiveSnapshot } from "@/lib/live";
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

/**
 * What the student does on the tablet right now, live over the same stream hub as the whiteboard.
 * The teacher never chooses a device or a student: the unit knows both.
 */
export function LiveStatus({ unitId, initial }: { unitId: number; initial: LiveSnapshot }) {
  const [s, setS] = useState(initial);
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
  const tablet = !s.tablet.paired ? "kein" : s.tablet.online ? "online" : "offline";

  return (
    <section aria-label="Live-Status" className="panel mb-8 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {tablet === "kein" ? (
          <>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
              <TabletSmartphone size={18} aria-hidden /> Noch kein Schülergerät verbunden
            </span>
            <ConnectTablet />
          </>
        ) : (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${tablet === "online" ? "bg-green-wash text-green" : "bg-red-wash text-red"}`}>
            <span className={`h-2 w-2 rounded-full ${tablet === "online" ? "bg-green" : "bg-red"}`} aria-hidden />
            {tablet === "online" ? "Tablet verbunden" : "Tablet offline"}
          </span>
        )}
        {tablet !== "kein" && (
          <div className="ml-auto flex gap-1 rounded-full bg-panel p-1" role="group" aria-label="Tablet zeigt">
            <ViewButton on={s.view !== "tafel"} disabled={pending} onClick={() => run(() => tabletViewAction(unitId, c ? `aufgabe:${c.assignmentId}` : ""))} icon={<ListChecks size={16} aria-hidden />} label="Aufgaben" />
            <ViewButton on={s.view === "tafel"} disabled={pending} onClick={() => run(() => tabletViewAction(unitId, "tafel"))} icon={<Presentation size={16} aria-hidden />} label="Whiteboard" />
          </div>
        )}
      </div>

      {c ? (
        <div className="mt-4">
          <p className="text-[13px] text-ink-3">
            {s.student} · {c.single ? "Einzelaufgabe" : "Übung"}
          </p>
          <p className="truncate text-[17px] font-semibold" title={c.title}>
            {c.title}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Metric label="Aufgabe" value={`${Math.min(c.taskNo, c.total)} von ${c.total}`} />
            <Metric
              label="Status"
              value={c.state}
              tone={c.state === "nicht angekommen" ? "text-red" : c.state === "fertig" ? "text-green" : undefined}
            />
            <Metric label="Zeit" value={c.since && c.state === "arbeitet" ? <Timer since={c.since} /> : "–"} />
            <Metric label="Versuche" value={String(c.tries)} />
            <Metric label="Hilfen" value={String(c.hints)} />
          </dl>
          {c.last && (
            <p className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold ${c.last.correct ? "text-green" : "text-red"}`} role="status">
              {c.last.correct ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
              Letzte Antwort {c.last.correct ? "richtig" : "falsch"}
              {!c.last.correct && !c.last.final && " – versucht es nochmal"}
            </p>
          )}

          {c.state === "nicht angekommen" ? (
            <div role="alert" className="mt-4 rounded-2xl bg-red-wash px-4 py-3">
              <p className="text-[15px] font-semibold text-red">
                {tablet === "online" ? "Noch nicht auf dem Tablet angekommen" : "Tablet offline – noch nicht angekommen"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => resendAction(c.assignmentId))}>
                  Erneut senden
                </button>
                <Link href="/mehr/geraete" className="btn btn-secondary btn-sm">
                  Verbindung prüfen
                </Link>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">Später senden: nichts tun. Die Übung erscheint, sobald das Tablet wieder verbunden ist.</p>
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
              {!c.solutionsVisible && (
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
    </section>
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
