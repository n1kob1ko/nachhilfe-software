/** Demo data: four students with realistic history so every screen has something to show. */
import { db } from "./db";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { documentAssignment } from "./autodoc";
import { writeLearningDoc } from "./learning";
import { getUnit } from "./units";
import * as repo from "./repo";
import { schulstufe } from "./school";
import type { Difficulty } from "./curriculum";

const DAY = 86_400_000;

function localStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function sqlStamp(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}
function at(daysAgo: number, hour: number, minute = 0) {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

type Profile = {
  student: Omit<repo.StudentInput, "grade" | "teacher_id">;
  teacher: string;
  /** skill -> [mastery 8 weeks ago, mastery now] */
  skills: Record<string, [number, number]>;
  subject: string;
  lessons: { daysAgo: number; topic: string; skills: string[]; activities: string; mistakes: string; understanding: number; notes: string; next: string }[];
  todayAt: [number, number];
  todayTopic: string;
  homework: { subject: string; description: string; dueInDays: number; status: string }[];
  tests: { daysAgo: number; subject: string; kind: string; topic: string; grade: number; points: number; max: number; skills: string[]; notes: string }[];
};

const PROFILES: Profile[] = [
  {
    teacher: "Niko",
    student: {
      name: "Max Huber",
      klasse: 2,
      school: "MS Graz-St. Peter",
      school_type: "Mittelschule",
      subjects: ["Mathematik"],
      current_topics: "Bruchrechnung, Division von Brüchen",
      strengths_note: "Rechnet schnell im Kopf, arbeitet gerne mit Beispielen aus dem Alltag.",
      weaknesses_note: "Verliert bei mehrstufigen Rechnungen den Überblick.",
      goals: "Nächste Schularbeit (Bruchrechnung) mindestens Note 3.",
      notes: "Mag Fußball – Textaufgaben damit funktionieren gut.",
    },
    subject: "Mathematik",
    skills: {
      "mathe.brueche.kuerzen": [0.7, 0.92],
      "mathe.brueche.erweitern": [0.65, 0.86],
      "mathe.brueche.addieren": [0.45, 0.74],
      "mathe.brueche.subtrahieren": [0.4, 0.66],
      "mathe.brueche.multiplizieren": [0.55, 0.82],
      "mathe.brueche.dividieren": [0.2, 0.4],
    },
    lessons: [
      { daysAgo: 49, topic: "Kürzen und Erweitern", skills: ["mathe.brueche.kuerzen", "mathe.brueche.erweitern"], activities: "ggT wiederholt, 15 Kürzungsaufgaben", mistakes: "Nicht vollständig gekürzt", understanding: 3, notes: "Teilbarkeitsregeln noch unsicher.", next: "Teilbarkeitsregeln festigen, dann Addition" },
      { daysAgo: 35, topic: "Addieren mit verschiedenen Nennern", skills: ["mathe.brueche.addieren"], activities: "Gemeinsamen Nenner finden, Pizza-Modell", mistakes: "Zähler und Nenner einzeln gerechnet", understanding: 3, notes: "Mit Bild verstanden, ohne Bild noch Fehler.", next: "Subtrahieren, gemischte Übungen" },
      { daysAgo: 21, topic: "Multiplizieren und Dividieren", skills: ["mathe.brueche.multiplizieren", "mathe.brueche.dividieren"], activities: "Regeln erarbeitet, Kehrwert eingeführt", mistakes: "Kehrwert vergessen\nFalschen Bruch umgedreht", understanding: 2, notes: "Multiplikation klappt, Division noch nicht.", next: "Division mit Kehrwert intensiv üben" },
      { daysAgo: 7, topic: "Division von Brüchen", skills: ["mathe.brueche.dividieren"], activities: "Kehrwert-Merksatz, 10 Aufgaben gemeinsam", mistakes: "Kehrwert vergessen", understanding: 2, notes: "Vergisst unter Zeitdruck den Kehrwert.", next: "Division wiederholen, danach Überprüfung" },
    ],
    todayAt: [14, 0],
    todayTopic: "Division von Brüchen",
    homework: [
      { subject: "Mathematik", description: "Buch S. 84, Nr. 3–7 (Division)", dueInDays: 1, status: "offen" },
      { subject: "Mathematik", description: "Arbeitsblatt Addition gleichnamiger Brüche", dueInDays: -6, status: "erledigt" },
    ],
    tests: [{ daysAgo: 28, subject: "Mathematik", kind: "Schularbeit", topic: "Bruchrechnung I", grade: 4, points: 21, max: 40, skills: ["mathe.brueche.kuerzen", "mathe.brueche.erweitern", "mathe.brueche.addieren"], notes: "Viele Folgefehler beim Erweitern." }],
  },
  {
    teacher: "Niko",
    student: {
      name: "Anna Gruber",
      klasse: 3,
      school: "BG/BRG Klusemann",
      school_type: "Gymnasium",
      subjects: ["Deutsch"],
      current_topics: "Beistrichsetzung, das/dass",
      strengths_note: "Liest viel und gerne, guter Wortschatz.",
      weaknesses_note: "Beistrichsetzung bei Nebensätzen.",
      goals: "Weniger Rechtschreibfehler in Aufsätzen.",
      notes: "",
    },
    subject: "Deutsch",
    skills: {
      "deutsch.beistrich.aufzaehlung": [0.7, 0.8],
      "deutsch.beistrich.nebensatz": [0.45, 0.48],
      "deutsch.beistrich.infinitiv": [0.4, 0.5],
      "deutsch.recht.dasdass": [0.6, 0.72],
      "deutsch.grammatik.faelle": [0.8, 0.88],
      "deutsch.text.verstehen": [0.85, 0.9],
    },
    lessons: [
      { daysAgo: 42, topic: "Beistrich bei Aufzählungen", skills: ["deutsch.beistrich.aufzaehlung"], activities: "Regeln, Diktat", mistakes: "Beistrich vor „und/oder“ gesetzt", understanding: 4, notes: "Konzentriert, arbeitet sorgfältig mit.", next: "Haupt- und Nebensatz" },
      { daysAgo: 28, topic: "Haupt- und Nebensatz", skills: ["deutsch.beistrich.nebensatz"], activities: "Verbstellung erkannt, Konjunktionen gesammelt", mistakes: "Beistrich vor dem Nebensatz vergessen", understanding: 2, notes: "Erkennt Nebensätze nicht zuverlässig.", next: "Nebensätze markieren üben" },
      { daysAgo: 14, topic: "das / dass", skills: ["deutsch.recht.dasdass"], activities: "Ersatzprobe mit „welches“", mistakes: "das/dass verwechselt", understanding: 3, notes: "Ersatzprobe hilft sofort.", next: "Beistrich bei Nebensätzen wiederholen" },
      { daysAgo: 7, topic: "Beistrich bei Nebensätzen", skills: ["deutsch.beistrich.nebensatz", "deutsch.beistrich.infinitiv"], activities: "Eigene Sätze bilden", mistakes: "Beistrich vor dem Nebensatz vergessen\nBeistrich an falscher Stelle", understanding: 2, notes: "Gleichbleibend, braucht mehr Routine.", next: "Kurze tägliche Übungen" },
    ],
    todayAt: [15, 0],
    todayTopic: "Beistrichsetzung",
    homework: [{ subject: "Deutsch", description: "Aufsatz „Mein Lieblingsort“ – auf Beistriche achten", dueInDays: 3, status: "offen" }],
    tests: [{ daysAgo: 20, subject: "Deutsch", kind: "Test", topic: "Zeichensetzung", grade: 3, points: 14, max: 24, skills: ["deutsch.beistrich.aufzaehlung", "deutsch.beistrich.nebensatz"], notes: "" }],
  },
  {
    teacher: "Thomas",
    student: {
      name: "David Novak",
      klasse: 4,
      school: "MS Leibnitz",
      school_type: "Mittelschule",
      subjects: ["Englisch"],
      current_topics: "Present Perfect vs. Past Simple",
      strengths_note: "Spricht flüssig, guter Wortschatz.",
      weaknesses_note: "Zeitformen, unregelmäßige Verben.",
      goals: "Schularbeit im Dezember: Note 2.",
      notes: "",
    },
    subject: "Englisch",
    skills: {
      "englisch.tenses.presentsimple": [0.75, 0.88],
      "englisch.tenses.pastsimple": [0.5, 0.75],
      "englisch.tenses.presentperfect": [0.25, 0.52],
      "englisch.vocab.irregular": [0.45, 0.7],
      "englisch.reading.comprehension": [0.8, 0.86],
    },
    lessons: [
      { daysAgo: 40, topic: "Past Simple", skills: ["englisch.tenses.pastsimple", "englisch.vocab.irregular"], activities: "Irregular verbs Liste 1–30", mistakes: "Unregelmäßiges Verb regelmäßig gebildet", understanding: 3, notes: "Motiviert, lernt Vokabeln selbstständig.", next: "Present Perfect einführen" },
      { daysAgo: 26, topic: "Present Perfect", skills: ["englisch.tenses.presentperfect"], activities: "Signalwörter, have/has + 3. Form", mistakes: "Past Simple statt Present Perfect", understanding: 2, notes: "Verwechselt die beiden Zeiten.", next: "Signalwörter festigen" },
      { daysAgo: 12, topic: "Present Perfect vs. Past Simple", skills: ["englisch.tenses.presentperfect", "englisch.tenses.pastsimple"], activities: "Timeline-Übung", mistakes: "Past Simple statt Present Perfect", understanding: 3, notes: "Deutlich besser mit Timeline.", next: "Mehr gemischte Übungen" },
    ],
    todayAt: [16, 30],
    todayTopic: "Present Perfect",
    homework: [{ subject: "Englisch", description: "Workbook p. 42 + 15 irregular verbs lernen", dueInDays: 2, status: "offen" }],
    tests: [{ daysAgo: 18, subject: "Englisch", kind: "Vokabeltest", topic: "Irregular verbs", grade: 3, points: 18, max: 30, skills: ["englisch.vocab.irregular"], notes: "" }],
  },
  {
    teacher: "Thomas",
    student: {
      name: "Lena Berger",
      klasse: 5,
      school: "BRG Kepler",
      school_type: "Gymnasium",
      subjects: ["Mathematik"],
      current_topics: "Gleichungen, Prozentrechnung",
      strengths_note: "Sehr genau, schreibt Rechenwege sauber auf.",
      weaknesses_note: "Textaufgaben, Prozentrechnung vergessen.",
      goals: "Sicher durch die 5. Klasse.",
      notes: "",
    },
    subject: "Mathematik",
    skills: {
      "mathe.gleichungen.einfach": [0.7, 0.9],
      "mathe.gleichungen.klammern": [0.55, 0.78],
      "mathe.gleichungen.text": [0.35, 0.45],
      "mathe.prozent.prozentwert": [0.85, 0.7],
      "mathe.prozent.grundwert": [0.8, 0.45],
    },
    lessons: [
      { daysAgo: 45, topic: "Prozentrechnung", skills: ["mathe.prozent.prozentwert", "mathe.prozent.grundwert"], activities: "Dreisatz und Formel", mistakes: "", understanding: 4, notes: "Gut verstanden.", next: "Gleichungen" },
      { daysAgo: 24, topic: "Gleichungen mit Klammern", skills: ["mathe.gleichungen.klammern"], activities: "Klammern auflösen", mistakes: "Klammer nicht vollständig ausmultipliziert", understanding: 3, notes: "Rechnet sicher, schreibt Zwischenschritte auf.", next: "Textaufgaben" },
      { daysAgo: 10, topic: "Textaufgaben", skills: ["mathe.gleichungen.text"], activities: "Text in Gleichung übersetzen", mistakes: "Variable falsch angesetzt", understanding: 2, notes: "Braucht eine feste Strategie.", next: "Strategie-Karte für Textaufgaben" },
    ],
    todayAt: [17, 30],
    todayTopic: "Textaufgaben mit Gleichungen",
    homework: [],
    tests: [],
  },
];

export function hasData() {
  return (db().prepare("SELECT COUNT(*) AS n FROM students").get() as { n: number }).n > 0;
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function interpolate(range: [number, number] | undefined, progress: number) {
  const [from, to] = range ?? [0.6, 0.7];
  return from + (to - from) * progress;
}

/** Answers every task of an assignment with the given success probability per skill. Returns the end time. */
function simulate(aid: number, sid: number, wid: number, probFor: (skill: string) => number, startMs: number, random: () => number, unitId: number | null = null) {
  let t = startMs;
  for (const task of repo.listTasks(wid)) {
    const prob = probFor(task.skillId ?? "");
    let attemptNo = 0;
    let done = false;
    const hints = random() > prob + 0.2 ? (random() > 0.6 ? 2 : 1) : 0;
    while (!done && attemptNo < 3) {
      attemptNo++;
      const success = random() < (attemptNo === 1 ? prob : prob * 0.45 + (hints ? 0.25 : 0)) || task.type === "free";
      const wrong = task.errorMap.length ? task.errorMap[Math.floor(random() * task.errorMap.length)] : null;
      const seconds = Math.round(25 + random() * 60 + (1 - prob) * 80);
      const pause = random() < 0.05 ? 150 : 0;
      t += (seconds + pause) * 1000;
      done = success || attemptNo === 3;
      repo.recordAttempt({
        assignment_id: aid,
        task_id: task.id,
        student_id: sid,
        skill_id: task.skillId,
        attempt_no: attemptNo,
        answer: success ? "(richtig)" : (wrong?.answer ?? "(falsch)"),
        correct: success ? 1 : 0,
        final: done ? 1 : 0,
        time_ms: (seconds + pause) * 1000,
        active_ms: Math.round(seconds * (0.8 + random() * 0.2)) * 1000,
        hints_used: hints,
        solution_viewed: 0,
        error_label: success ? null : (wrong?.label ?? null),
        feedback: "",
        unit_id: unitId,
        created_at: sqlStamp(t),
      });
    }
  }
  return t;
}

export function seedDemo(random: () => number = seeded(7)) {
  const conn = db();
  const unitsToDocument: number[] = [];
  const run = conn.transaction(() => {
    for (const p of PROFILES) {
      const teacherId = (conn.prepare("SELECT id FROM teachers WHERE name = ?").get(p.teacher) as { id: number } | undefined)?.id ?? null;
      const grade = schulstufe(p.student.school_type, p.student.klasse ?? 1);
      const sid = repo.createStudent({ ...p.student, grade, teacher_id: teacherId });
      const allSkills = repo.listSkills();

      // Past lessons were units: Basis-Dokumentation, practice on the device during the unit, Lern-Dokumentation.
      p.lessons.forEach((l, i) => {
        const start = at(l.daysAgo, p.todayAt[0], p.todayAt[1]).getTime();
        const end = start + 60 * 60_000;
        const unitId = Number(
          conn
            .prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', ?, ?, ?)")
            .run(teacherId, sid, new Date(start).toISOString(), new Date(end).toISOString(), new Date(end).toISOString()).lastInsertRowid,
        );
        const latest = i === p.lessons.length - 1;
        repo.saveLesson({
          student_id: sid,
          teacher_id: teacherId,
          unit_id: unitId,
          starts_at: localStamp(new Date(start)),
          duration_min: 60,
          subject: p.subject,
          topic: l.topic,
          status: "abgeschlossen",
          activities: l.activities,
          mistakes: l.mistakes,
          understanding: l.understanding,
          tutor_notes: l.notes,
          next_steps: l.next,
          skill_ids: l.skills,
          concentration: Math.min(5, l.understanding + 1),
          motivation: 4,
          participation: Math.min(5, l.understanding + 1),
          // the most recent one is left for the teacher to complete
          reviewed_at: latest ? null : new Date(end + 3600_000).toISOString(),
        });
        const practiced = l.skills.filter((id) => hasBuiltInGenerator(id));
        if (practiced.length) {
          const skills = practiced.map((id) => allSkills.find((s) => s.id === id)!);
          const progress = Math.max(0, Math.min(1, (56 - l.daysAgo) / 56));
          const drafts = generateBuiltIn({ subject: p.subject, skills: skills.map((s) => ({ id: s.id, name: s.name })), difficulty: "leicht", count: 8, taskType: "mixed", seed: sid * 1000 + i });
          const wid = repo.createWorksheet(
            { title: `Stunde: ${l.topic}`, subject: p.subject, grade, school_type: p.student.school_type, klasse: p.student.klasse, topic: [...new Set(skills.map((s) => s.area))].join(", "), difficulty: "leicht", task_type: "mixed", kind: "uebung", source: "generator", skill_ids: practiced },
            drafts,
          );
          const aid = repo.assignWorksheet(wid, sid);
          const done = simulate(aid, sid, wid, (skill) => interpolate(p.skills[skill], progress), start + 15 * 60_000, random, unitId);
          conn.prepare("UPDATE assignments SET assigned_at = ?, started_at = ?, completed_at = ? WHERE id = ?").run(sqlStamp(start), sqlStamp(start + 15 * 60_000), sqlStamp(done), aid);
        }
        unitsToDocument.push(unitId);
      });
      repo.saveLesson({
        student_id: sid,
        teacher_id: teacherId,
        starts_at: localStamp(at(0, p.todayAt[0], p.todayAt[1])),
        duration_min: 60,
        subject: p.subject,
        topic: p.todayTopic,
        status: "geplant",
        activities: "",
        mistakes: "",
        understanding: null,
        tutor_notes: "",
        next_steps: "",
        skill_ids: [],
      });
      repo.saveLesson({
        student_id: sid,
        teacher_id: teacherId,
        starts_at: localStamp(at(-7, p.todayAt[0], p.todayAt[1])),
        duration_min: 60,
        subject: p.subject,
        topic: "",
        status: "geplant",
        activities: "",
        mistakes: "",
        understanding: null,
        tutor_notes: "",
        next_steps: "",
        skill_ids: [],
      });
      for (const h of p.homework) {
        const due = new Date(Date.now() + h.dueInDays * DAY).toISOString().slice(0, 10);
        repo.addHomework({ student_id: sid, subject: h.subject, description: h.description, due_date: due, status: h.status, notes: "" });
      }
      for (const t of p.tests) {
        repo.addTest({
          student_id: sid,
          date: new Date(Date.now() - t.daysAgo * DAY).toISOString().slice(0, 10),
          subject: t.subject,
          kind: t.kind,
          topic: t.topic,
          grade: t.grade,
          points: t.points,
          max_points: t.max,
          notes: t.notes,
          skill_ids: t.skills,
        });
      }

      // Weekly practice sheets over the last 8 weeks, answered with a skill-specific success rate.
      const skillIds = Object.keys(p.skills);
      for (let w = 0; w < 8; w++) {
        const daysAgo = 56 - w * 7 - 2;
        const progress = w / 7;
        const chosen = skillIds;
        const difficulty: Difficulty = w < 3 ? "sehr leicht" : w < 6 ? "leicht" : "mittel";
        const skills = chosen.map((id) => allSkills.find((s) => s.id === id)!).filter(Boolean);
        const drafts = generateBuiltIn({ subject: p.subject, skills: skills.map((s) => ({ id: s.id, name: s.name })), difficulty, count: chosen.length * 3, taskType: "mixed", seed: sid * 100 + w });
        const wid = repo.createWorksheet(
          { title: `Wochenübung ${w + 1}: ${[...new Set(skills.map((s) => s.area))].join(", ")}`, subject: p.subject, grade, school_type: p.student.school_type, klasse: p.student.klasse, topic: [...new Set(skills.map((s) => s.area))].join(", "), difficulty, task_type: "mixed", kind: "uebung", source: "generator", skill_ids: chosen },
          drafts,
        );
        const aid = repo.assignWorksheet(wid, sid);
        const startMs = Date.now() - daysAgo * DAY + 16 * 3600_000;
        const t = simulate(aid, sid, wid, (skill) => interpolate(p.skills[skill], progress), startMs, random);
        conn.prepare("UPDATE assignments SET assigned_at = ?, started_at = ?, completed_at = ? WHERE id = ?").run(sqlStamp(startMs - 3 * DAY), sqlStamp(startMs), sqlStamp(t), aid);
        documentAssignment(aid);
      }
    }
    // Lern-Dokumentation of each unit, oldest first, once all evidence exists
    for (const id of unitsToDocument) {
      const u = getUnit(id)!;
      writeLearningDoc(u, Date.parse(u.ended_at!));
    }
  });
  run();
}
