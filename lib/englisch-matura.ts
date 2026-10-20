/**
 * Aufgaben in den Formaten der Englisch-Matura ohne KI (lib/englisch-matura-formate.ts), aus eigenen Texten
 * (lib/englisch-matura-texte.ts). Eine Aufgabe ist ein Text mit mehreren Items, wie bei der Matura: ein Lesetext
 * mit fünf bis acht Aussagen, ein Lückentext mit acht Lücken, ein Schreibauftrag. Die Schwierigkeit wählt das
 * Niveau des Textes (B1 leichter, B2 schwerer) und die Zahl der Items.
 */
import type { Difficulty, TaskType } from "./curriculum";
import {
  ENGLISCH_TEIL,
  englischAuftrag,
  istEnglischMatura,
  KURZ_WOERTER,
  schreibKriterien,
  TEXTSORTEN,
  wortRahmen,
  type EnglischMaturaFormat,
} from "./englisch-matura-formate";
import { BANKED_GAP, EDITING, LESETEXTE, OPEN_GAP, SCHREIBAUFTRAEGE, WORD_FORMATION, type Lesetext, type Lueckentext, type Niveau, type Schreibauftrag } from "./englisch-matura-texte";
import { GAP, type TaskDraft } from "./tasks";

type Rng = () => number;
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** n Elemente in ihrer Reihenfolge (die Items folgen dem Text, wie bei der Matura). */
function auswahl<T>(rng: Rng, xs: readonly T[], n: number): T[] {
  const behalten = new Set(shuffle(rng, xs.map((_, i) => i)).slice(0, n));
  return xs.filter((_, i) => behalten.has(i));
}

/** Welche Fähigkeit welches Format übt. */
export const FAEHIGKEIT_FORMAT: Record<string, EnglischMaturaFormat> = {
  "englisch.os.reading.true-false": "matura-true-false",
  "englisch.os.reading.multiple-choice": "matura-reading-mc",
  "englisch.os.reading.multiple-matching": "matura-matching",
  "englisch.os.reading.short-answers": "matura-short-answers",
  "englisch.os.liu.gap-fill-choice": "matura-banked-gap",
  "englisch.os.liu.open-gap-fill": "matura-open-gap",
  "englisch.os.liu.editing": "matura-editing",
  "englisch.os.vocab.word-formation": "matura-word-formation",
  "englisch.os.writing.task": "matura-writing",
  "englisch.os.writing.article": "matura-writing",
  "englisch.os.writing.blog-post": "matura-writing",
  "englisch.os.writing.blog-comment": "matura-writing",
  "englisch.os.writing.informal-email": "matura-writing",
  "englisch.os.writing.formal-email": "matura-writing",
  "englisch.os.writing.complaint": "matura-writing",
  "englisch.os.writing.report": "matura-writing",
  "englisch.os.writing.essay": "matura-writing",
  "englisch.os.writing.leaflet": "matura-writing",
};
export const istEnglischMaturaSkill = (id: string | null | undefined): id is string => Boolean(id && id in FAEHIGKEIT_FORMAT);

/** Writing: welche Schreibaufträge zu einer Fähigkeit passen (writing.task: alle). */
const SCHREIB_FILTER: Record<string, (a: Schreibauftrag) => boolean> = {
  "englisch.os.writing.article": (a) => a.textsorte === "article",
  "englisch.os.writing.blog-post": (a) => a.textsorte === "blog-post",
  "englisch.os.writing.blog-comment": (a) => a.textsorte === "blog-comment",
  "englisch.os.writing.informal-email": (a) => a.textsorte === "email-informal",
  "englisch.os.writing.formal-email": (a) => a.textsorte === "email-formal",
  "englisch.os.writing.complaint": (a) => Boolean(a.beschwerde),
  "englisch.os.writing.report": (a) => a.textsorte === "report",
  "englisch.os.writing.essay": (a) => a.textsorte === "essay",
  "englisch.os.writing.leaflet": (a) => a.textsorte === "leaflet",
};

