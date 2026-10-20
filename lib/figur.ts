/**
 * Aufgaben mit Bild: ein Zahlenstrahl, ein Koordinatensystem oder eine Figur hängt an einer Aufgabe
 * (`tasks.data.figure`). Die Antwort bleibt ein gewohntes Format (Rechnung, Multiple Choice, Lückentext,
 * Rechenweg, Sachaufgabe), geprüft wird wie immer (lib/tasks.ts checkAnswer); das Bild zeigt nur, was zur
 * Aufgabe gehört. Die Aufgaben dazu macht lib/generators-figur.ts aus denselben Zahlen, die es zeichnet.
 *
 * Ein Zeichner für alle Stellen: `figurSzene` legt das Bild als einfache Teile an (Linien, Wege, Punkte,
 * Texte, Brüche), `figurSvg` macht daraus ein SVG (Schüler-Gerät, Vorschau, Editor, A4-Druck, Mappe), das
 * Whiteboard setzt dieselben Teile als eigene Elemente (lib/whiteboard-templates.ts). Ohne Abhängigkeiten,
 * damit es im Browser und auf dem Server gleich läuft. Striche sind `currentColor` (im Druck schwarz),
 * das Gitter grau; nichts hängt an CSS-Hintergründen, die der Drucker weglässt.
 *
 * Die Schüler bekommen nie die Angabe selbst (darin steht, wo die Marke sitzt), sondern nur das fertige
 * SVG ohne Lösung (lib/solver-tasks.ts). Die Beschreibung (`aria-label`) nennt, was zu sehen ist, aber
 * keine Lage einer Marke und keinen gesuchten Wert.
 */

export type Bruch = { z: number; n: number };

export type Zahlenstrahl = {
  art: "zahlenstrahl";
  /** Wert des ersten Teilstrichs; start · schritt.n ist eine ganze Zahl */
  start: number;
  /** Wert eines Teilstücks als Bruch, damit Zehntel und Drittel genau bleiben (0,1 = 1/10) */
  schritt: Bruch;
  /** Anzahl der Teilstücke (Teilstriche = schritte + 1) */
  schritte: number;
  /** Nummern der Teilstriche (ab 0) mit einer Zahl darunter */
  beschriftet: number[];
  /** wie die Zahlen geschrieben werden */
  format: "ganz" | "dezimal" | "bruch";
  /** Buchstaben über Teilstrichen; `bei` ist die Nummer des Teilstrichs */
  marken: { name: string; bei: number }[];
  /** ein Bereich (Intervall): von/bis als Nummer eines Teilstrichs, null = ins Unendliche */
  intervall?: { von: number | null; bis: number | null; vonDabei: boolean; bisDabei: boolean } | null;
};

export type Koordinaten = {
  art: "koordinaten";
  /** sichtbarer Bereich in Kästchen; 0 liegt darin */
  x: [number, number];
  y: [number, number];
  /** Wert eines Kästchens (1, 2, 0,5 …) */
  einheit: number;
  /** jedes wievielte Kästchen eine Zahl an der Achse bekommt */
  zahlenAlle: number;
  /** Punkte mit ihren Koordinaten (Werte, nicht Kästchen) */
  punkte: { name: string; x: number; y: number }[];
  /** Geraden y = k · x + d */
  geraden: { name: string; k: Bruch; d: number }[];
};

export type FlaechenForm = "rechteck" | "quadrat" | "dreieck" | "rechtwinklig" | "l-form" | "gleichschenklig";
export type Punkt2 = [number, number];

export type Flaeche = {
  art: "figur";
  form: FlaechenForm;
  /** Ecken in der Längeneinheit der Aufgabe, gegen den Uhrzeigersinn, y nach oben (ungefähr maßstäblich) */
  ecken: Punkt2[];
  /** Namen der Ecken (A, B, C …), leer = keine */
  namen?: string[];
  /** Beschriftung der Seite von Ecke `von` zur nächsten; `loesung` nur für die Lehrerfassung */
  seiten: { von: number; text: string; loesung?: string }[];
  /** Ecken mit rechtem Winkel (Zeichen im Bild) */
  rechteWinkel?: number[];
  /** weitere Strecken: Höhe, Diagonale; gestrichelt, mit Zeichen für den rechten Winkel am Fußpunkt */
  strecken?: { von: Punkt2; bis: Punkt2; text?: string; loesung?: string; gestrichelt?: boolean; rechterWinkel?: boolean }[];
  /** Text in der Figur ("A = 48 cm²") */
  innen?: { text: string; bei: Punkt2 } | null;
};

export type Figur = Zahlenstrahl | Koordinaten | Flaeche;
export type FigurArt = Figur["art"];

export const FIGUR_ARTEN: Record<FigurArt, string> = { zahlenstrahl: "Zahlenstrahl", koordinaten: "Koordinatensystem", figur: "Figur" };

// ---------- Zahlen ----------

