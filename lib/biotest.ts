/**
 * „Bio Test 4.Klasse Vorbereitung De La Salle“ (niko 2026-11-23): die 16 Übungen einer Lehrkraft für den Biologie-Test
 * eines Schülers, als Lernspiel in der Schüler-App (components/lernen/BioTest.tsx, docs/lernspiele.md). Die Übungen
 * stehen in lib/biotest-inhalt.ts, im Wortlaut der Lehrkraft. Eine Runde ist eine Übung (oder nur ihre Fehler); jede
 * Lücke, jedes Feld und jeder Schritt ist eine Karte (`biotest:<übung>:<stelle>`), gezählt wird der erste Versuch.
 * „Sicher“: zweimal hintereinander beim ersten Versuch richtig. Bilder und Animationen gibt es außer den Grafiken der
 * Lehrkraft keine (niko 2026-11-23 beim Biolabor).
 *
 * Rein (ohne Datenbank), damit es auch im Browser läuft.
 */
import { normal } from "./biolabor";
import { BILDER, TEILE, UEBUNGEN, type Stelle, type Teil, type Uebung } from "./biotest-inhalt";
import type { SpielKarte } from "./lernspiele-typen";

export { BILDER, TEILE, UEBUNGEN };
export type { Stelle, Teil, Uebung };

export const BIOTEST_SKILL = "bio.test-4-dls";
export const BIOTEST_TITEL = "Bio Test 4.Klasse Vorbereitung De La Salle";
export const SICHER_NACH = 2;

export type BiotestModus = "ueben" | "test";

/** An jeder Karte: welche Übung, welche Stelle. */
export type BiotestDaten = { uebung: string; stelle: string };

export const uebung = (id: string): Uebung | undefined => UEBUNGEN.find((u) => u.id === id);
export const stelleVon = (u: Uebung, id: string): Stelle | undefined => u.stellen.find((s) => s.id === id);

/** Kartenschlüssel und Stand-Schlüssel („übung:stelle“). */
export const biotestKey = (u: string, s: string) => `biotest:${u}:${s}`;
export const stand = (u: string, s: string) => `${u}:${s}`;
export function vonKey(key: string): string | null {
  const m = /^biotest:([a-z]+):([a-z0-9]+)$/.exec(key);
  return m ? `${m[1]}:${m[2]}` : null;
}

export const istBild = (wert: string) => wert.startsWith("bild:");

/** Was man an dieser Stelle wählen kann: die eigene Auswahlliste, die zwei Spalten oder der Wortkasten der Übung (in der Tabelle nur Bilder für Bildfelder, nur Wörter für Wortfelder). */
export function optionenFuer(u: Uebung, s: Stelle): string[] {
  if (s.optionen) return s.optionen;
  if (u.art === "spalten") return [...u.spalten];
  if (u.art === "reihenfolge") return u.stellen.map((_, i) => String(i + 1));
  if (u.art === "tabelle") return u.bank.filter((b) => istBild(b) === istBild(s.richtig));
  if ("bank" in u && u.bank) return u.bank;
  return [];
}

/** Abkürzungen, nach deren Punkt kein Satz endet. */
const ABK = new Set(["ca", "bzw", "z", "B", "d", "h", "Mio", "S", "Kap"]);

/** Der Satz aus dem Lückentext, in dem diese Lücke steht, mit allen Lösungen eingesetzt. */
export function satzMit(u: Extract<Uebung, { art: "luecken" }>, id: string): string {
  const t = u.text;
  const pos = t.indexOf(`[[${id}]]`);
  if (pos < 0) return "";
  const endeBei = (i: number) => {
    if (t[i] === "\n") return true;
    if (t[i] !== ".") return false;
    if (i + 1 < t.length && !/\s/.test(t[i + 1])) return false;
    const wort = /([A-Za-zäöüÄÖÜß]+)$/.exec(t.slice(0, i))?.[1] ?? "";
    return !ABK.has(wort);
  };
  let a = pos;
  while (a > 0 && !endeBei(a - 1)) a--;
  let e = pos;
  while (e < t.length && !endeBei(e)) e++;
  const satz = t.slice(a, e < t.length && t[e] === "." ? e + 1 : e);
  return satz
    .replace(/\[\[([a-z0-9]+)\]\]/g, (_, x: string) => stelleVon(u, x)?.richtig ?? "…")
    .replace(/\s+/g, " ")
    .trim();
}

