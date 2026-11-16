/**
 * Die Themen von Glasklar (lib/glasklar.ts): je Thema die Sorten (die Gläser) und die Begriffe dazu, ohne KI. Jeder
 * Begriff gehört zu genau einer Sorte, auch ohne Satz (darum keine Fälle mit „das Kind“, das Nominativ oder Akkusativ
 * sein kann, und keine Wortarten wie „morgen“). Welches Thema ein Schüler spielt, steht in lib/lernspiele.ts
 * (`glasPlan`); hier steht nur Reines.
 */
import type { Stufe } from "./banken-regeln";
import { IRREGULAR_SKILL } from "./lernspiele-englisch";
import { kandidaten, stufenFuer } from "./lernspiele-karten";
import type { SpielKarte, SpielThema } from "./lernspiele-typen";
import { kartenKey, type EigeneKarte } from "./spielkarten-text";
import { NOMEN_SKILL, PROBE, WORTARTEN_SKILL, WORTART_LABEL, type Wortart } from "./wortarten";

type Rng = () => number;

export type GlasFach = "Deutsch" | "Englisch" | "Mathematik" | "Dein Stoff";

/**
 * Ein Thema: `sorten` in fester Reihenfolge (die Deckel der Gläser); `skill` ist die Fähigkeit im Lernstand, `ab`/`bis`
 * die Schulstufen, in denen es zum Üben kommt (der Stoff kann es auch sonst bringen, `auch`: Fähigkeiten, die dazu führen).
 */
export type GlasThema = SpielThema & { id: string; fach: GlasFach; kurz: string };

/** Ein Begriff im Vorrat: die Karte und wie schwer sie ist; `gruppe`: höchstens zwei aus derselben Gruppe je Stufe. */
export type GlasKandidat = { karte: SpielKarte; stufe: Stufe; gruppe?: string };

export const GLAS_THEMEN: GlasThema[] = [
  { id: "artikel", name: "der, die, das", fach: "Deutsch", kurz: "Jedes Nomen in das Glas mit seinem Artikel", skill: "deutsch.grammatik.artikel", ab: 1, auch: ["deutsch.wortarten.nomen"] },
  { id: "wortarten", name: "Wortarten", fach: "Deutsch", kurz: "Nomen, Verben, Adjektive und mehr", skill: WORTARTEN_SKILL, ab: 2, auch: [NOMEN_SKILL] },
  { id: "faelle", name: "Die vier Fälle", fach: "Deutsch", kurz: "dem Hund, den Hund, des Hundes", skill: "deutsch.grammatik.faelle", ab: 5 },
  { id: "irregular", name: "Irregular Verbs", fach: "Englisch", kurz: "go, went, gone: welche Form ist es?", skill: IRREGULAR_SKILL, ab: 6, auch: ["englisch.tenses.pastsimple.irregular"] },
  { id: "plus10", name: "Gleiches Ergebnis bis 10", fach: "Mathematik", kurz: "3 + 4 und 9 − 2 kommen ins selbe Glas", skill: "mathe.vs.addsub.zr10", ab: 1, bis: 1 },
  { id: "plus20", name: "Gleiches Ergebnis bis 20", fach: "Mathematik", kurz: "8 + 5 und 20 − 7 kommen ins selbe Glas", skill: "mathe.vs.addsub.zehner", ab: 1, bis: 2 },
  { id: "einmaleins", name: "Einmaleins", fach: "Mathematik", kurz: "3 · 8 und 4 · 6 kommen ins selbe Glas", skill: "mathe.vs.muldiv.einmaleins", ab: 2, bis: 5 },
  { id: "laengen", name: "Gleich lang", fach: "Mathematik", kurz: "50 cm, 5 dm und 0,5 m sind gleich lang", skill: "mathe.masse.laengen", ab: 5, bis: 7 },
  { id: "brueche", name: "Gleich viel", fach: "Mathematik", kurz: "1/2, 0,5 und 50 % kommen ins selbe Glas", skill: "mathe.brueche.dezimal", ab: 6 },
];

