/**
 * English words for the built-in grammar tasks (lib/englisch-grammatik.ts): verbs with all their forms,
 * about a hundred irregular verbs with their German meaning, the people a sentence is about, the
 * actions they do in a sentence, nouns with their plural and adjectives with their comparison.
 *
 * British English, as taught at Austrian schools; American forms that are also right (gotten, learned)
 * count as variants. Every word list and every sentence part is written for this app: nothing is taken
 * from a school book (More!, Prime Time, Way2Go …), IQS or Matura task. First names are made up for the
 * tasks, never a student's name.
 *
 * `stufe` of a word: 0 = first year (Klasse 1, 5. Schulstufe), 1 = second and third year, 2 = later or
 * rare. A task of a level only uses words up to that level (lib/englisch-grammatik.ts wortStufe).
 */
import type { Rng } from "./schulbuch-zahlen";

export type WortStufe = 0 | 1 | 2;
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// ---------- spelling rules ----------
/** One-syllable (or end-stressed) verbs that double the last consonant: run, running; stop, stopped. */
const DOUBLE = new Set("run swim sit get cut hit let put set shut bet dig win begin forget stop plan shop drop chat hug jog travel prefer".split(" "));

/** he/she/it form: plays, watches, goes, studies, has. */
export function sForm(base: string): string {
  if (base === "have") return "has";
  if (base === "be") return "is";
  if (/(s|sh|ch|x|z|o)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}
/** -ing form: playing, making, running, lying, seeing, being. */
export function ingForm(base: string): string {
  if (base === "be") return "being";
  if (/ie$/.test(base)) return `${base.slice(0, -2)}ying`;
  if (/[^aeiouy]e$/.test(base)) return `${base.slice(0, -1)}ing`;
  if (DOUBLE.has(base)) return `${base}${base.slice(-1)}ing`;
  return `${base}ing`;
}
/** regular past and past participle: played, liked, stopped, studied. */
export function edForm(base: string): string {
  if (/e$/.test(base)) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  if (DOUBLE.has(base)) return `${base}${base.slice(-1)}ed`;
  return `${base}ed`;
}

// ---------- typical spelling mistakes (only used as wrong answers) ----------
/** "watchs", "gos", "studys", "haves": the -s just added. */
export const naivS = (base: string) => `${base}s`;
/** "writeing", "runing", "lieing": the -ing just added. */
export const naivIng = (base: string) => `${base}ing`;
/** "goed", "buyed", "catched", "writed", "runned": an irregular verb made regular. */
export const naivEd = (base: string) => edForm(base);
/** "stoped", "studyed", "plaied": the -ed form spelt wrong; null when there is no typical one. */
export function falschesEd(base: string): string | null {
  if (DOUBLE.has(base)) return `${base}ed`;
  if (/[^aeiou]y$/.test(base)) return `${base}ed`;
  if (/[aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  return null;
}

// ---------- verbs ----------
export type Verb = {
  base: string;
  s: string;
  ing: string;
  past: string;
  pp: string;
  /** other right forms: learned next to learnt, gotten (American English) next to got */
  pastAlt: string[];
  ppAlt: string[];
  ingAlt: string[];
  irregular: boolean;
  stufe: WortStufe;
};

/**
 * The irregular verbs: base form, past simple, past participle (other right forms after a slash), German
 * meaning (with a hint where one German word has two English ones: „machen (einen Kuchen)“ is make,
 * „machen (die Hausübung)“ is do), Stufe, and what can follow the verb in a sentence about the past
 * ("a big fish in the lake"); "|nie" says the sentence works with "has never …", "|schon" with
 * "has already …", nothing that it is a sentence for the past only. Verbs without a sentence part
 * (be, mean, ring …) are only asked as forms.
 */
const UNREGELMAESSIG_TABELLE = `
be|was/were|been|sein|0|
beat|beat|beaten|besiegen (eine Mannschaft, einen Gegner)|2|{poss} big brother at chess|nie
become|became|become|werden|1|a member of the football club|schon
begin|began|begun|beginnen, anfangen|0|a new book|schon
bend|bent|bent|biegen, verbiegen|2|{poss} glasses by mistake|schon
bet|bet|bet|wetten|2|five euros on the match|nie
bite|bit|bitten|beißen|2|into a very sour lemon|nie
bleed|bled|bled|bluten|2|
blow|blew|blown|blasen, pusten|1|out the candles on {poss} birthday cake|schon
break|broke|broken|brechen, kaputt machen|1|{poss} arm|nie
bring|brought|brought|bringen|0|a cake to school|schon
build|built|built|bauen|1|a tree house in the garden|schon
burn|burnt/burned|burnt/burned|verbrennen, anbrennen lassen|2|the toast|schon
buy|bought|bought|kaufen|0|a new pair of trainers|schon
catch|caught|caught|fangen|1|a big fish in the lake|nie
choose|chose|chosen|wählen, aussuchen|1|a book for the holidays|schon
come|came|come|kommen|0|home from school|schon
cost|cost|cost|kosten|1|
cut|cut|cut|schneiden|0|the birthday cake|schon
dig|dug|dug|graben|2|a hole in the garden|schon
do|did|done|tun, machen (die Hausübung)|0|{poss} homework|schon
draw|drew|drawn|zeichnen|1|a picture of a horse|schon
dream|dreamt/dreamed|dreamt/dreamed|träumen|2|about a holiday in Greece|nie
drink|drank|drunk|trinken|0|a big glass of apple juice|schon
drive|drove|driven|(mit dem Auto) fahren|1|to Salzburg|nie
eat|ate|eaten|essen|0|sushi|nie
fall|fell|fallen|fallen, hinfallen|1|off {poss} bike|nie
feed|fed|fed|füttern|1|the ducks at the lake|schon
feel|felt|felt|fühlen|1|
fight|fought|fought|kämpfen, streiten|1|with {poss} little brother|nie
find|found|found|finden|0|a wallet in the park|nie
fly|flew|flown|fliegen|0|to Spain|nie
forget|forgot|forgotten|vergessen|0|{poss} PE kit|schon
forgive|forgave|forgiven|verzeihen|2|{poss} best friend|schon
freeze|froze|frozen|frieren, gefrieren|2|
get|got|got/gotten|bekommen|0|a puppy for {poss} birthday|schon
give|gave|given|geben|0|{poss} little sister a present|schon
go|went|gone|gehen|0|home early|schon
grow|grew|grown|wachsen, anbauen|1|tomatoes in the garden|nie
hang|hung|hung|aufhängen|2|a poster on the wall|schon
have|had|had|haben|0|
hear|heard|heard|hören|0|a strange noise in the garden|schon
hide|hid|hidden|verstecken|1|the presents under the bed|schon
hit|hit|hit|schlagen, treffen (mit dem Ball)|1|the ball over the fence|schon
hold|held|held|halten|1|a snake at the zoo|nie
hurt|hurt|hurt|verletzen, wehtun|1|{poss} knee in the PE lesson|schon
keep|kept|kept|behalten|1|the secret for a long time|
know|knew|known|wissen, kennen|0|all the answers in the test|
lay|laid|laid|(den Tisch) decken, (ein Ei) legen|2|the table for dinner|schon
lead|led|led|führen|2|the group up the mountain|schon
learn|learnt/learned|learnt/learned|lernen|0|a new song in the music lesson|schon
leave|left|left|verlassen, abfahren|1|the house|schon
lend|lent|lent|(her)leihen, verleihen|1|{poss} bike to a friend|schon
let|let|let|lassen|1|the dog sleep on the sofa|nie
lie|lay|lain|liegen|2|in the sun all afternoon|
light|lit|lit|anzünden|2|the candles on the cake|schon
lose|lost|lost|verlieren|0|{poss} keys|schon
make|made|made|machen, herstellen (z. B. einen Kuchen)|0|a chocolate cake|schon
mean|meant|meant|bedeuten, meinen|2|
meet|met|met|treffen (Freunde)|0|{poss} friends at the pool|schon
pay|paid|paid|bezahlen|1|for the ice cream|schon
put|put|put|hinlegen, hinstellen|0|the milk in the fridge|schon
read|read|read|lesen|0|a book about sharks|nie
ride|rode|ridden|reiten, (Rad) fahren|0|a horse|nie
ring|rang|rung|läuten, klingeln|1|
rise|rose|risen|aufgehen (Sonne), steigen|2|
run|ran|run|laufen, rennen|0|five kilometres|nie
say|said|said|sagen|0|
see|saw|seen|sehen|0|a dolphin|nie
sell|sold|sold|verkaufen|1|{poss} old bike|schon
send|sent|sent|schicken, senden|1|a postcard to {poss} grandma|schon
set|set|set|(den Wecker) stellen|2|{poss} alarm for six o'clock|schon
shake|shook|shaken|schütteln|2|hands with the head teacher|nie
shine|shone|shone|scheinen (Sonne), leuchten|2|
shoot|shot|shot|schießen|2|three goals|schon
show|showed|shown/showed|zeigen|1|us {poss} new phone|schon
shut|shut|shut|schließen, zumachen|1|the window|schon
sing|sang|sung|singen|0|a song at the school concert|nie
sink|sank|sunk|sinken|2|
sit|sat|sat|sitzen|0|in the front row|nie
sleep|slept|slept|schlafen|0|in a tent|nie
smell|smelt/smelled|smelt/smelled|riechen|2|the fresh bread|schon
speak|spoke|spoken|sprechen|1|to the head teacher|schon
spell|spelt/spelled|spelt/spelled|buchstabieren|2|all the new words correctly|schon
spend|spent|spent|ausgeben (Geld), verbringen (Zeit)|1|all {poss} pocket money|schon
spill|spilt/spilled|spilt/spilled|verschütten|2|orange juice on the carpet|schon
stand|stood|stood|stehen|1|in the rain for an hour|
steal|stole|stolen|stehlen|2|a cookie from the kitchen|schon
stick|stuck|stuck|kleben|2|a photo into {poss} diary|schon
sting|stung|stung|stechen (Biene, Wespe)|2|
swim|swam|swum|schwimmen|0|across the lake|nie
take|took|taken|nehmen|0|a lot of photos|schon
teach|taught|taught|lehren, unterrichten|1|{poss} little sister to ride a bike|schon
tear|tore|torn|zerreißen|2|{poss} jeans on a fence|schon
tell|told|told|erzählen|0|us a funny story|schon
think|thought|thought|denken|0|about the problem for a long time|
throw|threw|thrown|werfen|1|the ball to {poss} dog|schon
understand|understood|understood|verstehen|1|the maths homework|schon
wake|woke|woken|aufwachen, wecken|1|up at five o'clock|
wear|wore|worn|(Kleidung) tragen, anhaben|1|a funny hat|nie
win|won|won|gewinnen|0|the school chess competition|nie
write|wrote|written|schreiben|0|a long email to {poss} cousin|schon
`;

export type Unregelmaessig = {
  base: string;
  past: string[];
  pp: string[];
  de: string;
  stufe: WortStufe;
  /** what follows the verb in a sentence ("a big fish in the lake"), with {poss} for my, his, her … */
  objekt: string | null;
  /** present perfect with "never" (an experience) or "already" (just done); null: past only */
  perfekt: "nie" | "schon" | null;
};

export const UNREGELMAESSIG: Unregelmaessig[] = UNREGELMAESSIG_TABELLE.trim()
  .split("\n")
  .map((line) => {
    const [base, past, pp, de, stufe, objekt, perfekt] = line.split("|");
    return { base, past: past.split("/"), pp: pp.split("/"), de, stufe: Number(stufe) as WortStufe, objekt: objekt || null, perfekt: objekt ? ((perfekt || null) as "nie" | "schon" | null) : null };
  });

/** Regular verbs with their level; the forms come from the spelling rules above. */
const REGELMAESSIG: [string, WortStufe][] = (
  "play 0,watch 0,like 0,live 0,love 0,help 0,visit 0,walk 0,work 0,cook 0,clean 0,open 0,start 0,finish 0,want 0,need 1,listen 0,talk 0,call 0," +
  "ask 0,answer 0,look 0,wait 0,stay 0,study 1,try 1,carry 1,cry 1,tidy 1,hurry 1,worry 2,enjoy 1,stop 1,plan 1,shop 1,drop 2,travel 2,skate 1," +
  "dance 1,bake 1,smile 1,arrive 1,move 1,use 1,close 1,climb 1,jump 0,paint 1,rain 0,snow 1,miss 1,fix 2,pass 1,relax 1,borrow 2,order 1,repair 1," +
  "hate 1,prefer 2,invite 1,decide 2,collect 1,chat 1,hug 1,hike 2,happen 1,laugh 1,wash 1,brush 1,chase 1,remember 2,phone 1,text 1,check 1,kick 0," +
  "pick 1,fill 1,boil 2,taste 1,believe 2,cross 1,join 1,hope 1,lock 2,book 1,save 1,practise 1,invent 2,water 1,touch 1,die 1,flow 1,plant 1"
)
  .split(",")
  .map((x) => {
    const [base, n] = x.split(" ");
    return [base, Number(n) as WortStufe];
  });

/** American spellings that also count: traveling, traveled; practiced next to practised. */
const ALT_AE: Record<string, { ing?: string; past?: string }> = { travel: { ing: "traveling", past: "traveled" }, practise: { ing: "practicing", past: "practiced" } };

export const VERBEN: Record<string, Verb> = Object.fromEntries([
  ...REGELMAESSIG.map(([base, stufe]): [string, Verb] => {
    const ed = edForm(base);
    const ae = ALT_AE[base] ?? {};
    return [base, { base, s: sForm(base), ing: ingForm(base), past: ed, pp: ed, pastAlt: ae.past ? [ae.past] : [], ppAlt: ae.past ? [ae.past] : [], ingAlt: ae.ing ? [ae.ing] : [], irregular: false, stufe }];
  }),
  ...UNREGELMAESSIG.map((u): [string, Verb] => [
    u.base,
    { base: u.base, s: sForm(u.base), ing: ingForm(u.base), past: u.past[0], pp: u.pp[0], pastAlt: u.past.slice(1), ppAlt: u.pp.slice(1), ingAlt: [], irregular: true, stufe: u.stufe },
  ]),
]);
export function verb(base: string): Verb {
  const v = VERBEN[base];
  if (!v) throw new Error(`Englisch: kein Verb „${base}“`);
  return v;
}
export const unregelmaessig = (base: string) => UNREGELMAESSIG.find((u) => u.base === base);

/** Past forms that are easily mixed up, for wrong answers: bought and brought, felt and fell. */
export const VERWECHSELT: Record<string, string[]> = {
  bought: ["brought"],
  brought: ["bought", "brang"],
  thought: ["taught", "thinked"],
  taught: ["thought", "teached"],
  caught: ["catched", "cought"],
  felt: ["fell", "feeled"],
  fell: ["felt", "falled"],
  laid: ["layed", "lay"],
  lay: ["laid", "lied"],
  left: ["leaved", "lefted"],
  won: ["winned", "wan"],
  lost: ["losed", "lose"],
  sold: ["selled", "sell"],
  told: ["telled", "tell"],
  saw: ["seen", "seed"],
  went: ["gone", "goed"],
  ate: ["eaten", "eated"],
  gave: ["given", "gived"],
  took: ["taken", "taked"],
  wrote: ["written", "writed"],
  ran: ["run", "runned"],
  swam: ["swum", "swimmed"],
  drank: ["drunk", "drinked"],
  sang: ["sung", "singed"],
  began: ["begun", "beginned"],
  came: ["come", "comed"],
  spoke: ["spoken", "speaked"],
  chose: ["chosen", "choosed"],
  rode: ["ridden", "rided"],
  broke: ["broken", "breaked"],
  found: ["finded", "founded"],
  flew: ["flown", "flied"],
  met: ["meeted", "meet"],
  slept: ["sleeped", "sleep"],
  heard: ["heared", "hear"],
  paid: ["payed", "pay"],
  said: ["sayed", "say"],
  built: ["builded", "build"],
  stole: ["stolen", "stealed"],
  threw: ["thrown", "throwed"],
  knew: ["known", "knowed"],
  drew: ["drawn", "drawed"],
  grew: ["grown", "growed"],
  wore: ["worn", "weared"],
  tore: ["torn", "teared"],
  fought: ["fighted", "fight"],
};

// ---------- people ----------
export type Pronomen = "I" | "you" | "he" | "she" | "it" | "we" | "they";
export type Person = {
  /** as it stands at the start of a sentence: "My sister", "Lena", "I" */
  text: string;
  p: Pronomen;
  /** grown-up (drives a car, teaches maths) */
  erwachsen?: boolean;
  /** an animal (sleeps in its basket) */
  tier?: boolean;
  /** a name or a pronoun: written the same inside a sentence */
  name?: boolean;
  /** retired: does not drive to work or teach at our school */
  pension?: boolean;
};
export const POSS: Record<Pronomen, string> = { I: "my", you: "your", he: "his", she: "her", it: "its", we: "our", they: "their" };
export const OBJ: Record<Pronomen, string> = { I: "me", you: "you", he: "him", she: "her", it: "it", we: "us", they: "them" };
/** he, she, it: the -s of the present simple. */
export const dritte = (p: Pronomen) => p === "he" || p === "she" || p === "it";

const MAEDCHEN = ["Lena", "Mia", "Emma", "Sophie", "Hannah", "Lara", "Anna", "Laura", "Nina", "Elif", "Marie", "Sarah", "Julia", "Leonie", "Mila"];
const BUBEN = ["Jonas", "Paul", "Elias", "Felix", "Noah", "Lukas", "David", "Simon", "Ben", "Tobias", "Jakob", "Emil", "Amir", "Luka", "Max"];
/** The first names of the tasks (made up, never a student's name). */
export const VORNAMEN_EN = [...MAEDCHEN, ...BUBEN];
export const MAEDCHENNAMEN = MAEDCHEN;
export const BUBENNAMEN = BUBEN;

export const PERSONEN: Person[] = [
  ...MAEDCHEN.map((text): Person => ({ text, p: "she", name: true })),
  ...BUBEN.map((text): Person => ({ text, p: "he", name: true })),
  { text: "My sister", p: "she" },
  { text: "My brother", p: "he" },
  { text: "My cousin Lisa", p: "she" },
  { text: "My friend Tim", p: "he" },
  { text: "My mum", p: "she", erwachsen: true },
  { text: "My dad", p: "he", erwachsen: true },
  { text: "My grandma", p: "she", erwachsen: true, pension: true },
  { text: "My grandpa", p: "he", erwachsen: true, pension: true },
  { text: "My aunt", p: "she", erwachsen: true },
  { text: "My uncle", p: "he", erwachsen: true },
  { text: "Ms Berger", p: "she", erwachsen: true, name: true },
  { text: "Mr Wagner", p: "he", erwachsen: true, name: true },
  { text: "I", p: "I", name: true },
  { text: "You", p: "you" },
  { text: "We", p: "we" },
  { text: "They", p: "they" },
  { text: "He", p: "he" },
  { text: "She", p: "she" },
  { text: "My parents", p: "they", erwachsen: true },
  { text: "My grandparents", p: "they", erwachsen: true, pension: true },
  { text: "My friends", p: "they" },
  { text: "The twins", p: "they" },
  { text: "Tom and Lea", p: "they", name: true },
  { text: "Our dog", p: "it", tier: true },
  { text: "The cat", p: "it", tier: true },
  { text: "My hamster", p: "it", tier: true },
  { text: "Our cats", p: "they", tier: true },
];

/** A subject inside a sentence: "my sister", "Lena", "I", "you". */
export const klein = (pers: Person) => (pers.name ? pers.text : pers.text[0].toLowerCase() + pers.text.slice(1));

// ---------- actions: what people (and animals) do in a sentence ----------
/** Where an action belongs; it decides which time phrases fit ("every morning" fits school, not a hobby). */
export type Bereich = "freizeit" | "schule" | "haus" | "essen" | "reise" | "tier" | "beruf";
export type Handlung = {
  v: string;
  /** what follows the verb; {poss} becomes my, his, her … of the subject */
  rest: string;
  stufe: WortStufe;
  /** g = a habit (present simple), j = going on now (progressive), v = once in the past */
  zeiten: string;
  bereich: Bereich;
  /** can be heard ("Listen! …") */
  laut?: boolean;
  /** happens inside a house (… when the doorbell rang) */
  drinnen?: boolean;
  /** own time phrases for a habit or for the past, when those of the Bereich do not fit ("every winter") */
  oft?: string[];
  einst?: string[];
};

const H = (bereich: Bereich, v: string, rest: string, stufe: WortStufe, zeiten: string, o: Partial<Handlung> = {}): Handlung => ({ v, rest, stufe, zeiten, bereich, ...o });
export const HANDLUNGEN: Handlung[] = [
  // free time, sport and hobbies
  H("freizeit", "play", "football in the park", 0, "gjv"),
  H("freizeit", "play", "tennis with {poss} dad", 0, "gjv"),
  H("freizeit", "play", "the guitar", 0, "gjv", { laut: true, drinnen: true }),
  H("freizeit", "play", "computer games", 0, "gjv", { drinnen: true }),
  H("freizeit", "play", "cards with {poss} grandma", 1, "gjv", { drinnen: true }),
  H("freizeit", "ride", "{poss} bike in the park", 0, "gjv"),
  H("freizeit", "ride", "a horse", 1, "gjv"),
  H("freizeit", "swim", "in the lake", 0, "gjv", { oft: ["every summer", "on hot days"], einst: ["last summer", "last weekend", "yesterday afternoon"] }),
  H("freizeit", "go", "swimming", 0, "gjv"),
  H("freizeit", "go", "skiing", 1, "gv", { oft: ["every winter", "in the winter holidays"], einst: ["last winter", "last February"] }),
  H("freizeit", "dance", "to {poss} favourite song", 1, "jv", { laut: true, drinnen: true }),
  H("freizeit", "draw", "comics", 1, "gjv", { drinnen: true }),
  H("freizeit", "sing", "in the school choir", 1, "gjv", { laut: true, oft: ["every Tuesday", "twice a week"] }),
  H("freizeit", "sing", "a song about summer", 0, "jv", { laut: true }),
  H("freizeit", "read", "comics in bed", 0, "gjv", { drinnen: true, oft: ["every evening", "at the weekend"] }),
  H("freizeit", "read", "a book about sharks", 1, "jv", { drinnen: true }),
  H("freizeit", "watch", "TV", 0, "gjv", { drinnen: true, oft: ["every evening", "after school", "at the weekend"] }),
  H("freizeit", "watch", "a film about penguins", 1, "jv", { drinnen: true }),
  H("freizeit", "listen", "to music", 0, "gjv", { laut: true }),
  H("freizeit", "take", "photos of the mountains", 1, "gjv", { oft: ["every summer", "on every holiday"] }),
  H("freizeit", "collect", "football cards", 1, "g", { oft: [""] }),
  H("freizeit", "bake", "cookies", 1, "gjv", { drinnen: true }),
  H("freizeit", "make", "pancakes", 0, "gjv", { drinnen: true, oft: ["on Sundays", "every Sunday morning"] }),
  H("freizeit", "skate", "in the park", 1, "gjv"),
  H("freizeit", "climb", "a tree in the garden", 1, "jv"),
  H("freizeit", "build", "a tree house", 1, "jv"),
  H("freizeit", "paint", "a picture of a horse", 1, "jv", { drinnen: true }),
  H("freizeit", "chat", "with {poss} friends", 1, "gjv", { oft: ["every evening", "after school"] }),
  H("freizeit", "meet", "{poss} friends in the park", 0, "gjv"),
  // school
  H("schule", "walk", "to school", 0, "gjv"),
  H("schule", "take", "the bus to school", 0, "gjv"),
  H("schule", "learn", "new English words", 1, "gjv", { drinnen: true }),
  H("schule", "wait", "for the school bus", 0, "gjv"),
  H("schule", "talk", "to {poss} teacher", 1, "jv", { drinnen: true }),
  H("schule", "forget", "{poss} PE kit", 1, "gv", { oft: ["every Friday", "once a week"] }),
  H("schule", "bring", "{poss} own lunch to school", 1, "gv"),
  // at home and with the family
  H("haus", "do", "{poss} homework", 0, "gjv", { drinnen: true, oft: ["after school", "every afternoon"] }),
  H("haus", "study", "for the maths test", 1, "jv", { drinnen: true }),
  H("haus", "write", "an email to {poss} cousin", 0, "gjv", { drinnen: true, oft: ["every week", "on Sundays"] }),
  H("haus", "tidy", "{poss} desk", 1, "gjv", { drinnen: true }),
  H("haus", "help", "{poss} grandma in the garden", 0, "gjv", { oft: ["at the weekend", "on Saturdays"] }),
  H("haus", "wash", "the dishes", 1, "gjv", { drinnen: true }),
  H("haus", "clean", "{poss} room", 0, "gjv", { drinnen: true, oft: ["at the weekend", "on Saturdays"] }),
  H("haus", "feed", "the cat", 1, "gjv"),
  H("haus", "walk", "the dog", 0, "gjv"),
  H("haus", "visit", "{poss} grandparents", 0, "gjv", { oft: ["on Sundays", "at the weekend", "every Sunday"] }),
  H("haus", "have", "breakfast in the kitchen", 0, "gjv", { drinnen: true, oft: ["every morning", "at seven o'clock"] }),
  H("haus", "have", "a shower", 1, "gjv", { drinnen: true }),
  H("haus", "make", "{poss} bed", 0, "gv", { drinnen: true, oft: ["every morning"] }),
  H("haus", "phone", "{poss} best friend", 1, "gjv"),
  H("haus", "brush", "{poss} teeth", 1, "gjv", { drinnen: true, oft: ["every morning", "every evening", "twice a day"] }),
  H("haus", "get", "up early", 1, "gv", { oft: ["every day", "on school days"] }),
  H("haus", "lay", "the table", 2, "gjv", { drinnen: true, oft: ["every evening", "before dinner"] }),
  H("haus", "carry", "the shopping bags", 1, "gjv", { oft: ["on Saturdays", "every Saturday"] }),
  H("haus", "tidy", "the living room", 1, "gjv", { drinnen: true, oft: ["on Sundays", "at the weekend"] }),
  // food and shopping
  H("essen", "eat", "an apple", 0, "gjv", { oft: ["every day", "every morning", "after school"] }),
  H("essen", "drink", "hot chocolate", 0, "gjv", { oft: ["every evening", "in winter", "after school"] }),
  H("essen", "buy", "bread at the bakery", 0, "gjv", { oft: ["every morning", "on Saturdays"] }),
  H("essen", "eat", "ice cream", 0, "gjv", { oft: ["at the weekend", "in summer", "on hot days"] }),
  H("essen", "order", "a pizza", 1, "gjv", { drinnen: true, oft: ["every Friday", "on Fridays"] }),
  H("essen", "cook", "spaghetti", 0, "gjv", { drinnen: true, oft: ["on Mondays", "every Friday"] }),
  H("essen", "try", "a new recipe", 1, "gjv", { drinnen: true, oft: ["at the weekend", "every Sunday"] }),
  // holidays and trips
  H("reise", "fly", "to London", 1, "v"),
  H("reise", "stay", "at a hotel by the sea", 1, "jv"),
  H("reise", "swim", "in the sea", 0, "jv"),
  H("reise", "build", "a sandcastle", 0, "jv"),
  H("reise", "send", "a postcard to {poss} aunt", 1, "jv"),
  H("reise", "visit", "a castle", 1, "jv"),
  H("reise", "travel", "to Italy by train", 2, "gv", { oft: ["every summer"] }),
  H("reise", "go", "camping with {poss} family", 1, "gv", { oft: ["every summer"] }),
  H("reise", "climb", "a mountain", 1, "v"),
  H("reise", "spend", "a week in Croatia", 2, "v"),
  // animals
  H("tier", "sleep", "in {poss} basket", 0, "gjv", { drinnen: true }),
  H("tier", "chase", "birds in the garden", 1, "gjv"),
  H("tier", "eat", "{poss} food", 0, "gjv", { oft: ["every evening", "twice a day"] }),
  H("tier", "play", "with a ball", 0, "gjv"),
  H("tier", "hide", "under the bed", 1, "gjv", { drinnen: true }),
  H("tier", "drink", "water from the pond", 1, "jv"),
  H("tier", "run", "after the ball", 0, "jv"),
  // grown-ups
  H("beruf", "drive", "to work", 1, "gjv"),
  H("beruf", "work", "in a hospital", 1, "g", { oft: [""] }),
  H("beruf", "read", "the newspaper", 0, "gjv", { drinnen: true, oft: ["every morning", "at breakfast"] }),
  H("beruf", "teach", "maths at our school", 1, "g", { oft: [""] }),
  H("beruf", "repair", "the car", 1, "jv"),
  H("beruf", "cook", "dinner", 0, "gjv", { drinnen: true, oft: ["every evening"] }),
];

/** Time phrases for a habit, per Bereich (present simple). */
export const OFT: Record<Bereich, string[]> = {
  freizeit: ["after school", "at the weekend", "on Saturdays", "on Sundays", "twice a week", "every Friday", "every afternoon"],
  schule: ["every day", "every morning", "on Mondays", "on school days"],
  haus: ["every day", "every evening", "every morning", "on Sundays"],
  essen: ["every day", "at the weekend"],
  reise: ["every summer", "in the summer holidays"],
  tier: ["every day", "every afternoon", "every evening"],
  beruf: ["every day", "every morning"],
};
/** Time phrases for the past (past simple), per Bereich. */
export const EINST: Record<Bereich, string[]> = {
  freizeit: ["yesterday", "last weekend", "last Saturday", "two days ago", "yesterday afternoon"],
  schule: ["yesterday", "last Monday", "two days ago", "last Friday"],
  haus: ["yesterday", "yesterday evening", "last weekend", "two days ago"],
  essen: ["yesterday", "last weekend", "two days ago"],
  reise: ["last summer", "two years ago", "last August"],
  tier: ["yesterday", "two days ago", "yesterday afternoon"],
  beruf: ["yesterday", "last week", "two days ago"],
};
/** A moment in the past, at the start of a sentence (past progressive), per Bereich. */
export const DAMALS: Record<Bereich, string[]> = {
  freizeit: ["At four o'clock yesterday afternoon", "At this time yesterday", "At three o'clock last Saturday"],
  schule: ["At half past seven yesterday morning", "At this time yesterday"],
  haus: ["At eight o'clock yesterday evening", "At this time yesterday", "At six o'clock yesterday"],
  essen: ["At this time yesterday", "At four o'clock yesterday afternoon"],
  reise: ["At this time last year", "At this time last summer"],
  tier: ["At this time yesterday", "At three o'clock yesterday afternoon"],
  beruf: ["At this time yesterday", "At eight o'clock yesterday morning"],
};
/** "… when it started to rain": something short that happened in the middle of the action. */
export const WAEHRENDDESSEN: Record<Bereich, string[]> = {
  freizeit: ["when it started to rain", "when I phoned", "when Mum came home"],
  schule: ["when it started to rain", "when the bell rang"],
  haus: ["when the doorbell rang", "when I phoned", "when the lights went out", "when Mum came home"],
  essen: ["when the doorbell rang", "when I phoned"],
  reise: ["when it started to rain", "when I phoned"],
  tier: ["when I came home", "when the doorbell rang"],
  beruf: ["when I phoned", "when it started to rain"],
};

/**
 * States, not actions (like, know, want, live …): only present simple, never "is liking". They are the
 * trap of „Present Simple oder Progressive“.
 */
export const ZUSTAENDE: { v: string; rest: string; stufe: WortStufe }[] = [
  { v: "like", rest: "pizza", stufe: 0 },
  { v: "like", rest: "horses", stufe: 0 },
  { v: "love", rest: "{poss} cat", stufe: 0 },
  { v: "hate", rest: "spiders", stufe: 1 },
  { v: "want", rest: "a new phone", stufe: 0 },
  { v: "need", rest: "a new pencil case", stufe: 1 },
  { v: "know", rest: "the answer", stufe: 1 },
  { v: "know", rest: "all {poss} neighbours", stufe: 2 },
  { v: "live", rest: "in Graz", stufe: 0 },
  { v: "live", rest: "in a small village near Salzburg", stufe: 1 },
  { v: "have", rest: "two brothers", stufe: 0 },
  { v: "understand", rest: "Italian", stufe: 2 },
  { v: "remember", rest: "{poss} first day at school", stufe: 2 },
  { v: "believe", rest: "in ghosts", stufe: 2 },
];

// ---------- nouns: plural ----------
/** A noun, its plural and a sentence with ___ where the plural goes. */
export type Nomen = { sg: string; pl: string; satz: string; stufe: WortStufe; art: "s" | "es" | "ies" | "ves" | "o" | "unr" | "gleich" };
const N = (sg: string, pl: string, satz: string, stufe: WortStufe, art: Nomen["art"]): Nomen => ({ sg, pl, satz, stufe, art });
export const NOMEN: Nomen[] = [
  N("book", "books", "There are five ___ in my school bag.", 0, "s"),
  N("apple", "apples", "We need three ___ for the cake.", 0, "s"),
  N("pencil", "pencils", "I have got two red ___ in my pencil case.", 0, "s"),
  N("horse", "horses", "There are four ___ on my uncle's farm.", 0, "s"),
  N("boy", "boys", "There are twelve ___ in our class.", 0, "s"),
  N("key", "keys", "Mum has got three ___ on her key ring.", 1, "s"),
  N("toy", "toys", "My little brother has got a lot of ___.", 0, "s"),
  N("monkey", "monkeys", "We saw five ___ at the zoo.", 1, "s"),
  N("day", "days", "A week has got seven ___.", 0, "s"),
  N("dog", "dogs", "My aunt has got three ___.", 0, "s"),
  N("girl", "girls", "There are fourteen ___ in our class.", 0, "s"),
  N("car", "cars", "There are two ___ in front of our house.", 0, "s"),
  N("egg", "eggs", "I need four ___ for the pancakes.", 0, "s"),
  N("bird", "birds", "Five ___ are sitting in the tree.", 0, "s"),
  N("box", "boxes", "There are three ___ in the cellar.", 0, "es"),
  N("bus", "buses", "Two ___ stop in front of our school.", 0, "es"),
  N("glass", "glasses", "Can you put four ___ on the table, please?", 0, "es"),
  N("peach", "peaches", "We bought six ___ at the market.", 0, "es"),
  N("dish", "dishes", "There are a lot of dirty ___ in the sink.", 1, "es"),
  N("watch", "watches", "There are ten ___ in the shop window.", 1, "es"),
  N("brush", "brushes", "I need two new ___ for the art lesson.", 1, "es"),
  N("fox", "foxes", "We saw two ___ in the forest.", 1, "es"),
  N("beach", "beaches", "There are many beautiful ___ in Croatia.", 1, "es"),
  N("class", "classes", "There are twenty ___ at our school.", 1, "es"),
  N("sandwich", "sandwiches", "Mum made two ___ for my lunch.", 1, "es"),
  N("match", "matches", "Our team won three ___ last month.", 2, "es"),
  N("baby", "babies", "Our neighbours have got two ___.", 0, "ies"),
  N("lady", "ladies", "Two old ___ are sitting on the bench.", 0, "ies"),
  N("city", "cities", "Vienna and Graz are big ___.", 0, "ies"),
  N("family", "families", "Five ___ live in our house.", 1, "ies"),
  N("party", "parties", "I went to three birthday ___ last month.", 1, "ies"),
  N("story", "stories", "Grandpa tells us funny ___.", 1, "ies"),
  N("strawberry", "strawberries", "There are a lot of ___ in the fruit salad.", 1, "ies"),
  N("cherry", "cherries", "We picked a lot of ___ in Grandma's garden.", 1, "ies"),
  N("butterfly", "butterflies", "There are many ___ in our garden in summer.", 1, "ies"),
  N("country", "countries", "Austria has got eight neighbour ___.", 2, "ies"),
  N("library", "libraries", "There are two ___ in our town.", 2, "ies"),
  N("knife", "knives", "Please put the forks and ___ on the table.", 1, "ves"),
  N("leaf", "leaves", "In autumn, the ___ fall from the trees.", 1, "ves"),
  N("wolf", "wolves", "Some ___ live in the forests of Austria again.", 2, "ves"),
  N("shelf", "shelves", "There are three ___ in my room.", 2, "ves"),
  N("thief", "thieves", "The police caught two ___ last night.", 2, "ves"),
  N("loaf", "loaves", "Can you buy two ___ of bread, please?", 2, "ves"),
  N("tomato", "tomatoes", "We grow ___ in our garden.", 1, "o"),
  N("potato", "potatoes", "I need six ___ for the soup.", 1, "o"),
  N("hero", "heroes", "Superman and Batman are ___ in comics.", 2, "o"),
  N("photo", "photos", "I took a lot of ___ on holiday.", 2, "o"),
  N("piano", "pianos", "There are two ___ in the music room.", 2, "o"),
  N("child", "children", "There are many ___ in the playground.", 0, "unr"),
  N("man", "men", "Two ___ are working in the garden.", 0, "unr"),
  N("woman", "women", "Three ___ are waiting at the bus stop.", 0, "unr"),
  N("foot", "feet", "A duck has got two ___.", 1, "unr"),
  N("tooth", "teeth", "Our baby has got four ___ already.", 1, "unr"),
  N("mouse", "mice", "Our cat caught two ___ last week.", 1, "unr"),
  N("person", "people", "Five ___ were on the bus.", 1, "unr"),
  N("goose", "geese", "There are six ___ on the farm.", 2, "unr"),
  N("sheep", "sheep", "There are a lot of ___ on the hill.", 1, "gleich"),
  N("fish", "fish", "There are ten ___ in our pond.", 1, "gleich"),
  N("deer", "deer", "We saw three ___ in the forest.", 2, "gleich"),
];

// ---------- adjectives: comparison ----------
/** Adjective, comparative, superlative (other right forms after a slash), Stufe, kind of comparison. */
export type Adjektiv = { a: string; komp: string[]; sup: string[]; stufe: WortStufe; art: "kurz" | "e" | "doppelt" | "y" | "lang" | "unr" };
const A = (a: string, komp: string, sup: string, stufe: WortStufe, art: Adjektiv["art"]): Adjektiv => ({ a, komp: komp.split("/"), sup: sup.split("/"), stufe, art });
export const ADJEKTIVE: Adjektiv[] = [
  A("tall", "taller", "tallest", 0, "kurz"),
  A("small", "smaller", "smallest", 0, "kurz"),
  A("old", "older", "oldest", 0, "kurz"),
  A("young", "younger", "youngest", 0, "kurz"),
  A("fast", "faster", "fastest", 0, "kurz"),
  A("cheap", "cheaper", "cheapest", 1, "kurz"),
  A("long", "longer", "longest", 0, "kurz"),
  A("short", "shorter", "shortest", 0, "kurz"),
  A("cold", "colder", "coldest", 0, "kurz"),
  A("high", "higher", "highest", 1, "kurz"),
  A("strong", "stronger", "strongest", 1, "kurz"),
  A("slow", "slower", "slowest", 0, "kurz"),
  A("nice", "nicer", "nicest", 0, "e"),
  A("large", "larger", "largest", 1, "e"),
  A("cute", "cuter", "cutest", 1, "e"),
  A("safe", "safer", "safest", 2, "e"),
  A("big", "bigger", "biggest", 0, "doppelt"),
  A("hot", "hotter", "hottest", 0, "doppelt"),
  A("thin", "thinner", "thinnest", 1, "doppelt"),
  A("sad", "sadder", "saddest", 1, "doppelt"),
  A("wet", "wetter", "wettest", 2, "doppelt"),
  A("happy", "happier", "happiest", 0, "y"),
  A("easy", "easier", "easiest", 0, "y"),
  A("funny", "funnier", "funniest", 0, "y"),
  A("heavy", "heavier", "heaviest", 1, "y"),
  A("busy", "busier", "busiest", 1, "y"),
  A("dirty", "dirtier", "dirtiest", 1, "y"),
  A("noisy", "noisier", "noisiest", 2, "y"),
  A("lazy", "lazier", "laziest", 2, "y"),
  A("interesting", "more interesting", "most interesting", 0, "lang"),
  A("beautiful", "more beautiful", "most beautiful", 0, "lang"),
  A("expensive", "more expensive", "most expensive", 1, "lang"),
  A("difficult", "more difficult", "most difficult", 1, "lang"),
  A("dangerous", "more dangerous", "most dangerous", 1, "lang"),
  A("exciting", "more exciting", "most exciting", 1, "lang"),
  A("famous", "more famous", "most famous", 1, "lang"),
  A("important", "more important", "most important", 2, "lang"),
  A("comfortable", "more comfortable", "most comfortable", 2, "lang"),
  A("popular", "more popular", "most popular", 2, "lang"),
  A("boring", "more boring", "most boring", 1, "lang"),
  A("good", "better", "best", 0, "unr"),
  A("bad", "worse", "worst", 0, "unr"),
  A("far", "further/farther", "furthest/farthest", 2, "unr"),
];
export const adjektiv = (a: string): Adjektiv => {
  const x = ADJEKTIVE.find((y) => y.a === a);
  if (!x) throw new Error(`Englisch: kein Adjektiv „${a}“`);
  return x;
};
