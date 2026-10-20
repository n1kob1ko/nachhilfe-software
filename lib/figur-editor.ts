/**
 * Das Bild einer Aufgabe im Editor ändern (components/FigurEditor.tsx): jede Art von Bild als einfache Textfelder,
 * so wie die Lehrkraft sie liest (Anfang, Ende und Schritt eines Zahlenstrahls; Punkte mit Namen; Längen einer
 * Figur; Radius und Teil eines Kreises; Werte eines Diagramms), und zurück. Was zurückkommt, geht immer durch
 * `leseFigur` (lib/figur.ts): ein Bild, das nicht stimmt, wird nicht übernommen, der Editor zeigt den Grund.
 *
 * Die Lösung der Aufgabe wird nicht neu gerechnet: wer Zahlen im Bild ändert, prüft selbst, ob Aufgabe und Lösung
 * noch passen. Ohne React, damit es sich testen lässt.
 */
import {
  bruchText,
  bruchWert,
  figurFehler,
  kreisWinkel,
  kuerzen,
  leseFigur,
  zahl,
  zahlBei,
  type Bruch,
  type Diagramm,
  type DiagrammForm,
  type Figur,
  type Flaeche,
  type FlaechenForm,
  type Koordinaten,
  type Kreis,
  type KreisTeil,
  type Punkt2,
  type Zahlenstrahl,
} from "./figur";

export type StrahlFelder = {
  art: "zahlenstrahl";
  anfang: string;
  ende: string;
  /** Wert eines Teilstücks: „10“, „0,1“, „1/4“ */
  schritt: string;
  format: Zahlenstrahl["format"];
  /** Zahlen unter den Strichen, mit ; getrennt */
  zahlen: string;
  marken: { name: string; wert: string }[];
  /** ein Bereich: leer = ins Unendliche */
  intervall: { von: string; bis: string; vonDabei: boolean; bisDabei: boolean } | null;
};
export type KoordFelder = {
  art: "koordinaten";
  xVon: string;
  xBis: string;
  yVon: string;
  yBis: string;
  /** Wert eines Kästchens */
  einheit: string;
  zahlenAlle: string;
  punkte: { name: string; x: string; y: string }[];
  geraden: { name: string; k: string; d: string }[];
};
export type FlaechenFelder = {
  art: "figur";
  form: FlaechenForm;
  /** Längen im Bild je Form (MASSE), nur für die Zeichnung */
  masse: Record<string, string>;
  /** Namen der Ecken, mit Leerzeichen getrennt („A B C“) */
  namen: string;
  /** eine Zeile je Seite, in der Reihenfolge der Ecken */
  seiten: { text: string; loesung: string }[];
  /** Höhe oder Diagonale: nur Beschriftung, die Lage folgt aus den Längen */
  strecken: { text: string; loesung: string }[];
  innen: string;
};
export type KreisFelder = {
  art: "kreis";
  teil: KreisTeil;
  winkel: string;
  strecke: Kreis["strecke"];
  text: string;
  loesung: string;
  mitte: string;
  winkelZeigen: boolean;
  getoent: boolean;
  ganzerKreis: boolean;
};
export type DiagrammFelder = {
  art: "diagramm";
  form: DiagrammForm;
  titel: string;
  achse: string;
  min: string;
  max: string;
  schritt: string;
  zahlenAlle: string;
  werte: { name: string; wert: string; gesucht: boolean }[];
  werteZeigen: boolean;
};
export type FigurFelder = StrahlFelder | KoordFelder | FlaechenFelder | KreisFelder | DiagrammFelder;

