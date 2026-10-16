/**
 * KI-Hinweise je Schüler (Phase 6 des Merges, Schritt 3): der Text steht im Systemprompt jeder
 * schülerbezogenen Anfrage, **nie zusammen mit dem Namen** des Schülers, und ohne Hinweise bleibt der
 * Prompt unverändert. Dazu die neue Spalte `students.ki_hinweise`: gespeichert, gelesen, in der
 * Sicherung und im CSV-Export.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt nur mit, was gefragt
 * wurde (wie in lib/banken-ki.test.ts).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"])
  delete process.env[k];

const Answer = z.object({ ok: z.boolean() });

/** Ein Anbieter-Ersatz, der den Systemprompt jeder Anfrage mitschreibt. */
async function mitTransport<T>(run: (systeme: string[]) => Promise<T>): Promise<T> {
  const router = await import("./ai/router");
  const systeme: string[] = [];
  router.setTransport(async (p) => {
    systeme.push(p.system);
    return { parsed: { ok: true }, refusal: false, model: p.model, usage: { input: 10, output: 5, cacheWrite: 0, cacheRead: 0 } };
  });
  try {
    return await run(systeme);
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

/** Ein Schüler mit allen Pflichtfeldern; `ki_hinweise` nur, wenn der Test es braucht. */
async function schueler(name: string, ki_hinweise?: string) {
  const repo = await import("./repo");
  const id = repo.createStudent({
    name, grade: 6, klasse: 2, teacher_id: null, school: "", school_type: "Mittelschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    ...(ki_hinweise === undefined ? {} : { ki_hinweise }),
  });
  return { repo, id, student: repo.getStudent(id)! };
}

test("die KI-Hinweise stehen im Systemprompt einer schülerbezogenen Anfrage — ohne den Namen des Schülers", async () => {
  const { id } = await schueler("Lena Hofer", "Legasthenie: kurze Sätze, keine Großbuchstaben-Wörter als Fehler werten. Lena Hofer liest langsam.");
  await mitTransport(async (systeme) => {
    const { runAI } = await import("./ai/router");
    const out = await runAI("analyse", Answer, "Du unterstützt eine Nachhilfelehrkraft.", "Lerndaten", { meta: { studentId: id } });
    assert.ok(out.ok);
    assert.equal(systeme.length, 1, "genau eine Anfrage");
    assert.ok(systeme[0].startsWith("Du unterstützt eine Nachhilfelehrkraft."), "der bisherige Systemprompt bleibt am Anfang");
    assert.ok(systeme[0].includes("Legasthenie: kurze Sätze"), "die Hinweise stehen im Systemprompt");
    assert.ok(systeme[0].includes("keine Großbuchstaben-Wörter als Fehler werten"));
    assert.ok(!systeme[0].includes("Lena"), "der Vorname geht nicht mit");
    assert.ok(!systeme[0].includes("Hofer"), "der Nachname geht nicht mit");
    assert.ok(systeme[0].includes("[Name]"), "statt des Namens steht der Platzhalter");
  });
});

test("eine Anfrage zu einer Einheit bekommt die Hinweise des Schülers dieser Einheit", async () => {
  const { repo, id } = await schueler("Milan Kurz", "Rechenschwäche: Zahlenraum bis 20, Anschauungsmaterial verwenden");
  const { startUnit } = await import("./units");
  const teacher = repo.listTeachers()[0];
  const unit = startUnit(teacher.id, id).unit;
  await mitTransport(async (systeme) => {
    const { runAI } = await import("./ai/router");
    const out = await runAI("echtzeit", Answer, "sys", "kontext", { meta: { teacherId: teacher.id, unitId: unit.id } });
    assert.ok(out.ok);
    assert.ok(systeme[0].includes("Rechenschwäche: Zahlenraum bis 20"), "die Einheit führt zum Schüler und seinen Hinweisen");
  });
});

test("ohne KI-Hinweise bleibt der Systemprompt unverändert", async () => {
  const ohne = await schueler("Nora Ohne");
  const mit = await schueler("Tim Mit", "kurze Sätze");
  await mitTransport(async (systeme) => {
    const { runAI } = await import("./ai/router");
    await runAI("aufgaben", Answer, "SYS", "a", { meta: {} });
    await runAI("aufgaben", Answer, "SYS", "b", { meta: { studentId: ohne.id } });
    await runAI("aufgaben", Answer, "SYS", "c", { meta: { studentId: mit.id } });
    assert.equal(systeme[0], "SYS", "eine allgemeine Anfrage bleibt unverändert");
    assert.equal(systeme[1], "SYS", "ein Schüler ohne Hinweise ändert nichts");
    assert.notEqual(systeme[2], "SYS", "mit Hinweisen kommt der Zusatz dazu");
  });
});

test("students.ki_hinweise: gespeichert, gelesen, ohne Angabe unverändert, in Sicherung und CSV", async () => {
  const { repo, id } = await schueler("Lena Hofer", "Legasthenie: kurze Sätze");
  assert.equal(repo.getStudent(id)!.ki_hinweise, "Legasthenie: kurze Sätze");
  const eingabe = { name: "Lena Hofer", grade: 6, klasse: 2, teacher_id: null, school: "", school_type: "Mittelschule", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" };
  repo.updateStudent(id, { ...eingabe, ki_hinweise: "neue Hinweise" });
  assert.equal(repo.getStudent(id)!.ki_hinweise, "neue Hinweise");
  repo.updateStudent(id, eingabe);
  assert.equal(repo.getStudent(id)!.ki_hinweise, "neue Hinweise", "ohne Angabe bleibt der gespeicherte Text stehen");

  // Sicherung und Wiederherstellung in eine leere Datenbank
  const { exportBackup, restoreBackup } = await import("./backup");
  const { openDatabase } = await import("./db");
  const b = JSON.parse(JSON.stringify(exportBackup())) as { tables: Record<string, { rows: Record<string, unknown>[] }> };
  assert.equal(b.tables.students.rows.find((r) => r.id === id)!.ki_hinweise, "neue Hinweise", "die Sicherung nimmt die Hinweise mit");
  const andere = openDatabase(":memory:");
  restoreBackup(andere, b);
  const wieder = andere.prepare("SELECT ki_hinweise FROM students WHERE id = ?").get(id) as { ki_hinweise: string };
  assert.equal(wieder.ki_hinweise, "neue Hinweise", "und bringt sie unverändert zurück");

  // CSV-Export der Schüler
  const { datasetCsv } = await import("./exports");
  const csv = datasetCsv("schueler")!;
  const [kopf, ...zeilen] = csv.body.slice(1).split("\r\n");
  assert.ok(kopf.split(";").includes("KI-Hinweise"), "die Spalte steht im Kopf");
  assert.ok(zeilen.some((z) => z.includes("neue Hinweise")), "und der Text steht in der Zeile des Schülers");
});
