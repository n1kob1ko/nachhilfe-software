/**
 * "Was als Nächstes üben?" – the one place where the app decides this. Rule-based, no AI.
 * Rules in this order of priority:
 *   1. a Schularbeit/Test is coming up and one of its skills is not yet secure
 *   2. a skill of the current material (Aktueller Stoff) is not yet secure
 *   3. a skill is weak (below 60 %); a weak prerequisite is named as possible cause
 *   4. the same kind of error came up several times in the last 14 days
 *   5. a prerequisite of an exam, current or weak skill is not secure
 *   6. a skill was not practised for a long time (30 days)
 *   7. the next sensible skill after one that sits
 * Each skill appears once, with its highest rule; the facts of every rule that applies are listed as
 * its reason ("Schularbeit in 8 Tagen · Lernstand 54 % · 3 Fehler zuletzt").
 */
import { RECOMMENDATION_NOTE, parseTime, WEAK } from "./analysis";
import { activeMaterial } from "./current-material";
import { difficultyFor, type Difficulty } from "./curriculum";
import { errorTypeLabel } from "./error-types";
import { examReminders } from "./exams";
import { nextSkillsOf, prerequisitesOf, skillsForStudent } from "./lehrplan";
import { STATUS_THRESHOLDS } from "./mastery";
import * as repo from "./repo";
import { analyzeStudent } from "./service";

const DAY = 86_400_000;
export const LONG_AGO_DAYS = 30;
export const RECENT_ERROR_DAYS = 14;
/** A practised weak skill is checked again within this many days (Überprüfung). */
const CHECK_AFTER_DAYS = 14;

export type Rule = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const RULE_LABEL: Record<Rule, string> = { 1: "Prüfung", 2: "Aktueller Stoff", 3: "Schwäche", 4: "Fehler", 5: "Voraussetzung", 6: "Wiederholen", 7: "Weiter" };
export const RULE_TONE: Record<Rule, "red" | "amber" | "accent" | "neutral"> = { 1: "red", 2: "accent", 3: "amber", 4: "amber", 5: "amber", 6: "neutral", 7: "neutral" };

export type NextStep = {
  /** Stable key for "An … senden": rule and skill. */
  key: string;
  rule: Rule;
  skill: repo.Skill;
  mastery: number | null;
  count: number;
  difficulty: Difficulty;
  /** uebung, or ueberpruefung when a practised weak skill should now be checked. */
  kind: "uebung" | "ueberpruefung";
  /** Short facts, most important first: "Schularbeit in 8 Tagen", "Lernstand 54 %", "3 Fehler zuletzt". */
  facts: string[];
  /** The facts as one line. */
  reason: string;
  /** For a weak skill: a prerequisite that is not secure and may be the cause. */
  cause?: { skill: repo.Skill; mastery: number | null };
  /** Wrong answers on this skill in the last 14 days. */
  recentErrors: number;
  /** Most frequent kind of error on this skill recently. */
  errorType?: string;
  testId?: number;
  materialId?: number;
  /** An exercise with this skill is already sent and not finished. */
  openAssignmentId?: number;
  /** For the AI builder: a hint what the tasks should make visible. */
  focusNote?: string;
};

