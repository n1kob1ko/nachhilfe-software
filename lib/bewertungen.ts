/**
 * **Aufgaben bewerten** (Plan 4.1, niko 2026-10-23): Lehrer geben einer Aufgabe 1 bis 5 Sterne, kreuzen Gründe an und
 * schreiben bei Bedarf einen Kommentar. Eine Bewertung je Aufgabe und Lehrer, änderbar (Tabelle `aufgabe_bewertungen`).
 * Getrennt von Schülerleistungen: Versuche, Lernstand und Ergebnisse bleiben unberührt.
 *
 * Eine Aufgabe ist ihr Inhalt (`aufgabeSchluessel`: Format, Text, Daten, Antwort). Die Kopie in einer Übung, in der
 * Bibliothek und im Schritt eines Lernpakets ist dieselbe Aufgabe mit derselben Bewertung. Eine verbesserte Aufgabe
 * (anderer Text oder andere Lösung) ist eine neue, noch ohne Bewertung. Auch eine Aufgabe aus einem Generator hat so
 * ihren festen Schlüssel; eine neu erzeugte Variante mit anderen Zahlen ist eine andere Aufgabe. Den Generator selbst
 * bewertet niemand.
 *
 * Gut bewertete Aufgaben kommen in Suche und Auswahl zuerst und gehen der KI als Vorbild mit; schlecht bewertete
 * fehlen in Vorschlägen und automatischer Auswahl (lib/bewertung-regeln.ts). Gelöscht wird nichts.
 */
import { createHash } from "node:crypto";
import { db, json } from "./db";
import { GRUENDE, isGrund, KOMMENTAR_MAX, OHNE_BEWERTUNG, rang, stand, type BewertungInfo, type Grund, type MeineBewertung, type Stand } from "./bewertung-regeln";
import { maskText, namePattern } from "./text-correction-core";
import type { TaskDraft } from "./tasks";

/** Was eine Aufgabe ausmacht; Fähigkeit, Schwierigkeit, Hilfen und Herkunft gehören nicht dazu. */
export type AufgabeInhalt = Pick<TaskDraft, "type" | "prompt" | "data" | "answer">;

const leer = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
/** Gleicher Inhalt, gleiche Form: Schlüssel sortiert, leere Felder weg (der Import eines Lernpakets lässt sie aus). */
function kanonisch(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(kanonisch);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => !leer(o[k]))
        .map((k) => [k, kanonisch(o[k])]),
    );
  }
  return v;
}

/** Der Schlüssel einer Aufgabe: derselbe für jede Kopie mit gleichem Inhalt. „Bitte prüfen“ zählt nicht dazu. */
export function aufgabeSchluessel(t: AufgabeInhalt): string {
  const { pruefen: _p, ...data } = t.data ?? {};
  void _p;
  const inhalt = JSON.stringify([t.type, t.prompt.replace(/\s+/g, " ").trim(), kanonisch(data), kanonisch(t.answer ?? {})]);
  return createHash("sha256").update(inhalt).digest("hex").slice(0, 32);
}

type Zeile = { schluessel: string; teacher_id: number; sterne: number; gruende: string; kommentar: string; name: string };

function zeilen(schluessel: string[]): Zeile[] {
  const out: Zeile[] = [];
  const keys = [...new Set(schluessel)];
  for (let i = 0; i < keys.length; i += 500) {
    const teil = keys.slice(i, i + 500);
    out.push(
      ...(db()
        .prepare(
          `SELECT b.schluessel, b.teacher_id, b.sterne, b.gruende, b.kommentar, COALESCE(t.name, '') AS name
           FROM aufgabe_bewertungen b LEFT JOIN teachers t ON t.id = b.teacher_id
           WHERE b.schluessel IN (${teil.map(() => "?").join(",")}) ORDER BY b.updated_at DESC, b.id DESC`,
        )
        .all(...teil) as Zeile[]),
    );
  }
  return out;
}

const gruendeAus = (raw: string): Grund[] => [...new Set(json<unknown[]>(raw, []).filter(isGrund))];

function standAus(rows: Zeile[]): Stand {
  if (!rows.length) return OHNE_BEWERTUNG;
  const gruende: Partial<Record<Grund, number>> = {};
  for (const r of rows) for (const g of gruendeAus(r.gruende)) gruende[g] = (gruende[g] ?? 0) + 1;
  return stand(rows.reduce((s, r) => s + r.sterne, 0) / rows.length, rows.length, gruende);
}

/** Der Stand jeder Aufgabe (nach Schlüssel); ohne Bewertung fehlt sie in der Map. */
export function staende(schluessel: string[]): Map<string, Stand> {
  const nach = new Map<string, Zeile[]>();
  for (const r of zeilen(schluessel)) nach.set(r.schluessel, [...(nach.get(r.schluessel) ?? []), r]);
  return new Map([...nach].map(([k, rows]) => [k, standAus(rows)]));
}