/** Die Längen, die eine Figur je Form bestimmen (Breite und Höhe, Grundseite und Höhe …). */
export const MASSE: Record<FlaechenForm, { key: string; label: string }[]> = {
  rechteck: [
    { key: "a", label: "Breite" },
    { key: "b", label: "Höhe" },
  ],
  quadrat: [{ key: "a", label: "Seitenlänge" }],
  dreieck: [
    { key: "c", label: "Grundseite" },
    { key: "h", label: "Höhe" },
    { key: "p", label: "Fußpunkt der Höhe (von links)" },
  ],
  gleichschenklig: [
    { key: "c", label: "Grundseite" },
    { key: "h", label: "Höhe" },
  ],
  rechtwinklig: [
    { key: "a", label: "Seite unten" },
    { key: "b", label: "Seite links" },
  ],
  "l-form": [
    { key: "B", label: "Breite" },
    { key: "H", label: "Höhe" },
    { key: "w", label: "Ecke rechts oben, die fehlt: Breite" },
    { key: "h", label: "Ecke rechts oben, die fehlt: Höhe" },
  ],
};
/** Wo jede Seite im Bild liegt (Seite i geht von Ecke i zur nächsten). */
export const SEITEN: Record<FlaechenForm, string[]> = {
  rechteck: ["unten", "rechts", "oben", "links"],
  quadrat: ["unten", "rechts", "oben", "links"],
  dreieck: ["unten", "rechts", "links"],
  gleichschenklig: ["unten", "rechts", "links"],
  rechtwinklig: ["unten", "schräg", "links"],
  "l-form": ["unten", "rechts", "Stufe waagrecht", "Stufe senkrecht", "oben", "links"],
};
const RECHTE_WINKEL: Record<FlaechenForm, number[]> = { rechteck: [0], quadrat: [0], dreieck: [], gleichschenklig: [], rechtwinklig: [0], "l-form": [0] };

// ---------- Zahlen, wie sie getippt werden ----------

/** „−3“, „-3“, „0,5“, „0.5“, „1 250“; sonst null. */
export function leseZahl(s: string): number | null {
  const t = s.trim().replace(/\s+/g, "").replace(/−/g, "-").replace(",", ".");
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}
/** Genau als Bruch: „1/4“, „−1/2“, „0,1“ (= 1/10), „3“; sonst null. */
export function leseBruch(s: string): Bruch | null {
  const t = s.trim().replace(/\s+/g, "").replace(/−/g, "-");
  const b = t.match(/^(-?\d+)\/(\d+)$/);
  if (b) return Number(b[2]) === 0 ? null : kuerzen({ z: Number(b[1]), n: Number(b[2]) });
  const d = t.replace(",", ".").match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/);
  if (!d) return null;
  const n = 10 ** (d[3]?.length ?? 0);
  return kuerzen({ z: Number(`${d[2]}${d[3] ?? ""}`) * (d[1] ? -1 : 1), n });
}
/** Zahlen in einer Zeile: mit ; oder Leerzeichen getrennt, auch „300, 350“ (Beistrich mit Leerzeichen danach). */
const liste = (s: string) => s.split(/;|,\s+|\s+/).map((x) => x.trim()).filter(Boolean);
const name3 = (s: string) => s.trim().slice(0, 3);
const leer = (...xs: string[]) => xs.every((x) => !x.trim());
/** Zahl für ein Feld: ohne Leerzeichen zwischen den Dreiergruppen (lässt sich so leichter ändern). */
const feld = (v: number) => zahl(v).replace(/\s/g, "");

// ---------- Bild → Felder ----------

