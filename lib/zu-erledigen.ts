/**
 * „Zu erledigen“ auf der Startseite: was der angemeldete Lehrer noch tun muss, jeder Punkt mit einem
 * klaren Zustand (niko, 22.10.2026): Offen, Überfällig, Wartet auf Lehrerbewertung oder Erledigt.
 *
 * Der Zustand wird beim Lesen aus den Daten berechnet, nie gespeichert. Gespeichert wird nur, was der
 * Lehrer selbst getan hat: das Häkchen einer Hausübung (homework.status) und „gesehen“ je Lehrer
 * (todo_gesehen: Ergebnis geöffnet oder abgehakt). So stimmt die Liste auch nach dem Neuladen.
 *
 * Die Punkte:
 * - Prüfung: eine geplante Schularbeit in der Erinnerungsstufe (lib/exams.ts), immer Offen.
 * - Ergebnis: eine fertige Übung. Wartet auf Lehrerbewertung, solange Antworten auf die Bewertung des
 *   Lehrers warten (attempts.review = 'offen'), dann Offen bis der Lehrer das Ergebnis öffnet oder abhakt. Solange es
 *   wartet, führt es in „Zu bewerten“ des Schülers (lib/zu-bewerten.ts), sonst zum Ergebnis.
 * - Hausübung: Offen bis zum Fälligkeitstag, danach Überfällig. Erledigt mit dem Häkchen oder sobald die
 *   verknüpfte Übung fertig ist (homework.assignment_id).
 * - Text: eine abgegebene Textarbeit. Wartet auf Lehrerbewertung, bis es eine Korrektur dieser Fassung
 *   gibt oder der Lehrer sie abhakt.
 * - Bewertung (2026-10-23): eine abgegebene Textarbeit mit Aufgabenstellung aus einer beendeten Einheit, deren Note noch
 *   nicht bestätigt ist (die Dokumentation sagt „Bewertung offen“). Wartet auf Lehrerbewertung, bis die Lehrkraft sie
 *   übernimmt; solange ein Vorschlag der KI da ist, auch nach FENSTER_TAGE. Steht nicht da, solange der Text selbst noch
 *   auf die Korrektur wartet (dann genügt ein Punkt).
 * - Terminanfrage (lib/planung/terminanfragen.ts): für die Verwaltung jede offene Anfrage, für einen Lehrer ein
 *   Tausch, der auf seine Zustimmung wartet. Offen, bis sie entschieden ist.
 * - Eingetragene Prüfung: was ein Schüler in seiner App eingetragen hat (lib/pruefliste.ts), zu prüfen oder schon
 *   als Prüfung eingetragen. Wartet auf Lehrerbewertung (zu prüfen) oder Offen (schon eingetragen), bis ein Lehrer
 *   sie in der Prüfliste übernimmt, bestätigt oder verwirft.
 *
 * Nur die eigenen Schüler (students.teacher_id leer oder der Lehrer, wie bei den Prüfungen) und die eigenen
 * Übungen (der Lehrer der Einheit, sonst wer die Übung gemacht hat, sonst der des Schülers).
 */
import { arbeitsauftraege } from "./bewertung-kriterien";
import { db } from "./db";
import { examReminders, type ExamReminder } from "./exams";
import { anfragenZuErledigen } from "./planung/terminanfragen";
import { tagAddieren } from "./planung/zeit";
import { homeworkOpen, type HomeworkView } from "./repo";

export type Zustand = "offen" | "ueberfaellig" | "wartet" | "erledigt";
export const ZUSTAND_LABEL: Record<Zustand, string> = { offen: "Offen", ueberfaellig: "Überfällig", wartet: "Wartet auf Lehrerbewertung", erledigt: "Erledigt" };
export const ZUSTAND_TONE: Record<Zustand, "neutral" | "red" | "amber" | "green"> = { offen: "neutral", ueberfaellig: "red", wartet: "amber", erledigt: "green" };

/** Wie lange ein ungesehenes Ergebnis oder ein abgegebener Text in der Liste bleibt, und wie weit „Erledigt“ zurückreicht. */
export const FENSTER_TAGE = 7;

export type Art = "pruefung" | "ergebnis" | "hausuebung" | "text" | "bewertung" | "terminanfrage" | "einreichung";
/** Was „Abhaken“ in der Liste tut: Hausübung als erledigt markieren oder als gesehen merken. */
export type Abhaken = { art: "hausuebung" | "ergebnis" | "text"; id: number; studentId: number };

