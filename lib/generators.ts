/**
 * Built-in exercise generators. They work without any AI service and always produce
 * a correct solution path. Math is generated procedurally; language tasks come from
 * curated item banks.
 */
import type { Difficulty, TaskType } from "./curriculum";
import type { TaskDraft } from "./tasks";
import { GAP, parseNumber } from "./tasks";
import {
  adjektivdeklinationItems,
  artikelItems,
  dasDassItems,
  hauptsatzGliedsatzItems,
  perfektItems,
  praepositionenItems,
  praeteritumItems,
  type AdjektivdeklinationItem,
  type ArtikelItem,
  type BankId,
  type BankItem,
  type ClozeItem as BankClozeItem,
  type DasDassItem,
  type HauptsatzGliedsatzItem,
  type PraepositionenItem,
} from "./banks";
import { artikelForm, bankStufe, endungImSatz, fallVon, type Stufe } from "./banken-regeln";
import { DEUTSCH_SATZLEHRE, deutschAufgabe, deutschFuerKategorie, deutschFuerTyp, istDeutschSatzlehre } from "./deutsch-satzlehre";
import { ENGLISCH_GRAMMATIK, englischAufgabe, englischFuerKategorie, englischFuerTyp, istEnglischGrammatik } from "./englisch-grammatik";
import { ENGLISCH_MATURA_GEN, englischMaturaFuerKategorie, englischMaturaFuerTyp, istEnglischMaturaSkill } from "./englisch-matura";
import { ENGLISCH_TEIL, istEnglischMatura } from "./englisch-matura-formate";
import { aufgabenSchluessel } from "./figur";
import { expectedFixes } from "./fix-text";
import { figurAufgabe, figurFaehigkeit, type FigurFormat } from "./generators-figur";
import { rechenwegTask, sachaufgabeTask } from "./generators-mathe";
import { MATHE_MATURA, istMatheMatura, matheMaturaFuerKategorie, matheMaturaFuerTyp } from "./mathe-matura";
import { MATHE_RECHNUNGEN } from "./mathe-rechnungen";
import { istMaturaKategorie, pruefeMatura } from "./matura-formate";
import { textaufgabeTask } from "./textaufgaben";
import { EXPLAIN } from "./erklaerungen";
import { VOKABEL_GENERATOREN, istVokabelThema, vokabelFuerSlot, vokabelFuerTyp } from "./vokabeln-themen";
import { isWortartenSkill, wortartenFor, wortartenTask, type WortartSetting } from "./wortarten";

type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The built-in generators know four number ranges; "sehr schwer" uses the hardest one.
const LEVEL: Record<Difficulty, number> = { "sehr leicht": 0, leicht: 1, "leicht bis mittel": 1, mittel: 2, schwer: 3, "sehr schwer": 3 };

type Gen = (rng: Rng, difficulty: Difficulty) => TaskDraft;

const GEN: Record<string, Gen> = {
  // Mathematik: Rechnungen mit Schulbuch-Zahlen (lib/mathe-rechnungen.ts); Textgleichungen sind Textaufgaben
  ...MATHE_RECHNUNGEN,
  "mathe.gleichungen.text": (rng, diff) => textaufgabeTask("mathe.gleichungen.text", diff, rng)!,
  // Oberstufe: Aufgaben in den Antwortformaten der AHS-Matura (lib/mathe-matura.ts)
  ...MATHE_MATURA,

  "deutsch.beistrich.aufzaehlung": bankMC("deutsch.beistrich.aufzaehlung", () => BEISTRICH_AUFZ),
  "deutsch.beistrich.nebensatz": bankMC("deutsch.beistrich.nebensatz", () => BEISTRICH_NS),
  "deutsch.beistrich.infinitiv": bankMC("deutsch.beistrich.infinitiv", () => BEISTRICH_INF),
  "deutsch.recht.dasdass": stufenCloze("deutsch.recht.dasdass", "das-dass", dasDassItems, "text"),
  "deutsch.recht.gross": bankCloze("deutsch.recht.gross", () => GROSS, "exact"),
  "deutsch.recht.sss": bankCloze("deutsch.recht.sss", () => SSS, "exact"),
  "deutsch.grammatik.faelle": bankMC("deutsch.grammatik.faelle", () => FAELLE),
  "deutsch.grammatik.zeiten": bankMC("deutsch.grammatik.zeiten", () => ZEITEN),
  // Artikel, Adjektivdeklination, Präpositionen und Haupt-/Gliedsatz kommen aus data/banks/ (Phase 1).
  "deutsch.grammatik.artikel": artikelTask,
  "deutsch.grammatik.adjektivdeklination": adjektivdeklinationTask,
  "deutsch.grammatik.praepositionen": praepositionenTask,
  "deutsch.satz.hauptsatz-gliedsatz": hauptsatzGliedsatzTask,
  // Präteritum und Perfekt kommen aus data/banks/ (Phase 1); ihre Einträge standen früher in ZEITEN_CLOZE
  "deutsch.grammatik.praeteritum": stufenCloze("deutsch.grammatik.praeteritum", "praeteritum", praeteritumItems, "exact"),
  "deutsch.grammatik.perfekt": stufenCloze("deutsch.grammatik.perfekt", "perfekt", perfektItems, "exact"),
  // Englisch: Tenses, Grammar und Irregular verbs mit eigenen Wortlisten und Satzmustern (lib/englisch-grammatik.ts)
  ...ENGLISCH_GRAMMATIK,
  // Englisch-Matura: Reading, Language in Use und Writing aus eigenen Texten (lib/englisch-matura.ts)
  ...ENGLISCH_MATURA_GEN,
  // Deutsch-Satzlehre: Satzglieder, Fälle, Zeitformen, Passiv, direkte Rede aus Satzmustern (lib/deutsch-satzlehre.ts)
  ...DEUTSCH_SATZLEHRE,
  // Vokabeltrainer: Themenlisten mit eigenen Sätzen (lib/vokabeln-themen.ts)
  ...VOKABEL_GENERATOREN,
};

// ---------- item banks ----------
type MCItem = { q: string; options: string[]; correct: number; solution: string; hint: string; errors?: Record<number, string> };
type ClozeItem = { q: string; blanks: string[][]; solution: string; hint: string; errors?: Record<string, string> };

function bankMC(skillId: string, bank: () => MCItem[]): Gen {
  return (rng, diff) => {
    const item = pick(rng, bank());
    return {
      type: "mc",
      skillId,
      difficulty: diff,
      prompt: item.q,
      data: { options: item.options },
      answer: { correct: item.correct },
      solution: item.solution,
      hints: [item.hint],
      errorMap: Object.entries(item.errors ?? {}).map(([k, label]) => ({ answer: k, label })),
    };
  };
}
function bankCloze(skillId: string, bank: () => ClozeItem[], mode: "text" | "exact"): Gen {
  return (rng, diff) => clozeTaskFrom(skillId, pick(rng, bank()), diff, mode);
}
/** Wie `bankCloze`, aber für eine Bank aus data/banks/: der Eintrag passt zur eingestellten Schwierigkeit. */
function stufenCloze(skillId: string, id: "praeteritum" | "perfekt" | "das-dass", bank: () => ClozeItem[], mode: "text" | "exact"): Gen {
  return (rng, diff) => clozeTaskFrom(skillId, pick(rng, nachStufe(id, bank(), diff)), diff, mode);
}
/** Ein Lückentext aus einem vorgegebenen Eintrag; `bankCloze` zieht den Eintrag nur zufällig. */
function clozeTaskFrom(skillId: string, item: ClozeItem, diff: Difficulty, mode: "text" | "exact"): TaskDraft {
  return {
    type: "cloze",
    skillId,
    difficulty: diff,
    prompt: item.q,
    data: {},
    answer: { blanks: item.blanks, mode },
    solution: item.solution,
    hints: [item.hint],
    errorMap: Object.entries(item.errors ?? {}).map(([answer, label]) => ({ answer, label })),
  };
}

// ---------- Phase-1-Banken: Artikel, Adjektivdeklination, Präpositionen, Haupt-/Gliedsatz ----------
/**
 * Welche Stufen eines Bankeintrags (lib/banken-regeln.ts `bankStufe`: 0 = sehr leicht … 3 = schwer) zu
 * einer Schwierigkeit passen.
 */
const STUFEN: Record<Difficulty, Stufe[]> = {
  "sehr leicht": [0],
  leicht: [0, 1],
  "leicht bis mittel": [1, 2],
  mittel: [1, 2],
  schwer: [2, 3],
  "sehr schwer": [3],
};
/** Mit weniger passenden Einträgen wiederholen sich die Aufgaben: dann kommen die Nachbarstufen dazu. */
const MIN_EINTRAEGE = 12;
const stufenCache = new WeakMap<object, Map<Difficulty, unknown[]>>();

/**
 * Die Einträge einer Bank, die zur Schwierigkeit passen. Gibt die Bank keine Stufe her (das/dass) oder
 * passen weniger als MIN_EINTRAEGE, wird der Bereich nach beiden Seiten erweitert, bis genug da sind;
 * die Liste ist nur leer, wenn die Bank leer ist. Je Bankfassung und Schwierigkeit einmal berechnet.
 */
export function nachStufe<K extends BankId>(id: K, items: BankItem<K>[], diff: Difficulty): BankItem<K>[] {
  let jeSchwierigkeit = stufenCache.get(items);
  if (!jeSchwierigkeit) stufenCache.set(items, (jeSchwierigkeit = new Map()));
  const fertig = jeSchwierigkeit.get(diff);
  if (fertig) return fertig as BankItem<K>[];
  const stufen = items.map((it) => bankStufe(id, it));
  let [von, bis] = [Math.min(...STUFEN[diff]), Math.max(...STUFEN[diff])];
  const passend = () => items.filter((_, i) => stufen[i] === null || (stufen[i]! >= von && stufen[i]! <= bis));
  let out = passend();
  while (out.length < MIN_EINTRAEGE && (von > 0 || bis < 3)) {
    [von, bis] = [Math.max(0, von - 1), Math.min(3, bis + 1)];
    out = passend();
  }
  jeSchwierigkeit.set(diff, out);
  return out;
}

