/**
 * Funkelfeld (niko 2026-11-16: „mach weitere spiele“, ein Drei-in-einer-Reihe-Spiel, bei dem eine Antwort neue Züge
 * bringt): leuchtende Steine in sieben Formen und Farben liegen auf einem Feld aus 7 × 7. Zwei Nachbarn tauschen; drei
 * oder mehr gleiche in einer Reihe oder Spalte leuchten auf und verschwinden, von oben fallen neue nach. Eigene Regeln
 * und ein eigener Look, kein Nachbau eines bekannten Spiels (components/lernen/FunkelFeld.tsx, docs/lernspiele.md
 * „Funkelfeld“). Hier steht nur die Spiellogik, ohne React und ohne Datenbank (lib/funkelfeld.test.ts).
 *
 * - Ein Tausch zählt nur, wenn er etwas auflöst; sonst springen die Steine zurück und es kostet keinen Zug.
 * - Vier in einer Linie werden ein Strahl: er räumt beim Auflösen seine ganze Reihe (waagrecht gelegt) oder Spalte.
 * - Fünf in einer Linie oder ein Winkel (L, T, Kreuz) werden ein Funke: getauscht mit einem Stein räumt er alle
 *   Steine dieser Form.
 * - Die Züge gehen aus: dann kommt eine Frage aus dem Stoff (Lernspiel.tsx). Richtig beim ersten Versuch bringt neue
 *   Züge und Punkte, falsch weniger Züge und ein Herz weniger; ohne Herzen ist das Spiel aus.
 *
 * Das Feld ist eine Liste von Reihen × Spalten Plätzen, oben links zuerst (Index = Reihe · SPALTEN + Spalte).
 */

export const SPALTEN = 7;
export const REIHEN = 7;
export const PLAETZE = SPALTEN * REIHEN;
/** So viele Formen liegen auf dem Feld. */
export const FORMEN = 5;

export type Spezial = "reihe" | "spalte" | "funke";
/** Ein Stein: `id` bleibt, solange er liegt (so gleitet er beim Fallen), `f`: die Form (0 bis FORMEN − 1; ein Funke hat −1). */
export type Stein = { id: number; f: number; sp?: Spezial };
export type Feld = (Stein | null)[];

export const reiheVon = (i: number) => Math.floor(i / SPALTEN);
export const spalteVon = (i: number) => i % SPALTEN;
export const platz = (r: number, s: number) => r * SPALTEN + s;

/** Sind zwei Plätze Nachbarn (oben, unten, links, rechts)? */
export function nachbarn(a: number, b: number): boolean {
  if (a < 0 || b < 0 || a >= PLAETZE || b >= PLAETZE) return false;
  const dr = Math.abs(reiheVon(a) - reiheVon(b));
  const ds = Math.abs(spalteVon(a) - spalteVon(b));
  return dr + ds === 1;
}

// ---------- Punkte, Züge, Herzen ----------

export const FUNKEL_HERZEN = 3;
export const ZUEGE_START = 8;
/** Punkte je Stein, mal der Stufe der Kettenreaktion (1, 2, 3 …); ein neuer Strahl oder Funke gibt etwas dazu. */
export const FUNKEL_PUNKTE = { stein: 10, strahl: 60, funke: 120, frage: 60 } as const;

/**
 * Neue Züge für eine Antwort: richtig beim ersten Versuch zuerst sechs, alle sechs Fragen einer weniger (mindestens
 * drei), damit ein Spiel nicht ewig dauert; falsch zwei (und ein Herz ist weg).
 */
export function zugBonus(fragen: number, sauber: boolean): number {
  if (!sauber) return 2;
  return Math.max(3, 6 - Math.floor(fragen / 6));
}

/** Höchstens so viele Punkte nimmt der Server an. */
export const FUNKEL_PUNKTE_MAX = 3_000_000;
export const gueltigeFunkelPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(FUNKEL_PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);

// ---------- Zufall ----------

