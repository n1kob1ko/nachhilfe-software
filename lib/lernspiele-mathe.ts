/**
 * Die Karten des Mathe-Lernspiels „Kopfrechnen“ (niko 2026-11-11: „für Mathe, was Spaß machen könnte“). Eine Rechnung
 * steht auf der Karte („7 · 8 =“, „3/4 + 1/6 =“), die Kisten sind das richtige Ergebnis und zwei typische falsche.
 * Nach einem Fehler steht der Rechenweg da. Keine KI.
 *
 * Je Runde **ein Thema** (eine Fähigkeit), wie bei „English Tenses“: das aus dem Stoff des Schülers, sonst das nächste
 * seiner Schulstufe (`themenPlan` in lib/lernspiele.ts).
 *
 * - Volksschule (Plus und Minus bis 10, 20, 100, 1000, Einmaleins, Geteilt, Zehner): eigene Karten, hier gebaut.
 * - Ab der 5. Schulstufe: die Aufgaben der Mathe-Generatoren (lib/mathe-rechnungen.ts, lib/mathe-grundlagen.ts),
 *   dieselben wie in den Übungen. Aus der Frage wird eine Rechnung mit Lücke (`form`), die falschen Kisten sind die
 *   typischen Fehler der Aufgabe (`errorMap`); fehlt einer, kommt ein naheliegender dazu (`ersatz`).
 *
 * Hier steht nur Reines (keine Datenbank).
 */
import type { Stufe } from "./banken-regeln";
import type { Difficulty } from "./curriculum";
import type { Kandidat } from "./lernspiele-karten";
import { festerZufall, zahlAus, type SpielKarte, type SpielThema } from "./lernspiele-typen";
import { MATHE_GRUNDLAGEN } from "./mathe-grundlagen";
import { MATHE_RECHNUNGEN } from "./mathe-rechnungen";
import type { TaskDraft } from "./tasks";

/** Die Themen in der Reihenfolge des Unterrichts (1. Klasse Volksschule = 1. Schulstufe). */
export const RECHNEN_THEMEN: SpielThema[] = [
  { skill: "mathe.vs.addsub.zr10", name: "Plus und Minus bis 10", ab: 1, bis: 1 },
  { skill: "mathe.vs.addsub.zehner", name: "Plus und Minus bis 20", ab: 1, bis: 2 },
  { skill: "mathe.vs.addsub.zr100", name: "Plus und Minus bis 100", ab: 2, bis: 3 },
  { skill: "mathe.vs.muldiv.einmaleins", name: "Einmaleins", ab: 2, bis: 5 },
  { skill: "mathe.vs.muldiv.geteilt", name: "Geteilt", ab: 2, bis: 5 },
  { skill: "mathe.vs.addsub.zr1000", name: "Plus und Minus bis 1000", ab: 3, bis: 4 },
  { skill: "mathe.vs.muldiv.zehner", name: "Mal und geteilt mit Zehnern", ab: 3, bis: 5 },
  { skill: "mathe.zahlen.zehner", name: "Mal und geteilt durch 10, 100, 1000", ab: 5, bis: 6 },
  { skill: "mathe.zahlen.vorrang", name: "Punkt vor Strich", ab: 5, bis: 6 },
  { skill: "mathe.zahlen.runden", name: "Runden", ab: 5, bis: 6 },
  { skill: "mathe.dezimal.addieren", name: "Dezimalzahlen: plus und minus", ab: 5, bis: 6 },
  { skill: "mathe.dezimal.multiplizieren", name: "Dezimalzahlen: mal und geteilt", ab: 5, bis: 6 },
  { skill: "mathe.masse.laengen", name: "Längen umwandeln", ab: 5, bis: 6 },
  { skill: "mathe.masse.massen", name: "Gewichte umwandeln", ab: 5, bis: 6 },
  { skill: "mathe.masse.zeit", name: "Zeit umrechnen", ab: 5, bis: 6 },
  { skill: "mathe.brueche.vonzahlen", name: "Bruchteile", ab: 5, bis: 6 },
  { skill: "mathe.teilbarkeit.regeln", name: "Teilbar oder nicht?", ab: 6, bis: 7 },
  { skill: "mathe.teilbarkeit.ggt-kgv", name: "ggT und kgV", ab: 6, bis: 7 },
  { skill: "mathe.brueche.kuerzen", name: "Brüche kürzen", ab: 6, bis: 8 },
  { skill: "mathe.brueche.erweitern", name: "Brüche erweitern", ab: 6, bis: 8 },
  { skill: "mathe.brueche.addieren", name: "Brüche addieren", ab: 6, bis: 8 },
  { skill: "mathe.brueche.subtrahieren", name: "Brüche subtrahieren", ab: 6, bis: 8 },
  { skill: "mathe.brueche.multiplizieren", name: "Brüche multiplizieren", ab: 6, bis: 8 },
  { skill: "mathe.brueche.dividieren", name: "Brüche dividieren", ab: 6, bis: 8 },
  { skill: "mathe.brueche.dezimal", name: "Bruch, Dezimalzahl, Prozent", ab: 6, bis: 8 },
  { skill: "mathe.negativ.addieren", name: "Negative Zahlen: plus und minus", ab: 7 },
  { skill: "mathe.negativ.multiplizieren", name: "Negative Zahlen: mal und geteilt", ab: 7 },
  { skill: "mathe.terme.zusammenfassen", name: "Terme zusammenfassen", ab: 7 },
  { skill: "mathe.terme.klammern", name: "Klammern auflösen", ab: 7 },
  { skill: "mathe.gleichungen.einfach", name: "Gleichungen", ab: 7 },
  { skill: "mathe.gleichungen.klammern", name: "Gleichungen mit Klammern", ab: 7 },
  { skill: "mathe.prozent.prozentwert", name: "Prozentwert", ab: 7 },
  { skill: "mathe.prozent.prozentsatz", name: "Prozentsatz", ab: 7 },
  { skill: "mathe.prozent.grundwert", name: "Grundwert", ab: 7 },
  { skill: "mathe.potenzen.schreibweise", name: "Potenzen", ab: 7 },
  { skill: "mathe.potenzen.regeln", name: "Potenzregeln", ab: 8 },
  { skill: "mathe.terme.binomisch", name: "Binomische Formeln", ab: 8 },
  { skill: "mathe.wurzeln.quadratwurzel", name: "Wurzeln", ab: 8 },
];

