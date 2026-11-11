/**
 * Wochenliga (niko 2026-11-11, Konzept A): Punkte für **Einsatz und Besserwerden**, nicht für reines Können, damit auch
 * schwächere Schüler vorne stehen können.
 *
 * - Je beendete Runde 20 Punkte, dazu bis 30 extra, wenn sie besser war als der eigene Schnitt der letzten zehn Runden
 *   desselben Spiels (+1 je Prozentpunkt). Die erste Runde eines Spiels bekommt 10 extra.
 * - Damit Durchklicken nichts bringt: eine Runde unter 25 Sekunden oder mit weniger als 3 richtigen zählt nicht, und am
 *   Tag zählen höchstens 10 Runden.
 * - Gruppen bis 8 Spieler in vier Stufen (Bronze, Silber, Gold, Diamant). Jeden Montag (Wiener Zeit) beginnt eine neue
 *   Woche; wer in seiner Gruppe unter den ersten 3 war (mit Punkten), steigt auf. Absteigen gibt es nicht.
 * - Mit dabei ist nur, wer ein Spielprofil mit Liga hat und mitmachen darf (lib/spielprofil.ts). Gezeigt werden nur
 *   Spitzname, Bild, Punkte und Runden.
 */
import { parseTime } from "./analysis";
import { db } from "./db";
import { tagAddieren, wienerDatum, wochenstartVon } from "./planung/zeit";
import { AB_SCHULSTUFE, aktivesProfil, BILDER } from "./spielprofil";
import type { Student } from "./repo";

export const STUFEN = ["Bronze", "Silber", "Gold", "Diamant"] as const;
export const GRUPPE_MAX = 8;
export const AUFSTIEG = 3;
export const GRUND_PUNKTE = 20;
export const BONUS_MAX = 30;
export const ERSTE_RUNDE_BONUS = 10;
export const MIN_SEKUNDEN = 25;
export const RUNDEN_PRO_TAG = 10;
/** so viele richtige braucht eine Runde (Raten trifft etwa ein Viertel), damit wildes Tippen nichts bringt */
export const MIN_RICHTIG = 3;

const tagVon = (s: string) => wienerDatum(new Date(parseTime(s)));
const wocheVon = (s: string) => wochenstartVon(tagVon(s));

type Runde = { id: number; student_id: number; art: string; richtig: number; anzahl: number; created_at: string; beendet_at: string | null; punkte: number };

/**
 * Ligapunkte einer gerade beendeten Runde (einmal, beim Beenden). Gibt 0 zurück und speichert nichts, wenn der Schüler
 * nicht in der Liga ist oder die Runde nicht zählt.
 */
