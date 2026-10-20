/**
 * Aufgaben mit Bild, ohne KI: Zahlenstrahl, Koordinatensystem, Figur, Kreis und Diagramm (lib/figur.ts) für
 * die passenden Fähigkeiten von der Volksschule bis zur Oberstufe. Jede Aufgabe ist richtig gebaut: die Lösung wird aus
 * denselben Zahlen gerechnet, die gezeichnet werden (Teilstrich, Punkt, Seitenlänge), nie getrennt davon.
 * Die Antwort ist ein gewohntes Format (Rechnung, Multiple Choice, Lückentext, Rechenweg, Sachaufgabe),
 * geprüft wird mit lib/tasks.ts bzw. lib/math-check.ts wie bei jeder anderen Aufgabe. Eigene Zahlen und
 * Texte, nicht aus Schulbüchern.
 *
 * Eingebunden in lib/generators.ts (GEN, generateForSlot, generateBuiltIn), damit der Übungs-Builder ohne
 * KI, die Diagnose und der Minitest diese Aufgaben machen.
 */
import type { Difficulty } from "./curriculum";
import {
  bruchText,
  bruchWert,
  geradenText,
  kreisWinkel,
  KREIS_TEILE,
  kuerzen,
  wertBei,
  zahl,
  zahlBei,
  type Bruch,
  type Diagramm,
  type DiagrammForm,
  type Figur,
  type Flaeche,
  type Koordinaten,
  type Kreis,
  type KreisTeil,
  type Punkt2,
  type Zahlenstrahl,
} from "./figur";
import type { PartSolution, PartView } from "./math-check";
import { parseNumber, type TaskDraft } from "./tasks";

type Rng = () => number;
const rint = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const LEVEL: Record<Difficulty, number> = { "sehr leicht": 0, leicht: 1, "leicht bis mittel": 1, mittel: 2, schwer: 3, "sehr schwer": 3 };
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export type FigurFormat = "calc" | "mc" | "cloze" | "rechenweg" | "sachaufgabe";
const KATEGORIE: Record<FigurFormat, string> = { calc: "rechnung", mc: "mc", cloze: "lueckentext", rechenweg: "rechenweg", sachaufgabe: "sachaufgabe" };
type Fehler = { answer: string; label: string };

const WEG = "Schreib jeden Rechenschritt in eine eigene Zeile.";

function aufgabe(
  skillId: string,
  difficulty: Difficulty,
  type: FigurFormat,
  o: { prompt: string; figur: Figur; data?: TaskDraft["data"]; answer: TaskDraft["answer"]; solution: string; hints: string[]; errorMap?: Fehler[]; steps?: string[]; zeit?: number },
): TaskDraft {
  return {
    type,
    skillId,
    skillIds: [skillId],
    category: KATEGORIE[type],
    difficulty,
    prompt: o.prompt,
    data: { ...(o.data ?? {}), figure: o.figur },
    answer: o.answer,
    solution: o.solution,
    hints: o.hints,
    errorMap: o.errorMap ?? [],
    ...(o.steps ? { solutionSteps: o.steps } : {}),
    estimatedTimeSec: o.zeit ?? (type === "rechenweg" ? 180 : type === "sachaufgabe" ? 360 : 90),
  };
}

const EINHEIT_AM_ENDE = /\s*(?:mm|cm|dm|km|m)(?:²|2)?$/;
/** Zahl als Schlüssel: 0,5 = 1/2 = 0.5 (mit derselben Einheit); alles andere bleibt Text. */
const schluessel = (s: string) => {
  const ohne = s.trim().replace(EINHEIT_AM_ENDE, "");
  const v = parseNumber(ohne);
  return v === null ? s.replace(/\s/g, "").toLowerCase() : `${Math.round(v * 1e9) / 1e9}|${s.trim().slice(ohne.length).trim()}`;
};
/** Zahlen ohne Leerzeichen zwischen den Dreiergruppen, für Rechenwege (die App liest „1 225“ dort nicht). */
const roh = (v: number) => zahl(v).replace(/\s/g, "");
/** Musterzeile für den Rechenweg ohne die Formel: „A = c · h : 2 = 8 · 5 : 2 = 20“ → „A = 8 · 5 : 2 = 20“. */
const zahlenWeg = (weg: string) => {
  const teile = weg.split(" = ");
  return teile.length >= 3 && /[a-zA-Z]/.test(teile[1]) ? [teile[0], ...teile.slice(2)].join(" = ") : weg;
};

/** Typische Fehler ohne die richtige Antwort und ohne Doppelte. */
function fehlerOhne(richtig: string, fehler: (Fehler | null | undefined)[]): Fehler[] {
  const seen = new Set([schluessel(richtig)]);
  return fehler.filter((f): f is Fehler => {
    if (!f || !f.answer) return false;
    const k = schluessel(f.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Antworten mit Einheit: "24 cm²", "24", "24cm²", "24 cm2". */
function mitEinheit(wert: string, einheit: string): string[] {
  const ohne = wert.replace(/ /g, " ");
  const dicht = ohne.replace(/\s/g, "");
  const e2 = einheit.replace("²", "2");
  return [...new Set([`${ohne} ${einheit}`, ohne, `${dicht} ${einheit}`, `${dicht}${einheit}`, `${ohne} ${e2}`, `${dicht} ${e2}`, `${dicht}${e2}`])];
}

/** Multiple Choice aus der richtigen Antwort und typischen Fehlern; `fuellen` ergänzt auf 4 Antworten. */
function auswahl(rng: Rng, richtig: string, fehler: Fehler[], fuellen: string[] = []): { options: string[]; correct: number; errorMap: Fehler[] } {
  const seen = new Set([schluessel(richtig)]);
  const falsch: { text: string; label: string | null }[] = [];
  for (const f of fehler) {
    const k = schluessel(f.answer);
    if (seen.has(k) || falsch.length >= 3) continue;
    seen.add(k);
    falsch.push({ text: f.answer, label: f.label });
  }
  // Zahlen mit Einheit: bei zu wenigen Antworten Nachbarzahlen dazu („24 cm²“ → „26 cm²“, „23 cm²“ …)
  const zahlMitEinheit = richtig.match(/^(−?\d[\d\s]*(?:,\d+)?)(\s+\S+)?$/);
  const nachbarn: string[] = [];
  if (zahlMitEinheit) {
    const v = parseNumber(zahlMitEinheit[1]);
    const stellen = zahlMitEinheit[1].split(",")[1]?.length ?? 0;
    if (v !== null) for (const d of [2, -1, 4, 1, -2, 10]) if (v + d > 0) nachbarn.push(`${zahl(v + d, stellen || undefined)}${zahlMitEinheit[2] ?? ""}`);
  }
  for (const x of [...fuellen, ...nachbarn]) {
    const k = schluessel(x);
    if (seen.has(k) || falsch.length >= 3) continue;
    seen.add(k);
    falsch.push({ text: x, label: null });
  }
  const options = shuffle(rng, [{ text: richtig, label: null as string | null, ok: true }, ...falsch.map((f) => ({ ...f, ok: false }))]);
  return {
    options: options.map((o) => o.text),
    correct: options.findIndex((o) => o.ok),
    errorMap: options.flatMap((o, i) => (o.label ? [{ answer: String(i), label: o.label }] : [])),
  };
}

const br = (x: number) => (x < 0 ? `(${zahl(x)})` : zahl(x));
const runde = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

// =====================================================================
// Zahlenstrahl
// =====================================================================

type Strahl = Omit<Zahlenstrahl, "art" | "marken" | "intervall">;
type StrahlPlan = {
  strahl: Strahl;
  /** Teilstriche, die markiert werden dürfen */
  frei: number[];
  /** wie die Antwort geschrieben wird */
  frage: "zahl" | "bruch" | "gemischt";
  /** typische falsche Zahlen für die Marke am Teilstrich i */
  fehler: (i: number) => (Fehler | null)[];
  /** Teilstriche, die man statt i nimmt (Multiple Choice mit Buchstaben) */
  falscheStellen: (i: number) => { bei: number; label: string }[];
  /** Multiple Choice „Welcher Buchstabe markiert …?“ passt */
  buchstaben: boolean;
};

const wert = (s: Strahl, i: number) => bruchWert(wertBei(s, i));
const imStrahl = (s: Strahl, v: number): number | null => {
  const i = Math.round((v - s.start) / bruchWert(s.schritt));
  return i >= 0 && i <= s.schritte && Math.abs(wert(s, i) - v) < 1e-9 ? i : null;
};
function antwortBei(p: StrahlPlan, i: number): string {
  const b = wertBei(p.strahl, i);
  return p.frage === "gemischt" ? bruchText(b, true) : p.frage === "bruch" ? bruchText(b) : zahlBei(p.strahl, i);
}
/** Weitere richtige Schreibweisen (gemischte Zahl und unechter Bruch). */
function auchRichtig(p: StrahlPlan, i: number): string[] {
  const b = wertBei(p.strahl, i);
  const alle = [bruchText(b, true), bruchText(b)];
  return [...new Set(alle)].filter((x) => x !== antwortBei(p, i));
}
const nachbarLabel = (s: Strahl, i: number) => s.beschriftet.reduce((best, b) => (Math.abs(b - i) < Math.abs(best - i) ? b : best), s.beschriftet[0]);
const linkesLabel = (s: Strahl, i: number) => [...s.beschriftet].reverse().find((b) => b <= i) ?? s.beschriftet[0];
const schrittText = (s: Strahl) => (s.format === "bruch" ? bruchText(s.schritt) : zahlBei({ start: 0, schritt: s.schritt, format: s.format }, 1));

/** Der Lösungsweg zum Ablesen: was ein Teilstück wert ist, dann vom nächsten beschrifteten Strich aus zählen. */
function ablesen(p: StrahlPlan, i: number, name: string): string {
  const s = p.strahl;
  const L = nachbarLabel(s, i);
  const a = linkesLabel(s, i);
  const b = s.beschriftet.find((x) => x > a) ?? s.beschriftet[s.beschriftet.length - 1];
  const n = i - L;
  const teil = (k: number) => `${k} ${k === 1 ? "Teilstück" : "Teilstücke"}`;
  const zeilen = [];
  if (b > a) zeilen.push(`Von ${zahlBei(s, a)} bis ${zahlBei(s, b)} sind es ${teil(b - a)}, ein Teilstück ist also ${schrittText(s)}.`);
  zeilen.push(`${name} liegt ${teil(Math.abs(n))} ${n > 0 ? "rechts" : "links"} von ${zahlBei(s, L)}: ${zahlBei(s, L)} ${n > 0 ? "+" : "−"} ${Math.abs(n)} · ${schrittText(s)} = ${antwortBei(p, i)}`);
  return zeilen.join("\n");
}

const ABLESEN_HILFEN = ["Schau zuerst, wie viel ein Teilstück wert ist.", "Zähle die Teilstücke vom nächsten beschrifteten Strich bis zur Marke."];

/** Zwei bis vier verschiedene Teilstriche aus `frei`, möglichst nicht nebeneinander. */
function stellen(rng: Rng, frei: number[], anzahl: number, schon: number[] = []): number[] {
  const out = [...schon];
  for (const i of shuffle(rng, frei)) {
    if (out.length >= anzahl) break;
    if (out.includes(i)) continue;
    if (out.some((o) => Math.abs(o - i) < 2) && frei.length > anzahl * 3) continue;
    out.push(i);
  }
  for (const i of shuffle(rng, frei)) if (out.length < anzahl && !out.includes(i)) out.push(i);
  return out;
}

function strahlFigur(s: Strahl, marken: { name: string; bei: number }[]): Zahlenstrahl {
  return { art: "zahlenstrahl", ...s, marken };
}

function strahlAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng, p: StrahlPlan, ziel?: number): TaskDraft | null {
  const s = p.strahl;
  const welche = p.frage === "bruch" ? "Welcher Bruch ist" : "Welche Zahl ist";
  const form = p.frage === "gemischt" ? " Schreib sie als gemischte Zahl." : "";
  if (format === "cloze") {
    const [i, j] = stellen(rng, p.frei, 2);
    const [a, b] = rng() < 0.5 ? [i, j] : [j, i];
    return aufgabe(skillId, diff, "cloze", {
      prompt: `${p.frage === "bruch" ? "Welche Brüche sind" : "Welche Zahlen sind"} bei A und B markiert?${p.frage === "gemischt" ? " Schreib sie als gemischte Zahlen." : form}\nA = ___\nB = ___`,
      figur: strahlFigur(s, [{ name: "A", bei: a }, { name: "B", bei: b }]),
      answer: { blanks: [[antwortBei(p, a), ...auchRichtig(p, a)], [antwortBei(p, b), ...auchRichtig(p, b)]], mode: "value" },
      solution: `${ablesen(p, a, "A")}\n${ablesen(p, b, "B")}`,
      hints: ABLESEN_HILFEN,
    });
  }
  const i = ziel ?? stellen(rng, p.frei, 1)[0];
  if (format === "mc" && p.buchstaben && p.frei.length >= 4 && rng() < 0.6) {
    // „Welcher Buchstabe markiert …?“: vier Marken, eine an der richtigen Stelle, andere an typisch falschen
    const falsch = p.falscheStellen(i).filter((f) => f.bei !== i && p.frei.includes(f.bei));
    const orte = stellen(rng, p.frei, 4, [i, ...falsch.map((f) => f.bei).filter((b, k, all) => all.indexOf(b) === k)].slice(0, 3));
    const sortiert = [...orte].sort((x, y) => x - y);
    const namen = ["A", "B", "C", "D"];
    const marken = sortiert.map((bei, k) => ({ name: namen[k], bei }));
    const zahlText = antwortBei(p, i);
    return aufgabe(skillId, diff, "mc", {
      prompt: `Welcher Buchstabe markiert ${p.frage === "bruch" ? "den Bruch" : "die Zahl"} ${zahlText}?`,
      figur: strahlFigur(s, marken),
      data: { options: marken.map((m) => m.name) },
      answer: { correct: sortiert.indexOf(i) },
      solution: ablesen(p, i, namen[sortiert.indexOf(i)]),
      hints: ABLESEN_HILFEN,
      errorMap: falsch.flatMap((f) => (sortiert.includes(f.bei) ? [{ answer: String(sortiert.indexOf(f.bei)), label: f.label }] : [])).filter((e, k, all) => all.findIndex((x) => x.answer === e.answer) === k),
    });
  }
  const richtig = antwortBei(p, i);
  const fehler = fehlerOhne(richtig, [...p.fehler(i), ...auchRichtig(p, i).map((x) => ({ answer: x, label: "" }))]).filter((f) => f.label);
  const figur = strahlFigur(s, [{ name: "A", bei: i }]);
  const prompt = `${welche} bei A markiert?${form}`;
  if (format === "mc") {
    const nachbarn = [i - 1, i + 1, i + 2, i - 2].filter((k) => k >= 0 && k <= s.schritte).map((k) => antwortBei(p, k));
    const m = auswahl(rng, richtig, fehler, nachbarn);
    // beim Ankreuzen wird nichts geschrieben: die Form steht in der Frage
    const frage = p.frage === "gemischt" ? "Welche gemischte Zahl ist bei A markiert?" : prompt;
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution: ablesen(p, i, "A"), hints: ABLESEN_HILFEN, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", {
    prompt,
    figur,
    answer: { accepted: [richtig, ...auchRichtig(p, i)], mode: "value" },
    solution: ablesen(p, i, "A"),
    hints: ABLESEN_HILFEN,
    errorMap: fehler,
  });
}

const frei = (s: Strahl, nurWo: (i: number) => boolean = () => true) =>
  Array.from({ length: s.schritte - 1 }, (_, k) => k + 1).filter((i) => !s.beschriftet.includes(i) && nurWo(i));
const ganz = (z: number): Bruch => ({ z, n: 1 });

/** Fehler: jeden Teilstrich als 1 gezählt (der Strich nach 300 als 301 statt 310). */
function alsEinsGezaehlt(s: Strahl, i: number, label = "Jeden Teilstrich als 1 gezählt"): Fehler | null {
  if (s.schritt.n !== 1 || s.schritt.z === 1) return null;
  const L = linkesLabel(s, i);
  return { answer: zahl(wert(s, L) + (i - L)), label };
}
const verzaehlt = (s: Strahl, i: number): Fehler[] =>
  [i + 1, i - 1].filter((k) => k >= 0 && k <= s.schritte).map((k) => ({ answer: zahlBei(s, k), label: "Um einen Teilstrich verzählt" }));
const nebenStellen = (s: Strahl, i: number) => [i + 1, i - 1].filter((k) => k > 0 && k < s.schritte).map((bei) => ({ bei, label: "Um einen Teilstrich verzählt" }));

function planVsZahlenstrahl(lv: number, rng: Rng): StrahlPlan {
  const s: Strahl =
    lv === 0
      ? { start: 0, schritt: ganz(1), schritte: 20, beschriftet: [0, 5, 10, 15, 20], format: "ganz" }
      : lv === 1
        ? { start: 10 * rint(rng, 0, 8), schritt: ganz(1), schritte: 20, beschriftet: [0, 10, 20], format: "ganz" }
        : lv === 2
          ? { start: 100 * rint(rng, 0, 9), schritt: ganz(10), schritte: 10, beschriftet: [0, 5, 10], format: "ganz" }
          : rng() < 0.5
            ? { start: 1000 * rint(rng, 0, 8), schritt: ganz(100), schritte: 10, beschriftet: [0, 5, 10], format: "ganz" }
            : { start: 100 * rint(rng, 1, 9), schritt: ganz(5), schritte: 20, beschriftet: [0, 10, 20], format: "ganz" };
  return {
    strahl: s,
    frei: frei(s),
    frage: "zahl",
    fehler: (i) => [alsEinsGezaehlt(s, i), ...verzaehlt(s, i)],
    falscheStellen: (i) => nebenStellen(s, i),
    buchstaben: true,
  };
}

function planGrosseZahlen(lv: number, rng: Rng): StrahlPlan {
  const s: Strahl =
    lv === 0
      ? { start: 0, schritt: ganz(1000), schritte: 10, beschriftet: [0, 5, 10], format: "ganz" }
      : lv === 1
        ? { start: 10_000 * rint(rng, 1, 9), schritt: ganz(1000), schritte: 10, beschriftet: [0, 10], format: "ganz" }
        : lv === 2
          ? { start: 1_000_000 * rint(rng, 0, 6), schritt: ganz(100_000), schritte: 10, beschriftet: [0, 5, 10], format: "ganz" }
          : { start: 1_000_000 * rint(rng, 1, 8), schritt: ganz(50_000), schritte: 20, beschriftet: [0, 10, 20], format: "ganz" };
  return {
    strahl: s,
    frei: frei(s),
    frage: "zahl",
    fehler: (i) => [alsEinsGezaehlt(s, i, "Einteilung nicht geprüft (ein Teilstrich als 1 gezählt)"), ...verzaehlt(s, i)],
    falscheStellen: (i) => nebenStellen(s, i),
    buchstaben: true,
  };
}

/** Fehler und falsche Stellen bei Zahlen mit Vorzeichen: Vorzeichen vergessen, in die falsche Richtung gezählt. */
function vorzeichenFehler(p: Pick<StrahlPlan, "strahl" | "frage">, i: number): Fehler[] {
  const s = p.strahl;
  const v = wertBei(s, i);
  const L = nachbarLabel(s, i);
  const lw = wertBei(s, L);
  const text = (b: Bruch) => (s.format === "bruch" ? bruchText(b) : zahl(bruchWert(b)));
  const out: Fehler[] = [];
  if (v.z !== 0) out.push({ answer: text({ z: -v.z, n: v.n }), label: "Vorzeichen vergessen" });
  const spiegel = kuerzen({ z: 2 * lw.z * v.n - v.z * lw.n, n: lw.n * v.n });
  if (L !== i) out.push({ answer: text(spiegel), label: "In die falsche Richtung gezählt" });
  return out;
}
function vorzeichenStellen(s: Strahl, i: number): { bei: number; label: string }[] {
  const v = wert(s, i);
  const L = nachbarLabel(s, i);
  const out: { bei: number; label: string }[] = [];
  const gegen = imStrahl(s, -v);
  if (gegen !== null) out.push({ bei: gegen, label: "Vorzeichen verwechselt" });
  const sp = imStrahl(s, 2 * wert(s, L) - v);
  if (sp !== null && L !== i) out.push({ bei: sp, label: "In die falsche Richtung gezählt" });
  return [...out, ...nebenStellen(s, i)];
}

function planZahlengerade(lv: number): StrahlPlan {
  const s: Strahl =
    lv === 0
      ? { start: -10, schritt: ganz(1), schritte: 20, beschriftet: [0, 5, 10, 15, 20], format: "ganz" }
      : lv === 1
        ? { start: -10, schritt: ganz(1), schritte: 20, beschriftet: [0, 10, 20], format: "ganz" }
        : lv === 2
          ? { start: -20, schritt: ganz(2), schritte: 20, beschriftet: [0, 5, 10, 15, 20], format: "ganz" }
          : { start: -50, schritt: ganz(5), schritte: 20, beschriftet: [0, 10, 20], format: "ganz" };
  const p: StrahlPlan = {
    strahl: s,
    // gefragt wird vor allem nach negativen Zahlen
    frei: frei(s, (i) => wert(s, i) !== 0),
    frage: "zahl",
    fehler: (i) => [...vorzeichenFehler(p, i), alsEinsGezaehlt(s, i)],
    falscheStellen: (i) => vorzeichenStellen(s, i),
    buchstaben: true,
  };
  return p;
}

function planRational(lv: number): StrahlPlan {
  const s: Strahl =
    lv === 0
      ? { start: -3, schritt: { z: 1, n: 2 }, schritte: 12, beschriftet: [0, 2, 4, 6, 8, 10, 12], format: "dezimal" }
      : lv === 1
        ? { start: -2, schritt: { z: 1, n: 4 }, schritte: 16, beschriftet: [0, 4, 8, 12, 16], format: "bruch" }
        : lv === 2
          ? { start: -1, schritt: { z: 1, n: 10 }, schritte: 20, beschriftet: [0, 5, 10, 15, 20], format: "dezimal" }
          : { start: -2, schritt: { z: 1, n: 3 }, schritte: 12, beschriftet: [0, 3, 6, 9, 12], format: "bruch" };
  const p: StrahlPlan = {
    strahl: s,
    frei: frei(s, (i) => wert(s, i) < 0 || i % 3 === 0),
    frage: s.format === "bruch" ? "bruch" : "zahl",
    fehler: (i) => vorzeichenFehler(p, i),
    falscheStellen: (i) => vorzeichenStellen(s, i),
    buchstaben: true,
  };
  return p;
}

function planDezimal(lv: number, rng: Rng): StrahlPlan {
  const n = rint(rng, 1, 8);
  const k = rint(rng, 0, 4) * 2;
  const s: Strahl =
    lv === 0
      ? { start: 0, schritt: { z: 1, n: 10 }, schritte: 20, beschriftet: [0, 10, 20], format: "dezimal" }
      : lv === 1
        ? { start: n, schritt: { z: 1, n: 10 }, schritte: 10, beschriftet: [0, 5, 10], format: "dezimal" }
        : lv === 2
          ? { start: runde(n + rint(rng, 0, 9) / 10, 1), schritt: { z: 1, n: 100 }, schritte: 10, beschriftet: [0, 5, 10], format: "dezimal" }
          : { start: runde(n + k / 10, 1), schritt: { z: 1, n: 100 }, schritte: 20, beschriftet: [0, 10, 20], format: "dezimal" };
  const anders = s.schritt.n === 10 ? 100 : 10;
  return {
    strahl: s,
    frei: frei(s),
    frage: "zahl",
    fehler: (i) => {
      const L = linkesLabel(s, i);
      return [{ answer: zahl(runde(wert(s, L) + (i - L) / anders, 4)), label: "Zehntel und Hundertstel verwechselt" }, ...verzaehlt(s, i)];
    },
    falscheStellen: (i) => nebenStellen(s, i),
    buchstaben: true,
  };
}

function planAnteile(lv: number, rng: Rng): StrahlPlan {
  const n = pick(rng, [[2, 3, 4, 5], [4, 5, 6, 8], [6, 8, 10, 12], [3, 4, 5, 6]][lv]);
  const ganze = lv === 3 ? 2 : 1;
  const s: Strahl = { start: 0, schritt: { z: 1, n }, schritte: n * ganze, beschriftet: Array.from({ length: ganze + 1 }, (_, k) => k * n), format: "bruch" };
  return {
    strahl: s,
    frei: frei(s),
    frage: "bruch",
    fehler: (i) => [
      { answer: bruchText({ z: n, n: i }), label: "Zähler und Nenner vertauscht" },
      { answer: bruchText({ z: i, n: n + 1 }), label: "Teilstriche statt Teilstücke gezählt" },
    ],
    falscheStellen: (i) => [...(n - i > 0 && n - i !== i ? [{ bei: n - i, label: "Von rechts statt von 0 aus gezählt" }] : []), ...nebenStellen(s, i)],
    buchstaben: true,
  };
}

function planVergleichen(lv: number, rng: Rng): StrahlPlan {
  const n = pick(rng, [[4, 6, 8], [6, 8, 10], [10, 12], [12]][lv]);
  const s: Strahl = { start: 0, schritt: { z: 1, n }, schritte: n, beschriftet: [0, n], format: "bruch" };
  // lieber Stellen, deren Bruch sich kürzen lässt (3/4 auf einem Zwölftel-Strahl)
  const kuerzbar = frei(s, (i) => gcd(i, n) > 1);
  return {
    strahl: s,
    frei: kuerzbar.length >= 4 ? kuerzbar : frei(s),
    frage: "bruch",
    fehler: (i) => [
      { answer: bruchText({ z: i, n: n + 1 }), label: "Teilstriche statt Teilstücke gezählt" },
      { answer: bruchText({ z: n, n: i }), label: "Zähler und Nenner vertauscht" },
    ],
    falscheStellen: (i) => {
      const z = kuerzen({ z: i, n }).z;
      return [...(z !== i && z > 0 && z < n ? [{ bei: z, label: "Nur den Zähler abgezählt" }] : []), ...nebenStellen(s, i)];
    },
    buchstaben: true,
  };
}

function planGemischt(lv: number, rng: Rng): StrahlPlan {
  const n = pick(rng, [[2, 4], [2, 3, 4], [3, 4, 5], [4, 5, 6, 8]][lv]);
  const ganze = n >= 6 ? 3 : lv >= 2 ? 4 : 3;
  const s: Strahl = { start: 0, schritt: { z: 1, n }, schritte: n * ganze, beschriftet: Array.from({ length: ganze + 1 }, (_, k) => k * n), format: "bruch" };
  return {
    strahl: s,
    frei: frei(s, (i) => i > n),
    frage: "gemischt",
    fehler: (i) => [
      { answer: bruchText({ z: i % n, n }), label: "Die Ganzen vergessen" },
      { answer: `${Math.floor(i / n)} ${i % n}/${n + 1}`, label: "Teilstriche statt Teilstücke gezählt" },
    ],
    falscheStellen: (i) => nebenStellen(s, i),
    buchstaben: false,
  };
}

/** Oberstufe: welches Intervall ist markiert? Voller Punkt gehört dazu, leerer nicht. */
function intervallAufgabe(skillId: string, diff: Difficulty, rng: Rng): TaskDraft {
  const lv = LEVEL[diff];
  const start = pick(rng, [-4, -3, -2]);
  const s: Strahl = { start, schritt: ganz(1), schritte: 12, beschriftet: Array.from({ length: 13 }, (_, k) => k), format: "ganz" };
  const strahl = lv >= 2 && rng() < 0.4 ? "strahl" : "strecke";
  let von: number | null = rint(rng, 1, 6);
  let bis: number | null = rint(rng, von + 2, 11);
  let vonDabei = rng() < 0.5;
  let bisDabei = rng() < 0.5;
  if (strahl === "strahl") {
    if (rng() < 0.5) {
      bis = null;
      bisDabei = false;
    } else {
      von = null;
      vonDabei = false;
    }
  }
  const a = von === null ? null : zahl(wert(s, von));
  const b = bis === null ? null : zahl(wert(s, bis));
  const schreib = (vd: boolean, bd: boolean, ende = false) =>
    a === null ? `]−∞; ${b}${bd ? "]" : "["}` : b === null ? `${vd ? "[" : "]"}${a}; ∞${ende ? "]" : "["}` : `${vd ? "[" : "]"}${a}; ${b}${bd ? "]" : "["}`;
  const richtig = schreib(vonDabei, bisDabei);
  const fehler: Fehler[] =
    a !== null && b !== null
      ? [
          { answer: schreib(!vonDabei, bisDabei), label: "Offene und geschlossene Klammer verwechselt" },
          { answer: schreib(vonDabei, !bisDabei), label: "Offene und geschlossene Klammer verwechselt" },
          { answer: schreib(!vonDabei, !bisDabei), label: "Offene und geschlossene Klammer verwechselt" },
        ]
      : a !== null
        ? [
            { answer: schreib(!vonDabei, false), label: "Offene und geschlossene Klammer verwechselt" },
            { answer: schreib(vonDabei, false, true), label: "Bei unendlich eine geschlossene Klammer gesetzt" },
            { answer: `]−∞; ${a}${vonDabei ? "]" : "["}`, label: "Die Richtung des Bereichs verwechselt" },
          ]
        : [
            { answer: schreib(false, !bisDabei), label: "Offene und geschlossene Klammer verwechselt" },
            { answer: `[−∞; ${b}${bisDabei ? "]" : "["}`, label: "Bei unendlich eine geschlossene Klammer gesetzt" },
            { answer: `${bisDabei ? "[" : "]"}${b}; ∞[`, label: "Die Richtung des Bereichs verwechselt" },
          ];
  const m = auswahl(rng, richtig, fehler);
  const rand = (x: string | null, dabei: boolean) => (x === null ? "" : `${x} ${dabei ? "gehört dazu (voller Punkt)" : "gehört nicht dazu (leerer Punkt)"}`);
  return aufgabe(skillId, diff, "mc", {
    prompt: "Welches Intervall ist auf der Zahlengeraden markiert?",
    figur: { art: "zahlenstrahl", ...s, marken: [], intervall: { von, bis, vonDabei, bisDabei } },
    data: { options: m.options },
    answer: { correct: m.correct },
    solution: [rand(a, vonDabei), rand(b, bisDabei), a === null || b === null ? "Bei unendlich ist die Klammer immer offen." : "", `Das Intervall ist ${richtig}.`].filter(Boolean).join("\n"),
    hints: ["Ein voller Punkt gehört zum Intervall, ein leerer nicht.", "Eckige Klammer nach innen [ heißt: der Rand gehört dazu."],
    errorMap: m.errorMap,
  });
}

// =====================================================================
// Koordinatensystem
// =====================================================================

type Fenster = Pick<Koordinaten, "x" | "y" | "einheit" | "zahlenAlle">;
function fensterFuer(lv: number): Fenster {
  return lv === 0
    ? { x: [0, 6], y: [0, 6], einheit: 1, zahlenAlle: 1 }
    : lv === 1
      ? { x: [-5, 5], y: [-5, 5], einheit: 1, zahlenAlle: 1 }
      : lv === 2
        ? { x: [-5, 5], y: [-5, 5], einheit: 2, zahlenAlle: 2 }
        : { x: [-6, 6], y: [-6, 6], einheit: 0.5, zahlenAlle: 2 };
}
const imFenster = (f: Fenster, x: number, y: number) =>
  x >= f.x[0] * f.einheit && x <= f.x[1] * f.einheit && y >= f.y[0] * f.einheit && y <= f.y[1] * f.einheit;
/** Ein Gitterpunkt nicht auf den Achsen (in Werten). */
function gitterpunkt(rng: Rng, f: Fenster): [number, number] {
  const k = (r: [number, number]) => {
    let v = 0;
    while (v === 0) v = rint(rng, Math.max(r[0], -5), Math.min(r[1], 5));
    return v * f.einheit;
  };
  return [k(f.x), k(f.y)];
}
const pt = (x: number, y: number) => `(${zahl(x)} | ${zahl(y)})`;
const quadrant = (x: number, y: number) => (x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2);
const QUADRANTEN = ["I. Quadrant", "II. Quadrant", "III. Quadrant", "IV. Quadrant"];
const KOORD_HILFEN = (f: Fenster) => [
  "Zuerst x: wie weit nach rechts (+) oder links (−)? Dann y: wie weit nach oben (+) oder unten (−)?",
  f.einheit === 1 ? "Ein Kästchen ist 1." : `Achte auf die Zahlen an den Achsen: ein Kästchen ist ${zahl(f.einheit)}.`,
];
const wegBeschreibung = (name: string, x: number, y: number) =>
  `${name}${pt(x, y)}: ${zahl(Math.abs(x))} nach ${x >= 0 ? "rechts" : "links"}, ${zahl(Math.abs(y))} nach ${y >= 0 ? "oben" : "unten"}.`;

function koordinatenAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  const f = fensterFuer(lv);
  const fig = (punkte: Koordinaten["punkte"]): Koordinaten => ({ art: "koordinaten", ...f, punkte, geraden: [] });
  if (format === "cloze") {
    let a = gitterpunkt(rng, f);
    let b = gitterpunkt(rng, f);
    for (let k = 0; k < 20 && (b[0] === a[0] || b[1] === a[1] || (b[0] === a[1] && b[1] === a[0])); k++) b = gitterpunkt(rng, f);
    if (lv === 3 && Number.isInteger(a[0]) && Number.isInteger(a[1])) a = [a[0] + (a[0] > 0 ? -0.5 : 0.5), a[1]];
    return aufgabe(skillId, diff, "cloze", {
      prompt: "Lies die Koordinaten der Punkte A und B ab.\nA( ___ | ___ )\nB( ___ | ___ )",
      figur: fig([{ name: "A", x: a[0], y: a[1] }, { name: "B", x: b[0], y: b[1] }]),
      answer: { blanks: [[zahl(a[0])], [zahl(a[1])], [zahl(b[0])], [zahl(b[1])]], mode: "value" },
      solution: `${wegBeschreibung("A", a[0], a[1])}\n${wegBeschreibung("B", b[0], b[1])}`,
      hints: KOORD_HILFEN(f),
    });
  }
  // ein Zielpunkt, dazu der Punkt mit vertauschten Koordinaten und einer mit falschem Vorzeichen
  // x und y nicht fast gleich: sonst liegt der Punkt mit vertauschten Koordinaten gleich daneben
  const fastGleich = (p: [number, number]) => Math.abs(Math.abs(p[0]) - Math.abs(p[1])) < 2 * f.einheit;
  let t = gitterpunkt(rng, f);
  for (let k = 0; k < 40 && fastGleich(t); k++) t = gitterpunkt(rng, f);
  if (Math.abs(t[0]) === Math.abs(t[1])) t = [t[0], t[1] + (t[1] > 0 ? -f.einheit : f.einheit) || f.einheit];
  if (format === "mc" && lv >= 1 && rng() < 0.5) {
    const q = quadrant(t[0], t[1]);
    const getauscht = quadrant(t[1], t[0]);
    const uhr = [0, 3, 2, 1][q];
    const errorMap = [
      ...(getauscht !== q ? [{ answer: String(getauscht), label: "x und y vertauscht" }] : []),
      ...(uhr !== q && uhr !== getauscht ? [{ answer: String(uhr), label: "Quadranten im Uhrzeigersinn gezählt" }] : []),
    ];
    return aufgabe(skillId, diff, "mc", {
      prompt: "In welchem Quadranten liegt der Punkt P?",
      figur: fig([{ name: "P", x: t[0], y: t[1] }]),
      data: { options: [...QUADRANTEN] },
      answer: { correct: q },
      solution: `${wegBeschreibung("P", t[0], t[1])}\nDie Quadranten werden gegen den Uhrzeigersinn gezählt, rechts oben ist der I. Quadrant.\nP liegt im ${QUADRANTEN[q]}.`,
      hints: ["Rechts oben ist der I. Quadrant, dann geht es gegen den Uhrzeigersinn weiter.", ...KOORD_HILFEN(f).slice(0, 1)],
      errorMap,
    });
  }
  const kandidaten: { p: [number, number]; label: string | null }[] = [{ p: t, label: null }];
  // zusätzliche Punkte (ohne typischen Fehler) mit Abstand zu den anderen, damit jeder Name eindeutig zu seinem Punkt gehört
  const weitWeg = (p: [number, number]) => kandidaten.every((k) => Math.max(Math.abs(k.p[0] - p[0]), Math.abs(k.p[1] - p[1])) >= 2 * f.einheit);
  const dazu = (p: [number, number], label: string | null, abstand = true) => {
    if (imFenster(f, p[0], p[1]) && p[0] !== 0 && p[1] !== 0 && !kandidaten.some((k) => k.p[0] === p[0] && k.p[1] === p[1]) && (label !== null || !abstand || weitWeg(p))) kandidaten.push({ p, label });
  };
  dazu([t[1], t[0]], "x und y vertauscht");
  dazu([-t[0], t[1]], "Bei negativen Werten in die falsche Richtung gegangen");
  dazu([t[0], -t[1]], "Bei negativen Werten in die falsche Richtung gegangen");
  for (let k = 0; k < 30 && kandidaten.length < 4; k++) dazu(gitterpunkt(rng, f), null);
  for (let k = 0; k < 30 && kandidaten.length < 4; k++) dazu(gitterpunkt(rng, f), null, false);
  const vier = kandidaten.slice(0, 4);
  const namen = shuffle(rng, ["A", "B", "C", "D"].slice(0, vier.length));
  const punkte = vier.map((k, i) => ({ name: namen[i], x: k.p[0], y: k.p[1] })).sort((a, b) => a.name.localeCompare(b.name));
  const ziel = namen[0];
  const prompt = `Welcher Punkt hat die Koordinaten ${pt(t[0], t[1])}?`;
  const solution = `${wegBeschreibung(ziel, t[0], t[1])}\nDer Punkt ist ${ziel}.`;
  if (format === "mc") {
    const options = punkte.map((p) => p.name);
    return aufgabe(skillId, diff, "mc", {
      prompt,
      figur: fig(punkte),
      data: { options },
      answer: { correct: options.indexOf(ziel) },
      solution,
      hints: KOORD_HILFEN(f),
      errorMap: vier.flatMap((k, i) => (k.label ? [{ answer: String(options.indexOf(namen[i])), label: k.label }] : [])).filter((e, i, all) => all.findIndex((x) => x.answer === e.answer) === i),
    });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", {
    prompt: `${prompt} Schreib den Buchstaben.`,
    figur: fig(punkte),
    answer: { accepted: [ziel], mode: "text" },
    solution,
    hints: KOORD_HILFEN(f),
    errorMap: vier.flatMap((k, i) => (k.label ? [{ answer: namen[i], label: k.label }] : [])).filter((e, i, all) => all.findIndex((x) => x.answer === e.answer) === i),
  });
}

