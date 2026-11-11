"use client";

import "./lernspiel.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Flame, Lightbulb, Star, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { spielBeendenAction, spielStartenAction } from "@/app/lernspiel-actions";
import { SPIEL_AUFGABE, SPIEL_TITEL, sterneFuer, type SpielArt, type SpielErgebnis, type SpielKarte, type SpielVorschlag } from "@/lib/lernspiele-typen";

/**
 * Ein Lernspiel der Schüler-App (lib/lernspiele.ts): Karten in Fächer werfen oder antippen.
 *
 * - Richtig: die Karte fliegt ins Fach, oben steht kurz der ganze richtige Satz (lernen beim Spielen).
 * - Falsch: die Lücke zeigt die Wahl durchgestrichen, das richtige Fach leuchtet, eine kurze Regel erscheint, und
 *   weiter geht es erst mit der richtigen Antwort. Die Karte kommt drei Karten später noch einmal.
 * - Gezählt wird nur die erste Wahl je Karte (der Server prüft sie, app/lernspiel-actions.ts).
 *
 * Ziehen läuft ohne React-Zustand je Bewegung (nur transform am Element), Fliegen über die Web Animations API.
 * Tasten 1 bis 5 wählen ein Fach am Laptop.
 */

type Eintrag = { karte: SpielKarte; wiederholung: boolean };
type Stand = { wahl: string; richtig: boolean } | null;
type Phase = "start" | "laden" | "spiel" | "ende";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const vibriere = (muster: number | number[]) => {
  try {
    navigator.vibrate?.(muster);
  } catch {
    /* nicht jedes Gerät kann es */
  }
};

/** Der Satz mit eingesetzter Antwort; bei Präpositionen steht ein Leerzeichen vor dem Nomen, Endungen hängen am Wort. */
const verbinder = (art: SpielArt) => (art === "praepositionen" ? " " : "");
const ohneStrich = (s: string) => s.replace(/^-/, "");

