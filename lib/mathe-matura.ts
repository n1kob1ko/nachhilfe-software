/**
 * Mathematik-Matura ohne KI: eigene Aufgaben in den Antwortformaten der schriftlichen AHS-Matura
 * (1 aus 5, 2 aus 5, Lückentext zum Ankreuzen und Zuordnung, lib/matura-formate.ts) für 15 Fähigkeiten
 * der Oberstufe: quadratische Funktionen, Scheitelform, Verschieben von Graphen, exponentielles Wachstum,
 * Halbwertszeit, Logarithmus, arithmetische und geometrische Folgen, Änderungsrate, Potenzregel,
 * Monotonie, Binomialverteilung, mehrstufige Zufallsversuche und Stammfunktionen.
 *
 * Nichts ist aus dem Aufgabenpool, aus Maturen, aus Schulbüchern oder vom IQS übernommen: die Aussagen
 * entstehen aus Zufallszahlen, die falschen Antworten aus typischen Fehlern (die Bezeichnungen wie in
 * lib/themen/mathe-oberstufe.ts).
 *
 * Jede Aussage und jeder Satzteil hat eine Probe, die seine Wahrheit aus dem angezeigten Text neu
 * ausrechnet: Terme liest lib/math-expr.ts, Ableitungen werden numerisch gebildet, Wahrscheinlichkeiten
 * durch Abzählen der Pfade oder der Binomialverteilung. Eine Aufgabe entsteht nur, wenn alle Proben
 * stimmen (stoffFehler); lib/mathe-matura.test.ts prüft über viele Zufallszahlen, dass das schon die
 * rohen Stoffe tun.
 */
import type { Difficulty } from "./curriculum";
import { doppelt, MATURA_AUFTRAG, MATURA_KATEGORIEN, type MaturaKategorie } from "./matura-formate";
import { evaluate, parseExpr } from "./math-expr";
import { linear, pick, rint, STUFE, zahl, type Rng, type Stufe } from "./schulbuch-zahlen";
import { buchstabe, GAP, kreisZahl, type TaskDraft } from "./tasks";

// ---------- Aussagen und Stoffe ----------

/** Eine Aussage oder ein Satzteil: der Text, ob er stimmt, der typische Fehler dahinter und die Probe. */
export type Aussage = {
  text: string;
  wahr: boolean;
  /** Der typische Fehler, aus dem eine falsche Aussage entsteht (für die Fehlerliste der Aufgabe). */
  fehler?: string;
  /** Aussagen derselben Gruppe kommen nie zusammen in eine Aufgabe („nach oben offen“ und „nach unten offen“). */
  gruppe?: string;
  /** Rechnet aus dem angezeigten Text nach, ob die Aussage stimmt. */
  probe: () => boolean;
};

/** Stoff für 1 aus 5 und 2 aus 5: mindestens zwei richtige und vier falsche Aussagen. */
export type WahlStoff = { stamm: string; aussagen: Aussage[]; loesung: string; hilfen: string[]; auftrag?: [string, string] };
/** Stoff für den Lückentext: ein Satz mit zwei Lücken, je drei Satzteile, genau einer richtig. */
export type LueckenStoff = {
  stamm: string;
  satz: string;
  luecken: [Aussage[], Aussage[]];
  loesung: string;
  hilfen: string[];
  /** Ob der ganze Satz mit Satzteil i und j stimmt; ohne: beide Satzteile müssen stimmen. */
  probe?: (i: number, j: number) => boolean;
};
/** Stoff für die Zuordnung: Antwort 0 passt zu Aussage 0, Antwort 1 zu Aussage 1, 2 und 3 zu keiner. */
export type ZuordnungStoff = {
  stamm: string;
  auftrag?: string;
  aussagen: [string, string];
  antworten: { text: string; fehler?: string; fuer?: number }[];
  /** Rechnet nach, ob Antwort k zu Aussage i passt. */
  passt: (i: number, k: number) => boolean;
  loesung: string;
  hilfen: string[];
};
export type MaturaArt = "wahl" | "luecke" | "zuordnung";
type Stoff = { wahl: WahlStoff; luecke: LueckenStoff; zuordnung: ZuordnungStoff };
type Faehigkeit = { [A in MaturaArt]: (rng: Rng, st: Stufe) => Stoff[A] | null };

const ja = (text: string, probe: () => boolean, gruppe?: string): Aussage => ({ text, wahr: true, probe, gruppe });
const nein = (text: string, fehler: string | undefined, probe: () => boolean, gruppe?: string): Aussage => ({ text, wahr: false, fehler, probe, gruppe });
const teil = (text: string, wahr: boolean, probe: () => boolean, fehler?: string): Aussage => ({ text, wahr, probe, fehler });

/** Zwei Aussagen mit je ihrer richtigen und einer falschen Antwort; `passt` rechnet mit den Bedeutungen. */
type Paar<A, B> = { aussage: string; a: A; richtig: { text: string; b: B }; falsch: { text: string; b: B; fehler?: string } };
function zuordnen<A, B>(
  rng: Rng,
  paare: [Paar<A, B>, Paar<A, B>],
  passt: (a: A, b: B) => boolean,
  rest: Pick<ZuordnungStoff, "stamm" | "loesung" | "hilfen" | "auftrag"> & { fest?: boolean },
): ZuordnungStoff {
  // fest: die Aussagen heißen f₁ und f₂ und bleiben in dieser Reihenfolge
  const { fest, ...stoff } = rest;
  const [p, q] = fest ? paare : mischen(rng, paare);
  const antworten = [p.richtig, q.richtig, { ...p.falsch, fuer: 0 }, { ...q.falsch, fuer: 1 }];
  return {
    ...stoff,
    aussagen: [p.aussage, q.aussage],
    antworten: antworten.map((x) => ({ text: x.text, ...("fehler" in x && x.fehler ? { fehler: x.fehler, fuer: x.fuer } : {}) })),
    passt: (i, k) => passt([p, q][i].a, antworten[k].b),
  };
}

// ---------- Rechnen für die Proben ----------

type F = (x: number) => number;
const STELLEN = [-2.7, -1.3, -0.4, 0.6, 1.7, 2.9];

/** Eine Funktion aus ihrem angezeigten Term, erst beim ersten Aufruf gelesen. */
function fn(term: string, v = "x"): F {
  let node: ReturnType<typeof parseExpr> | undefined;
  return (x) => {
    if (node === undefined) node = parseExpr(term, { vars: [v] });
    if (!node) throw new Error(`Term nicht lesbar: ${term}`);
    return evaluate(node, { [v]: x });
  };
}

/** Gleich bis auf Rundungsfehler (relativ, mindestens absolut). */
const nahe = (a: number, b: number, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const abl = (f: F, x: number) => (f(x + 1e-4) - f(x - 1e-4)) / 2e-4;
const abl2 = (f: F, x: number) => (f(x + 1e-3) - 2 * f(x) + f(x - 1e-3)) / 1e-6;
const gleicheFunktion = (f: F, g: F) => STELLEN.every((x) => nahe(f(x), g(x)));
/** g ist die Ableitung von f (numerisch an mehreren Stellen). */
const istAbleitung = (g: F, f: F) => STELLEN.every((x) => nahe(abl(f, x), g(x), 1e-5));

/**
 * Der Wert eines angezeigten Ausdrucks: Zahlen, Brüche, Potenzen, Wurzeln (lib/math-expr.ts) und dazu
 * ln(…), lg(…) und log₂(…), auch ineinander. Unlesbares gibt NaN.
 */
function rechne(text: string, env: Record<string, number> = {}): number {
  const m = /(ln|lg|log([₀-₉]+))\(/.exec(text);
  if (!m) {
    const node = parseExpr(text, { vars: Object.keys(env) });
    return node ? evaluate(node, env) : NaN;
  }
  const start = m.index + m[0].length;
  let tiefe = 1;
  let ende = -1;
  for (let i = start; i < text.length && ende < 0; i++) {
    if (text[i] === "(") tiefe++;
    else if (text[i] === ")" && --tiefe === 0) ende = i;
  }
  if (ende < 0) return NaN;
  const basis = m[1] === "ln" ? Math.E : m[1] === "lg" ? 10 : Number([...m[2]].map((z) => "₀₁₂₃₄₅₆₇₈₉".indexOf(z)).join(""));
  const v = Math.log(rechne(text.slice(start, ende), env)) / Math.log(basis);
  // mit Beistrich: ein Punkt mit Dreiergruppen wäre für den Leser eine Tausenderzahl
  const ersatz = Number.isFinite(v) ? `(${v.toFixed(13).replace(".", ",")})` : "(1/0)";
  return rechne(text.slice(0, m.index) + ersatz + text.slice(ende + 1), env);
}
/** Eine Gleichung „links = rechts“ stimmt (mit Werten für die Buchstaben). */
const gleichung = (text: string, env: Record<string, number> = {}) => {
  const [l, r] = text.split(" = ");
  return nahe(rechne(l, env), rechne(r, env));
};

/** Scheitel einer quadratischen Funktion aus drei Funktionswerten, ohne ihre Koeffizienten zu kennen. */
function scheitelVon(f: F): { x: number; y: number } {
  const a = (f(1) + f(-1) - 2 * f(0)) / 2;
  const x = -(f(1) - f(-1)) / 2 / (2 * a);
  return { x, y: f(x) };
}
const offen = (f: F, richtung: "oben" | "unten") => {
  const s = scheitelVon(f);
  return richtung === "oben" ? f(s.x + 50) > s.y && f(s.x - 50) > s.y : f(s.x + 50) < s.y && f(s.x - 50) < s.y;
};
/** f ist zwischen a und b streng monoton (an 40 Stellen nachgesehen). */
function streng(f: F, a: number, b: number, art: "steigend" | "fallend"): boolean {
  const ys = Array.from({ length: 41 }, (_, i) => f(a + ((b - a) * i) / 40));
  return ys.every((y, i) => i === 0 || (art === "steigend" ? y > ys[i - 1] : y < ys[i - 1]));
}
const lokal = (f: F, x: number, art: "Maximum" | "Minimum") => (art === "Maximum" ? f(x) > f(x - 0.01) && f(x) > f(x + 0.01) : f(x) < f(x - 0.01) && f(x) < f(x + 0.01));
const wendestelle = (f: F, x: number) => Math.abs(abl2(f, x)) < 1e-3 && abl2(f, x - 0.1) * abl2(f, x + 0.1) < 0;

// ---------- Texte ----------

/** Ein Polynom aus [Koeffizient, Hochzahl], wie im Schulbuch: „2x^3 − 3x^2 + 6x − 1“. */
type Term = [number, number];
function poly(terms: Term[], v = "x"): string {
  const summe = new Map<number, number>();
  for (const [c, e] of terms) summe.set(e, (summe.get(e) ?? 0) + c);
  const ts = [...summe].filter(([, c]) => Math.abs(c) > 1e-12).sort((a, b) => b[0] - a[0]);
  if (!ts.length) return "0";
  return ts
    .map(([e, c], i) => {
      const pot = e === 0 ? "" : e === 1 ? v : `${v}^${e}`;
      const k = wert(Math.abs(c));
      const koef = e === 0 ? k : k === "1" ? "" : k.includes("/") ? `${k} · ` : k;
      return `${c < 0 ? (i ? " − " : "−") : i ? " + " : ""}${koef}${pot}`;
    })
    .join("");
}
const pWert = (terms: Term[], x: number) => terms.reduce((s, [c, e]) => s + c * x ** e, 0);
const pAbl = (terms: Term[]): Term[] => terms.filter(([, e]) => e > 0).map(([c, e]) => [c * e, e - 1]);

/** Eine Zahl als Text: mit höchstens vier Nachkommastellen als Dezimalzahl, sonst als Bruch („7/3“). */
function wert(x: number): string {
  for (let d = 1; d <= 2000; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n - x * d) > 1e-9 * Math.max(1, Math.abs(x * d))) continue;
    if (10000 % d === 0) return zahl(n / d);
    return `${n < 0 ? "−" : ""}${Math.abs(n)}/${d}`;
  }
  return zahl(x);
}
const tief = (n: number) => [...String(n)].map((z) => "₀₁₂₃₄₅₆₇₈₉"[Number(z)]).join("");
/** „+ 3“ oder „− 3“ hinter einem Term. */
const plusMinus = (x: number) => `${x < 0 ? "−" : "+"} ${zahl(Math.abs(x))}`;
/** Ein Punkt „(2 | −3)“. */
const punkt = (x: number, y: number) => `(${zahl(x)} | ${zahl(y)})`;
function punktAus(text: string): { x: number; y: number } {
  const m = /\(([^|]+)\|([^)]+)\)/.exec(text);
  return m ? { x: rechne(m[1].trim()), y: rechne(m[2].trim()) } : { x: NaN, y: NaN };
}

function nz(rng: Rng, min: number, max: number): number {
  for (;;) {
    const x = rint(rng, min, max);
    if (x !== 0) return x;
  }
}
function mischen<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const verschieden = (...xs: number[]) => xs.every((x, i) => xs.every((y, j) => i === j || !nahe(x, y, 1e-9)));

// ---------- Funktionen ----------

const OFFEN_FEHLER = "Das Vorzeichen von a falsch gedeutet";
function offenAussagen(f: F, oben: boolean): Aussage[] {
  return (["oben", "unten"] as const).map((r) =>
    (r === "oben") === oben ? ja(`Der Graph von f ist nach ${r} offen.`, () => offen(f, r), "offen") : nein(`Der Graph von f ist nach ${r} offen.`, OFFEN_FEHLER, () => offen(f, r), "offen"),
  );
}

function quadratisch(rng: Rng, st: Stufe) {
  const a = pick(rng, st <= 1 ? [1, -1, 2, -2] : [1, -1, 2, -2, 3, -3, 0.5, -0.5]);
  const xs = nz(rng, -4, 4);
  const b = -2 * a * xs;
  const c = nz(rng, -9, 9);
  return { a, xs, b, c, term: poly([[a, 2], [b, 1], [c, 0]]) };
}
const QUADRATISCH_HILFEN = ["f(0) gibt den Schnittpunkt mit der y-Achse.", "Ist a positiv, ist die Parabel nach oben offen, sonst nach unten.", "Die x-Koordinate des Scheitelpunkts ist −b/(2a)."];

