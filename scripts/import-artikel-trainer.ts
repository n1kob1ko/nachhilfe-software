/**
 * One-shot import of the Artikel Trainer banks (Flask JSON) into `data/banks/*.json`.
 *
 * The script stays in the repository after the import so that the committed banks can be
 * reproduced: same source, same output, byte for byte. It never writes into the source repo.
 *
 *   tsx scripts/import-artikel-trainer.ts <Pfad zu .../Artikel Trainer/categories> [--kasus-ki]
 *
 * What it reads (all of it German exercise data, no personal data):
 *   articles/*.json             → data/banks/artikel.json
 *   adjectiv_declension/*.json  → data/banks/adjektivdeklination.json
 *   prepositions/*.json         → data/banks/praepositionen.json
 *   past_tense/*.json           → data/banks/praeteritum.json
 *   past_perfect_tense/*.json   → data/banks/perfekt.json      (enthält Perfekt, nicht Plusquamperfekt)
 *   das_dass/*.json             → data/banks/das-dass.json
 *   satzbau/*.json              → data/banks/hauptsatz-gliedsatz.json
 * `memorize/` is deliberately not read: it holds personal learning texts (Entscheidung D4).
 *
 * Inline banks that lived in `lib/generators.ts` until Phase 1 (the eight DAS_DASS items and the
 * Präteritum/Perfekt items of ZEITEN_CLOZE) are merged in here, so a re-run still produces the
 * merged file and the moved items are not lost.
 *
 * `kasus` for the prepositions is derived, not guessed; see KASUS below. `--kasus-ki` asks the KI
 * for the cases that could not be decided that way and needs a configured provider.
 */
import fs from "node:fs";
import path from "node:path";
import { parseBank, type BankId } from "../lib/banks";

/** Gap marker of the app (`lib/tasks.ts` GAP); the source writes the same three underscores. */
const GAP = "___";

const BANK_FILES: Record<BankId, string> = {
  artikel: "artikel.json",
  adjektivdeklination: "adjektivdeklination.json",
  praepositionen: "praepositionen.json",
  praeteritum: "praeteritum.json",
  perfekt: "perfekt.json",
  "das-dass": "das-dass.json",
  "hauptsatz-gliedsatz": "hauptsatz-gliedsatz.json",
};

const OUT_DIR = path.join(process.cwd(), "data", "banks");

// ---------- helpers ----------
/** Locale-independent order, so the output does not depend on the machine's locale. */
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortStrings = (xs: readonly string[]) => [...xs].sort(byKey);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/**
 * Satzteile (prefix/middle/suffix) werden **wörtlich** übernommen: die Quelle setzt die Leerzeichen
 * bedeutungstragend (Präpositionen und Präteritum: „Ich “ endet mit Leerzeichen, der Suffix beginnt
 * ohne; Adjektivdeklination umgekehrt: der Prefix endet ohne, `middle` beginnt mit Leerzeichen).
 * Deshalb wird hier nicht getrimmt — sonst ließe sich der Satz nicht mehr zusammensetzen.
 */
const text = (v: unknown) => (typeof v === "string" ? v : "");
/** Lückentext aus Satzteilen: eine Lücke zwischen den Teilen, Leerzeichen vor Satzzeichen entfernt. */
const clozePrompt = (segments: string[]) => segments.map((s) => s.trim()).join(` ${GAP} `).replace(/ ([.,!?;:])/g, "$1");
const strArray = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()) : []);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const dateien = (n: number) => `${n} Datei${n === 1 ? "" : "en"}`;

/** Rows the script could not use, listed at the end of the report. */
let problems: string[] = [];
const note = (s: string) => problems.push(s);
const short = (v: unknown) => JSON.stringify(v).slice(0, 140);

type Read = { kind: "ok"; rows: unknown[] } | { kind: "empty"; error: string } | { kind: "error"; error: string };

function readJsonList(file: string): Read {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    return { kind: "error", error: `nicht lesbar (${e instanceof Error ? e.message : String(e)})` };
  }
  if (!raw.trim()) return { kind: "empty", error: "0 Byte, leer" };
  try {
    const data: unknown = JSON.parse(raw);
    if (Array.isArray(data)) return { kind: "ok", rows: data };
    const sentences = (data as { sentences?: unknown } | null)?.sentences;
    if (Array.isArray(sentences)) return { kind: "ok", rows: sentences };
    return { kind: "error", error: "kein Array (und kein Objekt mit dem Schlüssel „sentences“)" };
  } catch (e) {
    return { kind: "error", error: `kein gültiges JSON (${e instanceof Error ? e.message : String(e)})` };
  }
}

/** Every *.json of a category folder, in a fixed order. */
function sourceFiles(root: string, dir: string, label: string): string[] {
  const full = path.join(root, dir);
  let entries: string[];
  try {
    entries = fs.readdirSync(full);
  } catch {
    note(`${label}: Ordner fehlt (${full})`);
    return [];
  }
  return sortStrings(entries.filter((e) => e.endsWith(".json"))).map((e) => path.join(full, e));
}

