"use client";

/**
 * Angefangene Lernspiele merken und weiterspielen, auf der Seite des Spiels (lib/spielstand.ts ist die Seite des
 * Servers). niko 2026-11-25: „es soll halt den stand halten und wenn was passiert, dass man halt zurück zum spielstand
 * gehen kann“.
 *
 * `useSpielstand(spiel, token)`:
 * - `merke(stand, runden)` nach jedem Zug: sofort eine Kopie auf dem Gerät (localStorage), kurz danach an den Server
 *   (und sofort, wenn die App in den Hintergrund geht oder das Spiel zugeht). So bleibt ein Zug auch dann, wenn der
 *   Server gerade neu startet (Deploy).
 * - `offen`: beim Öffnen der neuere der beiden Stände, den der Server noch gelten lässt (seine Runde ist offen und
 *   gehört diesem Schüler). Ist der Server nicht erreichbar, gilt die Kopie vom Gerät.
 * - `vergiss()` am Ende des Spiels.
 *
 * `token` leer: am Schüler-Tablet. Die Kopie liegt dann unter „tablet“; ob sie zum Schüler der Einheit passt, prüft der Server.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { spielstandHolenAction, spielstandMerkenAction, spielstandVergessenAction } from "@/app/lernspiel-actions";
import { sicher } from "@/lib/verbindung";

type Kopie<T> = { stand: T; runden: number[]; at: number };

const schluessel = (token: string, spiel: string) => `ls-stand:${token ? token.slice(0, 16) : "tablet"}:${spiel}`;

function liesKopie<T>(k: string): Kopie<T> | null {
  try {
    const roh = window.localStorage.getItem(k);
    if (!roh) return null;
    const x = JSON.parse(roh) as Kopie<T>;
    return x && Array.isArray(x.runden) && Number.isFinite(x.at) && x.stand !== undefined ? x : null;
  } catch {
    return null;
  }
}
function schreibKopie<T>(k: string, kopie: Kopie<T> | null) {
  try {
    if (kopie) window.localStorage.setItem(k, JSON.stringify(kopie));
    else window.localStorage.removeItem(k);
  } catch {
    // voll oder gesperrt: dann merkt es sich nur der Server
  }
}

/** Punkte aus einem gemerkten Stand (nie negativ, ganze Zahl). */
export const startPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) && p > 0 ? Math.floor(p) : 0);
/** Herzen aus einem gemerkten Stand (1 bis `max`; sonst `max`). */
export const startHerzen = (h: unknown, max: number) => (typeof h === "number" && Number.isInteger(h) && h >= 1 && h <= max ? h : max);

export type Gemerkt<T> = { stand: T; at: number };

export function useSpielstand<T>(spiel: string | null, token: string) {
  const [offen, setOffen] = useState<Gemerkt<T> | null>(null);
  // erst nach der Antwort des Servers (oder ohne ihn) steht fest, ob es etwas zum Weiterspielen gibt
  const [geprueft, setGeprueft] = useState(!spiel);
  const k = spiel ? schluessel(token, spiel) : null;
  const wartet = useRef<Kopie<T> | null>(null);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zuletzt = useRef(0);

  useEffect(() => {
    if (!spiel || !k) return;
    let weg = false;
    const kopie = liesKopie<T>(k);
    void sicher(() => spielstandHolenAction(token, spiel, kopie), [800, 2000]).then((r) => {
      if (weg) return;
      if (r && "fehler" in r) setOffen(kopie ? { stand: kopie.stand, at: kopie.at } : null);
      else if (r) setOffen(r as Gemerkt<T>);
      else {
        // der Server kennt nichts Gültiges (beendet, zu alt oder ein anderer Schüler am Tablet): die Kopie ist überholt
        if (kopie) schreibKopie(k, null);
        setOffen(null);
      }
      setGeprueft(true);
    });
    return () => {
      weg = true;
    };
  }, [spiel, k, token]);

  const senden = useCallback(() => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    const w = wartet.current;
    wartet.current = null;
    if (!w || !spiel) return;
    void spielstandMerkenAction(token, spiel, w.stand, w.runden, w.at).catch(() => false);
  }, [spiel, token]);

  const merke = useCallback(
    (stand: T, runden: number[]) => {
      if (!spiel || !k) return;
      const ids = runden.filter((r) => Number.isInteger(r) && r > 0);
      if (!ids.length) return;
      // immer später als der letzte (zwei Züge in derselben Millisekunde)
      const at = Math.max(Date.now(), zuletzt.current + 1);
      zuletzt.current = at;
      const kopie: Kopie<T> = { stand, runden: ids, at };
      schreibKopie(k, kopie);
      wartet.current = kopie;
      if (uhr.current) clearTimeout(uhr.current);
      uhr.current = setTimeout(senden, 800);
    },
    [spiel, k, senden],
  );

  const vergiss = useCallback(() => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    wartet.current = null;
    setOffen(null);
    if (!spiel || !k) return;
    schreibKopie(k, null);
    void sicher(() => spielstandVergessenAction(token, spiel)).catch(() => undefined);
  }, [spiel, k, token]);

  // in den Hintergrund oder zu: was noch wartet, geht jetzt
  useEffect(() => {
    const weg = () => {
      if (document.visibilityState === "hidden") senden();
    };
    document.addEventListener("visibilitychange", weg);
    window.addEventListener("pagehide", senden);
    return () => {
      document.removeEventListener("visibilitychange", weg);
      window.removeEventListener("pagehide", senden);
      senden();
    };
  }, [senden]);

  return { offen, geprueft, merke, vergiss };
}
