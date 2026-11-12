"use client";

import "./lernspiel.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Flame, Heart, Infinity as Endlos, Lightbulb, Star, Trophy, TrendingUp, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { spielBeendenAction, spielStartenAction, tabletSpielBeendenAction, tabletSpielStartenAction } from "@/app/lernspiel-actions";
import { ENDLOS_HERZEN, hatEndlos, REIHE_TRENNER, SPIEL_AUFGABE, SPIEL_DEKO, SPIEL_FACH, SPIEL_FORM, SPIEL_TITEL, sterneFuer, type SpielArt, type SpielErgebnis, type SpielForm, type SpielKarte, type SpielStart, type SpielVorschlag } from "@/lib/lernspiele-typen";
import { eingesetzt, gesetzt, haengt, hinterLuecke, KartenInhalt, ohneStrich, type Stand } from "./KartenInhalt";
import { LegeFeld } from "./LegeFeld";
import { PaarFeld } from "./PaarFeld";
import { KachelFeld } from "./KachelFeld";
import { SatzbauFeld } from "./SatzbauFeld";
import { StrahlFeld } from "./StrahlFeld";
import { WischFeld } from "./WischFeld";
import { ZiffernFeld } from "./ZiffernFeld";
import { MathText } from "@/components/MathText";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Ein Lernspiel der Schüler-App (lib/lernspiele.ts): Karten in Fächer werfen oder antippen. Wie eine Karte beantwortet
 * wird, steht auf ihr (`form`, lib/lernspiele-antwort.ts); jede andere Art als die Kisten hat ihr eigenes Spielfeld
 * (PaarFeld, SatzbauFeld, StrahlFeld, ZiffernFeld, LegeFeld, WischFeld, KachelFeld). Anfang, Ende, Zählen und Speichern
 * sind für alle Spiele dieselben.
 *
 * - Richtig: die Karte fliegt ins Fach, oben steht kurz der ganze richtige Satz (lernen beim Spielen).
 * - Falsch: die Lücke zeigt die Wahl durchgestrichen, das richtige Fach leuchtet, eine kurze Regel erscheint, und
 *   weiter geht es erst mit der richtigen Antwort. Die Karte kommt drei Karten später noch einmal.
 * - Gezählt wird nur die erste Wahl je Karte (der Server prüft sie, app/lernspiel-actions.ts).
 *
 * Ziehen läuft ohne React-Zustand je Bewegung (nur transform am Element), Fliegen über die Web Animations API.
 * Tasten 1 bis 5 wählen ein Fach am Laptop.
 *
 * Endlos-Modus (niko 2026-11-12): statt zwölf Karten geht es weiter, bis drei Herzen weg sind; jede falsche erste
 * Antwort kostet eines. Gespielt wird in gewöhnlichen Runden, die nahtlos aufeinander folgen: kurz vor dem Ende einer
 * Runde holt das Spiel die nächste, am Übergang wird die alte im Hintergrund beendet (lib/lernspiele.ts).
 */

/**
 * Für Duelle (components/lernen/Duell.tsx, lib/duelle.ts): eigener Start und eigenes Ende mit denselben Karten für beide,
 * jede erste Wahl geht sofort an den Server, das Ende zeigt das Duell statt der Sterne.
 */
export type DuellRahmen = {
  starten: () => Promise<SpielStart>;
  beenden: (rundeId: number, antworten: { key: string; wahl: string }[]) => Promise<SpielErgebnis>;
  ersteWahl?: (key: string, wahl: string) => void;
  fertig: (e: SpielErgebnis) => void;
  /** ohne Startseite gleich losspielen */
  sofort?: boolean;
  /** unter dem Kopf während des Spiels, z. B. der Gegner */
  leiste?: ReactNode;
  /** bis wann gespielt wird (ms); dann endet die Runde von selbst */
  bis?: number | null;
  zurueck?: string;
};

type Eintrag = { karte: SpielKarte; wiederholung: boolean };
type Phase = "start" | "laden" | "spiel" | "ende";
type Wurf = { x: number; y: number; r: number; s?: number };
const zugGroesse = (dy: number) => 1 - (Math.min(Math.max(dy, 0), 220) / 220) * 0.38;

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);