export const glasThema = (id: string): GlasThema | undefined => GLAS_THEMEN.find((t) => t.id === id);
/** „Dein Stoff“: die Spielkarten der Lehrkraft, wenn sich ihre Antworten zu Gläsern sortieren lassen. */
export const STOFF_THEMA = "stoff";

const key = (thema: string, begriff: string) => `glas:${thema}:${begriff}`;
/** Das Thema einer Glasklar-Karte („glas:faelle:dem Hund“ → „faelle“). */
export const themaVonKey = (k: string) => /^glas:([a-z0-9]+):/.exec(k)?.[1] ?? null;

function karte(thema: string, begriff: string, sorte: string, o: { skill: string; loesung: string; regel: string; mathe?: true; marke?: string }): SpielKarte {
  return { key: key(thema, begriff), skill: o.skill, wort: begriff, vor: "", nach: "", faecher: [], richtig: sorte, loesung: o.loesung, regel: o.regel, mathe: o.mathe, marke: o.marke };
}

// ---------- der, die, das: aus der Artikel-Bank ----------

function artikelKandidaten(): GlasKandidat[] {
  const t = glasThema("artikel")!;
  return kandidaten("artikel")
    .filter((k) => k.karte.wort && !k.karte.bedeutung && k.karte.wort.length <= 13)
    .map((k) => ({ karte: karte("artikel", k.karte.wort!, k.karte.richtig, { skill: t.skill, loesung: k.karte.loesung, regel: k.karte.regel }), stufe: k.stufe }));
}

// ---------- Wortarten: Wörter, die auch ohne Satz eindeutig sind ----------

/**
 * Nur Wörter mit genau einer Wortart (kein „morgen“, kein „das“, kein „essen“ als Nomen-Verb). Verben stehen auch
 * gebeugt da, damit nicht die Endung „-en“ allein verrät, was ein Verb ist.
 */
export const WORTART_WOERTER: Partial<Record<Wortart, string[]>> = {
  nomen: ["Baum", "Schule", "Fahrrad", "Apfel", "Fenster", "Garten", "Lehrer", "Blume", "Wolke", "Hund", "Katze", "Tisch", "Brot", "Freundin", "Pferd", "Brücke", "Rucksack", "Insel", "Kerze", "Mantel", "Löffel", "Wiese", "Zeitung", "Freude"],
  verb: ["laufen", "schreibt", "singen", "lacht", "spielt", "bauen", "fährt", "malen", "schläft", "springen", "ruft", "trinkt", "liest", "schwimmt", "denken", "hilft", "kocht", "tanzen", "wirft", "erzählt", "kaufen", "suchst", "bringt", "fliegen"],
  adjektiv: ["groß", "klein", "laut", "bunt", "müde", "warm", "süß", "freundlich", "lustig", "dunkel", "kalt", "nass", "weich", "schwer", "frisch", "mutig", "traurig", "glücklich", "rund", "sauer", "neu", "alt", "hungrig", "stark"],
  pronomen: ["ich", "du", "er", "wir", "mich", "uns", "dich", "euch", "mir", "dir", "ihm", "mein", "dein", "unser", "sie", "es"],
  praeposition: ["auf", "unter", "neben", "hinter", "mit", "ohne", "für", "zwischen", "wegen", "durch", "gegen", "bei", "aus", "trotz"],
  adverb: ["heute", "gestern", "hier", "dort", "oft", "gern", "bald", "immer", "draußen", "manchmal", "deshalb", "nie", "oben", "unten", "sofort", "leider"],
  konjunktion: ["und", "oder", "aber", "weil", "dass", "obwohl", "wenn", "denn", "sondern", "ob", "bevor", "sobald"],
};

/** Welche Wortarten in der Schulstufe dran sind: Volksschule die drei großen, dann mehr (wie lib/wortarten.ts). */
export function wortartenFuer(schulstufe: number): Wortart[] {
  if (schulstufe <= 4) return ["nomen", "verb", "adjektiv"];
  if (schulstufe === 5) return ["nomen", "verb", "adjektiv", "pronomen", "praeposition"];
  return ["nomen", "verb", "adjektiv", "pronomen", "praeposition", "adverb", "konjunktion"];
}