function gcd(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 1;
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export function kuerzen({ z, n }: Bruch): Bruch {
  const g = gcd(z, n) || 1;
  const s = n < 0 ? -1 : 1;
  return { z: (s * z) / g, n: (s * n) / g };
}
export const bruchWert = (b: Bruch) => b.z / b.n;

/** Schöne Zahl wie im Schulbuch: Beistrich, Leerzeichen zwischen Dreiergruppen ab 1 000, echtes Minus. */
export function zahl(v: number, nachkomma?: number): string {
  const r = Math.round(v * 1e9) / 1e9;
  const abs = Math.abs(r);
  const raw = nachkomma === undefined ? String(abs) : abs.toFixed(nachkomma);
  const [ganz, komma] = raw.split(".");
  const gruppen = ganz.length >= 4 ? ganz.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ganz;
  return `${r < 0 ? "−" : ""}${gruppen}${komma ? `,${komma}` : ""}`;
}

/** "3/4", "−1/2", ganze Zahlen ohne Nenner; gemischt = "2 1/4". */
export function bruchText(b: Bruch, gemischt = false): string {
  const { z, n } = kuerzen(b);
  if (n === 1) return zahl(z);
  const minus = z < 0 ? "−" : "";
  const a = Math.abs(z);
  if (gemischt && a > n) return `${minus}${Math.floor(a / n)} ${a % n}/${n}`;
  return `${minus}${a}/${n}`;
}

/** Wert am Teilstrich i, genau als Bruch. */
export function wertBei(f: Pick<Zahlenstrahl, "start" | "schritt">, i: number): Bruch {
  return kuerzen({ z: Math.round(f.start * f.schritt.n) + i * f.schritt.z, n: f.schritt.n });
}

/** Wie viele Nachkommastellen ein Bruch mit diesem Nenner als Dezimalzahl braucht (höchstens 4). */
function stellen(b: Bruch): number {
  for (let d = 0; d <= 4; d++) if (Math.abs(Math.round(bruchWert(b) * 10 ** d) - bruchWert(b) * 10 ** d) < 1e-9) return d;
  return 4;
}

/** Die Zahl am Teilstrich i so, wie sie am Zahlenstrahl steht (und wie die Lösung geschrieben wird). */
export function zahlBei(f: Pick<Zahlenstrahl, "start" | "schritt" | "format">, i: number): string {
  const b = wertBei(f, i);
  if (f.format === "bruch") return bruchText(b);
  return zahl(bruchWert(b), f.format === "dezimal" ? stellen(b) : undefined);
}

/** "y = 2x − 1", "y = −1/2 · x + 3", "y = x", "y = 4". */
export function geradenText(k: Bruch, d: number, name = "y"): string {
  const kk = kuerzen(k);
  const dTeil = d === 0 ? "" : ` ${d < 0 ? "−" : "+"} ${zahl(Math.abs(d))}`;
  if (kk.z === 0) return `${name} = ${zahl(d)}`;
  const minus = kk.z < 0 ? "−" : "";
  const a = Math.abs(kk.z);
  const kTeil = kk.n === 1 ? (a === 1 ? `${minus}x` : `${minus}${a}x`) : `${minus}${a}/${kk.n} · x`;
  return `${name} = ${kTeil}${dTeil}`;
}

// ---------- prüfen, was gespeichert wird ----------

const endlich = (x: unknown, max = 1e9): x is number => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= max;
const ganz = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const kurz = (x: unknown, max = 40): string | null => (typeof x === "string" ? x.trim().slice(0, max) : null);
const punkt2 = (x: unknown): Punkt2 | null => (Array.isArray(x) && x.length === 2 && endlich(x[0], 1e6) && endlich(x[1], 1e6) ? [x[0], x[1]] : null);
const bruch = (x: unknown): Bruch | null => {
  const b = x as Bruch;
  return b && typeof b === "object" && ganz(b.z, -1e6, 1e6) && ganz(b.n, 1, 1e6) ? { z: b.z, n: b.n } : null;
};

/**
 * Liest eine gespeicherte Figur und gibt eine saubere Kopie zurück, oder null, wenn sie nicht stimmt. Alles, was
 * aus der Datenbank oder vom Editor kommt, geht hier durch; Texte werden gekürzt, Listen begrenzt.
 */
export function leseFigur(raw: unknown): Figur | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (f.art === "zahlenstrahl") {
    const schritt = bruch(f.schritt);
    if (!schritt || schritt.z === 0 || !endlich(f.start) || !ganz(f.schritte, 1, 200)) return null;
    if (!Number.isInteger(Math.round((f.start as number) * schritt.n * 1e6) / 1e6)) return null;
    const schritte = f.schritte as number;
    const imBereich = (i: unknown): i is number => ganz(i, 0, schritte);
    const format = f.format === "dezimal" || f.format === "bruch" ? f.format : "ganz";
    const marken = (Array.isArray(f.marken) ? f.marken : []).slice(0, 26).flatMap((m) => {
      const name = kurz((m as { name?: unknown })?.name, 3);
      const bei = (m as { bei?: unknown })?.bei;
      return name && imBereich(bei) ? [{ name, bei }] : [];
    });
    const iv = f.intervall as Zahlenstrahl["intervall"];
    const intervall =
      iv && typeof iv === "object" && (iv.von === null || imBereich(iv.von)) && (iv.bis === null || imBereich(iv.bis)) && (iv.von === null || iv.bis === null || iv.von <= iv.bis)
        ? { von: iv.von, bis: iv.bis, vonDabei: Boolean(iv.vonDabei), bisDabei: Boolean(iv.bisDabei) }
        : null;
    return {
      art: "zahlenstrahl",
      start: f.start as number,
      schritt,
      schritte,
      beschriftet: [...new Set((Array.isArray(f.beschriftet) ? f.beschriftet : []).filter(imBereich))].sort((a, b) => a - b),
      format,
      marken,
      ...(intervall ? { intervall } : {}),
    };
  }
  if (f.art === "koordinaten") {
    const bereich = (x: unknown): [number, number] | null => (Array.isArray(x) && ganz(x[0], -30, 0) && ganz(x[1], 0, 30) && x[1] - x[0] >= 2 ? [x[0], x[1]] : null);
    const x = bereich(f.x);
    const y = bereich(f.y);
    if (!x || !y || !endlich(f.einheit, 1e6) || (f.einheit as number) <= 0) return null;
    const punkte = (Array.isArray(f.punkte) ? f.punkte : []).slice(0, 12).flatMap((p) => {
      const q = p as { name?: unknown; x?: unknown; y?: unknown };
      const name = kurz(q?.name, 3);
      return name !== null && endlich(q.x, 1e6) && endlich(q.y, 1e6) ? [{ name, x: q.x, y: q.y }] : [];
    });
    const geraden = (Array.isArray(f.geraden) ? f.geraden : []).slice(0, 4).flatMap((g) => {
      const q = g as { name?: unknown; k?: unknown; d?: unknown };
      const k = bruch(q?.k);
      return k && endlich(q.d, 1e6) ? [{ name: kurz(q.name, 3) ?? "", k, d: q.d }] : [];
    });
    return { art: "koordinaten", x, y, einheit: f.einheit as number, zahlenAlle: ganz(f.zahlenAlle, 1, 10) ? f.zahlenAlle : 1, punkte, geraden };
  }
  if (f.art === "figur") {
    const FORMEN: FlaechenForm[] = ["rechteck", "quadrat", "dreieck", "rechtwinklig", "l-form", "gleichschenklig"];
    const form = FORMEN.includes(f.form as FlaechenForm) ? (f.form as FlaechenForm) : null;
    const ecken = (Array.isArray(f.ecken) ? f.ecken : []).slice(0, 12).map(punkt2);
    if (!form || ecken.length < 3 || ecken.some((e) => !e)) return null;
    const n = ecken.length;
    const seiten = (Array.isArray(f.seiten) ? f.seiten : []).slice(0, 12).flatMap((s) => {
      const q = s as { von?: unknown; text?: unknown; loesung?: unknown };
      const text = kurz(q?.text);
      const loesung = kurz(q?.loesung);
      return ganz(q?.von, 0, n - 1) && text !== null ? [{ von: q.von as number, text, ...(loesung ? { loesung } : {}) }] : [];
    });
    const strecken = (Array.isArray(f.strecken) ? f.strecken : []).slice(0, 4).flatMap((s) => {
      const q = s as { von?: unknown; bis?: unknown; text?: unknown; loesung?: unknown; gestrichelt?: unknown; rechterWinkel?: unknown };
      const von = punkt2(q?.von);
      const bis = punkt2(q?.bis);
      const text = kurz(q?.text);
      const loesung = kurz(q?.loesung);
      return von && bis ? [{ von, bis, ...(text ? { text } : {}), ...(loesung ? { loesung } : {}), gestrichelt: Boolean(q.gestrichelt), rechterWinkel: Boolean(q.rechterWinkel) }] : [];
    });
    const innenRaw = f.innen as { text?: unknown; bei?: unknown } | null | undefined;
    const innenText = kurz(innenRaw?.text);
    const innenBei = punkt2(innenRaw?.bei);
    const namen = Array.isArray(f.namen) ? f.namen.slice(0, n).map((x) => kurz(x, 3) ?? "") : [];
    return {
      art: "figur",
      form,
      ecken: ecken as Punkt2[],
      ...(namen.some(Boolean) ? { namen } : {}),
      seiten,
      rechteWinkel: (Array.isArray(f.rechteWinkel) ? f.rechteWinkel : []).filter((i): i is number => ganz(i, 0, n - 1)),
      strecken,
      innen: innenText && innenBei ? { text: innenText, bei: innenBei } : null,
    };
  }
  return null;
}

