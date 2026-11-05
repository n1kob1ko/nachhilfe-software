/**
 * Mehr Englisch-Grammatik ohne KI (Generalprobe 2026-11-05: diese häufigen Themen hatten nur „Erkläre in eigenen
 * Worten …“): present perfect oder past simple, past perfect, used to, present perfect progressive, gemischte
 * Zeiten, a/an/the, Pronomen und Possessivbegleiter, Präpositionen des Ortes, Gerund oder Infinitiv, Adjektiv oder
 * Adverb, Question Tags, Relativsätze, Reflexivpronomen, Ersatzformen der Modalverben, if-Sätze Typ 3 und das
 * Passiv in anderen Zeiten.
 *
 * Jeder Satz hat dieselbe Form wie in lib/englisch-grammatik.ts (Satz): daraus werden Lückentext, Multiple Choice und
 * „Fehler korrigieren“, mit den typischen Fehlern und ihren Etiketten. Die Zeiten bauen die Sätze aus Personen und
 * Verben (lib/englisch-woerter.ts), die anderen Themen haben eigene Satzlisten. Wo ein Satz auch anders richtig wäre
 * („She has waited for an hour“), nennt der Auftrag die Form, und die andere Form ist nie der Fehler eines
 * Korrekturtexts (fix: false). Die Hilfen nennen die Regel, nie die Antwort (lib/hinweise-loesung.test.ts).
 *
 * Eigene Sätze, nichts aus Schulbüchern oder Prüfungen.
 */
import { dritte, verb, type Pronomen, type Verb } from "./englisch-woerter";
import type { Faehigkeit, Fehler, Satz } from "./englisch-grammatik";
import type { Rng, Stufe } from "./schulbuch-zahlen";

const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const F = (answer: string, label: string, o: { mc?: false; fix?: false } = {}): Fehler => ({ answer, label, ...o });
const T = (s: string) => () => s;

/** Bis zu welcher Stufe der Sätze eine Schwierigkeit geht: unten die leichten, oben meist die schweren. */
const MAX: Record<Stufe, number> = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 2 };
function waehle<X extends { st?: number }>(rng: Rng, liste: readonly X[], st: Stufe): X {
  const erlaubt = liste.filter((x) => (x.st ?? 0) <= MAX[st]);
  const schwer = erlaubt.filter((x) => (x.st ?? 0) >= 1);
  return pick(rng, st >= 3 && schwer.length && rng() < 0.6 ? schwer : erlaubt);
}

// ---------- Personen ----------
type Wer = { text: string; p: Pronomen };
const WER: Wer[] = [
  { text: "Lena", p: "she" },
  { text: "Jonas", p: "he" },
  { text: "Mia", p: "she" },
  { text: "Paul", p: "he" },
  { text: "My sister", p: "she" },
  { text: "My brother", p: "he" },
  { text: "I", p: "I" },
  { text: "We", p: "we" },
  { text: "My parents", p: "they" },
  { text: "Our neighbours", p: "they" },
];
const POSS: Record<Pronomen, string> = { I: "my", you: "your", he: "his", she: "her", it: "its", we: "our", they: "their" };
const OBJ: Record<Pronomen, string> = { I: "me", you: "you", he: "him", she: "her", it: "it", we: "us", they: "them" };
const hat = (p: Pronomen) => (dritte(p) ? "has" : "have");
const anderesHat = (p: Pronomen) => (dritte(p) ? "have" : "has");
const war = (p: Pronomen) => (p === "I" || dritte(p) ? "was" : "were");
const ist = (p: Pronomen) => (p === "I" ? "am" : dritte(p) ? "is" : "are");
const simple = (v: Verb, p: Pronomen) => (dritte(p) ? v.s : v.base);
const pron = (p: Pronomen) => p;
/** {S} Person am Satzanfang, {s} das Pronomen, {poss} der Possessivbegleiter, {o} das Objektpronomen. */
const setze = (text: string, w: Wer) =>
  text
    .replace(/\{S\}/g, w.text)
    .replace(/\{s\}/g, pron(w.p))
    .replace(/\{poss\}/g, POSS[w.p])
    .replace(/\{o\}/g, OBJ[w.p])
    .replace(/\{war\}/g, war(w.p));
const pasts = (v: Verb) => [v.past, ...v.pastAlt];
const pps = (v: Verb) => [v.pp, ...v.ppAlt];
const formenText = (v: Verb) => `${v.base}, ${v.past}, ${v.pp}`;

// ---------- Present perfect oder past simple ----------
/** [Satz, Verb, Zeit, Stufe]; die Lücke steht für die ganze Verbform, Signalwörter stehen im Satz. */
type ZeitVorlage = { t: string; v: string; z: "ps" | "pp"; st?: number; cue?: (v: Verb) => string; adv?: string; schwach?: boolean };
const PERFECT_PAST: ZeitVorlage[] = [
  { t: "{S} ___ {poss} grandparents last weekend.", v: "visit", z: "ps" },
  { t: "{S} ___ a great film yesterday.", v: "see", z: "ps" },
  { t: "{S} ___ to Italy two years ago.", v: "go", z: "ps" },
  { t: "{S} ___ a new bike last month.", v: "buy", z: "ps" },
  { t: "{S} ___ in Graz in 2019.", v: "live", z: "ps" },
  { t: "{S} ___ the bus this morning, so {s} walked to school.", v: "miss", z: "ps" },
  { t: "{S} ___ pizza for lunch last Monday.", v: "eat", z: "ps" },
  { t: "{S} ___ a letter to {poss} pen friend last Friday.", v: "write", z: "ps" },
  { t: "{S} ___ {poss} keys in the park yesterday.", v: "lose", z: "ps" },
  { t: "{S} ___ a cake for the party on Saturday.", v: "make", z: "ps" },
  { t: "{S} ___ in this town since 2020.", v: "live", z: "pp" },
  { t: "{S} ___ three books so far this month.", v: "read", z: "pp" },
  { t: "{S} ___ in the school band since last September.", v: "play", z: "pp" },
  { t: "{S} ___ {poss} phone. Can you help us find it?", v: "lose", z: "pp", st: 1 },
  { t: "{S} ___ sushi. Is it nice?", v: "eat", z: "pp", adv: "never", st: 1 },
  { t: "{S} ___ a horse. Is it difficult?", v: "ride", z: "pp", adv: "never", st: 1 },
  { t: "{S} ___ {poss} homework, so {s} can go out now.", v: "finish", z: "pp", adv: "just", st: 1, schwach: true },
  { t: "{S} ___ that film. {S} saw it last week.", v: "see", z: "pp", adv: "already", st: 1, schwach: true },
  { t: "{S} ___ English since {s} {war} six.", v: "learn", z: "pp", st: 2 },
  { t: "When {s} {war} ten, {s} ___ in a small village.", v: "live", z: "ps", st: 2 },
  { t: "{S} ___ {poss} cousins since Christmas.", v: "see", z: "pp", adv: "not", st: 2 },
  { t: "{S} ___ to London three times so far.", v: "fly", z: "pp", st: 2 },
  { t: "Last summer {s} ___ in the lake every day.", v: "swim", z: "ps", st: 2 },
  { t: "{S} ___ {poss} room yet.", v: "clean", z: "pp", adv: "not", st: 2, schwach: true },
];
/** Dauer-Verben: seit … auch in der Verlaufsform richtig. */
const DAUER = new Set(["live", "learn", "play", "work", "wait"]);
const NICHT_HAT = (p: Pronomen) => (dritte(p) ? "hasn't" : "haven't");

function perfectPastSatz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, PERFECT_PAST, st);
  const v = verb(vo.v);
  const w = pick(rng, WER);
  const text = setze(vo.t, w);
  const cue = vo.adv && vo.adv !== "not" ? `${vo.adv} / ${v.base}` : vo.adv === "not" ? `not ${v.base}` : v.base;
  if (vo.z === "ps") {
    return {
      text,
      luecken: [
        {
          cue,
          richtig: pasts(v),
          fehler: [
            F(`${hat(w.p)} ${v.pp}`, "Mit einem Zeitpunkt in der Vergangenheit steht past simple"),
            F(v.base, "Vergangenheit: die 2. Form, nicht die Grundform"),
            ...(v.pp !== v.past ? [F(v.pp, "Das ist die 3. Form; past simple ist die 2. Form")] : []),
            ...(dritte(w.p) && v.s !== v.base ? [F(v.s, "Vergangenheit: die 2. Form, nicht das present simple")] : []),
          ],
        },
      ],
      regel: `Der Satz sagt, wann es war: past simple, ${v.past} (${formenText(v)}).`,
      hilfe: "Sagt der Satz, wann es war (yesterday, last week, ago, in 2019)? Dann past simple. Geht es um „bis jetzt“ (since, so far, never, already, just, yet)? Dann present perfect.",
      tipp: "Such das Signalwort: Ein Zeitpunkt in der Vergangenheit verlangt die 2. Form des Verbs.",
    };
  }
  const h = hat(w.p);
  const mitAdv = (x: string) => (vo.adv === "not" ? `${NICHT_HAT(w.p)} ${x}` : vo.adv ? `${h} ${vo.adv} ${x}` : `${h} ${x}`);
  const richtig = [...pps(v).map(mitAdv), ...(DAUER.has(v.base) && !vo.adv ? [`${h} been ${v.ing}`] : [])];
  const vergangen = vo.adv === "not" ? `didn't ${v.base}` : vo.adv ? `${vo.adv} ${v.past}` : v.past;
  return {
    text,
    luecken: [
      {
        cue,
        richtig,
        fehler: [
          F(vergangen, "Es geht um „bis jetzt“: present perfect (have oder has + 3. Form)", vo.schwach ? { fix: false } : {}),
          F(vo.adv === "not" ? `${dritte(w.p) ? "haven't" : "hasn't"} ${v.pp}` : vo.adv ? `${anderesHat(w.p)} ${vo.adv} ${v.pp}` : `${anderesHat(w.p)} ${v.pp}`, "have oder has passt nicht zur Person"),
          ...(v.pp !== v.past ? [F(mitAdv(v.past), "Nach have oder has steht die 3. Form")] : [F(mitAdv(v.base), "Nach have oder has steht die 3. Form")]),
        ],
      },
    ],
    regel: `„Bis jetzt“: present perfect, ${richtig[0]} (${formenText(v)}).`,
    hilfe: "Sagt der Satz, wann es war (yesterday, last week, ago, in 2019)? Dann past simple. Geht es um „bis jetzt“ (since, so far, never, already, just, yet)? Dann present perfect.",
    tipp: "Such das Signalwort: Bei „bis jetzt“ brauchst du have oder has und die 3. Form des Verbs.",
  };
}

