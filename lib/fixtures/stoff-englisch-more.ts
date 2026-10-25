/**
 * Eine Antwort der KI (Funktion `stoffzettel`, lib/ai/features.ts `PruefungsstoffSchema`) für zwei echte Unterlagen
 * eines Englisch-Tests, von Hand nach den Fotos geschrieben, ohne KI-Aufruf: Dokument 1 ist der Stoffzettel „What to
 * study for the 1st test“ (06.11.26, More Units 1–3), Dokument 2 das Inhaltsverzeichnis des Schulbuchs „MORE!“ mit
 * Unit 1 bis 3. Die Fotos selbst liegen nicht im Repository.
 *
 * Absichtlich so, wie eine KI auch einmal antwortet: drei Einträge aus dem Inhaltsverzeichnis, die der Stoffzettel
 * ausschließt („A song 4 U“, „The Story of the Stones“, „The Twins“), stehen hier als Prüfungsstoff, und die
 * Überschrift „Unit 2: How embarrassing!“ hat eine Gruppe und eine Fähigkeit. Die App muss das selbst richtigstellen
 * (lib/pruefungsstoff.ts `lesungAusAntwort`). Namen von Figuren des Buchs sind wie verlangt weggelassen („…“).
 */
import type { PruefungsstoffGelesen } from "../ai";

type Punkt = PruefungsstoffGelesen["punkte"][number];
const p = (gruppe: Punkt["gruppe"], original: string, inhalt: string, o: Partial<Punkt> = {}): Punkt => ({
  gruppe,
  original,
  inhalt,
  einheit: null,
  dokument: 1,
  status: "pruefung",
  grund: null,
  skill_id: null,
  ...o,
});
const u = (n: number) => ({ dokument: 2, einheit: `Unit ${n}` });
const sprechen = "Sprechen steht nicht auf dem Stoffzettel; er nennt nur Lesen, Schreiben und Hören.";
const more = "MORE!-Teil, der Stoffzettel nennt ihn nicht.";

