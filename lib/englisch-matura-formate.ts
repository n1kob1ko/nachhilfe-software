/**
 * Formate der schriftlichen Englisch-Matura (SRDP, B2): Reading, Language in Use und Writing.
 *
 * Übernommen ist nur die Form. Texte und Aufgaben aus dem Aufgabenpool, aus Maturen, aus Schulbüchern oder vom
 * IQS werden nie kopiert: die Lesetexte, Lückentexte und Schreibaufträge sind eigene (lib/englisch-matura-texte.ts)
 * oder kommen auf Klick von der KI und werden hier streng geprüft. Listening gibt es nicht (keine Hörtexte).
 *
 * So liegen die Formate in einer Aufgabe (TaskDraft); der Text steht in data.passage, sein Titel in passageTitle:
 * - True or False mit Beleg: type "zuordnung", zuordnung.art "richtig-falsch", options ["True", "False"],
 *   answer.pairs (0 = True, 1 = False), answer.belege (je Aussage der Satz aus dem Text, Wort für Wort)
 * - Multiple Choice zum Text: type "zuordnung", art "fragen", statements = die Fragen, choices = je Frage A bis D
 * - Multiple Matching: type "zuordnung", art "ueberschriften" (statements „Paragraph 1“ …) oder "satzenden"
 *   (statements = Satzanfänge), options = Überschriften bzw. Satzenden, mehr als Aussagen
 * - Short Answers: type "cloze", je Frage eine Lücke, answer.blanks = die erwarteten Antworten, answer.maxWords
 * - Banked Gap Fill: type "cloze", data.wortliste (mit Wörtern, die übrig bleiben)
 * - Open Gap Fill und Word Formation: type "cloze"; bei Word Formation steht das Grundwort groß nach der Lücke
 * - Editing: type "cloze", data.editing, jede Zeile endet mit einer Lücke (das überflüssige Wort oder ✓)
 * - Writing: type "free", data.schreibauftrag (Textsorte, Wortanzahl), answer.criteria (die vier Kriterien),
 *   answer.sample (ein Mustertext); bewertet wie jede freie Antwort von der Lehrkraft
 * Die Lückenformate haben answer.teilpunkte: jede Lücke zählt für sich (lib/englisch-matura-pruefen.ts).
 */
import { findQuote, wordCount } from "./lesen";
import { editingWert, leseRichtigFalsch, saetze, woerter } from "./englisch-matura-pruefen";
import { buchstabe, GAP, gapCount, type TaskDraft } from "./tasks";

export const ENGLISCH_MATURA = [
  "matura-true-false",
  "matura-reading-mc",
  "matura-matching",
  "matura-short-answers",
  "matura-banked-gap",
  "matura-open-gap",
  "matura-editing",
  "matura-word-formation",
  "matura-writing",
] as const;
export type EnglischMaturaFormat = (typeof ENGLISCH_MATURA)[number];
export const istEnglischMatura = (k: string | null | undefined): k is EnglischMaturaFormat => (ENGLISCH_MATURA as readonly string[]).includes(k ?? "");

/** Teil der Matura: Reading, Language in Use oder Writing. */
export type EnglischTeil = "reading" | "liu" | "writing";
export const ENGLISCH_TEIL: Record<EnglischMaturaFormat, EnglischTeil> = {
  "matura-true-false": "reading",
  "matura-reading-mc": "reading",
  "matura-matching": "reading",
  "matura-short-answers": "reading",
  "matura-banked-gap": "liu",
  "matura-open-gap": "liu",
  "matura-editing": "liu",
  "matura-word-formation": "liu",
  "matura-writing": "writing",
};

/** Höchstens so viele Wörter bei Short Answers. */
export const KURZ_WOERTER = 4;

const zahl = (n: number) => ["no", "one", "two", "three", "four", "five", "six"][n] ?? String(n);