// ---------- Beschreibung (aria-label, Text am Whiteboard) ----------

const aufzaehlen = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);
const FORM_NAME: Record<FlaechenForm, string> = {
  rechteck: "Rechteck",
  quadrat: "Quadrat",
  dreieck: "Dreieck",
  rechtwinklig: "Rechtwinkeliges Dreieck",
  "l-form": "Zusammengesetzte Figur in L-Form",
  gleichschenklig: "Gleichschenkeliges Dreieck",
};
/** "c = ?" → "c gesucht", "?" → "gesucht" */
const gesucht = (s: string) => s.replace(/\s*=\s*\?$/, " gesucht").replace(/^\?$/, "gesucht");

/**
 * Was das Bild zeigt, in Worten: für den Screenreader und als Text am Whiteboard. Nennt nie, wo eine Marke oder
 * ein Punkt liegt, und keine gesuchte Zahl; beschriftete Zahlen und Längen gehören zur Angabe und stehen drin.
 */
export function figurBeschreibung(raw: unknown): string | null {
  const f = leseFigur(raw);
  if (!f) return null;
  if (f.art === "zahlenstrahl") {
    const name = f.start < 0 ? "Zahlengerade" : "Zahlenstrahl";
    const zahlen = f.beschriftet.map((i) => zahlBei(f, i));
    const teile = [`${name} mit ${f.schritte} gleich langen Teilstücken.`];
    if (zahlen.length) teile.push(`Beschriftet ${zahlen.length === 1 ? "ist" : "sind"} ${aufzaehlen(zahlen)}.`);
    if (f.marken.length) teile.push(f.marken.length === 1 ? `Eine Stelle ist mit ${f.marken[0].name} markiert.` : `Markiert sind die Stellen ${aufzaehlen(f.marken.map((m) => m.name))}.`);
    if (f.intervall) teile.push("Ein Bereich ist hervorgehoben.");
    return teile.join(" ");
  }
  if (f.art === "koordinaten") {
    const achse = (r: [number, number]) => `von ${zahl(r[0] * f.einheit)} bis ${zahl(r[1] * f.einheit)}`;
    const teile = [`Koordinatensystem mit Gitter, die x-Achse ${achse(f.x)}, die y-Achse ${achse(f.y)}.`];
    const dinge = [
      ...(f.punkte.length ? [f.punkte.length === 1 ? `der Punkt ${f.punkte[0].name}` : `die Punkte ${aufzaehlen(f.punkte.map((p) => p.name))}`] : []),
      ...(f.geraden.length ? [f.geraden.length === 1 ? `die Gerade ${f.geraden[0].name}`.trim() : `die Geraden ${aufzaehlen(f.geraden.map((g) => g.name))}`] : []),
    ];
    if (dinge.length) teile.push(`Eingezeichnet ${f.punkte.length + f.geraden.length > 1 ? "sind" : "ist"} ${aufzaehlen(dinge)}.`);
    return teile.join(" ");
  }
  const angaben = [...f.seiten.map((s) => s.text), ...(f.strecken ?? []).flatMap((s) => (s.text ? [s.text] : [])), ...(f.innen ? [f.innen.text] : [])].filter(Boolean).map(gesucht);
  const teile = [`${FORM_NAME[f.form]}.`];
  if (angaben.length) teile.push(`Beschriftet: ${angaben.join(", ")}.`);
  if (f.strecken?.some((s) => s.gestrichelt)) teile.push(f.form === "rechteck" || f.form === "quadrat" ? "Eine Diagonale ist eingezeichnet." : "Eine Höhe ist gestrichelt eingezeichnet.");
  return teile.join(" ");
}

