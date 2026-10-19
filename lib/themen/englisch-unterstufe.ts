import type { Bereich, Modul } from "./bauen";

/**
 * English topics of the Volksschule (1. to 4. Schulstufe, a few skills for tutoring) and the
 * Unterstufe (5. to 8. Schulstufe, Mittelschule and AHS): skills with a short explanation and the
 * typical errors students make. British English, as taught at Austrian schools.
 *
 * Own structure and own wording. The topics follow the Lehrplan (curriculum/ris-vs-englisch.json,
 * ris-ms-englisch.json and ris-ahs-englisch.json, classes 1 to 4; they are organised by skills and
 * CEFR levels, so the grammar is our own choice of what those skills need) and were checked against
 * the tables of contents of common Austrian English books, topic names only: no task, example or text
 * is taken from a book. The links to the Lehrplan are in scripts/lehrplan_mapping.json.
 */
const BEREICHE: Bereich[] = [
  {
    area: "Tenses",
    themen: [
      {
        id: "englisch.tenses.presentprogressive",
        name: "Present Progressive",
        stufen: [5, 6],
        erklaerung: "Für Handlungen, die gerade jetzt passieren: am, is oder are + Verb mit -ing. Signalwörter: now, at the moment, look, listen. Beispiel: „Look! Tom is running to the bus.“ „We aren't watching TV at the moment.“",
        fehler: [
          "am, is oder are vergessen (He running to the bus.)",
          "Die -ing-Form falsch geschrieben (runing, writeing, swiming)",
          "Bei Zustandsverben wie know, like oder want verwendet (I'm knowing his name.)",
        ],
      },
      {
        id: "englisch.tenses.simple-progressive",
        name: "Present Simple oder Present Progressive",
        stufen: [5, 7],
        erklaerung: "Present Simple für Gewohnheiten und Dinge, die immer gelten (every day, usually, often), Present Progressive für das, was gerade passiert oder nur vorübergehend so ist (now, at the moment, today, this week). Beispiel: „Anna usually walks to school, but today she is going by bus.“",
        fehler: [
          "Für allgemeine Tatsachen die Verlaufsform verwendet (Water is boiling at 100 degrees. statt Water boils at 100 degrees.)",
          "Für etwas, das gerade passiert, das Simple verwendet (Listen! The baby cries.)",
          "Zustandsverben in die Verlaufsform gesetzt (I'm knowing the answer.)",
        ],
      },
      {
        id: "englisch.tenses.pastprogressive",
        name: "Past Progressive",
        stufen: [6, 7],
        erklaerung: "Für eine Handlung, die zu einem Zeitpunkt in der Vergangenheit gerade im Gange war: was oder were + Verb mit -ing. Beispiel: „At eight o'clock last night I was doing my homework. My parents were watching a film.“",
        fehler: [
          "was und were verwechselt (They was playing.)",
          "Das -ing vergessen (We were play football.)",
          "Frage oder Verneinung mit did gebildet (Did you watching TV? statt Were you watching TV?)",
        ],
      },
      {
        id: "englisch.tenses.past-simple-progressive",
        name: "Past Simple oder Past Progressive",
        stufen: [6, 8],
        erklaerung: "Die länger dauernde Hintergrundhandlung steht im Past Progressive, die kurze Handlung, die dazwischenkommt, im Past Simple. Nach while steht meist das Progressive, nach when meist das Simple. Beispiel: „I was having a shower when the phone rang.“ „While we were playing football, it started to rain.“",
        fehler: [
          "Auch die kurze Handlung ins Past Progressive gesetzt (I was walking home when I was finding a wallet.)",
          "Hintergrund und kurze Handlung vertauscht (While Tom cooked, he was cutting his finger. statt While Tom was cooking, he cut his finger.)",
          "Bei Handlungen, die nacheinander passieren, die Verlaufsform verwendet (I was getting up, then I was having breakfast and then I was leaving the house.)",
        ],
      },
      {
        id: "englisch.tenses.future",
        name: "going to und will",
        stufen: [6, 8],
        erklaerung: "going to für Pläne und Absichten und wenn man schon sieht, dass etwas passieren wird. will für Vorhersagen, spontane Entschlüsse und Versprechen. Beispiel: „I'm going to visit my aunt next weekend.“ „Look at those clouds! It's going to rain.“ „The phone is ringing. I'll answer it.“",
        fehler: [
          "will wie das deutsche „wollen“ verwendet (I will a new bike.)",
          "Bei going to die Form von be vergessen (I going to play tennis.)",
          "Nach will ein -s oder to gesetzt (She will comes. I will to help you.)",
        ],
      },
      {
        id: "englisch.tenses.future-present",
        name: "Zukunft mit Present Progressive und Present Simple",
        stufen: [7, 9],
        erklaerung: "Fest vereinbarte Termine stehen oft im Present Progressive, Fahrpläne und Stundenpläne im Present Simple. Nach when, before, after und as soon as steht für die Zukunft das Present Simple. Beispiel: „I'm meeting Lea on Saturday.“ „The train leaves at 7:15.“ „I'll call you when I get home.“",
        fehler: [
          "Eine feste Verabredung wie im Deutschen ins Present Simple gesetzt (I meet Lea tomorrow.)",
          "Nach when oder as soon as will verwendet (I'll call you when I will get home.)",
          "Für eine Vorhersage die Verlaufsform verwendet (I think you are passing the test next week. statt you will pass)",
        ],
      },
      {
        id: "englisch.tenses.perfect-past",
        name: "Present Perfect oder Past Simple",
        stufen: [7, 9],
        erklaerung: "Past Simple, wenn die Zeit vorbei und genannt oder klar ist (yesterday, last year, in 2020, ago). Present Perfect, wenn der Zeitpunkt offen ist oder das Ergebnis jetzt zählt (ever, never, already, yet, just, so far). Beispiel: „I have already seen this film. I saw it last week.“",
        fehler: [
          "Present Perfect mit einer Zeitangabe der Vergangenheit verbunden (I have seen him yesterday.)",
          "Bei Fragen nach dem Zeitpunkt das Present Perfect verwendet (When have you arrived?)",
          "since mit dem Past Simple verbunden (I lived here since 2019. statt I have lived here since 2019.)",
        ],
      },
      {
        id: "englisch.tenses.perfectprogressive",
        name: "Present Perfect Progressive",
        stufen: [7, 9],
        erklaerung: "have oder has + been + Verb mit -ing. Für eine Handlung, die in der Vergangenheit begonnen hat und bis jetzt andauert oder gerade aufgehört hat, wenn die Dauer wichtig ist. Oft mit for und since. Beispiel: „I have been waiting for twenty minutes.“ „She's tired because she has been running.“",
        fehler: [
          "been vergessen (I have waiting for an hour.)",
          "Wie im Deutschen das Present verwendet (I am waiting here since ten o'clock.)",
          "for und since verwechselt (since two hours)",
          "Bei Zustandsverben verwendet (I have been knowing her for years.)",
        ],
      },
      {
        id: "englisch.tenses.pastperfect",
        name: "Past Perfect",
        stufen: [8, 9],
        erklaerung: "had + 3. Form. Für etwas, das vor einem anderen Ereignis in der Vergangenheit schon passiert war. Oft mit after, before, when, already und by the time. Beispiel: „When we arrived at the station, the train had already left.“",
        fehler: [
          "Beide Handlungen ins Past Simple gesetzt, obwohl die Reihenfolge zählt (When we arrived, the train already left.)",
          "Past Perfect ohne ein späteres Ereignis in der Vergangenheit verwendet (Last Saturday I had visited my grandma. statt I visited)",
          "Statt der 3. Form die 2. Form verwendet (She had went home.)",
        ],
      },
      {
        id: "englisch.tenses.usedto",
        name: "used to",
        stufen: [8, 9],
        erklaerung: "used to + Grundform für Gewohnheiten und Zustände in der Vergangenheit, die es heute nicht mehr gibt. Frage und Verneinung mit did und use to. Beispiel: „I used to play the piano, but now I play the guitar.“ „Did you use to have long hair?“ „We didn't use to have a car.“",
        fehler: [
          "Nach did trotzdem used geschrieben (Did you used to live here?)",
          "Mit „be used to“ verwechselt (I am used to play football as a child.)",
          "Für Gewohnheiten in der Gegenwart verwendet (I use to get up at seven.)",
        ],
      },
      {
        id: "englisch.tenses.mixed",
        name: "Mixed Tenses: die passende Zeitform wählen",
        stufen: [6, 9],
        erklaerung: "Zuerst klären: Gegenwart, Vergangenheit oder Zukunft? Dann auf Signalwörter achten (every day, now, yesterday, ago, since, already, tomorrow) und prüfen, ob etwas gerade im Gange ist. Beispiel: „Every Sunday we visit Grandma. Last Sunday we visited her. We have visited her three times this month.“",
        fehler: [
          "Im ganzen Text bei einer Zeitform geblieben, obwohl die Signalwörter wechseln (Yesterday I go to the cinema.)",
          "„vor“ und „seit“ falsch übersetzt (before two years statt two years ago, since two years statt for two years)",
          "Nach did oder does die Verbform zusätzlich verändert (Did you went? Does she plays?)",
        ],
      },
    ],
  },
  {
    area: "Grammar",
    themen: [
      {
        id: "englisch.grammar.tobe",
        name: "to be und there is / there are",
        stufen: [5, 6],
        erklaerung: "I am, you are, he/she/it is, we are, they are. Verneint wird mit not, in Fragen steht die Form vorn. There is (eines) und there are (mehrere) sagen, dass es etwas gibt. Beispiel: „Is she your sister? No, she isn't.“ „There are two cats in the garden.“",
        fehler: [
          "Die Form von be vergessen (She my friend.)",
          "Falsche Form gewählt (They is happy. I are ten.)",
          "„es gibt“ wörtlich übersetzt (It gives a cinema in our town. statt There is a cinema …)",
          "there is vor der Mehrzahl verwendet (There is three books on the desk.)",
        ],
      },
      {
        id: "englisch.grammar.havegot",
        name: "have got und has got",
        stufen: [5, 6],
        erklaerung: "have got heißt besitzen oder haben, auch für Familie, Aussehen und Krankheiten. Bei he, she, it heißt es has got. Verneinung: haven't got, hasn't got. Frage: Have you got …? Beispiel: „I've got a brother. He hasn't got a phone.“ „Have you got a pet?“ „Yes, I have.“",
        fehler: [
          "Bei he, she, it have got verwendet (She have got a dog.)",
          "Frage oder Verneinung mit do gebildet (Do you have got a pen? I don't have got …)",
          "have got für Tätigkeiten verwendet (I have got breakfast at seven. statt I have breakfast …)",
        ],
      },
      {
        id: "englisch.grammar.plural",
        name: "Plural der Nomen",
        stufen: [5, 6],
        erklaerung: "Meist hängt man -s an. Nach s, sh, ch, x und oft nach o kommt -es (buses, boxes, tomatoes). Konsonant + y wird zu -ies (baby, babies). Unregelmäßig sind zum Beispiel man, men; child, children; foot, feet; mouse, mice; sheep, sheep. Beispiel: two boxes, three ladies, many teeth.",
        fehler: [
          "y falsch behandelt (babys statt babies, aber auch boies statt boys)",
          "Unregelmäßige Formen regelmäßig gebildet (childs, mans, tooths)",
          "Einen Apostroph vor das Plural-s gesetzt (two apple's)",
        ],
      },
      {
        id: "englisch.grammar.artikel",
        name: "Artikel: a, an und the",
        stufen: [5, 7],
        erklaerung: "a vor einem Konsonantenlaut, an vor einem Vokallaut: Es zählt der Klang, nicht der Buchstabe (a uniform, an hour). the steht für etwas Bestimmtes. Bei Berufen steht a oder an, bei allgemeinen Aussagen kein Artikel. Beispiel: „My mum is a doctor.“ „I like dogs, but the dog next door is loud.“",
        fehler: [
          "Beim Beruf den Artikel weggelassen (She is teacher.)",
          "a oder an nach dem Buchstaben statt nach dem Klang gewählt (a hour, an university)",
          "Bei allgemeinen Aussagen wie im Deutschen the gesetzt (The life is beautiful. The nature is important.)",
        ],
      },
      {
        id: "englisch.grammar.pronomen",
        name: "Personalpronomen und Possessivbegleiter",
        stufen: [5, 6],
        erklaerung: "Subjekt: I, you, he, she, it, we, they. Objekt: me, you, him, her, it, us, them. Vor dem Nomen: my, your, his, her, its, our, their; allein stehend: mine, yours, his, hers, ours, theirs. Beispiel: „This is Lea. I like her. Is this her bag? Yes, it's hers.“",
        fehler: [
          "Nach dem Verb die Subjektform verwendet (I like she.)",
          "his und her nach dem deutschen Geschlecht gewählt (Das Mädchen fährt mit seinem Rad: The girl rides his bike. statt her bike)",
          "its und it's verwechselt (The cat is licking it's paws.)",
          "my statt mine allein verwendet (This pen is my.)",
        ],
      },
      {
        id: "englisch.grammar.genitiv",
        name: "s-Genitiv",
        stufen: [5, 6],
        erklaerung: "Besitz bei Personen und Tieren: Nomen + 's. Bei einer Mehrzahl auf -s nur der Apostroph, bei unregelmäßiger Mehrzahl 's. Bei Dingen meist of. Beispiel: Tom's bike, my parents' car, the children's room, the end of the film.",
        fehler: [
          "Wie im Deutschen mit of statt 's gebildet (the bike of Tom)",
          "Bei der Mehrzahl den Apostroph falsch gesetzt (my parent's car für das Auto der Eltern)",
          "Apostroph vergessen oder beim normalen Plural gesetzt (Toms bike, two cat's)",
        ],
      },
      {
        id: "englisch.grammar.praep-ort",
        name: "Präpositionen des Ortes",
        stufen: [5, 7],
        erklaerung: "in für drinnen (in the box, in Vienna), on für auf oder an einer Fläche (on the table, on the wall), at für einen Ort, an dem man etwas tut (at home, at school, at the bus stop). Dazu under, behind, next to, between, in front of und opposite. Beispiel: „Your bag is under the desk, next to the door.“",
        fehler: [
          "„zu Hause“ und „nach Hause“ falsch übersetzt (I'm in home. I go to home.)",
          "„auf dem Bild“ mit on übersetzt (Who is that on the picture? statt in the picture)",
          "„vor dem Haus“ mit before übersetzt (before the house statt in front of the house)",
        ],
      },
      {
        id: "englisch.grammar.praep-zeit",
        name: "Präpositionen der Zeit (at, on, in)",
        stufen: [5, 7],
        erklaerung: "at bei Uhrzeiten und in at night, at the weekend, at Christmas. on bei Tagen und beim Datum. in bei Monaten, Jahreszeiten, Jahren und Tageszeiten. Beispiel: at 8 o'clock, on Monday, on 3rd May, in July, in 2025, in the evening, at night.",
        fehler: [
          "„am Montag“ mit at oder in übersetzt (at Monday)",
          "„am Morgen“ mit on übersetzt (I get up early on the morning. statt in the morning)",
          "Vor next, last, this oder every eine Präposition gesetzt (on next Monday, in last week)",
        ],
      },
      {
        id: "englisch.grammar.haeufigkeit",
        name: "Adverbien der Häufigkeit",
        stufen: [5, 6],
        erklaerung: "always, usually, often, sometimes und never stehen vor dem Vollverb, aber nach Formen von be (am, is, are, was, were). Beispiel: „I always get up at seven.“ „She is never late.“ „We don't often go to the cinema.“",
        fehler: [
          "Wie im Deutschen hinter das Vollverb gestellt (I get always up at seven.)",
          "Bei am, is, are vor das Verb gestellt (She never is late.)",
          "Mit never zusätzlich verneint (I don't never eat fish.)",
        ],
      },
      {
        id: "englisch.grammar.wortstellung",
        name: "Satzstellung im Aussagesatz",
        stufen: [5, 7],
        erklaerung: "Im englischen Aussagesatz gilt Subjekt, Verb, Objekt, auch nach einer Zeitangabe am Satzanfang und im Nebensatz. Der Ort steht vor der Zeit. Beispiel: „Yesterday we played football in the park.“ „I go to school by bus every day.“ „I'm tired because I went to bed late.“",
        fehler: [
          "Nach einer Zeitangabe das Verb vor das Subjekt gestellt (Yesterday played we football.)",
          "Im Nebensatz das Verb an das Ende gestellt (… because she tired is.)",
          "Zeit vor Ort oder Adverb zwischen Verb und Objekt gestellt (I go every day to school. I like very much pizza.)",
        ],
      },
      {
        id: "englisch.grammar.fragen",
        name: "Fragen mit Fragewörtern",
        stufen: [5, 7],
        erklaerung: "Fragewort + Hilfsverb + Subjekt + Verb. Gibt es kein Hilfsverb, nimmt man do, does oder did. Fragt man nach dem Subjekt (Who …? What …?), fällt do weg. Beispiel: „Where do you live?“ „What did she say?“ „How often do you play tennis?“ „Who called you?“",
        fehler: [
          "Deutsche Wortstellung übernommen (What means this word? statt What does this word mean?)",
          "do oder does vergessen (Where you live?)",
          "Bei Fragen nach dem Subjekt did verwendet (Wer hat dich angerufen? Who did call you? statt Who called you?)",
        ],
      },
      {
        id: "englisch.grammar.modal-basics",
        name: "Modalverben: can, must und should",
        stufen: [5, 6],
        erklaerung: "Modalverben bekommen bei he, she, it kein -s, danach kommt die Grundform ohne to. Verneinung mit not (can't, mustn't, shouldn't), Fragen durch Umstellen ohne do. Beispiel: „She can swim, but she can't dive.“ „You should drink more water.“ „Can you help me?“",
        fehler: [
          "-s angehängt (He cans swim. She musts go.)",
          "to nach dem Modalverb gesetzt (I must to go.)",
          "Frage oder Verneinung mit do gebildet (Do you can swim? I don't can.)",
        ],
      },
      {
        id: "englisch.grammar.someany",
        name: "some und any",
        stufen: [5, 7],
        erklaerung: "some in bejahten Sätzen und bei Angeboten und Bitten, any in verneinten Sätzen und Fragen. Dasselbe gilt für something und anything, somebody und anybody. Beispiel: „There are some apples, but there isn't any milk.“ „Would you like some tea?“ „Is there anybody at home?“",
        fehler: [
          "some in verneinten Sätzen verwendet (I haven't got some money.)",
          "any in bejahten Sätzen im Sinn von „einige“ verwendet (There are any eggs in the fridge.)",
          "Doppelt verneint (I didn't see nobody. statt I didn't see anybody.)",
        ],
      },
      {
        id: "englisch.grammar.modal-must",
        name: "must, mustn't, have to und don't have to",
        stufen: [6, 7],
        erklaerung: "must und have to heißen müssen. Aber mustn't heißt nicht dürfen (Verbot), don't have to heißt nicht müssen. Für die Vergangenheit nimmt man had to. Beispiel: „You mustn't use your phone in class.“ „It's Sunday, so I don't have to get up early.“ „Yesterday I had to walk home.“",
        fehler: [
          "„muss nicht“ mit mustn't übersetzt (You mustn't come. statt You don't have to come.)",
          "Die Vergangenheit von must falsch gebildet (I musted go. statt I had to go.)",
          "Bei he, she, it have to oder don't verwendet (He have to go. She don't have to.)",
        ],
      },
      {
        id: "englisch.grammar.muchmany",
        name: "much, many und a lot of",
        stufen: [6, 8],
        erklaerung: "many und a few stehen bei zählbaren Nomen, much und a little bei nicht zählbaren. a lot of passt zu beiden, vor allem in bejahten Sätzen. Beispiel: „How many friends have you got?“ „We haven't got much time.“ „There's a lot of traffic.“",
        fehler: [
          "much und many verwechselt (many money, much people)",
          "Nicht zählbare Nomen in den Plural gesetzt (informations, advices, furnitures)",
          "Bei a lot of das of vergessen (a lot people)",
        ],
      },
      {
        id: "englisch.grammar.gerund",
        name: "Gerund oder Infinitiv",
        stufen: [6, 9],
        erklaerung: "Nach enjoy, finish, mind, can't stand und nach Präpositionen steht -ing, nach want, would like, decide, hope und plan to + Grundform. Nach like, love und hate geht meist beides. Beispiel: „I enjoy reading.“ „She is good at drawing.“ „I hope to see you soon.“ „I want you to help me.“",
        fehler: [
          "Nach enjoy oder finish den Infinitiv verwendet (I enjoy to swim.)",
          "Nach einer Präposition die Grundform verwendet (I'm good at swim. I look forward to see you.)",
          "Nach want einen that-Satz gebildet (I want that you come. statt I want you to come.)",
          "Nach want oder decide die -ing-Form verwendet (I want going home.)",
        ],
      },
      {
        id: "englisch.grammar.adverbs",
        name: "Adjektiv oder Adverb",
        stufen: [7, 8],
        erklaerung: "Das Adjektiv beschreibt ein Nomen, das Adverb, wie jemand etwas tut. Das Adverb ist meist Adjektiv + -ly; unregelmäßig sind good, well; fast, fast; hard, hard. Nach be und nach look, feel, sound, smell, taste im Sinn von „aussehen, sich anfühlen, klingen, riechen, schmecken“ steht das Adjektiv. Beispiel: „She is a careful driver. She drives carefully.“ „You sing well.“ „The soup tastes good.“",
        fehler: [
          "Adjektiv statt Adverb nach einem Tätigkeitsverb (He speaks English very good.)",
          "hardly als Adverb von hard verwendet (He works hardly. für er arbeitet hart)",
          "Nach look, smell oder taste das Adverb verwendet (You look nicely. The cake smells deliciously.)",
          "Die -ly-Form falsch geschrieben (happyly, carefuly)",
        ],
      },
      {
        id: "englisch.grammar.questiontags",
        name: "Question Tags",
        stufen: [7, 8],
        erklaerung: "Ein Anhängsel wie „oder?“ oder „nicht wahr?“: Nach einem bejahten Satz kommt ein verneinter Tag, nach einem verneinten ein bejahter, mit demselben Hilfsverb und einem Pronomen. Ohne Hilfsverb nimmt man do, does oder did. Beispiel: „You're from Graz, aren't you?“ „She likes tea, doesn't she?“ „They didn't come, did they?“",
        fehler: [
          "Immer isn't it angehängt (You like pizza, isn't it?)",
          "Das Hilfsverb passt nicht zur Zeitform (She went home, doesn't she?)",
          "Im Tag das Nomen statt des Pronomens wiederholt (Tom is nice, isn't Tom?)",
          "Bei I am den Tag falsch gebildet (I'm late, am not I? statt aren't I?)",
        ],
      },
      {
        id: "englisch.grammar.reflexive",
        name: "Reflexivpronomen und each other",
        stufen: [7, 8],
        erklaerung: "myself, yourself, himself, herself, itself, ourselves, yourselves, themselves stehen, wenn Subjekt und Objekt dieselbe Person sind. each other heißt einander. Viele deutsche „sich“-Verben sind im Englischen nicht reflexiv. Beispiel: „Did you hurt yourself?“ „Tom and Lea help each other.“ „We meet at six.“",
        fehler: [
          "Das deutsche „sich“ übernommen (We meet us at six. I feel myself tired.)",
          "themselves und each other verwechselt (They looked at themselves. für sie sahen einander an)",
          "Falsche Formen gebildet (hisself, theirselves)",
        ],
      },
      {
        id: "englisch.grammar.modal-substitutes",
        name: "Ersatzformen: be able to, be allowed to, have to",
        stufen: [7, 8],
        erklaerung: "can, may und must gibt es nicht in jeder Zeitform. Dann nimmt man be able to (können), be allowed to (dürfen) und have to (müssen). Für allgemeines Können in der Vergangenheit geht auch could. Beispiel: „I'll be able to help you tomorrow.“ „We weren't allowed to go out.“ „We will have to wait.“",
        fehler: [
          "Zwei Modalverben hintereinander gesetzt (I will can come. You will must help.)",
          "Nach allowed oder able das to vergessen (I wasn't allowed go.)",
          "Die Form von be vergessen (I able to swim. We allowed to stay.)",
        ],
      },
      {
        id: "englisch.grammar.if1",
        name: "if-Sätze Typ 1 (if-clauses, conditionals)",
        stufen: [7, 8],
        erklaerung: "Für Bedingungen, die gut möglich sind: im if-Satz das Present Simple, im Hauptsatz will + Grundform (oder can, must, Befehlsform). Steht der if-Satz vorn, folgt ein Beistrich. Beispiel: „If it rains tomorrow, we will stay at home.“ „We'll stay at home if it rains.“",
        fehler: [
          "will in den if-Satz gesetzt (If it will rain, we will stay at home.)",
          "„wenn“ bei einer unsicheren Bedingung mit when übersetzt (When it rains tomorrow, we'll stay at home.)",
          "Den if-Satz ins Past gesetzt, obwohl die Bedingung gut möglich ist (If it rained tomorrow, we'll stay at home.)",
        ],
      },
      {
        id: "englisch.grammar.if2",
        name: "if-Sätze Typ 2 (if-clauses, conditionals)",
        stufen: [7, 9],
        erklaerung: "Für Bedingungen, die unwahrscheinlich oder nicht wirklich sind: im if-Satz das Past Simple, im Hauptsatz would + Grundform. Bei be steht auch nach I, he, she, it oft were, in „If I were you …“ immer. Beispiel: „If I had more money, I would buy a new bike.“ „If I were you, I'd ask the teacher.“",
        fehler: [
          "would in den if-Satz gesetzt (If I would have time, I would come.)",
          "Im Hauptsatz will statt would (If I won the lottery, I will travel.)",
          "Nach would die Vergangenheitsform verwendet (I would bought a bike.)",
        ],
      },
      {
        id: "englisch.grammar.passive",
        name: "Passive: Present Simple und Past Simple",
        stufen: [7, 8],
        erklaerung: "Im Passiv zählt, was mit etwas geschieht, nicht wer es tut: am, is, are oder was, were + 3. Form. Wer es tut, steht nach by. Beispiel: „English is spoken in many countries.“ „The bridge was built in 1890.“ „The book was written by a teacher.“",
        fehler: [
          "Die Form von be vergessen (The house built in 1900.)",
          "Statt der 3. Form die 2. Form verwendet (The car was stole.)",
          "„von“ mit from statt by übersetzt (The book was written from a teacher.)",
          "Die Zeitform von be nicht angepasst (Yesterday the window is broken by a ball.)",
        ],
      },
      {
        id: "englisch.grammar.relative",
        name: "Relativsätze mit who, which, that und whose",
        stufen: [7, 9],
        erklaerung: "who für Personen, which für Dinge und Tiere, that für beides, whose für Besitz. Ist das Relativpronomen Objekt, kann man es weglassen (Contact Clause). Beispiel: „The girl who lives next door is my friend.“ „Is this the book (that) you wanted?“ „That's the boy whose dog bit me.“",
        fehler: [
          "which für Personen verwendet (the man which lives here)",
          "whose und who's verwechselt (the girl who's bag I found)",
          "Das Relativpronomen weggelassen, obwohl es Subjekt ist (The girl lives next door is my friend.)",
          "Das Objekt im Relativsatz doppelt gesetzt (the book that I read it)",
        ],
      },
      {
        id: "englisch.grammar.modal-possibility",
        name: "may, might und could: Vermutungen",
        stufen: [8, 9],
        erklaerung: "Mit may, might und could sagt man, dass etwas vielleicht so ist oder geschieht; danach steht die Grundform. Ist man sicher, nimmt man must (muss so sein) oder can't (kann nicht sein). Beispiel: „Take an umbrella. It might rain.“ „He isn't answering. He may be asleep.“ „That can't be Tom. He's in London.“",
        fehler: [
          "Nach might oder may die Verbform verändert (It might rains. She may comes.)",
          "may wie das deutsche „mögen“ verwendet (I may pizza.)",
          "Für „kann nicht sein“ mustn't verwendet (Er kann nicht zu Hause sein: He mustn't be at home. statt He can't be at home.)",
        ],
      },
      {
        id: "englisch.grammar.passive-tenses",
        name: "Passive in anderen Zeiten und mit Modalverben",
        stufen: [8, 9],
        erklaerung: "Die Zeitform steckt in be, die 3. Form bleibt gleich: will be done, has been done, is being done, can be done, must be done. Beispiel: „The results will be published tomorrow.“ „My bike has been stolen.“ „The room must be cleaned today.“",
        fehler: [
          "been oder be vergessen (My bike has stolen. It will done tomorrow.)",
          "Nach dem Modalverb to oder is gesetzt (It must to be done. It can is repaired.)",
          "Im Present Progressive being vergessen (Our classroom is painted at the moment, so we have lessons in the library. statt is being painted)",
        ],
      },
      {
        id: "englisch.grammar.reported",
        name: "Reported Speech: Aussagen",
        stufen: [8, 9],
        erklaerung: "Steht das einleitende Verb in der Vergangenheit, rückt die Zeit meist zurück: Present wird Past, Past und Present Perfect werden Past Perfect, will wird would. Gilt die Aussage noch, kann die Zeit bleiben. Pronomen, Orts- und Zeitangaben passt man an. Beispiel: „I'm tired.“ wird zu: She said she was tired. „I'll call you tomorrow.“ wird zu: He said he would call me the next day.",
        fehler: [
          "say und tell verwechselt (She said me that … statt She told me that …)",
          "Die Zeit nicht zurückgesetzt, obwohl das Gesagte schon vorbei ist (Tom said he will come the next day.)",
          "Pronomen nicht angepasst (Lea sagte „I'm tired.“: Lea said I was tired.)",
        ],
      },
      {
        id: "englisch.grammar.reported-questions",
        name: "Reported Speech: Fragen und Aufforderungen",
        stufen: [8, 9],
        erklaerung: "Berichtete Fragen haben die Wortstellung eines Aussagesatzes, ohne do und ohne Fragezeichen; Ja-Nein-Fragen mit if oder whether. Aufforderungen mit tell oder ask + Person + to + Grundform. Beispiel: „Where do you live?“ wird zu: He asked me where I lived. „Are you ready?“ wird zu: She asked if I was ready. „Sit down!“ wird zu: She told us to sit down.",
        fehler: [
          "Die Fragestellung beibehalten (He asked me where did I live.)",
          "Bei Ja-Nein-Fragen if vergessen (She asked was I ready.)",
          "Eine Aufforderung mit that-Satz gebildet (She told us that we sit down. statt She told us to sit down.)",
          "Verneinte Aufforderung falsch (She told me don't go. statt She told me not to go.)",
        ],
      },
      {
        id: "englisch.grammar.if3",
        name: "if-Sätze Typ 3 (if-clauses, conditionals)",
        stufen: [8, 10],
        erklaerung: "Für Bedingungen in der Vergangenheit, die nicht eingetreten sind: im if-Satz das Past Perfect, im Hauptsatz would have + 3. Form. Beispiel: „If we had left earlier, we wouldn't have missed the bus.“ (Wir sind nicht früher gegangen und haben den Bus verpasst.)",
        fehler: [
          "would have in den if-Satz gesetzt (If I would have known, I would have helped.)",
          "Im Hauptsatz die 2. statt der 3. Form (I would have went.)",
          "have nach would vergessen (If you had asked me, I would helped.)",
        ],
      },
    ],
  },
  {
    area: "Vocabulary",
    themen: [
      {
        id: "englisch.vs.vocab.zahlen-farben",
        name: "Zahlen und Farben",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Die Zahlen von 1 bis 12 lernt man einzeln. Von 13 bis 19 enden sie auf -teen, die Zehner auf -ty. Die Farbe steht vor dem Nomen. Beispiel: fourteen, forty; a red ball, two green apples.",
        fehler: [
          "Zahlen auf -teen und -ty verwechselt (fifteen statt fifty)",
          "forty wie four mit u geschrieben (fourty)",
          "three wie tree ausgesprochen oder geschrieben",
        ],
      },
      {
        id: "englisch.vs.vocab.familie",
        name: "Wortschatz: Familie",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Familienwörter lernt man am besten in Paaren: mother und father, sister und brother, grandma und grandpa, aunt und uncle. Mit „This is my …“ stellt man jemanden vor. Beispiel: „This is my sister. Her name is Mia. This is my grandpa. He's seventy.“",
        fehler: [
          "his und her verwechselt (This is my sister. His name is Mia.)",
          "aunt und uncle oder son und daughter verwechselt",
          "Bei zwei Personen This is statt These are verwendet (This is my parents.)",
        ],
      },
      {
        id: "englisch.vs.vocab.schule",
        name: "Wortschatz: Schule und Klassenzimmer",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Schulsachen lernt man mit dem Gegenstand in der Hand und in kurzen Sätzen. Dazu gehören die Anweisungen im Unterricht. Beispiel: „I've got a pencil, a rubber and a ruler.“ „Open your books, please.“",
        fehler: [
          "Das deutsche Wort genommen und englisch ausgesprochen (Gummi statt rubber)",
          "pen und pencil verwechselt",
          "Vor einem Vokallaut a statt an verwendet (a orange crayon)",
        ],
      },
      {
        id: "englisch.vs.vocab.tiere",
        name: "Wortschatz: Tiere",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Tiere lernt man in Gruppen: pets, farm animals und wild animals. Mit „It's …“, „It has got …“ und „It can …“ beschreibt man ein Tier. Beispiel: „It's big and grey. It has got big ears. It can't jump. It's an elephant.“",
        fehler: [
          "Wie im Deutschen he oder she statt it verwendet (The mouse is small. She is grey.)",
          "Unregelmäßige Mehrzahl falsch gebildet (mouses, sheeps)",
          "Bei it have got statt has got verwendet (It have got four legs.)",
        ],
      },
      {
        id: "englisch.vs.vocab.zeit",
        name: "Wochentage, Monate und Jahreszeiten",
        stufen: [2, 4],
        schularten: ["Volksschule"],
        erklaerung: "Wochentage und Monate schreibt man im Englischen immer groß, Jahreszeiten klein. Vor Tagen steht on, vor Monaten und Jahreszeiten in. Beispiel: „My birthday is in May.“ „We have English on Monday.“ „It's cold in winter.“",
        fehler: [
          "Wochentage und Monate kleingeschrieben (on monday, in july)",
          "on und in verwechselt (in Monday, on May)",
          "Tuesday und Thursday verwechselt",
          "Wednesday nach dem Klang geschrieben (Wensday)",
        ],
      },
      {
        id: "englisch.vocab.uhrzeit-datum",
        name: "Uhrzeit und Datum",
        stufen: [5, 6],
        erklaerung: "Bis zur halben Stunde sagt man past, danach to und die nächste Stunde. Das Datum hat eine Ordnungszahl: first, second, third, dann meist -th. Beispiel: 7:30 ist „half past seven“, 8:45 ist „quarter to nine“. 3rd May liest man „the third of May“.",
        fehler: [
          "„halb acht“ wörtlich übersetzt (half eight für 7:30, das heißt aber 8:30; richtig: half past seven)",
          "Ordnungszahlen falsch gebildet (3th, 2th statt 3rd, 2nd)",
          "past und to verwechselt (quarter past nine für 8:45)",
        ],
      },
      {
        id: "englisch.vocab.false-friends",
        name: "False Friends",
        stufen: [6, 9],
        erklaerung: "False Friends sehen aus wie ein deutsches Wort, bedeuten aber etwas anderes. Man lernt sie am besten als Paare. Beispiel: become heißt werden (bekommen ist get); also heißt auch; ein chef ist ein Koch, der Chef ist der boss; das Handy heißt mobile phone.",
        fehler: [
          "„bekommen“ mit become übersetzt (I became a present. statt I got a present.)",
          "also im Sinn von „daher“ verwendet (It rained, also I stayed at home. statt so I stayed at home)",
          "„sensibel“ mit sensible übersetzt (She is very sensible. statt sensitive)",
          "„Handy“ als englisches Wort verwendet (my handy statt my mobile phone)",
        ],
      },
    ],
  },
  {
    area: "Reading",
    themen: [
      {
        id: "englisch.vs.reading.lesen",
        name: "Wörter und kurze Texte lesen",
        stufen: [2, 4],
        schularten: ["Volksschule"],
        erklaerung: "Englische Wörter spricht man oft anders aus, als man sie schreibt. Bekannte Wörter wiedererkennen, Bilder als Hilfe nehmen und in der Frage auf das Fragewort achten. Beispiel: In „Tom has got a dog. It's brown and very fast.“ steht die Antwort auf „What colour is Tom's dog?“: brown.",
        fehler: [
          "Wörter wie im Deutschen gelesen (name als „na-me“)",
          "Antwort geraten statt im Text gesucht",
          "Fragewörter verwechselt (What colour …? mit dog beantwortet)",
        ],
      },
      {
        id: "englisch.reading.skimming-scanning",
        name: "Lesestrategien: Skimming und Scanning",
        stufen: [5, 9],
        erklaerung: "Zuerst die Aufgaben lesen. Skimming: den Text schnell überfliegen (Überschrift, Bilder, erster Satz jedes Absatzes), um zu wissen, worum es geht. Scanning: gezielt nach einer Information wie Zahl, Name oder Schlüsselwort suchen. Beispiel: Für „When did the museum open?“ nach einer Jahreszahl suchen.",
        fehler: [
          "Den ganzen Text Wort für Wort gelesen und dann keine Zeit mehr für die Aufgaben gehabt",
          "Eine Antwort gewählt, weil dasselbe Wort im Text vorkommt, ohne den Satz zu verstehen",
          "Bei True or False das eigene Wissen statt des Textes verwendet",
        ],
      },
    ],
  },
  {
    area: "Listening",
    themen: [
      {
        id: "englisch.vs.listening.verstehen",
        name: "Einfache Hörtexte verstehen",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Vor dem Hören die Bilder und die Aufgabe anschauen und überlegen, welche Wörter vorkommen könnten. Beim Hören auf bekannte Wörter achten: Man muss nicht jedes Wort verstehen. Beispiel: Bei „Find Tom's pet“ auf Tiernamen und Farben hören.",
        fehler: [
          "Bei einem unbekannten Wort aufgehört zuzuhören",
          "Ähnlich klingende Wörter verwechselt (three und tree, cat und cap)",
          "Das erste passende Wort angekreuzt, obwohl danach etwas anderes gesagt wird (No, not the red one. The blue one.)",
        ],
      },
      {
        id: "englisch.listening.strategies",
        name: "Listening-Strategien",
        stufen: [5, 9],
        erklaerung: "Vor dem Hören die Aufgaben lesen, Schlüsselwörter unterstreichen und überlegen, was man hören wird (Zahl, Ort, Person). Beim ersten Hören das Wichtigste notieren, beim zweiten prüfen. Beispiel: Bei „How much is the ticket?“ auf einen Preis achten, etwa „twelve pounds fifty“.",
        fehler: [
          "Ähnliche Zahlen verwechselt (thirteen und thirty, fifteen und fifty)",
          "Die zuerst genannte Möglichkeit angekreuzt, obwohl sie danach korrigiert wird (not on Monday, on Tuesday)",
          "Bei einem unbekannten Wort den Faden verloren und den Rest nicht mehr gehört",
        ],
      },
    ],
  },
  {
    area: "Writing",
    themen: [
      {
        id: "englisch.vs.writing.woerter",
        name: "Wörter und kurze Sätze schreiben",
        stufen: [2, 4],
        schularten: ["Volksschule"],
        erklaerung: "Englische Wörter schreibt man oft anders, als man sie hört. Darum beim Abschreiben Buchstabe für Buchstabe vergleichen. Nomen schreibt man klein, I immer groß. Beispiel: „I like apples. My friend has got a cat.“",
        fehler: [
          "Nach dem Klang geschrieben (frend statt friend, ai statt I)",
          "Nomen wie im Deutschen großgeschrieben (I like Apples.)",
          "I kleingeschrieben (my sister and i)",
        ],
      },
      {
        id: "englisch.writing.capitals",
        name: "Groß- und Kleinschreibung",
        stufen: [5, 7],
        erklaerung: "Im Englischen schreibt man Nomen klein. Groß schreibt man Satzanfänge, Namen, I, Wochentage, Monate, Feiertage, Länder, Sprachen und Nationalitäten. Beispiel: „On Monday I met an Italian girl. She speaks English and German.“",
        fehler: [
          "Nomen wie im Deutschen großgeschrieben (I have got a Dog.)",
          "Sprachen und Nationalitäten kleingeschrieben (english, austrian)",
          "I kleingeschrieben (my friend and i)",
        ],
      },
      {
        id: "englisch.writing.email",
        name: "E-Mail an Freunde schreiben",
        stufen: [5, 8],
        erklaerung: "Anrede (Hi Sam, oder Dear Sam,), in der nächsten Zeile groß weiter. Kurzer Einstieg, dann jeden Punkt der Angabe in einem eigenen Absatz, eine Frage an den Freund und ein Gruß zum Schluss. Beispiel: „Hi Sam, / Thanks for your email! … / Write back soon! / Best wishes, Anna“",
        fehler: [
          "Nach der Anrede wie im Deutschen kleingeschrieben (Dear Sam, thanks for your email.)",
          "Nicht auf alle Punkte der Angabe eingegangen",
          "Förmliche Wendungen in einer E-Mail an Freunde (Yours sincerely)",
          "Alles in einem Block ohne Absätze geschrieben",
        ],
      },
      {
        id: "englisch.writing.description",
        name: "Personen, Orte und Bilder beschreiben",
        stufen: [5, 8],
        erklaerung: "Geordnet beschreiben: vom Allgemeinen zu den Einzelheiten oder von links nach rechts. Dazu there is und there are, has got, Präpositionen und passende Adjektive; bei Bildern das Present Progressive. Beispiel: „In the picture there are two boys. The tall boy on the left is wearing a red cap and he is laughing.“",
        fehler: [
          "Bei Bildern das Present Simple statt der Verlaufsform verwendet (In the picture a girl reads a book.)",
          "Nur aufgezählt (There is … There is … There is …), ohne Lage und Einzelheiten",
          "Immer dieselben Adjektive verwendet (nice, nice, good)",
        ],
      },
      {
        id: "englisch.writing.linking",
        name: "Sätze verbinden mit Linking Words",
        stufen: [6, 8],
        erklaerung: "Linking Words verbinden Sätze und ordnen den Text: and, but, because, so, when; für die Reihenfolge first, then, after that, finally; für Gegensätze however und although. Beispiel: „First we went to the zoo. After that we had lunch. It was cold, but we had fun.“",
        fehler: [
          "Fast jeden Satz mit „and then“ begonnen",
          "because und so verwechselt (It was raining, because we stayed inside.)",
          "however wie but mitten im Satz ohne Satzzeichen verwendet (It was cold however we went out.)",
          "„danach“ allein mit after übersetzt (After, we went home. statt After that oder Afterwards, we went home.)",
        ],
      },
      {
        id: "englisch.writing.story",
        name: "Eine Geschichte schreiben",
        stufen: [6, 9],
        erklaerung: "Einleitung (wer, wo, wann), Hauptteil mit Spannung und Höhepunkt, Schluss. Erzählt wird im Past Simple, der Hintergrund im Past Progressive. Wörter wie suddenly, after that und in the end und Gefühle machen die Geschichte lebendig. Beispiel: „It was a cold night. Tom was walking home when suddenly he heard a strange noise.“",
        fehler: [
          "Zwischen Present und Past gewechselt (Tom walked home. Suddenly he hears a noise.)",
          "Ohne Höhepunkt aufgehört oder alles mit „and then“ aneinandergereiht",
          "Unregelmäßige Formen regelmäßig gebildet (he runned away, she feeled scared)",
        ],
      },
      {
        id: "englisch.writing.opinion",
        name: "Die eigene Meinung schreiben und begründen",
        stufen: [6, 9],
        erklaerung: "Die Meinung klar sagen (I think …, In my opinion …), mit Gründen und Beispielen stützen (because, for example), vielleicht eine Gegenmeinung nennen (On the other hand …) und am Ende zusammenfassen. Beispiel: „In my opinion, school uniforms are a good idea because students don't have to think about clothes every morning.“",
        fehler: [
          "„meiner Meinung nach“ wörtlich übersetzt (After my opinion …, In my meaning …)",
          "Eine Meinung genannt, aber nicht begründet",
          "„Ich meine, dass …“ für die eigene Meinung mit I mean übersetzt (I mean that homework is useful. statt I think that …)",
        ],
      },
      {
        id: "englisch.writing.blog",
        name: "Blogeintrag und Posting",
        stufen: [7, 9],
        erklaerung: "Ein Blogeintrag hat eine Überschrift, spricht die Leser direkt an und ist persönlich und locker geschrieben. Erlebnisse, Meinungen und Tipps stehen in kurzen Absätzen, am Ende eine Frage an die Leser. Beispiel: „Hi everyone! Last weekend I tried rock climbing for the first time. Have you ever done it? Let me know in the comments!“",
        fehler: [
          "Keine Überschrift und kein Bezug zu den Lesern",
          "Zu förmlich wie ein Brief an ein Amt geschrieben (Dear Sir or Madam)",
          "Nur aufgezählt, was passiert ist, ohne eigene Meinung oder Gefühle",
        ],
      },
      {
        id: "englisch.writing.article",
        name: "Artikel für die Schülerzeitung",
        stufen: [8, 9],
        erklaerung: "Ein Artikel hat eine Überschrift, die neugierig macht, einen Einstieg, der die Leser anspricht, Absätze mit je einem Gedanken und einen Schluss mit Meinung oder Aufforderung. Beispiel: Überschrift „Why our school needs a garden“, Einstieg „Have you ever eaten a tomato you grew yourself?“",
        fehler: [
          "Wie eine E-Mail mit Anrede und Gruß aufgebaut (Hi Tom … Love, Anna)",
          "Überschrift vergessen oder nur ein Wort (School)",
          "Alles in einem Absatz ohne Gliederung geschrieben",
        ],
      },
    ],
  },
  {
    area: "Speaking",
    themen: [
      {
        id: "englisch.vs.speaking.vorstellen",
        name: "Begrüßen und sich vorstellen",
        stufen: [1, 4],
        schularten: ["Volksschule"],
        erklaerung: "Begrüßen mit Hello oder Hi, verabschieden mit Goodbye oder Bye. Sich vorstellen mit Name, Alter und Herkunft. Beispiel: „Hello! My name is Lea. I'm eight years old. I'm from Austria.“ „How are you?“ „I'm fine, thank you.“",
        fehler: [
          "Wörtlich aus dem Deutschen übersetzt (How is your name? statt What's your name?)",
          "Fragen verwechselt und unpassend geantwortet (How old are you? I'm fine.)",
          "Mit Good night begrüßt statt verabschiedet (Good night! How are you?)",
        ],
      },
      {
        id: "englisch.vs.speaking.fragen",
        name: "Einfache Fragen und Antworten",
        stufen: [2, 4],
        schularten: ["Volksschule"],
        erklaerung: "Auf Fragen mit Do you …?, Have you got …?, Can you …? oder Is it …? antwortet man kurz mit demselben Hilfsverb. Fragewörter sind What, Where, Who und How many. Beispiel: „Have you got a pet?“ „Yes, I have.“ „Can you swim?“ „No, I can't.“ „Where is the cat?“ „It's under the table.“",
        fehler: [
          "Kurzantwort mit dem falschen Hilfsverb (Can you swim? Yes, I do.)",
          "Auf eine Frage mit Fragewort nur mit Yes oder No geantwortet (Where is the cat? Yes.)",
          "Die Frage wie im Deutschen gebildet (Like you pizza? statt Do you like pizza?)",
        ],
      },
      {
        id: "englisch.speaking.about-me",
        name: "Über sich selbst sprechen",
        stufen: [5, 6],
        erklaerung: "In ganzen, einfachen Sätzen über Familie, Freunde, Hobbys, Schule und den Tagesablauf erzählen, mit Gründen (because) und Angaben, wie oft (usually, at the weekend). Beispiel: „I've got one sister. In my free time I play basketball because it's fun. At the weekend I usually meet my friends.“",
        fehler: [
          "Nur einzelne Wörter statt ganzer Sätze gesagt (Hobby: football.)",
          "„Sport machen“ wörtlich übersetzt (I make sport. statt I do sport.)",
          "Bei he, she, it das -s vergessen (My sister play the piano.)",
        ],
      },
      {
        id: "englisch.speaking.directions",
        name: "Nach dem Weg fragen und den Weg beschreiben",
        stufen: [5, 7],
        erklaerung: "Fragen: „Excuse me, how do I get to the station?“ oder „Is there a bank near here?“ Beschreiben mit go straight on, turn left, turn right, take the second street on the left, it's on your right, opposite, next to. Beispiel: „Go straight on and take the first left. The museum is on your right, opposite the park.“",
        fehler: [
          "„die nächste Bank“ (die am nächsten liegt) mit next übersetzt (Where is the next bank? statt the nearest bank)",
          "„geradeaus“ falsch übersetzt (go always straight)",
          "Grundzahl statt Ordnungszahl verwendet (Take the two street on the left.)",
        ],
      },
      {
        id: "englisch.speaking.shopping",
        name: "Einkaufen und bestellen",
        stufen: [5, 7],
        erklaerung: "Höflich fragen und antworten: „Can I help you?“, „I'm looking for …“, „How much is it?“ oder „How much are they?“, „Can I try it on?“ Bestellen mit „Can I have …, please?“ oder „I'd like …, please.“ Beispiel: „Can I have a cheese sandwich and an orange juice, please?“ „That's £4.50.“",
        fehler: [
          "Ohne please mit „I want“ bestellt (I want a cola.)",
          "How much is bei der Mehrzahl verwendet (How much is the shoes?)",
          "„Ich bekomme …“ wörtlich übersetzt (I become a coffee.)",
        ],
      },
      {
        id: "englisch.speaking.suggestions",
        name: "Vorschläge machen, zustimmen und ablehnen",
        stufen: [6, 8],
        erklaerung: "Vorschläge: Let's …, Shall we …?, Why don't we …?, How about …ing? Zustimmen: Good idea! I agree. Ablehnen mit Grund und Gegenvorschlag: Sorry, I can't, because … Beispiel: „How about going to the cinema?“ „Sorry, I can't. Why don't we meet on Sunday instead?“",
        fehler: [
          "Nach How about die Grundform oder to verwendet (How about to go swimming?)",
          "Nach Let's die -ing-Form oder to verwendet (Let's going. Let's to meet.)",
          "Nur No gesagt, ohne Grund oder Gegenvorschlag",
        ],
      },
      {
        id: "englisch.speaking.presentation",
        name: "Eine kurze Präsentation halten",
        stufen: [7, 9],
        erklaerung: "Einleitung (Today I'm going to talk about …), Hauptteil in zwei oder drei Punkten (First …, Next …), Schluss (To sum up …, Thank you for listening). Mit Stichwortkarten frei sprechen und die Zuhörer ansehen. Beispiel: „Today I'm going to talk about my favourite book. First, I'll tell you about the story.“",
        fehler: [
          "Den ganzen Text vom Blatt abgelesen",
          "Ohne Einleitung und Schluss einfach begonnen und aufgehört",
          "„erzählen von“ wörtlich übersetzt (I'll tell you from my holiday. statt about my holiday)",
        ],
      },
    ],
  },
];

