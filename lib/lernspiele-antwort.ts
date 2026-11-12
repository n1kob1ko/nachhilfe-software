/**
 * Wie eine Karte beantwortet wird (niko 2026-11-12: „Jedes Spiel hat die gleiche Lösungsart mit diesen 3 Kästchen
 * unten, das ist zu langweilig“). Die Karten bleiben dieselben, die Art zu antworten hängt am Spiel und an der Karte:
 *
 * - `tippen` (Kopfrechnen): das Ergebnis selbst an einem Ziffernblock eintippen, statt es aus drei Kisten zu wählen.
 *   Nur, wo das Ergebnis eine Zahl ist (auch mit Einheit, „74,5 dm“) oder ein einfacher Bruch, und wo man es im Kopf
 *   ganz ausrechnen kann.
 * - `legen` (Irregular Verbs, Präteritum): die Form aus Buchstaben legen. Zu den Buchstaben der Antwort kommen ein paar
 *   aus den falschen Formen, damit auch „goed“ oder „gehte“ gelegt werden kann.
 *
 * - `wischen` (das/dass, haben oder sein, Hauptsatz oder Gliedsatz, „Teilbar oder nicht?“): wo es nur zwei Antworten
 *   gibt, wird die Karte nach links oder rechts gewischt.
 * - `rad` (Präposition und Fall, Adjektiv-Endungen, English Tenses, English Grammar): ein Rad mit den Antworten. Beim
 *   Drehen steht die Antwort schon in der Lücke, man liest also den ganzen Satz, bevor man prüft.
 *
 * Bei den Kisten bleiben „der, die, das“, „Die vier Fälle“ und beim Kopfrechnen, was sich nicht tippen lässt (Terme,
 * Bruchrechnen). Gezählt wird wie immer die erste Antwort gegen `karte.richtig`: stimmt das
 * Getippte oder Gelegte, meldet das Spielfeld genau `karte.richtig`.
 *
 * Hier steht nur Reines (keine Datenbank), auch der Browser lädt es (components/lernen/ZiffernFeld.tsx, LegeFeld.tsx).
 * Wischen und Rad brauchen nichts von hier außer der Entscheidung (WischFeld.tsx, RadFeld.tsx).
 */
import { festerZufall, zahlAus, type SpielArt, type SpielForm, type SpielKarte } from "./lernspiele-typen";

// ---------- Ziffernblock ----------

const ZAHL = /^([−-]?\d[\d\s]*(?:,\d+)?)(?:\s([^\d\s][^\d]*))?$/;
const BRUCH = /^[−-]?\d+\/\d+$/;

/** Das Ergebnis einer Karte zum Eintippen: die Zahl ohne Leerzeichen („2472000“, „−3,5“, „6/7“) und die Einheit dahinter. */
export type TippZiel = { wert: string; einheit: string; bruch: boolean };

export function tippZiel(richtig: string): TippZiel | null {
  const text = richtig.trim();
  if (BRUCH.test(text)) return { wert: text.replace("-", "−"), einheit: "", bruch: true };
  const m = ZAHL.exec(text);
  if (!m) return null;
  return { wert: m[1].replace(/\s/g, "").replace("-", "−"), einheit: (m[2] ?? "").trim(), bruch: false };
}

/** Bei diesen Themen ist das Ergebnis oft eine gemischte Zahl oder ein Bruch, der auch ungekürzt stimmen würde: Kisten. */
const NUR_KISTEN = new Set(["mathe.brueche.addieren", "mathe.brueche.subtrahieren", "mathe.brueche.multiplizieren", "mathe.brueche.dividieren", "mathe.brueche.dezimal"]);
/** Hier reicht bei langen Ergebnissen ein Überschlag („5,59 · 1,2“): eingetippt wird nur, was höchstens drei Ziffern hat. */
const UEBERSCHLAG = new Set(["mathe.dezimal.addieren", "mathe.dezimal.multiplizieren", "mathe.teilbarkeit.ggt-kgv"]);
/** So viele Zeichen passen in das Feld. */
export const TIPP_MAX = 10;