// ---------- die Szene: einfache Teile, für SVG und Whiteboard ----------

export type Teil =
  | { t: "linie"; x1: number; y1: number; x2: number; y2: number; w: number; stil?: "strich" | "gitter" }
  | { t: "weg"; p: Punkt2[]; zu: boolean; w: number; fuellung?: "flaeche" | "voll" }
  | { t: "punkt"; x: number; y: number; r: number; offen?: boolean }
  /** y ist die Mitte der Zeile; `halo`: mit hellem Rand, damit Gitterlinien darunter den Text nicht stören */
  | { t: "text"; x: number; y: number; s: string; g: number; a: "start" | "middle" | "end"; fett?: boolean; halo?: boolean }
  /** ein Bruch mit Strich, x/y ist die Mitte */
  | { t: "bruch"; x: number; y: number; z: string; n: string; minus: boolean; g: number; fett?: boolean };

export type Szene = { art: FigurArt; b: number; h: number; teile: Teil[]; beschreibung: string };

/** Ungefähre Breite eines Textes (für Ränder und das Whiteboard). */
export const textBreite = (s: string, g: number, fett = false) => [...s].length * g * (fett ? 0.6 : 0.56);

function umfang(t: Teil): [number, number, number, number] {
  switch (t.t) {
    case "linie":
      return [Math.min(t.x1, t.x2), Math.min(t.y1, t.y2), Math.max(t.x1, t.x2), Math.max(t.y1, t.y2)];
    case "weg":
      return [Math.min(...t.p.map((p) => p[0])), Math.min(...t.p.map((p) => p[1])), Math.max(...t.p.map((p) => p[0])), Math.max(...t.p.map((p) => p[1]))];
    case "punkt":
      return [t.x - t.r, t.y - t.r, t.x + t.r, t.y + t.r];
    case "text": {
      const w = textBreite(t.s, t.g, t.fett);
      const x0 = t.a === "start" ? t.x : t.a === "end" ? t.x - w : t.x - w / 2;
      return [x0, t.y - t.g * 0.6, x0 + w, t.y + t.g * 0.6];
    }
    case "bruch": {
      const w = Math.max(textBreite(t.z, t.g), textBreite(t.n, t.g)) + 4 + (t.minus ? t.g * 0.7 : 0);
      return [t.x - w / 2 - (t.minus ? t.g * 0.35 : 0), t.y - t.g * 1.25, t.x + w / 2, t.y + t.g * 1.25];
    }
  }
}

/** Schiebt alle Teile so, dass sie mit `rand` Abstand oben links beginnen; Breite und Höhe passen dazu. */
function einpassen(teile: Teil[], rand = 6): { b: number; h: number; teile: Teil[] } {
  const u = teile.map(umfang);
  const x0 = Math.min(...u.map((r) => r[0])) - rand;
  const y0 = Math.min(...u.map((r) => r[1])) - rand;
  const b = Math.max(...u.map((r) => r[2])) + rand - x0;
  const h = Math.max(...u.map((r) => r[3])) + rand - y0;
  const dx = (x: number) => x - x0;
  const dy = (y: number) => y - y0;
  const verschoben = teile.map((t): Teil => {
    switch (t.t) {
      case "linie":
        return { ...t, x1: dx(t.x1), y1: dy(t.y1), x2: dx(t.x2), y2: dy(t.y2) };
      case "weg":
        return { ...t, p: t.p.map(([x, y]) => [dx(x), dy(y)] as Punkt2) };
      default:
        return { ...t, x: dx(t.x), y: dy(t.y) };
    }
  });
  return { b: Math.ceil(b), h: Math.ceil(h), teile: verschoben };
}

/** Eine Zahl als Text oder als gestapelter Bruch. */
function zahlTeil(s: string, x: number, y: number, g: number, fett = false): Teil {
  const m = s.match(/^(−?)(?:(\d+) )?(\d+)\/(\d+)$/);
  if (!m) return { t: "text", x, y, s, g, a: "middle", fett };
  if (m[2]) {
    // gemischte Zahl: die Ganzen links daneben
    return { t: "text", x, y, s, g, a: "middle", fett };
  }
  return { t: "bruch", x, y, z: m[3], n: m[4], minus: m[1] === "−", g: g * 0.85, fett };
}

function pfeilspitze(x: number, y: number, richtung: "rechts" | "links" | "oben", g = 9): Teil {
  const p: Punkt2[] =
    richtung === "rechts"
      ? [[x, y], [x - g, y - g * 0.5], [x - g, y + g * 0.5]]
      : richtung === "links"
        ? [[x, y], [x + g, y - g * 0.5], [x + g, y + g * 0.5]]
        : [[x, y], [x - g * 0.5, y + g], [x + g * 0.5, y + g]];
  return { t: "weg", p, zu: true, w: 1, fuellung: "voll" };
}

