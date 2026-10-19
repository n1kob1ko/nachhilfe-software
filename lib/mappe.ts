/**
 * Mappe einer Einheit: alles, was der Schüler in der Einheit gemacht hat, als ein A4-Dokument für die
 * Schulmappe. niko, 2026-10-19: „dass halt alles, was gemacht wurde am Ende der Einheit, in ein PDF
 * kommt. Also die Übungen, die er gemacht hat, alle, auch wenn es mehrere Übungen waren.“
 *
 * Wie beim Arbeitsblatt wird nichts gespeichert (ADR 0001): die Seite app/arbeitsblatt/einheit/[id]
 * baut die Mappe bei jedem Aufruf aus den Antworten der Einheit, das PDF macht der Druckdialog des
 * Browsers. Zur Mappe gehören die Übungen mit den Antworten des Schülers, die Textarbeiten und die
 * benutzten Seiten des Whiteboards.
 */
import { readMathAnswer } from "./math-check";
import * as repo from "./repo";
import { klassenLabel, stufeLabel } from "./school";
import { GAP, sameAnswer } from "./tasks";
import { textsForUnit, getText, textDoc, type TextView } from "./texts";
import type { TextDoc } from "./text-doc";
import { getPictureStory, storyImages, type PictureStory, type StoryImage } from "./picture-story";
import { getUnit, type UnitView } from "./units";
import { boardForUnit, listPages, type PageInfo } from "./whiteboard";

// ---------- die Antwort des Schülers ----------

/** Die Antwort so, wie sie auf Papier steht; je Antwortformat anders gespeichert (siehe repo.Attempt.answer). */
export type Antwort =
  | { art: "wahl"; index: number | null }
  | { art: "reihe"; schritte: string[] }
  | { art: "luecken"; werte: string[] }
  | { art: "rechnung"; schritte: string[]; ergebnis: string; tafel: boolean }
  | { art: "teile"; teile: { schritte: string[]; ergebnis: string; text: string }[] }
  | { art: "text"; text: string };

const zeilen = (xs: string[] | undefined) => (xs ?? []).filter((x) => x.trim());

/** Liest eine gespeicherte Antwort: Auswahl als Index, Reihenfolge und Lücken als JSON-Liste, Rechenweg als JSON-Objekt, sonst Text. */
export function leseAntwort(t: Pick<repo.Task, "type" | "data" | "answer">, raw: string): Antwort {
  if (t.type === "rechenweg") {
    const a = readMathAnswer(raw);
    return { art: "rechnung", schritte: zeilen(a.steps), ergebnis: a.result?.trim() ?? "", tafel: Boolean(a.board) };
  }
  if (t.type === "sachaufgabe") {
    const a = readMathAnswer(raw);
    return {
      art: "teile",
      teile: (t.data.parts ?? []).map((_, i) => {
        const p = a.parts?.[i];
        return { schritte: zeilen(p?.steps), ergebnis: p?.result?.trim() ?? "", text: p?.text?.trim() ?? "" };
      }),
    };
  }
  if (t.data.options) {
    const i = raw.trim() === "" ? NaN : Number(raw);
    return { art: "wahl", index: Number.isInteger(i) && t.data.options[i] !== undefined ? i : null };
  }
  if (t.data.steps) {
    try {
      const order = JSON.parse(raw) as unknown;
      if (Array.isArray(order)) return { art: "reihe", schritte: order.map((i) => t.data.steps![Number(i)]).filter((x): x is string => typeof x === "string") };
    } catch {
      // ältere Antworten: als Text
    }
    return { art: "text", text: raw };
  }
  if (t.answer.blanks) {
    try {
      const werte = JSON.parse(raw) as unknown;
      if (Array.isArray(werte)) return { art: "luecken", werte: werte.map((w) => String(w ?? "")) };
    } catch {
      // eine einzelne Lücke als Text
    }
    return { art: "luecken", werte: [raw] };
  }
  return { art: "text", text: raw };
}

/** Eine Textantwort, die in die einzige Lücke der Aufgabe gehört („3 + 4 = ___“), statt darunter zu stehen. */
export function inDieLuecke(t: Pick<repo.Task, "prompt" | "data" | "answer">, a: Antwort): boolean {
  return a.art === "text" && !t.data.options && !t.answer.blanks && t.prompt.split(GAP).length === 2;
}

