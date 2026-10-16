/**
 * Schulschriften -- welche Handschrift ein Kind lernt.
 *
 * GENERATORUNABHAENGIG, wie die Lineatur nebenan: Jedes Blatt, auf dem etwas
 * vorgeschrieben oder nachgemalt wird, braucht diese Auswahl.
 *
 * WAS HIER NICHT STEHT: Die CSS-Schriftfamilie. Welche Datei geladen wird,
 * ist Sache des Renderers -- ein PDF-Renderer bekaeme dieselbe Kennung und
 * einen anderen Weg zur Schrift. Hier steht nur, WELCHE Schrift gemeint ist
 * und was ueber sie zu wissen ist.
 *
 * DIE DREI DEUTSCHEN AUSGANGSSCHRIFTEN unterscheiden sich nicht kosmetisch,
 * sondern in der Buchstabenform und den Verbindungen. Welche gilt, haengt am
 * Bundesland und an der Schule -- deshalb ist es eine Auswahl und keine
 * Voreinstellung, die irgendwer fuer alle trifft.
 */

export const SCRIPT_IDS = ['druckschrift', 'va', 'sas', 'la'] as const;
export type ScriptId = (typeof SCRIPT_IDS)[number];

/** Druckbuchstaben oder verbundene Schreibschrift. */
export type ScriptKind = 'druck' | 'schreib';

export interface HandwritingScript {
  readonly id: ScriptId;
  readonly kind: ScriptKind;
  /**
   * Ob die Schriftdatei im Projekt liegt.
   *
   * `false` heisst: Der Eintrag ist waehlbar, aber die Datei fehlt. Die
   * Oberflaeche sagt das und faellt sichtbar auf die Druckschrift zurueck --
   * still eine andere Schrift zu setzen waere hier besonders heikel, weil das
   * Kind genau diese Formen nachmalen soll.
   */
  readonly bundled: boolean;
  /**
   * Woher die Datei kommt, falls sie fehlt. Steht in der Oberflaeche und in
   * `public/fonts/README.md`.
   */
  readonly source: string | null;
  /** Ab welcher Klassenstufe die Schrift ueblicherweise gelehrt wird. */
  readonly fromGrade: number;
  /**
   * x-Hoehe im Verhaeltnis zur Schriftgroesse.
   *
   * WOZU: Beim Nachmalen muss ein Kleinbuchstabe GENAU ins Mittelband der
   * Lineatur passen -- sonst malt das Kind Formen nach, die nicht zu den
   * Linien gehoeren. Aus Bandhoehe und diesem Verhaeltnis ergibt sich die
   * noetige Schriftgroesse.
   *
   * Der Wert ist der Schrift entnommen und eine NAEHERUNG: Er stimmt fuer
   * die runden Kleinbuchstaben, nicht auf den Punkt fuer jede Form. In der
   * Oberflaeche laesst sich die Groesse deshalb nachjustieren.
   */
  readonly xHeightRatio: number;
}

/**
 * Die Angaben zur Verfuegbarkeit sind Stand August 2026 und nachgeschlagen,
 * nicht geschaetzt. Wer eine Schrift ergaenzt, prueft die Lizenz und traegt
 * sie hier UND in `public/fonts/README.md` ein.
 */
export const HANDWRITING_SCRIPTS: Record<ScriptId, HandwritingScript> = {
  druckschrift: {
    id: 'druckschrift',
    kind: 'druck',
    /* Andika liegt bereits im Projekt: eine Schrift, die eigens fuer
     * Leseanfaenger gezeichnet wurde (eindeutiges a und g, unterscheidbares
     * I und l). SIL OFL. */
    bundled: true,
    source: null,
    fromGrade: 1,
    xHeightRatio: 0.52,
  },
  va: {
    id: 'va',
    kind: 'schreib',
    bundled: false,
    source: 'Gruenewald VA von Peter Wiegel — SIL Open Font License',
    fromGrade: 2,
    xHeightRatio: 0.46,
  },
  sas: {
    id: 'sas',
    kind: 'schreib',
    bundled: false,
    source: 'Bienchen SAS von Peter Wiegel — SIL Open Font License',
    fromGrade: 2,
    xHeightRatio: 0.46,
  },
  la: {
    id: 'la',
    kind: 'schreib',
    bundled: false,
    /* Ehrlich bleiben: Hier ist mir keine frei lizenzierte Fassung bekannt.
     * Lieber der Hinweis als ein Verweis, der ins Leere fuehrt. */
    source: 'Keine frei lizenzierte Fassung bekannt — kommerzielle Schrift nötig',
    fromGrade: 2,
    xHeightRatio: 0.44,
  },
};

/** Nur die Schriften, deren Datei tatsaechlich vorliegt. */
export function availableScripts(): readonly HandwritingScript[] {
  return SCRIPT_IDS.map((id) => HANDWRITING_SCRIPTS[id]).filter((script) => script.bundled);
}

/**
 * Was tatsaechlich gesetzt wird.
 *
 * Fehlt die gewuenschte Datei, wird auf die Druckschrift zurueckgefallen --
 * aber sichtbar: `substituted` sagt es, und die Oberflaeche zeigt es an. Ein
 * Nachmalblatt in der falschen Schrift waere schlimmer als eines, das sagt,
 * dass die Schrift fehlt.
 */
export interface ResolvedScript {
  readonly requested: HandwritingScript;
  readonly effective: HandwritingScript;
  readonly substituted: boolean;
}

export function resolveScript(id: ScriptId): ResolvedScript {
  const requested = HANDWRITING_SCRIPTS[id];
  if (requested.bundled) return { requested, effective: requested, substituted: false };
  return {
    requested,
    effective: HANDWRITING_SCRIPTS.druckschrift,
    substituted: true,
  };
}
