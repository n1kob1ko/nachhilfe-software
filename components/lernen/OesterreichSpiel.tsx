"use client";

import "./lernspiel.css";
import "./phantombild.css";
import "./blockwerk.css";
import "./oesterreich.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Crown, Heart, PenLine, RotateCcw, Star, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { oesterreichStartenAction, spielBeendenAction } from "@/app/lernspiel-actions";
import type { SpielErgebnis, SpielKarte } from "@/lib/lernspiele-typen";
import {
  ALTERSAUFBAU,
  balkenTrifft,
  BOSS_LEVEL,
  BUNDESLAENDER,
  einwohnerText,
  herzenFuer,
  LAND,
  LEVELS,
  levelVon,
  pruefeGeschrieben,
  REIHE_TRENNER,
  zahlAus,
  type LandId,
  type OeDaten,
  type OeWunsch,
} from "@/lib/oesterreich";
import { BEZIRKSGRENZEN, KARTE_BREITE, KARTE_HOEHE, LAND_PFADE, STADT_ORTE } from "@/lib/oesterreich-karte";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { Konfetti } from "./Lernspiel";
import { vibriere } from "./SpielTeile";

/**
 * „Österreich erobern“ (lib/oesterreich.ts, docs/lernspiele.md): die Karte von Österreich ist die Level-Karte. Jedes
 * Bundesland ist ein Level zu einem Teil des Teststoffs; geschafft = erobert, das Land färbt sich in seinen Farben.
 * Wien ist der Endgegner. Im Level: Herzen (ein Fehler beim ersten Versuch kostet eins), Punkte, Serie; nach einem
 * Fehler die Lösung und ein Merksatz, die Karte kommt drei Karten später noch einmal. Keine Erklär-Animationen.
 */

type Phase = "karte" | "laden" | "spiel" | "ende" | "zettel";
type Runde = { rundeId: number; karten: SpielKarte[]; wunsch: OeWunsch };
type Hilfe = { karte: SpielKarte; art: "falsch" | "fast"; eingabe?: string };
type Effekt = { punkte: number; n: number } | null;

const WIEDER_NACH = 3;
const LEVEL_FARBE: Record<LandId, string> = { v: "#e86a5f", t: "#47b8b0", s: "#d66464", k: "#f0c94a", st: "#5cbf62", o: "#efa65c", n: "#5c9fe6", b: "#a774e0", w: "#ef5a5a" };

