"use client";

import { usePathname, useRouter } from "next/navigation";
// Der einzige Griff in Next hinein: „ganz vorladen“. Zieht dieser Pfad einmal um, scheitert der Build laut statt still.
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Seitenwechsel, die sich sofort anfühlen (niko, 13.11.2026: Skeleton-Loader, Stale-while-revalidate, Doherty-Schwelle).
 *
 * Drei Bausteine, alle ohne Wartezeit für schnelle Seiten:
 *
 * 1. **Die Leiste antwortet sofort.** `NavWaechter` (einmal in app/layout.tsx) merkt sich, wohin gerade getippt wurde;
 *    `useNavZiel()` gibt dieses Ziel zurück, solange die neue Seite noch lädt. Navigation und Tabs setzen ihre Marke
 *    damit schon beim Tipp um, nicht erst, wenn der Server geantwortet hat.
 * 2. **Skelett nur, wenn es dauert.** `SeitenRahmen` um den Inhalt einer Seite: kommt die neue Seite in unter einer Viertelsekunde
 *    (die meisten), bleibt die alte so lange stehen und es gibt genau einen Wechsel. Dauert es länger (Heute mit vielen
 *    Schülern, schwaches Netz), steht ab dann die Form der neuen Seite als Skelett da. Bewusst kein `loading.tsx`:
 *    dessen Platzhalter ersetzt die alte Seite sofort und React hält ihn dann mindestens 0,3 s, das wäre für die
 *    schnellen Seiten ein Rückschritt (niko, 12.11.2026: „irgendwie laggt die Seite“).
 * 3. **Alte Daten sofort, frische gleich danach.** `useVorladen(href)` lädt eine Seite ganz vor, sobald man auf ihren
 *    Eintrag zeigt oder ihn berührt, und Next hält sie fünf Minuten. Der Wechsel dorthin ist dann sofort da. Die Seite
 *    selbst trägt `<Frisch />` (components/Frisch.tsx): zeigt sie beim Ankommen einen Stand, der älter als ein paar
 *    Sekunden ist, holt sie gleich den frischen (`router.refresh()`), der sich ohne Flackern einfügt.
 *    Beides gehört zusammen und nur auf Seiten, die man liest (Heute, Schüler, Erweitert, Tabs der Schüler-App):
 *    wer `useVorladen` für eine Seite ohne `<Frisch />` nutzt, zeigt bis zu fünf Minuten alte Daten. Seiten mit Eingaben
 *    (Textarbeit, Formulare, laufende Einheit) kommen immer frisch vom Server, damit nie ein alter Stand in einem Feld landet.
 */

