import type { WorkArea as Area } from "@/lib/arbeitsblatt";
import { LINE_MM } from "@/lib/arbeitsblatt";

/** A coordinate system on 5 mm squares, 1 unit = 1 cm, axes through the middle. */
function Coordinates({ sizeMm }: { sizeMm: number }) {
  const half = Math.floor(sizeMm / 20) * 10;
  const size = half * 2;
  const grid = [];
  for (let v = 0; v <= size; v += 5) {
    const major = (v - half) % 10 === 0;
    grid.push(
      <line
        key={`v${v}`}
        x1={v}
        y1={0}
        x2={v}
        y2={size}
        className={major ? "ab-grid-major" : "ab-grid"}
      />,
    );
    grid.push(
      <line
        key={`h${v}`}
        x1={0}
        y1={v}
        x2={size}
        y2={v}
        className={major ? "ab-grid-major" : "ab-grid"}
      />,
    );
  }
  const labels = [];
  for (let u = -half / 10; u <= half / 10; u++) {
    if (u === 0) continue;
    labels.push(
      <text
        key={`x${u}`}
        x={half + u * 10}
        y={half + 4.2}
        textAnchor="middle"
        className="ab-axis-label"
      >
        {u < 0 ? `−${-u}` : u}
      </text>,
      <text
        key={`y${u}`}
        x={half - 1.4}
        y={half - u * 10 + 1.1}
        textAnchor="end"
        className="ab-axis-label"
      >
        {u < 0 ? `−${-u}` : u}
      </text>,
    );
  }
  return (
    <svg
      className="ab-coords"
      width={`${size}mm`}
      height={`${size}mm`}
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      role="img"
      aria-label="Koordinatensystem"
    >
      {grid}
      <line x1={0} y1={half} x2={size + 1.5} y2={half} className="ab-axis" />
      <line x1={half} y1={size} x2={half} y2={-1.5} className="ab-axis" />
      <path
        d={`M ${size + 1.5} ${half} l -2 -1 v 2 z M ${half} -1.5 l -1 2 h 2 z`}
        className="ab-arrow"
      />
      <text
        x={size - 1}
        y={half - 1.5}
        textAnchor="end"
        className="ab-axis-name"
      >
        x
      </text>
      <text x={half + 1.5} y={1.5} className="ab-axis-name">
        y
      </text>
      {labels}
    </svg>
  );
}

// CSS px per mm: the patterns are drawn as vector lines, so they print even without background graphics
const PX = 96 / 25.4;

export function WorkField({ area }: { area: Area }) {
  if (area.kind === "koordinaten")
    return <Coordinates sizeMm={area.heightMm} />;
  const height =
    area.kind === "liniert"
      ? Math.max(1, Math.round(area.heightMm / LINE_MM)) * LINE_MM
      : area.heightMm;
  const id = `ab-pattern-${area.kind}`;
  return (
    <div className={`ab-area ab-area-${area.kind}`}>
      <svg width="100%" height={`${height}mm`} aria-hidden>
        {area.kind === "kariert" && (
          <defs>
            <pattern
              id={id}
              width={5 * PX}
              height={5 * PX}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${5 * PX} 0 V ${5 * PX} M 0 ${5 * PX} H ${5 * PX}`}
                className="ab-grid-line"
              />
            </pattern>
          </defs>
        )}
        {area.kind === "liniert" && (
          <defs>
            <pattern
              id={id}
              width={10}
              height={LINE_MM * PX}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M 0 ${LINE_MM * PX - 0.5} H 10`}
                className="ab-rule-line"
              />
            </pattern>
          </defs>
        )}
        {area.kind !== "leer" && (
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        )}
      </svg>
    </div>
  );
}

/** Writing lines; the first one may carry a label such as "Ergebnis:". */
export function Lines({
  count,
  label,
}: {
  count: number;
  label?: string | null;
}) {
  return (
    <div className="ab-lines" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ab-line" style={{ height: `${LINE_MM}mm` }}>
          {i === 0 && label && <span className="ab-line-label">{label}</span>}
        </div>
      ))}
    </div>
  );
}
