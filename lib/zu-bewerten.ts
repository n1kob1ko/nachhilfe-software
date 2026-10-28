/**
 * **Zu bewerten** (Gemeinsame Bewertung, C3; niko: „Digital, Papier und Probeschularbeit landen in derselben Liste unsicherer
 * Stellen und im selben Lernstand.“): alle Entscheidungen, die noch bei der Lehrkraft liegen, aus einer Funktion für jede Ansicht
 * (Unterricht, Abschluss, Profil; „Zu erledigen“ auf der Startseite verlinkt hierher). Keine zweite Warteschlange: gelesen wird,
 * was ohnehin gespeichert ist.
 *
 * - Antworten, die auf die Lehrkraft warten (`attempts.review = 'offen'`): am Gerät (freie Antwort, ein Rechenweg, den die App
 *   nicht sicher prüft), auf Papier (unsicher gelesen, nicht lesbar, die App prüft anders; `attempts.offen_info`, lib/papier-einheit.ts)
 *   und in einer Probeschularbeit (Teilaufgaben mit Musterlösung, lib/probe-extern.ts). Sie zählen nirgends, bis die Lehrkraft
 *   Richtig, Teilweise oder Falsch tippt (lib/bewerten.ts, dieselbe Bewertung wie auf der Ergebnis-Seite).
 * - Textarbeiten mit „Bewertung offen“ (lib/text-note.ts): bewertet wird dort, die Liste verlinkt die Korrektur.
 * - Antworten einer Hausübung (E2, lib/hausuebung-zurueck.ts), am Gerät oder auf Papier, mit dem Chip „Hausübung“. Sie gehören zu
 *   keiner Einheit; die Liste einer Einheit zeigt die der Hausübung, die in diese Einheit gehört (`hausuebungFuerEinheit`).
 *
 * Nie die eines anderen Schülers; Musterlösungen stehen nur hier für die Lehrkraft, nie auf einer Schülerseite.
 */
import { antwortAnzeige } from "./antwort-text";
import { arbeitsauftraege } from "./bewertung-kriterien";
import { PAPIER_ANTWORT } from "./blatt-einlesen";
import type { Bewertung } from "./blatt-regeln";
import { frageText, loesungText } from "./cockpit";
import { db, json } from "./db";
import { hausuebungFuerEinheit } from "./hausuebung-zurueck";
import { punkteDerAufgaben } from "./probeschularbeit";
import * as repo from "./repo";
import { bewertungFuerBericht, letzteEinheitDesTexts } from "./text-note";
import { getUnit } from "./units";

/** Woher die Zeile kommt (der Chip vorne). */
export type Quelle = "geraet" | "papier" | "probe" | "text" | "hausuebung";
export const QUELLE_TEXT: Record<Quelle, string> = { geraet: "Gerät", papier: "Papier", probe: "Probeschularbeit", text: "Text", hausuebung: "Hausübung" };

/** Warum sie offen ist. */
export type Grund = "ki" | "app" | "frei" | "loesung";
export const GRUND_TEXT: Record<Grund, string> = { ki: "KI unsicher", app: "App prüft anders", frei: "Freie Antwort", loesung: "Lösung fehlt" };

type Basis = { key: string; quelle: Quelle; grund: Grund; /** der Grund in einem Satz, wenn die App mehr weiß */ grundText: string; studentId: number; unitId: number | null; titel: string; href: string; am: string };

/**
 * Eine Antwort, die auf die Lehrkraft wartet. `aufgabe` und `antwort` kurz; `loesung`: Musterlösung oder erwartete Antwort, nur für
 * die Lehrkraft; `max`: die Punkte der Aufgabe, wenn sie welche hat (teilweise = die Hälfte); `vorschlag`: was die Lesung vorschlug.
 */
