import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, CURRICULUM, DIFFICULTIES } from "./curriculum";
import { generateForSlot } from "./generators";
import { parseNumber, type TaskDraft } from "./tasks";

// Keine Mathe-Hilfe darf das Ergebnis verraten. Geprüft werden Gleichungen in den Hilfen: was rechts von
// einem „=“ steht, darf nicht die angenommene Antwort sein (als Text oder als Wert, „0,75“ zählt bei 75 % mit).
// Zahlen im Text („Teile 50 € durch 2“) sind erlaubt, sie sagen nur, womit gerechnet wird.
// Ausnahmen: keine.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kleinbuchstaben, ein Minus, Leerzeichen nur zwischen Ziffern (1 2/15 bleibt eine gemischte Zahl). */
const text = (s: string) =>
  s
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/(?<!\d) | (?!\d)/g, "")
    .replace(/[.!]+$/, "")
    .trim();

/** Der Wert einer rechten Seite: die Einheit am Ende fällt weg (50 €, 4 Stücke, 75 %). */
function wertVon(s: string): number | null {
  let ohne = s.trim().replace(/[.!]+$/, "");
  // Wort für Wort, ein Muster mit verschachteltem + bräuchte bei langen Hilfen ewig
  for (let alt = ""; alt !== ohne; ) {
    alt = ohne;
    ohne = ohne.replace(/\s*(?:€|%|°c?|[a-zäöüß²³]+\.?)$/i, "");
  }
  ohne = ohne.replace(/[−–]/g, "-").replace(/^-\s+/, "-");
  return ohne ? parseNumber(ohne) : null;
}

/** Die angenommenen Endergebnisse einer Aufgabe. */
function ergebnisse(t: TaskDraft): string[] {
  const a = t.answer;
  if (t.type === "mc" && a.correct != null && t.data.options) return [t.data.options[a.correct]];
  if (t.type === "cloze" && a.blanks?.length) return a.blanks[a.blanks.length - 1];
  return a.accepted ?? [];
}

