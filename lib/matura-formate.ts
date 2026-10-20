/**
 * Antwortformate der schriftlichen AHS-Mathematik-Matura (SRDP, Teil 1, Typ-1-Aufgaben): 1 aus 5, 2 aus 5,
 * Lückentext zum Ankreuzen und Zuordnung (2 Aussagen zu 4 Antworten). Jede dieser Aufgaben gibt 0 oder 1
 * Punkt; bei 2 aus 5, Lückentext und Zuordnung nur, wenn alles stimmt (lib/tasks.ts checkAnswer).
 *
 * Übernommen ist nur die Form. Aufgaben aus dem Aufgabenpool, aus Maturen, aus Schulbüchern oder vom IQS
 * werden nie kopiert (Urheberrecht des Ministeriums): die Inhalte kommen aus eigenen Generatoren
 * (lib/mathe-matura.ts) oder von der KI und werden hier streng geprüft. Das Konstruktionsformat (Zeichnen
 * im Graphen) gibt es nicht.
 *
 * So liegen die Formate in einer Aufgabe (TaskDraft):
 * - 1 aus 5: type "mc", data.options (5), answer.correct
 * - 2 aus 5: type "mc", data.options (5), answer.correctAll (die zwei Indizes), kein answer.correct
 * - Lückentext: type "cloze", zwei ___ im prompt, data.gapOptions (je 3 Satzteile), answer.blanks (je der richtige)
 * - Zuordnung: type "zuordnung", data.zuordnung (2 Aussagen, 4 Antworten A bis D), answer.pairs
 *
 * Die Formate der Englisch-Matura (True or False, Multiple Choice zum Text, Matching, Short Answers, Language in
 * Use, Writing) stehen in lib/englisch-matura-formate.ts; die Funktionen hier geben sie dorthin weiter
 * (Lösung, Antworttext, richtige und falsche Antwort), maturaFormat gibt für sie null.
 */
import { englischAntwortText, englischFalscheAntwort, englischFormat, englischLoesung, englischRichtigeAntwort } from "./englisch-matura-formate";
import { buchstabe, GAP, gapCount, kreisZahl, normalizeText, parseNumber, type TaskDraft } from "./tasks";

export const MATURA_KATEGORIEN = ["matura-1aus5", "matura-2aus5", "matura-lueckentext", "matura-zuordnung"] as const;
export type MaturaKategorie = (typeof MATURA_KATEGORIEN)[number];
export const istMaturaKategorie = (k: string | null | undefined): k is MaturaKategorie => (MATURA_KATEGORIEN as readonly string[]).includes(k ?? "");

/** Wie viele Antworten, Lücken und Aussagen jedes Format hat. */
export const MATURA_FORM = { antworten: 5, richtigBei2aus5: 2, luecken: 2, jeLuecke: 3, aussagen: 2, zuordnungsAntworten: 4 } as const;

/** Der Arbeitsauftrag je Format, in eigenen Worten. */
export const MATURA_AUFTRAG: Record<MaturaKategorie, string> = {
  "matura-1aus5": "Kreuze die zutreffende Aussage an.",
  "matura-2aus5": "Kreuze die beiden zutreffenden Aussagen an.",
  "matura-lueckentext": "Kreuze bei ① und ② jeweils den passenden Satzteil an, sodass ein richtiger Satz entsteht.",
  "matura-zuordnung": "Ordne den zwei Aussagen jeweils die passende Antwort aus A bis D zu.",
};

/** Eine Matura-Aufgabe gibt 0 oder 1 Punkt, auch in einer Probeschularbeit. */
export const MATURA_PUNKTE = 1;

type Teil = Pick<TaskDraft, "type" | "data" | "answer"> & { category?: string | null };

/** Das Matura-Format einer Aufgabe: aus der Kategorie, sonst an der Form erkannt; null = keines. */
export function maturaFormat(t: Teil): MaturaKategorie | null {
  if (istMaturaKategorie(t.category)) return t.category;
  // die Formate der Englisch-Matura haben ihre eigenen Regeln (lib/englisch-matura-formate.ts)
  if (englischFormat(t)) return null;
  if (t.type === "zuordnung") return "matura-zuordnung";
  if (t.data.gapOptions) return "matura-lueckentext";
  if (t.answer.correctAll) return "matura-2aus5";
  return null;
}

