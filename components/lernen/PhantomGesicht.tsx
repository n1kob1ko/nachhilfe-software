"use client";

import React, { useId } from "react";
import { istAlt, istKind, istWeiblich, type Bau, type Merkmal } from "@/lib/phantombild";

/**
 * Das Phantombild (lib/phantombild.ts): eine Person als Zeichnung, aus Teilen zusammengesetzt. Was noch nicht gewählt
 * ist, bleibt grau oder fehlt. Ohne Bilddateien (niko 2026-11-19: Higgsfield-Credits sparen): jede Kombination passt,
 * hell und dunkel gleich. `ausschnitt` zeigt nur den Teil, um den es geht (die kleinen Bilder auf den Antworten).
 *
 * Der Oberkörper reicht bis zur Hüfte, mit Armen (niko 2026-11-19: „man erkennt oft nicht genau ob es zb muskulös
 * oder schlank ist“): zierlich schmal und dünne Arme, schlank gerade, kräftig breit mit Bauch, muskulös breite
 * Schultern, schmale Taille (V-Form) und dicke Oberarme. `kopf` ist der alte Ausschnitt bis zu den Schultern.
 */

/** Unterkante der Zeichnung. */
const UNTEN = 336;
/** Bund der Hose: darüber das Oberteil. */
const BUND = 304;
/** Halbe Breite an Schulter, Taille, Hüfte und die halbe Armdicke je Körperbau. */
const KOERPER: Record<string, { s: number; t: number; h: number; a: number }> = {
  zierlich: { s: 38, t: 27, h: 31, a: 5.5 },
  schlank: { s: 54, t: 41, h: 43, a: 9 },
  kraeftig: { s: 72, t: 72, h: 66, a: 13 },
  muskuloes: { s: 82, t: 44, h: 48, a: 15 },
  offen: { s: 58, t: 48, h: 48, a: 10.5 },
};

const HAUT: Record<string, { f: string; s: string; lippe: string; punkte: string }> = {
  blass: { f: "#fbe9e1", s: "#e9c6b8", lippe: "#d98a8e", punkte: "#c58c6a" },
  hell: { f: "#f3cba9", s: "#dba47e", lippe: "#c56565", punkte: "#b8774a" },
  gebraeunt: { f: "#cf9163", s: "#b07446", lippe: "#a24e48", punkte: "#80502c" },
  dunkel: { f: "#7f5134", s: "#633c22", lippe: "#68332e", punkte: "#45271a" },
  offen: { f: "#e6ddd3", s: "#cdbfb1", lippe: "#b9a89a", punkte: "#a7998b" },
};
export const HAAR: Record<string, { f: string; s: string }> = {
  schwarz: { f: "#2b2420", s: "#14100e" },
  braun: { f: "#6e4527", s: "#4d2f19" },
  blond: { f: "#e4c36c", s: "#c49f45" },
  rot: { f: "#c8562d", s: "#9c3d1c" },
  grau: { f: "#bdbdbd", s: "#919191" },
  offen: { f: "#c9c2b8", s: "#aaa298" },
};
export const KLEID: Record<string, { f: string; s: string }> = {
  rot: { f: "#e5484d", s: "#b9343a" },
  blau: { f: "#3b82f6", s: "#2563c9" },
  gruen: { f: "#22a06b", s: "#177a51" },
  gelb: { f: "#f5c518", s: "#cf9f05" },
  schwarz: { f: "#2e3036", s: "#141518" },
  weiss: { f: "#f6f6f3", s: "#c9c9c4" },
  grau: { f: "#9aa0a6", s: "#727880" },
  offen: { f: "#d7d2cb", s: "#b8b1a8" },
};
export const AUGE: Record<string, string> = { blau: "#3d8fd6", gruen: "#36a466", braun: "#7a4a26", grau: "#8996a3", offen: "#9d968e" };

