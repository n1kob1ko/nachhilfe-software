/**
 * Soft, toy-like illustrations for hero cards and tiles in the logo's colours (gold, ink, cream) (drawn as SVG, no image files).
 * Each one has a key light from the top left and a contact shadow, so they read as objects
 * sitting on the card.
 */

const Shadow = ({ cx, cy, rx }: { cx: number; cy: number; rx: number }) => <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.16} fill="#151f2b" opacity="0.22" />;

function Calculator() {
  const keys = Array.from({ length: 16 }, (_, i) => ({ x: 52 + (i % 4) * 26, y: 92 + Math.floor(i / 4) * 20, op: i % 4 === 3 }));
  return (
    <>
      <Shadow cx={102} cy={190} rx={74} />
      <defs>
        <linearGradient id="calc-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9ccf8" />
          <stop offset="1" stopColor="#2f7de1" />
        </linearGradient>
        <linearGradient id="calc-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5f8fc" />
          <stop offset="1" stopColor="#dce5ef" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 100 110)">
        <rect x="34" y="34" width="132" height="158" rx="22" fill="#1d63c4" />
        <rect x="34" y="26" width="132" height="158" rx="22" fill="url(#calc-body)" />
        <rect x="50" y="42" width="100" height="36" rx="9" fill="#164f9e" opacity="0.35" />
        <rect x="50" y="40" width="100" height="34" rx="9" fill="url(#calc-screen)" />
        <text x="140" y="65" textAnchor="end" fontFamily="var(--font-display)" fontSize="17" fontWeight="600" fill="#4b5a6b">
          3/4
        </text>
        {keys.map((k, i) => (
          <g key={i}>
            <rect x={k.x} y={k.y + 3} width="20" height="14" rx="5" fill={k.op ? "#8c1f18" : "#151f2b"} />
            <rect x={k.x} y={k.y} width="20" height="14" rx="5" fill={k.op ? "#b3281f" : "#2b3a4b"} />
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
      <rect x={100 - w / 2 + 8} y={y + 6} width={w - 22} height="14" rx="3" fill="#f5f8fc" opacity="0.92" />
      <rect x={100 + w / 2 - 12} y={y + 3} width="5" height="20" rx="2" fill={c2} opacity="0.5" />
    </g>
  );
  return (
    <>
      <Shadow cx={100} cy={190} rx={80} />
      {book(150, 150, "#b7d3bf", "#7fa88c", 0)}
      {book(120, 136, "#c9c3ea", "#8f88c9", -3)}
      {book(90, 142, "#e5b08f", "#b9704f", 2)}
      {book(60, 124, "#a9ccf8", "#2f7de1", -2)}
      <g transform="translate(118 24) rotate(18)">
        <rect x="0" y="0" width="12" height="52" rx="3" fill="#5b9cf2" />
        <polygon points="0,52 12,52 6,64" fill="#dbe9fb" />
        <polygon points="4,58 8,58 6,64" fill="#151f2b" />
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
        <path d="M18 28 a20 20 0 0 1 20 -20 h56 a20 20 0 0 1 20 20 v26 a20 20 0 0 1 -20 20 h-6 v18 l-22 -18 h-28 a20 20 0 0 1 -20 -20 z" fill="#2f7de1" transform="translate(0 5)" />
        <path d="M18 28 a20 20 0 0 1 20 -20 h56 a20 20 0 0 1 20 20 v26 a20 20 0 0 1 -20 20 h-6 v18 l-22 -18 h-28 a20 20 0 0 1 -20 -20 z" fill="#a9ccf8" />
        <text x="66" y="51" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fontWeight="700" fill="#151f2b">
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
        <rect x="44" y="36" width="116" height="150" rx="16" fill="#1d63c4" />
        <rect x="44" y="28" width="116" height="150" rx="16" fill="#5b9cf2" />
        <rect x="62" y="28" width="98" height="150" rx="14" fill="#f5f8fc" />
        {[58, 78, 98, 118, 138, 158].map((y) => (
          <rect key={y} x="74" y={y} width="72" height="3" rx="1.5" fill="#dce5ef" />
        ))}
        {[48, 72, 96, 120, 144, 168].map((y) => (
          <circle key={y} cx="53" cy={y} r="5" fill="#151f2b" opacity="0.45" />
        ))}
      </g>
    </>
  );
}

// ---------- weitere Motive (niko, 21.10.2026: „gibts kein passenderes Bild? oder mehrere Bilder?“) ----------

/** Brüche: ein Kreis in Vierteln, ein Viertel herausgezogen. */
function Pie() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={72} />
      <g transform="rotate(-10 100 104)">
        {/* drei Viertel als Kreis ohne das rechte obere Viertel, das herausgezogen daneben liegt */}
        <path d="M96 104 L96 40 A64 64 0 0 0 32 104 A64 64 0 0 0 96 168 A64 64 0 0 0 160 104 Z" fill="#1d63c4" transform="translate(0 8)" />
        <path d="M96 104 L96 40 A64 64 0 0 0 32 104 A64 64 0 0 0 96 168 A64 64 0 0 0 160 104 Z" fill="#5b9cf2" />
        <path d="M96 104 L96 168 A64 64 0 0 0 160 104 Z" fill="#2f7de1" />
        <path d="M96 104 L32 104 A64 64 0 0 0 96 168 Z" fill="#a9ccf8" opacity="0.55" />
        <path d="M96 104 L96 40 A64 64 0 0 1 160 104 Z" fill="#8a5a0a" transform="translate(12 -4)" />
        <path d="M96 104 L96 40 A64 64 0 0 1 160 104 Z" fill="#f2c069" transform="translate(12 -12)" />
        <text x="58" y="100" fontFamily="var(--font-display)" fontSize="26" fontWeight="700" fill="#fff">
          ¾
        </text>
      </g>
    </>
  );
}

