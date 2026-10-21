/**
 * Die festen Regeln der **Probeschularbeit** (lib/probeschularbeit.ts): Dauer, Aufbau, Punkte und
 * Notenschlüssel. Ohne Datenbank, damit auch die Formulare im Browser sie benutzen können.
 */
import type { Difficulty } from "./curriculum";
import type { TaskDraft } from "./tasks";
import { maturaFormat, MATURA_PUNKTE } from "./matura-formate";
import { englischPunkte } from "./englisch-matura-formate";

/** Wie lange die Schularbeit dauert, in Minuten, und wie viele Aufgaben dazu passen. */
export const DAUER = [25, 50, 100] as const;
export type Dauer = (typeof DAUER)[number];
export const DAUER_STANDARD: Dauer = 50;
export const ANZAHL: Record<Dauer, number> = { 25: 5, 50: 8, 100: 12 };
export const isDauer = (x: number): x is Dauer => (DAUER as readonly number[]).includes(x);

/**
 * Die Schwierigkeit jeder Aufgabe, in der Reihenfolge der Probeschularbeit: etwa 30 % leicht, 50 % mittel,
 * 20 % schwer (mindestens eine schwere ab vier Aufgaben), leichte zuerst.
 */
export function schwierigkeiten(n: number): Difficulty[] {
  if (n <= 0) return [];
  const schwer = n >= 4 ? Math.max(1, Math.round(n * 0.2)) : 0;
  const leicht = Math.min(n - schwer, Math.max(1, Math.round(n * 0.3)));
  const mittel = n - schwer - leicht;
  return [...Array<Difficulty>(leicht).fill("leicht"), ...Array<Difficulty>(mittel).fill("mittel"), ...Array<Difficulty>(schwer).fill("schwer")];
}

export type PlanPlatz = { skillId: string; difficulty: Difficulty };

/**
 * Welche Fähigkeit an welcher Stelle: reihum über die Fähigkeiten (die schwächsten zuerst), so dass jede
 * Fähigkeit mindestens einmal drankommt, wenn es genug Aufgaben gibt, und in verschiedenen Schwierigkeiten.
 */
export function planeProbeschularbeit(skillIds: string[], n: number): PlanPlatz[] {
  const ids = [...new Set(skillIds)];
  if (!ids.length) return [];
  return schwierigkeiten(n).map((difficulty, i) => ({ skillId: ids[i % ids.length], difficulty }));
}

// ---------- Punkte und Notenschlüssel ----------

/** Punkte nach Schwierigkeit, solange der Lehrer nichts anderes einträgt. */
export const PUNKTE_STANDARD: Record<Difficulty, number> = { "sehr leicht": 1, leicht: 2, "leicht bis mittel": 2, mittel: 3, schwer: 4, "sehr schwer": 5 };
export const PUNKTE_MAX = 20;

/**
 * Die Vorgabe für eine Aufgabe: nach Schwierigkeit, eine Sachaufgabe mit mehreren Teilen je Teil einen mehr.
 * Eine Aufgabe im Matura-Format gibt wie bei der Matura 0 oder 1 Punkt (lib/matura-formate.ts), eine der
 * Englisch-Matura einen Punkt je Aussage, Frage, Lücke oder Zeile (lib/englisch-matura-formate.ts).
 */
export function standardPunkte(t: Pick<TaskDraft, "difficulty" | "type" | "data"> & { answer?: TaskDraft["answer"]; category?: string | null }): number {
  if (maturaFormat({ type: t.type, data: t.data, answer: t.answer ?? {}, category: t.category })) return MATURA_PUNKTE;
  const englisch = englischPunkte({ type: t.type, data: t.data, answer: t.answer ?? {}, category: t.category });
  if (englisch) return englisch;
  const base = PUNKTE_STANDARD[t.difficulty] ?? 3;
  const teile = t.type === "sachaufgabe" ? (t.data.parts?.length ?? 0) : 0;
  return teile > 1 ? base + teile - 1 : base;
}

export const NOTEN = [
  { note: 1, label: "Sehr gut" },
  { note: 2, label: "Gut" },
  { note: 3, label: "Befriedigend" },
  { note: 4, label: "Genügend" },
  { note: 5, label: "Nicht genügend" },
] as const;
export type Note = (typeof NOTEN)[number];

/**
 * Ab wie viel Prozent der Punkte es Sehr gut, Gut, Befriedigend und Genügend gibt. Ein Vorschlag (in
 * Achteln: 7/8, 6/8, 5/8, 4/8), keine Vorgabe der Schule: jede Lehrkraft hat ihren eigenen; änderbar unter
 * Mehr › Curriculum / Lehrplan › Einstellungen (lib/probeschularbeit.ts).
 */
export const SCHLUESSEL_STANDARD: [number, number, number, number] = [87.5, 75, 62.5, 50];

/** Ab wie vielen Punkten es jede Note gibt (auf halbe Punkte aufgerundet); Nicht genügend hat keine Grenze. */
export function schluesselTabelle(gesamt: number, grenzen: readonly number[]): { note: Note; ab: number | null }[] {
  return NOTEN.map((note, i) => ({ note, ab: i < 4 ? Math.ceil(((gesamt * grenzen[i]) / 100) * 2 - 1e-9) / 2 : null }));
}

/** Die Note für so viele Punkte. */
export function noteFuer(punkte: number, gesamt: number, grenzen: readonly number[]): Note {
  const zeile = schluesselTabelle(gesamt, grenzen).find((z) => z.ab !== null && punkte >= z.ab);
  return zeile?.note ?? NOTEN[4];
}

/** „12,5“: Punkte wie auf dem Blatt, halbe mit Komma. */
export const punkteText = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1).replace(".", ","));

export type NotenBereich = { note: Note; von: number; bis: number };

/**
 * Von wie vielen bis wie viele Punkte es jede Note gibt, wie im Notenschlüssel unter einer Schularbeit
 * („21–24“, „0–11,5“), in halben Punkten. Bei sehr wenigen Punkten kann eine Note leer bleiben: dann
 * fehlt sie hier.
 */
export function notenBereiche(gesamt: number, grenzen: readonly number[]): NotenBereich[] {
  const tabelle = schluesselTabelle(gesamt, grenzen);
  return tabelle.flatMap(({ note, ab }, i) => {
    const von = ab ?? 0;
    const bis = i === 0 ? gesamt : (tabelle[i - 1].ab ?? 0) - 0.5;
    return bis >= von ? [{ note, von, bis }] : [];
  });
}

/** „21–24“, oder eine Zahl, wenn von und bis gleich sind. */
export const bereichText = (b: Pick<NotenBereich, "von" | "bis">) => (b.von === b.bis ? punkteText(b.von) : `${punkteText(b.von)}–${punkteText(b.bis)}`);

/**
 * Die Punkte vom Blatt einer auf Papier gelösten Übung (lib/blatt-einlesen.ts, taskId → erreicht), oder null für
 * eine Übung vom Gerät.
 */
export function papierPunkte(settings: string | null): Record<number, number> | null {
  if (!settings) return null;
  try {
    const p = (JSON.parse(settings) as { papier?: { erreicht?: Record<string, number> } }).papier;
    if (!p?.erreicht) return null;
    return Object.fromEntries(Object.entries(p.erreicht).map(([k, v]) => [Number(k), Number(v)]));
  } catch {
    return null;
  }
}
