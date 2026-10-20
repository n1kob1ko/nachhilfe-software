/**
 * Aufgaben der Englisch-Matura von der KI (lib/englisch-matura-formate.ts), nur auf Klick im Builder: die Regeln
 * für den Prompt und die strenge Prüfung der Antwort. Was nicht genau in die Form passt, fällt weg wie jede
 * ungültige KI-Aufgabe (null, der Platz wird neu gemacht oder kommt aus den eigenen Texten). Die KI ändert nie
 * den Lernstand; sie liefert nur Aufgaben.
 */
import { editingWert, woerter } from "../englisch-matura-pruefen";
import {
  englischAuftrag,
  istTextsorte,
  KURZ_WOERTER,
  pruefeEnglisch,
  schreibKriterien,
  TEXTSORTEN,
  type EnglischMaturaFormat,
} from "../englisch-matura-formate";
import { schreibLoesung, schreibZeit } from "../englisch-matura";
import { GAP, gapCount, type TaskDraft } from "../tasks";
import type { AITask } from "./features";

/** Nur wenn ein Format der Englisch-Matura verlangt ist: die Form, in der die KI es liefert. */
export const ENGLISCH_MATURA_RULES = `Englisch-Matura-Formate (die Formate der schriftlichen Englisch-Matura, Niveau B1 bis B2):
Erfinde eigene englische Texte und Aufgaben. Übernimm nichts aus früheren Maturen, aus dem Aufgabenpool, aus Schulbüchern oder vom IQS, auch nicht leicht verändert. Nur die Form ist dieselbe. Personen und Orte sind erfunden, keine echten Namen.
Aufgaben, Texte und Antworten auf Englisch. Keine Gedankenstriche im Text, schreib stattdessen Beistriche oder neue Sätze.
Reading (passage = der Lesetext, 250 bis 450 Wörter, 4 bis 6 Absätze, getrennt durch eine Leerzeile; passage_title = sein Titel):
- matura-true-false: format zuordnung; statements = 5 bis 8 Aussagen in der Reihenfolge des Textes; pairs = je Aussage 0 (True) oder 1 (False), mindestens eine True und eine False; justifications = je Aussage der ganze Satz aus passage, Wort für Wort abgeschrieben, der die Antwort zeigt
- matura-reading-mc: format zuordnung; statements = 4 bis 6 Fragen zum Text; question_options = je Frage genau vier verschiedene Antworten; pairs = je Frage der Index (0-basiert) der einzigen richtigen
- matura-matching: format zuordnung; matching_type headings: statements = "Paragraph 1", "Paragraph 2" … (einer je Absatz), options = die Überschriften; matching_type endings: statements = 4 bis 6 Satzanfänge, options = die Satzenden; options hat 1 bis 3 Antworten mehr als statements; pairs = je Zeile der Index in options, keiner doppelt
- matura-short-answers: format cloze; prompt = je Frage eine Zeile „Nummer Frage ${GAP}“ (4 bis 6 Fragen); blanks = je Frage alle richtigen Antworten mit höchstens ${KURZ_WOERTER} Wörtern, Wörter aus dem Text
Language in Use (ein zusammenhängender Text, 6 bis 10 Lücken, jede als (1) ${GAP}, (2) ${GAP} …; die erste Zeile im prompt ist der Titel):
- matura-banked-gap: format cloze; blanks = je Lücke das eine Wort; word_bank = alle Lösungswörter und 2 bis 4 weitere, die in keine Lücke passen
- matura-open-gap: format cloze; in jede Lücke genau ein Wort (Präposition, Artikel, Pronomen, Bindewort, Hilfsverb); blanks = je Lücke alle richtigen Wörter
- matura-editing: format cloze; prompt = 8 bis 12 nummerierte Zeilen eines Textes, jede endet mit ${GAP}; in den meisten Zeilen steht ein Wort, das nicht hingehört; mindestens zwei Zeilen sind richtig; blanks = je Zeile das überflüssige Wort oder ["✓"]
- matura-word-formation: format cloze; nach jeder Lücke das Grundwort in Großbuchstaben, z. B. (1) ${GAP} (DECIDE); blanks = die passende abgeleitete Form, nie das Grundwort selbst
Writing:
- matura-writing: format free; prompt = die Situation, dann „Write a/an <text type> … Write about <word_count> words.“, dann „In your <text type>, you should:“ und genau drei Zeilen, die mit „• “ beginnen; text_type = ${Object.keys(TEXTSORTEN).join(", ")}; word_count = 150 bis 400; sample_answer = ein Mustertext mit dieser Wortanzahl (höchstens 10 % mehr oder weniger)
hints auf Deutsch. common_errors leer lassen.`;

