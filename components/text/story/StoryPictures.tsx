"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Lightbulb, X } from "lucide-react";

export type StoryPictures = {
  images: { id: number; url: string }[];
  starters: string[];
  hints: string;
};

/** A picture large, with the next and previous one; Escape or the cross closes it. */
function Lightbox({ p, at, onClose, onMove }: { p: StoryPictures; at: number; onClose: () => void; onMove: (i: number) => void }) {
  const n = p.images.length;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && at < n - 1) onMove(at + 1);
      else if (e.key === "ArrowLeft" && at > 0) onMove(at - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, n, onClose, onMove]);
  const img = p.images[at];
  return (
    <div className="sp-box" role="dialog" aria-modal="true" aria-label={`Bild ${at + 1} von ${n}`} onClick={onClose} data-testid="bild-gross">
      <div className="sp-box-bar" onClick={(e) => e.stopPropagation()}>
        <span className="num text-[15px] font-semibold">
          Bild {at + 1} von {n}
        </span>
        <button type="button" className="sp-box-btn" onClick={onClose} aria-label="Schließen" autoFocus>
          <X size={22} aria-hidden />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={`Bild ${at + 1}`} className="sp-box-img" onClick={(e) => e.stopPropagation()} />
      <div className="sp-box-nav" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sp-box-btn" disabled={at === 0} onClick={() => onMove(at - 1)} aria-label="Voriges Bild">
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button type="button" className="sp-box-btn" disabled={at === n - 1} onClick={() => onMove(at + 1)} aria-label="Nächstes Bild">
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function useLightbox() {
  const [at, setAt] = useState<number | null>(null);
  const close = useCallback(() => setAt(null), []);
  return { at, open: setAt, close, move: setAt };
}

function Thumb({ url, n, onOpen, className }: { url: string; n: number; onOpen: () => void; className: string }) {
  return (
    <button type="button" className={`sp-thumb ${className}`} onClick={onOpen} aria-label={`Bild ${n} groß ansehen`} data-testid="story-bild">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} />
      <span className="sp-num num">{n}</span>
    </button>
  );
}

function Helps({ p }: { p: StoryPictures }) {
  if (!p.starters.length && !p.hints) return null;
  return (
    <div className="sp-helps" data-testid="story-hilfen">
      {p.starters.length > 0 && (
        <div>
          <p className="sp-label">Satzanfänge</p>
          <ul className="flex flex-wrap gap-1.5">
            {p.starters.map((s, i) => (
              <li key={i} className="sp-chip">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.hints && (
        <div>
          <p className="sp-label">
            <Lightbulb size={13} aria-hidden className="mr-1 inline" />
            Tipps
          </p>
          <p className="text-[14px] whitespace-pre-line text-ink-2">{p.hints}</p>
        </div>
      )}
    </div>
  );
}

/** Next to the editor on a wide screen: all pictures in order, then sentence starters and tips. */
export function StoryColumn({ p }: { p: StoryPictures }) {
  const lb = useLightbox();
  return (
    <aside className="sp-column" aria-label="Bilderfolge" data-testid="story-spalte">
      <ol className={`sp-grid ${p.images.length > 3 ? "sp-grid-2" : ""}`}>
        {p.images.map((img, i) => (
          <li key={img.id}>
            <Thumb url={img.url} n={i + 1} onOpen={() => lb.open(i)} className="sp-thumb-col" />
          </li>
        ))}
      </ol>
      <Helps p={p} />
      {lb.at !== null && <Lightbox p={p} at={lb.at} onClose={lb.close} onMove={lb.move} />}
    </aside>
  );
}

/** Above the editor on a narrow screen (tablet upright): a row of small pictures that stays visible; can be folded. */
export function StoryStrip({ p }: { p: StoryPictures }) {
  const lb = useLightbox();
  const [small, setSmall] = useState(false);
  const [helps, setHelps] = useState(false);
  const hasHelps = p.starters.length > 0 || Boolean(p.hints);
  return (
    <div className="sp-strip" aria-label="Bilderfolge" data-testid="story-leiste">
      {!small && (
        <ol className="sp-row">
          {p.images.map((img, i) => (
            <li key={img.id}>
              <Thumb url={img.url} n={i + 1} onOpen={() => lb.open(i)} className="sp-thumb-row" />
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className="sp-toggle" onClick={() => setSmall((s) => !s)} aria-expanded={!small}>
          {small ? <ChevronDown size={16} aria-hidden /> : <ChevronUp size={16} aria-hidden />} {small ? `Bilder zeigen (${p.images.length})` : "Bilder einklappen"}
        </button>
        {hasHelps && (
          <button type="button" className="sp-toggle" onClick={() => setHelps((s) => !s)} aria-expanded={helps}>
            <Lightbulb size={15} aria-hidden /> {helps ? "Hilfen ausblenden" : "Satzanfänge und Tipps"}
          </button>
        )}
      </div>
      {helps && <Helps p={p} />}
      {lb.at !== null && <Lightbox p={p} at={lb.at} onClose={lb.close} onMove={lb.move} />}
    </div>
  );
}