function zahlenstrahlSzene(f: Zahlenstrahl, loesung: boolean): Teil[] {
  const breite = 440;
  const x = (i: number) => (i * breite) / f.schritte;
  const Y = 0;
  const teile: Teil[] = [];
  const offenLinks = f.intervall && f.intervall.von === null;
  const offenRechts = f.intervall && f.intervall.bis === null;
  teile.push({ t: "linie", x1: x(0) - 14, y1: Y, x2: x(f.schritte) + 18, y2: Y, w: 1.6 });
  teile.push(pfeilspitze(x(f.schritte) + 22, Y, "rechts"));
  const beschriftet = new Set(f.beschriftet);
  const k0 = Math.round((f.start * f.schritt.n) / f.schritt.z);
  for (let i = 0; i <= f.schritte; i++) {
    const k = k0 + i;
    const lang = beschriftet.has(i) ? 10 : f.format !== "bruch" && f.schritte >= 10 && Number.isInteger(f.start * f.schritt.n / f.schritt.z) && ((k % 5) + 5) % 5 === 0 ? 7 : 4.5;
    teile.push({ t: "linie", x1: x(i), y1: Y - lang, x2: x(i), y2: Y + lang, w: beschriftet.has(i) ? 1.6 : 1.1 });
  }
  for (const i of f.beschriftet) teile.push(zahlTeil(zahlBei(f, i), x(i), Y + (f.format === "bruch" && wertBei(f, i).n !== 1 ? 31 : 24), 15));
  if (f.intervall) {
    const iv = f.intervall;
    const a = iv.von === null ? x(0) - 14 : x(iv.von);
    const b = iv.bis === null ? x(f.schritte) + 14 : x(iv.bis);
    teile.push({ t: "linie", x1: a, y1: Y, x2: b, y2: Y, w: 5 });
    if (offenLinks) teile.push(pfeilspitze(a - 6, Y, "links", 12));
    if (offenRechts) teile.push(pfeilspitze(b + 10, Y, "rechts", 12));
    if (iv.von !== null) teile.push({ t: "punkt", x: a, y: Y, r: 5.5, offen: !iv.vonDabei });
    if (iv.bis !== null) teile.push({ t: "punkt", x: b, y: Y, r: 5.5, offen: !iv.bisDabei });
  }
  // mit Lösung: die Zahl über dem Buchstaben; liegen Marken eng beieinander, steht die Zahl eine Zeile höher
  const ebenen: [number, number][][] = [];
  for (const m of [...f.marken].sort((a, b) => a.bei - b.bei)) {
    // ein kleiner Pfeil von oben auf den Teilstrich, darüber der Buchstabe
    const mx = x(m.bei);
    teile.push({ t: "weg", p: [[mx, Y - 4], [mx - 5, Y - 15], [mx + 5, Y - 15]], zu: true, w: 1, fuellung: "voll" });
    teile.push({ t: "text", x: mx, y: Y - 26, s: m.name, g: 17, a: "middle", fett: true });
    if (loesung) {
      const s = zahlBei(f, m.bei);
      const halb = textBreite(s, 14, true) / 2 + 3;
      let ebene = 0;
      while ((ebenen[ebene] ?? []).some(([l, r]) => mx - halb < r && mx + halb > l)) ebene++;
      (ebenen[ebene] ??= []).push([mx - halb, mx + halb]);
      const bruch = s.includes("/");
      teile.push(zahlTeil(s, mx, Y - (bruch ? 58 : 50) - ebene * (bruch ? 32 : 18), 14, true));
    }
  }
  return teile;
}

/** Schnittpunkte der Geraden y = k·x + d mit dem Rechteck [x0, x1] × [y0, y1], von links nach rechts. */
export function geradeImFenster(k: number, d: number, x0: number, x1: number, y0: number, y1: number): [Punkt2, Punkt2] | null {
  const kandidaten: Punkt2[] = [];
  const dazu = (x: number, y: number) => {
    if (x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9 && !kandidaten.some((p) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9)) kandidaten.push([x, y]);
  };
  dazu(x0, k * x0 + d);
  dazu(x1, k * x1 + d);
  if (k !== 0) {
    dazu((y0 - d) / k, y0);
    dazu((y1 - d) / k, y1);
  }
  if (kandidaten.length < 2) return null;
  kandidaten.sort((a, b) => a[0] - b[0]);
  return [kandidaten[0], kandidaten[kandidaten.length - 1]];
}

