/**
 * Notiz nach der Einheit (Plan 3.2): „Was war heute schwer?“ in der Schüler-App, eine je Schüler und Einheit,
 * änderbar bis zur nächsten Einheit, im Cockpit der nächsten Einheit zu lesen. Kein Lernstand, keine KI.
 * Alle Namen sind erfunden; kein Aufruf nach außen (der Transport wird ersetzt).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED", "AI_STUDENT_LIMIT_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD"])
  delete process.env[k];

const TAG = Date.parse("2026-10-20T14:00:00Z");
const H = 3_600_000;

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const n = await import("./schueler-notiz");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 4, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const einheit = (sid: number, at: number) => {
    const u = units.startUnit(teacher.id, sid, { at, subject: "Deutsch" }).unit;
    return u.id;
  };
  return { db, repo, units, n, teacher, schueler, einheit };
}

test("Auswahl: nur bekannte Antworten, jede einmal; „Nichts“ nur allein; Text gekürzt", async () => {
  const { bereinigeAuswahl, bereinigeText, NOTIZ_TEXT_MAX } = await import("./schueler-notiz");
  assert.deepEqual(bereinigeAuswahl(["schnell", "verstanden", "schnell", "<b>", 3]), ["verstanden", "schnell"]);
  assert.deepEqual(bereinigeAuswahl(["nichts"]), ["nichts"]);
  assert.deepEqual(bereinigeAuswahl(["nichts", "aufgaben"]), ["aufgaben"], "„Nichts“ next to something else is dropped");
  assert.equal(bereinigeText("  a\r\nb  "), "a\nb");
  assert.equal(bereinigeText("x".repeat(900)).length, NOTIZ_TEXT_MAX);
});

test("wann: heute, gestern, sonst der Tag (Wien)", async () => {
  const { wannLabel } = await import("./schueler-notiz");
  const jetzt = new Date("2026-10-21T20:00:00Z");
  assert.equal(wannLabel("2026-10-21T13:00:00Z", jetzt), "heute");
  assert.equal(wannLabel("2026-10-20T13:00:00Z", jetzt), "gestern");
  assert.equal(wannLabel("2026-10-19T13:00:00Z", jetzt), "am Montag, 19.10.");
  assert.equal(wannLabel("2026-10-20T22:30:00Z", jetzt), "heute", "half past midnight in Vienna is already the 21st");
});

test("eine Notiz je Einheit: erst nach dem Ende, änderbar bis zur nächsten Einheit, nur die eigene", async () => {
  const { db, units, n, schueler, einheit } = await setup();
  const lena = schueler("Lena Testhuber");
  const mio = schueler("Mio Probst");
  const zeilen = () => ["attempts", "skill_snapshots", "lessons", "ai_calls"].map((t) => (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);

  assert.equal(n.notizFuerSchueler(lena), null, "no unit yet: nothing to ask");
  const u1 = einheit(lena, TAG);
  assert.equal(n.notizFuerSchueler(lena), null, "not while the unit runs");
  assert.ok("fehler" in n.speichereNotiz(lena, u1, { auswahl: ["schnell"], text: "" }));
  units.finishUnit(u1, "beendet", { at: TAG + 1.5 * H });

  const vorher = zeilen();
  const offen = n.notizFuerSchueler(lena, new Date(TAG + 2 * H))!;
  assert.equal(offen.unitId, u1);
  assert.equal(offen.wann, "heute");
  assert.equal(offen.notiz, null, "nothing written yet: the question comes");

  // skip: the question does not come back, writing still works
  assert.ok("ok" in n.ueberspringeNotiz(lena, u1));
  assert.equal(n.notizFuerSchueler(lena)!.notiz!.uebersprungen, true);
  assert.equal(n.notizVorEinheit(u1), null);

  // another student's link cannot write to Lena's unit
  assert.ok("fehler" in n.speichereNotiz(mio, u1, { auswahl: ["aufgaben"], text: "von Mio" }));
  assert.equal(n.notizZuEinheit(u1)!.text, "");

  assert.ok("ok" in n.speichereNotiz(lena, u1, { auswahl: ["schnell", "nichts"], text: "  Das Kürzen bei den Brüchen  " }));
  assert.ok("ok" in n.ueberspringeNotiz(lena, u1), "skipping later keeps what is written");
  let notiz = n.notizZuEinheit(u1)!;
  assert.deepEqual(notiz.auswahl, ["schnell"]);
  assert.equal(notiz.text, "Das Kürzen bei den Brüchen");
  assert.equal(notiz.uebersprungen, false);
  assert.ok("ok" in n.speichereNotiz(lena, u1, { auswahl: ["verstanden"], text: "" }), "changed again");
  notiz = n.notizZuEinheit(u1)!;
  assert.deepEqual([notiz.auswahl, notiz.text], [["verstanden"], ""]);
  assert.deepEqual([...n.notizenFuerSchueler(lena).keys()], [u1]);
  assert.equal(n.notizenFuerSchueler(mio).size, 0, "Mio sees none of it");
  assert.deepEqual(zeilen(), vorher, "nothing in Lernstand or documentation, no KI call");

  // a unit started by mistake and cancelled does not close the note
  const versehen = einheit(lena, TAG + 20 * H);
  units.finishUnit(versehen, "abgebrochen", { byTeacherId: 1 });
  assert.equal(n.notizFuerSchueler(lena)!.unitId, u1);

  // the next unit starts: the note is closed and shows up in its cockpit
  const u2 = einheit(lena, TAG + 24 * H);
  assert.equal(n.notizFuerSchueler(lena), null);
  assert.ok("fehler" in n.speichereNotiz(lena, u1, { auswahl: ["aufgaben"], text: "zu spät" }));
  assert.deepEqual(n.notizZuEinheit(u1)!.auswahl, ["verstanden"], "unchanged");
  const davor = n.notizVorEinheit(u2)!;
  assert.equal(davor.notiz.unit_id, u1);
  assert.equal(davor.started_at, new Date(TAG).toISOString());

  // after u2 the question is about u2; u2 has no note, so u3's cockpit shows nothing (not u1's again)
  units.finishUnit(u2, "beendet", { at: TAG + 25 * H });
  assert.equal(n.notizFuerSchueler(lena)!.unitId, u2);
  assert.ok("ok" in n.speichereNotiz(lena, u2, { auswahl: [], text: "   " }), "an empty note counts as skipped");
  assert.equal(n.notizZuEinheit(u2)!.uebersprungen, true);
  const u3 = einheit(lena, TAG + 48 * H);
  assert.equal(n.notizVorEinheit(u3), null);
  assert.deepEqual([...n.notizenFuerSchueler(lena).keys()], [u1], "only notes with content");

  // deleting the unit takes its note along
  db().prepare("DELETE FROM units WHERE id = ?").run(u1);
  assert.equal(n.notizZuEinheit(u1), null);
});

/** The full example of docs/lernpaket-format.md, as in lib/anpassen.test.ts. */
function beispiel(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

test("„Für nächstes Mal“: jederzeit, bis zur nächsten Einheit änderbar; die Fähigkeit aus den Wörtern wird „Warum heute“", async () => {
  const { db, repo, units, n, teacher, schueler, einheit } = await setup();
  const lp = await import("./lernpakete");
  const { paketWahl } = await import("./cockpit-vorschlag");
  const sid = schueler("Lena Testhuber");
  const mio = schueler("Mio Probst");
  const imp = lp.importiereLernpaket(JSON.stringify({ ...beispiel(), titel: "Die vier Fälle (Notiz)" }), teacher.id);
  assert.ok("id" in imp);
  const zeilen = () => ["attempts", "skill_snapshots", "lessons", "ai_calls", "current_material"].map((t) => (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);
  const vorher = zeilen();
  const satz = "Wir haben heute die vier Fälle in der Schule begonnen. Ich verstehe den dritten und vierten Fall nicht.";
  const warum = (o: { ausser?: number } = {}) => paketWahl(sid, { ...o, now: new Date(TAG) }).vorschlaege.find((v) => v.paket.id === imp.id)?.warum ?? "";

  // before any unit
  assert.ok("ok" in n.speichereWunsch(sid, "Ich war müde", new Date(TAG - 48 * H)));
  assert.equal(n.schuelerWorte(sid, null)!.treffer.length, 0, "words that name no skill: nothing is matched");
  assert.ok(!warum().includes("schreibt"));
  assert.ok("ok" in n.speichereWunsch(sid, `  ${satz}  `, new Date(TAG - 47 * H)), "changed while still open");
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM schueler_wuensche").get() as { n: number }).n, 1, "one open note, changed in place");
  const w = n.schuelerWorte(sid, null)!;
  assert.equal(w.wunsch!.text, satz);
  assert.deepEqual(w.treffer.map((t) => t.skills.map((s) => s.id)), [["deutsch.grammatik.faelle"]], "„vier Fälle“ means Fälle bestimmen");
  assert.ok(warum().startsWith(`Lena schreibt: „${satz}“`), "the package for it says why, in her words");
  const { zitat } = await import("./cockpit-vorschlag");
  assert.equal(zitat(`${satz} ${satz}`), "Wir haben heute die vier Fälle in der Schule begonnen. Ich verstehe den dritten und vierten Fall nicht. Wir haben heute …", "long: cut after a whole word");
  assert.equal(n.schuelerWorte(mio, null), null, "Mio wrote nothing and sees nothing of Lena");
  const gym = repo.createStudent({
    name: "Ada Gymtest", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  assert.deepEqual(n.faehigkeitenAus(satz, repo.getStudent(gym)!).map((s) => s.id), ["deutsch.grammatik.faelle"], "„verstehe“ is not „Redewendungen verstehen“");

  // the unit starts: closed, it belongs to this unit and stays in its cockpit
  const u1 = einheit(sid, TAG);
  assert.equal(n.offenerWunsch(sid), null);
  assert.equal(n.wunschVorEinheit(u1)!.text, satz);
  assert.match(warum({ ausser: u1 }), /Lena schreibt/);
  // written during the unit: for the next one
  assert.ok("ok" in n.speichereWunsch(sid, "Bitte Beistriche", new Date(TAG + 0.5 * H)));
  assert.equal(n.wunschVorEinheit(u1)!.text, satz, "the unit's own stays");
  assert.equal(n.offenerWunsch(sid)!.text, "Bitte Beistriche");
  units.finishUnit(u1, "beendet", { at: TAG + H });
  assert.ok("ok" in n.speichereWunsch(sid, "", new Date(TAG + 2 * H)), "emptied: gone");
  assert.equal(n.offenerWunsch(sid), null);
  assert.equal(n.wunschVorEinheit(u1)!.text, satz);
  assert.ok("ok" in n.speichereNotiz(sid, u1, { auswahl: ["verstanden"], text: "der 4. Fall" }));
  const offen = n.schuelerWorte(sid, null)!;
  assert.equal(offen.wunsch, null);
  assert.equal(offen.schwer!.notiz.text, "der 4. Fall", "for the next unit: what was hard last time");

  const u2 = einheit(sid, TAG + 24 * H);
  assert.equal(n.schuelerWorte(sid, u2)!.schwer!.notiz.unit_id, u1);
  assert.equal(n.schuelerWorte(sid, u2)!.wunsch, null);
  assert.deepEqual([...n.wuenscheFuerSchueler(sid)].map(([u, x]) => [u, x.text]), [[u1, satz]]);
  assert.deepEqual(zeilen(), vorher, "nothing in Lernstand, Stoff or documentation, no KI call");
});

test("„Anpassen“ im Cockpit bekommt die Notiz nicht", async () => {
  const { units, n, teacher, schueler, einheit } = await setup();
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const a = await import("./anpassen");
  const router = await import("./ai/router");
  const sid = schueler("Ida Kernstock");
  const u1 = einheit(sid, TAG);
  units.finishUnit(u1, "beendet", { at: TAG + H });
  const geheim = "Brüche mit Pizzabildern verstehe ich nie";
  assert.ok("ok" in n.speichereNotiz(sid, u1, { auswahl: ["verstanden", "fragen"], text: geheim }));
  const wunsch = "Nächstes Mal bitte die Wem-Frage mit Lupenbildern";
  assert.ok("ok" in n.speichereWunsch(sid, wunsch, new Date(TAG + 2 * H)));
  const u2 = einheit(sid, TAG + 24 * H);
  assert.equal(n.wunschVorEinheit(u2)!.text, wunsch);
  const imp = lp.importiereLernpaket(JSON.stringify(beispiel()), teacher.id);
  assert.ok("id" in imp);
  assert.ok("ok" in c.waehlePaket(u2, imp.id));
  assert.ok(n.notizVorEinheit(u2), "the teacher sees it in the cockpit");

  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: { vorschlaege: [] }, refusal: false, model: req.model, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  });
  try {
    await a.erstelleAnpassungen(u2, teacher.id);
  } finally {
    router.setTransport(null);
  }
  assert.equal(gefragt.length, 1);
  const gesendet = `${gefragt[0].system}\n${JSON.stringify(gefragt[0].content)}`;
  for (const w of [geheim, "Pizzabildern", "nicht verstanden", "nicht zu fragen getraut", "Lupenbildern"]) assert.ok(!gesendet.includes(w), `„${w}“ geht nicht an die KI`);
});
