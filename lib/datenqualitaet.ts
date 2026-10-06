/**
 * Datenqualität (Mehr › Datenqualität and the page of each skill): own corrections of the skill
 * structure, done by hand, with nothing guessed.
 *
 * The official data stays as it is. The tables skills, curricula and curriculum_nodes are never
 * written here; every correction lives in its own place and can be reset:
 *
 *   skill_overrides   Thema, Unterthema, Schulstufen, "in der Praxis oft früher/später", note and
 *                     merged_into. Only values that differ from the stored row are kept (a value equal
 *                     to the original becomes NULL); a row with nothing left is deleted. repo.SKILL_SELECT
 *                     lays them over the skill when it is read.
 *   skill_curriculum  Lehrplan links. Removing keeps the row (removed_at), so an import (INSERT OR IGNORE)
 *                     cannot bring it back; own links have origin 'lehrer'.
 *   skill_links       prerequisites, only through lehrplan.addPrerequisite (cycle check, origin 'lehrer').
 *   skill_history     the correction log: kind 'korrektur', `before` = JSON { action, previous, detail }
 *                     with the previous state, and the teacher.
 *
 * findDuplicates() only lists candidate pairs; merging is always the teacher's decision.
 */
import { db } from "./db";
import { addPrerequisite, prerequisitesOf } from "./lehrplan";
import { listSkills } from "./repo";
import { MAX_STUFE, SCHOOL_TYPES } from "./school";

export type Result<T extends object = object> = ({ ok: true } & T) | { error: string };

// ---------- practice shift ----------
export type PracticeShift = "" | "frueher" | "spaeter";
export const PRACTICE_SHIFTS: readonly PracticeShift[] = ["", "frueher", "spaeter"];
export const PRACTICE_SHIFT_LABEL: Record<PracticeShift, string> = { "": "wie im Lehrplan", frueher: "oft früher", spaeter: "oft später" };

// ---------- official row and own override ----------
/** A skill as stored (imported or built in), without own corrections. */
export type OfficialSkill = {
  id: string;
  subject: string;
  area: string;
  subtopic: string;
  name: string;
  grade_min: number;
  grade_max: number;
  parent_id: string | null;
  school_types: string;
  status: string;
  sort: number;
};
export function officialSkill(id: string): OfficialSkill | null {
  return (
    (db()
      .prepare("SELECT id, subject, area, subtopic, name, grade_min, grade_max, parent_id, school_types, COALESCE(status, 'aktiv') AS status, sort FROM skills WHERE id = ?")
      .get(id) as OfficialSkill | undefined) ?? null
  );
}

export type SkillOverride = {
  skill_id: string;
  area: string | null;
  subtopic: string | null;
  grade_min: number | null;
  grade_max: number | null;
  practice_shift: PracticeShift;
  merged_into: string | null;
  note: string;
  teacher_id: number | null;
  updated_at: string;
};
export function skillOverride(id: string): SkillOverride | null {
  return (db().prepare("SELECT * FROM skill_overrides WHERE skill_id = ?").get(id) as SkillOverride | undefined) ?? null;
}

