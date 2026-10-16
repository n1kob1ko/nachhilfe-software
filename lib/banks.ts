/**
 * Die Aufgabenbanken unter `data/banks/` (Phase 1 des Merges, Inhalte aus dem Artikel Trainer).
 *
 * Eine Bank ist eine JSON-Datei mit Einträgen eines festen Schemas. Gelesen wird jede Datei einmal
 * und dann aus dem Speicher bedient (`data/banks/` ist Inhalt, keine Datenbank: die App läuft als
 * ein Prozess, und `next build` liest die Dateien genauso wie ein Test).
 *
 * `review: true` setzt die Qualitätsprüfung (Phase 1, Schritt 7): solche Einträge bleiben in der
 * Datei, werden aber von `bankUsable` übersprungen, bis sie von Hand freigegeben sind.
 *
 * Fehlt eine Datei oder ist sie unlesbar, stürzt die App nicht ab: der Zugriff liefert eine leere
 * Liste und `bankStats()` meldet den Fehler (für Mehr › Datenqualität). Laut scheitern soll nur der
 * Test — dafür ist `readBank()` da, das wirft.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/** Von der Qualitätsprüfung markiert: bleibt in der Datei, wird aber nicht mehr geübt. */
const reviewField = { review: z.boolean().optional() };

// ---------- Schemas ----------
/** Artikel bestimmen: ein Nomen mit seinem Artikel (Genus). `tags` sind die Themendateien der Quelle. */
export const artikelItemSchema = z
  .object({
    word: z.string().min(1),
    article: z.enum(["der", "die", "das"]),
    translation: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).min(1),
    ...reviewField,
  })
  .strict();

/** Adjektivdeklination: zwei Lücken (Adjektivendung, Nomenendung) mit je vier Optionen. */
export const adjektivdeklinationItemSchema = z
  .object({
    prefix: z.string(),
    middle: z.string(),
    suffix: z.string(),
    options1: z.array(z.string().min(1)).min(2),
    correct1: z.string().min(1),
    options2: z.array(z.string().min(1)).min(2),
    correct2: z.string().min(1),
    solution: z.string().min(1),
    ...reviewField,
  })
  .strict();

/**
 * Präposition + Kasus: `article` ist das Genus des Nomens (aus der Quelle abgeleitet, nicht der
 * Artikel der Lücke — das ist `correct`). `kasus` ist null, wo er sich nicht sicher ableiten ließ.
 */
export const praepositionenItemSchema = z
  .object({
    prefix: z.string(),
    noun: z.string().min(1),
    article: z.enum(["der", "die", "das"]),
    suffix: z.string(),
    options: z.array(z.string().min(1)).min(2),
    correct: z.string().min(1),
    kasus: z.enum(["Dativ", "Akkusativ"]).nullable(),
    solution: z.string().min(1),
    ...reviewField,
  })
  .strict();

/** Lückentext, wie ihn `lib/generators.ts` als `ClozeItem` kennt (Präteritum, Perfekt). */
export const clozeItemSchema = z
  .object({
    q: z.string().min(1),
    blanks: z.array(z.array(z.string().min(1)).min(1)).min(1),
    solution: z.string(),
    hint: z.string(),
    errors: z.record(z.string(), z.string()).optional(),
    ...reviewField,
  })
  .strict();

/** das/dass: Lückentext plus die Begründung aus der Quelle. */
export const dasDassItemSchema = clozeItemSchema.extend({ explanation: z.string().min(1) });

/** Hauptsatz und Gliedsatz erkennen: der Satz in seinen Teilen. */
export const hauptsatzGliedsatzItemSchema = z
  .object({
    parts: z
      .array(z.object({ text: z.string().min(1), type: z.enum(["HS", "GS"]) }).strict())
      .length(2),
    ...reviewField,
  })
  .strict()
  .refine((item) => item.parts.filter((p) => p.type === "HS").length === 1, {
    message: "genau ein Teil muss HS sein",
  });

// ---------- Banken ----------
export const BANK_IDS = ["artikel", "adjektivdeklination", "praepositionen", "praeteritum", "perfekt", "das-dass", "hauptsatz-gliedsatz"] as const;
export type BankId = (typeof BANK_IDS)[number];

