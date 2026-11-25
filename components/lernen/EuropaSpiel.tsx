"use client";

import "./lernspiel.css";
import "./phantombild.css";
import "./blaetter.css";
import "./europa.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Compass, Flame, Map as MapIcon, PenLine, Shuffle, Star, Timer, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { europaStartenAction, spielBeendenAction, tabletEuropaStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import { flagge, frageText, geschriebenAls, gross, land, LAENDER, LAENDER_JE_RUNDE, lageText, landVonName, note, paarTipp, pruefeGeschrieben, REGIONEN, RENNEN_SEKUNDEN, TEIL_NAME, TEILE, type EuropaModus, type EuropaThema, type Land, type LandStand, type Region, type Teil } from "@/lib/europa";
import type { SpielErgebnis, SpielKarte } from "@/lib/lernspiele-typen";
import { EuropaKarte, type Zustand } from "./EuropaKarte";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { Hintergrund, Konfetti } from "./Lernspiel";
import { vibriere } from "./SpielTeile";
import { useSpielstand } from "./spielstand";
import { WeiterKnopf } from "./WeiterKnopf";

/**
 * Europa (lib/europa.ts, docs/lernspiele.md „Europa“): Länder, Hauptstädte und Flaggen auf einer echten Karte.
 * Je Land drei Teile (Lage, Hauptstadt, Flagge); sitzen alle drei, ist das Land erobert und die Karte färbt sich.
 *
 * - **Üben**: gemischte Fragen, auf der Karte tippen, aus vier wählen, Flaggen wählen. Acht Länder.
 * - **Wie im Test**: Namen und Hauptstädte selbst schreiben, ein kleiner Tippfehler zählt mit Hinweis.
 * - **Rennen**: 60 Sekunden, so viele wie möglich (Länder antippen, Hauptstädte oder Flaggen), mit eigenem Rekord.
 * - **Verwechsler**: die Paare, die man verwechselt (sonst typische wie Slowakei und Slowenien), nebeneinander.
 * - **Großer Test**: alle Länder (oder eine Region) einmal, mit Note.
 * - **Karte erkunden**: ein Land antippen und Name, Hauptstadt und Flagge sehen.
 *
 * Ein Fehler zeigt die Lösung auf der Karte und eine Hilfe; die Karte kommt drei Karten später noch einmal
 * (nicht im großen Test und im Rennen). Gezählt wird der erste Versuch.
 */

type Phase = "start" | "laden" | "spiel" | "ende" | "erkunden";
type Wunsch = { modus: Exclude<EuropaModus, "duell">; thema?: EuropaThema; region?: Region };
type Runde = { rundeId: number; karten: SpielKarte[]; wunsch: Wunsch };
/** Eine angefangene Runde zum Weiterspielen (components/lernen/spielstand.ts); das Rennen nicht (es läuft gegen die Zeit). */
type EuStand = { v: 1; runde: Runde; reihe: SpielKarte[]; pos: number; antworten: [string, string][]; wieder: [string, number][]; folge: number; beste: number; daneben: { karte: SpielKarte; wahl: string }[] };
const istEuStand = (x: unknown): x is EuStand => {
  const s = x as EuStand | null;
  return !!s && s.v === 1 && !!s.runde && Number.isInteger(s.runde.rundeId) && s.runde.wunsch?.modus !== "rennen" && Array.isArray(s.reihe) && s.reihe.length > 0 && Number.isInteger(s.pos) && Array.isArray(s.antworten);
};
const EU_MODUS_NAME: Record<string, string> = { ueben: "Üben", test: "Wie im Test", gross: "Großer Test", verwechsler: "Verwechsler" };
type Wahl = { wert: string; ok: boolean; code?: string };
type Hilfe = { karte: SpielKarte; art: "falsch" | "fast"; eingabe?: string; gewaehlt?: string };

const DEKO = ["Wien", "Paris", "Rom", "Oslo"];
/** Eine falsche Karte kommt so viele Karten später wieder. */
const WIEDER_NACH = 3;
const COUNTDOWN = 3;