export type OffeneAntwort = Basis & { art: "antwort"; attemptId: number; assignmentId: number; papier: boolean; nr: string; aufgabe: string; antwort: string; loesung: string; max: number | null; vorschlag: Bewertung | null; /** Papier: die Lesung fand an dieser Stelle nichts Lesbares */ nichtLesbar?: boolean };
/** Eine Textarbeit mit „Bewertung offen“: bewertet wird in der Korrektur (`href`); `vorschlag`: ein Vorschlag liegt bereit. */
export type OffenerText = Basis & { art: "text"; textId: number; woerter: number; vorschlag: boolean; linkText: string };
export type ZuBewerten = OffeneAntwort | OffenerText;

const kurz = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()} …` : t;
};
/** Der Titel ohne den Vornamen davor („Mia – Brüche“ → „Brüche“) und ohne „Probeschularbeit: “. */
const ohneVorname = (title: string, name: string) => {
  const first = name.split(" ")[0];
  return (first && title.startsWith(`${first} – `) ? title.slice(first.length + 3) : title).replace(/^Probeschularbeit: /, "");
};

type OffenRow = repo.Attempt & { offen_info: string | null; w_id: number; w_title: string; probe_test_id: number | null; hausuebung: number };

/** Warum eine Antwort offen ist: was Papier gespeichert hat, sonst aus der Aufgabe (keine Lösung, Rechenweg, freie Antwort). */
function grundVon(r: OffenRow, t: repo.Task): { grund: Grund; grundText: string; vorschlag: Bewertung | null; papier: boolean } {
  const info = json<{ grund?: string; text?: string; vorschlag?: Bewertung | null } | null>(r.offen_info, null);
  if (info && (info.grund === "ki" || info.grund === "app")) return { grund: info.grund, grundText: info.text ?? "", vorschlag: info.vorschlag ?? null, papier: true };
  if (!loesungText(t).trim()) return { grund: "loesung", grundText: "Ohne Lösung entscheidest du allein.", vorschlag: null, papier: false };
  if (t.type === "rechenweg" || t.type === "sachaufgabe") return { grund: "app", grundText: r.error_label || "Den Rechenweg prüft die App nicht sicher.", vorschlag: null, papier: false };
  if (t.answer.vokabel) return { grund: "app", grundText: "Das Wort steht so nicht in der Liste.", vorschlag: null, papier: false };
  return { grund: "frei", grundText: "", vorschlag: null, papier: false };
}

/**
 * Auf Papier gespeichert ohne Antworttext („Auf Papier gelöst“): was die gespeicherte Lesung zu dieser Aufgabe gelesen hat
 * (`papier_arbeiten.lesung_id`, lib/papier-einheit.ts), damit die Liste das Gelesene zeigt statt des Platzhalters. null ohne Lesung.
 */
function gelesenZu(assignmentId: number, taskId: number): { antwort: string; nichtLesbar: boolean } | null {
  const r = db()
    .prepare(
      `SELECT l.zeilen FROM papier_arbeiten p JOIN papier_lesungen l ON l.id = p.lesung_id
       WHERE p.assignment_id = ? AND EXISTS (SELECT 1 FROM json_each(COALESCE(p.task_ids, '[]')) j WHERE j.value = ?) ORDER BY p.id DESC LIMIT 1`,
    )
    .get(assignmentId, taskId) as { zeilen: string } | undefined;
  const z = r ? json<{ taskId: number; fehlt?: boolean; antwort?: string; bewertung?: string }[]>(r.zeilen, []).find((x) => x.taskId === taskId) : undefined;
  if (!z) return null;
  return { antwort: String(z.antwort ?? "").trim(), nichtLesbar: Boolean(z.fehlt) || z.bewertung === "nicht_lesbar" };
}

/**
 * Die offenen Antworten (am Gerät, auf Papier, in einer Probeschularbeit, einer Hausübung) einer Einheit oder eines Schülers, älteste
 * zuerst. Für eine Einheit auch die der Hausübung, die in sie gehört (`hwAssignment`; ihre Antworten haben keine unit_id).
 */
function offeneAntworten(o: { unitId: number; studentId: number; hwAssignment: number } | { studentId: number }): OffeneAntwort[] {
  const rows = db()
    .prepare(
      `SELECT x.*, w.id AS w_id, w.title AS w_title, w.probe_test_id, EXISTS (SELECT 1 FROM homework h WHERE h.assignment_id = a.id) AS hausuebung
       FROM attempts x JOIN assignments a ON a.id = x.assignment_id JOIN worksheets w ON w.id = a.worksheet_id
       WHERE x.review = 'offen' AND x.final = 1 AND x.student_id = @studentId ${"unitId" in o ? "AND (x.unit_id = @unitId OR (x.unit_id IS NULL AND x.assignment_id = @hwAssignment))" : ""}
         AND a.student_id = x.student_id AND COALESCE(a.archived_at, w.archived_at) IS NULL
       ORDER BY x.created_at, x.id`,
    )
    .all(o) as OffenRow[];
  const student = repo.getStudent(o.studentId);
  const blaetter = new Map<number, { tasks: repo.Task[]; punkte: Map<number, number | null> }>();
  const blatt = (r: OffenRow) => {
    let b = blaetter.get(r.w_id);
    if (!b) {
      const tasks = repo.listTasks(r.w_id);
      const eingetragen = new Map((db().prepare("SELECT id, points FROM tasks WHERE worksheet_id = ?").all(r.w_id) as { id: number; points: number | null }[]).map((p) => [p.id, p.points]));
      // a Probeschularbeit always has points (entered or the usual ones); another exercise only where they are entered
      const punkte: Map<number, number | null> = r.probe_test_id ? punkteDerAufgaben(r.w_id, tasks) : eingetragen;
      b = { tasks, punkte };
      blaetter.set(r.w_id, b);
    }
    return b;
  };
  return rows.flatMap((r): OffeneAntwort[] => {
    const b = blatt(r);
    const i = b.tasks.findIndex((t) => t.id === r.task_id);
    const t = b.tasks[i];
    if (!t) return [];
    const g = grundVon(r, t);
    // „Auf Papier gelöst“ is a placeholder: where a reading exists, the answer it read (or that nothing was legible)
    const gelesen = r.answer === PAPIER_ANTWORT ? gelesenZu(r.assignment_id, t.id) : null;
    return [
      {
        key: `a${r.id}`,
        art: "antwort",
        attemptId: r.id,
        assignmentId: r.assignment_id,
        quelle: r.probe_test_id ? "probe" : r.hausuebung ? "hausuebung" : g.papier ? "papier" : "geraet",
        papier: g.papier,
        grund: g.grund,
        grundText: g.grundText,
        vorschlag: g.vorschlag,
        studentId: r.student_id,
        unitId: r.unit_id ?? null,
        titel: ohneVorname(r.w_title, student?.name ?? ""),
        nr: t.data.nummer?.trim() || String(i + 1),
        aufgabe: kurz(frageText(t), 240),
        antwort: kurz(gelesen?.antwort || antwortAnzeige(t, r.answer) || "–", 400),
        ...(gelesen && !gelesen.antwort && gelesen.nichtLesbar ? { nichtLesbar: true } : {}),
        loesung: loesungText(t),
        max: b.punkte.get(t.id) ?? null,
        href: `/schueler/${r.student_id}/ergebnis/${r.assignment_id}`,
        am: r.created_at,
      },
    ];
  });
}

/** Ein abgegebener Text mit „Bewertung offen“ (wie die Dokumentation seiner letzten Einheit es sagt). */
function offenerText(x: { id: number; student_id: number; title: string; words: number; completed_at: string | null; vorschlag: number }, unitId: number): OffenerText {
  const vorschlag = Boolean(x.vorschlag);
  return {
    key: `t${x.id}`,
    art: "text",
    textId: x.id,
    quelle: "text",
    grund: "frei",
    grundText: vorschlag ? "Ein Vorschlag liegt bereit. Er zählt erst, wenn du ihn übernimmst." : "",
    studentId: x.student_id,
    unitId,
    titel: x.title,
    woerter: x.words,
    vorschlag,
    linkText: vorschlag ? "Bewertung übernehmen" : "Korrigieren",
    href: vorschlag ? `/texte/${x.id}/korrektur?teil=aufgabe` : `/texte/${x.id}/korrektur`,
    am: x.completed_at ?? "",
  };
}

/** Die Texte mit „Bewertung offen“: einer Einheit (in ihrer Dokumentation), sonst alle des Schülers (in ihrer letzten Einheit). */
function offeneTexte(o: { unitId: number; studentId: number } | { studentId: number }): OffenerText[] {
  const rows = db()
    .prepare(
      `SELECT x.id, x.student_id, x.title, x.words, x.prompt, x.completed_at, COALESCE(b.vorschlag, '') <> '' AS vorschlag
       FROM texts x LEFT JOIN text_bewertungen b ON b.text_id = x.id
       WHERE x.student_id = @studentId AND x.status = 'fertig' AND x.archived_at IS NULL AND b.bestaetigt_at IS NULL
         AND EXISTS (SELECT 1 FROM text_units tu WHERE tu.text_id = x.id ${"unitId" in o ? "AND tu.unit_id = @unitId" : ""})
       ORDER BY x.completed_at, x.id`,
    )
    .all(o) as { id: number; student_id: number; title: string; words: number; prompt: string; completed_at: string | null; vorschlag: number }[];
  return rows.flatMap((x) => {
    if (!arbeitsauftraege(x.prompt).punkte.length) return [];
    const unitId = "unitId" in o ? o.unitId : letzteEinheitDesTexts(x.id);
    return unitId && bewertungFuerBericht(x.id, unitId)?.stand === "offen" ? [offenerText(x, unitId)] : [];
  });
}

/**
 * Die eine Liste „Zu bewerten“: einer Einheit (nur ihr Schüler) oder eines Schülers (alle Einheiten und ohne Einheit). Zuerst die
 * Antworten (älteste zuerst), dann die Texte. Leer, wenn es die Einheit oder den Schüler nicht gibt.
 */
export function zuBewerten(o: { unitId: number } | { studentId: number }): ZuBewerten[] {
  const unit = "unitId" in o ? getUnit(o.unitId) : null;
  // the homework that belongs into this unit (lib/hausuebung-zurueck.ts): its open answers are shown here too
  const hw = unit ? hausuebungFuerEinheit(unit.student_id, { vor: unit.started_at, fach: unit.subject ?? "", ausser: unit.id }) : null;
  const wo = unit ? { unitId: unit.id, studentId: unit.student_id, hwAssignment: hw?.assignmentId ?? 0 } : "studentId" in o && repo.getStudent(o.studentId) ? { studentId: o.studentId } : null;
  if (!wo) return [];
  return [...offeneAntworten(wo), ...offeneTexte(wo)];
}

/** Wie viele Antworten offen sind (ohne Texte; die haben im Abschluss ihre eigene Zeile „Bewertung offen“). */
export const offeneAntwortenZahl = (zeilen: ZuBewerten[]) => zeilen.filter((z) => z.art === "antwort").length;

/** Wie viele Antworten dieser Einheit offen sind, ohne die der Hausübung (die ist kein Unterricht und hat ihre eigene Zeile). */
export const offeneDerEinheit = (zeilen: ZuBewerten[]) => zeilen.filter((z) => z.art === "antwort" && z.quelle !== "hausuebung").length;

/** „3 Antworten“ / „1 Antwort“ */
export const antwortenText = (n: number) => `${n} ${n === 1 ? "Antwort" : "Antworten"}`;

/** Die Überschrift der Liste: „3 Antworten noch zu bewerten“, „2 Antworten und 1 Text noch zu bewerten“. */
export function zuBewertenTitel(zeilen: ZuBewerten[]): string {
  const a = offeneAntwortenZahl(zeilen);
  const t = zeilen.length - a;
  return `${[a ? antwortenText(a) : "", t ? `${t} ${t === 1 ? "Text" : "Texte"}` : ""].filter(Boolean).join(" und ")} noch zu bewerten`;
}