/** Fester Zufall aus einer Zahl (dasselbe Spiel, dasselbe Feld). */
export function funkelZufall(seed: number): () => number {
  let x = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/** Zählt die ids der Steine hoch (jeder neue Stein bekommt eine eigene). */
export type Zaehler = { n: number };

const neuerStein = (f: number, z: Zaehler, sp?: Spezial): Stein => ({ id: ++z.n, f, ...(sp ? { sp } : {}) });

// ---------- Treffer ----------

/** Dieselbe Form? Ein Funke passt zu nichts. */
const gleich = (a: Stein | null, b: Stein | null) => !!a && !!b && a.f >= 0 && a.f === b.f;

/** Eine Linie aus drei oder mehr gleichen Steinen. */
export type Linie = { zellen: number[]; richtung: "waag" | "senk" };

/** Alle Linien aus drei oder mehr gleichen Steinen. */
export function linien(feld: Feld): Linie[] {
  const out: Linie[] = [];
  for (let r = 0; r < REIHEN; r++) {
    let s = 0;
    while (s < SPALTEN) {
      let e = s + 1;
      while (e < SPALTEN && gleich(feld[platz(r, s)], feld[platz(r, e)])) e++;
      if (e - s >= 3) out.push({ zellen: Array.from({ length: e - s }, (_, k) => platz(r, s + k)), richtung: "waag" });
      s = e;
    }
  }
  for (let s = 0; s < SPALTEN; s++) {
    let r = 0;
    while (r < REIHEN) {
      let e = r + 1;
      while (e < REIHEN && gleich(feld[platz(r, s)], feld[platz(e, s)])) e++;
      if (e - r >= 3) out.push({ zellen: Array.from({ length: e - r }, (_, k) => platz(r + k, s)), richtung: "senk" });
      r = e;
    }
  }
  return out;
}

/** Linien, die sich berühren (ein L, ein T, ein Kreuz), sind eine Gruppe. */
export type Gruppe = { zellen: number[]; linien: Linie[] };

export function gruppen(feld: Feld): Gruppe[] {
  const ls = linien(feld);
  const out: Gruppe[] = [];
  for (const l of ls) {
    const dabei = out.filter((g) => g.zellen.some((z) => l.zellen.includes(z)));
    const neu: Gruppe = { zellen: [...new Set([...dabei.flatMap((g) => g.zellen), ...l.zellen])], linien: [...dabei.flatMap((g) => g.linien), l] };
    for (const g of dabei) out.splice(out.indexOf(g), 1);
    out.push(neu);
  }
  return out;
}

/** Löst ein Tausch etwas aus (eine Linie oder ein Funke)? */
export function tauschWirkt(feld: Feld, a: number, b: number): boolean {
  if (!nachbarn(a, b) || !feld[a] || !feld[b]) return false;
  if (feld[a]!.sp === "funke" || feld[b]!.sp === "funke") return true;
  const t = tausche(feld, a, b);
  return linien(t).some((l) => l.zellen.includes(a) || l.zellen.includes(b));
}

export function tausche(feld: Feld, a: number, b: number): Feld {
  const out = [...feld];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

/** Gibt es noch einen Tausch, der etwas auslöst? */
export function hatZug(feld: Feld): boolean {
  return einZug(feld) !== null;
}

/** Ein Tausch, der etwas auslöst (für einen Tipp, wenn man lange nichts findet), oder null. */
export function einZug(feld: Feld): [number, number] | null {
  for (let i = 0; i < PLAETZE; i++) {
    const rechts = spalteVon(i) < SPALTEN - 1 ? i + 1 : -1;
    const unten = reiheVon(i) < REIHEN - 1 ? i + SPALTEN : -1;
    for (const j of [rechts, unten]) if (j >= 0 && tauschWirkt(feld, i, j)) return [i, j];
  }
  return null;
}

// ---------- Auflösen ----------

/** Ein Stein, der verschwindet: wo er lag, seine Form und warum (für das Aufleuchten). */
export type Weg = { i: number; f: number; durch: "linie" | "strahl" | "funke" };

export type Schritt = {
  feld: Feld;
  weg: Weg[];
  /** neue Strahlen und Funken (wo sie liegen) */
  neu: { i: number; sp: Spezial }[];
  /** ausgelöste Strahlen und Funken (für Bild und Ton) */
  ausgeloest: { i: number; sp: Spezial }[];
  punkte: number;
};

/**
 * Räumt alle Linien des Felds einmal ab (ohne Nachfallen). `bei`: die zwei getauschten Plätze; ein neuer Strahl oder
 * Funke entsteht dort, wo getauscht wurde, sonst in der Mitte seiner Linie. Ein Strahl, der mit abgeräumt wird, räumt
 * seine Reihe oder Spalte mit (auch nacheinander). `stufe`: die wievielte Welle der Kettenreaktion (ab 1).
 */
export function raeumeAb(feld: Feld, o: { bei?: number[]; stufe: number; zaehler: Zaehler }): Schritt {
  const gs = gruppen(feld);
  const weg = new Map<number, Weg["durch"]>();
  const neu: { i: number; sp: Spezial }[] = [];
  for (const g of gs) {
    for (const z of g.zellen) weg.set(z, "linie");
    const lang = Math.max(...g.linien.map((l) => l.zellen.length));
    const winkel = g.linien.some((l) => l.richtung === "waag") && g.linien.some((l) => l.richtung === "senk");
    const sp: Spezial | null = lang >= 5 || winkel ? "funke" : lang === 4 ? (g.linien.find((l) => l.zellen.length === 4)!.richtung === "waag" ? "reihe" : "spalte") : null;
    if (!sp) continue;
    // wo: ein getauschter Platz in der Gruppe, sonst bei einem Winkel die Ecke, sonst die Mitte der längsten Linie
    // (nie auf einem Strahl oder Funken: der löst ja gerade aus)
    const frei = (z: number | undefined) => z !== undefined && g.zellen.includes(z) && !feld[z]?.sp && !neu.some((n) => n.i === z);
    const ecke = winkel ? g.zellen.find((z) => g.linien.filter((l) => l.zellen.includes(z)).length > 1) : undefined;
    const laengste = g.linien.reduce((a, b) => (b.zellen.length > a.zellen.length ? b : a));
    const mitte = laengste.zellen[Math.floor((laengste.zellen.length - 1) / 2)];
    const ort = o.bei?.find(frei) ?? (frei(ecke) ? ecke : undefined) ?? (frei(mitte) ? mitte : undefined) ?? g.zellen.find(frei);
    if (ort !== undefined) neu.push({ i: ort, sp });
  }
  // Strahlen, die mit abgeräumt werden, räumen ihre Linie (auch einer den nächsten)
  const ausgeloest: { i: number; sp: Spezial }[] = [];
  const offen = [...weg.keys()];
  while (offen.length) {
    const i = offen.pop()!;
    const st = feld[i];
    if (!st?.sp || ausgeloest.some((a) => a.i === i)) continue;
    ausgeloest.push({ i, sp: st.sp });
    const linie = st.sp === "reihe" ? Array.from({ length: SPALTEN }, (_, s) => platz(reiheVon(i), s)) : st.sp === "spalte" ? Array.from({ length: REIHEN }, (_, r) => platz(r, spalteVon(i))) : funkeZiele(feld, haeufigsteForm(feld));
    for (const z of linie)
      if (feld[z] && !weg.has(z)) {
        weg.set(z, st.sp === "funke" ? "funke" : "strahl");
        offen.push(z);
      }
  }
  return fertig(feld, weg, neu, ausgeloest, o);
}

/** Die Plätze aller Steine einer Form. */
function funkeZiele(feld: Feld, f: number): number[] {
  return feld.flatMap((s, i) => (s && s.f === f ? [i] : []));
}

/** Die Form, die am häufigsten liegt (ein Funke, den ein Strahl trifft, räumt sie). */
export function haeufigsteForm(feld: Feld): number {
  const n = Array.from({ length: FORMEN }, () => 0);
  for (const s of feld) if (s && s.f >= 0) n[s.f]++;
  return n.indexOf(Math.max(...n));
}

function fertig(feld: Feld, weg: Map<number, Weg["durch"]>, neu: { i: number; sp: Spezial }[], ausgeloest: { i: number; sp: Spezial }[], o: { stufe: number; zaehler: Zaehler }): Schritt {
  const out = [...feld];
  const wegListe: Weg[] = [];
  for (const [i, durch] of weg) {
    const st = feld[i];
    if (!st) continue;
    wegListe.push({ i, f: st.f, durch });
    out[i] = null;
  }
  for (const n of neu) {
    const f = feld[n.i]?.f ?? 0;
    out[n.i] = neuerStein(n.sp === "funke" ? -1 : f, o.zaehler, n.sp);
  }
  // wo der neue Strahl oder Funke liegt, verwandelt sich der Stein (er leuchtet nicht weg)
  const wegOhne = wegListe.filter((w) => !neu.some((n) => n.i === w.i));
  const punkte = wegListe.length * FUNKEL_PUNKTE.stein * o.stufe + neu.reduce((p, n) => p + (n.sp === "funke" ? FUNKEL_PUNKTE.funke : FUNKEL_PUNKTE.strahl), 0);
  return { feld: out, weg: wegOhne, neu, ausgeloest, punkte };
}

/**
 * Ein Funke wurde mit einem Stein getauscht: alle Steine dieser Form verschwinden (mit dem Funken). Zwei Funken
 * räumen das ganze Feld. Strahlen unter den Getroffenen räumen ihre Linie mit.
 */
export function funkeZuenden(feld: Feld, funke: number, ziel: number, o: { zaehler: Zaehler }): Schritt {
  const a = feld[funke];
  const b = feld[ziel];
  const weg = new Map<number, Weg["durch"]>();
  if (a?.sp === "funke" && b?.sp === "funke") {
    feld.forEach((s, i) => s && weg.set(i, "funke"));
  } else {
    const f = b?.f ?? haeufigsteForm(feld);
    for (const z of funkeZiele(feld, f)) weg.set(z, "funke");
    weg.set(funke, "funke");
  }
  // Strahlen unter den Getroffenen
  const ausgeloest: { i: number; sp: Spezial }[] = [{ i: funke, sp: "funke" }];
  const offen = [...weg.keys()];
  while (offen.length) {
    const i = offen.pop()!;
    const st = feld[i];
    if (!st?.sp || st.sp === "funke" || ausgeloest.some((x) => x.i === i)) continue;
    ausgeloest.push({ i, sp: st.sp });
    const linie = st.sp === "reihe" ? Array.from({ length: SPALTEN }, (_, s) => platz(reiheVon(i), s)) : Array.from({ length: REIHEN }, (_, r) => platz(r, spalteVon(i)));
    for (const z of linie)
      if (feld[z] && !weg.has(z)) {
        weg.set(z, "strahl");
        offen.push(z);
      }
  }
  return fertig(feld, weg, [], ausgeloest, { stufe: 1, zaehler: o.zaehler });
}

// ---------- Nachfallen ----------

export type Fall = { feld: Feld; /** neue Steine: id → wie viele Plätze über dem Feld sie anfangen */ von: Map<number, number> };

/**
 * Die Steine fallen nach unten in die Lücken, oben kommen neue dazu. Neue Steine bilden möglichst keine Linie mit ihren
 * Nachbarn (sonst räumte sich das Feld oft von selbst ab, ohne dass man etwas getan hat), ganz verhindert wird es nicht.
 */
export function fallen(feld: Feld, o: { rng: () => number; zaehler: Zaehler }): Fall {
  const out: Feld = Array.from({ length: PLAETZE }, () => null);
  const von = new Map<number, number>();
  for (let s = 0; s < SPALTEN; s++) {
    const steine: Stein[] = [];
    for (let r = REIHEN - 1; r >= 0; r--) {
      const st = feld[platz(r, s)];
      if (st) steine.push(st);
    }
    let r = REIHEN - 1;
    for (const st of steine) out[platz(r--, s)] = st;
    const fehlen = r + 1;
    for (; r >= 0; r--) {
      const f = passendeForm(out, r, s, o.rng);
      const st = neuerStein(f, o.zaehler);
      out[platz(r, s)] = st;
      von.set(st.id, fehlen);
    }
  }
  return { feld: out, von };
}

/** Eine zufällige Form, die an diesem Platz (mit den Steinen darunter und links) keine Linie bildet, wenn es geht. */
function passendeForm(feld: Feld, r: number, s: number, rng: () => number): number {
  const verboten = new Set<number>();
  const f = (rr: number, ss: number) => (rr >= 0 && rr < REIHEN && ss >= 0 && ss < SPALTEN ? (feld[platz(rr, ss)]?.f ?? -2) : -2);
  if (f(r + 1, s) >= 0 && f(r + 1, s) === f(r + 2, s)) verboten.add(f(r + 1, s));
  if (f(r, s - 1) >= 0 && f(r, s - 1) === f(r, s - 2)) verboten.add(f(r, s - 1));
  if (f(r, s + 1) >= 0 && f(r, s + 1) === f(r, s + 2)) verboten.add(f(r, s + 1));
  if (f(r, s - 1) >= 0 && f(r, s - 1) === f(r, s + 1)) verboten.add(f(r, s - 1));
  const frei = Array.from({ length: FORMEN }, (_, i) => i).filter((x) => !verboten.has(x));
  const wahl = frei.length ? frei : Array.from({ length: FORMEN }, (_, i) => i);
  return wahl[Math.floor(rng() * wahl.length)];
}

// ---------- Neues Feld und Mischen ----------

/** Ein neues Feld ohne fertige Linien und mit mindestens einem Zug. */
export function neuesFeld(o: { rng: () => number; zaehler: Zaehler }): Feld {
  for (let versuch = 0; versuch < 200; versuch++) {
    const feld: Feld = Array.from({ length: PLAETZE }, () => null);
    for (let r = REIHEN - 1; r >= 0; r--) for (let s = 0; s < SPALTEN; s++) feld[platz(r, s)] = neuerStein(passendeForm(feld, r, s, o.rng), o.zaehler);
    if (!linien(feld).length && hatZug(feld)) return feld;
  }
  // kommt nicht vor (lib/funkelfeld.test.ts), aber ein Feld gibt es immer
  return Array.from({ length: PLAETZE }, (_, i) => neuerStein((reiheVon(i) + spalteVon(i) * 2) % FORMEN, o.zaehler));
}

/** Mischt die Steine (die Strahlen und Funken bleiben dabei), bis keine Linie fertig ist und ein Zug geht. */
export function mische(feld: Feld, rng: () => number): Feld {
  const steine = feld.filter((s): s is Stein => !!s);
  for (let versuch = 0; versuch < 300; versuch++) {
    const a = [...steine];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const out: Feld = feld.map(() => null);
    let n = 0;
    for (let i = 0; i < PLAETZE; i++) if (feld[i]) out[i] = a[n++];
    if (!linien(out).length && hatZug(out)) return out;
  }
  return feld;
}
