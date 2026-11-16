"use client";

import "./blockwerk.css";
import { Flame, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { blitz, blitzFelder, BLITZE_MAX, FRAGE_PUNKTE, BLITZE_START, leeresBrett, naechsteKombo, neueTeile, passt, punkteFuer, SEITE, setze, steckt, wuerdeRaeumen, type Brett, type Teil, type Zug } from "@/lib/blockwerk";
import { Funkenregen, type FunkenApi } from "./Funkenregen";
import { klang } from "./klang";
import { vibriere } from "./SpielTeile";

/**
 * Blockwerk (lib/blockwerk.ts, docs/lernspiele.md „Blockwerk“): das Brett mit 8 × 8 Feldern und drei Teilen darunter.
 * Ein Teil wird aufs Brett gezogen; volle Reihen und Spalten verschwinden. Sind alle drei gelegt, fragt das Feld nach
 * neuen Teilen (`onFrage`): Lernspiel.tsx zeigt dann eine Karte aus dem Stoff, und mit `antwort` kommen die Teile.
 * Beim ersten Versuch richtig gibt es 60 Punkte dazu (FRAGE_PUNKTE), und der Blitz lädt: drei richtige Antworten sind ein Blitz, der
 * 3 × 3 Felder frei räumt (erst bekam jede richtige Antwort einen; dann endete ein Spiel kaum). Passt kein Teil mehr und
 * ist kein Blitz da, kommt eine Rettungsfrage: richtig gibt einen Blitz, sonst ist das Spiel aus (`onEnde`).
 *
 * Damit es packt (niko 2026-11-16: „süchtig machen … zu wenig flashyness“): die Frage schiebt sich unter dem Brett hoch
 * (`frage`, components/lernen/BrettFrage.tsx), das Brett bleibt stehen. Drei Antworten beim ersten Versuch hintereinander
 * sind **Fieber**: alles zählt doppelt (ab sechs dreifach), bis eine Antwort falsch ist. Eine schnelle Antwort bringt
 * einen Bonus. Dazu Töne (klang.ts), Funken aus jeder geräumten Zelle (Funkenregen.tsx), ein Wackeln bei mehreren
 * Linien, große Lobwörter und Punkte, die hochzählen.
 *
 * Ziehen läuft ohne React-Zustand je Bewegung (nur transform am gezogenen Teil); neu gezeichnet wird nur, wenn das
 * Teil über ein anderes Feld rückt. Am Finger schwebt das Teil über dem Finger, damit man sieht, wo es landet.
 */

/** `ladung`: wie viele richtige Antworten der Blitz schon geladen hat (0 bis 2, bei drei gibt es einen) */
export type BlockFrage = { grund: "teile" | "rettung"; vorschau: Teil[]; ladung: number };
/** So viele richtige Antworten sind ein Blitz. */
export const LADUNG = 3;
/** `schnell`: richtig innerhalb der Zeit der Frage (BrettFrage SCHNELL_MS) */
export type BlockAntwort = { n: number; sauber: boolean; schnell?: boolean };
/** So viele richtige Antworten am Stück sind Fieber (Punkte mal zwei), doppelt so viele mal drei. */
export const FIEBER_AB = 3;
export const fieberFaktor = (serie: number) => (serie >= FIEBER_AB * 2 ? 3 : serie >= FIEBER_AB ? 2 : 1);
/** Bonus für eine schnelle richtige Antwort (mal dem Fieber). */
export const SCHNELL_PUNKTE = 30;
/** Die Farben der Teile für die Funken (wie --b-unten in blockwerk.css). */
const FUNKEN_FARBEN = ["#3d86ff", "#ff5d50", "#22c283", "#ffb21f", "#8f6cff"];
/** Lob nach der Zahl der Linien auf einmal */
const LOB = ["", "", "Super!", "Stark!", "Wahnsinn!"];

type Ansage = { n: number; text: string; art: "punkte" | "kombo" | "blitz" | "frei" | "lob" | "fieber"; x?: number; y?: number };
type Vorschau = { r: number; s: number; ok: boolean; zellen: Set<number>; raeumt: Set<number>; farbe: number } | null;
/** `zelle`: Kante eines Felds, `schritt`: Feld plus Lücke (so weit liegen zwei Felder auseinander) */
type Zieh = { slot: number; teil: Teil; id: number; ox: number; oy: number; zelle: number; schritt: number; r: number; s: number; maus: boolean };
/** Rand und Lücke des Bretts in px (wie in blockwerk.css) */
const RAND = 6;
const LUECKE = 3;

export function BlockFeld({
  aktiv,
  frage,
  antwort,
  onFrage,
  onPunkte,
  onEnde,
  rekord,
}: {
  /** false, solange die Frage über dem Brett liegt (ohne `frage`: auf eigenem Bildschirm) */
  aktiv: boolean;
  /** die Frage unter dem Brett, wo sonst die Teile liegen */
  frage?: ReactNode;
  antwort: BlockAntwort | null;
  onFrage: (f: BlockFrage) => void;
  onPunkte: (punkte: number) => void;
  onEnde: () => void;
  /** der beste Stand bisher (0: noch keiner) */
  rekord: number;
}) {
  const [brett, setBrett] = useState<Brett>(leeresBrett);
  const [teile, setTeile] = useState<(Teil | null)[]>(() => neueTeile(leeresBrett()));
  const [punkte, setPunkte] = useState(0);
  const [kombo, setKombo] = useState({ kombo: 0, ohne: 0 });
  const [blitze, setBlitze] = useState(BLITZE_START);
  const [ladung, setLadung] = useState(0);
  const [zielen, setZielen] = useState(false);
  const [lage, setLage] = useState<"spiel" | "eng" | "frage" | "aus">("spiel");
  const [weg, setWeg] = useState<{ i: number; farbe: number; v: number; n: number }[]>([]);
  const [ansage, setAnsage] = useState<Ansage[]>([]);
  const [vorschau, setVorschau] = useState<Vorschau>(null);
  const [zieht, setZieht] = useState<Zieh | null>(null);
  const [gelandet, setGelandet] = useState<{ zellen: Set<number>; n: number } | null>(null);
  const [blitzZiel, setBlitzZiel] = useState<number | null>(null);
  // richtige Antworten beim ersten Versuch am Stück (ab FIEBER_AB: Fieber)
  const [serie, setSerie] = useState(0);
  const faktor = fieberFaktor(serie);
  const funkenRef = useRef<FunkenApi | null>(null);
  const rekordGeknackt = useRef(false);

  const brettRef = useRef<HTMLDivElement | null>(null);
  const ziehRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const zug = useRef<Zieh | null>(null);
  const wartend = useRef<BlockFrage | null>(null);
  const zaehler = useRef(0);
  const reduziert = useRef(false);
  const antwortN = useRef(0);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => onPunkte(punkte), [punkte, onPunkte]);

  /** `x`, `y`: wo am Brett (in %, sonst in der Mitte) */
  const sage = useCallback((text: string, art: Ansage["art"], wo?: { x: number; y: number }) => {
    const n = ++zaehler.current;
    setAnsage((a) => [...a.slice(-3), { n, text, art, ...wo }]);
    setTimeout(() => setAnsage((a) => a.filter((x) => x.n !== n)), art === "lob" || art === "fieber" ? 1500 : 1300);
  }, []);

  /** Die Mitte eines Felds auf dem Bildschirm (für die Funken). */
  const feldMitte = useCallback((i: number) => {
    const b = brettRef.current;
    if (!b) return null;
    const rect = b.getBoundingClientRect();
    const zelle = (rect.width - 2 * RAND - (SEITE - 1) * LUECKE) / SEITE;
    return { x: rect.left + RAND + (i % SEITE) * (zelle + LUECKE) + zelle / 2, y: rect.top + RAND + Math.floor(i / SEITE) * (zelle + LUECKE) + zelle / 2 };
  }, []);

  /** Das Brett wackelt (mehrere Linien, leeres Brett, Blitz). */
  const wackle = useCallback((staerke: number) => {
    const b = brettRef.current;
    if (!b?.animate || reduziert.current) return;
    const d = Math.min(9, 2 + staerke * 2);
    b.animate([{ translate: "0 0" }, { translate: `${-d}px ${d * 0.4}px` }, { translate: `${d * 0.8}px ${-d * 0.5}px` }, { translate: `${-d * 0.5}px ${d * 0.3}px` }, { translate: `${d * 0.25}px 0` }, { translate: "0 0" }], {
      duration: 320,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }, []);

  const zeigeWeg = useCallback(
    (z: Zug, von: number | null) => {
      if (!z.weg.length) return;
      const n = ++zaehler.current;
      // von der Stelle aus, an der das Teil lag, nach außen: die Linie „läuft“ weg
      const r0 = von === null ? 3.5 : Math.floor(von / SEITE);
      const s0 = von === null ? 3.5 : von % SEITE;
      const mitV = z.weg.map((x) => ({ ...x, n, v: Math.round(Math.hypot(Math.floor(x.i / SEITE) - r0, (x.i % SEITE) - s0) * 22) }));
      setWeg((w) => [...w, ...mitV]);
      setTimeout(() => setWeg((w) => w.filter((x) => x.n !== n)), 700);
      // aus jeder Zelle fliegen Funken, mit der Welle nach außen
      const viele = mitV.length > 24;
      for (const x of mitV) {
        const m = feldMitte(x.i);
        if (m) funkenRef.current?.burst(m.x, m.y, FUNKEN_FARBEN[x.farbe] ?? "#ffffff", { n: viele ? 4 : 6, verzoegerung: x.v / 1000 + 0.06, kraft: 0.8 });
      }
    },
    [feldMitte],
  );

  /** Nach einem Zug oder neuen Teilen: steckt das Spiel? Dann Blitz, sonst Rettungsfrage. */
  const pruefe = useCallback(
    (b: Brett, t: (Teil | null)[], bl: number) => {
      if (!steckt(b, t)) {
        setLage("spiel");
        return;
      }
      if (bl > 0) {
        setLage("eng");
        setZielen(true);
        return;
      }
      const f: BlockFrage = { grund: "rettung", vorschau: [], ladung: 0 };
      klang.aus();
      wartend.current = f;
      setLage("frage");
      setTimeout(() => onFrage(f), reduziert.current ? 0 : 650);
    },
    [onFrage],
  );

  // die Antwort auf eine Frage: neue Teile (und ein Blitz), oder nach der Rettungsfrage weiter oder aus
  useEffect(() => {
    if (!antwort || antwort.n === antwortN.current) return;
    antwortN.current = antwort.n;
    const f = wartend.current;
    if (!f) return;
    wartend.current = null;
    // Fieber: richtige Antworten am Stück; eine falsche beendet es
    const neueSerie = antwort.sauber ? serie + 1 : 0;
    const neuFaktor = fieberFaktor(neueSerie);
    setSerie(neueSerie);
    if (neuFaktor > faktor) {
      setTimeout(() => {
        klang.fieber();
        sage(neuFaktor === 2 ? "FIEBER! Punkte ×2" : "SUPERFIEBER! ×3", "fieber");
        funkenRef.current?.regen(["#ffb21f", "#ff5d50", "#ffe27a", "#ffffff"], 50);
      }, 420);
    } else if (faktor > 1 && neuFaktor === 1) {
      klang.fieberAus();
      setTimeout(() => sage("Fieber vorbei", "kombo"), 200);
    }
    // neue Teile: drei richtige Antworten laden einen Blitz; die Rettungsfrage gibt gleich einen
    const voll = f.grund === "rettung" || ladung + 1 >= LADUNG;
    const bl = antwort.sauber && voll ? Math.min(BLITZE_MAX, blitze + 1) : blitze;
    if (antwort.sauber) {
      setBlitze(bl);
      if (f.grund === "teile") setLadung(voll ? (bl > blitze ? 0 : LADUNG - 1) : ladung + 1);
      if (bl > blitze) setTimeout(() => sage("+1 Blitz", "blitz"), 260);
    }
    if (f.grund === "teile") {
      if (antwort.sauber) {
        const bonus = (FRAGE_PUNKTE + (antwort.schnell ? SCHNELL_PUNKTE : 0)) * neuFaktor;
        setPunkte((p) => p + bonus);
        if (bl === blitze) setTimeout(() => sage(antwort.schnell ? `Blitzschnell! +${bonus}` : `+${bonus}`, "punkte"), 260);
      }
      setTeile(f.vorschau);
      setTimeout(() => klang.teile(), 120);
      pruefe(brett, f.vorschau, bl);
    } else if (antwort.sauber) {
      setLage("eng");
      setZielen(true);
    } else {
      setLage("aus");
      klang.aus();
      setTimeout(onEnde, reduziert.current ? 300 : 1400);
    }
  }, [antwort, blitze, ladung, brett, pruefe, sage, onEnde, serie, faktor]);

  /** Ein Teil liegt: abräumen, zählen, und wenn alle drei liegen, nach neuen fragen. */
  const lege = useCallback(
    (slot: number, teil: Teil, r: number, s: number) => {
      const z = setze(brett, teil, r, s);
      const linien = z.reihen.length + z.spalten.length;
      const k = naechsteKombo(kombo.kombo, kombo.ohne, linien);
      const p = punkteFuer(z, teil.zellen.length, k.kombo) * faktor;
      setBrett(z.brett);
      setKombo(k);
      setPunkte((x) => {
        const neu = x + p;
        // der Rekord fällt: einmal je Spiel feiern
        if (rekord > 0 && x <= rekord && neu > rekord && !rekordGeknackt.current) {
          rekordGeknackt.current = true;
          setTimeout(() => {
            klang.rekord();
            sage("Neuer Rekord!", "frei");
            funkenRef.current?.regen(["#ffd76e", "#ffffff", "#47d89a", "#5aa0ff"], 70);
          }, 700);
        }
        return neu;
      });
      const rest = teile.map((t, i) => (i === slot ? null : t));
      setTeile(rest);
      const zellen = new Set(teil.zellen.map(([dr, ds]) => (r + dr) * SEITE + s + ds));
      setGelandet({ zellen, n: ++zaehler.current });
      zeigeWeg(z, r * SEITE + s);
      // die Punkte stehen dort, wo das Teil liegt
      const wo = { x: ((s + teil.breite / 2) / SEITE) * 100, y: ((r + teil.hoehe / 2) / SEITE) * 100 };
      if (linien > 0) {
        vibriere(linien > 1 ? [18, 30, 18, 30, 24] : 18);
        klang.linie(linien, k.kombo);
        sage(`+${p.toLocaleString("de-AT")}`, "punkte", wo);
        const frei = z.brett.every((x) => x === null);
        if (frei) {
          setTimeout(() => {
            klang.frei();
            sage("Alles frei!", "frei");
            funkenRef.current?.regen(FUNKEN_FARBEN, 110);
          }, 160);
          wackle(4);
        } else if (linien >= 2) {
          setTimeout(() => sage(LOB[Math.min(4, linien)], "lob"), 120);
          wackle(linien);
        }
        if (!frei && k.kombo >= 2) setTimeout(() => sage(`Kombo ×${k.kombo}`, "kombo"), linien >= 2 ? 520 : 160);
      } else {
        vibriere(8);
        klang.setzen();
      }
      if (rest.every((t) => !t)) {
        const f: BlockFrage = { grund: "teile", vorschau: neueTeile(z.brett), ladung };
        wartend.current = f;
        setLage("frage");
        // erst sieht man die Linie verschwinden, dann kommt die Frage
        setTimeout(() => onFrage(f), reduziert.current ? 0 : linien > 0 ? 700 : 380);
        return;
      }
      pruefe(z.brett, rest, blitze);
    },
    [brett, kombo, teile, blitze, ladung, zeigeWeg, sage, onFrage, pruefe, faktor, rekord, wackle],
  );

  const blitzAuf = useCallback(
    (i: number) => {
      if (blitze <= 0) return;
      const z = blitz(brett, Math.floor(i / SEITE), i % SEITE);
      const bl = blitze - 1;
      setBrett(z.brett);
      setBlitze(bl);
      setZielen(false);
      setBlitzZiel(null);
      zeigeWeg(z, i);
      klang.blitz();
      wackle(2);
      vibriere([14, 24, 30]);
      pruefe(z.brett, teile, bl);
    },
    [blitze, brett, teile, zeigeWeg, pruefe],
  );

  // ---------- Ziehen ----------

  const stelle = (z: Zieh, x: number, y: number) => {
    const el = ziehRef.current;
    if (el) el.style.transform = `translate(${x - z.ox}px, ${y - z.oy}px)`;
  };

  const onDown = (slot: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const teil = teile[slot];
    const b = brettRef.current;
    if (!teil || !b || zug.current || !aktiv || lage === "frage" || lage === "aus" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setZielen(false);
    klang.heben();
    const rect = b.getBoundingClientRect();
    const zelle = (rect.width - 2 * RAND - (SEITE - 1) * LUECKE) / SEITE;
    const schritt = zelle + LUECKE;
    const w = teil.breite * schritt - LUECKE;
    const h = teil.hoehe * schritt - LUECKE;
    const maus = e.pointerType === "mouse";
    // am Finger schwebt das Teil über ihm (Mitte unten gut eine Zelle über dem Finger), mit der Maus hängt es mittig
    const z: Zieh = { slot, teil, id: e.pointerId, ox: w / 2, oy: maus ? h / 2 : h + schritt * 1.2, zelle, schritt, r: -99, s: -99, maus };
    zug.current = z;
    setZieht(z);
    requestAnimationFrame(() => stelle(z, e.clientX, e.clientY));
    bewege(z, e.clientX, e.clientY);
  };

  const bewege = (z: Zieh, x: number, y: number) => {
    stelle(z, x, y);
    const b = brettRef.current;
    if (!b) return;
    const rect = b.getBoundingClientRect();
    const r = Math.round((y - z.oy - rect.top - RAND) / z.schritt);
    const s = Math.round((x - z.ox - rect.left - RAND) / z.schritt);
    if (r === z.r && s === z.s) return;
    z.r = r;
    z.s = s;
    if (!passt(brett, z.teil, r, s)) {
      setVorschau(null);
      return;
    }
    setVorschau({ r, s, ok: true, farbe: z.teil.farbe, zellen: new Set(z.teil.zellen.map(([dr, ds]) => (r + dr) * SEITE + s + ds)), raeumt: wuerdeRaeumen(brett, z.teil, r, s) });
  };

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.id) return;
    bewege(z, e.clientX, e.clientY);
  };

  const zurueck = (z: Zieh) => {
    const el = ziehRef.current;
    const slot = slotRefs.current[z.slot];
    const fertig = () => {
      zug.current = null;
      setZieht(null);
    };
    if (!el || !slot || reduziert.current || !el.animate) return fertig();
    const a = el.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    el.animate([{ translate: "0 0", scale: "1" }, { translate: `${dx}px ${dy}px`, scale: "0.5", opacity: 0.4 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }).finished.then(fertig, fertig);
  };

  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.id) return;
    const ok = passt(brett, z.teil, z.r, z.s);
    setVorschau(null);
    if (ok) {
      zug.current = null;
      setZieht(null);
      lege(z.slot, z.teil, z.r, z.s);
    } else zurueck(z);
  };

  // ---------- Darstellung ----------

  const wegFelder = useMemo(() => new Map(weg.map((w) => [w.i, w])), [weg]);
  const blitzFlaeche = useMemo(() => (zielen && blitzZiel !== null ? new Set(blitzFelder(Math.floor(blitzZiel / SEITE), blitzZiel % SEITE)) : null), [zielen, blitzZiel]);
  const hinweis =
    lage === "aus"
      ? "Kein Platz mehr."
      : lage === "eng"
        ? "Kein Teil passt. Tipp aufs Feld: der Blitz räumt 3\u00a0×\u00a03 frei."
        : zielen
          ? "Tipp aufs Feld: der Blitz räumt 3\u00a0×\u00a03 frei."
          : lage === "frage"
            ? "Gleich kommt eine Frage …"
            : punkte === 0
              ? "Zieh ein Teil aufs Feld. Volle Reihen verschwinden."
              : "";

  return (
    <div className="bw" data-aktiv={aktiv ? "" : undefined} hidden={!aktiv} data-lage={lage} data-fieber={faktor > 1 ? faktor : undefined} data-frage-da={frage ? "" : undefined}>
      <Funkenregen ref={funkenRef} />
      <div className="bw-stand">
        <div className="bw-links">
          {/* die Serie: drei richtige Antworten am Stück sind Fieber */}
          <span className="bw-serie" data-fieber={faktor > 1 ? "" : undefined} aria-label={faktor > 1 ? `Fieber: Punkte mal ${faktor}` : `${serie} von ${FIEBER_AB} richtigen Antworten bis zum Fieber`} data-testid="bw-serie">
            <Flame size={16} strokeWidth={2.2} fill={serie > 0 ? "currentColor" : "none"} aria-hidden />
            {faktor > 1 ? (
              <b key={faktor}>×{faktor}</b>
            ) : (
              <span className="bw-serie-punkte" aria-hidden>
                {Array.from({ length: FIEBER_AB }, (_, i) => (
                  <i key={i} data-an={i < serie ? "" : undefined} />
                ))}
              </span>
            )}
          </span>
          <span className="bw-kombo" data-an={kombo.kombo >= 2 ? "" : undefined} aria-hidden={kombo.kombo < 2}>
            Kombo ×{Math.max(2, kombo.kombo)}
          </span>
        </div>
        <div className="bw-punkte" aria-live="polite" aria-label={`${punkte} Punkte`} data-testid="bw-punkte">
          <ZaehlZahl wert={punkte} />
          <small>{rekord > 0 ? (punkte > rekord ? "Neuer Rekord!" : `Rekord ${rekord.toLocaleString("de-AT")}`) : "Punkte"}</small>
        </div>
        <button
          type="button"
          className="bw-blitz treffer"
          data-zielen={zielen ? "" : undefined}
          data-leer={blitze === 0 ? "" : undefined}
          disabled={blitze === 0 || lage === "frage" || lage === "aus"}
          onClick={() => setZielen((z) => !z)}
          aria-pressed={zielen}
          aria-label={`Blitz: räumt 3 mal 3 Felder frei. ${blitze} übrig, der nächste ist zu ${ladung} von ${LADUNG} geladen.`}
          data-testid="bw-blitz"
        >
          <Zap size={20} strokeWidth={2.4} fill="currentColor" aria-hidden />
          <b key={blitze}>{blitze}</b>
          {/* wie weit der nächste Blitz geladen ist */}
          <span className="bw-ladung" aria-hidden>
            {Array.from({ length: LADUNG }, (_, i) => (
              <i key={i} data-an={i < ladung ? "" : undefined} />
            ))}
          </span>
        </button>
      </div>

      <div className="bw-mitte">
        <div
          ref={brettRef}
          className="bw-brett"
          role="grid"
          aria-label="Spielfeld, 8 mal 8 Felder"
          data-zielen={zielen ? "" : undefined}
          data-testid="bw-brett"
          onPointerLeave={() => setBlitzZiel(null)}
        >
          {brett.map((f, i) => {
            const w = wegFelder.get(i);
            const vor = vorschau?.zellen.has(i);
            const raeumt = vorschau?.raeumt.has(i);
            return (
              <div
                key={i}
                className="bw-feld"
                data-f={f ?? (vor ? vorschau!.farbe : undefined)}
                data-voll={f !== null ? "" : undefined}
                data-vor={vor ? "" : undefined}
                data-raeumt={raeumt ? "" : undefined}
                data-blitz={blitzFlaeche?.has(i) ? "" : undefined}
                data-neu={gelandet?.zellen.has(i) && f !== null ? gelandet.n % 2 : undefined}
                onPointerEnter={zielen ? () => setBlitzZiel(i) : undefined}
                onClick={zielen ? () => blitzAuf(i) : undefined}
              >
                {w && <i className="bw-weg" data-f={w.farbe} style={{ "--v": `${w.v}ms` } as CSSProperties} key={w.n} />}
              </div>
            );
          })}
          {ansage.map((a) => (
            <p key={a.n} className="bw-ansage" data-art={a.art} data-wo={a.x !== undefined ? "" : undefined} style={a.x !== undefined ? ({ "--x": `${Math.min(80, Math.max(20, a.x))}%`, "--y": `${Math.min(85, Math.max(12, a.y!))}%` } as CSSProperties) : undefined} aria-hidden>
              {a.text}
            </p>
          ))}
        </div>
        {!frage && (
          <p className="bw-hinweis" role="status">
            {hinweis}
          </p>
        )}
      </div>

      {frage ? (
        <div className="bw-frage-platz">{frage}</div>
      ) : (
      <div className="bw-teile" role="group" aria-label="Teile">
        {teile.map((t, i) => (
          <button
            key={t?.id ?? `leer-${i}`}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            type="button"
            className="bw-slot ohne-druck"
            data-leer={!t ? "" : undefined}
            data-zieht={zieht?.slot === i ? "" : undefined}
            data-passt={t && lage !== "frage" && !steckt(brett, [t]) ? "" : undefined}
            disabled={!t}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label={t ? `Teil mit ${t.zellen.length} ${t.zellen.length === 1 ? "Feld" : "Feldern"}` : "leer"}
            data-testid={`bw-slot-${i}`}
            data-form={t?.form}
          >
            {t && <TeilBild teil={t} />}
          </button>
        ))}
      </div>
      )}

      {zieht &&
        createPortal(
          <div ref={ziehRef} className="bw-zieh" aria-hidden style={{ "--z": `${zieht.zelle}px` } as CSSProperties} data-maus={zieht.maus ? "" : undefined}>
            <TeilBild teil={zieht.teil} />
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Punkte, die hochzählen statt zu springen (bei „weniger Bewegung“ sofort). */
function ZaehlZahl({ wert }: { wert: number }) {
  const [zeige, setZeige] = useState(wert);
  const von = useRef(wert);
  const el = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const start = von.current;
    if (start === wert || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      von.current = wert;
      setZeige(wert);
      return;
    }
    // die Zahl springt kurz größer, je mehr dazukommt, desto mehr
    const gross = Math.min(1.35, 1.08 + (wert - start) / 2000);
    el.current?.animate?.([{ scale: String(gross) }, { scale: "1" }], { duration: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    const t0 = performance.now();
    const dauer = Math.min(700, 250 + Math.abs(wert - start) / 4);
    let id = 0;
    const schritt = (jetzt: number) => {
      const a = Math.min(1, (jetzt - t0) / dauer);
      const e = 1 - (1 - a) ** 3;
      const n = Math.round(start + (wert - start) * e);
      von.current = n;
      setZeige(n);
      if (a < 1) id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [wert]);
  return <b ref={el}>{zeige.toLocaleString("de-AT")}</b>;
}

/** Ein Teil als kleines Raster (in der Reihe unten, gezogen und in der Vorschau über der Frage). */
export function TeilBild({ teil }: { teil: Teil }) {
  return (
    <span className="bw-teil" style={{ gridTemplateColumns: `repeat(${teil.breite}, var(--z))`, gridTemplateRows: `repeat(${teil.hoehe}, var(--z))` } as CSSProperties}>
      {teil.zellen.map(([r, s]) => (
        <i key={`${r}-${s}`} className="bw-zelle" data-f={teil.farbe} style={{ gridRow: r + 1, gridColumn: s + 1 }} />
      ))}
    </span>
  );
}

/** Über der Karte, solange eine Frage offen ist: wofür sie ist, und bei neuen Teilen welche kommen. */
export function FrageKopf({ frage }: { frage: BlockFrage }) {
  return (
    <div className="bw-frage-kopf" data-grund={frage.grund} data-testid="bw-frage">
      {frage.grund === "teile" ? (
        <>
          <span className="bw-frage-teile" aria-hidden>
            {frage.vorschau.map((t) => (
              <TeilBild key={t.id} teil={t} />
            ))}
          </span>
          <span className="bw-frage-text">
            <b>Antworte für neue Teile</b>
            <small>
              Richtig beim 1. Versuch: +{FRAGE_PUNKTE} und <Zap size={13} strokeWidth={2.6} fill="currentColor" aria-label="der Blitz" /> lädt
              <span className="bw-ladung" aria-label={`${frage.ladung} von ${LADUNG}`}>
                {Array.from({ length: LADUNG }, (_, i) => (
                  <i key={i} data-an={i < frage.ladung ? "" : undefined} data-naechste={i === frage.ladung ? "" : undefined} />
                ))}
              </span>
            </small>
          </span>
        </>
      ) : (
        <span className="bw-frage-text">
          <b>Rettungsfrage</b>
          <small>
            Richtig: +1 <Zap size={13} strokeWidth={2.6} fill="currentColor" aria-label="Blitz" /> und weiter. Falsch: das Spiel ist aus.
          </small>
        </span>
      )}
    </div>
  );
}

/** Oben in der Frage unter dem Brett: welche Teile es für die Antwort gibt, oder dass es die Rettung ist. */
export function FrageLeiste({ frage }: { frage: BlockFrage }) {
  if (frage.grund === "rettung")
    return (
      <div className="bwf-leiste" data-grund="rettung">
        <b>Rettungsfrage!</b>
        <small>
          Richtig: +1 <Zap size={13} strokeWidth={2.6} fill="currentColor" aria-label="Blitz" /> und weiter
        </small>
      </div>
    );
  return (
    <div className="bwf-leiste" data-grund="teile">
      <span className="bwf-leiste-teile" aria-hidden>
        {frage.vorschau.map((t) => (
          <TeilBild key={t.id} teil={t} />
        ))}
      </span>
      <b>Antworte für diese Teile</b>
    </div>
  );
}
