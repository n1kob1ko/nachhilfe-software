/**
 * Die Übersicht in der Schüler-App (/lernen/[token]): kommende Prüfungen, Hausübungen, Unterlagen und vergangene
 * Stunden, nur zum Lesen. Jede Funktion nimmt die id des Schülers, die die Seite aus seinem Token hat, und liest nur
 * seine Zeilen. Was zurückkommt, darf der Schüler sehen: keine Notizen des Lehrers (tests.notes, homework.notes,
 * lessons.tutor_notes …), keine Einschätzung, keine Auswertung, kein Vortragstext, keine Lösung. Die Felder werden
 * hier einzeln ausgewählt, nicht die ganze Zeile weitergereicht; was nicht freigegeben ist, verlässt den Server nicht.
 */
import { db } from "./db";
import { daysUntil } from "./exams";
import { freigabeVon, zeigtAlles, zeigtLoesung } from "./freigabe";
import { wienerDatum, wienerZeitstempel } from "./planung/zeit";
import { isMinitest } from "./quick-round";
import * as repo from "./repo";

const json = <T>(raw: string | null | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

// ---------- kommende Prüfungen ----------

export type PortalPruefung = { id: number; datum: string; tage: number; art: string; fach: string; titel: string; stoff: string[] };

/** Geplante Prüfungen ab heute (Wiener Datum), die nächste zuerst. Vergangene und abgesagte nicht, auch ohne Ergebnis. */
export function kommendePruefungen(studentId: number, heute = wienerDatum()): PortalPruefung[] {
  const rows = db()
    .prepare("SELECT id, date, kind, subject, title, topic, topics FROM tests WHERE student_id = ? AND status = 'geplant' AND date >= ? ORDER BY date, id")
    .all(studentId, heute) as { id: number; date: string; kind: string; subject: string; title: string; topic: string; topics: string }[];
  return rows.map((r) => {
    const stoff = json<unknown[]>(r.topics, []).filter((x): x is string => typeof x === "string" && x.trim() !== "");
    return { id: r.id, datum: r.date, tage: daysUntil(r.date, heute), art: r.kind, fach: r.subject, titel: r.title, stoff: stoff.length ? stoff : r.topic.trim() ? [r.topic.trim()] : [] };
  });
}

// ---------- Hausübungen ----------

export type PortalHausuebung = {
  id: number;
  fach: string;
  beschreibung: string;
  faellig: string | null;
  zustand: "offen" | "ueberfaellig" | "erledigt";
  /** die Übung dazu (assignments.id), solange sie nicht archiviert ist */
  uebungId: number | null;
};

/**
 * Offene Hausübungen (die früheste Fälligkeit zuerst, ohne Fälligkeit am Ende) und erledigte als Verlauf (die
 * zuletzt fällige zuerst). Erledigt heißt wie bei „Zu erledigen“: abgehakt oder die verknüpfte Übung ist fertig
 * (repo.homeworkOpen); der Zustand wird beim Lesen berechnet, nach dem Neuladen stimmt er also.
 */
export function hausuebungen(studentId: number, heute = wienerDatum()): { offen: PortalHausuebung[]; erledigt: PortalHausuebung[] } {
  const rows = db()
    .prepare(
      `SELECT h.id, h.subject, h.description, h.due_date, h.status, h.assignment_id, a.completed_at AS assignment_completed_at,
        (a.id IS NOT NULL AND ${repo.ASSIGNMENT_ARCHIVED} IS NULL) AS uebung_da
       FROM homework h LEFT JOIN assignments a ON a.id = h.assignment_id AND a.student_id = h.student_id LEFT JOIN worksheets w ON w.id = a.worksheet_id
       WHERE h.student_id = ?`,
    )
    .all(studentId) as { id: number; subject: string; description: string; due_date: string | null; status: string; assignment_id: number | null; assignment_completed_at: string | null; uebung_da: number }[];
  const liste = rows.map((r): PortalHausuebung => {
    const offen = repo.homeworkOpen(r);
    return {
      id: r.id,
      fach: r.subject,
      beschreibung: r.description,
      faellig: r.due_date || null,
      zustand: !offen ? "erledigt" : r.due_date && r.due_date < heute ? "ueberfaellig" : "offen",
      uebungId: r.uebung_da ? r.assignment_id : null,
    };
  });
  const frueh = (a: PortalHausuebung, b: PortalHausuebung) => (a.faellig ?? "9999").localeCompare(b.faellig ?? "9999") || a.id - b.id;
  return {
    offen: liste.filter((h) => h.zustand !== "erledigt").sort(frueh),
    erledigt: liste.filter((h) => h.zustand === "erledigt").sort((a, b) => frueh(b, a)),
  };
}

// ---------- Unterlagen ----------

export type PortalPraesentation = { id: number; titel: string; fach: string; thema: string; zuletzt: string };
export type PortalUebung = { id: number; titel: string; fach: string; mitErklaerung: boolean; fertig: boolean };

/**
 * Präsentationen, die zu den Stunden dieses Schülers gehören: die Präsentation des Lernpakets, mit dem eine seiner
 * Einheiten lief (einheit_cockpit). Nur aktive, die zuletzt verwendete zuerst. Nur Titel, Fach und Thema; die
 * Beschreibung und der Vortragstext bleiben auf den Lehrerseiten.
 */
export function praesentationenFuer(studentId: number): PortalPraesentation[] {
  return db()
    .prepare(
      `SELECT p.id, p.title AS titel, p.fach, p.thema, MAX(u.started_at) AS zuletzt
       FROM units u JOIN einheit_cockpit c ON c.unit_id = u.id JOIN lernpakete l ON l.id = c.paket_id JOIN praesentationen p ON p.id = l.praesentation_id
       WHERE u.student_id = ? AND p.status = 'aktiv'
       GROUP BY p.id ORDER BY zuletzt DESC, p.id DESC`,
    )
    .all(studentId) as PortalPraesentation[];
}

/** Gehört die Präsentation zu den Unterlagen dieses Schülers? Nur dann zeigt die Schüler-App sie. */
export const praesentationFreigegeben = (studentId: number, praesId: number) => praesentationenFuer(studentId).some((p) => p.id === praesId);

/**
 * Übungen, deren Lösung der Lehrer freigegeben hat (Freigabe „Hilfen und Lösung“ oder „Alles“, lib/freigabe.ts),
 * zum Nachschauen. Nicht archivierte, kein Minitest und keine Probeschularbeit (die bleiben ohne Lösung vorab).
 * Hier stehen nur Titel und Stufe; die Aufgaben selbst schickt die Übungsseite über clientTasks, die nur das
 * Freigegebene mitgibt.
 */
export function uebungenMitLoesung(studentId: number): PortalUebung[] {
  return repo
    .listAssignments(studentId)
    .filter((a) => !isMinitest(a.mode) && !a.probe_test_id && zeigtLoesung(freigabeVon(a)))
    .map((a) => ({ id: a.id, titel: a.title, fach: a.subject, mitErklaerung: zeigtAlles(freigabeVon(a)), fertig: Boolean(a.completed_at) }));
}

// ---------- vergangene Stunden ----------

export type PortalStunde = { id: number; datum: string; fach: string; thema: string; geuebt: string[]; aufgaben: number; richtig: number };

/**
 * Die abgeschlossenen Einheiten (lessons, kind „stunde“), die neueste zuerst: Datum, Fach, Thema, die geübten
 * Fähigkeiten und wie viele Aufgaben er in der Einheit gelöst hat. Keine Felder der Dokumentation, die der Lehrer
 * für sich schreibt (Notizen, Schwierigkeiten, Einschätzung, Zusammenfassung, Nachricht an die Familie).
 */
export function vergangeneStunden(studentId: number, o: { limit?: number; now?: number } = {}): PortalStunde[] {
  const conn = db();
  const rows = conn
    .prepare(
      `SELECT id, unit_id, starts_at, subject, topic, skill_ids FROM lessons
       WHERE student_id = ? AND kind = 'stunde' AND status = 'abgeschlossen' AND starts_at <= ? ORDER BY starts_at DESC, id DESC LIMIT ?`,
    )
    .all(studentId, wienerZeitstempel(o.now ?? Date.now()), o.limit ?? 30) as { id: number; unit_id: number | null; starts_at: string; subject: string; topic: string; skill_ids: string }[];
  if (!rows.length) return [];
  const namen = new Map(repo.listSkills().map((s) => [s.id, s.name]));
  const zaehle = conn.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS r FROM attempts WHERE unit_id = ? AND student_id = ? AND final = 1 AND ${repo.COUNTED}`);
  return rows.map((r) => {
    const z = r.unit_id ? (zaehle.get(r.unit_id, studentId) as { n: number; r: number }) : { n: 0, r: 0 };
    const geuebt = [...new Set(json<unknown[]>(r.skill_ids, []).flatMap((id) => (typeof id === "string" && namen.has(id) ? [namen.get(id)!] : [])))];
    return { id: r.id, datum: r.starts_at.slice(0, 10), fach: r.subject, thema: r.topic.trim(), geuebt, aufgaben: z.n, richtig: z.r };
  });
}