export function Lernspiel({
  token,
  art,
  vorschlaege,
  serie: serieAnfang,
  lernstand,
  duell,
  zurueck: zurueckZiel,
  woher,
  vorschau,
  antwort,
  rekord = 0,
  amTablet = false,
}: {
  /** der geheime Link des Schülers; leer am Tablet */
  token: string;
  art: SpielArt;
  vorschlaege: SpielVorschlag[];
  serie: number;
  lernstand: number | null;
  duell?: DuellRahmen;
  /** wohin das Kreuz führt; ohne Angabe zum Tab „Spiele“ */
  zurueck?: string;
  /** woher die Karten kommen, wenn es mehr als eine Quelle gibt („Thema: Familie“, „Deine Liste „Unit 3““) */
  woher?: string;
  /** die Kisten auf dem Anfang, wenn sie vom Thema abhängen (English Grammar: „some“, „any“, „no“) */
  vorschau?: string[];
  /** wie die Karten der nächsten Runde beantwortet werden, wenn es am Thema hängt (Kopfrechnen: Ziffernblock oder Kisten) */
  antwort?: SpielForm;
  /** der beste Stand im Endlos-Modus dieses Spiels (0: noch keiner) */
  rekord?: number;
  /** am Schüler-Tablet in der Einheit (app/geraet/page.tsx): der Server findet den Schüler über das Tablet */
  amTablet?: boolean;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (endlos?: "neu" | number) => (amTablet ? tabletSpielStartenAction(art, endlos) : spielStartenAction(token, art, endlos)),
      beenden: (id: number, antworten: { key: string; wahl: string }[], o?: { teil?: boolean }) => (amTablet ? tabletSpielBeendenAction(id, antworten, o) : spielBeendenAction(token, id, antworten, o)),
    }),
    [amTablet, token, art],
  );
  // für den Anfang: wie das Spiel beantwortet wird. Im Spiel entscheidet die Karte (`aktuell.form`).
  const form = antwort ?? SPIEL_FORM[art];
  const zurueck = duell?.zurueck ?? zurueckZiel ?? `/lernen/${token}/spiele`;
  // am Tablet schaltet ein Link die Ansicht am Server um (app/geraet/ansicht): ein gewöhnlicher Link, kein Vorladen
  const ZuLink = amTablet ? "a" : Link;
  const duellRef = useRef(duell);
  duellRef.current = duell;
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
  // je gelöster Karte: beim ersten Mal richtig? (färbt den Fortschritt gold oder rot)
  const [verlauf, setVerlauf] = useState<boolean[]>([]);
  // was schon in welcher Kiste liegt (die letzten zwei schauen oben heraus)
  const [inKiste, setInKiste] = useState<Record<string, string[]>>({});
  const [jubel, setJubel] = useState<{ n: number; text: string } | null>(null);
  // die Kiste, in der zuletzt eine Karte gelandet ist (Funken und „+1“ beim Aufkommen, nicht beim Abwurf)
  const [treffer, setTreffer] = useState<{ fach: number; n: number } | null>(null);

  const erste = useRef(new Map<string, string>());
  const beschaeftigt = useRef(false);
  // ---------- Endlos-Modus ----------
  const [endlos, setEndlos] = useState(false);
  const [herzen, setHerzen] = useState(ENDLOS_HERZEN);
  const herzenRef = useRef(ENDLOS_HERZEN);
  // Karten, die beim ersten Versuch richtig waren (über alle Runden des Endlos-Spiels)
  const [punkte, setPunkte] = useState(0);
  // die Karten, die beim ersten Versuch falsch waren (für das Ende)
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);
  const lauf = useRef<number | null>(null);
  // die nächste Runde, schon geholt, bevor die laufende zu Ende ist
  const vorrat = useRef<Promise<SpielStart> | null>(null);
  // das Beenden der letzten vollen Runde (im Hintergrund) und der Lernstand vor dem Endlos-Spiel
  const abschluss = useRef<Promise<SpielErgebnis> | null>(null);
  const laufVorher = useRef<number | null | undefined>(undefined);
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
  // Paare: alle Karten der Runde auf einmal (das Feld teilt sie selbst auf Bretter auf)
  const karten = useMemo(() => reihe.map((e) => e.karte), [reihe]);
  // Ziffernblock: welche Tasten die Runde neben den Ziffern braucht (für alle Karten gleich, damit nichts springt)
  const tasten = useMemo(() => {
    const ziele = karten.filter((k) => k.form === "tippen").map((k) => k.richtig);
    return { komma: ziele.some((z) => z.includes(",")), minus: ziele.some((z) => /^[−-]/.test(z)), bruch: ziele.some((z) => z.includes("/")) };
  }, [karten]);

  // ---------- Runde starten und beenden ----------

  const starten = useCallback(async (mitEndlos = false) => {
    setPhase("laden");
    setFehler(null);
    const r = await (duellRef.current ? duellRef.current.starten() : server.starten(mitEndlos ? "neu" : undefined));
    if ("fehler" in r) {
      setFehler(r.fehler);
      setPhase("start");
      return;
    }
    setEndlos(mitEndlos && !!r.endlos);
    lauf.current = r.endlos ?? null;
    herzenRef.current = ENDLOS_HERZEN;
    setHerzen(ENDLOS_HERZEN);
    setPunkte(0);
    setDaneben([]);
    vorrat.current = null;
    abschluss.current = null;
    laufVorher.current = undefined;
    erste.current = new Map();
    comboRef.current = 0;
    paarGeloest.current = new Set();
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
    setVerlauf([]);
    setInKiste({});
    setJubel(null);
    setTreffer(null);
    setPhase("spiel");
  }, [server]);

  const beenden = useCallback(
    async (id: number) => {
      setPhase("ende");
      const antworten = [...erste.current.entries()].map(([key, wahl]) => ({ key, wahl }));
      if (duellRef.current) {
        duellRef.current.fertig(await duellRef.current.beenden(id, antworten));
        return;
      }
      setErgebnis(await server.beenden(id, antworten));
      router.refresh();
    },
    [server, router],
  );

  /** Die erste Wahl einer Karte merken; im Endlos-Modus zählt sie gleich (richtig: ein Punkt, falsch: ein Herz). */
  const merke = useCallback(
    (karte: SpielKarte, wahl: string) => {
      if (erste.current.has(karte.key)) return;
      erste.current.set(karte.key, wahl);
      duellRef.current?.ersteWahl?.(karte.key, wahl);
      if (!endlos) return;
      if (wahl === karte.richtig) setPunkte((n) => n + 1);
      else {
        herzenRef.current = Math.max(0, herzenRef.current - 1);
        setHerzen(herzenRef.current);
        setDaneben((d) => [...d, karte]);
      }
    },
    [endlos],
  );

  // Endlos: ist die laufende Runde fast durch, wird die nächste schon geholt
  useEffect(() => {
    if (phase !== "spiel" || !endlos || !lauf.current || vorrat.current || herzenRef.current <= 0) return;
    if (reihe.length - pos <= 3) vorrat.current = server.starten(lauf.current);
  }, [phase, endlos, pos, reihe.length, server]);

  /** Endlos: die drei Herzen sind weg. Die laufende Runde zählt mit den Karten, die beantwortet sind. */
  const endlosEnde = useCallback(
    async (id: number) => {
      setPhase("ende");
      const antworten = [...erste.current.entries()].map(([key, wahl]) => ({ key, wahl }));
      // die Runde davor muss gezählt sein, sonst fehlt sie im Stand
      const davor = await abschluss.current?.catch(() => null);
      let e = await server.beenden(id, antworten, { teil: true });
      const vorher = laufVorher.current !== undefined ? laufVorher.current : davor && !("fehler" in davor) ? davor.lernstandVorher : undefined;
      if (!("fehler" in e) && vorher !== undefined) e = { ...e, lernstandVorher: vorher };
      setErgebnis(e);
      router.refresh();
    },
    [server, router],
  );

  /** Endlos: die Runde ist durch. Sie wird im Hintergrund beendet, die nächste schließt nahtlos an. */
  const nachladen = useCallback(
    async (id: number) => {
      const antworten = [...erste.current.entries()].map(([key, wahl]) => ({ key, wahl }));
      const fertig = server.beenden(id, antworten);
      abschluss.current = fertig;
      void fertig.then((e) => {
        if (laufVorher.current === undefined && !("fehler" in e)) laufVorher.current = e.lernstandVorher;
      });
      beschaeftigt.current = true;
      const r = await (vorrat.current ?? server.starten(lauf.current ?? "neu"));
      vorrat.current = null;
      beschaeftigt.current = false;
      if ("fehler" in r) {
        // keine Karten mehr: das Endlos-Spiel endet hier (die Runde ist schon gezählt)
        setPhase("ende");
        await fertig;
        const e = await server.beenden(id, antworten, { teil: true });
        setErgebnis(!("fehler" in e) && laufVorher.current !== undefined ? { ...e, lernstandVorher: laufVorher.current } : e);
        return;
      }
      erste.current = new Map();
      paarGeloest.current = new Set();
      setGeloest(new Set());
      setRundeId(r.rundeId);
      setAnzahl(r.karten.length);
      setReihe(r.karten.map((karte) => ({ karte, wiederholung: false })));
      setPos(0);
      setStand(null);
      setFalschGewaehlt([]);
    },
    [server],
  );

  /** Zur nächsten Karte; am Ende der Runde fertig (oder im Endlos-Modus die nächste Runde), ohne Herzen das Ende. */
  const naechste = useCallback(() => {
    if (endlos && herzenRef.current <= 0) {
      void endlosEnde(rundeId);
      return;
    }
    if (pos + 1 >= reihe.length) {
      void (endlos ? nachladen(rundeId) : beenden(rundeId));
      return;
    }
    setPos(pos + 1);
  }, [endlos, endlosEnde, nachladen, beenden, rundeId, pos, reihe.length]);

  // Duell: gleich losspielen; ist die Zeit um, endet die Runde von selbst
  const sofort = !!duell?.sofort;
  useEffect(() => {
    if (sofort) void starten();
  }, [sofort, starten]);
  const bis = duell?.bis ?? null;
  useEffect(() => {
    if (phase !== "spiel" || !bis || !rundeId) return;
    const t = setTimeout(() => void beenden(rundeId), Math.max(0, bis - Date.now()));
    return () => clearTimeout(t);
  }, [phase, bis, rundeId, beenden]);

  // ---------- Paare (PaarFeld.tsx): das Feld meldet Versuche und gelöste Paare, gezählt wird hier ----------

  const paarVersuch = useCallback((karte: SpielKarte, wahl: string) => {
    if (erste.current.has(karte.key)) return;
    erste.current.set(karte.key, wahl);
    duellRef.current?.ersteWahl?.(karte.key, wahl);
  }, []);
  const comboRef = useRef(0);
  const paarGeloest = useRef(new Set<string>());
  const paarRichtig = useCallback((karte: SpielKarte, sauber: boolean) => {
    if (sauber) {
      const neu = ++comboRef.current;
      setCombo(neu);
      if (neu === 3 || neu === 5 || (neu >= 10 && neu % 5 === 0)) setJubel((j) => ({ n: (j?.n ?? 0) + 1, text: `${neu} in Folge!` }));
    }
    if (!paarGeloest.current.has(karte.key)) {
      paarGeloest.current.add(karte.key);
      setVerlauf((v) => [...v, sauber]);
      setGeloest(new Set(paarGeloest.current));
    }
    setZuletzt((z) => ({ karte, n: (z?.n ?? 0) + 1 }));
  }, []);
  const paarFalsch = useCallback(() => {
    comboRef.current = 0;
    setCombo(0);
  }, []);
  const paarFertig = useCallback(() => void beenden(rundeId), [beenden, rundeId]);

  // ---------- Reihe (SatzbauFeld.tsx): das Feld baut den Satz, geprüft und gezählt wird hier ----------

  const reihePruefe = useCallback(
    (wahl: string) => {
      const eintrag = reihe[pos];
      if (!eintrag) return false;
      const karte = eintrag.karte;
      merke(karte, wahl);
      if (wahl === karte.richtig) return true;
      comboRef.current = 0;
      setCombo(0);
      // einmal wiederholen, drei Karten später (nie eine Wiederholung wiederholen)
      if (!eintrag.wiederholung && !reihe.slice(pos + 1).some((e) => e.karte.key === karte.key)) {
        setReihe((r) => {
          const neu = [...r];
          neu.splice(Math.min(pos + 4, neu.length), 0, { karte, wiederholung: true });
          return neu;
        });
      }
      return false;
    },
    [reihe, pos, merke],
  );
  const reiheWeiter = useCallback(
    (sauber: boolean) => {
      const karte = reihe[pos]?.karte;
      if (!karte) return;
      paarRichtig(karte, sauber);
      naechste();
    },
    [reihe, pos, paarRichtig, naechste],
  );

  // ---------- Karte fliegt ins Fach ----------

  const fliege = useCallback((fach: number, von: Wurf, geworfen: boolean) => {
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
          { transform: `translate(${von.x}px, ${von.y}px) rotate(${von.r}deg) scale(${von.s ?? 1})`, opacity: 1 },
          { transform: `translate(${von.x + dx}px, ${von.y + dy}px) rotate(${von.r * 0.4}deg) scale(0.22)`, opacity: 0 },
        ],
        // geworfen ist sie schon in Fahrt: ease-out; angetippt bewegt sie sich über den Schirm: ease-in-out
        { duration: geworfen ? 240 : 300, easing: geworfen ? "cubic-bezier(0.23, 1, 0.32, 1)" : "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
      )
      .finished.then(() => undefined);
  }, []);

  // ---------- Antwort ----------

  const waehle = useCallback(
    async (wahl: string, von: Wurf = { x: 0, y: 0, r: 0 }, geworfen = false) => {
      const karte = reihe[pos]?.karte;
      if (!karte || beschaeftigt.current) return;
      merke(karte, wahl);
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
          // wackeln über `rotate` (translate schiebt die Karte gerade hoch, transform gehört dem Ziehen)
          el.animate([{ rotate: "-1.5deg" }, { rotate: "-6deg" }, { rotate: "4deg" }, { rotate: "-3.5deg" }, { rotate: "1deg" }, { rotate: "-1.5deg" }], { duration: 420, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
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
      if (ersterVersuch) {
        const neu = combo + 1;
        setCombo(neu);
        if (neu === 3 || neu === 5 || (neu >= 10 && neu % 5 === 0)) setJubel((j) => ({ n: (j?.n ?? 0) + 1, text: `${neu} in Folge!` }));
      }
      if (!geloest.has(karte.key)) setVerlauf((v) => [...v, ersterVersuch]);
      setGeloest((g) => new Set(g).add(karte.key));
      setZuletzt((z) => ({ karte, n: (z?.n ?? 0) + 1 }));
      await fliege(fach, von, geworfen);
      setInKiste((k) => ({ ...k, [wahl]: [...(k[wahl] ?? []), kistenWort(karte)].slice(-2) }));
      setTreffer((t) => ({ fach, n: (t?.n ?? 0) + 1 }));
      setZiel(null);
      setBlitz(null);
      setStand(null);
      setFalschGewaehlt([]);
      beschaeftigt.current = false;
      naechste();
    },
    [reihe, pos, stand, fliege, naechste, combo, geloest, merke],
  );

  // Tasten 1–5 am Laptop (ohne Bewegung beim Antippen: wiederholte Aktionen sollen sofort wirken)
  useEffect(() => {
    if (phase !== "spiel" || !aktuell || aktuell.form) return;
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
    // auf dem Weg nach unten wird die Karte kleiner: sie passt in die Kiste und verdeckt die anderen nicht
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${reduziert.current ? 0 : dx * 0.05}deg) scale(${zugGroesse(dy)})`;
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
        void waehle(karte.faecher[fach], { x: dx, y: Math.max(dy, 0), r: reduziert.current ? 0 : dx * 0.05, s: zugGroesse(dy) }, true);
        return;
      }
    }
    setZiel(null);
    el.style.transform = "";
  };

  // ---------- Darstellung ----------

  const kopf = (
    <div className="ls-kopf">
      <ZuLink href={zurueck} className="ls-zu" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" && endlos ? (
        <>
          {/* Endlos: drei Herzen statt der Striche, daneben wie viele schon richtig sind */}
          <div className="ls-herzen" role="img" aria-label={`${herzen} von ${ENDLOS_HERZEN} Herzen`} data-testid="herzen">
            {Array.from({ length: ENDLOS_HERZEN }, (_, i) => (
              <Heart key={i} size={24} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
            ))}
          </div>
          <span className="ls-combo ls-endlos-stand" aria-label={`${punkte} richtig`} data-testid="endlos-stand">
            <Check size={16} strokeWidth={3} aria-hidden />
            <b key={punkte} data-neu="">
              {punkte}
            </b>
          </span>
          <span className="ls-combo" data-heiss={combo >= 3 ? "" : undefined} aria-label={`${combo} richtig in Folge`}>
            <Flame size={16} aria-hidden fill="currentColor" strokeWidth={1.5} />
            <b key={combo} data-neu="">
              ×{combo}
            </b>
          </span>
        </>
      ) : phase === "spiel" ? (
        <>
          <div className="ls-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={anzahl} aria-valuenow={geloest.size} aria-label="Fortschritt">
            {Array.from({ length: anzahl }, (_, i) => (
              <span key={i} data-stand={i < verlauf.length ? (verlauf[i] ? "richtig" : "falsch") : i === verlauf.length ? "jetzt" : undefined} />
            ))}
          </div>
          <span className="ls-combo" data-heiss={combo >= 3 ? "" : undefined} aria-label={`${combo} richtig in Folge`}>
            <Flame size={16} aria-hidden fill="currentColor" strokeWidth={1.5} />
            <b key={combo} data-neu="">
              ×{combo}
            </b>
          </span>
        </>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );

  const deko = SPIEL_DEKO[art];

  if (duell?.sofort && (phase === "start" || phase === "laden")) {
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label={`Duell ${SPIEL_TITEL[art]}`}>
        <Hintergrund woerter={deko} />
        {kopf}
        <div className="ls-mitte text-center">
          {fehler ? (
            <p className="ls-fehler mt-10" role="alert">
              {fehler}
            </p>
          ) : (
            <p className="ls-text mt-10">Karten werden gemischt …</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "start" || phase === "laden") {
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
        <Hintergrund woerter={deko} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel {SPIEL_FACH[art]}
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            {SPIEL_TITEL[art]}
          </h1>
          <p className="ls-text mt-2" style={{ "--n": 2 } as CSSProperties}>
            {form === "tippen" ? "" : form === "wischen" && art === "rechnen" ? "Ja oder nein?" : SPIEL_AUFGABE[art]}
            {form === "paar" ? " Tipp ein englisches Wort an und dann das deutsche dazu." : form === "reihe" ? " Der Anfang steht schon da. Tipp die anderen Teile der Reihe nach an." : form === "strahl" ? " Schieb den Zeiger auf den richtigen Teilstrich und tipp auf „Prüfen“." : form === "tippen" ? "Rechne im Kopf und tipp das Ergebnis ein." : form === "legen" ? " Leg sie aus den Buchstaben und tipp auf „Prüfen“." : form === "wischen" ? " Wisch die Karte nach links oder nach rechts." : form === "kacheln" ? " Tipp eine Antwort an, sie springt in die Lücke. Dann tipp auf „Prüfen“." : " Zieh die Karte in eine Kiste oder tipp die Kiste an."}
          </p>
          {/* steht schon da, woher die Wörter kommen, braucht es „Deine Vokabelliste“ nicht noch einmal */}
          {vorschlag && vorschlag.quelle !== "fach" && !(woher && vorschlag.quelle === "stoff") && (
            <span className="ls-grund mt-4" style={{ "--n": 3 } as CSSProperties}>
              {vorschlag.quelle === "pruefung" ? <CalendarDays size={16} aria-hidden /> : <TrendingUp size={16} aria-hidden />}
              {vorschlag.grund}
            </span>
          )}

          {woher && (
            <span className="ls-grund mt-4" style={{ "--n": 3 } as CSSProperties} data-testid="spiel-woher">
              <BookOpen size={16} aria-hidden />
              {woher}
            </span>
          )}

          {form === "strahl" ? (
            <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
              <span className="ls-strahl-mini">
                <b style={{ left: "20px" }}>0</b>
                <b style={{ left: "50%" }}>5</b>
                <b style={{ left: "calc(100% - 20px)" }}>10</b>
                <i />
              </span>
            </div>
          ) : form === "tippen" ? (
            <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
              <span className="ls-block-mini">
                {["1", "2", "3", "4", "5"].map((z) => (
                  <b key={z}>{z}</b>
                ))}
                <b data-ok="">✓</b>
              </span>
            </div>
          ) : form === "wischen" ? (
            <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
              {(vorschau ?? VORSCHAU[art]).slice(0, 2).map((f, i) => (
                <span key={f} className="ls-wisch-mini" data-seite={i ? "rechts" : "links"}>
                  {i === 0 && <ChevronLeft size={18} strokeWidth={3} />}
                  {f}
                  {i === 1 && <ChevronRight size={18} strokeWidth={3} />}
                </span>
              ))}
            </div>
          ) : form === "kacheln" ? (
            <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
              <span className="ls-kachel-mini">
                <i />
                <span>
                  {(vorschau ?? VORSCHAU[art]).slice(0, 2).map((f) => (
                    <b key={f}>{f}</b>
                  ))}
                </span>
              </span>
            </div>
          ) : form ? (
            <div className="ls-vorschau ls-vorschau-paar" aria-hidden style={{ "--n": 3 } as CSSProperties} data-form={form}>
              {VORSCHAU[art].map((w, i) => (
                <Fragment key={`${i}-${w}`}>
                  {form === "paar" && i > 0 && <span className="ls-paar-gleich">=</span>}
                  <span className="ls-paar-mini" style={{ rotate: `${i % 2 ? 2 : -2.5}deg` }}>
                    {w}
                  </span>
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
              {(vorschau ?? VORSCHAU[art]).map((f, i) => (
                <span key={f} className="ls-kiste-mini" data-k={f} data-i={i} style={{ rotate: `${i % 2 ? 2.5 : -2.5}deg` }}>
                  {SPIEL_FACH[art] === "Mathematik" ? <MathText text={f} /> : f}
                </span>
              ))}
            </div>
          )}

          <div className="ls-glas mt-6 grid grid-cols-2 gap-4 p-4" style={{ "--n": 4 } as CSSProperties}>
            <div>
              <p className="ls-klein">Dein Stand</p>
              <p className="text-[22px] font-semibold tabular-nums">{lernstand === null ? "Noch offen" : pct(lernstand)}</p>
            </div>
            <div>
              <p className="ls-klein">Serie</p>
              <p className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums">
                <Flame size={20} className={serieAnfang > 0 ? "ls-flamme" : "opacity-60"} fill={serieAnfang > 0 ? "currentColor" : "none"} aria-hidden />
                {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
              </p>
            </div>
          </div>

          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
        </div>
        {/* der Knopf steht fest unten, der Rest darüber kann rollen (acht Spiele passen nicht auf jedes Handy) */}
        <div className="ls-fuss ls-staffel">
          <div className="grid gap-3" style={{ "--n": 6 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={phase === "laden"} autoFocus>
              {phase === "laden" ? "Karten werden gemischt …" : "Los geht’s"}
            </button>
            {/* Endlos: weiter, bis drei Herzen weg sind */}
            {hatEndlos(art) && !duell && (
              <button type="button" className="ls-knopf ls-endlos-knopf" data-zweit="" onClick={() => void starten(true)} disabled={phase === "laden"} data-testid="endlos-start">
                <Endlos size={22} strokeWidth={2.4} aria-hidden />
                <span>Endlos</span>
                <small>{rekord > 0 ? `Rekord ${rekord}` : `${ENDLOS_HERZEN} Herzen`}</small>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende" && endlos) {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const stand = e?.endlos?.stand ?? punkte;
    const bisher = e?.endlos?.rekord ?? rekord;
    const neuerRekord = !!e && stand > 0 && stand > bisher;
    const besteSerie = laengsteSerie(verlauf);
    // der Ring: wie nah am Rekord (ein neuer Rekord füllt ihn ganz)
    const anteil = bisher > 0 ? Math.min(100, Math.round((stand / bisher) * 100)) : stand > 0 ? 100 : 0;
    const nochmal = daneben.filter((k, i) => daneben.findIndex((x) => x.key === k.key) === i);
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Endlos-Spiel vorbei">
        <Hintergrund woerter={deko} />
        {neuerRekord && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="endlos-ende">
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - anteil } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl">
              <b>{stand}</b>
              <span>{stand === 1 ? "Karte richtig" : "Karten richtig"}</span>
            </div>
          </div>
          {neuerRekord ? (
            <p className="ls-rekord" style={{ "--n": 1 } as CSSProperties}>
              <Trophy size={20} strokeWidth={2.4} aria-hidden /> Neuer Rekord
            </p>
          ) : (
            <p className="ls-rekord" data-alt="" style={{ "--n": 1 } as CSSProperties}>
              <Trophy size={18} strokeWidth={2.4} aria-hidden /> {bisher > 0 ? `Dein Rekord: ${bisher}` : "Dein erster Rekord"}
            </p>
          )}
          <h1 className="ls-titel mt-3" style={{ "--n": 2 } as CSSProperties}>
            {neuerRekord ? "Stark gemacht!" : stand >= bisher * 0.75 && stand > 0 ? "Knapp dran!" : "Drei Herzen weg"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 2 } as CSSProperties}>
            {besteSerie >= 3 ? `Längste Serie: ${besteSerie} in Folge` : "Jede Karte zählt beim ersten Versuch"}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-left" style={{ "--n": 3 } as CSSProperties}>
            <div className="ls-glas p-4">
              <p className="ls-klein">{SPIEL_TITEL[art]}</p>
              <p className="text-[21px] font-semibold tabular-nums">
                {e ? (
                  e.lernstandVorher === null ? (
                    pct(e.lernstandNachher)
                  ) : (
                    <>
                      {pct(e.lernstandVorher)} → {pct(e.lernstandNachher)}
                    </>
                  )
                ) : (
                  "…"
                )}
              </p>
              <div className="ls-balken mt-2">
                <span style={{ transform: `scaleX(${e?.lernstandNachher ?? e?.lernstandVorher ?? lernstand ?? 0})` }} />
              </div>
            </div>
            <div className="ls-glas p-4">
              <p className="ls-klein">Serie</p>
              <p className="flex items-center gap-1.5 text-[21px] font-semibold tabular-nums">
                <Flame size={20} className="ls-flamme" fill="currentColor" aria-hidden />
                {e ? (e.serie === 1 ? "1 Tag" : `${e.serie} Tage`) : "…"}
              </p>
            </div>
          </div>

          {nochmal.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
              <p className="text-[15px] font-semibold">Kommt nächstes Mal wieder</p>
              <ul className="mt-2 space-y-1.5 text-[16px]">
                {nochmal.map((k) => (
                  <li key={k.key}>
                    <Loesung karte={k} art={art} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 5 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten(true)} disabled={!ergebnis} autoFocus data-testid="endlos-nochmal">
              Nochmal endlos
            </button>
            <ZuLink href={zurueck} className="ls-knopf ls-los" data-zweit="">
              Fertig
            </ZuLink>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende") {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const richtig = e?.richtig ?? [...erste.current.entries()].filter(([key, wahl]) => reihe.find((r) => r.karte.key === key)?.karte.richtig === wahl).length;
    const sterne = e?.sterne ?? sterneFuer(richtig, anzahl);
    const anteil = anzahl ? Math.round((richtig / anzahl) * 100) : 0;
    const besteSerie = laengsteSerie(verlauf);
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Runde fertig">
        <Hintergrund woerter={deko} />
        {sterne >= 2 && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties}>
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - anteil } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl">
              <b>{richtig}</b>
              <span>von {anzahl} richtig</span>
            </div>
          </div>
          <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`} style={{ "--n": 1 } as CSSProperties}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 60 : 48} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" strokeWidth={0} style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <h1 className="ls-titel mt-3" style={{ "--n": 2 } as CSSProperties}>
            {sterne === 3 ? "Stark gemacht!" : sterne === 2 ? "Gut gemacht!" : "Weiter so!"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 2 } as CSSProperties}>
            {besteSerie >= 3 ? `Längste Serie: ${besteSerie} in Folge` : "Gezählt wird der erste Versuch"}
          </p>
          {e?.liga && (
            <p className="ls-text mt-1" style={{ "--n": 2 } as CSSProperties}>
              {e.liga.punkte > 0 ? <b>+{e.liga.punkte} Ligapunkte</b> : e.liga.grund}
            </p>
          )}

          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-left" style={{ "--n": 3 } as CSSProperties}>
            <div className="ls-glas p-4">
              <p className="ls-klein">{SPIEL_TITEL[art]}</p>
              <p className="text-[21px] font-semibold tabular-nums">
                {e ? (
                  e.lernstandVorher === null ? (
                    pct(e.lernstandNachher)
                  ) : (
                    <>
                      {pct(e.lernstandVorher)} → {pct(e.lernstandNachher)}
                    </>
                  )
                ) : (
                  "…"
                )}
              </p>
              <div className="ls-balken mt-2">
                <span style={{ transform: `scaleX(${e?.lernstandNachher ?? e?.lernstandVorher ?? lernstand ?? 0})` }} />
              </div>
            </div>
            <div className="ls-glas p-4">
              <p className="ls-klein">Serie</p>
              <p className="flex items-center gap-1.5 text-[21px] font-semibold tabular-nums">
                <Flame size={20} className="ls-flamme" fill="currentColor" aria-hidden />
                {e ? (e.serie === 1 ? "1 Tag" : `${e.serie} Tage`) : "…"}
              </p>
            </div>
          </div>

          {e && e.nochmal.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
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
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={!ergebnis} autoFocus>
              Noch eine Runde
            </button>
            <ZuLink href={zurueck} className="ls-knopf ls-los" data-zweit="">
              Fertig
            </ZuLink>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------
  const zuletztZeile = (
    // der letzte richtige Satz, ganz: so bleibt beim Spielen hängen, wie es heißt
    <p className="ls-zuletzt" aria-live="polite">
      {zuletzt && (
        <span key={zuletzt.n} className="ls-zeile">
          <Loesung karte={zuletzt.karte} art={art} knapp />
        </span>
      )}
    </p>
  );
  const jubelZeile = jubel && (
    <p key={jubel.n} className="ls-jubel" aria-hidden>
      {jubel.text}
    </p>
  );

  // wie die Karte beantwortet wird, steht auf ihr (in einer Runde „Kopfrechnen“ können sich Ziffernblock und Kisten abwechseln)
  const feld = aktuell?.form;
  if (feld === "paar") {
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
        <Hintergrund woerter={deko} />
        {kopf}
        {duell?.leiste}
        <div className="ls-feld">
          <PaarFeld key={rundeId} karten={karten} auftrag={SPIEL_AUFGABE[art]} onVersuch={paarVersuch} onRichtig={paarRichtig} onFalsch={paarFalsch} onFertig={paarFertig}>
            {zuletztZeile}
            {jubelZeile}
          </PaarFeld>
        </div>
      </div>
    );
  }

  if (aktuell && feld) {
    const eigen = { key: `${rundeId}-${pos}`, karte: aktuell, onPruefe: reihePruefe, onWeiter: reiheWeiter };
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
        <Hintergrund woerter={deko} />
        {kopf}
        {duell?.leiste}
        <div className="ls-feld">
          {feld === "reihe" ? (
            <SatzbauFeld {...eigen} auftrag={SPIEL_AUFGABE[art]} />
          ) : feld === "strahl" ? (
            <StrahlFeld {...eigen} auftrag={SPIEL_AUFGABE[art]} />
          ) : feld === "tippen" ? (
            <ZiffernFeld {...eigen} auftrag="Tipp das Ergebnis ein." tasten={tasten} />
          ) : feld === "legen" ? (
            <LegeFeld {...eigen} auftrag="Leg die Form aus den Buchstaben." />
          ) : feld === "wischen" ? (
            <WischFeld {...eigen} auftrag={aktuell.mathe ? "Ja oder nein?" : SPIEL_AUFGABE[art]} rest={reihe.length - pos - 1}>
              {zuletztZeile}
            </WischFeld>
          ) : (
            <KachelFeld {...eigen} auftrag={SPIEL_AUFGABE[art]} />
          )}
          {jubelZeile}
        </div>
      </div>
    );
  }

  const sichtbar = reihe.slice(pos, pos + 3);
  if (aktuell) fachRefs.current.length = aktuell.faecher.length;
  const falsch = !!stand && !stand.richtig;
  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label={`Lernspiel ${SPIEL_TITEL[art]}`}>
      <Hintergrund woerter={deko} />
      {kopf}
      {duell?.leiste}
      <div className="ls-feld">
        <p className="ls-auftrag">{SPIEL_AUFGABE[art]}</p>
        {zuletztZeile}
        {jubelZeile}

        <div className="ls-stapel" data-falsch={falsch ? "" : undefined} data-mathe={aktuell?.mathe ? "" : undefined}>
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
                <KartenInhalt karte={e.karte} stand={i === 0 ? stand : null} key={i === 0 ? `w${wackeln}` : "x"} />
              </div>
            ))}

          {falsch && aktuell && (
            <div className="ls-regel" role="status" data-mathe={aktuell.mathe ? "" : undefined}>
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                {aktuell.wort ? (
                  <Loesung karte={aktuell} art={art} ohneMarke />
                ) : (
                  <b className="ls-richtig">{aktuell.einsatz && aktuell.einsatz.toLowerCase() !== aktuell.richtig ? `${aktuell.richtig} (${aktuell.einsatz})` : gesetzt(aktuell, aktuell.richtig)}</b>
                )}
              </p>
              <p className="ls-regel-text" data-mathe={aktuell.mathe ? "" : undefined}>
                {gesetzt(aktuell, aktuell.regel)}
              </p>
            </div>
          )}
        </div>

        {aktuell && (
          <div
            className="ls-faecher"
            role="group"
            aria-label="Kisten"
            data-viele={aktuell.faecher.length > 3 ? "" : undefined}
            data-mathe={aktuell.mathe ? "" : undefined}
            style={{ "--z": Math.max(3, ...aktuell.faecher.flatMap((f) => kistenZeilen(f, aktuell.mathe).map((z) => (aktuell.mathe ? sichtLaenge(z) : z.length)))) } as CSSProperties}
          >
            {aktuell.faecher.map((f, i) => (
              <button
                key={f}
                ref={(el) => {
                  fachRefs.current[i] = el;
                }}
                type="button"
                className="ls-fach ohne-druck"
                data-k={f}
                data-i={i}
                data-ziel={ziel === i ? "" : undefined}
                data-richtig={blitz === i ? "" : undefined}
                data-zeigen={falsch && f === aktuell.richtig ? "" : undefined}
                data-falsch={falschGewaehlt.includes(f) ? "" : undefined}
                onClick={() => void waehle(f)}
                aria-keyshortcuts={String(i + 1)}
              >
                <span className="ls-drin" aria-hidden>
                  {(inKiste[f] ?? []).map((w, j) => (
                    <span key={`${j}-${w}`} style={{ "--j": j } as CSSProperties}>
                      {aktuell.mathe ? flach(w) : w}
                    </span>
                  ))}
                </span>
                <span className="ls-kiste">
                  {kistenZeilen(f, aktuell.mathe).map((z, n) => (
                    <span key={n}>{gesetzt(aktuell, z)}</span>
                  ))}
                  {KISTEN_FRAGE[f] && <small>{KISTEN_FRAGE[f]}</small>}
                </span>
                {treffer?.fach === i && <Funken key={treffer.n} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Kleine Kisten auf dem Anfang: worum es geht (bei Präteritum heißen die Kisten je Karte anders). */
const VORSCHAU: Record<SpielArt, string[]> = {
  artikel: ["der", "die", "das"],
  praepositionen: ["der", "die", "das", "dem", "den"],
  deklination: ["-e", "-en", "-er", "-es", "-em"],
  faelle: ["Nominativ", "Genitiv", "Dativ", "Akkusativ"],
  dasdass: ["das", "dass"],
  satzteile: ["Hauptsatz", "Gliedsatz"],
  perfekt: ["haben", "sein"],
  praeteritum: ["g", "i", "n", "g"],
  satzbau: ["gehen", "Heute", "wir"],
  wortschatz: ["kicherte", "knarrte", "tropfte"],
  vokabeln: ["dog", "der Hund"],
  irregular: ["w", "e", "n", "t"],
  zeiten: ["plays", "is playing", "played"],
  grammatik: ["some", "any", "much"],
  rechnen: ["54", "56", "63"],
  strahl: [],
};
/** Für den kleinen Zettel, der aus der Kiste schaut: Hochzahlen hochgestellt, Brüche bleiben mit Schrägstrich. */
const HOCH = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const flach = (text: string) => text.replace(/\^(\d+)/g, (_, z: string) => [...z].map((c) => HOCH[Number(c)]).join(""));
/** Wie breit ein Mathe-Text gesetzt ist: ein Bruch zählt so breit wie sein längerer Teil, das Hochzeichen zählt nicht. */
const sichtLaenge = (text: string) => text.replace(/(\d+)\/(\d+)/g, (_, z: string, n: string) => (z.length >= n.length ? z : n)).replace(/\^/g, "").length;
/**
 * Lange Aufschriften aus mehreren Wörtern („is going to watch“) stehen in zwei Zeilen, nahe der Mitte geteilt. Ein
 * langer Term („m² − 12m + 36“) bricht vor einem Rechenzeichen.
 */
function kistenZeilen(f: string, mathe?: boolean): string[] {
  if (mathe) {
    // eine lange Zahl mit Einheit („4 945 000 m“): die Einheit steht darunter
    const einheit = /^(.*\d)\u00a0(\D+)$/.exec(f);
    if (einheit && sichtLaenge(f) > 7) return [einheit[1], einheit[2]];
    if (sichtLaenge(f) <= 9) return [f];
    let best = -1;
    for (const m of f.matchAll(/ (?=[+−] )/g)) if (best < 0 || Math.abs(m.index - f.length / 2) < Math.abs(best - f.length / 2)) best = m.index;
    return best > 0 ? [f.slice(0, best), f.slice(best + 1)] : [f];
  }
  if (f.length <= 8 || !f.includes(" ")) return [f];
  let best = -1;
  for (let i = f.indexOf(" "); i >= 0; i = f.indexOf(" ", i + 1)) if (best < 0 || Math.abs(i - f.length / 2) < Math.abs(best - f.length / 2)) best = i;
  return [f.slice(0, best), f.slice(best + 1)];
}
/** Die Frage zu jedem Fall steht klein auf der Kiste: so übt man die Frageprobe mit. */
const KISTEN_FRAGE: Record<string, string> = { Nominativ: "Wer?", Genitiv: "Wessen?", Dativ: "Wem?", Akkusativ: "Wen?" };

/** Was oben aus der Kiste schaut: das Wort, bei Sätzen die eingesetzte Stelle („kalter“, „dem Tisch“). */
function kistenWort(karte: SpielKarte) {
  if (karte.kurz) return karte.kurz;
  if (karte.wort) return karte.wort;
  if (haengt(karte)) return (karte.vor.trimEnd().split(" ").pop() ?? "") + ohneStrich(karte.richtig);
  return karte.nach.trim().split(/[\s.,!?]/)[0] ?? "";
}

function laengsteSerie(v: boolean[]) {
  let best = 0;
  let n = 0;
  for (const r of v) {
    n = r ? n + 1 : 0;
    best = Math.max(best, n);
  }
  return best;
}

function Hintergrund({ woerter }: { woerter: string[] }) {
  return (
    <div className="ls-hintergrund" aria-hidden>
      {woerter.map((w, i) => (
        <span key={w} data-i={i}>
          {w}
        </span>
      ))}
    </div>
  );
}

/** Einmal Konfetti am Ende einer guten Runde. Feste Werte statt Zufall: gleich auf Server und Gerät. */
function Konfetti() {
  return (
    <div className="ls-konfetti" aria-hidden>
      {Array.from({ length: 34 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--x": `${((i * 61.8) % 100).toFixed(1)}%`,
              "--v": `${(i * 197) % 700}ms`,
              "--t": `${2100 + ((i * 311) % 900)}ms`,
              "--r": `${((i * 171) % 540) - 270}deg`,
              "--s": `${((i * 29) % 90) - 45}px`,
            } as CSSProperties
          }
          data-f={i % 4}
        />
      ))}
    </div>
  );
}

/** Für die Zeile über der Karte: von einem langen Satz nur das Stück um die Lücke. */
function knappDavor(vor: string) {
  if (vor.length <= 22) return vor;
  const ende = vor.slice(-20);
  return `… ${ende.slice(ende.indexOf(" ") + 1)}`;
}

function Loesung({ karte, ohneMarke, knapp }: { karte: SpielKarte; art: SpielArt; ohneMarke?: boolean; knapp?: boolean }) {
  if (karte.form === "paar")
    return (
      <>
        <b className="ls-richtig">{karte.wort}</b> = {karte.richtig}
      </>
    );
  if (karte.form === "strahl") return <MathText text={karte.loesung} />;
  if (karte.form === "reihe")
    return (
      <>
        {karte.vor} <b className="ls-richtig">{karte.richtig.split(REIHE_TRENNER).join(" ")}</b>
        {karte.nach}
      </>
    );
  if (karte.wort)
    return (
      <>
        <b data-a={karte.richtig} className="ls-artikel">
          {karte.richtig}
        </b>
        {karte.wort}
      </>
    );
  // Mathe mit markiertem Teil („Ist 2925 durch 5 teilbar?“): der gelöste Satz
  if (karte.mathe && karte.mitte !== undefined) return <>{karte.loesung}</>;
  if (karte.mitte !== undefined)
    return (
      <>
        <b className="ls-richtig">{karte.richtig}</b>: „{karte.mitte.replace(/[,.!?]+$/, "")}“
      </>
    );
  // eine Rechnung bleibt ganz; steht sie in zwei Zeilen („3x + 7 = 22“, darunter „x =“), hier in einer
  const vor = karte.mathe ? karte.vor.trimEnd().replace(/\.\n/g, ". ").replace(/\n/g, ", ") : knapp ? knappDavor(karte.vor.trimEnd()) : karte.vor.trimEnd();
  return (
    <>
      {gesetzt(karte, vor)}
      {vor && !haengt(karte) ? " " : ""}
      <b className="ls-richtig">{gesetzt(karte, eingesetzt(karte))}</b>
      {gesetzt(karte, hinterLuecke(karte))}
      {karte.marke && !ohneMarke ? <span className="ls-marke-klein">{karte.marke}</span> : null}
    </>
  );
}
