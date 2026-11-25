/**
 * Angefangene Lernspiele merken und weiterspielen (niko 2026-11-25: „das spiel abspeichern wenn ein update kommt oder so
 * funktioniert nicht gut. es soll halt den stand halten und wenn was passiert, dass man halt zurück zum spielstand gehen
 * kann“).
 *
 * Jedes Spiel schickt nach jedem Zug seinen Stand (components/lernen/spielstand.ts `useSpielstand`): was es braucht, um
 * genau dort weiterzumachen, als JSON, dazu die Runden, an denen er hängt. Das Gerät behält eine Kopie (localStorage),
 * damit auch ein Zug zählt, während der Server gerade neu startet (Deploy). Beim nächsten Öffnen nimmt das Spiel den
 * neueren der beiden Stände (`at`) und zeigt „Weiterspielen“.
 *
 * - Ein Stand gilt nur, solange seine laufende Runde (`runden[0]`) offen ist und alle Runden dem Schüler gehören. Ist sie
 *   beendet oder weg, wird er vergessen. So kann kein Stand eines anderen Schülers (am Tablet) aufgehen.
 * - Runden mit einem Stand räumen sich nicht nach einem Tag weg (`STAND_BEHALTEN_SQL`), sondern nach `STAND_HALTEN_TAGE`.
 * - Ein neues Spiel derselben Art ersetzt den Stand; das Ende des Spiels löscht ihn.
 */
import { db, json } from "./db";

export const STAND_HALTEN_TAGE = 14;
/** Größer wird kein Stand (Karten einer Runde, Brett und Antworten sind ein paar kB). */
export const STAND_MAX_ZEICHEN = 150_000;
/** So heißt ein Spiel hier („lernspiel:artikel“, „bio“, „oesterreich“). */
const SPIEL_NAME = /^[a-z0-9:_.-]{1,80}$/i;

export type Spielstand = { stand: unknown; at: number };

const gueltigeRunden = (runden: unknown): number[] | null => {
  if (!Array.isArray(runden) || !runden.length || runden.length > 50) return null;
  const r = runden.map(Number);
  return r.every((x) => Number.isInteger(x) && x > 0) ? [...new Set(r)] : null;
};

/** Gehören alle Runden dem Schüler, und ist die erste (die laufende) noch offen? */
function passt(studentId: number, runden: number[]): boolean {
  const zeilen = db()
    .prepare(`SELECT id, beendet_at FROM spielrunden WHERE student_id = ? AND id IN (${runden.map(() => "?").join(",")})`)
    .all(studentId, ...runden) as { id: number; beendet_at: string | null }[];
  if (zeilen.length !== runden.length) return false;
  return zeilen.some((z) => z.id === runden[0] && !z.beendet_at);
}

/**
 * Den Stand eines laufenden Spiels merken. `false`: nicht gemerkt (kein gültiger Stand, eine fremde oder beendete Runde,
 * oder es liegt schon ein neuerer da).
 */
export function merkeSpielstand(studentId: number, spiel: string, stand: unknown, runden: unknown, at: number): boolean {
  if (typeof spiel !== "string" || !SPIEL_NAME.test(spiel) || stand === undefined || stand === null) return false;
  if (!Number.isFinite(at) || at <= 0) return false;
  const r = gueltigeRunden(runden);
  if (!r) return false;
  let text: string;
  try {
    text = JSON.stringify(stand);
  } catch {
    return false;
  }
  if (text.length > STAND_MAX_ZEICHEN) return false;
  if (!passt(studentId, r)) return false;
  const da = db().prepare("SELECT at FROM spielstaende WHERE student_id = ? AND spiel = ?").get(studentId, spiel) as { at: number } | undefined;
  if (da && da.at > at) return false;
  db()
    .prepare(
      `INSERT INTO spielstaende (student_id, spiel, stand, runden, at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(student_id, spiel) DO UPDATE SET stand = excluded.stand, runden = excluded.runden, at = excluded.at, updated_at = datetime('now')`,
    )
    .run(studentId, spiel, text, JSON.stringify(r), Math.round(at));
  return true;
}

/** Den Stand vergessen (das Spiel ist zu Ende oder der Schüler beginnt neu). */
export function vergissSpielstand(studentId: number, spiel: string) {
  if (typeof spiel !== "string") return;
  db().prepare("DELETE FROM spielstaende WHERE student_id = ? AND spiel = ?").run(studentId, spiel);
}

/** Der gemerkte Stand eines Spiels, oder null. Passt er nicht mehr (Runde beendet, weg oder zu alt), wird er vergessen. */
export function holeSpielstand(studentId: number, spiel: string): Spielstand | null {
  if (typeof spiel !== "string" || !SPIEL_NAME.test(spiel)) return null;
  const z = db()
    .prepare(`SELECT stand, runden, at, updated_at >= datetime('now', '-${STAND_HALTEN_TAGE} day') AS frisch FROM spielstaende WHERE student_id = ? AND spiel = ?`)
    .get(studentId, spiel) as { stand: string; runden: string; at: number; frisch: number } | undefined;
  if (!z) return null;
  const r = gueltigeRunden(json<unknown>(z.runden, []));
  const stand = json<unknown>(z.stand, null);
  if (!z.frisch || !r || stand === null || !passt(studentId, r)) {
    vergissSpielstand(studentId, spiel);
    return null;
  }
  return { stand, at: z.at };
}

/**
 * Beim Öffnen: der Server-Stand oder die Kopie vom Gerät (`kandidat`), je nachdem, welcher neuer ist und noch passt.
 * Eine neuere, gültige Kopie wird gleich am Server gemerkt.
 */
export function besterSpielstand(studentId: number, spiel: string, kandidat?: { stand: unknown; runden: unknown; at: unknown } | null): Spielstand | null {
  const server = holeSpielstand(studentId, spiel);
  const at = Number(kandidat?.at);
  if (kandidat && Number.isFinite(at) && at > (server?.at ?? 0) && merkeSpielstand(studentId, spiel, kandidat.stand, kandidat.runden, at)) {
    return holeSpielstand(studentId, spiel);
  }
  return server;
}

/**
 * Für das Aufräumen offener Runden (lib/lernspiele.ts `starteRunde`): eine Runde mit gemerktem Stand bleibt
 * `STAND_HALTEN_TAGE` Tage stehen. Erwartet die Tabelle `spielrunden` ohne Alias.
 */
export const STAND_BEHALTEN_SQL = `EXISTS (SELECT 1 FROM spielstaende ss, json_each(ss.runden) j WHERE ss.student_id = spielrunden.student_id AND j.value = spielrunden.id AND ss.updated_at >= datetime('now', '-${STAND_HALTEN_TAGE} day'))`;
