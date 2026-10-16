/**
 * KI-Einträge für die Aufgabenbanken (`data/banks/`, Phase 1 des Merges, Schritt 6).
 *
 * Die drei Vorlagen aus `Artikel Trainer/AI_prompts.md` (Artikel, Adjektivdeklination, Präpositionen)
 * stehen hier als aufgabenbezogene Anweisungen, dazu drei weitere für die übrigen Banken aus Phase 1
 * (Präteritum, Perfekt, Hauptsatz/Gliedsatz) und die schon vorhandene das/dass-Bank. Jede Anweisung
 * verlangt genau die Form, die das Bankschema in `lib/banks.ts` vorschreibt: ein KI-Eintrag, der nicht
 * dazu passt, wird verworfen und nicht zu einer Aufgabe.
 *
 * Unterschiede zur Vorlage in `AI_prompts.md` (bewusst, weil die Bank das Feld nicht kennt):
 *   - Artikel: zusätzlich `tags` (die Bank verlangt mindestens ein Thema).
 *   - Adjektivdeklination: das Feld `translation` heißt in der Bank `solution` (es enthält den
 *     vollständigen Lösungssatz, nicht eine Übersetzung — so schon beim Import, §3.1 des Plans).
 *   - Präpositionen: `noun_color` entfällt (D10: die Genus-Farbe kommt aus `components/genus.ts`),
 *     dafür stehen `article` (Genus des Nomens) und `kasus` (Dativ/Akkusativ) im Eintrag, und
 *     `translation` heißt `solution`.
 *
 * Ablauf: `buildBankPrompt()` baut den Auftrag (ohne die API zu rufen, damit er prüfbar ist),
 * `generateBankItemsWithAI()` holt die Einträge über `lib/ai/router.ts` (Feature-Schlüssel `aufgaben`,
 * kein neuer KI-Bereich, keine neue Route), `parseAiBankItem()` prüft jeden Eintrag gegen das
 * Bankschema, `aiBankItemToDraft()` macht daraus eine Aufgabe. Der Genus-Abgleich der Artikel-Einträge
 * läuft über `lib/german-nouns.ts` und nur, wenn das Modell ein Geschlecht angibt: geraten wird nie.
 */
import { z } from "zod";
import { bankItemTask } from "../generators";
import { genusMarker, parseNoun, type Genus } from "../german-nouns";
import { gapCount } from "../tasks";
import type { Difficulty } from "../curriculum";
import type { TaskDraft } from "../tasks";
import {
  adjektivdeklinationItemSchema,
  artikelItemSchema,
  clozeItemSchema,
  dasDassItemSchema,
  hauptsatzGliedsatzItemSchema,
  praepositionenItemSchema,
  type BankId,
  type BankItem,
  type BankTypes,
} from "../banks";
import { runAI, type AIMeta } from "./router";

// ---------- welche Bank welche Fähigkeit füttert ----------

/** Die sechs Fähigkeiten aus Phase 1 und die schon vorhandene das/dass-Fähigkeit. */
export const BANK_SKILL: Record<BankId, string> = {
  artikel: "deutsch.grammatik.artikel",
  adjektivdeklination: "deutsch.grammatik.adjektivdeklination",
  praepositionen: "deutsch.grammatik.praepositionen",
  praeteritum: "deutsch.grammatik.praeteritum",
  perfekt: "deutsch.grammatik.perfekt",
  "das-dass": "deutsch.recht.dasdass",
  "hauptsatz-gliedsatz": "deutsch.satz.hauptsatz-gliedsatz",
};

/** Die Fähigkeiten, für die es eine Bank gibt (und damit KI-Einträge in Bankform). */
export const BANK_SKILL_IDS = Object.values(BANK_SKILL);

/** Umgekehrt: welche Bank gehört zu dieser Fähigkeit? */
export function bankOfSkill(skillId: string): BankId | null {
  return (Object.keys(BANK_SKILL) as BankId[]).find((id) => BANK_SKILL[id] === skillId) ?? null;
}