function wortartKandidaten(schulstufe: number): GlasKandidat[] {
  const t = glasThema("wortarten")!;
  return wortartenFuer(schulstufe).flatMap((wa) =>
    (WORTART_WOERTER[wa] ?? []).map((w) => ({
      karte: karte("wortarten", w, WORTART_LABEL[wa], { skill: t.skill, loesung: `${w}: ${WORTART_LABEL[wa]}`, regel: PROBE[wa] }),
      stufe: 1 as Stufe,
    })),
  );
}

// ---------- Die vier Fälle: männliche Nomen in der Einzahl (der, des, dem, den sind dort eindeutig) ----------

/** Männliche Nomen ohne n-Deklination, mit dem Genitiv, wie er in der Schule steht. */
const FALL_NOMEN: [string, string][] = [
  ["Hund", "Hundes"],
  ["Vater", "Vaters"],
  ["Lehrer", "Lehrers"],
  ["Baum", "Baumes"],
  ["Freund", "Freundes"],
  ["Bruder", "Bruders"],
  ["Tisch", "Tisches"],
  ["Onkel", "Onkels"],
  ["Garten", "Gartens"],
  ["Schüler", "Schülers"],
  ["Zug", "Zuges"],
  ["Apfel", "Apfels"],
  ["Wagen", "Wagens"],
  ["Fisch", "Fisches"],
  ["Berg", "Berges"],
  ["Mantel", "Mantels"],
  ["Vogel", "Vogels"],
  ["Computer", "Computers"],
];
export const FALL_SORTEN = ["Nominativ", "Genitiv", "Dativ", "Akkusativ"];
const FALL_FRAGE: Record<string, string> = { Nominativ: "Wer?", Genitiv: "Wessen?", Dativ: "Wem?", Akkusativ: "Wen?" };
const FALL_NR: Record<string, number> = { Nominativ: 1, Genitiv: 2, Dativ: 3, Akkusativ: 4 };
const BEGLEITER: { nom: string; gen: string; dat: string; akk: string; stufe: Stufe }[] = [
  { nom: "der", gen: "des", dat: "dem", akk: "den", stufe: 1 },
  { nom: "ein", gen: "eines", dat: "einem", akk: "einen", stufe: 2 },
  { nom: "mein", gen: "meines", dat: "meinem", akk: "meinen", stufe: 2 },
];

function fallKandidaten(): GlasKandidat[] {
  const t = glasThema("faelle")!;
  return FALL_NOMEN.flatMap(([nomen, genitiv]) =>
    BEGLEITER.flatMap((b) => {
      const formen: [string, string][] = [
        ["Nominativ", `${b.nom} ${nomen}`],
        ["Genitiv", `${b.gen} ${genitiv}`],
        ["Dativ", `${b.dat} ${nomen}`],
        ["Akkusativ", `${b.akk} ${nomen}`],
      ];
      return formen.map(([fall, begriff]) => ({
        karte: karte("faelle", begriff, fall, {
          skill: t.skill,
          loesung: `${begriff}: ${fall}`,
          regel: `${FALL_FRAGE[fall]} ${begriff}: ${fall} (${FALL_NR[fall]}. Fall). Männlich: ${b.nom}, ${b.gen}, ${b.dat}, ${b.akk} ${nomen}.`,
          marke: FALL_FRAGE[fall],
        }),
        stufe: b.stufe,
        gruppe: nomen,
      }));
    }),
  );
}

// ---------- Irregular Verbs: nur Verben mit drei verschiedenen Formen ----------

