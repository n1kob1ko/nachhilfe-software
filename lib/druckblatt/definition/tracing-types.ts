import type { Mm } from '../units';
import type { TraceRowConfig, TraceUnit } from '../content/tracing';
import type { LineaturId } from '../rendering/lineatur';
import type { ScriptId } from '../rendering/handwriting-scripts';
import type { PageConfig, TypographyConfig } from './types';

/**
 * Das Nachmalblatt als reine Beschreibung.
 *
 * Dritter Blatttyp neben Lesetabelle und Satzbaukasten (siehe ADR 0008 zur
 * Begruendung, warum jeder Typ seine eigene Definition bekommt). Geteilt wird
 * wieder nur, was zum PAPIER gehoert: Seitenformat, Raender, Typografie des
 * Kopfbereichs.
 *
 * DER UNTERSCHIED ZU DEN ANDEREN BEIDEN: Hier haengt die Schriftgroesse an
 * der Lineatur, nicht umgekehrt. Ein Kleinbuchstabe muss ins Mittelband
 * passen, sonst malt das Kind Formen nach, die nicht zu den Linien gehoeren.
 */

export interface TracingRowsConfig extends TraceRowConfig {
  /**
   * Leere Uebungszeilen nach jeder Vorlagenzeile.
   *
   * Nach dem Nachfahren soll das Kind dasselbe frei schreiben. Ohne diese
   * Zeilen endet die Uebung beim Nachfahren -- und genau das ist nicht das
   * Ziel.
   */
  readonly freeRows: number;
}

export interface TracingLinesConfig {
  readonly lineatur: LineaturId;
  /** Luft zwischen den Zeilen. `null` nimmt die Vorgabe der Lineatur. */
  readonly spacing: Mm | null;
}

export interface TracingDefinition {
  readonly title: string;
  readonly showTitle: boolean;
  readonly instruction: string;
  readonly showPageNumbers: boolean;
  readonly page: PageConfig;
  /** Nur fuer Titel und Arbeitsauftrag -- die Uebungszeichen richten sich
   *  nach der Lineatur. */
  readonly typography: TypographyConfig;

  readonly script: ScriptId;
  /**
   * Feinjustierung der Schriftgroesse, 1 = genau ins Mittelband.
   *
   * Die Berechnung aus der x-Hoehe ist eine Naeherung; je nach Schrift sitzt
   * das Ergebnis einen Hauch zu hoch oder zu tief. Statt die Naeherung zu
   * verstecken, laesst sie sich hier korrigieren.
   */
  readonly sizeAdjust: number;

  readonly unit: TraceUnit;
  /** Rohtext der Lehrkraft. Wird nach `unit` in Uebungselemente zerlegt. */
  readonly content: string;
  readonly rows: TracingRowsConfig;
  readonly lines: TracingLinesConfig;
}