export const ARTIKEL_ARTICLES = ["der", "die", "das"] as const;

// ---------- die Anweisungen ----------

/** Rolle und Grundregeln; gilt für jede Bank. */
export const BANK_SYSTEM = `Du füllst die Aufgabenbanken einer österreichischen Nachhilfe-Software.
Du bist Experte für deutsche Sprache und für Deutsch als Fremdsprache (DaF) und erstellst digitales Lehrmaterial.
Antworte ausschließlich mit einem JSON-Array. Kein Einleitungstext, keine Erklärungen, keine Markdown-Code-Blöcke, keine Kommentare.
Halte die vorgegebene Form Zeichen für Zeichen ein: nur die genannten Felder, keine zusätzlichen Felder, keine fehlenden Pflichtfelder.
Alle Sätze sind grammatisch korrekt, alltagsnah und logisch sinnvoll; jede Lösung ist eindeutig.
Verwende österreichische Begriffe (Klasse, Hausübung, Schularbeit, Jänner) und die österreichische Rechtschreibung (ß).`;

/**
 * Artikel bestimmen — aus `AI_prompts.md` übernommen, ergänzt um `tags` (die Bank verlangt ein Thema).
 * `article` ist zugleich die Geschlechtsangabe: sie wird gegen `lib/german-nouns.ts` geprüft.
 */
export const ARTIKEL_ANWEISUNG = `Rolle: Du bist ein Experte für die deutsche Sprache und Datenstrukturierung.
Aufgabe: Erstelle eine Liste deutscher Substantive.
Anforderungen:
- Die Wörter sind eine Mischung aus den Artikeln "der", "die" und "das".
- Wähle Wörter, die für das Thema typisch sind (Niveau A1 bis B2).
- Jedes Wort muss eine präzise englische Übersetzung haben. Bitte kein Plural!
- Hole dir keine Wörter aus anderen Quellen: die Liste ist neu von dir zusammengestellt.
Formatierung: Gib das Ergebnis ausschließlich als valides JSON-Array aus. Nutze exakt diese Struktur für jedes Objekt:
{
  "word": "Beispielwort",
  "article": "der",
  "translation": "example word",
  "tags": ["Thema"]
}
"article" ist der bestimmte Artikel im Nominativ: "der", "die" oder "das" — kein Plural, kein "ein".
"tags" enthält genau das vorgegebene Thema.
Wichtig: Gib keinen Einleitungstext, keine Erklärungen und keine Markdown-Code-Blöcke aus – nur den reinen JSON-Inhalt.`;

/**
 * Adjektivdeklination — aus `AI_prompts.md` übernommen; das Feld `translation` der Vorlage heißt in der
 * Bank `solution` (der vollständige Lösungssatz).
 */
export const ADJEKTIVDEKLINATION_ANWEISUNG = `Rolle: Du bist ein Experte für Deutsch als Fremdsprache (DaF) und spezialisiert auf die Erstellung von Lehrmaterialien.
Aufgabe: Erstelle Übungssätze zur deutschen Adjektivdeklination. Jeder Satz muss zwei Lücken haben: eine für die Adjektivendung und eine für die Nomen-Endung (insbesondere für Genitiv -s/-es oder n-Deklination).
Anforderungen an die Sätze:
- Die Kombination aus Adjektiv und Nomen muss logisch sinnvoll sein.
- Variiere zwischen bestimmtem, unbestimmtem und Nullartikel.
- Die Sätze haben ein mittleres Sprachniveau (A1/A2/B1/B2).
Technisches Format (strikt einhalten), JSON-Array aus Objekten mit diesem Aufbau:
- prefix: Der Teil des Satzes bis zur ersten Lücke (inkl. Adjektivstamm).
- middle: Der Teil zwischen den beiden Lücken (meist der Wortstamm des Nomens).
- suffix: Der Rest des Satzes.
- options1: 4 Optionen für das Adjektiv (z. B. ["-e", "-er", "-en", "-em"]).
- correct1: Die richtige Endung für das Adjektiv; sie muss in options1 vorkommen.
- options2: 4 Optionen für das Nomen (z. B. ["-", "-e", "-en", "-s"]). Nutze "-" für "keine Endung".
- correct2: Die richtige Endung für das Nomen; sie muss in options2 vorkommen.
- solution: Der vollständige, korrekte Satz (prefix + richtige Endungen + middle + suffix).
Beispiel:
{
  "prefix": "Wegen des stark",
  "middle": " Regen",
  "suffix": " wurde das Spiel abgesagt.",
  "options1": ["-e", "-er", "-en", "-em"],
  "correct1": "-en",
  "options2": ["-", "-e", "-en", "-s"],
  "correct2": "-s",
  "solution": "Wegen des starken Regens wurde das Spiel abgesagt."
}`;

