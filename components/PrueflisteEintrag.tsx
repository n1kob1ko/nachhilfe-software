"use client";

import { startTransition, useActionState, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { prueflisteLesenAction, prueflisteUebernehmenAction, prueflisteVerwerfenAction, type PrueflisteStand } from "@/app/pruefliste-actions";
import { PRUEFUNGSARTEN } from "@/lib/pruefungsarten";

export type PrueflisteDaten = {
  id: number;
  eingereichtAm: string;
  fotos: { id: number; materialId: number | null; pdf: boolean; fehler: string }[];
  ungelesen: number;
  /** schon automatisch als Prüfung eingetragen (lib/pruefliste.ts); „Bestätigen“ speichert die Änderungen dort */
  eingetragen: boolean;
  werte: { art: string; fach: string; datum: string; titel: string; stoff: string; notiz: string };
  vomFoto: string[];
  /** was beim Lesen auffiel und wo das Foto etwas anderes sagt als der Schüler */
  hinweise: string[];
  gelesen: boolean;
};

const FELD: Record<string, string> = { art: "Art", fach: "Fach", datum: "Datum", titel: "Bezeichnung", stoff: "Stoff" };

/**
 * Ein Eintrag der Prüfliste (lib/pruefliste.ts): die Angaben des Schülers als Formular, jedes Feld änderbar, die Fotos
 * zum Ansehen, auf Wunsch gelesen (nach dem Haken „kein Name darauf“, jedes Foto einmal). „Übernehmen“ legt die
 * Prüfung an, „Verwerfen“ nicht.
 */
export function PrueflisteEintrag({ d, faecher, weitere, kiLiest }: { d: PrueflisteDaten; faecher: string[]; weitere: string[]; kiLiest: boolean }) {
  const [lesen, lesenAction, liest] = useActionState<PrueflisteStand, FormData>(prueflisteLesenAction.bind(null, d.id), null);
  const [stand, uebernehmen, speichert] = useActionState<PrueflisteStand, FormData>(prueflisteUebernehmenAction.bind(null, d.id), null);
  const [weg, verwerfen, verwirft] = useActionState<PrueflisteStand>(() => prueflisteVerwerfenAction(d.id), null);
  const [keinName, setKeinName] = useState(false);
  const busy = liest || speichert || verwirft;
  const fehler = lesen?.fehler ?? stand?.fehler ?? weg?.fehler;
  const eigene = faecher.includes(d.werte.fach) || weitere.includes(d.werte.fach) ? faecher : [...faecher, d.werte.fach];
  // the photos are read together: one failed reading is the same sentence on every photo, shown once
  const gleich = d.fotos.length > 1 && d.fotos.every((f) => f.fehler && f.fehler === d.fotos[0].fehler);
  const fotoFehler = gleich ? [d.fotos[0].fehler] : d.fotos.map((f, i) => (f.fehler ? `${d.fotos.length > 1 ? `Foto ${i + 1}: ` : ""}${f.fehler}` : "")).filter(Boolean);

  return (
    <div className="panel grid gap-3 px-4 py-4" data-testid="pruefliste-eintrag">
      {d.eingetragen && (
        <p className="text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">Schon als Prüfung eingetragen.</span> Bitte ansehen und bestätigen, ändern oder verwerfen.
        </p>
      )}
      <p className="text-[13px] text-ink-3">
        Eingetragen am {new Date(d.eingereichtAm).toLocaleDateString("de-AT", { day: "numeric", month: "short" })}
        {d.fotos.length > 0 && ` · ${d.fotos.length === 1 ? "1 Foto" : `${d.fotos.length} Fotos`}`}
      </p>

      {d.fotos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos">
          {d.fotos.map((f, i) =>
            f.materialId ? (
              <li key={f.id}>
                <a href={`/material/${f.materialId}/datei`} target="_blank" rel="noreferrer" className="block rounded-lg border border-line hover:border-line-strong" aria-label={`Foto ${i + 1} öffnen`}>
                  {f.pdf ? (
                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-panel text-accent">
                      <FileText size={22} aria-hidden />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- the student's photo, served by the teacher-only file route
                    <img src={`/material/${f.materialId}/datei`} alt="" className="h-16 w-16 rounded-lg bg-surface object-cover object-top" />
                  )}
                </a>
              </li>
            ) : (
              <li key={f.id} className="flex h-16 w-16 items-center justify-center rounded-lg bg-panel text-center text-[11px] text-ink-3">
                gelöscht
              </li>
            ),
          )}
        </ul>
      )}

      {kiLiest && d.ungelesen > 0 && (
        <form action={lesenAction} className="grid gap-2 rounded-xl bg-panel p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
            <input type="checkbox" name="keine_namen" value="1" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="pruefliste-keine-namen" />
            <span>Auf den Fotos steht kein Name (oder er ist abgedeckt).</span>
          </label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button className="btn btn-secondary btn-sm" disabled={!keinName || busy} data-testid="pruefliste-lesen">
              <Sparkles size={15} aria-hidden /> {liest ? "KI liest …" : d.ungelesen === 1 ? "Foto lesen" : `${d.ungelesen} Fotos lesen`}
            </button>
            <span className="text-[12.5px] text-ink-3">Füllt leere Felder vor. Eine Anfrage je Foto, zählt zur KI-Grenze des Schülers.</span>
          </div>
        </form>
      )}

      {(d.gelesen || d.hinweise.length > 0 || fotoFehler.length > 0) && (
        <div className="grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber" role="status" data-testid="pruefliste-hinweise">
          {d.gelesen && <p className="font-semibold">Vom Foto gelesen. Bitte prüfen.{d.vomFoto.length > 0 && ` Vom Foto: ${d.vomFoto.map((f) => FELD[f] ?? f).join(", ")}.`}</p>}
          {[...fotoFehler, ...d.hinweise].length > 0 && (
            <ul className="grid gap-0.5">
              {[...fotoFehler, ...d.hinweise].map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* neu aufgebaut, sobald gelesen wurde: dann stehen die Werte vom Foto drin */}
      {/* onSubmit, nicht action: nach einem Fehler bleiben die Änderungen stehen */}
      <form
        key={`${d.id}-${d.gelesen ? d.vomFoto.join() + d.hinweise.length : "roh"}`}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => uebernehmen(fd));
        }}
        className="grid gap-3"
        aria-label="Eingetragene Prüfung"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="field">
            <span className="label">Art</span>
            <select className="input" name="art" defaultValue={d.werte.art}>
              {(PRUEFUNGSARTEN as readonly string[]).includes(d.werte.art) ? null : <option>{d.werte.art}</option>}
              {PRUEFUNGSARTEN.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Fach</span>
            <select className="input" name="fach" defaultValue={d.werte.fach}>
              {eigene.map((s) => (
                <option key={s}>{s}</option>
              ))}
              {weitere.length > 0 && (
                <optgroup label="Weitere Fächer">
                  {weitere.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="field col-span-2 sm:col-span-1">
            <span className="label">Datum</span>
            <input className="input" type="date" name="datum" defaultValue={d.werte.datum} required data-testid="pruefliste-datum" />
          </label>
        </div>
        {!d.werte.datum && !d.gelesen && <p className="text-[13px] text-amber">Kein Datum angegeben. Bitte eintragen.</p>}
        <label className="field">
          <span className="label">Bezeichnung</span>
          <input className="input" name="titel" defaultValue={d.werte.titel} maxLength={120} placeholder="z. B. 2. Schularbeit" autoComplete="off" />
        </label>
        <label className="field">
          <span className="label">Stoff</span>
          <input className="input" name="stoff" defaultValue={d.werte.stoff} placeholder="z. B. Brüche, Prozent, Sachaufgaben" autoComplete="off" />
        </label>
        <label className="field">
          <span className="label">Notiz</span>
          <textarea className="input min-h-[64px]" name="notiz" defaultValue={d.werte.notiz} maxLength={500} rows={2} />
        </label>
        {fehler && (
          <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[13px] text-red">
            {fehler}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} data-testid="pruefliste-uebernehmen">
            {speichert ? "Wird gespeichert …" : d.eingetragen ? "Bestätigen" : "Übernehmen"}
          </button>
          <button type="button" onClick={() => startTransition(() => verwerfen())} className="btn btn-ghost btn-sm" disabled={busy} data-testid="pruefliste-verwerfen">
            {verwirft ? "Wird verworfen …" : "Verwerfen"}
          </button>
        </div>
      </form>
    </div>
  );
}