export function Lernspiel({
  token,
  art,
  vorschlaege,
  serie: serieAnfang,
  lernstand,
}: {
  token: string;
  art: SpielArt;
  vorschlaege: SpielVorschlag[];
  serie: number;
  lernstand: number | null;
}) {
  const router = useRouter();
  const zurueck = `/lernen/${token}`;
  const vorschlag = vorschlaege.find((v) => v.art === art) ?? null;

  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [rundeId, setRundeId] = useState(0);
  const [anzahl, setAnzahl] = useState(0);
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const [pos, setPos] = useState(0);
  const [stand, setStand] = useState<Stand>(null);
  const [falschGewaehlt, setFalschGewaehlt] = useState<string[]>([]);
  const [wackeln, setWackeln] = useState(0);
  const [combo, setCombo] = useState(0);
  const [geloest, setGeloest] = useState<Set<string>>(new Set());
  const [zuletzt, setZuletzt] = useState<{ karte: SpielKarte; n: number } | null>(null);
  const [ziel, setZiel] = useState<number | null>(null);
  const [blitz, setBlitz] = useState<number | null>(null);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);

  const erste = useRef(new Map<string, string>());
  const beschaeftigt = useRef(false);
  const karteRef = useRef<HTMLDivElement | null>(null);
  const fachRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const zug = useRef<{ id: number; x0: number; y0: number; x: number; y: number; t: number; vx: number; vy: number; cx: number } | null>(null);
  const reduziert = useRef(false);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // das Spiel liegt über der Seite: die Seite darunter rollt nicht mit
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, []);

  const aktuell = reihe[pos]?.karte ?? null;

  // ---------- Runde starten und beenden ----------

  const starten = useCallback(async () => {
    setPhase("laden");
    setFehler(null);
    const r = await spielStartenAction(token, art);
    if ("fehler" in r) {
      setFehler(r.fehler);
      setPhase("start");
      return;
    }
    erste.current = new Map();
    beschaeftigt.current = false;
    setRundeId(r.rundeId);
    setAnzahl(r.karten.length);
    setReihe(r.karten.map((karte) => ({ karte, wiederholung: false })));
    setPos(0);
    setStand(null);
    setFalschGewaehlt([]);
    setCombo(0);
    setGeloest(new Set());
    setZuletzt(null);
    setErgebnis(null);
    setPhase("spiel");
  }, [token, art]);

  const beenden = useCallback(
    async (id: number) => {
      setPhase("ende");
      const antworten = [...erste.current.entries()].map(([key, wahl]) => ({ key, wahl }));
      setErgebnis(await spielBeendenAction(token, id, antworten));
      router.refresh();
    },
    [token, router],
  );

  // ---------- Karte fliegt ins Fach ----------

  const fliege = useCallback((fach: number, von: { x: number; y: number; r: number }, geworfen: boolean) => {
    const el = karteRef.current;
    const bin = fachRefs.current[fach];
    if (!el) return Promise.resolve();
    if (reduziert.current || !bin || !el.animate) {
      return el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).finished.then(() => undefined) ?? Promise.resolve();
    }
    const a = el.getBoundingClientRect();
    const b = bin.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    el.style.transition = "none";
    return el
      .animate(
        [
          { transform: `translate(${von.x}px, ${von.y}px) rotate(${von.r}deg)`, opacity: 1 },
          { transform: `translate(${von.x + dx}px, ${von.y + dy}px) rotate(${von.r * 0.4}deg) scale(0.22)`, opacity: 0 },
        ],
        // geworfen ist sie schon in Fahrt: ease-out; angetippt bewegt sie sich über den Schirm: ease-in-out
        { duration: geworfen ? 240 : 300, easing: geworfen ? "cubic-bezier(0.23, 1, 0.32, 1)" : "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
      )
      .finished.then(() => undefined);
  }, []);

  // ---------- Antwort ----------

  const waehle = useCallback(
    async (wahl: string, von: { x: number; y: number; r: number } = { x: 0, y: 0, r: 0 }, geworfen = false) => {
      const karte = reihe[pos]?.karte;
      if (!karte || beschaeftigt.current) return;
      if (!erste.current.has(karte.key)) erste.current.set(karte.key, wahl);
      const fach = karte.faecher.indexOf(wahl);

      if (wahl !== karte.richtig) {
        // falsch: Karte zurück in die Mitte, Wahl durchgestrichen, richtiges Fach leuchtet, Regel erscheint
        const el = karteRef.current;
        if (el) {
          el.style.transition = "";
          el.style.transform = "";
        }
        vibriere([28, 40, 28]);
        if (el && !reduziert.current && el.animate)
          el.animate([{ translate: "0 0" }, { translate: "-7px 0" }, { translate: "6px 0" }, { translate: "-3px 0" }, { translate: "0 0" }], { duration: 320, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
        setZiel(null);
        setStand({ wahl, richtig: false });
        setFalschGewaehlt((f) => (f.includes(wahl) ? f : [...f, wahl]));
        setWackeln((n) => n + 1);
        setCombo(0);
        // einmal wiederholen, drei Karten später (nie eine Wiederholung wiederholen)
        if (!reihe[pos].wiederholung && !reihe.slice(pos + 1).some((e) => e.karte.key === karte.key)) {
          setReihe((r) => {
            const neu = [...r];
            neu.splice(Math.min(pos + 4, neu.length), 0, { karte, wiederholung: true });
            return neu;
          });
        }
        return;
      }

      beschaeftigt.current = true;
      const ersterVersuch = stand === null;
      vibriere(12);
      setStand({ wahl, richtig: true });
      setBlitz(fach);
      if (ersterVersuch) setCombo((c) => c + 1);
      setGeloest((g) => new Set(g).add(karte.key));
      setZuletzt((z) => ({ karte, n: (z?.n ?? 0) + 1 }));
      await fliege(fach, von, geworfen);
      setZiel(null);
      setBlitz(null);
      setStand(null);
      setFalschGewaehlt([]);
      beschaeftigt.current = false;
      if (pos + 1 >= reihe.length) {
        void beenden(rundeId);
        return;
      }
      setPos(pos + 1);
    },
    [reihe, pos, stand, fliege, beenden, rundeId],
  );

  // Tasten 1–5 am Laptop (ohne Bewegung beim Antippen: wiederholte Aktionen sollen sofort wirken)
  useEffect(() => {
    if (phase !== "spiel" || !aktuell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= aktuell.faecher.length) {
        e.preventDefault();
        void waehle(aktuell.faecher[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, aktuell, waehle]);

  // ---------- Ziehen und Werfen ----------

  const naechstesFach = (cx: number): number | null => {
    let best: number | null = null;
    let abstand = Infinity;
    fachRefs.current.forEach((f, i) => {
      if (!f) return;
      const r = f.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - cx);
      if (d < abstand) {
        abstand = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (beschaeftigt.current || zug.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    zug.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0, cx: r.left + r.width / 2 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - z.t);
    z.vx = 0.7 * ((e.clientX - z.x) / dt) + 0.3 * z.vx;
    z.vy = 0.7 * ((e.clientY - z.y) / dt) + 0.3 * z.vy;
    z.x = e.clientX;
    z.y = e.clientY;
    z.t = now;
    const dx = e.clientX - z.x0;
    let dy = e.clientY - z.y0;
    // nach oben gibt es kein Fach: dort wird es schwer (Reibung statt harter Wand)
    if (dy < 0) dy = -Math.pow(-dy, 0.75);
    const el = e.currentTarget;
    el.dataset.zieht = "";
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${reduziert.current ? 0 : dx * 0.05}deg)`;
    const kandidat = dy > 36 ? naechstesFach(z.cx + dx) : null;
    setZiel((alt) => (alt === kandidat ? alt : kandidat));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.id) return;
    zug.current = null;
    const el = e.currentTarget;
    delete el.dataset.zieht;
    const dx = e.clientX - z.x0;
    const dy = e.clientY - z.y0;
    // ein schneller Wurf reicht, auch über kurze Strecke (Schwung statt Schwelle)
    const geworfen = dy > 110 || (z.vy > 0.45 && dy > 24);
    const karte = reihe[pos]?.karte;
    if (geworfen && karte) {
      const fach = naechstesFach(z.cx + dx + z.vx * 140);
      if (fach !== null) {
        void waehle(karte.faecher[fach], { x: dx, y: Math.max(dy, 0), r: reduziert.current ? 0 : dx * 0.05 }, true);
        return;
      }
    }
    setZiel(null);
    el.style.transform = "";
  };

  // ---------- Darstellung ----------

  const kopf = (
    <div className="ls-kopf">
      <Link href={zurueck} className="ls-zu" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </Link>
      {phase === "spiel" ? (
        <>
          <div className="ls-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={anzahl} aria-valuenow={geloest.size} aria-label="Fortschritt">
            {Array.from({ length: anzahl }, (_, i) => (
              <span key={i} data-fertig={i < geloest.size ? "" : undefined} />
            ))}
          </div>
          <span className="ls-combo" data-leer={combo < 3 ? "" : undefined} aria-live="polite">
            <Flame size={18} aria-hidden />
            <b key={combo} data-neu="">
              {combo}
            </b>
          </span>
        </>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );

  if (phase === "start" || phase === "laden") {
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
        {kopf}
        <div className="ls-mitte ls-staffel">
          <p className="text-[14px] font-semibold tracking-wide text-ink-3 uppercase" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel Deutsch
          </p>
          <h1 className="display mt-1 text-[36px] leading-tight font-semibold tracking-[-0.02em]" style={{ "--n": 1 } as CSSProperties}>
            {SPIEL_TITEL[art]}
          </h1>
          <p className="mt-2 text-[17px] text-ink-2" style={{ "--n": 2 } as CSSProperties}>
            {SPIEL_AUFGABE[art]} Zieh die Karte nach unten oder tipp auf ein Fach.
          </p>
          {vorschlag && vorschlag.quelle !== "fach" && (
            <span className="ls-grund mt-4" style={{ "--n": 3 } as CSSProperties}>
              {vorschlag.quelle === "pruefung" ? <CalendarDays size={16} aria-hidden /> : <TrendingUp size={16} aria-hidden />}
              {vorschlag.grund}
            </span>
          )}

          <div className="panel mt-6 grid grid-cols-2 gap-4 p-4" style={{ "--n": 4 } as CSSProperties}>
            <div>
              <p className="text-[13px] text-ink-3">Dein Stand</p>
              <p className="text-[22px] font-semibold tabular-nums">{lernstand === null ? "Noch offen" : pct(lernstand)}</p>
            </div>
            <div>
              <p className="text-[13px] text-ink-3">Serie</p>
              <p className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums">
                <Flame size={20} className={serieAnfang > 0 ? "text-amber" : "text-ink-3"} aria-hidden />
                {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
              </p>
            </div>
          </div>

          {vorschlaege.length > 1 && (
            <div className="mt-6" style={{ "--n": 5 } as CSSProperties}>
              <p className="mb-2 text-[13px] text-ink-3">Anderes Spiel</p>
              <nav className="ls-wahl" aria-label="Spiel wählen">
                {vorschlaege.map((v) => (
                  <Link key={v.art} href={`/lernen/${token}/spiel?art=${v.art}`} replace aria-current={v.art === art ? "page" : undefined}>
                    {SPIEL_TITEL[v.art]}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {fehler && (
            <p className="mt-6 text-[15px] text-red" role="alert">
              {fehler}
            </p>
          )}
          <div className="mt-auto pt-8" style={{ "--n": 6 } as CSSProperties}>
            <button type="button" className="btn btn-primary ls-los" onClick={() => void starten()} disabled={phase === "laden"} autoFocus>
              {phase === "laden" ? "Karten werden gemischt …" : "Los geht’s"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende") {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const richtig = e?.richtig ?? [...erste.current.entries()].filter(([key, wahl]) => reihe.find((r) => r.karte.key === key)?.karte.richtig === wahl).length;
    const sterne = e?.sterne ?? sterneFuer(richtig, anzahl);
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Runde fertig">
        {kopf}
        <div className="ls-mitte ls-staffel text-center">
          <div className="ls-sterne mt-4" aria-label={`${sterne} von 3 Sternen`} style={{ "--n": 0 } as CSSProperties}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 64 : 52} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" strokeWidth={1.2} style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <h1 className="display mt-5 text-[30px] font-semibold tracking-[-0.02em]" style={{ "--n": 1 } as CSSProperties}>
            {sterne === 3 ? "Stark!" : sterne === 2 ? "Gut gemacht!" : "Weiter so!"}
          </h1>
          <p className="mt-1 text-[17px] text-ink-2" style={{ "--n": 2 } as CSSProperties}>
            {richtig} von {anzahl} beim ersten Mal richtig
          </p>

          {ergebnis && "fehler" in ergebnis && (
            <p className="mt-4 text-[15px] text-red" role="alert">
              {ergebnis.fehler}
            </p>
          )}

          <div className="panel mt-6 p-4 text-left" style={{ "--n": 3 } as CSSProperties}>
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-semibold">{SPIEL_TITEL[art]}</p>
              <p className="text-[15px] text-ink-2 tabular-nums">
                {e ? (
                  e.lernstandVorher === null ? (
                    <b className="text-ink">{pct(e.lernstandNachher)}</b>
                  ) : (
                    <>
                      {pct(e.lernstandVorher)} → <b className="text-ink">{pct(e.lernstandNachher)}</b>
                    </>
                  )
                ) : (
                  "…"
                )}
              </p>
            </div>
            <div className="ls-balken mt-2">
              <span style={{ transform: `scaleX(${e?.lernstandNachher ?? e?.lernstandVorher ?? lernstand ?? 0})` }} />
            </div>
            {e && (
              <p className="mt-3 flex items-center gap-1.5 text-[14px] text-ink-2">
                <Flame size={16} className="text-amber" aria-hidden />
                {e.serie === 1 ? "1 Tag Serie" : `${e.serie} Tage Serie`}
              </p>
            )}
          </div>

          {e && e.nochmal.length > 0 && (
            <div className="panel mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
              <p className="text-[15px] font-semibold">Kommt nächstes Mal wieder</p>
              <ul className="mt-2 space-y-1.5 text-[16px]">
                {e.nochmal.slice(0, 5).map((n) => {
                  const karte = reihe.find((r) => r.karte.loesung === n.loesung)?.karte;
                  return <li key={n.loesung}>{karte ? <Loesung karte={karte} art={art} /> : n.loesung}</li>;
                })}
              </ul>
              {e.nochmal.length > 5 && <p className="mt-2 text-[14px] text-ink-3">und {e.nochmal.length - 5} weitere</p>}
            </div>
          )}

          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 5 } as CSSProperties}>
            <button type="button" className="btn btn-primary ls-los" onClick={() => void starten()} disabled={!ergebnis} autoFocus>
              Noch eine Runde
            </button>
            <Link href={zurueck} className="btn btn-secondary ls-los">
              Fertig
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------
  const sichtbar = reihe.slice(pos, pos + 3);
  if (aktuell) fachRefs.current.length = aktuell.faecher.length;
  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
      {kopf}
      <div className="ls-feld">
        <p className="ls-auftrag">{SPIEL_AUFGABE[art]}</p>

        {/* der letzte richtige Satz, ganz: so bleibt beim Spielen hängen, wie es heißt */}
        <p className="mt-2 min-h-[28px] text-center text-[16px] text-ink-2" aria-live="polite">
          {zuletzt && (
            <span key={zuletzt.n} className="ls-zeile">
              <Loesung karte={zuletzt.karte} art={art} />
            </span>
          )}
        </p>

        <div className="ls-stapel">
          {sichtbar
            .map((e, i) => ({ e, i, idx: pos + i }))
            .reverse()
            .map(({ e, i, idx }) => (
              <div
                key={idx}
                ref={i === 0 ? karteRef : undefined}
                className="ls-karte"
                data-tiefe={i}
                data-stand={i === 0 && stand ? (stand.richtig ? "richtig" : "falsch") : undefined}
                onPointerDown={i === 0 ? onPointerDown : undefined}
                onPointerMove={i === 0 ? onPointerMove : undefined}
                onPointerUp={i === 0 ? onPointerUp : undefined}
                onPointerCancel={i === 0 ? onPointerUp : undefined}
                aria-hidden={i > 0 ? true : undefined}
              >
                <KartenInhalt karte={e.karte} art={art} stand={i === 0 ? stand : null} key={i === 0 ? `w${wackeln}` : "x"} />
              </div>
            ))}
        </div>

        <div className="min-h-[64px]">
          {stand && !stand.richtig && aktuell && (
            <p className="ls-regel" role="status">
              <Lightbulb size={18} aria-hidden />
              <span>{aktuell.regel}</span>
            </p>
          )}
        </div>

        {aktuell && (
          <div className="ls-faecher" role="group" aria-label="Fächer">
            {aktuell.faecher.map((f, i) => (
              <button
                key={f}
                ref={(el) => {
                  fachRefs.current[i] = el;
                }}
                type="button"
                className="ls-fach ohne-druck"
                data-a={art === "artikel" ? f : undefined}
                data-ziel={ziel === i ? "" : undefined}
                data-richtig={blitz === i ? "" : undefined}
                data-zeigen={stand && !stand.richtig && f === aktuell.richtig ? "" : undefined}
                data-falsch={falschGewaehlt.includes(f) ? "" : undefined}
                onClick={() => void waehle(f)}
                aria-keyshortcuts={String(i + 1)}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KartenInhalt({ karte, art, stand }: { karte: SpielKarte; art: SpielArt; stand: Stand }) {
  if (art === "artikel") {
    return (
      <>
        <p className="ls-wort">
          {stand && (
            <span className="ls-artikel" data-a={stand.richtig ? stand.wahl : undefined} style={stand.richtig ? undefined : { color: "var(--red)", textDecoration: "line-through" }}>
              {stand.wahl}
            </span>
          )}
          {karte.wort}
        </p>
        {karte.bedeutung && <p className="ls-bedeutung">({karte.bedeutung})</p>}
      </>
    );
  }
  const luecke = (
    <span className="ls-luecke" data-haengt={art === "deklination" ? "" : undefined} data-stand={stand ? (stand.richtig ? "richtig" : "falsch") : undefined}>
      {stand ? (art === "deklination" ? ohneStrich(stand.wahl) : stand.wahl) : art === "deklination" ? "…" : "\u00a0"}
    </span>
  );
  // eine Endung hängt am Wort: Wort und Lücke brechen nie auseinander
  const vor = karte.vor.trimEnd();
  const trenn = art === "deklination" ? vor.lastIndexOf(" ") + 1 : vor.length;
  return (
    <>
      <p className="ls-satz">
        {vor.slice(0, trenn)}
        {art === "deklination" ? (
          <span className="whitespace-nowrap">
            {vor.slice(trenn)}
            {luecke}
          </span>
        ) : (
          <>
            {" "}
            {luecke}
          </>
        )}
        {verbinder(art)}
        {karte.nach}
      </p>
      {stand?.richtig && karte.marke && <span className="ls-marke">{karte.marke}</span>}
    </>
  );
}

function Loesung({ karte, art }: { karte: SpielKarte; art: SpielArt }) {
  if (art === "artikel")
    return (
      <>
        <b data-a={karte.richtig} className="ls-artikel">
          {karte.richtig}
        </b>
        {karte.wort}
      </>
    );
  return (
    <>
      {karte.vor.trimEnd()}
      {art === "praepositionen" ? " " : ""}
      <b className="text-green">{ohneStrich(karte.richtig)}</b>
      {art === "praepositionen" ? " " : ""}
      {karte.nach}
      {karte.marke ? <span className="ml-2 inline-block rounded-full bg-panel px-2 py-0.5 align-middle text-[12px] font-semibold whitespace-nowrap text-ink-2">{karte.marke}</span> : null}
    </>
  );
}