export const standVon = (t: AufgabeInhalt): Stand => staende([aufgabeSchluessel(t)]).get(aufgabeSchluessel(t)) ?? OHNE_BEWERTUNG;

/** Was die Seite zu jeder Aufgabe zeigt, in derselben Reihenfolge: der Stand, die eigene Bewertung, Kommentare der anderen. */
export function bewertungInfos(tasks: AufgabeInhalt[], teacherId: number | null): BewertungInfo[] {
  const keys = tasks.map(aufgabeSchluessel);
  const nach = new Map<string, Zeile[]>();
  for (const r of zeilen(keys)) nach.set(r.schluessel, [...(nach.get(r.schluessel) ?? []), r]);
  return keys.map((k) => {
    const rows = nach.get(k) ?? [];
    const mine = rows.find((r) => r.teacher_id === teacherId);
    return {
      ...standAus(rows),
      schluessel: k,
      meine: mine ? { sterne: mine.sterne, gruende: gruendeAus(mine.gruende), kommentar: mine.kommentar } : null,
      andere: rows.filter((r) => r !== mine && r.kommentar.trim()).map((r) => ({ name: r.name.split(" ")[0], sterne: r.sterne, kommentar: r.kommentar })),
    };
  });
}

/** Dasselbe nach der id der Aufgabe (für die Seiten einer Übung). */
export function bewertungenJeAufgabe(tasks: (AufgabeInhalt & { id: number })[], teacherId: number | null): Record<number, BewertungInfo> {
  const infos = bewertungInfos(tasks, teacherId);
  return Object.fromEntries(tasks.map((t, i) => [t.id, infos[i]]));
}

/** Die Schlüssel aller ausgeblendeten Aufgaben (für die Auswahl ohne KI, eine Abfrage). */
export function ausgeblendet(): Set<string> {
  const rows = db().prepare("SELECT schluessel, teacher_id, sterne, gruende, kommentar, '' AS name FROM aufgabe_bewertungen").all() as Zeile[];
  const nach = new Map<string, Zeile[]>();
  for (const r of rows) nach.set(r.schluessel, [...(nach.get(r.schluessel) ?? []), r]);
  return new Set([...nach].filter(([, rs]) => standAus(rs).ausgeblendet).map(([k]) => k));
}

/** Die Aufgaben ohne die ausgeblendeten. */
export function ohneAusgeblendete<T extends AufgabeInhalt>(tasks: T[]): T[] {
  const weg = ausgeblendet();
  return weg.size ? tasks.filter((t) => !weg.has(aufgabeSchluessel(t))) : tasks;
}

