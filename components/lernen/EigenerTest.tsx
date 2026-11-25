"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Clock, Maximize2, RotateCcw, X } from "lucide-react";
import { testAbgebenAction, testSelbstAction } from "@/app/eigene-test-actions";
import { leereFelder, punkteZahl, rfWorte, type Antwort, type Antworten, type FrageAnsicht, type FrageErgebnis, type TestAnsicht, type TestErgebnis } from "@/lib/eigene-tests";

/**
 * Ein eigener Test in der Schüler-App (lib/eigene-tests.ts), gebaut nach nikos Artifact: alle Fragen untereinander,
 * „Test abgeben“, dann Punkte, Note zur Orientierung und bei jeder Frage, was richtig war. Offene Fragen bewertet der
 * Schüler mit der Musterlösung selbst; was die Lehrkraft vergeben hat, gilt und lässt sich nicht mehr ändern.
 * Die Antworten bleiben bis zum Abgeben auf dem Gerät (localStorage), damit ein Neuladen nichts verliert.
 */

export type LetzteAbgabe = { abgabeId: number; ergebnis: TestErgebnis; antworten: Antworten; selbst: Record<string, number>; lehrer: Record<string, number> };

type Entwurf = { antworten: Antworten; start: number };

const speicherKey = (key: string, token: string) => `eigener-test:${key}:${token.slice(0, 6)}`;
function liesEntwurf(k: string): Entwurf | null {
  try {
    const roh = window.localStorage.getItem(k);
    const e = roh ? (JSON.parse(roh) as Entwurf) : null;
    return e && typeof e === "object" && e.antworten && typeof e.start === "number" ? e : null;
  } catch {
    return null;
  }
}
function schreibEntwurf(k: string, e: Entwurf | null) {
  try {
    if (e) window.localStorage.setItem(k, JSON.stringify(e));
    else window.localStorage.removeItem(k);
  } catch {
    /* privat oder voll: dann eben ohne Entwurf */
  }
}

/** **fett** in der Musterlösung */
function Fett({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>))}
    </>
  );
}

const punkteText = (p: number) => `${punkteZahl(p)} P.`;

