/**
 * Glasklar (niko 2026-11-16: ein Sortier-Puzzle als Lernspiel, „ja“ zum Vorschlag nach Block Blast): Begriffe liegen
 * gemischt in Gläsern und werden sortiert, bis jedes Glas nur noch eine Sorte hat (der, die, das; Nomen, Verb,
 * Adjektiv; Dativ, Akkusativ …). Eigene Regeln und ein eigener Look, kein Nachbau eines bekannten Spiels
 * (components/lernen/GlasSpiel.tsx, docs/lernspiele.md „Glasklar“). Hier steht nur die Spiellogik, ohne React und ohne
 * Datenbank, damit sie sich prüfen lässt (lib/glasklar.test.ts) und im Browser läuft.
 *
 * - Ein Zug nimmt den obersten Begriff eines Glases und setzt ihn in ein leeres Glas oder auf einen Begriff derselben
 *   Sorte. Ein Zug auf eine andere Sorte ist die falsche Antwort: der Begriff springt zurück, ein Herz ist weg, und die
 *   Sorte beider Begriffe steht danach klein darauf.
 * - Ist ein Glas mit einer Sorte voll, schließt es sich mit einem Deckel (der Name der Sorte steht darauf) und bleibt zu.
 * - Gezählt wird je Begriff der erste Zug auf einen anderen Begriff (`wahl` = die Sorte des Begriffs darunter). Ein
 *   Begriff, der so nie gesetzt wurde, zählt, sobald sein Glas zu ist, als richtig: er liegt dann richtig.
 *
 * Ein Glas ist eine Liste von Karten-Keys, unten zuerst.
 */

export type Glas = string[];

/** Wie groß eine Stufe ist: so viele Sorten, so viele Begriffe je Sorte (= so hoch ist ein Glas), so viele leere Gläser. */
export type GlasStufe = { sorten: number; hoehe: number; leer: number };

/** So viele Herzen hat man; eine fehlerfreie Stufe bringt eines zurück. */
export const GLAS_HERZEN = 3;
/** So viele Sorten hat eine Stufe höchstens (sieben Gläser passen auf jedes Handy). */
export const SORTEN_MAX = 5;

/**
 * Die Stufen eines Spiels: klein zum Hineinfinden, dann mehr Sorten und höhere Gläser, ab der siebten nur noch ein
 * leeres Glas. Hat ein Thema weniger Sorten, bleibt es bei denen (der, die, das: höchstens drei).
 */
export function stufeFuer(nr: number): GlasStufe {
  if (nr <= 1) return { sorten: 2, hoehe: 3, leer: 1 };
  if (nr === 2) return { sorten: 3, hoehe: 3, leer: 2 };
  if (nr === 3) return { sorten: 3, hoehe: 4, leer: 2 };
  if (nr === 4) return { sorten: 4, hoehe: 4, leer: 2 };
  if (nr <= 6) return { sorten: SORTEN_MAX, hoehe: 4, leer: 2 };
  return { sorten: 4, hoehe: 4, leer: 1 };
}

// ---------- Punkte ----------

/** Punkte: ein richtig gesetzter Begriff (einmal je Begriff), ein volles Glas und die ganze Stufe (je mal der Stufe). */
export const GLAS_PUNKTE = { begriff: 10, glas: 40, stufe: 100, fehlerfrei: 100 } as const;
/** Höchstens so viele Punkte nimmt der Server an. */
export const GLAS_PUNKTE_MAX = 3_000_000;
export const gueltigeGlasPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(GLAS_PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);

// ---------- Züge ----------

/** Sorte je Key (die richtige Antwort der Karte). */
export type Sorten = Record<string, string>;

/** Ist das Glas voll und hat nur eine Sorte? Dann ist es zu. */
export const istZu = (g: Glas, sorte: Sorten, hoehe: number) => g.length === hoehe && g.every((k) => sorte[k] === sorte[g[0]]);

export type ZugErgebnis =
  /** gesetzt; `auf`: der Begriff darunter (fehlt bei einem leeren Glas) */
  | { art: "zug"; key: string; auf?: string }
  /** andere Sorte: zählt als falsche Antwort */
  | { art: "falsch"; key: string; auf: string }
  /** voll oder zu: kein Fehler, es geht nur nicht */
  | { art: "voll" }
  | { art: "nichts" };

/** Was ein Zug vom Glas `von` ins Glas `nach` ergäbe (ohne etwas zu ändern). */
export function pruefeZug(glaeser: Glas[], von: number, nach: number, sorte: Sorten, hoehe: number): ZugErgebnis {
  const a = glaeser[von];
  const b = glaeser[nach];
  if (!a || !b || von === nach || !a.length || istZu(a, sorte, hoehe)) return { art: "nichts" };
  if (b.length >= hoehe) return { art: "voll" };
  const key = a[a.length - 1];
  if (!b.length) return { art: "zug", key };
  const auf = b[b.length - 1];
  return sorte[auf] === sorte[key] ? { art: "zug", key, auf } : { art: "falsch", key, auf };
}

/** Der Zug selbst: der oberste Begriff von `von` kommt oben auf `nach`. Neue Liste, die alte bleibt. */
export function zieh(glaeser: Glas[], von: number, nach: number): Glas[] {
  const out = glaeser.map((g) => [...g]);
  const key = out[von].pop();
  if (key !== undefined) out[nach].push(key);
  return out;
}

/** Gibt es noch einen erlaubten Zug, der etwas bringt (nicht nur ein Glas mit einer Sorte ins leere Glas umfüllen)? */
export function hatZug(glaeser: Glas[], sorte: Sorten, hoehe: number): boolean {
  return zuege(glaeser, sorte, hoehe).length > 0;
}