/** Zwei Antworten mit gleichem Inhalt: gleicher Text (ohne Leerzeichen, Groß/klein egal) oder gleicher Zahlenwert. */
export function gleicheAntwort(a: string, b: string): boolean {
  const ohne = (s: string) => normalizeText(s).replace(/\s+/g, "").replace(/−/g, "-");
  if (ohne(a) === ohne(b)) return true;
  const x = parseNumber(a);
  const y = parseNumber(b);
  return x !== null && y !== null && Math.abs(x - y) < 1e-9;
}

/** Die erste Antwort, die es schon gibt; null, wenn alle verschieden sind. */
export function doppelt(xs: readonly string[]): string | null {
  for (let i = 0; i < xs.length; i++) for (let j = 0; j < i; j++) if (gleicheAntwort(xs[i], xs[j])) return xs[i];
  return null;
}

const ganzeZahl = (x: unknown, bis: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < bis;

/**
 * Was an einer Aufgabe im Matura-Format nicht stimmt, als deutscher Satz für Editor, KI-Prüfung und Tests;
 * null, wenn sie in Ordnung ist (oder kein Matura-Format hat).
 */
export function pruefeMatura(t: Teil & { prompt: string }): string | null {
  const format = maturaFormat(t);
  if (!format) return null;
  const leer = (xs: readonly string[]) => xs.some((x) => !x.trim());
  const gleich = (xs: readonly string[], was: string) => {
    const d = doppelt(xs);
    return d ? `Zwei ${was} sind gleich: „${d}“.` : null;
  };
  switch (format) {
    case "matura-1aus5":
    case "matura-2aus5": {
      const o = t.data.options ?? [];
      if (t.type !== "mc") return "Ein Matura-Format mit Ankreuzen ist Multiple Choice.";
      if (o.length !== MATURA_FORM.antworten || leer(o)) return "Jede der fünf Antworten braucht einen Text (genau fünf).";
      const doppelte = gleich(o, "Antworten");
      if (doppelte) return doppelte;
      if (format === "matura-1aus5") {
        if (t.answer.correctAll?.length) return "Bei 1 aus 5 ist genau eine Antwort richtig.";
        if (!ganzeZahl(t.answer.correct, o.length)) return "Bitte die richtige Antwort markieren.";
        return null;
      }
      const r = t.answer.correctAll ?? [];
      if (typeof t.answer.correct === "number") return "Bei 2 aus 5 sind zwei Antworten richtig, nicht eine.";
      if (r.length !== MATURA_FORM.richtigBei2aus5 || new Set(r).size !== r.length || !r.every((i) => ganzeZahl(i, o.length))) return "Bei 2 aus 5 sind genau zwei Antworten richtig. Bitte beide markieren.";
      return null;
    }
    case "matura-lueckentext": {
      if (t.type !== "cloze") return "Ein Lückentext zum Ankreuzen ist ein Lückentext.";
      if (gapCount(t.prompt) !== MATURA_FORM.luecken) return `Der Satz braucht genau zwei Lücken (${GAP}).`;
      const g = t.data.gapOptions ?? [];
      const b = t.answer.blanks ?? [];
      if (g.length !== MATURA_FORM.luecken || b.length !== MATURA_FORM.luecken) return "Jede der zwei Lücken braucht Satzteile zum Ankreuzen und eine Lösung.";
      for (const [i, teile] of g.entries()) {
        const n = kreisZahl(i + 1);
        if (teile.length !== MATURA_FORM.jeLuecke || leer(teile)) return `Lücke ${n} braucht genau drei Satzteile mit Text.`;
        const doppelte = gleich(teile, `Satzteile bei Lücke ${n}`);
        if (doppelte) return doppelte;
        const richtig = teile.filter((x) => (b[i] ?? []).some((r) => r.trim() === x.trim()));
        if (richtig.length !== 1) return `Bei Lücke ${n} muss genau einer der drei Satzteile richtig sein.`;
      }
      return null;
    }
    case "matura-zuordnung": {
      const z = t.data.zuordnung;
      if (t.type !== "zuordnung" || !z) return "Eine Zuordnung braucht Aussagen und Antworten.";
      if (z.statements.length !== MATURA_FORM.aussagen || leer(z.statements)) return "Die Zuordnung braucht genau zwei Aussagen mit Text.";
      if (z.options.length !== MATURA_FORM.zuordnungsAntworten || leer(z.options)) return "Die Zuordnung braucht genau vier Antworten A bis D mit Text.";
      const doppelte = gleich(z.statements, "Aussagen") ?? gleich(z.options, "Antworten");
      if (doppelte) return doppelte;
      const p = t.answer.pairs ?? [];
      if (p.length !== z.statements.length || !p.every((i) => ganzeZahl(i, z.options.length))) return "Bitte jeder Aussage ihren richtigen Buchstaben geben.";
      if (new Set(p).size !== p.length) return "Jede Aussage braucht einen anderen Buchstaben.";
      return null;
    }
  }
}

/** Eine leere Aufgabe im Matura-Format für den Editor (neue Aufgabe oder anderer Aufgabentyp). */
export function maturaLeer(k: MaturaKategorie): Pick<TaskDraft, "type" | "data" | "answer"> & { prompt?: string } {
  switch (k) {
    case "matura-1aus5":
      return { type: "mc", data: { options: ["", "", "", "", ""] }, answer: { correct: 0 } };
    case "matura-2aus5":
      return { type: "mc", data: { options: ["", "", "", "", ""] }, answer: { correctAll: [0, 1] } };
    case "matura-lueckentext":
      return { type: "cloze", prompt: `… ${GAP} … ${GAP} …`, data: { gapOptions: [["", "", ""], ["", "", ""]] }, answer: { blanks: [[""], [""]], mode: "text" } };
    case "matura-zuordnung":
      return { type: "zuordnung", data: { zuordnung: { statements: ["", ""], options: ["", "", "", ""] } }, answer: { pairs: [0, 1] } };
  }
}

/** Die richtige Antwort als Text („b) … · d) …“, „① … · ② …“, „1 → C, 2 → A“); null ohne Matura-Format. */
export function maturaLoesung(t: Teil): string | null {
  if (englischFormat(t)) return englischLoesung(t);
  const o = t.data.options ?? [];
  if (t.answer.correctAll?.length) return t.answer.correctAll.map((i) => `${String.fromCharCode(97 + i)}) ${o[i] ?? "?"}`).join(" · ");
  if (t.type === "zuordnung" && t.data.zuordnung && t.answer.pairs) {
    const z = t.data.zuordnung;
    return t.answer.pairs.map((p, i) => `${i + 1} → ${buchstabe(p)} (${z.options[p] ?? "?"})`).join(" · ");
  }
  if (t.data.gapOptions && t.answer.blanks) return t.answer.blanks.map((b, i) => `${kreisZahl(i + 1)} ${b[0] ?? "?"}`).join(" · ");
  return null;
}

/** Die gespeicherte Antwort des Schülers als Text; null ohne Matura-Format (dann gilt die übliche Anzeige). */
export function maturaAntwortText(t: Teil, raw: string): string | null {
  if (englischFormat(t)) return englischAntwortText(t, raw);
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    v = null;
  }
  const liste = Array.isArray(v) ? v : typeof v === "number" ? [v] : [];
  const o = t.data.options ?? [];
  if (t.answer.correctAll?.length) {
    const xs = liste.filter((i): i is number => typeof i === "number" && o[i] !== undefined);
    return xs.length ? xs.map((i) => `${String.fromCharCode(97 + i)}) ${o[i]}`).join(" · ") : "nichts angekreuzt";
  }
  if (t.type === "zuordnung" && t.data.zuordnung) {
    return t.data.zuordnung.statements.map((_, i) => `${i + 1} → ${typeof liste[i] === "number" ? buchstabe(liste[i] as number) : "?"}`).join(", ");
  }
  if (t.data.gapOptions) return t.data.gapOptions.map((_, i) => `${kreisZahl(i + 1)} ${String(liste[i] ?? "").trim() || "?"}`).join(" · ");
  return null;
}