/** Einmal je Bankfassung berechnet (eine Bank ist nach dem Laden fest; ein Test kann sie austauschen). */
function jeBank<T extends object, U>(make: (bank: T) => U): (bank: T) => U {
  const cache = new WeakMap<T, U>();
  return (bank) => {
    let v = cache.get(bank);
    if (v === undefined) cache.set(bank, (v = make(bank)));
    return v;
  };
}

/** Wörter mit nur einem richtigen Artikel: nur sie kommen als Auswahl (bei „Keks“ wäre auch „das“ richtig). */
const artikelEindeutig = jeBank((bank: ArtikelItem[]) => bank.filter((i) => !i.alsoArticle));
/** Für „Fehler korrigieren“: ein Satz ohne Bedeutungshinweis, also nur Wörter mit einem Artikel und einer Bedeutung. */
const artikelOhneHinweis = jeBank((bank: ArtikelItem[]) => bank.filter((i) => !i.alsoArticle && !i.meaning));
/** Alle Artikel, die für das Wort richtig sind (der Keks und das Keks). */
const artikelRichtig = (item: ArtikelItem) => [item.article, ...(item.alsoArticle ?? [])];
/** Das Wort, wie es in der Aufgabe steht: bei zwei Bedeutungen mit der gemeinten („Kiefer“ (Nadelbaum)). */
const artikelWort = (item: ArtikelItem) => (item.meaning ? `„${item.word}“ (${item.meaning})` : `„${item.word}“`);
/**
 * Lückentext aus Satzteilen, genau wie ihn der Import (scripts/import-artikel-trainer.ts) gebaut hat:
 * jeder Teil wird getrimmt, zwischen den Teilen steht eine Lücke, und das Leerzeichen vor einem
 * Satzzeichen fällt weg. Die Leerzeichen der Quelle sind bedeutungstragend, deshalb wird nur außen
 * getrimmt.
 */
function clozePrompt(segments: string[]): string {
  return segments.map((s) => s.trim()).join(` ${GAP} `).replace(/ ([.,!?;:])/g, "$1");
}

/** Der falsche Artikel zum Genus; nur für die typischen Fehler, keine Aussage über das Wort. */
const otherArticle = (article: "der" | "die" | "das") => (article === "der" ? "die" : "der");
/** Der typische falsche Artikel eines Worts: nie einer, der auch richtig ist (der Keks und das Keks). */
const falscherArtikel = (item: ArtikelItem) => [otherArticle(item.article), "der", "die", "das"].find((a) => !(artikelRichtig(item) as string[]).includes(a))!;

/** Lückensatz eines Präposition-Eintrags: die Lücke steht für den Artikel vor dem Nomen. */
const praepositionenPrompt = (item: { prefix: string; noun: string; suffix: string }) => clozePrompt([item.prefix, `${item.noun}${item.suffix}`]);

/**
 * Die typischen Fehler eines Präposition-Eintrags, nach dem Fall benannt, in dem der gewählte Artikel
 * steht (bei „die Katze“ ist „die“ Akkusativ statt Dativ). Ein Artikel, der zu keinem Fall des Genus
 * passt (den Katze), ist ein Genusfehler. Der Fehler mit dem anderen Fall steht vorne: ihn nehmen
 * „Fehler finden“ und „Fehler korrigieren“.
 */
function praepositionenFehler(item: PraepositionenItem): { answer: string; label: string }[] {
  const anderer = item.kasus === "Dativ" ? "Akkusativ" : item.kasus === "Akkusativ" ? "Dativ" : null;
  const label = (o: string) => {
    if (anderer && o === artikelForm(item.article, anderer)) return `${anderer} statt ${item.kasus}`;
    const fall = fallVon(item.article, o);
    if (fall) return item.kasus ? `${fall} statt ${item.kasus}` : "Falscher Fall nach der Präposition";
    return `Falsches Genus: ${item.article} ${item.noun}`;
  };
  const rang = (o: string) => (anderer && o === artikelForm(item.article, anderer) ? 0 : fallVon(item.article, o) ? 1 : 2);
  return [...new Set(item.options.filter((o) => o !== item.correct))]
    .sort((a, b) => rang(a) - rang(b))
    .map((answer) => ({ answer, label: label(answer) }));
}

const GENUS_OF_ARTICLE: Record<"der" | "die" | "das", "m" | "f" | "n"> = { der: "m", die: "f", das: "n" };
const GENUS_WORT: Record<"m" | "f" | "n", string> = { m: "maskulin", f: "feminin", n: "neutral" };

/**
 * Artikel bestimmen: „der/die/das“ als Auswahl. Das Genus steht in `data.genus`, damit die Oberfläche
 * den Buchstaben m/f/n zeigen und färben kann (D10); die Optionen werden je Aufgabe gemischt.
 * `given` ist der Eintrag, aus dem die Aufgabe gebaut wird (KI-Einträge, Phase 1 Schritt 6); ohne ihn
 * kommt er wie bisher zufällig aus der Bank.
 */
function artikelTask(rng: Rng, diff: Difficulty, given?: ArtikelItem): TaskDraft {
  const item = given ?? pick(rng, nachStufe("artikel", artikelEindeutig(artikelItems()), diff));
  const options = shuffle(rng, ["der", "die", "das"]);
  const correct = options.indexOf(item.article);
  const genus = GENUS_OF_ARTICLE[item.article];
  return {
    type: "mc",
    skillId: "deutsch.grammatik.artikel",
    difficulty: diff,
    prompt: `Welchen Artikel hat das Nomen ${artikelWort(item)}?`,
    data: { options, genus },
    answer: { correct },
    solution: `${artikelWort(item)} ist ${GENUS_WORT[genus]}: ${item.article} ${item.word}${item.translation ? ` (${item.translation})` : ""}.`,
    hints: ["Sprich das Nomen mit „der“, „die“ und „das“ laut: Welche Form klingt richtig?", "Das Genus steht im Wörterbuch beim Wort."],
    errorMap: options
      .map((option, i) => (i === correct ? null : { answer: String(i), label: `Genus verwechselt (${item.article}↔${option})` }))
      .filter((e): e is { answer: string; label: string } => e !== null),
  };
}

/** Die zweite Zeile jeder Adjektiv-Aufgabe: so weiß das Kind, wie es „keine Endung“ schreibt. */
export const ENDUNGEN_ANLEITUNG = "Schreib nur die Endungen. Braucht ein Wort keine Endung, lass die Lücke leer oder schreib „-“.";

/**
 * Adjektivdeklination: zwei Lücken (Adjektivendung, Nomenendung), exakt geprüft. Die Lücken sind
 * Endungen (`answer.endings`): „en“ und „-en“ zählen gleich, eine leere Lücke heißt keine Endung.
 * `alsoCorrect2` (des Tags und des Tages) ist in der zweiten Lücke auch richtig.
 */
function adjektivdeklinationTask(rng: Rng, diff: Difficulty, given?: AdjektivdeklinationItem): TaskDraft {
  const item = given ?? pick(rng, nachStufe("adjektivdeklination", adjektivdeklinationItems(), diff));
  const richtig2 = [item.correct2, ...(item.alsoCorrect2 ?? [])];
  const falsch1 = item.options1.filter((o) => o !== item.correct1);
  const falsch2 = item.options2.filter((o) => !richtig2.includes(o));
  // eine Endung, die in beiden Lücken falsch ist, bekommt einen Text, der für beide stimmt
  const label = (o: string) => (falsch1.includes(o) && falsch2.includes(o) ? "Falsche Endung" : falsch1.includes(o) ? "Falsche Adjektivendung" : "Falsche Nomenendung");
  return {
    type: "cloze",
    skillId: "deutsch.grammatik.adjektivdeklination",
    difficulty: diff,
    prompt: `${clozePrompt([item.prefix, item.middle, item.suffix])}\n${ENDUNGEN_ANLEITUNG}`,
    data: {},
    answer: { blanks: [[item.correct1], richtig2], mode: "exact", endings: true },
    solution: item.solution,
    hints: ["Die Adjektivendung richtet sich nach Begleiter, Genus, Kasus und Numerus.", "Prüfe danach die Endung des Nomens (z. B. -s, -es oder -e)."],
    errorMap: [...new Set([...falsch1, ...falsch2])].map((answer) => ({ answer, label: label(answer) })),
  };
}

/** Präposition und Kasus: eine Lücke (der Artikel), der typische Fehler ist nach Kasus benannt. */
function praepositionenTask(rng: Rng, diff: Difficulty, given?: PraepositionenItem): TaskDraft {
  const item = given ?? pick(rng, nachStufe("praepositionen", praepositionenItems(), diff));
  return {
    type: "cloze",
    skillId: "deutsch.grammatik.praepositionen",
    difficulty: diff,
    prompt: praepositionenPrompt(item),
    data: {},
    answer: { blanks: [[item.correct]], mode: "exact" },
    solution: item.solution,
    hints: ["Jede Präposition verlangt einen bestimmten Fall.", "Frage mit dem Nomen: Wem? (Dativ) oder Wen/was? (Akkusativ)."],
    errorMap: praepositionenFehler(item),
  };
}

/** Ein Satzteil ohne den Beistrich oder das Satzzeichen an seinem Ende. */
const ohneZeichen = (teil: string) => teil.replace(/\s*[,.!?]+$/, "");

/** Hauptsatz und Gliedsatz erkennen: die beiden Satzteile stehen zur Auswahl, genau einer ist der Gliedsatz. */
function hauptsatzGliedsatzTask(rng: Rng, diff: Difficulty, given?: HauptsatzGliedsatzItem): TaskDraft {
  const item = given ?? pick(rng, nachStufe("hauptsatz-gliedsatz", hauptsatzGliedsatzItems(), diff));
  const gs = item.parts.find((p) => p.type === "GS")!;
  const hs = item.parts.find((p) => p.type === "HS")!;
  const options = shuffle(rng, item.parts.map((p) => p.text));
  const correct = options.indexOf(gs.text);
  return {
    type: "mc",
    skillId: "deutsch.satz.hauptsatz-gliedsatz",
    difficulty: diff,
    prompt: `Welcher Teil ist der Gliedsatz? „${item.parts.map((p) => p.text).join(" ")}“`,
    data: { options },
    answer: { correct },
    // zitiert ohne den Beistrich oder das Satzzeichen am Ende des Teils
    solution: `Der Gliedsatz ist „${ohneZeichen(gs.text)}“. Er kann nicht allein stehen und hängt vom Hauptsatz ab.\nHauptsatz: „${ohneZeichen(hs.text)}“`,
    hints: ["Der Gliedsatz kann nicht allein stehen; oft leitet ihn eine Konjunktion wie weil, dass, wenn oder obwohl ein.", "Im Gliedsatz steht das gebeugte Verb am Ende."],
    errorMap: options
      .map((_, i) => (i === correct ? null : { answer: String(i), label: "Hauptsatz statt Gliedsatz" }))
      .filter((e): e is { answer: string; label: string } => e !== null),
  };
}

