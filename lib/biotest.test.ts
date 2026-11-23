/**
 * Bio Test De La Salle (lib/biotest.ts, lib/biotest-inhalt.ts): die 16 Übungen sind vollständig und lösbar, der Satz
 * nach einem Fehler stimmt, Schreiben, Stand, und am Server wer es sieht und welche Stellen kommen. Namen erfunden.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BILDER, biotestKarten, biotestStand, merkeFuer, optionenFuer, pruefeGeschrieben, satzMit, UEBUNGEN, uebung, uebungenStand, vonKey } from "./biotest";

process.env.DATABASE_PATH = ":memory:";

test("16 Übungen, jede Stelle hat ihre Lösung unter den Optionen", () => {
  assert.equal(UEBUNGEN.length, 16);
  assert.equal(new Set(UEBUNGEN.map((u) => u.id)).size, 16);
  for (const u of UEBUNGEN) {
    assert.equal(new Set(u.stellen.map((s) => s.id)).size, u.stellen.length, u.id);
    for (const s of u.stellen) {
      if (s.muster) continue;
      const o = optionenFuer(u, s);
      assert.ok(o.includes(s.richtig), `${u.id}:${s.id} ${s.richtig} fehlt in ${o.join(", ")}`);
      assert.equal(new Set(o).size, o.length, `${u.id}:${s.id} doppelt`);
    }
    // Wortkasten wie bei der Lehrkraft: jedes Wort genau einmal gebraucht
    if ("bank" in u && u.bank && u.stellen.every((s) => !s.optionen)) {
      const loesungen = u.stellen.map((s) => s.richtig).sort();
      assert.deepEqual(loesungen, [...u.bank].sort(), u.id);
    }
    // Lückentext: jede Lücke genau einmal im Text, keine fremde
    if (u.art === "luecken") {
      const im = [...u.text.matchAll(/\[\[([a-z0-9]+)\]\]/g)].map((m) => m[1]);
      assert.deepEqual(im, u.stellen.map((s) => s.id), u.id);
    }
    if (u.art === "tabelle") {
      const im = u.zeilen.flatMap((z) => z.zellen.filter((c): c is { id: string } => typeof c !== "string").map((c) => c.id));
      assert.deepEqual(im.sort(), u.stellen.map((s) => s.id).sort());
    }
    if (u.art === "reihenfolge") assert.deepEqual(u.stellen.map((s) => Number(s.richtig)).sort(), [1, 2, 3, 4, 5, 6]);
  }
});

test("Bilder gibt es", () => {
  const pfade = [...Object.values(BILDER).map((b) => b.src), ...UEBUNGEN.flatMap((u) => (u.art === "bild" ? [u.bild.src] : []))];
  for (const p of pfade) assert.ok(existsSync(path.join(process.cwd(), "public", p)), p);
});

test("Satz nach einem Fehler: der Satz der Lehrkraft mit der Lösung", () => {
  const prim = uebung("primaten")!;
  assert.equal(prim.art, "luecken");
  if (prim.art !== "luecken") return;
  assert.equal(satzMit(prim, "p7"), "Bei Menschenaffen gibt es zwischen Eck- und Schneidezähnen einen Zwischenraum, die sogenannte „Affenlücke“.");
  assert.equal(satzMit(prim, "p9"), "Die Ansatzstelle der Wirbelsäule (= Hinterhauptsloch) liegt bei Menschen etwa in der Mitte der Schädelbasis, bei Affen weit hinten.");
  const vor = uebung("vorfahren")!;
  if (vor.art !== "luecken") return;
  // „ca.“ beendet keinen Satz
  assert.equal(satzMit(vor, "v1"), "Der bisher älteste Fund von Menschenresten ist ca. 7 Millionen Jahre alt.");
  const lage = uebung("lage")!;
  if (lage.art !== "luecken") return;
  assert.match(satzMit(lage, "l5"), /^Das zentrale Nervensystem dient .* wie z\. B\. Signalen von Sinnesorganen\.$/);
  for (const u of UEBUNGEN) for (const s of u.stellen) assert.ok(merkeFuer(u, s).length > 8, `${u.id}:${s.id}`);
});

test("Schreiben (Fachbegriffe 2)", () => {
  const u = uebung("fachbegriffe")!;
  const s = (id: string) => u.stellen.find((x) => x.id === id)!;
  assert.equal(pruefeGeschrieben("zellkern", s("k1")), "richtig");
  assert.equal(pruefeGeschrieben("Zelkern", s("k1")), "fast");
  assert.equal(pruefeGeschrieben("Axom", s("k4")), "falsch", "kurze Wörter genau");
  assert.equal(pruefeGeschrieben("Schnürringen", s("k7")), "richtig");
  assert.equal(pruefeGeschrieben("ringen", s("k7")), "richtig");
  assert.equal(pruefeGeschrieben("elektrischen", s("k3")), "richtig");
  assert.equal(pruefeGeschrieben("Dendrit", s("k2")), "falsch");
});

test("Karten und Stand", () => {
  const k = biotestKarten("reihenfolge");
  assert.equal(k.length, 6);
  assert.equal(vonKey(k[0].key), `reihenfolge:${k[0].biotest!.stelle}`);
  assert.equal(biotestKarten("lage", ["l3", "l9"]).length, 2);
  assert.equal(biotestKarten("gibtsnicht").length, 0);
  const tab = biotestKarten("vertreter");
  assert.ok(tab.find((x) => x.biotest?.stelle === "g1")!.faecher.every((f) => f.startsWith("bild:")));
  assert.ok(tab.find((x) => x.biotest?.stelle === "art1")!.faecher.every((f) => !f.startsWith("bild:")));
  const st = biotestStand([
    { antworten: [{ key: "biotest:lage:l1", richtig: true }, { key: "biotest:lage:l2", richtig: false }] },
    { antworten: [{ key: "biotest:lage:l1", richtig: true }, { key: "biotest:lage:l2", richtig: true }] },
    { antworten: [{ key: "biotest:lage:l3", richtig: false }] },
  ]);
  assert.equal(st.get("lage:l1")!.sicher, true);
  assert.equal(st.get("lage:l2")!.sicher, false);
  assert.equal(st.get("lage:l3")!.zuletztFalsch, true);
  const je = uebungenStand(new Set(["lage:l1"]), new Set(["lage:l3"]));
  assert.deepEqual(je.find((x) => x.id === "lage"), { id: "lage", sicher: 1, falsch: ["l3"], alle: 11 });
});

test("Server: nur De La Salle sieht es, Runde, Fehler kommen wieder", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string, school: string) =>
    repo.getStudent(
      repo.createStudent({ name, grade: 8, klasse: 4, teacher_id: teacher.id, school, school_type: "AHS", subjects: ["Biologie"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" }),
    )!;
  const heute = "2026-11-23";
  const andere = neu("Ida Test", "BRG Wien");
  assert.equal(sp.biotestWahl(andere, heute), null);
  const s = neu("Tom Test", "De La Salle Strebersdorf");
  assert.deepEqual(sp.biotestWahl(s, heute), {});
  repo.addTest({ student_id: s.id, date: "2026-11-27", subject: "Biologie", kind: "Test", topic: "Nervensystem", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.deepEqual(sp.biotestWahl(s, heute), { grund: "Test in 4 Tagen" });

  const a = sp.starteRunde(s, "biotest", { heute, biotest: { uebung: "lage" } });
  assert.equal(a.karten.length, 11);
  assert.ok(a.karten.every((k) => k.skill === undefined));
  sp.beendeRunde(s.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.biotest?.stelle === "l6" ? "periphere" : k.richtig })));
  let st = sp.biotestStand(s.id);
  assert.deepEqual(st.falsch, ["lage:l6"]);
  assert.equal(st.sicher.length, 0);
  const b = sp.starteRunde(s, "biotest", { heute, biotest: { uebung: "lage", nur: ["l6"] } });
  assert.equal(b.karten.length, 1);
  sp.beendeRunde(s.id, b.rundeId, b.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  st = sp.biotestStand(s.id);
  assert.deepEqual(st.falsch, []);
  assert.ok(!sp.spielVorschlaege(s, { heute }).some((v) => v.art === "biotest"), "keine Kachel bei den Fächern");
});
