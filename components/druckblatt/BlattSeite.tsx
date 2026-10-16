"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrintButton } from "@/components/PrintButton";
import { ZOOM_STEP, zoomFuerBreite } from "@/lib/druckblatt/state/zoom";
import { DruckFassung } from "./DruckFassung";
import { Warnung } from "./Felder";

/**
 * Der Rahmen jeder Blattseite: Einstellungen links, Vorschau rechts, Werkzeuge
 * darüber.
 *
 * Die drei Generatoren unterscheiden sich in ihren Einstellungen und in ihrem
 * Blatt, nicht in diesem Aufbau — deshalb steht er einmal hier.
 *
 * WAS DIE SEITE ÜBERNIMMT:
 *   - Einpassen beim Öffnen und bei jedem Papierwechsel (Millimeter → Bildpunkte
 *     über `zoomFuerBreite`; danach bestimmt die Lehrkraft den Zoom).
 *   - Die Prüfung **vor dem Drucken**: `pruefen` liefert einen deutschen Satz
 *     oder `null`. Das ist die Grenze „Definition raus": Gedruckt wird nur, was
 *     das Schema annimmt.
 *   - Die beiden Fassungen desselben Blattes: sichtbar in der Vorschau,
 *     unsichtbar als Druckfassung (siehe `DruckFassung.tsx`).
 */
export function BlattSeite({
  kennzahl,
  einstellungen,
  vorschau,
  zoom,
  seiteMm,
  onZoom,
  onZuruecksetzen,
  pruefen,
  fehler,
}: {
  readonly kennzahl: ReactNode;
  readonly einstellungen: ReactNode;
  readonly vorschau: ReactNode;
  readonly zoom: number;
  /** Papierbreite in Millimetern. 0 heißt: noch nicht bekannt — dann nicht einpassen. */
  readonly seiteMm: number;
  readonly onZoom: (faktor: number) => void;
  readonly onZuruecksetzen: () => void;
  readonly pruefen: () => string | null;
  readonly fehler?: string | null;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const einpassen = () => {
    const faktor = zoomFuerBreite(behaelter.current?.clientWidth ?? 0, seiteMm);
    if (faktor !== null) onZoom(faktor);
  };

  useEffect(() => {
    const faktor = zoomFuerBreite(behaelter.current?.clientWidth ?? 0, seiteMm);
    if (faktor !== null) onZoom(faktor);
    /*
     * Nur beim Öffnen und bei einem Papierwechsel: Der Zoom ist die Entscheidung
     * der Lehrkraft, sobald sie ihn angefasst hat. Der Reducer gibt bei
     * unverändertem Wert denselben Zustand zurück, deshalb hält diese Wirkung
     * nicht in einer Schleife.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seiteMm]);

  return (
    <div className="grid gap-6 lg:grid-cols-[336px_minmax(0,1fr)] lg:items-start">
      <aside className="no-print grid gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
        {einstellungen}
      </aside>

      <section className="min-w-0">
        <div className="no-print mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="num text-[13px] text-ink-2">{kennzahl}</span>

          {/* Umbricht auf schmalen Schirmen: Zoom, Einpassen, Zurücksetzen und Drucken
              passen auf einem Telefon nicht in eine Zeile (geprüft bei 390 px). */}
          <div className="flex flex-wrap items-center gap-1 sm:ml-auto sm:justify-end">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Verkleinern"
                title="Verkleinern"
                onClick={() => onZoom(zoom - ZOOM_STEP * 2)}
              >
                −
              </button>
              <span className="num w-12 text-center text-[13px] text-ink-2">{Math.round(zoom * 100)} %</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Vergrößern"
                title="Vergrößern"
                onClick={() => onZoom(zoom + ZOOM_STEP * 2)}
              >
                +
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={einpassen}>
              Einpassen
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onZuruecksetzen}>
              Zurücksetzen
            </button>
            <PrintButton
              vorDruck={() => {
                const text = pruefen();
                setMeldung(text);
                return text === null;
              }}
            />
          </div>
        </div>

        {fehler && (
          <div className="no-print mb-3">
            <Warnung>{fehler}</Warnung>
          </div>
        )}
        {meldung && (
          <div className="no-print mb-3">
            <Warnung>{meldung}</Warnung>
          </div>
        )}

        <div ref={behaelter} className="db-preview">
          <div className="db-stack" style={{ zoom }}>
            {vorschau}
          </div>
        </div>

        {/* Dasselbe Blatt, nur an einer Stelle im DOM, an der im Ausdruck nichts stört. */}
        <DruckFassung>
          <div className="db-stack">{vorschau}</div>
        </DruckFassung>
      </section>
    </div>
  );
}

/** Das Blatt ließ sich mit diesen Maßen nicht setzen — mit dem Grund aus der Domain. */
export function BlattFehler({ text }: { readonly text: string }) {
  return (
    <div className="w-full max-w-[520px]">
      <Warnung>{text}</Warnung>
    </div>
  );
}