export function felderAus(f: Figur): FigurFelder {
  if (f.art === "zahlenstrahl") {
    const bei = (i: number) => zahlBei(f, i);
    const s = f.schritt;
    return {
      art: "zahlenstrahl",
      anfang: bei(0),
      ende: bei(f.schritte),
      schritt: f.format === "bruch" ? bruchText(s) : feld(bruchWert(s)),
      format: f.format,
      zahlen: f.beschriftet.map(bei).join("; "),
      marken: f.marken.map((m) => ({ name: m.name, wert: bei(m.bei) })),
      intervall: f.intervall
        ? { von: f.intervall.von === null ? "" : bei(f.intervall.von), bis: f.intervall.bis === null ? "" : bei(f.intervall.bis), vonDabei: f.intervall.vonDabei, bisDabei: f.intervall.bisDabei }
        : null,
    };
  }
  if (f.art === "koordinaten") {
    return {
      art: "koordinaten",
      xVon: feld(f.x[0] * f.einheit),
      xBis: feld(f.x[1] * f.einheit),
      yVon: feld(f.y[0] * f.einheit),
      yBis: feld(f.y[1] * f.einheit),
      einheit: feld(f.einheit),
      zahlenAlle: String(f.zahlenAlle),
      punkte: f.punkte.map((p) => ({ name: p.name, x: feld(p.x), y: feld(p.y) })),
      geraden: f.geraden.map((g) => ({ name: g.name, k: bruchText(g.k), d: feld(g.d) })),
    };
  }
  if (f.art === "figur") {
    return {
      art: "figur",
      form: f.form,
      masse: masseAus(f),
      namen: (f.namen ?? []).join(" ").trim(),
      seiten: f.ecken.map((_, i) => {
        const s = f.seiten.find((x) => x.von === i);
        return { text: s?.text ?? "", loesung: s?.loesung ?? "" };
      }),
      strecken: (f.strecken ?? []).map((s) => ({ text: s.text ?? "", loesung: s.loesung ?? "" })),
      innen: f.innen?.text ?? "",
    };
  }
  if (f.art === "kreis") {
    return { art: "kreis", teil: f.teil, winkel: String(f.winkel), strecke: f.strecke, text: f.text, loesung: f.loesung ?? "", mitte: f.mitte, winkelZeigen: f.winkelZeigen, getoent: f.getoent, ganzerKreis: f.ganzerKreis };
  }
  return {
    art: "diagramm",
    form: f.form,
    titel: f.titel,
    achse: f.achse,
    min: feld(f.min),
    max: feld(f.max),
    schritt: feld(f.schritt),
    zahlenAlle: String(f.zahlenAlle),
    werte: f.werte.map((w) => ({ name: w.name, wert: feld(w.wert), gesucht: Boolean(w.gesucht) })),
    werteZeigen: f.werteZeigen,
  };
}

/** Die Längen einer Figur aus ihren Ecken (so, wie lib/generators-figur.ts sie anlegt). */
function masseAus(f: Flaeche): Record<string, string> {
  const e = f.ecken;
  const xs = e.map((p) => p[0]);
  const ys = e.map((p) => p[1]);
  const breite = Math.max(...xs) - Math.min(...xs);
  const hoehe = Math.max(...ys) - Math.min(...ys);
  switch (f.form) {
    case "quadrat":
      return { a: feld(breite) };
    case "dreieck":
      return { c: feld(e[1][0] - e[0][0]), h: feld(e[2][1] - e[0][1]), p: feld(e[2][0] - e[0][0]) };
    case "gleichschenklig":
      return { c: feld(e[1][0] - e[0][0]), h: feld(e[2][1] - e[0][1]) };
    case "l-form":
      return e.length === 6 ? { B: feld(breite), H: feld(hoehe), w: feld(e[2][0] - e[3][0]), h: feld(e[4][1] - e[3][1]) } : { B: feld(breite), H: feld(hoehe), w: feld(breite / 2), h: feld(hoehe / 2) };
    default:
      return { a: feld(breite), b: feld(hoehe) };
  }
}