/** Drei verschiedene Formen, und keine Form ist auch eine andere Form eines anderen Verbs in der Liste. */
export const UNREGELMAESSIG: [string, string, string][] = [
  ["go", "went", "gone"],
  ["see", "saw", "seen"],
  ["take", "took", "taken"],
  ["write", "wrote", "written"],
  ["eat", "ate", "eaten"],
  ["give", "gave", "given"],
  ["drive", "drove", "driven"],
  ["ride", "rode", "ridden"],
  ["speak", "spoke", "spoken"],
  ["break", "broke", "broken"],
  ["choose", "chose", "chosen"],
  ["forget", "forgot", "forgotten"],
  ["begin", "began", "begun"],
  ["drink", "drank", "drunk"],
  ["sing", "sang", "sung"],
  ["swim", "swam", "swum"],
  ["ring", "rang", "rung"],
  ["fly", "flew", "flown"],
  ["grow", "grew", "grown"],
  ["know", "knew", "known"],
  ["throw", "threw", "thrown"],
  ["draw", "drew", "drawn"],
  ["wear", "wore", "worn"],
  ["steal", "stole", "stolen"],
  ["do", "did", "done"],
  ["hide", "hid", "hidden"],
  ["bite", "bit", "bitten"],
  ["shake", "shook", "shaken"],
  ["wake", "woke", "woken"],
  ["freeze", "froze", "frozen"],
];
export const FORM_SORTEN = ["1. Form", "2. Form", "3. Form"];
const FORM_NAME = ["Infinitive", "Simple Past", "Past Participle"];

function irregularKandidaten(): GlasKandidat[] {
  const t = glasThema("irregular")!;
  return UNREGELMAESSIG.flatMap((formen) =>
    formen.map((f, i) => ({
      karte: karte("irregular", f, FORM_SORTEN[i], { skill: t.skill, loesung: `${f}: ${FORM_SORTEN[i]} (${formen.join(", ")})`, regel: `${formen.join(", ")}: „${f}“ ist die ${FORM_SORTEN[i]} (${FORM_NAME[i]}).`, marke: FORM_NAME[i] }),
      stufe: (i === 0 ? 1 : 2) as Stufe,
      gruppe: formen[0],
    })),
  );
}

// ---------- Mathe: gleiches Ergebnis, gleich lang, gleich viel ----------

const MINUS = "−";
const MAL = "·";

/** Plus und Minus mit Ergebnis `r`, alle Zahlen bis `bis`. */
function rechnungenFuer(r: number, bis: number): string[] {
  const out: string[] = [];
  for (let a = 1; a < r; a++) if (r - a >= 1) out.push(`${a} + ${r - a}`);
  for (let a = r + 1; a <= bis; a++) out.push(`${a} ${MINUS} ${a - r}`);
  return out;
}

function ergebnisKandidaten(thema: "plus10" | "plus20" | "einmaleins"): GlasKandidat[] {
  const t = glasThema(thema)!;
  const ergebnisse: { r: number; terme: string[] }[] =
    thema === "einmaleins"
      ? [6, 8, 10, 12, 16, 18, 20, 24, 30, 36, 40].map((r) => ({
          r,
          terme: Array.from({ length: 10 }, (_, i) => i + 1).flatMap((a) => (r % a === 0 && r / a <= 10 && r / a >= 1 ? [`${a} ${MAL} ${r / a}`] : [])),
        }))
      : thema === "plus10"
        ? [5, 6, 7, 8, 9].map((r) => ({ r, terme: rechnungenFuer(r, 10) }))
        : [11, 12, 13, 14, 15, 16, 17].map((r) => ({ r, terme: rechnungenFuer(r, 20).filter((x) => !/^1 \+|\+ 1$/.test(x)) }));
  return ergebnisse.flatMap(({ r, terme }) =>
    terme.map((term) => ({
      karte: karte(thema, term, `= ${r}`, { skill: t.skill, loesung: `${term} = ${r}`, regel: `${term} = ${r}` }),
      // die Tauschaufgabe (4 · 3 neben 3 · 4) gibt es, aber nicht zu oft
      stufe: (thema === "einmaleins" && /^1 ·|· 1$/.test(term) ? 2 : 1) as Stufe,
    })),
  );
}

/** „0,25“ mit Komma und Tausender-Leerzeichen; null, wenn es zu viele Stellen hätte. */
function zahlText(x: number): string | null {
  const gerundet = Math.round(x * 1000) / 1000;
  if (Math.abs(gerundet - x) > 1e-9 || gerundet >= 100_000) return null;
  const [ganz, komma] = String(gerundet).split(".");
  const ganzText = ganz.length > 4 ? ganz.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ganz;
  return komma ? `${ganzText},${komma}` : ganzText;
}

