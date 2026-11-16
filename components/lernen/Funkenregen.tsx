"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

/**
 * Funken für die Lernspiele (niko 2026-11-16 „zu wenig flashyness“): eine Leinwand über dem ganzen Spiel, auf der kleine
 * Splitter in alle Richtungen fliegen, sich drehen, fallen und verblassen. Sie zeichnet nur, solange Funken fliegen,
 * und nimmt keinen Tipp an. Bei „weniger Bewegung“ fliegt nichts.
 *
 * `burst(x, y, farbe)` mit Bildschirm-Koordinaten (clientX, clientY).
 */
export type FunkenApi = {
  burst: (x: number, y: number, farbe: string, o?: { n?: number; kraft?: number; groesse?: number; verzoegerung?: number }) => void;
  /** Ein großer Regen von oben (das Brett ist leer, ein Rekord) */
  regen: (farben: string[], n?: number) => void;
};

/** Der Regen, der gerade auf dem Bildschirm ist (für Funken aus Teilen, die ihn nicht kennen, z. B. BrettFrage). */
let jetzt: FunkenApi | null = null;
export const funkenHier = (x: number, y: number, farbe: string, o?: Parameters<FunkenApi["burst"]>[3]) => jetzt?.burst(x, y, farbe, o);

type Funke = { x: number; y: number; vx: number; vy: number; r: number; vr: number; g: number; leben: number; max: number; farbe: string; ab: number; form: 0 | 1 };

export function Funkenregen({ ref }: { ref: Ref<FunkenApi> }) {
  const leinwand = useRef<HTMLCanvasElement | null>(null);
  const funken = useRef<Funke[]>([]);
  const laeuft = useRef(false);
  const ruhig = useRef(false);

  useEffect(() => {
    ruhig.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = leinwand.current;
    if (!c) return;
    const passe = () => {
      const d = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(window.innerWidth * d);
      c.height = Math.round(window.innerHeight * d);
      c.getContext("2d")?.setTransform(d, 0, 0, d, 0, 0);
    };
    passe();
    window.addEventListener("resize", passe);
    return () => window.removeEventListener("resize", passe);
  }, []);

  const zeichne = () => {
    const c = leinwand.current;
    const g = c?.getContext("2d");
    if (!c || !g) {
      laeuft.current = false;
      return;
    }
    let letzte = performance.now();
    const schritt = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - letzte) / 1000);
      letzte = jetzt;
      g.clearRect(0, 0, c.width, c.height);
      const rest: Funke[] = [];
      for (const f of funken.current) {
        if (f.ab > 0) {
          f.ab -= dt;
          rest.push(f);
          continue;
        }
        f.leben += dt;
        if (f.leben >= f.max) continue;
        f.vy += f.g * dt;
        f.vx *= 0.985;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.r += f.vr * dt;
        const a = 1 - f.leben / f.max;
        g.globalAlpha = Math.min(1, a * 1.6);
        g.fillStyle = f.farbe;
        g.save();
        g.translate(f.x, f.y);
        g.rotate(f.r);
        const s = 3 + 5 * a;
        if (f.form === 0) g.fillRect(-s / 2, -s / 2, s, s);
        else {
          g.beginPath();
          g.moveTo(0, -s * 0.8);
          g.lineTo(s * 0.25, -s * 0.25);
          g.lineTo(s * 0.8, 0);
          g.lineTo(s * 0.25, s * 0.25);
          g.lineTo(0, s * 0.8);
          g.lineTo(-s * 0.25, s * 0.25);
          g.lineTo(-s * 0.8, 0);
          g.lineTo(-s * 0.25, -s * 0.25);
          g.closePath();
          g.fill();
        }
        g.restore();
        rest.push(f);
      }
      g.globalAlpha = 1;
      funken.current = rest;
      if (rest.length) requestAnimationFrame(schritt);
      else {
        g.clearRect(0, 0, c.width, c.height);
        laeuft.current = false;
      }
    };
    requestAnimationFrame(schritt);
  };

  const los = () => {
    if (laeuft.current) return;
    laeuft.current = true;
    zeichne();
  };

  const api = useRef<FunkenApi | null>(null);
  useEffect(() => {
    jetzt = api.current;
    return () => {
      if (jetzt === api.current) jetzt = null;
    };
  }, []);
  useImperativeHandle(ref, () => (api.current = {
    burst(x, y, farbe, o = {}) {
      if (ruhig.current) return;
      const n = o.n ?? 8;
      const kraft = o.kraft ?? 1;
      // nie mehr als 600 auf einmal (alte Handys)
      if (funken.current.length > 600) return;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * Math.PI * 2;
        const v = (120 + Math.random() * 260) * kraft;
        funken.current.push({
          x,
          y,
          vx: Math.cos(w) * v,
          vy: Math.sin(w) * v - 140 * kraft,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 14,
          g: 900,
          leben: 0,
          max: 0.55 + Math.random() * 0.45,
          farbe: Math.random() < 0.2 ? "#ffffff" : farbe,
          ab: o.verzoegerung ?? 0,
          form: Math.random() < 0.35 ? 1 : 0,
        });
      }
      los();
    },
    regen(farben, n = 90) {
      if (ruhig.current) return;
      const w = window.innerWidth;
      for (let i = 0; i < n; i++) {
        funken.current.push({
          x: Math.random() * w,
          y: -20 - Math.random() * 120,
          vx: (Math.random() - 0.5) * 120,
          vy: 120 + Math.random() * 220,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 10,
          g: 260,
          leben: 0,
          max: 1.8 + Math.random() * 1.2,
          farbe: farben[i % farben.length],
          ab: Math.random() * 0.5,
          form: Math.random() < 0.5 ? 1 : 0,
        });
      }
      los();
    },
  }));

  return <canvas ref={leinwand} className="ls-funkenregen" aria-hidden />;
}