const STUFE: Record<Difficulty, number> = { "sehr leicht": 0, leicht: 1, "leicht bis mittel": 1, mittel: 2, schwer: 3, "sehr schwer": 4 };
/** sehr leicht und leicht: B1, schwer: B2, sonst beide. */
function niveauFuer(difficulty: Difficulty): Niveau | null {
  const s = STUFE[difficulty] ?? 2;
  return s <= 1 ? "B1" : s >= 3 ? "B2" : null;
}
function textFuer<T extends { niveau: Niveau }>(rng: Rng, xs: readonly T[], difficulty: Difficulty): T {
  const n = niveauFuer(difficulty);
  const passend = xs.filter((x) => !n || x.niveau === n);
  return pick(rng, passend.length ? passend : xs);
}
/** Items je Schwierigkeit: [sehr leicht, leicht, mittel, schwer, sehr schwer]. */
const anzahl = (difficulty: Difficulty, je: [number, number, number, number, number]) => je[STUFE[difficulty] ?? 2];

const passage = (t: Lesetext) => t.absaetze.join("\n\n");
const nummern = (xs: string[]) => xs.map((x, i) => `${i + 1} ${x}`).join("\n");

const HILFEN: Record<EnglischMaturaFormat, string[]> = {
  "matura-true-false": [
    "Lies zuerst alle Aussagen und markiere die wichtigsten Wörter. Die Aussagen folgen der Reihenfolge des Textes.",
    "Achte auf kleine Wörter wie all, only, never und every: oft machen genau sie eine Aussage falsch.",
    "Schreib als Begründung die ersten vier Wörter des Satzes ab, der die Antwort zeigt, genau wie im Text.",
  ],
  "matura-reading-mc": [
    "Lies die Frage, bevor du die Antworten liest, und such die Stelle im Text.",
    "Eine Antwort, die Wörter aus dem Text wiederholt, ist nicht automatisch richtig. Es zählt, was der Text sagt.",
    "Streich die Antworten, die der Text sicher nicht sagt. Was übrig bleibt, prüfst du noch einmal am Text.",
  ],
  "matura-matching": [
    "Lies zuerst alle Antworten. Ein paar davon passen nirgends.",
    "Bei Überschriften: Worum geht es im ganzen Absatz, nicht nur in einem Satz?",
    "Bei Satzenden: Prüf Inhalt und Grammatik. Das Ende muss zum Anfang passen und zum Text.",
  ],
  "matura-short-answers": [
    "Die Antworten stehen im Text, meist in der Reihenfolge der Fragen.",
    "Schreib keine ganzen Sätze. Höchstens vier Wörter je Antwort.",
    "Achte auf das Fragewort: when fragt nach einer Zeit, why nach einem Grund, how many nach einer Zahl.",
  ],
  "matura-banked-gap": [
    "Lies zuerst den ganzen Text, dann die Wörter im Kasten.",
    "Frag bei jeder Lücke: Braucht es ein Nomen, ein Verb, ein Adjektiv oder ein Adverb?",
    "Jedes Wort passt nur einmal. Streich die Wörter, die du schon verwendet hast.",
  ],
  "matura-open-gap": [
    "In jede Lücke kommt genau ein Wort, meist ein kleines: eine Präposition, ein Artikel, ein Pronomen oder ein Bindewort.",
    "Lies den ganzen Satz, auch nach der Lücke. Was fehlt grammatisch?",
    "Typisch: since und for, so und such, who und which, than nach einem Vergleich.",
  ],
  "matura-editing": [
    "Lies jede Zeile im ganzen Satz, auch über das Zeilenende hinaus.",
    "Das überflüssige Wort ist oft klein: ein doppeltes Hilfsverb, to nach can oder must, ein Artikel zu viel.",
    "Manche Zeilen sind richtig. Dann schreibst du ✓.",
  ],
  "matura-word-formation": [
    "Frag zuerst: Braucht die Lücke ein Nomen, ein Verb, ein Adjektiv oder ein Adverb?",
    "Achte auf Mehrzahl (-s), Verneinung (un-, in-, im-, dis-) und Steigerung (-er).",
    "Typische Endungen: -tion, -ment, -ness, -ity für Nomen, -ful, -ous, -able, -al für Adjektive, -ly für Adverbien.",
  ],
  "matura-writing": [
    "Mach dir zu jedem der drei Punkte zwei, drei Stichwörter, bevor du schreibst.",
    "Plane einen Absatz je Punkt, dazu Einleitung und Schluss. Achte auf die Merkmale der Textsorte.",
    "Zähl am Ende die Wörter. Bleib im Rahmen von ±10 %.",
  ],
};

