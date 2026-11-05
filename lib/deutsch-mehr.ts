/**
 * Mehr Deutsch ohne KI (Generalprobe 2026-11-05: diese häufigen Themen hatten nur „Erkläre in eigenen Worten …“):
 * Mehrzahl, Personalformen, Silbentrennung, Wörterbuch, gleich klingende Wörter, Fremdwörter, Steigerung,
 * zusammengesetzte und abgeleitete Wörter, Redewendungen, Befehlsform, Konjunktiv II, indirekte Rede, Satzreihe und
 * Satzgefüge, Attribute, sprachliche Bilder und „das“ oder „was“.
 *
 * Jede Fähigkeit hat dieselbe Form wie in lib/deutsch-satzlehre.ts (Faehigkeit): Lückentext, Multiple Choice,
 * Kurzantwort und, wo der Fehler im Satz eindeutig ist, „Fehler korrigieren“. Jeder Satz hat genau eine Lesart, jeder
 * typische Fehler ein Etikett. Ein Fehler, der in einem anderen Sinn richtig wäre („Kannst du mir das Salz geben?“
 * statt Konjunktiv II), ist nie der Fehler eines Korrekturtexts (fix: false). Die Hilfen nennen die Regel an einem
 * anderen Wort, nie die Antwort (lib/hinweise-loesung.test.ts).
 *
 * Eigene Sätze, nichts aus Schulbüchern oder Prüfungen. Begriffe wie in österreichischen Schulen (Mitvergangenheit,
 * Beistrich, Hausübung).
 */
import type { Faehigkeit, Fehler, Satz, Umformung, Wahl } from "./deutsch-satzlehre";
import { BUBEN, MAEDCHEN, VERBEN, pick, type Person, type Verb } from "./deutsch-woerter";
import type { Rng, Stufe } from "./schulbuch-zahlen";

// ---------- kleine Helfer ----------
type Luecke = Satz["luecken"][number];
const F = (answer: string, label: string, o: { mc?: false; fix?: false } = {}): Fehler => ({ answer, label, ...o });
const L = (richtig: string | readonly string[], fehler: Fehler[], cue?: string): Luecke => ({ richtig: typeof richtig === "string" ? [richtig] : [...richtig], fehler, cue });
const NICHT_FIX = { fix: false } as const;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Bis zu welcher Stufe der Einträge eine Schwierigkeit geht: unten die leichten, oben meist die schweren. */
const MAX: Record<Stufe, number> = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 2 };
function waehle<X extends { st?: number }>(rng: Rng, liste: readonly X[], st: Stufe): X {
  const erlaubt = liste.filter((x) => (x.st ?? 0) <= MAX[st]);
  const schwer = erlaubt.filter((x) => (x.st ?? 0) >= 1);
  return pick(rng, st >= 3 && schwer.length && rng() < 0.6 ? schwer : erlaubt.length ? erlaubt : liste);
}
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Der Lückentext, wie ihn der Schüler sieht: was in Klammern steht, gleich nach der Lücke. */
function mitCues(s: Satz): string {
  let i = 0;
  const text = s.text.replace(/___/g, () => {
    const l = s.luecken[i++];
    return l?.cue ? `___ (${l.cue})` : "___";
  });
  return s.cueEnde ? `${text} (${s.cueEnde})` : text;
}

/**
 * Multiple Choice aus einem Lückensatz: die Antworten sind die Füllungen der Lücken („seid … seit“). Bei mehreren
 * Lücken mit je einem Fehler auch „alle verwechselt“. `tipp` ersetzt den Tipp des Satzes, wenn er die Antwort nennt.
 */
function wahlAus(s: Satz, titel: string, tipp?: string): Wahl {
  const rechts = s.luecken.map((l) => l.richtig[0]);
  const zeige = (w: readonly string[]) => w.join(" … ");
  const mc = s.luecken.map((l) => l.fehler.filter((f) => f.mc !== false));
  const einzeln = mc.flatMap((fs, i) => fs.map((f) => ({ ...f, answer: zeige(rechts.map((r, j) => (j === i ? f.answer : r))) })));
  const alle = s.luecken.length > 1 && mc.every((fs) => fs.length) ? [F(zeige(mc.map((fs) => fs[0].answer)), s.luecken.length === 2 ? "Beide Wörter sind verwechselt" : "Alle Wörter sind verwechselt")] : [];
  return { titel, text: mitCues(s), richtig: zeige(rechts), falsch: [...einzeln, ...alle], regel: s.regel, hilfe: s.hilfe, tipp: tipp ?? s.tipp };
}

/** Eine Fähigkeit aus einer Liste: derselbe Eintrag gibt Lückentext, Multiple Choice, Kurzantwort und Korrektur. */
function ausListe<X extends { st?: number }>(
  liste: readonly X[],
  o: {
    satz: (x: X, rng: Rng) => Satz;
    wahl?: (x: X, rng: Rng) => Wahl | null;
    wahlTitel?: string;
    kurz: (x: X, rng: Rng) => Umformung;
    fix?: boolean;
    fixAuftrag?: (n: number) => string;
    standard: "mc" | "cloze";
    bestimmen: boolean;
    /** nur diese Einträge für Multiple Choice (z. B. die mit zwei Lücken) */
    mcListe?: readonly X[];
  },
): Faehigkeit {
  return {
    luecke: (rng, st) => o.satz(waehle(rng, liste, st), rng),
    wahl: (rng, st) => {
      const x = waehle(rng, o.mcListe ?? liste, st);
      return o.wahl ? o.wahl(x, rng) : wahlAus(o.satz(x, rng), o.wahlTitel ?? "Was ist richtig?");
    },
    kurz: (rng, st) => o.kurz(waehle(rng, liste, st), rng),
    ...(o.fix ? { fix: (rng: Rng, st: Stufe) => o.satz(waehle(rng, liste, st), rng), fixAuftrag: o.fixAuftrag } : {}),
    standard: o.standard,
    bestimmen: o.bestimmen,
  };
}