export type ArtikelItem = z.infer<typeof artikelItemSchema>;
export type AdjektivdeklinationItem = z.infer<typeof adjektivdeklinationItemSchema>;
export type PraepositionenItem = z.infer<typeof praepositionenItemSchema>;
export type ClozeItem = z.infer<typeof clozeItemSchema>;
export type DasDassItem = z.infer<typeof dasDassItemSchema>;
export type HauptsatzGliedsatzItem = z.infer<typeof hauptsatzGliedsatzItemSchema>;

export type BankTypes = {
  artikel: ArtikelItem;
  adjektivdeklination: AdjektivdeklinationItem;
  praepositionen: PraepositionenItem;
  praeteritum: ClozeItem;
  perfekt: ClozeItem;
  "das-dass": DasDassItem;
  "hauptsatz-gliedsatz": HauptsatzGliedsatzItem;
};
export type BankItem<K extends BankId> = BankTypes[K];

/** Der Dateiname je Bank; die Bank heißt wie die Fähigkeit, die sie füttert. */
export const BANK_FILES: Record<BankId, string> = {
  artikel: "artikel.json",
  adjektivdeklination: "adjektivdeklination.json",
  praepositionen: "praepositionen.json",
  praeteritum: "praeteritum.json",
  perfekt: "perfekt.json",
  "das-dass": "das-dass.json",
  "hauptsatz-gliedsatz": "hauptsatz-gliedsatz.json",
};

/** Deutsche Bezeichnung für Mehr › Datenqualität. */
export const BANK_LABEL: Record<BankId, string> = {
  artikel: "Artikel bestimmen",
  adjektivdeklination: "Adjektivdeklination",
  praepositionen: "Präposition und Kasus",
  praeteritum: "Präteritum",
  perfekt: "Perfekt",
  "das-dass": "das/dass",
  "hauptsatz-gliedsatz": "Hauptsatz und Gliedsatz",
};

const SCHEMAS: Record<BankId, z.ZodType> = {
  artikel: z.array(artikelItemSchema),
  adjektivdeklination: z.array(adjektivdeklinationItemSchema),
  praepositionen: z.array(praepositionenItemSchema),
  praeteritum: z.array(clozeItemSchema),
  perfekt: z.array(clozeItemSchema),
  "das-dass": z.array(dasDassItemSchema),
  "hauptsatz-gliedsatz": z.array(hauptsatzGliedsatzItemSchema),
};

export const DEFAULT_BANK_DIR = path.join(process.cwd(), "data", "banks");

export function bankFile(id: BankId): string {
  return path.join(DEFAULT_BANK_DIR, BANK_FILES[id]);
}

/**
 * Eine Funktion je Bank statt eines zusammengebauten Pfades: der Pfad steht damit wörtlich im Code
 * und der Bundler weiß, welche Dateien zum Server gehören (sonst wandert das ganze Projekt mit).
 */
const READERS: Record<BankId, () => string> = {
  artikel: () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "artikel.json"), "utf8"),
  adjektivdeklination: () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "adjektivdeklination.json"), "utf8"),
  praepositionen: () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "praepositionen.json"), "utf8"),
  praeteritum: () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "praeteritum.json"), "utf8"),
  perfekt: () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "perfekt.json"), "utf8"),
  "das-dass": () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "das-dass.json"), "utf8"),
  "hauptsatz-gliedsatz": () => fs.readFileSync(path.join(process.cwd(), "data", "banks", "hauptsatz-gliedsatz.json"), "utf8"),
};

/**
 * Nur für Tests: ersetzt den Inhalt einzelner Banken, damit auch eine fehlende (`null`) oder kaputte
 * Datei geprüft werden kann. `null` stellt die echten Dateien wieder her (und leert den Cache).
 */
export function useBankContentForTest(content: Partial<Record<BankId, string | null>> | null): void {
  testContent = content;
  cache.clear();
}
let testContent: Partial<Record<BankId, string | null>> | null = null;

export type ParseResult<K extends BankId> = { ok: true; items: BankItem<K>[] } | { ok: false; error: string };

