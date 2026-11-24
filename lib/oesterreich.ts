/**
 * „Österreich erobern“ (niko 2026-11-24, GWB-Test einer 3. Klasse AHS am 26.11.2026): Lernspiel in der Schüler-App
 * (components/lernen/OesterreichSpiel.tsx, docs/lernspiele.md). Die Karte von Österreich ist die Level-Karte: jedes
 * Bundesland ist ein Level zu einem Teil des Teststoffs (lib/oesterreich-inhalt.ts); wer es schafft, erobert das
 * Bundesland. Wien ist der Endgegner mit Fragen aus allen Leveln. Drei Herzen (Wien fünf): ein Fehler beim ersten
 * Versuch kostet eins, Sterne = übrige Herzen.
 *
 * Antworten: Bundesland auf der Karte antippen, Landeshauptstadt antippen, Kacheln, richtig/falsch, „Wer hat mehr
 * Einwohner?“, Gruppen, Balken im Altersaufbaudiagramm antippen, der Reihe nach antippen, Zahl oder Begriff schreiben.
 *
 * Rein (ohne Datenbank), damit es auch im Browser läuft.
 */
import { normal } from "./biolabor";
import { ALTERSAUFBAU, BUNDESLAENDER, LAND, LEVELS, OESTERREICH, type Eintrag, type LandId, type Level } from "./oesterreich-inhalt";
import type { SpielKarte } from "./lernspiele-typen";

export { ALTERSAUFBAU, BUNDESLAENDER, LAND, LEVELS, OESTERREICH };
export type { Eintrag, LandId, Level };

export const OE_SKILL = "geo.oesterreich";
export const OE_TITEL = "Österreich erobern";
export const SICHER_NACH = 2;
/** So viele Karten hat der Endgegner Wien. */
export const BOSS_ANZAHL = 15;
export const BOSS_LEVEL = 9;
export const herzenFuer = (level: number) => (level === BOSS_LEVEL ? 5 : 3);

/** Trennt die Teile einer Reihe in der Antwort. */
export const REIHE_TRENNER = " > ";

type Rng = () => number;

/** Was gespielt wird: ein Level, alle Begriffe zum Schreiben, oder die zuletzt falschen. */
export type OeWunsch = ({ was: "level"; level: number } | { was: "begriffe" } | { was: "fehler" }) & {
  /** Schwer: alles, was kurz genug ist, selbst schreiben (auch Bundesland und Hauptstadt auf der Karte) */
  schwer?: boolean;
};

/** An jeder Karte: Eintrag, Level (0 = kein Level), wie gefragt wird. */
export type OeDaten = {
  eintrag: string;
  level: number;
  art: Eintrag["art"];
  frage: string;
  /** Karte antippen: Bundesland, Hauptstadt (Kürzel des Bundeslandes) */
  land?: LandId;
  /** „Wer hat mehr?“: die zwei Bundesländer mit Einwohnern */
  mehr?: { a: LandId; b: LandId };
  /** Altersaufbaudiagramm: was als richtig zählt */
  ziel?: string[];
  /** Reihe: die Teile gemischt */
  teile?: string[];
  /** Schreiben: andere Schreibweisen */
  auch?: string[];
  /** Schreiben zu einer Karte: welches Land markiert ist, oder an welcher Hauptstadt der Punkt steht */
  zeigeLand?: LandId;
  zeigeStadt?: LandId;
  /** Diese Frage gibt es auch mit Auswahl; hier wird geschrieben (Schwer, Endgegner oder schon einmal richtig) */
  getippt?: boolean;
};

export const alleEintraege = (): { e: Eintrag; level: Level }[] => LEVELS.flatMap((l) => l.eintraege.map((e) => ({ e, level: l })));
export const eintragVon = (id: string) => alleEintraege().find((x) => x.e.id === id);
export const levelVon = (nr: number) => LEVELS.find((l) => l.nr === nr);

/** Kartenschlüssel: `oe:<level>:<eintrag>` (Level 0: Begriffe oder Fehler). */
export const oeKey = (level: number, eintrag: string) => `oe:${level}:${eintrag}`;
export function vonKey(key: string): { level: number; eintrag: string } | null {
  const m = /^oe:(\d+):([a-z0-9-]+)$/.exec(key);
  return m ? { level: Number(m[1]), eintrag: m[2] } : null;
}

const zahlText = (n: number) => n.toLocaleString("de-AT").replace(/\./g, " ").replace(/ | /g, " ");
export const einwohnerText = (id: LandId) => zahlText(LAND[id].einwohner);

/** Die Frage einer Karte. */
export function frageVon(e: Eintrag): string {
  if (e.art === "mehr") return "Welches Bundesland hat mehr Einwohner?";
  return e.frage;
}