type Fields = Pick<SkillOverride, "area" | "subtopic" | "grade_min" | "grade_max" | "practice_shift" | "merged_into" | "note">;
const FIELD_KEYS = ["area", "subtopic", "grade_min", "grade_max", "practice_shift", "merged_into", "note"] as const;
const EMPTY: Fields = { area: null, subtopic: null, grade_min: null, grade_max: null, practice_shift: "", merged_into: null, note: "" };
const fieldsOf = (o: SkillOverride | null): Fields => (o ? { area: o.area, subtopic: o.subtopic, grade_min: o.grade_min, grade_max: o.grade_max, practice_shift: o.practice_shift || "", merged_into: o.merged_into, note: o.note ?? "" } : { ...EMPTY });
const sameFields = (a: Fields, b: Fields) => FIELD_KEYS.every((k) => a[k] === b[k]);
const isEmpty = (f: Fields) => sameFields(f, EMPTY);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const nameOf = (id: string) => (db().prepare("SELECT name FROM skills WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? id;

/** Writes the override row, or deletes it when nothing is left. */
function store(skillId: string, f: Fields, teacherId: number | null) {
  if (isEmpty(f)) {
    db().prepare("DELETE FROM skill_overrides WHERE skill_id = ?").run(skillId);
    return;
  }
  db()
    .prepare(
      `INSERT INTO skill_overrides (skill_id, area, subtopic, grade_min, grade_max, practice_shift, merged_into, note, teacher_id, updated_at)
       VALUES (@skill_id, @area, @subtopic, @grade_min, @grade_max, @practice_shift, @merged_into, @note, @teacher_id, datetime('now'))
       ON CONFLICT(skill_id) DO UPDATE SET area = excluded.area, subtopic = excluded.subtopic, grade_min = excluded.grade_min, grade_max = excluded.grade_max,
         practice_shift = excluded.practice_shift, merged_into = excluded.merged_into, note = excluded.note, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at`,
    )
    .run({ skill_id: skillId, ...f, teacher_id: teacherId });
}

// ---------- correction log ----------
export type CorrectionAction = "einordnung" | "verschieben" | "zuruecksetzen" | "zusammenfuehren" | "trennen" | "lehrplan_entfernt" | "lehrplan_hinzugefuegt";
export const CORRECTION_LABEL: Record<CorrectionAction, string> = {
  einordnung: "Einordnung",
  verschieben: "Verschoben",
  zuruecksetzen: "Zurückgesetzt",
  zusammenfuehren: "Zusammengeführt",
  trennen: "Getrennt",
  lehrplan_entfernt: "Lehrplan entfernt",
  lehrplan_hinzugefuegt: "Lehrplan hinzugefügt",
};
function log(skillId: string, teacherId: number | null, action: CorrectionAction, previous: unknown, detail: string) {
  db()
    .prepare("INSERT INTO skill_history (skill_id, import_id, before, changed_at, kind, teacher_id) VALUES (?, NULL, ?, datetime('now'), 'korrektur', ?)")
    .run(skillId, JSON.stringify({ action, previous: previous ?? null, detail }), teacherId);
}

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
/** What changed between two override states, in words ("Thema: Brüche → Bruchrechnung · Schulstufe 5–8 → 6–8"). */
function describe(o: OfficialSkill, before: Fields, after: Fields): string {
  const eff = (f: Fields) => ({ area: f.area ?? o.area, subtopic: f.subtopic ?? o.subtopic ?? "", min: f.grade_min ?? o.grade_min, max: f.grade_max ?? o.grade_max, shift: f.practice_shift, note: f.note });
  const a = eff(before);
  const b = eff(after);
  const parts: string[] = [];
  if (a.area !== b.area) parts.push(`Thema: ${a.area} → ${b.area}`);
  if (a.subtopic !== b.subtopic) parts.push(`Unterthema: ${a.subtopic || "–"} → ${b.subtopic || "–"}`);
  if (a.min !== b.min || a.max !== b.max) parts.push(`Schulstufe ${range(a.min, a.max)} → ${range(b.min, b.max)}`);
  if (a.shift !== b.shift) parts.push(b.shift ? `in der Praxis ${PRACTICE_SHIFT_LABEL[b.shift]}` : "Praxis-Hinweis entfernt");
  if (a.note !== b.note) parts.push(b.note ? `Notiz: ${b.note}` : "Notiz entfernt");
  if (before.merged_into !== after.merged_into) {
    if (before.merged_into) parts.push(`Zusammenführung mit „${nameOf(before.merged_into)}“ aufgehoben`);
    if (after.merged_into) parts.push(`zusammengeführt mit „${nameOf(after.merged_into)}“`);
  }
  return parts.join(" · ");
}

export type Correction = { id: number; skill_id: string; skill_name: string; action: CorrectionAction; label: string; detail: string; teacher_name: string | null; changed_at: string };
/** The latest corrections, newest first (Mehr › Datenqualität › Letzte Korrekturen). */
export function corrections(limit = 20): Correction[] {
  const rows = db()
    .prepare(
      `SELECT h.id, h.skill_id, COALESCE(s.name, h.skill_id) AS skill_name, h.before, t.name AS teacher_name, h.changed_at
       FROM skill_history h LEFT JOIN skills s ON s.id = h.skill_id LEFT JOIN teachers t ON t.id = h.teacher_id
       WHERE h.kind = 'korrektur' ORDER BY h.id DESC LIMIT ?`,
    )
    .all(limit) as { id: number; skill_id: string; skill_name: string; before: string; teacher_name: string | null; changed_at: string }[];
  return rows.map(({ before, ...r }) => {
    let entry: { action?: CorrectionAction; detail?: string } = {};
    try {
      entry = JSON.parse(before) as typeof entry;
    } catch {
      // an unreadable entry still shows up, without details
    }
    const action = entry.action && entry.action in CORRECTION_LABEL ? entry.action : "einordnung";
    return { ...r, action, label: CORRECTION_LABEL[action], detail: entry.detail ?? "" };
  });
}

// ---------- Einordnung: Thema, Unterthema, Schulstufen, Praxis, Notiz ----------
export type OverridePatch = {
  /** Thema; null = back to the original. */
  area?: string | null;
  /** Unterthema; null = back to the original, "" = none. */
  subtopic?: string | null;
  grade_min?: number | null;
  grade_max?: number | null;
  practice_shift?: string;
  note?: string;
};

function applyPatch(o: OfficialSkill, cur: Fields, patch: OverridePatch): { next: Fields } | { error: string } {
  const next = { ...cur };
  if (patch.area !== undefined) {
    const v = patch.area === null ? null : clean(patch.area).slice(0, 80);
    if (v === "") return { error: "Thema fehlt." };
    next.area = v === null || v === o.area ? null : v;
  }
  if (patch.subtopic !== undefined) {
    const v = patch.subtopic === null ? null : clean(patch.subtopic).slice(0, 80);
    next.subtopic = v === null || v === (o.subtopic ?? "") ? null : v;
  }
  for (const k of ["grade_min", "grade_max"] as const) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v !== null && (!Number.isInteger(v) || v < 1 || v > MAX_STUFE)) return { error: `Die Schulstufe muss zwischen 1 und ${MAX_STUFE} liegen.` };
    next[k] = v === null || v === o[k] ? null : v;
  }
  if ((next.grade_min ?? o.grade_min) > (next.grade_max ?? o.grade_max)) return { error: "„Ab“ liegt nach „Bis“." };
  if (patch.practice_shift !== undefined) {
    if (!PRACTICE_SHIFTS.includes(patch.practice_shift as PracticeShift)) return { error: "Unbekannter Praxis-Hinweis." };
    next.practice_shift = patch.practice_shift as PracticeShift;
  }
  if (patch.note !== undefined) next.note = clean(patch.note).slice(0, 500);
  return { next };
}

