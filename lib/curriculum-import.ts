/**
 * Curriculum importer: a package (JSON, format "lernheft-curriculum/1") is validated, compared with
 * the database and stored as a preview. Only after the teacher confirms the preview is it applied,
 * in one transaction. Nothing is deleted; a changed skill keeps its earlier state in skill_history.
 * Skills that belong to another source are never overwritten (listed as conflict instead).
 * No scraping: packages are files in curriculum/ or pasted by an admin. Format: docs/curriculum.md.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, json } from "./db";
import { getSource, saveSource, taskBankAllowed, licenseTerms, type SourceInput, type SourceType, SOURCE_TYPE_LABEL } from "./lehrplan";
import { SCHOOL_TYPES } from "./school";
import { skillCode } from "./skill-code";

export const FORMAT = "lernheft-curriculum/1";

export type PackageSkill = {
  id: string;
  subject: string;
  area: string;
  name: string;
  subtopic?: string;
  parent?: string;
  grade_min: number;
  grade_max: number;
  school_types?: string[];
  learning_objective?: string;
  description?: string;
  competency_area?: string;
  content_area?: string;
  action_area?: string;
  version?: string;
  /** codes of curriculum nodes this skill practises */
  nodes?: string[];
  prerequisites?: string[];
  next?: string[];
};
export type PackageNode = {
  code: string;
  parent?: string;
  kind: string;
  name: string;
  text?: string;
  klasse?: number;
  schulstufe?: number;
  competency_area?: string;
  content_area?: string;
  action_area?: string;
  reference?: string;
};
export type CurriculumPackage = {
  format: string;
  label: string;
  description?: string;
  source: SourceInput;
  curriculum?: { key: string; name: string; school_type: string; subject: string; version: string; reference?: string; valid_from?: string; valid_to?: string };
  nodes?: PackageNode[];
  skills?: PackageSkill[];
  /** links of skills that already exist to nodes of this package: [skillId, nodeCode] */
  skill_nodes?: [string, string][];
};

export type Diff = {
  newTopics: string[];
  newSkills: string[];
  changedSkills: { id: string; fields: string[] }[];
  unchanged: number;
  duplicates: { id: string; existing: string }[];
  conflicts: { id: string; reason: string }[];
  newNodes: number;
  changedNodes: number;
  newLinks: number;
  errors: string[];
  warnings: string[];
  alreadyImported: boolean;
};

const SKILL_FIELDS = ["subject", "area", "subtopic", "name", "parent_id", "grade_min", "grade_max", "school_types", "learning_objective", "description", "competency_area", "content_area", "action_area", "version"] as const;
type SkillRow = Record<(typeof SKILL_FIELDS)[number], string | number | null> & { id: string; source_id: number | null };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const skillRow = (s: PackageSkill) => ({
  subject: s.subject.trim(),
  area: s.area.trim(),
  subtopic: (s.subtopic ?? "").trim(),
  name: s.name.trim(),
  parent_id: s.parent ?? null,
  grade_min: s.grade_min,
  grade_max: s.grade_max,
  school_types: (s.school_types ?? []).join(","),
  learning_objective: (s.learning_objective ?? "").trim(),
  description: (s.description ?? "").trim(),
  competency_area: (s.competency_area ?? "").trim(),
  content_area: (s.content_area ?? "").trim(),
  action_area: (s.action_area ?? "").trim(),
  version: (s.version ?? "").trim(),
});

export function contentHash(pkg: CurriculumPackage): string {
  return crypto.createHash("sha256").update(JSON.stringify(pkg)).digest("hex");
}

