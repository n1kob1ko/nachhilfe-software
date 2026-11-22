"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import { LAENDER } from "@/lib/europa";
import { KARTE } from "@/lib/europa-karte";

/**
 * Die Europakarte für das Lernspiel „Europa“ (lib/europa.ts, Karte aus lib/europa-karte.ts). Ein Finger verschiebt,
 * zwei Finger zoomen, am Laptop das Mausrad; dazu Knöpfe + − und „ganze Karte“. Antippen ohne Verschieben wählt ein
 * Land. Sehr kleine Länder (Andorra, Liechtenstein, Luxemburg, Malta, Monaco, San Marino, Vatikanstadt) haben einen
 * Kreis zum Antippen, der beim Zoomen gleich groß bleibt.
 *
 * Farben je Land über `farbe` (data-zustand): markiert, richtig, falsch, loesung, erobert, teil, gewaehlt.
 * `fokus`: zu diesen Ländern hinzoomen (bei kleinen Ländern nah, sonst so, dass sie ganz zu sehen sind).
 */

export type Zustand = "markiert" | "richtig" | "falsch" | "loesung" | "erobert" | "teil" | "gewaehlt";
type Box = { x: number; y: number; w: number; h: number };

const W = KARTE.breite;
const H = KARTE.hoehe;
const GANZ: Box = { x: 0, y: 0, w: W, h: H };
/** so nah geht es höchstens */
const MIN_BREITE = 90;
/** Kreise: so groß auf dem Schirm (Pixel), Ring und Trefferfläche */
const KREIS_PX = 8;
const TREFFER_PX = 15;
const KLEIN = LAENDER.filter((l) => l.klein).map((l) => l.code);

/** Rahmen eines Landes aus seinem Pfad (d3 schreibt nur absolute M/L-Punkte). */
const BOX: Record<string, [number, number, number, number]> = Object.fromEntries(
  Object.entries(KARTE.laender).map(([code, d]) => {
    const z = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 1 < z.length; i += 2) {
      x0 = Math.min(x0, z[i]);
      x1 = Math.max(x1, z[i]);
      y0 = Math.min(y0, z[i + 1]);
      y1 = Math.max(y1, z[i + 1]);
    }
    return [code, [x0, y0, x1, y1]];
  }),
);

/** Ein Ausschnitt um diese Länder: mit Rand, mindestens `minBreite` breit, im Seitenverhältnis der Karte. */
export function boxUm(codes: string[], minBreite = 240): Box {
  const b = codes.map((c) => BOX[c]).filter(Boolean);
  if (!b.length) return GANZ;
  const x0 = Math.min(...b.map((v) => v[0]));
  const y0 = Math.min(...b.map((v) => v[1]));
  const x1 = Math.max(...b.map((v) => v[2]));
  const y1 = Math.max(...b.map((v) => v[3]));
  let w = Math.max(minBreite, (x1 - x0) * 1.5, ((y1 - y0) * 1.5 * W) / H);
  w = Math.min(W, w);
  const h = (w * H) / W;
  return klemme({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h });
}

function klemme(b: Box): Box {
  const w = Math.min(W, Math.max(MIN_BREITE, b.w));
  const h = (w * H) / W;
  return { x: Math.min(W - w, Math.max(0, b.x)), y: Math.min(H - h, Math.max(0, b.y)), w, h };
}

const istGanz = (b: Box) => b.w >= W - 0.5;
const sichtbar = (b: Box, code: string) => {
  const v = BOX[code];
  return !!v && v[0] >= b.x - 2 && v[2] <= b.x + b.w + 2 && v[1] >= b.y - 2 && v[3] <= b.y + b.h + 2;
};