/** Fehlt ein typischer Fehler: `stellen` verschiebt das Komma (× 10, : 10), `nachbar` nimmt eine Zahl knapp daneben. */
type Ersatz = "nachbar" | "stellen";
type Quelle = {
  diffs?: Difficulty[];
  ersatz?: Ersatz;
  /** negative Ergebnisse sind möglich: das Vorzeichen ist ein typischer Fehler */
  negativ?: boolean;
  /** das Ergebnis ist immer eine ganze Zahl: ein Bruch als falsche Kiste würde es verraten */
  ganz?: boolean;
};

/** Was von den Generatoren ins Spiel kommt: nur, was sich im Kopf (oder mit einem Überschlag) lösen lässt. */
const QUELLEN: Record<string, Quelle> = {
  "mathe.zahlen.zehner": { ersatz: "stellen" },
  "mathe.zahlen.vorrang": {},
  "mathe.zahlen.runden": {},
  "mathe.dezimal.addieren": { diffs: ["leicht", "mittel"], ersatz: "stellen" },
  "mathe.dezimal.multiplizieren": { diffs: ["leicht", "mittel"], ersatz: "stellen" },
  "mathe.masse.laengen": { ersatz: "stellen" },
  "mathe.masse.massen": { ersatz: "stellen" },
  "mathe.masse.zeit": {},
  "mathe.brueche.vonzahlen": {},
  "mathe.teilbarkeit.regeln": {},
  "mathe.teilbarkeit.ggt-kgv": { diffs: ["leicht", "mittel"] },
  "mathe.brueche.kuerzen": {},
  "mathe.brueche.erweitern": {},
  "mathe.brueche.addieren": {},
  "mathe.brueche.subtrahieren": {},
  "mathe.brueche.multiplizieren": {},
  "mathe.brueche.dividieren": {},
  "mathe.brueche.dezimal": { ersatz: "stellen" },
  "mathe.negativ.addieren": { negativ: true },
  "mathe.negativ.multiplizieren": { negativ: true },
  "mathe.terme.zusammenfassen": {},
  "mathe.terme.klammern": {},
  "mathe.gleichungen.einfach": { negativ: true, ganz: true },
  "mathe.gleichungen.klammern": { negativ: true, ganz: true },
  "mathe.prozent.prozentwert": { diffs: ["leicht", "mittel"], ersatz: "stellen" },
  "mathe.prozent.prozentsatz": { diffs: ["leicht", "mittel"], ersatz: "stellen" },
  "mathe.prozent.grundwert": { diffs: ["leicht", "mittel"], ersatz: "stellen" },
  "mathe.potenzen.schreibweise": { negativ: true },
  "mathe.potenzen.regeln": {},
  "mathe.terme.binomisch": { diffs: ["leicht", "mittel"] },
  "mathe.wurzeln.quadratwurzel": {},
};

const GENERATOREN: Record<string, (rng: () => number, diff: Difficulty) => TaskDraft> = { ...MATHE_GRUNDLAGEN, ...MATHE_RECHNUNGEN };

/** So viele Aufgaben werden je Schwierigkeit einmal erzeugt; doppelte fallen weg, mehr als `JE_STUFE` braucht es nicht. */
const VERSUCHE_JE_STUFE = 140;
const JE_STUFE = 40;
/** Längere Aufschriften passen nicht mehr auf eine Kiste, längere Rechnungen nicht auf die Karte. */
const KISTE_MAX = 16;
const RECHNUNG_MAX = 44;

// ---------- Zahlen als Text ----------

const NB = " ";
const istZahl = (s: string) => /^-?\d+(,\d+)?$/.test(s);
const zahl = (s: string) => Number(s.replace(",", "."));
const nachkomma = (s: string) => (s.split(",")[1] ?? "").length;
/** Eine Zahl mit Komma, ohne überflüssige Nullen am Ende. */
function alsText(n: number, stellen: number): string {
  let t = n.toFixed(Math.min(8, Math.max(0, stellen)));
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  return t.replace(".", ",");
}