/**
 * Präpositionen — aus `AI_prompts.md` übernommen. `noun_color` der Vorlage entfällt: die Genus-Farbe
 * kommt aus `components/genus.ts` (D10). Dafür steht das Geschlecht als `article` im Eintrag und der
 * Kasus als `kasus`.
 */
export const PRAEPOSITIONEN_ANWEISUNG = `Rolle: Du bist ein Experte für Deutsch als Fremdsprache (DaF) und erstellst digitales Lehrmaterial für ein Nachhilfeinstitut.
Aufgabe: Erstelle eine Übung zu deutschen Präpositionen (insbesondere Wechselpräpositionen und lokale Präpositionen). Jeder Satz hat genau eine Lücke für den korrekten Artikel.
Anforderungen an die Grammatik:
- Die Sätze sind alltagsnah und logisch sinnvoll.
- Es wird immer der Kasus (Dativ oder Akkusativ) nach der Präposition geübt.
- Der Artikel in der Lücke passt zum Nomen und zum verlangten Kasus.
Technisches Format (strikt einhalten), JSON-Array aus Objekten mit diesem Aufbau:
- prefix: Der Teil des Satzes vor der Lücke (endet mit der Präposition).
- noun: Das Nomen, das nach der Lücke folgt (ohne Artikel).
- article: Das Genus des Nomens als bestimmter Artikel im Nominativ: "der", "die" oder "das".
- suffix: Der Rest des Satzes nach dem Nomen (z. B. ein Punkt oder weitere Satzteile).
- options: genau 4 Antwortmöglichkeiten (z. B. ["dem", "der", "den", "das"]).
- correct: Die exakt richtige Antwort; sie muss in options vorkommen und der einzige richtige Artikel sein.
- kasus: "Dativ" oder "Akkusativ" — der Fall, den die Präposition hier verlangt.
- solution: Der vollständige korrekte Satz.
Beispiel:
{
  "prefix": "Das Buch liegt auf ",
  "noun": "Tisch",
  "article": "der",
  "suffix": ".",
  "options": ["dem", "der", "das", "den"],
  "correct": "dem",
  "kasus": "Dativ",
  "solution": "Das Buch liegt auf dem Tisch."
}`;

/** Präteritum — Bankform `ClozeItem`: eine Lücke je Verbform, dazu Lösung und Hilfe. */
export const PRAETERITUM_ANWEISUNG = `Rolle: Du bist ein Experte für deutsche Grammatik und erstellst Übungssätze zum Präteritum.
Aufgabe: Erstelle Lückensätze, in denen genau eine Verbform im Präteritum einzusetzen ist (ein bis zwei Lücken je Satz, jede Lücke ist ___).
Anforderungen:
- Jeder Satz ist ein vollständiger, alltagsnaher Satz mit klarem Zeitbezug (gestern, früher, damals …).
- Gemischt werden starke Verben (ging, fuhr, las, schrieb) und schwache Verben (lernte, spielte, arbeitete).
- Die Lösung ist eindeutig; dort, wo mehrere Formen richtig wären, gib alle in der Lösung an.
Technisches Format (strikt einhalten), JSON-Array aus Objekten:
- q: der Satz mit ___ für jede Lücke; die Anzahl der ___ ist genau die Anzahl der Lücken.
- blanks: ein Array je Lücke, jede Lücke ist ein Array mit allen akzeptierten Schreibweisen, z. B. [["ging"], ["fuhr", "ist gefahren"]].
- solution: der vollständige richtige Satz, kurz begründet (z. B. "lesen ist stark: er las").
- hint: eine Hilfe, die an die Regel erinnert, ohne die Lösung zu verraten.
- errors (optional): typische falsche Formen als Schlüssel und der Denkfehler dahinter als Text, z. B. {"gehte": "schwache Form bei starkem Verb"}.`;

