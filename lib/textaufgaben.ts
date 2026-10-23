/**
 * Textaufgaben: short word problems for the built-in maths skills, with everyday contexts from
 * Austria (Schulweg, Jause, Wandertag, Handytarif, Abverkauf, Rezept, Sport) and the school-book
 * numbers of lib/schulbuch-zahlen.ts. Several contexts per skill; every text is written for this app
 * (no school book, IQS or Matura task is copied). The answer is a number (or a power) that the app
 * checks like a calculation; units may be written or left out.
 */
import type { Difficulty } from "./curriculum";
import { bruchWeg, ersterSchritt, kurzaufgabe, prozentwertHilfe, prozentwertWeg, prozentwertWege, type Fehler } from "./mathe-rechnungen";
import {
  STUFE,
  antwort,
  bruch,
  bruchListe,
  dingFall,
  echteBrueche,
  einfacheGleichung,
  euro,
  fehlerAntwort,
  gcd,
  geld,
  geldAntwort,
  gemischt,
  gleichungBeideSeiten,
  gleichungWeg,
  gross,
  klammerGleichung,
  klammernBeideSeiten,
  kuerze,
  minus,
  minusKlammer,
  plus,
  passende,
  pick,
  potenz,
  potenzVarianten,
  prozentwertExakt,
  rint,
  termText,
  wert,
  xAntwort,
  xAnzeige,
  zahl,
  type BruchOp,
  type BruchRechnung,
  type Frac,
  type Gleichung,
  type Rng,
  type Stufe,
} from "./schulbuch-zahlen";
import type { TaskDraft } from "./tasks";

// ---------- people and small helpers ----------
/** Generic first names (no real students), with the pronouns a sentence needs. */
type Person = { name: string; er: "er" | "sie"; sein: "sein" | "ihr"; ihm: "ihm" | "ihr" };
const PERSONEN: Person[] = [
  ...["Lena", "Mia", "Emma", "Sara", "Anna", "Lea", "Hannah"].map((name) => ({ name, er: "sie" as const, sein: "ihr" as const, ihm: "ihr" as const })),
  ...["Jonas", "Paul", "Elias", "David", "Felix", "Noah", "Luca"].map((name) => ({ name, er: "er" as const, sein: "sein" as const, ihm: "ihm" as const })),
];
/** The first names the stories use (made up for the tasks, never a student's name). */
export const VORNAMEN = PERSONEN.map((p) => p.name);
function leute(rng: Rng, n: number): Person[] {
  const out: Person[] = [];
  while (out.length < n) {
    const p = pick(rng, PERSONEN);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const rund = (x: number) => Math.round(x * 10000) / 10000;

/** The accepted answers: the values, each also with every unit ("12 km", "12km"), negative ones also with "−". */
function mitEinheit(werte: string[], einheiten: string[]): string[] {
  const out = [...werte];
  for (const w of werte) for (const e of einheiten) out.push(`${w} ${e}`, `${w}${e}`);
  return [...new Set(out.flatMap((a) => (a.startsWith("-") ? [a, `−${a.slice(1)}`] : [a])))];
}
/** A fraction as an answer: 1 1/4, 5/4 and 1,25 (when it ends). */
function bruchWerte(f: Frac): string[] {
  const r = kuerze(f);
  let d = r.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return [...new Set([gemischt(r), bruch(r), ...(d === 1 ? [antwort(wert(r))] : [])])];
}
const t = (f: Frac) => termText(f, true);
const stunden = (f: Frac) => (wert(f) > 1 ? "Stunden" : "Stunde");

type Story = { prompt: string; accepted: string[]; mode?: "value" | "exact" | "text"; solution: string; hints: string[]; errors: Fehler[]; wege?: string[] };
type Kontext = { stufen: Stufe[]; make: (rng: Rng, lv: Stufe) => Story | null };

/** A context that fits the level, tried in random order until one has numbers for it. */
function waehle(rng: Rng, lv: Stufe, kontexte: Kontext[]): Story | null {
  const offen = kontexte.filter((k) => k.stufen.includes(lv));
  while (offen.length) {
    const [k] = offen.splice(Math.floor(rng() * offen.length), 1);
    const s = k.make(rng, lv);
    if (s) return s;
  }
  return null;
}
const ALLE: Stufe[] = [0, 1, 2, 3, 4];

// ---------- Kürzen ----------
type Klassenanteil = { satz: string; frage: string; nicht: string };
const KLASSE: Klassenanteil[] = [
  { satz: "kommen mit dem Rad zur Schule", frage: "kommt mit dem Rad zur Schule", nicht: "kommt nicht mit dem Rad zur Schule" },
  { satz: "haben ein Haustier", frage: "hat ein Haustier", nicht: "hat kein Haustier" },
  { satz: "spielen ein Instrument", frage: "spielt ein Instrument", nicht: "spielt kein Instrument" },
  { satz: "sind in einem Sportverein", frage: "ist in einem Sportverein", nicht: "ist in keinem Sportverein" },
];

/** A part n of a whole D that can be reduced, small enough for the level. */
function teilVon(rng: Rng, lv: Stufe, gesamt: number[], ok: (n: number, D: number) => boolean = () => true) {
  const maxNenner = [4, 6, 12, 30, 60][lv];
  const faelle = gesamt.flatMap((D) =>
    range(1, D - 1)
      .filter((n) => gcd(n, D) > 1 && D / gcd(n, D) <= maxNenner && ok(n, D))
      .map((n) => ({ n, D })),
  );
  return faelle.length ? pick(rng, faelle) : null;
}

function kuerzenStory(rng: Rng, lv: Stufe, gesamt: number[], text: (n: number, D: number, nicht: boolean) => string, ok?: (n: number, D: number) => boolean, nichtMoeglich = true): Story | null {
  const f = teilVon(rng, lv, gesamt, ok);
  if (!f) return null;
  const nicht = nichtMoeglich && lv === 4 && rng() < 0.5;
  const z = nicht ? f.D - f.n : f.n;
  const k = gcd(z, f.D);
  const r = kuerze({ n: z, d: f.D });
  const teil = [2, 3, 5].find((p) => k % p === 0 && p !== k);
  return {
    prompt: `${text(f.n, f.D, nicht)} Gib den Bruch gekürzt an.`,
    accepted: [bruch(r)],
    mode: "exact",
    solution: [...(nicht ? [`${f.D} − ${f.n} = ${z}`] : []), `Bruchteil: ${z}/${f.D}`, `Kürzen durch ${k}: ${z}/${f.D} = ${bruch(r)}`, `Antwort: Der Bruchteil ist ${bruch(r)}.`].join("\n"),
    hints: [nicht ? "Rechne zuerst aus, wie viele es nicht sind." : "Der Teil kommt in den Zähler, das Ganze in den Nenner.", "Kürze den Bruch durch den größten gemeinsamen Teiler.", `${z} und ${f.D} sind beide durch ${k} teilbar.`],
    errors: [
      { answer: `${z}/${f.D}`, label: "Bruch nicht gekürzt" },
      ...(teil ? [{ answer: bruch({ n: z / teil, d: f.D / teil }), label: "Nicht vollständig gekürzt" }] : []),
      ...(nicht ? [{ answer: bruch(kuerze({ n: f.n, d: f.D })), label: "Den Anteil statt den Rest angegeben" }] : []),
    ],
  };
}

const KUERZEN: Kontext[] = [
  {
    stufen: [0, 1, 2],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const a = pick(rng, KLASSE);
      return kuerzenStory(rng, lv, [[20, 24], [18, 20, 24, 25, 28], [24, 25, 27, 28, 30]][lv] ?? [24], (n, D, nicht) => `In der Klasse von ${p.name} sind ${D} Kinder. ${n} davon ${a.satz}. Welcher Bruchteil der Klasse ${nicht ? a.nicht : a.frage}?`);
    },
  },
  {
    stufen: [2, 3, 4],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, lv === 2 ? [120, 150, 180, 200] : [180, 240, 300, 360, 400, 480], (n, D, nicht) => `An der Schule von ${p.name} gibt es ${D} Schülerinnen und Schüler. ${n} davon fahren mit dem Bus zur Schule. Welcher Bruchteil der Schülerinnen und Schüler fährt ${nicht ? "nicht mit dem Bus" : "mit dem Bus"}?`);
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, [24], (n) => `${p.name} schläft in der Nacht ${n} Stunden. Welcher Bruchteil eines Tages mit 24 Stunden ist das?`, (n) => n >= 6 && n <= 10, false);
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, [60], (n, D, nicht) => (nicht ? `Eine Turnstunde dauert ${D} Minuten. ${p.name} wärmt sich ${n} Minuten lang auf. Welcher Bruchteil der Stunde bleibt für das Spiel?` : `${p.name} trainiert jeden Tag ${n} Minuten für den Lauf am Sporttag. Welcher Bruchteil einer Stunde ist das?`), (n) => n % 5 === 0 || n % 12 === 0);
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, [12, 16, 18, 20, 24], (n, D) => `Eine Tafel Schokolade hat ${D} Stücke. ${p.name} isst ${n} Stücke davon. Welcher Bruchteil der Tafel ist das?`, (n, D) => n < D, false);
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, lv <= 2 ? [24, 30, 36, 40, 48] : [40, 48, 50, 60, 64], (n, D, nicht) => `Bei der Mathe-Schularbeit gibt es ${D} Punkte. ${p.name} erreicht ${n} Punkte. Welcher Bruchteil der Punkte ${nicht ? `fehlt ${p.ihm}` : "ist das"}?`, (n, D) => n >= D / 3);
    },
  },
  {
    stufen: [1, 2, 3],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      return kuerzenStory(rng, lv, [20, 24, 30, 40, 50], (n, D) => `${p.name} bekommt im Monat ${D} € Taschengeld. ${gross(p.er)} gibt ${n} € für ein Buch aus. Welcher Bruchteil des Taschengeldes ist das?`, (n, D) => n <= D / 2 + 5);
    },
  },
  {
    stufen: [3, 4],
    make: (rng, lv) =>
      kuerzenStory(rng, lv, [150, 180, 240, 320, 360], (n, D, nicht) => `Ein Fußballverein hat ${D} Mitglieder. ${n} davon sind Kinder und Jugendliche. Welcher Bruchteil der Mitglieder ${nicht ? "sind Erwachsene" : "ist das"}?`),
  },
];

// ---------- Erweitern ----------
type Umrechnung = { T: number[]; einheit: string[]; text: (p: Person, f: string, T: number) => string; wort: string };
const UMRECHNUNG: Umrechnung[] = [
  { T: [60], einheit: ["Minuten", "min"], wort: "Minuten", text: (p, f) => `${p.name} übt ${f} Stunde Klavier. Wie viele Minuten sind das?` },
  { T: [100], einheit: ["Cent", "ct"], wort: "Cent", text: (p, f) => `${p.name} hat noch ${f} € in ${p.sein}er Geldbörse. Wie viele Cent sind das?` },
  { T: [1000], einheit: ["g", "Gramm"], wort: "Gramm", text: (p, f) => `Für einen Kuchen braucht ${p.name} ${f} kg Mehl. Wie viele Gramm sind das?` },
  { T: [1000], einheit: ["m", "Meter"], wort: "Meter", text: (p, f) => `Der Schulweg von ${p.name} ist ${f} km lang. Wie viele Meter sind das?` },
  { T: [8, 12, 16, 24], einheit: ["Stücke", "Stück"], wort: "Stücke", text: (p, f, T) => `Ein Blechkuchen wird in ${T} gleich große Stücke geschnitten. ${p.name} bringt ${f} des Kuchens in die Schule mit. Wie viele Stücke sind das?` },
  { T: [20, 24, 25, 28, 30], einheit: ["Kinder"], wort: "Kinder", text: (p, f, T) => `In der Klasse von ${p.name} sind ${T} Kinder. ${gross(f)} der Kinder essen in der Schule zu Mittag. Wie viele Kinder sind das?` },
];
const ERW_NENNER = [
  [2, 4],
  [2, 3, 4, 5, 10],
  [3, 4, 5, 6, 8, 10, 12, 20, 25],
  [8, 12, 15, 20, 25, 50],
];

