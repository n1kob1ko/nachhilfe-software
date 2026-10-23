/**
 * Zitatprüfung (Plan 4.2, niko: „Bei offenen Texten darf die KI keine Textzitate oder Zeilenangaben erfinden.“):
 * jedes Zitat und jede Zeilenangabe, die die KI über einen Text schreibt, sucht die App selbst im Text. Was sie
 * nicht findet, wird verworfen und gezählt, nie als Tatsache gezeigt.
 *
 * - Ein **Zitat** (Text in „…“, "…" oder »…«) muss Wort für Wort in der Textbeilage stehen oder, wo es um einen
 *   Schülertext geht, in diesem Text. Groß- und Kleinschreibung und Satzzeichen zählen nicht, ein Wort, das am
 *   Zeilenende getrennt ist, wird gefunden (`findInStory`). Ein gekürztes Zitat mit […] oder … wird Teil für Teil
 *   gesucht, eine Anpassung in [ ] zählt nicht mit. Titel und Medium der Textbeilage in Anführungszeichen sind kein Zitat.
 * - Eine **Zeilenangabe** gleich beim Zitat („…“ (Z. 12)) muss zur Stelle passen, an der das Zitat in der
 *   Textbeilage steht; eine Zeile daneben gilt, wie bei den Hinweisen für Schüler. Steht dieselbe Angabe beim
 *   selben Zitat im Schülertext, gilt sie auch (die KI zitiert dann den Schüler).
 * - Jede andere Zeilenangabe muss es in der Textbeilage geben (Z. 1 bis zur letzten Zeile), außer der Schülertext
 *   nennt genau diese Zeile.
 *
 * Rein, ohne Datenbank und ohne KI; die Tests stehen in lib/zitatpruefung.test.ts.
 */
import type { TextDoc } from "./text-doc";
import { bareText, findInStory, lastLine, lineLabel, numberedLines, parseLineRefs, quotesOf, type LineRef, type Quote, type StoryLine } from "./textinterpretation";

export type Quelle = "textbeilage" | "schuelertext";

/** Wogegen geprüft wird: die Textbeilage mit ihren Zeilen und, wo es um einen Schülertext geht, dieser Text. */
export type Pruefgrundlage = {
  beilage: StoryLine[];
  /** der Schülertext, Absatz für Absatz als Zeilen (ohne Bedeutung der Nummern), so wie die KI ihn bekam */
  schueler: StoryLine[];
  /** Zitate des Schülertexts mit seinen Zeilenangaben */
  schuelerZitate: Quote[];
  /** Zeilen, die der Schülertext irgendwo nennt */
  schuelerZeilen: Set<number>;
  /** Titel und Medium, bare: in Anführungszeichen kein Zitat */
  namen: string[];
};

const docOf = (s: string): TextDoc => [{ t: "p", r: [{ x: s }] }];
const REF_ANYWHERE = /\b(?:Z|Zl|Zeilen?)\.?\s*\d{1,4}[^„“”"»«()\n]{0,30}/gi;

function refsIn(text: string): LineRef[] {
  return [...text.matchAll(REF_ANYWHERE)].flatMap((m) => parseLineRefs(m[0]));
}

/**
 * Die Grundlage der Prüfung. `schueler`: die Absätze des Schülertexts (wie an die KI gesendet, also mit [Name]).
 */
export function pruefgrundlage(o: { beilage: string; countBlank?: boolean; schueler?: string[]; titel?: string; medium?: string }): Pruefgrundlage {
  const absaetze = (o.schueler ?? []).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const doc: TextDoc = absaetze.map((x) => ({ t: "p", r: [{ x }] }));
  const zeilen = new Set<number>();
  for (const r of refsIn(absaetze.join("\n"))) {
    zeilen.add(r.from);
    if (r.to !== "ff") for (let n = r.from + 1; n <= Math.min(r.to, r.from + 50); n++) zeilen.add(n);
  }
  return {
    beilage: numberedLines(o.beilage, o.countBlank),
    schueler: numberedLines(absaetze.join("\n")),
    schuelerZitate: quotesOf(doc),
    schuelerZeilen: zeilen,
    namen: [o.titel ?? "", o.medium ?? ""].map(bareText).filter(Boolean),
  };
}

/**
 * Die Teile eines Zitats, die gesucht werden: ohne Auslassungen ([…], (…), …, ...) und Anpassungen in [ ], jeder Teil
 * mit mindestens drei Buchstaben oder Ziffern. Leer: nichts, was sich prüfen lässt.
 */
export function zitatTeile(zitat: string): string[] {
  return zitat
    .split(/\[[^\]]{0,60}\]|\(\s*(?:…|\.\.\.)\s*\)|…|\.\.\./)
    .map((t) => t.trim())
    .filter((t) => bareText(t).length >= 3);
}