/** Reads one source folder and hands back the usable rows; empty and unreadable files are reported. */
function readFolder(root: string, dir: string, label: string): { rows: { row: Record<string, unknown>; file: string }[]; files: number; skipped: string[] } {
  const files = sourceFiles(root, dir, label);
  const rows: { row: Record<string, unknown>; file: string }[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const name = path.basename(file, ".json");
    const read = readJsonList(file);
    if (read.kind !== "ok") {
      skipped.push(`${name}.json (${read.error})`);
      if (read.kind === "error") note(`${label}/${name}.json: ${read.error}`);
      continue;
    }
    for (const row of read.rows) rows.push({ row: row as Record<string, unknown>, file: name });
  }
  return { rows, files: files.length, skipped };
}

function writeBank<T>(id: BankId, items: T[], report: string[]): T[] {
  const text = `${JSON.stringify(items, null, 2)}\n`;
  const parsed = parseBank(id, text);
  if (!parsed.ok) {
    console.error(`\nFEHLER: data/banks/${BANK_FILES[id]} würde das Schema verletzen: ${parsed.error}`);
    console.error("Nichts geschrieben – bitte den Import prüfen.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, BANK_FILES[id]), text, "utf8");
  report.push(`  geschrieben: data/banks/${BANK_FILES[id]} – ${items.length} Einträge`);
  return items;
}

/**
 * `review: true` setzt die Qualitätsprüfung (Phase 1, Schritt 7): solche Einträge bleiben in der
 * Datei, der Loader überspringt sie. Ein erneuter Import darf diese Entscheidung nicht wegwerfen.
 */
function readReviewFlags<T>(id: BankId, key: (item: T) => string): Map<string, boolean> {
  const flags = new Map<string, boolean>();
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(OUT_DIR, BANK_FILES[id]), "utf8");
  } catch {
    return flags;
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return flags;
    for (const item of data) if (item && typeof item === "object" && (item as { review?: unknown }).review === true) flags.set(key(item as T), true);
  } catch {
    /* a broken previous file is not a reason to stop the import */
  }
  return flags;
}

function applyReview<T>(items: T[], key: (item: T) => string, flags: Map<string, boolean>): T[] {
  return items.map((item) => (flags.has(key(item)) ? { ...item, review: true } : item));
}

// ---------- inline banks from lib/generators.ts ----------
/**
 * The eight DAS_DASS items exactly as they stood in `lib/generators.ts` (tuples: prompt, answer,
 * solution). They were written by hand, not imported; they live here now so the merge is repeatable.
 */
const INLINE_DAS_DASS: [string, string | string[], string][] = [
  ["Ich hoffe, ___ du morgen kommst.", "dass", "Konjunktion: Man kann nicht „welches“ einsetzen → dass"],
  ["Das Buch, ___ auf dem Tisch liegt, gehört mir.", "das", "Relativpronomen: „welches“ passt → das"],
  ["Er sagt, ___ er keine Zeit hat.", "dass", "Konjunktion nach „sagen“ → dass"],
  ["___ Auto ist neu.", "Das", "Artikel → das"],
  ["Ich weiß, ___ ___ stimmt.", ["dass", "das"], "Erstes: Konjunktion (dass). Zweites: Pronomen „dieses“ (das)."],
  ["Das Kind, ___ dort spielt, ist mein Bruder.", "das", "Relativpronomen: „welches“ passt → das"],
  ["Es ist wichtig, ___ wir pünktlich sind.", "dass", "Konjunktion → dass"],
  ["___ ist mir egal.", "Das", "Demonstrativpronomen „dieses“ → das"],
];
const DAS_DASS_PREFIX = "Setze „das“ oder „dass“ ein: ";
const DAS_DASS_HINT = "Ersatzprobe: Kannst du „welches“ oder „dieses“ einsetzen? Dann schreibt man „das“.";
const dasDassErrorKey = (word: string) => (word.toLowerCase() === "dass" ? "das" : "dass");
const dasDassErrors = (word: string) => ({ [dasDassErrorKey(word)]: "das/dass verwechselt" });

const inlineDasDass: Record<string, unknown>[] = INLINE_DAS_DASS.map(([q, answer, solution]) => {
  const answers = Array.isArray(answer) ? answer : [answer];
  return {
    q: `${DAS_DASS_PREFIX}${q}`,
    blanks: answers.map((a) => [a]),
    solution,
    hint: DAS_DASS_HINT,
    errors: answers.length === 1 ? dasDassErrors(answers[0]) : {},
    // Die acht handgeschriebenen Einträge hatten keine eigene Erklärung: ihr Lösungstext IST die
    // Begründung („Relativpronomen: welches passt → das“), deshalb steht sie in beiden Feldern.
    explanation: solution,
  };
});

