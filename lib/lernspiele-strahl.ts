/**
 * Mathe-Lernspiel „Zahlenstrahl“ (niko 2026-11-11: „für Mathe … was Spaß machen könnte“; „überleg dir noch ein paar
 * Spiele“): oben steht eine Zahl, darunter ein Zahlenstrahl. Der Schüler schiebt den Zeiger auf den Teilstrich, an dem
 * die Zahl liegt, und prüft. Das Spielfeld ist components/lernen/StrahlFeld.tsx (`form: "strahl"`).
 *
 * - **Themenspiel** wie „Kopfrechnen“: je Runde ein Thema (eine Fähigkeit), aus dem Stoff oder das nächste der
 *   Schulstufe (`themenPlan` in lib/lernspiele.ts). Von den Zahlen bis 20 über große Zahlen, Dezimalzahlen und Brüche
 *   bis zu negativen Zahlen.
 * - **Zahlenstrahlen**: dieselben wie in den Aufgaben mit Bild (lib/generators-figur.ts `strahlFuerSpiel`), ohne KI.
 *   Dort liest man eine markierte Zahl ab, hier ist es umgekehrt. Gefragt wird nur nach Teilstrichen ohne Zahl.
 * - **Stufe** = die des Strahls (0 bis 3): feinere Einteilung, weniger Zahlen am Strahl. In der Volksschule sind es die
 *   Zahlenräume (bis 20, bis 100, Zehner, Hunderter), `stufenFuer` nimmt sie nach der Klasse.
 * - Nach einem Fehler steht da, welche Zahl getroffen wurde, bei typischen falschen Stellen auch warum („Vorzeichen
 *   verwechselt“), und der Weg: was ein Teilstück wert ist und wie weit es von der nächsten Zahl ist.
 *
 * Nur Reines (keine Datenbank).
 */
import { strahlFuerSpiel } from "./generators-figur";
import type { Stufe } from "./banken-regeln";
import type { Kandidat } from "./lernspiele-karten";
import { festerZufall, zahlAus, type SpielKarte, type SpielThema } from "./lernspiele-typen";

/** Die Themen von „Zahlenstrahl“ in der Reihenfolge des Unterrichts. */
export const STRAHL_THEMEN: SpielThema[] = [
  { skill: "mathe.vs.zahlen.zahlenstrahl", name: "Zahlen am Zahlenstrahl", ab: 1, bis: 4 },
  { skill: "mathe.zahlen.gross", name: "Große Zahlen", ab: 5, bis: 6 },
  { skill: "mathe.dezimal.vergleichen", name: "Dezimalzahlen", ab: 5, bis: 7 },
  { skill: "mathe.brueche.anteile", name: "Brüche", ab: 5, bis: 7 },
  { skill: "mathe.brueche.vergleichen", name: "Brüche erweitern", ab: 6, bis: 8 },
  { skill: "mathe.brueche.gemischt", name: "Gemischte Zahlen", ab: 6, bis: 8 },
  { skill: "mathe.negativ.zahlengerade", name: "Negative Zahlen", ab: 7 },
  { skill: "mathe.negativ.rational", name: "Negative Brüche und Dezimalzahlen", ab: 7 },
];

export const istStrahlThema = (skill: string) => STRAHL_THEMEN.some((t) => t.skill === skill);

/** So viele verschiedene Zahlenstrahlen je Stufe (wo der Zufall mitspielt; feste Strahlen gibt es je Stufe einen). */
const STRAHLEN_JE_STUFE = 6;
const VERSUCHE = 40;

export type StrahlWahl = { werte: string[]; beschriftet: number[]; beide: boolean; bei: number; weg: string; kurz: string; daneben: { bei: number; label: string }[] };

/** Eine Karte: die Zahl, der Strahl und die Nummer des richtigen Teilstrichs. */
export function strahlKarte(skill: string, w: StrahlWahl): SpielKarte {
  const zahl = w.werte[w.bei];
  return {
    key: `st:${skill}:${w.werte[0]}:${w.werte[w.werte.length - 1]}:${w.werte.length - 1}:${w.beschriftet.join(".")}:${w.bei}`,
    form: "strahl",
    skill,
    wort: zahl,
    vor: "",
    nach: "",
    faecher: [],
    richtig: String(w.bei),
    kurz: zahl,
    loesung: w.kurz,
    regel: w.weg,
    mathe: true,
    strahl: { werte: w.werte, beschriftet: w.beschriftet, ...(w.beide ? { beide: true as const } : {}) },
    ...(w.daneben.length ? { tipps: Object.fromEntries(w.daneben.map((d) => [String(d.bei), d.label])) } : {}),
  };
}

const cache = new Map<string, Kandidat[]>();

/**
 * Alle Karten eines Themas (einmal gebaut, dann aus dem Speicher; fester Zufall, damit Fehler aus früheren Runden
 * wiederkommen können). `gruppe` ist die Zahl: in einer Runde wird nach keiner Zahl zweimal gefragt.
 */
export function strahlKandidaten(skill: string): Kandidat[] {
  const c = cache.get(skill);
  if (c) return c;
  const out = new Map<string, Kandidat>();
  for (const lv of [0, 1, 2, 3] as Stufe[]) {
    const rng = festerZufall(20261113 + (zahlAus(skill) % 1000) + lv * 7919);
    const strahlen = new Set<string>();
    for (let v = 0; v < VERSUCHE && strahlen.size < STRAHLEN_JE_STUFE; v++) {
      const s = strahlFuerSpiel(skill, lv, rng);
      if (!s) break;
      const sig = `${s.werte.join("|")}#${s.beschriftet.join(".")}`;
      if (strahlen.has(sig)) continue;
      strahlen.add(sig);
      for (const st of s.stellen) {
        const karte = strahlKarte(skill, { werte: s.werte, beschriftet: s.beschriftet, beide: s.beide, ...st });
        if (!out.has(karte.key)) out.set(karte.key, { karte, stufe: lv, gruppe: `${skill}|${karte.wort}` });
      }
    }
  }
  const liste = [...out.values()];
  cache.set(skill, liste);
  return liste;
}