function erweiternStory(rng: Rng, lv: Stufe): Story | null {
  const [p, q] = leute(rng, 2);
  if (lv === 4) {
    // two parts, then together: 2/3 h + 3/4 h in minutes
    const zeit = rng() < 0.5;
    const T = zeit ? 60 : 100;
    const fr = zeit ? echteBrueche([3, 4, 5, 6, 12]).filter((f) => wert(f) >= 0.25) : echteBrueche([4, 5, 10, 20]);
    const f1 = pick(rng, fr);
    const f2 = pick(rng, fr.filter((f) => f.d !== f1.d));
    if (!f2) return null;
    const [m1, m2] = [(f1.n * T) / f1.d, (f2.n * T) / f2.d];
    const einheit = zeit ? ["Minuten", "min"] : ["Cent", "ct"];
    return {
      prompt: zeit
        ? `${p.name} lernt am Nachmittag ${bruch(f1)} Stunde für Mathe und ${bruch(f2)} Stunde für Englisch. Wie viele Minuten lernt ${p.er} insgesamt?`
        : `${p.name} hat ${bruch(f1)} € in der Geldbörse, ${q.name} hat ${bruch(f2)} €. Wie viele Cent haben die beiden zusammen?`,
      accepted: mitEinheit([String(m1 + m2)], einheit),
      solution: [`${bruch(f1)} = ${m1}/${T}, also ${m1} ${einheit[0]}`, `${bruch(f2)} = ${m2}/${T}, also ${m2} ${einheit[0]}`, `${m1} + ${m2} = ${m1 + m2}`, `Antwort: Das sind ${m1 + m2} ${einheit[0]}.`].join("\n"),
      hints: [`${zeit ? "Eine Stunde hat 60 Minuten" : "Ein Euro hat 100 Cent"}. Erweitere beide Brüche auf den Nenner ${T}.`, `${bruch(f1)} = ${m1}/${T}`],
      errors: [
        { answer: String(T / f1.d + T / f2.d), label: "Mit dem Zähler multiplizieren vergessen" },
        { answer: String(m1), label: "Nur den ersten Teil umgerechnet" },
      ],
    };
  }
  const u = pick(rng, UMRECHNUNG);
  const T = pick(rng, u.T);
  const fr = echteBrueche(ERW_NENNER[lv]).filter((f) => T % f.d === 0 && f.d < T);
  if (!fr.length) return null;
  const f = pick(rng, fr);
  const k = T / f.d;
  const x = f.n * k;
  return {
    prompt: u.text(p, bruch(f), T),
    accepted: mitEinheit([String(x)], u.einheit),
    solution: [`${T} : ${f.d} = ${k}, also mit ${k} erweitern.`, `${bruch(f)} = (${f.n} · ${k})/(${f.d} · ${k}) = ${x}/${T}`, `Antwort: Das sind ${x} ${u.wort}.`].join("\n"),
    // with Zähler 1 the factor already is the answer, so the hints only point the way there
    hints:
      f.n === 1
        ? [`Erweitere den Bruch auf den Nenner ${T}.`, `Mit welcher Zahl musst du ${f.d} multiplizieren, damit ${T} herauskommt?`, `${bruch(f)} von ${T} heißt: ${T} in ${f.d} gleich große Teile teilen.`]
        : [`Erweitere den Bruch auf den Nenner ${T}.`, `${T} : ${f.d} = ${k}`, `Zähler und Nenner mal ${k}.`],
    errors: [
      { answer: String(k), label: "Mit dem Zähler multiplizieren vergessen" },
      { answer: String(T - x), label: "Den Rest statt den Anteil berechnet" },
    ],
  };
}

// ---------- fractions: +, −, ·, : ----------
type BruchKontext = {
  ops: BruchOp[];
  stufen: Stufe[];
  /** denominators the story allows per term (all terms, or first and second term) */
  nenner: number[] | [number[], number[]];
  passt?: (r: BruchRechnung) => boolean;
  text: (r: BruchRechnung, ps: Person[]) => { prompt: string; einheit: string[]; antwort: string } | null;
};
const passtNenner = (r: BruchRechnung, n: BruchKontext["nenner"]) =>
  Array.isArray(n[0]) ? r.terms.every((x, i) => (n as [number[], number[]])[i === 0 ? 0 : 1].includes(x.d) || x.d === 1) : r.terms.every((x) => (n as number[]).includes(x.d) || x.d === 1);
/** Every partial result of the story stays at most `max` (a jug holds no more than that). */
function zwischen(r: BruchRechnung, max: number): boolean {
  let acc = r.terms[0];
  for (let i = 0; ; i++) {
    if (wert(acc) > max) return false;
    if (i + 1 >= r.terms.length) return true;
    acc = r.ops[i] === "+" ? plus(acc, r.terms[i + 1]) : minus(acc, r.terms[i + 1]);
  }
}
const ganzzahl = (r: BruchRechnung) => r.result.d === 1 && r.result.n >= 2;

const SUMMEN: BruchKontext[] = [
  {
    ops: ["+"],
    stufen: ALLE,
    nenner: [2, 3, 4, 6, 8, 12],
    passt: (r) => r.gemischt || wert(r.result) <= 1,
    text: (r, [p, q, s]) => {
      const res = gemischt(r.result);
      if (r.gemischt) return { prompt: `Bei der Klassenfeier essen die Kinder ${t(r.terms[0])} Pizzas Margherita und ${t(r.terms[1])} Pizzas Salami. Wie viele Pizzas essen sie zusammen?`, einheit: ["Pizzas", "Pizzen"], antwort: `Sie essen zusammen ${res} Pizzas.` };
      if (r.terms.length === 3)
        return { prompt: `${p.name}, ${q.name} und ${s.name} teilen sich eine Pizza. ${p.name} isst ${t(r.terms[0])}, ${q.name} isst ${t(r.terms[1])} und ${s.name} isst ${t(r.terms[2])} der Pizza. Welchen Teil der Pizza essen die drei zusammen?`, einheit: [], antwort: `Die drei essen zusammen ${res} der Pizza.` };
      return { prompt: `${p.name} und ${q.name} teilen sich eine Pizza. ${p.name} isst ${t(r.terms[0])} der Pizza, ${q.name} isst ${t(r.terms[1])}. Welchen Teil der Pizza essen die beiden zusammen?`, einheit: [], antwort: `Die beiden essen zusammen ${res} der Pizza.` };
    },
  },
  {
    ops: ["−"],
    stufen: ALLE,
    nenner: [2, 3, 4, 6, 8, 12],
    passt: (r) => r.ops.every((o) => o === "−"),
    text: (r, [p, q]) =>
      r.gemischt
        ? { prompt: `Nach dem Schulfest sind noch ${t(r.terms[0])} Kuchen übrig. Die Lehrerinnen und Lehrer essen davon ${t(r.terms[1])} Kuchen. Wie viele Kuchen bleiben übrig?`, einheit: ["Kuchen"], antwort: `Es bleiben ${gemischt(r.result)} Kuchen übrig.` }
        : r.terms.length === 3
          ? { prompt: `Von einer Pizza ist noch ${t(r.terms[0])} übrig. ${p.name} isst davon ${t(r.terms[1])} der ganzen Pizza, ${q.name} isst ${t(r.terms[2])}. Welcher Teil der Pizza bleibt übrig?`, einheit: [], antwort: `Es bleibt ${gemischt(r.result)} der Pizza übrig.` }
          : { prompt: `Von einer Pizza ist noch ${t(r.terms[0])} übrig. ${p.name} isst davon ${t(r.terms[1])} der ganzen Pizza. Welcher Teil der Pizza bleibt übrig?`, einheit: [], antwort: `Es bleibt ${gemischt(r.result)} der Pizza übrig.` },
  },
  {
    ops: ["+", "−"],
    stufen: ALLE,
    nenner: [2, 4, 5, 8, 10],
    passt: (r) => zwischen(r, 3.5),
    text: (r, [p, q]) => {
      const res = gemischt(r.result);
      if (r.gemischt)
        return r.ops[0] === "+"
          ? { prompt: `Für das Schulfest mischt ${p.name} ${t(r.terms[0])} Liter Apfelsaft mit ${t(r.terms[1])} Litern Wasser. Wie viele Liter Apfelsaft gespritzt sind das?`, einheit: ["Liter", "l", "L"], antwort: `Das sind ${res} Liter.` }
          : { prompt: `Für den Wandertag füllt ${p.name} einen Kanister mit ${t(r.terms[0])} Litern Wasser. Unterwegs trinkt die Gruppe ${t(r.terms[1])} Liter. Wie viele Liter Wasser sind noch im Kanister?`, einheit: ["Liter", "l", "L"], antwort: `Im Kanister sind noch ${res} Liter.` };
      const schritte = r.terms.slice(1).map((x, i) => (r.ops[i] === "+" ? `${[q, p][i % 2].name} gießt ${t(x)} Liter nach.` : `${[p, q][i % 2].name} trinkt ${t(x)} Liter.`));
      return { prompt: `In einem Krug sind ${t(r.terms[0])} Liter Saft. ${schritte.join(" ")} Wie viele Liter Saft sind jetzt im Krug?`, einheit: ["Liter", "l", "L"], antwort: `Im Krug sind jetzt ${res} Liter Saft.` };
    },
  },
  {
    ops: ["+", "−"],
    stufen: ALLE,
    nenner: [2, 4, 5, 8, 10],
    passt: (r) => r.ops.every((o) => o === r.ops[0]),
    text: (r, [p]) => {
      const res = gemischt(r.result);
      const km = ["km", "Kilometer"];
      if (r.ops[0] === "+") {
        if (r.gemischt) return { prompt: `Am Wandertag wandert die Klasse am Vormittag ${t(r.terms[0])} km und am Nachmittag ${t(r.terms[1])} km. Wie viele Kilometer sind das zusammen?`, einheit: km, antwort: `Das sind ${res} km.` };
        if (r.terms.length === 3)
          return { prompt: `Am Wandertag geht die Klasse zuerst ${t(r.terms[0])} km bis zum Waldrand, dann ${t(r.terms[1])} km durch den Wald und zuletzt ${t(r.terms[2])} km bis zur Hütte. Wie viele Kilometer geht die Klasse insgesamt?`, einheit: km, antwort: `Die Klasse geht ${res} km.` };
        return { prompt: `${p.name} geht ${t(r.terms[0])} km zur Bushaltestelle und fährt dann ${t(r.terms[1])} km mit dem Bus zur Schule. Wie lang ist ${p.sein} Schulweg insgesamt?`, einheit: km, antwort: `Der Schulweg ist ${res} km lang.` };
      }
      if (r.gemischt) return { prompt: `Der Wanderweg zur Hütte ist ${t(r.terms[0])} km lang. Nach ${t(r.terms[1])} km macht die Klasse eine Pause. Wie viele Kilometer sind es dann noch bis zur Hütte?`, einheit: km, antwort: `Es sind noch ${res} km.` };
      if (r.terms.length === 3)
        return { prompt: `Der Schulweg von ${p.name} ist ${t(r.terms[0])} km lang. Nach ${t(r.terms[1])} km trifft ${p.er} eine Freundin, nach weiteren ${t(r.terms[2])} km kommen die beiden beim Bäcker vorbei. Wie viele Kilometer sind es dann noch bis zur Schule?`, einheit: km, antwort: `Es sind noch ${res} km.` };
      return { prompt: `Der Schulweg von ${p.name} ist ${t(r.terms[0])} km lang. Nach ${t(r.terms[1])} km trifft ${p.er} eine Freundin. Wie viele Kilometer sind es dann noch bis zur Schule?`, einheit: km, antwort: `Es sind noch ${res} km.` };
    },
  },
  {
    ops: ["+", "−"],
    stufen: ALLE,
    nenner: [2, 3, 4, 6, 12],
    passt: (r) => r.ops.every((o) => o === r.ops[0]),
    text: (r, [p]) => {
      const res = gemischt(r.result);
      const h = ["Stunden", "Stunde", "h"];
      const [a, b, c] = r.terms;
      if (r.ops[0] === "−")
        return {
          prompt: `${p.name} hat am Nachmittag ${t(a)} ${stunden(a)} Zeit. ${gross(p.er)} braucht ${t(b)} ${stunden(b)} für die Hausübung${c ? ` und ${t(c)} ${stunden(c)} zum Üben auf der Gitarre` : ""}. Wie viele Stunden Zeit bleiben ${p.ihm} dann noch?`,
          einheit: h,
          antwort: `Es bleiben ${res} ${stunden(r.result)}.`,
        };
      if (c)
        return { prompt: `${p.name} lernt am Wochenende ${t(a)} ${stunden(a)} für Mathe, ${t(b)} ${stunden(b)} für Englisch und ${t(c)} ${stunden(c)} für Deutsch. Wie viele Stunden lernt ${p.er} insgesamt?`, einheit: h, antwort: `${gross(p.er)} lernt ${res} ${stunden(r.result)}.` };
      return { prompt: `${p.name} lernt am Nachmittag ${t(a)} ${stunden(a)} für Mathe und ${t(b)} ${stunden(b)} für Englisch. Wie viele Stunden lernt ${p.er} insgesamt?`, einheit: h, antwort: `${gross(p.er)} lernt ${res} ${stunden(r.result)}.` };
    },
  },
  {
    ops: ["+"],
    stufen: ALLE,
    nenner: [2, 4, 5, 8, 10],
    text: (r) => {
      const res = gemischt(r.result);
      const [a, b, c] = r.terms;
      const kg = ["kg", "Kilogramm"];
      if (r.gemischt) return { prompt: `Für das Schulfest backt die Klasse Kuchen. Sie braucht ${t(a)} kg Mehl und ${t(b)} kg Zucker. Wie viele Kilogramm sind das zusammen?`, einheit: kg, antwort: `Das sind ${res} kg.` };
      if (c) return { prompt: `Für einen Kuchen brauchst du ${t(a)} kg Mehl, ${t(b)} kg Zucker und ${t(c)} kg Butter. Wie viele Kilogramm sind das zusammen?`, einheit: kg, antwort: `Das sind ${res} kg.` };
      return { prompt: `Für einen Kuchen brauchst du ${t(a)} kg Mehl und ${t(b)} kg Zucker. Wie viele Kilogramm sind das zusammen?`, einheit: kg, antwort: `Das sind ${res} kg.` };
    },
  },
];