const ZEITEN_HINT = "Welche Zeitform steht in der Klammer? Brauchst du ein Hilfsverb (haben, sein, werden)?";
/** The Präteritum/Perfekt items of ZEITEN_CLOZE; the Präsens/Futur/Plusquamperfekt items stay in the generator. */
const INLINE_PRAETERITUM: Record<string, unknown>[] = [
  { q: "Gestern ___ ich mit meinen Freunden im Park. (spielen, Präteritum)", blanks: [["spielte"]], solution: "spielen → ich spielte (Präteritum)", hint: ZEITEN_HINT, errors: {} },
  { q: "Früher ___ er jeden Tag mit dem Rad zur Schule. (fahren, Präteritum)", blanks: [["fuhr"]], solution: "fahren – fuhr – gefahren", hint: ZEITEN_HINT, errors: {} },
];
const INLINE_PERFEKT: Record<string, unknown>[] = [
  { q: "Letzten Sommer ___ wir nach Italien ___. (fahren, Perfekt)", blanks: [["sind"], ["gefahren"]], solution: "fahren bildet das Perfekt mit „sein“: wir sind gefahren", hint: ZEITEN_HINT, errors: {} },
  { q: "Wir ___ gestern lange ___. (lernen, Perfekt)", blanks: [["haben"], ["gelernt"]], solution: "lernen bildet das Perfekt mit „haben“: wir haben gelernt", hint: ZEITEN_HINT, errors: {} },
];

// ---------- articles ----------
type ArtikelRow = { word: string; article: "der" | "die" | "das"; translation?: string; tags: string[] };

function importArtikel(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "articles", "articles");
  const tagByFile = new Map<string, number>();
  /** word → article → the merged row */
  const byWord = new Map<string, Map<"der" | "die" | "das", { translation: string; tags: Set<string>; translations: Set<string> }>>();
  const seenPerFile = new Map<string, Set<string>>();
  let sameFileDuplicates = 0;
  let crossFileDuplicates = 0;
  let bad = 0;
  for (const { row, file } of rows) {
    const word = str(row.word);
    const article: "der" | "die" | "das" | undefined = row.article === "der" || row.article === "die" || row.article === "das" ? row.article : undefined;
    if (!word || !article) {
      bad++;
      note(`articles/${file}.json: Zeile ohne gültiges Wort/Artikel übersprungen (${short(row)})`);
      continue;
    }
    const translation = clean(str(row.translation));
    const key = `${word}\u0000${article}`;
    const seen = seenPerFile.get(file) ?? new Set<string>();
    if (seen.has(key)) sameFileDuplicates++;
    else if (byWord.get(word)?.has(article)) crossFileDuplicates++;
    seen.add(key);
    seenPerFile.set(file, seen);
    tagByFile.set(file, (tagByFile.get(file) ?? 0) + 1);
    const articles = byWord.get(word) ?? new Map<"der" | "die" | "das", { translation: string; tags: Set<string>; translations: Set<string> }>();
    const entry = articles.get(article) ?? { translation, tags: new Set<string>(), translations: new Set<string>() };
    entry.tags.add(file);
    entry.translations.add(translation);
    if (!entry.translation && translation) entry.translation = translation;
    articles.set(article, entry);
    byWord.set(word, articles);
  }
  const items: ArtikelRow[] = [];
  const conflicts: string[] = [];
  let multiFileWords = 0;
  let multiTagRows = 0;
  let differingTranslations = 0;
  for (const [word, articles] of byWord) {
    const allTags = new Set<string>();
    for (const entry of articles.values()) for (const tag of entry.tags) allTags.add(tag);
    if (allTags.size > 1) multiFileWords++;
    if (articles.size > 1) conflicts.push(`${word} (${[...articles.entries()].map(([a, e]) => `${a}/${e.translation || "ohne Übersetzung"}`).join(", ")})`);
    for (const [article, entry] of articles) {
      if (entry.tags.size > 1) multiTagRows++;
      if (entry.translations.size > 1) differingTranslations++;
      items.push({ word, article, ...(entry.translation ? { translation: entry.translation } : {}), tags: sortStrings([...entry.tags]) });
    }
  }
  items.sort((a, b) => byKey(a.word, b.word) || byKey(a.article, b.article));
  const flags = readReviewFlags<ArtikelRow>("artikel", (i) => `${i.word}\u0000${i.article}`);
  const out = applyReview(items, (i) => `${i.word}\u0000${i.article}`, flags);
  report.push("artikel");
  report.push(`  gelesen: ${rows.length} Zeilen aus ${dateien(files)} (${sortStrings([...tagByFile.keys()]).map((f) => `${f} ${tagByFile.get(f)}`).join(", ")})`);
  report.push(`  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}`);
  report.push(`  Doppelzeilen verworfen: ${rows.length - items.length - bad} (${sameFileDuplicates} in derselben Datei, ${crossFileDuplicates} dateiübergreifend)`);
  report.push(`  Wörter: ${byWord.size} verschiedene, davon ${multiFileWords} in mehr als einer Themendatei (tags zusammengelegt; ${multiTagRows} Einträge mit mehr als einem Tag)`);
  report.push(`  Artikelkonflikt: ${conflicts.length ? `${conflicts.join("; ")} → beide Einträge behalten (echter Homograph, nicht stillschweigend verworfen)` : "keiner"}`);
  report.push(`  abweichende Übersetzung bei gleichem Wort und Artikel: ${differingTranslations} (die erste Themendatei in fester Reihenfolge gewinnt)`);
  report.push(`  Einträge: ${out.length}`);
  return out as unknown as Record<string, unknown>[];
}