/** Die Länder als eigene, gemerkte Schicht: Verschieben und Zoomen zeichnen sie nicht neu. */
const Laender = memo(function Laender({ farbe, klickbar }: { farbe: Record<string, Zustand | undefined>; klickbar: boolean }) {
  return (
    <g className="eu-laender">
      {LAENDER.map((l) => (
        <path key={l.code} d={KARTE.laender[l.code]} data-land={klickbar ? l.code : undefined} data-zustand={farbe[l.code]} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
});

export function EuropaKarte({
  farbe = {},
  onTipp,
  fokus,
  fokusKey,
  start,
  stadt,
  namen,
  klein = false,
  label = "Karte von Europa",
}: {
  farbe?: Record<string, Zustand | undefined>;
  /** ein Land angetippt; fehlt es, ist die Karte nur zum Ansehen (verschieben und zoomen geht trotzdem) */
  onTipp?: (code: string) => void;
  /** zu diesen Ländern hinzoomen, wenn sich `fokusKey` ändert */
  fokus?: string[] | null;
  fokusKey?: string | number;
  /** Ausschnitt am Anfang (Region) */
  start?: string[] | null;
  /** ein Punkt mit Namen (die Hauptstadt) */
  stadt?: { code: string; name: string } | null;
  /** Namen auf der Karte (Erkunden) */
  namen?: Record<string, string>;
  /** kleine Vorschau ohne Knöpfe und ohne Gesten */
  klein?: boolean;
  label?: string;
}) {
  const svg = useRef<SVGSVGElement | null>(null);
  const startBox = useMemo(() => (start?.length ? boxUm(start, 300) : GANZ), [start]);
  const [box, setBox] = useState<Box>(startBox);
  const boxRef = useRef(box);
  const [pxJeEinheit, setPx] = useState(0.4);
  const animation = useRef(0);
  /** die Karte wurde von selbst (Fokus) verschoben, nicht vom Kind */
  const vonSelbst = useRef(false);
  const zeiger = useRef(new Map<number, { x: number; y: number }>());
  const geste = useRef<{ bewegt: boolean; startX: number; startY: number; abstand?: number; box: Box; mitte?: { x: number; y: number } } | null>(null);

  // die Box direkt am Element setzen (ohne neu zu zeichnen); am Ende einer Geste in den Zustand
  const setzeDirekt = useCallback((b: Box) => {
    boxRef.current = b;
    svg.current?.setAttribute("viewBox", `${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`);
  }, []);

  const messen = useCallback(() => {
    const r = svg.current?.getBoundingClientRect();
    if (!r?.width) return;
    const b = boxRef.current;
    setPx(Math.min(r.width / b.w, r.height / b.h));
  }, []);

  const fahre = useCallback(
    (ziel: Box) => {
      cancelAnimationFrame(animation.current);
      const von = boxRef.current;
      const ruhig = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (ruhig) {
        setzeDirekt(ziel);
        setBox(ziel);
        messen();
        return;
      }
      const t0 = performance.now();
      const dauer = 420;
      const schritt = (t: number) => {
        const p = Math.min(1, (t - t0) / dauer);
        const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
        setzeDirekt({ x: von.x + (ziel.x - von.x) * e, y: von.y + (ziel.y - von.y) * e, w: von.w + (ziel.w - von.w) * e, h: von.h + (ziel.h - von.h) * e });
        if (p < 1) animation.current = requestAnimationFrame(schritt);
        else {
          setBox(ziel);
          messen();
        }
      };
      animation.current = requestAnimationFrame(schritt);
    },
    [setzeDirekt, messen],
  );

  useLayoutEffect(() => {
    setzeDirekt(boxRef.current);
    messen();
    const ro = new ResizeObserver(messen);
    if (svg.current) ro.observe(svg.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animation.current);
    };
  }, [setzeDirekt, messen]);

  // eine neue Region: dorthin
  useEffect(() => {
    fahre(startBox);
  }, [startBox, fahre]);

  // Fokus: kleine Länder nah heran, große nur, wenn sie nicht ganz zu sehen sind
  // Ohne Fokus (neue Frage) wieder zurück, wenn die Karte nur von selbst hingezoomt hat.
  useEffect(() => {
    if (!fokus?.length) {
      if (vonSelbst.current) fahre(startBox);
      vonSelbst.current = false;
      return;
    }
    const ziel = boxUm(fokus);
    const kleinesLand = fokus.some((c) => KLEIN.includes(c) || (BOX[c] && BOX[c][2] - BOX[c][0] < 30));
    if (kleinesLand) {
      fahre(ziel);
      vonSelbst.current = true;
    } else if (!fokus.every((c) => sichtbar(boxRef.current, c))) {
      fahre(fokus.every((c) => sichtbar(startBox, c)) ? startBox : GANZ);
      vonSelbst.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusKey]);

  // Bildschirm → Karte
  const punkt = (cx: number, cy: number, b = boxRef.current) => {
    const r = svg.current!.getBoundingClientRect();
    const s = Math.min(r.width / b.w, r.height / b.h);
    const ox = (r.width - b.w * s) / 2;
    const oy = (r.height - b.h * s) / 2;
    return { x: b.x + (cx - r.left - ox) / s, y: b.y + (cy - r.top - oy) / s, s };
  };

  const zoom = useCallback(
    (faktor: number, um?: { x: number; y: number }) => {
      const b = boxRef.current;
      const m = um ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      vonSelbst.current = false;
      const w = Math.min(W, Math.max(MIN_BREITE, b.w / faktor));
      const k = w / b.w;
      fahre(klemme({ x: m.x - (m.x - b.x) * k, y: m.y - (m.y - b.y) * k, w, h: (w * H) / W }));
    },
    [fahre],
  );

  const runter = (e: RPointerEvent<SVGSVGElement>) => {
    if (klein) return;
    cancelAnimationFrame(animation.current);
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...zeiger.current.values()];
    if (p.length === 1) geste.current = { bewegt: false, startX: e.clientX, startY: e.clientY, box: boxRef.current };
    else if (p.length === 2) {
      const mx = (p[0].x + p[1].x) / 2;
      const my = (p[0].y + p[1].y) / 2;
      vonSelbst.current = false;
      geste.current = { bewegt: true, startX: mx, startY: my, abstand: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), box: boxRef.current, mitte: punkt(mx, my) };
    }
  };

  const bewege = (e: RPointerEvent<SVGSVGElement>) => {
    if (klein || !zeiger.current.has(e.pointerId) || !geste.current) return;
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = geste.current;
    const p = [...zeiger.current.values()];
    if (p.length >= 2 && g.abstand && g.mitte) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mx = (p[0].x + p[1].x) / 2;
      const my = (p[0].y + p[1].y) / 2;
      const w = Math.min(W, Math.max(MIN_BREITE, (g.box.w * g.abstand) / Math.max(20, d)));
      const h = (w * H) / W;
      // der Kartenpunkt unter der Fingermitte bleibt unter der Fingermitte
      const r = svg.current!.getBoundingClientRect();
      const s = Math.min(r.width / w, r.height / h);
      const ox = (r.width - w * s) / 2;
      const oy = (r.height - h * s) / 2;
      setzeDirekt(klemme({ x: g.mitte.x - (mx - r.left - ox) / s, y: g.mitte.y - (my - r.top - oy) / s, w, h }));
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.bewegt && Math.hypot(dx, dy) < 8) return;
    g.bewegt = true;
    vonSelbst.current = false;
    if (istGanz(g.box)) return;
    const s = punkt(0, 0, g.box).s;
    setzeDirekt(klemme({ ...g.box, x: g.box.x - dx / s, y: g.box.y - dy / s }));
  };

  const hoch = (e: RPointerEvent<SVGSVGElement>) => {
    if (klein) return;
    const g = geste.current;
    zeiger.current.delete(e.pointerId);
    if (zeiger.current.size > 0) {
      // ein Finger bleibt: weiter verschieben ab hier
      const [rest] = [...zeiger.current.values()];
      geste.current = { bewegt: true, startX: rest.x, startY: rest.y, box: boxRef.current };
      return;
    }
    geste.current = null;
    if (g?.bewegt) {
      setBox(boxRef.current);
      messen();
      return;
    }
    if (!onTipp || e.type === "pointercancel") return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-land]");
    const code = el?.getAttribute("data-land");
    if (code) onTipp(code);
  };

  const rad = (e: RWheelEvent<SVGSVGElement>) => {
    if (klein) return;
    const m = punkt(e.clientX, e.clientY);
    zoom(e.deltaY < 0 ? 1.35 : 1 / 1.35, m);
  };

  const r = KREIS_PX / pxJeEinheit;
  const rt = TREFFER_PX / pxJeEinheit;
  const st = stadt ? KARTE.stadt[stadt.code] : null;
  return (
    <div className="eu-karte" data-klein={klein ? "" : undefined} data-klickbar={onTipp ? "" : undefined}>
      <svg
        ref={svg}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        onPointerDown={runter}
        onPointerMove={bewege}
        onPointerUp={hoch}
        onPointerCancel={hoch}
        onWheel={rad}
        data-testid="eu-karte"
      >
        <rect className="eu-meer" x={-W} y={-H} width={W * 3} height={H * 3} />
        <path className="eu-umland" d={KARTE.umland} vectorEffect="non-scaling-stroke" />
        <Laender farbe={farbe} klickbar={!!onTipp} />
        {KLEIN.map((code) => {
          const [x, y] = KARTE.mitte[code];
          return (
            <g key={code} className="eu-kreis" data-zustand={farbe[code]}>
              <circle cx={x} cy={y} r={r} vectorEffect="non-scaling-stroke" />
              {onTipp && <circle className="eu-kreis-treffer" cx={x} cy={y} r={rt} data-land={code} />}
            </g>
          );
        })}
        {namen &&
          Object.entries(namen).map(([code, name]) => {
            const [x, y] = KARTE.mitte[code];
            return (
              <text key={code} className="eu-name" x={x} y={y - (KLEIN.includes(code) ? r * 1.6 : 0)} fontSize={13 / pxJeEinheit} textAnchor="middle" dominantBaseline="middle">
                {name}
              </text>
            );
          })}
        {st && stadt && (
          <g className="eu-stadt" key={stadt.code}>
            <circle cx={st[0]} cy={st[1]} r={4.5 / pxJeEinheit} vectorEffect="non-scaling-stroke" />
            <text x={st[0] + 7 / pxJeEinheit} y={st[1]} fontSize={14 / pxJeEinheit} dominantBaseline="middle">
              {stadt.name}
            </text>
          </g>
        )}
      </svg>
      {!klein && (
        <div className="eu-zoom">
          <button type="button" className="eu-zoom-knopf" onClick={() => zoom(1.6)} aria-label="Näher heran" data-testid="eu-zoom-rein">
            <Plus size={20} aria-hidden />
          </button>
          <button type="button" className="eu-zoom-knopf" onClick={() => zoom(1 / 1.6)} aria-label="Weiter weg" disabled={istGanz(box)}>
            <Minus size={20} aria-hidden />
          </button>
          <button type="button" className="eu-zoom-knopf" onClick={() => { vonSelbst.current = false; fahre(GANZ); }} aria-label="Ganze Karte" disabled={istGanz(box)} data-testid="eu-ganz">
            <Maximize2 size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
