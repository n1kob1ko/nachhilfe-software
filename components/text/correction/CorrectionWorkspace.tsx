"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Dumbbell, Eye, EyeOff, Loader2, Pencil, Plus, Printer, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { addItemAction, decideAllAction, decideItemAction, removeItemAction, shareCorrectionAction } from "@/app/correction-actions";
import { Info } from "@/components/Info";
import { applyAccepted, countLabel, overview, recommendationFrom, segmentsOf, type AIStatus, type CorrectionItem, type ItemKind, type ItemStatus } from "@/lib/text-correction-core";
import { TEXT_CATEGORIES } from "@/lib/text-correction-rules";
import { blockText, type Run, type TextDoc } from "@/lib/text-doc";

export type View = "original" | "korrekturen" | "endfassung";

export type WorkspaceCorrection = {
  id: number;
  aiState: AIStatus;
  aiStartedAt: string | null;
  aiLabel: string | null;
  dropped: number;
  strengths: string[];
  recommendation: string;
  recommendationSkill: string | null;
  shared: boolean;
  /** einfach = one KI request; gruendlich = sentence by sentence and a second check */
  method: "einfach" | "gruendlich";
  /** sentences („2.3“) the KI did not answer for */
  unchecked: string[];
  /** the second check of a „gründlich“ run failed: every suggestion is marked */
  verifyFailed: boolean;
  /** words OpenRouter's privacy filter hid from the KI (grammar = not a name, e.g. „Sie“) */
  hidden: { para: number; text: string; grammar: boolean }[];
};

type Props = {
  correction: WorkspaceCorrection;
  doc: TextDoc;
  items: CorrectionItem[];
  skillNames: Record<string, string>;
  studentId: number;
  studentFirst: string;
  textId: number;
  /** "Deutsch – Erlebniserzählung" */
  heading: string;
  initialView: View;
  /** the "Mit KI prüfen" button (with its consent dialog), when the KI may run on this correction */
  aiStart?: React.ReactNode;
};

const CAT = new Map<string, (typeof TEXT_CATEGORIES)[number]>(TEXT_CATEGORIES.map((c) => [c.key, c]));
const KIND_LABEL: Record<ItemKind, string> = { fehler: "Fehler", stil: "Vorschlag", hinweis: "Hinweis" };
const BADGE: Record<ItemKind, string> = { fehler: "bg-red-wash text-red", stil: "bg-violet-wash text-violet", hinweis: "bg-amber-wash text-amber" };
const isPlaced = (i: CorrectionItem) => i.block !== null && i.pos_start !== null && i.pos_end !== null;
/** sorted out by the second check: not in the text, listed apart, can be brought back */
const sortedOut = (i: CorrectionItem) => i.status === "abgelehnt" && i.review === "verworfen";
/** open and marked for a close look: never accepted in bulk */
const toCheck = (i: CorrectionItem) => i.status === "offen" && i.review === "lehrer";
/** „Sie“ (Absatz 3), „Lea“ (Absatz 5, 6) */
function hiddenList(hidden: WorkspaceCorrection["hidden"]) {
  const by = new Map<string, number[]>();
  for (const h of hidden) by.set(h.text, [...new Set([...(by.get(h.text) ?? []), h.para])]);
  return [...by].map(([text, paras]) => `„${text}“ (Absatz ${paras.join(", ")})`).join(", ");
}
const ORIGIN: Record<string, string> = { regel: "vom Programm gefunden", pruefung: "von der zweiten Prüfung gefunden", fassung: "aus der Satzfassung der KI" };
const order = (a: CorrectionItem, b: CorrectionItem) => (a.block ?? -1) - (b.block ?? -1) || (a.pos_start ?? -1) - (b.pos_start ?? -1) || a.id - b.id;

/** Runs with bold/italic/underline; line breaks stay characters (pre-wrap), so positions in the DOM match the text. */
function Runs({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => {
    let el: React.ReactNode = r.x;
    if (r.u) el = <u>{el}</u>;
    if (r.i) el = <i>{el}</i>;
    if (r.b) el = <b>{el}</b>;
    return <span key={i}>{el}</span>;
  });
}

function Badge({ item }: { item: Pick<CorrectionItem, "category" | "kind"> }) {
  const c = CAT.get(item.category);
  return (
    <span className={`kx-badge ${BADGE[item.kind]}`} aria-hidden>
      {c?.short ?? "?"}
    </span>
  );
}

/** Characters before a DOM point inside a paragraph, without the inserted improvements ([data-skip]). */
function offsetIn(block: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(block, 0);
  range.setEnd(node, offset);
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("[data-skip]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!range.intersectsNode(t)) continue;
    if (t === range.endContainer) n += range.endOffset;
    else if (t === range.startContainer) n += (t as Text).length - range.startOffset;
    else n += (t as Text).length;
  }
  return n;
}

