import type { ClientTask } from "@/components/Solver";
import { answerText } from "@/components/TaskPreview";
import { isGenus } from "@/components/genus";
import { englischFormat, ENGLISCH_TEIL, wortRahmen } from "./englisch-matura-formate";
import { figurSvg } from "./figur";
import { closestVersion } from "./fix-text";
import { readingSet } from "./lesen";
import { gradeMathTask, unknownOf } from "./math-task";
import { isMinitest } from "./quick-round";
import * as repo from "./repo";
import { runningUnitForStudent } from "./units";

/**
 * The tasks of an assignment as the student sees them: no answers, no solutions until a task is
 * finished or the teacher has released them. Used by the student link and by the tablet.
 */
export function clientTasks(assignment: repo.Assignment): ClientTask[] {
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  const hintUses = repo.hintUsesForAssignment(assignment.id);
  const board = Boolean(runningUnitForStudent(assignment.student_id));
  const list = repo.listTasks(w.id);
  // a Leseverständnis: the text is sent once (with the first question) and shown next to the questions
  const reading = readingSet(list);
  // ein Minitest ist wie eine kleine Schularbeit: keine Tipps und keine freigegebenen Lösungen
  const test = isMinitest(assignment.mode);
  return list.map((t, i) => {
    const tries = attempts.filter((a) => a.task_id === t.id);
    const fin = tries.find((a) => a.final);
    return {
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      options: t.data.options ?? null,
      // Matura-Formate (lib/matura-formate.ts): wie viele anzukreuzen sind, die Satzteile je Lücke, die Aussagen
      // und Antworten der Zuordnung. Nie correctAll, pairs oder die Werte in blanks: die sind die Lösung.
      pick: t.answer.correctAll?.length ?? null,
      gapOptions: t.data.gapOptions ?? null,
      zuordnung:
        t.type === "zuordnung" && t.data.zuordnung
          ? {
              statements: t.data.zuordnung.statements,
              options: t.data.zuordnung.options,
              ...(t.data.zuordnung.art ? { art: t.data.zuordnung.art } : {}),
              ...(t.data.zuordnung.choices ? { choices: t.data.zuordnung.choices } : {}),
            }
          : null,
      passage: reading ? null : (t.data.passage ?? null),
      englisch: englischClient(t, Boolean(reading)),
      reading: reading && i === 0 ? { ...reading, lang: w.subject === "Englisch" ? "en" : "de" } : null,
      blanks: t.answer.blanks?.length ?? 0,
      endings: t.answer.endings === true,
      steps: t.type === "order" ? (t.data.steps ?? null) : null,
      hints: test ? [] : t.hints,
      hintsOpened: new Set(hintUses.filter((h) => h.task_id === t.id).map((h) => h.hint_index)).size,
      released: assignment.solutions_visible && !test ? { solution: t.solution, answer: answerText(t) ?? t.answer.sample ?? null } : null,
      triesUsed: tries.length,
      faulty: t.type === "fix" ? (t.data.faulty ?? "") : null,
      lines: t.type === "free" ? (t.data.lines ?? null) : null,
      genus: isGenus(t.data.genus) ? t.data.genus : null,
      // Aufgabe mit Bild: nur das fertige Bild ohne Lösung, nie die Angaben dahinter (sie verraten, wo die Marke steht)
      figur: figurSvg(t.data.figure),
      // eine übernommene Aufgabe nennt ihre Quelle (Referenzsammlung, lib/referenz.ts)
      quelle: t.quelle ?? null,
      math:
        t.type === "rechenweg" || t.type === "sachaufgabe"
          ? {
              start: t.data.start?.trim() || null,
              unknown: t.type === "rechenweg" ? unknownOf(t) : null,
              needWay: t.answer.needWay !== false,
              parts: t.type === "sachaufgabe" ? (t.data.parts ?? []) : null,
              board,
            }
          : null,
      finished: fin
        ? {
            correct: fin.review === "offen" ? null : Boolean(fin.correct),
            solution: t.solution,
            review: fin.review ?? null,
            sample: t.answer.sample ?? null,
            given: t.type === "fix" && !fin.solution_viewed ? fin.answer : null,
            expected: t.type === "fix" ? (fin.correct && t.answer.contractions ? fin.answer : (closestVersion(t.answer.accepted ?? [], fin.answer, t.answer.mode !== "text") ?? null)) : null,
            // the student's own lines with the marks of the check
            math: (t.type === "rechenweg" || t.type === "sachaufgabe") && !fin.solution_viewed ? gradeMathTask(t, fin.answer).view : null,
          }
        : null,
    };
  });
}

/**
 * Englisch-Matura (lib/englisch-matura-formate.ts): was das Gerät zum Format braucht, die Wörter im Kasten,
 * die Wortgrenze und den Rahmen der Wortanzahl. Nie pairs, belege oder die Werte in blanks: die sind die Lösung.
 */
function englischClient(t: repo.Task, reading: boolean): ClientTask["englisch"] {
  const k = englischFormat(t);
  if (!k) return null;
  const s = t.data.schreibauftrag;
  return {
    format: k,
    // der Lesetext steht neben den Fragen; bei einem Text für das ganze Blatt zeigt ihn schon der Solver
    lesetext: ENGLISCH_TEIL[k] === "reading" && !reading && t.data.passage?.trim() ? { title: t.data.passageTitle?.trim() ?? "" } : null,
    wortliste: t.data.wortliste ?? null,
    maxWords: t.answer.maxWords ?? null,
    editing: t.data.editing === true,
    schreiben: s ? { textsorte: s.textsorte, woerter: s.woerter, ...wortRahmen(s.woerter) } : null,
  };
}