function koordinatenSzene(f: Koordinaten, loesung: boolean): Teil[] {
  const nx = f.x[1] - f.x[0];
  const ny = f.y[1] - f.y[0];
  const c = Math.max(22, Math.min(34, Math.floor(360 / Math.max(nx, ny))));
  const px = (k: number) => (k - f.x[0]) * c;
  const py = (k: number) => (f.y[1] - k) * c;
  const teile: Teil[] = [];
  for (let k = f.x[0]; k <= f.x[1]; k++) if (k !== 0) teile.push({ t: "linie", x1: px(k), y1: py(f.y[0]), x2: px(k), y2: py(f.y[1]), w: 0.8, stil: "gitter" });
  for (let k = f.y[0]; k <= f.y[1]; k++) if (k !== 0) teile.push({ t: "linie", x1: px(f.x[0]), y1: py(k), x2: px(f.x[1]), y2: py(k), w: 0.8, stil: "gitter" });
  // Achsen mit Pfeil
  teile.push({ t: "linie", x1: px(f.x[0]) - 6, y1: py(0), x2: px(f.x[1]) + 14, y2: py(0), w: 1.6 });
  teile.push(pfeilspitze(px(f.x[1]) + 18, py(0), "rechts"));
  teile.push({ t: "linie", x1: px(0), y1: py(f.y[0]) + 6, x2: px(0), y2: py(f.y[1]) - 14, w: 1.6 });
  teile.push(pfeilspitze(px(0), py(f.y[1]) - 18, "oben"));
  // was schon Platz braucht: Achsen, Zahlen an den Achsen, Punkte, Geraden; Namen kommen in eine freie Ecke
  const belegt: Rechteck[] = [
    [px(f.x[0]) - 6, py(0) - 3, px(f.x[1]) + 9, py(0) + 3],
    [px(f.x[1]) + 9, py(0) - 5, px(f.x[1]) + 18, py(0) + 5],
    [px(0) - 3, py(f.y[1]) - 9, px(0) + 3, py(f.y[0]) + 6],
    [px(0) - 5, py(f.y[1]) - 18, px(0) + 5, py(f.y[1]) - 9],
  ];
  const beschriftung = (t: Teil) => {
    teile.push(t);
    belegt.push(umfang(t));
  };
  beschriftung({ t: "text", x: px(f.x[1]) + 16, y: py(0) + 15, s: "x", g: 15, a: "middle", fett: true });
  // „y“ rechts neben der Pfeilspitze, über dem Gitter: so kommt es der obersten Zahl nicht in die Quere
  beschriftung({ t: "text", x: px(0) + 9, y: py(f.y[1]) - 15, s: "y", g: 15, a: "start", fett: true });
  const zahlen = (k: number) => k !== 0 && k % f.zahlenAlle === 0;
  for (let k = f.x[0]; k <= f.x[1]; k++) {
    if (!zahlen(k)) continue;
    teile.push({ t: "linie", x1: px(k), y1: py(0) - 4, x2: px(k), y2: py(0) + 4, w: 1.2 });
    beschriftung({ t: "text", x: px(k), y: py(0) + 14, s: zahl(k * f.einheit), g: 12.5, a: "middle" });
  }
  for (let k = f.y[0]; k <= f.y[1]; k++) {
    if (!zahlen(k)) continue;
    teile.push({ t: "linie", x1: px(0) - 4, y1: py(k), x2: px(0) + 4, y2: py(k), w: 1.2 });
    beschriftung({ t: "text", x: px(0) - 7, y: py(k), s: zahl(k * f.einheit), g: 12.5, a: "end" });
  }
  beschriftung({ t: "text", x: px(0) - 7, y: py(0) + 13, s: "0", g: 12.5, a: "end" });
  const e = f.einheit;
  // Namen am liebsten im Gitter, sonst knapp daneben
  const gitter: Rechteck = [px(f.x[0]) - 2, py(f.y[1]) - 2, px(f.x[1]) + 2, py(f.y[0]) + 2];
  const rand: Rechteck = [gitter[0] - 16, gitter[1] - 16, gitter[2] + 16, gitter[3] + 16];
  const strecken: [Punkt2, Punkt2][] = [];
  const geraden: { g: (typeof f.geraden)[number]; a: Punkt2; b: Punkt2 }[] = [];
  for (const g of f.geraden) {
    const seg = geradeImFenster(bruchWert(g.k), g.d, f.x[0] * e, f.x[1] * e, f.y[0] * e, f.y[1] * e);
    if (!seg) continue;
    const [a, b] = seg.map(([x, y]) => [px(x / e), py(y / e)] as Punkt2);
    teile.push({ t: "linie", x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 2.4 });
    strecken.push([a, b]);
    geraden.push({ g, a, b });
  }
  const punkte = f.punkte.map((p) => ({ p, x: px(p.x / e), y: py(p.y / e) }));
  for (const { x, y } of punkte) {
    teile.push({ t: "punkt", x, y, r: 4.5 });
    belegt.push([x - 5, y - 5, x + 5, y + 5]);
  }
  /**
   * Der Name kommt an die Stelle, an der er am wenigsten im Weg ist: am liebsten ganz frei, sonst mit möglichst
   * wenig Überdeckung; nie über eine Gerade, wenn es anders geht. Mit hellem Rand, damit das Gitter nicht stört.
   */
  const setzen = (moeglich: Teil[], eigen?: Punkt2) => {
    const kosten = (t: Teil) => {
      // mit 2 Einheiten Luft rundherum
      const [x0, y0, x1, y1] = umfang(t);
      const r: Rechteck = [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
      let k = innerhalb(r, gitter) ? 0 : innerhalb(r, rand) ? 40 : 5000;
      for (const o of belegt) if (ueberlappt(r, o)) k += (Math.min(r[2], o[2]) - Math.max(r[0], o[0])) * (Math.min(r[3], o[3]) - Math.max(r[1], o[1]));
      for (const [a, b] of strecken) if (trifft(a, b, r)) k += 1000;
      // der Name eines Punktes steht näher bei seinem Punkt als bei jedem anderen
      if (eigen) {
        const m: Punkt2 = [(x0 + x1) / 2, (y0 + y1) / 2];
        const d = Math.hypot(m[0] - eigen[0], m[1] - eigen[1]);
        for (const q of punkte) if ((q.x !== eigen[0] || q.y !== eigen[1]) && Math.hypot(m[0] - q.x, m[1] - q.y) < d + 4) k += 800;
      }
      return k;
    };
    let best = moeglich[0];
    let bestK = kosten(best);
    for (const t of moeglich.slice(1)) {
      if (bestK === 0) break;
      const k = kosten(t);
      if (k < bestK) [best, bestK] = [t, k];
    }
    beschriftung({ ...best, halo: true } as Teil);
  };
  for (const { p, x, y } of punkte) {
    const s = loesung ? `${p.name}(${zahl(p.x)} | ${zahl(p.y)})` : p.name;
    const text = (dx: number, dy: number, a: "start" | "end" | "middle"): Teil => ({ t: "text", x: x + dx, y: y + dy, s, g: 15, a, fett: true });
    setzen([text(7, -12, "start"), text(-7, -12, "end"), text(7, 12, "start"), text(-7, 12, "end"), text(9, 0, "start"), text(-9, 0, "end"), text(0, -15, "middle"), text(0, 15, "middle")], [x, y]);
  }
  for (const { g, a, b } of geraden) {
    if (!g.name) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: Punkt2 = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
    const moeglich: Teil[] = [];
    // der Name nahe am rechten Ende, ein Stück neben der Geraden; sonst weiter innen oder auf der anderen Seite
    for (const t of [0.85, 0.75, 0.15, 0.25, 0.62, 0.38])
      for (const seite of n[1] > 0 ? [-1, 1] : [1, -1]) {
        const nx = n[0] * seite;
        const ny = n[1] * seite;
        const anker = nx > 0.3 ? "start" : nx < -0.3 ? "end" : "middle";
        moeglich.push({ t: "text", x: a[0] + (b[0] - a[0]) * t + nx * 12, y: a[1] + (b[1] - a[1]) * t + ny * 14, s: g.name, g: 15, a: anker, fett: true });
      }
    setzen(moeglich);
  }
  // mit Lösung: die Gleichungen unter dem Koordinatensystem, je Gerade eine Zeile (so verdecken sie nichts)
  if (loesung)
    geraden.forEach(({ g }, i) =>
      teile.push({ t: "text", x: px(f.x[0]), y: py(f.y[0]) + 34 + i * 21, s: g.name === "f" ? geradenText(g.k, g.d, "f(x)") : `${g.name ? `${g.name}: ` : ""}${geradenText(g.k, g.d)}`, g: 15, a: "start", fett: true }),
    );
  return teile;
}

type Rechteck = [number, number, number, number];
const ueberlappt = (r: Rechteck, o: Rechteck) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1];
const innerhalb = (r: Rechteck, o: Rechteck) => r[0] >= o[0] && r[1] >= o[1] && r[2] <= o[2] && r[3] <= o[3];
/** Geht die Strecke a–b durch das Rechteck? (in kleinen Schritten geprüft, das reicht für Beschriftungen) */
function trifft(a: Punkt2, b: Punkt2, r: Rechteck): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const y = a[1] + ((b[1] - a[1]) * i) / n;
    if (x > r[0] - 1 && x < r[2] + 1 && y > r[1] - 1 && y < r[3] + 1) return true;
  }
  return false;
}

