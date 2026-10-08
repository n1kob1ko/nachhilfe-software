"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Maximize2, X } from "lucide-react";

type Props = {
  /** QR code as SVG markup, made on the server from `url` */
  svg: string;
  url: string;
  code: string;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // no clipboard API on plain http in the local network: copy through a hidden text field
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

/** QR code to the tablet page, with the address as text, "Vergrößern" and "Link kopieren". */
export function PairQr({ svg, url, code }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      {/* tapping the code enlarges it too; the button below is the accessible way */}
      <div
        role="img"
        aria-label={`QR-Code zu ${url}`}
        onClick={() => dialog.current?.showModal()}
        className="w-[200px] max-w-full cursor-zoom-in rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        data-testid="pair-qr"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-center text-[14px] font-semibold sm:text-left">
        Tablet-Kamera öffnen und QR-Code scannen
      </p>
      <p
        className="text-center text-[13px] break-all text-ink-2 sm:text-left"
        data-testid="pair-url"
      >
        {url}
      </p>
      <div className="flex w-full flex-wrap justify-center gap-2 sm:flex-col sm:items-stretch">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => dialog.current?.showModal()}
        >
          <Maximize2 size={16} aria-hidden /> QR-Code vergrößern
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => setCopied((await copyText(url)) ? "ok" : "fail")}
        >
          {copied === "ok" ? (
            <Check size={16} aria-hidden />
          ) : (
            <Copy size={16} aria-hidden />
          )}
          {copied === "ok" ? "Kopiert" : "Link kopieren"}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied === "ok"
          ? "Link kopiert"
          : copied === "fail"
            ? "Kopieren nicht möglich"
            : ""}
      </p>
      {copied === "fail" && (
        <p className="text-[13px] text-ink-2">
          Kopieren ging nicht. Bitte den Link oben markieren.
        </p>
      )}

      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,620px)] rounded-[24px] bg-surface p-0 text-ink backdrop:bg-black/60"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label="QR-Code groß"
      >
        <div className="flex flex-col items-center gap-4 px-6 pt-4 pb-7">
          <button
            type="button"
            className="btn btn-secondary self-end"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <X size={16} aria-hidden /> Schließen
          </button>
          <div
            role="img"
            aria-label={`QR-Code zu ${url}`}
            className="w-[min(78vw,62vh,520px)] rounded-2xl bg-white p-4 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-[16px] font-semibold">
            Tablet-Kamera öffnen und QR-Code scannen
          </p>
          <p className="text-[15px] text-ink-2">
            Danach den Code eingeben:{" "}
            <span className="num font-semibold tracking-[0.12em] text-ink">
              {code}
            </span>
          </p>
        </div>
      </dialog>
    </div>
  );
}
