/**
 * Schreibaufträge der SRDP (Oberstufe): the student writes a whole text of one Textsorte about a Textbeilage with
 * line numbers, as at the Schularbeit and the Matura. Zusammenfassung, Leserbrief, Erörterung, Kommentar,
 * Meinungsrede, Textanalyse, offener Brief and Empfehlung follow here; the Textinterpretation came first and keeps
 * its own Schreibplan, Arbeitsauftrag, Hinweise and Teilübungen (lib/textinterpretation.ts), which the functions
 * below hand it to.
 *
 * Every Textsorte has a default word target the teacher can change, a Schreibplan with a word budget per part,
 * three Arbeitsaufträge, its formal features, Hinweise without KI and Teilübungen for the builder. All of it is pure
 * and works without KI, in the browser and on the server. The Textbeilage the teacher pasted lives in
 * lib/schreibauftrag-store.ts, the examples in lib/schreibauftrag-beispiele.ts.
 *
 * Parts, features and Arbeitsaufträge are own wording after public descriptions of the SRDP Textsorten
 * (deutsche-grammatik.net, the BRP information of BAfEP 10); no task of the Aufgabenpool or of IQS is used, only
 * the form. The Hinweise are hints, never a grade: they say what they find or do not find, and a text that could be
 * right is never called wrong.
 */
import { blockText, countWords, type TextDoc } from "./text-doc";
import type { TaskDraft } from "./tasks";
import { BEISPIELE } from "./schreibauftrag-beispiele";
import { BEISPIEL_AUTORIN, BEISPIEL_GESCHICHTE, BEISPIEL_INTERPRETATION, BEISPIEL_JAHR, BEISPIEL_QUELLE, BEISPIEL_TITEL } from "./textinterpretation-beispiel";
import {
  absaetzeHinweis,
  bareText,
  cleanStory,
  cleanTarget,
  defaultArbeitsauftrag,
  DEFAULT_TARGET,
  findInStory,
  hinweise,
  INTERPRETATION_KIND,
  isStoryKind,
  MAX_TEILUEBUNGEN,
  namesAuthor,
  namesTitle,
  nextTeiluebung,
  numberedLines,
  opening,
  paragraphs,
  quotesOf,
  round5,
  schreibplan,
  short,
  STORY_KINDS,
  TEIL_TITLES,
  TEXTINTERPRETATION_SKILL,
  teiluebungen,
  umfangHinweis,
  wordRange,
  zitatHinweise,
  type Hinweis,
  type HinweisTone,
  type StoryKind,
  type StoryLine,
} from "./textinterpretation";

export type SorteKey = "zusammenfassung" | "leserbrief" | "eroerterung" | "kommentar" | "meinungsrede" | "textanalyse" | "offenerbrief" | "empfehlung" | "textinterpretation";

// ---------- the Textbeilage ----------

/** Kinds of Textbeilage (Sachtexte and journalistic texts), with the forms the Arbeitsauftrag needs. */
export const BEILAGE_KINDS = {
  Zeitungsartikel: { zu: "zum", des: "des Zeitungsartikels", den: "den Zeitungsartikel", der: "der Zeitungsartikel" },
  Bericht: { zu: "zum", des: "des Berichts", den: "den Bericht", der: "der Bericht" },
  Reportage: { zu: "zur", des: "der Reportage", den: "die Reportage", der: "die Reportage" },
  Kommentar: { zu: "zum", des: "des Kommentars", den: "den Kommentar", der: "der Kommentar" },
  Kolumne: { zu: "zur", des: "der Kolumne", den: "die Kolumne", der: "die Kolumne" },
  Essay: { zu: "zum", des: "des Essays", den: "den Essay", der: "der Essay" },
  Interview: { zu: "zum", des: "des Interviews", den: "das Interview", der: "das Interview" },
  Rede: { zu: "zur", des: "der Rede", den: "die Rede", der: "die Rede" },
  Leserbrief: { zu: "zum", des: "des Leserbriefs", den: "den Leserbrief", der: "der Leserbrief" },
  Rezension: { zu: "zur", des: "der Rezension", den: "die Rezension", der: "die Rezension" },
  Blogeintrag: { zu: "zum", des: "des Blogeintrags", den: "den Blogeintrag", der: "der Blogeintrag" },
  Sachtext: { zu: "zum", des: "des Sachtexts", den: "den Sachtext", der: "der Sachtext" },
} as const;
export type BeilageKind = keyof typeof BEILAGE_KINDS;
export const isBeilageKind = (x: unknown): x is BeilageKind => typeof x === "string" && x in BEILAGE_KINDS;
type KindForms = { zu: string; des: string; den: string; der: string };

/** „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl (Der Talblick, 12. März 2026); for a story the same as storyReference. */
export function beilageReference(b: { title: string; author: string; medium?: string; year: string }): string {
  const where = [b.medium?.trim() ?? "", b.year.trim()].filter(Boolean).join(", ");
  return [`„${b.title.trim()}“`, b.author.trim() ? `von ${b.author.trim()}` : "", where ? `(${where})` : ""].filter(Boolean).join(" ");
}

/**
 * A text pasted from a web page has a whole paragraph in one line: it is broken into lines of about `width`
 * characters, as on a printed sheet, so the line numbers mean something. Lines that fit stay as they are, words
 * are never split, empty lines stay.
 */
export function wrapLines(text: string, width = 62): string {
  return cleanStory(text)
    .split("\n")
    .flatMap((line) => {
      if (line.length <= width) return [line];
      const out: string[] = [];
      let cur = "";
      for (const w of line.trim().split(/\s+/)) {
        if (cur && cur.length + 1 + w.length > width) {
          out.push(cur);
          cur = w;
        } else cur = cur ? `${cur} ${w}` : w;
      }
      if (cur) out.push(cur);
      return out;
    })
    .join("\n");
}

/** Lines longer than this come from a web page or a word processor, not from a printed sheet. */
export const LONG_LINE = 100;
export const hasLongLines = (text: string) => text.split("\n").some((l) => l.length > LONG_LINE);

// ---------- the Textsorten ----------

/** One part of the Schreibplan: its share of the words, a sentence of help, and what a good part has (for Teilübungen). */
type Teil = { key: string; title: string; share: number; hint: string; criteria: [string, string, string] };

/** Which Hinweise a Textsorte gets (besides Umfang and Absätze, which every one gets). */
type Check = "bezug" | "anrede" | "betreff" | "gruss" | "datum" | "ueberschrift" | "argumente" | "abwaegen" | "publikum" | "fragen" | "dank" | "eigeneWorte" | "meinung" | "konjunktiv" | "zitate" | "forderung" | "empfehlung";

/** What the Arbeitsauftrag is made of: the forms of the Beilage's kind, its reference and the Schreibsituation. */
type AuftragTeile = { k: KindForms; ref: string; situation: string };

