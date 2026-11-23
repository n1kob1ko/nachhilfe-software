"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Erklär-Animationen im Biolabor (niko 2026-11-23: „die Animationen helfen beim Lernen nicht wirklich“). Statt Deko
 * zeigt jedes Thema einen Ablauf in 4–5 Schritten mit einem Satz darunter: Meiose, Erbgang 3 : 1, Reflexbogen,
 * Hormon im Blut … Die Bühne ist ein SVG (320 × 180); was sich bewegt, bekommt je Schritt eine andere Lage, CSS
 * blendet über (biolabor.css „Erklär-Animationen“). Läuft von selbst weiter, nur solange sie zu sehen ist; bei
 * „weniger Bewegung“ nur mit den Pfeilen.
 *
 * Zu sehen: nach einer falschen Antwort (ab dem passenden Schritt), im Lernzettel und über „Erklärung“ bei jeder Frage.
 */

export type FilmId = "allele" | "teilung" | "dna" | "mendel" | "quadrat" | "mensch" | "gentechnik" | "reflex" | "gehirn" | "gegenspieler" | "hormon";

type Schritt = { text: string; /** wenn das in Frage oder Antwort vorkommt, beginnt der Film hier */ such?: RegExp };
type Film = { titel: string; schritte: Schritt[]; bild: (s: number) => ReactNode };

/** Welcher Film zu welchem Thema (lib/biolabor-inhalt.ts BIO_THEMEN). */
export const FILM_ZU_THEMA: Record<string, FilmId> = {
  grundlagen: "allele",
  glossar: "allele",
  weitergabe: "teilung",
  dna: "dna",
  mendel: "mendel",
  schema: "quadrat",
  mensch: "mensch",
  gentechnik: "gentechnik",
  nerven: "reflex",
  gehirn: "gehirn",
  vegetativ: "gegenspieler",
  sympathikus: "gegenspieler",
  hormone: "hormon",
};

/** Bei welchem Schritt der Film zu einer Frage beginnt: der erste, dessen Stichwort in Frage oder Antwort steht. */
export function startSchritt(film: FilmId, text: string): number {
  const i = FILME[film].schritte.findIndex((s) => s.such?.test(text));
  return i < 0 ? 0 : i;
}

export function filmSchritte(film: FilmId): string[] {
  return FILME[film].schritte.map((s) => s.text);
}

/** Lesezeit je Schritt: etwa 60 ms je Zeichen, mindestens 3 s, höchstens 7 s. */
function dauer(text: string) {
  return Math.min(7000, Math.max(3000, text.length * 60));
}

export function BioFilm({ film, start = 0, kompakt, autoplay = true }: { film: FilmId; start?: number; kompakt?: boolean; autoplay?: boolean }) {
  const f = FILME[film];
  const n = f.schritte.length;
  const [s, setS] = useState(Math.min(start, n - 1));
  const [laeuft, setLaeuft] = useState(autoplay);
  const [sichtbar, setSichtbar] = useState(false);
  const [ruhig, setRuhig] = useState(false);
  const rahmen = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRuhig(r);
    if (r) setLaeuft(false);
    const el = rahmen.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSichtbar(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setSichtbar(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!laeuft || !sichtbar) return;
    // nach dem letzten Schritt etwas länger stehen lassen, dann von vorn
    const zeit = dauer(f.schritte[s].text) + (s === n - 1 ? 1500 : 0);
    const t = window.setTimeout(() => setS((x) => (x + 1) % n), zeit);
    return () => window.clearTimeout(t);
  }, [s, laeuft, sichtbar, f, n]);

  const geh = (i: number) => {
    setS((i + n) % n);
    setLaeuft(false);
  };

  return (
    <figure ref={rahmen} className="bf" data-kompakt={kompakt ? "" : undefined} data-film={film} data-ruhig={ruhig ? "" : undefined} data-testid="bf">
      <div className="bf-buehne" data-schritt={s} data-laeuft={laeuft && sichtbar ? "" : undefined}>
        <svg viewBox="0 0 320 180" role="img" aria-label={`${f.titel}, Schritt ${s + 1} von ${n}`}>
          {f.bild(s)}
        </svg>
      </div>
      <figcaption className="bf-text" aria-live="polite" data-testid="bf-text" key={s}>
        <b className="tabular-nums">
          {s + 1}/{n}
        </b>{" "}
        {f.schritte[s].text.replace(/ : /g, "\u00a0:\u00a0").replace(/ %/g, "\u00a0%")}
      </figcaption>
      <div className="bf-knoepfe">
        <button type="button" onClick={() => geh(s - 1)} aria-label="Schritt zurück" data-testid="bf-zurueck">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="bf-punkte" aria-hidden>
          {f.schritte.map((_, i) => (
            <i key={i} data-an={i === s ? "" : undefined} data-vorbei={i < s ? "" : undefined} />
          ))}
        </span>
        <button type="button" onClick={() => setLaeuft((l) => !l)} aria-label={laeuft ? "Anhalten" : "Abspielen"} data-testid="bf-pause">
          {laeuft ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button type="button" onClick={() => geh(s + 1)} aria-label="Nächster Schritt" data-testid="bf-weiter">
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
    </figure>
  );
}

// ---------- Bausteine ----------

/** Lage und Sichtbarkeit eines Teils; `v` = Verzögerung in ms (nur beim Hingehen). */
function L(x: number, y: number, an = true, o: { s?: number; v?: number; r?: number } = {}): CSSProperties {
  return {
    transform: `translate(${x}px, ${y}px) scale(${o.s ?? 1})${o.r ? ` rotate(${o.r}deg)` : ""}`,
    opacity: an ? 1 : 0,
    transitionDelay: o.v ? `${o.v}ms` : undefined,
  };
}

const ROT = "#e8384f";
const WEISS = "#f4f1ea";
const MUTTER = "#f06595";
const VATER = "#4c9be8";
const GELB = "#ffc933";

function Schrift({ x, y, children, gross, fett = true, farbe, mitte = true, style }: { x: number; y: number; children: ReactNode; gross?: boolean; fett?: boolean; farbe?: string; mitte?: boolean; style?: CSSProperties }) {
  return (
    <text x={x} y={y} className="bf-s" data-gross={gross ? "" : undefined} fontWeight={fett ? 800 : 600} textAnchor={mitte ? "middle" : "start"} style={{ ...(farbe ? { fill: farbe } : {}), ...style }}>
      {children}
    </text>
  );
}

