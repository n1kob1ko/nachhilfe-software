/**
 * Names in a student's text that the app does not know (friends, family, people in a story), found before
 * the text leaves the app, so they are replaced by [Name] like the names of the student and the teachers.
 *
 * Three rules, nothing else: a first name from the list below; the word after a form of address („Frau
 * Novak“, „Mrs Berger“, „Herr Dr. Huber“); a surname right after a first name („Lena Hofer“). A surname
 * found once is replaced everywhere in the text, alone too (namePattern in lib/text-correction-core.ts); a name that is
 * also an everyday word („Weiß“, „Sommer“, „Fox“) only where it stands as a name.
 * Pronouns, articles and other small words are never names: OpenRouter's „Person name“ guardrail hid
 * „Sie“, „dass“ or „Spiel ein“ and so changed the grammar the KI had to check (test 2026-10-09).
 *
 * The teacher sees every word found before sending, can keep any of them and add missing ones.
 * Pure functions, used on the server and in the consent dialog.
 */

/** Frequent first names in Austrian classrooms (German, Southeast and Eastern European, Turkish, Arabic) and in English. Words that are also German or English words („August“, „Rose“, „Ernst“, „Kai“, „Nur“) are left out. */
const FIRST_NAMES = new Set(
  (
    // girls
    "Anna Emma Hannah Hanna Mia Sophia Sophie Sofia Lena Lea Leah Laura Valentina Marie Maria Emilia Lina Ella Johanna Magdalena " +
    "Katharina Theresa Teresa Clara Klara Julia Sarah Sara Lara Nina Paula Helena Elena Selina Amelie Leonie Marlene Matilda Mathilda " +
    "Ida Frida Frieda Greta Romy Luisa Louisa Lisa Elisa Eva Alina Jana Lilly Lili Lily Charlotte Antonia Viktoria Victoria Elisabeth " +
    "Vanessa Melanie Sabine Andrea Claudia Petra Monika Martina Barbara Brigitte Ingrid Gertrud Gerti Hilde Helga Renate Ursula " +
    "Elfriede Christine Christina Kristina Susanne Stefanie Stephanie Verena Sandra Daniela Nicole Carina Karin Karina Bianca Doris " +
    "Gabriele Gabi Heidi Ilse Inge Irene Katrin Kathrin Manuela Marion Michaela Natalie Nathalie Patricia Regina Silvia Sonja Tanja " +
    "Ulrike Veronika Yvonne Anja Birgit Carmen Elke Isabella Isabel Jessica Jennifer Kerstin Larissa Lorena Madeleine Marina Miriam " +
    "Nadine Nora Olivia Pia Rebecca Simone Tamara Valerie Zoe Emely Emily Mila Livia Annika Josefine Rosalie Marla Fiona Melina " +
    "Anastasia Natascha Luna Ronja Mira Leni Lia Mina Alma Aurelia Elif Zeynep Ayse Fatma Esra Merve Selin Defne Ecem Melek " +
    "Aleyna Amina Emina Lejla Milica Jelena Ivana Marija Jovana Teodora Ana Lana Dunja Fatima Aisha Maryam Zahra Noor Layla Leyla " +
    "Yasmin Wiktoria Zofia Ioana Mary Kate Alice Amy Lucy Chloe Jenny Linda Susan Jane Anne Ann Ruby Daisy " +
    // boys
    "Lukas Lucas Luca Luka Jakob Jacob Maximilian Max Elias Paul Felix Jonas David Leon Noah Tobias Simon Julian Alexander Fabian " +
    "Florian Sebastian Daniel Michael Markus Marcus Thomas Andreas Stefan Stephan Martin Peter Johannes Johann Matthias Mathias " +
    "Raphael Rafael Moritz Niklas Nicolas Nikolas Benjamin Ben Luis Louis Finn Emil Valentin Lorenz Leopold Konstantin Constantin " +
    "Philipp Dominik Patrick Christoph Christian Georg Josef Joseph Franz Karl Carl Hans Fritz Kurt Otto Anton Oskar Oscar Gregor " +
    "Clemens Manuel Marcel Kevin Dennis Tim Timo Jan Jonathan Samuel Theo Theodor Vincent Vinzenz Adrian Aaron Gabriel Nico Niko " +
    "Mario Marco Marko Matteo Leo Liam Mats Mattis Henri Henry Hannes Jannik Julius Laurin Lenny Levi Linus Mika Milan Ole Robin " +
    "Ruben Severin Silas Till Tom Xaver Wolfgang Werner Walter Gerhard Günter Günther Helmut Herbert Heinz Manfred Rudolf Rudi " +
    "Siegfried Alfred Erich Friedrich Gottfried Harald Hubert Klaus Claus Norbert Reinhard Richard Robert Roland Uwe Wilhelm Willi " +
    "Alois Ferdinand Bernhard Bernd Dieter Jürgen Rainer Ralf Rolf Gernot Erwin Sepp Hermann Armin Arno Axel Benedikt Bruno Damian " +
    "Emanuel Erik Eric Fabio Gustav Hugo Kilian Lars Lennart Marvin Mathis Nils Pascal Sven Tristan Ulrich Viktor Victor " +
    "Yannick Jannis Joel Jona Mehmet Mustafa Ahmet Emre Yusuf Hasan Hüseyin Murat Ömer Yasin Enes Burak Kerem Eren Emir Mert Umut " +
    "Nikola Ivan Filip Lazar Petar Dragan Nemanja Edin Amar Ahmad Ahmed Mohammad Mohammed Muhammad Muhammed Omar Ali Hassan Hussein " +
    "Ibrahim Amir Karim Sami Rami Adam Jakub Kacper Andrei Alexandru Bence Levente John James Jack Harry Oliver George Charlie " +
    "William Sam Mike Joe Bob Alex Chris Steve Steven Brian Tony Fred Rob"
  ).split(" "),
);