// =====================================================================
// ---------- Mehrzahl (Volksschule) ----------
// =====================================================================
type MzGruppe = "umlautE" | "e" | "n" | "n2" | "en" | "er" | "umlaut" | "s" | "gleich" | "innen" | "fremd";
const MZ_TIPP: Record<MzGruppe, string> = {
  umlautE: "Viele kurze Nomen bekommen in der Mehrzahl ein -e und dazu oft einen Umlaut: der Stall, die Ställe.",
  e: "Viele Nomen bekommen in der Mehrzahl nur ein -e: der Tisch, die Tische.",
  n: "Nomen auf -e bekommen in der Mehrzahl meist ein -n: die Tasche, die Taschen.",
  n2: "Weibliche Nomen auf -er bekommen in der Mehrzahl ein -n: die Feder, die Federn.",
  en: "Manche Nomen bekommen in der Mehrzahl -en: das Hemd, die Hemden.",
  er: "Manche Nomen bekommen in der Mehrzahl -er, oft mit Umlaut: das Dach, die Dächer.",
  umlaut: "Nomen auf -el bekommen in der Mehrzahl oft nur einen Umlaut: der Mantel, die Mäntel.",
  s: "Wörter auf -o, -a oder -y und viele Wörter aus dem Englischen bekommen ein -s: das Kino, die Kinos.",
  gleich: "Nomen auf -er bleiben in der Mehrzahl oft gleich: der Lehrer, die Lehrer.",
  innen: "Nach -in kommt in der Mehrzahl -nen: die Freundin, die Freundinnen.",
  fremd: "Manche Fremdwörter ändern in der Mehrzahl ihr Ende: das Zentrum, die Zentren.",
};
type Mz = { art: string; ez: string; mz: string[]; g: MzGruppe; satz: string; f: Fehler[]; st?: number };
const UML = (von: string, zu: string) => `Umlaut vergessen: aus ${von} wird ${zu}`;
const MZ_DAT = "Das -n kommt nur im 3. Fall dazu, zum Beispiel nach „mit“. Hier steht die Mehrzahl ohne -n";
const MZ_S = "Diese Mehrzahl hat kein -s";
const MZ_EZ = "Das ist die Einzahl. Hier sind es mehrere";
const MZ_KEIN_UML = (w: string) => `${w} bekommt in der Mehrzahl keinen Umlaut`;
const M = (art: string, ez: string, mz: string | string[], g: MzGruppe, satz: string, f: Fehler[], st?: number): Mz => ({ art, ez, mz: typeof mz === "string" ? [mz] : mz, g, satz, f, st });
const MEHRZAHL: Mz[] = [
  M("der", "Baum", "Bäume", "umlautE", "Im Park stehen drei hohe ___.", [F("Baume", UML("a", "ä")), F("Bäumen", MZ_DAT), F("Baums", MZ_S)]),
  M("der", "Hund", "Hunde", "e", "Im Garten bellen zwei ___.", [F("Hunds", MZ_S), F("Hunden", MZ_DAT), F("Hünde", MZ_KEIN_UML("Hund"))]),
  M("die", "Katze", "Katzen", "n", "Auf dem Dach sitzen drei ___.", [F("Katzes", MZ_S), F("Kätzen", MZ_KEIN_UML("Katze")), F("Katze", MZ_EZ)]),
  M("das", "Kind", "Kinder", "er", "In meiner Klasse sind zwanzig ___.", [F("Kinde", "Kind bekommt in der Mehrzahl -er"), F("Kinds", MZ_S), F("Kindern", MZ_DAT)]),
  M("das", "Haus", "Häuser", "er", "In unserer Straße stehen viele ___.", [F("Hauser", UML("au", "äu")), F("Häuse", "Haus bekommt in der Mehrzahl -er"), F("Häusern", MZ_DAT)]),
  M("das", "Buch", "Bücher", "er", "Im Regal stehen viele ___.", [F("Bucher", UML("u", "ü")), F("Buchs", MZ_S), F("Büchern", MZ_DAT)]),
  M("der", "Apfel", "Äpfel", "umlaut", "Im Korb liegen fünf ___.", [F("Apfel", UML("A", "Ä")), F("Apfeln", "Nomen auf -el bekommen hier kein -n"), F("Äpfeln", MZ_DAT)]),
  M("der", "Vogel", "Vögel", "umlaut", "Im Baum singen zwei ___.", [F("Vogel", UML("o", "ö")), F("Vogeln", "Nomen auf -el bekommen hier kein -n"), F("Vögeln", MZ_DAT)]),
  M("die", "Maus", "Mäuse", "umlautE", "Im Keller wohnen drei ___.", [F("Mause", UML("au", "äu")), F("Mäuser", "Maus bekommt -e, nicht -er"), F("Mausen", "Maus bekommt kein -n")]),
  M("das", "Auto", "Autos", "s", "Vor der Schule parken viele ___.", [F("Auto", MZ_EZ), F("Autoe", "Wörter auf -o bekommen ein -s"), F("Auten", "Wörter auf -o bekommen ein -s")]),
  M("die", "Blume", "Blumen", "n", "In der Vase stehen bunte ___.", [F("Blume", MZ_EZ), F("Blumes", MZ_S), F("Blümen", MZ_KEIN_UML("Blume"))]),
  M("der", "Stuhl", "Stühle", "umlautE", "Um den Tisch stehen vier ___.", [F("Stuhle", UML("u", "ü")), F("Stühlen", MZ_DAT), F("Stuhls", MZ_S)]),
  M("die", "Hand", "Hände", "umlautE", "Ich wasche mir beide ___.", [F("Hande", UML("a", "ä")), F("Händen", MZ_DAT), F("Hands", "Das -s ist englisch. Deutsch: -e")]),
  M("das", "Ei", "Eier", "er", "Im Nest liegen drei ___.", [F("Eis", "Eis ist ein anderes Wort. Ei bekommt -er"), F("Eie", "Ei bekommt in der Mehrzahl -er"), F("Eiern", MZ_DAT)]),
  M("das", "Bett", "Betten", "en", "Im Zimmer stehen zwei ___.", [F("Bette", "Bett bekommt in der Mehrzahl -en"), F("Betts", MZ_S), F("Bett", MZ_EZ)]),
  M("der", "Zahn", "Zähne", "umlautE", "Ich putze mir jeden Abend alle ___.", [F("Zahne", UML("a", "ä")), F("Zähnen", MZ_DAT), F("Zahns", MZ_S)]),
  M("der", "Ball", "Bälle", "umlautE", "In der Kiste liegen drei ___.", [F("Balle", UML("a", "ä")), F("Bällen", MZ_DAT), F("Balls", "Das -s ist englisch. Deutsch: -e")]),
  M("der", "Fuß", "Füße", "umlautE", "Nach dem Schneeballwerfen habe ich kalte ___.", [F("Fuße", UML("u", "ü")), F("Füßen", MZ_DAT), F("Füsse", "Nach dem langen ü schreibt man ß")]),
  M("das", "Messer", "Messer", "gleich", "In der Lade liegen sechs ___.", [F("Messers", MZ_S), F("Messern", MZ_DAT), F("Messere", "Nomen auf -er bleiben in der Mehrzahl oft gleich")], 1),
  M("die", "Lehrerin", "Lehrerinnen", "innen", "An unserer Schule arbeiten viele ___.", [F("Lehrerinen", "Nach -in kommen zwei n: -innen"), F("Lehrerins", MZ_S), F("Lehrerin", MZ_EZ)], 1),
  M("der", "Zug", "Züge", "umlautE", "Am Bahnhof warten zwei ___.", [F("Zuge", UML("u", "ü")), F("Zügen", MZ_DAT), F("Zugs", MZ_S)], 1),
  M("die", "Wurst", "Würste", "umlautE", "Am Grill liegen vier ___.", [F("Wurste", UML("u", "ü")), F("Würsten", MZ_DAT), F("Wursts", MZ_S)], 1),
  M("die", "Nuss", "Nüsse", "umlautE", "Das Eichhörnchen sammelt viele ___.", [F("Nusse", UML("u", "ü")), F("Nüße", "Nach dem kurzen ü schreibt man ss"), F("Nüssen", MZ_DAT)], 1),
  M("das", "Glas", "Gläser", "er", "Auf dem Tisch stehen sechs ___.", [F("Glaser", UML("a", "ä")), F("Gläse", "Glas bekommt in der Mehrzahl -er"), F("Gläsern", MZ_DAT)], 1),
  M("die", "Schwester", "Schwestern", "n2", "Ich habe zwei ___.", [F("Schwesters", MZ_S), F("Schwester", MZ_EZ), F("Schwesteren", "Nomen auf -er bekommen nur ein -n")], 1),
  M("das", "Museum", "Museen", "fremd", "In Wien gibt es viele ___.", [F("Museums", "Museum ändert sein Ende: aus -um wird -en"), F("Museume", "Museum ändert sein Ende: aus -um wird -en"), F("Museumen", "Das -um fällt weg: nur -en")], 2),
  M("das", "Thema", ["Themen", "Themata"], "fremd", "Im Deutschunterricht lernen wir neue ___.", [F("Themas", "Thema ändert sein Ende: aus -a wird -en"), F("Thema", MZ_EZ), F("Themane", "Das -a fällt weg: nur -en")], 2),
  M("das", "Baby", "Babys", "s", "Im Krankenhaus schlafen viele ___.", [F("Babies", "Im Deutschen nur -s, nicht -ies wie im Englischen"), F("Babyen", "Wörter auf -y bekommen ein -s"), F("Baby", MZ_EZ)], 2),
  M("die", "Pizza", ["Pizzas", "Pizzen"], "s", "Wir bestellen drei ___.", [F("Pizze", "Pizza bekommt -s oder -en am Stamm"), F("Pizzaen", "Bei -en fällt das a weg"), F("Pizza", MZ_EZ)], 2),
  M("das", "Lexikon", ["Lexika", "Lexiken"], "fremd", "In der Bibliothek stehen alte ___.", [F("Lexikons", "Lexikon ändert sein Ende: aus -on wird -a oder -en"), F("Lexikone", "Lexikon ändert sein Ende: aus -on wird -a oder -en"), F("Lexikon", MZ_EZ)], 2),
  M("der", "Atlas", ["Atlasse", "Atlanten"], "fremd", "Im Regal stehen zwei ___.", [F("Atlase", "Nach dem kurzen a kommen zwei s"), F("Atlas", MZ_EZ), F("Atlasen", "Atlas bekommt -se oder wird zu Atlanten")], 2),
  M("das", "Visum", ["Visa", "Visen"], "fremd", "Für die Reise brauchen wir zwei ___.", [F("Visums", "Visum ändert sein Ende: aus -um wird -a oder -en"), F("Visume", "Visum ändert sein Ende: aus -um wird -a oder -en"), F("Visum", MZ_EZ)], 2),
];
const MZ_HILFE = "Wie heißt das Wort, wenn es mehrere sind? Sag es laut: ein …, zwei …";
const mzRegel = (m: Mz) => `${m.art} ${m.ez}, die ${m.mz.join(" oder die ")}.`;
const MEHRZAHL_F = ausListe(MEHRZAHL, {
  satz: (m) => ({ titel: "Setz die Mehrzahl ein.", text: m.satz, luecken: [L(m.mz, m.f, m.ez)], regel: mzRegel(m), hilfe: MZ_HILFE, tipp: MZ_TIPP[m.g] }),
  wahlTitel: "Welche Mehrzahl ist richtig?",
  kurz: (m) => ({
    auftrag: "Schreib die Mehrzahl.",
    vorlage: `${m.art} ${m.ez}`,
    richtig: [...m.mz, ...m.mz.map((x) => `die ${x}`)],
    fehler: [...m.f, ...m.f.map((x) => ({ ...x, answer: `die ${x.answer}` }))],
    regel: mzRegel(m),
    hilfe: MZ_HILFE,
    tipp: MZ_TIPP[m.g],
  }),
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz ist eine Mehrzahl falsch. Schreib den Satz richtig." : "In jedem Satz ist eine Mehrzahl falsch. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- Personalformen (Volksschule) ----------
// =====================================================================
const PERSONEN: Person[] = [0, 1, 2, 3, 4, 5];
const PF_NAME: Record<Person, string> = { 0: "ich", 1: "du", 2: "er, sie, es", 3: "wir", 4: "ihr", 5: "sie (mehrere)" };
const PF_TIPP: Record<Person, string> = {
  0: "Bei ich endet das Verb auf -e: ich male, ich gebe.",
  1: "Bei du endet das Verb auf -st: du malst. Manche Verben ändern dabei den Selbstlaut: du gibst.",
  2: "Bei er, sie, es endet das Verb auf -t: sie malt. Manche Verben ändern dabei den Selbstlaut: er gibt.",
  3: "Bei wir sieht das Verb aus wie die Grundform: wir malen.",
  4: "Bei ihr endet das Verb auf -t: ihr malt, ihr gebt.",
  5: "Sind es mehrere (sie), sieht das Verb aus wie die Grundform: sie malen.",
};
const PF_HILFE = "Frag: Wer tut es? Dann such die passende Endung: ich -e, du -st, er, sie, es -t, wir -en, ihr -t, sie -en.";
const PF_KINDER = [...MAEDCHEN.slice(0, 8), ...BUBEN.slice(0, 8)];
const PF_GRUPPEN = ["Die Kinder", "Meine Freunde", "Lena und Jonas", "Die Mädchen"];
/** Die anderen Formen des Verbs, jede mit der Person, zu der sie gehört; beim Wechsel des Selbstlauts das. */
function pfFehler(v: Verb, p: Person): Fehler[] {
  const richtig = v.praes[p];
  const wechsel = v.praes[2] !== v.praes[4];
  const WECHSEL = `Bei „${v.inf}“ ändert sich bei du und bei er, sie, es der Selbstlaut`;
  const out: Fehler[] = [];
  for (const f of new Set(v.praes)) {
    if (f === richtig) continue;
    if (wechsel && (p === 1 || p === 2) && f === v.praes[4]) out.push(F(f, WECHSEL));
    else out.push(F(f, `Das ist die Form für ${PERSONEN.filter((q) => v.praes[q] === f).map((q) => PF_NAME[q]).join(" und für ")}`));
  }
  if (wechsel && p === 1) {
    const stamm = v.praes[4].replace(/t$/, "");
    if (!/[sßzx]$/.test(stamm)) out.push(F(`${stamm}st`, WECHSEL));
  }
  return out;
}
type PfEintrag = { v: Verb; st: number };
const PF_LISTE: PfEintrag[] = VERBEN.map((v) => ({ v, st: v.stufe }));
function pfTeile(e: PfEintrag, rng: Rng) {
  const p = pick(rng, PERSONEN);
  const wer = p === 0 ? "Ich" : p === 1 ? "Du" : p === 2 ? pick(rng, PF_KINDER) : p === 3 ? "Wir" : p === 4 ? "Ihr" : pick(rng, PF_GRUPPEN);
  const rest = `${pick(rng, e.v.rest)}${e.v.teil ? ` ${e.v.teil}` : ""}`;
  const form = e.v.praes[p];
  return { p, wer, rest, form, fehler: pfFehler(e.v, p), regel: `Zu ${PF_NAME[p]} passt „${form}“.` };
}
const PERSONALFORMEN_F = ausListe(PF_LISTE, {
  satz: (e, rng) => {
    const t = pfTeile(e, rng);
    return { titel: "Setz das Verb in der richtigen Form ein.", text: `${t.wer} ___ ${t.rest}.`, luecken: [L(t.form, t.fehler, e.v.inf)], regel: t.regel, hilfe: PF_HILFE, tipp: PF_TIPP[t.p] };
  },
  wahlTitel: "Welche Form passt?",
  kurz: (e, rng) => {
    const t = pfTeile(e, rng);
    return {
      auftrag: `Welche Form von „${e.v.inf}“ passt? Schreib nur das Verb.`,
      vorlage: `${t.wer} … ${t.rest}.`,
      richtig: [t.form, `${t.wer} ${t.form} ${t.rest}.`],
      fehler: t.fehler,
      regel: t.regel,
      hilfe: PF_HILFE,
      tipp: PF_TIPP[t.p],
    };
  },
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz passt das Verb nicht zur Person. Schreib den Satz richtig." : "In jedem Satz passt ein Verb nicht zur Person. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- Silbentrennung (Volksschule) ----------
// =====================================================================
const TR = {
  doppel: "Zwei gleiche Mitlaute trennt man: einer bleibt vorne, einer kommt in die neue Zeile",
  ck: "ck bleibt zusammen und kommt in die neue Zeile",
  ch: "ch und sch bleiben zusammen",
  st: "Bei st trennt man zwischen s und t",
  tz: "Bei tz trennt man zwischen t und z",
  sprech: "Trenn nach Sprechsilben: Sprich das Wort langsam und klatsch mit",
  mitlaut: "Stehen mehrere Mitlaute zwischen den Selbstlauten, kommt nur der letzte in die neue Zeile",
  teile: "Bei zusammengesetzten Wörtern trennt man zuerst zwischen den Teilen",
};
type Trennung = { tr: string; f: Fehler[]; st?: number };
const T = (tr: string, f: [string, keyof typeof TR][], st?: number): Trennung => ({ tr, f: f.map(([a, k]) => F(a, TR[k])), st });
const TRENNUNG: Trennung[] = [
  T("Was-ser", [["Wa-sser", "doppel"], ["Wass-er", "sprech"]]),
  T("Zu-cker", [["Zuc-ker", "ck"], ["Zuck-er", "sprech"]]),
  T("Kis-te", [["Ki-ste", "st"], ["Kist-e", "sprech"]]),
  T("Blu-me", [["Bl-ume", "sprech"], ["Blum-e", "sprech"]]),
  T("Kat-ze", [["Ka-tze", "tz"], ["Katz-e", "sprech"]]),
  T("Son-ne", [["So-nne", "doppel"], ["Sonn-e", "sprech"]]),
  T("Fla-sche", [["Flas-che", "ch"], ["Flasch-e", "sprech"]]),
  T("Bü-cher", [["Büc-her", "ch"], ["Büch-er", "sprech"]]),
  T("Lam-pe", [["La-mpe", "mitlaut"], ["Lamp-e", "sprech"]]),
  T("Ta-sche", [["Tas-che", "ch"], ["Tasch-e", "sprech"]]),
  T("Gar-ten", [["Ga-rten", "mitlaut"], ["Gart-en", "sprech"]]),
  T("Wol-ke", [["Wo-lke", "mitlaut"], ["Wolk-e", "sprech"]]),
  T("Kin-der", [["Ki-nder", "mitlaut"], ["Kind-er", "sprech"]]),
  T("Tel-ler", [["Te-ller", "doppel"], ["Tell-er", "sprech"]]),
  T("Ta-fel", [["Taf-el", "sprech"], ["Tafe-l", "sprech"]]),
  T("Schu-le", [["Schul-e", "sprech"], ["Sch-ule", "ch"]]),
  T("Brü-cke", [["Brüc-ke", "ck"], ["Brück-e", "sprech"]]),
  T("Ja-cke", [["Jac-ke", "ck"], ["Jack-e", "sprech"]]),
  T("Fens-ter", [["Fen-ster", "st"], ["Fenst-er", "sprech"]]),
  T("Mon-tag", [["Mo-ntag", "mitlaut"], ["Mont-ag", "sprech"]]),
  T("Ha-se", [["Has-e", "sprech"], ["Ha-s-e", "sprech"]]),
  T("Scho-ko-la-de", [["Schok-o-la-de", "sprech"], ["Scho-kol-a-de", "sprech"]], 1),
  T("Ba-na-ne", [["Ban-an-e", "sprech"], ["Ba-nan-e", "sprech"]], 1),
  T("Te-le-fon", [["Tel-e-fon", "sprech"], ["Te-lef-on", "sprech"]], 1),
  T("Ka-rot-te", [["Kar-ot-te", "sprech"], ["Ka-ro-tte", "doppel"]], 1),
  T("Kar-tof-fel", [["Kart-of-fel", "sprech"], ["Kar-to-ffel", "doppel"]], 1),
  T("Schmet-ter-ling", [["Schme-tter-ling", "doppel"], ["Schmett-er-ling", "sprech"]], 1),
  T("Ta-schen-lam-pe", [["Tasch-en-lam-pe", "ch"], ["Ta-schen-la-mpe", "mitlaut"]], 1),
  T("Win-ter-ja-cke", [["Win-ter-jac-ke", "ck"], ["Wint-er-ja-cke", "sprech"]], 1),
  T("Son-nen-blu-me", [["So-nnen-blu-me", "doppel"], ["Son-nen-bl-ume", "sprech"]], 1),
  T("Ge-burts-tag", [["Ge-burt-stag", "teile"], ["Geb-urts-tag", "sprech"]], 1),
  T("Fahr-rad", [["Fah-rrad", "teile"], ["Fahrr-ad", "teile"]], 1),
  T("Haus-tür", [["Hau-stür", "teile"], ["Haust-ür", "teile"]], 1),
  T("Blei-stift", [["Bleis-tift", "teile"], ["Bl-eistift", "sprech"]], 1),
  T("Spiel-platz", [["Spie-lplatz", "teile"], ["Spielp-latz", "teile"]], 1),
  T("Hand-schuh", [["Hands-chuh", "ch"], ["Han-dschuh", "teile"]], 1),
  T("Kin-der-gar-ten", [["Kind-er-gar-ten", "sprech"], ["Kin-der-ga-rten", "mitlaut"]], 2),
  T("Weih-nachts-baum", [["Weihn-achts-baum", "sprech"], ["Weih-nach-tsbaum", "teile"]], 2),
  T("Zahn-bürs-te", [["Zahn-bür-ste", "st"], ["Zah-nbürs-te", "teile"]], 2),
  T("Was-ser-fla-sche", [["Wa-sser-fla-sche", "doppel"], ["Was-ser-flas-che", "ch"]], 2),
  T("Ap-fel-saft", [["Apf-el-saft", "sprech"], ["Ap-fels-aft", "teile"]], 2),
  T("Fuß-ball-spie-ler", [["Fuß-bal-lspie-ler", "teile"], ["Fu-ßball-spie-ler", "teile"]], 2),
  T("Sonn-tag", [["Son-ntag", "teile"], ["Sonnt-ag", "teile"]], 2),
];
const ZAHLWORT = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs"];
const TR_HILFE = "Sprich das Wort langsam und klatsch bei jeder Silbe.";
const TR_TIPP = "ck, ch und sch bleiben zusammen. Gleiche Mitlaute und st trennt man: Bril-le, Mus-ter.";
const TR_REGEL = "Man trennt nach Sprechsilben.";
const wortVon = (t: Trennung) => t.tr.replace(/-/g, "");
const SILBENTRENNUNG_F = ausListe(TRENNUNG, {
  satz: (t) => ({ titel: "Schreib das Wort mit Trennstrichen zwischen allen Silben.", text: `${wortVon(t)}: ___`, luecken: [L(t.tr, t.f)], regel: TR_REGEL, hilfe: TR_HILFE, tipp: TR_TIPP }),
  wahl: (t) => ({ titel: "Wie trennt man das Wort richtig?", text: wortVon(t), richtig: t.tr, falsch: t.f, regel: TR_REGEL, hilfe: TR_HILFE, tipp: TR_TIPP }),
  kurz: (t) => {
    const n = t.tr.split("-").length;
    const zaehl = "Klatsch noch einmal mit: Jede Silbe hat einen Selbstlaut oder Zwielaut";
    return {
      auftrag: "Wie viele Silben hat das Wort? Schreib die Zahl.",
      vorlage: wortVon(t),
      richtig: [String(n), ZAHLWORT[n]],
      fehler: [F(String(n + 1), zaehl), ...(n > 2 ? [F(String(n - 1), zaehl)] : [])],
      regel: `${t.tr}: ${n} Silben.`,
      hilfe: TR_HILFE,
      tipp: "Leg die Hand unter das Kinn: Bei jeder Silbe geht der Mund auf.",
    };
  },
  standard: "mc",
  bestimmen: true,
});

// =====================================================================
// ---------- Wörterbuch: Grundform und Abc (Volksschule) ----------
// =====================================================================
type Nachschlagen = { form: string; grund: string; art: "verb" | "nomen" | "adj"; f: Fehler[]; st?: number };
const WB_LABEL = {
  verb: "Verben stehen in der Grundform im Wörterbuch, wie sie nach „wir“ heißen",
  nomen: "Nomen stehen in der Einzahl im Wörterbuch",
  adj: "Adjektive stehen in der Grundform im Wörterbuch, nicht gesteigert",
  gebeugt: "Auch das ist eine gebeugte Form. Im Wörterbuch steht die Grundform",
};
const NS = (form: string, grund: string, art: Nachschlagen["art"], andere: (string | [string, string])[], st?: number): Nachschlagen => ({
  form,
  grund,
  art,
  f: [F(form, WB_LABEL[art]), ...andere.map((x) => (typeof x === "string" ? F(x, WB_LABEL.gebeugt) : F(x[0], x[1])))],
  st,
});
const NACHSCHLAGEN: Nachschlagen[] = [
  NS("lief", "laufen", "verb", ["liefen", "läuft"]),
  NS("ging", "gehen", "verb", ["gingen", "geht"]),
  NS("sah", "sehen", "verb", ["sahen", "sieht"]),
  NS("schrieb", "schreiben", "verb", ["schrieben", "schreibt"]),
  NS("las", "lesen", "verb", ["lasen", "liest"]),
  NS("trank", "trinken", "verb", ["tranken", "trinkt"]),
  NS("Häuser", "Haus", "nomen", [["Häus", "Die Einzahl hat keinen Umlaut"], ["Hause", "Die Einzahl hat kein -e"]]),
  NS("Bäume", "Baum", "nomen", [["Bäum", "Die Einzahl hat keinen Umlaut"], ["Baume", "Die Einzahl hat kein -e"]]),
  NS("Mäuse", "Maus", "nomen", [["Mäus", "Die Einzahl hat keinen Umlaut"], ["Mause", "Die Einzahl hat kein -e"]]),
  NS("Bücher", "Buch", "nomen", [["Büch", "Die Einzahl hat keinen Umlaut"], ["Bucher", "Die Einzahl hat kein -er"]]),
  NS("Kinder", "Kind", "nomen", [["Kinde", "Die Einzahl hat kein -e"], ["Kindern", WB_LABEL.gebeugt]]),
  NS("Füße", "Fuß", "nomen", [["Füß", "Die Einzahl hat keinen Umlaut"], ["Fuße", "Die Einzahl hat kein -e"]]),
  NS("Gläser", "Glas", "nomen", [["Gläs", "Die Einzahl hat keinen Umlaut"], ["Glase", "Die Einzahl hat kein -e"]]),
  NS("Äpfel", "Apfel", "nomen", [["Äpfeln", WB_LABEL.gebeugt], ["Apfeln", "Die Einzahl hat kein -n"]]),
  NS("größer", "groß", "adj", [["größ", "Die Grundform hat keinen Umlaut"], "großer"], 1),
  NS("älter", "alt", "adj", [["ält", "Die Grundform hat keinen Umlaut"], "alte"], 1),
  NS("kälter", "kalt", "adj", [["kält", "Die Grundform hat keinen Umlaut"], "kalte"], 1),
  NS("am schnellsten", "schnell", "adj", ["schnellsten", "schneller"], 1),
  NS("fährt", "fahren", "verb", ["fuhr", ["fähren", "Die Grundform hat keinen Umlaut"]], 1),
  NS("isst", "essen", "verb", ["aß", ["issen", "Die Grundform hat ein e: wir …"]], 2),
  NS("nimmt", "nehmen", "verb", ["nahm", ["nimmen", "Die Grundform hat ein e: wir …"]], 2),
  NS("gibt", "geben", "verb", ["gab", ["giben", "Die Grundform hat ein e: wir …"]], 2),
  NS("half", "helfen", "verb", ["halfen", "hilft"], 2),
  NS("dachte", "denken", "verb", ["dachten", ["dachen", "Die Grundform heißt ganz anders: wir …"]], 2),
  NS("besser", "gut", "adj", [["bess", "Die Grundform von besser heißt ganz anders"], ["best", "Die Grundform von besser heißt ganz anders"]], 2),
  NS("höher", "hoch", "adj", [["höh", "Die Grundform hat keinen Umlaut"], "hohe"], 2),
];
const NS_TIPP: Record<Nachschlagen["art"], string> = {
  verb: "Frag: Wie heißt das Verb nach „wir“? Wie bei sprang: wir springen.",
  nomen: "Frag: Wie heißt es, wenn es nur eines ist? Wie bei Wälder: der Wald.",
  adj: "Frag: Wie heißt das Wort ohne -er und ohne am …-sten? Wie bei wärmer: warm.",
};
const NS_HILFE = "Im Wörterbuch stehen Verben in der Grundform, Nomen in der Einzahl und Adjektive in der Grundform.";
const nsRegel = (n: Nachschlagen) => `„${n.form}“ findest du unter „${n.grund}“.`;
/** Wörter für das Abc: unten verschiedene erste Buchstaben, dann gleiche erste, oben gleiche erste zwei. */
const ABC: { w: string[]; st: number }[] = [
  ...[
    ["Apfel", "Birne", "Kirsche", "Melone", "Zitrone"],
    ["Hund", "Katze", "Maus", "Pferd", "Esel"],
    ["Auto", "Bus", "Rad", "Zug", "Taxi"],
    ["Ball", "Puppe", "Kreisel", "Drachen", "Roller"],
    ["Tisch", "Stuhl", "Bett", "Kasten", "Lampe"],
    ["Hose", "Jacke", "Kappe", "Schal", "Pullover"],
    ["Brot", "Milch", "Käse", "Wurst", "Honig"],
    ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck"],
    ["Nase", "Ohr", "Mund", "Auge", "Hals"],
    ["Montag", "Dienstag", "Freitag", "Sonntag"],
  ].map((w) => ({ w, st: 0 })),
  ...[
    ["Bach", "Berg", "Blatt", "Brot", "Busch"],
    ["Tanne", "Tee", "Tisch", "Tor", "Turm"],
    ["Sand", "Seil", "Sonne", "Suppe", "Sirup"],
    ["Kamm", "Kette", "Kino", "Kopf", "Kuchen"],
    ["Mais", "Mehl", "Milch", "Mond", "Mutter"],
    ["Hase", "Heft", "Hirsch", "Hose", "Hut"],
    ["Fahne", "Feder", "Fisch", "Fluss", "Fuchs"],
    ["Lampe", "Leiter", "Licht", "Loch", "Luft"],
    ["Rabe", "Regen", "Riese", "Rose", "Rucksack"],
    ["Wald", "Weg", "Wind", "Wolke", "Wurm"],
  ].map((w) => ({ w, st: 1 })),
  ...[
    ["Bad", "Ball", "Bank", "Bart", "Baum"],
    ["Stall", "Stein", "Stern", "Stift", "Storch"],
    ["Schaf", "Schere", "Schiff", "Schuh", "Schule"],
    ["Kranz", "Kreis", "Krone", "Krug", "Kringel"],
    ["Tafel", "Tante", "Tasche", "Taxi", "Tasse"],
    ["Maler", "Mantel", "Markt", "Maske", "Maus"],
    ["Blatt", "Blei", "Blitz", "Blume", "Bluse"],
  ].map((w) => ({ w, st: 2 })),
];
const ABC_HILFE = "Schau zuerst auf den ersten Buchstaben. Sind sie gleich, dann auf den zweiten, dann auf den dritten.";
const ABC_TIPP = "Sag das Abc langsam auf. Welcher Buchstabe kommt früher dran?";
const ORDNUNG = ["erste", "zweite", "dritte", "vierte", "fünfte"];
const nachAbc = (w: readonly string[]) => [...w].sort((a, b) => a.localeCompare(b, "de"));
/** Warum ein Wort nicht vorne steht: der erste Buchstabe, oder der, nach dem die gleichen kommen. */
function abcEtikett(falsch: string, richtig: string): string {
  let k = 0;
  while (k < falsch.length && k < richtig.length && falsch[k].toLowerCase() === richtig[k].toLowerCase()) k++;
  if (k === 0) return `Schau auf den ersten Buchstaben: ${richtig[0].toUpperCase()} kommt im Abc vor ${falsch[0].toUpperCase()}`;
  return `${k === 1 ? "Der erste Buchstabe ist" : `Die ersten ${ZAHLWORT[k]} Buchstaben sind`} gleich. Dann entscheidet der ${ORDNUNG[k]} Buchstabe`;
}
function abcWoerter(rng: Rng, st: Stufe, n: number): string[] {
  const g = waehle(rng, ABC, st);
  return shuffle(rng, g.w).slice(0, n);
}
const nsSatz = (n: Nachschlagen): Satz => ({
  titel: "Unter welchem Wort findest du das im Wörterbuch? Schreib es in die Lücke.",
  text: `Im Text steht „${n.form}“. Im Wörterbuch suchst du: ___`,
  luecken: [L(n.grund, n.f)],
  regel: nsRegel(n),
  hilfe: NS_HILFE,
  tipp: NS_TIPP[n.art],
});
const WOERTERBUCH_F: Faehigkeit = {
  luecke: (rng, st) => nsSatz(waehle(rng, NACHSCHLAGEN, st)),
  wahl: (rng, st) => {
    if (rng() < 0.5) {
      const n = waehle(rng, NACHSCHLAGEN, st);
      return { titel: "Unter welchem Wort findest du das im Wörterbuch?", text: `„${n.form}“`, richtig: n.grund, falsch: n.f, regel: nsRegel(n), hilfe: NS_HILFE, tipp: NS_TIPP[n.art] };
    }
    const w = abcWoerter(rng, st, 4);
    const [vorne] = nachAbc(w);
    return {
      titel: "Welches Wort steht im Wörterbuch ganz vorne?",
      text: w.join(", "),
      richtig: vorne,
      falsch: w.filter((x) => x !== vorne).map((x) => F(x, abcEtikett(x, vorne))),
      regel: `Nach dem Abc: ${nachAbc(w).join(", ")}.`,
      hilfe: ABC_HILFE,
      tipp: ABC_TIPP,
    };
  },
  kurz: (rng, st) => {
    if (rng() < 0.4) {
      const n = waehle(rng, NACHSCHLAGEN, st);
      return { auftrag: "Unter welchem Wort findest du das im Wörterbuch? Schreib es.", vorlage: n.form, richtig: [n.grund], fehler: n.f, regel: nsRegel(n), hilfe: NS_HILFE, tipp: NS_TIPP[n.art] };
    }
    const n = st >= 2 ? 4 : 3;
    let w = abcWoerter(rng, st, n);
    const sortiert = nachAbc(w);
    for (let k = 0; k < 5 && w.join() === sortiert.join(); k++) w = shuffle(rng, w);
    if (w.join() === sortiert.join()) w = [...sortiert].reverse();
    const umgekehrt = [...sortiert].reverse();
    return {
      auftrag: "Ordne die Wörter nach dem Abc. Schreib sie mit Beistrichen.",
      vorlage: w.join(", "),
      richtig: [sortiert.join(", "), sortiert.join(" ")],
      fehler: [
        ...(w.join() !== umgekehrt.join() ? [F(w.join(", "), "Das ist noch die Reihenfolge aus der Angabe. Ordne nach dem ersten Buchstaben")] : []),
        F(umgekehrt.join(", "), "Umgekehrt: Was im Abc früher kommt, steht vorne"),
      ],
      regel: `Nach dem Abc: ${sortiert.join(", ")}.`,
      hilfe: ABC_HILFE,
      tipp: ABC_TIPP,
    };
  },
  standard: "mc",
  bestimmen: true,
};

// =====================================================================
// ---------- Gleich klingende Wörter: seit oder seid, wieder oder wider … ----------
// =====================================================================
type Paar = "seit" | "war" | "viel" | "statt" | "tot" | "wieder" | "lied" | "mal" | "wal" | "lehre" | "seite" | "end";
const PAAR: Record<Paar, { tipp: string; regel: string; falsch: Record<string, string> }> = {
  seit: {
    tipp: "Gehört das Wort zu ihr und kommt es von sein? Dann mit d. Geht es um die Zeit (ab wann)? Dann mit t.",
    regel: "seid kommt von sein (ihr seid), seit sagt etwas über die Zeit.",
    falsch: { seit: "Hier ist eine Form von sein gemeint (ihr …): mit d", seid: "Hier geht es um die Zeit (ab wann?): mit t" },
  },
  war: {
    tipp: "Heißt es „richtig, nicht gelogen“? Dann mit h. Ist es die Mitvergangenheit von sein? Dann ohne h.",
    regel: "wahr heißt richtig, war ist die Mitvergangenheit von sein.",
    falsch: { wahr: "Hier ist die Mitvergangenheit von sein gemeint: ohne h", war: "Hier heißt es „richtig, nicht gelogen“: mit h" },
  },
  viel: {
    tipp: "Kommt das Wort von fallen? Dann mit f. Heißt es „eine Menge“? Dann mit v.",
    regel: "viel heißt eine Menge, fiel kommt von fallen.",
    falsch: { fiel: "Hier heißt es „eine Menge“: mit v", viel: "Hier ist die Vergangenheit von fallen gemeint: mit f" },
  },
  statt: {
    tipp: "Ist ein Ort gemeint, in dem viele Menschen wohnen? Dann mit dt. Heißt es „anstelle von“ oder gehört es zu stattfinden? Dann mit tt.",
    regel: "Die Stadt ist ein Ort, statt heißt anstelle von.",
    falsch: { stadt: "Hier heißt es „anstelle von“ oder es gehört zu stattfinden: mit tt", statt: "Hier ist ein Ort gemeint, in dem viele Menschen wohnen: mit dt" },
  },
  tot: {
    tipp: "Ist es ein Nomen mit Artikel? Dann mit d. Sagt es, wie jemand ist? Dann mit t.",
    regel: "tot ist das Adjektiv, der Tod ist das Nomen.",
    falsch: { tod: "Hier sagt das Wort, wie jemand ist: ein Adjektiv mit t", tot: "Hier ist das Nomen gemeint (der …): mit d" },
  },
  wieder: {
    tipp: "Heißt es „noch einmal“? Dann mit ie. Heißt es „gegen“? Dann nur mit i.",
    regel: "wieder heißt noch einmal, wider heißt gegen.",
    falsch: { wider: "Hier heißt es „noch einmal“: mit ie", wieder: "Hier heißt es „gegen“: nur mit i" },
  },
  lied: {
    tipp: "Kann man es singen? Dann mit ie. Gehört es zum Auge? Dann nur mit i.",
    regel: "Ein Lied singt man, das Lid gehört zum Auge.",
    falsch: { lid: "Ein Lied singt man: mit ie", lied: "Das Lid gehört zum Auge: nur mit i" },
  },
  mal: {
    tipp: "Geht es um ein Essen? Dann mit h. Sonst ohne h.",
    regel: "das Mal ohne h, das Mahl ist ein Essen.",
    falsch: { mahl: "Hier ist kein Essen gemeint: ohne h", mal: "Ein festliches Essen schreibt man mit h" },
  },
  wal: {
    tipp: "Ist es ein Tier? Dann ohne h. Kommt es von wählen? Dann mit h.",
    regel: "Der Wal ist ein Tier, die Wahl kommt von wählen.",
    falsch: { wahl: "Ein Tier im Meer: ohne h", wal: "Es kommt von wählen: mit h" },
  },
  lehre: {
    tipp: "Kommt es von leer? Dann mit ee. Kommt es von lehren? Dann mit eh.",
    regel: "Die Leere kommt von leer, die Lehre von lehren.",
    falsch: { leere: "Die Ausbildung kommt von lehren: mit eh", lehre: "Es kommt von leer: mit ee" },
  },
  seite: {
    tipp: "Gehört es zu einem Instrument? Dann mit ai. Sonst mit ei.",
    regel: "die Seite im Buch, die Saite beim Instrument.",
    falsch: { saite: "Im Buch heißt es: mit ei", seite: "Bei Instrumenten schreibt man es mit ai" },
  },
  end: {
    tipp: "Steckt das Wort Ende darin? Dann mit d wie im Endspiel. Sonst ist es die Vorsilbe mit t wie in entlassen.",
    regel: "end- steckt in Ende, ent- ist eine Vorsilbe.",
    falsch: { ent: "Im Wort steckt das Ende: mit d", end: "Die Vorsilbe ent- hat ein t" },
  },
};
type Gleichklang = { text: string; luecken: [string, string][]; paar: Paar; st?: number };
const G = (text: string, paar: Paar, luecken: [string, string][], st?: number): Gleichklang => ({ text, luecken, paar, st });
const GLEICHKLANG: Gleichklang[] = [
  G("Ihr ___ heute aber früh da.", "seit", [["seid", "seit"]]),
  G("Ich warte schon ___ zehn Minuten auf den Bus.", "seit", [["seit", "seid"]]),
  G("Wo ___ ihr so lange gewesen?", "seit", [["seid", "seit"]]),
  G("___ wann wohnst du in Graz?", "seit", [["Seit", "Seid"]]),
  G("Ihr ___ schon ___ dem Morgen unterwegs.", "seit", [["seid", "seit"], ["seit", "seid"]]),
  G("___ ihr ___ gestern krank?", "seit", [["Seid", "Seit"], ["seit", "seid"]]),
  G("___ leise, das Baby schläft ___ einer Stunde!", "seit", [["Seid", "Seit"], ["seit", "seid"]]),
  G("___ ein paar Tagen ___ ihr wieder gesund.", "seit", [["Seit", "Seid"], ["seid", "seit"]]),
  G("Ihr ___ ja ___ Wochen nicht mehr hier gewesen!", "seit", [["seid", "seit"], ["seit", "seid"]]),
  G("Das ist nicht ___!", "war", [["wahr", "war"]]),
  G("Gestern ___ es sehr kalt.", "war", [["war", "wahr"]]),
  G("Es ___ einmal ein König.", "war", [["war", "wahr"]]),
  G("Es ___ nicht ___, dass er gewonnen hat.", "war", [["war", "wahr"], ["wahr", "war"]]),
  G("Ist es ___, dass Opa früher Lehrer ___?", "war", [["wahr", "war"], ["war", "wahr"]]),
  G("Ich habe heute ___ gelernt.", "viel", [["viel", "fiel"]]),
  G("Das Glas ___ auf den Boden.", "viel", [["fiel", "viel"]]),
  G("Gestern ___ ___ Schnee.", "viel", [["fiel", "viel"], ["viel", "fiel"]]),
  G("Die Katze ___ vom Baum, aber ihr ist nicht ___ passiert.", "viel", [["fiel", "viel"], ["viel", "fiel"]]),
  G("Wir wohnen in einer großen ___.", "statt", [["Stadt", "statt"]]),
  G("___ Saft trinke ich lieber Wasser.", "statt", [["Statt", "Stadt"]]),
  G("Die Feier findet im Turnsaal ___.", "statt", [["statt", "Stadt"]]),
  G("___ mit dem Bus fahren wir mit dem Rad in die ___.", "statt", [["Statt", "Stadt"], ["Stadt", "statt"]]),
  G("In der ___ findet heute ein Fest ___.", "statt", [["Stadt", "statt"], ["statt", "Stadt"]]),
  G("Der Vogel ist leider ___.", "tot", [["tot", "Tod"]]),
  G("Nach dem ___ des alten Königs war das Land traurig.", "tot", [["Tod", "tot"]]),
  G("Der Tierarzt stellte den ___ fest: Der Fisch war ___.", "tot", [["Tod", "tot"], ["tot", "Tod"]]),
  G("Morgen kommt die Oma ___.", "wieder", [["wieder", "wider"]], 1),
  G("Das Essen riecht ___lich.", "wieder", [["wider", "wieder"]], 1),
  G("Ich muss dir leider ___sprechen.", "wieder", [["wider", "wieder"]], 1),
  G("Wir sehen uns bald ___.", "wieder", [["wieder", "wider"]], 1),
  G("Wir singen ein ___.", "lied", [["Lied", "Lid"]], 1),
  G("Mein Augen___ ist geschwollen.", "lied", [["lid", "lied"]], 1),
  G("Das erste ___ war ich mit fünf Jahren am Meer.", "mal", [["Mal", "Mahl"]], 1),
  G("Nach der Hochzeit gab es ein festliches ___.", "mal", [["Mahl", "Mal"]], 1),
  G("Im Meer schwimmt ein riesiger ___.", "wal", [["Wal", "Wahl"]], 1),
  G("Morgen ist die ___ zur Klassensprecherin.", "wal", [["Wahl", "Wal"]], 1),
  G("Er hatte ___esangst.", "tot", [["Tod", "Tot"]], 1),
  G("Mein Bruder macht eine ___ als Tischler.", "lehre", [["Lehre", "Leere"]], 2),
  G("Im Kühlschrank herrscht gähnende ___.", "lehre", [["Leere", "Lehre"]], 2),
  G("Schlag das Buch auf ___ zwölf auf.", "seite", [["Seite", "Saite"]], 2),
  G("An der Gitarre ist eine ___ gerissen.", "seite", [["Saite", "Seite"]], 2),
  G("Das Spiel ist ___lich vorbei.", "end", [["end", "ent"]], 2),
  G("Wir haben im Wald einen Schatz ___deckt.", "end", [["ent", "end"]], 2),
  G("Du musst dich jetzt ___scheiden.", "end", [["ent", "end"]], 2),
  G("Der Film war ___los langweilig.", "end", [["end", "ent"]], 2),
];
const GK_HILFE = "Überleg, was das Wort hier bedeutet. Gleich klingende Wörter schreibt man nach ihrer Bedeutung.";
const gkSatz = (g: Gleichklang): Satz => ({
  titel: "Setz das richtige Wort ein.",
  text: g.text,
  luecken: g.luecken.map(([r, w]) => L(r, [F(w, PAAR[g.paar].falsch[w.toLowerCase()])])),
  regel: PAAR[g.paar].regel,
  hilfe: GK_HILFE,
  tipp: PAAR[g.paar].tipp,
});
/** Die Lücken eines Satzes mit den Buchstaben davor und danach („Augen___“ ist das Wort „Augenlid“). */
const lueckenWoerter = (text: string) => [...text.matchAll(/(\p{L}*)___(\p{L}*)/gu)].map((m) => ({ vor: m[1], nach: m[2] }));
const GLEICHKLANG_F = ausListe(GLEICHKLANG, {
  satz: gkSatz,
  wahlTitel: "Welche Wörter sind richtig?",
  mcListe: GLEICHKLANG.filter((g) => g.luecken.length > 1),
  kurz: (g, rng) => {
    const i = Math.floor(rng() * g.luecken.length);
    const [r, w] = g.luecken[i];
    const wahl = rng() < 0.5 ? `${r}/${w}` : `${w}/${r}`;
    let k = 0;
    const vorlage = g.text.replace(/___/g, () => (k++ === i ? `(${wahl})` : g.luecken[k - 1][0]));
    const { vor, nach } = lueckenWoerter(g.text)[i];
    const ganz = (x: string) => (vor || nach ? [`${vor}${vor ? x.toLowerCase() : x}${nach}`] : []);
    const label = PAAR[g.paar].falsch[w.toLowerCase()];
    return {
      auftrag: "Welches Wort ist richtig? Schreib nur das Wort.",
      vorlage: cap(vorlage),
      richtig: [r, ...ganz(r)],
      fehler: [F(w, label), ...ganz(w).map((x) => F(x, label))],
      regel: PAAR[g.paar].regel,
      hilfe: GK_HILFE,
      tipp: PAAR[g.paar].tipp,
    };
  },
  fix: true,
  fixAuftrag: (n) =>
    n === 1 ? "Im Satz ist ein Wort falsch geschrieben, das gleich klingt wie ein anderes. Schreib den Satz richtig." : "In jedem Satz ist ein gleich klingendes Wort falsch geschrieben. Schreib den Text richtig.",
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- Fremdwörter ----------
// =====================================================================
type FwGruppe = "gr" | "fr" | "en" | "i" | "dd" | "tion";
const FW_TIPP: Record<FwGruppe, string> = {
  gr: "Wörter aus dem Griechischen haben oft ph (gesprochen f), th (gesprochen t), rh und y (gesprochen ü): Phase, Thron, Typ.",
  fr: "Wörter aus dem Französischen behalten ihre Schreibung: Friseur, Etage, Orange.",
  en: "Wörter aus dem Englischen schreibt man wie im Englischen: Team, Cowboy.",
  i: "In vielen Fremdwörtern ist das lange i nur ein i, ohne e: Kino, Benzin, Lineal.",
  dd: "Sprich das Wort langsam: Nach einem kurzen Selbstlaut stehen oft zwei gleiche Mitlaute.",
  tion: "Die Endung -tion spricht man wie -zion, man schreibt sie aber mit t: Station, Nation.",
};
/** Ein Satz mit der schwierigen Stelle in eckigen Klammern: [richtig|falsch|falsch]; dazu falsche Schreibungen des ganzen Worts. */
type Fremdwort = { satz: string; label: string; extra: Fehler[]; g: FwGruppe; st?: number };
const FW = (satz: string, label: string, g: FwGruppe, extra: Fehler[], st?: number): Fremdwort => ({ satz, label, g, extra, st });
const FREMDWOERTER: Fremdwort[] = [
  FW("Am Abend gehen wir ins [Th|T]eater.", "Theater schreibt man mit Th", "gr", [F("Theather", "Das h steht nur am Anfang: Th")]),
  FW("In der Schule haben wir zweimal pro Woche [Ph|F]ysik.", "Physik schreibt man mit Ph", "gr", [F("Phisik", "Nach Ph kommt ein y"), F("Physick", "Am Ende steht nur k")]),
  FW("Im Musikunterricht klatschen wir den Rh[y|ü|i]thmus.", "Rhythmus schreibt man mit y", "gr", [F("Rytmus", "Rhythmus hat zweimal ein h: Rh und th"), F("Rhytmus", "Nach dem y kommt th")]),
  FW("Die Masch[i|ie]ne macht viel Lärm.", "Maschine hat ein langes i ohne e", "i", [F("Machine", "Im Deutschen schreibt man sch")]),
  FW("Mein Bruder spielt Gi[t|tt]arre.", "Gitarre hat nur ein t, aber zwei r", "dd", [F("Gitare", "Gitarre hat zwei r")]),
  FW("Die Ba[tt|t]erie im Handy ist leer.", "Batterie hat zwei t", "dd", [F("Batteri", "Batterie endet auf -ie"), F("Batterrie", "Batterie hat nur ein r")]),
  FW("Das Auto steht in der Gara[g|sch]e.", "Garage schreibt man mit g, gesprochen wie sch", "fr", [F("Garrage", "Garage hat nur ein r")]),
  FW("Heute haben wir zwei Stunden Ma[th|t]ematik.", "Mathematik schreibt man mit th", "gr", [F("Mathematick", "Am Ende steht nur k")]),
  FW("Der Arzt verschreibt eine Medi[z|ts]in.", "Medizin schreibt man mit z", "i", [F("Medizien", "Medizin hat ein langes i ohne e")]),
  FW("Im Zirkus tritt ein [C|K]lown auf.", "Clown schreibt man mit C, wie im Englischen", "en", [F("Claun", "Clown schreibt man mit ow, gesprochen wie au")]),
  FW("Wo ist hier die To[i|a]lette?", "Toilette schreibt man mit oi", "fr", [F("Toilete", "Toilette hat zwei t")]),
  FW("Ich habe großes Inte[r|rr]esse an Tieren.", "Interesse hat nur ein r, aber zwei s", "dd", [F("Intresse", "Nach Int kommt ein e: In-te-res-se"), F("Interese", "Interesse hat zwei s")]),
  FW("Wir holen Hustensaft in der Apo[th|t]eke.", "Apotheke schreibt man mit th", "gr", [F("Apotecke", "Nach dem e steht nur k")]),
  FW("Unser [Th|T]ema heute sind die Planeten.", "Thema schreibt man mit Th", "gr", [F("Thehma", "Thema hat nur ein h, nach dem T")]),
  FW("Mein neuer [C|K]omputer ist sehr schnell.", "Computer schreibt man mit C, wie im Englischen", "en", [F("Compjuter", "Computer schreibt man mit u, gesprochen wie ju")]),
  FW("Wir essen heute in einem Restau[rant|rang].", "Restaurant endet auf -rant, das t spricht man nicht", "fr", [F("Restorant", "Restaurant schreibt man mit au, gesprochen wie o")], 1),
  FW("Meine Tante arbeitet als Ingen[ieur|ör].", "Ingenieur endet auf -ieur", "fr", [F("Inschenieur", "Ingenieur schreibt man mit g, gesprochen wie sch")], 1),
  FW("Das ist deine letzte [Ch|Sch]ance.", "Chance schreibt man mit Ch, gesprochen wie sch", "fr", [F("Chanse", "Chance endet auf -ce")], 1),
  FW("In Ägypten stehen riesige P[y|ü]ramiden.", "Pyramide schreibt man mit y", "gr", [F("Piramiden", "Nach P kommt ein y")], 1),
  FW("Meine Schwester geht ins G[y|ü]mnasium.", "Gymnasium schreibt man mit y", "gr", [F("Gimnasium", "Nach G kommt ein y")], 1),
  FW("Das Gedicht hat drei Stro[ph|f]en.", "Strophe schreibt man mit ph", "gr", [F("Strohphen", "Strophe hat nur das h im ph")], 1),
  FW("Das Erdbeben war eine Katastro[ph|f]e.", "Katastrophe schreibt man mit ph", "gr", [F("Kathastrophe", "Katastrophe hat nur das h im ph")], 1),
  FW("Das Al[ph|f]abet hat 26 Buchstaben.", "Alphabet schreibt man mit ph", "gr", [F("Alphabeth", "Alphabet endet nur auf t")], 1),
  FW("Am Bahnhof gibt es einen Schalter für Informa[t|z]ion.", "Wörter auf -ion schreibt man mit t: -tion", "tion", [F("Informaziohn", "Die Endung -tion hat kein h")], 1),
  FW("Auf dem Jahrmarkt fahren wir mit dem Karu[ss|s]ell.", "Karussell hat zwei s und zwei l", "dd", [F("Karrussell", "Karussell hat nur ein r"), F("Karussel", "Karussell endet auf -ll")], 1),
  FW("Oma kocht Marmelade aus [Rh|R]abarber.", "Rhabarber schreibt man mit Rh", "gr", [F("Rabarba", "Rhabarber: mit Rh und am Ende -er")], 1),
  FW("Das [Th|T]ermometer zeigt zwanzig Grad.", "Thermometer schreibt man mit Th", "gr", [F("Thermometa", "Thermometer endet auf -er")], 1),
  FW("Wir leihen Bücher in der Biblio[th|t]ek aus.", "Bibliothek schreibt man mit th", "gr", [F("Bibliotheck", "Bibliothek endet nur auf k")], 1),
  FW("Auf dem Mars gibt es kaum eine Atmos[ph|f]äre.", "Atmosphäre schreibt man mit ph", "gr", [F("Atmosphere", "Im Deutschen schreibt man -äre"), F("Athmosphäre", "Atmosphäre hat nur das h im ph")], 2),
  FW("Die Straße bekommt neuen As[ph|f]alt.", "Asphalt schreibt man mit ph", "gr", [F("Aspfalt", "Asphalt schreibt man mit ph, nicht pf")], 2),
  FW("Meine Tante hat [Ps|S]ychologie studiert.", "Psychologie schreibt man mit Ps am Anfang", "gr", [F("Psüchologie", "Psychologie schreibt man mit y"), F("Psychologi", "Psychologie endet auf -ie")], 2),
  FW("In [Ph|F]ilosophie reden wir über große Fragen.", "Philosophie schreibt man mit Ph", "gr", [F("Philosofie", "Philosophie hat zweimal ph")], 2),
  FW("Ich habe große S[y|ü]mpathie für sie.", "Sympathie schreibt man mit y", "gr", [F("Sympatie", "Sympathie hat ein th")], 2),
  FW("Auf der Pizza liegen [Ch|Sch]ampignons.", "Champignon schreibt man mit Ch, gesprochen wie sch", "fr", [F("Champinjons", "Champignon schreibt man mit gn, gesprochen wie nj")], 2),
  FW("Die Prüfung hatte ein hohes Niv[eau|o].", "Niveau endet auf -eau, gesprochen wie o", "fr", [F("Niwo", "Niveau schreibt man mit v und -eau")], 2),
];
const FW_HILFE = "Fremdwörter schreibt man oft anders, als man sie spricht. Denk daran, wie das Wort im Buch aussieht.";
/** Das Wort mit der schwierigen Stelle, ihre richtige und falsche Füllung und das ganze Wort, richtig und falsch. */
function fwTeile(w: Fremdwort) {
  const m = /(\p{L}*)\[([^\]]+)\](\p{L}*)/u.exec(w.satz)!;
  const [richtig, ...falsch] = m[2].split("|");
  const wort = `${m[1]}${richtig}${m[3]}`;
  const ganzFalsch = [...falsch.map((x) => F(`${m[1]}${x}${m[3]}`, w.label)), ...w.extra];
  return { m, richtig, falsch, wort, ganzFalsch, mitLuecke: w.satz.replace(`[${m[2]}]`, "___"), ohneWort: w.satz.replace(m[0], "___") };
}
const FREMDWOERTER_F = ausListe(FREMDWOERTER, {
  satz: (w) => {
    const t = fwTeile(w);
    return { titel: "Ergänze die fehlenden Buchstaben.", text: t.mitLuecke, luecken: [L(t.richtig, t.falsch.map((x) => F(x, w.label)))], regel: `${w.label}.`, hilfe: FW_HILFE, tipp: FW_TIPP[w.g] };
  },
  wahl: (w) => {
    const t = fwTeile(w);
    return { titel: "Welche Schreibung ist richtig?", text: t.ohneWort, richtig: t.wort, falsch: t.ganzFalsch, regel: `${w.label}.`, hilfe: FW_HILFE, tipp: FW_TIPP[w.g] };
  },
  kurz: (w, rng) => {
    const t = fwTeile(w);
    const gezeigt = pick(rng, t.ganzFalsch);
    return {
      auftrag: "Das Wort ist falsch geschrieben. Schreib es richtig.",
      vorlage: gezeigt.answer,
      richtig: [t.wort],
      fehler: [F(gezeigt.answer, `Noch nicht verbessert: ${gezeigt.label}`), ...t.ganzFalsch.filter((x) => x !== gezeigt)],
      regel: `${w.label}.`,
      hilfe: FW_HILFE,
      tipp: FW_TIPP[w.g],
    };
  },
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fremdwort falsch geschrieben. Schreib den Satz richtig." : "In jedem Satz ist ein Fremdwort falsch geschrieben. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});
// Fehler korrigieren: das ganze Wort ist falsch geschrieben, nicht nur die Stelle
FREMDWOERTER_F.fix = (rng, st) => {
  const w = waehle(rng, FREMDWOERTER, st);
  const t = fwTeile(w);
  return { titel: "", text: t.ohneWort, luecken: [L(t.wort, t.ganzFalsch)], regel: `${w.label}.`, hilfe: FW_HILFE, tipp: FW_TIPP[w.g] };
};

// =====================================================================
// ---------- Adjektive steigern und vergleichen ----------
// =====================================================================
type StGruppe = "umlaut" | "regel" | "eigen" | "hoch" | "esten" | "nah" | "vergleich" | "endung";
const ST_TIPP: Record<StGruppe, string> = {
  umlaut: "Kurze Adjektive mit a, o oder u bekommen beim Steigern oft einen Umlaut: arm, ärmer, am ärmsten.",
  regel: "Hänge -er an für den Vergleich und -sten für den ersten Platz von allen, wie bei leise: leiser, am leisesten.",
  eigen: "Ein paar Adjektive haben ganz eigene Formen. Die muss man auswendig lernen.",
  hoch: "Achtung: hoch verliert beim Vergleich das c, im Superlativ ist es wieder da.",
  esten: "Endet das Adjektiv auf d, t, s, ß oder z, kommt vor -sten noch ein e: wild, am wildesten.",
  nah: "Bei nah kommt im Superlativ ein ch dazu.",
  vergleich: "Sind beide gleich, sagst du so … wie. Ist einer mehr, sagst du -er als.",
  endung: "Nach der, die, das endet das Adjektiv auf -e: der stärkste Mann.",
};
const ST_REGEL: Record<StGruppe, string> = {
  umlaut: "Beim Steigern bekommt dieses Adjektiv einen Umlaut.",
  regel: "Vergleich mit als: -er. Der erste Platz von allen: am …-sten.",
  eigen: "Dieses Adjektiv hat eigene Formen.",
  hoch: "hoch, höher, am höchsten.",
  esten: "Nach d, t, s, ß und z kommt -esten.",
  nah: "nah, näher, am nächsten.",
  vergleich: "Gleich: so … wie. Ungleich: -er als.",
  endung: "Nach der, die, das endet das Adjektiv auf -e.",
};
const ST_MEHR = "Im Deutschen nicht mit mehr: hänge -er an";
const ST_SUP = "Das ist der erste Platz von allen. Für den Vergleich mit als: -er";
const ST_EINMAL = "Nur einmal -er";
const ST_GRUND = "Beim Vergleich mit als brauchst du die Form mit -er";
const ST_EIGEN = (a: string) => `${a} hat eigene Formen, die man auswendig lernt`;
type Steigerung = { satz: string; cue?: string; r: string[]; f: Fehler[]; g: StGruppe; st?: number };
const S = (satz: string, cue: string | undefined, r: string | string[], g: StGruppe, f: Fehler[], st?: number): Steigerung => ({ satz, cue, r: typeof r === "string" ? [r] : r, g, f, st });
const STEIGERUNG: Steigerung[] = [
  S("Ein Elefant ist ___ als eine Maus.", "groß", "größer", "umlaut", [F("großer", UML("o", "ö")), F("mehr groß", ST_MEHR, NICHT_FIX), F("größter", ST_SUP)]),
  S("Mein Bruder ist ___ als ich.", "alt", "älter", "umlaut", [F("alter", UML("a", "ä")), F("mehr alt", ST_MEHR, NICHT_FIX), F("ältester", ST_SUP)]),
  S("Heute ist es ___ als gestern.", "kalt", "kälter", "umlaut", [F("kalter", UML("a", "ä")), F("mehr kalt", ST_MEHR, NICHT_FIX), F("kältester", ST_SUP)]),
  S("Ein Auto fährt ___ als ein Fahrrad.", "schnell", "schneller", "regel", [F("mehr schnell", ST_MEHR, NICHT_FIX), F("schnellerer", ST_EINMAL), F("schnell", ST_GRUND)]),
  S("Eine Schnecke ist ___ als ein Hase.", "langsam", "langsamer", "regel", [F("mehr langsam", ST_MEHR, NICHT_FIX), F("langsamerer", ST_EINMAL), F("langsam", ST_GRUND)]),
  S("Mein Zimmer ist ___ als deins.", "klein", "kleiner", "regel", [F("mehr klein", ST_MEHR, NICHT_FIX), F("kleinerer", ST_EINMAL), F("klein", ST_GRUND)]),
  S("Im Winter sind die Tage ___ als im Sommer.", "kurz", "kürzer", "umlaut", [F("kurzer", UML("u", "ü")), F("mehr kurz", ST_MEHR, NICHT_FIX), F("kürzester", ST_SUP)]),
  S("Die Donau ist ___ als die Mur.", "lang", "länger", "umlaut", [F("langer", UML("a", "ä")), F("mehr lang", ST_MEHR, NICHT_FIX), F("längster", ST_SUP)]),
  S("Lena läuft am ___ von allen.", "schnell", "schnellsten", "regel", [F("schnellesten", "Nach ll kommt nur -sten"), F("schneller", "Beim ersten Platz von allen: am …-sten"), F("schnellste", "Nach am endet es auf -sten")]),
  S("Eis esse ich am ___.", "gern", "liebsten", "eigen", [F("gernsten", ST_EIGEN("gern")), F("gernesten", ST_EIGEN("gern")), F("lieber", "Das ist der Vergleich mit als. Beim ersten Platz von allen: am …-sten")]),
  S("Pizza schmeckt mir ___ als Suppe.", "gut", "besser", "eigen", [F("guter", ST_EIGEN("gut")), F("güter", ST_EIGEN("gut")), F("mehr gut", ST_MEHR, NICHT_FIX)]),
  S("Das ist das ___ Buch, das ich kenne.", "gut", "beste", "eigen", [F("guteste", ST_EIGEN("gut")), F("gutste", ST_EIGEN("gut")), F("bessere", "Das ist der Vergleich. Für den ersten Platz von allen: der, die, das …-ste", NICHT_FIX)]),
  S("Der Großglockner ist der ___ Berg Österreichs.", "hoch", "höchste", "hoch", [F("hochste", UML("o", "ö")), F("höhste", "Im Superlativ von hoch steht wieder ch"), F("höchster", "Nach der endet das Adjektiv hier auf -e")]),
  S("Tim ist so groß ___ Lena.", undefined, "wie", "vergleich", [F("als", "Sind beide gleich (so …), steht wie"), F("als wie", "Nur ein Wort: so … wie", NICHT_FIX)]),
  S("Tim ist größer ___ Lena.", undefined, "als", "vergleich", [F("wie", "Nach der Form mit -er steht als"), F("als wie", "Nur ein Wort: größer als", NICHT_FIX)]),
  S("Mein Hund ist genauso alt ___ deiner.", undefined, "wie", "vergleich", [F("als", "Sind beide gleich (genauso …), steht wie"), F("als wie", "Nur ein Wort: genauso … wie", NICHT_FIX)]),
  S("Heute ist es wärmer ___ gestern.", undefined, "als", "vergleich", [F("wie", "Nach der Form mit -er steht als"), F("als wie", "Nur ein Wort: wärmer als", NICHT_FIX)]),
  S("Der Gepard ist das ___ Landtier.", "schnell", "schnellste", "endung", [F("schnellster", "Nach das endet das Adjektiv hier auf -e"), F("schnelleste", "Nach ll kommt nur -ste"), F("schnellere", "Für den ersten Platz von allen: …-ste", NICHT_FIX)]),
  S("Ich habe ___ Hunger als du.", "viel", "mehr", "eigen", [F("vieler", ST_EIGEN("viel")), F("mehrer", "mehr bekommt keine Endung"), F("vieles", ST_EIGEN("viel"))], 1),
  S("Jupiter ist der ___ Planet.", "groß", "größte", "endung", [F("großte", UML("o", "ö")), F("größeste", "Nach ß kommt hier nur -te"), F("größter", "Nach der endet das Adjektiv hier auf -e")], 1),
  S("Unser Haus ist am ___ von allen.", "alt", "ältesten", "esten", [F("altesten", UML("a", "ä")), F("ältsten", "Nach t kommt -esten"), F("älter", "Beim ersten Platz von allen: am …-sten")], 1),
  S("Die Aufgabe ist ___ als gedacht.", "schwer", "schwerer", "regel", [F("mehr schwer", ST_MEHR, NICHT_FIX), F("schwerrer", "Nur ein r vor dem -er"), F("schwer", ST_GRUND)], 1),
  S("Mia singt am ___ in der Klasse.", "laut", "lautesten", "esten", [F("lautsten", "Nach t kommt -esten"), F("lauter", "Beim ersten Platz von allen: am …-sten"), F("laut", "Beim ersten Platz von allen: am …-sten")], 1),
  S("Heuer gab es ___ Schnee als im letzten Jahr.", "wenig", "weniger", "regel", [F("mehr wenig", ST_MEHR, NICHT_FIX), F("wenig", ST_GRUND), F("wenigerer", ST_EINMAL)], 1),
  S("Heute war der ___ Tag des Jahres.", "heiß", "heißeste", "esten", [F("heißte", "Nach ß kommt -este"), F("heißester", "Nach der endet das Adjektiv hier auf -e"), F("heißere", "Für den ersten Platz von allen: …-ste", NICHT_FIX)], 2),
  S("Von allen Wegen ist dieser der ___.", "kurz", "kürzeste", "esten", [F("kurzeste", UML("u", "ü")), F("kürzste", "Nach z kommt -este"), F("kürzere", "Für den ersten Platz von allen: …-ste", NICHT_FIX)], 2),
  S("Wir gehen zum ___ Bäcker.", "nah", "nächsten", "nah", [F("nahsten", UML("a", "ä")), F("nähsten", "Im Superlativ von nah steht ch"), F("näheren", "Für den ersten Platz von allen: …-sten", NICHT_FIX)], 2),
];
/** Kurzantwort: die zwei Steigerungsformen eines Adjektivs. */
type Formen = { a: string; k: string; s: string; f: Fehler[]; g: StGruppe; st?: number };
const SF = (a: string, k: string, s: string, g: StGruppe, f: [string, string][], st?: number): Formen => ({ a, k, s, g, f: f.map(([x, l]) => F(x, l)), st });
const ST_FORMEN: Formen[] = [
  SF("groß", "größer", "größten", "umlaut", [["großer, am großten", UML("o", "ö")], ["mehr groß, am meisten groß", ST_MEHR]]),
  SF("alt", "älter", "ältesten", "umlaut", [["alter, am altesten", UML("a", "ä")], ["mehr alt, am meisten alt", ST_MEHR]]),
  SF("kalt", "kälter", "kältesten", "umlaut", [["kalter, am kaltesten", UML("a", "ä")], ["kälter, am kältsten", "Nach t kommt -esten"]]),
  SF("schnell", "schneller", "schnellsten", "regel", [["mehr schnell, am meisten schnell", ST_MEHR], ["schneller, am schnellesten", "Nach ll kommt nur -sten"]]),
  SF("klein", "kleiner", "kleinsten", "regel", [["mehr klein, am meisten klein", ST_MEHR], ["kleiner, am kleinesten", "Nach n kommt nur -sten"]]),
  SF("kurz", "kürzer", "kürzesten", "umlaut", [["kurzer, am kurzesten", UML("u", "ü")], ["kürzer, am kürzsten", "Nach z kommt -esten"]]),
  SF("lang", "länger", "längsten", "umlaut", [["langer, am langsten", UML("a", "ä")], ["mehr lang, am meisten lang", ST_MEHR]]),
  SF("warm", "wärmer", "wärmsten", "umlaut", [["warmer, am warmsten", UML("a", "ä")], ["mehr warm, am meisten warm", ST_MEHR]]),
  SF("langsam", "langsamer", "langsamsten", "regel", [["mehr langsam, am meisten langsam", ST_MEHR], ["langsamer, am langsamesten", "Nach m kommt nur -sten"]]),
  SF("leicht", "leichter", "leichtesten", "esten", [["leichter, am leichtsten", "Nach t kommt -esten"], ["mehr leicht, am meisten leicht", ST_MEHR]]),
  SF("schwer", "schwerer", "schwersten", "regel", [["mehr schwer, am meisten schwer", ST_MEHR], ["schwerer, am schweresten", "Nach r kommt nur -sten"]]),
  SF("klug", "klüger", "klügsten", "umlaut", [["kluger, am klugsten", UML("u", "ü")], ["mehr klug, am meisten klug", ST_MEHR]]),
  SF("gut", "besser", "besten", "eigen", [["guter, am gutesten", ST_EIGEN("gut")], ["besser, am bessersten", ST_EIGEN("gut")]], 1),
  SF("viel", "mehr", "meisten", "eigen", [["vieler, am vielsten", ST_EIGEN("viel")], ["mehr, am mehrsten", ST_EIGEN("viel")]], 1),
  SF("gern", "lieber", "liebsten", "eigen", [["gerner, am gernsten", ST_EIGEN("gern")], ["lieber, am liebersten", ST_EIGEN("gern")]], 1),
  SF("laut", "lauter", "lautesten", "esten", [["lauter, am lautsten", "Nach t kommt -esten"], ["mehr laut, am meisten laut", ST_MEHR]], 1),
  SF("hoch", "höher", "höchsten", "hoch", [["hocher, am hochsten", "hoch bekommt einen Umlaut und verliert beim Vergleich das c"], ["höcher, am höchsten", "Beim Vergleich fällt das c weg"]], 2),
  SF("nah", "näher", "nächsten", "nah", [["naher, am nahsten", UML("a", "ä")], ["näher, am nähsten", "Im Superlativ von nah steht ch"]], 2),
  SF("heiß", "heißer", "heißesten", "esten", [["heißer, am heißsten", "Nach ß kommt -esten"], ["mehr heiß, am meisten heiß", ST_MEHR]], 2),
];
const ST_HILFE = "Für den Vergleich mit als hängst du -er an. Für den ersten Platz von allen sagst du am …-sten.";
const STEIGERUNG_F = ausListe(STEIGERUNG, {
  satz: (s) => ({ titel: s.cue ? "Setz das Adjektiv in der richtigen Form ein." : "Setz wie oder als ein.", text: s.satz, luecken: [L(s.r, s.f, s.cue)], regel: ST_REGEL[s.g], hilfe: ST_HILFE, tipp: ST_TIPP[s.g] }),
  wahlTitel: "Was ist richtig?",
  kurz: (_s, rng) => {
    const x = pick(rng, ST_FORMEN.filter((y) => (y.st ?? 0) <= 2));
    return {
      auftrag: "Steigere das Adjektiv. Schreib beide Formen mit Beistrich, zum Beispiel: leiser, am leisesten.",
      vorlage: x.a,
      richtig: [`${x.k}, am ${x.s}`, `${x.k} am ${x.s}`],
      fehler: x.f,
      regel: `${x.a}, ${x.k}, am ${x.s}.`,
      hilfe: ST_HILFE,
      tipp: ST_TIPP[x.g],
    };
  },
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Fehler beim Steigern oder Vergleichen. Schreib den Satz richtig." : "In jedem Satz ist ein Fehler beim Steigern oder Vergleichen. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});
// Kurzantwort nach Stufe: die Formen haben ihre eigenen Stufen
STEIGERUNG_F.kurz = (rng, st) => {
  const x = waehle(rng, ST_FORMEN, st);
  return {
    auftrag: "Steigere das Adjektiv. Schreib beide Formen mit Beistrich, zum Beispiel: leiser, am leisesten.",
    vorlage: x.a,
    richtig: [`${x.k}, am ${x.s}`, `${x.k} am ${x.s}`],
    fehler: x.f,
    regel: `${x.a}, ${x.k}, am ${x.s}.`,
    hilfe: ST_HILFE,
    tipp: ST_TIPP[x.g],
  };
};

// =====================================================================
// ---------- Zusammengesetzte Nomen: Grundwort und Bestimmungswort ----------
// =====================================================================
type Zusammen = { best: string; grund: string; wort: string; fuge?: [string, string]; st?: number };
const Z = (best: string, grund: string, wort: string, st?: number, fuge?: [string, string]): Zusammen => ({ best, grund, wort, st, fuge });
const ZUSAMMEN: Zusammen[] = [
  Z("das Haus", "die Tür", "Haustür"),
  Z("der Apfel", "der Baum", "Apfelbaum"),
  Z("die Schule", "die Tasche", "Schultasche", 0, ["Schuletasche", "Das e von Schule fällt hier weg"]),
  Z("das Kind", "der Garten", "Kindergarten", 0, ["Kindgarten", "Hier kommt -er zwischen die Teile"]),
  Z("die Sonne", "die Blume", "Sonnenblume", 0, ["Sonneblume", "Hier kommt ein n zwischen die Teile"]),
  Z("der Hund", "die Hütte", "Hundehütte", 0, ["Hundhütte", "Hier kommt ein e zwischen die Teile"]),
  Z("das Fenster", "das Brett", "Fensterbrett"),
  Z("der Winter", "die Jacke", "Winterjacke"),
  Z("die Hand", "der Schuh", "Handschuh"),
  Z("das Wasser", "die Flasche", "Wasserflasche"),
  Z("der Fuß", "der Ball", "Fußball"),
  Z("das Rad", "der Weg", "Radweg"),
  Z("der Zahn", "die Bürste", "Zahnbürste"),
  Z("der Schnee", "der Mann", "Schneemann"),
  Z("der Tisch", "die Lampe", "Tischlampe"),
  Z("das Haus", "der Schuh", "Hausschuh"),
  Z("die Geburt", "der Tag", "Geburtstag", 1, ["Geburttag", "Hier kommt ein s zwischen die Teile"]),
  Z("die Arbeit", "der Platz", "Arbeitsplatz", 1, ["Arbeitplatz", "Hier kommt ein s zwischen die Teile"]),
  Z("der Bleistift", "der Spitzer", "Bleistiftspitzer", 1),
  Z("das Auto", "der Schlüssel", "Autoschlüssel", 1),
  Z("die Schule", "der Hof", "Schulhof", 1, ["Schulehof", "Das e von Schule fällt hier weg"]),
  Z("der Hals", "das Tuch", "Halstuch", 1),
  Z("der Kopf", "das Kissen", "Kopfkissen", 1),
  Z("der Mittag", "das Essen", "Mittagessen", 1),
  Z("die Liebe", "der Brief", "Liebesbrief", 2, ["Liebebrief", "Hier kommt ein s zwischen die Teile"]),
  Z("schreiben", "der Tisch", "Schreibtisch", 2, ["Schreibentisch", "Vom Verb bleibt nur der Stamm"]),
  Z("schwimmen", "das Bad", "Schwimmbad", 2, ["Schwimmenbad", "Vom Verb bleibt nur der Stamm"]),
  Z("groß", "die Stadt", "Großstadt", 2, ["Großestadt", "Vom Adjektiv bleibt nur der Stamm"]),
  Z("fahren", "das Rad", "Fahrrad", 2, ["Fahrenrad", "Vom Verb bleibt nur der Stamm"]),
];
const ARTIKEL3 = ["der", "die", "das"];
const artikelVon = (x: string) => (ARTIKEL3.includes(x.split(" ")[0]) ? x.split(" ")[0] : null);
const ohneArtikel = (x: string) => (artikelVon(x) ? x.split(" ").slice(1).join(" ") : x);
const ZS_HILFE = "Das Grundwort ist der letzte Teil des Wortes. Von ihm kommt der Artikel. Das Bestimmungswort steht vorne und sagt, was für ein Ding es ist.";
const ZS_TIPP = "Frag: Was ist es? Ein Gartentor ist ein Tor, darum heißt es das Gartentor.";
const ZS_TIPP_FUGE = "Sprich das Wort laut. Hörst du ein s, ein n oder ein e zwischen den Teilen? Wie bei das Schwein und der Braten: der Schweinebraten.";
const ZS_ART_BEST = "Das ist der Artikel vom Bestimmungswort. Der Artikel kommt vom Grundwort, dem letzten Teil";
const ZS_ART = "Schau auf das Grundwort, den letzten Teil des Wortes";
function zsFehler(z: Zusammen): Fehler[] {
  const art = artikelVon(z.grund)!;
  const bestArt = artikelVon(z.best);
  return [
    ...ARTIKEL3.filter((a) => a !== art).map((a) => F(`${a} ${z.wort}`, a === bestArt ? ZS_ART_BEST : ZS_ART)),
    F(`${art} ${cap(ohneArtikel(z.best))} ${ohneArtikel(z.grund)}`, "Zusammengesetzte Nomen schreibt man in einem Wort"),
    ...(z.fuge ? [F(`${art} ${z.fuge[0]}`, z.fuge[1])] : []),
    F(z.wort, "Schreib den Artikel dazu"),
  ];
}
const zsRegel = (z: Zusammen) => `${z.best} + ${z.grund} = ${artikelVon(z.grund)} ${z.wort}: Der Artikel kommt vom Grundwort.`;
const ZUSAMMENSETZUNG_F = ausListe(ZUSAMMEN, {
  satz: (z) => ({
    titel: "Bilde aus den zwei Wörtern ein Nomen. Schreib den Artikel dazu.",
    text: `${z.best} + ${z.grund} = ___`,
    luecken: [L(`${artikelVon(z.grund)} ${z.wort}`, zsFehler(z))],
    regel: zsRegel(z),
    hilfe: ZS_HILFE,
    tipp: z.fuge ? ZS_TIPP_FUGE : ZS_TIPP,
  }),
  wahl: (z, rng) => {
    const art = artikelVon(z.grund)!;
    const bestArt = artikelVon(z.best);
    if (rng() < 0.5)
      return {
        titel: "Welcher Artikel passt zum zusammengesetzten Nomen?",
        text: `___ ${z.wort}`,
        richtig: art,
        falsch: ARTIKEL3.filter((a) => a !== art).map((a) => F(a, a === bestArt ? ZS_ART_BEST : ZS_ART)),
        regel: zsRegel(z),
        hilfe: ZS_HILFE,
        tipp: ZS_TIPP,
      };
    const grund = ohneArtikel(z.grund);
    return {
      titel: "Was ist das Grundwort?",
      text: z.wort,
      richtig: grund,
      falsch: [F(cap(ohneArtikel(z.best)), "Das ist das Bestimmungswort. Es steht vorne und sagt, was für ein Ding es ist"), F(z.wort, "Das ist das ganze Wort. Das Grundwort ist sein letzter Teil")],
      regel: zsRegel(z),
      hilfe: ZS_HILFE,
      tipp: ZS_TIPP,
    };
  },
  kurz: (z) => {
    const art = artikelVon(z.grund)!;
    const bestArt = artikelVon(z.best);
    const grund = ohneArtikel(z.grund);
    return {
      auftrag: "Schreib das Grundwort mit seinem Artikel.",
      vorlage: z.wort,
      richtig: [z.grund],
      fehler: [
        F(bestArt ? z.best : cap(z.best), "Das ist das Bestimmungswort. Das Grundwort ist der letzte Teil"),
        F(grund, "Schreib den Artikel dazu"),
        ...ARTIKEL3.filter((a) => a !== art).map((a) => F(`${a} ${grund}`, "Schau, welcher Artikel zum Grundwort selbst passt")),
      ],
      regel: zsRegel(z),
      hilfe: ZS_HILFE,
      tipp: ZS_TIPP,
    };
  },
  standard: "mc",
  bestimmen: true,
});

// =====================================================================
// ---------- Wörter ableiten: Nachsilben ----------
// =====================================================================
type AbGruppe = "heit" | "keit" | "igkeit" | "ung" | "nis" | "schaft" | "ig" | "lich" | "isch" | "bar" | "sam";
const AB_TIPP: Record<AbGruppe, string> = {
  heit: "Bei vielen Adjektiven kommt -heit dazu, wie bei schön: die Schönheit.",
  keit: "Endet das Adjektiv auf -lich, -ig, -bar oder -sam, kommt -keit dazu, wie bei einsam: die Einsamkeit.",
  igkeit: "Bei manchen Adjektiven kommt -igkeit dazu, wie bei müde: die Müdigkeit.",
  ung: "Aus vielen Verben wird mit -ung ein Nomen, wie bei wohnen: die Wohnung.",
  nis: "Mit -nis wird ein Nomen daraus, am Ende mit nur einem s, wie beim Zeugnis.",
  schaft: "Mit -schaft wird aus einer Person eine Gruppe oder Beziehung, wie bei Mann: die Mannschaft.",
  ig: "Mit -ig wird aus einem Nomen ein Adjektiv, wie bei Salz: salzig.",
  lich: "Mit -lich wird aus einem Nomen ein Adjektiv, oft mit Umlaut, wie bei Herbst: herbstlich.",
  isch: "Bei Ländern kommt -isch dazu, wie bei Spanien: spanisch.",
  bar: "Mit -bar heißt es: Man kann es tun, wie bei essen: essbar.",
  sam: "Mit -sam heißt es: Man tut es gern oder oft, wie bei folgen: folgsam.",
};
type Ableitung = { satz: string; basis: string; ziel: "Nomen" | "Adjektiv"; r: string; f: Fehler[]; g: AbGruppe; st?: number };
const A = (satz: string, basis: string, ziel: Ableitung["ziel"], r: string, g: AbGruppe, f: Fehler[], st?: number): Ableitung => ({ satz, basis, ziel, r, g, f, st });
const AB_UNG = "Mit -ung werden Verben zu Nomen, hier passt eine andere Nachsilbe";
const AB_HEIT = (b: string) => `Bei ${b} passt -heit`;
const AB_KEIT = "Nach -lich, -ig, -bar und -sam kommt -keit";
const AB_T = "Die Nachsilben -heit und -keit enden auf t";
const ABLEITUNG: Ableitung[] = [
  A("Die ___ ist ein wichtiges Recht.", "frei", "Nomen", "Freiheit", "heit", [F("Freikeit", AB_HEIT("frei")), F("Freiung", AB_UNG), F("Freiheid", AB_T)]),
  A("Danke für deine ___.", "freundlich", "Nomen", "Freundlichkeit", "keit", [F("Freundlichheit", AB_KEIT), F("Freundlichung", AB_UNG), F("Freundlichkeid", AB_T)]),
  A("Die ___ dauert zwei Stunden.", "prüfen", "Nomen", "Prüfung", "ung", [F("Prüfheit", "Aus einem Verb wird mit -ung ein Nomen"), F("Prüfnis", "Aus einem Verb wird mit -ung ein Nomen"), F("Prüfunk", "Die Nachsilbe -ung endet auf g")]),
  A("Unsere ___ hält schon viele Jahre.", "Freund", "Nomen", "Freundschaft", "schaft", [F("Freundheit", "Bei Personen passt -schaft"), F("Freundschafft", "-schaft hat nur ein f"), F("Freundung", AB_UNG)]),
  A("Das ist ein großes ___.", "geheim", "Nomen", "Geheimnis", "nis", [F("Geheimniss", "-nis hat am Ende nur ein s"), F("Geheimheit", "Hier passt -nis"), F("Geheimung", AB_UNG)]),
  A("Ich habe eine andere ___.", "meinen", "Nomen", "Meinung", "ung", [F("Meinheit", "Aus einem Verb wird mit -ung ein Nomen"), F("Meinnis", "Aus einem Verb wird mit -ung ein Nomen"), F("Meinunk", "Die Nachsilbe -ung endet auf g")]),
  A("Der Film war sehr ___.", "Lust", "Adjektiv", "lustig", "ig", [F("lustlich", "Bei Lust passt -ig"), F("lustich", "Die Nachsilbe -ig endet auf g"), F("lustisch", "Bei Lust passt -ig")]),
  A("Heute ist es ___.", "Sonne", "Adjektiv", "sonnig", "ig", [F("sonnlich", "Bei Sonne passt -ig"), F("sonnich", "Die Nachsilbe -ig endet auf g"), F("sonig", "Sonne hat zwei n")]),
  A("Der Hund ist sehr ___.", "Freund", "Adjektiv", "freundlich", "lich", [F("freundig", "Bei Freund passt -lich"), F("freundlig", "Die Nachsilbe -lich endet auf ch"), F("freundisch", "Bei Freund passt -lich")]),
  A("Das Wasser aus dem Brunnen ist ___.", "trinken", "Adjektiv", "trinkbar", "bar", [F("trinklich", "Man kann es trinken: -bar"), F("trinkig", "Man kann es trinken: -bar"), F("trinkbahr", "-bar hat kein h")]),
  A("Nach dem Regen ist die Straße ___.", "Schmutz", "Adjektiv", "schmutzig", "ig", [F("schmutzlich", "Bei Schmutz passt -ig"), F("schmutzich", "Die Nachsilbe -ig endet auf g"), F("schmuzig", "Schmutz schreibt man mit tz")]),
  A("Das Kind ist sehr ___.", "Angst", "Adjektiv", "ängstlich", "lich", [F("angstlich", UML("a", "ä")), F("ängstig", "Bei Angst passt -lich"), F("ängstlig", "Die Nachsilbe -lich endet auf ch")]),
  A("Mit großer ___ hat sie geantwortet.", "sicher", "Nomen", "Sicherheit", "heit", [F("Sicherkeit", AB_HEIT("sicher")), F("Sicherung", "Eine Sicherung ist etwas anderes, zum Beispiel im Stromkasten", NICHT_FIX), F("Sicherheid", AB_T)]),
  A("Ihre ___ hat alle überrascht.", "ehrlich", "Nomen", "Ehrlichkeit", "keit", [F("Ehrlichheit", AB_KEIT), F("Ehrlichkeid", AB_T), F("Ehrlichung", AB_UNG)]),
  A("Der Ausflug war ein tolles ___.", "erleben", "Nomen", "Erlebnis", "nis", [F("Erlebniss", "-nis hat am Ende nur ein s"), F("Erlebung", "Hier passt -nis"), F("Erlebheit", "Hier passt -nis")]),
  A("Heute essen wir ___.", "Italien", "Adjektiv", "italienisch", "isch", [F("italienlich", "Bei Ländern passt -isch"), F("italisch", "Der ganze Name bleibt: italien-isch"), F("italienich", "Die Nachsilbe -isch endet auf sch")], 1),
  A("Mein Opa ist sehr ___.", "sparen", "Adjektiv", "sparsam", "sam", [F("sparig", "Wer gern spart, ist -sam"), F("sparbar", "Wer gern spart, ist -sam"), F("sparsahm", "-sam hat kein h")], 1),
  A("Klettern ohne Seil ist ___.", "Gefahr", "Adjektiv", "gefährlich", "lich", [F("gefahrlich", UML("a", "ä")), F("gefährig", "Bei Gefahr passt -lich"), F("gefährlig", "Die Nachsilbe -lich endet auf ch")], 1),
  A("Im Zeugnis zählt auch die ___.", "pünktlich", "Nomen", "Pünktlichkeit", "keit", [F("Pünktlichheit", AB_KEIT), F("Pünktlichung", AB_UNG), F("Pünktlichkeid", AB_T)], 1),
  A("Alle bewundern die ___ der alten Frau.", "klug", "Nomen", "Klugheit", "heit", [F("Klugkeit", AB_HEIT("klug")), F("Klugung", AB_UNG), F("Klugheid", AB_T)], 1),
  A("Die Aufgabe ist leicht ___.", "lösen", "Adjektiv", "lösbar", "bar", [F("lösig", "Man kann sie lösen: -bar"), F("lösbahr", "-bar hat kein h"), F("lösisch", "Man kann sie lösen: -bar")], 1),
  A("Die ___ der Wohnung hat lange gedauert.", "renovieren", "Nomen", "Renovierung", "ung", [F("Renovierheit", "Aus einem Verb wird mit -ung ein Nomen"), F("Renovierunk", "Die Nachsilbe -ung endet auf g")], 1),
  A("Der Vortrag war sehr ___.", "Langeweile", "Adjektiv", "langweilig", "ig", [F("langweilich", "Die Nachsilbe -ig endet auf g"), F("langeweilig", "Vom e am Ende fällt etwas weg: lang-weil-ig"), F("langweilisch", "Hier passt -ig")], 1),
  A("Am Berg ist es heute sehr ___.", "Wind", "Adjektiv", "windig", "ig", [F("windlich", "Bei Wind passt -ig"), F("windich", "Die Nachsilbe -ig endet auf g"), F("windisch", "Bei Wind passt -ig")], 1),
  A("Mit ___ hat sie die Aufgabe gelöst.", "leicht", "Nomen", "Leichtigkeit", "igkeit", [F("Leichtheit", "Bei leicht passt -igkeit"), F("Leichtkeit", "Bei leicht passt -igkeit"), F("Leichtung", AB_UNG)], 2),
  A("Nach der Wanderung spürte er große ___.", "müde", "Nomen", "Müdigkeit", "igkeit", [F("Müdeheit", "Bei müde passt -igkeit"), F("Müdekeit", "Bei müde passt -igkeit"), F("Müdung", AB_UNG)], 2),
];
// müde ist im Tipp das Beispiel: dort steht für Müdigkeit ein anderes
AB_TIPP.igkeit = "Bei manchen Adjektiven kommt -igkeit dazu, wie bei genau: die Genauigkeit.";
const AB_HILFE = "Hänge eine Nachsilbe an. Nomen bekommen -heit, -keit, -ung, -nis oder -schaft, Adjektive -ig, -lich, -isch, -bar oder -sam.";
const abArtikel = (r: string) => (/nis$/.test(r) ? "das" : "die");
const ABLEITUNG_F = ausListe(ABLEITUNG, {
  satz: (a) => ({ titel: "Bilde aus dem Wort in Klammern ein neues Wort und setz es ein.", text: a.satz, luecken: [L(a.r, a.f, `${a.basis}, ${a.ziel}`)], regel: `${a.basis}: ${a.r}.`, hilfe: AB_HILFE, tipp: AB_TIPP[a.g] }),
  wahlTitel: "Welches Wort ist richtig gebildet?",
  kurz: (a) => ({
    auftrag: `Bilde aus dem Wort ${a.ziel === "Nomen" ? "ein Nomen" : "ein Adjektiv"} mit einer Nachsilbe.`,
    vorlage: a.basis,
    richtig: a.ziel === "Nomen" ? [a.r, `${abArtikel(a.r)} ${a.r}`] : [a.r],
    fehler: a.f,
    regel: `${a.basis}: ${a.r}.`,
    hilfe: AB_HILFE,
    tipp: AB_TIPP[a.g],
  }),
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz ist ein Wort mit der falschen Nachsilbe gebildet. Schreib den Satz richtig." : "In jedem Satz ist ein Wort falsch gebildet. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- Redewendungen und Sprichwörter ----------
// =====================================================================
const RW_WOERTLICH = "Das ist wörtlich genommen. Eine Redewendung meint man im übertragenen Sinn";
const RW_PASST = "Das passt nicht. Stell dir vor, wann man das sagt";
const RW_WORT = "Die Redewendung heißt anders. Lern sie als Ganzes";
type Redewendung = { satz: string; r: string; falschWoerter: string[]; wendung: string; bedeutung: string; falsch: [string, "w" | "p"][]; st?: number };
const RW = (satz: string, r: string, falschWoerter: string[], wendung: string, bedeutung: string, falsch: [string, "w" | "p"][], st?: number): Redewendung => ({ satz, r, falschWoerter, wendung, bedeutung, falsch, st });
const REDEWENDUNGEN: Redewendung[] = [
  RW("Siehst du das nicht? Hast du ___ auf den Augen?", "Tomaten", ["Gurken", "Erdbeeren"], "Tomaten auf den Augen haben", "etwas nicht sehen, das ganz nah ist", [["rote Augen vom Weinen haben", "w"], ["sehr müde sein", "p"], ["gern Gemüse essen", "w"]]),
  RW("Das glaube ich nicht! Du willst mir einen ___ aufbinden.", "Bären", ["Hund", "Bär"], "jemandem einen Bären aufbinden", "jemandem eine Lüge erzählen", [["jemandem ein Stofftier schenken", "w"], ["jemandem beim Anziehen helfen", "p"], ["jemanden fesseln", "w"]]),
  RW("Morgen schreibe ich die Schularbeit. Drückst du mir die ___?", "Daumen", ["Finger", "Hände"], "jemandem die Daumen drücken", "jemandem Glück wünschen", [["jemandem wehtun", "w"], ["jemandem die Hand geben", "p"], ["jemanden ärgern", "p"]]),
  RW("Dein ständiges Pfeifen geht mir auf den ___!", "Wecker", ["Uhr", "Kopf"], "jemandem auf den Wecker gehen", "jemanden nerven", [["jemanden aufwecken", "w"], ["jemanden besuchen", "p"], ["jemandem eine Uhr schenken", "w"]]),
  RW("Der Bus war noch da. Da habe ich ___ gehabt!", "Schwein", ["Hund", "Kuh"], "Schwein haben", "Glück haben", [["ein Haustier haben", "w"], ["schmutzig sein", "w"], ["Pech haben", "p"]]),
  RW("Mit deiner Antwort hast du den ___ auf den Kopf getroffen.", "Nagel", ["Hammer", "Ball"], "den Nagel auf den Kopf treffen", "genau das Richtige sagen", [["sich mit dem Hammer verletzen", "w"], ["einen Fehler machen", "p"], ["laut schreien", "p"]]),
  RW("Endlich hat er die ___ aus dem Sack gelassen: Wir fahren ans Meer!", "Katze", ["Maus", "Hund"], "die Katze aus dem Sack lassen", "ein Geheimnis verraten", [["ein Tier befreien", "w"], ["etwas verstecken", "p"], ["einkaufen gehen", "p"]]),
  RW("Red nicht um den heißen ___ herum, sag es einfach!", "Brei", ["Topf", "Tee"], "um den heißen Brei herumreden", "nicht direkt sagen, worum es geht", [["beim Essen reden", "w"], ["zu laut reden", "p"], ["über das Kochen reden", "w"]]),
  RW("Ich kaufe ein und hole dabei Oma ab. So schlage ich zwei ___ mit einer Klappe.", "Fliegen", ["Mücken", "Vögel"], "zwei Fliegen mit einer Klappe schlagen", "zwei Dinge auf einmal erledigen", [["Insekten fangen", "w"], ["etwas zweimal machen", "p"], ["eine Tür zuschlagen", "w"]]),
  RW("Schieb deine Hausübung nicht auf die lange ___!", "Bank", ["Bahn", "Tisch"], "etwas auf die lange Bank schieben", "etwas immer wieder verschieben", [["Möbel verrücken", "w"], ["sich ausruhen", "p"], ["etwas sofort erledigen", "p"]]),
  RW("„Diesmal drücke ich noch ein ___ zu“, sagt die Lehrerin.", "Auge", ["Ohr", "Lid"], "ein Auge zudrücken", "nicht so streng sein", [["einschlafen", "w"], ["jemandem zuzwinkern", "w"], ["besonders streng sein", "p"]]),
  RW("Mit diesem Satz hast du nur noch ___ ins Feuer gegossen.", "Öl", ["Wasser", "Sand"], "Öl ins Feuer gießen", "einen Streit noch schlimmer machen", [["ein Feuer löschen", "p"], ["kochen", "w"], ["einen Streit beenden", "p"]]),
  RW("Als sie die Nachricht hörte, fiel sie aus allen ___.", "Wolken", ["Himmeln", "Wolke"], "aus allen Wolken fallen", "sehr überrascht sein", [["aus einem Flugzeug springen", "w"], ["hinfallen", "w"], ["schlechte Laune haben", "p"]]),
  RW("Lügen haben kurze ___.", "Beine", ["Arme", "Ohren"], "Lügen haben kurze Beine", "Lügen kommen schnell heraus", [["Lügner sind klein", "w"], ["Lügen sind lustig", "p"], ["Lügen sind schnell erzählt", "p"]]),
  RW("Heute ist Papa mit dem linken ___ zuerst aufgestanden.", "Fuß", ["Bein", "Arm"], "mit dem linken Fuß zuerst aufstehen", "schlechte Laune haben", [["früh aufstehen", "p"], ["hinken", "w"], ["sich verletzen", "w"]]),
  RW("Ich hatte ein ___ vor dem Kopf, mir fiel die Lösung nicht ein.", "Brett", ["Holz", "Buch"], "ein Brett vor dem Kopf haben", "etwas nicht verstehen", [["Kopfweh haben", "p"], ["an einer Wand stehen", "w"], ["sehr klug sein", "p"]]),
  RW("Morgenstund hat ___ im Mund.", "Gold", ["Brot", "Silber"], "Morgenstund hat Gold im Mund", "Wer früh aufsteht, schafft viel", [["Zum Frühstück isst man viel", "p"], ["Am Morgen ist man müde", "p"], ["Morgens soll man Zähne putzen", "w"]], 1),
  RW("Vor der Prüfung sagt Opa: „Hals- und ___!“", "Beinbruch", ["Armbruch", "Fußbruch"], "Hals- und Beinbruch!", "Viel Glück", [["Pass auf, dass du dich nicht verletzt", "w"], ["Gute Besserung", "p"], ["Du bist selbst schuld", "p"]], 1),
];
const RW_HILFE = "Eine Redewendung meint man nicht wörtlich. Denk an eine Situation, in der man sie sagt.";
const rwSatz = (r: Redewendung): Satz => ({
  titel: "Welches Wort fehlt in der Redewendung?",
  text: r.satz,
  luecken: [L(r.r, r.falschWoerter.map((w) => F(w, RW_WORT)))],
  regel: `„${r.wendung}“ heißt: ${r.bedeutung}.`,
  hilfe: RW_HILFE,
  tipp: `Gemeint ist: ${r.bedeutung}.`,
});
const REDEWENDUNGEN_F = ausListe(REDEWENDUNGEN, {
  satz: rwSatz,
  wahl: (r) => ({
    titel: "Was bedeutet die Redewendung?",
    text: `„${r.wendung}“`,
    richtig: r.bedeutung,
    falsch: r.falsch.map(([x, k]) => F(x, k === "w" ? RW_WOERTLICH : RW_PASST)),
    regel: `„${r.wendung}“ heißt: ${r.bedeutung}.`,
    hilfe: RW_HILFE,
    tipp: "Stell dir vor, wer das zu wem sagt. Ist es ein Vorwurf, ein Wunsch oder eine Überraschung?",
  }),
  kurz: (r) => ({
    auftrag: "Welches Wort fehlt in der Redewendung? Schreib es.",
    vorlage: `${r.wendung.replace(r.r, "…")} (Bedeutung: ${r.bedeutung})`,
    richtig: [r.r],
    fehler: r.falschWoerter.map((w) => F(w, RW_WORT)),
    regel: `„${r.wendung}“ heißt: ${r.bedeutung}.`,
    hilfe: RW_HILFE,
    tipp: "Sag die ganze Redewendung laut. Welches Wort hast du schon oft darin gehört?",
  }),
  standard: "mc",
  bestimmen: true,
});

// =====================================================================
// ---------- Befehlsform (Imperativ) ----------
// =====================================================================
type ImpGruppe = "ei" | "reg" | "aum" | "t" | "sein" | "ihr" | "sie";
const IMP_TIPP: Record<ImpGruppe, string> = {
  ei: "Ändert sich bei du das e zu i oder ie (du trittst), dann auch in der Befehlsform, ohne Endung: tritt!",
  reg: "Die Befehlsform für du ist der Stamm des Verbs, oft mit -e: kauf! oder kaufe!",
  aum: "Bekommt ein Verb bei du einen Umlaut (du trägst), hat die Befehlsform keinen: trag!",
  t: "Endet der Stamm auf t, d oder n wie bei reden, bleibt das -e: rede!",
  sein: "sein ist unregelmäßig. Merk dir die Befehlsformen für du, ihr und Sie.",
  ihr: "Für ihr nimmst du die ihr-Form ohne ihr, wie bei tragen: ihr tragt, also tragt!",
  sie: "Für Sie: zuerst das Verb in der Grundform, dann Sie, wie bei tragen: Tragen Sie!",
};
const IMP = {
  ei: "Ändert sich bei du das e zu i oder ie, ändert es sich auch in der Befehlsform",
  st: "Die Befehlsform hat keine Endung -st",
  er: "Das ist die Form für er, sie, es",
  du: "Das ist die Befehlsform für du",
  ihr: "Das ist die Befehlsform für ihr",
  grund: "Das ist die Grundform",
  aum: "In der Befehlsform bekommt das Verb keinen Umlaut",
  t: "Endet der Stamm auf t, d oder n, bleibt das -e",
  ihrT: "Bei ihr kommt -et dazu, weil der Stamm auf t, d oder n endet",
  sieOrd: "In der Befehlsform steht das Verb vorne",
};
type Befehl = { satz: string; cue: string; r: string[]; f: Fehler[]; g: ImpGruppe; st?: number };
const B = (satz: string, cue: string, r: string | string[], g: ImpGruppe, f: Fehler[], st?: number): Befehl => ({ satz, cue, r: typeof r === "string" ? [r] : r, g, f, st });
// Die du- und ihr-Sätze haben ein dein oder euer: so ist auch ohne Klammer klar, wer gemeint ist
const BEFEHLE: Befehl[] = [
  B("___ deine Nachricht noch einmal!", "lesen, du", "Lies", "ei", [F("Lese", IMP.ei), F("Liest", IMP.st), F("Lest", IMP.ihr, NICHT_FIX)]),
  B("___ eure Nachrichten noch einmal!", "lesen, ihr", "Lest", "ihr", [F("Lies", IMP.du, NICHT_FIX), F("Liest", IMP.er), F("Lesen", IMP.grund)]),
  B("___ mir bitte dein Heft!", "geben, du", "Gib", "ei", [F("Gebe", IMP.ei), F("Gibst", IMP.st), F("Geb", IMP.ei)]),
  B("___ mir bitte eure Hefte!", "geben, ihr", "Gebt", "ihr", [F("Gibt", IMP.er), F("Gib", IMP.du, NICHT_FIX), F("Geben", IMP.grund)]),
  B("___ dir ein Stück Kuchen!", "nehmen, du", "Nimm", "ei", [F("Nehme", IMP.ei), F("Nimmst", IMP.st), F("Nehm", IMP.ei)]),
  B("___ euch ein Stück Kuchen!", "nehmen, ihr", "Nehmt", "ihr", [F("Nimmt", IMP.er), F("Nimm", IMP.du, NICHT_FIX), F("Nehmen", IMP.grund)]),
  B("___ deiner Schwester beim Tragen!", "helfen, du", "Hilf", "ei", [F("Helfe", IMP.ei), F("Hilfst", IMP.st), F("Helf", IMP.ei)]),
  B("___ eurer Schwester beim Tragen!", "helfen, ihr", "Helft", "ihr", [F("Hilft", IMP.er), F("Hilf", IMP.du, NICHT_FIX), F("Helfen", IMP.grund)]),
  B("___ bitte mit deinem Lehrer!", "sprechen, du", "Sprich", "ei", [F("Spreche", IMP.ei), F("Sprichst", IMP.st), F("Sprech", IMP.ei)]),
  B("___ deinen Teller leer!", "essen, du", "Iss", "ei", [F("Esse", IMP.ei), F("Isst", IMP.st), F("Ess", IMP.ei)]),
  B("___ eure Teller leer!", "essen, ihr", "Esst", "ihr", [F("Isst", "Das ist die Form für du und für er, sie, es"), F("Iss", IMP.du, NICHT_FIX), F("Essen", IMP.grund)]),
  B("___ deine Jacke nicht!", "vergessen, du", "Vergiss", "ei", [F("Vergesse", IMP.ei), F("Vergisst", IMP.st), F("Vergess", IMP.ei)]),
  B("___ deinen Müll in den Mistkübel!", "werfen, du", "Wirf", "ei", [F("Werfe", IMP.ei), F("Wirfst", IMP.st), F("Werf", IMP.ei)]),
  B("___ dir das Bild genau an!", "ansehen, du", ["Sieh", "Siehe"], "ei", [F("Sehe", IMP.ei), F("Siehst", IMP.st), F("Seh", IMP.ei)]),
  B("___ doch mit deinem Bruder!", "spielen, du", ["Spiel", "Spiele"], "reg", [F("Spielst", IMP.st), F("Spielt", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX), F("Spielen", IMP.grund)]),
  B("___ doch mit eurem Bruder!", "spielen, ihr", "Spielt", "ihr", [F("Spiel", IMP.du, NICHT_FIX), F("Spielen", IMP.grund), F("Spielst", "Das ist die Form für du")]),
  B("___ deinen Tee aus!", "trinken, du", ["Trink", "Trinke"], "reg", [F("Trinkst", IMP.st), F("Trinken", IMP.grund), F("Trinkt", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)]),
  B("___ euren Tee aus!", "trinken, ihr", "Trinkt", "ihr", [F("Trink", IMP.du, NICHT_FIX), F("Trinken", IMP.grund), F("Trinkst", "Das ist die Form für du")]),
  B("___ deinen Namen auf das Blatt!", "schreiben, du", ["Schreib", "Schreibe"], "reg", [F("Schreibst", IMP.st), F("Schreiben", IMP.grund), F("Schreibt", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)]),
  B("___ euren Namen auf das Blatt!", "schreiben, ihr", "Schreibt", "ihr", [F("Schreib", IMP.du, NICHT_FIX), F("Schreiben", IMP.grund), F("Schreibst", "Das ist die Form für du")]),
  B("___ bitte langsamer mit deinem Rad!", "fahren, du", ["Fahr", "Fahre"], "aum", [F("Fähr", IMP.aum), F("Fährst", IMP.st), F("Fährt", IMP.er)], 1),
  B("___ schneller, dein Bus kommt gleich!", "laufen, du", ["Lauf", "Laufe"], "aum", [F("Läuf", IMP.aum), F("Läufst", IMP.st), F("Läuft", IMP.er)], 1),
  B("___ gut in deinem neuen Bett!", "schlafen, du", ["Schlaf", "Schlafe"], "aum", [F("Schläf", IMP.aum), F("Schläfst", IMP.st), F("Schläft", IMP.er)], 1),
  B("___ bitte langsamer mit euren Rädern!", "fahren, ihr", "Fahrt", "ihr", [F("Fährt", IMP.er), F("Fahr", IMP.du, NICHT_FIX), F("Fahren", IMP.grund)], 1),
  B("___ bitte auf deine Schwester!", "warten, du", "Warte", "t", [F("Wart", IMP.t), F("Wartest", IMP.st), F("Wartet", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)], 1),
  B("___ bitte auf eure Schwester!", "warten, ihr", "Wartet", "ihr", [F("Wart", IMP.ihrT), F("Warte", IMP.du, NICHT_FIX), F("Warten", IMP.grund)], 1),
  B("___ bitte dein Fenster!", "öffnen, du", "Öffne", "t", [F("Öffn", IMP.t), F("Öffnest", IMP.st), F("Öffnet", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)], 1),
  B("___ den Fehler in deinem Satz!", "finden, du", ["Finde", "Find"], "t", [F("Findest", IMP.st), F("Finden", IMP.grund), F("Findet", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)], 1),
  B("___ in ganzen Sätzen auf deinem Blatt!", "antworten, du", "Antworte", "t", [F("Antwort", "Antwort ist ein Nomen. Endet der Stamm auf t, bleibt das -e"), F("Antwortest", IMP.st), F("Antwortet", "Das ist die Form für er, sie, es und für ihr", NICHT_FIX)], 1),
  B("___ bitte leise, deine Schwester schläft!", "sein, du", "Sei", "sein", [F("Bist", "Das ist das Präsens. Die Befehlsform von sein heißt anders"), F("Sein", IMP.grund), F("Seid", IMP.ihr, NICHT_FIX)], 1),
  B("___ bitte leise, eure Schwester schläft!", "sein, ihr", "Seid", "sein", [F("Seit", "seit mit t sagt etwas über die Zeit. Die Befehlsform von sein hat ein d"), F("Sei", IMP.du, NICHT_FIX), F("Sind", "Das ist das Präsens für wir und sie")], 1),
  B("___ bitte Platz!", "nehmen, Sie", "Nehmen Sie", "sie", [F("Nimm", IMP.du, NICHT_FIX), F("Nehmt", IMP.ihr, NICHT_FIX), F("Sie nehmen", IMP.sieOrd, NICHT_FIX)], 2),
  B("___ bitte hier!", "warten, Sie", "Warten Sie", "sie", [F("Warte", IMP.du, NICHT_FIX), F("Wartet", IMP.ihr, NICHT_FIX), F("Sie warten", IMP.sieOrd, NICHT_FIX)], 2),
  B("___ bitte pünktlich!", "sein, Sie", "Seien Sie", "sein", [F("Sind Sie", "Sind Sie … ist eine Frage. Die Befehlsform von sein für Sie heißt anders", NICHT_FIX), F("Sei", IMP.du, NICHT_FIX), F("Seid", IMP.ihr, NICHT_FIX)], 2),
  B("___ bitte den Text!", "lesen, Sie", "Lesen Sie", "sie", [F("Lies", IMP.du, NICHT_FIX), F("Lest", IMP.ihr, NICHT_FIX), F("Sie lesen", IMP.sieOrd, NICHT_FIX)], 2),
  B("___ mir bitte!", "helfen, Sie", "Helfen Sie", "sie", [F("Hilf", IMP.du, NICHT_FIX), F("Helft", IMP.ihr, NICHT_FIX), F("Sie helfen", IMP.sieOrd, NICHT_FIX)], 2),
];
const IMP_HILFE = "Die Befehlsform für du hat kein du und keine Endung -st. Die für ihr ist die ihr-Form ohne ihr.";
const impRegel = (b: Befehl) => `Befehlsform von ${b.cue.split(", ")[0]} für ${b.cue.split(", ")[1]}: ${b.r.join(" oder ")}!`;
const IMPERATIV_F = ausListe(BEFEHLE, {
  satz: (b) => ({ titel: "Setz die Befehlsform ein.", text: b.satz, luecken: [L(b.r, b.f, b.cue)], regel: impRegel(b), hilfe: IMP_HILFE, tipp: IMP_TIPP[b.g] }),
  wahlTitel: "Welche Befehlsform ist richtig?",
  kurz: (b) => {
    const [inf, wer] = b.cue.split(", ");
    return { auftrag: `Bilde die Befehlsform für ${wer}.`, vorlage: inf, richtig: b.r, fehler: b.f, regel: impRegel(b), hilfe: IMP_HILFE, tipp: IMP_TIPP[b.g] };
  },
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz ist die Befehlsform falsch. Schreib den Satz richtig." : "In jedem Satz ist eine Befehlsform falsch. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- Konjunktiv II ----------
// =====================================================================
type K2Gruppe = "uml" | "wuerde" | "reg" | "verg";
const K2_TIPP: Record<K2Gruppe, string> = {
  uml: "Nimm die Mitvergangenheit und setz einen Umlaut darauf, wo es geht, wie bei tragen: trug, trüge.",
  wuerde: "Den Konjunktiv II von werden bildest du aus der Mitvergangenheit mit Umlaut.",
  reg: "Bei regelmäßigen Verben sieht der Konjunktiv II aus wie die Mitvergangenheit. Darum nimmt man oft würde und die Grundform.",
  verg: "Die Vergangenheit im Konjunktiv II bildet man mit hätte oder wäre und dem Partizip, wie bei gehen: wäre gegangen.",
};
const K2 = {
  praet: "Das ist die Mitvergangenheit. Für den Konjunktiv II kommt ein Umlaut dazu",
  praetE: "Das ist die Mitvergangenheit. Für den Konjunktiv II kommt ein -e dazu",
  praes: "Das ist das Präsens. Ein Wunsch, eine Bedingung oder eine höfliche Bitte steht im Konjunktiv II",
  k1: "Das ist der Konjunktiv I, den nimmt man für die indirekte Rede",
  wh: "Bei haben nimmt man die eigene Form, nicht würde",
  ws: "Bei sein nimmt man die eigene Form, nicht würde",
  du: "Die Form passt zu du, nicht zu ich",
  ich: "Die Form passt zu ich, nicht zu dieser Person",
  ihr: "Die Form passt zu ihr, nicht zu du",
};
type Konj = { text: string; luecken: Luecke[]; g: K2Gruppe; st?: number };
const KJ = (text: string, g: K2Gruppe, luecken: Luecke[], st?: number): Konj => ({ text, g, luecken, st });
const KONJUNKTIV2: Konj[] = [
  KJ("Wenn ich Zeit ___, würde ich dir helfen.", "uml", [L("hätte", [F("hatte", K2.praet), F("habe", K2.k1), F("würde haben", K2.wh, NICHT_FIX)], "haben")]),
  KJ("Wenn ich reich ___, würde ich eine Weltreise machen.", "uml", [L("wäre", [F("war", K2.praet), F("bin", K2.praes), F("würde sein", K2.ws, NICHT_FIX)], "sein")]),
  KJ("Ich ___ gern ein Eis.", "uml", [L("möchte", [F("mochte", K2.praet, NICHT_FIX), F("mag", K2.praes, NICHT_FIX), F("möge", K2.k1)], "mögen")]),
  KJ("___ du mir bitte das Salz geben?", "uml", [L("Könntest", [F("Konntest", K2.praet, NICHT_FIX), F("Kannst", K2.praes, NICHT_FIX), F("Könnest", K2.k1)], "können")]),
  KJ("An deiner Stelle ___ ich das nicht machen.", "wuerde", [L("würde", [F("wurde", K2.praet), F("werde", K2.praes, NICHT_FIX), F("würdest", K2.du)], "werden")]),
  KJ("Er tut so, als ob er alles ___.", "uml", [L(["wüsste", "wisse"], [F("wusste", K2.praet, NICHT_FIX), F("weiß", "Nach als ob steht der Konjunktiv, nicht das Präsens", NICHT_FIX), F("wüßte", "Nach dem kurzen ü schreibt man ss")], "wissen")]),
  KJ("Ich ___ gern mehr Zeit für meine Hobbys.", "uml", [L("hätte", [F("hatte", K2.praet, NICHT_FIX), F("habe", K2.praes, NICHT_FIX), F("würde haben", K2.wh, NICHT_FIX)], "haben")]),
  KJ("Du ___ mehr schlafen.", "uml", [L("solltest", [F("sollst", K2.praes, NICHT_FIX), F("solltet", K2.ihr), F("sollest", K2.k1)], "sollen")]),
  KJ("Wenn ich du ___, würde ich das Angebot annehmen.", "uml", [L("wäre", [F("war", K2.praet), F("wärst", "Die Form passt zu du. Hier ist ich gemeint: Wenn ich …"), F("bin", K2.praes)], "sein")]),
  KJ("Es ___ schön, wenn du kommen würdest.", "uml", [L("wäre", [F("war", K2.praet), F("ist", K2.praes, NICHT_FIX), F("würde sein", K2.ws, NICHT_FIX)], "sein")]),
  KJ("___ Sie mir bitte helfen?", "uml", [L("Könnten", [F("Konnten", K2.praet, NICHT_FIX), F("Können", K2.praes, NICHT_FIX), F("Könnest", "Die Form passt zu du, nicht zu Sie")], "können")]),
  KJ("Wenn ich fliegen ___, würde ich über die Berge fliegen.", "uml", [L("könnte", [F("konnte", K2.praet), F("kann", K2.praes), F("könne", K2.k1)], "können")]),
  KJ("Wenn wir mehr Geld ___, würden wir ein Haus kaufen.", "uml", [L("hätten", [F("hatten", K2.praet), F("haben", K2.praes), F("hätte", "Die Form passt zu ich, nicht zu wir")], "haben")]),
  KJ("Wenn es heute nicht ___, würden wir baden gehen.", "reg", [L(["regnete", "regnen würde"], [F("regnet", K2.praes), F("regne", K2.k1), F("regnen wird", "Das ist die Zukunft (Futur)", NICHT_FIX)], "regnen")]),
  KJ("Ich ___ an deiner Stelle zum Arzt gehen.", "uml", [L("müsste", [F("musste", K2.praet, NICHT_FIX), F("muss", K2.praes, NICHT_FIX), F("müsse", K2.k1)], "müssen")], 1),
  KJ("Wenn ich früher aufgestanden ___, hätte ich den Bus erwischt.", "verg", [L("wäre", [F("war", K2.praet), F("bin", K2.praes), F("hätte", "Bei aufstehen bildet man die Vergangenheit mit sein")], "sein")], 1),
  KJ("Wenn du mich gefragt ___, hätte ich dir geholfen.", "verg", [L("hättest", [F("hattest", K2.praet), F("hätte", K2.ich), F("hast", K2.praes)], "haben")], 1),
  KJ("Ohne deine Hilfe ___ ich das nie geschafft.", "verg", [L("hätte", [F("hatte", K2.praet, NICHT_FIX), F("habe", K2.praes, NICHT_FIX), F("würde haben", K2.wh, NICHT_FIX)], "haben")], 1),
  KJ("Wenn ich das gewusst ___, wäre ich gekommen.", "verg", [L("hätte", [F("hatte", K2.praet), F("habe", K2.praes), F("wäre", "Bei wissen bildet man die Vergangenheit mit haben")], "haben")], 1),
  KJ("Ich ___ dir gern helfen, aber ich habe keine Zeit.", "wuerde", [L("würde", [F("wurde", K2.praet, NICHT_FIX), F("werde", K2.praes, NICHT_FIX), F("würdest", K2.du)], "werden")], 1),
  KJ("Wenn ich ein Vogel ___, ___ ich zu dir fliegen.", "uml", [L("wäre", [F("war", K2.praet), F("bin", K2.praes)], "sein"), L("würde", [F("wurde", K2.praet), F("werde", K2.praes)], "werden")], 2),
  KJ("Das ___ ich nie gedacht!", "verg", [L("hätte", [F("hatte", K2.praet, NICHT_FIX), F("habe", K2.praes, NICHT_FIX), F("würde haben", K2.wh, NICHT_FIX)], "haben")], 2),
  KJ("Wenn es nicht so kalt ___, ___ wir draußen spielen.", "uml", [L("wäre", [F("war", K2.praet), F("ist", K2.praes)], "sein"), L("könnten", [F("konnten", K2.praet), F("können", K2.praes)], "können")], 2),
];
type K2Form = { vorlage: string; r: string[]; f: Fehler[]; g: K2Gruppe; st?: number };
const KF = (vorlage: string, r: string[], f: Fehler[], g: K2Gruppe = "uml", st?: number): K2Form => ({ vorlage, r, f, g, st });
const K2_FORMEN: K2Form[] = [
  KF("ich habe", ["ich hätte", "hätte"], [F("ich hatte", K2.praet), F("ich würde haben", K2.wh)]),
  KF("du bist", ["du wärst", "wärst", "du wärest", "wärest"], [F("du warst", K2.praet), F("du würdest sein", K2.ws)]),
  KF("er kann", ["er könnte", "könnte"], [F("er konnte", K2.praet), F("er könne", K2.k1)]),
  KF("wir haben", ["wir hätten", "hätten"], [F("wir hatten", K2.praet)]),
  KF("ich weiß", ["ich wüsste", "wüsste"], [F("ich wusste", K2.praet), F("ich würde wissen", "Bei wissen nimmt man die eigene Form")]),
  KF("du musst", ["du müsstest", "müsstest"], [F("du musstest", K2.praet)]),
  KF("es gibt", ["es gäbe", "gäbe"], [F("es gab", K2.praet)]),
  KF("ihr seid", ["ihr wärt", "wärt", "ihr wäret", "wäret"], [F("ihr wart", K2.praet)]),
  KF("ich mag", ["ich möchte", "möchte"], [F("ich mochte", K2.praet)]),
  KF("er darf", ["er dürfte", "dürfte"], [F("er durfte", K2.praet)]),
  KF("sie wird", ["sie würde", "würde"], [F("sie wurde", K2.praet)], "wuerde"),
  KF("wir sind", ["wir wären", "wären"], [F("wir waren", K2.praet)]),
  KF("du hast", ["du hättest", "hättest"], [F("du hattest", K2.praet)]),
  KF("sie geht", ["sie ginge", "ginge", "sie würde gehen"], [F("sie ging", K2.praetE), F("sie gehte", "gehen ist unregelmäßig: ging, ginge")], "uml", 1),
  KF("ich soll", ["ich sollte", "sollte"], [F("ich solle", K2.k1)], "uml", 1),
  KF("er tut", ["er täte", "täte", "er würde tun"], [F("er tat", K2.praet)], "uml", 2),
  KF("ich bleibe", ["ich bliebe", "bliebe", "ich würde bleiben"], [F("ich blieb", K2.praetE)], "uml", 2),
  KF("wir kommen", ["wir kämen", "kämen", "wir würden kommen"], [F("wir kamen", K2.praet)], "uml", 2),
];
const K2_HILFE = "Der Konjunktiv II steht bei Wünschen, Bedingungen (wenn …) und höflichen Bitten. Bilde ihn aus der Mitvergangenheit, oft mit Umlaut.";
const K2_REGEL = "Wunsch, Bedingung oder höfliche Bitte: Konjunktiv II.";
const KONJUNKTIV2_F = ausListe(KONJUNKTIV2, {
  satz: (k) => ({ titel: "Setz das Verb im Konjunktiv II ein.", text: k.text, luecken: k.luecken, regel: K2_REGEL, hilfe: K2_HILFE, tipp: K2_TIPP[k.g] }),
  wahlTitel: "Welche Form ist der Konjunktiv II?",
  kurz: (k) => ({ auftrag: "", vorlage: k.text, richtig: [], fehler: [], regel: "", hilfe: "", tipp: "" }),
  fix: true,
  fixAuftrag: (n) =>
    n === 1 ? "Der Satz soll im Konjunktiv II stehen. Ein Verb stimmt nicht. Schreib den Satz richtig." : "Die Sätze sollen im Konjunktiv II stehen. In jedem Satz stimmt ein Verb nicht. Schreib den Text richtig.",
  standard: "cloze",
  bestimmen: false,
});
KONJUNKTIV2_F.kurz = (rng, st) => {
  const k = waehle(rng, K2_FORMEN, st);
  return { auftrag: "Schreib die Form im Konjunktiv II.", vorlage: k.vorlage, richtig: k.r, fehler: k.f, regel: `${k.vorlage}: ${k.r[0]}.`, hilfe: K2_HILFE, tipp: K2_TIPP[k.g] };
};

// =====================================================================
// ---------- Indirekte Rede ----------
// =====================================================================
type IrGruppe = "k1" | "ersatz" | "pers" | "verg";
const IR_TIPP: Record<IrGruppe, string> = {
  k1: "Den Konjunktiv I bildest du aus dem Stamm der Grundform und -e: er schreibe, sie gehe. Nur sein ist anders.",
  ersatz: "Sieht der Konjunktiv I gleich aus wie der Indikativ (sie geben), nimm den Konjunktiv II.",
  pers: "Wer spricht? Aus ich wird in der indirekten Rede er oder sie, aus wir wird sie.",
  verg: "Die Vergangenheit in der indirekten Rede bildest du mit habe oder sei und dem Partizip: er sei gegangen.",
};
const IR = {
  ind: "In der indirekten Rede steht der Konjunktiv I, nicht der Indikativ",
  k2: "Den Konjunktiv II nimmt man nur, wenn der Konjunktiv I gleich aussieht wie der Indikativ",
  pers: "Die Person ändert sich: aus ich wird er oder sie",
  grund: "Das ist die Grundform",
  ersatz: "Der Konjunktiv I sieht hier aus wie der Indikativ. Dann nimmt man den Konjunktiv II",
  praet: "Das ist die Mitvergangenheit oder der Konjunktiv II. Hier passt der Konjunktiv I",
};
/** wer sagt: „direkt“; indirekt mit Lücken („sie ___ müde“); dass: dieselbe Rede mit dass, die Lücken am Ende. */
type Rede = { wer: string; sagt: string; direkt: string; ind: string; dass?: string; luecken: Luecke[]; g: IrGruppe; st?: number };
const RD = (wer: string, sagt: string, direkt: string, ind: string, dass: string | undefined, g: IrGruppe, luecken: Luecke[], st?: number): Rede => ({ wer, sagt, direkt, ind, dass, g, luecken, st });
const REDEN: Rede[] = [
  RD("Lena", "sagt", "Ich bin müde.", "sie ___ müde", "sie müde ___", "k1", [L("sei", [F("ist", IR.ind), F("wäre", IR.k2, NICHT_FIX), F("bin", IR.pers)])]),
  RD("Jonas", "sagt", "Ich habe Hunger.", "er ___ Hunger", "er Hunger ___", "k1", [L("habe", [F("hat", IR.ind), F("hätte", IR.k2, NICHT_FIX)])]),
  RD("Die Lehrerin", "sagt", "Der Test ist leicht.", "der Test ___ leicht", "der Test leicht ___", "k1", [L("sei", [F("ist", IR.ind), F("wäre", IR.k2, NICHT_FIX)])]),
  RD("Mia", "erzählt", "Ich komme morgen.", "sie ___ morgen", "sie morgen ___", "k1", [L("komme", [F("kommt", IR.ind), F("käme", IR.k2, NICHT_FIX), F("komm", "Beim Konjunktiv I fehlt hier das -e")])]),
  RD("Paul", "meint", "Ich kann gut schwimmen.", "er ___ gut schwimmen", "er gut schwimmen ___", "k1", [L("könne", [F("kann", IR.ind), F("könnte", IR.k2, NICHT_FIX), F("können", IR.grund)])]),
  RD("Emma", "sagt", "Ich muss noch lernen.", "sie ___ noch lernen", "sie noch lernen ___", "k1", [L("müsse", [F("muss", IR.ind), F("müsste", IR.k2, NICHT_FIX), F("musst", "Das ist die Form für du")])]),
  RD("Felix", "behauptet", "Ich weiß die Antwort.", "er ___ die Antwort", "er die Antwort ___", "k1", [L("wisse", [F("weiß", IR.ind), F("wüsste", IR.k2, NICHT_FIX), F("wissen", IR.grund)])]),
  RD("Sarah", "sagt", "Ich habe das Buch gelesen.", "sie ___ das Buch gelesen", "sie das Buch gelesen ___", "verg", [L("habe", [F("hat", IR.ind), F("hätte", IR.k2, NICHT_FIX)])]),
  RD("Der Trainer", "sagt", "Das Spiel beginnt um drei Uhr.", "das Spiel ___ um drei Uhr", "das Spiel um drei Uhr ___", "k1", [L("beginne", [F("beginnt", IR.ind), F("begänne", IR.k2, NICHT_FIX)])]),
  RD("Laura", "sagt", "Ich will Tierärztin werden.", "sie ___ Tierärztin werden", "sie Tierärztin werden ___", "k1", [L("wolle", [F("will", IR.ind), F("wollte", IR.praet, NICHT_FIX)])]),
  RD("Ben", "sagt", "Ich spiele gern Fußball.", "er ___ gern Fußball", "er gern Fußball ___", "k1", [L("spiele", [F("spielt", IR.ind), F("spielte", IR.praet, NICHT_FIX)])]),
  RD("Die Zeitung", "schreibt", "Der Winter wird kalt.", "der Winter ___ kalt", "der Winter kalt ___", "k1", [L("werde", [F("wird", IR.ind), F("würde", IR.k2, NICHT_FIX)])]),
  RD("Opa", "erzählt", "Ich bin in Linz geboren.", "er ___ in Linz geboren", "er in Linz geboren ___", "verg", [L("sei", [F("ist", IR.ind), F("wäre", IR.k2, NICHT_FIX), F("bin", IR.pers)])]),
  RD("Die Ärztin", "sagt", "Das Kind hat Fieber.", "das Kind ___ Fieber", "das Kind Fieber ___", "k1", [L("habe", [F("hat", IR.ind), F("hätte", IR.k2, NICHT_FIX)])]),
  RD("Die Kinder", "sagen", "Wir haben keine Zeit.", "sie ___ keine Zeit", "sie keine Zeit ___", "ersatz", [L("hätten", [F("haben", IR.ersatz), F("hatten", "Das ist die Mitvergangenheit")])], 1),
  RD("Meine Eltern", "sagen", "Wir kommen später.", "sie ___ später", "sie später ___", "ersatz", [L("kämen", [F("kommen", IR.ersatz), F("kamen", "Das ist die Mitvergangenheit")])], 1),
  RD("Lena", "sagt", "Ich bin müde.", "___ ___ müde", "___ müde ___", "pers", [L("sie", [F("ich", IR.pers, NICHT_FIX)]), L("sei", [F("ist", IR.ind), F("wäre", IR.k2, NICHT_FIX)])], 1),
  RD("Jonas", "sagt", "Ich habe Hunger.", "___ ___ Hunger", "___ Hunger ___", "pers", [L("er", [F("ich", IR.pers, NICHT_FIX)]), L("habe", [F("hat", IR.ind), F("hätte", IR.k2, NICHT_FIX)])], 1),
  RD("Die Kinder", "rufen", "Wir sind fertig!", "sie ___ fertig", "sie fertig ___", "k1", [L("seien", [F("sind", IR.ind), F("wären", IR.k2, NICHT_FIX), F("sei", "Die Form passt zu einer Person. Hier sind es mehrere")])], 1),
  RD("Opa", "sagt", "Ich war früher Lehrer.", "er ___ früher Lehrer ___", "er früher Lehrer ___ ___", "verg", [L("sei", [F("war", "Die Vergangenheit in der indirekten Rede: sei und gewesen"), F("wäre", IR.k2, NICHT_FIX)]), L("gewesen", [F("geworden", "Von sein heißt das Partizip gewesen")])], 2),
  RD("Mia", "fragt", "Kommt Jonas heute?", "ob Jonas heute ___", undefined, "k1", [L("komme", [F("kommt", IR.ind), F("käme", IR.k2, NICHT_FIX)])], 2),
  RD("Der Arzt", "meint", "Der Bub braucht Ruhe.", "der Bub ___ Ruhe", "der Bub Ruhe ___", "k1", [L("brauche", [F("braucht", IR.ind), F("bräuchte", IR.k2, NICHT_FIX)])], 2),
];
const IR_HILFE = "In der indirekten Rede gibt es keine Anführungszeichen. Die Person ändert sich (aus ich wird er oder sie) und das Verb steht im Konjunktiv I.";
const IR_REGEL = "Indirekte Rede: ohne Anführungszeichen, mit Konjunktiv I.";
const irNachsatz = (r: Rede) => `${r.wer} ${r.sagt}, ${r.ind}.`;
const irSatz = (r: Rede, mitDirekt: boolean): Satz => ({
  titel: "Ergänze die indirekte Rede.",
  text: mitDirekt ? `${r.wer} ${r.sagt}: „${r.direkt}“\n${irNachsatz(r)}` : irNachsatz(r),
  luecken: r.luecken,
  regel: IR_REGEL,
  hilfe: IR_HILFE,
  tipp: IR_TIPP[r.g],
});
function irFuellen(vorlage: string, werte: readonly string[]): string {
  let i = 0;
  return vorlage.replace(/___/g, () => werte[i++] ?? "");
}
const INDIREKTE_REDE_F = ausListe(REDEN, {
  satz: (r) => irSatz(r, true),
  wahlTitel: "Was ist in der indirekten Rede richtig?",
  kurz: (r) => {
    const rechts = r.luecken.map((l) => l.richtig[0]);
    const mitWert = (i: number, w: string) => rechts.map((x, j) => (j === i ? w : x));
    const satz = (werte: readonly string[]) => `${r.wer} ${r.sagt}, ${irFuellen(r.ind, werte)}.`;
    const dass = (werte: readonly string[]) => (r.dass ? [`${r.wer} ${r.sagt}, dass ${irFuellen(r.dass, werte)}.`] : []);
    return {
      auftrag: "Schreib den Satz in der indirekten Rede.",
      vorlage: `${r.wer} ${r.sagt}: „${r.direkt}“`,
      richtig: [satz(rechts), ...dass(rechts)],
      fehler: r.luecken.flatMap((l, i) => l.fehler.flatMap((f) => [satz(mitWert(i, f.answer)), ...dass(mitWert(i, f.answer))].map((x) => F(x, f.label)))),
      regel: IR_REGEL,
      hilfe: IR_HILFE,
      tipp: IR_TIPP[r.g],
    };
  },
  fix: true,
  fixAuftrag: (n) =>
    n === 1 ? "Der Satz soll in der indirekten Rede mit Konjunktiv stehen. Ein Wort stimmt nicht. Schreib den Satz richtig." : "Die Sätze sollen in der indirekten Rede stehen. In jedem Satz stimmt ein Wort nicht. Schreib den Text richtig.",
  standard: "cloze",
  bestimmen: false,
});
// Fehler korrigieren: nur der Satz in der indirekten Rede, ohne die direkte Rede davor
INDIREKTE_REDE_F.fix = (rng, st) => irSatz(waehle(rng, REDEN, st), false);

// =====================================================================
// ---------- Satzreihe und Satzgefüge ----------
// =====================================================================
const SR = {
  ende: (w: string) => `Nach ${w} steht das Verb am Ende`,
  zweite: (w: string) => `Nach ${w} steht das Verb an zweiter Stelle`,
  gleich: (w: string) => `Nach ${w} kommt gleich das Verb`,
};
type Bindewort = { text: string; r: string[]; f: Fehler[]; st?: number };
const BW = (text: string, r: string | string[], f: Fehler[], st?: number): Bindewort => ({ text, r: typeof r === "string" ? [r] : r, f, st });
const BINDEWOERTER: Bindewort[] = [
  BW("Lena bleibt zu Hause, ___ sie krank ist.", ["weil", "da"], [F("denn", SR.zweite("denn")), F("deshalb", SR.gleich("deshalb"))]),
  BW("Lena bleibt zu Hause, ___ sie ist krank.", "denn", [F("weil", SR.ende("weil")), F("da", SR.ende("da")), F("obwohl", SR.ende("obwohl"))]),
  BW("Ich gehe spazieren, ___ es heute stark regnet.", ["obwohl", "obgleich", "obschon"], [F("aber", SR.zweite("aber")), F("trotzdem", SR.gleich("trotzdem"))]),
  BW("Es regnet heute stark, ___ gehe ich spazieren.", ["trotzdem", "dennoch"], [F("obwohl", SR.ende("obwohl")), F("aber", "Nach aber kommt zuerst das Subjekt, dann das Verb")]),
  BW("Er lernt jeden Tag, ___ bekommt er gute Noten.", ["deshalb", "darum", "deswegen", "daher", "also", "somit"], [F("weil", SR.ende("weil")), F("damit", SR.ende("damit"))]),
  BW("Er lernt jeden Tag, ___ er gute Noten bekommt.", ["damit", "sodass", "so dass"], [F("deshalb", SR.gleich("deshalb")), F("denn", SR.zweite("denn"))]),
  BW("Ich mag Äpfel, ___ meine Schwester mag lieber Birnen.", ["aber", "doch"], [F("obwohl", SR.ende("obwohl")), F("während", SR.ende("während"))]),
  BW("Kommst du mit, ___ bleibst du hier?", "oder", [F("ob", SR.ende("ob")), F("wenn", SR.ende("wenn"))]),
  BW("Ich weiß nicht, ___ du heute mitkommst.", "ob", [F("oder", SR.zweite("oder")), F("denn", SR.zweite("denn"))]),
  BW("Wir bleiben drinnen, ___ es draußen sehr kalt ist.", ["weil", "da"], [F("denn", SR.zweite("denn")), F("und", SR.zweite("und"))]),
  BW("Wir bleiben drinnen, ___ draußen ist es sehr kalt.", "denn", [F("weil", SR.ende("weil")), F("da", SR.ende("da"))]),
  BW("Es war schon spät, ___ wir gingen nach Hause.", "und", [F("deshalb", SR.gleich("deshalb")), F("weil", SR.ende("weil"))]),
  BW("Ruf mich an, ___ du zu Hause bist.", ["wenn", "sobald", "falls"], [F("dann", SR.gleich("dann")), F("und", SR.zweite("und"))]),
  BW("Ich habe Hunger, ___ ich habe nichts gegessen.", "denn", [F("weil", SR.ende("weil")), F("da", SR.ende("da"))]),
  BW("Ich habe Hunger, ___ ich nichts gegessen habe.", ["weil", "da"], [F("denn", SR.zweite("denn")), F("aber", SR.zweite("aber"))]),
  BW("Ich mag Äpfel, ___ meine Schwester lieber Birnen mag.", ["während", "wohingegen"], [F("aber", SR.zweite("aber")), F("doch", SR.zweite("doch"))], 1),
  BW("___ es regnet, bleiben wir drinnen.", ["Wenn", "Weil", "Da", "Falls", "Solange"], [F("Denn", "Ein Satz mit denn steht nie vorne"), F("Deshalb", "Nach deshalb kommt gleich das Verb")], 1),
  BW("Er ist müde, ___ er die ganze Nacht gespielt hat.", ["weil", "da"], [F("denn", SR.zweite("denn")), F("deshalb", SR.gleich("deshalb"))], 1),
  BW("Sie übt jeden Tag Klavier, ___ wird sie immer besser.", ["deshalb", "darum", "deswegen", "daher", "dadurch", "so"], [F("sodass", SR.ende("sodass")), F("weil", SR.ende("weil"))], 1),
  BW("Sie übt jeden Tag Klavier, ___ sie immer besser wird.", ["sodass", "so dass", "damit"], [F("deshalb", SR.gleich("deshalb")), F("und", SR.zweite("und"))], 1),
];
type SatzArt = "reihe" | "gefuege" | "einfach";
const SATZART_NAME: Record<SatzArt, string> = { reihe: "Satzreihe", gefuege: "Satzgefüge", einfach: "einfacher Satz" };
const SATZARTEN: { satz: string; art: SatzArt; st?: number }[] = [
  ...[
    "Lena liest ein Buch, und Jonas spielt Fußball.",
    "Ich mag Äpfel, aber meine Schwester mag lieber Birnen.",
    "Es regnet, deshalb bleiben wir drinnen.",
    "Der Hund bellt, die Katze faucht.",
    "Wir gehen ins Kino, denn der Film läuft heute zum letzten Mal.",
    "Kommst du mit, oder bleibst du hier?",
    "Die Sonne scheint, und die Vögel singen.",
    "Ich habe Hunger, denn ich habe nichts gegessen.",
  ].map((satz) => ({ satz, art: "reihe" as const })),
  ...[
    "Lena bleibt zu Hause, weil sie krank ist.",
    "Wenn es regnet, bleiben wir drinnen.",
    "Ich weiß nicht, ob er heute kommt.",
    "Das ist das Buch, das ich dir geschenkt habe.",
    "Obwohl er müde war, spielte er weiter.",
    "Ich glaube, dass morgen die Sonne scheint.",
    "Als wir ankamen, war das Fest schon vorbei.",
    "Der Hund bellt, sobald jemand klingelt.",
  ].map((satz) => ({ satz, art: "gefuege" as const })),
  ...[
    "Am Nachmittag spielen die Kinder im Garten.",
    "Wegen des Regens bleiben wir drinnen.",
    "Nach der Schule gehe ich mit meinem Hund spazieren.",
    "Lena und Jonas lesen ein spannendes Buch.",
    "Trotz der Kälte gehen wir baden.",
    "Mein Bruder fährt jeden Morgen mit dem Bus zur Schule.",
    "Bei schönem Wetter essen wir im Garten.",
    "Seit gestern hat Mia einen neuen Hund.",
  ].map((satz) => ({ satz, art: "einfach" as const })),
];
const SATZART_FEHLER: Record<SatzArt, Partial<Record<SatzArt, string>>> = {
  reihe: { gefuege: "Beide Teile haben das Verb an zweiter Stelle. Das sind zwei Hauptsätze", einfach: "Es gibt zwei gebeugte Verben, also zwei Sätze" },
  gefuege: { reihe: "In einem Teil steht das Verb am Ende. Das ist ein Gliedsatz, kein Hauptsatz", einfach: "Es gibt zwei gebeugte Verben, also zwei Sätze" },
  einfach: { reihe: "Es gibt nur ein gebeugtes Verb, also nur einen Satz", gefuege: "Es gibt nur ein gebeugtes Verb, also nur einen Satz" },
};
type Verbinden = { s1: string; s2: string; wort: string; r: string[]; f: Fehler[]; st?: number };
const KOMMA = "Vor dem Bindewort steht ein Beistrich";
const VB = (s1: string, s2: string, wort: string, r: string[], f: [string, string][], st?: number): Verbinden => ({ s1, s2, wort, r, f: f.map(([a, l]) => F(a, l)), st });
const VERBINDEN: Verbinden[] = [
  VB("Lena bleibt zu Hause.", "Sie ist krank.", "weil", ["Lena bleibt zu Hause, weil sie krank ist."], [["Lena bleibt zu Hause, weil sie ist krank.", SR.ende("weil")], ["Lena bleibt zu Hause weil sie krank ist.", KOMMA]]),
  VB("Lena bleibt zu Hause.", "Sie ist krank.", "denn", ["Lena bleibt zu Hause, denn sie ist krank."], [["Lena bleibt zu Hause, denn sie krank ist.", SR.zweite("denn")], ["Lena bleibt zu Hause denn sie ist krank.", KOMMA]]),
  VB("Es regnet.", "Wir bleiben drinnen.", "deshalb", ["Es regnet, deshalb bleiben wir drinnen.", "Es regnet. Deshalb bleiben wir drinnen."], [["Es regnet, deshalb wir bleiben drinnen.", SR.gleich("deshalb")], ["Es regnet deshalb bleiben wir drinnen.", KOMMA]]),
  VB("Ich gehe spazieren.", "Es regnet heute stark.", "obwohl", ["Ich gehe spazieren, obwohl es heute stark regnet."], [["Ich gehe spazieren, obwohl es regnet heute stark.", SR.ende("obwohl")], ["Ich gehe spazieren obwohl es heute stark regnet.", KOMMA]]),
  VB("Ich mag Äpfel.", "Meine Schwester mag lieber Birnen.", "aber", ["Ich mag Äpfel, aber meine Schwester mag lieber Birnen."], [["Ich mag Äpfel, aber meine Schwester lieber Birnen mag.", SR.zweite("aber")], ["Ich mag Äpfel aber meine Schwester mag lieber Birnen.", KOMMA]]),
  VB("Wir bleiben drinnen.", "Es ist sehr kalt.", "weil", ["Wir bleiben drinnen, weil es sehr kalt ist."], [["Wir bleiben drinnen, weil es ist sehr kalt.", SR.ende("weil")], ["Wir bleiben drinnen weil es sehr kalt ist.", KOMMA]]),
  VB("Er lernt jeden Tag.", "Er bekommt gute Noten.", "deshalb", ["Er lernt jeden Tag, deshalb bekommt er gute Noten.", "Er lernt jeden Tag. Deshalb bekommt er gute Noten."], [["Er lernt jeden Tag, deshalb er bekommt gute Noten.", SR.gleich("deshalb")], ["Er lernt jeden Tag deshalb bekommt er gute Noten.", KOMMA]]),
  VB("Ich habe Hunger.", "Ich habe nichts gegessen.", "weil", ["Ich habe Hunger, weil ich nichts gegessen habe."], [["Ich habe Hunger, weil ich habe nichts gegessen.", SR.ende("weil")], ["Ich habe Hunger weil ich nichts gegessen habe.", KOMMA]]),
  VB("Ruf mich an.", "Du bist zu Hause.", "wenn", ["Ruf mich an, wenn du zu Hause bist.", "Wenn du zu Hause bist, ruf mich an."], [["Ruf mich an, wenn du bist zu Hause.", SR.ende("wenn")], ["Ruf mich an wenn du zu Hause bist.", KOMMA]]),
  VB("Mia ist müde.", "Sie hat lange gelesen.", "denn", ["Mia ist müde, denn sie hat lange gelesen."], [["Mia ist müde, denn sie lange gelesen hat.", SR.zweite("denn")], ["Mia ist müde denn sie hat lange gelesen.", KOMMA]]),
  VB("Es ist kalt.", "Wir gehen baden.", "trotzdem", ["Es ist kalt, trotzdem gehen wir baden.", "Es ist kalt. Trotzdem gehen wir baden."], [["Es ist kalt, trotzdem wir gehen baden.", SR.gleich("trotzdem")], ["Es ist kalt trotzdem gehen wir baden.", KOMMA]]),
  VB("Der Hund bellt.", "Jemand klingelt an der Tür.", "sobald", ["Der Hund bellt, sobald jemand an der Tür klingelt."], [["Der Hund bellt, sobald jemand klingelt an der Tür.", SR.ende("sobald")], ["Der Hund bellt sobald jemand an der Tür klingelt.", KOMMA]]),
];
const BW_HILFE = "Schau, wo das gebeugte Verb im zweiten Satz steht: an zweiter Stelle oder am Ende?";
const BW_TIPP = "Weil, da, obwohl, wenn, dass, ob, damit und sodass schicken das Verb ans Ende. Und, aber, oder, denn und doch lassen es an zweiter Stelle. Nach deshalb und trotzdem kommt gleich das Verb.";
const SATZREIHE_F: Faehigkeit = {
  luecke: (rng, st) => {
    const b = waehle(rng, BINDEWOERTER, st);
    return { titel: "Setz ein passendes Bindewort ein. Achte darauf, wo das Verb steht.", text: b.text, luecken: [L(b.r, b.f)], regel: "Im Gliedsatz steht das gebeugte Verb am Ende, im Hauptsatz an zweiter Stelle.", hilfe: BW_HILFE, tipp: BW_TIPP };
  },
  wahl: (rng, st) => {
    const s = waehle(rng, SATZARTEN, st);
    const andere = (Object.keys(SATZART_NAME) as SatzArt[]).filter((a) => a !== s.art);
    return {
      titel: "Ist das eine Satzreihe, ein Satzgefüge oder ein einfacher Satz?",
      text: s.satz,
      richtig: SATZART_NAME[s.art],
      falsch: andere.map((a) => F(SATZART_NAME[a], SATZART_FEHLER[s.art][a]!)),
      regel: "Satzreihe: Hauptsatz und Hauptsatz. Satzgefüge: Hauptsatz und Gliedsatz. Einfacher Satz: nur ein gebeugtes Verb.",
      hilfe: "Zähl die gebeugten Verben. Gibt es zwei, schau, wo sie in ihrem Satz stehen.",
      tipp: "Steht ein gebeugtes Verb ganz am Ende seines Satzes, ist dieser Satz ein Gliedsatz.",
    };
  },
  kurz: (rng, st) => {
    const v = waehle(rng, VERBINDEN, st);
    return { auftrag: `Verbinde die zwei Sätze mit „${v.wort}“.`, vorlage: `${v.s1} ${v.s2}`, richtig: v.r, fehler: v.f, regel: "Im Gliedsatz steht das gebeugte Verb am Ende, im Hauptsatz an zweiter Stelle.", hilfe: BW_HILFE, tipp: BW_TIPP };
  },
  standard: "cloze",
  bestimmen: true,
};

// =====================================================================
// ---------- Attribute ----------
// =====================================================================
type AttrTyp = "adj" | "gen" | "praep" | "beisatz" | "satz";
const ATTR_NAME: Record<AttrTyp, string[]> = {
  adj: ["Adjektivattribut", "Adjektiv", "Attribut mit Adjektiv", "adjektivisches Attribut"],
  gen: ["Genitivattribut", "Genitiv", "Attribut im Genitiv"],
  praep: ["Präpositionalattribut", "Attribut mit Präposition", "präpositionales Attribut"],
  beisatz: ["Beisatz", "Apposition"],
  satz: ["Attributsatz", "Relativsatz"],
};
const ATTR_BEISPIEL: Record<AttrTyp, string> = {
  adj: "ein Adjektiv vor dem Nomen, wie das rote Fahrrad",
  gen: "ein Nomen im Genitiv (Wessen?), wie das Fahrrad meiner Schwester",
  praep: "eine Wortgruppe mit Präposition, wie das Fahrrad mit der Klingel",
  beisatz: "ein Nomen zwischen Beistrichen, wie Max, mein Nachbar, …",
  satz: "ein ganzer Gliedsatz, wie das Fahrrad, das dort steht",
};
const ATT = {
  praed: "Das ist das Prädikat",
  subj: "Das ist das Subjekt",
  obj: "Das ist ein Objekt",
  nomen: "Das ist das Nomen selbst. Das Attribut sagt mehr darüber",
  ganz: "Das ist das ganze Satzglied. Das Attribut ist nur ein Teil davon",
  zeit: "Das sagt, wann: eine adverbiale Bestimmung",
  ort: "Das sagt, wo: eine adverbiale Bestimmung",
  wie: "Das sagt, wie: Das gehört zum Verb, nicht zum Nomen",
  ist: "Das steht nach ist und gehört zum Prädikat",
};
type Attribut = { satz: string; nomen: string; attr: string; typ: AttrTyp; f: Fehler[]; st?: number };
const AT = (satz: string, nomen: string, attr: string, typ: AttrTyp, f: [string, keyof typeof ATT][], st?: number): Attribut => ({ satz, nomen, attr, typ, f: f.map(([a, k]) => F(a, ATT[k])), st });
const ATTRIBUTE: Attribut[] = [
  AT("Der kleine Hund bellt laut.", "Hund", "kleine", "adj", [["laut", "wie"], ["bellt", "praed"], ["Hund", "nomen"]]),
  AT("Wir essen frische Erdbeeren.", "Erdbeeren", "frische", "adj", [["essen", "praed"], ["Wir", "subj"], ["Erdbeeren", "nomen"]]),
  AT("Ich lese ein spannendes Buch.", "Buch", "spannendes", "adj", [["lese", "praed"], ["Ich", "subj"], ["Buch", "nomen"]]),
  AT("Wir wohnen in einem alten Haus.", "Haus", "alten", "adj", [["in einem alten Haus", "ganz"], ["wohnen", "praed"], ["Wir", "subj"]]),
  AT("Gestern habe ich einen lustigen Film gesehen.", "Film", "lustigen", "adj", [["Gestern", "zeit"], ["einen lustigen Film", "ganz"], ["habe gesehen", "praed"]]),
  AT("Die müde Katze schläft auf dem Sofa.", "Katze", "müde", "adj", [["auf dem Sofa", "ort"], ["schläft", "praed"], ["Katze", "nomen"]]),
  AT("Mein Opa trägt einen grünen Hut.", "Hut", "grünen", "adj", [["trägt", "praed"], ["Mein Opa", "subj"], ["einen grünen Hut", "ganz"]]),
  AT("Lena bekommt ein neues Fahrrad.", "Fahrrad", "neues", "adj", [["bekommt", "praed"], ["Lena", "subj"], ["ein neues Fahrrad", "ganz"]]),
  AT("Im Garten blühen bunte Blumen.", "Blumen", "bunte", "adj", [["Im Garten", "ort"], ["blühen", "praed"], ["Blumen", "nomen"]]),
  AT("Der freundliche Busfahrer grüßt uns jeden Morgen.", "Busfahrer", "freundliche", "adj", [["jeden Morgen", "zeit"], ["grüßt", "praed"], ["uns", "obj"]]),
  AT("Wir trinken heißen Tee.", "Tee", "heißen", "adj", [["trinken", "praed"], ["Wir", "subj"], ["Tee", "nomen"]]),
  AT("Der Lehrer erklärt die schwierige Aufgabe.", "Aufgabe", "schwierige", "adj", [["erklärt", "praed"], ["Der Lehrer", "subj"], ["die schwierige Aufgabe", "ganz"]]),
  AT("Das Auto meines Vaters ist rot.", "Auto", "meines Vaters", "gen", [["rot", "ist"], ["ist", "praed"], ["Auto", "nomen"]], 1),
  AT("Die Katze des Nachbarn schläft im Garten.", "Katze", "des Nachbarn", "gen", [["im Garten", "ort"], ["schläft", "praed"], ["Katze", "nomen"]], 1),
  AT("Der Hund meiner Oma heißt Bello.", "Hund", "meiner Oma", "gen", [["Bello", "ist"], ["heißt", "praed"], ["Hund", "nomen"]], 1),
  AT("Das Haus am See gehört meiner Tante.", "Haus", "am See", "praep", [["meiner Tante", "obj"], ["gehört", "praed"], ["Haus", "nomen"]], 1),
  AT("Die Blumen im Garten blühen schon.", "Blumen", "im Garten", "praep", [["schon", "zeit"], ["blühen", "praed"], ["Blumen", "nomen"]], 1),
  AT("Der Mann mit dem Hut wartet vor der Tür.", "Mann", "mit dem Hut", "praep", [["vor der Tür", "ort"], ["wartet", "praed"], ["Mann", "nomen"]], 1),
  AT("Das Buch über Dinosaurier ist spannend.", "Buch", "über Dinosaurier", "praep", [["spannend", "ist"], ["ist", "praed"], ["Buch", "nomen"]], 1),
  AT("Die Spielsachen meines Bruders liegen überall.", "Spielsachen", "meines Bruders", "gen", [["überall", "ort"], ["liegen", "praed"], ["Spielsachen", "nomen"]], 1),
  AT("Die Tasche aus Leder ist teuer.", "Tasche", "aus Leder", "praep", [["teuer", "ist"], ["ist", "praed"], ["Tasche", "nomen"]], 1),
  AT("Lena, meine beste Freundin, kommt heute.", "Lena", "meine beste Freundin", "beisatz", [["heute", "zeit"], ["kommt", "praed"], ["Lena", "nomen"]], 2),
  AT("Mein Bruder, ein guter Schwimmer, gewann das Rennen.", "Bruder", "ein guter Schwimmer", "beisatz", [["das Rennen", "obj"], ["gewann", "praed"], ["Bruder", "nomen"]], 2),
  AT("Der Junge, der neben mir sitzt, heißt Paul.", "Junge", "der neben mir sitzt", "satz", [["Paul", "ist"], ["heißt", "praed"], ["Junge", "nomen"]], 2),
  AT("Das Fahrrad, das ich mir gewünscht habe, ist blau.", "Fahrrad", "das ich mir gewünscht habe", "satz", [["blau", "ist"], ["ist", "praed"], ["Fahrrad", "nomen"]], 2),
  AT("Wien, die Hauptstadt Österreichs, liegt an der Donau.", "Wien", "die Hauptstadt Österreichs", "beisatz", [["an der Donau", "ort"], ["liegt", "praed"], ["Wien", "nomen"]], 2),
  AT("Die Frau, die uns geholfen hat, ist Ärztin.", "Frau", "die uns geholfen hat", "satz", [["Ärztin", "ist"], ["ist", "praed"], ["Frau", "nomen"]], 2),
];
const ATTR_HILFE = "Ein Attribut gehört zu einem Nomen und sagt mehr darüber: Welcher? Was für ein? Wessen?";
const ATTR_TIPP = "Mach die Umstellprobe: Das Attribut bleibt immer bei seinem Nomen und wandert mit ihm.";
const attrRegel = (a: Attribut) => `„${a.attr}“ sagt mehr über „${a.nomen}“: ${ATTR_NAME[a.typ][0]}.`;
const ATTRIBUTE_F = ausListe(ATTRIBUTE, {
  satz: (a) => ({ titel: "Schreib das Attribut in die Lücke.", text: `${a.satz} Attribut zu „${a.nomen}“: ___`, luecken: [L(a.attr, a.f)], regel: attrRegel(a), hilfe: ATTR_HILFE, tipp: ATTR_TIPP }),
  wahl: (a) => ({ titel: `Welches Attribut gehört zum Nomen „${a.nomen}“?`, text: a.satz, richtig: a.attr, falsch: a.f, regel: attrRegel(a), hilfe: ATTR_HILFE, tipp: ATTR_TIPP }),
  kurz: (a) =>
    a.typ === "adj"
      ? { auftrag: `Welches Wort ist das Attribut zu „${a.nomen}“? Schreib es ab.`, vorlage: a.satz, richtig: [a.attr], fehler: a.f, regel: attrRegel(a), hilfe: ATTR_HILFE, tipp: ATTR_TIPP }
      : {
          auftrag: `Welche Art von Attribut ist „${a.attr}“?`,
          vorlage: a.satz,
          richtig: ATTR_NAME[a.typ],
          fehler: (Object.keys(ATTR_NAME) as AttrTyp[]).filter((t) => t !== a.typ).map((t) => F(ATTR_NAME[t][0], `Das wäre ${ATTR_BEISPIEL[t]}`)),
          regel: attrRegel(a),
          hilfe: ATTR_HILFE,
          tipp: "Ist es ein Adjektiv vor dem Nomen, ein Nomen im Genitiv (Wessen?), eine Wortgruppe mit Präposition, ein Beisatz zwischen Beistrichen oder ein ganzer Gliedsatz?",
        },
  standard: "mc",
  bestimmen: true,
});

// =====================================================================
// ---------- Sprachliche Bilder: Vergleich, Metapher, Personifikation ----------
// =====================================================================
type BildArt = "vergleich" | "metapher" | "personifikation";
const BILD_NAME: Record<BildArt, string[]> = { vergleich: ["Vergleich"], metapher: ["Metapher"], personifikation: ["Personifikation", "Personifizierung", "Vermenschlichung"] };
const BILD_FEHLER: Record<BildArt, Partial<Record<BildArt, string>>> = {
  vergleich: { metapher: "Hier steht wie oder als. Das zeigt einen Vergleich", personifikation: "Hier tut kein Ding etwas Menschliches. Achte auf wie oder als" },
  metapher: { vergleich: "Es steht kein wie und kein als. Das Bild steht direkt für die Sache", personifikation: "Hier tut kein Ding etwas, das nur Menschen tun. Das Bild steht direkt für die Sache" },
  personifikation: { vergleich: "Es steht kein wie und kein als. Ein Ding tut hier etwas Menschliches", metapher: "Hier tut ein Ding oder ein Tier etwas, das sonst nur Menschen tun" },
};
const BILDER: { satz: string; art: BildArt; st?: number }[] = [
  ...[
    "Er ist stark wie ein Bär.",
    "Sie schwimmt wie ein Fisch.",
    "Mein Opa schläft wie ein Murmeltier.",
    "Das Kind ist leicht wie eine Feder.",
    "Ihre Augen leuchten wie Sterne.",
    "Er ist schneller als der Wind.",
    "Mein Zimmer sieht aus wie ein Schlachtfeld.",
    "Sie ist schlau wie ein Fuchs.",
    "Das Eis ist glatt wie ein Spiegel.",
  ].map((satz) => ({ satz, art: "vergleich" as const })),
  ...[
    "Mein Bruder ist ein Angsthase.",
    "Sie hat ein Herz aus Gold.",
    "Er hat Nerven aus Stahl.",
    "Du bist mein Sonnenschein.",
    "Das Klassenzimmer war ein Bienenstock.",
    "Am Himmel funkelt ein Meer aus Sternen.",
    "Zeit ist Geld.",
    "Mein Opa ist ein wandelndes Lexikon.",
  ].map((satz) => ({ satz, art: "metapher" as const })),
  ...[
    "Die Sonne lacht.",
    "Der Wind heult ums Haus.",
    "Die Bäume flüstern im Wald.",
    "Der Wecker schreit jeden Morgen.",
    "Die Blumen tanzen im Wind.",
    "Die Zeit rennt davon.",
    "Das Auto wollte heute nicht anspringen.",
    "Die Stadt schläft noch.",
    "Der Mond schaut durchs Fenster.",
  ].map((satz) => ({ satz, art: "personifikation" as const })),
];
const BILD_HILFE = "Vergleich: mit wie oder als. Metapher: ohne wie, das Bild steht direkt für die Sache. Personifikation: Ein Ding oder Tier tut etwas, das nur Menschen tun.";
const BILD_TIPP = "Frag dich: Steht wie oder als? Kann das Ding das in echt tun?";
const bildFehler = (b: (typeof BILDER)[number]) => (Object.keys(BILD_NAME) as BildArt[]).filter((a) => a !== b.art).map((a) => F(BILD_NAME[a][0], BILD_FEHLER[b.art][a]!));
const bildRegel = (b: (typeof BILDER)[number]) => `„${b.satz}“ ist ${b.art === "vergleich" ? "ein Vergleich" : b.art === "metapher" ? "eine Metapher" : "eine Personifikation"}.`;
const SPRACHBILDER_F = ausListe(BILDER, {
  satz: (b) => ({ titel: "Welches sprachliche Bild ist das? Schreib Vergleich, Metapher oder Personifikation.", text: `„${b.satz}“ Sprachliches Bild: ___`, luecken: [L(BILD_NAME[b.art], bildFehler(b))], regel: bildRegel(b), hilfe: BILD_HILFE, tipp: BILD_TIPP }),
  wahl: (b) => ({ titel: "Welches sprachliche Bild ist das?", text: `„${b.satz}“`, richtig: BILD_NAME[b.art][0], falsch: bildFehler(b), regel: bildRegel(b), hilfe: BILD_HILFE, tipp: BILD_TIPP }),
  kurz: (b) => ({ auftrag: "Wie heißt dieses sprachliche Bild?", vorlage: `„${b.satz}“`, richtig: BILD_NAME[b.art], fehler: bildFehler(b), regel: bildRegel(b), hilfe: BILD_HILFE, tipp: BILD_TIPP }),
  standard: "mc",
  bestimmen: true,
});

// =====================================================================
// ---------- Relativpronomen „das“ oder „was“ ----------
// =====================================================================
type DwGrund = "nomen" | "alles" | "sup" | "satz" | "das";
const DW_TIPP: Record<DwGrund, string> = {
  nomen: "Such das Wort, auf das sich der Gliedsatz bezieht. Ist es ein bestimmtes Nomen?",
  alles: "Steht vor dem Beistrich ein Wort wie alles, nichts oder etwas?",
  sup: "Steht vor dem Beistrich ein Superlativ als Nomen, wie das Schönste?",
  satz: "Bezieht sich der Gliedsatz auf ein einzelnes Wort oder auf den ganzen Satz davor?",
  das: "Steht vor dem Beistrich nur das Wort das allein, ohne Nomen?",
};
const DW_WAS: Record<Exclude<DwGrund, "nomen">, string> = {
  alles: "Nach alles, nichts, etwas, vieles und manches steht was",
  sup: "Nach einem Superlativ als Nomen (das Beste) steht was",
  satz: "Bezieht es sich auf den ganzen Satz davor, steht was",
  das: "Nach dem Wort das allein (Das, …) steht was",
};
const DW_DASS = "dass mit ss ist eine Konjunktion. Hier ist ein Relativpronomen gemeint";
type DasWas = { satz: string; g: DwGrund; st?: number };
const DW = (satz: string, g: DwGrund, st?: number): DasWas => ({ satz, g, st });
const DAS_WAS: DasWas[] = [
  DW("Das Buch, ___ ich gerade lese, ist spannend.", "nomen"),
  DW("Das Haus, ___ dort drüben steht, ist sehr alt.", "nomen"),
  DW("Das Fahrrad, ___ ich zum Geburtstag bekommen habe, ist rot.", "nomen"),
  DW("Das Kind, ___ dort spielt, ist mein Bruder.", "nomen"),
  DW("Das Lied, ___ im Radio läuft, gefällt mir.", "nomen"),
  DW("Das Mädchen, ___ neben mir wohnt, heißt Lara.", "nomen"),
  DW("Das Spiel, ___ wir gestern gespielt haben, war spannend.", "nomen"),
  DW("Das Geschenk, ___ du mir gegeben hast, gefällt mir sehr.", "nomen"),
  DW("Alles, ___ du sagst, stimmt.", "alles"),
  DW("Nichts, ___ er macht, gelingt ihm.", "alles"),
  DW("Es gibt vieles, ___ ich noch lernen will.", "alles"),
  DW("Einiges, ___ du erzählst, wusste ich schon.", "alles"),
  DW("Ist das alles, ___ du weißt?", "alles"),
  DW("Das ist das Beste, ___ ich je gegessen habe.", "sup"),
  DW("Er hat die Prüfung bestanden, ___ alle überrascht hat.", "satz"),
  DW("Sie kam zu spät, ___ den Lehrer ärgerte.", "satz"),
  DW("Ich habe das Foto, ___ du gemacht hast, aufgehängt.", "nomen", 1),
  DW("Wir besuchen das Museum, ___ neu eröffnet wurde.", "nomen", 1),
  DW("Manches, ___ in der Zeitung steht, ist nicht wahr.", "alles", 1),
  DW("Das Erste, ___ ich morgens mache, ist Zähneputzen.", "sup", 1),
  DW("Das Schönste, ___ ich im Urlaub gesehen habe, war das Meer.", "sup", 1),
  DW("Es hat die ganze Nacht geregnet, ___ den Garten freut.", "satz", 1),
  DW("Mia hat ihr Zimmer aufgeräumt, ___ ihre Mutter sehr gefreut hat.", "satz", 1),
  DW("Das Wenige, ___ wir wissen, reicht nicht.", "sup", 2),
  DW("Das, ___ du gesagt hast, stimmt nicht.", "das", 2),
  DW("Ich glaube das, ___ du sagst.", "das", 2),
];
const DW_HILFE = "Bezieht sich der Gliedsatz auf ein Nomen mit das, steht das. Nach alles, nichts, etwas, nach einem Superlativ und nach einem ganzen Satz steht was.";
const dwRichtig = (d: DasWas) => (d.g === "nomen" ? "das" : "was");
const dwFehler = (d: DasWas) =>
  d.g === "nomen" ? [F("was", "Bezieht es sich auf ein bestimmtes Nomen (das Buch, das Kind), steht das, nicht was"), F("dass", DW_DASS)] : [F("das", DW_WAS[d.g]), F("dass", DW_DASS)];
const dwRegel = (d: DasWas) => (d.g === "nomen" ? "Bezieht sich der Gliedsatz auf ein Nomen mit das, steht das." : `${DW_WAS[d.g]}.`);
const DAS_WAS_F = ausListe(DAS_WAS, {
  satz: (d) => ({ titel: "Setz das oder was ein.", text: d.satz, luecken: [L(dwRichtig(d), dwFehler(d))], regel: dwRegel(d), hilfe: DW_HILFE, tipp: DW_TIPP[d.g] }),
  wahlTitel: "Welches Wort passt?",
  kurz: (d) => ({ auftrag: "Welches Wort passt: das oder was? Schreib nur das Wort.", vorlage: d.satz.replace("___", "…"), richtig: [dwRichtig(d)], fehler: dwFehler(d), regel: dwRegel(d), hilfe: DW_HILFE, tipp: DW_TIPP[d.g] }),
  fix: true,
  fixAuftrag: (n) => (n === 1 ? "Im Satz steht das falsche Wort: das, was oder dass. Schreib den Satz richtig." : "In jedem Satz steht ein falsches das, was oder dass. Schreib den Text richtig."),
  standard: "cloze",
  bestimmen: false,
});

// =====================================================================
// ---------- die Fähigkeiten ----------
// =====================================================================
export const MEHR_FAEHIGKEITEN: Record<string, Faehigkeit> = {
  "deutsch.vs.sprache.mehrzahl": MEHRZAHL_F,
  "deutsch.vs.sprache.personalformen": PERSONALFORMEN_F,
  "deutsch.vs.recht.silbentrennung": SILBENTRENNUNG_F,
  "deutsch.recht.woerterbuch": WOERTERBUCH_F,
  "deutsch.recht.gleichklang": GLEICHKLANG_F,
  "deutsch.recht.fremdwoerter": FREMDWOERTER_F,
  "deutsch.wortarten.steigerung": STEIGERUNG_F,
  "deutsch.wortschatz.zusammensetzung": ZUSAMMENSETZUNG_F,
  "deutsch.wortschatz.ableitung": ABLEITUNG_F,
  "deutsch.wortschatz.redewendungen": REDEWENDUNGEN_F,
  "deutsch.grammatik.imperativ": IMPERATIV_F,
  "deutsch.grammatik.konjunktiv2": KONJUNKTIV2_F,
  "deutsch.grammatik.indirekte-rede": INDIREKTE_REDE_F,
  "deutsch.satz.satzreihe-gefuege": SATZREIHE_F,
  "deutsch.satz.attribute": ATTRIBUTE_F,
  "deutsch.literatur.sprachbilder": SPRACHBILDER_F,
  "deutsch.os.grammatik.daswas": DAS_WAS_F,
};