/** Lässt sich das Ergebnis dieser Karte eintippen? */
export function tippbar(karte: SpielKarte): boolean {
  if (!karte.mathe || karte.wort || karte.mitte !== undefined) return false;
  const skill = karte.skill ?? "";
  if (NUR_KISTEN.has(skill)) return false;
  const z = tippZiel(karte.richtig);
  if (!z || z.wert.length > TIPP_MAX) return false;
  if (UEBERSCHLAG.has(skill) && z.wert.replace(/\D/g, "").replace(/^0+/, "").length > 3) return false;
  return true;
}

const alsZahl = (text: string) => Number(text.replace("−", "-").replace(",", "."));

/** Ist das Getippte schon eine ganze Antwort? („12,“ und „3/“ sind es noch nicht.) */
export const tippFertig = (text: string) => /\d$/.test(text) && !/\/0*$/.test(text);

/** Stimmt das Getippte? Zahlen zählen nach ihrem Wert („0,50“ ist „0,5“), ein Bruch muss genau so dastehen. */
export function tippStimmt(text: string, ziel: TippZiel): boolean {
  if (!tippFertig(text)) return false;
  if (ziel.bruch || text.includes("/")) return text === ziel.wert;
  const a = alsZahl(text);
  return Number.isFinite(a) && a === alsZahl(ziel.wert);
}

/** Eine Taste des Ziffernblocks: was danach im Feld steht. `±` dreht das Vorzeichen, `<` löscht das letzte Zeichen. */
export function tippTaste(text: string, taste: string): string {
  if (taste === "<") return text.slice(0, -1);
  if (taste === "±") return text.startsWith("−") ? text.slice(1) : `−${text}`;
  if (text.length >= TIPP_MAX) return text;
  if (taste === ",") {
    if (text.includes(",") || text.includes("/")) return text;
    return /\d$/.test(text) ? `${text},` : `${text}0,`;
  }
  if (taste === "/") return /\d$/.test(text) && !text.includes("/") && !text.includes(",") ? `${text}/` : text;
  if (!/^\d$/.test(taste)) return text;
  // eine einzelne Null vorne wird ersetzt („07“ gibt es nicht), nach dem Bruchstrich auch
  if (/(^|^−|\/)0$/.test(text)) return text.slice(0, -1) + taste;
  return text + taste;
}

/** Eine Zahl, wie sie auf den Karten steht: ab fünf Stellen in Dreiergruppen („25 000“, aber „2000“). */
export function tippAnzeige(text: string): string {
  if (text.includes("/")) return text;
  const m = /^(−?)(\d*)(.*)$/.exec(text);
  if (!m) return text;
  const ganz = m[2].length >= 5 ? m[2].replace(/\B(?=(\d{3})+$)/g, " ") : m[2];
  return `${m[1]}${ganz}${m[3]}`;
}

// ---------- Buchstaben legen ----------

const WORT = /^\p{L}+$/u;
/** So lang darf ein Wort sein, damit die Buchstaben auf ein kleines Handy passen. */
export const LEGE_MAX = 14;

/** Das Wort, das gelegt wird (was in der Lücke steht, wenn die Antwort stimmt). */
export const legeZiel = (karte: SpielKarte) => karte.einsatz ?? karte.richtig;

/** Lässt sich die Antwort dieser Karte aus Buchstaben legen? Ein Wort, nur Buchstaben. */
export function legbar(karte: SpielKarte): boolean {
  const z = legeZiel(karte);
  return !karte.mathe && !karte.wort && karte.mitte === undefined && WORT.test(z) && z.length >= 2 && z.length <= LEGE_MAX;
}

const FUELL = ["e", "n", "t", "s", "r", "a", "i", "d", "l", "h"];

/**
 * Die Buchstaben zum Legen, in fester gemischter Reihenfolge: die der Antwort und zwei, drei dazu. Die zusätzlichen
 * kommen zuerst aus den falschen Formen der Karte („putted“ gibt t, e, d zu „put“), damit sich der typische Fehler
 * legen lässt; sonst häufige Buchstaben.
 */
