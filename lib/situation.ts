/**
 * Wohin die Lehrkraft gerade gehört (niko, 25.10.2026: „Die Navigation richtet sich nach der Situation“). Läuft
 * eine eigene Einheit, ist es der **Unterricht**; ist heute eine Einheit beendet und ihre Dokumentation noch nicht
 * bestätigt, der **Abschluss**; sonst **Heute**. Gebraucht von `/jetzt` (nach der Anmeldung und am Logo),
 * `/unterricht` und `/abschluss`. Ohne KI, nur lesen.
 *
 * Nie eine Falle: Einheiten anderer Lehrkräfte zählen nicht, und eine unbestätigte Dokumentation von gestern
 * führt nicht mehr automatisch zum Abschluss (sie steht nur in der Liste unter `/abschluss`).
 */
import { db } from "./db";
import { wienerDatum } from "./planung/zeit";
import { runningUnits } from "./units";

export type Laufend = { id: number; started_at: string };

/** Eine beendete Einheit, deren Dokumentation noch nicht bestätigt ist (`lessons.reviewed_at` leer). */
export type OffenerAbschluss = { unitId: number; lessonId: number; studentId: number; studentName: string; subject: string; startedAt: string; endedAt: string; endedBy?: string | null };

export type Lage = { art: "unterricht"; unitId: number } | { art: "abschluss"; unitId: number } | { art: "heute" };

/** Bei zwei Einheiten zugleich: die zuerst gestartete. */
export function unterrichtZiel(laufend: Laufend[]): number | null {
  const erste = [...laufend].sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id - b.id)[0];
  return erste?.id ?? null;
}

/** Die zuletzt beendete Einheit von heute (Wien), deren Dokumentation noch offen ist; ältere führen nicht hin. */
export function abschlussZiel(offen: Pick<OffenerAbschluss, "unitId" | "endedAt">[], heute: string): number | null {
  const vonHeute = offen.filter((o) => wienerDatum(new Date(o.endedAt)) === heute).sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  return vonHeute[0]?.unitId ?? null;
}

export function lage(laufend: Laufend[], offen: Pick<OffenerAbschluss, "unitId" | "endedAt">[], heute: string): Lage {
  const u = unterrichtZiel(laufend);
  if (u !== null) return { art: "unterricht", unitId: u };
  const a = abschlussZiel(offen, heute);
  if (a !== null) return { art: "abschluss", unitId: a };
  return { art: "heute" };
}

export const lageHref = (l: Lage) => (l.art === "heute" ? "/" : `/einheiten/${l.unitId}`);

/** Wie weit `/abschluss` zurückschaut. */
export const ABSCHLUSS_TAGE = 14;

/** Die eigenen beendeten Einheiten der letzten `tage` Tage mit unbestätigter Dokumentation, die neueste zuerst. */
export function offeneAbschluesse(teacherId: number, o: { tage?: number; now?: Date } = {}): OffenerAbschluss[] {
  const now = o.now ?? new Date();
  const seit = new Date(now.getTime() - (o.tage ?? ABSCHLUSS_TAGE) * 86_400_000).toISOString();
  return db()
    .prepare(
      `SELECT u.id AS unitId, l.id AS lessonId, u.student_id AS studentId, s.name AS studentName, u.subject, u.started_at AS startedAt, u.ended_at AS endedAt, u.ended_by AS endedBy
       FROM units u JOIN lessons l ON l.unit_id = u.id JOIN students s ON s.id = u.student_id
       WHERE u.teacher_id = ? AND u.status = 'beendet' AND l.reviewed_at IS NULL AND u.ended_at IS NOT NULL AND u.ended_at >= ?
       ORDER BY u.ended_at DESC`,
    )
    .all(teacherId, seit) as OffenerAbschluss[];
}

/** Die Lage einer Lehrkraft jetzt. */
export function lageFuer(teacherId: number, now: Date = new Date()): Lage {
  return lage(runningUnits(teacherId), offeneAbschluesse(teacherId, { tage: 2, now }), wienerDatum(now));
}
