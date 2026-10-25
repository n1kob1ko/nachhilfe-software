"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileText, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";
import { PRUEFUNGSARTEN } from "@/lib/pruefungsarten";

/** Mirrors lib/pruefliste.ts (kept here so the browser does not load server code). */
const MAX_FOTOS = 8;
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Was ein Schüler vor sich hat; Mitarbeit und Zeugnis trägt der Lehrer ein. */
const ARTEN = PRUEFUNGSARTEN.filter((a) => a !== "Mitarbeit" && a !== "Zeugnis");

type Foto = { file: File; url: string | null; key: number };

/**
 * Schüler-App: eine Prüfung eintragen (lib/pruefliste.ts). Art, Fach, Datum (darf leer bleiben), Stoff, Notiz und
 * Fotos oder PDFs vom Stoffzettel; Fotos werden im Browser verkleinert. Nach dem Senden werden die Fotos gleich
 * verarbeitet, ohne eigenen Knopf („Dokument wird verarbeitet.“, dann „Prüfungsstoff wurde eingetragen.“). Was
 * unklar bleibt, prüft der Lehrer.
 */
export function PruefungEintragen({ token, faecher, weitere }: { token: string; faecher: string[]; weitere: string[] }) {
  const router = useRouter();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [busy, setBusy] = useState<null | "vorbereiten" | "senden">(null);
  const [phase, setPhase] = useState<"formular" | "verarbeiten" | { eingetragen: boolean }>("formular");
  const [keinName, setKeinName] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const zaehler = useRef(0);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function waehle(files: File[]) {
    if (!files.length) return;
    setFehler(null);
    const platz = MAX_FOTOS - fotos.length;
    if (files.length > platz) setFehler(`Höchstens ${MAX_FOTOS} Fotos.`);
    setBusy("vorbereiten");
    const neu: Foto[] = [];
    for (const file of files.slice(0, Math.max(0, platz))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte ein Foto oder ein PDF wählen.");
        continue;
      }
      const klein = pdf ? file : await shrinkImage(file);
      if (!pdf && !TYPES.includes(klein.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
        continue;
      }
      if (klein.size > (pdf ? MAX_PDF_BYTES : MAX_FOTO_BYTES)) {
        setFehler(`${pdf ? "Das PDF" : "Das Foto"} ist zu groß (höchstens ${(pdf ? MAX_PDF_BYTES : MAX_FOTO_BYTES) / 1024 / 1024} MB).`);
        continue;
      }
      const url = pdf ? null : URL.createObjectURL(klein);
      if (url) urls.current.push(url);
      neu.push({ file: klein, url, key: ++zaehler.current });
    }
    setBusy(null);
    setFotos((f) => [...f, ...neu].slice(0, MAX_FOTOS));
  }

  async function senden(fd: FormData) {
    if (busy) return;
    setFehler(null);
    fd.delete("foto");
    for (const f of fotos) fd.append("foto", f.file, f.file.name);
    setBusy("senden");
    try {
      const res = await fetch(`/lernen/${encodeURIComponent(token)}/pruefung/senden`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: number; verarbeiten?: boolean };
      if (!res.ok || !data.ok) {
        setFehler(data.error ?? "Das ging nicht. Bitte noch einmal versuchen.");
        setBusy(null);
        return;
      }
      // gespeichert ist es schon: jetzt nur noch die Fotos verarbeiten, ohne weiteren Knopf
      let eingetragen = false;
      if (data.verarbeiten && data.id) {
        setPhase("verarbeiten");
        try {
          const v = await fetch(`/lernen/${encodeURIComponent(token)}/pruefung/verarbeiten?id=${data.id}`, { method: "POST" });
          eingetragen = Boolean(((await v.json().catch(() => ({}))) as { eingetragen?: boolean }).eingetragen);
        } catch {
          // dann prüft es der Lehrer
        }
      }
      setPhase({ eingetragen });
      setBusy(null);
      router.refresh();
    } catch {
      setFehler("Keine Verbindung. Deine Angaben sind noch da, bitte noch einmal versuchen.");
      setBusy(null);
    }
  }

  if (phase === "verarbeiten")
    return (
      <div className="panel flex items-center gap-3 px-5 py-6 text-[17px] font-semibold" role="status" data-testid="eintragen-verarbeitet">
        <LoaderCircle size={22} className="shrink-0 animate-spin text-accent motion-reduce:animate-none" aria-hidden /> Dokument wird verarbeitet.
      </div>
    );
  if (phase !== "formular")
    return (
      <div className="panel grid gap-4 px-5 py-6" role="status" data-testid="eintragen-fertig">
        <p className="flex items-center gap-3 text-[17px] font-semibold">
          <CheckCircle2 size={22} className="shrink-0 text-green" aria-hidden /> Prüfungsstoff wurde eingetragen.
        </p>
        {!phase.eingetragen && <p className="text-[15px] text-ink-2">Ein paar Angaben prüft dein Lehrer noch, zum Beispiel das Datum.</p>}
        <div className="flex flex-wrap gap-2">
          <Link href={`/lernen/${token}#pruefungen`} className="btn btn-primary">
            Zur Übersicht
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => (setFotos([]), setKeinName(false), setPhase("formular"))}>
            Noch eine eintragen
          </button>
        </div>
      </div>
    );

  return (
    // onSubmit, nicht action: so bleiben die Angaben nach einem Fehler stehen
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void senden(new FormData(e.currentTarget));
      }}
      className="panel grid gap-4 px-5 py-5" aria-label="Prüfung eintragen">
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span className="label">Art</span>
          <select className="input" name="art" defaultValue={ARTEN[0]}>
            {ARTEN.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Fach</span>
          <select className="input" name="fach" defaultValue={faecher[0]}>
            {faecher.map((s) => (
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
      </div>
      <label className="field">
        <span className="label">Datum</span>
        <input className="input" type="date" name="datum" data-testid="eintragen-datum" />
        <span className="text-[13px] text-ink-3">Weißt du es noch nicht? Dann lass es leer.</span>
      </label>
      <label className="field">
        <span className="label">Stoff</span>
        <input className="input" name="stoff" maxLength={400} placeholder="z. B. Brüche, Prozent, Sachaufgaben" autoComplete="off" />
      </label>
      <label className="field">
        <span className="label">Notiz</span>
        <textarea className="input min-h-[72px]" name="notiz" maxLength={500} rows={2} placeholder="z. B. Buch Seite 40 bis 52" />
      </label>

      <div className="grid gap-3" data-testid="eintragen-fotos">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={busy !== null || fotos.length >= MAX_FOTOS} data-testid="eintragen-foto-waehlen">
            <Camera size={17} aria-hidden /> {busy === "vorbereiten" ? "Wird vorbereitet …" : fotos.length ? "Noch ein Foto" : "Stoffzettel fotografieren"}
          </button>
          <span className="text-[13px] text-ink-3">Foto oder PDF, bis zu {MAX_FOTOS}, z. B. Stoffzettel und Inhaltsverzeichnis.</span>
        </div>
        {fotos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {fotos.map((f) => (
              <li key={f.key} className="relative">
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                  <img src={f.url} alt="Gewähltes Foto" className="h-20 w-20 rounded-lg border border-line bg-surface object-cover object-top" />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-line bg-panel text-accent" aria-label="Gewähltes PDF">
                    <FileText size={24} aria-hidden />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setFotos((l) => l.filter((x) => x.key !== f.key))}
                  disabled={busy !== null}
                  className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink"
                  aria-label="Foto entfernen"
                >
                  <X size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {fotos.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 text-[15px]">
            <input type="checkbox" name="keine_namen" value="1" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[20px] w-[20px] shrink-0 accent-[var(--accent)]" data-testid="eintragen-keine-namen" />
            <span>Auf den Fotos ist kein Name zu sehen (oder er ist abgedeckt).</span>
          </label>
        )}
        {/* Hinweis zur Datenverarbeitung: steht immer da, wo Fotos hochgeladen werden */}
        <p className="flex items-start gap-2 rounded-lg bg-panel px-3 py-2.5 text-[13px] text-ink-2" data-testid="eintragen-datenschutz">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>
            Deine Fotos sehen nur deine Lehrer. Damit niemand Fach, Datum und Stoff abtippen muss, liest ein Dienst außerhalb von Lernheft die Fotos aus, aber nur, wenn kein Name darauf zu sehen ist. Deck deinen Namen vorher ab.
          </span>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void waehle(Array.from(e.currentTarget.files ?? []));
            e.currentTarget.value = "";
          }}
          data-testid="eintragen-datei"
        />
      </div>

      {fehler && (
        <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[14px] text-red" data-testid="eintragen-fehler">
          {fehler}
        </p>
      )}
      <button className="btn btn-primary btn-lg justify-self-start" disabled={busy !== null} data-testid="eintragen-senden">
        {busy === "senden" ? "Wird gesendet …" : "Eintragen"}
      </button>
    </form>
  );
}
