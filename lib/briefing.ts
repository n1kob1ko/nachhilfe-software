/**
 * Das **Tagesbriefing** (niko, 18.10.2026): für jeden Schüler, der heute dran ist, auf einen Blick der
 * letzte Stand, wo es hakt, ein Plan für die heutige Einheit mit Minuten und passende Übungen aus dem
 * Bestand.
 *
 * Es gibt zwei Fassungen:
 * - die **einfache**, nur aus den Daten der App (`einfachesBriefing`), immer da und kostenlos;
 * - die **KI-Fassung** (lib/ai/briefing.ts), auf Klick oder im Hintergrund vorbereitet (lib/briefing-auto.ts).
 *   Sie bekommt die Daten ohne Namen, darf Übungen nur aus der mitgeschickten Liste wählen, und ihre Minuten
 *   werden auf die geplante Dauer gebracht. Gespeichert wird sie je Schüler und **Datenstand** (Tabelle
 *   `briefings`, `briefingStand`): solange sich die Daten des Schülers nicht ändern, gilt sie weiter, auch an
 *   späteren Tagen, und kostet nichts; ändern sie sich, ist sie veraltet und eine neue wird fällig.
 *
 * Beide Fassungen setzen den Schwerpunkt der automatischen Vorbereitung (`Fokus`, lib/vorbereitung-auto.ts): das
 * Thema, das Heute zeigt, steht auch im Plan und im geführten Unterricht vorne.
 *
 * Das Briefing liest nur. Es schreibt nie in Lernstand, Versuche oder Dokumentationen; seine einzige
 * Tabelle ist `briefings`.
 */
import crypto from "node:crypto";
import { WEAK } from "./analysis";
import { BANK_LABEL } from "./banks";
import { bankOfSkill } from "./ai/banken";
import type { AIMeta } from "./ai/router";
import { aufgabeSchluessel, staende } from "./bewertungen";
import { schnittText } from "./bewertung-regeln";
import { parseSettings } from "./builder";
import type { TaskDraft } from "./tasks";
import { db, json } from "./db";
import { daysUntil } from "./exams";
import { masteryStatus } from "./mastery";
import { listMaterials } from "./materials";
import { heutigeEinheitenFuerSchueler } from "./planung/heute";
import { getSchuelerPlanung } from "./planung/repo";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import { nextSteps, RULE_LABEL, type NextStep } from "./recommend";
import * as repo from "./repo";
import { klassenLabel } from "./school";
import { analyzeStudent } from "./service";

// ---------- what a briefing looks like ----------

export type KandidatArt = "uebung" | "ueberpruefung" | "diagnose" | "bibliothek" | "vorlage" | "material" | "druckblatt" | "zugewiesen" | "bank";
export const KANDIDAT_LABEL: Record<KandidatArt, string> = {
  uebung: "Übung",
  ueberpruefung: "Überprüfung",
  diagnose: "Diagnose",
  bibliothek: "Bibliothek",
  vorlage: "Vorlage",
  material: "Material",
  druckblatt: "Druckblatt",
  zugewiesen: "schon zugewiesen",
  bank: "Aufgabenbank",
};

/** Eine Übung aus dem Bestand, die zum Schüler passt. `id` ist das, was die KI zurückgeben darf. */
export type Kandidat = {
  id: string;
  art: KandidatArt;
  titel: string;
  href: string;
  /** Namen der Fähigkeiten, zu denen sie passt */
  skills: string[];
  /** z. B. „10 Aufgaben · zuletzt 6/10 richtig am 14. Okt.“ */
  info: string;
  score: number;
};

/** Wie eine Übung auf der Seite verlinkt wird. */
export type UebungLink = { titel: string; href: string; art: string; info: string };
export const uebungLinks = (ks: Kandidat[]): Record<string, UebungLink> => Object.fromEntries(ks.map((k) => [k.id, { titel: k.titel, href: k.href, art: KANDIDAT_LABEL[k.art], info: k.info }]));

/** `skillId`: nur in der einfachen Fassung, die Fähigkeit eines Übungsblocks (für „Übung senden“ im geführten Unterricht) */
export type PlanSchritt = { minuten: number; titel: string; beschreibung: string; uebung: string | null; skillId?: string | null };

export type BriefingInhalt = {
  letzterStand: string[];
  woEsHakt: string[];
  schularbeit: string | null;
  plan: PlanSchritt[];
  uebungen: { id: string; warum: string }[];
  hinweis: string | null;
};

/**
 * Der Schwerpunkt der automatischen Vorbereitung (lib/vorbereitung-auto.ts `fokusAus`): das Signal, das das Thema
 * gewählt hat, oder das Paket des Lehrers. `beschreibung` enthält nie die Worte des Schülers.
 */
