"use client";

import "./blockwerk.css";
import "./funkelfeld.css";
import { Footprints, Heart } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  einZug,
  fallen,
  FUNKEL_HERZEN,
  FUNKEL_PUNKTE,
  funkelZufall,
  funkeZuenden,
  hatZug,
  linien,
  mische,
  nachbarn,
  neuesFeld,
  platz,
  raeumeAb,
  REIHEN,
  reiheVon,
  SPALTEN,
  spalteVon,
  tausche,
  tauschWirkt,
  zugBonus,
  ZUEGE_START,
  type Feld,
  type Schritt,
  type Spezial,
  type Zaehler,
} from "@/lib/funkelfeld";
import { vibriere } from "./SpielTeile";
import { FORM_NAMEN, SteinBild } from "./FunkelSteine";

/**
 * Funkelfeld (lib/funkelfeld.ts, docs/lernspiele.md „Funkelfeld“): 7 × 7 leuchtende Steine. Zwei Nachbarn tauschen
 * (wischen oder nacheinander antippen); drei gleiche in einer Linie verschwinden, neue fallen nach. Sind die Züge weg,
 * fragt das Feld nach neuen (`onFrage`): Lernspiel.tsx zeigt eine Karte aus dem Stoff, mit `antwort` kommen die Züge.
 * Richtig beim ersten Versuch bringt mehr Züge und Punkte, falsch zwei Züge und ein Herz weniger; ohne Herzen ist das
 * Spiel aus (`onEnde`).
 *
 * Bewegung: jeder Stein hat eine feste id und gleitet mit transform an seinen neuen Platz; neue Steine fallen von oben
 * herein (CSS-Animation beim Einhängen), Abgeräumtes leuchtet kurz auf. Bei „weniger Bewegung“ springen sie.
 * Tasten am Laptop: Pfeile wandern, Leertaste wählt, mit gewähltem Stein tauscht ein Pfeil.
 */

/** Was die Frage über dem Feld zeigt: wie viele Züge es für richtig gibt und wie viele Herzen noch da sind. */
export type FunkelFrage = { brett: "funkel"; bonus: number; herzen: number };
export type FunkelAntwort = { n: number; sauber: boolean };

type Lage = "spiel" | "laeuft" | "frage" | "aus";
type Ansage = { n: number; text: string; art: "punkte" | "kette" | "zuege" | "info" };
type Glanz = { n: number; i: number; f: number; durch: string; v: number };
type Blitz = { n: number; i: number; sp: Spezial };

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Rand des Felds in px (wie in funkelfeld.css) */
const RAND = 6;