export type Sorte = {
  key: SorteKey;
  /** the Textsorte as the text's topic and on the screen */
  name: string;
  /** „Verfasse einen Leserbrief …“ */
  einen: string;
  /** „Teil eines Leserbriefs“ */
  eines: string;
  /** „Gib deinen Leserbrief ab.“ */
  deinen: string;
  skill: string;
  /** default word target; the teacher can change it */
  target: number;
  /** one line for the list of Textsorten */
  beschreibung: string;
  /** what the text is about: "Textbeilage", for the Textinterpretation "Geschichte" */
  beilage: "Textbeilage" | "Geschichte";
  defaultKind: string;
  /** formal features, shown with the Schreibplan and on the sheet */
  merkmale: string[];
  /** the Schreibsituation the teacher can give (Publikum, Adressat, Zielgruppe, Frage); null: none */
  situation: { label: string; placeholder: string; pflicht?: boolean } | null;
  parts: Teil[];
  checks: Check[];
  /** Bezug zur Textbeilage: in the opening or anywhere, all of title, author and medium or one of them */
  bezug?: { wo: "anfang" | "text"; was: "alle" | "eines" };
  /** an example of the Anrede, for the hint */
  anrede?: string;
  /** paragraphs from which the Schreibplan can be seen */
  absaetze: number;
  /** Teilübungen are about quoting with line numbers */
  zitiert: boolean;
  auftrag: (a: AuftragTeile) => { intro: string[]; bullets: [string, string, string] };
};

/** A question as the teacher typed it, without the quotation marks around it. */
const bare = (s: string) => s.trim().replace(/^[„“"»«]+|[“”"«»]+$/g, "").trim();