const ohneStriche = (s: string) => s.replace(/\s*[—]\s*/g, ", ").replace(/\s+–\s+/g, ", ");
const text = (xs: string[] | null | undefined) => (xs ?? []).map((x) => ohneStriche(x.trim()));
const indexIn = (x: unknown, bis: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < bis;

/** Die Reihenfolge, in der Antworten gezeigt werden: gemischt. */
function gemischt(n: number, rng: () => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** Der Text mit Lücken ohne den Auftrag der KI; der eigene Auftrag kommt davor. */
function lueckenText(prompt: string): string {
  const bloecke = prompt.trim().split(/\n\s*\n/);
  return (bloecke.length > 1 && !bloecke[0].includes(GAP) ? bloecke.slice(1) : bloecke).join("\n\n").trim();
}

type KiBasis = Pick<TaskDraft, "skillId" | "skillIds" | "category" | "difficulty" | "prompt" | "solution" | "solutionSteps" | "estimatedTimeSec" | "sourceType" | "hints" | "errorMap">;

/**
 * Eine KI-Aufgabe in einem Format der Englisch-Matura, streng geprüft (lib/englisch-matura-formate.ts pruefeEnglisch):
 * die Belege von True or False stehen Wort für Wort im Text, Multiple Choice hat je Frage genau vier Antworten,
 * Matching hat Antworten, die übrig bleiben, Short Answers höchstens vier Wörter, Writing einen Mustertext in der
 * verlangten Länge. Der Arbeitsauftrag ist immer der eigene; Antworten werden gemischt.
 */
export function englischAusKI(t: AITask, base: KiBasis, k: EnglischMaturaFormat, rng: () => number, no: (reason: string) => null): TaskDraft | null {
  const passage = ohneStriche(t.passage?.trim() ?? "");
  const lese = { passage, passageTitle: ohneStriche(t.passage_title?.trim() ?? "") || undefined };
  const st = text(t.statements);
  const pairs = t.pairs ?? [];
  const solutionAus = (zeilen: string[]) => zeilen.join("\n");
  const fertig = { ...base, errorMap: [] };
  let d: TaskDraft;
  switch (k) {
    case "matura-true-false": {
      const belege = text(t.justifications);
      if (pairs.length !== st.length || !pairs.every((i) => indexIn(i, 2))) return no(`${k}: True oder False (pairs) fehlt oder passt nicht`);
      d = {
        ...fertig,
        type: "zuordnung",
        prompt: englischAuftrag(k, st.length),
        data: { ...lese, zuordnung: { statements: st, options: ["True", "False"], art: "richtig-falsch" } },
        answer: { pairs, belege },
        solution: solutionAus(st.map((_, i) => `${i + 1} ${pairs[i] === 0 ? "True" : "False"}: „${belege[i] ?? ""}“`)),
      };
      break;
    }
    case "matura-reading-mc": {
      const c = (t.question_options ?? []).map((xs) => text(xs));
      if (c.length !== st.length || c.some((xs) => xs.length !== 4)) return no(`${k}: je Frage genau vier Antworten verlangt`);
      if (pairs.length !== st.length || !pairs.every((i) => indexIn(i, 4))) return no(`${k}: die richtige Antwort (pairs) fehlt oder passt nicht`);
      const p = c.map(() => gemischt(4, rng));
      const choices = c.map((xs, i) => p[i].map((j) => xs[j]));
      const richtig = pairs.map((r, i) => p[i].indexOf(r));
      d = {
        ...fertig,
        type: "zuordnung",
        prompt: englischAuftrag(k, st.length),
        data: { ...lese, zuordnung: { statements: st, options: [], art: "fragen", choices } },
        answer: { pairs: richtig },
        solution: solutionAus(richtig.map((r, i) => `${i + 1} ${String.fromCharCode(65 + r)}: ${choices[i][r]}`)),
      };
      break;
    }
    case "matura-matching": {
      const o = text(t.options);
      const art = t.matching_type === "endings" ? "satzenden" : "ueberschriften";
      if (pairs.length !== st.length || !pairs.every((i) => indexIn(i, o.length))) return no(`${k}: die Zuordnung (pairs) fehlt oder passt nicht`);
      const p = gemischt(o.length, rng);
      const options = p.map((i) => o[i]);
      const richtig = pairs.map((r) => p.indexOf(r));
      d = {
        ...fertig,
        type: "zuordnung",
        prompt: englischAuftrag(k, st.length, o.length - st.length, art),
        data: { ...lese, zuordnung: { statements: st, options, art } },
        answer: { pairs: richtig },
        solution: solutionAus(richtig.map((r, i) => `${st[i]}: ${String.fromCharCode(65 + r)} ${options[r]}`)),
      };
      break;
    }
    case "matura-short-answers": {
      const fragen = lueckenText(ohneStriche(base.prompt));
      const blanks = (t.blanks ?? []).map((xs) => text(xs).filter(Boolean));
      // eine Antwort mit mehr als vier Wörtern zählt nicht als richtige Antwort: weg damit, bleibt keine, fällt die Aufgabe weg
      const kurz = blanks.map((xs) => xs.filter((x) => woerter(x).length <= KURZ_WOERTER));
      d = {
        ...fertig,
        type: "cloze",
        prompt: `${englischAuftrag(k, gapCount(fragen))}\n\n${fragen}`,
        data: lese,
        answer: { blanks: kurz, mode: "text", maxWords: KURZ_WOERTER, teilpunkte: true },
        solution: solutionAus(kurz.map((xs, i) => `${i + 1} ${xs[0] ?? ""}`)),
      };
      break;
    }
    case "matura-banked-gap":
    case "matura-open-gap":
    case "matura-editing":
    case "matura-word-formation": {
      const luecken = lueckenText(ohneStriche(base.prompt));
      let blanks = (t.blanks ?? []).map((xs) => text(xs).filter(Boolean));
      if (k === "matura-editing") blanks = blanks.map((xs) => [editingWert(xs[0] ?? "") === "✓" ? "✓" : (xs[0] ?? "")]);
      const bank = k === "matura-banked-gap" ? [...new Set(text(t.word_bank).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")) : undefined;
      const extra = bank ? bank.length - blanks.length : 0;
      d = {
        ...fertig,
        type: "cloze",
        prompt: `${englischAuftrag(k, gapCount(luecken), extra)}\n\n${luecken}`,
        data: k === "matura-editing" ? { editing: true } : bank ? { wortliste: bank } : {},
        answer: { blanks, mode: "text", teilpunkte: true },
        solution: solutionAus(blanks.map((xs, i) => `${i + 1} ${xs.join(" / ")}`)),
      };
      break;
    }
    case "matura-writing": {
      const textsorte = t.text_type;
      const woerterSoll = t.word_count ?? 0;
      if (!istTextsorte(textsorte)) return no(`${k}: Textsorte fehlt`);
      const sample = ohneStriche((t.sample_answer ?? "").trim());
      if (!sample) return no(`${k}: Mustertext fehlt`);
      d = {
        ...fertig,
        type: "free",
        prompt: ohneStriche(base.prompt).replace(/^\s*[-*]\s+/gm, "• "),
        data: { schreibauftrag: { textsorte, woerter: woerterSoll }, lines: 16 },
        answer: { sample, criteria: schreibKriterien(textsorte, woerterSoll) },
        solution: schreibLoesung(woerterSoll),
        estimatedTimeSec: schreibZeit(woerterSoll),
      };
      break;
    }
  }
  const fehler = pruefeEnglisch(d);
  return fehler ? no(`${k}: ${fehler}`) : d;
}