type Stelle = { from: number; to: number };

/** Wo alle Teile stehen; null, wenn ein Teil fehlt. */
function finde(zeilen: StoryLine[], teile: string[]): Stelle[] | null {
  if (!teile.length || !zeilen.length) return null;
  const out: Stelle[] = [];
  for (const t of teile) {
    const f = findInStory(zeilen, t);
    if (!f.length) return null;
    out.push(...f);
  }
  return out;
}

/** Passt eine Zeilenangabe zu den Stellen (eine Zeile daneben gilt)? */
function passt(refs: LineRef[], stellen: Stelle[], last: number): boolean {
  return refs.some((r) => {
    const to = r.to === "ff" ? last : r.to;
    return stellen.some((s) => s.to >= r.from - 1 && s.from <= to + 1);
  });
}
const gleicheRefs = (a: LineRef[], b: LineRef[]) => a.length > 0 && a.length === b.length && a.every((r, i) => r.from === b[i].from && r.to === b[i].to);

export type Befund = { ok: true } | { ok: false; grund: "zitat" | "zeile" };

/**
 * Prüft ein Stück Text der KI (einen Satz, einen Punkt des Erwartungshorizonts): jedes Zitat gefunden, jede
 * Zeilenangabe passend. Ohne Zitat und ohne Zeilenangabe ist es in Ordnung.
 */
export function pruefeStelle(text: string, g: Pruefgrundlage): Befund {
  const last = lastLine(g.beilage);
  for (const q of quotesOf(docOf(text))) {
    const bare = bareText(q.text);
    if (bare && g.namen.includes(bare)) continue;
    const teile = zitatTeile(q.text);
    const inBeilage = finde(g.beilage, teile);
    const inSchueler = finde(g.schueler, teile);
    if (!inBeilage && !inSchueler) return { ok: false, grund: "zitat" };
    if (!q.hasRef) continue;
    if (!q.refs.length) return { ok: false, grund: "zeile" };
    if (inBeilage && passt(q.refs, inBeilage, last)) continue;
    // dieselbe Angabe beim selben Zitat im Schülertext: die KI zitiert den Schüler
    const ersterTeil = bareText(teile[0]);
    if (inSchueler && g.schuelerZitate.some((s) => bareText(s.text).includes(ersterTeil) && gleicheRefs(s.refs, q.refs))) continue;
    return { ok: false, grund: "zeile" };
  }
  for (const r of refsIn(text)) {
    const to = r.to === "ff" ? r.from : r.to;
    const gibt = (n: number) => (n >= 1 && n <= last) || g.schuelerZeilen.has(n);
    if (!gibt(r.from) || !gibt(to)) return { ok: false, grund: "zeile" };
  }
  return { ok: true };
}

// ---------- Sätze ----------

/** Abkürzungen, nach denen kein Satz endet (auch „Z. 12“). */
const ABK = new Set(["z", "zl", "b", "vgl", "bzw", "ca", "usw", "etc", "d", "h", "u", "a", "f", "ff", "s", "nr", "abs", "evtl", "ggf", "v", "chr", "jh", "hr", "fr", "dr", "mag", "o", "ä", "bspw", "inkl", "insb", "sog", "ebd", "zit", "anm"]);
const OPEN = "„»“";
const CLOSE = "“”«";

