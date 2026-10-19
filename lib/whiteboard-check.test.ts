/**
 * KI prüfen am Whiteboard (niko, 19.10.2026: „Warum liest die KI das whiteboard nicht?“, dann „Bauen“). Der Lehrer
 * tippt „KI prüfen“, das Bild der Aufgabe geht mit Aufgabe und Lösung an die KI, ihr Vorschlag kommt zurück. Er
 * wird nirgends gespeichert; zählen tut nur, was der Lehrer bewertet.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Das
 * „Bild“ sind ein paar Bytes mit dem Anfang einer PNG-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { WhiteboardGeprueft } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("erfundener Rechenweg")]);
const BILD = `data:image/png;base64,${PNG.toString("base64")}`;
const GL = "mathe.gleichungen.einfach";
type Draft = import("./tasks").TaskDraft;
const draft = (o: Partial<Draft> & Pick<Draft, "type" | "prompt" | "answer">): Draft => ({ skillId: GL, skillIds: [GL], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });

async function setup() {
  const repo = await import("./repo");
  const units = await import("./units");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const wb = await import("./whiteboard");
  const { sync } = await import("./whiteboard-routes");
  const { studentAccess } = await import("./whiteboard-access");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Kreide Zeichner", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const wid = repo.createWorksheet({ title: "Potenzen", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "Potenzen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [GL] }, [
    draft({ type: "rechenweg", category: "rechenweg", prompt: "Vereinfache.", data: { start: "(x^4)^3 · x^2/x^9" }, answer: { accepted: ["x^5"], needWay: true }, solution: "x^12 · x^2/x^9 = x^14/x^9 = x^5" }),
    draft({ type: "calc", prompt: "Berechne 2^5.", answer: { accepted: ["32"] }, solution: "" }),
  ]);
  const tasks = repo.listTasks(wid);
  const { unit } = units.startUnit(niko.id, sid, { subject: "Mathematik" });
  const board = wb.ensureBoardForUnit(unit.id)!;
  const teacher = { role: "lehrer" as const, name: "Niko", canWrite: true, teacherId: niko.id };
  const access = studentAccess(student.access_token, String(unit.id));
  if (!("viewer" in access)) throw new Error("no student access");
  const call = async (viewer: typeof teacher | typeof access.viewer, body: Record<string, unknown>) => {
    const res = await sync(board, viewer, new Request("http://x/sync", { method: "POST", body: JSON.stringify({ clientId: "c1", ...body }) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { repo, student, tasks, teacher, studentViewer: access.viewer, call };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort` (null = die KI lehnt ab). */