const AUSSCHNITT: Partial<Record<Merkmal, string>> & { ganz: string; kopf: string } = {
  ganz: "-20 0 240 336",
  kopf: "0 0 200 240",
  koerperbau: "-22 176 244 160",
  haut: "38 50 124 130",
  gesicht: "30 22 140 168",
  augen: "66 86 68 36",
  nase: "74 98 52 46",
  mund: "72 122 56 42",
  frisur: "14 8 172 200",
  haarfarbe: "14 8 172 200",
  bart: "44 100 112 100",
  oberteil: "-22 176 244 136",
  farbe: "-22 176 244 136",
  brille: "50 78 100 56",
  schmuck: "20 64 160 168",
  besonderes: "46 76 108 84",
};

/** Die Kopfform als Pfad (Mitte x = 100). */
function kopfPfad(form: string | undefined, kind: boolean): string {
  const k = kind ? 4 : 0;
  switch (form) {
    case "rund":
      return `M100,${44 + k} C130,${44 + k} 151,66 151,104 C151,142 129,${166 - k} 100,${166 - k} C71,${166 - k} 49,142 49,104 C49,66 70,${44 + k} 100,${44 + k} Z`;
    case "eckig":
      return `M100,${40 + k} C131,${40 + k} 147,58 147,94 L147,138 C147,157 128,${170 - k} 100,${170 - k} C72,${170 - k} 53,157 53,138 L53,94 C53,58 69,${40 + k} 100,${40 + k} Z`;
    case "schmal":
      return `M100,${40 + k} C124,${40 + k} 140,62 140,100 C140,142 120,${176 - k} 100,${176 - k} C80,${176 - k} 60,142 60,100 C60,62 76,${40 + k} 100,${40 + k} Z`;
    default:
      return `M100,${40 + k} C128,${40 + k} 146,62 146,100 C146,140 124,${172 - k} 100,${172 - k} C76,${172 - k} 54,140 54,100 C54,62 72,${40 + k} 100,${40 + k} Z`;
  }
}
const halbeBreite = (form: string | undefined) => (form === "rund" ? 51 : form === "schmal" ? 40 : form === "eckig" ? 47 : 46);

