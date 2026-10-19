"use client";

/**
 * Der CSV-Import in zwei Schritten (Phase 7): Datei wählen → **Vorschau** mit den Fehlern jeder
 * Zeile und den Dubletten → **Bestätigen**, erst dann wird geschrieben. Die Datei bleibt im Zustand
 * des Formulars, damit die Bestätigung dieselbe Datei noch einmal schickt; geprüft wird sie auf dem
 * Server zweimal (`app/import-actions.ts`, `lib/csv-import.ts`).
 */
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Eye, FileUp, Upload, UserPlus } from "lucide-react";
import { confirmImportAction, previewImportAction } from "@/app/import-actions";
import type { ImportArt, ImportErgebnis, ImportVorschau } from "@/lib/csv-import";

const DUBLETTE: Record<string, string> = { datei: "doppelt in der Datei", datenbank: "gibt es schon" };
/** Was eine gültige Zeile wird: ein Schüler, ein Lehrer oder eine dokumentierte Einheit. */
const WIRD: Record<ImportArt, [string, string]> = { schueler: ["Schüler", "Schüler"], lehrer: ["Lehrer", "Lehrer"], dokumentation: ["Einheit", "Einheiten"] };

export function ImportForm({ art, label, hinweis, beispiel }: { art: ImportArt; label: string; hinweis: string; beispiel: string }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null);
  const [runde, setRunde] = useState(0);
  const [laeuft, start] = useTransition();

  const formular = () => {
    const fd = new FormData();
    if (datei) fd.set("datei", datei);
    fd.set("art", art);
    return fd;
  };

  const pruefen = () =>
    start(async () => {
      setErgebnis(null);
      setVorschau(await previewImportAction(formular()));
    });

  const schreiben = () =>
    start(async () => {
      const r = await confirmImportAction(formular());
      setErgebnis(r);
      if (r.ok) {
        setVorschau(null);
        setDatei(null);
        setRunde((n) => n + 1); // leeres Dateifeld nach dem Import
      } else if (r.vorschau) setVorschau(r.vorschau);
    });

  const bereit = Boolean(vorschau) && !vorschau!.fehler && vorschau!.fehlerhaft === 0 && vorschau!.gueltig > 0;

  return (
    <div className="panel grid gap-4 px-4 py-4 md:px-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="field">
          <span className="label">{label}-CSV</span>
          <input
            key={runde}
            className="input py-2"
            type="file"
            name="datei"
            accept=".csv,text/csv"
            onChange={(e) => {
              setDatei(e.currentTarget.files?.[0] ?? null);
              setVorschau(null);
              setErgebnis(null);
            }}
          />
          <span className="text-[12.5px] text-ink-3">{hinweis} · Semikolon oder Komma, UTF-8, höchstens 1 MB. Beispiel: {beispiel}</span>
        </label>
        <button type="button" className="btn btn-secondary" onClick={pruefen} disabled={!datei || laeuft}>
          <Eye size={16} aria-hidden /> Vorschau
        </button>
      </div>

      {ergebnis && !ergebnis.ok && (
        <p className="rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {ergebnis.fehler}
        </p>
      )}
      {ergebnis?.ok && (
        <p className="flex items-start gap-2 rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> {ergebnis.hinweis}
        </p>
      )}

      {vorschau && (
        <div className="grid gap-3">
          {vorschau.fehler ? (
            <p className="flex items-start gap-2 rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {vorschau.fehler}
            </p>
          ) : (
            <>
              <p className="text-[14px] text-ink-2" role="status">
                <span className="font-semibold text-ink">{vorschau.gesamt}</span> {vorschau.gesamt === 1 ? "Zeile" : "Zeilen"} gelesen ·{" "}
                <span className="font-semibold text-green">{vorschau.gueltig}</span> {WIRD[art][vorschau.gueltig === 1 ? 0 : 1]} {vorschau.gueltig === 1 ? "wird" : "werden"} angelegt
                {art !== "dokumentation" && vorschau.stufeOffen > 0 && (
                  <>
                    {" "}
                    · davon <span className="font-semibold text-amber">{vorschau.stufeOffen}</span> ohne Klasse
                  </>
                )}
                {vorschau.dubletten > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-amber">{vorschau.dubletten}</span> übersprungen
                  </>
                )}
                {vorschau.fehlerhaft > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-red">{vorschau.fehlerhaft}</span> mit Fehlern
                  </>
                )}
              </p>
              <p className="text-[12.5px] text-ink-3">Erkannte Spalten: {vorschau.spalten.join(", ") || "keine"}</p>

              {vorschau.neueSchueler && vorschau.neueSchueler.length > 0 && (
                <div className="rounded-2xl bg-amber-wash px-4 py-3 text-[13.5px]">
                  <p className="flex items-start gap-2 font-semibold">
                    <UserPlus size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden />
                    {vorschau.neueSchueler.length} {vorschau.neueSchueler.length === 1 ? "Schüler ist" : "Schüler sind"} noch nicht in der App und{" "}
                    {vorschau.neueSchueler.length === 1 ? "wird" : "werden"} ohne Klasse angelegt:
                  </p>
                  <ul className="mt-1.5 grid gap-1 pl-6">
                    {vorschau.neueSchueler.map((n) => (
                      <li key={n.name}>
                        <span className="font-medium">{n.name}</span> <span className="text-ink-3">· {n.einheiten} {n.einheiten === 1 ? "Einheit" : "Einheiten"}</span>
                        {n.aehnlich.length > 0 && (
                          <span className="block text-amber">
                            In der App gibt es „{n.aehnlich.join("“, „")}“. Ist das dasselbe Kind, den Namen in der Tabelle gleich schreiben und neu prüfen.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 pl-6 text-ink-2">Schulart und Klasse trägst du danach im Profil nach. Die Schülerliste zeigt sie unter „Klasse fehlt“.</p>
                </div>
              )}

              {vorschau.fehlerhaft > 0 && <p className="text-[13.5px] text-red">Solange eine Zeile einen Fehler hat, wird nichts geschrieben. Bitte die Datei ausbessern und neu prüfen.</p>}

              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-paper">
                {vorschau.zeilen.map((z) => (
                  <li key={z.zeile} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[13.5px]">
                    <span className="num w-8 shrink-0 text-ink-3">{z.zeile}</span>
                    <span className={`min-w-0 flex-1 font-medium ${z.fehler.length ? "text-red" : ""}`}>{z.beschriftung}</span>
                    {z.dublette && <span className="rounded-full bg-amber-wash px-2 py-0.5 text-[12px] text-amber">{DUBLETTE[z.dublette]}</span>}
                    {z.hinweis && !z.dublette && !z.fehler.length && <span className="rounded-full bg-amber-wash px-2 py-0.5 text-[12px] text-amber">{z.hinweis}</span>}
                    {z.fehler.length > 0 && <span className="w-full pl-11 text-[12.5px] text-red">{z.fehler.join(" · ")}</span>}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary" onClick={schreiben} disabled={!bereit || laeuft}>
                  <Upload size={16} aria-hidden /> {laeuft ? "Import läuft …" : `${vorschau.gueltig} jetzt importieren`}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setVorschau(null)} disabled={laeuft}>
                  Verwerfen
                </button>
                <span className="text-[12.5px] text-ink-3">Bis hierher wurde nichts geschrieben.</span>
              </div>
            </>
          )}
        </div>
      )}

      {!datei && !vorschau && (
        <p className="flex items-center gap-2 text-[13px] text-ink-3">
          <FileUp size={15} aria-hidden /> Datei wählen und „Vorschau“ antippen — geprüft wird, bevor etwas geschrieben wird.
        </p>
      )}
    </div>
  );
}
