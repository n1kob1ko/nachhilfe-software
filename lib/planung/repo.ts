/**
 * Datenzugriff der Planung (Phase 3 des Merges): Räume, Verfügbarkeit, Wochenziel, Raumwünsche,
 * Wochenabweichungen. Nur Lesen und Schreiben — die Rechte prüft `lib/planung/aktionen.ts`.
 *
 * Zeiten stehen als **lokales Datum + Minuten ab Mitternacht** in der Datenbank, nie als
 * UTC-Zeitstempel (§6); der Wochenstart ist immer ein Montag (Europe/Vienna, `lib/planung/zeit.ts`).
 */
import { db, json } from "../db";
import { wochenstartVon } from "./zeit";
import { parseVerfuegbarkeit, serializeVerfuegbarkeit, type Verfuegbarkeit } from "./verfuegbarkeit";

export type RaumModus = "vor_ort" | "online";
export type ModusWunsch = "vor_ort" | "online" | "egal";
export type OwnerTyp = "teacher" | "student";

export type Raum = { id: number; building: string; name: string; mode: RaumModus; active: number };

export type LehrerPlanung = {
  availability: Verfuegbarkeit;
  /** Wochenziel in Minuten; null = kein Ziel eingetragen. */
  weekly_target_min: number | null;
  /** Wunschräume in der Reihenfolge der Wichtigkeit. */
  preferred_room_ids: number[];
};

export type SchuelerPlanung = {
  availability: Verfuegbarkeit;
  einheiten_pro_woche: number;
  /** geplante Dauer in Minuten, 1–300 (D3). */
  geplante_dauer: number;
  modus_wunsch: ModusWunsch;
  erlaubte_lehrer: number[];
};

export type Abweichung = { owner_type: OwnerTyp; owner_id: number; week_start: string; availability: Verfuegbarkeit };

const RAUM_SPALTEN = "id, building, name, mode, active";

// ---------- Räume ----------

export function listRaeume(opts: { mitInaktiven?: boolean } = {}): Raum[] {
  const wo = opts.mitInaktiven ? "" : "WHERE active = 1";
  return db().prepare(`SELECT ${RAUM_SPALTEN} FROM rooms ${wo} ORDER BY building COLLATE NOCASE, name COLLATE NOCASE`).all() as Raum[];
}

export function getRaum(id: number): Raum | null {
  return (db().prepare(`SELECT ${RAUM_SPALTEN} FROM rooms WHERE id = ?`).get(id) as Raum | undefined) ?? null;
}

export function createRaum(r: { building: string; name: string; mode: RaumModus }): number {
  const res = db().prepare("INSERT INTO rooms (building, name, mode, active) VALUES (?, ?, ?, 1)").run(r.building.trim(), r.name.trim(), r.mode);
  return Number(res.lastInsertRowid);
}

export function updateRaum(id: number, r: { building: string; name: string; mode: RaumModus }) {
  db().prepare("UPDATE rooms SET building = ?, name = ?, mode = ? WHERE id = ?").run(r.building.trim(), r.name.trim(), r.mode, id);
}

export function setRaumAktiv(id: number, aktiv: boolean) {
  db().prepare("UPDATE rooms SET active = ? WHERE id = ?").run(aktiv ? 1 : 0, id);
}