/** Eine andere Form: Längen ungefähr so groß wie bisher, Beschriftungen bleiben, soweit es die Seiten noch gibt. */
export function mitForm(v: FlaechenFelder, form: FlaechenForm): FlaechenFelder {
  if (v.form === form) return v;
  const zahlen = Object.values(v.masse).map(leseZahl).filter((x): x is number => x !== null && x > 0);
  const b = zahlen[0] ?? 6;
  const h = zahlen[1] ?? b;
  const masse: Record<string, string> =
    form === "quadrat"
      ? { a: feld(b) }
      : form === "dreieck"
        ? { c: feld(b), h: feld(h), p: feld(Math.round((b / 3) * 10) / 10) }
        : form === "gleichschenklig"
          ? { c: feld(b), h: feld(h) }
          : form === "l-form"
            ? { B: feld(b), H: feld(h), w: feld(Math.round((b / 2) * 10) / 10), h: feld(Math.round((h / 2) * 10) / 10) }
            : { a: feld(b), b: feld(h) };
  const n = SEITEN[form].length;
  const dreiecke = (x: FlaechenForm) => x === "dreieck" || x === "gleichschenklig";
  return {
    ...v,
    form,
    masse,
    namen: v.namen.split(/\s+/).filter(Boolean).slice(0, n).join(" "),
    seiten: Array.from({ length: n }, (_, i) => v.seiten[i] ?? { text: "", loesung: "" }),
    // eine Höhe passt nur zu einem anderen Dreieck
    strecken: dreiecke(v.form) && dreiecke(form) ? v.strecken : [],
  };
}

// ---------- Felder → Bild ----------

/**
 * Das Bild aus den Feldern, geprüft wie alles, was gespeichert wird; sonst der Grund in einem kurzen Satz.
 * `alt` ist das Bild vor dem Bearbeiten (für die Lage von Höhe, Diagonale und Text in einer Figur).
 */
export function figurAus(v: FigurFelder, alt: Figur): { figur: Figur; fehler: null } | { figur: null; fehler: string } {
  const roh =
    v.art === "zahlenstrahl" ? strahlAus(v) : v.art === "koordinaten" ? koordAus(v) : v.art === "figur" ? flaecheAus(v, alt) : v.art === "kreis" ? kreisAus(v) : diagrammAus(v);
  if (typeof roh === "string") return { figur: null, fehler: roh };
  const fehler = figurFehler(roh);
  const figur = leseFigur(roh);
  return fehler || !figur ? { figur: null, fehler: fehler ?? "Das Bild stimmt nicht." } : { figur, fehler: null };
}

function strahlAus(v: StrahlFelder): Zahlenstrahl | string {
  const a = leseBruch(v.anfang);
  const e = leseBruch(v.ende);
  const s = leseBruch(v.schritt);
  if (!a) return "Der Anfang ist keine Zahl.";
  if (!e) return "Das Ende ist keine Zahl.";
  if (!s || s.z <= 0) return "Ein Teilstück muss eine Zahl größer als 0 sein.";
  /** Nummer des Teilstrichs mit diesem Wert, oder null, wenn kein Strich dort ist. */
  const strich = (b: Bruch) => {
    const q = (bruchWert(b) - bruchWert(a)) / bruchWert(s);
    return Math.abs(q - Math.round(q)) < 1e-9 ? Math.round(q) : null;
  };
  const schritte = strich(e);
  if (schritte === null || schritte < 1) return "Vom Anfang bis zum Ende muss eine ganze Zahl von Teilstücken passen, und das Ende muss größer sein.";
  const auf = (text: string, wer: string): number | string => {
    const b = leseBruch(text);
    if (!b) return `${wer}: „${text}“ ist keine Zahl.`;
    const i = strich(b);
    return i === null || i < 0 || i > schritte ? `${wer}: ${text} liegt auf keinem Teilstrich.` : i;
  };
  const beschriftet: number[] = [];
  for (const x of liste(v.zahlen)) {
    const i = auf(x, "Zahl am Strahl");
    if (typeof i === "string") return i;
    beschriftet.push(i);
  }
  const marken: Zahlenstrahl["marken"] = [];
  for (const m of v.marken) {
    if (leer(m.name, m.wert)) continue;
    if (!m.name.trim()) return "Jede Marke braucht einen Namen (A, B …).";
    const i = auf(m.wert, `Marke ${name3(m.name)}`);
    if (typeof i === "string") return i;
    marken.push({ name: name3(m.name), bei: i });
  }
  let intervall: Zahlenstrahl["intervall"] = null;
  if (v.intervall) {
    const von = v.intervall.von.trim() ? auf(v.intervall.von, "Bereich von") : null;
    const bis = v.intervall.bis.trim() ? auf(v.intervall.bis, "Bereich bis") : null;
    if (typeof von === "string") return von;
    if (typeof bis === "string") return bis;
    if (von !== null && bis !== null && von > bis) return "Der Bereich muss links beginnen: „von“ ist kleiner als „bis“.";
    intervall = { von, bis, vonDabei: v.intervall.vonDabei, bisDabei: v.intervall.bisDabei };
  }
  return { art: "zahlenstrahl", start: bruchWert(a), schritt: s, schritte, beschriftet, format: v.format, marken, ...(intervall ? { intervall } : {}) };
}

