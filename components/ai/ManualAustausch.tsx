"use client";

import { ClipboardCheck, ClipboardCopy, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Der manuelle KI-Modus im Austausch (ADR 0009): Prompt kopieren, Antwort einfügen.
 *
 * Erscheint über einem KI-Vorgang, während dieser läuft (`aktiv`). Ist der Modus nicht eingestellt,
 * sagt das der Server beim ersten Abruf, und hier wird nichts gezeigt. Der Prompt kommt fertig
 * NAME-GESCHÜTZT vom Server (`lib/ai/providers/manual.ts`); diese Komponente setzt nichts zusammen
 * und zeigt nur, was dort steht.
 *
 * Die Antwort geht über `/api/ki-manuell` zurück und wird dort mit derselben Reparatur und Prüfung
 * behandelt wie eine Antwort über die API. Der wartende Server-Aufruf läuft danach von selbst weiter —
 * diese Komponente muss nichts übernehmen.
 */

type Anfrage = { id: string; fn: string; label: string; prompt: string; problem?: string };

export function ManualAustausch({ aktiv }: { aktiv: boolean }) {
  /** null = noch nicht gefragt; false = Modus aus (dann wird nicht weiter gefragt). */
  const [an, setAn] = useState<boolean | null>(null);
  const [anfragen, setAnfragen] = useState<Anfrage[]>([]);
  const [antwort, setAntwort] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  useEffect(() => {
    if (!aktiv || an === false) return;
    let lebt = true;
    const holen = async () => {
      try {
        const res = await fetch("/api/ki-manuell", { cache: "no-store" });
        if (!res.ok) return;
        const daten = (await res.json()) as { manuell: boolean; anfragen: Anfrage[] };
        if (!lebt) return;
        setAn(daten.manuell);
        // der zuletzt gezeigte Prompt bleibt stehen, bis der Vorgang endet
        if (daten.manuell && daten.anfragen.length) setAnfragen(daten.anfragen);
      } catch {
        /* Netzfehler: der nächste Versuch holt es nach */
      }
    };
    void holen();
    const timer = window.setInterval(() => void holen(), 1_200);
    return () => {
      lebt = false;
      window.clearInterval(timer);
    };
  }, [aktiv, an]);

  // ein neuer Vorgang beginnt mit leerem Feld
  useEffect(() => {
    if (!aktiv) {
      setAntwort("");
      setMeldung(null);
      setAnfragen([]);
      setAn(null);
    }
  }, [aktiv]);

  // Seite verlassen: die geparkte Anfrage wird verworfen, damit kein Server-Aufruf offen bleibt
  useEffect(() => {
    if (!aktiv || !anfragen.length) return;
    const weg = () => {
      for (const a of anfragen) void fetch(`/api/ki-manuell?id=${encodeURIComponent(a.id)}`, { method: "DELETE", keepalive: true });
    };
    window.addEventListener("pagehide", weg);
    return () => window.removeEventListener("pagehide", weg);
  }, [aktiv, anfragen]);

  useEffect(() => {
    if (!kopiert) return;
    const timer = window.setTimeout(() => setKopiert(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [kopiert]);

  const kopieren = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
    } catch {
      setKopiert(false);
    }
  };

  const senden = async (id: string) => {
    setSendet(true);
    setMeldung(null);
    try {
      const res = await fetch("/api/ki-manuell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, antwort }),
      });
      const daten = (await res.json()) as { ok: boolean; fehler?: string };
      if (daten.ok) {
        setMeldung({ art: "ok", text: "Antwort übernommen. Die App arbeitet damit weiter …" });
        setAntwort("");
      } else setMeldung({ art: "fehler", text: daten.fehler ?? "Die Antwort wurde nicht angenommen." });
    } catch {
      setMeldung({ art: "fehler", text: "Die Antwort konnte nicht übermittelt werden. Bitte noch einmal versuchen." });
    } finally {
      setSendet(false);
    }
  };

  if (!aktiv || an !== true) return null;

  const a = anfragen[0];
  if (!a) {
    return (
      <section className="panel px-4 py-3.5" aria-live="polite">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <Sparkles size={15} className="text-accent" aria-hidden /> Manueller KI-Modus
        </p>
        <p className="mt-1 text-[13px] text-ink-2">Der Prompt wird vorbereitet …</p>
      </section>
    );
  }

  return (
    <section className="panel px-4 py-3.5" aria-label="Manueller KI-Modus">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <Sparkles size={15} className="text-accent" aria-hidden /> Manueller KI-Modus: {a.label}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        Es geht <strong>keine Anfrage</strong> hinaus. Kopiere den Prompt in ein Modell deiner Wahl und füge die Antwort hier ein. Die App prüft sie mit
        derselben Reparatur und Prüfung wie eine Antwort über die API.
      </p>
      <p className="mt-1 text-[12.5px] text-ink-3">Der Prompt ist vorbereitet: Namen sind durch [Name] ersetzt. Von selbst verlässt nichts die App.</p>

      <div className="mt-3 grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">1 · Prompt kopieren</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void kopieren(a.prompt)}>
            {kopiert ? <ClipboardCheck size={14} aria-hidden /> : <ClipboardCopy size={14} aria-hidden />}
            {kopiert ? "Kopiert" : "Kopieren"}
          </button>
        </div>
        <details className="rounded-xl bg-panel px-3 py-2">
          <summary className="cursor-pointer text-[13px] text-ink-2">Prompt anzeigen</summary>
          <textarea readOnly className="input mt-2 max-h-72 min-h-40 font-mono text-[12px]" value={a.prompt} onFocus={(e) => e.currentTarget.select()} aria-label="Prompt zum Kopieren" />
        </details>
      </div>

      <div className="mt-3 grid gap-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">2 · Antwort einfügen</span>
        <textarea
          className="input min-h-28 font-mono text-[12.5px]"
          value={antwort}
          placeholder="Die ganze Antwort des Modells hier einfügen — auch mit Codezaun oder Vorrede."
          onChange={(e) => setAntwort(e.target.value)}
          aria-label="Antwort des Modells"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={antwort.trim() === "" || sendet} onClick={() => void senden(a.id)}>
            {sendet ? "Wird geprüft …" : "Antwort prüfen und übernehmen"}
          </button>
          {antwort !== "" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAntwort("")}>
              Leeren
            </button>
          )}
        </div>
      </div>

      {(meldung || a.problem) && (
        <p className={`mt-2 rounded-2xl px-3.5 py-2.5 text-[13px] ${meldung?.art === "fehler" ? "text-red" : "text-ink-2"}`} style={{ background: "var(--red-wash)" }} role={meldung?.art === "fehler" ? "alert" : undefined}>
          {meldung?.text ?? a.problem}
        </p>
      )}
    </section>
  );
}
