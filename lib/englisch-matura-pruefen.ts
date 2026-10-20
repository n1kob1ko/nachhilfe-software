/**
 * Bewertung der Formate der Englisch-Matura (lib/englisch-matura-formate.ts), aufgerufen aus lib/tasks.ts checkAnswer.
 *
 * Wie bei der SRDP zählt jedes Item für sich: eine Aussage, eine Frage, eine Lücke, eine Zeile. Die Aufgabe ist
 * richtig, wenn alle Items stimmen; im letzten Versuch ist sie „teilweise richtig“, wenn mindestens die Hälfte
 * stimmt (CheckResult.onFinal). Falsch ist nur, was sicher falsch ist (True statt False, eine leere Lücke, eine
 * Antwort mit mehr als vier Wörtern). Was die App nicht sicher entscheiden kann, bewertet die Lehrkraft (correct
 * null): ein Beleg, der nicht mit dem erwarteten Satz beginnt, oder eine Kurzantwort in anderen Worten.
 *
 * Diese Datei lädt aus lib/tasks.ts nur Typen (tasks.ts lädt sie).
 */
import type { CheckResult, TaskDraft } from "./tasks";

type Aufgabe = Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">;

/** Wörter zum Vergleichen: klein, ohne Satzzeichen, ’ wie ', Bindestrich wie Leerzeichen. */
export function woerter(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[-‐‑–—/]/g, " ")
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

/** Die Sätze eines Textes (für die Belege): getrennt nach . ! ? vor einem Großbuchstaben, auch mit Anführungszeichen dazwischen. */
export function saetze(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[\p{Lu}\p{N}])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

const gleicheWoerter = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w === b[i]);

/**
 * Passt ein Beleg? `gegeben` sind die ersten Wörter, die der Schüler aus dem Text abschreibt, `satz` der Satz, der
 * die Entscheidung belegt. ja: der Satz beginnt mit diesen Wörtern (vier, oder weniger, wenn kein anderer Satz des
 * Textes so beginnt); unsicher: ein anderer Satz oder abgeschrieben mit Fehlern, das entscheidet die Lehrkraft.
 */
export function belegPasst(gegeben: string, satz: string, text: string): "ja" | "unsicher" | "leer" {
  const g = woerter(gegeben);
  if (!g.length) return "leer";
  const s = woerter(satz);
  const n = Math.min(g.length, s.length);
  if (!s.length || !g.slice(0, n).every((w, i) => w === s[i])) return "unsicher";
  if (n >= Math.min(4, s.length)) return "ja";
  const andere = saetze(text)
    .map(woerter)
    .filter((x) => !gleicheWoerter(x, s));
  return n >= 2 && !andere.some((x) => g.every((w, i) => x[i] === w)) ? "ja" : "unsicher";
}

const ARTIKEL = new Set(["a", "an", "the"]);
const VERNEINUNG = new Set(["not", "no", "never", "without", "nothing", "nobody", "isn't", "wasn't", "don't", "doesn't", "didn't", "can't", "won't"]);
const ohneArtikel = (xs: string[]) => xs.filter((w) => !ARTIKEL.has(w));

/**
 * Short Answers: richtig, wenn die Antwort (ohne a, an, the) eine der erwarteten ist oder sie enthält, ohne sie zu
 * verneinen („at the old bakery“ für „old bakery“). Sonst entscheidet die Lehrkraft, nie die App.
 */
export function kurzantwortPasst(gegeben: string, erwartet: string[]): boolean {
  const g = ohneArtikel(woerter(gegeben));
  if (!g.length) return false;
  return erwartet.some((e) => {
    const x = ohneArtikel(woerter(e));
    if (!x.length) return false;
    if (gleicheWoerter(g, x)) return true;
    for (let i = 0; i + x.length <= g.length; i++) {
      if (gleicheWoerter(g.slice(i, i + x.length), x)) return !g.some((w, j) => (j < i || j >= i + x.length) && VERNEINUNG.has(w));
    }
    return false;
  });
}

/** Editing: ein Häkchen in jeder Schreibweise ist „✓“, sonst das Wort klein und ohne Satzzeichen. */
export function editingWert(s: string): string {
  const t = s.trim();
  if (/^(✓|✔|✔️|√|☑|v|ok|okay|correct|richtig|tick|-|–)$/iu.test(t)) return "✓";
  return woerter(t).join(" ");
}

/** Zwei Wörter in einer Lücke: gleich ohne Groß/klein, Leerzeichen und Satzzeichen am Ende. */
const gleich = (a: string, b: string) => {
  const n = (s: string) => s.trim().toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").replace(/[.!?,;:]+$/, "");
  return n(a) === n(b);
};

/** 2 · 2 und 5 · 2, 4 und 5 */
function liste(xs: number[]): string {
  const n = xs.map((i) => String(i + 1));
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
}

