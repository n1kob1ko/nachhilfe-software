"use client";

import { useState, type Dispatch } from "react";
import { vorschlagSpaltenAction, vorschlagWoerterAction } from "@/app/druckblatt-actions";
import type { SentenceBoxDefinition } from "@/lib/druckblatt/definition/sentence-box-types";
import type { WorksheetDefinition } from "@/lib/druckblatt/definition/types";
import type { LesetabelleAktion } from "@/lib/druckblatt/state/worksheet-state";
import type { SatzbaukastenAktion } from "@/lib/druckblatt/state/sentence-state";
import { Panel, Warnung, Zahlenfeld } from "./Felder";

/**
 * Vorschläge von der KI — Wortlisten für die Lesetabelle, Einträge für den
 * Satzbaukasten (Phase 5, Schritt 6).
 *
 * WAS HIER BEWUSST NICHT PASSIERT: Der Vorschlag wird **nicht** von selbst
 * übernommen. Er erscheint zur Ansicht, die Lehrkraft entscheidet. Ein Modell,
 * das unbemerkt Wörter auf ein Blatt schreibt, wäre im Nachhilfebetrieb ein
 * Haftungsrisiko.
 *
 * Geprüft wird auf dem Server: Die Antwort der KI wird dort in die Definition
 * eingesetzt und gegen das Blattschema geprüft (`pruefeLesetabelle` /
 * `pruefeSatzbaukasten`). Nur was durchkommt, steht hier zur Übernahme bereit;
 * ein ungültiger Vorschlag kommt als deutsche Meldung zurück und wird nie
 * angezeigt. Übernommen wird über die Aktion `laden` — dieselbe Grenze, über
 * die auch ein gespeichertes Blatt hereinkommt.
 *
 * OHNE KI: Ohne Schlüssel oder Budget bleibt der Vorschlag aus und das steht
 * hier; das Blatt lässt sich unverändert von Hand einstellen.
 */

