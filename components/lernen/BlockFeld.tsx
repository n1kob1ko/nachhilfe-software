"use client";

import "./blockwerk.css";
import { Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { blitz, blitzFelder, BLITZE_MAX, BLITZE_START, leeresBrett, naechsteKombo, neueTeile, passt, punkteFuer, SEITE, setze, steckt, wuerdeRaeumen, type Brett, type Teil, type Zug } from "@/lib/blockwerk";
import { vibriere } from "./SpielTeile";

/**
 * Blockwerk (lib/blockwerk.ts, docs/lernspiele.md „Blockwerk“): das Brett mit 8 × 8 Feldern und drei Teilen darunter.
 * Ein Teil wird aufs Brett gezogen; volle Reihen und Spalten verschwinden. Sind alle drei gelegt, fragt das Feld nach
 * neuen Teilen (`onFrage`): Lernspiel.tsx zeigt dann eine Karte aus dem Stoff, und mit `antwort` kommen die Teile.
 * Beim ersten Versuch richtig gibt es 20 Punkte dazu, und der Blitz lädt: drei richtige Antworten sind ein Blitz, der
 * 3 × 3 Felder frei räumt (erst bekam jede richtige Antwort einen; dann endete ein Spiel kaum). Passt kein Teil mehr und
 * ist kein Blitz da, kommt eine Rettungsfrage: richtig gibt einen Blitz, sonst ist das Spiel aus (`onEnde`).
 *
 * Ziehen läuft ohne React-Zustand je Bewegung (nur transform am gezogenen Teil); neu gezeichnet wird nur, wenn das
 * Teil über ein anderes Feld rückt. Am Finger schwebt das Teil über dem Finger, damit man sieht, wo es landet.
 */

/** `ladung`: wie viele richtige Antworten der Blitz schon geladen hat (0 bis 2, bei drei gibt es einen) */
export type BlockFrage = { grund: "teile" | "rettung"; vorschau: Teil[]; ladung: number };
/** So viele richtige Antworten sind ein Blitz. */
export const LADUNG = 3;
export type BlockAntwort = { n: number; sauber: boolean };

type Ansage = { n: number; text: string; art: "punkte" | "kombo" | "blitz" | "frei" };
type Vorschau = { r: number; s: number; ok: boolean; zellen: Set<number>; raeumt: Set<number>; farbe: number } | null;
/** `zelle`: Kante eines Felds, `schritt`: Feld plus Lücke (so weit liegen zwei Felder auseinander) */
type Zieh = { slot: number; teil: Teil; id: number; ox: number; oy: number; zelle: number; schritt: number; r: number; s: number; maus: boolean };
/** Rand und Lücke des Bretts in px (wie in blockwerk.css) */
const RAND = 6;
const LUECKE = 3;

export function BlockFeld({
  aktiv,
  antwort,
  onFrage,
  onPunkte,
  onEnde,
  rekord,
}: {
  /** false, solange die Frage über dem Brett liegt */
  aktiv: boolean;
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

  const sage = useCallback((text: string, art: Ansage["art"]) => {
    const n = ++zaehler.current;
    setAnsage((a) => [...a.slice(-2), { n, text, art }]);
    setTimeout(() => setAnsage((a) => a.filter((x) => x.n !== n)), 1300);
  }, []);

  const zeigeWeg = useCallback((z: Zug, von: number | null) => {
    if (!z.weg.length) return;
    const n = ++zaehler.current;
    // von der Stelle aus, an der das Teil lag, nach außen: die Linie „läuft“ weg
    const r0 = von === null ? 3.5 : Math.floor(von / SEITE);
    const s0 = von === null ? 3.5 : von % SEITE;
    setWeg((w) => [...w, ...z.weg.map((x) => ({ ...x, n, v: Math.round(Math.hypot(Math.floor(x.i / SEITE) - r0, (x.i % SEITE) - s0) * 22) }))]);
    setTimeout(() => setWeg((w) => w.filter((x) => x.n !== n)), 700);
  }, []);

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
        setPunkte((p) => p + 20);
        if (bl === blitze) setTimeout(() => sage("+20", "punkte"), 260);
      }
      setTeile(f.vorschau);
      pruefe(brett, f.vorschau, bl);
    } else if (antwort.sauber) {
      setLage("eng");
      setZielen(true);
    } else {
      setLage("aus");
      setTimeout(onEnde, reduziert.current ? 300 : 1400);
    }
  }, [antwort, blitze, ladung, brett, pruefe, sage, onEnde]);

  /** Ein Teil liegt: abräumen, zählen, und wenn alle drei liegen, nach neuen fragen. */
  const lege = useCallback(
    (slot: number, teil: Teil, r: number, s: number) => {
      const z = setze(brett, teil, r, s);
      const linien = z.reihen.length + z.spalten.length;
      const k = naechsteKombo(kombo.kombo, kombo.ohne, linien);
      const p = punkteFuer(z, teil.zellen.length, k.kombo);
      setBrett(z.brett);
      setKombo(k);
      setPunkte((x) => x + p);
      const rest = teile.map((t, i) => (i === slot ? null : t));
      setTeile(rest);
      const zellen = new Set(teil.zellen.map(([dr, ds]) => (r + dr) * SEITE + s + ds));
      setGelandet({ zellen, n: ++zaehler.current });
      zeigeWeg(z, r * SEITE + s);
      if (linien > 0) {
        vibriere(linien > 1 ? [18, 30, 18] : 18);
        sage(`+${p}`, "punkte");
        if (z.brett.every((x) => x === null)) setTimeout(() => sage("Alles frei!", "frei"), 160);
        else if (k.kombo >= 2) setTimeout(() => sage(`Kombo ×${k.kombo}`, "kombo"), 160);
      } else vibriere(8);
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
    [brett, kombo, teile, blitze, ladung, zeigeWeg, sage, onFrage, pruefe],
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
    <div className="bw" data-aktiv={aktiv ? "" : undefined} hidden={!aktiv} data-lage={lage}>
      <div className="bw-stand">
        <span className="bw-kombo" data-an={kombo.kombo >= 2 ? "" : undefined} aria-hidden={kombo.kombo < 2}>
          Kombo ×{Math.max(2, kombo.kombo)}
        </span>
        <div className="bw-punkte" aria-live="polite" aria-label={`${punkte} Punkte`} data-testid="bw-punkte">
          <b key={punkte} data-neu={punkte ? "" : undefined}>
            {punkte.toLocaleString("de-AT")}
          </b>
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
            <p key={a.n} className="bw-ansage" data-art={a.art} aria-hidden>
              {a.text}
            </p>
          ))}
        </div>
        <p className="bw-hinweis" role="status">
          {hinweis}
        </p>
      </div>

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
              Richtig beim 1. Versuch: +20 und <Zap size={13} strokeWidth={2.6} fill="currentColor" aria-label="der Blitz" /> lädt
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
