/**
 * The texts of the Textkorrektur-Test (lib/ai/textkorrektur-test.ts): synthetic student texts, written
 * for this test (no real student text), with built-in errors and their accepted corrections, correct
 * places a careless correction would change, and places where either version is acceptable. Every key
 * was checked by a second, independent proofreading without seeing it first.
 * para counts every block from 1, headings included; `wrong` occurs once in its paragraph; `right` are
 * replacements of exactly `wrong`.
 */

export type KorrekturFall = {
  nr: string;
  title: string;
  subject: string;
  schoolType: string;
  klasse: number;
  textKind: string;
  task: string;
  blocks: { text: string; heading: boolean }[];
  errors: { para: number; wrong: string; right: string[]; category: string; what: string; optional?: boolean }[];
  correct: { para: number; text: string; why: string }[];
  neutral?: { para: number; text: string; why: string }[];
};

export const TEXT_CASES: KorrekturFall[] = [
  {
    "nr": "K01",
    "title": "Ein Gewitter am Badesee",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 4,
    "textKind": "Erlebniserzählung",
    "task": "Erzähle von einem besonderen Erlebnis in den Ferien. Finde eine passende Überschrift und gliedere deine Erzählung in Einleitung, Hauptteil und Schluss.",
    "blocks": [
      {
        "text": "Ein Gewitter am Badesee",
        "heading": true
      },
      {
        "text": "Heuer waren wir in den Sommerferien eine Woche bei meine Oma im Waldviertel. Mein kleiner Bruder Lukas und ich wollten unbedingt zum Badesee. An einem heißen Tag furen wir endlich mit den Rädern hin. Oma packte eine grose Jause ein: Semmeln, Paradeiser, Käse und Marillen. Lukas trug das Sackerl mit den Badetüchern.",
        "heading": false
      },
      {
        "text": "Am See sprangen wir sofort ins wasser. Wir schwammen bis zum Steg und wieder zurück. Es war herrlich kühl Plötzlich wurde der Himel ganz dunkel und es fing an zu donnern. Oma rief „Kommt schnell aus dem Wasser!“",
        "heading": false
      },
      {
        "text": "Wir lifen zu einer kleinen Hütte am Ufer weil es schon stark regnete. Dort warten wir mit vielen anderen Leuten. Die Blitze waren hell und der Donner krachte so laut, dass die Fenster klirrten. Lukas hatte große Angst, aber ich hielt seine Hant.",
        "heading": false
      },
      {
        "text": "nach einer halben Stunde schien wieder die Sonne. Wir setzten uns auf eine nasse Bank und aßen unsere Jause. Am Himmel sahen wir einen riesigen Regenbogen. Oma sagte, dass wir sehr tapfer waren. Seit diesem Ausflug hat Lukas keine Angst mehr vor Gewittern. Das war ein aufregender Tag, den ich nie vergessen werde.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "bei meine",
        "right": [
          "bei meiner"
        ],
        "category": "grammatik",
        "what": "Nach „bei“ steht der 3. Fall (Wem-Fall): bei meiner Oma."
      },
      {
        "para": 2,
        "wrong": "furen",
        "right": [
          "fuhren"
        ],
        "category": "rechtschreibung",
        "what": "Dehnungs-h: fahren – wir fuhren."
      },
      {
        "para": 2,
        "wrong": "grose",
        "right": [
          "große"
        ],
        "category": "rechtschreibung",
        "what": "Nach langem Selbstlaut steht ß: groß – große."
      },
      {
        "para": 3,
        "wrong": "ins wasser",
        "right": [
          "ins Wasser"
        ],
        "category": "rechtschreibung",
        "what": "Nomen schreibt man groß: das Wasser."
      },
      {
        "para": 3,
        "wrong": "kühl Plötzlich",
        "right": [
          "kühl. Plötzlich",
          "kühl! Plötzlich",
          "kühl, plötzlich"
        ],
        "category": "zeichensetzung",
        "what": "Am Satzende fehlt das Satzschlusszeichen (Punkt)."
      },
      {
        "para": 3,
        "wrong": "Himel",
        "right": [
          "Himmel"
        ],
        "category": "rechtschreibung",
        "what": "Nach kurzem Selbstlaut folgt ein doppelter Mitlaut: Himmel."
      },
      {
        "para": 3,
        "wrong": "rief „Kommt",
        "right": [
          "rief: „Kommt"
        ],
        "category": "zeichensetzung",
        "what": "Vor der wörtlichen Rede steht nach dem Begleitsatz ein Doppelpunkt."
      },
      {
        "para": 4,
        "wrong": "lifen",
        "right": [
          "liefen"
        ],
        "category": "rechtschreibung",
        "what": "Langes i schreibt man hier ie: laufen – wir liefen."
      },
      {
        "para": 4,
        "wrong": "Ufer weil",
        "right": [
          "Ufer, weil"
        ],
        "category": "zeichensetzung",
        "what": "Vor „weil“ steht ein Beistrich."
      },
      {
        "para": 4,
        "wrong": "warten",
        "right": [
          "warteten"
        ],
        "category": "grammatik",
        "what": "Die Erzählung steht in der Vergangenheit (Präteritum): wir warteten."
      },
      {
        "para": 4,
        "wrong": "Hant",
        "right": [
          "Hand"
        ],
        "category": "rechtschreibung",
        "what": "Verlängern hilft: die Hände – also Hand mit d."
      },
      {
        "para": 5,
        "wrong": "nach einer halben",
        "right": [
          "Nach einer halben"
        ],
        "category": "rechtschreibung",
        "what": "Am Satzanfang schreibt man groß."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Heuer",
        "why": "Österreichisch für „in diesem Jahr“; korrekt."
      },
      {
        "para": 2,
        "text": "Paradeiser",
        "why": "Österreichisches Wort für Tomaten; korrekt."
      },
      {
        "para": 2,
        "text": "Marillen",
        "why": "Österreichisches Wort für Aprikosen; korrekt."
      },
      {
        "para": 2,
        "text": "Sackerl",
        "why": "Österreichisches Wort für Tüte/Beutel; korrekt."
      },
      {
        "para": 3,
        "text": "dunkel und es fing an zu donnern",
        "why": "Der Beistrich vor „und“ zwischen zwei Hauptsätzen ist freigestellt; „anfangen zu donnern“ braucht keinen Beistrich."
      },
      {
        "para": 4,
        "text": "so laut, dass die Fenster",
        "why": "„dass“ als Bindewort mit ss und Beistrich davor; korrekt."
      },
      {
        "para": 5,
        "text": "Seit diesem Ausflug hat Lukas",
        "why": "„seit“ (zeitlich) richtig geschrieben; Gegenwart ist hier richtig, weil es um den Zustand heute geht."
      },
      {
        "para": 5,
        "text": "unsere Jause",
        "why": "Österreichisches Wort für Zwischenmahlzeit; korrekt."
      }
    ],
    "neutral": [
      {
        "para": 5,
        "text": "tapfer waren",
        "why": "Indikativ in VS 4 richtig; Plusquamperfekt oder Konjunktiv auch vertretbar"
      }
    ]
  },
  {
    "nr": "K02",
    "title": "Sporttag der zweiten Klassen",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 2,
    "textKind": "Bericht",
    "task": "Schreibe für die Schülerzeitung einen Bericht über den Sporttag der zweiten Klassen. Beantworte die W-Fragen und bleibe sachlich.",
    "blocks": [
      {
        "text": "Sporttag der zweiten Klassen",
        "heading": true
      },
      {
        "text": "Am Freitag, dem 20. Juni, fand auf dem Sportplatz der Gemeinde der Sporttag der zweiten Klassen statt. Rund 80 Schülerinnen und Schüler der Mittelschule Lindenweg nahmen daran teil. Organisiert wurde die Veranstaltung von den Turnlehrerinnen Frau Berger und Frau Novak. Ziel war es, die Klassengemeinschaft zu stärken. Das Wetter war sonnig und sehr heiss.",
        "heading": false
      },
      {
        "text": "Um 8 Uhr wurden die Klassen in gemischte Gruppen eingeteilt. Nach dem gemeinsamen aufwärmen müssen alle Teilnehmer vier Stationen absolvieren: Weitsprung Sprint, Ballwurf und Staffellauf. Bei jeder Station schrieben Schüler der vierten Klassen die Ergebnisse auf. Die Lehrerinnen achteten darauf, das alle Kinder genug Wasser tranken. Um 10 Uhr gab es eine Pause in der der Elternverein eine gesunde Jause verteilte: Vollkornweckerl, Äpfel und Paradeiser.",
        "heading": false
      },
      {
        "text": "Beim Staffellauf stürzte ein Schüler der 2b, weil er stolperte über eine Bodenwelle. Er verletzte sich am Knie und wurde sofort von der Schulärztin versorgt. Die Verletzung war nicht schwer, sodass er bei den restlichen Bewerben zuschauen konnte. Die Bodenwelle wurde danach mit Hütchen markiert und der Lauf wiederholt.",
        "heading": false
      },
      {
        "text": "Um 12 Uhr wurde das Ergebniss der Gesamtwertung bekannt gegeben. Die 2a gewann voll knapp vor der 2c und der 2b. Die Direktorin überreichte die Siegerklasse einen Pokal. Sie sagte: „Ich bin sehr stolz auf euch alle!“ Viele Eltern, die zugeschaut hatten, lobte die gute Organisation. Im Großen und Ganzen verlief der Sporttag nach Plan. Der nächste Sporttag findet im Mai statt.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "heiss",
        "right": [
          "heiß"
        ],
        "category": "rechtschreibung",
        "what": "Nach dem Zwielaut ei steht bei scharfem s ein ß: heiß."
      },
      {
        "para": 3,
        "wrong": "aufwärmen",
        "right": [
          "Aufwärmen"
        ],
        "category": "rechtschreibung",
        "what": "Nominalisiertes Verb nach „dem“ (Artikel + Adjektiv) schreibt man groß: das Aufwärmen."
      },
      {
        "para": 3,
        "wrong": "müssen",
        "right": [
          "mussten"
        ],
        "category": "grammatik",
        "what": "Der Bericht steht im Präteritum: Die Teilnehmer mussten …"
      },
      {
        "para": 3,
        "wrong": "Weitsprung Sprint",
        "right": [
          "Weitsprung, Sprint"
        ],
        "category": "zeichensetzung",
        "what": "Bei Aufzählungen trennt ein Beistrich die Glieder, die nicht mit „und“ verbunden sind."
      },
      {
        "para": 3,
        "wrong": "das alle",
        "right": [
          "dass alle"
        ],
        "category": "rechtschreibung",
        "what": "Bindewort „dass“ leitet einen Nebensatz ein (nicht ersetzbar durch „dieses/welches“)."
      },
      {
        "para": 3,
        "wrong": "Pause in",
        "right": [
          "Pause, in"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz „in der …“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "stolperte über eine Bodenwelle",
        "right": [
          "über eine Bodenwelle stolperte",
          "über eine Bodenwelle gestolpert war"
        ],
        "category": "satzbau",
        "what": "Im Nebensatz mit „weil“ steht das gebeugte Verb am Ende."
      },
      {
        "para": 5,
        "wrong": "Ergebniss",
        "right": [
          "Ergebnis"
        ],
        "category": "rechtschreibung",
        "what": "Die Nachsilbe -nis schreibt man in der Einzahl mit einfachem s: das Ergebnis (aber: die Ergebnisse)."
      },
      {
        "para": 5,
        "wrong": "voll knapp",
        "right": [
          "knapp",
          "sehr knapp",
          "ganz knapp",
          "äußerst knapp"
        ],
        "category": "ausdruck",
        "what": "Umgangssprache („voll“) passt nicht in einen sachlichen Bericht."
      },
      {
        "para": 5,
        "wrong": "die Siegerklasse",
        "right": [
          "der Siegerklasse"
        ],
        "category": "grammatik",
        "what": "„überreichen“ verlangt für die Person/Gruppe den 3. Fall (Dativ): Wem? – der Siegerklasse."
      },
      {
        "para": 5,
        "wrong": "Sie sagte: „Ich bin sehr stolz auf euch alle!“",
        "right": [
          "Sie sagte, dass sie auf alle Teilnehmer sehr stolz sei.",
          "Sie sagte, sie sei auf alle Teilnehmer sehr stolz.",
          "Sie sagte, dass sie auf alle sehr stolz sei.",
          "Sie sagte, sie sei sehr stolz auf alle.",
          "Sie sagte, dass sie sehr stolz auf alle sei.",
          "Sie sagte, sie sei auf alle sehr stolz.",
          "Sie sagte, dass sie sehr stolz auf alle Teilnehmer sei.",
          "Sie sagte, sie sei sehr stolz auf alle Teilnehmer."
        ],
        "category": "ausdruck",
        "what": "Im Bericht verwendet man keine wörtliche Rede, sondern die indirekte Rede.",
        "optional": true
      },
      {
        "para": 5,
        "wrong": "lobte",
        "right": [
          "lobten"
        ],
        "category": "grammatik",
        "what": "Subjekt und Verb müssen übereinstimmen: Viele Eltern (Mehrzahl) lobten."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Organisiert wurde die Veranstaltung",
        "why": "Ungewöhnliche, aber korrekte Wortstellung (Partizip an erster Stelle)."
      },
      {
        "para": 3,
        "text": "der der Elternverein",
        "why": "Doppeltes „der“ ist korrekt: Relativpronomen und Artikel."
      },
      {
        "para": 3,
        "text": "Vollkornweckerl",
        "why": "„Weckerl“ ist österreichisch für Brötchen; korrekt."
      },
      {
        "para": 4,
        "text": "Bewerben",
        "why": "„Bewerb“ ist österreichisch für Wettbewerb; korrekt."
      },
      {
        "para": 4,
        "text": "sodass",
        "why": "„sodass“ und „so dass“ sind beide richtig."
      },
      {
        "para": 5,
        "text": "bekannt gegeben",
        "why": "„bekannt geben“ getrennt ist korrekt (Zusammenschreibung ebenfalls zulässig)."
      },
      {
        "para": 5,
        "text": "Im Großen und Ganzen",
        "why": "Feste Wendung; „Großen“ und „Ganzen“ werden großgeschrieben."
      },
      {
        "para": 5,
        "text": "findet im Mai statt",
        "why": "Präsens mit Zukunftsbedeutung ist hier richtig, kein Zeitfehler."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "Bei jeder Station",
        "why": "vertretbar; „An jeder Station“ üblicher"
      }
    ]
  },
  {
    "nr": "K03",
    "title": "Beschwerde über einen defekten Rucksack",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 4,
    "textKind": "Beschwerdebrief",
    "task": "Du hast in einem Onlineshop einen Rucksack bestellt, der schon nach wenigen Tagen beschädigt war. Schreibe einen Beschwerdebrief an den Onlineshop. Achte auf die äußere Form (Ort/Datum, Betreff, Anrede, Grußformel) und auf eine sachliche, höfliche Sprache.",
    "blocks": [
      {
        "text": "Linz, 21. Jänner 2026",
        "heading": false
      },
      {
        "text": "Beschwerde über einen defekten Rucksack (Bestellnummer 48213)",
        "heading": true
      },
      {
        "text": "Sehr geehrte Damen und Herren,",
        "heading": false
      },
      {
        "text": "am 3. Jänner habe ich in ihrem Onlineshop einen Sportrucksack um 59,90 Euro bestellt. Ich brauchte ihn für unsere Wintersportwoche die heuer vom 11. bis 16. Jänner in Saalbach stattfand. Ich hab mich gezielt für dieses Modell entschieden um darin meine Schibrille, meine Handschuhe und meine Jause zu transportieren. Der Rucksack wurde zwei Tage später geliefert und sah zunächst sehr gut aus.",
        "heading": false
      },
      {
        "text": "Nachdem ich am ersten Tag meine Sachen in den Rucksack gepackt habe, fuhr ich mit die anderen aus meiner Klasse zum Lift. Schon nach der ersten Abfahrt riss der Reißverschluss. Am zweiten Tag war auch die Nähte und ein Träger gerissen. Ich habe versucht den Reißverschluss selbst zu reparieren, aber das war nicht möglich. Für den Rest der Woche musste ich meine Sachen in einem Sackerl tragen. Das war echt ärgerlich.",
        "heading": false
      },
      {
        "text": "Bisher habe ich mit Ihrem Geschäft nur gute Erfahrungen gemacht. Auf Ihrer Homepage steht, das Sie für alle Produkte zwei Jahre Garantie geben. Deshalb ich erwarte, dass sie mir einen neuen Rucksack schicken oder den Kaufpreis zurückerstatten. Eine Kopie der Rechnung und zwei Fotos des Schadens lege ich diesem Schreiben bei. Meine Begleitlehrerin kann den Schaden ebenfalls bestätigen.",
        "heading": false
      },
      {
        "text": "Den beschädigten Rucksack kann ich Ihnen gerne zurück schicken. Wenn ich gewusst habe, wie schlecht die Qualität ist, hätte ich ihn nicht bei ihnen bestellt. Ich ersuche Sie, mir innerhalb von zwei Wochen zu antworten.",
        "heading": false
      },
      {
        "text": "Mit freundlichen Grüßen",
        "heading": false
      },
      {
        "text": "Lena Hofer",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 4,
        "wrong": "ihrem",
        "right": [
          "Ihrem"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: Das besitzanzeigende Fürwort für die angeschriebene Person schreibt man groß (Ihr, Ihrem)."
      },
      {
        "para": 4,
        "wrong": "Wintersportwoche die",
        "right": [
          "Wintersportwoche, die"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz „die … stattfand“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "Ich hab mich",
        "right": [
          "Ich habe mich"
        ],
        "category": "ausdruck",
        "what": "Verkürzte, umgangssprachliche Form „hab“ passt nicht in einen formellen Brief."
      },
      {
        "para": 4,
        "wrong": "entschieden um",
        "right": [
          "entschieden, um"
        ],
        "category": "zeichensetzung",
        "what": "Eine Infinitivgruppe mit „um … zu“ wird immer mit Beistrich abgetrennt."
      },
      {
        "para": 5,
        "wrong": "gepackt habe",
        "right": [
          "gepackt hatte"
        ],
        "category": "grammatik",
        "what": "Nach „nachdem“ steht bei Präteritum im Hauptsatz das Plusquamperfekt (Vorzeitigkeit)."
      },
      {
        "para": 5,
        "wrong": "mit die anderen",
        "right": [
          "mit den anderen"
        ],
        "category": "grammatik",
        "what": "Nach „mit“ steht der Dativ: mit den anderen."
      },
      {
        "para": 5,
        "wrong": "war auch",
        "right": [
          "waren auch"
        ],
        "category": "grammatik",
        "what": "Subjekt und Verb müssen übereinstimmen: „die Nähte und ein Träger“ ist Mehrzahl – waren."
      },
      {
        "para": 5,
        "wrong": "echt ärgerlich",
        "right": [
          "sehr ärgerlich",
          "äußerst ärgerlich",
          "ärgerlich",
          "wirklich ärgerlich"
        ],
        "category": "ausdruck",
        "what": "„echt“ als Verstärkung ist umgangssprachlich und passt nicht in einen formellen Brief."
      },
      {
        "para": 6,
        "wrong": "das Sie",
        "right": [
          "dass Sie"
        ],
        "category": "rechtschreibung",
        "what": "Bindewort „dass“ leitet einen Nebensatz ein (nicht durch „dieses/welches“ ersetzbar)."
      },
      {
        "para": 6,
        "wrong": "Deshalb ich erwarte",
        "right": [
          "Deshalb erwarte ich",
          "Ich erwarte deshalb",
          "Daher erwarte ich"
        ],
        "category": "satzbau",
        "what": "Im Hauptsatz steht das gebeugte Verb an zweiter Stelle: Deshalb erwarte ich …"
      },
      {
        "para": 6,
        "wrong": "sie mir",
        "right": [
          "Sie mir"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: Die Anrede „Sie“ schreibt man groß."
      },
      {
        "para": 7,
        "wrong": "zurück schicken",
        "right": [
          "zurückschicken"
        ],
        "category": "rechtschreibung",
        "what": "Verbindungen mit der Verbpartikel „zurück“ schreibt man im Infinitiv zusammen: zurückschicken."
      },
      {
        "para": 7,
        "wrong": "Wenn ich gewusst habe",
        "right": [
          "Wenn ich gewusst hätte",
          "Hätte ich gewusst"
        ],
        "category": "grammatik",
        "what": "Unwirkliche Bedingung in der Vergangenheit: Konjunktiv II (gewusst hätte), nicht Indikativ."
      },
      {
        "para": 7,
        "wrong": "bei ihnen",
        "right": [
          "bei Ihnen"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: „Ihnen“ für die angeschriebene Person schreibt man groß."
      }
    ],
    "correct": [
      {
        "para": 1,
        "text": "Jänner",
        "why": "Österreichische Monatsbezeichnung; korrekt."
      },
      {
        "para": 4,
        "text": "am 3. Jänner",
        "why": "Nach der Anrede mit Beistrich beginnt der Brieftext klein."
      },
      {
        "para": 4,
        "text": "um 59,90 Euro",
        "why": "Österreichisch „um“ für einen Preis (= für); korrekt."
      },
      {
        "para": 4,
        "text": "Schibrille",
        "why": "Schreibung „Schi“ ist in Österreich zulässig (neben „Ski“)."
      },
      {
        "para": 5,
        "text": "Sackerl",
        "why": "Österreichisches Wort für Tüte/Beutel; korrekt."
      },
      {
        "para": 5,
        "text": "versucht den Reißverschluss",
        "why": "Beistrich bei dieser Infinitivgruppe ist freigestellt (kein Pflichtfall)."
      },
      {
        "para": 7,
        "text": "Ich ersuche Sie",
        "why": "„ersuchen“ ist in Österreich übliche, korrekte Formulierung im formellen Brief; „Sie“ groß."
      },
      {
        "para": 8,
        "text": "Mit freundlichen Grüßen",
        "why": "Nach der Grußformel steht kein Beistrich."
      }
    ],
    "neutral": [
      {
        "para": 7,
        "text": "wie schlecht die Qualität ist",
        "why": "Präsens vertretbar, Qualität ist weiter schlecht"
      }
    ]
  },
  {
    "nr": "K08",
    "title": "E-Mail über den Schulausflug nach Salzburg",
    "subject": "Englisch",
    "schoolType": "Gymnasium",
    "klasse": 2,
    "textKind": "E-Mail",
    "task": "Schreib eine E-Mail an deinen englischen Brieffreund über euren letzten Schulausflug (120–150 Wörter). Erzähle, wohin ihr gefahren seid, was ihr gemacht habt und was dir am besten gefallen hat.",
    "blocks": [
      {
        "text": "Hi Oliver,",
        "heading": false
      },
      {
        "text": "Thanks for your email! We have been pen friends since two years now. Last week my class goed on a school trip to Salzburg. Our teacher, Mrs Berger, always say that trips are the best way to learn.",
        "heading": false
      },
      {
        "text": "It was raining cats and dogs, but there were fewer tourists than in summer. We visited in the afternoon the cathedral. He is very old and really beautiful inside. We had lunch in small restaurant with a lot of childs from other schools. Before we went home, we all became an ice cream from Mrs Berger!",
        "heading": false
      },
      {
        "text": "But the best part was our free time in the old town. Lena and i bought beautifull T-shirts in our favourite colours. Sadly, I didn't have my handy with me, so I couldn't take many photos. Have you ever been to Austria? Write back soon!",
        "heading": false
      },
      {
        "text": "Best wishes, Sophie",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "since two years",
        "right": [
          "for two years"
        ],
        "category": "grammatik",
        "what": "Für eine Zeitdauer (zwei Jahre) verwendet man „for“; „since“ steht nur vor einem Zeitpunkt (since 2024). „seit zwei Jahren“ = „for two years“."
      },
      {
        "para": 2,
        "wrong": "goed",
        "right": [
          "went"
        ],
        "category": "grammatik",
        "what": "„go“ ist ein unregelmäßiges Verb (go – went – gone). Die Simple-Past-Form lautet „went“, nicht „goed“."
      },
      {
        "para": 2,
        "wrong": "always say",
        "right": [
          "always says"
        ],
        "category": "grammatik",
        "what": "3. Person Singular im Simple Present: Nach he/she/it (hier: Mrs Berger) bekommt das Verb ein -s – she says."
      },
      {
        "para": 3,
        "wrong": "We visited in the afternoon the cathedral",
        "right": [
          "We visited the cathedral in the afternoon",
          "In the afternoon we visited the cathedral",
          "In the afternoon, we visited the cathedral"
        ],
        "category": "satzbau",
        "what": "Eine Zeitangabe steht im Englischen nicht zwischen Verb und Objekt. Satzstellung: Subjekt – Verb – Objekt – Zeit, oder die Zeitangabe an den Satzanfang."
      },
      {
        "para": 3,
        "wrong": "He is",
        "right": [
          "It is",
          "It's"
        ],
        "category": "grammatik",
        "what": "Für Dinge und Gebäude (the cathedral) verwendet man im Englischen „it“, auch wenn das deutsche Wort männlich ist (der Dom)."
      },
      {
        "para": 3,
        "wrong": "in small restaurant",
        "right": [
          "in a small restaurant",
          "at a small restaurant"
        ],
        "category": "grammatik",
        "what": "Vor einem zählbaren Nomen im Singular braucht man einen Artikel: in a small restaurant."
      },
      {
        "para": 3,
        "wrong": "childs",
        "right": [
          "children"
        ],
        "category": "grammatik",
        "what": "„child“ hat einen unregelmäßigen Plural: one child – two children."
      },
      {
        "para": 3,
        "wrong": "became",
        "right": [
          "got",
          "received"
        ],
        "category": "ausdruck",
        "what": "Falscher Freund: „become“ heißt „werden“. „bekommen“ heißt auf Englisch „get“ (Vergangenheit: got) oder „receive“."
      },
      {
        "para": 4,
        "wrong": "Lena and i",
        "right": [
          "Lena and I"
        ],
        "category": "rechtschreibung",
        "what": "Das Personalpronomen „I“ (ich) wird im Englischen immer großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "beautifull",
        "right": [
          "beautiful"
        ],
        "category": "rechtschreibung",
        "what": "Die Nachsilbe -ful schreibt man mit nur einem l: beautiful (aber: full)."
      },
      {
        "para": 4,
        "wrong": "handy",
        "right": [
          "mobile phone",
          "mobile",
          "phone",
          "smartphone"
        ],
        "category": "ausdruck",
        "what": "Falscher Freund: Das Handy heißt auf Englisch „mobile phone“ (amerikanisch: „cell phone“). Das Adjektiv „handy“ bedeutet „praktisch, nützlich“."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Mrs Berger",
        "why": "Im britischen Englisch steht nach „Mrs“ kein Punkt (amerikanisch: „Mrs.“). Beides ist korrekt; der Text bleibt einheitlich britisch."
      },
      {
        "para": 3,
        "text": "raining cats and dogs",
        "why": "Korrekte feste Redewendung: „It was raining cats and dogs“ = Es hat in Strömen geregnet."
      },
      {
        "para": 3,
        "text": "fewer tourists",
        "why": "„fewer“ steht korrekt vor einem zählbaren Nomen im Plural (tourists); „less“ wäre hier falsch."
      },
      {
        "para": 4,
        "text": "But the best part",
        "why": "In einer persönlichen E-Mail darf ein Satz mit „But“ beginnen; das ist kein Fehler."
      },
      {
        "para": 4,
        "text": "favourite colours",
        "why": "Britische Schreibweise (favourite, colours), im ganzen Text einheitlich verwendet – nicht auf amerikanisch „favorite colors“ ändern."
      },
      {
        "para": 4,
        "text": "couldn't take many photos",
        "why": "Kurzformen wie „couldn't“ und „didn't“ sind in einer E-Mail an einen Freund passend; „many“ steht korrekt vor dem zählbaren Nomen „photos“."
      },
      {
        "para": 4,
        "text": "Have you ever been to Austria?",
        "why": "Present Perfect mit „ever“ für Erfahrungen ohne bestimmten Zeitpunkt ist korrekt."
      }
    ],
    "neutral": []
  },
  {
    "nr": "K09",
    "title": "Meinungsaufsatz: Tablets statt Schulbücher?",
    "subject": "Englisch",
    "schoolType": "Gymnasium",
    "klasse": 7,
    "textKind": "Opinion essay",
    "task": "Schreibe einen Meinungsaufsatz (opinion essay, ca. 350 Wörter) zur Frage „Should schools replace textbooks with tablets?“. Gliedere deinen Text in fünf Absätze: Einleitung, Argumente dafür, Argumente dagegen, deine eigene Meinung und Schluss. Achte auf einen formellen Stil.",
    "blocks": [
      {
        "text": "Should Schools Replace Textbooks with Tablets?",
        "heading": true
      },
      {
        "text": "Whether schools should replace textbooks with tablets is a very actual question in Austria. Last year, our school has introduced tablets in several classes, and my class works with them since September. In this essay, I will discuss the most important arguments for and against this development.",
        "heading": false
      },
      {
        "text": "There are several arguments in favour of tablets. First of all, the weight of all the books that a student has to carry to school every day are a real problem for many young people. A tablet is much lighter, and it can store the books for all subjects. Secondly, students can find informations online much faster, and they can make their homework directly on the device. Several studies have shown that interactive exercises help students to really understand difficult topics. Finally, schools would use less paper, which is good for the enviroment.",
        "heading": false
      },
      {
        "text": "However the disadvantages should not be ignored. Tablets are expensive, a good one costs around 400 euros. Many families cannot afford this, especially if they have three or four children. In addition, some students check often their messages or play games during lessons instead of listening to the teacher. Furthermore, teachers which are not used to technology lose valuable time when the Wi-Fi does not work. My maths teacher, whom I asked about this topic, also thinks that reading long texts on a screen is tiring for the eyes.",
        "heading": false
      },
      {
        "text": "In my opinion, printed books are not gonna disappear completely. I personally prefer reading longer texts on paper because it is much easier to concentrate on a printed page than on a screen full of notifications. Nevertheless, I can also see the benefits of digital materials. If our school would have asked the students before buying the tablets, most of them would have chosen a mix of both.",
        "heading": false
      },
      {
        "text": "To sum up, tablets have clear advantages, but they cannot replace books entirely. I would suggest to combine both: tablets could be used for research and exercises, while textbooks remain the basis for reading longer texts. In this way, students would get the best of both worlds.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "actual",
        "right": [
          "topical",
          "relevant",
          "current"
        ],
        "category": "ausdruck",
        "what": "Falscher Freund: „actual“ bedeutet „tatsächlich, wirklich“. „aktuell“ heißt auf Englisch „topical“, „current“ oder „relevant“."
      },
      {
        "para": 2,
        "wrong": "has introduced",
        "right": [
          "introduced"
        ],
        "category": "grammatik",
        "what": "Mit einer abgeschlossenen Zeitangabe in der Vergangenheit (last year) steht das Simple Past, nicht das Present Perfect."
      },
      {
        "para": 2,
        "wrong": "works",
        "right": [
          "has been working",
          "has worked"
        ],
        "category": "grammatik",
        "what": "Für etwas, das seit einem Zeitpunkt bis jetzt andauert (since September), steht das Present Perfect (Continuous), nicht das Simple Present."
      },
      {
        "para": 3,
        "wrong": "are a real problem",
        "right": [
          "is a real problem"
        ],
        "category": "grammatik",
        "what": "Subjekt-Verb-Kongruenz: Das Subjekt ist „the weight“ (Singular), nicht „the books“ – daher „is“."
      },
      {
        "para": 3,
        "wrong": "informations",
        "right": [
          "information"
        ],
        "category": "grammatik",
        "what": "„information“ ist im Englischen unzählbar und hat keine Pluralform (kein -s)."
      },
      {
        "para": 3,
        "wrong": "make their homework",
        "right": [
          "do their homework"
        ],
        "category": "ausdruck",
        "what": "Feste Verbindung: „Hausübung/Hausaufgaben machen“ heißt „do homework“, nicht „make homework“."
      },
      {
        "para": 3,
        "wrong": "enviroment",
        "right": [
          "environment"
        ],
        "category": "rechtschreibung",
        "what": "Rechtschreibung: environment – mit n vor der Endung -ment."
      },
      {
        "para": 4,
        "wrong": "However the",
        "right": [
          "However, the"
        ],
        "category": "zeichensetzung",
        "what": "Nach „However“ am Satzanfang (im Sinn von „jedoch“) steht ein Beistrich."
      },
      {
        "para": 4,
        "wrong": ", a good one",
        "right": [
          ". A good one",
          "; a good one",
          ": a good one",
          ", and a good one",
          " – a good one"
        ],
        "category": "zeichensetzung",
        "what": "Comma Splice: Zwei vollständige Hauptsätze dürfen im Englischen nicht nur mit einem Beistrich verbunden werden. Punkt, Strichpunkt oder Doppelpunkt verwenden."
      },
      {
        "para": 4,
        "wrong": "check often their messages",
        "right": [
          "often check their messages",
          "check their messages often"
        ],
        "category": "satzbau",
        "what": "Häufigkeitsadverbien wie „often“ stehen vor dem Vollverb (often check) und nie zwischen Verb und Objekt."
      },
      {
        "para": 4,
        "wrong": "teachers which",
        "right": [
          "teachers who",
          "teachers that"
        ],
        "category": "grammatik",
        "what": "Für Personen verwendet man das Relativpronomen „who“ (oder „that“); „which“ steht nur für Dinge und Tiere."
      },
      {
        "para": 5,
        "wrong": "gonna",
        "right": [
          "going to"
        ],
        "category": "ausdruck",
        "what": "Register: „gonna“ ist gesprochene Umgangssprache und gehört nicht in einen Aufsatz; richtig ist „going to“."
      },
      {
        "para": 5,
        "wrong": "would have asked",
        "right": [
          "had asked"
        ],
        "category": "grammatik",
        "what": "Conditional III: Im if-Satz steht das Past Perfect (had asked); „would have“ steht nur im Hauptsatz."
      },
      {
        "para": 6,
        "wrong": "suggest to combine",
        "right": [
          "suggest combining",
          "suggest that schools combine",
          "suggest that we combine"
        ],
        "category": "grammatik",
        "what": "Nach „suggest“ folgt kein Infinitiv mit „to“, sondern ein Gerund (-ing-Form) oder ein that-Satz."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "in favour of",
        "why": "Britische Schreibweise „favour“, im ganzen Text einheitlich britisch (auch „maths“) – nicht auf „favor“ ändern."
      },
      {
        "para": 3,
        "text": "Several studies have shown",
        "why": "Present Perfect ist korrekt, weil kein abgeschlossener Zeitpunkt genannt wird und das Ergebnis für die Gegenwart wichtig ist."
      },
      {
        "para": 3,
        "text": "to really understand",
        "why": "Ein „split infinitive“ (Adverb zwischen „to“ und Verb) ist im modernen Englisch korrekt und klingt hier natürlich."
      },
      {
        "para": 3,
        "text": "less paper",
        "why": "„paper“ (Papier als Material) ist unzählbar, daher korrekt „less“, nicht „fewer“."
      },
      {
        "para": 4,
        "text": "My maths teacher",
        "why": "„maths“ ist die korrekte britische Form (amerikanisch: „math“) und passt zur einheitlich britischen Schreibweise."
      },
      {
        "para": 4,
        "text": "whom I asked",
        "why": "„whom“ ist korrekt, weil das Relativpronomen hier Objekt ist (I asked him/her)."
      },
      {
        "para": 6,
        "text": "the best of both worlds",
        "why": "Korrekte feste Redewendung: die Vorteile von beidem nutzen."
      }
    ],
    "neutral": []
  }
];