/** Der Arbeitsauftrag je Format, auf Englisch und in eigenen Worten. `n`: Items, `extra`: Antworten, die übrig bleiben. */
export function englischAuftrag(k: EnglischMaturaFormat, n: number, extra = 0, art?: string | null): string {
  const bis = `1–${n}`;
  switch (k) {
    case "matura-true-false":
      return `Are the statements (${bis}) true or false according to the text? Choose True or False. Then find the sentence in the text that proves your answer and write down its first four words.`;
    case "matura-reading-mc":
      return `Answer the questions (${bis}) about the text. For each question, choose the answer (A, B, C or D) that fits the text best.`;
    case "matura-matching":
      return art === "ueberschriften"
        ? `Choose the right heading (A–${buchstabe(n + extra - 1)}) for each paragraph (${bis}). ${extra === 1 ? "One heading does" : `${zahl(extra)[0].toUpperCase()}${zahl(extra).slice(1)} headings do`} not fit any paragraph.`
        : `Complete the sentences (${bis}) with the endings (A–${buchstabe(n + extra - 1)}) so that they match the text. ${extra === 1 ? "One ending is" : `${zahl(extra)[0].toUpperCase()}${zahl(extra).slice(1)} endings are`} not needed.`;
    case "matura-short-answers":
      return `Answer the questions (${bis}) about the text. Use no more than ${zahl(KURZ_WOERTER)} words for each answer.`;
    case "matura-banked-gap":
      return `Fill in the gaps (${bis}) with words from the box. You can use each word only once. ${extra === 1 ? "One word is" : `${zahl(extra)[0].toUpperCase()}${zahl(extra).slice(1)} words are`} not needed.`;
    case "matura-open-gap":
      return `Fill in the gaps (${bis}). Write exactly one word in each gap.`;
    case "matura-editing":
      return "Most lines of the text contain one word that should not be there. Write this word next to the line. If a line is correct, write ✓.";
    case "matura-word-formation":
      return `Complete the text. Use the word in capitals after each gap (${bis}) to form a word that fits the gap.`;
    case "matura-writing":
      return "Write the text described below.";
  }
}

/** Textsorten für Writing: der Name im Auftrag (englisch) und woran die Lehrkraft sie erkennt (deutsch). */
export const TEXTSORTEN = {
  article: { name: "article", merkmale: "Titel, lebendiger Einstieg, Leserinnen und Leser direkt angesprochen, Absätze, Schluss mit Ausblick oder Appell" },
  "blog-post": { name: "blog post", merkmale: "Titel, persönlicher und lebendiger Ton, Leserinnen und Leser angesprochen, Absätze, Schluss mit Frage oder Einladung zum Kommentieren" },
  "blog-comment": { name: "blog comment", merkmale: "Bezug auf den Beitrag, eigene Meinung mit Gründen und Beispielen, neutraler bis informeller Ton" },
  "email-informal": { name: "email", merkmale: "informelle Anrede und Grußformel (Hi …, Best wishes), persönlicher Ton, Kurzformen erlaubt, Absätze" },
  "email-formal": { name: "email", merkmale: "formelle Anrede und Grußformel (Dear …, Yours sincerely), Anlass im ersten Satz, sachlicher Ton ohne Kurzformen, Absätze" },
  report: { name: "report", merkmale: "Titel und Zwischenüberschriften, Zweck am Anfang, sachlicher Ton, Empfehlungen am Ende" },
  essay: { name: "essay", merkmale: "Einleitung mit dem Thema, Argumente in eigenen Absätzen mit Beispielen, Gegenargument, Schluss mit eigener Meinung, neutraler Ton" },
  leaflet: { name: "leaflet", merkmale: "Titel und Zwischenüberschriften, Leserinnen und Leser direkt angesprochen, kurze Abschnitte, wichtige Angaben leicht zu finden" },
} as const;
export type Textsorte = keyof typeof TEXTSORTEN;
export const istTextsorte = (x: unknown): x is Textsorte => typeof x === "string" && x in TEXTSORTEN;

