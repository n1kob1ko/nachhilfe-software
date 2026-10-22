import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** The full example of docs/lernpaket-format.md: the documentation must stay a valid file. */
function beispiel(): Record<string, unknown> & { schritte: Record<string, unknown>[] } {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  const block = md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/);
  assert.ok(block, "Beispiel in docs/lernpaket-format.md fehlt");
  return JSON.parse(block[1]);
}

async function setup() {
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const lp = await import("./lernpakete");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  return { lp, niko };
}

const meta = (o: Record<string, unknown> = {}) => ({
  title: "Brüche addieren",
  fach: "Mathematik",
  schulart: "Mittelschule",
  klasse: 1,
  thema: "Bruchrechnung",
  skill_ids: [] as string[],
  schwierigkeit: "mittel" as const,
  dauer_minuten: 50,
  ziel: "",
  ...o,
});

test("the example imports as an unchecked draft and round-trips through export", async () => {
  const { lp, niko } = await setup();
  const datei = beispiel();
  const r = lp.importiereLernpaket(JSON.stringify(datei), niko.id);
  assert.ok("id" in r, "id" in r ? "" : r.fehler.join("\n"));
  const p = lp.getLernpaket(r.id)!;
  assert.equal(p.status, "entwurf");
  assert.equal(p.quelle, "import");
  assert.ok(lp.ungeprueft(p), "imported and not checked yet");
  assert.equal(p.schritte.length, 7);
  assert.equal(p.minuten_summe, 50);
  assert.deepEqual(p.schritte.map((s) => s.position), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(p.schulstufe, 4, "VS 4 = Schulstufe 4");
  // a task without skill or difficulty gets the package's
  const t = p.schritte[4].aufgaben[0];
  assert.equal(t.skillId, "deutsch.grammatik.faelle");
  assert.equal(t.difficulty, "mittel");
  assert.equal(p.schritte[4].aufgaben[1].difficulty, "leicht");

  const aus = lp.exportiereLernpaket(r.id)!;
  assert.equal(aus.format, "lernheft-lernpaket");
  assert.equal(aus.version, 1);
  for (const k of ["titel", "fach", "schulart", "klasse", "thema", "faehigkeiten", "schwierigkeit", "dauer_minuten", "ziel"] as const) assert.deepEqual(aus[k], datei[k], k);
  for (const [i, s] of aus.schritte.entries()) {
    for (const k of ["art", "titel", "minuten", "lehrer_sagt", "folie", "lehrer_fragt", "erwartete_antwort", "bei_fehler", "notiz", "pruefen"] as const) assert.deepEqual(s[k], datei.schritte[i][k], `Schritt ${i + 1}: ${k}`);
    assert.equal(s.aufgaben.length, (datei.schritte[i].aufgaben as unknown[]).length);
  }
  // importing the export again gives the same file
  const r2 = lp.importiereLernpaket(JSON.stringify(aus), niko.id);
  assert.ok("id" in r2);
  assert.notEqual(r2.id, r.id, "a new package");
  assert.deepEqual(lp.exportiereLernpaket(r2.id), aus);
});

test("invalid files name the step, task and field in German", async () => {
  const { lp } = await setup();
  const fehler = (x: unknown) => {
    const r = lp.leseLernpaket(typeof x === "string" ? x : JSON.stringify(x));
    assert.equal(r.ok, false);
    return (r as { fehler: string[] }).fehler;
  };
  assert.match(fehler("{ kein json")[0], /kein gültiges JSON/);
  assert.match(fehler({ ...beispiel(), format: "lernheft-curriculum/1" })[0], /keine Lernpaket-Datei/);
  assert.match(fehler({ ...beispiel(), version: 2 })[0], /Version 2 kennt Lernheft nicht/);

  const d = beispiel();
  d.schritte[1].minuten = 0;
  assert.deepEqual(fehler(d), ["Schritt 2 („Vier Fälle, vier Fragen“), Feld „minuten“: muss mindestens 1 sein."]);

  const ohneTitel = beispiel();
  delete ohneTitel.schritte[2].titel;
  assert.deepEqual(fehler(ohneTitel), ["Schritt 3, Feld „titel“: fehlt."]);

  const art = beispiel();
  art.schritte[0].art = "pause";
  assert.match(fehler(art)[0], /^Schritt 1 \(„Detektivfragen“\), Feld „art“: muss eines davon sein: einstieg, erklaerung/);

  const tippfehler = beispiel();
  tippfehler.schritte[0].lehrer_sagtt = "…";
  assert.match(fehler(tippfehler)[0], /^Schritt 1 \(„Detektivfragen“\): unbekanntes Feld „lehrer_sagtt“/);

  const dauer = { ...beispiel(), dauer_minuten: 45 };
  assert.match(fehler(dauer)[0], /„dauer_minuten“: ist 45, die Schritte ergeben zusammen 50 Minuten/);

  assert.match(fehler({ ...beispiel(), klasse: 6 })[0], /Volksschule hat die Klassen 1 bis 4/);
  assert.match(fehler({ ...beispiel(), schulart: "Hauptschule" })[0], /„Hauptschule“ kennt Lernheft nicht/);
  assert.match(fehler({ ...beispiel(), faehigkeiten: ["deutsch.gibts.nicht"] })[0], /„deutsch\.gibts\.nicht“ gibt es in Lernheft nicht/);
  assert.match(fehler({ ...beispiel(), fach: "Mathematik" }).join("\n"), /gehört zu Deutsch, das Paket ist Mathematik/);
  assert.match(fehler({ ...beispiel(), schritte: [] })[0], /Feld „schritte“: braucht mindestens 1 Eintrag/);
});

test("tasks are checked with the builder's rules", async () => {
  const { lp } = await setup();
  const mitAufgabe = (a: Record<string, unknown>) => {
    const d = beispiel();
    d.schritte[3].aufgaben = [a];
    return lp.leseLernpaket(d);
  };
  const mc = { type: "mc", prompt: "Welcher Fall?", data: { options: ["1. Fall", "4. Fall"] }, answer: { correct: 1 } };
  assert.equal(mitAufgabe(mc).ok, true);

  const ohneLoesung = mitAufgabe({ ...mc, answer: {} });
  assert.deepEqual((ohneLoesung as { fehler: string[] }).fehler, ["Schritt 4 („Verständnisfrage“), Aufgabe 1: Bitte die richtige Antwort markieren."]);
  const luecken = mitAufgabe({ type: "cloze", prompt: "___ und ___", answer: { blanks: [["a"]] } });
  assert.match((luecken as { fehler: string[] }).fehler[0], /Aufgabe 1: Für jede der 2 Lücken braucht es eine Lösung/);
  const format = mitAufgabe({ ...mc, type: "quiz" });
  assert.match((format as { fehler: string[] }).fehler[0], /^Schritt 4 \(„Verständnisfrage“\), Aufgabe 1, Feld „type“: muss eines davon sein: mc, calc/);
  const optionen = mitAufgabe({ ...mc, data: { options: "a, b" } });
  assert.match((optionen as { fehler: string[] }).fehler[0], /Aufgabe 1, Feld „data\.options“: muss eine Liste/);
  const fremd = mitAufgabe({ ...mc, skillId: "mathe.bruch.kuerzen" });
  assert.match((fremd as { fehler: string[] }).fehler[0], /Aufgabe 1: Fähigkeit „mathe\.bruch\.kuerzen“ (gehört zu Mathematik|gibt es in Lernheft nicht)/);

  // an open point does not stop the import; it stays until a teacher checks the package
  const offen = mitAufgabe({ ...mc, data: { ...mc.data, pruefen: ["Ist „4. Fall“ eindeutig?"] } });
  assert.equal(offen.ok, true);
  assert.deepEqual((offen as { datei: { schritte: { aufgaben: { data: { pruefen?: string[] } }[] }[] } }).datei.schritte[3].aufgaben[0].data.pruefen, ["Ist „4. Fall“ eindeutig?"]);
});

test("marking geprüft needs the open points confirmed and clears them", async () => {
  const { lp, niko } = await setup();
  const d = beispiel();
  (d.schritte[3].aufgaben as { data: Record<string, unknown> }[])[0].data.pruefen = ["Optionen eindeutig?"];
  const r = lp.importiereLernpaket(d, niko.id);
  assert.ok("id" in r);
  const vorher = lp.getLernpaket(r.id)!;
  assert.equal(lp.offeneHinweise(vorher).length, 2, "one on step 3, one in a task");
  assert.match((lp.markiereGeprueft(r.id, niko.id) as { fehler: string }).fehler, /Noch 2 Hinweise zu prüfen/);
  assert.deepEqual(lp.markiereGeprueft(r.id, niko.id, { hinweiseGeprueft: true }), { ok: true });
  const p = lp.getLernpaket(r.id)!;
  assert.equal(p.status, "geprueft");
  assert.equal(p.geprueft_von, niko.id);
  assert.equal(p.geprueft_von_name, niko.name);
  assert.ok(!lp.ungeprueft(p));
  assert.deepEqual(lp.offeneHinweise(p), []);
  assert.equal(p.schritte[3].aufgaben[0].data.pruefen, undefined);
});

test("archiving keeps the package retrievable; restoring brings back its status", async () => {
  const { lp, niko } = await setup();
  const r = lp.importiereLernpaket(beispiel(), niko.id);
  assert.ok("id" in r);
  lp.markiereGeprueft(r.id, niko.id, { hinweiseGeprueft: true });
  assert.ok(lp.archiviereLernpaket(r.id));
  assert.ok(!lp.listLernpakete().some((p) => p.id === r.id), "not in the normal list");
  assert.ok(lp.listLernpakete({ status: "archiviert" }).some((p) => p.id === r.id), "in the archive");
  const p = lp.getLernpaket(r.id)!;
  assert.equal(p.status, "archiviert");
  assert.equal(p.schritte.length, 7, "every step is still there");
  assert.ok(lp.exportiereLernpaket(r.id), "and can be exported");
  assert.ok(!lp.ungeprueft(p), "the check is kept");
  assert.ok(lp.stelleWiederHer(r.id));
  assert.equal(lp.getLernpaket(r.id)!.status, "geprueft");

  const neu = lp.importiereLernpaket(beispiel(), niko.id);
  assert.ok("id" in neu);
  lp.archiviereLernpaket(neu.id);
  lp.stelleWiederHer(neu.id);
  assert.equal(lp.getLernpaket(neu.id)!.status, "entwurf", "never checked: back as Entwurf");
});

test("filters: skill (with sub-skills), Fach, Schulart and Klasse, Thema, status", async () => {
  const { lp, niko } = await setup();
  const faelle = lp.importiereLernpaket(beispiel(), niko.id);
  const praep = lp.createLernpaket(meta({ title: "Präpositionen mit Dativ", fach: "Deutsch", schulart: "Gymnasium", klasse: 2, thema: "Grammatik", skill_ids: ["deutsch.grammatik.praepositionen"] }), niko.id);
  const zeiten = lp.createLernpaket(meta({ title: "Perfekt", fach: "Deutsch", schulart: "Mittelschule", klasse: 1, thema: "Zeitformen", skill_ids: ["deutsch.grammatik.zeiten"] }), niko.id);
  assert.ok("id" in faelle && "id" in praep && "id" in zeiten);
  const ids = (f: Parameters<typeof lp.listLernpakete>[0]) => lp.listLernpakete(f).map((p) => p.id).sort((a, b) => a - b);

  // Präposition und Kasus is a sub-skill of Fälle bestimmen
  assert.deepEqual(ids({ skillId: "deutsch.grammatik.faelle" }).filter((id) => [faelle.id, praep.id, zeiten.id].includes(id)), [faelle.id, praep.id]);
  assert.deepEqual(ids({ skillId: "deutsch.grammatik.praepositionen" }), [praep.id]);
  assert.ok(ids({ fach: "Deutsch", schulart: "Volksschule", klasse: 4 }).includes(faelle.id));
  assert.ok(!ids({ fach: "Deutsch", schulart: "Volksschule", klasse: 3 }).includes(faelle.id));
  assert.deepEqual(ids({ thema: "Zeitformen" }), [zeiten.id]);
  assert.ok(ids({ status: "entwurf" }).includes(praep.id));
  assert.ok(!ids({ status: "geprueft" }).includes(praep.id));
  const facetten = lp.lernpaketFacetten();
  assert.ok(facetten.skills.includes("deutsch.grammatik.zeiten"));
  assert.ok(facetten.stufen.includes("Volksschule|4"));
});

test("the editor: steps are added, moved, edited and removed; minutes add up", async () => {
  const { lp, niko } = await setup();
  assert.deepEqual(lp.createLernpaket(meta({ title: " ", skill_ids: ["deutsch.grammatik.faelle"] }), niko.id), {
    fehler: ["Feld „title“: Bitte einen Titel eingeben, zum Beispiel „Die vier Fälle“.", "Feld „skill_ids“: Fähigkeit „deutsch.grammatik.faelle“ gehört zu Deutsch, das Paket ist Mathematik."],
  });
  const r = lp.createLernpaket(meta({ schulart: "MS" }), niko.id);
  assert.ok("id" in r);
  const p0 = lp.getLernpaket(r.id)!;
  assert.equal(p0.schulart, "Mittelschule", "short name accepted");
  assert.equal(p0.quelle, "hand");
  assert.ok(!lp.ungeprueft(p0), "own work needs no marker");

  const a = lp.addSchritt(r.id, { art: "einstieg", titel: "Pizza teilen", minuten: 5 });
  const c = lp.addSchritt(r.id, { art: "kontrolle", titel: "Kontrolle", minuten: 10 });
  assert.ok("id" in a && "id" in c);
  const b = lp.addSchritt(r.id, { art: "erklaerung", titel: "Gleichnamig machen", minuten: 20, folie: 2, lehrer_sagt: "Erst den gemeinsamen Nenner suchen." }, { nach: a.id });
  assert.ok("id" in b);
  assert.deepEqual(lp.listSchritte(r.id).map((s) => s.titel), ["Pizza teilen", "Gleichnamig machen", "Kontrolle"]);
  assert.equal(lp.getLernpaket(r.id)!.minuten_summe, 35);

  assert.deepEqual(lp.addSchritt(r.id, { art: "pause", titel: "", minuten: 0 }), {
    fehler: ["Art: muss eines davon sein: einstieg, erklaerung, beispiel, frage, gefuehrte_uebung, uebung, zusatz, kontrolle, abschluss.", "Titel: Bitte kurz benennen, was in diesem Schritt passiert.", "Minuten: eine ganze Zahl von 1 bis 240."],
  });

  assert.ok(lp.verschiebeSchritt(c.id, -1));
  assert.deepEqual(lp.listSchritte(r.id).map((s) => s.titel), ["Pizza teilen", "Kontrolle", "Gleichnamig machen"]);
  assert.ok(!lp.verschiebeSchritt(a.id, -1), "the first cannot move up");
  assert.deepEqual(lp.updateSchritt(b.id, { art: "beispiel", titel: "Beispiel 1/2 + 1/3", minuten: 15, pruefen: ["  ", "Nenner 6 richtig?"] }), { ok: true });
  const s = lp.getSchritt(b.id)!;
  assert.equal(s.art, "beispiel");
  assert.equal(s.folie, null);
  assert.deepEqual(s.pruefen, ["Nenner 6 richtig?"]);
  assert.ok(lp.entferneSchritt(a.id));
  assert.deepEqual(lp.listSchritte(r.id).map((x) => [x.position, x.titel]), [[0, "Kontrolle"], [1, "Beispiel 1/2 + 1/3"]]);
  assert.equal(lp.getLernpaket(r.id)!.minuten_summe, 25);
});

test("export file name", async () => {
  const { lp } = await setup();
  assert.equal(lp.exportDateiname({ title: "Die vier Fälle – Übersicht" }), "lernpaket-die-vier-faelle-uebersicht.json");
  assert.equal(lp.exportDateiname({ title: "!!!" }), "lernpaket-export.json");
});