const FUNKTIONEN_QUADRATISCH: Faehigkeit = {
  wahl: (rng, st) => {
    const { a, xs, b, c, term } = quadratisch(rng, st);
    const k1 = rint(rng, 1, 3);
    const k2 = -rint(rng, 1, 3);
    if (b === c) return null;
    const f = fn(term);
    const v1 = a * k1 * k1 + b * k1 + c;
    const v2 = -a * k2 * k2 + b * k2 + c; // (−2)² als −4 gerechnet
    const D = b * b - 4 * a * c;
    const zwei = D > 0;
    return {
      stamm: `Gegeben ist die quadratische Funktion f mit f(x) = ${term}.`,
      aussagen: [
        ja(`Der Graph von f schneidet die y-Achse im Punkt (0 | ${zahl(c)}).`, () => nahe(f(0), c), "y"),
        nein(`Der Graph von f schneidet die y-Achse im Punkt (0 | ${zahl(b)}).`, "b statt c für den Schnittpunkt mit der y-Achse genommen", () => nahe(f(0), b), "y"),
        ...offenAussagen(f, a > 0),
        ja(`Der Scheitelpunkt von f hat die x-Koordinate ${zahl(xs)}.`, () => nahe(scheitelVon(f).x, xs)),
        nein(`Der Scheitelpunkt von f hat die x-Koordinate ${zahl(-xs)}.`, "Bei x = −b/(2a) das Minus vergessen", () => nahe(scheitelVon(f).x, -xs)),
        ja(`Es gilt f(${k1}) = ${zahl(v1)}.`, () => nahe(f(k1), v1)),
        nein(`Es gilt f(${zahl(k2)}) = ${zahl(v2)}.`, "Das Quadrat einer negativen Zahl negativ gerechnet", () => nahe(f(k2), v2)),
        {
          text: "Die Funktion f hat zwei Nullstellen.",
          wahr: zwei,
          fehler: zwei ? undefined : "Die Anzahl der Nullstellen nicht mit der Diskriminante geprüft",
          // zwei Nullstellen, wenn der Scheitel auf der anderen Seite der x-Achse liegt, als die Parabel offen ist
          probe: () => {
            const s = scheitelVon(f);
            return !nahe(s.y, 0, 1e-9) && (offen(f, "oben") ? s.y < 0 : s.y > 0);
          },
        },
      ],
      loesung: [
        `f(0) = ${zahl(c)}, der Graph schneidet die y-Achse in (0 | ${zahl(c)}).`,
        `a = ${zahl(a)} ist ${a > 0 ? "positiv: nach oben offen" : "negativ: nach unten offen"}. Scheitelstelle: x = −b/(2a) = ${zahl(xs)}.`,
        `f(${k1}) = ${zahl(v1)}, f(${zahl(k2)}) = ${zahl(a * k2 * k2 + b * k2 + c)}. Diskriminante b^2 − 4ac = ${zahl(D)}, also ${D > 0 ? "zwei Nullstellen" : D === 0 ? "eine Nullstelle" : "keine Nullstelle"}.`,
      ].join("\n"),
      hilfen: QUADRATISCH_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { a, xs, term } = quadratisch(rng, st);
    const f = fn(term);
    const stelle = (x: number) => () => nahe(scheitelVon(f).x, x);
    return {
      stamm: `Gegeben ist die quadratische Funktion f mit f(x) = ${term}.`,
      satz: `Der Graph von f ist ${GAP} und hat seinen Scheitelpunkt ${GAP}.`,
      luecken: [
        [
          teil("nach oben offen", a > 0, () => offen(f, "oben"), a > 0 ? undefined : OFFEN_FEHLER),
          teil("nach unten offen", a < 0, () => offen(f, "unten"), a < 0 ? undefined : OFFEN_FEHLER),
          teil("eine Gerade", false, () => nahe(f(2) - 2 * f(1) + f(0), 0) && nahe(f(5) - 2 * f(4) + f(3), 0), "Eine quadratische Funktion für linear gehalten"),
        ],
        [
          teil(`an der Stelle x = ${zahl(xs)}`, true, stelle(xs)),
          teil(`an der Stelle x = ${zahl(-xs)}`, false, stelle(-xs), "Bei x = −b/(2a) das Minus vergessen"),
          teil(`an der Stelle x = ${zahl(2 * xs)}`, false, stelle(2 * xs), "Durch a statt durch 2a dividiert"),
        ],
      ],
      loesung: `a = ${zahl(a)} ist ${a > 0 ? "positiv: nach oben offen" : "negativ: nach unten offen"}. Scheitelstelle: x = −b/(2a) = ${zahl(xs)}.`,
      hilfen: QUADRATISCH_HILFEN.slice(1),
    };
  },
  zuordnung: (rng, st) => {
    const { a, xs, b, c, term } = quadratisch(rng, st);
    if (!verschieden(c, xs, b, -xs)) return null;
    const f = fn(term);
    const groesse = { f0: () => f(0), sx: () => scheitelVon(f).x };
    return zuordnen(
      rng,
      [
        { aussage: "der Funktionswert von f an der Stelle 0", a: "f0" as const, richtig: { text: zahl(c), b: zahl(c) }, falsch: { text: zahl(b), b: zahl(b), fehler: "b statt c für den Schnittpunkt mit der y-Achse genommen" } },
        { aussage: "die x-Koordinate des Scheitelpunkts von f", a: "sx" as const, richtig: { text: zahl(xs), b: zahl(xs) }, falsch: { text: zahl(-xs), b: zahl(-xs), fehler: "Bei x = −b/(2a) das Minus vergessen" } },
      ],
      (g: keyof typeof groesse, text: string) => nahe(groesse[g](), rechne(text)),
      {
        stamm: `Gegeben ist die quadratische Funktion f mit f(x) = ${term}.`,
        loesung: `f(0) = ${zahl(c)}; a = ${zahl(a)}, b = ${zahl(b)}, Scheitelstelle x = −b/(2a) = ${zahl(xs)}.`,
        hilfen: [QUADRATISCH_HILFEN[0], QUADRATISCH_HILFEN[2]],
      },
    );
  },
};

/** f(x) = a · (x − d)^2 + e, wie in der Scheitelform geschrieben. */
function scheitelTerm(a: number, d: number, e: number): string {
  const k = a === 1 ? "" : a === -1 ? "−" : `${zahl(a)} · `;
  return `${k}(x ${plusMinus(-d)})^2 ${plusMinus(e)}`;
}
function scheitelZahlen(rng: Rng, st: Stufe) {
  const a = pick(rng, st <= 1 ? [1, -1, 2, -2] : [1, -1, 2, -2, 3, -3, 0.5, -0.5]);
  const d = nz(rng, -5, 5);
  const e = nz(rng, -9, 9);
  return { a, d, e, term: scheitelTerm(a, d, e) };
}
const SCHEITEL_HILFEN = ["In f(x) = a · (x − d)^2 + e ist der Scheitelpunkt S = (d | e).", "Achtung beim Vorzeichen: (x + 3) heißt d = −3.", "Ist a positiv, ist e der kleinste Funktionswert."];
const istScheitel = (f: F, x: number, y: number) => {
  const s = scheitelVon(f);
  return nahe(s.x, x) && nahe(s.y, y);
};

const FUNKTIONEN_SCHEITEL: Faehigkeit = {
  wahl: (rng, st) => {
    const { a, d, e, term } = scheitelZahlen(rng, st);
    if (!verschieden(d, e, -e)) return null;
    const f = fn(term);
    const ext = a > 0 ? "kleinste" : "größte";
    const extrem = (y: number) => () => offen(f, a > 0 ? "oben" : "unten") && nahe(scheitelVon(f).y, y);
    const f0 = a * d * d + e;
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      aussagen: [
        ja(`Der Scheitelpunkt von f ist S = ${punkt(d, e)}.`, () => istScheitel(f, d, e)),
        nein(`Der Scheitelpunkt von f ist S = ${punkt(-d, e)}.`, "Vorzeichen in der Scheitelform falsch gelesen", () => istScheitel(f, -d, e)),
        nein(`Der Scheitelpunkt von f ist S = ${punkt(e, d)}.`, "x- und y-Koordinate vertauscht", () => istScheitel(f, e, d)),
        ...offenAussagen(f, a > 0),
        ja(`Der ${ext} Funktionswert von f ist ${zahl(e)}.`, extrem(e)),
        nein(`Der ${ext} Funktionswert von f ist ${zahl(d)}.`, "Die x-Koordinate des Scheitelpunkts als Funktionswert genommen", extrem(d)),
        ja(`Es gilt f(0) = ${zahl(f0)}.`, () => nahe(f(0), f0)),
        nein(`Es gilt f(0) = ${zahl(e)}.`, "Bei f(0) nur den Summanden e genommen", () => nahe(f(0), e)),
      ],
      loesung: `S = ${punkt(d, e)}, a = ${zahl(a)} ${a > 0 ? "> 0: nach oben offen, der kleinste" : "< 0: nach unten offen, der größte"} Funktionswert ist ${zahl(e)}.\nf(0) = ${zahl(a)} · ${zahl(d * d)} ${plusMinus(e)} = ${zahl(f0)}.`,
      hilfen: SCHEITEL_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { a, d, e, term } = scheitelZahlen(rng, st);
    if (d === e) return null;
    const f = fn(term);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      satz: `Der Graph von f hat den Scheitelpunkt ${GAP} und ist ${GAP}.`,
      luecken: [
        [
          teil(`S = ${punkt(d, e)}`, true, () => istScheitel(f, d, e)),
          teil(`S = ${punkt(-d, e)}`, false, () => istScheitel(f, -d, e), "Vorzeichen in der Scheitelform falsch gelesen"),
          teil(`S = ${punkt(e, d)}`, false, () => istScheitel(f, e, d), "x- und y-Koordinate vertauscht"),
        ],
        [
          teil("nach oben offen", a > 0, () => offen(f, "oben"), a > 0 ? undefined : OFFEN_FEHLER),
          teil("nach unten offen", a < 0, () => offen(f, "unten"), a < 0 ? undefined : OFFEN_FEHLER),
          teil("symmetrisch zur y-Achse", false, () => nahe(f(1), f(-1)) && nahe(f(2), f(-2)), "Jede Parabel für symmetrisch zur y-Achse gehalten"),
        ],
      ],
      loesung: `S = ${punkt(d, e)}; a = ${zahl(a)} ${a > 0 ? "> 0: nach oben offen" : "< 0: nach unten offen"}. Symmetrisch ist der Graph zur Geraden x = ${zahl(d)}, nicht zur y-Achse.`,
      hilfen: SCHEITEL_HILFEN.slice(0, 2),
    };
  },
  zuordnung: (rng, st) => {
    const z1 = scheitelZahlen(rng, st);
    const z2 = scheitelZahlen(rng, st);
    const punkte = [punkt(z1.d, z1.e), punkt(z2.d, z2.e), punkt(-z1.d, z1.e), punkt(-z2.d, z2.e)];
    if (doppelt(punkte)) return null;
    const funktion = (z: typeof z1, i: number) => ({ text: `f${tief(i)}(x) = ${z.term}`, f: fn(z.term) });
    const paar = (z: typeof z1, i: number): Paar<F, string> => ({
      aussage: funktion(z, i).text,
      a: funktion(z, i).f,
      richtig: { text: `S = ${punkt(z.d, z.e)}`, b: punkt(z.d, z.e) },
      falsch: { text: `S = ${punkt(-z.d, z.e)}`, b: punkt(-z.d, z.e), fehler: "Vorzeichen in der Scheitelform falsch gelesen" },
    });
    return zuordnen(
      rng,
      [paar(z1, 1), paar(z2, 2)],
      (f, p) => {
        const s = punktAus(p);
        return istScheitel(f, s.x, s.y);
      },
      {
        stamm: "Gegeben sind zwei quadratische Funktionen in Scheitelform.",
        fest: true,
        auftrag: "Ordne den zwei Funktionen jeweils ihren Scheitelpunkt aus A bis D zu.",
        loesung: `f₁: S = ${punkt(z1.d, z1.e)}, f₂: S = ${punkt(z2.d, z2.e)}.`,
        hilfen: SCHEITEL_HILFEN.slice(0, 2),
      },
    );
  },
};

/** Eine Funktion ohne Symmetrie, an der jede Verschiebung sichtbar wird (für die Proben). */
const PROBE_F = "x^3 − 2x^2 + x + 3";
/** Setzt für f(…) in einem Term von g den Term einer Funktion ein: „f(x − 3) + 2“ → „((x − 3)^3 − …) + 2“. */
const einsetzen = (g: string, f: string) => g.replace(/f\(([^()]*)\)/g, (_, arg: string) => `(${f.replace(/x/g, `(${arg})`)})`);
/** g(x) = f(x − s) + w, so geschrieben: „f(x − 3) + 2“, „f(x + 1)“, „f(x) − 4“. */
const gTerm = (s: number, w: number) => `f(x${s ? ` ${plusMinus(-s)}` : ""})${w ? ` ${plusMinus(w)}` : ""}`;
const waagrecht = (s: number) => `${zahl(Math.abs(s))} nach ${s > 0 ? "rechts" : "links"}`;
const senkrecht = (w: number) => `${zahl(Math.abs(w))} nach ${w > 0 ? "oben" : "unten"}`;
const istVerschiebung = (g: F, f: F, s: number, w: number) => STELLEN.every((x) => nahe(g(x), f(x - s) + w));
const RICHTUNG_FEHLER = (s: number) => (s > 0 ? "Bei f(x − c) nach links statt nach rechts verschoben" : "Bei f(x + c) nach rechts statt nach links verschoben");
const HOEHE_FEHLER = "Nach oben und nach unten verwechselt";
const TAUSCH_FEHLER = "f(x) + c und f(x + c) verwechselt";
const VERSCHIEBEN_HILFEN = ["f(x − c) verschiebt den Graphen um c nach rechts, f(x + c) nach links.", "f(x) + c verschiebt den Graphen um c nach oben."];

const FUNKTIONEN_VERSCHIEBEN: Faehigkeit = {
  wahl: (rng) => {
    const h = nz(rng, -5, 5);
    const v = nz(rng, -5, 5);
    if (Math.abs(h) === Math.abs(v)) return null;
    const x0 = nz(rng, -4, 4);
    const y0 = nz(rng, -4, 6);
    const g = gTerm(h, v);
    const K = fn(PROBE_F);
    const gK = fn(einsetzen(g, PROBE_F));
    // eine Funktion mit genau diesem Hochpunkt
    const gH = fn(einsetzen(g, scheitelTerm(-1, x0, y0)));
    const hoch = (x: number, y: number) => () => offen(gH, "unten") && istScheitel(gH, x, y);
    const satz = (s: number, w: number) => `Der Graph von g entsteht aus dem Graphen von f durch Verschiebung um ${waagrecht(s)} und um ${senkrecht(w)}.`;
    const tausch = [Math.sign(h) * Math.abs(v), Math.sign(v) * Math.abs(h)] as const;
    return {
      stamm: `Der Graph der Funktion f hat den Hochpunkt H = ${punkt(x0, y0)}. Für die Funktion g gilt g(x) = ${g}.`,
      aussagen: [
        ja(satz(h, v), () => istVerschiebung(gK, K, h, v)),
        nein(satz(-h, v), RICHTUNG_FEHLER(h), () => istVerschiebung(gK, K, -h, v)),
        nein(satz(...tausch), TAUSCH_FEHLER, () => istVerschiebung(gK, K, ...tausch)),
        ja(`Der Graph von g hat den Hochpunkt ${punkt(x0 + h, y0 + v)}.`, hoch(x0 + h, y0 + v)),
        nein(`Der Graph von g hat den Hochpunkt ${punkt(x0 - h, y0 + v)}.`, RICHTUNG_FEHLER(h), hoch(x0 - h, y0 + v)),
        nein(`Der Graph von g hat den Hochpunkt ${punkt(x0 + h, y0 - v)}.`, HOEHE_FEHLER, hoch(x0 + h, y0 - v)),
        ja(`Für alle x gilt g(x ${plusMinus(h)}) = f(x) ${plusMinus(v)}.`, () => STELLEN.every((x) => nahe(gK(x + h), K(x) + v))),
      ],
      loesung: `g(x) = ${g}: um ${waagrecht(h)} und um ${senkrecht(v)} verschoben. Der Hochpunkt wandert von ${punkt(x0, y0)} nach ${punkt(x0 + h, y0 + v)}.`,
      hilfen: VERSCHIEBEN_HILFEN,
    };
  },
  luecke: (rng) => {
    const h = nz(rng, -5, 5);
    const v = nz(rng, -5, 5);
    if (Math.abs(h) === Math.abs(v)) return null;
    const g = gTerm(h, v);
    const K = fn(PROBE_F);
    const gK = fn(einsetzen(g, PROBE_F));
    // waagrecht um s: g(x) − f(x − s) ist überall gleich; senkrecht um w: g(x) = f(x − s) + w für ein ganzes s
    const nachSeite = (s: number) => () => STELLEN.every((x) => nahe(gK(x) - K(x - s), gK(0) - K(-s)));
    const nachOben = (w: number) => () => Array.from({ length: 21 }, (_, i) => i - 10).some((s) => istVerschiebung(gK, K, s, w));
    const hs = Math.sign(h);
    const vs = Math.sign(v);
    return {
      stamm: `Für die Funktionen f und g gilt g(x) = ${g}.`,
      satz: `Der Graph von g entsteht aus dem Graphen von f durch Verschiebung um ${GAP} und um ${GAP}.`,
      luecken: [
        [
          teil(waagrecht(h), true, nachSeite(h)),
          teil(waagrecht(-h), false, nachSeite(-h), RICHTUNG_FEHLER(h)),
          teil(waagrecht(hs * Math.abs(v)), false, nachSeite(hs * Math.abs(v)), TAUSCH_FEHLER),
        ],
        [
          teil(senkrecht(v), true, nachOben(v)),
          teil(senkrecht(-v), false, nachOben(-v), HOEHE_FEHLER),
          teil(senkrecht(vs * Math.abs(h)), false, nachOben(vs * Math.abs(h)), TAUSCH_FEHLER),
        ],
      ],
      loesung: `g(x) = ${g}: um ${waagrecht(h)} und um ${senkrecht(v)}.`,
      hilfen: VERSCHIEBEN_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const K = fn(PROBE_F);
    type Abb = { text: string; f: F };
    const schieb = (s: number, w: number): Abb => ({ text: `Verschiebung um ${s ? waagrecht(s) : senkrecht(w)}`, f: (x) => K(x - s) + w });
    const SPIEGEL_X: Abb = { text: "Spiegelung an der x-Achse", f: (x) => -K(x) };
    const SPIEGEL_Y: Abb = { text: "Spiegelung an der y-Achse", f: (x) => K(-x) };
    const c1 = nz(rng, -6, 6);
    const c2 = nz(rng, -6, 6);
    const paar = (rechts: string, richtig: Abb, falsch: Abb, fehler: string, i: number): Paar<F, F> => ({
      aussage: `g${tief(i)}(x) = ${rechts}`,
      a: fn(einsetzen(rechts, PROBE_F)),
      richtig: { text: richtig.text, b: richtig.f },
      falsch: { text: falsch.text, b: falsch.f, fehler },
    });
    const zweite =
      st >= 3 && rng() < 0.5
        ? rng() < 0.5
          ? paar("−f(x)", SPIEGEL_X, SPIEGEL_Y, "−f(x) und f(−x) verwechselt", 2)
          : paar("f(−x)", SPIEGEL_Y, SPIEGEL_X, "−f(x) und f(−x) verwechselt", 2)
        : paar(gTerm(0, c2), schieb(0, c2), schieb(0, -c2), HOEHE_FEHLER, 2);
    const erste = paar(gTerm(c1, 0), schieb(c1, 0), schieb(-c1, 0), RICHTUNG_FEHLER(c1), 1);
    return zuordnen(rng, [erste, zweite], (g, e) => gleicheFunktion(g, e), {
      stamm: "Die Funktionen g₁ und g₂ entstehen aus der Funktion f.",
      fest: true,
      auftrag: "Ordne den zwei Funktionen jeweils die passende Veränderung des Graphen von f aus A bis D zu.",
      loesung: `${erste.aussage}: ${erste.richtig.text}. ${zweite.aussage}: ${zweite.richtig.text}.`,
      hilfen: [...VERSCHIEBEN_HILFEN, "−f(x) spiegelt an der x-Achse, f(−x) an der y-Achse."],
    });
  },
};

// ---------- Wachstum ----------

const WACHSTUM_HILFEN = ["Bei N(t) = N₀ · a^t ist a der Faktor, um den sich der Bestand jedes Jahr ändert.", "a = 1 + p/100 heißt Zunahme um p %, a = 1 − p/100 Abnahme um p %."];
/** Der Bestand ändert sich jedes Jahr um q % (q negativ: Abnahme). */
const prozentProJahr = (N: F, q: number) => [0, 1, 2, 3].every((t) => nahe(N(t + 1) / N(t), 1 + q / 100));
const prozentText = (q: number) => `nimmt pro Jahr um ${zahl(Math.abs(q))} % ${q > 0 ? "zu" : "ab"}`;
function wachstumZahlen(rng: Rng) {
  const N0 = pick(rng, [100, 200, 400, 500, 800, 1000, 2000, 5000]);
  const p = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25]);
  const zu = rng() < 0.5;
  const a = zu ? 1 + p / 100 : 1 - p / 100;
  return { N0, p, zu, a, q: zu ? p : -p, term: `${N0} · ${zahl(a)}^t` };
}