/** Die vier Kriterien der Beurteilung von Writing, als Erwartungshorizont für die Lehrkraft. */
export const KRITERIEN = [
  "Task achievement (Erfüllung der Aufgabe): alle drei Punkte bearbeitet, Textsorte und Leser passen, Wortanzahl eingehalten",
  "Organisation and layout (Aufbau und Layout): klare Absätze, Linking Words, Layout der Textsorte",
  "Lexical range and accuracy (Wortschatz): treffende, abwechslungsreiche Wörter, wenige Wortfehler",
  "Grammatical range and accuracy (Grammatik): abwechslungsreiche Strukturen, wenige Fehler",
] as const;

/** ±10 %: so viele Wörter darf ein Text haben, der „about 250 words“ lang sein soll. */
export function wortRahmen(woerter: number): { min: number; max: number } {
  return { min: Math.round(woerter * 0.9), max: Math.round(woerter * 1.1) };
}

/** Der Erwartungshorizont eines Schreibauftrags: die vier Kriterien, die Merkmale der Textsorte und die Wortanzahl. */
export function schreibKriterien(textsorte: Textsorte, woerter: number): string[] {
  const { min, max } = wortRahmen(woerter);
  const ts = TEXTSORTEN[textsorte];
  return [...KRITERIEN, `Textsorte ${ts.name}: ${ts.merkmale}`, `Wortanzahl: ${min} bis ${max} Wörter`];
}

/** Die ersten Wörter eines Satzes, wie sie die Schülerin bzw. der Schüler als Beleg abschreibt. */
export function ersteWoerter(satz: string, n = 4): string {
  return satz.trim().split(/\s+/).slice(0, n).join(" ");
}

type Teil = Pick<TaskDraft, "type" | "data" | "answer"> & { category?: string | null };

/** Das Format einer Aufgabe der Englisch-Matura: aus der Kategorie, sonst an der Form erkannt; null = keines. */
export function englischFormat(t: Teil): EnglischMaturaFormat | null {
  if (istEnglischMatura(t.category)) return t.category;
  const z = t.type === "zuordnung" ? t.data.zuordnung : undefined;
  if (z?.art === "richtig-falsch") return "matura-true-false";
  if (z?.art === "fragen") return "matura-reading-mc";
  if (z?.art) return "matura-matching";
  if (t.type === "cloze" && t.data.wortliste) return "matura-banked-gap";
  if (t.type === "cloze" && t.data.editing) return "matura-editing";
  if (t.type === "cloze" && t.answer.maxWords) return "matura-short-answers";
  if (t.type === "free" && t.data.schreibauftrag) return "matura-writing";
  return null;
}

/** Wie viele Punkte die Aufgabe bei der Matura gibt: einen je Aussage, Frage, Lücke oder Zeile; Writing null (nach Schwierigkeit). */
export function englischPunkte(t: Teil): number | null {
  const k = englischFormat(t);
  if (!k || k === "matura-writing") return null;
  const n = t.type === "zuordnung" ? (t.data.zuordnung?.statements.length ?? 0) : (t.answer.blanks?.length ?? 0);
  return n > 0 ? n : null;
}