/** Längen in Millimetern; jede steht als mm, cm, dm und m da. */
const LAENGEN_MM = [10, 30, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000];
const EINHEITEN: [string, number][] = [
  ["mm", 1],
  ["cm", 10],
  ["dm", 100],
  ["m", 1000],
];

function laengenKandidaten(): GlasKandidat[] {
  const t = glasThema("laengen")!;
  return LAENGEN_MM.flatMap((mm) => {
    const formen = EINHEITEN.flatMap(([e, f]) => {
      const z = zahlText(mm / f);
      return z ? [`${z} ${e}`] : [];
    });
    // die Sorte heißt in Metern, wenn es ganze sind, sonst in Zentimetern („1,5 m“ heißt „150 cm“)
    const name = mm % 1000 === 0 ? `${mm / 1000} m` : `${mm / 10} cm`;
    return formen.map((f) => ({
      karte: karte("laengen", f, name, { skill: t.skill, loesung: `${f} = ${name}`, regel: "1 m = 10 dm = 100 cm = 1000 mm. Eine Einheit größer: das Komma eine Stelle nach links." }),
      stufe: (f.includes(",") ? 2 : 1) as Stufe,
    }));
  });
}

/** Je Wert: Brüche, die Dezimalzahl und Prozent. */
const GLEICH_VIEL: { wert: string; formen: string[]; regel: string }[] = [
  { wert: "0,5", formen: ["1/2", "2/4", "5/10", "0,5", "50 %"], regel: "1 : 2 = 0,5 und 0,5 = 50 %." },
  { wert: "0,25", formen: ["1/4", "2/8", "25/100", "0,25", "25 %"], regel: "1 : 4 = 0,25 und 0,25 = 25 %." },
  { wert: "0,75", formen: ["3/4", "6/8", "75/100", "0,75", "75 %"], regel: "3 : 4 = 0,75 und 0,75 = 75 %." },
  { wert: "0,2", formen: ["1/5", "2/10", "0,2", "20 %"], regel: "1 : 5 = 0,2 und 0,2 = 20 %." },
  { wert: "0,4", formen: ["2/5", "4/10", "0,4", "40 %"], regel: "2 : 5 = 0,4 und 0,4 = 40 %." },
  { wert: "0,6", formen: ["3/5", "6/10", "0,6", "60 %"], regel: "3 : 5 = 0,6 und 0,6 = 60 %." },
  { wert: "0,8", formen: ["4/5", "8/10", "0,8", "80 %"], regel: "4 : 5 = 0,8 und 0,8 = 80 %." },
  { wert: "0,1", formen: ["1/10", "10/100", "0,1", "10 %"], regel: "1 : 10 = 0,1 und 0,1 = 10 %." },
  { wert: "0,3", formen: ["3/10", "30/100", "0,3", "30 %"], regel: "3 : 10 = 0,3 und 0,3 = 30 %." },
  { wert: "0,05", formen: ["1/20", "5/100", "0,05", "5 %"], regel: "1 : 20 = 0,05 und 0,05 = 5 %." },
  { wert: "0,125", formen: ["1/8", "2/16", "0,125", "12,5 %"], regel: "1 : 8 = 0,125 und 0,125 = 12,5 %." },
  { wert: "0,01", formen: ["1/100", "10/1000", "0,01", "1 %"], regel: "1 : 100 = 0,01 und 0,01 = 1 %." },
];

function bruchKandidaten(): GlasKandidat[] {
  const t = glasThema("brueche")!;
  return GLEICH_VIEL.flatMap((g) =>
    g.formen.map((f) => ({
      karte: karte("brueche", f, g.wert, { skill: t.skill, loesung: `${f} = ${g.formen.filter((x) => x !== f).slice(0, 2).join(" = ")}`, regel: g.regel, mathe: true }),
      stufe: (/^\d+\/\d+$/.test(f) && f !== g.formen[0] ? 2 : 1) as Stufe,
    })),
  );
}

