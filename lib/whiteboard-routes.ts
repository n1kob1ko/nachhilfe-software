/**
 * Request handling shared by the teacher routes (/tafel/[unitId]/…) and the student routes
 * (/lernen/[token]/tafel/…). The routes only work out who is asking; what each role may do is decided here.
 */
import { getUnit } from "./units";
import * as wb from "./whiteboard";
import { notePage, presence, publish, stream } from "./whiteboard-hub";

export type Viewer = { role: wb.Role; name: string; canWrite: boolean };

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** The live stream of one device: first the current state, then every change made elsewhere. */
export function eventStream(board: wb.Board, viewer: Viewer, request: Request): Response {
  return stream(board.id, request, {
    role: viewer.role,
    name: viewer.name,
    hello: () => ({ type: "hello", ...wb.pagesState(board.id), running: getUnit(board.unit_id)?.status === "gestartet", canWrite: viewer.canWrite, people: presence(board.id) }),
  });
}

type Body = {
  clientId?: string;
  op?: string;
  pageId?: number;
  afterPageId?: number;
  elements?: unknown[];
  title?: string;
  svg?: string;
  insertId?: number;
  pointer?: { x: number; y: number };
  button?: "up" | "down";
  ids?: unknown[];
};

const TEACHER_OPS = new Set(["page.add", "page.duplicate", "page.delete", "page.rename", "page.select", "page.clear"]);

export async function sync(board: wb.Board, viewer: Viewer, request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 6_000_000) return json({ error: "Zu groß." }, 413);
  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const clientId = String(body.clientId ?? "").slice(0, 40);
  const op = String(body.op ?? "");
  const pageId = Number(body.pageId);
  const pageOk = Number.isInteger(pageId) && wb.pageBelongsTo(pageId, board.id);

  if (TEACHER_OPS.has(op) && viewer.role !== "lehrer") return json({ error: "Nicht erlaubt." }, 403);
  if (op !== "load" && !viewer.canWrite) return json({ error: "Nur ansehen." }, 403);

  switch (op) {
    case "load": {
      if (!pageOk) return json({ error: "Seite nicht gefunden." }, 404);
      notePage(board.id, clientId, pageId);
      return json({ elements: wb.pageElements(pageId), pending: wb.pendingInserts(board.id).filter((i) => i.page_id === pageId || i.page_id === null) });
    }
    case "elements": {
      if (!pageOk || !Array.isArray(body.elements)) return json({ error: "Seite nicht gefunden." }, 404);
      const accepted = wb.applyElements(pageId, body.elements as wb.El[]);
      if (accepted.length) {
        publish(board.id, { type: "elements", pageId, elements: accepted, from: clientId }, clientId);
        wb.noteBoardActivity(board);
      }
      return json({ ok: true, accepted: accepted.length });
    }
    case "pointer": {
      const p = body.pointer;
      if (!pageOk || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return json({ ok: false });
      publish(board.id, { type: "pointer", clientId, role: viewer.role, name: viewer.name, pageId, pointer: { x: p.x, y: p.y, tool: (p as { tool?: string }).tool === "laser" ? "laser" : "pointer" }, button: body.button === "down" ? "down" : "up" }, clientId);
      return json({ ok: true });
    }
    case "focus": {
      // "look here": new content was put on the board; the other devices scroll to it
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, 50) : [];
      if (pageOk && ids.length) publish(board.id, { type: "focus", pageId, ids, from: clientId }, clientId);
      return json({ ok: true });
    }
    case "preview": {
      if (!pageOk || typeof body.svg !== "string") return json({ ok: false });
      wb.savePreview(pageId, body.svg);
      return json({ ok: true });
    }
    case "claim":
      return json({ ok: wb.claimInsert(board.id, Number(body.insertId)) });
    case "page.add":
    case "page.duplicate": {
      const id = op === "page.add" ? wb.addPage(board.id, { title: body.title, afterPageId: Number(body.afterPageId) || undefined }) : pageOk ? wb.duplicatePage(board.id, pageId) : null;
      if (!id) return json({ error: "Seite nicht gefunden." }, 404);
      wb.setCurrentPage(board.id, id);
      publish(board.id, { type: "pages", ...wb.pagesState(board.id) });
      return json({ ok: true, pageId: id, ...wb.pagesState(board.id) });
    }
    case "page.delete": {
      if (!pageOk) return json({ error: "Seite nicht gefunden." }, 404);
      const next = wb.deletePage(board.id, pageId);
      if (!next) return json({ error: "Die letzte Seite bleibt." }, 409);
      publish(board.id, { type: "pages", ...wb.pagesState(board.id) });
      return json({ ok: true, pageId: next, ...wb.pagesState(board.id) });
    }
    case "page.rename":
    case "page.select": {
      if (!pageOk) return json({ error: "Seite nicht gefunden." }, 404);
      if (op === "page.rename") wb.renamePage(board.id, pageId, String(body.title ?? ""));
      else {
        wb.setCurrentPage(board.id, pageId);
        notePage(board.id, clientId, pageId);
      }
      publish(board.id, { type: "pages", ...wb.pagesState(board.id) });
      return json({ ok: true, ...wb.pagesState(board.id) });
    }
    case "page.clear": {
      if (!pageOk) return json({ error: "Seite nicht gefunden." }, 404);
      const cleared = wb.clearPage(pageId);
      publish(board.id, { type: "elements", pageId, elements: cleared, from: clientId }, clientId);
      return json({ ok: true, elements: cleared });
    }
    default:
      return json({ error: "Unbekannt." }, 400);
  }
}

/** Page previews are SVG drawn in a browser: served with a sandbox policy so nothing in them can run. */
export function previewResponse(svg: string | null): Response {
  if (!svg) return new Response("Keine Vorschau.", { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:; img-src data:; sandbox",
      "Cache-Control": "private, no-cache",
    },
  });
}
