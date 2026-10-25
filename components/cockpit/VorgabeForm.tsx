"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";

/** Mirrors lib/pruefungsstoff.ts and lib/vorgabe.ts (kept here so the browser does not load server code). */
const MAX_DATEIEN = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const TEXT_MAX = 1500;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Datei = { key: string; file: File; url: string | null };

/**
 * Das Formular von „Was steht heute an?“ (lib/vorgabe.ts): ein Text, Fotos oder PDFs, eine Prüfung. Sendet an
 * app/material/vorgabe und lädt die Seite neu; der Unterricht richtet sich danach, solange noch nichts getan ist.
 * `kiLiest`: ob Fotos gelesen werden können (sonst werden sie nur angehängt, der Text wird ohne KI zerlegt).
 */
export function VorgabeForm({ unitId, tests, text: anfang = "", kiLiest, abbrechen }: { unitId: number; tests: { id: number; label: string }[]; text?: string; kiLiest: boolean; abbrechen?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(anfang);
  const [dateien, setDateien] = useState<Datei[]>([]);
  const [pruefung, setPruefung] = useState("");
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function waehle(files: File[]) {
    setFehler(null);
    const platz = MAX_DATEIEN - dateien.length;
    if (files.length > platz) setFehler(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs zusammen.`);
    const neu: Datei[] = [];
    for (const file of files.slice(0, Math.max(0, platz))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte Fotos oder PDFs wählen.");
        continue;
      }
      const small = pdf ? file : await shrinkImage(file);
      if (!pdf && !TYPES.includes(small.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
        continue;
      }
      if (small.size > MAX_BYTES) {
        setFehler(`Eine Datei ist zu groß (höchstens ${MAX_BYTES / 1024 / 1024} MB).`);
        continue;
      }
      neu.push({ key: `${Date.now()}-${neu.length}-${small.name}`, file: small, url: pdf ? null : URL.createObjectURL(small) });
    }
    setDateien((d) => [...d, ...neu]);
  }

  function ohne(key: string) {
    const d = dateien.find((x) => x.key === key);
    if (d?.url) URL.revokeObjectURL(d.url);
    setDateien(dateien.filter((x) => x.key !== key));
  }

  async function senden() {
    if (busy) return;
    if (!text.trim() && !dateien.length && !pruefung) {
      setFehler("Bitte kurz schreiben, was heute dran ist, Fotos wählen oder eine Prüfung auswählen.");
      return;
    }
    setFehler(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("einheit", String(unitId));
    fd.set("text", text);
    if (pruefung) fd.set("pruefung", pruefung);
    fd.set("keine_namen", keinName ? "1" : "0");
    for (const d of dateien) fd.append("datei", d.file, d.file.name);
    try {
      const res = await fetch("/material/vorgabe", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
        setBusy(false);
        return;
      }
      for (const d of dateien) if (d.url) URL.revokeObjectURL(d.url);
      setDateien([]);
      setBusy(false);
      router.refresh();
    } catch {
      setFehler("Keine Verbindung. Bitte noch einmal versuchen.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3" data-testid="vorgabe-form">
      <label className="grid gap-1.5">
        <span className="text-[14px] font-medium">Was ist heute dran?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEXT_MAX}
          rows={3}
          placeholder="z. B. Heute Present Simple und Signal Words. Er tut sich schwer mit Fragen. Nächste Woche Test."
          className="input min-h-[88px] resize-y"
          data-testid="vorgabe-text"
        />
      </label>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy || dateien.length >= MAX_DATEIEN}>
            <Camera size={15} aria-hidden /> {dateien.length ? "Weiteres Blatt" : "Foto oder PDF"}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Fotos oder PDFs für heute"
            onChange={(e) => {
              void waehle(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
            data-testid="vorgabe-datei"
          />
          {tests.length > 0 && (
            <select value={pruefung} onChange={(e) => setPruefung(e.target.value)} className="input min-h-[44px] w-auto max-w-full text-[14px]" aria-label="Prüfung" data-testid="vorgabe-pruefung">
              <option value="">Keine Prüfung gewählt</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {dateien.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {dateien.map((d) => (
              <li key={d.key} className="relative">
                {d.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt={d.file.name} className="h-16 w-16 rounded-lg border border-line object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-panel text-ink-2">
                    <FileText size={20} aria-hidden />
                  </span>
                )}
                <button type="button" onClick={() => ohne(d.key)} className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink-2 shadow-[var(--shadow-card)]" aria-label={`${d.file.name} entfernen`}>
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {dateien.length > 0 && kiLiest && (
          <label className="flex min-h-[44px] items-start gap-2 text-[13.5px]">
            <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="vorgabe-keine-namen" />
            <span>Auf den Blättern steht kein Name (oder er ist abgedeckt). Sonst werden sie nur angehängt.</span>
          </label>
        )}
        {dateien.length > 0 && !kiLiest && <p className="text-[12.5px] text-ink-3">Die Blätter werden angehängt.</p>}
      </div>
      {fehler && (
        <p role="alert" className="text-[13.5px] text-red">
          {fehler}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void senden()} disabled={busy} data-testid="vorgabe-speichern">
          {busy ? "Wird gelesen …" : "Übernehmen"}
        </button>
        {abbrechen && <span className="text-[12.5px] text-ink-3">Ersetzt die bisherige Vorgabe.</span>}
      </div>
    </div>
  );
}