/** Richtige Antwort (was der Server vergleicht) und wie sie dasteht. */
export function loesungVon(e: Eintrag): { richtig: string; text: string } {
  switch (e.art) {
    case "land":
      return { richtig: e.land, text: LAND[e.land].name };
    case "stadt":
      return { richtig: e.land, text: LAND[e.land].hauptstadt };
    case "wahl":
      return { richtig: e.richtig, text: e.richtig };
    case "rf":
      return { richtig: e.richtig ? "richtig" : "falsch", text: e.richtig ? "Richtig" : "Falsch" };
    case "mehr": {
      const g = LAND[e.a].einwohner > LAND[e.b].einwohner ? e.a : e.b;
      return { richtig: LAND[g].name, text: LAND[g].name };
    }
    case "gruppe":
      return { richtig: e.richtig, text: e.richtig };
    case "balken":
      return { richtig: e.ziel[0], text: balkenText(e.ziel) };
    case "reihe":
      return { richtig: e.teile.join(REIHE_TRENNER), text: e.teile.join(" → ") };
    case "zahl":
      return { richtig: String(e.richtig), text: e.richtig < 0 ? `−${Math.abs(e.richtig)}` : String(e.richtig) };
    case "schreiben":
      return { richtig: e.richtig, text: e.richtig };
  }
}

/** „55 bis 59 Jahre“ oder „Frauen, 85 bis 89 Jahre“ für die Ziele im Altersaufbaudiagramm. */
export function balkenText(ziel: string[]): string {
  const teil = (z: string) => {
    const m = /^([mf]?)(\d+)$/.exec(z);
    if (!m) return z;
    const ab = Number(m[2]);
    const alter = ab >= 95 ? "ab 95 Jahre" : `${ab} bis ${ab + 4} Jahre`;
    return m[1] === "m" ? `Männer, ${alter}` : m[1] === "f" ? `Frauen, ${alter}` : alter;
  };
  if (ziel.length > 2) {
    const abs = ziel.map((z) => Number(z.replace(/^[mf]/, ""))).sort((a, b) => a - b);
    return `${abs[0]} bis ${abs[abs.length - 1] >= 95 ? "über 95" : abs[abs.length - 1] + 4} Jahre`;
  }
  return ziel.map(teil).join(" oder ");
}

/** Trifft ein angetippter Balken („m55“, „f10“) eines der Ziele? */
export function balkenTrifft(ziel: string[], getippt: string): boolean {
  const ab = getippt.replace(/^[mf]/, "");
  return ziel.includes(getippt) || ziel.includes(ab);
}

/** Merksatz nach einem Fehler. */
export function merkeVon(e: Eintrag): string {
  if (e.merke) return e.merke;
  if (e.art === "mehr") {
    const [x, y] = [LAND[e.a], LAND[e.b]].sort((p, q) => q.einwohner - p.einwohner);
    return `${x.name}: ${zahlText(x.einwohner)} · ${y.name}: ${zahlText(y.einwohner)} Einwohner (2021).`;
  }
  if (e.art === "gruppe") return `${LAND[e.land].name}: ${zahlText(LAND[e.land].einwohner)} Einwohner (2021).`;
  return "";
}

function mische<T>(a: T[], rng: Rng): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

const ALLE_IDS = BUNDESLAENDER.map((b) => b.id);

/** Eine Karte aus einem Eintrag. */
export function karteVon(e: Eintrag, level: number, rng: Rng): SpielKarte {
  const l = loesungVon(e);
  const daten: OeDaten = { eintrag: e.id, level, art: e.art, frage: frageVon(e) };
  let faecher: string[] = [];
  if (e.art === "land" || e.art === "stadt") {
    daten.land = e.land;
    faecher = [...ALLE_IDS];
  } else if (e.art === "wahl") faecher = mische([e.richtig, ...e.falsch], rng);
  else if (e.art === "rf") faecher = ["richtig", "falsch"];
  else if (e.art === "mehr") {
    daten.mehr = { a: e.a, b: e.b };
    faecher = [LAND[e.a].name, LAND[e.b].name];
  } else if (e.art === "gruppe") {
    daten.land = e.land;
    faecher = [...e.gruppen];
  } else if (e.art === "balken") daten.ziel = e.ziel;
  else if (e.art === "reihe") {
    let t = mische(e.teile, rng);
    // nie schon richtig hingelegt
    for (let i = 0; i < 5 && t.join() === e.teile.join(); i++) t = mische(e.teile, rng);
    daten.teile = t;
  } else if (e.art === "schreiben") daten.auch = e.auch ?? [];
  return { key: oeKey(level, e.id), vor: "", nach: "", faecher, richtig: l.richtig, loesung: l.text, regel: merkeVon(e), oe: daten };
}