/**
 * Eine Antwort, wie sie auf der Kiste steht: echtes Minus, große Zahlen in Dreiergruppen („12 500“), die Einheit
 * dahinter. Leerzeichen in Zahlen und vor der Einheit brechen nicht um.
 */
export function schoen(roh: string, einheit?: string): string {
  const t = roh
    .trim()
    .replace(/-/g, "−")
    .replace(/(?<![\d,])\d{5,}/g, (z) => z.replace(/\B(?=(\d{3})+$)/g, NB))
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NB}`);
  return einheit ? `${t}${NB}${einheit}` : t;
}

// ---------- Aus einer Aufgabe wird eine Karte ----------

/** Eine Rechnung für das Spiel: der Text vor der Lücke, das Richtige, falsche Ergebnisse (das typischste zuerst), der Rechenweg. */
export type RechenWahl = {
  vor: string;
  nach?: string;
  /** statt einer Lücke: der markierte Teil („2925 durch 5“), die Kisten sind dann fest (`faecher`) */
  mitte?: string;
  faecher?: string[];
  hinweis?: string;
  richtig: string;
  falsch: string[];
  regel: string;
  /** die gelöste Rechnung in einer Zeile („21/30 = 7/10“) */
  loesung?: string;
  /** zwei Karten mit derselben Gruppe kommen nie in eine Runde („7 · 8“ und „8 · 7“) */
  gruppe?: string;
};

/**
 * Eine Karte aus einer Rechnung: das richtige Ergebnis und zwei falsche als Kisten. Das erste falsche ist der
 * typischste Fehler, das zweite wechselt; die Kisten einer Karte stehen immer gleich.
 */
export function matheKarte(skill: string, w: RechenWahl): SpielKarte | null {
  const h = zahlAus(w.vor + (w.mitte ?? "") + w.richtig);
  let faecher = w.faecher;
  if (!faecher) {
    const rest = w.falsch.slice(1);
    if (!w.falsch.length || !rest.length) return null;
    faecher = [w.falsch[0], rest[h % rest.length]];
    faecher.splice(h % 3, 0, w.richtig);
  }
  const rechnung = `${w.vor}${w.mitte ?? ""}${w.nach ?? ""}`;
  if (new Set(faecher).size !== faecher.length || !faecher.includes(w.richtig) || faecher.some((f) => f.length > KISTE_MAX) || rechnung.length > RECHNUNG_MAX) return null;
  return {
    key: `ma:${skill}:${w.vor.replace(/\n/g, " ")}${w.mitte ?? ""}${w.hinweis ?? ""}`,
    skill,
    vor: w.vor,
    nach: w.nach ?? "",
    mitte: w.mitte,
    faecher,
    richtig: w.richtig,
    hinweis: w.hinweis,
    loesung: w.loesung ?? `${w.vor.replace(/\.\n/g, ". ").replace(/\n/g, ", ")} ${w.richtig}${w.nach ?? ""}`,
    regel: w.regel,
    kurz: w.richtig,
    mathe: true,
  };
}

type Form = {
  vor: string;
  nach?: string;
  mitte?: string;
  hinweis?: string;
  /** steht vor jeder Antwort („10^“, wenn nach der Hochzahl gefragt ist) */
  vorsatz?: string;
  /** weitere falsche Antworten, die zu dieser Art Aufgabe passen */
  dazu?: string[];
  /** diese Art Aufgabe braucht einen anderen Ersatz als ihr Thema */
  ersatz?: Ersatz;
};

const STELLE: Record<string, number> = { Zehner: 10, Hunderter: 100, Tausender: 1000, Zehntausender: 10000 };

/**
 * Die Frage einer Aufgabe als Rechnung mit Lücke: „Kürze den Bruch 21/30 so weit wie möglich.“ wird „21/30 =“ mit dem
 * Hinweis „(so weit wie möglich gekürzt)“. null für Aufgaben, die sich nicht so schreiben lassen (Textaufgaben).
 */
export function form(prompt: string, richtig: string): Form | null {
  const p = prompt.trim();
  let m: RegExpExecArray | null;
  if ((m = /^Berechne und kürze das Ergebnis: (.+)$/.exec(p))) return { vor: `${m[1]} =`, hinweis: "(gekürzt)" };
  if ((m = /^Berechne(?: ohne Taschenrechner)?: (.+)$/.exec(p))) return { vor: `${m[1]} =` };
  if ((m = /^Kürze den Bruch (\S+) so weit wie möglich\.$/.exec(p))) return { vor: `${m[1]} =`, hinweis: "(so weit wie möglich gekürzt)" };
  if ((m = /^Erweitere den Bruch (\S+) auf den Nenner (\d+)\.$/.exec(p))) return { vor: `${m[1]} =`, hinweis: `(erweitert auf den Nenner ${m[2]})` };
  if ((m = /^Wandle um: (.+) = \? .+$/.exec(p))) return { vor: `${m[1]} =` };
  if ((m = /^Wie viele (?:Sekunden|Minuten|Stunden) sind (.+)\?$/.exec(p))) return { vor: `${m[1]} =` };
  if ((m = /^Wie viele Minuten dauert es von (.+) bis (.+)\?$/.exec(p))) return { vor: `Von ${m[1]} bis ${m[2]} sind es` };
  if ((m = /^Runde (.+?) auf (\S+)(?: \(.+\))?\.$/.exec(p))) {
    // auf die falsche Stelle gerundet (eine Stelle zu genau) und eine Stufe zu weit
    const stelle = STELLE[m[2]];
    const n = zahl(m[1].replace(/\s/g, ""));
    const dazu = stelle && istZahl(richtig) ? [...(stelle >= 100 ? [String(Math.round(n / (stelle / 10)) * (stelle / 10))] : []), String(zahl(richtig) + stelle)] : [];
    return { vor: `${m[1]} ≈`, hinweis: `(auf ${m[2]} gerundet)`, dazu };
  }
  if ((m = /^Berechne (\S+) von (.+?) \(.+\)\.$/.exec(p))) return { vor: `${m[1]} von ${m[2]} =` };
  if ((m = /^Schreib als Dezimalzahl: (.+)$/.exec(p))) return { vor: `${m[1]} =`, hinweis: "(als Dezimalzahl)" };
  if ((m = /^Wie viel Prozent sind (\S+)\?$/.exec(p))) return { vor: `${m[1]} =`, hinweis: "(in Prozent)" };
  if ((m = /^Schreib als gekürzten Bruch: (.+)$/.exec(p))) {
    const b = /^(\d+)\/(\d+)$/.exec(richtig);
    if (!b) return null;
    const [z, n] = [Number(b[1]), Number(b[2])];
    const prozent = /^(\d+) %$/.exec(m[1]);
    const ziffern = /^0,(\d+)$/.exec(m[1])?.[1];
    // typisch: die Zahl als Nenner gelesen („20 % = 1/20“), eine Stelle verrutscht („0,75 = 75/1000“)
    const dazu = [prozent ? `1/${prozent[1]}` : ziffern ? `${Number(ziffern)}/${10 ** (ziffern.length + 1)}` : "", z > 1 ? `${n}/${z}` : `${z + 1}/${n}`, `${z}/${n * 10}`].filter(Boolean);
    return { vor: `${m[1]} =`, hinweis: "(als gekürzter Bruch)", dazu };
  }
  if ((m = /^Bestimme den (ggT|kgV) von (\d+) und (\d+)\.$/.exec(p))) return { vor: `${m[1]} von ${m[2]} und ${m[3]} =` };
  if ((m = /^Ist (\d+) durch (\d+) teilbar\?/.exec(p))) return { vor: "Ist ", mitte: `${m[1]} durch ${m[2]}`, nach: " teilbar?" };
  if ((m = /^Schreib als Zahl ohne Zehnerpotenz: (.+)$/.exec(p))) return { vor: `${m[1]} =`, ersatz: "stellen" };
  if ((m = /^Multipliziere mit einer binomischen Formel aus: (.+)$/.exec(p))) {
    // (a + b)(a − b): typisch ist b statt b² oder das Doppelte
    const b = /^\((.+) \+ (\d+)\)\(\1 − \2\)$/.exec(m[1])?.[2];
    const vorne = richtig.split(" − ")[0];
    return { vor: `${m[1]} =`, dazu: b ? [`${vorne} − ${Number(b) * 2}`, `${vorne} − ${b}`] : [] };
  }
  if ((m = /^(?:Fasse zusammen|Löse die Klammern auf und fasse zusammen|Schreib als eine Potenz|Vereinfache): (.+)$/.exec(p))) return { vor: `${m[1]} =` };
  if ((m = /^Schreib als Zehnerpotenz: (.+?) = 10\^\?/.exec(p))) return { vor: `${m[1]} =`, vorsatz: "10^" };
  if ((m = /^Löse die Gleichung: (.+)$/.exec(p))) return { vor: `${m[1]}\n${/[a-z]/.exec(m[1])?.[0] ?? "x"} =` };
  if ((m = /^Wie viel Prozent sind (.+) von (.+?)\?/.exec(p))) return { vor: `${m[1]} von ${m[2]} =` };
  if ((m = /^Wie viel sind (.+) von (.+?)\?/.exec(p))) return { vor: `${m[1]} von ${m[2]} =` };
  if ((m = /^(.+) eines Betrags sind (.+)\. Wie groß ist der ganze Betrag/.exec(p))) return { vor: `${m[1]} sind ${m[2]}.\n100 % sind` };
  return null;
}

/**
 * Naheliegende falsche Antworten, wenn die Aufgabe selbst zu wenige typische Fehler nennt: bei einem Bruch Zähler oder
 * Nenner um eins daneben, bei einem Term ein gedrehtes Vorzeichen, bei einer Zahl das verschobene Komma oder die Zahl
 * knapp daneben (bei negativen Zahlen zuerst das andere Vorzeichen).
 */
export function ersatz(roh: string, art: Ersatz, negativ: boolean, h: number): string[] {
  const bruch = /^(-?)(\d+)\/(\d+)$/.exec(roh);
  if (bruch) {
    const [z, n] = [Number(bruch[2]), Number(bruch[3])];
    return [`${bruch[1]}${z + 1}/${n}`, `${bruch[1]}${z}/${n + 1}`, ...(z > 1 ? [`${bruch[1]}${z - 1}/${n}`] : [])];
  }
  if (istZahl(roh)) {
    const n = zahl(roh);
    const d = nachkomma(roh);
    if (n === 0) return ["1", "10"];
    if (art === "stellen") return [alsText(n * 10, d - 1), alsText(n / 10, d + 1), alsText(n * 100, d - 2), alsText(n / 100, d + 2)];
    const e = 10 ** -d;
    const nah = h % 2 ? [n + e, n - e] : [n - e, n + e];
    const weiter = [n + 10 * e, n - 10 * e, n + 2 * e, n - 2 * e];
    const alle = [...(negativ ? [-n] : []), ...nah, ...weiter.slice(h % 4), ...weiter.slice(0, h % 4)].filter((x) => negativ || x >= 0);
    return alle.map((x) => alsText(x, d));
  }
  if (/\p{L}/u.test(roh) && /^[−-]?[^=]+$/.test(roh)) {
    // ein Term: das Vorzeichen vorne oder das letzte Rechenzeichen gedreht
    const vorne = /^[−-]/.test(roh) ? roh.slice(1) : `−${roh}`;
    const i = Math.max(roh.lastIndexOf(" + "), roh.lastIndexOf(" − "));
    const hinten = i > 0 ? `${roh.slice(0, i)} ${roh[i + 1] === "+" ? "−" : "+"} ${roh.slice(i + 3)}` : "";
    return [hinten, vorne].filter(Boolean);
  }
  return [];
}

/** Der Rechenweg einer Aufgabe als Regel: höchstens fünf kurze Zeilen. */
function regelAus(solution: string): string {
  let z = solution
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // „x² − 36“ und gleich darunter „= x² − 36“: einmal reicht
  z = z.filter((zeile, i) => z[i + 1] !== `= ${zeile}`);
  if (z.length > 4 && /^Ergebnis:/.test(z[z.length - 1])) z = z.slice(0, -1);
  if (z.length > 5) z = [z[0], ...z.slice(-3)];
  return z.join("\n");
}

/** Eine Aufgabe eines Mathe-Generators als Rechnung für das Spiel; null, wenn sie nicht passt. */
export function rechenWahl(draft: TaskDraft, q: Quelle = {}): RechenWahl | null {
  const accepted = (draft.answer as { accepted?: string[] } | undefined)?.accepted;
  if (draft.type !== "calc" || !accepted?.length || !draft.solution) return null;
  const roh = accepted[0];
  const f = form(draft.prompt, roh);
  if (!f) return null;
  const regel = regelAus(draft.solution);
  if (f.mitte !== undefined) {
    if (roh !== "ja" && roh !== "nein") return null;
    const [zahlText, teiler] = f.mitte.split(" durch ");
    return { vor: f.vor, mitte: f.mitte, nach: f.nach, faecher: ["ja", "nein"], richtig: roh, falsch: [], regel, loesung: `${zahlText} ist ${roh === "ja" ? "" : "nicht "}durch ${teiler} teilbar` };
  }
  const einheit = accepted[1]?.startsWith(`${roh} `) ? accepted[1].slice(roh.length + 1) : undefined;
  const zeig = (s: string) => schoen(`${f.vorsatz ?? ""}${s}`, einheit);
  const richtig = zeig(roh);
  const fehler = (draft.errorMap ?? []).map((e) => e.answer).filter((a) => a && !a.includes("|") && !/\/1$/.test(a) && !(q.ganz && a.includes("/")));
  const h = zahlAus(draft.prompt);
  const ohneRichtig = (xs: string[]) => [...new Set(xs.map(zeig))].filter((x) => x !== richtig);
  // die typischen Fehler der Aufgabe; nur wenn es zu wenige sind, kommt ein naheliegender dazu
  let falsch = ohneRichtig([...fehler, ...(f.dazu ?? [])]);
  if (falsch.length < 2) falsch = ohneRichtig([...fehler, ...(f.dazu ?? []), ...ersatz(roh, f.ersatz ?? q.ersatz ?? "nachbar", Boolean(q.negativ) && !f.ersatz, h)]);
  if (falsch.length < 2) return null;
  return { vor: f.vor.replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NB}`), nach: f.nach, hinweis: f.hinweis, richtig, falsch, regel };
}