export function PhantomGesicht({ bau, ausschnitt, className, titel }: { bau: Bau; ausschnitt?: Merkmal | "ganz" | "kopf"; className?: string; titel?: string }) {
  const id = useId().replace(/:/g, "");
  const person = bau.person;
  const offen = !person;
  const kind = !!person && istKind(person);
  const alt = !!person && istAlt(person);
  const weiblich = !!person && istWeiblich(person);
  const haut = HAUT[bau.haut ?? "offen"] ?? HAUT.offen;
  const hw = halbeBreite(bau.gesicht);
  const kopf = kopfPfad(bau.gesicht, kind);
  const kb = bau.koerperbau;
  const koerper = KOERPER[kb ?? "offen"] ?? KOERPER.offen;
  const hals = kb === "muskuloes" ? 22 : kb === "kraeftig" ? 20 : kb === "zierlich" ? 12 : 15;
  const kleid = KLEID[bau.farbe ?? "offen"] ?? KLEID.offen;
  const haarFarbe = bau.haarfarbe && bau.haarfarbe !== "keine" ? HAAR[bau.haarfarbe] : HAAR.offen;
  const brauenFarbe = bau.haarfarbe && HAAR[bau.haarfarbe] ? HAAR[bau.haarfarbe].s : alt ? "#8d8d8d" : "#4a3628";
  const augeY = kind ? 108 : 104;
  const augeR = kind ? 1.18 : 1;
  const vb = AUSSCHNITT[ausschnitt ?? "ganz"] ?? AUSSCHNITT.ganz;

  return (
    <svg viewBox={vb} className={className} role={titel ? "img" : undefined} aria-label={titel} aria-hidden={titel ? undefined : true} data-testid={ausschnitt ? undefined : "pb-gesicht"}>
      <defs>
        <clipPath id={`${id}k`}>
          <path d={kopf} transform="translate(100 112) scale(1.06) translate(-100 -112)" />
        </clipPath>
        <clipPath id={`${id}b`}>
          <rect x="-30" y="0" width="260" height={UNTEN} />
        </clipPath>
        <clipPath id={`${id}o`}>
          <rect x="-30" y="0" width="260" height={BUND} />
        </clipPath>
        {/* Kleidung nur am Körper, dazu der Kragen und die Kapuze um den Hals */}
        <clipPath id={`${id}r`}>
          <path d={rumpfPfad(koerper, hals)} />
          <rect x={100 - hals - 26} y="160" width={2 * (hals + 26)} height="44" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}b)`}>
        {/* Haare hinten (lang, Locken, Pferdeschwanz) */}
        {!offen && <HaareHinten frisur={bau.frisur} f={haarFarbe} />}

        {/* Oberkörper bis zur Hüfte: Hose unten, Oberteil darüber, dann die Arme */}
        <path d={rumpfPfad(koerper, hals)} fill="#3d4a61" />
        <path d={`M${100 - koerper.h + 3},${BUND + 2} L${100 + koerper.h - 3},${BUND + 2}`} stroke="#2b3547" strokeWidth="4" />
        <path d={`M100,${BUND + 8} L100,${UNTEN}`} stroke="#2b3547" strokeWidth="1.6" />
        <g clipPath={`url(#${id}o)`}>
          <path d={rumpfPfad(koerper, hals)} fill={kleid.f} stroke={kleid.s} strokeWidth="1.6" />
          {/* Hals */}
          <path d={`M${100 - hals},140 L${100 - hals},192 Q100,${204} ${100 + hals},192 L${100 + hals},140 Z`} fill={haut.s} />
          {kb === "muskuloes" && (
            <g fill="none" stroke={kleid.s} strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
              <path d="M52,224 Q72,246 97,236 M148,224 Q128,246 103,236" />
              <path d="M100,240 L100,262 M88,254 L112,254 M89,270 L111,270" opacity="0.6" />
              <path d="M58,212 Q78,262 90,298 M142,212 Q122,262 110,298" opacity="0.5" />
            </g>
          )}
          {kb === "kraeftig" && <path d="M54,278 Q100,312 146,278" fill="none" stroke={kleid.s} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />}
          <g clipPath={`url(#${id}r)`}>
            <Kleidung art={bau.oberteil} k={kleid} haut={haut.f} hals={hals} taille={koerper.t} />
          </g>
        </g>
        {[-1, 1].map((seite) => (
          <Arm key={seite} seite={seite} m={koerper} kurz={bau.oberteil === "tshirt"} k={kleid} haut={haut} muskel={kb === "muskuloes"} manschette={bau.oberteil === "pullover" || bau.oberteil === "kapuze"} />
        ))}
        {bau.schmuck === "kette" && (
          <g>
            <path d={`M${100 - hals + 2},186 Q100,206 ${100 + hals - 2},186`} fill="none" stroke="#c3cad1" strokeWidth="2.4" />
            <circle cx="100" cy="201" r="3.6" fill="#dfe4e8" stroke="#9aa3ab" strokeWidth="1" />
          </g>
        )}

        {/* Ohren */}
        {[-1, 1].map((s) => (
          <g key={s}>
            <ellipse cx={100 + s * (hw - 1)} cy={augeY + 6} rx="8.5" ry="13" fill={haut.f} />
            <ellipse cx={100 + s * (hw - 1)} cy={augeY + 6} rx="4" ry="7.5" fill={haut.s} opacity="0.55" />
          </g>
        ))}
        {bau.schmuck === "ohrringe" &&
          [-1, 1].map((s) => <circle key={s} cx={100 + s * (hw - 1)} cy={augeY + 22} r="4.2" fill="none" stroke="#d5a419" strokeWidth="2.4" />)}

        {/* Kopf */}
        <path d={kopf} fill={haut.f} />
        {offen && (
          <text x="100" y="122" textAnchor="middle" fontSize="54" fontWeight="700" fill={haut.s}>
            ?
          </text>
        )}

        {!offen && (
          <>
            {kind && [-1, 1].map((s) => <circle key={s} cx={100 + s * 28} cy={augeY + 22} r="9" fill="#f08a8a" opacity="0.28" />)}
            {alt && (
              <g fill="none" stroke={haut.s} strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
                <path d="M82,68 Q100,63 118,68" />
                <path d="M86,75 Q100,71 114,75" />
                <path d={`M${100 - 30},${augeY + 2} l-5,-3 M${100 - 30},${augeY + 5} l-5,2 M${100 + 30},${augeY + 2} l5,-3 M${100 + 30},${augeY + 5} l5,2`} />
                <path d="M86,130 Q82,140 86,148 M114,130 Q118,140 114,148" />
              </g>
            )}

            {/* Sommersprossen, Narbe, Muttermal */}
            {bau.besonderes === "sommersprossen" && (
              <g fill={haut.punkte} opacity="0.75">
                {[
                  [74, 122], [80, 126], [70, 128], [78, 118], [84, 130], [126, 122], [120, 126], [130, 128], [122, 118], [116, 130], [96, 118], [104, 119], [100, 115],
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y + (kind ? 2 : 0)} r="1.5" />
                ))}
              </g>
            )}
            {bau.besonderes === "narbe" && (
              <g stroke="#b14b4b" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
                <path d="M123,114 L131,134" />
                <path d="M122,120 l6,-2 M124,126 l6,-2 M126,132 l6,-2" strokeWidth="1.3" />
              </g>
            )}
            {bau.besonderes === "muttermal" && <circle cx="117" cy="141" r="2.4" fill="#3e2418" />}

            {/* Bart (hinter dem Mund) */}
            <Bart art={bau.bart} f={haarFarbe} clip={`url(#${id}k)`} />

            {/* Augen */}
            {[-1, 1].map((s) => {
              const x = 100 + s * 19;
              return (
                <g key={s}>
                  <ellipse cx={x} cy={augeY} rx={9.5 * augeR} ry={6.4 * augeR} fill="#fff" />
                  <circle cx={x} cy={augeY + 0.4} r={4.7 * augeR} fill={AUGE[bau.augen ?? "offen"] ?? AUGE.offen} />
                  <circle cx={x} cy={augeY + 0.4} r={2.2 * augeR} fill="#151515" />
                  <circle cx={x + 1.6} cy={augeY - 1.3} r={1.3 * augeR} fill="#fff" />
                  <path d={`M${x - 9.8 * augeR},${augeY} Q${x},${augeY - 9.5 * augeR} ${x + 9.8 * augeR},${augeY}`} fill="none" stroke="#3a2a22" strokeWidth="1.8" strokeLinecap="round" />
                  {weiblich && <path d={`M${x + s * 9.4 * augeR},${augeY - 1} l${s * 3.4},-3.2`} stroke="#3a2a22" strokeWidth="1.6" strokeLinecap="round" />}
                  {alt && <path d={`M${x - 6},${augeY + 8.5} Q${x},${augeY + 11} ${x + 6},${augeY + 8.5}`} fill="none" stroke={haut.s} strokeWidth="1.3" />}
                </g>
              );
            })}

            {/* Augenbrauen */}
            {[-1, 1].map((s) => {
              const x = 100 + s * 19;
              const y = augeY - 14;
              return (
                <path key={s} d={`M${x - s * 11},${y + 3} Q${x},${y - 4.5} ${x + s * 11},${y + 2}`} fill="none" stroke={brauenFarbe} strokeWidth={3.4} strokeLinecap="round" />
              );
            })}

            {/* Nase */}
            <Nase art={bau.nase} s={haut.s} kind={kind} />
            {bau.schmuck === "piercing" && <circle cx="106.5" cy="131" r="3" fill="none" stroke="#c3cad1" strokeWidth="1.9" />}

            {/* Mund */}
            <Mund art={bau.mund} lippe={haut.lippe} />

            {/* Haare vorne */}
            <HaareVorne frisur={bau.frisur} f={haarFarbe} />

            {/* Brille */}
            {bau.brille === "rund" && (
              <g fill="none" stroke="#25272b" strokeWidth="2.8">
                <circle cx="81" cy={augeY} r="13" fill="#ffffff" fillOpacity="0.12" />
                <circle cx="119" cy={augeY} r="13" fill="#ffffff" fillOpacity="0.12" />
                <path d={`M94,${augeY - 2} Q100,${augeY - 6} 106,${augeY - 2}`} />
                <path d={`M68,${augeY - 2} L${100 - hw + 2},${augeY - 4} M132,${augeY - 2} L${100 + hw - 2},${augeY - 4}`} />
              </g>
            )}
            {bau.brille === "eckig" && (
              <g fill="none" stroke="#25272b" strokeWidth="2.8">
                <rect x="66" y={augeY - 10} width="29" height="20" rx="4" fill="#ffffff" fillOpacity="0.12" />
                <rect x="105" y={augeY - 10} width="29" height="20" rx="4" fill="#ffffff" fillOpacity="0.12" />
                <path d={`M95,${augeY - 3} Q100,${augeY - 6} 105,${augeY - 3}`} />
                <path d={`M66,${augeY - 4} L${100 - hw + 2},${augeY - 5} M134,${augeY - 4} L${100 + hw - 2},${augeY - 5}`} />
              </g>
            )}
          </>
        )}
      </g>
    </svg>
  );
}

