/**
 * Phantombild (lib/phantombild.ts) und „Text lernen“ (lib/phantom-vorlage.ts): Fälle, Zeugenaussagen, Karten, die
 * Vorlage mit Lücken, und am Server Runden, Stufen, Punkte und die Vorlage der Lehrkraft. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fallKarten, gefragt, MERKMALE, MERKMAL_IDS, neuerFall, optionen, vorgezeichnet, zeugenaussage, zufall, type Fall } from "./phantombild";
import { anteilFuer, ausgefuellt, fuerPerson, liesVorlage, LUECKEN_MAX, STANDARD_VORLAGE, unbekannte, VORLAGE_STUFEN, vorlageRunde, wertFuer } from "./phantom-vorlage";

process.env.DATABASE_PATH = ":memory:";

const faelle = (n: number): Fall[] => Array.from({ length: n }, (_, i) => neuerFall(zufall(i + 1)));

test("Je Bereich höchstens fünf Wörter (niko: „pro Bereich 4–5“), ohne Augenbrauen", () => {
  for (const m of MERKMALE) if (m.id !== "person") assert.ok(m.werte.length <= 5, `${m.id}: ${m.werte.length} Wörter`);
  assert.ok(!(MERKMAL_IDS as readonly string[]).includes("brauen"));
});

test("Fälle: jeder Wert gehört zum Merkmal und passt zur Person", () => {
  for (const f of faelle(300)) {
    for (const m of MERKMALE) {
      const ok = m.werte.some((w) => w.id === f[m.id]) || (m.id === "haarfarbe" && f.frisur === "glatze" && f.haarfarbe === "keine");
      assert.ok(ok, `${m.id}=${f[m.id]}`);
    }
    if (f.person === "junge" || f.person === "maedchen" || f.person.includes("jugend")) assert.notEqual(f.frisur, "glatze");
    if (!(f.person === "mann" || f.person === "alter_mann")) assert.equal(f.bart, "kein");
    if (!f.person.startsWith("alt")) assert.notEqual(f.haarfarbe, "grau");
    assert.ok(f.alter >= 8 && f.alter <= 80);
  }
  // „nichts“ kommt vor, aber nicht immer
  const ohneBrille = faelle(300).filter((f) => f.brille === "keine").length;
  assert.ok(ohneBrille > 60 && ohneBrille < 240, String(ohneBrille));
});

test("Fehler kommen wieder: ein falscher Wert wird bevorzugt, wenn er zur Person passt", () => {
  let treffer = 0;
  for (let i = 0; i < 50; i++) if (neuerFall(zufall(i + 100), ["augen:gruen", "farbe:gelb"]).augen === "gruen") treffer++;
  assert.equal(treffer, 50);
});

test("Zeugenaussage: Präsens, jedes gefragte Merkmal steht in einem Satz, nur die Wörter der Antworten", () => {
  for (const f of faelle(200)) {
    const a = zeugenaussage(f, zufall(3));
    const text = a.saetze.map((s) => s.text).join(" ");
    assert.ok(!/undefined|\[|\]|\s{2,}/.test(text), text);
    assert.ok(text.includes(f.name));
    for (const m of gefragt(f, 5)) assert.ok(a.saetze.some((s) => s.merkmale.includes(m)), `${m} fehlt in: ${text}`);
    // Einleitung, Hauptteil, Schluss in dieser Reihenfolge
    const teile = a.saetze.map((s) => s.teil);
    assert.deepEqual(teile, [...teile].sort((x, y) => ["Einleitung", "Hauptteil", "Schluss"].indexOf(x) - ["Einleitung", "Hauptteil", "Schluss"].indexOf(y)));
    // keine alten Wörter mehr
    assert.ok(!/Stupsnase|buschig|Augenbrauen|Lächeln|gebaut|Pferdeschwanz|stachel/i.test(text), text);
  }
});

test("Karten: Reihenfolge des Aufbaus, die Antwort unter den Wahlen, keine doppelt, die erste trägt den Fall", () => {
  const reihe = MERKMALE.map((m) => m.id);
  for (const [i, f] of faelle(120).entries()) {
    const stufe = (i % 5) + 1;
    const k = fallKarten(f, stufe, zufall(i));
    assert.ok(k[0].phantom && k[0].phantom.fall === f && k[0].phantom.stufe === stufe);
    assert.ok(k.slice(1).every((x) => !x.phantom));
    const ms = k.map((x) => x.key.split(":")[1]);
    assert.deepEqual(ms, [...ms].sort((a, b) => reihe.indexOf(a as never) - reihe.indexOf(b as never)));
    assert.equal(new Set(k.map((x) => x.key)).size, k.length);
    for (const x of k) {
      assert.ok(x.faecher.includes(x.richtig), x.key);
      assert.equal(new Set(x.faecher).size, x.faecher.length, x.key);
      assert.ok(x.faecher.length >= 2 && x.faecher.length <= 4);
      assert.ok(x.vor.length > 5, `${x.key}: der Satz aus der Aussage`);
    }
    // was nicht gefragt wird, ist schon gezeichnet
    const schon = vorgezeichnet(f, stufe);
    for (const m of ms) assert.equal(schon[m as keyof typeof schon], undefined);
  }
  // Stufe 1 fragt wenig, Stufe 3 alles
  const f = faelle(1)[0];
  assert.ok(gefragt(f, 1).length < gefragt(f, 3).length);
  assert.deepEqual(gefragt(f, 3), gefragt(f, 9));
  // bei der Person die naheliegenden: ein Mädchen gegen Junge oder Jugendliche, nie gegen einen älteren Mann
  const m: Fall = { ...f, person: "maedchen" };
  for (let i = 0; i < 20; i++) assert.ok(!optionen("person", m, 3, zufall(i)).includes("alter_mann"));
});

test("Vorlage: liest Platzhalter und Pronomen, füllt sie für Mann und Frau, lässt Sätze ohne Merkmal weg", () => {
  const v = liesVorlage(STANDARD_VORLAGE);
  assert.equal(v.length, 3, "Einleitung, Hauptteil, Schluss");
  for (const f of faelle(100)) {
    const t = ausgefuellt(STANDARD_VORLAGE, f);
    assert.ok(!/\[|\]|undefined|null|\s{3,}/.test(t), t);
    assert.ok(t.includes(f.name));
    if (f.bart === "kein") assert.ok(!t.includes("Im Gesicht trägt"));
    else assert.ok(t.includes("Im Gesicht trägt"));
    const w = f.person === "maedchen" || f.person === "frau" || f.person === "jugendliche" || f.person === "alte_frau";
    assert.ok(w ? /\bSie ist\b/.test(t) && !/\bEr ist\b/.test(t) : /\bEr ist\b/.test(t) && !/\bSie ist\b/.test(t), t);
    if (wertFuer("Besonderes", f) === null) assert.ok(!t.includes("Als besondere Merkmale"));
  }
  assert.deepEqual(unbekannte("[Name] hat [Haarfarbe] und [Er] [Ohren]."), ["Haarfarbe", "Ohren"]);
  assert.deepEqual(unbekannte(STANDARD_VORLAGE), []);
});

test("Text lernen: Stufe 1 nur Merkmale, jede Stufe mehr Lücken und die alten bleiben, Stufe 5 alles, höchstens 90", () => {
  const f = faelle(1)[0];
  const lueckenVon = (stufe: number) => vorlageRunde(STANDARD_VORLAGE, f, stufe, zufall(5));
  const s1 = lueckenVon(1);
  assert.ok(s1.every((k) => !k.key.startsWith("vorlage:w")), "Stufe 1: nur Merkmale");
  assert.equal(s1.length, fuerPerson(liesVorlage(STANDARD_VORLAGE), f).flat(2).filter((s) => "platz" in s).length);
  let vorher = new Set<string>();
  for (let s = 2; s <= VORLAGE_STUFEN; s++) {
    const k = lueckenVon(s);
    const woerter = new Set(k.filter((x) => x.key.startsWith("vorlage:w")).map((x) => x.key.replace(/^vorlage:w\d+:/, "") + "@" + x.loesung));
    assert.ok(woerter.size > vorher.size, `Stufe ${s} hat mehr Lücken`);
    vorher = woerter;
    assert.ok(k.length <= LUECKEN_MAX);
    for (const x of k) {
      assert.ok(x.faecher.includes(x.richtig), x.key);
      assert.equal(new Set(x.faecher.map((w) => w.toLowerCase())).size, x.faecher.length, `${x.key}: keine Wahl doppelt`);
    }
    assert.equal(k[0].vorlage?.stufe, s);
  }
  assert.equal(anteilFuer(VORLAGE_STUFEN), 1);
  // der Text mit allen Lücken gefüllt ist genau die Musterlösung
  const k5 = lueckenVon(VORLAGE_STUFEN);
  const daten = k5[0].vorlage!;
  const voll = daten.absaetze.map((a) => a.map((st) => ("text" in st ? st.text : k5[st.luecke].richtig)).join("")).join("\n\n");
  assert.equal(voll, daten.loesung);
});

async function setup(o: { grade?: number; subjects?: string[] } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Pia Test", grade: o.grade ?? 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: o.subjects ?? ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)! };
}

test("Server: Phantombild für Deutsch in der Unterstufe, Fälle als Stufen, eigene Punkte, keine Kachel bei den Fächern", async () => {
  const { sp, db, repo, student } = await setup();
  const heute = "2026-11-19";
  assert.deepEqual(sp.phantomWahl(student, heute), {});
  const mathe = repo.getStudent(repo.createStudent({ ...student, name: "Nur Mathe", subjects: ["Mathematik"] }))!;
  assert.equal(sp.phantomWahl(mathe, heute), null);
  assert.ok(!sp.spielVorschlaege(student, { heute }).some((v) => v.art === "phantom" || v.art === "vorlage"));

  const a = sp.starteRunde(student, "phantom", { heute, endlos: "neu", rng: zufall(1) });
  assert.equal(a.stufe, 1);
  assert.ok(a.karten[0].phantom && a.karten.every((k) => k.skill === "deutsch.beschreiben.person"));
  const z = db().prepare("SELECT phantom, wort FROM spielrunden WHERE id = ?").get(a.rundeId) as { phantom: number | null; wort: number | null };
  assert.deepEqual(z, { phantom: 0, wort: null });
  const falsch = a.karten[1];
  const r = sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.key === falsch.key ? "nix" : k.richtig })));
  assert.equal(r?.richtig, a.karten.length - 1);
  const b = sp.starteRunde(student, "phantom", { heute, endlos: a.endlos, rng: zufall(2) });
  assert.equal(b.stufe, 2);
  assert.ok(b.karten.length > a.karten.length, "Stufe 2 fragt mehr");
  const [m, w] = falsch.key.split(":").slice(1);
  assert.equal(b.karten[0].phantom!.fall[m as "augen"], w, "der Fehler kommt im nächsten Fall wieder");

  sp.laufPunkte(student.id, a.rundeId, 1200, "phantom");
  assert.equal(sp.punkteRekord(student.id, "phantom"), 1200);
  assert.equal(sp.punkteBestenliste(student, "phantom").ich?.punkte, 1200);
  assert.ok(sp.laufIst(student.id, a.rundeId, "phantom") && !sp.laufIst(student.id, a.rundeId, "wort"));
});

test("Server: Text lernen merkt sich die geschaffte Stufe; die Lehrkraft ändert die Vorlage", async () => {
  const { sp, student } = await setup();
  const heute = "2026-11-19";
  assert.equal(sp.vorlageGeschafft(student.id), 0);
  // Stufe 3 ist noch gesperrt: es kommt Stufe 1
  const a = sp.starteRunde(student, "vorlage", { heute, endlos: "neu", vorlageStufe: 3, rng: zufall(1) });
  assert.equal(a.karten[0].vorlage?.stufe, 1);
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.equal(sp.vorlageGeschafft(student.id), 1);
  const b = sp.starteRunde(student, "vorlage", { heute, endlos: "neu", vorlageStufe: 2, rng: zufall(2) });
  assert.equal(b.karten[0].vorlage?.stufe, 2);
  // unter 80 %: nicht geschafft
  sp.beendeRunde(student.id, b.rundeId, b.karten.map((k, i) => ({ key: k.key, wahl: i % 2 ? "falsch" : k.richtig })));
  assert.equal(sp.vorlageGeschafft(student.id), 1);

  assert.equal(sp.phantomVorlage().eigene, false);
  assert.ok("fehler" in sp.speichereVorlage("[Name] hat [Ohren]."));
  assert.deepEqual(sp.speichereVorlage("Das ist [Name]. [Er] hat [Haare]."), { ok: true });
  assert.deepEqual(sp.phantomVorlage(), { text: "Das ist [Name]. [Er] hat [Haare].", eigene: true });
  const c = sp.starteRunde(student, "vorlage", { heute, endlos: "neu", vorlageStufe: 1, rng: zufall(3) });
  assert.deepEqual(c.karten.map((k) => k.key), ["vorlage:Name", "vorlage:Haare"]);
  sp.speichereVorlage("");
  assert.equal(sp.phantomVorlage().eigene, false);
});