const SORTEN_LIST: Sorte[] = [
  {
    key: "zusammenfassung",
    name: "Zusammenfassung",
    einen: "eine Zusammenfassung",
    eines: "einer Zusammenfassung",
    deinen: "deine Zusammenfassung",
    skill: "deutsch.os.matura.zusammenfassung",
    target: 300,
    beschreibung: "Die Kernaussagen einer Textbeilage sachlich wiedergeben, ohne eigene Meinung.",
    beilage: "Textbeilage",
    defaultKind: "Zeitungsartikel",
    merkmale: ["Präsens", "eigene Worte, keine Zitate", "fremde Aussagen im Konjunktiv I: Die Autorin meint, das sei …", "keine eigene Meinung, kein wertender Schluss"],
    situation: { label: "Schreibsituation (wenn gewünscht)", placeholder: "z. B. Deine Zusammenfassung erscheint im Newsletter der Schülervertretung." },
    parts: [
      { key: "einleitung", title: "Einleitung", share: 0.15, hint: "Titel, Autor oder Autorin, Textsorte, Medium und Datum der Textbeilage, dazu das Thema in einem Satz.", criteria: ["Titel, Autor oder Autorin und Medium genannt", "Thema in einem Satz", "höchstens zwei, drei Sätze"] },
      { key: "position", title: "Position", share: 0.3, hint: "Welche Meinung vertritt der Text, was ist sein Anliegen? In eigenen Worten und im Präsens.", criteria: ["Hauptaussage richtig erfasst", "eigene Worte statt Zitate", "Präsens"] },
      { key: "begruendung", title: "Begründungen", share: 0.35, hint: "Die wichtigsten Begründungen und Beispiele in einer sinnvollen Reihenfolge. Fremde Aussagen im Konjunktiv I.", criteria: ["nur das Wichtigste", "Konjunktiv I bei fremden Aussagen", "sinnvolle Reihenfolge"] },
      { key: "folgerung", title: "Folgerungen", share: 0.2, hint: "Welche Folgerung oder Forderung zieht der Text? Ohne eigene Meinung und ohne wertenden Schluss.", criteria: ["Folgerung des Textes wiedergegeben", "keine eigene Meinung", "kein wertender Schluss"] },
    ],
    checks: ["bezug", "eigeneWorte", "meinung", "konjunktiv"],
    bezug: { wo: "anfang", was: "alle" },
    absaetze: 3,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: [`Verfasse eine Zusammenfassung ${k.des} ${ref}.`, situation],
      bullets: ["Gib die Position wieder, die der Text vertritt.", "Fasse die wichtigsten Begründungen und Beispiele zusammen.", "Gib wieder, welche Folgerungen der Text zieht."],
    }),
  },
  {
    key: "leserbrief",
    name: "Leserbrief",
    einen: "einen Leserbrief",
    eines: "eines Leserbriefs",
    deinen: "deinen Leserbrief",
    skill: "deutsch.os.matura.leserbrief",
    target: 300,
    beschreibung: "Auf einen Artikel antworten: mit Bezug, klarer Meinung und Appell.",
    beilage: "Textbeilage",
    defaultKind: "Kommentar",
    merkmale: ["kurzer Betreff über dem Brief", "Anrede, z. B. Sehr geehrte Damen und Herren der Redaktion", "Bezug: Titel, Medium und Datum des Artikels", "sachlich und höflich, nie beleidigend", "Grußformel und Name"],
    situation: { label: "Schreibsituation (wenn gewünscht)", placeholder: "z. B. Du schreibst als Schülerin oder Schüler einer Oberstufe aus der Region." },
    parts: [
      { key: "einleitung", title: "Betreff, Anrede und Bezug", share: 0.15, hint: "Ein kurzer Betreff, die Anrede, dann der Bezug: Titel, Medium und Datum des Artikels. Sag, wer du bist und warum du schreibst.", criteria: ["Betreff und Anrede", "Titel, Medium und Datum genannt", "Anlass des Schreibens klar"] },
      { key: "inhalt", title: "Worum es geht", share: 0.1, hint: "In zwei, drei Sätzen: Was behauptet oder fordert der Artikel?", criteria: ["kurz", "Position des Artikels richtig wiedergegeben", "keine Nacherzählung"] },
      { key: "meinung", title: "Deine Meinung", share: 0.5, hint: "Nimm Stellung mit zwei, drei Argumenten: Behauptung, Begründung, Beispiel. Geh auf Aussagen des Artikels ein.", criteria: ["klare eigene Meinung", "Argumente mit Begründung und Beispiel", "auf den Artikel bezogen"] },
      { key: "schluss", title: "Appell und Gruß", share: 0.25, hint: "Ein Appell oder eine Forderung an eine bestimmte Gruppe, dann die Grußformel und dein Name.", criteria: ["Appell an eine Zielgruppe", "Grußformel und Name", "sachlicher Ton bis zum Schluss"] },
    ],
    checks: ["betreff", "anrede", "bezug", "argumente", "gruss"],
    bezug: { wo: "anfang", was: "alle" },
    anrede: "„Sehr geehrte Damen und Herren der Redaktion“",
    absaetze: 5,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: [`Verfasse einen Leserbrief ${k.zu} ${keyOf(k)} ${ref}.`, situation],
      bullets: ["Gib kurz wieder, welche Position der Text vertritt.", "Nimm mit Argumenten Stellung zu dieser Position.", "Richte am Schluss einen Appell an eine Gruppe, die dir wichtig ist."],
    }),
  },
  {
    key: "eroerterung",
    name: "Erörterung",
    einen: "eine Erörterung",
    eines: "einer Erörterung",
    deinen: "deine Erörterung",
    skill: "deutsch.os.matura.eroerterung",
    target: 600,
    beschreibung: "Eine strittige Frage auf Grundlage einer Textbeilage von beiden Seiten prüfen.",
    beilage: "Textbeilage",
    defaultKind: "Kolumne",
    merkmale: ["eigene Überschrift, nicht der Titel der Textbeilage", "Argumente mit Behauptung, Begründung und Beispiel", "Pro und Kontra, abgewogen", "sachlicher Stil, Präsens", "Verknüpfungswörter: zwar, jedoch, außerdem, deshalb"],
    situation: { label: "Frage, die erörtert wird", placeholder: "z. B. Sollen Hausübungen abgeschafft werden?" },
    parts: [
      { key: "einleitung", title: "Einleitung", share: 0.1, hint: "Überschrift, dann eine Hinführung mit einem Anlass oder Beispiel. Nenne Titel, Autor oder Autorin und Textsorte und stell die Frage.", criteria: ["Hinführung zum Thema", "Textbeilage genannt", "Frage klar gestellt"] },
      { key: "position", title: "Position der Textbeilage", share: 0.15, hint: "Gib kurz wieder, welche Position der Text vertritt und wie er sie begründet.", criteria: ["Position richtig erfasst", "kurz", "eigene Worte"] },
      { key: "gegenseite", title: "Gegenseite", share: 0.3, hint: "Die Argumente der Seite, die du nicht vertrittst, vom stärksten zum schwächsten. Jedes mit Behauptung, Begründung und Beispiel.", criteria: ["Gegenargumente fair dargestellt", "Behauptung, Begründung, Beispiel", "vom stärksten zum schwächsten"] },
      { key: "eigeneseite", title: "Deine Seite", share: 0.3, hint: "Deine Argumente vom schwächsten zum stärksten, das stärkste zuletzt. Entkräfte dabei die Gegenseite.", criteria: ["Behauptung, Begründung, Beispiel", "Steigerung zum stärksten Argument", "Gegenargumente entkräftet"] },
      { key: "schluss", title: "Schluss", share: 0.15, hint: "Wäge ab und nimm begründet Stellung. Bring keine neuen Argumente.", criteria: ["begründete Stellungnahme", "passt zum Hauptteil", "keine neuen Argumente"] },
    ],
    checks: ["ueberschrift", "bezug", "argumente", "abwaegen"],
    bezug: { wo: "anfang", was: "alle" },
    absaetze: 5,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: [`Verfasse eine Erörterung auf Grundlage ${k.des} ${ref}.`],
      bullets: [
        "Gib die Position wieder, die der Text vertritt.",
        situation ? `Erörtere die Frage „${bare(situation)}“ mit Argumenten dafür und dagegen.` : "Erörtere die Frage, um die es im Text geht, mit Argumenten dafür und dagegen.",
        "Nimm am Schluss begründet Stellung.",
      ],
    }),
  },
  {
    key: "kommentar",
    name: "Kommentar",
    einen: "einen Kommentar",
    eines: "eines Kommentars",
    deinen: "deinen Kommentar",
    skill: "deutsch.os.matura.kommentar",
    target: 450,
    beschreibung: "Zu einem aktuellen Anlass klar Stellung beziehen und zuspitzen.",
    beilage: "Textbeilage",
    defaultKind: "Bericht",
    merkmale: ["eigene, prägnante Überschrift", "klare Meinung von Anfang an", "Präsens", "rhetorische Mittel erlaubt: Frage, Zuspitzung, Vergleich", "pointierter Schluss"],
    situation: { label: "Wo erscheint der Kommentar? (wenn gewünscht)", placeholder: "z. B. Dein Kommentar erscheint in der Schülerzeitung." },
    parts: [
      { key: "einstieg", title: "Überschrift und Einstieg", share: 0.15, hint: "Eine prägnante Überschrift, dann der Anlass: Worum geht es, warum ist es gerade Thema?", criteria: ["prägnante eigene Überschrift", "Anlass genannt", "weckt Interesse"] },
      { key: "bezug", title: "Bezug zur Textbeilage", share: 0.15, hint: "Gib kurz wieder, was der Text berichtet oder fordert.", criteria: ["Textbeilage genannt", "kurz und richtig", "keine Nacherzählung"] },
      { key: "meinung", title: "Deine Meinung", share: 0.5, hint: "Bezieh klar Stellung und begründe sie mit zwei, drei Argumenten, das stärkste zuletzt. Zuspitzung ist erlaubt.", criteria: ["klare Position", "Argumente begründet", "rhetorische Mittel passend eingesetzt"] },
      { key: "schluss", title: "Schluss", share: 0.2, hint: "Eine pointierte Folgerung oder Forderung, gern mit einer rhetorischen Frage.", criteria: ["pointierte Folgerung oder Forderung", "passt zur Meinung", "keine neuen Argumente"] },
    ],
    checks: ["ueberschrift", "bezug", "argumente"],
    bezug: { wo: "text", was: "eines" },
    absaetze: 4,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: [`Verfasse einen Kommentar ${k.zu} ${keyOf(k)} ${ref}.`, situation],
      bullets: ["Stelle kurz dar, worum es im Text geht.", "Bezieh klar Stellung und begründe deine Meinung.", "Schließ mit einer pointierten Folgerung oder Forderung."],
    }),
  },
  {
    key: "meinungsrede",
    name: "Meinungsrede",
    einen: "eine Meinungsrede",
    eines: "einer Meinungsrede",
    deinen: "deine Rede",
    skill: "deutsch.os.matura.meinungsrede",
    target: 600,
    beschreibung: "Ein Publikum mit Argumenten und rhetorischen Mitteln überzeugen.",
    beilage: "Textbeilage",
    defaultKind: "Kolumne",
    merkmale: ["Anrede des Publikums, z. B. Liebe Mitschülerinnen und Mitschüler", "Bezug zum Anlass der Rede", "das Publikum direkt ansprechen: ihr, Sie, wir", "rhetorische Fragen, Wiederholungen, kurze Sätze", "Appell am Schluss, oft ein Dank fürs Zuhören"],
    situation: { label: "Anlass und Publikum", placeholder: "z. B. Du sprichst bei der Schulversammlung vor Mitschülerinnen, Mitschülern und Lehrkräften.", pflicht: true },
    parts: [
      { key: "anrede", title: "Anrede und Einstieg", share: 0.15, hint: "Sprich das Publikum an, nenn den Anlass und hol die Zuhörenden mit einer Frage, einem Beispiel oder einem Erlebnis ab.", criteria: ["Anrede passt zum Publikum", "Anlass genannt", "Einstieg weckt Interesse"] },
      { key: "bezug", title: "Bezug zur Textbeilage", share: 0.1, hint: "Gib kurz wieder, was der Text sagt, und zeig, warum es dein Publikum betrifft.", criteria: ["Textbeilage genannt", "kurz wiedergegeben", "Bezug zum Publikum"] },
      { key: "argumente", title: "Argumente", share: 0.55, hint: "Deine Position mit Argumenten, vom schwächsten zum stärksten. Sprich das Publikum direkt an und nutze rhetorische Mittel.", criteria: ["klare Position", "Argumente steigernd geordnet", "Publikum direkt angesprochen"] },
      { key: "appell", title: "Appell und Schluss", share: 0.2, hint: "Fasse deine Position zusammen, richte einen Appell an das Publikum und bedank dich fürs Zuhören.", criteria: ["Position zusammengefasst", "deutlicher Appell", "passender Abschluss"] },
    ],
    checks: ["anrede", "bezug", "publikum", "fragen", "argumente", "dank"],
    bezug: { wo: "text", was: "eines" },
    anrede: "„Liebe Mitschülerinnen und Mitschüler“",
    absaetze: 4,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: [`Verfasse eine Meinungsrede zum Thema ${k.des} ${ref}.`, situation],
      bullets: ["Gib kurz wieder, welche Position der Text vertritt.", "Überzeuge dein Publikum mit Argumenten von deiner Meinung.", "Richte am Schluss einen Appell an dein Publikum."],
    }),
  },
  {
    key: "textanalyse",
    name: "Textanalyse",
    einen: "eine Textanalyse",
    eines: "einer Textanalyse",
    deinen: "deine Textanalyse",
    skill: "deutsch.os.matura.textanalyse",
    target: 600,
    beschreibung: "Untersuchen, wie ein Sachtext gemacht ist und wie er wirkt.",
    beilage: "Textbeilage",
    defaultKind: "Kommentar",
    merkmale: ["Präsens, sachlich, im Hauptteil ohne Wertung", "Zitate mit Zeilenangabe: „…“ (Z. 12)", "jede Beobachtung mit ihrer Wirkung", "Fachbegriffe: These, Argument, Stilmittel"],
    situation: null,
    parts: [
      { key: "einleitung", title: "Einleitung", share: 0.1, hint: "Titel, Autor oder Autorin, Textsorte, Medium und Datum, Thema. Für wen ist der Text geschrieben?", criteria: ["Titel, Autor oder Autorin und Medium genannt", "Textsorte und Thema", "Zielgruppe"] },
      { key: "inhalt", title: "Inhalt", share: 0.15, hint: "Kurz und im Präsens: die Kernaussage und die wichtigsten Gedanken.", criteria: ["Kernaussage erfasst", "kurz", "Präsens"] },
      { key: "aufbau", title: "Aufbau und Argumentation", share: 0.25, hint: "Wie ist der Text gegliedert (mit Zeilen)? Wie argumentiert er: Thesen, Beispiele, Zahlen, Fachleute?", criteria: ["Abschnitte mit Zeilenangaben", "Argumentation untersucht", "Belege genannt"] },
      { key: "sprache", title: "Sprache", share: 0.3, hint: "Wortwahl, Satzbau und Stilmittel. Immer: Zitat, Zeile und Wirkung.", criteria: ["Zitat wörtlich, mit Zeilenangabe", "Stilmittel richtig benannt", "Wirkung erklärt"] },
      { key: "absicht", title: "Absicht und Wirkung", share: 0.1, hint: "Was will der Text erreichen: informieren, überzeugen, unterhalten? Wie wirkt er auf die Leserinnen und Leser?", criteria: ["Absicht erkannt", "Wirkung begründet", "mit dem Hauptteil verbunden"] },
      { key: "schluss", title: "Schluss", share: 0.1, hint: "Fasse deine Ergebnisse zusammen. Wenn der Auftrag es verlangt, bewerte begründet.", criteria: ["Ergebnisse zusammengefasst", "keine neuen Beobachtungen", "Bewertung begründet"] },
    ],
    checks: ["bezug", "zitate"],
    bezug: { wo: "anfang", was: "alle" },
    absaetze: 5,
    zitiert: true,
    auftrag: ({ k, ref }) => ({
      intro: [`Verfasse eine Textanalyse ${k.des} ${ref}.`],
      bullets: [
        "Fasse die Kernaussage des Textes kurz zusammen.",
        "Untersuche Aufbau, Argumentation und sprachliche Gestaltung. Belege deine Aussagen mit Zitaten und Zeilenangaben.",
        "Erkläre, welche Absicht der Text verfolgt und wie er wirkt.",
      ],
    }),
  },
  {
    key: "offenerbrief",
    name: "Offener Brief",
    einen: "einen offenen Brief",
    eines: "eines offenen Briefs",
    deinen: "deinen offenen Brief",
    skill: "deutsch.os.matura.offenerbrief",
    target: 450,
    beschreibung: "Eine Person oder Institution öffentlich ansprechen: Kritik, Begründung, Forderung.",
    beilage: "Textbeilage",
    defaultKind: "Bericht",
    merkmale: ["Ort und Datum, Betreff", "Anrede, z. B. Sehr geehrte Frau Bürgermeisterin", "Höflichkeitsform groß: Sie, Ihnen, Ihr", "sachlich und höflich, aber deutlich", "konkrete Forderung", "Grußformel und Name"],
    situation: { label: "An wen geht der Brief?", placeholder: "z. B. die Bürgermeisterin der Gemeinde", pflicht: true },
    parts: [
      { key: "einleitung", title: "Kopf, Anrede und Anlass", share: 0.15, hint: "Ort und Datum, Betreff und Anrede. Dann: Wer schreibt, an wen und aus welchem Anlass? Nimm Bezug auf die Textbeilage.", criteria: ["Ort, Datum, Betreff und Anrede", "Anlass klar", "Bezug zur Textbeilage"] },
      { key: "kritik", title: "Kritik mit Begründung", share: 0.45, hint: "Was kritisierst du, und warum? Argumente mit Beispielen. Sprich die Adressatin oder den Adressaten direkt an.", criteria: ["Kritik klar", "mit Argumenten und Beispielen begründet", "Adressat direkt angesprochen"] },
      { key: "forderung", title: "Forderung", share: 0.3, hint: "Eine konkrete Forderung oder ein Vorschlag: Was soll wer bis wann tun?", criteria: ["konkrete Forderung", "realistisch und begründet", "höflich, aber deutlich"] },
      { key: "schluss", title: "Schluss und Gruß", share: 0.1, hint: "Ein abschließender Satz an die Adressatin oder den Adressaten, dann Grußformel und Name.", criteria: ["passender Schlusssatz", "Grußformel", "Name"] },
    ],
    checks: ["datum", "anrede", "bezug", "argumente", "forderung", "gruss"],
    bezug: { wo: "text", was: "eines" },
    anrede: "„Sehr geehrte Frau Bürgermeisterin“",
    absaetze: 5,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: situation ? [`Verfasse einen offenen Brief an ${bare(situation)}.`, `Nimm dabei Bezug auf ${k.den} ${ref}.`] : [`Verfasse einen offenen Brief zum Thema ${k.des} ${ref}.`],
      bullets: ["Erkläre, aus welchem Anlass du schreibst.", "Begründe deine Kritik mit Argumenten und Beispielen.", "Stelle eine konkrete Forderung."],
    }),
  },
  {
    key: "empfehlung",
    name: "Empfehlung",
    einen: "eine Empfehlung",
    eines: "einer Empfehlung",
    deinen: "deine Empfehlung",
    skill: "deutsch.os.matura.empfehlung",
    target: 300,
    beschreibung: "Einer Zielgruppe begründet zu etwas raten oder davon abraten.",
    beilage: "Textbeilage",
    defaultKind: "Reportage",
    merkmale: ["Überschrift", "die Zielgruppe im Blick, passend angesprochen", "erst informieren, dann bewerten", "Bewertung begründet", "klare Empfehlung am Schluss"],
    situation: { label: "Für wen ist die Empfehlung?", placeholder: "z. B. die Leserinnen und Leser der Schulzeitung", pflicht: true },
    parts: [
      { key: "einleitung", title: "Einleitung", share: 0.15, hint: "Worum geht es, und für wen schreibst du? Nimm Bezug auf die Textbeilage.", criteria: ["Gegenstand genannt", "Zielgruppe angesprochen", "Bezug zur Textbeilage"] },
      { key: "information", title: "Information", share: 0.25, hint: "Die wichtigsten Fakten aus der Textbeilage, sachlich und knapp.", criteria: ["wichtigste Fakten", "sachlich", "eigene Worte"] },
      { key: "bewertung", title: "Bewertung", share: 0.4, hint: "Stärken und Schwächen, jeweils begründet. Was zählt für deine Zielgruppe?", criteria: ["Stärken und Schwächen", "begründet", "auf die Zielgruppe bezogen"] },
      { key: "empfehlung", title: "Empfehlung", share: 0.2, hint: "Eine klare Empfehlung mit Begründung: Wem rätst du wozu, oder wovon rätst du ab?", criteria: ["klare Empfehlung", "begründet", "an die Zielgruppe gerichtet"] },
    ],
    checks: ["ueberschrift", "bezug", "argumente", "empfehlung"],
    bezug: { wo: "text", was: "eines" },
    absaetze: 4,
    zitiert: false,
    auftrag: ({ k, ref, situation }) => ({
      intro: situation ? [`Verfasse eine Empfehlung für ${bare(situation)}.`, `Grundlage ist ${k.der} ${ref}.`] : [`Verfasse eine Empfehlung ${k.zu} ${keyOf(k)} ${ref}.`],
      bullets: ["Informiere kurz darüber, worum es im Text geht.", "Bewerte Vor- und Nachteile mit Blick auf deine Zielgruppe.", "Sprich eine klare, begründete Empfehlung aus."],
    }),
  },
  {
    // the Schreibplan, Arbeitsauftrag, Hinweise and Teilübungen of this one are in lib/textinterpretation.ts
    key: "textinterpretation",
    name: INTERPRETATION_KIND,
    einen: "eine Textinterpretation",
    eines: "einer Textinterpretation",
    deinen: "deine Interpretation",
    skill: TEXTINTERPRETATION_SKILL,
    target: DEFAULT_TARGET,
    beschreibung: "Eine ganze Geschichte deuten: Inhalt, Form, Sprache, Figur, Deutung.",
    beilage: "Geschichte",
    defaultKind: "Kurzgeschichte",
    merkmale: [],
    situation: null,
    parts: [],
    checks: [],
    absaetze: 5,
    zitiert: true,
    auftrag: () => ({ intro: [], bullets: ["", "", ""] }),
  },
];

