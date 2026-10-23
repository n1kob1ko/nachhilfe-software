/**
 * Lernpakete: a prepared lesson for one topic (not for one student), built once and used for many. It is a
 * list of steps in teaching order with minutes, what the teacher says and asks, the expected answer, what to
 * do on a mistake, and optional tasks in the builder's format (TaskDraft, lib/tasks.ts), checked with the
 * builder's own checks (normalizeTask, checkTask) so they can later go through the usual exercise flow.
 *
 * A package is never deleted: archiving keeps it retrievable. Imported and KI-made (lib/lernpaket-ki.ts) packages start
 * as Entwurf and stay „ungeprüft“ until a teacher marks them Geprüft. Import and export use one JSON file,
 * format „lernheft-lernpaket“, version 1 (docs/lernpaket-format.md).
 */
import { z } from "zod";
import { db, json } from "./db";
import { checkTask, normalizeTask } from "./builder";
import { DIFFICULTIES, TASK_TYPES, type Difficulty, type TaskType } from "./curriculum";
import { getLibraryEntry } from "./library";
import * as repo from "./repo";
import { fachAus, SCHOOL_TYPES, schoolType, schulstufe } from "./school";
import type { TaskDraft } from "./tasks";

export const LERNPAKET_FORMAT = "lernheft-lernpaket";
export const LERNPAKET_VERSION = 1;

/** Kinds of steps, in the order a lesson usually has them, with their German label. */
export const SCHRITT_ARTEN = {
  einstieg: "Einstieg",
  erklaerung: "Erklärung",
  beispiel: "Beispiel",
  frage: "Verständnisfrage",
  gefuehrte_uebung: "Gemeinsam üben",
  uebung: "Übung",
  zusatz: "Zusatzübung",
  kontrolle: "Kontrolle",
  abschluss: "Abschluss",
} as const;
export type SchrittArt = keyof typeof SCHRITT_ARTEN;
const ARTEN = Object.keys(SCHRITT_ARTEN) as [SchrittArt, ...SchrittArt[]];

export const PAKET_STATUS = { entwurf: "Entwurf", geprueft: "Geprüft", archiviert: "Archiviert" } as const;
export type PaketStatus = keyof typeof PAKET_STATUS;
export const PAKET_QUELLE = { hand: "von Hand", import: "importiert", ki: "von der KI" } as const;
export type PaketQuelle = keyof typeof PAKET_QUELLE;

/** Limits, the same in the editor and in an imported file. */
export const GRENZEN = { titel: 120, fach: 60, thema: 120, ziel: 1000, text: 4000, schritte: 60, aufgaben: 30, minuten: 240, dauer: 300, pruefen: 20 } as const;

export type Lernpaket = {
  id: number;
  title: string;
  fach: string;
  schulart: string;
  klasse: number | null;
  schulstufe: number | null;
  thema: string;
  skill_ids: string[];
  schwierigkeit: Difficulty;
  dauer_minuten: number;
  ziel: string;
  quelle: PaketQuelle;
  status: PaketStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  geprueft_von: number | null;
  geprueft_am: string | null;
  /** the presentation of this package (lib/praesentationen.ts); its slides match the steps' `folie` */
  praesentation_id: number | null;
  /** a KI draft: its request in ai_calls (tokens and cost, lib/lernpaket-ki.ts) */
  ki_call_id: number | null;
  /** name of the teacher who marked it geprüft */
  geprueft_von_name: string | null;
  /** number of steps and their minutes together */
  schritt_zahl: number;
  minuten_summe: number;
};

export type LernpaketSchritt = {
  id: number;
  paket_id: number;
  position: number;
  art: SchrittArt;
  titel: string;
  minuten: number;
  lehrer_sagt: string;
  folie: number | null;
  lehrer_fragt: string;
  erwartete_antwort: string;
  bei_fehler: string;
  notiz: string;
  aufgaben: TaskDraft[];
  /** what a person still has to check (e.g. a doubtful answer of the KI); empty once checked */
  pruefen: string[];
};

export type LernpaketMitSchritten = Lernpaket & { schritte: LernpaketSchritt[] };

/** Imported or KI-made content that no teacher has checked yet. Archiving keeps the check. */
export const ungeprueft = (p: Pick<Lernpaket, "quelle" | "geprueft_am">) => p.quelle !== "hand" && !p.geprueft_am;

// ---------- the file format (zod) ----------

const text = (max: number) => z.string().trim().max(max);
const pflicht = (max: number) => z.string().trim().min(1).max(max);
const notizen = z.array(pflicht(500)).max(GRENZEN.pruefen);

const TASK_KEYS = Object.keys(TASK_TYPES).filter((k) => k !== "mixed") as [TaskType, ...TaskType[]];

