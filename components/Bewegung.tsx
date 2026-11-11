"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Die Teile der Bewegung, die Zustand brauchen (niko, 11.11.2026, 20 Regeln; die Zeiten und Kurven stehen in
 * app/globals.css im Abschnitt „Bewegung“, die Übersicht in DESIGN.md).
 *
 * - `Ursprung`: einmal in app/layout.tsx. Merkt sich, wo zuletzt getippt wurde; ein Popover oder Dialog, der gleich
 *   danach aufgeht, wächst von dort (Regel 11) und geht dorthin zurück (Regel 12).
 * - `Gleiter`: die Marke des aktiven Eintrags als ein einziges Element, das zum neuen Eintrag wandert (Regel 20),
 *   mit ease-in-out (Regel 9) und unterwegs 12 % gestreckt (Regel 5).
 * - `IconWechsel`: zwei Icons an derselben Stelle, die ineinander blenden (Regeln 16 und 18).
 * - `useAbgang`, `useSchliessen`: lassen etwas noch so lange stehen, bis sein Ausgang gespielt ist (Regeln 12 und 15).
 */

const WENIGER = "(prefers-reduced-motion: reduce)";
function wenigerBewegung() {
  return typeof window !== "undefined" && window.matchMedia(WENIGER).matches;
}

/** Ausgänge sind 20 % kürzer als Eingänge: Popover 200 → 160 ms, Dialog 220 → 176 ms, Schubfach 300 → 240 ms. */
export const AUSGANG = { pop: 160, dialog: 176, fach: 240 } as const;

const VOM_AUSLOESER = new Set(["pop-rein", "dialog-rein"]);

export function Ursprung() {
  useEffect(() => {
    let zuletzt: { x: number; y: number; t: number } | null = null;
    const merken = (e: PointerEvent) => {
      zuletzt = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const setzen = (e: AnimationEvent) => {
      if (!VOM_AUSLOESER.has(e.animationName) || !(e.target instanceof HTMLElement)) return;
      const el = e.target;
      // mit der Tastatur geöffnet (kein Tipp kurz davor): aus der Mitte, wie gehabt
      if (!zuletzt || performance.now() - zuletzt.t > 700) {
        el.style.removeProperty("transform-origin");
        return;
      }
      const r = el.getBoundingClientRect();
      el.style.transformOrigin = `${Math.round(zuletzt.x - r.left)}px ${Math.round(zuletzt.y - r.top)}px`;
    };
    // iPhone und iPad zeigen :active nur, wenn die Seite auf Berührungen hört
    const nichts = () => {};
    document.addEventListener("pointerdown", merken, true);
    document.addEventListener("animationstart", setzen, true);
    document.addEventListener("touchstart", nichts, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", merken, true);
      document.removeEventListener("animationstart", setzen, true);
      document.removeEventListener("touchstart", nichts);
    };
  }, []);
  return null;
}

const AKTIV = '[aria-current="page"], [aria-current="true"], [aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [data-aktiv="true"], label:has(input:checked)';
type Maß = { x: number; y: number; w: number; h: number };

/**
 * Eine Reihe von Einträgen, von denen einer aktiv ist (Navigation, Tabs, Umschalter). Die Fläche des aktiven Eintrags
 * ist hier ein eigenes Element hinter den Einträgen; wechselt der aktive Eintrag, wandert sie hin.
 *
 * Der aktive Eintrag ist der mit `aria-current`, `aria-pressed`, `aria-selected`, `aria-checked`, `data-aktiv` oder
 * einem angehakten Feld im `label`. Das Element, dessen Fläche die Marke ersetzt, trägt `data-gleit-ziel` (der Eintrag
 * selbst oder ein Teil darin, etwa der Kreis um das Icon). Ohne JavaScript bleibt alles wie zuvor: die Einträge
 * behalten ihre eigene Fläche, bis die Marke steht.
 *
 * `marke`: die Klassen der Fläche (Farbe, Schatten). Der Behälter muss positioniert sein (`relative`, `fixed` …).
 */
export function Gleiter({
  as: Tag = "div",
  marke,
  className = "",
  children,
  ...rest
}: { as?: "div" | "nav" | "span"; marke: string; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const pille = useRef<HTMLSpanElement>(null);
  const stand = useRef<Maß | null>(null);

  const messen = useCallback(() => {
    const el = ref.current;
    const p = pille.current;
    if (!el || !p) return;
    let aktiv: HTMLElement | null = null;
    try {
      aktiv = el.querySelector<HTMLElement>(AKTIV);
    } catch {
      // ein alter Browser ohne :has(): dann ohne Marke, die Einträge zeigen sich selbst
    }
    const ziel = aktiv ? (aktiv.matches("[data-gleit-ziel]") ? aktiv : (aktiv.querySelector<HTMLElement>("[data-gleit-ziel]") ?? aktiv)) : null;
    if (!ziel || !ziel.getClientRects().length) {
      // kein aktiver Eintrag (oder die Leiste ist gerade nicht zu sehen): die Einträge zeigen sich wieder selbst
      el.removeAttribute("data-an");
      stand.current = null;
      return;
    }
    const er = el.getBoundingClientRect();
    const zr = ziel.getBoundingClientRect();
    const neu: Maß = {
      x: zr.left - er.left - el.clientLeft + el.scrollLeft,
      y: zr.top - er.top - el.clientTop + el.scrollTop,
      w: zr.width,
      h: zr.height,
    };
    const alt = stand.current;
    const gleich = alt && Math.abs(alt.x - neu.x) < 0.5 && Math.abs(alt.y - neu.y) < 0.5 && Math.abs(alt.w - neu.w) < 0.5 && Math.abs(alt.h - neu.h) < 0.5;
    if (gleich && el.hasAttribute("data-an")) return;
    // mitten im Weg umentschieden: von dort weiter, wo die Marke gerade ist
    let von = alt;
    const laeuft = p.getAnimations();
    if (alt && laeuft.length) {
      const pr = p.getBoundingClientRect();
      von = { x: pr.left - er.left - el.clientLeft + el.scrollLeft, y: pr.top - er.top - el.clientTop + el.scrollTop, w: pr.width, h: pr.height };
    }
    laeuft.forEach((a) => a.cancel());
    p.style.width = `${neu.w}px`;
    p.style.height = `${neu.h}px`;
    p.style.transform = `translate(${neu.x}px, ${neu.y}px)`;
    p.style.borderRadius = getComputedStyle(ziel).borderRadius;
    el.setAttribute("data-an", "");
    stand.current = neu;
    // nur ein echter Wechsel des Eintrags wandert; ein Umbruch oder eine neue Fensterbreite springt
    const wechsel = von && (Math.abs(von.x - neu.x) > 2 || Math.abs(von.y - neu.y) > 2);
    if (!von || !wechsel || wenigerBewegung() || typeof p.animate !== "function") return;
    const quer = Math.abs(neu.x - von.x) >= Math.abs(neu.y - von.y);
    // unterwegs 12 % länger, in Richtung des Wegs, und dabei mittig auf der Bahn
    const mw = ((von.w + neu.w) / 2) * (quer ? 1.12 : 1);
    const mh = ((von.h + neu.h) / 2) * (quer ? 1 : 1.12);
    const mx = (von.x + von.w / 2 + neu.x + neu.w / 2) / 2 - mw / 2;
    const my = (von.y + von.h / 2 + neu.y + neu.h / 2) / 2 - mh / 2;
    p.animate(
      [
        { transform: `translate(${von.x}px, ${von.y}px)`, width: `${von.w}px`, height: `${von.h}px` },
        { transform: `translate(${mx}px, ${my}px)`, width: `${mw}px`, height: `${mh}px` },
        { transform: `translate(${neu.x}px, ${neu.y}px)`, width: `${neu.w}px`, height: `${neu.h}px` },
      ],
      { duration: 280, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
  }, []);

  useLayoutEffect(() => {
    messen();
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let bild = 0;
    const bald = () => {
      cancelAnimationFrame(bild);
      bild = requestAnimationFrame(messen);
    };
    const mo = new MutationObserver(bald);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "aria-pressed", "aria-selected", "aria-checked", "data-aktiv", "class"] });
    const ro = new ResizeObserver(bald);
    ro.observe(el);
    el.addEventListener("change", bald);
    window.addEventListener("resize", bald);
    // die Schrift lädt nach: danach sind die Einträge anders breit
    document.fonts?.ready.then(bald).catch(() => {});
    return () => {
      cancelAnimationFrame(bild);
      mo.disconnect();
      ro.disconnect();
      el.removeEventListener("change", bald);
      window.removeEventListener("resize", bald);
    };
  }, [messen]);

  const T = Tag as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} className={`gleiter ${className}`} {...rest}>
      <span ref={pille} className={`gleit-marke ${marke}`} aria-hidden />
      {children}
    </T>
  );
}