/** Rechte Seiten aller Gleichungen eines Hinweises, jeweils bis zum nächsten Satzteil. */
function rechteSeiten(hint: string): string[] {
  return hint
    .split("=")
    .slice(1)
    .map((r) => r.split(/;|\(| und | oder |, /)[0].trim())
    .filter(Boolean);
}

/** Der Hinweis nennt das Ergebnis, wenn eine rechte Seite die Antwort ist. */
function verraeten(hint: string, antworten: string[]): string | null {
  const prozent = antworten.some((x) => x.includes("%"));
  for (const r of rechteSeiten(hint)) {
    const rt = text(r);
    const rw = wertVon(r);
    for (const x of antworten) {
      if (!x.trim()) continue;
      if (rt === text(x)) return r;
      const xw = wertVon(x);
      if (rw == null || xw == null) continue;
      if (Math.abs(rw - xw) < 1e-9 || (prozent && Math.abs(rw * 100 - xw) < 1e-6)) return r;
    }
  }
  return null;
}

test("Hinweis-Prüfung erkennt verratene Ergebnisse", () => {
  assert.equal(verraeten("−4 + 10 = 6", ["6"]), "6");
  assert.equal(verraeten("10 % ist ein Zehntel: 500 € : 10 = 50 €", ["50", "50 €"]), "50 €");
  assert.equal(verraeten("75 : 100 = 0,75", ["75 %"]), "0,75");
  assert.equal(verraeten("2^3 · 2^4 = 2^(3 + 4) = 2^7", ["2^7"]), "2^7");
  assert.equal(verraeten("5/10 + 4/10 = 9/10", ["9/10"]), "9/10");
  assert.equal(verraeten("1 + 2/15 = 1 2/15", ["1 2/15"]), "1 2/15");
  // nicht verraten: anderes Ergebnis, Zwischenschritt, Dezimalzahl mit Komma
  assert.equal(verraeten("2^3 · 2^4 = 2^(3 + 4)", ["2^7"]), null);
  assert.equal(verraeten("10 % = 500 € : 10 = 50 €", ["150 €"]), null);
  assert.equal(verraeten("1 % = 2,5 €", ["2"]), null);
  assert.equal(verraeten("Teile 50 € durch 2.", ["25 €"]), null);
});

test("Keine Mathe-Hilfe nennt das Ergebnis", () => {
  const skills = CURRICULUM.filter((s) => s.subject === "Mathematik");
  const kategorien = [null, ...CATEGORIES.Mathematik.map((c) => c.key)];
  const funde: string[] = [];
  for (const s of skills)
    for (const category of kategorien)
      for (const difficulty of DIFFICULTIES)
        for (let seed = 1; seed <= 4; seed++) {
          const t = generateForSlot({ skillId: s.id, skillName: s.name, generatorSkillId: s.parentId, difficulty, category, subject: "Mathematik" }, mulberry32(seed * 97 + 13));
          const antworten = ergebnisse(t);
          if (!antworten.length) continue;
          t.hints.forEach((h, i) => {
            const r = verraeten(h, antworten);
            if (r) funde.push(`${s.id} ${category} ${difficulty} Hilfe ${i + 1}: „${h}“ → ${antworten[0]}`);
          });
        }
  assert.deepEqual([...new Set(funde)].slice(0, 20), []);
});

// Deutsch und Englisch: Keine Hilfe darf eine angenommene Antwort als ganzes Wort oder als ganze Wortgruppe
// nennen. Groß- und Kleinschreibung und Satzzeichen zählen nicht, eine Antwort mit Klammer zählt auch ohne
// die Klammer („went (gegangen)“ auch als „went“). Die Hilfe soll zur Antwort führen: die Regel an einem
// anderen Wort zeigen oder alle Möglichkeiten mit ihrer Bedingung nennen.
// Ausnahmen:
// - Antworten mit einem Buchstaben und deutsche Artikel (der, den, ein …): Sie stehen in fast jeder Erklärung.
// - Eine Antwort, die als eigene Zeile in der Angabe steht (Vokabel orange → orange): Die Angabe nennt sie schon.
// - Nennt die Hilfe die Antwort mit „oder“ neben einer anderen Möglichkeit (wurde oder wurden), ist sie eine
//   Regel für beide.
// - Eine Hilfe, die auch bei einer Aufgabe ohne diese Antwort steht, ist eine allgemeine Regel und verrät
//   nichts („Steht eine Person danach, dann told, sonst said“).
// - Eine Antwort, die jede Aufgabe dieser Art hat (Nomen, wenn nach Nomen gefragt wird), ist kein Geheimnis.

/** Kleinbuchstaben, nur Buchstaben, Ziffern, Apostroph und |, mit Leerzeichen am Rand für ganze Wörter. */
const woerter = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[^\p{L}\p{N}'|]+/gu, " ")
    .trim()} `;

const ARTIKEL = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);

/** Alle angenommenen Antworten einer Aufgabe, als ganze Wörter. */
function antwortenVon(t: TaskDraft): Set<string> {
  const a = t.answer;
  const roh = t.type === "mc" && a.correct != null && t.data.options ? [t.data.options[a.correct]] : t.type === "cloze" && a.blanks?.length ? a.blanks.flat() : (a.accepted ?? []);
  const zeilen = new Set(t.prompt.split("\n").map(woerter));
  const alle = roh.flatMap((x) => [x, x.replace(/\s*\([^)]*\)/g, "")]).map(woerter);
  return new Set(alle.filter((x) => x.trim().length >= 2 && !ARTIKEL.has(x.trim()) && !zeilen.has(x)));
}

/** Die Antwort, die der Hinweis nennt, oder null. */
function nennt(hint: string, antworten: Iterable<string>): string | null {
  const h = woerter(hint);
  return [...antworten].find((x) => h.includes(x) && !h.includes(`${x}oder `) && !h.includes(` oder${x}`))?.trim() ?? null;
}

test("Hinweis-Prüfung erkennt genannte Antworten", () => {
  const a = (...x: string[]) => [...x].map(woerter);
  assert.equal(nennt("Mit Person: told me.", a("told")), "told");
  assert.equal(nennt("Nach have oder has steht die 3. Form: go, went, gone.", a("gone")), "gone");
  assert.equal(nennt("Superlativ: the biggest.", a("the biggest")), "the biggest");
  // nicht genannt: Teil eines anderen Worts, andere Wortgruppe
  assert.equal(nennt("Lange Adjektive: more und most.", a("most beautiful")), null);
  assert.equal(nennt("Wie bei goes oder watches.", a("go")), null);
  assert.equal(nennt("Passiv Präteritum: wurde oder wurden und das Partizip II.", a("wurde")), null);
});

test("Keine Hilfe in Deutsch und Englisch nennt die Antwort", () => {
  type Fall = { art: string; hint: string; antworten: Set<string>; text: string };
  const faelle: Fall[] = [];
  for (const subject of ["Deutsch", "Englisch"])
    for (const s of CURRICULUM.filter((x) => x.subject === subject))
      for (const [ci, category] of [null, ...CATEGORIES[subject].map((c) => c.key)].entries())
        for (const difficulty of DIFFICULTIES)
          for (let seed = 1; seed <= 4; seed++) {
            const t = generateForSlot({ skillId: s.id, skillName: s.name, generatorSkillId: s.parentId, difficulty, category, subject }, mulberry32(seed * 97 + 13 + ci * 7919));
            const antworten = antwortenVon(t);
            for (const hint of t.hints) faelle.push({ art: `${s.id} ${t.category} ${t.type}`, hint, antworten, text: `${difficulty}: ${t.prompt.split("\n").slice(-2).join(" / ")}` });
          }
  // Antworten, die jede Aufgabe mit diesem Hinweis hat; und die, die jede Aufgabe dieser Art hat
  const schnitt = (m: Map<string, Set<string>>, k: string, a: Set<string>) => {
    const alt = m.get(k);
    m.set(k, alt ? new Set([...alt].filter((x) => a.has(x))) : new Set(a));
  };
  const proHinweis = new Map<string, Set<string>>();
  const proArt = new Map<string, Set<string>>();
  const aufgaben = new Map<string, Set<string>>();
  for (const f of faelle) {
    schnitt(proHinweis, f.hint, f.antworten);
    schnitt(proArt, f.art, f.antworten);
    aufgaben.set(f.art, (aufgaben.get(f.art) ?? new Set()).add(f.text));
  }
  const funde = new Set<string>();
  for (const f of faelle) {
    const immer = aufgaben.get(f.art)!.size >= 5 ? proArt.get(f.art)! : new Set<string>();
    const x = nennt(f.hint, [...proHinweis.get(f.hint)!].filter((a) => !immer.has(a)));
    if (x) funde.add(`${f.art} (${f.text}): „${f.hint}“ → ${x}`);
  }
  assert.ok(faelle.length > 10000, `nur ${faelle.length} Hinweise geprüft`);
  assert.deepEqual([...funde].slice(0, 20), [], `${funde.size} Hilfen nennen die Antwort`);
});
