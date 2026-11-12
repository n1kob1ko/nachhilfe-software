"use client";

import { Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Steuern } from "@/lib/spiegel";

/**
 * On the student tablet: records DreamStudy's own page while the teacher watches the student screen of the
 * unit (lib/spiegel.ts) and plays the teacher's taps, keys and scrolling here. Nothing is recorded while
 * nobody watches; the eye at the bottom shows the student that the teacher sees the screen.
 *
 * Recording is rrweb (MIT): one full picture, then only the changes. Canvas (the whiteboard) is not
 * recorded: the teacher has the same board on the laptop anyway.
 */
export function SpiegelAufnahme({ an, neu, aus, postUrl = "/geraet/spiegel" }: { an: boolean; neu: number; aus: () => void; postUrl?: string }) {
  const [aktiv, setAktiv] = useState(false);
  const recorder = useRef<{ stop: () => void; voll: () => void } | null>(null);
  const ausRef = useRef(aus);
  ausRef.current = aus;

  useEffect(() => {
    if (!an) return;
    let vorbei = false;
    let stop: (() => void) | undefined;
    const queue: unknown[] = [];
    let unterwegs = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // one request at a time keeps the order; what comes meanwhile goes with the next one
    const senden = async () => {
      timer = undefined;
      if (unterwegs || !queue.length || vorbei) return;
      unterwegs = true;
      const events = queue.splice(0, queue.length);
      try {
        const r = await fetch(postUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }) });
        const j = (await r.json().catch(() => ({}))) as { an?: boolean };
        if (j.an === false) ausRef.current();
      } catch {
        // offline for a moment: the next full picture (on reconnect) catches the teacher up
      }
      unterwegs = false;
      if (queue.length) planen();
    };
    const planen = () => {
      if (!timer) timer = setTimeout(senden, 120);
    };

    void import("rrweb").then(({ record }) => {
      if (vorbei) return;
      stop = record({
        emit(e) {
          queue.push(e);
          planen();
        },
        // the tablet's own pictures (/geraet/bild/…) need its cookie: they go along as data
        inlineImages: true,
        inlineStylesheet: false,
        recordCanvas: false,
        collectFonts: false,
        // a fresh full picture every 3 minutes keeps the teacher's copy small
        checkoutEveryNms: 180_000,
        sampling: { mousemove: false, scroll: 100, media: 800, input: "last" },
        slimDOMOptions: { script: true, comment: true, headFavicon: true, headWhitespace: true, headMetaSocial: true, headMetaRobots: true, headMetaHttpEquiv: true, headMetaAuthorship: true, headMetaVerification: true, headMetaDescKeywords: true },
        blockSelector: "[data-spiegel-nicht]",
      });
      recorder.current = { stop: () => stop?.(), voll: () => record.takeFullSnapshot(true) };
      setAktiv(true);
    });
    return () => {
      vorbei = true;
      stop?.();
      recorder.current = null;
      if (timer) clearTimeout(timer);
      setAktiv(false);
    };
  }, [an, postUrl]);

  // a second teacher screen opened: it needs a full picture to start from
  useEffect(() => {
    if (neu) recorder.current?.voll();
  }, [neu]);

  // Eingreifen: the teacher's commands, relayed by DeviceLive
  useEffect(() => {
    if (!an) return;
    const fern = new Fernbedienung();
    const on = (e: Event) => fern.ausfuehren((e as CustomEvent<Steuern>).detail);
    window.addEventListener("dreamstudy-steuern", on);
    return () => {
      window.removeEventListener("dreamstudy-steuern", on);
      fern.ende();
    };
  }, [an]);

  if (!aktiv) return null;
  return (
    <span
      className="fixed right-7 bottom-1.5 z-[60] inline-flex h-6 items-center gap-1 rounded-full bg-accent-wash px-2 text-[12px] font-semibold text-accent"
      role="status"
      title="Dein Lehrer sieht deinen Bildschirm"
      data-testid="spiegel-an"
    >
      <Eye size={14} aria-hidden />
      <span className="sr-only">Dein Lehrer sieht deinen Bildschirm</span>
    </span>
  );
}

/** pointerId of the teacher's finger: never one of the tablet's own */
const FERN_ID = 31337;
const TIPP_WEG = 10;

/** Elements whose own code takes the finger (games, number line, swipe field): there a drag stays a drag. */
function nimmtFinger(el: Element | null) {
  for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
    const t = getComputedStyle(n).touchAction;
    if (t === "none" || t === "pinch-zoom") return true;
  }
  return false;
}

function scroller(el: Element | null, dx: number, dy: number): Element {
  for (let n: Element | null = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    const y = /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
    const x = /(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1;
    if ((dy && y) || (dx && x)) return n;
  }
  return document.scrollingElement ?? document.documentElement;
}

const editierbar = (el: Element | null): el is HTMLElement =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(el.type)) || (el as HTMLElement).isContentEditable);