/**
 * Dieselbe Aufgabe, aber aus einem vorgegebenen Bankeintrag — für Einträge, die die KI in Bankform
 * geliefert hat (`lib/ai/banken.ts`, Phase 1 Schritt 6). Damit entsteht genau die Aufgabe, die der
 * eingebaute Generator aus demselben Eintrag gebaut hätte; es gibt keine zweite Umsetzung.
 */
export function bankItemTask<K extends BankId>(id: K, item: BankItem<K>, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  switch (id) {
    case "artikel":
      return artikelTask(rng, difficulty, item as ArtikelItem);
    case "adjektivdeklination":
      return adjektivdeklinationTask(rng, difficulty, item as AdjektivdeklinationItem);
    case "praepositionen":
      return praepositionenTask(rng, difficulty, item as PraepositionenItem);
    case "hauptsatz-gliedsatz":
      return hauptsatzGliedsatzTask(rng, difficulty, item as HauptsatzGliedsatzItem);
    case "praeteritum":
      return clozeTaskFrom("deutsch.grammatik.praeteritum", item as BankClozeItem, difficulty, "exact");
    case "perfekt":
      return clozeTaskFrom("deutsch.grammatik.perfekt", item as BankClozeItem, difficulty, "exact");
    case "das-dass":
      return clozeTaskFrom("deutsch.recht.dasdass", item as DasDassItem, difficulty, "text");
    default:
      return null;
  }
}

const NS_ERR = { 1: "Beistrich vor dem Nebensatz vergessen", 2: "Beistrich an falscher Stelle" };
const BEISTRICH_NS: MCItem[] = [
  ["Ich gehe heute früh schlafen, weil ich morgen eine Schularbeit habe.", "Ich gehe heute früh schlafen weil ich morgen eine Schularbeit habe.", "Ich gehe heute früh, schlafen weil ich morgen eine Schularbeit habe.", "weil"],
  ["Der Hund, der im Garten bellt, gehört meinem Nachbarn.", "Der Hund der im Garten bellt gehört meinem Nachbarn.", "Der Hund der im Garten, bellt gehört meinem Nachbarn.", "der (Relativsatz)"],
  ["Wenn es morgen regnet, bleiben wir zu Hause.", "Wenn es morgen regnet bleiben wir zu Hause.", "Wenn es morgen, regnet bleiben wir zu Hause.", "wenn"],
  ["Sie weiß nicht, ob sie zur Party gehen soll.", "Sie weiß nicht ob sie zur Party gehen soll.", "Sie weiß, nicht ob sie zur Party gehen soll.", "ob"],
  ["Ich glaube, dass er Recht hat.", "Ich glaube dass er Recht hat.", "Ich glaube dass, er Recht hat.", "dass"],
  ["Nachdem wir gegessen hatten, gingen wir spazieren.", "Nachdem wir gegessen hatten gingen wir spazieren.", "Nachdem, wir gegessen hatten gingen wir spazieren.", "nachdem"],
  ["Das Buch, das du mir geliehen hast, ist spannend.", "Das Buch das du mir geliehen hast ist spannend.", "Das Buch das du mir, geliehen hast ist spannend.", "das (Relativsatz)"],
  ["Er lernt Vokabeln, obwohl er müde ist.", "Er lernt Vokabeln obwohl er müde ist.", "Er lernt, Vokabeln obwohl er müde ist.", "obwohl"],
].map(([c, w1, w2, word]) => ({
  q: "Welcher Satz ist richtig geschrieben?",
  options: [c, w1, w2],
  correct: 0,
  solution: `Richtig: „${c}“\nDer Nebensatz (eingeleitet mit „${word}“) wird durch Beistrich vom Hauptsatz getrennt. Ein Nebensatz endet mit dem gebeugten Verb.`,
  hint: "Finde das Wort, das den Nebensatz einleitet. Wo endet der Nebensatz?",
  errors: NS_ERR,
})).map((item, i) => reorder(item, i));

const BEISTRICH_AUFZ: MCItem[] = [
  ["Ich kaufe Äpfel, Birnen, Bananen und Kiwis.", "Ich kaufe Äpfel, Birnen, Bananen, und Kiwis.", "Ich kaufe Äpfel Birnen Bananen und Kiwis."],
  ["Wir spielen Fußball, Tennis oder Volleyball.", "Wir spielen Fußball, Tennis, oder Volleyball.", "Wir spielen Fußball Tennis oder Volleyball."],
  ["Lisa, Tom und Ben gehen ins Kino.", "Lisa, Tom, und Ben gehen ins Kino.", "Lisa Tom und Ben gehen ins Kino."],
  ["Er wäscht ab, räumt auf und saugt Staub.", "Er wäscht ab, räumt auf, und saugt Staub.", "Er wäscht ab räumt auf und saugt Staub."],
  ["Im Rucksack sind Hefte, Stifte, ein Lineal und eine Jause.", "Im Rucksack sind Hefte, Stifte, ein Lineal, und eine Jause.", "Im Rucksack sind Hefte Stifte ein Lineal und eine Jause."],
].map(([c, w1, w2], i) =>
  reorder(
    {
      q: "Welcher Satz ist richtig geschrieben?",
      options: [c, w1, w2],
      correct: 0,
      solution: `Richtig: „${c}“\nGleichrangige Aufzählungsglieder werden durch Beistriche getrennt. Vor „und“ bzw. „oder“ steht kein Beistrich.`,
      hint: "Steht vor „und“ / „oder“ in einer Aufzählung ein Beistrich?",
      errors: { 1: "Beistrich vor „und/oder“ gesetzt", 2: "Beistriche in der Aufzählung vergessen" },
    },
    i,
  ),
);

const BEISTRICH_INF: MCItem[] = [
  ["Er hat vergessen, die Hausübung zu machen.", "Er hat vergessen die Hausübung zu machen.", "Er hat, vergessen die Hausübung zu machen.", "Er hat vergessen, die Hausübung zu machen."],
  ["Sie ging nach Hause, ohne sich zu verabschieden.", "Sie ging nach Hause ohne sich zu verabschieden.", "Sie ging, nach Hause ohne sich zu verabschieden.", "ohne … zu"],
  ["Wir fahren in die Stadt, um ein Geschenk zu kaufen.", "Wir fahren in die Stadt um ein Geschenk zu kaufen.", "Wir fahren, in die Stadt um ein Geschenk zu kaufen.", "um … zu"],
  ["Anstatt zu lernen, spielte er Computer.", "Anstatt zu lernen spielte er Computer.", "Anstatt, zu lernen spielte er Computer.", "anstatt … zu"],
].map(([c, w1, w2, word], i) =>
  reorder(
    {
      q: "Welcher Satz ist richtig geschrieben?",
      options: [c, w1, w2],
      correct: 0,
      solution: `Richtig: „${c}“\nInfinitivgruppen mit „um … zu“, „ohne … zu“, „anstatt … zu“ oder mit einem hinweisenden Wort werden mit Beistrich abgetrennt.${word.includes("…") ? ` (${word})` : ""}`,
      hint: "Suche die Wortgruppe mit „zu“ + Grundform.",
      errors: { 1: "Beistrich bei Infinitivgruppe vergessen", 2: "Beistrich an falscher Stelle" },
    },
    i,
  ),
);

/** Moves the correct option to a varying position and remaps error indices. */
function reorder(item: MCItem, seed: number): MCItem {
  const order = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0]][seed % 4];
  const options = order.map((i) => item.options[i]);
  const errors: Record<number, string> = {};
  for (const [k, v] of Object.entries(item.errors ?? {})) errors[order.indexOf(Number(k))] = v;
  return { ...item, options, correct: order.indexOf(item.correct), errors };
}

const FALL_OPTS = ["Nominativ (1. Fall)", "Genitiv (2. Fall)", "Dativ (3. Fall)", "Akkusativ (4. Fall)"];
const FAELLE: MCItem[] = (
  [
    ["Ich gebe [dem Hund] einen Knochen.", 2, "Wem gebe ich etwas? → dem Hund → Dativ"],
    ["Ich gebe dem Hund [einen Knochen].", 3, "Wen oder was gebe ich? → einen Knochen → Akkusativ"],
    ["[Die Lehrerin] erklärt die Aufgabe.", 0, "Wer oder was erklärt? → die Lehrerin → Nominativ"],
    ["Das ist das Fahrrad [meines Bruders].", 1, "Wessen Fahrrad? → meines Bruders → Genitiv"],
    ["Wir helfen [der alten Frau].", 2, "Wem helfen wir? → der alten Frau → Dativ"],
    ["Er besucht [seinen Freund].", 3, "Wen besucht er? → seinen Freund → Akkusativ"],
    ["Wegen [des Regens] fällt das Spiel aus.", 1, "Wessen wegen? → des Regens → Genitiv (nach „wegen“)"],
    ["Mit [meiner Schwester] gehe ich ins Kino.", 2, "Mit wem? → meiner Schwester → Dativ (nach „mit“)"],
  ] as [string, number, string][]
).map(([q, correct, solution]) => ({
  q: `In welchem Fall steht der Ausdruck in eckigen Klammern?\n${q}`,
  options: FALL_OPTS,
  correct,
  solution,
  hint: "Frag nach dem Satzglied: Wer/was? Wessen? Wem? Wen/was?",
  errors: (correct === 2 ? { 3: "Dativ und Akkusativ verwechselt" } : correct === 3 ? { 2: "Dativ und Akkusativ verwechselt" } : {}) as Record<number, string>,
}));

