/**
 * Ranking und Duelle (lib/spielprofil.ts, lib/liga.ts, lib/duelle.ts): Erlaubnis, Spitznamen, Ligapunkte für Einsatz und
 * Besserwerden, Gruppen und Aufstieg, Duell per Code und live. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const profil = await import("./spielprofil");
  const liga = await import("./liga");
  const duelle = await import("./duelle");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string, grade: number) => {
    const id = repo.createStudent({
      name, grade, klasse: grade > 8 ? grade - 8 : grade - 4, teacher_id: teacher.id, school: "", school_type: grade > 8 ? "AHS-Oberstufe" : "AHS", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
    return repo.getStudent(id)!;
  };
  /** Runde mit `richtig` von 12 richtig, beendet vor `sekunden` Sekunden Spielzeit (Zeiten in der DB nachgestellt). */
  const runde = (s: { id: number; grade: number }, art: "artikel" | "praepositionen", richtig: number, o: { sekunden?: number; beendet?: string } = {}) => {
    const st = repo.getStudent(s.id)!;
    const { rundeId, karten } = sp.starteRunde(st, art);
    sp.beendeRunde(s.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < richtig ? k.richtig : k.faecher.find((f) => f !== k.richtig)! })));
    if (o.beendet) db().prepare("UPDATE spielrunden SET beendet_at = ? WHERE id = ?").run(o.beendet, rundeId);
    db().prepare("UPDATE spielrunden SET created_at = datetime(beendet_at, ?) WHERE id = ?").run(`-${o.sekunden ?? 60} seconds`, rundeId);
    return rundeId;
  };
  const mitProfil = (s: { id: number; grade: number }, vorne: string, hinten: string, o: { liga?: boolean; duelle?: boolean } = {}) => {
    const r = profil.speichereProfil(s, { vorne, hinten, bild: "fuchs", liga: o.liga ?? true, duelle: o.duelle ?? true });
    assert.ok(r.ok, JSON.stringify(r));
  };
  return { db, repo, profil, liga, duelle, sp, teacher, neu, runde, mitProfil };
}

test("Erlaubnis: ab der 9. Schulstufe von selbst, jünger nur mit „Erlaubt“, „Aus“ sperrt; Spitzname nur aus den Listen", async () => {
  const { profil, neu, mitProfil } = await setup();
  const klein = neu("Lena Test", 7);
  const gross = neu("Jonas Test", 10);
  assert.equal(profil.erlaubnis(klein).darf, false);
  assert.match(profil.erlaubnis(klein).grund, /Eltern/);
  assert.equal(profil.erlaubnis(gross).darf, true);
  const r = profil.speichereProfil(klein, { vorne: "Blitz", hinten: "fuchs", bild: "fuchs", liga: true, duelle: true });
  assert.equal(r.ok, false);
  profil.setzeWettspiel(klein.id, "ja");
  mitProfil(klein, "Blitz", "fuchs");
  assert.equal(profil.profilVon(klein.id)!.name, "Blitzfuchs");
  // selber Name für jemand anderen: nein; freier Text: nein
  assert.equal(profil.speichereProfil(gross, { vorne: "Blitz", hinten: "fuchs", bild: "eule", liga: true, duelle: true }).ok, false);
  assert.equal(profil.speichereProfil(gross, { vorne: "Doof", hinten: "fuchs", bild: "eule", liga: true, duelle: true }).ok, false);
  assert.deepEqual(profil.namensTeile("Blitzfuchs"), { vorne: "Blitz", hinten: "fuchs" });
  // „Aus“ sperrt auch die Großen, das Profil zählt dann nicht
  mitProfil(gross, "Sturm", "eule");
  profil.setzeWettspiel(gross.id, "nein");
  assert.equal(profil.aktivesProfil(gross), null);
  assert.notEqual(profil.profilVon(gross.id), null);
});