// ---------- Past perfect ----------
type PPVorlage = { t: string; v: string; adv?: "already" | "not" | "never" | "just"; st?: number; zwei?: { v: string; vorn: boolean } };
const PAST_PERFECT: PPVorlage[] = [
  { t: "When we arrived at the station, the train ___.", v: "leave", adv: "already" },
  { t: "{S} couldn't get into the house because {s} ___ {poss} key.", v: "lose" },
  { t: "{S} {war} hungry because {s} ___ anything all day.", v: "eat", adv: "not" },
  { t: "When {s} got to the party, most people ___ home.", v: "go", adv: "already" },
  { t: "{S} knew the film because {s} ___ it before.", v: "see" },
  { t: "The teacher was angry because {s} ___ {poss} homework.", v: "do", adv: "not" },
  { t: "{S} ___ a plane before that trip to Spain.", v: "fly", adv: "never" },
  { t: "By the time the bus came, {s} ___ for half an hour.", v: "wait" },
  { t: "{S} {war} tired because {s} ___ well.", v: "sleep", adv: "not" },
  { t: "When I phoned {o}, {s} ___ {poss} homework.", v: "finish", adv: "just" },
  { t: "The streets were wet because it ___ all night.", v: "rain" },
  { t: "{S} found the money that {s} ___ the week before.", v: "lose" },
  { t: "After {s} ___ {poss} homework, {s} ___ TV.", v: "finish", st: 1, zwei: { v: "watch", vorn: true } },
  { t: "{S} ___ to bed after {s} ___ the dishes.", v: "wash", st: 1, zwei: { v: "go", vorn: false } },
  { t: "When {s} ___ home, {poss} parents ___ dinner.", v: "cook", adv: "already", st: 2, zwei: { v: "come", vorn: false } },
  { t: "{S} ___ the test because {s} ___ hard.", v: "study", st: 2, zwei: { v: "pass", vorn: false } },
];
function hadForm(v: Verb, adv?: string, form = v.pp): string {
  return adv === "not" ? `hadn't ${form}` : adv ? `had ${adv} ${form}` : `had ${form}`;
}
function pastPerfectSatz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, PAST_PERFECT, st);
  const v = verb(vo.v);
  // „When I phoned {o}“: nicht ich selbst und nicht wir
  const w = pick(rng, WER.filter((x) => !vo.t.includes("{o}") || (x.p !== "I" && x.p !== "we")));
  const text = setze(vo.t, w);
  const cue = vo.adv === "not" ? `not ${v.base}` : vo.adv ? `${vo.adv} / ${v.base}` : v.base;
  const pp: { cue: string; richtig: string[]; fehler: Fehler[] } = {
    cue,
    richtig: [...pps(v).map((x) => hadForm(v, vo.adv, x)), ...(DAUER.has(v.base) || v.base === "rain" ? [`had been ${v.ing}`] : [])],
    fehler: [
      F(vo.adv === "not" ? `didn't ${v.base}` : vo.adv ? `${vo.adv} ${v.past}` : v.past, "Was vorher passiert war: past perfect (had + 3. Form)", { fix: false }),
      F(vo.adv === "not" ? `hasn't ${v.pp}` : `has ${vo.adv ? `${vo.adv} ` : ""}${v.pp}`, "In der Vergangenheit: had, nicht have oder has"),
      ...(v.pp !== v.past ? [F(hadForm(v, vo.adv, v.past), "Nach had steht die 3. Form")] : [F(hadForm(v, vo.adv, v.base), "Nach had steht die 3. Form")]),
    ],
  };
  const hilfe = "Past perfect: had und die 3. Form. Es zeigt, was in der Vergangenheit schon vorher passiert war.";
  if (!vo.zwei) {
    return { text, luecken: [pp], regel: `Das war vorher: past perfect, ${pp.richtig[0]} (${formenText(v)}).`, hilfe, tipp: "Was ist zuerst passiert? Für das Frühere nimmst du had und die 3. Form." };
  }
  const v2 = verb(vo.zwei.v);
  const ps = { cue: v2.base, richtig: pasts(v2), fehler: [F(hadForm(v2), "Das Spätere steht im past simple", { fix: false }), F(v2.base, "Vergangenheit: die 2. Form, nicht die Grundform")] };
  return {
    text,
    luecken: vo.zwei.vorn ? [pp, ps] : [ps, pp],
    regel: `Zuerst: past perfect (${pp.richtig[0]}), danach: past simple (${v2.past}).`,
    hilfe,
    tipp: "Was ist zuerst passiert? Das Frühere bekommt had und die 3. Form, das Spätere die 2. Form.",
    titel: "Fill in the past perfect and the past simple.",
  };
}

// ---------- used to ----------
type UsedVorlage = { t: string; v: string; art: "ja" | "nein" | "frage"; st?: number };
const USED_TO: UsedVorlage[] = [
  { t: "When {s} {war} little, {s} ___ with toy cars.", v: "play", art: "ja" },
  { t: "{S} ___ in a small flat, but now {poss} family has a house.", v: "live", art: "ja" },
  { t: "My grandpa ___ to work by bike every day.", v: "ride", art: "ja" },
  { t: "When {s} {war} a child, {s} ___ in ghosts.", v: "believe", art: "ja" },
  { t: "{S} ___ a lot of sweets, but not any more.", v: "eat", art: "ja" },
  { t: "There ___ a cinema in our street, but now it's a supermarket.", v: "be", art: "ja" },
  { t: "{S} ___ to bed at eight when {s} {war} small.", v: "go", art: "ja" },
  { t: "My mum ___ in a bank before she became a teacher.", v: "work", art: "ja" },
  { t: "{S} ___ the piano, but {s} stopped two years ago.", v: "play", art: "ja" },
  { t: "We ___ our holidays at the seaside every summer.", v: "spend", art: "ja" },
  { t: "{S} ___ vegetables. Now they are {poss} favourite food.", v: "like", art: "nein", st: 1 },
  { t: "{S} ___ much, but now books are {poss} hobby.", v: "read", art: "nein", st: 1 },
  { t: "My brother ___ his room, but now he cleans it every week.", v: "clean", art: "nein", st: 1 },
  { t: "___ you ___ in Linz before you moved here?", v: "live", art: "frage", st: 2 },
  { t: "___ your dad ___ football when he was young?", v: "play", art: "frage", st: 2 },
  { t: "___ they ___ to the same school?", v: "go", art: "frage", st: 2 },
];
function usedToSatz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, USED_TO, st);
  const w = pick(rng, WER);
  const text = setze(vo.t, w);
  const v = verb(vo.v);
  const base = v.base;
  const hilfe = "used to + Grundform: was früher oft so war und jetzt nicht mehr. Bei Verneinung und Frage mit did: didn't use to, did … use to.";
  if (vo.art === "frage") {
    return {
      text,
      luecken: [
        { richtig: ["Did"], fehler: [F("Do", "Es geht um früher: Did"), F("Were", "Fragen mit used to bildest du mit did")] },
        { cue: base, richtig: [`use to ${base}`], fehler: [F(`used to ${base}`, "Nach did steht use to, ohne d"), F(`use to ${v.ing}`, "Nach use to steht die Grundform")] },
      ],
      regel: `Frage: Did … use to ${base}? (nach did ohne d).`,
      hilfe,
      tipp: "In der Frage steht did am Anfang, und nach did verliert used sein d.",
    };
  }
  if (vo.art === "nein") {
    return {
      text,
      luecken: [{ cue: `not ${base}`, richtig: [`didn't use to ${base}`], fehler: [F(`didn't used to ${base}`, "Nach didn't steht use to, ohne d"), F(`don't use to ${base}`, "Es geht um früher: didn't"), F(`used to not ${base}`, "Verneinung mit didn't: didn't use to", { fix: false })] }],
      regel: `Verneinung: didn't use to ${base}.`,
      hilfe,
      tipp: "In der Verneinung steht didn't, und nach didn't verliert used sein d.",
    };
  }
  const ing = v.ing;
  return {
    text,
    luecken: [{ cue: base, richtig: [`used to ${base}`], fehler: [F(`use to ${base}`, "Im Aussagesatz: used to (mit d)"), F(`used to ${ing}`, "Nach used to steht die Grundform"), F(`was used to ${base}`, "used to braucht kein was")] }],
    regel: `Früher, jetzt nicht mehr: used to ${base}.`,
    hilfe,
    tipp: "Im Aussagesatz schreibst du used mit d und danach die Grundform des Verbs.",
  };
}