function koordAus(v: KoordFelder): Koordinaten | string {
  const einheit = leseZahl(v.einheit);
  if (einheit === null || einheit <= 0) return "Ein Kästchen muss eine Zahl größer als 0 sein.";
  const kaestchen = (text: string, was: string): number | string => {
    const w = leseZahl(text);
    if (w === null) return `${was} ist keine Zahl.`;
    const k = w / einheit;
    return Math.abs(k - Math.round(k)) < 1e-9 ? Math.round(k) : `${was} muss auf einem Kästchen liegen (ein Kästchen ist ${feld(einheit)}).`;
  };
  const bereich = [kaestchen(v.xVon, "x von"), kaestchen(v.xBis, "x bis"), kaestchen(v.yVon, "y von"), kaestchen(v.yBis, "y bis")];
  const falsch = bereich.find((x) => typeof x === "string");
  if (falsch) return falsch as string;
  const [x0, x1, y0, y1] = bereich as number[];
  const zahlenAlle = Number(v.zahlenAlle);
  if (!Number.isInteger(zahlenAlle) || zahlenAlle < 1 || zahlenAlle > 10) return "Zahl an jedem … Kästchen: eine ganze Zahl von 1 bis 10.";
  const punkte: Koordinaten["punkte"] = [];
  for (const p of v.punkte) {
    if (leer(p.name, p.x, p.y)) continue;
    const x = leseZahl(p.x);
    const y = leseZahl(p.y);
    if (x === null || y === null) return `Punkt ${name3(p.name)}: x und y müssen Zahlen sein.`;
    if (x < x0 * einheit || x > x1 * einheit || y < y0 * einheit || y > y1 * einheit) return `Punkt ${name3(p.name)} liegt außerhalb des Bereichs.`;
    punkte.push({ name: name3(p.name), x, y });
  }
  const geraden: Koordinaten["geraden"] = [];
  for (const g of v.geraden) {
    if (leer(g.name, g.k, g.d)) continue;
    const k = leseBruch(g.k);
    const d = leseZahl(g.d);
    if (!k || d === null) return `Gerade ${name3(g.name)}: k und d müssen Zahlen sein (k auch als Bruch, etwa −1/2).`;
    geraden.push({ name: name3(g.name), k, d });
  }
  return { art: "koordinaten", x: [x0, x1], y: [y0, y1], einheit, zahlenAlle, punkte, geraden };
}