/** Was in einer Lücke der Mappe steht: die Antwort des Schülers, eine falsche markiert und auf Wunsch die richtige daneben. */
export type LueckenEintrag = { text: string; falsch?: boolean; richtig?: string };

/**
 * Die Einträge für die Lücken einer Aufgabe, oder undefined, wenn die Antwort nicht in Lücken gehört.
 * `markieren` (nur bei einer Aufgabe mit Fehler): jede Lücke einzeln mit der Lösung vergleichen, wie beim
 * Bewerten (lib/tasks.ts); `loesung`: bei einer falschen Lücke die richtige Antwort dazuschreiben.
 */
export function lueckenFuerMappe(
  t: Pick<repo.Task, "prompt" | "data" | "answer">,
  a: Antwort | null,
  o: { markieren: boolean; loesung: boolean },
): LueckenEintrag[] | undefined {
  const werte = a?.art === "luecken" ? a.werte : a && inDieLuecke(t, a) && a.art === "text" ? [a.text] : !a && t.answer.blanks ? [] : undefined;
  if (!werte) return undefined;
  const erwartet = t.answer.blanks ?? [t.answer.accepted ?? []];
  return Array.from({ length: Math.max(werte.length, erwartet.length) }, (_, i) => {
    const text = (werte[i] ?? "").trim();
    const moeglich = erwartet[i] ?? [];
    if (!o.markieren || !moeglich.length || moeglich.some((m) => sameAnswer(text, m, t.answer.mode ?? "text"))) return { text };
    return { text, falsch: true, ...(o.loesung ? { richtig: moeglich[0] } : {}) };
  });
}

// ---------- die Mappe ----------

/** Wie eine Aufgabe ausgegangen ist; `nicht` = in dieser Einheit nicht bearbeitet. */
export type Bewertung = "richtig" | "teilweise" | "falsch" | "loesung" | "offen" | "nicht";

export type MappeAufgabe = {
  task: repo.Task;
  bewertung: Bewertung;
  /** die letzte echte Antwort in der Einheit (ohne „Lösung ansehen“) */
  antwort: Antwort | null;
  /** im wievielten Versuch die gezeigte Antwort kam */
  versuch: number;
};

export type MappeUebung = {
  assignmentId: number;
  worksheet: repo.Worksheet;
  /** Titel ohne vorangestellten Vornamen („Max – Bruchrechnen“ → „Bruchrechnen“); der Name steht oben auf der Mappe */
  titel: string;
  klasse: string;
  /** alle Aufgaben der Übung in ihrer Reihenfolge, auch die nicht bearbeiteten */
  aufgaben: MappeAufgabe[];
  bearbeitet: number;
  richtig: number;
};

export type MappeText = { text: TextView; doc: TextDoc; story: PictureStory | null; bilder: StoryImage[] };

export type Mappe = {
  unit: UnitView;
  student: repo.Student;
  klasse: string;
  faecher: string[];
  /** Übungen mit Antworten in dieser Einheit, in der Reihenfolge, in der sie bearbeitet wurden */
  uebungen: MappeUebung[];
  /** in der Einheit gesendet, aber nicht begonnen: nur zum Weiterüben, leer gedruckt */
  unbearbeitet: MappeUebung[];
  texte: MappeText[];
  /** Seiten des Whiteboards mit Inhalt und Vorschau */
  tafel: PageInfo[];
};

const zeit = (a: repo.Attempt) => `${a.created_at}|${String(a.id).padStart(10, "0")}`;

function bewerte(list: repo.Attempt[]): Pick<MappeAufgabe, "bewertung" | "versuch"> & { gezeigt: repo.Attempt | null } {
  if (!list.length) return { bewertung: "nicht", versuch: 0, gezeigt: null };
  const fin = list.find((a) => a.final) ?? list[list.length - 1];
  const gezeigt = [...list].reverse().find((a) => !a.solution_viewed) ?? null;
  const bewertung: Bewertung =
    fin.review === "offen" ? "offen" : fin.solution_viewed ? "loesung" : fin.review === "teilweise" ? "teilweise" : fin.correct ? "richtig" : "falsch";
  return { bewertung, versuch: gezeigt?.attempt_no ?? 0, gezeigt };
}