// ---------- Present perfect progressive ----------
type PPPVorlage = { t: string; v: string; st?: number; frage?: boolean };
const PERFECT_PROGRESSIVE: PPPVorlage[] = [
  { t: "{S} ___ for the bus for twenty minutes.", v: "wait" },
  { t: "{S} ___ in this flat since 2018.", v: "live" },
  { t: "{S} ___ English for three years.", v: "learn" },
  { t: "{S} ___ tennis since {s} {war} eight.", v: "play" },
  { t: "It ___ all day.", v: "rain" },
  { t: "{S} ___ in the garden all morning.", v: "work" },
  { t: "{S} ___ TV for two hours. Turn it off!", v: "watch" },
  { t: "{S} ___ for the test all afternoon.", v: "study" },
  { t: "{S} ___ this book since Monday.", v: "read" },
  { t: "{S} ___ since seven o'clock.", v: "cook" },
  { t: "{S} ___ in the pool for an hour.", v: "swim" },
  { t: "{S} ___ the guitar for six months.", v: "learn", st: 1 },
  { t: "{S} look tired. Have they ___ all night?", v: "work", st: 2, frage: true },
  { t: "How long ___ {s} ___ for the bus?", v: "wait", st: 2, frage: true },
  { t: "How long ___ {s} ___ the violin?", v: "play", st: 2, frage: true },
];
function perfectProgressiveSatz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, PERFECT_PROGRESSIVE, st);
  const v = verb(vo.v);
  // „My parents look tired. Have they …“: nur mit they
  const w = pick(rng, WER.filter((x) => !vo.t.includes("look tired") || x.p === "they"));
  const text = setze(vo.t, w);
  const p: Pronomen = vo.t.startsWith("It ") ? "it" : w.p;
  const h = hat(p);
  const hilfe = "Present perfect progressive: have oder has, dann been und die -ing-Form. Es zeigt, wie lange etwas schon dauert.";
  const tipp = "Bau es in drei Teilen: have oder has, dann been, dann das Verb mit -ing.";
  if (vo.frage && vo.t.startsWith("How long")) {
    return {
      text,
      luecken: [
        { richtig: [h], fehler: [F(anderesHat(p), "have oder has passt nicht zur Person"), F(ist(p), "Wie lange schon? have oder has, nicht am, is oder are")] },
        { cue: v.base, richtig: [`been ${v.ing}`], fehler: [F(v.ing, "Nach have oder has fehlt been"), F(`been ${v.base}`, "Nach been steht die -ing-Form"), F(v.pp, "Gefragt ist die Verlaufsform: been + -ing", { fix: false })] },
      ],
      regel: `Frage: How long ${h} ${pron(p)} been ${v.ing} …?`,
      hilfe,
      tipp,
      titel: "Fill in the present perfect progressive.",
    };
  }
  if (vo.frage) {
    // „Have they been working all night?“: die Lücke ist nach dem Subjekt
    return {
      text,
      luecken: [{ cue: v.base, richtig: [`been ${v.ing}`], fehler: [F(v.ing, "Nach have fehlt been"), F(`been ${v.base}`, "Nach been steht die -ing-Form"), F(v.pp, "Gefragt ist die Verlaufsform: been + -ing", { fix: false })] }],
      regel: `Frage: Have … been ${v.ing}?`,
      hilfe,
      tipp,
    };
  }
  return {
    text,
    luecken: [
      {
        cue: v.base,
        richtig: [`${h} been ${v.ing}`],
        fehler: [
          F(`${anderesHat(p)} been ${v.ing}`, "have oder has passt nicht zur Person"),
          F(`${h} been ${v.base}`, "Nach been steht die -ing-Form"),
          F(`${ist(p)} ${v.ing}`, "Wie lange schon? present perfect progressive, nicht present progressive"),
          F(`${h} ${v.pp}`, "Gefragt ist die Verlaufsform: been + -ing", { fix: false }),
        ],
      },
    ],
    regel: `Wie lange schon: ${h} been ${v.ing}.`,
    hilfe,
    tipp,
  };
}

// ---------- Mixed tenses ----------
type Zeit = "ps" | "prog" | "past" | "pp" | "will" | "going" | "pastprog";
type MixVorlage = { t: string; v: string; z: Zeit; st?: number; nurEs?: boolean };
const MIXED: MixVorlage[] = [
  { t: "{S} ___ football every Saturday.", v: "play", z: "ps" },
  { t: "{S} usually ___ breakfast at seven.", v: "have", z: "ps" },
  { t: "Look! {S} ___ to the bus stop.", v: "run", z: "prog" },
  { t: "Be quiet, please. {S} ___ for a test.", v: "study", z: "prog" },
  { t: "{S} ___ {poss} aunt in Salzburg last summer.", v: "visit", z: "past" },
  { t: "{S} ___ a funny video yesterday.", v: "watch", z: "past" },
  { t: "{S} ___ here since 2018.", v: "live", z: "pp" },
  { t: "{S} ___ two tests so far this week.", v: "write", z: "pp" },
  { t: "Look at those dark clouds! It ___.", v: "rain", z: "going", nurEs: true },
  { t: "I think it ___ tomorrow.", v: "snow", z: "will", nurEs: true },
  { t: "{S} ___ a book when the phone rang.", v: "read", z: "pastprog", st: 1 },
  { t: "At eight o'clock last night {s} ___ dinner.", v: "cook", z: "pastprog", st: 1 },
  { t: "{S} never ___ coffee in the evening because it keeps {o} awake.", v: "drink", z: "ps", st: 1 },
  { t: "{S} ___ {poss} grandma tomorrow. It's all planned.", v: "visit", z: "going", st: 1 },
  { t: "Right now {s} ___ in the garden.", v: "work", z: "prog", st: 1 },
  { t: "{S} ___ {poss} phone two days ago.", v: "lose", z: "past", st: 1 },
  { t: "{S} ___ this song three times so far today.", v: "hear", z: "pp", st: 2 },
  { t: "While {s} ___ home, it started to rain.", v: "walk", z: "pastprog", st: 2 },
];
function form(z: Zeit, v: Verb, p: Pronomen, nicht = false): string {
  switch (z) {
    case "ps":
      return nicht ? `${dritte(p) ? "doesn't" : "don't"} ${v.base}` : simple(v, p);
    case "prog":
      return `${ist(p)} ${v.ing}`;
    case "past":
      return v.past;
    case "pp":
      return `${hat(p)} ${v.pp}`;
    case "will":
      return `will ${v.base}`;
    case "going":
      return `${ist(p)} going to ${v.base}`;
    case "pastprog":
      return `${war(p)} ${v.ing}`;
  }
}
const ZEIT_NAME: Record<Zeit, string> = { ps: "present simple", prog: "present progressive", past: "past simple", pp: "present perfect", will: "will-future", going: "going to", pastprog: "past progressive" };
const ZEIT_GRUND: Record<Zeit, string> = {
  ps: "Was regelmäßig passiert: present simple",
  prog: "Was gerade jetzt passiert: present progressive",
  past: "Ein Zeitpunkt in der Vergangenheit: past simple",
  pp: "„Bis jetzt“: present perfect",
  will: "Eine Vermutung über die Zukunft (I think): will",
  going: "Etwas, das man schon sieht oder fest plant: going to",
  pastprog: "Was gerade im Gang war, als etwas passierte: past progressive",
};
const ANDERE: Record<Zeit, Zeit[]> = { ps: ["prog", "past"], prog: ["ps", "past"], past: ["pp", "ps"], pp: ["past", "ps"], will: ["ps", "prog"], going: ["ps", "past"], pastprog: ["past", "prog"] };
function mixedSatz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, MIXED, st);
  const v = verb(vo.v);
  const w = pick(rng, WER);
  const text = setze(vo.t, w);
  const p: Pronomen = vo.nurEs ? "it" : w.p;
  const richtig = form(vo.z, v, p);
  // was nur anders gemeint, aber auch richtiges Englisch wäre, ist nie der Fehler eines Korrekturtexts
  const schwach = (z: Zeit) => vo.z === "going" || vo.z === "will" || (vo.z === "pastprog" && z === "past");
  const fehler = ANDERE[vo.z].map((z) => F(form(z, v, p), `${ZEIT_GRUND[vo.z]}, nicht ${ZEIT_NAME[z]}`, schwach(z) ? { fix: false } : {}));
  if (vo.z === "ps" && dritte(p)) fehler.push(F(v.base, "Bei he, she, it: das -s nicht vergessen"));
  if (vo.z === "going") fehler.push(F(`going to ${v.base}`, "going to braucht am, is oder are"));
  if (vo.z === "pp") fehler.push(F(`${anderesHat(p)} ${v.pp}`, "have oder has passt nicht zur Person"));
  return {
    text,
    // Pläne gehen auch mit dem present progressive (is visiting tomorrow)
    luecken: [{ cue: v.base, richtig: [richtig, ...(vo.z === "pp" && DAUER.has(v.base) ? [`${hat(p)} been ${v.ing}`] : []), ...(vo.z === "going" && !vo.nurEs ? [form("prog", v, p)] : [])], fehler }],
    regel: `${ZEIT_GRUND[vo.z]}: ${richtig}.`,
    hilfe: "Such das Signalwort: every, usually, never (present simple), now, Look! (present progressive), yesterday, ago (past simple), since, so far (present perfect), when, while (past progressive), I think (will).",
    tipp: "Frag dich zuerst: Jetzt, regelmäßig, früher, bis jetzt oder in der Zukunft? Dann wähl die passende Zeit.",
  };
}

// ---------- Satzlisten: ein Satz, die richtigen Antworten, typische Fehler ----------
type Eintrag = { t: string; r: string[]; f: Fehler[]; regel: string; st?: number; cue?: string };
const E = (t: string, r: string | string[], f: Fehler[], regel: string, st = 0, cue?: string): Eintrag => ({ t, r: typeof r === "string" ? [r] : r, f, regel, st, cue });
function ausListe(liste: readonly Eintrag[], hilfe: string, tipp: string): (rng: Rng, st: Stufe) => Satz {
  return (rng, st) => {
    const e = waehle(rng, liste, st);
    return { text: e.t, luecken: [{ cue: e.cue, richtig: e.r, fehler: e.f }], regel: e.regel, hilfe, tipp };
  };
}

