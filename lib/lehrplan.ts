/**
 * Curriculum layer on top of the skill tree: content sources and their licences, which skills fit a
 * student, prerequisites, topic → skill suggestions, settings and empirical task difficulty.
 * Everything here is rule-based and works without AI. Architecture: docs/curriculum.md.
 */
import { db } from "./db";
import { SKILL_SELECT, type Skill, type Student } from "./repo";
import { checkLevel, SCHOOL_BRANCHES, SCHOOL_TYPES, schulstufe, type SchoolBranch } from "./school";
import { BEREICH_SUCHWOERTER, SUCHWOERTER } from "./themen";

// ---------- sources and licences ----------
export type SourceType = "lehrplan" | "eigen" | "ki" | "oer" | "lizenz" | "referenz" | "demo";
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  lehrplan: "Offizieller Lehrplan",
  eigen: "Eigene Inhalte",
  ki: "KI-generiert",
  oer: "Offene Bildungsquelle (OER)",
  lizenz: "Lizenzierte Inhalte",
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
  // removed links and merged duplicates (Mehr › Datenqualität) are left out
  const links = db()
    .prepare(
      `SELECT sc.node_id, s.id, s.name FROM skill_curriculum sc JOIN skills s ON s.id = sc.skill_id JOIN curriculum_nodes n ON n.id = sc.node_id
       LEFT JOIN skill_overrides o ON o.skill_id = s.id
       WHERE n.curriculum_id = ? AND sc.removed_at IS NULL AND o.merged_into IS NULL ORDER BY s.sort, s.name`,
    )
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
const activeSkills = () => db().prepare(`${SKILL_SELECT} WHERE COALESCE(s.status, 'aktiv') = 'aktiv' AND o.merged_into IS NULL ORDER BY s.sort, s.subject, area, s.name`).all() as Skill[];
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

/** Schulstufen before the student's own whose skills a KI request still lists. */
export const PROMPT_STUFEN_FRUEHER = 3;
/**
 * The skills a KI request lists for a student (Foto vom Stoff, material analysis): those of the
 * student's level and of the three Schulstufen before it, so a 7. Klasse AHS does not send the whole
 * Volksschule along and the request stays short. Matching a topic (matchSkills) still uses every
 * earlier skill.
 */
export function skillsForPrompt(student: Pick<Student, "school_type" | "klasse" | "grade">, subject?: string): Skill[] {
  const all = skillsForStudent(student, subject, { earlier: true });
  const level = checkLevel(student.school_type, student.klasse, student.grade);
  return level.status === "eindeutig" ? all.filter((s) => s.grade_max >= level.schulstufe! - PROMPT_STUFEN_FRUEHER) : all;
}

// ---------- browsing skills by school branch ----------
/**
 * Skills of a subject that belong to a branch and, if given, to one of its classes. The filter uses
 * the data that is already there: school_types on the skill and its Schulstufe range.
 */
export function browseSkills(o: { subject?: string; branch?: SchoolBranch | null; klasse?: number | null } = {}): Skill[] {
  const stufen = o.branch ? (o.klasse ? [o.klasse] : o.branch.classes).map((k) => schulstufe(o.branch!.schoolType, k)) : [];
  return activeSkills().filter((s) => {
    if (o.subject && s.subject !== o.subject) return false;
    if (!o.branch) return true;
    return fitsSchoolType(s, o.branch.schoolType) && stufen.some((st) => s.grade_min <= st && s.grade_max >= st);
  });
}

/** The official curriculum of a school type and subject, if its Lehrplan text is imported. */
export function curriculumFor(schoolType: string, subject: string): { key: string; name: string } | null {
  return (db().prepare("SELECT key, name FROM curricula WHERE school_type = ? AND subject = ? AND status = 'aktiv' ORDER BY version DESC").get(schoolType, subject) as { key: string; name: string } | undefined) ?? null;
}

/** The branches that have skills in this subject, and how many; a skill can appear in several. */
export function branchesWithSkills(subject: string): { branch: SchoolBranch; count: number }[] {
  return SCHOOL_BRANCHES.map((branch) => ({ branch, count: browseSkills({ subject, branch }).filter((s) => !s.parent_id).length })).filter((x) => x.count > 0);
}

