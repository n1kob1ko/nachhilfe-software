/**
 * Ein Blatt aus den eingebauten Generatoren stellt nie dieselbe Aufgabe zweimal (Test mit vier Test-Lehrern, 26.11.2026:
 * „Nomen“, 3. Klasse Volksschule, mittel: 7 Aufgaben, davon 2 verschiedene, viermal derselbe Satz; das Tablet meldete
 * „7 von 7 richtig“). Lieber ein kürzeres Blatt als ein aufgefülltes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CURRICULUM, DIFFICULTIES } from "./curriculum";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import type { TaskDraft } from "./tasks";
import { saetzeIn, wortartenFor } from "./wortarten";

/** Dieselbe Aufgabe: Art, Text, Daten und richtige Antwort; die Reihenfolge der Auswahl zählt nicht. */
function gleich(t: TaskDraft): string {
  const opts = Array.isArray(t.data.options) ? t.data.options.map(String) : null;
  const richtig = opts && typeof t.answer.correct === "number" ? opts[t.answer.correct] : null;
  return JSON.stringify([t.type, t.prompt, opts ? { ...t.data, options: [...opts].sort() } : t.data, richtig ?? t.answer]);
}

test("kein Blatt stellt dieselbe Aufgabe zweimal, in keinem Fach und auf keiner Stufe", () => {
  for (const skill of CURRICULUM.filter((s) => hasBuiltInGenerator(s.id))) {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of [1, 11]) {
        const tasks = generateBuiltIn({ subject: skill.subject, skills: [{ id: skill.id, name: skill.name }], difficulty, count: 8, taskType: "mixed", seed, grade: 6, wortarten: wortartenFor([skill.id], 6) });
        assert.ok(tasks.length > 0, `${skill.id} ${difficulty}: keine Aufgabe`);
        assert.equal(new Set(tasks.map(gleich)).size, tasks.length, `${skill.id} ${difficulty} (seed ${seed}): dieselbe Aufgabe steht zweimal auf dem Blatt`);
      }
    }
  }
});

test("Nomen in der 3. Klasse Volksschule: acht Aufgaben mit acht verschiedenen Sätzen, auch auf „mittel“ und „schwer“", () => {
  const id = "deutsch.wortarten.nomen";
  for (const difficulty of ["leicht", "mittel", "schwer"] as const) {
    for (const seed of [1, 5, 11]) {
      const tasks = generateBuiltIn({ subject: "Deutsch", skills: [{ id, name: "Nomen erkennen und großschreiben" }], difficulty, count: 8, taskType: "mixed", seed, grade: 3, wortarten: wortartenFor([id], 3) });
      assert.equal(tasks.length, 8, `${difficulty} (seed ${seed}): ${tasks.length} Aufgaben`);
      const saetze = tasks.map((t) => saetzeIn(t).join(" | "));
      assert.equal(new Set(saetze).size, 8, `${difficulty} (seed ${seed}): ein Satz kommt mehrmals vor: ${saetze.join(" / ")}`);
    }
  }
});