export function FunkelFeld({
  aktiv,
  antwort,
  onFrage,
  onPunkte,
  onEnde,
  rekord,
}: {
  /** false, solange die Frage über dem Feld liegt */
  aktiv: boolean;
  antwort: FunkelAntwort | null;
  onFrage: (f: FunkelFrage) => void;
  onPunkte: (punkte: number) => void;
  onEnde: () => void;
  /** der beste Stand bisher (0: noch keiner) */
  rekord: number;
}) {
  const rng = useRef<() => number>(funkelZufall(Date.now() % 2147483647));
  const zaehler = useRef<Zaehler>({ n: 0 });
  const [feld, setFeld] = useState<Feld>(() => neuesFeld({ rng: rng.current, zaehler: zaehler.current }));
  const [zuege, setZuege] = useState(ZUEGE_START);
  const [herzen, setHerzen] = useState(FUNKEL_HERZEN);
  const [punkte, setPunkte] = useState(0);
  const [lage, setLage] = useState<Lage>("spiel");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [glanz, setGlanz] = useState<Glanz[]>([]);
  const [blitze, setBlitze] = useState<Blitz[]>([]);
  const [ansage, setAnsage] = useState<Ansage[]>([]);
  const [wackelt, setWackelt] = useState<{ ids: number[]; n: number } | null>(null);
  const [tipp, setTipp] = useState<[number, number] | null>(null);

  const feldRef = useRef(feld);
  feldRef.current = feld;
  const zuegeRef = useRef(ZUEGE_START);
  const herzenRef = useRef(FUNKEL_HERZEN);
  const punkteRef = useRef(0);
  const fragen = useRef(0);
  const von = useRef(new Map<number, number>());
  const n = useRef(0);
  const reduziert = useRef(false);
  const brettRef = useRef<HTMLDivElement | null>(null);
  const zug = useRef<{ i: number; x: number; y: number; fertig: boolean; id: number } | null>(null);
  const antwortN = useRef(0);
  const wartet = useRef(false);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => onPunkte(punkte), [punkte, onPunkte]);

  const sage = useCallback((text: string, art: Ansage["art"]) => {
    const k = ++n.current;
    setAnsage((a) => [...a.slice(-2), { n: k, text, art }]);
    setTimeout(() => setAnsage((a) => a.filter((x) => x.n !== k)), 1300);
  }, []);
  const dazu = useCallback((p: number) => {
    if (p <= 0) return;
    punkteRef.current += p;
    setPunkte(punkteRef.current);
  }, []);
  const t = useCallback((ms: number) => warte(reduziert.current ? Math.min(ms, 60) : ms), []);

  /** Zeigt einen Schritt (Aufleuchten, Strahlen) und legt das Feld mit den Lücken hin. */
  const zeige = useCallback(
    (s: Schritt) => {
      const k = ++n.current;
      const mitte = s.weg.length ? s.weg.reduce((a, w) => a + reiheVon(w.i), 0) / s.weg.length : 3;
      setGlanz((g) => [...g, ...s.weg.map((w) => ({ n: k, i: w.i, f: w.f, durch: w.durch, v: w.durch === "linie" ? 0 : Math.round(Math.abs(reiheVon(w.i) - mitte) * 25) }))]);
      setBlitze((b) => [...b, ...s.ausgeloest.map((a) => ({ n: k, i: a.i, sp: a.sp }))]);
      setTimeout(() => {
        setGlanz((g) => g.filter((x) => x.n !== k));
        setBlitze((b) => b.filter((x) => x.n !== k));
      }, 520);
      setFeld(s.feld);
      dazu(s.punkte);
    },
    [dazu],
  );

  /** Füllt die Lücken: Steine fallen, neue kommen von oben. */
  const fuelle = useCallback(async (f: Feld) => {
    const fall = fallen(f, { rng: rng.current, zaehler: zaehler.current });
    for (const [id, v] of fall.von) von.current.set(id, v);
    setFeld(fall.feld);
    await t(270);
    for (const id of fall.von.keys()) von.current.delete(id);
    return fall.feld;
  }, [t]);

  /** Nach dem Zug: Fragen, wenn keine Züge mehr da sind. */
  const nachDemZug = useCallback(() => {
    if (zuegeRef.current > 0) {
      setLage("spiel");
      return;
    }
    setLage("frage");
    wartet.current = true;
    setTimeout(() => onFrage({ brett: "funkel", bonus: zugBonus(fragen.current, true), herzen: herzenRef.current }), reduziert.current ? 0 : 600);
  }, [onFrage]);

  const tauschen = useCallback(
    async (a: number, b: number) => {
      if (lage !== "spiel" || !aktiv || !nachbarn(a, b)) return;
      setGewaehlt(null);
      setTipp(null);
      const vorher = feldRef.current;
      if (!tauschWirkt(vorher, a, b)) {
        // geht nicht: hin und zurück, kein Zug weg
        setLage("laeuft");
        setFeld(tausche(vorher, a, b));
        await t(170);
        setFeld(vorher);
        setWackelt((w) => ({ ids: [vorher[a]!.id, vorher[b]!.id], n: (w?.n ?? 0) + 1 }));
        vibriere(18);
        await t(170);
        setLage("spiel");
        return;
      }
      setLage("laeuft");
      zuegeRef.current -= 1;
      setZuege(zuegeRef.current);
      let f = tausche(vorher, a, b);
      setFeld(f);
      await t(180);
      vibriere(12);
      // ein Funke: alle Steine einer Form
      const funke = f[a]?.sp === "funke" ? a : f[b]?.sp === "funke" ? b : null;
      if (funke !== null) {
        const s = funkeZuenden(f, funke, funke === a ? b : a, { zaehler: zaehler.current });
        zeige(s);
        sage(`+${s.punkte}`, "punkte");
        await t(320);
        f = await fuelle(s.feld);
      }
      let stufe = 1;
      while (linien(f).length && stufe < 40) {
        const s = raeumeAb(f, { bei: stufe === 1 ? [a, b] : undefined, stufe, zaehler: zaehler.current });
        zeige(s);
        if (stufe >= 2) sage(stufe === 2 ? "Kette!" : `Kette ×${stufe}!`, "kette");
        if (s.neu.some((x) => x.sp === "funke")) sage("Funke!", "info");
        else if (s.neu.length) sage("Strahl!", "info");
        await t(s.ausgeloest.length ? 300 : 220);
        f = await fuelle(s.feld);
        stufe++;
      }
      if (stufe >= 3) vibriere([12, 30, 12]);
      if (!hatZug(f)) {
        await t(200);
        f = mische(f, rng.current);
        setFeld(f);
        sage("Neu gemischt", "info");
        await t(320);
      }
      nachDemZug();
    },
    [lage, aktiv, t, zeige, sage, fuelle, nachDemZug],
  );

  // die Antwort auf eine Frage: neue Züge (oder ohne Herzen das Ende)
  useEffect(() => {
    if (!antwort || antwort.n === antwortN.current || !wartet.current) return;
    antwortN.current = antwort.n;
    wartet.current = false;
    const bonus = zugBonus(fragen.current, antwort.sauber);
    fragen.current += 1;
    if (antwort.sauber) {
      dazu(FUNKEL_PUNKTE.frage);
      setTimeout(() => sage(`+${bonus} Züge`, "zuege"), 260);
    } else {
      herzenRef.current = Math.max(0, herzenRef.current - 1);
      setHerzen(herzenRef.current);
      if (herzenRef.current <= 0) {
        setLage("aus");
        setTimeout(onEnde, reduziert.current ? 300 : 1400);
        return;
      }
      setTimeout(() => sage(`+${bonus} Züge`, "zuege"), 260);
    }
    zuegeRef.current += bonus;
    setZuege(zuegeRef.current);
    setLage("spiel");
  }, [antwort, dazu, sage, onEnde]);

  // lange nichts gefunden: zwei Steine, die gehen, leuchten leicht
  useEffect(() => {
    if (lage !== "spiel" || !aktiv) return;
    const h = setTimeout(() => setTipp(einZug(feldRef.current)), 8000);
    return () => clearTimeout(h);
  }, [lage, aktiv, feld]);

  // ---------- Eingabe: wischen oder zweimal tippen ----------

  const platzBei = useCallback((x: number, y: number) => {
    const el = brettRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const schritt = (r.width - 2 * RAND) / SPALTEN;
    const s = Math.floor((x - r.left - RAND) / schritt);
    const z = Math.floor((y - r.top - RAND) / schritt);
    if (s < 0 || s >= SPALTEN || z < 0 || z >= REIHEN) return null;
    return { i: platz(z, s), schritt };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (lage !== "spiel" || !aktiv || zug.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const p = platzBei(e.clientX, e.clientY);
    if (!p) return;
    zug.current = { i: p.i, x: e.clientX, y: e.clientY, fertig: false, id: e.pointerId };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ohne Capture geht es auch
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const z = zug.current;
    if (!z || z.fertig || z.id !== e.pointerId) return;
    const p = platzBei(z.x, z.y);
    const schritt = p?.schritt ?? 40;
    const dx = e.clientX - z.x;
    const dy = e.clientY - z.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < schritt * 0.38) return;
    z.fertig = true;
    const r = reiheVon(z.i);
    const s = spalteVon(z.i);
    const ziel = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (s < SPALTEN - 1 ? z.i + 1 : -1) : s > 0 ? z.i - 1 : -1) : dy > 0 ? (r < REIHEN - 1 ? z.i + SPALTEN : -1) : r > 0 ? z.i - SPALTEN : -1;
    if (ziel >= 0) void tauschen(z.i, ziel);
  };
  const onUp = (e: React.PointerEvent) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    zug.current = null;
    if (z.fertig) return;
    // getippt: wählen, abwählen oder mit dem gewählten tauschen
    const i = z.i;
    setCursor(null);
    if (gewaehlt === null) setGewaehlt(i);
    else if (gewaehlt === i) setGewaehlt(null);
    else if (nachbarn(gewaehlt, i)) void tauschen(gewaehlt, i);
    else setGewaehlt(i);
  };

  // Tasten am Laptop
  useEffect(() => {
    if (!aktiv || lage === "aus") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const pfeil = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (pfeil) {
        e.preventDefault();
        const von_ = gewaehlt ?? cursor ?? platz(3, 3);
        const r = reiheVon(von_) + pfeil[0];
        const s = spalteVon(von_) + pfeil[1];
        if (r < 0 || r >= REIHEN || s < 0 || s >= SPALTEN) return;
        if (gewaehlt !== null) void tauschen(gewaehlt, platz(r, s));
        else setCursor(platz(r, s));
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const c = cursor ?? platz(3, 3);
        setCursor(c);
        setGewaehlt((g) => (g === c ? null : c));
      } else if (e.key === "Escape") setGewaehlt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktiv, lage, gewaehlt, cursor, tauschen]);

  // ---------- Darstellung ----------

  const steine = useMemo(() => feld.flatMap((st, i) => (st ? [{ st, i }] : [])).sort((a, b) => a.st.id - b.st.id), [feld]);
  const hinweis =
    lage === "aus"
      ? "Keine Herzen mehr."
      : lage === "frage"
        ? "Keine Züge mehr: eine Frage bringt neue."
        : punkte === 0 && zuege === ZUEGE_START
          ? "Wisch einen Stein zum Nachbarn: drei gleiche in einer Linie verschwinden."
          : zuege <= 2
            ? zuege === 1
              ? "Noch ein Zug, dann kommt eine Frage."
              : "Noch zwei Züge, dann kommt eine Frage."
            : "";

  return (
    <div className="ff" data-aktiv={aktiv ? "" : undefined} hidden={!aktiv} data-lage={lage}>
      <div className="ff-stand">
        <div className="ff-herzen" role="img" aria-label={`${herzen} von ${FUNKEL_HERZEN} Herzen`} data-testid="ff-herzen">
          {Array.from({ length: FUNKEL_HERZEN }, (_, i) => (
            <Heart key={i} size={20} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
          ))}
        </div>
        <div className="ff-punkte" aria-live="polite" aria-label={`${punkte} Punkte`} data-testid="ff-punkte">
          <b key={punkte} data-neu={punkte ? "" : undefined}>
            {punkte.toLocaleString("de-AT")}
          </b>
          <small>{rekord > 0 ? (punkte > rekord ? "Neuer Rekord!" : `Rekord ${rekord.toLocaleString("de-AT")}`) : "Punkte"}</small>
        </div>
        <div className="ff-zuege" data-wenig={zuege <= 2 ? "" : undefined} aria-label={`${zuege} ${zuege === 1 ? "Zug" : "Züge"} übrig`} data-testid="ff-zuege">
          <Footprints size={18} strokeWidth={2.4} aria-hidden />
          <b key={zuege}>{zuege}</b>
        </div>
      </div>

      <div className="ff-mitte">
        <div
          ref={brettRef}
          className="ff-brett"
          role="grid"
          aria-label={`Spielfeld, ${SPALTEN} mal ${REIHEN} Steine. ${zuege} Züge übrig.`}
          data-testid="ff-brett"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (zug.current = null)}
        >
          {Array.from({ length: REIHEN * SPALTEN }, (_, i) => (
            <i key={`f${i}`} className="ff-platz" style={{ "--r": reiheVon(i), "--s": spalteVon(i) } as CSSProperties} aria-hidden />
          ))}
          {steine.map(({ st, i }) => {
            const v = von.current.get(st.id);
            return (
              <span
                key={st.id}
                className="ff-stein"
                data-f={st.f}
                data-sp={st.sp}
                data-neu={v ? "" : undefined}
                data-gewaehlt={gewaehlt === i ? "" : undefined}
                data-cursor={cursor === i ? "" : undefined}
                data-tipp={tipp && (tipp[0] === i || tipp[1] === i) ? "" : undefined}
                data-wackelt={wackelt?.ids.includes(st.id) ? wackelt.n % 2 : undefined}
                data-testid={`ff-stein-${i}`}
                data-platz={i}
                style={{ "--r": reiheVon(i), "--s": spalteVon(i), "--von": v ?? 0 } as CSSProperties}
                aria-label={`${st.sp === "funke" ? "Funke" : FORM_NAMEN[st.f]}${st.sp === "reihe" ? ", Strahl waagrecht" : st.sp === "spalte" ? ", Strahl senkrecht" : ""}`}
              >
                <SteinBild f={st.f} sp={st.sp} />
              </span>
            );
          })}
          {glanz.map((g) => (
            <span key={`g${g.n}-${g.i}`} className="ff-glanz" data-f={g.f} data-durch={g.durch} style={{ "--r": reiheVon(g.i), "--s": spalteVon(g.i), "--v": `${g.v}ms` } as CSSProperties} aria-hidden>
              <SteinBild f={g.f} />
            </span>
          ))}
          {blitze.map((b) => (
            <span key={`b${b.n}-${b.i}`} className="ff-strahl" data-sp={b.sp} style={{ "--r": reiheVon(b.i), "--s": spalteVon(b.i) } as CSSProperties} aria-hidden />
          ))}
          {ansage.map((a) => (
            <p key={a.n} className="ff-ansage" data-art={a.art} aria-hidden>
              {a.text}
            </p>
          ))}
        </div>
        <p className="ff-hinweis" role="status">
          {hinweis}
        </p>
      </div>
    </div>
  );
}

/** Über der Karte, solange eine Frage offen ist: wofür sie ist. */
export function FunkelKopf({ frage }: { frage: FunkelFrage }) {
  return (
    <div className="bw-frage-kopf ff-frage-kopf" data-testid="ff-frage">
      <span className="ff-frage-bild" aria-hidden>
        <Footprints size={22} strokeWidth={2.4} />
        <b>+{frage.bonus}</b>
      </span>
      <span className="bw-frage-text">
        <b>Antworte für neue Züge</b>
        <small>
          Richtig beim 1. Versuch: +{frage.bonus} Züge und +{FUNKEL_PUNKTE.frage}. Falsch: +2 Züge, ein{" "}
          <Heart size={12} strokeWidth={2.6} fill="currentColor" aria-label="Herz" /> weg.
        </small>
      </span>
    </div>
  );
}
