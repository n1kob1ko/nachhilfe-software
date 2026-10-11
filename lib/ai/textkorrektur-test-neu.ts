/**
 * The second independent set of the Textkorrektur-Test (lib/ai/textkorrektur-test.ts, „Test mit neuen Texten“),
 * written on 2026-10-11 after the fixes the first independent set (textkorrektur-test-unabhaengig.ts) led to, by
 * a writer who saw neither the code nor the earlier texts: 14 synthetic student texts (no real student text)
 * from Volksschule to Matura, German and English, with built-in errors, correct places a careless correction
 * would change, and places where either version is acceptable or experts disagree (neutral).
 *
 * Held out: these texts only measure. Prompts, rules, checks and the name lists are never changed to fit them;
 * a text that was used to improve the correction belongs in textkorrektur-test-faelle.ts, and this set gets
 * new texts.
 *
 * The key was written first and checked by two independent proofreadings that did not see it; where they
 * disagreed with it, the place was decided by the rules or marked neutral. Same format as
 * textkorrektur-test-faelle.ts: para counts every block from 1, headings included; `wrong` occurs once in its
 * paragraph; `right` are replacements of exactly `wrong`.
 */
import type { KorrekturFall } from "./textkorrektur-test-faelle";

export const NEW_CASES: KorrekturFall[] = [
  {
    "nr": "U01",
    "title": "Der Riesenkürbis",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 2,
    "textKind": "Erlebniserzählung",
    "task": "Schreibe eine Erlebniserzählung über einen besonderen Tag mit deiner Familie oder mit Freunden. Erzähle der Reihe nach und finde eine passende Überschrift.",
    "blocks": [
      {
        "text": "Der Riesenkürbis",
        "heading": true
      },
      {
        "text": "Am Samstag war ich mit meinem Freund Emre bei Opa Wendelin im garten. Opa hat gesagt: „Emre, heute holen wir den Riesenkürbis!“ Der Kürbis war schwerer wie ich.",
        "heading": false
      },
      {
        "text": "Wir haben gezogen und gezogen. Dan ist der Stiel abgebrochen und Emre ist ins Beet gefallen. er war ganz schmutzig und hat laut gelacht. Opa hat die Scheibtruhe geholt. Zu dritt haben wir den Kürbis hinein gerollt.",
        "heading": false
      },
      {
        "text": "Am Abend hat Oma eine Kürbissuppe gekocht. Die suppe war heiß und hat sehr gut geschmekt. Emre hat drei Teller gegessen. Ich habe nur zwei geschaft, weil ich so müde war. Das war ein toller Tag!",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "garten",
        "right": [
          "Garten"
        ],
        "category": "rechtschreibung",
        "what": "Nomen schreibt man groß: „Garten“."
      },
      {
        "para": 2,
        "wrong": "schwerer wie",
        "right": [
          "schwerer als"
        ],
        "category": "grammatik",
        "what": "Nach einer Vergleichsform mit „-er“ (schwerer, größer) steht „als“, nicht „wie“."
      },
      {
        "para": 3,
        "wrong": "Dan",
        "right": [
          "Dann"
        ],
        "category": "rechtschreibung",
        "what": "„Dann“ schreibt man mit zwei n."
      },
      {
        "para": 3,
        "wrong": "er war",
        "right": [
          "Er war"
        ],
        "category": "rechtschreibung",
        "what": "Am Satzanfang schreibt man groß."
      },
      {
        "para": 3,
        "wrong": "hinein gerollt",
        "right": [
          "hineingerollt"
        ],
        "category": "rechtschreibung",
        "what": "„hineinrollen“ ist ein zusammengesetztes Verb und wird zusammengeschrieben: „hineingerollt“."
      },
      {
        "para": 4,
        "wrong": "Die suppe",
        "right": [
          "Die Suppe"
        ],
        "category": "rechtschreibung",
        "what": "Nomen schreibt man groß: „Suppe“."
      },
      {
        "para": 4,
        "wrong": "geschmekt",
        "right": [
          "geschmeckt"
        ],
        "category": "rechtschreibung",
        "what": "„schmecken“ schreibt man mit „ck“, also „geschmeckt“."
      },
      {
        "para": 4,
        "wrong": "geschaft",
        "right": [
          "geschafft"
        ],
        "category": "rechtschreibung",
        "what": "„schaffen“ hat „ff“, also „geschafft“."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "„Emre, heute holen wir den Riesenkürbis!“",
        "why": "Wörtliche Rede mit Doppelpunkt davor, Anführungszeichen und Komma nach der Anrede „Emre“ ist richtig."
      },
      {
        "para": 3,
        "text": "Scheibtruhe",
        "why": "Österreichisches Wort für Schubkarre, richtig geschrieben."
      },
      {
        "para": 3,
        "text": "Zu dritt",
        "why": "„zu dritt“ wird kleingeschrieben; hier steht „Zu“ nur wegen des Satzanfangs groß."
      },
      {
        "para": 4,
        "text": "weil ich so müde war",
        "why": "Der Nebensatz mit „weil“ ist richtig mit Komma abgetrennt."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "abgebrochen und Emre",
        "why": "Zwischen zwei mit „und“ verbundenen Hauptsätzen ist das Komma freigestellt; mit und ohne Komma richtig."
      }
    ]
  },
  {
    "nr": "U02",
    "title": "Der Turm aus Schachteln",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 3,
    "textKind": "Bildgeschichte",
    "task": "Schau dir die vier Bilder genau an und schreibe dazu eine Bildgeschichte. Erzähle im Präteritum und finde eine passende Überschrift.",
    "pictures": [
      "Malik und Yasmin bauen im Hof einen hohen Turm aus Schachteln.",
      "Der Hund von Frau Sommer läuft mit wedelndem Schwanz auf den Turm zu.",
      "Der Turm stürzt um und der Hund versteckt sich in einer Schachtel.",
      "Alle bauen gemeinsam aus den Schachteln ein Hundehaus."
    ],
    "blocks": [
      {
        "text": "Der Turm aus Schachteln",
        "heading": true
      },
      {
        "text": "Es war ein heißer Tag im Sommer. Malik und seine Schwester Yasmin langweilten sich im Hof. Da hatte Malik eine Idee: „Wir bauen einen Turm aus Schachteln!“ Sie stapelten eine Schachtel auf die andere. Bald war der Turm größer als Malik.",
        "heading": false
      },
      {
        "text": "Plözlich kam der Hund der Nachbarin um die Ecke. Er wedelte mit dem Schwanz und lauft direkt auf den Turm zu. Yasmin schrie „Halt, stopp!“ Aber es war zu spät. Der Turm fiel um und die Schachteln lagen im ganzen hof. Der Hund versteckt sich in der größten Schachtel.",
        "heading": false
      },
      {
        "text": "Malik war zuerst wütend, doch dann muste er lachen. Die Nachbarin kam aus dem Haus und sagte: „Tut mir leid, er wollte nur mitspielen.“ Malik war froh, das der Hund nicht verletzt war. Gemeinsam bauten alle aus den Schachteln ein Hundehaus. Yasmin gab ihn eine alte Decke. Malik streichelte ihm über den Kopf und der Hund legte sich gleich hinein. Seitdem kommt der Hund jeden Nachmittag zu den beiden.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "Plözlich",
        "right": [
          "Plötzlich"
        ],
        "category": "rechtschreibung",
        "what": "„plötzlich“ schreibt man mit „tz“."
      },
      {
        "para": 3,
        "wrong": "lauft",
        "right": [
          "lief"
        ],
        "category": "grammatik",
        "what": "Die Geschichte steht im Präteritum, deshalb heißt es „lief“ und nicht „lauft“ (umgangssprachliches Präsens)."
      },
      {
        "para": 3,
        "wrong": "schrie „Halt",
        "right": [
          "schrie: „Halt"
        ],
        "category": "zeichensetzung",
        "what": "Steht der Begleitsatz vor der wörtlichen Rede, folgt ein Doppelpunkt."
      },
      {
        "para": 3,
        "wrong": "ganzen hof",
        "right": [
          "ganzen Hof"
        ],
        "category": "rechtschreibung",
        "what": "Nomen schreibt man groß: „Hof“."
      },
      {
        "para": 3,
        "wrong": "versteckt sich",
        "right": [
          "versteckte sich"
        ],
        "category": "grammatik",
        "what": "Die Zeitform muss gleich bleiben: Präteritum „versteckte“ statt Präsens „versteckt“."
      },
      {
        "para": 4,
        "wrong": "muste",
        "right": [
          "musste"
        ],
        "category": "rechtschreibung",
        "what": "„musste“ schreibt man mit „ss“."
      },
      {
        "para": 4,
        "wrong": "das der",
        "right": [
          "dass der"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ leitet hier einen Nebensatz ein; man kann sie nicht durch „dieses“ oder „welches“ ersetzen, daher „ss“."
      },
      {
        "para": 4,
        "wrong": "ihn eine",
        "right": [
          "ihm eine"
        ],
        "category": "grammatik",
        "what": "Nach „geben“ steht die Person, die etwas bekommt, im Dativ: „ihm“."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "größer als Malik",
        "why": "Nach der Vergleichsform „größer“ steht richtig „als“; kein Komma, weil kein Nebensatz folgt."
      },
      {
        "para": 2,
        "text": "Da hatte Malik eine Idee: „Wir bauen einen Turm aus Schachteln!“",
        "why": "Wörtliche Rede richtig mit Doppelpunkt und Ausrufezeichen innerhalb der Anführungszeichen."
      },
      {
        "para": 4,
        "text": "wütend, doch dann",
        "why": "Vor „doch“ zwischen zwei Hauptsätzen steht ein Komma."
      },
      {
        "para": 4,
        "text": "„Tut mir leid, er wollte nur mitspielen.“",
        "why": "In „es tut mir leid“ wird „leid“ kleingeschrieben (leidtun)."
      },
      {
        "para": 4,
        "text": "streichelte ihm über den Kopf",
        "why": "Bei Körperteilen steht die Person im Dativ: jemandem über den Kopf streicheln."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "Seitdem kommt",
        "why": "Das Präsens ist möglich, weil der Zustand bis heute andauert; „Seitdem kam“ wäre ebenfalls richtig."
      }
    ]
  },
  {
    "nr": "U03",
    "title": "Ein Samstag am Bauernmarkt",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 4,
    "textKind": "Erlebniserzählung",
    "task": "Schreibe eine Erlebniserzählung zum Thema „Ich durfte helfen“. Erzähle in der Vergangenheit und baue wörtliche Rede ein.",
    "blocks": [
      {
        "text": "Ein Samstag am Bauernmarkt",
        "heading": true
      },
      {
        "text": "In den Herbstferien durfte ich meiner Tante Rosa am Bauernmarkt helfen. Sie hat zwölf Bienenvölker und verkauft jeden Samstag ihren Honig. Schon in der Früh luden wir die Gläser ins Auto. Tante Rosa band sich eine rosa Schürze um und ich bekam ein Namensschild.",
        "heading": false
      },
      {
        "text": "Am Anfang war ich ziemlich nervös, weil ich noch nie etwas verkauft hatte. Ich zitterte richtig als die erste Kundin kam. Es war Frau Kovačević aus unserer Straße. Sie fragte: „Welcher Honig passt am besten zum Tee?“ Ich wuste es nicht und schaute zu meiner Tante. Sie zwinkerte mir zu und flüsterte: „Der Waldhonig.“ Frau Kovačević kaufte gleich zwei Gläser.",
        "heading": false
      },
      {
        "text": "Danach ging es immer besser. Beim einpacken half mir ein Bub von nebenan der Lukas heißt. Er erzählte mir, das sein Opa auch Imker ist. Mit ihm hatte ich viel spaß. Zu Mittag kauft uns Tante Rosa zur Belohnung zwei Langos.",
        "heading": false
      },
      {
        "text": "Am Nachmittag war der Stand leer und meine Füße taten weh. Am Heimweg sagte Tante Rosa: „Nächstes Jahr bist du wieder dabei“. Ich war stolz und müde zugleich.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "richtig als",
        "right": [
          "richtig, als"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „als“ wird mit einem Komma abgetrennt."
      },
      {
        "para": 3,
        "wrong": "wuste",
        "right": [
          "wusste"
        ],
        "category": "rechtschreibung",
        "what": "„wusste“ schreibt man mit „ss“."
      },
      {
        "para": 4,
        "wrong": "Beim einpacken",
        "right": [
          "Beim Einpacken"
        ],
        "category": "rechtschreibung",
        "what": "Nach „beim“ wird das Verb zum Nomen und großgeschrieben: „beim Einpacken“."
      },
      {
        "para": 4,
        "wrong": "nebenan der",
        "right": [
          "nebenan, der"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz „der Lukas heißt“ wird mit einem Komma abgetrennt."
      },
      {
        "para": 4,
        "wrong": "das sein",
        "right": [
          "dass sein"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ leitet den Nebensatz ein und wird mit „ss“ geschrieben."
      },
      {
        "para": 4,
        "wrong": "viel spaß",
        "right": [
          "viel Spaß"
        ],
        "category": "rechtschreibung",
        "what": "„Spaß“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "kauft uns",
        "right": [
          "kaufte uns"
        ],
        "category": "grammatik",
        "what": "Die Erzählung steht in der Vergangenheit, daher Präteritum „kaufte“ statt Präsens „kauft“."
      },
      {
        "para": 5,
        "wrong": "dabei“.",
        "right": [
          "dabei.“"
        ],
        "category": "zeichensetzung",
        "what": "Der Schlusspunkt der wörtlichen Rede steht vor dem schließenden Anführungszeichen; danach kommt kein weiterer Punkt."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "am Bauernmarkt",
        "why": "In Österreich ist „am Markt“ (= auf dem Markt) richtig."
      },
      {
        "para": 2,
        "text": "Sie hat zwölf Bienenvölker und verkauft jeden Samstag ihren Honig.",
        "why": "Das Präsens ist richtig, weil es um etwas geht, das immer noch gilt."
      },
      {
        "para": 2,
        "text": "in der Früh",
        "why": "Österreichische Standardform für „am Morgen“."
      },
      {
        "para": 2,
        "text": "eine rosa Schürze",
        "why": "Die Farbe „rosa“ wird kleingeschrieben und nicht gebeugt; „Rosa“ ist dagegen der Name der Tante."
      },
      {
        "para": 3,
        "text": "noch nie etwas verkauft hatte",
        "why": "Richtiges Plusquamperfekt für etwas, das vor der Erzählzeit liegt."
      },
      {
        "para": 4,
        "text": "Bub",
        "why": "Österreichisches Wort für Junge, richtig."
      },
      {
        "para": 5,
        "text": "Am Heimweg",
        "why": "In Österreich ist „am Heimweg“ (= auf dem Heimweg) richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "Schürze um und ich",
        "why": "Komma zwischen zwei mit „und“ verbundenen Hauptsätzen ist freigestellt."
      },
      {
        "para": 5,
        "text": "leer und meine",
        "why": "Komma zwischen zwei mit „und“ verbundenen Hauptsätzen ist freigestellt."
      }
    ]
  },
  {
    "nr": "U04",
    "title": "Erstes Reparaturcafé an unserer Schule",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 2,
    "textKind": "Bericht",
    "task": "Schreibe für die Schulzeitung einen Bericht über eine Veranstaltung an deiner Schule. Beantworte die W-Fragen und schreibe sachlich im Präteritum.",
    "blocks": [
      {
        "text": "Erstes Reparaturcafé an unserer Schule",
        "heading": true
      },
      {
        "text": "Am Freitag, dem 14. März, fand im Werkraum unserer Schule das erste Reparaturcafé statt. Organisiert hatten es die Klassen 2a und 2b gemeinsam mit dem Elternverein. Zwischen 14 und 17 Uhr konnten Schülerinnen, Schüler und Eltern kaputte Geräte vorbei bringen.",
        "heading": false
      },
      {
        "text": "Geleitet wurde die Veranstaltung von Herrn Gottfried Koch einem pensionierten Elektriker aus unserer Gemeinde. Er kam mit seinen Werkzeugkoffer und zeigte uns, wie man einen Stecker richtig anschließt. Insgesamt wurden 23 Gegenstände repariert, darunter fünf Fahrräder, drei Toaster und eine Nähmaschine. Sogar der Koch unserer Schulküche brachte einen Mixer der nicht mehr funktionierte.",
        "heading": false
      },
      {
        "text": "Beim Fahrradstand gab es den größten Andrang. Ilinca Popescu aus der 2b stellt dort Bremsen ein und ölte Ketten. Sie sagte das sie dabei viel neues gelernt habe. Um 16 Uhr fiel plötzlich der Strom aus, weil zu viele Geräte gleichzeitig angesteckt waren. Nach zehn Minuten funktionierte alles wieder und die Stimmung war voll super.",
        "heading": false
      },
      {
        "text": "Wegen des großen Erfolgs soll das Reparaturcafé ab heuer jedes Semester stattfinden. Die Spenden von 340 Euro gehen an das Tierheim im Ort.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "vorbei bringen",
        "right": [
          "vorbeibringen"
        ],
        "category": "rechtschreibung",
        "what": "„vorbeibringen“ ist ein zusammengesetztes Verb und wird im Infinitiv zusammengeschrieben."
      },
      {
        "para": 3,
        "wrong": "Koch einem",
        "right": [
          "Koch, einem"
        ],
        "category": "zeichensetzung",
        "what": "Die nachgestellte Erklärung (Apposition) „einem pensionierten Elektriker …“ wird mit Komma abgetrennt."
      },
      {
        "para": 3,
        "wrong": "seinen Werkzeugkoffer",
        "right": [
          "seinem Werkzeugkoffer"
        ],
        "category": "grammatik",
        "what": "Nach „mit“ steht der Dativ: „mit seinem Werkzeugkoffer“."
      },
      {
        "para": 3,
        "wrong": "Mixer der",
        "right": [
          "Mixer, der"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz „der nicht mehr funktionierte“ wird mit Komma abgetrennt."
      },
      {
        "para": 4,
        "wrong": "stellt dort",
        "right": [
          "stellte dort"
        ],
        "category": "grammatik",
        "what": "Ein Bericht steht im Präteritum, daher „stellte“ statt „stellt“."
      },
      {
        "para": 4,
        "wrong": "sagte das",
        "right": [
          "sagte, dass"
        ],
        "category": "rechtschreibung",
        "what": "Der Nebensatz wird mit der Konjunktion „dass“ (mit ss) eingeleitet und mit Komma abgetrennt."
      },
      {
        "para": 4,
        "wrong": "viel neues",
        "right": [
          "viel Neues"
        ],
        "category": "rechtschreibung",
        "what": "Nach „viel, etwas, nichts“ werden Adjektive zu Nomen und großgeschrieben: „viel Neues“."
      },
      {
        "para": 4,
        "wrong": "voll super",
        "right": [
          "sehr gut",
          "ausgezeichnet"
        ],
        "category": "ausdruck",
        "what": "Ein Bericht ist sachlich; umgangssprachliche Ausdrücke wie „voll super“ passen nicht."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "Geleitet wurde die Veranstaltung",
        "why": "Richtiges Passiv mit vorangestelltem Partizip."
      },
      {
        "para": 3,
        "text": "darunter fünf Fahrräder, drei Toaster und eine Nähmaschine",
        "why": "Aufzählung richtig mit Kommas, vor „und“ kein Komma."
      },
      {
        "para": 3,
        "text": "der Koch unserer Schulküche",
        "why": "Hier ist „Koch“ eine Berufsbezeichnung (kein Name) und als Nomen richtig großgeschrieben."
      },
      {
        "para": 4,
        "text": "gelernt habe",
        "why": "Richtiger Konjunktiv I in der indirekten Rede."
      },
      {
        "para": 4,
        "text": "angesteckt",
        "why": "Österreichisch für „eingesteckt“ (Stecker in die Steckdose), richtig."
      },
      {
        "para": 5,
        "text": "Wegen des großen Erfolgs",
        "why": "Nach „wegen“ steht richtig der Genitiv."
      },
      {
        "para": 5,
        "text": "heuer",
        "why": "Österreichische Standardform für „in diesem Jahr“."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "dem 14. März",
        "why": "„am Freitag, dem 14. März,“ (Dativ, mit zwei Kommas) und „am Freitag, den 14. März“ (Akkusativ) sind beide richtig."
      }
    ]
  },
  {
    "nr": "U05",
    "title": "Alpaka sorgt für Aufregung vor der Schule",
    "subject": "Deutsch",
    "schoolType": "AHS",
    "klasse": 1,
    "textKind": "Bericht",
    "task": "Schreibe einen Bericht über einen ungewöhnlichen Vorfall in deiner Umgebung. Achte auf die W-Fragen, die richtige Reihenfolge und eine sachliche Sprache.",
    "blocks": [
      {
        "text": "Alpaka sorgt für Aufregung vor der Schule",
        "heading": true
      },
      {
        "text": "Am Dienstag, dem 7. Oktober, lief gegen 7.40 Uhr ein Alpaka über die Kreuzung vor unserer Schule. Das Tier war in der Nacht aus einem Gehege am Ortsrand ausgebrochen. Mehrere Autos mussten stark bremsen, verletzt wurde aber niemand.",
        "heading": false
      },
      {
        "text": "Als Erster bemerkte Taras Melnyk aus der 1c das Tier. Er erzählte später, dass er es zuerst für ein großes Lamm gehalten habe. Dann rufte er sofort unseren Schulwart. Dieser sperrte gemeinsam mit zwei Lehrerinnen den Gehsteig ab damit keine Kinder in die Nähe kamen. Viele blieben trotzdem stehen und waren mit dem fotografieren beschäftigt.",
        "heading": false
      },
      {
        "text": "Um 8.05 Uhr trifft die Polizei ein. Kurz danach kam die Besitzerin Margarete Lamm, die das Tier mit einem Kübel Karotten anlockte. Das funktionierte super gut. Nach wenigen Minuten konnte sie dem Alpaka entlich ein Halfter anlegen. Frau Lamm entschuldigte sich und meinte das Tor ihres Geheges sei nicht richtig verschlossen gewesen.",
        "heading": false
      },
      {
        "text": "Der Unterricht begann deshalb für viele Klassen erst um 8.30 Uhr. Die Direktorin betonte, das so etwas noch nie passiert sei.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "rufte",
        "right": [
          "rief"
        ],
        "category": "grammatik",
        "what": "„rufen“ ist ein starkes Verb, das Präteritum heißt „rief“."
      },
      {
        "para": 3,
        "wrong": "ab damit",
        "right": [
          "ab, damit"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „damit“ wird mit Komma abgetrennt."
      },
      {
        "para": 3,
        "wrong": "dem fotografieren",
        "right": [
          "dem Fotografieren"
        ],
        "category": "rechtschreibung",
        "what": "Nach einem Artikel („mit dem“) wird das Verb zum Nomen und großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "trifft",
        "right": [
          "traf"
        ],
        "category": "grammatik",
        "what": "Ein Bericht steht im Präteritum, daher „traf“ statt „trifft“."
      },
      {
        "para": 4,
        "wrong": "super gut",
        "right": [
          "sehr gut",
          "problemlos"
        ],
        "category": "ausdruck",
        "what": "„super gut“ ist umgangssprachlich und passt nicht in einen sachlichen Bericht."
      },
      {
        "para": 4,
        "wrong": "entlich",
        "right": [
          "endlich"
        ],
        "category": "rechtschreibung",
        "what": "„endlich“ kommt von „Ende“ und wird mit „d“ geschrieben."
      },
      {
        "para": 4,
        "wrong": "meinte das",
        "right": [
          "meinte, das"
        ],
        "category": "zeichensetzung",
        "what": "Die indirekte Rede ohne Einleitewort ist ein Nebensatz und wird mit Komma abgetrennt; „das“ ist hier richtig, weil es der Artikel zu „Tor“ ist."
      },
      {
        "para": 5,
        "wrong": "das so",
        "right": [
          "dass so"
        ],
        "category": "rechtschreibung",
        "what": "Hier leitet die Konjunktion „dass“ den Nebensatz ein, daher mit „ss“."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "verletzt wurde aber niemand",
        "why": "Richtiges Passiv; das Komma trennt zwei Hauptsätze."
      },
      {
        "para": 3,
        "text": "Als Erster",
        "why": "„als Erster“ wird großgeschrieben, weil die Ordnungszahl als Nomen gebraucht wird."
      },
      {
        "para": 3,
        "text": "für ein großes Lamm gehalten habe",
        "why": "Richtiger Konjunktiv I in der indirekten Rede; „Lamm“ ist hier das Tier, nicht der Name."
      },
      {
        "para": 4,
        "text": "die Besitzerin Margarete Lamm, die",
        "why": "Enge Apposition (Besitzerin + Name) ohne Komma; der folgende Relativsatz ist richtig mit Komma abgetrennt."
      },
      {
        "para": 4,
        "text": "Kübel",
        "why": "Österreichisches Wort für Eimer, richtig."
      },
      {
        "para": 4,
        "text": "sei nicht richtig verschlossen gewesen",
        "why": "Richtiger Konjunktiv I der Vergangenheit in der indirekten Rede."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "7.40 Uhr",
        "why": "Uhrzeiten dürfen mit Punkt (7.40 Uhr) oder mit Doppelpunkt (7:40 Uhr) geschrieben werden."
      }
    ]
  },
  {
    "nr": "U06",
    "title": "Beschwerde über die Buslinie 47",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 3,
    "textKind": "Beschwerdebrief",
    "task": "Schreibe einen Beschwerdebrief an ein Unternehmen oder eine Einrichtung. Achte auf die äußere Form (Absender, Empfänger, Datum, Betreff, Anrede, Grußformel) und auf eine höfliche, sachliche Sprache.",
    "blocks": [
      {
        "text": "Beschwerde über die Buslinie 47",
        "heading": true
      },
      {
        "text": "Nikola Petrović, Ahornweg 5, 8999 Kleinhofen",
        "heading": false
      },
      {
        "text": "Verkehrsbetrieb Kleinhofen, Kundenservice, z. H. Frau Mag. Hannelore Winter, Bahnhofplatz 2, 8999 Kleinhofen",
        "heading": false
      },
      {
        "text": "Kleinhofen, 3. Februar 2026",
        "heading": false
      },
      {
        "text": "Sehr geehrte Frau Mag. Winter,",
        "heading": false
      },
      {
        "text": "Ich schreibe Ihnen, weil der Schulbus der Linie 47 seit Anfang Jänner fast jeden Tag zu früh von der Haltestelle Marktplatz abfährt. Laut Fahrplan sollte er um 7.12 Uhr abfahren, er fährt aber oft schon um 7.08 Uhr weg. Am Freitag bin ich bereits um 7.05 Uhr zur Haltestelle gegangen um den Bus nicht zu verpassen. Trotzdem war er schon weg. Letzten Montag sind meine Schulkollegin Adaeze Okafor und ich deshalb zu spät zur Schularbeit gekommen.",
        "heading": false
      },
      {
        "text": "Gerade im Winter ist es sehr unangenehm wenn man zwanzig Minuten in der Kälte auf den nächsten Bus warten muss. Außerdem hab ich bemerkt, das der Fahrer oft während der Fahrt telefoniert. Das finde ich echt arg gefährlich.",
        "heading": false
      },
      {
        "text": "Ich bitte sie daher, den Fahrer auf den Fahrplan hinzuweisen. Ich würde mich freuen wenn Sie mir bis Ende Februar antworten könnten. Danke im Voraus für Ihre Bemühungen.",
        "heading": false
      },
      {
        "text": "Mit freundlichen Grüßen,",
        "heading": false
      },
      {
        "text": "Nikola Petrović",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 6,
        "wrong": "Ich schreibe",
        "right": [
          "ich schreibe"
        ],
        "category": "rechtschreibung",
        "what": "Nach der Anrede mit Komma beginnt der Brieftext mit einem Kleinbuchstaben (außer bei Nomen und der Höflichkeitsform)."
      },
      {
        "para": 6,
        "wrong": "gegangen um",
        "right": [
          "gegangen, um"
        ],
        "category": "zeichensetzung",
        "what": "Infinitivgruppen mit „um … zu“ werden immer mit Komma abgetrennt."
      },
      {
        "para": 7,
        "wrong": "unangenehm wenn",
        "right": [
          "unangenehm, wenn"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „wenn“ wird mit Komma abgetrennt."
      },
      {
        "para": 7,
        "wrong": "hab ich",
        "right": [
          "habe ich"
        ],
        "category": "ausdruck",
        "what": "In einem formellen Brief verwendet man „habe“ statt der umgangssprachlichen Kurzform „hab“."
      },
      {
        "para": 7,
        "wrong": "das der",
        "right": [
          "dass der"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ leitet den Nebensatz ein und wird mit „ss“ geschrieben."
      },
      {
        "para": 7,
        "wrong": "echt arg gefährlich",
        "right": [
          "sehr gefährlich",
          "äußerst gefährlich"
        ],
        "category": "ausdruck",
        "what": "„echt arg“ ist Umgangssprache und passt nicht in einen sachlichen Beschwerdebrief."
      },
      {
        "para": 8,
        "wrong": "bitte sie",
        "right": [
          "bitte Sie"
        ],
        "category": "rechtschreibung",
        "what": "Die höfliche Anrede „Sie“ wird immer großgeschrieben."
      },
      {
        "para": 8,
        "wrong": "freuen wenn",
        "right": [
          "freuen, wenn"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „wenn“ wird mit Komma abgetrennt."
      },
      {
        "para": 9,
        "wrong": "Grüßen,",
        "right": [
          "Grüßen"
        ],
        "category": "zeichensetzung",
        "what": "Nach der Grußformel am Briefende steht kein Komma."
      }
    ],
    "correct": [
      {
        "para": 5,
        "text": "Sehr geehrte Frau Mag. Winter,",
        "why": "Richtige Anrede mit Titel und Komma am Ende."
      },
      {
        "para": 6,
        "text": "seit Anfang Jänner",
        "why": "„seit“ (zeitlich) mit „t“ und die österreichische Monatsbezeichnung „Jänner“ sind richtig."
      },
      {
        "para": 6,
        "text": "sollte er um 7.12 Uhr abfahren, er fährt aber",
        "why": "Das Komma trennt zwei Hauptsätze richtig."
      },
      {
        "para": 6,
        "text": "Schulkollegin",
        "why": "Österreichisch für Mitschülerin, richtig."
      },
      {
        "para": 7,
        "text": "Gerade im Winter",
        "why": "Hier ist „Winter“ die Jahreszeit (kein Name) und als Nomen großgeschrieben."
      },
      {
        "para": 8,
        "text": "antworten könnten",
        "why": "Richtiger höflicher Konjunktiv II."
      },
      {
        "para": 8,
        "text": "Danke im Voraus",
        "why": "„im Voraus“ wird großgeschrieben und mit einem r."
      },
      {
        "para": 8,
        "text": "Ihre Bemühungen",
        "why": "Das Höflichkeitspronomen „Ihre“ ist richtig großgeschrieben."
      }
    ],
    "neutral": [
      {
        "para": 8,
        "text": "daher, den Fahrer",
        "why": "Bei dieser Infinitivgruppe ohne „um/ohne/statt“ und ohne Verweiswort ist das Komma freigestellt."
      }
    ]
  },
  {
    "nr": "U07",
    "title": "Sollen Schülerinnen und Schüler ihre Lehrkräfte bewerten dürfen?",
    "subject": "Deutsch",
    "schoolType": "AHS",
    "klasse": 4,
    "textKind": "Erörterung",
    "task": "Verfasse eine Erörterung zum Thema: Sollen Schülerinnen und Schüler ihre Lehrkräfte bewerten dürfen? Wäge Argumente dafür und dagegen ab und komme zu einem begründeten Schluss.",
    "blocks": [
      {
        "text": "Sollen Schülerinnen und Schüler ihre Lehrkräfte bewerten dürfen?",
        "heading": true
      },
      {
        "text": "An vielen Schulen wird darüber diskutiert, ob Schülerinnen und Schüler ihren Lehrerinnen und Lehrern regelmäßig Feedback geben sollen. Meine Cousine Ilvy besucht ein Gymnasium in Salzburg, wo das schon seid zwei Jahren üblich ist. Im Folgenden möchte ich Argumente dafür und dagegen abwägen.",
        "heading": false
      },
      {
        "text": "Für eine Bewertung spricht vor allem, dass Lehrkräfte so erfahren, wie ihr Unterricht ankommt. Viele Schüler trauen sich nicht etwas direkt zu sagen, obwohl sie Angst vor schlechten Noten haben. Ein anonymer Fragebogen, den alle online ausfüllen könnten würde dieses Problem lösen. In der Klasse meiner Cousine erklärt die Englischlehrerin seither die Hausübungen genauer, weil sich viele darüber beschwert haben. Außerdem lernen Jugendliche dabei, Kritik sachlich und höflich zu formulieren, was auch im späteren Berufsleben wichtig ist.",
        "heading": false
      },
      {
        "text": "Andererseits gibt es auch Gründe die gegen eine solche Bewertung sprechen. Manche Schüler könnten die Bewertung nutzen um sich an strengen Lehrern zu rächen. Außerdem sind nicht alle Jugendlichen reif genug, um faire Kritik zu üben. Unser Mathematikprofessor Herr Ernst meinte einmal, ein Fragebogen sei „nur so gut wie die Ehrlichkeit derer, die ihn ausfüllen“. Dazu kommt das die Auswertung viel Zeit kostet, die dann beim unterrichten fehlt.",
        "heading": false
      },
      {
        "text": "Zusammenfassend bin ich der Meinung, dass die Vorteile überwiegen, wenn die Bewertung anonym erfolgt und die Fragen gut überlegt sind. Wenn Lehrkräfte die Rückmeldungen ernst nehmen, kann der Unterricht für alle besser werden. Einmal pro Semester ist meiner Meinung nach voll ausreichend.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "seid",
        "right": [
          "seit"
        ],
        "category": "rechtschreibung",
        "what": "Die Zeitangabe „seit“ schreibt man mit „t“; „seid“ ist eine Form des Verbs „sein“."
      },
      {
        "para": 3,
        "wrong": "obwohl",
        "right": [
          "weil",
          "da"
        ],
        "category": "ausdruck",
        "what": "„obwohl“ leitet einen Gegengrund ein; hier wird aber der Grund genannt, daher „weil“."
      },
      {
        "para": 3,
        "wrong": "könnten würde",
        "right": [
          "könnten, würde"
        ],
        "category": "zeichensetzung",
        "what": "Ein eingeschobener Relativsatz wird auch an seinem Ende mit Komma abgeschlossen."
      },
      {
        "para": 4,
        "wrong": "Gründe die",
        "right": [
          "Gründe, die"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz „die gegen … sprechen“ wird mit Komma abgetrennt."
      },
      {
        "para": 4,
        "wrong": "nutzen um",
        "right": [
          "nutzen, um"
        ],
        "category": "zeichensetzung",
        "what": "Infinitivgruppen mit „um … zu“ werden immer mit Komma abgetrennt."
      },
      {
        "para": 4,
        "wrong": "Dazu kommt das",
        "right": [
          "Dazu kommt, dass"
        ],
        "category": "rechtschreibung",
        "what": "Hier folgt ein Nebensatz mit der Konjunktion „dass“ (ss), der mit Komma abgetrennt wird."
      },
      {
        "para": 4,
        "wrong": "beim unterrichten",
        "right": [
          "beim Unterrichten"
        ],
        "category": "rechtschreibung",
        "what": "Nach „beim“ wird das Verb zum Nomen und großgeschrieben."
      },
      {
        "para": 5,
        "wrong": "voll ausreichend",
        "right": [
          "völlig ausreichend",
          "ausreichend"
        ],
        "category": "ausdruck",
        "what": "„voll“ als Verstärkung ist Jugendsprache und passt nicht in eine Erörterung."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Im Folgenden",
        "why": "„im Folgenden“ wird großgeschrieben, weil „Folgenden“ hier ein Nomen ist."
      },
      {
        "para": 3,
        "text": "Hausübungen",
        "why": "Österreichisch für Hausaufgaben, richtig."
      },
      {
        "para": 3,
        "text": "was auch im späteren Berufsleben wichtig ist",
        "why": "Das Relativpronomen „was“ bezieht sich richtig auf den ganzen vorangehenden Satzteil."
      },
      {
        "para": 4,
        "text": "reif genug, um faire Kritik zu üben",
        "why": "Die Infinitivgruppe mit „um … zu“ ist richtig mit Komma abgetrennt."
      },
      {
        "para": 4,
        "text": "Unser Mathematikprofessor Herr Ernst meinte",
        "why": "Enge Apposition ohne Kommas; „Ernst“ ist hier ein Name."
      },
      {
        "para": 4,
        "text": "ein Fragebogen sei „nur so gut wie die Ehrlichkeit derer, die ihn ausfüllen“.",
        "why": "Konjunktiv I, kein Komma vor dem bloßen Vergleich mit „wie“, Schlusspunkt richtig nach dem eingebetteten Zitat."
      },
      {
        "para": 5,
        "text": "ernst nehmen",
        "why": "Das Adjektiv „ernst“ (nicht der Name) wird klein- und getrennt geschrieben."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "trauen sich nicht etwas direkt zu sagen",
        "why": "Das Komma vor dieser Infinitivgruppe ist freigestellt („trauen sich nicht, etwas …“ ist ebenso richtig)."
      }
    ]
  },
  {
    "nr": "U08",
    "title": "Analyse: „Der Lärm der Ordnung“",
    "subject": "Deutsch",
    "schoolType": "AHS",
    "klasse": 6,
    "textKind": "Textanalyse",
    "task": "Analysieren Sie den Kommentar „Der Lärm der Ordnung“ von Hedwig Sturm, erschienen am 4. Oktober 2026 in der Regionalzeitung „Kleinhofner Rundschau“. Gehen Sie auf Aufbau, Argumentation, sprachliche Mittel und Intention ein.",
    "blocks": [
      {
        "text": "Analyse: „Der Lärm der Ordnung“",
        "heading": true
      },
      {
        "text": "Der Kommentar „Der Lärm der Ordnung“ von Hedwig Sturm erschien am 4. Oktober 2026 in der Regionalzeitung „Kleinhofner Rundschau“. Die Autorin kritisiert darin den Einsatz von Laubbläsern im Stadtgebiet und fordert, diese in Wohngebieten zu verbieten. Der Text richtet sich vor allem an Anrainerinnen und Anrainer sowie an die Gemeindepolitik.",
        "heading": false
      },
      {
        "text": "Der Text beginnt mit einer Alltagsszene: Um sieben Uhr früh wird die Autorin von einem Laubbläser geweckt, der „wie ein Düsenjet“ (Z. 3) unter ihrem Fenster dröhnt. Dieser Vergleich soll die Lautstärke veranschaulichen, und den Leser sofort auf ihre Seite ziehen. Danach stellt Sturm die These auf, die Gemeinde halte „Ordnung für wichtiger als Ruhe“ (Z. 12). Diese stützt sie mit Argumenten: Ein Laubbläser sei lauter als ein Rasenmäher und schade Insekten, die im Laub überwintern. Außerdem behauptet sie, die Gemeinde hat das Problem jahrelang ignoriert.",
        "heading": false
      },
      {
        "text": "Im Hauptteil setzt sich die Autorin mit einem Gegenargument auseinander. Die Gemeinderätin Zeynep Aydın wird mit dem Satz zitiert, man könne „nicht jedes Blatt mit der Hand aufheben“ (Z. 18). Sturm antwortet darauf mit Ironie: Dann solle man eben „die Blätter fragen, ob sie aufgehoben werden wollen“ (Z. 20). Dadurch wirkt die Gegenposition lächerlich. Der Ton des Kommentars ist insgesamt eher polemisch, als sachlich. Sturm verwendet rhetorische Mittel wie Hyperbeln, Ironie und rhetorische Fragen, beispielsweise „Wem gehört eigentlich die Stille am Sonntagmorgen?“ (Z. 23).",
        "heading": false
      },
      {
        "text": "Am Schluss formuliert die Autorin einen klaren Appell: „Ruhe ist kein Luxus“. (Z. 27) Wer die Stadt liebe, solle im Herbst einen Rechen statt einer Maschine verwenden. Sturm nennt allerdings kaum Zahlen oder Quellen. Dennoch wirkt ihre Argumentation stellenweise einseitig.",
        "heading": false
      },
      {
        "text": "Insgesamt ist der Kommentar so emotional wie man es von dieser Textsorte erwartet. Der Titel spiegelt den Widerspruch zwischen Sauberkeit und Lärm gut wieder. Mit ihrer Forderung dürfte die Autorin im Gemeinderat einen kleinen Sturm auslösen. Meiner Meinung nach ist der Kommentar trotz dieser Schwäche echt gelungen, weil er zum Nachdenken anregt.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "veranschaulichen, und",
        "right": [
          "veranschaulichen und"
        ],
        "category": "zeichensetzung",
        "what": "Zwischen zwei mit „und“ verbundenen Infinitiven desselben Satzes steht kein Komma."
      },
      {
        "para": 3,
        "wrong": "hat das Problem",
        "right": [
          "habe das Problem"
        ],
        "category": "grammatik",
        "what": "In der indirekten Rede steht der Konjunktiv I: „habe“ statt „hat“."
      },
      {
        "para": 4,
        "wrong": "polemisch, als",
        "right": [
          "polemisch als"
        ],
        "category": "zeichensetzung",
        "what": "Vor „als“ steht bei einem bloßen Vergleich ohne eigenes Verb kein Komma."
      },
      {
        "para": 5,
        "wrong": "Luxus“. (Z. 27)",
        "right": [
          "Luxus“ (Z. 27).",
          "Luxus.“ (Z. 27)"
        ],
        "category": "zeichensetzung",
        "what": "Die Zeilenangabe gehört zum Satz: Der Satzpunkt steht erst nach der Klammer (oder als Zitatpunkt innerhalb der Anführungszeichen)."
      },
      {
        "para": 5,
        "wrong": "Dennoch",
        "right": [
          "Daher",
          "Deshalb"
        ],
        "category": "ausdruck",
        "what": "„Dennoch“ drückt einen Gegensatz aus, gemeint ist aber eine Folge der fehlenden Belege, daher „daher“."
      },
      {
        "para": 6,
        "wrong": "emotional wie man",
        "right": [
          "emotional, wie man"
        ],
        "category": "zeichensetzung",
        "what": "Leitet „wie“ einen Vergleichssatz mit eigenem Verb ein, wird er mit Komma abgetrennt."
      },
      {
        "para": 6,
        "wrong": "gut wieder",
        "right": [
          "gut wider"
        ],
        "category": "rechtschreibung",
        "what": "„widerspiegeln“ (= zurückwerfen, zeigen) schreibt man ohne „ie“: „spiegelt … wider“."
      },
      {
        "para": 6,
        "wrong": "echt gelungen",
        "right": [
          "durchaus gelungen",
          "gelungen"
        ],
        "category": "ausdruck",
        "what": "„echt“ als Verstärkung ist umgangssprachlich und passt nicht in eine Textanalyse."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Anrainerinnen und Anrainer",
        "why": "Österreichisch für Anwohnerinnen und Anwohner, richtig."
      },
      {
        "para": 3,
        "text": "Um sieben Uhr früh wird die Autorin von einem Laubbläser geweckt",
        "why": "Richtiges Passiv; nach dem Doppelpunkt wird ein vollständiger Satz großgeschrieben."
      },
      {
        "para": 3,
        "text": "die Gemeinde halte „Ordnung für wichtiger als Ruhe“ (Z. 12).",
        "why": "Konjunktiv I in der indirekten Rede, korrekt eingebettetes Zitat mit Zeilenangabe vor dem Punkt."
      },
      {
        "para": 3,
        "text": "Ein Laubbläser sei lauter als ein Rasenmäher",
        "why": "Konjunktiv I; vor „als“ steht beim bloßen Vergleich kein Komma."
      },
      {
        "para": 4,
        "text": "man könne „nicht jedes Blatt mit der Hand aufheben“ (Z. 18)",
        "why": "Konjunktiv I mit korrekt eingebautem Zitat."
      },
      {
        "para": 4,
        "text": "„Wem gehört eigentlich die Stille am Sonntagmorgen?“ (Z. 23).",
        "why": "Das Fragezeichen gehört zum Zitat; der Satzpunkt steht nach der Zeilenangabe."
      },
      {
        "para": 5,
        "text": "einen Rechen statt einer Maschine",
        "why": "Kein Komma vor „statt“, weil keine Infinitivgruppe folgt."
      },
      {
        "para": 6,
        "text": "dürfte die Autorin im Gemeinderat einen kleinen Sturm auslösen",
        "why": "„dürfte“ drückt korrekt eine Vermutung aus; „Sturm“ ist hier ein gewöhnliches Nomen, nicht der Name."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "rhetorische Mittel wie Hyperbeln",
        "why": "Vor „wie“, das Beispiele einleitet, ist das Komma freigestellt (als nachgestellter Zusatz auch mit Komma möglich)."
      }
    ]
  },
  {
    "nr": "U09",
    "title": "Textanalyse: Interview mit Kateryna Bondarenko",
    "subject": "Deutsch",
    "schoolType": "HTL",
    "klasse": 3,
    "textKind": "Textanalyse",
    "task": "Analysieren Sie das Interview „Holz ist das Material der Zukunft“, das Leopold Schnell mit der Bauingenieurin Kateryna Bondarenko für das Magazin „Technik & Alltag“ (Ausgabe 5/2026) geführt hat. Gehen Sie auf Gesprächsführung, Argumentation und Sprache ein.",
    "blocks": [
      {
        "text": "Textanalyse: Interview mit Kateryna Bondarenko",
        "heading": true
      },
      {
        "text": "Im Interview „Holz ist das Material der Zukunft“, das in der Ausgabe 5/2026 des Magazins „Technik & Alltag“ erschienen ist, spricht der Journalist Leopold Schnell mit der Bauingenieurin Kateryna Bondarenko über mehrgeschoßige Holzbauten. Bondarenko plant seit zehn Jahren Wohnhäuser aus Holz und vertritt die Meinung, das Holz Beton in vielen Bereichen ersetzen kann.",
        "heading": false
      },
      {
        "text": "Das Interview ist klar gegliedert. Schnell stellt kurze, offene Fragen und lässt seine Gesprächspartnerin ausreden. Auf diese Weise entsteht der Eindruck eines sachlichen Fachgesprächs. Zu Beginn fragt er, warum Holz gerade jetzt so beliebt ist. Bondarenko antwortet, dass Holz CO2 speichere, schnell nachwachse und sich gut vorfertigen lasse. Wegen dem geringen Gewicht könne man außerdem höher bauen.",
        "heading": false
      },
      {
        "text": "Im zweiten Teil wird das Gespräch kritischer. Schnell spricht den Brandschutz an und zitiert einen Feuerwehrkommandanten, der Holzhochhäuser für „brandgefährlich“ hält. Bondarenko weist dies zurück und erklärt, moderne Brettsperrholzwände verkohlen außen und schützen so den Kern. Die wichtigste Vorraussetzung sei allerdings, dass die Planung von Anfang an stimme. Ihre Antworten wirken dabei sehr kompetent, weil sie viele Fachbegriffe verwendet ohne arrogant zu klingen.",
        "heading": false
      },
      {
        "text": "Sprachlich fällt auf, dass Bondarenko oft Vergleiche aus dem Alltag verwendet, zum Beispiel: „Ein Holzhaus funktioniert wie ein Baukasten.“ (Z. 34) Dadurch wird der Text auch für Laien verständlich. Das Einzige was etwas stört, sind die vielen englischen Begriffe wie „Timber Tower“ oder „Hybrid Design“. Holzbau sei in Skandinavien längst Standart, meint Bondarenko am Ende, und die Branche brauche dringend mehr junge Technikerinnen.",
        "heading": false
      },
      {
        "text": "Insgesamt ist das Interview mega informativ und gut strukturiert. Man erhält einen guten Überblick über Chancen und Grenzen des Holzbaus. Schnell lenkt das Gespräch geschickt, auch wenn manche Fragen kritischer sein hätten können. Ziel des Interviews ist es, die Leserinnen und Leser für den Holzbau zu begeistern.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "das Holz",
        "right": [
          "dass Holz"
        ],
        "category": "rechtschreibung",
        "what": "Hier leitet die Konjunktion „dass“ den Nebensatz ein; „das Holz“ als Artikel mit Nomen ergibt an dieser Stelle keinen Satz."
      },
      {
        "para": 3,
        "wrong": "Wegen dem geringen Gewicht",
        "right": [
          "Wegen des geringen Gewichts"
        ],
        "category": "grammatik",
        "what": "In der geschriebenen Standardsprache steht nach „wegen“ der Genitiv; der Dativ ist umgangssprachlich."
      },
      {
        "para": 4,
        "wrong": "verkohlen außen und schützen",
        "right": [
          "verkohlten außen und schützten"
        ],
        "category": "grammatik",
        "optional": true,
        "what": "In der indirekten Rede steht der Konjunktiv; ist der Konjunktiv I gleich dem Indikativ („verkohlen“), weicht man auf den Konjunktiv II aus."
      },
      {
        "para": 4,
        "wrong": "Vorraussetzung",
        "right": [
          "Voraussetzung"
        ],
        "category": "rechtschreibung",
        "what": "„Voraussetzung“ kommt von „voraus“ und hat nur ein r."
      },
      {
        "para": 4,
        "wrong": "verwendet ohne",
        "right": [
          "verwendet, ohne"
        ],
        "category": "zeichensetzung",
        "what": "Infinitivgruppen mit „ohne … zu“ werden immer mit Komma abgetrennt."
      },
      {
        "para": 5,
        "wrong": "Einzige was",
        "right": [
          "Einzige, was"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz mit „was“ wird mit Komma abgetrennt."
      },
      {
        "para": 5,
        "wrong": "Standart",
        "right": [
          "Standard"
        ],
        "category": "rechtschreibung",
        "what": "„Standard“ schreibt man am Ende mit „d“."
      },
      {
        "para": 6,
        "wrong": "mega informativ",
        "right": [
          "sehr informativ",
          "äußerst informativ"
        ],
        "category": "ausdruck",
        "what": "„mega“ ist Jugendsprache und passt nicht in eine Textanalyse."
      },
      {
        "para": 6,
        "wrong": "kritischer sein hätten können",
        "right": [
          "kritischer hätten sein können"
        ],
        "category": "satzbau",
        "what": "Im Nebensatz mit Ersatzinfinitiv steht die finite Verbform „hätten“ vor den beiden Infinitiven: „hätten sein können“."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "mehrgeschoßige",
        "why": "In Österreich wird „Geschoß“ (und damit „mehrgeschoßig“) mit ß geschrieben."
      },
      {
        "para": 3,
        "text": "kurze, offene Fragen",
        "why": "Gleichrangige Adjektive werden durch Komma getrennt."
      },
      {
        "para": 3,
        "text": "dass Holz CO2 speichere, schnell nachwachse und sich gut vorfertigen lasse",
        "why": "Richtiger Konjunktiv I; „schnell“ ist hier ein Adjektiv, nicht der Name des Journalisten."
      },
      {
        "para": 4,
        "text": "für „brandgefährlich“ hält",
        "why": "Korrekt eingebautes Einzelwortzitat."
      },
      {
        "para": 4,
        "text": "dass die Planung von Anfang an stimme",
        "why": "Richtiger Konjunktiv I in der indirekten Rede."
      },
      {
        "para": 5,
        "text": "brauche dringend mehr junge Technikerinnen",
        "why": "Richtiger Konjunktiv I in der indirekten Rede."
      },
      {
        "para": 6,
        "text": "Ziel des Interviews ist es, die Leserinnen und Leser",
        "why": "Die Infinitivgruppe hängt vom Verweiswort „es“ ab, daher ist das Komma Pflicht und richtig gesetzt."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "warum Holz gerade jetzt so beliebt ist",
        "why": "In der indirekten Frage sind Indikativ („ist“) und Konjunktiv („sei“) möglich."
      },
      {
        "para": 5,
        "text": "Baukasten.“ (Z. 34)",
        "why": "Beim Zitat eines ganzen Satzes kann der Punkt im Zitat stehen; „Baukasten“ (Z. 34). wäre ebenso richtig."
      }
    ]
  },
  {
    "nr": "U10",
    "title": "Interpretation: „Wechselgeld“ von Konrad Weiß",
    "subject": "Deutsch",
    "schoolType": "AHS",
    "klasse": 7,
    "textKind": "Textinterpretation",
    "task": "Interpretieren Sie die Kurzgeschichte „Wechselgeld“ von Konrad Weiß (2019). Gehen Sie dabei auf die Merkmale der Kurzgeschichte, die Figuren und die sprachliche Gestaltung ein.",
    "blocks": [
      {
        "text": "Interpretation: „Wechselgeld“ von Konrad Weiß",
        "heading": true
      },
      {
        "text": "Die Kurzgeschichte „Wechselgeld“ von Konrad Weiß aus dem Jahr 2019 handelt von der jungen Kassiererin Mira, die einem alten Mann heimlich aushilft. Sie thematisiert Einsamkeit, Stolz und die kleinen Gesten, die zwischen Fremden möglich sind.",
        "heading": false
      },
      {
        "text": "Die Geschichte beginnt unvermittelt mit dem Satz: „Um 17.40 Uhr kam er, wie immer.“ (Z. 1) Typisch für eine Kurzgeschichte ist auch, dass die Handlung nur wenige Minuten umfasst und der Ort, ein Supermarkt am Stadtrand, alltäglich ist. Der alte Mann, Herr Dobrowolski, kauft jeden Tag dasselbe: ein Kipferl, eine Dose Katzenfutter und eine Zeitung. Er zahlt mit Münzen, die er „wie Spielsteine“ (Z. 9) auf die Ablage legt.",
        "heading": false
      },
      {
        "text": "Der Wendepunkt tritt ein, als dem Mann zwanzig Cent fehlen. Mira bemerkt, dass er scheinbar verlegen ist, denn er zählt die Münzen dreimal nach. Sie überlegte kurz und legte dann unauffällig eine eigene Münze dazu. Der Mann sagt nur „Danke, Fräulein“, ohne aufzublicken. Ob er weiß, was sie getan hat, bleibt offen.",
        "heading": false
      },
      {
        "text": "Mira wird nicht direkt beschrieben, sondern durch ihre Handlungen charakterisiert. Im Text wird sie nur als „die Neue (Z. 4)“ bezeichnet. Ihr Mitgefühl zeigt sich darin, dass sie nicht wie die anderen Kassiererinnen ungeduldig wird. Dobrowolski hingegen wirkt stolz, er möchte keine Hilfe annehmen. Weiß setzt dabei bewusst auf Andeutungen: Die Katze, für die der Mann das Futter kauft, kommt nie vor, und man fragt sich, ob es sie überhaupt gibt.",
        "heading": false
      },
      {
        "text": "Die Sätze sind kurz und parataktisch, was die Monotonie an der Supermarktkasse widerspiegelt. Auffällig ist das Leitmotiv der Münzen, dass sich durch den ganzen Text zieht. Der Erzähler beschreibt die Münzen genauer als die Menschen was zeigt, wie unpersönlich der Supermarkt ist.",
        "heading": false
      },
      {
        "text": "Meiner Meinung nach zeigt Weiß, dass Hilfe oft im Kleinen beginnt. Das offene Ende lässt den Leser darüber nachdenken, ob der Mann am nächsten Tag wiederkommt. Nichts desto trotz finde ich das Ende etwas unbefriedigend, da ich gerne gewusst hätte, wie es weitergeht.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 4,
        "wrong": "scheinbar",
        "right": [
          "anscheinend",
          "offensichtlich"
        ],
        "category": "ausdruck",
        "what": "„scheinbar“ bedeutet „nur dem Schein nach, nicht wirklich“; gemeint ist „anscheinend“ (offenbar), denn er ist ja wirklich verlegen."
      },
      {
        "para": 4,
        "wrong": "überlegte kurz und legte",
        "right": [
          "überlegt kurz und legt"
        ],
        "category": "grammatik",
        "what": "Eine Interpretation steht im Präsens; ein Wechsel ins Präteritum ist falsch."
      },
      {
        "para": 4,
        "wrong": "sagt nur „Danke",
        "right": [
          "sagt nur: „Danke"
        ],
        "category": "zeichensetzung",
        "what": "Steht der Begleitsatz vor der wörtlichen Rede, folgt ein Doppelpunkt."
      },
      {
        "para": 5,
        "wrong": "Neue (Z. 4)“",
        "right": [
          "Neue“ (Z. 4)"
        ],
        "category": "zeichensetzung",
        "what": "Die Zeilenangabe gehört nicht zum Zitat und steht nach dem schließenden Anführungszeichen."
      },
      {
        "para": 6,
        "wrong": "Münzen, dass",
        "right": [
          "Münzen, das"
        ],
        "category": "rechtschreibung",
        "what": "Das Relativpronomen „das“ (= welches) bezieht sich auf „Leitmotiv“ und wird mit einem s geschrieben."
      },
      {
        "para": 6,
        "wrong": "Menschen was",
        "right": [
          "Menschen, was"
        ],
        "category": "zeichensetzung",
        "what": "Der Relativsatz mit „was“ wird mit Komma abgetrennt."
      },
      {
        "para": 7,
        "wrong": "Nichts desto trotz",
        "right": [
          "Nichtsdestotrotz"
        ],
        "category": "rechtschreibung",
        "what": "„nichtsdestotrotz“ wird in einem Wort geschrieben."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "„Um 17.40 Uhr kam er, wie immer.“",
        "why": "Das Zitat übernimmt Präteritum und Komma des Originals wörtlich und darf nicht ins Präsens gesetzt werden."
      },
      {
        "para": 3,
        "text": "der Ort, ein Supermarkt am Stadtrand, alltäglich ist",
        "why": "Die eingeschobene Apposition ist richtig auf beiden Seiten mit Komma abgetrennt."
      },
      {
        "para": 3,
        "text": "dasselbe",
        "why": "„dasselbe“ wird zusammengeschrieben."
      },
      {
        "para": 3,
        "text": "Kipferl",
        "why": "Österreichisches Wort für Hörnchen, richtig."
      },
      {
        "para": 4,
        "text": "Ob er weiß, was sie getan hat, bleibt offen.",
        "why": "Korrektes Satzgefüge mit zwei Nebensätzen; „weiß“ ist hier das Verb „wissen“, nicht der Name des Autors."
      },
      {
        "para": 5,
        "text": "nicht wie die anderen Kassiererinnen ungeduldig",
        "why": "Kein Komma vor „wie“, weil kein Vergleichssatz mit eigenem Verb folgt."
      },
      {
        "para": 5,
        "text": "wirkt stolz, er möchte keine Hilfe annehmen",
        "why": "Zwei Hauptsätze dürfen im Deutschen mit Komma verbunden werden."
      },
      {
        "para": 6,
        "text": "widerspiegelt",
        "why": "„widerspiegeln“ wird richtig ohne „ie“ geschrieben."
      },
      {
        "para": 6,
        "text": "beschreibt die Münzen genauer als",
        "why": "Kein Komma vor „als“ beim bloßen Vergleich."
      },
      {
        "para": 7,
        "text": "im Kleinen",
        "why": "„im Kleinen“ wird großgeschrieben, weil das Adjektiv als Nomen gebraucht wird."
      },
      {
        "para": 7,
        "text": "gerne gewusst hätte",
        "why": "Richtiger Konjunktiv II der Vergangenheit."
      }
    ],
    "neutral": [
      {
        "para": 5,
        "text": "kommt nie vor, und man",
        "why": "Das Komma zwischen zwei mit „und“ verbundenen Hauptsätzen ist freigestellt."
      }
    ]
  },
  {
    "nr": "U11",
    "title": "Gedichtinterpretation: „Bahnsteig im November“",
    "subject": "Deutsch",
    "schoolType": "AHS",
    "klasse": 8,
    "textKind": "Gedichtinterpretation",
    "task": "Interpretieren Sie das Gedicht „Bahnsteig im November“ von Ottilie Strohmayer (2004). Berücksichtigen Sie dabei die Form, die sprachlichen Bilder und die Situation des lyrischen Ichs.",
    "blocks": [
      {
        "text": "Gedichtinterpretation: „Bahnsteig im November“",
        "heading": true
      },
      {
        "text": "Das Gedicht „Bahnsteig im November“ von Ottilie Strohmayer aus dem Jahr 2004 beschreibt einen menschenleeren Bahnhof an einem Novemberabend. Das lyrische Ich bleibt nach einem Abschied allein zurück und versucht mit dem Verlust einer geliebten Person umzugehen. Strohmayer erklärte später in einem Interview, der Text beruht auf einer eigenen Erfahrung.",
        "heading": false
      },
      {
        "text": "Formal besteht das Gedicht aus drei Strophen mit je vier Versen. Es liegt ein durchgehender Kreuzreim vor, das Metrum ist ein fünfhebiger Jambus. Diese strenge Form steht im Kontrast zur inneren Unruhe des lyrischen Ichs.",
        "heading": false
      },
      {
        "text": "Schon der erste Vers „Der Zug ist fort“ (V. 1) macht deutlich, dass der Abschied bereits vorbei ist. Die Personifikation des Koffers, der dasteht, „als hätt’ er sich verlaufen“ (V. 2) spiegelt die Orientierungslosigkeit des lyrischen Ichs. In der zweiten Strophe zählt die Uhr „Stunden, die man nicht vermisst“ (V. 5). Die Zeit scheint fast still zu stehen, obwohl sie objektiv weiterläuft.",
        "heading": false
      },
      {
        "text": "Besonders auffällig ist das Enjambement zwischen dem neunten und dem zehnten Vers: „Ein Kind winkt einem Fenster zu, das längst schon fort ist“ (V. 9 f.). Hier zeigt sich das selbe Motiv wie im ersten Vers, denn auch das Kind hält an etwas fest, das nicht mehr da ist. Das lyrische Ich erkennt darin seine eigene Situation wieder.",
        "heading": false
      },
      {
        "text": "Am Ende stellt das lyrische Ich die Frage „Kommst auch du?“ (V. 12). Sie lässt offen, ob es noch Hoffnung auf ein Wiedersehen gibt. Man könnte meinen, das Ich hoffe auf eine Rückkehr; ebenso gut kann die Frage aber resigniert gemeint sein. Gerade dadurch wirkt das Gedicht trauriger als es auf den ersten Blick scheint.",
        "heading": false
      },
      {
        "text": "Insgesamt kriegt die Autorin es super hin, die Einsamkeit nach einem Abschied darzustellen. Die schlichte Sprache macht das Gedicht auch heute noch zugänglich.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "beruht",
        "right": [
          "beruhe"
        ],
        "category": "grammatik",
        "what": "In der indirekten Rede ohne „dass“ steht der Konjunktiv I: „beruhe“."
      },
      {
        "para": 4,
        "wrong": "(V. 2) spiegelt",
        "right": [
          "(V. 2), spiegelt"
        ],
        "category": "zeichensetzung",
        "what": "Der eingeschobene Relativsatz „der dasteht, …“ samt Zitat und Versangabe muss mit Komma abgeschlossen werden."
      },
      {
        "para": 4,
        "wrong": "still zu stehen",
        "right": [
          "stillzustehen"
        ],
        "category": "rechtschreibung",
        "what": "„stillstehen“ wird zusammengeschrieben, auch mit „zu“: „stillzustehen“."
      },
      {
        "para": 5,
        "wrong": "zu, das längst",
        "right": [
          "zu, / das längst"
        ],
        "category": "zeichensetzung",
        "optional": true,
        "what": "Beim Zitieren über eine Versgrenze hinweg wird das Versende mit einem Schrägstrich markiert."
      },
      {
        "para": 5,
        "wrong": "das selbe",
        "right": [
          "dasselbe"
        ],
        "category": "rechtschreibung",
        "what": "„dasselbe“ wird zusammengeschrieben."
      },
      {
        "para": 6,
        "wrong": "trauriger als es",
        "right": [
          "trauriger, als es"
        ],
        "category": "zeichensetzung",
        "what": "Leitet „als“ einen Vergleichssatz mit eigenem Verb ein, steht davor ein Komma."
      },
      {
        "para": 7,
        "wrong": "kriegt die Autorin es super hin",
        "right": [
          "gelingt es der Autorin hervorragend",
          "gelingt es der Autorin sehr gut"
        ],
        "category": "ausdruck",
        "what": "„etwas super hinkriegen“ ist umgangssprachlich und passt nicht in eine Interpretation."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "Kreuzreim vor, das Metrum ist",
        "why": "Zwei Hauptsätze dürfen mit Komma verbunden werden."
      },
      {
        "para": 3,
        "text": "des lyrischen Ichs",
        "why": "„Ich“ ist hier ein Nomen und wird großgeschrieben; der Genitiv „des Ichs“ ist richtig."
      },
      {
        "para": 4,
        "text": "Schon der erste Vers „Der Zug ist fort“ (V. 1) macht deutlich",
        "why": "Korrekt eingebautes Zitat mit Versangabe, ohne zusätzliche Satzzeichen."
      },
      {
        "para": 4,
        "text": "„als hätt’ er sich verlaufen“",
        "why": "Der Apostroph stammt aus dem Original und wird beim Zitieren unverändert übernommen."
      },
      {
        "para": 4,
        "text": "„Stunden, die man nicht vermisst“ (V. 5).",
        "why": "Zitat mit Versangabe; der Satzpunkt steht richtig nach der Klammer."
      },
      {
        "para": 5,
        "text": "an etwas fest, das nicht mehr da ist",
        "why": "Das Relativpronomen „das“ bezieht sich auf „etwas“ und hat nur ein s."
      },
      {
        "para": 5,
        "text": "erkennt darin seine eigene Situation wieder",
        "why": "Trennbares Verb „wiedererkennen“ (= erneut erkennen), daher richtig mit „ie“."
      },
      {
        "para": 6,
        "text": "das Ich hoffe auf eine Rückkehr; ebenso gut",
        "why": "Konjunktiv I und Strichpunkt zwischen zwei gleichrangigen Hauptsätzen sind richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "versucht mit dem Verlust",
        "why": "Das Komma vor der Infinitivgruppe nach „versucht“ ist freigestellt."
      },
      {
        "para": 6,
        "text": "die Frage „Kommst auch du?“",
        "why": "Das Zitat steht als Beisatz zu „die Frage“; ein Doppelpunkt davor ist möglich, aber nicht nötig."
      }
    ]
  },
  {
    "nr": "U12",
    "title": "Ice-Cream Day",
    "subject": "Englisch",
    "schoolType": "Mittelschule",
    "klasse": 2,
    "textKind": "Diary entry",
    "task": "Write a diary entry about a day when you helped somebody. Write about 100 to 120 words.",
    "blocks": [
      {
        "text": "Ice-Cream Day",
        "heading": true
      },
      {
        "text": "Dear Diary,",
        "heading": false
      },
      {
        "text": "Today I helped my uncle Ahmet in his ice-cream van. He sell ice cream in the park every summer. He has had the van since five years. My friend Will came with me. A little boy only had one euro. Will gave him a extra scoop for free. My uncle laughed and said, “Will, you will never get rich like this!”",
        "heading": false
      },
      {
        "text": "In the afternoon it was very hot and their was a long queue. I became a big tip from an old lady. Will dropped a cone, so it's chocolate scoop rolled under the van. At six o'clock we drived home. I was tired but happy. Next saturday I will help again.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "He sell",
        "right": [
          "He sells"
        ],
        "category": "grammatik",
        "what": "In der 3. Person Singular braucht das Simple Present ein -s: he sells."
      },
      {
        "para": 3,
        "wrong": "since five years",
        "right": [
          "for five years"
        ],
        "category": "grammatik",
        "what": "Für eine Zeitdauer verwendet man „for“, für einen Zeitpunkt „since“."
      },
      {
        "para": 3,
        "wrong": "a extra",
        "right": [
          "an extra"
        ],
        "category": "grammatik",
        "what": "Vor einem Vokallaut steht der Artikel „an“."
      },
      {
        "para": 4,
        "wrong": "their was",
        "right": [
          "there was"
        ],
        "category": "rechtschreibung",
        "what": "„there was“ heißt „es gab“; „their“ bedeutet „ihr/ihre“."
      },
      {
        "para": 4,
        "wrong": "became",
        "right": [
          "got",
          "received"
        ],
        "category": "ausdruck",
        "what": "„become“ ist ein falscher Freund und heißt „werden“; „bekommen“ heißt „get“ oder „receive“."
      },
      {
        "para": 4,
        "wrong": "it's",
        "right": [
          "its"
        ],
        "category": "rechtschreibung",
        "what": "„its“ (ohne Apostroph) ist das besitzanzeigende Fürwort; „it's“ bedeutet „it is“."
      },
      {
        "para": 4,
        "wrong": "drived",
        "right": [
          "drove"
        ],
        "category": "grammatik",
        "what": "„drive“ ist unregelmäßig: drive – drove – driven."
      },
      {
        "para": 4,
        "wrong": "saturday",
        "right": [
          "Saturday"
        ],
        "category": "rechtschreibung",
        "what": "Wochentage werden im Englischen großgeschrieben."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "He has had the van",
        "why": "Richtiges Present Perfect für etwas, das bis heute andauert."
      },
      {
        "para": 3,
        "text": "said, “Will, you will never get rich like this!”",
        "why": "Direkte Rede im Englischen mit Komma nach „said“; „Will“ ist der Name, „will“ das Hilfsverb."
      },
      {
        "para": 4,
        "text": "an old lady",
        "why": "Vor dem Vokallaut steht richtig „an“."
      },
      {
        "para": 4,
        "text": "I was tired but happy.",
        "why": "Korrekt; vor „but“ ist hier kein Komma nötig."
      },
      {
        "para": 4,
        "text": "I will help again",
        "why": "„will“ ist hier das Hilfsverb für die Zukunft, nicht der Name."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "ice-cream van",
        "why": "Als zusammengesetztes Bestimmungswort ist „ice-cream van“ mit und ohne Bindestrich üblich."
      },
      {
        "para": 4,
        "text": "In the afternoon it was",
        "why": "Das Komma nach einer kurzen einleitenden Zeitangabe ist im Englischen freigestellt."
      }
    ]
  },
  {
    "nr": "U13",
    "title": "Krampus Night in Our Village",
    "subject": "Englisch",
    "schoolType": "AHS",
    "klasse": 4,
    "textKind": "E-mail",
    "task": "Write an e-mail to your pen friend about a tradition in your region. Describe the tradition and invite your friend to visit you. Write about 220 words.",
    "blocks": [
      {
        "text": "Krampus Night in Our Village",
        "heading": true
      },
      {
        "text": "Dear Hope,",
        "heading": false
      },
      {
        "text": "thank you for your last e-mail and the photos of your new puppy. I hope you are well. Today I want to tell you about a tradition from my region that you probably don't know.",
        "heading": false
      },
      {
        "text": "Every year on 5 December the Krampus run takes place in our village. The Krampus is a scary creature with horns, fur and a long tongue. He punishes children who have been naughty. Last Saturday I have watched the run with my little brother Jakob. About forty Krampuses were walking through the main street while drums were playing. Jakob was so scared that he hided behind me the whole time. I made a lot of photos, but most of them are blurry because it was very dark.",
        "heading": false
      },
      {
        "text": "Our English teacher, Mrs Kowalczyk, told us that the tradition is several hundred years old. My cousin's mask was carved by his grandfather. Its very heavy and he can only wear it for an hour. I think the Krampus run is more scary than Halloween, but my friends say it is the best night of the year.",
        "heading": false
      },
      {
        "text": "Do you have similar traditions in Ireland? If you will visit me next winter, we can go together. My parents said you can stay at us for a week. I am looking forward to hear from you!",
        "heading": false
      },
      {
        "text": "Best wishes,",
        "heading": false
      },
      {
        "text": "Valentina",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "thank you for",
        "right": [
          "Thank you for"
        ],
        "category": "rechtschreibung",
        "what": "Im Englischen beginnt der Text nach der Anrede „Dear …,“ mit einem Großbuchstaben."
      },
      {
        "para": 4,
        "wrong": "I have watched",
        "right": [
          "I watched"
        ],
        "category": "grammatik",
        "what": "Mit einer abgeschlossenen Zeitangabe wie „last Saturday“ steht das Simple Past, nicht das Present Perfect."
      },
      {
        "para": 4,
        "wrong": "hided",
        "right": [
          "hid"
        ],
        "category": "grammatik",
        "what": "„hide“ ist unregelmäßig: hide – hid – hidden."
      },
      {
        "para": 4,
        "wrong": "I made",
        "right": [
          "I took"
        ],
        "category": "ausdruck",
        "what": "Fotos „macht“ man im Englischen nicht: Es heißt „take photos“."
      },
      {
        "para": 5,
        "wrong": "Its very",
        "right": [
          "It's very",
          "It is very"
        ],
        "category": "rechtschreibung",
        "what": "Gemeint ist „it is“, also „it's“ mit Apostroph; „its“ ist das besitzanzeigende Fürwort."
      },
      {
        "para": 6,
        "wrong": "If you will visit",
        "right": [
          "If you visit"
        ],
        "category": "grammatik",
        "what": "Im if-Satz des Conditional I steht das Simple Present, nicht „will“."
      },
      {
        "para": 6,
        "wrong": "stay at us",
        "right": [
          "stay with us"
        ],
        "category": "grammatik",
        "what": "„bei jemandem wohnen“ heißt „stay with somebody“."
      },
      {
        "para": 6,
        "wrong": "to hear from",
        "right": [
          "to hearing from"
        ],
        "category": "grammatik",
        "what": "Nach „look forward to“ folgt die -ing-Form."
      }
    ],
    "correct": [
      {
        "para": 3,
        "text": "I hope you are well.",
        "why": "„hope“ ist hier das Verb, nicht der Name der Brieffreundin; der Satz ist korrekt."
      },
      {
        "para": 4,
        "text": "on 5 December",
        "why": "Richtige britische Datumsangabe mit „on“."
      },
      {
        "para": 4,
        "text": "were walking through the main street while drums were playing",
        "why": "Korrektes Past Progressive für zwei gleichzeitig ablaufende Handlungen."
      },
      {
        "para": 4,
        "text": "blurry because it was very dark",
        "why": "Im Englischen steht vor „because“ normalerweise kein Komma."
      },
      {
        "para": 5,
        "text": "Our English teacher, Mrs Kowalczyk, told us",
        "why": "Die Apposition ist richtig mit zwei Kommas abgetrennt; „Mrs“ ohne Punkt ist britisch korrekt."
      },
      {
        "para": 5,
        "text": "was carved by his grandfather",
        "why": "Richtiges Passiv im Simple Past."
      }
    ],
    "neutral": [
      {
        "para": 5,
        "text": "told us that the tradition is",
        "why": "Bei Aussagen, die immer noch gelten, ist die Zeitverschiebung („was“) nicht nötig; beides ist richtig."
      },
      {
        "para": 5,
        "text": "more scary than",
        "why": "„scarier than“ und „more scary than“ sind beide gebräuchlich."
      }
    ]
  },
  {
    "nr": "U14",
    "title": "Lights Out After Midnight?",
    "subject": "Englisch",
    "schoolType": "AHS",
    "klasse": 7,
    "textKind": "Opinion essay",
    "task": "Write an opinion essay on whether towns should switch off their streetlights in the middle of the night. Discuss arguments for and against and state your own opinion clearly. Write 320 to 350 words.",
    "blocks": [
      {
        "text": "Lights Out After Midnight?",
        "heading": true
      },
      {
        "text": "In many Austrian towns, streetlights shine all night long, even when nobody is outside. Recently, our municipality has discussed whether the lights should be switched off between midnight and five o'clock in the morning. In this essay I will explain why I support this idea, although I understand the concerns of its opponents.",
        "heading": false
      },
      {
        "text": "The strongest argument for switching off streetlights is the protection of nature. Artificial light at night confuses insects, birds and bats. According to Professor Daniel Light, a biologist at a university in Graz, the number of insects that die at streetlights are enormous every summer. Light pollution also makes it almost impossible to see the stars, although this was completely normal for our grandparents. My grandma Hermine still remembers seeing the Milky Way from her village.",
        "heading": false
      },
      {
        "text": "Secondly, switching off the lights would save a lot of money. The electricity for streetlights costs our town around 80,000 euros per year, and this money could be spent on better things, for example on our youth centre. Even our actual mayor admitted that the centre urgently needs a new roof. Using less lights also means less energy, which is good for the climate.",
        "heading": false
      },
      {
        "text": "On the other hand, many people are worried about safety. They argue, that dark streets attract criminals and that women would feel unsafe walking home at night. This is an understandable concern, however studies from towns that have already tested the idea show that crime does not rise. Our neighbouring town switches off its lights since last year without any problems. My friend Amara Okonkwo, who works night shifts at a petrol station, says that she eventually would feel uncomfortable at first. Despite of this, she believes that people would get used to it.",
        "heading": false
      },
      {
        "text": "In conclusion, I am convinced that the advantages outweigh the disadvantages. A compromise could be to switch off the lights in residential areas but to keep them on at bus stops and crossings. If our town took this step, it would protect nature and save money at the same time. Sometimes, less really is more.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "are enormous",
        "right": [
          "is enormous"
        ],
        "category": "grammatik",
        "what": "Das Subjekt ist „the number“ (Singular), daher „is“."
      },
      {
        "para": 4,
        "wrong": "actual mayor",
        "right": [
          "current mayor",
          "present mayor"
        ],
        "category": "ausdruck",
        "what": "„actual“ heißt „tatsächlich“; „aktuell“ heißt „current“ (falscher Freund)."
      },
      {
        "para": 4,
        "wrong": "less lights",
        "right": [
          "fewer lights"
        ],
        "category": "grammatik",
        "what": "Bei zählbaren Nomen im Plural steht „fewer“, nicht „less“."
      },
      {
        "para": 5,
        "wrong": "argue, that",
        "right": [
          "argue that"
        ],
        "category": "zeichensetzung",
        "what": "Vor einem „that“-Satz steht im Englischen kein Komma."
      },
      {
        "para": 5,
        "wrong": "concern, however studies",
        "right": [
          "concern; however, studies",
          "concern. However, studies"
        ],
        "category": "zeichensetzung",
        "what": "„however“ kann zwei Hauptsätze nicht mit einem Komma verbinden (comma splice); davor steht ein Strichpunkt oder Punkt, danach ein Komma."
      },
      {
        "para": 5,
        "wrong": "switches off its lights since last year",
        "right": [
          "has been switching off its lights since last year",
          "has switched off its lights since last year"
        ],
        "category": "grammatik",
        "what": "Für eine Handlung, die seit einem Zeitpunkt bis jetzt andauert („since last year“), steht das Present Perfect."
      },
      {
        "para": 5,
        "wrong": "eventually would",
        "right": [
          "might",
          "would possibly"
        ],
        "category": "ausdruck",
        "what": "„eventually“ heißt „schließlich, am Ende“; „eventuell“ heißt „possibly“ oder „might“ (falscher Freund)."
      },
      {
        "para": 5,
        "wrong": "Despite of",
        "right": [
          "Despite"
        ],
        "category": "grammatik",
        "what": "„despite“ steht ohne „of“ (aber: „in spite of“)."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Recently, our municipality has discussed whether",
        "why": "Present Perfect mit „recently“ ist richtig."
      },
      {
        "para": 2,
        "text": "the concerns of its opponents",
        "why": "„its“ ohne Apostroph ist hier richtig, weil es besitzanzeigend ist (die Gegner der Idee)."
      },
      {
        "para": 3,
        "text": "Professor Daniel Light, a biologist at a university in Graz,",
        "why": "Die Apposition ist richtig auf beiden Seiten mit Komma abgetrennt."
      },
      {
        "para": 3,
        "text": "Light pollution also makes it",
        "why": "Hier ist „light“ ein gewöhnliches Nomen (nicht der Name) und nur wegen des Satzanfangs großgeschrieben."
      },
      {
        "para": 3,
        "text": "still remembers seeing the Milky Way",
        "why": "„remember + -ing“ für eine Erinnerung an Vergangenes ist richtig."
      },
      {
        "para": 4,
        "text": "80,000 euros",
        "why": "Im Englischen trennt das Komma die Tausender."
      },
      {
        "para": 5,
        "text": "who works night shifts at a petrol station,",
        "why": "Nicht bestimmender Relativsatz mit „who“ für eine Person, richtig mit Kommas abgetrennt."
      },
      {
        "para": 6,
        "text": "If our town took this step, it would protect",
        "why": "Korrekter Conditional II (if + Simple Past, would + Infinitiv)."
      },
      {
        "para": 6,
        "text": "less really is more",
        "why": "Hier ist „less“ richtig, weil es nicht um zählbare Dinge geht."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "In many Austrian towns, streetlights",
        "why": "Das Komma nach einer einleitenden Ortsangabe ist im Englischen freigestellt."
      },
      {
        "para": 3,
        "text": "insects, birds and bats",
        "why": "Das Oxford Comma vor „and“ ist freigestellt."
      }
    ]
  }
];
