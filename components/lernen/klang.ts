/**
 * Töne der Lernspiele (niko 2026-11-16: „die spiele sollen die schüler süchtig machen … zu wenig flashyness“): kleine
 * Klänge, im Browser erzeugt (Web Audio, keine Dateien). Ein Teil setzt mit einem dumpfen „Tock“, eine Linie klingt
 * als kurze Tonfolge, die mit jeder Kombo höher wird, eine richtige Antwort klingelt hell, eine falsche brummt kurz.
 *
 * Aus- und einschalten mit dem Lautsprecher im Kopf des Spiels; die Wahl merkt sich das Gerät (localStorage
 * „ls-ton“). Der erste Ton kommt erst nach einem Tippen (Browser spielen vorher nichts).
 */

type Welle = OscillatorType;

let ctx: AudioContext | null = null;
let haupt: GainNode | null = null;
let aus: boolean | null = null;
const hoerer = new Set<(an: boolean) => void>();

const SCHLUESSEL = "ls-ton";

export function tonAn(): boolean {
  if (aus === null) {
    try {
      aus = window.localStorage.getItem(SCHLUESSEL) === "aus";
    } catch {
      aus = false;
    }
  }
  return !aus;
}

export function setzeTon(an: boolean) {
  aus = !an;
  try {
    window.localStorage.setItem(SCHLUESSEL, an ? "an" : "aus");
  } catch {
    // privates Fenster: gilt nur für diesen Besuch
  }
  for (const h of hoerer) h(an);
}

/** Für den Knopf: meldet jede Änderung. */
export function aufTon(h: (an: boolean) => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined" || !tonAn()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      haupt = ctx.createGain();
      haupt.gain.value = 0.5;
      // ein sanfter Begrenzer, damit viele Töne auf einmal nicht kratzen
      const komp = ctx.createDynamicsCompressor();
      komp.threshold.value = -14;
      komp.ratio.value = 6;
      haupt.connect(komp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return { c: ctx, out: haupt! };
  } catch {
    return null;
  }
}

/** Ein Ton: Frequenz, Beginn (s ab jetzt), Länge, Welle, Lautstärke; `bis`: gleitet zu dieser Frequenz. */
function ton(f: number, o: { t?: number; lang?: number; welle?: Welle; laut?: number; bis?: number; an?: number } = {}) {
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  const t0 = c.currentTime + (o.t ?? 0);
  const lang = o.lang ?? 0.18;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.welle ?? "sine";
  osc.frequency.setValueAtTime(f, t0);
  if (o.bis) osc.frequency.exponentialRampToValueAtTime(o.bis, t0 + lang);
  const laut = o.laut ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(laut, t0 + (o.an ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + lang);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + lang + 0.02);
}

/** Ein kurzes Rauschen (Klick, Zischen); `hoch`: Hochpass ab dieser Frequenz. */
function rauschen(o: { t?: number; lang?: number; laut?: number; hoch?: number; tief?: number } = {}) {
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  const t0 = c.currentTime + (o.t ?? 0);
  const lang = o.lang ?? 0.05;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * lang)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = o.tief ? "lowpass" : "highpass";
  filter.frequency.value = o.tief ?? o.hoch ?? 1200;
  const g = c.createGain();
  g.gain.value = o.laut ?? 0.2;
  src.connect(filter).connect(g).connect(out);
  src.start(t0);
}

// Pentatonik (C-Dur ohne F und H): klingt in jeder Folge gut
const PENTA = [0, 2, 4, 7, 9];
const note = (stufe: number, basis = 523.25) => basis * 2 ** ((PENTA[((stufe % 5) + 5) % 5] + 12 * Math.floor(stufe / 5)) / 12);

export const klang = {
  /** Ein Teil anfassen */
  heben() {
    ton(660, { lang: 0.06, welle: "triangle", laut: 0.08 });
  },
  /** Ein Teil liegt */
  setzen() {
    ton(150, { lang: 0.12, welle: "sine", laut: 0.45, bis: 90 });
    rauschen({ lang: 0.03, laut: 0.12, tief: 2400 });
  },
  /** Linien räumen: so viele Töne wie Linien plus einer, höher mit der Kombo */
  linie(linien: number, kombo: number) {
    const start = Math.min(6, Math.max(0, kombo - 1));
    for (let i = 0; i <= Math.min(linien, 4); i++) {
      const n = note(Math.min(11, start + i * 2));
      ton(n, { t: i * 0.07, lang: 0.32, welle: "triangle", laut: 0.28 });
      ton(n * 2, { t: i * 0.07, lang: 0.2, welle: "sine", laut: 0.06 });
    }
    rauschen({ lang: 0.18, laut: 0.1, hoch: 3000 });
  },
  /** Das ganze Brett ist leer */
  frei() {
    [0, 2, 4, 5, 7].forEach((s, i) => ton(note(s), { t: i * 0.09, lang: 0.5, welle: "triangle", laut: 0.3 }));
    ton(note(10), { t: 0.5, lang: 0.9, welle: "sine", laut: 0.25 });
  },
  /** Richtige Antwort (`schnell`: ein Ton mehr) */
  richtig(schnell = false) {
    ton(note(7), { lang: 0.16, welle: "triangle", laut: 0.3 });
    ton(note(9), { t: 0.08, lang: 0.3, welle: "triangle", laut: 0.3 });
    if (schnell) ton(note(11), { t: 0.16, lang: 0.4, welle: "sine", laut: 0.25 });
  },
  /** Falsche Antwort */
  falsch() {
    ton(220, { lang: 0.22, welle: "square", laut: 0.08, bis: 140 });
    ton(165, { t: 0.06, lang: 0.26, welle: "sawtooth", laut: 0.05, bis: 110 });
  },
  /** Das Fieber beginnt */
  fieber() {
    ton(300, { lang: 0.45, welle: "sawtooth", laut: 0.06, bis: 1200 });
    [5, 7, 9, 11].forEach((s, i) => ton(note(s), { t: 0.12 + i * 0.06, lang: 0.35, welle: "triangle", laut: 0.22 }));
  },
  /** Das Fieber endet */
  fieberAus() {
    ton(700, { lang: 0.4, welle: "sine", laut: 0.12, bis: 200 });
  },
  /** Blitz */
  blitz() {
    rauschen({ lang: 0.35, laut: 0.3, hoch: 600 });
    ton(1400, { lang: 0.3, welle: "sawtooth", laut: 0.07, bis: 120 });
  },
  /** Neue Teile kommen */
  teile() {
    [0, 1, 2].forEach((i) => ton(note(4 + i * 2), { t: i * 0.05, lang: 0.1, welle: "sine", laut: 0.12 }));
  },
  /** Nichts passt mehr */
  aus() {
    [7, 4, 2, 0].forEach((s, i) => ton(note(s, 261.63), { t: i * 0.14, lang: 0.4, welle: "triangle", laut: 0.22 }));
  },
  /** Neuer Rekord */
  rekord() {
    [0, 2, 4, 5, 7, 10].forEach((s, i) => ton(note(s), { t: i * 0.1, lang: 0.6, welle: "triangle", laut: 0.25 }));
  },
};