// ---------- Dein Stoff: Spielkarten, deren richtige Antworten Gläser ergeben ----------

/** So lang darf eine Frage höchstens sein, damit sie als Begriff in ein Glas passt. */
export const STOFF_BEGRIFF_MAX = 34;
/** So viele Karten braucht eine Antwort, damit sie ein Glas wird; so viele Gläser braucht ein Satz. */
const STOFF_JE_SORTE = 3;
const STOFF_SORTEN_MIN = 2;

/**
 * Die Spielkarten eines Satzes, die sich sortieren lassen: kurze Fragen ohne Lücke, gruppiert nach der richtigen
 * Antwort („Trilobit = Erdaltertum“, „Dinosaurier = Erdmittelalter“). Nur Antworten mit mindestens drei Karten werden
 * Gläser; gibt es keine zwei solchen Antworten, ist der Satz nichts für Glasklar (leere Liste).
 */
export function stoffKandidaten(karten: EigeneKarte[], skill: string): GlasKandidat[] {
  const wahl = karten.filter((k): k is Extract<EigeneKarte, { art: "wahl" }> => k.art === "wahl" && !k.frage.includes("___") && k.frage.trim().length <= STOFF_BEGRIFF_MAX);
  const nachSorte = new Map<string, typeof wahl>();
  for (const k of wahl) nachSorte.set(k.richtig.trim(), [...(nachSorte.get(k.richtig.trim()) ?? []), k]);
  // dieselbe Frage zweimal mit verschiedenen Antworten: unklar, dann nicht
  const fragen = new Map<string, Set<string>>();
  for (const k of wahl) fragen.set(k.frage.trim(), new Set([...(fragen.get(k.frage.trim()) ?? []), k.richtig.trim()]));
  const sorten = [...nachSorte.entries()].filter(([, ks]) => ks.length >= STOFF_JE_SORTE);
  if (sorten.length < STOFF_SORTEN_MIN) return [];
  return sorten.flatMap(([sorte, ks]) =>
    ks
      .filter((k) => fragen.get(k.frage.trim())!.size === 1)
      .map((k) => ({
        karte: { ...karte(STOFF_THEMA, k.frage.trim(), sorte, { skill, loesung: `${k.frage.trim()} → ${sorte}`, regel: k.merke || `${k.frage.trim()} → ${sorte}` }), key: `glas:${STOFF_THEMA}:${kartenKey(k)}` },
        stufe: 1 as Stufe,
      })),
  );
}

// ---------- Vorrat und Auswahl ----------

const cache = new Map<string, GlasKandidat[]>();

/** Alle Begriffe eines Themas (ohne „Dein Stoff“, das kommt aus der Datenbank). Wortarten hängen an der Schulstufe. */
export function glasKandidaten(thema: string, schulstufe: number): GlasKandidat[] {
  const id = thema === "wortarten" ? `wortarten:${wortartenFuer(schulstufe).length}` : thema;
  const c = cache.get(id);
  if (c) return c;
  const out =
    thema === "artikel"
      ? artikelKandidaten()
      : thema === "wortarten"
        ? wortartKandidaten(schulstufe)
        : thema === "faelle"
          ? fallKandidaten()
          : thema === "irregular"
            ? irregularKandidaten()
            : thema === "plus10" || thema === "plus20" || thema === "einmaleins"
              ? ergebnisKandidaten(thema)
              : thema === "laengen"
                ? laengenKandidaten()
                : thema === "brueche"
                  ? bruchKandidaten()
                  : [];
  cache.set(id, out);
  return out;
}

/** Die Sorten eines Vorrats in fester Reihenfolge (die des Themas, sonst nach der ersten Karte). */
export function sortenVon(thema: string, pool: GlasKandidat[]): string[] {
  const fest = thema === "faelle" ? FALL_SORTEN : thema === "irregular" ? FORM_SORTEN : thema === "artikel" ? ["der", "die", "das"] : null;
  const alle = [...new Set(pool.map((k) => k.karte.richtig))];
  return fest ? fest.filter((s) => alle.includes(s)) : alle;
}