const WACHSTUM_EXPONENTIELL: Faehigkeit = {
  wahl: (rng) => {
    const { N0, p, zu, a, q, term } = wachstumZahlen(rng);
    const N = fn(term, "t");
    const [t1, t2] = mischen(rng, [2, 3]);
    const w1 = N0 * a ** t1;
    const w2 = N0 * (1 + (t2 * q) / 100);
    return {
      stamm: `Ein Bestand wird durch N(t) = ${term} beschrieben (t in Jahren).`,
      aussagen: [
        ja(`Der Bestand ${prozentText(q)}.`, () => prozentProJahr(N, q)),
        nein(`Der Bestand ${prozentText(Math.sign(q) * a * 100)}.`, "Den Wachstumsfaktor als Prozentsatz gelesen", () => prozentProJahr(N, Math.sign(q) * a * 100)),
        ja(`Nach ${t1} Jahren beträgt der Bestand ${zahl(w1)}.`, () => nahe(N(t1), w1)),
        nein(`Nach ${t2} Jahren beträgt der Bestand ${zahl(w2)}.`, "Wie linear gerechnet", () => nahe(N(t2), w2)),
        ja("Der Bestand ändert sich jedes Jahr um denselben Faktor.", () => [1, 2, 3].every((t) => nahe(N(t + 1) / N(t), N(1) / N(0))), "art"),
        nein("Der Bestand ändert sich jedes Jahr um denselben Betrag.", "Wie linear gerechnet", () => [1, 2, 3].every((t) => nahe(N(t + 1) - N(t), N(1) - N(0))), "art"),
        ja(`Zu Beginn beträgt der Bestand ${zahl(N0)}.`, () => nahe(N(0), N0), "start"),
        nein(`Zu Beginn beträgt der Bestand ${zahl(N0 * a)}.`, "Den Bestand nach einem Jahr als Anfangswert genommen", () => nahe(N(0), N0 * a), "start"),
      ],
      loesung: `a = ${zahl(a)} = 1 ${zu ? "+" : "−"} ${zahl(p / 100)}: Der Bestand ${prozentText(q)}, jedes Jahr um denselben Faktor.\nN(0) = ${N0}, N(${t1}) = ${N0} · ${zahl(a)}^${t1} = ${zahl(w1)}, N(${t2}) = ${zahl(N0 * a ** t2)}.`,
      hilfen: WACHSTUM_HILFEN,
    };
  },
  luecke: (rng) => {
    const { p, zu, a, q, term } = wachstumZahlen(rng);
    const N = fn(term, "t");
    const faktor = (x: number) => () => [0, 1, 2].every((t) => nahe(N(t + 1) / N(t), x));
    const prozent = (x: number) => () => prozentProJahr(N, zu ? x : -x);
    return {
      stamm: `Ein Bestand wird durch N(t) = ${term} beschrieben (t in Jahren).`,
      satz: `Der Bestand ändert sich jedes Jahr um den Faktor ${GAP}, er nimmt also pro Jahr um ${GAP} ${zu ? "zu" : "ab"}.`,
      luecken: [
        [
          teil(zahl(a), true, faktor(a)),
          teil(zahl(2 - a), false, faktor(2 - a), "Zunahme und Abnahme verwechselt"),
          teil(zahl(p / 100), false, faktor(p / 100), zu ? "Nur p/100 statt 1 + p/100 genommen" : "Bei Abnahme mit p/100 statt mit 1 − p/100 multipliziert"),
        ],
        [
          teil(`${p} %`, true, prozent(p)),
          teil(`${zahl(a * 100)} %`, false, prozent(a * 100), "Den Wachstumsfaktor als Prozentsatz gelesen"),
          teil(`${zahl(p / 100)} %`, false, prozent(p / 100), "Den Prozentsatz als Dezimalzahl geschrieben und % dazugesetzt"),
        ],
      ],
      loesung: `a = ${zahl(a)} = 1 ${zu ? "+" : "−"} ${zahl(p / 100)}, der Bestand ${prozentText(q)}.`,
      hilfen: WACHSTUM_HILFEN,
    };
  },
  zuordnung: (rng) => {
    const p1 = pick(rng, [2, 3, 4, 5, 8, 10, 15, 20]);
    const p2 = pick(rng, [2, 3, 4, 5, 8, 10, 15, 20]);
    if (p1 === p2) return null;
    const N0 = pick(rng, [100, 200, 500, 1000]);
    const paar = (q: number, falsch: number, fehler: string, i: number): Paar<F, number> => {
      const term = `${N0} · ${zahl(1 + q / 100)}^t`;
      return { aussage: `N${tief(i)}(t) = ${term}`, a: fn(term, "t"), richtig: { text: `Der Bestand ${prozentText(q)}.`, b: q }, falsch: { text: `Der Bestand ${prozentText(falsch)}.`, b: falsch, fehler } };
    };
    const zu = (i: number) => paar(p1, 100 + p1, "Den Wachstumsfaktor als Prozentsatz gelesen", i);
    const ab = (i: number) => paar(-p2, p2, "Zunahme und Abnahme verwechselt", i);
    return zuordnen(rng, rng() < 0.5 ? [zu(1), ab(2)] : [ab(1), zu(2)], prozentProJahr, {
      stamm: "Zwei Bestände werden durch die Funktionen N₁ und N₂ beschrieben (t in Jahren).",
      fest: true,
      auftrag: "Ordne den zwei Funktionen jeweils die passende Beschreibung aus A bis D zu.",
      loesung: `Faktor ${zahl(1 + p1 / 100)}: Zunahme um ${p1} %. Faktor ${zahl(1 - p2 / 100)}: Abnahme um ${p2} %.`,
      hilfen: WACHSTUM_HILFEN,
    });
  },
};

type Halbwert = { stoff: string; masse: string; ein: string; mehr: string; nach: string };
const HALBWERT: Halbwert[] = [
  { stoff: "Die Menge eines Medikaments im Blut", masse: "mg", ein: "Stunde", mehr: "Stunden", nach: "Stunden" },
  { stoff: "Die Masse eines radioaktiven Stoffes", masse: "g", ein: "Tag", mehr: "Tage", nach: "Tagen" },
];
const HALBWERT_HILFEN = ["Nach jeder Halbwertszeit ist nur mehr die Hälfte da.", "Nach drei Halbwertszeiten: (1/2)^3 = 1/8."];
const zeit = (n: number, k: Halbwert, fall: "mehr" | "nach") => `${n} ${n === 1 ? k.ein : k[fall]}`;

const WACHSTUM_HALBWERTSZEIT: Faehigkeit = {
  wahl: (rng) => {
    const k = pick(rng, HALBWERT);
    const N0 = pick(rng, [96, 192, 240, 480, 960]);
    const T = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
    const M = (start: number) => (t: number) => start * 0.5 ** (t / T);
    const linear = N0 / (2 * T);
    return {
      stamm: `${k.stoff} halbiert sich alle ${zeit(T, k, "mehr")}. Zu Beginn sind ${N0} ${k.masse} vorhanden.`,
      aussagen: [
        ja(`Nach ${zeit(2 * T, k, "nach")} sind noch ${zahl(N0 / 4)} ${k.masse} vorhanden.`, () => nahe(M(N0)(2 * T), N0 / 4)),
        nein(`Nach ${zeit(2 * T, k, "nach")} ist nichts mehr vorhanden.`, "Wie linear gerechnet", () => nahe(M(N0)(2 * T), 0)),
        ja(`Nach ${zeit(3 * T, k, "nach")} ist noch ein Achtel der Anfangsmenge vorhanden.`, () => nahe(M(N0)(3 * T) / N0, 1 / 8)),
        nein(`Nach ${zeit(3 * T, k, "nach")} ist noch ein Sechstel der Anfangsmenge vorhanden.`, "Durch 2 · 3 statt durch 2^3 dividiert", () => nahe(M(N0)(3 * T) / N0, 1 / 6)),
        ja(`Bei doppelter Anfangsmenge halbiert sie sich ebenfalls alle ${zeit(T, k, "mehr")}.`, () => nahe(M(2 * N0)(T) / M(2 * N0)(0), 0.5), "doppelt"),
        nein(`Bei doppelter Anfangsmenge dauert es ${zeit(2 * T, k, "mehr")}, bis sie sich halbiert.`, "Den Startwert mitgerechnet, als hinge die Halbwertszeit von ihm ab", () => nahe(M(2 * N0)(2 * T) / M(2 * N0)(0), 0.5), "doppelt"),
        nein(`Pro ${k.ein} nimmt sie um ${zahl(linear)} ${k.masse} ab.`, "Wie linear gerechnet", () => [0, 1, 2].every((t) => nahe(M(N0)(t) - M(N0)(t + 1), linear))),
      ],
      loesung: `Nach ${zeit(2 * T, k, "nach")}: ${N0} · (1/2)^2 = ${zahl(N0 / 4)} ${k.masse}. Nach ${zeit(3 * T, k, "nach")}: (1/2)^3 = 1/8 der Anfangsmenge.\nDie Halbwertszeit hängt nicht von der Anfangsmenge ab.`,
      hilfen: HALBWERT_HILFEN,
    };
  },
  luecke: (rng) => {
    const k = pick(rng, HALBWERT);
    const T = pick(rng, [2, 4, 6, 8, 10, 12]);
    // aus dem Stamm: nach 2T ist ein Viertel da, also M(t) = M₀ · (1/4)^(t/(2T))
    const anteil = (t: number) => 0.25 ** (t / (2 * T));
    const halb = (H: number) => () => nahe(anteil(H), 0.5);
    const rest = (x: number) => () => nahe(anteil(3 * T), x);
    return {
      stamm: `${k.stoff} nimmt exponentiell ab. Nach ${zeit(2 * T, k, "nach")} ist noch ein Viertel der Anfangsmenge vorhanden.`,
      satz: `Die Halbwertszeit beträgt ${GAP}, und nach ${zeit(3 * T, k, "nach")} ist noch ${GAP} der Anfangsmenge vorhanden.`,
      luecken: [
        [
          teil(zeit(T, k, "mehr"), true, halb(T)),
          teil(zeit(2 * T, k, "mehr"), false, halb(2 * T), "Die Zeit bis zu einem Viertel für die Halbwertszeit gehalten"),
          teil(zeit(T / 2, k, "mehr"), false, halb(T / 2)),
        ],
        [teil("ein Achtel", true, rest(1 / 8)), teil("ein Sechstel", false, rest(1 / 6), "Durch 2 · 3 statt durch 2^3 dividiert"), teil("ein Sechzehntel", false, rest(1 / 16), "Einmal zu oft halbiert")],
      ],
      loesung: `Ein Viertel ist die Hälfte der Hälfte: zwei Halbwertszeiten in ${zeit(2 * T, k, "nach")}, also ${zeit(T, k, "mehr")}. Nach ${zeit(3 * T, k, "nach")}: (1/2)^3 = 1/8.`,
      hilfen: HALBWERT_HILFEN,
    };
  },
  zuordnung: (rng) => {
    const k = pick(rng, HALBWERT);
    const N0 = pick(rng, [96, 192, 240, 480, 960]);
    const T = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
    const M = (t: number) => N0 * 0.5 ** (t / T);
    const menge = (x: number) => ({ text: `${zahl(x)} ${k.masse}`, b: x });
    return zuordnen(
      rng,
      [
        { aussage: `die vorhandene Menge nach ${zeit(2 * T, k, "nach")}`, a: 2 * T, richtig: menge(N0 / 4), falsch: { ...menge(N0 / 2), fehler: "Nur einmal halbiert" } },
        { aussage: `die vorhandene Menge nach ${zeit(3 * T, k, "nach")}`, a: 3 * T, richtig: menge(N0 / 8), falsch: { ...menge(N0 / 6), fehler: "Durch 2 · 3 statt durch 2^3 dividiert" } },
      ],
      (t, x) => nahe(M(t), x),
      {
        stamm: `${k.stoff} halbiert sich alle ${zeit(T, k, "mehr")}. Zu Beginn sind ${N0} ${k.masse} vorhanden.`,
        loesung: `${N0} : 4 = ${zahl(N0 / 4)} ${k.masse} und ${N0} : 8 = ${zahl(N0 / 8)} ${k.masse}.`,
        hilfen: HALBWERT_HILFEN,
      },
    );
  },
};

// ---------- Logarithmus ----------

const logText = (b: number) => `log${tief(b)}`;
const LOG_STAMM = "Für a > 0, a ≠ 1 und x > 0 ist logₐ(x) der Logarithmus von x zur Basis a.";
const LOG_HILFEN = ["logₐ(x) = y heißt a^y = x.", "logₐ(1) = 0 und logₐ(a) = 1.", "1/a^k = a^(−k)."];
const EINS_FEHLER = "logₐ(1) = 0 und logₐ(a) = 1 verwechselt";
const DURCH_BASIS = "Die Zahl durch die Basis dividiert";
const MINUS_FEHLER = "Das Minus vergessen: 1/a^k ist a^(−k)";
/** Basis und Hochzahl mit a^y ≤ 10000. */
function logPotenz(rng: Rng, st: Stufe) {
  const b = pick(rng, st <= 1 ? [2, 3, 10] : [2, 3, 5, 10]);
  const y = rint(rng, 2, b === 2 ? 6 : b === 3 ? 4 : b === 5 ? 4 : 4);
  return { b, y, x: b ** y };
}

