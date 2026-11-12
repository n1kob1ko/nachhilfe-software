"use client";

import "rrweb/dist/style.css";
import { Hand, Minus, MonitorSmartphone, Plus, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Steuern } from "@/lib/spiegel";

type Replayer = import("rrweb").Replayer;
type Ev = { type: number; timestamp: number; data?: { width?: number; height?: number; source?: number } };

/** long side of the copy per size, in CSS pixels of the laptop */
const GROESSEN = [360, 620, 900] as const;
const SPEICHER = "dreamstudy-schuelerbildschirm";
/** ms between arrival and showing: just enough to keep a batch together (niko 2026-11-12: „es laggt“) */
const VERZOEGERUNG = 30;

type Vorlieben = { offen: boolean; groesse: number; r: number; b: number };

function lesen(): Vorlieben {
  const klein = typeof window !== "undefined" && window.innerWidth < 768;
  const std = { offen: !klein, groesse: 1, r: 16, b: 16 };
  try {
    const v = JSON.parse(localStorage.getItem(SPEICHER) ?? "null") as Partial<Vorlieben> | null;
    return v ? { ...std, ...v, groesse: Math.min(2, Math.max(0, Number(v.groesse ?? 1))) } : std;
  } catch {
    return std;
  }
}
function merken(v: Vorlieben) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(v));
  } catch {
    // privates Fenster: dann eben nicht gemerkt
  }
}

/**
 * Schüler-Bildschirm in der laufenden Einheit (lib/spiegel.ts): ein kleines Fenster, das immer sichtbar bleibt
 * und zeigt, was DreamStudy gerade am Tablet zeigt, auch halb getippte Antworten. „Eingreifen“ schickt Tippen,
 * Ziehen, Tasten und Scrollen ans Tablet. Zugeklappt schaut niemand zu, und das Tablet nimmt nichts auf.
 */
