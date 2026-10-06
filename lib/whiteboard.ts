/**
 * Shared whiteboard of a unit (server side).
 *
 * Drawing happens in the browser with Excalidraw. Every element carries a `version` that grows with
 * each edit and a random `versionNonce`; two edits of the same element are resolved by keeping the
 * higher version (ties: lower nonce), exactly the rule Excalidraw itself uses for collaboration.
 * The server keeps the merged state of every page and forwards accepted changes to the other
 * devices on the board through Server-Sent Events (see lib/whiteboard-hub.ts).
 *
 * Pages are kept in memory while someone is drawing and written to SQLite shortly after each change,
 * so a fast pen stroke is not one database write per point.
 */
import { db } from "./db";
import { unitChanged } from "./live";
import { publish } from "./whiteboard-hub";
import { getUnit, touchUnit } from "./units";

export type Role = "lehrer" | "schueler";
export type Board = {
  id: number;
  unit_id: number;
  student_id: number;
  teacher_id: number | null;
  current_page_id: number | null;
  created_at: string;
  updated_at: string;
};
export type PageInfo = { id: number; position: number; title: string; updated_at: string; has_preview: number; element_count: number };
/** An Excalidraw element as stored here. Only the fields the merge needs are typed. */
export type El = { id: string; type: string; version: number; versionNonce: number; isDeleted?: boolean; index?: string | null; [k: string]: unknown };
export type InsertPayload =
  | { kind: "tasks"; title: string; tasks: { number: number; prompt: string; options: string[] | null; solution?: string }[] }
  | { kind: "text"; text: string };

const iso = () => new Date().toISOString();

/** Element types that can be drawn on the board. Anything else (embedded websites, images) is refused. */
const ALLOWED_TYPES = new Set(["freedraw", "text", "line", "arrow", "rectangle", "ellipse", "diamond"]);
const MAX_ELEMENTS_PER_PAGE = 20_000;
const MAX_POINTS = 20_000;

// ---------- boards and pages ----------

export function boardForUnit(unitId: number): Board | null {
  return (db().prepare("SELECT * FROM whiteboards WHERE unit_id = ?").get(unitId) as Board | undefined) ?? null;
}

export function getBoard(id: number): Board | null {
  return (db().prepare("SELECT * FROM whiteboards WHERE id = ?").get(id) as Board | undefined) ?? null;
}