/** Prüft den Inhalt einer Bank gegen ihr Schema. Wirft nicht — der Aufrufer entscheidet, was passiert. */
export function parseBank<K extends BankId>(id: K, raw: string): ParseResult<K> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `kein gültiges JSON (${e instanceof Error ? e.message : String(e)})` };
  }
  const result = SCHEMAS[id].safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` bei Eintrag ${first.path.join(".")}` : "";
    return { ok: false, error: `verletzt das Schema${where}: ${first?.message ?? "unbekannter Fehler"}` };
  }
  return { ok: true, items: result.data as BankItem<K>[] };
}

/** Einträge, die die Qualitätsprüfung nicht aussortiert hat — der Standardzugriff der Generatoren. */
export function withoutReview<T extends { review?: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.review !== true);
}

type Loaded = { items: unknown[]; usable: unknown[]; error: string | null };
const cache = new Map<BankId, Loaded>();

/** Liest eine Bank genau einmal; danach kommt sie aus dem Speicher. */
function load(id: BankId): Loaded {
  const hit = cache.get(id);
  if (hit) return hit;
  let result: Loaded;
  try {
    const replaced = testContent && id in testContent ? testContent[id] : undefined;
    if (replaced === null) throw new Error("Datei fehlt");
    const raw = replaced ?? READERS[id]();
    const parsed = parseBank(id, raw);
    result = parsed.ok
      ? { items: parsed.items, usable: withoutReview(parsed.items as { review?: boolean }[]), error: null }
      : { items: [], usable: [], error: parsed.error };
  } catch (e) {
    result = { items: [], usable: [], error: `nicht lesbar (${e instanceof Error ? e.message : String(e)})` };
  }
  cache.set(id, result);
  return result;
}

/**
 * Die Bank, laut scheiternd: fehlt sie, ist sie unlesbar oder passt sie nicht zum Schema, wirft das
 * (so scheitert ein Test). Einträge mit `review: true` sind auch hier übersprungen.
 * Die App nimmt `bankUsable`, das nie wirft.
 */
export function readBank<K extends BankId>(id: K): BankItem<K>[] {
  const l = load(id);
  if (l.error) throw new Error(`Bank „${id}“ (${BANK_FILES[id]}): ${l.error}`);
  return withoutReview(l.items as BankItem<K>[]);
}

/** Alle Einträge einer Bank, auch die mit `review: true` (für Prüfseiten); [] wenn die Datei fehlt. */
export function bankItems<K extends BankId>(id: K): BankItem<K>[] {
  return load(id).items as BankItem<K>[];
}

/** Der Standardzugriff: geprüfte Einträge ohne `review: true`; [] wenn die Datei fehlt. */
export function bankUsable<K extends BankId>(id: K): BankItem<K>[] {
  return load(id).usable as BankItem<K>[];
}

export type BankStat = {
  id: BankId;
  file: string;
  label: string;
  /** alle Einträge in der Datei */
  total: number;
  /** davon nutzbar (ohne `review: true`) */
  usable: number;
  /** von der Qualitätsprüfung markiert */
  review: number;
  /** null = die Bank ist da und gültig; sonst der Grund (Mehr › Datenqualität) */
  error: string | null;
};

/** Kennzahlen je Bank für Mehr › Datenqualität; liest die Banken, falls noch nicht geschehen. */
export function bankStats(): BankStat[] {
  return BANK_IDS.map((id) => {
    const l = load(id);
    return {
      id,
      file: BANK_FILES[id],
      label: BANK_LABEL[id],
      total: l.items.length,
      usable: l.usable.length,
      review: l.items.length - l.usable.length,
      error: l.error,
    };
  });
}

// ---------- der bequeme Zugriff der Generatoren ----------
export const artikelItems = (): ArtikelItem[] => bankUsable("artikel");
export const adjektivdeklinationItems = (): AdjektivdeklinationItem[] => bankUsable("adjektivdeklination");
export const praepositionenItems = (): PraepositionenItem[] => bankUsable("praepositionen");
export const praeteritumItems = (): ClozeItem[] => bankUsable("praeteritum");
export const perfektItems = (): ClozeItem[] => bankUsable("perfekt");
export const dasDassItems = (): DasDassItem[] => bankUsable("das-dass");
export const hauptsatzGliedsatzItems = (): HauptsatzGliedsatzItem[] => bankUsable("hauptsatz-gliedsatz");