export function EuropaSpiel({
  token,
  amTablet,
  serie: serieAnfang,
  sitzt: sitztAnfang,
  rekorde: rekordeAnfang,
  eigeneVerwechsler,
  grund,
  zurueck: zurueckZiel,
}: {
  token: string;
  amTablet?: boolean;
  serie: number;
  /** je Land die Teile, die schon sitzen */
  sitzt: LandStand;
  /** bester Stand je Rennen */
  rekorde: Record<Teil, number>;
  /** wie viele Paare der Schüler selbst verwechselt */
  eigeneVerwechsler: number;
  /** warum es gerade passt („Geografie-Test in 5 Tagen“) */
  grund?: string;
  zurueck?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (w: Wunsch) => (amTablet ? tabletEuropaStartenAction(w) : europaStartenAction(token, w)),
      beenden: (id: number, antworten: { key: string; wahl: string }[], teil: boolean) =>
        amTablet ? tabletSpielBeendenAction(id, antworten, { teil }) : spielBeendenAction(token, id, antworten, { teil }),
    }),
    [amTablet, token],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;

  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [sitzt, setSitzt] = useState<LandStand>(sitztAnfang);
  const [sitztVorher, setSitztVorher] = useState<LandStand>(sitztAnfang);
  const [rekorde, setRekorde] = useState(rekordeAnfang);
  const [runde, setRunde] = useState<Runde | null>(null);
  const [reihe, setReihe] = useState<SpielKarte[]>([]);
  const [pos, setPos] = useState(0);
  const [wahl, setWahl] = useState<Wahl | null>(null);
  const [hilfe, setHilfe] = useState<Hilfe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [folge, setFolge] = useState(0);
  const [beste, setBeste] = useState(0);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<{ karte: SpielKarte; wahl: string }[]>([]);
  const [endeUm, setEndeUm] = useState(0);
  const [jetzt, setJetzt] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [alleNamen, setAlleNamen] = useState(false);

  const antworten = useRef(new Map<string, string>());
  const wieder = useRef(new Map<string, number>());
  const reduziert = useRef(false);
  const feld = useRef<HTMLInputElement | null>(null);
  const beendet = useRef(false);

  // angefangene Runde merken und weiterspielen (niko 2026-11-25: „es soll den Stand halten“); am Tablet für den Schüler der Einheit
  const spielstand = useSpielstand<EuStand>("europa", amTablet ? "" : token);
  const offenesSpiel = spielstand.offen && istEuStand(spielstand.offen.stand) ? spielstand.offen.stand : null;
  const merkeSpiel = spielstand.merke;
  const vergissSpiel = spielstand.vergiss;
  useEffect(() => {
    if (phase !== "spiel" || !runde || runde.wunsch.modus === "rennen" || !reihe.length) return;
    merkeSpiel({ v: 1, runde, reihe, pos, antworten: [...antworten.current.entries()], wieder: [...wieder.current.entries()], folge, beste, daneben }, [runde.rundeId]);
  }, [phase, runde, reihe, pos, folge, beste, daneben, wahl, merkeSpiel]);
  const fortsetzen = (g: EuStand) => {
    antworten.current = new Map(g.antworten.filter((a) => Array.isArray(a) && typeof a[0] === "string" && typeof a[1] === "string"));
    wieder.current = new Map(Array.isArray(g.wieder) ? g.wieder : []);
    beendet.current = false;
    setFehler(null);
    setRunde(g.runde);
    setReihe(g.reihe);
    setPos(Math.max(0, Math.min(g.pos, g.reihe.length - 1)));
    setWahl(null);
    setHilfe(null);
    setEingabe("");
    setFolge(g.folge || 0);
    setBeste(g.beste || 0);
    setErgebnis(null);
    setDaneben(Array.isArray(g.daneben) ? g.daneben : []);
    setSitztVorher(sitzt);
    setPhase("spiel");
  };

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

  const karte = reihe[pos] ?? null;
  const daten = karte?.europa ?? null;
  const l = daten ? land(daten.land)! : null;
  const modus = runde?.wunsch.modus ?? "ueben";
  const rennen = modus === "rennen";

  const starten = useCallback(
    async (w: Wunsch) => {
      setPhase("laden");
      setFehler(null);
      const r = await server.starten(w);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setPhase("start");
        return;
      }
      antworten.current = new Map();
      wieder.current = new Map();
      beendet.current = false;
      setRunde({ rundeId: r.rundeId, karten: r.karten, wunsch: w });
      setReihe(r.karten);
      setPos(0);
      setWahl(null);
      setHilfe(null);
      setEingabe("");
      setFolge(0);
      setBeste(0);
      setErgebnis(null);
      setDaneben([]);
      setSitztVorher(sitzt);
      if (w.modus === "rennen") {
        const t = Date.now();
        setJetzt(t);
        setEndeUm(t + (COUNTDOWN + RENNEN_SEKUNDEN) * 1000);
      }
      setPhase("spiel");
    },
    [server, sitzt],
  );

  const fertig = useCallback(async () => {
    if (!runde || beendet.current) return;
    beendet.current = true;
    setPhase("ende");
    const liste = [...antworten.current.entries()].map(([key, w]) => ({ key, wahl: w }));
    const gezaehlt = runde.wunsch.modus === "rennen" ? runde.karten.filter((k) => antworten.current.has(k.key)) : runde.karten;
    const richtig = gezaehlt.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    spiele((k) => (richtig / Math.max(1, gezaehlt.length) >= 0.7 ? k.frei() : k.aus()));
    const e = await server.beenden(runde.rundeId, liste, runde.wunsch.modus === "rennen").catch(() => ({ fehler: "Die Verbindung ist weg. Lade die Seite neu, dein Stand ist gemerkt." }));
    setErgebnis(e);
    if (!("fehler" in e)) vergissSpiel();
    if (!("fehler" in e) && e.europa) {
      setSitzt(e.europa.sitzt);
      const r = e.europa.rekord;
      if (r) {
        if (richtig > r.vorher) spiele((k) => k.rekord());
        setRekorde((alt) => ({ ...alt, [r.thema]: Math.max(alt[r.thema], richtig) }));
      }
    }
    router.refresh();
  }, [runde, server, router, spiele, vergissSpiel]);

  /** Weiter zur nächsten Karte (eine falsche kommt `WIEDER_NACH` Karten später noch einmal, außer im Test und Rennen). */
  const weiter = useCallback(
    (nochmal?: SpielKarte) => {
      setWahl(null);
      setHilfe(null);
      setEingabe("");
      let neu = reihe;
      if (nochmal && modus !== "gross" && modus !== "rennen" && (wieder.current.get(nochmal.key) ?? 0) < 2) {
        wieder.current.set(nochmal.key, (wieder.current.get(nochmal.key) ?? 0) + 1);
        neu = [...reihe];
        neu.splice(Math.min(neu.length, pos + 1 + WIEDER_NACH), 0, nochmal);
        setReihe(neu);
      }
      if (pos + 1 >= neu.length) void fertig();
      else setPos(pos + 1);
    },
    [reihe, pos, fertig, modus],
  );

  /** Eine Antwort: `wert` ist das, was zählt (bei „fast“ schon die richtige Schreibweise). */
  const antworte = useCallback(
    (wert: string, o: { fast?: boolean; eingabe?: string; code?: string } = {}) => {
      if (!karte || !daten || wahl || hilfe || phase !== "spiel") return;
      if (rennen && jetzt < endeUm - RENNEN_SEKUNDEN * 1000) return;
      const erste = !antworten.current.has(karte.key);
      if (erste) antworten.current.set(karte.key, wert);
      const ok = wert === karte.richtig;
      setWahl({ wert: o.eingabe ?? wert, ok, code: o.code });
      if (ok) {
        if (erste) {
          setFolge((f) => {
            const n = f + 1;
            setBeste((b) => Math.max(b, n));
            return n;
          });
        }
        spiele((k) => k.richtig(erste && folge >= 2));
        vibriere(12);
        if (o.fast) setHilfe({ karte, art: "fast", eingabe: o.eingabe });
        return;
      }
      setFolge(0);
      if (erste) setDaneben((d) => [...d, { karte, wahl: o.eingabe ?? wert }]);
      spiele((k) => k.falsch());
      vibriere([40, 60, 40]);
      // im Rennen keine Hilfe: kurz die Lösung zeigen, dann weiter
      if (!rennen) setHilfe({ karte, art: "falsch", eingabe: o.eingabe, gewaehlt: o.code ?? landVonName(wert)?.code });
    },
    [karte, daten, wahl, hilfe, phase, rennen, jetzt, endeUm, spiele, folge],
  );

  // richtig (und im Rennen auch falsch): kurz zeigen, dann weiter
  useEffect(() => {
    if (!wahl || hilfe) return;
    if (!wahl.ok && !rennen) return;
    const dauer = reduziert.current ? 300 : rennen ? (wahl.ok ? 260 : 900) : daten?.teil === "hauptstadt" ? 1000 : daten?.antwort === "karte" ? 800 : 650;
    const t = window.setTimeout(() => weiter(), dauer);
    return () => window.clearTimeout(t);
  }, [wahl, hilfe, weiter, daten, rennen]);

  // Rennen: die Uhr
  useEffect(() => {
    if (phase !== "spiel" || !rennen) return;
    const t = window.setInterval(() => setJetzt(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [phase, rennen]);
  useEffect(() => {
    if (phase === "spiel" && rennen && endeUm && jetzt >= endeUm) void fertig();
  }, [phase, rennen, jetzt, endeUm, fertig]);

  // Schreiben: das Feld bekommt den Fokus
  useEffect(() => {
    if (phase === "spiel" && daten?.antwort === "schreiben" && !hilfe && !wahl) feld.current?.focus({ preventScroll: true });
  }, [phase, daten, hilfe, wahl, pos]);

  // am Laptop: Ziffern 1–4 für Kacheln und Flaggen, Eingabe für „Weiter“
  useEffect(() => {
    if (phase !== "spiel") return;
    const taste = (e: KeyboardEvent) => {
      if (hilfe && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        weiter(hilfe.art === "falsch" ? hilfe.karte : undefined);
        return;
      }
      if (!karte || (daten?.antwort !== "kacheln" && daten?.antwort !== "flaggen") || wahl) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < karte.faecher.length) antworte(karte.faecher[i]);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [phase, hilfe, karte, daten, wahl, weiter, antworte]);

  const schreiben = (e: FormEvent) => {
    e.preventDefault();
    if (!karte || !daten || !l || wahl || hilfe) return;
    const text = eingabe.trim();
    if (!text) return;
    const was = daten.frage === "stadt" ? "stadt" : "land";
    const r = pruefeGeschrieben(text, l, was);
    if (r === "falsch") antworte(geschriebenAls(text, was), { eingabe: text });
    else antworte(karte.richtig, { fast: r === "fast", eingabe: text });
  };

  const tippen = useCallback(
    (code: string) => {
      const x = land(code);
      if (x) antworte(x.name, { code });
    },
    [antworte],
  );

  const restSek = rennen ? Math.max(0, Math.ceil((endeUm - jetzt) / 1000)) : 0;
  const imCountdown = rennen && restSek > RENNEN_SEKUNDEN;

  const kopf = (
    <div className="ls-kopf">
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" && runde ? (
        rennen ? (
          <>
            <span className="pb-fortschritt eu-uhr" role="timer" aria-label={`${Math.min(RENNEN_SEKUNDEN, restSek)} Sekunden`} data-knapp={restSek <= 10 ? "" : undefined}>
              <i style={{ width: `${Math.round((Math.min(RENNEN_SEKUNDEN, restSek) / RENNEN_SEKUNDEN) * 100)}%` }} />
            </span>
            <span className="ls-combo eu-zahl" aria-label={`${zaehleRichtig()} richtig`} data-testid="eu-rennen-zahl">
              <Timer size={16} aria-hidden />
              <b>{Math.min(RENNEN_SEKUNDEN, restSek)}</b>
            </span>
          </>
        ) : (
          <>
            <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={reihe.length} aria-valuenow={pos} aria-label="Fortschritt">
              <i style={{ width: `${Math.round((pos / Math.max(1, reihe.length)) * 100)}%` }} />
            </span>
            <span className="ls-combo bl-folge" data-heiss={folge >= 3 ? "" : undefined} aria-label={`${folge} richtig in Folge`} data-testid="eu-folge">
              <Zap size={16} aria-hidden />
              <b key={folge}>{folge}</b>
            </span>
          </>
        )
      ) : (
        <span className="flex-1" />
      )}
      <button type="button" className="ls-zu treffer" onClick={() => setzeTon(!ton)} aria-pressed={!ton} aria-label={ton ? "Töne ausschalten" : "Töne einschalten"}>
        {ton ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}
      </button>
    </div>
  );

  function zaehleRichtig() {
    return [...antworten.current.entries()].filter(([key, w]) => reihe.find((k) => k.key === key)?.richtig === w).length;
  }

  const regionCodes = region ? LAENDER.filter((x) => x.region === region).map((x) => x.code) : null;
  const anzahlLaender = regionCodes?.length ?? LAENDER.length;

  // ---------- Start ----------

  if (phase === "start" || phase === "laden") {
    const laedt = phase === "laden";
    return (
      <div className="ls pb eu" role="dialog" aria-modal="true" aria-label="Lernspiel Europa">
        <Hintergrund woerter={DEKO} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel · Geografie
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            Europa
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            Länder, Hauptstädte und Flaggen. Ein Land ist erobert, wenn alle drei sitzen.
          </p>
          {offenesSpiel && <WeiterKnopf className="mt-4" text={`${EU_MODUS_NAME[offenesSpiel.runde.wunsch.modus ?? "ueben"] ?? "Üben"} · Karte ${Math.min(offenesSpiel.pos + 1, offenesSpiel.reihe.length)} von ${offenesSpiel.reihe.length}`} onClick={() => fortsetzen(offenesSpiel)} disabled={laedt} />}
          {grund && (
            <span className="ls-grund mt-2" style={{ "--n": 2 } as CSSProperties} data-testid="eu-grund">
              <Star size={16} aria-hidden />
              {grund}
            </span>
          )}
          <Sammlung sitzt={sitzt} n={2} onOeffnen={() => setPhase("erkunden")} />

          <div className="eu-regionen mt-4" role="radiogroup" aria-label="Welche Länder" style={{ "--n": 3 } as CSSProperties}>
            <button type="button" role="radio" aria-checked={!region} className="eu-region" onClick={() => setRegion(null)} data-testid="eu-region-alle">
              Ganz Europa
            </button>
            {REGIONEN.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={region === r.id} className="eu-region" onClick={() => setRegion(r.id)} data-testid={`eu-region-${r.id}`}>
                {r.name}
              </button>
            ))}
          </div>

          <div className="pb-wahl mt-4" style={{ "--n": 4 } as CSSProperties}>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten({ modus: "ueben", region: region ?? undefined })} disabled={laedt} data-testid="eu-start-ueben">
              <MapIcon size={26} aria-hidden />
              <span>
                <b>Üben</b>
                <small>Auf der Karte tippen, Hauptstädte und Flaggen wählen. {Math.min(LAENDER_JE_RUNDE, anzahlLaender)} Länder.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten({ modus: "test", region: region ?? undefined })} disabled={laedt} data-testid="eu-start-test">
              <PenLine size={26} aria-hidden />
              <span>
                <b>Wie im Test</b>
                <small>Länder und Hauptstädte selbst schreiben. {Math.min(LAENDER_JE_RUNDE, anzahlLaender)} Länder.</small>
              </span>
            </button>
            <div className="pb-wahl-knopf">
              <Timer size={26} aria-hidden />
              <span>
                <b>60-Sekunden-Rennen</b>
                <small>So viele wie möglich. Dein Rekord steht darunter.</small>
                <span className="eu-unterwahl">
                  {TEILE.map((t) => (
                    <button key={t} type="button" className="eu-unterknopf" onClick={() => void starten({ modus: "rennen", thema: t, region: region ?? undefined })} disabled={laedt} data-testid={`eu-start-rennen-${t}`}>
                      {t === "lage" ? "Länder" : t === "hauptstadt" ? "Hauptstädte" : "Flaggen"}
                      <small>{rekorde[t] ? `Rekord ${rekorde[t]}` : "Neu"}</small>
                    </button>
                  ))}
                </span>
              </span>
            </div>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten({ modus: "verwechsler" })} disabled={laedt} data-testid="eu-start-verwechsler">
              <Shuffle size={26} aria-hidden />
              <span>
                <b>Verwechsler</b>
                <small>
                  {eigeneVerwechsler > 0
                    ? `${eigeneVerwechsler === 1 ? "Ein Paar" : `${eigeneVerwechsler} Paare`}, die du verwechselt hast, direkt nebeneinander.`
                    : "Slowakei oder Slowenien? Paare, die viele verwechseln, direkt nebeneinander."}
                </small>
              </span>
            </button>
            <div className="pb-wahl-knopf">
              <Star size={26} aria-hidden />
              <span>
                <b>Großer Test</b>
                <small>
                  {region ? `Alle ${anzahlLaender} Länder (${REGIONEN.find((r) => r.id === region)?.name})` : `Alle ${LAENDER.length} Länder`} einmal, selbst schreiben, mit Note.
                </small>
                <span className="eu-unterwahl" data-vier="">
                  {(["lage", "hauptstadt", "flagge", "alles"] as const).map((t) => (
                    <button key={t} type="button" className="eu-unterknopf" onClick={() => void starten({ modus: "gross", thema: t, region: region ?? undefined })} disabled={laedt} data-testid={`eu-start-gross-${t}`}>
                      {t === "lage" ? "Länder" : t === "hauptstadt" ? "Hauptstädte" : t === "flagge" ? "Flaggen" : "Gemischt"}
                    </button>
                  ))}
                </span>
              </span>
            </div>
            <button type="button" className="pb-wahl-knopf" onClick={() => setPhase("erkunden")} disabled={laedt} data-testid="eu-erkunden">
              <Compass size={26} aria-hidden />
              <span>
                <b>Karte erkunden</b>
                <small>Tipp ein Land an: Name, Hauptstadt und Flagge. Zum Lernen, zählt nicht.</small>
              </span>
            </button>
          </div>
          <div className="ls-glas mt-4 flex items-center justify-between gap-4 p-4" style={{ "--n": 5 } as CSSProperties}>
            <p className="ls-klein">Serie</p>
            <p className="flex items-center gap-1.5 text-[20px] font-semibold tabular-nums">
              <Flame size={20} className={serieAnfang > 0 ? "ls-flamme" : "opacity-60"} fill={serieAnfang > 0 ? "currentColor" : "none"} aria-hidden />
              {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
            </p>
          </div>
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
          {laedt && <p className="ls-klein mt-4 text-center">Die Karte kommt …</p>}
        </div>
      </div>
    );
  }

  // ---------- Erkunden ----------

  if (phase === "erkunden") {
    const g = gewaehlt ? land(gewaehlt)! : null;
    const farbe: Record<string, Zustand | undefined> = {};
    for (const [c, t] of Object.entries(sitzt)) farbe[c] = t.length === 3 ? "erobert" : "teil";
    if (g) farbe[g.code] = "gewaehlt";
    return (
      <div className="ls pb eu" role="dialog" aria-modal="true" aria-label="Karte erkunden">
        {kopf}
        <div className="eu-spiel" data-erkunden="">
          <EuropaKarte
            farbe={farbe}
            onTipp={(c) => setGewaehlt(c)}
            stadt={g ? { code: g.code, name: g.hauptstadt } : null}
            namen={alleNamen ? Object.fromEntries(LAENDER.map((x) => [x.code, x.name])) : undefined}
            fokus={g ? [g.code] : null}
            fokusKey={g?.code}
            start={regionCodes}
            label="Karte von Europa: tipp ein Land an"
          />
          <div className="eu-unten">
            {g ? (
              <div className="ls-blatt eu-steckbrief" data-testid="eu-steckbrief">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="eu-flagge-klein" src={flagge(g.code)} alt={`Flagge ${g.von.replace(/^von /, "")}`} />
                <div className="min-w-0 flex-1">
                  <p className="eu-steckbrief-name">{g.name}</p>
                  <p className="eu-steckbrief-stadt">Hauptstadt: {g.hauptstadt}</p>
                  <p className="ls-klein-dunkel mt-1">{lageText(g)}</p>
                  <StandPunkte teile={sitzt[g.code] ?? []} />
                </div>
              </div>
            ) : (
              <p className="eu-hinweis">Tipp ein Land an. Mit zwei Fingern zoomen.</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" className="ls-knopf eu-knopf-klein" data-zweit="" aria-pressed={alleNamen} onClick={() => setAlleNamen((a) => !a)} data-testid="eu-namen">
                {alleNamen ? "Namen ausblenden" : "Alle Namen zeigen"}
              </button>
              <button type="button" className="ls-knopf eu-knopf-klein" onClick={() => setPhase("start")}>
                Zurück
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ende ----------

  if (phase === "ende" && runde) {
    const gezaehlt = rennen ? runde.karten.filter((k) => antworten.current.has(k.key)) : runde.karten;
    const anzahl = gezaehlt.length;
    const richtig = gezaehlt.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    const anteil = anzahl ? richtig / anzahl : 0;
    const sterne = anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : 1;
    const neuErobert = Object.entries(sitzt)
      .filter(([c, t]) => t.length === 3 && (sitztVorher[c]?.length ?? 0) < 3)
      .map(([c]) => c);
    const rekord = ergebnis && !("fehler" in ergebnis) ? ergebnis.europa?.rekord : undefined;
    const neuerRekord = !!rekord && richtig > rekord.vorher;
    const n = modus === "gross" ? note(richtig, anzahl) : null;
    return (
      <div className="ls pb eu" role="dialog" aria-modal="true" aria-label="Runde vorbei">
        <Hintergrund woerter={DEKO} />
        {(sterne >= 2 || neuerRekord || neuErobert.length > 0) && !rennen && <Konfetti />}
        {neuerRekord && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center">
          {rennen ? (
            <div className="eu-rennen-ende" style={{ "--n": 0 } as CSSProperties} data-testid="eu-ende">
              <p className="ls-oberzeile">{runde.wunsch.thema === "hauptstadt" ? "Hauptstädte" : runde.wunsch.thema === "flagge" ? "Flaggen" : "Länder"} in 60 Sekunden</p>
              <b className="eu-rennen-zahl" data-testid="eu-ende-richtig">
                {richtig}
              </b>
              <p className="ls-text">{richtig === 1 ? "richtige Antwort" : "richtige Antworten"}{anzahl > richtig ? ` · ${anzahl - richtig} daneben` : ""}</p>
              {ergebnis && rekord && (
                <p className="eu-rekord mt-3" data-neu={neuerRekord ? "" : undefined} data-testid="eu-rekord">
                  {neuerRekord ? (rekord.vorher > 0 ? `Neuer Rekord! Vorher ${rekord.vorher}` : "Dein erster Rekord!") : `Dein Rekord: ${rekord.vorher}`}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="eu-ende">
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
                  <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - Math.round(anteil * 100) } as CSSProperties} />
                </svg>
                <div className="ls-ring-zahl" data-lang={3}>
                  <b data-testid="eu-ende-richtig">{richtig}</b>
                  <span>von {anzahl}</span>
                </div>
              </div>
              {n ? (
                <div className="eu-note" style={{ "--n": 1 } as CSSProperties} data-note={n.note} data-testid="eu-note">
                  <b>{n.note}</b>
                  <span>{n.wort}</span>
                </div>
              ) : (
                <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`}>
                  {[0, 1, 2].map((i) => (
                    <Star key={i} size={i === 1 ? 44 : 34} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" style={{ "--n": i } as CSSProperties} aria-hidden />
                  ))}
                </div>
              )}
              <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
                {n ? (n.note <= 2 ? "Stark!" : n.note <= 4 ? "Geschafft!" : "Weiter üben!") : anteil >= 0.9 ? "Super!" : anteil >= 0.7 ? "Gut gemacht!" : "Weiter üben!"}
              </h1>
              <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
                {richtig} von {anzahl} beim ersten Versuch richtig{beste >= 3 ? ` · ${beste} in Folge` : ""}
              </p>
            </>
          )}
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          {neuErobert.length > 0 && (
            <p className="eu-erobert-neu mt-4" style={{ "--n": 2 } as CSSProperties} data-testid="eu-neu-erobert">
              <Check size={18} strokeWidth={3} aria-hidden /> Neu erobert: {neuErobert.map((c) => land(c)!.name).join(", ")}
            </p>
          )}
          <Sammlung sitzt={sitzt} n={2} laedt={!ergebnis} neu={neuErobert} />
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 3 } as CSSProperties} data-testid="eu-daneben">
              <p className="text-[15px] font-semibold">Schau dir diese noch einmal an</p>
              <ul className="eu-daneben mt-3">
                {daneben.slice(0, 20).map(({ karte: k, wahl: w }, i) => {
                  const x = land(k.europa!.land)!;
                  return (
                    <li key={`${k.key}-${i}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flagge(x.code)} alt="" />
                      <span>
                        <b>
                          {x.name} · {x.hauptstadt}
                        </b>
                        <small>
                          {TEIL_NAME[k.europa!.teil]}: {w ? <>du: <s>{w}</s></> : "nicht gewusst"}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 4 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten(runde.wunsch)} disabled={!ergebnis} autoFocus data-testid="eu-nochmal">
              Nochmal
            </button>
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("start")}>
              Anders spielen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------

  if (!karte || !daten || !l) return null;
  const beantwortet = !!wahl;
  const falschCode = wahl && !wahl.ok ? (wahl.code ?? landVonName(wahl.wert)?.code) : undefined;
  const farbe: Record<string, Zustand | undefined> = {};
  const zeigtLand = daten.frage === "welches" || daten.frage === "stadt" || daten.frage === "landFlagge";
  if (zeigtLand) farbe[l.code] = "markiert";
  if (beantwortet) {
    if (falschCode && falschCode !== l.code) farbe[falschCode] = "falsch";
    farbe[l.code] = wahl.ok ? "richtig" : "loesung";
  }
  const fokus = beantwortet && !wahl.ok ? [l.code, ...(falschCode && falschCode !== l.code ? [falschCode] : [])] : zeigtLand ? [l.code] : null;
  const fokusKey = `${pos}-${beantwortet ? (wahl.ok ? "r" : "f") : "q"}`;
  const zeigeStadt = daten.teil === "hauptstadt" && beantwortet;
  const tippbar = daten.antwort === "karte" && !beantwortet && !imCountdown;
  const frage = frageText(l, daten.frage);
  const mitFlagge = daten.frage === "flaggeLand";
  const tipp = daten.tipp ?? (hilfe?.gewaehlt ? paarTipp(daten.teil, l.code, hilfe.gewaehlt) : undefined);

  return (
    <div className="ls pb eu" role="dialog" aria-modal="true" aria-label="Europa" data-antwort={daten.antwort}>
      {kopf}
      <div className="eu-spiel">
        <EuropaKarte
          farbe={farbe}
          onTipp={tippbar ? tippen : undefined}
          fokus={fokus}
          fokusKey={fokusKey}
          start={regionCodes ?? (runde?.wunsch.modus === "verwechsler" ? null : null)}
          stadt={zeigeStadt ? { code: l.code, name: l.hauptstadt } : null}
          label={daten.antwort === "karte" ? "Karte von Europa: tipp das Land an" : "Karte von Europa"}
        />
        <div className="eu-unten" key={`${karte.key}-${pos}`}>
          <div className="eu-frage-zeile">
            {mitFlagge && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="eu-flagge-gross" src={flagge(l.code)} alt="Eine Flagge" draggable={false} data-testid="eu-flagge-frage" />
            )}
            <p className="pb-frage eu-frage" data-testid="eu-frage" data-teil={daten.teil}>
              {daten.antwort === "karte" && daten.frage === "flaggeLand" ? "Wo liegt das Land mit dieser Flagge?" : frage}
              {daten.antwort === "karte" && <span className="eu-auftrag">Tipp auf der Karte.</span>}
            </p>
          </div>
          {daten.antwort === "kacheln" && (
            <div className="pb-antworten eu-antworten" data-anzahl={karte.faecher.length}>
              {karte.faecher.map((f, i) => (
                <button
                  key={`${karte.key}-${f}`}
                  type="button"
                  className="pb-antwort eu-antwort"
                  onClick={() => antworte(f)}
                  disabled={beantwortet || imCountdown}
                  data-richtig={wahl && f === karte.richtig ? "" : undefined}
                  data-falsch={wahl && !wahl.ok && f === wahl.wert ? "" : undefined}
                  data-testid="eu-antwort"
                  data-wert={f}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="eu-antwort-wort" data-lang={f.length > 16 ? "" : undefined}>
                    {f}
                  </span>
                </button>
              ))}
            </div>
          )}
          {daten.antwort === "flaggen" && (
            <div className="pb-antworten eu-antworten eu-flaggen" data-anzahl={karte.faecher.length}>
              {karte.faecher.map((f, i) => {
                const x = landVonName(f)!;
                return (
                  <button
                    key={`${karte.key}-${f}`}
                    type="button"
                    className="pb-antwort eu-flaggen-knopf"
                    onClick={() => antworte(f)}
                    disabled={beantwortet || imCountdown}
                    data-richtig={wahl && f === karte.richtig ? "" : undefined}
                    data-falsch={wahl && !wahl.ok && f === wahl.wert ? "" : undefined}
                    aria-label={wahl ? `Flagge von ${f}` : `Flagge ${i + 1}`}
                    aria-keyshortcuts={String(i + 1)}
                    data-testid="eu-antwort"
                    data-wert={f}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={flagge(x.code)} alt="" draggable={false} />
                    {wahl && (f === karte.richtig || f === wahl.wert) && <span className="eu-flaggen-name">{f}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {daten.antwort === "schreiben" && (
            <form className="bl-schreiben eu-schreiben" onSubmit={schreiben}>
              <input
                ref={feld}
                className="bl-feld"
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                disabled={beantwortet}
                data-ok={wahl ? (wahl.ok ? "" : "nein") : undefined}
                placeholder={daten.frage === "stadt" ? "Hauptstadt" : "Land"}
                aria-label={daten.frage === "stadt" ? "Hauptstadt" : "Name des Landes"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="done"
                maxLength={40}
                data-testid="eu-feld"
              />
              <div className="bl-schreiben-knoepfe">
                <button type="button" className="ls-knopf bl-weiss-nicht" data-zweit="" onClick={() => antworte("", { eingabe: "" })} disabled={beantwortet} data-testid="eu-weiss-nicht">
                  Weiß ich nicht
                </button>
                <button type="submit" className="ls-knopf bl-pruefen" disabled={beantwortet || !eingabe.trim()} data-testid="eu-pruefen">
                  Fertig
                </button>
              </div>
            </form>
          )}
          {daten.antwort === "karte" && wahl?.ok && <p className="eu-gut">{l.name}</p>}
          {rennen && wahl && !wahl.ok && <p className="eu-gut" data-falsch="">{karte.richtig}</p>}
        </div>
      </div>

      {imCountdown && (
        <div className="eu-countdown" aria-live="assertive" data-testid="eu-countdown">
          <b key={restSek}>{restSek - RENNEN_SEKUNDEN}</b>
        </div>
      )}

      {hilfe && (
        <div className="bl-hilfe eu-hilfe" role="alert" data-art={hilfe.art} data-testid="eu-hilfe">
          <div className="ls-blatt bl-hilfe-blatt">
            {hilfe.art === "fast" ? (
              <>
                <p className="bl-hilfe-titel">Fast! Achte auf die Schreibung</p>
                <p className="bl-hilfe-text">
                  Du: <s>{hilfe.eingabe}</s>
                  <br />
                  Richtig: <b>{hilfe.karte.richtig}</b>
                </p>
              </>
            ) : (
              <>
                <p className="bl-hilfe-titel">{hilfe.eingabe === "" ? "So heißt es" : "Nicht ganz"}</p>
                <HilfeText karte={hilfe.karte} l={l} eingabe={hilfe.eingabe} gewaehlt={hilfe.gewaehlt} wahl={wahl?.wert} />
                {tipp ? <p className="bl-merkmal eu-merk">{tipp}</p> : daten.teil === "lage" ? <p className="bl-merkmal eu-merk">{lageText(l)}</p> : null}
              </>
            )}
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => weiter(hilfe.art === "falsch" ? hilfe.karte : undefined)} autoFocus data-testid="eu-weiter">
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nach einem Fehler: was richtig ist, bei Flaggen beide Flaggen nebeneinander. */
function HilfeText({ karte, l, eingabe, gewaehlt, wahl }: { karte: SpielKarte; l: Land; eingabe?: string; gewaehlt?: string; wahl?: string }) {
  const d = karte.europa!;
  const anderes = gewaehlt && gewaehlt !== l.code ? land(gewaehlt) : undefined;
  if (d.teil === "flagge" && anderes) {
    return (
      <div className="eu-flaggen-vergleich mt-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flagge(l.code)} alt="" />
          <figcaption>
            <b>{l.name}</b>
          </figcaption>
        </figure>
        <figure data-falsch="">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flagge(anderes.code)} alt="" />
          <figcaption>
            <s>{anderes.name}</s>
          </figcaption>
        </figure>
      </div>
    );
  }
  const du = eingabe !== undefined ? eingabe : wahl;
  return (
    <p className="bl-hilfe-text">
      {du ? (
        <>
          Du: <s>{du}</s>
          <br />
        </>
      ) : null}
      Richtig: <b>{karte.richtig}</b>
      {d.teil === "hauptstadt" && d.frage === "stadt" && <span className="bl-hilfe-klein"> ({gross(l.name)})</span>}
      {d.antwort === "karte" && anderes && <span className="bl-hilfe-klein"> (rot: {anderes.name})</span>}
    </p>
  );
}

/** Drei Punkte: Lage, Hauptstadt, Flagge (gefüllt = sitzt). */
function StandPunkte({ teile }: { teile: Teil[] }) {
  return (
    <span className="eu-punkte mt-2">
      {TEILE.map((t) => (
        <span key={t} data-an={teile.includes(t) ? "" : undefined}>
          {teile.includes(t) && <Check size={12} strokeWidth={3} aria-hidden />}
          {TEIL_NAME[t]}
        </span>
      ))}
    </span>
  );
}

/** Deine Karte: eroberte Länder kräftig, angefangene hell. Antippen öffnet „Karte erkunden“. */
function Sammlung({ sitzt, n, laedt, neu, onOeffnen }: { sitzt: LandStand; n: number; laedt?: boolean; neu?: string[]; onOeffnen?: () => void }) {
  const farbe: Record<string, Zustand | undefined> = {};
  for (const [c, t] of Object.entries(sitzt)) farbe[c] = t.length === 3 ? (neu?.includes(c) ? "richtig" : "erobert") : "teil";
  const erobertZahl = Object.values(sitzt).filter((t) => t.length === 3).length;
  const je = (t: Teil) => Object.values(sitzt).filter((x) => x.includes(t)).length;
  const inhalt = (
    <>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">Deine Karte</span>
        <span className="ls-klein tabular-nums" data-testid="eu-erobert">
          {laedt ? "…" : `${erobertZahl} von ${LAENDER.length} erobert`}
        </span>
      </p>
      <div className="mt-3">
        <EuropaKarte farbe={farbe} klein label={`Deine Karte: ${erobertZahl} Länder erobert`} />
      </div>
      <p className="eu-sammlung-zahlen mt-2">
        {TEILE.map((t) => (
          <span key={t}>
            {TEIL_NAME[t]} <b className="tabular-nums">{laedt ? "…" : je(t)}</b>
          </span>
        ))}
      </p>
    </>
  );
  return onOeffnen ? (
    <button type="button" className="ls-glas eu-sammlung mt-4 p-4 text-left" style={{ "--n": n } as CSSProperties} onClick={onOeffnen} data-testid="eu-sammlung" aria-label={`Deine Karte, ${erobertZahl} von ${LAENDER.length} erobert. Antippen zum Erkunden.`}>
      {inhalt}
    </button>
  ) : (
    <div className="ls-glas eu-sammlung mt-4 p-4" style={{ "--n": n } as CSSProperties} data-testid="eu-sammlung">
      {inhalt}
    </div>
  );
}