/** A task in the builder's format (TaskDraft). Its content is checked afterwards with checkTask. */
const AufgabeSchema = z.strictObject({
  type: z.enum(TASK_KEYS),
  skillId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).optional(),
  category: z.string().max(40).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  prompt: pflicht(GRENZEN.text),
  data: z
    .looseObject({
      options: z.array(z.string()).optional(),
      passage: z.string().optional(),
      steps: z.array(z.string()).optional(),
      faulty: z.string().optional(),
      lines: z.number().int().min(1).max(40).optional(),
      start: z.string().optional(),
      variable: z.string().optional(),
      pruefen: z.array(z.string()).optional(),
    })
    .default({}),
  answer: z
    .looseObject({
      correct: z.number().int().min(0).optional(),
      correctAll: z.array(z.number().int().min(0)).optional(),
      accepted: z.array(z.string()).optional(),
      mode: z.enum(["value", "exact", "text"]).optional(),
      blanks: z.array(z.array(z.string())).optional(),
      sample: z.string().optional(),
      steps: z.array(z.string()).optional(),
      criteria: z.array(z.string()).optional(),
    })
    .default({}),
  solution: z.string().max(GRENZEN.text).default(""),
  hints: z.array(z.string().max(1000)).max(6).default([]),
  errorMap: z.array(z.strictObject({ answer: z.string(), label: z.string() })).max(20).default([]),
  solutionSteps: z.array(z.string()).optional(),
  // Lösungsdaten für den Lehrer (lib/loesungsdaten.ts)
  teacherNote: z.string().max(GRENZEN.text).optional(),
  altWays: z.array(z.string().max(1000)).max(6).optional(),
  estimatedTimeSec: z.number().int().positive().nullable().optional(),
});

const SchrittSchema = z.strictObject({
  art: z.enum(ARTEN),
  titel: pflicht(GRENZEN.titel),
  minuten: z.number().int().min(1).max(GRENZEN.minuten),
  lehrer_sagt: text(GRENZEN.text).default(""),
  folie: z.number().int().min(1).max(500).nullable().default(null),
  lehrer_fragt: text(GRENZEN.text).default(""),
  erwartete_antwort: text(GRENZEN.text).default(""),
  bei_fehler: text(GRENZEN.text).default(""),
  notiz: text(GRENZEN.text).default(""),
  pruefen: notizen.default([]),
  aufgaben: z.array(AufgabeSchema).max(GRENZEN.aufgaben).default([]),
});

const DateiSchema = z.strictObject({
  format: z.literal(LERNPAKET_FORMAT),
  version: z.literal(LERNPAKET_VERSION),
  titel: pflicht(GRENZEN.titel),
  fach: pflicht(GRENZEN.fach),
  schulart: text(40).default(""),
  klasse: z.number().int().min(1).max(13).nullable().default(null),
  thema: text(GRENZEN.thema).default(""),
  faehigkeiten: z.array(z.string().trim().min(1)).max(12).default([]),
  schwierigkeit: z.enum(DIFFICULTIES).default("mittel"),
  dauer_minuten: z.number().int().min(1).max(GRENZEN.dauer).optional(),
  ziel: text(GRENZEN.ziel).default(""),
  schritte: z.array(SchrittSchema).min(1).max(GRENZEN.schritte),
});

/** The file as export writes it and import reads it (version 1). */
export type LernpaketDatei = {
  format: typeof LERNPAKET_FORMAT;
  version: typeof LERNPAKET_VERSION;
  titel: string;
  fach: string;
  schulart: string;
  klasse: number | null;
  thema: string;
  faehigkeiten: string[];
  schwierigkeit: Difficulty;
  dauer_minuten: number;
  ziel: string;
  schritte: {
    art: SchrittArt;
    titel: string;
    minuten: number;
    lehrer_sagt: string;
    folie: number | null;
    lehrer_fragt: string;
    erwartete_antwort: string;
    bei_fehler: string;
    notiz: string;
    pruefen: string[];
    aufgaben: TaskDraft[];
  }[];
};

/** Where in the file: „Schritt 3 („Erklärung“), Aufgabe 1, Feld „data.options““. */
function ort(path: PropertyKey[], raw: unknown): string {
  const teile: string[] = [];
  let rest = path;
  if (path[0] === "schritte" && typeof path[1] === "number") {
    const titel = (raw as { schritte?: { titel?: unknown }[] }).schritte?.[path[1]]?.titel;
    teile.push(`Schritt ${path[1] + 1}${typeof titel === "string" && titel.trim() ? ` („${titel.trim()}“)` : ""}`);
    rest = path.slice(2);
    if (rest[0] === "aufgaben" && typeof rest[1] === "number") {
      teile.push(`Aufgabe ${rest[1] + 1}`);
      rest = rest.slice(2);
    }
  }
  const feld = rest.filter((k) => typeof k === "string").join(".");
  const nr = rest.filter((k): k is number => typeof k === "number");
  if (feld) teile.push(`Feld „${feld}“${nr.length ? ` (Eintrag ${nr.map((n) => n + 1).join(", ")})` : ""}`);
  return teile.join(", ") || "Datei";
}

const ART_DES_WERTS: Record<string, string> = { string: "ein Text", number: "eine Zahl", int: "eine ganze Zahl", array: "eine Liste [ … ]", object: "ein Objekt { … }", boolean: "true oder false" };