/**
 * Die richtigen Kreuze für das gedruckte Blatt (Lehrerfassung, Mappe): bei 1 aus 5 und 2 aus 5 die Indizes der
 * richtigen Antworten, beim Lückentext je Lücke der Index des richtigen Satzteils, bei der Zuordnung je Aussage
 * der Buchstabe (0 = A); null = keines. Ohne Matura-Format eine leere Liste.
 */
export function maturaKreuze(t: Teil): (number | null)[] {
  switch (maturaFormat(t)) {
    case "matura-1aus5":
      return typeof t.answer.correct === "number" ? [t.answer.correct] : [];
    case "matura-2aus5":
      return t.answer.correctAll ?? [];
    case "matura-lueckentext":
      return (t.data.gapOptions ?? []).map((g, i) => {
        const k = g.findIndex((x) => (t.answer.blanks?.[i] ?? []).some((r) => r.trim() === x.trim()));
        return k >= 0 ? k : null;
      });
    case "matura-zuordnung":
      return t.answer.pairs ?? [];
    default:
      return [];
  }
}

/** Die Kreuze aus der gespeicherten Antwort des Schülers (so, wie der Solver sie schickt), in der Form von maturaKreuze. */
export function maturaKreuzeAus(t: Teil, raw: string): (number | null)[] {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    v = null;
  }
  const liste: unknown[] = Array.isArray(v) ? v : [];
  const index = (x: unknown, bis: number) => (ganzeZahl(x, bis) ? x : null);
  const n = t.data.options?.length ?? 0;
  switch (maturaFormat(t)) {
    case "matura-1aus5": {
      const i = index(v, n);
      return i === null ? [] : [i];
    }
    case "matura-2aus5":
      return [...new Set(liste.map((x) => index(x, n)).filter((x): x is number => x !== null))];
    case "matura-lueckentext":
      return (t.data.gapOptions ?? []).map((g, i) => {
        const k = g.findIndex((x) => x.trim() === String(liste[i] ?? "").trim());
        return k >= 0 ? k : null;
      });
    case "matura-zuordnung": {
      const z = t.data.zuordnung;
      return (z?.statements ?? []).map((_, i) => index(liste[i], z!.options.length));
    }
    default:
      return [];
  }
}

