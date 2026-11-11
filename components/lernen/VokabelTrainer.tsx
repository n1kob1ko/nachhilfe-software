"use client";

import "./vokabeltrainer.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  vokabelPruefenAction,
  vokabelRundeBeendenAction,
  vokabelRundeStartenAction,
} from "@/app/vokabel-uebung-actions";
import { VokabelBalken } from "@/components/lernen/VokabelBalken";
import type {
  ListenStand,
  VokabelAntwort,
  VokabelKarte,
  VokabelRundenEnde,
} from "@/lib/vokabel-training";

/**
 * Vokabeln üben (lib/vokabel-training.ts): eine Karte nach der anderen, auswählen oder schreiben. Nach jeder Antwort
 * steht gleich das richtige Wort da (mit Beispielsatz); ein falsches Wort kommt am Ende der Runde noch einmal.
 * Was die App nicht sicher weiß, entscheidet der Schüler selbst. Enter geht weiter, 1 bis 4 wählt eine Antwort.
 */

type Eintrag = { karte: VokabelKarte; wiederholung: boolean };
type Phase = "start" | "laden" | "karte" | "ende";

export function VokabelTrainer({
  token,
  stand: standAnfang,
  zurueck,
}: {
  token: string;
  stand: ListenStand;
  zurueck: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("start");
  const [stand, setStand] = useState(standAnfang);
  const [fehler, setFehler] = useState<string | null>(null);
  const [rundeId, setRundeId] = useState(0);
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const [pos, setPos] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [antwort, setAntwort] = useState<VokabelAntwort | null>(null);
  const [busy, setBusy] = useState(false);
  const [tipp, setTipp] = useState(false);
  const [anzahl, setAnzahl] = useState(0);
  const [ende, setEnde] = useState<VokabelRundenEnde | null>(null);
  const feld = useRef<HTMLInputElement>(null);
  const weiterKnopf = useRef<HTMLButtonElement>(null);

  const eintrag = reihe[pos] ?? null;
  const karte = eintrag?.karte ?? null;

  const starten = useCallback(async () => {
    setFehler(null);
    setPhase("laden");
    const r = await vokabelRundeStartenAction(token, stand.id);
    if ("fehler" in r) {
      setFehler(r.fehler);
      setPhase("start");
      return;
    }
    setRundeId(r.rundeId);
    setReihe(r.karten.map((karte) => ({ karte, wiederholung: false })));
    setAnzahl(r.karten.length);
    setPos(0);
    setEingabe("");
    setGewaehlt(null);
    setAntwort(null);
    setTipp(false);
    setEnde(null);
    setPhase("karte");
  }, [token, stand.id]);

  async function pruefe(gegeben: string, selbst?: boolean) {
    if (!karte || busy) return;
    setBusy(true);
    const a = await vokabelPruefenAction(
      token,
      rundeId,
      karte.i,
      gegeben,
      selbst,
    );
    setBusy(false);
    if ("fehler" in a) {
      setFehler(a.fehler);
      return;
    }
    setAntwort(a);
    if (a.ergebnis === "falsch" && eintrag && !eintrag.wiederholung)
      setReihe((r) => [...r, { karte: eintrag.karte, wiederholung: true }]);
  }

  async function weiter() {
    if (!antwort || antwort.ergebnis === "offen" || busy) return;
    if (pos + 1 < reihe.length) {
      setPos(pos + 1);
      setEingabe("");
      setGewaehlt(null);
      setAntwort(null);
      setTipp(false);
      return;
    }
    setBusy(true);
    const e = await vokabelRundeBeendenAction(token, rundeId);
    setBusy(false);
    if ("fehler" in e) {
      setFehler(e.fehler);
      return;
    }
    setEnde(e);
    setStand(e.stand);
    setPhase("ende");
    router.refresh();
  }

  // focus: the field for a written answer, „Weiter“ after an answer
  useEffect(() => {
    if (phase !== "karte") return;
    if (antwort && antwort.ergebnis !== "offen") weiterKnopf.current?.focus();
    else if (!antwort && karte?.art === "schreiben") feld.current?.focus();
  }, [phase, antwort, karte, pos]);

  // keys on the laptop: 1 to 4 choose, Enter goes on
  useEffect(() => {
    if (phase !== "karte" || !karte) return;
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!antwort && karte.art === "auswahl" && /^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < (karte.optionen?.length ?? 0)) {
          setGewaehlt(i);
          void pruefe(String(i));
        }
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  const fortschritt = reihe.length
    ? (pos + (antwort && antwort.ergebnis !== "offen" ? 1 : 0)) / reihe.length
    : 0;

  return (
    <div
      className="vt-buehne fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label={`Vokabeln üben: ${stand.title}`}
      data-testid="vokabel-trainer"
    >
      <div className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <Link
          href={zurueck}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-panel"
          aria-label="Beenden"
        >
          <X size={22} aria-hidden />
        </Link>
        <span
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bar-track)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fortschritt * 100)}
        >
          <span
            className="vt-fortschritt block h-full rounded-full bg-accent"
            style={{ width: `${(phase === "ende" ? 1 : fortschritt) * 100}%` }}
          />
        </span>
        <span className="num w-[52px] shrink-0 text-right text-[14px] text-ink-3">
          {phase === "karte"
            ? `${Math.min(pos + 1, reihe.length)}/${reihe.length}`
            : ""}
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {fehler && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-wash px-4 py-3 text-[15px] text-red"
            data-testid="vt-fehler"
          >
            {fehler}
          </p>
        )}

        {(phase === "start" || phase === "laden") && (
          <div className="vt-rein my-auto grid gap-6 py-8 text-center">
            <div>
              <p className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
                Vokabeln
              </p>
              <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
                {stand.title}
              </h1>
            </div>
            <StandZeile stand={stand} />
            <p className="text-[16px] text-ink-2">
              {stand.dran > 0
                ? `${stand.dran} ${stand.dran === 1 ? "Wort ist" : "Wörter sind"} heute dran.`
                : "Heute ist nichts dran. Du übst die unsichersten Wörter."}{" "}
              Eine Runde hat bis zu 10 Wörter.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg mx-auto min-w-[220px]"
              onClick={() => void starten()}
              disabled={phase === "laden"}
              data-testid="vt-starten"
            >
              {phase === "laden" ? "Einen Moment …" : "Runde starten"}{" "}
              <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        )}

        {phase === "karte" && karte && (
          <div
            key={`${pos}`}
            className="vt-rein flex flex-1 flex-col gap-5 pt-6"
          >
            <div className="text-center">
              <p className="text-[15px] font-medium text-ink-2">
                {karte.frage}
                {eintrag?.wiederholung && (
                  <span className="ml-2 rounded-full bg-amber-wash px-2 py-0.5 text-[12px] font-semibold text-amber">
                    noch einmal
                  </span>
                )}
              </p>
              <p
                className={`mt-3 font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] ${karte.wort.length > 40 ? "text-[22px] leading-snug" : "text-[34px] leading-tight md:text-[40px]"}`}
                lang={karte.sprache === "en" ? "de" : "en"}
                data-testid="vt-wort"
              >
                {karte.wort}
              </p>
            </div>

            {karte.art === "auswahl" ? (
              <div
                className="grid gap-3 sm:grid-cols-2"
                data-testid="vt-optionen"
              >
                {(karte.optionen ?? []).map((o, i) => {
                  const istRichtig = antwort && o === antwort.richtig;
                  const istFalsch =
                    antwort && gewaehlt === i && antwort.ergebnis === "falsch";
                  return (
                    <button
                      key={`${i}${o}`}
                      type="button"
                      lang={karte.sprache}
                      disabled={Boolean(antwort) || busy}
                      onClick={() => {
                        setGewaehlt(i);
                        void pruefe(String(i));
                      }}
                      className={`vt-option drueck flex min-h-[60px] items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[18px] font-medium transition-colors ${
                        istRichtig
                          ? "vt-richtig border-green bg-green-wash text-green"
                          : istFalsch
                            ? "vt-falsch border-red bg-red-wash text-red"
                            : gewaehlt === i
                              ? "border-accent bg-accent-wash"
                              : "border-line bg-surface hover:border-ink-3"
                      } disabled:cursor-default`}
                    >
                      <span
                        className="num hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel text-[13px] text-ink-3 md:flex"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {o}
                      </span>
                      {istRichtig && <Check size={20} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (antwort) void weiter();
                  else if (eingabe.trim()) void pruefe(eingabe.trim());
                }}
              >
                <input
                  ref={feld}
                  className={`input vt-feld text-center text-[22px] ${antwort?.ergebnis === "richtig" ? "vt-richtig border-green" : antwort?.ergebnis === "falsch" ? "vt-falsch border-red" : antwort ? "border-amber" : ""}`}
                  style={{ height: 60, fontSize: 22 }}
                  value={eingabe}
                  onChange={(e) => setEingabe(e.target.value)}
                  readOnly={Boolean(antwort)}
                  lang={karte.sprache}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint={antwort ? "next" : "done"}
                  placeholder={
                    karte.sprache === "en" ? "auf Englisch" : "auf Deutsch"
                  }
                  aria-label="Deine Antwort"
                  data-testid="vt-eingabe"
                />
                {!antwort && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg min-w-[180px]"
                      disabled={busy || !eingabe.trim()}
                      data-testid="vt-pruefen"
                    >
                      {busy ? "…" : "Prüfen"}
                    </button>
                    {karte.tipp && !tipp && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setTipp(true)}
                      >
                        <Lightbulb size={16} aria-hidden /> Tipp
                      </button>
                    )}
                  </div>
                )}
                {tipp && karte.tipp && !antwort && (
                  <p className="text-center text-[15px] text-ink-2">
                    {karte.tipp}
                  </p>
                )}
              </form>
            )}

            <div aria-live="polite" className="min-h-[24px]">
              {antwort && (
                <div
                  className={`vt-rueckmeldung grid gap-1.5 rounded-2xl px-5 py-4 text-[16px] ${antwort.ergebnis === "richtig" ? "bg-green-wash text-green" : antwort.ergebnis === "falsch" ? "bg-red-wash text-red" : "bg-amber-wash text-amber"}`}
                  data-testid="vt-rueckmeldung"
                  data-ergebnis={antwort.ergebnis}
                >
                  <p className="font-semibold">{antwort.text}</p>
                  {antwort.ergebnis !== "richtig" && (
                    <p className="text-ink">
                      {antwort.ergebnis === "offen"
                        ? "In der Liste steht"
                        : "Richtig ist"}
                      : <strong lang={karte.sprache}>{antwort.richtig}</strong>
                    </p>
                  )}
                  {antwort.satz && (
                    <p className="text-[15px] text-ink-2" lang="en">
                      {antwort.satz}
                    </p>
                  )}
                  {antwort.ergebnis === "offen" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void pruefe(eingabe.trim(), true)}
                        data-testid="vt-selbst-ja"
                      >
                        Meins stimmt auch
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void pruefe(eingabe.trim(), false)}
                        data-testid="vt-selbst-nein"
                      >
                        War falsch
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {antwort && antwort.ergebnis !== "offen" && (
              <button
                ref={weiterKnopf}
                type="button"
                className="btn btn-primary btn-lg mt-auto w-full"
                onClick={() => void weiter()}
                disabled={busy}
                data-testid="vt-weiter"
              >
                {pos + 1 < reihe.length ? "Weiter" : "Fertig"}{" "}
                <ArrowRight size={18} aria-hidden />
              </button>
            )}
          </div>
        )}

        {phase === "ende" && ende && (
          <div
            className="vt-rein my-auto grid gap-6 py-8 text-center"
            data-testid="vt-ende"
          >
            <div>
              <p className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
                Runde fertig
              </p>
              <p className="num mt-2 text-[44px] leading-none font-semibold">
                {ende.richtig}
                <span className="text-ink-3"> / {anzahl}</span>
              </p>
              <p className="mt-2 text-[16px] text-ink-2">
                {ende.richtig === anzahl
                  ? "Alle beim ersten Mal richtig!"
                  : "beim ersten Mal richtig"}
              </p>
            </div>
            <StandZeile stand={stand} />
            {ende.nochmal.length > 0 && (
              <div className="panel px-5 py-4 text-left">
                <p className="text-[15px] font-semibold">
                  Diese kommen bald wieder:
                </p>
                <ul className="mt-2 grid gap-1 text-[16px]">
                  {ende.nochmal.map((w) => (
                    <li key={w} className="[overflow-wrap:anywhere]">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void starten()}
                data-testid="vt-nochmal"
              >
                <RotateCcw size={18} aria-hidden /> Noch eine Runde
              </button>
              <Link href={zurueck} className="btn btn-secondary btn-lg">
                Fertig
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandZeile({ stand }: { stand: ListenStand }) {
  return (
    <div className="mx-auto grid w-full max-w-[420px] gap-2">
      <VokabelBalken stand={stand} className="h-3" />
      <p className="flex flex-wrap justify-center gap-x-4 text-[14px] text-ink-2">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full bg-green align-middle"
            aria-hidden
          />
          {stand.sitzt} sitzen
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full bg-accent align-middle"
            aria-hidden
          />
          {stand.ueben} am Üben
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--bar-track)] align-middle"
            aria-hidden
          />
          {stand.neu} neu
        </span>
      </p>
    </div>
  );
}
