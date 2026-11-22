/**
 * Blätter bestimmen (niko 2026-11-22): eine Schülerin bekommt im Biologie-Test Blätter als Bild und muss sagen, welche
 * Pflanze es ist und zu welcher Familie sie gehört. Gefragt wird nur der deutsche Name und der deutsche Familienname
 * (niko: „also nur deutschen namen und deutschen familiennamen“; die „Infos“ auf den Blättern werden nicht gefragt).
 *
 * Grundlage ist die Liste „Blättersammlung 2.D“ (15.09.2026) aus der Mappe der Schülerin; die Bilder sind die
 * gepressten Blätter ihrer eigenen Sammlung, freigestellt, ohne die handschriftlichen Namen
 * (public/spiele/blaetter/blatt-NN.webp, NN = Nummer in der Liste). Die Liste gilt, nicht die Handschrift auf den
 * Blättern (dort steht z. B. „excelior“ und „Bittereschengewäsche“).
 *
 * Gespielt wird in components/lernen/BlattSpiel.tsx. Je Blatt zwei Karten: erst der Name, dann die Familie. Kein KI.
 */
import type { SpielKarte } from "./lernspiele-typen";

export type Rng = () => number;

/** Die Fähigkeit für den Lernstand (keine Fähigkeit aus dem Lehrplan: zählt in keinem Lehrplan-Thema). */
export const BLATT_SKILL = "bio.blaetter";

/** Wie das Blatt aussieht: daraus kommen die falschen Antworten (ähnliche Blätter sind schwerer). */
export type Form = "gelappt" | "gefiedert" | "gesaegt" | "glatt";

export type Pflanze = {
  nr: number;
  name: string;
  familie: string;
  form: Form;
  /** woran man das Blatt erkennt: steht nach einem Fehler da */
  merkmal: string;
};

/** Die 26 Pflanzen der Liste, in ihrer Reihenfolge. */
export const PFLANZEN: Pflanze[] = [
  { nr: 1, name: "Berberitze", familie: "Berberitzengewächse", form: "glatt", merkmal: "Klein und ganzrandig, vorne rund, zum Stiel hin keilförmig schmal." },
  { nr: 2, name: "Berg-Ahorn", familie: "Seifenbaumgewächse", form: "gelappt", merkmal: "Fünf Lappen mit stumpfen, grob gesägten Spitzen, die Buchten sind spitz." },
  { nr: 3, name: "Buchsbaum", familie: "Buchsbaumgewächse", form: "glatt", merkmal: "Sehr klein und oval, ledrig und glänzend, immergrün." },
  { nr: 4, name: "Citrus", familie: "Rautengewächse", form: "glatt", merkmal: "Ledrig und glänzend, länglich-oval mit Spitze." },
  { nr: 5, name: "Efeu", familie: "Araliengewächse", form: "gelappt", merkmal: "Drei bis fünf eckige Lappen, dunkelgrün und ledrig, langer Stiel." },
  { nr: 6, name: "Eiche", familie: "Buchengewächse", form: "gelappt", merkmal: "Tief gebuchtet mit runden Lappen." },
  { nr: 7, name: "Esche", familie: "Ölbaumgewächse", form: "gefiedert", merkmal: "Gefiedert: viele schmale, gesägte Blättchen, die sich gegenüberstehen, eines an der Spitze." },
  { nr: 8, name: "Feld-Ahorn", familie: "Seifenbaumgewächse", form: "gelappt", merkmal: "Klein, drei bis fünf runde, stumpfe Lappen ohne Sägezähne." },
  { nr: 9, name: "Ginkgo", familie: "Ginkgogewächse", form: "gelappt", merkmal: "Fächerförmig, oft in der Mitte eingeschnitten." },
  { nr: 10, name: "Götterbaum", familie: "Bittereschengewächse", form: "gefiedert", merkmal: "Gefiedert, die Blättchen sind glatt und haben unten nur ein, zwei kleine Zähne." },
  { nr: 11, name: "Hainbuche", familie: "Birkengewächse", form: "gesaegt", merkmal: "Eiförmig und doppelt gesägt, viele gerade Seitennerven: wie gefaltet." },
  { nr: 12, name: "Haselnuss", familie: "Birkengewächse", form: "gesaegt", merkmal: "Groß und rundlich mit kurzer Spitze, doppelt gesägt, unten herzförmig." },
  { nr: 13, name: "Jungfernrebe", familie: "Weinrebengewächse", form: "gefiedert", merkmal: "Fünf Blättchen wie eine Hand (gefingert), im Herbst rot." },
  { nr: 14, name: "Liguster", familie: "Ölbaumgewächse", form: "glatt", merkmal: "Klein, schmal-oval, ganzrandig und glatt." },
  { nr: 15, name: "Linde", familie: "Malvengewächse", form: "gesaegt", merkmal: "Herzförmig und etwas schief, fein gesägt, mit Spitze." },
  { nr: 16, name: "Mahonie", familie: "Berberitzengewächse", form: "glatt", merkmal: "Ledrig und glänzend, der Rand hat stachelige Zähne." },
  { nr: 17, name: "Robinie", familie: "Hülsenfrüchtler", form: "gefiedert", merkmal: "Gefiedert mit vielen kleinen, ovalen, ganzrandigen Blättchen." },
  { nr: 18, name: "Rose", familie: "Rosengewächse", form: "gesaegt", merkmal: "Kleines ovales Blättchen, scharf und fein gesägt." },
  { nr: 19, name: "Rot-Buche", familie: "Buchengewächse", form: "gesaegt", merkmal: "Eiförmig, der Rand ist gewellt und fast glatt." },
  { nr: 20, name: "Schneebeere", familie: "Geißblattgewächse", form: "glatt", merkmal: "Klein und rundlich, ganzrandig, kurzer Stiel." },
  { nr: 21, name: "Schwarz-Pappel", familie: "Weidengewächse", form: "gesaegt", merkmal: "Dreieckig mit langer Spitze, fein gekerbt, langer Stiel." },
  { nr: 22, name: "Spitz-Ahorn", familie: "Seifenbaumgewächse", form: "gelappt", merkmal: "Fünf Lappen mit langen, spitzen Zipfeln, die Buchten sind rund." },
  { nr: 23, name: "Ulme", familie: "Ulmengewächse", form: "gesaegt", merkmal: "Eiförmig, doppelt gesägt, unten deutlich schief." },
  { nr: 24, name: "Waldrebe", familie: "Hahnenfußgewächse", form: "glatt", merkmal: "Herzförmig-spitze Blättchen mit langem Stiel, eine Kletterpflanze." },
  { nr: 25, name: "Walnuss", familie: "Walnussgewächse", form: "glatt", merkmal: "Großes ovales Blättchen, ganzrandig, vorne mit Spitze." },
  { nr: 26, name: "Weide", familie: "Weidengewächse", form: "glatt", merkmal: "Lang und schmal, fein gesägt." },
];