/** Was nach einem Fehler erscheint: der Satz der Lehrkraft mit der Lösung, sonst ein kurzer Merksatz. */
export function merkeFuer(u: Uebung, s: Stelle): string {
  if (s.merke) return s.merke;
  if (u.art === "luecken") return satzMit(u, s.id);
  if (u.art === "reihenfolge") return `Schritt ${s.richtig}: ${s.text}.`;
  if (u.art === "spalten") return `${s.text} gehört zum ${s.richtig}.`;
  if (u.art === "liste") return `${s.text}: ${s.richtig}`;
  return `${s.text}: ${s.richtig}`;
}

/** Wie die Lösung im Text heißt (Bilder mit ihrer Beschreibung). */
export const zeige = (wert: string) => (istBild(wert) ? (BILDER[wert]?.alt ?? "Bild") : wert);

/** Selbst geschrieben (Fachbegriffe 2): „richtig“, „fast“ (ein Buchstabe daneben, ab 5 Buchstaben) oder „falsch“. */
export function pruefeGeschrieben(eingabe: string, s: Stelle): "richtig" | "fast" | "falsch" {
  const e = normal(eingabe);
  if (!e) return "falsch";
  const gut = [s.richtig, ...(s.auch ?? [])].map(normal);
  if (gut.includes(e)) return "richtig";
  return gut.some((g) => g.length >= 5 && abstand(e, g) <= 1) ? "fast" : "falsch";
}

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Die Karten einer Runde: alle Stellen der Übung oder nur die in `nur` (ihre Fehler). */
export function biotestKarten(uebungId: string, nur?: string[]): SpielKarte[] {
  const u = uebung(uebungId);
  if (!u) return [];
  const auswahl = nur?.length ? u.stellen.filter((s) => nur.includes(s.id)) : u.stellen;
  return auswahl.map((s) => ({
    key: biotestKey(u.id, s.id),
    vor: "",
    nach: "",
    faecher: optionenFuer(u, s),
    richtig: s.richtig,
    loesung: zeige(s.richtig),
    regel: merkeFuer(u, s),
    biotest: { uebung: u.id, stelle: s.id },
  }));
}

/** Was der Schüler an einer Stelle schon kann. */
export type StelleStand = { gesehen: number; sicher: boolean; zuletztFalsch: boolean };

/** Der Stand je Stelle („übung:stelle“) aus den beendeten Runden, älteste zuerst. */
export function biotestStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Map<string, StelleStand> {
  const verlauf = new Map<string, boolean[]>();
  for (const r of runden)
    for (const a of r.antworten) {
      const id = vonKey(a.key);
      if (!id) continue;
      verlauf.set(id, [...(verlauf.get(id) ?? []), a.richtig]);
    }
  const out = new Map<string, StelleStand>();
  for (const [id, v] of verlauf) {
    const letzte = v.slice(-SICHER_NACH);
    out.set(id, { gesehen: v.length, sicher: letzte.length === SICHER_NACH && letzte.every(Boolean), zuletztFalsch: !v[v.length - 1] });
  }
  return out;
}

/** Je Übung: wie viele Stellen sicher sind, wie viele zuletzt falsch, wie viele es gibt. */
export function uebungenStand(sicher: Set<string>, falsch: Set<string>) {
  return UEBUNGEN.map((u) => ({
    id: u.id,
    sicher: u.stellen.filter((s) => sicher.has(stand(u.id, s.id))).length,
    falsch: u.stellen.filter((s) => falsch.has(stand(u.id, s.id))).map((s) => s.id),
    alle: u.stellen.length,
  }));
}