const PRODUKTE: BruchKontext[] = [
  {
    ops: ["·"],
    stufen: [0],
    nenner: [2, 4, 5, 8, 10],
    passt: (r) => r.terms[1].n <= 5 && wert(r.terms[0]) >= 0.5,
    text: (r, [p]) => ({ prompt: `${p.name} trinkt an jedem Schultag ${t(r.terms[0])} Liter Wasser. Wie viele Liter trinkt ${p.er} in ${r.terms[1].n} Schultagen?`, einheit: ["Liter", "l", "L"], antwort: `${gross(p.er)} trinkt ${gemischt(r.result)} Liter.` }),
  },
  {
    ops: ["·"],
    stufen: [0],
    nenner: [2, 4, 5, 8, 10],
    text: (r, [p]) => ({ prompt: `${p.name} geht jeden Tag ${t(r.terms[0])} km zur Schule. Wie viele Kilometer sind das an ${r.terms[1].n} Schultagen?`, einheit: ["km", "Kilometer"], antwort: `Das sind ${gemischt(r.result)} km.` }),
  },
  {
    ops: ["·"],
    stufen: [0],
    nenner: [2, 3, 4, 6, 8],
    passt: (r) => wert(r.terms[0]) <= 0.5,
    text: (r) => ({ prompt: `Für die Klassenfeier bekommt jedes Kind ${t(r.terms[0])} einer Pizza. Wie viele Pizzas braucht man für ${r.terms[1].n} Kinder?`, einheit: ["Pizzas", "Pizzen"], antwort: `Man braucht ${gemischt(r.result)} Pizzas.` }),
  },
  {
    ops: ["·"],
    stufen: [1, 2],
    nenner: [2, 3, 4, 5, 6, 8, 9, 10, 12],
    passt: (r) => wert(r.result) < 1,
    text: (r) => ({ prompt: `${gross(t(r.terms[0]))} der Kinder einer Klasse fahren auf Schikurs. Von diesen Kindern können ${t(r.terms[1])} schon gut Schi fahren. Welcher Bruchteil der ganzen Klasse kann schon gut Schi fahren?`, einheit: [], antwort: `${gross(gemischt(r.result))} der Klasse kann schon gut Schi fahren.` }),
  },
  {
    ops: ["·"],
    stufen: [1, 2],
    nenner: [2, 3, 4, 5, 6, 8, 10],
    passt: (r) => wert(r.result) < 1,
    text: (r) => ({ prompt: `${gross(t(r.terms[0]))} des Schulgartens sind Beete. Auf ${t(r.terms[1])} der Beete wachsen Tomaten. Welcher Bruchteil des ganzen Gartens ist mit Tomaten bepflanzt?`, einheit: [], antwort: `${gross(gemischt(r.result))} des Gartens ist mit Tomaten bepflanzt.` }),
  },
  {
    ops: ["·"],
    stufen: [1, 2, 3],
    nenner: [
      [2, 4, 5, 8, 10],
      [2, 3, 4, 5, 6],
    ],
    passt: (r) => wert(r.terms[1]) < 1,
    text: (r, [p]) => ({ prompt: `Für ein Rezept brauchst du ${t(r.terms[0])} kg Mehl. ${p.name} backt nur ${t(r.terms[1])} der Menge. Wie viele Kilogramm Mehl braucht ${p.er}?`, einheit: ["kg", "Kilogramm"], antwort: `${gross(p.er)} braucht ${gemischt(r.result)} kg Mehl.` }),
  },
  {
    ops: ["·"],
    stufen: [1, 2, 3],
    nenner: [2, 4, 5, 8, 10],
    text: (r) => ({ prompt: `Eine rechteckige Pinnwand ist ${t(r.terms[0])} m lang und ${t(r.terms[1])} m breit. Wie groß ist ihre Fläche?`, einheit: ["m²", "m^2", "Quadratmeter"], antwort: `Die Fläche ist ${gemischt(r.result)} m² groß.` }),
  },
  {
    ops: ["·"],
    stufen: [3, 4],
    nenner: [2, 4, 5, 8],
    text: (r, [p]) => ({ prompt: `Das Zimmer von ${p.name} ist ${t(r.terms[0])} m lang und ${t(r.terms[1])} m breit. Wie groß ist die Bodenfläche?`, einheit: ["m²", "m^2", "Quadratmeter"], antwort: `Die Bodenfläche ist ${gemischt(r.result)} m² groß.` }),
  },
  {
    ops: ["·"],
    stufen: [3, 4],
    nenner: [
      [2, 4, 5, 8],
      [2, 3, 4, 5, 6],
    ],
    text: (r) => ({ prompt: `Die Klasse schafft beim Wandern ${t(r.terms[0])} km in einer Stunde. Wie viele Kilometer schafft sie in ${t(r.terms[1])} Stunden?`, einheit: ["km", "Kilometer"], antwort: `Sie schafft ${gemischt(r.result)} km.` }),
  },
];

const QUOTIENTEN: BruchKontext[] = [
  {
    ops: [":"],
    stufen: [0],
    nenner: [2, 4, 5, 8, 10],
    text: (r) => ({ prompt: `${gross(t(r.terms[0]))} Liter Saft werden gerecht auf ${r.terms[1].n} Gläser verteilt. Wie viele Liter sind in jedem Glas?`, einheit: ["Liter", "l", "L"], antwort: `In jedem Glas sind ${gemischt(r.result)} Liter.` }),
  },
  {
    ops: [":"],
    stufen: [0],
    nenner: [2, 3, 4, 6, 8],
    text: (r) => ({ prompt: `${r.terms[1].n} Kinder teilen sich ${t(r.terms[0])} einer Pizza gerecht. Welchen Teil der ganzen Pizza bekommt jedes Kind?`, einheit: [], antwort: `Jedes Kind bekommt ${gemischt(r.result)} der Pizza.` }),
  },
  {
    ops: [":"],
    stufen: [0],
    nenner: [2, 4, 5, 10],
    text: (r, [p]) => ({ prompt: `Ein Band ist ${t(r.terms[0])} m lang. ${p.name} schneidet es in ${r.terms[1].n} gleich lange Stücke. Wie lang ist ein Stück?`, einheit: ["m", "Meter"], antwort: `Ein Stück ist ${gemischt(r.result)} m lang.` }),
  },
  {
    ops: [":"],
    stufen: [1, 2, 3],
    nenner: [2, 3, 4, 5, 8, 10],
    passt: (r) => ganzzahl(r) && wert(r.terms[1]) <= 0.5,
    text: (r) => ({ prompt: `In einer Flasche sind ${t(r.terms[0])} Liter Saft. Wie viele Gläser zu je ${t(r.terms[1])} Liter kannst du damit füllen?`, einheit: ["Gläser"], antwort: `Du kannst ${r.result.n} Gläser füllen.` }),
  },
  {
    ops: [":"],
    stufen: [4],
    nenner: [2, 4],
    passt: ganzzahl,
    text: (r) => ({ prompt: `Für den Wandertag füllt die Klasse ${t(r.terms[0])} Liter Tee in Flaschen zu je ${t(r.terms[1])} Liter. Wie viele Flaschen werden voll?`, einheit: ["Flaschen"], antwort: `Es werden ${r.result.n} Flaschen voll.` }),
  },
  {
    ops: [":"],
    stufen: [1, 2, 3, 4],
    nenner: [2, 4, 5, 8, 10],
    passt: ganzzahl,
    text: (r, [p]) => ({ prompt: `Ein Geschenkband ist ${t(r.terms[0])} m lang. ${p.name} schneidet davon Stücke zu je ${t(r.terms[1])} m ab. Wie viele Stücke bekommt ${p.er}?`, einheit: ["Stücke", "Stück"], antwort: `${gross(p.er)} bekommt ${r.result.n} Stücke.` }),
  },
  {
    ops: [":"],
    stufen: [1, 2, 3],
    nenner: [2, 3, 4, 6, 12],
    passt: (r) => ganzzahl(r) && wert(r.terms[1]) < 1,
    text: (r, [p]) => ({ prompt: `${p.name} hat ${t(r.terms[0])} ${stunden(r.terms[0])} Zeit zum Lernen. Ein Lernvideo dauert ${t(r.terms[1])} Stunde. Wie viele Videos kann ${p.er} sich in dieser Zeit ansehen?`, einheit: ["Videos"], antwort: `${gross(p.er)} kann ${r.result.n} Videos ansehen.` }),
  },
  {
    ops: [":"],
    stufen: [1, 2, 3],
    nenner: [2, 4, 5, 8, 10],
    passt: (r) => ganzzahl(r) && wert(r.terms[1]) < 1,
    text: (r) => ({ prompt: `Für den Elternsprechtag werden ${t(r.terms[0])} kg Kekse in Säckchen zu je ${t(r.terms[1])} kg verpackt. Wie viele Säckchen werden voll?`, einheit: ["Säckchen"], antwort: `Es werden ${r.result.n} Säckchen voll.` }),
  },
  {
    ops: [":"],
    stufen: [3, 4],
    nenner: [
      [2, 4, 5, 8, 10],
      [2, 3, 4, 6],
    ],
    passt: (r) => wert(r.result) >= 1.5 && wert(r.result) <= 5 && r.result.d !== 1,
    text: (r) => ({ prompt: `Die Klasse wandert ${t(r.terms[0])} km in ${t(r.terms[1])} ${stunden(r.terms[1])}. Wie viele Kilometer schafft sie in einer Stunde?`, einheit: ["km", "Kilometer", "km/h"], antwort: `Sie schafft ${gemischt(r.result)} km in einer Stunde.` }),
  },
];

function bruchStory(rng: Rng, lv: Stufe, op: BruchOp, kontexte: BruchKontext[]): Story | null {
  const offen = kontexte.filter((k) => k.ops.includes(op) && k.stufen.includes(lv));
  while (offen.length) {
    const i = Math.floor(rng() * offen.length);
    const k = offen.splice(i, 1)[0];
    const key = `${kontexte === SUMMEN ? "s" : kontexte === PRODUKTE ? "p" : "q"}:${kontexte.indexOf(k)}:${op}:${lv}`;
    let list: BruchRechnung[];
    try {
      list = passende(key, () => bruchListe(lv, op).filter((r) => passtNenner(r, k.nenner) && (k.passt?.(r) ?? true)));
    } catch {
      continue; // no calculation of this level fits the story
    }
    const r = pick(rng, list);
    const ps = leute(rng, 3);
    const s = k.text(r, ps);
    if (!s) continue;
    const w = bruchWeg(r);
    const rechnung = r.terms.map((x, j) => `${j ? ` ${r.ops[j - 1]} ` : ""}${t(x)}`).join("");
    return {
      prompt: s.prompt,
      accepted: mitEinheit(bruchWerte(r.result), s.einheit),
      solution: [`Rechnung: ${rechnung}`, w.solution, `Antwort: ${s.antwort}`].join("\n"),
      hints: [`Welche Rechenart passt? Schreib zuerst die Rechnung auf: ${rechnung}`, ...w.hints.slice(0, 2)],
      errors: w.errors,
      wege: w.wege,
    };
  }
  return null;
}

// ---------- negative numbers ----------
const temp = (x: number) => `${zahl(x)} °C`;
const GRAD = ["°C", "Grad", "° C"];
const ZEITEN = [
  { bis: "Bis zu Mittag", am: "zu Mittag" },
  { bis: "Bis zum Abend", am: "am Abend" },
  { bis: "Bis Mitternacht", am: "um Mitternacht" },
];
/** A term in school notation: −4 + 9 − 7. */
const summe = (xs: number[]) => xs.map((x, i) => (i === 0 ? zahl(x) : `${x < 0 ? "−" : "+"} ${zahl(Math.abs(x))}`)).join(" ");

