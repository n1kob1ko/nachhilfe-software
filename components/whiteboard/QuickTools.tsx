"use client";

import { useState } from "react";

export type QuickTool = "stift" | "marker" | "radierer" | "text" | "hand" | "auswahl" | "linie" | "pfeil" | "rechteck" | "kreis" | "laser";

const COLORS = [
  { name: "Schwarz", value: "#1e1e1e" },
  { name: "Blau", value: "#1f4fd1" },
  { name: "Rot", value: "#e03131" },
  { name: "Grün", value: "#2f9e44" },
];
const WIDTHS = [
  { name: "dünn", value: 1, dot: 4 },
  { name: "mittel", value: 2, dot: 7 },
  { name: "dick", value: 4, dot: 11 },
];

type Props = {
  teacher: boolean;
  tool: QuickTool;
  onTool: (t: QuickTool, style?: { color?: string; width?: number }) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
};

/**
 * Big, thumb-sized tool bar at the bottom of the board. Students get only what they need to write,
 * mark and erase; teachers additionally get shapes, selection and the laser pointer.
 */
export function QuickTools({ teacher, tool, onTool, onUndo, onRedo, onFit }: Props) {
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(2);
  const pen = (c = color, w = width) => onTool("stift", { color: c, width: w });
  const shape = (t: QuickTool) => onTool(t, { color, width });

  const Btn = ({ id, label, icon, onClick }: { id?: QuickTool; label: string; icon: React.ReactNode; onClick: () => void }) => (
    <button type="button" className={`wb-tool ${id && tool === id ? "wb-tool-on" : ""}`} onClick={onClick} aria-label={label} aria-pressed={id ? tool === id : undefined} title={label}>
      {icon}
      <span className="wb-tool-label">{label}</span>
    </button>
  );

  return (
    <div className="wb-quick" role="toolbar" aria-label="Werkzeuge">
      <div className="wb-quick-group">
        <Btn id="stift" label="Stift" onClick={() => pen()} icon={<PenIcon color={color} />} />
        <Btn id="marker" label="Marker" onClick={() => onTool("marker")} icon={<MarkerIcon />} />
        <Btn id="radierer" label="Radierer" onClick={() => onTool("radierer")} icon={<EraserIcon />} />
        <Btn id="text" label="Text" onClick={() => shape("text")} icon={<span className="text-[22px] font-semibold leading-none">T</span>} />
        <Btn id="hand" label="Verschieben" onClick={() => onTool("hand")} icon={<HandIcon />} />
      </div>
      {(tool === "stift" || (teacher && ["linie", "pfeil", "rechteck", "kreis", "text"].includes(tool))) && (
        <div className="wb-quick-group" aria-label="Farbe und Stärke">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`wb-swatch ${color === c.value ? "wb-swatch-on" : ""}`}
              style={{ background: c.value }}
              aria-label={c.name}
              aria-pressed={color === c.value}
              onClick={() => {
                setColor(c.value);
                tool === "stift" ? pen(c.value) : onTool(tool, { color: c.value, width });
              }}
            />
          ))}
          <span className="wb-sep" aria-hidden />
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              className={`wb-width ${width === w.value ? "wb-width-on" : ""}`}
              aria-label={`Strich ${w.name}`}
              aria-pressed={width === w.value}
              onClick={() => {
                setWidth(w.value);
                tool === "stift" ? pen(color, w.value) : onTool(tool, { color, width: w.value });
              }}
            >
              <span style={{ width: w.dot, height: w.dot }} />
            </button>
          ))}
        </div>
      )}
      {teacher && (
        <div className="wb-quick-group">
          <Btn id="auswahl" label="Auswählen" onClick={() => onTool("auswahl")} icon={<SelectIcon />} />
          <Btn id="linie" label="Linie" onClick={() => shape("linie")} icon={<svg viewBox="0 0 24 24" className="wb-ico"><path d="M4 20 20 4" /></svg>} />
          <Btn id="pfeil" label="Pfeil" onClick={() => shape("pfeil")} icon={<svg viewBox="0 0 24 24" className="wb-ico"><path d="M4 20 20 4M11 4h9v9" /></svg>} />
          <Btn id="rechteck" label="Rechteck" onClick={() => shape("rechteck")} icon={<svg viewBox="0 0 24 24" className="wb-ico"><rect x="4" y="6" width="16" height="12" rx="1" /></svg>} />
          <Btn id="kreis" label="Kreis" onClick={() => shape("kreis")} icon={<svg viewBox="0 0 24 24" className="wb-ico"><circle cx="12" cy="12" r="8" /></svg>} />
          <Btn id="laser" label="Zeigen" onClick={() => onTool("laser")} icon={<svg viewBox="0 0 24 24" className="wb-ico"><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>} />
        </div>
      )}
      <div className="wb-quick-group">
        <Btn label="Rückgängig" onClick={onUndo} icon={<svg viewBox="0 0 24 24" className="wb-ico"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>} />
        <Btn label="Wiederholen" onClick={onRedo} icon={<svg viewBox="0 0 24 24" className="wb-ico"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>} />
        <Btn label="Alles zeigen" onClick={onFit} icon={<svg viewBox="0 0 24 24" className="wb-ico"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>} />
      </div>
    </div>
  );
}

function PenIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="wb-ico">
      <path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />
      <circle cx="19" cy="19" r="3" fill={color} stroke="none" />
    </svg>
  );
}
function MarkerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wb-ico">
      <path d="M3 21h8" stroke="#fcc419" strokeWidth="4" />
      <path d="m9 15 7-7 3 3-7 7H9v-3z" />
    </svg>
  );
}
function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wb-ico">
      <path d="m7 21-4-4a2 2 0 0 1 0-3l10-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3L12 21H7z" />
      <path d="M21 21H12M8 10l7 7" />
    </svg>
  );
}
function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wb-ico">
      <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}
function SelectIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wb-ico">
      <path d="M5 3l14 8-6 2-2 6-6-16z" />
    </svg>
  );
}