/** Typical errors of the English skills that were there before (lib/curriculum.ts BASE and SUBSKILLS). */
const FEHLER_BISHER: Record<string, string[]> = {
  "englisch.tenses.presentsimple": [
    "Bei he, she, it das -s vergessen (She play tennis.)",
    "Verneinung ohne do oder does gebildet (I not like fish.)",
    "Für etwas verwendet, das gerade passiert (Look! It rains.)",
  ],
  "englisch.tenses.presentsimple.s": [
    "Das -s vergessen (He live in Graz.)",
    "Die Schreibweise nicht angepasst (gos, watchs, studys statt goes, watches, studies)",
    "Das -s auch bei I, you, we oder they angehängt (They plays.)",
    "has nicht verwendet (He haves a dog.)",
  ],
  "englisch.tenses.presentsimple.fragen": [
    "Frage ohne do oder does gebildet (Like you pizza? Where you live?)",
    "Nach does das -s behalten (Does she plays tennis?)",
    "Bei he, she, it don't statt doesn't verwendet (He don't know.)",
  ],
  "englisch.tenses.pastsimple": [
    "Nach did die Vergangenheitsform verwendet (Did you saw it? I didn't went.)",
    "Die -ed-Form falsch geschrieben (stoped, studyed, plaied)",
    "Frage ohne did gebildet (Where you went yesterday? statt Where did you go yesterday?)",
  ],
  "englisch.tenses.pastsimple.irregular": [
    "Regelmäßig gebildet (catched, thinked, runned)",
    "Die 3. Form statt der 2. Form verwendet (I seen him yesterday.)",
    "Ähnliche Formen verwechselt (thought und taught, felt und fell)",
  ],
  "englisch.tenses.presentperfect": [
    "have oder has vergessen (I seen this film.)",
    "Die 2. statt der 3. Form verwendet (I have went.)",
    "since und for verwechselt (for 2019, since three years)",
  ],
  "englisch.vocab.irregular": [
    "Die regelmäßige Endung angehängt (drived, teached)",
    "Ähnliche Formen verwechselt (brought und bought)",
    "2. und 3. Form vertauscht (I have went, he has took)",
  ],
  "englisch.grammar.comparatives": [
    "more und -er zusammen verwendet (more bigger)",
    "Bei langen Adjektiven -er angehängt (interestinger, beautifuller)",
    "„als“ mit as oder then übersetzt (bigger as me, taller then Tom)",
    "Unregelmäßige Formen regelmäßig gebildet (gooder, badder)",
  ],
  "englisch.reading.comprehension": [
    "Die Antwort aus dem eigenen Wissen statt aus dem Text gegeben",
    "Ganze Sätze abgeschrieben, obwohl eine kurze Antwort verlangt ist (höchstens vier Wörter)",
    "Bei einem unbekannten Wort aufgegeben, statt es aus dem Zusammenhang zu erschließen",
    "Verneinungen und Einschränkungen überlesen (not, only, hardly)",
  ],
  "englisch.translation.sentences": [
    "Wort für Wort übersetzt und die deutsche Satzstellung behalten (Yesterday went I to the cinema.)",
    "False Friends übernommen (Ich bekomme ein Eis: I become an ice cream.)",
    "Das deutsche Perfekt immer mit dem Present Perfect übersetzt (Ich habe ihn gestern gesehen: I have seen him yesterday.)",
  ],
};