function negativStory(o: { prompt: string; werte: number[]; einheit: string[]; antwort: (x: string) => string; geld?: boolean; extra?: Fehler[] }): Story {
  const res = rund(o.werte.reduce((s, x) => s + x, 0));
  const a = o.geld ? geldAntwort(res) : antwort(res);
  const z = o.geld ? geld : zahl;
  return {
    prompt: o.prompt,
    accepted: mitEinheit([a], o.einheit),
    solution: [`Rechnung: ${summe(o.werte)} = ${z(res)}`, `Antwort: ${o.antwort(z(res))}`].join("\n"),
    hints: ["Schreib die Rechnung mit Vorzeichen auf: Hinauf oder dazu ist Plus, hinunter oder weg ist Minus.", "Stell dir eine Zahlengerade oder ein Thermometer vor.", `Rechnung: ${summe(o.werte)}`],
    errors: [{ answer: o.geld ? geldAntwort(-res) : antwort(-res), label: "Vorzeichenfehler beim Ergebnis" }, ...(o.extra ?? [])],
  };
}

const NEGATIV_ADDIEREN: Kontext[] = [
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const max = [10, 15, 20, 25, 20][lv];
      const schritte = lv <= 1 ? 1 : 2;
      const wert1 = (a: number, b: number) => (lv === 4 ? rint(rng, a * 2, b * 2) / 2 : rint(rng, a, b));
      const t0 = wert1(-max, Math.floor(max / 2)) || -3;
      const ds = Array.from({ length: schritte }, () => wert1(2, Math.ceil(max * 0.8)) * (rng() < 0.5 ? -1 : 1));
      const werte = [t0, ...ds];
      const zwischen = werte.map((_, i) => rund(werte.slice(0, i + 1).reduce((s, x) => s + x, 0)));
      if (zwischen.some((x) => Math.abs(x) > max) || !zwischen.some((x) => x < 0) || zwischen[zwischen.length - 1] === 0) return null;
      const text = ds.map((d, i) => `${ZEITEN[i].bis} ${d > 0 ? "steigt" : "fällt"} die Temperatur um ${zahl(Math.abs(d))} Grad.`).join(" ");
      const am = ZEITEN[ds.length - 1].am;
      return negativStory({
        prompt: `In der Früh hat es ${temp(t0)}. ${text} Wie viel Grad hat es ${am}?`,
        werte,
        einheit: GRAD,
        antwort: (x) => `${gross(am)} hat es ${x} °C.`,
        extra: [{ answer: antwort(rund(Math.abs(t0) + ds.reduce((s, x) => s + x, 0))), label: "Minus der Anfangstemperatur übersehen" }],
      });
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng, lv) => {
      const a = rint(rng, 1, lv === 1 ? 8 : 12);
      const b = -rint(rng, 3, lv === 1 ? 10 : 18);
      return {
        prompt: `An einem Wintertag hat es in Wien ${temp(a)}, auf dem Sonnblick ${temp(b)}. Wie groß ist der Temperaturunterschied zwischen den beiden Orten?`,
        accepted: mitEinheit([String(a - b)], GRAD),
        solution: [`Rechnung: ${zahl(a)} − (${zahl(b)}) = ${zahl(a)} + ${zahl(-b)} = ${a - b}`, `Antwort: Der Unterschied ist ${a - b} Grad.`].join("\n"),
        hints: ["Der Unterschied ist die größere minus die kleinere Temperatur.", "Minus eine negative Zahl ist wie Plus.", `${zahl(a)} − (${zahl(b)})`],
        errors: [{ answer: String(a + b), label: "Minus vor der negativen Zahl nicht beachtet" }],
      };
    },
  },
  {
    stufen: [0, 1],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const runter = rng() < 0.6;
      const s = runter ? rint(rng, 1, 4) : -rint(rng, 1, 3);
      const d = runter ? rint(rng, s + 1, s + 3) : rint(rng, -s + 1, -s + 4);
      return negativStory({
        prompt: `Im Einkaufszentrum ist das Erdgeschoß das Stockwerk 0, die Garage hat die Stockwerke −1, −2 und −3. ${p.name} steigt im Stockwerk ${zahl(s)} in den Lift und fährt ${d} Stockwerke nach ${runter ? "unten" : "oben"}. In welchem Stockwerk steigt ${p.er} aus?`,
        werte: [s, runter ? -d : d],
        einheit: [],
        antwort: (x) => `${gross(p.er)} steigt im Stockwerk ${x} aus.`,
        extra: runter ? [{ answer: String(d - s), label: "Abgezogen in die falsche Richtung" }] : [],
      });
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng, lv) => {
      const d0 = rint(rng, 5, lv === 1 ? 15 : 30);
      const zuege = lv === 1 ? [rint(rng, 2, d0 - 1)] : [-rint(rng, 3, 12), rint(rng, 4, 20)];
      const werte = [-d0, ...zuege];
      const res = werte.reduce((s, x) => s + x, 0);
      if (res >= 0) return null;
      const satz = (x: number, i: number) => `${i === 0 ? "Dann taucht er" : "Danach taucht er"} ${Math.abs(x)} m ${x > 0 ? "höher" : "tiefer"}.`;
      return negativStory({
        prompt: `Ein Taucher ist ${d0} m unter der Wasseroberfläche, also bei −${d0} m. ${zuege.map(satz).join(" ")} In welcher Höhe ist er jetzt?`,
        werte,
        einheit: ["m", "Meter"],
        antwort: (x) => `Er ist bei ${x} m.`,
      });
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const s0 = rint(rng, 2, lv === 0 ? 6 : 15);
      const verlust = rint(rng, s0 + 1, s0 + (lv === 0 ? 4 : 12));
      const gewinn = lv === 2 ? rint(rng, 2, 10) : 0;
      const werte = gewinn ? [s0, -verlust, gewinn] : [s0, -verlust];
      if (werte.reduce((s, x) => s + x, 0) === 0) return null;
      return negativStory({
        prompt: `Bei einem Quiz hat ${p.name} am Anfang ${s0} Punkte. In der ersten Runde verliert ${p.er} ${verlust} Punkte${gewinn ? `, in der zweiten Runde gewinnt ${p.er} ${gewinn} Punkte` : ""}. Wie viele Punkte hat ${p.er} jetzt?`,
        werte,
        einheit: ["Punkte"],
        antwort: (x) => `${gross(p.er)} hat jetzt ${x} Punkte.`,
      });
    },
  },
  {
    stufen: [2, 3, 4],
    make: (rng, lv) => {
      const cent = lv === 4;
      const k0 = cent ? rint(rng, 80, 300) + pick(rng, [0.5, 0.2, 0.8]) : rint(rng, 8, 30) * 10;
      const a = cent ? rint(rng, 30, 60) * 10 + pick(rng, [0.9, 0.5]) : rint(rng, 30, 60) * 10;
      const b = lv >= 3 ? rint(rng, 5, 25) * 10 : 0;
      const werte = b ? [k0, -a, b] : [k0, -a];
      if (k0 - a >= 0 || rund(k0 - a + b) === 0) return null;
      return negativStory({
        prompt: `Auf dem Konto des Sportvereins sind ${euro(k0)}. Für neue Trikots werden ${euro(a)} abgebucht.${b ? ` Dann kommen ${euro(b)} Mitgliedsbeiträge dazu.` : ""} Wie hoch ist der Kontostand jetzt?`,
        werte,
        einheit: ["€", "Euro"],
        geld: true,
        antwort: (x) => `Der Kontostand ist ${x} €.`,
      });
    },
  },
];

function produktStory(o: { prompt: string; rechnung: string; res: number; einheit: string[]; antwort: (x: string) => string; geld?: boolean; errors: Fehler[]; hint: string }): Story {
  const a = o.geld ? geldAntwort(o.res) : antwort(o.res);
  const z = o.geld ? geld : zahl;
  return {
    prompt: o.prompt,
    accepted: mitEinheit([a], o.einheit),
    solution: [`Rechnung: ${o.rechnung} = ${z(o.res)}`, `Antwort: ${o.antwort(z(o.res))}`].join("\n"),
    hints: [o.hint, "Gleiche Vorzeichen ergeben Plus, verschiedene Vorzeichen ergeben Minus.", `Rechnung: ${o.rechnung}`],
    errors: o.errors,
  };
}

const NEGATIV_MULTIPLIZIEREN: Kontext[] = [
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const d = lv === 4 ? pick(rng, [0.5, 1.5, 2.5]) : rint(rng, 1, lv === 0 ? 3 : 4);
      const n = rint(rng, 2, lv === 0 ? 5 : 8);
      const t0 = lv <= 1 ? 0 : rint(rng, 1, 8);
      const res = rund(t0 - n * d);
      if (res >= 0) return null;
      const h = 18;
      return produktStory({
        prompt: `Um ${h} Uhr hat es ${temp(t0)}. Danach sinkt die Temperatur jede Stunde um ${zahl(d)} Grad. Wie viel Grad hat es ${n} Stunden später?`,
        rechnung: t0 ? `${t0} + ${n} · (−${zahl(d)}) = ${t0} − ${zahl(n * d)}` : `${n} · (−${zahl(d)})`,
        res,
        einheit: GRAD,
        antwort: (x) => `Um ${h + n > 24 ? h + n - 24 : h + n} Uhr hat es ${x} °C.`,
        hint: "Jede Stunde kommt −" + zahl(d) + " Grad dazu. Das ist eine Multiplikation.",
        errors: [{ answer: antwort(-res), label: "Vorzeichen vergessen" }, ...(t0 ? [{ answer: antwort(rund(t0 + n * d)), label: "Gestiegen statt gesunken" }] : [])],
      });
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng, lv) => {
      const d = rint(rng, 2, lv === 0 ? 5 : 9);
      const n = rint(rng, 2, lv === 0 ? 5 : 9);
      return produktStory({
        prompt: `Ein Taucher startet an der Wasseroberfläche (0 m) und taucht jede Minute ${d} m tiefer. In welcher Höhe ist er nach ${n} Minuten?`,
        rechnung: `${n} · (−${d})`,
        res: -n * d,
        einheit: ["m", "Meter"],
        antwort: (x) => `Er ist bei ${x} m.`,
        hint: `Jede Minute ändert sich die Höhe um −${d} m.`,
        errors: [{ answer: String(n * d), label: "Vorzeichen vergessen" }, { answer: String(-(n + d)), label: "Addiert statt multipliziert" }],
      });
    },
  },
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const b = lv === 4 ? pick(rng, [7.5, 9.9, 12.9, 14.5]) : lv === 0 ? pick(rng, [5, 10]) : pick(rng, [5, 8, 10, 12, 15, 20]);
      const n = lv === 0 ? rint(rng, 2, 4) : rint(rng, 3, 12);
      return produktStory({
        prompt: `Für ein Handy-Abo werden jeden Monat ${euro(b)} vom Konto abgebucht. Um wie viel Euro ändert sich der Kontostand in ${n} Monaten? Gib die Änderung mit Vorzeichen an.`,
        rechnung: `${n} · (−${geld(b)})`,
        res: rund(-n * b),
        geld: true,
        einheit: ["€", "Euro"],
        antwort: (x) => `Der Kontostand ändert sich um ${x} €.`,
        hint: "Abbuchen heißt: der Kontostand wird kleiner, die Änderung ist negativ.",
        errors: [{ answer: geldAntwort(rund(n * b)), label: "Vorzeichen vergessen" }],
      });
    },
  },
  {
    stufen: [2, 3, 4],
    make: (rng, lv) => {
      const d = lv === 4 ? pick(rng, [1.5, 2.5, 0.5]) : rint(rng, 2, 6);
      const n = rint(rng, 3, 8);
      const temperatur = rng() < 0.5;
      return temperatur
        ? produktStory({
            prompt: `In ${n} Stunden ist die Temperatur gleichmäßig um ${zahl(n * d)} Grad gefallen. Um wie viel Grad hat sie sich pro Stunde geändert? Gib die Änderung mit Vorzeichen an.`,
            rechnung: `(−${zahl(n * d)}) : ${n}`,
            res: -d,
            einheit: GRAD,
            antwort: (x) => `Die Temperatur hat sich pro Stunde um ${x} Grad geändert.`,
            hint: "Gefallen heißt: die Änderung ist negativ. Teile sie durch die Anzahl der Stunden.",
            errors: [{ answer: antwort(d), label: "Vorzeichen vergessen" }, { answer: antwort(-n * n * d), label: "Multipliziert statt dividiert" }],
          })
        : produktStory({
            prompt: `Ein Konto hat nach ${n} Monaten ${euro(rund(n * d * 10))} weniger. Jeden Monat wurde gleich viel abgebucht. Um wie viel Euro hat sich der Kontostand pro Monat geändert? Gib die Änderung mit Vorzeichen an.`,
            rechnung: `(−${geld(rund(n * d * 10))}) : ${n}`,
            res: rund(-d * 10),
            geld: true,
            einheit: ["€", "Euro"],
            antwort: (x) => `Der Kontostand hat sich pro Monat um ${x} € geändert.`,
            hint: "Weniger heißt: die Änderung ist negativ. Teile sie durch die Anzahl der Monate.",
            errors: [{ answer: geldAntwort(rund(d * 10)), label: "Vorzeichen vergessen" }],
          });
    },
  },
  {
    stufen: [3, 4],
    make: (rng) => {
      const [n1, d1] = [rint(rng, 4, 9), rint(rng, 3, 8)];
      const [n2, d2] = [rint(rng, 2, 5), rint(rng, 2, 6)];
      const res = -n1 * d1 + n2 * d2;
      if (res >= 0) return null;
      return produktStory({
        prompt: `Ein Taucher taucht ${n1} Minuten lang jede Minute ${d1} m tiefer. Dann steigt er ${n2} Minuten lang jede Minute ${d2} m nach oben. In welcher Höhe ist er dann, wenn die Wasseroberfläche bei 0 m ist?`,
        rechnung: `${n1} · (−${d1}) + ${n2} · ${d2} = ${zahl(-n1 * d1)} + ${n2 * d2}`,
        res,
        einheit: ["m", "Meter"],
        antwort: (x) => `Er ist bei ${x} m.`,
        hint: "Rechne zuerst beide Teile einzeln: tiefer ist negativ, nach oben ist positiv.",
        errors: [{ answer: String(-res), label: "Vorzeichen vergessen" }, { answer: String(-n1 * d1 - n2 * d2), label: "Nach oben als negativ gerechnet" }],
      });
    },
  },
];