/**
 * Own Einordnung of a skill: Thema, Unterthema, Schulstufen ("falscher Klasse zugeordnet"), "in der
 * Praxis oft früher/später" and a note. Fields left out stay as they are. Only what differs from the
 * stored row is kept; saving without a change writes nothing.
 */
export function setSkillOverride(skillId: string, patch: OverridePatch, teacherId: number | null): Result<{ changed: boolean }> {
  const o = officialSkill(skillId);
  if (!o) return { error: "Fähigkeit nicht gefunden." };
  const prev = skillOverride(skillId);
  const cur = fieldsOf(prev);
  const r = applyPatch(o, cur, patch);
  if ("error" in r) return r;
  if (sameFields(cur, r.next)) return { ok: true, changed: false };
  db().transaction(() => {
    store(skillId, r.next, teacherId);
    log(skillId, teacherId, "einordnung", prev, describe(o, cur, r.next));
  })();
  return { ok: true, changed: true };
}

/**
 * Back to the original data. keepMerge: only the Einordnung is reset (the page of a skill); otherwise
 * a merge is undone as well. Links copied by a merge stay: they are visible and removable.
 */
export function resetSkillOverride(skillId: string, teacherId: number | null, o: { keepMerge?: boolean } = {}): Result {
  const official = officialSkill(skillId);
  if (!official) return { error: "Fähigkeit nicht gefunden." };
  const prev = skillOverride(skillId);
  if (!prev) return { ok: true };
  const cur = fieldsOf(prev);
  const next: Fields = { ...EMPTY, merged_into: o.keepMerge ? cur.merged_into : null };
  if (sameFields(cur, next)) return { ok: true };
  db().transaction(() => {
    store(skillId, next, teacherId);
    log(skillId, teacherId, "zuruecksetzen", prev, describe(official, cur, next) || "eigene Korrektur entfernt");
  })();
  return { ok: true };
}

