"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, FileText, Sparkles, X } from "lucide-react";
import { KeinNameZeile } from "@/components/KeinNameZeile";
import { shrinkImage } from "@/components/shrink-image";

/** Mirrors lib/stoffpaket.ts and lib/ai/stoffpaket.ts (kept here so the browser does not load server code). */
const MAX_DATEIEN = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TEXT_MAX = 1500;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const STOFF_TEILE: { key: string; label: string; hilfe: string }[] = [
  { key: "lernzettel", label: "Lernzettel", hilfe: "die Infos zum Stoff, A4 und in der Schüler-App" },
  { key: "vorbereitung", label: "Vorbereitungstest", hilfe: "4 kurze Aufgaben für den Anfang" },
  { key: "uebung", label: "Übungsblatt", hilfe: "8 Aufgaben mit Hilfen" },
  { key: "test", label: "Test mit Lösungen", hilfe: "6 Aufgaben, zur nächsten Schularbeit mit Punkten und Note" },
  { key: "praesentation", label: "Präsentation", hilfe: "mit Sprechtext für dich" },
  { key: "spielkarten", label: "Spielkarten", hilfe: "etwa 40 Fragen für „Dein Stoff“ und Blockwerk in der Schüler-App" },
];

type Datei = { key: string; file: File; url: string | null };
export type StoffMaterial = { id: number; titel: string; art: "Foto" | "PDF"; datum: string };
const SICHTBAR = 6;

/**
 * Das Formular von „Stoff vorbereiten“ (lib/stoffpaket.ts): Fotos oder PDFs vom Buch, von Arbeitsblättern oder vom
 * Stoffzettel, optional ein Text, das Fach und die Teile. Sendet an app/material/stoffpaket und geht zur Seite des Laufs.
 */