const leer = (xs: readonly string[]) => xs.some((x) => !x.trim());
const ohne = (s: string) => woerter(s).join(" ");
function doppelt(xs: readonly string[]): string | null {
  for (let i = 0; i < xs.length; i++) for (let j = 0; j < i; j++) if (ohne(xs[i]) === ohne(xs[j])) return xs[i];
  return null;
}
const index = (x: unknown, bis: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < bis;
const gleichesWort = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Das Grundwort nach jeder Lücke bei Word Formation: „___ (DECIDE)“. */
export const GRUNDWORT = new RegExp(`${GAP}\\s*\\(([A-Z][A-Z'-]*)\\)`, "g");

/**
 * Was an einer Aufgabe der Englisch-Matura nicht stimmt, als deutscher Satz für Editor, KI-Prüfung und Tests;
 * null, wenn sie in Ordnung ist (oder kein Format der Englisch-Matura hat).
 */
export function pruefeEnglisch(t: Teil & { prompt: string }): string | null {
  const k = englischFormat(t);
  if (!k) return null;
  const text = t.data.passage?.trim() ?? "";
  const z = t.data.zuordnung;
  const p = t.answer.pairs ?? [];
  const lesen = ENGLISCH_TEIL[k] === "reading";
  if (lesen && wordCount(text) < 80) return "Zum Reading gehört ein Lesetext (mindestens 80 Wörter).";
  switch (k) {
    case "matura-true-false": {
      if (t.type !== "zuordnung" || !z || z.art !== "richtig-falsch") return "True or False braucht Aussagen mit True und False.";
      if (z.statements.length < 3 || leer(z.statements)) return "True or False braucht mindestens drei Aussagen mit Text.";
      const d = doppelt(z.statements);
      if (d) return `Zwei Aussagen sind gleich: „${d}“.`;
      if (z.options.length !== 2 || z.options[0] !== "True" || z.options[1] !== "False") return "Die Antworten heißen True und False.";
      if (p.length !== z.statements.length || !p.every((i) => index(i, 2))) return "Bitte bei jeder Aussage True oder False markieren.";
      if (!p.includes(0) || !p.includes(1)) return "Mindestens eine Aussage ist True und mindestens eine False.";
      const b = t.answer.belege ?? [];
      if (b.length !== z.statements.length || leer(b)) return "Jede Aussage braucht ihren Beleg: den Satz aus dem Text, der die Entscheidung zeigt.";
      const alle = saetze(text).map(ohne);
      for (const [i, satz] of b.entries()) {
        if (findQuote(text, satz) === null || !alle.includes(ohne(satz))) return `Der Beleg zu Aussage ${i + 1} ist kein ganzer Satz aus dem Text: „${satz}“.`;
      }
      return null;
    }
    case "matura-reading-mc": {
      if (t.type !== "zuordnung" || !z || z.art !== "fragen") return "Multiple Choice zum Text braucht Fragen mit je vier Antworten.";
      if (z.statements.length < 3 || leer(z.statements)) return "Multiple Choice zum Text braucht mindestens drei Fragen mit Text.";
      const c = z.choices ?? [];
      if (c.length !== z.statements.length) return "Jede Frage braucht ihre vier Antworten A bis D.";
      for (const [i, xs] of c.entries()) {
        if (xs.length !== 4 || leer(xs)) return `Frage ${i + 1} braucht genau vier Antworten A bis D mit Text.`;
        const d = doppelt(xs);
        if (d) return `Bei Frage ${i + 1} sind zwei Antworten gleich: „${d}“.`;
      }
      if (p.length !== z.statements.length || !p.every((i) => index(i, 4))) return "Bitte bei jeder Frage die richtige Antwort markieren.";
      return null;
    }
    case "matura-matching": {
      if (t.type !== "zuordnung" || !z || (z.art !== "ueberschriften" && z.art !== "satzenden")) return "Multiple Matching braucht Absätze oder Satzanfänge und die Antworten dazu.";
      if (z.statements.length < 3 || leer(z.statements)) return "Multiple Matching braucht mindestens drei Absätze oder Satzanfänge mit Text.";
      if (z.options.length <= z.statements.length || leer(z.options)) return "Es braucht mehr Antworten als Absätze oder Sätze: mindestens eine bleibt übrig.";
      if (z.options.length > 26) return "Höchstens 26 Antworten (A bis Z).";
      const d = doppelt(z.statements) ?? doppelt(z.options);
      if (d) return `„${d}“ steht zweimal.`;
      if (p.length !== z.statements.length || !p.every((i) => index(i, z.options.length))) return "Bitte jedem Absatz oder Satz den richtigen Buchstaben geben.";
      if (new Set(p).size !== p.length) return "Jeder Buchstabe passt nur einmal.";
      return null;
    }
    case "matura-short-answers": {
      const b = t.answer.blanks ?? [];
      if (t.type !== "cloze") return "Short Answers sind Fragen mit je einer Lücke für die Antwort.";
      if (b.length < 3 || gapCount(t.prompt) !== b.length) return `Short Answers brauchen mindestens drei Fragen mit je einer Lücke (${GAP}).`;
      const max = t.answer.maxWords ?? 0;
      if (max < 1 || max > 6) return "Bitte die Wortgrenze angeben (meist vier Wörter).";
      for (const [i, alts] of b.entries()) {
        if (!alts.length || leer(alts)) return `Frage ${i + 1} braucht eine Antwort.`;
        const lang = alts.find((x) => woerter(x).length > max);
        if (lang) return `Die Antwort „${lang}“ bei Frage ${i + 1} hat mehr als ${max} Wörter.`;
      }
      return null;
    }
    case "matura-banked-gap":
    case "matura-open-gap":
    case "matura-word-formation":
    case "matura-editing": {
      const b = t.answer.blanks ?? [];
      if (t.type !== "cloze") return "Language in Use ist ein Text mit Lücken.";
      if (gapCount(t.prompt) !== b.length) return `${gapCount(t.prompt)} Lücken im Text, aber ${b.length} Lösungen.`;
      if (b.some((alts) => !alts.length || leer(alts))) return "Jede Lücke braucht eine Lösung.";
      if (k === "matura-editing") {
        if (!t.data.editing) return "Editing braucht Zeilen mit je einer Lücke am Ende.";
        if (b.length < 6) return "Editing braucht mindestens sechs Zeilen.";
        const zeilen = t.prompt.split("\n").filter((l) => l.includes(GAP));
        if (zeilen.length !== b.length || zeilen.some((l) => !l.trimEnd().endsWith(GAP))) return `Jede Zeile endet mit genau einer Lücke (${GAP}).`;
        const haken = b.filter((alts) => editingWert(alts[0]) === "✓").length;
        if (haken < 2 || b.length - haken < 3) return "Editing braucht mindestens zwei richtige Zeilen (✓) und drei mit einem überflüssigen Wort.";
        for (const [i, alts] of b.entries()) {
          const w = editingWert(alts[0]);
          if (w !== "✓" && !woerter(zeilen[i].replace(GAP, "")).includes(w)) return `Das Wort „${alts[0]}“ steht nicht in Zeile ${i + 1}.`;
        }
        return null;
      }
      if (b.length < 4) return "Es braucht mindestens vier Lücken.";
      if (k === "matura-open-gap" && b.some((alts) => alts.some((x) => /\s/.test(x.trim())))) return "Bei Open Gap Fill kommt in jede Lücke genau ein Wort.";
      if (k === "matura-word-formation") {
        const grund = [...t.prompt.matchAll(GRUNDWORT)].map((m) => m[1]);
        if (grund.length !== b.length) return `Nach jeder Lücke steht das Grundwort in Großbuchstaben, z. B. ${GAP} (DECIDE).`;
        const gleich = b.findIndex((alts, i) => alts.some((x) => gleichesWort(x, grund[i])));
        if (gleich >= 0) return `Bei Lücke ${gleich + 1} ist die Lösung das Grundwort selbst.`;
      }
      if (k === "matura-banked-gap") {
        const liste = t.data.wortliste ?? [];
        if (leer(liste) || doppelt(liste)) return "Die Wörter im Kasten brauchen Text und dürfen nicht doppelt sein.";
        const fehlt = b.find((alts) => !liste.some((w) => alts.some((x) => gleichesWort(w, x))));
        if (fehlt) return `„${fehlt[0]}“ fehlt im Kasten.`;
        const extra = liste.filter((w) => !b.some((alts) => alts.some((x) => gleichesWort(w, x)))).length;
        if (extra < 2) return "Im Kasten braucht es mindestens zwei Wörter, die übrig bleiben.";
      }
      return null;
    }
    case "matura-writing": {
      const s = t.data.schreibauftrag;
      if (t.type !== "free" || !s) return "Writing braucht Textsorte und Wortanzahl.";
      if (!istTextsorte(s.textsorte)) return "Bitte eine Textsorte wählen.";
      if (!Number.isInteger(s.woerter) || s.woerter < 100 || s.woerter > 500) return "Die Wortanzahl liegt zwischen 100 und 500.";
      const punkte = t.prompt.split("\n").filter((l) => /^\s*[•-]\s*\p{L}/u.test(l)).length;
      if (punkte !== 3) return "Der Schreibauftrag hat genau drei Punkte (Zeilen mit •).";
      const sample = t.answer.sample?.trim();
      if (sample) {
        const { min, max } = wortRahmen(s.woerter);
        const n = wordCount(sample);
        if (n < min || n > max) return `Der Mustertext hat ${n} Wörter, verlangt sind ${min} bis ${max}.`;
      }
      return null;
    }
  }
}

/** Die Lösung in einer Zeile (Lösungsseite, Lehrerfassung): „1 False (Every second Saturday …) · 2 True …“, „1 B · 2 D“. */
export function englischLoesung(t: Teil): string | null {
  const k = englischFormat(t);
  if (!k || k === "matura-writing") return null;
  const z = t.data.zuordnung;
  if (k === "matura-true-false" && z) return (t.answer.pairs ?? []).map((p, i) => `${i + 1} ${z.options[p] ?? "?"} (${ersteWoerter(t.answer.belege?.[i] ?? "")} …)`).join(" · ");
  if (t.type === "zuordnung") return (t.answer.pairs ?? []).map((p, i) => `${i + 1} ${buchstabe(p)}`).join(" · ");
  return (t.answer.blanks ?? []).map((b, i) => `${i + 1} ${b[0] ?? "?"}`).join(" · ");
}

/** Die gespeicherte Antwort als Text (Ergebnisse, Lehrerbewertung); null ohne Format oder bei Writing. */
export function englischAntwortText(t: Teil, raw: string): string | null {
  const k = englischFormat(t);
  if (!k || k === "matura-writing") return null;
  const z = t.data.zuordnung;
  if (k === "matura-true-false" && z) {
    const { wahl, belege } = leseRichtigFalsch(raw);
    return z.statements.map((_, i) => `${i + 1} ${wahl[i] != null ? (z.options[wahl[i]!] ?? "?") : "?"}${belege[i]?.trim() ? ` (${belege[i].trim()})` : ""}`).join(" · ");
  }
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    v = [raw];
  }
  const liste: unknown[] = Array.isArray(v) ? v : [];
  if (t.type === "zuordnung" && z) return z.statements.map((_, i) => `${i + 1} ${typeof liste[i] === "number" ? buchstabe(liste[i] as number) : "?"}`).join(" · ");
  return (t.answer.blanks ?? []).map((_, i) => `${i + 1} ${String(liste[i] ?? "").trim() || "?"}`).join(" · ");
}

