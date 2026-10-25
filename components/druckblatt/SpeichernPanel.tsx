"use client";

import Link from "next/link";
import { useState } from "react";
import { loescheDruckblattAction, speichereDruckblattAction } from "@/app/druckblatt-actions";
import type { Blattart } from "@/lib/druckblatt/definition/schemas";
import { Panel } from "./Felder";

/**
 * Speichern und Zuweisen eines Druckblatts (D21, Phase 5, Schritt 5).
 *
 * ZWEI KNÖPFE, EINE FORM:
 *   - **Als Vorlage speichern** — kein Schüler, für alle wiederverwendbar.
 *   - **Einem Schüler zuweisen** — eine **Kopie** mit `student_id`; die Vorlage
 *     bleibt bestehen. Wer ein Blatt für ein Kind anpasst, will das Blatt nicht
 *     auch noch dem Kind wegnehmen.
 *
 * Die Definition geht als JSON mit; geprüft und gespeichert wird sie auf dem
 * Server (`app/druckblatt-actions.ts` → `lib/materials.ts`), nie hier im
 * Browser. Ein zweiter Weg zur Ablage entsteht damit nicht: Ein Druckblatt ist
 * eine Zeile in `materials`, dieselbe Liste wie Fotos und PDFs.
 */
export function SpeichernPanel({
  blattart,
  definition,
  titel,
  studenten,
  gespeichertId,
  gespeichertFuer,
  meldung,
  fehler,
}: {
  readonly blattart: Blattart;
  /** Die vollständige Definition aus dem Reducer; wird als JSON mitgeschickt. */
  readonly definition: unknown;
  readonly titel: string;
  readonly studenten: readonly { id: number; name: string }[];
  /** Das Blatt, das gerade geöffnet ist (`?blatt=`), oder null. */
  readonly gespeichertId: number | null;
  readonly gespeichertFuer: string | null;
  readonly meldung: string | null;
  readonly fehler: string | null;
}) {
  const [schueler, setSchueler] = useState("");

  return (
    <Panel
      titel="Speichern"
      hinweis="Ein gespeichertes Blatt bleibt bearbeitbar: Es wird seine Beschreibung gespeichert, nicht ein Ausdruck."
    >
      {meldung && (
        <p className="text-[13px] font-semibold text-green" role="status">
          {meldung}
        </p>
      )}
      {fehler && (
        <p className="text-[13px] text-red" role="alert">
          {fehler}
        </p>
      )}
      {gespeichertId !== null && (
        <p className="text-[13px] text-ink-2">
          Geöffnet: <b>{titel || "Druckblatt"}</b>
          {gespeichertFuer ? ` · für ${gespeichertFuer}` : " · Vorlage"}
        </p>
      )}

      <form action={speichereDruckblattAction} className="grid gap-3">
        <input type="hidden" name="blattart" value={blattart} />
        <input type="hidden" name="definition" value={JSON.stringify(definition)} />

        <label className="field">
          <span className="label">Titel zum Wiederfinden</span>
          <input className="input" type="text" name="title" defaultValue={titel} maxLength={120} />
        </label>

        <label className="field">
          <span className="label">Schüler (für „Einem Schüler zuweisen“)</span>
          <select className="input" name="student_id" value={schueler} onChange={(e) => setSchueler(e.currentTarget.value)}>
            <option value="">– kein Schüler –</option>
            {studenten.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-secondary btn-sm" name="modus" value="vorlage" type="submit">
            Als Vorlage speichern
          </button>
          <button
            className="btn btn-primary btn-sm"
            name="modus"
            value="zuweisen"
            type="submit"
            disabled={schueler === ""}
            title={schueler === "" ? "Zuerst einen Schüler auswählen." : undefined}
          >
            Einem Schüler zuweisen
          </button>
        </div>
        <p className="text-[12px] text-ink-3">
          Zuweisen legt eine Kopie für das Kind an; die Vorlage bleibt erhalten. Alles Gespeicherte steht
          auch unter{" "}
          <Link href="/mehr/material" className="link">
            Erweitert › Material
          </Link>
          .
        </p>
      </form>

      {gespeichertId !== null && (
        <form action={loescheDruckblattAction.bind(null, gespeichertId)}>
          <button className="btn btn-ghost btn-sm text-red" type="submit">
            Dieses gespeicherte Blatt löschen
          </button>
        </form>
      )}
    </Panel>
  );
}