// ---------- percentages ----------
const PZ: number[][] = [
  [10, 20, 25, 50],
  [5, 10, 20, 25, 30, 40, 50, 75],
  [5, 15, 30, 35, 40, 60, 70, 80, 90],
  [12.5, 15, 35, 45, 65, 85, 7.5],
  [2.5, 12.5, 17.5, 37.5, 62.5, 7.5, 22.5],
];
type Fall = { G: number; p: number; W: number };
/** Pairs of a whole and a percentage whose part is clean: whole numbers (count) or at most `dez` decimals. */
function faelle(key: string, ganze: number[], ps: number[], dez: number): Fall[] {
  return passende(`prozent:${key}`, () =>
    ganze.flatMap((G) =>
      ps.flatMap((p) => {
        const W = rund((G * p) / 100);
        return Math.abs(W * 10 ** dez - Math.round(W * 10 ** dez)) < 1e-9 && W > 0 && W < G ? [{ G, p, W }] : [];
      }),
    ),
  );
}
const KLASSEN = [20, 21, 22, 24, 25, 26, 27, 28, 30];
const NOTEN: [string, number][] = [
  ["ein Genügend", 50],
  ["ein Befriedigend", 65],
  ["ein Gut", 80],
  ["ein Sehr gut", 90],
];
const PROZ = ["%", "Prozent"];

function prozentwertStory(o: { prompt: string; f: Fall; einheit: string[]; einheitWeg: string; antwort: (x: string) => string; geld?: boolean }): Story {
  const { G, p, W } = o.f;
  const weg = prozentwertWeg(G, p, W, o.einheitWeg);
  const a = o.geld ? geldAntwort(W) : antwort(W);
  return {
    prompt: o.prompt,
    accepted: mitEinheit([a], o.einheit),
    solution: [...weg, `Antwort: ${o.antwort(o.geld ? geld(W) : zahl(W))}`].join("\n"),
    hints: ["Gesucht ist ein Teil vom Ganzen (der Prozentwert).", `Berechne zuerst 1 % oder 10 % von ${zahl(G)}.`, prozentwertHilfe(G, p, W, o.einheitWeg)],
    errors: [
      { answer: antwort(rund(G * p)), label: "Durch 100 dividieren vergessen" },
      { answer: antwort(rund(G - W)), label: "Den Rest statt den Anteil berechnet" },
    ],
    wege: prozentwertWege(G, p, W, o.einheitWeg),
  };
}

const PROZENTWERT: Kontext[] = [
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const { ding, G, p, W } = dingFall(rng, lv);
      const weg = prozentwertWeg(G, p, W);
      if (lv <= 2)
        return {
          prompt: `Im Abverkauf gibt es auf ${ding.einen} um ${euro(G)} ${zahl(p)} % Rabatt. Wie viel Euro sparst du?`,
          accepted: mitEinheit([geldAntwort(W)], ["€", "Euro"]),
          solution: [...weg, `Antwort: Du sparst ${euro(W)}.`].join("\n"),
          hints: ["Der Rabatt ist ein Teil vom alten Preis.", `Berechne ${zahl(p)} % von ${euro(G)}.`, prozentwertHilfe(G, p, W)],
          errors: [
            { answer: antwort(rund(G * p)), label: "Durch 100 dividieren vergessen" },
            { answer: geldAntwort(rund(G - W)), label: "Neuen Preis statt Rabatt berechnet" },
          ],
          wege: prozentwertWege(G, p, W),
        };
      const teurer = lv === 4 && rng() < 0.4;
      const neu = rund(teurer ? G + W : G - W);
      return {
        prompt: teurer
          ? `${gross(ding.ein)} kostet ${euro(G)}. Im Frühling wird der Preis um ${zahl(p)} % erhöht. Wie viel kostet ${ding.der} danach?`
          : `Im Abverkauf gibt es auf ${ding.einen} um ${euro(G)} ${zahl(p)} % Rabatt. Wie viel kostet ${ding.der} nach dem Rabatt?`,
        accepted: mitEinheit([geldAntwort(neu)], ["€", "Euro"]),
        solution: [...weg, `${geld(G)} € ${teurer ? "+" : "−"} ${geld(W)} € = ${geld(neu)} €`, `Antwort: ${gross(ding.der)} kostet dann ${euro(neu)}.`].join("\n"),
        hints: [`Berechne zuerst, um wie viel Euro der Preis ${teurer ? "steigt" : "sinkt"}.`, `${zahl(p)} % von ${euro(G)}`, weg[0]],
        errors: [
          { answer: geldAntwort(W), label: teurer ? "Nur die Erhöhung berechnet" : "Nur den Rabatt berechnet" },
          { answer: geldAntwort(rund(teurer ? G - W : G + W)), label: teurer ? "Abgezogen statt dazugezählt" : "Dazugezählt statt abgezogen" },
          { answer: geldAntwort(rund(teurer ? G + p : G - p)), label: "Prozentsatz statt Betrag gerechnet" },
        ],
      };
    },
  },
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const f = pick(rng, faelle(`klasse:${lv}`, KLASSEN, PZ[lv], 0));
      return prozentwertStory({
        prompt: `In der Klasse von ${p.name} sind ${f.G} Kinder. ${zahl(f.p)} % davon kommen mit dem Rad zur Schule. Wie viele Kinder sind das?`,
        f,
        einheit: ["Kinder"],
        einheitWeg: "",
        antwort: (x) => `Es kommen ${x} Kinder mit dem Rad.`,
      });
    },
  },
  {
    stufen: [0, 1, 2, 3],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const list = passende(`prozent:taschengeld:${lv}`, () => [20, 25, 30, 40, 50, 60].flatMap((G) => PZ[lv].flatMap((pp) => (prozentwertExakt(G, pp, lv) !== null ? [{ G, p: pp, W: prozentwertExakt(G, pp, lv)! }] : []))));
      const f = pick(rng, list);
      return prozentwertStory({
        prompt: `${p.name} bekommt ${euro(f.G)} Taschengeld im Monat und spart ${zahl(f.p)} % davon. Wie viel Euro spart ${p.er} im Monat?`,
        f,
        einheit: ["€", "Euro"],
        einheitWeg: "€",
        geld: true,
        antwort: (x) => `${gross(p.er)} spart ${x} € im Monat.`,
      });
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng) => {
      const [note, pct] = pick(rng, NOTEN);
      const f = pick(rng, faelle(`note:${pct}`, [24, 32, 36, 40, 48, 50, 60], [pct], 0));
      return prozentwertStory({
        prompt: `Bei der Schularbeit gibt es ${f.G} Punkte. Für ${note} brauchst du bei dieser Schularbeit mindestens ${pct} % der Punkte. Wie viele Punkte sind das?`,
        f,
        einheit: ["Punkte"],
        einheitWeg: "Punkte",
        antwort: (x) => `Du brauchst mindestens ${x} Punkte.`,
      });
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng, lv) => {
      const f = pick(rng, faelle(`weg:${lv}`, [6, 8, 10, 12, 15, 16, 18, 20, 24], PZ[lv].filter((x) => x >= 10), lv <= 1 ? 0 : 1));
      return prozentwertStory({
        prompt: `Der Wanderweg zur Hütte ist ${f.G} km lang. Nach ${zahl(f.p)} % des Weges macht die Klasse eine Pause. Wie viele Kilometer ist sie bis zur Pause gegangen?`,
        f,
        einheit: ["km", "Kilometer"],
        einheitWeg: "km",
        antwort: (x) => `Bis zur Pause sind es ${x} km.`,
      });
    },
  },
  {
    stufen: [0, 1, 2, 3],
    make: (rng, lv) => {
      const f = pick(rng, faelle(`gb:${lv}`, [5, 10, 15, 20, 30, 40, 50], PZ[lv], lv <= 1 ? 0 : 1));
      return prozentwertStory({
        prompt: `Dein Handytarif hat ${f.G} GB Datenvolumen im Monat. Du hast schon ${zahl(f.p)} % davon verbraucht. Wie viele GB sind das?`,
        f,
        einheit: ["GB"],
        einheitWeg: "GB",
        antwort: (x) => `Du hast ${x} GB verbraucht.`,
      });
    },
  },
];

function satzStory(o: { prompt: string; W: number; G: number; p: number; vorher?: string; antwort: string; geld?: boolean }): Story {
  const z = (x: number) => (o.geld ? `${geld(x)} €` : zahl(x));
  return {
    prompt: o.prompt,
    accepted: mitEinheit([antwort(o.p)], PROZ),
    solution: [...(o.vorher ? [o.vorher] : []), `${z(o.W)} : ${z(o.G)} = ${zahl(o.p / 100)}`, `${zahl(o.p / 100)} = ${zahl(o.p)} %`, `Antwort: ${o.antwort}`].join("\n"),
    hints: ["Teile den Teil durch das Ganze.", "Die Dezimalzahl mal 100 gibt die Prozent.", `${z(o.W)} : ${z(o.G)}`],
    errors: [
      { answer: antwort(rund(o.p / 100)), label: "Mal 100 vergessen" },
      { answer: antwort(rund((o.G / o.W) * 100)), label: "Ganzes durch Teil gerechnet" },
    ],
  };
}
const PZ_SATZ: number[][] = [
  [10, 20, 25, 50, 75],
  [5, 10, 15, 20, 25, 30, 40, 60, 75, 80],
  [4, 8, 12, 15, 35, 45, 64, 65, 85],
  [12.5, 37.5, 62.5, 87.5, 7.5, 32, 44],
  [2.5, 7.5, 12.5, 17.5, 37.5, 62.5, 87.5],
];
const PROZENTSATZ: Kontext[] = [
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const f = pick(rng, faelle(`satzklasse:${lv}`, KLASSEN, PZ_SATZ[lv], 0));
      return satzStory({ prompt: `In der Klasse von ${p.name} sind ${f.G} Kinder. ${f.W} davon haben ein Haustier. Wie viel Prozent der Kinder sind das?`, ...f, antwort: `${zahl(f.p)} % der Kinder haben ein Haustier.` });
    },
  },
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const list = faelle(`satzpunkte:${lv}`, [20, 24, 25, 32, 40, 48, 50, 60, 64, 80], PZ_SATZ[lv], 0).filter((f) => f.p >= 30 || lv >= 3);
      if (!list.length) return null;
      const f = pick(rng, list);
      return satzStory({ prompt: `${p.name} hat bei der Schularbeit ${f.W} von ${f.G} Punkten erreicht. Wie viel Prozent der Punkte sind das?`, ...f, antwort: `${gross(p.er)} hat ${zahl(f.p)} % der Punkte erreicht.` });
    },
  },
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const { ding, G, p, W } = dingFall(rng, lv);
      if (lv <= 2) return satzStory({ prompt: `Auf ${ding.einen} um ${euro(G)} bekommst du im Abverkauf ${euro(W)} Rabatt. Wie viel Prozent Rabatt sind das?`, G, p, W, geld: true, antwort: `Das sind ${zahl(p)} % Rabatt.` });
      const neu = rund(G - W);
      return satzStory({
        prompt: `${gross(ding.ein)} kostet statt ${euro(G)} jetzt nur mehr ${euro(neu)}. Um wie viel Prozent ist der Preis gesunken?`,
        G,
        p,
        W,
        vorher: `${geld(G)} € − ${geld(neu)} € = ${geld(W)} €`,
        geld: true,
        antwort: `Der Preis ist um ${zahl(p)} % gesunken.`,
      });
    },
  },
  {
    stufen: [0, 1, 2, 3],
    make: (rng, lv) => {
      const f = pick(rng, faelle(`satzgb:${lv}`, [5, 10, 20, 25, 40, 50], PZ_SATZ[lv], 1));
      return satzStory({ prompt: `Von ${f.G} GB Datenvolumen hast du in diesem Monat schon ${zahl(f.W)} GB verbraucht. Wie viel Prozent sind das?`, ...f, antwort: `Das sind ${zahl(f.p)} %.` });
    },
  },
];