// ---------- adjective declension ----------
const adjKey = (i: { prefix: string; middle: string; suffix: string; solution: string }) => `${i.prefix}\u0000${i.middle}\u0000${i.suffix}\u0000${i.solution}`;

function importAdjektivdeklination(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "adjectiv_declension", "adjectiv_declension");
  type Item = { prefix: string; middle: string; suffix: string; options1: string[]; correct1: string; options2: string[]; correct2: string; solution: string };
  const items: Item[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let bad = 0;
  for (const { row, file } of rows) {
    const options1 = strArray(row.options1);
    const options2 = strArray(row.options2);
    const correct1 = str(row.correct1);
    const correct2 = str(row.correct2);
    const prefix = text(row.prefix);
    const middle = text(row.middle);
    const suffix = text(row.suffix);
    if (!prefix.trim() || !suffix.trim() || !options1.includes(correct1) || !options2.includes(correct2)) {
      bad++;
      note(`adjectiv_declension/${file}.json: Zeile unvollständig oder correct nicht in options (${short(row)})`);
      continue;
    }
    const item: Item = { prefix, middle, suffix, options1, correct1, options2, correct2, solution: str(row.translation) };
    const key = adjKey(item);
    if (seen.has(key)) {
      duplicates++;
      note(`adjektivdeklination: Doppelzeile verworfen (${item.prefix}… / ${item.solution})`);
      continue;
    }
    seen.add(key);
    items.push(item);
  }
  const flags = readReviewFlags<Item>("adjektivdeklination", adjKey);
  const out = applyReview(items, adjKey, flags).sort((a, b) => byKey(a.solution, b.solution) || byKey(adjKey(a), adjKey(b)));
  report.push("adjektivdeklination");
  report.push(`  gelesen: ${rows.length} Zeilen aus ${dateien(files)}`);
  report.push(`  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unvollständige Zeile(n)` : ""}`);
  report.push(`  Doppelzeilen verworfen: ${duplicates}`);
  report.push(`  jede Zeile hat zwei Lücken (Adjektivendung, Nomenendung) mit je vier Optionen; „translation“ der Quelle heißt hier „solution“ (der ganze gelöste Satz)`);
  report.push(`  Einträge: ${out.length}`);
  return out as unknown as Record<string, unknown>[];
}

// ---------- prepositions ----------
/**
 * Gender of the noun and case of the article. The source stores a hex colour per noun; measured over
 * all 100 rows that colour is exactly the genus (rot = die, grün = das, blau = der; 99 of 100 rows
 * agree, the exception being the plural word „Berge“). It is the source's own statement of the
 * gender, so it is read here — but not written into the bank: the app colours by gender (D10).
 *
 * The case follows from the article form together with the prepositions used (auf, an, in, vor,
 * unter, hinter, neben, über, durch, um, zwischen, gegen — none of them genitive):
 *   dem → Dativ (maskulin oder neutrum)      den → Akkusativ (maskulin)
 *   der → Dativ (feminin)                    die → Akkusativ (feminin oder Plural)
 *   das → Akkusativ (neutrum)
 * After a preposition no nominative can stand; genitive feminine would be „der“, genitive neuter
 * „des“. Where a form stays ambiguous anyway (genitive preposition, plural noun), `kasus` stays null
 * and the row is listed for manual review.
 */
const GENUS_COLOR: Record<string, "der" | "die" | "das"> = { "#ef4444": "die", "#10b981": "das", "#3b82f6": "der" };
const GENITIVE_PREPOSITIONS = new Set(["wegen", "trotz", "während", "statt", "anstatt", "außerhalb", "innerhalb", "aufgrund", "dank", "laut", "mittels", "zwecks", "oberhalb", "unterhalb", "diesseits", "jenseits"]);
/** Plural nouns in the source (checked by hand: only „Berge“): their article has no genus. */
const PLURAL_NOUNS = new Set(["Berge"]);
const prepositionOf = (prefix: string) => clean(prefix).split(" ").at(-1)!.toLowerCase();

function kasusOf(correct: string, preposition: string, plural: boolean): "Dativ" | "Akkusativ" | null {
  if (correct === "dem") return plural ? null : "Dativ";
  if (correct === "den") return plural ? null : "Akkusativ";
  if (correct === "die" || correct === "das") return "Akkusativ";
  if (correct === "der") return GENITIVE_PREPOSITIONS.has(preposition) ? null : "Dativ";
  return null;
}

function importPraepositionen(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "prepositions", "prepositions");
  type Item = { prefix: string; noun: string; article: "der" | "die" | "das"; suffix: string; options: string[]; correct: string; kasus: "Dativ" | "Akkusativ" | null; solution: string };
  const items: Item[] = [];
  const seen = new Set<string>();
  const kasusCount = { Dativ: 0, Akkusativ: 0, offen: 0 };
  const unresolved: string[] = [];
  const genderNotes: string[] = [];
  let duplicates = 0;
  let bad = 0;
  for (const { row, file } of rows) {
    // Satzteile wörtlich (die Leerzeichen der Quelle gehören dazu): prefix „Ich “ + Lücke + suffix
    const prefix = text(row.prefix);
    const noun = text(row.noun);
    const suffix = text(row.suffix);
    const options = strArray(row.options);
    const correct = str(row.correct);
    if (!prefix.trim() || !noun.trim() || !options.includes(correct)) {
      bad++;
      note(`prepositions/${file}.json: Zeile unvollständig oder correct nicht in options (${short(row)})`);
      continue;
    }
    const fromForm: "der" | "die" | "das" | null = correct === "die" ? "die" : correct === "das" ? "das" : correct === "den" ? "der" : correct === "der" ? "die" : null;
    const fromColor = typeof row.noun_color === "string" ? GENUS_COLOR[row.noun_color] : undefined;
    const article = fromForm ?? fromColor;
    if (!article) {
      bad++;
      note(`prepositions/${file}.json: Genus zu „${noun}“ nicht bestimmbar (Form „${correct}“, Farbe „${String(row.noun_color)}“)`);
      continue;
    }
    if (fromColor && fromForm && fromColor !== fromForm) genderNotes.push(`${noun} (Artikel „${correct}“ → ${fromForm}, Farbe → ${fromColor})`);
    const preposition = prepositionOf(prefix);
    const kasus = kasusOf(correct, preposition, PLURAL_NOUNS.has(noun));
    if (kasus) kasusCount[kasus]++;
    else {
      kasusCount.offen++;
      unresolved.push(`${prefix}${noun}${suffix} („${correct}“ nach „${preposition}“${PLURAL_NOUNS.has(noun) ? ", Pluralnomen" : ""})`);
    }
    const key = `${prefix}\u0000${noun}\u0000${suffix}\u0000${correct}`;
    if (seen.has(key)) {
      duplicates++;
      note(`prepositions: Doppelzeile verworfen (${prefix}${noun}${suffix})`);
      continue;
    }
    seen.add(key);
    items.push({ prefix, noun, article, suffix, options, correct, kasus, solution: str(row.translation) });
  }
  const flags = readReviewFlags<Item>("praepositionen", (i) => `${i.prefix}\u0000${i.noun}\u0000${i.suffix}\u0000${i.correct}`);
  const out = applyReview(items, (i) => `${i.prefix}\u0000${i.noun}\u0000${i.suffix}\u0000${i.correct}`, flags).sort(
    (a, b) => byKey(a.prefix + a.noun, b.prefix + b.noun) || byKey(a.correct, b.correct),
  );
  report.push("praepositionen");
  report.push(`  gelesen: ${rows.length} Zeilen aus ${dateien(files)}`);
  report.push(`  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unvollständige Zeile(n)` : ""}`);
  report.push(`  Doppelzeilen verworfen: ${duplicates}`);
  report.push(`  Genus: aus der Artikelform abgeleitet, bei „dem“ zusätzlich aus der Farbe der Quelle (rot=die, grün=das, blau=der); noun_color wird nicht übernommen (D10 färbt nach Genus)`);
  report.push(`  Genus-Abweichungen Form/Farbe: ${genderNotes.length ? `${genderNotes.join("; ")} (Pluralwort oder Fehler in der Quelle – bitte prüfen)` : "keine"}`);
  report.push(`  kasus: ${kasusCount.Dativ} Dativ, ${kasusCount.Akkusativ} Akkusativ, ${kasusCount.offen} offen`);
  report.push(`  offene Fälle zur Handprüfung: ${unresolved.length ? unresolved.join("; ") : "keine"}`);
  report.push(`  Einträge: ${out.length}`);
  return out as unknown as Record<string, unknown>[];
}