/** Die richtige Antwort, wie der Solver sie schickt (Tests, Testmodus); null ohne Format oder bei Writing. */
export function englischRichtigeAntwort(t: Teil): string | null {
  const k = englischFormat(t);
  if (!k || k === "matura-writing") return null;
  if (k === "matura-true-false") return JSON.stringify({ wahl: t.answer.pairs ?? [], belege: (t.answer.belege ?? []).map((b) => ersteWoerter(b)) });
  if (t.type === "zuordnung") return JSON.stringify(t.answer.pairs ?? []);
  return JSON.stringify((t.answer.blanks ?? []).map((b) => b[0] ?? ""));
}

/** Eine sicher falsche Antwort, wie der Solver sie schickt: das erste Item falsch, alles andere richtig. */
export function englischFalscheAntwort(t: Teil): string | null {
  const k = englischFormat(t);
  if (!k || k === "matura-writing") return null;
  const p = [...(t.answer.pairs ?? [])];
  if (k === "matura-true-false") {
    p[0] = 1 - (p[0] ?? 0);
    return JSON.stringify({ wahl: p, belege: (t.answer.belege ?? []).map((b) => ersteWoerter(b)) });
  }
  if (t.type === "zuordnung") {
    const n = k === "matura-reading-mc" ? 4 : (t.data.zuordnung?.options.length ?? 0);
    // bei Matching ein Buchstabe, der übrig bleibt, damit keiner doppelt ist
    p[0] = Array.from({ length: n }, (_, i) => i).find((i) => !p.includes(i)) ?? ((p[0] ?? 0) + 1) % Math.max(1, n);
    return JSON.stringify(p);
  }
  const b = (t.answer.blanks ?? []).map((x) => x[0] ?? "");
  if (k === "matura-editing") b[0] = editingWert(b[0]) === "✓" ? (woerter(t.data.passage ?? "")[0] ?? "the") : "✓";
  else if (k === "matura-short-answers") b[0] = "one two three four five six";
  else if (k === "matura-banked-gap") b[0] = (t.data.wortliste ?? []).find((w) => !(t.answer.blanks?.[0] ?? []).some((x) => gleichesWort(w, x))) ?? "xyz";
  else b[0] = ["the", "a", "of"].find((w) => !(t.answer.blanks?.[0] ?? []).some((x) => gleichesWort(w, x)))!;
  return JSON.stringify(b);
}