// ---------- a, an, the ----------
const A_STATT_AN = "Vor einem Vokal-Laut steht an";
const AN_STATT_A = "Vor einem Konsonanten-Laut steht a";
const THE_STATT_A = "Zum ersten Mal genannt, ein Beruf oder „there is“: a oder an";
const A_STATT_THE = "Das gibt es nur einmal oder es ist schon bekannt: the";
const ARTIKEL: Eintrag[] = [
  E("There is ___ apple in my lunch box.", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "apple beginnt mit einem Vokal-Laut: an apple."),
  E("My uncle is ___ engineer.", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "Beruf, engineer mit Vokal-Laut: an engineer."),
  E("My aunt is ___ doctor.", "a", [F("an", AN_STATT_A), F("the", THE_STATT_A, { fix: false })], "Beruf, doctor mit Konsonanten-Laut: a doctor."),
  E("I've got ___ old bike.", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "old beginnt mit einem Vokal-Laut: an old bike."),
  E("There was ___ elephant in the zoo.", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "elephant beginnt mit einem Vokal-Laut: an elephant."),
  E("We have English lessons three times ___ week.", "a", [F("an", AN_STATT_A), F("the", THE_STATT_A, { fix: false })], "Wie oft pro Woche: three times a week."),
  E("She has got ___ brother and two sisters.", "a", [F("an", AN_STATT_A), F("the", THE_STATT_A, { fix: false })], "Zum ersten Mal genannt: a brother."),
  E("What ___ amazing view!", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "Ausruf mit What, amazing mit Vokal-Laut: What an amazing view!"),
  E("___ sun is very hot today.", "the", [F("a", A_STATT_THE), F("an", A_STATT_THE)], "Es gibt nur eine Sonne: the sun."),
  E("Can you see ___ moon tonight?", "the", [F("a", A_STATT_THE), F("an", A_STATT_THE)], "Es gibt nur einen Mond: the moon."),
  E("This is ___ best day of my life!", "the", [F("a", A_STATT_THE), F("an", A_STATT_THE)], "Vor dem Superlativ steht the: the best day."),
  E("My sister plays ___ guitar in a band.", "the", [F("a", "Ein Instrument spielen: play the …", { fix: false }), F("an", A_STATT_THE)], "Ein Instrument spielen: play the guitar."),
  E("We always go for a walk in ___ evening.", "the", [F("a", A_STATT_THE), F("an", A_STATT_THE)], "Tageszeit: in the evening."),
  E("I bought a dress and a hat. ___ dress is red.", "The", [F("A", A_STATT_THE), F("An", A_STATT_THE)], "Das Kleid ist schon genannt: the dress."),
  E("It takes half ___ hour to get there.", "an", [F("a", A_STATT_AN), F("the", THE_STATT_A, { fix: false })], "hour spricht man ohne h, mit Vokal-Laut: an hour.", 1),
  E("She wants to study at ___ university in England.", "a", [F("an", "university beginnt mit dem Laut „ju“, einem Konsonanten-Laut: a"), F("the", THE_STATT_A, { fix: false })], "university spricht man mit „ju“: a university.", 1),
  E("He is ___ honest boy. He never lies.", "an", [F("a", "honest spricht man ohne h, mit Vokal-Laut: an"), F("the", THE_STATT_A, { fix: false })], "honest spricht man ohne h: an honest boy.", 1),
  E("We waited for ___ hour, but nobody came.", "an", [F("a", "hour spricht man ohne h, mit Vokal-Laut: an"), F("the", THE_STATT_A, { fix: false })], "hour spricht man ohne h: an hour.", 1),
  E("Vienna is ___ capital of Austria.", "the", [F("a", A_STATT_THE), F("an", A_STATT_THE)], "Es gibt nur eine Hauptstadt von Österreich: the capital.", 1),
  E("He was ___ first person to finish the test.", "the", [F("a", "Vor first, second, last steht the"), F("an", A_STATT_THE)], "Vor einer Ordnungszahl steht the: the first person.", 1),
  E("She is ___ European pupil from Spain.", "a", [F("an", "European beginnt mit dem Laut „ju“, einem Konsonanten-Laut: a"), F("the", THE_STATT_A, { fix: false })], "European spricht man mit „ju“: a European pupil.", 2),
  E("We met ___ MP at the station.", "an", [F("a", "MP spricht man „em-pi“, mit Vokal-Laut: an"), F("the", THE_STATT_A, { fix: false })], "MP spricht man „em-pi“: an MP.", 2),
  E("Is there ___ hotel near here?", "a", [F("an", "hotel spricht man mit h: a"), F("the", THE_STATT_A, { fix: false })], "hotel spricht man mit h: a hotel.", 2),
  E("We travelled to ___ USA last year.", "the", [F("a", "Länder mit States, Kingdom oder Republic: the"), F("an", A_STATT_THE)], "the USA, the UK.", 2),
];

// ---------- Personalpronomen und Possessivbegleiter ----------
const SUBJ = "Wer etwas tut (vor dem Verb): I, you, he, she, it, we, they";
const OBJEKT = "Nach dem Verb oder einer Präposition: me, you, him, her, it, us, them";
const POSSB = "Wem etwas gehört (vor einem Nomen): my, your, his, her, its, our, their";
const PRONOMEN: Eintrag[] = [
  E("Where is Tom? I can't see ___.", "him", [F("he", OBJEKT), F("his", OBJEKT)], "Nach dem Verb see: him."),
  E("Anna and I are friends. ___ go to the same school.", "We", [F("Us", SUBJ), F("Our", SUBJ)], "Anna und ich, vor dem Verb: we."),
  E("This is my sister. ___ name is Lisa.", "Her", [F("She", POSSB), F("His", "Bei einem Mädchen: her")], "Der Name der Schwester: her name."),
  E("My brother loves football. ___ plays every day.", "He", [F("Him", SUBJ), F("His", SUBJ)], "Der Bruder tut etwas: he."),
  E("Our neighbours have a dog. ___ dog is very big.", "Their", [F("They", POSSB), F("Them", POSSB)], "Der Hund der Nachbarn: their dog."),
  E("Can you help ___, please? I can't open the door.", "me", [F("I", OBJEKT), F("my", OBJEKT)], "Nach help: me."),
  E("Lena and Paul are in my class. I sit next to ___.", "them", [F("they", OBJEKT), F("their", OBJEKT)], "Nach der Präposition next to: them."),
  E("The cat is hungry. Give ___ some food.", "it", [F("its", OBJEKT), F("it's", "it's heißt it is; nach give: it")], "Nach give: it."),
  E("We love ___ new teacher.", "our", [F("us", POSSB), F("we", POSSB)], "Der Lehrer gehört zu uns: our teacher."),
  E("Paul, is this ___ pencil?", "your", [F("you", POSSB), F("yours", "Vor einem Nomen: your")], "Vor dem Nomen pencil: your."),
  E("I like Mia. ___ is very funny.", "She", [F("Her", SUBJ), F("He", "Bei einem Mädchen: she")], "Mia tut etwas: she."),
  E("My dad is a teacher. I often help ___ in the garden.", "him", [F("he", OBJEKT), F("his", OBJEKT)], "Nach help: him."),
  E("The dog wagged ___ tail.", "its", [F("it's", "it's heißt it is; wem es gehört: its"), F("it", POSSB)], "Der Schwanz des Hundes: its tail.", 1),
  E("Mr Brown is our teacher. We like ___ lessons.", "his", [F("him", POSSB), F("he", POSSB)], "Die Stunden von Mr Brown: his lessons.", 1),
  E("Sarah phoned ___ grandma yesterday.", "her", [F("she", POSSB), F("his", "Bei einem Mädchen: her")], "Sarahs Oma: her grandma.", 1),
  E("Between you and ___, I don't like this song.", "me", [F("I", OBJEKT), F("my", OBJEKT)], "Nach der Präposition between: me.", 2),
  E("The children took ___ bags and left.", "their", [F("them", POSSB), F("there", "there heißt dort; wem es gehört: their")], "Die Taschen der Kinder: their bags.", 2),
  E("My friend and ___ went to the cinema.", "I", [F("me", SUBJ), F("my", SUBJ)], "Vor dem Verb, mit and: My friend and I.", 2),
];

// ---------- Präpositionen des Ortes ----------
const ORT_AT = "Ein Punkt oder ein Ort, an dem man etwas tut (at home, at school, at the bus stop): at";
const ORT_IN = "In einem Raum, einer Stadt oder einem Land (in the kitchen, in Vienna): in";
const ORT_ON = "Auf einer Fläche, an der Wand, im Bus oder Zug, im Stockwerk (on the table, on the wall, on the bus): on";
const PRAEP_ORT: Eintrag[] = [
  E("My mum is ___ the kitchen.", "in", [F("on", ORT_IN), F("at", ORT_IN)], "In einem Raum: in the kitchen."),
  E("The picture is ___ the wall.", "on", [F("in", ORT_ON), F("at", ORT_ON)], "An der Wand: on the wall."),
  E("I'm not ___ home at the moment.", "at", [F("in", ORT_AT), F("on", ORT_AT)], "Feste Wendung: at home."),
  E("We live ___ Vienna.", "in", [F("at", ORT_IN), F("on", ORT_IN)], "In einer Stadt: in Vienna."),
  E("Your book is ___ the table.", "on", [F("in", ORT_ON), F("at", ORT_ON)], "Auf einer Fläche: on the table."),
  E("Wait for me ___ the bus stop.", "at", [F("in", ORT_AT), F("on", ORT_AT)], "Ein Punkt: at the bus stop."),
  E("The children are ___ school until one o'clock.", "at", [F("in", ORT_AT), F("on", ORT_AT)], "Feste Wendung: at school."),
  E("There are a lot of fish ___ the lake.", "in", [F("on", ORT_IN), F("at", ORT_IN)], "Im Wasser: in the lake."),
  E("I met my friend ___ the bus this morning.", "on", [F("in", ORT_ON), F("at", ORT_ON)], "Im Bus: on the bus."),
  E("My grandparents live ___ Italy.", "in", [F("at", ORT_IN), F("on", ORT_IN)], "In einem Land: in Italy."),
  E("Lisa is still ___ bed.", "in", [F("on", "Feste Wendung: in bed"), F("at", "Feste Wendung: in bed")], "Feste Wendung: in bed."),
  E("Somebody is ___ the door.", "at", [F("in", ORT_AT), F("on", ORT_AT)], "Ein Punkt: at the door."),
  E("Our flat is ___ the third floor.", "on", [F("in", ORT_ON), F("at", ORT_ON)], "Im Stockwerk: on the third floor.", 1),
  E("Look at the girl ___ the picture.", "in", [F("on", "Auf einem Bild: in the picture"), F("at", "Auf einem Bild: in the picture")], "Auf einem Bild: in the picture.", 1),
  E("Turn left and the school is ___ the right.", "on", [F("in", "Rechts, links: on the right, on the left"), F("at", "Rechts, links: on the right, on the left")], "Rechts: on the right.", 1),
  E("There are many tall buildings ___ New York.", "in", [F("on", ORT_IN), F("at", ORT_IN)], "In einer Stadt: in New York.", 1),
  E("I saw your photo ___ the internet.", "on", [F("in", "Im Internet, im Fernsehen: on the internet, on TV"), F("at", "Im Internet, im Fernsehen: on the internet, on TV")], "Im Internet: on the internet.", 2),
  E("We had a great time ___ the party.", "at", [F("in", "Bei einer Veranstaltung: at the party, at the concert"), F("on", "Bei einer Veranstaltung: at the party, at the concert")], "Bei einer Veranstaltung: at the party.", 2),
  E("Write your name ___ the top of the page.", "at", [F("in", "Oben, unten auf der Seite: at the top, at the bottom"), F("on", "Oben, unten auf der Seite: at the top, at the bottom")], "Oben auf der Seite: at the top.", 2),
  E("The keys are ___ my jacket pocket.", "in", [F("on", ORT_IN), F("at", ORT_IN)], "In der Tasche: in my pocket.", 2),
];

