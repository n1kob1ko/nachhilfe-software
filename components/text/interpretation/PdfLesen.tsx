"use client";

import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { TextFotoVorschlag } from "@/lib/textinterpretation-foto";

/** Mirrors MAX_ANALYSIS_PDF_BYTES in lib/materials.ts (kept here so the browser does not load server code). */
const MAX_PDF = 10 * 1024 * 1024;

/**
 * „Aus PDF übernehmen“ (lib/pdf-text.ts): the app reads the text stored in the PDF, without KI, line by line as printed,
 * and adds it to the text field. Nothing is saved before the teacher checks the text and saves the form; the PDF is
 * not kept. A scanned PDF has no text: then the photo reader is the way (`kiLiest`) or pasting.
 */
export function PdfLesen({ onText, kiLiest }: { onText: (v: TextFotoVorschlag) => void; kiLiest: boolean }) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<(TextFotoVorschlag & { datei: string }) | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function lies(file: File | undefined) {
    if (!file) return;
    setFehler(null);
    setErgebnis(null);
    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) {
      setFehler("Bitte eine PDF-Datei wählen.");
      return;
    }
    if (file.size > MAX_PDF) {
      setFehler(`Das PDF ist zu groß (höchstens ${MAX_PDF / 1024 / 1024} MB).`);
      return;
    }
    const fd = new FormData();
    fd.set("datei", file, file.name);
    setBusy(true);
    try {
      const res = await fetch("/material/textpdf", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { vorschlag?: TextFotoVorschlag; error?: string };
      if (res.ok && data.vorschlag?.text) {
        setErgebnis({ ...data.vorschlag, datei: file.name });
        onText(data.vorschlag);
      } else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Im PDF wurde kein Text gefunden."));
    } catch {
      setFehler("Keine Verbindung. Bitte noch einmal versuchen.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-2" data-testid="pdf-lesen">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy} data-testid="pdf-waehlen">
          <FileText size={15} aria-hidden /> {busy ? "PDF wird gelesen …" : "Aus PDF übernehmen"}
        </button>
        <span className="text-[12.5px] text-ink-3">Liest den Text aus der Datei, Zeile für Zeile wie gedruckt. Du prüfst ihn.</span>
      </div>
      {ergebnis && (
        <div className="grid gap-1 rounded-lg bg-panel px-3 py-2 text-[13px]" role="status" data-testid="pdf-ergebnis">
          <p className="font-semibold">
            {ergebnis.zeilen} Zeilen aus „{ergebnis.datei}“ übernommen. Bitte mit dem Blatt vergleichen, bevor du speicherst.
          </p>
          {ergebnis.titel && <p className="text-ink-2">Überschrift erkannt: „{ergebnis.titel}“</p>}
          {ergebnis.hinweise.length > 0 && (
            <ul className="grid gap-0.5 text-ink-2">
              {ergebnis.hinweise.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {fehler && (
        <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[13px] text-red" data-testid="pdf-fehler">
          {fehler}
          {kiLiest && " Ein eingescanntes Blatt liest „Vom Foto lesen“."}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void lies(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
        data-testid="pdf-datei"
      />
    </div>
  );
}