type Basis = { key: string; zustand: Zustand; studentId: number; studentName: string; href: string; /** Datum oder Zeitpunkt für die Anzeige */ datum: string; abhaken: Abhaken | null };
export type Punkt =
  | (Basis & { art: "pruefung"; pruefung: ExamReminder })
  | (Basis & { art: "ergebnis"; titel: string; richtig: number; aufgaben: number; zuBewerten: number })
  | (Basis & { art: "hausuebung"; beschreibung: string; uebung: string | null })
  | (Basis & { art: "text"; titel: string })
  | (Basis & { art: "bewertung"; titel: string; vorschlag: boolean })
  | (Basis & { art: "terminanfrage"; aufgabe: "bestaetigen" | "zustimmen"; beschreibung: string })
  | (Basis & { art: "einreichung"; titel: string; pruefungsDatum: string | null; zuPruefen: boolean; uebernommen: boolean });

// ---------- der Zustand, rein aus den Daten ----------

/** "2026-10-22 08:15:00" (SQLite datetime, UTC) und ISO-Zeitstempel gleich lesen. */
export const zeitMs = (s: string) => Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(" ", "T")}Z` : s);
const gesehenNach = (gesehenAm: string | null, fertigAm: string) => gesehenAm !== null && zeitMs(gesehenAm) >= zeitMs(fertigAm);

/** Eine fertige Übung: erst bewerten, dann ansehen. */
export function ergebnisZustand(e: { fertigAm: string; zuBewerten: number; gesehenAm: string | null }): Zustand {
  if (e.zuBewerten > 0) return "wartet";
  return gesehenNach(e.gesehenAm, e.fertigAm) ? "erledigt" : "offen";
}

/** Eine Hausübung am Tag `heute` (Wiener Datum). */
export function hausuebungZustand(h: Pick<HomeworkView, "status" | "due_date" | "assignment_completed_at">, heute: string): Zustand {
  if (!homeworkOpen(h)) return "erledigt";
  return h.due_date && h.due_date < heute ? "ueberfaellig" : "offen";
}

/** Eine Textarbeit; null, solange sie nicht abgegeben ist (dann gehört sie nicht in die Liste). */
export function textZustand(t: { status: string; abgegebenAm: string | null; korrigiert: boolean; gesehenAm: string | null }): Zustand | null {
  if (t.status !== "fertig" || !t.abgegebenAm) return null;
  return t.korrigiert || gesehenNach(t.gesehenAm, t.abgegebenAm) ? "erledigt" : "wartet";
}

/** „Zu bewerten“ eines Schülers (lib/zu-bewerten.ts), im Profil oben. */
export const zuBewertenHref = (studentId: number) => `/schueler/${studentId}#zu-bewerten`;

const RANG: Record<Zustand, number> = { ueberfaellig: 0, wartet: 1, offen: 2, erledigt: 3 };

// ---------- gesehen ----------

export type GesehenArt = "ergebnis" | "text";
export function markiereGesehen(teacherId: number, art: GesehenArt, refId: number, at = new Date()) {
  db()
    .prepare("INSERT INTO todo_gesehen (teacher_id, art, ref_id, seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (teacher_id, art, ref_id) DO UPDATE SET seen_at = excluded.seen_at")
    .run(teacherId, art, refId, at.toISOString());
}

// ---------- die Liste ----------

/**
 * Alle Punkte des Lehrers: `offen` (Offen, Überfällig, Wartet; das Dringende zuerst) und `erledigt`
 * (die letzten FENSTER_TAGE Tage, neueste zuerst). `heute` ist das Wiener Datum.
 */
