"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CheckCircle2, Send, TabletSmartphone, WifiOff } from "lucide-react";
import { createPairCodeAction, resendAction, sendToTabletAction, type SendState } from "@/app/device-actions";

function SendButton({ label, small }: { label: string; small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn btn-primary w-fit ${small ? "" : "btn-lg"}`} disabled={pending}>
      <Send size={small ? 15 : 18} aria-hidden /> {pending ? "Wird gesendet …" : label}
    </button>
  );
}

/**
 * "An Max senden": one button. The exercise (or one task) goes to the student of the teacher's
 * running unit, on the teacher's tablet. Shows honestly whether it arrived.
 */
export function TabletSend({ student, unitId, worksheetId, taskId, small }: { student: string; unitId: number; worksheetId?: number; taskId?: number; small?: boolean }) {
  const [state, action] = useActionState<SendState, FormData>(sendToTabletAction, null);
  return (
    <div className="grid gap-3">
      <form action={action}>
        {worksheetId ? <input type="hidden" name="worksheet_id" value={worksheetId} /> : null}
        {taskId ? <input type="hidden" name="task_id" value={taskId} /> : null}
        <SendButton label={`An ${student} senden`} small={small} />
      </form>
      <SendResult state={state} unitId={unitId} />
    </div>
  );
}

export function SendResult({ state, unitId, unitLink = true }: { state: SendState; unitId: number; unitLink?: boolean }) {
  const [again, setAgain] = useActionState<SendState, number>((_p, id) => resendAction(id), null);
  const [pending, start] = useTransition();
  const s = again ?? state;
  if (!s) return null;
  const toUnit = unitLink && (
    <Link href={`/einheiten/${unitId}`} className="btn btn-secondary btn-sm">
      Zur Einheit <ArrowRight size={14} aria-hidden />
    </Link>
  );
  if (s.status === "fehler") {
    return (
      <p role="alert" className="text-[14px] text-red">
        {s.error}
      </p>
    );
  }
  if (s.status === "gesendet") {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-green">
          <CheckCircle2 size={17} aria-hidden /> Auf dem Tablet von {s.student}
        </span>
        {toUnit}
      </div>
    );
  }
  if (s.status === "kein-geraet") {
    return (
      <div role="alert" className="rounded-2xl bg-amber-wash px-4 py-3">
        <p className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <TabletSmartphone size={17} aria-hidden /> Noch kein Schülergerät verbunden
        </p>
        <p className="mt-1 text-[14px] text-ink-2">Die Übung liegt für {s.student} bereit und erscheint am Lernlink. Mit einem verbundenen Tablet kommt sie sofort an.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ConnectTablet />
          {toUnit}
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-2xl bg-red-wash px-4 py-3">
      <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-red">
        <WifiOff size={17} aria-hidden /> Tablet offline – noch nicht angekommen
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !s.assignmentId} onClick={() => start(() => setAgain(s.assignmentId!))}>
          Erneut senden
        </button>
        <Link href="/mehr/geraete" className="btn btn-secondary btn-sm">
          Verbindung prüfen
        </Link>
        <Link href={`/einheiten/${unitId}`} className="btn btn-ghost btn-sm">
          Später senden
        </Link>
      </div>
      <p className="mt-2 text-[13px] text-ink-2">Die Übung erscheint, sobald das Tablet wieder verbunden ist.</p>
    </div>
  );
}

/** "Tablet verbinden": straight to a fresh code with the two steps for the tablet. */
export function ConnectTablet() {
  return (
    <form action={createPairCodeAction}>
      <button className="btn btn-primary btn-sm">
        <TabletSmartphone size={15} aria-hidden /> Tablet verbinden
      </button>
    </form>
  );
}
