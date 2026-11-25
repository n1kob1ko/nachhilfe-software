/**
 * Die zwei Volksschul-Spiele (niko 2026-11-25): „Wortarten“ (lib/wortarten-spiel.ts) und „ich gehe, du gehst“
 * (lib/verben-beugen.ts). Jeder Satz liest sich, jede Karte hat genau eine richtige Kachel, die Formen stimmen mit
 * den Regeln überein, und eine Runde zählt für die richtige Fähigkeit. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-25";

async function setup(o: { grade?: number } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const grade = o.grade ?? 3;
  const id = repo.createStudent({
    name: "Lea Test", grade, klasse: grade, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Wortarten: jeder Satz liest sich, die Markierung steht im Satz, genug Karten je Wortart und Stufe", async () => {
  const w = await import("./wortarten-spiel");
  const fehler: string[] = [];
  const saetze = new Set<string>();
  for (const src of w.WORTART_SAETZE) {
    const { text, teile } = w.leseWortartSatz(src);
    if (saetze.has(text)) fehler.push(`doppelt: ${text}`);
    saetze.add(text);
    if (!teile.length) fehler.push(`nichts zu fragen: ${text}`);
    if (!/^[A-ZÄÖÜ]/.test(text) || !/[.!?]$/.test(text)) fehler.push(`Satzanfang oder -ende: ${text}`);
    for (const t of teile) {
      if (`${t.vor}${t.wort}${t.nach}` !== text) fehler.push(`Stelle von „${t.wort}“ in ${text}`);
      // Nomen groß, Verben und Adjektive klein (außer am Satzanfang)
      if (t.wa === "Nomen" && !/^[A-ZÄÖÜ]/.test(t.wort)) fehler.push(`Nomen klein: ${t.wort}`);
      if (t.wa !== "Nomen" && t.vor && /^[A-ZÄÖÜ]/.test(t.wort)) fehler.push(`${t.wa} groß: ${t.wort}`);
      if (t.wa === "Verb" && !/(e?n|ern|eln|sein|tun)$/.test(t.grundform)) fehler.push(`Grundform fehlt: ${t.wort} (${text})`);
    }
  }
  const karten = w.wortartKandidaten();
  for (const wa of w.WORTART_FAECHER) {
    const n = karten.filter((k) => k.karte.richtig === wa);
    if (n.length < 50) fehler.push(`${wa}: nur ${n.length} Karten`);
    if (!n.some((k) => k.stufe === 0) && wa !== "Adjektiv") fehler.push(`${wa}: keine leichten`);
  }
  for (const s of [0, 1, 2, 3]) if (karten.filter((k) => k.stufe === s).length < 15) fehler.push(`Stufe ${s}: zu wenige`);
  const keys = new Set(karten.map((k) => k.karte.key));
  if (keys.size !== karten.length) fehler.push("doppelte Keys");
  for (const { karte } of karten) {
    if (!karte.faecher.includes(karte.richtig) || karte.faecher.length !== 3) fehler.push(`${karte.loesung}: Kacheln`);
    if (!karte.regel.includes(`„${karte.mitte}“`)) fehler.push(`${karte.loesung}: Regel ohne das Wort`);
  }
  assert.deepEqual(fehler, []);
  assert.ok(w.WORTART_SAETZE.length >= 120, `${w.WORTART_SAETZE.length} Sätze`);
});

test("Wortarten: Regeln für Namen, Verben als Nomen und Adjektive beim Verb", async () => {
  const w = await import("./wortarten-spiel");
  const karte = (wort: string) => w.wortartKandidaten().find((k) => k.karte.mitte === wort)!.karte;
  assert.equal(karte("Lisa").richtig, "Nomen");
  assert.match(karte("Lisa").regel, /Name/);
  assert.equal(karte("Lachen").richtig, "Nomen");
  assert.match(karte("Lachen").regel, /Verb zum Nomen/);
  assert.equal(karte("langsam").richtig, "Adjektiv");
  assert.match(karte("langsam").regel, /wie etwas geschieht/);
  assert.match(karte("bellt").regel, /Grundform: bellen/);
  const k = karte("kleine");
  assert.equal(k.vor, "Der ");
  assert.equal(k.nach, " Hund bellt.");
  assert.match(k.regel, /: klein\./);
});

test("Verben beugen: sechs Formen je Verb, regelmäßige Endungen stimmen, falsche Formen sind nie richtig", async () => {
  const v = await import("./verben-beugen");
  const fehler: string[] = [];
  for (const verb of v.VERBEN) {
    const f = v.formenVon(verb);
    if (verb.art === "regel") {
      const stamm = verb.grundform.replace(/e?n$/, "");
      const soll = { ich: `${stamm}e`, du: `${stamm}st`, er: `${stamm}t`, wir: verb.grundform, ihr: `${stamm}t`, sie: verb.grundform };
      for (const p of v.PERSONEN) if (f[p] !== soll[p]) fehler.push(`${verb.grundform} ${p}: ${f[p]} statt ${soll[p]}`);
    }
    if (verb.art !== "eigen" && (f.wir !== verb.grundform || f.sie !== verb.grundform)) fehler.push(`${verb.grundform}: wir/sie`);
    for (const [p, falsch] of Object.entries(verb.falsch ?? {})) if (Object.values(f).includes(falsch!)) fehler.push(`${verb.grundform}: „${falsch}“ (${p}) ist eine richtige Form`);
  }
  const karten = v.beugenKandidaten();
  const keys = new Set(karten.map((k) => k.karte.key));
  if (keys.size !== karten.length) fehler.push("doppelte Keys");
  for (const { karte } of karten) {
    if (!karte.faecher.includes(karte.richtig)) fehler.push(`${karte.loesung}: ohne die richtige`);
    if (new Set(karte.faecher).size !== karte.faecher.length || karte.faecher.length < 3 || karte.faecher.length > 4) fehler.push(`${karte.loesung}: ${karte.faecher.join(", ")}`);
    if (`${karte.vor}${karte.richtig}${karte.nach}` !== karte.loesung) fehler.push(`${karte.loesung}: Lücke`);
    if (/^Sie /.test(karte.vor) || / sie /.test(` ${karte.vor}${karte.nach} `.replace(/sie \(mehrere\)/, ""))) fehler.push(`${karte.loesung}: „sie“ ist mehrdeutig`);
  }
  for (const s of [0, 1, 2, 3]) if (karten.filter((k) => k.stufe === s).length < 60) fehler.push(`Stufe ${s}: zu wenige`);
  assert.deepEqual(fehler, []);
});

test("Verben beugen: Beispiele, Kacheln und Regeln", async () => {
  const v = await import("./verben-beugen");
  const karten = v.beugenKandidaten().map((k) => k.karte);
  const k = karten.find((x) => x.loesung === "Du gehst in die Schule.")!;
  assert.deepEqual(k.faecher, ["gehe", "gehst", "geht", "gehen"]);
  assert.equal(k.hinweis, "(gehen)");
  assert.match(k.regel, /-st: du gehst/);
  const f = karten.find((x) => x.loesung === "Du fährst mit dem Rad.")!;
  assert.ok(f.faecher.includes("fahrst"), f.faecher.join());
  assert.match(f.regel, /Selbstlaut/);
  const s = karten.find((x) => x.loesung === "Ihr seid in der Schule.")!;
  assert.ok(s.faecher.includes("seit"));
  assert.match(s.regel, /seid.*mit d/);
  const t = karten.find((x) => x.loesung === "Du tanzt im Turnsaal.")!;
  assert.ok(t.faecher.includes("tanzst"));
  assert.match(t.regel, /nur -t/);
  const n = karten.find((x) => x.vor === "Lisa " && x.richtig === "spielt")!;
  assert.match(n.regel, /„Lisa“ ist wie „sie“/);
  const inv = karten.find((x) => x.vor !== "Du " && x.richtig === "gehst" && x.hinweis === "(gehen)")!;
  assert.match(inv.nach, /^ du /);
});

test("Runden: Volksschule bekommt beide Spiele vorgeschlagen, 2. Klasse nur leichte Karten, Lernstand-Fähigkeit", async () => {
  const { sp, student } = await setup({ grade: 2 });
  const arten = sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => x.art);
  assert.ok(arten.indexOf("wortarten") >= 0 && arten.indexOf("konjugieren") >= 0, arten.join());
  assert.ok(arten.indexOf("wortarten") < arten.indexOf("artikel"));
  const w = await import("./wortarten-spiel");
  const leicht = new Set(w.wortartKandidaten().filter((k) => k.stufe === 0).map((k) => k.karte.key));
  const r = sp.starteRunde(student, "wortarten", { heute: HEUTE, rng: rng(4) });
  assert.equal(r.karten.length, 12);
  assert.ok(r.karten.every((k) => leicht.has(k.key) && k.form === "kacheln"));
  // nie zwei Wörter aus demselben Satz in einer Runde
  assert.equal(new Set(r.karten.map((k) => k.key.split("|")[0])).size, 12);
  const e = sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.ok(e && !("fehler" in e));
  assert.equal(sp.skillFuerSpiel(student, "wortarten", HEUTE), "deutsch.wortarten.bestimmen");
  assert.equal(sp.skillFuerSpiel(student, "konjugieren", HEUTE), "deutsch.vs.sprache.personalformen");
  assert.deepEqual(sp.spieleZuSkills(["deutsch.vs.sprache.personalformen"])[0], "konjugieren");
  assert.deepEqual(sp.spieleZuSkills(["deutsch.wortarten.bestimmen.verb"])[0], "wortarten");
});

test("ich gehe, du gehst: richtig gewählte Karten kommen zum Selbstschreiben wieder, Schwer schreibt alles, streng", async () => {
  const { sp, student } = await setup({ grade: 4 });
  const a = await import("./antwort-schreiben");
  const r = sp.starteRunde(student, "konjugieren", { heute: HEUTE, rng: rng(7) });
  assert.ok(r.karten.every((k) => k.form === "kacheln"));
  sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const s = sp.starteRunde(student, "konjugieren", { heute: HEUTE, schwer: true, rng: rng(8) });
  assert.ok(s.karten.every((k) => k.form === "schreiben"), s.karten.map((k) => k.form).join());
  assert.equal(a.schreibStreng("konjugieren"), true);
  const k = s.karten[0];
  assert.equal(a.pruefeKarte("konjugieren", k, k.richtig.toUpperCase()), "richtig");
  // „du spielt“ ist nie ein Tippfehler von „spielst“
  const karte = { key: "x", vor: "Du ", nach: " gern.", faecher: ["spiele", "spielst", "spielt", "spielen"], richtig: "spielst", loesung: "Du spielst gern.", regel: "" };
  assert.equal(a.pruefeKarte("konjugieren", karte, "spielt"), "falsch");
  assert.equal(a.pruefeKarte("konjugieren", { ...karte, faecher: ["fahre", "fährst", "fahrst", "fährt"], richtig: "fährst" }, "fahrst"), "falsch");
  // „Wortarten“ hat nur drei feste Antworten: kein Schreiben, kein Schalter
  assert.equal(a.hatSchreiben("wortarten"), false);
});