export function zuErledigen(teacherId: number, heute: string, now = new Date()): { offen: Punkt[]; erledigt: Punkt[] } {
  const conn = db();
  const morgen = tagAddieren(heute, 1);
  const seit = new Date(now.getTime() - FENSTER_TAGE * 86_400_000).toISOString();
  const seitTag = tagAddieren(heute, -FENSTER_TAGE);
  const punkte: Punkt[] = [];

  for (const e of examReminders(heute, { teacherId })) {
    punkte.push({ key: `p${e.id}`, art: "pruefung", zustand: "offen", studentId: e.student_id, studentName: e.student_name, href: `/schueler/${e.student_id}/pruefung/${e.id}`, datum: e.date, abhaken: null, pruefung: e });
  }

  // fertige Übungen: die der letzten Tage und alle, deren Antworten noch auf die Bewertung warten
  const ergebnisse = conn
    .prepare(
      `SELECT a.id, a.student_id, s.name AS student_name, w.title, a.completed_at, g.seen_at,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS richtig,
        (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS aufgaben,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.review = 'offen') AS zu_bewerten
       FROM assignments a JOIN students s ON s.id = a.student_id JOIN worksheets w ON w.id = a.worksheet_id
       LEFT JOIN units u ON u.id = a.unit_id
       LEFT JOIN todo_gesehen g ON g.teacher_id = @me AND g.art = 'ergebnis' AND g.ref_id = a.id
       WHERE a.completed_at IS NOT NULL AND COALESCE(a.archived_at, w.archived_at) IS NULL
         AND (datetime(a.completed_at) >= datetime(@seit) OR a.id IN (SELECT assignment_id FROM attempts WHERE review = 'offen'))
         AND COALESCE(u.teacher_id, w.teacher_id, s.teacher_id, @me) = @me
       ORDER BY datetime(a.completed_at) DESC, a.id DESC`,
    )
    .all({ me: teacherId, seit }) as { id: number; student_id: number; student_name: string; title: string; completed_at: string; seen_at: string | null; richtig: number; aufgaben: number; zu_bewerten: number }[];
  for (const r of ergebnisse) {
    const zustand = ergebnisZustand({ fertigAm: r.completed_at, zuBewerten: r.zu_bewerten, gesehenAm: r.seen_at });
    punkte.push({
      // waiting for the grade: into „Zu bewerten“ of the student (lib/zu-bewerten.ts), the one list of open decisions
      key: `a${r.id}`, art: "ergebnis", zustand, studentId: r.student_id, studentName: r.student_name, href: r.zu_bewerten > 0 ? zuBewertenHref(r.student_id) : `/schueler/${r.student_id}/ergebnis/${r.id}`, datum: r.completed_at,
      // was auf die Bewertung wartet, wird bewertet, nicht abgehakt
      abhaken: zustand === "offen" ? { art: "ergebnis", id: r.id, studentId: r.student_id } : null,
      titel: r.title, richtig: r.richtig, aufgaben: r.aufgaben, zuBewerten: r.zu_bewerten,
    });
  }

  // Hausübungen mit Fälligkeit: offen bis morgen fällig (auch längst überfällige), erledigt der letzten Tage
  const hausuebungen = conn
    .prepare(
      `SELECT h.*, s.name AS student_name, w.title AS assignment_title, a.completed_at AS assignment_completed_at
       FROM homework h JOIN students s ON s.id = h.student_id
       LEFT JOIN assignments a ON a.id = h.assignment_id LEFT JOIN worksheets w ON w.id = a.worksheet_id
       WHERE h.due_date IS NOT NULL AND COALESCE(s.teacher_id, @me) = @me
       ORDER BY h.due_date, h.id`,
    )
    .all({ me: teacherId }) as (HomeworkView & { student_name: string })[];
  for (const h of hausuebungen) {
    const zustand = hausuebungZustand(h, heute);
    if (zustand === "erledigt" ? h.due_date! < seitTag : h.due_date! > morgen) continue;
    const ergebnis = h.assignment_id && h.assignment_completed_at ? `/schueler/${h.student_id}/ergebnis/${h.assignment_id}` : null;
    punkte.push({
      key: `h${h.id}`, art: "hausuebung", zustand, studentId: h.student_id, studentName: h.student_name, href: ergebnis ?? `/schueler/${h.student_id}?tab=schule`, datum: h.due_date!,
      abhaken: zustand === "erledigt" ? null : { art: "hausuebung", id: h.id, studentId: h.student_id },
      beschreibung: h.description, uebung: h.assignment_title,
    });
  }

  // abgegebene Textarbeiten der letzten Tage; korrigiert = es gibt eine Korrektur der abgegebenen Fassung
  const texte = conn
    .prepare(
      `SELECT x.id, x.student_id, s.name AS student_name, x.title, x.status, x.completed_at, g.seen_at,
        EXISTS (SELECT 1 FROM text_corrections c WHERE c.text_id = x.id AND c.version >= x.version) AS korrigiert
       FROM texts x JOIN students s ON s.id = x.student_id
       LEFT JOIN todo_gesehen g ON g.teacher_id = @me AND g.art = 'text' AND g.ref_id = x.id
       WHERE x.status = 'fertig' AND x.completed_at IS NOT NULL AND x.archived_at IS NULL AND datetime(x.completed_at) >= datetime(@seit)
         AND COALESCE(x.teacher_id, s.teacher_id, @me) = @me
       ORDER BY x.completed_at DESC, x.id DESC`,
    )
    .all({ me: teacherId, seit }) as { id: number; student_id: number; student_name: string; title: string; status: string; completed_at: string; seen_at: string | null; korrigiert: number }[];
  for (const t of texte) {
    const zustand = textZustand({ status: t.status, abgegebenAm: t.completed_at, korrigiert: Boolean(t.korrigiert), gesehenAm: t.seen_at });
    if (!zustand) continue;
    punkte.push({
      key: `t${t.id}`, art: "text", zustand, studentId: t.student_id, studentName: t.student_name, href: `/texte/${t.id}`, datum: t.completed_at,
      abhaken: zustand === "wartet" ? { art: "text", id: t.id, studentId: t.student_id } : null,
      titel: t.title,
    });
  }

  // Note offen: abgegeben, in einer beendeten Einheit geschrieben, noch nicht bestätigt (die Dokumentation sagt „Bewertung offen“)
  const wartetAufKorrektur = new Set(punkte.filter((p) => p.art === "text" && p.zustand === "wartet").map((p) => p.key));
  const offeneNoten = conn
    .prepare(
      `SELECT x.id, x.student_id, s.name AS student_name, x.title, x.prompt, x.completed_at, COALESCE(b.vorschlag, '') <> '' AS vorschlag
       FROM texts x JOIN students s ON s.id = x.student_id LEFT JOIN text_bewertungen b ON b.text_id = x.id
       WHERE x.status = 'fertig' AND x.completed_at IS NOT NULL AND x.archived_at IS NULL AND b.bestaetigt_at IS NULL
         AND EXISTS (SELECT 1 FROM text_units tu JOIN units u ON u.id = tu.unit_id WHERE tu.text_id = x.id AND u.status = 'beendet')
         AND (COALESCE(b.vorschlag, '') <> '' OR datetime(x.completed_at) >= datetime(@seit))
         AND COALESCE(x.teacher_id, s.teacher_id, @me) = @me
       ORDER BY x.completed_at DESC, x.id DESC`,
    )
    .all({ me: teacherId, seit }) as { id: number; student_id: number; student_name: string; title: string; prompt: string; completed_at: string; vorschlag: number }[];
  for (const t of offeneNoten) {
    if (!arbeitsauftraege(t.prompt).punkte.length || wartetAufKorrektur.has(`t${t.id}`)) continue;
    punkte.push({
      key: `b${t.id}`, art: "bewertung", zustand: "wartet", studentId: t.student_id, studentName: t.student_name, href: `/texte/${t.id}/korrektur?teil=aufgabe`, datum: t.completed_at, abhaken: null,
      titel: t.title, vorschlag: Boolean(t.vorschlag),
    });
  }

  const ich = conn.prepare("SELECT id, is_admin FROM teachers WHERE id = ?").get(teacherId) as { id: number; is_admin: number } | undefined;
  for (const a of ich ? anfragenZuErledigen(ich) : []) {
    punkte.push({ key: `ta${a.id}`, art: "terminanfrage", zustand: "offen", studentId: a.studentId, studentName: a.studentName, href: a.href, datum: a.datum, abhaken: null, aufgabe: a.aufgabe, beschreibung: a.beschreibung });
  }
  // vom Schüler eingetragene Prüfungen: offen bis zur Entscheidung in der Prüfliste, entschiedene der letzten Tage
  const einreichungen = conn
    .prepare(
      `SELECT e.id, e.student_id, s.name AS student_name, COALESCE(t.kind, e.art) AS art, COALESCE(t.subject, e.fach) AS fach, COALESCE(t.date, e.datum) AS datum,
         e.status, e.created_at, e.entschieden_am
       FROM pruefung_einreichungen e JOIN students s ON s.id = e.student_id LEFT JOIN tests t ON t.id = e.test_id
       WHERE (e.status = 'eingereicht' OR (e.status = 'automatisch' AND e.test_id IS NOT NULL) OR datetime(e.entschieden_am) >= datetime(@seit))
         AND COALESCE(s.teacher_id, @me) = @me
       ORDER BY e.created_at, e.id`,
    )
    .all({ me: teacherId, seit }) as { id: number; student_id: number; student_name: string; art: string; fach: string; datum: string | null; status: string; created_at: string; entschieden_am: string | null }[];
  for (const e of einreichungen) {
    const offen = e.status === "eingereicht" || e.status === "automatisch";
    punkte.push({
      key: `e${e.id}`, art: "einreichung", zustand: !offen ? "erledigt" : e.status === "eingereicht" ? "wartet" : "offen", studentId: e.student_id, studentName: e.student_name, href: `/schueler/${e.student_id}?tab=schule#pruefliste`,
      datum: offen ? e.created_at : (e.entschieden_am ?? e.created_at), abhaken: null,
      titel: `${e.art} ${e.fach}`, pruefungsDatum: e.datum, zuPruefen: e.status === "eingereicht", uebernommen: e.status === "uebernommen",
    });
  }

  // offen: das Dringende zuerst, sonst in der Reihenfolge oben; erledigt: das Neueste zuerst
  const offen = punkte.map((p, i) => ({ p, i })).filter(({ p }) => p.zustand !== "erledigt").sort((a, b) => RANG[a.p.zustand] - RANG[b.p.zustand] || a.i - b.i).map(({ p }) => p);
  const erledigt = punkte.filter((p) => p.zustand === "erledigt").sort((a, b) => zeitMs(b.datum) - zeitMs(a.datum));
  return { offen, erledigt };
}