const ZEIT_OPTS = ["Präsens", "Präteritum", "Perfekt", "Plusquamperfekt", "Futur I"];
const ZEITEN: MCItem[] = (
  [
    ["Wir sind gestern ins Kino gegangen.", 2, "sind … gegangen: Hilfsverb im Präsens + Partizip II → Perfekt"],
    ["Er las ein spannendes Buch.", 1, "las: einfache Vergangenheitsform → Präteritum"],
    ["Ich werde morgen früh aufstehen.", 4, "werde … aufstehen: werden + Grundform → Futur I"],
    ["Sie hatte die Hausübung schon erledigt.", 3, "hatte … erledigt: Hilfsverb im Präteritum + Partizip II → Plusquamperfekt"],
    ["Der Zug kommt um acht Uhr an.", 0, "kommt … an: Gegenwartsform → Präsens"],
    ["Wir haben viel gelernt.", 2, "haben … gelernt → Perfekt"],
    ["Nachdem er gegessen hatte, ging er.", 3, "hatte … gegessen → Plusquamperfekt (im Nebensatz)"],
  ] as [string, number, string][]
).map(([q, correct, solution]) => ({
  q: `In welcher Zeitform steht der Satz? „${q}“`,
  options: ZEIT_OPTS,
  correct,
  solution,
  hint: "Achte auf Hilfsverben (haben, sein, werden) und ihre Form.",
  errors: (correct === 2 ? { 1: "Perfekt und Präteritum verwechselt", 3: "Perfekt und Plusquamperfekt verwechselt" } : correct === 1 ? { 2: "Perfekt und Präteritum verwechselt" } : correct === 3 ? { 2: "Perfekt und Plusquamperfekt verwechselt" } : {}) as Record<number, string>,
}));

// DAS_DASS steht nicht mehr hier: die acht Einträge sind mit den 339 importierten in
// data/banks/das-dass.json zusammengeführt (Phase 1), gelesen über lib/banks.ts.

const GROSS: ClozeItem[] = (
  [
    ["Beim ___ habe ich mir den Fuß verletzt. (laufen)", "Laufen", "„beim“ = bei dem → Signalwort für Nominalisierung → groß"],
    ["Wir haben viel ___ erlebt. (schön)", "Schönes", "„viel“ vor Adjektiv → Nominalisierung → groß"],
    ["Er kommt am ___ zu uns. (abend)", "Abend", "Nomen nach „am“ → groß"],
    ["Ich werde heute ___ lernen. (abend)", "abend", "Tageszeit nach „heute“ wird großgeschrieben: heute Abend!"],
    ["Das ___ macht mir Spaß. (lesen)", "Lesen", "Artikel „das“ → Nominalisierung → groß"],
    ["Wir gehen ___ ins Kino. (morgen)", "morgen", "Zeitangabe als Adverb → klein"],
    ["Alles ___ zum Geburtstag! (gute)", "Gute", "„alles“ vor Adjektiv → Nominalisierung → groß"],
  ] as [string, string, string][]
)
  .filter(([, a]) => a !== "abend")
  .map(([q, a, solution]) => ({
    q: `Schreib das Wort in Klammern richtig (groß oder klein): ${q}`,
    blanks: [[a]],
    solution,
    hint: "Achte auf Signalwörter wie das, beim, zum, viel, etwas, alles.",
    errors: { [a[0] === a[0].toUpperCase() ? a.toLowerCase() : a[0].toUpperCase() + a.slice(1)]: "Groß-/Kleinschreibung bei Nominalisierung" },
  }));

const SSS: ClozeItem[] = (
  [
    ["Er wei___ die Antwort.", "ß", "Langer Vokal (ei) → ß"],
    ["Ich mu___ jetzt gehen.", "ss", "Kurzer Vokal (u) → ss"],
    ["Die Stra___e ist nass.", "ß", "Langer Vokal (a) → ß"],
    ["Der Flu___ fließt ins Meer.", "ss", "Kurzer Vokal (u) → ss"],
    ["Wir e___en zu Mittag.", "ss", "Kurzer Vokal (e) → ss"],
    ["Das Gla___ ist voll.", "s", "Gläser → stimmhaftes s → s"],
    ["Sie hat es gewu___t.", "ss", "Kurzer Vokal (u) → ss"],
    ["Der Fu___ tut weh.", "ß", "Langer Vokal (u) → ß"],
  ] as [string, string, string][]
).map(([q, a, solution]) => ({
  q: `Setze s, ss oder ß ein: ${q}`,
  blanks: [[a]],
  solution,
  hint: "Sprich das Wort langsam: Ist der Vokal davor lang oder kurz?",
  errors: (a === "ss" ? { "ß": "ss/ß verwechselt (kurzer Vokal)" } : a === "ß" ? { ss: "ss/ß verwechselt (langer Vokal)" } : { ss: "s/ss verwechselt" }) as Record<string, string>,
}));

// ---------- reading ----------
type Passage = { text: string; questions: { q: string; options: string[]; correct: number; solution: string }[] };
const READING: Record<string, Passage[]> = {
  Deutsch: [
    {
      text:
        "Im Herbst ziehen viele Zugvögel in den Süden. Die Störche aus Österreich fliegen zum Beispiel bis nach Afrika. Dort finden sie im Winter genug Nahrung. Die Reise ist gefährlich: Stürme, Hunger und Stromleitungen sind große Gefahren. Junge Störche fliegen oft zum ersten Mal ohne ihre Eltern. Sie finden den Weg trotzdem, weil sie ihn angeboren kennen. Im Frühling kehren die meisten Störche in ihr altes Nest zurück.",
      questions: [
        { q: "Warum fliegen die Störche nach Afrika?", options: ["Weil es dort im Winter genug Nahrung gibt.", "Weil sie dort ihre Eltern treffen.", "Weil es in Afrika keine Stromleitungen gibt."], correct: 0, solution: "Im Text steht: „Dort finden sie im Winter genug Nahrung.“" },
        { q: "Wie finden junge Störche den Weg?", options: ["Ihre Eltern zeigen ihn ihnen.", "Sie kennen ihn angeboren.", "Sie folgen den Stromleitungen."], correct: 1, solution: "Im Text steht: „… weil sie ihn angeboren kennen.“" },
        { q: "Welche Gefahr wird im Text NICHT genannt?", options: ["Stürme", "Hunger", "Jäger"], correct: 2, solution: "Genannt werden Stürme, Hunger und Stromleitungen – Jäger kommen nicht vor." },
        { q: "Was passiert im Frühling?", options: ["Die Störche bauen in Afrika neue Nester.", "Die meisten Störche kehren in ihr altes Nest zurück.", "Die jungen Störche bleiben in Afrika."], correct: 1, solution: "Letzter Satz: „Im Frühling kehren die meisten Störche in ihr altes Nest zurück.“" },
      ],
    },
  ],
  Englisch: [
    {
      text:
        "Mia is twelve years old and lives in Graz. Every Saturday she goes to the market with her grandfather. He sells apples and pears there. Mia helps him because she likes talking to the customers. Last Saturday it rained all day, so only a few people came. Mia and her grandfather drank hot chocolate and played cards. Mia says it was one of her best days at the market.",
      questions: [
        { q: "What does Mia's grandfather sell?", options: ["Vegetables", "Apples and pears", "Hot chocolate"], correct: 1, solution: "“He sells apples and pears there.”" },
        { q: "Why does Mia help at the market?", options: ["She gets money for it.", "She likes talking to the customers.", "Her parents tell her to."], correct: 1, solution: "“Mia helps him because she likes talking to the customers.”" },
        { q: "What happened last Saturday?", options: ["It rained, so few people came.", "Mia was ill.", "They sold all the apples."], correct: 0, solution: "“Last Saturday it rained all day, so only a few people came.”" },
        { q: "How did Mia feel about last Saturday?", options: ["It was boring.", "It was one of her best days.", "She was angry because of the rain."], correct: 1, solution: "“Mia says it was one of her best days at the market.”" },
      ],
    },
  ],
};

function readingTasks(rng: Rng, subject: string, skillId: string | null, diff: Difficulty, count: number): TaskDraft[] {
  const passages = READING[subject] ?? READING.Deutsch;
  const p = pick(rng, passages);
  return p.questions.slice(0, count).map((qq) => ({
    type: "reading",
    skillId,
    difficulty: diff,
    prompt: qq.q,
    data: { passage: p.text, options: qq.options },
    answer: { correct: qq.correct },
    solution: qq.solution,
    hints: ["Lies die passende Stelle im Text noch einmal genau."],
    errorMap: [],
  }));
}

// ---------- explanations (free text) ----------
// EXPLAIN steht in lib/erklaerungen.ts, damit auch Lehreransichten im Browser es lesen können (lib/loesungsdaten.ts)
export { EXPLAIN };

const FREE_PROMPTS = [
  (n: string) => `Erkläre in eigenen Worten, wie man bei „${n}“ vorgeht, und gib ein eigenes Beispiel an.`,
  (n: string) => `Welcher Fehler passiert bei „${n}“ besonders oft? Beschreibe ihn und erkläre, wie man ihn vermeidet.`,
  (n: string) => `Erfinde eine eigene Aufgabe zu „${n}“ und löse sie Schritt für Schritt.`,
];
/** Deutsch and Englisch: writing own sentences instead of solving a made-up task. */
const LANG_PROMPT = (n: string) => `Schreibe drei eigene Sätze zu „${n}“. Erkläre bei einem Satz, warum er so richtig ist.`;

function freeTask(skillId: string, skillName: string, diff: Difficulty, variant = 0): TaskDraft {
  // a real sample answer or none: never a placeholder like „Eine korrekte Erklärung zu …“
  const sample = EXPLAIN[skillId] ?? EXPLAIN[skillId.split(".").slice(0, 3).join(".")] ?? "";
  const lang = /^(deutsch|englisch)\./.test(skillId);
  const criteria =
    lang && variant % FREE_PROMPTS.length === 2
      ? ["Drei eigene, passende Sätze ohne Fehler an der geübten Stelle.", "Die Erklärung nennt die Regel."]
      : ["Die Regel oder das Vorgehen ist richtig beschrieben.", "Ein eigenes, passendes Beispiel ist dabei."];
  return {
    type: "free",
    skillId,
    difficulty: diff,
    prompt: lang && variant % FREE_PROMPTS.length === 2 ? LANG_PROMPT(skillName) : FREE_PROMPTS[variant % FREE_PROMPTS.length](skillName),
    data: { lines: 5 },
    answer: { ...(sample ? { sample } : {}), criteria },
    solution: sample || `Bewertet wird: ${criteria.join(" ")}`,
    hints: ["Schreib die Schritte der Reihe nach auf.", "Ein eigenes Beispiel zeigt, dass du es verstanden hast."],
    errorMap: [],
  };
}

