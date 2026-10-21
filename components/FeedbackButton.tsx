"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ImagePlus, MessageSquarePlus, X } from "lucide-react";

/**
 * Der Feedback-Knopf (niko, 21.10.2026): one tap on any page, write what bothers you or is missing,
 * optionally add a screenshot, send. The page, the screen size, light or dark mode and the last errors in
 * the browser go along by themselves (lib/feedback.ts). It sits above the account in the side bar, next to
 * the dark-mode button on the phone and in the whiteboard's top bar, never as an entry of the navigation.
 */
const ARTEN = [
  { value: "fehler", label: "Fehler" },
  { value: "wunsch", label: "Wunsch" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;
const MAX_FEHLER = 5;
/** Screenshots are made smaller in the browser first: enough to read, quick to send. */
const MAX_KANTE = 1600;

// the last errors in this browser tab, for the next feedback; collected once for all buttons
const fehlerLog: string[] = [];
let lauscht = false;
function fehlerSammeln() {
  if (lauscht || typeof window === "undefined") return;
  lauscht = true;
  const merken = (text: string) => {
    fehlerLog.push(`${new Date().toLocaleTimeString("de-AT")} ${location.pathname}: ${text}`.slice(0, 300));
    if (fehlerLog.length > MAX_FEHLER) fehlerLog.shift();
  };
  window.addEventListener("error", (e) => merken(e.message || "Fehler"));
  window.addEventListener("unhandledrejection", (e) => merken(e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Fehler")));
}

async function verkleinern(file: File): Promise<Blob> {
  try {
    const bild = await createImageBitmap(file);
    const f = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bild.width * f);
    canvas.height = Math.round(bild.height * f);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
    bild.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // the browser cannot read this picture: the server decides
    return file;
  }
}

export function FeedbackButton({ variant = "rund" }: { variant?: "rund" | "zeile" | "tafel" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // the layout has the button twice (phone header and side bar), so the title needs its own id
  const titel = useId();
  const datei = useRef<HTMLInputElement>(null);
  const [art, setArt] = useState<(typeof ARTEN)[number]["value"]>("fehler");
  const [text, setText] = useState("");
  const [bild, setBild] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [zustand, setZustand] = useState<"bereit" | "sendet" | "danke">("bereit");
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(fehlerSammeln, []);
  useEffect(() => {
    if (!bild) return setVorschau(null);
    const url = URL.createObjectURL(bild);
    setVorschau(url);
    return () => URL.revokeObjectURL(url);
  }, [bild]);
  useEffect(() => {
    if (zustand !== "danke") return;
    const id = setTimeout(() => {
      dialog.current?.close();
      setZustand("bereit");
    }, 1600);
    return () => clearTimeout(id);
  }, [zustand]);

  const oeffnen = () => {
    setFehler(null);
    if (zustand === "danke") setZustand("bereit");
    dialog.current?.showModal();
  };

  const senden = async () => {
    if (zustand === "sendet") return;
    if (text.trim().length < 2) {
      setFehler("Bitte kurz schreiben, was los ist.");
      return;
    }
    setZustand("sendet");
    setFehler(null);
    const form = new FormData();
    form.set("art", art);
    form.set("text", text);
    form.set("seite", location.pathname + location.search);
    form.set("bildschirm", `${window.innerWidth}×${window.innerHeight}`);
    form.set("modus", document.documentElement.dataset.theme === "dark" ? "dunkel" : "hell");
    form.set("browser", navigator.userAgent + (navigator.maxTouchPoints > 1 ? " Touch" : ""));
    form.set("fehler", JSON.stringify(fehlerLog));
    if (bild) form.set("bild", await verkleinern(bild), "screenshot.jpg");
    try {
      const res = await fetch("/feedback/senden", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Senden ging nicht. Bitte noch einmal versuchen.");
      setText("");
      setBild(null);
      setArt("fehler");
      setZustand("danke");
    } catch (e) {
      setFehler(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Keine Verbindung. Dein Text bleibt hier, bitte gleich noch einmal senden.");
      setZustand("bereit");
    }
  };

  return (
    <>
      {variant === "tafel" ? (
        <button type="button" className="wb-btn" onClick={oeffnen} aria-label="Feedback senden" title="Feedback: Was stört dich oder was fehlt?">
          <MessageSquarePlus size={18} strokeWidth={2} aria-hidden />
        </button>
      ) : variant === "zeile" ? (
        <button
          type="button"
          onClick={oeffnen}
          title="Was stört dich oder was fehlt?"
          className="drueck flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink"
        >
          <MessageSquarePlus size={18} strokeWidth={2} aria-hidden /> Feedback senden
        </button>
      ) : (
        <button
          type="button"
          onClick={oeffnen}
          aria-label="Feedback senden"
          title="Feedback: Was stört dich oder was fehlt?"
          className="drueck flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          <MessageSquarePlus size={18} strokeWidth={2} aria-hidden />
        </button>
      )}

      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,520px)] rounded-[24px] bg-surface p-0 text-ink backdrop:bg-black/50"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-labelledby={titel}
      >
        {zustand === "danke" ? (
          <div className="dialog-karte flex flex-col items-center gap-3 px-6 py-10 text-center" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-wash text-green">
              <Check size={24} strokeWidth={2.5} aria-hidden />
            </span>
            <p className="text-[17px] font-semibold">Danke, ist angekommen.</p>
          </div>
        ) : (
          <form
            className="dialog-karte flex flex-col gap-4 px-5 pt-4 pb-5 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              void senden();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={titel} className="text-[18px] font-semibold">
                Feedback
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => dialog.current?.close()}>
                <X size={14} aria-hidden /> Schließen
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Art">
              {ARTEN.map((a) => (
                <label
                  key={a.value}
                  className="flex min-h-[40px] cursor-pointer items-center rounded-full border border-line bg-surface px-3.5 text-[14px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent"
                >
                  <input type="radio" name="art" value={a.value} checked={art === a.value} onChange={() => setArt(a.value)} className="sr-only" />
                  {a.label}
                </label>
              ))}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[14px] font-medium">Was stört dich oder was fehlt?</span>
              <textarea
                className="input min-h-[132px] resize-y text-[15px] leading-relaxed"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void senden();
                }}
                maxLength={4000}
                autoFocus
                placeholder="z. B. Beim Speichern springt die Seite nach oben."
              />
            </label>

            {vorschau ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob URL) */}
                <img src={vorschau} alt="Angehängter Screenshot" className="h-16 w-24 rounded-lg border border-line object-cover" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBild(null)}>
                  <X size={14} aria-hidden /> Bild entfernen
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary self-start" onClick={() => datei.current?.click()}>
                <ImagePlus size={16} aria-hidden /> Screenshot anhängen
              </button>
            )}
            <input
              ref={datei}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                setBild(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />

            {fehler && (
              <p className="rounded-lg bg-red-wash px-3 py-2 text-[14px] text-red" role="alert">
                {fehler}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[12.5px] text-ink-3">Seite und Gerät gehen automatisch mit.</p>
              <button type="submit" className="btn btn-primary ml-auto" disabled={zustand === "sendet"}>
                {zustand === "sendet" ? "Sendet …" : "Senden"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
