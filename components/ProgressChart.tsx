"use client";

import { useId, useMemo, useState } from "react";

type Series = { label: string; points: { at: number; mastery: number | null }[] };

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const W = 720;
const H = 260;
const M = { top: 16, right: 170, bottom: 30, left: 40 };

/** Mastery over time, one line per topic. Crosshair tooltip, direct end labels, table fallback. */
export function ProgressChart({ series }: { series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  const xs = series[0]?.points.map((p) => p.at) ?? [];
  const n = xs.length;
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.top + (1 - v) * ih;

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let pen = false;
        s.points.forEach((p, i) => {
          if (p.mastery === null) {
            pen = false;
            return;
          }
          d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.mastery).toFixed(1)}`;
          pen = true;
        });
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series],
  );

  // end labels: last known value, pushed apart only when they would overlap (with leader lines)
  const ends = series
    .map((s, i) => {
      const last = [...s.points].reverse().find((p) => p.mastery !== null);
      return last ? { i, label: s.label, v: last.mastery!, y: y(last.mastery!) } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 16) ends[k] = { ...ends[k], y: ends[k - 1].y + 16 };

  const fmt = (t: number) => new Date(t).toLocaleDateString("de-AT", { day: "numeric", month: "short" });

  if (n === 0 || series.length === 0) return <p className="text-[14px] text-ink-2">Noch nicht genug Daten für einen Verlauf.</p>;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1)))));
  };

  return (
    <figure className="m-0">
      <figcaption id={titleId} className="sr-only">
        Beherrschung pro Thema im Zeitverlauf
      </figcaption>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2" aria-label="Legende">
          {series.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2">
              <svg width="16" height="4" aria-hidden>
                <line x1="0" y1="2" x2="16" y2="2" stroke={COLORS[i]} strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={titleId}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="#e7e2d6" strokeWidth="1" />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)" className="num">
                {Math.round(v * 100)}
              </text>
            </g>
          ))}
          {xs.map((t, i) =>
            i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
              <text key={t} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                {i === n - 1 ? "heute" : fmt(t)}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--ink-3)" strokeWidth="1" />}
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={COLORS[i]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s, i) => {
            const idx = hover ?? n - 1;
            const p = s.points[idx];
            if (!p || p.mastery === null) return null;
            return <circle key={s.label} cx={x(idx)} cy={y(p.mastery)} r="4.5" fill={COLORS[i]} stroke="var(--surface)" strokeWidth="2" />;
          })}
          {ends.map((e) => {
            const lastIdx = n - 1;
            const ly = y(e.v);
            return (
              <g key={e.label}>
                {Math.abs(e.y - ly) > 2 && <line x1={x(lastIdx) + 6} y1={ly} x2={x(lastIdx) + 14} y2={e.y} stroke="var(--line-strong)" strokeWidth="1" />}
                <text x={x(lastIdx) + 16} y={e.y} dy="0.32em" fontSize="12" fill="var(--ink)">
                  <tspan fontWeight="600" className="num">
                    {Math.round(e.v * 100)} %
                  </tspan>
                  <tspan fill="var(--ink-2)"> {e.label.length > 18 ? `${e.label.slice(0, 17)}…` : e.label}</tspan>
                </text>
              </g>
            );
          })}
          <rect
            x={M.left}
            y={M.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(n - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1));
            }}
            aria-label="Verlauf: mit Pfeiltasten Wochen auswählen"
          />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(27,29,35,0.12)]"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
          >
            <div className="mb-1 font-medium text-ink-2">{hover === n - 1 ? "Heute" : `Woche bis ${fmt(xs[hover])}`}</div>
            {series.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 whitespace-nowrap">
                <svg width="12" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="12" y2="2" stroke={COLORS[i]} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="num font-semibold text-ink">{s.points[hover].mastery === null ? "–" : `${Math.round(s.points[hover].mastery! * 100)} %`}</span>
                <span className="text-ink-2">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Als Tabelle anzeigen</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="num w-full text-left">
            <thead>
              <tr className="text-ink-3">
                <th className="py-1 pr-4 font-medium">Woche</th>
                {series.map((s) => (
                  <th key={s.label} className="py-1 pr-4 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xs.map((t, i) => (
                <tr key={t} className="border-t border-line">
                  <td className="py-1 pr-4">{fmt(t)}</td>
                  {series.map((s) => (
                    <td key={s.label} className="py-1 pr-4">
                      {s.points[i].mastery === null ? "–" : `${Math.round(s.points[i].mastery! * 100)} %`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