test("Ligapunkte: 20 je Runde plus Besserwerden gegen sich selbst; zu schnell oder ohne Liga zählt nicht", async () => {
  const { liga, neu, runde, mitProfil, db } = await setup();
  const s = neu("Mia Test", 9);
  // ohne Profil: keine Punkte
  assert.equal(liga.vergibPunkte(s, runde(s, "artikel", 6)).punkte, 0);
  mitProfil(s, "Nacht", "eule");
  // die erste Runde eines Spiels (ältere ohne Profil zählen als Schnitt mit): 6/12 → Schnitt 50 %, jetzt 9/12 = 75 % → +25
  assert.deepEqual(liga.vergibPunkte(s, runde(s, "artikel", 9)), { punkte: 45, bonus: 25 });
  // schlechter als der Schnitt: nur die 20 für den Einsatz
  assert.equal(liga.vergibPunkte(s, runde(s, "artikel", 3)).punkte, 20);
  // erstes Präpositionen-Spiel: 10 extra
  assert.equal(liga.vergibPunkte(s, runde(s, "praepositionen", 5)).punkte, 30);
  // wild getippt (unter 3 richtig): zählt nicht
  assert.equal(liga.vergibPunkte(s, runde(s, "praepositionen", 2)).punkte, 0);
  // in 10 Sekunden durchgeklickt: zählt nicht
  const schnell = liga.vergibPunkte(s, runde(s, "artikel", 12, { sekunden: 10 }));
  assert.equal(schnell.punkte, 0);
  assert.match(schnell.grund!, /zu schnell/i);
  // zweimal vergeben geht nicht
  const id = runde(s, "artikel", 8);
  const a = liga.vergibPunkte(s, id).punkte;
  assert.equal(liga.vergibPunkte(s, id).punkte, a);
  assert.equal((db().prepare("SELECT SUM(punkte) AS p FROM spielrunden WHERE student_id = ?").get(s.id) as { p: number }).p, 45 + 20 + 30 + a);
});

test("Liga: höchstens 10 Runden am Tag, Gruppen bis 8, Aufstieg der ersten 3, kein Abstieg, Ausgeschaltete unsichtbar", async () => {
  const { liga, neu, runde, mitProfil, profil, db } = await setup();
  const s = neu("Tim Test", 10);
  mitProfil(s, "Turbo", "otter");
  for (let i = 0; i < 12; i++) liga.vergibPunkte(s, runde(s, "artikel", 6));
  const gezaehlt = (db().prepare("SELECT COUNT(*) AS n FROM spielrunden WHERE punkte > 0").get() as { n: number }).n;
  assert.equal(gezaehlt, 10);

  // neun weitere Spieler: die Gruppe 1 ist mit 8 voll, die übrigen kommen in Gruppe 2
  const andere = Array.from({ length: 9 }, (_, i) => neu(`Spieler${i} Test`, 10));
  andere.forEach((a, i) => mitProfil(a, profil.NAME_VORNE[i + 1], profil.NAME_HINTEN[i + 1]));
  const heute = "2026-11-11"; // Mittwoch
  const plaetze = andere.map((a) => liga.trittBei(a, heute));
  liga.trittBei(s, heute);
  const gruppen = new Map<number, number>();
  for (const p of [...plaetze, liga.trittBei(s, heute)]) gruppen.set(p.gruppe, (gruppen.get(p.gruppe) ?? 0) + 1);
  assert.ok([...gruppen.values()].every((n) => n <= 8));

  // Aufstieg: Punkte in der Woche vom 2. 11., Tim vorne in seiner Gruppe → nächste Woche Silber
  db().prepare("DELETE FROM spielliga").run();
  db().prepare("DELETE FROM spielrunden").run();
  const alt = "2026-11-03";
  liga.trittBei(s, alt);
  liga.trittBei(andere[0], alt);
  liga.trittBei(andere[1], alt);
  for (const [wer, n] of [[s, 3], [andere[0], 1]] as const) for (let i = 0; i < n; i++) db().prepare("INSERT INTO spielrunden (student_id, art, skill_id, anzahl, richtig, created_at, beendet_at, punkte) VALUES (?, 'artikel', 'x', 12, 6, '2026-11-04 10:00:00', '2026-11-04 10:01:00', 25)").run(wer.id);
  const t = liga.ligaTabelle(s, heute)!;
  assert.equal(t.stufenName, "Silber");
  assert.equal(liga.ligaTabelle(andere[0], heute)!.stufenName, "Silber");
  // andere[1] hatte 0 Punkte: bleibt Bronze (Aufstieg nur mit Punkten)
  assert.equal(liga.ligaTabelle(andere[1], heute)!.stufenName, "Bronze");
  assert.equal(t.tageRest, 5, "Mittwoch bis Sonntag");

  // wer Liga ausschaltet, steht bei den anderen nicht mehr
  profil.speichereProfil(andere[0], { vorne: profil.NAME_VORNE[1], hinten: profil.NAME_HINTEN[1], bild: "eule", liga: false, duelle: true });
  assert.equal(liga.ligaTabelle(s, heute)!.zeilen.length, 1);
  assert.equal(liga.ligaTabelle(andere[0], heute), null);
});

