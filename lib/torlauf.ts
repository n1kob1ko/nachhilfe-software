/**
 * Torlauf (niko 2026-11-17 auf der Karte „Welches Spiel als Nächstes?“: „Läufer mit Antwort-Toren“): ein Läufer rennt
 * von selbst auf drei Spuren, wird mit der Strecke immer schneller und weicht Kisten aus oder springt über Hürden.
 * Immer wieder kommt eine Reihe Tore, auf jedem steht eine Antwort; die Frage dazu steht schon oben, sobald das letzte Tor
 * vorbei ist. Wer durch das richtige Tor läuft, bekommt Punkte und Fieber, wer durch das falsche läuft oder gegen eine
 * Kiste, verliert ein Herz. Eigener Name, eigene Figur und eigener Look, kein Nachbau eines bekannten Spiels
 * (components/lernen/TorLauf.tsx, docs/lernspiele.md „Torlauf“).
 *
 * Hier steht nur die Spiellogik ohne React und ohne Datenbank (lib/torlauf.test.ts): Tempo, Abstände, die Reihen der
 * Hindernisse, Treffer und Punkte. Längen sind in Metern entlang der Strecke, Zeiten in Sekunden.
 */
import type { SpielKarte } from "./lernspiele-typen";

export const SPUREN = 3;
export const TOR_HERZEN = 3;
/** So viele richtige Antworten am Stück bringen ein verlorenes Herz zurück (Lernen rettet den Lauf). */
export const HERZ_ZURUECK_AB = 3;
/** Nach so vielen Toren beginnt eine neue Strecke (anderer Himmel, mehr Hindernisse). */
export const TORE_JE_STRECKE = 5;

/** So weit sieht man nach vorn (dort ist der Horizont). */
export const SICHT = 60;

// ---------- Tempo ----------

export const TEMPO_START = 9;
export const TEMPO_MAX = 19;

/** Das Tempo nach so vielen Metern: langsam schneller, bis TEMPO_MAX. */
export const tempo = (meter: number) => Math.min(TEMPO_MAX, TEMPO_START + Math.max(0, meter) / 230);

/** Die wievielte Strecke (ab 1) nach so vielen Toren. */
export const streckeNach = (tore: number) => 1 + Math.floor(Math.max(0, tore) / TORE_JE_STRECKE);

/** Mindestens so lange steht die Frage da, bevor die Tore kommen (s); später etwas kürzer. */
export const lesezeit = (strecke: number) => Math.max(4.5, 6.5 - (strecke - 1) * 0.5);

/** Vor und hinter einer Torreihe bleibt die Strecke frei (m). */
export const FREI_VOR_TOR = 18;
export const FREI_NACH_TOR = 14;

/**
 * Wo die nächste Torreihe steht: so weit vorn, dass die Frage `lesezeit` lang zu lesen ist, mindestens hinter allem,
 * was schon geplant ist (`front`), mit freiem Platz davor.
 */
export function torStelle(spieler: number, front: number, strecke: number): number {
  return Math.max(front + FREI_VOR_TOR, spieler + tempo(spieler) * lesezeit(strecke), spieler + SICHT + 4);
}

// ---------- Tore ----------

/**
 * Die Antworten auf den Toren: die richtige und höchstens zwei falsche (in der Reihenfolge der Karte). Die richtige
 * steht je nach Karte an einer anderen, aber festen Stelle. Leer, wenn die Karte keine Antworten zum Wählen hat
 * (Satzbau, Zahlenstrahl).
 */
export function torOptionen(karte: Pick<SpielKarte, "faecher" | "richtig" | "key">): string[] {
  const f = [...new Set(karte.faecher)];
  if (f.length < 2 || !f.includes(karte.richtig)) return [];
  const falsche = f.filter((x) => x !== karte.richtig).slice(0, SPUREN - 1);
  const n = falsche.length + 1;
  const stelle = [...karte.key].reduce((a, c) => a + c.charCodeAt(0), 0) % n;
  return [...falsche.slice(0, stelle), karte.richtig, ...falsche.slice(stelle)];
}

/** Auf welchen Spuren die Tore stehen: drei Antworten auf allen, zwei außen (in der Mitte steht dann eine Wand). */
export const torSpuren = (anzahl: number): number[] => (anzahl >= 3 ? [0, 1, 2] : [0, 2]);

/** Welche Antwort auf dieser Spur steht (−1: keine, dort ist die Wand). */
export function antwortAufSpur(anzahl: number, spur: number): number {
  return torSpuren(anzahl).indexOf(spur);
}

// ---------- Hindernisse ----------

