/**
 * Readable CSV exports for the "Datenexport" page. Each dataset is one table a person can open
 * in Excel. The complete, re-importable backup is the JSON export in lib/backup.ts.
 */
import { localTime, toCsv, type Cell } from "./csv";
import { db, json } from "./db";
import { ERROR_TYPE_SOURCE_LABEL, errorTypeLabel, suggestionBy, type ErrorTypeSource } from "./error-types";
import { readReport } from "./learning";
import * as repo from "./repo";
import { analyzeStudent } from "./service";

type Table = { headers: string[]; rows: Cell[][] };
export type Dataset = { key: string; label: string; description: string; build: () => Table };

type R = Record<string, unknown>;
const q = (sql: string) => db().prepare(sql).all() as R[];
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const yes = (v: unknown) => Boolean(v);
const list = (v: unknown) => json<string[]>(s(v), []).join(", ");
const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100));

function skillNames() {
  const m = new Map(repo.listSkills().map((k) => [k.id, `${k.subject} › ${k.area} › ${k.name}`]));
  return (ids: unknown) => json<string[]>(s(ids), []).map((id) => m.get(id) ?? id).join(", ");
}

const LESSON_SQL = `SELECT l.*, s.name AS student_name, t.name AS teacher_name FROM lessons l
  JOIN students s ON s.id = l.student_id LEFT JOIN teachers t ON t.id = l.teacher_id`;