// ---------- Gerund oder Infinitiv ----------
const ING_VERB = "Nach enjoy, finish, mind, avoid, keep, suggest und miss steht die -ing-Form";
const TO_VERB = "Nach want, decide, hope, plan, learn, promise, would like und forget steht to + Grundform";
const ING_PRAEP = "Nach einer Präposition (in, at, of, about, before, after, without) steht die -ing-Form";
const GERUND: Eintrag[] = [
  E("I enjoy ___ to music.", "listening", [F("to listen", ING_VERB), F("listen", ING_VERB)], "Nach enjoy: listening.", 0, "listen"),
  E("She wants ___ a new phone.", "to buy", [F("buying", TO_VERB), F("buy", TO_VERB)], "Nach want: to buy.", 0, "buy"),
  E("We decided ___ at home.", "to stay", [F("staying", TO_VERB), F("stay", TO_VERB)], "Nach decide: to stay.", 0, "stay"),
  E("Have you finished ___ your room?", "cleaning", [F("to clean", ING_VERB), F("clean", ING_VERB)], "Nach finish: cleaning.", 0, "clean"),
  E("I hope ___ you soon.", "to see", [F("seeing", TO_VERB), F("see", TO_VERB)], "Nach hope: to see.", 0, "see"),
  E("My brother is good at ___ pictures.", "drawing", [F("to draw", ING_PRAEP), F("draw", ING_PRAEP)], "Nach at: drawing.", 0, "draw"),
  E("Would you like ___ something?", "to drink", [F("drinking", TO_VERB), F("drink", TO_VERB)], "Nach would like: to drink.", 0, "drink"),
  E("Do you mind ___ the window?", "opening", [F("to open", ING_VERB), F("open", ING_VERB)], "Nach mind: opening.", 0, "open"),
  E("They are planning ___ to Spain.", "to fly", [F("flying", TO_VERB), F("fly", TO_VERB)], "Nach plan: to fly.", 0, "fly"),
  E("I'm interested in ___ more about animals.", "learning", [F("to learn", ING_PRAEP), F("learn", ING_PRAEP)], "Nach in: learning.", 0, "learn"),
  E("Paul learnt ___ when he was five.", "to swim", [F("swimming", TO_VERB), F("swim", TO_VERB)], "Nach learn: to swim.", 0, "swim"),
  E("Please stop ___ so loud!", "talking", [F("to talk", "stop + -ing: aufhören, etwas zu tun"), F("talk", ING_VERB)], "Aufhören zu reden: stop talking.", 0, "talk"),
  E("He promised ___ me with my homework.", "to help", [F("helping", TO_VERB), F("help", TO_VERB)], "Nach promise: to help.", 1, "help"),
  E("She left without ___ goodbye.", "saying", [F("to say", ING_PRAEP), F("say", ING_PRAEP)], "Nach without: saying.", 1, "say"),
  E("Try to avoid ___ too much sugar.", "eating", [F("to eat", ING_VERB), F("eat", ING_VERB)], "Nach avoid: eating.", 1, "eat"),
  E("Don't forget ___ the door when you leave.", "to lock", [F("locking", "forget + to: vergessen, etwas zu tun"), F("lock", TO_VERB)], "Nicht vergessen, es zu tun: forget to lock.", 1, "lock"),
  E("I'm looking forward to ___ my cousins.", "seeing", [F("see", "Nach looking forward to steht die -ing-Form (to ist hier eine Präposition)"), F("to see", "Nach looking forward to steht die -ing-Form")], "looking forward to + -ing: seeing.", 2, "see"),
  E("He suggested ___ a taxi.", "taking", [F("to take", ING_VERB), F("take", ING_VERB)], "Nach suggest: taking.", 2, "take"),
  E("She kept ___ the same question.", "asking", [F("to ask", ING_VERB), F("ask", ING_VERB)], "Nach keep: asking.", 2, "ask"),
  E("We are thinking about ___ a dog.", "getting", [F("to get", ING_PRAEP), F("get", ING_PRAEP)], "Nach about: getting.", 2, "get"),
];

// ---------- Adjektiv oder Adverb ----------
const ADVERB = "Wie jemand etwas tut (beim Verb): das Adverb, meist mit -ly";
const ADJEKTIV = "Wie etwas oder jemand ist (beim Nomen oder nach be, look, smell, taste, feel): das Adjektiv";
const ADVERBS: Eintrag[] = [
  E("She sings ___.", "beautifully", [F("beautiful", ADVERB), F("beautifuly", "beautiful + ly: beautifully, mit zwei l")], "Wie sie singt: beautifully.", 0, "beautiful"),
  E("Please drive ___.", "carefully", [F("careful", ADVERB), F("carefuly", "careful + ly: carefully, mit zwei l")], "Wie man fährt: carefully.", 0, "careful"),
  E("He is a ___ driver.", "careful", [F("carefully", ADJEKTIV), F("carefuly", ADJEKTIV)], "Beim Nomen driver: careful.", 0, "careful"),
  E("The children played ___ in the garden.", "happily", [F("happy", ADVERB), F("happyly", "y wird zu i: happily")], "Wie sie spielten: happily.", 0, "happy"),
  E("Can you speak more ___, please?", "slowly", [F("slow", ADVERB), F("slowlly", "slow + ly: slowly")], "Wie man spricht: slowly.", 0, "slow"),
  E("Tom is very ___ today.", "quiet", [F("quietly", ADJEKTIV), F("quite", "quite heißt ziemlich; leise: quiet")], "Nach is: quiet.", 0, "quiet"),
  E("She plays the piano very ___.", "well", [F("good", "Das Adverb zu good ist well"), F("goodly", "Das Adverb zu good ist well")], "Wie sie spielt: well.", 0, "good"),
  E("This cake tastes ___.", "good", [F("well", ADJEKTIV), F("goodly", ADJEKTIV)], "Nach taste: good.", 0, "good"),
  E("He answered the question ___.", "correctly", [F("correct", ADVERB), F("correctely", "correct + ly: correctly")], "Wie er antwortete: correctly.", 0, "correct"),
  E("The test was ___.", "easy", [F("easily", ADJEKTIV), F("easyly", ADJEKTIV)], "Nach was: easy.", 0, "easy"),
  E("I can do this exercise ___.", "easily", [F("easy", ADVERB), F("easyly", "y wird zu i: easily")], "Wie ich es mache: easily.", 0, "easy"),
  E("She runs very ___.", "fast", [F("fastly", "fast bleibt als Adverb fast"), F("faster", "Kein Vergleich: fast")], "fast bleibt fast.", 1, "fast"),
  E("He works very ___.", "hard", [F("hardly", "hardly heißt kaum; viel arbeiten: hard"), F("hardy", "hard bleibt als Adverb hard")], "hard bleibt hard (hardly heißt kaum).", 1, "hard"),
  E("You look ___. Are you OK?", "tired", [F("tiredly", ADJEKTIV), F("tiring", "Wie jemand sich fühlt: tired")], "Nach look: tired.", 1, "tired"),
  E("The dog barked ___ all night.", "loudly", [F("loud", ADVERB), F("loudy", "loud + ly: loudly")], "Wie er bellte: loudly.", 1, "loud"),
  E("She shouted ___ at her brother.", "angrily", [F("angry", ADVERB), F("angryly", "y wird zu i: angrily")], "Wie sie schrie: angrily.", 1, "angry"),
  E("The flowers smell ___.", "lovely", [F("lovelily", ADJEKTIV), F("love", ADJEKTIV)], "Nach smell: lovely (lovely ist ein Adjektiv).", 2, "lovely"),
  E("He did ___ in the test and got a 5.", "badly", [F("bad", ADVERB), F("badily", "bad + ly: badly")], "Wie er schrieb: badly.", 2, "bad"),
  E("We were ___ late for the concert.", "terribly", [F("terrible", "Vor einem Adjektiv (late) steht das Adverb"), F("terribley", "terrible: das e fällt weg, terribly")], "Vor dem Adjektiv late: terribly.", 2, "terrible"),
  E("I feel ___ about the test tomorrow.", "nervous", [F("nervously", ADJEKTIV), F("nervos", "nervous mit ou")], "Nach feel: nervous.", 2, "nervous"),
];