export function EigenerTest({ token, test, letzte, zurueck }: { token: string; test: TestAnsicht; letzte: LetzteAbgabe | null; zurueck: string }) {
  const key = speicherKey(test.key, token);
  const [antworten, setAntworten] = useState<Antworten>(letzte?.antworten ?? {});
  const [abgabe, setAbgabe] = useState<LetzteAbgabe | null>(letzte);
  const [start, setStart] = useState<number | null>(null);
  const [frage, setFrage] = useState<number | null>(null); // leere Felder beim „Wirklich abgeben?“
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const ergebnisRef = useRef<HTMLDivElement>(null);

  // den Entwurf von diesem Gerät holen (nur ohne Abgabe)
  useEffect(() => {
    if (abgabe) return;
    const e = liesEntwurf(key);
    if (e) {
      setAntworten(e.antworten);
      setStart(e.start);
    } else setStart(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setze = (id: string, a: Antwort) => {
    if (abgabe) return;
    setAntworten((alt) => {
      const neu = { ...alt, [id]: a };
      schreibEntwurf(key, { antworten: neu, start: start ?? Date.now() });
      return neu;
    });
  };
  const setzeTeil = <T,>(id: string, i: number, wert: T, laenge: number) => {
    const alt = antworten[id];
    const liste = Array.from({ length: laenge }, (_, j) => (Array.isArray(alt) ? (alt as unknown[])[j] : undefined) ?? null) as unknown[];
    liste[i] = wert;
    setze(id, liste as Antwort);
  };

  const leer = useMemo(() => leereFelder(test, antworten), [test, antworten]);

  const abgeben = () => {
    setFrage(null);
    setFehler(null);
    starte(async () => {
      const sekunden = start ? Math.round((Date.now() - start) / 1000) : null;
      const r = await testAbgebenAction(token, test.key, antworten, sekunden);
      if ("fehler" in r) {
        setFehler(r.fehler);
        return;
      }
      schreibEntwurf(key, null);
      setAbgabe({ abgabeId: r.abgabeId, ergebnis: r.ergebnis, antworten, selbst: {}, lehrer: {} });
      requestAnimationFrame(() => ergebnisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };

  const selbst = (frageId: string, punkte: number) => {
    if (!abgabe) return;
    const vorher = abgabe;
    setAbgabe({ ...abgabe, selbst: { ...abgabe.selbst, [frageId]: punkte } });
    starte(async () => {
      const r = await testSelbstAction(token, vorher.abgabeId, frageId, punkte);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setAbgabe(vorher);
      } else setAbgabe((a) => (a ? { ...a, ergebnis: r.ergebnis } : a));
    });
  };

  const nochmal = () => {
    schreibEntwurf(key, null);
    setAbgabe(null);
    setAntworten({});
    setStart(Date.now());
    setFehler(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ergebnisVon = (id: string) => abgabe?.ergebnis.fragen.find((f) => f.id === id) ?? null;

  return (
    <div className="pb-16" data-testid="eigener-test">
      <Link href={zurueck} className="treffer mb-3 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-ink-2 hover:text-ink">
        <ChevronLeft size={18} aria-hidden /> Zurück
      </Link>

      <header className="buehne px-6 py-6 md:px-8">
        <div className="relative z-10">
          <p className="buehne-meta text-[14px] font-semibold tracking-wide uppercase">{test.fach} · Test</p>
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em] md:text-[30px]" lang={test.sprache}>
            {test.titel}
          </h1>
          {test.untertitel && (
            <p className="buehne-meta mt-1 text-[16px]" lang={test.sprache}>
              {test.untertitel}
            </p>
          )}
          <p className="buehne-meta mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={16} aria-hidden /> etwa {test.minuten} Minuten
            </span>
            <span className="num">{test.gesamt} Punkte</span>
          </p>
        </div>
      </header>

      {!abgabe && (
        <p className="panel mt-4 px-5 py-4 text-[15px] text-ink-2">
          Beantworte alle Fragen und tippe ganz unten auf <b className="text-ink">„Test abgeben“</b>. Danach siehst du deine Punkte und die richtigen Lösungen. Bei Lückentexten ist Groß- und Kleinschreibung egal. Deine
          Antworten bleiben auf diesem Gerät gespeichert, bis du abgibst.
        </p>
      )}

      {abgabe && (
        <div ref={ergebnisRef} className="scroll-mt-4">
          <Ergebnis e={abgabe.ergebnis} sprache={test.sprache} onNochmal={nochmal} />
        </div>
      )}

      {test.teile.map((teil) => (
        <section key={teil.id} className="mt-9" aria-labelledby={`teil-${teil.id}`}>
          <h2 id={`teil-${teil.id}`} className="mb-3 flex items-baseline justify-between gap-3 text-[20px] font-semibold text-accent" lang={test.sprache}>
            <span>{teil.titel}</span>
            <span className="num shrink-0 text-[14px] font-semibold text-ink-3">{punkteZahl(teil.punkte)} P.</span>
          </h2>
          <ol className="space-y-3">
            {teil.fragen.map((f) => (
              <li key={f.id}>
                <FrageKarte
                  f={f}
                  sprache={test.sprache}
                  bild={f.bild ? test.bild : undefined}
                  antwort={antworten[f.id]}
                  e={ergebnisVon(f.id)}
                  gesperrt={Boolean(abgabe) || laeuft}
                  setze={(a) => setze(f.id, a)}
                  setzeTeil={(i, w, n) => setzeTeil(f.id, i, w, n)}
                  selbst={abgabe?.selbst[f.id]}
                  lehrer={abgabe?.lehrer[f.id]}
                  onSelbst={(p) => selbst(f.id, p)}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}

      {fehler && (
        <p className="mt-6 rounded-xl bg-red-wash px-4 py-3 text-[15px] font-medium text-red" role="alert">
          {fehler}
        </p>
      )}

      {!abgabe && (
        <div className="mt-8">
          {frage !== null ? (
            <div className="panel px-5 py-5" role="alertdialog" aria-labelledby="abgeben-frage" data-testid="abgeben-frage">
              <p id="abgeben-frage" className="text-[17px] font-semibold">
                Test wirklich abgeben?
              </p>
              <p className="mt-1 text-[15px] text-ink-2">{frage === 1 ? "Ein Antwortfeld ist noch leer." : `Es sind noch ${frage} Antwortfelder leer.`}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary btn-lg" onClick={abgeben} disabled={laeuft}>
                  Ja, abgeben
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setFrage(null)}>
                  Zurück
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto" disabled={laeuft} onClick={() => (leer > 0 ? setFrage(leer) : abgeben())} data-testid="test-abgeben">
              {laeuft ? "Wird abgegeben …" : "Test abgeben"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Ergebnis({ e, sprache, onNochmal }: { e: TestErgebnis; sprache: "de" | "en"; onNochmal: () => void }) {
  return (
    <section className="panel mt-4 border-accent-bright/60 px-5 py-5" aria-label="Ergebnis" data-testid="test-ergebnis">
      <p className="text-[14px] font-semibold tracking-wide text-ink-3 uppercase">Ergebnis</p>
      <p className="num mt-1 text-[34px] leading-tight font-semibold">
        {punkteZahl(e.punkte)} / {e.gesamt} Punkte <span className="text-[20px] text-ink-3">({e.prozent} %)</span>
      </p>
      <p className="mt-1 text-[17px] font-semibold">Note (Orientierung): {e.note}</p>
      {e.offen > 0 && (
        <p className="mt-2 rounded-xl bg-amber-wash px-4 py-3 text-[15px] text-amber">
          {e.offen === 1 ? "Eine offene Frage" : `${e.offen} offene Fragen`} noch nicht bewertet: Vergleiche deine Antwort mit der Musterlösung und gib dir ehrlich Punkte. Dein Lehrer sieht deine Antworten.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {e.teile.map((t) => (
          <li key={t.id} className="flex items-center gap-3 text-[15px]">
            <span className="w-[120px] shrink-0 truncate sm:w-[220px]" lang={sprache}>
              {t.titel.split(" – ")[1] ?? t.titel}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bar-track)]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${t.max ? Math.round((t.punkte / t.max) * 100) : 0}%` }} />
            </span>
            <span className="num w-[56px] shrink-0 text-right font-semibold">
              {punkteZahl(t.punkte)}/{punkteZahl(t.max)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[14px] text-ink-2">Bei den Fragen unten siehst du, was richtig (grün) und was falsch (rot) war, mit der richtigen Lösung.</p>
      <button type="button" className="btn btn-secondary mt-4" onClick={onNochmal} data-testid="test-nochmal">
        <RotateCcw size={16} aria-hidden /> Nochmal machen
      </button>
    </section>
  );
}

function Marke({ richtig, loesung }: { richtig: boolean; loesung?: string }) {
  return richtig ? (
    <span className="inline-flex items-center text-green" aria-label="richtig">
      <Check size={18} strokeWidth={3} aria-hidden />
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-red">
      <X size={18} strokeWidth={3} aria-label="falsch" />
      {loesung && <span lang="en">→ {loesung}</span>}
    </span>
  );
}

function FrageKarte({
  f,
  sprache,
  bild,
  antwort,
  e,
  gesperrt,
  setze,
  setzeTeil,
  selbst,
  lehrer,
  onSelbst,
}: {
  f: FrageAnsicht;
  sprache: "de" | "en";
  bild?: TestAnsicht["bild"];
  antwort: Antwort | undefined;
  e: FrageErgebnis | null;
  gesperrt: boolean;
  setze: (a: Antwort) => void;
  setzeTeil: (i: number, wert: unknown, laenge: number) => void;
  selbst?: number;
  lehrer?: number;
  onSelbst: (p: number) => void;
}) {
  const stand = e && e.punkte !== null ? (e.punkte === e.max ? "ok" : e.punkte > 0 ? "teil" : "falsch") : null;
  const rahmen = stand === "ok" ? "border-green/40 bg-green-wash/50" : stand === "teil" ? "border-amber/40 bg-amber-wash/50" : stand === "falsch" ? "border-red/40 bg-red-wash/50" : "";
  const liste = (n: number) => Array.from({ length: n }, (_, i) => (Array.isArray(antwort) ? (antwort as unknown[])[i] : undefined));

  return (
    <div className={`panel px-4 py-4 sm:px-5 ${rahmen}`} id={`frage-${f.id}`} data-frage={f.id}>
      <h3 className="flex items-start justify-between gap-3 text-[17px] leading-snug font-semibold" lang={sprache}>
        <span>
          {f.id}. {f.titel}
        </span>
        <span className="num shrink-0 rounded-full bg-panel px-2.5 py-0.5 text-[13px] font-semibold text-ink-2">{e && e.punkte !== null ? `${punkteZahl(e.punkte)}/${punkteZahl(e.max)}` : punkteText(f.punkte)}</span>
      </h3>

      {bild && (
        <figure className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bild.src} alt={bild.alt} width={bild.breite} height={bild.hoehe} className="h-auto w-full rounded-xl border border-line" />
          <a href={bild.src} target="_blank" rel="noopener" className="treffer mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-accent">
            <Maximize2 size={15} aria-hidden /> Karte groß ansehen
          </a>
        </figure>
      )}

      <div className="mt-3" lang={sprache}>
        {f.art === "auswahl" &&
          f.zeilen.map((z, i) => {
            const wert = liste(f.zeilen.length)[i];
            const zeile = e?.zeilen?.[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-dashed border-line py-2 last:border-b-0">
                {/* kurze Zeilen (1–9, A–C): Nummer und Auswahl nebeneinander, auch am Handy */}
                <span className={z.length <= 3 ? "num w-7 shrink-0 text-center text-[18px] font-semibold" : "min-w-0 flex-[1_1_240px] font-semibold"}>{z}</span>
                <select className={`input min-h-[44px] ${z.length <= 3 ? "min-w-0 flex-1 sm:w-[240px] sm:flex-none" : "w-full sm:w-[240px]"}`} value={typeof wert === "string" ? wert : ""} disabled={gesperrt} aria-label={z} onChange={(ev) => setzeTeil(i, ev.target.value, f.zeilen.length)}>
                  <option value="">{sprache === "de" ? "– wählen –" : "– choose –"}</option>
                  {f.optionen.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                {zeile && <Marke richtig={zeile.richtig} loesung={zeile.loesung} />}
              </div>
            );
          })}

        {(f.art === "mc" || f.art === "mehrfach") && (
          <div className="space-y-1.5" role={f.art === "mc" ? "radiogroup" : "group"} aria-label={f.titel}>
            {f.optionen.map((o, i) => {
              const an = f.art === "mc" ? antwort === i : Array.isArray(antwort) && (antwort as number[]).includes(i);
              const richtig = e?.richtige?.includes(i);
              const farbe = e ? (richtig ? "border-green bg-green-wash" : an ? "border-red bg-red-wash" : "border-line") : an ? "border-accent bg-accent-wash" : "border-line hover:border-line-hover";
              return (
                <label key={i} className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 ${farbe} ${gesperrt ? "cursor-default" : ""}`}>
                  <input
                    type={f.art === "mc" ? "radio" : "checkbox"}
                    name={f.id}
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                    checked={an}
                    disabled={gesperrt}
                    onChange={() => {
                      if (f.art === "mc") setze(i);
                      else {
                        const alt = Array.isArray(antwort) ? (antwort as number[]) : [];
                        setze(alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i].sort((a, b) => a - b));
                      }
                    }}
                  />
                  <span className="min-w-0 flex-1">{o}</span>
                  {e && richtig && <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-green" aria-label="richtige Antwort" />}
                </label>
              );
            })}
            {e && f.art === "mehrfach" && (e.falschAngekreuzt ?? 0) > 0 && <p className="text-[14px] text-ink-2">Falsch angekreuzte Antworten ziehen je 1 Punkt ab.</p>}
          </div>
        )}

        {f.art === "rf" &&
          f.zeilen.map((z, i) => {
            const wert = liste(f.zeilen.length)[i];
            const zeile = e?.zeilen?.[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-dashed border-line py-2.5 last:border-b-0">
                <span className="min-w-0 flex-[1_1_260px]">{z}</span>
                <span className="flex gap-2" role="radiogroup" aria-label={z}>
                  {([true, false] as const).map((w) => (
                    <button
                      key={String(w)}
                      type="button"
                      role="radio"
                      aria-checked={wert === w}
                      disabled={gesperrt}
                      onClick={() => setzeTeil(i, w, f.zeilen.length)}
                      className={`min-h-[44px] min-w-[76px] rounded-xl border-[1.5px] px-3 text-[15px] font-semibold ${wert === w ? "border-accent bg-accent text-on-fill" : "border-line-strong bg-surface text-ink"}`}
                    >
                      {w ? rfWorte(sprache)[0] : rfWorte(sprache)[1]}
                    </button>
                  ))}
                </span>
                {zeile && <Marke richtig={zeile.richtig} loesung={zeile.loesung} />}
              </div>
            );
          })}

        {f.art === "luecken" && (
          <p className="text-[17px] leading-[2.6] whitespace-pre-line">
            {f.stuecke.map((s, i) => {
              const n = f.stuecke.length - 1;
              const wert = liste(n)[i];
              const zeile = e?.zeilen?.[i];
              return (
                <span key={i}>
                  {s}
                  {i < n && (
                    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                      <input
                        type="text"
                        className="input mx-1 inline-block h-[40px] w-[132px] px-2.5 py-1 text-[16px]"
                        value={typeof wert === "string" ? wert : ""}
                        disabled={gesperrt}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        aria-label={`Lücke ${i + 1}`}
                        onChange={(ev) => setzeTeil(i, ev.target.value, n)}
                      />
                      {zeile && <Marke richtig={zeile.richtig} loesung={zeile.loesung} />}
                    </span>
                  )}
                </span>
              );
            })}
          </p>
        )}

        {f.art === "offen" && (
          <>
            <textarea
              className="input min-h-[120px] w-full py-2.5 text-[16px] leading-relaxed"
              placeholder={sprache === "de" ? "Schreib deine Antwort hier …" : "Write your answer here …"}
              value={typeof antwort === "string" ? antwort : ""}
              disabled={gesperrt}
              onChange={(ev) => setze(ev.target.value)}
              aria-label={`Antwort ${f.id}`}
            />
            {e && (
              <div className="mt-3 space-y-3" lang="de">
                <div className="rounded-xl border-l-4 border-accent bg-surface px-4 py-3 text-[16px]" lang={sprache}>
                  <span className="font-semibold" lang="de">
                    Musterlösung:{" "}
                  </span>
                  <Fett text={e.muster ?? ""} />
                </div>
                {lehrer !== undefined ? (
                  <p className="text-[15px] font-semibold text-ink-2">
                    Dein Lehrer hat bewertet: {lehrer} von {f.punkte} Punkten.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[15px]">
                    <span className="w-full sm:w-auto">Wie viele Punkte gibst du dir?</span>
                    {Array.from({ length: f.punkte + 1 }, (_, p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onSelbst(p)}
                        aria-pressed={selbst === p}
                        className={`num min-h-[44px] min-w-[48px] rounded-xl border-[1.5px] px-3 font-semibold ${selbst === p ? "border-accent bg-accent text-on-fill" : "border-accent bg-surface text-accent"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
