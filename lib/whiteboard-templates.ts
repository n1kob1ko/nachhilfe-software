/**
 * Content the teacher can put on the whiteboard, built from native whiteboard elements (text,
 * lines, rectangles), not from images, so the student can write right next to or into it.
 *
 * Every function returns element skeletons placed relative to `at` (top-left corner); the board
 * turns them into real elements with Excalidraw's convertToExcalidrawElements. Backgrounds such as
 * grids and task texts are locked, so a student cannot move or erase them by accident.
 */
import { textBreite, type Szene } from "./figur";
import { parseMath, type MathNode } from "./math-format";

export type Skeleton = Record<string, unknown> & { type: string; x: number; y: number };
export type Point = { x: number; y: number };
export type TaskForBoard = {
  number: number;
  prompt: string;
  options: string[] | null;
  solution?: string;
  taskId?: number;
  /** Aufgabe mit Bild: das Bild als Szene ohne Lösung (lib/figur.ts figurSzene), gezeichnet mit Tafel-Elementen */
  figure?: Szene | null;
  /** dasselbe in Worten, falls das Bild nicht gezeichnet werden kann */
  figureText?: string | null;
};
/**
 * Which task of one insert an element belongs to (Excalidraw's customData, the only custom data the server keeps,
 * lib/whiteboard.ts). The task bar on the board finds the tasks by it; `task` and `ws` let the teacher grade them.
 */
export type TaskTag = { n: number; set: string; task?: number; ws?: number };
/** Width of a text in the board's font, measured in the browser. Without it fractions stay as "3/4". */
export type Measure = (text: string, fontSize: number) => number;

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
  width: Math.abs(dx),
  height: Math.abs(dy),
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

/** Words of a line; a bracket stays on one line with what is in it ("(2a^2 · b)^3"). */
function words(para: string): string[] {
  const out: string[] = [];
  let depth = 0;
  for (const w of para.split(/\s+/)) {
    if (depth > 0 && out.length) out[out.length - 1] += ` ${w}`;
    else out.push(w);
    depth = Math.max(0, depth + (w.match(/\(/g)?.length ?? 0) - (w.match(/\)/g)?.length ?? 0));
  }
  return out;
}

/** Wraps long task texts so they stay readable on a tablet. */
function wrap(s: string, max = 58): string {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const word of words(para)) {
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
const LINE = 1.35; // Excalidraw's line height for Nunito

const SUP_DIGITS: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "−": "⁻", "+": "⁺", n: "ⁿ", x: "ˣ", "(": "⁽", ")": "⁾" };

/** Roots as text ("√16", "√(x+1)"), so a line only holds text, powers and fractions. */
function flatRoots(nodes: MathNode[]): MathNode[] {
  return nodes.flatMap((n): MathNode[] => {
    if (typeof n === "string") return [n];
    if (n.t === "sup") return [{ t: "sup", body: flatRoots(n.body) }];
    if (n.t === "frac") return [{ ...n, num: flatRoots(n.num), den: flatRoots(n.den) }];
    const body = flatRoots(n.body);
    return body.length === 1 && typeof body[0] === "string" && /^[\p{L}\p{N}]+$/u.test(body[0]) ? [`√${body[0]}`] : ["√(", ...body, ")"];
  });
}

/** One line as plain text: powers as small raised digits where there are such signs (x², 2⁻³), fractions with "/". */
function plain(nodes: MathNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === "string") return n;
      if (n.t === "sup") {
        const s = plain(n.body);
        return [...s].every((c) => SUP_DIGITS[c]) ? [...s].map((c) => SUP_DIGITS[c]).join("") : `^(${s})`;
      }
      if (n.t === "root") return plain(flatRoots([n]));
      const part = (x: MathNode[]) => (x.length === 1 && typeof x[0] === "string" && /^[\p{L}\p{N}]+$/u.test(x[0]) ? x[0] : `(${plain(x)})`);
      return `${n.minus ? "−" : ""}${part(n.num)}/${part(n.den)}`;
    })
    .join("");
}

const hasMath = (nodes: MathNode[]) => nodes.some((n) => typeof n !== "string");
const supSize = (fontSize: number) => Math.max(12, Math.round(fontSize * 0.62));

/** Width of a run of text and powers in the board's font. */
function widthOf(nodes: MathNode[], fontSize: number, measure: Measure): number {
  let w = 0;
  for (const n of nodes) {
    if (typeof n === "string") w += measure(n, fontSize);
    else if (n.t === "sup") w += widthOf(n.body, supSize(fontSize), measure) + 2;
    else w += measure(plain([n]), fontSize);
  }
  return w;
}

/**
 * Places a run of text and powers with its top at y; a power is a smaller text, raised to sit like x². Returns
 * the width it takes.
 */