// ---------- past tense / perfect ----------
const PRETERITUM_HINT = "Präteritum: die einfache Vergangenheitsform. Bei starken Verben ändert sich der Vokal.";
const PERFEKT_HINT = "Perfekt = haben oder sein im Präsens + Partizip II.";
const clozeKey = (i: { q: string; solution: string }) => `${i.q}\u0000${i.solution}`;

function mergeCloze(id: "praeteritum" | "perfekt", title: string, imported: Record<string, unknown>[], inline: Record<string, unknown>[], head: string[], report: string[]): Record<string, unknown>[] {
  const key = (i: Record<string, unknown>) => clozeKey(i as { q: string; solution: string });
  const flags = readReviewFlags<Record<string, unknown>>(id, key);
  const byPrompt = new Map<string, Record<string, unknown>>();
  let duplicates = 0;
  for (const item of [...imported, ...inline]) {
    const k = key(item);
    if (byPrompt.has(k)) {
      duplicates++;
      continue;
    }
    byPrompt.set(k, item);
  }
  const out = applyReview([...byPrompt.values()], key, flags).sort((a, b) => byKey(String(a.q), String(b.q)) || byKey(String(a.solution), String(b.solution)));
  report.push(title, ...head);
  report.push(`  aus lib/generators.ts übernommen (nicht mehr dort, damit es sie nur einmal gibt): ${inline.length} Einträge`);
  report.push(`  Doppelzeilen beim Zusammenführen verworfen: ${duplicates}`);
  report.push(`  Einträge: ${out.length}`);
  return out;
}