// ---------- Fehler korrigieren, more gap texts ----------
/** A sentence with an error and its correction, with what the error is. */
/** alsoRight: other right versions of the sentence (a gap with two right answers: du standest, du standst). */
export type FixItem = { wrong: string; right: string; alsoRight?: string[]; label: string; errorType: string };

const ZEITEN_FIX: FixItem[] = [
  ["Gestern gehe ich mit meiner Freundin ins Kino.", "Gestern ging ich mit meiner Freundin ins Kino.", "„gestern“ verlangt eine Vergangenheitsform"],
  ["Letzte Woche haben wir einen Ausflug gemachen.", "Letzte Woche haben wir einen Ausflug gemacht.", "Partizip II von „machen“ ist „gemacht“"],
  ["Morgen fuhr ich zu meiner Oma.", "Morgen fahre ich zu meiner Oma.", "„morgen“ verlangt Präsens oder Futur"],
  ["Als ich nach Hause kam, hat meine Mutter schon gekocht gehabt.", "Als ich nach Hause kam, hatte meine Mutter schon gekocht.", "Vorzeitigkeit in der Vergangenheit: Plusquamperfekt"],
  ["Wir haben gestern ins Schwimmbad gegangen.", "Wir sind gestern ins Schwimmbad gegangen.", "„gehen“ bildet das Perfekt mit „sein“"],
  ["Er ist das Buch schon gelesen.", "Er hat das Buch schon gelesen.", "„lesen“ bildet das Perfekt mit „haben“"],
  ["Nächstes Jahr werde ich in die dritte Klasse gegangen.", "Nächstes Jahr werde ich in die dritte Klasse gehen.", "Futur I: werden + Grundform"],
  ["Früher spielt mein Vater oft Fußball.", "Früher spielte mein Vater oft Fußball.", "„früher“ verlangt eine Vergangenheitsform"],
].map(([wrong, right, label]) => ({ wrong, right, label, errorType: "grammatik" }));

const FAELLE_FIX: FixItem[] = [
  ["Gestern bin ich mit meinen Freund in den Park gegangen.", "Gestern bin ich mit meinem Freund in den Park gegangen.", "Dativ nach „mit“"],
  ["Ich helfe den alten Mann über die Straße.", "Ich helfe dem alten Mann über die Straße.", "„helfen“ verlangt den Dativ"],
  ["Wegen dem Regen fällt das Spiel aus.", "Wegen des Regens fällt das Spiel aus.", "Genitiv nach „wegen“ (geschriebene Standardsprache)"],
  ["Sie gibt ihrem Bruder den Ball und dem Hund einen Knochen und ihren Vater die Zeitung.", "Sie gibt ihrem Bruder den Ball und dem Hund einen Knochen und ihrem Vater die Zeitung.", "Wem gibt sie etwas? → Dativ"],
  ["Ich sehe der Hund im Garten.", "Ich sehe den Hund im Garten.", "Wen sehe ich? → Akkusativ"],
  ["Das ist das Fahrrad von mein Bruder.", "Das ist das Fahrrad von meinem Bruder.", "Dativ nach „von“"],
  ["Er wartet auf seinem Freund.", "Er wartet auf seinen Freund.", "„warten auf“ verlangt den Akkusativ"],
].map(([wrong, right, label]) => ({ wrong, right, label, errorType: "grammatik" }));

// Präteritum und Perfekt stehen nicht mehr hier: ihre Einträge sind in data/banks/praeteritum.json
// bzw. perfekt.json (Phase 1). Die übrigen Zeitformen bleiben in dieser Bank für „Zeitformen erkennen“.
const ZEITEN_CLOZE: ClozeItem[] = (
  [
    ["Morgen ___ es bestimmt ___. (regnen, Futur I)", [["wird"], ["regnen"]], "Futur I: werden + Grundform → es wird regnen"],
    ["Als wir ankamen, ___ der Film schon ___. (beginnen, Plusquamperfekt)", [["hatte"], ["begonnen"]], "Plusquamperfekt: hatte + Partizip II → hatte begonnen"],
    ["Meine Schwester ___ jeden Tag Klavier. (üben, Präsens)", [["übt"]], "Präsens, 3. Person: sie übt"],
  ] as [string, string[][], string][]
).map(([q, blanks, solution]) => ({
  q: `Setze das Verb in der angegebenen Zeitform ein: ${q}`,
  blanks,
  solution,
  hint: "Welche Zeitform steht in der Klammer? Brauchst du ein Hilfsverb (haben, sein, werden)?",
  errors: {},
}));

const FAELLE_CLOZE: ClozeItem[] = (
  [
    ["Ich gehe mit ___ Freund ins Kino. (mein)", [["meinem"]], "mit + Dativ → meinem Freund"],
    ["Wir helfen ___ alten Frau. (die)", [["der"]], "helfen + Dativ → der alten Frau"],
    ["Er wartet auf ___ Bus. (der)", [["den"]], "warten auf + Akkusativ → den Bus"],
    ["Das ist das Auto ___ Vaters. (mein)", [["meines"]], "Wessen Auto? → Genitiv: meines Vaters"],
    ["Sie schenkt ___ Bruder ___ Buch. (ihr, ein)", [["ihrem"], ["ein"]], "Wem? → ihrem Bruder (Dativ); Was? → ein Buch (Akkusativ, sächlich)"],
  ] as [string, string[][], string][]
).map(([q, blanks, solution]) => ({
  q: `Setze das Wort in Klammern im richtigen Fall ein: ${q}`,
  blanks,
  solution,
  hint: "Frag nach dem Satzglied: Wer/was? Wessen? Wem? Wen/was? Achte auf Wörter wie mit, von, auf.",
  errors: {},
}));

/** Gap texts for skills whose own bank is multiple choice. */
/**
 * Artikel als Lückentext: dasselbe Wort, aber ohne Auswahl (für „Lückentext“). Jeder richtige Artikel
 * zählt (der Keks und das Keks), bei zwei Bedeutungen steht die gemeinte dabei (Kiefer (Nadelbaum)).
 */
const artikelLuecken = jeBank((bank: ArtikelItem[]): ClozeItem[] =>
  bank.map((i) => ({
    q: `Setze den richtigen Artikel ein: ${GAP} ${i.word}${i.meaning ? ` (${i.meaning})` : ""}`,
    blanks: [artikelRichtig(i)],
    solution: `${i.article} ${i.word}${i.alsoArticle ? `, auch richtig: ${i.alsoArticle.map((a) => `${a} ${i.word}`).join(", ")}` : ""}`,
    hint: "Sprich das Nomen mit dem Artikel laut.",
    errors: { [falscherArtikel(i)]: `Genus verwechselt (${i.article}↔${falscherArtikel(i)})` },
  })),
);

/** Präpositionen als Lückentext mit dem Kasus-Fehler; dieselbe Lücke und dieselben Fehler wie im Generator. */
const praepositionenLuecken = jeBank((bank: PraepositionenItem[]): ClozeItem[] =>
  bank.map((i) => ({
    q: praepositionenPrompt(i),
    blanks: [[i.correct]],
    solution: i.solution,
    hint: "Jede Präposition verlangt einen bestimmten Fall.",
    errors: Object.fromEntries(praepositionenFehler(i).map((e) => [e.answer, e.label])),
  })),
);

const EXTRA_CLOZE: Record<string, (diff: Difficulty) => ClozeItem[]> = {
  "deutsch.grammatik.zeiten": () => ZEITEN_CLOZE,
  "deutsch.grammatik.faelle": () => FAELLE_CLOZE,
  "deutsch.grammatik.artikel": (diff) => artikelLuecken(nachStufe("artikel", artikelItems(), diff)),
};

/**
 * One error per item, from the banks that hold sentences: a wrong and the right option, or a gap filled
 * wrongly. The banks in data/banks/ give only items that fit the difficulty. A gap with more than one
 * right answer (du standest, du standst) gives every right version of the sentence (`alsoRight`).
 * Exported for lib/banken.test.ts, which checks every sentence.
 */
