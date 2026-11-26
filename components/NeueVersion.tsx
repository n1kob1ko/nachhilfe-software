"use client";

import { useEffect, useState } from "react";
import { istVeralteteAktion, sollSelbstNeuLaden, type Bereich } from "@/lib/neue-version";

/**
 * Nach einem Update hat ein offener Tab (am Tablet oft stundenlang) noch die alte Version. Seine Knöpfe rufen
 * Server Actions, die der neue Server nicht mehr kennt: der Klick tut dann nichts („Failed to find Server Action“,
 * 72-mal am 24./25.11.2026 in den Railway-Protokollen).
 *
 * Darum fragt die Seite /health nach der Version (jede Minute, und wenn der Tab wieder sichtbar wird):
 * - Ist sie neu, geht jeder Link als ganzes Neuladen statt als schneller Wechsel.
 * - Am Schüler-Tablet, in der Schüler-App und am Laptop lädt die Seite selbst neu, sobald 30 s niemand getippt hat.
 * - Beim Lehrer lädt sie neu, wenn er zum Tab zurückkommt; sonst steht unten „Neue Version · Neu laden“.
 * - Scheitert ein Klick an einer alten Server Action, lädt die Seite gleich neu (beim Schreiben erst nach Rückfrage).
 * Wer gerade schreibt, wird nie neu geladen.
 */

const PRUEF_MS = 60_000;
const LEERLAUF_MS = 30_000;
const SCHREIB_MS = 60_000;
const SPERRE_KEY = "neue-version-geladen";

function bereichVon(pfad: string): Bereich {
  return /^\/(geraet|lernen|mitmachen)(\/|$)/.test(pfad) ? "schueler" : "lehrer";
}

function schreibtGerade(letzteEingabe: number) {
  const el = document.activeElement as HTMLElement | null;
  const feld = !!el && (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["button", "submit", "checkbox", "radio", "range"].includes((el as HTMLInputElement).type)));
  return feld || Date.now() - letzteEingabe < SCHREIB_MS;
}

/** Einmal neu laden; nie zweimal in 20 s (falls der Server noch die alte Version meldet). */
function neuLaden() {
  try {
    const zuletzt = Number(sessionStorage.getItem(SPERRE_KEY) ?? 0);
    if (Date.now() - zuletzt < 20_000) return false;
    sessionStorage.setItem(SPERRE_KEY, String(Date.now()));
  } catch {
    // ohne Speicher trotzdem laden
  }
  location.reload();
  return true;
}

export function NeueVersion({ version }: { version: string }) {
  const [veraltet, setVeraltet] = useState(false);
  const [dringend, setDringend] = useState(false);

  useEffect(() => {
    if (version === "dev") return;
    let alt = false;
    let letzteEingabe = 0;
    let letzteAktivitaet = Date.now();
    let warVersteckt = false;

    const pruefen = async () => {
      if (alt || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/health", { cache: "no-store" });
        if (!r.ok) return; // während des Updates antwortet der Server kurz nicht
        const j = (await r.json()) as { version?: string };
        if (j.version && j.version !== version) {
          alt = true;
          setVeraltet(true);
        }
      } catch {
        // offline oder Update läuft: beim nächsten Mal
      }
    };

    const eingabe = () => {
      letzteEingabe = Date.now();
      letzteAktivitaet = Date.now();
    };
    const aktiv = () => {
      letzteAktivitaet = Date.now();
    };
    const sichtbar = () => {
      if (document.visibilityState === "hidden") {
        warVersteckt = true;
        return;
      }
      if (alt && warVersteckt && !schreibtGerade(letzteEingabe)) neuLaden();
      warVersteckt = false;
      void pruefen();
    };
    // Links: vor React (Erfassen am Dokument), damit kein schneller Wechsel mit der alten Seite beginnt
    const klick = (e: MouseEvent) => {
      if (!alt || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      location.assign(url.href);
    };
    const fehler = (grund: unknown) => {
      if (!istVeralteteAktion(grund)) return;
      alt = true;
      setVeraltet(true);
      if (schreibtGerade(letzteEingabe)) setDringend(true);
      else if (!neuLaden()) setDringend(true);
    };
    const onRejection = (e: PromiseRejectionEvent) => fehler(e.reason);
    const onError = (e: ErrorEvent) => fehler(e.error ?? e.message);

    const uhr = setInterval(() => {
      if (alt && sollSelbstNeuLaden({ bereich: bereichVon(location.pathname), leerlaufMs: Date.now() - letzteAktivitaet, schreibt: schreibtGerade(letzteEingabe) }, LEERLAUF_MS)) neuLaden();
    }, PRUEF_MS / 4);
    const pruefUhr = setInterval(() => void pruefen(), PRUEF_MS);

    document.addEventListener("visibilitychange", sichtbar);
    document.addEventListener("input", eingabe, true);
    document.addEventListener("pointerdown", aktiv, true);
    document.addEventListener("keydown", aktiv, true);
    document.addEventListener("click", klick, true);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    window.addEventListener("online", pruefen);
    return () => {
      clearInterval(uhr);
      clearInterval(pruefUhr);
      document.removeEventListener("visibilitychange", sichtbar);
      document.removeEventListener("input", eingabe, true);
      document.removeEventListener("pointerdown", aktiv, true);
      document.removeEventListener("keydown", aktiv, true);
      document.removeEventListener("click", klick, true);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      window.removeEventListener("online", pruefen);
    };
  }, [version]);

  if (!veraltet) return null;
  return (
    <div
      role="status"
      data-testid="neue-version"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[80] mx-auto flex w-[min(92vw,28rem)] items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-lg md:bottom-6"
    >
      <span className="flex-1">{dringend ? "Die Seite ist veraltet. Text kopieren, dann neu laden." : "Neue Version da."}</span>
      <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
        Neu laden
      </button>
    </div>
  );
}