/** Every unit has a board. Created with the unit; older units get one the first time it is opened. */
export function ensureBoardForUnit(unitId: number): Board | null {
  const existing = boardForUnit(unitId);
  if (existing) return existing;
  const unit = getUnit(unitId);
  if (!unit) return null;
  const now = iso();
  const create = db().transaction(() => {
    db().prepare("INSERT OR IGNORE INTO whiteboards (unit_id, student_id, teacher_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(unitId, unit.student_id, unit.teacher_id, now, now);
    const board = boardForUnit(unitId)!;
    if (!board.current_page_id) {
      const pageId = Number(db().prepare("INSERT INTO whiteboard_pages (board_id, position, title, updated_at) VALUES (?, 1, 'Seite 1', ?)").run(board.id, now).lastInsertRowid);
      db().prepare("UPDATE whiteboards SET current_page_id = ? WHERE id = ?").run(pageId, board.id);
    }
  });
  create();
  return boardForUnit(unitId);
}

export function listPages(boardId: number): PageInfo[] {
  flushBoard(boardId);
  return db()
    .prepare(
      `SELECT id, position, title, updated_at, preview_svg IS NOT NULL AS has_preview,
        (SELECT COUNT(*) FROM json_each(p.elements) WHERE json_extract(value, '$.isDeleted') IS NOT 1) AS element_count
       FROM whiteboard_pages p WHERE board_id = ? ORDER BY position, id`,
    )
    .all(boardId) as PageInfo[];
}

function pageRow(pageId: number) {
  return db().prepare("SELECT id, board_id, position, title FROM whiteboard_pages WHERE id = ?").get(pageId) as
    | { id: number; board_id: number; position: number; title: string }
    | undefined;
}

export function pageBelongsTo(pageId: number, boardId: number) {
  return pageRow(pageId)?.board_id === boardId;
}

/** The state broadcast whenever pages change: list and the page the teacher shows. */
export function pagesState(boardId: number) {
  const board = getBoard(boardId)!;
  return { pages: listPages(boardId), currentPageId: board.current_page_id };
}

function touchBoard(boardId: number) {
  db().prepare("UPDATE whiteboards SET updated_at = ? WHERE id = ?").run(iso(), boardId);
}

export function addPage(boardId: number, opts: { title?: string; afterPageId?: number; elements?: El[] } = {}): number {
  const pages = listPages(boardId);
  const after = pages.find((p) => p.id === opts.afterPageId);
  const next = after ? pages[pages.indexOf(after) + 1] : undefined;
  const position = after ? (next ? (after.position + next.position) / 2 : after.position + 1) : (pages.at(-1)?.position ?? 0) + 1;
  const title = opts.title?.trim() || `Seite ${pages.length + 1}`;
  const id = Number(
    db()
      .prepare("INSERT INTO whiteboard_pages (board_id, position, title, elements, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(boardId, position, title.slice(0, 80), JSON.stringify(opts.elements ?? []), iso()).lastInsertRowid,
  );
  touchBoard(boardId);
  return id;
}

export function duplicatePage(boardId: number, pageId: number): number | null {
  const src = pageRow(pageId);
  if (!src || src.board_id !== boardId) return null;
  const live = pageElements(pageId).filter((e) => !e.isDeleted);
  // fresh ids, so the copy and the original can be edited independently
  const ids = new Map(live.map((e) => [e.id, `${e.id.slice(0, 12)}-${Math.random().toString(36).slice(2, 10)}`]));
  const copy = live.map((e) => {
    const c: El = { ...e, id: ids.get(e.id)!, version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31) };
    if (typeof c.containerId === "string") c.containerId = ids.get(c.containerId) ?? null;
    if (Array.isArray(c.boundElements)) c.boundElements = (c.boundElements as { id: string; type: string }[]).filter((b) => ids.has(b.id)).map((b) => ({ ...b, id: ids.get(b.id)! }));
    if (Array.isArray(c.groupIds)) c.groupIds = [...(c.groupIds as string[])];
    return c;
  });
  return addPage(boardId, { title: `${src.title} (Kopie)`, afterPageId: pageId, elements: copy });
}

/** Deletes a page. The last page of a board cannot be deleted. Returns the page to show instead. */
export function deletePage(boardId: number, pageId: number): number | null {
  const pages = listPages(boardId);
  const i = pages.findIndex((p) => p.id === pageId);
  if (i < 0 || pages.length <= 1) return null;
  forget(pageId);
  db().prepare("DELETE FROM whiteboard_pages WHERE id = ?").run(pageId);
  const fallback = (pages[i + 1] ?? pages[i - 1]).id;
  const board = getBoard(boardId)!;
  if (board.current_page_id === pageId) setCurrentPage(boardId, fallback);
  touchBoard(boardId);
  return fallback;
}

export function renamePage(boardId: number, pageId: number, title: string) {
  if (!pageBelongsTo(pageId, boardId)) return;
  db().prepare("UPDATE whiteboard_pages SET title = ? WHERE id = ?").run(title.trim().slice(0, 80) || "Seite", pageId);
}

export function setCurrentPage(boardId: number, pageId: number) {
  if (!pageBelongsTo(pageId, boardId)) return;
  db().prepare("UPDATE whiteboards SET current_page_id = ? WHERE id = ?").run(pageId, boardId);
}

/** "Seite leeren": every element is marked deleted with a higher version, so all devices drop it. */
export function clearPage(pageId: number): El[] {
  const now = pageElements(pageId).filter((e) => !e.isDeleted);
  const cleared = now.map((e) => ({ ...e, isDeleted: true, version: e.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) }));
  applyElements(pageId, cleared);
  return cleared;
}

// ---------- elements: in-memory cache with delayed write ----------

type Cached = { boardId: number; els: Map<string, El>; dirty: boolean; timer: NodeJS.Timeout | null };
const g = globalThis as unknown as { __wbPages?: Map<number, Cached> };
const cache = (g.__wbPages ??= new Map());
const FLUSH_MS = 400;

function load(pageId: number): Cached | null {
  const hit = cache.get(pageId);
  if (hit) return hit;
  const row = db().prepare("SELECT board_id, elements FROM whiteboard_pages WHERE id = ?").get(pageId) as { board_id: number; elements: string } | undefined;
  if (!row) return null;
  let list: El[] = [];
  try {
    list = JSON.parse(row.elements) as El[];
  } catch {
    list = [];
  }
  const c: Cached = { boardId: row.board_id, els: new Map(list.map((e) => [e.id, e])), dirty: false, timer: null };
  cache.set(pageId, c);
  return c;
}

function write(pageId: number, c: Cached) {
  if (c.timer) clearTimeout(c.timer);
  c.timer = null;
  if (!c.dirty) return;
  db().prepare("UPDATE whiteboard_pages SET elements = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(ordered(c)), iso(), pageId);
  c.dirty = false;
}

function forget(pageId: number) {
  const c = cache.get(pageId);
  if (c?.timer) clearTimeout(c.timer);
  cache.delete(pageId);
}

/** Writes all pending changes of a board (or of all boards) to the database now. */
export function flushBoard(boardId?: number) {
  for (const [pageId, c] of cache) if (boardId === undefined || c.boardId === boardId) write(pageId, c);
}

function ordered(c: Cached): El[] {
  // Excalidraw keeps z-order in the fractional `index`; plain string comparison is its intended order.
  return [...c.els.values()].sort((a, b) => ((a.index ?? "") < (b.index ?? "") ? -1 : (a.index ?? "") > (b.index ?? "") ? 1 : 0));
}

export function pageElements(pageId: number): El[] {
  const c = load(pageId);
  return c ? ordered(c) : [];
}

/** Checks and cleans one element coming from a browser. Returns null for anything that does not belong on the board. */
export function sanitize(raw: unknown): El | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as El;
  if (typeof e.id !== "string" || e.id.length === 0 || e.id.length > 80) return null;
  if (!ALLOWED_TYPES.has(String(e.type))) return null;
  if (!Number.isInteger(e.version) || e.version < 1 || !Number.isInteger(e.versionNonce)) return null;
  if (Array.isArray(e.points) && e.points.length > MAX_POINTS) return null;
  if (e.type === "text" && typeof e.text === "string" && e.text.length > 20_000) return null;
  const clean: El = { ...e };
  delete clean.link; // no clickable links on the board
  delete clean.customData;
  return clean;
}

