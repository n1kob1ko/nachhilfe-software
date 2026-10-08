"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, GripVertical, ImagePlus, Images, Trash2 } from "lucide-react";
import { SchoolClassFields } from "@/components/SchoolClassFields";

/** Mirrors lib/picture-story.ts (kept here so the browser does not load server code). */
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Longer side of a picture after the browser made it smaller: plenty for the screen and for A4. */
const MAX_SIDE = 2000;

export type StoryDefaults = {
  title: string;
  subject: string;
  prompt: string;
  schoolType: string;
  klasse: number | null;
  targetWords: number | null;
  starters: string[];
  hints: string;
  lines: number;
  sourceKind: string;
  sourceNote: string;
};
export type ExistingImage = { id: number; url: string; caption: string; name: string; size: number };

type Item = { key: string; id?: number; file?: File; url: string; caption: string; name: string; size: number };

type Props = {
  /** POST target: /material/bildgeschichte/neu or /material/bildgeschichte/<id> */
  action: string;
  unitId?: number;
  defaults: StoryDefaults;
  images?: ExistingImage[];
  subjects: string[];
  lineChoices: { lines: number; label: string }[];
  sourceKinds: Record<string, string>;
  device?: "laptop" | "tablet" | null;
  name: string;
  submitLabel: string;
  cancelHref: string;
};

const sizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Makes a large picture smaller in the browser (JPEG), so the upload is fast also on a tablet. Every JPEG is
 * drawn anew, which drops its EXIF data (camera, place, time of a phone photo). Small PNG and WebP files stay as they are.
 */
async function shrink(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file; // the server decides
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const photo = file.type === "image/jpeg";
  if (scale === 1 && !photo && file.size <= 1.5 * 1024 * 1024) {
    bmp.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // transparent drawings stay readable on white paper
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.86));
  if (!blob || (!photo && blob.size >= file.size)) return file;
  return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Pictures and settings of a Bildgeschichte: upload (button or drop), preview, order by dragging or with
 * the arrow buttons, a short description per picture, task, word target, sentence starters, hints and
 * room to write on paper. Sends everything in one request.
 */