/**
 * "Fähigkeiten verschieben": several skills of one subject into another Thema (an override each).
 * Teilfähigkeiten that sit in the same Thema as their skill move along.
 */
export function moveSkills(skillIds: string[], area: string, teacherId: number | null): Result<{ moved: number }> {
  const target = clean(area);
  if (!target) return { error: "Ziel-Thema fehlt." };
  const ids = [...new Set(skillIds)];
  if (!ids.length) return { error: "Keine Fähigkeit gewählt." };
  const official = ids.map(officialSkill);
  if (official.some((s) => !s)) return { error: "Fähigkeit nicht gefunden." };
  const subjects = new Set(official.map((s) => s!.subject));
  if (subjects.size > 1) return { error: "Nur Fähigkeiten eines Fachs gemeinsam verschieben." };
  const [subject] = subjects;

  // Teilfähigkeiten in the same Thema as their skill go along
  const inSubject = listSkills().filter((s) => s.subject === subject);
  const areaOf = new Map(inSubject.map((s) => [s.id, s.area]));
  const all = new Set(ids);
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    for (const c of inSubject) {
      if (c.parent_id === id && !all.has(c.id) && c.area === areaOf.get(id)) {
        all.add(c.id);
        stack.push(c.id);
      }
    }
  }

  let moved = 0;
  db().transaction(() => {
    for (const id of all) {
      const o = officialSkill(id)!;
      const prev = skillOverride(id);
      const cur = fieldsOf(prev);
      const r = applyPatch(o, cur, { area: target });
      if ("error" in r || sameFields(cur, r.next)) continue;
      store(id, r.next, teacherId);
      log(id, teacherId, "verschieben", prev, describe(o, cur, r.next));
      moved++;
    }
  })();
  return { ok: true, moved };
}

/** Skills with own corrections (merged ones included), newest first, each change as a short chip text. */
export type OwnCorrection = { skill_id: string; name: string; subject: string; changes: string[]; merged_into: string | null; merged_name: string | null; teacher_name: string | null; updated_at: string };
export function ownCorrections(): OwnCorrection[] {
  const rows = db()
    .prepare(
      `SELECT o.*, (SELECT name FROM skills WHERE id = o.merged_into) AS merged_name, t.name AS teacher_name
       FROM skill_overrides o JOIN skills s ON s.id = o.skill_id LEFT JOIN teachers t ON t.id = o.teacher_id ORDER BY o.updated_at DESC, s.sort`,
    )
    .all() as (SkillOverride & { merged_name: string | null; teacher_name: string | null })[];
  return rows.map((r) => {
    const o = officialSkill(r.skill_id)!;
    const changes: string[] = [];
    if (r.area !== null) changes.push(`Thema: ${r.area}`);
    if (r.subtopic !== null) changes.push(`Unterthema: ${r.subtopic || "–"}`);
    if (r.grade_min !== null || r.grade_max !== null) changes.push(`Schulstufe ${range(r.grade_min ?? o.grade_min, r.grade_max ?? o.grade_max)}`);
    if (r.practice_shift) changes.push(PRACTICE_SHIFT_LABEL[r.practice_shift]);
    if (r.note) changes.push("Notiz");
    return { skill_id: r.skill_id, name: o.name, subject: o.subject, changes, merged_into: r.merged_into, merged_name: r.merged_name, teacher_name: r.teacher_name, updated_at: r.updated_at };
  });
}