export function vergibPunkte(student: Pick<Student, "id" | "grade">, rundeId: number, jetzt: Date = new Date()): { punkte: number; bonus: number; grund?: string } {
  const p = aktivesProfil(student);
  if (!p?.liga) return { punkte: 0, bonus: 0 };
  const r = db().prepare("SELECT * FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, student.id) as Runde | undefined;
  if (!r || !r.beendet_at || !r.anzahl || r.punkte > 0) return { punkte: r?.punkte ?? 0, bonus: 0 };
  const sekunden = (parseTime(r.beendet_at) - parseTime(r.created_at)) / 1000;
  if (sekunden < MIN_SEKUNDEN) return { punkte: 0, bonus: 0, grund: "Zu schnell durchgeklickt: diese Runde zählt nicht für die Liga." };
  if (r.richtig < MIN_RICHTIG) return { punkte: 0, bonus: 0, grund: `Ab ${MIN_RICHTIG} richtigen bringt eine Runde Ligapunkte.` };
  const heute = wienerDatum(jetzt);
  const gezaehlt = (db().prepare("SELECT beendet_at FROM spielrunden WHERE student_id = ? AND punkte > 0 AND beendet_at >= datetime('now', '-2 day')").all(student.id) as { beendet_at: string }[]).filter(
    (z) => tagVon(z.beendet_at) === heute,
  ).length;
  if (gezaehlt >= RUNDEN_PRO_TAG) return { punkte: 0, bonus: 0, grund: `Heute zählen schon ${RUNDEN_PRO_TAG} Runden für die Liga. Morgen geht es weiter.` };

  const frueher = db()
    .prepare("SELECT richtig, anzahl FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL AND anzahl > 0 AND id < ? ORDER BY id DESC LIMIT 10")
    .all(student.id, r.art, r.id) as { richtig: number; anzahl: number }[];
  const anteil = r.richtig / r.anzahl;
  let bonus: number;
  if (!frueher.length) bonus = ERSTE_RUNDE_BONUS;
  else {
    const schnitt = frueher.reduce((s, x) => s + x.richtig / x.anzahl, 0) / frueher.length;
    bonus = Math.max(0, Math.min(BONUS_MAX, Math.round((anteil - schnitt) * 100)));
  }
  const punkte = GRUND_PUNKTE + bonus;
  db().prepare("UPDATE spielrunden SET punkte = ? WHERE id = ?").run(punkte, r.id);
  trittBei(student, heute);
  return { punkte, bonus };
}

/** Punkte und Runden je Schüler in einer Woche. */
function wochenPunkte(ids: number[], woche: string): Map<number, { punkte: number; runden: number }> {
  const out = new Map<number, { punkte: number; runden: number }>();
  if (!ids.length) return out;
  // eine Woche in Wien beginnt in UTC schon am Sonntagabend: großzügig holen, dann genau filtern
  const von = tagAddieren(woche, -1);
  const bis = tagAddieren(woche, 8);
  const rows = db()
    .prepare(`SELECT student_id, punkte, beendet_at FROM spielrunden WHERE punkte > 0 AND beendet_at >= ? AND beendet_at < ? AND student_id IN (${ids.map(() => "?").join(",")})`)
    .all(von, bis, ...ids) as { student_id: number; punkte: number; beendet_at: string }[];
  for (const r of rows) {
    if (wocheVon(r.beendet_at) !== woche) continue;
    const e = out.get(r.student_id) ?? { punkte: 0, runden: 0 };
    e.punkte += r.punkte;
    e.runden += 1;
    out.set(r.student_id, e);
  }
  return out;
}

type Platz = { student_id: number; stufe: number; gruppe: number };

/** Plätze einer Gruppe nach Punkten (bei Gleichstand nach weniger Runden, dann nach Beitritt). */
function rangliste(woche: string, stufe: number, gruppe: number) {
  const mitglieder = db().prepare("SELECT student_id, rowid AS r FROM spielliga WHERE woche = ? AND stufe = ? AND gruppe = ? ORDER BY rowid").all(woche, stufe, gruppe) as { student_id: number; r: number }[];
  const p = wochenPunkte(
    mitglieder.map((m) => m.student_id),
    woche,
  );
  return mitglieder
    .map((m) => ({ studentId: m.student_id, beitritt: m.r, ...(p.get(m.student_id) ?? { punkte: 0, runden: 0 }) }))
    .sort((a, b) => b.punkte - a.punkte || a.runden - b.runden || a.beitritt - b.beitritt);
}

/** Stufe für eine neue Woche: wie zuletzt, eine höher, wenn der Schüler in seiner letzten Woche aufgestiegen ist. */
function stufeFuerNeueWoche(studentId: number, woche: string): number {
  const letzte = db().prepare("SELECT * FROM spielliga WHERE student_id = ? AND woche < ? ORDER BY woche DESC LIMIT 1").get(studentId, woche) as (Platz & { woche: string }) | undefined;
  if (!letzte) return 0;
  const liste = rangliste(letzte.woche, letzte.stufe, letzte.gruppe);
  const platz = liste.findIndex((x) => x.studentId === studentId);
  const aufgestiegen = platz >= 0 && platz < AUFSTIEG && liste[platz].punkte > 0;
  return Math.min(STUFEN.length - 1, letzte.stufe + (aufgestiegen ? 1 : 0));
}

/** Der Schüler tritt der Woche bei (falls noch nicht): Stufe nach letzter Woche, die erste Gruppe dort mit freiem Platz. */
export function trittBei(student: Pick<Student, "id">, heute: string = wienerDatum()): Platz {
  const woche = wochenstartVon(heute);
  const da = db().prepare("SELECT student_id, stufe, gruppe FROM spielliga WHERE woche = ? AND student_id = ?").get(woche, student.id) as Platz | undefined;
  if (da) return da;
  const stufe = stufeFuerNeueWoche(student.id, woche);
  const gruppen = db().prepare("SELECT gruppe, COUNT(*) AS n FROM spielliga WHERE woche = ? AND stufe = ? GROUP BY gruppe ORDER BY gruppe").all(woche, stufe) as { gruppe: number; n: number }[];
  const frei = gruppen.find((g) => g.n < GRUPPE_MAX)?.gruppe ?? (gruppen.length ? Math.max(...gruppen.map((g) => g.gruppe)) + 1 : 1);
  db().prepare("INSERT OR IGNORE INTO spielliga (woche, student_id, stufe, gruppe) VALUES (?, ?, ?, ?)").run(woche, student.id, stufe, frei);
  return { student_id: student.id, stufe, gruppe: frei };
}

export type LigaZeile = { platz: number; name: string; bild: string; punkte: number; runden: number; ich: boolean };
export type LigaTabelle = {
  stufe: number;
  stufenName: string;
  /** Tage bis Sonntag, heute mitgezählt */
  tageRest: number;
  zeilen: LigaZeile[];
  /** wie viele aufsteigen (0 in der höchsten Stufe) */
  aufstieg: number;
  ichPunkte: number;
};

/**
 * Die Gruppe des Schülers in dieser Woche. Wer Liga ausgeschaltet hat oder nicht mehr darf, steht nicht in der Liste
 * (auch nicht bei den anderen). null, wenn der Schüler selbst nicht mitmacht.
 */
export function ligaTabelle(student: Pick<Student, "id" | "grade">, heute: string = wienerDatum()): LigaTabelle | null {
  const p = aktivesProfil(student);
  if (!p?.liga) return null;
  const platz = trittBei(student, heute);
  const woche = wochenstartVon(heute);
  const profile = new Map(
    (
      db().prepare("SELECT sp.student_id, sp.name, sp.bild, sp.liga, s.grade, s.wettspiel FROM spielprofile sp JOIN students s ON s.id = sp.student_id").all() as {
        student_id: number;
        name: string;
        bild: string;
        liga: number;
        grade: number;
        wettspiel: string;
      }[]
    ).map((z) => [z.student_id, z]),
  );
  const sichtbar = (id: number) => {
    const z = profile.get(id);
    return !!z && !!z.liga && z.wettspiel !== "nein" && (z.wettspiel === "ja" || z.grade >= AB_SCHULSTUFE);
  };
  const liste = rangliste(woche, platz.stufe, platz.gruppe).filter((x) => x.studentId === student.id || sichtbar(x.studentId));
  const tageRest = 8 - (new Date(`${heute}T12:00:00Z`).getUTCDay() || 7);
  return {
    stufe: platz.stufe,
    stufenName: STUFEN[platz.stufe],
    tageRest,
    aufstieg: platz.stufe < STUFEN.length - 1 ? AUFSTIEG : 0,
    ichPunkte: liste.find((x) => x.studentId === student.id)?.punkte ?? 0,
    zeilen: liste.map((x, i) => {
      const z = profile.get(x.studentId);
      return { platz: i + 1, name: z?.name ?? "", bild: BILDER[z?.bild ?? ""] ?? "🙂", punkte: x.punkte, runden: x.runden, ich: x.studentId === student.id };
    }),
  };
}
