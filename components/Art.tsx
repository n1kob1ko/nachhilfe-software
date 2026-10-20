/**
 * Soft, toy-like illustrations for hero cards and tiles in the logo's colours (gold, ink, cream) (drawn as SVG, no image files).
 * Each one has a key light from the top left and a contact shadow, so they read as objects
 * sitting on the card.
 */

const Shadow = ({ cx, cy, rx }: { cx: number; cy: number; rx: number }) => <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.16} fill="#221c17" opacity="0.22" />;

function Calculator() {
  const keys = Array.from({ length: 16 }, (_, i) => ({ x: 52 + (i % 4) * 26, y: 92 + Math.floor(i / 4) * 20, op: i % 4 === 3 }));
  return (
    <>
      <Shadow cx={102} cy={190} rx={74} />
      <defs>
        <linearGradient id="calc-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9cd84" />
          <stop offset="1" stopColor="#c6962e" />
        </linearGradient>
        <linearGradient id="calc-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf6ea" />
          <stop offset="1" stopColor="#e7dcc3" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 100 110)">
        <rect x="34" y="34" width="132" height="158" rx="22" fill="#9a7420" />
        <rect x="34" y="26" width="132" height="158" rx="22" fill="url(#calc-body)" />
        <rect x="50" y="42" width="100" height="36" rx="9" fill="#6b4c0b" opacity="0.35" />
        <rect x="50" y="40" width="100" height="34" rx="9" fill="url(#calc-screen)" />
        <text x="140" y="65" textAnchor="end" fontFamily="var(--font-display)" fontSize="17" fontWeight="600" fill="#584d42">
          3/4
        </text>
        {keys.map((k, i) => (
          <g key={i}>
            <rect x={k.x} y={k.y + 3} width="20" height="14" rx="5" fill={k.op ? "#8c1f18" : "#221c17"} />
            <rect x={k.x} y={k.y} width="20" height="14" rx="5" fill={k.op ? "#b3281f" : "#3b322a"} />
          </g>
        ))}
      </g>
    </>
  );
}

function Books() {
  const book = (y: number, w: number, c1: string, c2: string, tilt: number) => (
    <g transform={`rotate(${tilt} 100 ${y})`}>
      <rect x={100 - w / 2} y={y + 4} width={w} height="26" rx="6" fill={c2} />
      <rect x={100 - w / 2} y={y} width={w} height="26" rx="6" fill={c1} />
      <rect x={100 - w / 2 + 8} y={y + 6} width={w - 22} height="14" rx="3" fill="#fffaf4" opacity="0.92" />
      <rect x={100 + w / 2 - 12} y={y + 3} width="5" height="20" rx="2" fill={c2} opacity="0.5" />
    </g>
  );
  return (
    <>
      <Shadow cx={100} cy={190} rx={80} />
      {book(150, 150, "#b7d3bf", "#7fa88c", 0)}
      {book(120, 136, "#c9c3ea", "#8f88c9", -3)}
      {book(90, 142, "#e5b08f", "#b9704f", 2)}
      {book(60, 124, "#e9cd84", "#c6962e", -2)}
      <g transform="translate(118 24) rotate(18)">
        <rect x="0" y="0" width="12" height="52" rx="3" fill="#cfa24a" />
        <polygon points="0,52 12,52 6,64" fill="#f1e3c0" />
        <polygon points="4,58 8,58 6,64" fill="#221c17" />
      </g>
    </>
  );
}

function Speech() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={74} />
      <g>
        <path d="M30 50 a24 24 0 0 1 24 -24 h82 a24 24 0 0 1 24 24 v40 a24 24 0 0 1 -24 24 h-58 l-26 22 v-22 h-2 a24 24 0 0 1 -20 -24 z" fill="#8f88c9" transform="translate(0 6)" />
        <path d="M30 50 a24 24 0 0 1 24 -24 h82 a24 24 0 0 1 24 24 v40 a24 24 0 0 1 -24 24 h-58 l-26 22 v-22 h-2 a24 24 0 0 1 -20 -24 z" fill="#c9c3ea" />
        <text x="95" y="86" textAnchor="middle" fontFamily="var(--font-display)" fontSize="34" fontWeight="700" fill="#fff">
          Hi!
        </text>
      </g>
      <g transform="translate(78 98)">
        <path d="M18 28 a20 20 0 0 1 20 -20 h56 a20 20 0 0 1 20 20 v26 a20 20 0 0 1 -20 20 h-6 v18 l-22 -18 h-28 a20 20 0 0 1 -20 -20 z" fill="#c6962e" transform="translate(0 5)" />
        <path d="M18 28 a20 20 0 0 1 20 -20 h56 a20 20 0 0 1 20 20 v26 a20 20 0 0 1 -20 20 h-6 v18 l-22 -18 h-28 a20 20 0 0 1 -20 -20 z" fill="#e9cd84" />
        <text x="66" y="51" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fontWeight="700" fill="#221c17">
          Hallo
        </text>
      </g>
    </>
  );
}