/** Die Ecken einer Form aus ihren Längen (gegen den Uhrzeigersinn, links unten beginnend). */
function eckenAus(form: FlaechenForm, m: Record<string, number>): Punkt2[] | string {
  switch (form) {
    case "rechteck":
      return [[0, 0], [m.a, 0], [m.a, m.b], [0, m.b]];
    case "quadrat":
      return [[0, 0], [m.a, 0], [m.a, m.a], [0, m.a]];
    case "dreieck":
      if (m.p < 0 || m.p > m.c) return "Der Fußpunkt der Höhe muss auf der Grundseite liegen (zwischen 0 und der Grundseite).";
      return [[0, 0], [m.c, 0], [m.p, m.h]];
    case "gleichschenklig":
      return [[0, 0], [m.c, 0], [m.c / 2, m.h]];
    case "rechtwinklig":
      return [[0, 0], [m.a, 0], [0, m.b]];
    case "l-form":
      if (m.w >= m.B || m.h >= m.H) return "Die fehlende Ecke muss schmäler und niedriger sein als die ganze Figur.";
      return [[0, 0], [m.B, 0], [m.B, m.H - m.h], [m.B - m.w, m.H - m.h], [m.B - m.w, m.H], [0, m.H]];
  }
}

function flaecheAus(v: FlaechenFelder, alt: Figur): Flaeche | string {
  const m: Record<string, number> = {};
  for (const { key, label } of MASSE[v.form]) {
    const x = leseZahl(v.masse[key] ?? "");
    if (x === null || x < 0 || (key !== "p" && x === 0)) return `${label}: eine Zahl größer als 0.`;
    m[key] = x;
  }
  const ecken = eckenAus(v.form, m);
  if (typeof ecken === "string") return ecken;
  const vorher = alt.art === "figur" ? alt : null;
  const gleich = vorher?.form === v.form && vorher.ecken.length === ecken.length;
  // Höhe, Diagonale und Text in der Figur: Ecken bleiben Ecken, der Fußpunkt der Höhe bleibt unter der Spitze, alles andere wird gestreckt
  const bx = (p: Punkt2[]) => [Math.max(...p.map((q) => q[0])) || 1, Math.max(...p.map((q) => q[1])) || 1];
  const [aw, ah] = vorher ? bx(vorher.ecken) : [1, 1];
  const [nw, nh] = bx(ecken);
  const neu = (p: Punkt2): Punkt2 => {
    if (vorher) {
      const spitze = vorher.ecken[2];
      if (ecken.length === 3 && vorher.ecken.length === 3 && Math.abs(p[1]) < 1e-9 && Math.abs(p[0] - spitze[0]) < 1e-9) return [ecken[2][0], 0];
      const i = vorher.ecken.findIndex((q) => Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9);
      if (i >= 0 && i < ecken.length) return ecken[i];
    }
    return [(p[0] / aw) * nw, (p[1] / ah) * nh];
  };
  const alteStrecken = vorher?.strecken ?? [];
  const strecken = v.strecken.flatMap((s, i) => {
    const a = alteStrecken[i];
    if (!a) return [];
    const text = s.text.trim();
    const loesung = s.loesung.trim();
    return [{ von: neu(a.von), bis: neu(a.bis), ...(text ? { text } : {}), ...(loesung ? { loesung } : {}), gestrichelt: a.gestrichelt, rechterWinkel: a.rechterWinkel }];
  });
  const mitte: Punkt2 = [ecken.reduce((x, p) => x + p[0], 0) / ecken.length, ecken.reduce((y, p) => y + p[1], 0) / ecken.length];
  const innen = v.innen.trim() ? { text: v.innen.trim(), bei: gleich && vorher?.innen ? neu(vorher.innen.bei) : mitte } : null;
  const namen = v.namen.split(/\s+/).filter(Boolean).map(name3);
  return {
    art: "figur",
    form: v.form,
    ecken,
    ...(namen.length ? { namen: Array.from({ length: ecken.length }, (_, i) => namen[i] ?? "") } : {}),
    seiten: v.seiten.slice(0, ecken.length).flatMap((s, von) => (s.text.trim() ? [{ von, text: s.text.trim(), ...(s.loesung.trim() ? { loesung: s.loesung.trim() } : {}) }] : [])),
    rechteWinkel: gleich ? (vorher?.rechteWinkel ?? []).filter((i) => i < ecken.length) : RECHTE_WINKEL[v.form],
    strecken,
    innen,
  };
}

