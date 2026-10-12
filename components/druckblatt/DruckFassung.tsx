"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Die Druckfassung: dasselbe Markup wie in der Vorschau, aber als direktes Kind
 * von `<body>`.
 *
 * WARUM NICHT EINFACH DIE VORSCHAU DRUCKEN: Das Blatt liegt in der App drin — in
 * `main` mit Polsterung, in einem Raster mit einer 220px-Spalte für die
 * Seitenleiste. Beides schiebt ein 210mm breites Blatt im Ausdruck über den
 * Seitenrand: aus einer Seite würden zwei, aus dem Satzspiegel ein verschobenes
 * Bild. Die Alternative wäre eine Reihe von `!important`-Überschreibungen gegen
 * die Rahmenklassen der App — die bricht, sobald jemand am Rahmen etwas ändert.
 *
 * Die Vorschau wird also zweimal gerendert: einmal sichtbar im Fluss, einmal
 * unsichtbar als Druckfassung. Beide entstehen aus demselben Layoutmodell mit
 * denselben Komponenten, sind also dasselbe Blatt — was man sieht, ist was
 * gedruckt wird.
 *
 * Vor der Hydration gibt es die Druckfassung noch nicht; der Ausdruck zeigt dann
 * die Seite selbst, statt ein leeres Blatt zu erzeugen.
 */
export function DruckFassung({ children }: { readonly children: ReactNode }) {
  const [ziel, setZiel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setZiel(document.body);
  }, []);

  if (ziel === null) return null;
  return createPortal(<div className="db-druck">{children}</div>, ziel);
}