export function fixItems(skillId: string, diff: Difficulty): FixItem[] {
  const fromMC = (bank: MCItem[], errorType: string) =>
    bank.flatMap((it) =>
      it.options
        .map((o, i) => ({ o, i }))
        .filter(({ i }) => i !== it.correct)
        .slice(0, 1)
        .map(({ o, i }) => ({ wrong: o, right: it.options[it.correct], label: it.errors?.[i] ?? "", errorType })),
    );
  const fromCloze = (bank: ClozeItem[], errorType: string) =>
    bank.flatMap((it) => {
      const sentence = it.q.replace(/^[^:]*:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "");
      const wrong = Object.entries(it.errors ?? {})[0];
      if (it.blanks.length !== 1 || !wrong || !sentence.includes(GAP)) return [];
      const fill = (x: string) => sentence.replace(GAP, x);
      const start = sentence.trimStart().startsWith(GAP);
      // am Satzanfang groß, in der falschen wie in der richtigen Fassung
      const cap = (x: string) => (start ? x.charAt(0).toUpperCase() + x.slice(1) : x);
      const [right, ...also] = it.blanks[0].map((x) => fill(cap(x)));
      return [{ wrong: fill(cap(wrong[0])), right, ...(also.length ? { alsoRight: also } : {}), label: wrong[1], errorType }];
    });
  switch (skillId) {
    case "deutsch.grammatik.zeiten":
      return ZEITEN_FIX;
    case "deutsch.grammatik.faelle":
      return FAELLE_FIX;
    case "deutsch.grammatik.artikel":
      // Nomen mit Artikel, durch Beistriche getrennt (FIX_TRENNER); nur Wörter mit einem Artikel und einer Bedeutung
      return nachStufe("artikel", artikelOhneHinweis(artikelItems()), diff).map((i) => ({
        wrong: `${falscherArtikel(i)} ${i.word}`,
        right: `${i.article} ${i.word}`,
        label: `Genus verwechselt (${i.article}↔${falscherArtikel(i)})`,
        errorType: "grammatik",
      }));
    case "deutsch.grammatik.adjektivdeklination":
      return nachStufe("adjektivdeklination", adjektivdeklinationItems(), diff).flatMap((i) => {
        const wrong = i.options1.find((o) => o !== i.correct1);
        if (!wrong) return [];
        // die Endungen stehen im Satz ohne Bindestrich, „-“ (keine Endung) als nichts
        const build = (ending: string, ending2: string) => `${i.prefix}${endungImSatz(ending)}${i.middle}${endungImSatz(ending2)}${i.suffix}`;
        const also = (i.alsoCorrect2 ?? []).map((e) => build(i.correct1, e));
        return [{ wrong: build(wrong, i.correct2), right: build(i.correct1, i.correct2), ...(also.length ? { alsoRight: also } : {}), label: "Falsche Adjektivendung", errorType: "grammatik" }];
      });
    case "deutsch.grammatik.praepositionen":
      return fromCloze(praepositionenLuecken(nachStufe("praepositionen", praepositionenItems(), diff)), "grammatik");
    case "deutsch.grammatik.praeteritum":
      return fromCloze(nachStufe("praeteritum", praeteritumItems(), diff), "grammatik");
    case "deutsch.grammatik.perfekt":
      return fromCloze(nachStufe("perfekt", perfektItems(), diff), "grammatik");
    case "deutsch.beistrich.aufzaehlung":
      return fromMC(BEISTRICH_AUFZ, "grammatik");
    case "deutsch.beistrich.nebensatz":
      return fromMC(BEISTRICH_NS, "grammatik");
    case "deutsch.beistrich.infinitiv":
      return fromMC(BEISTRICH_INF, "grammatik");
    case "deutsch.recht.dasdass":
      return fromCloze(nachStufe("das-dass", dasDassItems(), diff), "rechtschreibung");
    case "deutsch.recht.gross":
      return fromCloze(GROSS, "rechtschreibung");
    case "deutsch.recht.sss":
      return fromCloze(SSS, "rechtschreibung");
    default:
      return [];
  }
}

const FIX_PROMPT: Record<string, string> = {
  "deutsch.grammatik.zeiten": "Im Text stimmen Zeitformen nicht. Schreib ihn richtig.",
  "deutsch.grammatik.faelle": "Im Text stehen Wörter im falschen Fall. Schreib ihn richtig.",
  "deutsch.grammatik.artikel": "Im Text steht der falsche Artikel. Schreib ihn richtig.",
  "deutsch.grammatik.adjektivdeklination": "Im Text stimmen die Endungen nicht. Schreib ihn richtig.",
  "deutsch.grammatik.praepositionen": "Im Text steht der Artikel im falschen Fall. Schreib ihn richtig.",
  // die Zeitform steht in der Aufgabe: „Du glaubst mir kein Wort.“ ist für sich ein richtiger Satz
  "deutsch.grammatik.praeteritum": "Der Text soll im Präteritum stehen, aber Verbformen stimmen nicht. Schreib ihn richtig.",
  "deutsch.grammatik.perfekt": "Der Text soll im Perfekt stehen, aber Verbformen stimmen nicht. Schreib ihn richtig.",
  "deutsch.beistrich.aufzaehlung": "Im Text stimmen Beistriche nicht. Schreib ihn richtig.",
  "deutsch.beistrich.nebensatz": "Im Text stimmen Beistriche nicht. Schreib ihn richtig.",
  "deutsch.beistrich.infinitiv": "Im Text stimmen Beistriche nicht. Schreib ihn richtig.",
  "deutsch.recht.dasdass": "Im Text ist „das“ und „dass“ verwechselt. Schreib ihn richtig.",
  "deutsch.recht.gross": "Im Text stimmt die Groß- und Kleinschreibung nicht. Schreib ihn richtig.",
  "deutsch.recht.sss": "Im Text stimmt die Schreibung von s, ss oder ß nicht. Schreib ihn richtig.",
};

/** Wie die Sätze im Fehlertext getrennt stehen; Artikel und Nomen sind keine Sätze, sie stehen als Liste. */
const FIX_TRENNER: Record<string, string> = { "deutsch.grammatik.artikel": ", " };

/**
 * "Fehler korrigieren" without AI: one to three sentences of a bank, each with one error. Harder tasks
 * get more sentences, so the student has to find the errors in a short paragraph.
 */
export function correctionTask(skillId: string, diff: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  // Englisch: Sätze aus den Satzmustern, je Satz ein typischer Fehler (lib/englisch-grammatik.ts)
  if (istEnglischGrammatik(skillId)) return englischAufgabe(skillId, "fix", diff, rng);
  if (istDeutschSatzlehre(skillId)) return deutschAufgabe(skillId, "fix", diff, rng);
  const items = fixItems(skillId, diff);
  if (!items.length) return null;
  const n = Math.min(items.length, LEVEL[diff] >= 3 ? 3 : LEVEL[diff] >= 2 ? 2 : 1);
  const chosen = shuffle(rng, items).slice(0, n);
  const trenner = FIX_TRENNER[skillId] ?? " ";
  const faulty = chosen.map((c) => c.wrong).join(trenner);
  const corrected = chosen.map((c) => c.right).join(trenner);
  // jede richtige Fassung des Texts: bei Sätzen mit zwei richtigen Formen alle Verbindungen
  const versions = chosen.reduce<string[]>((acc, c) => acc.flatMap((a) => [c.right, ...(c.alsoRight ?? [])].map((r) => (a ? `${a}${trenner}${r}` : r))), [""]);
  return {
    type: "fix",
    skillId,
    category: "korrigieren",
    difficulty: diff,
    prompt: FIX_PROMPT[skillId] ?? "Im Text sind Fehler. Schreib ihn richtig.",
    data: { faulty },
    answer: {
      accepted: [corrected, ...versions.filter((v) => v !== corrected)],
      mode: "exact",
      // the words that differ, so the label can be found again for the student's answer
      fixes: chosen.flatMap((c) => expectedFixes(c.wrong, c.right).map((f) => ({ ...f, label: c.label, errorType: c.errorType }))),
      criteria: [n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, "Richtiges wurde nicht verändert."],
    },
    solution: chosen.map((c) => `${c.right}\n→ ${c.label}`).join("\n"),
    hints: [
      trenner === " " ? "Lies Satz für Satz langsam. Wo klingt etwas falsch?" : "Sprich jedes Nomen mit seinem Artikel laut. Wo klingt etwas falsch?",
      n === 1 ? "Es ist genau ein Fehler." : `Es sind ${n} Fehler, ${trenner === " " ? "in jedem Satz einer" : "bei jedem Nomen einer"}.`,
    ],
    errorMap: [],
  };
}

/** A gap text for a skill: its own bank if it has gaps, otherwise an extra bank (Zeitformen, Fälle). */
export function clozeTask(skillId: string, diff: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const bank = EXTRA_CLOZE[skillId];
  if (!bank) return null;
  return { ...bankCloze(skillId, () => bank(diff), "exact")(rng, diff), category: "lueckentext" };
}

// ---------- conversions ----------
/** Multiple Choice aus einer Rechnung: das Ergebnis und bis zu `falsche` falsche Antworten (typische Fehler zuerst). */
function toMC(rng: Rng, t: TaskDraft, falsche = 3): TaskDraft {
  if (t.data.options) return t;
  const correct = t.answer.accepted?.[0];
  if (!correct) return t;
  const distractors = t.errorMap.map((e) => e.answer).filter((a, i, arr) => a !== correct && arr.indexOf(a) === i);
  const n = Number(correct.replace(",", "."));
  if (t.answer.mode === "value" && Number.isFinite(n)) {
    // extra numbers written like the right answer (9,50 next to 10,50, never 10.5)
    const decimals = (correct.split(/[.,]/)[1] ?? "").length;
    const write = (d: number) => (decimals ? d.toFixed(decimals) : String(Math.round(d * 1e4) / 1e4)).replace(".", ",");
    const taken = (s: string) => [correct, ...distractors].some((x) => parseNumber(x) === parseNumber(s));
    for (const d of [n + 1, n - 1, n * 2, n + 10]) if (distractors.length < falsche && !taken(write(d))) distractors.push(write(d));
  }
  if (distractors.length < 1) return t;
  const options = shuffle(rng, [correct, ...distractors.slice(0, falsche)]);
  const errorMap = t.errorMap
    .map((e) => ({ answer: String(options.indexOf(e.answer)), label: e.label }))
    .filter((e) => e.answer !== "-1");
  // shown with a decimal comma and a real minus sign
  const show = (o: string) => o.replace(/(\d)\.(\d)/g, "$1,$2").replace(/^-(?=\d)/, "−");
  return { ...t, type: "mc", data: { ...mitBild(t), options: options.map(show) }, answer: { correct: options.indexOf(correct) }, errorMap };
}

/**
 * Matura „1 aus 5“ aus einer Rechnung einer Fähigkeit ohne eigene Matura-Aufgaben: das Ergebnis und vier falsche
 * Antworten. null, wenn es keine vier verschiedenen gibt (dann bleibt es eine Rechnung, der Builder sagt es).
 */
function toEinAusFuenf(rng: Rng, t: TaskDraft): TaskDraft | null {
  if (t.data.options) return null;
  const mc = toMC(rng, t, 4);
  const task: TaskDraft = { ...mc, category: "matura-1aus5" };
  return mc.data.options?.length === 5 && !pruefeMatura(task) ? task : null;
}

/** Das Bild einer Aufgabe mit Bild (lib/figur.ts) bleibt bei jeder Umwandlung dabei. */
function mitBild(t: TaskDraft): Pick<TaskDraft["data"], "figure"> {
  return t.data.figure ? { figure: t.data.figure } : {};
}