export type Fokus = { art: string; skill_ids: string[]; thema: string; beschreibung: string; paket_id: number | null };

export type BriefingDaten = {
  student: repo.Student;
  /** heute in Europe/Vienna, YYYY-MM-DD */
  datum: string;
  /** die geplante Dauer der heutigen Einheit */
  minuten: number;
  platzId: number | null;
  /** „14:00–15:40“, wenn es einen Platz gibt */
  zeit: string | null;
  analysis: NonNullable<ReturnType<typeof analyzeStudent>>;
  schritte: NextStep[];
  /** die letzten drei Dokumentationen von Einheiten, neueste zuerst */
  doku: repo.Lesson[];
  /** Lernverlauf: die letzten acht Einträge (Einheiten und selbstständig geübt), neueste zuerst */
  verlauf: repo.Lesson[];
  /** die nächste geplante Schularbeit in den nächsten 60 Tagen */
  schularbeit: (repo.TestResult & { days: number }) | null;
  /** offene Hausübungen */
  hausuebungen: repo.Homework[];
  kandidaten: Kandidat[];
  /** der Schwerpunkt der automatischen Vorbereitung, null ohne */
  fokus: Fokus | null;
  /** Stand der Daten (`briefingStand`): ändert er sich, ist ein gespeichertes Briefing nicht mehr aktuell */
  stand: string;
};

