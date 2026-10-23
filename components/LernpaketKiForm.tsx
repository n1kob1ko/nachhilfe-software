"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { lernpaketMitKiAction } from "@/app/lernpaket-actions";
import { ManualAustausch } from "@/components/ai/ManualAustausch";
import type { KiEingabe } from "@/lib/lernpaket-ki";

export type SkillGruppe = { label: string; skills: { id: string; label: string }[] };

const dauerText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * „Mit KI entwerfen“ unter Mehr › Lernpakete (lib/lernpaket-ki.ts): Fähigkeit oder Fach und Thema, Schulart,
 * Klasse, Dauer, Schwierigkeit und Hinweise. Die geschätzten Kosten stehen am Knopf. Während die KI schreibt,
 * läuft die Zeit mit; bei einem Fehler bleibt alles stehen und „Erneut versuchen“ schickt dasselbe noch einmal.
 * Ist die KI aus, sagt der Bereich das, und der Knopf bleibt aus.
 */
export function LernpaketKiForm(props: {
  gruppen: SkillGruppe[];
  faecher: string[];
  schularten: string[];
  schwierigkeiten: readonly string[];
  dauer: { von: number; bis: number; vorgabe: number };
  /** null: die KI kann gefragt werden; sonst warum nicht */
  kiAus: string | null;
  /** „ca. 14–23 Cent“ oder „kostet nichts (manueller Modus)“ */
  kosten: string;
}) {
  const [laeuft, starten] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [letzte, setLetzte] = useState<KiEingabe | null>(null);
  const [seit, setSeit] = useState(0);
  const unterwegs = useRef(false);

  useEffect(() => {
    if (!laeuft) return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [laeuft]);

  const senden = (e: KiEingabe) => {
    // a second click while the first is on its way does nothing (the server would wait for the same request anyway)
    if (unterwegs.current || props.kiAus) return;
    unterwegs.current = true;
    setFehler(null);
    setLetzte(e);
    starten(async () => {
      try {
        const res = await lernpaketMitKiAction(e);
        if (res.ok) {
          window.location.assign(`/mehr/lernpakete/${res.id}?ki=1${res.weggelassen.length ? `&weggelassen=${res.weggelassen.length}` : ""}`);
          return;
        }
        setFehler(`${res.error} Es wurde nichts gespeichert.`);
      } catch {
        setFehler("Keine Antwort vom Server. Ist der Entwurf doch fertig geworden, steht er gleich in der Liste.");
      } finally {
        unterwegs.current = false;
      }
    });
  };

  const absenden = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    senden({ skillId: s("skill_id"), fach: s("fach"), thema: s("thema"), schulart: s("schulart"), klasse: Number(s("klasse")) || null, dauer: Number(s("dauer")) || props.dauer.vorgabe, schwierigkeit: s("schwierigkeit"), hinweise: s("hinweise") });
  };

  const aus = laeuft || Boolean(props.kiAus);
  return (
    <form onSubmit={absenden} className="panel mb-8 grid max-w-[760px] gap-3 px-5 py-4 sm:grid-cols-2" data-testid="lernpaket-ki">
      <ManualAustausch aktiv={laeuft} />
      <p className="text-[14px] text-ink-2 sm:col-span-2">
        Die KI schreibt Ablauf, Erklärungen, Fragen und erwartete Antworten zu einem Thema. Aufgaben nimmt sie zuerst aus der Bibliothek und den eingebauten Generatoren; eigene behält Lernheft nur, wenn sie die automatische Prüfung bestehen. Das Paket kommt als Entwurf und bleibt „Ungeprüft“, bis du es geprüft hast. Was die KI unsicher findet, steht bei „Noch zu prüfen“.
      </p>
      {props.kiAus && (
        <p className="rounded-lg bg-amber-wash px-4 py-3 text-[14px] text-amber sm:col-span-2" role="status">
          {props.kiAus}
        </p>
      )}
      <label className="field sm:col-span-2">
        <span className="label">Fähigkeit (bestimmt Fach und Thema)</span>
        <select className="input" name="skill_id" defaultValue="" disabled={laeuft}>
          <option value="">Ohne Fähigkeit (dann Fach und Thema angeben, ohne Aufgaben)</option>
          {props.gruppen.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Fach (ohne Fähigkeit)</span>
        <input className="input" name="fach" list="lp-ki-faecher" maxLength={60} autoComplete="off" placeholder="z. B. Biologie" disabled={laeuft} />
        <datalist id="lp-ki-faecher">
          {props.faecher.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span className="label">Thema (ohne Fähigkeit nötig)</span>
        <input className="input" name="thema" maxLength={120} placeholder="z. B. Die Zelle" disabled={laeuft} />
      </label>
      <label className="field">
        <span className="label">Schulart</span>
        <select className="input" name="schulart" defaultValue="" disabled={laeuft}>
          <option value="">jede</option>
          {props.schularten.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Klasse</span>
        <select className="input" name="klasse" defaultValue="" disabled={laeuft}>
          <option value="">jede</option>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
            <option key={k} value={k}>
              {k}.
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Dauer in Minuten</span>
        <input className="input num" type="number" name="dauer" min={props.dauer.von} max={props.dauer.bis} defaultValue={props.dauer.vorgabe} required disabled={laeuft} />
      </label>
      <label className="field">
        <span className="label">Schwierigkeit</span>
        <select className="input" name="schwierigkeit" defaultValue="mittel" disabled={laeuft}>
          {props.schwierigkeiten.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="field sm:col-span-2">
        <span className="label">Hinweise für die KI (optional)</span>
        <textarea className="input" name="hinweise" rows={3} maxLength={1000} placeholder="z. B. typische Fehler: verwechseln Dativ und Akkusativ nach „in“" disabled={laeuft} />
        <span className="text-[13px] text-ink-3">Keine Schülernamen nötig: das Paket gehört zum Thema, nicht zu einem Schüler. Namen werden vor dem Senden ersetzt.</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2" aria-live="polite">
        {laeuft ? (
          <p className="flex min-w-[16rem] flex-1 items-start gap-2 text-[14.5px]" data-testid="lernpaket-ki-laeuft">
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-accent" aria-hidden />
            <span>
              Die KI entwirft das Lernpaket … <span className="num font-semibold">{dauerText(seit)}</span>
              <span className="block text-[13px] text-ink-3">Das dauert meist ein bis drei Minuten. Danach prüft Lernheft jede Aufgabe und speichert den Entwurf.</span>
            </span>
          </p>
        ) : (
          <>
            <button className="btn btn-primary" disabled={aus} title={props.kiAus ?? props.kosten}>
              <Sparkles size={16} aria-hidden /> Entwurf erstellen
              <span className="font-normal opacity-80">· {props.kosten}</span>
            </button>
            {fehler && letzte && (
              <button type="button" className="btn btn-secondary" onClick={() => senden(letzte)} disabled={aus}>
                <RotateCcw size={16} aria-hidden /> Erneut versuchen
              </button>
            )}
          </>
        )}
        {fehler && (
          <p className="w-full rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert" data-testid="lernpaket-ki-fehler">
            {fehler}
          </p>
        )}
      </div>
    </form>
  );
}
