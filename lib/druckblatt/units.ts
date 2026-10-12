/**
 * Laengeneinheiten fuer den Druck.
 *
 * Praktisch jeder Layoutfehler im Druck entsteht dadurch, dass irgendwo
 * Millimeter und typografische Punkt addiert werden. Beide Einheiten sind
 * deshalb nominal getypt und lassen sich nicht versehentlich vermischen --
 * eine Umrechnung muss explizit hingeschrieben werden.
 */

export type Mm = number & { readonly __unit: 'mm' };
export type Pt = number & { readonly __unit: 'pt' };

export const mm = (value: number): Mm => value as Mm;
export const pt = (value: number): Pt => value as Pt;

/** 1pt = 1/72 Zoll, 1 Zoll = 25.4mm */
export const MM_PER_PT = 25.4 / 72;

export const ptToMm = (value: Pt): Mm => mm(value * MM_PER_PT);
export const mmToPt = (value: Mm): Pt => pt(value / MM_PER_PT);

/* --- Arithmetik ---------------------------------------------------------
 * Rechenoperationen liefern in TypeScript wieder `number`, das Brand geht
 * verloren. Diese Helfer halten den Typ, ohne dass ueberall gecastet wird.
 */
export const addMm = (...values: Mm[]): Mm => mm(values.reduce((sum, v) => sum + v, 0));
export const subMm = (a: Mm, b: Mm): Mm => mm(a - b);
export const scaleMm = (value: Mm, factor: number): Mm => mm(value * factor);
export const maxMm = (...values: Mm[]): Mm => mm(Math.max(...values));

/* --- Ausgabe -------------------------------------------------------------
 * Nur der Renderer ruft diese Funktionen auf. Auf drei Nachkommastellen
 * gerundet: feiner als jeder Drucker aufloest, aber ohne Float-Rauschen
 * im DOM (`70.00000000000001mm`).
 */
const round = (n: number): number => Math.round(n * 1000) / 1000;

export const cssMm = (value: Mm): string => `${round(value)}mm`;
export const cssPt = (value: Pt): string => `${round(value)}pt`;