// ---------- Geraden ----------

const FENSTER_G: Fenster = { x: [-6, 6], y: [-6, 6], einheit: 1, zahlenAlle: 1 };
/** Eine Gerade y = k·x + d, die durch mindestens zwei Gitterpunkte im Bild geht. */
function geradeWaehlen(lv: number, rng: Rng): { k: Bruch; d: number } {
  const ks: Bruch[] = [
    [{ z: 1, n: 1 }, { z: 2, n: 1 }, { z: -1, n: 1 }, { z: -2, n: 1 }],
    [{ z: 1, n: 1 }, { z: 2, n: 1 }, { z: 3, n: 1 }, { z: -1, n: 1 }, { z: -2, n: 1 }, { z: 1, n: 2 }, { z: -1, n: 2 }],
    [{ z: 2, n: 1 }, { z: -3, n: 1 }, { z: 1, n: 2 }, { z: -1, n: 2 }, { z: 1, n: 3 }, { z: 2, n: 3 }, { z: -2, n: 3 }, { z: 3, n: 2 }, { z: -3, n: 2 }],
    [{ z: 3, n: 4 }, { z: -3, n: 4 }, { z: 2, n: 3 }, { z: -2, n: 3 }, { z: 3, n: 2 }, { z: -3, n: 2 }, { z: 1, n: 3 }, { z: -2, n: 5 }],
  ][lv];
  for (let t = 0; t < 50; t++) {
    const k = pick(rng, ks);
    const d = rint(rng, -4, 4);
    if (Math.abs(d + k.z) <= 5 && k.n <= 5 && Math.abs(d - k.z) <= 5) return { k, d };
  }
  return { k: { z: 1, n: 2 }, d: 1 };
}
const kText = (k: Bruch) => bruchText(k);
/** Gitterpunkte der Geraden im Bild (x in Schritten des Nenners). */
function gitterAufGerade(k: Bruch, d: number): [number, number][] {
  const out: [number, number][] = [];
  for (let t = -6; t <= 6; t++) {
    const x = t * k.n;
    const y = d + t * k.z;
    if (Math.abs(x) <= 6 && Math.abs(y) <= 6) out.push([x, y]);
  }
  return out;
}
const steigungsdreieck = (k: Bruch, d: number) =>
  `d ist der Schnittpunkt mit der y-Achse: die Gerade geht durch (0 | ${zahl(d)}), also d = ${zahl(d)}.\nVon dort ${k.n} nach rechts und ${Math.abs(k.z)} nach ${k.z >= 0 ? "oben" : "unten"} ist wieder ein Gitterpunkt: k = ${k.n === 1 ? kText(k) : `${k.z < 0 ? "−" : ""}${Math.abs(k.z)} : ${k.n} = ${kText(k)}`}.`;

function lineareAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng, funktion = false): TaskDraft | null {
  const lv = LEVEL[diff];
  const { k, d } = geradeWaehlen(lv, rng);
  const kv = bruchWert(k);
  const name = funktion ? "f" : "g";
  const gl = (kk: Bruch, dd: number) => geradenText(kk, dd, funktion ? "f(x)" : "y");
  const figur = (punkte: Koordinaten["punkte"] = []): Koordinaten => ({ art: "koordinaten", ...FENSTER_G, punkte, geraden: [{ name, k, d }] });
  const hilfen = ["d liest du dort ab, wo die Gerade die y-Achse schneidet.", "Für k: geh vom Punkt auf der y-Achse 1 nach rechts (oder bis zum nächsten Gitterpunkt) und zähle, wie weit es hinauf oder hinunter geht."];
  const loesung = `${steigungsdreieck(k, d)}\nAlso ${gl(k, d)}.`;
  if (funktion && format !== "mc") {
    // Funktionswerte ablesen
    const punkte = gitterAufGerade(k, d).filter(([x]) => x !== 0);
    const [x1, y1] = pick(rng, punkte.length ? punkte : [[k.n, d + k.z] as [number, number]]);
    if (format === "cloze") {
      return aufgabe(skillId, diff, "cloze", {
        prompt: `Die Gerade ist der Graph der Funktion f. Lies die Funktionswerte ab.\nf(0) = ___\nf(${zahl(x1)}) = ___`,
        figur: figur(),
        answer: { blanks: [[zahl(d)], [zahl(y1)]], mode: "value" },
        solution: `Bei x = 0 schneidet der Graph die y-Achse bei ${zahl(d)}: f(0) = ${zahl(d)}.\nÜber x = ${zahl(x1)} liegt der Graph bei y = ${zahl(y1)}: f(${zahl(x1)}) = ${zahl(y1)}.`,
        hints: ["Geh auf der x-Achse zur Zahl in der Klammer und dann senkrecht bis zum Graphen.", "Der Funktionswert ist die y-Koordinate dieses Punktes."],
      });
    }
    if (format !== "calc") return null;
    const umgekehrt = gitterAufGerade(k, d).find(([, y]) => y === x1);
    return aufgabe(skillId, diff, "calc", {
      prompt: `Die Gerade ist der Graph der Funktion f. Lies den Funktionswert f(${zahl(x1)}) ab.`,
      figur: figur(),
      answer: { accepted: [zahl(y1)], mode: "value" },
      solution: `Über x = ${zahl(x1)} liegt der Graph bei y = ${zahl(y1)}, also f(${zahl(x1)}) = ${zahl(y1)}.`,
      hints: ["Geh auf der x-Achse zu x = " + zahl(x1) + " und dann senkrecht bis zum Graphen.", "Der Funktionswert ist die y-Koordinate dieses Punktes."],
      errorMap: fehlerOhne(zahl(y1), [umgekehrt ? { answer: zahl(umgekehrt[0]), label: "x und y vertauscht" } : null, { answer: zahl(-y1), label: "Vorzeichen falsch abgelesen" }]),
    });
  }
  if (format === "cloze") {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Die Gerade ${name} hat die Gleichung y = k · x + d. Lies k und d ab.\nk = ___\nd = ___`,
      figur: figur(),
      answer: { blanks: [[kText(k)], [zahl(d)]], mode: "value" },
      solution: loesung,
      hints: hilfen,
    });
  }
  if (format === "mc") {
    const fehler: Fehler[] = [
      { answer: gl({ z: -k.z, n: k.n }, d), label: "Vorzeichen der Steigung falsch" },
      ...(k.n === 1 && k.z !== d ? [{ answer: gl({ z: d, n: 1 }, k.z), label: "k und d vertauscht" }] : []),
      ...(Math.abs(k.z) !== k.n ? [{ answer: gl({ z: k.n * Math.sign(k.z), n: Math.abs(k.z) }, d), label: "Steigung verkehrt berechnet (Unterschied in x durch Unterschied in y)" }] : []),
      ...(d !== 0 ? [{ answer: gl(k, -d), label: "d mit falschem Vorzeichen abgelesen" }] : []),
    ];
    const m = auswahl(rng, gl(k, d), shuffle(rng, fehler), [gl(k, d + 1), gl(k, d - 1)]);
    return aufgabe(skillId, diff, "mc", {
      prompt: funktion ? "Welche Funktionsgleichung gehört zum Graphen von f?" : `Welche Gleichung gehört zur Geraden ${name}?`,
      figur: figur(),
      data: { options: m.options },
      answer: { correct: m.correct },
      solution: loesung,
      hints: hilfen,
      errorMap: m.errorMap,
    });
  }
  if (format === "rechenweg") {
    // zwei Gitterpunkte P und Q sind markiert, k wird aus ihnen berechnet
    const gp = gitterAufGerade(k, d);
    if (gp.length < 2) return null;
    const i = rint(rng, 0, gp.length - 2);
    const j = rint(rng, i + 1, gp.length - 1);
    const [[x1, y1], [x2, y2]] = [gp[i], gp[j]];
    const dy = y2 - y1;
    const dx = x2 - x1;
    const zeile = `k = (${zahl(y2)} − ${br(y1)}) : (${zahl(x2)} − ${br(x1)}) = ${zahl(dy)} : ${zahl(dx)} = ${kText(k)}`;
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `Die Punkte P und Q liegen auf der Geraden ${name}. Lies ihre Koordinaten ab und berechne damit die Steigung k. ${WEG}`,
      figur: figur([{ name: "P", x: x1, y: y1 }, { name: "Q", x: x2, y: y2 }]),
      answer: { accepted: [kText(k)], unit: null, form: null, needWay: true },
      solution: `P${pt(x1, y1)} und Q${pt(x2, y2)}\nk = (y von Q − y von P) : (x von Q − x von P)\n${zeile}`,
      steps: [zeile],
      hints: ["Lies zuerst P und Q ab.", "k = Unterschied in y : Unterschied in x", `k = (${zahl(y2)} − ${br(y1)}) : (${zahl(x2)} − ${br(x1)})`],
      errorMap: Math.abs(k.z) !== k.n ? [{ answer: bruchText({ z: dx * Math.sign(dy || 1), n: Math.abs(dy) || 1 }), label: "Steigung verkehrt berechnet (Unterschied in x durch Unterschied in y)" }] : [],
    });
  }
  if (format !== "calc") return null;
  if (rng() < 0.5) {
    return aufgabe(skillId, diff, "calc", {
      prompt: `Lies die Steigung k der Geraden ${name} ab.`,
      figur: figur(),
      answer: { accepted: [kText(k)], mode: "value" },
      solution: steigungsdreieck(k, d),
      hints: hilfen.slice(1),
      errorMap: fehlerOhne(kText(k), [
        Math.abs(k.z) !== k.n ? { answer: bruchText({ z: k.n * Math.sign(k.z), n: Math.abs(k.z) }), label: "Steigung verkehrt berechnet (Unterschied in x durch Unterschied in y)" } : null,
        { answer: kText({ z: -k.z, n: k.n }), label: "Vorzeichen der Steigung falsch" },
        { answer: zahl(d), label: "k und d vertauscht" },
      ]),
    });
  }
  const nullstelle = kv !== 0 ? -d / kv : null;
  return aufgabe(skillId, diff, "calc", {
    prompt: `Lies d ab: Wo schneidet die Gerade ${name} die y-Achse?`,
    figur: figur(),
    answer: { accepted: [zahl(d)], mode: "value" },
    solution: `Die Gerade schneidet die y-Achse im Punkt (0 | ${zahl(d)}), also d = ${zahl(d)}.`,
    hints: hilfen.slice(0, 1),
    errorMap: fehlerOhne(zahl(d), [
      nullstelle !== null && Number.isInteger(nullstelle) ? { answer: zahl(nullstelle), label: "Schnittpunkt mit der x-Achse statt mit der y-Achse" } : null,
      { answer: kText(k), label: "k und d vertauscht" },
      { answer: zahl(-d), label: "d mit falschem Vorzeichen abgelesen" },
    ]),
  });
}

function gleichungssystemAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  const ks: Bruch[] = lv <= 1 ? [{ z: 1, n: 1 }, { z: -1, n: 1 }, { z: 2, n: 1 }, { z: -2, n: 1 }, { z: 0, n: 1 }] : [{ z: 1, n: 1 }, { z: -1, n: 1 }, { z: 2, n: 1 }, { z: -2, n: 1 }, { z: 1, n: 2 }, { z: -1, n: 2 }, { z: 3, n: 1 }];
  let g = { k: ks[0], d: 0 };
  let h = { k: ks[1], d: 0 };
  let s: [number, number] = [1, 1];
  for (let t = 0; t < 80; t++) {
    s = [rint(rng, -4, 4), rint(rng, -4, 4)];
    const [k1, k2] = shuffle(rng, ks).slice(0, 2);
    if (bruchWert(k1) === bruchWert(k2)) continue;
    const d1 = s[1] - bruchWert(k1) * s[0];
    const d2 = s[1] - bruchWert(k2) * s[0];
    if (!Number.isInteger(d1) || !Number.isInteger(d2) || Math.abs(d1) > 5 || Math.abs(d2) > 5 || s[0] === s[1]) continue;
    g = { k: k1, d: d1 };
    h = { k: k2, d: d2 };
    break;
  }
  const figur: Koordinaten = { art: "koordinaten", ...FENSTER_G, punkte: [], geraden: [{ name: "g", ...g }, { name: "h", ...h }] };
  const prompt = `Die Geraden g und h sind gezeichnet:\ng: ${geradenText(g.k, g.d)}\nh: ${geradenText(h.k, h.d)}\nLies die Lösung des Gleichungssystems am Schnittpunkt ab.`;
  const solution = `Die Geraden schneiden einander im Punkt S${pt(s[0], s[1])}.\nProbe: ${geradenText(g.k, g.d).replace("y = ", `${zahl(s[1])} = `).replace(/x/g, `· ${br(s[0])}`).replace("· ·", "·")} stimmt, ebenso bei h.\nLösung: x = ${zahl(s[0])}, y = ${zahl(s[1])}.`;
  const hilfen = ["Die Lösung ist der Punkt, an dem sich die beiden Geraden schneiden.", "Lies zuerst x (waagrecht), dann y (senkrecht) ab."];
  if (format === "cloze")
    return aufgabe(skillId, diff, "cloze", { prompt: `${prompt}\nx = ___\ny = ___`, figur, answer: { blanks: [[zahl(s[0])], [zahl(s[1])]], mode: "value" }, solution, hints: hilfen });
  if (format === "mc") {
    const m = auswahl(rng, `x = ${zahl(s[0])}, y = ${zahl(s[1])}`, [
      { answer: `x = ${zahl(s[1])}, y = ${zahl(s[0])}`, label: "x und y vertauscht" },
      { answer: `x = 0, y = ${zahl(g.d)}`, label: "Schnittpunkt mit der y-Achse statt Schnittpunkt der Geraden" },
      { answer: `x = ${zahl(-s[0])}, y = ${zahl(s[1])}`, label: "Vorzeichen falsch abgelesen" },
    ], [`x = ${zahl(s[0])}, y = ${zahl(s[1] + 1)}`, `x = ${zahl(s[0] + 1)}, y = ${zahl(s[1])}`, `x = ${zahl(s[0] - 1)}, y = ${zahl(s[1] - 1)}`]);
    return aufgabe(skillId, diff, "mc", { prompt, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", {
    prompt: `${prompt}\nWelchen x-Wert hat der Schnittpunkt?`,
    figur,
    answer: { accepted: [zahl(s[0])], mode: "value" },
    solution,
    hints: hilfen,
    errorMap: fehlerOhne(zahl(s[0]), [{ answer: zahl(s[1]), label: "x und y vertauscht" }, { answer: zahl(-s[0]), label: "Vorzeichen falsch abgelesen" }]),
  });
}

// =====================================================================
// Figuren: Umfang, Flächeninhalt, Pythagoras
// =====================================================================

const rechteckFigur = (a: number, b: number, e: string, extra: Partial<Flaeche> = {}, quadrat = false): Flaeche => ({
  art: "figur",
  form: quadrat ? "quadrat" : "rechteck",
  ecken: [[0, 0], [a, 0], [a, b], [0, b]],
  seiten: quadrat ? [{ von: 0, text: `a = ${zahl(a)} ${e}` }] : [{ von: 0, text: `a = ${zahl(a)} ${e}` }, { von: 1, text: `b = ${zahl(b)} ${e}` }],
  rechteWinkel: [0],
  ...extra,
});

/** Einheit und Seitenlängen eines Rechtecks je Stufe; Verhältnis höchstens etwa 3 : 1. */
function rechteckMasse(lv: number, rng: Rng): { a: number; b: number; e: string; quadrat: boolean } {
  for (let t = 0; t < 40; t++) {
    const quadrat = lv <= 1 && rng() < 0.25;
    const e = lv >= 3 || (lv === 1 && rng() < 0.3) ? "m" : "cm";
    const a = lv === 0 ? rint(rng, 3, 9) : lv === 1 ? rint(rng, 4, 15) : lv === 2 ? rint(rng, 5, 19) / 2 : rint(rng, 8, 30);
    const b = quadrat ? a : lv === 0 ? rint(rng, 2, 8) : lv === 1 ? rint(rng, 3, 12) : lv === 2 ? rint(rng, 2, 9) : rint(rng, 8, 30) / 2;
    // Umfang und Flächeninhalt sollen nicht dieselbe Zahl sein (sonst fällt die Verwechslung nicht auf)
    if ((!quadrat && (a === b || a / b > 3 || b / a > 3)) || Math.abs(2 * a + 2 * b - a * b) < 1e-9) continue;
    return { a: Math.max(a, b), b: Math.min(a, b), e, quadrat };
  }
  return { a: 6, b: 4, e: "cm", quadrat: false };
}

function rechteckAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") {
    // Beet mit Zaun: Umfang, Fläche, dann ein Quadrat mit gleichem Umfang
    let a = 6;
    let b = 4;
    for (let t = 0; t < 30; t++) {
      a = rint(rng, 4, lv >= 2 ? 16 : 10);
      b = rint(rng, 2, a - 1);
      if ((a + b) % 2 === 0 && a / b <= 3) break;
    }
    const u = 2 * a + 2 * b;
    const A = a * b;
    const parts: (PartView & PartSolution)[] = [
      { label: "a)", prompt: "Wie viele Meter Zaun braucht man rund um das Beet?", kind: "zahl", accepted: [`${zahl(u)} m`], unit: "m", solution: `u = 2 · ${a} m + 2 · ${b} m = ${zahl(u)} m`, errorMap: [{ answer: `${zahl(a + b)} m`, label: "Beim Umfang nur a + b gerechnet" }] },
      { label: "b)", prompt: "Wie groß ist die Fläche des Beets?", kind: "zahl", accepted: [`${zahl(A)} m²`], unit: "m²", solution: `A = ${a} m · ${b} m = ${zahl(A)} m²`, errorMap: [{ answer: `${zahl(u)} m²`, label: "Umfang statt Flächeninhalt berechnet" }] },
      { label: "c)", prompt: "Ein quadratisches Beet braucht gleich viel Zaun. Wie lang ist eine Seite? Rechne mit deinem Ergebnis aus a).", kind: "zahl", accepted: [`${zahl(u / 4)} m`], unit: "m", follow: "a / 4", solution: `${zahl(u)} m : 4 = ${zahl(u / 4)} m` },
    ];
    return {
      type: "sachaufgabe",
      skillId,
      skillIds: [skillId],
      category: "sachaufgabe",
      difficulty: diff,
      prompt: `Ein rechteckiges Beet ist ${a} m lang und ${b} m breit. Rundherum soll ein Zaun kommen.`,
      data: { parts: parts.map(({ label, prompt, kind }) => ({ label, prompt, kind })), figure: rechteckFigur(a, b, "m") },
      answer: { parts: parts.map(({ accepted, unit, follow, solution, errorMap }) => ({ accepted, unit: unit ?? null, follow: follow ?? null, solution, errorMap })) },
      solution: parts.map((p) => `${p.label} ${p.solution}`).join("\n"),
      hints: ["Der Zaun geht einmal rundherum: das ist der Umfang.", "Ein Quadrat hat vier gleich lange Seiten."],
      errorMap: [],
      estimatedTimeSec: 360,
    };
  }
  const { a, b, e, quadrat } = rechteckMasse(lv, rng);
  const u = runde(2 * a + 2 * b);
  const A = runde(a * b);
  const fig = rechteckFigur(a, b, e, {}, quadrat);
  const name = quadrat ? "Quadrats" : "Rechtecks";
  const uWeg = quadrat ? `u = 4 · ${zahl(a)} = ${zahl(u)}` : `u = 2 · ${zahl(a)} + 2 · ${zahl(b)} = ${zahl(u)}`;
  const aWeg = quadrat ? `A = ${zahl(a)} · ${zahl(a)} = ${zahl(A)}` : `A = ${zahl(a)} · ${zahl(b)} = ${zahl(A)}`;
  const hilfenA = ["Der Flächeninhalt sagt, wie viele Quadrate mit 1 " + e + " Seitenlänge hineinpassen.", quadrat ? "A = a · a" : "A = a · b"];
  const hilfenU = ["Der Umfang ist der Weg einmal rundherum.", quadrat ? "u = 4 · a" : "u = 2 · a + 2 · b"];
  if (format === "cloze") {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Berechne Umfang und Flächeninhalt des ${name}.\nu = ___ ${e}\nA = ___ ${e}²`,
      figur: fig,
      answer: { blanks: [[zahl(u)], [zahl(A)]], mode: "value" },
      solution: `${uWeg} ${e}\n${aWeg} ${e}²`,
      hints: [hilfenU[1], hilfenA[1]],
    });
  }
  const flaeche = rng() < 0.55;
  if (format === "rechenweg") {
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `Berechne ${flaeche ? "den Flächeninhalt" : "den Umfang"} des ${name}. ${WEG}`,
      figur: fig,
      answer: { accepted: [`${zahl(flaeche ? A : u)} ${flaeche ? `${e}²` : e}`], unit: flaeche ? `${e}²` : e, form: null, needWay: true },
      solution: `${flaeche ? aWeg : uWeg} ${flaeche ? `${e}²` : e}`,
      steps: [flaeche ? aWeg : uWeg],
      hints: flaeche ? hilfenA : hilfenU,
      errorMap: fehlerOhne(roh(flaeche ? A : u), flaeche ? [{ answer: roh(u), label: "Umfang statt Flächeninhalt berechnet" }] : [{ answer: roh(runde(a + b)), label: "Beim Umfang nur a + b gerechnet" }]).map((f) => ({ ...f, answer: `${f.answer} ${flaeche ? `${e}²` : e}` })),
    });
  }
  const richtig = flaeche ? zahl(A) : zahl(u);
  const einheit = flaeche ? `${e}²` : e;
  const fehler = fehlerOhne(
    richtig,
    flaeche
      ? [{ answer: zahl(u), label: "Umfang statt Flächeninhalt berechnet" }, { answer: zahl(runde(a + b)), label: "Seitenlängen addiert statt multipliziert" }]
      : [{ answer: zahl(A), label: "Flächeninhalt statt Umfang berechnet" }, { answer: zahl(runde(a + b)), label: "Beim Umfang nur a + b gerechnet" }],
  );
  const prompt = `Berechne ${flaeche ? "den Flächeninhalt" : "den Umfang"} des ${name}.`;
  const solution = `${flaeche ? aWeg : uWeg} ${einheit}`;
  if (format === "mc") {
    const m = auswahl(
      rng,
      `${richtig} ${einheit}`,
      fehler.map((f) => ({ ...f, answer: `${f.answer} ${einheit}` })),
      [`${zahl(runde((flaeche ? A : u) * 2))} ${einheit}`, `${zahl(runde((flaeche ? A : u) + 2))} ${einheit}`],
    );
    return aufgabe(skillId, diff, "mc", { prompt, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: flaeche ? hilfenA : hilfenU, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${prompt} Gib das Ergebnis in ${einheit} an.`, figur: fig, answer: { accepted: mitEinheit(richtig, einheit), mode: "value" }, solution, hints: flaeche ? hilfenA : hilfenU, errorMap: fehler });
}

function dreieckAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  const e = "cm";
  if (format === "sachaufgabe") return null;
  let fig: Flaeche;
  let grund: number;
  let hoehe: number;
  let schraeg: number | null = null;
  let weg: string;
  if (lv === 0) {
    // rechtwinkeliges Dreieck: die Katheten sind Grundlinie und Höhe
    for (;;) {
      grund = rint(rng, 3, 10);
      hoehe = rint(rng, 2, 8);
      if ((grund * hoehe) % 2 === 0 && grund !== hoehe && grund / hoehe <= 3 && hoehe / grund <= 3) break;
    }
    fig = { art: "figur", form: "rechtwinklig", ecken: [[0, 0], [grund, 0], [0, hoehe]], seiten: [{ von: 0, text: `a = ${grund} ${e}` }, { von: 2, text: `b = ${hoehe} ${e}` }], rechteWinkel: [0] };
    weg = `A = a · b : 2 = ${grund} · ${hoehe} : 2 = ${zahl(runde((grund * hoehe) / 2))}`;
  } else {
    for (;;) {
      grund = lv === 3 ? rint(rng, 9, 25) / 2 : rint(rng, 4, 12);
      hoehe = rint(rng, 3, 9);
      if ((lv === 3 || (grund * hoehe) % 2 === 0) && grund / hoehe <= 2.8 && hoehe / grund <= 1.6) break;
    }
    const p = runde(grund * pick(rng, [0.3, 0.4, 0.6, 0.7]), 1);
    const ecken: Punkt2[] = [[0, 0], [grund, 0], [p, hoehe]];
    if (lv >= 2) schraeg = runde(Math.hypot(grund - p, hoehe), 1);
    fig = {
      art: "figur",
      form: "dreieck",
      ecken,
      namen: ["A", "B", "C"],
      seiten: [{ von: 0, text: `c = ${zahl(grund)} ${e}` }, ...(schraeg !== null ? [{ von: 1, text: `a = ${zahl(schraeg)} ${e}` }] : [])],
      strecken: [{ von: [p, hoehe], bis: [p, 0], text: `h = ${hoehe} ${e}`, gestrichelt: true, rechterWinkel: true }],
    };
    weg = `A = c · h : 2 = ${zahl(grund)} · ${hoehe} : 2 = ${zahl(runde((grund * hoehe) / 2))}`;
  }
  const A = runde((grund * hoehe) / 2);
  const richtig = zahl(A);
  const fehler = fehlerOhne(richtig, [
    { answer: zahl(runde(grund * hoehe)), label: "Durch 2 vergessen" },
    schraeg !== null ? { answer: zahl(runde((grund * schraeg) / 2)), label: "Eine schräge Seite statt der Höhe genommen" } : null,
  ]);
  const hilfen = ["Ein Dreieck ist ein halbes Rechteck.", lv === 0 ? "A = a · b : 2" : "A = c · h : 2, die Höhe steht normal auf die Grundlinie."];
  const prompt = "Berechne den Flächeninhalt des Dreiecks.";
  if (format === "cloze") return aufgabe(skillId, diff, "cloze", { prompt: `${prompt}\nA = ___ ${e}²`, figur: fig, answer: { blanks: [[richtig]], mode: "value" }, solution: `${weg} ${e}²`, hints: hilfen, errorMap: fehler });
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", { prompt: `${prompt} ${WEG}`, figur: fig, answer: { accepted: [`${richtig} ${e}²`], unit: `${e}²`, form: null, needWay: true }, solution: `${weg} ${e}²`, steps: [zahlenWeg(weg)], hints: hilfen, errorMap: fehler.map((f) => ({ ...f, answer: `${f.answer} ${e}²` })) });
  if (format === "mc") {
    const m = auswahl(rng, `${richtig} ${e}²`, fehler.map((f) => ({ ...f, answer: `${f.answer} ${e}²` })), [`${zahl(runde(A + grund))} ${e}²`, `${zahl(runde(grund + hoehe))} ${e}²`]);
    return aufgabe(skillId, diff, "mc", { prompt, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution: `${weg} ${e}²`, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${prompt} Gib das Ergebnis in ${e}² an.`, figur: fig, answer: { accepted: mitEinheit(richtig, `${e}²`), mode: "value" }, solution: `${weg} ${e}²`, hints: hilfen, errorMap: fehler });
}

/** L-Form: Rechteck W × H, rechts oben fehlt ein Stück w × h. */
function lMasse(vs: boolean, lv: number, rng: Rng) {
  for (;;) {
    const W = vs ? rint(rng, 5, 10) : lv >= 2 ? rint(rng, 8, 16) : rint(rng, 6, 12);
    const H = vs ? rint(rng, 4, 8) : lv >= 2 ? rint(rng, 6, 12) : rint(rng, 5, 10);
    const w = rint(rng, 2, W - 2);
    const h = rint(rng, 2, H - 2);
    if (W / H <= 2.2 && H / W <= 1.6) return { W, H, w, h };
  }
}
function lFigur(W: number, H: number, w: number, h: number, e: string, alleSeiten: boolean, x?: "w" | "h"): Flaeche {
  const t = (v: number) => `${zahl(v)} ${e}`;
  const seiten: Flaeche["seiten"] = [
    { von: 0, text: t(W) },
    { von: 1, text: t(H - h) },
    ...(alleSeiten || x === "w" ? [{ von: 2, text: x === "w" ? "x" : t(w), ...(x === "w" ? { loesung: `x = ${t(w)}` } : {}) }] : []),
    ...(alleSeiten || x === "h" ? [{ von: 3, text: x === "h" ? "x" : t(h), ...(x === "h" ? { loesung: `x = ${t(h)}` } : {}) }] : []),
    { von: 4, text: t(W - w) },
    { von: 5, text: t(H) },
  ];
  return { art: "figur", form: "l-form", ecken: [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]], seiten, rechteWinkel: [0] };
}

function zusammengesetztAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng, vs: boolean): TaskDraft | null {
  const lv = LEVEL[diff];
  const { W, H, w, h } = lMasse(vs, lv, rng);
  const e = vs ? "cm" : format === "sachaufgabe" ? "m" : rng() < 0.6 ? "cm" : "m";
  const alle = vs ? lv <= 1 : lv === 0;
  const u = 2 * W + 2 * H;
  const A = W * H - w * h;
  const A1 = W * (H - h);
  const A2 = (W - w) * h;
  const fig = lFigur(W, H, w, h, e, alle);
  const uWeg = `u = ${W} + ${H - h} + ${w} + ${h} + ${W - w} + ${H} = ${u}`;
  const aWeg = `A = ${W} · ${H - h} + ${W - w} · ${h} = ${A1} + ${A2} = ${A}`;
  const fehlendeSeiten = alle ? "" : `Die fehlenden Seiten: ${W} − ${W - w} = ${w} und ${H} − ${H - h} = ${h}.\n`;
  const hilfenA = ["Zerlege die Figur in zwei Rechtecke.", "Berechne beide Flächen und zähle sie zusammen."];
  const hilfenU = ["Der Umfang ist der Weg einmal rundherum, nur außen.", alle ? "Zähle alle sechs Seiten zusammen." : "Zwei Seiten fehlen: rechne sie aus den anderen aus."];
  const uFehler = { answer: String(2 * (W + H - h) + 2 * (W - w + h)), label: "Die Umfänge der Teilfiguren addiert" };
  const aFehler = { answer: String(W * H), label: "Das fehlende Stück nicht abgezogen" };
  if (format === "sachaufgabe") {
    if (vs) return null;
    const x: "w" | "h" = rng() < 0.5 ? "w" : "h";
    const xv = x === "w" ? w : h;
    const parts: (PartView & PartSolution)[] = [
      { label: "a)", prompt: "Wie lang ist die Seite x?", kind: "zahl", accepted: [`${xv} ${e}`], unit: e, solution: x === "w" ? `x = ${W} ${e} − ${W - w} ${e} = ${w} ${e}` : `x = ${H} ${e} − ${H - h} ${e} = ${h} ${e}` },
      { label: "b)", prompt: "Berechne den Umfang der Figur.", kind: "zahl", accepted: [`${u} ${e}`], unit: e, solution: `u = 2 · ${W} ${e} + 2 · ${H} ${e} = ${u} ${e}`, errorMap: [{ answer: `${uFehler.answer} ${e}`, label: uFehler.label }] },
      { label: "c)", prompt: "Berechne den Flächeninhalt der Figur.", kind: "zahl", accepted: [`${A} ${e}²`], unit: `${e}²`, solution: `A = ${W} ${e} · ${H - h} ${e} + ${W - w} ${e} · ${h} ${e} = ${A} ${e}²`, errorMap: [{ answer: `${aFehler.answer} ${e}²`, label: aFehler.label }] },
    ];
    return {
      type: "sachaufgabe",
      skillId,
      skillIds: [skillId],
      category: "sachaufgabe",
      difficulty: diff,
      prompt: `Ein Grundstück hat die Form im Bild. Alle Ecken sind rechte Winkel.`,
      data: { parts: parts.map(({ label, prompt, kind }) => ({ label, prompt, kind })), figure: lFigur(W, H, w, h, e, false, x) },
      answer: { parts: parts.map(({ accepted, unit, solution, errorMap }) => ({ accepted, unit: unit ?? null, follow: null, solution, errorMap })) },
      solution: parts.map((p) => `${p.label} ${p.solution}`).join("\n"),
      hints: ["x ergibt sich aus der ganzen Seite minus dem Teil, der gegeben ist.", ...hilfenA.slice(0, 1)],
      errorMap: [],
      estimatedTimeSec: 420,
    };
  }
  if (format === "cloze")
    return aufgabe(skillId, diff, "cloze", { prompt: `Alle Ecken sind rechte Winkel. Berechne Umfang und Flächeninhalt.\nu = ___ ${e}\nA = ___ ${e}²`, figur: fig, answer: { blanks: [[String(u)], [String(A)]], mode: "value" }, solution: `${fehlendeSeiten}${uWeg} ${e}\n${aWeg} ${e}²`, hints: [hilfenU[0], hilfenA[0]] });
  const flaeche = format === "rechenweg" || rng() < 0.5;
  const prompt = `Alle Ecken sind rechte Winkel. Berechne ${flaeche ? "den Flächeninhalt" : "den Umfang"} der Figur.`;
  const einheit = flaeche ? `${e}²` : e;
  const richtig = String(flaeche ? A : u);
  const solution = `${fehlendeSeiten}${flaeche ? aWeg : uWeg} ${einheit}`;
  const fehler = fehlerOhne(richtig, flaeche ? [aFehler, { answer: String(u), label: "Umfang statt Flächeninhalt berechnet" }] : [uFehler, { answer: String(A), label: "Flächeninhalt statt Umfang berechnet" }]);
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", { prompt: `${prompt} ${WEG}`, figur: fig, answer: { accepted: [`${A} ${e}²`], unit: `${e}²`, form: null, needWay: true }, solution, steps: [aWeg], hints: hilfenA, errorMap: fehler.map((f) => ({ ...f, answer: `${f.answer} ${e}²` })) });
  if (format === "mc") {
    const m = auswahl(rng, `${richtig} ${einheit}`, fehler.map((f) => ({ ...f, answer: `${f.answer} ${einheit}` })), [`${Number(richtig) + 4} ${einheit}`, `${Number(richtig) - 2} ${einheit}`]);
    return aufgabe(skillId, diff, "mc", { prompt, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: flaeche ? hilfenA : hilfenU, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${prompt} Gib das Ergebnis in ${einheit} an.`, figur: fig, answer: { accepted: mitEinheit(richtig, einheit), mode: "value" }, solution, hints: flaeche ? hilfenA : hilfenU, errorMap: fehler });
}

function umkehrAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  const e = "cm";
  const art = lv >= 2 && rng() < 0.4 ? "dreieck" : rng() < 0.55 ? "flaeche" : "umfang";
  let fig: Flaeche;
  let gesucht: number;
  let weg: string;
  let fehler: Fehler[];
  let frage: string;
  let hilfen: string[];
  let gName = "b";
  if (art === "dreieck") {
    let c = 8;
    let h = 5;
    for (let t = 0; t < 30; t++) {
      c = rint(rng, 4, 12);
      h = rint(rng, 3, 9);
      if ((c * h) % 2 === 0 && c / h <= 2.8 && h / c <= 1.6) break;
    }
    const A = (c * h) / 2;
    const p = runde(c * pick(rng, [0.35, 0.5, 0.65]), 1);
    fig = {
      art: "figur",
      form: "dreieck",
      ecken: [[0, 0], [c, 0], [p, h]],
      seiten: [{ von: 0, text: `c = ${c} ${e}` }],
      strecken: [{ von: [p, h], bis: [p, 0], text: "h = ?", loesung: `h = ${h} ${e}`, gestrichelt: true, rechterWinkel: true }],
      innen: { text: `A = ${zahl(A)} ${e}²`, bei: [c * 0.62 > p ? (p + c) / 2 + c * 0.04 : p / 2, h * 0.28] },
    };
    gesucht = h;
    gName = "h";
    weg = `h = 2 · A : c = 2 · ${zahl(A)} : ${c} = ${h}`;
    fehler = [{ answer: zahl(runde(A / c)), label: "Beim Dreieck den Faktor 2 vergessen" }, { answer: zahl(A * c), label: "Multipliziert statt dividiert" }];
    frage = "Wie lang ist die Höhe h des Dreiecks?";
    hilfen = ["A = c · h : 2. Rechne rückwärts.", "h = 2 · A : c"];
  } else {
    let a = 8;
    let b = 5;
    for (let t = 0; t < 30; t++) {
      a = rint(rng, 4, lv >= 1 ? 14 : 10);
      b = rint(rng, 2, a - 1);
      if (a / b <= 3) break;
    }
    if (art === "flaeche") {
      fig = rechteckFigur(a, b, e, { seiten: [{ von: 0, text: `a = ${a} ${e}` }, { von: 1, text: "b = ?", loesung: `b = ${b} ${e}` }], innen: { text: `A = ${a * b} ${e}²`, bei: [a / 2, b / 2] } });
      weg = `b = A : a = ${a * b} : ${a} = ${b}`;
      fehler = [
        ...(a * b - 2 * a > 0 && (a * b - 2 * a) % 2 === 0 ? [{ answer: String((a * b - 2 * a) / 2), label: "Mit dem Umfang statt mit dem Flächeninhalt gerechnet" }] : []),
        { answer: String(a * b - a), label: "Subtrahiert statt dividiert" },
      ];
      hilfen = ["A = a · b. Welche Zahl mal " + a + " ergibt " + a * b + "?", "b = A : a"];
    } else {
      const u = 2 * a + 2 * b;
      fig = rechteckFigur(a, b, e, { seiten: [{ von: 0, text: `a = ${a} ${e}` }, { von: 1, text: "b = ?", loesung: `b = ${b} ${e}` }], innen: { text: `u = ${u} ${e}`, bei: [a / 2, b / 2] } });
      weg = `b = (u − 2 · a) : 2 = (${u} − ${2 * a}) : 2 = ${b}`;
      fehler = [{ answer: String(u - 2 * a), label: "Nicht durch 2 dividiert" }, { answer: String(u - a), label: "Die Seite a nur einmal abgezogen" }];
      hilfen = ["u = 2 · a + 2 · b. Zieh zuerst die beiden Seiten a ab.", "Der Rest sind die beiden Seiten b zusammen."];
    }
    gesucht = b;
    frage = "Wie lang ist die Seite b des Rechtecks?";
  }
  const richtig = zahl(gesucht);
  const fehl = fehlerOhne(richtig, fehler);
  if (format === "cloze") return aufgabe(skillId, diff, "cloze", { prompt: `${frage}\n${gName} = ___ ${e}`, figur: fig, answer: { blanks: [[richtig]], mode: "value" }, solution: `${weg} ${e}`, hints: hilfen, errorMap: fehl });
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", { prompt: `${frage} ${WEG}`, figur: fig, answer: { accepted: [`${richtig} ${e}`], unit: e, form: null, needWay: true }, solution: `${weg} ${e}`, steps: [zahlenWeg(weg)], hints: hilfen, errorMap: fehl.map((f) => ({ ...f, answer: `${f.answer} ${e}` })) });
  if (format === "mc") {
    const m = auswahl(rng, `${richtig} ${e}`, fehl.map((f) => ({ ...f, answer: `${f.answer} ${e}` })), [`${gesucht + 1} ${e}`, `${gesucht * 2} ${e}`]);
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution: `${weg} ${e}`, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${e} an.`, figur: fig, answer: { accepted: mitEinheit(richtig, e), mode: "value" }, solution: `${weg} ${e}`, hints: hilfen, errorMap: fehl });
}

// ---------- Pythagoras ----------

const TRIPEL: [number, number, number][][] = [
  [[3, 4, 5], [6, 8, 10], [5, 12, 13]],
  [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]],
  [[9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [20, 21, 29], [15, 20, 25], [10, 24, 26]],
  [[8, 15, 17], [12, 16, 20], [20, 21, 29], [15, 20, 25], [10, 24, 26], [12, 35, 37]],
];

function pythagorasSeite(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  const e = rng() < 0.75 ? "cm" : "m";
  // ohne Tripel (gerundet) nur bei „schwer“ und nicht für den Rechenweg, dessen Zeilen genau stimmen müssen
  const gerundet = lv === 3 && format !== "rechenweg" && rng() < 0.6;
  let [k1, k2, hyp] = pick(rng, TRIPEL[lv]);
  if (gerundet) {
    k1 = rint(rng, 3, 12);
    k2 = rint(rng, 3, 12);
    if (k1 === k2) k2 += 1;
    hyp = Math.hypot(k1, k2);
  }
  if (rng() < 0.5) [k1, k2] = [k2, k1];
  // gesucht: die Hypotenuse (leicht) oder eine Kathete
  const gesucht: "hyp" | "k1" | "k2" = lv === 0 ? "hyp" : lv === 1 ? pick(rng, ["k1", "k2"] as const) : pick(rng, ["hyp", "k1", "k2"] as const);
  // Namen: der rechte Winkel bei C (wie gewohnt), ab „mittel“ auch bei A oder B
  const [nR, n1, n2] = lv >= 2 ? shuffle(rng, ["A", "B", "C"]) : ["C", "A", "B"];
  const klein = (s: string) => s.toLowerCase();
  // Ecken: R(0,0), P1(k1,0), P2(0,k2); Seite 0 = k1 (gegenüber P2), Seite 1 = Hypotenuse (gegenüber R), Seite 2 = k2 (gegenüber P1)
  const name = { k1: klein(n2), hyp: klein(nR), k2: klein(n1) };
  const laenge = { k1, hyp, k2 };
  const t = (v: number) => (Number.isInteger(v) ? zahl(v) : zahl(runde(v, 1)));
  const wertText = (s: "k1" | "hyp" | "k2") => `${t(laenge[s])} ${e}`;
  const ergebnis = runde(laenge[gesucht], 1);
  const richtig = zahl(ergebnis);
  const x = name[gesucht];
  const seite = (s: "k1" | "hyp" | "k2") => (s === gesucht ? { text: `${name[s]} = ?`, loesung: `${name[s]} = ${richtig} ${e}` } : { text: `${name[s]} = ${wertText(s)}` });
  const fig: Flaeche = {
    art: "figur",
    form: "rechtwinklig",
    ecken: [[0, 0], [k1, 0], [0, k2]],
    namen: [nR, n1, n2],
    seiten: [{ von: 0, ...seite("k1") }, { von: 1, ...seite("hyp") }, { von: 2, ...seite("k2") }],
    rechteWinkel: [0],
  };
  const [g1, g2] = (["k1", "hyp", "k2"] as const).filter((s) => s !== gesucht);
  const q = (v: number) => runde(v * v, 2);
  let gleichung: string;
  let zeilen: string[];
  let fehler: Fehler[];
  if (gesucht === "hyp") {
    gleichung = `${x}² = ${name.k1}² + ${name.k2}²`;
    zeilen = [`${x}² = ${t(k1)}² + ${t(k2)}²`, `${x}² = ${roh(q(k1))} + ${roh(q(k2))}`, `${x}² = ${roh(q(k1) + q(k2))}`, `${x} = ${richtig}`];
    fehler = [{ answer: zahl(runde(q(k1) + q(k2), 2)), label: "Die Wurzel am Ende vergessen" }, { answer: zahl(k1 + k2), label: "Die Seiten nur addiert" }];
  } else {
    const andere = gesucht === "k1" ? "k2" : "k1";
    gleichung = `${x}² = ${name.hyp}² − ${name[andere]}²`;
    zeilen = [`${x}² = ${t(hyp)}² − ${t(laenge[andere])}²`, `${x}² = ${roh(q(hyp))} − ${roh(q(laenge[andere]))}`, `${x}² = ${roh(runde(q(hyp) - q(laenge[andere]), 2))}`, `${x} = ${richtig}`];
    fehler = [
      { answer: zahl(runde(Math.hypot(hyp, laenge[andere]), 1)), label: "Bei gesuchter Kathete addiert statt subtrahiert" },
      { answer: zahl(runde(q(hyp) - q(laenge[andere]), 2)), label: "Die Wurzel am Ende vergessen" },
    ];
  }
  const fehl = fehlerOhne(richtig, fehler);
  const rund = gerundet ? " Runde auf eine Nachkommastelle." : "";
  const frage = `Berechne die Länge der Seite ${x}.${rund}`;
  const solution = `Der rechte Winkel ist bei ${nR}, also ist ${name.hyp} die Hypotenuse.\n${gleichung}\n${zeilen.join("\n")}${gerundet ? " (gerundet)" : ""} ${e}`.replace(` = ${richtig} (gerundet) ${e}`, ` ≈ ${richtig} ${e}`);
  const hilfen = ["Die Hypotenuse liegt dem rechten Winkel gegenüber und ist die längste Seite.", gesucht === "hyp" ? "Hypotenuse² = Kathete² + Kathete²" : "Kathete² = Hypotenuse² − Kathete²", "Am Ende die Wurzel ziehen."];
  void g1, void g2;
  if (format === "cloze") return aufgabe(skillId, diff, "cloze", { prompt: `${frage}\n${x} = ___ ${e}`, figur: fig, answer: { blanks: [[richtig]], mode: "value" }, solution, hints: hilfen, errorMap: fehl });
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${frage} ${WEG}`,
      figur: fig,
      data: { variable: x },
      answer: { accepted: [`${richtig} ${e}`], unit: e, form: null, needWay: true },
      solution,
      steps: zeilen,
      hints: hilfen,
      errorMap: fehl.map((f) => ({ ...f, answer: `${f.answer.replace(/\s/g, "")} ${e}` })),
    });
  if (format === "mc") {
    const m = auswahl(rng, `${richtig} ${e}`, fehl.map((f) => ({ ...f, answer: `${f.answer} ${e}` })), [`${zahl(runde(ergebnis + 2, 1))} ${e}`, `${zahl(runde(ergebnis - 1, 1))} ${e}`]);
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${e} an.`, figur: fig, answer: { accepted: mitEinheit(richtig, e), mode: "value" }, solution, hints: hilfen, errorMap: fehl });
}