// ---------- Question Tags ----------
const TAG_REGEL = "Bejahter Satz, verneinter Tag; verneinter Satz, bejahter Tag. Das Hilfsverb kommt aus dem Satz, ohne Hilfsverb do, does oder did.";
const TAG = "Hilfsverb und Person aus dem Satz, Bejahung und Verneinung umgedreht";
const TAGS: Eintrag[] = [
  E("You're from Vienna, ___?", "aren't you", [F("isn't you", "Bei you: are"), F("don't you", "Im Satz steht are: aren't"), F("are you", "Bejahter Satz: verneinter Tag")], "You are …: aren't you?"),
  E("Lena is your sister, ___?", "isn't she", [F("isn't he", "Lena ist ein Mädchen: she"), F("is she", "Bejahter Satz: verneinter Tag"), F("doesn't she", "Im Satz steht is: isn't")], "Lena is …: isn't she?"),
  E("Paul plays the drums, ___?", "doesn't he", [F("don't he", "Bei he: does"), F("isn't he", "Ohne Hilfsverb im Satz: does"), F("does he", "Bejahter Satz: verneinter Tag")], "plays ohne Hilfsverb: doesn't he?"),
  E("They live in Graz, ___?", "don't they", [F("doesn't they", "Bei they: do"), F("aren't they", "Ohne Hilfsverb im Satz: do"), F("do they", "Bejahter Satz: verneinter Tag")], "live ohne Hilfsverb: don't they?"),
  E("You can swim, ___?", "can't you", [F("don't you", "Im Satz steht can: can't"), F("can you", "Bejahter Satz: verneinter Tag"), F("aren't you", "Im Satz steht can: can't")], "You can …: can't you?"),
  E("It isn't cold today, ___?", "is it", [F("isn't it", "Verneinter Satz: bejahter Tag"), F("does it", "Im Satz steht is: is it"), F("is not it", TAG)], "It isn't …: is it?"),
  E("We haven't got any milk, ___?", "have we", [F("haven't we", "Verneinter Satz: bejahter Tag"), F("do we", "Im Satz steht have: have we"), F("has we", "Bei we: have")], "We haven't got …: have we?"),
  E("Mia was at the party, ___?", "wasn't she", [F("weren't she", "Bei she: was"), F("was she", "Bejahter Satz: verneinter Tag"), F("didn't she", "Im Satz steht was: wasn't")], "Mia was …: wasn't she?"),
  E("You went to the cinema, ___?", "didn't you", [F("don't you", "Vergangenheit ohne Hilfsverb: did"), F("did you", "Bejahter Satz: verneinter Tag"), F("weren't you", "Ohne Hilfsverb im Satz: did")], "went ohne Hilfsverb: didn't you?"),
  E("Your parents don't eat meat, ___?", "do they", [F("don't they", "Verneinter Satz: bejahter Tag"), F("does they", "Bei they: do"), F("are they", "Im Satz steht don't: do they")], "They don't …: do they?"),
  E("Tom can't come tomorrow, ___?", "can he", [F("can't he", "Verneinter Satz: bejahter Tag"), F("does he", "Im Satz steht can't: can he"), F("can't him", TAG)], "Tom can't …: can he?"),
  E("She will help us, ___?", "won't she", [F("will she", "Bejahter Satz: verneinter Tag"), F("doesn't she", "Im Satz steht will: won't"), F("willn't she", "Die Verneinung von will ist won't")], "She will …: won't she?"),
  E("You have finished your homework, ___?", "haven't you", [F("don't you", "Im Satz steht have: haven't"), F("have you", "Bejahter Satz: verneinter Tag"), F("hasn't you", "Bei you: have")], "You have finished …: haven't you?", 1),
  E("Your brother doesn't like spiders, ___?", "does he", [F("doesn't he", "Verneinter Satz: bejahter Tag"), F("is he", "Im Satz steht doesn't: does he"), F("do he", "Bei he: does")], "He doesn't …: does he?", 1),
  E("The children were tired, ___?", "weren't they", [F("wasn't they", "Bei they: were"), F("were they", "Bejahter Satz: verneinter Tag"), F("didn't they", "Im Satz steht were: weren't")], "The children were …: weren't they?", 1),
  E("We should go now, ___?", "shouldn't we", [F("should we", "Bejahter Satz: verneinter Tag"), F("don't we", "Im Satz steht should: shouldn't"), F("shouldn't us", TAG)], "We should …: shouldn't we?", 1),
  E("Nobody called, ___?", "did they", [F("didn't they", "nobody ist verneint: bejahter Tag"), F("did he", "Nach nobody, everybody steht they"), F("didn't he", "nobody ist verneint: bejahter Tag")], "Nobody …: did they?", 2),
  E("Let's play a game, ___?", "shall we", [F("let we", "Nach Let's: shall we"), F("don't we", "Nach Let's: shall we"), F("will we", "Nach Let's: shall we")], "Let's …: shall we?", 2),
  E("Your sister has got a new job, ___?", "hasn't she", [F("doesn't she", "Im Satz steht has got: hasn't"), F("has she", "Bejahter Satz: verneinter Tag"), F("haven't she", "Bei she: has")], "She has got …: hasn't she?", 2),
];

// ---------- Relativsätze ----------
const WHO = "Für Personen: who (oder that)";
const WHICH = "Für Dinge und Tiere: which (oder that)";
const WHOSE = "Wem etwas gehört: whose";
const RELATIVE: Eintrag[] = [
  E("The girl ___ lives next door is my best friend.", ["who", "that"], [F("which", WHO), F("whose", WHO)], "Eine Person: who (oder that)."),
  E("This is the book ___ won the prize.", ["which", "that"], [F("who", WHICH), F("whose", WHICH)], "Ein Ding: which (oder that)."),
  E("I have a friend ___ speaks four languages.", ["who", "that"], [F("which", WHO), F("whose", WHO)], "Eine Person: who (oder that)."),
  E("The bus ___ goes to the station is number 13.", ["which", "that"], [F("who", WHICH), F("whose", WHICH)], "Ein Ding: which (oder that)."),
  E("That's the boy ___ dog bit me.", "whose", [F("who", WHOSE), F("which", WHOSE)], "Der Hund gehört dem Buben: whose dog."),
  E("We need a teacher ___ can explain things well.", ["who", "that"], [F("which", WHO), F("whose", WHO)], "Eine Person: who (oder that)."),
  E("I like films ___ make me laugh.", ["which", "that"], [F("who", WHICH), F("whose", WHICH)], "Dinge: which (oder that)."),
  E("The woman ___ car was stolen called the police.", "whose", [F("who", WHOSE), F("which", WHOSE)], "Das Auto gehört der Frau: whose car."),
  E("Is this the cat ___ lives in your garden?", ["which", "that"], [F("who", WHICH), F("whose", WHICH)], "Ein Tier: which (oder that)."),
  E("The man ___ repairs our bikes is very nice.", ["who", "that"], [F("which", WHO), F("whose", WHO)], "Eine Person: who (oder that)."),
  E("He's the singer ___ songs are on the radio all the time.", "whose", [F("who", WHOSE), F("which", WHOSE)], "Die Lieder gehören dem Sänger: whose songs."),
  E("Where is the cake ___ was on the table?", ["which", "that"], [F("who", WHICH), F("what", "what ist kein Relativpronomen: which oder that")], "Ein Ding: which (oder that).", 1),
  E("The pupils ___ finished early can go home.", ["who", "that"], [F("which", WHO), F("what", "what ist kein Relativpronomen: who oder that")], "Personen: who (oder that).", 1),
  E("I met a girl ___ brother plays in my team.", "whose", [F("who", WHOSE), F("who's", "who's heißt who is; wem es gehört: whose")], "Ihr Bruder: whose brother.", 1),
  E("The museum, ___ opened in 1891, is very famous.", "which", [F("that", "Mit Beistrichen (Zusatz): which, nicht that"), F("who", WHICH)], "Zusatz mit Beistrichen, ein Ding: which.", 2),
  E("My grandma, ___ is 85, still rides her bike.", "who", [F("that", "Mit Beistrichen (Zusatz): who, nicht that"), F("which", WHO)], "Zusatz mit Beistrichen, eine Person: who.", 2),
  E("Do you know anybody ___ parents are doctors?", "whose", [F("who", WHOSE), F("who's", "who's heißt who is; wem es gehört: whose")], "Die Eltern: whose parents.", 2),
];

// ---------- Reflexivpronomen und each other ----------
const SELF = "Das Reflexivpronomen passt zur Person: myself, yourself, himself, herself, itself, ourselves, yourselves, themselves";
const EACH = "Einander, gegenseitig: each other";
const REFLEXIVE: Eintrag[] = [
  E("I hurt ___ when I fell off my bike.", "myself", [F("me", SELF), F("meself", "Bei I: myself")], "Bei I: myself."),
  E("Lena taught ___ to play the guitar.", "herself", [F("her", SELF), F("himself", "Bei einem Mädchen: herself")], "Bei Lena: herself."),
  E("Paul cut ___ with a knife.", "himself", [F("him", SELF), F("hisself", "Bei he: himself")], "Bei Paul: himself."),
  E("We enjoyed ___ at the party.", "ourselves", [F("us", SELF), F("ourself", "Bei we: ourselves (Mehrzahl)")], "Bei we: ourselves."),
  E("They built the treehouse ___.", "themselves", [F("theirselves", "Bei they: themselves"), F("them", SELF)], "Bei they: themselves."),
  E("Look at ___ in the mirror, Tom!", "yourself", [F("you", SELF), F("yourselves", "Eine Person: yourself")], "Eine Person (you): yourself."),
  E("Children, help ___ to some cake!", "yourselves", [F("yourself", "Mehrere Personen: yourselves"), F("you", SELF)], "Mehrere Personen (you): yourselves."),
  E("The cat is washing ___.", "itself", [F("it", SELF), F("herself", "Für ein Tier: itself")], "Bei it: itself."),
  E("My parents love ___. They are very happy.", "each other", [F("themselves", EACH), F("each others", "Einander: each other, ohne s")], "Sie lieben einander: each other."),
  E("Lena and Mia phone ___ every evening.", "each other", [F("themselves", EACH), F("each others", "Einander: each other, ohne s")], "Sie rufen einander an: each other."),
  E("Did you make this cake ___, Anna?", "yourself", [F("you", SELF), F("yourselves", "Eine Person: yourself")], "Eine Person (you): yourself.", 1),
  E("The two teams didn't like ___.", "each other", [F("themselves", EACH), F("theirselves", EACH)], "Gegenseitig: each other.", 1),
  E("He is old enough to look after ___.", "himself", [F("him", SELF), F("hisself", "Bei he: himself")], "Bei he: himself.", 1),
  E("I live on my own and cook for ___.", "myself", [F("me", SELF), F("meself", "Bei I: myself")], "Bei I: myself.", 2),
  E("We looked at ___ and laughed.", "each other", [F("ourselves", "Einander angeschaut: each other", { fix: false }), F("us", EACH), F("ourself", EACH)], "Einander: each other.", 2),
];