export function PictureStoryForm(p: Props) {
  const [items, setItems] = useState<Item[]>(() => (p.images ?? []).map((i) => ({ key: `i${i.id}`, id: i.id, url: i.url, caption: i.caption, name: i.name, size: i.size })));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "bilder" | "senden">(null);
  const [over, setOver] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLOListElement>(null);
  const counter = useRef(0);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function add(list: FileList | File[]) {
    setError(null);
    setNote(null);
    const files = [...list];
    const wrong = files.filter((f) => !TYPES.includes(f.type));
    const room = MAX_IMAGES - items.length;
    const take = files.filter((f) => TYPES.includes(f.type)).slice(0, Math.max(0, room));
    const notes: string[] = [];
    if (wrong.length) notes.push(`${wrong.map((f) => `„${f.name}“`).join(", ")}: nur JPG, PNG oder WebP.`);
    if (files.length - wrong.length > room) notes.push(`Höchstens ${MAX_IMAGES} Bilder, ${files.length - wrong.length - take.length} nicht übernommen.`);
    if (!take.length) {
      if (notes.length) setError(notes.join(" "));
      return;
    }
    setBusy("bilder");
    const added: Item[] = [];
    for (const f of take) {
      const small = await shrink(f);
      if (small.size > MAX_IMAGE_BYTES) {
        notes.push(`„${f.name}“ ist zu groß (höchstens 10 MB).`);
        continue;
      }
      const url = URL.createObjectURL(small);
      objectUrls.current.push(url);
      added.push({ key: `n${counter.current++}`, file: small, url, caption: "", name: f.name, size: small.size });
    }
    setItems((now) => [...now, ...added].slice(0, MAX_IMAGES));
    setBusy(null);
    if (notes.length) setError(notes.join(" "));
    else setNote(`${added.length === 1 ? "1 Bild" : `${added.length} Bilder`} hinzugefügt.`);
  }

  const move = (from: number, to: number) =>
    setItems((now) => {
      if (to < 0 || to >= now.length || from === to) return now;
      const next = [...now];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  // dragging by the handle, with finger, pen or mouse: the card follows to the place under the pointer
  function startDrag(e: React.PointerEvent, key: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragKey(key);
  }
  function dragMove(e: React.PointerEvent) {
    if (!dragKey || !grid.current) return;
    const cards = [...grid.current.querySelectorAll<HTMLElement>("[data-key]")];
    const target = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (!target || target.dataset.key === dragKey) return;
    const from = items.findIndex((i) => i.key === dragKey);
    const to = items.findIndex((i) => i.key === target.dataset.key);
    if (from >= 0 && to >= 0) move(from, to);
  }
  const endDrag = () => setDragKey(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!items.length) {
      setError("Bitte mindestens ein Bild hochladen.");
      return;
    }
    const form = new FormData(e.currentTarget);
    let n = 0;
    const order = items.map((i) => {
      if (i.id) return { id: i.id, caption: i.caption };
      form.append(`bild${n}`, i.file!, i.file!.name);
      return { upload: n++, caption: i.caption };
    });
    form.set("reihenfolge", JSON.stringify(order));
    if (p.unitId) form.set("einheit", String(p.unitId));
    setBusy("senden");
    try {
      const res = await fetch(p.action, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.redirect === "string") {
        window.location.assign(data.redirect);
        return;
      }
      setError(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das Speichern ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setError("Keine Verbindung. Die Bilder sind noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  const d = p.defaults;
  const total = items.reduce((s, i) => s + (i.file ? i.size : 0), 0);

  return (
    <form onSubmit={submit} className="grid gap-8" data-testid="bildgeschichte-form">
      <section aria-labelledby="bg-bilder" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="bg-bilder" className="text-[19px] font-semibold">
              Bilder <span className="num text-ink-3">{items.length}/{MAX_IMAGES}</span>
            </h2>
            <p className="text-[14px] text-ink-2">JPG, PNG oder WebP. Reihenfolge durch Ziehen am Griff oder mit den Pfeilen ändern.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={items.length >= MAX_IMAGES || busy !== null} data-testid="bilder-waehlen">
            <ImagePlus size={17} aria-hidden /> Bilder hinzufügen
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="bilder-datei"
            onChange={(e) => {
              if (e.target.files?.length) void add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void add(e.dataTransfer.files);
            }}
            className={`flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 text-center transition-colors ${over ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-accent"}`}
          >
            <Images size={30} strokeWidth={1.6} className="text-accent" aria-hidden />
            <span className="text-[16px] font-semibold">Bilder auswählen oder hierher ziehen</span>
            <span className="text-[14px] text-ink-2">meist 3 bis 6 Bilder, bis zu {MAX_IMAGES}</span>
          </button>
        ) : (
          <ol
            ref={grid}
            className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              void add(e.dataTransfer.files);
            }}
            data-testid="bilder-vorschau"
          >
            {items.map((it, i) => (
              <li
                key={it.key}
                data-key={it.key}
                data-testid="bild-karte"
                className={`flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-card)] transition-[opacity,border-color] ${dragKey === it.key ? "border-accent opacity-70" : "border-line"}`}
              >
                <div className="relative bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={`Bild ${i + 1}`} className="aspect-[4/3] w-full object-contain" draggable={false} />
                  <span className="num absolute top-2 left-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 text-[15px] font-semibold text-white" data-testid="bild-nummer">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`Bild ${i + 1} verschieben (ziehen)`}
                    title="Ziehen zum Verschieben"
                    className="absolute top-1.5 right-1.5 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-xl bg-surface/90 text-ink-2 active:cursor-grabbing"
                    onPointerDown={(e) => startDrag(e, it.key)}
                    onPointerMove={dragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <GripVertical size={18} aria-hidden />
                  </button>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 p-3">
                  <p className="num truncate text-[12.5px] text-ink-3" title={it.name}>
                    {it.name} · {sizeLabel(it.size)}
                    {it.id ? "" : " · neu"}
                  </p>
                  <label className="grid min-w-0 gap-1">
                    <span className="text-[13px] font-medium text-ink-2">Was passiert? (optional)</span>
                    <textarea
                      className="input min-h-[64px] text-[14px]"
                      rows={2}
                      maxLength={300}
                      value={it.caption}
                      placeholder="z. B. Der Hund schnappt sich den Ball."
                      onChange={(e) => setItems((now) => now.map((x) => (x.key === it.key ? { ...x, caption: e.target.value } : x)))}
                      data-testid="bild-beschreibung"
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn btn-ghost px-3" aria-label={`Bild ${i + 1} nach vorne`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                      <ArrowLeft size={16} aria-hidden />
                    </button>
                    <button type="button" className="btn btn-ghost px-3" aria-label={`Bild ${i + 1} nach hinten`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)} data-testid="bild-nach-hinten">
                      <ArrowRight size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost ml-auto px-3 text-red"
                      aria-label={`Bild ${i + 1} entfernen`}
                      title="Entfernen"
                      onClick={() => setItems((now) => now.filter((x) => x.key !== it.key))}
                      data-testid="bild-entfernen"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {items.length < MAX_IMAGES && (
              <li>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-[15px] font-semibold text-ink-2 hover:border-accent hover:text-ink"
                >
                  <ImagePlus size={22} aria-hidden /> Weitere Bilder
                </button>
              </li>
            )}
          </ol>
        )}
        <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
          {busy === "bilder" ? "Bilder werden vorbereitet …" : note}
          {items.length > 0 && total > 0 && !busy && <span className="num"> Neu hochzuladen: {sizeLabel(total)}.</span>}
        </p>
        <p className="text-[13px] text-ink-2">Die kurzen Beschreibungen sieht nur die KI-Korrektur, damit sie den Bezug zu den Bildern prüfen kann. Die Bilder selbst werden nie an die KI gesendet.</p>
      </section>

      <section aria-label="Aufgabe" className="grid gap-5">
        <label className="field">
          <span className="label">Titel</span>
          <input className="input" name="title" required maxLength={140} defaultValue={d.title} placeholder="z. B. Der verlorene Ball" />
        </label>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="field">
            <span className="label">Fach</span>
            <input className="input" name="subject" list="bg-subjects" maxLength={60} defaultValue={d.subject} />
            <datalist id="bg-subjects">
              {p.subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <SchoolClassFields type={d.schoolType} klasse={d.klasse} />
        </div>
        <label className="field">
          <span className="label">Aufgabenstellung</span>
          <textarea className="input" name="prompt" rows={3} maxLength={4000} defaultValue={d.prompt} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span className="label">Gewünschte Wortanzahl</span>
            <input className="input num" name="target_words" type="number" inputMode="numeric" min={10} max={3000} step={10} defaultValue={d.targetWords ?? ""} placeholder="z. B. 150" />
          </label>
          <label className="field">
            <span className="label">Schreibplatz für Ausdrucke</span>
            <select className="input" name="lines" defaultValue={String(d.lines)}>
              {p.lineChoices.map((c) => (
                <option key={c.lines} value={c.lines}>
                  {c.label} ({c.lines} Linien)
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">
            <span className="label">Satzanfänge (optional, einer pro Zeile)</span>
            <textarea className="input" name="starters" rows={4} maxLength={1000} defaultValue={d.starters.join("\n")} placeholder={"Eines Tages …\nPlötzlich …\nZum Glück …"} />
          </label>
          <label className="field">
            <span className="label">Hinweise (optional)</span>
            <textarea className="input" name="hints" rows={4} maxLength={1500} defaultValue={d.hints} placeholder="z. B. Schreibe in der Vergangenheit. Verwende wörtliche Rede." />
          </label>
        </div>
        <details className="reveal">
          <summary>
            <ChevronDown size={15} aria-hidden className="reveal-chevron" />
            Quelle und Nutzungsrechte der Bilder (optional)
          </summary>
          <div className="grid gap-4 pt-3 sm:grid-cols-2">
            <label className="field">
              <span className="label">Herkunft</span>
              <select className="input" name="source_kind" defaultValue={d.sourceKind}>
                <option value="">nicht angegeben</option>
                {Object.entries(p.sourceKinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Quelle, Urheber, Lizenz</span>
              <input className="input" name="source_note" maxLength={400} defaultValue={d.sourceNote} placeholder="z. B. Sprachbuch 3, S. 42 / Zeichnung: A. Muster, CC BY 4.0" />
            </label>
            <p className="text-[13px] text-ink-2 sm:col-span-2">Nur zur Dokumentation. Die Bilder bleiben bei dieser Bildgeschichte und kommen nicht in die Bibliothek. Eine Quellenangabe wird klein unter dem Ausdruck gedruckt.</p>
          </div>
        </details>
      </section>

      {p.device !== undefined &&
        (p.device ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" name="tablet" value="1" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
            Gleich am {p.device === "laptop" ? "Laptop" : "Tablet"} von {p.name} öffnen
          </label>
        ) : (
          <p className="text-[14px] text-ink-2">Kein Schülergerät verbunden: Die Bildgeschichte öffnet sich hier, {p.name} schreibt an diesem Gerät.</p>
        ))}

      {error && (
        <p className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert" data-testid="bg-fehler">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-lg" disabled={busy !== null} data-testid="bg-speichern">
          <Images size={18} aria-hidden /> {busy === "senden" ? "Wird hochgeladen …" : p.submitLabel}
        </button>
        <a href={p.cancelHref} className="btn btn-ghost">
          Abbrechen
        </a>
      </div>
    </form>
  );
}
