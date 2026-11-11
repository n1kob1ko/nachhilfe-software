"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, FileText, Sparkles, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";
import { MAX_HINWEIS, MAX_VOKABEL_SEITEN, type VokabelFotoVorschlag } from "@/lib/vokabel-foto-regeln";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_FOTO = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Small print in a school book needs about as many pixels as handwriting. */
const MAX_SIDE = 2400;

type Seite = { file: File; url: string | null };
const centText = (c: number) => (c <= 0 ? "kostenlos" : c < 0.5 ? "unter 1 Cent" : `ca. ${Math.round(c)} Cent`);

/**
 * Vokabeln vom Foto (lib/vokabel-foto.ts), oben im Editor einer eigenen Vokabelliste: die Wortliste aus dem Schulbuch
 * oder dem Vokabelheft fotografieren, die KI liest Englisch und Deutsch ab, die Zeilen kommen in das Textfeld darunter
 * und rechts in die Vorschau. Gespeichert wird erst mit „Liste speichern“. Die Fotos bleiben hier zum Vergleichen und
 * werden nie gespeichert.
 */
export function VokabelFotoLesen({
  studentId,
  kiGrund,
  kosten,
  offen: offenAnfang,
  onGelesen,
}: {
  studentId: number;
  kiGrund: string | null;
  kosten: { grundCent: number; seiteCent: number };
  offen: boolean;
  /** gives the lines to the editor; answers how many new words came in */
  onGelesen: (v: VokabelFotoVorschlag) => number;
}) {
  const [offen, setOffen] = useState(offenAnfang);
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [gezeigt, setGezeigt] = useState(0);
  const [keinName, setKeinName] = useState(false);
  const [hinweis, setHinweis] = useState("");
  const [busy, setBusy] = useState<null | "vorbereiten" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ dazu: number; hinweise: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => seiten.forEach((s) => s.url && URL.revokeObjectURL(s.url)), [seiten]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function waehle(files: FileList | null) {
    if (!files?.length) return;
    setFehler(null);
    const frei = MAX_VOKABEL_SEITEN - seiten.length;
    if (files.length > frei) {
      setFehler(`Höchstens ${MAX_VOKABEL_SEITEN} Seiten auf einmal.`);
      if (frei <= 0) return;
    }
    setBusy("vorbereiten");
    const neu: Seite[] = [];
    for (const file of [...files].slice(0, Math.max(0, frei))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte Fotos oder ein PDF wählen.");
        continue;
      }
      const small = pdf ? file : await shrinkImage(file, MAX_SIDE);
      if (!pdf && !FOTO_TYPES.includes(small.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte JPG, PNG oder WebP wählen.");
        continue;
      }
      if (small.size > (pdf ? MAX_PDF : MAX_FOTO)) {
        setFehler(pdf ? "Ein PDF ist zu groß (höchstens 10 MB)." : "Ein Foto ist zu groß (höchstens 5 MB).");
        continue;
      }
      neu.push({ file: small, url: pdf ? null : URL.createObjectURL(small) });
    }
    setBusy(null);
    if (neu.length) {
      setGezeigt(seiten.length);
      setSeiten((s) => [...s, ...neu]);
      setErgebnis(null);
    }
  }

  function entferne(i: number) {
    setSeiten((s) => s.filter((_, j) => j !== i));
    setGezeigt((g) => Math.max(0, g >= i ? g - 1 : g));
  }

  async function lesen() {
    if (busy || !seiten.length) return;
    setFehler(null);
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    fd.set("keine_namen", keinName ? "1" : "");
    fd.set("hinweis", hinweis);
    for (const s of seiten) fd.append("seite", s.file, s.file.name);
    setBusy("lesen");
    try {
      const res = await fetch("/material/vokabeln", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { vorschlag?: VokabelFotoVorschlag; error?: string };
      if (res.ok && data.vorschlag) {
        const dazu = data.vorschlag.text ? onGelesen(data.vorschlag) : 0;
        setErgebnis({ dazu, hinweise: data.vorschlag.hinweise });
      } else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setFehler("Keine Verbindung. Die Fotos sind noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  const kostet = kosten.grundCent + Math.max(1, seiten.length) * kosten.seiteCent;
  const bild = seiten[Math.min(gezeigt, seiten.length - 1)];

  if (!offen)
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="panel flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-ink-3 lg:col-span-2"
        aria-expanded={false}
        data-testid="vf-oeffnen"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent" aria-hidden>
          <Camera size={20} />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-semibold">Vom Foto lesen</span>
          <span className="text-[13px] text-ink-2">Wortliste aus dem Buch oder Vokabelheft fotografieren. Die KI schreibt die Zeilen, du prüfst sie.</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-3" aria-hidden />
      </button>
    );

  return (
    <section className="panel grid gap-4 px-5 py-5 md:px-6 lg:col-span-2" aria-labelledby="vf-titel" data-testid="vokabel-foto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="vf-titel" className="text-[17px] font-semibold">
          Vom Foto lesen
        </h2>
        <span className="num text-[13px] text-ink-3">
          {seiten.length} von {MAX_VOKABEL_SEITEN} Seiten
        </span>
      </div>

      <div className={`grid gap-4 ${bild ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        {bild && (
          <div className="grid content-start gap-3">
            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              {bild.url ? (
                <a href={bild.url} target="_blank" rel="noreferrer" title="Foto groß ansehen">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
                  <img src={bild.url} alt={`Seite ${gezeigt + 1}`} className="max-h-[45vh] w-full bg-surface object-contain" data-testid="vf-bild" />
                </a>
              ) : (
                <span className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 px-3 py-6 text-center text-[13px] text-ink-2">
                  <FileText size={28} aria-hidden />
                  <span className="break-all">{bild.file.name}</span>
                </span>
              )}
            </div>
            <ul className="flex flex-wrap gap-2" data-testid="vf-seiten">
              {seiten.map((s, i) => (
                <li key={s.url ?? `${s.file.name}${i}`} className="relative">
                  <button
                    type="button"
                    onClick={() => setGezeigt(i)}
                    className={`flex h-[72px] w-[56px] items-center justify-center overflow-hidden rounded-lg border bg-surface ${i === gezeigt ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
                    aria-label={`Seite ${i + 1} zeigen`}
                    aria-current={i === gezeigt}
                  >
                    {s.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                      <img src={s.url} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      <FileText size={20} className="text-accent" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => entferne(i)}
                    disabled={busy !== null}
                    className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-red"
                    aria-label={`Seite ${i + 1} entfernen`}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid content-start gap-4">
          {seiten.length < MAX_VOKABEL_SEITEN && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== null}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-panel px-5 text-center transition-colors hover:border-ink-3 ${seiten.length ? "min-h-[56px] py-3" : "min-h-[130px] flex-col py-6"}`}
              data-testid="vf-waehlen"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-accent shadow-[var(--shadow-card)]" aria-hidden>
                <Camera size={22} />
              </span>
              <span className="grid gap-0.5">
                <span className="text-[16px] font-semibold">{busy === "vorbereiten" ? "Fotos werden vorbereitet …" : seiten.length ? "Weitere Seite" : "Seiten fotografieren oder auswählen"}</span>
                {!seiten.length && <span className="text-[13px] text-ink-2">Schulbuch, Arbeitsblatt oder Vokabelheft. Jede Seite gerade, hell und ganz im Bild. Auch ein PDF geht.</span>}
              </span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void waehle(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
            data-testid="vf-datei"
          />

          {kiGrund ? (
            <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="vf-ki-aus">
              {kiGrund}
            </p>
          ) : (
            <>
              <label className="field">
                <span className="label">Nur bestimmte Wörter? (optional)</span>
                <input
                  className="input"
                  value={hinweis}
                  onChange={(e) => setHinweis(e.target.value)}
                  maxLength={MAX_HINWEIS}
                  placeholder="z. B. nur Unit 3 oder nur die linke Spalte"
                  data-testid="vf-hinweis"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
                <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="vf-keine-namen" />
                <span>Auf den Fotos steht kein echter Name, auch nicht auf dem Heft oder oben am Blatt (oder er ist abgedeckt).</span>
              </label>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => void lesen()} disabled={busy !== null || !keinName || !seiten.length} data-testid="vf-lesen">
                  <Sparkles size={18} aria-hidden /> {busy === "lesen" ? "KI liest …" : ergebnis ? "Noch einmal lesen" : "Vokabeln lesen"}
                </button>
                <span className="num text-[13px] text-ink-3" data-testid="vf-kosten">
                  {kostet <= 0 ? "kostenlos" : `Schätzung: ${centText(kostet)}${seiten.length > 1 ? ` für ${seiten.length} Seiten` : " je Seite"}`}
                </span>
              </div>
            </>
          )}

          {fehler && (
            <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="vf-fehler">
              {fehler}
            </p>
          )}
          {ergebnis && (
            <div className={`grid gap-1 rounded-xl px-4 py-3 text-[14px] ${ergebnis.dazu ? "bg-green-wash text-green" : "bg-amber-wash text-amber"}`} role="status" data-testid="vf-ergebnis">
              <p className="font-semibold">
                {ergebnis.dazu === 0
                  ? "Keine neuen Wörter dazugekommen."
                  : `${ergebnis.dazu} ${ergebnis.dazu === 1 ? "Wort steht" : "Wörter stehen"} jetzt unten in der Liste. Bitte mit dem Foto vergleichen, dann speichern.`}
              </p>
              {ergebnis.hinweise.length > 0 && (
                <ul className="grid gap-0.5 text-amber">
                  {ergebnis.hinweise.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
            {busy === "lesen" ? (
              <span className="num">Die KI liest Englisch und Deutsch ab. Das dauert meist unter einer Minute ({seit} s).</span>
            ) : kiGrund ? (
              "Die Fotos helfen dir beim Eintippen und werden nicht gespeichert."
            ) : (
              "Die KI sieht nur die Fotos, keinen Namen aus der App. Sie übersetzt nichts selbst. Die Fotos werden nicht gespeichert."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
