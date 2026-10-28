"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Sparkles } from "lucide-react";
import { KeinNameZeile } from "@/components/KeinNameZeile";
import { shrinkImage } from "@/components/shrink-image";

/** Mirrors lib/foto-uebung.ts and lib/materials.ts (kept here so the browser does not load server code). */
const ANZAHL = [5, 10, 15];
const STANDARD = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * „Foto vom Stoff“: one photo (camera or gallery, made smaller in the browser), how many tasks, an optional
 * hint and the confirmation that no names are on it. Sends everything in one request and opens the preview.
 * After a failure the stored photo is sent again by its id, so the teacher does not take it again.
 * `keinName`: already confirmed for this unit (lib/kein-name.ts); a quiet line instead of the tick.
 */
export function FotoUebungForm({ unitId, name, keinName = false }: { unitId: number; name: string; keinName?: boolean }) {
  const [foto, setFoto] = useState<{ file: File; url: string } | null>(null);
  const [gespeichert, setGespeichert] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "foto" | "senden">(null);
  const [seit, setSeit] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => (foto ? URL.revokeObjectURL(foto.url) : undefined), [foto]);
  useEffect(() => {
    if (busy !== "senden") return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function waehle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      setError("Bitte ein Foto wählen (JPG, PNG oder WebP).");
      return;
    }
    setBusy("foto");
    const small = await shrinkImage(file);
    setBusy(null);
    if (!TYPES.includes(small.type)) {
      setError("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
      return;
    }
    if (small.size > MAX_BYTES) {
      setError("Das Foto ist zu groß (höchstens 5 MB).");
      return;
    }
    setFoto({ file: small, url: URL.createObjectURL(small) });
    setGespeichert(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!foto && !gespeichert) {
      setError("Bitte zuerst ein Foto aufnehmen oder auswählen.");
      return;
    }
    const form = new FormData(e.currentTarget);
    form.delete("datei");
    form.set("einheit", String(unitId));
    if (gespeichert) form.set("material", String(gespeichert));
    else if (foto) form.set("datei", foto.file, foto.file.name);
    setBusy("senden");
    try {
      const res = await fetch("/material/foto", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.redirect === "string") {
        window.location.assign(data.redirect);
        return;
      }
      if (typeof data.material === "number") setGespeichert(data.material);
      setError(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setError("Keine Verbindung. Das Foto ist noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  return (
    <form onSubmit={submit} className="panel grid gap-6 px-5 py-5 md:px-6 md:py-6" data-testid="foto-form">
      <div className="grid gap-3">
        {foto ? (
          <figure className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
            <img src={foto.url} alt="Gewähltes Foto vom Stoff" className="max-h-[420px] w-full rounded-xl bg-panel object-contain" data-testid="foto-vorschau" />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-ink-2">
              <span className="num">{Math.max(1, Math.round(foto.file.size / 1024))} KB</span>
              <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy !== null}>
                <RefreshCw size={16} aria-hidden /> Anderes Foto
              </button>
            </figcaption>
          </figure>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setOver(true);
              }
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void waehle(e.dataTransfer.files[0]);
            }}
            disabled={busy !== null}
            className={`flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              over ? "border-accent bg-accent-wash" : "border-line bg-panel hover:border-ink-3"
            }`}
            data-testid="foto-waehlen"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-accent shadow-[var(--shadow-card)]" aria-hidden>
              <Camera size={26} />
            </span>
            <span className="text-[17px] font-semibold">{busy === "foto" ? "Foto wird vorbereitet …" : "Foto aufnehmen oder auswählen"}</span>
            <span className="max-w-[44ch] text-[14px] text-ink-2">Die Buchseite oder das Arbeitsblatt, gerade und gut lesbar.</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          name="datei"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void waehle(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
          data-testid="foto-datei"
        />
        {gespeichert && <p className="text-[14px] text-ink-2" data-testid="foto-gespeichert">Das Foto ist gespeichert. Ein neuer Versuch schickt es nicht noch einmal.</p>}
      </div>

      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="mb-2 text-[14px] font-semibold">Wie viele Aufgaben</legend>
        <span className="flex rounded-full bg-panel p-1">
          {ANZAHL.map((n) => (
            <label
              key={n}
              className="num flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-full px-3 text-[15px] font-semibold text-ink-2 transition-colors has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-[var(--shadow-card)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input type="radio" name="anzahl" value={n} defaultChecked={n === STANDARD} className="sr-only" data-testid={`foto-anzahl-${n}`} />
              {n}
            </label>
          ))}
        </span>
      </fieldset>

      <label className="grid gap-1.5">
        <span className="text-[14px] font-semibold">
          Hinweis für die KI <span className="font-normal text-ink-3">(freiwillig)</span>
        </span>
        <input name="hinweis" maxLength={300} className="input" placeholder="z. B. nur die Aufgaben rechts, eher leicht" data-testid="foto-hinweis" />
      </label>

      {keinName ? (
        <KeinNameZeile wo="auf dem Foto" />
      ) : (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
          <input type="checkbox" name="keine_namen" value="1" required className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="foto-keine-namen" />
          <span>Auf dem Foto stehen keine Namen und keine anderen persönlichen Angaben.</span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="foto-fehler">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button className="btn btn-primary btn-lg" disabled={busy !== null} data-testid="foto-erstellen">
          <Sparkles size={18} aria-hidden /> {busy === "senden" ? "Übung wird erstellt …" : "Übung erstellen"}
        </button>
        <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
          {busy === "senden" ? (
            <span className="num">Die KI liest das Foto und erstellt die Aufgaben. Das dauert meist unter einer Minute ({seit} s).</span>
          ) : (
            `Das Foto bleibt bei ${name} unter Material.`
          )}
        </p>
      </div>
    </form>
  );
}