/** Checks the package itself (structure, ids, ranges, references), independent of the database. */
export function validate(pkg: CurriculumPackage): string[] {
  const errors: string[] = [];
  if (!pkg || typeof pkg !== "object") return ["Kein gültiges JSON-Objekt"];
  if (pkg.format !== FORMAT) errors.push(`Format muss „${FORMAT}“ sein`);
  if (!pkg.label?.trim()) errors.push("label fehlt");
  const src = pkg.source;
  if (!src?.key || !/^[a-z0-9][a-z0-9-]*$/.test(src.key)) errors.push("source.key fehlt oder enthält ungültige Zeichen (a–z, 0–9, -)");
  if (!src?.name?.trim()) errors.push("source.name fehlt");
  if (!src || !(src.source_type in SOURCE_TYPE_LABEL)) errors.push(`source.source_type muss eines von ${Object.keys(SOURCE_TYPE_LABEL).join(", ")} sein`);
  if (src?.source_type === "referenz") errors.push("Referenzquellen (z. B. IQS, Matura, Schulbücher) werden nicht importiert – nur verlinkt");
  if (src?.source_type === "lehrplan" && !src.url) errors.push("Ein offizieller Lehrplan braucht source.url (RIS)");
  const types = SCHOOL_TYPES.map((t) => t.name);
  if (pkg.curriculum) {
    const c = pkg.curriculum;
    if (!c.key || !c.name || !c.subject || !c.version) errors.push("curriculum braucht key, name, subject und version");
    if (!types.includes(c.school_type)) errors.push(`curriculum.school_type „${c.school_type}“ unbekannt`);
  }
  const codes = new Set<string>();
  for (const n of pkg.nodes ?? []) {
    if (!pkg.curriculum) { errors.push("nodes ohne curriculum"); break; }
    if (!n.code || !n.name || !n.kind) errors.push(`Lehrplan-Eintrag ohne code, kind oder name (${n.code ?? "?"})`);
    if (codes.has(n.code)) errors.push(`Lehrplan-Code doppelt: ${n.code}`);
    codes.add(n.code);
  }
  for (const n of pkg.nodes ?? []) if (n.parent && !codes.has(n.parent)) errors.push(`Lehrplan-Eintrag ${n.code}: übergeordneter Eintrag ${n.parent} fehlt`);
  const ids = new Set<string>();
  for (const s of pkg.skills ?? []) {
    const at = `Fähigkeit ${s.id ?? "?"}`;
    if (!s.id || !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(s.id)) errors.push(`${at}: id muss wie „mathe.thema.faehigkeit“ aufgebaut sein`);
    if (ids.has(s.id)) errors.push(`${at}: id doppelt im Paket`);
    ids.add(s.id);
    if (!s.subject?.trim() || !s.area?.trim() || !s.name?.trim()) errors.push(`${at}: subject, area und name sind Pflicht`);
    if (!Number.isInteger(s.grade_min) || !Number.isInteger(s.grade_max) || s.grade_min < 1 || s.grade_max > 13 || s.grade_min > s.grade_max) errors.push(`${at}: Schulstufen müssen 1–13 sein (von ≤ bis)`);
    for (const t of s.school_types ?? []) if (!types.includes(t)) errors.push(`${at}: Schulart „${t}“ unbekannt`);
    for (const code of s.nodes ?? []) if (!codes.has(code)) errors.push(`${at}: Lehrplan-Eintrag ${code} fehlt im Paket`);
  }
  for (const [, code] of pkg.skill_nodes ?? []) if (!codes.has(code)) errors.push(`Verknüpfung: Lehrplan-Eintrag ${code} fehlt im Paket`);
  return errors;
}

