/**
 * Curriculum layer on top of the skill tree: content sources and their licences, which skills fit a
 * student, prerequisites, topic → skill suggestions, settings and empirical task difficulty.
 * Everything here is rule-based and works without AI. Architecture: docs/curriculum.md.
 */
import { db } from "./db";
import type { Skill, Student } from "./repo";
import { checkLevel, SCHOOL_TYPES, schulstufe } from "./school";

// ---------- sources and licences ----------
export type SourceType = "lehrplan" | "eigen" | "ki" | "oer" | "referenz" | "demo";
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  lehrplan: "Offizieller Lehrplan",
  eigen: "Eigene Inhalte",
  ki: "KI-generiert",
  oer: "Offene Bildungsquelle (OER)",
  referenz: "Nur Referenz",
  demo: "Demo / Beispiel",
};

export type ContentSource = {
  id: number;
  key: string;
  name: string;
  source_type: SourceType;
  url: string;
  author: string;
  publisher: string;
  license: string;
  license_url: string;
  attribution_text: string;
  commercial_use_allowed: number | null;
  derivatives_allowed: number | null;
  share_alike_required: number;
  copy_allowed: number;
  retrieved_at: string | null;
  modified: string | null;
  content_hash: string | null;
  notes: string;
  created_at: string;
};
export type SourceInput = Partial<Omit<ContentSource, "id" | "created_at">> & Pick<ContentSource, "key" | "name" | "source_type">;