// ---------- prerequisites and next skills ----------
// Removed links stay in skill_links with removed_at, so a standard link the teacher removed does not
// come back with the next start or import. Only the teacher adds or removes links; nothing is guessed.
export function prerequisitesOf(skillId: string): string[] {
  return (db().prepare("SELECT other_id FROM skill_links WHERE skill_id = ? AND kind = 'voraussetzung' AND removed_at IS NULL").all(skillId) as { other_id: string }[]).map((r) => r.other_id);
}
/** Skills that build on this one: explicit "weiter" links and skills that list it as prerequisite. */
export function nextSkillsOf(skillId: string): string[] {
  const rows = db()
    .prepare(
      "SELECT other_id AS id FROM skill_links WHERE skill_id = ? AND kind = 'weiter' AND removed_at IS NULL UNION SELECT skill_id AS id FROM skill_links WHERE other_id = ? AND kind = 'voraussetzung' AND removed_at IS NULL",
    )
    .all(skillId, skillId) as { id: string }[];
  return rows.map((r) => r.id);
}
export function allLinks(): { skill_id: string; other_id: string; kind: "voraussetzung" | "weiter" }[] {
  return db().prepare("SELECT skill_id, other_id, kind FROM skill_links WHERE removed_at IS NULL").all() as { skill_id: string; other_id: string; kind: "voraussetzung" | "weiter" }[];
}