/** Gut bewertete zuerst, schlecht bewertete zuletzt; sonst bleibt die Reihenfolge. */
export function nachBewertung<T>(items: T[], inhalt: (x: T) => AufgabeInhalt): T[] {
  const keys = items.map((x) => aufgabeSchluessel(inhalt(x)));
  const st = staende(keys);
  return items
    .map((x, i) => ({ x, i, r: rang(st.get(keys[i]) ?? OHNE_BEWERTUNG) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map((e) => e.x);
}

export type BewertungEingabe = { sterne: number; gruende: string[]; kommentar: string };

/** Prüft die Eingabe: 1 bis 5 Sterne, nur bekannte Gründe, Kommentar gekürzt. */
export function pruefeBewertung(e: BewertungEingabe): MeineBewertung | { fehler: string } {
  const sterne = Number(e.sterne);
  if (!Number.isInteger(sterne) || sterne < 1 || sterne > 5) return { fehler: "Bitte 1 bis 5 Sterne wählen." };
  return { sterne, gruende: [...new Set(e.gruende.filter(isGrund))], kommentar: String(e.kommentar ?? "").trim().slice(0, KOMMENTAR_MAX) };
}

/**
 * Speichert die Bewertung eines Lehrers (eine je Aufgabe und Lehrer; eine zweite ersetzt die erste). Die Aufgabe wird
 * mitgespeichert, wie sie bewertet wurde, damit sie der KI als Vorbild dienen kann. Schreibt nur in aufgabe_bewertungen.
 */
export function bewerte(t: TaskDraft, fach: string, teacherId: number, e: BewertungEingabe): { ok: true; schluessel: string } | { fehler: string } {
  const b = pruefeBewertung(e);
  if ("fehler" in b) return b;
  if (!t.prompt.trim()) return { fehler: "Die Aufgabe hat noch keinen Text." };
  const schluessel = aufgabeSchluessel(t);
  const aufgabe: TaskDraft = { type: t.type, skillId: t.skillId, skillIds: t.skillIds, category: t.category ?? null, difficulty: t.difficulty, prompt: t.prompt, data: t.data, answer: t.answer, solution: t.solution, hints: t.hints, errorMap: t.errorMap };
  db()
    .prepare(
      `INSERT INTO aufgabe_bewertungen (schluessel, teacher_id, sterne, gruende, kommentar, fach, skill_id, aufgabe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (schluessel, teacher_id) DO UPDATE SET sterne = excluded.sterne, gruende = excluded.gruende, kommentar = excluded.kommentar,
         fach = excluded.fach, skill_id = excluded.skill_id, aufgabe = excluded.aufgabe, updated_at = datetime('now')`,
    )
    .run(schluessel, teacherId, b.sterne, JSON.stringify(b.gruende), b.kommentar, fach, t.skillId ?? null, JSON.stringify(aufgabe));
  return { ok: true, schluessel };
}

/** Nimmt die eigene Bewertung zurück. */
export function entferneBewertung(t: AufgabeInhalt, teacherId: number) {
  db().prepare("DELETE FROM aufgabe_bewertungen WHERE schluessel = ? AND teacher_id = ?").run(aufgabeSchluessel(t), teacherId);
}

/** Gut bewertete Aufgaben einer Fähigkeit, die besten zuerst (wie zuletzt bewertet). */
export function gutBewertet(skillIds: string[], n = 3): TaskDraft[] {
  const ids = [...new Set(skillIds.filter(Boolean))];
  if (!ids.length || n <= 0) return [];
  const rows = db()
    .prepare(`SELECT schluessel, aufgabe FROM aufgabe_bewertungen WHERE skill_id IN (${ids.map(() => "?").join(",")}) ORDER BY updated_at DESC, id DESC`)
    .all(...ids) as { schluessel: string; aufgabe: string }[];
  const aufgabe = new Map<string, TaskDraft>();
  for (const r of rows) if (!aufgabe.has(r.schluessel)) aufgabe.set(r.schluessel, json<TaskDraft>(r.aufgabe, null as unknown as TaskDraft));
  const st = staende([...aufgabe.keys()]);
  return [...aufgabe]
    .filter(([k, t]) => t?.prompt && st.get(k)?.gut)
    .sort(([a], [b]) => st.get(b)!.schnitt - st.get(a)!.schnitt || st.get(b)!.anzahl - st.get(a)!.anzahl)
    .slice(0, n)
    .map(([, t]) => t);
}

/** Die Lösung in wenigen Worten, für die Zeile an die KI. */
function loesungKurz(t: TaskDraft): string {
  const a = t.answer ?? {};
  if (typeof a.correct === "number" && t.data?.options?.[a.correct]) return t.data.options[a.correct];
  if (a.accepted?.length) return a.accepted[0];
  if (a.blanks?.length) return a.blanks.map((b) => b[0] ?? "").join(" | ");
  if (a.steps?.length) return a.steps.join(" → ");
  return a.sample || t.solution || "";
}

const einzeilig = (s: string, n: number) => {
  const x = s.replace(/\s+/g, " ").trim();
  return x.length > n ? `${x.slice(0, n - 1)}…` : x;
};

/**
 * 2 bis 3 gut bewertete Aufgaben derselben Fähigkeit als Zeilen für die KI („Aufgabe → Lösung: …“). Namen von
 * Schülern und Lehrern sind durch [Name] ersetzt. Leer, wenn es keine gibt.
 */
export function vorbildZeilen(skillIds: string[], n = 3): string[] {
  const tasks = gutBewertet(skillIds, n);
  if (!tasks.length) return [];
  const namen = (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
  const pattern = namePattern(namen);
  const m = (s: string, len: number) => einzeilig(maskText(s, pattern).masked, len);
  return tasks.map((t) => {
    const loesung = loesungKurz(t);
    return `${m(t.prompt, 300)}${loesung ? ` → Lösung: ${m(loesung, 120)}` : ""}`;
  });
}

/**
 * Was Lehrer an Aufgaben dieser Fähigkeiten bemängelt haben, als eine Zeile für die KI: „Zu schwierig (3×),
 * Unverständlich (1×)“. Nur die angekreuzten Gründe, nie Kommentare (sie können Namen enthalten). Leer ohne Rückmeldung.
 */
export function rueckmeldungZeile(skillIds: string[]): string {
  const ids = [...new Set(skillIds.filter(Boolean))];
  if (!ids.length) return "";
  const rows = db()
    .prepare(`SELECT gruende FROM aufgabe_bewertungen WHERE skill_id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as { gruende: string }[];
  const n: Partial<Record<Grund, number>> = {};
  for (const r of rows) for (const g of gruendeAus(r.gruende)) if (!GRUENDE[g].gut) n[g] = (n[g] ?? 0) + 1;
  return (Object.keys(n) as Grund[])
    .sort((a, b) => n[b]! - n[a]!)
    .map((g) => `${GRUENDE[g].label} (${n[g]}×)`)
    .join(", ");
}