type Teil = Omit<TaskDraft, "skillId" | "skillIds" | "difficulty" | "hints" | "category">;

function leseAufgabe(k: EnglischMaturaFormat, t: Lesetext, difficulty: Difficulty, rng: Rng): Teil {
  const text = { passage: passage(t), passageTitle: t.titel };
  switch (k) {
    case "matura-true-false": {
      const n = Math.min(t.wahrFalsch.length, anzahl(difficulty, [5, 5, 6, 7, 8]));
      // mindestens eine Aussage True und eine False
      let items = auswahl(rng, t.wahrFalsch, n);
      for (let i = 0; i < 20 && (items.every((x) => x.wahr) || items.every((x) => !x.wahr)); i++) items = auswahl(rng, t.wahrFalsch, n);
      return {
        type: "zuordnung",
        prompt: englischAuftrag(k, n),
        data: { ...text, zuordnung: { statements: items.map((x) => x.aussage), options: ["True", "False"], art: "richtig-falsch" } },
        answer: { pairs: items.map((x) => (x.wahr ? 0 : 1)), belege: items.map((x) => x.beleg) },
        solution: items.map((x, i) => `${i + 1} ${x.wahr ? "True" : "False"}: „${x.beleg}“`).join("\n"),
        errorMap: [],
        estimatedTimeSec: 900,
      };
    }
    case "matura-reading-mc": {
      const fragen = auswahl(rng, t.fragen, Math.min(t.fragen.length, anzahl(difficulty, [4, 4, 5, 5, 5])));
      const choices = fragen.map((f) => shuffle(rng, f.antworten));
      return {
        type: "zuordnung",
        prompt: englischAuftrag(k, fragen.length),
        data: { ...text, zuordnung: { statements: fragen.map((f) => f.frage), options: [], art: "fragen", choices } },
        answer: { pairs: fragen.map((f, i) => choices[i].indexOf(f.antworten[0])) },
        solution: fragen.map((f, i) => `${i + 1} ${String.fromCharCode(65 + choices[i].indexOf(f.antworten[0]))}: ${f.antworten[0]}`).join("\n"),
        errorMap: [],
        estimatedTimeSec: 900,
      };
    }
    case "matura-matching": {
      const extra = STUFE[difficulty] === 0 ? 1 : 2;
      if (rng() < 0.5) {
        const options = shuffle(rng, [...t.ueberschriften, ...t.ueberschriftenExtra.slice(0, extra)]);
        return {
          type: "zuordnung",
          prompt: englischAuftrag(k, t.absaetze.length, extra, "ueberschriften"),
          data: { ...text, zuordnung: { statements: t.absaetze.map((_, i) => `Paragraph ${i + 1}`), options, art: "ueberschriften" } },
          answer: { pairs: t.ueberschriften.map((u) => options.indexOf(u)) },
          solution: t.ueberschriften.map((u, i) => `Paragraph ${i + 1}: ${String.fromCharCode(65 + options.indexOf(u))} ${u}`).join("\n"),
          errorMap: [],
          estimatedTimeSec: 900,
        };
      }
      const saetze = auswahl(rng, t.satzenden, Math.min(t.satzenden.length, anzahl(difficulty, [4, 5, 5, 6, 6])));
      const options = shuffle(rng, [...saetze.map((s) => s.ende), ...t.satzendenExtra.slice(0, extra)]);
      return {
        type: "zuordnung",
        prompt: englischAuftrag(k, saetze.length, extra, "satzenden"),
        data: { ...text, zuordnung: { statements: saetze.map((s) => s.anfang), options, art: "satzenden" } },
        answer: { pairs: saetze.map((s) => options.indexOf(s.ende)) },
        solution: saetze.map((s, i) => `${i + 1} ${String.fromCharCode(65 + options.indexOf(s.ende))}: ${s.anfang} ${s.ende}`).join("\n"),
        errorMap: [],
        estimatedTimeSec: 900,
      };
    }
    default: {
      const fragen = auswahl(rng, t.kurz, Math.min(t.kurz.length, anzahl(difficulty, [4, 4, 5, 6, 6])));
      return {
        type: "cloze",
        prompt: `${englischAuftrag("matura-short-answers", fragen.length)}\n\n${nummern(fragen.map((f) => `${f.frage} ${GAP}`))}`,
        data: text,
        answer: { blanks: fragen.map((f) => f.antworten), mode: "text", maxWords: KURZ_WOERTER, teilpunkte: true },
        solution: fragen.map((f, i) => `${i + 1} ${f.antworten[0]}`).join("\n"),
        errorMap: [],
        estimatedTimeSec: 720,
      };
    }
  }
}