export function SchuelerBildschirm({ unitId, student }: { unitId: number; student: string }) {
  const [v, setV] = useState<Vorlieben | null>(null);
  const [tablet, setTablet] = useState<{ online: boolean; laptop: boolean } | null>(null);
  const [bild, setBild] = useState(false);
  const [vp, setVp] = useState({ w: 800, h: 1280 });
  const [hinweis, setHinweis] = useState<"tafel" | "rahmen" | null>(null);
  const [eingreifen, setEingreifen] = useState(false);
  const [tastatur, setTastatur] = useState(false);
  const [fenster, setFenster] = useState({ w: 1280, h: 800 });
  const host = useRef<HTMLDivElement>(null);
  const replayer = useRef<Replayer | null>(null);

  useLayoutEffect(() => {
    setV(lesen());
    const groesse = () => setFenster({ w: window.innerWidth, h: window.innerHeight });
    groesse();
    window.addEventListener("resize", groesse);
    return () => window.removeEventListener("resize", groesse);
  }, []);

  const aendern = useCallback((p: Partial<Vorlieben>) => {
    setV((alt) => {
      const neu = { ...(alt ?? lesen()), ...p };
      merken(neu);
      return neu;
    });
  }, []);

  const offen = Boolean(v?.offen);

  // zuschauen: solange das Fenster offen ist, nimmt das Tablet auf und schickt hierher
  useEffect(() => {
    if (!offen) return;
    let vorbei = false;
    let Rp: typeof import("rrweb").Replayer | null = null;
    const warten: Ev[] = [];
    let pruefen: ReturnType<typeof setTimeout> | undefined;

    const neu = () => {
      replayer.current?.destroy();
      if (host.current) host.current.innerHTML = "";
      replayer.current = new Rp!([], {
        root: host.current!,
        liveMode: true,
        mouseTail: false,
        showWarning: false,
        triggerFocus: false,
        UNSAFE_replayCanvas: false,
        // no scrollbars of its own; no entrance motion: the copy starts its animations paused at frame 0
        // (everything that fades in stayed invisible), so it shows each element as it ends up
        insertStyleRules: ["html, body { scrollbar-width: none; }", "*, *::before, *::after { animation: none !important; transition: none !important; }"],
      });
      replayer.current.startLive(Date.now() - VERZOEGERUNG);
    };

    const nachsehen = () => {
      if (pruefen) return;
      pruefen = setTimeout(() => {
        pruefen = undefined;
        const doc = replayer.current?.iframe?.contentDocument;
        setHinweis(doc?.querySelector(".excalidraw") ? "tafel" : doc?.querySelector("iframe") ? "rahmen" : null);
      }, VERZOEGERUNG + 250);
    };

    const abspielen = (events: Ev[]) => {
      for (const raw of events) {
        // the tablet's clock does not count: what arrives now is played now
        const e = { ...raw, timestamp: Date.now() };
        if (e.type === 4) {
          if (e.data?.width && e.data?.height) setVp({ w: e.data.width, h: e.data.height });
          neu();
          setBild(false);
        } else if (!replayer.current) continue; // mitten im Strom: auf das nächste ganze Bild warten
        if (e.type === 2) setBild(true);
        if (e.type === 3 && e.data?.source === 4 && e.data.width && e.data.height) setVp({ w: e.data.width, h: e.data.height });
        replayer.current!.addEvent(e as never);
      }
      nachsehen();
    };

    void import("rrweb").then((m) => {
      if (vorbei) return;
      Rp = m.Replayer;
      abspielen(warten.splice(0));
    });

    const es = new EventSource(`/einheiten/${unitId}/spiegel`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as { type: string; tablet?: boolean; laptop?: boolean; online?: boolean; events?: Ev[] };
      if (e.type === "hallo") setTablet({ online: Boolean(e.tablet), laptop: Boolean(e.laptop) });
      else if (e.type === "tablet") setTablet((t) => ({ laptop: t?.laptop ?? false, online: Boolean(e.online) }));
      else if (e.type === "ev" && e.events) {
        setTablet((t) => (t?.online ? t : { laptop: false, online: true }));
        if (Rp) abspielen(e.events);
        else warten.push(...e.events);
      }
    };
    return () => {
      vorbei = true;
      es.close();
      if (pruefen) clearTimeout(pruefen);
      replayer.current?.destroy();
      replayer.current = null;
      if (host.current) host.current.innerHTML = "";
      setBild(false);
    };
  }, [offen, unitId]);

  // Eingreifen: Befehle der Reihe nach; aufeinanderfolgende Zugschritte werden zu einem
  const reihe = useRef<Steuern[]>([]);
  const unterwegs = useRef(false);
  const schicken = useCallback(
    (c: Steuern) => {
      const q = reihe.current;
      const letzter = q.at(-1);
      if (c.art === "zeiger" && c.phase === "move" && letzter?.art === "zeiger" && letzter.phase === "move") q[q.length - 1] = c;
      else if (c.art === "rad" && letzter?.art === "rad") q[q.length - 1] = { ...c, dx: letzter.dx + c.dx, dy: letzter.dy + c.dy };
      else q.push(c);
      if (unterwegs.current) return;
      unterwegs.current = true;
      // whatever piled up while a request was on its way goes along in one request: a tap or a drag
      // costs one round trip, not one per step
      void (async () => {
        while (reihe.current.length) {
          const c = reihe.current.splice(0, 50);
          try {
            await fetch(`/einheiten/${unitId}/spiegel/steuern`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c }) });
          } catch {
            // offline: dieser Schritt geht verloren
          }
        }
        unterwegs.current = false;
      })();
    },
    [unitId],
  );

  const flaeche = useRef<HTMLDivElement>(null);
  const gedrueckt = useRef(false);
  const lang = Math.max(vp.w, vp.h);
  const massstab = v ? Math.min(GROESSEN[v.groesse] / lang, (fenster.w - 32) / vp.w, (fenster.h - 140) / vp.h) : 0.4;
  const punkt = (e: { clientX: number; clientY: number }) => {
    const r = flaeche.current!.getBoundingClientRect();
    return { x: Math.max(0, (e.clientX - r.left) / massstab), y: Math.max(0, (e.clientY - r.top) / massstab) };
  };

  // das Fenster am Kopf verschieben
  const zug = useRef<{ x: number; y: number; r: number; b: number } | null>(null);
  const kopfRunter = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || !v) return;
    zug.current = { x: e.clientX, y: e.clientY, r: v.r, b: v.b };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const kopfZiehen = (e: React.PointerEvent) => {
    const z = zug.current;
    if (!z) return;
    const r = Math.max(4, Math.min(fenster.w - 120, z.r - (e.clientX - z.x)));
    const b = Math.max(4, Math.min(fenster.h - 60, z.b - (e.clientY - z.y)));
    setV((alt) => (alt ? { ...alt, r, b } : alt));
  };
  const kopfLos = () => {
    if (!zug.current) return;
    zug.current = null;
    if (v) merken(v);
  };

  if (!v) return null;

  if (!v.offen) {
    return (
      <button
        type="button"
        onClick={() => aendern({ offen: true })}
        className="fixed right-4 bottom-4 z-[45] inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-surface shadow-[var(--shadow-card)] hover:bg-ink-2"
        data-testid="schuelerbildschirm-oeffnen"
      >
        <MonitorSmartphone size={18} aria-hidden /> Bildschirm von {student}
      </button>
    );
  }

  const breite = Math.round(vp.w * massstab);
  const hoehe = Math.round(vp.h * massstab);
  const offline = tablet !== null && !tablet.online;
  return (
    <section
      aria-label={`Bildschirm von ${student}`}
      className="fixed z-[45] overflow-hidden rounded-2xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-line"
      style={{ right: Math.min(v.r, Math.max(4, fenster.w - breite - 8)), bottom: Math.min(v.b, Math.max(4, fenster.h - hoehe - 60)) }}
      data-testid="schuelerbildschirm"
    >
      <header
        className={`flex cursor-grab touch-none items-center gap-1 px-2 py-1.5 select-none active:cursor-grabbing ${eingreifen ? "bg-accent text-white" : "bg-panel"}`}
        onPointerDown={kopfRunter}
        onPointerMove={kopfZiehen}
        onPointerUp={kopfLos}
        onPointerCancel={kopfLos}
      >
        <span className={`ml-1 h-2 w-2 shrink-0 rounded-full ${offline ? "bg-red" : bild ? "bg-green" : "bg-ink-3"}`} aria-hidden />
        <span className="min-w-0 flex-1 truncate px-1 text-[13px] font-semibold">
          {student}
          {offline ? " · offline" : ""}
        </span>
        <button
          type="button"
          onClick={() => setEingreifen((x) => !x)}
          aria-pressed={eingreifen}
          disabled={!bild}
          className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold disabled:opacity-40 ${eingreifen ? "bg-white text-accent" : "bg-surface text-ink hover:bg-paper"}`}
          title={eingreifen ? "Eingreifen aus: nur zuschauen" : "Eingreifen: am Tablet tippen, schreiben, scrollen"}
          data-testid="eingreifen"
        >
          <Hand size={15} aria-hidden /> Eingreifen
        </button>
        <button type="button" onClick={() => aendern({ groesse: Math.max(0, v.groesse - 1) })} disabled={v.groesse === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-40" aria-label="Kleiner">
          <Minus size={16} aria-hidden />
        </button>
        <button type="button" onClick={() => aendern({ groesse: Math.min(2, v.groesse + 1) })} disabled={v.groesse === 2} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-40" aria-label="Größer">
          <Plus size={16} aria-hidden />
        </button>
        <button type="button" onClick={() => aendern({ offen: false })} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10" aria-label="Zuklappen" data-testid="schuelerbildschirm-zu">
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="relative bg-paper" style={{ width: breite, height: hoehe }}>
        <div className={`origin-top-left ${offline ? "opacity-50 grayscale" : ""}`} style={{ width: vp.w, height: vp.h, transform: `scale(${massstab})` }}>
          <div ref={host} className="schueler-spiegel pointer-events-none" />
        </div>
        {!bild && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-[14px] text-ink-2" data-testid="schuelerbildschirm-warten">
            {tablet?.laptop ? `${student} arbeitet am eigenen Laptop. Den Bildschirm gibt es nur vom Tablet.` : offline ? "Das Tablet ist nicht verbunden." : "Warte auf das Tablet …"}
          </p>
        )}
        {bild && hinweis && (
          <p className="absolute inset-x-2 bottom-2 rounded-xl bg-surface/95 px-3 py-2 text-[12px] text-ink-2 shadow-[var(--shadow-card)]">
            {hinweis === "tafel" ? "Das Whiteboard selbst siehst du hier nicht. Öffne es oben über „Whiteboard öffnen“." : "Die Folien selbst siehst du hier nicht, nur was darum herum ist."}
          </p>
        )}
        {eingreifen && bild && (
          <div
            ref={flaeche}
            tabIndex={0}
            role="application"
            aria-label={`Am Tablet von ${student} tippen und schreiben`}
            className={`absolute inset-0 cursor-pointer touch-none outline-none ${tastatur ? "ring-3 ring-accent ring-inset" : ""}`}
            onFocus={() => setTastatur(true)}
            onBlur={() => setTastatur(false)}
            onPointerDown={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              e.currentTarget.setPointerCapture(e.pointerId);
              gedrueckt.current = true;
              schicken({ art: "zeiger", phase: "down", ...punkt(e) });
            }}
            onPointerMove={(e) => {
              if (gedrueckt.current) schicken({ art: "zeiger", phase: "move", ...punkt(e) });
            }}
            onPointerUp={(e) => {
              if (!gedrueckt.current) return;
              gedrueckt.current = false;
              schicken({ art: "zeiger", phase: "up", ...punkt(e) });
            }}
            onPointerCancel={(e) => {
              if (!gedrueckt.current) return;
              gedrueckt.current = false;
              schicken({ art: "zeiger", phase: "up", ...punkt(e) });
            }}
            onWheel={(e) => schicken({ art: "rad", ...punkt(e), dx: e.deltaX / massstab, dy: e.deltaY / massstab })}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape") return e.currentTarget.blur();
              // Strg+V kommt als Einfügen; AltGr (@, €, {) ist auf Windows Strg+Alt und schreibt
              if ((e.ctrlKey || e.metaKey) && !e.nativeEvent.getModifierState("AltGraph")) return;
              if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead", "AltGraph"].includes(e.key)) return;
              e.preventDefault();
              schicken({ art: "taste", key: e.key });
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) {
                e.preventDefault();
                schicken({ art: "text", text });
              }
            }}
            data-testid="eingreifen-flaeche"
          />
        )}
      </div>
      {eingreifen && bild && (
        <p className="bg-accent-wash px-3 py-1.5 text-[12px] font-medium text-accent">{tastatur ? "Deine Tastatur schreibt am Tablet. Esc: aufhören." : "Tippe ins Bild, um am Tablet zu tippen."}</p>
      )}
    </section>
  );
}