/** The noun of a kind, from its forms: "dem Kommentar" needs "Kommentar" after "zum". */
function keyOf(k: KindForms): string {
  return (Object.keys(BEILAGE_KINDS) as BeilageKind[]).find((n) => BEILAGE_KINDS[n] === k) ?? "Text";
}

export const SORTEN: Record<SorteKey, Sorte> = Object.fromEntries(SORTEN_LIST.map((s) => [s.key, s])) as Record<SorteKey, Sorte>;
/** In the order of the list: the shorter Textsorten first, the Textinterpretation last. */
export const SORTE_KEYS = SORTEN_LIST.map((s) => s.key);
export const isSorte = (x: unknown): x is SorteKey => typeof x === "string" && x in SORTEN;

/** The Textsorte a skill practises (the skill or one of its Teilfähigkeiten), or null for any other skill. */
export function sorteOfSkill(id: string | null | undefined): SorteKey | null {
  if (!id) return null;
  return SORTEN_LIST.find((s) => id === s.skill || id.startsWith(`${s.skill}.`))?.key ?? null;
}

/** The kinds of text the Beilage can be: stories for the Textinterpretation, Sachtexte for the others. */
export const kindsOf = (sorte: SorteKey): string[] => Object.keys(sorte === "textinterpretation" ? STORY_KINDS : BEILAGE_KINDS);
export const isKindOf = (sorte: SorteKey, k: unknown): boolean => (sorte === "textinterpretation" ? isStoryKind(k) : isBeilageKind(k));

