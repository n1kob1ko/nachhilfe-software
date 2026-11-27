/**
 * Wie ein Übungsheft zu den Fehlern (lib/uebungsheft.ts) aussieht, ohne Datenbank (auch im Browser): vor der ersten Aufgabe eines
 * Teils stehen sein Titel, der Merke-Kasten und „aus deinem Text“, vor der ersten Aufgabe einer Übung ihr Titel, ihre Anweisung und
 * das Beispiel. Die Anweisung steht dann nicht noch einmal über jedem Satz. Am Tablet (ganzes Blatt), in der Vorschau und im Ausdruck.
 */

/** Was ein Übungsheft über sich weiß (worksheets.settings.uebungsheft). */
export type HeftInfo = {
  vorweg: string;
  teile: { titel: string; merke: string[]; beispiele: { falsch: string; richtig: string }[]; uebungen: { titel: string; auftrag: string; beispiel: string | null }[] }[];
  kontrolle: string[];
  pruefen: string[];
  quelle: { art: "text"; textId: number } | { art: "muster"; erkenntnisIds: number[] };
};

export type TeilKopf = { buchstabe: string; titel: string; merke: string[]; beispiele: { falsch: string; richtig: string }[] };
export type UebungKopf = { nr: number; titel: string; auftrag: string; beispiel: string | null };
/** Was vor einer Aufgabe steht: der Teil (bei seiner ersten Aufgabe), die Übung (bei ihrer ersten Aufgabe). */
export type Abschnitt = { teil?: TeilKopf; uebung?: UebungKopf };

/** Die Heft-Info aus den Einstellungen einer Übung (JSON-Text), oder null. */
export function heftInfo(settings: string | null | undefined): HeftInfo | null {
  if (!settings) return null;
  try {
    const s = JSON.parse(settings) as { uebungsheft?: HeftInfo };
    return s.uebungsheft && Array.isArray(s.uebungsheft.teile) ? s.uebungsheft : null;
  } catch {
    return null;
  }
}

/** Teil A, B, C …; Übungen zählen durch das ganze Heft (Übung 1, 2, 3 …), wie auf dem Papier. */
export function abschnitte(info: HeftInfo | null, heft: ({ teil: number; uebung: number } | undefined)[]): (Abschnitt | null)[] {
  if (!info) return heft.map(() => null);
  let letzterTeil = -1;
  let letzteUebung = "";
  let nr = 0;
  return heft.map((h) => {
    if (!h) return null;
    const teil = info.teile[h.teil];
    const uebung = teil?.uebungen[h.uebung];
    if (!teil || !uebung) return null;
    const out: Abschnitt = {};
    if (h.teil !== letzterTeil) {
      letzterTeil = h.teil;
      out.teil = { buchstabe: String.fromCharCode(65 + (h.teil % 26)), titel: teil.titel, merke: teil.merke, beispiele: teil.beispiele };
    }
    const key = `${h.teil}:${h.uebung}`;
    if (key !== letzteUebung) {
      letzteUebung = key;
      nr++;
      out.uebung = { nr, titel: uebung.titel, auftrag: uebung.auftrag, beispiel: uebung.beispiel };
    }
    return out.teil || out.uebung ? out : {};
  });
}

/**
 * Die Aufgabe ohne die Anweisung der Übung davor (die steht schon im Kopf der Übung). Bleibt nichts übrig (Fehlerdetektiv: der Satz
 * steht im Feld darunter), ist die Frage leer und die Ansicht zeigt keine Zeile dafür.
 */
export function ohneAuftrag(prompt: string, auftrag: string | undefined): string {
  const a = (auftrag ?? "").trim();
  if (!a || !prompt.startsWith(a)) return prompt;
  return prompt.slice(a.length).replace(/^\s*\n/, "").trim();
}

/** Die Anweisung der Übung, zu der eine Aufgabe gehört. */
export function auftragVon(info: HeftInfo | null, h: { teil: number; uebung: number } | undefined): string | undefined {
  return h ? info?.teile[h.teil]?.uebungen[h.uebung]?.auftrag : undefined;
}