/** Eine leere Aufgabe im Format für den Editor (neue Aufgabe oder anderer Aufgabentyp). */
export function englischLeer(k: EnglischMaturaFormat): Pick<TaskDraft, "type" | "data" | "answer"> & { prompt: string } {
  const luecken = (n: number) => Array.from({ length: n }, () => [""]);
  switch (k) {
    case "matura-true-false":
      return { type: "zuordnung", prompt: englischAuftrag(k, 3), data: { passage: "", zuordnung: { statements: ["", "", ""], options: ["True", "False"], art: "richtig-falsch" } }, answer: { pairs: [0, 1, 0], belege: ["", "", ""] } };
    case "matura-reading-mc":
      return { type: "zuordnung", prompt: englischAuftrag(k, 3), data: { passage: "", zuordnung: { statements: ["", "", ""], options: [], art: "fragen", choices: [0, 1, 2].map(() => ["", "", "", ""]) } }, answer: { pairs: [0, 0, 0] } };
    case "matura-matching":
      return { type: "zuordnung", prompt: englischAuftrag(k, 3, 2, "ueberschriften"), data: { passage: "", zuordnung: { statements: ["Paragraph 1", "Paragraph 2", "Paragraph 3"], options: ["", "", "", "", ""], art: "ueberschriften" } }, answer: { pairs: [0, 1, 2] } };
    case "matura-short-answers":
      return { type: "cloze", prompt: `${englischAuftrag(k, 3)}\n\n1 … ${GAP}\n2 … ${GAP}\n3 … ${GAP}`, data: { passage: "" }, answer: { blanks: luecken(3), mode: "text", maxWords: KURZ_WOERTER, teilpunkte: true } };
    case "matura-banked-gap":
      return { type: "cloze", prompt: `${englischAuftrag(k, 4, 2)}\n\n… (1) ${GAP} … (2) ${GAP} … (3) ${GAP} … (4) ${GAP} …`, data: { wortliste: [] }, answer: { blanks: luecken(4), mode: "text", teilpunkte: true } };
    case "matura-open-gap":
      return { type: "cloze", prompt: `${englischAuftrag(k, 4)}\n\n… (1) ${GAP} … (2) ${GAP} … (3) ${GAP} … (4) ${GAP} …`, data: {}, answer: { blanks: luecken(4), mode: "text", teilpunkte: true } };
    case "matura-word-formation":
      return { type: "cloze", prompt: `${englischAuftrag(k, 4)}\n\n… (1) ${GAP} (DECIDE) … (2) ${GAP} (CARE) … (3) ${GAP} (POSSIBLE) … (4) ${GAP} (INVENT) …`, data: {}, answer: { blanks: luecken(4), mode: "text", teilpunkte: true } };
    case "matura-editing":
      return { type: "cloze", prompt: `${englischAuftrag(k, 6)}\n\n${[1, 2, 3, 4, 5, 6].map((i) => `${i} … ${GAP}`).join("\n")}`, data: { editing: true }, answer: { blanks: luecken(6), mode: "text", teilpunkte: true } };
    case "matura-writing":
      return { type: "free", prompt: `Write an article of about 250 words.\n\nIn your article you should:\n• …\n• …\n• …`, data: { schreibauftrag: { textsorte: "article", woerter: 250 }, lines: 16 }, answer: { criteria: [...KRITERIEN] } };
  }
}
