/**
 * **Unterlagen bei „Das zeigst du“** (niko, 27.10.2026: ein Foto oder PDF, das die Lehrkraft mitgebracht hat und das ein Thema
 * erklärt, gehört in den Schritt, der dieses Thema erklärt). Keine neue KI-Anfrage und kein eigenes System: die Dateien der
 * Vorgabe (lib/vorgabe.ts), ihre Rolle (an der Datei, `materials.rolle`) und die gespeicherte Lesung (`stoff_lesungen`,
 * lib/pruefungsstoff.ts) reichen.
 *
 * Eine Unterlage passt zu einem Schritt (`passtZumSchritt`), wenn
 * - ihre Rolle „erklärt ein Thema“ ist (gewählte Rolle vor gelesener vor der Regel ohne KI; ein Inhaltsverzeichnis, ein Blatt mit
 *   Aufgaben oder ein Stoffzettel nie), und
 * - die Lehrkraft sie diesem Schritt zugeordnet hat („Passt zu welchem Schritt?“ unter der Vorgabe), oder
 * - der Schritt etwas erklärt (Erklären, Grundlage, im Paket Erklärung und Beispiel; ein Thema ohne Fähigkeit hat nur „Üben“) und
 *   ein Punkt der Lesung dieser Datei sicher zur Fähigkeit des Schritts gehört (`ordneZu`, ohne Anfrage); hat der Schritt keine
 *   Fähigkeit, ein Punkt mit genau seinem Thema.
 * Dazu frühere Unterlagen desselben Schülers mit derselben Rolle, deren gespeicherte Lesung sie mit der Fähigkeit verknüpft.
 * Höchstens drei je Schritt, die von heute zuerst, dann die neueste. Geraten wird nie: eine Erklärung ohne passenden Schritt
 * steht nur unter der Vorgabe zum Zuordnen.
 *
 * Nur auf Lehrerseiten. „Öffnen“ führt zur Ansicht des Materials (Erweitert › Material) und wird vermerkt
 * (`einheit_unterlagen.gezeigt_at`); nur was wirklich geöffnet wurde, steht im Abschluss als „Unterlage gezeigt: …“.
 */
import { cockpit, paketQuelle, type CockpitDaten } from "./cockpit";
import { db } from "./db";
import { ZEIG_ARTEN_PAKET } from "./praesentation-unterricht";
import { getLesung, istRolle, ordneZu, type RohPunkt, type Rolle } from "./pruefungsstoff";
import { getMaterial, hatDatei, listMaterials } from "./materials";
import * as repo from "./repo";
import { getUnit } from "./units";
import { dateienDerVorgabe, vorgabeDerEinheit } from "./vorgabe";

/** Höchstens so viele Unterlagen je Schritt. */
export const MAX_UNTERLAGEN = 3;
/** So viele frühere Unterlagen des Schülers werden angesehen (die neuesten, wie bei „Vorhandenes Material“). */
const FRUEHER_MAX = 24;

/** Eine Unterlage, wie der Schritt sie zeigt. */
export type Unterlage = { materialId: number; titel: string; art: "Foto" | "PDF"; datum: string; heute: boolean };
/** Eine Unterlage mit allem, was zum Zuordnen nötig ist. `schrittId`: von der Lehrkraft gewählt (nur heutige). */
export type UnterlageKandidat = Unterlage & { rolle: Rolle | null; skillIds: string[]; themen: string[]; schrittId: number | null };
/** Ein Schritt der Einheit, wie das Zuordnen ihn braucht. `zeigt`: ein Schritt, der etwas erklärt. */
export type SchrittZiel = { id: number; skillId: string | null; thema: string | null; zeigt: boolean };

const klein = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Passt diese Unterlage zu diesem Schritt? Siehe oben; ohne Datenbank. */
export function passtZumSchritt(k: Pick<UnterlageKandidat, "rolle" | "skillIds" | "themen" | "schrittId">, s: SchrittZiel): boolean {
  if (k.rolle !== "erklaerung") return false;
  if (k.schrittId !== null) return k.schrittId === s.id;
  if (!s.zeigt) return false;
  if (s.skillId) return k.skillIds.includes(s.skillId);
  const t = klein(s.thema);
  return t.length > 0 && k.themen.some((x) => klein(x) === t);
}

/** Die Unterlagen eines Schritts: die passenden, die von heute zuerst, dann die neueste; höchstens `max`. */
export function unterlagenFuer<K extends UnterlageKandidat>(kandidaten: K[], s: SchrittZiel, max = MAX_UNTERLAGEN): K[] {
  return kandidaten
    .filter((k) => passtZumSchritt(k, s))
    .sort((a, b) => Number(b.heute) - Number(a.heute) || b.datum.localeCompare(a.datum) || b.materialId - a.materialId)
    .slice(0, max);
}