type Adding = { block: number | null; start: number | null; end: number | null; quote: string; top: number; left: number };

/**
 * The teacher's correction desk: the text in three views, marks with the reason on click, accept or
 * reject one by one or all at once, own corrections by selecting text, the overview of accepted errors.
 */
export function CorrectionWorkspace(p: Props) {
  const router = useRouter();
  const [items, setItems] = useState(p.items);
  useEffect(() => setItems(p.items), [p.items]);
  const [view, setView] = useState<View>(p.initialView);
  const [selected, setSelected] = useState<number | null>(null);
  const [scrollTo, setScrollTo] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [showStyle, setShowStyle] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [selection, setSelection] = useState<Adding | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const paper = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const c = p.correction;

  // the KI is still working: ask the server again until the result is there
  useEffect(() => {
    if (c.aiState !== "laeuft") return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [c.aiState, router]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (c.aiState !== "laeuft") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [c.aiState]);

  // the view in the address, so a reload opens the same one
  const show = (v: View) => {
    setView(v);
    setSelected(null);
    setAdding(null);
    const u = new URL(window.location.href);
    u.searchParams.set("ansicht", v);
    window.history.replaceState(null, "", u);
  };

  const visible = useCallback((i: CorrectionItem) => (filter === null || i.category === filter) && (showStyle || i.kind !== "stil"), [filter, showStyle]);
  const sorted = useMemo(() => [...items].sort(order), [items]);
  const placedVisible = sorted.filter((i) => isPlaced(i) && visible(i) && !sortedOut(i));
  const openPlaced = placedVisible.filter((i) => i.status === "offen");
  const general = sorted.filter((i) => !isPlaced(i) && !sortedOut(i));
  const out = sorted.filter(sortedOut);
  const ov = useMemo(() => overview(items), [items]);
  const rec = recommendationFrom({ recommendation: c.recommendation, recommendation_skill: c.recommendationSkill }, ov, (id) => p.skillNames[id] ?? null);
  const final = useMemo(() => applyAccepted(p.doc, items), [p.doc, items]);
  const openVisible = items.filter((i) => i.status === "offen" && visible(i));
  const bulk = openVisible.filter((i) => !toCheck(i));
  const flagged = items.filter(toCheck).length;
  const current = selected === null ? null : (items.find((i) => i.id === selected) ?? null);

  // place the card under the selected mark (a sheet at the bottom on phones)
  useLayoutEffect(() => {
    const box = paper.current;
    if (selected === null || !box) return setPos(null);
    const el = box.querySelector<HTMLElement>(`[data-item="${selected}"]`);
    if (!el) {
      setSelected(null);
      return;
    }
    if (scrollTo) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setScrollTo(false);
    }
    const place = () => {
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const width = Math.min(380, b.width - 24);
      setPos({ top: r.bottom - b.top + 10, left: Math.max(12, Math.min(r.left - b.left - 20, b.width - width - 12)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [selected, items, view, scrollTo]);

  // Escape or a click elsewhere closes the card
  useEffect(() => {
    if (selected === null && !adding) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          setSelected(null);
          setAdding(null);
        }
        return;
      }
      const t = e.target as HTMLElement;
      if (pop.current?.contains(t) || t.closest("[data-item]") || t.closest("[data-add]")) return;
      setSelected(null);
      setAdding(null);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [selected, adding]);

  // selecting text in the Korrekturen view offers an own correction there
  useEffect(() => {
    if (view !== "korrekturen") return setSelection(null);
    const onChange = () => {
      const sel = window.getSelection();
      const box = paper.current;
      if (!sel || sel.isCollapsed || !sel.rangeCount || !box) return setSelection(null);
      const range = sel.getRangeAt(0);
      const startEl = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)?.closest<HTMLElement>("[data-block]");
      const endEl = (range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement)?.closest<HTMLElement>("[data-block]");
      if (!startEl || startEl !== endEl || !box.contains(startEl)) return setSelection(null);
      const block = Number(startEl.dataset.block);
      const text = blockText(p.doc[block]);
      let s = offsetIn(startEl, range.startContainer, range.startOffset);
      let e = offsetIn(startEl, range.endContainer, range.endOffset);
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      if (e <= s) return setSelection(null);
      const clash = items.some((i) => isPlaced(i) && i.block === block && i.status !== "abgelehnt" && i.pos_start! < e && s < i.pos_end!);
      const r = range.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      setSelection(clash ? null : { block, start: s, end: e, quote: text.slice(s, e), top: r.bottom - b.top + 8, left: Math.max(12, Math.min(r.left - b.left, b.width - 260)) });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [view, items, p.doc]);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("Das hat nicht geklappt. Bitte nochmal versuchen.");
        router.refresh();
      }
    });

  const decide = (item: CorrectionItem, status: ItemStatus, replacement?: string) => {
    const wasOpen = item.status === "offen";
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status, ...(replacement !== undefined ? { replacement } : {}) } : x)));
    setEditing(null);
    // straight on to the next open place: the whole text can be checked with two buttons
    if (wasOpen && status !== "offen" && isPlaced(item)) {
      const rest = openPlaced.filter((i) => i.id !== item.id);
      const next = rest.find((i) => order(i, item) > 0) ?? rest[0] ?? null;
      setSelected(next?.id ?? null);
      setScrollTo(Boolean(next));
    }
    run(async () => {
      const saved = await decideItemAction(c.id, item.id, status, replacement);
      if (saved) setItems((xs) => xs.map((x) => (x.id === saved.id ? saved : x)));
    });
  };

  const decideAll = (status: "uebernommen" | "abgelehnt") => {
    // accepting in bulk leaves out what is marked for a close look (the server does the same)
    const these = status === "uebernommen" ? bulk : openVisible;
    const n = these.length;
    if (!n || !window.confirm(`${n} offene ${n === 1 ? "Stelle" : "Stellen"} ${status === "uebernommen" ? "übernehmen" : "ablehnen"}?`)) return;
    const ids = new Set(these.map((i) => i.id));
    setItems((xs) => xs.map((x) => (ids.has(x.id) ? { ...x, status } : x)));
    setSelected(null);
    run(async () => {
      await decideAllAction(c.id, status, { ...(filter ? { category: filter } : {}), ...(showStyle ? {} : { kind: "fehler" as const }) });
      router.refresh();
    });
  };

  const go = (dir: 1 | -1) => {
    if (!current) return;
    const list = placedVisible;
    const at = list.findIndex((i) => i.id === current.id);
    const next = list[(at + dir + list.length) % list.length];
    if (next) {
      setSelected(next.id);
      setScrollTo(true);
      setEditing(null);
    }
  };

  const save = (form: FormData, a: Adding) =>
    run(async () => {
      const kind = String(form.get("kind")) as ItemKind;
      const res = await addItemAction(c.id, {
        block: a.block,
        start: a.start,
        end: a.end,
        category: String(form.get("category")),
        kind: a.start === null ? "hinweis" : kind,
        replacement: String(form.get("replacement") ?? ""),
        explanation: String(form.get("explanation") ?? ""),
      });
      if ("error" in res) return setError(res.error);
      setItems((xs) => [...xs, res.item]);
      setAdding(null);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    });

  // ---------- the text ----------
  const markClass = (i: CorrectionItem) => `kx-mark kx-${i.kind} kx-${i.status}${toCheck(i) ? " kx-check" : ""}${selected === i.id ? " kx-sel" : ""}`;

  const korrekturen = p.doc.map((b, bi) => {
    const mine = placedVisible.filter((i) => i.block === bi);
    const segs = segmentsOf(b, mine);
    const inner = segs.map((s) => {
      if (s.itemId === null) return <Runs key={`t${s.start}`} runs={s.runs} />;
      const i = items.find((x) => x.id === s.itemId)!;
      const cat = CAT.get(i.category);
      const open = () => {
        setSelected(i.id);
        setAdding(null);
        setEditing(null);
      };
      return (
        <span key={`m${i.id}`}>
          <mark
            className={markClass(i)}
            data-item={i.id}
            data-cat={i.status === "offen" ? cat?.short : undefined}
            role="button"
            tabIndex={0}
            aria-label={`${cat?.label ?? i.category}, ${KIND_LABEL[i.kind]}, ${i.status === "offen" ? "offen" : i.status}${toCheck(i) ? ", genau prüfen" : ""}: ${i.quote}`}
            onClick={open}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
          >
            <Runs runs={s.runs} />
          </mark>
          {i.status === "uebernommen" && i.replacement && (
            <ins className="kx-ins" data-skip data-item={i.id} onClick={open}>
              {i.replacement}
            </ins>
          )}
        </span>
      );
    });
    const Tag = b.t === "h" ? "h2" : "p";
    return (
      <Tag key={bi} data-block={bi}>
        {inner}
      </Tag>
    );
  });

  const plain = (doc: TextDoc, marks?: Map<number, { start: number; end: number; id: number }[]>) =>
    doc.map((b, bi) => {
      const Tag = b.t === "h" ? "h2" : "p";
      const ranges = (highlight && marks?.get(bi)) || [];
      const segs = segmentsOf(b, ranges.map((r) => ({ id: r.id, pos_start: r.start, pos_end: r.end })));
      return (
        <Tag key={bi}>
          {segs.map((s) =>
            s.itemId === null ? (
              <Runs key={s.start} runs={s.runs} />
            ) : (
              <span key={s.start} className="kx-changed">
                <Runs runs={s.runs} />
              </span>
            ),
          )}
        </Tag>
      );
    });

  const cats = TEXT_CATEGORIES.map((k) => ({ ...k, open: items.filter((i) => i.category === k.key && i.status === "offen").length, all: items.filter((i) => i.category === k.key && i.status !== "abgelehnt").length })).filter((k) => k.all > 0);
  const decided = items.filter((i) => i.status !== "offen").length;
  const running = c.aiState === "laeuft";
  const seconds = running && c.aiStartedAt ? Math.max(0, Math.round((now - Date.parse(c.aiStartedAt)) / 1000)) : 0;
  const print = (q: string) => `/arbeitsblatt/text/${p.textId}?k=${c.id}&${q}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        {running && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-violet-wash px-5 py-4 text-[15px]" role="status" data-testid="ki-laeuft">
            <Loader2 size={18} className="shrink-0 animate-spin text-violet" aria-hidden />
            <span>
              <b>Die KI prüft den Text</b> <span className="num text-ink-2">({seconds} s)</span>. Du kannst inzwischen selbst korrigieren oder die Seite verlassen; das Ergebnis wird gespeichert.
            </span>
          </div>
        )}
        {!running && (c.unchecked.length > 0 || c.verifyFailed || flagged > 0 || c.hidden.length > 0) && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-wash px-5 py-4 text-[15px]" role="status" data-testid="genau-pruefen">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
            <div className="grid gap-1">
              {flagged > 0 && (
                <p>
                  <b>
                    {flagged} {flagged === 1 ? "Vorschlag ist" : "Vorschläge sind"} gestrichelt markiert:
                  </b>{" "}
                  Bitte einzeln prüfen, der Grund steht beim Vorschlag. Sie werden bei „Alle übernehmen“ nicht mitgenommen.
                </p>
              )}
              {c.verifyFailed && <p>Die zweite Prüfung der KI ist fehlgeschlagen. Kein Vorschlag wurde kontrolliert.</p>}
              {c.hidden.length > 0 && (
                <p data-testid="ausgeblendet">
                  Der Datenschutzfilter von OpenRouter hat Wörter ausgeblendet, bevor die KI den Text sah: {hiddenList(c.hidden)}. Dort konnte die KI nicht prüfen; diese Stellen bitte selbst durchsehen.
                </p>
              )}
              {c.unchecked.length > 0 && (
                <p data-testid="ungeprueft">
                  Die KI hat {c.unchecked.length === 1 ? "einen Satz" : `${c.unchecked.length} Sätze`} nicht beantwortet (Absatz {[...new Set(c.unchecked.map((u) => u.split(".")[0]))].join(", ")}). Diese Stellen bitte selbst durchsehen.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="kx-tabs" role="tablist" aria-label="Ansicht">
            {(
              [
                ["original", "Original"],
                ["korrekturen", "Korrekturen"],
                ["endfassung", "Endfassung"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className="kx-tab" onClick={() => show(v)}>
                {label}
                {v === "korrekturen" && ov.open > 0 && (
                  <span className="num rounded-full bg-red px-2 py-0.5 text-[12px] leading-none text-white" aria-label={`${ov.open} offen`}>
                    {ov.open}
                  </span>
                )}
              </button>
            ))}
          </div>
          {view === "korrekturen" && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm bg-red-wash shadow-[inset_0_-2px_0_var(--red)]" aria-hidden /> Fehler
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm border-b-2 border-dotted border-violet bg-violet-wash" aria-hidden /> Vorschlag
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm bg-green-wash" aria-hidden /> übernommen
              </span>
              {flagged > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-5 rounded-sm outline-2 outline-offset-0 outline-amber outline-dashed" aria-hidden /> genau prüfen
                </span>
              )}
              <Info label="Wie korrigiere ich?" align="right">
                Auf eine Markierung tippen: du siehst, was falsch ist und warum, und kannst übernehmen oder ablehnen. Danach springt die Ansicht zur nächsten offenen Stelle. Eigene Korrektur: ein Wort oder eine Stelle im Text markieren. Der Originaltext bleibt immer unverändert.
              </Info>
            </p>
          )}
          {view === "endfassung" && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
              <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
              Änderungen hervorheben
            </label>
          )}
        </div>

        {view === "korrekturen" && (general.length > 0 || !running) && (
          <section className="mb-4 rounded-2xl border border-line bg-surface px-5 py-4" aria-label="Hinweise zum ganzen Text">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Hinweise zum ganzen Text</h2>
              <button
                type="button"
                data-add
                className="btn btn-ghost"
                onClick={(e) => {
                  const b = paper.current?.getBoundingClientRect();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setSelected(null);
                  setAdding({ block: null, start: null, end: null, quote: "", top: b ? Math.max(0, r.bottom - b.top + 8) : 0, left: 12 });
                }}
              >
                <Plus size={16} aria-hidden /> Hinweis
              </button>
            </div>
            {general.length === 0 ? (
              <p className="text-[14px] text-ink-3">Aufbau, Inhalt, Textsorte und Aufgabenstellung. Noch keine Hinweise.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {general.filter(visible).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start gap-3 py-3" data-testid="hinweis">
                    <Badge item={i} />
                    <div className={`min-w-0 flex-1 text-[15px] ${i.status === "abgelehnt" ? "text-ink-3 line-through" : ""}`}>
                      <p className="text-[13px] font-semibold text-ink-2">
                        {CAT.get(i.category)?.label ?? i.category}
                        {i.block !== null && ` · Absatz ${i.block + 1}`}
                        {i.kind !== "hinweis" && " · Stelle nicht eindeutig gefunden"}
                      </p>
                      {i.quote && (
                        <p>
                          „{i.quote}“{i.replacement && <> → „{i.replacement}“</>}
                        </p>
                      )}
                      <p>{i.explanation}</p>
                    </div>
                    <Decision item={i} pending={pending} onDecide={decide} onRemove={() => run(async () => void ((await removeItemAction(c.id, i.id)) && setItems((xs) => xs.filter((x) => x.id !== i.id))))} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div ref={paper} className="tx-paper relative">
          {view === "original" && <div className="kx-text" data-testid="ansicht-original">{plain(p.doc)}</div>}
          {view === "korrekturen" && (
            <div className="kx-text" data-testid="ansicht-korrekturen">
              {korrekturen}
            </div>
          )}
          {view === "endfassung" && (
            <div className="kx-text" data-testid="ansicht-endfassung">
              {plain(final.doc, final.changes)}
            </div>
          )}

          {view === "korrekturen" && selection && !adding && (
            <button
              type="button"
              data-add
              className="btn btn-primary absolute z-10"
              style={{ top: selection.top, left: selection.left }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelected(null);
                setAdding(selection);
              }}
            >
              <Plus size={16} aria-hidden /> Korrektur hier
            </button>
          )}

          {current && pos && view === "korrekturen" && (
            <div ref={pop} className="kx-pop" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Korrektur" data-testid="korrektur-karte">
              <ItemCard
                item={current}
                skillName={current.skill_id ? (p.skillNames[current.skill_id] ?? null) : null}
                pending={pending}
                editing={editing}
                setEditing={setEditing}
                onDecide={decide}
                onRemove={() =>
                  run(async () => {
                    if (await removeItemAction(c.id, current.id)) setItems((xs) => xs.filter((x) => x.id !== current.id));
                    setSelected(null);
                  })
                }
                onClose={() => setSelected(null)}
                nav={{
                  prev: () => go(-1),
                  next: () => go(1),
                  label: `${placedVisible.findIndex((i) => i.id === current.id) + 1} von ${placedVisible.length}`,
                }}
              />
            </div>
          )}

          {adding && (
            <div ref={pop} className="kx-pop" style={{ top: adding.top, left: adding.left }} role="dialog" aria-label="Eigene Korrektur" data-testid="eigene-korrektur">
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(new FormData(e.currentTarget), adding);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold">{adding.start === null ? "Hinweis zum ganzen Text" : <>Korrektur für „{adding.quote}“</>}</p>
                  <button type="button" className="btn btn-ghost -mt-2 -mr-3 !px-3" aria-label="Schließen" onClick={() => setAdding(null)}>
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <label className="field">
                  <span className="label">Kategorie</span>
                  <select className="input" name="category" defaultValue={adding.start === null ? "struktur" : "rechtschreibung"}>
                    {TEXT_CATEGORIES.filter((k) => (adding.start === null ? k.scope === "text" : true)).map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                {adding.start !== null && (
                  <>
                    <fieldset className="flex gap-4">
                      <legend className="sr-only">Art</legend>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
                        <input type="radio" name="kind" value="fehler" defaultChecked className="h-5 w-5 accent-[var(--accent)]" /> Fehler
                      </label>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
                        <input type="radio" name="kind" value="stil" className="h-5 w-5 accent-[var(--accent)]" /> Vorschlag
                      </label>
                    </fieldset>
                    <label className="field">
                      <span className="label">Verbesserung</span>
                      <input className="input" name="replacement" defaultValue={adding.quote} maxLength={200} autoFocus />
                    </label>
                  </>
                )}
                <label className="field">
                  <span className="label">{adding.start === null ? "Hinweis" : "Erklärung für den Schüler"}</span>
                  <textarea className="input" name="explanation" rows={2} maxLength={300} required={adding.start === null} autoFocus={adding.start === null} />
                </label>
                <div className="flex gap-2">
                  <button className="btn btn-primary" disabled={pending}>
                    Speichern
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setAdding(null)}>
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {view === "korrekturen" && out.length > 0 && (
          <details className="reveal mt-4 rounded-2xl border border-line bg-surface px-5 py-3" data-testid="aussortiert">
            <summary className="text-[15px] font-semibold">
              Von der zweiten Prüfung aussortiert <span className="num text-ink-2">({out.length})</span>
            </summary>
            <p className="mt-1 text-[13px] text-ink-2">Diese KI-Vorschläge hält die zweite Prüfung für falsch. Sie zählen nicht und erscheinen nirgends. Du kannst einen zurückholen.</p>
            <ul className="mt-1 divide-y divide-line">
              {out.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start gap-3 py-3">
                  <Badge item={i} />
                  <div className="min-w-0 flex-1 text-[15px]">
                    <p>
                      „{i.quote}“ → „{i.replacement || "(streichen)"}“
                      {i.block !== null && <span className="text-[13px] text-ink-2"> · Absatz {i.block + 1}</span>}
                    </p>
                    <p className="text-ink-2">{i.explanation}</p>
                    {i.review_note && <p className="mt-1 text-[13px] text-amber">{i.review_note}</p>}
                  </div>
                  <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => decide(i, "offen")}>
                    <RotateCcw size={16} aria-hidden /> Zurückholen
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {view === "endfassung" && ov.open > 0 && (
          <p className="mt-3 text-[14px] text-ink-2">
            Noch {ov.open} {ov.open === 1 ? "Vorschlag ist" : "Vorschläge sind"} offen und in der Endfassung nicht enthalten.
          </p>
        )}
        {view === "original" && <p className="mt-3 text-[14px] text-ink-2">Der Text, wie der Schüler ihn abgegeben hat. Er wird durch die Korrektur nie verändert.</p>}
        {error && (
          <p className="mt-3 rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
            {error}
          </p>
        )}
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pb-2" aria-label="Korrektur-Übersicht">
        <section className="panel p-5" data-testid="stand">
          <p className="text-[13px] font-semibold text-ink-2">Stand</p>
          <p className="mt-1 text-[28px] leading-tight font-semibold">
            <span className="num">{ov.open}</span> <span className="text-[17px] font-medium text-ink-2">offen</span>
          </p>
          <p className="num text-[14px] text-ink-2">
            {items.filter((i) => i.status === "uebernommen").length} übernommen · {ov.rejected - out.length} abgelehnt
            {out.length > 0 && <> · {out.length} aussortiert</>}
          </p>
          {items.length > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bar-track)]" aria-hidden>
              <div className="h-full rounded-full bg-green" style={{ width: `${Math.round((decided / items.length) * 100)}%` }} />
            </div>
          )}
          {cats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Nach Kategorie filtern">
              <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)} className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[13px] font-semibold ${filter === null ? "bg-ink text-white" : "bg-panel text-ink-2"}`}>
                Alle
              </button>
              {cats.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  aria-pressed={filter === k.key}
                  onClick={() => setFilter(filter === k.key ? null : k.key)}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${filter === k.key ? "bg-ink text-white" : "bg-panel text-ink-2"}`}
                  title={`${k.label}: ${k.open} offen`}
                >
                  {k.label} <span className="num opacity-75">{k.open || k.all}</span>
                </button>
              ))}
            </div>
          )}
          <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={showStyle} onChange={(e) => setShowStyle(e.target.checked)} />
            Stilvorschläge zeigen
          </label>
          <div className="mt-3 grid gap-2">
            {openPlaced.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (view !== "korrekturen") show("korrekturen");
                  const from = current ? openPlaced.find((i) => order(i, current) > 0) : null;
                  setSelected((from ?? openPlaced[0]).id);
                  setScrollTo(true);
                }}
                data-testid="naechste-stelle"
              >
                <ChevronRight size={16} aria-hidden /> Nächste offene Stelle
              </button>
            )}
            <button type="button" className="btn btn-secondary" disabled={pending || !bulk.length} onClick={() => decideAll("uebernommen")} data-testid="alle-uebernehmen">
              <Check size={16} aria-hidden /> Alle übernehmen{bulk.length ? ` (${bulk.length})` : ""}
            </button>
            {openVisible.length > bulk.length && <p className="text-[13px] text-ink-2">Ohne die {openVisible.length - bulk.length} gestrichelt markierten, die prüfst du einzeln.</p>}
            <button type="button" className="btn btn-ghost" disabled={pending || !openVisible.length} onClick={() => decideAll("abgelehnt")}>
              <X size={16} aria-hidden /> Alle ablehnen
            </button>
          </div>
          {p.aiStart && <div className="mt-3 border-t border-line pt-3">{p.aiStart}</div>}
        </section>

        <section className="panel p-5" data-testid="fehleruebersicht">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Fehlerübersicht</h2>
            <Info label="Info zur Fehlerübersicht" align="right">
              Zählt nur, was du übernommen hast. Die Fehler erscheinen im Lernverlauf unter „Häufige Fehler“. Der Lernstand in Prozent ändert sich durch eine Textkorrektur nicht.
            </Info>
          </div>
          <p className="text-[13px] text-ink-2">{p.heading}</p>
          {ov.categories.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-3">Noch nichts bestätigt. Übernommene Fehler erscheinen hier.</p>
          ) : (
            <ul className="mt-3 grid gap-1.5 text-[14px]">
              {ov.categories.map((k) => (
                <li key={k.key} className="flex items-center gap-2">
                  <span className={`kx-badge ${k.fehler ? BADGE.fehler : k.stil ? BADGE.stil : BADGE.hinweis}`} aria-hidden>
                    {k.short}
                  </span>
                  <span>{countLabel(k)}</span>
                </li>
              ))}
            </ul>
          )}
          {ov.mainIssue && (
            <p className="mt-3 text-[14px]">
              <span className="text-ink-2">Häufigstes Problem:</span> <b>{ov.mainIssue}</b>
            </p>
          )}
          {rec && (
            <div className="mt-3 rounded-xl bg-accent-wash px-4 py-3">
              <p className="text-[14px]">
                <span className="text-ink-2">Empfehlung:</span> <b>{rec.text}</b>
              </p>
              <Link href={`/uebungen/neu?schueler=${p.studentId}${rec.skillId ? `&skill=${encodeURIComponent(rec.skillId)}` : ""}`} className="btn btn-primary mt-2 w-full">
                <Dumbbell size={16} aria-hidden /> Passende Übung erstellen
              </Link>
            </div>
          )}
          {c.strengths.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-ink-2">Stärken laut KI</p>
              <ul className="mt-1 list-disc pl-5 text-[14px]">
                {c.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel grid gap-2 p-5">
          <button type="button" className={`btn ${c.shared ? "btn-ghost" : "btn-secondary"}`} disabled={pending} onClick={() => run(async () => shareCorrectionAction(c.id, !c.shared))} data-testid="teilen">
            {c.shared ? (
              <>
                <EyeOff size={16} aria-hidden /> Vor {p.studentFirst} verbergen
              </>
            ) : (
              <>
                <Eye size={16} aria-hidden /> {p.studentFirst} zeigen
              </>
            )}
          </button>
          <p className="text-[13px] text-ink-2">{c.shared ? `${p.studentFirst} sieht die übernommenen Korrekturen mit Erklärung am Gerät.` : "Zeigt die übernommenen Korrekturen mit Erklärung am Laptop oder Tablet."}</p>
          <p className="mt-2 text-[13px] font-semibold text-ink-2">Drucken / PDF</p>
          <div className="grid gap-1">
            <a className="btn btn-ghost justify-start" href={print("fassung=korrektur&uebersicht=1")} target="_blank" rel="noreferrer">
              <Printer size={16} aria-hidden /> Mit Korrekturen
            </a>
            <a className="btn btn-ghost justify-start" href={print("fassung=endfassung")} target="_blank" rel="noreferrer">
              <Printer size={16} aria-hidden /> Endfassung
            </a>
            <a className="btn btn-ghost justify-start" href={print("fassung=original")} target="_blank" rel="noreferrer">
              <Printer size={16} aria-hidden /> Original
            </a>
          </div>
          {c.aiLabel && (
            <p className="mt-2 text-[12px] text-ink-3">
              <Sparkles size={12} className="mr-1 inline" aria-hidden />
              Vorschläge von {c.aiLabel}
              {c.method === "gruendlich" && " (gründlich: Satz für Satz, jeder Vorschlag ein zweites Mal geprüft)"}
              {c.dropped > 0 && `. ${c.dropped} ${c.dropped === 1 ? "Vorschlag war" : "Vorschläge waren"} nicht prüfbar und ${c.dropped === 1 ? "wurde" : "wurden"} verworfen.`}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Decision({ item, pending, onDecide, onRemove, compact }: { item: CorrectionItem; pending: boolean; onDecide: (i: CorrectionItem, s: ItemStatus) => void; onRemove: () => void; compact?: boolean }) {
  if (item.source === "lehrer")
    return (
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={onRemove} aria-label="Eigene Korrektur entfernen">
        <Trash2 size={16} aria-hidden /> {compact ? "" : "Entfernen"}
      </button>
    );
  if (item.status !== "offen")
    return (
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => onDecide(item, "offen")}>
        <RotateCcw size={16} aria-hidden /> {item.status === "uebernommen" ? "Übernommen" : "Abgelehnt"} · rückgängig
      </button>
    );
  return (
    <span className="flex gap-2">
      <button type="button" className={`btn ${compact ? "btn-secondary" : "btn-primary"}`} disabled={pending} onClick={() => onDecide(item, "uebernommen")}>
        <Check size={16} aria-hidden /> Übernehmen
      </button>
      <button type="button" className={`btn ${compact ? "btn-ghost" : "btn-secondary"}`} disabled={pending} onClick={() => onDecide(item, "abgelehnt")}>
        <X size={16} aria-hidden /> Ablehnen
      </button>
    </span>
  );
}

function ItemCard(p: {
  item: CorrectionItem;
  skillName: string | null;
  pending: boolean;
  editing: string | null;
  setEditing: (v: string | null) => void;
  onDecide: (i: CorrectionItem, s: ItemStatus, replacement?: string) => void;
  onRemove: () => void;
  onClose: () => void;
  nav: { prev: () => void; next: () => void; label: string };
}) {
  const i = p.item;
  const cat = CAT.get(i.category);
  const accept = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (i.status === "offen") accept.current?.focus({ preventScroll: true });
  }, [i.id, i.status]);
  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
          <Badge item={i} />
          {cat?.label ?? i.category}
          <span className={`rounded-full px-2 py-0.5 text-[12px] ${BADGE[i.kind]}`}>{i.kind === "stil" ? "Vorschlag (optional)" : KIND_LABEL[i.kind]}</span>
          {i.source === "lehrer" && <span className="text-[12px] font-medium text-ink-3">von dir</span>}
          {i.source === "ki" && ORIGIN[i.origin] && <span className="text-[12px] font-medium text-ink-3">{ORIGIN[i.origin]}</span>}
        </p>
        <button type="button" className="btn btn-ghost -mt-2 -mr-3 !px-3" aria-label="Schließen" onClick={p.onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[15px]">
        <dt className="text-[13px] text-ink-2">Geschrieben</dt>
        <dd className="text-ink-2 line-through decoration-red/60" data-testid="original-ausdruck">
          {i.quote}
        </dd>
        <dt className="text-[13px] text-ink-2">Besser</dt>
        <dd className="font-semibold text-green" data-testid="verbesserung">
          {p.editing !== null ? (
            <input className="input !min-h-[40px]" value={p.editing} onChange={(e) => p.setEditing(e.target.value)} aria-label="Verbesserung ändern" maxLength={200} autoFocus />
          ) : (
            <span className="inline-flex items-center gap-1">
              {i.replacement || <span className="font-normal text-ink-3 italic">(streichen)</span>}
              {i.source === "ki" && i.status !== "abgelehnt" && (
                <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-panel hover:text-ink" aria-label="Verbesserung ändern" onClick={() => p.setEditing(i.replacement)}>
                  <Pencil size={14} aria-hidden />
                </button>
              )}
            </span>
          )}
        </dd>
      </dl>
      {i.explanation && <p className="rounded-xl bg-panel px-3.5 py-2.5 text-[15px]" data-testid="erklaerung">{i.explanation}</p>}
      {i.review === "lehrer" && i.review_note && (
        <p className="flex gap-2 rounded-xl bg-amber-wash px-3.5 py-2.5 text-[14px]" data-testid="genau-pruefen-grund">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <span>
            <b>Genau prüfen:</b> {i.review_note}
          </span>
        </p>
      )}
      {(i.rule || p.skillName) && (
        <p className="text-[13px] text-ink-2">
          {i.rule && <>Regel: {i.rule}</>}
          {i.rule && p.skillName && " · "}
          {p.skillName && <>Fähigkeit: {p.skillName}</>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {p.editing !== null ? (
          <button type="button" className="btn btn-primary" disabled={p.pending} onClick={() => p.onDecide(i, "uebernommen", p.editing!)}>
            <Check size={16} aria-hidden /> So übernehmen
          </button>
        ) : i.status === "offen" && i.source === "ki" ? (
          <>
            <button ref={accept} type="button" className="btn btn-primary" disabled={p.pending} onClick={() => p.onDecide(i, "uebernommen")}>
              <Check size={16} aria-hidden /> Übernehmen
            </button>
            <button type="button" className="btn btn-secondary" disabled={p.pending} onClick={() => p.onDecide(i, "abgelehnt")}>
              <X size={16} aria-hidden /> Ablehnen
            </button>
          </>
        ) : (
          <Decision item={i} pending={p.pending} onDecide={p.onDecide} onRemove={p.onRemove} />
        )}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2">
        <button type="button" className="btn btn-ghost !px-3" onClick={p.nav.prev} aria-label="Vorige Stelle">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="num text-[13px] text-ink-2">{p.nav.label}</span>
        <button type="button" className="btn btn-ghost !px-3" onClick={p.nav.next} aria-label="Nächste Stelle">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
