import { errorTypeLabel } from "./error-types";
import { dayOf, daysUntil } from "./exams";
import { readReport } from "./learning";
import { nextSteps, RULE_LABEL } from "./recommend";
import * as repo from "./repo";

/**
 * Short structured summary of a unit (its Lern-Dokumentation), answering six questions from what is
 * stored: the unit report, the answers with their Fehlerarten, the recommendation, homework and tests.
 * Plain database facts without AI. Each line says whether it comes from the data or was written by
 * the teacher, because only data lines (without names) may be passed on to Claude for a note.
 */
export type BriefLine = { text: string; from: "daten" | "lehrer" };
export type UnitBrief = {
  lessonId: number;
  studentId: number;
  date: string;
  subjects: string[];
  done: BriefLine[];
  good: BriefLine[];
  difficulties: BriefLine[];
  errors: BriefLine[];
  next: BriefLine[];
  dates: BriefLine[];
};
export type BriefKey = "done" | "good" | "difficulties" | "errors" | "next" | "dates";
export const BRIEF_QUESTIONS: [BriefKey, string][] = [
  ["done", "Was wurde gemacht?"],
  ["good", "Was ging gut?"],
  ["difficulties", "Wo gab es Schwierigkeiten?"],
  ["errors", "Welche Fehler kamen vor?"],
  ["next", "Was als Nächstes üben?"],
  ["dates", "Hausübung, Test, Schularbeit"],
];