const clip = (s: string, n = 300) => {
  // one line per entry: separate lines become "; "
  const t = s.trim().replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const pctText = (m: number | null) => (m === null ? "noch nicht getestet" : `${Math.round(m * 100)} %`);
/** „15. Okt.“ aus „2026-10-15…“ */
export const datumKurz = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "UTC" });
const wann = (days: number) => (days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`);

// ---------- the data ----------

/**
 * Der Stand der Daten, aus denen ein Briefing entsteht: Dokumentationen, Schularbeiten und Antworten (der Lernstand
 * kommt aus ihnen), Hausübungen, Übungen, aktueller Stoff, die Themen im Profil und was der Schüler geschrieben hat.
 * Nur Zählungen, Zeitpunkte und ein Prüfwert, kein Inhalt.
 */
export function datenStand(studentId: number): string {
  const one = (sql: string) => JSON.stringify(db().prepare(sql).get(studentId));
  const teile = [
    one("SELECT COUNT(*) AS n, MAX(id) AS id, MAX(COALESCE(reviewed_at, '')) AS r FROM lessons WHERE student_id = ? AND status = 'abgeschlossen'"),
    one("SELECT COUNT(*) AS n, MAX(id) AS id, GROUP_CONCAT(status || date, ',') AS s FROM tests WHERE student_id = ?"),
    one("SELECT COUNT(*) AS n, MAX(id) AS id FROM attempts WHERE student_id = ?"),
    one("SELECT COUNT(*) AS n, MAX(id) AS id, GROUP_CONCAT(status, '') AS s FROM homework WHERE student_id = ?"),
    one("SELECT COUNT(*) AS n, MAX(id) AS id, COUNT(completed_at) AS fertig FROM assignments WHERE student_id = ?"),
    one("SELECT COUNT(*) AS n, MAX(id) AS id, GROUP_CONCAT(COALESCE(ended_at, '') || skill_ids, ',') AS s FROM current_material WHERE student_id = ?"),
    one("SELECT MAX(updated_at) AS w FROM schueler_wuensche WHERE student_id = ?"),
    one("SELECT MAX(updated_at) AS n FROM schueler_notizen WHERE student_id = ?"),
    crypto.createHash("sha1").update(repo.getStudent(studentId)?.current_topics ?? "").digest("hex").slice(0, 8),
  ];
  return crypto.createHash("sha1").update(teile.join("|")).digest("hex").slice(0, 16);
}

/**
 * Der Stand, unter dem ein Briefing gespeichert und wiederverwendet wird: der Datenstand, dazu wie nah die nächste
 * Prüfung ist (mehr als 14 Tage, bis 14, bis 7, bis 3: der Plan ändert sich daran) und der Schwerpunkt der
 * Vorbereitung. Er hängt nicht am Tag: an einem späteren Tag mit denselben Daten gilt dasselbe Briefing.
 */
export function briefingStand(studentId: number, o: { schularbeitTage: number | null; fokus: Fokus | null }): string {
  const t = o.schularbeitTage;
  const naehe = t === null || t > 14 ? "-" : t > 7 ? "14" : t > 3 ? "7" : "3";
  const f = o.fokus ? `${o.fokus.art}:${o.fokus.paket_id ?? ""}:${[...o.fokus.skill_ids].sort().join(",")}:${o.fokus.thema}` : "";
  return crypto.createHash("sha1").update(`${datenStand(studentId)}|${naehe}|${f}`).digest("hex").slice(0, 16);
}

/** Die geplante Dauer heute: der Platz im Wochenplan, sonst die von Hand geplante Einheit, sonst die Vorgabe des Schülers. */
function heute(studentId: number, now: Date, platzId: number | null): { minuten: number; platzId: number | null; zeit: string | null } {
  const plaetze = heutigeEinheitenFuerSchueler(studentId, now);
  const platz = plaetze.find((p) => p.id === platzId) ?? plaetze.find((p) => p.unit_id === null) ?? plaetze[0];
  if (platz) return { minuten: platz.geplante_dauer, platzId: platz.id, zeit: platz.zeit_label };
  const datum = wienerDatum(now);
  const hand = repo.lessonsBetween(`${datum}T00:00`, `${tagAddieren(datum, 1)}T00:00`).find((l) => l.student_id === studentId && l.status === "geplant");
  if (hand) return { minuten: hand.duration_min, platzId: null, zeit: hand.starts_at.slice(11, 16) || null };
  return { minuten: getSchuelerPlanung(studentId)?.geplante_dauer ?? 100, platzId: null, zeit: null };
}

/**
 * Die Fähigkeiten, um die es heute gehen sollte, mit Gewicht: die Empfehlungen der App zuerst, dann die
 * Fähigkeiten der nächsten Schularbeit, die schwächsten Fähigkeiten und was zuletzt dran war.
 */
function fokus(d: Pick<BriefingDaten, "schritte" | "schularbeit" | "analysis" | "doku" | "fokus">): Map<string, number> {
  const w = new Map<string, number>();
  const add = (id: string, g: number) => w.set(id, Math.max(w.get(id) ?? 0, g));
  // the topic the automatic preparation chose comes first
  for (const id of d.fokus?.skill_ids ?? []) add(id, 11);
  d.schritte.forEach((s, i) => add(s.skill.id, 10 - i));
  if (d.schularbeit && d.schularbeit.days <= 30) for (const id of d.schularbeit.skill_ids) add(id, 9);
  d.analysis.weaknesses.slice(0, 5).forEach((s, i) => add(s.skill.id, 6 - i));
  for (const id of d.doku[0]?.skill_ids ?? []) add(id, 3);
  return w;
}

/**
 * Passende Übungen aus dem Bestand: freigegebene Übungen und Einträge der Bibliothek, Vorlagen, Material
 * und Druckblätter, schon zugewiesene offene Übungen und die Aufgabenbanken. „Passend“ heißt: eine
 * ihrer Fähigkeiten ist eine Fokus-Fähigkeit, deren Teilfähigkeit oder deren Oberfähigkeit.
 */
export function kandidaten(student: repo.Student, gewicht: Map<string, number>, limit = 15): Kandidat[] {
  if (!gewicht.size) return [];
  const skills = new Map(repo.listSkills().map((s) => [s.id, s]));
  const name = (id: string) => skills.get(id)?.name ?? id;
  /** das Gewicht einer Fähigkeit: sie selbst, ihre Oberfähigkeit oder eine Teilfähigkeit im Fokus */
  const score = (id: string) => {
    const s = skills.get(id);
    let g = gewicht.get(id) ?? 0;
    if (s?.parent_id) g = Math.max(g, (gewicht.get(s.parent_id) ?? 0) - 1);
    for (const [fid, fg] of gewicht) if (skills.get(fid)?.parent_id === id) g = Math.max(g, fg - 1);
    return g;
  };
  const passend = (ids: string[]) => {
    const treffer = ids.filter((id) => score(id) > 0);
    return { treffer, score: Math.max(0, ...treffer.map(score)) };
  };
  const faecher = student.subjects;
  const fachPasst = (f: string) => !faecher.length || !f || faecher.includes(f);
  const out: Kandidat[] = [];

  // Archived copies still count as "schon bearbeitet", but never as open work.
  const zuweisungen = repo.listAssignments(student.id, { archiv: "alle" });
  const offen = new Set(zuweisungen.filter((a) => !a.completed_at && !a.archiviert).map((a) => a.worksheet_id));
  const zuletzt = new Map<number, (typeof zuweisungen)[number]>();
  for (const a of zuweisungen) if (a.completed_at && !zuletzt.has(a.worksheet_id)) zuletzt.set(a.worksheet_id, a);

  for (const a of zuweisungen.filter((x) => !x.completed_at && !x.archiviert)) {
    const p = passend(a.skill_ids);
    if (!p.treffer.length) continue;
    out.push({
      id: `Z${a.id}`,
      art: "zugewiesen",
      titel: a.title,
      href: `/schueler/${student.id}/ergebnis/${a.id}`,
      skills: p.treffer.map(name),
      info: `${a.task_count} Aufgaben · zugewiesen am ${datumKurz(a.assigned_at)}, ${a.done_count} bearbeitet`,
      score: p.score + 2,
    });
  }
  for (const w of repo.listWorksheets()) {
    if (w.status !== "freigegeben" || offen.has(w.id) || !fachPasst(w.subject)) continue;
    const p = passend(w.skill_ids);
    if (!p.treffer.length) continue;
    const vorher = zuletzt.get(w.id);
    out.push({
      id: `U${w.id}`,
      art: w.kind,
      titel: w.title,
      href: `/uebungen/${w.id}`,
      skills: p.treffer.map(name),
      info: [`${w.task_count} ${w.task_count === 1 ? "Aufgabe" : "Aufgaben"}`, w.difficulty, vorher ? `schon bearbeitet am ${datumKurz(vorher.completed_at!)}: ${vorher.correct_count}/${vorher.task_count} richtig` : ""].filter(Boolean).join(" · "),
      // für diesen Schüler gemacht: zuerst; schon bearbeitet: weiter hinten
      score: p.score + (w.student_id === student.id ? 1 : 0) - (vorher ? 2 : 0),
    });
  }
  // the Aufgabenbibliothek: single saved tasks, after whole exercises; well-rated ones before the others, badly rated
  // ones never (lib/bewertungen.ts)
  const bibliothek = db()
    .prepare(
      `SELECT w.id, w.title, w.subject, w.skill_ids, w.difficulty, t.type, t.prompt, t.data, t.answer FROM worksheets w JOIN tasks t ON t.worksheet_id = w.id
       WHERE w.kind = 'bibliothek' AND w.status = 'freigegeben' AND w.archived_at IS NULL`,
    )
    .all() as { id: number; title: string; subject: string; skill_ids: string; difficulty: string; type: TaskDraft["type"]; prompt: string; data: string; answer: string }[];
  const schluessel = bibliothek.map((b) => aufgabeSchluessel({ type: b.type, prompt: b.prompt, data: json(b.data, {}), answer: json(b.answer, {}) }));
  const bewertung = staende(schluessel);
  for (const [k, b] of bibliothek.entries()) {
    if (!fachPasst(b.subject)) continue;
    const st = bewertung.get(schluessel[k]);
    if (st?.ausgeblendet) continue;
    let ids: string[] = [];
    try {
      ids = JSON.parse(b.skill_ids || "[]") as string[];
    } catch {
      ids = [];
    }
    const p = passend(ids);
    if (!p.treffer.length) continue;
    out.push({
      id: `B${b.id}`,
      art: "bibliothek",
      titel: b.title,
      href: `/uebungen/bibliothek/${b.id}`,
      skills: p.treffer.map(name),
      info: ["eine Aufgabe aus der Bibliothek", b.difficulty, st?.gut ? `gut bewertet (${schnittText(st)} Sterne)` : ""].filter(Boolean).join(" · "),
      score: p.score - 1 + (st?.gut ? 1 : 0),
    });
  }
  for (const t of repo.listTemplates()) {
    if (!fachPasst(t.subject)) continue;
    const p = passend(parseSettings(t.settings).skillIds ?? []);
    if (!p.treffer.length) continue;
    out.push({ id: `V${t.id}`, art: "vorlage", titel: t.name, href: `/uebungen/neu?schueler=${student.id}`, skills: p.treffer.map(name), info: `Vorlage · ${t.used_count}× verwendet`, score: p.score - 1 });
  }
  for (const m of listMaterials()) {
    if ((m.student_id !== null && m.student_id !== student.id) || !fachPasst(m.subject)) continue;
    const p = passend(m.skill_ids);
    if (!p.treffer.length) continue;
    out.push({
      id: `M${m.id}`,
      art: m.kind === "druckblatt" ? "druckblatt" : "material",
      titel: m.title,
      href: `/mehr/material/${m.id}`,
      skills: p.treffer.map(name),
      info: [m.kind === "druckblatt" ? "Druckblatt" : "Material", m.topic].filter(Boolean).join(" · "),
      score: p.score + (m.student_id === student.id ? 1 : 0) - 1,
    });
  }
  const banken = new Set<string>();
  for (const [id, g] of gewicht) {
    const bank = bankOfSkill(id);
    if (!bank || banken.has(bank)) continue;
    banken.add(bank);
    out.push({ id: `A-${bank}`, art: "bank", titel: BANK_LABEL[bank], href: `/uebungen/neu?schueler=${student.id}&skill=${encodeURIComponent(id)}`, skills: [name(id)], info: "neue Aufgaben aus der Bank", score: g - 1 });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

/**
 * Alles, was ein Briefing braucht; null, wenn es den Schüler nicht gibt. Liest nur. `fokus`: der Schwerpunkt der
 * automatischen Vorbereitung (lib/vorbereitung-auto.ts `fokusAus`), sonst keiner.
 */
export function briefingDaten(studentId: number, o: { now?: Date; platzId?: number | null; fokus?: Fokus | null } = {}): BriefingDaten | null {
  const now = o.now ?? new Date();
  const student = repo.getStudent(studentId);
  const analysis = student ? analyzeStudent(studentId, now.getTime()) : null;
  if (!student || !analysis) return null;
  const datum = wienerDatum(now);
  const lessons = repo.listLessons(studentId).filter((l) => l.status === "abgeschlossen");
  const doku = lessons.filter((l) => l.kind === "stunde").slice(0, 3);
  const schularbeit =
    repo
      .upcomingTests(datum, studentId)
      .map((t) => ({ ...t, days: daysUntil(t.date, datum) }))
      .find((t) => t.days <= 60) ?? null;
  const schritte = nextSteps(studentId, { today: datum, now: now.getTime(), limit: 5 });
  const hausuebungen = (db().prepare("SELECT h.* FROM homework h WHERE h.student_id = ? AND h.status = 'offen' AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.id = h.assignment_id AND a.completed_at IS NOT NULL) ORDER BY h.due_date IS NULL, h.due_date").all(studentId) as repo.Homework[]).slice(0, 3);
  const f = o.fokus ?? null;
  const basis = { schritte, schularbeit, analysis, doku, fokus: f };
  return {
    student,
    datum,
    ...heute(studentId, now, o.platzId ?? null),
    analysis,
    schritte,
    doku,
    verlauf: lessons.slice(0, 8),
    schularbeit,
    hausuebungen,
    kandidaten: kandidaten(student, fokus(basis)),
    fokus: f,
    stand: briefingStand(studentId, { schularbeitTage: schularbeit?.days ?? null, fokus: f }),
  };
}

// ---------- minutes ----------

/**
 * Teilt `gesamt` Minuten im Verhältnis von `werte` auf. Jeder Schritt bekommt mindestens einen Teil;
 * gerundet wird auf 5 Minuten, wenn es aufgeht, sonst auf ganze Minuten. Die Summe ist immer `gesamt`.
 */
export function verteileMinuten(werte: number[], gesamt: number): number[] {
  const n = werte.length;
  if (!n || gesamt <= 0) return werte.map(() => 0);
  const schritt = gesamt % 5 === 0 && gesamt >= 5 * n ? 5 : 1;
  const teile = Math.floor(gesamt / schritt);
  if (teile < n) return werte.map((_, i) => (i < gesamt ? 1 : 0));
  const sicher = werte.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  // without a single usable value every step gets the same
  const basis = sicher.some((w) => w > 0) ? sicher : sicher.map(() => 1);
  const summe = basis.reduce((a, b) => a + b, 0);
  const roh = basis.map((w) => (w / summe) * teile);
  const ganz = roh.map((r) => Math.max(1, Math.round(r)));
  // the rest goes to (or comes from) the largest steps
  let rest = teile - ganz.reduce((a, b) => a + b, 0);
  const reihenfolge = ganz.map((_, i) => i).sort((a, b) => roh[b] - roh[a]);
  for (let k = 0; rest !== 0 && k < 10 * n; k++) {
    const i = reihenfolge[k % n];
    if (rest > 0) {
      ganz[i]++;
      rest--;
    } else if (ganz[i] > 1) {
      ganz[i]--;
      rest++;
    }
  }
  return ganz.map((g) => g * schritt);
}

// ---------- the simple version, from the data alone ----------

/**
 * Die beste Übung aus dem Bestand für diese Fähigkeiten, oder null: zuerst freigegebene und zugewiesene Übungen,
 * Bibliothek, Vorlagen und Material, erst dann neue Aufgaben aus einer Aufgabenbank.
 */
function uebungFuer(d: BriefingDaten, skillNamen: string[], schon: Set<string>): string | null {
  const passt = (c: Kandidat) => !schon.has(c.id) && c.skills.some((s) => skillNamen.includes(s));
  const k = d.kandidaten.find((c) => c.art !== "bank" && passt(c)) ?? d.kandidaten.find(passt);
  if (!k) return null;
  schon.add(k.id);
  return k.id;
}

export function schularbeitText(d: Pick<BriefingDaten, "schularbeit">): string | null {
  const t = d.schularbeit;
  if (!t) return null;
  const stoff = t.topics?.length ? t.topics.join(", ") : t.topic;
  return `${t.title || `${t.kind} ${t.subject}`} am ${datumKurz(t.date)} (${wann(t.days)})${stoff ? `, Stoff: ${stoff}` : ""}`;
}

/** Steht unter „Wo es hakt“, wenn die Daten nichts zeigen. */
export const KEINE_SCHWACHSTELLE = "In den Daten ist keine Schwachstelle zu sehen.";

/** Das Briefing ohne KI: nur, was in den Daten steht. */
export function einfachesBriefing(d: BriefingDaten): BriefingInhalt {
  const letzte = d.doku[0];
  const letzterStand: string[] = [];
  if (letzte) {
    letzterStand.push(`${datumKurz(letzte.starts_at)} · ${[letzte.subject, letzte.topic].filter(Boolean).join(": ")}${letzte.understanding ? ` · Verständnis ${letzte.understanding}/5` : ""}`);
    if (letzte.activities.trim()) letzterStand.push(`Gemacht: ${clip(letzte.activities, 200)}`);
    if (letzte.positives.trim()) letzterStand.push(`Gut: ${clip(letzte.positives, 200)}`);
    if (letzte.tutor_notes.trim()) letzterStand.push(`Beobachtungen: ${clip(letzte.tutor_notes, 200)}`);
    if (letzte.next_steps.trim()) letzterStand.push(`Nächstes Mal: ${clip(letzte.next_steps, 200)}`);
    if (letzte.homework_note.trim()) letzterStand.push(`Hausübung: ${clip(letzte.homework_note, 200)}`);
    const selbst = d.verlauf.filter((l) => l.kind === "selbststaendig" && l.starts_at > letzte.starts_at).length;
    if (selbst) letzterStand.push(`Seitdem selbstständig geübt: ${selbst} ${selbst === 1 ? "Übung" : "Übungen"}`);
  } else letzterStand.push("Noch keine Dokumentation einer Einheit.");

  // the app's weaknesses; with little evidence yet, the skills below the weak mark
  const schwach = d.analysis.weaknesses.length ? d.analysis.weaknesses : d.analysis.skills.filter((s) => s.mastery !== null && s.mastery < WEAK).sort((a, b) => a.mastery! - b.mastery!);
  const woEsHakt: string[] = [
    ...schwach.slice(0, 3).map((s) => `${s.skill.name}: ${pctText(s.mastery)} (${masteryStatus(s.mastery)})`),
    ...d.analysis.errors.slice(0, 3).map((e) => `Fehler „${e.label}“ ${e.count}×`),
    ...(letzte?.difficulties.trim() ? [`Zuletzt schwierig: ${clip(letzte.difficulties, 200)}`] : []),
  ];
  if (!woEsHakt.length) woEsHakt.push(KEINE_SCHWACHSTELLE);

  const schon = new Set<string>();
  const bloecke: { gewicht: number; titel: string; beschreibung: string; uebung: string | null; skillId?: string | null }[] = [];
  bloecke.push({
    gewicht: 1,
    titel: "Einstieg und Wiederholung",
    beschreibung: clip(letzte?.next_steps || letzte?.review_topics || (letzte?.topic ? `Kurz wiederholen: ${letzte.topic}` : "Kurz wiederholen, was zuletzt geübt wurde."), 200),
    uebung: null,
  });
  const hu = d.hausuebungen[0];
  if (hu) bloecke.push({ gewicht: 0.5, titel: "Hausübung kontrollieren", beschreibung: clip(hu.description, 160), uebung: null });
  // sonst die Hausübung, die in der letzten Dokumentation steht (z. B. aus dem Import der Dokumentation)
  else if (letzte?.homework_note.trim()) bloecke.push({ gewicht: 0.5, titel: "Hausübung kontrollieren", beschreibung: clip(letzte.homework_note, 160), uebung: null });
  const t = d.schularbeit;
  if (t && t.days <= 14) {
    const namen = t.skill_ids.map((id) => d.analysis.skills.find((s) => s.skill.id === id)?.skill.name ?? "").filter(Boolean);
    bloecke.push({ gewicht: 2.5, titel: "Schularbeit vorbereiten", beschreibung: schularbeitText(d)!, uebung: uebungFuer(d, namen, schon), skillId: t.skill_ids[0] ?? null });
  }
  // the topic of the automatic preparation first (the Schularbeit block already covers a near Prüfung)
  const f = d.fokus;
  const fokusIds = new Set(f?.skill_ids ?? []);
  const name = (id: string) => d.analysis.skills.find((s) => s.skill.id === id)?.skill.name ?? repo.getSkill(id)?.name ?? "";
  if (f && !(f.art === "pruefung" && t && t.days <= 14)) {
    const namen = f.skill_ids.map(name).filter(Boolean);
    bloecke.push({ gewicht: 2, titel: `Üben: ${f.thema || namen[0] || "Schwerpunkt"}`, beschreibung: clip(f.beschreibung, 200), uebung: namen.length ? uebungFuer(d, namen, schon) : null, skillId: f.skill_ids[0] ?? null });
  }
  const weitere = d.schritte.filter((x) => !(t && t.days <= 14 && x.rule === 1) && !fokusIds.has(x.skill.id));
  for (const s of weitere.slice(0, f && !(f.art === "pruefung" && t && t.days <= 14) ? 1 : 2)) {
    bloecke.push({ gewicht: 2, titel: `Üben: ${s.skill.name}`, beschreibung: `${RULE_LABEL[s.rule]}: ${s.reason}`, uebung: uebungFuer(d, [s.skill.name], schon), skillId: s.skill.id });
  }
  if (bloecke.length === 1) bloecke.push({ gewicht: 2, titel: "Üben", beschreibung: "Weiter am aktuellen Stoff.", uebung: d.kandidaten[0]?.id ?? null });
  bloecke.push({ gewicht: 0.5, titel: "Abschluss", beschreibung: "Kurz zusammenfassen, Hausübung festlegen, dokumentieren.", uebung: null });
  const minuten = verteileMinuten(
    bloecke.map((b) => b.gewicht),
    d.minuten,
  );

  return {
    letzterStand,
    woEsHakt,
    schularbeit: schularbeitText(d),
    plan: bloecke.map((b, i) => ({ minuten: minuten[i], titel: b.titel, beschreibung: b.beschreibung, uebung: b.uebung, ...(b.skillId ? { skillId: b.skillId } : {}) })),
    uebungen: d.kandidaten.slice(0, 5).map((k) => ({ id: k.id, warum: `passt zu ${k.skills.join(", ")}` })),
    hinweis: null,
  };
}

// ---------- stored KI briefings ----------

export type GespeichertesBriefing = {
  id: number;
  studentId: number;
  datum: string;
  minuten: number;
  stand: string;
  inhalt: BriefingInhalt;
  /** wie viele Vorschläge der KI verworfen wurden (Übung nicht im Bestand) */
  verworfen: number;
  /** die Übungen, auf die es sich bezieht, wie sie beim Erstellen hießen (der Bestand kann sich seither ändern) */
  links: Record<string, UebungLink>;
  createdAt: string;
  /** was der Aufruf laut Protokoll gekostet hat */
  kosten: { usd: number; tokensEin: number; tokensAus: number; denken: number | null; modell: string; anbieter: string } | null;
};

type Zeile = { id: number; student_id: number; datum: string; minuten: number; stand: string; inhalt: string; verworfen: number; call_id: number | null; created_at: string };

function alsBriefing(z: Zeile): GespeichertesBriefing {
  const gespeichert = JSON.parse(z.inhalt) as { inhalt: BriefingInhalt; links?: Record<string, UebungLink> };
  const call = z.call_id
    ? (db().prepare("SELECT cost_usd, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, thinking_tokens, model, provider FROM ai_calls WHERE id = ?").get(z.call_id) as
        | { cost_usd: number; input_tokens: number; cache_write_tokens: number; cache_read_tokens: number; output_tokens: number; thinking_tokens: number | null; model: string; provider: string }
        | undefined)
    : undefined;
  return {
    id: z.id,
    studentId: z.student_id,
    datum: z.datum,
    minuten: z.minuten,
    stand: z.stand,
    inhalt: gespeichert.inhalt,
    verworfen: z.verworfen,
    links: gespeichert.links ?? {},
    createdAt: z.created_at,
    kosten: call
      ? { usd: call.cost_usd, tokensEin: call.input_tokens + call.cache_write_tokens + call.cache_read_tokens, tokensAus: call.output_tokens, denken: call.thinking_tokens, modell: call.model, anbieter: call.provider }
      : null,
  };
}

/**
 * Das gespeicherte KI-Briefing dieses Schülers. Mit `stand` das zu genau diesem Datenstand (`briefingStand`): es gilt,
 * an welchem Tag es auch entstand. Ohne `stand` das neueste, auch ein veraltetes (Hinweis „veraltet“). Null ohne.
 */
export function gespeichertesBriefing(studentId: number, o: { stand?: string } = {}): GespeichertesBriefing | null {
  const z = (
    o.stand !== undefined
      ? db().prepare("SELECT * FROM briefings WHERE student_id = ? AND stand = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(studentId, o.stand)
      : db().prepare("SELECT * FROM briefings WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(studentId)
  ) as Zeile | undefined;
  return z ? alsBriefing(z) : null;
}

/**
 * Ein gespeichertes KI-Briefing für heute: die Schularbeit mit dem Abstand von heute (das Datum kommt immer aus der
 * App), und an einem Tag mit anderer geplanter Dauer die Minuten des Plans anteilig darauf gebracht.
 */
export function fuerHeute(b: GespeichertesBriefing, d: Pick<BriefingDaten, "minuten" | "schularbeit">): BriefingInhalt {
  const plan = b.inhalt.plan;
  const minuten = b.minuten === d.minuten || !plan.length ? plan.map((p) => p.minuten) : verteileMinuten(plan.map((p) => p.minuten), d.minuten);
  return { ...b.inhalt, schularbeit: schularbeitText(d), plan: plan.map((p, i) => ({ ...p, minuten: minuten[i] })) };
}

function speichern(d: BriefingDaten, teacherId: number | null, inhalt: BriefingInhalt, verworfen: number, callId: number | null, now: Date): GespeichertesBriefing {
  // at most one per student and day: a newer one replaces today's (its data state is older); earlier days stay
  db()
    .prepare(
      `INSERT INTO briefings (student_id, teacher_id, datum, platz_id, minuten, stand, inhalt, daten, verworfen, call_id, created_at)
       VALUES (@student_id, @teacher_id, @datum, @platz_id, @minuten, @stand, @inhalt, @daten, @verworfen, @call_id, @created_at)
       ON CONFLICT(student_id, datum) DO UPDATE SET teacher_id = excluded.teacher_id, platz_id = excluded.platz_id, minuten = excluded.minuten, stand = excluded.stand,
         inhalt = excluded.inhalt, daten = excluded.daten, verworfen = excluded.verworfen, call_id = excluded.call_id, created_at = excluded.created_at`,
    )
    .run({
      student_id: d.student.id,
      teacher_id: teacherId,
      datum: d.datum,
      platz_id: d.platzId,
      minuten: d.minuten,
      stand: d.stand,
      inhalt: JSON.stringify({ inhalt, links: uebungLinks(d.kandidaten.filter((k) => inhalt.uebungen.some((u) => u.id === k.id) || inhalt.plan.some((p) => p.uebung === k.id))) }),
      // the data version and the focus the KI version was made from
      daten: JSON.stringify({ einfach: einfachesBriefing(d), fokus: d.fokus }),
      verworfen,
      call_id: callId,
      created_at: now.toISOString(),
    });
  return gespeichertesBriefing(d.student.id, { stand: d.stand })!;
}

// ---------- asking the KI ----------

export type BriefingErgebnis = { ok: true; briefing: GespeichertesBriefing; neu: boolean } | { ok: false; error: string };

/**
 * One request per student at a time: a double click, or the click while the briefing is prepared in the background,
 * waits for the running one instead of paying twice.
 */
const laufend = ((globalThis as unknown as { __briefingLaufend?: Map<string, Promise<BriefingErgebnis>> }).__briefingLaufend ??= new Map());

/** Läuft für diesen Schüler gerade eine Anfrage? */
export const briefingLaeuft = (studentId: number) => laufend.has(String(studentId));

/**
 * Das KI-Briefing: das gespeicherte zum jetzigen Datenstand, wenn es eins gibt (kostet nichts, auch von einem
 * früheren Tag), sonst eine neue Anfrage. `neu` fragt auch dann neu („Neu erstellen“). Läuft für diesen Schüler
 * schon eine Anfrage, wird auf sie gewartet. Ohne KI, mit leerem Budget oder bei einem Fehler kommt eine Meldung
 * zurück; die einfache Fassung bleibt dann stehen. `fokus`: der Schwerpunkt der Vorbereitung; ohne Angabe der von
 * heute (lib/heute.ts `fokusHeute`).
 */
export async function erstelleBriefing(studentId: number, teacherId: number | null, o: { neu?: boolean; platzId?: number | null; now?: Date; fokus?: Fokus | null } = {}): Promise<BriefingErgebnis> {
  const now = o.now ?? new Date();
  const key = String(studentId);
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<BriefingErgebnis> => {
    try {
      const fokus = o.fokus !== undefined ? o.fokus : (await import("./heute")).fokusHeute(studentId, teacherId, now);
      const d = briefingDaten(studentId, { now, platzId: o.platzId, fokus });
      if (!d) return { ok: false, error: "Schüler nicht gefunden." };
      if (!o.neu) {
        const da = gespeichertesBriefing(studentId, { stand: d.stand });
        if (da) return { ok: true, briefing: da, neu: false };
      }
      const { kiBriefing } = await import("./ai/briefing");
      const meta: AIMeta = { teacherId, studentId, trigger: "briefing" };
      const out = await kiBriefing(d, meta);
      if (!out.ok) return { ok: false, error: out.error };
      return { ok: true, briefing: speichern(d, teacherId, out.inhalt, out.verworfen, out.callId, now), neu: true };
    } catch (e) {
      console.error("[Briefing]", e instanceof Error ? e.message : e);
      return { ok: false, error: "Das Briefing konnte nicht erstellt werden." };
    }
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}

/** Für die Anzeige: die Kurzbeschreibung des Schülers ohne Namen (Schulart, Klasse, Schulstufe, Fächer). */
export function schuelerZeile(s: repo.Student): string {
  return [klassenLabel(s.school_type, s.klasse), s.grade ? `Schulstufe ${s.grade}` : "", s.subjects.join(", ")].filter(Boolean).join(" · ");
}
