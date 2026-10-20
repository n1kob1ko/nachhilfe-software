"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Sparkles, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";
import type { TextFotoVorschlag } from "@/lib/textinterpretation-foto";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** A page of small print needs more pixels than a Stoffzettel. */
const MAX_SIDE = 2400;

type Seite = { file: File; url: string | null };

/**
 * Text vom Foto (lib/textinterpretation-foto.ts): the teacher photographs the printed page and, after the tick that
 * no name and nothing handwritten is on it, the KI writes the text down. `onText` adds it to the story field; nothing
 * is saved before the teacher saves the form. A story over two pages is read page by page.
 */
export function TextFotoLesen({ studentId, onText }: { studentId?: number; onText: (v: TextFotoVorschlag) => void }) {
  const [seite, setSeite] = useState<Seite | null>(null);
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState<null | "vorbereiten" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<TextFotoVorschlag | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => (seite?.url ? URL.revokeObjectURL(seite.url) : undefined), [seite]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const begin = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - begin) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  function weg() {
    setSeite(null);
    setKeinName(false);
    setFehler(null);
    setErgebnis(null);
  }

  async function waehle(file: File | undefined) {
    if (!file) return;
    weg();
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!pdf && !file.type.startsWith("image/")) {
      setFehler("Bitte ein Foto oder ein PDF wählen.");
      return;
    }
    setBusy("vorbereiten");
    const small = pdf ? file : await shrinkImage(file, MAX_SIDE);
    setBusy(null);
    if (!pdf && !TYPES.includes(small.type)) {
      setFehler("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
      return;
    }
    const max = pdf ? MAX_PDF : MAX_IMAGE;
    if (small.size > max) {
      setFehler(`${pdf ? "Das PDF" : "Das Foto"} ist zu groß (höchstens ${max / 1024 / 1024} MB).`);
      return;
    }
    setSeite({ file: small, url: pdf ? null : URL.createObjectURL(small) });
  }

  async function lesen() {
    if (!seite || busy) return;
    setFehler(null);
    const fd = new FormData();
    fd.set("datei", seite.file, seite.file.name);
    fd.set("keine_namen", keinName ? "1" : "0");
    if (studentId) fd.set("schueler", String(studentId));
    setBusy("lesen");
    try {
      const res = await fetch("/material/textfoto", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { vorschlag?: TextFotoVorschlag; error?: string };
      if (res.ok && data.vorschlag) {
        setErgebnis(data.vorschlag);
        if (data.vorschlag.text) onText(data.vorschlag);
      } else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setFehler("Keine Verbindung. Bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  return (
    <div className="grid gap-2" data-testid="textfoto">
      {!seite ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()} disabled={busy !== null} data-testid="textfoto-waehlen">
            <Camera size={15} aria-hidden /> {busy === "vorbereiten" ? "Wird vorbereitet …" : "Vom Foto lesen"}
          </button>
          <span className="text-[12.5px] text-ink-3">Foto oder PDF der gedruckten Seite. Die KI schreibt den Text ab, du prüfst ihn.</span>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl bg-panel p-3">
          <div className="flex items-center gap-3">
            {seite.url ? (
              <a href={seite.url} target="_blank" rel="noreferrer" className="shrink-0" title="Foto groß ansehen">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
                <img src={seite.url} alt="Gewählte Seite" className="h-14 w-14 rounded-lg bg-surface object-cover object-top" />
              </a>
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-accent" aria-hidden>
                <FileText size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{ergebnis ? `${ergebnis.zeilen} Zeilen übernommen` : seite.file.name}</p>
              <p className="num text-[12.5px] text-ink-3">{ergebnis ? "Steht jetzt unten im Textfeld." : `${Math.max(1, Math.round(seite.file.size / 1024))} KB`}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={weg} disabled={busy !== null} aria-label="Foto entfernen" data-testid="textfoto-entfernen">
              <X size={16} aria-hidden />
            </button>
          </div>
          {!ergebnis ? (
            <>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="textfoto-keine-namen" />
                <span>Auf der Seite steht kein Name und nichts Handgeschriebenes (oder es ist abgedeckt).</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void lesen()} disabled={!keinName || busy !== null} data-testid="textfoto-lesen">
                  <Sparkles size={15} aria-hidden /> {busy === "lesen" ? "KI liest …" : "Text lesen"}
                </button>
                {busy === "lesen" && (
                  <span className="num text-[12.5px] text-ink-3" role="status">
                    meist unter einer Minute ({seit} s)
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber" role="status" data-testid="textfoto-hinweise">
              <p className="font-semibold">Von der KI abgeschrieben. Bitte Wort für Wort mit der Seite vergleichen, bevor du speicherst.</p>
              {ergebnis.hinweise.length > 0 && (
                <ul className="grid gap-0.5">
                  {ergebnis.hinweise.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <div>
                <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => fileInput.current?.click()} data-testid="textfoto-weiter">
                  <Camera size={15} aria-hidden /> Nächste Seite lesen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {fehler && (
        <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[13px] text-red" data-testid="textfoto-fehler">
          {fehler}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void waehle(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
        data-testid="textfoto-datei"
      />
    </div>
  );
}