/** Der Schritt `id` der Einheit (Lernpaket, Paketschritt im Plan oder Planschritt) als SchrittZiel; null, wenn es ihn nicht gibt. */
export function schrittZiel(c: CockpitDaten, id: number): SchrittZiel | null {
  if (c.paket) {
    const s = c.schritte.find((x) => x.id === id);
    if (!s) return null;
    return { id, skillId: s.aufgaben.find((a) => a.skillId)?.skillId ?? c.paket.skill_ids[0] ?? null, thema: c.paket.thema || null, zeigt: ZEIG_ARTEN_PAKET.includes(s.art) };
  }
  const s = c.plan.find((x) => x.id === id);
  if (!s) return null;
  const q = paketQuelle(s) ? c.planQuellen.get(s.id) : null;
  if (q) return { id, skillId: s.skillId ?? q.schritt.aufgaben.find((a) => a.skillId)?.skillId ?? q.paket.skill_ids[0] ?? null, thema: s.thema ?? null, zeigt: ZEIG_ARTEN_PAKET.includes(q.schritt.art) };
  // Erklären and Grundlage explain; a topic without a skill has only „Üben“; an older plan (no art) at its skill
  const zeigt = s.art === "erklaeren" || s.art === "grundlage" || (s.art === "ueben" && !s.skillId) || (!s.art && Boolean(s.skillId));
  return { id, skillId: s.skillId, thema: s.thema ?? null, zeigt };
}

/** Die Schritte der Einheit, so wie die Punkte sie zählen. */
const schrittIds = (c: CockpitDaten) => (c.paket ? c.schritte.map((s) => s.id) : c.plan.map((s) => s.id));

/** Was die Lesung über eine ihrer Dateien sagt: die sicher zugeordneten Fähigkeiten und die Lerninhalte. Ohne Anfrage. */
function ausLesung(punkte: RohPunkt[], nr: number, fach: string, student: repo.Student): { skillIds: string[]; themen: string[] } {
  const eigene = punkte.filter((p) => p.dokument === nr && p.status !== "ausgeschlossen" && p.gruppe !== "umfang");
  if (!eigene.length) return { skillIds: [], themen: [] };
  const zu = ordneZu(eigene, { fach, student, ki: true });
  return {
    skillIds: [...new Set(zu.filter((p) => p.skill_id && (p.zuordnung === "sicher" || p.zuordnung === "bestaetigt")).map((p) => p.skill_id!))],
    themen: [...new Set(eigene.flatMap((p) => [p.inhalt, p.original]).filter(Boolean))],
  };
}

/** Die neueste gespeicherte Lesung dieses Schülers, in der die Datei vorkommt, mit ihrer Nummer darin; null ohne. */
function lesungDerDatei(materialId: number, studentId: number) {
  const id = db()
    .prepare("SELECT l.id FROM stoff_lesungen l WHERE l.student_id = ? AND EXISTS (SELECT 1 FROM json_each(l.dateien) j WHERE json_extract(j.value, '$.material_id') = ?) ORDER BY l.id DESC LIMIT 1")
    .pluck()
    .get(studentId, materialId) as number | undefined;
  const l = getLesung(id);
  const nr = (l?.dateien.findIndex((d) => d.material_id === materialId) ?? -1) + 1;
  return l && nr > 0 ? { l, nr } : null;
}

type Gewaehlt = { material_id: number; schritt_id: number | null };

/**
 * Alle Unterlagen, die in dieser Einheit gezeigt werden können: die Dateien der Vorgabe (mit Rolle, Lesung und der Wahl der
 * Lehrkraft) und frühere Dateien desselben Schülers, die „erklärt ein Thema“ sind. Nie eine Datei eines anderen Schülers.
 */
export function kandidatenDerEinheit(unitId: number, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): UnterlageKandidat[] {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !student) return [];
  const ids = new Set(schrittIds(c));
  const gewaehlt = new Map(
    (db().prepare("SELECT material_id, schritt_id FROM einheit_unterlagen WHERE unit_id = ?").all(unitId) as Gewaehlt[]).map((r) => [r.material_id, r.schritt_id !== null && ids.has(r.schritt_id) ? r.schritt_id : null]),
  );
  const out: UnterlageKandidat[] = [];
  const v = vorgabeDerEinheit(unitId);
  const l = v ? getLesung(v.lesungId) : null;
  for (const d of v ? dateienDerVorgabe(v) : []) {
    const m = getMaterial(d.materialId);
    if (!m || !hatDatei(m) || m.student_id !== student.id) continue;
    // the reading of today's Vorgabe, else the newest earlier one with this file (read before, today not again)
    const nrHeute = (l?.dateien.findIndex((x) => x.material_id === m.id) ?? -1) + 1;
    const x = l && nrHeute > 0 ? { l, nr: nrHeute } : d.gelesen ? null : lesungDerDatei(m.id, student.id);
    const gelesen = x ? ausLesung(x.l.lesung.punkte, x.nr, unit.subject, student) : { skillIds: [], themen: [] };
    const titel = (x ? x.l.lesung.dokumente.find((y) => y.nr === x.nr)?.titel : "") || m.title;
    out.push({ materialId: m.id, titel, art: d.art, datum: m.created_at.slice(0, 10), heute: true, rolle: d.rolle, ...gelesen, schrittId: gewaehlt.get(m.id) ?? null });
  }
  // earlier explanations of this student: only through a saved reading that links them to a skill
  const heute = new Set(out.map((k) => k.materialId));
  for (const m of listMaterials({ studentId: student.id }).filter(hatDatei).slice(0, FRUEHER_MAX)) {
    if (heute.has(m.id) || m.student_id !== student.id || (istRolle(m.rolle) ? m.rolle : null) !== "erklaerung") continue;
    const x = lesungDerDatei(m.id, student.id);
    if (!x) continue;
    const { skillIds } = ausLesung(x.l.lesung.punkte, x.nr, unit.subject, student);
    if (!skillIds.length) continue;
    const titel = x.l.lesung.dokumente.find((d) => d.nr === x.nr)?.titel || m.title;
    out.push({ materialId: m.id, titel, art: m.mime === "application/pdf" ? "PDF" : "Foto", datum: m.created_at.slice(0, 10), heute: false, rolle: "erklaerung", skillIds, themen: [], schrittId: null });
  }
  return out;
}

