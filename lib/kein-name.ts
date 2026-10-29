/**
 * **„Kein Name auf den Seiten“ einmal je Einheit** (niko, 28.10.2026: „Einmal pro Einheit“). Vor jeder KI-Lesung von Fotos
 * oder PDFs bestätigt die Lehrkraft, dass kein Name darauf steht. In einer laufenden Einheit gilt das erste Häkchen für alle
 * weiteren Lesungen dieser Einheit (`units.keine_namen_at`); die Seite zeigt dann statt des Häkchens eine kurze Zeile, die
 * trotzdem ans Abdecken erinnert.
 *
 * Der Server entscheidet, nie der Browser allein (`keinNameGilt`):
 * - Ohne Einheit gilt wie bisher nur das Häkchen der Anfrage.
 * - Mit Einheit zählt sie nur, wenn sie **läuft**, zu **diesem Schüler** gehört und die Lehrkraft sie führen darf
 *   (`canManageUnit`). Eine beendete Einheit zählt nicht: Ihre Bestätigung lässt nichts aus, und ein Häkchen wird dort auch
 *   nicht mehr gemerkt (Fotos nach dem Ende gehören nicht mehr zu ihr). Eine fremde oder erfundene Einheit ebenso.
 * - Ist die Einheit schon bestätigt, gilt die Anfrage als bestätigt, auch ohne Feld. Sonst braucht sie das Häkchen; mit
 *   Häkchen wird die Einheit ab jetzt als bestätigt gemerkt.
 * Je Einheit, nie geteilt: Bei zwei Schülern zugleich hat jede Einheit ihre eigene Bestätigung. Ohne KI ändert sich nichts,
 * das Häkchen gilt nur fürs Lesen. Nur für Lehrkräfte.
 */
import { db } from "./db";
import { canManageUnit, getUnit, type Unit, type UnitView } from "./units";

type Lehrkraft = { id: number; is_admin: number | boolean };

/** Die Einheit, für die eine Bestätigung gelten darf: läuft, gehört diesem Schüler und dieser Lehrkraft (oder der Administration). */
export function einheitFuerKeinName(unitId: number | null | undefined, studentId: number, teacher: Lehrkraft): UnitView | null {
  const unit = unitId && Number.isInteger(unitId) && unitId > 0 ? getUnit(unitId) : null;
  if (!unit || unit.status !== "gestartet" || unit.student_id !== studentId || !canManageUnit(teacher, unit)) return null;
  return unit;
}

/** Ob die Seite statt des Häkchens die Zeile zeigt: die Einheit läuft und ist schon bestätigt. */
export function keinNameBestaetigt(unit: Pick<Unit, "status" | "keine_namen_at"> | null | undefined): boolean {
  return Boolean(unit && unit.status === "gestartet" && unit.keine_namen_at);
}

/**
 * Gilt „kein Name“ für diese Lesung? `haken`: das Häkchen der Anfrage (`keine_namen` = 1). Mit Häkchen in einer gültigen,
 * noch nicht bestätigten Einheit wird die Bestätigung dort gemerkt.
 */
export function keinNameGilt(o: { unitId: number | null | undefined; studentId: number; teacher: Lehrkraft; haken: boolean; at?: number }): boolean {
  const unit = einheitFuerKeinName(o.unitId, o.studentId, o.teacher);
  if (!unit) return o.haken;
  if (unit.keine_namen_at) return true;
  if (o.haken) db().prepare("UPDATE units SET keine_namen_at = ? WHERE id = ? AND status = 'gestartet' AND keine_namen_at IS NULL").run(new Date(o.at ?? Date.now()).toISOString(), unit.id);
  return o.haken;
}