/** Die richtige Antwort, wie der Solver sie schickt (für Tests und den Testmodus); null ohne Matura-Format. */
export function maturaRichtigeAntwort(t: Teil): string | null {
  if (englischFormat(t)) return englischRichtigeAntwort(t);
  if (t.answer.correctAll?.length) return JSON.stringify([...t.answer.correctAll].sort((a, b) => a - b));
  if (t.type === "zuordnung" && t.answer.pairs) return JSON.stringify(t.answer.pairs);
  if (t.data.gapOptions && t.answer.blanks) return JSON.stringify(t.answer.blanks.map((b) => b[0]));
  return null;
}

/** Eine falsche Antwort, wie der Solver sie schickt: eine richtige fehlt, die Zuordnung vertauscht, die Lücken falsch. */
export function maturaFalscheAntwort(t: Teil): string | null {
  if (englischFormat(t)) return englischFalscheAntwort(t);
  if (t.answer.correctAll?.length) return JSON.stringify(t.answer.correctAll.slice(0, 1));
  if (t.type === "zuordnung" && t.answer.pairs) return JSON.stringify([...t.answer.pairs].reverse());
  if (t.data.gapOptions && t.answer.blanks) return JSON.stringify(t.data.gapOptions.map((g, i) => g.find((x) => !(t.answer.blanks![i] ?? []).includes(x)) ?? ""));
  return null;
}