/** „der Efeu“, „die Linde“, „Citrus“: für die Frage nach der Familie. */
export function mitArtikel(name: string): string {
  if (name === "Citrus") return name;
  const der = /(ahorn|baum)$/i.test(name) || ["Efeu", "Ginkgo", "Liguster"].includes(name);
  return `${der ? "der" : "die"} ${name}`;
}

export const pflanze = (nr: number): Pflanze | undefined => PFLANZEN.find((p) => p.nr === nr);
export const blattBild = (nr: number) => `/spiele/blaetter/blatt-${String(nr).padStart(2, "0")}.webp`;
/** Alle Familien, ohne doppelte, in der Reihenfolge der Liste. */
export const FAMILIEN: string[] = [...new Set(PFLANZEN.map((p) => p.familie))];

/** So viele Blätter hat eine Runde (beim großen Test alle). */
export const BLAETTER_JE_RUNDE = 8;
/** So viele Antworten stehen beim Üben zur Wahl. */
export const KACHELN = 4;
/** Ein Blatt ist „sicher“, wenn Name und Familie so oft hintereinander beim ersten Versuch stimmten. */
export const SICHER_NACH = 2;

export type BlattTeil = "name" | "familie";
export type BlattModus = "kacheln" | "schreiben";
/** Was die Karte zum Blatt mitbringt (SpielKarte.blatt). */
export type BlattDaten = { nr: number; teil: BlattTeil; bild: string; modus: BlattModus; name?: string };

export const blattKey = (nr: number, teil: BlattTeil) => `blatt:${nr}:${teil}`;
export function vonKey(key: string): { nr: number; teil: BlattTeil } | null {
  const m = /^blatt:(\d+):(name|familie)$/.exec(key);
  return m && pflanze(Number(m[1])) ? { nr: Number(m[1]), teil: m[2] as BlattTeil } : null;
}

function mische<T>(a: T[], rng: Rng): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * Die Antworten zur Wahl: die richtige und drei falsche, davon möglichst zwei von Blättern, die ähnlich aussehen (gleiche
 * Form), damit man wirklich hinschauen muss. Bei der Familie nie eine zweite richtige (drei Ahorne sind alle
 * Seifenbaumgewächse) und keine doppelte.
 */
export function antworten(p: Pflanze, teil: BlattTeil, rng: Rng, anzahl = KACHELN): string[] {
  const richtig = teil === "name" ? p.name : p.familie;
  const wert = (q: Pflanze) => (teil === "name" ? q.name : q.familie);
  const aehnlich = mische(
    PFLANZEN.filter((q) => q.form === p.form && wert(q) !== richtig),
    rng,
  ).map(wert);
  const andere = mische(
    PFLANZEN.filter((q) => q.form !== p.form && wert(q) !== richtig),
    rng,
  ).map(wert);
  const falsch: string[] = [];
  const nimm = (w: string) => {
    if (falsch.length < anzahl - 1 && w !== richtig && !falsch.includes(w)) falsch.push(w);
  };
  for (const w of aehnlich.slice(0, anzahl - 2)) nimm(w);
  for (const w of [...andere, ...aehnlich]) nimm(w);
  return mische([richtig, ...falsch], rng);
}

