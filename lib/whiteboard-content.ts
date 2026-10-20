/** App content prepared for the whiteboard (server side). Task positions count from 1. */
import { figurBeschreibung, figurSzene } from "./figur";
import * as repo from "./repo";
import { GAP, kreisZahl } from "./tasks";
import { maturaLoesung } from "./matura-formate";
import type { TaskForBoard } from "./whiteboard-templates";

export function boardTask(t: repo.Task): TaskForBoard {
  // the maths formats: the equation or term below the prompt, the parts a), b), c) as lines of their own
  // Matura-Formate (lib/matura-formate.ts): beim Lückentext heißen die Lücken ① ② und darunter stehen je Lücke die
  // Satzteile; bei der Zuordnung die Aussagen 1, 2 und die Antworten als A bis D
  const luecken = t.data.gapOptions;
  const z = t.type === "zuordnung" ? t.data.zuordnung : undefined;
  const extra = luecken
    ? luecken.map((g, i) => `${kreisZahl(i + 1)}  ${g.join("  ·  ")}`)
    : z
      ? z.statements.map((s, i) => `${i + 1}  ${s}`)
      : t.type === "rechenweg" && t.data.start
        ? [t.data.start]
        : t.type === "sachaufgabe"
          ? (t.data.parts ?? []).map((p, i) => `${p.label || `${String.fromCharCode(97 + i)})`} ${p.prompt}`)
          : [];
  const prompt = luecken ? t.prompt.split(GAP).reduce((a, b, k) => `${a}${kreisZahl(k)}${b}`) : t.prompt;
  // die Lösung an der Tafel nennt bei 2 aus 5, Lückentext und Zuordnung zuerst die Kreuze (nur für den Lehrer, nie am Schülergerät)
  const kreuze = maturaLoesung(t);
  // Aufgabe mit Bild: das Bild ohne Lösung (so darf es auch das Schülergerät zeichnen), dazu in Worten
  const bild = t.data.figure ? { figure: figurSzene(t.data.figure), figureText: figurBeschreibung(t.data.figure) } : {};
  return { number: t.position, prompt: [prompt, ...extra].join("\n"), options: z ? z.options : (t.data.options ?? t.data.steps ?? null), solution: kreuze ? `Lösung: ${kreuze}\n${t.solution}` : t.solution, taskId: t.id, ...bild };
}

/** What goes onto the board through the insert queue: the student's device may draw it, so never the solution. */
export function boardTaskForStudent(t: repo.Task): TaskForBoard {
  const b = boardTask(t);
  return { number: b.number, prompt: b.prompt, options: b.options, taskId: b.taskId, ...(b.figure !== undefined ? { figure: b.figure, figureText: b.figureText } : {}) };
}

/** The student's most recent exercises, for the teacher's "Einfügen" panel. */
export function worksheetsForBoard(studentId: number, limit = 8) {
  const seen = new Set<number>();
  const out: { id: number; title: string; tasks: TaskForBoard[] }[] = [];
  for (const a of repo.listAssignments(studentId)) {
    if (seen.has(a.worksheet_id) || out.length >= limit) continue;
    seen.add(a.worksheet_id);
    out.push({ id: a.worksheet_id, title: a.title, tasks: repo.listTasks(a.worksheet_id).map(boardTask) });
  }
  return out;
}