/** Kiste: hoch, nur ausweichen. Hürde: niedrig, ausweichen oder darüber springen. Stern: einsammeln. */
export type DingArt = "kiste" | "huerde" | "stern";
export type Ding = { s: number; spur: number; art: DingArt };

/** Abstand zwischen zwei Reihen Hindernisse (m); auf späteren Strecken dichter. */
export const reihenAbstand = (strecke: number, rng: () => number) => Math.max(9, 15 - strecke) + rng() * 5;

/**
 * Eine Reihe Hindernisse an der Stelle `s`. Nie sind alle drei Spuren mit Kisten zu: es gibt immer eine freie Spur
 * oder eine, über die man springen kann. Auf der ersten Strecke höchstens ein Hindernis je Reihe.
 */
export function reiheBei(s: number, strecke: number, rng: () => number): Ding[] {
  const spur = Math.floor(rng() * SPUREN);
  const r = rng();
  const andere = (spur + 1 + Math.floor(rng() * 2)) % SPUREN;
  // eine Linie Sterne auf einer Spur ohne Hindernis
  const sterne = (frei: number): Ding[] => (rng() < 0.55 ? Array.from({ length: 5 }, (_, i) => ({ s: s + 2.5 + i * 1.6, spur: frei, art: "stern" as const })) : []);
  const freieSpur = (belegt: number[]) => [0, 1, 2].filter((x) => !belegt.includes(x))[Math.floor(rng() * (SPUREN - belegt.length))];
  if (strecke <= 1 || r < 0.35) {
    const art: DingArt = rng() < 0.6 ? "kiste" : "huerde";
    return [{ s, spur, art }, ...sterne(freieSpur([spur]))];
  }
  if (r < 0.55) {
    // eine Hürde über alle drei Spuren: springen
    return [0, 1, 2].map((x) => ({ s, spur: x, art: "huerde" as const }));
  }
  if (r < 0.8 || strecke < 3) {
    // zwei Kisten, eine Spur bleibt frei
    return [{ s, spur, art: "kiste" }, { s, spur: andere, art: "kiste" }, ...sterne(freieSpur([spur, andere]))];
  }
  // Kiste und Hürde: ausweichen oder springen
  return [{ s, spur, art: "kiste" }, { s, spur: andere, art: "huerde" }, ...sterne(freieSpur([spur, andere]))];
}

/** Kann man an dieser Reihe vorbei? Mindestens eine Spur ohne Kiste. */
export const passierbar = (reihe: Ding[]) => [0, 1, 2].some((spur) => !reihe.some((d) => d.spur === spur && d.art === "kiste"));

// ---------- Springen und Treffer ----------

export const SPRUNG_DAUER = 0.62;
export const SPRUNG_HOEHE = 1.3;
/** Wie hoch der Läufer `t` Sekunden nach dem Absprung ist (eine Parabel; 0 am Boden). */
export const sprungHoehe = (t: number) => (t <= 0 || t >= SPRUNG_DAUER ? 0 : 4 * SPRUNG_HOEHE * (t / SPRUNG_DAUER) * (1 - t / SPRUNG_DAUER));
/** So hoch muss der Läufer über einer Hürde sein. */
export const HUERDE_HOEHE = 0.45;
/** So nah (m) ist ein Ding am Läufer, wenn es trifft. */
export const NAEHE = 0.7;

/**
 * Trifft der Läufer dieses Ding? `spur` ist die Stelle des Läufers zwischen 0 und 2 (beim Wechseln dazwischen),
 * `hoehe` die Sprunghöhe. Ein Stern „trifft“ auch, er wird eingesammelt.
 */
export function trifft(d: Ding, spieler: number, spur: number, hoehe: number): boolean {
  if (Math.abs(d.s - spieler) > NAEHE) return false;
  if (Math.abs(d.spur - spur) > (d.art === "stern" ? 0.6 : 0.5)) return false;
  if (d.art === "huerde") return hoehe < HUERDE_HOEHE;
  if (d.art === "stern") return hoehe < 1.1;
  return true;
}

// ---------- Punkte ----------

export const TOR_PUNKTE = { meter: 1, stern: 10, tor: 100 } as const;
/** Fieber: drei richtige am Stück zählen doppelt, sechs dreifach (wie in Blockwerk). */
export const TOR_FIEBER_AB = 3;
export const torFaktor = (serie: number) => (serie >= TOR_FIEBER_AB * 2 ? 3 : serie >= TOR_FIEBER_AB ? 2 : 1);

/** Höchstens so viele Punkte nimmt der Server an. */
export const TOR_PUNKTE_MAX = 5_000_000;
export const gueltigeTorPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(TOR_PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);