/** Ein Lückentext aus {…|…}: die Lücken werden (1) ___, die Wörter darin die Lösungen. */
function luecken(text: string, mitGrundwort: boolean): { text: string; blanks: string[][] } {
  const blanks: string[][] = [];
  const out = text.replace(/\{([^}]+)\}/g, (_, inhalt: string) => {
    const [loesung, grund] = mitGrundwort ? inhalt.split(":") : [inhalt, ""];
    blanks.push(loesung.split(/[|/]/).map((x) => x.trim()));
    return `(${blanks.length}) ${GAP}${grund ? ` (${grund.trim()})` : ""}`;
  });
  return { text: out, blanks };
}

function lueckenAufgabe(k: EnglischMaturaFormat, difficulty: Difficulty, rng: Rng): Teil {
  if (k === "matura-editing") {
    const t = textFuer(rng, EDITING, difficulty);
    const blanks = t.zeilen.map((z) => [z.match(/\{([^}]+)\}/)?.[1] ?? "✓"]);
    const zeilen = t.zeilen.map((z, i) => `${i + 1} ${z.replace(/\{([^}]+)\}/, "$1")} ${GAP}`);
    return {
      type: "cloze",
      prompt: `${englischAuftrag(k, zeilen.length)}\n\n${t.titel}\n${zeilen.join("\n")}`,
      data: { editing: true },
      answer: { blanks, mode: "text", teilpunkte: true },
      solution: blanks.map((b, i) => `${i + 1} ${b[0]}`).join("\n"),
      errorMap: [],
      estimatedTimeSec: 600,
    };
  }
  const bank: readonly Lueckentext[] = k === "matura-banked-gap" ? BANKED_GAP : k === "matura-word-formation" ? WORD_FORMATION : OPEN_GAP;
  const t = textFuer(rng, bank, difficulty);
  const { text, blanks } = luecken(t.text, k === "matura-word-formation");
  const extra = k === "matura-banked-gap" ? (BANKED_GAP.find((b) => b.id === t.id)?.extra ?? []) : [];
  const wortliste = k === "matura-banked-gap" ? [...blanks.map((b) => b[0].toLowerCase()), ...extra].sort((a, b) => a.localeCompare(b, "en")) : undefined;
  return {
    type: "cloze",
    prompt: `${englischAuftrag(k, blanks.length, extra.length)}\n\n${t.titel}\n${text}`,
    data: wortliste ? { wortliste } : {},
    answer: { blanks, mode: "text", teilpunkte: true },
    solution: blanks.map((b, i) => `${i + 1} ${b.join(" / ")}`).join("\n"),
    errorMap: [],
    estimatedTimeSec: 600,
  };
}

/** Der Lösungsweg eines Schreibauftrags: wie bewertet wird. */
export function schreibLoesung(woerter: number): string {
  const { min, max } = wortRahmen(woerter);
  return `Bewertet wird nach den vier Kriterien der Matura. Alle drei Punkte müssen vorkommen, die Wortanzahl liegt zwischen ${min} und ${max}. Der Mustertext zeigt eine Möglichkeit.`;
}
/** Etwa 45 Minuten für 250 Wörter. */
export const schreibZeit = (woerter: number) => Math.round((woerter / 250) * 2700);

/** Der Schreibauftrag als Text: Situation, Auftrag mit Wortanzahl, die drei Punkte mit •. */
export function schreibPrompt(a: Pick<Schreibauftrag, "situation" | "auftrag" | "woerter" | "textsorte" | "punkte" | "zusatz">): string {
  const name = TEXTSORTEN[a.textsorte].name;
  return [a.situation, `${a.auftrag} Write about ${a.woerter} words.`, `In your ${name}, you should:\n${a.punkte.map((p) => `• ${p}`).join("\n")}`, a.zusatz ?? ""].filter(Boolean).join("\n\n");
}