/** Eine Blüte (fünf Blätter), rot, weiß oder rosa. */
function Bluete({ farbe, r = 13 }: { farbe: string; r?: number }) {
  return (
    <g className="bf-bluete">
      {[0, 72, 144, 216, 288].map((w) => (
        <circle key={w} cx={Math.cos(((w - 90) * Math.PI) / 180) * r * 0.75} cy={Math.sin(((w - 90) * Math.PI) / 180) * r * 0.75} r={r * 0.62} style={{ fill: farbe }} stroke="#00000022" strokeWidth={1} />
      ))}
      <circle r={r * 0.36} fill={GELB} />
    </g>
  );
}

/** Ein Chromosom als Stäbchen (Länge l, Farbe). */
function Stab({ l = 22, farbe, b = 7 }: { l?: number; farbe: string; b?: number }) {
  return <rect x={-b / 2} y={-l / 2} width={b} height={l} rx={b / 2} fill={farbe} />;
}

/** Eine Zelle mit Chromosomen. `paare`: welche Stäbchen drin sind ([Länge, Farbe]). */
function Zelle({ r, stabe, zahl, farbe = "#d9f3ec" }: { r: number; stabe: [number, string][]; zahl?: string; farbe?: string }) {
  const abstand = Math.min(14, (r * 1.3) / Math.max(1, stabe.length));
  return (
    <g>
      <circle r={r} fill={farbe} stroke="#5bbfa8" strokeWidth={2.5} />
      {stabe.map(([l, f], i) => (
        <g key={i} transform={`translate(${(i - (stabe.length - 1) / 2) * abstand}, 0)`}>
          <Stab l={l} farbe={f} b={6} />
        </g>
      ))}
      {zahl && (
        <g transform={`translate(0, ${r + 13})`}>
          <rect x={-17} y={-10} width={34} height={17} rx={8.5} className="bf-marke" />
          <text y={3} textAnchor="middle" className="bf-s bf-klein" fontWeight={800}>
            {zahl}
          </text>
        </g>
      )}
    </g>
  );
}

// ---------- die Filme ----------