// ---------- Volksschule: eigene Karten ----------

type Roh = { w: RechenWahl; stufe: Stufe };

/** Zwei bis vier Zahlen knapp neben dem Ergebnis, die typischen zuerst (`zuerst`), alle im erlaubten Bereich. */
function daneben(r: number, h: number, o: { min?: number; max?: number; zuerst?: number[]; schritt?: number } = {}): string[] {
  const s = o.schritt ?? 1;
  const nah = h % 2 ? [r + s, r - s] : [r - s, r + s];
  const alle = [...(o.zuerst ?? []), ...nah, r + 2 * s, r - 2 * s].filter((x) => x !== r && x >= (o.min ?? 0) && x <= (o.max ?? Infinity));
  return [...new Set(alle)].map(String);
}
const reihe = (von: number, bis: number) => Array.from({ length: Math.abs(bis - von) + 1 }, (_, i) => (bis >= von ? von + i : von - i)).join(", ");

function plusMinusBis10(): Roh[] {
  const out: Roh[] = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 1; a + b <= 10; b++) {
      const [g, k, r] = [Math.max(a, b), Math.min(a, b), a + b];
      const regel = k === 1 ? `Eins mehr als ${g} ist ${r}.` : `Zähl von ${g} weiter: ${reihe(g + 1, r)}.`;
      out.push({ stufe: r <= 6 ? 0 : 1, w: { vor: `${a} + ${b} =`, richtig: String(r), falsch: daneben(r, a * 7 + b, { max: 10 }), regel, gruppe: `${k}+${g}` } });
    }
  for (let a = 2; a <= 10; a++)
    for (let b = 1; b < a; b++) {
      const r = a - b;
      const regel = b === 1 ? `Eins weniger als ${a} ist ${r}.` : b <= r ? `Zähl von ${a} zurück: ${reihe(a - 1, r)}.` : `Von ${b} bis ${a} ${r === 1 ? "fehlt" : "fehlen"} ${r}.`;
      out.push({ stufe: a <= 6 ? 0 : 1, w: { vor: `${a} − ${b} =`, richtig: String(r), falsch: daneben(r, a * 5 + b, { max: 10 }), regel } });
    }
  return out;
}

