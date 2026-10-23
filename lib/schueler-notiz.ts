/**
 * Was der Schüler selbst in der Schüler-App schreibt, für die Vorbereitung der nächsten Einheit (Plan 3.2):
 *
 * - **Notiz nach der Einheit**: Nach einer Einheit fragt die App einmal „Was war heute schwer?“, mit ein paar
 *   Antworten zum Antippen und freiem Text, beides freiwillig. Eine Notiz je Schüler und Einheit.
 * - **Für nächstes Mal**: jederzeit ein Satz, was drankommen soll oder was er in der Schule gerade nicht
 *   versteht („Wir haben heute die vier Fälle begonnen. Den dritten und vierten verstehe ich nicht.“).
 *
 * Beides kann der Schüler ändern, bis die nächste Einheit beginnt. Der Lehrer sieht es im Cockpit der nächsten
 * Einheit, bei „Einheit vorbereiten“ und im Lernverlauf. Ohne KI sucht die App in den Wörtern nach einer
 * Fähigkeit (wie beim Stoff einer Schularbeit, `stoffVorschlag`); ein passendes Lernpaket bekommt das als
 * „Warum heute“. Gespeichert wird davon nichts: es sind die Worte des Schülers, keine Beobachtung. Sie zählen
 * nicht für Lernstand, Einschätzung oder Diagnose und gehen nicht an die KI.
 */
import { db, json } from "./db";
import { stoffVorschlag } from "./lehrplan";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { bereinigeAuswahl, bereinigeText, type NotizWahl } from "./schueler-notiz-auswahl";

export { NOTIZ_AUSWAHL, NOTIZ_TEXT_MAX, bereinigeAuswahl, bereinigeText, notizLabel, type NotizWahl } from "./schueler-notiz-auswahl";

export type SchuelerNotiz = {
  unit_id: number;
  student_id: number;
  auswahl: NotizWahl[];
  text: string;
  /** „Überspringen“ getippt: die Frage kommt nicht wieder, schreiben geht weiter */
  uebersprungen: boolean;
  created_at: string;
  updated_at: string;
};

type Zeile = Omit<SchuelerNotiz, "auswahl" | "uebersprungen"> & { auswahl: string; uebersprungen: number };

const lies = (z: Zeile): SchuelerNotiz => ({ ...z, auswahl: bereinigeAuswahl(json<unknown[]>(z.auswahl, [])), uebersprungen: Boolean(z.uebersprungen) });

/** Hat der Schüler etwas geschrieben oder angetippt? Eine übersprungene Notiz hat nichts. */
export const hatInhalt = (n: Pick<SchuelerNotiz, "auswahl" | "text"> | null | undefined): n is SchuelerNotiz => Boolean(n && (n.auswahl.length || n.text));

export function notizZuEinheit(unitId: number): SchuelerNotiz | null {
  const z = db().prepare("SELECT * FROM schueler_notizen WHERE unit_id = ?").get(unitId) as Zeile | undefined;
  return z ? lies(z) : null;
}

/** Die Notizen eines Schülers mit Inhalt, je Einheit (für den Lernverlauf). */
export function notizenFuerSchueler(studentId: number): Map<number, SchuelerNotiz> {
  const rows = db().prepare("SELECT * FROM schueler_notizen WHERE student_id = ?").all(studentId) as Zeile[];
  return new Map(rows.map(lies).filter(hatInhalt).map((n) => [n.unit_id, n]));
}

type EinheitKurz = { id: number; student_id: number; status: string; started_at: string };

/**
 * Die Einheit, zu der der Schüler gerade schreiben darf: seine letzte, wenn sie beendet ist. Läuft eine Einheit
 * oder hat danach schon eine begonnen, ist die Notiz zu. Abgebrochene Einheiten (aus Versehen gestartet) zählen
 * nicht.
 */
export function offeneEinheit(studentId: number): EinheitKurz | null {
  const u = db()
    .prepare("SELECT id, student_id, status, started_at FROM units WHERE student_id = ? AND status <> 'abgebrochen' ORDER BY started_at DESC, id DESC LIMIT 1")
    .get(studentId) as EinheitKurz | undefined;
  return u?.status === "beendet" ? u : null;
}

export type Speichern = { ok: true } | { fehler: string };

/** Prüft, dass die Einheit dem Schüler gehört und die Notiz noch offen ist. */
function darfSchreiben(studentId: number, unitId: number): Speichern {
  const offen = offeneEinheit(studentId);
  if (!offen || offen.id !== unitId) return { fehler: "Zu dieser Einheit kannst du nichts mehr schreiben." };
  return { ok: true };
}

