import { mm, pt } from '../units';
import { clamp } from './constraints';
import type { Orientation, PageConfig, PageSizeId, TypographyConfig } from './types';

/**
 * Nutzereingaben auf gueltige Werte bringen -- fuer JEDEN Blatttyp.
 *
 * WARUM IN DER DOMAIN UND NICHT IM STORE: Seitenformat, Raender und Typografie
 * sind Eigenschaften des PAPIERS, nicht eines bestimmten Generators. Solange
 * das nur die Lesetabelle brauchte, lag es in deren Store; mit dem zweiten
 * Blatttyp waeren daraus zwei Kopien derselben Klemmlogik geworden -- oder ein
 * Import quer zwischen zwei Features, was die Abhaengigkeitsregeln verbieten
 * (docs/architecture.md).
 *
 * DIE EINHEITENGRENZE LIEGT HIER: Aus einem `<input type="number">` kommt eine
 * nackte Zahl. Diese Funktionen begrenzen sie und versehen sie mit ihrer
 * Einheit (`Mm`, `Pt`). Deshalb steht in keiner Komponente ein Cast.
 */

export interface MarginsInput {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

export interface PageInput {
  readonly size?: PageSizeId;
  readonly orientation?: Orientation;
  readonly margins?: MarginsInput;
}

export interface TypographyInput {
  /** Punkt. */
  readonly fontSize?: number;
  readonly lineHeight?: number;
  /** Punkt. */
  readonly letterSpacing?: number;
  readonly bold?: boolean;
}

export function sanitizePage(current: PageConfig, patch: PageInput = {}): PageConfig {
  return {
    size: patch.size ?? current.size,
    orientation: patch.orientation ?? current.orientation,
    margins: {
      top: mm(clamp(patch.margins?.top ?? current.margins.top, 'margin')),
      right: mm(clamp(patch.margins?.right ?? current.margins.right, 'margin')),
      bottom: mm(clamp(patch.margins?.bottom ?? current.margins.bottom, 'margin')),
      left: mm(clamp(patch.margins?.left ?? current.margins.left, 'margin')),
    },
  };
}

export function sanitizeTypography(
  current: TypographyConfig,
  patch: TypographyInput = {},
): TypographyConfig {
  return {
    fontSize: pt(clamp(patch.fontSize ?? current.fontSize, 'fontSize')),
    lineHeight: clamp(patch.lineHeight ?? current.lineHeight, 'lineHeight'),
    letterSpacing: pt(clamp(patch.letterSpacing ?? current.letterSpacing, 'letterSpacing')),
    bold: patch.bold ?? current.bold,
  };
}

/** Alle vier Raender auf denselben Wert -- der haeufigste Handgriff. */
export function withUniformMargins(current: PageConfig, millimeters: number): PageConfig {
  return sanitizePage(current, {
    margins: { top: millimeters, right: millimeters, bottom: millimeters, left: millimeters },
  });
}