function placeRun(nodes: MathNode[], x: number, y: number, fontSize: number, measure: Measure, extra: Partial<Skeleton>, out: Skeleton[]): number {
  let cx = x;
  for (const n of nodes) {
    if (typeof n === "string") {
      if (n.trim()) out.push(text(n, cx, y, { fontSize, ...extra }));
      cx += measure(n, fontSize);
    } else if (n.t === "sup") {
      // same top as the text: the smaller font's baseline then sits about 0.4 of a line higher
      cx += placeRun(n.body, cx + 1, y - fontSize * 0.04, supSize(fontSize), measure, extra, out) + 2;
    } else {
      const t = plain([n]);
      out.push(text(t, cx, y, { fontSize, ...extra }));
      cx += measure(t, fontSize);
    }
  }
  return cx - x;
}

/**
 * A wrapped text with its maths set like on paper: fractions as numerator, bar and denominator, powers raised
 * (x² instead of x^2), roots with √. Each line with maths becomes text pieces placed side by side, measured with
 * the board's font. Without a measure (or without maths) it stays one text, powers as ² ³ where possible.
 */
function mathText(s: string, x: number, y: number, fontSize: number, measure: Measure | undefined, extra: Partial<Skeleton> = {}): { elements: Skeleton[]; height: number } {
  const rows = s.split("\n").map((r) => flatRoots(parseMath(r)));
  if (!measure || !rows.some(hasMath)) {
    const t = rows.map(plain).join("\n");
    return { elements: [text(t, x, y, { fontSize, ...extra })], height: lines(t) * fontSize * LINE };
  }
  const small = Math.round(fontSize * 0.78);
  const tag = extra.customData ? { customData: extra.customData } : {};
  const elements: Skeleton[] = [];
  let top = y;
  for (const row of rows) {
    if (!hasMath(row)) {
      const t = plain(row);
      if (t) elements.push(text(t, x, top, { fontSize, ...extra }));
      top += fontSize * LINE;
      continue;
    }
    const tall = row.some((n) => typeof n !== "string" && n.t === "frac");
    const height = tall ? small * LINE * 2 + 6 : fontSize * LINE;
    const mid = top + (height - fontSize * LINE) / 2;
    let cx = x;
    for (const n of row) {
      if (typeof n === "string" || n.t !== "frac") {
        cx += placeRun([n], cx, mid, fontSize, measure, extra, elements);
        continue;
      }
      if (n.minus) cx += placeRun(["−"], cx, mid, fontSize, measure, extra, elements);
      const wn = widthOf(n.num, small, measure);
      const wd = widthOf(n.den, small, measure);
      const w = Math.max(wn, wd) + 10;
      placeRun(n.num, cx + (w - wn) / 2, top, small, measure, extra, elements);
      elements.push(line(cx + 2, top + small * LINE + 3, w - 4, 0, { strokeColor: (extra.strokeColor as string) ?? INK, strokeWidth: 2, locked: extra.locked ?? false, ...tag }));
      placeRun(n.den, cx + (w - wd) / 2, top + small * LINE + 6, small, measure, extra, elements);
      cx += w + 2;
    }
    top += height + (tall ? 4 : 0);
  }
  return { elements, height: top - y };
}

/** Width of the dashed area to calculate in; the task bar on the board uses it to fit a task on the screen. */
export const WORK_WIDTH = 900;

/**
 * One or more tasks, each with a dashed area underneath to calculate in. With `set` every piece of a task is
 * tagged (TaskTag), so the board can list the tasks, jump to one and let the teacher grade it.
 */
export function tasksTemplate(tasks: TaskForBoard[], at: Point, opts: { title?: string; workHeight?: number; measure?: Measure; set?: string; worksheetId?: number } = {}): Skeleton[] {
  const out: Skeleton[] = [];
  let y = at.y;
  if (opts.title) {
    out.push(text(opts.title, at.x, y, { fontSize: 20, strokeColor: "#6b7280", locked: true }));
    y += 40;
  }
  for (const t of tasks) {
    const tag: TaskTag | null = opts.set ? { n: t.number, set: opts.set, ...(t.taskId ? { task: t.taskId } : {}), ...(opts.worksheetId ? { ws: opts.worksheetId } : {}) } : null;
    const extra: Partial<Skeleton> = { locked: true, ...(tag ? { customData: { aufgabe: tag } } : {}) };
    const prompt = mathText(wrap(`${t.number}) ${t.prompt}`), at.x, y, 30, opts.measure, extra);
    out.push(...prompt.elements);
    y += prompt.height + 10;
    // Aufgabe mit Bild: das Bild unter der Frage, aus Linien und Texten (gesperrt wie die Aufgabe); sonst in Worten
    if (t.figure) {
      const bild = figureTemplate(t.figure, { x: at.x + 12, y: y + 6 }, { measure: opts.measure, extra });
      out.push(...bild.elements);
      y += bild.height + 22;
    } else if (t.figureText) {
      const bild = mathText(wrap(`Bild: ${t.figureText}`), at.x, y, 22, undefined, { ...extra, strokeColor: "#4b5563" });
      out.push(...bild.elements);
      y += bild.height + 10;
    }
    if (t.options?.length) {
      const options = mathText(t.options.map((o, i) => `${String.fromCharCode(65 + i)})  ${o}`).join("\n"), at.x + 24, y, 26, opts.measure, extra);
      out.push(...options.elements);
      y += options.height + 10;
    }
    // room for a few lines of working: maths is written on the board, not typed
    const h = opts.workHeight ?? 300;
    out.push({ type: "rectangle", x: at.x, y, width: WORK_WIDTH, height: h, strokeColor: SOFT, strokeStyle: "dashed", strokeWidth: 1, roughness: 0, backgroundColor: "transparent", roundness: null, ...extra });
    y += h + 50;
  }
  return out;
}

