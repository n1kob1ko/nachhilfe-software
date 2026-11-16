/**
 * Spielkarten: eigener Stoff eines Schülers für die Lernspiele, in jedem Fach (niko 2026-11-16, Bio „Evolution und
 * Plattentektonik“). Ein Satz Karten hat einen Titel, ein Fach und den Text der Karten (lib/spielkarten-text.ts). Die
 * Lehrkraft schreibt ihn beim Schüler unter „Spielkarten“ oder übernimmt ihn aus „Stoff vorbereiten“ (lib/stoffpaket.ts).
 *
 * In der Schüler-App ist der neueste aktive Satz das Spiel „Dein Stoff“ (lib/lernspiele.ts, Art `stoff`), auch als
 * Fragen im Blockwerk. Die App prüft jede Antwort an den gespeicherten Karten, nie mit KI.
 */
import { db, json } from "./db";
import type { Kandidat } from "./lernspiele-karten";
import * as repo from "./repo";
import { alsSpielKarte, KARTEN_MIN, leseKarten, type EigeneKarte } from "./spielkarten-text";

export type SpielkartenRow = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  titel: string;
  fach: string;
  text: string;
  skill_id: string | null;
  stoffpaket_id: number | null;
  aktiv: number;
  created_at: string;
  updated_at: string;
};
export type Spielkarten = SpielkartenRow & { karten: number };

/** Die Fähigkeit der Runden, wenn der Satz an keiner hängt: zählt nicht für eine Fähigkeit im Lernstand. */
export const EIGENER_STOFF = "stoff.eigen";
export const TITEL_MAX = 80;
/** So lange gilt ein Satz als aktueller Stoff (danach kommt er nur noch zum Wiederholen). */
export const FRISCH_TAGE = 30;

const mitZahl = (r: SpielkartenRow): Spielkarten => ({ ...r, karten: leseKarten(r.text).karten.length });

/** Die Sätze eines Schülers, der zuletzt geänderte zuerst. */
export function saetzeVon(studentId: number): Spielkarten[] {
  return (db().prepare("SELECT * FROM spielkarten WHERE student_id = ? ORDER BY updated_at DESC, id DESC").all(studentId) as SpielkartenRow[]).map(mitZahl);
}

export function getSatz(id: number): Spielkarten | null {
  const r = db().prepare("SELECT * FROM spielkarten WHERE id = ?").get(id) as SpielkartenRow | undefined;
  return r ? mitZahl(r) : null;
}

export type Speichern = { ok: true; id: number } | { ok: false; fehler: string[] };