/** Speichert die Notiz (neu oder geändert). Ohne Auswahl und Text zählt sie als übersprungen. */
export function speichereNotiz(studentId: number, unitId: number, eingabe: { auswahl: unknown[]; text: string }): Speichern {
  const ok = darfSchreiben(studentId, unitId);
  if ("fehler" in ok) return ok;
  const auswahl = bereinigeAuswahl(eingabe.auswahl);
  const text = bereinigeText(eingabe.text);
  const leer = !auswahl.length && !text;
  db()
    .prepare(
      `INSERT INTO schueler_notizen (unit_id, student_id, auswahl, text, uebersprungen) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(unit_id) DO UPDATE SET auswahl = excluded.auswahl, text = excluded.text, uebersprungen = excluded.uebersprungen, updated_at = datetime('now')`,
    )
    .run(unitId, studentId, JSON.stringify(auswahl), text, leer ? 1 : 0);
  return ok;
}

/** „Überspringen“: die Frage kommt nicht wieder. Was schon geschrieben ist, bleibt. */
export function ueberspringeNotiz(studentId: number, unitId: number): Speichern {
  const ok = darfSchreiben(studentId, unitId);
  if ("fehler" in ok) return ok;
  db().prepare("INSERT INTO schueler_notizen (unit_id, student_id, uebersprungen) VALUES (?, ?, 1) ON CONFLICT(unit_id) DO NOTHING").run(unitId, studentId);
  return ok;
}

/**
 * Für die Schüler-App: die Einheit, zu der er schreiben darf, und seine Notiz dazu. Ohne Notiz (weder
 * beantwortet noch übersprungen) kommt die Frage. Null, wenn gerade nichts offen ist.
 */
export function notizFuerSchueler(studentId: number, now = new Date()): { unitId: number; wann: string; notiz: SchuelerNotiz | null } | null {
  const u = offeneEinheit(studentId);
  if (!u) return null;
  return { unitId: u.id, wann: wannLabel(u.started_at, now), notiz: notizZuEinheit(u.id) };
}

/** „heute“, „gestern“ oder „am Dienstag, 20. Oktober“ (Europe/Vienna). */
export function wannLabel(startedAt: string, now = new Date()): string {
  const tag = wienerDatum(new Date(startedAt));
  const heute = wienerDatum(now);
  if (tag === heute) return "heute";
  if (tag === tagAddieren(heute, -1)) return "gestern";
  return `am ${new Date(startedAt).toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Vienna" })}`;
}

/**
 * Für das Cockpit: die Notiz des Schülers zu seiner Einheit davor (der letzten beendeten, die vor dieser begann),
 * wenn er dort etwas geschrieben hat. Weiter zurück wird nicht gesucht.
 */
export function notizVorEinheit(unitId: number): { notiz: SchuelerNotiz; started_at: string } | null {
  const vorher = db()
    .prepare(
      `SELECT v.id, v.started_at FROM units u JOIN units v ON v.student_id = u.student_id AND v.id <> u.id
       WHERE u.id = ? AND v.status = 'beendet' AND v.started_at < u.started_at ORDER BY v.started_at DESC, v.id DESC LIMIT 1`,
    )
    .get(unitId) as { id: number; started_at: string } | undefined;
  const notiz = vorher ? notizZuEinheit(vorher.id) : null;
  return hatInhalt(notiz) && vorher ? { notiz, started_at: vorher.started_at } : null;
}

// ---------- „Für nächstes Mal“ ----------

export type Wunsch = { id: number; student_id: number; text: string; created_at: string; updated_at: string };

/** Beginn der letzten Einheit des Schülers (ohne abgebrochene), wahlweise nur vor `vor`. */
function letzterStart(studentId: number, vor?: string): string | null {
  const r = db()
    .prepare("SELECT started_at FROM units WHERE student_id = ? AND status <> 'abgebrochen' AND (@vor IS NULL OR started_at < @vor) ORDER BY started_at DESC LIMIT 1")
    .get(studentId, { vor: vor ?? null }) as { started_at: string } | undefined;
  return r?.started_at ?? null;
}

/** Was der Schüler seit dem Beginn seiner letzten Einheit für das nächste Mal geschrieben hat: das kann er noch ändern. */
export function offenerWunsch(studentId: number): Wunsch | null {
  const seit = letzterStart(studentId);
  return (
    (db()
      .prepare("SELECT * FROM schueler_wuensche WHERE student_id = ? AND (@seit IS NULL OR created_at > @seit) ORDER BY created_at DESC, id DESC LIMIT 1")
      .get(studentId, { seit }) as Wunsch | undefined) ?? null
  );
}

/** Schreibt, ändert oder (leer) löscht den offenen Wunsch. Zeiten als ISO, damit sie sich mit `units.started_at` vergleichen lassen. */
export function speichereWunsch(studentId: number, text: string, now = new Date()): Speichern {
  const t = bereinigeText(text);
  const offen = offenerWunsch(studentId);
  const conn = db();
  if (!t) {
    if (offen) conn.prepare("DELETE FROM schueler_wuensche WHERE id = ?").run(offen.id);
  } else if (offen) conn.prepare("UPDATE schueler_wuensche SET text = ?, updated_at = ? WHERE id = ?").run(t, now.toISOString(), offen.id);
  else conn.prepare("INSERT INTO schueler_wuensche (student_id, text, created_at, updated_at) VALUES (?, ?, ?, ?)").run(studentId, t, now.toISOString(), now.toISOString());
  return { ok: true };
}