function pythagorasFiguren(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  const e = "cm";
  const [k1, k2, hyp] = pick(rng, TRIPEL[Math.min(lv, 2)]);
  let fig: Flaeche;
  let x: string;
  let ergebnis: number;
  let zeilen: string[];
  let fehler: Fehler[];
  let erklaerung: string;
  let frage: string;
  if (rng() < 0.5) {
    // Diagonale im Rechteck
    const [a, b] = k1 >= k2 ? [k1, k2] : [k2, k1];
    x = "d";
    ergebnis = hyp;
    fig = rechteckFigur(a, b, e, { strecken: [{ von: [0, 0], bis: [a, b], text: "d = ?", loesung: `d = ${hyp} ${e}`, gestrichelt: true }] });
    zeilen = [`d² = ${a}² + ${b}²`, `d² = ${a * a} + ${b * b}`, `d² = ${hyp * hyp}`, `d = ${hyp}`];
    fehler = [{ answer: String(hyp * hyp), label: "Die Wurzel am Ende vergessen" }, { answer: String(a + b), label: "Die Seiten nur addiert" }];
    erklaerung = "Die Diagonale teilt das Rechteck in zwei rechtwinkelige Dreiecke; d ist ihre Hypotenuse.";
    frage = "Berechne die Länge der Diagonale d des Rechtecks.";
  } else {
    // Höhe im gleichschenkeligen Dreieck: halbe Basis, Höhe, Schenkel
    const halbe = k1;
    const h = k2;
    const c = 2 * halbe;
    x = "h";
    ergebnis = h;
    fig = {
      art: "figur",
      form: "gleichschenklig",
      ecken: [[0, 0], [c, 0], [halbe, h]],
      seiten: [{ von: 0, text: `c = ${c} ${e}` }, { von: 1, text: `s = ${hyp} ${e}` }, { von: 2, text: `s = ${hyp} ${e}` }],
      strecken: [{ von: [halbe, h], bis: [halbe, 0], text: "h = ?", loesung: `h = ${h} ${e}`, gestrichelt: true, rechterWinkel: true }],
    };
    zeilen = [`h² = ${hyp}² − ${halbe}²`, `h² = ${hyp * hyp} − ${halbe * halbe}`, `h² = ${h * h}`, `h = ${h}`];
    fehler = [
      ...(hyp > c ? [{ answer: zahl(runde(Math.sqrt(hyp * hyp - c * c), 1)), label: "Die ganze statt der halben Basis verwendet" }] : []),
      { answer: String(h * h), label: "Die Wurzel am Ende vergessen" },
      { answer: zahl(runde(Math.hypot(hyp, halbe), 1)), label: "Addiert statt subtrahiert" },
    ];
    erklaerung = `Die Höhe teilt das Dreieck in zwei rechtwinkelige Dreiecke mit der halben Basis ${c} : 2 = ${halbe} und dem Schenkel s als Hypotenuse.`;
    frage = "Berechne die Höhe h des gleichschenkeligen Dreiecks.";
  }
  const richtig = zahl(ergebnis);
  const fehl = fehlerOhne(richtig, fehler);
  const solution = `${erklaerung}\n${zeilen.join("\n")} ${e}`;
  const hilfen = ["Such ein rechtwinkeliges Dreieck in der Figur.", "Welche Seite liegt dem rechten Winkel gegenüber? Das ist die Hypotenuse."];
  if (format === "cloze") return aufgabe(skillId, diff, "cloze", { prompt: `${frage}\n${x} = ___ ${e}`, figur: fig, answer: { blanks: [[richtig]], mode: "value" }, solution, hints: hilfen, errorMap: fehl });
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", { prompt: `${frage} ${WEG}`, figur: fig, data: { variable: x }, answer: { accepted: [`${richtig} ${e}`], unit: e, form: null, needWay: true }, solution, steps: zeilen, hints: hilfen, errorMap: fehl.map((f) => ({ ...f, answer: `${f.answer} ${e}` })) });
  if (format === "mc") {
    const m = auswahl(rng, `${richtig} ${e}`, fehl.map((f) => ({ ...f, answer: `${f.answer} ${e}` })), [`${ergebnis + 2} ${e}`, `${ergebnis - 1} ${e}`]);
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur: fig, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${e} an.`, figur: fig, answer: { accepted: mitEinheit(richtig, e), mode: "value" }, solution, hints: hilfen, errorMap: fehl });
}

// =====================================================================
// Kreise: Radius und Durchmesser, Umfang und Flächeninhalt, Kreisteile
// =====================================================================

const PI_TEXT = "Rechne mit π ≈ 3,14.";
const RUND_TEXT = "Runde auf eine Nachkommastelle.";
/** Nachkommastellen einer Zahl (höchstens 6). */
function stellenVon(x: number): number {
  for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(x * 10 ** d) - x * 10 ** d) < 1e-6) return d;
  return 6;
}
/** Kaufmännisch gerundet, auch wenn die Gleitkommazahl knapp unter …5 liegt (19,625 → 19,6; 0,45 → 0,5). */
const rundeAuf = (x: number, n: number) => Math.sign(x) * (Math.round(Math.abs(x) * 10 ** n + 1e-7) / 10 ** n);

/**
 * Ein Ergebnis mit π, gerechnet mit 3,14 wie im Schulbuch: `faktor` · 3,14 + `dazu`. Mehr als zwei Nachkommastellen
 * werden auf eine gerundet (die Aufgabe sagt es dann, `rund` erzwingt es für alle Teile einer Aufgabe). Wer mit der
 * π-Taste rechnet und gleich rundet, bekommt manchmal etwas anderes: das zählt auch als richtig (`auch`).
 */
type PiWert = { wert: number; text: string; auch: string | null; genau: number; gerundet: boolean };
function piWert(faktor: number, dazu = 0, rund = false): PiWert {
  const genau = Math.round((faktor * 3.14 + dazu) * 1e6) / 1e6;
  const gerundet = rund || stellenVon(genau) > 2;
  const st = gerundet ? 1 : stellenVon(genau);
  const wert = rundeAuf(genau, st);
  const mitPi = rundeAuf(faktor * Math.PI + dazu, st);
  // gerundet immer mit einer Nachkommastelle („1 194,0“), so wie gefragt
  const text = (v: number) => (gerundet ? zahl(v, 1) : zahl(v));
  return { wert, text: text(wert), auch: Math.abs(mitPi - wert) > 1e-9 ? text(mitPi) : null, genau, gerundet };
}
/** Die richtigen Antworten eines π-Ergebnisses (mit 3,14 und mit der π-Taste), ohne Leerzeichen in der Zahl (Rechenweg). */
const piAntworten = (p: PiWert) => [p.text, ...(p.auch ? [p.auch] : [])].map((x) => x.replace(/\s/g, ""));
/** Ein typischer Fehler mit π: gleich gerundet wie das richtige Ergebnis, damit er beim Eintippen erkannt wird. */
const piFehler = (faktor: number, dazu: number, p: PiWert, label: string): Fehler => {
  const v = faktor * 3.14 + dazu;
  return { answer: zahl(rundeAuf(v, p.gerundet || stellenVon(Math.round(v * 1e6) / 1e6) > 2 ? 1 : 6)), label };
};
/** Rechenzeile mit 3,14: „A = 6² · 3,14 = 113,04“, gerundet „… = 19,625 ≈ 19,6“. */
const piZeile = (links: string, p: PiWert) => `${links} = ${roh(p.genau)}${p.gerundet && Math.abs(p.genau - p.wert) > 1e-9 ? ` ≈ ${p.text.replace(/\s/g, "")}` : ""}`;
/** Typische Fehler ohne alle richtigen Antworten und ohne Doppelte. */
const fehlerOhneAlle = (richtig: string[], fehler: (Fehler | null | undefined)[]) => {
  const weg = new Set(richtig.map(schluessel));
  return fehlerOhne(richtig[0], fehler).filter((f) => !weg.has(schluessel(f.answer)));
};

function kreisBild(o: Partial<Kreis> & Pick<Kreis, "teil">): Kreis {
  return { art: "kreis", strecke: "radius", text: "", mitte: "M", winkelZeigen: false, getoent: false, ganzerKreis: false, ...o, winkel: kreisWinkel({ teil: o.teil, winkel: o.winkel ?? 360 }) };
}

/** Kreis zeichnen und benennen (5./6. Schulstufe): Radius und Durchmesser, Namen der Kreisteile. */
function kreisGrundAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "rechenweg" || format === "sachaufgabe") return null;
  if (format === "mc" && rng() < 0.5) {
    if (rng() < 0.5) {
      // welche Strecke ist x?
      const welche = pick(rng, ["radius", "durchmesser"] as const);
      const options = ["Radius", "Durchmesser", "Kreisbogen", "Umfang"];
      const correct = welche === "radius" ? 0 : 1;
      return aufgabe(skillId, diff, "mc", {
        prompt: "Wie heißt die Strecke x im Bild?",
        figur: kreisBild({ teil: "kreis", strecke: welche, text: "x" }),
        data: { options },
        answer: { correct },
        solution:
          welche === "radius"
            ? "x geht vom Mittelpunkt M bis zur Kreislinie: das ist der Radius r."
            : "x geht von der Kreislinie durch den Mittelpunkt M bis zur anderen Seite: das ist der Durchmesser d.",
        hints: ["Beginnt die Strecke im Mittelpunkt, oder geht sie durch ihn hindurch?", "Der Radius geht vom Mittelpunkt zur Kreislinie, der Durchmesser ganz hinüber."],
        errorMap: [{ answer: String(1 - correct), label: "Radius und Durchmesser verwechselt" }],
      });
    }
    // welcher Kreisteil ist getönt? Nur echte Sektoren (90° und 180° wären auch Viertel- und Halbkreis)
    const winkel = pick(rng, [40, 50, 60, 70, 75, 100, 110, 120, 135, 140]);
    const options = shuffle(rng, ["Kreissektor", "Kreissegment", "Kreisring", "Halbkreis"]);
    return aufgabe(skillId, diff, "mc", {
      prompt: "Wie heißt der getönte Teil des Kreises?",
      figur: kreisBild({ teil: "sektor", winkel, strecke: "keine", getoent: true, ganzerKreis: true }),
      data: { options },
      answer: { correct: options.indexOf("Kreissektor") },
      solution: "Der getönte Teil wird von zwei Radien und einem Kreisbogen begrenzt, wie ein Stück Torte: das ist ein Kreissektor.\nEin Kreissegment schneidet dagegen eine gerade Strecke (eine Sehne) vom Kreis ab.",
      hints: ["Schau, welche Linien den getönten Teil begrenzen.", "Zwei Radien und ein Bogen: wie ein Stück Torte."],
      errorMap: [{ answer: String(options.indexOf("Kreissegment")), label: "Kreissektor und Kreissegment verwechselt" }],
    });
  }
  const e = lv === 3 && rng() < 0.4 ? "m" : "cm";
  const r = lv === 0 ? rint(rng, 2, 9) : lv === 1 ? rint(rng, 3, 15) : lv === 2 ? rint(rng, 3, 19) / 2 : rng() < 0.5 ? rint(rng, 5, 29) / 2 : rint(rng, 8, 25);
  const d = 2 * r;
  const t = (v: number) => `${zahl(v)} ${e}`;
  const hilfen = ["Der Durchmesser geht durch den Mittelpunkt ganz über den Kreis, der Radius nur bis zur Mitte.", "d = 2 · r und r = d : 2"];
  if (format === "cloze") {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Im Bild ist der Radius eingezeichnet. Ergänze.\nDurchmesser d = ___ ${e}\nEin Kreis mit doppelt so großem Radius hat den Durchmesser ___ ${e}.`,
      figur: kreisBild({ teil: "kreis", strecke: "radius", text: `r = ${t(r)}` }),
      answer: { blanks: [[zahl(d)], [zahl(2 * d)]], mode: "value" },
      solution: `d = 2 · r = 2 · ${t(r)} = ${t(d)}\nDoppelter Radius: r = ${t(2 * r)}, also d = 2 · ${t(2 * r)} = ${t(2 * d)}`,
      hints: hilfen,
    });
  }
  const art = pick(rng, ["d", "r", "zirkel"] as const);
  const figur = art === "d" ? kreisBild({ teil: "kreis", strecke: "radius", text: `r = ${t(r)}` }) : kreisBild({ teil: "kreis", strecke: "durchmesser", text: `d = ${t(d)}` });
  const gesucht = art === "d" ? d : r;
  const frage =
    art === "d"
      ? "Im Bild ist der Radius eingezeichnet. Wie lang ist der Durchmesser d?"
      : art === "r"
        ? "Im Bild ist der Durchmesser eingezeichnet. Wie lang ist der Radius r?"
        : "Du willst diesen Kreis mit dem Zirkel zeichnen. Wie weit musst du den Zirkel öffnen?";
  const solution = art === "d" ? `d = 2 · r = 2 · ${t(r)} = ${t(d)}` : `r = d : 2 = ${t(d)} : 2 = ${t(r)}${art === "zirkel" ? `\nDer Zirkel wird auf den Radius geöffnet, also auf ${t(r)}.` : ""}`;
  const fehler = fehlerOhne(
    zahl(gesucht),
    art === "d"
      ? [{ answer: zahl(r), label: "Radius und Durchmesser verwechselt" }, { answer: zahl(r / 2), label: "Durch 2 statt mal 2 gerechnet" }]
      : [{ answer: zahl(d), label: art === "zirkel" ? "Zirkel auf den Durchmesser eingestellt (Radius und Durchmesser verwechselt)" : "Radius und Durchmesser verwechselt" }, { answer: zahl(2 * d), label: "Mal 2 statt durch 2 gerechnet" }],
  );
  if (format === "mc") {
    const m = auswahl(rng, t(gesucht), fehler.map((f) => ({ ...f, answer: `${f.answer} ${e}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${e} an.`, figur, answer: { accepted: mitEinheit(zahl(gesucht), e), mode: "value" }, solution, hints: hilfen, errorMap: fehler });
}

/** Umfang und Flächeninhalt von Kreisen (8./9. Schulstufe), π ≈ 3,14. */
function kreisFlaecheAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return kreisSachaufgabe(skillId, diff, rng);
  if (lv === 3 && format !== "cloze" && rng() < 0.5) return kreisUmkehrAufgabe(skillId, diff, format, rng);
  const e = rng() < 0.7 ? "cm" : "m";
  const mitD = lv === 0 ? false : lv === 1 ? rng() < 0.6 : rng() < 0.5;
  const r = lv === 0 ? rint(rng, 2, 10) : lv === 1 ? rint(rng, 2, 15) : lv === 2 ? rint(rng, 5, 25) / 2 : rint(rng, 6, 40) / 2;
  const d = 2 * r;
  const figur = mitD ? kreisBild({ teil: "kreis", strecke: "durchmesser", text: `d = ${zahl(d)} ${e}` }) : kreisBild({ teil: "kreis", strecke: "radius", text: `r = ${zahl(r)} ${e}` });
  const beide = format === "cloze";
  const uRoh = piWert(d);
  const aRoh = piWert(r * r);
  // ein Rundungshinweis gilt für die ganze Aufgabe
  const rund = beide ? uRoh.gerundet || aRoh.gerundet : false;
  const u = piWert(d, 0, rund);
  const A = piWert(r * r, 0, rund);
  const rText = `${roh(d)} : 2 = ${roh(r)}`;
  const uZeile = mitD ? piZeile(`u = ${roh(d)} · 3,14`, u) : piZeile(`u = 2 · ${roh(r)} · 3,14`, u);
  const aZeile = piZeile(`A = ${roh(r)}² · 3,14`, A);
  const uWeg = mitD ? `u = d · π\n${uZeile}` : `u = 2 · r · π\n${uZeile}`;
  const aWeg = `${mitD ? `r = d : 2 = ${rText}\n` : ""}A = r² · π\n${aZeile}`;
  const hinweis = (gerundet: boolean) => `${PI_TEXT}${gerundet ? ` ${RUND_TEXT}` : ""}`;
  if (beide) {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Berechne Umfang und Flächeninhalt des Kreises. ${hinweis(rund)}\nu = ___ ${e}\nA = ___ ${e}²`,
      figur,
      answer: { blanks: [piAntworten(u), piAntworten(A)], mode: "value" },
      solution: `${uWeg} ${e}\n${aWeg} ${e}²`,
      hints: ["u = d · π = 2 · r · π", "A = r² · π, dafür brauchst du den Radius."],
    });
  }
  const flaeche = rng() < 0.55;
  const p = flaeche ? A : u;
  const einheit = flaeche ? `${e}²` : e;
  const fehler = fehlerOhneAlle(
    piAntworten(p),
    flaeche
      ? [
          piFehler(d * d, 0, p, "Mit dem Durchmesser statt dem Radius in A = r² · π gerechnet"),
          piFehler(d, 0, p, "Umfang und Flächeninhalt verwechselt"),
          { answer: zahl(rundeAuf(r * r, p.gerundet ? 1 : 6)), label: "π vergessen" },
        ]
      : [piFehler(r, 0, p, "Mit dem Radius statt dem Durchmesser gerechnet (u = r · π)"), piFehler(r * r, 0, p, "Umfang und Flächeninhalt verwechselt"), { answer: zahl(rundeAuf(d, p.gerundet ? 1 : 6)), label: "π vergessen" }],
  );
  const frage = `Berechne ${flaeche ? "den Flächeninhalt" : "den Umfang"} des Kreises. ${hinweis(p.gerundet)}`;
  const solution = `${flaeche ? aWeg : uWeg} ${einheit}`;
  const hilfen = flaeche ? ["A = r² · π", mitD ? "Du brauchst den Radius: r = d : 2." : "Rechne zuerst r² = r · r."] : ["u = d · π = 2 · r · π", mitD ? "Der Durchmesser steht im Bild." : "d = 2 · r"];
  if (format === "rechenweg") {
    const zeilen = [...(mitD && flaeche ? [`r = ${rText}`] : []), flaeche ? aZeile : uZeile];
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${frage} ${WEG}`,
      figur,
      answer: { accepted: piAntworten(p).map((x) => `${x} ${einheit}`), unit: einheit, form: null, round: p.gerundet ? 1 : null, needWay: true },
      solution,
      steps: zeilen.map(zahlenWeg),
      hints: hilfen,
      errorMap: fehler.map((f) => ({ ...f, answer: `${f.answer.replace(/\s/g, "")} ${einheit}` })),
    });
  }
  if (format === "mc") {
    const m = auswahl(rng, `${p.text} ${einheit}`, fehler.map((f) => ({ ...f, answer: `${f.answer} ${einheit}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", {
    prompt: `${frage} Gib das Ergebnis in ${einheit} an.`,
    figur,
    answer: { accepted: piAntworten(p).flatMap((x) => mitEinheit(x, einheit)), mode: "value" },
    solution,
    hints: hilfen,
    errorMap: fehler,
  });
}

/** Rückwärts: aus dem Umfang der Durchmesser, aus dem Flächeninhalt der Radius (mit Wurzel). */
function kreisUmkehrAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const e = rng() < 0.7 ? "cm" : "m";
  const ausU = rng() < 0.5;
  const r = rint(rng, 2, 12);
  const d = 2 * r;
  const gegeben = ausU ? Math.round(d * 3.14 * 100) / 100 : Math.round(r * r * 3.14 * 100) / 100;
  const gesucht = ausU ? d : r;
  // mit der π-Taste: genauso gerundet (auf ganze Zahlen)
  const mitPi = Math.round(ausU ? gegeben / Math.PI : Math.sqrt(gegeben / Math.PI));
  const richtig = [zahl(gesucht), ...(mitPi !== gesucht ? [zahl(mitPi)] : [])];
  const figur = ausU ? kreisBild({ teil: "kreis", strecke: "durchmesser", text: "d = ?", loesung: `d = ${zahl(d)} ${e}` }) : kreisBild({ teil: "kreis", strecke: "radius", text: "r = ?", loesung: `r = ${zahl(r)} ${e}` });
  const frage = ausU
    ? `Der Kreis hat den Umfang u = ${zahl(gegeben)} ${e}. Wie lang ist sein Durchmesser d? ${PI_TEXT}`
    : `Der Kreis hat den Flächeninhalt A = ${zahl(gegeben)} ${e}². Wie lang ist sein Radius r? ${PI_TEXT}`;
  const zeilen = ausU ? [`d = ${roh(gegeben)} : 3,14 = ${d}`] : [`r² = ${roh(gegeben)} : 3,14 = ${r * r}`, `r = √${r * r} = ${r}`];
  const solution = ausU ? `u = d · π, also d = u : π\n${zeilen[0]} ${e}` : `A = r² · π, also r² = A : π\n${zeilen[0]}\n${zeilen[1]} ${e}`;
  const fehler = fehlerOhneAlle(
    richtig,
    ausU
      ? [{ answer: zahl(r), label: "Den Radius statt den Durchmesser angegeben" }, { answer: zahl(rundeAuf(gegeben * 3.14, 2)), label: "Mit π multipliziert statt dividiert" }]
      : [{ answer: zahl(r * r), label: "Die Wurzel am Ende vergessen" }, { answer: zahl(d), label: "Den Durchmesser statt den Radius angegeben" }],
  );
  const hilfen = ausU ? ["u = d · π. Rechne rückwärts.", "d = u : π"] : ["A = r² · π. Rechne rückwärts: zuerst durch π, dann die Wurzel.", "r² = A : π"];
  if (format === "rechenweg")
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${frage} ${WEG}`,
      figur,
      answer: { accepted: richtig.map((x) => `${x} ${e}`), unit: e, form: null, needWay: true },
      solution,
      steps: ausU ? zeilen.map(zahlenWeg) : [`${roh(gegeben)} : 3,14 = ${r * r}`, `√${r * r} = ${r}`],
      hints: hilfen,
      errorMap: fehler.map((f) => ({ ...f, answer: `${f.answer.replace(/\s/g, "")} ${e}` })),
    });
  if (format === "mc") {
    const m = auswahl(rng, `${zahl(gesucht)} ${e}`, fehler.map((f) => ({ ...f, answer: `${f.answer} ${e}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${e} an.`, figur, answer: { accepted: richtig.flatMap((x) => mitEinheit(x, e)), mode: "value" }, solution, hints: hilfen, errorMap: fehler });
}

const KREIS_SACHEN = [
  { ding: "Ein rundes Trampolin", rand: "Wie lang ist der Rand des Trampolins?", flaeche: "Wie groß ist die Sprungfläche?", kosten: "Ein Schutznetz rundherum kostet {p} € pro Meter. Was kostet das Netz? Rechne mit deinem Ergebnis aus a).", preise: [8, 12, 15] },
  { ding: "Ein runder Gartenteich", rand: "Wie lang ist ein Zaun einmal rund um den Teich?", flaeche: "Wie groß ist die Wasserfläche?", kosten: "Der Zaun kostet {p} € pro Meter. Was kostet der Zaun? Rechne mit deinem Ergebnis aus a).", preise: [9, 14, 20] },
  { ding: "Ein rundes Blumenbeet", rand: "Wie lang ist eine Rasenkante einmal rund um das Beet?", flaeche: "Wie groß ist die Fläche des Beets?", kosten: "Die Rasenkante kostet {p} € pro Meter. Was kostet sie? Rechne mit deinem Ergebnis aus a).", preise: [4, 6, 7] },
];

function kreisSachaufgabe(skillId: string, diff: Difficulty, rng: Rng): TaskDraft {
  const lv = LEVEL[diff];
  const s = pick(rng, KREIS_SACHEN);
  const mitD = rng() < 0.5;
  const d = lv <= 1 ? 2 * rint(rng, 1, 4) : rint(rng, 3, 9);
  const r = d / 2;
  const roh1 = piWert(d);
  const roh2 = piWert(r * r);
  const rund = roh1.gerundet || roh2.gerundet;
  const u = piWert(d, 0, rund);
  const A = piWert(r * r, 0, rund);
  const preis = pick(rng, s.preise);
  const kosten = rundeAuf(u.wert * preis, 2);
  const parts: (PartView & PartSolution)[] = [
    { label: "a)", prompt: s.rand, kind: "zahl", accepted: piAntworten(u).map((x) => `${x} m`), unit: "m", round: rund ? 1 : null, solution: `u = d · π = ${zahl(d)} m · 3,14 ${rund ? "≈" : "="} ${u.text} m`, errorMap: [{ answer: `${zahl(rundeAuf(r * 3.14, rund ? 1 : 2))} m`, label: "Mit dem Radius statt dem Durchmesser gerechnet (u = r · π)" }] },
    { label: "b)", prompt: s.flaeche, kind: "zahl", accepted: piAntworten(A).map((x) => `${x} m²`), unit: "m²", round: rund ? 1 : null, solution: `A = r² · π = (${zahl(r)} m)² · 3,14 ${rund ? "≈" : "="} ${A.text} m²`, errorMap: [{ answer: `${zahl(rundeAuf(d * d * 3.14, rund ? 1 : 2))} m²`, label: "Mit dem Durchmesser statt dem Radius in A = r² · π gerechnet" }] },
    { label: "c)", prompt: s.kosten.replace("{p}", String(preis)), kind: "zahl", accepted: [`${geldText(kosten)} €`], unit: "€", round: 2, follow: `a * ${preis}`, solution: `${u.text} · ${preis} € = ${geldText(kosten)} €` },
  ];
  return {
    type: "sachaufgabe",
    skillId,
    skillIds: [skillId],
    category: "sachaufgabe",
    difficulty: diff,
    prompt: `${s.ding} hat ${mitD ? `einen Durchmesser von ${zahl(d)} m` : `einen Radius von ${zahl(r)} m`}. ${PI_TEXT}${rund ? ` ${RUND_TEXT}` : ""}`,
    data: { parts: parts.map(({ label, prompt, kind }) => ({ label, prompt, kind })), figure: mitD ? kreisBild({ teil: "kreis", strecke: "durchmesser", text: `d = ${zahl(d)} m` }) : kreisBild({ teil: "kreis", strecke: "radius", text: `r = ${zahl(r)} m` }) },
    answer: { parts: parts.map(({ accepted, unit, round, follow, solution, errorMap }) => ({ accepted, unit: unit ?? null, round: round ?? null, follow: follow ?? null, solution, errorMap })) },
    solution: parts.map((p) => `${p.label} ${p.solution}`).join("\n"),
    hints: ["Einmal rundherum: das ist der Umfang.", "u = d · π und A = r² · π"],
    errorMap: [],
    estimatedTimeSec: 420,
  };
}
/** Geld mit zwei Nachkommastellen, außer bei ganzen Euro. */
const geldText = (x: number) => (Number.isInteger(Math.round(x * 100) / 100) ? zahl(x) : zahl(x, 2));

/** Halbkreis, Viertelkreis, Kreissektor: Flächeninhalt, Umfang, Bogenlänge. */
function kreisteilAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return kreisteilSachaufgabe(skillId, diff, rng);
  const e = rng() < 0.75 ? "cm" : "m";
  const teil: KreisTeil = lv === 0 ? "halbkreis" : lv === 1 ? pick(rng, ["halbkreis", "viertelkreis"] as const) : lv === 2 ? pick(rng, ["viertelkreis", "sektor", "sektor"] as const) : "sektor";
  const winkel = teil === "sektor" ? pick(rng, lv === 2 ? [30, 36, 45, 60, 72, 120, 150, 240, 270] : [40, 80, 100, 135, 140, 160, 200, 225, 300]) : kreisWinkel({ teil, winkel: 0 });
  const anteil = winkel / 360;
  const beide = format === "cloze";
  const flaeche = !beide && rng() < 0.5;
  // ein Radius, mit dem der Anteil keine endlose Kommazahl gibt (120° bei r = 5: 25 : 3 = 8,333…)
  const passt = (x: number) => (beide || flaeche ? stellenVon(x * x * anteil) <= 2 : true) && (beide || !flaeche ? stellenVon(2 * x * anteil) <= 2 : true);
  let r = lv <= 1 ? rint(rng, 2, 12) : rint(rng, 3, 15);
  for (let t = 0; t < 40 && !passt(r); t++) r = lv <= 1 ? rint(rng, 2, 12) : rint(rng, 3, 15);
  const d = 2 * r;
  const mitD = teil === "halbkreis" && rng() < 0.5;
  const name = KREIS_TEILE[teil];
  const figur = kreisBild({ teil, winkel, strecke: mitD ? "durchmesser" : "radius", text: mitD ? `d = ${zahl(d)} ${e}` : `r = ${zahl(r)} ${e}`, getoent: true, winkelZeigen: teil !== "halbkreis", ganzerKreis: lv <= 1 || (teil === "sektor" && rng() < 0.5) });
  const anteilText = teil === "halbkreis" ? " : 2" : teil === "viertelkreis" ? " : 4" : ` · ${winkel} : 360`;
  const anteilFormel = teil === "halbkreis" ? " : 2" : teil === "viertelkreis" ? " : 4" : " · α : 360°";
  // was gefragt ist: Fläche, Umfang (Halbkreis, Viertelkreis) oder Bogenlänge (Sektor)
  const zweite = teil === "sektor" ? "b" : "u";
  const fA = r * r * anteil;
  const fZ = d * anteil;
  const dazu = teil === "sektor" ? 0 : teil === "halbkreis" ? d : 2 * r;
  const rund = beide && (piWert(fA).gerundet || piWert(fZ, dazu).gerundet);
  const A = piWert(fA, 0, rund);
  const Z = piWert(fZ, dazu, rund);
  const rZeile = mitD ? `r = ${roh(d)} : 2 = ${roh(r)}` : null;
  const aZeile = piZeile(`A = ${roh(r)}² · 3,14${anteilText}`, A);
  const zZeile =
    teil === "sektor"
      ? piZeile(`b = 2 · ${roh(r)} · 3,14 · ${winkel} : 360`, Z)
      : teil === "halbkreis"
        ? piZeile(`u = ${roh(d)} · 3,14 : 2 + ${roh(d)}`, Z)
        : piZeile(`u = 2 · ${roh(r)} · 3,14 : 4 + 2 · ${roh(r)}`, Z);
  const aWeg = `${rZeile ? `${rZeile}\n` : ""}A = r² · π${anteilFormel}\n${aZeile}`;
  const zWeg =
    teil === "sektor"
      ? `b = 2 · r · π · α : 360°\n${zZeile}`
      : teil === "halbkreis"
        ? `Zum Umfang gehören der halbe Kreisbogen und der Durchmesser.\nu = d · π : 2 + d\n${zZeile}`
        : `Zum Umfang gehören der Viertelbogen und zwei Radien.\nu = 2 · r · π : 4 + 2 · r\n${zZeile}`;
  const hinweis = (g: boolean) => `${PI_TEXT}${g ? ` ${RUND_TEXT}` : ""}`;
  const hilfenA = [teil === "sektor" ? `Der Sektor ist der Anteil ${winkel}° : 360° vom ganzen Kreis.` : `Ein ${name} ist ${teil === "halbkreis" ? "die Hälfte" : "ein Viertel"} vom ganzen Kreis.`, `A = r² · π${anteilFormel}`];
  if (beide) {
    if (teil === "sektor") {
      const b = kuerzen({ z: winkel, n: 360 });
      return aufgabe(skillId, diff, "cloze", {
        prompt: `Der Kreissektor ist ein Teil des ganzen Kreises. ${hinweis(rund)}\nAnteil am ganzen Kreis (als Bruch): ___\nA = ___ ${e}²\nb = ___ ${e}`,
        figur,
        answer: { blanks: [[bruchText(b)], piAntworten(A), piAntworten(Z)], mode: "value" },
        solution: `Anteil: ${winkel}° : 360° = ${bruchText(b)}\n${aWeg} ${e}²\n${zWeg} ${e}`,
        hints: [hilfenA[0], "A = r² · π · α : 360° und b = 2 · r · π · α : 360°"],
      });
    }
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Berechne Flächeninhalt und Umfang des ${name}es. ${hinweis(rund)}\nA = ___ ${e}²\nu = ___ ${e}`,
      figur,
      answer: { blanks: [piAntworten(A), piAntworten(Z)], mode: "value" },
      solution: `${aWeg} ${e}²\n${zWeg} ${e}`,
      hints: [hilfenA[0], teil === "halbkreis" ? "Beim Umfang gehört der Durchmesser dazu." : "Beim Umfang gehören die zwei Radien dazu."],
    });
  }
  const p = flaeche ? A : Z;
  const einheit = flaeche ? `${e}²` : e;
  const fehler: (Fehler | null)[] = flaeche
    ? [
        piFehler(r * r, 0, p, "Den ganzen Kreis berechnet, nicht den Anteil"),
        teil === "sektor" ? piFehler((r * r * 360) / winkel, 0, p, "Anteil verkehrt gebildet (360° : α statt α : 360°)") : null,
        teil === "sektor" ? piFehler(fZ, 0, p, "Bogenlänge und Flächeninhalt verwechselt") : null,
        mitD ? piFehler(d * d * anteil, 0, p, "Mit dem Durchmesser statt dem Radius gerechnet") : null,
      ]
    : teil === "sektor"
      ? [piFehler(d, 0, p, "Den ganzen Umfang berechnet, nicht den Anteil"), piFehler((d * 360) / winkel, 0, p, "Anteil verkehrt gebildet (360° : α statt α : 360°)"), piFehler(fA, 0, p, "Bogenlänge und Flächeninhalt verwechselt")]
      : [
          piFehler(fZ, 0, p, teil === "halbkreis" ? "Beim Umfang des Halbkreises den Durchmesser vergessen" : "Beim Umfang die beiden Radien vergessen"),
          piFehler(d, 0, p, "Den Umfang des ganzen Kreises berechnet"),
        ];
  const fehl = fehlerOhneAlle(piAntworten(p), fehler);
  const was = flaeche ? "den Flächeninhalt" : teil === "sektor" ? "die Länge des Kreisbogens b" : "den Umfang";
  const frage = `Berechne ${was} des ${teil === "sektor" ? "Kreissektors" : `${name}es`}. ${hinweis(p.gerundet)}`;
  const solution = `${flaeche ? aWeg : zWeg} ${einheit}`;
  const hilfen = flaeche ? hilfenA : teil === "sektor" ? [hilfenA[0], "b = 2 · r · π · α : 360°"] : [teil === "halbkreis" ? "Der Umfang ist der halbe Kreisbogen und der Durchmesser." : "Der Umfang ist der Viertelbogen und zwei Radien.", teil === "halbkreis" ? "u = d · π : 2 + d" : "u = 2 · r · π : 4 + 2 · r"];
  if (format === "rechenweg") {
    const zeilen = [...(rZeile && flaeche ? [rZeile] : []), flaeche ? aZeile : zZeile];
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${frage} ${WEG}`,
      figur,
      answer: { accepted: piAntworten(p).map((x) => `${x} ${einheit}`), unit: einheit, form: null, round: p.gerundet ? 1 : null, needWay: true },
      solution,
      steps: zeilen.map(zahlenWeg),
      hints: hilfen,
      errorMap: fehl.map((f) => ({ ...f, answer: `${f.answer.replace(/\s/g, "")} ${einheit}` })),
    });
  }
  if (format === "mc") {
    const m = auswahl(rng, `${p.text} ${einheit}`, fehl.map((f) => ({ ...f, answer: `${f.answer} ${einheit}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${einheit} an.`, figur, answer: { accepted: piAntworten(p).flatMap((x) => mitEinheit(x, einheit)), mode: "value" }, solution, hints: hilfen, errorMap: fehl });
}

/** Pizza in gleich großen Stücken oder ein Rasensprenger, der einen Kreissektor bewässert. */
function kreisteilSachaufgabe(skillId: string, diff: Difficulty, rng: Rng): TaskDraft {
  const pizza = rng() < 0.5;
  let parts: (PartView & PartSolution)[];
  let prompt: string;
  let figur: Kreis;
  if (pizza) {
    const stuecke = pick(rng, [4, 6, 8]);
    // ein Durchmesser, mit dem ein Stück keine endlose Kommazahl gibt
    const durchmesser = shuffle(rng, [24, 28, 30, 32, 36]);
    const d = durchmesser.find((x) => stellenVon((x * x) / 4 / stuecke) <= 2 && stellenVon(x / stuecke) <= 2) ?? 24;
    const r = d / 2;
    const winkel = 360 / stuecke;
    const roh1 = piWert((r * r) / stuecke);
    const roh2 = piWert(d / stuecke);
    const rund = roh1.gerundet || roh2.gerundet;
    const A = piWert((r * r) / stuecke, 0, rund);
    const b = piWert(d / stuecke, 0, rund);
    prompt = `Eine runde Pizza mit dem Durchmesser d = ${d} cm wird in ${stuecke} gleich große Stücke geschnitten. Im Bild ist ein Stück getönt. ${PI_TEXT}${rund ? ` ${RUND_TEXT}` : ""}`;
    figur = kreisBild({ teil: "sektor", winkel, strecke: "radius", text: `r = ${r} cm`, getoent: true, ganzerKreis: true });
    parts = [
      { label: "a)", prompt: "Wie groß ist der Winkel eines Stücks in der Mitte?", kind: "zahl", accepted: [`${winkel}°`], unit: "°", solution: `360° : ${stuecke} = ${winkel}°`, errorMap: [{ answer: `${stuecke}°`, label: "Die Anzahl der Stücke statt des Winkels angegeben" }] },
      { label: "b)", prompt: "Wie groß ist die Fläche eines Stücks?", kind: "zahl", accepted: piAntworten(A).map((x) => `${x} cm²`), unit: "cm²", round: rund ? 1 : null, solution: `A = r² · π : ${stuecke} = ${r}² · 3,14 : ${stuecke} ${rund ? "≈" : "="} ${A.text} cm²`, errorMap: [{ answer: `${zahl(rundeAuf(d * d * 3.14 / stuecke, rund ? 1 : 2))} cm²`, label: "Mit dem Durchmesser statt dem Radius gerechnet" }] },
      { label: "c)", prompt: "Wie lang ist der Rand (der Kreisbogen) eines Stücks?", kind: "zahl", accepted: piAntworten(b).map((x) => `${x} cm`), unit: "cm", round: rund ? 1 : null, solution: `b = d · π : ${stuecke} = ${d} · 3,14 : ${stuecke} ${rund ? "≈" : "="} ${b.text} cm` },
    ];
  } else {
    const winkel = pick(rng, [72, 90, 144, 180, 216, 270]);
    const r = rint(rng, 3, 9);
    const roh1 = piWert((r * r * winkel) / 360);
    const roh2 = piWert((2 * r * winkel) / 360);
    const rund = roh1.gerundet || roh2.gerundet;
    const A = piWert((r * r * winkel) / 360, 0, rund);
    const b = piWert((2 * r * winkel) / 360, 0, rund);
    const prozent = (winkel / 360) * 100;
    prompt = `Ein Rasensprenger dreht sich hin und her und bewässert dabei einen Kreissektor mit α = ${winkel}°. Das Wasser reicht ${r} m weit. ${PI_TEXT}${rund ? ` ${RUND_TEXT}` : ""}`;
    figur = kreisBild({ teil: "sektor", winkel, strecke: "radius", text: `r = ${r} m`, getoent: true, winkelZeigen: true, ganzerKreis: true });
    parts = [
      { label: "a)", prompt: "Wie groß ist die Rasenfläche, die bewässert wird?", kind: "zahl", accepted: piAntworten(A).map((x) => `${x} m²`), unit: "m²", round: rund ? 1 : null, solution: `A = r² · π · α : 360° = ${r}² · 3,14 · ${winkel} : 360 ${rund ? "≈" : "="} ${A.text} m²`, errorMap: [{ answer: `${zahl(rundeAuf(r * r * 3.14, rund ? 1 : 2))} m²`, label: "Den ganzen Kreis berechnet, nicht den Anteil" }] },
      { label: "b)", prompt: "Wie lang ist der äußere Rand der bewässerten Fläche (der Kreisbogen)?", kind: "zahl", accepted: piAntworten(b).map((x) => `${x} m`), unit: "m", round: rund ? 1 : null, solution: `b = 2 · r · π · α : 360° = 2 · ${r} · 3,14 · ${winkel} : 360 ${rund ? "≈" : "="} ${b.text} m` },
      { label: "c)", prompt: "Wie viel Prozent der ganzen Kreisfläche sind das?", kind: "zahl", accepted: [`${zahl(prozent)} %`], unit: "%", solution: `${winkel}° : 360° = ${zahl(winkel / 360)} = ${zahl(prozent)} %`, errorMap: [{ answer: `${winkel} %`, label: "Den Winkel als Prozentsatz genommen" }] },
    ];
  }
  return {
    type: "sachaufgabe",
    skillId,
    skillIds: [skillId],
    category: "sachaufgabe",
    difficulty: diff,
    prompt,
    data: { parts: parts.map(({ label, prompt: p, kind }) => ({ label, prompt: p, kind })), figure: figur },
    answer: { parts: parts.map(({ accepted, unit, round, solution, errorMap }) => ({ accepted, unit: unit ?? null, round: round ?? null, follow: null, solution, errorMap })) },
    solution: parts.map((p) => `${p.label} ${p.solution}`).join("\n"),
    hints: ["Ein Stück ist der Anteil α : 360° vom ganzen Kreis.", "A = r² · π · α : 360° und b = 2 · r · π · α : 360°"],
    errorMap: [],
    estimatedTimeSec: 420,
  };
}

// =====================================================================
// Diagramme: ablesen, vergleichen, zusammenzählen, Häufigkeiten, Mittelwert
// =====================================================================

/** Ein Ding im Diagramm: kurz an der Achse, lang in Antworten, als Satzteil in Fragen. */
type Ding = { name: string; lang: string; satz: string };
type DiaKontext = {
  titel: string;
  achse: string;
  /** was gezählt wird, für Antworten mit Wort („12 Kinder“); leer = nur die Zahl */
  wort: string;
  dinge: Ding[];
  /** wie die Dinge der Reihe nach stehen: fest (Wochentage, Uhrzeiten) oder gemischt */
  fest?: boolean;
  /** passen auch Werte in die Tausende (Gäste im Freibad, nicht Kinder einer Schule) */
  gross?: boolean;
  frage: (x: Ding) => string;
  mehr: (a: Ding, b: Ding) => string;
  gesamt: string;
  meiste: string;
  /** Satz für „Insgesamt waren es N.“ (gesuchte Säule, relative Häufigkeit) */
  insgesamt: (n: string) => string;
};

const tag = (name: string, lang: string): Ding => ({ name, lang, satz: `am ${lang}` });
const WOCHE = [tag("Mo", "Montag"), tag("Di", "Dienstag"), tag("Mi", "Mittwoch"), tag("Do", "Donnerstag"), tag("Fr", "Freitag"), tag("Sa", "Samstag"), tag("So", "Sonntag")];
const ding = (name: string, satz: string, lang = name): Ding => ({ name, lang, satz });

/** Umfragen und Zählungen in der Volksschule: kleine Anzahlen. */
const VS_KONTEXTE: DiaKontext[] = [
  {
    titel: "Umfrage: Lieblingsobst",
    achse: "Anzahl Kinder",
    wort: "Kinder",
    dinge: [ding("Äpfel", "Äpfel"), ding("Bananen", "Bananen"), ding("Birnen", "Birnen"), ding("Trauben", "Trauben"), ding("Erdbeeren", "Erdbeeren"), ding("Kirschen", "Kirschen")],
    frage: (x) => `Wie viele Kinder essen am liebsten ${x.satz}?`,
    mehr: (a, b) => `Wie viele Kinder mehr essen am liebsten ${a.satz} als ${b.satz}?`,
    gesamt: "Wie viele Kinder wurden insgesamt befragt?",
    meiste: "Welches Obst essen die meisten Kinder am liebsten?",
    insgesamt: (n) => `Insgesamt wurden ${n} Kinder befragt.`,
  },
  {
    titel: "Haustiere der Kinder",
    achse: "Anzahl Kinder",
    wort: "Kinder",
    dinge: [ding("Hund", "einen Hund"), ding("Katze", "eine Katze"), ding("Hase", "einen Hasen"), ding("Fische", "Fische"), ding("Vogel", "einen Vogel"), ding("Pferd", "ein Pferd")],
    frage: (x) => `Wie viele Kinder haben ${x.satz}?`,
    mehr: (a, b) => `Wie viele Kinder mehr haben ${a.satz} als ${b.satz}?`,
    gesamt: "Wie viele Kinder sind es zusammen?",
    meiste: "Welches Haustier haben die meisten Kinder?",
    insgesamt: (n) => `Zusammen sind es ${n} Kinder.`,
  },
  {
    titel: "So kommen wir zur Schule",
    achse: "Anzahl Kinder",
    wort: "Kinder",
    dinge: [ding("zu Fuß", "zu Fuß"), ding("Rad", "mit dem Rad"), ding("Bus", "mit dem Bus"), ding("Auto", "mit dem Auto"), ding("Roller", "mit dem Roller")],
    frage: (x) => `Wie viele Kinder kommen ${x.satz} zur Schule?`,
    mehr: (a, b) => `Wie viele Kinder mehr kommen ${a.satz} als ${b.satz}?`,
    gesamt: "Wie viele Kinder wurden insgesamt gefragt?",
    meiste: "Wie kommen die meisten Kinder zur Schule?",
    insgesamt: (n) => `Insgesamt wurden ${n} Kinder gefragt.`,
  },
  {
    titel: "Ausgeborgte Bücher in der Schulbücherei",
    achse: "Anzahl Bücher",
    wort: "Bücher",
    dinge: WOCHE.slice(0, 5),
    fest: true,
    frage: (x) => `Wie viele Bücher wurden ${x.satz} ausgeborgt?`,
    mehr: (a, b) => `Wie viele Bücher wurden ${a.satz} mehr ausgeborgt als ${b.satz}?`,
    gesamt: "Wie viele Bücher wurden in dieser Woche ausgeborgt?",
    meiste: "An welchem Tag wurden die meisten Bücher ausgeborgt?",
    insgesamt: (n) => `In dieser Woche wurden ${n} Bücher ausgeborgt.`,
  },
  {
    titel: "Gesammelte Kastanien",
    achse: "Anzahl Kastanien",
    wort: "Kastanien",
    dinge: ["1a", "1b", "2a", "2b", "3a", "3b"].map((k) => ding(k, `die ${k}`, `die ${k}`)),
    fest: true,
    frage: (x) => `Wie viele Kastanien hat ${x.satz} gesammelt?`,
    mehr: (a, b) => `Wie viele Kastanien hat ${a.satz} mehr gesammelt als ${b.satz}?`,
    gesamt: "Wie viele Kastanien wurden insgesamt gesammelt?",
    meiste: "Welche Klasse hat die meisten Kastanien gesammelt?",
    insgesamt: (n) => `Insgesamt wurden ${n} Kastanien gesammelt.`,
  },
];

/** Unterstufe: größere Zahlen. */
const US_KONTEXTE: DiaKontext[] = [
  {
    titel: "Gäste im Freibad",
    achse: "Anzahl Gäste",
    wort: "Gäste",
    dinge: WOCHE,
    fest: true,
    gross: true,
    frage: (x) => `Wie viele Gäste kamen ${x.satz} ins Freibad?`,
    mehr: (a, b) => `Wie viele Gäste kamen ${a.satz} mehr als ${b.satz}?`,
    gesamt: "Wie viele Gäste kamen an diesen Tagen insgesamt?",
    meiste: "An welchem Tag kamen die meisten Gäste?",
    insgesamt: (n) => `An diesen Tagen kamen insgesamt ${n} Gäste.`,
  },
  {
    titel: "Verkaufte Kuchenstücke beim Schulfest",
    achse: "Anzahl Stück",
    wort: "Stück",
    dinge: [ding("Schoko", "Schokokuchen", "Schokokuchen"), ding("Topfen", "Topfenkuchen", "Topfenkuchen"), ding("Apfel", "Apfelkuchen", "Apfelkuchen"), ding("Marmor", "Marmorkuchen", "Marmorkuchen"), ding("Nuss", "Nusskuchen", "Nusskuchen"), ding("Karotte", "Karottenkuchen", "Karottenkuchen")],
    frage: (x) => `Wie viele Stück ${x.satz} wurden verkauft?`,
    mehr: (a, b) => `Wie viele Stück ${a.satz} wurden mehr verkauft als ${b.satz}?`,
    gesamt: "Wie viele Kuchenstücke wurden insgesamt verkauft?",
    meiste: "Von welchem Kuchen wurden die meisten Stücke verkauft?",
    insgesamt: (n) => `Insgesamt wurden ${n} Kuchenstücke verkauft.`,
  },
  {
    titel: "Lieblingssport an unserer Schule",
    achse: "Anzahl Kinder",
    wort: "Kinder",
    dinge: [ding("Fußball", "Fußball"), ding("Schwimmen", "Schwimmen"), ding("Tanzen", "Tanzen"), ding("Klettern", "Klettern"), ding("Radfahren", "Radfahren"), ding("Volleyball", "Volleyball")],
    frage: (x) => `Wie viele Kinder nannten ${x.satz}?`,
    mehr: (a, b) => `Wie viele Kinder mehr nannten ${a.satz} als ${b.satz}?`,
    gesamt: "Wie viele Kinder wurden insgesamt befragt?",
    meiste: "Welcher Sport wurde am häufigsten genannt?",
    insgesamt: (n) => `Insgesamt wurden ${n} Kinder befragt.`,
  },
];

/** Eine Umfrage für Häufigkeiten (die Gesamtzahl zählt). */
const UMFRAGEN = [VS_KONTEXTE[0], VS_KONTEXTE[2], US_KONTEXTE[2]];

/** Einteilung der Achse je Stufe: Abstand der Gitterlinien, jede wievielte Linie eine Zahl hat, größter Wert in Linien. */
type Einteilung = { schritt: number; zahlenAlle: number; linien: number };
function einteilung(vs: boolean, lv: number, rng: Rng, gross = false): Einteilung {
  // Gäste im Freibad: schon leicht mit Zehnern und Fünfzigern
  if (gross)
    return [
      { schritt: 10, zahlenAlle: 1, linien: 12 },
      pick(rng, [{ schritt: 20, zahlenAlle: 1, linien: 12 }, { schritt: 50, zahlenAlle: 2, linien: 12 }]),
      pick(rng, [{ schritt: 50, zahlenAlle: 2, linien: 12 }, { schritt: 25, zahlenAlle: 4, linien: 16 }]),
      pick(rng, [{ schritt: 50, zahlenAlle: 2, linien: 14 }, { schritt: 250, zahlenAlle: 2, linien: 12 }]),
    ][lv];
  if (vs) return [{ schritt: 1, zahlenAlle: 1, linien: 10 }, { schritt: 2, zahlenAlle: 1, linien: 10 }, pick(rng, [{ schritt: 2, zahlenAlle: 2, linien: 12 }, { schritt: 5, zahlenAlle: 2, linien: 10 }]), pick(rng, [{ schritt: 10, zahlenAlle: 2, linien: 10 }, { schritt: 5, zahlenAlle: 2, linien: 16 }])][lv];
  return [
    { schritt: 2, zahlenAlle: 1, linien: 12 },
    pick(rng, [{ schritt: 5, zahlenAlle: 2, linien: 12 }, { schritt: 10, zahlenAlle: 1, linien: 10 }]),
    pick(rng, [{ schritt: 20, zahlenAlle: 2, linien: 12 }, { schritt: 25, zahlenAlle: 2, linien: 12 }, { schritt: 10, zahlenAlle: 2, linien: 15 }]),
    pick(rng, [{ schritt: 20, zahlenAlle: 5, linien: 15 }, { schritt: 25, zahlenAlle: 4, linien: 12 }]),
  ][lv];
}

/** Verschiedene Werte (Vielfache von `schritt`, 1 bis `linien` Linien hoch) mit genau einem größten und einem kleinsten. */
function dingWerte(rng: Rng, anzahl: number, e: Einteilung): number[] {
  for (let t = 0; t < 60; t++) {
    const k = Array.from({ length: anzahl }, () => rint(rng, 1, e.linien));
    const max = Math.max(...k);
    const min = Math.min(...k);
    if (k.filter((x) => x === max).length === 1 && k.filter((x) => x === min).length === 1 && new Set(k).size >= anzahl - 1) return k.map((x) => x * e.schritt);
  }
  return Array.from({ length: anzahl }, (_, i) => ((i * 3) % e.linien + 1) * e.schritt);
}
/** Die Achse geht eine beschriftete Linie über den größten Wert hinaus. */
const achsenEnde = (max: number, e: Einteilung) => Math.ceil((max + e.schritt) / (e.schritt * e.zahlenAlle)) * e.schritt * e.zahlenAlle;

function diagrammBild(k: DiaKontext, dinge: Ding[], werte: number[], e: Einteilung, o: Partial<Diagramm> = {}): Diagramm {
  return { art: "diagramm", form: "saeulen", titel: k.titel, achse: k.achse, min: 0, max: achsenEnde(Math.max(...werte), e), schritt: e.schritt, zahlenAlle: e.zahlenAlle, werte: dinge.map((d, i) => ({ name: d.name, wert: werte[i] })), werteZeigen: false, ...o };
}
/** Die Dinge eines Kontexts für ein Diagramm: der Reihe nach (Tage) oder gemischt. */
const dingeFuer = (rng: Rng, k: DiaKontext, anzahl: number) => (k.fest ? k.dinge.slice(0, anzahl) : shuffle(rng, k.dinge).slice(0, anzahl));

const ABLESE_HILFEN = (e: Einteilung) => [
  "Lies zuerst, was die Achse zählt und wie sie eingeteilt ist.",
  e.zahlenAlle > 1 ? `Nicht jede Linie hat eine Zahl: von einer Zahl zur nächsten sind es ${e.zahlenAlle} Linien. Eine Linie ist ${zahl(e.schritt)}.` : `Von einer Linie zur nächsten sind es ${zahl(e.schritt)}.`,
];
const ablesenWeg = (x: Ding, v: number, e: Einteilung, fuer = "Die Säule") =>
  `${fuer} bei „${x.name}“ reicht bis zur Linie bei ${zahl(v)}${e.schritt !== 1 ? ` (${zahl(v / e.schritt)} Linien, jede ist ${zahl(e.schritt)})` : ""}.`;
/** Fehler beim Ablesen: Linien gezählt statt Werte, die Einteilung der Zahlen genommen, um eine Linie verzählt. */
function ablesenFehler(v: number, e: Einteilung): Fehler[] {
  return [
    ...(e.schritt !== 1 ? [{ answer: zahl(v / e.schritt), label: "Einteilung der Achse nicht beachtet (jede Linie als 1 gezählt)" }] : []),
    ...(e.zahlenAlle > 1 ? [{ answer: zahl(v * e.zahlenAlle), label: "Einteilung der Achse nicht beachtet (jede Linie so groß wie der Abstand der Zahlen)" }] : []),
    { answer: zahl(v + e.schritt), label: "Um eine Linie verzählt" },
    ...(v - e.schritt > 0 ? [{ answer: zahl(v - e.schritt), label: "Um eine Linie verzählt" }] : []),
  ];
}
/** Antwort mit dem gezählten Wort („12 Kinder“, „12“). */
const mitWort = (wert: string, wort: string) => (wort ? mitEinheit(wert, wort) : [wert]);

/**
 * Säulen- und Balkendiagramme lesen: ablesen, vergleichen, zusammenzählen, die meisten; in der Unterstufe auch eine
 * fehlende Säule aus der Gesamtzahl und eine abgeschnittene Achse.
 */
function diagrammAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng, vs: boolean): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  if (!vs && rng() < 0.3 && format !== "rechenweg") {
    const t = linienAufgabe(skillId, diff, format, rng);
    if (t) return t;
  }
  if (!vs && lv >= 2 && format === "mc" && rng() < 0.35) return abgeschnittenAufgabe(skillId, diff, rng);
  const k = pick(rng, vs ? (lv <= 1 ? VS_KONTEXTE.slice(0, 4) : VS_KONTEXTE) : US_KONTEXTE);
  const anzahl = Math.min(k.dinge.length, vs ? rint(rng, 4, 5) : rint(rng, 4, 6));
  const e = einteilung(vs, lv, rng, k.gross);
  const dinge = dingeFuer(rng, k, anzahl);
  const werte = dingWerte(rng, anzahl, e);
  const balken = !vs || lv >= 1 ? rng() < 0.35 : false;
  const form: DiagrammForm = balken ? "balken" : "saeulen";
  const fuer = balken ? "Der Balken" : "Die Säule";
  const figur = diagrammBild(k, dinge, werte, e, { form });
  const hilfen = ABLESE_HILFEN(e);
  const summe = werte.reduce((a, b) => a + b, 0);
  const wo = (x: Ding) => dinge.indexOf(x);
  if (format === "cloze") {
    // zwei Dinge mit verschiedenen Werten
    const gemischt = shuffle(rng, dinge);
    const [a, b] = [gemischt[0], gemischt.find((x) => werte[wo(x)] !== werte[wo(gemischt[0])])!];
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Lies im Diagramm ab.\n${a.lang}: ___${k.wort ? ` ${k.wort}` : ""}\n${b.lang}: ___${k.wort ? ` ${k.wort}` : ""}`,
      figur,
      answer: { blanks: [[zahl(werte[wo(a)])], [zahl(werte[wo(b)])]], mode: "value" },
      solution: `${ablesenWeg(a, werte[wo(a)], e, fuer)}\n${ablesenWeg(b, werte[wo(b)], e, fuer)}`,
      hints: hilfen,
    });
  }
  if (format === "rechenweg") {
    const gesamt = rng() < 0.55;
    const [a, b] = [...dinge].sort((x, y) => werte[wo(y)] - werte[wo(x)]);
    const zeile = gesamt ? `${werte.map(roh).join(" + ")} = ${roh(summe)}` : `${roh(werte[wo(a)])} − ${roh(werte[wo(b)])} = ${roh(werte[wo(a)] - werte[wo(b)])}`;
    const ergebnis = gesamt ? summe : werte[wo(a)] - werte[wo(b)];
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${gesamt ? k.gesamt : k.mehr(a, b)} Lies die Werte ab und ${gesamt ? "zähle sie zusammen" : "rechne"}. ${WEG}`,
      figur,
      answer: { accepted: [roh(ergebnis)], unit: null, form: null, needWay: true },
      solution: gesamt ? `Die Werte: ${dinge.map((x, i) => `${x.lang} ${zahl(werte[i])}`).join(", ")}\n${zeile}` : `${ablesenWeg(a, werte[wo(a)], e, fuer)}\n${ablesenWeg(b, werte[wo(b)], e, fuer)}\n${zeile}`,
      steps: [zeile],
      hints: [...hilfen.slice(1), gesamt ? "Zähle alle Werte zusammen." : "Rechne den größeren minus den kleineren Wert."],
      errorMap: gesamt ? [] : fehlerOhne(roh(ergebnis), [{ answer: roh(werte[wo(a)] + werte[wo(b)]), label: "Addiert statt subtrahiert" }]),
    });
  }
  // Multiple Choice: wo ist es am meisten?
  if (format === "mc" && rng() < 0.4) {
    const options = dinge.slice(0, 4).map((x) => x.lang);
    const reihe = dinge.slice(0, 4);
    const w4 = werte.slice(0, 4);
    const correct = w4.indexOf(Math.max(...w4));
    const kleinste = w4.indexOf(Math.min(...w4));
    const frage = reihe.length === dinge.length ? k.meiste : `${k.meiste} Wähle aus: ${options.join(", ")}.`;
    return aufgabe(skillId, diff, "mc", {
      prompt: frage,
      figur,
      data: { options },
      answer: { correct },
      solution: `${balken ? "Der längste Balken" : "Die höchste Säule"} gehört zu „${reihe[correct].name}“ (${zahl(w4[correct])}).`,
      hints: [balken ? "Such den längsten Balken." : "Such die höchste Säule.", "Vergleiche, wie weit jede reicht."],
      errorMap: kleinste !== correct ? [{ answer: String(kleinste), label: balken ? "Den kürzesten statt den längsten Balken genommen" : "Die niedrigste statt die höchste Säule genommen" }] : [],
    });
  }
  // gesuchte Säule: aus der Gesamtzahl rechnen (Unterstufe)
  if (!vs && format === "calc" && rng() < 0.3) {
    const i = rint(rng, 0, anzahl - 1);
    const x = dinge[i];
    const andere = werte.filter((_, j) => j !== i);
    const gesucht = diagrammBild(k, dinge, werte, e, { form, werte: dinge.map((d, j) => ({ name: d.name, wert: werte[j], ...(j === i ? { gesucht: true } : {}) })) });
    return aufgabe(skillId, diff, "calc", {
      prompt: `${k.insgesamt(zahl(summe))} Im Diagramm fehlt ${balken ? "der Balken" : "die Säule"} bei „${x.name}“. ${k.frage(x)}`,
      figur: gesucht,
      answer: { accepted: mitWort(zahl(werte[i]), k.wort), mode: "value" },
      solution: `Die anderen zusammen: ${andere.map(roh).join(" + ")} = ${roh(summe - werte[i])}\n${roh(summe)} − ${roh(summe - werte[i])} = ${roh(werte[i])}`,
      hints: ["Lies alle anderen Werte ab und zähle sie zusammen.", "Was zur Gesamtzahl fehlt, gehört zur fehlenden Säule."],
      errorMap: fehlerOhne(zahl(werte[i]), [{ answer: zahl(summe - werte[i]), label: "Die anderen Werte addiert, aber nicht von der Gesamtzahl abgezogen" }]),
    });
  }
  // Rechnung oder Multiple Choice: ablesen, vergleichen, zusammenzählen
  const art = format === "mc" ? pick(rng, ["ablesen", "ablesen", "mehr"] as const) : pick(rng, ["ablesen", "ablesen", "mehr", "gesamt"] as const);
  let richtig: number;
  let frage: string;
  let solution: string;
  let fehler: (Fehler | null)[];
  if (art === "ablesen") {
    const x = pick(rng, dinge);
    richtig = werte[wo(x)];
    frage = k.frage(x);
    solution = ablesenWeg(x, richtig, e, fuer);
    fehler = ablesenFehler(richtig, e);
  } else if (art === "mehr") {
    // zwei Dinge mit verschiedenen Werten, das größere zuerst
    const gemischt = shuffle(rng, dinge);
    const zweites = gemischt.find((x) => werte[wo(x)] !== werte[wo(gemischt[0])])!;
    const [a, b] = [gemischt[0], zweites].sort((x, y) => werte[wo(y)] - werte[wo(x)]);
    const va = werte[wo(a)];
    const vb = werte[wo(b)];
    richtig = va - vb;
    frage = k.mehr(a, b);
    solution = `${ablesenWeg(a, va, e, fuer)}\n${ablesenWeg(b, vb, e, fuer)}\n${zahl(va)} − ${zahl(vb)} = ${zahl(richtig)}`;
    fehler = [{ answer: zahl(va + vb), label: "Addiert statt subtrahiert" }, ...(e.schritt !== 1 ? [{ answer: zahl(richtig / e.schritt), label: "Einteilung der Achse nicht beachtet (jede Linie als 1 gezählt)" }] : [])];
  } else {
    richtig = summe;
    frage = k.gesamt;
    solution = `Die Werte: ${dinge.map((x, i) => `${x.lang} ${zahl(werte[i])}`).join(", ")}\n${werte.map((v) => zahl(v)).join(" + ")} = ${zahl(summe)}`;
    const ohne = Math.min(...werte);
    fehler = [{ answer: zahl(summe - ohne), label: "Einen Wert beim Zusammenzählen vergessen" }];
  }
  const fehl = fehlerOhne(zahl(richtig), fehler);
  const hilfenArt = art === "mehr" ? [...hilfen, "Lies beide Werte ab und rechne den Unterschied aus."] : art === "gesamt" ? [...hilfen, "Lies jeden Wert ab und zähle alle zusammen."] : hilfen;
  if (format === "mc") {
    const w = k.wort ? ` ${k.wort}` : "";
    const m = auswahl(rng, `${zahl(richtig)}${w}`, fehl.map((f) => ({ ...f, answer: `${f.answer}${w}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfenArt, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: frage, figur, answer: { accepted: mitWort(zahl(richtig), k.wort), mode: "value" }, solution, hints: hilfenArt, errorMap: fehl });
}

/** Die Säule von B ist doppelt so hoch wie die von A, aber die Achse beginnt nicht bei 0. */
function abgeschnittenAufgabe(skillId: string, diff: Difficulty, rng: Rng): TaskDraft {
  const k = US_KONTEXTE[0];
  const schritt = pick(rng, [10, 20]);
  const unten = pick(rng, [200, 300, 400, 500]);
  const z = rint(rng, 2, 4);
  const [a, b] = shuffle(rng, k.dinge.slice(0, 7)).slice(0, 2).sort((x, y) => k.dinge.indexOf(x) - k.dinge.indexOf(y));
  const va = unten + z * schritt;
  const vb = unten + 2 * z * schritt;
  const [ersterW, zweiterW] = rng() < 0.5 ? [va, vb] : [vb, va];
  const klein = ersterW < zweiterW ? a : b;
  const gross = ersterW < zweiterW ? b : a;
  const figur: Diagramm = { art: "diagramm", form: "saeulen", titel: k.titel, achse: k.achse, min: unten, max: unten + (2 * z + 2) * schritt, schritt, zahlenAlle: 2, werte: [{ name: a.name, wert: ersterW }, { name: b.name, wert: zweiterW }], werteZeigen: false };
  const d = vb - va;
  const richtig = `${cap(gross.satz)} kamen ${zahl(d)} Gäste mehr als ${klein.satz}.`;
  const m = auswahl(
    rng,
    richtig,
    [
      { answer: `${cap(gross.satz)} kamen doppelt so viele Gäste wie ${klein.satz}.`, label: "Abgeschnittene Achse übersehen und Unterschiede überschätzt" },
      { answer: `${cap(gross.satz)} kamen ${zahl(d / schritt)} Gäste mehr als ${klein.satz}.`, label: "Einteilung der Achse nicht beachtet (jede Linie als 1 gezählt)" },
      { answer: `${cap(klein.satz)} kamen mehr Gäste als ${gross.satz}.`, label: "Die Säulen verwechselt" },
    ],
  );
  return aufgabe(skillId, diff, "mc", {
    prompt: "Welche Aussage stimmt? Schau genau auf die Achse.",
    figur,
    data: { options: m.options },
    answer: { correct: m.correct },
    solution: `Die Achse beginnt erst bei ${zahl(unten)}, nicht bei 0. Darum sieht der Unterschied größer aus, als er ist.\n${cap(gross.satz)}: ${zahl(vb)}, ${klein.satz}: ${zahl(va)}\n${zahl(vb)} − ${zahl(va)} = ${zahl(d)}`,
    hints: ["Bei welcher Zahl beginnt die Achse?", "Lies beide Werte ab und vergleiche die Zahlen, nicht die Höhen."],
    errorMap: m.errorMap,
  });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Liniendiagramme: Temperatur über den Tag (auch unter 0) und Wachstum einer Pflanze. */
type Linie = { titel: string; achse: string; wort: string; dinge: Ding[]; werte: number[]; e: Einteilung; min: number; frage: (x: Ding) => string; zunahme: (a: Ding, b: Ding) => string; meiste: string; einheitText: string };
function linieFuer(lv: number, rng: Rng): Linie {
  const uhr = (h: number): Ding => ({ name: `${h} Uhr`, lang: `um ${h} Uhr`, satz: `um ${h} Uhr` });
  if (rng() < 0.5) {
    // Temperatur: im Winter ab „schwer“ auch unter 0
    const winter = lv >= 3;
    const zeiten = [6, 8, 10, 12, 14, 16, 18].map(uhr).slice(0, rint(rng, 5, 7));
    const schritt = lv === 0 ? 1 : 2;
    const e: Einteilung = { schritt, zahlenAlle: lv === 0 ? 2 : 1, linien: 10 };
    const tiefst = winter ? -rint(rng, 3, 4) * schritt : rint(rng, 2, 4) * schritt;
    // erst wärmer, dann wieder kühler; die wärmste Stunde gibt es nur einmal
    const spitze = rint(rng, 2, zeiten.length - 2);
    const werte: number[] = [];
    let v = tiefst;
    for (let i = 0; i < zeiten.length; i++) {
      werte.push(v);
      v += (i < spitze ? rint(rng, 1, 3) : -rint(rng, 1, 2)) * schritt;
    }
    // eine beschriftete Linie unter dem kältesten Wert, höchstens bis 0
    const zahlen = schritt * e.zahlenAlle;
    const min = Math.min(0, Math.floor((Math.min(...werte) - schritt) / zahlen) * zahlen);
    return {
      titel: winter ? "Temperatur an einem Wintertag" : "Temperatur an einem Herbsttag",
      achse: "°C",
      wort: "°C",
      dinge: zeiten,
      werte,
      e,
      min,
      frage: (x) => `Wie viel Grad hatte es ${x.satz}?`,
      zunahme: (a, b) => `Um wie viel Grad ist es von ${a.name} bis ${b.name} wärmer geworden?`,
      meiste: "Wann war es am wärmsten?",
      einheitText: "°C",
    };
  }
  const wochen = Array.from({ length: rint(rng, 5, 6) }, (_, i): Ding => ({ name: `${i + 1}. Woche`, lang: `in der ${i + 1}. Woche`, satz: `in der ${i + 1}. Woche` }));
  const e: Einteilung = lv <= 1 ? { schritt: 10, zahlenAlle: lv === 0 ? 1 : 2, linien: 16 } : { schritt: 20, zahlenAlle: 2, linien: 12 };
  const werte: number[] = [];
  let v = rint(rng, 1, 2) * e.schritt;
  for (let i = 0; i < wochen.length; i++) {
    werte.push(v);
    v += rint(rng, 1, 3) * e.schritt;
  }
  return {
    titel: "Höhe einer Sonnenblume",
    achse: "Höhe in cm",
    wort: "cm",
    dinge: wochen,
    werte,
    e,
    min: 0,
    frage: (x) => `Wie hoch war die Sonnenblume ${x.satz}?`,
    zunahme: (a, b) => `Um wie viele Zentimeter ist die Sonnenblume von der ${a.name} bis zur ${b.name} gewachsen?`,
    meiste: "In welcher Woche ist die Sonnenblume am meisten gewachsen?",
    einheitText: "cm",
  };
}

function linienAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  const L = linieFuer(lv, rng);
  const max = Math.ceil((Math.max(...L.werte) + L.e.schritt) / (L.e.schritt * L.e.zahlenAlle)) * L.e.schritt * L.e.zahlenAlle;
  const figur: Diagramm = { art: "diagramm", form: "linie", titel: L.titel, achse: L.achse, min: L.min, max, schritt: L.e.schritt, zahlenAlle: L.e.zahlenAlle, werte: L.dinge.map((x, i) => ({ name: x.name, wert: L.werte[i] })), werteZeigen: false };
  const hilfen = ["Geh vom Punkt waagrecht hinüber zur Achse.", ...ABLESE_HILFEN(L.e).slice(1)];
  const weg = (i: number) => `Der Punkt bei ${L.dinge[i].name} liegt auf der Linie bei ${zahl(L.werte[i])}.`;
  const wort = (s: string) => (L.wort ? `${s} ${L.wort}` : s);
  if (format === "cloze") {
    const [i, j] = shuffle(rng, L.dinge.map((_, k) => k)).slice(0, 2).sort((a, b) => a - b);
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Lies im Diagramm ab.\n${L.dinge[i].name}: ___ ${L.einheitText}\n${L.dinge[j].name}: ___ ${L.einheitText}`,
      figur,
      answer: { blanks: [[zahl(L.werte[i])], [zahl(L.werte[j])]], mode: "value" },
      solution: `${weg(i)}\n${weg(j)}`,
      hints: hilfen,
    });
  }
  if (format === "mc" && rng() < 0.5) {
    // am wärmsten bzw. am meisten gewachsen
    const sonne = L.einheitText === "cm";
    const werte = sonne ? L.werte.slice(1).map((v, i) => v - L.werte[i]) : L.werte;
    const namen = sonne ? L.dinge.slice(1).map((x, i) => `von der ${L.dinge[i].name} bis zur ${x.name}`) : L.dinge.map((x) => x.lang);
    const best = werte.indexOf(Math.max(...werte));
    if (werte.filter((v) => v === werte[best]).length !== 1) return null;
    // vier Antworten, die richtige dabei
    const idx = shuffle(rng, werte.map((_, i) => i).filter((i) => i !== best)).slice(0, 3);
    const reihe = [best, ...idx].sort((a, b) => a - b);
    const options = reihe.map((i) => (sonne ? cap(namen[i]) : namen[i]));
    // wer die größte Höhe sucht, nimmt die letzte Woche
    const spaet = reihe.indexOf(werte.length - 1);
    return aufgabe(skillId, diff, "mc", {
      prompt: L.meiste,
      figur,
      data: { options },
      answer: { correct: reihe.indexOf(best) },
      solution: sonne
        ? `Am meisten gewachsen ist sie dort, wo die Linie am steilsten steigt: ${namen[best]} (${zahl(L.werte[best])} cm → ${zahl(L.werte[best + 1])} cm, also ${zahl(werte[best])} cm).`
        : `Der höchste Punkt liegt bei ${L.dinge[best].name}: ${zahl(L.werte[best])} °C.`,
      hints: sonne ? ["Wo steigt die Linie am steilsten?", "Rechne für jede Woche aus, wie viel dazugekommen ist."] : ["Such den höchsten Punkt der Linie.", "Lies darunter die Uhrzeit ab."],
      errorMap: sonne && spaet >= 0 && reihe[spaet] !== best ? [{ answer: String(spaet), label: "Die größte Höhe statt des größten Zuwachses genommen" }] : [],
    });
  }
  const zunahme = rng() < 0.45;
  let richtig: number;
  let frage: string;
  let solution: string;
  let fehler: (Fehler | null)[];
  if (zunahme) {
    const spitze = L.werte.indexOf(Math.max(...L.werte));
    const i = rint(rng, 0, Math.max(0, spitze - 1));
    const j = rint(rng, i + 1, spitze);
    richtig = L.werte[j] - L.werte[i];
    frage = L.zunahme(L.dinge[i], L.dinge[j]);
    solution = `${weg(i)}\n${weg(j)}\n${zahl(L.werte[j])} − ${br(L.werte[i])} = ${zahl(richtig)}`;
    fehler = [
      L.werte[i] < 0 ? { answer: zahl(L.werte[j] + L.werte[i]), label: "Mit dem Vorzeichen falsch gerechnet" } : { answer: zahl(L.werte[j] + L.werte[i]), label: "Addiert statt subtrahiert" },
      { answer: zahl(L.werte[j]), label: "Nur den zweiten Wert abgelesen" },
    ];
  } else {
    const i = rint(rng, 0, L.dinge.length - 1);
    richtig = L.werte[i];
    frage = L.frage(L.dinge[i]);
    solution = weg(i);
    fehler = [...ablesenFehler(Math.abs(richtig), L.e).map((f) => (richtig < 0 ? { ...f, answer: zahl(-(parseNumber(f.answer) ?? 0)) } : f)), richtig < 0 ? { answer: zahl(-richtig), label: "Das Minus übersehen (unter 0 abgelesen wie über 0)" } : null];
  }
  const fehl = fehlerOhne(zahl(richtig), fehler);
  if (format === "mc") {
    const m = auswahl(rng, wort(zahl(richtig)), fehl.map((f) => ({ ...f, answer: wort(f.answer) })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  const grad = L.einheitText === "°C" ? [`${zahl(richtig)} Grad`, `${zahl(richtig)} °`, `${zahl(richtig)}°`] : [];
  return aufgabe(skillId, diff, "calc", { prompt: `${frage} Gib das Ergebnis in ${L.einheitText} an.`, figur, answer: { accepted: [...mitEinheit(zahl(richtig), L.einheitText), ...grad], mode: "value" }, solution, hints: hilfen, errorMap: fehl });
}

/** Absolute und relative Häufigkeit aus einem Säulendiagramm einer Umfrage. */
function haeufigkeitAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  // Gesamtzahl, Einteilung und Werte so, dass jede relative Häufigkeit ein ganzer Prozentsatz ist
  const plan = [
    { n: 20, e: { schritt: 1, zahlenAlle: 1, linien: 10 } },
    { n: 25, e: { schritt: 1, zahlenAlle: 2, linien: 12 } },
    { n: 40, e: { schritt: 2, zahlenAlle: 1, linien: 10 } },
    pick(rng, [{ n: 200, e: { schritt: 10, zahlenAlle: 2, linien: 10 } }, { n: 80, e: { schritt: 4, zahlenAlle: 1, linien: 10 } }]),
  ][lv];
  const k = pick(rng, UMFRAGEN);
  const anzahl = rint(rng, 4, 5);
  const teile = plan.n / plan.e.schritt;
  let k2: number[] = [];
  for (let t = 0; t < 200; t++) {
    const x = Array.from({ length: anzahl - 1 }, () => rint(rng, 1, Math.min(plan.e.linien, teile - anzahl)));
    const letzte = teile - x.reduce((a, b) => a + b, 0);
    const alle = [...x, letzte];
    if (letzte >= 1 && letzte <= plan.e.linien && alle.filter((v) => v === Math.max(...alle)).length === 1 && new Set(alle).size >= anzahl - 1) {
      k2 = alle;
      break;
    }
  }
  if (!k2.length) k2 = Array.from({ length: anzahl }, (_, i) => (i < anzahl - 1 ? 1 : teile - (anzahl - 1)));
  const werte = k2.map((x) => x * plan.e.schritt);
  const dinge = dingeFuer(rng, k, anzahl);
  const figur = diagrammBild(k, dinge, werte, plan.e);
  const i = rint(rng, 0, anzahl - 1);
  const x = dinge[i];
  const a = werte[i];
  const p = (a / plan.n) * 100;
  // die Gesamtzahl steht in der Angabe, ab „mittel“ zählt man sie selbst zusammen
  const nGegeben = lv <= 1;
  const kopf = nGegeben ? `${k.insgesamt(zahl(plan.n))} ` : "";
  const nWeg = `${werte.map(roh).join(" + ")} = ${roh(plan.n)}`;
  const solution = `${nGegeben ? `Gesamtzahl: ${zahl(plan.n)}` : `Gesamtzahl: ${nWeg}`}\nAbsolute Häufigkeit von ${x.lang}: ${zahl(a)}\nRelative Häufigkeit: ${zahl(a)} : ${zahl(plan.n)} = ${zahl(a / plan.n)} = ${zahl(p)} %`;
  const hilfen = [nGegeben ? "Die absolute Häufigkeit liest du an der Säule ab." : "Zähle zuerst alle Werte zusammen: das ist die Gesamtzahl.", "Relative Häufigkeit = absolute Häufigkeit : Gesamtzahl"];
  const richtig = [`${zahl(p)} %`, `${zahl(p)}%`, zahl(p), zahl(a / plan.n), bruchText({ z: a, n: plan.n })];
  const falschN = (a / (plan.n - a)) * 100;
  const fehler = fehlerOhneAlle(richtig, [
    { answer: zahl(a), label: "Absolute und relative Häufigkeit verwechselt" },
    Number.isInteger(Math.round(falschN * 10) / 10) && Math.abs(falschN * 10 - Math.round(falschN * 10)) < 1e-9 ? { answer: zahl(falschN), label: "Durch die falsche Gesamtzahl dividiert" } : null,
  ]).filter((f) => !/[/,]/.test(f.answer) || f.label !== "Absolute und relative Häufigkeit verwechselt");
  const frage = `${kopf}Wie groß ist die relative Häufigkeit von „${x.name}“? Gib sie in Prozent an.`;
  if (format === "cloze") {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `${kopf}Ergänze für „${x.name}“.\nabsolute Häufigkeit: ___\nrelative Häufigkeit: ___ %`,
      figur,
      answer: { blanks: [[zahl(a)], [zahl(p)]], mode: "value" },
      solution,
      hints: hilfen,
    });
  }
  if (format === "rechenweg") {
    const zeilen = [...(nGegeben ? [] : [nWeg]), `${roh(a)} : ${roh(plan.n)} = ${roh(a / plan.n)}`];
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${frage} ${WEG}`,
      figur,
      answer: { accepted: [`${zahl(p)} %`], unit: "%", form: null, needWay: true },
      solution,
      steps: zeilen,
      hints: hilfen,
      errorMap: fehler.map((f) => ({ ...f, answer: `${f.answer} %` })),
    });
  }
  if (format === "mc") {
    const m = auswahl(rng, `${zahl(p)} %`, fehler.map((f) => ({ ...f, answer: `${f.answer} %` })), [`${zahl(p + 5)} %`, `${zahl(Math.max(1, p - 5))} %`, `${zahl(p * 2)} %`]);
    return aufgabe(skillId, diff, "mc", { prompt: frage.replace(" Gib sie in Prozent an.", ""), figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: frage, figur, answer: { accepted: richtig, mode: "value" }, solution, hints: hilfen, errorMap: fehler });
}

/** Mittelwert, Median und Spannweite aus einem Diagramm. */
type KennKontext = { titel: string; achse: string; wort: string; dinge: Ding[]; schritt: number; zahlenAlle: number; linien: number; form: DiagrammForm; nullErlaubt: boolean; mittelFrage: string };
const KENN_KONTEXTE: KennKontext[] = [
  { titel: "Tore unserer Mannschaft", achse: "Tore", wort: "Tore", dinge: Array.from({ length: 7 }, (_, i) => ding(`${i + 1}. Spiel`, `im ${i + 1}. Spiel`)), schritt: 1, zahlenAlle: 1, linien: 6, form: "saeulen", nullErlaubt: true, mittelFrage: "Wie viele Tore hat die Mannschaft im Durchschnitt pro Spiel geschossen?" },
  { titel: "Gelesene Seiten", achse: "Seiten", wort: "Seiten", dinge: WOCHE, schritt: 5, zahlenAlle: 2, linien: 12, form: "saeulen", nullErlaubt: true, mittelFrage: "Wie viele Seiten wurden im Durchschnitt pro Tag gelesen?" },
  { titel: "Mittagstemperatur in einer Woche", achse: "°C", wort: "°C", dinge: WOCHE, schritt: 1, zahlenAlle: 2, linien: 24, form: "linie", nullErlaubt: false, mittelFrage: "Wie hoch war die Mittagstemperatur im Durchschnitt?" },
];

function kennzahlAufgabe(skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng): TaskDraft | null {
  const lv = LEVEL[diff];
  if (format === "sachaufgabe") return null;
  const k = pick(rng, format === "rechenweg" ? KENN_KONTEXTE.slice(0, 2) : KENN_KONTEXTE);
  const anzahl = lv <= 1 ? pick(rng, [5, 5, 4]) : rint(rng, 5, 7);
  const n = Math.min(anzahl, k.dinge.length);
  // Werte mit ganzem Mittelwert (ab „schwer“ auch ,5), manchmal mit einer 0 (die gehört mitgezählt)
  let werte: number[] = [];
  for (let t = 0; t < 400; t++) {
    const unten = k.form === "linie" ? rint(rng, 8, 14) : k.nullErlaubt && rng() < 0.35 ? 0 : 1;
    const w = Array.from({ length: n }, () => (k.form === "linie" ? rint(rng, unten, unten + 8) : rint(rng, unten === 0 ? 1 : 1, k.linien)) * k.schritt);
    if (unten === 0) w[rint(rng, 0, n - 1)] = 0;
    const summe = w.reduce((a, b) => a + b, 0);
    const mittelOk = lv >= 3 ? Number.isInteger((summe * 2) / n) : Number.isInteger(summe / n);
    const sortiert = [...w].sort((a, b) => a - b);
    // der Median unterscheidet sich vom mittleren Wert in der Reihenfolge des Diagramms (sonst fällt das Ordnen nicht auf)
    if (mittelOk && new Set(w).size >= n - 1 && Math.max(...w) > Math.min(...w) && (n % 2 === 0 || sortiert[(n - 1) / 2] !== w[(n - 1) / 2])) {
      werte = w;
      break;
    }
  }
  if (!werte.length) werte = Array.from({ length: n }, (_, i) => (i + 1) * k.schritt);
  const dinge = k.dinge.slice(0, n);
  const max = Math.ceil((Math.max(...werte) + k.schritt) / (k.schritt * k.zahlenAlle)) * k.schritt * k.zahlenAlle;
  const min = k.form === "linie" ? Math.max(0, Math.floor((Math.min(...werte) - 2 * k.schritt) / (k.schritt * k.zahlenAlle)) * k.schritt * k.zahlenAlle) : 0;
  const figur: Diagramm = { art: "diagramm", form: k.form, titel: k.titel, achse: k.achse, min, max, schritt: k.schritt, zahlenAlle: k.zahlenAlle, werte: dinge.map((d, i) => ({ name: d.name, wert: werte[i] })), werteZeigen: false };
  const summe = werte.reduce((a, b) => a + b, 0);
  const mittel = summe / n;
  const sortiert = [...werte].sort((a, b) => a - b);
  const median = n % 2 ? sortiert[(n - 1) / 2] : (sortiert[n / 2 - 1] + sortiert[n / 2]) / 2;
  const spann = Math.max(...werte) - Math.min(...werte);
  const liste = werte.map((v) => zahl(v)).join(", ");
  const ablesen = `Die Werte: ${liste}`;
  const mittelWeg = `(${werte.map(roh).join(" + ")}) : ${n} = ${roh(summe)} : ${n} = ${roh(mittel)}`;
  const nullen = werte.filter((v) => v === 0).length;
  const w = k.wort === "°C" ? " °C" : "";
  if (format === "cloze") {
    return aufgabe(skillId, diff, "cloze", {
      prompt: `Lies die Werte ab.\ngrößter Wert: ___${w}\nkleinster Wert: ___${w}\nSpannweite: ___${w}`,
      figur,
      answer: { blanks: [[zahl(Math.max(...werte))], [zahl(Math.min(...werte))], [zahl(spann)]], mode: "value" },
      solution: `${ablesen}\nSpannweite = größter Wert − kleinster Wert = ${zahl(Math.max(...werte))} − ${zahl(Math.min(...werte))} = ${zahl(spann)}`,
      hints: ["Such den höchsten und den niedrigsten Wert.", "Spannweite = größter Wert − kleinster Wert"],
    });
  }
  if (format === "rechenweg") {
    return aufgabe(skillId, diff, "rechenweg", {
      prompt: `${k.mittelFrage} Lies die Werte ab und berechne den Mittelwert. ${WEG}`,
      figur,
      answer: { accepted: [zahl(mittel)], unit: null, form: null, needWay: true },
      solution: `${ablesen}\nMittelwert = Summe : Anzahl\n${mittelWeg}`,
      steps: [mittelWeg],
      hints: ["Zähle alle Werte zusammen.", `Dividiere durch die Anzahl der Werte (${n}).`],
      errorMap: fehlerOhne(zahl(mittel), [{ answer: zahl(summe), label: "Nur addiert, nicht durch die Anzahl dividiert" }, nullen ? { answer: zahl(rundeAuf(summe / (n - nullen), 2)), label: "Durch die falsche Anzahl dividiert (Werte mit 0 nicht mitgezählt)" } : null]),
    });
  }
  const art = pick(rng, lv === 0 ? (["mittel", "spann"] as const) : (["mittel", "mittel", "median", "spann"] as const));
  let richtig: number;
  let frage: string;
  let solution: string;
  let hilfen: string[];
  let fehler: (Fehler | null)[];
  if (art === "mittel") {
    richtig = mittel;
    frage = k.mittelFrage;
    solution = `${ablesen}\nMittelwert = Summe : Anzahl\n${mittelWeg}`;
    hilfen = ["Lies alle Werte ab und zähle sie zusammen.", `Dividiere durch die Anzahl der Werte (${n}), auch Werte mit 0 zählen mit.`];
    fehler = [{ answer: zahl(summe), label: "Nur addiert, nicht durch die Anzahl dividiert" }, nullen ? { answer: zahl(rundeAuf(summe / (n - nullen), 2)), label: "Durch die falsche Anzahl dividiert (Werte mit 0 nicht mitgezählt)" } : null];
  } else if (art === "median") {
    richtig = median;
    frage = `Bestimme den Median (Zentralwert) der Werte im Diagramm.`;
    solution = `${ablesen}\nGeordnet: ${sortiert.map((v) => zahl(v)).join(", ")}\n${n % 2 ? `Der mittlere Wert ist ${zahl(median)}.` : `Die beiden mittleren Werte sind ${zahl(sortiert[n / 2 - 1])} und ${zahl(sortiert[n / 2])}: (${zahl(sortiert[n / 2 - 1])} + ${zahl(sortiert[n / 2])}) : 2 = ${zahl(median)}`}`;
    hilfen = ["Ordne die Werte zuerst der Größe nach.", n % 2 ? "Der Median ist der Wert in der Mitte." : "Bei einer geraden Anzahl: der Mittelwert der beiden mittleren Werte."];
    fehler = [
      n % 2 ? { answer: zahl(werte[(n - 1) / 2]), label: "Median gesucht, ohne die Werte vorher zu ordnen" } : { answer: zahl((werte[n / 2 - 1] + werte[n / 2]) / 2), label: "Median gesucht, ohne die Werte vorher zu ordnen" },
      n % 2 ? null : { answer: zahl(sortiert[n / 2 - 1]), label: "Bei gerader Anzahl nur einen der beiden mittleren Werte genommen" },
      n % 2 ? null : { answer: zahl(sortiert[n / 2]), label: "Bei gerader Anzahl nur einen der beiden mittleren Werte genommen" },
    ];
  } else {
    richtig = spann;
    frage = "Wie groß ist die Spannweite der Werte im Diagramm?";
    solution = `${ablesen}\nSpannweite = größter Wert − kleinster Wert = ${zahl(Math.max(...werte))} − ${zahl(Math.min(...werte))} = ${zahl(spann)}`;
    hilfen = ["Such den größten und den kleinsten Wert.", "Spannweite = größter Wert − kleinster Wert"];
    fehler = [{ answer: zahl(Math.max(...werte)), label: "Nur den größten Wert genommen" }];
  }
  const fehl = fehlerOhne(zahl(richtig), fehler);
  if (format === "mc") {
    const m = auswahl(rng, `${zahl(richtig)}${w}`, fehl.map((f) => ({ ...f, answer: `${f.answer}${w}` })));
    return aufgabe(skillId, diff, "mc", { prompt: frage, figur, data: { options: m.options }, answer: { correct: m.correct }, solution, hints: hilfen, errorMap: m.errorMap });
  }
  if (format !== "calc") return null;
  return aufgabe(skillId, diff, "calc", { prompt: frage, figur, answer: { accepted: k.wort ? mitEinheit(zahl(richtig), k.wort) : [zahl(richtig)], mode: "value" }, solution, hints: hilfen, errorMap: fehl });
}

// =====================================================================
// welche Fähigkeit welche Aufgaben bekommt
// =====================================================================

type Bau = (skillId: string, diff: Difficulty, format: FigurFormat, rng: Rng) => TaskDraft | null;
/** Ein Plan mit genug freien Teilstrichen (zwei für den Lückentext); zufällige Pläne werden neu gezogen. */
function planMit(plan: (lv: number, rng: Rng) => StrahlPlan, lv: number, rng: Rng, mindestens: number): StrahlPlan {
  let p = plan(lv, rng);
  for (let t = 0; t < 20 && p.frei.length < mindestens; t++) p = plan(lv, rng);
  return p;
}
const strahl = (plan: (lv: number, rng: Rng) => StrahlPlan): Bau => (skillId, diff, format, rng) =>
  format === "rechenweg" || format === "sachaufgabe" ? null : strahlAufgabe(skillId, diff, format, rng, planMit(plan, LEVEL[diff], rng, format === "cloze" ? 2 : 1));

/**
 * Die Fähigkeiten mit Aufgaben mit Bild und die Formate, die es dafür gibt. Fehlt ein Format (etwa
 * Rechenweg beim Zahlenstrahl), gibt `figurAufgabe` null zurück und der Aufrufer nimmt eine Rechnung.
 */
export const FIGUR_FAEHIGKEITEN: Record<string, { bau: Bau; formate: FigurFormat[]; bild: string }> = {
  "mathe.vs.zahlen.zahlenstrahl": { bau: strahl(planVsZahlenstrahl), formate: ["calc", "mc", "cloze"], bild: "Zahlenstrahl" },
  "mathe.zahlen.gross": { bau: strahl(planGrosseZahlen), formate: ["calc", "mc", "cloze"], bild: "Zahlenstrahl" },
  "mathe.negativ.zahlengerade": { bau: strahl((lv) => planZahlengerade(lv)), formate: ["calc", "mc", "cloze"], bild: "Zahlengerade" },
  "mathe.negativ.rational": { bau: strahl((lv) => planRational(lv)), formate: ["calc", "mc", "cloze"], bild: "Zahlengerade" },
  "mathe.dezimal.vergleichen": { bau: strahl(planDezimal), formate: ["calc", "mc", "cloze"], bild: "Zahlenstrahl" },
  "mathe.brueche.anteile": { bau: strahl(planAnteile), formate: ["calc", "mc", "cloze"], bild: "Zahlenstrahl" },
  "mathe.brueche.vergleichen": {
    bau: (skillId, diff, format, rng) => {
      if (format !== "cloze") return strahl(planVergleichen)(skillId, diff, format, rng);
      // zwei Brüche ablesen und vergleichen
      const p = planMit(planVergleichen, LEVEL[diff], rng, 2);
      const [i, j] = stellen(rng, p.frei, 2);
      const zeichen = i < j ? "<" : ">";
      return aufgabe(skillId, diff, "cloze", {
        prompt: "Welche Brüche sind bei A und B markiert? Setze dann <, > oder = ein.\nA = ___\nB = ___\nA ___ B",
        figur: strahlFigur(p.strahl, [{ name: "A", bei: i }, { name: "B", bei: j }]),
        answer: { blanks: [[antwortBei(p, i)], [antwortBei(p, j)], [zeichen]], mode: "value" },
        solution: `${ablesen(p, i, "A")}\n${ablesen(p, j, "B")}\nWas weiter rechts liegt, ist größer: ${antwortBei(p, i)} ${zeichen} ${antwortBei(p, j)}`,
        hints: [...ABLESEN_HILFEN, "Am Zahlenstrahl ist die Zahl weiter rechts die größere."],
      });
    },
    formate: ["calc", "mc", "cloze"],
    bild: "Zahlenstrahl",
  },
  "mathe.brueche.gemischt": { bau: strahl(planGemischt), formate: ["calc", "mc", "cloze"], bild: "Zahlenstrahl" },
  "mathe.os.zahlen.intervalle": { bau: (skillId, diff, _format, rng) => intervallAufgabe(skillId, diff, rng), formate: ["mc"], bild: "Zahlengerade" },
  "mathe.geometrie.koordinaten": { bau: koordinatenAufgabe, formate: ["calc", "mc", "cloze"], bild: "Koordinatensystem" },
  "mathe.funktionen.linear": { bau: (s, d, f, r) => lineareAufgabe(s, d, f, r), formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Koordinatensystem" },
  "mathe.funktionen.darstellungen": { bau: (s, d, f, r) => lineareAufgabe(s, d, f, r, true), formate: ["calc", "mc", "cloze"], bild: "Koordinatensystem" },
  "mathe.gleichungssysteme.grafisch": { bau: gleichungssystemAufgabe, formate: ["calc", "mc", "cloze"], bild: "Koordinatensystem" },
  "mathe.flaechen.rechteck": { bau: rechteckAufgabe, formate: ["calc", "mc", "cloze", "rechenweg", "sachaufgabe"], bild: "Figur" },
  "mathe.flaechen.dreieck": { bau: dreieckAufgabe, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Figur" },
  "mathe.flaechen.zusammengesetzt": { bau: (s, d, f, r) => zusammengesetztAufgabe(s, d, f, r, false), formate: ["calc", "mc", "cloze", "rechenweg", "sachaufgabe"], bild: "Figur" },
  "mathe.vs.geometrie.zusammengesetzt": { bau: (s, d, f, r) => zusammengesetztAufgabe(s, d, f, r, true), formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Figur" },
  "mathe.flaechen.umkehr": { bau: umkehrAufgabe, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Figur" },
  "mathe.pythagoras.seite": { bau: pythagorasSeite, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Figur" },
  "mathe.pythagoras.figuren": { bau: pythagorasFiguren, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Figur" },
  "mathe.geometrie.kreis": { bau: kreisGrundAufgabe, formate: ["calc", "mc", "cloze"], bild: "Kreis" },
  "mathe.flaechen.kreis": { bau: kreisFlaecheAufgabe, formate: ["calc", "mc", "cloze", "rechenweg", "sachaufgabe"], bild: "Kreis" },
  "mathe.flaechen.kreisteile": { bau: kreisteilAufgabe, formate: ["calc", "mc", "cloze", "rechenweg", "sachaufgabe"], bild: "Kreis" },
  "mathe.vs.daten.diagramme": { bau: (s, d, f, r) => diagrammAufgabe(s, d, f, r, true), formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Diagramm" },
  "mathe.statistik.diagramme": { bau: (s, d, f, r) => diagrammAufgabe(s, d, f, r, false), formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Diagramm" },
  "mathe.statistik.haeufigkeiten": { bau: haeufigkeitAufgabe, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Diagramm" },
  "mathe.statistik.kennzahlen": { bau: kennzahlAufgabe, formate: ["calc", "mc", "cloze", "rechenweg"], bild: "Diagramm" },
};

/** Fähigkeit (oder ihre Elternfähigkeit) mit Aufgaben mit Bild; null ohne. */
export function figurFaehigkeit(skillId: string | null | undefined): string | null {
  if (!skillId) return null;
  if (FIGUR_FAEHIGKEITEN[skillId]) return skillId;
  const eltern = skillId.slice(0, skillId.lastIndexOf("."));
  return eltern.includes(".") && FIGUR_FAEHIGKEITEN[eltern] ? eltern : null;
}

/**
 * Eine Aufgabe mit Bild für die Fähigkeit im gewünschten Format, oder null, wenn es das Format für sie nicht
 * gibt (der Aufrufer nimmt dann eine Rechnung). Die Fähigkeit der Aufgabe ist `skillId` selbst.
 */
export function figurAufgabe(skillId: string, difficulty: Difficulty, format: FigurFormat, rng: Rng = Math.random): TaskDraft | null {
  const id = figurFaehigkeit(skillId);
  if (!id) return null;
  const f = FIGUR_FAEHIGKEITEN[id];
  if (!f.formate.includes(format)) return null;
  const t = f.bau(id, difficulty, format, rng);
  return t ? { ...t, skillId, skillIds: [...new Set([skillId, id])] } : null;
}