type Ziel = { pfad: string; von: string };
let ziel: Ziel | null = null;
const hoerer = new Set<() => void>();
function setzeZiel(z: Ziel | null) {
  ziel = z;
  hoerer.forEach((h) => h());
}
function abo(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Der Pfad, zu dem gerade gewechselt wird, solange die neue Seite noch nicht da ist; sonst `null`. */
export function useNavZiel(): string | null {
  const pfad = usePathname();
  const z = useSyncExternalStore(
    abo,
    () => ziel,
    () => null,
  );
  return z && z.von === pfad ? z.pfad : null;
}

/**
 * Pfad → wann er zum ersten Mal vorgeladen wurde, seit Next den Vorrat zuletzt verworfen hat. Älter kann ein Stand,
 * den noch niemand gesehen hat, nicht sein.
 */
const warm = new Map<string, number>();
/** Stand (Zeitstempel des Servers) → wann dieses Gerät ihn zum ersten Mal gezeigt hat. */
const gesehen = new Map<number, number>();
/** Ein Stand, der beim Ankommen älter ist, wird gleich aufgefrischt. */
const ALT_MS = 5_000;

/** Nach einem Tipp ohne Antwort (Netz weg, Wechsel abgebrochen) gibt die Leiste nach dieser Zeit wieder die echte Seite an. */
const AUFGEBEN_MS = 10_000;

export function NavWaechter() {
  const pfad = usePathname();

  useEffect(() => {
    const klick = (e: MouseEvent) => {
      // nur Wechsel, die Next selbst übernimmt (es hält den Klick an); alles andere lädt der Browser ohnehin neu
      if (!e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setzeZiel({ pfad: url.pathname, von: location.pathname });
    };
    // am Fenster: dort kommt der Klick erst an, nachdem React (am Dokument) ihn behandelt hat
    window.addEventListener("click", klick);
    let uhr: ReturnType<typeof setTimeout> | undefined;
    const ab = abo(() => {
      clearTimeout(uhr);
      if (ziel) uhr = setTimeout(() => setzeZiel(null), AUFGEBEN_MS);
    });
    return () => {
      window.removeEventListener("click", klick);
      clearTimeout(uhr);
      ab();
    };
  }, []);

  useEffect(() => {
    // angekommen (auch nach einer Umleitung): das Ziel hat sich erledigt
    if (ziel && ziel.von !== pfad) setzeZiel(null);
  }, [pfad]);

  return null;
}

/**
 * Lädt `href` ganz vor, sobald jemand darauf zeigt (kurz verweilt), es berührt oder mit der Tastatur erreicht.
 * Die Rückgabe gehört an den Link: `<Link href={href} {...useVorladen(href)}>`.
 */
export function useVorladen(href: string | null) {
  const router = useRouter();
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halt = () => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
  };
  useEffect(() => halt, []);
  if (!href) return {};
  const los = () => {
    if (href === location.pathname) return;
    if (!warm.has(href)) warm.set(href, Date.now());
    // Next lädt nur, was es nicht schon frisch im Vorrat hat, und meldet, wenn es den Vorrat verwirft
    router.prefetch(href, { kind: PrefetchKind.FULL, onInvalidate: () => warm.delete(href) });
  };
  return {
    // mit der Maus erst nach kurzem Verweilen: wer nur darüberfährt, löst nichts aus
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      halt();
      uhr.current = setTimeout(los, 70);
    },
    onPointerLeave: halt,
    onTouchStart: los,
    onFocus: los,
  };
}

/**
 * Der Stand einer Seite zum Lesen (`t`: wann der Server sie gebaut hat). Kommt die Seite aus dem Vorrat (vorgeladen,
 * Zurück-Taste) und ist der Stand älter als ein paar Sekunden, wird sie gleich aufgefrischt. Einbauen über
 * `<Frisch />` in components/Frisch.tsx.
 *
 * Das Alter rechnet nur mit der Uhr dieses Geräts: ein Stand, der schon einmal am Schirm war, ist so alt wie sein
 * erstes Erscheinen; ein nie gezeigter kann nur vom Vorladen stammen (oder kommt gerade frisch vom Server).
 */
export function FrischStand({ t }: { t: number }) {
  const router = useRouter();
  const angekommen = useRef(false);
  useEffect(() => {
    const jetzt = Date.now();
    const zuerst = gesehen.get(t);
    if (zuerst === undefined) {
      gesehen.set(t, jetzt);
      for (const [k, v] of gesehen) if (jetzt - v > 15 * 60_000) gesehen.delete(k);
    }
    // ein neuer Stand in derselben, schon offenen Seite kam eben vom Server (Auffrischen, gespeicherte Aktion)
    if (angekommen.current) return;
    angekommen.current = true;
    const vorgeladen = warm.get(location.pathname);
    const alter = zuerst !== undefined ? jetzt - zuerst : vorgeladen !== undefined ? jetzt - vorgeladen : 0;
    if (alter > ALT_MS) router.refresh();
  }, [t, router]);
  return null;
}

/** Ab wann das Skelett die alte Seite ablöst. Darunter merkt man die Wartezeit nicht, ein Zwischenbild würde nur flackern. */
const SKELETT_AB_MS = 250;

/**
 * Um den Inhalt einer Seite (im Rahmen der Lehrkraft und der Schüler-App). Zeigt die Seite; dauert ein Wechsel länger
 * als eine Viertelsekunde, steht bis zur Ankunft das Skelett der neuen Seite da.
 */
export function SeitenRahmen({ children, art = "lehrer" }: { children: React.ReactNode; art?: "lehrer" | "schueler" }) {
  const nach = useNavZiel();
  const [lang, setLang] = useState<string | null>(null);
  useEffect(() => {
    if (!nach) {
      setLang(null);
      return;
    }
    const t = setTimeout(() => {
      setLang(nach);
      // die neue Seite beginnt oben; wer unten war, sähe sonst nur das Ende des Skeletts
      window.scrollTo({ top: 0 });
    }, SKELETT_AB_MS);
    return () => clearTimeout(t);
  }, [nach]);
  const skelett = nach !== null && lang === nach;
  return (
    <>
      <div hidden={skelett}>{children}</div>
      {skelett && <Skelett form={art === "schueler" ? "schueler" : formVon(nach)} />}
    </>
  );
}