export function OesterreichSpiel({
  token,
  sicher: sicherAnfang,
  falsch: falschAnfang,
  level: levelAnfang,
  grund,
  zurueck: zurueckZiel,
}: {
  token: string;
  /** Einträge, die sicher sitzen */
  sicher: string[];
  /** Einträge, die zuletzt falsch waren */
  falsch: string[];
  /** die besten Sterne je Level */
  level: Record<number, number>;
  /** warum es gerade passt („GWB-Test in 2 Tagen“) */
  grund?: string;
  zurueck?: string;
}) {
  const router = useRouter();
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;

  const [phase, setPhase] = useState<Phase>("karte");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [sicher, setSicher] = useState<Set<string>>(new Set(sicherAnfang));
  const [falsch, setFalsch] = useState<Set<string>>(new Set(falschAnfang));
  const [levelStand, setLevelStand] = useState<Record<number, number>>(levelAnfang);
  const [runde, setRunde] = useState<Runde | null>(null);
  const [reihe, setReihe] = useState<SpielKarte[]>([]);
  const [pos, setPos] = useState(0);
  const [wahl, setWahl] = useState<{ wert: string; ok: boolean } | null>(null);
  const [hilfe, setHilfe] = useState<Hilfe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [herzen, setHerzen] = useState(3);
  const [punkte, setPunkte] = useState(0);
  const [folge, setFolge] = useState(0);
  const [beste, setBeste] = useState(0);
  const [geschafft, setGeschafft] = useState<Set<string>>(new Set());
  const [effekt, setEffekt] = useState<Effekt>(null);
  const [aua, setAua] = useState(0);
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [getippt, setGetippt] = useState<string | null>(null);
  const [gelegt, setGelegt] = useState<string[]>([]);
  const [schwer, setSchwer] = useState(false);

  const antworten = useRef(new Map<string, string>());
  const wieder = useRef(new Map<string, number>());
  const feld = useRef<HTMLInputElement | null>(null);

  // „Schwer“ bleibt auf diesem Gerät eingeschaltet
  useEffect(() => {
    try {
      setSchwer(window.localStorage.getItem("oe-schwer") === "1");
    } catch {}
  }, []);
  const schwerSetzen = (an: boolean) => {
    setSchwer(an);
    try {
      window.localStorage.setItem("oe-schwer", an ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
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

  const karte = reihe[pos] ?? null;
  const daten: OeDaten | null = karte?.oe ?? null;
  const imLevel = runde?.wunsch.was === "level" ? runde.wunsch.level : null;
  const maxHerzen = imLevel !== null ? herzenFuer(imLevel) : 0;

  const starten = useCallback(async (w0: OeWunsch) => {
    const w: OeWunsch = { ...w0, schwer };
    setPhase("laden");
    setFehler(null);
    const r = await oesterreichStartenAction(token, w);
    if ("fehler" in r) {
      setFehler(r.fehler);
      setPhase("karte");
      return;
    }
    antworten.current = new Map();
    wieder.current = new Map();
    setRunde({ rundeId: r.rundeId, karten: r.karten, wunsch: w });
    setReihe(r.karten);
    setPos(0);
    setWahl(null);
    setHilfe(null);
    setEingabe("");
    setHerzen(w.was === "level" ? herzenFuer(w.level) : 0);
    setPunkte(0);
    setFolge(0);
    setBeste(0);
    setGeschafft(new Set());
    setEffekt(null);
    setDaneben([]);
    setErgebnis(null);
    setGetippt(null);
    setGelegt([]);
    setPhase("spiel");
  }, [token, schwer]);

  const fertig = useCallback(async () => {
    if (!runde) return;
    setPhase("ende");
    const liste = [...antworten.current.entries()].map(([key, w]) => ({ key, wahl: w }));
    if (runde.wunsch.was === "level") spiele((k) => (herzen > 0 ? k.rekord() : k.aus()));
    else spiele((k) => k.frei());
    const e = await spielBeendenAction(token, runde.rundeId, liste);
    setErgebnis(e);
    if (!("fehler" in e) && e.oesterreich) {
      setSicher(new Set(e.oesterreich.sicher));
      setFalsch(new Set(e.oesterreich.falsch));
      setLevelStand(e.oesterreich.level);
    }
    router.refresh();
  }, [runde, spiele, herzen, token, router]);

  const weiter = useCallback(
    (nochmal?: SpielKarte) => {
      setWahl(null);
      setHilfe(null);
      setEffekt(null);
      setEingabe("");
      setGetippt(null);
      setGelegt([]);
      let neu = reihe;
      if (nochmal && (wieder.current.get(nochmal.key) ?? 0) < 2) {
        wieder.current.set(nochmal.key, (wieder.current.get(nochmal.key) ?? 0) + 1);
        neu = [...reihe];
        neu.splice(Math.min(neu.length, pos + 1 + WIEDER_NACH), 0, nochmal);
        setReihe(neu);
      }
      if (pos + 1 >= neu.length || (imLevel !== null && herzen <= 0)) void fertig();
      else setPos(pos + 1);
    },
    [reihe, pos, fertig, imLevel, herzen],
  );

  /** Eine Antwort: `wert` ist das, was zählt (bei „fast“ schon die richtige Schreibweise). */
  const antworte = useCallback(
    (wert: string, o: { fast?: boolean; eingabe?: string } = {}) => {
      if (!karte || !daten || wahl || hilfe) return;
      const erste = !antworten.current.has(karte.key);
      if (erste) antworten.current.set(karte.key, wert);
      const ok = wert === karte.richtig;
      setWahl({ wert, ok });
      if (ok) {
        const p = erste ? 100 + Math.min(folge, 5) * 20 : 30;
        setPunkte((x) => x + p);
        setGeschafft((g) => new Set([...g, karte.key]));
        setEffekt({ punkte: p, n: Date.now() });
        if (erste)
          setFolge((f) => {
            setBeste((b) => Math.max(b, f + 1));
            return f + 1;
          });
        spiele((k) => k.richtig(erste && folge >= 2));
        vibriere(12);
        if (o.fast) setHilfe({ karte, art: "fast", eingabe: o.eingabe });
        return;
      }
      if (erste && imLevel !== null) {
        setHerzen((h) => Math.max(0, h - 1));
        setAua(Date.now());
      }
      setFolge(0);
      setDaneben((d) => (d.some((k) => k.key === karte.key) ? d : [...d, karte]));
      spiele((k) => k.falsch());
      vibriere([40, 60, 40]);
      setHilfe({ karte, art: "falsch", eingabe: o.eingabe });
    },
    [karte, daten, wahl, hilfe, spiele, folge, imLevel],
  );

  // richtig: kurz zeigen, dann weiter
  useEffect(() => {
    if (!wahl?.ok || hilfe) return;
    const t = window.setTimeout(() => weiter(), daten?.art === "mehr" ? 1300 : 800);
    return () => window.clearTimeout(t);
  }, [wahl, hilfe, weiter, daten]);

  useEffect(() => {
    if (phase === "spiel" && (daten?.art === "schreiben" || daten?.art === "zahl") && !hilfe && !wahl) feld.current?.focus({ preventScroll: true });
  }, [phase, daten, hilfe, wahl, pos]);

  // am Laptop: Eingabe oder Leertaste für „Weiter“, Ziffern für die Kacheln
  useEffect(() => {
    if (phase !== "spiel") return;
    const taste = (e: KeyboardEvent) => {
      if (hilfe && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        weiter(hilfe.art === "falsch" ? hilfe.karte : undefined);
        return;
      }
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (!karte || !daten || wahl || !karte.faecher.length || daten.art === "land" || daten.art === "stadt") return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < karte.faecher.length) antworte(karte.faecher[i]);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [phase, hilfe, karte, daten, wahl, weiter, antworte]);

  const schreiben = (e: FormEvent) => {
    e.preventDefault();
    if (!karte || !daten || wahl || hilfe) return;
    const text = eingabe.trim();
    if (!text) return;
    if (daten.art === "zahl") {
      const z = zahlAus(text);
      antworte(z !== null && String(z) === karte.richtig ? karte.richtig : text, { eingabe: text });
      return;
    }
    const r = pruefeGeschrieben(text, [karte.richtig, ...(daten.auch ?? [])]);
    if (r === "falsch") antworte(text, { eingabe: text });
    else antworte(karte.richtig, { fast: r === "fast", eingabe: text });
  };

  const tippeKarte = (id: string) => {
    if (!karte || !daten || wahl || hilfe) return;
    setGetippt(id);
    antworte(id === karte.richtig ? karte.richtig : id, { eingabe: daten.art === "stadt" ? LAND[id as LandId]?.hauptstadt : LAND[id as LandId]?.name });
  };

  const tippeBalken = (id: string) => {
    if (!karte || !daten?.ziel || wahl || hilfe) return;
    setGetippt(id);
    antworte(balkenTrifft(daten.ziel, id) ? karte.richtig : id);
  };

  const lege = (teil: string) => {
    if (!karte || !daten?.teile || wahl || hilfe || gelegt.includes(teil)) return;
    const neu = [...gelegt, teil];
    setGelegt(neu);
    spiele((k) => k.setzen());
    if (neu.length === daten.teile.length) {
      const wert = neu.join(REIHE_TRENNER);
      window.setTimeout(() => antworte(wert, { eingabe: neu.join(" → ") }), 250);
    }
  };

  const summe = LEVELS.reduce((n, l) => n + (levelStand[l.nr] ?? 0), 0);
  const erobert = LEVELS.filter((l) => (levelStand[l.nr] ?? 0) > 0).length;

  const kopf = (
    <div className="ls-kopf">
      {phase === "spiel" || phase === "ende" || phase === "zettel" ? (
        <button type="button" className="ls-zu treffer" onClick={() => setPhase("karte")} aria-label="Zur Karte" data-testid="oe-zur-karte">
          <ArrowLeft size={24} aria-hidden />
        </button>
      ) : (
        <Link href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen" data-testid="oe-schliessen">
          <X size={24} aria-hidden />
        </Link>
      )}
      {phase === "spiel" && imLevel !== null ? (
        <>
          <span className="oe-herzen" aria-label={`${herzen} von ${maxHerzen} Herzen`} data-testid="oe-herzen" data-herzen={herzen}>
            {Array.from({ length: maxHerzen }, (_, i) => (
              <Heart key={i} size={22} fill={i < herzen ? "currentColor" : "none"} data-weg={i >= herzen ? "" : undefined} aria-hidden />
            ))}
          </span>
          <span className="oe-punkte tabular-nums" data-testid="oe-punkte">
            <b key={punkte}>{punkte}</b>
          </span>
        </>
      ) : phase === "spiel" ? (
        <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={reihe.length} aria-valuenow={pos} aria-label="Fortschritt">
          <i style={{ width: `${Math.round((pos / Math.max(1, reihe.length)) * 100)}%` }} />
        </span>
      ) : (
        <span className="flex-1" />
      )}
      {phase === "spiel" && (
        <span className="ls-combo" data-heiss={folge >= 3 ? "" : undefined} aria-label={`${folge} richtig in Folge`} data-testid="oe-folge">
          <Zap size={16} aria-hidden />
          <b key={folge}>{folge}</b>
        </span>
      )}
      <button type="button" className="ls-zu treffer" onClick={() => setzeTon(!ton)} aria-pressed={!ton} aria-label={ton ? "Töne ausschalten" : "Töne einschalten"}>
        {ton ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}
      </button>
    </div>
  );

  // ---------- Die Karte: Level wählen ----------

  if (phase === "karte" || phase === "laden") {
    const naechstes = LEVELS.find((l) => !levelStand[l.nr]) ?? null;
    return (
      <div className="ls oe" role="dialog" aria-modal="true" aria-label="Österreich erobern">
        {kopf}
        <div className="ls-mitte ls-rollt oe-start" data-testid="oe-start">
          <p className="ls-oberzeile">Geo-Test</p>
          <h1 className="ls-titel">Österreich erobern</h1>
          <div className="oe-stand">
            <span className="oe-stand-zahl tabular-nums" data-testid="oe-erobert">
              <Crown size={18} aria-hidden /> {erobert} von 9 erobert
            </span>
            <span className="oe-stand-zahl tabular-nums" data-testid="oe-sterne">
              <Star size={18} fill="currentColor" aria-hidden /> {summe} von 27
            </span>
            {grund && (
              <span className="ls-grund" data-testid="oe-grund">
                <BookOpen size={16} aria-hidden />
                {grund}
              </span>
            )}
          </div>
          <p className="oe-sprech">Tippe auf ein Bundesland und erobere es. Wien ist der Endgegner.</p>
          <button type="button" className="oe-schwer" role="switch" aria-checked={schwer} onClick={() => schwerSetzen(!schwer)} data-testid="oe-schwer">
            <span className="oe-schwer-knopf" aria-hidden />
            <span className="min-w-0 flex-1">
              <b>Schwer: alles selbst schreiben</b>
              <small>{schwer ? "An: Bundesländer, Hauptstädte und kurze Antworten tippst du selbst, wie auf der leeren Karte im Test." : "Aus: zuerst mit Auswahl. Was du einmal richtig hattest, kommt danach zum Selbstschreiben."}</small>
            </span>
          </button>
          <div className="oe-kartenrahmen">
            <LevelKarte stand={levelStand} naechstes={naechstes?.land ?? null} gesperrt={phase === "laden"} onWahl={(nr) => void starten({ was: "level", level: nr })} />
          </div>
          <ol className="oe-levels" data-testid="oe-levels">
            {LEVELS.map((l) => {
              const sterne = levelStand[l.nr] ?? 0;
              return (
                <li key={l.nr}>
                  <button
                    type="button"
                    className="oe-level"
                    data-geschafft={sterne > 0 ? "" : undefined}
                    data-jetzt={naechstes?.nr === l.nr ? "" : undefined}
                    data-boss={l.nr === BOSS_LEVEL ? "" : undefined}
                    disabled={phase === "laden"}
                    onClick={() => void starten({ was: "level", level: l.nr })}
                    data-testid={`oe-level-${l.nr}`}
                  >
                    <span className="oe-level-land" style={{ "--f": LEVEL_FARBE[l.land] } as CSSProperties}>
                      {l.nr === BOSS_LEVEL ? <Crown size={18} aria-hidden /> : l.nr}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b>{LAND[l.land].name}</b>
                      <small>{l.titel}</small>
                    </span>
                    <span className="oe-level-sterne" aria-label={`${sterne} von 3 Sternen`}>
                      {[0, 1, 2].map((s) => (
                        <Star key={s} size={15} fill={s < sterne ? "currentColor" : "none"} data-an={s < sterne ? "" : undefined} aria-hidden />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="oe-zwischen">Mehr zum Lernen</p>
          <div className="pb-wahl">
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten({ was: "begriffe" })} disabled={phase === "laden"} data-testid="oe-begriffe">
              <PenLine size={26} aria-hidden />
              <span>
                <b>Begriffe schreiben</b>
                <small>Wie im Test: Landflucht, Hauptwohnsitz, Demographie, Hauptstädte … selbst schreiben.</small>
              </span>
            </button>
            {falsch.size > 0 && (
              <button type="button" className="pb-wahl-knopf" onClick={() => void starten({ was: "fehler" })} disabled={phase === "laden"} data-testid="oe-fehler">
                <RotateCcw size={26} aria-hidden />
                <span>
                  <b>Meine Fehler ({falsch.size})</b>
                  <small>Alles, was beim letzten Mal falsch war.</small>
                </span>
              </button>
            )}
            <button type="button" className="pb-wahl-knopf" onClick={() => setPhase("zettel")} data-testid="oe-zettel">
              <BookOpen size={26} aria-hidden />
              <span>
                <b>Lernzettel</b>
                <small>Das Wichtigste aus dem Buch S. 8–13.</small>
              </span>
            </button>
          </div>
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
          <p className="oe-quelle">Karte: Statistik Austria (CC BY 4.0). {sicher.size > 0 ? `${sicher.size} Fragen sitzen sicher.` : ""}</p>
        </div>
      </div>
    );
  }

  // ---------- Lernzettel ----------

  if (phase === "zettel") {
    return (
      <div className="ls oe" role="dialog" aria-modal="true" aria-label="Lernzettel">
        {kopf}
        <div className="ls-mitte ls-rollt oe-start" data-testid="oe-zettel-seite">
          <h1 className="ls-titel">Lernzettel</h1>
          {LEVELS.filter((l) => l.zettel.length).map((l) => (
            <section key={l.nr} className="ls-blatt oe-zettel">
              <p className="oe-zettel-kopf">
                <span className="oe-level-land" style={{ "--f": LEVEL_FARBE[l.land] } as CSSProperties}>
                  {l.nr}
                </span>
                <span>
                  <b>{l.titel}</b>
                  <small>{l.quelle}</small>
                </span>
              </p>
              {l.nr === 7 && <Pyramide klein />}
              <ul>
                {l.zettel.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
              <button type="button" className="ls-knopf mt-3 w-full" onClick={() => void starten({ was: "level", level: l.nr })}>
                {LAND[l.land].name} erobern
              </button>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Ende ----------

  if (phase === "ende" && runde) {
    const lv = imLevel !== null ? levelVon(imLevel) : undefined;
    const anzahl = runde.karten.length;
    const richtig = runde.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    const fehlerErst = runde.karten.filter((k) => antworten.current.has(k.key) && antworten.current.get(k.key) !== k.richtig).length;
    const gewonnen = lv ? herzen > 0 : richtig / Math.max(1, anzahl) >= 0.7;
    const sterne = lv ? (gewonnen ? (lv.nr === BOSS_LEVEL ? (fehlerErst <= 1 ? 3 : fehlerErst <= 3 ? 2 : 1) : 3 - fehlerErst) : 0) : richtig / Math.max(1, anzahl) >= 0.9 ? 3 : richtig / Math.max(1, anzahl) >= 0.7 ? 2 : 1;
    const naechstes = lv ? LEVELS.find((l) => l.nr > lv.nr && !levelStand[l.nr]) : undefined;
    return (
      <div className="ls oe" role="dialog" aria-modal="true" aria-label={gewonnen ? "Geschafft" : "Runde vorbei"}>
        {gewonnen && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center" data-testid="oe-ende" data-gewonnen={gewonnen ? "" : undefined}>
          {lv && (
            <div className="oe-ende-karte" style={{ "--n": 0 } as CSSProperties}>
              <MiniKarte land={lv.land} erobert={gewonnen} />
            </div>
          )}
          <p className="ls-oberzeile mt-2">{lv ? `Level ${lv.nr} · ${lv.titel}` : runde.wunsch.was === "begriffe" ? "Begriffe schreiben" : "Meine Fehler"}</p>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties} data-testid="oe-ende-titel">
            {lv ? (gewonnen ? `${LAND[lv.land].name} ist erobert!` : `${LAND[lv.land].name} hat sich gewehrt`) : gewonnen ? "Gut gemacht!" : "Weiter üben, das wird!"}
          </h1>
          <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`} data-testid="oe-ende-sterne" data-sterne={sterne}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 44 : 34} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <p className="ls-text mt-1 tabular-nums" style={{ "--n": 1 } as CSSProperties}>
            {richtig} von {anzahl} beim ersten Versuch richtig{lv ? ` · ${punkte} Punkte` : ""}
            {beste >= 3 ? ` · ${beste} in Folge` : ""}
          </p>
          <p className="ls-klein mt-1" style={{ "--n": 1 } as CSSProperties}>
            {lv
              ? gewonnen
                ? sterne < 3
                  ? "Ohne Fehler beim ersten Versuch gibt es drei Sterne."
                  : "Keine Fehler. Perfekt!"
                : "Keine Herzen mehr. Lies die Lösungen unten und versuch es gleich nochmal."
              : `${sicher.size} Fragen sitzen jetzt sicher.`}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 2 } as CSSProperties} data-testid="oe-daneben">
              <p className="text-[15px] font-semibold">Schau dir das noch einmal an</p>
              <ul className="oe-daneben mt-3">
                {daneben.map((k) => (
                  <li key={k.key}>
                    <span>{k.oe?.frage}</span>
                    <b>{k.loesung}</b>
                    {k.regel && <small>{k.regel}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 3 } as CSSProperties}>
            {gewonnen && naechstes ? (
              <button type="button" className="ls-knopf ls-los" onClick={() => void starten({ was: "level", level: naechstes.nr })} disabled={!ergebnis} autoFocus data-testid="oe-naechstes">
                Weiter: {LAND[naechstes.land].name} erobern
              </button>
            ) : (
              <button type="button" className="ls-knopf ls-los" onClick={() => void starten(runde.wunsch)} disabled={!ergebnis} autoFocus data-testid="oe-nochmal">
                Nochmal
              </button>
            )}
            {gewonnen && naechstes && sterne < 3 && (
              <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => void starten(runde.wunsch)} disabled={!ergebnis} data-testid="oe-nochmal">
                Nochmal für mehr Sterne
              </button>
            )}
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("karte")} data-testid="oe-ende-karte">
              Zur Österreich-Karte
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------

  if (!karte || !daten) return null;
  const lv = imLevel !== null ? levelVon(imLevel) : undefined;
  const fortschritt = runde ? geschafft.size / Math.max(1, runde.karten.length) : 0;
  const zeigeLoesung = !!wahl;
  return (
    <div className="ls oe" role="dialog" aria-modal="true" aria-label="Österreich erobern" data-art={daten.art}>
      {kopf}
      {aua > 0 && <div className="oe-aua" key={aua} aria-hidden />}
      <div className="oe-spiel">
        <div className="oe-oben">
          {lv ? (
            <div className="oe-erobern" data-testid="oe-erobern">
              <span className="oe-erobern-name">
                {LAND[lv.land].name} erobern <small>{lv.titel}</small>
              </span>
              <span className="oe-erobern-balken" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fortschritt * 100)} aria-label="Erobert">
                <i style={{ width: `${Math.round(fortschritt * 100)}%`, background: streifen(LAND[lv.land].farben) }} />
              </span>
              {effekt && (
                <b className="oe-plus" key={effekt.n} data-testid="oe-plus">
                  +{effekt.punkte}
                </b>
              )}
            </div>
          ) : (
            <p className="oe-schild">{runde?.wunsch.was === "begriffe" ? "Begriffe schreiben" : "Meine Fehler"}</p>
          )}
        </div>

        <div className="oe-karte" key={`k-${karte.key}-${pos}`} data-testid="oe-karte" data-art={daten.art} data-eintrag={daten.eintrag}>
          <p className="oe-frage" data-testid="oe-frage" data-lang={daten.frage.length > 90 ? "" : undefined}>
            {daten.frage}
          </p>

          {(daten.art === "land" || daten.art === "stadt") && (
            <FrageKarte modus={daten.art} richtig={zeigeLoesung ? (daten.land ?? null) : null} getippt={getippt} gesperrt={!!wahl} onTipp={tippeKarte} />
          )}

          {daten.art === "gruppe" && daten.land && (
            <div className="oe-gruppe-land">
              <MiniKarte land={daten.land} />
              <b>{LAND[daten.land].name}</b>
            </div>
          )}

          {daten.art === "mehr" && daten.mehr && (
            <div className="oe-mehr">
              {[daten.mehr.a, daten.mehr.b].map((id) => {
                const name = LAND[id].name;
                return (
                  <button
                    key={id}
                    type="button"
                    className="oe-mehr-knopf"
                    onClick={() => antworte(name)}
                    disabled={!!wahl}
                    data-richtig={wahl && name === karte.richtig ? "" : undefined}
                    data-falsch={wahl && !wahl.ok && name === wahl.wert ? "" : undefined}
                    data-testid="oe-antwort"
                    data-wert={name}
                  >
                    <MiniKarte land={id} />
                    <b>{name}</b>
                    <small className="tabular-nums" data-zeigen={wahl ? "" : undefined}>
                      {wahl ? `${einwohnerText(id)} Einw.` : "?"}
                    </small>
                  </button>
                );
              })}
            </div>
          )}

          {(daten.art === "wahl" || daten.art === "rf" || daten.art === "gruppe") && (
            <div className="oe-antworten" data-anzahl={karte.faecher.length} data-lang={karte.faecher.some((f) => f.length > 24) ? "" : undefined}>
              {karte.faecher.map((f, i) => (
                <button
                  key={`${karte.key}-${f}`}
                  type="button"
                  className="oe-antwort"
                  onClick={() => antworte(f)}
                  disabled={!!wahl}
                  data-richtig={wahl && f === karte.richtig ? "" : undefined}
                  data-falsch={wahl && !wahl.ok && f === wahl.wert ? "" : undefined}
                  data-testid="oe-antwort"
                  data-wert={f}
                  aria-keyshortcuts={String(i + 1)}
                  style={{ "--i": i } as CSSProperties}
                >
                  {daten.art === "rf" ? (f === "richtig" ? "Richtig" : "Falsch") : f}
                </button>
              ))}
            </div>
          )}

          {daten.art === "balken" && <Pyramide ziel={zeigeLoesung ? (daten.ziel ?? []) : null} getippt={getippt} gesperrt={!!wahl} onTipp={tippeBalken} />}

          {daten.art === "reihe" && daten.teile && (
            <div className="oe-reihe">
              <ol className="oe-reihe-gelegt" aria-label="Deine Reihenfolge">
                {daten.teile.map((_, i) => (
                  <li key={i} data-voll={gelegt[i] ? "" : undefined} data-ok={wahl ? (wahl.ok ? "" : "nein") : undefined}>
                    <span>{i + 1}.</span> {gelegt[i] ?? ""}
                  </li>
                ))}
              </ol>
              <div className="oe-antworten" data-lang="">
                {daten.teile.map((t) => (
                  <button key={t} type="button" className="oe-antwort" onClick={() => lege(t)} disabled={!!wahl || gelegt.includes(t)} data-weg={gelegt.includes(t) ? "" : undefined} data-testid="oe-teil" data-wert={t}>
                    {t}
                  </button>
                ))}
              </div>
              {gelegt.length > 0 && !wahl && (
                <button type="button" className="ls-knopf mt-3" data-zweit="" onClick={() => setGelegt([])} data-testid="oe-reihe-neu">
                  <RotateCcw size={16} aria-hidden /> Von vorn
                </button>
              )}
            </div>
          )}

          {daten.art === "schreiben" && (daten.zeigeLand || daten.zeigeStadt) && <ZeigeKarte land={daten.zeigeLand} stadt={daten.zeigeStadt} />}

          {(daten.art === "schreiben" || daten.art === "zahl") && (
            <form className="oe-schreiben" onSubmit={schreiben}>
              <div className="oe-feld-zeile">
                {daten.art === "zahl" && (
                  <button type="button" className="oe-minus" onClick={() => setEingabe((x) => (x.trim().startsWith("-") ? x.trim().slice(1) : `-${x.trim()}`))} disabled={!!wahl} aria-label="Minus davor oder weg" data-testid="oe-minus">
                    ±
                  </button>
                )}
                <input
                  ref={feld}
                  className="oe-feld"
                  value={eingabe}
                  onChange={(e) => setEingabe(e.target.value)}
                  disabled={!!wahl}
                  data-ok={wahl ? (wahl.ok ? "" : "nein") : undefined}
                  placeholder={daten.art === "zahl" ? "Zahl" : "Deine Antwort"}
                  aria-label="Deine Antwort"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  enterKeyHint="done"
                  inputMode={daten.art === "zahl" ? "numeric" : "text"}
                  maxLength={60}
                  data-testid="oe-feld"
                />
              </div>
              <div className="oe-schreiben-knoepfe">
                <button type="button" className="ls-knopf" data-zweit="" onClick={() => antworte("", { eingabe: "" })} disabled={!!wahl} data-testid="oe-weiss-nicht">
                  Weiß ich nicht
                </button>
                <button type="submit" className="ls-knopf" disabled={!!wahl || !eingabe.trim()} data-testid="oe-fertig">
                  Fertig
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {hilfe && (
        <div className="oe-hilfe" role="alert" data-art={hilfe.art} data-testid="oe-hilfe">
          <div className="ls-blatt oe-hilfe-blatt">
            <p className="oe-hilfe-titel">{hilfe.art === "fast" ? "Fast! Achte auf die Schreibung" : hilfe.eingabe === "" ? "So heißt es" : "Nicht ganz"}</p>
            <p className="oe-hilfe-text">
              {hilfe.eingabe ? (
                <>
                  Du: <s>{hilfe.eingabe}</s>
                  <br />
                </>
              ) : null}
              Richtig: <b data-testid="oe-loesung">{hilfe.karte.loesung}</b>
            </p>
            {hilfe.art === "falsch" && hilfe.karte.regel && (
              <p className="oe-merke">
                <BookOpen size={16} aria-hidden /> {hilfe.karte.regel}
              </p>
            )}
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => weiter(hilfe.art === "falsch" ? hilfe.karte : undefined)} autoFocus data-testid="oe-weiter">
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Landesfarben als waagrechte Streifen (CSS). */
function streifen(farben: string[]): string {
  const n = farben.length;
  return `linear-gradient(180deg, ${farben.map((f, i) => `${f} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`).join(", ")})`;
}

/** Wien ist klein: ein Tippkreis darüber (in Kartenpunkten). */
const WIEN_KREIS = 30;

/** Die SVG-Muster für die Landesfarben (eroberte Länder). */
function Muster() {
  return (
    <defs>
      {BUNDESLAENDER.map((b) => (
        <pattern key={b.id} id={`oe-farben-${b.id}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
          {b.farben.map((f, i) => (
            <rect key={i} x="0" y={i / b.farben.length} width="1" height={1 / b.farben.length + 0.002} fill={f} />
          ))}
        </pattern>
      ))}
    </defs>
  );
}

/** Die Level-Karte: eroberte Länder in ihren Farben, sonst hell mit der Nummer des Levels. */
function LevelKarte({ stand, naechstes, gesperrt, onWahl }: { stand: Record<number, number>; naechstes: LandId | null; gesperrt: boolean; onWahl: (nr: number) => void }) {
  return (
    <svg viewBox={`0 0 ${KARTE_BREITE} ${KARTE_HOEHE}`} className="oe-svg" role="group" aria-label="Österreich: tippe auf ein Bundesland" data-testid="oe-levelkarte">
      <Muster />
      {LEVELS.map((l) => {
        const p = LAND_PFADE[l.land];
        const sterne = stand[l.nr] ?? 0;
        return (
          <path
            key={l.land}
            d={p.d}
            className="oe-land"
            data-erobert={sterne > 0 ? "" : undefined}
            data-jetzt={naechstes === l.land ? "" : undefined}
            style={sterne > 0 ? { fill: `url(#oe-farben-${l.land})` } : undefined}
            onClick={() => !gesperrt && onWahl(l.nr)}
            data-testid={`oe-karte-land-${l.land}`}
          />
        );
      })}
      <path d={BEZIRKSGRENZEN} className="oe-bezirke" />
      {LEVELS.map((l) => {
        const [x, y] = l.land === "w" ? [LAND_PFADE.w.mitte[0] + 34, LAND_PFADE.w.mitte[1] - 34] : l.land === "b" ? [LAND_PFADE.b.mitte[0] - 4, LAND_PFADE.b.mitte[1] - 6] : LAND_PFADE[l.land].mitte;
        const sterne = stand[l.nr] ?? 0;
        return (
          <g key={`n-${l.land}`} className="oe-nummer" data-erobert={sterne > 0 ? "" : undefined} transform={`translate(${x} ${y})`} onClick={() => !gesperrt && onWahl(l.nr)}>
            <circle r={l.nr === BOSS_LEVEL ? 30 : 26} />
            <text dy="10">{l.nr === BOSS_LEVEL ? "♛" : sterne > 0 ? "★".repeat(sterne).slice(0, 3) : l.nr}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Frage auf der Karte: Bundesland oder Landeshauptstadt antippen. Danach grün die Lösung, rot das Getippte. */
function FrageKarte({ modus, richtig, getippt, gesperrt, onTipp }: { modus: "land" | "stadt"; richtig: string | null; getippt: string | null; gesperrt: boolean; onTipp: (id: string) => void }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const tippStadt = (e: MouseEvent<SVGSVGElement>) => {
    if (gesperrt || modus !== "stadt" || !svg.current) return;
    const m = svg.current.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    let best: string | null = null;
    let d = Infinity;
    for (const [id, [x, y]] of Object.entries(STADT_ORTE)) {
      const dd = Math.hypot(x - pt.x, y - pt.y);
      if (dd < d) {
        d = dd;
        best = id;
      }
    }
    if (best && d < 70) onTipp(best);
  };
  return (
    <svg ref={svg} viewBox={`0 0 ${KARTE_BREITE} ${KARTE_HOEHE}`} className="oe-svg oe-frage-svg" onClick={tippStadt} data-modus={modus} data-testid="oe-fragekarte">
      {BUNDESLAENDER.map((b) => (
        <path
          key={b.id}
          d={LAND_PFADE[b.id].d}
          className="oe-land"
          data-richtig={richtig === b.id && modus === "land" ? "" : undefined}
          data-falsch={getippt === b.id && richtig !== null && richtig !== b.id && modus === "land" ? "" : undefined}
          onClick={modus === "land" ? () => !gesperrt && onTipp(b.id) : undefined}
          data-testid={`oe-tipp-${b.id}`}
        />
      ))}
      <path d={BEZIRKSGRENZEN} className="oe-bezirke" />
      {modus === "land" && (
        <circle cx={LAND_PFADE.w.mitte[0]} cy={LAND_PFADE.w.mitte[1]} r={WIEN_KREIS} className="oe-wien-kreis" data-richtig={richtig === "w" ? "" : undefined} onClick={() => !gesperrt && onTipp("w")} data-testid="oe-tipp-wien" />
      )}
      {modus === "stadt" &&
        Object.entries(STADT_ORTE).map(([id, [x, y]]) => (
          <g key={id} className="oe-stadt" data-richtig={richtig === id ? "" : undefined} data-falsch={getippt === id && richtig !== null && richtig !== id ? "" : undefined} data-testid={`oe-stadt-${id}`}>
            <circle cx={x} cy={y} r={13} />
            {(richtig === id || (getippt === id && richtig !== null)) && (
              <text x={x} y={y - 22} className="oe-stadt-name">
                {LAND[id as LandId].hauptstadt}
              </text>
            )}
          </g>
        ))}
      {modus === "land" && richtig && (
        <text x={LAND_PFADE[richtig].mitte[0]} y={LAND_PFADE[richtig].mitte[1] + (richtig === "w" ? -40 : 8)} className="oe-land-name">
          {LAND[richtig as LandId].name}
        </text>
      )}
    </svg>
  );
}

/** Kleine Karte: ein Land hervorgehoben (erobert: in seinen Farben). */
function MiniKarte({ land, erobert }: { land: LandId; erobert?: boolean }) {
  return (
    <svg viewBox={`0 0 ${KARTE_BREITE} ${KARTE_HOEHE}`} className="oe-mini" aria-hidden>
      <Muster />
      {BUNDESLAENDER.map((b) => (
        <path key={b.id} d={LAND_PFADE[b.id].d} className="oe-mini-land" data-an={b.id === land ? "" : undefined} style={b.id === land ? { fill: erobert ? `url(#oe-farben-${b.id})` : LEVEL_FARBE[b.id] } : undefined} />
      ))}
      {land === "w" && <circle cx={LAND_PFADE.w.mitte[0]} cy={LAND_PFADE.w.mitte[1]} r={26} className="oe-mini-wien" />}
    </svg>
  );
}

/** Altersaufbaudiagramm Österreich 2023 (Buch S. 11): links Männer, rechts Frauen; Balken antippen. */
function Pyramide({ ziel, getippt, gesperrt, onTipp, klein }: { ziel?: string[] | null; getippt?: string | null; gesperrt?: boolean; onTipp?: (id: string) => void; klein?: boolean }) {
  const B = 360;
  const mitte = 36;
  const halb = (B - mitte) / 2;
  const max = 360000;
  const h = 15;
  const oben = 18;
  const zeilen = [...ALTERSAUFBAU].reverse();
  const H = oben + zeilen.length * h + 6;
  const trifft = (id: string) => !!ziel && balkenTrifft(ziel, id);
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="oe-pyramide" data-klein={klein ? "" : undefined} data-testid="oe-pyramide" role="group" aria-label="Altersaufbaudiagramm Österreich 2023">
      <text x={halb / 2} y={12} className="oe-pyr-kopf">
        Männer
      </text>
      <text x={B - halb / 2} y={12} className="oe-pyr-kopf">
        Frauen
      </text>
      {zeilen.map((z, i) => {
        const y = oben + i * h;
        const wm = (z.m / max) * (halb - 4);
        const wf = (z.f / max) * (halb - 4);
        const idm = `m${z.ab}`;
        const idf = `f${z.ab}`;
        return (
          <g key={z.ab}>
            {[
              { id: idm, x: halb - wm, w: wm, seite: "m" },
              { id: idf, x: halb + mitte, w: wf, seite: "f" },
            ].map((b) => (
              <g key={b.id} className="oe-balken" data-seite={b.seite} data-richtig={ziel && trifft(b.id) ? "" : undefined} data-falsch={getippt === b.id && ziel && !trifft(b.id) ? "" : undefined} onClick={() => !gesperrt && onTipp?.(b.id)} data-testid={`oe-balken-${b.id}`}>
                <rect x={b.seite === "m" ? 0 : halb + mitte} y={y} width={halb} height={h} className="oe-balken-flaeche" />
                <rect x={b.x} y={y + 1.5} width={Math.max(1, b.w)} height={h - 3} rx={2} className="oe-balken-wert" />
              </g>
            ))}
            <text x={halb + mitte / 2} y={y + h - 3.5} className="oe-pyr-alter">
              {z.ab}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Zum Schreiben: die Karte ohne Namen, ein Bundesland markiert oder ein roter Punkt an einer Landeshauptstadt. */
function ZeigeKarte({ land, stadt }: { land?: LandId; stadt?: LandId }) {
  return (
    <svg viewBox={`0 0 ${KARTE_BREITE} ${KARTE_HOEHE}`} className="oe-svg oe-frage-svg" aria-hidden data-testid="oe-zeigekarte">
      {BUNDESLAENDER.map((b) => (
        <path key={b.id} d={LAND_PFADE[b.id].d} className="oe-land oe-zeige" data-markiert={b.id === land ? "" : undefined} />
      ))}
      <path d={BEZIRKSGRENZEN} className="oe-bezirke" />
      {land === "w" && <circle cx={LAND_PFADE.w.mitte[0]} cy={LAND_PFADE.w.mitte[1]} r={WIEN_KREIS} className="oe-wien-markiert" />}
      {stadt && (
        <g className="oe-stadt" data-markiert="">
          <circle cx={STADT_ORTE[stadt][0]} cy={STADT_ORTE[stadt][1]} r={16} />
        </g>
      )}
    </svg>
  );
}
