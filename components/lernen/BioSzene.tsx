"use client";

import { Scissors } from "lucide-react";
import type { CSSProperties } from "react";
import type { Szene } from "@/lib/biolabor";

/**
 * Die kleine Animation über der Frage im Biolabor (components/lernen/BioLabor.tsx), je Thema eine. Die Bilder sind mit
 * Higgsfield gemacht (public/spiele/biolabor/), die Bewegung ist CSS (biolabor.css „Szenen“), ohne Video: läuft
 * flüssig am Handy und steht still bei „weniger Bewegung“.
 *
 * `takt`: nur beim Herz: schnell (Sympathikus), langsam (Parasympathikus) oder normal.
 */
export function BioSzene({ szene, takt = "normal", klein }: { szene: Szene; takt?: "schnell" | "langsam" | "normal"; klein?: boolean }) {
  return (
    <div className="bs" data-szene={szene} data-klein={klein ? "" : undefined} aria-hidden>
      {szene === "dna" && <Helix />}
      {szene === "erbse" && (
        <>
          <Bild name="erbse" className="bs-wiegen" />
          {[0, 1, 2].map((i) => (
            <i key={i} className="bs-erbse" style={{ "--i": i } as CSSProperties} />
          ))}
        </>
      )}
      {szene === "teilung" && (
        <span className="bs-teilung">
          <Bild name="teilung" className="bs-links" />
          <Bild name="teilung" className="bs-rechts" />
        </span>
      )}
      {szene === "neuron" && (
        <span className="bs-neuron">
          <Bild name="neuron" />
          <i className="bs-funke" />
          <i className="bs-funke" style={{ "--i": 1 } as CSSProperties} />
        </span>
      )}
      {szene === "gehirn" && (
        <span className="bs-gehirn">
          <Bild name="gehirn" />
          {[0, 1, 2].map((i) => (
            <i key={i} className="bs-blitz" style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      )}
      {szene === "herz" && (
        <span className="bs-herz" data-takt={takt}>
          <Bild name="herz" className="bs-schlag" />
          <svg className="bs-ekg" viewBox="0 0 200 40" preserveAspectRatio="none">
            <path d="M0 22 H60 L70 22 L76 6 L84 36 L90 22 H120 L128 18 L134 22 H200" pathLength={100} />
          </svg>
        </span>
      )}
      {szene === "hormon" && (
        <span className="bs-hormon">
          <Bild name="hormon" />
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className="bs-blase" style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      )}
      {szene === "kreuzung" && <MiniKreuzung />}
      {szene === "xy" && <XY />}
      {szene === "gentechnik" && (
        <span className="bs-gentechnik">
          <Bild name="dna" />
          <Scissors className="bs-schere" size={34} strokeWidth={2.4} />
        </span>
      )}
    </div>
  );
}

function Bild({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/spiele/biolabor/${name}.webp`} alt="" className={`bs-bild ${className ?? ""}`} draggable={false} />;
}

/** Die DNA dreht sich: jede Sprosse schwingt mit einer kleinen Verspätung, so sieht es aus wie eine Schraube. */
const BASEN: [string, string][] = [
  ["A", "T"],
  ["G", "C"],
  ["T", "A"],
  ["C", "G"],
  ["A", "T"],
  ["G", "C"],
  ["C", "G"],
  ["T", "A"],
  ["G", "C"],
  ["A", "T"],
  ["T", "A"],
  ["C", "G"],
];
function Helix() {
  return (
    <span className="bs-helix">
      {BASEN.map(([a, b], i) => (
        <span key={i} className="bs-sprosse" style={{ "--i": i } as CSSProperties}>
          <i data-b={a} />
          <i data-b={b} />
        </span>
      ))}
    </span>
  );
}

/** Zwei Eltern, ihre Allele fallen in das Quadrat. */
function MiniKreuzung() {
  return (
    <span className="bs-kreuzung">
      <span className="bs-eltern">
        <b>♀ Rr</b>
        <i>×</i>
        <b>♂ Rr</b>
      </span>
      <span className="bs-quadrat">
        {["RR", "Rr", "Rr", "rr"].map((g, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} data-rezessiv={g === "rr" ? "" : undefined}>
            {g}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Geschlecht und Blutgruppen: X und Y tanzen, im Tropfen wechseln A, B, AB und 0. */
function XY() {
  return (
    <span className="bs-xy">
      <span className="bs-chromo" data-x="">
        X
      </span>
      <span className="bs-chromo" data-y="">
        Y
      </span>
      <span className="bs-tropfen">
        {["A", "B", "AB", "0"].map((g, i) => (
          <b key={g} style={{ "--i": i } as CSSProperties}>
            {g}
          </b>
        ))}
      </span>
    </span>
  );
}
