import type { Bereich, Modul } from "./bauen";

/**
 * English topics of the Oberstufe (9. to 13. Schulstufe: AHS 5th to 8th class, HAK and HTL I. to V.
 * Jahrgang): what is new or clearly harder after the Unterstufe, each skill with a short explanation
 * and the typical errors students make. The basics (all core tenses, if-clauses type 1 and 2, the basic
 * passive, reported speech, modal verbs, defining relative clauses, simple writing) are in the
 * Unterstufe module.
 *
 * Own structure and own wording, British English. The topics follow the Lehrpläne
 * (curriculum/ris-ahs-englisch.json classes 5 to 8, ris-hak-englisch.json, ris-htl-englisch.json) and the
 * formats of the standardised Reife- und Diplomprüfung, and were checked against the tables of contents
 * of common Austrian English books, topic names only: no task, example or text is taken from a book or
 * an exam. The links to the Lehrplan are in scripts/lehrplan_mapping.json.
 */
const BEREICHE: Bereich[] = [
  {
    area: "Tenses",
    themen: [
      {
        id: "englisch.os.tenses.past-perfect-progressive",
        name: "Past Perfect Progressive",
        stufen: [9, 11],
        erklaerung: "had been + -ing: Eine Handlung lief schon eine Zeit lang, bevor in der Vergangenheit etwas anderes geschah, oft mit for oder since. Sie erklärt auch eine sichtbare Folge. Beispiel: When we arrived, they had been waiting for two hours. She was tired because she had been working all night.",
        fehler: [
          "Present Perfect Progressive verwendet, obwohl die Geschichte in der Vergangenheit spielt (When I arrived, she has been waiting for an hour)",
          "Zustandsverben in die Verlaufsform gesetzt (I had been knowing him for years statt I had known him for years)",
          "Verlaufsform für abgeschlossene, gezählte Handlungen verwendet (She had been writing three letters statt She had written three letters)",
        ],
      },
      {
        id: "englisch.os.tenses.future-progressive",
        name: "Future Progressive (will be doing)",
        stufen: [9, 11],
        erklaerung: "will be + -ing: Eine Handlung läuft zu einem bestimmten Zeitpunkt in der Zukunft gerade ab. Auch für Dinge, die ohnehin so ablaufen werden. Beispiel: This time tomorrow I'll be sitting on the plane. Don't call at eight. We'll be having dinner then.",
        fehler: [
          "Für eine Handlung, die zu einem Zeitpunkt gerade läuft, nur will + Grundform verwendet (This time tomorrow I will sit on the plane statt I will be sitting)",
          "„be“ oder -ing vergessen (At ten I will working; At ten I will be work)",
          "Zustandsverben in die Verlaufsform gesetzt (Next week I'll be knowing the results)",
        ],
      },
      {
        id: "englisch.os.tenses.future-perfect",
        name: "Future Perfect (will have done)",
        stufen: [9, 12],
        erklaerung: "will have + 3. Form: Eine Handlung ist bis zu einem Zeitpunkt in der Zukunft abgeschlossen. Signalwörter: by, by then, by the time. Beispiel: By 2030 I will have finished my studies. By the time you get home, I'll have cooked dinner.",
        fehler: [
          "Nach „by the time“ ebenfalls will verwendet (By the time you will get home, I'll have cooked)",
          "Die 2. statt der 3. Form verwendet (By Friday I will have wrote the report)",
          "„until“ statt „by“ verwendet (Until Monday I will have finished it statt By Monday)",
        ],
      },
    ],
  },
  {
    area: "Grammar",
    themen: [
      {
        id: "englisch.os.grammar.be-used-to",
        name: "be used to und get used to (an etwas gewöhnt sein)",
        stufen: [9, 11],
        erklaerung: "be used to + -ing oder Nomen: an etwas gewöhnt sein. get used to + -ing oder Nomen: sich daran gewöhnen. Nicht verwechseln mit used to + Grundform für frühere Gewohnheiten. Beispiel: I used to live in Linz. Now I'm used to living in Vienna. You'll soon get used to driving on the left.",
        fehler: [
          "Nach „be used to“ die Grundform verwendet (I'm used to get up early)",
          "Mit „used to + Grundform“ verwechselt (I used to work at night, gemeint: Ich bin Nachtarbeit gewohnt, richtig: I'm used to working at night)",
          "„be used to“ statt „get used to“ für den Vorgang des Gewöhnens (I'm slowly being used to the noise statt I'm slowly getting used to the noise)",
        ],
      },
      {
        id: "englisch.os.grammar.causative",
        name: "Etwas machen lassen: have / get something done",
        stufen: [9, 11],
        erklaerung: "Wenn man etwas nicht selbst macht, sondern machen lässt: have + Objekt + 3. Form, umgangssprachlich auch get. Die Zeit zeigt die Form von have. Beispiel: I had my hair cut yesterday. We are having our kitchen painted. You should get your eyes tested.",
        fehler: [
          "Objekt und Partizip vertauscht (I had cut my hair, gemeint: beim Friseur)",
          "Grundform statt 3. Form verwendet (I want to have my car repair)",
          "„let“ für „lassen“ verwendet (I let my hair cut)",
        ],
      },
      {
        id: "englisch.os.grammar.non-defining",
        name: "Non-defining Relative Clauses (mit Beistrichen)",
        stufen: [9, 11],
        erklaerung: "Ein non-defining Relativsatz gibt nur eine Zusatzinformation. Er wird mit Beistrichen abgetrennt, „that“ ist nicht erlaubt und das Relativpronomen darf nicht wegfallen. which kann sich auf den ganzen Satz beziehen. Beispiel: My sister, who lives in Graz, is a nurse. He passed the test, which surprised everyone.",
        fehler: [
          "„that“ statt „who“ oder „which“ verwendet (My sister, that lives in Graz, is a nurse)",
          "Beistriche wie im Deutschen auch beim bestimmenden Relativsatz gesetzt (Students, who cheat, will fail, gemeint: nur die, die schummeln)",
          "Für den ganzen Satz „what“ statt „which“ verwendet (He passed the test, what surprised everyone)",
        ],
      },
      {
        id: "englisch.os.grammar.gerund-infinitive",
        name: "Gerund oder Infinitiv mit Bedeutungsunterschied (remember, stop, try)",
        stufen: [9, 12],
        erklaerung: "Bei manchen Verben ändert die Form die Bedeutung: remember / forget doing (Vergangenes) und to do (eine Aufgabe), stop doing (aufhören) und to do (anhalten, um etwas zu tun), try doing (ausprobieren) und to do (sich bemühen), regret doing (bereuen). Beispiel: I remember locking the door. Remember to lock the door!",
        fehler: [
          "„stop to do“ für „aufhören“ verwendet (I stopped to smoke last year statt I stopped smoking)",
          "„forget“ mit -ing für eine vergessene Aufgabe verwendet (I forgot buying milk statt I forgot to buy milk)",
          "„regret“ mit Infinitiv für Bedauern über eigenes Verhalten verwendet (I regret to shout at her yesterday statt I regret shouting at her yesterday)",
        ],
      },
      {
        id: "englisch.os.grammar.indirect-questions",
        name: "Indirekte Fragen in höflichen Bitten (Could you tell me …)",
        stufen: [9, 12],
        erklaerung: "Nach Einleitungen wie Could you tell me …, Do you know …, I was wondering … steht die Wortstellung eines Aussagesatzes: Subjekt vor Verb, kein do, does oder did. Ja/Nein-Fragen leitet man mit if oder whether ein. Beispiel: Could you tell me when the next train leaves? I was wondering if you could help me.",
        fehler: [
          "Die Wortstellung der direkten Frage behalten (Could you tell me where is the station?)",
          "„do“, „does“ oder „did“ stehen gelassen (Do you know what time does the shop open?)",
          "Bei Ja/Nein-Fragen „if“ oder „whether“ vergessen (I'd like to know is the room available)",
        ],
      },
      {
        id: "englisch.os.grammar.passive-advanced",
        name: "Passiv für Fortgeschrittene: Infinitiv, Gerund, zwei Objekte",
        stufen: [9, 12],
        erklaerung: "Passiv gibt es auch als Infinitiv (to be + 3. Form) und als Gerund (being + 3. Form). Bei zwei Objekten wird meist die Person Subjekt, bei Verben mit Präposition bleibt die Präposition stehen. Beispiel: This form needs to be signed. I hate being told what to do. I was given a second chance. The baby is looked after by her grandma.",
        fehler: [
          "Aktiven Infinitiv statt Passiv verwendet (This form needs to sign statt needs to be signed)",
          "„mir wurde“ wörtlich übersetzt (Me was given a chance statt I was given a chance)",
          "Die Präposition im Passiv weggelassen (The baby is looked by her grandma statt is looked after)",
        ],
      },
      {
        id: "englisch.os.grammar.wish",
        name: "wish und if only",
        stufen: [10, 13],
        erklaerung: "Wunsch über die Gegenwart: wish + Past Simple. Bedauern über die Vergangenheit: wish + Past Perfect. Ärger über etwas, das andere tun oder das passiert: wish + would. If only ist stärker. Beispiel: I wish I had more time. I wish I hadn't said that. If only it would stop raining!",
        fehler: [
          "Nach „wish“ die Gegenwart verwendet (I wish I have more time)",
          "Für Bedauern über die Vergangenheit das Past Simple verwendet (I wish I didn't say that statt I wish I hadn't said that)",
          "„would“ für einen Wunsch über sich selbst verwendet (I wish I would be taller statt I wish I was / were taller)",
        ],
      },
      {
        id: "englisch.os.grammar.mixed-conditionals",
        name: "Gemischte if-Sätze (Mixed Conditionals)",
        stufen: [10, 13],
        erklaerung: "Bedingung und Folge liegen in verschiedenen Zeiten. Vergangenheit mit Folge jetzt: If + Past Perfect, would + Grundform. Gegenwart mit Folge in der Vergangenheit: If + Past Simple, would have + 3. Form. Beispiel: If I had studied harder, I would be at university now. If I weren't so shy, I would have spoken to her.",
        fehler: [
          "Immer Typ 3 verwendet, obwohl die Folge in der Gegenwart liegt (If I had taken the job, I would have been rich now)",
          "„would“ in den if-Satz gesetzt (If I would have studied harder, I would be at university now)",
          "„hätte“ im Hauptsatz mit „had“ übersetzt (If I had saved money, I had a car now statt I would have a car now)",
        ],
      },
      {
        id: "englisch.os.grammar.modal-deduction",
        name: "Vermutungen über die Vergangenheit: must have, can't have, might have",
        stufen: [10, 13],
        erklaerung: "Modalverb + have + 3. Form zeigt, wie sicher man sich über Vergangenes ist. must have: fast sicher ja. can't have oder couldn't have: fast sicher nein. might, may oder could have: vielleicht. Beispiel: The streets are wet, so it must have rained. She didn't wave, so she can't have seen us.",
        fehler: [
          "„mustn't have“ statt „can't have“ für eine sichere Verneinung verwendet (He mustn't have heard me)",
          "Nach „have“ die 2. statt der 3. Form verwendet (She must have went home)",
          "Die Gegenwartsform verwendet, obwohl es um Vergangenes geht (He must be at home yesterday)",
        ],
      },
      {
        id: "englisch.os.grammar.modal-criticism",
        name: "Kritik und Bedauern: should have, could have, needn't have",
        stufen: [10, 13],
        erklaerung: "should have + 3. Form: Es wäre richtig gewesen, ist aber nicht passiert (Kritik, Bedauern). could have: Es wäre möglich gewesen. needn't have: Man hat es getan, es war aber unnötig. Beispiel: You should have told me earlier. We needn't have hurried. The train was late anyway.",
        fehler: [
          "„should“ mit der Grundform für Vergangenes verwendet (You should tell me yesterday)",
          "„needn't have“ verwendet, obwohl man es gar nicht getan hat (I needn't have bought milk, gemeint: ich habe keine gekauft, richtig: I didn't need to buy milk)",
          "„of“ statt „have“ geschrieben (You should of asked)",
        ],
      },
      {
        id: "englisch.os.grammar.passive-reporting",
        name: "Passiv mit Berichtsverben (it is said that, he is said to)",
        stufen: [10, 13],
        erklaerung: "Für Meinungen und Berichte ohne genaue Quelle: It is said / believed / reported that … oder Person + is said to + Grundform. Für Vergangenes: to have + 3. Form. Beispiel: It is believed that the thief escaped by car. The thief is believed to have escaped by car. She is said to be very rich.",
        fehler: [
          "Beide Konstruktionen vermischt (The thief is believed that he escaped)",
          "Für Vergangenes den einfachen Infinitiv verwendet (He is said to leave the country last year statt to have left)",
          "„soll“ im Sinn von „angeblich“ mit should übersetzt (She should be very rich statt She is said to be very rich)",
        ],
      },
      {
        id: "englisch.os.grammar.reporting-verbs",
        name: "Reporting Verbs (suggest, deny, accuse … of)",
        stufen: [10, 13],
        erklaerung: "Statt immer „say“ gibt ein Reporting Verb die Absicht wieder. Jedes Verb hat sein Muster: promise, refuse, offer to do; advise, warn, remind sb to do; deny, admit, suggest doing; accuse sb of doing; apologise for doing. Beispiel: „I didn't take the money.“ → He denied taking the money.",
        fehler: [
          "„suggest“ mit Objekt und Infinitiv verwendet (She suggested me to take the bus statt She suggested taking the bus)",
          "Falsche Präposition nach dem Verb (He accused me for lying statt He accused me of lying)",
          "Nach „deny“ oder „admit“ den Infinitiv verwendet (He denied to take the money)",
        ],
      },
      {
        id: "englisch.os.grammar.participle-clauses",
        name: "Partizipialsätze (Walking home, …; Having finished, …)",
        stufen: [10, 13],
        erklaerung: "Ein Partizipialsatz ersetzt einen Nebensatz mit demselben Subjekt. -ing: aktiv und gleichzeitig. 3. Form: passiv. having + 3. Form: vorher abgeschlossen. Beispiel: Walking home, I met an old friend. Built in 1890, the house needs repairs. Having finished her homework, she went out.",
        fehler: [
          "Subjekt des Hauptsatzes passt nicht zum Partizip (Walking home, the rain started)",
          "Aktive und passive Form verwechselt (Writing in 1890, the novel is still popular statt Written in 1890)",
          "Eine Konjunktion davorgesetzt, die nicht passt (Because feeling tired, I went to bed statt Feeling tired, I went to bed)",
        ],
      },
      {
        id: "englisch.os.grammar.inversion",
        name: "Inversion zur Betonung (Never have I …, Not only … but also)",
        stufen: [11, 13],
        erklaerung: "Nach verneinenden oder einschränkenden Ausdrücken am Satzanfang (never, rarely, not only, hardly … when, no sooner … than, only then) folgt die Wortstellung einer Frage, oft mit do, does oder did. Typisch für formelle Texte. Beispiel: Never have I seen such a mess. Not only did he lose, but he also blamed the referee.",
        fehler: [
          "Nach dem einleitenden Ausdruck die normale Wortstellung behalten (Never I have seen such a mess)",
          "„do“, „does“ oder „did“ vergessen und das Vollverb vorgezogen (Not only lost he the match statt Not only did he lose the match)",
          "„no sooner“ mit „when“ statt „than“ verbunden (No sooner had we arrived when it started to rain)",
        ],
      },
      {
        id: "englisch.os.grammar.cleft",
        name: "Cleft Sentences (It was … who; What I need is …)",
        stufen: [11, 13],
        erklaerung: "Ein Cleft Sentence hebt einen Satzteil hervor: It is / was + betonter Teil + who / that …, oder What + Satz + is / was … Beispiel: Tom broke the window. → It was Tom who broke the window. I need a holiday. → What I need is a holiday.",
        fehler: [
          "Nach „It was …“ das Relativpronomen weggelassen (It was Tom broke the window)",
          "„which“ statt „what“ am Satzanfang verwendet (Which I need is a holiday)",
          "Bei Personen „which“ statt „who“ verwendet (It was my brother which called)",
        ],
      },
    ],
  },
  {
    area: "Vocabulary",
    themen: [
      {
        id: "englisch.os.vocab.word-formation",
        name: "Word Formation: Nomen, Adjektive, Verben und Adverbien bilden",
        stufen: [9, 12],
        erklaerung: "Zuerst klären, welche Wortart in den Satz gehört, dann mit einer Nachsilbe bilden. Nomen: -ment, -ness, -ion, -ity. Adjektive: -ful, -less, -ous, -able, -al. Verben: -en, -ise. Adverbien: -ly. Beispiel: The (decide) was difficult. → decision. She answered (polite). → politely.",
        fehler: [
          "Die falsche Wortart eingesetzt (The decide was difficult; She answered polite)",
          "Falsche Nachsilbe oder Schreibung (explainment statt explanation, beautifull statt beautiful)",
          "Mehrzahl oder Verneinung übersehen, die der Satz verlangt (Many (employ) are unhappy → employee statt employees)",
        ],
      },
      {
        id: "englisch.os.vocab.prefixes",
        name: "Word Formation: Verneinung mit un-, in-, im-, il-, ir-, dis- und mis-",
        stufen: [9, 11],
        erklaerung: "Verneinende Vorsilben drehen die Bedeutung um. Welche passt, muss man mitlernen; in- wird vor b, m und p zu im-, vor l zu il-, vor r zu ir-. mis- heißt „falsch“. Beispiel: possible → impossible, legal → illegal, regular → irregular, honest → dishonest, understand → misunderstand.",
        fehler: [
          "Die falsche Vorsilbe gewählt (unpossible statt impossible, unlegal statt illegal)",
          "Beim Anfügen einen Buchstaben weggelassen (ilegal statt illegal, disatisfied statt dissatisfied)",
          "Die Verneinung vergessen, obwohl der Satz sie verlangt (The plan was (realistic) and failed → realistic statt unrealistic)",
        ],
      },
      {
        id: "englisch.os.vocab.collocations",
        name: "Collocations: Wörter, die zusammengehören",
        stufen: [9, 13],
        erklaerung: "Collocations sind feste Wortverbindungen, die man nicht wörtlich aus dem Deutschen übersetzen kann. Am besten lernt man ein Wort gleich mit seinem Partner. Beispiel: make a mistake, do homework, take a photo, pay attention, heavy rain, strong coffee, a high price.",
        fehler: [
          "make und do verwechselt (do a mistake, make homework)",
          "Deutsch wörtlich übersetzt (strong rain statt heavy rain, hold a speech statt give a speech)",
          "Falsches Verb zum Nomen (make a photo statt take a photo, say a lie statt tell a lie)",
        ],
      },
      {
        id: "englisch.os.vocab.dependent-prepositions",
        name: "Dependent Prepositions (interested in, depend on)",
        stufen: [9, 12],
        erklaerung: "Viele Verben, Adjektive und Nomen haben eine feste Präposition, oft eine andere als im Deutschen. Folgt ein Verb, steht es in der -ing-Form. Beispiel: It depends on the weather. She is good at maths. I'm interested in learning Spanish. We're looking forward to seeing you.",
        fehler: [
          "Präposition aus dem Deutschen übernommen (It depends from the weather; I'm interested for music)",
          "Nach der Präposition die Grundform statt -ing verwendet (I look forward to see you)",
          "Eine Präposition bei Verben gesetzt, die keine haben (discuss about the problem, marry with someone)",
        ],
      },
      {
        id: "englisch.os.vocab.phrasal-verbs",
        name: "Phrasal Verbs",
        stufen: [9, 13],
        erklaerung: "Ein Phrasal Verb besteht aus Verb und Partikel und hat oft eine neue Bedeutung. Bei trennbaren Verben steht ein Pronomen immer zwischen Verb und Partikel. Beispiel: give up (aufgeben), look after (aufpassen auf), turn down (ablehnen). They turned down the offer. They turned it down.",
        fehler: [
          "Pronomen hinter die Partikel gestellt (They turned down it)",
          "Untrennbare Verben getrennt (I look my sister after)",
          "Bedeutung aus den Einzelwörtern geraten (put up with als „hinauflegen“ statt „ertragen“)",
        ],
      },
      {
        id: "englisch.os.vocab.idioms",
        name: "Idioms (Redewendungen)",
        stufen: [10, 13],
        erklaerung: "Idioms sind feste Redewendungen mit übertragener Bedeutung. Man verwendet sie unverändert und eher in informellen Texten. Beispiel: It's a piece of cake (sehr leicht). I'm feeling under the weather (nicht ganz gesund). Let's call it a day (für heute Schluss machen).",
        fehler: [
          "Eine deutsche Redewendung wörtlich übersetzt (That's not my beer statt That's not my problem)",
          "Die feste Form verändert (It's a piece of the cake statt It's a piece of cake)",
          "Idioms in formellen Texten wie Bewerbung oder Report verwendet (In conclusion, the project was a piece of cake)",
        ],
      },
      {
        id: "englisch.os.vocab.confusables",
        name: "Leicht verwechselte Wörter (borrow und lend, rise und raise, affect und effect)",
        stufen: [9, 12],
        erklaerung: "borrow: sich ausborgen, lend: herborgen. rise (rose, risen): steigen, ohne Objekt; raise (raised): erhöhen, heben, mit Objekt. affect ist meist das Verb (beeinflussen), effect das Nomen (Wirkung). Beispiel: Can you lend me your pen? Prices have risen. The shop raised its prices. Stress affects your sleep.",
        fehler: [
          "borrow und lend verwechselt (Can you borrow me your pen?)",
          "raise ohne Objekt verwendet (Prices have raised by 5%)",
          "effect als Verb verwendet (The weather effects my mood)",
        ],
      },
    ],
  },
  {
    area: "Language in Use",
    themen: [
      {
        id: "englisch.os.liu.gap-fill-choice",
        name: "Banked Gap Fill und Multiple Choice Gap Fill",
        stufen: [10, 12],
        schularten: ["Gymnasium"],
        erklaerung: "Bei Banked Gap Fill wählt man aus einer Wortliste, bei Multiple Choice aus vorgegebenen Möglichkeiten. Entscheidend sind Wortart, Grammatik und feste Verbindungen rund um die Lücke. Verbrauchte Wörter streichen. Beispiel: She ___ attention to detail. A makes, B pays, C does, D takes → B.",
        fehler: [
          "Nur nach der Bedeutung gewählt und die Wortart übersehen (ein Nomen eingesetzt, wo nach „very“ ein Adjektiv stehen muss)",
          "Bei Banked Gap Fill ein Wort zweimal verwendet",
          "Die Präposition nach der Lücke übersehen (keen statt interested in „She is ___ in jazz“)",
        ],
      },
      {
        id: "englisch.os.liu.open-gap-fill",
        name: "Open Gap Fill (Lücken ohne Vorgaben)",
        stufen: [10, 12],
        schularten: ["Gymnasium"],
        erklaerung: "In jede Lücke kommt genau ein Wort, meist ein Funktionswort: Präposition, Artikel, Pronomen, Hilfsverb oder Konjunktion. Den ganzen Satz lesen und fragen, was grammatisch fehlt. Beispiel: She has lived here ___ 2015. → since. It was ___ cold that we stayed inside. → so.",
        fehler: [
          "Mehr als ein Wort in eine Lücke geschrieben (has been statt nur been)",
          "Nur auf das Wort vor der Lücke geschaut, nicht auf das danach (since statt for vor „two years“)",
          "Ein Wort gewählt, das inhaltlich passt, aber grammatisch nicht (It was very cold that we stayed inside statt so cold)",
        ],
      },
      {
        id: "englisch.os.liu.editing",
        name: "Editing: überflüssige Wörter finden",
        stufen: [10, 12],
        schularten: ["Gymnasium"],
        erklaerung: "In vielen Zeilen steht ein Wort zu viel, das dort nicht hingehört, manche Zeilen sind richtig. Jede Zeile im ganzen Satz lesen, auch über das Zeilenende hinaus. Typisch: doppelte Hilfsverben, to nach Modalverben, doppelte Steigerung. Beispiel: I have been living here since for three years. → since.",
        fehler: [
          "In jeder Zeile ein Fehlerwort gesucht und richtige Zeilen nicht erkannt",
          "Nur die Zeile gelesen und übersehen, dass der Satz in der nächsten Zeile weitergeht",
          "Typische überflüssige Wörter übersehen (He must to go; She is more taller than me)",
        ],
      },
    ],
  },
  {
    area: "Reading",
    themen: [
      {
        id: "englisch.os.reading.multiple-choice",
        name: "Reading: Multiple Choice",
        stufen: [9, 13],
        erklaerung: "Zuerst Frage und Antworten lesen, dann die Textstelle suchen und genau vergleichen. Die richtige Antwort sagt dasselbe wie der Text, meist mit anderen Wörtern. Falsche Antworten verwenden oft Wörter aus dem Text, sagen aber etwas anderes. Beispiel: Text „Few people came.“ passt zu „The event was poorly attended.“",
        fehler: [
          "Die Antwort gewählt, die dieselben Wörter wie der Text enthält",
          "Mit eigenem Wissen geantwortet statt mit dem Text",
          "Verneinungen und Einschränkungen überlesen (not, hardly, only, most)",
        ],
      },
      {
        id: "englisch.os.reading.multiple-matching",
        name: "Reading: Multiple Matching (Überschriften und Satzenden zuordnen)",
        stufen: [9, 13],
        erklaerung: "Zu jedem Absatz oder Satzanfang passt genau eine Option, meist bleiben einige übrig. Erst alle Optionen lesen, dann jeden Absatz auf seine Hauptaussage prüfen. Bei Satzenden muss der Satz inhaltlich und grammatisch passen. Sichere Zuordnungen zuerst. Beispiel: Absatz über steigende Mieten → „Housing becomes unaffordable“.",
        fehler: [
          "Eine Überschrift gewählt, die nur zu einem Detail passt, nicht zur Hauptaussage",
          "Eine Option zweimal verwendet",
          "Bei Satzenden die Grammatik nicht geprüft (The company decided to … mit einem Ende kombiniert, das mit „opening“ beginnt)",
        ],
      },
      {
        id: "englisch.os.reading.gapped-text",
        name: "Reading: Gapped Text (Sätze in Lücken einsetzen)",
        stufen: [10, 13],
        erklaerung: "Aus dem Text wurden Sätze oder Absätze entfernt. Verweiswörter verbinden die Lücke mit dem Text davor und danach: Pronomen (he, this, these), Linking Words (however, as a result) und Wiederholungen. Beispiel: „However, this idea was soon rejected.“ braucht davor eine Idee, die jemand vorgeschlagen hat.",
        fehler: [
          "Nur den Satz vor der Lücke beachtet, nicht den danach",
          "Pronomen nicht zurückverfolgt („they“ bezieht sich auf eine Gruppe, die davor gar nicht vorkommt)",
          "Linking Words falsch gedeutet (however als Fortsetzung statt als Gegensatz gelesen)",
        ],
      },
      {
        id: "englisch.os.reading.short-answers",
        name: "Reading: Short Answers (kurze Antworten mit Wortgrenze)",
        stufen: [9, 13],
        erklaerung: "Die Antwort steht im Text. Man schreibt sie kurz und so, wie es die Angabe verlangt, meist höchstens vier Wörter. Das Fragewort genau beachten: when verlangt eine Zeit, why einen Grund. Keine ganzen Sätze. Beispiel: Why did the shop close? → because of high rents.",
        fehler: [
          "Mehr Wörter geschrieben als erlaubt, oft einen ganzen Satz abgeschrieben",
          "Das Fragewort missachtet (auf why mit einer Zeitangabe geantwortet)",
          "Eine Stelle abgeschrieben, die das Stichwort enthält, aber die Frage nicht beantwortet",
        ],
      },
      {
        id: "englisch.os.reading.true-false",
        name: "Reading: True or False mit Begründung",
        stufen: [9, 13],
        erklaerung: "Man entscheidet, ob eine Aussage laut Text stimmt, und belegt das mit der passenden Textstelle. Die Begründung muss die Entscheidung wirklich beweisen, auch bei „False“. Beispiel: Aussage „Tom enjoyed the trip.“, Text „Tom said the trip was a waste of time.“ → False.",
        fehler: [
          "Eine Textstelle als Beleg genommen, die nur das Thema nennt, aber die Aussage nicht beweist",
          "Aussagen mit all, always oder never als richtig gewertet, obwohl der Text nur most oder often sagt",
          "Bei „False“ keine Begründung angegeben oder nur die Aussage verneint",
        ],
      },
      {
        id: "englisch.os.reading.literature",
        name: "Literarische Texte verstehen: Erzähler, Figuren und Stimmung",
        stufen: [10, 12],
        schularten: ["Gymnasium"],
        erklaerung: "Bei Erzählungen und Gedichten fragt man: Wer erzählt oder spricht? Wie werden die Figuren gezeigt, direkt oder durch ihr Verhalten? Welche Stimmung entsteht, durch welche Wörter? Jede Aussage mit einer Textstelle belegen. Beispiel: „Her hands were shaking as she opened the letter.“ zeigt Nervosität, ohne sie zu nennen.",
        fehler: [
          "Nur die Handlung nacherzählt, statt sie zu deuten",
          "Erzähler und Autorin oder Autor gleichgesetzt",
          "Behauptungen über Figuren ohne Beleg aus dem Text",
        ],
      },
    ],
  },
  {
    area: "Listening",
    themen: [
      {
        id: "englisch.os.listening.multiple-choice",
        name: "Listening: Multiple Choice",
        stufen: [9, 13],
        erklaerung: "Die richtige Antwort gibt das Gehörte meist mit anderen Wörtern wieder. Falsche Antworten enthalten oft Wörter, die man hört, oder eine Möglichkeit, die der Sprecher nennt und dann verwirft. Vor dem Hören klären, worin sich die Antworten unterscheiden. Beispiel: „We wanted to go on Friday, but in the end we went on Sunday.“ → Sunday.",
        fehler: [
          "Die zuerst genannte Information angekreuzt, obwohl der Sprecher sich danach korrigiert",
          "Eine Antwort gewählt, weil ein Wort daraus zu hören war",
          "Bei einer schwierigen Frage hängen geblieben und die nächsten verpasst",
        ],
      },
      {
        id: "englisch.os.listening.note-completion",
        name: "Listening: Short Answers und Note Completion",
        stufen: [9, 13],
        erklaerung: "Vor dem Hören überlegen, was in die Lücke gehört: eine Zahl, ein Name, ein Nomen? Beim Hören nur Stichwörter notieren, höchstens so viele Wörter wie erlaubt. Die Antwort muss grammatisch in die Notiz passen. Beispiel: Workshop starts at ___ → half past nine.",
        fehler: [
          "Ähnlich klingende Zahlen verwechselt (fifteen und fifty, thirteen und thirty)",
          "Ganze Sätze mitgeschrieben und dabei die nächste Antwort verpasst",
          "Ein Wort notiert, das nicht in die Lücke passt (Wortart, Einzahl oder Mehrzahl falsch)",
        ],
      },
      {
        id: "englisch.os.listening.matching",
        name: "Listening: Multiple Matching (Sprecher zuordnen)",
        stufen: [10, 13],
        erklaerung: "Mehrere Personen sprechen, zu jeder passt eine Aussage, meist bleiben einige Aussagen übrig. Auf Meinung und Haltung achten, nicht nur auf Stichwörter: Wer ist dafür, wer zweifelt? Beispiel: „I suppose it's useful, but I'd never pay for it.“ → sceptical about the price.",
        fehler: [
          "Nach einzelnen Stichwörtern zugeordnet, obwohl die Person etwas anderes meint",
          "Ironie oder Einschränkungen überhört (I suppose it's useful, but …)",
          "Eine Aussage mehreren Personen zugeordnet",
        ],
      },
    ],
  },
  {
    area: "Writing",
    themen: [
      {
        id: "englisch.os.writing.task",
        name: "Schreibauftrag umsetzen: Textsorte, Leser, Inhaltspunkte, Wortanzahl",
        stufen: [9, 13],
        erklaerung: "Vor dem Schreiben klären: Welche Textsorte? Wer liest den Text? Welche Inhaltspunkte verlangt die Angabe? Jeden Punkt in einem eigenen Absatz ausführlich behandeln und die Wortanzahl einhalten. Beispiel: Die Angabe verlangt „describe, explain, suggest“: drei Absätze mit Beschreibung, Erklärung und Vorschlag.",
        fehler: [
          "Einen Inhaltspunkt vergessen oder nur in einem Satz gestreift",
          "Typische Merkmale der Textsorte weggelassen (Article ohne Überschrift, E-Mail ohne Anrede)",
          "Die verlangte Wortanzahl deutlich unter- oder überschritten",
        ],
      },
      {
        id: "englisch.os.writing.paragraphs",
        name: "Absätze aufbauen: Topic Sentence, Begründung, Beispiel",
        stufen: [9, 13],
        erklaerung: "Jeder Absatz behandelt einen Gedanken. Er beginnt mit einem Topic Sentence, der den Gedanken nennt, dann folgen Begründung und Beispiel. Beispiel: Social media can harm young people's sleep. Many teenagers check their phones late at night. For instance, a friend of mine often stays online until two in the morning.",
        fehler: [
          "Mehrere Gedanken in einem Absatz vermischt",
          "Eine Behauptung ohne Begründung oder Beispiel stehen gelassen",
          "Jeden Satz als eigenen Absatz geschrieben",
        ],
      },
      {
        id: "englisch.os.writing.register",
        name: "Register: formell oder informell schreiben",
        stufen: [9, 13],
        erklaerung: "Formell (Bewerbung, Beschwerde, Report): keine Kurzformen, keine Umgangssprache, höfliche Wendungen, eher Wörter wie receive, request, however. Informell (E-Mail an Freunde, Blog): Kurzformen, Phrasal Verbs, direkte Ansprache. Beispiel: formell „I would be grateful if you could …“, informell „Can you …?“",
        fehler: [
          "In formellen Texten Kurzformen verwendet (I'm, don't, can't)",
          "Umgangssprache in formellen Texten (Hi, gonna, stuff, really cool)",
          "Formelle und informelle Anrede und Grußformel gemischt (Dear Sir or Madam … Cheers)",
        ],
      },
      {
        id: "englisch.os.writing.linking-contrast",
        name: "Linking Words: Gegensatz und Einräumung (although, despite, however, whereas)",
        stufen: [9, 13],
        erklaerung: "although und even though + Satz; despite und in spite of + Nomen oder -ing; however steht meist am Anfang eines neuen Satzes, mit Beistrich danach; whereas und while stellen zwei Dinge gegenüber. Beispiel: Although it was raining, we went out. Despite the rain, we went out. It was raining. However, we went out.",
        fehler: [
          "„despite of“ geschrieben (despite of the rain)",
          "„although“ mit einem Nomen verwendet (although the rain)",
          "Zwei Sätze nur mit Beistrich und „however“ verbunden (It was raining, however we went out)",
        ],
      },
      {
        id: "englisch.os.writing.linking-cause",
        name: "Linking Words: Grund, Folge und Ergänzung (because of, therefore, moreover)",
        stufen: [9, 13],
        erklaerung: "Grund: because + Satz, because of oder due to + Nomen. Folge: so, therefore, as a result. Ergänzung: in addition, moreover, what is more. Beispiel: The match was cancelled because of the storm. The trains were late. As a result, many people missed their flights.",
        fehler: [
          "„because“ mit einem Nomen verwendet (because the storm)",
          "„therefore“ wie „so“ ohne Satzzeichen eingeschoben (It rained therefore we stayed at home)",
          "Immer dieselben Wörter wiederholt (and, but, so), statt abzuwechseln",
        ],
      },
      {
        id: "englisch.os.writing.informal-email",
        name: "Informelle E-Mail und informeller Brief (B2)",
        stufen: [10, 13],
        erklaerung: "Auf B2-Niveau geht man genau auf die Nachricht ein: auf Neuigkeiten reagieren, Rat geben oder eine Meinung begründen, jeder Inhaltspunkt in einem eigenen Absatz. Persönlicher Ton (Kurzformen, Phrasal Verbs, Fragen), aber korrekte Sprache. Beispiel: It was great to hear about your new job! If I were you, I'd ask for a few days off before you start.",
        fehler: [
          "Nicht auf die erhaltene Nachricht eingegangen, gleich mit den Inhaltspunkten begonnen",
          "Zu formell geschrieben (Dear Sir, I am writing to inform you … an eine Freundin)",
          "Chatsprache verwendet (u statt you, lol, Sätze ohne Großschreibung)",
        ],
      },
      {
        id: "englisch.os.writing.formal-email",
        name: "Formelle E-Mail und formeller Brief",
        stufen: [9, 13],
        erklaerung: "Betreff, Anrede, im ersten Satz der Grund des Schreibens, dann ein Absatz pro Anliegen, zum Schluss eine höfliche Bitte. Dear Sir or Madam passt zu Yours faithfully, Dear Ms Smith zu Yours sincerely. Beispiel: I am writing to enquire about the summer course advertised on your website.",
        fehler: [
          "Anrede und Grußformel falsch kombiniert (Dear Sir or Madam … Yours sincerely)",
          "Den Grund des Schreibens erst spät oder gar nicht genannt",
          "Deutsche Höflichkeitsformeln wörtlich übersetzt (With friendly greetings statt Kind regards)",
        ],
      },
      {
        id: "englisch.os.writing.complaint",
        name: "Formal Letter of Complaint (Beschwerdebrief)",
        stufen: [9, 13],
        erklaerung: "Sachlich und höflich bleiben: Was wurde wann gekauft oder gebucht, was ist das Problem, welche Folgen hatte es und was erwartet man (Ersatz, Reparatur, Geld zurück)? Beispiel: I am writing to complain about the headphones I ordered on 3 May. I would appreciate a full refund.",
        fehler: [
          "Unhöflich oder drohend geschrieben (This is a scandal! I will never buy here again!)",
          "Keine klare Forderung genannt, was die Firma tun soll",
          "Wichtige Angaben vergessen (Datum, Bestellnummer, genaue Beschreibung des Mangels)",
        ],
      },
      {
        id: "englisch.os.writing.essay",
        name: "Essay: Meinung begründen und Argumente abwägen",
        stufen: [10, 13],
        erklaerung: "Einleitung: Thema vorstellen und Interesse wecken. Hauptteil: ein Argument pro Absatz mit Begründung und Beispiel, beim Abwägen auch Gegenargumente. Schluss: Meinung zusammenfassen, keine neuen Argumente. Formeller Stil. Beispiel: On the one hand, school uniforms save money. On the other hand, they limit self-expression.",
        fehler: [
          "Nur Behauptungen aneinandergereiht, ohne Begründung und Beispiel",
          "Im Schluss neue Argumente gebracht",
          "„On the other hand“ für ein zusätzliches Argument statt für einen Gegensatz verwendet",
        ],
      },
      {
        id: "englisch.os.writing.article",
        name: "Article (Zeitungs- und Online-Artikel)",
        stufen: [10, 13],
        erklaerung: "Ein Article auf B2-Niveau verbindet Information und Meinung: Überschrift und Einstieg wecken Interesse, jeder Inhaltspunkt bekommt Beispiele oder Fakten, der Stil ist lebendig, aber nicht umgangssprachlich, der Schluss gibt eine Empfehlung. Beispiel: So, should we all switch off? Not completely, but one phone-free evening a week is a good start.",
        fehler: [
          "Überschrift vergessen oder nur die Aufgabenstellung wiederholt",
          "Inhaltspunkte nur behauptet, ohne Beispiele, Fakten oder eigene Erfahrungen",
          "Die Leser nie angesprochen, der Text wirkt wie ein Aufsatz ohne Publikum",
        ],
      },
      {
        id: "englisch.os.writing.blog-post",
        name: "Blog Post",
        stufen: [10, 13],
        erklaerung: "Auf B2-Niveau erzählt ein Blog Post nicht nur: Er verbindet eigene Erfahrungen mit Meinung, Begründung und Tipps und behandelt alle Inhaltspunkte in Absätzen. Persönlicher Ton mit Titel und Leseransprache, aber ohne Chatsprache. Beispiel: Three weeks without social media taught me more than I expected. Here's why everyone should try it.",
        fehler: [
          "Nur Stichworte oder Chatsprache statt ganzer Sätze (u, gonna, lol)",
          "Eine Meinung genannt, aber nicht begründet und ohne Beispiele oder Tipps",
          "Die Leser nicht einbezogen, keine Frage oder Aufforderung am Schluss",
        ],
      },
      {
        id: "englisch.os.writing.blog-comment",
        name: "Blog Comment (auf einen Beitrag antworten)",
        stufen: [10, 13],
        erklaerung: "Ein Blog Comment bezieht sich auf einen bestimmten Beitrag: zuerst sagen, worauf man reagiert, dann zustimmen oder widersprechen, mit Begründung und eigener Erfahrung. Höflich bleiben, auch bei anderer Meinung. Beispiel: I really enjoyed your post about volunteering, but I don't agree that it should be compulsory.",
        fehler: [
          "Nicht gesagt, auf welchen Beitrag oder welche Aussage man sich bezieht",
          "Wie einen eigenen Blog Post geschrieben, ohne auf den Beitrag einzugehen",
          "Andere Meinungen abwertend kommentiert (Your post is stupid)",
        ],
      },
      {
        id: "englisch.os.writing.review",
        name: "Review (Film-, Buch- oder Produktkritik)",
        stufen: [10, 13],
        erklaerung: "Eine Review stellt kurz vor, worum es geht, ohne das Ende zu verraten, bewertet Stärken und Schwächen mit Begründung und endet mit einer Empfehlung für eine bestimmte Zielgruppe. Beispiel: The plot is gripping, but the ending feels rushed. I would recommend it to anyone who enjoys crime stories.",
        fehler: [
          "Nur die Handlung nacherzählt, ohne zu bewerten",
          "Das Ende verraten",
          "Bewertung ohne Begründung (It was good. It was boring.)",
        ],
      },
      {
        id: "englisch.os.writing.report",
        name: "Report",
        stufen: [10, 13],
        erklaerung: "Ein Report informiert sachlich eine bestimmte Person oder Stelle, zum Beispiel die Schulleitung. Er hat einen Titel, eine Einleitung mit dem Zweck, Zwischenüberschriften zu den Inhaltspunkten und am Ende Empfehlungen. Formell, keine Kurzformen. Beispiel: The aim of this report is to evaluate the school canteen and suggest improvements.",
        fehler: [
          "Keine Zwischenüberschriften verwendet",
          "Persönlich und erzählend statt sachlich geschrieben (I was so happy when …)",
          "Die Empfehlungen am Ende vergessen",
        ],
      },
      {
        id: "englisch.os.writing.leaflet",
        name: "Leaflet",
        stufen: [9, 13],
        erklaerung: "Ein Leaflet informiert oder wirbt kurz und übersichtlich: auffällige Überschrift, Zwischenüberschriften, kurze Absätze oder Aufzählungspunkte, direkte Anrede und Aufforderungen. Beispiel: Want to stay fit? Join our running club! Every Monday at 5 pm in the park.",
        fehler: [
          "Als durchgehenden Fließtext ohne Zwischenüberschriften geschrieben",
          "Wichtige Informationen vergessen (wann, wo, Kontakt, Preis)",
          "Die Leser nicht direkt angesprochen (One should come … statt Come and …)",
        ],
      },
      {
        id: "englisch.os.writing.application",
        name: "Bewerbungsschreiben (Letter of Application)",
        stufen: [10, 13],
        erklaerung: "Im ersten Absatz die Stelle und wo man sie gefunden hat, dann Ausbildung und Erfahrungen mit Bezug zur Stelle, dann warum man genau dort arbeiten möchte, zum Schluss die Bitte um ein Gespräch. Beispiel: I am writing to apply for the summer internship advertised on your website.",
        fehler: [
          "Den Lebenslauf nacherzählt, statt die Eignung für die Stelle zu begründen",
          "Umgangssprachlich oder übertrieben geschrieben (I'm the best person you'll ever find)",
          "Falsche Präposition nach „apply“ (I would like to apply to the job statt apply for the job)",
        ],
      },
      {
        id: "englisch.os.writing.cv",
        name: "Lebenslauf (CV)",
        stufen: [10, 13],
        erklaerung: "Ein englischer CV ist klar gegliedert: Personal details, Profile, Education, Work experience, Skills, Interests. Ausbildung und Erfahrung in umgekehrter Reihenfolge, das Neueste zuerst. Stichpunkte mit aussagekräftigen Verben. Beispiel: July 2025: sales assistant, supermarket in Graz. Served customers, handled payments.",
        fehler: [
          "Die Stationen vom Ältesten zum Neuesten aufgelistet",
          "Österreichische Begriffe ohne Erklärung übernommen (Matura statt Matura (Austrian school-leaving exam), Praktikum statt work placement)",
          "Ganze Sätze mit „I“ statt kurzer Stichpunkte",
        ],
      },
      {
        id: "englisch.os.writing.proposal",
        name: "Proposal",
        stufen: [12, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Ein Proposal schlägt einer Person, die entscheidet, einen Plan vor. Aufbau mit Zwischenüberschriften: Zweck, Ausgangslage, Vorschläge mit Begründung, Kosten oder Nutzen, abschließende Empfehlung. Formell und überzeugend. Beispiel: The purpose of this proposal is to suggest ways of reducing paper use in our company.",
        fehler: [
          "Wie einen Report über Vergangenes geschrieben, statt einen Plan für die Zukunft vorzuschlagen",
          "Vorschläge ohne Begründung, Kosten oder Nutzen genannt",
          "Zu unsicher formuliert (Maybe we could perhaps try … statt I recommend that we introduce …)",
        ],
      },
    ],
  },
  {
    area: "Speaking",
    themen: [
      {
        id: "englisch.os.speaking.pictures",
        name: "Bilder vergleichen und Vermutungen anstellen",
        stufen: [9, 12],
        erklaerung: "Nicht jedes Detail aufzählen, sondern die Bilder vergleichen und deuten: Gemeinsamkeiten, Unterschiede, Vermutungen über Situation und Gefühle. Beispiel: Both pictures show people at work, but the people in the first one look much more relaxed. The man on the left might be waiting for someone. She seems to be worried.",
        fehler: [
          "Nur aufgezählt, was zu sehen ist (There is a man. There is a table.)",
          "Vermutungen als Tatsachen formuliert (He is angry statt He seems to be angry)",
          "Present Simple statt Present Progressive für das, was gerade passiert (The woman sits and reads statt is sitting and reading)",
        ],
      },
      {
        id: "englisch.os.speaking.presentation",
        name: "Präsentation auf B2-Niveau: Aufbau, Signposting, Fragen beantworten",
        stufen: [10, 13],
        erklaerung: "Einleitung mit Thema und Überblick, Hauptteil in klaren Abschnitten, Schluss mit Zusammenfassung und Einladung zu Fragen. Signposting führt durch den Vortrag, die Folien enthalten nur Stichworte. Beispiel: I've divided my talk into three parts. … That brings me to my second point. … I'd be happy to answer any questions.",
        fehler: [
          "Vom Blatt oder von den Folien abgelesen",
          "Keinen Überblick am Anfang gegeben und Übergänge nicht angekündigt",
          "Auf Nachfragen nicht vorbereitet (keine Wendungen wie That's a good question. I'd say …)",
        ],
      },
      {
        id: "englisch.os.speaking.graphs",
        name: "Grafiken und Statistiken beschreiben",
        stufen: [10, 13],
        erklaerung: "Zuerst sagen, was die Grafik zeigt (Thema, Zeitraum, Einheit), dann die wichtigsten Entwicklungen und Vergleiche, nicht jede Zahl. Verben: rise, increase, fall, decrease, drop, remain stable, peak. Beispiel: The chart shows how many people cycled to work between 2015 and 2025. The number rose sharply after 2020.",
        fehler: [
          "rise und raise verwechselt (The number raised to 40%)",
          "Jede einzelne Zahl vorgelesen, statt Entwicklungen zu beschreiben",
          "Prozent und Prozentpunkte verwechselt (von 20% auf 30% als increase of 10% statt of 10 percentage points)",
        ],
      },
      {
        id: "englisch.os.speaking.monologue",
        name: "Monolog: zu einem Thema zusammenhängend sprechen",
        stufen: [10, 13],
        erklaerung: "Im Monolog, etwa bei der mündlichen Matura, spricht man einige Minuten allein zu einem Thema mit mehreren Inhaltspunkten. Kurz gliedern: Einleitung, ein Abschnitt pro Punkt mit Beispiel, kurzer Schluss. Beispiel: First, I'd like to talk about … Moving on to my second point, … To sum up, …",
        fehler: [
          "Einen Inhaltspunkt ausgelassen oder nur kurz gestreift",
          "Einen auswendig gelernten Text aufgesagt, der nicht zur Aufgabe passt",
          "Lange Pausen, weil ein Wort fehlt, statt es zu umschreiben (It's a thing you use to …)",
        ],
      },
      {
        id: "englisch.os.speaking.dialogue",
        name: "Dialog: diskutieren, reagieren und sich einigen",
        stufen: [10, 13],
        erklaerung: "Im Dialog reagiert man auf das Gegenüber: zustimmen, widersprechen, nachfragen, Vorschläge machen und am Ende zu einer Entscheidung kommen. Beispiel: That's a good point, but have you thought about the cost? What if we asked the school for help? So, shall we go for the second option?",
        fehler: [
          "Nur eigene Gedanken vorgetragen, ohne auf das Gegenüber einzugehen",
          "Zu direkt widersprochen (You're wrong. statt I see what you mean, but …)",
          "Ohne Ergebnis aufgehört, obwohl die Aufgabe eine Einigung verlangt",
        ],
      },
      {
        id: "englisch.os.speaking.job-interview",
        name: "Bewerbungsgespräch (Job Interview)",
        stufen: [11, 13],
        erklaerung: "Typische Fragen vorbereiten (Tell me about yourself. What are your strengths? Why this job?) und mit konkreten Beispielen antworten. Eigene Fragen an die Firma stellen. Höflich, aber selbstbewusst. Beispiel: One of my strengths is teamwork. During my work placement, I organised a team event for twenty people.",
        fehler: [
          "Nur kurz oder ohne Beispiele geantwortet",
          "Keine Schwäche genannt oder eine, die die Stelle ausschließt (I have no weaknesses)",
          "Present Perfect mit Zeitangabe der Vergangenheit verwendet (I have worked there in 2024 statt I worked there in 2024)",
        ],
      },
    ],
  },
  {
    area: "Business English",
    themen: [
      {
        id: "englisch.os.business.phone",
        name: "Telefonieren im Beruf",
        stufen: [9, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Mit Name und Firma melden, den Grund des Anrufs nennen, Namen buchstabieren lassen, Zahlen zur Kontrolle wiederholen, am Ende zusammenfassen. Beispiel: Good morning, this is Lea Gruber from Huber Electronics. Could I speak to Mr Jones, please? I'm calling about our order.",
        fehler: [
          "„Here is“ statt „This is“ beim Melden verwendet (Here is Lea Gruber)",
          "Namen nicht buchstabieren lassen oder Zahlen nicht zur Kontrolle wiederholt",
          "Zu direkt formuliert (I want to speak with Mr Jones. statt Could I speak to Mr Jones, please?)",
        ],
      },
      {
        id: "englisch.os.business.appointments",
        name: "Termine und Reservierungen: vereinbaren, ändern, absagen",
        stufen: [10, 12],
        schularten: ["HAK", "HTL"],
        erklaerung: "Termine höflich vorschlagen und Datum, Uhrzeit und Ort bestätigen. Bei Reservierungen Zeitraum, Anzahl und Sonderwünsche nennen. Absagen und Änderungen mit kurzer Begründung und Alternative. Beispiel: Would Tuesday at 2 pm suit you? I'm afraid I have to cancel our meeting. Could we move it to Thursday?",
        fehler: [
          "Uhrzeit nach deutschem Muster angegeben (14 o'clock statt 2 pm)",
          "Abgesagt ohne Entschuldigung und ohne Alternative",
          "Präpositionen bei Zeitangaben vertauscht (at Monday, on 10 am statt on Monday, at 10 am)",
        ],
      },
      {
        id: "englisch.os.business.layout",
        name: "Geschäftsbrief: Aufbau und Layout",
        stufen: [10, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Ein englischer Geschäftsbrief hat Briefkopf, Datum, Empfängeradresse, Betreff, Anrede, Text in Absätzen, Grußformel und Unterschrift mit Name und Funktion, eventuell Enclosure. Datum britisch: 12 March 2026. Beispiel: Dear Mr Brown, … Yours sincerely, Anna Huber, Sales Manager.",
        fehler: [
          "Datum nur in Ziffern nach deutschem Muster (12.03.2026, in den USA als 3. Dezember gelesen)",
          "Anrede und Grußformel nicht zusammenpassend (Dear Mr Brown … Yours faithfully)",
          "Den ersten Satz nach der Anrede klein begonnen wie im Deutschen (Dear Mr Brown, thank you for …)",
        ],
      },
      {
        id: "englisch.os.business.memo",
        name: "Memo (interne Mitteilung)",
        stufen: [10, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Ein Memo ist eine kurze interne Mitteilung: Kopf mit To, From, Date, Subject, dann gleich zur Sache, sachlich und knapp, oft mit Aufzählung, ohne Anrede und Grußformel wie im Brief. Beispiel: Subject: Fire drill. Please note that there will be a fire drill on Friday at 10 am.",
        fehler: [
          "Wie einen Brief mit Anrede und Grußformel geschrieben",
          "Betreffzeile vergessen oder nichtssagend (Subject: Info)",
          "Lang und umständlich statt knapp mit Aufzählungen",
        ],
      },
      {
        id: "englisch.os.business.enquiry",
        name: "Enquiry (Anfrage)",
        stufen: [10, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Eine Enquiry sagt, wie man auf die Firma gekommen ist und was man braucht (Produkt, Menge, Liefertermin), und bittet um Preise, Rabatte und Lieferbedingungen. Beispiel: We saw your products at the trade fair in Munich and would be grateful if you could send us your current price list.",
        fehler: [
          "Nicht genau gesagt, was man wissen will (Menge, Termin oder Bedingungen fehlen)",
          "Zu direkt gebeten (Send us your prices. statt Could you please send us …)",
          "Indirekte Fragen mit Fragewortstellung gebaut (Could you tell us when can you deliver?)",
        ],
      },
      {
        id: "englisch.os.business.offer",
        name: "Offer (Angebot) als Antwort auf eine Anfrage",
        stufen: [10, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Für die Anfrage danken, die gewünschten Waren mit Preis, Rabatt, Lieferzeit und Zahlungsbedingungen anbieten, auf Vorteile hinweisen und zur Bestellung einladen. Beispiel: Thank you for your enquiry of 4 March. We are pleased to offer you 200 units at €12 each, including a 5% discount for orders over 100 units.",
        fehler: [
          "Wichtige Bedingungen vergessen (Lieferzeit, Zahlungsbedingungen, Gültigkeit des Angebots)",
          "Nicht auf die Anfrage Bezug genommen",
          "Preise unklar angegeben (12 statt €12 per unit)",
        ],
      },
      {
        id: "englisch.os.business.order",
        name: "Order (Bestellung) und Order Confirmation",
        stufen: [11, 13],
        schularten: ["HAK"],
        erklaerung: "Eine Bestellung nennt genau Artikelnummer, Bezeichnung, Menge, Preis, Liefertermin und Lieferadresse und bezieht sich auf das Angebot. Die Order Confirmation des Lieferanten bestätigt diese Angaben und dankt für den Auftrag. Beispiel: With reference to your offer of 10 April, we would like to order 50 office chairs (item no. 2045) at €89 each.",
        fehler: [
          "Angaben unvollständig (Artikelnummer, Menge oder Liefertermin fehlen)",
          "Nicht auf das Angebot verwiesen",
          "„order“ falsch konstruiert (We order at you statt We would like to place an order with you)",
        ],
      },
      {
        id: "englisch.os.business.delivery",
        name: "Versandanzeige und Lieferverzug",
        stufen: [12, 13],
        schularten: ["HAK"],
        erklaerung: "In der Versandanzeige teilt der Lieferant mit, was wann und wie verschickt wurde. Bei Lieferverzug schreibt der Kunde höflich, aber bestimmt: was bestellt war, welcher Termin zugesagt war und bis wann jetzt geliefert werden muss. Beispiel: The goods we ordered on 2 May have still not arrived, although delivery was promised for 20 May.",
        fehler: [
          "Bestelldatum, Bestellnummer oder zugesagten Liefertermin nicht genannt",
          "Keine neue Frist gesetzt oder unhöflich gedroht",
          "„still not“ falsch gestellt (The goods have not still arrived)",
        ],
      },
      {
        id: "englisch.os.business.adjustment",
        name: "Auf Beschwerden antworten (Adjustment)",
        stufen: [12, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Für die Nachricht danken, sich für die Unannehmlichkeiten entschuldigen, den Fehler ohne Ausreden erklären, eine Lösung anbieten (Ersatz, Gutschrift, Rabatt) und die gute Geschäftsbeziehung betonen. Beispiel: We apologise for the inconvenience caused. A replacement will be sent to you free of charge.",
        fehler: [
          "Dem Kunden die Schuld gegeben oder Ausreden gesucht",
          "Sich entschuldigt, aber keine konkrete Lösung angeboten",
          "Zu umgangssprachlich entschuldigt (Sorry for that! statt We apologise for …)",
        ],
      },
      {
        id: "englisch.os.business.reminder",
        name: "Zahlungserinnerung bei Zahlungsverzug (Reminder)",
        stufen: [12, 13],
        schularten: ["HAK"],
        erklaerung: "Die erste Erinnerung ist freundlich und geht von einem Versehen aus: Rechnung, Betrag und Fälligkeitsdatum nennen und um Zahlung bitten. Spätere Mahnungen werden bestimmter und setzen eine Frist. Beispiel: We would like to remind you that our invoice no. 541 for €2,350, due on 15 June, has not yet been paid.",
        fehler: [
          "Schon die erste Erinnerung drohend formuliert",
          "Rechnungsnummer, Betrag oder Fälligkeitsdatum vergessen",
          "Beträge nach deutscher Schreibweise geschrieben (€2.350,00 statt €2,350.00)",
        ],
      },
      {
        id: "englisch.os.business.meetings",
        name: "Meetings: Vorschläge machen, unterbrechen, zusammenfassen",
        stufen: [11, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "In Besprechungen Meinungen höflich äußern und Vorschläge machen, andere ausreden lassen oder höflich unterbrechen und am Ende die Ergebnisse zusammenfassen. Beispiel: I suggest we postpone the launch. Sorry to interrupt, but could I add something? So, to sum up, we've agreed to …",
        fehler: [
          "„suggest“ mit Infinitiv verwendet (I suggest to postpone the launch)",
          "Ohne Einleitung unterbrochen oder widersprochen (No, that's wrong.)",
          "Am Ende keine Ergebnisse und Aufgaben festgehalten (wer macht was bis wann)",
        ],
      },
      {
        id: "englisch.os.business.negotiation",
        name: "Verkaufs- und Verhandlungsgespräche",
        stufen: [11, 13],
        schularten: ["HAK", "HTL"],
        erklaerung: "Im Verkaufsgespräch fragt man nach dem Bedarf, stellt Vorteile vor und reagiert auf Einwände. In Verhandlungen macht man Angebote mit Bedingungen und sucht einen Kompromiss. Beispiel: If you order 500 units, we can offer a 10% discount. Would you be willing to accept delivery in June?",
        fehler: [
          "„will“ in den if-Satz gesetzt (If the price will be lower, we will order more statt If the price is lower, …)",
          "Einwände übergangen, statt darauf einzugehen",
          "Zu direkt abgelehnt (No. This is too expensive. statt I'm afraid that's above our budget.)",
        ],
      },
      {
        id: "englisch.os.business.minutes",
        name: "Protokoll einer Besprechung (Minutes)",
        stufen: [12, 13],
        schularten: ["HTL"],
        erklaerung: "Minutes halten Datum, Anwesende, Tagesordnungspunkte, Beschlüsse und Aufgaben fest: wer macht was bis wann. Man schreibt sachlich, meist in der Vergangenheit oder im Passiv. Beispiel: It was agreed that the test phase would start in May. Action: Lukas to order the sensors by 15 April.",
        fehler: [
          "Den ganzen Gesprächsverlauf nacherzählt, statt die Ergebnisse festzuhalten",
          "Aufgaben ohne verantwortliche Person oder Termin notiert",
          "Zeiten gemischt (The team decides … and it was agreed …)",
        ],
      },
    ],
  },
  {
    area: "Technical English",
    themen: [
      {
        id: "englisch.os.tech.numbers",
        name: "Zahlen, Maße und Einheiten auf Englisch",
        stufen: [9, 11],
        schularten: ["HTL"],
        erklaerung: "Im Englischen trennt ein Punkt die Dezimalstellen und ein Beistrich die Tausender. 2.5 liest man „two point five“, 0.75 „nought point seven five“ oder „zero point seven five“. Einheiten: millimetres, kilograms, degrees Celsius. Beispiel: The cable is 1,500 metres long and 2.5 millimetres thick.",
        fehler: [
          "Beistrich als Dezimalzeichen geschrieben (2,5 mm statt 2.5 mm)",
          "Nach dem Dezimalpunkt die Ziffern als Zahl gelesen (2.25 als „two point twenty-five“ statt „two point two five“)",
          "Mehrzahl der Einheit falsch (5 kilogram statt 5 kilograms; 5 kgs statt 5 kg)",
        ],
      },
      {
        id: "englisch.os.tech.objects",
        name: "Geräte und Werkzeuge beschreiben (Form, Material, Funktion)",
        stufen: [9, 12],
        schularten: ["HTL"],
        erklaerung: "Beschreiben, was ein Gerät ist, woraus es besteht, wie es aussieht und wofür man es verwendet. Muster: It is made of …, It consists of …, It is used for + -ing oder to + Grundform. Beispiel: A multimeter is a device which is used to measure voltage and current. It consists of a display, a dial and two probes.",
        fehler: [
          "Falsche Präposition nach „consist“ (It consists from two parts statt consists of)",
          "Nach „used for“ die Grundform verwendet (It is used for measure the voltage)",
          "Bei einer Maßangabe vor dem Nomen die Mehrzahl verwendet (a 2 metres long cable statt a 2-metre-long cable oder a cable 2 metres long)",
        ],
      },
      {
        id: "englisch.os.tech.instructions",
        name: "Anleitungen und Sicherheitsvorschriften",
        stufen: [9, 11],
        schularten: ["HTL"],
        erklaerung: "Anleitungen verwenden den Imperativ in kurzen Schritten. Vorschriften: must oder have to (Pflicht), mustn't (Verbot), don't have to (nicht nötig). Warnungen mit Make sure … oder Never … Beispiel: Switch off the machine before cleaning it. Always wear safety goggles. You mustn't touch the blade.",
        fehler: [
          "„mustn't“ und „don't have to“ verwechselt (You don't have to touch the blade, gemeint: Verbot)",
          "Statt klarer Imperative vage formuliert (You should maybe switch off the machine)",
          "„Achtung“ wörtlich als „Attention“ übersetzt statt „Caution“ oder „Warning“",
        ],
      },
      {
        id: "englisch.os.tech.process",
        name: "Prozesse und Arbeitsabläufe beschreiben",
        stufen: [10, 13],
        schularten: ["HTL"],
        erklaerung: "Abläufe beschreibt man Schritt für Schritt mit Reihenfolgewörtern (first, then, after that, finally), meist im Passiv, weil der Vorgang wichtiger ist als die Person. Beispiel: First, the metal is heated to 900 °C. Then it is shaped and cooled. Finally, the parts are checked for defects.",
        fehler: [
          "Durchgehend „we“ und „you“ verwendet, wo ein sachliches Passiv passt (Then we heat the metal)",
          "Passiv ohne „be“ gebildet (Finally, the parts checked for defects)",
          "„At first“ für den ersten Schritt verwendet (At first, the metal is heated statt First, …; at first heißt „anfangs“)",
        ],
      },
      {
        id: "englisch.os.tech.abstract",
        name: "Abstract für die Diplomarbeit",
        stufen: [12, 13],
        schularten: ["HTL"],
        erklaerung: "Ein Abstract fasst die Arbeit in einem Absatz zusammen: Ausgangslage und Ziel, Vorgehen, wichtigste Ergebnisse und Schlussfolgerung. Was die Arbeit zeigt, steht im Präsens, was gemacht wurde, im Past Simple. Beispiel: This thesis presents a low-cost sensor system for monitoring air quality. The system was tested in three classrooms.",
        fehler: [
          "Nur die Einleitung übersetzt, ohne Ergebnisse",
          "Zeitformen durcheinander (This thesis presented … The system is tested …)",
          "Deutsche Fachbegriffe wörtlich übersetzt (diploma work statt diploma thesis)",
        ],
      },
    ],
  },
];

/**
 * Order between the skills: [skill, skill that should sit before it]. Own didactic choices, like
 * PREREQUISITES in lib/curriculum.ts.
 */
const VORAUSSETZUNGEN: [string, string][] = [
  ["englisch.os.tenses.past-perfect-progressive", "englisch.tenses.pastperfect"],
  ["englisch.os.tenses.future-progressive", "englisch.tenses.future"],
  ["englisch.os.tenses.future-perfect", "englisch.tenses.future"],
  ["englisch.os.grammar.be-used-to", "englisch.tenses.usedto"],
  ["englisch.os.grammar.non-defining", "englisch.grammar.relative"],
  ["englisch.os.grammar.gerund-infinitive", "englisch.grammar.gerund"],
  ["englisch.os.grammar.indirect-questions", "englisch.grammar.reported-questions"],
  ["englisch.os.grammar.passive-advanced", "englisch.grammar.passive-tenses"],
  ["englisch.os.grammar.wish", "englisch.grammar.if3"],
  ["englisch.os.grammar.mixed-conditionals", "englisch.grammar.if3"],
  ["englisch.os.grammar.modal-deduction", "englisch.grammar.modal-possibility"],
  ["englisch.os.grammar.reporting-verbs", "englisch.grammar.reported"],
  ["englisch.os.grammar.passive-reporting", "englisch.os.grammar.passive-advanced"],
  ["englisch.os.reading.multiple-choice", "englisch.reading.comprehension"],
  ["englisch.os.reading.short-answers", "englisch.reading.comprehension"],
  ["englisch.os.writing.linking-contrast", "englisch.writing.linking"],
  ["englisch.os.writing.informal-email", "englisch.writing.email"],
  ["englisch.os.writing.article", "englisch.writing.article"],
  ["englisch.os.writing.blog-post", "englisch.writing.blog"],
  ["englisch.os.writing.essay", "englisch.writing.opinion"],
  ["englisch.os.writing.essay", "englisch.os.writing.paragraphs"],
  ["englisch.os.writing.essay", "englisch.os.writing.linking-contrast"],
  ["englisch.os.writing.report", "englisch.os.writing.register"],
  ["englisch.os.writing.complaint", "englisch.os.writing.formal-email"],
  ["englisch.os.writing.application", "englisch.os.writing.formal-email"],
  ["englisch.os.speaking.presentation", "englisch.speaking.presentation"],
  ["englisch.os.business.enquiry", "englisch.os.business.layout"],
  ["englisch.os.business.enquiry", "englisch.os.grammar.indirect-questions"],
  ["englisch.os.business.offer", "englisch.os.business.enquiry"],
  ["englisch.os.business.order", "englisch.os.business.offer"],
  ["englisch.os.tech.process", "englisch.os.grammar.passive-advanced"],
];

export const ENGLISCH_OBERSTUFE: Modul = { fach: "Englisch", bereiche: BEREICHE, voraussetzungen: VORAUSSETZUNGEN };