/** Explanations of English skills that were there before and have none in EXPLAIN (lib/generators.ts). */
const ERKLAERUNG_BISHER: Record<string, string> = {
  "englisch.translation.sentences": "Erst den Sinn des ganzen Satzes verstehen, dann Subjekt und Verb bestimmen, die passende Zeitform wählen und die englische Satzstellung Subjekt, Verb, Objekt verwenden. Nicht Wort für Wort übersetzen. Beispiel: „Gestern habe ich meine Oma besucht.“ wird zu „Yesterday I visited my grandma.“",
};

/**
 * Order between the English skills: [skill, skill that should sit before it]. Own didactic choices,
 * like PREREQUISITES in lib/curriculum.ts.
 */
const VORAUSSETZUNGEN: [string, string][] = [
  ["englisch.vs.speaking.fragen", "englisch.vs.speaking.vorstellen"],
  ["englisch.tenses.simple-progressive", "englisch.tenses.presentprogressive"],
  ["englisch.tenses.simple-progressive", "englisch.tenses.presentsimple"],
  ["englisch.tenses.pastprogressive", "englisch.tenses.presentprogressive"],
  ["englisch.tenses.past-simple-progressive", "englisch.tenses.pastprogressive"],
  ["englisch.tenses.past-simple-progressive", "englisch.tenses.pastsimple"],
  ["englisch.tenses.future-present", "englisch.tenses.future"],
  ["englisch.tenses.perfect-past", "englisch.tenses.presentperfect"],
  ["englisch.tenses.perfectprogressive", "englisch.tenses.presentperfect"],
  ["englisch.tenses.pastperfect", "englisch.tenses.presentperfect"],
  ["englisch.tenses.usedto", "englisch.tenses.pastsimple"],
  ["englisch.tenses.mixed", "englisch.tenses.simple-progressive"],
  ["englisch.tenses.mixed", "englisch.tenses.pastsimple"],
  ["englisch.grammar.fragen", "englisch.tenses.presentsimple"],
  ["englisch.grammar.questiontags", "englisch.grammar.fragen"],
  ["englisch.grammar.reflexive", "englisch.grammar.pronomen"],
  ["englisch.grammar.muchmany", "englisch.grammar.plural"],
  ["englisch.grammar.modal-must", "englisch.grammar.modal-basics"],
  ["englisch.grammar.modal-substitutes", "englisch.grammar.modal-must"],
  ["englisch.grammar.modal-possibility", "englisch.grammar.modal-basics"],
  ["englisch.grammar.if1", "englisch.tenses.future"],
  ["englisch.grammar.if2", "englisch.grammar.if1"],
  ["englisch.grammar.if3", "englisch.grammar.if2"],
  ["englisch.grammar.if3", "englisch.tenses.pastperfect"],
  ["englisch.grammar.passive", "englisch.vocab.irregular"],
  ["englisch.grammar.passive-tenses", "englisch.grammar.passive"],
  ["englisch.grammar.reported", "englisch.tenses.pastperfect"],
  ["englisch.grammar.reported-questions", "englisch.grammar.reported"],
  ["englisch.grammar.reported-questions", "englisch.grammar.fragen"],
  ["englisch.writing.story", "englisch.tenses.past-simple-progressive"],
];

export const ENGLISCH_UNTERSTUFE: Modul = {
  fach: "Englisch",
  bereiche: BEREICHE,
  fehlerBisher: FEHLER_BISHER,
  erklaerungBisher: ERKLAERUNG_BISHER,
  voraussetzungen: VORAUSSETZUNGEN,
};
