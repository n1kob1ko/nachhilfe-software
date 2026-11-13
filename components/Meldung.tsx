"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

/**
 * Sofort wirken, rückgängig statt Rückfrage (niko, 13.11.2026: Optimistic Updates, Undo-Toasts).
 *
 * - `sofort({ zeile, aktion })`: die Zeile verschwindet beim Tipp, die Aktion läuft dahinter. Geht sie schief, ist die
 *   Zeile wieder da und eine Meldung sagt es. Für Abhaken und alles, was man nicht bereut.
 * - `spaeter({ zeile, text, aktion })`: für Löschen. Die Zeile verschwindet sofort, unten erscheint „… gelöscht ·
 *   Rückgängig“. Erst wenn die Meldung nach sechs Sekunden geht (oder weggewischt wird, die Seite verlassen wird, ein
 *   anderer Link oder Knopf getippt wird), wird wirklich gelöscht. „Rückgängig“ holt die Zeile zurück, es ist nie
 *   etwas passiert. Darum braucht das Löschen kein „Wirklich?“ mehr, und es gibt nichts wiederherzustellen.
 * - `WegForm`: beides als Formular um einen Knopf, für Seiten vom Server.
 *
 * Zeilen tragen `data-zeile="art-id"`. Versteckt wird über eine Regel im Kopf der Seite, nicht am Element: so bleibt
 * die Zeile auch weg, wenn die Liste neu vom Server kommt oder dieselbe Sache an zwei Stellen steht (Handy-Liste und
 * Tabelle der Abrechnung).
 *
 * Schweres Löschen (Schüler, Lehrer, Material, Bibliothek) behält seinen eigenen Schritt „Endgültig löschen“.
 */

const weg = new Map<string, number>();

function regelSchreiben() {
  let el = document.getElementById("zeilen-weg") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "zeilen-weg";
    document.head.appendChild(el);
  }
  const wahl = [...weg.keys()].map((k) => `[data-zeile="${CSS.escape(k)}"]`).join(",");
  el.textContent = wahl ? `${wahl}{display:none!important}` : "";
}

/** Versteckt alle Zeilen mit diesem Schlüssel; die Rückgabe zeigt sie wieder. */
function verstecke(zeile: string | undefined): () => void {
  if (!zeile) return () => {};
  weg.set(zeile, (weg.get(zeile) ?? 0) + 1);
  regelSchreiben();
  let offen = true;
  return () => {
    if (!offen) return;
    offen = false;
    const n = (weg.get(zeile) ?? 1) - 1;
    if (n > 0) weg.set(zeile, n);
    else weg.delete(zeile);
    regelSchreiben();
  };
}

const FEHLER = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

/** Führt aus und zeigt die Zeile wieder, sobald der Server geantwortet hat: bei Erfolg steht sie dann nicht mehr in der Liste. */
async function ausfuehren(aktion: () => Promise<unknown>, zeigen: () => void) {
  try {
    const r = await aktion();
    const fehler = r && typeof r === "object" && "error" in r && typeof r.error === "string" ? r.error : null;
    if (fehler) {
      zeigen();
      toast.error(fehler);
      return;
    }
    // die neue Liste vom Server fügt React einen Moment nach der Antwort ein; bis dahin bleibt die Zeile versteckt
    setTimeout(zeigen, 400);
  } catch {
    zeigen();
    toast.error(FEHLER);
  }
}

/** Wirkt sofort: die Zeile ist weg, die Aktion läuft dahinter. */
export function sofort({ zeile, aktion }: { zeile?: string; aktion: () => Promise<unknown> }) {
  void ausfuehren(aktion, verstecke(zeile));
}

/** Was noch auf sein „Rückgängig“ wartet: jede Funktion führt ihre Aktion jetzt aus. */
const wartend = new Set<() => void>();

/** So lange steht „Rückgängig“ da. */
const BEDENKZEIT_MS = 6000;

/** Löschen mit Bedenkzeit: sofort weg, wirklich gelöscht erst, wenn die Meldung geht. */
export function spaeter({ zeile, text, aktion }: { zeile?: string; text: string; aktion: () => Promise<unknown> }) {
  // eins nach dem anderen: was noch wartet, wird jetzt ausgeführt
  jetztAlle();
  const zeigen = verstecke(zeile);
  let entschieden = false;
  const los = () => {
    if (entschieden) return;
    entschieden = true;
    wartend.delete(los);
    toast.dismiss(id);
    void ausfuehren(aktion, zeigen);
  };
  wartend.add(los);
  const id = toast(text, {
    duration: BEDENKZEIT_MS,
    action: {
      label: "Rückgängig",
      onClick: () => {
        if (entschieden) return;
        entschieden = true;
        wartend.delete(los);
        zeigen();
      },
    },
    onAutoClose: los,
    onDismiss: los,
  });
}

function jetztAlle() {
  for (const los of [...wartend]) los();
}

/**
 * Einmal in app/layout.tsx: die Meldungen unten in der Mitte (am Telefon über der Leiste) und die Regel, dass
 * Wartendes ausgeführt wird, sobald man weitergeht (Link, Formular, Seite verlassen).
 */
export function Meldungen() {
  useEffect(() => {
    const weiter = (e: Event) => {
      if (!wartend.size) return;
      const ziel = e.target instanceof Element ? e.target : null;
      // die Meldung selbst (Rückgängig, Wegwischen) zählt nicht als Weitergehen
      if (ziel?.closest("[data-sonner-toaster]")) return;
      if (e.type === "click" && !ziel?.closest("a[href]")) return;
      jetztAlle();
    };
    const verlassen = () => {
      if (document.visibilityState === "hidden") jetztAlle();
    };
    document.addEventListener("click", weiter, true);
    document.addEventListener("submit", weiter, true);
    document.addEventListener("visibilitychange", verlassen);
    window.addEventListener("pagehide", jetztAlle);
    return () => {
      document.removeEventListener("click", weiter, true);
      document.removeEventListener("submit", weiter, true);
      document.removeEventListener("visibilitychange", verlassen);
      window.removeEventListener("pagehide", jetztAlle);
    };
  }, []);
  return (
    <Toaster
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: "calc(84px + env(safe-area-inset-bottom))", left: 16, right: 16 }}
      visibleToasts={2}
      containerAriaLabel="Meldungen"
      toastOptions={{ classNames: { toast: "meldung", actionButton: "meldung-knopf" } }}
    />
  );
}

type FormAktion = (fd: FormData) => Promise<unknown>;

/**
 * Ein Formular um einen Knopf, dessen Zeile beim Tipp verschwindet. Mit `text` ist es Löschen mit „Rückgängig“
 * (`spaeter`), ohne `text` wirkt es sofort (`sofort`). `danach`: gleich dorthin wechseln (Löschen auf der Seite der
 * Sache selbst). Die Aktion darf nicht umleiten: sie läuft vielleicht erst, wenn man schon woanders ist.
 */
export function WegForm({ action, zeile, text, danach, className, children }: { action: FormAktion; zeile: string; text?: string; danach?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const aktion = () => action(fd);
        if (text) spaeter({ zeile, text, aktion });
        else sofort({ zeile, aktion });
        if (danach) router.push(danach);
      }}
    >
      {children}
    </form>
  );
}
