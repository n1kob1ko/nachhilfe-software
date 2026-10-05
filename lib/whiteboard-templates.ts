/**
 * Content the teacher can put on the whiteboard, built from native whiteboard elements (text,
 * lines, rectangles), not from images, so the student can write right next to or into it.
 *
 * Every function returns element skeletons placed relative to `at` (top-left corner); the board
 * turns them into real elements with Excalidraw's convertToExcalidrawElements. Backgrounds such as
 * grids and task texts are locked, so a student cannot move or erase them by accident.
 */
export type Skeleton = Record<string, unknown> & { type: string; x: number; y: number };
export type Point = { x: number; y: number };
export type TaskForBoard = { number: number; prompt: string; options: string[] | null; solution?: string };

const NUNITO = 6;
const INK = "#1e1e1e";
const SOFT = "#c3cad6";
const ACCENT = "#1f4fd1";

const text = (t: string, x: number, y: number, extra: Partial<Skeleton> = {}): Skeleton => ({
  type: "text",
  text: t,
  x,
  y,
  fontSize: 26,
  fontFamily: NUNITO,
  strokeColor: INK,
  ...extra,
});

const line = (x: number, y: number, dx: number, dy: number, extra: Partial<Skeleton> = {}): Skeleton => ({
  type: "line",
  x,
  y,
  points: [
    [0, 0],
    [dx, dy],
  ],
  strokeColor: SOFT,
  strokeWidth: 1,
  roughness: 0,
  locked: true,
  ...extra,
});

/** Wraps long task texts so they stay readable on a tablet. */
function wrap(s: string, max = 58): string {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/)) {
      if (cur && (cur + " " + word).length > max) {
        out.push(cur);
        cur = word;
      } else cur = cur ? `${cur} ${word}` : word;
    }
    out.push(cur);
  }
  return out.join("\n");
}

const lines = (s: string) => s.split("\n").length;

/** One or more tasks, each with a dashed area underneath to calculate in. */
export function tasksTemplate(tasks: TaskForBoard[], at: Point, opts: { title?: string; workHeight?: number } = {}): Skeleton[] {
  const out: Skeleton[] = [];
  let y = at.y;
  if (opts.title) {
    out.push(text(opts.title, at.x, y, { fontSize: 20, strokeColor: "#6b7280", locked: true }));
    y += 40;
  }
  for (const t of tasks) {
    const prompt = wrap(`${t.number}) ${t.prompt}`);
    out.push(text(prompt, at.x, y, { fontSize: 30, locked: true }));
    y += lines(prompt) * 38 + 10;
    if (t.options?.length) {
      const opts2 = t.options.map((o, i) => `${String.fromCharCode(65 + i)})  ${o}`).join("\n");
      out.push(text(opts2, at.x + 24, y, { fontSize: 26, locked: true }));
      y += t.options.length * 34 + 10;
    }
    const h = opts.workHeight ?? 220;
    out.push({ type: "rectangle", x: at.x, y, width: 900, height: h, strokeColor: SOFT, strokeStyle: "dashed", strokeWidth: 1, roughness: 0, backgroundColor: "transparent", locked: true, roundness: null });
    y += h + 50;
  }
  return out;
}

/** A solution shown by the teacher, in green. */
export function solutionTemplate(t: TaskForBoard, at: Point): Skeleton[] {
  return [text(wrap(`Lösung ${t.number}: ${t.solution ?? ""}`), at.x, at.y, { fontSize: 24, strokeColor: "#15803d" })];
}

export function textTemplate(s: string, at: Point, opts: { size?: number; framed?: boolean } = {}): Skeleton[] {
  const t = wrap(s.trim(), opts.size && opts.size > 30 ? 40 : 60);
  const size = opts.size ?? 26;
  const out: Skeleton[] = [];
  if (opts.framed) {
    const width = Math.min(1000, Math.max(...t.split("\n").map((l) => l.length)) * size * 0.55 + 48);
    out.push({ type: "rectangle", x: at.x, y: at.y, width, height: lines(t) * size * 1.3 + 36, strokeColor: ACCENT, backgroundColor: "#eef3ff", fillStyle: "solid", strokeWidth: 1, roughness: 0, roundness: { type: 3 }, locked: true });
    out.push(text(t, at.x + 24, at.y + 18, { fontSize: size }));
  } else out.push(text(t, at.x, at.y, { fontSize: size }));
  return out;
}

/** Formulas as typed by teachers: "x^2", "sqrt(16)", "3*4", "<=" become readable symbols. */
export function prettyFormula(s: string): string {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", n: "ⁿ" };
  return s
    .replace(/\^(-?[0-9n]+)/g, (_, e: string) => [...e].map((c) => sup[c] ?? c).join(""))
    .replace(/sqrt\(([^)]*)\)/g, "√($1)")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/\*/g, "·")
    .replace(/\bpi\b/g, "π");
}