const ZAHLWORT: Record<number, string> = { 1: "ein", 2: "zwei", 3: "drei", 4: "vier", 5: "fünf", 6: "sechs" };

/** Im letzten Versuch: mindestens die Hälfte richtig ist „teilweise“, wie Teilpunkte bei der Matura. */
const teilweise = (richtig: number, n: number) => (richtig > 0 && richtig * 2 >= n ? ("teilweise" as const) : null);

/** Eine Auswahl als JSON-Array von Indizes; null = nichts gewählt. */
function indizes(raw: unknown): (number | null)[] {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const index = (x: unknown) => (x !== null && x !== "" && Number.isInteger(Number(x)) && Number(x) >= 0 ? Number(x) : null);
  return Array.isArray(v) ? v.map(index) : [];
}

/** Die Antwort zu True or False: {"wahl":[0,1,…],"belege":["…",…]}; ältere Form: nur die Liste der Wahl. */
export function leseRichtigFalsch(raw: string): { wahl: (number | null)[]; belege: string[] } {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { wahl: [], belege: [] };
  }
  if (Array.isArray(v)) return { wahl: indizes(v), belege: [] };
  if (v && typeof v === "object") {
    const o = v as { wahl?: unknown; belege?: unknown };
    return { wahl: indizes(o.wahl ?? []), belege: Array.isArray(o.belege) ? o.belege.map((b) => (typeof b === "string" ? b : "")) : [] };
  }
  return { wahl: [], belege: [] };
}

/** Das Ergebnis aus dem Stand der Items: richtig, sicher falsch (mit Nummern) oder für die Lehrkraft. */
function ergebnis(o: {
  n: number;
  richtig: number;
  falsch: number[];
  offen: number[];
  satzFalsch: string[];
  satzOffen: string;
  errorLabel: string | null;
}): CheckResult {
  if (!o.falsch.length && !o.offen.length) return { correct: true, errorLabel: null, feedback: "Alles richtig!" };
  if (!o.falsch.length) return { correct: null, errorLabel: null, feedback: o.satzOffen };
  return {
    correct: false,
    errorLabel: o.errorLabel,
    feedback: o.satzFalsch.filter(Boolean).join(" "),
    wrongGaps: o.falsch.map((i) => i + 1),
    onFinal: o.offen.length ? "offen" : teilweise(o.richtig, o.n),
  };
}

/**
 * True or False mit Beleg: True/False prüft die App, den Beleg vergleicht sie mit dem Anfang des richtigen Satzes.
 * Ohne True/False oder ohne Beleg ist die Aussage falsch; ein anderer Satz oder Tippfehler gehen an die Lehrkraft.
 */
export function pruefeRichtigFalsch(task: Aufgabe, given: string): CheckResult {
  const pairs = task.answer.pairs ?? [];
  const soll = task.answer.belege ?? [];
  const text = task.data.passage ?? "";
  const { wahl, belege } = leseRichtigFalsch(given);
  const falscheWahl: number[] = [];
  const ohneWahl: number[] = [];
  const ohneBeleg: number[] = [];
  const offen: number[] = [];
  let richtig = 0;
  pairs.forEach((p, i) => {
    if (wahl[i] == null) return ohneWahl.push(i);
    if (wahl[i] !== p) return falscheWahl.push(i);
    const b = belegPasst(belege[i] ?? "", soll[i] ?? "", text);
    if (b === "leer") return ohneBeleg.push(i);
    if (b === "unsicher") return offen.push(i);
    richtig++;
  });
  return ergebnis({
    n: pairs.length,
    richtig,
    falsch: [...falscheWahl, ...ohneWahl, ...ohneBeleg].sort((a, b) => a - b),
    offen,
    satzFalsch: [
      falscheWahl.length ? `Bei ${liste(falscheWahl)} stimmt True oder False nicht.` : "",
      ohneWahl.length ? `Bei ${liste(ohneWahl)} fehlt noch True oder False.` : "",
      ohneBeleg.length ? `Bei ${liste(ohneBeleg)} fehlt die Begründung aus dem Text.` : "",
    ],
    satzOffen: `True oder False stimmt überall. Bei ${liste(offen)} schaut sich deine Lehrerin bzw. dein Lehrer die Begründung an.`,
    errorLabel: falscheWahl.length ? "True und False verwechselt" : ohneBeleg.length ? "Beleg fehlt" : null,
  });
}

