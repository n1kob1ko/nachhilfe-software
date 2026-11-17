/**
 * Fehlerprotokoll je Schüler (niko 2026-11-17, Punkt 5 des Plans zur Textinterpretation): die Fehler aus den eigenen
 * Texten, „Falsch → Richtig“, wie die Lehrkraft sie auf Papier führt. In der Schüler-App ist es das Spiel „Meine Fehler“,
 * auch im Blockwerk und im Torlauf; die Lehrkraft schreibt es beim Schüler unter „Fehlerprotokoll“.
 *
 * Die Regel der Lehrkraft: ein Fehler fliegt raus, wenn er zweimal hintereinander richtig war (`RAUS_NACH`). Gezählt
 * wird der erste Versuch je Karte in den beendeten Runden „Meine Fehler“; ein Fehler dazwischen setzt die Folge auf null.
 * Ein geschaffter Fehler bleibt im Text stehen und ist in der Liste der Lehrkraft abgehakt; ändert sie die falsche Form,
 * ist es ein neuer Fehler.
 *
 * Die Runden zählen für keine Fähigkeit im Lernstand (`FEHLER_SKILL`): es sind die eigenen Fehler, kein Thema.
 */
import { db, json } from "./db";
import type { Kandidat } from "./lernspiele-karten";
import * as repo from "./repo";
import { alsFehlerKarte, fehlerKey, leseFehler, RAUS_NACH, type FehlerEintrag } from "./fehlerprotokoll-text";

export const FEHLER_SKILL = "stoff.fehler";
/** So viele Runden zurück liest der Stand (reicht für viele Wochen „5 Minuten am Anfang“). */
const RUNDEN_MAX = 400;

export type FehlerprotokollRow = { student_id: number; teacher_id: number | null; text: string; updated_at: string };

export function fehlerprotokoll(studentId: number): FehlerprotokollRow | null {
  return (db().prepare("SELECT * FROM fehlerprotokolle WHERE student_id = ?").get(studentId) as FehlerprotokollRow | undefined) ?? null;
}

export type Speichern = { ok: true } | { ok: false; fehler: string[] };

/** Speichert das Protokoll eines Schülers (ein leerer Text löscht es). Zeilen mit Fehlern halten das Speichern auf. */
export function speichereFehlerprotokoll(studentId: number, teacherId: number | null, roh: string): Speichern {
  const text = roh.replace(/\r\n?/g, "\n").trimEnd();
  const gelesen = leseFehler(text);
  const fehler = gelesen.fehler.map((m) => m.text);
  if (!repo.getStudent(studentId)) fehler.push("Diese Schülerin bzw. diesen Schüler gibt es nicht mehr.");
  if (fehler.length) return { ok: false, fehler };
  if (!text.trim()) {
    db().prepare("DELETE FROM fehlerprotokolle WHERE student_id = ?").run(studentId);
    return { ok: true };
  }
  db()
    .prepare(
      "INSERT INTO fehlerprotokolle (student_id, teacher_id, text, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(student_id) DO UPDATE SET teacher_id = excluded.teacher_id, text = excluded.text, updated_at = excluded.updated_at",
    )
    .run(studentId, teacherId, text);
  return { ok: true };
}

export type FehlerStand = FehlerEintrag & {
  key: string;
  /** erste Versuche insgesamt, davon richtig */
  versuche: number;
  treffer: number;
  /** so oft zuletzt hintereinander richtig */
  folge: number;
  geschafft: boolean;
};

/** Jeder Fehler des Protokolls mit dem, was der Schüler damit gespielt hat (in der Reihenfolge des Textes). */
export function fehlerStand(studentId: number): FehlerStand[] {
  const p = fehlerprotokoll(studentId);
  if (!p) return [];
  const eintraege = leseFehler(p.text).eintraege;
  const keys = new Set(eintraege.map(fehlerKey));
  const rows = (
    db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'fehler' AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT ?").all(studentId, RUNDEN_MAX) as { antworten: string }[]
  ).reverse();
  const je = new Map<string, { versuche: number; treffer: number; folge: number }>();
  for (const r of rows) {
    for (const a of json<{ key: string; richtig: boolean }[]>(r.antworten, []) ?? []) {
      if (!keys.has(a.key)) continue;
      const z = je.get(a.key) ?? { versuche: 0, treffer: 0, folge: 0 };
      z.versuche++;
      if (a.richtig) {
        z.treffer++;
        z.folge++;
      } else z.folge = 0;
      je.set(a.key, z);
    }
  }
  return eintraege.map((e) => {
    const key = fehlerKey(e);
    const z = je.get(key) ?? { versuche: 0, treffer: 0, folge: 0 };
    return { ...e, key, ...z, geschafft: z.folge >= RAUS_NACH };
  });
}

/** Die Fehler, die noch im Spiel sind (nicht zweimal hintereinander richtig). */
export const offeneFehlerZahl = (studentId: number) => fehlerStand(studentId).filter((e) => !e.geschafft).length;

/** Die Karten für „Meine Fehler“: nur die offenen, alle gleich wichtig. */
export function fehlerKandidaten(studentId: number): Kandidat[] {
  return fehlerStand(studentId)
    .filter((e) => !e.geschafft)
    .map((e) => ({ karte: alsFehlerKarte(e, FEHLER_SKILL), stufe: 1 as const }));
}