// ---------- Ersatzformen der Modalverben ----------
const ERSATZ = "can, must und may gibt es nur in der Gegenwart. Für andere Zeiten: be able to (können), have to (müssen), be allowed to (dürfen).";
const MODAL_SUBST: Eintrag[] = [
  E("Yesterday I ___ stay at home because I was ill.", "had to", [F("must", "Vergangenheit von must: had to"), F("musted", "must hat keine Vergangenheit: had to"), F("have to", "Es war gestern: had to")], "Vergangenheit von müssen: had to.", 0, "must"),
  E("Next year my sister ___ drive a car.", "will be able to", [F("will can", "Nach will: be able to"), F("can", "Es ist nächstes Jahr: will be able to", { fix: false }), F("will able to", "be fehlt: will be able to")], "Zukunft von können: will be able to.", 0, "can"),
  E("When I was five, I ___ read.", ["could", "was able to"], [F("can", "Es war früher: could"), F("canned", "can hat die Vergangenheit could")], "Vergangenheit von können: could (oder was able to).", 0, "can"),
  E("We ___ use our phones in class last year.", ["weren't allowed to", "couldn't"], [F("mayn't", "Vergangenheit von nicht dürfen: weren't allowed to"), F("didn't may", "Vergangenheit von nicht dürfen: weren't allowed to"), F("aren't allowed to", "Es war letztes Jahr: weren't allowed to")], "Vergangenheit von nicht dürfen: weren't allowed to.", 0, "may not"),
  E("Tomorrow we ___ get up early.", "will have to", [F("will must", "Nach will: have to"), F("must to", "must steht ohne to"), F("had to", "Es ist morgen: will have to")], "Zukunft von müssen: will have to.", 0, "must"),
  E("Last week Paul ___ wear a uniform at the concert.", "had to", [F("must", "Vergangenheit von must: had to"), F("has to", "Es war letzte Woche: had to"), F("musted", "must hat keine Vergangenheit: had to")], "Vergangenheit von müssen: had to.", 0, "must"),
  E("Next summer I ___ stay up late.", "will be allowed to", [F("will may", "Nach will: be allowed to"), F("may", "Es ist nächsten Sommer: will be allowed to", { fix: false }), F("will allowed to", "be fehlt: will be allowed to")], "Zukunft von dürfen: will be allowed to.", 0, "may"),
  E("Last night we ___ do a lot of homework.", "had to", [F("must", "Vergangenheit von must: had to"), F("musted", "must hat keine Vergangenheit: had to"), F("have to", "Es war gestern Abend: had to")], "Vergangenheit von müssen: had to.", 0, "must"),
  E("My grandma ___ swim very well when she was young.", ["could", "was able to"], [F("can", "Es war früher: could"), F("canned", "can hat die Vergangenheit could"), F("is able to", "Es war früher: was able to")], "Vergangenheit von können: could (oder was able to).", 0, "can"),
  E("Next week I ___ go to school because it's a holiday.", "won't have to", [F("mustn't", "mustn't heißt: darf nicht. Nicht müssen: don't have to"), F("won't must", "Nach won't: have to"), F("don't have to", "Es ist nächste Woche: won't have to")], "Zukunft von nicht müssen: won't have to.", 0, "not must"),
  E("Two years ago my little brother ___ ride a bike.", ["couldn't", "wasn't able to"], [F("can't", "Es war früher: couldn't"), F("couldn't able to", "couldn't oder wasn't able to, nicht beides"), F("didn't can", "can wird mit not verneint, nicht mit didn't")], "Vergangenheit von nicht können: couldn't (oder wasn't able to).", 0, "not can"),
  E("I'm sorry, I ___ come to your party tomorrow.", ["won't be able to", "can't"], [F("won't can", "Nach won't: be able to"), F("don't can", "can wird mit not verneint, nicht mit don't")], "Zukunft von nicht können: won't be able to (oder can't).", 0, "not can"),
  E("My brother has ___ wear glasses since he was ten.", "had to", [F("must", "Nach has: had to (3. Form von have to)"), F("have to", "Nach has steht die 3. Form: had to")], "Present perfect von müssen: has had to.", 1, "must"),
  E("After the accident she ___ walk for months.", ["wasn't able to", "couldn't"], [F("can't", "Es war früher: wasn't able to"), F("couldn't able to", "couldn't oder wasn't able to, nicht beides"), F("isn't able to", "Es war früher: wasn't able to")], "Vergangenheit von nicht können: wasn't able to (oder couldn't).", 1, "not can"),
  E("You ___ wear a helmet. It's the rule.", ["have to", "must"], [F("has to", "Bei you: have to"), F("must to", "must steht ohne to"), F("had to", "Es ist eine Regel jetzt: have to")], "Müssen in der Gegenwart: have to (oder must).", 1, "must"),
  E("I hope I ___ visit you next year.", ["will be able to", "can"], [F("will can", "Nach will: be able to"), F("can to", "can steht ohne to"), F("will able to", "be fehlt: will be able to")], "Zukunft von können: will be able to.", 2, "can"),
  E("He ___ leave school early yesterday, so he went home at eleven.", ["was allowed to", "could"], [F("may", "Vergangenheit von dürfen: was allowed to"), F("was allow to", "be allowed to: allowed mit -ed"), F("is allowed to", "Es war gestern: was allowed to")], "Vergangenheit von dürfen: was allowed to.", 2, "may"),
];

// ---------- if-Sätze Typ 3 ----------
type If3Vorlage = { t: string; wenn: string; dann: string; wennNicht?: boolean; dannNicht?: boolean; st?: number; hauptVorn?: boolean };
const IF3: If3Vorlage[] = [
  { t: "If {s} ___ earlier, {s} ___ the bus.", wenn: "leave", dann: "catch" },
  { t: "If {s} ___ more, {s} ___ the test.", wenn: "study", dann: "pass" },
  { t: "If it ___, we ___ to the beach.", wenn: "rain", dann: "go", wennNicht: true },
  { t: "If {s} ___ about the party, {s} ___.", wenn: "know", dann: "come" },
  { t: "If {s} ___ the alarm, {s} ___ up on time.", wenn: "hear", dann: "wake" },
  { t: "If {s} ___ an umbrella, {s} ___ wet.", wenn: "take", dann: "get", dannNicht: true },
  { t: "If {s} ___ breakfast, {s} ___ so hungry.", wenn: "eat", dann: "be", dannNicht: true },
  { t: "If {s} ___ the instructions, {s} ___ what to do.", wenn: "read", dann: "know" },
  { t: "If {s} ___ {poss} money, {s} ___ the bike.", wenn: "save", dann: "buy", st: 1 },
  { t: "If {s} ___ more careful, {s} ___ the glass.", wenn: "be", dann: "break", dannNicht: true, st: 1 },
  { t: "{S} ___ the match if {s} ___ better.", wenn: "play", dann: "win", hauptVorn: true, st: 2 },
  { t: "{S} ___ so tired if {s} ___ to bed earlier.", wenn: "go", dann: "be", dannNicht: true, hauptVorn: true, st: 2 },
];
function if3Satz(rng: Rng, st: Stufe): Satz {
  const vo = waehle(rng, IF3, st);
  const w = pick(rng, WER);
  // „If my parents …“: am Satzanfang „If“, danach die Person klein (außer I und Namen)
  const klein = (x: Wer) => (x.p === "I" || !/^(We|My|Our)\b/.test(x.text) ? x.text : x.text.charAt(0).toLowerCase() + x.text.slice(1));
  const text = vo.hauptVorn ? setze(vo.t, w) : setze(vo.t.replace("If {s}", `If ${klein(w)}`), w);
  const a = verb(vo.wenn);
  const b = verb(vo.dann);
  const hadF = (v: Verb, nicht?: boolean, x = v.pp) => `${nicht ? "hadn't" : "had"} ${x}`;
  const wouldF = (v: Verb, nicht?: boolean, x = v.pp) => `${nicht ? "wouldn't" : "would"} have ${x}`;
  const wenn = {
    cue: vo.wennNicht ? `not ${a.base}` : a.base,
    richtig: pps(a).map((x) => hadF(a, vo.wennNicht, x)),
    fehler: [
      F(wouldF(a, vo.wennNicht), "Im if-Satz steht kein would: had + 3. Form"),
      F(vo.wennNicht ? `didn't ${a.base}` : a.past, "Typ 3: im if-Satz had + 3. Form (past perfect)"),
      ...(a.pp !== a.past ? [F(hadF(a, vo.wennNicht, a.past), "Nach had steht die 3. Form")] : []),
    ],
  };
  const dann = {
    cue: vo.dannNicht ? `not ${b.base}` : b.base,
    richtig: pps(b).map((x) => wouldF(b, vo.dannNicht, x)),
    fehler: [
      F(`${vo.dannNicht ? "wouldn't" : "would"} ${b.base}`, "Typ 3: would have + 3. Form, nicht would + Grundform"),
      F(`${vo.dannNicht ? "won't" : "will"} have ${b.pp}`, "Typ 3: would, nicht will"),
      F(hadF(b, vo.dannNicht), "Im Hauptsatz steht would have, nicht had"),
    ],
  };
  return {
    text,
    luecken: vo.hauptVorn ? [dann, wenn] : [wenn, dann],
    regel: `if-Satz Typ 3: if + ${wenn.richtig[0]}, Hauptsatz: ${dann.richtig[0]}.`,
    hilfe: "if-Satz Typ 3 (es ist nicht passiert): im if-Satz had + 3. Form, im Hauptsatz would have + 3. Form.",
    tipp: "Im Teil mit if steht kein would. Das would have kommt in den anderen Teil.",
  };
}