test("Duell per Code: annehmen, gleiche Karten, erste Wahl zählt sofort, Sieger, beide falsch, Revanche", async () => {
  const { duelle, neu, mitProfil } = await setup();
  const a = neu("Ada Test", 7);
  const b = neu("Ben Test", 10);
  const p = await import("./spielprofil");
  p.setzeWettspiel(a.id, "ja");
  mitProfil(a, "Blitz", "fuchs");
  // ohne Profil kein Duell
  assert.equal(duelle.nimmAn(b, "XXXX").ok, false);
  mitProfil(b, "Sturm", "krake");

  const neuD = duelle.erstelleDuell(a, "artikel");
  assert.ok(neuD.ok);
  if (!neuD.ok) return;
  assert.equal(duelle.nimmAn(a, neuD.code).ok, false, "eigener Code");
  const an = duelle.nimmAn(b, neuD.code.toLowerCase());
  assert.ok(an.ok);

  const ra = duelle.duellRunde(a, neuD.id);
  const rb = duelle.duellRunde(b, neuD.id);
  assert.ok(ra.ok && rb.ok);
  if (!ra.ok || !rb.ok) return;
  assert.deepEqual(
    ra.karten.map((k) => k.key),
    rb.karten.map((k) => k.key),
    "dieselben Karten",
  );
  const falsch = (k: { faecher: string[]; richtig: string }) => k.faecher.find((f) => f !== k.richtig)!;
  // A: 10 richtig; die erste Wahl bleibt, auch wenn später richtig nachgeschickt wird
  ra.karten.forEach((k, i) => duelle.duellZug(a.id, neuD.id, k.key, i < 10 ? k.richtig : falsch(k)));
  assert.deepEqual(duelle.duellZug(a.id, neuD.id, ra.karten[11].key, ra.karten[11].richtig), { richtig: false });
  duelle.beendeDuellRunde(a, neuD.id, ra.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  let sa = duelle.duellSicht(a.id, neuD.id)!;
  assert.equal(sa.status, "laeuft");
  assert.equal(sa.ich.richtig, 10);
  assert.equal(sa.binDran, false);
  // nochmal spielen geht nicht
  assert.equal(duelle.duellRunde(a, neuD.id).ok, false);

  // B: 8 richtig, falsch bei Karte 8, 9 und 11 → beide falsch: Karte 11
  rb.karten.forEach((k, i) => duelle.duellZug(b.id, neuD.id, k.key, i < 8 || i === 10 ? k.richtig : falsch(k)));
  duelle.beendeDuellRunde(b, neuD.id, []);
  sa = duelle.duellSicht(a.id, neuD.id)!;
  const sb = duelle.duellSicht(b.id, neuD.id)!;
  assert.equal(sa.status, "fertig");
  assert.equal(sa.ausgang, "gewonnen");
  assert.equal(sb.ausgang, "verloren");
  assert.equal(sb.gegner!.name, "Blitzfuchs", "nur der Spitzname");
  assert.deepEqual(sa.beideFalsch, [ra.karten[11].loesung]);

  const rev = duelle.revanche(b, neuD.id);
  assert.ok(rev.ok);
  if (rev.ok) {
    assert.equal(duelle.revanche(a, neuD.id).ok && (duelle.revanche(a, neuD.id) as { id: number }).id, rev.id, "nur eine Revanche");
    assert.equal(duelle.duellSicht(a.id, rev.id)!.binDran, true);
  }
  assert.equal(duelle.meineDuelle(a.id)[0].id, rev.ok ? rev.id : -1, "wo ich dran bin, steht oben");
});

test("Duell per Code: wer in 24 Stunden nicht spielt, verliert kampflos; Codes verfallen nach 48 Stunden", async () => {
  const { duelle, neu, mitProfil, db } = await setup();
  const a = neu("Ada Test", 10);
  const b = neu("Ben Test", 10);
  mitProfil(a, "Blitz", "fuchs");
  mitProfil(b, "Sturm", "krake");
  const d = duelle.erstelleDuell(a, "praepositionen");
  assert.ok(d.ok);
  if (!d.ok) return;
  duelle.nimmAn(b, d.code);
  const r = duelle.duellRunde(a, d.id);
  assert.ok(r.ok);
  if (r.ok) r.karten.slice(0, 5).forEach((k) => duelle.duellZug(a.id, d.id, k.key, k.richtig));
  // A hat angefangen, aber nicht beendet; die Zeit ist um
  db().prepare("UPDATE spielduelle SET ende_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), d.id);
  const s = duelle.duellSicht(a.id, d.id)!;
  assert.equal(s.status, "fertig");
  assert.equal(s.ich.richtig, 5);
  assert.equal(s.ich.fertig, true, "angefangene Runde wurde mit den gespeicherten Wahlen beendet");
  assert.equal(s.ausgang, "gewonnen", "B hat gar nicht gespielt");

  const alt = duelle.erstelleDuell(a, "artikel");
  assert.ok(alt.ok);
  if (!alt.ok) return;
  db().prepare("UPDATE spielduelle SET created_at = datetime('now', '-49 hours') WHERE id = ?").run(alt.id);
  assert.equal(duelle.nimmAn(b, alt.code).ok, false);
});

test("Live-Duell: Lehrer startet, beide bereit, Countdown, 2 Minuten, Lehrer sieht Vornamen", async () => {
  const { duelle, neu, teacher } = await setup();
  const a = neu("Ada Test", 6);
  const b = neu("Ben Test", 8);
  // live braucht kein Profil: der Lehrer entscheidet, die beiden sitzen nebeneinander
  const d = duelle.starteLiveDuell(teacher.id, a.id, b.id, "artikel");
  assert.ok(d.ok);
  if (!d.ok) return;
  assert.equal(duelle.wartendesLiveDuell(a.id), d.id);
  assert.equal(duelle.duellRunde(a, d.id).ok, false, "noch nicht begonnen");
  const jetzt = Date.now();
  duelle.bereit(a.id, d.id, jetzt);
  assert.equal(duelle.duellSicht(a.id, d.id)!.status, "offen");
  assert.deepEqual([duelle.duellSicht(a.id, d.id)!.ich.bereit, duelle.duellSicht(a.id, d.id)!.gegner!.bereit], [true, false]);
  duelle.bereit(b.id, d.id, jetzt);
  const s = duelle.duellSicht(a.id, d.id)!;
  assert.equal(s.status, "laeuft");
  assert.equal(s.startAt, jetzt + duelle.LIVE_COUNTDOWN * 1000);
  assert.equal(s.endeAt! - s.startAt!, duelle.LIVE_SEKUNDEN * 1000);

  const ra = duelle.duellRunde(a, d.id, s.startAt!);
  const rb = duelle.duellRunde(b, d.id, s.startAt!);
  assert.ok(ra.ok && rb.ok);
  if (!ra.ok || !rb.ok) return;
  // gleich viele richtig: live gewinnt, wer mehr geschafft hat
  ra.karten.slice(0, 6).forEach((k) => duelle.duellZug(a.id, d.id, k.key, k.richtig, s.startAt! + 1000));
  rb.karten.slice(0, 7).forEach((k, i) => duelle.duellZug(b.id, d.id, k.key, i < 6 ? k.richtig : k.faecher.find((f) => f !== k.richtig)!, s.startAt! + 1000));
  // nach Ablauf zählt nichts mehr
  assert.equal(duelle.duellZug(a.id, d.id, ra.karten[7].key, ra.karten[7].richtig, s.endeAt! + 10_000), null);
  const l = duelle.liveDuellFuerLehrer(teacher.id, b.id, a.id)!;
  assert.equal(l.ich.name, "Ada");
  assert.equal(l.gegner!.name, "Ben");
  assert.equal(l.gegner!.beantwortet, 7);
  duelle.beendeDuellRunde(a, d.id, []);
  duelle.beendeDuellRunde(b, d.id, []);
  assert.equal(duelle.duellSicht(b.id, d.id)!.ausgang, "gewonnen");
  assert.equal(duelle.wartendesLiveDuell(a.id), null);
});