/** Geometrie: Dreieck mit rechtem Winkel und ein Lineal. */
function Geometry() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={76} />
      <g transform="rotate(14 100 120)">
        <rect x="22" y="138" width="156" height="30" rx="7" fill="#8a5a0a" transform="translate(0 6)" />
        <rect x="22" y="138" width="156" height="30" rx="7" fill="#f2c069" />
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x={32 + i * 11.5} y="138" width="2.5" height={i % 2 === 0 ? 12 : 7} rx="1" fill="#8a5a0a" opacity="0.8" />
        ))}
      </g>
      <polygon points="44,124 44,34 148,124" fill="#1d63c4" transform="translate(0 8)" />
      <polygon points="44,124 44,34 148,124" fill="#5b9cf2" />
      <polygon points="60,110 60,64 112,110" fill="#a9ccf8" />
      {/* rechter Winkel unten links */}
      <path d="M44 108 h16 v16" fill="none" stroke="#f5f8fc" strokeWidth="4" strokeLinejoin="round" />
    </>
  );
}

/** Gleichungen: eine Waage, links „x“, rechts ein Gewicht. */
function Balance() {
  const pan = (x: number) => (
    <g>
      <line x1={x} y1="78" x2={x} y2="118" stroke="#2b3a4b" strokeWidth="4" />
      <path d={`M${x - 34} 118 a34 10 0 0 0 68 0 z`} fill="#164f9e" transform="translate(0 5)" />
      <path d={`M${x - 34} 118 a34 10 0 0 0 68 0 z`} fill="#2f7de1" />
    </g>
  );
  return (
    <>
      <Shadow cx={100} cy={190} rx={70} />
      <rect x="70" y="162" width="60" height="18" rx="7" fill="#151f2b" />
      <rect x="70" y="156" width="60" height="18" rx="7" fill="#2b3a4b" />
      <rect x="95" y="60" width="10" height="100" rx="5" fill="#2b3a4b" />
      <g transform="rotate(-6 100 74)">
        <rect x="26" y="70" width="148" height="10" rx="5" fill="#151f2b" transform="translate(0 4)" />
        <rect x="26" y="70" width="148" height="10" rx="5" fill="#5b9cf2" />
        {pan(44)}
        {pan(156)}
        <rect x="30" y="92" width="28" height="26" rx="6" fill="#8a5a0a" transform="translate(0 4)" />
        <rect x="30" y="92" width="28" height="26" rx="6" fill="#f2c069" />
        <text x="44" y="112" textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fontWeight="700" fill="#151f2b">
          x
        </text>
        <rect x="140" y="88" width="32" height="30" rx="6" fill="#6f3d2a" transform="translate(0 4)" />
        <rect x="140" y="88" width="32" height="30" rx="6" fill="#e5b08f" />
        <text x="156" y="110" textAnchor="middle" fontFamily="var(--font-display)" fontSize="18" fontWeight="700" fill="#151f2b">
          12
        </text>
      </g>
      <circle cx="100" cy="74" r="9" fill="#f2c069" />
    </>
  );
}