/** Text of the Schreibsituation: one line, not too long. */
export const cleanSituation = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

// ---------- a Schreibauftrag: what the writing view, the print and the hints need ----------

/** A Schreibauftrag as the writing view, the print and the hints need it (lib/schreibauftrag-store.ts). */
export type AuftragView = { sorte: SorteKey; title: string; author: string; year: string; medium: string; kind: string; text: string; countBlank: boolean; target: number; situation: string };

/** One part of the Schreibplan with its word budget. */
export type PlanTeil = { key: string; title: string; hint: string; words: number };

const storyKind = (k: string): StoryKind => (isStoryKind(k) ? k : "Kurzgeschichte");

/** The parts of the Schreibplan with a rough word budget each (rounded to 5). */
export function planFor(v: Pick<AuftragView, "sorte" | "target" | "kind">): PlanTeil[] {
  if (v.sorte === "textinterpretation") return schreibplan(v.target, storyKind(v.kind));
  const s = SORTEN[v.sorte];
  const t = cleanTarget(v.target, s.target);
  return s.parts.map((p) => ({ key: p.key, title: p.title, hint: p.hint, words: round5(t * p.share) }));
}

export type AuftragInfo = Pick<AuftragView, "sorte" | "title" | "author" | "year" | "medium" | "kind" | "target" | "situation">;

/**
 * The Arbeitsauftrag in the style of the SRDP: the Textsorte, the Textbeilage, the Schreibsituation, three
 * Arbeitsaufträge and the word range. The teacher can change it before and after the text is created.
 */
export function arbeitsauftrag(a: AuftragInfo): string {
  if (a.sorte === "textinterpretation") return defaultArbeitsauftrag({ title: a.title, author: a.author, year: a.year, kind: storyKind(a.kind), target: a.target });
  const s = SORTEN[a.sorte];
  const k = isBeilageKind(a.kind) ? BEILAGE_KINDS[a.kind] : BEILAGE_KINDS[s.defaultKind as BeilageKind];
  const { min, max } = wordRange(cleanTarget(a.target, s.target));
  const { intro, bullets } = s.auftrag({ k, ref: beilageReference(a), situation: cleanSituation(a.situation) });
  return [...intro.filter(Boolean), "Bearbeite dabei die folgenden Arbeitsaufträge:", ...bullets.map((b) => `• ${b}`), `Schreib zwischen ${min} und ${max} Wörter.`].join("\n");
}

/** The title of the student's text: "Leserbrief zu „Ausgeschlafen lernt es sich besser“". */
export const auftragTitle = (sorte: SorteKey, title: string) => `${SORTEN[sorte].name} zu „${title}“`.slice(0, 140);

// ---------- Hinweise without KI ----------

export type HinweisKey = Hinweis["key"] | Exclude<Check, "zitate">;
export type SchreibHinweis = { key: HinweisKey; tone: HinweisTone; text: string };

type Ctx = { doc: TextDoc; words: number; ps: string[]; v: AuftragView; s: Sorte; lines: StoryLine[] };

/** The text without what stands in quotation marks: quoted words are not the writer's own. */
const unquoted = (s: string) => s.replace(/[„“"»«][^„“”"»«]{0,600}[“”"«»]/g, " ");
const firstOf = (ps: string[], n: number) => ps.slice(0, n).join("\n");
const lastOf = (ps: string[], n: number) => ps.slice(-n).join("\n");
/** A short piece of text around a match, for the hint. */
function around(text: string, at: number, len: number): string {
  const from = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 18)) + 1);
  const to = text.indexOf(" ", Math.min(text.length, at + len + 18));
  return short(text.slice(from, to < 0 ? text.length : to).trim(), 60);
}