/** Compares a valid package with the database. */
export function diffPackage(pkg: CurriculumPackage): Diff {
  const conn = db();
  const d: Diff = { newTopics: [], newSkills: [], changedSkills: [], unchanged: 0, duplicates: [], conflicts: [], newNodes: 0, changedNodes: 0, newLinks: 0, errors: validate(pkg), warnings: [], alreadyImported: false };
  if (d.errors.length) return d;
  d.alreadyImported = Boolean(conn.prepare("SELECT 1 FROM curriculum_imports WHERE content_hash = ? AND status = 'importiert'").get(contentHash(pkg)));

  const existingSource = getSource(pkg.source.key);
  const terms = licenseTerms(pkg.source.license ?? "");
  if (pkg.source.source_type === "oer" && terms.commercial !== 1) d.warnings.push(`Lizenz „${pkg.source.license || "fehlt"}“: Inhalte dieser Quelle kommen nicht in die Aufgabenbank`);
  if (existingSource && existingSource.source_type !== pkg.source.source_type) d.errors.push(`Quelle ${pkg.source.key} existiert schon als „${SOURCE_TYPE_LABEL[existingSource.source_type]}“`);

  const skills = conn.prepare("SELECT * FROM skills").all() as SkillRow[];
  const byId = new Map(skills.map((s) => [s.id, s]));
  const pkgIds = new Set((pkg.skills ?? []).map((s) => s.id));
  const topics = new Set(skills.map((s) => `${s.subject}|${norm(String(s.area))}`));
  const nameKey = (subject: string, area: string, name: string, parent: string | null) => `${subject}|${norm(area)}|${norm(name)}|${parent ?? ""}`;
  const byName = new Map(skills.map((s) => [nameKey(String(s.subject), String(s.area), String(s.name), s.parent_id as string | null), s.id]));

  for (const s of pkg.skills ?? []) {
    const row = skillRow(s);
    if (s.parent && !pkgIds.has(s.parent) && !byId.has(s.parent)) { d.errors.push(`Fähigkeit ${s.id}: Teilfähigkeit von ${s.parent}, das es nicht gibt`); continue; }
    for (const p of [...(s.prerequisites ?? []), ...(s.next ?? [])]) if (!pkgIds.has(p) && !byId.has(p)) d.errors.push(`Fähigkeit ${s.id}: verweist auf ${p}, das es nicht gibt`);
    const existing = byId.get(s.id);
    if (!existing) {
      const dup = byName.get(nameKey(row.subject, row.area, row.name, row.parent_id));
      if (dup) { d.duplicates.push({ id: s.id, existing: dup }); continue; }
      d.newSkills.push(s.id);
      const t = `${row.subject}|${norm(row.area)}`;
      if (!topics.has(t)) { topics.add(t); d.newTopics.push(`${row.subject} › ${row.area}`); }
      continue;
    }
    if (existingSource && existing.source_id !== existingSource.id) { d.conflicts.push({ id: s.id, reason: "gehört zu einer anderen Quelle – wird nicht überschrieben" }); continue; }
    if (!existingSource) { d.conflicts.push({ id: s.id, reason: "existiert schon aus einer anderen Quelle – wird nicht überschrieben" }); continue; }
    const fields = SKILL_FIELDS.filter((f) => String(existing[f] ?? "") !== String(row[f] ?? ""));
    if (fields.length) d.changedSkills.push({ id: s.id, fields });
    else d.unchanged++;
  }

  if (pkg.curriculum) {
    const cur = conn.prepare("SELECT id FROM curricula WHERE key = ?").get(pkg.curriculum.key) as { id: number } | undefined;
    const nodes = cur ? (conn.prepare("SELECT code, name, text, kind FROM curriculum_nodes WHERE curriculum_id = ?").all(cur.id) as { code: string; name: string; text: string; kind: string }[]) : [];
    const old = new Map(nodes.map((n) => [n.code, n]));
    for (const n of pkg.nodes ?? []) {
      const o = old.get(n.code);
      if (!o) d.newNodes++;
      else if (o.name !== n.name || o.text !== (n.text ?? "") || o.kind !== n.kind) d.changedNodes++;
    }
    for (const [skillId] of pkg.skill_nodes ?? []) if (!byId.has(skillId) && !pkgIds.has(skillId)) d.errors.push(`Verknüpfung: Fähigkeit ${skillId} gibt es nicht`);
  }
  const links = new Set((conn.prepare("SELECT skill_id || '|' || other_id || '|' || kind AS k FROM skill_links").all() as { k: string }[]).map((r) => r.k));
  for (const s of pkg.skills ?? []) {
    if (d.duplicates.some((x) => x.id === s.id) || d.conflicts.some((x) => x.id === s.id)) continue;
    for (const p of s.prerequisites ?? []) if (!links.has(`${s.id}|${p}|voraussetzung`)) d.newLinks++;
    for (const p of s.next ?? []) if (!links.has(`${s.id}|${p}|weiter`)) d.newLinks++;
  }
  return d;
}