const LOG_BEGRIFF: Faehigkeit = {
  wahl: (rng, st) => {
    const r = logPotenz(rng, st);
    const s = logPotenz(rng, st);
    if (s.b ** (s.y - 1) === s.y || (r.b === s.b && r.y === s.y)) return null;
    const [b1, b2, b3, b4, b5] = Array.from({ length: 5 }, () => pick(rng, [2, 3, 4, 5, 7, 10]));
    const k = rint(rng, 1, 3);
    const g = (text: string) => () => gleichung(text);
    const aussage = (wahr: boolean, text: string, fehler: string, gruppe: string) => (wahr ? ja(text, g(text), gruppe) : nein(text, fehler, g(text), gruppe));
    const beispiele = [[2, 3], [3, 4], [10, 2], [5, 0.5]];
    const regel = (folgt: (a: number, y: number) => number) => () => beispiele.every(([a, y]) => nahe(Math.log(folgt(a, y)) / Math.log(a), y));
    const negativ = (b: number) => () => [0.5, 0.1, 0.9].every((x) => Math.log(x) / Math.log(b) < 0);
    const VZ = "Den Logarithmus einer Zahl zwischen 0 und 1 für positiv gehalten";
    return {
      stamm: LOG_STAMM,
      aussagen: [
        ja(`${logText(r.b)}(${r.x}) = ${r.y}`, g(`${logText(r.b)}(${r.x}) = ${r.y}`)),
        nein(`${logText(s.b)}(${s.x}) = ${s.b ** (s.y - 1)}`, DURCH_BASIS, g(`${logText(s.b)}(${s.x}) = ${s.b ** (s.y - 1)}`)),
        aussage(true, `${logText(b1)}(1) = 0`, "", "eins"),
        aussage(false, `${logText(b1)}(1) = 1`, EINS_FEHLER, "eins"),
        aussage(true, `${logText(b2)}(${b2}) = 1`, "", "basis"),
        aussage(false, `${logText(b2)}(${b2}) = 0`, EINS_FEHLER, "basis"),
        aussage(true, `${logText(b3)}(1/${b3 ** k}) = −${k}`, "", "kehr"),
        aussage(false, `${logText(b3)}(1/${b3 ** k}) = ${k}`, MINUS_FEHLER, "kehr"),
        ja("Aus logₐ(x) = y folgt a^y = x.", regel((a, y) => a ** y), "regel"),
        nein("Aus logₐ(x) = y folgt y^a = x.", "Basis und Hochzahl vertauscht", regel((a, y) => y ** a), "regel"),
        ja(`Für 0 < x < 1 ist ${logText(b4)}(x) negativ.`, negativ(b4), "vz"),
        nein(`Für 0 < x < 1 ist ${logText(b5)}(x) positiv.`, VZ, () => !negativ(b5)(), "vz"),
      ],
      loesung: `${r.b}^${r.y} = ${r.x}, also ${logText(r.b)}(${r.x}) = ${r.y}; ${s.b}^${s.y} = ${s.x}, also ${logText(s.b)}(${s.x}) = ${s.y}.\nlogₐ(1) = 0, logₐ(a) = 1, logₐ(1/a^k) = −k. Für 0 < x < 1 ist der Logarithmus (Basis größer als 1) negativ.`,
      hilfen: LOG_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { b, y, x } = logPotenz(rng, st);
    if (y ** b === x || b ** (y - 1) === y) return null;
    const ist = (w: number) => () => nahe(Math.log(rechne(String(x))) / Math.log(b), w);
    const g = (text: string) => () => gleichung(text);
    const potenz = `${b}^${y} = ${x}`;
    const tausch = `${y}^${b} = ${x}`;
    const mal = `${b} · ${y} = ${x}`;
    return {
      stamm: LOG_STAMM,
      satz: `Es gilt ${logText(b)}(${x}) = ${GAP}, weil ${GAP} ist.`,
      luecken: [
        [teil(String(y), true, ist(y)), teil(String(b ** (y - 1)), false, ist(b ** (y - 1)), DURCH_BASIS), teil(String(y - 1), false, ist(y - 1))],
        [teil(potenz, true, g(potenz)), teil(tausch, false, g(tausch), "Basis und Hochzahl vertauscht"), teil(mal, false, g(mal), "Potenz und Produkt verwechselt")],
      ],
      loesung: `${potenz}, also ${logText(b)}(${x}) = ${y}.`,
      hilfen: LOG_HILFEN.slice(0, 1),
    };
  },
  zuordnung: (rng, st) => {
    const r = logPotenz(rng, st);
    if (r.b ** (r.y - 1) === r.y) return null;
    const b2 = pick(rng, [2, 3, 5, 10].filter((b) => b !== r.b));
    const k = rint(rng, 1, 3);
    const zweite: Paar<string, string> =
      st >= 2
        ? { aussage: `${logText(b2)}(1/${b2 ** k})`, a: `${logText(b2)}(1/${b2 ** k})`, richtig: { text: `−${k}`, b: `−${k}` }, falsch: { text: String(k), b: String(k), fehler: MINUS_FEHLER } }
        : { aussage: `${logText(b2)}(1)`, a: `${logText(b2)}(1)`, richtig: { text: "0", b: "0" }, falsch: { text: "1", b: "1", fehler: EINS_FEHLER } };
    const a1 = `${logText(r.b)}(${r.x})`;
    const werte = [String(r.y), zweite.richtig.text, String(r.b ** (r.y - 1)), zweite.falsch.text];
    if (doppelt(werte)) return null;
    return zuordnen(
      rng,
      [{ aussage: a1, a: a1, richtig: { text: String(r.y), b: String(r.y) }, falsch: { text: String(r.b ** (r.y - 1)), b: String(r.b ** (r.y - 1)), fehler: DURCH_BASIS } }, zweite],
      (a, b) => nahe(rechne(a), rechne(b)),
      {
        stamm: LOG_STAMM,
        auftrag: "Ordne den zwei Logarithmen jeweils ihren Wert aus A bis D zu.",
        loesung: `${r.b}^${r.y} = ${r.x}, also ${a1} = ${r.y}. ${zweite.aussage} = ${zweite.richtig.text}.`,
        hilfen: LOG_HILFEN,
      },
    );
  },
};

type LogRegel = { links: string; richtig: string; falsch: [string, string][] };
/** Rechenregeln für Logarithmen mit den Buchstaben A, B und der Hochzahl r. */
function logRegeln(L: string, A: string, B: string, r: number): Record<string, LogRegel> {
  return {
    produkt: {
      links: `${L}(${A} · ${B})`,
      richtig: `${L}(${A}) + ${L}(${B})`,
      falsch: [
        [`${L}(${A}) · ${L}(${B})`, "Den Logarithmus eines Produkts als Produkt der Logarithmen gerechnet"],
        [`${L}(${A} + ${B})`, "Produkt und Summe im Logarithmus verwechselt"],
      ],
    },
    quotient: {
      links: `${L}(${A}/${B})`,
      richtig: `${L}(${A}) − ${L}(${B})`,
      falsch: [
        [`${L}(${A}) : ${L}(${B})`, "Den Logarithmus eines Quotienten als Quotient der Logarithmen gerechnet"],
        [`${L}(${A} − ${B})`, "Quotient und Differenz im Logarithmus verwechselt"],
      ],
    },
    potenz: {
      links: `${L}(${A}^${r})`,
      richtig: `${r} · ${L}(${A})`,
      falsch: [
        [`(${L}(${A}))^${r}`, "Die Hochzahl als Potenz des Logarithmus genommen"],
        [`${L}(${r}) · ${L}(${A})`, "Auch die Hochzahl logarithmiert"],
      ],
    },
    wurzel: {
      links: `${L}(sqrt(${A}))`,
      richtig: `1/2 · ${L}(${A})`,
      falsch: [
        [`sqrt(${L}(${A}))`, "Die Wurzel vor den Logarithmus gezogen"],
        [`2 · ${L}(${A})`, "Die Wurzel als Hochzahl 2 statt 1/2 gelesen"],
      ],
    },
    kehr: {
      links: `${L}(1/${A})`,
      richtig: `−${L}(${A})`,
      falsch: [
        [`1/${L}(${A})`, "Den Kehrwert aus dem Logarithmus herausgezogen"],
        [`1 − ${L}(${A})`, `Mit ${L}(1) = 1 gerechnet`],
      ],
    },
  };
}
/** Der Satz über die Variablen: nur die, die in der Aufgabe wirklich vorkommen. */
const positiv = (A: string, B: string, texte: string[]) =>
  texte.some((t) => new RegExp(`\\b${B}\\b`).test(t)) ? `${A} und ${B} sind positive reelle Zahlen.` : `${A} ist eine positive reelle Zahl.`;
const LOG_REGELN_HILFEN = ["Der Logarithmus macht aus einem Produkt eine Summe und aus einer Potenz ein Produkt.", "Für eine Summe gibt es keine Regel."];
function logRegelZahlen(rng: Rng) {
  const L = pick(rng, ["ln", "lg"]);
  const [A, B] = pick(rng, [["a", "b"], ["u", "v"], ["x", "y"]]);
  const r = rint(rng, 2, 5);
  // positive Werte für A und B, an denen jede Gleichung nachgerechnet wird
  const beispiele = [[2, 3], [0.4, 5], [7.5, 0.6], [11, 1.7]].map(([p, q]) => ({ [A]: p, [B]: q }));
  const gilt = (l: string, rechts: string) => () => beispiele.every((env) => nahe(rechne(l, env), rechne(rechts, env)));
  return { L, A, B, r, regeln: logRegeln(L, A, B, r), gilt };
}

const LOG_REGELN: Faehigkeit = {
  wahl: (rng) => {
    const { L, A, B, regeln, gilt } = logRegelZahlen(rng);
    const summe = `${L}(${A} + ${B})`;
    const aussagen: Aussage[] = [nein(`${summe} = ${L}(${A}) + ${L}(${B})`, "Logarithmus einer Summe zerlegt", gilt(summe, `${L}(${A}) + ${L}(${B})`), "summe")];
    for (const [name, R] of Object.entries(regeln)) {
      const [f, fehler] = pick(rng, R.falsch);
      aussagen.push(ja(`${R.links} = ${R.richtig}`, gilt(R.links, R.richtig), name), nein(`${R.links} = ${f}`, fehler, gilt(R.links, f), name));
    }
    return {
      stamm: `${A} und ${B} sind positive reelle Zahlen.`,
      aussagen,
      auftrag: [`Kreuze die Gleichung an, die für alle positiven ${A} und ${B} gilt.`, `Kreuze die beiden Gleichungen an, die für alle positiven ${A} und ${B} gelten.`],
      loesung: Object.values(regeln)
        .map((R) => `${R.links} = ${R.richtig}`)
        .join("\n"),
      hilfen: LOG_REGELN_HILFEN,
    };
  },
  luecke: (rng) => {
    const { A, B, regeln, gilt } = logRegelZahlen(rng);
    const [r1, r2] = mischen(rng, ["produkt", "quotient", "potenz", "wurzel"]).map((n) => regeln[n]);
    const gruppe = (R: LogRegel): Aussage[] => [teil(R.richtig, true, gilt(R.links, R.richtig)), ...R.falsch.map(([f, fehler]) => teil(f, false, gilt(R.links, f), fehler))];
    const satz = `Es gilt ${r1.links} = ${GAP}, und es gilt ${r2.links} = ${GAP}.`;
    return {
      stamm: positiv(A, B, [satz, r1.richtig, r2.richtig, ...r1.falsch.map((f) => f[0]), ...r2.falsch.map((f) => f[0])]),
      satz,
      luecken: [gruppe(r1), gruppe(r2)],
      loesung: `${r1.links} = ${r1.richtig}\n${r2.links} = ${r2.richtig}`,
      hilfen: LOG_REGELN_HILFEN,
    };
  },
  zuordnung: (rng) => {
    const { A, B, regeln, gilt } = logRegelZahlen(rng);
    const [r1, r2] = mischen(rng, Object.values(regeln));
    const paar = (R: LogRegel): Paar<string, string> => {
      const [f, fehler] = pick(rng, R.falsch);
      return { aussage: R.links, a: R.links, richtig: { text: R.richtig, b: R.richtig }, falsch: { text: f, b: f, fehler } };
    };
    const paare: [Paar<string, string>, Paar<string, string>] = [paar(r1), paar(r2)];
    // ln(a^2) = 2 · ln(a) ist richtig, bei der Wurzel ist 2 · ln(a) der Fehler: so ein Paar geht nicht
    if (doppelt(paare.flatMap((x) => [x.richtig.text, x.falsch.text]))) return null;
    return zuordnen(rng, paare, (l, r) => gilt(l, r)(), {
      stamm: positiv(A, B, paare.flatMap((x) => [x.aussage, x.richtig.text, x.falsch.text])),
      auftrag: "Ordne den zwei Termen jeweils einen gleichwertigen Term aus A bis D zu.",
      loesung: `${r1.links} = ${r1.richtig}\n${r2.links} = ${r2.richtig}`,
      hilfen: LOG_REGELN_HILFEN,
    });
  },
};

// ---------- Folgen ----------

/** Das n-te Glied durch schrittweises Weiterrechnen (unabhängig von der Formel im Text). */
const glied = (start: number, schritt: (x: number) => number) => (n: number) => {
  let x = start;
  for (let i = 1; i < n; i++) x = schritt(x);
  return x;
};
const ARITH_HILFEN = ["aₙ = a₁ + (n − 1) · d", "Von einem Glied zum nächsten kommt immer d dazu."];
const ARITH_N = "Mit n statt mit n − 1 multipliziert";
const GEO_HILFEN = ["bₙ = b₁ · q^(n − 1)", "Von einem Glied zum nächsten wird immer mit q multipliziert."];
const GEO_N = "Die Hochzahl n statt n − 1 genommen";
const ARITH_GEO = "Arithmetische und geometrische Folge verwechselt";
const monotonText = (d: number) => (d > 0 ? "streng monoton steigend" : "streng monoton fallend");

const FOLGEN_ARITHMETISCH: Faehigkeit = {
  wahl: (rng, st) => {
    const a1 = nz(rng, -10, 20);
    const d = st >= 3 ? pick(rng, [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3, -3, 4, 7]) : nz(rng, -9, 9);
    if (a1 === d) return null;
    const a = glied(a1, (x) => x + d);
    const [m1, m2] = mischen(rng, [5, 6, 7, 8, 9, 10, 12, 15]);
    const formel = (text: string) => () => [1, 2, 3, 4, 5, 6].every((n) => nahe(fn(text, "n")(n), a(n)));
    const explizit = linear(d, a1 - d, "n");
    return {
      stamm: `Für die arithmetische Folge (aₙ) gilt a₁ = ${zahl(a1)} und d = ${zahl(d)}.`,
      aussagen: [
        ja(`Es gilt a${tief(m1)} = ${zahl(a1 + (m1 - 1) * d)}.`, () => nahe(a(m1), a1 + (m1 - 1) * d)),
        nein(`Es gilt a${tief(m2)} = ${zahl(a1 + m2 * d)}.`, ARITH_N, () => nahe(a(m2), a1 + m2 * d)),
        ja(`Für alle n gilt aₙ = ${explizit}.`, formel(explizit)),
        nein(`Für alle n gilt aₙ = ${linear(d, a1, "n")}.`, ARITH_N, formel(linear(d, a1, "n"))),
        nein(`Für alle n gilt aₙ = ${linear(a1, d, "n")}.`, "a₁ und d vertauscht", formel(linear(a1, d, "n"))),
        ja(`Für alle n gilt aₙ₊₁ = aₙ ${plusMinus(d)}.`, () => [1, 2, 3, 4].every((n) => nahe(a(n + 1), a(n) + d)), "rek"),
        nein(`Für alle n gilt aₙ₊₁ = aₙ · ${d < 0 ? `(${zahl(d)})` : zahl(d)}.`, ARITH_GEO, () => [1, 2, 3, 4].every((n) => nahe(a(n + 1), a(n) * d)), "rek"),
        ja(`Die Folge ist ${monotonText(d)}.`, () => [1, 2, 3, 4, 5].every((n) => (d > 0 ? a(n + 1) > a(n) : a(n + 1) < a(n))), "mono"),
        nein(`Die Folge ist ${monotonText(-d)}.`, "Das Vorzeichen von d falsch gedeutet", () => [1, 2, 3, 4, 5].every((n) => (d < 0 ? a(n + 1) > a(n) : a(n + 1) < a(n))), "mono"),
      ],
      loesung: `aₙ = ${zahl(a1)} + (n − 1) · ${d < 0 ? `(${zahl(d)})` : zahl(d)} = ${explizit}; a${tief(m1)} = ${zahl(a1 + (m1 - 1) * d)}.\nd ${d > 0 ? "> 0: steigend" : "< 0: fallend"}.`,
      hilfen: ARITH_HILFEN,
    };
  },
  luecke: (rng) => {
    const a1 = nz(rng, -10, 20);
    const d = nz(rng, -9, 9);
    if (a1 === d) return null;
    const m = rint(rng, 8, 15);
    // aus dem Stamm: d = a₂ − a₁
    const a2 = a1 + d;
    const a = glied(a1, (x) => x + (a2 - a1));
    const art = (wie: "steigend" | "fallend" | "konstant") => () => [1, 2, 3, 4].every((n) => (wie === "steigend" ? a(n + 1) > a(n) : wie === "fallend" ? a(n + 1) < a(n) : nahe(a(n + 1), a(n))));
    const ist = (w: number) => () => nahe(a(m), w);
    return {
      stamm: `Für die arithmetische Folge (aₙ) gilt a₁ = ${zahl(a1)} und a₂ = ${zahl(a2)}.`,
      satz: `Die Folge ist ${GAP}, und es gilt a${tief(m)} = ${GAP}.`,
      luecken: [
        [
          teil("streng monoton steigend", d > 0, art("steigend"), d > 0 ? undefined : "Das Vorzeichen von d falsch gedeutet"),
          teil("streng monoton fallend", d < 0, art("fallend"), d < 0 ? undefined : "Das Vorzeichen von d falsch gedeutet"),
          teil("konstant", false, art("konstant")),
        ],
        [
          teil(zahl(a1 + (m - 1) * d), true, ist(a1 + (m - 1) * d)),
          teil(zahl(a1 + m * d), false, ist(a1 + m * d), ARITH_N),
          teil(zahl(m * d), false, ist(m * d), "a₁ vergessen"),
        ],
      ],
      loesung: `d = a₂ − a₁ = ${zahl(d)}. a${tief(m)} = ${zahl(a1)} + ${m - 1} · ${d < 0 ? `(${zahl(d)})` : zahl(d)} = ${zahl(a1 + (m - 1) * d)}.`,
      hilfen: ARITH_HILFEN,
    };
  },
  zuordnung: (rng) => {
    const d = nz(rng, -9, 9);
    const c = nz(rng, -12, 12);
    if (!verschieden(d + c, d, c, 2 * d + c)) return null;
    const term = linear(d, c, "n");
    const a = fn(term, "n");
    const zahlB = (x: number) => ({ text: zahl(x), b: zahl(x) });
    return zuordnen(
      rng,
      [
        { aussage: "das erste Glied a₁", a: "a1", richtig: zahlB(d + c), falsch: { ...zahlB(c), fehler: "Den konstanten Summanden für a₁ gehalten" } },
        { aussage: "die Differenz d", a: "d", richtig: zahlB(d), falsch: { ...zahlB(2 * d + c), fehler: "Das zweite Glied statt der Differenz genommen" } },
      ],
      (was: string, text: string) => (was === "a1" ? nahe(a(1), rechne(text)) : [1, 2, 3].every((n) => nahe(a(n + 1) - a(n), rechne(text)))),
      {
        stamm: `Für eine arithmetische Folge gilt aₙ = ${term}.`,
        loesung: `a₁ = ${zahl(d)} · 1 ${plusMinus(c)} = ${zahl(d + c)}; d = a₂ − a₁ = ${zahl(d)}.`,
        hilfen: ARITH_HILFEN,
      },
    );
  },
};

function geoZahlen(rng: Rng, st: Stufe) {
  const b1 = pick(rng, st >= 3 ? [1, 2, 3, 4, 5, -2, -3] : [1, 2, 3, 4, 5]);
  const q = pick(rng, st <= 1 ? [2, 3] : st === 2 ? [2, 3, -2, 0.5] : [2, 3, -2, 0.5, -0.5, 1.5]);
  return { b1, q, b: glied(b1, (x) => x * q) };
}
const klammer = (x: number) => (x < 0 ? `(${wert(x)})` : wert(x));
/** bₙ = b₁ · q^(n − 1) wie im Schulbuch: „3 · 2^(n − 1)“, „(−2)^(n − 1)“. */
const geoTerm = (b1: number, q: number, hoch = "(n − 1)") => `${b1 === 1 ? "" : b1 === -1 ? "−" : `${wert(b1)} · `}${klammer(q)}^${hoch}`;

const FOLGEN_GEOMETRISCH: Faehigkeit = {
  wahl: (rng, st) => {
    const { b1, q, b } = geoZahlen(rng, st);
    const [m1, m2, m3] = mischen(rng, [3, 4, 5, 6]);
    const arith = b1 + (m3 - 1) * q;
    if (nahe(arith, b(m3)) || b1 === 1) return null;
    const formel = (text: string) => () => [1, 2, 3, 4, 5].every((n) => nahe(fn(text, "n")(n), b(n)));
    const rekursiv = (op: (x: number) => number) => () => [1, 2, 3, 4].every((n) => nahe(b(n + 1), op(b(n))));
    return {
      stamm: `Für die geometrische Folge (bₙ) gilt b₁ = ${wert(b1)} und q = ${wert(q)}.`,
      aussagen: [
        ja(`Es gilt b${tief(m1)} = ${wert(b(m1))}.`, () => nahe(b(m1), rechne(wert(b(m1))))),
        nein(`Es gilt b${tief(m2)} = ${wert(b(m2) * q)}.`, GEO_N, () => nahe(b(m2), rechne(wert(b(m2) * q)))),
        nein(`Es gilt b${tief(m3)} = ${wert(arith)}.`, ARITH_GEO, () => nahe(b(m3), rechne(wert(arith)))),
        ja(`Für alle n gilt bₙ = ${geoTerm(b1, q)}.`, formel(geoTerm(b1, q))),
        nein(`Für alle n gilt bₙ = ${geoTerm(b1, q, "n")}.`, GEO_N, formel(geoTerm(b1, q, "n"))),
        nein(`Für alle n gilt bₙ = ${geoTerm(1, b1 * q)}.`, "b₁ und q zuerst multipliziert", formel(geoTerm(1, b1 * q))),
        ja(`Für alle n gilt bₙ₊₁ = bₙ · ${klammer(q)}.`, rekursiv((x) => x * q), "rek"),
        nein(`Für alle n gilt bₙ₊₁ = bₙ ${plusMinus(q)}.`, ARITH_GEO, rekursiv((x) => x + q), "rek"),
      ],
      loesung: `bₙ = ${geoTerm(b1, q)}; b${tief(m1)} = ${wert(b1)} · ${klammer(q)}^${m1 - 1} = ${wert(b(m1))}.`,
      hilfen: GEO_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { b1, q, b } = geoZahlen(rng, st);
    const m = rint(rng, 4, 6);
    const b2 = b(2);
    const quot = [q, b2 - b1, b1 / b2];
    const glieder = [b(m), b(m) * q, b1 + (m - 1) * (b2 - b1)];
    if (!verschieden(...quot) || !verschieden(...glieder)) return null;
    const istQ = (w: number) => () => nahe(b(2) / b(1), w) && nahe(b(3) / b(2), w);
    const ist = (w: number) => () => nahe(b(m), w);
    return {
      stamm: `Für die geometrische Folge (bₙ) gilt b₁ = ${wert(b1)} und b₂ = ${wert(b2)}.`,
      satz: `Der Quotient der Folge ist q = ${GAP}, und es gilt b${tief(m)} = ${GAP}.`,
      luecken: [
        [teil(wert(quot[0]), true, istQ(quot[0])), teil(wert(quot[1]), false, istQ(quot[1]), "Die Differenz statt des Quotienten genommen"), teil(wert(quot[2]), false, istQ(quot[2]), "b₁ : b₂ statt b₂ : b₁ gerechnet")],
        [teil(wert(glieder[0]), true, ist(glieder[0])), teil(wert(glieder[1]), false, ist(glieder[1]), GEO_N), teil(wert(glieder[2]), false, ist(glieder[2]), "Wie bei einer arithmetischen Folge gerechnet")],
      ],
      loesung: `q = b₂ : b₁ = ${wert(q)}. b${tief(m)} = ${wert(b1)} · ${klammer(q)}^${m - 1} = ${wert(b(m))}.`,
      hilfen: GEO_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const { b1, q, b } = geoZahlen(rng, st);
    const m = rint(rng, 3, 5);
    const term = geoTerm(b1, q);
    const folge = fn(term, "n");
    const werte = [b1, b(m), b1 * q, b(m) * q];
    if (!verschieden(...werte)) return null;
    const zahlB = (x: number) => ({ text: wert(x), b: wert(x) });
    return zuordnen(
      rng,
      [
        { aussage: "das erste Glied b₁", a: 1, richtig: zahlB(b1), falsch: { ...zahlB(b1 * q), fehler: "Bei n = 1 mit q^1 statt mit q^0 gerechnet" } },
        { aussage: `das Glied b${tief(m)}`, a: m, richtig: zahlB(b(m)), falsch: { ...zahlB(b(m) * q), fehler: GEO_N } },
      ],
      (n, text) => nahe(folge(n), rechne(text)),
      {
        stamm: `Für eine geometrische Folge gilt bₙ = ${term}.`,
        loesung: `b₁ = ${wert(b1)}, b${tief(m)} = ${wert(b1)} · ${klammer(q)}^${m - 1} = ${wert(b(m))}.`,
        hilfen: GEO_HILFEN,
      },
    );
  },
};

// ---------- Differentialrechnung ----------

const intervall = (a: number, b: number) => `[${zahl(a)}; ${zahl(b)}]`;
const RATE_HILFEN = ["Mittlere Änderungsrate in [a; b]: (f(b) − f(a))/(b − a).", "Die absolute Änderung ist f(b) − f(a), die momentane Änderungsrate f′(x)."];
const DURCH_B = "Durch b statt durch b − a dividiert";
const NICHT_GETEILT = "Nicht durch die Länge des Intervalls dividiert";
const FUNKTIONSWERT = "Den Funktionswert statt der Ableitung genommen";
function ratePolynom(rng: Rng, st: Stufe): Term[] {
  const t: Term[] = [[nz(rng, -3, 3), 2], [rint(rng, -5, 5), 1], [rint(rng, -9, 9), 0]];
  if (st >= 2 && rng() < 0.5) t.push([pick(rng, [1, -1]), 3]);
  return t;
}

const DIFF_AENDERUNGSRATE: Faehigkeit = {
  wahl: (rng, st) => {
    const terms = ratePolynom(rng, st);
    const term = poly(terms);
    const f = fn(term);
    const p = (x: number) => pWert(terms, x);
    const u = rint(rng, 1, 3);
    const w = u + rint(rng, 2, 4);
    const u2 = -rint(rng, 1, 3);
    const w2 = rint(rng, 2, 4);
    const x0 = nz(rng, -3, 3);
    const x1 = nz(rng, -3, 3);
    const d1 = p(w) - p(u);
    const d2 = p(w2) - p(u2);
    const fs = (x: number) => pWert(pAbl(terms), x);
    if (!d1 || !d2 || nahe(p(x1), fs(x1))) return null;
    const mittlere = (a: number, b: number, text: string) => () => nahe((f(b) - f(a)) / (b - a), rechne(text));
    const absolut = (a: number, b: number, text: string) => () => nahe(f(b) - f(a), rechne(text));
    const momentan = (x: number, text: string) => () => nahe(abl(f, x), rechne(text), 1e-5);
    const satz = (was: string, a: number, b: number, text: string) => `Die ${was} von f im Intervall ${intervall(a, b)} beträgt ${text}.`;
    const m1 = wert(d1 / (w - u));
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      aussagen: [
        ja(satz("mittlere Änderungsrate", u, w, m1), mittlere(u, w, m1)),
        nein(satz("mittlere Änderungsrate", u2, w2, wert(d2 / w2)), DURCH_B, mittlere(u2, w2, wert(d2 / w2))),
        nein(satz("mittlere Änderungsrate", u2, w2, wert(d2)), NICHT_GETEILT, mittlere(u2, w2, wert(d2))),
        ja(satz("absolute Änderung", u2, w2, wert(d2)), absolut(u2, w2, wert(d2))),
        nein(satz("absolute Änderung", u, w, m1), "Absolute Änderung und mittlere Änderungsrate verwechselt", absolut(u, w, m1)),
        ja(`Die momentane Änderungsrate von f an der Stelle ${zahl(x0)} beträgt ${wert(fs(x0))}.`, momentan(x0, wert(fs(x0)))),
        nein(`Die momentane Änderungsrate von f an der Stelle ${zahl(x1)} beträgt ${wert(p(x1))}.`, FUNKTIONSWERT, momentan(x1, wert(p(x1)))),
      ],
      loesung: [
        `In ${intervall(u, w)}: f(${zahl(w)}) − f(${zahl(u)}) = ${wert(d1)}, mittlere Änderungsrate ${wert(d1)}/${w - u} = ${m1}.`,
        `In ${intervall(u2, w2)}: absolute Änderung ${wert(d2)}, mittlere Änderungsrate ${wert(d2 / (w2 - u2))}.`,
        `f′(x) = ${poly(pAbl(terms))}, f′(${zahl(x0)}) = ${wert(fs(x0))}.`,
      ].join("\n"),
      hilfen: RATE_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const terms = ratePolynom(rng, st);
    const term = poly(terms);
    const f = fn(term);
    const p = (x: number) => pWert(terms, x);
    const u = rint(rng, 1, 3);
    const w = u + rint(rng, 2, 4);
    const d = p(w) - p(u);
    const fs = pWert(pAbl(terms), w);
    const g1 = [d / (w - u), d, d / w];
    const g2 = [fs, p(w), d / (w - u)];
    if (!d || !verschieden(...g1) || !verschieden(...g2)) return null;
    const mittlere = (x: number) => () => nahe((f(w) - f(u)) / (w - u), x);
    const momentan = (x: number) => () => nahe(abl(f, w), x, 1e-5);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      satz: `Die mittlere Änderungsrate von f im Intervall ${intervall(u, w)} beträgt ${GAP}, die momentane Änderungsrate von f an der Stelle ${zahl(w)} beträgt ${GAP}.`,
      luecken: [
        [teil(wert(g1[0]), true, mittlere(g1[0])), teil(wert(g1[1]), false, mittlere(g1[1]), NICHT_GETEILT), teil(wert(g1[2]), false, mittlere(g1[2]), DURCH_B)],
        [teil(wert(g2[0]), true, momentan(g2[0])), teil(wert(g2[1]), false, momentan(g2[1]), FUNKTIONSWERT), teil(wert(g2[2]), false, momentan(g2[2]), "Mittlere und momentane Änderungsrate verwechselt")],
      ],
      loesung: `(f(${zahl(w)}) − f(${zahl(u)}))/(${zahl(w)} − ${zahl(u)}) = ${wert(d)}/${w - u} = ${wert(g1[0])}. f′(x) = ${poly(pAbl(terms))}, f′(${zahl(w)}) = ${wert(fs)}.`,
      hilfen: RATE_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const terms = ratePolynom(rng, st);
    const term = poly(terms);
    const f = fn(term);
    const p = (x: number) => pWert(terms, x);
    const u = rint(rng, 1, 3);
    const w = u + rint(rng, 2, 4);
    const x0 = nz(rng, -3, 3);
    const d = p(w) - p(u);
    const fs = pWert(pAbl(terms), x0);
    type Groesse = "mittlere" | "absolute" | "momentan";
    const was: Record<Groesse, { aussage: string; wert: number; falsch: number; fehler: string; rechne: () => number }> = {
      mittlere: { aussage: `die mittlere Änderungsrate von f im Intervall ${intervall(u, w)}`, wert: d / (w - u), falsch: d / w, fehler: DURCH_B, rechne: () => (f(w) - f(u)) / (w - u) },
      absolute: { aussage: `die absolute Änderung von f im Intervall ${intervall(u, w)}`, wert: d, falsch: p(w), fehler: "Nur den Funktionswert am Ende des Intervalls genommen", rechne: () => f(w) - f(u) },
      momentan: { aussage: `die momentane Änderungsrate von f an der Stelle ${zahl(x0)}`, wert: fs, falsch: p(x0), fehler: FUNKTIONSWERT, rechne: () => abl(f, x0) },
    };
    const [g1, g2] = mischen(rng, ["mittlere", "absolute", "momentan"] as Groesse[]);
    if (!d || !verschieden(was[g1].wert, was[g2].wert, was[g1].falsch, was[g2].falsch)) return null;
    const paar = (g: Groesse): Paar<Groesse, string> => ({ aussage: was[g].aussage, a: g, richtig: { text: wert(was[g].wert), b: wert(was[g].wert) }, falsch: { text: wert(was[g].falsch), b: wert(was[g].falsch), fehler: was[g].fehler } });
    return zuordnen(rng, [paar(g1), paar(g2)], (g, text) => nahe(was[g].rechne(), rechne(text), 1e-5), {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      loesung: [g1, g2].map((g) => `${was[g].aussage}: ${wert(was[g].wert)}`).join("\n"),
      hilfen: RATE_HILFEN,
    });
  },
};

const POTENZ_HILFEN = ["(x^n)′ = n · x^(n − 1)", "Ein konstanter Summand fällt beim Ableiten weg."];
const NICHT_VERRINGERT = "Die Hochzahl nicht um 1 verringert";
const KONSTANTE = "Die Konstante stehen gelassen";
function potenzZahlen(rng: Rng, st: Stufe) {
  const n = pick(rng, st <= 1 ? [2, 3] : [3, 4, 5]);
  const m = pick(rng, n === 2 ? [1] : [1, 2]);
  const a = st >= 3 ? pick(rng, [0.5, -0.5, 1.5, 2, -3, 4]) : nz(rng, -5, 5);
  const b = nz(rng, -9, 9);
  const c = nz(rng, -9, 9);
  return { n, m, a, b, c };
}

const DIFF_POTENZREGEL: Faehigkeit = {
  wahl: (rng, st) => {
    const { n, m, a, b, c } = potenzZahlen(rng, st);
    const terms: Term[] = [[a, n], [b, m], [c, 0]];
    const f = fn(poly(terms));
    const ableitung = pAbl(terms);
    const x0 = nz(rng, -3, 3);
    const x1 = nz(rng, -3, 3);
    if (nahe(pWert(terms, x1), pWert(ableitung, x1))) return null;
    const istFs = (g: Term[]) => () => istAbleitung(fn(poly(g)), f);
    const wertBei = (x: number, text: string) => () => nahe(abl(f, x), rechne(text), 1e-5);
    const fs = (g: Term[]) => `f′(x) = ${poly(g)}`;
    const zweite = pAbl(ableitung);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${poly(terms)}.`,
      aussagen: [
        ja(fs(ableitung), istFs(ableitung)),
        nein(fs([[a * n, n], [b * m, m]]), NICHT_VERRINGERT, istFs([[a * n, n], [b * m, m]])),
        nein(fs([...ableitung, [c, 0]]), KONSTANTE, istFs([...ableitung, [c, 0]])),
        nein(fs([[a, n - 1], [b, m - 1]]), "Nicht mit der Hochzahl multipliziert", istFs([[a, n - 1], [b, m - 1]])),
        ja(`f′(${zahl(x0)}) = ${wert(pWert(ableitung, x0))}`, wertBei(x0, wert(pWert(ableitung, x0)))),
        nein(`f′(${zahl(x1)}) = ${wert(pWert(terms, x1))}`, FUNKTIONSWERT, wertBei(x1, wert(pWert(terms, x1)))),
        ...(st >= 2 ? [ja(`f″(x) = ${poly(zweite)}`, () => STELLEN.every((x) => nahe(abl2(f, x), fn(poly(zweite))(x), 1e-4)))] : []),
      ],
      loesung: `f′(x) = ${poly(ableitung)}${st >= 2 ? `, f″(x) = ${poly(zweite)}` : ""}; f′(${zahl(x0)}) = ${wert(pWert(ableitung, x0))}.`,
      hilfen: POTENZ_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { n, m, a, b, c } = potenzZahlen(rng, st);
    const terms: Term[] = [[a, n], [b, m], [c, 0]];
    const f = fn(poly(terms));
    const ableitung = pAbl(terms);
    const ohne: Term[] = [[a * n, n], [b * m, m]];
    const x0 = nz(rng, -3, 3);
    const werte = [pWert(ableitung, x0), pWert(terms, x0), pWert(ohne, x0)];
    if (!verschieden(...werte)) return null;
    const istFs = (g: Term[]) => () => istAbleitung(fn(poly(g)), f);
    const bei = (w: number) => () => nahe(abl(f, x0), w, 1e-5);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${poly(terms)}.`,
      satz: `Für die Ableitung von f gilt f′(x) = ${GAP}, und es gilt f′(${zahl(x0)}) = ${GAP}.`,
      luecken: [
        [teil(poly(ableitung), true, istFs(ableitung)), teil(poly(ohne), false, istFs(ohne), NICHT_VERRINGERT), teil(poly([...ableitung, [c, 0]]), false, istFs([...ableitung, [c, 0]]), KONSTANTE)],
        [teil(wert(werte[0]), true, bei(werte[0])), teil(wert(werte[1]), false, bei(werte[1]), FUNKTIONSWERT), teil(wert(werte[2]), false, bei(werte[2]), NICHT_VERRINGERT)],
      ],
      loesung: `f′(x) = ${poly(ableitung)}, f′(${zahl(x0)}) = ${wert(werte[0])}.`,
      hilfen: POTENZ_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const { n, m, a, b, c } = potenzZahlen(rng, st);
    const f1: Term[] = [[a, n]];
    const f2: Term[] = [[b, m], [c, 0]];
    const text = (t: Term[]) => ({ text: poly(t), b: poly(t) });
    return zuordnen(
      rng,
      [
        { aussage: `f₁(x) = ${poly(f1)}`, a: poly(f1), richtig: text(pAbl(f1)), falsch: { ...text([[a * n, n]]), fehler: NICHT_VERRINGERT } },
        { aussage: `f₂(x) = ${poly(f2)}`, a: poly(f2), richtig: text(pAbl(f2)), falsch: { ...text([...pAbl(f2), [c, 0]]), fehler: KONSTANTE } },
      ],
      (fText, gText) => istAbleitung(fn(gText), fn(fText)),
      {
        stamm: "Gegeben sind die Funktionen f₁ und f₂.",
        auftrag: "Ordne den zwei Funktionen jeweils ihre Ableitungsfunktion aus A bis D zu.",
        fest: true,
        loesung: `f₁′(x) = ${poly(pAbl(f1))}, f₂′(x) = ${poly(pAbl(f2))}.`,
        hilfen: POTENZ_HILFEN,
      },
    );
  },
};

const MONOTONIE_HILFEN = ["Wo f′(x) > 0 ist, ist f streng monoton steigend.", "Wechselt f′ an einer Stelle von + nach −, hat f dort ein lokales Maximum."];
const HOCH_TIEF = "Hoch- und Tiefpunkt verwechselt";
const MONO_FEHLER = "Das Monotonieverhalten verkehrt abgelesen";
/** f′(x) = k · (x − p) · (x − q) mit p < q; f hat ganzzahlige Koeffizienten. */
function monotonieZahlen(rng: Rng) {
  const p = rint(rng, -4, 3);
  const q = p + rint(rng, 2, 6);
  const k = pick(rng, (p + q) % 2 === 0 ? [6, -6, 3, -3] : [6, -6]);
  const c = rint(rng, -5, 5);
  const terms: Term[] = [[k / 3, 3], [(-k * (p + q)) / 2, 2], [k * p * q, 1], [c, 0]];
  return { p, q, k, term: poly(terms) };
}
/** k · (x − p) · (x − q), mit „x“ statt „(x − 0)“. */
const faktoren = (k: number, p: number, q: number) => [zahl(k), ...[p, q].map((x) => (x === 0 ? "x" : `(x ${plusMinus(-x)})`))].join(" · ");
const andere = (art: "steigend" | "fallend") => (art === "steigend" ? "fallend" : "steigend");

const DIFF_MONOTONIE: Faehigkeit = {
  wahl: (rng) => {
    const { p, q, k, term } = monotonieZahlen(rng);
    const f = fn(term);
    const mitte: "steigend" | "fallend" = k > 0 ? "fallend" : "steigend";
    const beiP: "Maximum" | "Minimum" = k > 0 ? "Maximum" : "Minimum";
    const beiQ: "Maximum" | "Minimum" = k > 0 ? "Minimum" : "Maximum";
    const gegen = (art: "Maximum" | "Minimum") => (art === "Maximum" ? "Minimum" : "Maximum");
    const mono = (a: number, b: number, art: "steigend" | "fallend", wahr: boolean, gruppe: string) => {
      const text = `f ist im Intervall ${intervall(a, b)} streng monoton ${art}.`;
      return wahr ? ja(text, () => streng(f, a, b, art), gruppe) : nein(text, MONO_FEHLER, () => streng(f, a, b, art), gruppe);
    };
    const extrem = (x: number, art: "Maximum" | "Minimum", wahr: boolean, gruppe: string) => {
      const text = `f hat an der Stelle ${zahl(x)} ein lokales ${art}.`;
      return wahr ? ja(text, () => lokal(f, x, art), gruppe) : nein(text, HOCH_TIEF, () => lokal(f, x, art), gruppe);
    };
    const w = (p + q) / 2;
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      aussagen: [
        mono(p, q, mitte, true, "pq"),
        mono(p, q, andere(mitte), false, "pq"),
        mono(q, q + 3, andere(mitte), true, "rechts"),
        mono(q, q + 3, mitte, false, "rechts"),
        extrem(p, beiP, true, "p"),
        extrem(p, gegen(beiP), false, "p"),
        extrem(q, beiQ, true, "q"),
        extrem(q, gegen(beiQ), false, "q"),
        nein(`f hat an der Stelle ${zahl(w)} ein lokales Extremum.`, "Die Wendestelle für eine Extremstelle gehalten", () => lokal(f, w, "Maximum") || lokal(f, w, "Minimum")),
        ...(p !== 0 && q !== 0 ? [nein("Der Graph von f hat an der Stelle 0 eine waagrechte Tangente.", undefined, () => Math.abs(abl(f, 0)) < 1e-6)] : []),
      ],
      loesung: `f′(x) = ${poly([[k, 2], [-k * (p + q), 1], [k * p * q, 0]])} = ${faktoren(k, p, q)}, Nullstellen ${zahl(p)} und ${zahl(q)}.\nIn ${intervall(p, q)} ist f′ ${k > 0 ? "negativ" : "positiv"}: f ist dort streng monoton ${mitte}. Bei ${zahl(p)} lokales ${beiP}, bei ${zahl(q)} lokales ${beiQ}.`,
      hilfen: MONOTONIE_HILFEN,
    };
  },
  luecke: (rng) => {
    const { p, q, k, term } = monotonieZahlen(rng);
    const f = fn(term);
    // das Intervall: zwischen den Extremstellen oder links von p; die Stelle: p oder q
    const [a, b] = pick(rng, [[p, q], [p - 2, p], [q, q + 2]] as const);
    const fallend = (a === p && b === q) === k > 0;
    const x = pick(rng, [p, q]);
    const max = (x === p) === k > 0;
    const konstant = () => [0.25, 0.5, 0.75, 1].every((t) => nahe(f(a + t * (b - a)), f(a)));
    const sattel = () => Math.abs(abl(f, x)) < 1e-6 && wendestelle(f, x);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      satz: `Im Intervall ${intervall(a, b)} ist f ${GAP}, und an der Stelle ${zahl(x)} hat f ${GAP}.`,
      luecken: [
        [
          teil("streng monoton fallend", fallend, () => streng(f, a, b, "fallend"), fallend ? undefined : MONO_FEHLER),
          teil("streng monoton steigend", !fallend, () => streng(f, a, b, "steigend"), fallend ? MONO_FEHLER : undefined),
          teil("konstant", false, konstant),
        ],
        [
          teil("ein lokales Maximum", max, () => lokal(f, x, "Maximum"), max ? undefined : HOCH_TIEF),
          teil("ein lokales Minimum", !max, () => lokal(f, x, "Minimum"), max ? HOCH_TIEF : undefined),
          teil("einen Sattelpunkt", false, sattel),
        ],
      ],
      loesung: `f′(x) = ${faktoren(k, p, q)}. In ${intervall(a, b)} ist f′ ${fallend ? "negativ" : "positiv"}. An der Stelle ${zahl(x)} wechselt f′ das Vorzeichen: lokales ${max ? "Maximum" : "Minimum"}.`,
      hilfen: MONOTONIE_HILFEN,
    };
  },
  zuordnung: (rng) => {
    const { p, q, k, term } = monotonieZahlen(rng);
    const f = fn(term);
    type Art = "max" | "min" | "wende" | "sattel";
    const TEXT: Record<Art, string> = { max: "lokale Maximumstelle", min: "lokale Minimumstelle", wende: "Wendestelle", sattel: "Sattelstelle" };
    const ist: Record<Art, (x: number) => boolean> = {
      max: (x) => lokal(f, x, "Maximum"),
      min: (x) => lokal(f, x, "Minimum"),
      wende: (x) => wendestelle(f, x),
      sattel: (x) => Math.abs(abl(f, x)) < 1e-6 && wendestelle(f, x),
    };
    const stellen: { x: number; art: Art; falsch: Art; fehler?: string }[] = [
      { x: p, art: k > 0 ? "max" : "min", falsch: k > 0 ? "min" : "max", fehler: HOCH_TIEF },
      { x: q, art: k > 0 ? "min" : "max", falsch: k > 0 ? "max" : "min", fehler: HOCH_TIEF },
      { x: (p + q) / 2, art: "wende", falsch: "sattel", fehler: "Eine Wendestelle mit waagrechter Tangente angenommen" },
    ];
    const [s1, s2] = mischen(rng, stellen);
    const genutzt = new Set([s1.art, s2.art]);
    // die zwei falschen Antworten: zu jeder Stelle eine, die es bei diesen Stellen nicht schon richtig gibt
    const falsch1 = genutzt.has(s1.falsch) ? (["max", "min", "wende", "sattel"] as Art[]).find((a) => !genutzt.has(a))! : s1.falsch;
    const falsch2 = (["max", "min", "wende", "sattel"] as Art[]).find((a) => !genutzt.has(a) && a !== falsch1)!;
    const paar = (s: typeof s1, falsch: Art): Paar<number, Art> => ({ aussage: `x = ${zahl(s.x)}`, a: s.x, richtig: { text: TEXT[s.art], b: s.art }, falsch: { text: TEXT[falsch], b: falsch, fehler: falsch === s.falsch ? s.fehler : undefined } });
    return zuordnen(rng, [paar(s1, falsch1), paar(s2, falsch2)], (x, art) => ist[art](x), {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${term}.`,
      auftrag: "Ordne den zwei Stellen jeweils die passende Beschreibung aus A bis D zu.",
      loesung: `f′(x) = ${faktoren(k, p, q)}, f″ hat die Nullstelle ${zahl((p + q) / 2)}.\n${[s1, s2].map((s) => `x = ${zahl(s.x)}: ${TEXT[s.art]}`).join(", ")}.`,
      hilfen: [...MONOTONIE_HILFEN, "An einer Wendestelle wechselt f″ das Vorzeichen."],
    });
  },
};

// ---------- Wahrscheinlichkeit ----------

/** n und p mit ganzzahliger Standardabweichung. */
const BINOM: [number, number][] = [[16, 0.5], [25, 0.2], [36, 0.5], [64, 0.5], [100, 0.2], [100, 0.5], [100, 0.1], [225, 0.2], [400, 0.1]];
/** P(X = k) für k = 0 … n. */
function binomial(n: number, p: number): number[] {
  const out = [(1 - p) ** n];
  for (let k = 0; k < n; k++) out.push((out[k] * (n - k) * p) / ((k + 1) * (1 - p)));
  return out;
}
/** Der Wert eines Ausdrucks mit P(X ≤ 17), P(X > 3), P(4 ≤ X ≤ 9) …, aus der Binomialverteilung ausgerechnet. */
function wkWert(text: string, pk: number[]): number {
  const summe = (von: number, bis: number) => pk.slice(Math.max(0, von), Math.max(0, bis + 1)).reduce((s, x) => s + x, 0);
  const n = pk.length - 1;
  const bereich: Record<string, (k: number) => [number, number]> = { "≤": (k) => [0, k], "<": (k) => [0, k - 1], "≥": (k) => [k, n], ">": (k) => [k + 1, n], "=": (k) => [k, k] };
  const ersetzt = text
    .replace(/P\((\d+) ≤ X ≤ (\d+)\)/g, (_, a: string, b: string) => `(${summe(Number(a), Number(b)).toFixed(15).replace(".", ",")})`)
    .replace(/P\(X ([≤<≥>=]) (\d+)\)/g, (_, op: string, k: string) => `(${summe(...bereich[op](Number(k))).toFixed(15).replace(".", ",")})`);
  return rechne(ersetzt);
}
const BINOM_HILFEN = ["μ = n · p und σ = sqrt(n · p · (1 − p)).", "P(X ≥ k) = 1 − P(X ≤ k − 1)."];

const WAHRSCHEINLICHKEIT_BINOMIAL: Faehigkeit = {
  wahl: (rng) => {
    const [n, p] = pick(rng, BINOM);
    const mu = Math.round(n * p);
    const sigma = Math.round(Math.sqrt(n * p * (1 - p)));
    const pk = binomial(n, p);
    const k = () => mu + rint(rng, -sigma, sigma);
    const [k1, k2, k3, k4] = [k(), k(), k(), k()];
    const lo = Math.max(2, k() - rint(rng, 2, 4));
    const hi = lo + rint(rng, 3, 6);
    const erw = pk.reduce((s, x, i) => s + i * x, 0);
    const sd = () => Math.sqrt(pk.reduce((s, x, i) => s + (i - erw) ** 2 * x, 0));
    const gl = (text: string) => () => {
      const [l, r] = text.split(" = ");
      return nahe(wkWert(l, pk), wkWert(r, pk));
    };
    const aussage = (wahr: boolean, text: string, fehler: string, gruppe: string) => (wahr ? ja(text, gl(text), gruppe) : nein(text, fehler, gl(text), gruppe));
    const falschMu = p === 0.5 ? n * p * (1 - p) : n * (1 - p);
    return {
      stamm: `Die Zufallsvariable X ist binomialverteilt mit n = ${n} und p = ${zahl(p)}.`,
      aussagen: [
        ja(`Der Erwartungswert von X ist ${zahl(mu)}.`, () => nahe(erw, mu), "mu"),
        nein(`Der Erwartungswert von X ist ${zahl(falschMu)}.`, p === 0.5 ? "Die Varianz statt des Erwartungswerts genommen" : "p und 1 − p verwechselt", () => nahe(erw, falschMu), "mu"),
        ja(`Die Standardabweichung von X ist ${zahl(sigma)}.`, () => nahe(sd(), sigma), "sigma"),
        nein(`Die Standardabweichung von X ist ${zahl(sigma * sigma)}.`, "σ ohne Wurzel angegeben", () => nahe(sd(), sigma * sigma), "sigma"),
        aussage(true, `P(X ≥ ${k1}) = 1 − P(X ≤ ${k1 - 1})`, "", "ge"),
        aussage(false, `P(X ≥ ${k1}) = 1 − P(X ≤ ${k1})`, "„Mindestens k“ als 1 − P(X ≤ k) gerechnet", "ge"),
        aussage(true, `P(X < ${k2}) = P(X ≤ ${k2 - 1})`, "", "lt"),
        aussage(false, `P(X < ${k2}) = P(X ≤ ${k2})`, "„Weniger als k“ und „höchstens k“ verwechselt", "lt"),
        aussage(true, `P(${lo} ≤ X ≤ ${hi}) = P(X ≤ ${hi}) − P(X ≤ ${lo - 1})`, "", "iv"),
        aussage(false, `P(${lo} ≤ X ≤ ${hi}) = P(X ≤ ${hi}) − P(X ≤ ${lo})`, "Die untere Grenze nicht mitgezählt", "iv"),
        aussage(true, `P(X > ${k3}) = 1 − P(X ≤ ${k3})`, "", "gt"),
        aussage(false, `P(X > ${k4}) = 1 − P(X < ${k4})`, "„Mehr als k“ und „mindestens k“ verwechselt", "gt"),
      ],
      loesung: `μ = ${n} · ${zahl(p)} = ${zahl(mu)}, σ = sqrt(${n} · ${zahl(p)} · ${zahl(1 - p)}) = ${zahl(sigma)}.\n„Mindestens k“ ist das Gegenereignis von „höchstens k − 1“.`,
      hilfen: BINOM_HILFEN,
    };
  },
  luecke: (rng) => {
    const [n, p] = pick(rng, BINOM);
    const pk = binomial(n, p);
    const erw = pk.reduce((s, x, i) => s + i * x, 0);
    const sd = Math.sqrt(pk.reduce((s, x, i) => s + (i - erw) ** 2 * x, 0));
    const mu = Math.round(n * p);
    const v = Math.round(n * p * (1 - p));
    const istMu = (text: string) => () => nahe(erw, rechne(text));
    const istSd = (text: string) => () => nahe(sd, rechne(text));
    return {
      stamm: `Die Zufallsvariable X ist binomialverteilt mit n = ${n} und p = ${zahl(p)}.`,
      satz: `Der Erwartungswert von X ist ${GAP}, und die Standardabweichung von X ist ${GAP}.`,
      luecken: [
        [teil(zahl(mu), true, istMu(zahl(mu))), teil(zahl(v), false, istMu(zahl(v)), "Die Varianz statt des Erwartungswerts genommen"), teil(String(n), false, istMu(String(n)), "n für den Erwartungswert gehalten")],
        [teil(zahl(Math.sqrt(v)), true, istSd(zahl(Math.sqrt(v)))), teil(zahl(v), false, istSd(zahl(v)), "σ ohne Wurzel angegeben"), teil(`sqrt(${zahl(mu)})`, false, istSd(`sqrt(${zahl(mu)})`), "1 − p unter der Wurzel vergessen")],
      ],
      loesung: `μ = n · p = ${zahl(mu)}, σ = sqrt(n · p · (1 − p)) = sqrt(${zahl(v)}) = ${zahl(Math.sqrt(v))}.`,
      hilfen: BINOM_HILFEN.slice(0, 1),
    };
  },
  zuordnung: (rng) => {
    const [n, p] = pick(rng, BINOM);
    const sigma = Math.round(Math.sqrt(n * p * (1 - p)));
    const k = Math.round(n * p) + rint(rng, -sigma, sigma);
    // bei p = 0,5 ist die Verteilung symmetrisch: P(X ≤ k − 1) = P(X > k) für k = n/2
    if (p === 0.5 && 2 * k === n) return null;
    const pk = binomial(n, p);
    const t = (text: string) => ({ text, b: text });
    return zuordnen(
      rng,
      [
        { aussage: `P(X ≥ ${k})`, a: `P(X ≥ ${k})`, richtig: t(`1 − P(X ≤ ${k - 1})`), falsch: { ...t(`P(X ≤ ${k - 1})`), fehler: "Die Gegenwahrscheinlichkeit nicht von 1 abgezogen" } },
        { aussage: `P(X > ${k})`, a: `P(X > ${k})`, richtig: t(`1 − P(X ≤ ${k})`), falsch: { ...t(`1 − P(X ≤ ${k + 1})`), fehler: "Die Grenze um eins verschoben" } },
      ],
      (a, b) => nahe(wkWert(a, pk), wkWert(b, pk)),
      {
        stamm: `Die Zufallsvariable X ist binomialverteilt mit n = ${n} und p = ${zahl(p)}.`,
        auftrag: "Ordne den zwei Wahrscheinlichkeiten jeweils den gleichwertigen Ausdruck aus A bis D zu.",
        loesung: `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1}), P(X > ${k}) = 1 − P(X ≤ ${k}).`,
        hilfen: BINOM_HILFEN,
      },
    );
  },
};

type Versuch = { stamm: (n: number) => string; p: number; pText: string; qText: string; bruch: boolean };
const VERSUCHE: Versuch[] = [
  { stamm: (n) => `Ein fairer Würfel wird ${n}-mal geworfen. X ist die Anzahl der Sechser.`, p: 1 / 6, pText: "1/6", qText: "5/6", bruch: true },
  { stamm: (n) => `Ein Glücksrad hat vier gleich große Felder, eines davon ist rot. Es wird ${n}-mal gedreht. X ist die Anzahl der Drehungen, bei denen Rot kommt.`, p: 1 / 4, pText: "1/4", qText: "3/4", bruch: true },
  { stamm: (n) => `Eine Basketballspielerin trifft einen Freiwurf mit der Wahrscheinlichkeit 0,7. Sie wirft ${n}-mal, die Würfe sind unabhängig. X ist die Anzahl der Treffer.`, p: 0.7, pText: "0,7", qText: "0,3", bruch: false },
  { stamm: (n) => `Ein Samenkorn keimt mit der Wahrscheinlichkeit 0,9. Du säst ${n} Samenkörner, sie keimen unabhängig voneinander. X ist die Anzahl der gekeimten Körner.`, p: 0.9, pText: "0,9", qText: "0,1", bruch: false },
  { stamm: (n) => `Bei einer Tombola gewinnt jedes Los mit der Wahrscheinlichkeit 0,1. Du kaufst ${n} Lose. X ist die Anzahl der Gewinne.`, p: 0.1, pText: "0,1", qText: "0,9", bruch: false },
];
/** Die Wahrscheinlichkeit eines Ereignisses durch Abzählen aller 2^n Pfade. */
function pfade(n: number, p: number, gilt: (treffer: number) => boolean): number {
  let s = 0;
  for (let maske = 0; maske < 1 << n; maske++) {
    let t = 0;
    let w = 1;
    for (let i = 0; i < n; i++) {
      if (maske & (1 << i)) {
        t++;
        w *= p;
      } else w *= 1 - p;
    }
    if (gilt(t)) s += w;
  }
  return s;
}
type Ereignis = { text: string; gilt: (t: number) => boolean; richtig: string; falsch: [string, string][] };
function ereignisse(v: Versuch, n: number): Ereignis[] {
  const pot = (x: string, k: number) => (k === 1 ? x : v.bruch ? `(${x})^${k}` : `${x}^${k}`);
  const keinmal = pot(v.qText, n);
  const ADDIERT = "Die Einzelwahrscheinlichkeiten addiert";
  return [
    { text: "P(X = 0)", gilt: (t) => t === 0, richtig: keinmal, falsch: [[pot(v.pText, n), "Ereignis und Gegenereignis verwechselt"], [`1 − ${keinmal}`, "Ereignis und Gegenereignis verwechselt"]] },
    { text: "P(X ≥ 1)", gilt: (t) => t >= 1, richtig: `1 − ${keinmal}`, falsch: [[`${n} · ${v.pText}`, ADDIERT], [`1 − ${pot(v.pText, n)}`, "Mit der falschen Gegenwahrscheinlichkeit gerechnet"]] },
    { text: "P(X = 1)", gilt: (t) => t === 1, richtig: `${n} · ${v.pText} · ${pot(v.qText, n - 1)}`, falsch: [[`${v.pText} · ${pot(v.qText, n - 1)}`, "Die Anzahl der Pfade vergessen"], [`${n} · ${v.pText} · ${v.qText}`, "Die Hochzahl bei der Gegenwahrscheinlichkeit vergessen"]] },
    { text: `P(X = ${n})`, gilt: (t) => t === n, richtig: pot(v.pText, n), falsch: [[`${n} · ${v.pText}`, ADDIERT], [pot(v.qText, n), "Ereignis und Gegenereignis verwechselt"]] },
  ];
}
const MEHRSTUFIG_HILFEN = ["Entlang eines Pfades wird multipliziert, verschiedene Pfade werden addiert.", "„Mindestens einmal“ geht am schnellsten über das Gegenereignis „keinmal“."];

const WAHRSCHEINLICHKEIT_MEHRSTUFIG: Faehigkeit = {
  wahl: (rng, st) => {
    const v = pick(rng, VERSUCHE);
    const n = rint(rng, 3, st >= 2 ? 5 : 4);
    const es = ereignisse(v, n);
    const aussagen: Aussage[] = [];
    for (const e of es) {
      const stimmt = (rechts: string) => () => nahe(pfade(n, v.p, e.gilt), rechne(rechts));
      aussagen.push(ja(`${e.text} = ${e.richtig}`, stimmt(e.richtig)));
      const [f, fehler] = pick(rng, e.falsch);
      aussagen.push(nein(`${e.text} = ${f}`, fehler, stimmt(f)));
    }
    return {
      stamm: v.stamm(n),
      aussagen,
      loesung: es.map((e) => `${e.text} = ${e.richtig}`).join("\n"),
      hilfen: MEHRSTUFIG_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const v = pick(rng, VERSUCHE);
    const n = rint(rng, 3, st >= 2 ? 5 : 4);
    const [null0, mind, eins] = ereignisse(v, n);
    const zweite = pick(rng, [mind, eins]);
    const gruppe = (e: Ereignis): Aussage[] => [e.richtig, ...e.falsch.map(([f]) => f)].map((rechts, i) => teil(rechts, i === 0, () => nahe(pfade(n, v.p, e.gilt), rechne(rechts)), e.falsch[i - 1]?.[1]));
    return {
      stamm: v.stamm(n),
      satz: `Es gilt ${null0.text} = ${GAP} und ${zweite.text} = ${GAP}.`,
      luecken: [gruppe(null0), gruppe(zweite)],
      loesung: `${null0.text} = ${null0.richtig}, ${zweite.text} = ${zweite.richtig}`,
      hilfen: MEHRSTUFIG_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const v = pick(rng, VERSUCHE);
    const n = rint(rng, 3, st >= 2 ? 5 : 4);
    const [e1, e2] = mischen(rng, ereignisse(v, n));
    const p1 = pfade(n, v.p, e1.gilt);
    const p2 = pfade(n, v.p, e2.gilt);
    // P(X = 0) = P(X = 1) bei n · p = 1 − p (Würfel und fünf Würfe): dann passt nicht genau eine Antwort
    if (nahe(p1, p2)) return null;
    const paar = (e: Ereignis): Paar<Ereignis, string> | null => {
      const frei = e.falsch.filter(([f]) => !nahe(rechne(f), p1) && !nahe(rechne(f), p2));
      if (!frei.length) return null;
      const [f, fehler] = pick(rng, frei);
      return { aussage: e.text, a: e, richtig: { text: e.richtig, b: e.richtig }, falsch: { text: f, b: f, fehler } };
    };
    const a = paar(e1);
    const b = paar(e2);
    if (!a || !b || doppelt([a.richtig.text, b.richtig.text, a.falsch.text, b.falsch.text])) return null;
    return zuordnen(rng, [a, b], (e, rechts) => nahe(pfade(n, v.p, e.gilt), rechne(rechts)), {
      stamm: v.stamm(n),
      auftrag: "Ordne den zwei Wahrscheinlichkeiten jeweils den passenden Term aus A bis D zu.",
      loesung: `${e1.text} = ${e1.richtig}\n${e2.text} = ${e2.richtig}`,
      hilfen: MEHRSTUFIG_HILFEN,
    });
  },
};

// ---------- Integralrechnung ----------

const STAMM_HILFEN = ["F ist eine Stammfunktion von f, wenn F′ = f gilt.", "Zu x^n gehört x^(n + 1)/(n + 1); jede Konstante darf dazukommen."];
const ABGELEITET = "Abgeleitet statt integriert";
const NICHT_DIVIDIERT = "Die Hochzahl erhöht, aber nicht durch die neue Hochzahl dividiert";
/** f(x) = a · x^n + b · x + c mit ganzzahligen Koeffizienten der Stammfunktion. */
function stammZahlen(rng: Rng, st: Stufe) {
  const n = pick(rng, st <= 1 ? [2, 3] : [2, 3, 4]);
  const s = nz(rng, -3, 3);
  const t = nz(rng, -4, 4);
  const c = nz(rng, -9, 9);
  const f: Term[] = [[(n + 1) * s, n], [2 * t, 1], [c, 0]];
  const F: Term[] = [[s, n + 1], [t, 2], [c, 1]];
  return { n, s, t, c, f, F };
}
const integriere = (terms: Term[]): Term[] => terms.map(([k, e]) => [k / (e + 1), e + 1]);

const INTEGRAL_STAMMFUNKTION: Faehigkeit = {
  wahl: (rng, st) => {
    const { n, s, t, c, f, F } = stammZahlen(rng, st);
    const K = nz(rng, -9, 9);
    const ff = fn(poly(f));
    const stamm = (g: Term[]) => () => istAbleitung(ff, fn(poly(g)));
    const text = (g: Term[]) => `F(x) = ${poly(g)}`;
    const alt: Term[] = [[((n + 1) * s) / n, n + 1], [2 * t, 2], [c, 1]];
    const altSchoen = Number.isInteger(((n + 1) * s * 2) / n);
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${poly(f)}.`,
      auftrag: ["Kreuze die Funktion F an, die eine Stammfunktion von f ist.", "Kreuze die beiden Funktionen F an, die Stammfunktionen von f sind."],
      aussagen: [
        ja(text(F), stamm(F)),
        ja(text([...F, [K, 0]]), stamm([...F, [K, 0]])),
        nein(text(pAbl(f)), ABGELEITET, stamm(pAbl(f))),
        nein(text(f.map(([k, e]) => [k, e + 1])), NICHT_DIVIDIERT, stamm(f.map(([k, e]) => [k, e + 1]))),
        nein(text([[s, n + 1], [t, 2], [c, 0]]), "Die Konstante nicht mit x multipliziert", stamm([[s, n + 1], [t, 2], [c, 0]])),
        nein(text([[s, n + 1], [t, 2]]), "Die Konstante beim Integrieren weggelassen", stamm([[s, n + 1], [t, 2]])),
        ...(altSchoen ? [nein(text(alt), "Durch die alte statt durch die neue Hochzahl dividiert", stamm(alt))] : []),
      ],
      loesung: `F(x) = ${poly(F)} + C mit einer beliebigen Zahl C. Probe: F′(x) = ${poly(f)} = f(x).`,
      hilfen: STAMM_HILFEN,
    };
  },
  luecke: (rng, st) => {
    const { s, t, f, F } = stammZahlen(rng, st);
    const g0 = nz(rng, -9, 9);
    const ff = fn(poly(f));
    const stamm = (g: Term[]) => () => istAbleitung(ff, fn(poly(g)));
    const mitStart = (g: Term[]) => () => stamm(g)() && nahe(fn(poly(g))(0), g0);
    const G: Term[] = [...F, [g0, 0]];
    const ohneC: Term[] = [[s, F[0][1]], [t, 2], [g0, 0]];
    return {
      stamm: `Gegeben ist die Funktion f mit f(x) = ${poly(f)}.`,
      satz: `Eine Stammfunktion von f ist F mit F(x) = ${GAP}, und für die Stammfunktion G von f mit G(0) = ${zahl(g0)} gilt G(x) = ${GAP}.`,
      luecken: [
        [teil(poly(F), true, stamm(F)), teil(poly(pAbl(f)), false, stamm(pAbl(f)), ABGELEITET), teil(poly(f.map(([k, e]) => [k, e + 1])), false, stamm(f.map(([k, e]) => [k, e + 1])), NICHT_DIVIDIERT)],
        [teil(poly(G), true, mitStart(G)), teil(poly(F), false, mitStart(F), `Die Bedingung G(0) = ${zahl(g0)} nicht beachtet`), teil(poly(ohneC), false, mitStart(ohneC), "Die Konstante beim Integrieren weggelassen")],
      ],
      loesung: `F(x) = ${poly(F)}, denn F′(x) = ${poly(f)}. G(x) = F(x) + C mit G(0) = C = ${zahl(g0)}.`,
      hilfen: STAMM_HILFEN,
    };
  },
  zuordnung: (rng, st) => {
    const { n, s, t, c } = stammZahlen(rng, st);
    const f1: Term[] = [[(n + 1) * s, n]];
    const f2: Term[] = [[2 * t, 1], [c, 0]];
    const text = (g: Term[]) => ({ text: poly(g), b: poly(g) });
    return zuordnen(
      rng,
      [
        { aussage: `f₁(x) = ${poly(f1)}`, a: poly(f1), richtig: text(integriere(f1)), falsch: { ...text(pAbl(f1)), fehler: ABGELEITET } },
        { aussage: `f₂(x) = ${poly(f2)}`, a: poly(f2), richtig: text(integriere(f2)), falsch: { ...text([[t, 2], [c, 0]]), fehler: "Die Konstante nicht mit x multipliziert" } },
      ],
      (fText, FText) => istAbleitung(fn(fText), fn(FText)),
      {
        stamm: "Gegeben sind die Funktionen f₁ und f₂.",
        auftrag: "Ordne den zwei Funktionen jeweils eine Stammfunktion aus A bis D zu.",
        fest: true,
        loesung: `F₁(x) = ${poly(integriere(f1))}, F₂(x) = ${poly(integriere(f2))} (jeweils + C).`,
        hilfen: STAMM_HILFEN,
      },
    );
  },
};