function toCloze(t: TaskDraft): TaskDraft {
  if (t.answer.blanks || !t.answer.accepted) return t;
  return {
    ...t,
    type: "cloze",
    prompt: `${t.prompt}\nErgebnis: ${GAP}`,
    answer: { blanks: [t.answer.accepted], mode: t.answer.mode },
    errorMap: t.errorMap,
  };
}

/** "Fehler finden": a worked answer with a typical mistake; the student gives the right result. */
function toFindError(rng: Rng, t: TaskDraft): TaskDraft | null {
  const wrong = t.errorMap.find((e) => !/^\d+$/.test(e.answer) || t.answer.mode === "value");
  if (!wrong || !t.answer.accepted) return null;
  const name = pick(rng, ["Lena", "Jonas", "Emma", "Paul", "Mia", "Elias"]);
  return {
    ...t,
    type: t.type === "grammar" ? "grammar" : "calc",
    category: "fehler",
    prompt: `${t.prompt}\n${name} hat als Ergebnis ${wrong.answer.replace(/^-(?=\d)/, "−")} herausbekommen. Das stimmt nicht. Finde den Fehler und gib das richtige Ergebnis an.`,
    hints: ["Rechne die Aufgabe selbst Schritt für Schritt und vergleiche.", `Typischer Fehler an dieser Stelle: ${wrong.label}.`, ...t.hints.slice(0, 1)],
    errorMap: [{ answer: wrong.answer, label: `Fehler übernommen: ${wrong.label}` }, ...t.errorMap.filter((e) => e !== wrong)],
  };
}

/** "Lösungsweg ordnen": the steps of the worked solution, shuffled. Needs at least three steps. */
function toOrder(rng: Rng, t: TaskDraft): TaskDraft | null {
  const steps = t.solution
    .split("\n")
    .flatMap((line) => {
      // a chain "a : b = c = d" becomes one step per "="; lines listing several results stay whole
      const parts = line.includes(",") ? [line] : line.split(/\s=\s/);
      if (parts.length <= 2) return [line];
      const first = parts[0].replace(/^[^\d=:]*[A-Za-zÄÖÜäöüß][^\d=:]*:\s+/, "");
      // "W = G · p / 100 = …": a bare variable belongs to the formula
      if (/^[A-Za-z]{1,2}$/.test(first.trim())) return [`${first} = ${parts[1]}`, ...parts.slice(2).map((x) => `= ${x}`)];
      return [first, ...parts.slice(1).map((x) => `= ${x}`)];
    })
    .map((x) => x.trim())
    .filter((x, i, arr) => x && arr.indexOf(x) === i);
  if (steps.length < 3) return null;
  let shown = shuffle(rng, [...steps]);
  for (let i = 0; i < 5 && shown.every((x, j) => x === steps[j]); i++) shown = shuffle(rng, [...steps]);
  return {
    ...t,
    type: "order",
    category: "ordnen",
    prompt: `Bring die Schritte des Lösungswegs in die richtige Reihenfolge.\n${t.prompt}`,
    data: { ...mitBild(t), steps: shown },
    answer: { steps },
    hints: ["Womit beginnt man bei dieser Aufgabe?", "Der letzte Schritt ist das Ergebnis."],
    errorMap: [],
  };
}

export type Slot = {
  skillId: string;
  skillName: string;
  generatorSkillId?: string;
  difficulty: Difficulty;
  category: string | null;
  subject: string;
  /** Wortarten skills: the Wortarten the tasks may ask for (lib/wortarten.ts wortartenFor). */
  wortarten?: WortartSetting | null;
  /** Schulstufe 1–13, for the Grundeinstellung of the Wortarten when no setting is given. */
  grade?: number;
};

/**
 * Ein Matura-Format für eine Fähigkeit ohne eigene Matura-Aufgaben (lib/mathe-matura.ts): 1 aus 5 entsteht aus
 * der Rechnung; 2 aus 5, Lückentext zum Ankreuzen und Zuordnung brauchen eigene Aussagen, dann bleibt es die
 * Rechnung mit ihrer echten Kategorie, und der Builder zählt den Typ als fehlend (typFehlt).
 */
function maturaAusRechnung(rng: Rng, base: TaskDraft, category: string, tag: (t: TaskDraft, category?: string | null) => TaskDraft): TaskDraft {
  const fuenf = category === "matura-1aus5" ? toEinAusFuenf(rng, base) : null;
  return fuenf ? tag(fuenf, "matura-1aus5") : tag(base, base.type === "mc" ? "mc" : "rechnung");
}

/** Eine Aufgabe mit Bild als Rechnung; wo es keine gibt (Intervalle), als Multiple Choice. */
const figurBasis = (figId: string, diff: Difficulty, rng: Rng) => figurAufgabe(figId, diff, "calc", rng) ?? figurAufgabe(figId, diff, "mc", rng);

/**
 * Ein Platz im Builder für eine Fähigkeit mit Aufgaben mit Bild: Multiple Choice und Lückentext haben eigene
 * Fragen zum Bild, die anderen Aufgabentypen entstehen wie bei den anderen Generatoren aus der Rechnung.
 */
function figurFuerSlot(figId: string, slot: Slot, rng: Rng, tag: (t: TaskDraft, category?: string | null) => TaskDraft): TaskDraft {
  const basis = figurBasis(figId, slot.difficulty, rng)!;
  switch (slot.category) {
    case "mc":
      return tag(figurAufgabe(figId, slot.difficulty, "mc", rng) ?? toMC(rng, basis));
    case "lueckentext":
    case "gap":
      return tag(figurAufgabe(figId, slot.difficulty, "cloze", rng) ?? toCloze(basis));
    case "fehler":
      return tag(toFindError(rng, basis) ?? basis, "fehler");
    case "ordnen": {
      const ordered = toOrder(rng, basis);
      return ordered ? tag(ordered, "ordnen") : tag(basis, "rechnung");
    }
    case "textaufgabe":
      return tag(basis, "rechnung");
    case "matura-1aus5":
    case "matura-2aus5":
    case "matura-lueckentext":
    case "matura-zuordnung":
      return maturaAusRechnung(rng, basis, slot.category, tag);
    default:
      // „Direkte Rechnung“ erlaubt Rechnung und Multiple Choice (Intervalle gibt es nur so)
      return tag(basis);
  }
}

/**
 * One task for one slot of the builder: skill, difficulty and task type. Sub-skills without a
 * generator of their own use the generator of their parent (generatorSkillId). Returns an
 * explanation task when nothing fits, so the builder always gets the number it asked for.
 */
export function generateForSlot(slot: Slot, rng: Rng = Math.random, variant = 0): TaskDraft {
  // Ein Englisch-Matura-Format bei einer Fähigkeit ohne Matura-Texte: Leseverstehen bei Reading, sonst ehrlich als Lückentext
  const lesen = slot.skillId.endsWith("reading.comprehension");
  if (istEnglischMatura(slot.category) && !istEnglischMaturaSkill(slot.skillId) && !istEnglischMaturaSkill(slot.generatorSkillId))
    slot = { ...slot, category: ENGLISCH_TEIL[slot.category] === "reading" && lesen ? "reading" : "gap" };
  // Wortarten: real determination tasks with the chosen Wortarten (an explanation only for „Freie Antwort“)
  if (isWortartenSkill(slot.skillId)) {
    const setting = slot.wortarten ?? wortartenFor([slot.skillId], slot.grade ?? 5)!;
    return wortartenTask({ skillId: slot.skillId, setting, difficulty: slot.difficulty, category: slot.category, variant }, rng);
  }
  // Vokabeln: aus den Themenlisten (lib/vokabeln-themen.ts); null bei „Freie Antwort“
  const vokabel = vokabelFuerSlot(slot, rng);
  if (vokabel) return vokabel;
  const genId = GEN[slot.skillId] ? slot.skillId : slot.generatorSkillId && GEN[slot.generatorSkillId] ? slot.generatorSkillId : null;
  // Aufgaben mit Bild (Zahlenstrahl, Koordinatensystem, Figur): lib/generators-figur.ts
  const figId = figurFaehigkeit(slot.skillId) ?? figurFaehigkeit(slot.generatorSkillId);
  const tag = (t: TaskDraft, category: string | null = slot.category): TaskDraft => ({
    ...t,
    skillId: slot.skillId,
    skillIds: [...new Set([slot.skillId, ...[genId, figId].filter((x): x is string => Boolean(x) && x !== slot.skillId)])],
    category,
    difficulty: slot.difficulty,
  });
  const free = () => tag(freeTask(slot.skillId, slot.skillName, slot.difficulty, variant), slot.category && ["offen", "schreiben", "writing"].includes(slot.category) ? slot.category : "offen");
  const reading = slot.skillId.endsWith("reading.comprehension") || slot.skillId === "deutsch.text.verstehen" || slot.category === "textverstaendnis" || slot.category === "reading";
  if (reading && (slot.skillId.endsWith("reading.comprehension") || slot.skillId === "deutsch.text.verstehen")) {
    const t = readingTasks(rng, slot.subject, slot.skillId, slot.difficulty, variant + 1)[variant] ?? readingTasks(rng, slot.subject, slot.skillId, slot.difficulty, 1)[0];
    return tag(t, slot.category ?? "textverstaendnis");
  }
  // Fehler korrigieren: from the sentence banks; skills without one get a free answer, never another format
  if (slot.category === "korrigieren") {
    const fix = correctionTask(slot.skillId, slot.difficulty, rng) ?? (genId ? correctionTask(genId, slot.difficulty, rng) : null);
    return fix ? tag(fix, "korrigieren") : free();
  }
  // Rechenweg and Sachaufgabe: own maths generators (lib/generators-mathe.ts); skills without one get a free answer
  if (slot.category === "rechenweg" || slot.category === "sachaufgabe") {
    const make = slot.category === "rechenweg" ? rechenwegTask : sachaufgabeTask;
    const bild = figId ? figurAufgabe(figId, slot.difficulty, slot.category, rng) : null;
    const t = bild ?? make(slot.skillId, slot.difficulty, rng) ?? (genId ? make(genId, slot.difficulty, rng) : null);
    return t ? tag(t, slot.category) : free();
  }
  if (figId && !["offen", "schreiben", "writing"].includes(slot.category ?? "")) return figurFuerSlot(figId, slot, rng, tag);
  // Englisch-Matura: ein Text mit mehreren Items im Format der Fähigkeit oder im gewählten, wenn es zum selben Teil gehört
  // (lib/englisch-matura.ts); eine freie Antwort nur bei Reading und Language in Use, beim Writing ist sie der Schreibauftrag
  if (genId && istEnglischMaturaSkill(genId) && !(slot.category === "offen" && !genId.startsWith("englisch.os.writing."))) {
    const { task, category } = englischMaturaFuerKategorie(genId, slot.category, slot.difficulty, rng);
    return tag(task, category);
  }
  if (!genId || ["offen", "schreiben", "writing"].includes(slot.category ?? "")) return free();
  // Mathematik-Matura: die vier Antwortformate aus eigenen Aussagen; andere Typen als 1 aus 5 (der Builder sagt es)
  if (istMatheMatura(genId)) {
    const { task, category } = matheMaturaFuerKategorie(genId, slot.category, slot.difficulty, rng);
    return tag(task, category);
  }
  // Englisch: jeder Aufgabentyp aus den Satzmustern; einen, den die Fähigkeit nicht hat, als Lückentext (der Builder sagt es)
  if (istEnglischGrammatik(genId)) {
    const { task, category } = englischFuerKategorie(genId, slot.category, slot.difficulty, rng);
    return tag(task, category);
  }
  if (istDeutschSatzlehre(genId)) {
    const { task, category } = deutschFuerKategorie(genId, slot.category, slot.difficulty, rng);
    return tag(task, category);
  }
  const base = GEN[genId](rng, slot.difficulty);
  switch (slot.category) {
    case "mc":
      return tag(toMC(rng, base));
    case "lueckentext":
    case "gap": {
      // a gap text stays a gap text: a choice question becomes one only through a bank of gap texts
      const cloze = toCloze(base);
      if (cloze.type === "cloze") return tag(cloze);
      const extra = clozeTask(slot.skillId, slot.difficulty, rng) ?? clozeTask(genId, slot.difficulty, rng);
      return extra ? tag(extra) : free();
    }
    case "fehler":
      return tag(toFindError(rng, base) ?? base, "fehler");
    case "ordnen": {
      const ordered = toOrder(rng, base);
      return ordered ? tag(ordered, "ordnen") : tag(base, "rechnung");
    }
    case "textaufgabe": {
      // a short word problem with school-book numbers (lib/textaufgaben.ts); skills without stories keep the calculation
      const story = textaufgabeTask(slot.skillId, slot.difficulty, rng) ?? textaufgabeTask(genId, slot.difficulty, rng);
      return story ? tag(story, "textaufgabe") : tag(base, "rechnung");
    }
    default:
      if (istMaturaKategorie(slot.category)) return maturaAusRechnung(rng, base, slot.category, tag);
      return tag(base);
  }
}