/** A zod issue in plain German, with the place it refers to. */
function meldung(issue: z.core.$ZodIssue, raw: unknown): string {
  const wo = ort(issue.path, raw);
  const wert = issue.path.reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<PropertyKey, unknown>)[k as never] : undefined), raw);
  switch (issue.code) {
    case "invalid_type":
      return wert === undefined ? `${wo}: fehlt.` : `${wo}: muss ${ART_DES_WERTS[issue.expected] ?? issue.expected} sein.`;
    case "too_small":
      if (issue.origin === "string") return `${wo}: darf nicht leer sein.`;
      if (issue.origin === "array") return `${wo}: braucht mindestens ${issue.minimum} ${Number(issue.minimum) === 1 ? "Eintrag" : "Einträge"}.`;
      return `${wo}: muss mindestens ${issue.minimum} sein.`;
    case "too_big":
      if (issue.origin === "string") return `${wo}: ist zu lang (höchstens ${issue.maximum} Zeichen).`;
      if (issue.origin === "array") return `${wo}: höchstens ${issue.maximum} Einträge.`;
      return `${wo}: darf höchstens ${issue.maximum} sein.`;
    case "invalid_value":
      if (issue.path[0] === "format" && issue.path.length === 1) return `Das ist keine Lernpaket-Datei: „format“ muss „${LERNPAKET_FORMAT}“ sein.`;
      if (issue.path[0] === "version" && issue.path.length === 1) return `Version ${JSON.stringify(wert)} kennt Lernheft nicht. Unterstützt wird Version ${LERNPAKET_VERSION}.`;
      return `${wo}: muss eines davon sein: ${issue.values.map((v) => String(v)).join(", ")}.`;
    case "unrecognized_keys":
      return `${wo}: unbekanntes Feld ${issue.keys.map((k) => `„${k}“`).join(", ")}. Tippfehler?`;
    default:
      return `${wo}: ${issue.message}`;
  }
}

export type Gelesen = { ok: true; datei: LernpaketDatei } | { ok: false; fehler: string[] };

/**
 * Reads and checks a Lernpaket file: structure (zod), then what only the app knows: Schulart and Klasse,
 * the skills, the minutes, and every task with the builder's checks. Errors name the step, task and field.
 */