/** Der gemeinsame Rahmen: Erklären, Eingabe, Vorschlag, Übernehmen. */
function VorschlagPanel({
  titel,
  hinweis,
  kiVerfuegbar,
  fehler,
  laeuft,
  onVorschlagen,
  eingabe,
  vorschau,
  zeilen,
  onUebernehmen,
  onVerwerfen,
}: {
  readonly titel: string;
  readonly hinweis: string;
  readonly kiVerfuegbar: boolean;
  readonly fehler: string | null;
  readonly laeuft: boolean;
  readonly onVorschlagen: () => void;
  readonly eingabe: React.ReactNode;
  readonly vorschau: React.ReactNode;
  readonly zeilen: readonly string[];
  readonly onUebernehmen: () => void;
  readonly onVerwerfen: () => void;
}) {
  return (
    <Panel titel={titel} hinweis={hinweis}>
      {!kiVerfuegbar ? (
        <p className="text-[13px] text-ink-2">
          Es ist kein KI-Schlüssel hinterlegt. Die Einträge gibst du von Hand ein — das Blatt ist
          davon unabhängig vollständig nutzbar.
        </p>
      ) : (
        <>
          {eingabe}
          <div>
            <button type="button" className="btn btn-secondary" disabled={laeuft} onClick={onVorschlagen}>
              {laeuft ? "Die KI arbeitet …" : "Vorschlagen"}
            </button>
          </div>
        </>
      )}

      {fehler && <Warnung>{fehler}</Warnung>}

      {zeilen.length > 0 && (
        <>
          {vorschau}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={onUebernehmen}>
              In das Blatt übernehmen
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onVerwerfen}>
              Verwerfen
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Wortliste für die Lesetabelle. */
export function WoerterVorschlagPanel({
  definition,
  dispatch,
  kiVerfuegbar,
}: {
  readonly definition: WorksheetDefinition;
  readonly dispatch: Dispatch<LesetabelleAktion>;
  readonly kiVerfuegbar: boolean;
}) {
  const [anzahl, setAnzahl] = useState(16);
  const [thema, setThema] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<{ woerter: string[]; definition: WorksheetDefinition } | null>(null);

  const hole = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const ergebnis = await vorschlagWoerterAction(definition, { anzahl, thema });
      if (ergebnis.ok) setVorschlag({ woerter: ergebnis.woerter, definition: ergebnis.definition });
      else {
        setVorschlag(null);
        setFehler(ergebnis.fehler);
      }
    } catch {
      setVorschlag(null);
      setFehler("Der Vorschlag ist fehlgeschlagen — bitte die Wörter von Hand eingeben.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <VorschlagPanel
      titel="Vorschlag (KI)"
      hinweis="Nur ein Vorschlag: erst ansehen, dann übernehmen."
      kiVerfuegbar={kiVerfuegbar}
      fehler={fehler}
      laeuft={laeuft}
      onVorschlagen={() => void hole()}
      eingabe={
        <>
          <Zahlenfeld label="Wie viele Wörter" wert={anzahl} bereich={{ min: 4, max: 60, step: 2 }} onWert={setAnzahl} />
          <label className="field">
            <span className="label">Thema oder Schwerpunkt (optional)</span>
            <input
              className="input"
              type="text"
              value={thema}
              placeholder="z. B. Tiere, Wörter mit ie"
              onChange={(ereignis) => setThema(ereignis.currentTarget.value)}
            />
          </label>
        </>
      }
      vorschau={
        <p className="max-h-40 overflow-auto rounded-xl bg-panel px-3 py-2 text-[14px]">
          {vorschlag?.woerter.join(" · ")}
        </p>
      }
      zeilen={vorschlag?.woerter ?? []}
      onUebernehmen={() => {
        if (vorschlag) dispatch({ art: "laden", definition: vorschlag.definition });
        setVorschlag(null);
      }}
      onVerwerfen={() => setVorschlag(null)}
    />
  );
}

/** Einträge für die Spalten des Satzbaukastens. */
export function SpaltenVorschlagPanel({
  definition,
  dispatch,
  kiVerfuegbar,
}: {
  readonly definition: SentenceBoxDefinition;
  readonly dispatch: Dispatch<SatzbaukastenAktion>;
  readonly kiVerfuegbar: boolean;
}) {
  const [verben, setVerben] = useState(3);
  const [objekte, setObjekte] = useState(6);
  const [thema, setThema] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<{ eingetragen: number; definition: SentenceBoxDefinition } | null>(null);

  const hole = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const ergebnis = await vorschlagSpaltenAction(definition, { verben, objekte, thema });
      if (ergebnis.ok) setVorschlag({ eingetragen: ergebnis.eingetragen, definition: ergebnis.definition });
      else {
        setVorschlag(null);
        setFehler(ergebnis.fehler);
      }
    } catch {
      setVorschlag(null);
      setFehler("Der Vorschlag ist fehlgeschlagen — bitte die Einträge von Hand eingeben.");
    } finally {
      setLaeuft(false);
    }
  };

  const vorschau = (vorschlag?.definition.columns ?? []).filter((spalte) => spalte.entries.length > 0);

  return (
    <VorschlagPanel
      titel="Vorschlag (KI)"
      hinweis="Nur ein Vorschlag: erst ansehen, dann übernehmen. Die Einträge gehen in die vorhandenen Spalten, eine gelöschte Spalte kommt nicht zurück."
      kiVerfuegbar={kiVerfuegbar}
      fehler={fehler}
      laeuft={laeuft}
      onVorschlagen={() => void hole()}
      eingabe={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Zahlenfeld label="Verben" wert={verben} bereich={{ min: 1, max: 12, step: 1 }} onWert={setVerben} />
            <Zahlenfeld label="Objekte" wert={objekte} bereich={{ min: 1, max: 20, step: 1 }} onWert={setObjekte} />
          </div>
          <label className="field">
            <span className="label">Thema oder Schwerpunkt (optional)</span>
            <input
              className="input"
              type="text"
              value={thema}
              placeholder="z. B. Tiere, Wald"
              onChange={(ereignis) => setThema(ereignis.currentTarget.value)}
            />
          </label>
        </>
      }
      vorschau={
        <div className="grid gap-1.5">
          {vorschau.map((spalte) => (
            <p key={spalte.id} className="text-[13.5px]">
              <span className="text-ink-3">{spalte.heading || spalte.role}: </span>
              {spalte.entries.join(" · ")}
            </p>
          ))}
        </div>
      }
      zeilen={vorschlag ? vorschau.flatMap((spalte) => spalte.entries) : []}
      onUebernehmen={() => {
        if (vorschlag) dispatch({ art: "laden", definition: vorschlag.definition });
        setVorschlag(null);
      }}
      onVerwerfen={() => setVorschlag(null)}
    />
  );
}