/** Prozent und Zinsen: ein rundes Preisschild mit %. */
function Percent() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={66} />
      <g transform="rotate(-12 100 108)">
        <circle cx="100" cy="116" r="66" fill="#8a5a0a" />
        <circle cx="100" cy="108" r="66" fill="#f2c069" />
        <circle cx="100" cy="108" r="52" fill="#ffe6cf" />
        <text x="100" y="128" textAnchor="middle" fontFamily="var(--font-display)" fontSize="56" fontWeight="700" fill="#1d63c4">
          %
        </text>
      </g>
      <g transform="translate(132 20) rotate(20)">
        <rect x="0" y="0" width="54" height="30" rx="8" fill="#164f9e" transform="translate(0 5)" />
        <rect x="0" y="0" width="54" height="30" rx="8" fill="#2f7de1" />
        <text x="27" y="21" textAnchor="middle" fontFamily="var(--font-display)" fontSize="15" fontWeight="700" fill="#fff">
          -20
        </text>
      </g>
    </>
  );
}

/** Aufsatz und Texte: ein Blatt mit Zeilen und ein Bleistift. */
function Writing() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={70} />
      <g transform="rotate(-5 100 110)">
        <rect x="46" y="36" width="112" height="146" rx="12" fill="#dce5ef" transform="translate(0 7)" />
        <rect x="46" y="36" width="112" height="146" rx="12" fill="#f5f8fc" />
        <rect x="62" y="56" width="52" height="8" rx="4" fill="#1d63c4" />
        {[80, 98, 116, 134, 152].map((y, i) => (
          <rect key={y} x="62" y={y} width={i === 4 ? 40 : 80} height="5" rx="2.5" fill="#b3c0d1" />
        ))}
      </g>
      <g transform="translate(128 58) rotate(38)">
        <rect x="0" y="0" width="22" height="118" rx="6" fill="#8a5a0a" transform="translate(5 0)" />
        <rect x="0" y="0" width="22" height="118" rx="6" fill="#f2c069" />
        <rect x="0" y="0" width="22" height="18" rx="6" fill="#e5b08f" />
        <rect x="0" y="12" width="22" height="8" fill="#2b3a4b" />
        <polygon points="0,118 22,118 11,142" fill="#ffe6cf" />
        <polygon points="7,133 15,133 11,142" fill="#151f2b" />
      </g>
    </>
  );
}