/** Alle sinnvollen Züge. Ein Glas, das nur eine Sorte hat, in ein leeres umzufüllen, bringt nie etwas. */
function zuege(glaeser: Glas[], sorte: Sorten, hoehe: number): [number, number][] {
  const out: [number, number][] = [];
  for (let von = 0; von < glaeser.length; von++) {
    const a = glaeser[von];
    if (!a.length || istZu(a, sorte, hoehe)) continue;
    const einSorte = a.every((k) => sorte[k] === sorte[a[0]]);
    let leerGenommen = false;
    for (let nach = 0; nach < glaeser.length; nach++) {
      if (nach === von) continue;
      const b = glaeser[nach];
      if (b.length >= hoehe) continue;
      if (!b.length) {
        // in ein leeres Glas: nur einmal (alle leeren sind gleich), nie mit einem Glas aus einer Sorte
        if (einSorte || leerGenommen) continue;
        leerGenommen = true;
        out.push([von, nach]);
      } else if (sorte[b[b.length - 1]] === sorte[a[a.length - 1]]) out.push([von, nach]);
    }
  }
  return out;
}

/** Ist alles sortiert (jedes Glas leer oder zu)? */
export const allesSortiert = (glaeser: Glas[], sorte: Sorten, hoehe: number) => glaeser.every((g) => !g.length || istZu(g, sorte, hoehe));

/**
 * Lässt sich die Lage lösen (nur mit erlaubten Zügen)? Tiefensuche mit Gedächtnis; `grenze` begrenzt die Arbeit (dann
 * gilt die Lage als nicht lösbar und wird neu gemischt).
 */
export function loesbar(glaeser: Glas[], sorte: Sorten, hoehe: number, grenze = 40_000): boolean {
  const gesehen = new Set<string>();
  const schluessel = (gs: Glas[]) =>
    gs
      .map((g) => g.map((k) => sorte[k]).join("\u0001"))
      .sort()
      .join("\u0002");
  const suche = (gs: Glas[]): boolean => {
    if (allesSortiert(gs, sorte, hoehe)) return true;
    if (gesehen.size >= grenze) return false;
    const s = schluessel(gs);
    if (gesehen.has(s)) return false;
    gesehen.add(s);
    for (const [von, nach] of zuege(gs, sorte, hoehe)) if (suche(zieh(gs, von, nach))) return true;
    return false;
  };
  return suche(glaeser);
}

function mischen<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Legt die Begriffe einer Stufe in die Gläser: jedes volle Glas gemischt, keines schon fertig, und nie fast fertig
 * (höchstens zwei derselben Sorte übereinander), dazu `leer` leere Gläser. Nur lösbare Lagen; findet sich mit `leer`
 * keine, kommt ein leeres Glas dazu. `rng`: fester Zufall, damit dieselbe Runde gleich aussieht.
 */
export function legeAus(keys: string[], sorte: Sorten, o: { hoehe: number; leer: number; rng: () => number }): Glas[] {
  const sorten = new Set(keys.map((k) => sorte[k])).size;
  const voll = Math.ceil(keys.length / o.hoehe);
  for (let leer = o.leer; leer <= o.leer + 1; leer++) {
    for (let versuch = 0; versuch < 160; versuch++) {
      const gemischt = mischen(keys, o.rng);
      const glaeser: Glas[] = Array.from({ length: voll }, (_, i) => gemischt.slice(i * o.hoehe, (i + 1) * o.hoehe));
      if (sorten > 1 && glaeser.some((g) => g.length > 1 && g.every((k) => sorte[k] === sorte[g[0]]))) continue;
      if (glaeser.some((g) => g.some((k, i) => i >= 2 && sorte[k] === sorte[g[i - 1]] && sorte[k] === sorte[g[i - 2]]))) continue;
      const mitLeeren = [...glaeser, ...Array.from({ length: leer }, () => [] as Glas)];
      if (loesbar(mitLeeren, sorte, o.hoehe)) return mitLeeren;
    }
  }
  // sehr selten: gar nicht gemischt (kommt bei echten Stufen nicht vor, siehe lib/glasklar.test.ts)
  return [...Array.from({ length: voll }, (_, i) => keys.slice(i * o.hoehe, (i + 1) * o.hoehe)), [], []];
}

/** Mischt die Begriffe der offenen Gläser neu (wenn nichts mehr geht); die zugemachten bleiben, wo sie sind. */
export function neuMischen(glaeser: Glas[], sorte: Sorten, hoehe: number, rng: () => number): Glas[] {
  const zu = glaeser.map((g) => istZu(g, sorte, hoehe));
  const offen = glaeser.filter((_, i) => !zu[i]).flat();
  const leer = glaeser.filter((_, i) => !zu[i]).length - Math.ceil(offen.length / hoehe);
  const neu = legeAus(offen, sorte, { hoehe, leer: Math.max(1, leer), rng });
  let n = 0;
  const out = glaeser.map((g, i) => (zu[i] ? [...g] : (neu[n++] ?? [])));
  // kamen mehr Gläser heraus (ein leeres mehr), hängen sie hinten an
  return [...out, ...neu.slice(n)];
}

/** Ein Thema für den Anfang des Spiels (zum Umschalten): id, Name, Fach und die Sorten als Beispiel. */
export type GlasThemaInfo = { id: string; name: string; fach: string; sorten: string[] };

/** Fester Zufall aus einer Zahl (dieselbe Runde, dieselbe Lage). */
export function glasZufall(seed: number): () => number {
  let x = seed % 2147483647 || 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