function kreisAus(v: KreisFelder): Kreis | string {
  const winkel = v.teil === "sektor" ? Number(v.winkel.trim().replace(/°$/, "")) : kreisWinkel({ teil: v.teil, winkel: 0 });
  if (v.teil === "sektor" && !(Number.isInteger(winkel) && winkel >= 1 && winkel <= 359)) return "Der Winkel des Kreissektors: eine ganze Zahl von 1 bis 359.";
  if (v.strecke !== "keine" && !v.text.trim()) return "Die Strecke braucht eine Beschriftung (etwa r = 5 cm oder r = ?).";
  return {
    art: "kreis",
    teil: v.teil,
    winkel,
    strecke: v.strecke,
    text: v.strecke === "keine" ? "" : v.text.trim(),
    ...(v.loesung.trim() && v.strecke !== "keine" ? { loesung: v.loesung.trim() } : {}),
    mitte: name3(v.mitte),
    winkelZeigen: v.winkelZeigen,
    getoent: v.getoent,
    ganzerKreis: v.ganzerKreis,
  };
}

function diagrammAus(v: DiagrammFelder): Diagramm | string {
  const min = leseZahl(v.min);
  const max = leseZahl(v.max);
  const schritt = leseZahl(v.schritt);
  if (min === null || max === null) return "Anfang und Ende der Achse müssen Zahlen sein.";
  if (schritt === null || schritt <= 0) return "Der Abstand der Gitterlinien muss eine Zahl größer als 0 sein.";
  if (max <= min) return "Das Ende der Achse muss größer sein als der Anfang.";
  const zahlenAlle = Number(v.zahlenAlle);
  if (!Number.isInteger(zahlenAlle) || zahlenAlle < 1 || zahlenAlle > 10) return "Zahl an jeder … Linie: eine ganze Zahl von 1 bis 10.";
  const werte: Diagramm["werte"] = [];
  for (const w of v.werte) {
    if (leer(w.name, w.wert)) continue;
    const x = leseZahl(w.wert);
    if (x === null) return `Der Wert bei ${w.name.trim() || "einer Säule"} ist keine Zahl.`;
    werte.push({ name: w.name.trim(), wert: x, ...(w.gesucht ? { gesucht: true } : {}) });
  }
  return { art: "diagramm", form: v.form, titel: v.titel.trim(), achse: v.achse.trim(), min, max, schritt, zahlenAlle, werte, werteZeigen: v.werteZeigen };
}

// ---------- Hinweise, die nicht verhindern, dass gespeichert wird ----------

/**
 * Passt die Beschriftung zur Zeichnung? „a = 8 cm“ an einer Seite, die im Bild 6 lang ist, wird gemeldet (die
 * Figur ist dann nicht maßstäblich). Nur ein Hinweis: manchmal ist das Absicht.
 */
export function figurHinweise(f: Figur): string[] {
  if (f.art !== "figur") return [];
  const out: string[] = [];
  const laenge = (a: Punkt2, b: Punkt2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pruefen = (text: string | undefined, l: number, wo: string) => {
    const m = text?.match(/(\d+(?:,\d+)?)\s*(?:mm|cm|dm|km|m)$/);
    if (m && Math.abs(Number(m[1].replace(",", ".")) - l) > 0.05) out.push(`${wo}: beschriftet mit ${m[0]}, im Bild ${zahl(Math.round(l * 100) / 100)} lang.`);
  };
  for (const s of f.seiten) pruefen(s.loesung ?? s.text, laenge(f.ecken[s.von], f.ecken[(s.von + 1) % f.ecken.length]), `Seite ${SEITEN[f.form][s.von] ?? s.von + 1}`);
  for (const s of f.strecken ?? []) pruefen(s.loesung ?? s.text, laenge(s.von, s.bis), "Strecke");
  return out;
}