/** Zwei Karten je Blatt: erst der Name, dann die Familie. */
export function blattKarten(nrs: number[], modus: BlattModus, rng: Rng): SpielKarte[] {
  const karten: SpielKarte[] = [];
  for (const nr of nrs) {
    const p = pflanze(nr);
    if (!p) continue;
    for (const teil of ["name", "familie"] as const) {
      const richtig = teil === "name" ? p.name : p.familie;
      karten.push({
        key: blattKey(nr, teil),
        skill: BLATT_SKILL,
        vor: "",
        nach: "",
        faecher: modus === "kacheln" ? antworten(p, teil, rng) : [richtig],
        richtig,
        loesung: `${p.name} · ${p.familie}`,
        regel: p.merkmal,
        blatt: { nr, teil, bild: blattBild(nr), modus, name: teil === "familie" ? p.name : undefined },
      });
    }
  }
  return karten;
}

/** Was der Schüler über ein Blatt schon kann: wie oft gesehen, ob sicher, wann zuletzt (Nummer der Runde). */
export type BlattStand = { gesehen: number; sicher: boolean; zuletzt: number };

/**
 * Der Stand je Blatt aus den beendeten Runden (älteste zuerst). Ein Blatt zählt in einer Runde als gekonnt, wenn Name
 * und Familie beim ersten Versuch stimmten; sicher ist es nach `SICHER_NACH` gekonnten Runden hintereinander.
 */
export function blattStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Map<number, BlattStand> {
  const verlauf = new Map<number, { ergebnisse: boolean[]; zuletzt: number }>();
  runden.forEach((r, i) => {
    const je = new Map<number, boolean>();
    for (const a of r.antworten) {
      const k = vonKey(a.key);
      if (!k) continue;
      je.set(k.nr, (je.get(k.nr) ?? true) && a.richtig);
    }
    for (const [nr, ok] of je) {
      const v = verlauf.get(nr) ?? { ergebnisse: [], zuletzt: 0 };
      v.ergebnisse.push(ok);
      v.zuletzt = i + 1;
      verlauf.set(nr, v);
    }
  });
  const out = new Map<number, BlattStand>();
  for (const [nr, v] of verlauf) {
    const letzte = v.ergebnisse.slice(-SICHER_NACH);
    out.set(nr, { gesehen: v.ergebnisse.length, sicher: letzte.length === SICHER_NACH && letzte.every(Boolean), zuletzt: v.zuletzt });
  }
  return out;
}

/**
 * Welche Blätter in die nächste Runde kommen: zuerst die zuletzt falschen (`wiederholen`), dann die noch nicht sicheren
 * (die nie gesehenen und am längsten nicht gesehenen zuerst), dann die sicheren, die am längsten her sind.
 */
export function waehleBlaetter(stand: Map<number, BlattStand>, o: { anzahl: number; wiederholen?: number[]; rng: Rng }): number[] {
  const alle = mische(PFLANZEN.map((p) => p.nr), o.rng);
  const zuletzt = (nr: number) => stand.get(nr)?.zuletzt ?? 0;
  const offen = alle.filter((nr) => !stand.get(nr)?.sicher).sort((a, b) => zuletzt(a) - zuletzt(b));
  const sicher = alle.filter((nr) => stand.get(nr)?.sicher).sort((a, b) => zuletzt(a) - zuletzt(b));
  const out: number[] = [];
  for (const nr of [...(o.wiederholen ?? []), ...offen, ...sicher]) if (pflanze(nr) && !out.includes(nr) && out.length < o.anzahl) out.push(nr);
  return mische(out, o.rng);
}

// ---------- Schreiben wie im Test ----------

/** Für den Vergleich: klein, ohne Leerzeichen und Bindestriche, ß wie ss („Rot-Buche“ = „Rotbuche“). */
export const normal = (s: string) =>
  s
    .toLocaleLowerCase("de-AT")
    .replace(/ß/g, "ss")
    .replace(/[^a-zäöü]/g, "");

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Stimmt das Geschriebene? „richtig“: genau (Groß/klein, Leerzeichen, Bindestrich und ß/ss egal). „fast“: ein, bei
 * langen Wörtern zwei Buchstaben daneben („Olbaumgewächse“, „Seifenbaumgewäches“): zählt als gewusst, aber die
 * Schreibweise wird gezeigt. Sonst „falsch“. Eine andere Antwort aus der Liste ist nie „fast“ (Weide ≠ Linde).
 */
export function pruefeGeschrieben(eingabe: string, richtig: string, teil: BlattTeil): "richtig" | "fast" | "falsch" {
  const e = normal(eingabe);
  const r = normal(richtig);
  if (!e) return "falsch";
  if (e === r) return "richtig";
  const andere = (teil === "name" ? PFLANZEN.map((p) => p.name) : FAMILIEN).map(normal).filter((x) => x !== r);
  if (andere.includes(e)) return "falsch";
  const erlaubt = r.length >= 12 ? 2 : r.length >= 5 ? 1 : 0;
  const d = abstand(e, r);
  // näher an einer anderen Antwort als an der richtigen: falsch
  if (andere.some((x) => abstand(e, x) < d)) return "falsch";
  return d <= erlaubt ? "fast" : "falsch";
}