function importPraeteritum(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "past_tense", "past_tense");
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let bad = 0;
  for (const { row, file } of rows) {
    const verb = str(row.verb);
    const options = strArray(row.options);
    const correct = str(row.correct);
    if (!verb || !options.includes(correct)) {
      bad++;
      note(`past_tense/${file}.json: Zeile unvollständig oder correct nicht in options (${short(row)})`);
      continue;
    }
    const errors: Record<string, string> = {};
    for (const option of options) if (option !== correct) errors[option] = `Falsche Präteritumform von „${verb}“`;
    const item = {
      q: `Setze das Verb im Präteritum ein: ${clozePrompt([text(row.prefix), text(row.suffix)])} (${verb})`,
      blanks: [[correct]],
      solution: `${verb} → ${correct}`,
      hint: PRETERITUM_HINT,
      errors,
    };
    if (seen.has(clozeKey(item))) {
      duplicates++;
      continue;
    }
    seen.add(clozeKey(item));
    items.push(item);
  }
  const head = [
    `  gelesen: ${rows.length} Zeilen aus ${dateien(files)}`,
    `  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unvollständige Zeile(n)` : ""}`,
    `  Doppelzeilen verworfen: ${duplicates}`,
    `  Quelle: past_tense/allgemein.json; die vier falschen Optionen je Zeile werden zu typischen Fehlern`,
  ];
  return mergeCloze("praeteritum", "praeteritum", items, INLINE_PRAETERITUM, head, report);
}

function importPerfekt(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "past_perfect_tense", "past_perfect_tense");
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let bad = 0;
  for (const { row, file } of rows) {
    const options1 = strArray(row.options1);
    const options2 = strArray(row.options2);
    const correct1 = str(row.correct1);
    const correct2 = str(row.correct2);
    if (!options1.includes(correct1) || !options2.includes(correct2)) {
      bad++;
      note(`past_perfect_tense/${file}.json: Zeile unvollständig oder correct nicht in options (${short(row)})`);
      continue;
    }
    const errors: Record<string, string> = {};
    for (const option of options1) if (option !== correct1) errors[option] = "Falsches Hilfsverb";
    for (const option of options2) if (option !== correct2) errors[option] = "Falsches Partizip II";
    const prefix = text(row.prefix);
    const middle = text(row.middle);
    const suffix = text(row.suffix);
    const item = {
      q: `Setze das Verb im Perfekt ein: ${clozePrompt([prefix, middle, suffix])}`,
      blanks: [[correct1], [correct2]],
      // die gelöste Form aus den Satzteilen; die Quelle liefert „translation“ als ganzen Satz
      solution: str(row.translation) || `${prefix}${correct1}${middle}${correct2}${suffix}`.trim(),
      hint: PERFEKT_HINT,
      errors,
    };
    if (seen.has(clozeKey(item))) {
      duplicates++;
      continue;
    }
    seen.add(clozeKey(item));
    items.push(item);
  }
  const head = [
    `  gelesen: ${rows.length} Zeilen aus ${dateien(files)}`,
    `  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unvollständige Zeile(n)` : ""}`,
    `  Doppelzeilen verworfen: ${duplicates}`,
    `  Quelle: past_perfect_tense/test.json – sie enthält Perfekt („hat … gekocht“), nicht Plusquamperfekt; deshalb als perfekt.json geführt (Relabel aus dem Plan)`,
    `  je Zeile zwei Lücken: Hilfsverb und Partizip II`,
  ];
  return mergeCloze("perfekt", "perfekt", items, INLINE_PERFEKT, head, report);
}

// ---------- das / dass ----------
const sentenceOf = (item: Record<string, unknown>) => String(item.q).replace(DAS_DASS_PREFIX, "");