/** Die Unterlagen für den Schritt `schrittId` der Einheit (höchstens drei). */
export function unterlagenImSchritt(unitId: number, schrittId: number, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): Unterlage[] {
  const ziel = schrittZiel(c, schrittId);
  if (!ziel) return [];
  return unterlagenFuer(kandidatenDerEinheit(unitId, c), ziel).map(({ materialId, titel, art, datum, heute }) => ({ materialId, titel, art, datum, heute }));
}

/**
 * Die Erklärungen der Vorgabe, die zu keinem Schritt von selbst passen (oder die die Lehrkraft schon zugeordnet hat): für die Zeile
 * „Passt zu welchem Schritt?“. Mit der gewählten Schritt-Id oder null.
 */
export function zumZuordnen(unitId: number, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): { materialId: number; schrittId: number | null }[] {
  const ziele = schrittIds(c).flatMap((id) => schrittZiel(c, id) ?? []);
  return kandidatenDerEinheit(unitId, c)
    .filter((k) => k.heute && k.rolle === "erklaerung")
    .filter((k) => k.schrittId !== null || !ziele.some((z) => passtZumSchritt(k, z)))
    .map((k) => ({ materialId: k.materialId, schrittId: k.schrittId }));
}

/**
 * „Passt zu welchem Schritt?“: die Lehrkraft ordnet eine Erklärung der Vorgabe einem Schritt zu (null: keinem). Nur eine Datei der
 * Vorgabe dieser Einheit mit der Rolle „erklärt ein Thema“ und nur ein Schritt dieser Einheit.
 */
export function waehleSchritt(unitId: number, materialId: number, schrittId: number | null, teacherId: number | null, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): boolean {
  const k = kandidatenDerEinheit(unitId, c).find((x) => x.materialId === materialId && x.heute);
  if (!k || k.rolle !== "erklaerung") return false;
  if (schrittId !== null && !schrittIds(c).includes(schrittId)) return false;
  db()
    .prepare(
      `INSERT INTO einheit_unterlagen (unit_id, material_id, schritt_id, teacher_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(unit_id, material_id) DO UPDATE SET schritt_id = excluded.schritt_id, teacher_id = excluded.teacher_id`,
    )
    .run(unitId, materialId, schrittId, teacherId);
  return true;
}

/**
 * „Öffnen“ bei einer Unterlage im Schritt: vermerkt, dass sie gezeigt wurde (mit dem Titel, wie er dastand). Nur eine Unterlage, die
 * dieser Schritt gerade zeigt; sonst false.
 */
export function merkeGezeigt(unitId: number, schrittId: number, materialId: number, teacherId: number | null, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): boolean {
  const u = unterlagenImSchritt(unitId, schrittId, c).find((x) => x.materialId === materialId);
  if (!u) return false;
  db()
    .prepare(
      `INSERT INTO einheit_unterlagen (unit_id, material_id, gezeigt_schritt, gezeigt_at, titel, teacher_id) VALUES (?, ?, ?, datetime('now'), ?, ?)
       ON CONFLICT(unit_id, material_id) DO UPDATE SET gezeigt_schritt = excluded.gezeigt_schritt, gezeigt_at = COALESCE(einheit_unterlagen.gezeigt_at, excluded.gezeigt_at),
         titel = excluded.titel, teacher_id = excluded.teacher_id`,
    )
    .run(unitId, materialId, schrittId, u.titel, teacherId);
  return true;
}

/** Die Unterlagen, die in einer Einheit wirklich geöffnet wurden, in der Reihenfolge des ersten Öffnens (für den Abschluss). */
export function unterlagenDerEinheit(unitId: number): { materialId: number; titel: string }[] {
  return db().prepare("SELECT material_id AS materialId, titel FROM einheit_unterlagen WHERE unit_id = ? AND gezeigt_at IS NOT NULL ORDER BY gezeigt_at, rowid").all(unitId) as { materialId: number; titel: string }[];
}