/** Perfekt — Bankform `ClozeItem`; das Hilfsverb ist Teil der Lücke. */
export const PERFEKT_ANWEISUNG = `Rolle: Du bist ein Experte für deutsche Grammatik und erstellst Übungssätze zum Perfekt.
Aufgabe: Erstelle Lückensätze im Perfekt (haben oder sein + Partizip II). Ein bis zwei Lücken je Satz, jede Lücke ist ___.
Anforderungen:
- Bewegungs- und Zustandsverben bilden das Perfekt mit "sein" (ich bin gegangen, ich bin gewesen), alle anderen mit "haben".
- Steht das Hilfsverb und das Partizip II getrennt, bekommt jede Stelle eine eigene Lücke (z. B. "Wir ___ gestern lange ___." mit blanks [["haben"], ["gelernt"]]).
- Der Satz ist vollständig, alltagsnah und hat einen klaren Zeitbezug (gestern, letzten Sommer, schon …).
Technisches Format (strikt einhalten), JSON-Array aus Objekten:
- q: der Satz mit ___ für jede Lücke; die Anzahl der ___ ist genau die Anzahl der Lücken.
- blanks: ein Array je Lücke, jede Lücke ist ein Array mit allen akzeptierten Schreibweisen.
- solution: der vollständige richtige Satz, kurz begründet (z. B. "gehen bildet das Perfekt mit sein: wir sind gegangen").
- hint: eine Hilfe, die an die Regel erinnert, ohne die Lösung zu verraten.
- errors (optional): typische falsche Formen als Schlüssel und der Denkfehler dahinter als Text, z. B. {"hat gefahren": "falsches Hilfsverb"}.`;

/** das/dass — Bankform `ClozeItem` plus die Begründung aus der Quelle. */
export const DAS_DASS_ANWEISUNG = `Rolle: Du bist ein Experte für deutsche Rechtschreibung und erstellst Übungen zu das/dass.
Aufgabe: Erstelle Sätze, in denen "das" oder "dass" einzusetzen ist. Ein bis zwei Lücken je Satz, jede Lücke ist ___.
Anforderungen:
- "das" ist Artikel oder Pronomen und lässt sich durch "dieses", "welches" oder "jenes" ersetzen.
- "dass" ist eine Konjunktion und leitet einen Nebensatz ein; vor "dass" steht ein Beistrich.
- Beide Fälle kommen vor; prüfe bei jedem Satz die Ersatzprobe.
- Der Satz ist vollständig, alltagsnah und in österreichischer Schreibweise.
Technisches Format (strikt einhalten), JSON-Array aus Objekten:
- q: der Satz mit ___ für jede Lücke; die Anzahl der ___ ist genau die Anzahl der Lücken.
- blanks: ein Array je Lücke, jede Lücke ist ein Array mit allen akzeptierten Schreibweisen, z. B. [["dass"]].
- solution: der vollständige richtige Satz.
- hint: eine Hilfe (Ersatzprobe mit "dieses/welches"), ohne die Lösung zu verraten.
- explanation: die Begründung, warum "das" oder "dass" richtig ist, in einem Satz.
- errors (optional): typische falsche Formen als Schlüssel und der Denkfehler dahinter als Text, z. B. {"das": "Ersatzprobe mit „dieses“ nicht möglich"}.`;