export function StoffpaketForm({
  studentId,
  unitId,
  faecher,
  fach: fachAnfang,
  material = [],
  keinNameBestaetigt = false,
  kosten,
  gesperrt,
}: {
  studentId: number;
  unitId: number | null;
  faecher: string[];
  fach: string;
  material?: StoffMaterial[];
  keinNameBestaetigt?: boolean;
  /** „etwa 30–60 Cent“ */
  kosten: string;
  /** warum es gerade nicht geht (KI aus, Budget, Grenze des Schülers), sonst null */
  gesperrt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fach, setFach] = useState(fachAnfang);
  const [teile, setTeile] = useState<string[]>(STOFF_TEILE.map((t) => t.key));
  const [dateien, setDateien] = useState<Datei[]>([]);
  const [gewaehlt, setGewaehlt] = useState<number[]>([]);
  const [alle, setAlle] = useState(false);
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const anzahl = dateien.length + gewaehlt.length;

  async function waehle(files: File[]) {
    setFehler(null);
    const platz = MAX_DATEIEN - anzahl;
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
    if (!anzahl && !text.trim()) return setFehler("Bitte Fotos oder PDFs wählen oder kurz schreiben, um welchen Stoff es geht.");
    if (!fach) return setFehler("Bitte ein Fach wählen.");
    if (!teile.length) return setFehler("Bitte mindestens einen Teil wählen.");
    if (anzahl && !keinNameBestaetigt && !keinName) return setFehler("Bitte bestätigen, dass auf den Blättern kein Name steht.");
    setFehler(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    if (unitId) fd.set("einheit", String(unitId));
    fd.set("fach", fach);
    fd.set("text", text);
    fd.set("keine_namen", keinName ? "1" : "0");
    for (const t of teile) fd.append("teil", t);
    for (const d of dateien) fd.append("datei", d.file, d.file.name);
    for (const id of gewaehlt) fd.append("material", String(id));
    try {
      const res = await fetch("/material/stoffpaket", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string; materials?: number[] };
      if (!res.ok || !data.url) {
        // schon gespeicherte Fotos nicht noch einmal hochladen
        if (data.materials?.length) {
          setGewaehlt([...new Set([...gewaehlt, ...data.materials])]);
          for (const d of dateien) if (d.url) URL.revokeObjectURL(d.url);
          setDateien([]);
        }
        setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
        setBusy(false);
        return;
      }
      for (const d of dateien) if (d.url) URL.revokeObjectURL(d.url);
      router.push(data.url);
    } catch {
      setFehler("Keine Verbindung. Bitte noch einmal versuchen.");
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4" data-testid="stoffpaket-form">
      <div className="grid min-w-0 gap-2">
        <span className="text-[14px] font-medium">Fotos vom Buch, von Arbeitsblättern oder vom Stoffzettel</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy || anzahl >= MAX_DATEIEN} data-testid="stoffpaket-foto">
            <Camera size={16} aria-hidden /> {dateien.length ? "Weiteres Foto" : "Fotos oder PDF wählen"}
          </button>
          <span className="text-[12.5px] text-ink-3">bis zu {MAX_DATEIEN}</span>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Fotos oder PDFs vom Stoff"
            onChange={(e) => {
              void waehle(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
            data-testid="stoffpaket-datei"
          />
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
        {material.length > 0 && (
          <div className="grid min-w-0 gap-1.5" data-testid="stoffpaket-material">
            <span className="text-[13px] text-ink-2">Oder schon vorhandenes Material:</span>
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {(alle ? material : material.slice(0, SICHTBAR)).map((m) => {
                const an = gewaehlt.includes(m.id);
                return (
                  <li key={m.id} className="min-w-0 max-w-full">
                    <label className="flex min-h-[44px] max-w-full cursor-pointer items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1.5 pr-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash has-focus-visible:outline-2 has-focus-visible:outline-accent has-disabled:cursor-default has-disabled:opacity-60">
                      <input type="checkbox" checked={an} disabled={busy || (!an && anzahl >= MAX_DATEIEN)} onChange={() => setGewaehlt(an ? gewaehlt.filter((x) => x !== m.id) : [...gewaehlt, m.id])} className="sr-only" />
                      {m.art === "Foto" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/material/${m.id}/datei`} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full border border-line object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-ink-2">
                          <FileText size={15} aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 truncate">
                        {m.titel}
                        <span className="text-ink-3">
                          {" "}
                          · {Number(m.datum.slice(8, 10))}.{Number(m.datum.slice(5, 7))}.
                        </span>
                      </span>
                      {an && <Check size={15} className="shrink-0 text-accent" aria-hidden />}
                    </label>
                  </li>
                );
              })}
              {!alle && material.length > SICHTBAR && (
                <li>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAlle(true)}>
                    mehr ({material.length - SICHTBAR})
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
        {anzahl > 0 && keinNameBestaetigt && <KeinNameZeile wo="auf den Blättern" />}
        {anzahl > 0 && !keinNameBestaetigt && (
          <label className="flex min-h-[44px] items-start gap-2 text-[13.5px]">
            <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="stoffpaket-keine-namen" />
            <span>Auf den Blättern steht kein Name (oder er ist abgedeckt).</span>
          </label>
        )}
      </div>

      <label className="grid gap-1.5">
        <span className="text-[14px] font-medium">
          Was brauchst du? <span className="font-normal text-ink-3">(optional)</span>
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEXT_MAX}
          rows={3}
          placeholder="z. B. Test für die Schularbeit am 3.12., nur Seite 45–48. Er verwechselt kürzen und erweitern."
          className="input min-h-[88px] resize-y"
          data-testid="stoffpaket-text"
        />
      </label>

      <label className="grid max-w-[320px] gap-1.5">
        <span className="text-[14px] font-medium">Fach</span>
        <select value={fach} onChange={(e) => setFach(e.target.value)} className="input" data-testid="stoffpaket-fach">
          {!fach && <option value="">Bitte wählen</option>}
          {faecher.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-[14px] font-medium">Was soll entstehen?</legend>
        {STOFF_TEILE.map((t) => (
          <label key={t.key} className="flex min-h-[44px] items-center gap-2.5 text-[14px]">
            <input
              type="checkbox"
              checked={teile.includes(t.key)}
              onChange={(e) => setTeile(e.target.checked ? [...teile, t.key] : teile.filter((x) => x !== t.key))}
              className="h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
              data-testid={`stoffpaket-teil-${t.key}`}
            />
            <span>
              {t.label} <span className="text-ink-3">· {t.hilfe}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {fehler && (
        <p role="alert" className="text-[13.5px] text-red">
          {fehler}
        </p>
      )}
      {gesperrt ? (
        <p className="text-[13.5px] text-ink-2" data-testid="stoffpaket-gesperrt">
          {gesperrt}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => void senden()} disabled={busy} data-testid="stoffpaket-start">
            <Sparkles size={16} aria-hidden /> {busy ? "Wird hochgeladen …" : "Alles erstellen"}
          </button>
          <span className="text-[12.5px] text-ink-3">{kosten} · dauert 2 bis 5 Minuten</span>
        </div>
      )}
    </div>
  );
}