function grundStory(o: { prompt: string; f: Fall; einheit: string[]; u: string; antwort: (x: string) => string; geld?: boolean; vermindert?: boolean }): Story {
  const { G, p, W } = o.f;
  const z = o.geld ? geld : zahl;
  const u = o.u ? ` ${o.u}` : "";
  const teil = o.vermindert ? rund(G - W) : W;
  const pp = o.vermindert ? 100 - p : p;
  const a = o.geld ? geldAntwort(G) : antwort(G);
  return {
    prompt: o.prompt,
    accepted: mitEinheit([a], o.einheit),
    solution: [
      ...(o.vermindert ? [`100 % − ${zahl(p)} % = ${zahl(pp)} %`] : []),
      `${zahl(pp)} % = ${z(teil)}${u}`,
      `1 % = ${z(teil)}${u} : ${zahl(pp)} = ${zahl(G / 100)}${u}`,
      `100 % = ${zahl(G / 100)}${u} · 100 = ${z(G)}${u}`,
      `Antwort: ${o.antwort(z(G))}`,
    ].join("\n"),
    hints: [o.vermindert ? "Der neue Preis ist nicht 100 %. Wie viel Prozent sind noch übrig?" : "Gesucht ist das Ganze (100 %).", `Wenn ${zahl(pp)} % gleich ${z(teil)}${u} sind, wie viel ist dann 1 %?`, `1 % = ${z(teil)} : ${zahl(pp)}`],
    errors: [
      { answer: antwort(rund((teil * pp) / 100)), label: "Prozentwert statt Grundwert berechnet" },
      ...(o.vermindert ? [{ answer: antwort(rund(teil + (teil * p) / 100)), label: "Prozent vom neuen Preis dazugezählt" }] : [{ answer: antwort(rund(teil * 100)), label: "Durch den Prozentsatz dividieren vergessen" }]),
    ],
  };
}
const GRUNDWERT: Kontext[] = [
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const f = dingFall(rng, lv);
      const { ding } = f;
      if (lv === 4 && rng() < 0.6)
        return grundStory({
          prompt: `Nach einem Rabatt von ${zahl(f.p)} % kostet ${ding.der} nur mehr ${euro(rund(f.G - f.W))}. Wie viel hat ${ding.der} vorher gekostet?`,
          f,
          einheit: ["€", "Euro"],
          u: "€",
          geld: true,
          vermindert: true,
          antwort: (x) => `${gross(ding.der)} hat vorher ${x} € gekostet.`,
        });
      return grundStory({
        prompt: `${p.name} hat schon ${euro(f.W)} für ${ding.einen} gespart. Das sind ${zahl(f.p)} % des Preises. Wie viel kostet ${ding.der}?`,
        f,
        einheit: ["€", "Euro"],
        u: "€",
        geld: true,
        antwort: (x) => `${gross(ding.der)} kostet ${x} €.`,
      });
    },
  },
  {
    stufen: ALLE,
    make: (rng, lv) => {
      const f = pick(rng, faelle(`gweg:${lv}`, [6, 8, 10, 12, 15, 16, 18, 20, 24], PZ[lv].filter((x) => x >= 10), lv <= 1 ? 0 : 1));
      return grundStory({
        prompt: `Am Wandertag ist die Klasse schon ${zahl(f.W)} km gegangen. Das sind ${zahl(f.p)} % des ganzen Weges. Wie lang ist der ganze Weg?`,
        f,
        einheit: ["km", "Kilometer"],
        u: "km",
        antwort: (x) => `Der ganze Weg ist ${x} km lang.`,
      });
    },
  },
  {
    stufen: [0, 1, 2, 3],
    make: (rng, lv) => {
      const f = pick(rng, faelle(`gklasse:${lv}`, KLASSEN, PZ[lv], 0));
      return grundStory({
        prompt: `${f.W} Kinder einer Klasse fahren mit dem Bus zur Schule. Das sind ${zahl(f.p)} % der Klasse. Wie viele Kinder sind in der Klasse?`,
        f,
        einheit: ["Kinder"],
        u: "",
        antwort: (x) => `In der Klasse sind ${x} Kinder.`,
      });
    },
  },
  {
    stufen: [1, 2, 3, 4],
    make: (rng) => {
      const [note, pct] = pick(rng, NOTEN);
      const f = pick(rng, faelle(`gnote:${pct}`, [24, 32, 36, 40, 48, 50, 60], [pct], 0));
      return grundStory({
        prompt: `Für ${note} brauchst du bei dieser Schularbeit ${f.W} Punkte. Das sind ${pct} % aller Punkte. Wie viele Punkte gibt es insgesamt?`,
        f,
        einheit: ["Punkte"],
        u: "Punkte",
        antwort: (x) => `Es gibt insgesamt ${x} Punkte.`,
      });
    },
  },
];

// ---------- equations ----------
/** A word problem that leads to an equation in x, with what x means and the answer sentence. */
export type GleichungsText = { text: string; g: Gleichung; aufstellen?: string; bedeutung: string; einheit: string[]; antwort: (x: string) => string; geld?: boolean };
type GKontext = { stufen: Stufe[]; art: ("einfach" | "klammern")[]; make: (rng: Rng, lv: Stufe) => GleichungsText | null };

