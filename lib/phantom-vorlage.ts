/**
 * Die Vorlage zum Auswendiglernen (niko 2026-11-19: „ich will vielleicht, dass sie es schaffen, einen Text auswendig zu
 * lernen, so eine Art Lückentext, der für alles passt, und sie müssen nur mehr einsetzen“). Eine Personenbeschreibung
 * mit Platzhaltern in eckigen Klammern, nach dem Aufbau auf dem Arbeitsblatt der Schüler (lib/phantombild.ts).
 *
 * Im Spiel „Text lernen“ steht neben dem Text ein Phantombild; der Schüler setzt die Merkmale ein. Mit jeder Stufe
 * verschwinden mehr Wörter der Vorlage selbst (`LUECKEN_ANTEIL`), bis er sie ganz aus dem Kopf schreibt. Ein Satz mit
 * einem Platzhalter, den die Person nicht hat (kein Bart), fällt weg.
 *
 * Die Lehrkraft kann die Vorlage ändern (Mehr › Phantombild-Vorlage); gespeichert in app_settings (lib/lernspiele.ts).
 * Hier steht nur Reines.
 */
import type { SpielKarte } from "./lernspiele-typen";
import {
  auffaelligAkk,
  type Fall,
  haareAkk,
  HAUT_ATTR,
  istLeer,
  kleidungAkk,
  KOERPERBAU,
  MUND_AKK,
  NASE,
  neuerFall,
  PHANTOM_SKILL,
  personNom,
  pronomen,
  type Rng,
} from "./phantombild";

/** Die Vorlage, wenn die Lehrkraft keine eigene hat (Claude 2026-11-19 nach dem Aufbau des Arbeitsblatts). */
export const STANDARD_VORLAGE = `Die Person, die ich beschreibe, heißt [Name]. [Er] ist [Person] und etwa [Alter] Jahre alt. [Er] ist [Körperbau] und hat [Haut] Haut.

Zuerst fällt [sein] Gesicht auf, denn es ist [Gesicht]. [Sein]e Augen sind [Augenfarbe]. Die Nase ist [Nase] und [er] hat [Mund]. Auf dem Kopf hat [er] [Haare]. Im Gesicht trägt [er] [Bart]. Am Oberkörper trägt [er] [Kleidung].

Als besondere Merkmale hat [er] [Besonderes]. Besonders auffällig finde ich [Auffällig].`;

/** Die Platzhalter für Merkmale (ohne die Pronomen). */
export const PLATZHALTER = ["Name", "Person", "Alter", "Körperbau", "Haut", "Gesicht", "Augenfarbe", "Nase", "Mund", "Haare", "Bart", "Kleidung", "Besonderes", "Auffällig"] as const;
export type Platzhalter = (typeof PLATZHALTER)[number];
/** Pronomen: [Er] → Er/Sie, [er] → er/sie, [Sein] → Sein/Ihr, [sein] → sein/ihr (Endungen dahinter: „[Sein]e“). */
export const PRONOMEN = ["Er", "er", "Sein", "sein"] as const;

/** Was in jedem Platzhalter steht, mit Beispiel, für die Seite der Lehrkraft. */
export const PLATZHALTER_HILFE: Record<Platzhalter, string> = {
  Name: "Lukas Gruber",
  Person: "ein Junge / eine ältere Frau",
  Alter: "zwölf",
  Körperbau: "zierlich / schlank / kräftig / muskulös",
  Haut: "blasse / helle / gebräunte / dunkle (vor „Haut“)",
  Gesicht: "rund / oval / eckig / schmal",
  Augenfarbe: "blau / grün / braun / grau",
  Nase: "klein / groß / breit / spitz",
  Mund: "einen kleinen Mund / einen breiten Mund / einen schmalen Mund / volle Lippen",
  Haare: "kurze, lockige, rote Haare / eine Glatze",
  Bart: "einen dichten Vollbart (fehlt der Bart, fällt der Satz weg)",
  Kleidung: "einen blauen Pullover",
  Besonderes: "eine runde Brille und viele Sommersprossen (fällt weg, wenn nichts)",
  Auffällig: "seine roten Haare",
};