const pct = (x: number) => `${Math.round(x * 100)} %`;
const data = (text: string): BriefLine => ({ text, from: "daten" });
const teacher = (text: string | null | undefined): BriefLine[] => (text?.trim() ? [{ text: text.trim(), from: "lehrer" }] : []);
const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "numeric" });
const when = (days: number) => (days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`);

export function unitBrief(lessonId: number, o: { today?: string; now?: number } = {}): UnitBrief | null {
  const lesson = repo.getLesson(lessonId);
  if (!lesson) return null;
  const today = o.today ?? dayOf(new Date(o.now ?? Date.now()));
  const r = readReport(lesson);
  const subjects = r?.subjects.length ? r.subjects : lesson.subject ? [lesson.subject] : [];

  // 1. what was done: topics with their skills, how many tasks, diagnosis
  const done: BriefLine[] = [];
  if (r && r.tasksDone > 0) {
    const byArea = new Map<string, string[]>();
    for (const s of [...r.skills].sort((a, b) => a.area.localeCompare(b.area))) byArea.set(s.area, [...(byArea.get(s.area) ?? []), s.name]);
    for (const [area, names] of byArea) done.push(data(area ? `${area}: ${names.join(", ")}` : names.join(", ")));
    done.push(data(`${r.tasksDone} ${r.tasksDone === 1 ? "Aufgabe" : "Aufgaben"} bearbeitet, ${r.correct} richtig${r.successRate !== null ? ` (${pct(r.successRate)})` : ""}`));
    if (r.worksheets.some((w) => w.kind === "diagnose")) done.push(data("Diagnose gemacht"));
  } else if (lesson.topic) done.push(data(lesson.topic));
  done.push(...teacher(lesson.activities));

  // 2. and 3. by skill state of the unit report
  const good: BriefLine[] = (r?.skills ?? []).filter((s) => s.state === "sicher").map((s) => data(`${s.name} (${s.correct} von ${s.done} richtig)`));
  good.push(...teacher(lesson.positives));
  const difficulties: BriefLine[] = (r?.skills ?? [])
    .filter((s) => s.state !== "sicher")
    .map((s) => data(`${s.name}: ${s.correct} von ${s.done} richtig${s.withHelp ? `, ${s.withHelp}× mit Hilfe` : ""}`));
  difficulties.push(...teacher(lesson.difficulties));

  // 4. errors: the stored Fehlerart (also when the teacher changed it later), else the concrete error
  const wrong = lesson.unit_id ? repo.listAttemptsForUnit(lesson.unit_id).filter((a) => !a.correct && !a.solution_viewed) : [];
  const counts = new Map<string, number>();
  for (const a of wrong) {
    const label = a.error_type && a.error_type !== "unbekannt" ? errorTypeLabel(a.error_type) : a.error_label;
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const errors: BriefLine[] = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => data(`${label} (${n}×)`));
  if (!errors.length && r) errors.push(...r.errors.slice(0, 5).map((e) => data(`${e.label} (${e.count}×)`)));
  errors.push(...teacher(lesson.mistakes));

  // 5. next: the central recommendation, for the subjects of this unit
  const steps = nextSteps(lesson.student_id, { today, now: o.now, limit: 12 }).filter((s) => !subjects.length || subjects.includes(s.skill.subject));
  const next: BriefLine[] = steps.slice(0, 3).map((s) => data(`${s.skill.name} (${s.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[s.rule]})`));
  next.push(...teacher(lesson.next_steps), ...teacher(lesson.review_topics));

  // 6. homework and the next tests
  const dates: BriefLine[] = repo
    .listHomework(lesson.student_id)
    .filter((h) => h.status === "offen")
    .map((h) => data(`Hausübung${h.subject ? ` ${h.subject}` : ""}: ${h.description}${h.due_date ? `, bis ${shortDate(h.due_date)}` : ""}`));
  dates.push(...teacher(lesson.homework_note));
  for (const t of repo.upcomingTests(today, lesson.student_id)) {
    const days = daysUntil(t.date, today);
    if (days <= 30) dates.push(data(`${t.kind} ${t.subject} ${when(days)} (${shortDate(t.date)})${t.topics?.length ? `: ${t.topics.join(", ")}` : ""}`));
  }
  return { lessonId, studentId: lesson.student_id, date: lesson.starts_at.slice(0, 10), subjects, done, good, difficulties, errors, next, dates };
}

/** Removes a student's first and last name from a text before it leaves the app. */
export function withoutNames(text: string, names: string[]): string {
  let out = text;
  for (const n of names.flatMap((x) => x.split(/\s+/)).filter((x) => x.length >= 2)) {
    out = out.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "giu"), "…");
  }
  return out;
}

/**
 * What Claude may see for a note: only lines from the data (no teacher notes), with the student's
 * names removed, and no ids or dates beyond the weekday.
 */
export function briefForAI(b: UnitBrief, studentName: string) {
  const pick = (lines: BriefLine[]) => lines.filter((l) => l.from === "daten").map((l) => withoutNames(l.text, [studentName]));
  return {
    faecher: b.subjects,
    gemacht: pick(b.done),
    gut: pick(b.good),
    schwierigkeiten: pick(b.difficulties),
    fehler: pick(b.errors),
    naechstes: pick(b.next),
    termine: pick(b.dates),
  };
}

/** A note from the facts alone (no AI), for parents ("Ihr Kind") or the student ("du"). */
export function noteFromFacts(b: UnitBrief, audience: "eltern" | "schueler"): string {
  const t = (lines: BriefLine[]) => lines.map((l) => l.text).join("; ");
  const parts: string[] = [];
  const you = audience === "schueler";
  if (b.done.length) parts.push(`${you ? "Heute hast du gearbeitet an" : "Heute haben wir gearbeitet an"}: ${t(b.done)}.`);
  if (b.good.length) parts.push(`${you ? "Gut geklappt hat" : "Gut geklappt hat"}: ${t(b.good)}.`);
  if (b.difficulties.length) parts.push(`${you ? "Noch schwierig war" : "Noch schwierig war"}: ${t(b.difficulties)}.`);
  if (b.errors.length) parts.push(`Typische Fehler: ${t(b.errors)}.`);
  if (b.next.length) parts.push(`${you ? "Als Nächstes übst du" : "Als Nächstes üben wir"}: ${t(b.next)}.`);
  if (b.dates.length) parts.push(`${you ? "Denk an" : "Bitte im Blick behalten"}: ${t(b.dates)}.`);
  return parts.join("\n");
}
