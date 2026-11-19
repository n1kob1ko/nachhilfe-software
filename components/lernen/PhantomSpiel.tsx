"use client";

import "./lernspiel.css";
import "./blockwerk.css";
import "./glasklar.css";
import "./phantombild.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, Flame, Heart, Lightbulb, ScrollText, Search, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { phantomStartenAction, spielBeendenAction, tabletPhantomStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import type { Bestenliste, SpielErgebnis, SpielKarte, SpielStart } from "@/lib/lernspiele-typen";
import { istLeer, MERKEN_AB, merkmalPunkte, merkmalVonKey, NUR_BILD_AB, PHANTOM_HERZEN, PHANTOM_PUNKTE, vorgezeichnet, wertWort, type Bau, type Merkmal, type PhantomDaten, type Teil } from "@/lib/phantombild";
import { anteilFuer, VORLAGE_GESCHAFFT, VORLAGE_STUFEN, type VorlageDaten } from "@/lib/phantom-vorlage";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { BestenListe, Hintergrund, Konfetti } from "./Lernspiel";
import { PhantomGesicht } from "./PhantomGesicht";
import { vibriere } from "./SpielTeile";

/**
 * Phantombild (lib/phantombild.ts, docs/lernspiele.md „Phantombild“), zwei Teile:
 *
 * „Fall lösen“: oben die Zeugenaussage, darunter das Phantombild und die Antworten zum Merkmal, das gerade dran ist, in
 * der Reihenfolge des Aufbaus (Einleitung, Hauptteil, Schluss). Ein Tipp zählt sofort. Richtig: das Teil springt ins
 * Bild. Falsch: ein Herz weg und ein Blatt mit dem Satz aus der Aussage. Ein Fall ist eine Stufe (eine Runde am Server);
 * ab Stufe `MERKEN_AB` verschwindet die Aussage nach dem Lesen („Nochmal lesen“ halbiert die Punkte bis zum Ende des Falls).
 *
 * „Text lernen“ (lib/phantom-vorlage.ts): die Vorlage mit Lücken neben einem Phantombild. Erst nur die Merkmale, mit
 * jeder Stufe fehlen mehr Wörter der Vorlage selbst. Ohne Herzen: ein Fehler zeigt das richtige Wort und es geht weiter.
 */

type Phase = "start" | "laden" | "spiel" | "ende";
type TeilArt = "fall" | "text";
type Fall = { rundeId: number; nr: number; karten: SpielKarte[]; daten: PhantomDaten };
type Text = { rundeId: number; nr: number; karten: SpielKarte[]; daten: VorlageDaten };

const zahl = (n: number) => n.toLocaleString("de-AT");
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const TEILE: Teil[] = ["Einleitung", "Hauptteil", "Schluss"];
const DEKO = ["oval", "blond", "Brille", "lockig"];