export function leseLernpaket(roh: string | unknown): Gelesen {
  let raw: unknown = roh;
  if (typeof roh === "string") {
    try {
      raw = JSON.parse(roh.replace(/^\uFEFF/, ""));
    } catch (e) {
      return { ok: false, fehler: [`Die Datei ist kein gültiges JSON (${e instanceof Error ? e.message : "nicht lesbar"}).`] };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, fehler: ["Die Datei muss ein JSON-Objekt { … } sein."] };
  const r = DateiSchema.safeParse(raw);
  if (!r.success) {
    // the format comes first: a different file gets one clear message instead of twenty
    const format = r.error.issues.find((i) => i.path.length === 1 && (i.path[0] === "format" || i.path[0] === "version"));
    return { ok: false, fehler: format ? [meldung(format, raw)] : r.error.issues.slice(0, 12).map((i) => meldung(i, raw)) };
  }
  const d = r.data;
  const fehler: string[] = [];
  const meta = pruefeMeta({ title: d.titel, fach: d.fach, schulart: d.schulart, klasse: d.klasse, thema: d.thema, skill_ids: d.faehigkeiten, schwierigkeit: d.schwierigkeit, dauer_minuten: d.dauer_minuten ?? 1, ziel: d.ziel }, { title: "titel", skill_ids: "faehigkeiten" });
  if ("fehler" in meta) fehler.push(...meta.fehler);
  const summe = d.schritte.reduce((n, s) => n + s.minuten, 0);
  if (d.dauer_minuten !== undefined && d.dauer_minuten !== summe)
    fehler.push(`Feld „dauer_minuten“: ist ${d.dauer_minuten}, die Schritte ergeben zusammen ${summe} Minuten. Bitte angleichen oder „dauer_minuten“ weglassen.`);
  if (summe > GRENZEN.dauer) fehler.push(`Die Schritte ergeben zusammen ${summe} Minuten, höchstens ${GRENZEN.dauer} gehen.`);
  const fach = "fehler" in meta ? d.fach : meta.wert.fach;
  const schritte = d.schritte.map((s, i) => {
    const wo = `Schritt ${i + 1} („${s.titel}“)`;
    const aufgaben = s.aufgaben.map((a, j) => {
      const out = pruefeAufgabe(a as TaskDraft, { skillIds: d.faehigkeiten, schwierigkeit: d.schwierigkeit, fach });
      if ("fehler" in out) fehler.push(`${wo}, Aufgabe ${j + 1}: ${out.fehler}`);
      return "fehler" in out ? (a as TaskDraft) : out.aufgabe;
    });
    return { ...s, aufgaben };
  });
  if (fehler.length) return { ok: false, fehler: fehler.slice(0, 12) };
  const m = (meta as { wert: Meta }).wert;
  return {
    ok: true,
    datei: {
      format: LERNPAKET_FORMAT,
      version: LERNPAKET_VERSION,
      titel: m.title,
      fach: m.fach,
      schulart: m.schulart,
      klasse: m.klasse,
      thema: m.thema,
      faehigkeiten: m.skill_ids,
      schwierigkeit: m.schwierigkeit,
      dauer_minuten: summe,
      ziel: m.ziel,
      schritte,
    },
  };
}

/**
 * One task with the builder's checks. Without a skill it gets the package's main skill, without a difficulty
 * the package's. Notes in data.pruefen do not stop the import: they stay with the task until a teacher checks it.
 */
export function pruefeAufgabe(a: TaskDraft, p: { skillIds: string[]; schwierigkeit: Difficulty; fach: string }): { aufgabe: TaskDraft } | { fehler: string } {
  const skillId = a.skillId || p.skillIds[0] || null;
  if (!skillId) return { fehler: "Die Aufgabe braucht eine Fähigkeit („skillId“), oder das Paket „faehigkeiten“." };
  for (const id of [skillId, ...(a.skillIds ?? [])]) {
    const s = repo.getSkill(id);
    if (!s) return { fehler: `Fähigkeit „${id}“ gibt es in Lernheft nicht.` };
    if (s.subject !== p.fach) return { fehler: `Fähigkeit „${id}“ gehört zu ${s.subject}, das Paket ist ${p.fach}.` };
  }
  const { sourceType: _t, sourceId: _i, ...rest } = a;
  void _t, void _i;
  let t: TaskDraft;
  try {
    t = normalizeTask({ ...rest, skillId, difficulty: a.difficulty ?? p.schwierigkeit, data: a.data ?? {}, answer: a.answer ?? {}, solution: a.solution ?? "", hints: a.hints ?? [], errorMap: a.errorMap ?? [] });
    const { pruefen: _p, ...ohneHinweise } = t.data;
    void _p;
    const problem = checkTask({ ...t, data: ohneHinweise });
    if (problem) return { fehler: problem };
  } catch {
    return { fehler: "„data“ oder „answer“ passt nicht zum Antwortformat (siehe docs/lernpaket-format.md)." };
  }
  if (!t.data.pruefen?.length) {
    const { pruefen: _p, ...data } = t.data;
    void _p;
    t = { ...t, data };
  }
  return { aufgabe: t };
}

/**
 * One task as a file has it: the file's shape, then the builder's checks (pruefeAufgabe). A KI draft
 * (lib/lernpaket-ki.ts) checks each task with this and leaves out one that fails, instead of the package.
 */
export function pruefeDateiAufgabe(roh: unknown, p: { skillIds: string[]; schwierigkeit: Difficulty; fach: string }): { aufgabe: TaskDraft } | { fehler: string } {
  const r = AufgabeSchema.safeParse(roh);
  if (!r.success) return { fehler: meldung(r.error.issues[0], roh) };
  return pruefeAufgabe(r.data as TaskDraft, p);
}

// ---------- metadata ----------

export type Meta = {
  title: string;
  fach: string;
  schulart: string;
  klasse: number | null;
  thema: string;
  skill_ids: string[];
  schwierigkeit: Difficulty;
  dauer_minuten: number;
  ziel: string;
};

/** Checks the data of a package (editor and import). `namen` maps a field to its name in the file. */
export function pruefeMeta(m: Meta, namen: Partial<Record<keyof Meta, string>> = {}): { wert: Meta } | { fehler: string[] } {
  const feld = (k: keyof Meta) => `Feld „${namen[k] ?? k}“`;
  const fehler: string[] = [];
  const title = m.title.replace(/\s+/g, " ").trim();
  if (!title) fehler.push(`${feld("title")}: Bitte einen Titel eingeben, zum Beispiel „Die vier Fälle“.`);
  if (title.length > GRENZEN.titel) fehler.push(`${feld("title")}: höchstens ${GRENZEN.titel} Zeichen.`);
  const fach = fachAus(m.fach);
  if (!fach) fehler.push(`${feld("fach")}: Bitte das Fach angeben.`);
  // „VS“ or „Volksschule“; empty = for every Schulart
  const art = m.schulart.trim() ? (schoolType(m.schulart.trim()) ?? SCHOOL_TYPES.find((t) => t.short.toLowerCase() === m.schulart.trim().toLowerCase()) ?? null) : null;
  if (m.schulart.trim() && !art) fehler.push(`${feld("schulart")}: „${m.schulart}“ kennt Lernheft nicht. Möglich: ${SCHOOL_TYPES.map((t) => t.name).join(", ")}.`);
  const klasse = m.klasse ?? null;
  if (klasse !== null && art && (klasse < 1 || klasse > art.classes)) fehler.push(`${feld("klasse")}: Die ${art.name} hat die Klassen 1 bis ${art.classes}.`);
  if (klasse !== null && !m.schulart.trim()) fehler.push(`${feld("klasse")}: Eine Klasse geht nur mit Schulart.`);
  const skill_ids = [...new Set(m.skill_ids.map((s) => s.trim()).filter(Boolean))];
  for (const id of skill_ids) {
    const s = repo.getSkill(id);
    if (!s) fehler.push(`${feld("skill_ids")}: Fähigkeit „${id}“ gibt es in Lernheft nicht (die Kennung steht in der Adresse der Fähigkeitsseite).`);
    else if (fach && s.subject !== fach) fehler.push(`${feld("skill_ids")}: Fähigkeit „${id}“ gehört zu ${s.subject}, das Paket ist ${fach}.`);
  }
  if (!(DIFFICULTIES as readonly string[]).includes(m.schwierigkeit)) fehler.push(`${feld("schwierigkeit")}: muss eines davon sein: ${DIFFICULTIES.join(", ")}.`);
  if (!Number.isInteger(m.dauer_minuten) || m.dauer_minuten < 1 || m.dauer_minuten > GRENZEN.dauer) fehler.push(`${feld("dauer_minuten")}: 1 bis ${GRENZEN.dauer} Minuten.`);
  const ziel = m.ziel.trim();
  if (ziel.length > GRENZEN.ziel) fehler.push(`${feld("ziel")}: höchstens ${GRENZEN.ziel} Zeichen.`);
  const thema = m.thema.replace(/\s+/g, " ").trim().slice(0, GRENZEN.thema);
  if (fehler.length) return { fehler };
  return { wert: { title, fach, schulart: art?.name ?? "", klasse: art ? klasse : null, thema, skill_ids, schwierigkeit: m.schwierigkeit, dauer_minuten: m.dauer_minuten, ziel } };
}

// ---------- reading ----------

type PaketRow = Omit<Lernpaket, "skill_ids"> & { skill_ids: string };
type SchrittRow = Omit<LernpaketSchritt, "aufgaben" | "pruefen"> & { aufgaben: string; pruefen: string };

const PAKET_SELECT = `SELECT p.*, t.name AS geprueft_von_name,
  (SELECT COUNT(*) FROM lernpaket_schritte s WHERE s.paket_id = p.id) AS schritt_zahl,
  (SELECT COALESCE(SUM(s.minuten), 0) FROM lernpaket_schritte s WHERE s.paket_id = p.id) AS minuten_summe
  FROM lernpakete p LEFT JOIN teachers t ON t.id = p.geprueft_von`;

const toPaket = (r: PaketRow): Lernpaket => ({ ...r, skill_ids: json<string[]>(r.skill_ids, []) });
const toSchritt = (r: SchrittRow): LernpaketSchritt => ({ ...r, aufgaben: json<TaskDraft[]>(r.aufgaben, []), pruefen: json<string[]>(r.pruefen, []) });

export function listSchritte(paketId: number): LernpaketSchritt[] {
  return (db().prepare("SELECT * FROM lernpaket_schritte WHERE paket_id = ? ORDER BY position, id").all(paketId) as SchrittRow[]).map(toSchritt);
}

export function getSchritt(id: number): LernpaketSchritt | null {
  const r = db().prepare("SELECT * FROM lernpaket_schritte WHERE id = ?").get(id) as SchrittRow | undefined;
  return r ? toSchritt(r) : null;
}

/** A package with its steps in order; archived ones too. */
export function getLernpaket(id: number): LernpaketMitSchritten | null {
  const r = db().prepare(`${PAKET_SELECT} WHERE p.id = ?`).get(id) as PaketRow | undefined;
  return r ? { ...toPaket(r), schritte: listSchritte(id) } : null;
}

export type LernpaketFilter = {
  fach?: string;
  schulart?: string;
  klasse?: number | null;
  thema?: string;
  /** a skill also finds packages of its sub-skills */
  skillId?: string;
  /** without a status: Entwurf and Geprüft, never archived ones */
  status?: PaketStatus;
  q?: string;
};

/** Packages matching the filter, the most recently changed first. */
export function listLernpakete(f: LernpaketFilter = {}): Lernpaket[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, ...p: unknown[]) => (where.push(sql), params.push(...p));
  if (f.status && Object.hasOwn(PAKET_STATUS, f.status)) add("p.status = ?", f.status);
  else where.push("p.status <> 'archiviert'");
  if (f.fach) add("p.fach = ?", f.fach);
  if (f.schulart) add("p.schulart = ?", f.schulart);
  if (f.klasse) add("p.klasse = ?", f.klasse);
  if (f.thema) add("p.thema = ?", f.thema);
  if (f.skillId)
    add("EXISTS (SELECT 1 FROM json_each(p.skill_ids) j LEFT JOIN skills k ON k.id = j.value WHERE j.value = ? OR k.parent_id = ?)", f.skillId, f.skillId);
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    add("(p.title LIKE ? OR p.thema LIKE ? OR p.ziel LIKE ?)", like, like, like);
  }
  const sql = `${PAKET_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY p.updated_at DESC, p.id DESC`;
  return (db().prepare(sql).all(...params) as PaketRow[]).map(toPaket);
}