/** Kann man diesen Eintrag selbst schreiben (wie im Test)? */
const schreibbar = (e: Eintrag) => e.art === "schreiben" || e.art === "zahl";

/** Wörter vor oder nach einer kurzen Antwort, die man beim Schreiben weglassen darf („rund 2 000“ → „2 000“). */
function ohneBeiwerk(t: string): string[] {
  const kern = t
    .replace(/^(rund|etwa|seit|nach|die|der|das|ca\.?)\s+/i, "")
    .replace(/\s*(Jahre|Jahr|%|Prozent)$/i, "")
    .trim();
  return kern && kern !== t ? [kern] : [];
}

/** Geht die Frage auch zum Selbstschreiben? Land, Hauptstadt, kurze Antworten (bis drei Wörter). */
export function tippbar(e: Eintrag): boolean {
  if (e.art === "land" || e.art === "stadt") return true;
  if (e.art === "wahl") return e.richtig.length <= 24 && e.richtig.trim().split(/\s+/).length <= 3 && !/[.!?]$/.test(e.richtig);
  return false;
}

/** Die Karte zum Selbstschreiben statt mit Auswahl (nur für `tippbar`). */
export function alsSchreiben(e: Eintrag, level: number, rng: Rng): SpielKarte {
  const k = karteVon(e, level, rng);
  if (!tippbar(e) || !k.oe) return k;
  const oe: OeDaten = { eintrag: e.id, level, art: "schreiben", frage: k.oe.frage, getippt: true };
  let richtig = k.richtig;
  let auch: string[] = [];
  if (e.art === "land") {
    const b = LAND[e.land];
    richtig = b.name;
    auch = [b.kurz.length > 1 ? b.kurz : ""].filter(Boolean);
    // „Tippe auf Tirol.“: Tirol ist markiert, der Name wird geschrieben; sonst die Frage zum Schreiben umgestellt
    if (/^Tippe auf (das |die )?[A-ZÄÖÜ][a-zäöüß]+\.$/.test(e.frage)) {
      oe.zeigeLand = e.land;
      oe.frage = "Wie heißt das markierte Bundesland?";
    } else oe.frage = e.frage.replace(/\s*Tippe es an\.?$/, "").replace(/Tippe auf das/, "Schreib das");
  } else if (e.art === "stadt") {
    const b = LAND[e.land];
    richtig = b.hauptstadt;
    auch = b.hauptstadtAuch ?? [];
    oe.zeigeStadt = e.land;
    oe.frage = "Wie heißt die Landeshauptstadt am roten Punkt?";
  } else if (e.art === "wahl") {
    richtig = e.richtig;
    auch = ohneBeiwerk(e.richtig);
  }
  oe.auch = auch;
  return { ...k, faecher: [], richtig, loesung: richtig, oe };
}

export type EintragStand = { gesehen: number; sicher: boolean; zuletztFalsch: boolean };

/** Der Stand je Eintrag aus den beendeten Runden, älteste zuerst. Sicher: zweimal hintereinander beim ersten Versuch richtig. */
export function oeStand(runden: { antworten: { key: string; richtig: boolean }[] }[]): Map<string, EintragStand> {
  const verlauf = new Map<string, boolean[]>();
  for (const r of runden)
    for (const a of r.antworten) {
      const k = vonKey(a.key);
      if (!k) continue;
      verlauf.set(k.eintrag, [...(verlauf.get(k.eintrag) ?? []), a.richtig]);
    }
  const out = new Map<string, EintragStand>();
  for (const [id, v] of verlauf) {
    const letzte = v.slice(-SICHER_NACH);
    out.set(id, { gesehen: v.length, sicher: letzte.length === SICHER_NACH && letzte.every(Boolean), zuletztFalsch: !v[v.length - 1] });
  }
  return out;
}

/** Sterne aus den Fehlern beim ersten Versuch (0 = verloren). */
export function sterneAus(fehler: number, level: number): number {
  const herzen = herzenFuer(level);
  if (fehler >= herzen) return 0;
  if (level === BOSS_LEVEL) return fehler <= 1 ? 3 : fehler <= 3 ? 2 : 1;
  return 3 - fehler;
}

/**
 * Die besten Sterne je Level: eine Runde zählt für ein Level, wenn alle ihre Karten zu ihm gehören und jede Karte
 * beantwortet ist (wer vorher alle Herzen verliert, hat das Level nicht geschafft).
 */