export type LinkOrigin = "app" | "import" | "lehrer";
export const LINK_ORIGIN_LABEL: Record<LinkOrigin, string> = { app: "Standard", import: "aus Import", lehrer: "eigene" };
export type SkillLink = { skill_id: string; other_id: string; kind: "voraussetzung" | "weiter"; origin: LinkOrigin; removed_at: string | null; changed_by: number | null };
/** Every prerequisite link of a skill, removed ones included (they can be restored). */
export function prerequisiteLinks(skillId: string): SkillLink[] {
  return db().prepare("SELECT skill_id, other_id, kind, origin, removed_at, changed_by FROM skill_links WHERE skill_id = ? AND kind = 'voraussetzung' ORDER BY removed_at IS NOT NULL, rowid").all(skillId) as SkillLink[];
}
/** Would `before` → `skillId` close a circle (skillId is already needed for before)? */
function createsCycle(skillId: string, before: string): boolean {
  const seen = new Set<string>();
  const stack = [before];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === skillId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...prerequisitesOf(id));
  }
  return false;
}
/** The teacher adds a prerequisite (or restores a removed one). */
export function addPrerequisite(skillId: string, before: string, teacherId: number | null): { ok: true } | { error: string } {
  if (skillId === before) return { error: "Eine Fähigkeit kann nicht ihre eigene Voraussetzung sein." };
  const exists = db().prepare("SELECT 1 FROM skills WHERE id = ?");
  if (!exists.get(skillId) || !exists.get(before)) return { error: "Fähigkeit nicht gefunden." };
  if (createsCycle(skillId, before)) return { error: "Das ergäbe einen Kreis: diese Fähigkeit ist schon Voraussetzung der anderen." };
  db()
    .prepare(
      `INSERT INTO skill_links (skill_id, other_id, kind, origin, changed_by) VALUES (?, ?, 'voraussetzung', 'lehrer', ?)
       ON CONFLICT(skill_id, other_id, kind) DO UPDATE SET removed_at = NULL, changed_by = excluded.changed_by`,
    )
    .run(skillId, before, teacherId);
  return { ok: true };
}
/** Removing keeps the row (removed_at), so the link stays removed after a restart or re-import. */
export function removePrerequisite(skillId: string, before: string, teacherId: number | null) {
  db().prepare("UPDATE skill_links SET removed_at = datetime('now'), changed_by = ? WHERE skill_id = ? AND other_id = ? AND kind = 'voraussetzung'").run(teacherId, skillId, before);
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

/**
 * The words `matchSkills` compares with (stemmed, stop words dropped). Exported so a caller that
 * must judge a hit more strictly than the suggestion does can compare the same tokens instead of
 * inventing a second tokeniser.
 */
export const topicTokens = tokens;

/** Splits "Brüche, Prozent und Sachaufgaben" into topics. */
export function splitTopics(text: string): string[] {
  return text
    .split(/[,;\n•]+|\s+und\s+|\s+\/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, i, all) => all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
}

export type SkillMatch = { skill: Skill; score: number; via: "thema" | "faehigkeit" };
type Treffer = SkillMatch & {
  /** topic words found in the skill's name or Suchwörter */
  woerter: string[];
  /** those of them that do not just name its Thema („natürliche Zahlen“ in „Sachaufgaben mit natürlichen Zahlen“) */
  eigeneWoerter: string[];
  /** their weight */
  eigen: number;
};
type SkillWoerter = { skill: Skill; own: string[]; area: string[] };
type Woerterbuch = { entries: SkillWoerter[]; gewicht: (word: string) => number };

/** A topic word that is only the start of a skill's word („Bruch“ in „Bruchzahlen“): the whole word beats it. */
const TEIL = 0.8;
/** A skill's word that is only the start of the topic word („Zahl“ in „Zahlenstrahl“): says little about the topic. */
const ANFANG = 0.5;
/** The words of a skill's Thema with its Suchwörter („Kommasetzung“ for Beistrichsetzung). */
const bereichWoerter = (s: Pick<Skill, "subject" | "area">) => [...new Set(tokens(`${s.area} ${(BEREICH_SUCHWOERTER[`${s.subject}|${s.area}`] ?? []).join(" ")}`))];
/**
 * The words of the skills a topic is compared with: name, Suchwörter (lib/themen) and Thema. A word that
 * stands at many skills of the pool („Zahlen“, „natürlich“) says little and counts less than one of a
 * single skill („Stellenwerttafel“): 1 for one skill, 0.5 for two, about 0.2 for fifteen. A word stands at
 * a skill when the skill has it or a longer word starting with it.
 */
function woerterbuch(pool: Skill[]): Woerterbuch {
  const entries = pool.map((s) => ({
    skill: s,
    own: [...new Set(tokens(`${s.name} ${s.subtopic ?? ""} ${(SUCHWOERTER[s.id] ?? []).join(" ")}`))],
    area: bereichWoerter(s),
  }));
  const memo = new Map<string, number>();
  const gewicht = (w: string) => {
    let g = memo.get(w);
    if (g === undefined) {
      const df = entries.filter((e) => e.own.some((x) => x.startsWith(w)) || e.area.some((x) => x.startsWith(w))).length;
      g = 1 / (1 + Math.log2(Math.max(1, df)));
      memo.set(w, g);
    }
    return g;
  };
  return { entries, gewicht };
}
/** The word names the topic word, as the Thema „Bruchrechnung“ names „Brüche“, but „Zahlen“ does not name „Zahlenstrahl“. */
const nennt = (w: string, x: string) => x === w || x.startsWith(w);
/** Points off for a skill outside the Thema the topic names: „Brüche addieren“ is not „Addieren und Subtrahieren“ of negative numbers. */
const FREMD = 0.5;
function treffer(w: string, words: string[], buch: Woerterbuch): number {
  let best = 0;
  for (const x of words) {
    const v = x === w ? buch.gewicht(w) : x.startsWith(w) ? buch.gewicht(w) * TEIL : w.startsWith(x) ? buch.gewicht(x) * ANFANG : 0;
    best = Math.max(best, v);
  }
  return best;
}
const nachPunkten = (a: SkillMatch, b: SkillMatch) => b.score - a.score || a.skill.sort - b.skill.sort;
function bewerten(want: string[], buch: Woerterbuch): Treffer[] {
  const out: Treffer[] = [];
  const benannt = new Set(buch.entries.filter((e) => want.some((w) => e.area.some((x) => nennt(w, x)))).map((e) => e.skill.area));
  for (const e of buch.entries) {
    let own = 0;
    let area = 0;
    let eigen = 0;
    const woerter: string[] = [];
    const eigeneWoerter: string[] = [];
    for (const w of want) {
      const o = treffer(w, e.own, buch);
      // a topic word counts once: "Brüche" in "Brüche als Anteile" does not count again for the Thema Bruchrechnung
      if (o > 0) {
        own += o;
        woerter.push(w);
        // „Bild“ in „Bildergeschichte“ is not a Bildergeschichte: only a word that names the topic word makes a pick
        if (!e.area.some((x) => nennt(w, x)) && e.own.some((x) => nennt(w, x))) {
          eigeneWoerter.push(w);
          eigen += o;
        }
      } else area += treffer(w, e.area, buch);
    }
    if (!own && !area) continue;
    // a topic naming the skill itself beats one naming only its Thema; Teilfähigkeiten only on a direct hit
    if (e.skill.parent_id && !own) continue;
    const fremd = benannt.size > 0 && !benannt.has(e.skill.area) ? FREMD : 0;
    out.push({ skill: e.skill, score: own * 2 + area + (e.skill.parent_id ? 0 : 0.5) - fremd, via: own ? "faehigkeit" : "thema", woerter, eigeneWoerter, eigen });
  }
  return out.sort(nachPunkten);
}
const poolFor = (subject: string, student?: Pick<Student, "school_type" | "klasse" | "grade">) =>
  student ? skillsForStudent(student, subject, { earlier: true }) : activeSkills().filter((s) => s.subject === subject);

/**
 * Suggests skills for a free-text topic ("Bruchrechnung", "Prozent-Sachaufgaben"). Only suggestions:
 * nothing is linked until the teacher picks it. A topic that matches no word of a skill, its Suchwörter or
 * its Thema returns nothing rather than something vague.
 */
export function matchSkills(topic: string, subject: string, opts: { student?: Pick<Student, "school_type" | "klasse" | "grade">; limit?: number } = {}): SkillMatch[] {
  const want = tokens(topic);
  if (!want.length) return [];
  return bewerten(want, woerterbuch(poolFor(subject, opts.student)))
    .slice(0, opts.limit ?? 8)
    .map(({ skill, score, via }) => ({ skill, score, via }));
}

// ---------- Stoff zuordnen: the suggestion for all topics of a Schularbeit ----------
/** At most this many topics of a Stoff get suggestions (a Stoffzettel rarely has more). */
export const STOFF_THEMEN_MAX = 15;
/** Least weight of the words that name the skill itself, so a pick is not made on „Zahlen“ alone. */
const SICHER = 0.3;
/** How far a pick must be ahead of every skill that matches the same words. */
const ABSTAND = 0.3;
/** Extra points for a skill in the Thema the other topics of the Schularbeit surely mean. */
const KONTEXT = 0.5;
/** Extra points for a skill of the student's own Schulstufe: a Schularbeit is about this year's Stoff. */
const STUFE = 0.3;
/** At most this many skills are ticked for a topic that names a whole Thema. */
const GANZES_THEMA = 8;

/**
 * The skills a topic surely means: each beats every other skill that matches the same words (besides the
 * Thema) by ABSTAND. „Brüche addieren und subtrahieren“ gives two, „Vergleichen“ alone (decimals or fractions?) none.
 */
function sicher(ranked: Treffer[]): string[] {
  const out: string[] = [];
  for (const m of ranked) {
    if (out.length >= 3) break;
    if (m.via !== "faehigkeit" || m.eigen < SICHER) continue;
    const rivals = ranked.filter((r) => r !== m && r.woerter.some((w) => m.eigeneWoerter.includes(w)));
    if (rivals.every((r) => m.score - r.score >= ABSTAND)) out.push(m.skill.id);
  }
  return out;
}

/** The key a topic is remembered under: its words without stop words and endings, so „Runden natürlicher Zahlen“ = „Runden von natürlichen Zahlen“. */
export const stoffSchluessel = (topic: string) => tokens(topic).join(" ");
/** Marks „nothing fits“ for a topic in stoff_zuordnungen. */
const NICHTS = "";

/** What teachers picked before for topics of this subject, where it was not the suggestion. */
function gemerkt(subject: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const rows = db().prepare("SELECT schluessel, skill_id FROM stoff_zuordnungen WHERE subject = ?").all(subject) as { schluessel: string; skill_id: string }[];
  for (const r of rows) out.set(r.schluessel, [...(out.get(r.schluessel) ?? []), r.skill_id]);
  return out;
}

/**
 * Remembers what the teacher picked for a topic when it was not the suggestion (also „nothing“), so the next
 * Stoffzettel with the same words gets it right away. The latest pick wins; it never links anything by itself.
 */
export function merkeZuordnung(subject: string, topic: string, skillIds: string[], teacherId: number | null) {
  const key = stoffSchluessel(topic);
  if (!key) return;
  const known = new Set(skillIds.filter((id) => db().prepare("SELECT 1 FROM skills WHERE id = ?").get(id)));
  db().transaction(() => {
    db().prepare("DELETE FROM stoff_zuordnungen WHERE subject = ? AND schluessel = ?").run(subject, key);
    const add = db().prepare("INSERT INTO stoff_zuordnungen (subject, schluessel, skill_id, teacher_id) VALUES (?, ?, ?, ?)");
    for (const id of known.size ? known : [NICHTS]) add.run(subject, key, id, teacherId);
  })();
}

export type StoffVorschlag = {
  topic: string;
  /** suggestions to show, the ticked ones first */
  skills: Skill[];
  /** ticked: what the topic surely means, or what was picked for these words before */
  best: string[];
  /** best comes from an earlier pick */
  gemerkt: boolean;
};
/**
 * Suggestions for every topic of a Schularbeit, with the ones to tick. Rule-based, without KI:
 * - a skill is ticked only when it is clearly ahead (see `sicher`);
 * - the other topics give the Thema: „Vergleichen“ next to „Runden natürlicher Zahlen“ means natural numbers;
 * - a topic that names a whole Thema („Bruchrechnung“) ticks its skills of the student's Schulstufe, unless
 *   another topic names a part of it;
 * - what a teacher picked before for the same words comes first, unless it clearly belongs to another Thema.
 * Nothing is linked until the teacher confirms.
 */
export function stoffVorschlag(topics: string[], subject: string, student: Pick<Student, "school_type" | "klasse" | "grade">): StoffVorschlag[] {
  const pool = poolFor(subject, student);
  const byId = new Map(pool.map((s) => [s.id, s]));
  const buch = woerterbuch(pool);
  const frueher = gemerkt(subject);
  const level = checkLevel(student.school_type, student.klasse, student.grade);
  const stufe = level.status === "eindeutig" ? level.schulstufe! : null;

  const erste = topics.map((topic) => {
    const want = tokens(topic);
    const ranked = want.length ? bewerten(want, buch) : [];
    const memo = frueher.get(stoffSchluessel(topic));
    const memoIds = memo?.filter((id) => byId.has(id));
    return { topic, want, ranked, memo: memo && (memoIds!.length || memo.includes(NICHTS)) ? memoIds! : null, pick: memoIds?.length ? memoIds : sicher(ranked) };
  });

  return erste.map((t, i) => {
    // how many of the other topics surely mean a skill of each Thema
    const ctx = new Map<string, number>();
    erste.forEach((o, j) => {
      if (j !== i) for (const a of new Set(o.pick.map((id) => byId.get(id)!.area))) ctx.set(a, (ctx.get(a) ?? 0) + 1);
    });
    const jetzt = (s: Skill) => stufe !== null && s.grade_min <= stufe && s.grade_max >= stufe;
    const ranked = t.ranked.map((m) => ({ ...m, score: m.score + (ctx.has(m.skill.area) ? KONTEXT : 0) + (jetzt(m.skill) ? STUFE : 0) })).sort(nachPunkten);
    // an earlier pick from another Thema („Vergleichen“ was natural numbers, now it is a fraction test) does not count
    const memoPasst = t.memo && (!ctx.size || !t.memo.length || t.memo.some((id) => ctx.has(byId.get(id)!.area)) || !ranked.some((m) => ctx.has(m.skill.area)));
    let best = memoPasst ? t.memo! : sicher(ranked);
    if (!memoPasst && !best.length && stufe !== null) best = ganzesThema(t.want, ranked, ctx, pool, stufe);
    const skills = [...new Map([...best.map((id) => byId.get(id)!), ...ranked.slice(0, 3).map((m) => m.skill)].map((s) => [s.id, s])).values()];
    return { topic: t.topic, skills, best, gemerkt: !!memoPasst };
  });
}

/** A topic that names a whole Thema („Bruchrechnung“, „Natürliche Zahlen“): its skills of the student's Schulstufe. */
function ganzesThema(want: string[], ranked: Treffer[], ctx: Map<string, number>, pool: Skill[], stufe: number): string[] {
  const area = ranked.map((m) => m.skill).find((s) => want.every((w) => bereichWoerter(s).some((x) => nennt(w, x))))?.area;
  // two or more other topics of the Schularbeit name parts of it (a heading over its parts): those parts are the Stoff
  if (!area || (ctx.get(area) ?? 0) >= 2) return [];
  return pool
    .filter((s) => s.area === area && !s.parent_id && s.grade_min <= stufe && s.grade_max >= stufe)
    .slice(0, GANZES_THEMA)
    .map((s) => s.id);
}

// ---------- settings ----------
export function getSetting(key: string, fallback: string): string {
  return (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? fallback;
}
export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
/** Setting under Mehr › Datenqualität: Flüchtigkeitsfehler marked by the teacher count milder (default on). */
export const CARELESS_SETTING = "lernstand_fluechtig_milder";
export const carelessCredit = (): boolean => getSetting(CARELESS_SETTING, "an") !== "aus";
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
  const rows = db().prepare("SELECT correct, time_ms, hints_used, solution_viewed FROM attempts WHERE task_id = ? AND final = 1 AND COALESCE(review, '') <> 'offen'").all(taskId) as {
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