/** Der Wunsch für diese Einheit: geschrieben nach dem Beginn der Einheit davor und vor ihrem eigenen. */
export function wunschVorEinheit(unitId: number): Wunsch | null {
  const u = db().prepare("SELECT student_id, started_at FROM units WHERE id = ?").get(unitId) as { student_id: number; started_at: string } | undefined;
  if (!u) return null;
  const seit = letzterStart(u.student_id, u.started_at);
  return (
    (db()
      .prepare("SELECT * FROM schueler_wuensche WHERE student_id = ? AND created_at < @bis AND (@seit IS NULL OR created_at > @seit) ORDER BY created_at DESC, id DESC LIMIT 1")
      .get(u.student_id, { bis: u.started_at, seit }) as Wunsch | undefined) ?? null
  );
}

/** Jeder Wunsch bei der Einheit, für die er geschrieben war (der ersten, die danach begann), für den Lernverlauf. */
export function wuenscheFuerSchueler(studentId: number): Map<number, Wunsch> {
  const units = db().prepare("SELECT id, started_at FROM units WHERE student_id = ? AND status <> 'abgebrochen' ORDER BY started_at").all(studentId) as { id: number; started_at: string }[];
  const out = new Map<number, Wunsch>();
  for (const w of db().prepare("SELECT * FROM schueler_wuensche WHERE student_id = ? ORDER BY created_at").all(studentId) as Wunsch[]) {
    const u = units.find((x) => x.started_at > w.created_at);
    if (u) out.set(u.id, w);
  }
  return out;
}

// ---------- for the teacher: everything the student wrote before a unit ----------

/** Fächer mit Fähigkeiten in der App. */
const FAECHER = ["Mathematik", "Deutsch", "Englisch"];
/** Höchstens so viele Fähigkeiten je Text. */
const TREFFER_MAX = 3;
/**
 * Wörter, mit denen Schüler sagen, dass etwas schwer ist, nicht was: „verstehe“ ist sonst „Redewendungen
 * verstehen“, „Schule“ ein Thema. Sie fallen vor dem Vergleich weg.
 */
const FUELLWOERTER = /(?<![\p{L}\d])(?:versteh|verstand|kapier|schul|schwer|begonnen|angefangen|gelernt|lernen)[\p{L}]*/giu;

/**
 * Die Fähigkeiten, die ein Text des Schülers sicher nennt, ohne KI: dieselbe Regel wie beim Stoff einer
 * Schularbeit (`stoffVorschlag`, nur was eindeutig passt), in den Fächern seines Profils.
 */
export function faehigkeitenAus(text: string, student: repo.Student): repo.Skill[] {
  const stoff = text.replace(FUELLWOERTER, " ").trim();
  if (!stoff) return [];
  const faecher = student.subjects.filter((f) => FAECHER.includes(f));
  const ids = (faecher.length ? faecher : FAECHER).flatMap((f) => stoffVorschlag([stoff], f, student)[0]?.best ?? []);
  return [...new Set(ids)]
    .map((id) => repo.getSkill(id))
    .filter((s): s is repo.Skill => Boolean(s))
    .slice(0, TREFFER_MAX);
}

export type SchuelerWorte = {
  /** „Was war schwer?“ nach der Einheit davor */
  schwer: { notiz: SchuelerNotiz; started_at: string } | null;
  /** „Für nächstes Mal“ */
  wunsch: Wunsch | null;
  /** je Text mit Treffern: die Fähigkeiten, die er nennt */
  treffer: { text: string; skills: repo.Skill[] }[];
};

/**
 * Was der Schüler vor einer Einheit geschrieben hat: vor `unitId` (Cockpit), oder ohne Einheit das, was gerade
 * offen ist (für die nächste, „Einheit vorbereiten“). Null, wenn er nichts geschrieben hat.
 */
export function schuelerWorte(studentId: number, unitId: number | null): SchuelerWorte | null {
  const student = repo.getStudent(studentId);
  if (!student) return null;
  let schwer: SchuelerWorte["schwer"] = null;
  let wunsch: Wunsch | null;
  if (unitId) {
    schwer = notizVorEinheit(unitId);
    wunsch = wunschVorEinheit(unitId);
  } else {
    const u = offeneEinheit(studentId);
    const notiz = u ? notizZuEinheit(u.id) : null;
    if (u && hatInhalt(notiz)) schwer = { notiz, started_at: u.started_at };
    wunsch = offenerWunsch(studentId);
  }
  if (!schwer && !wunsch) return null;
  const treffer = [wunsch?.text ?? "", schwer?.notiz.text ?? ""].map((text) => ({ text, skills: faehigkeitenAus(text, student) })).filter((t) => t.skills.length);
  return { schwer, wunsch, treffer };
}