const AUGEN: Record<string, string> = { blau: "blau", gruen: "grün", braun: "braun", grau: "grau" };
const BART: Record<string, string> = { schnurrbart: "einen Schnurrbart", vollbart: "einen dichten Vollbart", dreitage: "einen Dreitagebart" };

/** Die besonderen Merkmale als Liste: „eine runde Brille, kleine Ohrringe und viele Sommersprossen“; null ohne. */
export function besonderesAkk(f: Fall): string | null {
  const teile: string[] = [];
  if (f.brille === "rund") teile.push("eine runde Brille");
  if (f.brille === "eckig") teile.push("eine eckige Brille");
  if (f.schmuck === "ohrringe") teile.push("kleine, goldene Ohrringe");
  if (f.schmuck === "kette") teile.push("eine silberne Halskette");
  if (f.schmuck === "piercing") teile.push("ein Piercing in der Nase");
  if (f.besonderes === "sommersprossen") teile.push("viele Sommersprossen");
  if (f.besonderes === "narbe") teile.push("eine Narbe auf der Wange");
  if (f.besonderes === "muttermal") teile.push("ein Muttermal neben dem Mund");
  if (!teile.length) return null;
  return teile.length === 1 ? teile[0] : `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

/** Was ein Platzhalter für diese Person sagt; null: die Person hat das nicht (der Satz fällt weg). */
export function wertFuer(p: Platzhalter, f: Fall): string | null {
  switch (p) {
    case "Name":
      return f.name;
    case "Person":
      return personNom(f.person);
    case "Alter":
      return String(f.alter);
    case "Körperbau":
      return KOERPERBAU[f.koerperbau] ?? f.koerperbau;
    case "Haut":
      return HAUT_ATTR[f.haut] ?? "helle";
    case "Gesicht":
      return f.gesicht;
    case "Augenfarbe":
      return AUGEN[f.augen] ?? f.augen;
    case "Nase":
      return NASE[f.nase] ?? "klein";
    case "Mund":
      return MUND_AKK[f.mund] ?? "einen kleinen Mund";
    case "Haare":
      return haareAkk(f.frisur, f.haarfarbe);
    case "Bart":
      return istLeer(f.bart) ? null : BART[f.bart];
    case "Kleidung":
      return kleidungAkk(f.oberteil, f.farbe);
    case "Besonderes":
      return besonderesAkk(f);
    case "Auffällig":
      return auffaelligAkk(f);
  }
}

// ---------- lesen ----------

/** Ein Stück der Vorlage: Text, ein Pronomen oder ein Platzhalter. */
export type Stueck = { text: string } | { pronomen: (typeof PRONOMEN)[number] } | { platz: Platzhalter };
/** Ein Absatz besteht aus Sätzen, ein Satz aus Stücken. */
export type Vorlage = Stueck[][][];

const KLAMMER = /\[([^\]\n]{1,30})\]/g;
export const VORLAGE_MAX = 1500;

/** Platzhalter in eckigen Klammern, die es nicht gibt (für die Seite der Lehrkraft). */
export function unbekannte(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(KLAMMER)) {
    const n = m[1].trim();
    if (!(PLATZHALTER as readonly string[]).includes(n) && !(PRONOMEN as readonly string[]).includes(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Sätze trennen: nach . ! ? und einem Leerzeichen (eine Klammer gehört zum Satz). */
function saetze(absatz: string): string[] {
  return absatz
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Die Vorlage in Absätze, Sätze und Stücke zerlegt. Unbekannte Klammern bleiben Text. */
export function liesVorlage(text: string): Vorlage {
  return text
    .replace(/\r/g, "")
    .slice(0, VORLAGE_MAX)
    .split(/\n\s*\n/)
    .map((a) => a.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((a) =>
      saetze(a).map((s) => {
        const out: Stueck[] = [];
        let rest = 0;
        for (const m of s.matchAll(KLAMMER)) {
          const n = m[1].trim();
          const bekannt = (PLATZHALTER as readonly string[]).includes(n) || (PRONOMEN as readonly string[]).includes(n);
          if (!bekannt) continue;
          if (m.index! > rest) out.push({ text: s.slice(rest, m.index) });
          out.push((PRONOMEN as readonly string[]).includes(n) ? { pronomen: n as (typeof PRONOMEN)[number] } : { platz: n as Platzhalter });
          rest = m.index! + m[0].length;
        }
        if (rest < s.length) out.push({ text: s.slice(rest) });
        return out;
      }),
    );
}

const pronomenText = (p: (typeof PRONOMEN)[number], f: Fall) => pronomen(f.person)[p === "Er" ? "Er" : p === "er" ? "er" : p === "Sein" ? "Sein" : "sein"];

/** Die Sätze, die für diese Person bleiben (ohne die mit einem Platzhalter, den sie nicht hat). */
export function fuerPerson(v: Vorlage, f: Fall): Vorlage {
  return v.map((a) => a.filter((s) => s.every((st) => !("platz" in st) || wertFuer(st.platz, f) !== null))).filter((a) => a.length);
}

/** Der ganze Text für diese Person (für die Musterlösung am Ende). */
export function ausgefuellt(text: string, f: Fall): string {
  return fuerPerson(liesVorlage(text), f)
    .map((a) => a.map((s) => s.map((st) => ("text" in st ? st.text : "pronomen" in st ? pronomenText(st.pronomen, f) : wertFuer(st.platz, f))).join("")).join(" "))
    .join("\n\n");
}

// ---------- die Lücken einer Stufe ----------

/** So viele Stufen hat „Text lernen“; in der letzten fehlt die ganze Vorlage. */
export const VORLAGE_STUFEN = 5;
/** Welcher Anteil der Wörter der Vorlage in einer Stufe fehlt (in Stufe 1 nur die Merkmale). */
export const LUECKEN_ANTEIL = [0, 0.25, 0.5, 0.75, 1] as const;
export const anteilFuer = (stufe: number) => LUECKEN_ANTEIL[Math.min(VORLAGE_STUFEN, Math.max(1, stufe)) - 1];
/** Eine Stufe gilt als geschafft, wenn so viel beim ersten Versuch stimmt. */
export const VORLAGE_GESCHAFFT = 0.8;
/** Höchstens so viele Lücken hat eine Runde (der Server zählt bis 100 Antworten). */
export const LUECKEN_MAX = 90;

/** Ein Stück im Spiel: Text oder eine Lücke (der Index ihrer Karte). */
export type SpielStueck = { text: string } | { luecke: number };
/** Was die erste Karte einer Runde „Text lernen“ mitbringt. */
export type VorlageDaten = { fall: Fall; absaetze: SpielStueck[][]; stufe: number; loesung: string };

/** Ein Wort mit dem Satzzeichen dahinter: nur das Wort ist die Lücke. */
const WORT = /^([A-Za-zÄÖÜäöüß-]+)(.*)$/s;

/** Eine feste Reihenfolge der Wörter (gleich bei jeder Runde), damit eine höhere Stufe die Lücken der kleineren behält. */
function rang(i: number, wort: string): number {
  let h = 2166136261 ^ i;
  for (const c of wort) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

function mische<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Eine Runde „Text lernen“: die Vorlage für diese Person, die Merkmale als Lücken (zur Wahl: dasselbe für andere
 * Personen), dazu je Stufe mehr Wörter der Vorlage (zur Wahl: andere Wörter aus ihr). Die erste Karte trägt `vorlage`.
 */
export function vorlageRunde(text: string, fall: Fall, stufe: number, rng: Rng): SpielKarte[] {
  const v = fuerPerson(liesVorlage(text), fall);
  // die Wörter der Vorlage selbst (ohne Platzhalter und Pronomen)
  const woerter: { a: number; s: number; st: number; t: number; wort: string; rang: number }[] = [];
  let nr = 0;
  v.forEach((a, ai) =>
    a.forEach((s, si) =>
      s.forEach((st, sti) => {
        if (!("text" in st)) return;
        st.text.split(/(\s+)/).forEach((tok, ti) => {
          const m = WORT.exec(tok);
          if (m && m[1].length >= 2) woerter.push({ a: ai, s: si, st: sti, t: ti, wort: m[1], rang: rang(nr++, m[1]) });
        });
      }),
    ),
  );
  const platzZahl = v.flat(2).filter((st) => "platz" in st).length;
  const anzahl = Math.min(Math.ceil(woerter.length * anteilFuer(stufe)), Math.max(0, LUECKEN_MAX - platzZahl));
  const weg = new Set([...woerter].sort((x, y) => x.rang - y.rang).slice(0, anzahl).map((w) => `${w.a}.${w.s}.${w.st}.${w.t}`));
  const alleWoerter = [...new Set(woerter.map((w) => w.wort))];
  // andere Personen für die Wahl bei den Merkmalen
  const andere = Array.from({ length: 12 }, () => neuerFall(rng));
  const optionen = stufe >= 3 ? 4 : 3;

  const karten: SpielKarte[] = [];
  const absaetze: SpielStueck[][] = [];
  const luecke = (k: Omit<SpielKarte, "skill" | "nach" | "regel">, regel: string) => {
    karten.push({ ...k, skill: PHANTOM_SKILL, nach: "", regel });
    return { luecke: karten.length - 1 };
  };
  v.forEach((a, ai) => {
    const out: SpielStueck[] = [];
    const text = (t: string) => {
      const letztes = out[out.length - 1];
      if (letztes && "text" in letztes) letztes.text += t;
      else out.push({ text: t });
    };
    a.forEach((s, si) => {
      if (si > 0) text(" ");
      s.forEach((st, sti) => {
        if ("pronomen" in st) return text(pronomenText(st.pronomen, fall));
        if ("platz" in st) {
          const richtig = wertFuer(st.platz, fall)!;
          const sonst = [...new Set(andere.map((f) => wertFuer(st.platz, f)).filter((w): w is string => !!w && w !== richtig))];
          const faecher = mische([richtig, ...mische(sonst, rng).slice(0, optionen - 1)], rng);
          out.push(luecke({ key: `vorlage:${st.platz}`, wort: st.platz, marke: "Merkmal", vor: "", kurz: richtig, faecher, richtig, loesung: `${st.platz}: ${richtig}` }, "Schau aufs Phantombild: was passt zu dieser Person?"));
          return;
        }
        st.text.split(/(\s+)/).forEach((tok, ti) => {
          const m = WORT.exec(tok);
          if (!m || !weg.has(`${ai}.${si}.${sti}.${ti}`)) return text(tok);
          const richtig = m[1];
          const nah = alleWoerter.filter((w) => w.toLowerCase() !== richtig.toLowerCase());
          // gleich geschriebene (groß oder klein) und ähnlich lange Wörter zuerst, damit weder das eine noch das andere etwas verrät
          const gross = (w: string) => w[0] !== w[0].toLowerCase();
          const abstand = (w: string) => (gross(w) === gross(richtig) ? 0 : 100) + Math.abs(w.length - richtig.length);
          const sortiert = mische(nah, rng).sort((x, y) => abstand(x) - abstand(y));
          const faecher = mische([richtig, ...sortiert.slice(0, Math.min(optionen - 1, sortiert.length))], rng);
          out.push(luecke({ key: `vorlage:w${karten.length}:${richtig}`, wort: "Vorlage", marke: "Vorlage", vor: "", kurz: richtig, faecher, richtig, loesung: richtig }, "Das Wort gehört zur Vorlage. Lies den ganzen Satz noch einmal laut."));
          if (m[2]) text(m[2]);
        });
      });
    });
    absaetze.push(out);
  });
  if (karten[0]) karten[0].vorlage = { fall, absaetze, stufe, loesung: ausgefuellt(text, fall) };
  return karten;
}