export function formulaTemplate(s: string, at: Point): Skeleton[] {
  return [text(prettyFormula(s.trim()), at.x, at.y, { fontSize: 40 })];
}

/** Empty table with optional column headings; cells are big enough to write in with a pen. */
export function tableTemplate(rows: number, cols: number, at: Point, headings: string[] = []): Skeleton[] {
  const cw = 180;
  const rh = 64;
  const out: Skeleton[] = [];
  const w = cols * cw;
  const h = rows * rh;
  for (let r = 0; r <= rows; r++) out.push(line(at.x, at.y + r * rh, w, 0, { strokeColor: INK, strokeWidth: r === 0 || r === rows || (r === 1 && headings.length) ? 2 : 1 }));
  for (let c = 0; c <= cols; c++) out.push(line(at.x + c * cw, at.y, 0, h, { strokeColor: INK, strokeWidth: c === 0 || c === cols ? 2 : 1 }));
  headings.slice(0, cols).forEach((hd, i) => hd && out.push(text(hd, at.x + i * cw + 14, at.y + 16, { fontSize: 24, locked: true })));
  return out;
}

/** Coordinate system with grid, axes, ticks and numbers. Unit = 40 px. */
export function coordinateTemplate(at: Point, range = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }): Skeleton[] {
  const u = 40;
  const out: Skeleton[] = [];
  const ox = at.x + (0 - range.xMin) * u;
  const oy = at.y + range.yMax * u;
  const left = at.x;
  const right = at.x + (range.xMax - range.xMin) * u;
  const top = at.y;
  const bottom = at.y + (range.yMax - range.yMin) * u;
  for (let x = range.xMin; x <= range.xMax; x++) if (x !== 0) out.push(line(ox + x * u, top, 0, bottom - top, { strokeColor: "#e2e7ef" }));
  for (let y = range.yMin; y <= range.yMax; y++) if (y !== 0) out.push(line(left, oy - y * u, right - left, 0, { strokeColor: "#e2e7ef" }));
  out.push({ type: "arrow", x: left - 10, y: oy, points: [[0, 0], [right - left + 40, 0]], strokeColor: INK, strokeWidth: 2, roughness: 0, endArrowhead: "arrow", startArrowhead: null, locked: true });
  out.push({ type: "arrow", x: ox, y: bottom + 10, points: [[0, 0], [0, -(bottom - top + 40)]], strokeColor: INK, strokeWidth: 2, roughness: 0, endArrowhead: "arrow", startArrowhead: null, locked: true });
  out.push(text("x", right + 36, oy + 6, { fontSize: 22, locked: true }));
  out.push(text("y", ox + 10, top - 44, { fontSize: 22, locked: true }));
  for (let x = range.xMin; x <= range.xMax; x++) {
    if (x === 0) continue;
    out.push(line(ox + x * u, oy - 5, 0, 10, { strokeColor: INK, strokeWidth: 1 }));
    out.push(text(String(x), ox + x * u - (x < 0 ? 10 : 5), oy + 8, { fontSize: 16, strokeColor: "#4b5563", locked: true }));
  }
  for (let y = range.yMin; y <= range.yMax; y++) {
    if (y === 0) continue;
    out.push(line(ox - 5, oy - y * u, 10, 0, { strokeColor: INK, strokeWidth: 1 }));
    out.push(text(String(y), ox - 28, oy - y * u - 10, { fontSize: 16, strokeColor: "#4b5563", locked: true }));
  }
  out.push(text("0", ox - 18, oy + 6, { fontSize: 16, strokeColor: "#4b5563", locked: true }));
  return out;
}

/** Squared paper (Karopapier), 30 px squares. */
export function gridTemplate(at: Point, width = 1200, height = 840, size = 30): Skeleton[] {
  const out: Skeleton[] = [];
  for (let x = 0; x <= width; x += size) out.push(line(at.x + x, at.y, 0, height));
  for (let y = 0; y <= height; y += size) out.push(line(at.x, at.y + y, width, 0));
  return out;
}

/** Lined paper with a margin, 44 px line spacing for handwriting. */
export function linedTemplate(at: Point, width = 1200, height = 880, gap = 44): Skeleton[] {
  const out: Skeleton[] = [];
  for (let y = gap; y <= height; y += gap) out.push(line(at.x, at.y + y, width, 0));
  out.push(line(at.x + 80, at.y, 0, height, { strokeColor: "#f2a7a7" }));
  return out;
}
