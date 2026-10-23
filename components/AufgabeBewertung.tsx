"use client";

import { useState, useTransition } from "react";
import { EyeOff, Star, ThumbsUp } from "lucide-react";
import { bewerteAufgabeAction, entferneBewertungAction } from "@/app/bewertung-actions";
import { Info } from "@/components/Info";
import { GRUENDE, KOMMENTAR_MAX, schnittText, type BewertungInfo, type BewertungZiel, type Grund, type Stand } from "@/lib/bewertung-regeln";

const chip =
  "flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent-bright";
const GUT = (Object.keys(GRUENDE) as Grund[]).filter((g) => GRUENDE[g].gut);
const PROBLEM = (Object.keys(GRUENDE) as Grund[]).filter((g) => !GRUENDE[g].gut);

/** Schnitt, Anzahl und Kennzeichen einer Aufgabe, nur zum Lesen (Listen der Bibliothek). */
export function BewertungsZeichen({ stand }: { stand: Stand }) {
  if (!stand.anzahl) return null;
  return (
    <>
      <span className="num inline-flex items-center gap-1 text-ink-2" title={`${schnittText(stand)} von 5 Sternen, ${stand.anzahl} ${stand.anzahl === 1 ? "Bewertung" : "Bewertungen"}`}>
        <Star size={12} className="text-accent" fill="currentColor" aria-hidden />
        {schnittText(stand)} <span className="text-ink-3">({stand.anzahl})</span>
      </span>
      {stand.ausgeblendet && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-wash px-2.5 py-0.5 font-semibold text-red">
          <EyeOff size={11} aria-hidden /> ausgeblendet
        </span>
      )}
      {stand.gut && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-wash px-2.5 py-0.5 font-semibold text-green">
          <ThumbsUp size={11} aria-hidden /> gut bewertet
        </span>
      )}
    </>
  );
}

/**
 * „Aufgabe bewerten“ (lib/bewertungen.ts): zeigt Schnitt und Anzahl; auf Tipp Sterne, Gründe und Kommentar des Lehrers.
 * Bewertet wird die Aufgabe, nie der Schüler. Rendert den Knopf und darunter (volle Breite) das Formular.
 */