type Form = "dashboard" | "karten" | "kacheln" | "seite" | "schueler";

/** Welche Form die Seite hinter einem Pfad ungefähr hat. */
function formVon(pfad: string): Form {
  if (pfad === "/" || pfad === "/jetzt") return "dashboard";
  if (pfad === "/mehr") return "kacheln";
  if (["/schueler", "/uebungen", "/texte", "/blaetter", "/lehrer"].includes(pfad)) return "karten";
  return "seite";
}

function B({ className = "" }: { className?: string }) {
  return <div className={`skelett-block ${className}`} />;
}
function Karte({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`rounded-[18px] border border-line bg-surface p-5 ${className}`}>{children}</div>;
}
function Zeilen({ n }: { n: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <B key={i} className={`h-3.5 ${["w-11/12", "w-3/4", "w-5/6", "w-2/3"][i % 4]}`} />
      ))}
    </div>
  );
}

/** Die Form einer Seite in ruhigen Flächen: Überschrift, darunter das, was dort ungefähr steht. Sagt Vorlesern „lädt“. */
export function Skelett({ form }: { form: Form }) {
  return (
    <div className="skelett" data-skelett role="status" aria-label="Seite lädt">
      {form !== "schueler" && (
        <div className="mb-7">
          <B className="h-8 w-44" />
          <B className="mt-3 h-4 w-32" />
        </div>
      )}
      {form === "dashboard" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Karte key={i} className="!p-4">
                <B className="h-3 w-16" />
                <B className="mt-3 h-6 w-10" />
                <B className="mt-3 h-3 w-24" />
              </Karte>
            ))}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Karte className="lg:col-span-2">
              <B className="mb-5 h-4 w-36" />
              {[0, 1].map((i) => (
                <div key={i} className="mt-3 flex items-center gap-4 rounded-[16px] border border-line p-5">
                  <B className="h-5 w-12" />
                  <B className="h-10 w-10 !rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <B className="h-4 w-36" />
                    <B className="h-3 w-48" />
                  </div>
                  <B className="hidden h-11 w-36 !rounded-full sm:block" />
                </div>
              ))}
            </Karte>
            <Karte>
              <B className="mb-6 h-4 w-28" />
              <Zeilen n={6} />
            </Karte>
          </div>
        </>
      )}
      {form === "karten" && (
        <>
          <B className="mb-6 h-12 w-full max-w-[420px] !rounded-[12px]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Karte key={i}>
                <div className="flex items-center gap-3">
                  <B className="h-11 w-11 !rounded-full" />
                  <div className="flex-1 space-y-2.5">
                    <B className="h-4 w-32" />
                    <B className="h-3 w-40" />
                  </div>
                </div>
                <B className="mt-5 h-3 w-24" />
                <B className="mt-3 h-3 w-36" />
              </Karte>
            ))}
          </div>
        </>
      )}
      {form === "kacheln" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Karte key={i} className="flex items-center gap-3">
              <B className="h-10 w-10 !rounded-[12px]" />
              <div className="flex-1 space-y-2.5">
                <B className="h-4 w-28" />
                <B className="h-3 w-40" />
              </div>
            </Karte>
          ))}
        </div>
      )}
      {form === "seite" && (
        <div className="space-y-5">
          <Karte>
            <B className="mb-6 h-4 w-40" />
            <Zeilen n={4} />
          </Karte>
          <Karte>
            <B className="mb-6 h-4 w-32" />
            <Zeilen n={3} />
          </Karte>
        </div>
      )}
      {form === "schueler" && (
        <div className="space-y-5">
          <B className="h-36 w-full !rounded-[24px]" />
          <Karte>
            <B className="mb-6 h-4 w-40" />
            <Zeilen n={3} />
          </Karte>
          <Karte>
            <B className="mb-6 h-4 w-32" />
            <Zeilen n={3} />
          </Karte>
        </div>
      )}
    </div>
  );
}