// ---------- Passiv in anderen Zeiten ----------
const P_PAST = "Passiv in der Vergangenheit: was oder were + 3. Form";
const P_PP = "Passiv im present perfect: has oder have been + 3. Form";
const P_WILL = "Passiv in der Zukunft: will be + 3. Form";
const P_MODAL = "Passiv mit Modalverb: can, must, should + be + 3. Form";
const PASSIVE_TENSES: Eintrag[] = [
  E("The bridge ___ in 1990.", "was built", [F("is built", P_PAST), F("built", "Passiv braucht was oder were"), F("was build", "Nach was steht die 3. Form")], "1990, Vergangenheit: was built.", 0, "build"),
  E("These photos ___ last summer.", "were taken", [F("was taken", "Mehrzahl (photos): were"), F("are taken", P_PAST), F("were took", "Nach were steht die 3. Form")], "Vergangenheit, Mehrzahl: were taken.", 0, "take"),
  E("The window ___ by a football yesterday.", "was broken", [F("is broken", P_PAST), F("was broke", "Nach was steht die 3. Form"), F("broke", "Passiv braucht was oder were")], "Gestern: was broken.", 0, "break"),
  E("The new school ___ next year.", "will be opened", [F("will opened", "be fehlt: will be + 3. Form"), F("is opened", P_WILL), F("will be open", "Nach be steht die 3. Form")], "Nächstes Jahr: will be opened.", 0, "open"),
  E("The letters have already ___.", "been sent", [F("sent", "Passiv braucht been"), F("be sent", P_PP), F("been send", "Nach been steht die 3. Form")], "present perfect, Passiv: have already been sent.", 0, "send"),
  E("Harry Potter ___ by J. K. Rowling.", "was written", [F("is written", P_PAST), F("was wrote", "Nach was steht die 3. Form"), F("wrote", "Passiv braucht was oder were")], "Das Buch wurde geschrieben: was written.", 0, "write"),
  E("The results ___ tomorrow.", "will be announced", [F("will announced", "be fehlt: will be + 3. Form"), F("are announced", P_WILL), F("will be announce", "Nach be steht die 3. Form")], "Morgen: will be announced.", 0, "announce"),
  E("This homework must ___ by Friday.", "be done", [F("done", P_MODAL), F("be did", "Nach be steht die 3. Form"), F("been done", P_MODAL)], "Nach must: be done.", 0, "do"),
  E("Phones can't ___ during the test.", "be used", [F("used", P_MODAL), F("be use", "Nach be steht die 3. Form"), F("been used", P_MODAL)], "Nach can't: be used.", 0, "use"),
  E("My bike ___. I can't find it anywhere.", ["has been stolen", "was stolen"], [F("has stolen", "Passiv braucht been"), F("have been stolen", "Bei my bike (es): has"), F("has been stole", "Nach been steht die 3. Form")], "Bis jetzt, mit Folge: has been stolen.", 0, "steal"),
  E("The film ___ by millions of people since 2010.", "has been watched", [F("was watched", "since: present perfect, has been + 3. Form"), F("has watched", "Passiv braucht been"), F("have been watched", "Bei the film: has")], "since: has been watched.", 1, "watch"),
  E("The cake ___ when we arrived.", "had been eaten", [F("was eaten", "Schon vorher passiert: had been + 3. Form", { fix: false }), F("had eaten", "Passiv braucht been"), F("had been ate", "Nach been steht die 3. Form")], "Schon vorher: had been eaten.", 1, "eat"),
  E("The rooms should ___ every day.", "be cleaned", [F("cleaned", P_MODAL), F("be clean", "Nach be steht die 3. Form"), F("been cleaned", P_MODAL)], "Nach should: be cleaned.", 1, "clean"),
  E("The house ___ at the moment.", "is being painted", [F("is painted", "Gerade jetzt: is being + 3. Form"), F("is being paint", "Nach being steht die 3. Form"), F("being painted", "am, is oder are fehlt")], "Gerade jetzt: is being painted.", 2, "paint"),
  E("The road ___ when we drove past.", "was being repaired", [F("was repaired", "Gerade im Gang: was being + 3. Form"), F("was being repair", "Nach being steht die 3. Form"), F("were being repaired", "Bei the road: was")], "Gerade im Gang: was being repaired.", 2, "repair"),
];

const BEISPIEL_ZEITEN = "Frag dich zuerst: Wann passiert es? Dann wähl die Form von be in dieser Zeit und häng die 3. Form an.";

/** Die Fähigkeiten dieses Moduls, für lib/englisch-grammatik.ts FAEHIGKEITEN. */
export const MEHR_FAEHIGKEITEN: Record<string, Faehigkeit> = {
  "englisch.tenses.perfect-past": { titel: T("Present perfect or past simple? Fill in the right form."), wahl: T("Choose the right form."), satz: perfectPastSatz },
  "englisch.tenses.pastperfect": { titel: T("Fill in the past perfect."), wahl: T("Choose the right form."), satz: pastPerfectSatz },
  "englisch.tenses.usedto": { titel: T("Fill in used to and the verb."), wahl: T("Choose the right form."), satz: usedToSatz },
  "englisch.tenses.perfectprogressive": { titel: T("Fill in the present perfect progressive."), wahl: T("Choose the present perfect progressive form."), satz: perfectProgressiveSatz },
  "englisch.tenses.mixed": { titel: T("Fill in the right tense."), wahl: T("Choose the right tense."), satz: mixedSatz },
  "englisch.grammar.artikel": { titel: T("Fill in a, an or the."), wahl: T("Choose the right article."), satz: ausListe(ARTIKEL, "a vor einem Konsonanten-Laut, an vor einem Vokal-Laut (es zählt, wie man das Wort spricht). the, wenn es das nur einmal gibt oder es schon bekannt ist.", "Sprich das nächste Wort laut: Beginnt es mit einem Vokal-Laut? Und ist es irgendeines oder ein bestimmtes?") },
  "englisch.grammar.pronomen": { titel: T("Fill in the right pronoun or possessive."), wahl: T("Choose the right word."), satz: ausListe(PRONOMEN, "Wer tut etwas? I, you, he, she, it, we, they. Wen oder wem? me, you, him, her, it, us, them. Wem gehört es? my, your, his, her, its, our, their.", "Schau, wo die Lücke steht: vor dem Verb, nach dem Verb oder vor einem Nomen?") },
  "englisch.grammar.praep-ort": { titel: T("Fill in in, on or at."), wahl: T("Choose the right preposition."), satz: ausListe(PRAEP_ORT, "in: in etwas drin (Raum, Stadt, Land). on: auf einer Fläche, an der Wand, im Bus. at: an einem Punkt oder Ort, an dem man etwas tut.", "Stell dir den Ort vor: drin, darauf oder an einem Punkt? Manche Wendungen musst du dir merken (at home, in bed).") },
  "englisch.grammar.gerund": { titel: T("Fill in the -ing form or to + verb."), wahl: T("Choose the right form."), satz: ausListe(GERUND, "-ing nach enjoy, finish, mind, avoid, keep, suggest und nach Präpositionen. to + Grundform nach want, decide, hope, plan, learn, promise, would like.", "Schau auf das Wort direkt vor der Lücke: Ist es ein Verb aus einer der Listen oder eine Präposition?") },
  "englisch.grammar.adverbs": { titel: T("Adjective or adverb? Fill in the right form."), wahl: T("Choose the right word."), satz: ausListe(ADVERBS, "Adjektiv: wie etwas ist (beim Nomen, nach be, look, feel, taste, smell). Adverb: wie man etwas tut (beim Verb), meist Adjektiv + -ly.", "Frag dich: Beschreibt das Wort eine Person oder Sache, oder wie jemand etwas tut?") },
  "englisch.grammar.questiontags": { titel: T("Add the question tag."), wahl: T("Choose the right question tag."), satz: ausListe(TAGS, TAG_REGEL, "Such im Satz das Hilfsverb (is, can, have, will …). Gibt es keines, nimm do, does oder did.") },
  "englisch.grammar.relative": { titel: T("Fill in who, which or whose."), wahl: T("Choose the right relative pronoun."), satz: ausListe(RELATIVE, "who für Personen, which für Dinge und Tiere, that für beide (nicht mit Beistrichen), whose für wem etwas gehört.", "Auf wen oder was bezieht sich der Relativsatz: eine Person, ein Ding, oder gehört jemandem etwas?") },
  "englisch.grammar.reflexive": { titel: T("Fill in the reflexive pronoun or each other."), wahl: T("Choose the right word."), satz: ausListe(REFLEXIVE, "Reflexivpronomen (sich selbst): myself, yourself, himself, herself, itself, ourselves, yourselves, themselves. Einander: each other.", "Wer ist gemeint? Tut jemand etwas mit sich selbst, oder tun zwei es gegenseitig?") },
  "englisch.grammar.modal-substitutes": { titel: T("Fill in the right form (be able to, have to, be allowed to)."), wahl: T("Choose the right form."), satz: ausListe(MODAL_SUBST, ERSATZ, "Wann ist es: gestern, jetzt oder morgen? Dann bild die Ersatzform in dieser Zeit.") },
  "englisch.grammar.if3": { titel: T("Fill in the verbs (if-clause type 3)."), wahl: T("Choose the right forms."), satz: if3Satz },
  "englisch.grammar.passive-tenses": { titel: T("Fill in the passive."), wahl: T("Choose the right passive form."), satz: ausListe(PASSIVE_TENSES, "Passiv: eine Form von be und die 3. Form. Die Zeit steckt in be: was oder were, has been, will be, can be.", BEISPIEL_ZEITEN) },
};