/**
 * Das Bild einer Aufgabe mit Bild auf der Tafel: dieselbe Szene wie am Bildschirm und am Blatt (lib/figur.ts), nur
 * aus Tafel-Elementen (Linien, Ellipsen, Texte), damit man daneben und hinein schreiben kann. Höchstens so breit wie
 * das Rechenfeld. Gibt die Elemente und die Größe auf der Tafel zurück.
 */
export function figureTemplate(s: Szene, at: Point, opts: { measure?: Measure; extra?: Partial<Skeleton>; maxWidth?: number } = {}): { elements: Skeleton[]; width: number; height: number } {
  const k = Math.min(1.6, (opts.maxWidth ?? WORK_WIDTH - 24) / Math.max(1, s.b));
  const X = (x: number) => at.x + x * k;
  const Y = (y: number) => at.y + y * k;
  const base: Partial<Skeleton> = { locked: true, roughness: 0, ...(opts.extra ?? {}) };
  const out: Skeleton[] = [];
  const breite = (str: string, size: number) => (opts.measure ? opts.measure(str, size) : textBreite(str, size));
  const strich = (w: number) => Math.max(1, Math.round(w * k * 0.75 * 2) / 2);
  const schrift = (x: number, y: number, str: string, g: number, a: "start" | "middle" | "end") => {
    const size = Math.round(g * k);
    const w = breite(str, size);
    const x0 = a === "start" ? x : a === "end" ? x - w : x - w / 2;
    out.push(text(str, x0, y - (size * LINE) / 2, { fontSize: size, ...base }));
  };
  for (const t of s.teile) {
    switch (t.t) {
      case "linie": {
        const dx = (t.x2 - t.x1) * k;
        const dy = (t.y2 - t.y1) * k;
        out.push(line(X(t.x1), Y(t.y1), dx, dy, { strokeColor: t.stil === "gitter" ? "#c9ced6" : INK, strokeWidth: t.stil === "gitter" ? 1 : strich(t.w), strokeStyle: t.stil === "strich" ? "dashed" : "solid", ...base }));
        break;
      }
      case "weg": {
        const [x0, y0] = t.p[0];
        const pts = t.p.map(([x, y]) => [(x - x0) * k, (y - y0) * k]);
        if (t.zu) pts.push([0, 0]);
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        out.push({
          type: "line",
          x: X(x0),
          y: Y(y0),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          points: pts,
          strokeColor: INK,
          strokeWidth: strich(t.w),
          backgroundColor: t.fuellung === "voll" ? INK : t.fuellung === "flaeche" ? "#f1f3f7" : t.fuellung === "getoent" ? "#d5dae3" : "transparent",
          fillStyle: "solid",
          strokeStyle: t.stil === "strich" ? "dashed" : "solid",
          ...base,
        });
        break;
      }
      case "punkt":
        out.push({ type: "ellipse", x: X(t.x - t.r), y: Y(t.y - t.r), width: 2 * t.r * k, height: 2 * t.r * k, strokeColor: INK, strokeWidth: t.offen ? 2 : 1, backgroundColor: t.offen ? "#ffffff" : INK, fillStyle: "solid", ...base });
        break;
      case "text":
        schrift(X(t.x), Y(t.y), t.s, t.g, t.a);
        break;
      case "bruch": {
        const size = Math.round(t.g * k);
        const w = Math.max(breite(t.z, size), breite(t.n, size)) + 6;
        schrift(X(t.x), Y(t.y - t.g * 0.62), t.z, t.g, "middle");
        out.push(line(X(t.x) - w / 2, Y(t.y), w, 0, { strokeColor: INK, strokeWidth: 2, ...base }));
        schrift(X(t.x), Y(t.y + t.g * 0.66), t.n, t.g, "middle");
        if (t.minus) schrift(X(t.x) - w / 2 - 4, Y(t.y), "−", t.g, "end");
        break;
      }
    }
  }
  return { elements: out, width: s.b * k, height: s.h * k };
}

/** A solution shown by the teacher, in green. */
export function solutionTemplate(t: TaskForBoard, at: Point, measure?: Measure): Skeleton[] {
  return mathText(wrap(`Lösung ${t.number}: ${t.solution ?? ""}`), at.x, at.y, 24, measure, { strokeColor: "#15803d" }).elements;
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