/** Rechtschreibung, Grammatik, Wortarten: drei Buchstabenwürfel. */
function Blocks() {
  const block = (x: number, y: number, c1: string, c2: string, letter: string, tilt: number) => (
    <g transform={`rotate(${tilt} ${x + 28} ${y + 28})`}>
      <rect x={x} y={y + 7} width="56" height="56" rx="10" fill={c2} />
      <rect x={x} y={y} width="56" height="56" rx="10" fill={c1} />
      <rect x={x + 7} y={y + 7} width="42" height="42" rx="7" fill="#f5f8fc" opacity="0.9" />
      <text x={x + 28} y={y + 40} textAnchor="middle" fontFamily="var(--font-display)" fontSize="30" fontWeight="700" fill="#151f2b">
        {letter}
      </text>
    </g>
  );
  return (
    <>
      <Shadow cx={100} cy={190} rx={76} />
      {block(36, 112, "#5b9cf2", "#1d63c4", "A", -4)}
      {block(104, 116, "#f2c069", "#8a5a0a", "B", 5)}
      {block(70, 46, "#c9c3ea", "#8f88c9", "C", -8)}
    </>
  );
}

/** Bildgeschichte: drei Bilder, die sich überlappen. */
function Pictures() {
  const frame = (x: number, y: number, tilt: number, sky: string, hill: string) => (
    <g transform={`rotate(${tilt} ${x + 42} ${y + 34})`}>
      <rect x={x} y={y + 6} width="84" height="68" rx="9" fill="#dce5ef" />
      <rect x={x} y={y} width="84" height="68" rx="9" fill="#f5f8fc" />
      <rect x={x + 8} y={y + 8} width="68" height="52" rx="6" fill={sky} />
      <circle cx={x + 58} cy={y + 24} r="8" fill="#f2c069" />
      <path d={`M${x + 8} ${y + 60} q 20 -30 40 -8 q 12 -12 28 2 v6 h-68 z`} fill={hill} />
    </g>
  );
  return (
    <>
      <Shadow cx={100} cy={190} rx={78} />
      {frame(18, 96, -8, "#a9ccf8", "#7fa88c")}
      {frame(98, 100, 7, "#c9c3ea", "#b9704f")}
      {frame(58, 34, -2, "#5b9cf2", "#1f6b3b")}
    </>
  );
}

/** Erdkunde, Landeskunde, Fremdsprache: eine Weltkugel auf dem Fuß. */
function Globe() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={64} />
      <rect x="66" y="166" width="68" height="14" rx="6" fill="#151f2b" />
      <rect x="66" y="160" width="68" height="14" rx="6" fill="#2b3a4b" />
      <rect x="95" y="128" width="10" height="36" rx="4" fill="#2b3a4b" />
      <path d="M160 40 a66 66 0 0 1 0 128" fill="none" stroke="#2b3a4b" strokeWidth="8" strokeLinecap="round" transform="rotate(20 100 104)" />
      <circle cx="100" cy="110" r="60" fill="#164f9e" />
      <circle cx="100" cy="104" r="60" fill="#5b9cf2" />
      <path d="M62 86 q14 -22 36 -12 q8 10 -6 20 q-18 4 -22 18 q-14 -6 -8 -26 z" fill="#7fa88c" />
      <path d="M112 118 q22 -12 32 6 q-6 20 -24 22 q-14 -8 -8 -28 z" fill="#7fa88c" />
      <path d="M96 56 q18 -4 24 10 q-12 6 -24 0 z" fill="#b7d3bf" />
      <ellipse cx="100" cy="104" rx="26" ry="60" fill="none" stroke="#a9ccf8" strokeWidth="2" opacity="0.7" />
      <line x1="40" y1="104" x2="160" y2="104" stroke="#a9ccf8" strokeWidth="2" opacity="0.7" />
    </>
  );
}