/** Speichert einen neuen Satz (ohne id) oder ändert einen desselben Schülers. Zeilen mit Fehlern halten das Speichern auf. */
export function speichereSatz(input: {
  id?: number | null;
  studentId: number;
  teacherId: number | null;
  titel: string;
  fach: string;
  text: string;
  aktiv?: boolean;
  skillId?: string | null;
  stoffpaketId?: number | null;
}): Speichern {
  const titel = input.titel.replace(/\s+/g, " ").trim();
  const fach = input.fach.replace(/\s+/g, " ").trim().slice(0, 40);
  const text = input.text.replace(/\r\n?/g, "\n").trimEnd();
  const fehler: string[] = [];
  if (!titel) fehler.push("Gib den Karten einen Namen, zum Beispiel „Evolution“.");
  if (titel.length > TITEL_MAX) fehler.push(`Der Name hat höchstens ${TITEL_MAX} Zeichen.`);
  const gelesen = leseKarten(text);
  fehler.push(...gelesen.fehler.map((m) => m.text));
  if (!gelesen.fehler.length && !gelesen.karten.length) fehler.push("Schreib mindestens eine Karte, zum Beispiel: Wer sagte „Arten sind unveränderlich“? = Cuvier | Lamarck | Darwin");
  if (!repo.getStudent(input.studentId)) fehler.push("Diese Schülerin bzw. diesen Schüler gibt es nicht mehr.");
  if (fehler.length) return { ok: false, fehler };
  const aktiv = input.aktiv === false ? 0 : 1;
  if (input.id) {
    const alt = getSatz(input.id);
    if (!alt || alt.student_id !== input.studentId) return { ok: false, fehler: ["Diese Spielkarten gibt es nicht mehr."] };
    db().prepare("UPDATE spielkarten SET titel = ?, fach = ?, text = ?, aktiv = ?, updated_at = datetime('now') WHERE id = ?").run(titel, fach, text, aktiv, input.id);
    return { ok: true, id: input.id };
  }
  const r = db()
    .prepare("INSERT INTO spielkarten (student_id, teacher_id, titel, fach, text, aktiv, skill_id, stoffpaket_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(input.studentId, input.teacherId, titel, fach, text, aktiv, input.skillId ?? null, input.stoffpaketId ?? null);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

export function loescheSatz(id: number): void {
  db().prepare("DELETE FROM spielkarten WHERE id = ?").run(id);
}

/** Im Spiel oder nicht: ein Satz, der nicht mehr dran ist, bleibt gespeichert. */
export function setzeAktiv(id: number, aktiv: boolean): void {
  db().prepare("UPDATE spielkarten SET aktiv = ?, updated_at = datetime('now') WHERE id = ?").run(aktiv ? 1 : 0, id);
}

/** Der Satz, den „Dein Stoff“ spielt: der zuletzt geänderte aktive mit genug Karten; null, wenn es keinen gibt. */
export function spielSatz(studentId: number): Spielkarten | null {
  return saetzeVon(studentId).find((s) => s.aktiv && s.karten >= KARTEN_MIN) ?? null;
}

/** Ist der Satz aktueller Stoff (in den letzten 30 Tagen angelegt oder geändert)? `heute`: Wiener Datum. */
export function istFrisch(s: Pick<SpielkartenRow, "updated_at">, heute: string): boolean {
  const tage = (Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${s.updated_at.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
  return tage <= FRISCH_TAGE;
}

/** Die Fähigkeit, an der die Runden des Satzes hängen. */
export const satzSkill = (s: Pick<SpielkartenRow, "skill_id">) => s.skill_id || EIGENER_STOFF;

/** Die Karten des Satzes für das Lernspiel (alle auf derselben Stufe: es ist der Stoff, den die Lehrkraft will). */
export function satzKandidaten(s: Spielkarten): Kandidat[] {
  const skill = satzSkill(s);
  return leseKarten(s.text).karten.map((k: EigeneKarte) => ({ karte: alsSpielKarte(k, skill), stufe: 1 }));
}

export type SatzStand = { runden: number; richtig: number; antworten: number; schwer: { loesung: string; mal: number }[] };

/** Was der Schüler mit den Karten dieses Satzes gespielt hat (letzte 60 Runden „Dein Stoff“, auch im Blockwerk). */
export function satzStand(s: Spielkarten): SatzStand {
  const karten = new Map(satzKandidaten(s).map((k) => [k.karte.key, k.karte]));
  const rows = db()
    .prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'stoff' AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 60")
    .all(s.student_id) as { antworten: string }[];
  let runden = 0;
  let richtig = 0;
  let antworten = 0;
  const falsch = new Map<string, number>();
  for (const r of rows) {
    const eigene = (json<{ key: string; richtig: boolean }[]>(r.antworten, []) ?? []).filter((a) => karten.has(a.key));
    if (!eigene.length) continue;
    runden++;
    for (const a of eigene) {
      antworten++;
      if (a.richtig) richtig++;
      else falsch.set(a.key, (falsch.get(a.key) ?? 0) + 1);
    }
  }
  const schwer = [...falsch.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, mal]) => ({ loesung: karten.get(key)!.loesung, mal }));
  return { runden, richtig, antworten, schwer };
}

/** Die Spielkarten, die ein Lauf von „Stoff vorbereiten“ gemacht hat (lib/stoffpaket.ts). */
export function spielkartenVon(stoffpaketId: number): Spielkarten[] {
  return (db().prepare("SELECT * FROM spielkarten WHERE stoffpaket_id = ? ORDER BY id").all(stoffpaketId) as SpielkartenRow[]).map(mitZahl);
}