/** Welche Stufen der Begriffe in eine Runde kommen: bei Artikeln wie im Spiel „der, die, das“, sonst alle bis zur Lernstand-Grenze. */
export function glasStufen(thema: string, schulstufe: number, lernstand: number | null): Stufe[] {
  if (thema === "artikel") return stufenFuer("artikel", schulstufe, lernstand);
  return lernstand !== null && lernstand < 0.5 ? [0, 1] : [0, 1, 2, 3];
}

function mischen<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Die Begriffe einer Stufe: `sorten` Sorten mit je `hoehe` Begriffen. Zuerst Sorten mit Begriffen, die zuletzt falsch
 * waren (`wiederholen`), dann zufällig. In jeder Sorte zuerst die falschen, dann solche, die in den letzten Runden nicht
 * dran waren (`zuletzt`, die neueste zuerst), dann die am längsten nicht gesehenen. Aus einer `gruppe` (dasselbe Nomen,
 * dasselbe Verb) höchstens zwei. Jede Karte bekommt die Sorten der Stufe als `faecher`, in der Reihenfolge des Themas.
 */
export function waehleGlasKarten(
  pool: GlasKandidat[],
  o: { reihenfolge: string[]; sorten: number; hoehe: number; stufen?: Stufe[]; wiederholen?: string[]; zuletzt?: string[]; rng?: Rng },
): SpielKarte[] {
  const rng = o.rng ?? Math.random;
  const mitStufe = o.stufen ? pool.filter((k) => o.stufen!.includes(k.stufe)) : pool;
  const nachSorte = (ks: GlasKandidat[]) => {
    const m = new Map<string, GlasKandidat[]>();
    for (const k of ks) m.set(k.karte.richtig, [...(m.get(k.karte.richtig) ?? []), k]);
    return m;
  };
  // reicht eine Sorte in den passenden Stufen nicht, kommen die anderen Stufen dazu
  const eng = nachSorte(mitStufe);
  const weit = nachSorte(pool);
  const vorrat = (s: string) => ((eng.get(s)?.length ?? 0) >= o.hoehe ? eng.get(s)! : (weit.get(s) ?? []));
  const moeglich = o.reihenfolge.filter((s) => vorrat(s).length >= o.hoehe);
  const falsch = new Set(o.wiederholen ?? []);
  const mitFehler = mischen(
    moeglich.filter((s) => vorrat(s).some((k) => falsch.has(k.karte.key))),
    rng,
  );
  const gewaehlt = [...mitFehler, ...mischen(moeglich.filter((s) => !mitFehler.includes(s)), rng)].slice(0, Math.min(o.sorten, moeglich.length));
  const reihe = o.reihenfolge.filter((s) => gewaehlt.includes(s));
  const alter = new Map((o.zuletzt ?? []).map((k, i) => [k, i]));
  const gruppen = new Map<string, number>();
  const out: SpielKarte[] = [];
  for (const sorte of reihe) {
    const ks = vorrat(sorte);
    const geordnet = [
      ...mischen(ks.filter((k) => falsch.has(k.karte.key)), rng),
      ...mischen(ks.filter((k) => !falsch.has(k.karte.key) && !alter.has(k.karte.key)), rng),
      ...mischen(ks.filter((k) => !falsch.has(k.karte.key) && alter.has(k.karte.key)), rng).sort((a, b) => alter.get(b.karte.key)! - alter.get(a.karte.key)!),
    ];
    const genommen: GlasKandidat[] = [];
    for (const zweiter of [false, true]) {
      for (const k of geordnet) {
        if (genommen.length >= o.hoehe) break;
        if (genommen.includes(k)) continue;
        const n = k.gruppe ? (gruppen.get(k.gruppe) ?? 0) : 0;
        // zuerst höchstens zwei je Gruppe; reicht das nicht, ohne Grenze
        if (!zweiter && k.gruppe && n >= 2) continue;
        genommen.push(k);
        if (k.gruppe) gruppen.set(k.gruppe, n + 1);
      }
    }
    out.push(...genommen.map((k) => ({ ...k.karte, faecher: reihe })));
  }
  return mischen(out, rng);
}