/** Plays the teacher's commands on this page as if the student's finger and keyboard did them. */
class Fernbedienung {
  private zug: { ziel: Element; x0: number; y0: number; x: number; y: number; finger: boolean; weg: boolean; abgebrochen: boolean } | null = null;
  private altCapture = Element.prototype.setPointerCapture;
  private altRelease = Element.prototype.releasePointerCapture;

  constructor() {
    // the games capture the pointer; for the teacher's made-up pointer the browser would refuse that
    const altC = this.altCapture;
    const altR = this.altRelease;
    Element.prototype.setPointerCapture = function (id: number) {
      if (id !== FERN_ID) altC.call(this, id);
    };
    Element.prototype.releasePointerCapture = function (id: number) {
      if (id !== FERN_ID) altR.call(this, id);
    };
  }

  ende() {
    Element.prototype.setPointerCapture = this.altCapture;
    Element.prototype.releasePointerCapture = this.altRelease;
  }

  ausfuehren(c: Steuern) {
    try {
      if (c.art === "zeiger") this.zeiger(c.phase, c.x, c.y);
      else if (c.art === "taste") this.taste(c.key);
      else if (c.art === "text") this.text(c.text);
      else if (c.art === "rad") {
        const el = document.elementFromPoint(c.x, c.y);
        scroller(el, c.dx, c.dy).scrollBy({ left: c.dx, top: c.dy });
      }
    } catch {
      // a command that does not fit the page any more (it just changed): nothing happens
    }
  }

  private pointer(type: string, el: Element, x: number, y: number) {
    return el.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: FERN_ID, pointerType: "touch", isPrimary: true, button: 0, buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1, width: 20, height: 20, pressure: type === "pointerup" ? 0 : 0.5 }),
    );
  }

  private maus(type: string, el: Element, x: number, y: number) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: type === "mousedown" ? 1 : 0, view: window }));
  }

  private zeiger(phase: "down" | "move" | "up", x: number, y: number) {
    if (phase === "down") {
      const ziel = document.elementFromPoint(x, y);
      if (!ziel) return;
      this.zug = { ziel, x0: x, y0: y, x, y, finger: nimmtFinger(ziel), weg: false, abgebrochen: false };
      this.pointer("pointerdown", ziel, x, y);
      ring(x, y);
      return;
    }
    const z = this.zug;
    if (!z) return;
    if (phase === "move") {
      if (Math.hypot(x - z.x0, y - z.y0) > TIPP_WEG) z.weg = true;
      if (z.finger) this.pointer("pointermove", z.ziel, x, y);
      else if (z.weg) {
        // like a real finger: the page scrolls, the element gets a cancel
        if (!z.abgebrochen) this.pointer("pointercancel", z.ziel, x, y);
        z.abgebrochen = true;
        scroller(z.ziel, z.x - x, z.y - y).scrollBy({ left: z.x - x, top: z.y - y });
      }
      z.x = x;
      z.y = y;
      return;
    }
    // up
    this.zug = null;
    if (z.finger) {
      this.pointer("pointerup", z.ziel, x, y);
      if (!z.weg) this.klick(z.ziel, x, y);
      return;
    }
    if (z.weg) return;
    this.pointer("pointerup", z.ziel, x, y);
    this.klick(z.ziel, x, y);
  }

  private klick(el: Element, x: number, y: number) {
    this.maus("mousedown", el, x, y);
    // focus like a tap: an answer field takes the teacher's keys afterwards
    const fokus = (el as HTMLElement).closest?.("input, textarea, select, button, a, [contenteditable=''], [contenteditable='true'], [tabindex]") as HTMLElement | null;
    if (fokus && fokus !== document.activeElement) fokus.focus({ preventScroll: true });
    else if (!fokus && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    this.maus("mouseup", el, x, y);
    this.maus("click", el, x, y);
  }

  private taste(key: string) {
    const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body;
    const opts = { key, bubbles: true, cancelable: true, composed: true };
    const weiter = el.dispatchEvent(new KeyboardEvent("keydown", opts));
    if (weiter && editierbar(el)) {
      if ([...key].length === 1) document.execCommand("insertText", false, key);
      else if (key === "Backspace") document.execCommand("delete");
      else if (key === "Delete") document.execCommand("forwardDelete");
      else if (key === "Enter") {
        if (el instanceof HTMLInputElement) el.form?.requestSubmit();
        else document.execCommand("insertLineBreak");
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        const p = Math.max(0, (el.selectionStart ?? 0) + (key === "ArrowLeft" ? -1 : 1));
        el.setSelectionRange(p, p);
      }
    } else if (weiter && key === "Enter" && el instanceof HTMLElement && el !== document.body) {
      // Enter on a focused button: press it
      if (el.matches("button, a, [role=button]")) el.click();
    }
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  private text(text: string) {
    const el = document.activeElement;
    if (editierbar(el)) document.execCommand("insertText", false, text);
  }
}

/** The student sees where the teacher tapped (and so does the teacher, in the copy). */
function ring(x: number, y: number) {
  const d = document.createElement("div");
  d.className = "fern-tipp";
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  d.setAttribute("aria-hidden", "true");
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 650);
}