export const DATASETS: Dataset[] = [
  {
    key: "schueler",
    label: "Schüler und Schülerprofile",
    description: "Stammdaten, Schule, Klasse, Fächer, Themen, Stärken, Schwächen, Ziele, Notizen, zuständiger Lehrer.",
    build: () => ({
      headers: ["ID", "Name", "Schultyp", "Klasse", "Schulstufe", "Schule", "Fächer", "Aktuelle Themen", "Stärken", "Schwächen", "Ziele", "Notizen", "Lehrer", "Angelegt"],
      rows: q(`SELECT s.*, t.name AS teacher_name FROM students s LEFT JOIN teachers t ON t.id = s.teacher_id ORDER BY s.name COLLATE NOCASE`).map((r) => [
        n(r.id), s(r.name), s(r.school_type), n(r.klasse), n(r.grade), s(r.school), list(r.subjects), s(r.current_topics),
        s(r.strengths_note), s(r.weaknesses_note), s(r.goals), s(r.notes), s(r.teacher_name), localTime(s(r.created_at)),
      ]),
    }),
  },
  {
    key: "lehrer",
    label: "Lehrer",
    description: "Name, Benutzername, Rolle und Status. Ohne Passwörter.",
    build: () => ({
      headers: ["ID", "Name", "Benutzername", "Verwaltung", "Aktiv", "Passwort noch zu ändern"],
      rows: q("SELECT id, name, username, is_admin, active, must_change_password FROM teachers ORDER BY name COLLATE NOCASE").map((r) => [
        n(r.id), s(r.name), s(r.username), yes(r.is_admin), yes(r.active), yes(r.must_change_password),
      ]),
    }),
  },
  {
    key: "einheiten",
    label: "Einheiten (Datum, Zeiten, Lehrer)",
    description: "Jede Einheit mit Datum, Lehrer, Schüler, Fach, Start, Ende, Dauer, Status und wie sie beendet wurde.",
    build: () => ({
      headers: ["ID", "Datum", "Lehrer", "Schüler", "Fach", "Start", "Ende", "Dauer (min)", "Status", "Beendet durch", "Endzeit geschätzt", "Grund", "Letzte Aktivität"],
      rows: q(`SELECT u.*, t.name AS teacher_name, s.name AS student_name FROM units u JOIN teachers t ON t.id = u.teacher_id
               JOIN students s ON s.id = u.student_id ORDER BY u.started_at`).map((r) => [
        n(r.id), localTime(s(r.started_at)).slice(0, 10), s(r.teacher_name), s(r.student_name), s(r.subject), localTime(s(r.started_at)), localTime(s(r.ended_at)),
        r.ended_at ? Math.round((Date.parse(s(r.ended_at)) - Date.parse(s(r.started_at))) / 60_000) : null,
        s(r.status), s(r.ended_by), yes(r.end_estimated), s(r.end_reason), localTime(s(r.last_activity_at)),
      ]),
    }),
  },
  {
    key: "nachhilfestunden",
    label: "Einheiten (mit Dokumentation)",
    description: "Geplante und gehaltene Einheiten mit Thema, Beobachtungen, Einschätzungen und nächsten Schritten.",
    build: () => {
      const names = skillNames();
      return {
        headers: ["ID", "Einheit", "Beginn", "Dauer (min)", "Status", "Lehrer", "Schüler", "Fach", "Thema", "Was gemacht", "Fehler", "Verständnis (1–5)", "Konzentration (1–5)", "Motivation (1–5)", "Mitarbeit (1–5)", "Beobachtungen", "Schwierigkeiten", "Positive Entwicklungen", "Wiederholungen", "Nächstes Lernziel", "Hausübung", "Fähigkeiten", "Ergänzt am"],
        rows: q(`${LESSON_SQL} WHERE l.kind = 'stunde' ORDER BY l.starts_at`).map((r) => [
          n(r.id), n(r.unit_id), localTime(s(r.starts_at)), n(r.duration_min), s(r.status), s(r.teacher_name), s(r.student_name), s(r.subject), s(r.topic),
          s(r.activities), s(r.mistakes), n(r.understanding), n(r.concentration), n(r.motivation), n(r.participation), s(r.tutor_notes), s(r.difficulties),
          s(r.positives), s(r.review_topics), s(r.next_steps), s(r.homework_note), names(r.skill_ids), localTime(s(r.reviewed_at)),
        ]),
      };
    },
  },
  {
    key: "lern-dokumentationen",
    label: "Dokumentationen der Einheiten",
    description: "Automatische Auswertung jeder Einheit: Aufgaben, Erfolgsquote, Hilfen, Zeiten, Zusammenfassung.",
    build: () => ({
      headers: ["Stunde", "Einheit", "Datum", "Lehrer", "Schüler", "Fach", "Themen", "Aufgaben", "Richtig", "Erfolgsquote %", "Beim 1. Versuch ohne Hilfe", "Mit Hilfe", "Hinweis gereicht", "Ausführliche Erklärung", "Lösung angesehen", "Dauer (min)", "Aktiv (min)", "Ø Sekunden pro Aufgabe", "Verlauf", "Sichere Fähigkeiten", "Unsichere Fähigkeiten", "Problem-Fähigkeiten", "Zusammenfassung"],
      rows: q(`${LESSON_SQL} WHERE l.unit_id IS NOT NULL ORDER BY l.starts_at`).map((r) => {
        const rep = readReport({ report: (r.report as string | null) ?? null });
        const by = (st: string) => rep?.skills.filter((k) => k.state === st).map((k) => k.name).join(", ") ?? "";
        return [
          n(r.id), n(r.unit_id), localTime(s(r.starts_at)).slice(0, 10), s(r.teacher_name), s(r.student_name), s(r.subject), rep?.topics.join(", ") ?? s(r.topic),
          rep?.tasksDone ?? null, rep?.correct ?? null, pct(rep?.successRate), rep?.firstTry ?? null, rep?.help.tasks ?? null, rep?.help.hinweis ?? null, rep?.help.erklaerung ?? null, rep?.help.loesung ?? null,
          rep ? Math.round(rep.durationMs / 60_000) : null, rep?.activeMs != null ? Math.round(rep.activeMs / 60_000) : null, rep?.speed.avgMs != null ? Math.round(rep.speed.avgMs / 1000) : null,
          rep?.development.direction ?? "", by("sicher"), by("unsicher"), by("problem"), s(r.summary),
        ];
      }),
    }),
  },
  {
    key: "lernverlauf",
    label: "Lernverlauf",
    description: "Alle Einträge chronologisch: Einheiten und selbstständiges Üben, mit Zusammenfassung.",
    build: () => ({
      headers: ["Datum", "Art", "Schüler", "Lehrer", "Fach", "Thema", "Status", "Was gemacht", "Zusammenfassung", "Nächstes Lernziel"],
      rows: q(`${LESSON_SQL} ORDER BY s.name COLLATE NOCASE, l.starts_at`).map((r) => [
        localTime(s(r.starts_at)), r.kind === "selbststaendig" ? "selbstständiges Üben" : "Einheit", s(r.student_name), s(r.teacher_name),
        s(r.subject), s(r.topic), s(r.status), s(r.activities), s(r.summary), s(r.next_steps),
      ]),
    }),
  },
  {
    key: "beobachtungen-lernziele",
    label: "Beobachtungen und Lernziele",
    description: "Nur die Eingaben der Lehrer: Beobachtungen, Schwierigkeiten, Fortschritte, Wiederholungen, nächste Ziele.",
    build: () => ({
      headers: ["Datum", "Schüler", "Lehrer", "Fach", "Beobachtungen", "Schwierigkeiten", "Positive Entwicklungen", "Empfohlene Wiederholungen", "Nächstes Lernziel", "Hausübung"],
      rows: q(`${LESSON_SQL} WHERE l.kind = 'stunde' AND (l.tutor_notes <> '' OR l.difficulties <> '' OR l.positives <> '' OR l.review_topics <> '' OR l.next_steps <> '' OR l.homework_note <> '')
               ORDER BY l.starts_at`).map((r) => [
        localTime(s(r.starts_at)).slice(0, 10), s(r.student_name), s(r.teacher_name), s(r.subject), s(r.tutor_notes), s(r.difficulties), s(r.positives), s(r.review_topics), s(r.next_steps), s(r.homework_note),
      ]),
    }),
  },
  {
    key: "fortschritt",
    label: "Fähigkeiten und Fortschritt (aktuell)",
    description: "Aktueller Stand jeder geübten Fähigkeit pro Schüler, mit Trend, Erfolgsquote und Übungsmenge.",
    build: () => {
      const rows: Cell[][] = [];
      for (const st of repo.listStudents()) {
        const a = analyzeStudent(st.id);
        for (const k of a?.skills ?? []) {
          if (k.evidence === 0) continue;
          rows.push([
            st.name, k.skill.subject, k.skill.area, k.skill.name, pct(k.mastery), { up: "steigt", down: "sinkt", flat: "gleich", none: "" }[k.trend], k.delta,
            k.tasksDone, pct(k.firstTryRate), k.avgTimeSec, pct(k.hintRate), k.lastPracticed ? localTime(new Date(k.lastPracticed).toISOString()) : "",
          ]);
        }
      }
      return { headers: ["Schüler", "Fach", "Bereich", "Fähigkeit", "Stand %", "Trend", "Veränderung (Punkte)", "Aufgaben", "1. Versuch richtig %", "Ø Sekunden", "Mit Hilfe %", "Zuletzt geübt"], rows };
    },
  },
  {
    key: "fortschritt-verlauf",
    label: "Fortschritt pro Einheit",
    description: "Stand jeder Fähigkeit am Ende jeder Einheit, z. B. Einheit 1: 35 %, Einheit 2: 48 %.",
    build: () => ({
      headers: ["Schüler", "Einheit", "Datum", "Fach", "Bereich", "Fähigkeit", "Stand %", "In der Einheit geübt"],
      rows: q(`SELECT x.*, s.name AS student_name, k.subject, k.area, k.name AS skill_name FROM skill_snapshots x JOIN students s ON s.id = x.student_id
               LEFT JOIN skills k ON k.id = x.skill_id ORDER BY s.name COLLATE NOCASE, x.recorded_at, k.sort`).map((r) => [
        s(r.student_name), n(r.unit_id), localTime(s(r.recorded_at)).slice(0, 10), s(r.subject), s(r.area), s(r.skill_name) || s(r.skill_id), pct(n(r.mastery)), yes(r.practiced),
      ]),
    }),
  },
  {
    key: "faehigkeiten",
    label: "Fähigkeiten (Katalog)",
    description: "Alle Fähigkeiten mit Fach, Bereich und Schulstufen.",
    build: () => ({
      headers: ["ID", "Fach", "Bereich", "Fähigkeit", "ab Schulstufe", "bis Schulstufe"],
      rows: repo.listSkills().map((k) => [k.id, k.subject, k.area, k.name, k.grade_min, k.grade_max]),
    }),
  },
  {
    key: "ergebnisse",
    label: "Ergebnisse (alle Antworten)",
    description: "Jede Antwort auf jede Aufgabe: richtig/falsch, Versuch, Zeit, Hilfen, Fehler, Fehlerart mit Quelle und Vorschlag, Einheit oder selbstständig.",
    build: () => ({
      headers: ["ID", "Zeitpunkt", "Schüler", "Übung", "Aufgabe", "Fähigkeit", "Versuch", "Antwort", "Richtig", "Abgeschlossen", "Zeit (s)", "Aktiv (s)", "Hinweise", "Lösung angesehen", "Fehler", "Fehlerart", "Fehlerart-Quelle", "Vorschlag", "Einheit", "Art", "Lehrerbewertung"],
      rows: q(`SELECT x.*, s.name AS student_name, w.title, t.prompt, k.name AS skill_name FROM attempts x JOIN students s ON s.id = x.student_id
               JOIN assignments a ON a.id = x.assignment_id JOIN worksheets w ON w.id = a.worksheet_id JOIN tasks t ON t.id = x.task_id
               LEFT JOIN skills k ON k.id = x.skill_id ORDER BY x.created_at, x.id`).map((r) => [
        n(r.id), localTime(s(r.created_at)), s(r.student_name), s(r.title), s(r.prompt), s(r.skill_name), n(r.attempt_no), s(r.answer), r.review === "offen" ? "" : yes(r.correct), yes(r.final),
        Math.round(Number(r.time_ms) / 1000), r.active_ms === null ? null : Math.round(Number(r.active_ms) / 1000), n(r.hints_used), yes(r.solution_viewed), s(r.error_label),
        errorTypeLabel(s(r.error_type)), ERROR_TYPE_SOURCE_LABEL[s(r.error_type_source) as ErrorTypeSource] ?? s(r.error_type_source),
        r.error_type_suggested ? `${errorTypeLabel(s(r.error_type_suggested))} (${suggestionBy(s(r.error_type_suggested_source))})` : "",
        n(r.unit_id), r.unit_id ? "Einheit" : "selbstständig",
        // freie Antworten: offen (noch nicht bewertet), richtig, teilweise, falsch
        s(r.review),
      ]),
    }),
  },
  {
    key: "hausuebungen-tests",
    label: "Hausübungen und Schularbeiten",
    description: "Hausübungen mit Status sowie Schularbeiten und Tests mit Noten.",
    build: () => ({
      headers: ["Art", "Schüler", "Datum / fällig", "Fach", "Beschreibung / Thema", "Status / Note", "Punkte", "Notizen"],
      rows: [
        ...q(`SELECT h.*, s.name AS student_name FROM homework h JOIN students s ON s.id = h.student_id ORDER BY h.due_date`).map((r) => [
          "Hausübung", s(r.student_name), s(r.due_date), s(r.subject), s(r.description), s(r.status), null, s(r.notes),
        ]),
        ...q(`SELECT x.*, s.name AS student_name FROM tests x JOIN students s ON s.id = x.student_id ORDER BY x.date`).map((r) => [
          s(r.kind), s(r.student_name), s(r.date), s(r.subject), s(r.topic), r.grade === null ? "" : `Note ${r.grade}`, r.points === null ? "" : `${r.points}/${r.max_points ?? "?"}`, s(r.notes),
        ]),
      ] as Cell[][],
    }),
  },
  {
    key: "abrechnung",
    label: "Abrechnungsdaten (alle Monate)",
    description: "Alle abrechenbaren Einheiten mit Start- und Endzeit. Selbstständiges Üben ist nicht enthalten.",
    build: () => ({
      headers: ["Monat", "Tag", "Lehrer", "Schüler", "Fach", "Thema", "Start", "Ende", "Dauer (min)", "Endzeit geschätzt", "Beobachtungen"],
      rows: repo.billingEntries({ from: "0000", to: "9999" }).map((r) => {
        const minutes = r.unit_start && r.unit_end ? Math.round((Date.parse(r.unit_end) - Date.parse(r.unit_start)) / 60_000) : r.duration_min;
        return [
          r.starts_at.slice(0, 7), r.starts_at.slice(0, 10), r.teacher_name ?? "", r.student_name, r.subject, r.topic,
          r.unit_start ? localTime(r.unit_start).slice(11) : r.starts_at.slice(11, 16), r.unit_end ? localTime(r.unit_end).slice(11) : "", minutes, yes(r.unit_end_estimated), r.tutor_notes,
        ];
      }),
    }),
  },
];

export function datasetCsv(key: string): { filename: string; body: string } | null {
  const d = DATASETS.find((x) => x.key === key);
  if (!d) return null;
  const t = d.build();
  return { filename: `${d.key}.csv`, body: toCsv(t.headers, t.rows) };
}

export function datasetSize(key: string): number {
  return DATASETS.find((x) => x.key === key)?.build().rows.length ?? 0;
}