/** What the filters can offer: only values that occur (archived packages included). */
export function lernpaketFacetten() {
  const alle = (db().prepare("SELECT * FROM lernpakete").all() as PaketRow[]).map(toPaket);
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    gesamt: alle.length,
    faecher: uniq(alle.map((p) => p.fach)).sort((a, b) => a.localeCompare(b, "de")),
    stufen: uniq(alle.filter((p) => p.schulart).map((p) => `${p.schulart}|${p.klasse ?? ""}`)),
    themen: uniq(alle.map((p) => p.thema).filter(Boolean)).sort((a, b) => a.localeCompare(b, "de")),
    skills: uniq(alle.flatMap((p) => p.skill_ids)),
    status: Object.fromEntries((Object.keys(PAKET_STATUS) as PaketStatus[]).map((s) => [s, alle.filter((p) => p.status === s).length])) as Record<PaketStatus, number>,
  };
}

// ---------- writing ----------

const touch = (id: number) => db().prepare("UPDATE lernpakete SET updated_at = datetime('now') WHERE id = ?").run(id);

/** A new package from the editor: Entwurf, written by hand, no steps yet. */
export function createLernpaket(m: Meta, teacherId: number | null): { id: number } | { fehler: string[] } {
  const out = pruefeMeta(m);
  if ("fehler" in out) return out;
  return { id: insertPaket(out.wert, "hand", teacherId) };
}