/** Briefe und E-Mails (Writing im Englischen): ein Umschlag mit Brief. */
function Envelope() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={74} />
      <g transform="rotate(-6 100 120)">
        <rect x="30" y="70" width="140" height="100" rx="14" fill="#164f9e" transform="translate(0 7)" />
        <rect x="30" y="70" width="140" height="100" rx="14" fill="#2f7de1" />
        <rect x="46" y="38" width="108" height="92" rx="8" fill="#f5f8fc" />
        <text x="60" y="64" fontFamily="var(--font-display)" fontSize="16" fontWeight="700" fill="#1d63c4">
          Dear Sam,
        </text>
        {[78, 92, 106].map((y, i) => (
          <rect key={y} x="60" y={y} width={i === 2 ? 44 : 80} height="5" rx="2.5" fill="#b3c0d1" />
        ))}
        <path d="M30 100 v56 a14 14 0 0 0 14 14 h112 a14 14 0 0 0 14 -14 v-56 l-70 46 z" fill="#5b9cf2" />
        <path d="M30 100 l70 46 l70 -46" fill="none" stroke="#a9ccf8" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <g transform="translate(138 24) rotate(12)">
        <rect x="0" y="0" width="40" height="30" rx="5" fill="#8a5a0a" transform="translate(0 4)" />
        <rect x="0" y="0" width="40" height="30" rx="5" fill="#f2c069" />
        <rect x="6" y="6" width="28" height="18" rx="3" fill="#ffe6cf" />
      </g>
    </>
  );
}

/** Vokabeln: zwei Lernkarten, vorne Englisch, hinten Deutsch. */
function Cards() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={76} />
      <g transform="rotate(6 120 70)">
        <rect x="56" y="30" width="126" height="74" rx="12" fill="#8f88c9" transform="translate(0 6)" />
        <rect x="56" y="30" width="126" height="74" rx="12" fill="#c9c3ea" />
        <text x="119" y="76" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" fontWeight="700" fill="#151f2b">
          Katze
        </text>
      </g>
      <g transform="rotate(-6 80 140)">
        <rect x="18" y="104" width="126" height="74" rx="12" fill="#1d63c4" transform="translate(0 6)" />
        <rect x="18" y="104" width="126" height="74" rx="12" fill="#5b9cf2" />
        <text x="81" y="152" textAnchor="middle" fontFamily="var(--font-display)" fontSize="30" fontWeight="700" fill="#fff">
          cat
        </text>
        <rect x="30" y="114" width="30" height="8" rx="4" fill="#a9ccf8" />
      </g>
    </>
  );
}

/** Biologie, Chemie, Physik: ein Erlenmeyerkolben. */
function Flask() {
  return (
    <>
      <Shadow cx={100} cy={190} rx={62} />
      <g transform="rotate(-4 100 110)">
        <path d="M80 30 h40 v16 h-6 v44 l44 76 a10 10 0 0 1 -9 15 H51 a10 10 0 0 1 -9 -15 l44 -76 V46 h-6 z" fill="#b3c0d1" transform="translate(0 6)" />
        <path d="M80 30 h40 v16 h-6 v44 l44 76 a10 10 0 0 1 -9 15 H51 a10 10 0 0 1 -9 -15 l44 -76 V46 h-6 z" fill="#dce5ef" />
        <path d="M64 136 l-22 38 a10 10 0 0 0 9 7 h98 a10 10 0 0 0 9 -7 l-22 -38 z" fill="#7fa88c" />
        <path d="M70 126 q30 -14 60 0 l6 10 h-72 z" fill="#b7d3bf" />
        <circle cx="90" cy="150" r="6" fill="#f5f8fc" opacity="0.8" />
        <circle cx="112" cy="160" r="4" fill="#f5f8fc" opacity="0.8" />
        <circle cx="100" cy="142" r="3" fill="#f5f8fc" opacity="0.8" />
        <rect x="76" y="24" width="48" height="12" rx="5" fill="#f2c069" />
      </g>
    </>
  );
}