/** Multiple Choice zum Text und Multiple Matching: je Frage eine Antwort, je Aussage ein Buchstabe. */
export function pruefeEnglischAuswahl(task: Aufgabe, given: string): CheckResult {
  const pairs = task.answer.pairs ?? [];
  const fragen = task.data.zuordnung?.art === "fragen";
  const picked = indizes(given);
  const falsch: number[] = [];
  const leer: number[] = [];
  pairs.forEach((p, i) => {
    if (picked[i] == null) leer.push(i);
    else if (picked[i] !== p) falsch.push(i);
  });
  const gewaehlt = picked.filter((x): x is number => x !== null);
  const doppelt = !fragen && new Set(gewaehlt).size < gewaehlt.length;
  const vor = fragen ? "Frage " : "";
  return ergebnis({
    n: pairs.length,
    richtig: pairs.length - falsch.length - leer.length,
    falsch: [...falsch, ...leer].sort((a, b) => a - b),
    offen: [],
    satzFalsch: [
      falsch.length ? `Bei ${vor}${liste(falsch)} ${falsch.length === 1 ? (fragen ? "stimmt die Antwort" : "stimmt der Buchstabe") : fragen ? "stimmen die Antworten" : "stimmen die Buchstaben"} nicht.` : "",
      leer.length ? `Bei ${vor}${liste(leer)} fehlt noch ${fragen ? "eine Antwort" : "ein Buchstabe"}.` : "",
      doppelt ? "Jeder Buchstabe passt nur einmal." : "",
    ],
    satzOffen: "",
    errorLabel: doppelt ? "Einen Buchstaben zweimal verwendet" : falsch.length ? (fragen ? "Falsche Antwort gewählt" : "Falsch zugeordnet") : null,
  });
}

/**
 * Short Answers, Editing, Banked Gap Fill, Open Gap Fill und Word Formation: jede Lücke für sich. Eine Kurzantwort
 * mit mehr Wörtern als erlaubt ist falsch, eine in anderen Worten bewertet die Lehrkraft.
 */
export function pruefeEnglischLuecken(task: Aufgabe, given: string): CheckResult {
  const a = task.answer;
  const blanks = a.blanks ?? [];
  let values: string[] = [];
  try {
    const v = JSON.parse(given) as unknown;
    values = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x == null ? "" : String(x))) : [String(v)];
  } catch {
    values = [given];
  }
  const max = a.maxWords ?? 0;
  const zeilen = Boolean(task.data.editing);
  const liste_ = task.data.wortliste ?? null;
  const falsch: number[] = [];
  const leer: number[] = [];
  const zuLang: number[] = [];
  const offen: number[] = [];
  let label: string | null = null;
  blanks.forEach((alts, i) => {
    const v = (values[i] ?? "").trim();
    if (!v) return leer.push(i);
    if (zeilen) {
      if (alts.map(editingWert).includes(editingWert(v))) return;
      const sollHaken = alts.map(editingWert).includes("✓");
      label ??= sollHaken ? "Richtige Zeile nicht erkannt" : editingWert(v) === "✓" ? "Überflüssiges Wort übersehen" : "Falsches Wort gestrichen";
      return falsch.push(i);
    }
    if (max) {
      if (woerter(v).length > max) {
        label ??= `Mehr als ${ZAHLWORT[max] ?? max} Wörter`;
        return zuLang.push(i);
      }
      if (!kurzantwortPasst(v, alts)) offen.push(i);
      return;
    }
    if (alts.some((x) => gleich(v, x))) return;
    label ??= liste_ ? (liste_.some((w) => gleich(v, w)) ? "Falsches Wort aus dem Kasten" : "Wort nicht aus dem Kasten") : "Falsches Wort in der Lücke";
    falsch.push(i);
  });
  const gewaehlt = liste_ ? values.map((v) => v.trim().toLowerCase()).filter(Boolean) : [];
  const doppelt = new Set(gewaehlt).size < gewaehlt.length;
  if (doppelt) label = "Ein Wort zweimal verwendet";
  const was = zeilen ? "Zeile" : max ? "Frage" : "Lücke";
  const stimmt = (xs: number[]) => (xs.length === 1 ? "stimmt" : "stimmen");
  return ergebnis({
    n: blanks.length,
    richtig: blanks.length - falsch.length - leer.length - zuLang.length - offen.length,
    falsch: [...falsch, ...leer, ...zuLang].sort((x, y) => x - y),
    offen,
    satzFalsch: [
      falsch.length ? `${was} ${liste(falsch)} ${stimmt(falsch)} nicht.` : "",
      zuLang.length ? `Bei Frage ${liste(zuLang)} hast du mehr als ${ZAHLWORT[max] ?? max} Wörter geschrieben.` : "",
      leer.length ? (zeilen ? `In Zeile ${liste(leer)} fehlt noch ein Wort oder ✓.` : max ? `Frage ${liste(leer)} ist noch nicht beantwortet.` : `${leer.length === 1 ? "Lücke" : "Lücken"} ${liste(leer)} ${leer.length === 1 ? "ist" : "sind"} noch leer.`) : "",
      doppelt ? "Jedes Wort aus dem Kasten passt nur einmal." : "",
    ],
    satzOffen: `${offen.length === blanks.length ? "" : `${blanks.length - offen.length} von ${blanks.length} Antworten stimmen sicher. `}Bei Frage ${liste(offen)} schaut sich deine Lehrerin bzw. dein Lehrer die Antwort an.`,
    errorLabel: label,
  });
}