/** Bis 20 mit Zehnerübergang: erst bis zum Zehner, dann den Rest. */
function plusMinusBis20(): Roh[] {
  const out: Roh[] = [];
  for (let a = 2; a <= 9; a++)
    for (let b = 2; b <= 9; b++) {
      const r = a + b;
      if (r < 11) continue;
      const bis10 = 10 - a;
      const regel = `Erst bis 10: ${a} + ${bis10} = 10.\nDann noch ${b - bis10} dazu: ${r}.`;
      out.push({ stufe: r <= 12 || a === 9 ? 0 : 1, w: { vor: `${a} + ${b} =`, richtig: String(r), falsch: daneben(r, a * 7 + b, { max: 20, zuerst: (a + b) % 3 === 0 ? [r - 10] : [] }), regel, gruppe: `${Math.min(a, b)}+${Math.max(a, b)}` } });
    }
  for (let a = 11; a <= 18; a++)
    for (let b = 2; b <= 9; b++) {
      const r = a - b;
      if (r > 9 || r < 2) continue;
      const bis10 = a - 10;
      const regel = `Erst bis 10: ${a} − ${bis10} = 10.\nDann noch ${b - bis10} weg: ${r}.`;
      out.push({ stufe: a <= 12 ? 0 : 1, w: { vor: `${a} − ${b} =`, richtig: String(r), falsch: daneben(r, a * 5 + b, { max: 20, min: 1 }), regel } });
    }
  return out;
}