type Motiv = () => React.JSX.Element;
/** Motive je Fach: das erste ist das Standardbild, die übrigen kommen über das Thema oder den Schüler dran. */
const MOTIVE: Record<"mathe" | "deutsch" | "englisch" | "sonst", Motiv[]> = {
  mathe: [Calculator, Pie, Geometry, Balance, Percent],
  deutsch: [Books, Writing, Blocks, Pictures],
  englisch: [Speech, Cards, Envelope, Globe],
  sonst: [Notebook, Flask, Globe],
};
/** Stichwort im Thema → Motiv. Erste Übereinstimmung gewinnt. */
const THEMEN: [RegExp, Motiv][] = [
  [/dividier|division|multiplizier|multiplikation|addier|subtrah|rechnen|einmaleins|kopfrechn/, Calculator],
  [/bruch|brüche|bruchrechn|dezimal/, Pie],
  [/geometr|dreieck|fläche|winkel|umfang|körper|pythagor|kreis|viereck|rechteck/, Geometry],
  [/gleichung|variable|terme|formel|lineare/, Balance],
  [/prozent|zins|promille|rabatt/, Percent],
  [/brief|e-mail|email|letter|postcard|postkarte/, Envelope],
  [/aufsatz|erzähl|erlebnis|bericht|beschreib|interpretation|zusammenfassung|inhaltsangabe|text|schreiben|writing|essay|brief|e-mail|email/, Writing],
  [/rechtschreib|grammatik|wortart|satzglied|satzlehre|groß|beistrich|komma|fälle|zeiten|tenses|spelling/, Blocks],
  [/bildgeschichte|comic/, Pictures],
  [/vokabel|vocab|wortschatz/, Cards],
  [/landeskunde|länder|geograf|erdkunde|welt|culture|klima/, Globe],
  [/chemie|physik|biolog|experiment|versuch|zelle|stoff|energie/, Flask],
];

/**
 * Das Bild zur Bühne: Fach, dazu das aktuelle Thema (Stichwort) oder, ohne Treffer, ein
 * Motiv je Schüler (`seed`), damit nicht immer der Rechner zu sehen ist (niko, 21.10.2026).
 */
export function SubjectArt({ subject, topic, seed, className = "" }: { subject: string | null | undefined; topic?: string | null; seed?: number | null; className?: string }) {
  const s = (subject ?? "").toLowerCase();
  const fach = s.startsWith("mathe") ? "mathe" : s.startsWith("deutsch") ? "deutsch" : s.startsWith("engl") ? "englisch" : "sonst";
  const liste = MOTIVE[fach];
  const t = (topic ?? "").toLowerCase();
  const thema = t ? THEMEN.find(([re, m]) => re.test(t) && (liste.includes(m) || fach === "sonst"))?.[1] : undefined;
  const Art = thema ?? liste[seed ? Math.abs(seed) % liste.length : 0];
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
          <circle cx="60" cy="66" r="48" fill="#1d63c4" />
          <circle cx="60" cy="60" r="48" fill="#5b9cf2" />
          <circle cx="60" cy="60" r="32" fill="#fff" />
          <circle cx="60" cy="60" r="18" fill="#5b9cf2" />
          <circle cx="60" cy="60" r="6" fill="#fff" />
        </>
      )}
      {kind === "calendar" && (
        <>
          <rect x="12" y="26" width="96" height="88" rx="16" fill="#2b3a4b" transform="translate(0 5)" />
          <rect x="12" y="26" width="96" height="88" rx="16" fill="#4b5a6b" />
          <rect x="34" y="14" width="10" height="24" rx="5" fill="#5b9cf2" />
          <rect x="76" y="14" width="10" height="24" rx="5" fill="#5b9cf2" />
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={28 + c * 24} y={50 + r * 20} width="16" height="12" rx="4" fill="#fff" opacity={r === 1 && c === 1 ? 1 : 0.85} />))}
        </>
      )}
    </svg>
  );
}

const AVATAR = [
  ["#dbe9fb", "#164f9e"],
  ["#e3e0f4", "#4a429e"],
  ["#d8ecdf", "#1f6b3b"],
  ["#f6dcd7", "#9c2f27"],
  ["#ece4d7", "#4b5a6b"],
  ["#fbf0d6", "#8a5a0a"],
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