export function levelStand(runden: { antworten: { key: string; wahl: string; richtig: boolean }[] }[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of runden) {
    if (!r.antworten.length) continue;
    const ks = r.antworten.map((a) => vonKey(a.key));
    if (ks.some((k) => !k)) continue;
    const levels = new Set(ks.map((k) => k!.level));
    if (levels.size !== 1) continue;
    const n = [...levels][0];
    if (!levelVon(n)) continue;
    // nicht beantwortet = Spiel vorher zu Ende
    if (r.antworten.some((a) => a.wahl === "")) continue;
    const noetig = n === BOSS_LEVEL ? BOSS_ANZAHL : levelVon(n)!.eintraege.length;
    if (r.antworten.length < noetig) continue;
    const sterne = sterneAus(r.antworten.filter((a) => !a.richtig).length, n);
    if (sterne > 0) out[n] = Math.max(out[n] ?? 0, sterne);
  }
  return out;
}

/** Die Karten einer Runde. */
export function oeRunde(stand: Map<string, EintragStand>, w: OeWunsch, rng: Rng): SpielKarte[] {
  /** Schwer, Endgegner, oder schon einmal richtig (dann nicht mehr raten): selbst schreiben, wenn es geht */
  const karte = (e: Eintrag, level: number) => {
    const s = stand.get(e.id);
    const tippen = tippbar(e) && (w.schwer || level === BOSS_LEVEL || (!!s && s.gesehen > 0 && !s.zuletztFalsch));
    return tippen ? alsSchreiben(e, level, rng) : karteVon(e, level, rng);
  };
  if (w.was === "level") {
    const l = levelVon(w.level);
    if (!l) return [];
    if (l.nr === BOSS_LEVEL) {
      // aus allen Leveln: zuerst zuletzt falsche, dann nicht sichere, Schreiben bevorzugt; höchstens 3 je Level
      const alle = mische(alleEintraege(), rng).sort((x, y) => rang(stand, x.e) - rang(stand, y.e));
      const je = new Map<number, number>();
      const wahl: Eintrag[] = [];
      for (const x of alle) {
        if (wahl.length >= BOSS_ANZAHL) break;
        if ((je.get(x.level.nr) ?? 0) >= 3) continue;
        je.set(x.level.nr, (je.get(x.level.nr) ?? 0) + 1);
        wahl.push(x.e);
      }
      return wahl.map((e) => karte(e, BOSS_LEVEL));
    }
    // Karten zum Antippen zuerst gemischt, Schreiben und Reihen eher am Schluss
    const reihe = mische(l.eintraege, rng).sort((a, b) => (schreibbar(a) || a.art === "reihe" ? 1 : 0) - (schreibbar(b) || b.art === "reihe" ? 1 : 0));
    return reihe.map((e) => karte(e, l.nr));
  }
  if (w.was === "begriffe") {
    const b = alleEintraege().filter((x) => schreibbar(x.e) || (w.schwer && tippbar(x.e)));
    return mische(b, rng)
      .sort((x, y) => rang(stand, x.e) - rang(stand, y.e))
      .slice(0, 12)
      .map((x) => (schreibbar(x.e) ? karteVon(x.e, 0, rng) : alsSchreiben(x.e, 0, rng)));
  }
  const falsch = alleEintraege().filter((x) => stand.get(x.e.id)?.zuletztFalsch);
  return mische(falsch, rng)
    .slice(0, 15)
    .map((x) => karte(x.e, 0));
}

/** Reihenfolge für den Endgegner: zuletzt falsch, nie gesehen, nicht sicher, sicher; Schreiben jeweils vorn. */
function rang(stand: Map<string, EintragStand>, e: Eintrag): number {
  const s = stand.get(e.id);
  const basis = s?.zuletztFalsch ? 0 : !s ? 2 : !s.sicher ? 4 : 6;
  return basis + (schreibbar(e) ? 0 : 1);
}

/** Zahl aus einer Eingabe („−9“, „- 9“, „minus 9“); null, wenn keine Zahl. */
export function zahlAus(eingabe: string): number | null {
  const t = eingabe
    .trim()
    .toLowerCase()
    .replace(/^minus\s*/, "-")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Selbst geschrieben: „richtig“, „fast“ (ein Buchstabe daneben, ab 5 Buchstaben) oder „falsch“. */
export function pruefeGeschrieben(eingabe: string, erlaubt: string[]): "richtig" | "fast" | "falsch" {
  const e = normal(eingabe);
  if (!e) return "falsch";
  const gut = erlaubt.map(normal).filter(Boolean);
  if (gut.includes(e)) return "richtig";
  return gut.some((g) => g.length >= 5 && abstand(e, g) <= (g.length >= 10 ? 2 : 1)) ? "fast" : "falsch";
}

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