/** Forms of address before a name; a dot after them is allowed („Dr.“, „Mrs.“). „Dear“ opens an English letter („Dear Hope,“). */
const ADDRESS = new Set(["Frau", "Herr", "Herrn", "Fräulein", "Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "Mag", "Ing", "DI", "Dear"]);

/**
 * Surnames that are also everyday nouns: after an article they are the noun („im Sommer“, „kein Stern“, „wie ein
 * Wolf“), elsewhere the name. Test 2026-10-10: „Im Sommer“ became „Im [Name]“. Not the frequent surnames
 * from trades and titles (Müller, Bauer, Koch, König, Smith): they stay hidden everywhere, as before.
 */
const NOUN_NAMES = new Set(
  (
    "Sommer Winter Herbst Lenz Wolf Fuchs Vogel Hahn Haas Hase Bär Adler Falk Falke Fink Specht Strauß Strauss Storch Kranich Hirsch Ochs " +
    "Lamm Bock Stier Hecht Fisch Engel Berg Bach Stein Wald Busch Baum Feld Hof Holz Stern Sonne Mond Licht Glück Freund Kern Korn Dorn " +
    "Salz Pfeffer Zucker Honig Eisen Stahl Kupfer Gold Silber Ring Krug Topf Hammer Nagel Brand Regen Schnee Sturm Blitz Donner Frost Horn " +
    "Weiß Weiss Schwarz Braun Grün Fox Bird Swan Crane Drake Hawk Finch Lamb Bull Bush Wood Woods Hill Field Stone Brook Lake Marsh Star Moon"
  ).split(" "),
);

/**
 * Names that are also everyday words: written small they are the word („Niemand weiß“ next to Direktor Weiß, „zu
 * klein“, „I will“, „I hope“, „a young fox“), unless right after a form of address („frau weiß“). Test 2026-10-10:
 * „Niemand weiß“ became „Niemand [Name]“ and the KI explained a missing verb.
 */
const WORD_NAMES = new Set([
  ...NOUN_NAMES,
  ...(
    "Klein Groß Gross Lang Kurz Jung Alt Neu Frisch Fröhlich Lustig Kühn Ernst Frei Fromm Gut Hell Hoch Kluge Klug Kraus Krause Lieb Reich " +
    "Scharf Schön Schnell Stark Still Süß Wild Mild Rau Hart Wach Weise Fein Blank Bunt Froh Frank Stolz Treu Sauer Will Mark " +
    "Brown Black White Green Gray Grey Young Long Short Little Small Strong Sharp Rich Wise Hope Faith Grace Joy May June April Rose " +
    "Lily Daisy Ruby Pearl Holly Ivy Iris Violet Poppy Willow Hazel Olive Ginger Honey Sunny Penny Sandy Bill Pat Rob Sue Art Ray Guy " +
    "Jack Dawn Summer Autumn Sky Storm River Chase Love Dean Major Cliff"
  ).split(" "),
]);

/** The name in the spelling of the lists: first letter capital, the rest small („WOLF“, „wolf“ → „Wolf“). */
const listed = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
/** A name that is also an everyday word: replaced only where it stands as a name (namePattern in lib/text-correction-core.ts). */
export const isWordName = (name: string) => WORD_NAMES.has(listed(name));
/** A name that is also a noun: not replaced after an article. */
export const isNounName = (name: string) => NOUN_NAMES.has(listed(name));

/** Before a name written small: a form of address or a kinship word („frau weiß“, „opa ernst“), any case. */
export const ADDRESS_BEFORE = ["frau", "herr", "herrn", "fräulein", "mr", "mrs", "ms", "miss", "dr", "prof", "dear", "opa", "oma", "onkel", "tante", "uncle", "aunt"];
/**
 * Before a German noun, never before a name: indefinite articles, im/am/ins, possessives, demonstratives. Not „der“,
 * „die“, „beim“, „zum“ or „vom“, which come before a surname in spoken German („die Sommer hat gesagt“, „beim Wolf“):
 * there the word stays hidden, as before. English nouns are small, so „Fox“ with a capital is the name anyway.
 */
export const ARTICLES = (
  "ein eine einen einem einer eines kein keine keinen keinem keiner keines im am ins ans aufs " +
  "mein meine meinen meinem meiner meines dein deine deinen deinem deiner deines sein seine seinen seinem seiner seines ihr ihre ihren ihrem ihrer ihres " +
  "unser unsere unseren unserem unserer unseres euer eure euren eurem eurer eures dieser diese dieses diesen diesem jeder jede jedes jeden jedem"
).split(" ");

/**
 * A role after „Frau“ or „Herr“ („Frau Lehrerin“, „Herr Bürgermeister“, „Herr Dr.“) is no name; the name may
 * follow it. Roles that are also frequent surnames („Richter“, „Kaiser“, „König“, „Graf“) are not listed.
 */
const ROLE = /(?:lehrer|direktor|doktor|professor|pfarrer|bürgermeister|nachbar|minister|präsident|kolleg|inspektor|kommissar|trainer|kapitän|anwalt|anwält|mama|papa)(?:e|in|innen|en|s)?$/i;

/** Words that often follow a first name or „Dear“ without being a name („Lukas Mutter“, „Lena Hund“, „Dear Sir“). */
const NOT_SURNAME = new Set(
  (
    "Mutter Vater Mama Papa Mami Papi Eltern Bruder Brüder Schwester Schwestern Geschwister Oma Opa Omi Opi Großmutter Großvater " +
    "Großeltern Tante Onkel Cousin Cousine Neffe Nichte Sohn Tochter Kinder Kind Baby Freund Freundin Freunde Freundinnen Familie " +
    "Hund Katze Hase Pferd Haus Wohnung Zimmer Garten Klasse Schule Lehrer Lehrerin Geburtstag Party Fest Fahrrad Rad Auto Handy " +
    "Idee Meinung Antwort Frage Name Namen Hilfe Angst Ball Buch Spiel Spiele Sachen Tasche Rucksack Jacke Mannschaft Team Problem " +
    "Plan Traum Leben Stimme Gesicht Hand Hände Kopf Augen Herz Mitschüler Mitschülerin Zeit Arbeit Aufgabe Heft Note Noten " +
    "Mum Mom Dad Mother Father Brother Sister Friend Dog Cat House Sir Madam Madame Diary Friends All Everyone Team Teacher Teachers Class " +
    "Students Parents Editor Customer Manager Principal Headteacher Neighbour Neighbor Grandma Grandpa Granny Grandad Grandmother Grandfather " +
    "Aunt Uncle Auntie Cousin Mummy Mommy Daddy Colleagues Members Readers Reader Guests Visitors"
  ).split(" "),
);

/** Never a name, whatever stands before it: pronouns, articles, joining words. */
const NEVER = new Set(
  (
    "Sie Ihr Ihre Ihrem Ihren Ihrer Ihres Ihnen Er Es Wir Du Man Das Dass Die Der Den Dem Des Ein Eine Einer Einem Einen Und Oder " +
    "Aber Weil Wenn Als Wie Ob Ich Mich Mir Dich Dir Sich Uns Euch She He It They We You I Her Him Them His Their Its The A An And Or But"
  ).split(" "),
);

/**
 * Typical endings of German nouns: such a word after „Frau“ is the woman's flowers, not her name („der Frau Blumen“ aside).
 * Three letters at least before the ending: „Klein“ is no „-lein“ noun (Herr Klein was not found, test 2026-10-10).
 */
const NOUN_ENDING = /\p{L}{3}(?:ung|heit|keit|schaft|chen|lein|tion|sion|tät|nis|tum|ismus)$/u;

type Word = { text: string; start: number; end: number };

const WORD = /\p{L}+(?:['’]\p{L}+)?/gu;

/** The word without an English or German possessive ending („Berger’s“, „Lukas’“ stays). */
const base = (w: string) => w.replace(/['’]s$/u, "");
const capital = (w: string) => /^\p{Lu}\p{Ll}/u.test(w) && !NEVER.has(w);
/** a listed first name, also in the genitive („Lenas“) */
const firstName = (w: string) => FIRST_NAMES.has(w) || (w.endsWith("s") && FIRST_NAMES.has(w.slice(0, -1)));

/** Words before a noun, never before a name: „ein Geschenk“, „meine Blumen“, „das Wetter“, „eine Frau“. */
const DETERMINER = /^(?:ein|eine|einen|einem|einer|eines|kein|keine|keinen|keinem|keiner|keines|mein|dein|sein|ihr|unser|euer|eur|das|a|an|the|my|your|his|our)(?:e|en|em|er|es)?$/i;

/**
 * The names in these texts the app finds by the three rules, each once, in the order found (a first
 * name from the list in its base form, „Lenas“ → „Lena“). The names the app already knows are not
 * needed here: they are replaced anyway. A word found only by its place (after „Frau“ or a first name)
 * that stands after „ein“, „mein“, „das“ … anywhere in the texts is a noun, not a name („Lukas Geschenk“
 * next to „ein Geschenk“).
 */
export function detectNames(texts: string[]): string[] {
  const found: { name: string; byPlace: boolean }[] = [];
  const add = (w: string, byPlace: boolean) => {
    const name = base(w);
    if (name.length < 3) return;
    const had = found.find((f) => f.name === name);
    if (had) had.byPlace &&= byPlace;
    else found.push({ name, byPlace });
  };
  const nouns = new Set<string>();
  for (const text of texts) {
    const words: Word[] = [...text.matchAll(WORD)].map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
    /** only spaces (after a form of address also a dot) between word i and word i + 1 */
    const joined = (i: number, dot = false) => i + 1 < words.length && (dot ? /^\.?\s+$/ : /^\s+$/).test(text.slice(words[i].end, words[i + 1].start));
    /** a determiner right before word i, or before the one small word before it („ein schönes Geschenk“) */
    const afterDeterminer = (i: number) =>
      (i > 0 && joined(i - 1) && DETERMINER.test(words[i - 1].text)) || (i > 1 && joined(i - 2) && joined(i - 1) && /^\p{Ll}/u.test(words[i - 1].text) && DETERMINER.test(words[i - 2].text));
    /** a hyphenated second part („Müller-Lüdenscheidt“, „Eva-Maria“) belongs to the name */
    const hyphen = (i: number, byPlace: boolean) => {
      if (i + 1 < words.length && text.slice(words[i].end, words[i + 1].start) === "-" && capital(words[i + 1].text)) add(words[i + 1].text, byPlace);
    };
    /** a word that may be a surname after a first name or a form of address */
    const surname = (w: string) => capital(w) && !NOT_SURNAME.has(base(w)) && !NOUN_ENDING.test(base(w)) && !ROLE.test(base(w));
    words.forEach((w, i) => {
      if (capital(w.text) && afterDeterminer(i)) nouns.add(base(w.text));
    });
    for (let i = 0; i < words.length; i++) {
      const w = base(words[i].text);
      if (capital(words[i].text) && firstName(w)) {
        const listed = FIRST_NAMES.has(w);
        add(listed ? w : w.slice(0, -1), false);
        hyphen(i, false);
        // a surname right after it; not after a genitive („Lenas Geschenk“)
        if (listed && joined(i) && surname(words[i + 1].text)) {
          add(words[i + 1].text, true);
          hyphen(i + 1, true);
        }
        continue;
      }
      // a form of address, not a noun („eine Frau“, „mein Herr“); further forms and roles before the name („Herr Dr. Huber“, „Frau Lehrerin Novak“)
      if (!ADDRESS.has(words[i].text) || afterDeterminer(i)) continue;
      let j = i;
      while (joined(j, true) && (ADDRESS.has(words[j + 1].text) || ROLE.test(words[j + 1].text))) j++;
      if (joined(j, true) && surname(words[j + 1].text)) {
        add(words[j + 1].text, !firstName(base(words[j + 1].text)));
        hyphen(j + 1, true);
      }
    }
  }
  const all = new Set(found.map((f) => f.name));
  // a name that is also a noun stays: only its places as a name are replaced („Elfriede Stern“ next to „kein Stern“);
  // „Frau Hofers“ next to „Frau Hofer“ is one name, its genitive s stays outside the placeholder (no „Hoferss“)
  return found.filter((f) => (!f.byPlace || !nouns.has(f.name) || isNounName(f.name)) && !(f.name.endsWith("s") && all.has(f.name.slice(0, -1)))).map((f) => f.name);
}

/**
 * What the teacher typed into „Weitere Namen“: separated by commas, semicolons or lines, each with a letter, at
 * most 40; without a form of address, which would be replaced everywhere else too („Frau Huber“ → „Huber“).
 */
export function parseNames(input: string): string[] {
  const names = input.split(/[,;\n]+/).map((s) => s.trim().split(/\s+/).filter((w) => !ADDRESS.has(w.replace(/\.$/, ""))).join(" ").slice(0, 60));
  return [...new Set(names.filter((s) => /\p{L}/u.test(s)))].slice(0, 40);
}