/** In Schritten rechnen: erst die großen Stellen von `b`, dann die kleinen. */
function schritte(a: number, b: number, plus: boolean, gross: number): string {
  const [g, k] = [Math.floor(b / gross) * gross, b % gross];
  const z = plus ? "+" : "−";
  const nach = (x: number, y: number) => (plus ? x + y : x - y);
  if (g && k) return `${a} ${z} ${g} = ${nach(a, g)}\nDann ${z} ${k}: ${nach(a, b)}.`;
  return `${a} ${z} ${b} = ${nach(a, b)}`;
}

function plusMinusBis100(): Roh[] {
  const rng = festerZufall(4711);
  const zufall = (von: number, bis: number) => von + Math.floor(rng() * (bis - von + 1));
  const out: Roh[] = [];
  for (let i = 0; i < 400; i++) {
    const plus = rng() < 0.5;
    const art = zufall(0, 3);
    // 0: plus/minus einen Einer über den Zehner, 1: glatte Zehner, 2: zweistellig ohne Übertrag, 3: zweistellig mit Übertrag
    const b = art === 0 ? zufall(3, 9) : art === 1 ? zufall(1, 6) * 10 : zufall(11, 59);
    const a = plus ? zufall(12, 99 - b) : zufall(b + 2, 99);
    if (a < 12 || a % 10 === 0 || (art >= 2 && b % 10 === 0)) continue;
    const r = plus ? a + b : a - b;
    const ueber = plus ? (a % 10) + (b % 10) >= 10 : a % 10 < b % 10;
    if (r < 1 || r > 100 || (art === 0 && !ueber) || (art === 2 && ueber) || (art === 3 && !ueber)) continue;
    let regel: string;
    if (art === 0) {
      const zehner = plus ? Math.ceil(a / 10) * 10 : Math.floor(a / 10) * 10;
      const bisZehner = Math.abs(zehner - a);
      regel = bisZehner ? `Erst bis ${zehner}: ${a} ${plus ? "+" : "−"} ${bisZehner} = ${zehner}.\nDann noch ${b - bisZehner} ${plus ? "dazu" : "weg"}: ${r}.` : `${a} ${plus ? "+" : "−"} ${b} = ${r}`;
    } else regel = art === 1 ? `Nur die Zehner ändern sich: ${Math.floor(a / 10)} ${plus ? "+" : "−"} ${b / 10} = ${Math.floor(r / 10)} Zehner.\nAlso ${r}.` : schritte(a, b, plus, 10);
    // typisch: den Übertrag vergessen (ein Zehner zu wenig oder zu viel)
    const falsch = daneben(r, a + b, { min: 1, max: 100, zuerst: ueber ? [plus ? r - 10 : r + 10] : [h10(r, a + b)] });
    out.push({ stufe: art <= 1 ? 0 : art === 2 ? 1 : 2, w: { vor: `${a} ${plus ? "+" : "−"} ${b} =`, richtig: String(r), falsch, regel, gruppe: plus ? `${Math.min(a, b)}+${Math.max(a, b)}` : undefined } });
  }
  return out;
}
/** Ein Zehner daneben, abwechselnd darüber und darunter. */
const h10 = (r: number, h: number) => (h % 2 && r > 10 ? r - 10 : r + 10);