function Notebook() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={70} />
      <g transform="rotate(-6 100 110)">
        <rect x="44" y="36" width="116" height="150" rx="16" fill="#9a7420" />
        <rect x="44" y="28" width="116" height="150" rx="16" fill="#cfa24a" />
        <rect x="62" y="28" width="98" height="150" rx="14" fill="#fbf6ea" />
        {[58, 78, 98, 118, 138, 158].map((y) => (
          <rect key={y} x="74" y={y} width="72" height="3" rx="1.5" fill="#e7dcc3" />
        ))}
        {[48, 72, 96, 120, 144, 168].map((y) => (
          <circle key={y} cx="53" cy={y} r="5" fill="#221c17" opacity="0.45" />
        ))}
      </g>
    </>
  );
}

export function SubjectArt({ subject, className = "" }: { subject: string | null | undefined; className?: string }) {
  const s = (subject ?? "").toLowerCase();
  const Art = s.startsWith("mathe") ? Calculator : s.startsWith("deutsch") ? Books : s.startsWith("engl") ? Speech : Notebook;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden focusable="false">
      <Art />
    </svg>
  );
}

/** Corner art for the stat tiles: a big rounded symbol that sits half outside the tile. */
export function TileArt({ kind }: { kind: "alert" | "sheet" | "target" | "calendar" }) {
  return (
    <svg viewBox="0 0 120 120" className="pointer-events-none absolute -right-3 -bottom-4 h-[92px] w-[92px]" aria-hidden focusable="false">
      {kind === "alert" && (
        <>
          <path d="M60 14 L108 100 a8 8 0 0 1 -7 12 H19 a8 8 0 0 1 -7 -12 Z" fill="#8c1f18" transform="translate(0 5)" />
          <path d="M60 14 L108 100 a8 8 0 0 1 -7 12 H19 a8 8 0 0 1 -7 -12 Z" fill="#b3281f" />
          <rect x="54" y="42" width="12" height="38" rx="6" fill="#fff" />
          <circle cx="60" cy="94" r="7" fill="#fff" />
        </>
      )}
      {kind === "sheet" && (
        <>
          <path d="M26 16 h50 l26 26 v70 a8 8 0 0 1 -8 8 H26 a8 8 0 0 1 -8 -8 V24 a8 8 0 0 1 8 -8 z" fill="#1f6b3b" transform="translate(0 5)" />
          <path d="M26 16 h50 l26 26 v70 a8 8 0 0 1 -8 8 H26 a8 8 0 0 1 -8 -8 V24 a8 8 0 0 1 8 -8 z" fill="#4e9a6b" />
          <path d="M76 16 v18 a8 8 0 0 0 8 8 h18 z" fill="#1f6b3b" />
          {[60, 76, 92].map((y) => (
            <rect key={y} x="34" y={y} width={y === 92 ? 30 : 48} height="8" rx="4" fill="#fff" />
          ))}
        </>
      )}
      {kind === "target" && (
        <>
          <circle cx="60" cy="66" r="48" fill="#9a7420" />
          <circle cx="60" cy="60" r="48" fill="#cfa24a" />
          <circle cx="60" cy="60" r="32" fill="#fff" />
          <circle cx="60" cy="60" r="18" fill="#cfa24a" />
          <circle cx="60" cy="60" r="6" fill="#fff" />
        </>
      )}
      {kind === "calendar" && (
        <>
          <rect x="12" y="26" width="96" height="88" rx="16" fill="#3b322a" transform="translate(0 5)" />
          <rect x="12" y="26" width="96" height="88" rx="16" fill="#584d42" />
          <rect x="34" y="14" width="10" height="24" rx="5" fill="#cfa24a" />
          <rect x="76" y="14" width="10" height="24" rx="5" fill="#cfa24a" />
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={28 + c * 24} y={50 + r * 20} width="16" height="12" rx="4" fill="#fff" opacity={r === 1 && c === 1 ? 1 : 0.85} />))}
        </>
      )}
    </svg>
  );
}

const AVATAR = [
  ["#f5e6c6", "#7d5a0c"],
  ["#e3e0f4", "#4a429e"],
  ["#d8ecdf", "#1f6b3b"],
  ["#f6dcd7", "#9c2f27"],
  ["#ece4d7", "#584d42"],
  ["#d9e6f5", "#2a4f86"],
];

/** Initials in a colour derived from the name, so a student always has the same avatar. */
export function Avatar({ name, size = 32, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR[h % AVATAR.length];
  return (
    <span
      className={`display inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${ring ? "ring-2 ring-surface" : ""}`}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
