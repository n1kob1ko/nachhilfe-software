/**
 * Datenzugriff der Planung (Phase 3 und 4 des Merges): Räume, Verfügbarkeit, Wochenziel,
 * Raumwünsche, Wochenabweichungen — und der **Wochenplan** (`geplante_einheiten`): Entwurf,
 * Veröffentlichen, Verwerfen, Vorwoche übernehmen, neu generieren, einzelne Plätze setzen und
 * sperren. Nur Lesen und Schreiben — die Rechte prüft `lib/planung/aktionen.ts`.
 *
 * Zwei Regeln gelten überall in dieser Datei:
 *
 * 1. Zeiten stehen als **lokales Datum + Minuten ab Mitternacht** in der Datenbank, nie als
 *    UTC-Zeitstempel (§6); der Wochenstart ist immer ein Montag (Europe/Vienna,
 *    `lib/planung/zeit.ts`), der Wochentag ist ISO (1 = Montag … 7 = Sonntag).
 * 2. **Überlappungen prüft ausschließlich diese Datei** (`pruefeUeberlappung` /
 *    `pruefeUndNormiere`). Die Tabelle hat absichtlich keine Eindeutigkeit auf Zeiträume: die
 *    geplante Dauer ist je Schüler verschieden (D3), das kann die Datenbank nicht ausdrücken.
 *    Jeder Schreibweg (anlegen, ändern, Entwurf speichern, Vorwoche übernehmen) geht durch diese
 *    eine Prüfung und wird mit einem deutschen Grund abgelehnt, wenn Lehrer, Schüler oder Raum
 *    schon belegt sind. Die einzige Ausnahme: ein Platz mit Haken **gleichzeitig** (D26) — dann
 *    darf ein Lehrer zwei Schüler zugleich haben, auch im selben Raum, aber nie drei.
 */
import { db, json } from "../db";
import {
  auf10,
  istDatum,
  istWochentag,
  minutenLabel,
  tagAddieren,
  WOCHENTAG_LANG,
  wochenstartVon,
  wochentagVon,
  wienerDatum,
  wienerMinuten,
  MINUTEN_PRO_TAG,
  type Wochentag,
} from "./zeit";
import { leseRegeln, type PlanungsRegeln } from "./regeln";
import {
  generiereWochenplan,
  type GeplanteEinheit,
  type OffenerEintrag,
  type PlanungLehrer,
  type PlanungRaum,
  type PlanungSchueler,
} from "./generator";
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

// ---------- Wochenplan: geplante Einheiten (Phase 4) ----------

export type PlatzStatus = "entwurf" | "veroeffentlicht";

/** Eine Zeile aus `geplante_einheiten`, so wie sie in der Datenbank steht. */
export type GeplanteEinheitZeile = {
  id: number;
  /** Montag der Woche, YYYY-MM-DD (Europe/Vienna). */
  week_start: string;
  /** ISO: 1 = Montag … 7 = Sonntag. */
  weekday: Wochentag;
  /** Minuten ab Mitternacht, Vielfaches von 10. */
  start_min: number;
  /** 1–300; `end` ist `start_min + geplante_dauer` (D19), wird nicht gespeichert. */
  geplante_dauer: number;
  teacher_id: number;
  student_id: number;
  room_id: number | null;
  status: PlatzStatus;
  locked: number;
  /** Die Einheit, die sich mit diesem Platz verknüpft hat (D17); null = noch keine. */
  unit_id: number | null;
  /** 1 = darf sich mit einem anderen Platz desselben Lehrers überschneiden (zwei Schüler gleichzeitig, D26). */
  gleichzeitig: number;
  created_at: string;
  updated_at: string;
};

const GE_SPALTEN =
  "id, week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, unit_id, gleichzeitig, created_at, updated_at";

/** Die Felder, die eine Überlappung ausmachen. */
type PlatzKern = {
  week_start: string;
  weekday: number;
  start_min: number;
  geplante_dauer: number;
  teacher_id: number;
  student_id: number;
  room_id: number | null;
  /** 1 = Haken „gleichzeitig“ (D26); fehlt bei Plätzen aus dem Generator, der nie doppelt plant. */
  gleichzeitig?: number;
};

/** Was ein Schreibweg entgegennimmt; `start_min` wird auf das 10-Minuten-Raster gezogen (D19). */
export type PlatzEingabe = {
  week_start: string;
  weekday: number;
  start_min: number;
  geplante_dauer: number;
  teacher_id: number;
  student_id: number;
  room_id?: number | null;
  locked?: boolean | number;
  status?: PlatzStatus;
  /** Haken „gleichzeitig“ (D26): der Lehrer darf zu dieser Zeit noch einen zweiten Schüler haben. */
  gleichzeitig?: boolean | number;
};

