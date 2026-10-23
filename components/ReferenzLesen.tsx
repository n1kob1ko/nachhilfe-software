"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";

/** Mirrors lib/materials.ts MAX_ANALYSIS_PDF_BYTES (kept here so the browser does not load server code). */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Referenzsammlung: ein PDF (oder Foto) mit Aufgaben, das Fach und die Quelle. Die KI liest die Datei einmal, jede
 * Aufgabe wird ein ungeprüfter Eintrag; die Datei wird nicht gespeichert (app/material/referenz/route.ts).
 */
export function ReferenzLesen({ faecher, fach, gesperrt }: { faecher: readonly string[]; fach?: string; gesperrt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seit, setSeit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fertig, setFertig] = useState<{ anzahl: number; hinweise: string[] } | null>(null);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setFertig(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("datei");
    if (!(file instanceof File) || !file.size) return setError("Bitte eine Datei wählen.");
    if (file.size > MAX_BYTES) return setError("Die Datei ist zu groß (höchstens 10 MB).");
    setBusy(true);
    try {
      const res = await fetch("/material/referenz", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.anzahl === "number") {
        setFertig({ anzahl: data.anzahl, hinweise: Array.isArray(data.hinweise) ? data.hinweise : [] });
        formEl.reset();
        router.refresh();
      } else {
        setError(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
      }
    } catch {
      setError("Keine Verbindung. Bitte noch einmal versuchen.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label="PDF lesen" data-testid="referenz-lesen">
      <label className="field">
        <span className="label">PDF oder Foto</span>
        <input className="input py-2" type="file" name="datei" accept="application/pdf,image/jpeg,image/png,image/webp" required disabled={Boolean(gesperrt) || busy} />
        <span className="text-[12.5px] text-ink-3">Eine Datei, die du selbst heruntergeladen hast, höchstens 10 MB. Sie wird nur gelesen, nicht gespeichert.</span>
      </label>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        <label className="field">
          <span className="label">Fach</span>
          <select className="input" name="fach" defaultValue={fach ?? faecher[0]} disabled={Boolean(gesperrt) || busy}>
            {faecher.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Quelle</span>
          <input className="input" name="quelle" required maxLength={120} placeholder="z. B. aufgabenpool.at" disabled={Boolean(gesperrt) || busy} />
          <span className="text-[12.5px] text-ink-3">Die Kennung kommt von der Seite oder aus dem Dateinamen.</span>
        </label>
      </div>
      {gesperrt && <p className="rounded-xl bg-panel px-4 py-3 text-[14px] text-ink-2">{gesperrt}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red">
          {error}
        </p>
      )}
      {fertig && (
        <div role="status" className="rounded-xl bg-green-wash px-4 py-3 text-[14px] text-green">
          <p className="font-semibold">
            {fertig.anzahl === 1 ? "1 Eintrag angelegt." : `${fertig.anzahl} Einträge angelegt.`} Bitte jeden prüfen und speichern.
          </p>
          {fertig.hinweise.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {fertig.hinweise.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button className="btn btn-primary" disabled={Boolean(gesperrt) || busy}>
          {busy ? <FileText size={17} aria-hidden /> : <Sparkles size={17} aria-hidden />} {busy ? "Wird gelesen …" : "Mit KI lesen"}
        </button>
        {busy && (
          <p className="num text-[13px] text-ink-3" aria-live="polite">
            Die KI liest die Aufgaben. Das dauert meist unter einer Minute ({seit} s).
          </p>
        )}
      </div>
    </form>
  );
}