export function legeKacheln(karte: SpielKarte): string[] {
  const ziel = [...legeZiel(karte).toLowerCase()];
  const ueber = (wort: string) => {
    const rest = [...ziel];
    const out: string[] = [];
    for (const b of wort.toLowerCase()) {
      const i = rest.indexOf(b);
      if (i >= 0) rest.splice(i, 1);
      else out.push(b);
    }
    return out;
  };
  const wunsch = ziel.length > 9 ? 2 : 3;
  const dazu: string[] = [];
  // ein Wort vor mehreren („telled“ vor „was telling“): nur ein Wort lässt sich legen
  const falsche = karte.faecher.filter((f) => f !== karte.richtig).sort((a, b) => Number(/\s/.test(a)) - Number(/\s/.test(b)));
  for (const f of falsche) {
    if (!WORT.test(f)) continue;
    for (const b of ueber(f)) if (dazu.length < wunsch && !dazu.includes(b)) dazu.push(b);
  }
  const h = zahlAus(karte.key);
  for (let i = 0; dazu.length < 2 && i < FUELL.length; i++) {
    const b = FUELL[(h + i) % FUELL.length];
    if (!dazu.includes(b)) dazu.push(b);
  }
  const rng = festerZufall(h);
  const k = [...ziel, ...dazu];
  for (let i = k.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [k[i], k[j]] = [k[j], k[i]];
  }
  // steht die Antwort zufällig schon der Reihe nach da, rückt alles um eins weiter
  return k.slice(0, ziel.length).join("") === ziel.join("") ? [...k.slice(1), k[0]] : k;
}

/** Stimmt das gelegte Wort? Groß und klein zählt nicht (die Kacheln sind klein, am Satzanfang steht es groß da). */
export const legeStimmt = (wort: string, karte: SpielKarte) => wort.toLowerCase() === legeZiel(karte).toLowerCase();

/** Das gelegte Wort, wie es in der Lücke steht: am Satzanfang groß, wenn die Antwort groß ist. */
export function legeAnzeige(wort: string, karte: SpielKarte): string {
  const z = legeZiel(karte);
  return wort && z[0] !== z[0].toLowerCase() ? wort[0].toUpperCase() + wort.slice(1) : wort;
}

// ---------- Wischen und Rad ----------

/** Spiele mit zwei Antworten: die Karte wird gewischt. */
const WISCH_SPIELE = new Set<SpielArt>(["dasdass", "perfekt", "satzteile"]);
/** Spiele mit drei bis fünf Antworten in einer Lücke: das Rad. */
const RAD_SPIELE = new Set<SpielArt>(["praepositionen", "deklination", "zeiten", "grammatik", "wortschatz"]);
/** So viele Antworten passen an das Rad. */
export const RAD_MAX = 6;

/** Lässt sich die Karte wischen? Genau zwei Antworten: die erste liegt links, die zweite rechts. */
export const wischbar = (karte: SpielKarte) => !karte.wort && karte.faecher.length === 2 && karte.faecher.includes(karte.richtig);

/** Passt die Karte an das Rad? Ein Satz mit Lücke und drei bis sechs Antworten. */
export const drehbar = (karte: SpielKarte) => !karte.wort && !karte.mathe && karte.mitte === undefined && karte.faecher.length >= 3 && karte.faecher.length <= RAD_MAX && karte.faecher.includes(karte.richtig);

// ---------- welche Karte wie ----------

/** Die Art zu antworten für eine Karte dieses Spiels; `undefined`: Kisten. Eine Karte mit eigener Form behält sie. */
export function antwortForm(art: SpielArt, karte: SpielKarte): SpielForm | undefined {
  if (karte.form) return karte.form;
  if (art === "rechnen") return tippbar(karte) ? "tippen" : wischbar(karte) ? "wischen" : undefined;
  if (art === "irregular" || art === "praeteritum") return legbar(karte) ? "legen" : undefined;
  if (WISCH_SPIELE.has(art)) return wischbar(karte) ? "wischen" : undefined;
  if (RAD_SPIELE.has(art)) return wischbar(karte) ? "wischen" : drehbar(karte) ? "rad" : undefined;
  return undefined;
}

/** Die Karten einer Runde mit ihrer Art zu antworten (die Vorräte bleiben, wie sie sind). */
export function mitAntwortForm(art: SpielArt, karten: SpielKarte[]): SpielKarte[] {
  return karten.map((k) => {
    const form = antwortForm(art, k);
    return form && form !== k.form ? { ...k, form } : k;
  });
}

/** Wie die meisten Karten eines Vorrats beantwortet werden (für den Anfang des Spiels). */
export function haeufigsteForm(art: SpielArt, karten: SpielKarte[]): SpielForm | undefined {
  const n = new Map<SpielForm | undefined, number>();
  for (const k of karten) {
    const f = antwortForm(art, k);
    n.set(f, (n.get(f) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