export type ImportRow = { id: number; source_key: string; curriculum_key: string | null; label: string; content_hash: string; diff: Diff; status: "vorschau" | "importiert" | "verworfen"; created_by: number | null; created_at: string; applied_at: string | null };
const toImport = (r: Record<string, unknown>): ImportRow => ({ ...(r as unknown as ImportRow), diff: json<Diff>(r.diff as string, {} as Diff) });

/** Parses and checks a package and stores the result as a preview. */
export function preview(raw: string | CurriculumPackage, teacherId: number | null): { id: number | null; diff: Diff; label: string } {
  let pkg: CurriculumPackage;
  try {
    pkg = typeof raw === "string" ? (JSON.parse(raw) as CurriculumPackage) : raw;
  } catch {
    return { id: null, label: "", diff: emptyDiff(["Kein gültiges JSON"]) };
  }
  const diff = diffPackage(pkg);
  if (validate(pkg).length) return { id: null, label: pkg?.label ?? "", diff };
  const res = db()
    .prepare("INSERT INTO curriculum_imports (source_key, curriculum_key, label, content_hash, payload, diff, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'vorschau', ?, datetime('now'))")
    .run(pkg.source.key, pkg.curriculum?.key ?? null, pkg.label, contentHash(pkg), JSON.stringify(pkg), JSON.stringify(diff), teacherId);
  return { id: Number(res.lastInsertRowid), diff, label: pkg.label };
}
const emptyDiff = (errors: string[]): Diff => ({ newTopics: [], newSkills: [], changedSkills: [], unchanged: 0, duplicates: [], conflicts: [], newNodes: 0, changedNodes: 0, newLinks: 0, errors, warnings: [], alreadyImported: false });