export function PhantomSpiel({
  token,
  amTablet,
  teil: teilAnfang,
  serie: serieAnfang,
  rekord,
  bestenliste: bestenlisteAnfang,
  geschafft: geschafftAnfang,
  grund,
  zurueck: zurueckZiel,
  arenaLink,
}: {
  token: string;
  amTablet?: boolean;
  teil?: TeilArt;
  serie: number;
  /** der beste Phantombild-Stand des Schülers (0: noch keiner) */
  rekord: number;
  bestenliste?: Bestenliste;
  /** die höchste geschaffte Stufe von „Text lernen“ (0: noch keine) */
  geschafft: number;
  /** warum es gerade passt („Deutsch-Schularbeit in 5 Tagen“) */
  grund?: string;
  zurueck?: string;
  arenaLink?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (teil: TeilArt, lauf?: number, stufe?: number) => (amTablet ? tabletPhantomStartenAction(teil, lauf, stufe) : phantomStartenAction(token, teil, lauf, stufe)),
      beenden: (id: number, antworten: { key: string; wahl: string }[], o?: { teil?: boolean; punkte?: number }) => (amTablet ? tabletSpielBeendenAction(id, antworten, o) : spielBeendenAction(token, id, antworten, o)),
    }),
    [amTablet, token],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;

  const [teil, setTeil] = useState<TeilArt>(teilAnfang ?? "fall");
  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [geschafft, setGeschafft] = useState(geschafftAnfang);
  const [textStufe, setTextStufe] = useState(Math.min(VORLAGE_STUFEN, geschafftAnfang + 1));

  // ---------- Fall lösen ----------
  const [fall, setFall] = useState<Fall | null>(null);
  const [pos, setPos] = useState(0);
  const [bau, setBau] = useState<Bau>({});
  const [herzen, setHerzen] = useState(PHANTOM_HERZEN);
  const [punkte, setPunkte] = useState(0);
  const [verdeckt, setVerdeckt] = useState(false);
  const [nachgelesen, setNachgelesen] = useState(false);
  const [falschWahl, setFalschWahl] = useState<string | null>(null);
  const [richtigWahl, setRichtigWahl] = useState<string | null>(null);
  const [blatt, setBlatt] = useState<SpielKarte | null>(null);
  const [plus, setPlus] = useState<{ n: number; id: number } | null>(null);
  const [gefasst, setGefasst] = useState<{ nr: number; bonus: number; herz: boolean } | null>(null);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);

  // ---------- Text lernen ----------
  const [text, setText] = useState<Text | null>(null);
  const [luecke, setLuecke] = useState(0);
  const [gefuellt, setGefuellt] = useState<Record<number, "ja" | "nein">>({});
  const [textEnde, setTextEnde] = useState<{ richtig: number; anzahl: number } | null>(null);
  const [ganzerText, setGanzerText] = useState(false);

  const punkteRef = useRef(0);
  const herzenRef = useRef(PHANTOM_HERZEN);
  const antworten = useRef(new Map<string, string>());
  const fehlerImFall = useRef(false);
  const lauf = useRef<number | null>(null);
  const vorrat = useRef<Promise<SpielStart> | null>(null);
  const abschluss = useRef<Promise<SpielErgebnis> | null>(null);
  const laufVorher = useRef<number | null | undefined>(undefined);
  const beschaeftigt = useRef(false);
  const reduziert = useRef(false);
  const aktiveLuecke = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTon(tonAn());
    const ab = aufTon(setTon);
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      ab();
      document.body.style.overflow = alt;
    };
  }, []);

  const spiele = useCallback((f: (k: typeof klang) => void) => {
    if (tonAn()) f(klang);
  }, []);

  const karte = fall?.karten[pos] ?? null;
  const merkmalJetzt = karte ? merkmalVonKey(karte.key) : null;
  const ausDemKopf = !!fall && fall.nr >= MERKEN_AB && !nachgelesen;

  const richteFallEin = useCallback((r: Extract<SpielStart, { rundeId: number }>) => {
    const daten = r.karten[0]?.phantom;
    if (!daten) return false;
    antworten.current = new Map();
    fehlerImFall.current = false;
    setFall({ rundeId: r.rundeId, nr: r.stufe ?? 1, karten: r.karten, daten });
    setPos(0);
    setBau(vorgezeichnet(daten.fall, daten.stufe));
    setVerdeckt(false);
    setNachgelesen(false);
    setFalschWahl(null);
    setRichtigWahl(null);
    setBlatt(null);
    setGefasst(null);
    return true;
  }, []);

  const richteTextEin = useCallback((r: Extract<SpielStart, { rundeId: number }>) => {
    const daten = r.karten[0]?.vorlage;
    if (!daten) return false;
    antworten.current = new Map();
    setText({ rundeId: r.rundeId, nr: daten.stufe, karten: r.karten, daten });
    setLuecke(0);
    setGefuellt({});
    setFalschWahl(null);
    setRichtigWahl(null);
    setTextEnde(null);
    setGanzerText(false);
    return true;
  }, []);

  const starten = useCallback(
    async (welcher: TeilArt, stufe?: number) => {
      setTeil(welcher);
      setPhase("laden");
      setFehler(null);
      const r = await server.starten(welcher, undefined, stufe);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setPhase("start");
        return;
      }
      lauf.current = r.endlos ?? r.rundeId;
      vorrat.current = null;
      abschluss.current = null;
      laufVorher.current = undefined;
      punkteRef.current = 0;
      herzenRef.current = PHANTOM_HERZEN;
      beschaeftigt.current = false;
      setPunkte(0);
      setHerzen(PHANTOM_HERZEN);
      setDaneben([]);
      setErgebnis(null);
      const ok = welcher === "fall" ? richteFallEin(r) : richteTextEin(r);
      if (!ok) {
        setFehler("Das Spiel konnte nicht geladen werden.");
        setPhase("start");
        return;
      }
      setPhase("spiel");
    },
    [server, richteFallEin, richteTextEin],
  );

  const antwortListe = useCallback(() => [...antworten.current.entries()].map(([key, wahl]) => ({ key, wahl })), []);

  const dazu = useCallback((p: number) => {
    punkteRef.current += p;
    setPunkte(punkteRef.current);
    setPlus({ n: p, id: Date.now() });
  }, []);

  // ---------- Fall: Ende und nächster Fall ----------

  const ende = useCallback(async () => {
    if (!fall) return;
    setPhase("ende");
    const davor = await abschluss.current?.catch(() => null);
    let e = await server.beenden(fall.rundeId, antwortListe(), { teil: true, punkte: punkteRef.current });
    const vorherStand = laufVorher.current !== undefined ? laufVorher.current : davor && !("fehler" in davor) ? davor.lernstandVorher : undefined;
    if (!("fehler" in e) && vorherStand !== undefined) e = { ...e, lernstandVorher: vorherStand };
    setErgebnis(e);
    spiele((k) => k.aus());
    router.refresh();
  }, [fall, antwortListe, server, router, spiele]);

  const naechsterFall = useCallback(async () => {
    if (!fall || beschaeftigt.current) return;
    beschaeftigt.current = true;
    const id = fall.rundeId;
    const liste = antwortListe();
    const fertig = server.beenden(id, liste);
    abschluss.current = fertig;
    void fertig.then((e) => {
      if (laufVorher.current === undefined && !("fehler" in e)) laufVorher.current = e.lernstandVorher;
    });
    const r = await (vorrat.current ?? server.starten("fall", lauf.current ?? undefined));
    vorrat.current = null;
    beschaeftigt.current = false;
    if ("fehler" in r || !richteFallEin(r)) {
      setPhase("ende");
      await fertig;
      const e = await server.beenden(id, liste, { teil: true, punkte: punkteRef.current });
      setErgebnis(!("fehler" in e) && laufVorher.current !== undefined ? { ...e, lernstandVorher: laufVorher.current } : e);
      router.refresh();
    }
  }, [fall, antwortListe, server, richteFallEin, router]);

  /** Das Merkmal ist eingezeichnet: das nächste, oder der Fall ist gelöst. */
  const weiterMerkmal = useCallback(() => {
    if (!fall) return;
    setBlatt(null);
    setFalschWahl(null);
    setRichtigWahl(null);
    if (herzenRef.current <= 0) {
      void ende();
      return;
    }
    if (pos + 1 < fall.karten.length) {
      setPos(pos + 1);
      if (pos + 3 >= fall.karten.length && !vorrat.current && lauf.current) vorrat.current = server.starten("fall", lauf.current);
      return;
    }
    const bonus = fehlerImFall.current ? 0 : PHANTOM_PUNKTE.fall * fall.nr;
    if (bonus) dazu(bonus);
    const herz = !fehlerImFall.current && herzenRef.current < PHANTOM_HERZEN;
    if (herz) {
      herzenRef.current += 1;
      setHerzen(herzenRef.current);
    }
    spiele((k) => k.frei());
    vibriere([14, 50, 20, 50, 30]);
    setGefasst({ nr: fall.nr, bonus, herz });
  }, [fall, pos, ende, dazu, server, spiele]);

  useEffect(() => {
    if (!gefasst) return;
    const t = window.setTimeout(() => void naechsterFall(), reduziert.current ? 1400 : 2300);
    return () => window.clearTimeout(t);
  }, [gefasst, naechsterFall]);

  useEffect(() => {
    if (!richtigWahl || teil !== "fall") return;
    const t = window.setTimeout(weiterMerkmal, reduziert.current ? 250 : 520);
    return () => window.clearTimeout(t);
  }, [richtigWahl, teil, weiterMerkmal]);

  const waehleMerkmal = useCallback(
    (wahl: string) => {
      if (!fall || !karte || !merkmalJetzt || richtigWahl || blatt || gefasst) return;
      const erste = !antworten.current.has(karte.key);
      if (erste) antworten.current.set(karte.key, wahl);
      if (wahl === karte.richtig) {
        setBau((b) => ({ ...b, [merkmalJetzt]: wahl }));
        setRichtigWahl(wahl);
        if (erste) dazu(merkmalPunkte(fall.nr, ausDemKopf));
        spiele((k) => k.richtig(erste));
        vibriere(12);
        return;
      }
      fehlerImFall.current = true;
      setFalschWahl(wahl);
      herzenRef.current = Math.max(0, herzenRef.current - 1);
      setHerzen(herzenRef.current);
      setDaneben((d) => (d.some((x) => x.key === karte.key) ? d : [...d, karte]));
      spiele((k) => k.falsch());
      vibriere([40, 60, 40]);
      window.setTimeout(() => {
        setBau((b) => ({ ...b, [merkmalJetzt]: karte.richtig }));
        setBlatt(karte);
      }, reduziert.current ? 0 : 380);
    },
    [fall, karte, merkmalJetzt, richtigWahl, blatt, gefasst, ausDemKopf, dazu, spiele],
  );

  // ---------- Text lernen ----------

  const textKarte = text?.karten[luecke] ?? null;

  const textFertig = useCallback(async () => {
    if (!text) return;
    const liste = antwortListe();
    const richtig = text.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    setTextEnde({ richtig, anzahl: text.karten.length });
    if (richtig / Math.max(1, text.karten.length) >= VORLAGE_GESCHAFFT) {
      setGeschafft((g) => Math.max(g, text.nr));
      setTextStufe(Math.min(VORLAGE_STUFEN, text.nr + 1));
      spiele((k) => k.frei());
    } else spiele((k) => k.aus());
    const e = await server.beenden(text.rundeId, liste);
    setErgebnis(e);
    router.refresh();
  }, [text, antwortListe, server, router, spiele]);

  useEffect(() => {
    if (!richtigWahl || teil !== "text" || !text) return;
    const t = window.setTimeout(
      () => {
        setRichtigWahl(null);
        setFalschWahl(null);
        if (luecke + 1 >= text.karten.length) void textFertig();
        else setLuecke(luecke + 1);
      },
      falschWahl ? (reduziert.current ? 700 : 1100) : reduziert.current ? 120 : 260,
    );
    return () => window.clearTimeout(t);
  }, [richtigWahl, falschWahl, teil, text, luecke, textFertig]);

  const waehleWort = useCallback(
    (wahl: string) => {
      if (!text || !textKarte || richtigWahl) return;
      const erste = !antworten.current.has(textKarte.key);
      if (erste) antworten.current.set(textKarte.key, wahl);
      if (wahl === textKarte.richtig) {
        setGefuellt((g) => ({ ...g, [luecke]: g[luecke] ?? "ja" }));
        setRichtigWahl(wahl);
        spiele((k) => k.setzen());
        vibriere(8);
        return;
      }
      // falsch: das richtige Wort steht rot in der Lücke, dann geht es weiter
      setGefuellt((g) => ({ ...g, [luecke]: "nein" }));
      setFalschWahl(wahl);
      setRichtigWahl(textKarte.richtig);
      spiele((k) => k.falsch());
      vibriere([30, 50, 30]);
    },
    [text, textKarte, richtigWahl, luecke, spiele],
  );

  useEffect(() => {
    aktiveLuecke.current?.scrollIntoView({ block: "center", behavior: reduziert.current ? "auto" : "smooth" });
  }, [luecke, text]);

  // ---------- Kopf ----------

  const kopf = (
    <div className="ls-kopf">
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" && teil === "fall" && fall ? (
        <>
          <div className="ls-herzen" role="img" aria-label={`${herzen} von ${PHANTOM_HERZEN} Herzen`} data-testid="pb-herzen">
            {Array.from({ length: PHANTOM_HERZEN }, (_, i) => (
              <Heart key={i} size={24} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
            ))}
          </div>
          <span className="gk-stufe" data-testid="pb-stufe">
            Fall {fall.nr}
          </span>
          <span className="ls-combo ls-endlos-stand pb-punkte-kopf" aria-label={`${punkte} Punkte`} data-testid="pb-punkte">
            <b key={punkte} data-neu="">
              {zahl(punkte)}
            </b>
            {plus && (
              <i key={plus.id} className="pb-plus" aria-hidden>
                +{zahl(plus.n)}
              </i>
            )}
          </span>
        </>
      ) : phase === "spiel" && teil === "text" && text ? (
        <>
          <span className="gk-stufe" data-testid="pb-stufe">
            Stufe {text.nr} von {VORLAGE_STUFEN}
          </span>
          <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={text.karten.length} aria-valuenow={luecke} aria-label="Lücken">
            <i style={{ width: `${Math.round((luecke / Math.max(1, text.karten.length)) * 100)}%` }} />
          </span>
        </>
      ) : (
        <span className="flex-1" />
      )}
      <button type="button" className="ls-zu treffer" onClick={() => setzeTon(!ton)} aria-pressed={!ton} aria-label={ton ? "Töne ausschalten" : "Töne einschalten"}>
        {ton ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}
      </button>
    </div>
  );

  // ---------- Start ----------

  if (phase === "start" || phase === "laden") {
    return (
      <div className="ls pb" role="dialog" aria-modal="true" aria-label="Lernspiel Phantombild">
        <Hintergrund woerter={DEKO} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel · Personenbeschreibung
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            Phantombild
          </h1>
          <div className="pb-start-bild" style={{ "--n": 2 } as CSSProperties} aria-hidden>
            <span className="pb-stempel">Gesucht</span>
            <PhantomGesicht bau={START_BAU} className="pb-start-svg" />
          </div>
          {grund && (
            <span className="ls-grund mt-1" style={{ "--n": 2 } as CSSProperties} data-testid="pb-grund">
              <BookOpen size={16} aria-hidden />
              {grund}
            </span>
          )}
          <div className="pb-wahl mt-4" style={{ "--n": 3 } as CSSProperties}>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("fall")} disabled={phase === "laden"} data-testid="pb-start-fall" autoFocus={teil === "fall"}>
              <Search size={26} aria-hidden />
              <span>
                <b>Fall lösen</b>
                <small>Lies die Zeugenaussage und bau die Person zusammen.</small>
              </span>
            </button>
            <div className="pb-wahl-knopf pb-wahl-text" data-testid="pb-text-wahl">
              <ScrollText size={26} aria-hidden />
              <span className="min-w-0 flex-1">
                <b>Text lernen</b>
                <small>Deine Personenbeschreibung auswendig: erst nur die Merkmale, dann fehlt immer mehr.</small>
                <span className="pb-stufen" role="group" aria-label="Stufe">
                  {Array.from({ length: VORLAGE_STUFEN }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="pb-stufe-knopf"
                      aria-pressed={textStufe === n}
                      disabled={n > geschafft + 1}
                      onClick={() => setTextStufe(n)}
                      data-geschafft={n <= geschafft ? "" : undefined}
                      data-testid={`pb-stufe-${n}`}
                      aria-label={`Stufe ${n}${n <= geschafft ? ", geschafft" : n > geschafft + 1 ? ", noch gesperrt" : ""}`}
                    >
                      {n}
                    </button>
                  ))}
                </span>
                <small className="pb-stufe-text">{stufenText(textStufe)}</small>
                <button type="button" className="ls-knopf ls-los pb-text-los" onClick={() => void starten("text", textStufe)} disabled={phase === "laden"} data-testid="pb-start-text" autoFocus={teil === "text"}>
                  {phase === "laden" && teil === "text" ? "Der Text kommt …" : `Stufe ${textStufe} lernen`}
                </button>
              </span>
            </div>
          </div>
          <div className="ls-glas mt-4 grid grid-cols-2 gap-4 p-4" style={{ "--n": 4 } as CSSProperties}>
            <div>
              <p className="ls-klein">Rekord</p>
              <p className="text-[22px] font-semibold tabular-nums">{rekord > 0 ? zahl(rekord) : "Noch keiner"}</p>
            </div>
            <div>
              <p className="ls-klein">Serie</p>
              <p className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums">
                <Flame size={20} className={serieAnfang > 0 ? "ls-flamme" : "opacity-60"} fill={serieAnfang > 0 ? "currentColor" : "none"} aria-hidden />
                {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
              </p>
            </div>
          </div>
          {bestenlisteAnfang && <BestenListe liste={bestenlisteAnfang} arenaLink={arenaLink} n={5} />}
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
          {phase === "laden" && teil === "fall" && <p className="ls-klein mt-4 text-center">Die Zeugin erzählt …</p>}
        </div>
      </div>
    );
  }

  // ---------- Ende ----------

  if (phase === "ende") {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const stand = punkteRef.current;
    const bisher = e?.phantom?.rekord ?? rekord;
    const neuerRekord = !!e && stand > 0 && stand > bisher;
    const anteil = bisher > 0 ? Math.min(100, Math.round((stand / bisher) * 100)) : stand > 0 ? 100 : 0;
    return (
      <div className="ls pb" role="dialog" aria-modal="true" aria-label="Phantombild vorbei">
        <Hintergrund woerter={DEKO} />
        {neuerRekord && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="pb-ende">
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - anteil } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl" data-lang={Math.min(9, Math.max(3, zahl(stand).length))}>
              <b>{zahl(stand)}</b>
              <span>Punkte</span>
            </div>
          </div>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
            {neuerRekord && <Trophy size={26} strokeWidth={2.4} aria-hidden />}
            {neuerRekord ? "Neuer Rekord!" : "Keine Herzen mehr"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            {(fall?.nr ?? 1) - 1 === 1 ? "1 Fall gelöst" : `${Math.max(0, (fall?.nr ?? 1) - 1)} Fälle gelöst`} · {e?.phantom?.merkmale ?? "…"} Merkmale auf Anhieb
            {!neuerRekord && bisher > 0 ? ` · Rekord ${zahl(bisher)}` : ""}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          <div className="bw-ende-stand ls-glas" style={{ "--n": 2 } as CSSProperties}>
            <span className="min-w-0 truncate">
              <span className="opacity-75">Personenbeschreibung</span>{" "}
              <b className="tabular-nums">{e ? (e.lernstandVorher === null || pct(e.lernstandVorher) === pct(e.lernstandNachher) ? pct(e.lernstandNachher) : `${pct(e.lernstandVorher)} → ${pct(e.lernstandNachher)}`) : "…"}</b>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Flame size={16} className="ls-flamme" fill="currentColor" aria-hidden />
              <b className="tabular-nums">{e ? (e.serie === 1 ? "1 Tag" : `${e.serie} Tage`) : "…"}</b>
            </span>
          </div>
          {(e?.phantom?.bestenliste ?? bestenlisteAnfang) && <BestenListe liste={(e?.phantom?.bestenliste ?? bestenlisteAnfang)!} arenaLink={arenaLink} n={3} />}
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
              <p className="text-[15px] font-semibold">Darauf achtest du nächstes Mal</p>
              <ul className="mt-2 space-y-1.5 text-[16px]">
                {daneben.slice(0, 5).map((k) => (
                  <li key={k.key}>{k.loesung}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 5 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten("fall")} disabled={!ergebnis} autoFocus data-testid="pb-nochmal">
              Neuer Fall
            </button>
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("start")}>
              Text lernen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Text lernen ----------

  if (teil === "text") {
    if (!text) return null;
    if (textEnde) {
      const anteil = textEnde.anzahl ? textEnde.richtig / textEnde.anzahl : 0;
      const ok = anteil >= VORLAGE_GESCHAFFT;
      return (
        <div className="ls pb" role="dialog" aria-modal="true" aria-label="Text lernen geschafft">
          <Hintergrund woerter={DEKO} />
          {ok && <Konfetti />}
          {kopf}
          <div className="ls-mitte ls-rollt ls-staffel text-center">
            <p className="pb-text-ergebnis" style={{ "--n": 0 } as CSSProperties} data-testid="pb-text-ende">
              {Math.round(anteil * 100)} %
            </p>
            <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
              {ok ? (text.nr >= VORLAGE_STUFEN ? "Auswendig gelernt!" : `Stufe ${text.nr} geschafft!`) : "Noch einmal üben"}
            </h1>
            <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
              {textEnde.richtig} von {textEnde.anzahl} Lücken auf Anhieb richtig.{" "}
              {ok ? (text.nr < VORLAGE_STUFEN ? `Jetzt fehlen mehr Wörter.` : "Du kannst den ganzen Text.") : `Ab ${Math.round(VORLAGE_GESCHAFFT * 100)} % geht es zur nächsten Stufe.`}
            </p>
            <button type="button" className="pb-ganz mt-4" onClick={() => setGanzerText((g) => !g)} aria-expanded={ganzerText} style={{ "--n": 2 } as CSSProperties}>
              <Eye size={18} aria-hidden /> {ganzerText ? "Text ausblenden" : "Ganzen Text lesen"}
            </button>
            {ganzerText && (
              <div className="ls-blatt pb-loesung mt-3 p-4 text-left" data-testid="pb-loesung">
                {text.daten.loesung.split("\n\n").map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
              </div>
            )}
            <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 3 } as CSSProperties}>
              {ok && text.nr < VORLAGE_STUFEN ? (
                <button type="button" className="ls-knopf ls-los" onClick={() => void starten("text", text.nr + 1)} disabled={!ergebnis} autoFocus data-testid="pb-text-weiter">
                  Stufe {text.nr + 1}
                </button>
              ) : null}
              <button type="button" className="ls-knopf ls-los" data-zweit={ok && text.nr < VORLAGE_STUFEN ? "" : undefined} onClick={() => void starten("text", text.nr)} disabled={!ergebnis} data-testid="pb-text-nochmal">
                Stufe {text.nr} nochmal
              </button>
              <ZuLink href={zurueck} className="ls-knopf ls-los" data-zweit="">
                Fertig
              </ZuLink>
            </div>
          </div>
        </div>
      );
    }
    const person = text.daten.fall;
    return (
      <div className="ls pb" role="dialog" aria-modal="true" aria-label="Text lernen">
        {kopf}
        <div className="pb-text">
          <div className="pb-text-kopf">
            <div className="pb-rahmen pb-rahmen-klein">
              <PhantomGesicht bau={person} ausschnitt="kopf" titel={`Phantombild von ${person.name}`} />
            </div>
            <div className="min-w-0">
              <p className="ls-klein">Beschreib diese Person</p>
              <p className="pb-name">{person.name}</p>
              <p className="ls-klein">etwa {person.alter} Jahre</p>
            </div>
          </div>
          <div className="pb-blatt ls-rollt" data-testid="pb-vorlage">
            {text.daten.absaetze.map((a, ai) => (
              <p key={ai}>
                {a.map((st, si) => {
                  if ("text" in st) return <span key={si}>{st.text}</span>;
                  const i = st.luecke;
                  const k = text.karten[i];
                  const stand = gefuellt[i];
                  const jetzt = i === luecke;
                  const zeigen = stand !== undefined && (!jetzt || richtigWahl);
                  return (
                    <span
                      key={si}
                      ref={jetzt ? aktiveLuecke : undefined}
                      className="pb-luecke"
                      data-merkmal={k.marke === "Merkmal" ? "" : undefined}
                      data-jetzt={jetzt && !richtigWahl ? "" : undefined}
                      data-stand={zeigen ? stand : undefined}
                      data-testid={jetzt ? "pb-luecke-jetzt" : undefined}
                    >
                      {zeigen ? k.richtig : jetzt ? "?" : " "}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
          {textKarte && (
            <div className="pb-antworten" data-anzahl={textKarte.faecher.length} data-lang={textKarte.faecher.some((f) => f.length > 22) ? "" : undefined} role="group" aria-label={textKarte.marke === "Merkmal" ? `Was passt bei ${textKarte.wort}?` : "Welches Wort fehlt?"} data-testid="pb-antworten">
              <p className="pb-frage">{textKarte.marke === "Merkmal" ? <>Merkmal: {textKarte.wort}</> : "Welches Wort fehlt?"}</p>
              {textKarte.faecher.map((f) => (
                <button
                  key={`${textKarte.key}-${f}`}
                  type="button"
                  className="pb-antwort pb-antwort-wort ohne-druck"
                  onClick={() => waehleWort(f)}
                  data-richtig={richtigWahl === f ? "" : undefined}
                  data-falsch={falschWahl === f ? "" : undefined}
                  disabled={!!richtigWahl}
                  data-testid="pb-antwort"
                  data-wert={f}
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

  // ---------- Fall lösen ----------

  if (!fall || !karte || !merkmalJetzt) return null;
  const daten = fall.daten;
  const nurBild = fall.nr >= NUR_BILD_AB;
  const merken = fall.nr >= MERKEN_AB;
  const teilJetzt = (karte.marke as Teil) ?? "Hauptteil";
  return (
    <div className="ls pb" role="dialog" aria-modal="true" aria-label="Lernspiel Phantombild">
      {kopf}
      <div className="pb-fall">
        <section className="pb-akte" aria-label="Zeugenaussage" data-verdeckt={verdeckt ? "" : undefined} data-testid="pb-aussage">
          <p className="pb-akte-kopf">
            <ScrollText size={16} aria-hidden /> Zeugenaussage
            {merken && !verdeckt && (
              <button type="button" className="pb-gemerkt" onClick={() => setVerdeckt(true)} data-testid="pb-gemerkt">
                Gemerkt!
              </button>
            )}
          </p>
          {verdeckt ? (
            <div className="pb-akte-zu">
              <p>Die Aussage ist zugeklappt. Weißt du es noch?</p>
              <button
                type="button"
                className="pb-nachlesen"
                onClick={() => {
                  setVerdeckt(false);
                  setNachgelesen(true);
                }}
                data-testid="pb-nachlesen"
              >
                <Eye size={16} aria-hidden /> Nochmal lesen {ausDemKopf ? "(weniger Punkte)" : ""}
              </button>
            </div>
          ) : (
            <div className="pb-akte-text ls-rollt">
              {TEILE.map((t) => {
                const saetze = daten.aussage.saetze.filter((s) => s.teil === t);
                if (!saetze.length) return null;
                return (
                  <p key={t} data-jetzt={t === teilJetzt ? "" : undefined}>
                    {saetze.map((s) => s.text).join(" ")}
                  </p>
                );
              })}
            </div>
          )}
        </section>

        <div className="pb-buehne">
          <div className="pb-rahmen" data-gefasst={gefasst ? "" : undefined}>
            <PhantomGesicht key={`${fall.rundeId}`} bau={bau} titel="Dein Phantombild" />
            {gefasst && <span className="pb-stempel pb-stempel-gross">Gefasst!</span>}
          </div>
          <ol className="pb-schritte" aria-label="Aufbau">
            {TEILE.map((t) => {
              const imTeil = fall.karten.filter((k) => k.marke === t);
              const fertig = fall.karten.filter((k, i) => k.marke === t && i < pos).length;
              return (
                <li key={t} data-jetzt={t === teilJetzt ? "" : undefined} data-fertig={imTeil.length && fertig === imTeil.length ? "" : undefined}>
                  <span>{t}</span>
                  <i aria-hidden>
                    {imTeil.map((k, i) => (
                      <b key={k.key} data-an={fall.karten.indexOf(k) < pos || (fall.karten.indexOf(k) === pos && richtigWahl) ? "" : undefined} data-i={i} />
                    ))}
                  </i>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="pb-antworten" data-anzahl={karte.faecher.length} role="group" aria-label={karte.wort} data-testid="pb-antworten">
          <p className="pb-frage" data-testid="pb-frage">
            {karte.wort}
          </p>
          {karte.faecher.map((f) => {
            const vorschau: Bau = { ...bau, [merkmalJetzt]: f };
            const wort = wertWort(merkmalJetzt, f);
            const mitWort = !nurBild || merkmalJetzt === "person" || istLeer(f);
            return (
              <button
                key={`${karte.key}-${f}`}
                type="button"
                className="pb-antwort ohne-druck"
                onClick={() => waehleMerkmal(f)}
                data-richtig={richtigWahl === f ? "" : undefined}
                data-falsch={falschWahl === f ? "" : undefined}
                disabled={!!richtigWahl || !!blatt}
                aria-label={wort}
                data-testid="pb-antwort"
                data-wert={f}
              >
                <PhantomGesicht bau={vorschau} ausschnitt={AUSSCHNITT_FUER[merkmalJetzt]} className="pb-antwort-bild" />
                {mitWort && <span className="pb-antwort-wort-klein">{wort}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {gefasst && (
        <div className="gk-geschafft pb-geschafft" role="status" data-testid="pb-gefasst">
          <p className="gk-geschafft-titel">Fall {gefasst.nr} gelöst!</p>
          {gefasst.bonus > 0 && <p className="gk-geschafft-punkte">Ohne Fehler +{zahl(gefasst.bonus)}</p>}
          {gefasst.herz && (
            <p className="gk-geschafft-herz">
              <Heart size={18} fill="currentColor" aria-hidden /> Ein Herz zurück
            </p>
          )}
        </div>
      )}

      {blatt && (
        <div className="gk-blatt-schirm" onClick={weiterMerkmal}>
          <div className="ls-regel gk-regel" role="alertdialog" aria-label="Das stand in der Aussage" onClick={(e) => e.stopPropagation()} data-testid="pb-blatt">
            <p className="ls-regel-kopf">
              <Lightbulb size={16} aria-hidden /> Im Text steht
            </p>
            <p className="pb-blatt-satz">{blatt.vor || "Davon steht nichts im Text. Erfinde keine Merkmale!"}</p>
            <p className="pb-blatt-richtig">
              Richtig ist: <b>{blatt.kurz}</b>
            </p>
            {blatt.regel && <p className="ls-regel-text">{blatt.regel}</p>}
            <button type="button" className="ls-knopf ls-los mt-3" onClick={weiterMerkmal} autoFocus data-testid="pb-weiter">
              {herzen <= 0 ? "Zum Ergebnis" : "Weiter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Welcher Ausschnitt auf den Antworten zu sehen ist. */
const AUSSCHNITT_FUER: Record<Merkmal, Merkmal | "ganz" | "kopf"> = {
  person: "kopf",
  koerperbau: "koerperbau",
  haut: "haut",
  gesicht: "gesicht",
  augen: "augen",
  nase: "nase",
  mund: "mund",
  frisur: "frisur",
  haarfarbe: "haarfarbe",
  bart: "bart",
  oberteil: "oberteil",
  farbe: "farbe",
  brille: "brille",
  schmuck: "schmuck",
  besonderes: "besonderes",
};

/** Ein festes Gesicht für den Anfang. */
const START_BAU: Bau = { person: "jugendlicher", koerperbau: "schlank", haut: "hell", gesicht: "oval", augen: "gruen", nase: "klein", mund: "breit", frisur: "locken", haarfarbe: "rot", bart: "kein", oberteil: "kapuze", farbe: "gelb", brille: "rund", schmuck: "keiner", besonderes: "sommersprossen" };

function stufenText(n: number): string {
  if (n <= 1) return "Stufe 1: nur die Merkmale fehlen.";
  if (n >= VORLAGE_STUFEN) return `Stufe ${n}: der ganze Text fehlt. Aus dem Kopf!`;
  return `Stufe ${n}: dazu fehlt ${n === 2 ? "jedes vierte" : n === 3 ? "jedes zweite" : "fast jedes"} Wort der Vorlage (${Math.round(anteilFuer(n) * 100)} %).`;
}