const FILME: Record<FilmId, Film> = {
  allele: {
    titel: "Gen, Allel, Genotyp, Phänotyp",
    schritte: [
      { text: "Chromosomen gibt es in Paaren: eines ist von der Mutter, eines vom Vater." },
      { text: "Auf beiden liegt an derselben Stelle das Gen für die Blütenfarbe.", such: /\bGen\b|Erbanlage/ },
      { text: "Die zwei Formen des Gens heißen Allele: R (rot) und r (weiß). Die Buchstaben Rr sind der Genotyp.", such: /Allel|Genotyp|reinerbig|mischerbig|homozygot|heterozygot/i },
      { text: "R ist dominant und überdeckt r. Darum blüht die Pflanze rot: das ist der Phänotyp.", such: /Phänotyp|dominant|rezessiv|Aussehen/i },
    ],
    bild: (s) => (
      <>
        <g style={L(70, 28)}>
          <rect x={-9} width={18} height={118} rx={9} fill={MUTTER} />
          <rect x={-11} y={52} width={22} height={13} rx={3} className="bf-band" data-an={s >= 1 ? "" : undefined} />
          <Schrift x={0} y={138} fett={false}>
            Mutter
          </Schrift>
        </g>
        <g style={L(122, 28)}>
          <rect x={-9} width={18} height={118} rx={9} fill={VATER} />
          <rect x={-11} y={52} width={22} height={13} rx={3} className="bf-band" data-an={s >= 1 ? "" : undefined} />
          <Schrift x={0} y={138} fett={false}>
            Vater
          </Schrift>
        </g>
        <g style={L(96, 64, s === 1)}>
          <path d="M-14 23 L14 23" className="bf-linie" />
          <Schrift x={46} y={28} mitte={false}>
            Gen für Blütenfarbe
          </Schrift>
        </g>
        <g style={L(0, 0, s >= 2)}>
          <Schrift x={44} y={97} gross farbe={ROT}>
            R
          </Schrift>
          <Schrift x={148} y={97} gross>
            r
          </Schrift>
          <Schrift x={225} y={40}>
            Genotyp: Rr
          </Schrift>
        </g>
        <g style={L(225, 95, s >= 2, { s: s >= 3 ? 1.15 : 0.9 })}>
          <Bluete farbe={s >= 3 ? ROT : "#cfd6d4"} r={22} />
        </g>
        <g style={L(0, 0, s >= 3, { v: 300 })}>
          <Schrift x={225} y={150}>
            Phänotyp: rot
          </Schrift>
          <Schrift x={225} y={168} fett={false}>
            R dominant, r rezessiv
          </Schrift>
        </g>
      </>
    ),
  },

  teilung: {
    titel: "Mitose, Meiose, Befruchtung",
    schritte: [
      { text: "Eine Körperzelle hat die Chromosomen doppelt, in Paaren. Beim Menschen sind es 46, hier zeigen wir 4." },
      { text: "Mitose: Die DNA wird kopiert, dann teilt sich die Zelle. Zwei gleiche Zellen mit je 46 Chromosomen, für Wachstum und Heilung.", such: /Mitose|Wachstum|erneuern|verdoppelt/ },
      { text: "Meiose: In Eierstock und Hoden entstehen aus einer Zelle vier Keimzellen. Jede hat nur den halben Satz: 23.", such: /Meiose|Keimzell|Reife|Reduktion|halb|Hoden|Eierst|zufällig|Geschwister/ },
      { text: "Befruchtung: Eizelle (23) und Spermium (23) verschmelzen zur Zygote mit 46 Chromosomen.", such: /Zygote|Befruchtung|verschmelzen/ },
    ],
    bild: (s) => {
      const alle: [number, string][] = [
        [34, MUTTER],
        [34, VATER],
        [20, MUTTER],
        [20, VATER],
      ];
      return (
        <>
          {/* Mitose: zwei gleiche Zellen gehen aus der Mitte auseinander */}
          <g style={L(s === 1 ? 85 : 160, 82, s <= 1, { s: s === 1 ? 0.85 : 1 })}>
            <Zelle r={52} stabe={alle} zahl="46" />
          </g>
          <g style={L(s === 1 ? 235 : 160, 82, s <= 1, { s: s === 1 ? 0.85 : 1 })}>
            <Zelle r={52} stabe={alle} zahl="46" />
          </g>
          <g style={L(160, 14, s === 1, { v: 400 })}>
            <Schrift x={0} y={6}>
              Mitose
            </Schrift>
          </g>
          {/* Meiose: vier Keimzellen mit je einem aus jedem Paar */}
          {(
            [
              [40, [34, MUTTER], [20, VATER]],
              [120, [34, VATER], [20, VATER]],
              [200, [34, MUTTER], [20, MUTTER]],
              [280, [34, VATER], [20, MUTTER]],
            ] as [number, [number, string], [number, string]][]
          ).map(([x, a, b], i) => (
            <g key={x} style={L(s === 2 ? x : 160, 82, s === 2, { s: s === 2 ? 1 : 0.4, v: s === 2 ? i * 120 : 0 })}>
              <Zelle r={30} stabe={[a, b]} zahl="23" />
            </g>
          ))}
          <g style={L(160, 14, s === 2, { v: 300 })}>
            <Schrift x={0} y={6}>
              Meiose
            </Schrift>
          </g>
          {/* Befruchtung: Spermium schwimmt zur Eizelle, daraus wird die Zygote */}
          <g style={L(68, 82, s === 3)}>
            <Zelle r={40} stabe={[alle[0], alle[2]]} farbe="#fde2ec" />
            <Schrift x={0} y={62} fett={false}>
              Eizelle 23
            </Schrift>
          </g>
          <g style={L(s === 3 ? 120 : 290, 82, s === 3, { v: s === 3 ? 200 : 0 })}>
            <path d="M8 0 C 30 -10, 40 10, 62 0" className="bf-schwanz" />
            <ellipse rx={11} ry={8} fill="#dbeafe" stroke={VATER} strokeWidth={2} />
            <Schrift x={40} y={30} fett={false}>
              Spermium 23
            </Schrift>
          </g>
          <g style={L(0, 0, s === 3, { v: 1100 })}>
            <path d="M196 82 H214 M208 76 L214 82 L208 88" className="bf-pfeil" />
          </g>
          <g style={L(262, 82, s === 3, { v: 1400 })}>
            <Zelle r={34} stabe={alle} zahl="46" farbe="#fff3d6" />
            <Schrift x={0} y={-44}>
              Zygote
            </Schrift>
          </g>
        </>
      );
    },
  },

  dna: {
    titel: "Zellkern, Chromosom, DNA, Gen",
    schritte: [
      { text: "Die Erbinformation liegt im Zellkern, auf den Chromosomen. Der Mensch hat 46 (23 Paare).", such: /Zellkern|46|23 Paare|Karyogramm|Autosom/ },
      { text: "Ein Chromosom ist ein dicht aufgewickelter DNA-Faden.", such: /Chromosom/ },
      { text: "Die DNA ist eine Doppelhelix: wie eine verdrehte Strickleiter (Watson und Crick, 1953).", such: /Helix|Strickleiter|Watson|Crick|Desoxy/ },
      { text: "Die Sprossen sind Basenpaare: immer A mit T und G mit C. Ein Abschnitt der DNA ist ein Gen.", such: /Base|Adenin|Thymin|Guanin|Cytosin|\bGen\b/ },
    ],
    bild: (s) => {
      const z = (i: number) => ({ ...L(0, 0, s === i, { s: s === i ? 1 : s > i ? 1.8 : 0.5 }), transformOrigin: "160px 90px", transformBox: "view-box" as const });
      const basen = ["A", "G", "T", "C", "C", "A", "G", "T"];
      const paar: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
      const farbe: Record<string, string> = { A: "#ff6b6b", T: "#ffd43b", G: "#51cf66", C: "#4dabf7" };
      return (
        <>
          <g style={z(0)}>
            <ellipse cx={160} cy={90} rx={130} ry={72} fill="#e6f6f2" stroke="#5bbfa8" strokeWidth={2.5} />
            <circle cx={160} cy={90} r={44} fill="#cdeee6" stroke="#2f9c86" strokeWidth={2.5} />
            {[
              [140, 75, 20],
              [170, 70, -30],
              [150, 105, 60],
              [180, 100, 10],
              [162, 88, -70],
            ].map(([x, y, w], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${w})`}>
                <rect x={-2.5} y={-9} width={5} height={18} rx={2.5} fill={i % 2 ? VATER : MUTTER} />
                <rect x={1.5} y={-9} width={5} height={18} rx={2.5} fill={i % 2 ? VATER : MUTTER} />
              </g>
            ))}
            <Schrift x={160} y={160}>
              Zellkern
            </Schrift>
          </g>
          <g style={z(1)}>
            <g transform="translate(160 84)">
              <rect x={-11} y={-60} width={22} height={120} rx={11} fill={MUTTER} transform="rotate(-22)" />
              <rect x={-11} y={-60} width={22} height={120} rx={11} fill={MUTTER} transform="rotate(22)" />
              <circle r={9} fill="#c2255c" />
            </g>
            <rect x={198} y={24} width={40} height={30} rx={6} className="bf-lupe" />
            <Schrift x={160} y={170}>
              ein Chromosom
            </Schrift>
          </g>
          <g style={z(2)}>
            <g className="bf-helix">
              {Array.from({ length: 15 }, (_, i) => {
                const x = 30 + i * 18;
                const y1 = 90 + Math.sin(i * 0.7) * 42;
                const y2 = 90 - Math.sin(i * 0.7) * 42;
                return (
                  <g key={i}>
                    <line x1={x} y1={y1} x2={x} y2={y2} stroke={Object.values(farbe)[i % 4]} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
                    <circle cx={x} cy={y1} r={5} fill="#7048e8" />
                    <circle cx={x} cy={y2} r={5} fill="#12b886" />
                  </g>
                );
              })}
            </g>
            <Schrift x={160} y={170}>
              DNA: Doppelhelix
            </Schrift>
          </g>
          <g style={z(3)}>
            <rect x={36} y={30} width={248} height={8} rx={4} fill="#7048e8" />
            <rect x={36} y={126} width={248} height={8} rx={4} fill="#12b886" />
            {basen.map((b, i) => {
              const x = 52 + i * 31;
              return (
                <g key={i} style={L(0, 0, s === 3, { v: s === 3 ? 200 + i * 120 : 0 })}>
                  <rect x={x - 10} y={38} width={20} height={44} rx={4} fill={farbe[b]} />
                  <rect x={x - 10} y={82} width={20} height={44} rx={4} fill={farbe[paar[b]]} />
                  <text x={x} y={66} textAnchor="middle" className="bf-s bf-auf" fontWeight={800}>
                    {b}
                  </text>
                  <text x={x} y={110} textAnchor="middle" className="bf-s bf-auf" fontWeight={800}>
                    {paar[b]}
                  </text>
                </g>
              );
            })}
            <g style={L(0, 0, s === 3, { v: s === 3 ? 1300 : 0 })}>
              <path d="M110 27 V21 H230 V27" className="bf-linie" />
              <Schrift x={170} y={16}>
                ein Gen
              </Schrift>
              <Schrift x={160} y={158} fett={false}>
                A – T und G – C
              </Schrift>
            </g>
          </g>
        </>
      );
    },
  },

  mendel: {
    titel: "Mendel’sche Regeln",
    schritte: [
      { text: "P-Generation: eine reinerbig rote (RR) und eine reinerbig weiße Erbse (rr) werden gekreuzt.", such: /\bP\b|Elterngeneration|reinerbig/ },
      { text: "Jede Keimzelle bekommt ein Allel: von der roten nur R, von der weißen nur r." },
      { text: "F1: alle sind Rr und blühen rot. 1. Regel, Uniformitätsregel: alle Nachkommen sind gleich.", such: /F1|1\. Regel|Uniform/ },
      { text: "Die F1 wird untereinander gekreuzt (Rr × Rr). In der F2 gibt es RR, Rr, Rr und rr.", such: /F2|2\. Regel|Spaltung/ },
      { text: "3 rot : 1 weiß. 2. Regel, Spaltungsregel: das weiße Merkmal taucht wieder auf. Intermediär wäre es 1 : 2 : 1.", such: /3 ?: ?1|1 ?: ?2 ?: ?1|intermediär|Wunderblume|rosa/ },
    ],
    bild: (s) => {
      const f2: [string, string][] = [
        ["RR", ROT],
        ["Rr", ROT],
        ["Rr", ROT],
        ["rr", WEISS],
      ];
      return (
        <>
          <Schrift x={16} y={36} mitte={false}>
            P
          </Schrift>
          <g style={L(0, 0, s >= 2)}>
            <Schrift x={12} y={96} mitte={false}>
              F1
            </Schrift>
          </g>
          <g style={L(0, 0, s >= 3)}>
            <Schrift x={12} y={152} mitte={false}>
              F2
            </Schrift>
          </g>
          <g style={L(115, 30)}>
            <Bluete farbe={ROT} />
            <Schrift x={0} y={27}>
              RR
            </Schrift>
          </g>
          <Schrift x={160} y={35}>
            ×
          </Schrift>
          <g style={L(205, 30)}>
            <Bluete farbe={WEISS} />
            <Schrift x={0} y={27}>
              rr
            </Schrift>
          </g>
          {/* Keimzellen */}
          <g style={L(s >= 1 ? 146 : 115, s >= 1 ? 66 : 30, s === 1, { s: s >= 1 ? 1 : 0.4 })}>
            <circle r={9} fill="#fde2e6" stroke={ROT} strokeWidth={2} />
            <Schrift x={0} y={4}>
              R
            </Schrift>
          </g>
          <g style={L(s >= 1 ? 174 : 205, s >= 1 ? 66 : 30, s === 1, { s: s >= 1 ? 1 : 0.4 })}>
            <circle r={9} fill="#fff" stroke="#9aa5a2" strokeWidth={2} />
            <Schrift x={0} y={4}>
              r
            </Schrift>
          </g>
          {/* F1 */}
          {[110, 160, 210].map((x, i) => (
            <g key={x} style={L(x, 88, s >= 2, { s: s >= 2 ? 1 : 0.3, v: s === 2 ? i * 150 : 0 })}>
              <Bluete farbe={ROT} />
              <Schrift x={0} y={27} fett={false}>
                Rr
              </Schrift>
            </g>
          ))}
          <g style={L(0, 0, s === 2, { v: 600 })}>
            <Schrift x={268} y={93} fett={false}>
              alle gleich
            </Schrift>
          </g>
          {/* F2 */}
          {f2.map(([g, farbe], i) => (
            <g key={i} style={L(85 + i * 50, 144, s >= 3, { s: s >= 3 ? (s === 4 && g === "rr" ? 1.15 : 1) : 0.3, v: s === 3 ? i * 180 : 0 })}>
              <Bluete farbe={farbe} />
              <Schrift x={0} y={27} fett={false}>
                {g}
              </Schrift>
            </g>
          ))}
          <g style={L(0, 0, s === 4, { v: 200 })}>
            <rect x={262} y={128} width={52} height={32} rx={10} className="bf-marke" />
            <Schrift x={288} y={150} gross>
              3 : 1
            </Schrift>
          </g>
        </>
      );
    },
  },

  quadrat: {
    titel: "So füllst du ein Kreuzungsschema aus",
    schritte: [
      { text: "Schreib zuerst die Genotypen der Eltern auf: Mutter Rr × Vater Rr." },
      { text: "Die Keimzellen des Vaters kommen nach oben: jede bekommt ein Allel, R oder r.", such: /Keimzell|Gamet/ },
      { text: "Die Keimzellen der Mutter kommen nach links: R und r." },
      { text: "In jedes Feld kommt ein Buchstabe von oben und einer von links. Großbuchstabe zuerst." },
      { text: "Auszählen: 1 RR, 2 Rr, 1 rr. Jedes Feld ist 25 %. Aussehen: 3 rot : 1 weiß.", such: /%|Chance|wahrscheinlich|Verhältnis|wie viele/i },
    ],
    bild: (s) => {
      const x0 = 92;
      const y0 = 62;
      const w = 60;
      const h = 50;
      const oben = ["R", "r"];
      const links = ["R", "r"];
      const felder = ["RR", "Rr", "Rr", "rr"];
      return (
        <>
          <g style={L(0, 0, true)}>
            <Schrift x={86} y={20} farbe={MUTTER}>
              ♀ Rr
            </Schrift>
            <Schrift x={136} y={20}>
              ×
            </Schrift>
            <Schrift x={186} y={20} farbe={VATER}>
              ♂ Rr
            </Schrift>
          </g>
          {/* Gitter */}
          {[0, 1].map((r) =>
            [0, 1].map((c) => {
              const i = r * 2 + c;
              const g = felder[i];
              return (
                <g key={i}>
                  <rect x={x0 + c * w} y={y0 + r * h} width={w - 4} height={h - 4} rx={8} className="bf-feld" data-farbe={s >= 4 ? (g === "rr" ? "weiss" : "rot") : undefined} />
                  <g style={L(0, 0, s >= 3, { v: s === 3 ? 300 + i * 450 : 0 })}>
                    <text x={x0 + c * w + (w - 4) / 2} y={y0 + r * h + 29} textAnchor="middle" className="bf-s" data-gross="" fontWeight={800}>
                      {g}
                    </text>
                  </g>
                </g>
              );
            }),
          )}
          {/* Keimzellen oben (Vater) */}
          {oben.map((a, c) => (
            <g key={c} style={L(s >= 1 ? x0 + c * w + (w - 4) / 2 : 186, s >= 1 ? y0 - 14 : 16, s >= 1, { s: s >= 1 ? 1 : 0.5, v: s === 1 ? c * 250 : 0 })}>
              <circle r={11} fill="#dbeafe" stroke={VATER} strokeWidth={2} />
              <Schrift x={0} y={5}>
                {a}
              </Schrift>
            </g>
          ))}
          {/* Keimzellen links (Mutter) */}
          {links.map((a, r) => (
            <g key={r} style={L(s >= 2 ? x0 - 18 : 86, s >= 2 ? y0 + r * h + (h - 4) / 2 : 16, s >= 2, { s: s >= 2 ? 1 : 0.5, v: s === 2 ? r * 250 : 0 })}>
              <circle r={11} fill="#fde2ec" stroke={MUTTER} strokeWidth={2} />
              <Schrift x={0} y={5}>
                {a}
              </Schrift>
            </g>
          ))}
          {/* Hilfslinien beim Ausfüllen */}
          <g style={L(0, 0, s === 3, { v: 300 })}>
            <path d={`M${x0 + (w - 4) / 2} ${y0 - 2} V${y0 + 10}`} className="bf-pfeil" />
            <path d={`M${x0 - 6} ${y0 + (h - 4) / 2} H${x0 + 8}`} className="bf-pfeil" />
          </g>
          {/* Auszählen */}
          <g style={L(0, 0, s === 4, { v: 300 })}>
            <Schrift x={256} y={70} fett={false}>
              1 RR : 2 Rr : 1 rr
            </Schrift>
            <Schrift x={256} y={96} gross>
              3 : 1
            </Schrift>
            <Schrift x={256} y={116} fett={false}>
              rot : weiß
            </Schrift>
            <Schrift x={256} y={146} fett={false}>
              1 Feld = 25 %
            </Schrift>
          </g>
        </>
      );
    },
  },

  mensch: {
    titel: "Geschlecht und Blutgruppen",
    schritte: [
      { text: "Die Mutter hat XX. Jede Eizelle bekommt ein X.", such: /XX|Eizelle/ },
      { text: "Der Vater hat XY. Ein Spermium hat entweder ein X oder ein Y." },
      { text: "X + X = Mädchen, X + Y = Bub. Das Spermium entscheidet, die Chance ist 50 : 50.", such: /Mädchen|Bub|Geschlecht|Junge|XY|50/ },
      { text: "Blutgruppen: Mutter A0 (Blutgruppe A) × Vater B0 (Blutgruppe B). A und B sind dominant über 0.", such: /Blut|A0|B0|\bAB\b|dominant über/ },
      { text: "Die Kinder können AB, A0, B0 oder 00 haben: Blutgruppe AB, A, B oder 0, jede mit 25 %.", such: /Kinder.*Blutgruppe|Blutgruppe 0|00/ },
    ],
    bild: (s) => {
      const sex = s <= 2;
      return (
        <>
          <g style={L(0, 0, sex)}>
            <g style={L(70, 30)}>
              <rect x={-34} y={-18} width={68} height={30} rx={10} fill="#fde2ec" stroke={MUTTER} strokeWidth={2} />
              <Schrift x={0} y={3}>
                ♀ XX
              </Schrift>
            </g>
            {[45, 95].map((x, i) => (
              <g key={x} style={L(s >= 0 ? x : 70, 82, true, { v: i * 200 })}>
                <circle r={17} fill="#fde2ec" stroke={MUTTER} strokeWidth={2} />
                <Schrift x={0} y={5}>
                  X
                </Schrift>
              </g>
            ))}
            <g style={L(250, 30, s >= 1)}>
              <rect x={-34} y={-18} width={68} height={30} rx={10} fill="#dbeafe" stroke={VATER} strokeWidth={2} />
              <Schrift x={0} y={3}>
                ♂ XY
              </Schrift>
            </g>
            {["X", "Y"].map((a, i) => (
              <g key={a} style={L(s >= 1 ? 208 + i * 62 : 250, 82, s >= 1, { v: s === 1 ? 200 + i * 200 : 0 })}>
                <path d="M12 0 C 20 -6, 26 6, 34 0" className="bf-schwanz" />
                <ellipse rx={14} ry={11} fill="#dbeafe" stroke={VATER} strokeWidth={2} />
                <Schrift x={0} y={5}>
                  {a}
                </Schrift>
              </g>
            ))}
            <g style={L(0, 0, s === 2, { v: 200 })}>
              <Schrift x={160} y={126} farbe={MUTTER}>
                X + X = Mädchen
              </Schrift>
              <Schrift x={160} y={145} farbe={VATER}>
                X + Y = Bub
              </Schrift>
              <Schrift x={160} y={172} gross>
                50 : 50
              </Schrift>
            </g>
          </g>
          <g style={L(0, 0, !sex)}>
            <g style={L(80, 28)}>
              <rect x={-46} y={-18} width={92} height={30} rx={10} fill="#fde2ec" stroke={MUTTER} strokeWidth={2} />
              <Schrift x={0} y={3}>
                ♀ A0 (A)
              </Schrift>
            </g>
            <Schrift x={160} y={32}>
              ×
            </Schrift>
            <g style={L(240, 28)}>
              <rect x={-46} y={-18} width={92} height={30} rx={10} fill="#dbeafe" stroke={VATER} strokeWidth={2} />
              <Schrift x={0} y={3}>
                ♂ B0 (B)
              </Schrift>
            </g>
            {(
              [
                ["AB", "AB"],
                ["A0", "A"],
                ["B0", "B"],
                ["00", "0"],
              ] as const
            ).map(([g, bg], i) => (
              <g key={g} style={L(70 + i * 60, 100, s === 4, { s: s === 4 ? 1 : 0.3, v: s === 4 ? i * 220 : 0 })}>
                <path d="M0 -24 C 10 -10, 18 -2, 18 8 A 18 18 0 0 1 -18 8 C -18 -2, -10 -10, 0 -24 Z" fill="#e03131" />
                <text y={10} textAnchor="middle" className="bf-s bf-auf" fontWeight={800}>
                  {g}
                </text>
                <Schrift x={0} y={52}>
                  {bg}
                </Schrift>
              </g>
            ))}
            <g style={L(0, 0, s === 3, { v: 200 })}>
              <Schrift x={160} y={100} fett={false}>
                Allele: A, B und 0
              </Schrift>
              <Schrift x={160} y={124} fett={false}>
                A und B dominant über 0
              </Schrift>
              <Schrift x={160} y={148} fett={false}>
                A + B zusammen: AB
              </Schrift>
            </g>
          </g>
        </>
      );
    },
  },

  gentechnik: {
    titel: "So arbeitet Gentechnik",
    schritte: [
      { text: "Ein Gen, z. B. für Insulin, wird aus der DNA des Menschen herausgeschnitten.", such: /schneid|Gen.*übertrag|verändert/ },
      { text: "Das Gen wird in die DNA eines Bakteriums eingebaut." },
      { text: "Das Bakterium vermehrt sich schnell und stellt nun Insulin her: ein Medikament für Menschen mit Diabetes.", such: /Insulin|Bakteri|Medikament|Diabetes/ },
      { text: "Drei Zweige: rot = Medizin, grün = Pflanzen und Landwirtschaft, weiß = Industrie (z. B. Enzyme für Waschmittel).", such: /rot|grün|weiß|Zweig|Mais|Reis|Waschmittel|Industrie/ },
    ],
    bild: (s) => (
      <>
        <g style={{ ...L(0, 0, true), opacity: s === 3 ? 0.15 : 1 }}>
          {/* DNA des Menschen */}
          <g>
            <rect x={16} y={34} width={288} height={5} rx={2.5} fill="#7048e8" />
            <rect x={16} y={56} width={288} height={5} rx={2.5} fill="#12b886" />
            {Array.from({ length: 16 }, (_, i) => (
              <rect key={i} x={24 + i * 18} y={39} width={5} height={17} fill={i >= 6 && i <= 9 ? "transparent" : "#adb5bd"} />
            ))}
            <Schrift x={40} y={24} fett={false} mitte={false}>
              DNA Mensch
            </Schrift>
          </g>
          <g style={L(118, 80, s === 0)}>
            <g className="bf-schere">
              <circle cx={-6} cy={10} r={5} />
              <circle cx={6} cy={10} r={5} />
              <path d="M-3 6 L6 -14 M3 6 L-6 -14" />
            </g>
          </g>
          {/* Bakterium */}
          <g style={L(160, 125, s >= 1)}>
            <rect x={-66} y={-30} width={132} height={60} rx={30} fill="#d3f9d8" stroke="#2f9e44" strokeWidth={2.5} />
            <circle r={20} fill="none" stroke="#2f9e44" strokeWidth={2.5} strokeDasharray="4 3" />
            <Schrift x={0} y={48} fett={false}>
              Bakterium
            </Schrift>
          </g>
          {/* das Gen */}
          <g style={L(160, s >= 1 ? 125 : 47, true, { s: s >= 1 ? 0.5 : 1, v: s === 1 ? 300 : 0 })}>
            <rect x={-38} y={-14} width={76} height={28} rx={6} fill={GELB} stroke="#e8a400" strokeWidth={2} />
            <text y={5} textAnchor="middle" className="bf-s bf-auf-dunkel" fontWeight={800}>
              Insulin-Gen
            </text>
          </g>
          {/* Vermehrung und Insulin */}
          {[
            [52, 125],
            [268, 125],
            [52, 82],
            [268, 82],
          ].map(([x, y], i) => (
            <g key={i} style={L(x, y, s >= 2, { s: s >= 2 ? 0.45 : 0.1, v: s === 2 ? i * 250 : 0 })}>
              <rect x={-66} y={-30} width={132} height={60} rx={30} fill="#d3f9d8" stroke="#2f9e44" strokeWidth={3} />
              <rect x={-20} y={-8} width={40} height={16} rx={4} fill={GELB} />
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={`i${i}`} style={L(110 + i * 20, s >= 2 ? 84 : 120, s >= 2, { v: s === 2 ? 900 + i * 120 : 0 })}>
              <polygon points="0,-6 5,-3 5,3 0,6 -5,3 -5,-3" fill="#f59f00" />
            </g>
          ))}
          <g style={L(0, 0, s === 2, { v: 1500 })}>
            <Schrift x={160} y={74} fett={false}>
              Insulin
            </Schrift>
          </g>
        </g>
        {/* drei Zweige */}
        {(
          [
            ["rot", "Medizin", "#e03131"],
            ["grün", "Pflanzen", "#2f9e44"],
            ["weiß", "Industrie", "#868e96"],
          ] as const
        ).map(([n, w, f], i) => (
          <g key={n} style={L(60 + i * 100, 90, s === 3, { s: s === 3 ? 1 : 0.6, v: s === 3 ? i * 250 : 0 })}>
            <rect x={-44} y={-34} width={88} height={68} rx={14} className="bf-karte" stroke={f} strokeWidth={3} />
            <Schrift x={0} y={-6} farbe={f}>
              {n}
            </Schrift>
            <Schrift x={0} y={16} fett={false}>
              {w}
            </Schrift>
          </g>
        ))}
      </>
    ),
  },

  reflex: {
    titel: "Reflexbogen: Hand auf der heißen Herdplatte",
    schritte: [
      { text: "Reiz: Die Hand berührt die heiße Herdplatte. Sinneszellen in der Haut nehmen die Hitze auf.", such: /Reiz|Sinnes/ },
      { text: "Ein sensibler Nerv leitet das Signal zum Rückenmark.", such: /sensib|sensor|zum ZNS|melden/ },
      { text: "Im Rückenmark wird das Signal gleich umgeschaltet, ohne Umweg über das Gehirn. Das ist ein Reflex.", such: /Reflex|Rückenmark|unbewusst/ },
      { text: "Ein motorischer Nerv bringt den Befehl zum Muskel: die Hand zuckt weg.", such: /motor|Muskel|Befehl/ },
      { text: "Erst danach spürt das Gehirn den Schmerz. ZNS = Gehirn und Rückenmark, PNS = alle Nerven im Körper.", such: /ZNS|PNS|zentral|peripher|Gehirn/ },
    ],
    bild: (s) => {
      const sensibel = "M58 120 C 120 86, 190 88, 247 100";
      const motorisch = "M247 112 C 220 136, 180 140, 150 136";
      return (
        <>
          {/* Gehirn und Rückenmark */}
          <ellipse cx={256} cy={30} rx={44} ry={24} className="bf-zns" data-an={s === 4 ? "" : undefined} />
          <rect x={247} y={50} width={18} height={124} rx={9} className="bf-zns" data-an={s === 2 || s === 4 ? "" : undefined} />
          <g style={L(0, 0, s === 4)}>
            <path d="M256 100 V54" className="bf-nerv" data-an="" />
          </g>
          {/* Herdplatte und Arm */}
          <rect x={14} y={152} width={70} height={12} rx={4} fill="#e8590c" className="bf-heiss" />
          <g style={L(0, s >= 3 ? -26 : 0, true, { v: s === 3 ? 1300 : 0 })}>
            <path d="M200 130 L58 130" stroke="#f2c6a0" strokeWidth={20} strokeLinecap="round" />
            <ellipse cx={150} cy={130} rx={22} ry={11} className="bf-muskel" data-an={s === 3 ? "" : undefined} />
            <circle cx={50} cy={134} r={14} fill="#f2c6a0" />
            {/* Nerven: gehen mit dem Arm mit, enden aber immer am Rückenmark */}
            <path d={sensibel} className="bf-nerv" data-an={s >= 1 && s !== 3 ? "" : undefined} data-art="sensibel" />
            <path d={motorisch} className="bf-nerv" data-an={s >= 3 ? "" : undefined} data-art="motorisch" />
            {s === 1 && <Signal pfad={sensibel} />}
            {s === 3 && <Signal pfad={motorisch} motorisch />}
          </g>
          {s === 4 && <Signal pfad="M256 100 V54" />}
          {/* Beschriftung */}
          <g style={L(0, 0, s === 0)}>
            <Schrift x={92} y={176}>
              Reiz: heiß!
            </Schrift>
          </g>
          <g style={L(0, 0, s === 1, { v: 300 })}>
            <Schrift x={150} y={80} farbe="#1c7ed6">
              sensibler Nerv
            </Schrift>
          </g>
          <g style={L(0, 0, s === 2, { v: 200 })}>
            <Schrift x={190} y={70}>
              Rückenmark:
            </Schrift>
            <Schrift x={190} y={86} fett={false}>
              umschalten
            </Schrift>
          </g>
          <g style={L(0, 0, s === 3, { v: 300 })}>
            <Schrift x={190} y={166} farbe="#e8590c">
              motorischer Nerv
            </Schrift>
          </g>
          <g style={L(0, 0, s === 4, { v: 500 })}>
            <Schrift x={180} y={24}>
              Au!
            </Schrift>
            <Schrift x={300} y={86} fett={false}>
              ZNS
            </Schrift>
            <Schrift x={120} y={84} fett={false}>
              PNS
            </Schrift>
          </g>
        </>
      );
    },
  },

  gehirn: {
    titel: "Die Teile des Gehirns",
    schritte: [
      { text: "Großhirn: der größte Teil. Denken, Lernen, Gedächtnis, Sprache, Wahrnehmung und willkürliche Bewegungen. Links steuert die rechte Körperseite.", such: /Großhirn|Denken|Gedächtnis|Sprache|Rinde|Hälfte|bewusst/ },
      { text: "Kleinhirn: Gleichgewicht und fein abgestimmte Bewegungen, zum Beispiel Radfahren.", such: /Kleinhirn|Gleichgewicht|Radfahren|Tanzen/ },
      { text: "Zwischenhirn: die Schaltstelle. Der Hypothalamus regelt Körpertemperatur, Hunger und Durst und steuert die Hormone.", such: /Zwischenhirn|Hypothalamus|Temperatur|Hunger|Durst/ },
      { text: "Hirnstamm mit verlängertem Mark: lebenswichtig. Atmung, Herzschlag, Blutdruck, Schlucken und Husten.", such: /Hirnstamm|verlängert|Atmung|Herzschlag|Schlucken|Husten/ },
    ],
    bild: (s) => {
      const teil = (i: number) => (s === i ? "" : undefined);
      const namen = ["Großhirn", "Kleinhirn", "Zwischenhirn", "Hirnstamm"];
      const lage: [number, number][] = [
        [92, 24],
        [276, 170],
        [254, 70],
        [112, 166],
      ];
      return (
        <>
          <path d="M60 104 C 40 60, 80 18, 150 16 C 220 14, 262 50, 252 96 C 246 120, 220 124, 196 118 L 120 120 C 90 124, 66 120, 60 104 Z" className="bf-hirn" data-an={teil(0)} />
          <path d="M90 60 C 110 50, 120 70, 140 58 M150 40 C 170 52, 180 34, 200 46 M110 92 C 130 82, 150 100, 170 88 M200 76 C 214 68, 226 84, 238 74" className="bf-furche" />
          <ellipse cx={216} cy={132} rx={34} ry={20} className="bf-hirn" data-an={teil(1)} />
          <path d="M190 128 H242 M192 136 H240 M198 144 H234" className="bf-furche" />
          <ellipse cx={168} cy={98} rx={22} ry={13} className="bf-hirn" data-an={teil(2)} data-innen="" />
          <path d="M162 112 C 166 132, 170 150, 168 174 L 186 174 C 186 150, 186 130, 182 112 Z" className="bf-hirn" data-an={teil(3)} />
          {namen.map((n, i) => (
            <g key={n} style={L(0, 0, s === i, { v: 250 })}>
              <Schrift x={lage[i][0]} y={lage[i][1]}>
                {n}
              </Schrift>
            </g>
          ))}
          <g style={L(0, 0, s === 2, { v: 250 })}>
            <path d="M190 98 C 220 96, 230 84, 236 76" className="bf-linie" />
          </g>
        </>
      );
    },
  },

  gegenspieler: {
    titel: "Sympathikus und Parasympathikus",
    schritte: [
      { text: "Das unwillkürliche (vegetative) Nervensystem steuert die inneren Organe von selbst, ohne unseren Willen.", such: /unwillkürlich|vegetativ|ohne.*Willen|innere Organe|willkürlich/ },
      { text: "Sympathikus = Gas geben, für Stress, Kampf oder Flucht: Herz schneller, Pupillen weit, Atmung schneller, Verdauung gebremst.", such: /^Sympathikus|Sympathikus$|Stress|Flucht|Kampf|schneller|weiter|gebremst|Leistung/ },
      { text: "Parasympathikus = Bremse, für Ruhe und Erholung: Herz langsamer, Pupillen eng, Atmung ruhig, Verdauung angeregt.", such: /Parasympathikus|Ruhe|Erholung|langsamer|enger|angeregt|Verdauung/ },
      { text: "Die zwei sind Gegenspieler: sie wirken auf dieselben Organe, aber genau entgegengesetzt.", such: /Gegenspieler|entgegengesetzt/ },
    ],
    bild: (s) => <Gegenspieler s={s} />,
  },

  hormon: {
    titel: "So wirkt ein Hormon",
    schritte: [
      { text: "Eine Hormondrüse gibt ein Hormon direkt ins Blut ab. Hier: die Bauchspeicheldrüse gibt Insulin ab.", such: /Drüse|Bauchspeichel|ins Blut|Hypophyse|Schilddrüse|Nebenniere/ },
      { text: "Das Blut bringt das Hormon in den ganzen Körper. Hormone sind chemische Botenstoffe.", such: /Botenstoff|\bBlut\b/ },
      { text: "Nur Zellen mit dem passenden Empfänger reagieren: das Schlüssel-Schloss-Prinzip.", such: /Schlüssel|Schloss|Rezeptor|Empfänger|Zielorgan/ },
      { text: "Insulin öffnet die Zelle für Zucker: der Blutzucker sinkt. Hormone wirken langsamer als Nerven, aber länger.", such: /Insulin|Zucker|Diabetes|langsamer|länger/ },
    ],
    bild: (s) => (
      <>
        {/* Drüse */}
        <g transform="translate(46 34)">
          <path d="M-34 0 C -30 -18, 10 -20, 30 -8 C 42 0, 30 14, 10 12 C -10 10, -30 18, -34 0 Z" fill="#ffd8a8" stroke="#e8590c" strokeWidth={2} />
          <Schrift x={-36} y={32} fett={false} mitte={false}>
            Bauchspeicheldrüse
          </Schrift>
        </g>
        {/* Blutgefäß */}
        <rect x={0} y={70} width={320} height={36} className="bf-blut" />
        <Schrift x={300} y={64} fett={false} mitte={false} style={{ textAnchor: "end" }}>
          Blut
        </Schrift>
        {/* Hormone: aus der Drüse ins Blut, dann mit dem Blut nach rechts */}
        {[0, 1, 2, 3].map((i) => {
          const x = s === 0 ? 40 + i * 14 : s === 1 ? 90 + i * 55 : i === 1 ? 110 : 150 + i * 45;
          const y = s === 0 ? 80 + (i % 2) * 12 : s === 1 ? 82 + (i % 2) * 12 : i === 1 ? 132 : 88;
          return (
            <g key={i} style={L(x, y, true, { v: s === 0 ? 300 + i * 200 : 0 })} className="bf-hormon">
              <path d="M-8 -4 L8 -4 L0 4 Z" fill="#7048e8" />
            </g>
          );
        })}
        {/* Zielzellen */}
        <g transform="translate(110 150)" className="bf-zielzelle" data-an={s >= 3 ? "" : undefined}>
          <rect x={-40} y={-22} width={80} height={44} rx={16} />
          <path d="M-8 -22 L0 -14 L8 -22" className="bf-schloss" />
          <Schrift x={0} y={16} fett={false}>
            passt
          </Schrift>
        </g>
        <g transform="translate(236 150)" className="bf-zielzelle" data-anders="">
          <rect x={-40} y={-22} width={80} height={44} rx={16} />
          <rect x={-7} y={-22} width={14} height={8} className="bf-schloss" />
          <Schrift x={0} y={16} fett={false}>
            passt nicht
          </Schrift>
        </g>
        {/* Zucker geht in die Zelle */}
        {[0, 1, 2].map((i) => (
          <g key={`z${i}`} style={L(s >= 3 ? 92 + i * 18 : 70 + i * 40, s >= 3 ? 144 : 96, s >= 1, { v: s === 3 ? 600 + i * 200 : 0 })}>
            <rect x={-4} y={-4} width={8} height={8} rx={1.5} fill="#fff" stroke="#adb5bd" />
          </g>
        ))}
        <g style={L(0, 0, s === 3, { v: 1400 })}>
          <Schrift x={250} y={30}>
            Blutzucker sinkt
          </Schrift>
        </g>
      </>
    ),
  },
};

/** Sympathikus und Parasympathikus: dieselben Organe, Gas oder Bremse. Im letzten Schritt wechseln die zwei hin und her. */
function Gegenspieler({ s }: { s: number }) {
  const [hin, setHin] = useState(true);
  useEffect(() => {
    if (s !== 3) return;
    const t = window.setInterval(() => setHin((h) => !h), 2200);
    return () => window.clearInterval(t);
  }, [s]);
  const modus = s === 1 || (s === 3 && hin) ? "gas" : s === 2 || s === 3 ? "ruhe" : "normal";
  const organe: [string, string, string][] = [
    ["Herz", "schneller", "langsamer"],
    ["Pupille", "weit", "eng"],
    ["Atmung", "schneller", "ruhig"],
    ["Verdauung", "gebremst", "angeregt"],
  ];
  return (
    <g className="bf-organe" data-modus={modus}>
      <g style={L(0, 0, s >= 1)}>
        <rect x={70} y={6} width={180} height={26} rx={13} className="bf-schild" />
        <text x={160} y={24} textAnchor="middle" className="bf-s bf-auf" fontWeight={800}>
          <tspan className="bf-gas">Sympathikus: Gas</tspan>
          <tspan className="bf-ruhe">Parasympathikus: Bremse</tspan>
        </text>
      </g>
      <g style={L(0, 0, s === 0)}>
        <Schrift x={160} y={24}>
          läuft von selbst
        </Schrift>
      </g>
      {/* Herz */}
      <g transform="translate(42 88)">
        <g className="bf-herz">
          <path d="M0 18 C -30 -2, -24 -26, -10 -26 C -4 -26, 0 -20, 0 -16 C 0 -20, 4 -26, 10 -26 C 24 -26, 30 -2, 0 18 Z" fill="#e03131" />
        </g>
      </g>
      {/* Auge */}
      <g transform="translate(122 84)">
        <ellipse rx={30} ry={18} fill="#fff" stroke="#495057" strokeWidth={2} />
        <circle r={13} fill="#4dabf7" />
        <circle r={6} fill="#111" className="bf-pupille" />
      </g>
      {/* Lunge */}
      <g transform="translate(200 86)">
        <g className="bf-lunge">
          <ellipse cx={-13} rx={12} ry={22} fill="#f783ac" />
          <ellipse cx={13} rx={12} ry={22} fill="#f783ac" />
          <rect x={-2} y={-34} width={4} height={18} fill="#c2255c" />
        </g>
      </g>
      {/* Verdauung */}
      <g transform="translate(278 86)">
        <path d="M-22 -14 C -10 -24, 10 -24, 20 -10 C 26 4, 14 20, -4 18 C -16 16, -22 6, -14 0" fill="none" stroke="#f08c00" strokeWidth={9} strokeLinecap="round" className="bf-darm" />
      </g>
      {organe.map(([n, gas, ruhe], i) => (
        <g key={n} transform={`translate(${42 + i * 79} 140)`}>
          <text textAnchor="middle" className="bf-s bf-klein" fontWeight={800}>
            {n}
          </text>
          <text y={18} textAnchor="middle" className="bf-s bf-klein">
            <tspan className="bf-gas">{gas}</tspan>
            <tspan className="bf-ruhe">{ruhe}</tspan>
          </text>
        </g>
      ))}
    </g>
  );
}

/** Ein Signal läuft den Nerv entlang (SMIL, läuft auch in Safari). */
function Signal({ pfad, motorisch }: { pfad: string; motorisch?: boolean }) {
  const ref = useRef<SVGElement & { beginElement?: () => void }>(null);
  useLayoutEffect(() => {
    try {
      ref.current?.beginElement?.();
    } catch {
      // ältere Browser: dann steht der Punkt am Anfang
    }
  }, []);
  return (
    <circle r={6} className="bf-signal" data-art={motorisch ? "motorisch" : undefined}>
      <animateMotion ref={ref} dur="1.4s" begin="indefinite" repeatCount="indefinite" path={pfad} />
    </circle>
  );
}