/** Hauptsatz und Gliedsatz — Bankform: der Satz in genau zwei Teilen, genau einer ist der Gliedsatz. */
export const HAUPTSATZ_GLIEDSATZ_ANWEISUNG = `Rolle: Du bist ein Experte für deutsche Satzlehre und erstellst Übungen zu Hauptsatz und Gliedsatz.
Aufgabe: Zerlege jeweils einen Satz in genau zwei Teile: einen Hauptsatz (HS) und einen Gliedsatz (GS).
Anforderungen:
- Der Hauptsatz kann allein stehen, das gebeugte Verb steht an zweiter Stelle.
- Der Gliedsatz kann nicht allein stehen, wird von einer Konjunktion (weil, dass, wenn, obwohl, der/die/das …) eingeleitet und hat das gebeugte Verb am Ende.
- Aneinandergereiht ergeben die beiden Teile den vollständigen, richtigen Satz (Beistrichstellung beachten).
- Der Gliedsatz darf nicht am Anfang stehen, damit die Zuordnung eindeutig bleibt.
Technisches Format (strikt einhalten), JSON-Array aus Objekten:
- parts: genau zwei Objekte in der Reihenfolge des Satzes, jedes mit "text" (der Satzteil ohne führenden oder abschließenden Beistrich, Leerzeichen am Rand vermeiden) und "type" ("HS" oder "GS").
- Genau ein Teil hat "type": "HS", der andere "GS".
Beispiel:
{
  "parts": [
    { "text": "Ich gehe heute früh schlafen", "type": "HS" },
    { "text": "weil ich morgen eine Schularbeit habe", "type": "GS" }
  ]
}`;

/** Die Anweisung je Bank; exportiert, damit ein Test den Inhalt ohne API prüfen kann. */
export const BANK_ANWEISUNG: Record<BankId, string> = {
  artikel: ARTIKEL_ANWEISUNG,
  adjektivdeklination: ADJEKTIVDEKLINATION_ANWEISUNG,
  praepositionen: PRAEPOSITIONEN_ANWEISUNG,
  praeteritum: PRAETERITUM_ANWEISUNG,
  perfekt: PERFEKT_ANWEISUNG,
  "das-dass": DAS_DASS_ANWEISUNG,
  "hauptsatz-gliedsatz": HAUPTSATZ_GLIEDSATZ_ANWEISUNG,
};

// ---------- der Auftrag ----------

export type BankPromptRequest = {
  /** Wie viele Einträge das Modell liefern soll. */
  count: number;
  /** Thema in wenigen Worten, z. B. „Küche" oder „Wechselpräpositionen mit Akkusativ". */
  topic?: string;
  /** Einträge, die es schon gibt, in Kurzform; neue müssen andere sein. */
  avoid?: string[];
};

/** Der Auftrag für das Modell; getrennt, damit er ohne API-Aufruf geprüft werden kann. */
export function buildBankPrompt(id: BankId, req: BankPromptRequest): string {
  const thema = req.topic?.trim();
  return `${BANK_ANWEISUNG[id]}

Erstelle jetzt ${req.count} ${req.count === 1 ? "Eintrag" : "Einträge"}${thema ? ` zum Thema „${thema}“` : ""}.
Das Feld "tags" enthält${thema ? ` genau "${thema}"` : " das Thema"}.${req.avoid?.length ? `\nDiese Einträge gibt es schon, mach andere:\n${req.avoid.slice(0, 20).map((a) => `- ${a.slice(0, 160)}`).join("\n")}` : ""}
Antworte ausschließlich mit dem JSON-Array.`;
}

// ---------- Prüfung gegen das Bankschema ----------

/** Das Schema eines einzelnen Bankeintrags — dieselbe Quelle wie für die Dateien. */
const ITEM_SCHEMAS: Record<BankId, z.ZodType> = {
  artikel: artikelItemSchema,
  adjektivdeklination: adjektivdeklinationItemSchema,
  praepositionen: praepositionenItemSchema,
  praeteritum: clozeItemSchema,
  perfekt: clozeItemSchema,
  "das-dass": dasDassItemSchema,
  "hauptsatz-gliedsatz": hauptsatzGliedsatzItemSchema,
};

