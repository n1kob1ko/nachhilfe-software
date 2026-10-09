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
    "nr": "K04",
    "title": "Computerspiele im Unterricht",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 4,
    "textKind": "Erörterung",
    "task": "Verfasse eine Erörterung zum Thema „Zocken und Lernen – sollen Computerspiele im Unterricht erlaubt sein?“. Gliedere deinen Text in Einleitung, Hauptteil mit Pro- und Kontra-Argumenten und Schluss mit deiner eigenen Meinung. Schreibe 330 bis 380 Wörter.",
    "blocks": [
      {
        "text": "Zocken und Lernen – sollen Computerspiele im Unterricht erlaubt sein?",
        "heading": true
      },
      {
        "text": "Viele Jugendliche sitzen jeden Tag stundenlang vor ihrem Bildschirmen und spielen Computerspiele. Bei Erwachsenen haben solche Spiele im Allgemeinen keinen guten Ruf. In meiner Klasse gibt es trotzdem kaum jemanden, der nicht regelmäßig spielt. Heuer arbeiten wir zum ersten Mal in einigen Fächern mit Tablets und deshalb hat uns unsere Deutschlehrerin gefragt, ob man Spiele nicht auch im Unterricht einsetzen könnte. Im folgenden Text wird über dem Thema „Zocken und Lernen“ erörtert.",
        "heading": false
      },
      {
        "text": "Für Computerspiele im Unterricht spricht vor allem, dass Schülerinnen und Schüler dadurch motivierter sind. Viele lernen lieber, wenn sie dabei spaß haben. Spiele sind spannend und man bleibt länger konzentriert. Manche Lernspiele, trainieren außerdem das logische Denken. Ein weiterer Vorteil ist, dass man keine Angst haben muss, wenn man im Spiel ein Fehler macht. Man probiert es einfach noch einmal, bis es klappt. In Englisch verwenden wir zum Beispiel seit Jänner eine Vokabel-App, die wie ein Spiel aufgebaut ist. Solche Programme helfen den Schüler, sich neue Wörter leichter zu merken. Wer so übt, bekommt bei den Schularbeiten vielleicht sogar besser Noten.",
        "heading": false
      },
      {
        "text": "Es gibt aber auch wichtige Gegenargumente. Viele Eltern meinen, dass Spiele eine Zeitverschwendung ist. Sie befürchten, dass wenn Kinder schon im Unterricht spielen dürfen, sie zu Hause gar nicht mehr aufhören wollen. Wenn sich auch in der Schule Computerspiele erlauben, sitzen Jugendliche noch länger vor dem Bildschirm. Das ist für die Gesundheit sicher nicht eine gute Entwicklung. Außerdem es schwer zu kontrollieren, ob wirklich alle das richtige Spiel spielen. Deshalb die Lehrer müssten ständig durch die Klasse gehen und auf jedes Tablet schauen. Gute Lernspiele kosten zudem oft viel Geld, das viele Schulen nicht haben.",
        "heading": false
      },
      {
        "text": "Zusammenfassend kann man sagen, dass es für beide Seiten gute Argumente gibt. Ich selbst spiele seit der Volksschule gerne Strategiespiele und habe dabei viel über Geschichte gelernt. Deshalb glaube ich, dass spaß beim Lernen sehr wichtig ist. Trotzdem sollte der normale Unterricht nicht verschwinden. Für mich wären eine Kombination aus Lernspielen und normalem Unterricht die beste Lösung. Man könnte zum Beispiel einmal pro Woche eine Stunde lang mit Lernspielen üben, sodass niemand zu viel Zeit vor dem Bildschirm verbringt. Ich bin also für Computerspiele im Unterricht, aber nur in Maßen.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "vor ihrem Bildschirmen",
        "right": [
          "vor ihren Bildschirmen",
          "vor ihrem Bildschirm"
        ],
        "category": "grammatik",
        "what": "Begleiter und Nomen müssen in Fall und Zahl übereinstimmen: Dativ Plural „vor ihren Bildschirmen“."
      },
      {
        "para": 2,
        "wrong": "wird über dem Thema",
        "right": [
          "wird das Thema"
        ],
        "category": "grammatik",
        "what": "„erörtern“ verlangt ein Akkusativobjekt ohne Präposition (etwas erörtern); im Passiv wird es zum Subjekt: Das Thema wird erörtert."
      },
      {
        "para": 3,
        "wrong": "dabei spaß",
        "right": [
          "dabei Spaß"
        ],
        "category": "rechtschreibung",
        "what": "„Spaß“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 3,
        "wrong": "Lernspiele, trainieren",
        "right": [
          "Lernspiele trainieren"
        ],
        "category": "zeichensetzung",
        "what": "Zwischen Subjekt und Prädikat steht kein Beistrich."
      },
      {
        "para": 3,
        "wrong": "ein Fehler macht",
        "right": [
          "einen Fehler macht"
        ],
        "category": "grammatik",
        "what": "Akkusativobjekt: Wen oder was macht man? – einen Fehler."
      },
      {
        "para": 3,
        "wrong": "helfen den Schüler",
        "right": [
          "helfen den Schülern",
          "helfen den Schülerinnen und Schülern",
          "helfen dem Schüler"
        ],
        "category": "grammatik",
        "what": "„helfen“ verlangt den Dativ; im Dativ Plural bekommt das Nomen ein -n: den Schülern."
      },
      {
        "para": 3,
        "wrong": "besser Noten",
        "right": [
          "bessere Noten"
        ],
        "category": "grammatik",
        "what": "Das Adjektiv vor dem Nomen muss gebeugt werden: bessere Noten."
      },
      {
        "para": 4,
        "wrong": "eine Zeitverschwendung ist",
        "right": [
          "eine Zeitverschwendung sind",
          "eine Zeitverschwendung seien"
        ],
        "category": "grammatik",
        "what": "Das Subjekt „Spiele“ steht im Plural, daher muss auch das Verb im Plural stehen: Spiele sind."
      },
      {
        "para": 4,
        "wrong": "dass wenn",
        "right": [
          "dass, wenn"
        ],
        "category": "zeichensetzung",
        "what": "Der eingeschobene wenn-Satz wird auch direkt nach „dass“ mit Beistrich abgetrennt: dass, wenn …, sie …"
      },
      {
        "para": 4,
        "wrong": "Wenn sich auch in der Schule Computerspiele erlauben",
        "right": [
          "Wenn Computerspiele auch in der Schule erlaubt werden",
          "Wenn auch in der Schule Computerspiele erlaubt werden",
          "Wenn auch in der Schule Computerspiele erlaubt sind",
          "Wenn man auch in der Schule Computerspiele erlaubt",
          "Wenn Computerspiele auch in der Schule erlaubt sind"
        ],
        "category": "grammatik",
        "what": "Die Spiele erlauben sich nicht selbst etwas; gemeint ist das Passiv: Computerspiele werden erlaubt."
      },
      {
        "para": 4,
        "wrong": "nicht eine gute",
        "right": [
          "keine gute"
        ],
        "category": "ausdruck",
        "what": "Vor einem Nomen verneint man mit „kein“: keine gute Entwicklung."
      },
      {
        "para": 4,
        "wrong": "Außerdem es schwer",
        "right": [
          "Außerdem ist es schwer"
        ],
        "category": "satzbau",
        "what": "Dem Satz fehlt das Verb (Prädikat): Außerdem ist es schwer …"
      },
      {
        "para": 4,
        "wrong": "Deshalb die Lehrer müssten",
        "right": [
          "Deshalb müssten die Lehrer",
          "Deshalb müssten die Lehrerinnen und Lehrer",
          "Deshalb müssten die Lehrpersonen"
        ],
        "category": "satzbau",
        "what": "Steht „deshalb“ am Satzanfang, folgt sofort das gebeugte Verb (Verb an zweiter Stelle)."
      },
      {
        "para": 5,
        "wrong": "dass spaß",
        "right": [
          "dass Spaß"
        ],
        "category": "rechtschreibung",
        "what": "„Spaß“ ist ein Nomen und wird großgeschrieben (derselbe Fehler wie im ersten Hauptteil-Absatz)."
      },
      {
        "para": 5,
        "wrong": "wären eine Kombination",
        "right": [
          "wäre eine Kombination"
        ],
        "category": "grammatik",
        "what": "Das Subjekt „eine Kombination“ steht im Singular, also: wäre."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "im Allgemeinen",
        "why": "Feste Wendung; „Allgemeinen“ wird großgeschrieben."
      },
      {
        "para": 2,
        "text": "Heuer",
        "why": "Österreichisch für „in diesem Jahr“; korrekt."
      },
      {
        "para": 2,
        "text": "Im folgenden Text",
        "why": "„folgend“ ist hier ein Adjektiv vor dem Nomen „Text“ und wird kleingeschrieben."
      },
      {
        "para": 3,
        "text": "seit Jänner",
        "why": "„Jänner“ ist die österreichische Monatsbezeichnung; „seit“ (zeitlich) richtig geschrieben."
      },
      {
        "para": 4,
        "text": "Geld, das viele Schulen",
        "why": "„das“ ist Relativpronomen (bezogen auf „Geld“) und wird mit einem s geschrieben."
      },
      {
        "para": 5,
        "text": "Deshalb glaube ich",
        "why": "Richtige Verbzweitstellung nach „deshalb“."
      },
      {
        "para": 5,
        "text": "sodass",
        "why": "„sodass“ und „so dass“ sind beide richtig."
      },
      {
        "para": 5,
        "text": "in Maßen",
        "why": "„in Maßen“ (= maßvoll) wird mit ß geschrieben; korrekt."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "Tablets und deshalb hat",
        "why": "Beistrich zwischen Hauptsätzen mit „und“ freiwillig"
      },
      {
        "para": 3,
        "text": "bis es klappt",
        "why": "Satz ist richtig, Umformulierung nur Stil"
      },
      {
        "para": 3,
        "text": "Spiele sind spannend und man bleibt",
        "why": "Beistrich zwischen Hauptsätzen mit „und“ freiwillig"
      },
      {
        "para": 3,
        "text": "In Englisch verwenden wir",
        "why": "auch „Im Englischunterricht“ möglich"
      }
    ]
  },
  {
    "nr": "K05",
    "title": "Pflichtpraktikum in der Oberstufe",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 6,
    "textKind": "Erörterung",
    "task": "Verfasse eine Erörterung zur Frage, ob in der Oberstufe ein verpflichtendes Praktikum eingeführt werden soll. Wäge Pro- und Kontra-Argumente ab, beziehe Beispiele ein und formuliere am Ende eine begründete Stellungnahme. Umfang: 420 bis 480 Wörter.",
    "blocks": [
      {
        "text": "Pflichtpraktikum in der Oberstufe – Chance oder Belastung?",
        "heading": true
      },
      {
        "text": "Nach der Matura stehen viele Jugendliche vor einer schwierigen Entscheidung: Studium, Lehre oder doch gleich ein Job? Laut einer Umfrage unserer Schulvertretung wissen nur wenige Schülerinnen und Schüler der sechsten Klassen genau, welchen Beruf sie später ergreifen möchten. Manche entscheiden sich sogar nur deshalb für ein bestimmtes Studium, weil ihre Freundinnen und Freunde dasselbe tun. Aus diesem Grund wird derzeit darüber diskutiert, ob in der Oberstufe ein verpflichtendes Praktikum eingeführt werden soll. Im Folgenden möchte ich mich über die Vor- und Nachteile eines solchen Pflichtpraktikums auseinandersetzen.",
        "heading": false
      },
      {
        "text": "Für ein Pflichtpraktikum spricht vor allem, dass Jugendliche die Arbeitswelt frühzeitig kennenlernen. Man erfährt dabei nicht nur, wie ein Betrieb funktioniert, aber man knüpft auch erste Kontakte zu möglichen Arbeitgebern. Die Erfahrungen, die man während eines solchen Praktikums sammelt, hilft später bei der Berufswahl. Viele merken nämlich erst im Arbeitsalltag, ob sie wirklich Interresse an einem Beruf haben. Mein Cousin, ein Lehrling in einem Elektrotechnikbetrieb erzählte mir, dass er erst durch ein Ferialpraktikum auf die Idee gekommen sei, diesen Beruf zu erlernen. Profitieren würden außerdem die Unternehmen, die wegen dem Fachkräftemangel dringend Nachwuchs suchen.",
        "heading": false
      },
      {
        "text": "Es gibt allerdings auch gewichtige Gegenargumente. Die Oberstufe ist schon jetzt voll anstrengend und viele Schülerinnen und Schüler haben neben Unterricht, Hausübungen und Schularbeiten kaum Freizeit. Ein Praktikum, dass mehrere Wochen dauert, würde die knappe Unterrichtszeit zusätzlich verkürzen. Findet es hingegen in den Sommerferien statt, fehlt die Zeit zur Erholung. Viele nutzen die Ferien außerdem um Geld zu verdienen oder ihre Familie zu unterstützen. Unsere Direktorin erklärte in einem Interview mit der Schülerzeitung, ein Praktikum ist zwar für viele sinnvoll, aber nicht für alle gleich geeignet. Nicht jeder finde einen passenden Platz in seiner Nähe, vor allem am Land. Die Schule werde den Vorschlag aber genau prüfen.",
        "heading": false
      },
      {
        "text": "Meiner Meinung nach lassen sich diese Probleme jedoch lösen. Die Betriebe, die Praktikantinnen und Praktikanten aufnehmen müssten dafür finanziell unterstützt werden. Außerdem könnte die Schule versuchen eine Liste mit geeigneten Praktikumsplätzen zusammenzustellen, sodass niemand lange suchen muss. Findet das Praktikum während des Schuljahres statt, bleiben auch die Ferien frei. Ein Praktikum wäre zudem für die persönliche Entwicklung wertvoll, weil man lernt in einem Betrieb Verantwortung und Pünktlichkeit. Gerade wer später studieren will, könnte so besser einschätzen, ob er mit dem Alltag in seinem Wunschberuf zurecht kommt.",
        "heading": false
      },
      {
        "text": "Zusammenfassend lässt sich sagen, dass die Vorteile eines Pflichtpraktikums überwiegen. Ein solches Praktikum darf halt nicht zu einer zusätzlichen Belastung für die Jugendlichen werden. Ideal wäre aus meiner Sicht ein zweiwöchiges Praktikum in der sechsten Klasse, das während der Schulzeit stattfindet und im Unterricht gut vor- und nachbereitet wird. Heuer startet an unserer Schule bereits ein Probelauf mit zwei Klassen. Ich bin gespannt, ob die Erfahrungen so positiv sein werden, wie viele hoffen.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "über die Vor- und Nachteile",
        "right": [
          "mit den Vor- und Nachteilen"
        ],
        "category": "grammatik",
        "what": "Falsche Präposition: „sich auseinandersetzen“ verlangt „mit“ + Dativ (sich mit etwas auseinandersetzen)."
      },
      {
        "para": 3,
        "wrong": "aber man knüpft auch",
        "right": [
          "sondern man knüpft auch",
          "sondern knüpft auch"
        ],
        "category": "satzbau",
        "what": "Die zweiteilige Konjunktion lautet „nicht nur …, sondern auch …“; „aber“ zerstört die Verknüpfung."
      },
      {
        "para": 3,
        "wrong": "hilft später",
        "right": [
          "helfen später"
        ],
        "category": "grammatik",
        "what": "Kongruenz: Subjekt ist „Die Erfahrungen“ (Plural); das Prädikat nach dem eingeschobenen Relativsatz muss „helfen“ lauten."
      },
      {
        "para": 3,
        "wrong": "Interresse",
        "right": [
          "Interesse"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwortschreibung: Interesse wird mit einem r geschrieben."
      },
      {
        "para": 3,
        "wrong": "Elektrotechnikbetrieb erzählte",
        "right": [
          "Elektrotechnikbetrieb, erzählte"
        ],
        "category": "zeichensetzung",
        "what": "Die Apposition „ein Lehrling in einem Elektrotechnikbetrieb“ ist ein Einschub und muss auch am Ende mit Beistrich abgeschlossen werden."
      },
      {
        "para": 3,
        "wrong": "wegen dem Fachkräftemangel",
        "right": [
          "wegen des Fachkräftemangels",
          "aufgrund des Fachkräftemangels"
        ],
        "category": "grammatik",
        "what": "In der geschriebenen Standardsprache verlangt „wegen“ den Genitiv; „wegen dem“ ist umgangssprachlich."
      },
      {
        "para": 4,
        "wrong": "voll anstrengend",
        "right": [
          "sehr anstrengend",
          "äußerst anstrengend",
          "anstrengend",
          "besonders anstrengend",
          "ziemlich anstrengend"
        ],
        "category": "ausdruck",
        "what": "Registerfehler: „voll“ im Sinne von „sehr“ ist Umgangssprache und passt nicht in eine Erörterung."
      },
      {
        "para": 4,
        "wrong": "Praktikum, dass",
        "right": [
          "Praktikum, das",
          "Praktikum, welches"
        ],
        "category": "rechtschreibung",
        "what": "Relativpronomen (bezogen auf „Praktikum“) wird mit einem s geschrieben; Probe: durch „welches“ ersetzbar."
      },
      {
        "para": 4,
        "wrong": "außerdem um",
        "right": [
          "außerdem, um"
        ],
        "category": "zeichensetzung",
        "what": "Eine Infinitivgruppe mit „um … zu“ wird immer mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "ein Praktikum ist",
        "right": [
          "ein Praktikum sei"
        ],
        "category": "grammatik",
        "what": "Indirekte Rede ohne „dass“ steht im Konjunktiv I: ein Praktikum sei … (wie „finde“ und „werde“ in den folgenden Sätzen)."
      },
      {
        "para": 5,
        "wrong": "aufnehmen müssten",
        "right": [
          "aufnehmen, müssten"
        ],
        "category": "zeichensetzung",
        "what": "Der eingeschobene Relativsatz „die … aufnehmen“ muss auch am Ende mit Beistrich abgeschlossen werden."
      },
      {
        "para": 5,
        "wrong": "weil man lernt in einem Betrieb Verantwortung und Pünktlichkeit",
        "right": [
          "weil man in einem Betrieb Verantwortung und Pünktlichkeit lernt",
          "denn man lernt in einem Betrieb Verantwortung und Pünktlichkeit"
        ],
        "category": "satzbau",
        "what": "Im weil-Satz (Nebensatz) steht das gebeugte Verb am Ende; Verbzweitstellung nach „weil“ ist nur mündlich üblich."
      },
      {
        "para": 5,
        "wrong": "zurecht kommt",
        "right": [
          "zurechtkommt"
        ],
        "category": "rechtschreibung",
        "what": "„zurechtkommen“ wird zusammengeschrieben."
      },
      {
        "para": 6,
        "wrong": "darf halt nicht",
        "right": [
          "darf jedoch nicht",
          "darf aber nicht",
          "darf nicht",
          "darf allerdings nicht"
        ],
        "category": "ausdruck",
        "what": "Registerfehler: Die Partikel „halt“ ist umgangssprachlich und gehört nicht in eine Erörterung."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Im Folgenden",
        "why": "Nominalisierung (= weiter unten) wird großgeschrieben."
      },
      {
        "para": 3,
        "text": "kennenlernen",
        "why": "Zusammenschreibung korrekt (Getrenntschreibung ebenfalls zulässig)."
      },
      {
        "para": 3,
        "text": "gekommen sei",
        "why": "Konjunktiv I in der indirekten Rede ist auch nach „dass“ korrekt."
      },
      {
        "para": 3,
        "text": "Ferialpraktikum",
        "why": "Österreichisch für ein Praktikum in den Ferien; korrekt."
      },
      {
        "para": 4,
        "text": "Hausübungen und Schularbeiten",
        "why": "Österreichische Schulwörter (Hausaufgaben, Klassenarbeiten); korrekt."
      },
      {
        "para": 4,
        "text": "Nicht jeder finde einen passenden Platz",
        "why": "Korrekter Konjunktiv I in fortgesetzter indirekter Rede."
      },
      {
        "para": 4,
        "text": "am Land",
        "why": "Österreichisch für „auf dem Land“; korrekt."
      }
    ],
    "neutral": [
      {
        "para": 5,
        "text": "versuchen eine Liste",
        "why": "Beistrich vor der Infinitivgruppe freiwillig"
      },
      {
        "para": 2,
        "text": "Studium, Lehre oder doch gleich ein Job?",
        "why": "umgangssprachlich, aber vertretbar"
      },
      {
        "para": 4,
        "text": "und viele Schülerinnen",
        "why": "Beistrich zwischen Hauptsätzen mit „und“ freiwillig"
      }
    ]
  },
  {
    "nr": "K06",
    "title": "Analyse eines Kommentars zum Wirtshaussterben",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 7,
    "textKind": "Textanalyse",
    "task": "Verfasse eine Textanalyse des Kommentars „Wenn im Wirtshaus das Licht ausgeht“ von Verena Hollauer (Donautaler Nachrichten, 17. Jänner 2026). Gehe auf Inhalt, Aufbau, Argumentation und sprachliche Mittel ein, belege deine Aussagen mit Zitaten und Zeilenangaben und arbeite die Intention der Autorin heraus. Umfang: 430 bis 480 Wörter.",
    "blocks": [
      {
        "text": "Analyse des Kommentars „Wenn im Wirtshaus das Licht ausgeht“",
        "heading": true
      },
      {
        "text": "Der Kommentar „Wenn im Wirtshaus das Licht ausgeht“ von Verena Hollauer erschien am 17. Jänner 2026 in der Tageszeitung „Donautaler Nachrichten“. Darin setzt sich die Autorin mit dem sogenannten Wirtshaussterben in ländlichen Gemeinden auseinander. Im folgenden wird untersucht, wie Hollauer argumentiert und mit welchen sprachlichen Mitteln sie ihre Leserinnen und Leser zu überzeugen versucht.",
        "heading": false
      },
      {
        "text": "Zu Beginn schildert die Autorin ihre Erinnerungen an die Sonntage, die sie als Kind mit ihrem Großvater am Stammtisch des Dorfgasthauses verbracht hat. Danach erklärte sie, dass in Österreich jedes Jahr Hunderte Gasthäuser zusperren müssen. Als Gründe nennt sie hohe Energiekosten, fehlendes Personal und veränderte Freizeitgewohnheiten. Zwar räumt sie ein, dass viele junge Menschen lieber in Lokale in der Stadt fahren, doch das sei für sie kein Grund, das Wirtshaus aufzugeben. Hollauer behauptet, das Wirtshaus ist „das Wohnzimmer des Dorfes“ (Z. 14). Dort treffe man sich unabhängig von Alter, Beruf und Einkommen. Im letzten Absatz appelliert sie an den Lesern, das Gasthaus im eigenen Ort wieder öfter zu besuchen.",
        "heading": false
      },
      {
        "text": "Die Argumentation der Autorin ist überwiegend emotional. Statt Zahlen in den Vordergrund zu stellen, erzählt sie vom Geruch nach Schweinsbraten und vom Kartenspielen am Stammtisch. Dadurch weckt sie beim Publikum ein Gefühl von Heimat und Zugehörigkeit. Die Autorin zeigt dass mit jedem Wirtshaus auch ein Ort der Gemeinschaft verloren geht. Ihr stärkstes Argument ist, das ein Gasthaus durch keinen Supermarkt und kein Vereinslokal ersetzt werden kann. Eine Studie des Landes erwähnt sie nur am Rand, ohne genauere Zahlen zu nennen. Die zahlreichen Beispiele aus ihrem Heimatort macht den Text zwar anschaulich, wirken aber auch etwas einseitig, weil Gegenpositionen kaum berücksichtigt werden.",
        "heading": false
      },
      {
        "text": "Auch sprachlich ist der Kommentar sorgfältig gestaltet. Besonders auffällig ist die Methapher vom „Wohnzimmer des Dorfes“ (Z. 14), die Wärme und Geborgenheit vermittelt. Die Alliteration „Bier und Brettljause“ (Z. 19) sorgt für einen lockeren, fast humorvollen Ton. Mit der rethorischen Frage „Wo sollen wir uns dann noch treffen?“ (Z. 27) spricht die Autorin ihr Publikum direkt an. Der Satzbau, der überwiegend aus kurzen Hauptsätzen besteht wirkt eindringlich, sodass der Text stellenweise fast wie eine Rede klingt. Am Schluss verwendete sie eine Anapher: „Kein Wirt, kein Stammtisch, kein Dorf“ (Z. 41). Diese knappe Reihung ist echt stark und bleibt im Gedächtnis.",
        "heading": false
      },
      {
        "text": "Zusammenfassend lässt sich festhalten, dass Hollauer ihr Publikum vor allem auf der Gefühlsebene erreichen will. Ihre Intention ist es, die Menschen zum Handeln zu bewegen, damit die Gasthäuser in den Gemeinden erhalten bleiben. Inhaltlich bringt der Kommentar allerdings kaum etwas neues in die Debatte ein, da konkrete Lösungsvorschläge weitgehend fehlen. Trotzdem halte ich den Text für gelungen, weil er zum Nachdenken über die eigenen Freizeitgewohnheiten anregt. Für Leserinnen und Leser, die selbst in einem Dorf leben, dürfte er besonders überzeugend wirken.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "Im folgenden wird",
        "right": [
          "Im Folgenden wird"
        ],
        "category": "rechtschreibung",
        "what": "„im Folgenden“ (= weiter unten) ist eine Nominalisierung und wird großgeschrieben."
      },
      {
        "para": 3,
        "wrong": "Danach erklärte sie",
        "right": [
          "Danach erklärt sie"
        ],
        "category": "grammatik",
        "what": "Tempusfehler: In einer Textanalyse wird der Inhalt im Präsens wiedergegeben."
      },
      {
        "para": 3,
        "wrong": "das Wirtshaus ist",
        "right": [
          "das Wirtshaus sei"
        ],
        "category": "grammatik",
        "what": "Indirekte Rede ohne „dass“ verlangt den Konjunktiv I: das Wirtshaus sei … (wie „sei“ und „treffe“ in den Nachbarsätzen)."
      },
      {
        "para": 3,
        "wrong": "an den Lesern",
        "right": [
          "an die Leser",
          "an die Leserinnen und Leser",
          "an die Leserschaft"
        ],
        "category": "grammatik",
        "what": "„appellieren an“ verlangt den Akkusativ: an die Leser."
      },
      {
        "para": 4,
        "wrong": "zeigt dass",
        "right": [
          "zeigt, dass"
        ],
        "category": "zeichensetzung",
        "what": "Der dass-Satz ist ein Nebensatz und wird mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "das ein Gasthaus",
        "right": [
          "dass ein Gasthaus"
        ],
        "category": "rechtschreibung",
        "what": "Hier leitet die Konjunktion „dass“ einen Nebensatz ein (nicht durch „welches“ ersetzbar) – daher mit ss."
      },
      {
        "para": 4,
        "wrong": "Heimatort macht",
        "right": [
          "Heimatort machen"
        ],
        "category": "grammatik",
        "what": "Kongruenz: Subjekt ist „Die zahlreichen Beispiele“ (Plural), also „machen“ (vgl. „wirken“)."
      },
      {
        "para": 5,
        "wrong": "Methapher",
        "right": [
          "Metapher"
        ],
        "category": "rechtschreibung",
        "what": "Fachbegriff: Metapher wird ohne h geschrieben."
      },
      {
        "para": 5,
        "wrong": "rethorischen",
        "right": [
          "rhetorischen"
        ],
        "category": "rechtschreibung",
        "what": "Fachbegriff: rhetorisch (von Rhetorik) – das h steht nach dem r, nicht nach dem t."
      },
      {
        "para": 5,
        "wrong": "besteht wirkt",
        "right": [
          "besteht, wirkt"
        ],
        "category": "zeichensetzung",
        "what": "Der eingeschobene Relativsatz muss auch am Ende mit Beistrich abgeschlossen werden."
      },
      {
        "para": 5,
        "wrong": "verwendete sie",
        "right": [
          "verwendet sie"
        ],
        "category": "grammatik",
        "what": "Tempusfehler: In der Analyse steht das Präsens."
      },
      {
        "para": 5,
        "wrong": "ist echt stark",
        "right": [
          "ist sehr wirkungsvoll",
          "wirkt besonders nachdrücklich",
          "ist sehr eindringlich",
          "wirkt sehr eindringlich",
          "ist besonders wirkungsvoll",
          "ist sehr eindrucksvoll"
        ],
        "category": "ausdruck",
        "what": "„echt stark“ ist umgangssprachlich und subjektiv; in einer Analyse wird die Wirkung sachlich beschrieben."
      },
      {
        "para": 6,
        "wrong": "etwas neues",
        "right": [
          "etwas Neues"
        ],
        "category": "rechtschreibung",
        "what": "Nach „etwas“ wird das nominalisierte Adjektiv großgeschrieben: etwas Neues."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "erschien am 17. Jänner 2026",
        "why": "Präteritum ist für das tatsächliche Erscheinen in der Vergangenheit korrekt; „Jänner“ ist österreichisch."
      },
      {
        "para": 3,
        "text": "verbracht hat",
        "why": "Perfekt drückt die Vorzeitigkeit (Kindheit) aus; kein Tempusfehler."
      },
      {
        "para": 3,
        "text": "Hunderte Gasthäuser zusperren",
        "why": "„Hunderte“ darf groß- oder kleingeschrieben werden; „zusperren“ ist österreichisch für „schließen“."
      },
      {
        "para": 3,
        "text": "Dort treffe man sich",
        "why": "Korrekter Konjunktiv I in fortgesetzter indirekter Rede."
      },
      {
        "para": 4,
        "text": "Schweinsbraten",
        "why": "Österreichische Form (statt „Schweinebraten“); korrekt."
      },
      {
        "para": 4,
        "text": "verloren geht",
        "why": "Getrenntschreibung korrekt (Zusammenschreibung ebenfalls zulässig)."
      },
      {
        "para": 5,
        "text": "„Bier und Brettljause“ (Z. 19)",
        "why": "Korrektes Zitat mit Zeilenangabe; „Brettljause“ ist österreichisch, die Alliteration richtig benannt."
      },
      {
        "para": 5,
        "text": "Anapher",
        "why": "Fachbegriff richtig geschrieben und zutreffend verwendet (Wiederholung von „kein“ am Anfang)."
      },
      {
        "para": 5,
        "text": "„Kein Wirt, kein Stammtisch, kein Dorf“ (Z. 41)",
        "why": "Wörtliches Zitat mit Zeilenangabe; die elliptische Form stammt aus dem Original und wird nicht korrigiert."
      }
    ],
    "neutral": [
      {
        "para": 6,
        "text": "Trotzdem halte ich den Text für gelungen",
        "why": "Ich-Form in der Analyse vertretbar"
      },
      {
        "para": 3,
        "text": "dass in Österreich jedes Jahr Hunderte Gasthäuser zusperren müssen",
        "why": "Konjunktiv gleich Indikativ"
      },
      {
        "para": 3,
        "text": "dass viele junge Menschen lieber in Lokale in der Stadt fahren",
        "why": "Konjunktiv gleich Indikativ"
      },
      {
        "para": 2,
        "text": "sogenannten",
        "why": "beide Schreibungen"
      },
      {
        "para": 5,
        "text": "sodass",
        "why": "beide Schreibungen"
      },
      {
        "para": 4,
        "text": "am Rand",
        "why": "auch am Rande"
      }
    ]
  },
  {
    "nr": "K07",
    "title": "Interpretation: „Der Schlüssel“",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 8,
    "textKind": "Textinterpretation",
    "task": "Interpretiere die Kurzgeschichte „Der Schlüssel“ von Miriam Holzknecht. Gehe auf Inhalt, Aufbau, Erzählweise, Figuren, Symbolik und Sprache ein und entwickle eine begründete Deutung. Belege deine Aussagen am Text. Umfang: 470 bis 530 Wörter.",
    "blocks": [
      {
        "text": "Interpretation der Kurzgeschichte „Der Schlüssel“ von Miriam Holzknecht",
        "heading": true
      },
      {
        "text": "Die Kurzgeschichte „Der Schlüssel“ von Miriam Holzknecht ist 2019 im Erzählband „Kleine Abschiede“ erschienen. Sie handelt vom Umgang mit Verlust und Erinnerung. Lea, die sechzehnjährige Hauptfigur hilft ihrer Mutter beim Ausräumen der Wohnung ihres verstorbenen Großvaters. Dabei stößt sie auf einen alten Schlüssel, der zu keinem Schloss in der Wohnung passt. Im Folgenden soll gezeigt werden, wie die Autorin mit einfachen sprachlichen Mitteln die Trauer eines jungen Menschen darstellt.",
        "heading": false
      },
      {
        "text": "Die Geschichte beginnt unvermittelt mit dem Satz „Der Kasten roch nach Mottenkugeln“ (Z. 1), sodass der Leser sofort mitten in die Handlung versetzt wird. Während die Mutter die Sachen des Großvaters möglichst rasch in Kartons packt, fand Lea in einer Blechdose den Schlüssel. Sie probiert ihn an jeder Tür aus, sogar am Kellerabteil, doch er passt nirgends. Da sie den Schlüssel am Ende behält, obwohl sie nicht weiß, wozu er gehört. Die Geschichte schließt mit Leas Gedanken: „Manche Türen, dachte sie, muss man gar nicht aufsperren“ (Z. 58). Typisch für eine Kurzgeschichte sind neben dem unvermittelten Einstieg auch das offene Ende und die alltägliche Situation.",
        "heading": false
      },
      {
        "text": "Erzählt wird aus Leas Sicht, wobei ein personaler Erzähler nah an ihren Gedanken bleibt. Die Gefühle der Mutter erfährt der Leser hingegen nur indirekt. Die Mutter checkt nicht, wie sehr Lea unter dem Verlust leidet. Sie will die Wohnung so schnell wie möglich leer haben, weil diese bis Monatsende an die Hausverwaltung übergeben werden muss. Lea erinnert sich dagegen an den Sonntagnachmittagen, an denen sie mit ihrem Großvater Karten gespielt hat. Die Gegenstände, die sie beim Ausräumen in die Hand nimmt und die für ihre Mutter nur „alter Kram“ (Z. 23) sind, zeigt, wie unterschiedlich die beiden mit der Trauer umgehen. Trotzdem Lea ihre Mutter versteht, fühlt sie sich mit ihrem Schmerz allein.",
        "heading": false
      },
      {
        "text": "Der Schlüssel ist das zentrale Symbol der Geschichte. Er steht für die Erinnerung an den Großvater, aber auch für alles, was Lea über ihn nie erfahren hat. Auch das offene Ende, der keine Auflösung bietet, unterstreicht diese Deutung. Lea will den Großvater noch nicht los lassen. Wenn sie den Schlüssel wegwerfen würde, ist ihre letzte Verbindung zu ihm verloren. Die kurzen, parataktischen Sätze erzeugen eine nüchterne Athmosphäre, die im Gegensatz zu Leas Gefühlen steht. Nur in den Erinnerungsszenen wird der Rythmus ruhiger und die Sätze werden länger. Holzknecht verzichtet auf direkte Aussagen über Leas Trauer; stattdessen zeigt sie diese durch Gesten. Von ihren Erinnerungen überwältigt setzt sich Lea etwa auf den Boden des Vorzimmers und umklammert den Schlüssel (Z. 51).",
        "heading": false
      },
      {
        "text": "Meiner Meinung nach zeigt die Geschichte, dass Trauer kein Problem ist, das man rasch lösen kann. Am Ende erkannte Lea, dass nicht jede Frage beantwortet werden muss, um mit einem Verlust leben zu können. Die Erinnerung an ihren Großvater ist ihr wichtiger als die Frage welches Schloss der Schlüssel öffnet. Gerade weil die Autorin vieles unbeantwortet lässt, regt die Geschichte zum Nachdenken über den eigenen Umgang mit Abschieden an.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "Hauptfigur hilft",
        "right": [
          "Hauptfigur, hilft"
        ],
        "category": "zeichensetzung",
        "what": "Die Apposition „die sechzehnjährige Hauptfigur“ ist ein Einschub und wird auch am Ende mit Beistrich abgeschlossen."
      },
      {
        "para": 3,
        "wrong": "fand Lea",
        "right": [
          "findet Lea"
        ],
        "category": "grammatik",
        "what": "Tempusfehler: Inhaltswiedergabe und Interpretation stehen im Präsens (vgl. „packt“, „probiert“)."
      },
      {
        "para": 3,
        "wrong": "Da sie den Schlüssel am Ende behält",
        "right": [
          "Sie behält den Schlüssel am Ende",
          "Am Ende behält sie den Schlüssel",
          "Dennoch behält sie den Schlüssel am Ende",
          "Trotzdem behält sie den Schlüssel am Ende"
        ],
        "category": "satzbau",
        "what": "Unvollständiger Satz: Er besteht nur aus Nebensätzen, der Hauptsatz fehlt."
      },
      {
        "para": 4,
        "wrong": "checkt nicht",
        "right": [
          "bemerkt nicht",
          "erkennt nicht",
          "versteht nicht",
          "begreift nicht",
          "merkt nicht"
        ],
        "category": "ausdruck",
        "what": "„checken“ ist umgangssprachlich und passt nicht in eine Interpretation."
      },
      {
        "para": 4,
        "wrong": "an den Sonntagnachmittagen",
        "right": [
          "an die Sonntagnachmittage"
        ],
        "category": "grammatik",
        "what": "„sich erinnern an“ verlangt den Akkusativ: an die Sonntagnachmittage."
      },
      {
        "para": 4,
        "wrong": "zeigt, wie unterschiedlich",
        "right": [
          "zeigen, wie unterschiedlich"
        ],
        "category": "grammatik",
        "what": "Kongruenz: Subjekt ist „Die Gegenstände“ (Plural); trotz der eingeschobenen Relativsätze muss das Prädikat im Plural stehen."
      },
      {
        "para": 4,
        "wrong": "Trotzdem Lea",
        "right": [
          "Obwohl Lea",
          "Obgleich Lea",
          "Auch wenn Lea"
        ],
        "category": "grammatik",
        "what": "„trotzdem“ ist ein Adverb und leitet in der Standardsprache keinen Nebensatz ein; richtig ist die Konjunktion „obwohl“."
      },
      {
        "para": 5,
        "wrong": "der keine Auflösung",
        "right": [
          "das keine Auflösung"
        ],
        "category": "grammatik",
        "what": "Bezugsfehler: Das Relativpronomen bezieht sich auf „das Ende“ (Neutrum) und muss „das“ lauten."
      },
      {
        "para": 5,
        "wrong": "los lassen",
        "right": [
          "loslassen"
        ],
        "category": "rechtschreibung",
        "what": "„loslassen“ wird zusammengeschrieben."
      },
      {
        "para": 5,
        "wrong": "wegwerfen würde, ist ihre letzte Verbindung",
        "right": [
          "wegwerfen würde, wäre ihre letzte Verbindung",
          "wegwirft, ist ihre letzte Verbindung",
          "wegwürfe, wäre ihre letzte Verbindung"
        ],
        "category": "grammatik",
        "what": "Irrealer Bedingungssatz: Auch der Hauptsatz verlangt den Konjunktiv II (wäre … verloren)."
      },
      {
        "para": 5,
        "wrong": "Athmosphäre",
        "right": [
          "Atmosphäre"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort (griech. atmós): Atmosphäre wird ohne h nach dem t geschrieben."
      },
      {
        "para": 5,
        "wrong": "Rythmus",
        "right": [
          "Rhythmus"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort: Rhythmus wird mit zwei h geschrieben (Rh…th…)."
      },
      {
        "para": 6,
        "wrong": "erkannte Lea",
        "right": [
          "erkennt Lea"
        ],
        "category": "grammatik",
        "what": "Tempusfehler: In der Interpretation steht das Präsens."
      },
      {
        "para": 6,
        "wrong": "Frage welches",
        "right": [
          "Frage, welches"
        ],
        "category": "zeichensetzung",
        "what": "Der indirekte Fragesatz „welches Schloss …“ ist ein Nebensatz und wird mit Beistrich abgetrennt."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "ist 2019 im Erzählband „Kleine Abschiede“ erschienen",
        "why": "Perfekt für das Erscheinen (vergangenes Ereignis) ist korrekt; kein Tempusfehler."
      },
      {
        "para": 2,
        "text": "Im Folgenden",
        "why": "Nominalisierung (= weiter unten) wird großgeschrieben."
      },
      {
        "para": 3,
        "text": "„Der Kasten roch nach Mottenkugeln“ (Z. 1)",
        "why": "Wörtliches Zitat bleibt im Präteritum des Originals; „Kasten“ ist österreichisch für Schrank."
      },
      {
        "para": 3,
        "text": "Kellerabteil",
        "why": "Österreichisch für den abgetrennten Kellerraum einer Wohnung; korrekt."
      },
      {
        "para": 3,
        "text": "„Manche Türen, dachte sie, muss man gar nicht aufsperren“ (Z. 58)",
        "why": "Wörtliches Zitat mit Zeilenangabe; „aufsperren“ ist österreichisch für „aufschließen“."
      },
      {
        "para": 3,
        "text": "Typisch für eine Kurzgeschichte sind",
        "why": "Plural korrekt: Das Subjekt „das offene Ende und die alltägliche Situation“ ist zweiteilig."
      },
      {
        "para": 5,
        "text": "stattdessen",
        "why": "Das Adverb „stattdessen“ wird zusammengeschrieben; korrekt."
      },
      {
        "para": 5,
        "text": "überwältigt setzt",
        "why": "Nach einer vorangestellten Partizipgruppe ist der Beistrich freigestellt."
      },
      {
        "para": 5,
        "text": "Vorzimmers",
        "why": "Österreichisch für Flur/Diele; korrekt."
      }
    ],
    "neutral": [
      {
        "para": 6,
        "text": "Meiner Meinung nach",
        "why": "persönliche Stellungnahme im Schluss"
      },
      {
        "para": 4,
        "text": "leer haben",
        "why": "leicht umgangssprachlich"
      },
      {
        "para": 3,
        "text": "wozu er gehört",
        "why": "vertretbar"
      },
      {
        "para": 5,
        "text": "ruhiger und die Sätze",
        "why": "Beistrich vor und wahlfrei"
      },
      {
        "para": 4,
        "text": "nah an ihren Gedanken",
        "why": "auch nahe"
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