function plusMinusBis1000(): Roh[] {
  const rng = festerZufall(1000);
  const zufall = (von: number, bis: number) => von + Math.floor(rng() * (bis - von + 1));
  const out: Roh[] = [];
  for (let i = 0; i < 400; i++) {
    const plus = rng() < 0.5;
    const art = zufall(0, 2);
    // 0: glatte Hunderter, 1: eine dreistellige Zahl und glatte Hunderter, 2: Zehnerzahlen (340 + 280)
    const b = art === 2 ? zufall(11, 49) * 10 : zufall(1, 7) * 100;
    if (art === 2 && b % 100 === 0) continue;
    const a = art === 0 ? zufall(1, 9) * 100 : art === 1 ? zufall(101, 999) : zufall(11, 99) * 10;
    if ((art === 1 && a % 10 === 0) || (art === 2 && a % 100 === 0)) continue;
    const r = plus ? a + b : a - b;
    if (r < 10 || r > 1000) continue;
    const ueber = art === 2 && (plus ? (a % 100) + (b % 100) >= 100 : a % 100 < b % 100);
    const z = plus ? "+" : "−";
    const regel =
      art === 0
        ? `${a / 100} Hunderter ${z} ${b / 100} Hunderter = ${r / 100} Hunderter.\nAlso ${r}.`
        : art === 1
          ? `Nur die Hunderter ändern sich: ${Math.floor(a / 100)} ${z} ${b / 100} = ${Math.floor(r / 100)}.\nAlso ${r}.`
          : schritte(a, b, plus, 100);
    const falsch = art === 2 ? daneben(r, a + b, { min: 10, max: 1000, schritt: 10, zuerst: [ueber ? (plus ? r - 100 : r + 100) : h100(r, a + b)] }) : daneben(r, a + b, { min: 10, max: 1000, schritt: 100, zuerst: art === 1 ? [h10(r, a)] : [] });
    out.push({ stufe: art === 0 ? 0 : art === 1 ? 1 : 2, w: { vor: `${a} ${z} ${b} =`, richtig: String(r), falsch, regel, gruppe: plus ? `${Math.min(a, b)}+${Math.max(a, b)}` : undefined } });
  }
  return out;
}
const h100 = (r: number, h: number) => (h % 2 && r > 100 ? r - 100 : r + 100);

/** Wie schwer eine Reihe des Einmaleins ist: 2, 5 und 10 zuerst, dann 3 und 4, dann 6 bis 9. */
const reihenStufe = (a: number, b: number): Stufe => ([2, 5, 10].includes(a) || [2, 5, 10].includes(b) ? 0 : a <= 4 || b <= 4 ? 1 : 2);

/** Wie man auf a · b kommt, wenn man es nicht auswendig weiß. */
function malWeg(a: number, b: number): string {
  const r = a * b;
  if (a === 10) return `Mal 10: eine Null anhängen. ${a} · ${b} = ${r}`;
  if (a === 2) return `${a} · ${b} = ${b} + ${b} = ${r}`;
  if (a === 3) return `${a} · ${b} = ${b} + ${b} + ${b} = ${r}`;
  if (a === 4) return `Das Doppelte von 2 · ${b} = ${2 * b}.\n${a} · ${b} = ${r}`;
  if (a === 5) return `Die Hälfte von 10 · ${b} = ${10 * b}.\n${a} · ${b} = ${r}`;
  if (a === 9) return `${a} · ${b} = 10 · ${b} − ${b} = ${10 * b} − ${b} = ${r}`;
  return `${a} · ${b} = 5 · ${b} + ${a - 5} · ${b} = ${5 * b} + ${(a - 5) * b} = ${r}`;
}

function einmaleins(): Roh[] {
  const out: Roh[] = [];
  for (let a = 2; a <= 10; a++)
    for (let b = 2; b <= 10; b++) {
      const r = a * b;
      const h = a * 11 + b;
      // die Nachbarn in den Reihen: einmal zu viel oder zu wenig gezählt
      const nachbarn = [h % 2 ? a * (b + 1) : a * (b - 1), h % 3 ? (a + 1) * b : (a - 1) * b, h % 2 ? a * (b - 1) : a * (b + 1), h % 3 ? (a - 1) * b : (a + 1) * b];
      const falsch = [...new Set(nachbarn.filter((x) => x !== r && x > 0).map(String))];
      out.push({ stufe: reihenStufe(a, b), w: { vor: `${a} · ${b} =`, richtig: String(r), falsch, regel: malWeg(a, b), gruppe: `${Math.min(a, b)}x${Math.max(a, b)}` } });
    }
  return out;
}