export function AufgabeBewertung({ ziel, info: start, className = "" }: { ziel: BewertungZiel; info: BewertungInfo; className?: string }) {
  const [info, setInfo] = useState(start);
  const [offen, setOffen] = useState(false);
  const [sterne, setSterne] = useState(start.meine?.sterne ?? 0);
  const [gruende, setGruende] = useState<Grund[]>(start.meine?.gruende ?? []);
  const [kommentar, setKommentar] = useState(start.meine?.kommentar ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [pending, run] = useTransition();
  const umschalten = (g: Grund) => setGruende((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]));
  const fertig = (r: { info: BewertungInfo } | { fehler: string }) => {
    if ("fehler" in r) return setFehler(r.fehler);
    setInfo(r.info);
    setSterne(r.info.meine?.sterne ?? 0);
    setGruende(r.info.meine?.gruende ?? []);
    setKommentar(r.info.meine?.kommentar ?? "");
    setGespeichert(true);
    setOffen(false);
  };
  const speichern = () =>
    run(async () => {
      setFehler(null);
      if (!sterne) return setFehler("Bitte 1 bis 5 Sterne wählen.");
      fertig(await bewerteAufgabeAction(ziel, { sterne, gruende, kommentar }));
    });
  const entfernen = () =>
    run(async () => {
      setFehler(null);
      fertig(await entferneBewertungAction(ziel));
    });
  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost btn-sm ${className}`}
        aria-expanded={offen}
        onClick={() => (setOffen(!offen), setGespeichert(false))}
        title="Die Aufgabe bewerten, nicht den Schüler"
      >
        <Star size={14} aria-hidden className={info.meine ? "text-accent" : undefined} fill={info.meine ? "currentColor" : "none"} />
        {info.anzahl ? (
          <span className="num">
            {schnittText(info)} <span className="text-ink-3">({info.anzahl})</span>
            <span className="sr-only">{` von 5 Sternen, ${info.anzahl} ${info.anzahl === 1 ? "Bewertung" : "Bewertungen"}. Aufgabe bewerten`}</span>
          </span>
        ) : (
          "Aufgabe bewerten"
        )}
        {info.ausgeblendet && <EyeOff size={13} className="text-red" aria-label="ausgeblendet" />}
      </button>
      {gespeichert && !offen && (
        <span className="text-[13px] text-green" role="status">
          Bewertung gespeichert.
        </span>
      )}
      {offen && (
        <div className="no-print basis-full rounded-xl bg-paper px-4 py-3 text-left" data-testid="aufgabe-bewerten">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
            Aufgabe bewerten
            <Info label="Info zum Bewerten">
              Gilt für diese Aufgabe überall, wo sie vorkommt: in Übungen, in der Bibliothek und in Lernpaketen. Hat mit den Ergebnissen der Schüler nichts zu tun. Gut bewertete kommen bei
              Suche und Vorschlägen zuerst und dienen der KI als Vorbild. „Fachlich falsch“, „Musterlösung falsch“ oder höchstens 2 Sterne blenden die Aufgabe aus Vorschlägen und
              automatischer Auswahl aus; gelöscht wird nichts. Die angekreuzten Probleme bekommt die KI beim nächsten Erstellen als Hinweis.
            </Info>
          </p>
          {info.anzahl > 0 && (
            <p className="mt-1 text-[13px] text-ink-2">
              <span className="num">
                {schnittText(info)} von 5 Sternen aus {info.anzahl} {info.anzahl === 1 ? "Bewertung" : "Bewertungen"}
              </span>
              {(Object.keys(info.gruende) as Grund[]).length > 0 && ` · ${(Object.keys(info.gruende) as Grund[]).map((g) => `${GRUENDE[g].label} ${info.gruende[g]}×`).join(", ")}`}
              {info.ausgeblendet && <span className="font-semibold text-red"> · ausgeblendet</span>}
              {info.gut && <span className="font-semibold text-green"> · gut bewertet</span>}
            </p>
          )}
          {info.andere.length > 0 && (
            <ul className="mt-1 grid gap-0.5 text-[13px] text-ink-2">
              {info.andere.map((a, i) => (
                <li key={i}>
                  <span className="font-semibold">{a.name || "Kollege"}</span> <span className="num text-ink-3">({a.sterne} ★)</span>: {a.kommentar}
                </li>
              ))}
            </ul>
          )}
          <div role="radiogroup" aria-label="Deine Sterne" className="mt-2 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={sterne === n}
                aria-label={`${n} von 5 Sternen`}
                onClick={() => setSterne(n)}
                className="drueck flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent-wash"
              >
                <Star size={24} className={n <= sterne ? "text-accent" : "text-ink-3"} fill={n <= sterne ? "currentColor" : "none"} aria-hidden />
              </button>
            ))}
          </div>
          <fieldset className="mt-2">
            <legend className="label">Was ist gut?</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GUT.map((g) => (
                <label key={g} className={chip}>
                  <input type="checkbox" className="sr-only" checked={gruende.includes(g)} onChange={() => umschalten(g)} />
                  {GRUENDE[g].label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-2">
            <legend className="label">Was stimmt nicht?</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {PROBLEM.map((g) => (
                <label key={g} className={chip}>
                  <input type="checkbox" className="sr-only" checked={gruende.includes(g)} onChange={() => umschalten(g)} />
                  {GRUENDE[g].label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field mt-2">
            <span className="label">Kommentar (optional)</span>
            <textarea className="input" rows={2} maxLength={KOMMENTAR_MAX} value={kommentar} onChange={(e) => setKommentar(e.target.value)} placeholder="z. B. was an der Lösung nicht stimmt" />
          </label>
          {fehler && (
            <p className="mt-2 text-[13px] text-red" role="alert">
              {fehler}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={speichern}>
              Bewertung speichern
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setOffen(false)}>
              Abbrechen
            </button>
            {info.meine && (
              <button type="button" className="btn btn-ghost btn-sm text-red" disabled={pending} onClick={entfernen}>
                Meine Bewertung entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