// ---------- Fähigkeiten und Aufgaben ----------

const FAEHIGKEITEN: Record<string, Faehigkeit> = {
  "mathe.os.funktionen.quadratisch": FUNKTIONEN_QUADRATISCH,
  "mathe.os.funktionen.scheitel": FUNKTIONEN_SCHEITEL,
  "mathe.os.funktionen.verschieben": FUNKTIONEN_VERSCHIEBEN,
  "mathe.os.wachstum.exponentiell": WACHSTUM_EXPONENTIELL,
  "mathe.os.wachstum.halbwertszeit": WACHSTUM_HALBWERTSZEIT,
  "mathe.os.log.begriff": LOG_BEGRIFF,
  "mathe.os.log.regeln": LOG_REGELN,
  "mathe.os.folgen.arithmetisch": FOLGEN_ARITHMETISCH,
  "mathe.os.folgen.geometrisch": FOLGEN_GEOMETRISCH,
  "mathe.os.diff.aenderungsrate": DIFF_AENDERUNGSRATE,
  "mathe.os.diff.potenzregel": DIFF_POTENZREGEL,
  "mathe.os.diff.monotonie": DIFF_MONOTONIE,
  "mathe.os.wahrscheinlichkeit.binomial-bereiche": WAHRSCHEINLICHKEIT_BINOMIAL,
  "mathe.os.wahrscheinlichkeit.mehrstufig": WAHRSCHEINLICHKEIT_MEHRSTUFIG,
  "mathe.os.integral.stammfunktion": INTEGRAL_STAMMFUNKTION,
};
export const MATHE_MATURA_IDS = Object.keys(FAEHIGKEITEN);
export const istMatheMatura = (skillId: string | null | undefined): boolean => Boolean(skillId && skillId in FAEHIGKEITEN);