function geteilt(): Roh[] {
  const out: Roh[] = [];
  for (let a = 2; a <= 10; a++)
    for (let b = 2; b <= 10; b++) {
      const p = a * b;
      out.push({ stufe: reihenStufe(a, b), w: { vor: `${p} : ${a} =`, richtig: String(b), falsch: daneben(b, a * 11 + b, { min: 1 }), regel: `Die Umkehrung: ${b} · ${a} = ${p}.\nAlso ${p} : ${a} = ${b}`, gruppe: `${Math.min(a, b)}x${Math.max(a, b)}` } });
    }
  return out;
}

/** Mit Zehnern und Hundertern: das kleine Einmaleins, dann die Nullen anhängen. */
function malMitZehnern(): Roh[] {
  const out: Roh[] = [];
  const nullen = (n: number) => (n === 1 ? "eine Null" : "zwei Nullen");
  for (let a = 2; a <= 9; a++)
    for (let b = 2; b <= 9; b++) {
      const h = a * 11 + b;
      const k = a * b;
      const nachbar = (h % 2 ? a + 1 : a - 1) * b;
      // 3 · 70, 30 · 7 (Stufe 0 und 1), 3 · 700 und 30 · 70 (Stufe 2)
      const formen: { vor: string; r: number; n: number; stufe: Stufe }[] = [
        h % 2 ? { vor: `${a} · ${b * 10} =`, r: k * 10, n: 1, stufe: reihenStufe(a, b) === 2 ? 1 : 0 } : { vor: `${a * 10} · ${b} =`, r: k * 10, n: 1, stufe: reihenStufe(a, b) === 2 ? 1 : 0 },
        h % 3 === 0 ? { vor: `${a} · ${b * 100} =`, r: k * 100, n: 2, stufe: 2 } : h % 3 === 1 ? { vor: `${a * 10} · ${b * 10} =`, r: k * 100, n: 2, stufe: 2 } : { vor: `${k * 10} : ${a} =`, r: b * 10, n: 0, stufe: 1 },
      ];
      for (const f of formen) {
        const regel = f.n ? `Erst ${a} · ${b} = ${k}.\nDann ${nullen(f.n)} anhängen: ${f.r}.` : `Erst ${k} : ${a} = ${b}.\nDann eine Null anhängen: ${f.r}.`;
        // typisch: eine Null zu wenig oder zu viel; sonst der Nachbar in der Reihe
        const falsch = f.n ? [String(h % 2 ? f.r / 10 : f.r * 10), String(nachbar * 10 ** f.n), String(h % 2 ? f.r * 10 : f.r / 10)] : [String(b), String(b * 100), String((b + 1) * 10)];
        out.push({ stufe: f.stufe, w: { vor: f.vor, richtig: String(f.r), falsch: [...new Set(falsch)].filter((x) => x !== String(f.r)), regel, gruppe: `${Math.min(a, b)}x${Math.max(a, b)}` } });
      }
    }
  return out;
}

const EIGENE: Record<string, () => Roh[]> = {
  "mathe.vs.addsub.zr10": plusMinusBis10,
  "mathe.vs.addsub.zehner": plusMinusBis20,
  "mathe.vs.addsub.zr100": plusMinusBis100,
  "mathe.vs.addsub.zr1000": plusMinusBis1000,
  "mathe.vs.muldiv.einmaleins": einmaleins,
  "mathe.vs.muldiv.geteilt": geteilt,
  "mathe.vs.muldiv.zehner": malMitZehnern,
};

// ---------- Die Karten eines Themas ----------

const cache = new Map<string, Kandidat[]>();

/**
 * Alle Karten eines Mathe-Themas (einmal gebaut, dann aus dem Speicher). Die Stufe ist die Schwierigkeit des Generators
 * (leicht 0, mittel 1, schwer 2), bei den eigenen Karten die der Rechnung (das Einmaleins mit 2, 5, 10 zuerst).
 */
export function matheKandidaten(skill: string): Kandidat[] {
  const c = cache.get(skill);
  if (c) return c;
  const out = new Map<string, Kandidat>();
  const dazu = (w: RechenWahl | null, stufe: Stufe) => {
    const karte = w && matheKarte(skill, w);
    if (!w || !karte || out.has(karte.key)) return false;
    out.set(karte.key, { karte, stufe, gruppe: w.gruppe ? `${skill}|${w.gruppe}` : undefined });
    return true;
  };
  const eigene = EIGENE[skill];
  const generator = GENERATOREN[skill];
  if (eigene) for (const { w, stufe } of eigene()) dazu(w, stufe);
  else if (generator && QUELLEN[skill]) {
    const q = QUELLEN[skill];
    const rng = festerZufall(20261112 + (zahlAus(skill) % 1000));
    (q.diffs ?? (["leicht", "mittel", "schwer"] as Difficulty[])).forEach((diff, i) => {
      let n = 0;
      for (let v = 0; v < VERSUCHE_JE_STUFE && n < JE_STUFE; v++) if (dazu(rechenWahl(generator(rng, diff), q), i as Stufe)) n++;
    });
  }
  const liste = [...out.values()];
  cache.set(skill, liste);
  return liste;
}