function insertPaket(m: Meta, quelle: PaketQuelle, teacherId: number | null, kiCallId: number | null = null): number {
  const r = db()
    .prepare(
      `INSERT INTO lernpakete (title, fach, schulart, klasse, schulstufe, thema, skill_ids, schwierigkeit, dauer_minuten, ziel, quelle, status, created_by, ki_call_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'entwurf', ?, ?)`,
    )
    .run(m.title, m.fach, m.schulart, m.klasse, m.schulart && m.klasse ? schulstufe(m.schulart, m.klasse) : null, m.thema, JSON.stringify(m.skill_ids), m.schwierigkeit, m.dauer_minuten, m.ziel, quelle, teacherId, kiCallId);
  return Number(r.lastInsertRowid);
}

export function updateLernpaket(id: number, m: Meta): { ok: true } | { fehler: string[] } {
  if (!getLernpaket(id)) return { fehler: ["Dieses Lernpaket gibt es nicht."] };
  const out = pruefeMeta(m);
  if ("fehler" in out) return out;
  const w = out.wert;
  db()
    .prepare(
      `UPDATE lernpakete SET title = ?, fach = ?, schulart = ?, klasse = ?, schulstufe = ?, thema = ?, skill_ids = ?, schwierigkeit = ?, dauer_minuten = ?, ziel = ?,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(w.title, w.fach, w.schulart, w.klasse, w.schulart && w.klasse ? schulstufe(w.schulart, w.klasse) : null, w.thema, JSON.stringify(w.skill_ids), w.schwierigkeit, w.dauer_minuten, w.ziel, id);
  return { ok: true };
}

/** Open notes of a package: on its steps and in its tasks (data.pruefen). */
export function offeneHinweise(p: LernpaketMitSchritten): string[] {
  return p.schritte.flatMap((s) => [...s.pruefen.map((h) => `${s.titel}: ${h}`), ...s.aufgaben.flatMap((a, i) => (a.data.pruefen ?? []).map((h) => `${s.titel}, Aufgabe ${i + 1}: ${h}`))]);
}

/**
 * A teacher marks the package Geprüft. Open notes must be confirmed as checked; they are then cleared, on
 * the steps and in the tasks, so nothing stops sending the tasks later.
 */
export function markiereGeprueft(id: number, teacherId: number, o: { hinweiseGeprueft?: boolean } = {}): { ok: true } | { fehler: string } {
  const p = getLernpaket(id);
  if (!p) return { fehler: "Dieses Lernpaket gibt es nicht." };
  if (p.status === "archiviert") return { fehler: "Ein archiviertes Lernpaket erst wiederherstellen." };
  if (!p.schritte.length) return { fehler: "Das Lernpaket hat noch keine Schritte." };
  const offen = offeneHinweise(p);
  if (offen.length && !o.hinweiseGeprueft) return { fehler: `Noch ${offen.length === 1 ? "ein Hinweis" : `${offen.length} Hinweise`} zu prüfen. Bitte durchgehen und bestätigen.` };
  const conn = db();
  conn.transaction(() => {
    const setze = conn.prepare("UPDATE lernpaket_schritte SET pruefen = '[]', aufgaben = ? WHERE id = ?");
    for (const s of p.schritte) {
      if (!s.pruefen.length && !s.aufgaben.some((a) => a.data.pruefen?.length)) continue;
      const aufgaben = s.aufgaben.map((a) => {
        const { pruefen: _p, ...data } = a.data;
        void _p;
        return { ...a, data };
      });
      setze.run(JSON.stringify(aufgaben), s.id);
    }
    conn.prepare("UPDATE lernpakete SET status = 'geprueft', geprueft_von = ?, geprueft_am = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(teacherId, id);
  })();
  return { ok: true };
}

/** Back to Entwurf (e.g. to rework it). The earlier check stays noted. */
export function zurueckZuEntwurf(id: number): boolean {
  return db().prepare("UPDATE lernpakete SET status = 'entwurf', updated_at = datetime('now') WHERE id = ? AND status = 'geprueft'").run(id).changes > 0;
}

/** Instead of deleting: the package leaves the list but stays retrievable, with every step. */
export function archiviereLernpaket(id: number): boolean {
  return db().prepare("UPDATE lernpakete SET status = 'archiviert', updated_at = datetime('now') WHERE id = ? AND status <> 'archiviert'").run(id).changes > 0;
}

/** Back from the archive: Geprüft if it was checked, otherwise Entwurf. */
export function stelleWiederHer(id: number): boolean {
  return (
    db()
      .prepare("UPDATE lernpakete SET status = CASE WHEN geprueft_am IS NULL THEN 'entwurf' ELSE 'geprueft' END, updated_at = datetime('now') WHERE id = ? AND status = 'archiviert'")
      .run(id).changes > 0
  );
}

// ---------- steps ----------

export type SchrittInput = {
  art: string;
  titel: string;
  minuten: number;
  lehrer_sagt?: string;
  folie?: number | null;
  lehrer_fragt?: string;
  erwartete_antwort?: string;
  bei_fehler?: string;
  notiz?: string;
  pruefen?: string[];
};

const SchrittFormSchema = SchrittSchema.omit({ aufgaben: true });

/** Checks a step from the editor with the same rules as the file. */
function pruefeSchritt(s: SchrittInput): { wert: z.infer<typeof SchrittFormSchema> } | { fehler: string[] } {
  const roh = { ...s, folie: s.folie || null, pruefen: (s.pruefen ?? []).map((x) => x.trim()).filter(Boolean) };
  const r = SchrittFormSchema.safeParse(roh);
  if (r.success) return { wert: r.data };
  const name: Record<string, string> = { art: "Art", titel: "Titel", minuten: "Minuten", folie: "Folie", pruefen: "Noch zu prüfen" };
  return {
    fehler: r.error.issues.map((i) => {
      const k = String(i.path[0] ?? "");
      if (k === "minuten") return `Minuten: eine ganze Zahl von 1 bis ${GRENZEN.minuten}.`;
      if (k === "titel") return "Titel: Bitte kurz benennen, was in diesem Schritt passiert.";
      if (k === "folie") return "Folie: eine Nummer ab 1, oder leer lassen.";
      return `${name[k] ?? k}: ${meldung(i, roh).replace(/^.*?: /, "")}`;
    }),
  };
}

/** Adds a step at the end (or after the step `nach`). */
export function addSchritt(paketId: number, s: SchrittInput, o: { nach?: number | null } = {}): { id: number } | { fehler: string[] } {
  if (!getLernpaket(paketId)) return { fehler: ["Dieses Lernpaket gibt es nicht."] };
  const out = pruefeSchritt(s);
  if ("fehler" in out) return out;
  const conn = db();
  let id = 0;
  conn.transaction(() => {
    const liste = listSchritte(paketId);
    const nach = o.nach ? liste.findIndex((x) => x.id === o.nach) : -1;
    const pos = nach >= 0 ? nach + 1 : liste.length;
    id = insertSchritt(paketId, pos, { ...out.wert, aufgaben: [] });
    renumber(paketId, [...liste.slice(0, pos).map((x) => x.id), id, ...liste.slice(pos).map((x) => x.id)]);
    touch(paketId);
  })();
  return { id };
}

function insertSchritt(paketId: number, position: number, s: z.infer<typeof SchrittFormSchema> & { aufgaben: TaskDraft[] }): number {
  const r = db()
    .prepare(
      `INSERT INTO lernpaket_schritte (paket_id, position, art, titel, minuten, lehrer_sagt, folie, lehrer_fragt, erwartete_antwort, bei_fehler, notiz, aufgaben, pruefen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(paketId, position, s.art, s.titel, s.minuten, s.lehrer_sagt, s.folie, s.lehrer_fragt, s.erwartete_antwort, s.bei_fehler, s.notiz, JSON.stringify(s.aufgaben), JSON.stringify(s.pruefen));
  return Number(r.lastInsertRowid);
}

function renumber(paketId: number, ids: number[]) {
  const set = db().prepare("UPDATE lernpaket_schritte SET position = ? WHERE id = ? AND paket_id = ?");
  ids.forEach((id, i) => set.run(i, id, paketId));
}

export function updateSchritt(id: number, s: SchrittInput): { ok: true } | { fehler: string[] } {
  const alt = getSchritt(id);
  if (!alt) return { fehler: ["Diesen Schritt gibt es nicht mehr."] };
  const out = pruefeSchritt(s);
  if ("fehler" in out) return out;
  const w = out.wert;
  db()
    .prepare("UPDATE lernpaket_schritte SET art = ?, titel = ?, minuten = ?, lehrer_sagt = ?, folie = ?, lehrer_fragt = ?, erwartete_antwort = ?, bei_fehler = ?, notiz = ?, pruefen = ? WHERE id = ?")
    .run(w.art, w.titel, w.minuten, w.lehrer_sagt, w.folie, w.lehrer_fragt, w.erwartete_antwort, w.bei_fehler, w.notiz, JSON.stringify(w.pruefen), id);
  touch(alt.paket_id);
  return { ok: true };
}

/** Moves a step one place up (-1) or down (+1). */
export function verschiebeSchritt(id: number, richtung: -1 | 1): boolean {
  const s = getSchritt(id);
  if (!s) return false;
  const ids = listSchritte(s.paket_id).map((x) => x.id);
  const i = ids.indexOf(id);
  const j = i + richtung;
  if (j < 0 || j >= ids.length) return false;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  db().transaction(() => {
    renumber(s.paket_id, ids);
    touch(s.paket_id);
  })();
  return true;
}

/** Removes one step (the package itself is only ever archived). */
export function entferneSchritt(id: number): boolean {
  const s = getSchritt(id);
  if (!s) return false;
  db().transaction(() => {
    db().prepare("DELETE FROM lernpaket_schritte WHERE id = ?").run(id);
    renumber(s.paket_id, listSchritte(s.paket_id).map((x) => x.id));
    touch(s.paket_id);
  })();
  return true;
}

/** A task of the Aufgabenbibliothek, copied into a step (checked like an imported one). */
export function aufgabeAusBibliothek(schrittId: number, eintragId: number): { ok: true } | { fehler: string } {
  const s = getSchritt(schrittId);
  const p = s ? getLernpaket(s.paket_id) : null;
  const e = getLibraryEntry(eintragId);
  if (!s || !p) return { fehler: "Diesen Schritt gibt es nicht mehr." };
  if (!e) return { fehler: "Diese Aufgabe gibt es in der Bibliothek nicht mehr." };
  if (s.aufgaben.length >= GRENZEN.aufgaben) return { fehler: `Ein Schritt hat höchstens ${GRENZEN.aufgaben} Aufgaben.` };
  const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = e.task;
  void _i, void _w, void _p, void _l;
  const out = pruefeAufgabe(draft, { skillIds: p.skill_ids, schwierigkeit: p.schwierigkeit, fach: p.fach });
  if ("fehler" in out) return { fehler: out.fehler };
  setzeAufgaben(s, [...s.aufgaben, out.aufgabe]);
  return { ok: true };
}

export function entferneAufgabe(schrittId: number, index: number): boolean {
  const s = getSchritt(schrittId);
  if (!s || index < 0 || index >= s.aufgaben.length) return false;
  setzeAufgaben(s, s.aufgaben.filter((_, i) => i !== index));
  return true;
}

function setzeAufgaben(s: LernpaketSchritt, aufgaben: TaskDraft[]) {
  db().prepare("UPDATE lernpaket_schritte SET aufgaben = ? WHERE id = ?").run(JSON.stringify(aufgaben), s.id);
  touch(s.paket_id);
}

// ---------- import and export ----------

/**
 * Reads a file and stores it as a new package: Entwurf, quelle „import“, not yet geprüft. A KI draft comes
 * the same way, with quelle „ki“ and its request in the cost log (lib/lernpaket-ki.ts).
 */
export function importiereLernpaket(roh: string | unknown, teacherId: number | null, o: { quelle?: "import" | "ki"; kiCallId?: number | null } = {}): { id: number } | { fehler: string[] } {
  const r = leseLernpaket(roh);
  if (!r.ok) return { fehler: r.fehler };
  const d = r.datei;
  const conn = db();
  let id = 0;
  conn.transaction(() => {
    id = insertPaket(
      { title: d.titel, fach: d.fach, schulart: d.schulart, klasse: d.klasse, thema: d.thema, skill_ids: d.faehigkeiten, schwierigkeit: d.schwierigkeit, dauer_minuten: d.dauer_minuten, ziel: d.ziel },
      o.quelle ?? "import",
      teacherId,
      o.kiCallId ?? null,
    );
    d.schritte.forEach((s, i) => insertSchritt(id, i, s));
  })();
  return { id };
}

/** The package as a file in the import format; importing it again gives the same package. */
export function exportiereLernpaket(id: number): LernpaketDatei | null {
  const p = getLernpaket(id);
  if (!p) return null;
  return {
    format: LERNPAKET_FORMAT,
    version: LERNPAKET_VERSION,
    titel: p.title,
    fach: p.fach,
    schulart: p.schulart,
    klasse: p.klasse,
    thema: p.thema,
    faehigkeiten: p.skill_ids,
    schwierigkeit: p.schwierigkeit,
    dauer_minuten: p.schritte.reduce((n, s) => n + s.minuten, 0),
    ziel: p.ziel,
    schritte: p.schritte.map((s) => ({
      art: s.art,
      titel: s.titel,
      minuten: s.minuten,
      lehrer_sagt: s.lehrer_sagt,
      folie: s.folie,
      lehrer_fragt: s.lehrer_fragt,
      erwartete_antwort: s.erwartete_antwort,
      bei_fehler: s.bei_fehler,
      notiz: s.notiz,
      pruefen: s.pruefen,
      // the ids of a source only mean something in this database
      aufgaben: s.aufgaben.map(({ sourceType: _t, sourceId: _i, ...a }) => (void _t, void _i, a)),
    })),
  };
}

/** File name for the export: „lernpaket-die-vier-faelle.json“. */
export function exportDateiname(p: Pick<Lernpaket, "title">): string {
  const slug = p.title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `lernpaket-${slug || "export"}.json`;
}
