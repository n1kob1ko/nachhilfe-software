/**
 * Das ganze Blatt am Tablet (docs/blatt-am-tablet.md): alle Aufgaben untereinander wie auf Papier statt einer Aufgabe
 * nach der anderen. Gilt für die Blätter aus „Stoff vorbereiten“ (settings.stoffpaket) und für jedes Blatt mit
 * settings.blatt = true; settings.blatt = false schaltet es auch dort ab (Wahl der Lehrkraft in der Übung). Hier nur Reines ohne Datenbank, damit es auch im Browser läuft.
 */

/** Ob ein Blatt am Gerät als ganzes Blatt erscheint (worksheets.settings als JSON-Text). */
export function alsBlatt(settings: string | null | undefined): boolean {
  if (!settings) return false;
  try {
    const s = JSON.parse(settings) as { blatt?: unknown; stoffpaket?: unknown };
    if (typeof s.blatt === "boolean") return s.blatt;
    return typeof s.stoffpaket === "object" && s.stoffpaket !== null;
  } catch {
    return false;
  }
}

/** Die Einstellungen mit der Wahl der Lehrkraft (ganzes Blatt oder eine Aufgabe nach der anderen); der Rest bleibt. */
export function mitBlatt(settings: string | null | undefined, an: boolean): string {
  let s: Record<string, unknown> = {};
  try {
    const x = settings ? (JSON.parse(settings) as unknown) : {};
    if (x && typeof x === "object" && !Array.isArray(x)) s = x as Record<string, unknown>;
  } catch {
    // kaputte Einstellungen: nur die Wahl bleibt
  }
  return JSON.stringify({ ...s, blatt: an });
}

/** Ab so vielen Minuten an derselben Aufgabe ohne Abschluss sieht die Lehrkraft „hängt fest“. */
export const HAENGT_MINUTEN = { uebung: 5, test: 8 } as const;
/** Ab so vielen falschen Versuchen an derselben Aufgabe (nur Übung; im Test gibt es einen Versuch). */
export const HAENGT_VERSUCHE = 2;

export type HaengtEingabe = {
  state: string;
  since: string | null;
  test: boolean;
  tries: number;
  last: null | { correct: boolean; final: boolean; pending?: boolean };
};

/**
 * Hängt der Schüler an der offenen Aufgabe fest? Ein kurzer Grund für die Lehrkraft, sonst null.
 * Nicht mehr, sobald die Aufgabe abgeschlossen ist (richtig, abgegeben oder Lösung angesehen).
 */
export function haengtFest(c: HaengtEingabe, jetzt: number = Date.now()): string | null {
  if (c.state !== "arbeitet" || !c.since) return null;
  if (c.last?.final || c.last?.pending) return null;
  const falsch = c.last && !c.last.correct ? c.tries : 0;
  if (!c.test && falsch >= HAENGT_VERSUCHE) return `${falsch} Versuche falsch`;
  const min = Math.floor((jetzt - Date.parse(c.since)) / 60_000);
  if (!Number.isFinite(min)) return null;
  if (min >= (c.test ? HAENGT_MINUTEN.test : HAENGT_MINUTEN.uebung)) return `seit ${min} Minuten an derselben Aufgabe`;
  return null;
}