const pct = (m: number | null) => (m === null ? "noch nicht getestet" : `Lernstand ${Math.round(m * 100)} %`);
const when = (days: number) => (days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`);

export function nextSteps(studentId: number, o: { today: string; now?: number; limit?: number }): NextStep[] {
  const now = o.now ?? Date.now();
  const student = repo.getStudent(studentId);
  const a = analyzeStudent(studentId, now);
  if (!student || !a) return [];
  const all = repo.listSkills();
  const byId = new Map(all.map((s) => [s.id, s]));
  const alias = repo.skillAliases();
  const real = (id: string) => alias.get(id) ?? id;
  const stat = new Map(a.skills.map((s) => [s.skill.id, s]));
  const m = (id: string) => stat.get(id)?.mastery ?? null;
  const secure = (id: string) => (m(id) ?? 0) >= STATUS_THRESHOLDS.gut;
  /** Another skill in a fact: with its Thema when it is not the Thema of the recommended skill. */
  const ref = (id: string, from: repo.Skill) => {
    const s = byId.get(id);
    return !s ? id : s.area === from.area ? s.name : `${s.area} › ${s.name}`;
  };

  // recent wrong answers per skill and their most frequent kind
  const recent = new Map<string, { count: number; types: Map<string, number>; labels: Map<string, number> }>();
  for (const at of repo.listAttemptsForStudent(studentId)) {
    if (at.correct || at.solution_viewed || now - parseTime(at.created_at) > RECENT_ERROR_DAYS * DAY || parseTime(at.created_at) > now) continue;
    for (const id of new Set((at.skill_ids?.length ? at.skill_ids : at.skill_id ? [at.skill_id] : []).map(real))) {
      const r = recent.get(id) ?? { count: 0, types: new Map(), labels: new Map() };
      r.count++;
      if (at.error_type) r.types.set(at.error_type, (r.types.get(at.error_type) ?? 0) + 1);
      if (at.error_label) r.labels.set(at.error_label, (r.labels.get(at.error_label) ?? 0) + 1);
      recent.set(id, r);
    }
  }
  const top = (map: Map<string, number>) => [...map].sort((x, y) => y[1] - x[1])[0];
  const assignments = repo.listAssignments(studentId);
  const openFor = (id: string) => assignments.find((x) => !x.completed_at && x.skill_ids.includes(id));
  const lastDone = (id: string, kind: string) =>
    assignments
      .filter((x) => x.completed_at && x.kind === kind && x.note.startsWith(RECOMMENDATION_NOTE) && x.skill_ids.includes(id))
      .map((x) => parseTime(x.completed_at!))
      .sort((p, q) => q - p)[0];

  type Draft = Omit<NextStep, "facts" | "reason" | "recentErrors" | "mastery" | "difficulty" | "key" | "kind"> & { lead: string; kind?: NextStep["kind"] };
  const drafts: Draft[] = [];
  const extra = new Map<string, string[]>();
  const add = (d: Draft) => {
    if (!byId.has(d.skill.id)) return;
    const seen = drafts.find((x) => x.skill.id === d.skill.id);
    if (seen) {
      // the skill is already in with a higher rule: keep this rule's fact as another reason
      // weak (3) and error (4) facts are already in "Lernstand …" and "… Fehler zuletzt"
      if (d.rule !== 3 && d.rule !== 4 && !extra.get(d.skill.id)?.includes(d.lead) && seen.lead !== d.lead) extra.set(d.skill.id, [...(extra.get(d.skill.id) ?? []), d.lead]);
      return;
    }
    drafts.push(d);
  };

  // 1) exam ahead
  const exams = examReminders(o.today, { studentId });
  for (const e of exams) {
    const ids = [...new Set(e.skill_ids.map(real))].sort((x, y) => (m(x) ?? -1) - (m(y) ?? -1));
    for (const id of ids) {
      if (secure(id) || !byId.has(id)) continue;
      add({ rule: 1, skill: byId.get(id)!, count: m(id) === null ? 3 : 5, lead: `${e.kind || "Prüfung"} ${when(e.days)}`, testId: e.id });
    }
  }
  // 2) current material
  const material = activeMaterial(studentId);
  for (const cm of material) {
    for (const id of [...new Set(cm.skill_ids.map(real))].sort((x, y) => (m(x) ?? -1) - (m(y) ?? -1))) {
      if (secure(id) || !byId.has(id)) continue;
      add({ rule: 2, skill: byId.get(id)!, count: m(id) === null ? 3 : 5, lead: `Aktueller Stoff: ${cm.subtopic || cm.topic}`, materialId: cm.id });
    }
  }
  // 3) weak skills, with a weak prerequisite as possible cause
  const causeOf = (id: string) => {
    const weakPre = prerequisitesOf(id)
      .map(real)
      .filter((p) => byId.has(p) && m(p) !== null && !secure(p))
      .sort((x, y) => (m(x) ?? 0) - (m(y) ?? 0))[0];
    return weakPre ? { skill: byId.get(weakPre)!, mastery: m(weakPre) } : undefined;
  };
  for (const w of a.weaknesses) {
    const practiced = lastDone(w.skill.id, "uebung");
    const checked = lastDone(w.skill.id, "ueberpruefung");
    const check = !openFor(w.skill.id) && practiced !== undefined && now - practiced < CHECK_AFTER_DAYS * DAY && (!checked || checked < practiced);
    const mm = w.mastery ?? 0;
    add({
      rule: 3,
      skill: w.skill,
      count: check ? 5 : mm < 0.4 ? 10 : 8,
      kind: check ? "ueberpruefung" : "uebung",
      lead: check ? "Übung erledigt, jetzt überprüfen" : mm < STATUS_THRESHOLDS.ueben ? "kritisch" : `unter ${Math.round(WEAK * 100)} %`,
    });
  }
  // 4) the same kind of error several times recently
  for (const [id, r] of [...recent].sort((x, y) => y[1].count - x[1].count)) {
    const t = top(r.types);
    const l = top(r.labels);
    const n = t && t[1] >= 2 ? t[1] : l && l[1] >= 2 ? l[1] : 0;
    if (!n || !byId.has(id)) continue;
    // a sub-skill is more precise than its parent: prefer it when both have the error
    const skill = byId.get(id)!;
    if (!skill.parent_id && [...recent.keys()].some((x) => byId.get(x)?.parent_id === id && (recent.get(x)?.count ?? 0) >= n)) continue;
    add({ rule: 4, skill, count: 5, lead: t && t[1] >= 2 ? `${t[1]}× ${errorTypeLabel(t[0])}` : `${l![1]}× „${l![0]}“`, focusNote: l ? `Der Schüler macht häufig diesen Fehler: ${l[0]}. Baue Aufgaben ein, die genau diesen Fehler sichtbar machen.` : undefined });
  }
  // 5) prerequisites of exam, current and weak skills
  const focus = [...new Set([...exams.flatMap((e) => e.skill_ids), ...material.flatMap((x) => x.skill_ids), ...a.weaknesses.map((w) => w.skill.id)].map(real))];
  for (const id of focus) {
    for (const p of prerequisitesOf(id).map(real)) {
      if (m(p) !== null && !secure(p) && byId.has(p)) add({ rule: 5, skill: byId.get(p)!, count: 4, lead: `Voraussetzung für ${ref(id, byId.get(p)!)}` });
    }
  }
  // 6) not practised for a long time
  for (const s of a.skills.filter((x) => x.lastPracticed !== null && now - x.lastPracticed > LONG_AGO_DAYS * DAY).sort((x, y) => (x.mastery ?? 0) - (y.mastery ?? 0))) {
    add({ rule: 6, skill: s.skill, count: 4, lead: `seit ${Math.round((now - s.lastPracticed!) / DAY)} Tagen nicht geübt` });
  }
  // 7) next skill after one that sits, within the student's level
  const fitting = new Set(skillsForStudent(student, undefined, { earlier: true }).map((s) => s.id));
  for (const s of a.skills.filter((x) => x.mastery !== null && x.mastery >= STATUS_THRESHOLDS.sicher)) {
    for (const n of nextSkillsOf(s.skill.id).map(real)) {
      if (fitting.has(n) && m(n) === null && byId.has(n) && prerequisitesOf(n).map(real).every(secure)) add({ rule: 7, skill: byId.get(n)!, count: 3, lead: `${s.skill.name} sitzt` });
    }
  }

  return drafts
    .sort((x, y) => x.rule - y.rule)
    .slice(0, o.limit ?? 5)
    .map(({ lead, ...d }) => {
      const id = d.skill.id;
      // not secure yet: is a prerequisite that is not secure either the possible cause?
      if (m(id) !== null && !secure(id)) d.cause = causeOf(id);
      const r = recent.get(id);
      const t = r ? top(r.types) : undefined;
      // a weak skill leads with its Lernstand: "Lernstand 30 % (kritisch)"
      const facts = d.rule === 3 && d.kind !== "ueberpruefung" ? [`${pct(m(id))} (${lead})`] : [lead, pct(m(id))];
      // wrong answers lately, with their kind when it repeats: "3 Fehler zuletzt, 2× Vorzeichenfehler"
      if (r && r.count && !(d.rule === 4 && t && t[1] >= r.count)) {
        const kind = t && t[1] >= 2 && d.rule !== 4 ? (t[1] === r.count ? `: ${errorTypeLabel(t[0])}` : `, ${t[1]}× ${errorTypeLabel(t[0])}`) : "";
        facts.push(`${r.count} Fehler zuletzt${kind}`);
      }
      facts.push(...(extra.get(id) ?? []));
      if (d.cause) facts.push(`mögliche Ursache: ${ref(d.cause.skill.id, d.skill)} (${d.cause.mastery === null ? "nicht getestet" : `${Math.round(d.cause.mastery * 100)} %`})`);
      const kind = d.kind ?? "uebung";
      return {
        ...d,
        key: `${d.rule}:${id}`,
        kind,
        mastery: m(id),
        difficulty: kind === "ueberpruefung" ? "mittel" : difficultyFor(m(id)),
        facts,
        reason: facts.join(" · "),
        recentErrors: r?.count ?? 0,
        errorType: t?.[0],
        openAssignmentId: openFor(id)?.id,
      };
    });
}