function uebung(assignment: repo.Assignment, vorname: string, versuche: repo.Attempt[]): MappeUebung | null {
  const worksheet = repo.getWorksheet(assignment.worksheet_id);
  if (!worksheet) return null;
  const aufgaben = repo.listTasks(worksheet.id).map((task): MappeAufgabe => {
    const { bewertung, versuch, gezeigt } = bewerte(versuche.filter((a) => a.task_id === task.id));
    return { task, bewertung, versuch, antwort: gezeigt ? leseAntwort(task, gezeigt.answer) : null };
  });
  return {
    assignmentId: assignment.id,
    worksheet,
    titel: vorname && worksheet.title.startsWith(`${vorname} – `) ? worksheet.title.slice(vorname.length + 3) : worksheet.title,
    klasse: worksheet.klasse ? klassenLabel(worksheet.school_type, worksheet.klasse) : stufeLabel(worksheet.grade),
    aufgaben,
    bearbeitet: aufgaben.filter((a) => a.bewertung !== "nicht").length,
    richtig: aufgaben.filter((a) => a.bewertung === "richtig").length,
  };
}

/** Sammelt alles, was in der Einheit entstanden ist. `null`, wenn es die Einheit nicht gibt. */
export function mappeFuerEinheit(unitId: number): Mappe | null {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !student) return null;
  const vorname = student.name.split(" ")[0];

  // auch Antworten, die noch auf die Bewertung warten: geschrieben hat der Schüler sie schon
  const versuche = [...repo.listAttemptsForUnit(unitId), ...repo.pendingReviews({ unitId })].sort((a, b) => zeit(a).localeCompare(zeit(b)));
  const reihenfolge = [...new Set(versuche.map((a) => a.assignment_id))];
  const uebungen = reihenfolge
    .map((id) => {
      const a = repo.getAssignment(id);
      return a ? uebung(a, vorname, versuche.filter((x) => x.assignment_id === id)) : null;
    })
    .filter((u): u is MappeUebung => Boolean(u));
  const unbearbeitet = repo
    .listAssignments(student.id)
    .filter((a) => a.unit_id === unitId && !reihenfolge.includes(a.id))
    .reverse()
    .map((a) => uebung(a, vorname, []))
    .filter((u): u is MappeUebung => Boolean(u));

  const texte = textsForUnit(unitId)
    .map((t): MappeText | null => {
      const text = getText(t.id);
      if (!text) return null;
      const story = getPictureStory(text.id);
      return { text, doc: textDoc(text), story, bilder: story ? storyImages(text.id) : [] };
    })
    .filter((t): t is MappeText => Boolean(t) && (t!.text.words > 0 || t!.bilder.length > 0));

  const board = boardForUnit(unitId);
  const tafel = board ? listPages(board.id).filter((p) => p.element_count > 0 && p.has_preview) : [];

  const faecher = [...new Set([...uebungen.map((u) => u.worksheet.subject), ...texte.map((t) => t.text.subject), unit.subject ?? ""].filter(Boolean))];
  return {
    unit,
    student,
    klasse: student.klasse ? klassenLabel(student.school_type, student.klasse) : stufeLabel(student.grade),
    faecher,
    uebungen,
    unbearbeitet,
    texte,
    tafel,
  };
}

/** Gibt es etwas für die Mappe? Für den Knopf „Mappe drucken“: ohne Inhalt keinen Knopf. */
export function mappeHatInhalt(m: Pick<Mappe, "uebungen" | "texte" | "tafel">): boolean {
  return m.uebungen.length > 0 || m.texte.length > 0 || m.tafel.length > 0;
}

/** „Einheit vom 19.10.2026“: der Titel auf der Mappe und der Name der PDF-Datei; kurz, damit er neben Logo und Namen in eine Zeile passt. */
export function mappeTitel(unit: Pick<UnitView, "started_at">): string {
  return `Einheit vom ${new Date(unit.started_at).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna" })}`;
}
