"use client";

import "./torlauf.css";
import { Flame, Heart, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import {
  antwortAufSpur,
  FREI_NACH_TOR,
  FREI_VOR_TOR,
  HERZ_ZURUECK_AB,
  reiheBei,
  reihenAbstand,
  SICHT,
  SPRUNG_DAUER,
  sprungHoehe,
  streckeNach,
  tempo,
  TOR_FIEBER_AB,
  TOR_HERZEN,
  TOR_PUNKTE,
  torFaktor,
  torOptionen,
  torSpuren,
  torStelle,
  trifft,
  type Ding,
} from "@/lib/torlauf";
import { gesetzt, KartenInhalt, type Stand } from "./KartenInhalt";
import { Funkenregen, type FunkenApi } from "./Funkenregen";
import { klang } from "./klang";
import { vibriere } from "./SpielTeile";

/**
 * Torlauf (lib/torlauf.ts, niko 2026-11-17 „Läufer mit Antwort-Toren“): oben die Frage mit den Antworten in den Farben
 * der Tore, darunter die Strecke. Der Läufer rennt von selbst; Wischen nach links oder rechts (oder links und rechts
 * antippen) wechselt die Spur, nach oben wischen springt. Am Laptop die Pfeiltasten, Leertaste, 1 bis 3.
 *
 * Gezeichnet wird auf einer Leinwand mit einfacher Perspektive (nur solange das Spiel läuft, ein Bild je Frame), ohne
 * React-Zustand je Frame: Punkte und Meter schreibt die Schleife direkt in die Anzeige. React rendert nur, wenn sich
 * Frage, Herzen, Serie oder eine Ansage ändern.
 *
 * Gezählt wird wie in den anderen Brettern in Lernspiel.tsx: `onPruefe` beim Durchlaufen eines Tors, `onWeiter`
 * danach; Karten ohne Antworten zum Wählen werden übersprungen (`onUeberspringen`).
 */

/** Die Farben der Tore je Spur (links, Mitte, rechts). */
const TOR_FARBEN = ["#ff8a3d", "#2f95ff", "#a463ff"];
const TOR_DUNKEL = ["#c2531a", "#1a62c4", "#6c35c9"];

/** Himmel, Wiese, Weg je Strecke; danach beginnt es wieder von vorn. */
type Look = { oben: string; unten: string; wiese: string; wieseFern: string; weg: string; streifen: string; sonne: string; berge: string; nacht?: boolean; licht?: boolean };
const LOOKS: (Look & { name: string })[] = [
  { name: "Morgen", oben: "#5fb8ff", unten: "#d9f1ff", wiese: "#6fcf5f", wieseFern: "#9be08a", weg: "#f3d6a0", streifen: "#ecc988", sonne: "#fff1a8", berge: "#8fb5e6" },
  { name: "Mittag", oben: "#2f8fff", unten: "#bde6ff", wiese: "#4fbf55", wieseFern: "#86d97a", weg: "#f0cc8c", streifen: "#e5bb73", sonne: "#ffffff", berge: "#7aa3db" },
  { name: "Abend", oben: "#ff7f5a", unten: "#ffd49a", wiese: "#69a64a", wieseFern: "#9cbf6a", weg: "#e9b98a", streifen: "#dca577", sonne: "#fff0c4", berge: "#c47888" },
  { name: "Nacht", oben: "#151d4d", unten: "#4b3a7d", wiese: "#2c5a48", wieseFern: "#3d6d58", weg: "#8c80b8", streifen: "#7a6ea6", sonne: "#fffbe3", berge: "#2b2e66", nacht: true },
  { name: "Polarlicht", oben: "#071733", unten: "#1d5568", wiese: "#21504a", wieseFern: "#2f6a60", weg: "#6eb3b1", streifen: "#5c9f9e", sonne: "#e8fff9", berge: "#163a52", nacht: true, licht: true },
];
const lookFuer = (strecke: number) => LOOKS[(strecke - 1) % LOOKS.length];

/** `spur`: durch welche Spur der Läufer gelaufen ist */
type Tor = { s: number; frageId: string; optionen: string[]; durch: boolean; spur?: number };
type Weg = { s: number; spur: number; art: Ding["art"]; t: number };
type Welt = {
  spieler: number;
  spur: number;
  ziel: number;
  sprung: number | null;
  /** seit der Landung (für das Zusammendrücken) */
  landung: number;
  dinge: Ding[];
  weg: Weg[];
  front: number;
  tor: Tor | null;
  /** die Torreihe, durch die der Läufer eben gelaufen ist (sie bleibt stehen, bis sie hinter ihm ist) */
  alt: Tor | null;
  punkte: number;
  t: number;
  schritt: number;
  unverwundbar: number;
  stolpern: number;
  sternFolge: number;
  sternZeit: number;
  wackeln: number;
  aus: number | null;
  laeuft: boolean;
  /** Fieber-Faktor (1, 2, 3) */
  fieber: number;
};

type Ansage = { n: number; text: string; art: "punkte" | "lob" | "fieber" | "herz" | "strecke" | "aua"; x?: number; y?: number };

const LOB = ["Richtig!", "Super!", "Stark!", "Klasse!", "Wahnsinn!", "Unschlagbar!"];

export function TorLauf({
  karte,
  frageId,
  onPruefe,
  onWeiter,
  onUeberspringen,
  onPunkte,
  onEnde,
  rekord,
}: {
  /** die nächste Frage (null, solange die nächsten Karten geholt werden) */
  karte: SpielKarte | null;
  /** wechselt mit jeder neuen Frage (auch wenn dieselbe Karte wiederkommt) */
  frageId: string;
  onPruefe: (wahl: string) => boolean;
  onWeiter: (sauber: boolean) => void;
  onUeberspringen: () => void;
  onPunkte: (punkte: number) => void;
  onEnde: () => void;
  /** der beste Stand bisher (0: noch keiner) */
  rekord: number;
}) {
  const leinwand = useRef<HTMLCanvasElement | null>(null);
  const flaeche = useRef<HTMLDivElement | null>(null);
  const punkteEl = useRef<HTMLElement | null>(null);
  const meterEl = useRef<HTMLElement | null>(null);
  const funkenRef = useRef<FunkenApi | null>(null);
  const reduziert = useRef(false);
  const rng = useRef(Math.random);

  const welt = useRef<Welt>({
    spieler: 0,
    spur: 1,
    ziel: 1,
    sprung: null,
    landung: 1,
    dinge: [],
    weg: [],
    front: 22,
    tor: null,
    alt: null,
    punkte: 0,
    t: 0,
    schritt: 0,
    unverwundbar: 0,
    stolpern: 0,
    sternFolge: 0,
    sternZeit: 0,
    wackeln: 0,
    aus: null,
    laeuft: false,
    fieber: 1,
  });

  const [frage, setFrage] = useState<{ id: string; karte: SpielKarte; optionen: string[]; stand: { i: number; ok: boolean } | null } | null>(null);
  const [herzen, setHerzen] = useState(TOR_HERZEN);
  const [serie, setSerie] = useState(0);
  const [strecke, setStrecke] = useState(1);
  const [ziel, setZiel] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [ansage, setAnsage] = useState<Ansage[]>([]);
  const faktor = torFaktor(serie);

  // die neuesten Werte für die Schleife (sie läuft außerhalb von React)
  const herzenRef = useRef(TOR_HERZEN);
  const serieRef = useRef(0);
  const toreRef = useRef(0);
  const offen = useRef<{ frageId: string; karte: SpielKarte; optionen: string[] } | null>(null);
  const warte = useRef(false);
  const rekordGeknackt = useRef(false);
  const uebersprungen = useRef(0);
  const zaehler = useRef(0);
  const cb = useRef({ onPruefe, onWeiter, onUeberspringen, onPunkte, onEnde });
  cb.current = { onPruefe, onWeiter, onUeberspringen, onPunkte, onEnde };

  const sage = useCallback((text: string, art: Ansage["art"], wo?: { x: number; y: number }) => {
    const n = ++zaehler.current;
    setAnsage((a) => [...a.slice(-3), { n, text, art, ...wo }]);
    setTimeout(() => setAnsage((a) => a.filter((x) => x.n !== n)), art === "lob" || art === "fieber" || art === "strecke" ? 1500 : 1200);
  }, []);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ---------- Fragen ----------

  /** Die Torreihe für die offene Frage planen (hinter allem, was schon auf der Strecke liegt). */
  const planeTor = useCallback(() => {
    const w = welt.current;
    const o = offen.current;
    if (!o) return;
    w.tor = { s: torStelle(w.spieler, w.front, streckeNach(toreRef.current)), frageId: o.frageId, optionen: o.optionen, durch: false };
  }, []);

  useEffect(() => {
    if (!karte || welt.current.aus !== null) return;
    if (offen.current?.frageId === frageId || warte.current) return;
    const optionen = torOptionen(karte);
    if (optionen.length < 2) {
      // Satzbau, Zahlenstrahl: diese Karte hat keine Tore (nicht endlos weiterblättern, falls keine passt)
      if (uebersprungen.current++ < 40) cb.current.onUeberspringen();
      return;
    }
    uebersprungen.current = 0;
    offen.current = { frageId, karte, optionen };
    setFrage({ id: frageId, karte, optionen, stand: null });
    planeTor();
  }, [karte, frageId, planeTor]);

  // ---------- Bildschirm-Koordinaten (für Funken und Ansagen) ----------

  const masse = useRef({ w: 360, h: 480 });
  const projektion = (z: number) => {
    const { w: W, h: H } = masse.current;
    const F = 7;
    const p = F / (F + z);
    const horizont = H * 0.25;
    const boden = H * 0.86;
    const spurBreite = Math.min(W * 0.3, 150);
    return { p, y: horizont + (boden - horizont) * p, spurBreite, horizont, boden };
  };
  const kameraX = () => masse.current.w / 2 - (welt.current.spur - 1) * projektion(0).spurBreite * 0.35;
  const aufSchirm = (spur: number, z: number, hoeheM = 0) => {
    const pr = projektion(z);
    const x = kameraX() + (spur - 1) * pr.spurBreite * pr.p;
    const y = pr.y - hoeheM * pr.spurBreite * 0.75 * pr.p;
    return { x, y };
  };
  const zuClient = (x: number, y: number) => {
    const r = leinwand.current?.getBoundingClientRect();
    return r ? { x: r.left + x, y: r.top + y } : { x, y };
  };
  const inProzent = (x: number, y: number) => ({ x: (x / masse.current.w) * 100, y: (y / masse.current.h) * 100 });

  // ---------- Ereignisse in der Schleife ----------

  const verliereHerz = (warum: "kiste" | "tor") => {
    const w = welt.current;
    herzenRef.current = Math.max(0, herzenRef.current - 1);
    setHerzen(herzenRef.current);
    w.unverwundbar = 1.5;
    w.stolpern = 1;
    w.wackeln = 0.35;
    vibriere([30, 40, 30]);
    if (warum === "kiste") klang.aua();
    if (herzenRef.current <= 0) {
      w.aus = 0;
      klang.aus();
      cb.current.onPunkte(Math.floor(w.punkte));
      setTimeout(() => cb.current.onEnde(), 1300);
    }
  };

  const torDurch = (tor: Tor) => {
    const w = welt.current;
    tor.durch = true;
    const spur = Math.round(w.spur);
    tor.spur = spur;
    const i = antwortAufSpur(tor.optionen.length, spur);
    const o = offen.current;
    if (!o || o.frageId !== tor.frageId) return;
    const mitte = aufSchirm(spur, 0, 1);
    w.alt = tor;
    if (i < 0) {
      // gegen die Mauer zwischen zwei Toren: keine Antwort, ein Herz weg, die Tore kommen noch einmal
      w.weg.push({ s: tor.s, spur: 1, art: "kiste", t: 0 });
      verliereHerz("kiste");
      sage("Autsch!", "aua", inProzent(mitte.x, mitte.y));
      if (w.aus === null) planeTor();
      return;
    }
    const wahl = tor.optionen[i];
    const ok = cb.current.onPruefe(wahl);
    w.tor = null;
    warte.current = true;
    setFrage((f) => (f && f.id === tor.frageId ? { ...f, stand: { i, ok } } : f));
    toreRef.current += 1;
    const c = zuClient(mitte.x, mitte.y);
    if (ok) {
      const neu = serieRef.current + 1;
      const vorher = torFaktor(serieRef.current);
      serieRef.current = neu;
      setSerie(neu);
      const f = torFaktor(neu);
      w.fieber = f;
      const p = TOR_PUNKTE.tor * f;
      w.punkte += p;
      klang.richtig(true);
      vibriere([10, 30, 16]);
      for (const farbe of [TOR_FARBEN[spur], "#ffd76e", "#ffffff", "#47d89a"]) funkenRef.current?.burst(c.x, c.y, farbe, { n: 12, kraft: 1.3 });
      sage(`+${p}`, "punkte", inProzent(mitte.x, mitte.y - 30));
      if (f > vorher) {
        klang.fieber();
        sage(f === 2 ? "Fieber! Punkte ×2" : "Fieber! Punkte ×3", "fieber");
      } else sage(LOB[Math.min(LOB.length - 1, Math.floor((neu - 1) / 2))], "lob");
      if (neu % HERZ_ZURUECK_AB === 0 && herzenRef.current < TOR_HERZEN) {
        herzenRef.current += 1;
        setHerzen(herzenRef.current);
        setTimeout(() => sage("Herz zurück!", "herz"), 700);
      }
      cb.current.onPunkte(Math.floor(w.punkte));
    } else {
      if (serieRef.current >= TOR_FIEBER_AB) klang.fieberAus();
      serieRef.current = 0;
      setSerie(0);
      w.fieber = 1;
      klang.falsch();
      for (const farbe of ["#ff5d50", "#ffffff"]) funkenRef.current?.burst(c.x, c.y, farbe, { n: 8, kraft: 0.8 });
      verliereHerz("tor");
    }
    // eine neue Strecke alle paar Tore
    const neueStrecke = streckeNach(toreRef.current);
    if (neueStrecke !== streckeNach(toreRef.current - 1)) {
      setStrecke(neueStrecke);
      setTimeout(() => {
        if (welt.current.aus !== null) return;
        klang.strecke();
        sage(`Strecke ${neueStrecke} · ${lookFuer(neueStrecke).name}`, "strecke");
      }, ok ? 900 : 1400);
    }
    if (welt.current.aus !== null) return;
    // richtig: gleich die nächste Frage; falsch: kurz die Lösung zeigen
    setTimeout(
      () => {
        if (welt.current.aus !== null) return;
        offen.current = null;
        warte.current = false;
        setFrage(null);
        cb.current.onWeiter(ok);
      },
      ok ? 650 : 2300,
    );
  };

  // ---------- die Schleife ----------

  useEffect(() => {
    const c = leinwand.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const passe = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      masse.current = { w: r.width, h: r.height };
      c.width = Math.round(r.width * d);
      c.height = Math.round(r.height * d);
      g.setTransform(d, 0, 0, d, 0, 0);
    };
    passe();
    const ro = new ResizeObserver(passe);
    ro.observe(c);

    // ein paar Berge, einmal
    const berge = Array.from({ length: 9 }, (_, i) => ({ x: i / 8, h: 0.35 + Math.random() * 0.65 }));
    const himmelSterne = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.4 }));

    let id = 0;
    let letzte = performance.now();
    let pause = document.hidden;
    const sichtbar = () => {
      pause = document.hidden;
      letzte = performance.now();
    };
    document.addEventListener("visibilitychange", sichtbar);

    const erzeuge = () => {
      const w = welt.current;
      const str = streckeNach(toreRef.current);
      while (w.front < w.spieler + SICHT + 4) {
        let s = w.front;
        const tor = w.tor;
        if (tor && s > tor.s - FREI_VOR_TOR && s < tor.s + FREI_NACH_TOR) s = tor.s + FREI_NACH_TOR;
        w.dinge.push(...reiheBei(s, str, rng.current));
        w.front = s + reihenAbstand(str, rng.current);
      }
    };

    const schritt = (jetzt: number) => {
      id = requestAnimationFrame(schritt);
      const dt = pause ? 0 : Math.min(0.05, (jetzt - letzte) / 1000);
      letzte = jetzt;
      const w = welt.current;
      w.t += dt;
      if (w.laeuft && w.aus === null) {
        const v = tempo(w.spieler) * (w.stolpern > 0 ? 1 - 0.45 * w.stolpern : 1);
        const alt = w.spieler;
        w.spieler += v * dt;
        w.punkte += (w.spieler - alt) * TOR_PUNKTE.meter * w.fieber;
        w.schritt += v * dt * 0.9;
        w.spur += (w.ziel - w.spur) * Math.min(1, dt * 16);
        if (Math.abs(w.ziel - w.spur) < 0.01) w.spur = w.ziel;
        if (w.sprung !== null) {
          w.sprung += dt;
          if (w.sprung >= SPRUNG_DAUER) {
            w.sprung = null;
            w.landung = 0;
          }
        }
        w.landung += dt;
        w.unverwundbar = Math.max(0, w.unverwundbar - dt);
        w.stolpern = Math.max(0, w.stolpern - dt);
        w.sternZeit += dt;
        if (w.sternZeit > 1.2) w.sternFolge = 0;
        const hoehe = sprungHoehe(w.sprung ?? 0);
        // treffen und einsammeln
        for (const d of w.dinge) {
          if (d.s > w.spieler + 1) break;
          if (!trifft(d, w.spieler, w.spur, hoehe)) continue;
          if (d.art === "stern") {
            d.s = -1e9;
            const p = TOR_PUNKTE.stern * w.fieber;
            w.punkte += p;
            klang.stern(w.sternFolge++);
            w.sternZeit = 0;
            const a = aufSchirm(w.spur, 0.5, 0.7 + hoehe);
            const cl = zuClient(a.x, a.y);
            funkenRef.current?.burst(cl.x, cl.y, "#ffd34d", { n: 5, kraft: 0.6 });
          } else if (w.unverwundbar <= 0) {
            w.weg.push({ s: d.s, spur: d.spur, art: d.art, t: 0 });
            d.s = -1e9;
            verliereHerz("kiste");
            const a = aufSchirm(w.spur, 0, 1.4);
            if (w.aus === null) sage("Autsch!", "aua", inProzent(a.x, a.y));
          }
        }
        w.dinge = w.dinge.filter((d) => d.s > w.spieler - 3).sort((a, b) => a.s - b.s);
        if (w.tor && !w.tor.durch && alt < w.tor.s && w.spieler >= w.tor.s) torDurch(w.tor);
        if (w.alt && w.spieler > w.alt.s + 6) w.alt = null;
        erzeuge();
        // Rekord geknackt (einmal)
        if (rekord > 0 && !rekordGeknackt.current && w.punkte > rekord) {
          rekordGeknackt.current = true;
          klang.rekord();
          funkenRef.current?.regen(["#ffd76e", "#ffffff", "#47d89a", "#5aa0ff"], 70);
          sage("Neuer Rekord!", "lob");
        }
        // Fieber: Funken hinter dem Läufer
        if (w.fieber > 1 && !reduziert.current && Math.floor(w.t * 12) !== Math.floor((w.t - dt) * 12)) {
          const a = aufSchirm(w.spur, 0, 0.3 + hoehe);
          const cl = zuClient(a.x, a.y);
          funkenRef.current?.burst(cl.x, cl.y + 6, w.fieber === 3 ? "#ff5dc8" : "#ffb21f", { n: 2, kraft: 0.35 });
        }
      } else if (w.aus !== null) w.aus += dt;
      for (const x of w.weg) x.t += dt;
      w.weg = w.weg.filter((x) => x.t < 1.2);
      w.wackeln = Math.max(0, w.wackeln - dt);
      if (punkteEl.current) punkteEl.current.textContent = Math.floor(w.punkte).toLocaleString("de-AT");
      if (meterEl.current) meterEl.current.textContent = `${Math.floor(w.spieler).toLocaleString("de-AT")} m`;
      zeichne(g, w, berge, himmelSterne);
    };
    id = requestAnimationFrame(schritt);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      document.removeEventListener("visibilitychange", sichtbar);
    };
    // die Schleife liest alles über Refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Punkte regelmäßig an das Spiel melden (für das Ende), nicht in jedem Frame
  useEffect(() => {
    const t = setInterval(() => cb.current.onPunkte(Math.floor(welt.current.punkte)), 1000);
    return () => clearInterval(t);
  }, []);

  // ---------- 3, 2, 1, los ----------

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      welt.current.laeuft = true;
      const t = setTimeout(() => setCountdown(null), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(countdown - 1), reduziert.current ? 400 : 650);
    return () => clearTimeout(t);
  }, [countdown]);

  // ---------- Steuern ----------

  const geheZu = useCallback((spur: number) => {
    const w = welt.current;
    if (w.aus !== null) return;
    const neu = Math.max(0, Math.min(2, spur));
    if (neu === w.ziel) return;
    w.ziel = neu;
    setZiel(neu);
    klang.heben();
  }, []);
  const springe = useCallback(() => {
    const w = welt.current;
    if (w.aus !== null || !w.laeuft || w.sprung !== null) return;
    w.sprung = 0;
    klang.sprung();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const w = welt.current;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") geheZu(w.ziel - 1);
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") geheZu(w.ziel + 1);
      else if (e.key === "ArrowUp" || e.key === " " || e.key === "w" || e.key === "W") springe();
      else if (/^[1-3]$/.test(e.key)) {
        const o = offen.current?.optionen;
        const n = Number(e.key) - 1;
        if (o && n < o.length) geheZu(torSpuren(o.length)[n]);
        else geheZu(n);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [geheZu, springe]);

  const geste = useRef<{ id: number; x: number; y: number; t: number; bewegt: boolean } | null>(null);
  const runter = (e: ReactPointerEvent<HTMLDivElement>) => {
    geste.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), bewegt: false };
  };
  const zieht = (e: ReactPointerEvent<HTMLDivElement>) => {
    const z = geste.current;
    if (!z || z.id !== e.pointerId) return;
    const dx = e.clientX - z.x;
    const dy = e.clientY - z.y;
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) {
      geheZu(welt.current.ziel + (dx > 0 ? 1 : -1));
      // ein langer Wisch geht über zwei Spuren
      z.x = e.clientX;
      z.y = e.clientY;
      z.bewegt = true;
    } else if (dy < -26 && Math.abs(dy) > Math.abs(dx) && !z.bewegt) {
      springe();
      z.bewegt = true;
    }
  };
  const hoch = (e: ReactPointerEvent<HTMLDivElement>) => {
    const z = geste.current;
    geste.current = null;
    if (!z || z.id !== e.pointerId || z.bewegt || performance.now() - z.t > 350) return;
    // antippen: links oder rechts vom Läufer
    const r = e.currentTarget.getBoundingClientRect();
    const laeufer = aufSchirm(welt.current.spur, 0).x;
    geheZu(welt.current.ziel + (e.clientX - r.left < laeufer ? -1 : 1));
  };

  // ---------- Darstellung ----------

  const kartenStand: Stand = frage?.stand ? { wahl: frage.optionen[frage.stand.i], richtig: frage.stand.ok } : null;
  const spuren = frage ? torSpuren(frage.optionen.length) : [];
  const lang = frage ? frage.optionen.some((o) => o.length > 12) : false;

  return (
    <div className="tl" data-fieber={faktor > 1 ? faktor : undefined} data-aus={herzen <= 0 ? "" : undefined} data-testid="tl">
      <Funkenregen ref={funkenRef} />
      <div className="tl-frage" data-leer={frage ? undefined : ""} data-stand={frage?.stand ? (frage.stand.ok ? "richtig" : "falsch") : undefined}>
        {frage ? (
          <>
            <div className="bwf-blatt tl-blatt" key={frage.id} data-testid="tl-frage">
              <p className="bwf-auftrag">{frage.stand ? (frage.stand.ok ? "Richtig!" : `Richtig ist: ${frage.karte.richtig}`) : (frage.karte.auftrag ?? "Lauf durch das richtige Tor.")}</p>
              <div className="bwf-satz">
                <KartenInhalt karte={frage.karte} stand={kartenStand} />
              </div>
            </div>
            <div className="tl-antworten" data-lang={lang ? "" : undefined} role="group" aria-label="Antworten: tipp eine an, um auf ihre Spur zu wechseln">
              {frage.optionen.map((o, i) => {
                const spur = spuren[i];
                return (
                  <button
                    key={o}
                    type="button"
                    className="tl-antwort ohne-druck"
                    style={{ "--farbe": TOR_FARBEN[spur], "--dunkel": TOR_DUNKEL[spur], gridColumn: spur + 1 } as CSSProperties}
                    data-hier={ziel === spur && !frage.stand ? "" : undefined}
                    data-richtig={frage.stand && frage.optionen[i] === frage.karte.richtig ? "" : undefined}
                    data-falsch={frage.stand && !frage.stand.ok && frage.stand.i === i ? "" : undefined}
                    onClick={() => geheZu(spur)}
                    aria-keyshortcuts={String(i + 1)}
                    data-testid={`tl-antwort-${i}`}
                  >
                    <span>{gesetzt(frage.karte, o)}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="tl-warte">{karte ? "Gleich kommt die nächste Frage …" : "Neue Fragen werden gemischt …"}</p>
        )}
      </div>

      <div ref={flaeche} className="tl-flaeche" onPointerDown={runter} onPointerMove={zieht} onPointerUp={hoch} onPointerCancel={() => (geste.current = null)} data-testid="tl-strecke">
        <canvas
          ref={(el) => {
            leinwand.current = el;
            // für Tests: der Stand der Welt, ohne ihn in jedem Frame in das DOM zu schreiben
            if (el) (el as HTMLCanvasElement & { torlauf?: () => unknown }).torlauf = () => ({ ...welt.current, dinge: welt.current.dinge.slice(0, 20) });
          }}
          className="tl-leinwand"
          aria-label="Laufstrecke: wisch nach links oder rechts, um die Spur zu wechseln, nach oben, um zu springen"
          role="img"
        />
        <div className="tl-stand">
          <div className="tl-links">
            <div className="tl-herzen" role="img" aria-label={`${herzen} von ${TOR_HERZEN} Herzen`} data-testid="tl-herzen">
              {Array.from({ length: TOR_HERZEN }, (_, i) => (
                <Heart key={i} size={20} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
              ))}
            </div>
            <span className="bw-serie" data-fieber={faktor > 1 ? "" : undefined} aria-label={faktor > 1 ? `Fieber: Punkte mal ${faktor}` : `${serie} von ${TOR_FIEBER_AB} richtigen Antworten bis zum Fieber`} data-testid="tl-serie">
              <Flame size={16} strokeWidth={2.2} fill={serie > 0 ? "currentColor" : "none"} aria-hidden />
              {faktor > 1 ? (
                <b key={faktor}>×{faktor}</b>
              ) : (
                <span className="bw-serie-punkte" aria-hidden>
                  {Array.from({ length: TOR_FIEBER_AB }, (_, i) => (
                    <i key={i} data-an={i < serie ? "" : undefined} />
                  ))}
                </span>
              )}
            </span>
          </div>
          <div className="tl-punkte" aria-hidden data-testid="tl-punkte">
            <b ref={punkteEl}>0</b>
            <small>{rekord > 0 ? `Rekord ${rekord.toLocaleString("de-AT")}` : "Punkte"}</small>
          </div>
          <div className="tl-rechts">
            <span className="tl-meter" ref={meterEl} aria-hidden>
              0 m
            </span>
            <span className="tl-strecke-nr">Strecke {strecke}</span>
          </div>
        </div>
        {frage?.stand && !frage.stand.ok && frage.karte.regel && (
          <p className="bwf-regel tl-regel" role="status">
            <Lightbulb size={16} aria-hidden /> {gesetzt(frage.karte, frage.karte.regel)}
          </p>
        )}
        {countdown !== null && (
          <p className="tl-countdown" key={countdown} aria-live="polite">
            {countdown > 0 ? countdown : "Los!"}
          </p>
        )}
        {ansage.map((a) => (
          <p key={a.n} className="bw-ansage tl-ansage" data-art={a.art === "punkte" ? undefined : a.art === "herz" || a.art === "strecke" ? "lob" : a.art === "aua" ? undefined : a.art} data-tl={a.art} data-wo={a.x !== undefined ? "" : undefined} style={a.x !== undefined ? ({ "--x": `${Math.min(80, Math.max(20, a.x))}%`, "--y": `${Math.min(85, Math.max(12, a.y!))}%` } as CSSProperties) : undefined} aria-hidden>
            {a.text}
          </p>
        ))}
        {countdown !== null && countdown > 0 && <p className="tl-tipp">Wisch nach links und rechts. Nach oben springt.</p>}
      </div>
    </div>
  );

  // ---------- Zeichnen ----------

  function zeichne(g: CanvasRenderingContext2D, w: Welt, berge: { x: number; h: number }[], himmelSterne: { x: number; y: number; r: number }[]) {
    const { w: W, h: H } = masse.current;
    const look = lookFuer(streckeNach(toreRef.current));
    const pr0 = projektion(0);
    const { horizont, spurBreite } = pr0;
    const hoehe = sprungHoehe(w.sprung ?? 0);
    g.save();
    if (w.wackeln > 0 && !reduziert.current) {
      const a = w.wackeln * 22;
      g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.6);
    }
    // Himmel
    const himmel = g.createLinearGradient(0, 0, 0, horizont);
    himmel.addColorStop(0, look.oben);
    himmel.addColorStop(1, look.unten);
    g.fillStyle = himmel;
    g.fillRect(-20, -20, W + 40, horizont + 22);
    if (look.nacht) {
      g.fillStyle = "#ffffff";
      for (const st of himmelSterne) {
        g.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(w.t * 1.3 + st.x * 20));
        g.beginPath();
        g.arc(st.x * W, st.y * horizont * 0.9, st.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (look.licht) {
      // Polarlicht: weiche Bänder, die sich langsam wiegen
      for (let b = 0; b < 3; b++) {
        g.beginPath();
        g.moveTo(0, horizont * (0.3 + b * 0.12));
        for (let x = 0; x <= W; x += 20) g.lineTo(x, horizont * (0.3 + b * 0.12) + Math.sin(x / 60 + w.t * 0.6 + b) * 14);
        g.lineTo(W, 0);
        g.lineTo(0, 0);
        g.closePath();
        g.fillStyle = b === 1 ? "rgba(80, 255, 190, 0.12)" : "rgba(120, 140, 255, 0.10)";
        g.fill();
      }
    }
    // Sonne oder Mond
    const sx = W * 0.78;
    const sy = horizont * 0.42;
    const glanz = g.createRadialGradient(sx, sy, 2, sx, sy, 60);
    glanz.addColorStop(0, look.sonne);
    glanz.addColorStop(0.35, look.sonne + "aa");
    glanz.addColorStop(1, look.sonne + "00");
    g.fillStyle = glanz;
    g.beginPath();
    g.arc(sx, sy, 60, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.sonne;
    g.beginPath();
    g.arc(sx, sy, 18, 0, Math.PI * 2);
    g.fill();
    // Berge (ein wenig Bewegung mit der Spur)
    const verschieb = (w.spur - 1) * -8;
    g.fillStyle = look.berge;
    g.beginPath();
    g.moveTo(-30, horizont + 1);
    berge.forEach((b, i) => {
      const x = -30 + b.x * (W + 60) + verschieb;
      g.lineTo(x - 30, horizont - b.h * 40 * (i % 2 ? 0.7 : 1));
      g.lineTo(x + 10, horizont - b.h * 26);
    });
    g.lineTo(W + 30, horizont + 1);
    g.closePath();
    g.fill();
    // Wiese
    const wiese = g.createLinearGradient(0, horizont, 0, H);
    wiese.addColorStop(0, look.wieseFern);
    wiese.addColorStop(0.35, look.wiese);
    wiese.addColorStop(1, look.wiese);
    g.fillStyle = wiese;
    g.fillRect(-20, horizont, W + 40, H - horizont + 20);

    const camX = kameraX();
    const pt = (spur: number, z: number) => {
      const pr = projektion(z);
      return { x: camX + (spur - 1) * spurBreite * pr.p, y: pr.y, p: pr.p };
    };
    // der Weg (ein Trapez bis zum Horizont), mit Streifen, die mitlaufen
    const fern = 400;
    const nah = -5.5;
    const rand = (z: number, seite: number) => pt(1 + seite * 1.62, z);
    g.fillStyle = look.weg;
    g.beginPath();
    const a1 = rand(fern, -1);
    const a2 = rand(fern, 1);
    const b1 = rand(nah, -1);
    const b2 = rand(nah, 1);
    g.moveTo(a1.x, a1.y);
    g.lineTo(a2.x, a2.y);
    g.lineTo(b2.x, b2.y);
    g.lineTo(b1.x, b1.y);
    g.closePath();
    g.fill();
    // die Kanten des Wegs leuchten im Fieber
    g.lineWidth = 3;
    g.strokeStyle = w.fieber > 1 ? (w.fieber === 3 ? "#ff7ad9" : "#ffb21f") : "rgba(255,255,255,0.55)";
    if (w.fieber > 1) {
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = 14;
    }
    g.beginPath();
    g.moveTo(a1.x, a1.y);
    g.lineTo(b1.x, b1.y);
    g.moveTo(a2.x, a2.y);
    g.lineTo(b2.x, b2.y);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = look.streifen;
    const band = 4;
    for (let k = Math.floor((w.spieler + nah) / band); k * band < w.spieler + SICHT * 1.5; k++) {
      if (k % 2) continue;
      const z1 = k * band - w.spieler;
      const z2 = z1 + band;
      if (z2 < nah) continue;
      const p1 = rand(Math.max(nah, z1), -1);
      const p2 = rand(Math.max(nah, z1), 1);
      const p3 = rand(z2, 1);
      const p4 = rand(z2, -1);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.fill();
    }
    // die Spuren: gestrichelte Linien
    g.strokeStyle = "rgba(255,255,255,0.8)";
    for (const seite of [0.5, 1.5]) {
      for (let k = Math.floor((w.spieler + nah) / 3); k * 3 < w.spieler + SICHT; k++) {
        const z1 = k * 3 - w.spieler;
        if (z1 + 1.4 < nah) continue;
        const p1 = pt(seite, Math.max(nah, z1));
        const p2 = pt(seite, z1 + 1.4);
        g.lineWidth = Math.max(1, 4 * p1.p);
        g.beginPath();
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.stroke();
      }
    }
    // Bäume links und rechts, von hinten nach vorn
    for (let k = Math.ceil((w.spieler + SICHT) / 7); k * 7 > w.spieler - 4; k--) {
      const z = k * 7 - w.spieler;
      for (const seite of [-1, 1]) {
        const versatz = ((k * 7919 + (seite > 0 ? 3 : 0)) % 5) / 10;
        const q = pt(1 + seite * (2.3 + versatz), z);
        if (q.y > H + 80) continue;
        baum(g, q.x, q.y, spurBreite * q.p, (k + (seite > 0 ? 1 : 0)) % 3, look);
      }
    }

    // die Dinge auf dem Weg, von hinten nach vorn (mit dem Tor dazwischen)
    type Zeichen = { z: number; mal: () => void };
    const liste: Zeichen[] = [];
    for (const d of w.dinge) {
      const z = d.s - w.spieler;
      if (z > SICHT || z < -4) continue;
      liste.push({ z, mal: () => ding(g, d.art, d.spur, z, 0, 1) });
    }
    for (const x of w.weg) {
      const z = x.s - w.spieler;
      if (z < -4) continue;
      liste.push({ z, mal: () => ding(g, x.art, x.spur, z, x.t, 1 - x.t / 1.2) });
    }
    for (const tor of [w.tor, w.alt]) {
      if (!tor || tor.s - w.spieler > SICHT * 1.3) continue;
      const z = tor.s - w.spieler;
      liste.push({ z, mal: () => torReihe(g, tor, z) });
    }
    liste.sort((a, b) => b.z - a.z);
    for (const x of liste) if (x.z > 0.3) x.mal();
    // der Läufer
    laeufer(g, w, camX, pr0.boden, spurBreite, hoehe);
    // was schon am Läufer vorbei ist, liegt davor
    for (const x of liste) if (x.z <= 0.3) x.mal();
    g.restore();

    function ding(g: CanvasRenderingContext2D, art: Ding["art"], spur: number, z: number, flug: number, alpha: number) {
      const q = pt(spur, z);
      const s = spurBreite * q.p;
      if (q.y > H + s || s < 1) return;
      g.save();
      g.globalAlpha = Math.max(0, alpha);
      if (flug > 0) {
        // getroffen: fliegt drehend weg
        g.translate(q.x + flug * s * 1.8 * (spur <= 1 ? -1 : 1), q.y - flug * s * 2.4 + flug * flug * s * 2);
        g.rotate(flug * 5 * (spur <= 1 ? -1 : 1));
      } else g.translate(q.x, q.y);
      if (art === "stern") {
        const r = s * 0.18;
        const schweb = Math.sin(w.t * 4 + spur + z) * s * 0.05;
        g.translate(0, -s * 0.5 + schweb);
        g.scale(Math.max(0.25, Math.abs(Math.cos(w.t * 3 + z * 0.5))), 1);
        g.shadowColor = "rgba(255, 210, 60, 0.9)";
        g.shadowBlur = Math.min(16, r);
        g.fillStyle = "#ffd34d";
        g.strokeStyle = "#fff6c2";
        g.lineWidth = Math.max(1, r * 0.14);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.stroke();
      } else if (art === "kiste") {
        const b = s * 0.78;
        const h = s * 0.7;
        // Schatten
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.beginPath();
        g.ellipse(0, 0, b * 0.6, s * 0.08, 0, 0, Math.PI * 2);
        g.fill();
        // Deckel (etwas Tiefe)
        g.fillStyle = "#e0a865";
        g.beginPath();
        g.moveTo(-b / 2, -h);
        g.lineTo(b / 2, -h);
        g.lineTo(b * 0.42, -h - s * 0.12);
        g.lineTo(-b * 0.42, -h - s * 0.12);
        g.closePath();
        g.fill();
        g.fillStyle = "#c98443";
        rund(g, -b / 2, -h, b, h, s * 0.05);
        g.fill();
        g.strokeStyle = "#8a5222";
        g.lineWidth = Math.max(1, s * 0.035);
        g.stroke();
        // Bretter und Kreuz
        g.beginPath();
        g.moveTo(-b / 2 + s * 0.05, -h + s * 0.05);
        g.lineTo(b / 2 - s * 0.05, -s * 0.05);
        g.moveTo(b / 2 - s * 0.05, -h + s * 0.05);
        g.lineTo(-b / 2 + s * 0.05, -s * 0.05);
        g.stroke();
      } else {
        // Hürde: zwei Pfosten, ein gestreifter Balken
        const b = s * 0.86;
        const h = s * 0.34;
        g.fillStyle = "#ececf4";
        g.fillRect(-b / 2, -h - s * 0.02, s * 0.06, h + s * 0.02);
        g.fillRect(b / 2 - s * 0.06, -h - s * 0.02, s * 0.06, h + s * 0.02);
        const bh = s * 0.13;
        g.save();
        rund(g, -b / 2, -h - bh / 2, b, bh, bh / 2);
        g.clip();
        g.fillStyle = "#ffffff";
        g.fillRect(-b / 2, -h - bh / 2, b, bh);
        g.fillStyle = "#ff4d5e";
        for (let x = -b / 2 - bh; x < b / 2; x += bh * 1.6) {
          g.beginPath();
          g.moveTo(x, -h + bh / 2);
          g.lineTo(x + bh * 0.8, -h + bh / 2);
          g.lineTo(x + bh * 1.6, -h - bh / 2);
          g.lineTo(x + bh * 0.8, -h - bh / 2);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
      g.restore();
    }

    function torReihe(g: CanvasRenderingContext2D, tor: Tor, z: number) {
      const spuren = torSpuren(tor.optionen.length);
      // zwei Antworten: in der Mitte eine Mauer
      if (spuren.length === 2 && !(tor.durch && tor.spur === 1)) {
        const q = pt(1, z);
        const s = spurBreite * q.p;
        g.fillStyle = "#8b93a8";
        rund(g, q.x - s * 0.42, q.y - s * 0.9, s * 0.84, s * 0.9, s * 0.06);
        g.fill();
        g.strokeStyle = "#5d6478";
        g.lineWidth = Math.max(1, s * 0.03);
        g.stroke();
        g.beginPath();
        for (let r = 1; r < 4; r++) {
          g.moveTo(q.x - s * 0.42, q.y - (s * 0.9 * r) / 4);
          g.lineTo(q.x + s * 0.42, q.y - (s * 0.9 * r) / 4);
        }
        g.stroke();
      }
      tor.optionen.forEach((text, i) => {
        const spur = spuren[i];
        const q = pt(spur, z);
        const s = spurBreite * q.p;
        if (s < 2) return;
        const b = s * 0.94;
        const h = s * 1.05;
        const pfosten = Math.max(2, s * 0.07);
        g.fillStyle = TOR_DUNKEL[spur];
        g.fillRect(q.x - b / 2, q.y - h, pfosten, h);
        g.fillRect(q.x + b / 2 - pfosten, q.y - h, pfosten, h);
        if (!tor.durch || tor.spur !== spur) {
          // die Scheibe mit der Antwort
          g.fillStyle = TOR_FARBEN[spur] + "d9";
          rund(g, q.x - b / 2 + pfosten, q.y - h * 0.92, b - 2 * pfosten, h * 0.6, s * 0.06);
          g.fill();
          g.strokeStyle = "rgba(255,255,255,0.75)";
          g.lineWidth = Math.max(1, s * 0.025);
          g.stroke();
          const groesse = Math.max(0, s * 0.2);
          if (groesse >= 5) {
            g.fillStyle = "#ffffff";
            g.textAlign = "center";
            g.textBaseline = "middle";
            const platz = b - 2 * pfosten - s * 0.08;
            let fs = groesse;
            g.font = `800 ${fs}px system-ui, sans-serif`;
            let zeilen = [text];
            if (g.measureText(text).width > platz && text.includes(" ")) {
              const woerter = text.split(" ");
              const mitte = Math.ceil(woerter.length / 2);
              zeilen = [woerter.slice(0, mitte).join(" "), woerter.slice(mitte).join(" ")];
            }
            const breit = Math.max(...zeilen.map((zl) => g.measureText(zl).width));
            if (breit > platz) fs = Math.max(4, (fs * platz) / breit);
            g.font = `800 ${fs}px system-ui, sans-serif`;
            g.lineWidth = Math.max(1, fs * 0.18);
            g.strokeStyle = TOR_DUNKEL[spur];
            const y0 = q.y - h * 0.62 - ((zeilen.length - 1) * fs * 1.05) / 2;
            zeilen.forEach((zl, j) => {
              g.strokeText(zl, q.x, y0 + j * fs * 1.05);
              g.fillText(zl, q.x, y0 + j * fs * 1.05);
            });
          }
        }
        // Balken oben
        g.fillStyle = TOR_FARBEN[spur];
        rund(g, q.x - b / 2 - s * 0.03, q.y - h - s * 0.1, b + s * 0.06, s * 0.13, s * 0.05);
        g.fill();
      });
    }
  }
}

function rund(g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, b / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + b, y, x + b, y + h, rr);
  g.arcTo(x + b, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + b, y, rr);
  g.closePath();
}

function baum(g: CanvasRenderingContext2D, x: number, y: number, s: number, sorte: number, look: Look) {
  if (s < 1) return;
  g.fillStyle = look.nacht ? "#3b2c3e" : "#8a5a33";
  g.fillRect(x - s * 0.05, y - s * 0.55, s * 0.1, s * 0.55);
  g.fillStyle = look.nacht ? (sorte === 1 ? "#1f4a3c" : "#255a46") : sorte === 1 ? "#3fae4f" : sorte === 2 ? "#5cc45a" : "#2f9a48";
  g.beginPath();
  if (sorte === 1) {
    g.moveTo(x, y - s * 1.35);
    g.lineTo(x + s * 0.38, y - s * 0.45);
    g.lineTo(x - s * 0.38, y - s * 0.45);
    g.closePath();
  } else g.arc(x, y - s * 0.8, s * (sorte === 2 ? 0.34 : 0.4), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.beginPath();
  g.arc(x - s * 0.12, y - s * (sorte === 1 ? 0.85 : 0.92), s * 0.12, 0, Math.PI * 2);
  g.fill();
}

/** Der Läufer von hinten: ein runder Flitzer mit Schulrucksack. */
function laeufer(g: CanvasRenderingContext2D, w: Welt, camX: number, boden: number, spurBreite: number, hoehe: number) {
  const x = camX + (w.spur - 1) * spurBreite;
  const r = spurBreite * 0.24;
  const lauf = w.aus === null && w.laeuft;
  const phase = w.schritt * 2.2;
  const bob = lauf && hoehe === 0 ? Math.abs(Math.sin(phase)) * r * 0.14 : 0;
  // Landung: kurz breit und flach
  const quetsch = w.landung < 0.14 ? 1 - Math.sin((w.landung / 0.14) * Math.PI) * 0.16 : 1;
  const y = boden - hoehe * spurBreite * 0.75 - bob;
  // Schatten
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(x, boden + r * 0.08, r * (0.95 - hoehe * 0.25), r * 0.22 * (1 - hoehe * 0.3), 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(x, y);
  if (w.aus !== null) {
    // hingefallen: kippt zur Seite
    g.rotate(Math.min(1.3, w.aus * 3));
    g.translate(0, Math.min(r * 0.4, w.aus * r));
  } else g.rotate((w.ziel - w.spur) * -0.35);
  g.scale(1 / quetsch, quetsch);
  if (w.unverwundbar > 0 && Math.floor(w.unverwundbar * 10) % 2 === 0) g.globalAlpha = 0.45;
  // Beine
  const bein = lauf ? Math.sin(phase) * r * 0.32 : 0;
  g.fillStyle = "#24305e";
  rund(g, -r * 0.5, -r * 0.55 + bein, r * 0.36, r * 0.62, r * 0.18);
  g.fill();
  rund(g, r * 0.14, -r * 0.55 - bein, r * 0.36, r * 0.62, r * 0.18);
  g.fill();
  // Fieber: ein Leuchten
  if (w.fieber > 1) {
    g.shadowColor = w.fieber === 3 ? "#ff5dc8" : "#ffb21f";
    g.shadowBlur = r * 0.9;
  }
  // Körper
  const koerper = g.createRadialGradient(-r * 0.3, -r * 1.55, r * 0.2, 0, -r * 1.1, r * 1.1);
  koerper.addColorStop(0, "#ffb36b");
  koerper.addColorStop(1, "#ff6a2b");
  g.fillStyle = koerper;
  g.beginPath();
  g.ellipse(0, -r * 1.12, r, r * 0.95, 0, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  // Ohren
  g.beginPath();
  g.ellipse(-r * 0.6, -r * 1.95, r * 0.22, r * 0.3, -0.4, 0, Math.PI * 2);
  g.ellipse(r * 0.6, -r * 1.95, r * 0.22, r * 0.3, 0.4, 0, Math.PI * 2);
  g.fillStyle = "#ff7a35";
  g.fill();
  // Arme schwingen
  const arm = lauf ? Math.sin(phase + Math.PI) * r * 0.25 : 0;
  g.fillStyle = "#ff7a35";
  g.beginPath();
  g.ellipse(-r * 0.98, -r * 1.0 + arm, r * 0.2, r * 0.3, 0.3, 0, Math.PI * 2);
  g.ellipse(r * 0.98, -r * 1.0 - arm, r * 0.2, r * 0.3, -0.3, 0, Math.PI * 2);
  g.fill();
  // Rucksack mit Riemen und einem Stern
  g.strokeStyle = "#1d4fb8";
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.moveTo(-r * 0.45, -r * 1.75);
  g.lineTo(-r * 0.5, -r * 1.25);
  g.moveTo(r * 0.45, -r * 1.75);
  g.lineTo(r * 0.5, -r * 1.25);
  g.stroke();
  g.fillStyle = "#2f7bff";
  rund(g, -r * 0.55, -r * 1.62, r * 1.1, r * 1.0, r * 0.3);
  g.fill();
  g.fillStyle = "#5c9dff";
  rund(g, -r * 0.55, -r * 1.62, r * 1.1, r * 0.34, r * 0.3);
  g.fill();
  g.fillStyle = "#ffd34d";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.08 : r * 0.18;
    g.lineTo(Math.cos(a) * rr, -r * 1.05 + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  // Haarbüschel
  g.strokeStyle = "#e2521d";
  g.lineWidth = r * 0.1;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, -r * 2.02);
  g.quadraticCurveTo(r * 0.25, -r * 2.35, r * 0.05, -r * 2.45);
  g.stroke();
  g.restore();
}