function importDasDass(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "das_dass", "das_dass");
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let bad = 0;
  let normalizedGap = 0;
  let twoGaps = 0;
  let differingGaps = 0;
  for (const { row, file } of rows) {
    const source = str(row.sentence);
    const sentence = source.replace(/\*{2,}/g, GAP);
    if (sentence !== source) normalizedGap++;
    const correct = str(row.correct);
    const gaps = sentence.match(/_{2,}/g) ?? [];
    if (!sentence || (correct !== "das" && correct !== "dass") || !gaps.length) {
      bad++;
      note(`das_dass/${file}.json: Zeile ohne Satz, ohne das/dass oder ohne Lücke übersprungen (${short(row)})`);
      continue;
    }
    // Zwei Lücken prüfen beides: erst der Artikel „das“, dann die Konjunktion aus `correct`
    // („___ Buch ist so spannend, ___ ich es nicht weglegen kann“). Eine Lücke füllt `correct`.
    const filled = gaps.map((_, i) => {
      const word = i === 0 && gaps.length > 1 && correct === "dass" ? "das" : correct;
      return [i === 0 && sentence.startsWith(GAP) ? capitalize(word) : word];
    });
    if (gaps.length > 1) {
      twoGaps++;
      if (new Set(filled.map((f) => f[0].toLowerCase())).size > 1) differingGaps++;
    }
    const parts = sentence.split(/_{2,}/);
    const solution = parts.reduce((text, part, i) => (i === 0 ? part : `${text}${filled[i - 1][0]}${part}`), "");
    if (seen.has(sentence)) {
      bad++;
      note(`das-dass: Doppelzeile verworfen (${sentence.slice(0, 90)}…)`);
      continue;
    }
    seen.add(sentence);
    items.push({
      q: `${DAS_DASS_PREFIX}${sentence}`,
      blanks: filled,
      solution,
      hint: DAS_DASS_HINT,
      errors: gaps.length === 1 ? dasDassErrors(correct) : {},
      explanation: str(row.explanation),
    });
  }
  const flags = readReviewFlags<Record<string, unknown>>("das-dass", sentenceOf);
  const bySentence = new Map<string, Record<string, unknown>>();
  let inlineDuplicates = 0;
  for (const item of [...items, ...inlineDasDass]) {
    const k = sentenceOf(item);
    if (bySentence.has(k)) {
      inlineDuplicates++;
      continue;
    }
    bySentence.set(k, item);
  }
  const out = applyReview([...bySentence.values()], sentenceOf, flags).sort((a, b) => byKey(sentenceOf(a), sentenceOf(b)));
  report.push("das-dass");
  report.push(`  gelesen: ${rows.length} Zeilen aus ${dateien(files)}`);
  report.push(`  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unbrauchbare oder doppelte Zeile(n)` : ""}`);
  report.push(`  Platzhalter „***“ zu „___“ normalisiert: ${normalizedGap} Zeile${normalizedGap === 1 ? "" : "n"}`);
  report.push(`  Sätze mit zwei Lücken: ${twoGaps} (davon mit zwei verschiedenen Lösungen: ${differingGaps}; erste Lücke = Artikel „das“, zweite = das/dass)`);
  report.push(`  aus lib/generators.ts übernommen: ${inlineDasDass.length} Einträge (schon in der Quelle vorhanden: ${inlineDuplicates})`);
  report.push(`  jede Zeile der Quelle hat eine Erklärung, sie wird als „explanation“ mitgeführt; „solution“ ist der gelöste Satz`);
  report.push(`  Einträge: ${out.length}`);
  return out;
}

// ---------- main / subordinate clause ----------
const joinParts = (item: Record<string, unknown>) => (item.parts as { text: string }[]).map((p) => p.text).join(" ");

function importSatzbau(root: string, report: string[]): Record<string, unknown>[] {
  const { rows, files, skipped } = readFolder(root, "satzbau", "satzbau");
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let bad = 0;
  for (const { row, file } of rows) {
    const rawParts = Array.isArray(row.sentence_parts) ? (row.sentence_parts as { text?: unknown; type?: unknown }[]) : [];
    const parts = rawParts
      .filter((p) => typeof p.text === "string" && (p.type === "HS" || p.type === "GS"))
      .map((p) => ({ text: text(p.text), type: p.type as "HS" | "GS" }));
    if (parts.length !== 2 || parts.filter((p) => p.type === "HS").length !== 1 || parts.some((p) => !p.text.trim())) {
      bad++;
      note(`satzbau/${file}.json: Zeile ohne genau einen Haupt- und einen Gliedsatz übersprungen (${short(row)})`);
      continue;
    }
    const key = joinParts({ parts });
    if (seen.has(key)) {
      bad++;
      note(`hauptsatz-gliedsatz: Doppelzeile verworfen (${key.slice(0, 90)}…)`);
      continue;
    }
    seen.add(key);
    items.push({ parts });
  }
  const flags = readReviewFlags<Record<string, unknown>>("hauptsatz-gliedsatz", joinParts);
  const out = applyReview(items, joinParts, flags).sort((a, b) => byKey(joinParts(a), joinParts(b)));
  report.push("hauptsatz-gliedsatz");
  report.push(`  gelesen: ${rows.length} Zeilen aus ${dateien(files)} (die Quelle ist ein Objekt mit dem Schlüssel „sentences“, kein Array)`);
  report.push(`  übersprungen: ${skipped.length ? skipped.join("; ") : "keine"}${bad ? `; ${bad} unbrauchbare oder doppelte Zeile(n)` : ""}`);
  report.push(`  jede Zeile hat genau zwei Teile, einen HS und einen GS`);
  report.push(`  Einträge: ${out.length}`);
  return out;
}

// ---------- optional: cases from the KI ----------
async function kasusMitKI(report: string[]): Promise<boolean> {
  const { aiEnabled, anyProviderKey, runAI } = await import("../lib/ai/router");
  if (!anyProviderKey() || !aiEnabled("aufgaben")) {
    console.error("\nFEHLER: Für --kasus-ki ist kein KI-Anbieter eingerichtet (kein Schlüssel in der Umgebung, z. B. ANTHROPIC_API_KEY).");
    console.error("Ohne Anbieter wird nichts abgeleitet und nichts geschrieben – es wird nicht geraten.");
    return false;
  }
  const file = path.join(OUT_DIR, BANK_FILES.praepositionen);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { prefix: string; noun: string; suffix: string; correct: string; article: string; kasus: string | null }[];
  const open = raw.filter((r) => !r.kasus);
  report.push("kasus-KI");
  if (!open.length) {
    report.push("  nichts zu tun: alle Fälle sind ohne KI entschieden (die Ableitung aus der Artikelform ist eindeutig)");
    return true;
  }
  report.push(`  offene Fälle: ${open.length} – die KI wird gefragt`);
  const { z } = await import("zod");
  const schema = z.object({ items: z.array(z.object({ index: z.number().int(), kasus: z.enum(["Dativ", "Akkusativ"]) })) });
  let changed = 0;
  for (let start = 0; start < open.length; start += 20) {
    const batch = open.slice(start, start + 20);
    const list = batch.map((r, i) => `${i + 1}. „${r.prefix}${r.noun}${r.suffix}“ – Artikelform „${r.correct}“, Genus „${r.article}“`).join("\n");
    const res = await runAI(
      "aufgaben",
      schema,
      "Du bestimmst für deutsche Präpositionalphrasen den Kasus (Dativ oder Akkusativ). Antworte nur mit dem geforderten JSON.",
      `Nenne für jede Phrase den Kasus des Artikels.\n${list}`,
      { maxTokens: 2_000, meta: { trigger: "import-artikel-trainer kasus" } },
    );
    if (!res.ok) {
      report.push(`  KI nicht verfügbar (${res.cause}: ${res.message}) – nichts geändert, nichts geschrieben`);
      return false;
    }
    for (const answer of res.data.items) {
      const target = batch[answer.index - 1];
      if (!target) continue;
      report.push(`  ${target.prefix}${target.noun}${target.suffix} → ${answer.kasus}`);
      target.kasus = answer.kasus;
      changed++;
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  report.push(`  geschrieben: data/banks/${BANK_FILES.praepositionen} (${changed} Fälle ergänzt)`);
  return true;
}

// ---------- main ----------
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const kasusKi = args.includes("--kasus-ki");
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("Aufruf: tsx scripts/import-artikel-trainer.ts <Pfad zu „Artikel Trainer/categories“> [--kasus-ki]");
    console.error('Beispiel: tsx scripts/import-artikel-trainer.ts "C:/Users/niko/Desktop/Artikel Trainer/categories"');
    process.exit(1);
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`FEHLER: „${root}“ ist kein Ordner.`);
    process.exit(1);
  }

  const report: string[] = [];
  // writeBank läuft direkt nach dem Import der Bank, damit der Bericht in der Reihenfolge der Banken bleibt
  const banks: [BankId, Record<string, unknown>[]][] = [
    ["artikel", writeBank("artikel", importArtikel(root, report), report)],
    ["adjektivdeklination", writeBank("adjektivdeklination", importAdjektivdeklination(root, report), report)],
    ["praepositionen", writeBank("praepositionen", importPraepositionen(root, report), report)],
    ["praeteritum", writeBank("praeteritum", importPraeteritum(root, report), report)],
    ["perfekt", writeBank("perfekt", importPerfekt(root, report), report)],
    ["das-dass", writeBank("das-dass", importDasDass(root, report), report)],
    ["hauptsatz-gliedsatz", writeBank("hauptsatz-gliedsatz", importSatzbau(root, report), report)],
  ];

  console.log(`Import Artikel Trainer\nQuelle: ${root}\nZiel:   ${OUT_DIR}\n`);
  console.log(report.join("\n"));
  console.log("\nNicht gelesen: categories/memorize/ (persönliche Lerntexte, Entscheidung D4) und AI_prompts.md (keine Bank).");

  if (kasusKi) {
    const ok = await kasusMitKI(report);
    console.log(`\n${report.slice(report.findIndex((l) => l === "kasus-KI")).join("\n")}`);
    if (!ok) process.exit(1);
  }

  console.log(`\nNicht verwertet: ${problems.length}`);
  for (const p of problems) console.log(`  - ${p}`);
  if (!problems.length) console.log("  (nichts – alle gelesenen Zeilen sind in die Banken übernommen)");
  const total = sum(banks.map(([, items]) => items.length));
  console.log(`\nBanken: ${banks.length}, Einträge gesamt: ${total}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
