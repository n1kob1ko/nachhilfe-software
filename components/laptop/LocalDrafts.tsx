"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Copy, Loader2, Trash2 } from "lucide-react";
import { plainText } from "@/lib/text-doc";
import { DISCARD_FLAG, readDrafts, removeAllLaptopData, removeDraft, type Draft } from "./drafts";

const DAY = 86_400_000;

async function signOut() {
  try {
    await fetch("/mitmachen/abmelden", { method: "POST", redirect: "manual", cache: "no-store" });
  } catch {
    // offline: the cookie ends with the browser, the server has ended the access anyway
  }
}

type Row = Draft & { state: "speichert" | "offline" | "nicht-moeglich" };

/**
 * After the access ended: copies of texts still on this laptop are saved (allowed for a few minutes
 * after the unit ended), then removed together with the access cookie. Without a connection it keeps
 * trying and keeps the copy; nothing typed is thrown away unless the student chooses so.
 */
export function EndedCleanup({ textIds }: { textIds: number[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const run = useCallback(async () => {
    const mine = readDrafts().filter((d) => textIds.includes(d.textId));
    const out: Row[] = [];
    for (const d of mine) {
      const post = (force: boolean) =>
        fetch(`/mitmachen/text/${d.textId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: d.base, body: d.body, force }),
          cache: "no-store",
        });
      try {
        let res = await post(false);
        // changed elsewhere in the meantime: keep this copy too, the other one stays under "Frühere Fassungen"
        if (res.status === 409) res = await post(true);
        if (res.ok) removeDraft(d.textId);
        else out.push({ ...d, state: "nicht-moeglich" });
      } catch {
        out.push({ ...d, state: "offline" });
      }
    }
    setRows(out);
    if (out.length === 0) await signOut();
  }, [textIds]);

  useEffect(() => {
    void run();
  }, [run]);

  // without a connection: again as soon as it is back
  const waiting = rows?.some((r) => r.state === "offline");
  useEffect(() => {
    if (!waiting) return;
    const again = () => void run();
    window.addEventListener("online", again);
    const id = window.setInterval(() => navigator.onLine && again(), 15_000);
    return () => {
      window.removeEventListener("online", again);
      window.clearInterval(id);
    };
  }, [waiting, run]);

  const drop = async (textId: number) => {
    removeDraft(textId);
    const rest = (rows ?? []).filter((r) => r.textId !== textId);
    setRows(rest);
    if (rest.length === 0) await signOut();
  };
  const copy = async (r: Row) => {
    try {
      await navigator.clipboard.writeText(plainText(r.body));
      setCopied(r.textId);
    } catch {
      setCopied(null);
    }
  };

  if (!rows) {
    return (
      <p className="mt-6 inline-flex items-center gap-2 text-[15px] text-ink-2" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Wird aufgeräumt …
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="mt-6 flex max-w-[400px] items-start gap-2 text-left text-[15px] font-semibold text-green" role="status" data-testid="laptop-clean">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden /> Alles gespeichert. Auf diesem Gerät ist nichts mehr davon. Du kannst das Fenster schließen.
      </p>
    );
  }
  return (
    <ul className="mt-6 grid w-full max-w-[520px] gap-3 text-left">
      {rows.map((r) => (
        <li key={r.textId} role="alert" className="rounded-2xl bg-amber-wash px-4 py-3">
          {r.state === "offline" ? (
            <p className="inline-flex items-start gap-2 text-[15px] font-semibold">
              <CloudOff size={18} className="mt-0.5 shrink-0" aria-hidden /> Dein Text ({r.words} Wörter) ist noch nicht gespeichert. Bitte lass dieses Fenster offen, bis die
              Verbindung wieder da ist.
            </p>
          ) : (
            <>
              <p className="text-[15px] font-semibold">Ein Entwurf ({r.words} Wörter) konnte nicht mehr gespeichert werden.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy(r)}>
                  <Copy size={14} aria-hidden /> {copied === r.textId ? "Kopiert" : "Als Text kopieren"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void drop(r.textId)}>
                  <Trash2 size={14} aria-hidden /> Vom Gerät löschen
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** On the code page: after "Trotzdem abmelden" everything goes; otherwise copies older than a day. */
export function JoinCleanup() {
  useEffect(() => {
    let discard = false;
    try {
      discard = sessionStorage.getItem(DISCARD_FLAG) === "1";
    } catch {
      // no session storage
    }
    if (discard) return removeAllLaptopData();
    for (const d of readDrafts()) if (Date.now() - d.at > DAY) removeDraft(d.textId);
  }, []);
  return null;
}