const G_KONTEXTE: GKontext[] = [
  {
    stufen: [0, 1, 2],
    art: ["einfach"],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const x = rint(rng, 2, [12, 20, 30, 30, 30][lv]);
      const a = rint(rng, 2, 5);
      const b = rint(rng, 1, lv === 0 ? 10 : 20);
      const minusB = lv >= 1 && rng() < 0.4 && a * x - b > 0;
      const c = minusB ? a * x - b : a * x + b;
      return {
        text: `${p.name} denkt sich eine Zahl. ${gross(p.er)} multipliziert sie mit ${a} und ${minusB ? `subtrahiert ${b}` : `addiert ${b}`}. Dann erhält ${p.er} ${c}. Welche Zahl hat sich ${p.name} gedacht?`,
        g: einfacheGleichung(a, minusB ? -b : b, c),
        bedeutung: "die gedachte Zahl",
        einheit: [],
        antwort: (v) => `${p.name} hat sich die Zahl ${v} gedacht.`,
      };
    },
  },
  {
    stufen: [0, 1, 2],
    art: ["einfach"],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const s = rint(rng, 2, 12) * 5;
      const r = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
      const x = rint(rng, 2, [8, 12, 20, 20, 20][lv]);
      const z = s + r * x;
      return {
        text: `${p.name} hat schon ${s} € gespart. Jede Woche legt ${p.er} ${r} € dazu. Nach wie vielen Wochen hat ${p.er} ${z} €?`,
        g: einfacheGleichung(r, s, z),
        bedeutung: "die Anzahl der Wochen",
        einheit: ["Wochen"],
        antwort: (v) => `Nach ${v} Wochen hat ${p.name} ${z} €.`,
      };
    },
  },
  {
    stufen: [0, 1, 2, 3],
    art: ["einfach"],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const dez = lv >= 3;
      const g0 = dez ? pick(rng, [9.9, 12.9, 14.9]) : pick(rng, [5, 8, 10, 12, 15]);
      const r = dez ? pick(rng, [1.5, 2.5, 3.5]) : pick(rng, [2, 3, 4, 5]);
      const x = rint(rng, 1, 8);
      const c = rund(g0 + r * x);
      return {
        text: `Ein Handytarif kostet ${euro(g0)} Grundgebühr im Monat. Für jedes zusätzliche GB Daten zahlst du ${euro(r)}. ${p.name} zahlt in einem Monat ${euro(c)}. Wie viele zusätzliche GB hat ${p.er} verbraucht?`,
        g: einfacheGleichung(r, g0, c, dez),
        bedeutung: "die Anzahl der zusätzlichen GB",
        einheit: ["GB"],
        antwort: (v) => `${gross(p.er)} hat ${v} GB zusätzlich verbraucht.`,
      };
    },
  },
  {
    stufen: [0, 1, 2, 3],
    art: ["einfach"],
    make: (rng, lv) => {
      const n = rint(rng, 2, 5);
      const dez = lv >= 3 && rng() < 0.6;
      const x = dez ? pick(rng, [7.5, 8.5, 9.5, 10.5]) : rint(rng, 7, 12);
      const pc = pick(rng, [5, 6, 7, 8]);
      const z = rund(n * x + pc);
      return {
        text: `${n} Freunde gehen ins Kino. Sie kaufen ${n} Kinokarten und ein großes Popcorn um ${euro(pc)}. Zusammen zahlen sie ${euro(z)}. Wie viel kostet eine Kinokarte?`,
        g: einfacheGleichung(n, pc, z, true),
        bedeutung: "der Preis einer Kinokarte in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Eine Kinokarte kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [1, 2, 3],
    art: ["einfach"],
    make: (rng) => {
      const bus = pick(rng, [120, 150, 180, 200, 240]);
      const e = pick(rng, [3, 4, 5, 6, 8]);
      const x = rint(rng, 18, 28);
      const z = bus + e * x;
      return {
        text: `Für den Wandertag kostet der Bus ${bus} €. Dazu kommen ${e} € Eintritt für jedes Kind. Insgesamt zahlt die Klasse ${z} €. Wie viele Kinder fahren mit?`,
        g: einfacheGleichung(e, bus, z),
        bedeutung: "die Anzahl der Kinder",
        einheit: ["Kinder"],
        antwort: (v) => `Es fahren ${v} Kinder mit.`,
      };
    },
  },
  {
    stufen: [3, 4],
    art: ["einfach"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const x = pick(rng, [0.8, 1.2, 1.5, 1.9, 2.5]);
      const n = rint(rng, 3, 8);
      const z0 = pick(rng, [4.5, 5.9, 6.5, 7.9]);
      const c = rund(n * x + z0);
      return {
        text: `${p.name} kauft ${n} Hefte und einen Zirkel um ${euro(z0)}. ${gross(p.er)} zahlt ${euro(c)}. Wie viel kostet ein Heft?`,
        g: einfacheGleichung(n, z0, c, true),
        bedeutung: "der Preis eines Heftes in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Ein Heft kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [3, 4],
    art: ["einfach"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const x = pick(rng, [0.4, 0.45, 0.5, 0.55, 0.6, 0.7]);
      const n = rint(rng, 2, 5);
      const k = pick(rng, [1.2, 1.5, 1.9]);
      const c = rund(n * x + k);
      return {
        text: `Für die Jause kauft ${p.name} ${n} Semmeln und einen Kakao um ${euro(k)}. ${gross(p.er)} zahlt ${euro(c)}. Wie viel kostet eine Semmel?`,
        g: einfacheGleichung(n, k, c, true),
        bedeutung: "der Preis einer Semmel in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Eine Semmel kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [2, 3, 4],
    art: ["einfach"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const g0 = pick(rng, [2, 3, 4, 5]);
      const r = pick(rng, [1.5, 2.5, 3, 3.5]);
      const x = rint(rng, 2, 6);
      const c = rund(g0 + r * x);
      return {
        text: `Ein Leihrad kostet ${euro(g0)} Grundgebühr und ${euro(r)} pro Stunde. ${p.name} zahlt ${euro(c)}. Wie viele Stunden ist ${p.er} gefahren?`,
        g: einfacheGleichung(r, g0, c, true),
        bedeutung: "die Anzahl der Stunden",
        einheit: ["Stunden", "h"],
        antwort: (v) => `${gross(p.er)} ist ${v} Stunden gefahren.`,
      };
    },
  },
  {
    stufen: [1, 2, 3],
    art: ["einfach"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const x = rint(rng, 6, 14);
      const d = rint(rng, 1, 5);
      const s = 2 * x + d;
      return {
        text: `${p.name} ist ${d} ${d === 1 ? "Jahr" : "Jahre"} jünger als ${p.sein} Bruder. Zusammen sind die beiden ${s} Jahre alt. Wie alt ist ${p.name}?`,
        g: einfacheGleichung(2, d, s),
        aufstellen: `x + (x + ${d}) = ${s}`,
        bedeutung: `das Alter von ${p.name}`,
        einheit: ["Jahre"],
        antwort: (v) => `${p.name} ist ${v} Jahre alt.`,
      };
    },
  },
  {
    stufen: [2, 3, 4],
    art: ["einfach"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const mutter = rng() < 0.5;
      const fall = pick(
        rng,
        range(8, 14).flatMap((x) => [3, 4].filter((k) => k * x >= 28 && k * x <= 50 && (k - 1) * x >= 20).map((k) => ({ x, k }))),
      );
      const s = (fall.k + 1) * fall.x;
      return {
        text: `${p.name} und ${p.sein}${mutter ? "e Mutter" : " Vater"} sind zusammen ${s} Jahre alt. ${mutter ? "Die Mutter" : "Der Vater"} ist ${fall.k}-mal so alt wie ${p.name}. Wie alt ist ${p.name}?`,
        g: einfacheGleichung(fall.k + 1, 0, s),
        aufstellen: `x + ${fall.k}x = ${s}`,
        bedeutung: `das Alter von ${p.name}`,
        einheit: ["Jahre"],
        antwort: (v) => `${p.name} ist ${v} Jahre alt.`,
      };
    },
  },
  {
    stufen: [3, 4],
    art: ["einfach"],
    make: (rng, lv) => {
      const dez = lv === 4;
      const rb = dez ? pick(rng, [2.5, 3, 3.5]) : rint(rng, 2, 4);
      const ra = rund(rb - (dez ? pick(rng, [0.5, 1, 1.5]) : rint(rng, 1, rb - 1)));
      const x = rint(rng, 2, 10);
      const b0 = pick(rng, [4, 5, 6, 8]);
      const a0 = rund(b0 + (rb - ra) * x);
      if (ra <= 0 || !Number.isInteger(rund(a0 * 10))) return null;
      return {
        text: `Tarif A kostet ${euro(a0)} im Monat und ${euro(ra)} pro GB. Tarif B kostet ${euro(b0)} im Monat und ${euro(rb)} pro GB. Bei wie vielen GB kosten beide Tarife gleich viel?`,
        g: gleichungBeideSeiten(rb, b0, ra, a0, true),
        bedeutung: "die Anzahl der GB",
        einheit: ["GB"],
        antwort: (v) => `Bei ${v} GB kosten beide Tarife gleich viel.`,
      };
    },
  },
  {
    stufen: [3, 4],
    art: ["einfach"],
    make: (rng) => {
      const [p, q] = leute(rng, 2);
      const r1 = rint(rng, 3, 6);
      const r2 = r1 + rint(rng, 1, 4);
      const x = rint(rng, 3, 12);
      const s2 = rint(rng, 1, 6) * 5;
      const s1 = s2 + (r2 - r1) * x;
      return {
        text: `${p.name} hat ${s1} € und spart jede Woche ${r1} €. ${q.name} hat ${s2} € und spart jede Woche ${r2} €. Nach wie vielen Wochen haben beide gleich viel Geld?`,
        g: gleichungBeideSeiten(r2, s2, r1, s1),
        bedeutung: "die Anzahl der Wochen",
        einheit: ["Wochen"],
        antwort: (v) => `Nach ${v} Wochen haben beide gleich viel Geld.`,
      };
    },
  },
  // with brackets
  {
    stufen: [0, 1, 2],
    art: ["klammern"],
    make: (rng, lv) => {
      const x = rint(rng, 3, lv === 0 ? 10 : 15);
      const b = rint(rng, 1, 6);
      const c = 4 * (x + b);
      return {
        text: `Jede Seite eines Quadrats wird um ${b} cm verlängert. Das neue Quadrat hat einen Umfang von ${c} cm. Wie lang war eine Seite vorher?`,
        g: klammerGleichung(4, b, 0, c),
        bedeutung: "die Seitenlänge vorher in cm",
        einheit: ["cm", "Zentimeter"],
        antwort: (v) => `Eine Seite war vorher ${v} cm lang.`,
      };
    },
  },
  {
    stufen: [0, 1, 2, 3, 4],
    art: ["klammern"],
    make: (rng, lv) => {
      const [p] = leute(rng, 1);
      const x = rint(rng, 3, [10, 15, 20, 25, 25][lv]);
      const a = rint(rng, 2, lv === 0 ? 5 : 9);
      const b = rint(rng, 1, 9);
      const minusB = lv >= 1 && rng() < 0.4 && x - b >= 3;
      // schwer and sehr schwer: a third step, a(x + b) − e (the result stays positive)
      const basis = a * (minusB ? x - b : x + b);
      const e = lv >= 3 ? rint(rng, 2, Math.min(9, basis - 1)) : 0;
      const c = basis - e;
      const zuletzt = e ? `, multipliziert das Ergebnis mit ${a} und subtrahiert zuletzt ${e}` : ` und multipliziert das Ergebnis mit ${a}`;
      return {
        text: `${p.name} denkt sich eine Zahl. ${gross(p.er)} ${minusB ? `subtrahiert ${b}` : `addiert ${b}`}${zuletzt}. Dann erhält ${p.er} ${c}. Welche Zahl hat sich ${p.name} gedacht?`,
        g: klammerGleichung(a, minusB ? -b : b, -e, c),
        bedeutung: "die gedachte Zahl",
        einheit: [],
        antwort: (v) => `${p.name} hat sich die Zahl ${v} gedacht.`,
      };
    },
  },
  {
    stufen: [0, 1, 2],
    art: ["klammern"],
    make: (rng) => {
      const n = rint(rng, 3, 8);
      const b = rint(rng, 2, 4);
      const x = rint(rng, 3, 8);
      const c = n * (x + b);
      return {
        text: `${n} Kinder fahren mit dem Bus ins Freibad. Für jedes Kind kostet die Busfahrt ${b} €, dazu kommt der Eintritt. Zusammen zahlen sie ${c} €. Wie viel kostet der Eintritt für ein Kind?`,
        g: klammerGleichung(n, b, 0, c),
        bedeutung: "der Eintritt für ein Kind in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Der Eintritt kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [1, 2, 3],
    art: ["klammern"],
    make: (rng) => {
      const n = rint(rng, 3, 6);
      const b = rint(rng, 2, 5);
      const x = rint(rng, 12, 25);
      const c = n * (x - b);
      return {
        text: `${n} Freunde kaufen für die Sportwoche je ein T-Shirt. Auf jedes T-Shirt gibt es ${b} € Rabatt. Zusammen zahlen sie ${c} €. Wie viel kostet ein T-Shirt ohne Rabatt?`,
        g: klammerGleichung(n, -b, 0, c),
        bedeutung: "der Preis eines T-Shirts ohne Rabatt in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Ein T-Shirt kostet ohne Rabatt ${v} €.`,
      };
    },
  },
  {
    stufen: [2, 3],
    art: ["klammern"],
    make: (rng) => {
      const n = rint(rng, 3, 5);
      const b = rint(rng, 2, 3);
      const e = pick(rng, [5, 6, 7]);
      const x = rint(rng, 7, 11);
      const c = n * (x + b) + e;
      return {
        text: `${n} Kinder gehen ins Kino. Jedes Kind kauft eine Karte und ein Getränk um ${b} €. Dazu kauft die Gruppe ein großes Popcorn um ${e} €. Zusammen zahlen sie ${c} €. Wie viel kostet eine Kinokarte?`,
        g: klammerGleichung(n, b, e, c),
        bedeutung: "der Preis einer Kinokarte in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Eine Kinokarte kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [3, 4],
    art: ["klammern"],
    make: (rng) => {
      const fall = pick(
        rng,
        passende("gl:gruppen", () =>
          range(3, 6).flatMap((a) =>
            range(2, a - 1).flatMap((c) =>
              range(1, 3).flatMap((b) =>
                range(2, 5)
                  .filter((d) => (c * d - a * b) % (a - c) === 0 && (c * d - a * b) / (a - c) >= 3 && (c * d - a * b) / (a - c) <= 9)
                  .map((d) => ({ a, b, c, d })),
              ),
            ),
          ),
        ),
      );
      const g = klammernBeideSeiten(fall.a, fall.b, fall.c, fall.d);
      return {
        text: `Im Schwimmbad zahlt Gruppe A für ${fall.a} Kinder je den Eintritt und ${fall.b} € für eine Jause. Gruppe B zahlt für ${fall.c} Kinder je den Eintritt und ${fall.d} € für ein Eis. Beide Gruppen zahlen gleich viel. Wie viel kostet der Eintritt für ein Kind?`,
        g,
        bedeutung: "der Eintritt für ein Kind in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Der Eintritt kostet ${v} €.`,
      };
    },
  },
  {
    stufen: [4],
    art: ["klammern"],
    make: (rng) => {
      const [p] = leute(rng, 1);
      const a = rint(rng, 2, 4);
      const b = rint(rng, 1, 3);
      const x = rint(rng, 8, 16);
      const e = pick(rng, [50, 60, 70, 80]);
      const c = e - a * (x - b);
      if (c < 2) return null;
      const g = minusKlammer(e, a, b, c);
      return {
        text: `${p.name} hat ${e} €. ${gross(p.er)} kauft ${a} Bücher und bekommt auf jedes Buch ${b} € Rabatt. Danach hat ${p.er} noch ${c} €. Wie viel kostet ein Buch ohne Rabatt?`,
        g,
        bedeutung: "der Preis eines Buches ohne Rabatt in Euro", geld: true,
        einheit: ["€", "Euro"],
        antwort: (v) => `Ein Buch kostet ohne Rabatt ${v} €.`,
      };
    },
  },
];
/** A word problem for an equation of the kind (einfach, klammern; text takes both), or null. */
export function gleichungsText(rng: Rng, lv: Stufe, art: "einfach" | "klammern" | "text", nurGanz = false): GleichungsText | null {
  const offen = G_KONTEXTE.filter((k) => k.stufen.includes(lv) && (art === "text" || k.art.includes(art)));
  for (let i = 0; i < 40 && offen.length; i++) {
    const k = pick(rng, offen);
    const s = k.make(rng, lv);
    if (s && (!nurGanz || s.g.x.d === 1)) return s;
  }
  return null;
}

function gleichungStory(rng: Rng, lv: Stufe, art: "einfach" | "klammern" | "text"): Story | null {
  const s = gleichungsText(rng, lv, art);
  if (!s) return null;
  const { g } = s;
  const x = xAntwort(g);
  const geldwert = s.geld && 100 % g.x.d === 0;
  return {
    prompt: s.text,
    accepted: mitEinheit([geldwert ? geldAntwort(wert(g.x)) : x, x, `x = ${x}`], s.einheit),
    solution: [`x ist ${s.bedeutung}.`, ...(s.aufstellen ? [`Gleichung: ${s.aufstellen}`] : []), gleichungWeg(g), `Antwort: ${s.antwort(geldwert ? geld(wert(g.x)) : xAnzeige(g))}`].join("\n"),
    hints: [`Nenne das Gesuchte x: x ist ${s.bedeutung}.`, `Stell eine Gleichung auf: ${s.aufstellen ?? g.start}`, ersterSchritt(g)],
    errors: g.errors.map((e) => ({ answer: fehlerAntwort(g, e.x), label: e.label })),
  };
}

// ---------- powers ----------
/** 1000000 also as "1 000 000" and "1.000.000". */
function zahlVarianten(v: number): string[] {
  if (!Number.isSafeInteger(v) || v > 1e12) return [];
  const s = String(v);
  const gruppen = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return [...new Set([s, gruppen, gruppen.replace(/ /g, "."), gruppen.replace(/ /g, " ")])];
}
function potenzStory(o: { prompt: string; base: string; e: number; k?: number; zahl?: boolean; rechnung: string[]; regel: string; errors: Fehler[] }): Story {
  const k = o.k ?? 1;
  const zahlwert = o.zahl ? Number(o.base) ** o.e : NaN;
  return {
    prompt: o.prompt,
    accepted: [...potenzVarianten(o.base, o.e, k), ...(o.zahl ? zahlVarianten(zahlwert) : [])],
    mode: "text",
    solution: [...o.rechnung, `Antwort: ${potenz(o.base, o.e, k)}${o.zahl ? ` = ${zahlVarianten(zahlwert)[1] ?? zahlwert}` : ""}`].join("\n"),
    // a one-line way ends in the result, so the hint stops one step before it
    hints: [o.regel, "Hochzahlen schreibst du mit ^, zum Beispiel 2^5 für 2 hoch 5.", o.rechnung.length > 1 ? o.rechnung[0] : o.rechnung[0].split(" = ").slice(0, -1).join(" = ")],
    errors: o.errors.filter((e) => e.answer !== potenz(o.base, o.e, k)),
  };
}
const POTENZEN: Kontext[] = [
  {
    stufen: [0, 1],
    make: (rng) => {
      const m = rint(rng, 2, 3);
      const n = rint(rng, 1, 3);
      return potenzStory({
        prompt: `In einem Lager stehen 10^${m} Kisten. In jeder Kiste sind ${potenz("10", n)} Schrauben. Wie viele Schrauben sind es insgesamt? Schreib das Ergebnis als Zehnerpotenz.`,
        base: "10",
        e: m + n,
        zahl: true,
        rechnung: [`10^${m} · ${potenz("10", n)} = 10^(${m} + ${n}) = 10^${m + n}`],
        regel: "Gleiche Basis, malnehmen: Hochzahlen addieren.",
        errors: [
          { answer: `10^${m * n}`, label: "Hochzahlen multipliziert statt addiert" },
          { answer: `100^${m + n}`, label: "Basen multipliziert" },
        ],
      });
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng) => {
      const m = rint(rng, 5, 8);
      const n = rint(rng, 1, 3);
      return potenzStory({
        prompt: `Ein USB-Stick hat 2^${m} GB Speicher. Ein Film braucht ${potenz("2", n)} GB. Wie viele Filme haben auf dem Stick Platz? Schreib das Ergebnis als Potenz von 2.`,
        base: "2",
        e: m - n,
        zahl: true,
        rechnung: [`2^${m} : ${potenz("2", n)} = 2^(${m} − ${n}) = 2^${m - n}`],
        regel: "Gleiche Basis, dividieren: Hochzahlen subtrahieren.",
        errors: [
          { answer: `2^${m + n}`, label: "Hochzahlen addiert statt subtrahiert" },
          ...(m % n === 0 ? [{ answer: `2^${m / n}`, label: "Hochzahlen dividiert statt subtrahiert" }] : []),
        ],
      });
    },
  },
  {
    stufen: [0, 1, 2],
    make: (rng) => {
      const m = rint(rng, 2, 4);
      const n = rint(rng, 2, 6);
      return potenzStory({
        prompt: `Eine Bakterienart verdoppelt sich jede Stunde. Am Anfang sind es 2^${m} Bakterien. Wie viele sind es nach ${n} Stunden? Schreib das Ergebnis als Potenz von 2.`,
        base: "2",
        e: m + n,
        zahl: true,
        rechnung: [`2^${m} · 2^${n} = 2^(${m} + ${n}) = 2^${m + n}`],
        regel: "Jede Stunde kommt ein Faktor 2 dazu. Gleiche Basis, malnehmen: Hochzahlen addieren.",
        errors: [
          { answer: `2^${m * n}`, label: "Hochzahlen multipliziert statt addiert" },
          { answer: `2^${m + 1}`, label: "Nur eine Verdopplung gerechnet" },
        ],
      });
    },
  },
  {
    stufen: [2, 3],
    make: (rng) => {
      const b = pick(rng, ["a", "x", "b"]);
      const k = rint(rng, 2, 5);
      const m = rint(rng, 2, 4);
      return potenzStory({
        prompt: `Ein Quadrat hat die Seitenlänge ${potenz(b, m, k)}. Wie groß ist seine Fläche? Schreib das Ergebnis so einfach wie möglich.`,
        base: b,
        e: 2 * m,
        k: k * k,
        rechnung: [`Fläche = (${potenz(b, m, k)})^2`, `(${potenz(b, m, k)})^2 = ${k}^2 · ${b}^(${m} · 2) = ${potenz(b, 2 * m, k * k)}`],
        regel: "Die Fläche eines Quadrats ist Seite mal Seite, also die Seite hoch 2.",
        errors: [
          { answer: potenz(b, 2 * m, k), label: "Zahl in der Klammer nicht potenziert" },
          { answer: potenz(b, m + 2, k * k), label: "Hochzahlen addiert statt multipliziert" },
          { answer: potenz(b, m, 2 * k), label: "Mal 2 statt hoch 2 gerechnet" },
        ],
      });
    },
  },
  {
    stufen: [2, 3],
    make: (rng) => {
      const b = pick(rng, ["a", "x", "y"]);
      const [k1, k2] = [rint(rng, 2, 6), rint(rng, 2, 5)];
      const [m, n] = [rint(rng, 1, 4), rint(rng, 2, 5)];
      return potenzStory({
        prompt: `Ein Rechteck ist ${potenz(b, m, k1)} lang und ${potenz(b, n, k2)} breit. Wie groß ist seine Fläche? Schreib das Ergebnis so einfach wie möglich.`,
        base: b,
        e: m + n,
        k: k1 * k2,
        rechnung: [`Fläche = ${potenz(b, m, k1)} · ${potenz(b, n, k2)}`, `${k1} · ${k2} · ${b}^(${m} + ${n}) = ${potenz(b, m + n, k1 * k2)}`],
        regel: "Fläche = Länge mal Breite. Zahlen multiplizieren, Hochzahlen addieren.",
        errors: [
          { answer: potenz(b, m * n, k1 * k2), label: "Hochzahlen multipliziert statt addiert" },
          { answer: potenz(b, m + n, k1 + k2), label: "Zahlen addiert statt multipliziert" },
        ],
      });
    },
  },
  {
    stufen: [2, 3, 4],
    make: (rng, lv) => {
      const b = pick(rng, ["a", "x"]);
      const k = lv === 2 ? 1 : rint(rng, 2, 3);
      const m = rint(rng, 1, lv === 2 ? 4 : 3);
      return potenzStory({
        prompt: `Ein Würfel hat die Kantenlänge ${potenz(b, m, k)}. Wie groß ist sein Volumen? Schreib das Ergebnis so einfach wie möglich.`,
        base: b,
        e: 3 * m,
        k: k ** 3,
        rechnung: [`Volumen = (${potenz(b, m, k)})^3`, `(${potenz(b, m, k)})^3 = ${k === 1 ? "" : `${k}^3 · `}${b}^(${m} · 3) = ${potenz(b, 3 * m, k ** 3)}`],
        regel: "Das Volumen eines Würfels ist Kante hoch 3. Beim Potenzieren einer Potenz werden die Hochzahlen multipliziert.",
        errors: [
          { answer: potenz(b, m + 3, k ** 3), label: "Hochzahlen addiert statt multipliziert" },
          ...(k > 1 ? [{ answer: potenz(b, 3 * m, k), label: "Zahl in der Klammer nicht potenziert" }] : [{ answer: potenz(b, m, 3), label: "Mal 3 statt hoch 3 gerechnet" }]),
        ],
      });
    },
  },
  {
    stufen: [3, 4],
    make: (rng) => {
      const b = pick(rng, ["a", "x"]);
      const n = rint(rng, 1, 2);
      const m = n + rint(rng, 1, 3);
      return potenzStory({
        prompt: `Ein großer Würfel hat die Kantenlänge ${potenz(b, m)}, ein kleiner Würfel die Kantenlänge ${potenz(b, n)}. Wie viele kleine Würfel passen in den großen? Schreib das Ergebnis als Potenz.`,
        base: b,
        e: 3 * (m - n),
        rechnung: [`(${potenz(b, m)})^3 : (${potenz(b, n)})^3 = ${b}^${3 * m} : ${potenz(b, 3 * n)}`, `${b}^(${3 * m} − ${3 * n}) = ${potenz(b, 3 * (m - n))}`],
        regel: "Rechne zuerst beide Volumen aus (hoch 3), dann dividiere: Hochzahlen subtrahieren.",
        errors: [
          { answer: potenz(b, m - n), label: "Die Kanten statt der Volumen dividiert" },
          { answer: potenz(b, 3 * (m + n)), label: "Hochzahlen addiert statt subtrahiert" },
        ],
      });
    },
  },
  {
    stufen: [3, 4],
    make: (rng) => {
      const b = pick(rng, ["a", "x", "y"]);
      const [k, q] = [rint(rng, 2, 4), rint(rng, 2, 5)];
      const [e2, r] = [rint(rng, 1, 4), rint(rng, 2, 5)];
      return potenzStory({
        prompt: `Ein Rechteck hat die Fläche ${potenz(b, e2 + r, k * q)}. Eine Seite ist ${potenz(b, e2, k)} lang. Wie lang ist die andere Seite? Schreib das Ergebnis so einfach wie möglich.`,
        base: b,
        e: r,
        k: q,
        rechnung: [`Andere Seite = (${potenz(b, e2 + r, k * q)})/(${potenz(b, e2, k)})`, `(${k * q} : ${k}) · ${b}^(${e2 + r} − ${e2}) = ${potenz(b, r, q)}`],
        regel: "Länge = Fläche durch Breite. Zahlen dividieren, Hochzahlen subtrahieren.",
        errors: [
          { answer: potenz(b, e2 + r + e2, q), label: "Hochzahlen addiert statt subtrahiert" },
          { answer: potenz(b, r, k * q - k), label: "Zahlen subtrahiert statt dividiert" },
        ],
      });
    },
  },
  {
    stufen: [4],
    make: (rng) => {
      const b = pick(rng, ["a", "x"]);
      const k = rint(rng, 2, 3);
      const m = rint(rng, 2, 3);
      return potenzStory({
        prompt: `Ein Würfel hat die Kantenlänge ${potenz(b, m, k)}. Wie groß ist seine Oberfläche? Schreib das Ergebnis so einfach wie möglich.`,
        base: b,
        e: 2 * m,
        k: 6 * k * k,
        rechnung: [`Oberfläche = 6 · (${potenz(b, m, k)})^2`, `6 · ${potenz(b, 2 * m, k * k)} = ${potenz(b, 2 * m, 6 * k * k)}`],
        regel: "Ein Würfel hat 6 gleiche Quadrate als Flächen. Ein Quadrat ist Kante hoch 2.",
        errors: [
          { answer: potenz(b, 2 * m, k * k), label: "Nur ein Quadrat berechnet" },
          { answer: potenz(b, 2 * m, 6 * k), label: "Zahl in der Klammer nicht potenziert" },
          { answer: potenz(b, 3 * m, k ** 3), label: "Volumen statt Oberfläche berechnet" },
        ],
      });
    },
  },
];

// ---------- entry ----------
const STORIES: Record<string, (rng: Rng, lv: Stufe) => Story | null> = {
  "mathe.brueche.kuerzen": (rng, lv) => waehle(rng, lv, KUERZEN),
  "mathe.brueche.erweitern": (rng, lv) => erweiternStory(rng, lv) ?? erweiternStory(rng, lv),
  "mathe.brueche.addieren": (rng, lv) => bruchStory(rng, lv, "+", SUMMEN),
  "mathe.brueche.subtrahieren": (rng, lv) => bruchStory(rng, lv, "−", SUMMEN),
  "mathe.brueche.multiplizieren": (rng, lv) => bruchStory(rng, lv, "·", PRODUKTE),
  "mathe.brueche.dividieren": (rng, lv) => bruchStory(rng, lv, ":", QUOTIENTEN),
  "mathe.negativ.addieren": (rng, lv) => waehleOft(rng, lv, NEGATIV_ADDIEREN),
  "mathe.negativ.multiplizieren": (rng, lv) => waehleOft(rng, lv, NEGATIV_MULTIPLIZIEREN),
  "mathe.prozent.prozentwert": (rng, lv) => waehle(rng, lv, PROZENTWERT),
  "mathe.prozent.prozentsatz": (rng, lv) => waehle(rng, lv, PROZENTSATZ),
  "mathe.prozent.grundwert": (rng, lv) => waehle(rng, lv, GRUNDWERT),
  "mathe.gleichungen.einfach": (rng, lv) => gleichungStory(rng, lv, "einfach"),
  "mathe.gleichungen.klammern": (rng, lv) => gleichungStory(rng, lv, "klammern"),
  "mathe.gleichungen.text": (rng, lv) => gleichungStory(rng, lv, "text"),
  "mathe.potenzen.regeln": (rng, lv) => waehle(rng, lv, POTENZEN),
};
/** Contexts with random numbers that sometimes do not fit: try again a few times. */
function waehleOft(rng: Rng, lv: Stufe, kontexte: Kontext[]): Story | null {
  for (let i = 0; i < 50; i++) {
    const s = waehle(rng, lv, kontexte);
    if (s) return s;
  }
  return null;
}

/** Skills with built-in word problems (Teilfähigkeiten use their skill's). */
export const hasTextaufgabe = (skillId: string) => skillId.split(".").slice(0, 3).join(".") in STORIES;

/** A word problem for the skill as a short-answer task (category "textaufgabe"), or null when there is none. */
export function textaufgabeTask(skillId: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const base = skillId.split(".").slice(0, 3).join(".");
  const make = STORIES[base];
  if (!make) return null;
  const lv = STUFE[difficulty];
  for (let i = 0; i < 20; i++) {
    const s = make(rng, lv);
    if (s) return kurzaufgabe(base, difficulty, { ...s, category: "textaufgabe", time: lv <= 1 ? 150 : 240 });
  }
  return null;
}
