/**
 * Aufrufe aus den Lernspielen an den Server, die nie hängen bleiben.
 *
 * niko 2026-11-22: „nach der Zeit kommt dieselbe Frage durchgehend“. Ursache: Endlos, Blockwerk, Funkelfeld und Torlauf
 * holen die nächste Runde im Hintergrund. Schlug das einmal fehl (Neustart des Servers beim Deploy, kurz kein Netz, oder
 * nach einem Deploy kennt der Server die Aktionen der offenen Seite nicht mehr), blieb das Spiel auf der letzten Karte
 * stehen und stellte sie immer wieder. Jetzt: ein paar Versuche mit Pause, dann `{ fehler: VERBINDUNG_WEG }` statt
 * einer Ausnahme, und das Spiel zeigt „Neu laden“.
 */

export const VERBINDUNG_WEG = "Die Verbindung zur App ist weg, vielleicht wurde sie gerade aktualisiert. Lade die Seite neu, dann geht es weiter.";

/** Pausen zwischen den Versuchen (ms): ein Neustart dauert meist ein paar Sekunden. */
export const VERSUCH_PAUSEN = [500, 1500, 3000];

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Ruft `aufruf` auf; wirft er, noch einmal nach jeder Pause aus `pausen`. Klappt keiner, kommt `{ fehler: VERBINDUNG_WEG }`.
 * Eine Antwort mit `fehler` vom Server selbst (z. B. keine Karten mehr) geht unverändert zurück.
 */
export async function sicher<T>(aufruf: () => Promise<T>, pausen: number[] = VERSUCH_PAUSEN, schlafen: (ms: number) => Promise<void> = warte): Promise<T | { fehler: string }> {
  for (let i = 0; ; i++) {
    try {
      return await aufruf();
    } catch {
      if (i >= pausen.length) return { fehler: VERBINDUNG_WEG };
      await schlafen(pausen[i]);
    }
  }
}

/** War der Fehler die abgerissene Verbindung (dann hilft Neuladen), nicht eine Antwort des Servers? */
export const verbindungWeg = (r: unknown): boolean => !!r && typeof r === "object" && "fehler" in r && (r as { fehler: unknown }).fehler === VERBINDUNG_WEG;
