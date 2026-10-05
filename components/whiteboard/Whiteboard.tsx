"use client";

import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  convertToExcalidrawElements,
  exportToSvg,
  getCommonBounds,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as T from "@/lib/whiteboard-templates";
import { InsertPanel, type WorksheetForBoard } from "./InsertPanel";
import { QuickTools, type QuickTool } from "./QuickTools";

// Fonts come from this server (copied by scripts/copy-excalidraw-fonts.mjs), not from a CDN.
if (typeof window !== "undefined") (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";

type El = { id: string; version: number; isDeleted?: boolean; [k: string]: unknown };
export type PageInfo = { id: number; position: number; title: string; element_count: number };
type Person = { clientId: string; role: "lehrer" | "schueler"; name: string; pageId: number | null };
type InsertPayload =
  | { kind: "tasks"; title: string; tasks: T.TaskForBoard[] }
  | { kind: "text"; text: string };
type Pending = { id: number; page_id: number | null; payload: InsertPayload };

export type WhiteboardProps = {
  role: "lehrer" | "schueler";
  /** "/tafel/12" for teachers, "/lernen/<token>/tafel" for students */
  endpoint: string;
  /** "" for teachers, "?einheit=12" for students */
  query: string;
  studentName: string;
  backHref?: string;
  /** page to show first instead of the one the teacher shows (opening a preview from the Lernverlauf) */
  initialPageId?: number;
  worksheets?: WorksheetForBoard[];
  endUnit?: () => Promise<void>;
};

type Status = "verbinde" | "live" | "getrennt";
const SEND_EVERY_MS = 40;
const POINTER_EVERY_MS = 70;
const PREVIEW_AFTER_MS = 2500;

export default function Whiteboard(props: WhiteboardProps) {
  const { role, endpoint, query } = props;
  const teacher = role === "lehrer";
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageId, setCurrentPageId] = useState<number | null>(null);
  const [viewPageId, setViewPageId] = useState<number | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [running, setRunning] = useState(true);
  const [status, setStatus] = useState<Status>("verbinde");
  const [people, setPeople] = useState<Person[]>([]);
  const [panel, setPanel] = useState(false);
  const [pageMenu, setPageMenu] = useState(false);
  const [tool, setTool] = useState<QuickTool>("stift");
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const clientId = useMemo(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())).slice(0, 36), []);
  const known = useRef(new Map<string, number>()); // element id -> version the server has
  const pending = useRef(new Map<string, El>());
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerAt = useRef(0);
  const viewRef = useRef<number | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const loading = useRef(false);
  const collaborators = useRef(new Map<string, Record<string, unknown>>());
  const firstHello = useRef(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  const url = (path: string) => `${endpoint}/${path}${query}`;
  const post = useCallback(
    async (op: string, data: Record<string, unknown> = {}) => {
      const res = await fetch(`${endpoint}/sync${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, op, ...data }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    [endpoint, query, clientId],
  );

  // ---------- sending ----------
  const flush = useCallback(async () => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = null;
    const pageId = viewRef.current;
    if (!pageId || pending.current.size === 0) return;
    const batch = [...pending.current.values()];
    pending.current.clear();
    for (const e of batch) known.current.set(e.id, e.version);
    try {
      await post("elements", { pageId, elements: batch });
      setStatus("live");
    } catch {
      // not sent: forget that the server has it and try again shortly
      for (const e of batch) {
        if (known.current.get(e.id) === e.version) known.current.delete(e.id);
        if (!pending.current.has(e.id)) pending.current.set(e.id, e);
      }
      setStatus("getrennt");
      sendTimer.current = setTimeout(() => void flush(), 1500);
    }
  }, [post]);

  const uploadPreview = useCallback(async () => {
    const a = apiRef.current;
    const pageId = viewRef.current;
    if (!a || !pageId) return;
    const els = a.getSceneElements();
    try {
      const svg = await exportToSvg({ elements: els, appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false }, files: a.getFiles(), exportPadding: 24 });
      await post("preview", { pageId, svg: svg.outerHTML });
    } catch {
      // previews are a nice-to-have
    }
  }, [post]);

  const schedulePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => void uploadPreview(), PREVIEW_AFTER_MS);
  }, [uploadPreview]);

  const onChange = useCallback(
    (elements: readonly El[]) => {
      if (loading.current) return;
      let changed = false;
      for (const e of elements) {
        if ((known.current.get(e.id) ?? 0) < e.version) {
          pending.current.set(e.id, e);
          changed = true;
        }
      }
      if (!changed) return;
      sendTimer.current ??= setTimeout(() => void flush(), SEND_EVERY_MS);
      schedulePreview();
    },
    [flush, schedulePreview],
  );

  // ---------- receiving ----------
  const applyRemote = useCallback((els: El[]) => {
    const a = apiRef.current;
    if (!a || els.length === 0) return;
    for (const e of els) known.current.set(e.id, Math.max(known.current.get(e.id) ?? 0, e.version));
    const restored = restoreElements(els as never, null);
    const merged = reconcileElements(a.getSceneElementsIncludingDeleted(), restored as never, a.getAppState());
    a.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
  }, []);

  const placeBelow = useCallback(() => {
    const a = apiRef.current!;
    const live = a.getSceneElements();
    if (!live.length) return { x: 0, y: 0 };
    const [minX, , , maxY] = getCommonBounds(live);
    return { x: Math.round(minX), y: Math.round(maxY + 70) };
  }, []);

  /** Scrolls so the top of the given elements sits near the top left of the screen, at the current zoom. */
  const reveal = useCallback((ids: string[]) => {
    const a = apiRef.current;
    if (!a) return false;
    const wanted = new Set(ids);
    const found = a.getSceneElements().filter((e) => wanted.has(e.id));
    if (!found.length) return false;
    const [minX, minY, maxX] = getCommonBounds(found);
    const s = a.getAppState();
    // readable size: as wide as the content allows, never tiny and never bigger than 1:1
    const zoom = Math.max(0.6, Math.min(1, (s.width - 96) / Math.max(1, maxX - minX)));
    a.updateScene({ appState: { zoom: { value: zoom as never }, scrollX: 48 / zoom - minX, scrollY: 32 / zoom - minY } });
    return true;
  }, []);

  /** Draws template elements on the current page; they are then synced like anything drawn by hand. */
  const draw = useCallback(
    (skeletons: T.Skeleton[], opts: { behind?: boolean; scroll?: boolean } = {}) => {
      const a = apiRef.current;
      if (!a || !skeletons.length) return;
      const fresh = convertToExcalidrawElements(skeletons as never, { regenerateIds: true });
      const scene = a.getSceneElementsIncludingDeleted();
      a.updateScene({ elements: opts.behind ? [...fresh, ...scene] : [...scene, ...fresh], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      if (opts.scroll !== false) {
        const ids = fresh.map((e) => e.id);
        reveal(ids);
        // the other device scrolls there too, so new tasks never land out of sight
        if (viewRef.current) void post("focus", { pageId: viewRef.current, ids: ids.slice(0, 50) }).catch(() => {});
      }
    },
    [reveal, post],
  );

  const materialize = useCallback(
    (payload: InsertPayload) => {
      const at = placeBelow();
      if (payload.kind === "tasks") draw(T.tasksTemplate(payload.tasks, at, { title: payload.title }));
      else draw(T.textTemplate(payload.text, at));
    },
    [draw, placeBelow],
  );

  const tryClaim = useCallback(
    async (ins: Pending) => {
      if (ins.page_id && ins.page_id !== viewRef.current) return; // the device showing that page draws it
      try {
        const r = await post("claim", { insertId: ins.id });
        if (r.ok) materialize(ins.payload);
      } catch {
        // another device or a later load will draw it
      }
    },
    [post, materialize],
  );

  const viewports = useRef(new Map<number, { scrollX: number; scrollY: number; zoom: number }>());
  const loadPage = useCallback(
    async (pageId: number, mode: "replace" | "merge" = "replace") => {
      const a = apiRef.current;
      if (!a) return;
      if (mode === "replace" && viewRef.current && viewRef.current !== pageId) {
        await flush();
        if (previewTimer.current) {
          clearTimeout(previewTimer.current);
          void uploadPreview();
        }
        const s = a.getAppState();
        viewports.current.set(viewRef.current, { scrollX: s.scrollX, scrollY: s.scrollY, zoom: s.zoom.value });
      }
      let res: { elements: El[]; pending: Pending[] };
      try {
        res = await post("load", { pageId });
      } catch {
        setStatus("getrennt");
        return;
      }
      const sameMerge = mode === "merge" && viewRef.current === pageId;
      viewRef.current = pageId;
      setViewPageId(pageId);
      if (sameMerge) {
        // after a lost connection: take what others did, then send what only this device has
        const serverVersion = new Map(res.elements.map((e) => [e.id, e.version]));
        applyRemote(res.elements);
        for (const e of a.getSceneElementsIncludingDeleted() as unknown as El[]) {
          if ((serverVersion.get(e.id) ?? 0) < e.version) {
            known.current.delete(e.id);
            pending.current.set(e.id, e);
          }
        }
        void flush();
      } else {
        loading.current = true;
        known.current = new Map(res.elements.map((e) => [e.id, e.version]));
        pending.current.clear();
        a.updateScene({ elements: restoreElements(res.elements as never, null), captureUpdate: CaptureUpdateAction.NEVER });
        a.history.clear();
        const vp = viewports.current.get(pageId);
        if (vp) a.updateScene({ appState: { scrollX: vp.scrollX, scrollY: vp.scrollY, zoom: { value: vp.zoom as never } } });
        else if (res.elements.some((e) => !e.isDeleted)) a.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, minZoom: 0.35 });
        else a.updateScene({ appState: { scrollX: 40, scrollY: 40, zoom: { value: 1 as never } } });
        // onChange fires after the scene update; only then may local edits be recorded again
        requestAnimationFrame(() => (loading.current = false));
      }
      for (const ins of res.pending) void tryClaim(ins);
    },
    [post, flush, applyRemote, tryClaim, uploadPreview],
  );

  // ---------- live connection ----------
  useEffect(() => {
    if (!api) return;
    apiRef.current = api;
    // handy for support and for the browser tests: lets the console look at what is on the board
    (window as unknown as { __whiteboard?: ExcalidrawImperativeAPI }).__whiteboard = api;
    const es = new EventSource(`${url("events")}${query ? "&" : "?"}client=${clientId}`);
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus("getrennt");
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data);
      switch (ev.type) {
        case "hello": {
          setPages(ev.pages);
          setCurrentPageId(ev.currentPageId);
          setCanWrite(ev.canWrite);
          setRunning(ev.running);
          setPeople(ev.people);
          setStatus("live");
          if (firstHello.current || !viewRef.current) {
            firstHello.current = false;
            const wanted = props.initialPageId;
            void loadPage(wanted && ev.pages.some((p: PageInfo) => p.id === wanted) ? wanted : ev.currentPageId);
          } else void loadPage(viewRef.current, "merge");
          break;
        }
        case "pages": {
          setPages(ev.pages);
          setCurrentPageId(ev.currentPageId);
          const stillThere = ev.pages.some((p: PageInfo) => p.id === viewRef.current);
          // students follow the page the teacher shows
          if ((!teacher && ev.currentPageId !== viewRef.current) || !stillThere) void loadPage(ev.currentPageId);
          break;
        }
        case "elements":
          if (ev.pageId === viewRef.current) applyRemote(ev.elements);
          break;
        case "pointer": {
          if (ev.pageId !== viewRef.current) {
            collaborators.current.delete(ev.clientId);
          } else {
            collaborators.current.set(ev.clientId, {
              pointer: { x: ev.pointer.x, y: ev.pointer.y, tool: ev.pointer.tool === "laser" ? "laser" : "pointer" },
              button: ev.button,
              username: ev.name,
              color: ev.role === "lehrer" ? { background: "#dbe4ff", stroke: "#1f4fd1" } : { background: "#ffe8cc", stroke: "#d9480f" },
            });
          }
          apiRef.current?.updateScene({ collaborators: new Map(collaborators.current) as never });
          break;
        }
        case "presence": {
          setPeople(ev.people);
          const here = new Set((ev.people as Person[]).map((p) => p.clientId));
          for (const id of collaborators.current.keys()) if (!here.has(id)) collaborators.current.delete(id);
          apiRef.current?.updateScene({ collaborators: new Map(collaborators.current) as never });
          break;
        }
        case "insert":
          void tryClaim(ev.insert);
          break;
        case "focus": {
          if (ev.pageId !== viewRef.current) break;
          // the elements may arrive a moment after the hint
          let tries = 0;
          const attempt = () => {
            if (!reveal(ev.ids) && ++tries < 30) setTimeout(attempt, 50);
          };
          attempt();
          break;
        }
        case "ended":
          setRunning(false);
          if (!teacher) {
            void flush();
            void uploadPreview();
            setCanWrite(false);
            setNotice("Die Einheit ist beendet. Dein Whiteboard ist gespeichert.");
          }
          break;
      }
    };
    const beforeUnload = () => {
      if (pending.current.size && viewRef.current) {
        navigator.sendBeacon?.(`${endpoint}/sync${query}`, new Blob([JSON.stringify({ clientId, op: "elements", pageId: viewRef.current, elements: [...pending.current.values()] })], { type: "application/json" }));
      }
    };
    window.addEventListener("pagehide", beforeUnload);
    return () => {
      es.close();
      window.removeEventListener("pagehide", beforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const onPointerUpdate = useCallback(
    (p: { pointer: { x: number; y: number; tool: "pointer" | "laser" }; button: "up" | "down" }) => {
      if (!canWrite || !viewRef.current) return;
      const now = performance.now();
      if (now - pointerAt.current < POINTER_EVERY_MS) return;
      pointerAt.current = now;
      void post("pointer", { pageId: viewRef.current, pointer: { x: Math.round(p.pointer.x), y: Math.round(p.pointer.y), tool: p.pointer.tool }, button: p.button }).catch(() => {});
    },
    [canWrite, post],
  );

  // ---------- quick tools ----------
  const pickTool = useCallback((t: QuickTool, style?: { color?: string; width?: number }) => {
    const a = apiRef.current;
    if (!a) return;
    setTool(t);
    const map: Record<QuickTool, string> = { stift: "freedraw", marker: "freedraw", radierer: "eraser", text: "text", hand: "hand", auswahl: "selection", linie: "line", pfeil: "arrow", rechteck: "rectangle", kreis: "ellipse", laser: "laser" };
    if (t === "marker") a.updateScene({ appState: { currentItemStrokeColor: style?.color ?? "#fcc419", currentItemStrokeWidth: 4, currentItemOpacity: 45 } as never });
    else if (t === "stift" || t === "linie" || t === "pfeil" || t === "rechteck" || t === "kreis" || t === "text")
      a.updateScene({ appState: { currentItemOpacity: 100, ...(style?.color ? { currentItemStrokeColor: style.color } : {}), ...(style?.width ? { currentItemStrokeWidth: style.width } : {}), currentItemRoughness: 0, currentItemFontFamily: 6 } as never });
    a.setActiveTool({ type: map[t] as never });
  }, []);

  const key = useCallback((k: "undo" | "redo") => {
    const target = wrapRef.current?.querySelector(".excalidraw") ?? document;
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, metaKey: true, shiftKey: k === "redo", bubbles: true, cancelable: true }));
  }, []);

  // ---------- pages (teacher) ----------
  const pageOp = useCallback(
    async (op: string, data: Record<string, unknown> = {}) => {
      try {
        await flush();
        const r = await post(op, data);
        if (r.pages) {
          setPages(r.pages);
          setCurrentPageId(r.currentPageId);
        }
        if (r.pageId && r.pageId !== viewRef.current) await loadPage(r.pageId);
        if (r.elements) applyRemote(r.elements);
        return r;
      } catch {
        setNotice("Das hat nicht geklappt. Bitte noch einmal versuchen.");
        return null;
      }
    },
    [post, flush, loadPage, applyRemote],
  );

  const showPage = useCallback(
    (pageId: number) => {
      if (teacher) void pageOp("page.select", { pageId }).then(() => loadPage(pageId));
      else void loadPage(pageId);
    },
    [teacher, pageOp, loadPage],
  );

  const newPageWith = useCallback(
    async (template: "leer" | "kariert" | "liniert" | "koordinaten", title: string) => {
      const r = await pageOp("page.add", { afterPageId: viewRef.current, title });
      if (!r) return;
      // wait for the empty page to be on screen, then draw the background
      setTimeout(() => {
        if (template === "kariert") draw(T.gridTemplate({ x: 0, y: 0 }), { scroll: false });
        if (template === "liniert") draw(T.linedTemplate({ x: 0, y: 0 }), { scroll: false });
        if (template === "koordinaten") draw(T.coordinateTemplate({ x: 80, y: 60 }), { scroll: false });
        apiRef.current?.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, minZoom: 0.35 });
      }, 150);
    },
    [pageOp, draw],
  );

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!document.fullscreenElement) (el?.requestFullscreen?.() ?? el?.webkitRequestFullscreen?.())?.catch?.(() => {});
    else void document.exitFullscreen();
  }, []);
  useEffect(() => {
    const on = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // pick the pen once the board is ready
  useEffect(() => {
    if (api && canWrite) pickTool("stift", { color: "#1e1e1e", width: 2 });
  }, [api, canWrite, pickTool]);

  const viewIndex = pages.findIndex((p) => p.id === viewPageId);
  const others = people.filter((p) => p.clientId !== clientId);
  const student = others.find((p) => p.role === "schueler");
  const teacherOnline = others.some((p) => p.role === "lehrer");
  const studentPage = student ? pages.findIndex((p) => p.id === student.pageId) + 1 : 0;

  return (
    <div ref={wrapRef} className={`wb-root fixed inset-0 z-50 flex flex-col bg-white ${teacher ? "wb-teacher" : "wb-student"}`}>
      <header className="wb-header flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-3 py-2">
        {props.backHref && (
          <a href={props.backHref} className="wb-btn wb-btn-wide" title={teacher ? "Zurück zur Einheit (das Whiteboard bleibt gespeichert)" : "Zurück zu den Übungen"}>
            <span aria-hidden>←</span> {teacher ? "Zur Einheit" : "Zurück"}
          </a>
        )}
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight">{teacher ? `Whiteboard · ${props.studentName}` : "Whiteboard"}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-2" role="status" aria-live="polite">
            <span className={`inline-block h-2 w-2 rounded-full ${status === "live" ? "bg-green" : status === "verbinde" ? "bg-amber" : "bg-red"}`} aria-hidden />
            {status === "live" ? "verbunden" : status === "verbinde" ? "verbinde …" : "Verbindung unterbrochen, versuche erneut"}
            {teacher && (student ? ` · ${student.name} ist da${studentPage ? `, Seite ${studentPage}` : ""}` : " · Schüler noch nicht verbunden")}
            {!teacher && teacherOnline && " · Lehrer ist da"}
          </div>
        </div>

        <nav className="wb-pages flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Seiten">
          {teacher ? (
            <>
              {pages.map((p, i) => (
                <button key={p.id} onClick={() => showPage(p.id)} className={`wb-tab ${p.id === viewPageId ? "wb-tab-on" : ""}`} aria-current={p.id === viewPageId ? "page" : undefined} title={p.title}>
                  <span className="num">{i + 1}</span>
                  <span className="max-w-[9rem] truncate">{p.title}</span>
                  {p.id === currentPageId && p.id !== viewPageId && <span className="text-[11px] text-accent">(Schüler)</span>}
                </button>
              ))}
              {canWrite && (
                <button className="wb-btn" onClick={() => void newPageWith("leer", `Seite ${pages.length + 1}`)} aria-label="Neue Seite" title="Neue leere Seite">
                  +
                </button>
              )}
            </>
          ) : (
            pages.length > 1 && (
              <div className="flex items-center gap-1">
                <button className="wb-btn" disabled={viewIndex <= 0} onClick={() => showPage(pages[viewIndex - 1].id)} aria-label="Vorige Seite">
                  ‹
                </button>
                <span className="num px-1 text-[14px]">
                  Seite {viewIndex + 1} von {pages.length}
                </span>
                <button className="wb-btn" disabled={viewIndex >= pages.length - 1} onClick={() => showPage(pages[viewIndex + 1].id)} aria-label="Nächste Seite">
                  ›
                </button>
              </div>
            )
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          {teacher && canWrite && (
            <>
              <button className={`wb-btn wb-btn-wide ${panel ? "wb-btn-on" : ""}`} onClick={() => setPanel((v) => !v)} aria-expanded={panel} title="Aufgaben, Text, Formel, Tabelle oder kariertes Papier einfügen">
                <span aria-hidden>+</span> Einfügen
              </button>
              <div className="relative">
                <button className={`wb-btn wb-btn-wide ${pageMenu ? "wb-btn-on" : ""}`} onClick={() => setPageMenu((v) => !v)} aria-expanded={pageMenu} title="Seite duplizieren, umbenennen, leeren oder löschen">
                  Seite <span aria-hidden>▾</span>
                </button>
                {pageMenu && (
                  <div className="wb-menu" role="menu" onClick={() => setPageMenu(false)}>
                    <button role="menuitem" onClick={() => void pageOp("page.duplicate", { pageId: viewRef.current })}>
                      Seite duplizieren
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        const p = pages[viewIndex];
                        const t = p && window.prompt("Name der Seite", p.title);
                        if (t) void pageOp("page.rename", { pageId: p.id, title: t });
                      }}
                    >
                      Umbenennen
                    </button>
                    <button role="menuitem" onClick={() => window.confirm("Alles auf dieser Seite löschen?") && void pageOp("page.clear", { pageId: viewRef.current })}>
                      Seite leeren
                    </button>
                    <button role="menuitem" disabled={pages.length <= 1} onClick={() => window.confirm("Diese Seite löschen?") && void pageOp("page.delete", { pageId: viewRef.current })}>
                      Seite löschen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          <button className="wb-btn" onClick={toggleFullscreen} aria-label={fullscreen ? "Vollbild beenden" : "Vollbild"} title={fullscreen ? "Vollbild beenden" : "Vollbild: nur das Whiteboard zeigen"}>
            {fullscreen ? "⤡" : "⤢"}
          </button>
          {teacher && props.endUnit && running && canWrite && (
            <button
              className="wb-btn wb-btn-wide wb-btn-primary"
              title="Einheit beenden und Dokumentation abschließen"
              onClick={async () => {
                await flush();
                await uploadPreview();
                await props.endUnit!();
              }}
            >
              Einheit beenden
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between gap-3 border-b border-amber/40 bg-amber-wash px-4 py-2 text-[14px]" role="alert">
          {notice}
          <button className="wb-btn" onClick={() => setNotice(null)} aria-label="Hinweis schließen">
            ×
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={setApi}
          langCode="de-DE"
          onChange={onChange as never}
          onPointerUpdate={onPointerUpdate}
          viewModeEnabled={!canWrite}
          handleKeyboardGlobally={teacher}
          detectScroll={false}
          aiEnabled={false}
          UIOptions={{
            canvasActions: { changeViewBackgroundColor: false, clearCanvas: false, export: false, loadScene: false, saveToActiveFile: false, toggleTheme: false, saveAsImage: false },
            tools: { image: false },
          }}
          initialData={{ appState: { viewBackgroundColor: "#ffffff", currentItemFontFamily: 6, currentItemRoughness: 0, currentItemStrokeWidth: 2 } as never }}
        />
        {canWrite && (
          <QuickTools
            teacher={teacher}
            tool={tool}
            onTool={pickTool}
            onUndo={() => key("undo")}
            onRedo={() => key("redo")}
            onFit={() => apiRef.current?.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, minZoom: 0.35, animate: true })}
          />
        )}
        {teacher && panel && canWrite && (
          <InsertPanel
            worksheets={props.worksheets ?? []}
            onClose={() => setPanel(false)}
            onTasks={(title, tasks) => draw(T.tasksTemplate(tasks, placeBelow(), { title }))}
            onSolution={(t) => draw(T.solutionTemplate(t, placeBelow()))}
            onText={(text, framed) => draw(T.textTemplate(text, placeBelow(), { framed }))}
            onFormula={(f) => draw(T.formulaTemplate(f, placeBelow()))}
            onTable={(r, c, h) => draw(T.tableTemplate(r, c, placeBelow(), h))}
            onCoordinates={(range) => draw(T.coordinateTemplate({ ...placeBelow(), x: placeBelow().x + 60 }, range))}
            onNewPage={(kind) => void newPageWith(kind, kind === "kariert" ? "Kariert" : kind === "liniert" ? "Liniert" : kind === "koordinaten" ? "Koordinatensystem" : `Seite ${pages.length + 1}`)}
          />
        )}
      </div>
    </div>
  );
}
