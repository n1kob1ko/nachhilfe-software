/**
 * Ein angefangenes Blockwerk-Spiel merken und später weiterspielen (niko 2026-11-22: „was wenn ein schüler die runde
 * nicht beendet aber gehen muss … es ist grad bei blockwerk“). Bis dahin war ein Spiel weg, sobald man das Kreuz
 * drückte oder die App schloss, und nicht beendete Runden von gestern räumten sich weg.
 *
 * Das Spiel schickt nach jedem Zug seinen Stand (components/lernen/Lernspiel.tsx, `BlockwerkStand`): das Brett mit
 * Teilen, Punkten, Blitz und Fieber, dazu die laufende Runde mit den schon gegebenen Antworten. Er liegt an der ersten
 * Runde des Spiels (Spalte `spielrunden.brett_stand`, wie die Punkte in `bloecke`). Beim nächsten Öffnen zeigt Blockwerk
 * „Weiterspielen“; ein neues Spiel beendet das alte mit seinen Punkten (app/lernspiel-actions.ts). Das Ende des Spiels
 * löscht den Stand. Angefangene Spiele bleiben `HALTEN_TAGE` Tage, dann räumen sie sich weg wie andere offene Runden.
 */
import { db, json } from "./db";
import type { SpielAntwort, SpielArt, SpielKarte } from "./lernspiele-typen";

/** So lange bleibt ein angefangenes Spiel zum Weiterspielen. */
export const HALTEN_TAGE = 14;
/** Größer wird ein Stand nicht (Brett, Teile und eine Runde Antworten sind ein paar kB). */
export const STAND_MAX_ZEICHEN = 40_000;

/** Ein Teil, wie lib/blockwerk.ts es kennt (nur, was der Stand braucht). */
type TeilStand = { id: number; form: string; zellen: [number, number][]; breite: number; hoehe: number; farbe: number };

/** Der Stand des Bretts (components/lernen/BlockFeld.tsx). */
export type FeldStand = {
  brett: (number | null)[];
  teile: (TeilStand | null)[];
  punkte: number;
  kombo: { kombo: number; ohne: number };
  blitze: number;
  ladung: number;
  serie: number;
  gerettet: boolean;
  /** die Frage, auf die das Brett gerade wartet (neue Teile oder Rettung) */
  wartend: { grund: "teile" | "rettung"; vorschau: TeilStand[]; ladung: number } | null;
};

/** Was das Spiel schickt: die laufende Runde, wo man in ihr steht, die Antworten darin und das Brett. */
export type BlockwerkStand = {
  rundeId: number;
  /** die Karten der Runde in ihrer Reihenfolge (mit Wiederholungen), als Schlüssel */
  reihe: { key: string; wiederholung: boolean }[];
  pos: number;
  antworten: SpielAntwort[];
  feld: FeldStand;
};

/** Ein angefangenes Spiel: das Spiel (`lauf`), aus welchem Lernspiel die Fragen kommen, und die Karten der Runde. */
export type OffenesBlockwerk = { lauf: number; art: SpielArt; punkte: number; stand: BlockwerkStand; karten: SpielKarte[] };

const zahl = (x: unknown) => typeof x === "number" && Number.isFinite(x);

/** Grob prüfen, ob das ein Stand ist (der Rest kommt vom Spiel selbst und wird beim Laden noch einmal geprüft). */
export function istStand(x: unknown): x is BlockwerkStand {
  if (!x || typeof x !== "object") return false;
  const s = x as BlockwerkStand;
  const f = s.feld;
  return (
    zahl(s.rundeId) &&
    zahl(s.pos) &&
    Array.isArray(s.reihe) &&
    s.reihe.every((e) => e && typeof e.key === "string") &&
    Array.isArray(s.antworten) &&
    !!f &&
    Array.isArray(f.brett) &&
    f.brett.length === 64 &&
    f.brett.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 5)) &&
    Array.isArray(f.teile) &&
    f.teile.length === 3 &&
    zahl(f.punkte) &&
    zahl(f.blitze) &&
    zahl(f.ladung) &&
    zahl(f.serie)
  );
}

type RundenZeile = { id: number; endlos: number | null; beendet_at: string | null; bloecke: number | null };

/**
 * Den Stand eines laufenden Blockwerk-Spiels merken. Nur für eine offene Runde dieses Schülers, die zu einem
 * Blockwerk-Spiel gehört. `false`: nicht gemerkt.
 */
export function merkeStand(studentId: number, stand: unknown): boolean {
  if (!istStand(stand)) return false;
  const text = JSON.stringify(stand);
  if (text.length > STAND_MAX_ZEICHEN) return false;
  const runde = db().prepare("SELECT id, endlos, beendet_at, bloecke FROM spielrunden WHERE id = ? AND student_id = ?").get(stand.rundeId, studentId) as RundenZeile | undefined;
  if (!runde || runde.beendet_at || runde.endlos === null) return false;
  const lauf = db().prepare("SELECT id, bloecke FROM spielrunden WHERE id = ? AND student_id = ?").get(runde.endlos, studentId) as { id: number; bloecke: number | null } | undefined;
  if (!lauf || lauf.bloecke === null) return false;
  db().prepare("UPDATE spielrunden SET brett_stand = ? WHERE id = ?").run(text, lauf.id);
  return true;
}

/** Den Stand eines Spiels vergessen (am Ende des Spiels oder wenn ein neues beginnt). */
export function vergissStand(studentId: number, lauf: number) {
  db().prepare("UPDATE spielrunden SET brett_stand = NULL WHERE id = ? AND student_id = ?").run(lauf, studentId);
}

/**
 * Das zuletzt angefangene Blockwerk-Spiel des Schülers, oder null. Passt der Stand nicht mehr (die Runde ist beendet
 * oder weg), wird er vergessen.
 */
export function offenesBlockwerk(studentId: number): OffenesBlockwerk | null {
  const z = db()
    .prepare(`SELECT id, art, brett_stand FROM spielrunden WHERE student_id = ? AND brett_stand IS NOT NULL AND bloecke IS NOT NULL AND created_at >= datetime('now', '-${HALTEN_TAGE} day') ORDER BY id DESC LIMIT 1`)
    .get(studentId) as { id: number; art: SpielArt; brett_stand: string } | undefined;
  if (!z) return null;
  const stand = json<unknown>(z.brett_stand, null);
  const runde = istStand(stand)
    ? (db().prepare("SELECT karten FROM spielrunden WHERE id = ? AND student_id = ? AND endlos = ? AND beendet_at IS NULL").get(stand.rundeId, studentId, z.id) as { karten: string } | undefined)
    : undefined;
  if (!istStand(stand) || !runde) {
    vergissStand(studentId, z.id);
    return null;
  }
  const karten = json<SpielKarte[]>(runde.karten, []);
  const keys = new Set(karten.map((k) => k.key));
  if (!karten.length || !stand.reihe.every((e) => keys.has(e.key))) {
    vergissStand(studentId, z.id);
    return null;
  }
  return { lauf: z.id, art: z.art, punkte: Math.max(0, Math.round(stand.feld.punkte)), stand, karten };
}

/**
 * Für das Aufräumen offener Runden (lib/lernspiele.ts `starteRunde`): die Runden eines angefangenen Blockwerk-Spiels
 * bleiben `HALTEN_TAGE` Tage stehen, alle anderen offenen nur bis morgen.
 */
export const BEHALTEN_SQL = `endlos IN (SELECT id FROM spielrunden WHERE brett_stand IS NOT NULL AND created_at >= datetime('now', '-${HALTEN_TAGE} day'))`;