function probeFehler(a: Aussage): string | null {
  try {
    return a.probe() === a.wahr ? null : `„${a.text}“ ist ${a.wahr ? "falsch" : "richtig"}, aber als ${a.wahr ? "richtig" : "falsch"} markiert.`;
  } catch (e) {
    return `„${a.text}“: ${(e as Error).message}`;
  }
}

/**
 * Was an einem Stoff nicht stimmt: eine Probe widerspricht der Markierung, zwei Antworten sind gleich, beim
 * Lückentext ergibt eine andere Wahl auch einen richtigen Satz, bei der Zuordnung passt eine Antwort zu einer
 * fremden Aussage. null, wenn alles stimmt.
 */
export function stoffFehler<A extends MaturaArt>(art: A, stoff: Stoff[A]): string | null {
  if (art === "wahl") {
    const s = stoff as WahlStoff;
    for (const a of s.aussagen) {
      const f = probeFehler(a);
      if (f) return f;
    }
    if (s.aussagen.filter((a) => a.wahr).length < 2 || s.aussagen.filter((a) => !a.wahr).length < 4) return "Zu wenige richtige oder falsche Aussagen.";
    return doppelt(s.aussagen.map((a) => a.text)) ? "Zwei Aussagen sind gleich." : null;
  }
  if (art === "luecke") {
    const s = stoff as LueckenStoff;
    if ((s.satz.match(new RegExp(GAP, "g")) ?? []).length !== 2) return "Der Satz braucht genau zwei Lücken.";
    for (const g of s.luecken) {
      if (g.length !== 3 || g.filter((t) => t.wahr).length !== 1) return "Jede Lücke braucht drei Satzteile, genau einer richtig.";
      if (doppelt(g.map((t) => t.text))) return "Zwei Satzteile sind gleich.";
      for (const t of g) {
        const f = probeFehler(t);
        if (f) return f;
      }
    }
    if (s.probe) {
      const [g1, g2] = s.luecken;
      for (const [i, a] of g1.entries()) for (const [j, b] of g2.entries()) if (s.probe(i, j) !== (a.wahr && b.wahr)) return `Mit „${a.text}“ und „${b.text}“ stimmt der Satz ${a.wahr && b.wahr ? "nicht" : "auch"}.`;
    }
    return null;
  }
  const s = stoff as ZuordnungStoff;
  if (s.antworten.length !== 4) return "Die Zuordnung braucht vier Antworten.";
  if (doppelt(s.antworten.map((a) => a.text)) || doppelt(s.aussagen)) return "Zwei Antworten oder Aussagen sind gleich.";
  for (const i of [0, 1])
    for (const k of [0, 1, 2, 3]) {
      try {
        if (s.passt(i, k) !== (k === i)) return `Antwort „${s.antworten[k].text}“ ${k === i ? "passt nicht" : "passt auch"} zu „${s.aussagen[i]}“.`;
      } catch (e) {
        return `„${s.antworten[k].text}“: ${(e as Error).message}`;
      }
    }
  return null;
}