// ---------- Dubletten ----------
/** Name for comparing: case, umlauts/ß, accents, punctuation and spaces do not count. */
export function normalizeName(x: string): string {
  return x
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type DuplicateSkill = { id: string; name: string; area: string; subtopic: string; grade_min: number; grade_max: number; parent_name: string | null; answers: number; tasks: number };
export type DuplicatePair = { subject: string; sameArea: boolean; a: DuplicateSkill; b: DuplicateSkill; /** suggestion which one stays: more answers, then more tasks, then the older one */ keep: string };

/**
 * Candidate pairs: the same name (normalizeName) in the same subject, by default also in the same
 * Thema; crossArea adds pairs from different Themen. Merged and archived skills are left out.
 * Nothing is merged here.
 */
export function findDuplicates(subject?: string | null, o: { crossArea?: boolean } = {}): DuplicatePair[] {
  const skills = listSkills().filter((s) => (s.status ?? "aktiv") === "aktiv" && (!subject || s.subject === subject));
  const count = (sql: string) => new Map((db().prepare(sql).all() as { id: string; n: number }[]).map((r) => [r.id, r.n]));
  const answers = count("SELECT skill_id AS id, COUNT(*) AS n FROM attempts WHERE final = 1 AND skill_id IS NOT NULL GROUP BY skill_id");
  const tasks = count("SELECT skill_id AS id, COUNT(DISTINCT task_id) AS n FROM task_skills GROUP BY skill_id");
  const names = new Map(skills.map((s) => [s.id, s.name]));
  const groups = new Map<string, typeof skills>();
  for (const s of skills) {
    const key = `${s.subject}|${normalizeName(s.name)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const view = (s: (typeof skills)[number]): DuplicateSkill => ({
    id: s.id, name: s.name, area: s.area, subtopic: s.subtopic ?? "", grade_min: s.grade_min, grade_max: s.grade_max,
    parent_name: s.parent_id ? (names.get(s.parent_id) ?? nameOf(s.parent_id)) : null,
    answers: answers.get(s.id) ?? 0, tasks: tasks.get(s.id) ?? 0,
  });
  const pairs: DuplicatePair[] = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const sameArea = normalizeName(list[i].area) === normalizeName(list[j].area);
        if (!sameArea && !o.crossArea) continue;
        const a = view(list[i]);
        const b = view(list[j]);
        const keep = b.answers > a.answers || (b.answers === a.answers && b.tasks > a.tasks) ? b.id : a.id;
        pairs.push({ subject: list[i].subject, sameArea, a, b, keep });
      }
    }
  }
  return pairs;
}

// ---------- Zusammenführen ----------
/**
 * Merges a duplicate into another skill of the same subject: the duplicate disappears from the lists,
 * its answers count for the target (repo.skillAliases). Safe rule, so no chains or circles can form:
 *   - not into itself, only within one subject
 *   - the duplicate is not merged yet, and the target is not merged itself
 *   - nothing is merged into the duplicate (undo those first or merge them straight into the target)
 *   - the duplicate has no Teilfähigkeiten left that are not merged
 * The active prerequisites of the duplicate (what it needs and what needs it) are copied to the target
 * through lehrplan.addPrerequisite (origin 'lehrer', cycle check); self links, circles, links to merged
 * skills and links that already exist or were removed by the teacher are skipped. Its active Lehrplan
 * links are copied with origin 'lehrer' (a link the teacher removed from the target stays removed).
 */
export function mergeSkills(fromId: string, intoId: string, teacherId: number | null): Result<{ prerequisites: number; curriculum: number; skipped: number }> {
  if (fromId === intoId) return { error: "Eine Fähigkeit kann nicht mit sich selbst zusammengeführt werden." };
  const from = officialSkill(fromId);
  const into = officialSkill(intoId);
  if (!from || !into) return { error: "Fähigkeit nicht gefunden." };
  if (from.subject !== into.subject) return { error: "Nur Fähigkeiten desselben Fachs können zusammengeführt werden." };
  const fromO = skillOverride(fromId);
  if (fromO?.merged_into) return { error: `„${from.name}“ ist schon mit „${nameOf(fromO.merged_into)}“ zusammengeführt. Erst rückgängig machen.` };
  const intoO = skillOverride(intoId);
  if (intoO?.merged_into) return { error: `„${into.name}“ ist selbst mit „${nameOf(intoO.merged_into)}“ zusammengeführt. Direkt dorthin zusammenführen.` };
  const mergedHere = (db().prepare("SELECT COUNT(*) AS n FROM skill_overrides WHERE merged_into = ?").get(fromId) as { n: number }).n;
  if (mergedHere) return { error: `In „${from.name}“ ${mergedHere === 1 ? "ist schon eine Dublette" : `sind schon ${mergedHere} Dubletten`} zusammengeführt. Diese zuerst rückgängig machen oder direkt in „${into.name}“ zusammenführen.` };
  const openChildren = (db().prepare("SELECT COUNT(*) AS n FROM skills s LEFT JOIN skill_overrides o ON o.skill_id = s.id WHERE s.parent_id = ? AND o.merged_into IS NULL").get(fromId) as { n: number }).n;
  if (openChildren) return { error: `„${from.name}“ hat Teilfähigkeiten. Diese zuerst zusammenführen.` };

  const merged = (id: string) => Boolean(skillOverride(id)?.merged_into);
  const linkExists = db().prepare("SELECT 1 FROM skill_links WHERE skill_id = ? AND other_id = ? AND kind = 'voraussetzung'");
  const nodeExists = db().prepare("SELECT 1 FROM skill_curriculum WHERE skill_id = ? AND node_id = ?");
  let prerequisites = 0;
  let curriculum = 0;
  let skipped = 0;
  db().transaction(() => {
    const cur = fieldsOf(fromO);
    const next = { ...cur, merged_into: intoId };
    store(fromId, next, teacherId);
    const copy = (skillId: string, before: string) => {
      if (skillId === before || merged(skillId) || merged(before) || linkExists.get(skillId, before)) return;
      if ("ok" in addPrerequisite(skillId, before, teacherId)) prerequisites++;
      else skipped++;
    };
    // what the duplicate needs, the target needs
    for (const p of prerequisitesOf(fromId)) copy(intoId, p);
    // what needed the duplicate, needs the target
    const needing = db().prepare("SELECT skill_id FROM skill_links WHERE other_id = ? AND kind = 'voraussetzung' AND removed_at IS NULL").all(fromId) as { skill_id: string }[];
    for (const r of needing) copy(r.skill_id, intoId);
    const nodes = db().prepare("SELECT node_id FROM skill_curriculum WHERE skill_id = ? AND removed_at IS NULL").all(fromId) as { node_id: number }[];
    const insert = db().prepare("INSERT INTO skill_curriculum (skill_id, node_id, origin, changed_by) VALUES (?, ?, 'lehrer', ?)");
    for (const { node_id } of nodes) {
      if (nodeExists.get(intoId, node_id)) continue;
      insert.run(intoId, node_id, teacherId);
      curriculum++;
    }
    const copied = [
      prerequisites ? `${prerequisites} ${prerequisites === 1 ? "Voraussetzung" : "Voraussetzungen"} übernommen` : "",
      curriculum ? `${curriculum} Lehrplan-${curriculum === 1 ? "Verknüpfung" : "Verknüpfungen"} übernommen` : "",
    ].filter(Boolean);
    log(fromId, teacherId, "zusammenfuehren", fromO, [describe(from, cur, next), ...copied].join(" · "));
  })();
  return { ok: true, prerequisites, curriculum, skipped };
}

/** Undoes a merge: the skill shows up again and its answers count for itself. Copied links stay. */
export function unmergeSkills(fromId: string, teacherId: number | null): Result {
  const from = officialSkill(fromId);
  const prev = skillOverride(fromId);
  if (!from || !prev?.merged_into) return { error: "Diese Fähigkeit ist nicht zusammengeführt." };
  const cur = fieldsOf(prev);
  const next = { ...cur, merged_into: null };
  db().transaction(() => {
    store(fromId, next, teacherId);
    log(fromId, teacherId, "trennen", prev, describe(from, cur, next));
  })();
  return { ok: true };
}

/** Skills that were merged into this one. */
export function mergedInto(skillId: string): { id: string; name: string }[] {
  return db().prepare("SELECT s.id, s.name FROM skill_overrides o JOIN skills s ON s.id = o.skill_id WHERE o.merged_into = ? ORDER BY s.sort, s.name").all(skillId) as { id: string; name: string }[];
}

// ---------- Lehrplan links ----------
const SHORT = new Map(SCHOOL_TYPES.map((t) => [t.name, t.short]));
/** Container entries of a curriculum (subject, class, semester) are not linked to skills. */
const CONTAINER_KINDS = ["fach", "klasse", "semester"];

export type CurriculumLink = {
  node_id: number;
  code: string;
  name: string;
  text: string;
  kind: string;
  klasse: number | null;
  klasse_name: string | null;
  curriculum_key: string;
  curriculum_name: string;
  school_type: string;
  /** VS, MS, AHS, HTL, HAK */
  short: string;
  origin: "import" | "lehrer";
  removed_at: string | null;
  changed_by: number | null;
};
const LINK_SELECT = `SELECT sc.node_id, n.code, n.name, n.text, n.kind, n.klasse,
    (SELECT k.name FROM curriculum_nodes k WHERE k.curriculum_id = n.curriculum_id AND k.kind = 'klasse' AND k.klasse = n.klasse ORDER BY k.sort LIMIT 1) AS klasse_name,
    c.key AS curriculum_key, c.name AS curriculum_name, c.school_type, sc.origin, sc.removed_at, sc.changed_by
  FROM skill_curriculum sc JOIN curriculum_nodes n ON n.id = sc.node_id JOIN curricula c ON c.id = n.curriculum_id`;
const withShort = (r: Omit<CurriculumLink, "short">): CurriculumLink => ({ ...r, short: SHORT.get(r.school_type) ?? r.school_type });

const typeOrder = (t: string) => {
  const i = SCHOOL_TYPES.findIndex((x) => x.name === t);
  return i < 0 ? SCHOOL_TYPES.length : i;
};
/** Every Lehrplan link of a skill, active ones first, removed ones included (they can be restored); VS, MS, AHS, HTL, HAK. */
export function curriculumLinks(skillId: string): CurriculumLink[] {
  return (db().prepare(`${LINK_SELECT} WHERE sc.skill_id = ? ORDER BY sc.removed_at IS NOT NULL, c.key, n.sort, n.id`).all(skillId) as Omit<CurriculumLink, "short">[])
    .map(withShort)
    .sort((a, b) => Number(Boolean(a.removed_at)) - Number(Boolean(b.removed_at)) || typeOrder(a.school_type) - typeOrder(b.school_type));
}
function linkRow(skillId: string, nodeId: number): CurriculumLink | null {
  const r = db().prepare(`${LINK_SELECT} WHERE sc.skill_id = ? AND sc.node_id = ?`).get(skillId, nodeId) as Omit<CurriculumLink, "short"> | undefined;
  return r ? withShort(r) : null;
}
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const linkLabel = (l: Pick<CurriculumLink, "short" | "klasse_name" | "code" | "name">) => `${l.short}${l.klasse_name ? ` ${l.klasse_name}` : ""} · ${l.code} ${short(l.name)}`;

/** Removing keeps the row (removed_at), so neither a restart nor a new import brings the link back. */
export function removeCurriculumLink(skillId: string, nodeId: number, teacherId: number | null): Result {
  const row = linkRow(skillId, nodeId);
  if (!row) return { error: "Verknüpfung nicht gefunden." };
  if (row.removed_at) return { ok: true };
  db().transaction(() => {
    db().prepare("UPDATE skill_curriculum SET removed_at = datetime('now'), changed_by = ? WHERE skill_id = ? AND node_id = ?").run(teacherId, skillId, nodeId);
    log(skillId, teacherId, "lehrplan_entfernt", row, linkLabel(row));
  })();
  return { ok: true };
}

/** Adds a Lehrplan link (origin 'lehrer'), or takes a removed one back (it keeps its origin). Same subject only. */
export function addCurriculumLink(skillId: string, nodeId: number, teacherId: number | null): Result {
  const skill = officialSkill(skillId);
  if (!skill) return { error: "Fähigkeit nicht gefunden." };
  const node = db()
    .prepare("SELECT n.id, n.kind, c.subject FROM curriculum_nodes n JOIN curricula c ON c.id = n.curriculum_id WHERE n.id = ?")
    .get(nodeId) as { id: number; kind: string; subject: string } | undefined;
  if (!node) return { error: "Lehrplan-Eintrag nicht gefunden." };
  if (node.subject !== skill.subject) return { error: "Der Lehrplan-Eintrag gehört zu einem anderen Fach." };
  const prev = linkRow(skillId, nodeId);
  if (prev && !prev.removed_at) return { ok: true };
  if (!prev && CONTAINER_KINDS.includes(node.kind)) return { error: "Bitte einen Eintrag des Lehrplans wählen, nicht Fach, Klasse oder Semester." };
  db().transaction(() => {
    if (prev) db().prepare("UPDATE skill_curriculum SET removed_at = NULL, changed_by = ? WHERE skill_id = ? AND node_id = ?").run(teacherId, skillId, nodeId);
    else db().prepare("INSERT INTO skill_curriculum (skill_id, node_id, origin, changed_by) VALUES (?, ?, 'lehrer', ?)").run(skillId, nodeId, teacherId);
    const row = linkRow(skillId, nodeId)!;
    log(skillId, teacherId, "lehrplan_hinzugefuegt", prev, `${prev ? "wieder aufgenommen: " : ""}${linkLabel(row)}`);
  })();
  return { ok: true };
}

export type LinkableCurriculum = { id: number; key: string; name: string; school_type: string; short: string; classes: { klasse: number; name: string; schulstufe: number | null }[] };
/** Curricula a skill can be linked to: same subject, and only its school types when it is limited to some. */
export function linkableCurricula(skillId: string): LinkableCurriculum[] {
  const skill = officialSkill(skillId);
  if (!skill) return [];
  const types = skill.school_types ? skill.school_types.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const rows = db().prepare("SELECT id, key, name, school_type FROM curricula WHERE subject = ? AND status = 'aktiv' ORDER BY id").all(skill.subject) as Omit<LinkableCurriculum, "short" | "classes">[];
  return rows
    .filter((c) => !types.length || types.includes(c.school_type))
    .sort((a, b) => typeOrder(a.school_type) - typeOrder(b.school_type))
    .map((c) => ({
      ...c,
      short: SHORT.get(c.school_type) ?? c.school_type,
      classes: db()
        .prepare("SELECT klasse, MIN(name) AS name, MIN(schulstufe) AS schulstufe FROM curriculum_nodes WHERE curriculum_id = ? AND kind = 'klasse' AND klasse IS NOT NULL GROUP BY klasse ORDER BY klasse")
        .all(c.id) as LinkableCurriculum["classes"],
    }));
}

export type CandidateNode = { id: number; code: string; name: string; text: string; kind: string; klasse: number | null };
/** Entries of a curriculum (optionally one class) that the skill is not linked to yet, in source order. */
export function candidateNodes(skillId: string, curriculumId: number, klasse?: number | null): CandidateNode[] {
  const skill = officialSkill(skillId);
  if (!skill || !linkableCurricula(skillId).some((c) => c.id === curriculumId)) return [];
  return db()
    .prepare(
      `SELECT n.id, n.code, n.name, n.text, n.kind, n.klasse FROM curriculum_nodes n
       WHERE n.curriculum_id = ? AND n.kind NOT IN (${CONTAINER_KINDS.map(() => "?").join(", ")}) AND (? IS NULL OR n.klasse = ?)
         AND NOT EXISTS (SELECT 1 FROM skill_curriculum sc WHERE sc.skill_id = ? AND sc.node_id = n.id)
       ORDER BY n.sort, n.id`,
    )
    .all(curriculumId, ...CONTAINER_KINDS, klasse ?? null, klasse ?? null, skillId) as CandidateNode[];
}