const wins = (inc: El, cur: El | undefined) => !cur || inc.version > cur.version || (inc.version === cur.version && inc.versionNonce < cur.versionNonce);

/** Merges elements into a page. Returns the ones that changed the page (to be sent to the other devices). */
export function applyElements(pageId: number, incoming: El[]): El[] {
  const c = load(pageId);
  if (!c) return [];
  const accepted: El[] = [];
  for (const raw of incoming) {
    const e = sanitize(raw);
    if (!e) continue;
    if (!c.els.has(e.id) && c.els.size >= MAX_ELEMENTS_PER_PAGE) break;
    if (wins(e, c.els.get(e.id))) {
      c.els.set(e.id, e);
      accepted.push(e);
    }
  }
  if (accepted.length) {
    c.dirty = true;
    c.timer ??= setTimeout(() => write(pageId, c), FLUSH_MS);
  }
  return accepted;
}

// ---------- previews ----------

/** SVG preview of a page, drawn by a browser with Excalidraw's own exporter. */
export function savePreview(pageId: number, svg: string) {
  if (!svg.startsWith("<svg") || svg.length > 1_500_000) return;
  db().prepare("UPDATE whiteboard_pages SET preview_svg = ? WHERE id = ?").run(svg, pageId);
}

export function pagePreview(pageId: number): string | null {
  return (db().prepare("SELECT preview_svg FROM whiteboard_pages WHERE id = ?").get(pageId) as { preview_svg: string | null } | undefined)?.preview_svg ?? null;
}

// ---------- content sent from other parts of the app ----------

export type PendingInsert = { id: number; page_id: number | null; payload: InsertPayload };

/** Queues content for a board and tells the open devices; the first one to claim it draws it. */
export function queueInsert(boardId: number, payload: InsertPayload): number {
  const board = getBoard(boardId)!;
  const id = Number(
    db()
      .prepare("INSERT INTO whiteboard_inserts (board_id, page_id, payload, created_at) VALUES (?, ?, ?, ?)")
      .run(boardId, board.current_page_id, JSON.stringify(payload), iso()).lastInsertRowid,
  );
  publish(boardId, { type: "insert", insert: { id, page_id: board.current_page_id, payload } });
  return id;
}

export function pendingInserts(boardId: number): PendingInsert[] {
  return (db().prepare("SELECT id, page_id, payload FROM whiteboard_inserts WHERE board_id = ? AND claimed_at IS NULL ORDER BY id").all(boardId) as { id: number; page_id: number | null; payload: string }[]).map(
    (r) => ({ id: r.id, page_id: r.page_id, payload: JSON.parse(r.payload) as InsertPayload }),
  );
}

/** True only for the first device asking, so content is never drawn twice. */
export function claimInsert(boardId: number, insertId: number): boolean {
  return db().prepare("UPDATE whiteboard_inserts SET claimed_at = ? WHERE id = ? AND board_id = ? AND claimed_at IS NULL").run(iso(), insertId, boardId).changes === 1;
}

// ---------- unit link ----------

/** Drawing counts as activity of the unit, so a unit spent at the board is not ended as idle. */
export function noteBoardActivity(board: Board) {
  touchUnit(board.unit_id);
}

/** Tells open boards that the unit is over (students switch to "only look") and saves everything. */
export function notifyUnitClosed(unitId: number) {
  const unit = getUnit(unitId);
  // the teacher's tablet drops this student and goes back to "Bereit für die nächste Einheit"
  if (unit) unitChanged(unit.teacher_id, unit.id);
  const board = boardForUnit(unitId);
  if (!board) return;
  flushBoard(board.id);
  publish(board.id, { type: "ended" });
}

/** Boards of the running units of a teacher, for "Auf Whiteboard senden". */
export function runningBoardsFor(teacherId: number) {
  return db()
    .prepare(
      `SELECT u.id AS unit_id, u.student_id, s.name AS student_name, u.started_at FROM units u JOIN students s ON s.id = u.student_id
       WHERE u.status = 'gestartet' AND u.teacher_id = ? ORDER BY u.started_at`,
    )
    .all(teacherId) as { unit_id: number; student_id: number; student_name: string; started_at: string }[];
}
