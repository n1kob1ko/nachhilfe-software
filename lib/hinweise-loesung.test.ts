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