export function listImports(limit = 20): ImportRow[] {
  return db().prepare("SELECT id, source_key, curriculum_key, label, content_hash, diff, status, created_by, created_at, applied_at FROM curriculum_imports ORDER BY id DESC LIMIT ?").all(limit).map((r) => toImport(r as Record<string, unknown>));
}
export function getImport(id: number): (ImportRow & { payload: CurriculumPackage }) | null {
  const r = db().prepare("SELECT * FROM curriculum_imports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? { ...toImport(r), payload: json<CurriculumPackage>(r.payload as string, {} as CurriculumPackage) } : null;
}
export function discardImport(id: number) {
  db().prepare("UPDATE curriculum_imports SET status = 'verworfen' WHERE id = ? AND status = 'vorschau'").run(id);
}

/**
 * Applies a preview. The comparison is made again at this moment, so a preview that went stale
 * cannot overwrite anything; duplicates and conflicts are skipped. Returns the applied diff.
 */
export function applyImport(id: number): { ok: boolean; error?: string; diff?: Diff } {
  const imp = getImport(id);
  if (!imp) return { ok: false, error: "Import nicht gefunden" };
  if (imp.status !== "vorschau") return { ok: false, error: imp.status === "importiert" ? "Schon importiert" : "Verworfen" };
  const pkg = imp.payload;
  const conn = db();
  const diff = diffPackage(pkg);
  if (diff.errors.length) return { ok: false, error: diff.errors[0], diff };
  if (diff.alreadyImported) return { ok: false, error: "Genau dieses Paket wurde schon importiert", diff };

  const tx = conn.transaction(() => {
    const sourceId = saveSource({ retrieved_at: new Date().toISOString().slice(0, 10), content_hash: imp.content_hash, ...pkg.source });
    let curriculumId: number | null = null;
    const nodeIds = new Map<string, number>();
    if (pkg.curriculum) {
      const c = pkg.curriculum;
      conn
        .prepare(
          `INSERT INTO curricula (key, name, school_type, subject, version, reference, valid_from, valid_to, source_id) VALUES (@key, @name, @school_type, @subject, @version, @reference, @valid_from, @valid_to, @source_id)
           ON CONFLICT(key) DO UPDATE SET name = excluded.name, version = excluded.version, reference = excluded.reference, valid_from = excluded.valid_from, valid_to = excluded.valid_to, source_id = excluded.source_id`,
        )
        .run({ reference: "", valid_from: null, valid_to: null, ...c, source_id: sourceId });
      curriculumId = (conn.prepare("SELECT id FROM curricula WHERE key = ?").get(c.key) as { id: number }).id;
      const upsert = conn.prepare(
        `INSERT INTO curriculum_nodes (curriculum_id, code, parent_id, kind, name, text, klasse, schulstufe, competency_area, content_area, action_area, reference, sort)
         VALUES (@curriculum_id, @code, @parent_id, @kind, @name, @text, @klasse, @schulstufe, @competency_area, @content_area, @action_area, @reference, @sort)
         ON CONFLICT(curriculum_id, code) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, name = excluded.name, text = excluded.text, klasse = excluded.klasse,
           schulstufe = excluded.schulstufe, competency_area = excluded.competency_area, content_area = excluded.content_area, action_area = excluded.action_area, reference = excluded.reference, sort = excluded.sort`,
      );
      (pkg.nodes ?? []).forEach((n, i) => {
        upsert.run({
          text: "", klasse: null, schulstufe: null, competency_area: "", content_area: "", action_area: "", reference: "",
          ...n,
          curriculum_id: curriculumId,
          parent_id: n.parent ? (nodeIds.get(n.parent) ?? null) : null,
          sort: i,
        });
        nodeIds.set(n.code, (conn.prepare("SELECT id FROM curriculum_nodes WHERE curriculum_id = ? AND code = ?").get(curriculumId, n.code) as { id: number }).id);
      });
    }

    const skip = new Set([...diff.duplicates.map((x) => x.id), ...diff.conflicts.map((x) => x.id)]);
    const changed = new Set(diff.changedSkills.map((x) => x.id));
    const taken = new Set((conn.prepare("SELECT code FROM skills WHERE code IS NOT NULL").all() as { code: string }[]).map((r) => r.code));
    let sort = (conn.prepare("SELECT COALESCE(MAX(sort), 0) AS s FROM skills").get() as { s: number }).s;
    const names = new Map((pkg.skills ?? []).map((s) => [s.id, s.name]));
    const insert = conn.prepare(
      `INSERT INTO skills (id, subject, area, subtopic, name, parent_id, grade_min, grade_max, school_types, learning_objective, description, competency_area, content_area, action_area, version, sort, code, source_id, status)
       VALUES (@id, @subject, @area, @subtopic, @name, @parent_id, @grade_min, @grade_max, @school_types, @learning_objective, @description, @competency_area, @content_area, @action_area, @version, @sort, @code, @source_id, 'aktiv')`,
    );
    const update = conn.prepare(
      `UPDATE skills SET subject = @subject, area = @area, subtopic = @subtopic, name = @name, parent_id = @parent_id, grade_min = @grade_min, grade_max = @grade_max, school_types = @school_types,
         learning_objective = @learning_objective, description = @description, competency_area = @competency_area, content_area = @content_area, action_area = @action_area, version = @version WHERE id = @id`,
    );
    for (const s of pkg.skills ?? []) {
      if (skip.has(s.id)) continue;
      const row = skillRow(s);
      if (diff.newSkills.includes(s.id)) {
        const parentName = s.parent ? (names.get(s.parent) ?? (conn.prepare("SELECT name FROM skills WHERE id = ?").get(s.parent) as { name: string } | undefined)?.name) : null;
        let code = skillCode({ ...row, parentName });
        for (let n = 2; taken.has(code); n++) code = `${skillCode({ ...row, parentName })}-${n}`;
        taken.add(code);
        insert.run({ ...row, id: s.id, sort: ++sort, code, source_id: sourceId });
      } else if (changed.has(s.id)) {
        const before = conn.prepare("SELECT * FROM skills WHERE id = ?").get(s.id);
        conn.prepare("INSERT INTO skill_history (skill_id, import_id, before, changed_at) VALUES (?, ?, ?, datetime('now'))").run(s.id, id, JSON.stringify(before));
        update.run({ ...row, id: s.id });
      }
    }
    const link = conn.prepare("INSERT OR IGNORE INTO skill_links (skill_id, other_id, kind) VALUES (?, ?, ?)");
    const toNode = conn.prepare("INSERT OR IGNORE INTO skill_curriculum (skill_id, node_id) VALUES (?, ?)");
    for (const s of pkg.skills ?? []) {
      if (skip.has(s.id)) continue;
      for (const p of s.prerequisites ?? []) link.run(s.id, p, "voraussetzung");
      for (const p of s.next ?? []) link.run(s.id, p, "weiter");
      for (const code of s.nodes ?? []) toNode.run(s.id, nodeIds.get(code));
    }
    for (const [skillId, code] of pkg.skill_nodes ?? []) toNode.run(skillId, nodeIds.get(code));
    conn.prepare("UPDATE curriculum_imports SET status = 'importiert', applied_at = datetime('now'), diff = ? WHERE id = ?").run(JSON.stringify(diff), id);
  });
  tx();
  return { ok: true, diff };
}

/** Removes a demo curriculum again (only demo sources; real data is never deleted). */
export function removeDemo(sourceKey: string): boolean {
  const src = getSource(sourceKey);
  if (!src || src.source_type !== "demo") return false;
  const conn = db();
  conn.transaction(() => {
    conn.prepare("DELETE FROM curricula WHERE source_id = ?").run(src.id);
    const ids = (conn.prepare("SELECT id FROM skills WHERE source_id = ?").all(src.id) as { id: string }[]).map((r) => r.id);
    for (const sid of ids) {
      const used = conn.prepare("SELECT 1 FROM task_skills WHERE skill_id = ? UNION SELECT 1 FROM attempts WHERE skill_id = ? LIMIT 1").get(sid, sid);
      if (used) conn.prepare("UPDATE skills SET status = 'archiviert' WHERE id = ?").run(sid);
      else conn.prepare("DELETE FROM skills WHERE id = ?").run(sid);
    }
    conn.prepare("UPDATE curriculum_imports SET status = 'verworfen' WHERE source_key = ? AND status = 'importiert'").run(sourceKey);
  })();
  return true;
}

// ---------- bundled packages ----------
export type BundledPackage = { file: string; label: string; description: string; sourceType: SourceType; skills: number; nodes: number; imported: boolean; allowed: boolean };
const PACKAGE_DIR = path.join(process.cwd(), "curriculum");

/** Packages shipped with the app (curriculum/*.json). */
export function bundledPackages(): BundledPackage[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(PACKAGE_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return files.flatMap((file) => {
    const pkg = readBundled(file);
    if (!pkg) return [];
    const imported = Boolean(db().prepare("SELECT 1 FROM curriculum_imports WHERE content_hash = ? AND status = 'importiert'").get(contentHash(pkg)));
    const src = { source_type: pkg.source.source_type, commercial_use_allowed: licenseTerms(pkg.source.license ?? "").commercial, derivatives_allowed: licenseTerms(pkg.source.license ?? "").derivatives, copy_allowed: 1 };
    return [{ file, label: pkg.label, description: pkg.description ?? "", sourceType: pkg.source.source_type, skills: pkg.skills?.length ?? 0, nodes: pkg.nodes?.length ?? 0, imported, allowed: taskBankAllowed(src).ok }];
  });
}
export function readBundled(file: string): CurriculumPackage | null {
  if (!/^[a-z0-9-]+\.json$/.test(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, file), "utf8")) as CurriculumPackage;
  } catch {
    return null;
  }
}