function schreibAufgabe(skillId: string | null, difficulty: Difficulty, rng: Rng): Teil {
  const filter = (skillId && SCHREIB_FILTER[skillId]) || (() => true);
  const a = textFuer(rng, SCHREIBAUFTRAEGE.filter(filter), difficulty);
  return {
    type: "free",
    prompt: schreibPrompt(a),
    data: { schreibauftrag: { textsorte: a.textsorte, woerter: a.woerter }, lines: 16 },
    answer: { sample: a.muster, criteria: schreibKriterien(a.textsorte, a.woerter) },
    solution: schreibLoesung(a.woerter),
    errorMap: [],
    estimatedTimeSec: schreibZeit(a.woerter),
  };
}

/** Eine Aufgabe im Format k. `skillId`: die Fähigkeit (bei Writing wählt sie die Textsorte). */
export function englischMaturaAufgabe(k: EnglischMaturaFormat, difficulty: Difficulty, rng: Rng = Math.random, skillId: string | null = null): TaskDraft {
  const teil = ENGLISCH_TEIL[k] === "reading" ? leseAufgabe(k, textFuer(rng, LESETEXTE, difficulty), difficulty, rng) : k === "matura-writing" ? schreibAufgabe(skillId, difficulty, rng) : lueckenAufgabe(k, difficulty, rng);
  return { ...teil, skillId, skillIds: skillId ? [skillId] : [], category: k, difficulty, hints: HILFEN[k], sourceType: "eigen" };
}

/** Diese Typen des Builders geben bei einer Fähigkeit der Englisch-Matura ihr Format (kein Hinweis „Typ fehlt“). */
const GLEICHWERTIG: Record<"reading" | "liu" | "writing", string[]> = {
  reading: ["reading", "mc"],
  liu: ["gap", "lueckentext", "grammar", "vocabulary"],
  writing: ["writing", "offen", "schreiben"],
};

/**
 * Das Format für einen Platz im Builder: das gewählte, wenn es zum selben Teil der Matura gehört (Reading, Language
 * in Use, Writing), sonst das der Fähigkeit; der Builder sagt dann, dass es den Typ so nicht gibt.
 */
export function englischMaturaFuerKategorie(skillId: string, category: string | null, difficulty: Difficulty, rng: Rng = Math.random): { task: TaskDraft; category: EnglischMaturaFormat } {
  const eigen = FAEHIGKEIT_FORMAT[skillId];
  const teil = ENGLISCH_TEIL[eigen];
  const k = istEnglischMatura(category) && ENGLISCH_TEIL[category] === teil ? category : category === "mc" && teil === "reading" ? "matura-reading-mc" : eigen;
  return { task: englischMaturaAufgabe(k, difficulty, rng, skillId), category: k };
}

/** Hat der Builder bekommen, was gewählt war? Auch „Reading comprehension“ für True or False zählt. */
export function englischGleichwertig(gewaehlt: string, bekommen: string | null | undefined): boolean {
  if (!istEnglischMatura(bekommen)) return false;
  return gewaehlt === bekommen || GLEICHWERTIG[ENGLISCH_TEIL[bekommen]].includes(gewaehlt);
}

/** Eine Aufgabe für generateBuiltIn: das Format der Fähigkeit, egal welcher Antworttyp verlangt ist. */
export function englischMaturaFuerTyp(skillId: string, _taskType: TaskType | "mixed", difficulty: Difficulty, rng: Rng = Math.random): TaskDraft {
  return englischMaturaAufgabe(FAEHIGKEIT_FORMAT[skillId], difficulty, rng, skillId);
}

/** Für lib/generators.ts GEN: jede Fähigkeit mit ihrem Format (hasBuiltInGenerator). */
export const ENGLISCH_MATURA_GEN: Record<string, (rng: Rng, difficulty: Difficulty) => TaskDraft> = Object.fromEntries(
  Object.entries(FAEHIGKEIT_FORMAT).map(([id, k]) => [id, (rng: Rng, difficulty: Difficulty) => englischMaturaAufgabe(k, difficulty, rng, id)]),
);