/** Ein roher Stoff (ein Versuch, ungeprüft) für die Tests; null, wenn die Zufallszahlen nicht passen. */
export function maturaStoff<A extends MaturaArt>(skillId: string, art: A, difficulty: Difficulty, rng: Rng = Math.random): Stoff[A] | null {
  const f = FAEHIGKEITEN[skillId];
  return f ? (f[art](rng, STUFE[difficulty]) as Stoff[A] | null) : null;
}

function auswahl(rng: Rng, aussagen: Aussage[], richtig: number, anzahl: number): Aussage[] | null {
  for (let versuch = 0; versuch < 30; versuch++) {
    const out: Aussage[] = [];
    const frei = (a: Aussage) => !a.gruppe || !out.some((b) => b.gruppe === a.gruppe);
    for (const a of mischen(rng, aussagen.filter((x) => x.wahr))) if (out.length < richtig && frei(a)) out.push(a);
    // falsche Antworten mit einem typischen Fehler zuerst
    const falsche = mischen(rng, aussagen.filter((x) => !x.wahr)).sort((a, b) => Number(Boolean(b.fehler)) - Number(Boolean(a.fehler)));
    for (const a of falsche) if (out.length < anzahl && frei(a)) out.push(a);
    if (out.length === anzahl && out.filter((a) => a.wahr).length === richtig) return mischen(rng, out);
  }
  return null;
}