async function mitKi(antwort: WhiteboardGeprueft | null) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort, refusal: antwort === null, model: req.model, usage: { input: 1_800, output: 300, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("without KI there is no button and the server says why; the manual mode cannot read pictures", async () => {
  const { boardCheckAvailable } = await import("./whiteboard-check");
  const { tasks, teacher, call } = await setup();
  assert.equal(boardCheckAvailable(), false);
  const r = await call(teacher, { op: "check", taskId: tasks[0].id, image: BILD });
  assert.equal(r.status, 400);
  assert.match(String(r.body.error), /nicht eingerichtet|keine Bilder/);

  process.env.AI_PROVIDER = "manual";
  try {
    assert.equal(boardCheckAvailable(), false, "copy and paste cannot carry a picture");
  } finally {
    delete process.env.AI_PROVIDER;
  }
});

test("the KI gets the picture, the task and its solution, no name; its suggestion comes back and nothing is stored", async () => {
  const { boardCheckAvailable } = await import("./whiteboard-check");
  const { repo, student, tasks, teacher, studentViewer, call } = await setup();
  const ki = await mitKi({ gelesen: "x^12 · x^2/x^9 | = x^14/x^9 | = x^6", ergebnis: "x^6", bewertung: "teilweise", grund: "Ansatz richtig, beim Kürzen 14 − 9 = 6 gerechnet statt 5." });
  try {
    assert.equal(boardCheckAvailable(), true);
    const r = await call(teacher, { op: "check", taskId: tasks[0].id, image: BILD });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.check, { bewertung: "teilweise", grund: "Ansatz richtig, beim Kürzen 14 − 9 = 6 gerechnet statt 5.", gelesen: "x^12 · x^2/x^9 | = x^14/x^9 | = x^6", ergebnis: "x^6" });

    assert.equal(ki.gefragt.length, 1);
    const [req] = ki.gefragt;
    assert.equal(req.fn, "whiteboard");
    const parts = req.content as { type: string; mime?: string; base64?: string; text?: string }[];
    assert.deepEqual([parts[0].type, parts[0].mime, parts[0].base64], ["image", "image/png", PNG.toString("base64")]);
    assert.match(parts[1].text!, /Vereinfache\.\n\(x\^4\)\^3 · x\^2\/x\^9/, "the task with the term the student starts from");
    assert.match(parts[1].text!, /Musterlösung:\nx\^12 · x\^2\/x\^9 = x\^14\/x\^9 = x\^5/);
    assert.match(req.system, /Lieber unklar als eine falsche Bewertung/);
    assert.ok(!JSON.stringify(req).includes("Kreide") && !JSON.stringify(req).includes("Zeichner"), "no name goes to the KI");

    // only a suggestion: no answer, no grade, no assignment
    assert.equal(repo.listAssignments(student.id).length, 0);
    assert.equal(repo.listAttemptsForStudent(student.id).length, 0);

    // the same picture again is not paid for twice
    await call(teacher, { op: "check", taskId: tasks[0].id, image: BILD });
    assert.equal(ki.gefragt.length, 1);

    // only the teacher may ask
    assert.equal((await call(studentViewer, { op: "check", taskId: tasks[0].id, image: BILD })).status, 403);
  } finally {
    ki.aus();
  }
});

test("a picture that is none, a task without solution or a refusal: a plain sentence, and no request where none is needed", async () => {
  const { boardPicture } = await import("./whiteboard-check");
  const { tasks, teacher, call } = await setup();
  const ki = await mitKi(null);
  try {
    const gif = `data:image/png;base64,${Buffer.from("GIF89a erfunden").toString("base64")}`;
    for (const image of [undefined, "", "hallo", gif, `data:image/svg+xml;base64,${PNG.toString("base64")}`, { mime: "image/png" }]) {
      const r = await call(teacher, { op: "check", taskId: tasks[0].id, image });
      assert.equal(r.status, 400, String(image));
      assert.match(String(r.body.error), /Bild vom Whiteboard/);
    }
    assert.equal(boardPicture(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64")}`)?.mime, "image/jpeg");

    let r = await call(teacher, { op: "check", taskId: tasks[1].id, image: BILD });
    assert.equal(r.status, 400);
    assert.match(String(r.body.error), /keine Lösung gespeichert/);
    r = await call(teacher, { op: "check", taskId: 99_999, image: BILD });
    assert.match(String(r.body.error), /gibt es nicht mehr/);
    assert.equal(ki.gefragt.length, 0, "nothing was asked so far");

    r = await call(teacher, { op: "check", taskId: tasks[0].id, image: BILD });
    assert.equal(r.status, 400);
    assert.match(String(r.body.error), /keine verwertbare Antwort/);
    assert.equal(ki.gefragt.length, 1);
  } finally {
    ki.aus();
  }
});

test("unklar comes through as it is, long texts are cut to one line", async () => {
  const { tasks, teacher, call } = await setup();
  const ki = await mitKi({ gelesen: "x^1?\n\n  x^5", ergebnis: null, bewertung: "unklar", grund: `Die letzte Zeile ist nicht lesbar. ${"sehr lang ".repeat(80)}` });
  try {
    const r = await call(teacher, { op: "check", taskId: tasks[0].id, image: BILD });
    const check = r.body.check as { bewertung: string; grund: string; gelesen: string; ergebnis: string | null };
    assert.equal(check.bewertung, "unklar");
    assert.equal(check.ergebnis, null);
    assert.equal(check.gelesen, "x^1? x^5");
    assert.ok(check.grund.length <= 400 && !check.grund.includes("\n"));
  } finally {
    ki.aus();
  }
});