export type GenerateRequest = {
  subject: string;
  skills: { id: string; name: string }[];
  difficulty: Difficulty;
  count: number;
  taskType: TaskType | "mixed";
  seed?: number;
  /** Schulstufe 1–13 (Wortarten: which Wortarten fit). */
  grade?: number;
  /** Wortarten skills: the chosen Wortarten; default from the skills and the grade. */
  wortarten?: WortartSetting | null;
};

/** The task type of the builder that matches an answer format, for the Wortarten tasks. */
const WORTART_CATEGORY: Partial<Record<TaskType | "mixed", string>> = { mc: "mc", cloze: "lueckentext", free: "offen", fix: "korrigieren" };

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hasBuiltInGenerator(skillId: string): boolean {
  // Teilfähigkeiten (ids "parent.suffix") use the generator of their skill
  const parent = skillId.split(".").slice(0, 3).join(".");
  if (parent !== skillId && hasBuiltInGenerator(parent)) return true;
  return skillId in GEN || figurFaehigkeit(skillId) !== null || skillId.endsWith("reading.comprehension") || skillId === "deutsch.text.verstehen" || isWortartenSkill(skillId);
}

/** Eine Aufgabe mit Bild im Aufgabentyp der Anfrage (gemischt: Rechnung, Multiple Choice oder Lückentext). */
function figurFuerTyp(figId: string, req: GenerateRequest, rng: Rng): TaskDraft {
  const type = req.taskType === "mixed" ? pick(rng, ["calc", "mc", "cloze"] as const) : req.taskType;
  const basis = () => figurBasis(figId, req.difficulty, rng)!;
  if (type === "mc" || type === "cloze" || type === "rechenweg" || type === "sachaufgabe") return figurAufgabe(figId, req.difficulty, type as FigurFormat, rng) ?? basis();
  if (type === "order") return toOrder(rng, basis()) ?? basis();
  return basis();
}

/** Generates tasks without AI. Skills without a generator get explanation tasks. */
export function generateBuiltIn(req: GenerateRequest): TaskDraft[] {
  const rng = req.seed !== undefined ? mulberry32(req.seed) : Math.random;
  const out: TaskDraft[] = [];
  const seen = new Set<string>();
  const readingSkill = req.skills.find((s) => s.id.endsWith("reading.comprehension") || s.id === "deutsch.text.verstehen");
  if (req.taskType === "reading" || (readingSkill && req.skills.length === 1)) {
    return readingTasks(rng, req.subject, readingSkill?.id ?? req.skills[0]?.id ?? null, req.difficulty, req.count);
  }
  const skills = req.skills.filter((s) => !(s.id.endsWith("reading.comprehension") || s.id === "deutsch.text.verstehen"));
  // Je Fähigkeit: Aufgaben auf dem Blatt, Versuche, Doppelte hintereinander, keine neue Aufgabe mehr (freie Aufgaben aufgebraucht)
  const anzahl = skills.map(() => 0);
  const versuche = skills.map(() => 0);
  const doppelt = skills.map(() => 0);
  const aus = skills.map(() => false);
  // Dran ist die Fähigkeit mit den wenigsten Aufgaben (bei Gleichstand die erste), damit sie gleich verteilt sind;
  // eine, die nur noch Doppelte liefert, erst wieder, wenn keine andere mehr geht
  const naechste = (): number => {
    const offen = skills.map((_, k) => k).filter((k) => !aus[k]);
    const frisch = offen.filter((k) => doppelt[k] < 20);
    const wahl = frisch.length > 0 ? frisch : offen;
    return wahl.reduce((a, b) => (anzahl[b] < anzahl[a] ? b : a), wahl[0] ?? -1);
  };
  let guard = 0;
  while (out.length < req.count && guard++ < req.count * 20) {
    const k = naechste();
    if (k < 0) break;
    const skill = skills[k];
    const runde = versuche[k]++;
    let t: TaskDraft;
    const figId = figurFaehigkeit(skill.id);
    // Rechenweg und Sachaufgabe: zuerst mit Bild (wenn es das für die Fähigkeit gibt), sonst lib/generators-mathe.ts
    const fuerSkill = (f: TaskDraft | null): TaskDraft | null => (f ? { ...f, skillId: skill.id, skillIds: [...new Set([skill.id, ...(f.skillIds ?? [])])] } : null);
    const maths =
      req.taskType === "rechenweg"
        ? (fuerSkill(figId ? figurAufgabe(figId, req.difficulty, "rechenweg", rng) : null) ?? rechenwegTask(skill.id, req.difficulty, rng))
        : req.taskType === "sachaufgabe"
          ? (fuerSkill(figId ? figurAufgabe(figId, req.difficulty, "sachaufgabe", rng) : null) ?? sachaufgabeTask(skill.id, req.difficulty, rng))
          : null;
    if (isWortartenSkill(skill.id)) {
      const setting = req.wortarten ?? wortartenFor(req.skills.map((s) => s.id), req.grade ?? 5)!;
      t = wortartenTask({ skillId: skill.id, setting, difficulty: req.difficulty, category: WORTART_CATEGORY[req.taskType] ?? null, variant: runde + guard }, rng);
    } else if (maths) {
      t = maths;
    } else if (figId && req.taskType !== "free") {
      // Aufgaben mit Bild: die Fähigkeit der Aufgabe ist die gewählte (auch eine Teilfähigkeit)
      t = fuerSkill(figurFuerTyp(figId, req, rng))!;
    } else if (req.taskType === "free" || req.taskType === "rechenweg" || req.taskType === "sachaufgabe" || !GEN[skill.id]) {
      t = freeTask(skill.id, skill.name, req.difficulty, runde);
      if (seen.has(t.prompt.split("\n")[0])) {
        aus[k] = true;
        continue;
      }
    } else if (istVokabelThema(skill.id)) {
      t = vokabelFuerTyp(skill.id, req.taskType, req.difficulty, rng);
    } else if (istEnglischGrammatik(skill.id)) {
      t = englischFuerTyp(skill.id, req.taskType, req.difficulty, rng);
    } else if (istDeutschSatzlehre(skill.id)) {
      t = deutschFuerTyp(skill.id, req.taskType, req.difficulty, rng);
    } else if (istMatheMatura(skill.id)) {
      t = matheMaturaFuerTyp(skill.id, req.taskType, req.difficulty, rng);
    } else if (istEnglischMaturaSkill(skill.id)) {
      t = englischMaturaFuerTyp(skill.id, req.taskType, req.difficulty, rng);
    } else {
      t = GEN[skill.id](rng, req.difficulty);
      const type = req.taskType === "mixed" ? pick(rng, ["calc", "mc", "cloze"] as const) : req.taskType;
      if (type === "mc") t = toMC(rng, t);
      else if (type === "cloze") t = toCloze(t);
      else if (type === "grammar" && t.type === "calc") t = { ...t, type: "grammar" };
    }
    // Aufgaben mit Bild unterscheiden sich im Bild, englische im Satz (zweite Zeile), nicht in der ersten Zeile
    const key = t.data.figure || istEnglischGrammatik(skill.id) || istDeutschSatzlehre(skill.id) || istVokabelThema(skill.id) || istMatheMatura(skill.id) || istEnglischMaturaSkill(skill.id) ? aufgabenSchluessel(t) : t.prompt.split("\n")[0];
    if (seen.has(key) && guard < req.count * 15) {
      doppelt[k]++;
      continue;
    }
    seen.add(key);
    out.push(t);
    anzahl[k]++;
    doppelt[k] = 0;
  }
  return out;
}