export const STOFF_ENGLISCH_MORE: PruefungsstoffGelesen = {
  art: "Test",
  fach: "Englisch",
  datum: "2026-11-06",
  titel: "1st test",
  dokumente: [
    { nr: 1, rolle: "stoffzettel", titel: "What to study for the 1st test" },
    { nr: 2, rolle: "inhaltsverzeichnis", titel: "MORE! Contents, Unit 1 bis 3" },
  ],
  punkte: [
    // ---- Stoffzettel ----
    p("umfang", "More Units 1-3", "MORE! Units 1–3"),
    p("wortschatz", "back at school", "Zurück in der Schule"),
    p("wortschatz", "school subjects", "Schulfächer"),
    p("wortschatz", "timetables", "Stundenpläne"),
    p("wortschatz", "daily routines", "Tagesablauf", { skill_id: "englisch.vocab.tagesablauf" }),
    p("wortschatz", "embarrassing stories", "Peinliche Geschichten"),
    p("wortschatz", "giving reasons", "Gründe angeben"),
    p("wortschatz", "online safety", "Sicherheit im Internet"),
    p("wortschatz", "Halloween", "Halloween"),
    p("wortschatz", "party invitation", "Party-Einladung"),
    p("wortschatz", "scary stories", "Gruselgeschichten"),
    p("reading_listening", "read/write/listen to texts based on these topics", "Texte zu den Themen lesen, schreiben, hören"),
    p("wortschatz", "be able to use specific vocabulary in meaningful sentences", "Vokabeln in sinnvollen Sätzen verwenden"),
    p("wortschatz", "learn synonyms and opposites", "Synonyme und Gegenteile"),
    p("sonstiges", "focus on the correct spelling", "Rechtschreibung"),
    p("grammatik", "the word order", "Wortstellung", { skill_id: "englisch.grammar.wortstellung" }),
    p("sonstiges", "revise the tasks in the WB and on the grammar handouts", "Aufgaben im Workbook und Grammatikblätter wiederholen"),
    p("writing", "practise writing short texts", "Kurze Texte schreiben"),
    p("sonstiges", "do the ezone tasks", "ezone-Aufgaben"),
    p("lektuere", "Class reader Hoot", "Klassenlektüre „Hoot“"),
    p("lektuere", "Be able to answer questions about the story and the characters, or write a similar story.", "Fragen zu Geschichte und Figuren beantworten, ähnliche Geschichte schreiben"),
    p("sonstiges", "videos (Stones, Twins etc.)", "Videos", { status: "ausgeschlossen", grund: "Nicht Stoff sind: videos (Stones, Twins etc.)" }),
    p("sonstiges", "songs", "Lieder", { status: "ausgeschlossen", grund: "Nicht Stoff sind: songs" }),
    p("grammatik", "present tense simple", "Present Simple", { skill_id: "englisch.tenses.presentsimple" }),
    p("grammatik", "continuous", "Present Continuous", { skill_id: "englisch.tenses.presentprogressive" }),
    p("grammatik", "past tense simple", "Past Simple", { skill_id: "englisch.tenses.pastsimple" }),
    p("grammatik", "statements/ questions/ negation", "Aussagen, Fragen und Verneinung", { skill_id: "englisch.tenses.presentsimple.fragen" }),
    p("grammatik", "signal words (z.B. right now, usually, last week)", "Signal Words", { skill_id: "englisch.tenses.simple-progressive" }),
    p("grammatik", "yes/no-questions and questions with question words", "Ja/Nein-Fragen und Fragen mit Fragewörtern", { skill_id: "englisch.grammar.fragen" }),
    p("grammatik", "irregular verbs", "Irregular Verbs", { skill_id: "englisch.vocab.irregular" }),
    p("writing", "Writing task (120 words)", "Schreibaufgabe, 120 Wörter"),
    p("writing", "picture story", "Picture Story", { skill_id: "englisch.writing.story" }),
    p("writing", "dialogue", "Dialog"),
    p("writing", "invitation", "Einladung"),
    p("writing", "email", "E-Mail", { skill_id: "englisch.writing.email" }),
    p("writing", "answer to an email", "Antwort auf eine E-Mail", { skill_id: "englisch.writing.email" }),
    p("writing", "postcard", "Postkarte"),
    p("reading_listening", "Reading and listening tasks (1-2 each)", "Lese- und Höraufgaben, je 1–2"),
    p("reading_listening", "tick T/F, tick the correct option, answer questions, complete sentences, fill the gaps etc., based on the topics", "Aufgabenformate: richtig/falsch, ankreuzen, Fragen, Sätze ergänzen, Lücken"),
    p("sonstiges", "Die grammatikalischen Strukturen und das Vokabular der vorausgegangenen Lernjahre werden als Grundlage vorausgesetzt.", "Grammatik und Vokabeln der früheren Jahre"),
    // ---- Inhaltsverzeichnis, Unit 1 ----
    p("umfang", "Unit 1: First day back at school", "Unit 1: First day back at school", u(1)),
    p("wortschatz", "Vocabulary: School subjects", "Schulfächer", u(1)),
    p("grammatik", "Present simple (revision)", "Present Simple (Wiederholung)", { ...u(1), skill_id: "englisch.tenses.presentsimple" }),
    p("grammatik", "Past simple (revision)", "Past Simple (Wiederholung)", { ...u(1), skill_id: "englisch.tenses.pastsimple" }),
    p("reading_listening", "Listening: …’s timetable", "Hörtext: ein Stundenplan", u(1)),
    p("sonstiges", "Speaking: Talking about your holidays / Talking about your daily routine / Talking about a timetable", "Über Ferien, Tagesablauf und Stundenplan sprechen", { ...u(1), status: "unklar", grund: sprechen }),
    p("reading_listening", "Reading: A school day in Australia and Rwanda / Snake adventures / A leaflet: Welcome to beautiful Chichen Itza!", "Lesetexte: Schultag, Schlangen-Abenteuer, Prospekt", u(1)),
    p("writing", "Writing an email about a past holiday/weekend", "E-Mail über vergangene Ferien oder ein Wochenende", { ...u(1), skill_id: "englisch.writing.email" }),
    p("sonstiges", "Our Young World 1: …’s ‘Call to action!’", "Our Young World 1", { ...u(1), status: "unklar", grund: "Steht nicht auf dem Stoffzettel." }),
    p("sonstiges", "MORE! A song 4 U: Where did you go?", "Lied: Where did you go?", u(1)),
    p("sonstiges", "A poem: A snake poem", "Gedicht: A snake poem", { ...u(1), status: "unklar", grund: more }),
    // ---- Unit 2 ----
    p("wortschatz", "Unit 2: How embarrassing!", "Peinliche Situationen", { ...u(2), skill_id: "englisch.vocab.gefuehle" }),
    p("wortschatz", "Vocabulary: Adjectives", "Adjektive", u(2)),
    p("grammatik", "Past simple negation (revision)", "Past Simple: Verneinung (Wiederholung)", { ...u(2), skill_id: "englisch.tenses.pastsimple" }),
    p("grammatik", "Past simple questions", "Past Simple: Fragen", { ...u(2), skill_id: "englisch.tenses.pastsimple" }),
    p("grammatik", "Why and because", "Why und because", u(2)),
    p("reading_listening", "Listening: Modern art / A dialogue: … and her Dad", "Hörtexte: Moderne Kunst, ein Dialog", u(2)),
    p("sonstiges", "Speaking: Acting out a dialogue: Giving reasons / Expressing your opinion", "Dialog spielen: Gründe angeben, Meinung sagen", { ...u(2), status: "unklar", grund: sprechen }),
    p("reading_listening", "Reading: Embarrassing stories / A leaflet / A webpage: Online dos and don’ts / A sketch: …’s dumplings", "Lesetexte: peinliche Geschichten, Prospekt, Webseite, Sketch", u(2)),
    p("writing", "Writing a picture story", "Eine Bildergeschichte schreiben", { ...u(2), skill_id: "englisch.writing.story" }),
    p("sonstiges", "MORE! Sounds right: /w/", "Aussprache: /w/", { ...u(2), status: "unklar", grund: more }),
    p("sonstiges", "The Story of the Stones 1: It’s only a dream", "The Story of the Stones 1", u(2)),
    p("wortschatz", "Everyday English: I mean. Oh, come on. I promise.", "Everyday English: I mean, Oh come on, I promise", u(2)),
    // ---- Unit 3 ----
    p("umfang", "Unit 3: Halloween", "Unit 3: Halloween", u(3)),
    p("wortschatz", "Vocabulary: Halloween", "Halloween", u(3)),
    p("grammatik", "should / shouldn’t", "should / shouldn’t", { ...u(3), status: "unklar", grund: "Steht nur im Inhaltsverzeichnis; der Stoffzettel nennt es nicht ausdrücklich.", skill_id: "englisch.grammar.modal-basics" }),
    p("reading_listening", "Listening: The mysterious girl (part 2)", "Hörtext: The mysterious girl, Teil 2", u(3)),
    p("sonstiges", "Speaking: Creating an ending to a story / Saying why you (didn’t) like a story / Making suggestions", "Ende einer Geschichte erfinden, Vorschläge machen", { ...u(3), status: "unklar", grund: sprechen }),
    p("sonstiges", "The Twins 1: The bike tour (apologising / expressing strong dislike)", "The Twins 1: The bike tour", u(3)),
    p("reading_listening", "Reading: A webpage: Halloween traditions / The mysterious girl (part 1)", "Lesetexte: Halloween-Bräuche, The mysterious girl, Teil 1", u(3)),
    p("writing", "Writing an email answer based on a mind map (making suggestions)", "E-Mail-Antwort mit Mindmap", { ...u(3), skill_id: "englisch.writing.email" }),
    p("sonstiges", "MORE! A song 4 U: When they come after you", "Lied: When they come after you", u(3)),
    p("sonstiges", "A poem: I’m not so keen on Halloween", "Gedicht: I’m not so keen on Halloween", { ...u(3), status: "unklar", grund: more }),
  ],
  schwierigkeiten: [],
  termin_text: null,
  unsicher: [],
};