/**
 * Zwei Icons an derselben Stelle: `an` zeigt `ein`, sonst `aus`. Beide liegen übereinander und blenden ineinander,
 * das gehende wird dabei unscharf und kleiner. Braucht keinen Zustand, geht auch in Server-Komponenten.
 */
export function IconWechsel({ an, aus, ein, className = "" }: { an: boolean; aus: React.ReactNode; ein: React.ReactNode; className?: string }) {
  return (
    <span className={`icon-wechsel ${className}`} data-an={an ? "true" : "false"}>
      <span aria-hidden={an || undefined}>{aus}</span>
      <span aria-hidden={!an || undefined}>{ein}</span>
    </span>
  );
}

/**
 * Für etwas, das die eigene Komponente ein- und ausblendet (`offen`): `da` sagt, ob es noch im Baum stehen soll,
 * `geht`, ob gerade der Ausgang läuft (Klasse `geht`). Bei „weniger Bewegung“ verschwindet es sofort.
 */
export function useAbgang(offen: boolean, ms: number = AUSGANG.pop) {
  const [da, setDa] = useState(offen);
  if (offen && !da) setDa(true);
  useEffect(() => {
    if (offen || !da) return;
    if (wenigerBewegung()) {
      setDa(false);
      return;
    }
    const t = setTimeout(() => setDa(false), ms);
    return () => clearTimeout(t);
  }, [offen, da, ms]);
  return { da: offen || da, geht: !offen && da };
}

/**
 * Für einen Dialog, den die Seite darüber ein- und aushängt: `schliessen()` spielt erst den Ausgang (Klasse `geht`)
 * und ruft dann `onClose`. Liefert `[geht, schliessen]`.
 */
export function useSchliessen(onClose: () => void, ms: number = AUSGANG.dialog): [boolean, () => void] {
  const [geht, setGeht] = useState(false);
  const zu = useRef(onClose);
  zu.current = onClose;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const schliessen = useCallback(() => {
    if (timer.current) return;
    if (wenigerBewegung()) {
      zu.current();
      return;
    }
    setGeht(true);
    timer.current = setTimeout(() => zu.current(), ms);
  }, [ms]);
  return [geht, schliessen];
}