/** Alle Tabellen mit einer Spalte `room_id`, die auf einen Raum zeigen können (heute `geplante_einheiten`, Phase 4). */
export function raumVerweisTabellen(): string[] {
  const conn = db();
  const tabellen = (conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  return tabellen.filter((name) => (conn.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).some((c) => c.name === "room_id"));
}

/** Wie viele geplante Einheiten auf diesen Raum zeigen. */
export function raumVerweise(roomId: number): number {
  let summe = 0;
  for (const tabelle of raumVerweisTabellen()) {
    const { n } = db().prepare(`SELECT COUNT(*) AS n FROM "${tabelle}" WHERE room_id = ?`).get(roomId) as { n: number };
    summe += n;
  }
  return summe;
}

/**
 * Ein Raum wird gelöscht, solange kein Platz auf ihn zeigt; sonst bleibt er stehen und wird nur
 * deaktiviert (Glossar: **Raum**). Der Aufrufer zeigt dann den Hinweis zum Deaktivieren.
 */
export function loescheRaum(roomId: number): { geloescht: boolean; verweise: number } {
  const verweise = raumVerweise(roomId);
  if (verweise > 0) return { geloescht: false, verweise };
  db().prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  return { geloescht: true, verweise: 0 };
}

/** Raum-Ids aus einer JSON-Spalte, in der gespeicherten Reihenfolge. */
export function parseIdListe(raw: string | null | undefined): number[] {
  const liste = json<unknown>(raw, []);
  if (!Array.isArray(liste)) return [];
  const out: number[] = [];
  for (const wert of liste) {
    const id = Number(wert);
    if (Number.isInteger(id) && id > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

// ---------- Lehrer ----------

export function getLehrerPlanung(teacherId: number): LehrerPlanung | null {
  const r = db().prepare("SELECT availability, weekly_target_min, preferred_room_ids FROM teachers WHERE id = ?").get(teacherId) as
    | { availability: string | null; weekly_target_min: number | null; preferred_room_ids: string | null }
    | undefined;
  if (!r) return null;
  return {
    availability: parseVerfuegbarkeit(r.availability),
    weekly_target_min: r.weekly_target_min ?? null,
    preferred_room_ids: parseIdListe(r.preferred_room_ids),
  };
}

export function setLehrerVerfuegbarkeit(teacherId: number, availability: Verfuegbarkeit) {
  db().prepare("UPDATE teachers SET availability = ? WHERE id = ?").run(serializeVerfuegbarkeit(availability), teacherId);
}

export function setLehrerWochenziel(teacherId: number, minuten: number | null) {
  db().prepare("UPDATE teachers SET weekly_target_min = ? WHERE id = ?").run(minuten, teacherId);
}

export function setLehrerRaumPraeferenzen(teacherId: number, raumIds: number[]) {
  db().prepare("UPDATE teachers SET preferred_room_ids = ? WHERE id = ?").run(JSON.stringify(raumIds), teacherId);
}

/** Alle Lehrer-Ids (auch deaktivierte) — für „erlaubte Lehrer“ einer Schülerplanung. */
export function listLehrerIds(): number[] {
  return (db().prepare("SELECT id FROM teachers ORDER BY id").all() as { id: number }[]).map((r) => r.id);
}

// ---------- Schüler ----------

export function getSchuelerPlanung(studentId: number): SchuelerPlanung | null {
  const r = db()
    .prepare("SELECT availability, einheiten_pro_woche, geplante_dauer, modus_wunsch, erlaubte_lehrer FROM students WHERE id = ?")
    .get(studentId) as
    | { availability: string | null; einheiten_pro_woche: number; geplante_dauer: number; modus_wunsch: string; erlaubte_lehrer: string | null }
    | undefined;
  if (!r) return null;
  return {
    availability: parseVerfuegbarkeit(r.availability),
    einheiten_pro_woche: r.einheiten_pro_woche ?? 0,
    geplante_dauer: r.geplante_dauer ?? 100,
    modus_wunsch: (["vor_ort", "online", "egal"] as const).includes(r.modus_wunsch as ModusWunsch) ? (r.modus_wunsch as ModusWunsch) : "egal",
    erlaubte_lehrer: parseIdListe(r.erlaubte_lehrer),
  };
}

export function setSchuelerPlanung(studentId: number, p: Omit<SchuelerPlanung, "availability"> & { availability: Verfuegbarkeit }) {
  db()
    .prepare(
      `UPDATE students SET availability = @availability, einheiten_pro_woche = @einheiten_pro_woche, geplante_dauer = @geplante_dauer,
       modus_wunsch = @modus_wunsch, erlaubte_lehrer = @erlaubte_lehrer WHERE id = @id`,
    )
    .run({
      id: studentId,
      availability: serializeVerfuegbarkeit(p.availability),
      einheiten_pro_woche: p.einheiten_pro_woche,
      geplante_dauer: p.geplante_dauer,
      modus_wunsch: p.modus_wunsch,
      erlaubte_lehrer: JSON.stringify(p.erlaubte_lehrer),
    });
}

// ---------- Wochenabweichungen ----------

export function getAbweichung(ownerType: OwnerTyp, ownerId: number, weekStart: string): Verfuegbarkeit | null {
  const r = db()
    .prepare("SELECT availability FROM availability_overrides WHERE owner_type = ? AND owner_id = ? AND week_start = ?")
    .get(ownerType, ownerId, wochenstartVon(weekStart)) as { availability: string } | undefined;
  return r ? parseVerfuegbarkeit(r.availability) : null;
}

export function setAbweichung(ownerType: OwnerTyp, ownerId: number, weekStart: string, availability: Verfuegbarkeit) {
  db()
    .prepare(
      `INSERT INTO availability_overrides (owner_type, owner_id, week_start, availability) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_type, owner_id, week_start) DO UPDATE SET availability = excluded.availability`,
    )
    .run(ownerType, ownerId, wochenstartVon(weekStart), serializeVerfuegbarkeit(availability));
}

export function loescheAbweichung(ownerType: OwnerTyp, ownerId: number, weekStart: string) {
  db().prepare("DELETE FROM availability_overrides WHERE owner_type = ? AND owner_id = ? AND week_start = ?").run(ownerType, ownerId, wochenstartVon(weekStart));
}

export function listeAbweichungen(ownerType: OwnerTyp, ownerId: number): Abweichung[] {
  const rows = db()
    .prepare("SELECT owner_type, owner_id, week_start, availability FROM availability_overrides WHERE owner_type = ? AND owner_id = ? ORDER BY week_start")
    .all(ownerType, ownerId) as { owner_type: OwnerTyp; owner_id: number; week_start: string; availability: string }[];
  return rows.map((r) => ({ owner_type: r.owner_type, owner_id: r.owner_id, week_start: r.week_start, availability: parseVerfuegbarkeit(r.availability) }));
}

/** Die Verfügbarkeit einer Woche: die Abweichung, wenn es eine gibt, sonst die Regelverfügbarkeit. */
export function verfuegbarkeitFuer(ownerType: OwnerTyp, ownerId: number, weekStart: string): { availability: Verfuegbarkeit; abweichend: boolean } {
  const abweichung = getAbweichung(ownerType, ownerId, weekStart);
  if (abweichung) return { availability: abweichung, abweichend: true };
  if (ownerType === "teacher") return { availability: getLehrerPlanung(ownerId)?.availability ?? {}, abweichend: false };
  return { availability: getSchuelerPlanung(ownerId)?.availability ?? {}, abweichend: false };
}