/** Liegt der Punkt im Vieleck? (gerade/ungerade Regel) */
function drinnen(p: Punkt2, poly: Punkt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const norm = ([x, y]: Punkt2): Punkt2 => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** Zeichen für den rechten Winkel an p zwischen den Richtungen u und v (Einheitsvektoren). */
function winkelzeichen(p: Punkt2, u: Punkt2, v: Punkt2, g = 11): Teil[] {
  return [
    { t: "weg", p: [[p[0] + u[0] * g, p[1] + u[1] * g], [p[0] + (u[0] + v[0]) * g, p[1] + (u[1] + v[1]) * g], [p[0] + v[0] * g, p[1] + v[1] * g]], zu: false, w: 1.2 },
    { t: "punkt", x: p[0] + (u[0] + v[0]) * g * 0.45, y: p[1] + (u[1] + v[1]) * g * 0.45, r: 1.3 },
  ];
}

function flaechenSzene(f: Flaeche, loesung: boolean): Teil[] {
  const alle: Punkt2[] = [...f.ecken, ...(f.strecken ?? []).flatMap((s) => [s.von, s.bis])];
  const minX = Math.min(...alle.map((p) => p[0]));
  const maxX = Math.max(...alle.map((p) => p[0]));
  const minY = Math.min(...alle.map((p) => p[1]));
  const maxY = Math.max(...alle.map((p) => p[1]));
  const s = Math.min(290 / Math.max(maxX - minX, 1e-6), 190 / Math.max(maxY - minY, 1e-6));
  const P = ([x, y]: Punkt2): Punkt2 => [(x - minX) * s, (maxY - y) * s];
  const ecken = f.ecken.map(P);
  const teile: Teil[] = [{ t: "weg", p: ecken, zu: true, w: 2, fuellung: "flaeche" }];
  const n = ecken.length;
  for (const i of f.rechteWinkel ?? []) {
    const p = ecken[i];
    teile.push(...winkelzeichen(p, norm([ecken[(i + n - 1) % n][0] - p[0], ecken[(i + n - 1) % n][1] - p[1]]), norm([ecken[(i + 1) % n][0] - p[0], ecken[(i + 1) % n][1] - p[1]])));
  }
  const G = 15;
  const beschriften = (a: Punkt2, b: Punkt2, text: string, fett: boolean) => {
    const mitte: Punkt2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let nrm = norm([b[1] - a[1], -(b[0] - a[0])]);
    if (drinnen([mitte[0] + nrm[0] * 4, mitte[1] + nrm[1] * 4], ecken)) nrm = [-nrm[0], -nrm[1]];
    // waagrechte Seite: Text darüber oder darunter; senkrechte und schräge Seite: Text daneben, nach außen
    const a2: "start" | "middle" | "end" = nrm[0] > 0.25 ? "start" : nrm[0] < -0.25 ? "end" : "middle";
    teile.push({
      t: "text",
      x: mitte[0] + nrm[0] * 9,
      y: mitte[1] + nrm[1] * (a2 === "middle" ? 13 : 11),
      s: text,
      g: G,
      a: a2,
      fett,
    });
  };
  for (const sd of f.seiten) {
    const text = loesung && sd.loesung ? sd.loesung : sd.text;
    if (text) beschriften(ecken[sd.von], ecken[(sd.von + 1) % n], text, Boolean(loesung && sd.loesung) || text.includes("?"));
  }
  for (const st of f.strecken ?? []) {
    const a = P(st.von);
    const b = P(st.bis);
    teile.push({ t: "linie", x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 1.6, stil: st.gestrichelt ? "strich" : undefined });
    if (st.rechterWinkel) {
      const u = norm([a[0] - b[0], a[1] - b[1]]);
      let v: Punkt2 = [-u[1], u[0]];
      if (!drinnen([b[0] + v[0] * 8 + u[0] * 4, b[1] + v[1] * 8 + u[1] * 4], ecken)) v = [-v[0], -v[1]];
      teile.push(...winkelzeichen(b, u, v, 9));
    }
    const text = loesung && st.loesung ? st.loesung : st.text;
    if (text) {
      // neben die Mitte der Strecke, quer zu ihr
      const mitte: Punkt2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const r = norm([b[1] - a[1], -(b[0] - a[0])]);
      const seite: Punkt2 = r[0] < 0 ? [-r[0], -r[1]] : r;
      teile.push({ t: "text", x: mitte[0] + seite[0] * 8, y: mitte[1] + seite[1] * 8 + (Math.abs(seite[0]) > 0.6 ? 0 : 12), s: text, g: G, a: Math.abs(seite[0]) > 0.6 ? "start" : "middle", fett: Boolean(loesung && st.loesung) || text.includes("?") });
    }
  }
  if (f.innen) {
    const [x, y] = P(f.innen.bei);
    teile.push({ t: "text", x, y, s: f.innen.text, g: G, a: "middle" });
  }
  (f.namen ?? []).forEach((name, i) => {
    if (!name) return;
    const p = ecken[i];
    const u = norm([ecken[(i + n - 1) % n][0] - p[0], ecken[(i + n - 1) % n][1] - p[1]]);
    const v = norm([ecken[(i + 1) % n][0] - p[0], ecken[(i + 1) % n][1] - p[1]]);
    let d = norm([-(u[0] + v[0]), -(u[1] + v[1])]);
    if (drinnen([p[0] + d[0] * 5, p[1] + d[1] * 5], ecken)) d = [-d[0], -d[1]];
    teile.push({ t: "text", x: p[0] + d[0] * 13, y: p[1] + d[1] * 13, s: name, g: 15, a: "middle", fett: true });
  });
  return teile;
}

/** Die Figur als Szene; null, wenn die gespeicherte Figur nicht lesbar ist. `loesung`: mit den gesuchten Werten (Lehrerfassung). */
export function figurSzene(raw: unknown, o: { loesung?: boolean } = {}): Szene | null {
  const f = leseFigur(raw);
  if (!f) return null;
  const roh = f.art === "zahlenstrahl" ? zahlenstrahlSzene(f, Boolean(o.loesung)) : f.art === "koordinaten" ? koordinatenSzene(f, Boolean(o.loesung)) : flaechenSzene(f, Boolean(o.loesung));
  const { b, h, teile } = einpassen(roh, 8);
  return { art: f.art, b, h, teile, beschreibung: figurBeschreibung(f) ?? FIGUR_ARTEN[f.art] };
}

// ---------- SVG ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (v: number) => String(Math.round(v * 10) / 10);
const GITTER = "#a9a9a9";

function teilSvg(t: Teil): string {
  switch (t.t) {
    case "linie":
      return `<line x1="${r1(t.x1)}" y1="${r1(t.y1)}" x2="${r1(t.x2)}" y2="${r1(t.y2)}" stroke="${t.stil === "gitter" ? GITTER : "currentColor"}" stroke-width="${t.w}"${t.stil === "strich" ? ' stroke-dasharray="6 4"' : ""} stroke-linecap="round"/>`;
    case "weg": {
      const d = t.p.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join(" ") + (t.zu ? " Z" : "");
      const fill = t.fuellung === "voll" ? ' fill="currentColor"' : t.fuellung === "flaeche" ? ' fill="currentColor" fill-opacity="0.06"' : ' fill="none"';
      return `<path d="${d}"${fill} stroke="currentColor" stroke-width="${t.w}" stroke-linejoin="round"/>`;
    }
    case "punkt":
      return `<circle cx="${r1(t.x)}" cy="${r1(t.y)}" r="${t.r}" fill="${t.offen ? "#fff" : "currentColor"}" stroke="currentColor" stroke-width="${t.offen ? 1.8 : 1}"/>`;
    case "text":
      return `<text x="${r1(t.x)}" y="${r1(t.y)}" font-size="${t.g}" text-anchor="${t.a}" dominant-baseline="central"${t.fett ? ' font-weight="700"' : ""} fill="currentColor"${t.halo ? ' stroke="#fff" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"' : ""}>${esc(t.s)}</text>`;
    case "bruch": {
      const w = Math.max(textBreite(t.z, t.g), textBreite(t.n, t.g)) + 4;
      const fw = t.fett ? ' font-weight="700"' : "";
      return (
        `<g fill="currentColor"${fw}>` +
        (t.minus ? `<text x="${r1(t.x - w / 2 - 2)}" y="${r1(t.y)}" font-size="${t.g}" text-anchor="end" dominant-baseline="central">−</text>` : "") +
        `<text x="${r1(t.x)}" y="${r1(t.y - t.g * 0.62)}" font-size="${t.g}" text-anchor="middle" dominant-baseline="central">${esc(t.z)}</text>` +
        `<line x1="${r1(t.x - w / 2)}" y1="${r1(t.y)}" x2="${r1(t.x + w / 2)}" y2="${r1(t.y)}" stroke="currentColor" stroke-width="1.2"/>` +
        `<text x="${r1(t.x)}" y="${r1(t.y + t.g * 0.66)}" font-size="${t.g}" text-anchor="middle" dominant-baseline="central">${esc(t.n)}</text>` +
        `</g>`
      );
    }
  }
}

/** Die Szene als SVG: role="img" mit Beschreibung, Striche in der Textfarbe (im Druck schwarz). */
export function szeneSvg(s: Szene): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.b} ${s.h}" width="${s.b}" height="${s.h}" class="figur-bild figur-${s.art}" role="img" aria-label="${esc(s.beschreibung)}">${s.teile.map(teilSvg).join("")}</svg>`;
}

/** Das Bild einer Aufgabe als SVG, oder null ohne (lesbare) Figur. Ein Zeichner für alle Stellen. */
export function figurSvg(raw: unknown, o: { loesung?: boolean } = {}): string | null {
  const s = figurSzene(raw, o);
  return s ? szeneSvg(s) : null;
}

/** Hat die Aufgabe ein Bild? */
export const hatFigur = (data: { figure?: unknown } | null | undefined) => Boolean(data && leseFigur(data.figure));

/**
 * Schlüssel, um doppelte Aufgaben zu erkennen. Aufgaben mit Bild haben oft denselben Text („Welche Zahl ist bei
 * A markiert?“) und unterscheiden sich nur im Bild; ohne Bild ist es der Text allein, wie bisher. Bei „Fehler
 * korrigieren“ gehört der Text mit den Fehlern dazu: die Aufgabenstellung ist oft für alle dieselbe.
 */
export function aufgabenSchluessel(t: { prompt: string; data?: { figure?: unknown; faulty?: string } | null }): string {
  const text = t.data?.faulty ? `${t.prompt}\n${t.data.faulty}` : t.prompt;
  return t.data?.figure ? `${text}\n${JSON.stringify(t.data.figure)}` : text;
}
