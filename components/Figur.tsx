import { figurSvg } from "@/lib/figur";

/**
 * Das Bild einer Aufgabe mit Bild (Zahlenstrahl, Koordinatensystem, Figur), überall mit demselben Zeichner
 * (lib/figur.ts): am Schülergerät, in der Vorschau, im Editor, am A4-Blatt und in der Mappe.
 *
 * Entweder `figure` (die gespeicherten Angaben, nur für die Lehrkraft; `loesung` zeigt die gesuchten Werte) oder
 * `svg` (das fertige Bild ohne Lösung, wie es die Schülerseite vom Server bekommt). Das SVG baut der Zeichner
 * selbst aus geprüften Zahlen und maskierten Texten, darum darf es direkt eingesetzt werden.
 *
 * Größe: `groesser` vergrößert am Bildschirm (Schülergerät mit großer Schrift); `mm` legt für den Druck fest, wie
 * viele Millimeter eine Einheit der Zeichnung sind, damit die Schrift in allen Bildern gleich groß gedruckt wird.
 * Schmal wird das Bild immer auf die verfügbare Breite verkleinert, nie seitlich verschoben.
 */
export function FigurBild({
  figure,
  svg,
  loesung = false,
  groesser = 1,
  mm,
  className = "",
}: {
  figure?: unknown;
  svg?: string | null;
  loesung?: boolean;
  groesser?: number;
  mm?: number;
  className?: string;
}) {
  const html = svg ?? (figure ? figurSvg(figure, { loesung }) : null);
  if (!html) return null;
  const breite = Number(html.match(/\swidth="([\d.]+)"/)?.[1] ?? 0);
  const style = breite ? { width: mm ? `${(breite * mm).toFixed(1)}mm` : `${Math.round(breite * groesser)}px` } : undefined;
  return <div className={`figur ${className}`} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Wo die Frage einer Aufgabe mit Bild und Lücken endet: die erste Zeile, wenn darin keine Lücke steht und danach
 * noch etwas kommt („Lies die Koordinaten ab.“ / Bild / „A( ___ | ___ )“). Sonst null: das Bild kommt nach dem Text.
 */
export function figurKopf(prompt: string, gap = "___"): string | null {
  if (!prompt.includes(gap)) return null;
  const i = prompt.indexOf("\n");
  if (i <= 0) return null;
  const kopf = prompt.slice(0, i);
  return kopf.includes(gap) ? null : kopf;
}