/** Teilt einen Absatz in Sätze; Zitate und Abkürzungen wie „Z. 12“ oder „z. B.“ bleiben ganz. */
export function saetze(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let tief = 0;
  let gerade = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') gerade = !gerade;
    else if (c === "„" || c === "»") tief++;
    else if (CLOSE.includes(c) && tief > 0) tief--;
    else if (c === "“" && tief === 0 && OPEN.includes(c)) tief++;
    if (!".!?".includes(c) || tief > 0 || gerade) continue;
    // Satzende: danach Leerraum und ein großer Buchstabe, ein Zitat oder eine Ziffer
    const rest = text.slice(i + 1);
    const m = rest.match(/^[)\]]?(\s+)(?=[\p{Lu}„"»\d(])/u);
    if (!m) continue;
    if (c === ".") {
      const wort = text.slice(start, i).match(/([\p{L}\d]+)$/u)?.[1] ?? "";
      if (/^\d+$/.test(wort) || ABK.has(wort.toLowerCase())) continue;
    }
    const ende = i + 1 + (rest.startsWith(")") || rest.startsWith("]") ? 1 : 0);
    out.push(text.slice(start, ende).trim());
    start = ende;
  }
  const letzter = text.slice(start).trim();
  if (letzter) out.push(letzter);
  return out.filter(Boolean);
}

/** Ein Text der KI aus mehreren Sätzen: was sich nicht belegen lässt, fällt heraus und wird gezählt. */
export function pruefeText(text: string, g: Pruefgrundlage): { text: string; verworfen: number } {
  let verworfen = 0;
  const bleibt: string[] = [];
  for (const absatz of text.split(/\n+/)) {
    const ok = saetze(absatz).filter((s) => {
      const b = pruefeStelle(s, g);
      if (!b.ok) verworfen++;
      return b.ok;
    });
    if (ok.length) bleibt.push(ok.join(" "));
  }
  return { text: bleibt.join("\n"), verworfen };
}

// ---------- Belege ----------

export type Beleg = { zitat: string; quelle: Quelle; zeile?: string | null };
/** Ein geprüfter Beleg: wo die App ihn gefunden hat; `stelle` („Z. 12“) rechnet die App, nie die KI. */
export type GefundenerBeleg = { zitat: string; quelle: Quelle; stelle: string | null };

/**
 * Ein Beleg der KI: ein wörtliches Zitat aus der Textbeilage oder dem Schülertext, wahlweise mit Zeile. Gefunden wird
 * er dort, wo die KI sagt, sonst im anderen Text; mit Zeilenangabe nur in der Textbeilage an dieser Stelle.
 * null: nicht gefunden, verwerfen.
 */
export function pruefeBeleg(b: Beleg, g: Pruefgrundlage): GefundenerBeleg | null {
  const zitat = b.zitat.trim().replace(/^[„“"»«]+|[“”"«»]+$/g, "").trim();
  const teile = zitatTeile(zitat);
  if (!teile.length) return null;
  const last = lastLine(g.beilage);
  const zeile = (b.zeile ?? "").trim();
  const inBeilage = finde(g.beilage, teile);
  if (zeile) {
    const refs = parseLineRefs(/^(?:Z|Zl|Zeilen?)\.?\s*/i.test(zeile) ? zeile : `Z. ${zeile}`);
    if (!refs.length || !inBeilage) return null;
    const nah = inBeilage.filter((s) => passt(refs, [s], last));
    if (!nah.length) return null;
    return { zitat, quelle: "textbeilage", stelle: lineLabel(nah[0].from, nah[0].to) };
  }
  const inSchueler = finde(g.schueler, teile);
  const quelle: Quelle | null = b.quelle === "schuelertext" ? (inSchueler ? "schuelertext" : inBeilage ? "textbeilage" : null) : inBeilage ? "textbeilage" : inSchueler ? "schuelertext" : null;
  if (!quelle) return null;
  const stelle = quelle === "textbeilage" && inBeilage ? lineLabel(inBeilage[0].from, inBeilage[0].to) : null;
  return { zitat, quelle, stelle };
}
