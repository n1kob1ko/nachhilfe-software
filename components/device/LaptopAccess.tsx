"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Laptop, Maximize2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { approveLaptopAction, cancelLaptopCodeAction, createLaptopCodeAction, endLaptopAction, rejectLaptopAction } from "@/app/laptop-actions";
import type { LiveSnapshot } from "@/lib/live";

export type JoinInfo = { url: string; qr: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/**
 * "Eigenes Gerät verbinden": a temporary access for the student's own laptop, for this unit only.
 * Code and QR code → the student enters the code → the teacher compares the check number and confirms.
 * Live from the unit's snapshot, so a request appears without reloading.
 */
export function LaptopAccess({ unitId, student, laptop, join }: { unitId: number; student: string; laptop: LiveSnapshot["laptop"]; join: JoinInfo }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const { code, request, active } = laptop;

  if (request) {
    return (
      <div role="alert" className="mt-4 rounded-2xl border-2 border-accent bg-accent-wash px-4 py-4" data-testid="laptop-request">
        <p className="flex items-center gap-2 text-[16px] font-semibold">
          <Laptop size={18} aria-hidden /> Ein Gerät möchte sich verbinden
        </p>
        <p className="mt-1 text-[14px] text-ink-2">
          {request.label} · seit {time(request.at)}
        </p>
        <p className="mt-3 text-[15px]">
          Prüfzahl{" "}
          <span className="num rounded-lg bg-surface px-2 py-0.5 text-[22px] font-semibold tracking-[0.08em]" data-testid="laptop-check">
            {request.check}
          </span>{" "}
          – steht sie auch auf dem Laptop von {student}?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={pending} onClick={() => run(() => approveLaptopAction(unitId, request.id))}>
            <Check size={16} aria-hidden /> Bestätigen
          </button>
          <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => rejectLaptopAction(unitId, request.id))}>
            <X size={16} aria-hidden /> Ablehnen
          </button>
        </div>
      </div>
    );
  }

  if (code) return <CodePanel unitId={unitId} student={student} code={code} join={join} replacing={Boolean(active)} />;

  if (active) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="laptop-active">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${active.online ? "bg-green-wash text-green" : "bg-red-wash text-red"}`}>
          <Laptop size={14} aria-hidden />
          {active.online ? `Laptop von ${student} verbunden` : `Laptop von ${student} offline`}
        </span>
        <span className="text-[13px] text-ink-3">
          {active.label} · seit {time(active.since)}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => createLaptopCodeAction(unitId))}>
            Anderes Gerät
          </button>
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => endLaptopAction(unitId, active.id))}>
            Zugang beenden
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => createLaptopCodeAction(unitId))}>
        <Laptop size={16} aria-hidden /> Eigenes Gerät verbinden
      </button>
    </div>
  );
}

function CodePanel({ unitId, student, code, join, replacing }: { unitId: number; student: string; code: { code: string; expiresAt: string }; join: JoinInfo; replacing: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const now = useNow();
  const left = Math.max(0, Date.parse(code.expiresAt) - now);
  const expired = left === 0;
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const shortUrl = join.url.replace(/^https?:\/\//, "");
  const mm = Math.floor(left / 60_000);
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0");

  return (
    <section aria-label="Eigenes Gerät verbinden" className="mt-4 rounded-[20px] bg-accent-wash px-5 py-5" data-testid="laptop-code-panel">
      <div className="grid gap-5 sm:grid-cols-[150px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-label="QR-Code vergrößern"
          className="w-[150px] cursor-zoom-in rounded-2xl bg-white p-2.5 shadow-[var(--shadow-card)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: join.qr }}
        />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink-2">{replacing ? `Anderes Gerät für ${student}` : `Auf dem Laptop von ${student} öffnen`}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[19px] font-semibold break-all" data-testid="laptop-url">
              {shortUrl}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(join.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Kopiert" : "Kopieren"}
            </button>
          </p>
          <p className="mt-3 text-[14px] font-semibold text-ink-2">Zugangscode</p>
          {expired ? (
            <p className="mt-1 text-[15px] font-semibold text-red">Code abgelaufen</p>
          ) : (
            <p className="num mt-0.5 text-[40px] leading-none font-semibold tracking-[0.12em]" data-testid="laptop-code">
              {spaced(code.code)}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            {!expired && (
              <span className="num">
                noch {mm}:{ss} gültig · einmal verwendbar
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} aria-hidden /> Du bestätigst danach mit einer Prüfzahl.
            </span>
          </p>
          <p className="mt-2 text-[14px] font-medium" role="status">
            {expired ? "" : `Wartet auf ${student} …`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => createLaptopCodeAction(unitId))}>
              <RefreshCw size={14} aria-hidden /> Neuer Code
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => dialog.current?.showModal()}>
              <Maximize2 size={14} aria-hidden /> Groß zeigen
            </button>
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => cancelLaptopCodeAction(unitId))}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>

      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,640px)] rounded-[24px] bg-surface p-0 text-ink backdrop:bg-black/60"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label="Zugang groß"
      >
        <div className="flex flex-col items-center gap-4 px-6 pt-4 pb-8 text-center">
          <button type="button" className="btn btn-secondary self-end" onClick={() => dialog.current?.close()} autoFocus>
            <X size={16} aria-hidden /> Schließen
          </button>
          <div
            role="img"
            aria-label={`QR-Code zu ${join.url}`}
            className="w-[min(70vw,46vh,360px)] rounded-2xl bg-white p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: join.qr }}
          />
          <p className="text-[24px] font-semibold break-all">{shortUrl}</p>
          <p className="text-[15px] text-ink-2">Zugangscode</p>
          <p className="num -mt-2 text-[56px] leading-none font-semibold tracking-[0.12em]">{expired ? "–" : spaced(code.code)}</p>
        </div>
      </dialog>
    </section>
  );
}