const kopf = (skillId: string, difficulty: Difficulty, category: string) => ({ skillId, skillIds: [skillId], category, difficulty });

/** 1 aus 5, 2 aus 5 oder (für den Aufgabentyp Multiple Choice) 1 aus 4. */
function ankreuzen(skillId: string, kategorie: "matura-1aus5" | "matura-2aus5" | "mc", difficulty: Difficulty, s: WahlStoff, rng: Rng): TaskDraft | null {
  const richtig = kategorie === "matura-2aus5" ? 2 : 1;
  const gewaehlt = auswahl(rng, s.aussagen, richtig, kategorie === "mc" ? 4 : 5);
  if (!gewaehlt) return null;
  const idx = gewaehlt.flatMap((a, i) => (a.wahr ? [i] : []));
  return {
    ...kopf(skillId, difficulty, kategorie),
    type: "mc",
    prompt: `${s.stamm}\n${s.auftrag?.[richtig - 1] ?? MATURA_AUFTRAG[richtig === 2 ? "matura-2aus5" : "matura-1aus5"]}`,
    data: { options: gewaehlt.map((a) => a.text) },
    answer: richtig === 2 ? { correctAll: idx } : { correct: idx[0] },
    solution: s.loesung,
    hints: s.hilfen,
    errorMap: gewaehlt.flatMap((a, i) => (!a.wahr && a.fehler ? [{ answer: String(i), label: a.fehler }] : [])),
  };
}

function lueckentext(skillId: string, difficulty: Difficulty, s: LueckenStoff, rng: Rng): TaskDraft {
  const gruppen = s.luecken.map((g) => mischen(rng, g));
  return {
    ...kopf(skillId, difficulty, "matura-lueckentext"),
    type: "cloze",
    prompt: `${s.stamm}\n${MATURA_AUFTRAG["matura-lueckentext"]}\n${s.satz}`,
    data: { gapOptions: gruppen.map((g) => g.map((t) => t.text)) },
    answer: { blanks: gruppen.map((g) => [g.find((t) => t.wahr)!.text]), mode: "text" },
    solution: s.loesung,
    hints: s.hilfen,
    errorMap: gruppen.flatMap((g, i) => g.flatMap((t) => (!t.wahr && t.fehler ? [{ answer: `${kreisZahl(i + 1)} ${t.text}`, label: t.fehler }] : []))),
  };
}

function zuordnung(skillId: string, difficulty: Difficulty, s: ZuordnungStoff, rng: Rng): TaskDraft {
  // reihe[Platz] = Antwort im Stoff; die Lösung ist der Platz der Antwort 0 und der Antwort 1
  const reihe = mischen(rng, [0, 1, 2, 3]);
  const platz = (k: number) => reihe.indexOf(k);
  return {
    ...kopf(skillId, difficulty, "matura-zuordnung"),
    type: "zuordnung",
    prompt: `${s.stamm}\n${s.auftrag ?? MATURA_AUFTRAG["matura-zuordnung"]}`,
    data: { zuordnung: { statements: [...s.aussagen], options: reihe.map((k) => s.antworten[k].text) } },
    answer: { pairs: [platz(0), platz(1)] },
    solution: s.loesung,
    hints: s.hilfen,
    errorMap: s.antworten.flatMap((a, k) => (a.fehler && a.fuer !== undefined ? [{ answer: `${a.fuer + 1} → ${buchstabe(platz(k))}`, label: a.fehler }] : [])),
  };
}

/**
 * Eine Aufgabe einer Fähigkeit im Matura-Format (oder als 1 aus 4 für den Aufgabentyp Multiple Choice).
 * Es kommen nur Stoffe durch, deren Proben alle stimmen; null nur bei einer fremden Fähigkeit.
 */
export function matheMaturaAufgabe(skillId: string, kategorie: MaturaKategorie | "mc", difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const f = FAEHIGKEITEN[skillId];
  if (!f) return null;
  const st = STUFE[difficulty];
  for (let versuch = 0; versuch < 300; versuch++) {
    if (kategorie === "matura-lueckentext") {
      const s = f.luecke(rng, st);
      if (s && !stoffFehler("luecke", s)) return lueckentext(skillId, difficulty, s, rng);
    } else if (kategorie === "matura-zuordnung") {
      const s = f.zuordnung(rng, st);
      if (s && !stoffFehler("zuordnung", s)) return zuordnung(skillId, difficulty, s, rng);
    } else {
      const s = f.wahl(rng, st);
      const t = s && !stoffFehler("wahl", s) ? ankreuzen(skillId, kategorie, difficulty, s, rng) : null;
      if (t) return t;
    }
  }
  return null;
}

/** Für GEN (lib/generators.ts): ein zufälliges Matura-Format. */
export const MATHE_MATURA: Record<string, (rng: Rng, difficulty: Difficulty) => TaskDraft> = Object.fromEntries(
  MATHE_MATURA_IDS.map((id) => [id, (rng: Rng, difficulty: Difficulty) => matheMaturaAufgabe(id, pick(rng, MATURA_KATEGORIEN), difficulty, rng)!]),
);

/**
 * Eine Aufgabe für einen Aufgabentyp des Builders und der Aufgabentyp, den sie wirklich hat. Die Matura-Typen
 * gibt es alle; Multiple Choice wird 1 aus 4, Lückentext der Lückentext zum Ankreuzen. Andere Typen (Direkte
 * Rechnung, Textaufgabe, Fehler finden, Lösungsweg ordnen) gibt es für diese Fähigkeiten ohne KI nicht: dann
 * kommt 1 aus 5 mit seiner echten Kategorie, und der Builder sagt es (typFehlt).
 */
export function matheMaturaFuerKategorie(skillId: string, category: string | null, difficulty: Difficulty, rng: Rng = Math.random): { task: TaskDraft; category: string } {
  const als = (k: MaturaKategorie | "mc", cat: string = k) => ({ task: { ...matheMaturaAufgabe(skillId, k, difficulty, rng)!, category: cat }, category: cat });
  if (category && (MATURA_KATEGORIEN as readonly string[]).includes(category)) return als(category as MaturaKategorie);
  if (category === "mc") return als("mc");
  if (category === "lueckentext" || category === "gap") return als("matura-lueckentext", category);
  if (category === null) return als(pick(rng, MATURA_KATEGORIEN));
  return als("matura-1aus5");
}

/** Eine Aufgabe für einen Aufgabentyp ohne Kategorie (generateBuiltIn): mc, cloze, zuordnung oder gemischt. */
export function matheMaturaFuerTyp(skillId: string, taskType: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft {
  const k: MaturaKategorie =
    taskType === "mc" ? pick(rng, ["matura-1aus5", "matura-2aus5"] as const) : taskType === "cloze" ? "matura-lueckentext" : taskType === "zuordnung" ? "matura-zuordnung" : taskType === "mixed" ? pick(rng, MATURA_KATEGORIEN) : "matura-1aus5";
  return matheMaturaAufgabe(skillId, k, difficulty, rng)!;
}