const ANREDE = /(?:^|[\s,„"])(?:sehr\s+)?(?:geehrte[rn]?|liebe[rn]?|werte[rn]?|geschätzte[rn]?|verehrte[rn]?|hallo|servus|grüß\s+(?:euch|gott|sie|dich)|guten\s+(?:morgen|tag|abend)|meine\s+(?:sehr\s+)?(?:geehrten\s+|verehrten\s+|lieben\s+)?damen\s+und\s+herren)(?=[\s,!])/i;
const GRUSS = /(?:grüße|grüßen|gruß|hochachtungsvoll|\bmfg\b)/i;
const MONAT = "jänner|januar|feber|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember";
const DATUM = new RegExp(`\\b\\d{1,2}\\.\\s?\\d{1,2}\\.(?:\\s?\\d{2,4})?|\\b\\d{1,2}\\.\\s*(?:${MONAT})\\b|\\b(?:${MONAT})\\s+\\d{4}\\b`, "i");
const BEGRUENDUNG = /\b(?:weil|denn|deshalb|daher|darum|deswegen|nämlich|folglich|somit|aus diesem grund)\b/i;
const BEISPIEL = /\b(?:zum beispiel|beispielsweise|etwa|ein beispiel)\b|\bz\.\s?b\./i;
const ABWAEGEN = /\b(?:zwar|jedoch|allerdings|andererseits|einerseits|dagegen|demgegenüber|hingegen|trotzdem|dennoch|befürworter\w*|gegner\w*|kritiker\w*|gegenargument\w*)\b/i;
const PUBLIKUM = /\b(?:ihr|euch|euer|eure[mnrs]?|wir|uns|unser|unsere[mnrs]?)\b|\bIhnen\b/i;
const MEINUNG = /\b(?:ich\s+(?:finde|denke|glaube|meine|persönlich|stimme)|meiner\s+(?:meinung|ansicht|überzeugung)|meines\s+erachtens|ich\s+bin\s+(?:der\s+)?(?:meinung|ansicht|überzeugung)|mir\s+gefällt)\b/i;
const KONJUNKTIV = /\b(?:sei|seien|habe|hätte|hätten|werde|würde|würden|wäre|wären|könne|müsse|solle|dürfe|wolle|möge|wisse|gebe|gäbe|gelte|brauche|fehle|bleibe|liege|stehe|zeige|führe|gehe|komme|käme|lasse|mache|nehme|biete|helfe|koste|lohne|spare|entlaste|schütze|flössen|zunähmen)\b/i;
const FORDERUNG = /\b(?:fordern|fordere|forderung|bitten|bitte|ersuchen|ersuche|appellieren|appelliere|vorschlag|schlagen|setzen\s+sie|sorgen\s+sie|überdenken\s+sie|prüfen\s+sie|laden\s+sie|nehmen\s+sie)\b/i;
const EMPFEHLUNG = /\b(?:empfehle|empfehlen|empfehlenswert|empfohlen|empfehlung|rate|raten|abraten|lohnt\s+sich|nicht\s+verpassen|unbedingt|solltet|solltest)\b/i;

/** Is the first paragraph a heading: formatted as one, or a short line that is no sentence, no Anrede and no date? */
function hasHeading(doc: TextDoc): { ok: boolean; text: string } {
  const first = doc.find((b) => blockText(b).trim());
  if (!first) return { ok: false, text: "" };
  const t = blockText(first).trim();
  if (first.t === "h") return { ok: true, text: t };
  const short = countWords([first]) <= 12 && !/[.:,;]$/.test(t) && !ANREDE.test(t) && !DATUM.test(t);
  return { ok: short, text: short ? t : "" };
}

/**
 * Passages of at least `n` words in the text that stand word for word in the Textbeilage, and quotes of at least
 * four words that do (the title in quotation marks is no quote). For the Zusammenfassung: in your own words.
 */
export function copiedPassages(doc: TextDoc, lines: StoryLine[], title: string, n = 7): string[] {
  const out: string[] = [];
  for (const p of paragraphs(doc)) {
    const tokens = [...p.matchAll(/[\p{L}\p{N}]+/gu)];
    const found = (a: number, b: number) => findInStory(lines, tokens.slice(a, b).map((t) => t[0]).join(" ")).length > 0;
    let i = 0;
    while (i + n <= tokens.length) {
      if (!found(i, i + n)) {
        i++;
        continue;
      }
      let j = i + n;
      while (j < tokens.length && found(i, j + 1)) j++;
      out.push(p.slice(tokens[i].index, tokens[j - 1].index! + tokens[j - 1][0].length));
      i = j;
    }
  }
  for (const q of quotesOf(doc)) {
    const words = bareText(q.text).split(" ").filter(Boolean);
    if (words.length < 4 || words.length >= n || bareText(q.text) === bareText(title)) continue;
    if (findInStory(lines, q.text).length) out.push(q.text);
  }
  return out;
}

const CHECKS: Record<Exclude<Check, "zitate">, (c: Ctx) => SchreibHinweis | null> = {
  bezug: ({ doc, ps, v, s }) => {
    const wo = s.bezug?.wo ?? "anfang";
    const text = wo === "anfang" ? opening(doc) : ps.join("\n");
    const titel = namesTitle(text, v.title);
    const autor = namesAuthor(text, v.author);
    const medium = !v.medium.trim() || namesTitle(text, v.medium);
    const where = wo === "anfang" ? "Am Anfang" : "Im Text";
    if (s.bezug?.was === "eines") {
      if (titel || (v.author.trim() && autor) || (v.medium.trim() && medium)) return { key: "bezug", tone: "gut", text: "Du nimmst Bezug auf die Textbeilage." };
      return { key: "bezug", tone: "tipp", text: `${where} finde ich weder den Titel „${v.title.trim()}“ noch ${v.author.trim() ? `den Namen ${v.author.trim()}` : "den Namen des Mediums"}. Nimm Bezug auf die Textbeilage.` };
    }
    const fehlt = [!titel ? `den Titel „${v.title.trim()}“` : "", !autor ? `den Namen ${v.author.trim()}` : "", !medium ? `das Medium „${v.medium.trim()}“` : ""].filter(Boolean);
    if (!fehlt.length) return { key: "bezug", tone: "gut", text: "Der Anfang nennt die Textbeilage." };
    return { key: "bezug", tone: "tipp", text: `${where} finde ich ${fehlt.length === 1 ? fehlt[0] : `${fehlt.slice(0, -1).join(", ")} und ${fehlt.at(-1)}`} nicht. Nenn die Textbeilage gleich zu Beginn.` };
  },
  anrede: ({ ps, s }) =>
    ANREDE.test(firstOf(ps, 4)) ? { key: "anrede", tone: "gut", text: "Die Anrede ist da." } : { key: "anrede", tone: "tipp", text: `Am Anfang finde ich keine Anrede. Beginne z. B. mit ${s.anrede ?? "„Sehr geehrte Damen und Herren“"}.` },
  betreff: ({ doc }) =>
    hasHeading(doc).ok ? { key: "betreff", tone: "gut", text: "Über dem Brief steht ein Betreff." } : { key: "betreff", tone: "tipp", text: "Über der Anrede steht noch kein Betreff. Ein kurzer Betreff macht neugierig auf deinen Brief." },
  gruss: ({ ps }) =>
    GRUSS.test(lastOf(ps, 3)) ? { key: "gruss", tone: "gut", text: "Am Ende stehen Grußformel und Name." } : { key: "gruss", tone: "tipp", text: "Am Ende finde ich keine Grußformel, z. B. „Mit freundlichen Grüßen“, und darunter deinen Namen." },
  datum: ({ ps }) =>
    DATUM.test(firstOf(ps, 3)) ? { key: "datum", tone: "gut", text: "Oben stehen Ort und Datum." } : { key: "datum", tone: "tipp", text: "Oben finde ich kein Datum. Ein offener Brief beginnt mit Ort und Datum, z. B. „Linz, 14. März 2026“." },
  ueberschrift: ({ doc, v }) => {
    const h = hasHeading(doc);
    if (!h.ok) return { key: "ueberschrift", tone: "tipp", text: "Dein Text hat noch keine Überschrift. Setz eine eigene, kurze Überschrift darüber." };
    if (bareText(h.text) === bareText(v.title)) return { key: "ueberschrift", tone: "tipp", text: "Deine Überschrift ist der Titel der Textbeilage. Finde eine eigene." };
    return { key: "ueberschrift", tone: "gut", text: "Der Text hat eine eigene Überschrift." };
  },
  argumente: ({ ps, words }) => {
    if (words < 120) return null;
    const text = unquoted(ps.join("\n"));
    if (!BEGRUENDUNG.test(text)) return { key: "argumente", tone: "tipp", text: "Ich finde keine Wörter wie weil, denn oder deshalb. Begründe deine Meinung, dann überzeugt sie." };
    if (!BEISPIEL.test(text)) return { key: "argumente", tone: "info", text: "Du begründest. Ein Beispiel macht ein Argument anschaulich (zum Beispiel, etwa …)." };
    return { key: "argumente", tone: "gut", text: "Du begründest und bringst Beispiele." };
  },
  abwaegen: ({ ps, words }) => {
    if (words < 200) return null;
    if (ABWAEGEN.test(unquoted(ps.join("\n")))) return { key: "abwaegen", tone: "gut", text: "Wörter wie zwar, jedoch oder andererseits zeigen, dass du abwägst." };
    return { key: "abwaegen", tone: "tipp", text: "Ich finde keine Wörter wie zwar, jedoch oder andererseits. Eine Erörterung zeigt beide Seiten: Hast du die Gegenseite schon?" };
  },
  publikum: ({ ps, words }) => {
    if (words < 100) return null;
    if (PUBLIKUM.test(unquoted(ps.join("\n")))) return { key: "publikum", tone: "gut", text: "Du sprichst das Publikum direkt an." };
    return { key: "publikum", tone: "tipp", text: "Sprich dein Publikum direkt an: ihr, wir oder Sie." };
  },
  fragen: ({ ps, words }) => {
    if (words < 150) return null;
    const n = (unquoted(ps.join("\n")).match(/\?/g) ?? []).length;
    if (n) return { key: "fragen", tone: "gut", text: n === 1 ? "Eine Frage bezieht das Publikum ein." : `${n} Fragen beziehen das Publikum ein.` };
    return { key: "fragen", tone: "tipp", text: "Noch keine Frage im Text. Eine rhetorische Frage bezieht das Publikum ein." };
  },
  dank: ({ ps, words }) => {
    if (words < 150) return null;
    if (/dank/i.test(lastOf(ps, 2))) return { key: "dank", tone: "gut", text: "Am Schluss bedankst du dich fürs Zuhören." };
    return { key: "dank", tone: "info", text: "Viele Reden enden mit einem Dank fürs Zuhören." };
  },
  eigeneWorte: ({ doc, v, lines }) => {
    const copied = copiedPassages(doc, lines, v.title);
    if (!copied.length) return { key: "eigeneWorte", tone: "gut", text: "Keine längere Stelle steht wörtlich in der Textbeilage: Du schreibst in eigenen Worten." };
    return { key: "eigeneWorte", tone: "tipp", text: `Diese ${copied.length === 1 ? "Stelle steht" : "Stellen stehen"} wörtlich in der Textbeilage: ${copied.slice(0, 3).map((c) => `„${short(c, 50)}“`).join(", ")}${copied.length > 3 ? " …" : ""}. Schreib in eigenen Worten.` };
  },
  meinung: ({ ps }) => {
    const text = unquoted(ps.join("\n"));
    const m = MEINUNG.exec(text);
    if (!m) return { key: "meinung", tone: "gut", text: "Du bleibst sachlich, ohne eigene Meinung." };
    return { key: "meinung", tone: "tipp", text: `In einer Zusammenfassung steht keine eigene Meinung. Prüf diese Stelle: „${around(text, m.index, m[0].length)}“` };
  },
  konjunktiv: ({ ps, words }) => {
    if (words < 100) return null;
    if (KONJUNKTIV.test(unquoted(ps.join("\n")))) return { key: "konjunktiv", tone: "gut", text: "Fremde Aussagen stehen im Konjunktiv (sei, habe, könne …)." };
    return { key: "konjunktiv", tone: "tipp", text: "Ich finde keinen Konjunktiv. Was der Text sagt, gibst du im Konjunktiv I wieder: „Die Autorin meint, das Projekt sei …“" };
  },
  forderung: ({ ps, words }) => {
    if (words < 120) return null;
    if (FORDERUNG.test(ps.slice(Math.floor(ps.length / 2)).join("\n"))) return { key: "forderung", tone: "gut", text: "Eine Forderung ist da." };
    return { key: "forderung", tone: "tipp", text: "Ich finde keine Forderung, z. B. „Wir fordern Sie auf, …“ oder „Wir bitten Sie, …“. Ein offener Brief endet mit einer konkreten Forderung." };
  },
  empfehlung: ({ ps, words }) => {
    if (words < 120) return null;
    if (EMPFEHLUNG.test(lastOf(ps, 2))) return { key: "empfehlung", tone: "gut", text: "Am Schluss steht eine klare Empfehlung." };
    return { key: "empfehlung", tone: "tipp", text: "Am Schluss finde ich keine klare Empfehlung, z. B. „Ich empfehle …“ oder „Es lohnt sich, …“." };
  },
};

/**
 * Hinweise on a written text, without KI: the length against the target, then what the Textsorte needs (Bezug,
 * Anrede, Grußformel, Überschrift, Begründungen, eigene Worte, Zitate with line numbers …), then the paragraphs.
 * They only point at things to look at again and never call a right text wrong.
 */
export function hinweiseFor(doc: TextDoc, v: AuftragView): SchreibHinweis[] {
  const lines = numberedLines(v.text, v.countBlank);
  if (v.sorte === "textinterpretation") return hinweise(doc, { title: v.title, author: v.author, target: v.target, lines });
  const s = SORTEN[v.sorte];
  const target = cleanTarget(v.target, s.target);
  const words = countWords(doc);
  const out: SchreibHinweis[] = [umfangHinweis(words, target)];
  if (words < 20) return out;
  const c: Ctx = { doc, words, ps: paragraphs(doc), v, s, lines };
  for (const check of s.checks) {
    if (check === "zitate") out.push(...zitatHinweise(doc, words, { title: v.title, medium: v.medium, lines }));
    else {
      const h = CHECKS[check](c);
      if (h) out.push(h);
    }
  }
  out.push(absaetzeHinweis(doc, words, target, s.absaetze));
  return out;
}

// ---------- the example of a Textsorte ----------

/** The Lernheft's own example: a Textbeilage (or story) and a model text, part by part. */
export type Beispiel = { beilage: Omit<AuftragView, "sorte" | "target" | "situation" | "countBlank">; situation: string; teile: { key: string; title: string; text: string }[] };

export function beispielFor(sorte: SorteKey): Beispiel {
  if (sorte === "textinterpretation") {
    return {
      beilage: { title: BEISPIEL_TITEL, author: BEISPIEL_AUTORIN, year: BEISPIEL_JAHR, medium: "", kind: "Kurzgeschichte", text: BEISPIEL_GESCHICHTE },
      situation: "",
      teile: BEISPIEL_INTERPRETATION.map((p) => ({ key: p.teil, title: TEIL_TITLES[p.teil], text: p.text })),
    };
  }
  const b = BEISPIELE[sorte];
  const titles = Object.fromEntries(SORTEN[sorte].parts.map((p) => [p.key, p.title]));
  return { beilage: b.beilage, situation: b.situation, teile: b.teile.map((t) => ({ key: t.teil, title: titles[t.teil] ?? t.teil, text: t.text })) };
}

/** The model text as one text: a paragraph per line (a letter's Betreff, Anrede and Gruß on their own lines). */
export const beispielText = (sorte: SorteKey) => beispielFor(sorte).teile.map((t) => t.text).join("\n");

// ---------- Teilübungen: one part of a Schreibauftrag at a time ----------

/** What Teilübungen are about: the Textbeilage with its numbered lines and, for the example, the model answers. */
export type AuftragQuelle = { sorte: SorteKey; title: string; author: string; year: string; medium: string; kind: string; text: string; countBlank: boolean; samples?: Partial<Record<string, string>> };

/** The example of a Textsorte as source of Teilübungen, with the model text as samples. */
export function beispielQuelle(sorte: SorteKey): AuftragQuelle {
  if (sorte === "textinterpretation") return { sorte, medium: "", ...BEISPIEL_QUELLE };
  const b = beispielFor(sorte);
  return { sorte, ...b.beilage, countBlank: false, samples: Object.fromEntries(b.teile.map((t) => [t.key, t.text])) };
}

/** At most this many Teilübungen per exercise and Textsorte: every part twice. */
export const maxTeiluebungen = (sorte: SorteKey) => (sorte === "textinterpretation" ? MAX_TEILUEBUNGEN : SORTEN[sorte].parts.length * 2);

const TEIL_PROMPTS: ((s: Sorte, p: Teil, ref: string, words: number) => string)[] = [
  (s, p, ref, words) => `Schreib den Teil „${p.title}“ ${s.eines} zu ${ref}. ${p.hint} (etwa ${words} Wörter)`,
  (s, p, ref, words) => `Übe einen Teil ${s.eines}: Schreib nur „${p.title}“ zu ${ref}, in etwa ${words} Wörtern. Achte auf: ${p.criteria.join(", ")}.`,
];

/**
 * One Teilübung: a free answer about one part of the Schreibplan, with the Textbeilage as shared text with line
 * numbers (data.passage, data.zeilen). Its Erwartungshorizont says what a good part has; for the example the
 * model text gives the sample answer.
 */
export function auftragTeiluebung(q: AuftragQuelle, teil: string, variant = 0, o: { skillId?: string; difficulty?: TaskDraft["difficulty"] } = {}): TaskDraft | null {
  const s = SORTEN[q.sorte];
  const p = s.parts.find((x) => x.key === teil);
  if (!p) return null;
  const words = round5(s.target * p.share);
  const ref = beilageReference(q);
  const prompt = TEIL_PROMPTS[((variant % TEIL_PROMPTS.length) + TEIL_PROMPTS.length) % TEIL_PROMPTS.length](s, p, ref, words);
  const skillId = o.skillId ?? s.skill;
  return {
    type: "free",
    skillId,
    skillIds: [skillId],
    category: "offen",
    difficulty: o.difficulty ?? "mittel",
    prompt,
    data: { passage: cleanStory(q.text), passageTitle: ref, lines: Math.min(16, Math.max(4, Math.ceil(words / 9) + 1)), zeilen: true, ...(q.countBlank ? { leerzeilen: true } : {}), teil: p.key, textsorte: q.kind, schreibsorte: q.sorte },
    answer: { sample: q.samples?.[p.key]?.trim() ?? "", criteria: [...p.criteria] },
    solution: "",
    hints: [p.hint],
    errorMap: [],
    sourceType: "eigen",
  };
}

/** n Teilübungen in the order of the Schreibplan, the second round with the other wording; the Textinterpretation's own for it. */
export function teiluebungenFor(q: AuftragQuelle, n: number, o: { skillId?: string; difficulty?: TaskDraft["difficulty"] } = {}): TaskDraft[] {
  if (q.sorte === "textinterpretation") return teiluebungen({ title: q.title, author: q.author, year: q.year, kind: storyKind(q.kind), text: q.text, countBlank: q.countBlank, samples: q.samples }, n, o);
  const parts = SORTEN[q.sorte].parts;
  return Array.from({ length: Math.max(0, n) }, (_, k) => auftragTeiluebung(q, parts[k % parts.length].key, Math.floor(k / parts.length), o)!);
}

/** The Textbeilage of a Teilübung, read back from the task (title, author, medium and date from its heading). */
export function quelleFromTask(t: Pick<TaskDraft, "data">): AuftragQuelle | null {
  const sorte = t.data.schreibsorte;
  const text = t.data.passage?.trim();
  if (!isSorte(sorte) || sorte === "textinterpretation" || !text || !t.data.teil) return null;
  const ref = t.data.passageTitle?.trim() ?? "";
  const title = ref.match(/^„(.+?)“/)?.[1] ?? ref;
  const author = ref.match(/“\s+von\s+(.+?)(?:\s+\([^()]*\))?$/)?.[1] ?? "";
  const where = ref.match(/\(([^()]+)\)$/)?.[1] ?? "";
  // "(Medium, Datum)", "(Medium)" or "(Datum)": a date ends with its year
  const cut = where.indexOf(", ");
  const [medium, year] = cut >= 0 ? [where.slice(0, cut), where.slice(cut + 2)] : /\d{4}$/.test(where) ? ["", where] : [where, ""];
  const ex = beispielQuelle(sorte);
  const example = cleanStory(text) === cleanStory(ex.text);
  return { sorte, title, author, year, medium, kind: t.data.textsorte ?? SORTEN[sorte].defaultKind, text, countBlank: Boolean(t.data.leerzeilen), ...(example ? { samples: ex.samples } : {}) };
}

/** "Neu erstellen" on a Teilübung: the other wording for the same part, about the same text. */
export function nextTeiluebungFor(t: Pick<TaskDraft, "data" | "prompt" | "skillId" | "difficulty">): TaskDraft | null {
  if (!t.data.schreibsorte) return nextTeiluebung(t);
  const q = quelleFromTask(t);
  const teil = t.data.teil;
  if (!q || !teil) return null;
  const now = TEIL_PROMPTS.map((_, v) => auftragTeiluebung(q, teil, v)?.prompt).indexOf(t.prompt);
  return auftragTeiluebung(q, teil, now + 1, { skillId: t.skillId ?? undefined, difficulty: t.difficulty });
}