function Nase({ art, s, kind }: { art?: string; s: string; kind: boolean }) {
  const y = kind ? 2 : 0;
  const strich = { fill: "none", stroke: s, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (art === "spitz")
    return (
      <g {...strich}>
        <path d={`M99,${104 + y} L109,${129 + y} Q104,${133 + y} 97,${131 + y}`} />
        <path d={`M92,${130 + y} q2,2 5,1`} />
      </g>
    );
  if (art === "gross")
    return (
      <g {...strich}>
        <path d={`M97,${100 + y} Q96,${116 + y} 92,${126 + y}`} />
        <path d={`M92,${126 + y} Q88,${136 + y} 96,${136 + y} Q100,${139 + y} 104,${136 + y} Q112,${136 + y} 108,${126 + y}`} />
        <circle cx="100" cy={130 + y} r="6.5" fill={s} stroke="none" opacity="0.28" />
      </g>
    );
  if (art === "breit")
    return (
      <g {...strich}>
        <path d={`M98,${110 + y} Q97,${120 + y} 96,${124 + y}`} opacity="0.7" />
        <path d={`M88,${127 + y} Q85,${133 + y} 93,${133 + y} Q100,${137 + y} 107,${133 + y} Q115,${133 + y} 112,${127 + y}`} />
      </g>
    );
  if (art === "klein")
    return (
      <g {...strich}>
        <path d={`M96,${127 + y} Q100,${131 + y} 104,${127 + y}`} />
        <circle cx="100" cy={125 + y} r="2.6" fill={s} stroke="none" opacity="0.35" />
      </g>
    );
  return <path d={`M96,${128 + y} Q100,${131 + y} 104,${128 + y}`} {...strich} stroke="#c2b6aa" />;
}

function Mund({ art, lippe }: { art?: string; lippe: string }) {
  if (art === "klein")
    return (
      <g fill={lippe}>
        <path d="M93,146 Q96.5,143 100,144.5 Q103.5,143 107,146 Q100,148 93,146 Z" />
        <path d="M93,146 Q100,151.5 107,146 Q100,148 93,146 Z" opacity="0.85" />
      </g>
    );
  if (art === "breit")
    return (
      <g>
        <path d="M78,144 Q100,156 122,144" fill="none" stroke={lippe} strokeWidth="3" strokeLinecap="round" />
        <path d="M77,142 q-1,2 1,3.5 M123,142 q1,2 -1,3.5" fill="none" stroke={lippe} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    );
  if (art === "voll")
    return (
      <g fill={lippe}>
        <path d="M85,146 Q92,138.5 100,142 Q108,138.5 115,146 Q100,149 85,146 Z" />
        <path d="M85,146 Q100,159 115,146 Q100,149.5 85,146 Z" opacity="0.88" />
      </g>
    );
  if (art === "schmal") return <path d="M88,147 Q100,149.5 112,147" fill="none" stroke={lippe} strokeWidth="2.2" strokeLinecap="round" />;
  return <path d="M90,147 L110,147" fill="none" stroke="#c2b6aa" strokeWidth="2.4" strokeLinecap="round" />;
}

function Bart({ art, f, clip }: { art?: string; f: { f: string; s: string }; clip: string }) {
  const schnurr = <path d="M83,140 Q91,131 100,136 Q109,131 117,140 Q109,137.5 100,140 Q91,137.5 83,140 Z" fill={f.f} stroke={f.s} strokeWidth="0.8" />;
  if (art === "schnurrbart") return schnurr;
  if (art === "vollbart")
    return (
      <g>
        <g clipPath={clip}>
          <path d="M44,112 C48,160 72,192 100,194 C128,192 152,160 156,112 C150,128 140,138 124,140 Q100,133 76,140 C60,138 50,128 44,112 Z M86,146 Q100,160 114,146 Q100,150 86,146 Z" fill={f.f} fillRule="evenodd" />
        </g>
        {schnurr}
      </g>
    );
  if (art === "dreitage")
    return (
      <g clipPath={clip} opacity="0.42">
        <path d="M44,116 C48,160 72,190 100,192 C128,190 152,160 156,116 C150,130 140,136 126,137 Q100,131 74,137 C60,136 50,130 44,116 Z" fill={f.f} />
        <path d="M84,139 Q100,133 116,139 L116,142 Q100,137 84,142 Z" fill={f.f} />
      </g>
    );
  return null;
}

/** Der Oberkörper als Umriss: Schulter, Taille (bei kräftig der Bauch), Hüfte. */
function rumpfPfad(m: { s: number; t: number; h: number }, hals: number): string {
  const { s, t, h } = m;
  const seite = (v: 1 | -1) => (x: number) => 100 + v * x;
  const l = seite(-1);
  const r = seite(1);
  return [
    `M${l(hals + 6)},188 C${l(s * 0.62)},189 ${l(s)},194 ${l(s)},214`,
    `C${l(s)},238 ${l(t)},250 ${l(t)},276 C${l(t)},294 ${l(h)},300 ${l(h)},${UNTEN}`,
    `L${r(h)},${UNTEN} C${r(h)},300 ${r(t)},294 ${r(t)},276 C${r(t)},250 ${r(s)},238 ${r(s)},214`,
    `C${r(s)},194 ${r(s * 0.62)},189 ${r(hals + 6)},188 Z`,
  ].join(" ");
}

/** Ein Arm, der seitlich herunterhängt: Ärmel (kurz beim T-Shirt), Hand, bei muskulös ein dicker Oberarm. */
function Arm({ seite, m, kurz, k, haut, muskel, manschette }: { seite: number; m: { s: number; t: number; a: number }; kurz: boolean; k: { f: string; s: string }; haut: { f: string; s: string }; muskel: boolean; manschette: boolean }) {
  const oben = 100 + seite * (m.s - m.a * 0.35);
  const unten = 100 + seite * Math.max(m.s - m.a * 0.35, m.t + m.a + 3);
  const y1 = 210;
  const y2 = 314;
  const bei = (y: number) => oben + ((unten - oben) * (y - y1)) / (y2 - y1);
  const aermelEnde = kurz ? 238 : y2 - 4;
  const linie = (von: number, bis: number, farbe: string, breite: number) => (
    <path d={`M${bei(von)},${von} L${bei(bis)},${bis}`} stroke={farbe} strokeWidth={breite} strokeLinecap="round" />
  );
  return (
    <g>
      {/* Haut (Unterarm) und Hand */}
      {linie(y1, y2, haut.s, m.a * 2 + 2.4)}
      {linie(y1, y2, haut.f, m.a * 2 - 0.4)}
      <circle cx={bei(y2) + seite * 0.5} cy={y2 + 6} r={m.a * 0.9 + 2.6} fill={haut.f} stroke={haut.s} strokeWidth="1.2" />
      {muskel && <ellipse cx={bei(250) + seite * 2} cy={250} rx={m.a + 5} ry={19} fill={kurz ? haut.f : k.f} stroke={kurz ? haut.s : k.s} strokeWidth="1.4" />}
      {/* Ärmel */}
      {linie(y1, aermelEnde, k.s, m.a * 2 + (kurz ? 6 : 3))}
      {linie(y1, aermelEnde, k.f, m.a * 2 + (kurz ? 3 : 0))}
      {muskel && !kurz && <ellipse cx={bei(250) + seite * 2} cy={250} rx={m.a + 4} ry={18} fill={k.f} />}
      {manschette && linie(aermelEnde - 7, aermelEnde, k.s, m.a * 2 + 1)}
    </g>
  );
}

function Kleidung({ art, k, haut, hals, taille }: { art?: string; k: { f: string; s: string }; haut: string; hals: number; taille: number }) {
  const links = 100 - hals;
  const rechts = 100 + hals;
  switch (art) {
    case "tshirt":
      return <path d={`M${links - 6},188 Q100,214 ${rechts + 6},188`} fill="none" stroke={k.s} strokeWidth="4" strokeLinecap="round" />;
    case "hemd":
      return (
        <g>
          <path d={`M${links - 4},186 L100,210 L${rechts + 4},186`} fill={haut} opacity="0" />
          <path d={`M${links - 6},184 L96,206 L${links + 2},214 Z M${rechts + 6},184 L104,206 L${rechts - 2},214 Z`} fill={k.f} stroke={k.s} strokeWidth="1.6" strokeLinejoin="round" />
          <path d={`M100,206 L100,${BUND}`} stroke={k.s} strokeWidth="1.6" />
          {[222, 246, 270, 294].map((y) => (
            <circle key={y} cx="100" cy={y} r="2" fill={k.s} />
          ))}
        </g>
      );
    case "pullover":
      return (
        <g>
          <path d={`M${links - 5},188 Q100,208 ${rechts + 5},188`} fill="none" stroke={k.s} strokeWidth="8" strokeLinecap="round" />
          <path d={`M${100 - taille - 20},${BUND - 4} L${100 + taille + 20},${BUND - 4}`} stroke={k.s} strokeWidth="7" />
          {[-12, -6, 0, 6, 12].map((x) => (
            <path key={x} d={`M${100 + x},${197 + Math.abs(x) * -0.25} l0,5`} stroke={k.f} strokeWidth="1.2" opacity="0.6" />
          ))}
        </g>
      );
    case "kapuze":
      return (
        <g>
          <path d={`M${links - 14},190 C${links - 18},176 ${links - 4},172 ${links},180 Q100,214 ${rechts},180 C${rechts + 4},172 ${rechts + 18},176 ${rechts + 14},190 Q100,226 ${links - 14},190 Z`} fill={k.s} />
          <path d={`M94,206 L92,228 M106,206 L108,228`} stroke="#f3f3f0" strokeWidth="2" strokeLinecap="round" />
          <circle cx="92" cy="229" r="2" fill="#f3f3f0" />
          <circle cx="108" cy="229" r="2" fill="#f3f3f0" />
          <path d={`M${100 - taille * 0.55},${BUND - 4} L${100 - taille * 0.42},268 L${100 + taille * 0.42},268 L${100 + taille * 0.55},${BUND - 4}`} fill="none" stroke={k.s} strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${100 - taille - 20},${BUND - 4} L${100 + taille + 20},${BUND - 4}`} stroke={k.s} strokeWidth="6" />
        </g>
      );
    case "jacke":
      return (
        <g>
          <path d={`M${links - 2},188 L94,${BUND} L106,${BUND} L${rechts + 2},188 Z`} fill="#eeeeea" />
          <path d={`M${links - 2},188 Q100,204 ${rechts + 2},188`} fill="none" stroke="#c8c8c2" strokeWidth="3" />
          <path d={`M${links - 8},186 L94,232 L${links - 20},236 Z M${rechts + 8},186 L106,232 L${rechts + 20},236 Z`} fill={k.s} opacity="0.55" />
          <path d={`M${links - 8},186 L94,${BUND} M${rechts + 8},186 L106,${BUND}`} stroke={k.s} strokeWidth="2" />
          {[250, 280].map((y) => (
            <circle key={y} cx={88} cy={y} r="2.2" fill={k.s} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function HaareHinten({ frisur, f }: { frisur?: string; f: { f: string; s: string } }) {
  if (frisur === "lang") return <path d="M50,98 C44,50 74,30 100,30 C126,30 156,50 150,98 L156,196 C142,204 126,202 118,192 L82,192 C74,202 58,204 44,196 Z" fill={f.s} />;
  if (frisur === "langlocken")
    return (
      <g fill={f.s}>
        <path d="M48,98 C42,48 74,28 100,28 C126,28 158,48 152,98 L160,190 L40,190 Z" />
        {[56, 66, 78, 122, 134, 144].map((x, i) => (
          <circle key={x} cx={x} cy={186 + (i % 2) * 8} r="13" />
        ))}
        {[44, 156].flatMap((x) => [120, 142, 164].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="12" />))}
      </g>
    );
  return null;
}

function HaareVorne({ frisur, f }: { frisur?: string; f: { f: string; s: string } }) {
  switch (frisur) {
    case "glatze":
      return <ellipse cx="88" cy="56" rx="14" ry="7" fill="#ffffff" opacity="0.32" transform="rotate(-18 88 56)" />;
    case "kurz":
      return (
        <g>
          <path d="M52,102 C48,58 72,32 100,32 C130,32 152,58 148,102 C143,82 134,68 118,62 C104,72 80,72 64,66 C57,74 54,88 52,102 Z" fill={f.f} />
          <path d="M118,62 C112,58 102,54 90,54" fill="none" stroke={f.s} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case "locken":
      return (
        <g fill={f.f}>
          <path d="M54,100 C50,60 72,36 100,36 C128,36 150,60 146,100 C140,84 128,74 100,72 C72,74 60,84 54,100 Z" />
          {[
            [56, 92], [58, 74], [68, 58], [82, 46], [100, 41], [118, 46], [132, 58], [142, 74], [144, 92], [74, 66], [92, 60], [110, 60], [126, 66],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i > 8 ? 9 : 11} stroke={f.s} strokeWidth="1" />
          ))}
        </g>
      );
    case "lang":
      return (
        <g>
          <path d="M53,112 C47,60 74,32 100,32 C126,32 153,60 147,112 C141,84 124,64 104,60 Q100,66 96,60 C76,64 59,84 53,112 Z" fill={f.f} />
          <path d="M100,34 L100,62" stroke={f.s} strokeWidth="1.6" opacity="0.6" />
        </g>
      );
    case "langlocken":
      return (
        <g fill={f.f}>
          <path d="M52,112 C46,60 74,30 100,30 C126,30 154,60 148,112 C142,84 124,64 104,60 Q100,66 96,60 C76,64 58,84 52,112 Z" />
          {[
            [56, 100], [58, 80], [68, 60], [84, 46], [116, 46], [132, 60], [142, 80], [144, 100],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="10" stroke={f.s} strokeWidth="1" />
          ))}
        </g>
      );
    default:
      return null;
  }
}