export function bankItemSchema(id: BankId): z.ZodType {
  return ITEM_SCHEMAS[id];
}

/** Das Schema für die Antwort des Modells: ein Array von Bankeinträgen. */
export function bankArraySchema(id: BankId) {
  return z.array(ITEM_SCHEMAS[id]);
}

/**
 * Was das Modell für Artikel-Einträge liefern darf: die Form der Bank plus ein Feld `genus`.
 * Das Geschlecht darf auch als Kürzel kommen (m, f, n, maskulin …, oder als Artikel selbst) — geprüft
 * wird es in jedem Fall gegen `lib/german-nouns.ts`. Fehlt es ganz, wird nichts geraten.
 */
const artikelKiSchema = z
  .object({
    word: z.string().min(1),
    article: z.enum(ARTIKEL_ARTICLES).nullable().optional(),
    genus: z.string().min(1).nullable().optional(),
    translation: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ARTICLE_GENUS: Record<"der" | "die" | "das", Genus> = { der: "m", die: "f", das: "n" };
const isArticle = (v: unknown): v is "der" | "die" | "das" => typeof v === "string" && (ARTIKEL_ARTICLES as readonly string[]).includes(v.trim().toLowerCase());
const asArticle = (v: unknown): "der" | "die" | "das" | null => (isArticle(v) ? (v.trim().toLowerCase() as "der" | "die" | "das") : null);

/**
 * Liest ein Geschlechtskürzel mit `lib/german-nouns.ts`: dessen öffentliche Notation für ein Kürzel ist
 * „Wort (m)". Eine eigene Tabelle gibt es hier nicht — german-nouns ist die einzige Quelle.
 */
const genusFromMarker = (marker: string): Genus | null => parseNoun(`Wort (${marker.trim()})`).genus;

export type ArtikelGenusErgebnis =
  /** Geschlecht angegeben und in sich stimmig; `article` ist der Artikel dazu. */
  | { status: "ok"; word: string; genus: Genus; article: "der" | "die" | "das"; /** true = der Artikel wurde erst aus dem Geschlecht gebildet */ abgeleitet: boolean }
  /** Kein Geschlecht angegeben: nichts geprüft und nichts geraten. */
  | { status: "ohne"; word: string }
  /** Zwei Angaben widersprechen einander, oder das Nomen steht im Plural. */
  | { status: "widerspruch"; word: string; reason: string };

/**
 * Der Genus-Abgleich eines Artikel-Eintrags gegen `lib/german-nouns.ts` (Phase 1, Schritt 6).
 *
 * `german-nouns` hat bewusst kein Wörterbuch: es kennt ein Nomen genau so weit, wie die Eingabe sein
 * Geschlecht mitteilt („der Hund", „Hund (m)", „die Kinder (pl)"). Gibt das Modell ein Geschlecht an,
 * liest german-nouns es und bildet daraus den Artikel zurück — stimmt das nicht mit der Angabe des
 * Modells überein (oder steht das Nomen im Plural, den die Bank nicht kennt), wird der Eintrag
 * verworfen. Gibt das Modell kein Geschlecht an, wird keines erfunden und nichts geprüft.
 */
export function artikelGenusAbgleich(raw: unknown): ArtikelGenusErgebnis {
  const o = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rohWort = typeof o.word === "string" ? o.word : "";
  const wort = parseNoun(rohWort);
  const word = wort.noun.trim() || rohWort.trim();

  // Jede Angabe, die ein Geschlecht mitteilt: das Nomen selbst, ein Feld `genus`, ein Feld `article`.
  const angaben: { wo: string; genus: Genus }[] = [];
  if (wort.genus !== null) angaben.push({ wo: `„${rohWort.trim()}“`, genus: wort.genus });
  const ausGenusArtikel = asArticle(o.genus);
  const ausGenus = ausGenusArtikel ? ARTICLE_GENUS[ausGenusArtikel] : typeof o.genus === "string" ? genusFromMarker(o.genus) : null;
  if (ausGenus !== null) angaben.push({ wo: `genus „${typeof o.genus === "string" ? o.genus.trim() : ""}“`, genus: ausGenus });
  const article = asArticle(o.article);
  if (article !== null) angaben.push({ wo: `article „${article}“`, genus: ARTICLE_GENUS[article] });

  // Kein Geschlecht angegeben: nicht raten, nicht prüfen.
  if (!angaben.length) return { status: "ohne", word };

  const bekannt = [...new Set(angaben.map((a) => a.genus))];
  if (bekannt.includes("plural")) {
    const wer = angaben.filter((a) => a.genus === "plural").map((a) => a.wo).join(", ");
    return { status: "widerspruch", word, reason: `${wer}: Plural — die Bank kennt nur der, die und das` };
  }
  if (bekannt.length > 1) {
    const wer = angaben.map((a) => `${a.wo} → ${genusMarker(a.genus)}`).join(", aber ");
    return { status: "widerspruch", word, reason: `Genus widersprüchlich: ${wer}` };
  }
  const genus = bekannt[0];
  return { status: "ok", word, genus, article: genusMarker(genus) as "der" | "die" | "das", abgeleitet: article === null };
}

export type BankItemParse<K extends BankId> = { ok: true; item: BankItem<K> } | { ok: false; error: string };

const firstIssue = (e: z.ZodError) => {
  const first = e.issues[0];
  const where = first?.path.length ? ` bei ${first.path.join(".")}` : "";
  return `${where}: ${first?.message ?? "unbekannter Fehler"}`.replace(/^: /, "");
};

/**
 * Prüft einen KI-Eintrag gegen das Bankschema — und darüber hinaus gegen dieselben Zusagen, die
 * `lib/banks.test.ts` für die Dateien prüft (Lückenzahl, `correct` in den Optionen). Ein Eintrag, der
 * hier nicht durchkommt, wird verworfen und nicht zu einer Aufgabe.
 */
export function parseAiBankItem<K extends BankId>(id: K, raw: unknown): BankItemParse<K> {
  const no = (error: string): BankItemParse<K> => ({ ok: false, error });
  let kandidat: unknown = raw;

  if (id === "artikel") {
    const abgleich = artikelGenusAbgleich(raw);
    if (abgleich.status === "widerspruch") return no(abgleich.reason);
    const vorpruefung = artikelKiSchema.safeParse(raw);
    if (!vorpruefung.success) return no(firstIssue(vorpruefung.error));
    const d = vorpruefung.data;
    if (abgleich.status === "ohne") return no("kein Geschlecht angegeben (article fehlt) — es wird keines geraten");
    kandidat = { word: abgleich.word, article: abgleich.article, ...(d.translation ? { translation: d.translation } : {}), tags: d.tags };
  }

  const parsed = ITEM_SCHEMAS[id].safeParse(kandidat);
  if (!parsed.success) return no(firstIssue(parsed.error));
  const item = parsed.data as BankItem<K>;

  const fachlich = fachlichePruefung(id, item as BankTypes[BankId]);
  return fachlich ? no(fachlich) : { ok: true, item };
}

/** Die Zusagen, die `lib/banks.test.ts` für die Bankdateien prüft — hier für einzelne KI-Einträge. */
function fachlichePruefung(id: BankId, item: BankTypes[BankId]): string | null {
  if (id === "praeteritum" || id === "perfekt" || id === "das-dass") {
    const i = item as BankTypes["praeteritum"];
    const gaps = gapCount(i.q);
    return gaps === i.blanks.length ? null : `${gaps} Lücken im Satz, aber ${i.blanks.length} Lösungen`;
  }
  if (id === "adjektivdeklination") {
    const i = item as BankTypes["adjektivdeklination"];
    if (!i.options1.includes(i.correct1)) return `correct1 „${i.correct1}“ fehlt in options1`;
    return i.options2.includes(i.correct2) ? null : `correct2 „${i.correct2}“ fehlt in options2`;
  }
  if (id === "praepositionen") {
    const i = item as BankTypes["praepositionen"];
    return i.options.includes(i.correct) ? null : `correct „${i.correct}“ fehlt in options`;
  }
  return null;
}

// ---------- aus KI-Einträgen werden Aufgaben ----------

export type BankDraftOptions = {
  difficulty: Difficulty;
  /** Warum ein Eintrag verworfen wurde (für den KI-Selbsttest und das Protokoll). */
  why?: (reason: string) => void;
  rng?: () => number;
};

/**
 * Wie `aiTaskToDraft` (lib/ai/features.ts), nur für Bankeinträge: prüft den Eintrag gegen das
 * Bankschema und den Genus-Abgleich und macht daraus eine Aufgabe. Ein unbrauchbarer Eintrag wird
 * verworfen (null) und gemeldet, nie in eine andere Form umgebogen.
 */
export function aiBankItemToDraft<K extends BankId>(id: K, raw: unknown, o: BankDraftOptions): TaskDraft | null {
  const parsed = parseAiBankItem(id, raw);
  if (!parsed.ok) {
    o.why?.(`${id}: ${parsed.error}`);
    return null;
  }
  const draft = bankItemTask(id, parsed.item, o.difficulty, o.rng ?? Math.random);
  return draft ? { ...draft, sourceType: "ki" } : null;
}

/** Alle Einträge einer Antwort prüfen; die brauchbaren werden Aufgaben, die übrigen gemeldet. */
export function aiBankItemsToDrafts<K extends BankId>(id: K, raws: unknown[], o: BankDraftOptions): { drafts: TaskDraft[]; rejected: string[] } {
  const drafts: TaskDraft[] = [];
  const rejected: string[] = [];
  for (const raw of raws) {
    const draft = aiBankItemToDraft(id, raw, {
      ...o,
      why: (r) => {
        o.why?.(r);
        rejected.push(r);
      },
    });
    if (draft) drafts.push(draft);
  }
  return { drafts, rejected };
}

export type BankKiResult<K extends BankId> = {
  /** die geprüften Einträge, wie sie in die Bankdatei passen würden */
  items: BankItem<K>[];
  drafts: TaskDraft[];
  /** warum einzelne Einträge verworfen wurden */
  rejected: string[];
};

/**
 * Holt neue Bankeinträge von der KI. Läuft wie jeder andere KI-Aufruf über `lib/ai/router.ts`
 * (Feature-Schlüssel `aufgaben`); ohne Schlüssel, Budget oder Verbindung kommt der Grund zurück und der
 * Aufrufer arbeitet ohne KI weiter. Nichts wird hier gespeichert: die Einträge sind Vorschläge.
 */
export async function generateBankItemsWithAI<K extends BankId>(
  id: K,
  o: BankPromptRequest & { difficulty: Difficulty; meta?: AIMeta; fn?: "aufgaben" | "neue_aufgabe"; maxTokens?: number },
): Promise<BankKiResult<K> | { error: string }> {
  const out = await runAI(o.fn ?? "aufgaben", bankArraySchema(id), BANK_SYSTEM, buildBankPrompt(id, o), {
    maxTokens: o.maxTokens ?? Math.min(20_000, 1_500 + o.count * 400),
    meta: o.meta,
  });
  if (!out.ok) return { error: out.message };
  if (!Array.isArray(out.data)) return { error: "Die KI hat kein JSON-Array geliefert." };
  if (!out.data.length) return { error: "Die KI hat ein leeres JSON-Array geliefert." };
  const raws: unknown[] = out.data;
  const { drafts, rejected } = aiBankItemsToDrafts(id, raws, { difficulty: o.difficulty });
  const items = raws.map((raw) => parseAiBankItem(id, raw)).flatMap((p) => (p.ok ? [p.item] : []));
  return { items, drafts, rejected };
}