export type KonfliktArt = "lehrer" | "schueler" | "raum";
export type PruefErgebnis = { ok: true } | { ok: false; fehler: string; art?: KonfliktArt };
export type PlatzErgebnis = { ok: true; id: number; hinweis?: string } | { ok: false; fehler: string };
export type VorgangsErgebnis = { ok: true; hinweis?: string } | { ok: false; fehler: string };

function lehrerName(id: number): string {
  return (db().prepare("SELECT name FROM teachers WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? `Lehrer #${id}`;
}
function schuelerName(id: number): string {
  return (db().prepare("SELECT name FROM students WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? `Schüler #${id}`;
}
function raumName(id: number): string {
  return (db().prepare("SELECT name FROM rooms WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? `Raum #${id}`;
}

/** Überschneiden sich zwei Zeiträume eines Tages? (Ende ausgeschlossen: 08:00–09:40 und 09:40–… nicht.) */
function ueberlappt(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * **Die** Prüfung jedes Schreibwegs: Eingaben prüfen, Startzeit auf 10 Minuten rasten und
 * Überlappungen von Lehrer, Schüler und Raum gegen `gegen` finden. Gibt es keine, kommt der
 * normalisierte Platz zurück, sonst ein deutscher Grund und die Art des Konflikts.
 *
 * Zwei Schüler gleichzeitig (D26): Überschneiden sich zwei Plätze **desselben Lehrers**, ist das
 * erlaubt, wenn einer der beiden den Haken `gleichzeitig` trägt. Sie dürfen dann auch im selben
 * Raum sein. Drei zugleich gehen nie, derselbe Schüler zweimal auch nicht.
 */
function pruefeUndNormiere(
  eingabe: PlatzEingabe,
  gegen: PlatzKern[],
): { ok: true; platz: PlatzKern & { status: PlatzStatus; locked: number; gleichzeitig: number } } | { ok: false; fehler: string; art?: KonfliktArt } {
  if (!istDatum(eingabe.week_start)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  if (!istWochentag(Number(eingabe.weekday))) return { ok: false, fehler: "Bitte einen Wochentag wählen." };
  const start = auf10(Number(eingabe.start_min));
  if (!Number.isFinite(start) || start < 0 || start >= MINUTEN_PRO_TAG) return { ok: false, fehler: "Bitte eine Startzeit zwischen 00:00 und 23:50 wählen." };
  const dauer = Math.round(Number(eingabe.geplante_dauer));
  if (!Number.isInteger(dauer) || dauer < 1 || dauer > 300) return { ok: false, fehler: "Die geplante Dauer muss zwischen 1 und 300 Minuten liegen." };
  if (start + dauer > MINUTEN_PRO_TAG) return { ok: false, fehler: "Die Einheit würde über Mitternacht gehen." };
  const teacherId = Math.round(Number(eingabe.teacher_id));
  const studentId = Math.round(Number(eingabe.student_id));
  if (!Number.isInteger(teacherId) || !getLehrerPlanung(teacherId)) return { ok: false, fehler: "Lehrer nicht gefunden." };
  if (!Number.isInteger(studentId) || !getSchuelerPlanung(studentId)) return { ok: false, fehler: "Schüler nicht gefunden." };
  const roheRaumId = eingabe.room_id;
  const roomId = roheRaumId === null || roheRaumId === undefined || Number(roheRaumId) <= 0 ? null : Math.round(Number(roheRaumId));
  if (roomId !== null && !getRaum(roomId)) return { ok: false, fehler: "Raum nicht gefunden." };

  const woche = wochenstartVon(eingabe.week_start);
  const tag = Number(eingabe.weekday) as Wochentag;
  const ende = start + dauer;
  const gleichzeitig = eingabe.gleichzeitig ? 1 : 0;
  /** die Plätze desselben Lehrers, die sich erlaubt mit diesem überschneiden (D26) */
  const zugleich: { start: number; end: number }[] = [];
  for (const andere of gegen) {
    if (andere.week_start !== woche || andere.weekday !== tag) continue;
    const anderesEnde = andere.start_min + andere.geplante_dauer;
    if (!ueberlappt({ start, end: ende }, { start: andere.start_min, end: anderesEnde })) continue;
    const zeit = `${WOCHENTAG_LANG[tag]} ${minutenLabel(andere.start_min)}–${minutenLabel(anderesEnde)}`;
    if (andere.teacher_id === teacherId) {
      if (!gleichzeitig && !andere.gleichzeitig)
        return {
          ok: false,
          art: "lehrer",
          fehler: `Lehrer ${lehrerName(teacherId)} ist am ${zeit} schon verplant. Sollen beide Schüler zugleich kommen, setz beim Platz den Haken „Gleichzeitig mit einem anderen Schüler“.`,
        };
      if (andere.student_id === studentId) return { ok: false, art: "schueler", fehler: `${schuelerName(studentId)} hat am ${zeit} schon eine geplante Einheit.` };
      // derselbe Lehrer: dieselben zwei Schüler dürfen auch im selben Raum sitzen
      zugleich.push({ start: andere.start_min, end: anderesEnde });
      continue;
    }
    if (andere.student_id === studentId) return { ok: false, art: "schueler", fehler: `${schuelerName(studentId)} hat am ${zeit} schon eine geplante Einheit.` };
    if (roomId !== null && andere.room_id === roomId) return { ok: false, art: "raum", fehler: `Raum ${raumName(roomId)} ist am ${zeit} schon belegt.` };
  }
  // höchstens zwei zugleich: überschneiden sich zwei der anderen Plätze auch untereinander, innerhalb dieses Platzes, wären es drei
  for (let i = 0; i < zugleich.length; i++)
    for (let j = i + 1; j < zugleich.length; j++) {
      const von = Math.max(start, zugleich[i].start, zugleich[j].start);
      const bis = Math.min(ende, zugleich[i].end, zugleich[j].end);
      if (von < bis)
        return {
          ok: false,
          art: "lehrer",
          fehler: `Lehrer ${lehrerName(teacherId)} hat am ${WOCHENTAG_LANG[tag]} ${minutenLabel(von)}–${minutenLabel(bis)} schon zwei Schüler gleichzeitig. Mehr als zwei gehen nicht.`,
        };
    }

  return {
    ok: true,
    platz: {
      week_start: woche,
      weekday: tag,
      start_min: start,
      geplante_dauer: dauer,
      teacher_id: teacherId,
      student_id: studentId,
      room_id: roomId,
      status: eingabe.status ?? "entwurf",
      locked: eingabe.locked ? 1 : 0,
      gleichzeitig,
    },
  };
}

/**
 * Die Plätze desselben Lehrers, die sich mit `platz` zeitlich überschneiden — das geht nur mit dem
 * Haken „gleichzeitig“ (D26). Der Platz selbst (dasselbe Objekt oder dieselbe Id) zählt nicht mit.
 */
export function zugleichMit<T extends PlatzKern & { id?: number | null }>(platz: T, andere: T[]): T[] {
  const ende = platz.start_min + platz.geplante_dauer;
  return andere.filter(
    (z) =>
      z !== platz &&
      (platz.id == null || z.id !== platz.id) &&
      z.teacher_id === platz.teacher_id &&
      z.week_start === platz.week_start &&
      z.weekday === platz.weekday &&
      ueberlappt({ start: platz.start_min, end: ende }, { start: z.start_min, end: z.start_min + z.geplante_dauer }),
  );
}

/**
 * Nach dem Schreiben: hat der Lehrer zu dieser Zeit zwei Schüler (D26), werden beide Plätze gesperrt,
 * damit „Neu generieren“ das Paar stehen lässt — der Generator plant selbst nie zwei zugleich.
 */
function sperreZugleich(id: number): string | undefined {
  const platz = getGeplanteEinheit(id);
  if (!platz) return undefined;
  const partner = zugleichMit(platz, einheitenFuerWoche(platz.week_start, { status: "alle" }));
  if (!partner.length) return undefined;
  const sperren = db().prepare("UPDATE geplante_einheiten SET locked = 1, updated_at = datetime('now') WHERE id = ? AND locked = 0");
  for (const z of [platz, ...partner]) sperren.run(z.id);
  const namen = partner.map((z) => schuelerName(z.student_id)).join(" und ");
  // nacheinander versetzt kann ein Platz zwei Partner haben (A mit B, danach B mit C)
  return `Gleichzeitig mit ${namen}. ${partner.length === 1 ? "Beide" : "Alle diese"} Plätze sind gesperrt, damit „Neu generieren“ sie stehen lässt.`;
}

/**
 * Prüft einen geplanten Platz gegen alle Plätze seiner Woche (Entwurf **und** veröffentlicht), außer
 * `ausserId` — das ist der eigene Platz beim Verschieben. Der einzige Überlappungsschutz der App.
 */
export function pruefeUeberlappung(eingabe: PlatzEingabe & { ausserId?: number }): PruefErgebnis {
  if (!istDatum(eingabe.week_start)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const gegen = einheitenFuerWoche(eingabe.week_start, { status: "alle" }).filter((z) => z.id !== eingabe.ausserId);
  const geprüft = pruefeUndNormiere(eingabe, gegen);
  return geprüft.ok ? { ok: true } : { ok: false, fehler: geprüft.fehler, art: geprüft.art };
}

/** Alle Plätze einer Woche, nach Wochentag und Startzeit. `status: "alle"` (Vorgabe) nimmt beide Zustände. */
export function einheitenFuerWoche(weekStart: string, opts: { status?: PlatzStatus | "alle" } = {}): GeplanteEinheitZeile[] {
  const woche = wochenstartVon(weekStart);
  const status = opts.status ?? "alle";
  if (status === "alle")
    return db().prepare(`SELECT ${GE_SPALTEN} FROM geplante_einheiten WHERE week_start = ? ORDER BY weekday, start_min, id`).all(woche) as GeplanteEinheitZeile[];
  return db().prepare(`SELECT ${GE_SPALTEN} FROM geplante_einheiten WHERE week_start = ? AND status = ? ORDER BY weekday, start_min, id`).all(woche, status) as GeplanteEinheitZeile[];
}

export function getGeplanteEinheit(id: number): GeplanteEinheitZeile | null {
  return (db().prepare(`SELECT ${GE_SPALTEN} FROM geplante_einheiten WHERE id = ?`).get(id) as GeplanteEinheitZeile | undefined) ?? null;
}

/** Zustand der Woche: leer, Entwurf oder veröffentlicht (eine Woche ist nie beides, s. CONTEXT.md). */
export function wochenStatus(weekStart: string): "leer" | "entwurf" | "veroeffentlicht" {
  const zeilen = einheitenFuerWoche(weekStart, { status: "alle" });
  if (zeilen.some((z) => z.status === "veroeffentlicht")) return "veroeffentlicht";
  return zeilen.length ? "entwurf" : "leer";
}

/** Zeile → Form, die der Generator versteht (reine Rechnung, ohne Status und Ids). */
export function alsGeplanteEinheit(zeile: GeplanteEinheitZeile): GeplanteEinheit {
  return {
    id: zeile.id,
    weekday: zeile.weekday,
    start: zeile.start_min,
    end: zeile.start_min + zeile.geplante_dauer,
    teacherId: zeile.teacher_id,
    studentId: zeile.student_id,
    roomId: zeile.room_id,
    locked: zeile.locked === 1,
  };
}

/**
 * Die Plätze eines Kalendertags (Europe/Vienna) — für „heute“ auf dem Dashboard (`lib/planung/heute.ts`)
 * und für den Tagesplan. Ohne `status` kommen Entwurf und veröffentlicht.
 */
export function einheitenFuerTag(
  datum: string,
  opts: { status?: PlatzStatus; teacherId?: number; studentId?: number } = {},
): GeplanteEinheitZeile[] {
  const bedingungen = ["week_start = @woche", "weekday = @tag"];
  const werte: Record<string, unknown> = { woche: wochenstartVon(datum), tag: wochentagVon(datum) };
  if (opts.status) {
    bedingungen.push("status = @status");
    werte.status = opts.status;
  }
  if (opts.teacherId !== undefined) {
    bedingungen.push("teacher_id = @teacher");
    werte.teacher = opts.teacherId;
  }
  if (opts.studentId !== undefined) {
    bedingungen.push("student_id = @student");
    werte.student = opts.studentId;
  }
  return db()
    .prepare(`SELECT ${GE_SPALTEN} FROM geplante_einheiten WHERE ${bedingungen.join(" AND ")} ORDER BY start_min, id`)
    .all(werte) as GeplanteEinheitZeile[];
}

export type PlatzMitNamen = GeplanteEinheitZeile & {
  teacher_name: string;
  student_name: string;
  room_name: string | null;
  room_mode: RaumModus | null;
  room_building: string | null;
};

/** Zeilen mit den Namen von Lehrer, Schüler und Raum — die Ansichten zeigen nie nur Ids. */
export function mitNamen(zeilen: GeplanteEinheitZeile[]): PlatzMitNamen[] {
  if (!zeilen.length) return [];
  const lehrer = new Map((db().prepare("SELECT id, name FROM teachers").all() as { id: number; name: string }[]).map((t) => [t.id, t.name]));
  const schueler = new Map((db().prepare("SELECT id, name FROM students").all() as { id: number; name: string }[]).map((s) => [s.id, s.name]));
  const raeume = new Map(
    (db().prepare("SELECT id, name, mode, building FROM rooms").all() as { id: number; name: string; mode: RaumModus; building: string }[]).map((r) => [r.id, r]),
  );
  return zeilen.map((z) => {
    const raum = z.room_id === null ? undefined : raeume.get(z.room_id);
    return {
      ...z,
      teacher_name: lehrer.get(z.teacher_id) ?? `Lehrer #${z.teacher_id}`,
      student_name: schueler.get(z.student_id) ?? `Schüler #${z.student_id}`,
      room_name: raum?.name ?? null,
      room_mode: raum?.mode ?? null,
      room_building: raum?.building ?? null,
    };
  });
}

/** Das Kalenderdatum eines Platzes (Europe/Vienna gerechnet, Montag + Wochentag − 1). */
export function slotDatum(weekStart: string, weekday: number): string {
  return tagAddieren(wochenstartVon(weekStart), Math.max(1, Math.min(7, Math.round(weekday))) - 1);
}

/**
 * „Nicht stattgefunden“ (D17): der Platz ist **veröffentlicht**, hat keine Einheit (`unit_id IS NULL`)
 * und liegt hinter uns. Eine Einheit, die gerade läuft, ist nicht gemeint — erst wenn die geplante
 * Zeit vorbei ist, gilt der Platz als ausgefallen. Keine Abrechnungsfolge.
 */
export function istNichtStattgefunden(zeile: GeplanteEinheitZeile, now: Date = new Date()): boolean {
  if (zeile.status !== "veroeffentlicht" || zeile.unit_id !== null) return false;
  const datum = slotDatum(zeile.week_start, zeile.weekday);
  const heute = wienerDatum(now);
  if (heute > datum) return true;
  if (heute < datum) return false;
  return zeile.start_min + zeile.geplante_dauer <= wienerMinuten(now);
}

/** Alle ausgefallenen Plätze einer Woche, älteste zuerst. */
export function nichtStattgefunden(weekStart: string, now: Date = new Date()): GeplanteEinheitZeile[] {
  return einheitenFuerWoche(weekStart, { status: "veroeffentlicht" }).filter((z) => istNichtStattgefunden(z, now));
}

// ---------- Schreiben ----------

function insertPlatz() {
  return db().prepare(
    `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, gleichzeitig, created_at, updated_at)
     VALUES (@week_start, @weekday, @start_min, @geplante_dauer, @teacher_id, @student_id, @room_id, @status, @locked, @gleichzeitig, datetime('now'), datetime('now'))`,
  );
}

function platzWerte(p: PlatzKern & { status: PlatzStatus; locked: number }) {
  return {
    week_start: p.week_start,
    weekday: p.weekday,
    start_min: p.start_min,
    geplante_dauer: p.geplante_dauer,
    teacher_id: p.teacher_id,
    student_id: p.student_id,
    room_id: p.room_id,
    status: p.status,
    locked: p.locked,
    gleichzeitig: p.gleichzeitig ? 1 : 0,
  };
}

/**
 * Einen Platz von Hand setzen (Handarbeit, die „Neu generieren“ später stehen lässt, wenn er
 * gesperrt wird). In einer veröffentlichten Woche wird der neue Platz ebenfalls veröffentlicht,
 * damit er sofort sichtbar ist; sonst ist er Entwurf.
 */
export function legePlatzAn(eingabe: PlatzEingabe): PlatzErgebnis {
  const woche = istDatum(eingabe.week_start) ? wochenstartVon(eingabe.week_start) : "";
  const status: PlatzStatus | undefined =
    eingabe.status ?? (woche && wochenStatus(woche) === "veroeffentlicht" ? "veroeffentlicht" : "entwurf");
  const gegen = woche ? einheitenFuerWoche(woche, { status: "alle" }) : [];
  const geprüft = pruefeUndNormiere({ ...eingabe, week_start: woche, status }, gegen);
  if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
  const id = Number(insertPlatz().run(platzWerte(geprüft.platz)).lastInsertRowid);
  return { ok: true, id, hinweis: sperreZugleich(id) };
}

/** Einen Platz verschieben oder umbesetzen; prüft dieselbe Überlappung, nur ohne sich selbst. */
export function aenderePlatz(id: number, aenderung: Partial<PlatzEingabe>): VorgangsErgebnis {
  const vorhanden = getGeplanteEinheit(id);
  if (!vorhanden) return { ok: false, fehler: "Geplante Einheit nicht gefunden." };
  const zusammen: PlatzEingabe = {
    week_start: aenderung.week_start ?? vorhanden.week_start,
    weekday: aenderung.weekday ?? vorhanden.weekday,
    start_min: aenderung.start_min ?? vorhanden.start_min,
    geplante_dauer: aenderung.geplante_dauer ?? vorhanden.geplante_dauer,
    teacher_id: aenderung.teacher_id ?? vorhanden.teacher_id,
    student_id: aenderung.student_id ?? vorhanden.student_id,
    room_id: aenderung.room_id === undefined ? vorhanden.room_id : aenderung.room_id,
    locked: aenderung.locked ?? vorhanden.locked === 1,
    status: aenderung.status ?? vorhanden.status,
    gleichzeitig: aenderung.gleichzeitig ?? vorhanden.gleichzeitig === 1,
  };
  const woche = istDatum(zusammen.week_start) ? wochenstartVon(zusammen.week_start) : "";
  const gegen = (woche ? einheitenFuerWoche(woche, { status: "alle" }) : []).filter((z) => z.id !== id);
  const geprüft = pruefeUndNormiere({ ...zusammen, week_start: woche }, gegen);
  if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
  const p = geprüft.platz;
  db()
    .prepare(
      `UPDATE geplante_einheiten SET week_start = @week_start, weekday = @weekday, start_min = @start_min, geplante_dauer = @geplante_dauer,
       teacher_id = @teacher_id, student_id = @student_id, room_id = @room_id, status = @status, locked = @locked, gleichzeitig = @gleichzeitig,
       updated_at = datetime('now') WHERE id = @id`,
    )
    .run({ ...platzWerte(p), id });
  const zugleich = sperreZugleich(id);
  return { ok: true, hinweis: zugleich ? `Platz gespeichert. ${zugleich}` : "Platz gespeichert." };
}

/** Sperren oder entsperren (Glossar: **gesperrt**). Gesperrte Plätze lässt „Neu generieren“ stehen. */
export function setzeGesperrt(id: number, locked: boolean): VorgangsErgebnis {
  if (!getGeplanteEinheit(id)) return { ok: false, fehler: "Geplante Einheit nicht gefunden." };
  db().prepare("UPDATE geplante_einheiten SET locked = ?, updated_at = datetime('now') WHERE id = ?").run(locked ? 1 : 0, id);
  return { ok: true, hinweis: locked ? "Platz ist gesperrt und bleibt beim Neu generieren stehen." : "Platz ist wieder frei." };
}

export function loeschePlatz(id: number): VorgangsErgebnis {
  const res = db().prepare("DELETE FROM geplante_einheiten WHERE id = ?").run(id);
  if (res.changes === 0) return { ok: false, fehler: "Geplante Einheit nicht gefunden." };
  return { ok: true, hinweis: "Platz gelöscht." };
}

/** Die Einheit, die zu diesem Platz gehört (oder null zum Lösen der Verknüpfung). */
export function verknuepfePlatz(id: number, unitId: number | null): VorgangsErgebnis {
  if (!getGeplanteEinheit(id)) return { ok: false, fehler: "Geplante Einheit nicht gefunden." };
  db().prepare("UPDATE geplante_einheiten SET unit_id = ?, updated_at = datetime('now') WHERE id = ?").run(unitId, id);
  return { ok: true };
}

/**
 * Den Entwurf einer Woche durch die übergebenen Plätze ersetzen. Gesperrte Plätze bleiben genau so,
 * wie sie sind (D24); alle anderen Entwürfe werden vorher gelöscht. Geprüft wird **vor** dem ersten
 * Schreiben: gibt es eine Überlappung, wird nichts geändert.
 */
export function speichereEntwurf(weekStart: string, einheiten: GeplanteEinheit[]): { ok: true; anzahl: number } | { ok: false; fehler: string } {
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const woche = wochenstartVon(weekStart);
  if (wochenStatus(woche) === "veroeffentlicht")
    return { ok: false, fehler: "Für diese Woche ist schon ein Plan veröffentlicht. Erst den Entwurf zurücksetzen, dann neu generieren." };

  const vorhanden = einheitenFuerWoche(woche, { status: "entwurf" });
  const behalten = vorhanden.filter((z) => z.locked === 1);
  const gegen: PlatzKern[] = [...behalten];
  const neu: (PlatzKern & { status: PlatzStatus; locked: number })[] = [];

  for (const e of einheiten) {
    if (e.id !== null && behalten.some((z) => z.id === e.id)) continue; // gesperrt: unangetastet
    const geprüft = pruefeUndNormiere(
      {
        week_start: woche,
        weekday: e.weekday,
        start_min: e.start,
        geplante_dauer: e.end - e.start,
        teacher_id: e.teacherId,
        student_id: e.studentId,
        room_id: e.roomId,
        locked: e.locked,
        status: "entwurf",
      },
      gegen,
    );
    if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
    gegen.push(geprüft.platz);
    neu.push(geprüft.platz);
  }

  const schreiben = db().transaction(() => {
    db().prepare("DELETE FROM geplante_einheiten WHERE week_start = ? AND status = 'entwurf' AND locked = 0").run(woche);
    const insert = insertPlatz();
    for (const p of neu) insert.run(platzWerte(p));
  });
  schreiben();
  return { ok: true, anzahl: behalten.length + neu.length };
}

/**
 * Den Entwurf der Woche veröffentlichen (D25: **keine** Benachrichtigung). Veröffentlicht und
 * Entwurf mischen sich nicht: hat die Woche schon veröffentlichte Plätze, wird abgelehnt.
 */
export function veroeffentlicheWoche(weekStart: string): { ok: true; anzahl: number } | { ok: false; fehler: string } {
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const woche = wochenstartVon(weekStart);
  if (einheitenFuerWoche(woche, { status: "veroeffentlicht" }).length)
    return { ok: false, fehler: "Für diese Woche ist schon ein Plan veröffentlicht." };
  const entwuerfe = einheitenFuerWoche(woche, { status: "entwurf" });
  if (!entwuerfe.length) return { ok: false, fehler: "Es gibt keinen Entwurf zum Veröffentlichen." };
  db().prepare("UPDATE geplante_einheiten SET status = 'veroeffentlicht', updated_at = datetime('now') WHERE week_start = ? AND status = 'entwurf'").run(woche);
  return { ok: true, anzahl: entwuerfe.length };
}

/** Nur den Entwurf der Woche wegwerfen; veröffentlichte Plätze bleiben, wo sie sind. */
export function verwerfeEntwurf(weekStart: string): { anzahl: number } {
  if (!istDatum(weekStart)) return { anzahl: 0 };
  const res = db().prepare("DELETE FROM geplante_einheiten WHERE week_start = ? AND status = 'entwurf'").run(wochenstartVon(weekStart));
  return { anzahl: res.changes };
}

/** Die ganze Woche löschen, auch veröffentlichte Plätze („alles zurücksetzen“). */
export function loescheWoche(weekStart: string): { anzahl: number } {
  if (!istDatum(weekStart)) return { anzahl: 0 };
  const res = db().prepare("DELETE FROM geplante_einheiten WHERE week_start = ?").run(wochenstartVon(weekStart));
  return { anzahl: res.changes };
}

/**
 * „Vorwoche als Entwurf übernehmen“ (D24, **keine** automatische Wiederholung): die Plätze der
 * Vorwoche werden zu neuen Entwürfen ohne Verknüpfung und **ohne** Sperre — sie sind ein Vorschlag,
 * den „Neu generieren“ noch umbauen darf. Gibt es in der Vorwoche einen veröffentlichten Plan, wird
 * der übernommen, sonst deren Entwurf. Die Zielwoche muss leer sein. Ausnahme: zwei Schüler
 * gleichzeitig (D26) kommen samt Haken und **gesperrt** mit, sonst löste „Neu generieren“ das Paar auf.
 */
export function uebernimmVorwoche(weekStart: string): { ok: true; anzahl: number } | { ok: false; fehler: string } {
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const woche = wochenstartVon(weekStart);
  if (einheitenFuerWoche(woche, { status: "alle" }).length)
    return { ok: false, fehler: "In dieser Woche gibt es schon Plätze. Bitte zuerst den Entwurf verwerfen." };
  const vorwoche = tagAddieren(woche, -7);
  const veroeffentlicht = einheitenFuerWoche(vorwoche, { status: "veroeffentlicht" });
  const quelle = veroeffentlicht.length ? veroeffentlicht : einheitenFuerWoche(vorwoche, { status: "entwurf" });
  if (!quelle.length) return { ok: false, fehler: "Für die Vorwoche gibt es keinen Plan zum Übernehmen." };

  const gegen: PlatzKern[] = [];
  for (const z of quelle) {
    const geprüft = pruefeUndNormiere(
      {
        week_start: woche,
        weekday: z.weekday,
        start_min: z.start_min,
        geplante_dauer: z.geplante_dauer,
        teacher_id: z.teacher_id,
        student_id: z.student_id,
        room_id: z.room_id,
        locked: false,
        status: "entwurf",
        gleichzeitig: z.gleichzeitig === 1,
      },
      gegen,
    );
    if (!geprüft.ok) return { ok: false, fehler: geprüft.fehler };
    gegen.push(geprüft.platz);
  }

  const schreiben = db().transaction(() => {
    const insert = insertPlatz();
    for (const p of gegen) insert.run(platzWerte({ ...p, status: "entwurf", locked: zugleichMit(p, gegen).length ? 1 : 0 }));
  });
  schreiben();
  return { ok: true, anzahl: gegen.length };
}

// ---------- Eingaben einer Woche und der Generierlauf ----------

export type WochenEingaben = {
  lehrer: PlanungLehrer[];
  schueler: PlanungSchueler[];
  raeume: PlanungRaum[];
  /** Gesperrte Plätze der Woche: Eingabe des Generators, sie werden nie verschoben. */
  gesperrte: GeplanteEinheit[];
  regeln: PlanungsRegeln;
};

/**
 * Alles, was ein Generierlauf für diese Woche braucht: Lehrer und Schüler mit ihrer Verfügbarkeit
 * (samt Wochenabweichung), Räume, die gesperrten Plätze und die Regeln. Nur aktive Lehrer; Schüler
 * ohne `einheiten_pro_woche` kommen nicht vor, weil sie nichts brauchen.
 */
export function wochenEingaben(weekStart: string): WochenEingaben {
  const woche = wochenstartVon(weekStart);
  const lehrer = (db().prepare("SELECT id, name, weekly_target_min, preferred_room_ids FROM teachers WHERE active = 1 ORDER BY id").all() as {
    id: number;
    name: string;
    weekly_target_min: number | null;
    preferred_room_ids: string | null;
  }[]).map<PlanungLehrer>((t) => ({
    id: t.id,
    name: t.name,
    weeklyTargetMinutes: Number(t.weekly_target_min) || 0,
    availability: verfuegbarkeitFuer("teacher", t.id, woche).availability,
    preferredRoomIds: parseIdListe(t.preferred_room_ids),
  }));

  const schueler = (
    db()
      .prepare("SELECT id, name, availability, einheiten_pro_woche, geplante_dauer, modus_wunsch, erlaubte_lehrer, teacher_id FROM students ORDER BY id")
      .all() as {
      id: number;
      name: string;
      einheiten_pro_woche: number;
      geplante_dauer: number;
      modus_wunsch: string;
      erlaubte_lehrer: string | null;
      teacher_id: number | null;
    }[]
  )
    .filter((s) => Number(s.einheiten_pro_woche) > 0)
    .map<PlanungSchueler>((s) => ({
      id: s.id,
      name: s.name,
      einheitenProWoche: Math.max(0, Math.min(40, Math.round(Number(s.einheiten_pro_woche) || 0))),
      geplanteDauer: Math.max(1, Math.min(300, Math.round(Number(s.geplante_dauer) || 100))),
      preferredTeacherId: s.teacher_id,
      allowedTeacherIds: parseIdListe(s.erlaubte_lehrer),
      modusWunsch: (["vor_ort", "online", "egal"] as const).includes(s.modus_wunsch as ModusWunsch) ? (s.modus_wunsch as ModusWunsch) : "egal",
      availability: verfuegbarkeitFuer("student", s.id, woche).availability,
    }));

  return {
    lehrer,
    schueler,
    raeume: listRaeume().map((r) => ({ id: r.id, building: r.building, name: r.name, mode: r.mode })),
    gesperrte: einheitenFuerWoche(woche, { status: "alle" })
      .filter((z) => z.locked === 1)
      .map(alsGeplanteEinheit),
    regeln: leseRegeln(),
  };
}

export type GenerierErgebnis =
  | { ok: true; anzahl: number; offen: OffenerEintrag[]; zeitbudgetErreicht: boolean; dauerMs: number }
  | { ok: false; fehler: string };

/**
 * „Neu generieren“ (D24): die Woche neu berechnen und als Entwurf speichern — gesperrte Plätze
 * bleiben stehen, weil sie Eingabe des Generators sind. Eine veröffentlichte Woche wird nicht neu
 * generiert; dort werden einzelne Plätze geändert.
 */
export function neuGenerieren(weekStart: string, opts: { seed?: number; zeitbudgetMs?: number } = {}): GenerierErgebnis {
  if (!istDatum(weekStart)) return { ok: false, fehler: "Bitte eine Woche wählen." };
  const woche = wochenstartVon(weekStart);
  if (wochenStatus(woche) === "veroeffentlicht")
    return { ok: false, fehler: "Für diese Woche ist der Plan schon veröffentlicht. Dort lassen sich nur einzelne Plätze ändern." };

  const eingaben = wochenEingaben(woche);
  const ergebnis = generiereWochenplan({
    lehrer: eingaben.lehrer,
    schueler: eingaben.schueler,
    raeume: eingaben.raeume,
    gesperrte: eingaben.gesperrte,
    regeln: eingaben.regeln,
    seed: opts.seed,
    zeitbudgetMs: opts.zeitbudgetMs,
  });
  const geschrieben = speichereEntwurf(woche, ergebnis.einheiten);
  if (!geschrieben.ok) return geschrieben;
  return { ok: true, anzahl: geschrieben.anzahl, offen: ergebnis.offen, zeitbudgetErreicht: ergebnis.zeitbudgetErreicht, dauerMs: ergebnis.dauerMs };
}