export function listSources(): (ContentSource & { skills: number; tasks: number })[] {
  return db()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM skills s WHERE s.source_id = c.id) AS skills, (SELECT COUNT(*) FROM tasks t WHERE t.source_id = c.id) AS tasks
       FROM content_sources c ORDER BY CASE c.source_type WHEN 'lehrplan' THEN 0 WHEN 'eigen' THEN 1 WHEN 'ki' THEN 2 WHEN 'oer' THEN 3 WHEN 'demo' THEN 4 ELSE 5 END, c.name`,
    )
    .all() as (ContentSource & { skills: number; tasks: number })[];
}
export function getSource(key: string): ContentSource | null {
  return (db().prepare("SELECT * FROM content_sources WHERE key = ?").get(key) as ContentSource | undefined) ?? null;
}
export function sourceById(id: number | null | undefined): ContentSource | null {
  if (id == null) return null;
  return (db().prepare("SELECT * FROM content_sources WHERE id = ?").get(id) as ContentSource | undefined) ?? null;
}

/** Creates a source or updates the one with the same key; licence flags are derived from the licence text when not given. */
export function saveSource(s: SourceInput): number {
  const terms = licenseTerms(s.license ?? "");
  const row = {
    url: "", author: "", publisher: "", license: "", license_url: "", attribution_text: "", notes: "",
    retrieved_at: null, modified: null, content_hash: null,
    ...s,
    commercial_use_allowed: s.commercial_use_allowed !== undefined ? s.commercial_use_allowed : terms.commercial,
    derivatives_allowed: s.derivatives_allowed !== undefined ? s.derivatives_allowed : terms.derivatives,
    share_alike_required: s.share_alike_required ?? (terms.shareAlike ? 1 : 0),
    copy_allowed: s.copy_allowed ?? (s.source_type === "referenz" ? 0 : terms.commercial === null ? 0 : 1),
  };
  db()
    .prepare(
      `INSERT INTO content_sources (key, name, source_type, url, author, publisher, license, license_url, attribution_text, commercial_use_allowed, derivatives_allowed, share_alike_required, copy_allowed, retrieved_at, modified, content_hash, notes)
       VALUES (@key, @name, @source_type, @url, @author, @publisher, @license, @license_url, @attribution_text, @commercial_use_allowed, @derivatives_allowed, @share_alike_required, @copy_allowed, @retrieved_at, @modified, @content_hash, @notes)
       ON CONFLICT(key) DO UPDATE SET name = excluded.name, source_type = excluded.source_type, url = excluded.url, author = excluded.author, publisher = excluded.publisher,
         license = excluded.license, license_url = excluded.license_url, attribution_text = excluded.attribution_text, commercial_use_allowed = excluded.commercial_use_allowed,
         derivatives_allowed = excluded.derivatives_allowed, share_alike_required = excluded.share_alike_required, copy_allowed = excluded.copy_allowed,
         retrieved_at = excluded.retrieved_at, modified = excluded.modified, content_hash = excluded.content_hash, notes = excluded.notes`,
    )
    .run(row);
  return getSource(s.key)!.id;
}

/**
 * What a licence text allows. Creative Commons is read from its short name:
 *   CC0, CC BY, CC BY-SA → commercial use and changes allowed (SA: changes keep the licence)
 *   …-NC → no commercial use; …-ND → no changes
 * "amtliches Werk" (laws, Verordnungen like the Lehrpläne, § 7 UrhG) and own content are free.
 * Anything else is unknown (null) and therefore never used automatically.
 */
export type LicenseTerms = { kind: string; commercial: 0 | 1 | null; derivatives: 0 | 1 | null; shareAlike: boolean };
export function licenseTerms(license: string): LicenseTerms {
  const l = license.trim().toUpperCase().replace(/[_\s]+/g, " ");
  if (/^(CC0|CC ZERO|PUBLIC DOMAIN|GEMEINFREI)/.test(l)) return { kind: "CC0", commercial: 1, derivatives: 1, shareAlike: false };
  const cc = l.match(/^CC[ -]?BY((?:-(?:NC|ND|SA))*)/);
  if (cc) {
    const parts = cc[1].split("-").filter(Boolean);
    return {
      kind: `CC BY${parts.length ? `-${parts.join("-")}` : ""}`,
      commercial: parts.includes("NC") ? 0 : 1,
      derivatives: parts.includes("ND") ? 0 : 1,
      shareAlike: parts.includes("SA"),
    };
  }
  if (/AMTLICH|§ ?7 URHG/.test(l)) return { kind: "amtliches Werk", commercial: 1, derivatives: 1, shareAlike: false };
  if (l === "EIGEN") return { kind: "eigen", commercial: 1, derivatives: 1, shareAlike: false };
  return { kind: license.trim() || "unbekannt", commercial: null, derivatives: null, shareAlike: false };
}

/**
 * May content of this source go into the (commercial) task bank automatically?
 * Never for reference sources (IQS, Matura, textbooks), unknown licences, NC or ND.
 */
export function taskBankAllowed(s: Pick<ContentSource, "source_type" | "commercial_use_allowed" | "derivatives_allowed" | "copy_allowed">): { ok: boolean; reason: string } {
  if (s.source_type === "referenz") return { ok: false, reason: "Nur als Referenz – Inhalte werden nicht übernommen" };
  if (!s.copy_allowed) return { ok: false, reason: "Übernahme nicht erlaubt oder nicht geprüft" };
  if (s.commercial_use_allowed === null) return { ok: false, reason: "Lizenz ungeklärt" };
  if (s.commercial_use_allowed === 0) return { ok: false, reason: "Keine kommerzielle Nutzung erlaubt (NC)" };
  if (s.derivatives_allowed === 0) return { ok: false, reason: "Keine Bearbeitung erlaubt (ND)" };
  return { ok: true, reason: "Nutzung erlaubt" };
}

/** Sources whose content may be used commercially, i.e. the filter of the task bank. */
export const commercialSources = () => listSources().filter((s) => taskBankAllowed(s).ok);

// ---------- curriculum overview ----------
/** The official curriculum behind each school type, where it was verified (see db.ts OFFICIAL_SOURCES). */
export const OFFICIAL_SOURCE_FOR: Record<string, string | null> = {
  Volksschule: "ris-vs",
  Mittelschule: "ris-ms",
  Gymnasium: "ris-ahs",
  HTL: "ris-htl",
  HAK: "ris-hak",
};

export type CurriculumOverview = {
  schoolType: string;
  short: string;
  stufen: [number, number];
  source: ContentSource | null;
  curricula: { key: string; name: string; subject: string; version: string; reference: string; valid_from: string | null; nodes: number }[];
  skills: { subject: string; count: number }[];
};
export function curriculumOverview(): CurriculumOverview[] {
  const skills = activeSkills();
  return SCHOOL_TYPES.map((t) => {
    const lo = t.offset + 1;
    const hi = t.offset + t.classes;
    const fitting = skills.filter((s) => s.grade_min <= hi && s.grade_max >= lo && fitsSchoolType(s, t.name));
    const subjects = [...new Set(fitting.map((s) => s.subject))];
    const key = OFFICIAL_SOURCE_FOR[t.name];
    return {
      schoolType: t.name,
      short: t.short,
      stufen: [lo, hi] as [number, number],
      source: key ? getSource(key) : null,
      curricula: db()
        .prepare("SELECT c.key, c.name, c.subject, c.version, c.reference, c.valid_from, (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.curriculum_id = c.id) AS nodes FROM curricula c WHERE c.school_type = ? ORDER BY c.subject, c.version DESC")
        .all(t.name) as CurriculumOverview["curricula"],
      skills: subjects.map((subject) => ({ subject, count: fitting.filter((s) => s.subject === subject).length })),
    };
  });
}

// ---------- one curriculum as a tree ----------
export type CurriculumInfo = { id: number; key: string; name: string; school_type: string; subject: string; version: string; reference: string; valid_from: string | null; source: ContentSource | null };
export type CurriculumTreeNode = { id: number; code: string; kind: string; name: string; text: string; klasse: number | null; schulstufe: number | null; skills: { id: string; name: string }[]; children: CurriculumTreeNode[] };

export function getCurriculum(key: string): CurriculumInfo | null {
  const c = db().prepare("SELECT id, key, name, school_type, subject, version, reference, valid_from, source_id FROM curricula WHERE key = ?").get(key) as (Omit<CurriculumInfo, "source"> & { source_id: number | null }) | undefined;
  if (!c) return null;
  const { source_id, ...rest } = c;
  return { ...rest, source: sourceById(source_id) };
}

/** The classes (Klassen, Schulstufen, Jahrgänge) of a curriculum, as the source names them. */
export function curriculumClasses(id: number): { klasse: number; name: string }[] {
  return db().prepare("SELECT klasse, MIN(name) AS name FROM curriculum_nodes WHERE curriculum_id = ? AND kind = 'klasse' GROUP BY klasse ORDER BY klasse").all(id) as { klasse: number; name: string }[];
}

/** All entries of a curriculum nested by parent, in source order, with the skills that practise each one; optionally one class only. */
export function curriculumTree(id: number, klasse?: number | null): CurriculumTreeNode[] {
  const rows = db()
    .prepare("SELECT id, code, kind, name, text, klasse, schulstufe, parent_id FROM curriculum_nodes WHERE curriculum_id = ? ORDER BY sort, id")
    .all(id) as (Omit<CurriculumTreeNode, "skills" | "children"> & { parent_id: number | null })[];
  const links = db()
    .prepare("SELECT sc.node_id, s.id, s.name FROM skill_curriculum sc JOIN skills s ON s.id = sc.skill_id JOIN curriculum_nodes n ON n.id = sc.node_id WHERE n.curriculum_id = ? ORDER BY s.sort, s.name")
    .all(id) as { node_id: number; id: string; name: string }[];
  const byId = new Map<number, CurriculumTreeNode>();
  for (const r of rows) byId.set(r.id, { id: r.id, code: r.code, kind: r.kind, name: r.name, text: r.text, klasse: r.klasse, schulstufe: r.schulstufe, skills: [], children: [] });
  for (const l of links) byId.get(l.node_id)?.skills.push({ id: l.id, name: l.name });
  const roots: CurriculumTreeNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  if (klasse == null) return roots;
  const keep = (n: CurriculumTreeNode): CurriculumTreeNode | null => {
    if (n.klasse != null) return n.klasse === klasse ? n : null;
    const children = n.children.map(keep).filter((c): c is CurriculumTreeNode => c !== null);
    return children.length ? { ...n, children } : null;
  };
  return roots.map(keep).filter((c): c is CurriculumTreeNode => c !== null);
}

// ---------- skills for a student ----------
const activeSkills = () => db().prepare("SELECT * FROM skills WHERE COALESCE(status, 'aktiv') = 'aktiv' ORDER BY sort, subject, area, name").all() as Skill[];
const fitsSchoolType = (s: Skill, type: string) => !s.school_types || s.school_types.split(",").map((x) => x.trim()).includes(type);

/**
 * Skills that fit a student's school type and Schulstufe. With an unclear level ("unklar") nothing is
 * narrowed down: the teacher sees every skill of the subject instead of a wrong selection.
 */
export function skillsForStudent(student: Pick<Student, "school_type" | "klasse" | "grade">, subject?: string, o: { earlier?: boolean } = {}): Skill[] {
  const level = checkLevel(student.school_type, student.klasse, student.grade);
  return activeSkills().filter((s) => {
    if (subject && s.subject !== subject) return false;
    if (level.status !== "eindeutig") return true;
    const stufe = level.schulstufe!;
    return (o.earlier ? s.grade_min <= stufe : s.grade_min <= stufe && s.grade_max >= stufe) && fitsSchoolType(s, student.school_type);
  });
}
export const stufeOf = (type: string, klasse: number) => schulstufe(type, klasse);

// ---------- prerequisites and next skills ----------
export function prerequisitesOf(skillId: string): string[] {
  return (db().prepare("SELECT other_id FROM skill_links WHERE skill_id = ? AND kind = 'voraussetzung'").all(skillId) as { other_id: string }[]).map((r) => r.other_id);
}
/** Skills that build on this one: explicit "weiter" links and skills that list it as prerequisite. */
export function nextSkillsOf(skillId: string): string[] {
  const rows = db()
    .prepare("SELECT other_id AS id FROM skill_links WHERE skill_id = ? AND kind = 'weiter' UNION SELECT skill_id AS id FROM skill_links WHERE other_id = ? AND kind = 'voraussetzung'")
    .all(skillId, skillId) as { id: string }[];
  return rows.map((r) => r.id);
}
export function allLinks(): { skill_id: string; other_id: string; kind: "voraussetzung" | "weiter" }[] {
  return db().prepare("SELECT skill_id, other_id, kind FROM skill_links").all() as { skill_id: string; other_id: string; kind: "voraussetzung" | "weiter" }[];
}

// ---------- exam topics → skill suggestions ----------
const STOP = new Set(["und", "oder", "der", "die", "das", "mit", "von", "bis", "zum", "zur", "aufgaben", "aufgabe", "rechnen", "kapitel", "seite", "buch", "the", "and"]);
/** Same word stem for German plural/inflection: Brüche ~ Bruch, Prozente ~ Prozent. */
const stem = (w: string) =>
  w
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/(ungen|ung|en|er|es|e|n|s)$/, "");
const tokens = (text: string) =>
  text
    .split(/[^A-Za-zÄÖÜäöüß0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()))
    .map(stem)
    .filter((w) => w.length >= 3);

/** Splits "Brüche, Prozent und Sachaufgaben" into topics. */
export function splitTopics(text: string): string[] {
  return text
    .split(/[,;\n•]+|\s+und\s+|\s+\/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, i, all) => all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
}

export type SkillMatch = { skill: Skill; score: number; via: "thema" | "faehigkeit" };
/**
 * Suggests skills for a free-text topic ("Bruchrechnung", "Prozent-Sachaufgaben"). Only suggestions:
 * nothing is linked until the teacher picks it. A topic that matches no word of a skill or Thema
 * returns nothing rather than something vague.
 */
export function matchSkills(topic: string, subject: string, opts: { student?: Pick<Student, "school_type" | "klasse" | "grade">; limit?: number } = {}): SkillMatch[] {
  const want = tokens(topic);
  if (!want.length) return [];
  const pool = opts.student ? skillsForStudent(opts.student, subject, { earlier: true }) : activeSkills().filter((s) => s.subject === subject);
  const hit = (words: string[]) => want.filter((w) => words.some((x) => x.startsWith(w) || w.startsWith(x))).length;
  const out: SkillMatch[] = [];
  for (const s of pool) {
    const own = hit(tokens(`${s.name} ${s.subtopic ?? ""}`));
    const area = hit(tokens(s.area));
    if (!own && !area) continue;
    // a topic naming the skill itself beats one naming only its Thema; Teilfähigkeiten only on a direct hit
    if (s.parent_id && !own) continue;
    out.push({ skill: s, score: own * 2 + area + (s.parent_id ? 0 : 0.5), via: own ? "faehigkeit" : "thema" });
  }
  return out.sort((a, b) => b.score - a.score || a.skill.sort - b.skill.sort).slice(0, opts.limit ?? 8);
}

// ---------- settings ----------
export function getSetting(key: string, fallback: string): string {
  return (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? fallback;
}
export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
export const DEFAULT_EXAM_THRESHOLDS: [number, number, number] = [14, 7, 3];
/** Days before an exam for "Vorbereitung beginnen", "höhere Priorität", "Prüfung bald". */
export function examThresholds(): [number, number, number] {
  const n = getSetting("exam_reminders", DEFAULT_EXAM_THRESHOLDS.join(","))
    .split(",")
    .map((x) => Math.round(Number(x)))
    .filter((x) => Number.isFinite(x) && x >= 0);
  if (n.length !== 3) return DEFAULT_EXAM_THRESHOLDS;
  const [a, b, c] = [...n].sort((x, y) => y - x);
  return [a, b, c];
}
export function setExamThresholds(values: number[]) {
  const n = values.map((x) => Math.max(0, Math.min(90, Math.round(x)))).sort((a, b) => b - a);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x))) throw new Error("Drei Zahlen erwartet");
  setSetting("exam_reminders", n.join(","));
}

// ---------- empirical difficulty ----------
export type TaskStats = { n: number; successRate: number | null; medianTimeSec: number | null; helpRate: number | null; suggestedLevel: number | null };
/** Minimum of finished answers before a task's measured difficulty is suggested. */
export const EMPIRICAL_MIN = 30;
/**
 * How hard a task turned out in practice, from all final answers to it: share correct, median time and
 * share with hints or solution. With at least 30 answers a level 1–5 is suggested from the success rate
 * (≥ 90 % → 1, ≥ 75 % → 2, ≥ 55 % → 3, ≥ 35 % → 4, below → 5). The stored level is not changed automatically.
 */
export function taskStats(taskId: number): TaskStats {
  const rows = db().prepare("SELECT correct, time_ms, hints_used, solution_viewed FROM attempts WHERE task_id = ? AND final = 1").all(taskId) as {
    correct: number; time_ms: number; hints_used: number; solution_viewed: number;
  }[];
  return statsOf(rows);
}
export function statsOf(rows: { correct: number; time_ms: number; hints_used: number; solution_viewed: number }[]): TaskStats {
  const n = rows.length;
  if (!n) return { n, successRate: null, medianTimeSec: null, helpRate: null, suggestedLevel: null };
  const successRate = rows.filter((r) => r.correct).length / n;
  const times = rows.map((r) => r.time_ms).sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
  return {
    n,
    successRate,
    medianTimeSec: Math.round(median / 1000),
    helpRate: rows.filter((r) => r.hints_used > 0 || r.solution_viewed).length / n,
    suggestedLevel: n < EMPIRICAL_MIN ? null : successRate >= 0.9 ? 1 : successRate >= 0.75 ? 2 : successRate >= 0.55 ? 3 : successRate >= 0.35 ? 4 : 5,
  };
}
