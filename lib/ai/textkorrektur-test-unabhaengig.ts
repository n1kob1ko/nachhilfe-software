/**
 * The independent texts of the Textkorrektur-Test (lib/ai/textkorrektur-test.ts, „Unabhängiger Test“), written
 * on 2026-10-10 after the correction was finished: 14 synthetic student texts (no real student text) from
 * Volksschule to Matura, German and English, with built-in errors, correct places a careless correction would
 * change, and places where either version is acceptable or experts disagree (neutral).
 *
 * Held out: these texts only measure. Prompts, rules and checks are never changed to fit them; a text that
 * was used to improve the correction belongs in textkorrektur-test-faelle.ts, and this set gets new texts.
 *
 * The key was written first and checked by two independent proofreadings that did not see it; where they
 * disagreed with it, the place was decided by the rules or marked neutral. Same format as
 * textkorrektur-test-faelle.ts: para counts every block from 1, headings included; `wrong` occurs once in its
 * paragraph; `right` are replacements of exactly `wrong`.
 */
import type { KorrekturFall } from "./textkorrektur-test-faelle";

export const HELD_OUT_CASES: KorrekturFall[] = [
  {
    "nr": "N01",
    "title": "Mein Geburtstag",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 2,
    "textKind": "Erlebniserzählung",
    "task": "Schreibe über deinen letzten Geburtstag. Erzähle, was du erlebt hast.",
    "blocks": [
      {
        "text": "Mein Geburtstag",
        "heading": true
      },
      {
        "text": "Am Samstag hatte ich Geburtstag. Ich bin jetzt acht Jare alt. In der Früh hat mich meine Mama mit einem Lied gewekt. Dann hab ich meine Geschenke aufgemacht. Ich habe ein Fahrad bekommen und ein Buch über Dinosaurier.",
        "heading": false
      },
      {
        "text": "Am Nachmittag sind meine Freunde gekommen. Zoe hat mir eine Kette geschenkt. Wir haben im Garten verstecken gespielt und Kuchen gegessen. Der Kuchen war aus Schokolade und hatte acht Kertzen. Ich habe alle auf einmal ausgeblasen",
        "heading": false
      },
      {
        "text": "Am abend hat mein Opa Ernst angerufen. Er hat gesagt das er mich bald besuchen kommt. Ich habe mich sehr gefreut. Das war der schönste Tag im ganzen Jahr.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "Jare",
        "right": [
          "Jahre"
        ],
        "category": "rechtschreibung",
        "what": "Dehnungs-h: das Jahr, die Jahre."
      },
      {
        "para": 2,
        "wrong": "gewekt",
        "right": [
          "geweckt"
        ],
        "category": "rechtschreibung",
        "what": "Nach kurzem Selbstlaut steht ck: wecken – geweckt."
      },
      {
        "para": 2,
        "wrong": "Fahrad",
        "right": [
          "Fahrrad"
        ],
        "category": "rechtschreibung",
        "what": "Zusammengesetztes Nomen aus „fahren“ und „Rad“: Fahrrad mit rr."
      },
      {
        "para": 3,
        "wrong": "verstecken",
        "right": [
          "Verstecken"
        ],
        "category": "rechtschreibung",
        "what": "Das Spiel „Verstecken“ ist hier ein Nomen und wird großgeschrieben."
      },
      {
        "para": 3,
        "wrong": "Kertzen",
        "right": [
          "Kerzen"
        ],
        "category": "rechtschreibung",
        "what": "Kerze schreibt man ohne t vor dem z (nach r steht nie tz)."
      },
      {
        "para": 3,
        "wrong": "ausgeblasen",
        "right": [
          "ausgeblasen."
        ],
        "category": "zeichensetzung",
        "what": "Am Satzende fehlt der Punkt."
      },
      {
        "para": 4,
        "wrong": "abend",
        "right": [
          "Abend"
        ],
        "category": "rechtschreibung",
        "what": "„am Abend“: Nach „am“ ist „Abend“ ein Nomen und wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "gesagt",
        "right": [
          "gesagt,"
        ],
        "category": "zeichensetzung",
        "what": "Vor dem dass-Satz steht ein Beistrich."
      },
      {
        "para": 4,
        "wrong": "das er",
        "right": [
          "dass er"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ schreibt man mit ss (man kann nicht „dieses“ oder „welches“ einsetzen)."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "In der Früh",
        "why": "Österreichisch und richtig („am Morgen“)."
      },
      {
        "para": 3,
        "text": "auf einmal",
        "why": "Richtig getrennt und klein."
      },
      {
        "para": 4,
        "text": "im ganzen Jahr",
        "why": "Richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "hab ich",
        "why": "Umgangssprachlich verkürzt; in der 2. Klasse vertretbar, „habe ich“ ebenso richtig."
      },
      {
        "para": 4,
        "text": "besuchen kommt",
        "why": "Umgangssprachlich, aber richtig; „besuchen wird“ ebenso möglich."
      }
    ]
  },
  {
    "nr": "N02",
    "title": "Der Drachen im Baum",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 3,
    "textKind": "Bildgeschichte",
    "task": "Schreibe eine Geschichte zu den vier Bildern. Gib den Kindern Namen und erzähle in der Vergangenheit.",
    "blocks": [
      {
        "text": "Der Drachen im Baum",
        "heading": true
      },
      {
        "text": "An einem windigen Sonntag gingen Tom und seine Schwester Mia auf die Wiese hinter dem Haus. Sie wollten ihren neuen Drachen steigen lassen. Der Drachen war rot und hatte einen langen Schwanz. Mia hielt die Schnuhr und Tom laufte los. Bald flog der Drachen hoch in den Himel.",
        "heading": false
      },
      {
        "text": "Auf einmal kamm ein starker Windstoß. Der Drachen flog in eine hohe Eiche und die Schnur ist gerissen. Mia fing an zu weinen. „Jetzt ist er kaputt“, schluchzte sie. Tom sagte: „Keine angst, ich hole ihn runter.“",
        "heading": false
      },
      {
        "text": "Tom holte die Leiter aus der Garasche. Der Nachbar Herr Fink half ihm und hielt die Leiter fest. Tom kletterte forsichtig hinauf und befreite den Drachen aus den Ästen. Zum glück war er nur ein bisschen zerrissen.",
        "heading": false
      },
      {
        "text": "Mama klebte das Loch mit einem Klebeband zu. Am Nachmittag ließen die Kinder den Drachen wieder steigen. Herr Fink stand am Zaun und winkte innen zu. Das war ein schöner Tag.",
        "heading": false
      }
    ],
    "pictures": [
      "Zwei Kinder lassen auf einer Wiese einen roten Drachen steigen.",
      "Ein Windstoß treibt den Drachen in eine hohe Eiche, die Schnur reißt, das Mädchen weint.",
      "Der Bub holt eine Leiter, ein Nachbar hält sie fest, der Bub klettert hinauf.",
      "Die Kinder lassen den geflickten Drachen wieder steigen, der Nachbar winkt am Zaun."
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "Schnuhr",
        "right": [
          "Schnur"
        ],
        "category": "rechtschreibung",
        "what": "Schnur schreibt man ohne Dehnungs-h."
      },
      {
        "para": 2,
        "wrong": "laufte",
        "right": [
          "lief"
        ],
        "category": "grammatik",
        "what": "„laufen“ ist ein unregelmäßiges (starkes) Verb: laufen – lief."
      },
      {
        "para": 2,
        "wrong": "Himel",
        "right": [
          "Himmel"
        ],
        "category": "rechtschreibung",
        "what": "Nach kurzem Selbstlaut wird der Mitlaut verdoppelt: Himmel."
      },
      {
        "para": 3,
        "wrong": "kamm",
        "right": [
          "kam"
        ],
        "category": "rechtschreibung",
        "what": "kommen – kam: langes a, nur ein m."
      },
      {
        "para": 3,
        "wrong": "ist gerissen",
        "right": [
          "riss"
        ],
        "category": "grammatik",
        "what": "Die Geschichte steht im Präteritum; einheitlich: die Schnur riss.",
        "optional": true
      },
      {
        "para": 3,
        "wrong": "angst",
        "right": [
          "Angst"
        ],
        "category": "rechtschreibung",
        "what": "„die Angst“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "Garasche",
        "right": [
          "Garage"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort aus dem Französischen: Garage."
      },
      {
        "para": 4,
        "wrong": "forsichtig",
        "right": [
          "vorsichtig"
        ],
        "category": "rechtschreibung",
        "what": "„vorsichtig“ kommt von „vor“ und „Sicht“ und wird mit v geschrieben."
      },
      {
        "para": 4,
        "wrong": "glück",
        "right": [
          "Glück"
        ],
        "category": "rechtschreibung",
        "what": "„zum Glück“: „Glück“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 5,
        "wrong": "innen",
        "right": [
          "ihnen"
        ],
        "category": "rechtschreibung",
        "what": "Das Fürwort „ihnen“ (wem? den Kindern) schreibt man mit ih."
      }
    ],
    "correct": [
      {
        "para": 1,
        "text": "Der Drachen",
        "why": "„der Drachen“ ist das Spielzeug (der Drache wäre das Fabeltier); richtig."
      },
      {
        "para": 3,
        "text": "„Jetzt ist er kaputt“, schluchzte sie.",
        "why": "Wörtliche Rede mit Begleitsatz richtig gesetzt."
      },
      {
        "para": 3,
        "text": "Tom sagte: „Keine",
        "why": "Doppelpunkt vor der wörtlichen Rede richtig."
      },
      {
        "para": 4,
        "text": "ein bisschen",
        "why": "„ein bisschen“ wird klein geschrieben; richtig."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "runter",
        "why": "Umgangssprachlich für „herunter“; vertretbar in wörtlicher Rede."
      },
      {
        "para": 4,
        "text": "Der Nachbar Herr Fink",
        "why": "Enge Apposition ohne Beistriche ist richtig; „Der Nachbar, Herr Fink, half“ ist ebenfalls richtig."
      }
    ]
  },
  {
    "nr": "N03",
    "title": "Ein Abenteuer in der Tropfsteinhöhle",
    "subject": "Deutsch",
    "schoolType": "Volksschule",
    "klasse": 4,
    "textKind": "Erlebniserzählung",
    "task": "Erzähle von einem Ausflug mit deiner Klasse. Achte auf eine spannende Stelle und finde eine passende Überschrift.",
    "blocks": [
      {
        "text": "Ein Abenteuer in der Tropfsteinhöhle",
        "heading": true
      },
      {
        "text": "Im Oktober machte unsere Klasse einen Ausflug in die Tropfsteinhöle. Unsere Lehrerin, Frau Sommer, hatte uns schon viel darüber erzählt. Im Sommer war ich mit meinen Eltern schon einmal dort, aber mit der ganzen Klasse war es viel lustiger. Wir fuhren mit dem Bus und sangen die ganze Zeit.",
        "heading": false
      },
      {
        "text": "In der Höhle war es kalt und feucht. Ein Führer erklärte uns, das ein Tropfstein in hundert Jahren nur einen Zentimeter wächst. Die Tropfsteine sahen aus wie Eiszapfen, Türme und sogar wie ein Elefant. Jakob wollte einen angreifen, aber das ist streng verboten.",
        "heading": false
      },
      {
        "text": "Plötzlich ging das Licht aus. Es war stockdunkel und manche Kinder schrien laut. Elif hielt sich an meinen Arm fest. Ich hatte auch Angst aber ich sagte garnichts. Nach ein paar Sekunden ging das Licht wieder an. Der Führer lachte und sagte, dass er das absichtlich gemacht hat.",
        "heading": false
      },
      {
        "text": "Am Ende durften wir noch in den Souvenirladen gehen. Ich kaufte mir einen kleinen Kristal für meine Sammlung. Auf der Heimfahrt waren alle müde und vieleicht ein bisschen traurig. Das war der spannenste Ausflug, den ich je gemacht habe.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "Tropfsteinhöle",
        "right": [
          "Tropfsteinhöhle"
        ],
        "category": "rechtschreibung",
        "what": "Höhle schreibt man mit Dehnungs-h."
      },
      {
        "para": 3,
        "wrong": "uns, das ein",
        "right": [
          "uns, dass ein"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ leitet den Nebensatz ein und wird mit ss geschrieben."
      },
      {
        "para": 4,
        "wrong": "meinen Arm",
        "right": [
          "meinem Arm"
        ],
        "category": "grammatik",
        "what": "sich festhalten an + 3. Fall (Wem-Fall): an meinem Arm."
      },
      {
        "para": 4,
        "wrong": "Angst aber",
        "right": [
          "Angst, aber"
        ],
        "category": "zeichensetzung",
        "what": "Vor „aber“ steht ein Beistrich."
      },
      {
        "para": 4,
        "wrong": "garnichts",
        "right": [
          "gar nichts"
        ],
        "category": "rechtschreibung",
        "what": "„gar nichts“ schreibt man getrennt."
      },
      {
        "para": 5,
        "wrong": "Kristal",
        "right": [
          "Kristall"
        ],
        "category": "rechtschreibung",
        "what": "der Kristall mit ll."
      },
      {
        "para": 5,
        "wrong": "vieleicht",
        "right": [
          "vielleicht"
        ],
        "category": "rechtschreibung",
        "what": "„vielleicht“ (von „viel“ und „leicht“) schreibt man mit ll."
      },
      {
        "para": 5,
        "wrong": "spannenste",
        "right": [
          "spannendste"
        ],
        "category": "rechtschreibung",
        "what": "Von „spannend“: der spannendste (das d bleibt)."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Unsere Lehrerin, Frau Sommer, hatte",
        "why": "Beistriche um die Beifügung (Apposition) richtig."
      },
      {
        "para": 2,
        "text": "Im Sommer war ich",
        "why": "Richtig; „Sommer“ ist hier die Jahreszeit."
      },
      {
        "para": 3,
        "text": "angreifen",
        "why": "Österreichisch für „anfassen“; richtig."
      },
      {
        "para": 3,
        "text": "das ist streng verboten",
        "why": "Allgemein gültige Regel im Präsens; richtig."
      },
      {
        "para": 5,
        "text": "den ich je gemacht habe",
        "why": "Relativsatz mit Beistrich richtig."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "stockdunkel und manche",
        "why": "Beistrich vor „und“ zwischen Hauptsätzen ist freigestellt."
      },
      {
        "para": 4,
        "text": "gemacht hat",
        "why": "„gemacht hat“ ist in der Erzählung einer 4. Klasse vertretbar; „gemacht hatte“ oder „gemacht habe“ ebenfalls."
      }
    ]
  },
  {
    "nr": "N04",
    "title": "Brandschutzübung an der MS Lindenhof",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 2,
    "textKind": "Bericht",
    "task": "Schreibe für die Schülerzeitung einen Bericht über die Brandschutzübung an deiner Schule. Beantworte die W-Fragen und schreibe sachlich im Präteritum.",
    "blocks": [
      {
        "text": "Brandschutzübung an der MS Lindenhof",
        "heading": true
      },
      {
        "text": "Am Dienstag, dem 7. Oktober, fand an der MS Lindenhof eine Brandschutzübung statt. Um 9.15 Uhr leutete plötzlich die Alarmglocke. Niemand weiß vorher, dass es nur eine Übung war. Alle Schülerinnen und Schüler mussten sofort ihre Klassen verlassen.",
        "heading": false
      },
      {
        "text": "Die Lehrer führten ihre Klassen über das Stiegenhaus in den Hof. Dort stellten sich alle beim Sammelplatz auf. Herr Direktor Weiß kontrolierte mit einer Liste, ob alle Kinder da waren. Nach vier Minuten war das Schulhaus leer. Das ist schneller als letztes Jahr gewesen.",
        "heading": false
      },
      {
        "text": "Kurtz darauf kam die Feuerwehr mit zwei Fahrzeugen. Die Feuerwehrleute zeigten uns wie man einen Feuerlöscher richtig benutzt. Einige Schüler durften es selbst ausprobieren, was voll cool war. Der Komandant erklärte, dass man bei einem echten Brand nie den Lift benutzen darf, weil man darin stecken bleiben kann.",
        "heading": false
      },
      {
        "text": "Um 10 Uhr durften wir wieder in die Klassen zurück. Die Übung hat gezeigt, das unsere Schule gut auf einen Notfall vorbereitet ist. Wegen dem Regen waren aber viele Schüler nass.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "leutete",
        "right": [
          "läutete"
        ],
        "category": "rechtschreibung",
        "what": "„läuten“ kommt von „laut“ und wird mit äu geschrieben."
      },
      {
        "para": 2,
        "wrong": "weiß",
        "right": [
          "wusste"
        ],
        "category": "grammatik",
        "what": "Der Bericht steht im Präteritum; außerdem geht es um die Vergangenheit: Niemand wusste vorher …"
      },
      {
        "para": 3,
        "wrong": "kontrolierte",
        "right": [
          "kontrollierte"
        ],
        "category": "rechtschreibung",
        "what": "kontrollieren schreibt man mit ll."
      },
      {
        "para": 3,
        "wrong": "ist schneller als letztes Jahr gewesen",
        "right": [
          "war schneller als letztes Jahr",
          "war schneller als im letzten Jahr",
          "war schneller als im Vorjahr"
        ],
        "category": "grammatik",
        "what": "Im Bericht Präteritum statt Perfekt: Das war schneller als …"
      },
      {
        "para": 4,
        "wrong": "Kurtz",
        "right": [
          "Kurz"
        ],
        "category": "rechtschreibung",
        "what": "„kurz“: nach r steht nie tz."
      },
      {
        "para": 4,
        "wrong": "uns wie",
        "right": [
          "uns, wie"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „wie“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": ", was voll cool war",
        "right": [
          "",
          ", was spannend war"
        ],
        "category": "ausdruck",
        "what": "Umgangssprache und eigene Gefühle gehören nicht in einen sachlichen Bericht.",
        "optional": true
      },
      {
        "para": 4,
        "wrong": "Komandant",
        "right": [
          "Kommandant"
        ],
        "category": "rechtschreibung",
        "what": "Kommandant schreibt man mit mm."
      },
      {
        "para": 5,
        "wrong": "gezeigt, das",
        "right": [
          "gezeigt, dass"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ wird mit ss geschrieben."
      },
      {
        "para": 5,
        "wrong": "Wegen dem Regen",
        "right": [
          "Wegen des Regens"
        ],
        "category": "grammatik",
        "what": "„wegen“ verlangt in der Standardsprache den 2. Fall (Wes-Fall): wegen des Regens; „wegen dem“ ist umgangssprachlich."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Am Dienstag, dem 7. Oktober, fand",
        "why": "Datum als Beifügung mit Beistrichen richtig."
      },
      {
        "para": 3,
        "text": "Stiegenhaus",
        "why": "Österreichisch für Treppenhaus; richtig."
      },
      {
        "para": 3,
        "text": "ob alle Kinder da waren",
        "why": "Richtig."
      },
      {
        "para": 4,
        "text": "Lift",
        "why": "Österreichisch für Aufzug; richtig."
      },
      {
        "para": 4,
        "text": "weil man darin stecken bleiben kann",
        "why": "Richtig; „stecken bleiben“ getrennt ist zulässig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "dem 7. Oktober",
        "why": "„dem“ und „den 7. Oktober“ sind beide richtig."
      },
      {
        "para": 3,
        "text": "beim Sammelplatz",
        "why": "Österreichisch üblich; „am Sammelplatz“ ebenso richtig."
      },
      {
        "para": 4,
        "text": "es selbst ausprobieren",
        "why": "„es“ bezieht sich auf das Benutzen; „ihn“ (den Feuerlöscher) ebenso möglich."
      },
      {
        "para": 5,
        "text": "Die Übung hat",
        "why": "Perfekt „hat gezeigt“ für ein Ergebnis, das noch gilt, ist vertretbar; „zeigte“ ebenso."
      }
    ]
  },
  {
    "nr": "N05",
    "title": "Beschwerde über die Busfahrt",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 3,
    "textKind": "Beschwerdebrief",
    "task": "Bei eurer Exkursion nach Linz ist mit dem Bus einiges schiefgegangen. Schreibe als Klassensprecherin oder Klassensprecher einen Beschwerdebrief an das Busunternehmen. Beachte die Merkmale eines formellen Briefes.",
    "blocks": [
      {
        "text": "Beschwerde über die Busfahrt am 2. Oktober",
        "heading": true
      },
      {
        "text": "Sehr geehrte Damen und Herren,",
        "heading": false
      },
      {
        "text": "ich schreibe Ihnen im Namen der Klasse 3B des BRG Am Lindenhof. Am 2. Oktober haben wir mit einem Bus ihrer Firma eine Exkursion nach Linz gemacht. Leider waren wir mit der Fahrt sehr unzufrieden, deshalb möchte ich mich hiermit beschweren.",
        "heading": false
      },
      {
        "text": "Erstens kam der Bus mit vierzig Minuten verspätung, obwohl die Abfahrt für 7.30 Uhr vereinbart war. Wir standen seid halb acht im Regen vor der Schule und niemand hat uns bescheid gegeben. Zweitens war die Klimaanlage kaputt, wodurch es im Bus sehr heiß und stickig war. Einigen Schülern wurde deshalb schlecht.",
        "heading": false
      },
      {
        "text": "Drittens war ihr Fahrer, Herr Brandstätter, sehr unfreundlich. Als wir ihn gefragt haben, ob wir eine kurze Pause machen können, hat er uns angeschrien. Ich finde, so ein Verhalten geht garnicht.",
        "heading": false
      },
      {
        "text": "Wir haben für die Fahrt 560 Euro bezahlt. Deshalb erwarten wir, das Sie uns einen Teil des Geldes zurückzahlen. Ich bitte sie um eine Antwort bis zum 20. Oktober.",
        "heading": false
      },
      {
        "text": "Mit freundlichen Grüßen",
        "heading": false
      },
      {
        "text": "Valentina Kovačević, Klassensprecherin der 3B",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "ihrer Firma",
        "right": [
          "Ihrer Firma"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: „Ihrer“ (des Empfängers) wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "verspätung",
        "right": [
          "Verspätung"
        ],
        "category": "rechtschreibung",
        "what": "„die Verspätung“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "seid",
        "right": [
          "seit"
        ],
        "category": "rechtschreibung",
        "what": "Zeitangabe: „seit“ mit t; „seid“ ist eine Form von „sein“ (ihr seid)."
      },
      {
        "para": 4,
        "wrong": "bescheid",
        "right": [
          "Bescheid"
        ],
        "category": "rechtschreibung",
        "what": "„Bescheid geben“: „Bescheid“ ist ein Nomen und wird großgeschrieben."
      },
      {
        "para": 5,
        "wrong": "ihr Fahrer",
        "right": [
          "Ihr Fahrer"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: „Ihr Fahrer“ (der Fahrer des Unternehmens) wird großgeschrieben."
      },
      {
        "para": 5,
        "wrong": "garnicht",
        "right": [
          "gar nicht"
        ],
        "category": "rechtschreibung",
        "what": "„gar nicht“ schreibt man getrennt."
      },
      {
        "para": 6,
        "wrong": "wir, das Sie",
        "right": [
          "wir, dass Sie"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ wird mit ss geschrieben."
      },
      {
        "para": 6,
        "wrong": "bitte sie",
        "right": [
          "bitte Sie"
        ],
        "category": "rechtschreibung",
        "what": "Höflichkeitsform: „Sie“ wird großgeschrieben."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Sehr geehrte Damen und Herren,",
        "why": "Anrede mit Beistrich richtig."
      },
      {
        "para": 3,
        "text": "ich schreibe Ihnen",
        "why": "Nach der Anrede mit Beistrich beginnt der Brief klein; richtig."
      },
      {
        "para": 4,
        "text": "wodurch es im Bus sehr heiß und stickig war",
        "why": "Richtig."
      },
      {
        "para": 4,
        "text": "Einigen Schülern wurde deshalb schlecht.",
        "why": "Richtig (3. Fall)."
      },
      {
        "para": 7,
        "text": "Mit freundlichen Grüßen",
        "why": "Grußformel ohne Beistrich und ohne Punkt; richtig."
      }
    ],
    "neutral": [
      {
        "para": 5,
        "text": "machen können",
        "why": "Indikativ in der indirekten Frage vertretbar; „machen könnten“ ebenso."
      },
      {
        "para": 5,
        "text": "so ein Verhalten geht",
        "why": "Umgangssprachlich für einen formellen Brief; „ein solches Verhalten ist inakzeptabel“ wäre besser, ist aber eine Stilfrage."
      },
      {
        "para": 4,
        "text": "niemand hat uns",
        "why": "Perfekt im Brief vertretbar."
      }
    ]
  },
  {
    "nr": "N06",
    "title": "Handyverbot an Schulen",
    "subject": "Deutsch",
    "schoolType": "Mittelschule",
    "klasse": 4,
    "textKind": "Erörterung",
    "task": "Verfasse eine Erörterung zum Thema „Handyverbot an Schulen – sinnvoll oder nicht?“. Bringe mindestens zwei Pro- und zwei Kontra-Argumente und schließe mit deiner eigenen Meinung.",
    "blocks": [
      {
        "text": "Handyverbot an Schulen – sinnvoll oder nicht?",
        "heading": true
      },
      {
        "text": "Fast jeder Jugendliche besitzt heutzutage ein Smartphone. Viele verbringen mehrere Stunden am Tag damit. Seit diesem Schuljahr dürfen die Handys an unserer Schule während dem Unterricht nicht mehr verwendet werden. Laut unserem Direktor, Herrn Klein, soll das die Konzentration verbessern. Ob das Verbot sinnvoll ist, möchte ich im folgenden erörtern.",
        "heading": false
      },
      {
        "text": "Für ein Handyverbot spricht, dass die Schüler im Unterricht weniger abgelenkt sind. Wenn das Handy vibriert, schaut man sofort nach wer geschrieben hat. Außerdem die Schüler reden in den Pausen wieder mehr miteinander, anstatt nur auf ihre Bildschirme zu starren. Ein weiteres Argument ist, dass es weniger Cybermobbing gibt, weil man nicht heimlich fotografieren kann.",
        "heading": false
      },
      {
        "text": "Gegen ein Verbot spricht jedoch, dass das Handy auch ein nützliches Werkzeug ist. Man kann damit schnell etwas im Internet nachschauen oder beim lernen einen Vokabeltrainer benutzen. Die Schrift auf den alten Schulcomputern ist oft zu klein, und das Handy ist schneller zur Hand. Manche Schüler brauchen es auch um ihre Eltern zu erreichen, wenn der Bus ausfällt. Ausserdem lernen die Jugendlichen nicht, verantwortungsvoll mit dem Handy umzugehen, wenn es einfach verboten wird.",
        "heading": false
      },
      {
        "text": "Meiner Meinung nach ist ein komplettes Verbot übertrieben. Besser wäre es, wenn es klare Regeln gibt, wann man das Handy benutzen darf und wann nicht. So würden die Schüler lernen selbst Verantwortung zu übernehmen. Ich hoffe, dass unsere Schule darüber nocheinmal nachdenkt.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "während dem Unterricht",
        "right": [
          "während des Unterrichts"
        ],
        "category": "grammatik",
        "what": "„während“ verlangt in der Standardsprache den 2. Fall: während des Unterrichts."
      },
      {
        "para": 2,
        "wrong": "im folgenden",
        "right": [
          "im Folgenden"
        ],
        "category": "rechtschreibung",
        "what": "„im Folgenden“ ist nominalisiert und wird großgeschrieben."
      },
      {
        "para": 3,
        "wrong": "nach wer",
        "right": [
          "nach, wer"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „wer“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 3,
        "wrong": "Außerdem die Schüler reden",
        "right": [
          "Außerdem reden die Schüler"
        ],
        "category": "satzbau",
        "what": "Im Hauptsatz steht das gebeugte Verb an zweiter Stelle: Außerdem reden die Schüler …"
      },
      {
        "para": 4,
        "wrong": "beim lernen",
        "right": [
          "beim Lernen"
        ],
        "category": "rechtschreibung",
        "what": "Nach „beim“ ist das Verb ein Nomen und wird großgeschrieben."
      },
      {
        "para": 4,
        "wrong": "auch um",
        "right": [
          "auch, um"
        ],
        "category": "zeichensetzung",
        "what": "Infinitivgruppen mit „um … zu“ werden immer mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "Ausserdem",
        "right": [
          "Außerdem"
        ],
        "category": "rechtschreibung",
        "what": "Nach dem Zwielaut au steht ß: außerdem."
      },
      {
        "para": 5,
        "wrong": "nocheinmal",
        "right": [
          "noch einmal"
        ],
        "category": "rechtschreibung",
        "what": "„noch einmal“ schreibt man getrennt."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Laut unserem Direktor, Herrn Klein, soll",
        "why": "„laut“ mit 3. Fall, Beifügung in Beistrichen; richtig."
      },
      {
        "para": 3,
        "text": "anstatt nur auf ihre Bildschirme zu starren",
        "why": "Infinitivgruppe mit „anstatt“ mit Beistrich; richtig."
      },
      {
        "para": 3,
        "text": "Ein weiteres Argument ist, dass",
        "why": "Richtig."
      },
      {
        "para": 4,
        "text": "ist oft zu klein, und das Handy",
        "why": "Beistrich vor „und“ zwischen Hauptsätzen ist erlaubt; richtig."
      },
      {
        "para": 5,
        "text": "Meiner Meinung nach",
        "why": "Richtig."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "nicht, verantwortungsvoll",
        "why": "Der Beistrich vor der Infinitivgruppe ist hier freigestellt."
      },
      {
        "para": 5,
        "text": "wenn es klare Regeln gibt",
        "why": "„gäbe“ (Konjunktiv II) wäre stilistisch besser, „gibt“ ist vertretbar."
      },
      {
        "para": 5,
        "text": "lernen selbst Verantwortung",
        "why": "Beistrich nach „lernen“ ist freigestellt."
      }
    ]
  },
  {
    "nr": "N07",
    "title": "Unfallbericht",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 1,
    "textKind": "Bericht",
    "task": "Ein Mitschüler hatte am Schulweg einen Unfall. Schreibe als Zeugin oder Zeuge einen Unfallbericht für die Direktion. Schreibe sachlich und im Präteritum.",
    "blocks": [
      {
        "text": "Unfallbericht",
        "heading": true
      },
      {
        "text": "Am Montag, dem 6. Oktober, ereignete sich gegen 7.40 Uhr an der Kreuzung Gartengasse und Bahnhofstraße ein Unfall. Ich war zu diesem Zeitpunkt mit meinen Mitschüler Noah Berisha am Weg zur Schule.",
        "heading": false
      },
      {
        "text": "Noah fuhr mit seinem Fahrrad auf dem Radweg. Ein silbernes Auto bog von der Gartengasse nach rechts ab und hat Noah übersehen. Das Auto streifte das Hinterrad, wodurch Noah stürzte. Er fiel auf die Strasse und schlug sich das Knie auf.",
        "heading": false
      },
      {
        "text": "Die Lenkerin blieb sofort stehen und stieg aus. Sie fragte Noah ob er verletzt ist. Ein Pasant rief die Rettung. Noahs Helm war zerkratzt, aber er hatte den Kopf nicht verletzt. Sein Knie blutete stark und er konnte nicht mehr aufstehen.",
        "heading": false
      },
      {
        "text": "Nach ungefähr zehn Minuten kam der Rettungswagen und brachte ihn ins Krankenhaus. Ich gieng dann alleine zur Schule und erzählte Frau Prof. Lindner, was passiert war. Sie hat sofort Noahs Eltern angerufen.",
        "heading": false
      },
      {
        "text": "Meiner Meinung nach ist die Kreuzung sehr gefährlich, weil die Autofahrer die Radfahrer oft nicht sehen. Vielleicht könnte man dort einen Spiegel aufstellen.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "meinen Mitschüler",
        "right": [
          "meinem Mitschüler"
        ],
        "category": "grammatik",
        "what": "„mit“ verlangt den 3. Fall: mit meinem Mitschüler."
      },
      {
        "para": 3,
        "wrong": "hat Noah übersehen",
        "right": [
          "übersah Noah"
        ],
        "category": "grammatik",
        "what": "Im Bericht Präteritum, wie im übrigen Satz: bog ab und übersah Noah."
      },
      {
        "para": 3,
        "wrong": "Strasse",
        "right": [
          "Straße"
        ],
        "category": "rechtschreibung",
        "what": "Nach langem Selbstlaut steht ß: Straße."
      },
      {
        "para": 4,
        "wrong": "Noah ob",
        "right": [
          "Noah, ob"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „ob“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 4,
        "wrong": "Pasant",
        "right": [
          "Passant"
        ],
        "category": "rechtschreibung",
        "what": "Passant schreibt man mit ss."
      },
      {
        "para": 5,
        "wrong": "gieng",
        "right": [
          "ging"
        ],
        "category": "rechtschreibung",
        "what": "gehen – ging, ohne e."
      },
      {
        "para": 5,
        "wrong": "hat sofort Noahs Eltern angerufen",
        "right": [
          "rief sofort Noahs Eltern an"
        ],
        "category": "grammatik",
        "what": "Im Bericht Präteritum: Sie rief sofort Noahs Eltern an."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Am Montag, dem 6. Oktober, ereignete sich",
        "why": "Richtig."
      },
      {
        "para": 2,
        "text": "am Weg zur Schule",
        "why": "Österreichisch („auf dem Weg“); richtig."
      },
      {
        "para": 3,
        "text": "wodurch Noah stürzte",
        "why": "Richtig."
      },
      {
        "para": 4,
        "text": "Die Lenkerin",
        "why": "Österreichisch für Fahrerin; richtig."
      },
      {
        "para": 4,
        "text": "rief die Rettung",
        "why": "Österreichisch für Rettungsdienst; richtig."
      },
      {
        "para": 4,
        "text": "Noahs Helm war zerkratzt, aber",
        "why": "Genitiv ohne Apostroph und Beistrich vor „aber“; richtig."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "verletzt ist",
        "why": "Indikativ in der indirekten Frage vertretbar; „verletzt sei“ ebenso."
      },
      {
        "para": 4,
        "text": "blutete stark und er",
        "why": "Beistrich vor „und“ zwischen Hauptsätzen ist freigestellt."
      },
      {
        "para": 4,
        "text": "er hatte den Kopf nicht verletzt",
        "why": "Strittig (Blindprüfung): Standard ist „sich den Kopf verletzen“; ohne „sich“ umgangssprachlich. Mit und ohne Korrektur vertretbar."
      },
      {
        "para": 6,
        "text": "Meiner Meinung nach ist die Kreuzung sehr gefährlich",
        "why": "Eine eigene Meinung passt nicht in einen Unfallbericht; das ist ein Hinweis zum Aufbau, kein Sprachfehler."
      },
      {
        "para": 5,
        "text": "alleine",
        "why": "Umgangssprachlich für „allein“; vertretbar."
      }
    ]
  },
  {
    "nr": "N08",
    "title": "Analyse: „Die Stadt gehört nicht den Autos“",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 6,
    "textKind": "Textanalyse",
    "task": "Analysiere den Kommentar „Die Stadt gehört nicht den Autos“ von Sabine Hartl (erschienen im „Alpenboten“ am 12. September). Gehe auf Inhalt, Aufbau, Argumentation und sprachliche Mittel ein und beurteile die Wirkung auf die Leserinnen und Leser. Schreibe 400 bis 500 Wörter.",
    "blocks": [
      {
        "text": "Analyse des Kommentars „Die Stadt gehört nicht den Autos“",
        "heading": true
      },
      {
        "text": "Der Kommentar „Die Stadt gehört nicht den Autos“ von Sabine Hartl, einer bekannten Lokaljournalistin, erschien am 12. September in der Tageszeitung „Alpenbote“. Die Autorin spricht sich darin für eine autofreie Innenstadt aus und kritisiert, dass die Stadtpolitik seit Jahren nur an die Autofahrer denken würde.",
        "heading": false
      },
      {
        "text": "Zu Beginn schildert Hartl eine alltägliche Situation: Eine Mutter versucht mit dem Kinderwagen zwischen parkenden Autos die Straße zu überqueren. Durch dieses Beispiel holt sie die Leser direkt ab und weckt Mitgefühl. Danach führte sie Zahlen an, laut denen in der Innenstadt über 60 Prozent der Fläche für Fahrbahnen und Parkplätze verwendet werden. Diese Fakten sollen die Argumentation sachlich untermauern.",
        "heading": false
      },
      {
        "text": "Im Hauptteil verwendet die Autorin viele rethorische Mittel. Besonders auffällig ist die Metapher „Blechlawine“, welche die Masse an Autos bildhaft darstellt. Auch rhetorische Fragen wie „Wem gehört eigentlich die Stadt?“ regen die Leser zum nachdenken an. Durch die Antithese „Lebensraum statt Parkraum“ wird der Kern ihrer Forderung auf den Punkt gebracht.",
        "heading": false
      },
      {
        "text": "Hartl argumentiert, dass eine autofreie Innenstadt sowohl die Lebensqualität, als auch die Umsatzzahlen der Geschäfte steigern würde. Als Beleg nennt sie das Beispiel einer Stadt in den Niederlanden, in welcher der Handel nach der Umgestaltung um zwölf Prozent zugenommen hat. Mögliche Gegenargumente, wie etwa die schlechtere Erreichbarkeit für ältere Menschen, werden jedoch nur kurz erwähnt und sofort entkräftet.",
        "heading": false
      },
      {
        "text": "Die Sprache des Kommentars ist überwiegend sachlich, an manchen Stellen aber auch emotional. Durch Ausdrücke wie „Abgasdschungel“ oder „Parkplatzwahn“ wird die Meinung der Autorin deutlich. Der Text wirkt dadurch zwar überzeugend, aber auch etwas einseitig. Das steht im Wiederspruch zu ihrem Anspruch auf Sachlichkeit. Meiner Meinung nach hätte die Autorin die Bedenken der Geschäftsleute ernster nehmen sollen, da diese ja von den Einnahmen abhänig sind.",
        "heading": false
      },
      {
        "text": "Zusammenfassend lässt sich sagen, das der Kommentar seine Ziele gut erreicht. Er regt zur Diskussion an und zeigt, dass eine Stadt auch anders aussehen kann. Ob die Forderungen umsetzbar sind, bleibt jedoch offen.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "denken würde",
        "right": [
          "denke"
        ],
        "category": "grammatik",
        "what": "Indirekte Rede: Konjunktiv I („denke“); die würde-Form ist hier umgangssprachlich, weil sich der Konjunktiv I vom Indikativ unterscheidet."
      },
      {
        "para": 3,
        "wrong": "führte",
        "right": [
          "führt"
        ],
        "category": "grammatik",
        "what": "Eine Textanalyse steht im Präsens: Danach führt sie Zahlen an."
      },
      {
        "para": 4,
        "wrong": "rethorische",
        "right": [
          "rhetorische"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort aus dem Griechischen: rhetorisch (rh)."
      },
      {
        "para": 4,
        "wrong": "zum nachdenken",
        "right": [
          "zum Nachdenken"
        ],
        "category": "rechtschreibung",
        "what": "Nach „zum“ ist das Verb nominalisiert und wird großgeschrieben."
      },
      {
        "para": 5,
        "wrong": "Lebensqualität, als auch",
        "right": [
          "Lebensqualität als auch"
        ],
        "category": "zeichensetzung",
        "what": "Vor „als auch“ in „sowohl … als auch“ steht kein Beistrich."
      },
      {
        "para": 6,
        "wrong": "Wiederspruch",
        "right": [
          "Widerspruch"
        ],
        "category": "rechtschreibung",
        "what": "„wider“ bedeutet „gegen“: Widerspruch ohne ie."
      },
      {
        "para": 6,
        "wrong": "abhänig",
        "right": [
          "abhängig"
        ],
        "category": "rechtschreibung",
        "what": "abhängig (von „hängen“) mit g."
      },
      {
        "para": 7,
        "wrong": "sagen, das der",
        "right": [
          "sagen, dass der"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ wird mit ss geschrieben."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "von Sabine Hartl, einer bekannten Lokaljournalistin, erschien",
        "why": "Beifügung im 3. Fall in Beistrichen; richtig."
      },
      {
        "para": 3,
        "text": "laut denen",
        "why": "„laut“ mit 3. Fall; richtig."
      },
      {
        "para": 4,
        "text": "welche die Masse an Autos bildhaft darstellt",
        "why": "Relativpronomen „welche“ ist richtig."
      },
      {
        "para": 5,
        "text": "Mögliche Gegenargumente, wie etwa die schlechtere Erreichbarkeit für ältere Menschen, werden",
        "why": "Eingeschobene Erläuterung in Beistrichen; richtig."
      },
      {
        "para": 6,
        "text": "hätte die Autorin die Bedenken der Geschäftsleute ernster nehmen sollen",
        "why": "Ersatzinfinitiv „nehmen sollen“; richtig."
      },
      {
        "para": 7,
        "text": "Ob die Forderungen umsetzbar sind, bleibt jedoch offen.",
        "why": "Richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "in der Tageszeitung „Alpenbote“",
        "why": "„im „Alpenboten““ ebenso richtig."
      },
      {
        "para": 3,
        "text": "versucht mit",
        "why": "Beistrich nach „versucht“ vor der Infinitivgruppe ist freigestellt."
      },
      {
        "para": 3,
        "text": "verwendet werden",
        "why": "Nach „über 60 Prozent der Fläche“ sind Einzahl und Mehrzahl möglich."
      },
      {
        "para": 3,
        "text": "holt sie die Leser direkt ab",
        "why": "Umgangssprachlich angehaucht, aber vertretbar."
      },
      {
        "para": 5,
        "text": "steigern würde",
        "why": "Konjunktiv II für eine Annahme ist vertretbar; „steigere“ ebenso."
      },
      {
        "para": 5,
        "text": "zugenommen hat",
        "why": "Indikativ im Relativsatz vertretbar; „zugenommen habe“ ebenso."
      }
    ]
  },
  {
    "nr": "N09",
    "title": "Interpretation: „Die letzte Fähre“",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 7,
    "textKind": "Textinterpretation",
    "task": "Interpretiere die Kurzgeschichte „Die letzte Fähre“ von Johann Moser. Gehe auf Inhalt, Figuren, Erzählperspektive, sprachliche Gestaltung und Deutung ein. Schreibe 450 bis 550 Wörter.",
    "blocks": [
      {
        "text": "Interpretation der Kurzgeschichte „Die letzte Fähre“",
        "heading": true
      },
      {
        "text": "In der Kurzgeschichte „Die letzte Fähre“ von Johann Moser geht es um den alten Fährmann Wenzel, der an seinem letzten Arbeitstag ein letztes mal über den Fluss fährt. Am nächsten Tag soll eine neue Brücke eröffnet werden, wodurch seine Fähre überflüssig wird. Die Geschichte thematisiert den Verlust von Traditionen und das Gefühl, nicht mehr gebraucht zu werden.",
        "heading": false
      },
      {
        "text": "Der Text beginnt unmittelbar mit der Handlung, was typisch für eine Kurzgeschichte ist. Wenzel steht im Morgennebel an seinem Steg und wartet auf Fahrgäste. Doch es kommt nur seine Enkelin Marie, die ihn ein letztes Mal begleiten möchte. Während der Überfahrt sprechen die beiden kaum. Wenzel beobachtet das Wasser und erinnert sich an die vielen Menschen, welche er in vierzig Jahren über den Fluss gebracht hatte.",
        "heading": false
      },
      {
        "text": "Erzählt wird aus der Sicht eines personalen Erzählers, der sich ganz auf Wenzel konzentriert. Dadurch erfährt der Leser seine Gedanken und Gefühle, wodurch man sich gut in ihn hineinversetzen kann. Auffällig ist, das Wenzel kaum spricht und seine Gefühle nur durch kleine Gesten zeigt. Als Marie ihn fragt ob er traurig ist, zuckt er nur mit den Schultern.",
        "heading": false
      },
      {
        "text": "Die Sprache ist schlicht und besteht überwiegend aus kurzen Hauptsätzen. Dadurch wirkt die Athmosphäre ruhig, fast schon schwermütig. Der Nebel kann als Symbol für die ungewisse Zukunft gedeutet werden, die Wenzel erwartet. Die Brücke hingegen steht für den Fortschritt, der zwar das Leben der Menschen erleichtert aber auch Altes verdrängt. Besonders eindrucksvoll ist das offene Ende: Wenzel bindet die Fähre ein letztes Mal fest und geht, ohne sich umzudrehen, nachhause.",
        "heading": false
      },
      {
        "text": "Im großen und ganzen zeigt die Geschichte sehr berührend, wie schwer es für ältere Menschen sein kann, sich mit Veränderungen abzufinden. Gleichzeitig wird aber deutlich, dass der Fortschritt nicht aufzuhalten ist. Gerade deshalb ist der Text auch heute noch aktuell, weil viele Berufe durch die Digitalisierung verschwinden.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "letztes mal",
        "right": [
          "letztes Mal"
        ],
        "category": "rechtschreibung",
        "what": "„ein letztes Mal“: Nach einem Adjektiv ist „Mal“ ein Nomen und wird großgeschrieben."
      },
      {
        "para": 3,
        "wrong": "gebracht hatte",
        "right": [
          "gebracht hat"
        ],
        "category": "grammatik",
        "what": "Die Interpretation steht im Präsens; Vorzeitigkeit dazu drückt das Perfekt aus: gebracht hat."
      },
      {
        "para": 4,
        "wrong": "ist, das Wenzel",
        "right": [
          "ist, dass Wenzel"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ wird mit ss geschrieben."
      },
      {
        "para": 4,
        "wrong": "fragt ob",
        "right": [
          "fragt, ob"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „ob“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 5,
        "wrong": "Athmosphäre",
        "right": [
          "Atmosphäre"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort aus dem Griechischen: Atmosphäre ohne h nach dem t."
      },
      {
        "para": 5,
        "wrong": "erleichtert aber",
        "right": [
          "erleichtert, aber"
        ],
        "category": "zeichensetzung",
        "what": "Vor „aber“ steht ein Beistrich."
      },
      {
        "para": 6,
        "wrong": "großen und ganzen",
        "right": [
          "Großen und Ganzen"
        ],
        "category": "rechtschreibung",
        "what": "„im Großen und Ganzen“ schreibt man groß."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "das Gefühl, nicht mehr gebraucht zu werden",
        "why": "Infinitivgruppe nach einem Nomen mit Beistrich; richtig."
      },
      {
        "para": 3,
        "text": "was typisch für eine Kurzgeschichte ist",
        "why": "„was“ bezieht sich auf den ganzen Satz; richtig."
      },
      {
        "para": 3,
        "text": "sprechen die beiden kaum",
        "why": "„die beiden“ wird kleingeschrieben; richtig."
      },
      {
        "para": 3,
        "text": "ein letztes Mal",
        "why": "Richtig."
      },
      {
        "para": 5,
        "text": "geht, ohne sich umzudrehen,",
        "why": "Infinitivgruppe mit „ohne“ mit Beistrichen; richtig."
      },
      {
        "para": 6,
        "text": "sich mit Veränderungen abzufinden",
        "why": "Richtig."
      }
    ],
    "neutral": [
      {
        "para": 4,
        "text": "traurig ist",
        "why": "Indikativ in der indirekten Frage vertretbar; „traurig sei“ ebenso."
      },
      {
        "para": 6,
        "text": "Gerade deshalb ist der Text",
        "why": "Strittig: „deshalb … weil“ begründet doppelt (Stil); keine der beiden Blindprüfungen sah einen Fehler."
      },
      {
        "para": 5,
        "text": "nachhause",
        "why": "In Österreich und laut Duden auch zusammen zulässig; „nach Hause“ ebenso richtig."
      },
      {
        "para": 3,
        "text": "welche er",
        "why": "„die er“ ebenso richtig."
      },
      {
        "para": 4,
        "text": "der Leser",
        "why": "„man“ und „der Leser“ im selben Satz sind eine Stilfrage."
      }
    ]
  },
  {
    "nr": "N10",
    "title": "Interpretation: „Novembermorgen“",
    "subject": "Deutsch",
    "schoolType": "Gymnasium",
    "klasse": 8,
    "textKind": "Gedichtinterpretation",
    "task": "Interpretiere das Gedicht „Novembermorgen“ von Elfriede Stern (1962). Beschreibe Aufbau, Form und sprachliche Bilder, belege mit Versangaben und deute das Gedicht.",
    "blocks": [
      {
        "text": "Interpretation des Gedichts „Novembermorgen“",
        "heading": true
      },
      {
        "text": "Das Gedicht „Novembermorgen“ wurde 1962 von Elfriede Stern verfasst. Es beschreibt einen grauen Morgen im Spätherbst und die Einsamkeit des lyrischen Ichs. Das Gedicht besteht aus drei Strophen mit je vier Versen. Es liegt ein Kreuzreim vor und das Metrum ist ein vierhebiger Jambus.",
        "heading": false
      },
      {
        "text": "In der ersten Strophe wird die Stimmung des Morgens beschrieben. Das lyrische Ich blickt aus dem Fenster und sieht „kein Stern mehr über dem Dach“ (V. 3). Der Himmel ist grau und leer, was die innere Leere des Sprechers wiederspiegelt. Die Personifikation „der Nebel kriecht durch die Gassen“ (V. 2) verstärken die bedrückende Stimmung.",
        "heading": false
      },
      {
        "text": "In der zweiten Strophe wendet sich das lyrische Ich an ein Du, das offenbar nicht mehr da ist. Die Verse „Du gingst im Mai, / und mit dir ging das Licht“ (V. 5 f.) deuten darauf hin, dass die geliebte Person gestorben ist, oder die Beziehung beendet wurde. Der Kontrast zwischen dem Mai und dem November unterstreicht, wie sehr sich das Leben des Sprechers verändert hat.",
        "heading": false
      },
      {
        "text": "Die letzte Strophe wirkt zunächst Hoffnungslos, endet aber mit einer überraschenden Wendung. Das lyrische Ich zündet eine Kerze an und sagt: „Ich warte, bis es wieder Tag wird“ (V. 12). Diese Zeile lässt sich als Zeichen der Hoffnung verstehen obwohl die Trauer bestehen bleibt. Durch das Symbol der Kerze, das für Wärme und Erinnerung steht, wird ein Gegenpol zur Kälte des Novembers geschaffen.",
        "heading": false
      },
      {
        "text": "Insgesamt handelt es sich um ein stimmungsvolles Gedicht über Verlust und Trauer. Die schlichte Sprache und die klaren Bilder machen es auch für heutige Leser zugänglich. Mich hat besonders das Ende angesprochen, da es zeigt dass man auch in schweren Zeiten Hoffnung schöpfen kann.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 3,
        "wrong": "sieht „kein Stern mehr über dem Dach“ (V. 3)",
        "right": [
          "sieht, dass „kein Stern mehr über dem Dach“ (V. 3) steht",
          "stellt fest: „kein Stern mehr über dem Dach“ (V. 3)",
          "sieht keinen Stern mehr über dem Dach (vgl. V. 3)"
        ],
        "category": "satzbau",
        "what": "Das wörtliche Zitat passt grammatisch nicht in den Satz (nach „sieht“ wäre „keinen Stern“ nötig); man ändert dann den eigenen Satz, nicht das Zitat.",
        "optional": true
      },
      {
        "para": 3,
        "wrong": "wiederspiegelt",
        "right": [
          "widerspiegelt"
        ],
        "category": "rechtschreibung",
        "what": "„wider“ bedeutet „zurück, gegen“: widerspiegeln ohne ie."
      },
      {
        "para": 3,
        "wrong": "verstärken",
        "right": [
          "verstärkt"
        ],
        "category": "grammatik",
        "what": "Subjekt ist „die Personifikation“ (Einzahl): verstärkt."
      },
      {
        "para": 4,
        "wrong": "ist, oder",
        "right": [
          "ist oder"
        ],
        "category": "zeichensetzung",
        "what": "Vor „oder“, das zwei gleichrangige Teile verbindet, steht kein Beistrich."
      },
      {
        "para": 5,
        "wrong": "Hoffnungslos",
        "right": [
          "hoffnungslos"
        ],
        "category": "rechtschreibung",
        "what": "Das Adjektiv „hoffnungslos“ wird kleingeschrieben."
      },
      {
        "para": 5,
        "wrong": "verstehen obwohl",
        "right": [
          "verstehen, obwohl"
        ],
        "category": "zeichensetzung",
        "what": "Der Nebensatz mit „obwohl“ wird mit Beistrich abgetrennt."
      },
      {
        "para": 6,
        "wrong": "zeigt dass",
        "right": [
          "zeigt, dass"
        ],
        "category": "zeichensetzung",
        "what": "Vor dem dass-Satz steht ein Beistrich."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "des lyrischen Ichs",
        "why": "Richtig."
      },
      {
        "para": 4,
        "text": "(V. 5 f.)",
        "why": "Versangabe richtig."
      },
      {
        "para": 4,
        "text": "„Du gingst im Mai, / und mit dir ging das Licht“",
        "why": "Zitat mit Versgrenze richtig wiedergegeben; im Zitat wird nichts verbessert."
      },
      {
        "para": 5,
        "text": "„Ich warte, bis es wieder Tag wird“ (V. 12)",
        "why": "Zitat; richtig."
      },
      {
        "para": 5,
        "text": "das für Wärme und Erinnerung steht",
        "why": "„das“ bezieht sich auf „das Symbol“; richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "Kreuzreim vor und das",
        "why": "Beistrich vor „und“ zwischen Hauptsätzen ist freigestellt."
      },
      {
        "para": 6,
        "text": "heutige Leser",
        "why": "Ohne Gendern vertretbar."
      }
    ]
  },
  {
    "nr": "N11",
    "title": "Analyse einer Eröffnungsrede",
    "subject": "Deutsch",
    "schoolType": "HTL",
    "klasse": 3,
    "textKind": "Textanalyse",
    "task": "Analysiere die Rede von Bürgermeisterin Andrea Wolf zur Eröffnung des neuen Jugendzentrums in Steinach. Gehe auf Redesituation, Aufbau, Argumentationsstrategie und rhetorische Mittel ein.",
    "blocks": [
      {
        "text": "Analyse der Eröffnungsrede von Bürgermeisterin Wolf",
        "heading": true
      },
      {
        "text": "Die Rede wurde von Bürgermeisterin Andrea Wolf am 4. Oktober anlässlich der Eröffnung des neuen Jugendzentrums in Steinach gehalten. Das Publikum bestand aus Jugendlichen, Eltern, Vereinsvertretern und Gemeinderäten. Ziel der Rede ist es, die Jugendlichen für das neue Angebot zu begeistern und gleichzeitig den Erwachsenen zu zeigen, das sich die Investition gelohnt hat.",
        "heading": false
      },
      {
        "text": "Zu Beginn begrüßt Wolf die Anwesenden persönlich und bedankt sich bei allen, die am Bau beteiligt waren. Dadurch schafft sie eine positive Stimmung und baut eine Beziehung zum Publikum auf. Anschließend erzählt sie eine Anektode aus ihrer eigenen Jugend, als es in der Gemeinde noch keinen Treffpunkt für Jugendliche gab. Sie sagt: „Wer allein ist, ist wie ein Wolf ohne Rudel.“ Mit diesem Vergleich spielt sie auf ihren eigenen Namen an, was beim Publikum für Lacher sorgte.",
        "heading": false
      },
      {
        "text": "Im Hauptteil argumentiert die Bürgermeisterin vor allem mit dem Nutzen für die Gemeinschaft. Sie betont, dass Jugendliche einen Ort brauchen, an dem sie sich sicher fühlen. Außerdem verweist sie auf eine Umfrage, wonach sich 80 Prozent der Jugendlichen mehr Freizeitangebote wünschen. Durch die Anapher „Wir bauen nicht nur Räume, wir bauen Zukunft. Wir bauen Vertrauen.“ wird ihre Botschaft eindringlich verstärkt.",
        "heading": false
      },
      {
        "text": "Kritisch anzumerken ist, dass die Rede kaum auf mögliche Probleme eingeht wie zum Beispiel die laufenden Kosten oder Lärmbeschwerden der Anrainer. Stattdessen werden nur die positiven Seiten hervorgehoben. Dies ist bei einer Eröffnungsrede aber verständlich, da es sich um einen feierlichen Anlass handelt.",
        "heading": false
      },
      {
        "text": "Zusammenfassend ist die Rede gut auf das Publikum abgestimmt. Durch die persönliche Anekdote, die klare Struktur und die eingesetzten Stilmittel wirkt sie glaubwürdig und überzeugend. Die Rede erfüllt damit alle Standarts einer Eröffnungsrede. Meiner Meinung nach hat die Bürgermeisterin ihr Ziel die Jugendlichen anzusprechen erreicht.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "zeigen, das sich",
        "right": [
          "zeigen, dass sich"
        ],
        "category": "rechtschreibung",
        "what": "Die Konjunktion „dass“ wird mit ss geschrieben."
      },
      {
        "para": 3,
        "wrong": "Anektode",
        "right": [
          "Anekdote"
        ],
        "category": "rechtschreibung",
        "what": "Fremdwort: Anekdote (k vor d)."
      },
      {
        "para": 3,
        "wrong": "sorgte",
        "right": [
          "sorgt"
        ],
        "category": "grammatik",
        "what": "Eine Textanalyse steht im Präsens: … was für Lacher sorgt."
      },
      {
        "para": 4,
        "wrong": "Vertrauen.“ wird",
        "right": [
          "Vertrauen“ wird"
        ],
        "category": "zeichensetzung",
        "what": "Geht der Satz nach einem angeführten Satz weiter, entfällt dessen Schlusspunkt."
      },
      {
        "para": 5,
        "wrong": "eingeht wie",
        "right": [
          "eingeht, wie"
        ],
        "category": "zeichensetzung",
        "what": "Nachgestellte Erläuterungen mit „wie zum Beispiel“ werden mit Beistrich abgetrennt."
      },
      {
        "para": 6,
        "wrong": "Standarts",
        "right": [
          "Standards"
        ],
        "category": "rechtschreibung",
        "what": "der Standard, die Standards (mit d)."
      },
      {
        "para": 6,
        "wrong": "Ziel die Jugendlichen anzusprechen erreicht",
        "right": [
          "Ziel, die Jugendlichen anzusprechen, erreicht"
        ],
        "category": "zeichensetzung",
        "what": "Eine Infinitivgruppe, die von einem Nomen („Ziel“) abhängt, wird mit Beistrichen abgetrennt."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "Ziel der Rede ist es, die Jugendlichen",
        "why": "Infinitivgruppe mit Verweiswort „es“, Beistrich richtig."
      },
      {
        "para": 3,
        "text": "„Wer allein ist, ist wie ein Wolf ohne Rudel.“",
        "why": "Zitat; richtig."
      },
      {
        "para": 4,
        "text": "wonach sich 80 Prozent der Jugendlichen mehr Freizeitangebote wünschen",
        "why": "Richtig."
      },
      {
        "para": 5,
        "text": "Anrainer",
        "why": "Österreichisch für Anwohner; richtig."
      },
      {
        "para": 6,
        "text": "persönliche Anekdote",
        "why": "Richtig."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "Das Publikum bestand",
        "why": "Präteritum für die Redesituation ist vertretbar."
      },
      {
        "para": 2,
        "text": "wurde von Bürgermeisterin Andrea Wolf am 4. Oktober",
        "why": "Präteritum für die Redesituation ist vertretbar."
      }
    ]
  },
  {
    "nr": "N12",
    "title": "My weekend",
    "subject": "Englisch",
    "schoolType": "Mittelschule",
    "klasse": 2,
    "textKind": "Story",
    "task": "Write about your last weekend (80–120 words). What did you do? Who were you with?",
    "blocks": [
      {
        "text": "My weekend",
        "heading": true
      },
      {
        "text": "Last weekend was great. On Saturday I go to the cinema with my friend Will. We watched a funny film about a dog. After the film we eated pizza in a small restaurant. The pizza was very delicious.",
        "heading": false
      },
      {
        "text": "On Sunday my family and me visited my grandparents. They live in a small village near the mountains. My grandma make the best apple strudel in the world. In the afternoon we goes for a walk and I find a little cat. It's fur was black and white.",
        "heading": false
      },
      {
        "text": "In the evening I was very tired. Next weekend I will play football with Will and Mark. I can't wait!",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "I go",
        "right": [
          "I went"
        ],
        "category": "grammatik",
        "what": "Past simple for a finished action in the past (last Saturday): I went."
      },
      {
        "para": 2,
        "wrong": "eated",
        "right": [
          "ate"
        ],
        "category": "grammatik",
        "what": "Irregular verb: eat – ate – eaten."
      },
      {
        "para": 3,
        "wrong": "my family and me visited",
        "right": [
          "my family and I visited"
        ],
        "category": "grammatik",
        "what": "Subject form: “my family and I” (I visited, not me visited)."
      },
      {
        "para": 3,
        "wrong": "make",
        "right": [
          "makes"
        ],
        "category": "grammatik",
        "what": "Third person singular in the present simple: she makes."
      },
      {
        "para": 3,
        "wrong": "we goes",
        "right": [
          "we went"
        ],
        "category": "grammatik",
        "what": "Past simple (we went); “goes” is also the wrong form for “we”."
      },
      {
        "para": 3,
        "wrong": "I find",
        "right": [
          "I found"
        ],
        "category": "grammatik",
        "what": "Past simple for the story: I found."
      },
      {
        "para": 3,
        "wrong": "It's fur",
        "right": [
          "Its fur"
        ],
        "category": "rechtschreibung",
        "what": "Possessive “its” has no apostrophe; “it's” means “it is”."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "We watched a funny film about a dog.",
        "why": "Correct."
      },
      {
        "para": 3,
        "text": "They live in a small village near the mountains.",
        "why": "Present simple for a general fact; correct."
      },
      {
        "para": 4,
        "text": "Next weekend I will play football with Will and Mark.",
        "why": "Correct."
      },
      {
        "para": 4,
        "text": "I can't wait!",
        "why": "Correct."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "very delicious",
        "why": "Common and acceptable at this level; “really delicious” sounds more natural."
      },
      {
        "para": 3,
        "text": "apple strudel",
        "why": "Correct; “Apple strudel” capitalisation not needed."
      }
    ]
  },
  {
    "nr": "N13",
    "title": "Email: A week at the wildlife centre",
    "subject": "Englisch",
    "schoolType": "Gymnasium",
    "klasse": 4,
    "textKind": "Letter",
    "task": "Write an email to your English pen friend about something special you did last month (150–180 words).",
    "blocks": [
      {
        "text": "Dear Hope,",
        "heading": false
      },
      {
        "text": "I hope you are well. Sorry that I haven't written since two months, but I was very busy with school. Last month I did something really special and I want to tell you about it.",
        "heading": false
      },
      {
        "text": "Our class spent three days at a wildlife rescue centre near Graz. The centre takes care of injured animals until they can go back into the wild. The leader of the centre, Mrs Fox, gave us a lot of informations about the animals. She showed us a young fox which was hit by a car. It was so cute, but it's leg was still broken.",
        "heading": false
      },
      {
        "text": "Every morning we had to clean the cages and feed the animals. Me and my friend Lena were responsible for two owls. At first I was a bit scared of them, but after a while they got used to us. In the evening we have cooked together and played games.",
        "heading": false
      },
      {
        "text": "On the last day it was raining the whole morning, so we stayed inside and made posters about protecting wild animals. We also saw much other animals, for example hedgehogs, deer and a badger. I learned a lot, it was the best school trip ever. Unfortunatly the three days were over too fast.",
        "heading": false
      },
      {
        "text": "Next summer, maybe you can visit me in Austria? Then I can show you the centre. Please write back soon!",
        "heading": false
      },
      {
        "text": "Best wishes,",
        "heading": false
      },
      {
        "text": "Jakob",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "since two months",
        "right": [
          "for two months"
        ],
        "category": "grammatik",
        "what": "“for” with a period of time, “since” with a point in time: for two months."
      },
      {
        "para": 3,
        "wrong": "informations",
        "right": [
          "information"
        ],
        "category": "grammatik",
        "what": "“information” is uncountable and has no plural."
      },
      {
        "para": 3,
        "wrong": "it's leg",
        "right": [
          "its leg"
        ],
        "category": "rechtschreibung",
        "what": "Possessive “its” has no apostrophe."
      },
      {
        "para": 4,
        "wrong": "Me and my friend Lena were",
        "right": [
          "My friend Lena and I were",
          "Lena and I were"
        ],
        "category": "grammatik",
        "what": "Subject form “I”, and politely last: My friend Lena and I were …"
      },
      {
        "para": 4,
        "wrong": "we have cooked",
        "right": [
          "we cooked"
        ],
        "category": "grammatik",
        "what": "Past simple with a finished time in the past (in the evening of the trip), not present perfect."
      },
      {
        "para": 5,
        "wrong": "much other animals",
        "right": [
          "many other animals"
        ],
        "category": "grammatik",
        "what": "“many” with countable nouns in the plural."
      },
      {
        "para": 5,
        "wrong": "a lot, it was",
        "right": [
          "a lot. It was",
          "a lot – it was",
          "a lot; it was",
          "a lot and it was"
        ],
        "category": "zeichensetzung",
        "what": "Two main clauses joined only by a comma (comma splice).",
        "optional": true
      },
      {
        "para": 5,
        "wrong": "Unfortunatly",
        "right": [
          "Unfortunately"
        ],
        "category": "rechtschreibung",
        "what": "Spelling: unfortunate + -ly = unfortunately."
      }
    ],
    "correct": [
      {
        "para": 1,
        "text": "Dear Hope,",
        "why": "Correct greeting."
      },
      {
        "para": 3,
        "text": "centre",
        "why": "British spelling; correct."
      },
      {
        "para": 3,
        "text": ", Mrs Fox, gave",
        "why": "Apposition with commas; “Mrs” without a full stop is British usage; correct."
      },
      {
        "para": 4,
        "text": "they got used to us",
        "why": "Correct."
      },
      {
        "para": 5,
        "text": "hedgehogs, deer and a badger",
        "why": "“deer” has the same form in the plural; correct."
      },
      {
        "para": 7,
        "text": "Best wishes,",
        "why": "Correct."
      }
    ],
    "neutral": [
      {
        "para": 3,
        "text": "The leader of the centre",
        "why": "Contested (blind review): “head”/“manager” of the centre is more idiomatic; “leader” understandable. Either acceptable."
      },
      {
        "para": 3,
        "text": "which was hit by a car",
        "why": "Past perfect (“had been hit”) would be more precise; acceptable."
      },
      {
        "para": 5,
        "text": "over too fast",
        "why": "Informal but acceptable; “went by too quickly” would be more elegant."
      },
      {
        "para": 6,
        "text": "Next summer, maybe you can visit me in Austria?",
        "why": "Informal statement-question; acceptable in an email."
      }
    ]
  },
  {
    "nr": "N14",
    "title": "Opinion essay: Social media",
    "subject": "Englisch",
    "schoolType": "Gymnasium",
    "klasse": 7,
    "textKind": "Opinion essay",
    "task": "Write an opinion essay (300–350 words) on the statement: “Social media does more harm than good to teenagers.” Do you agree?",
    "blocks": [
      {
        "text": "Social media – more harm than good?",
        "heading": true
      },
      {
        "text": "Nowadays almost every teenager uses social media. Platforms like Instagram or TikTok have become a part of our everyday life, and many young people spend several hours a day scrolling through their feeds. But does social media really do more harm than good? In this essay I will discuss about the advantages and disadvantages before giving my own opinion.",
        "heading": false
      },
      {
        "text": "On the one hand, social media can have a negative effect on teenagers' mental health. Many users compare themselves with the perfect pictures of influencers, which can lead to low self-esteem. Furthermore, the constant notifications make it difficult to concentrate on homework. Studies show that teenagers who spend more than three hours online per day sleeps less and feel more stressed. Eventually, there is the danger of cyberbullying, which can have serious consequences.",
        "heading": false
      },
      {
        "text": "On the other side, social media also has many benefits. It allows teenagers to stay in contact with friends who live far away. Not only do young people find information for school projects, but they also discover new hobbies and interests. Moreover, social media gives a voice to young activists, who would otherwise not be heard. Less people would know about important topics like climate change without it.",
        "heading": false
      },
      {
        "text": "In my opinion, the problem is not social media itself, but how we use it. Although many teenagers are aware of the risks, but they still spend too much time online. Parents and schools should teach young people how to use it responsible. My cousin Aisha, for example, deleted TikTok last year and says she feels much calmer now. Since years I have been using an app that reminds me to take breaks, and when I make a photo, I think twice before posting it.",
        "heading": false
      },
      {
        "text": "To sum up, I believe that social media does not do more harm than good if it is used wisely. Whether it helps or harms depend on the user. Had I known earlier how much time I was wasting, I would have set limits much sooner.",
        "heading": false
      }
    ],
    "errors": [
      {
        "para": 2,
        "wrong": "discuss about",
        "right": [
          "discuss"
        ],
        "category": "grammatik",
        "what": "“discuss” takes a direct object: discuss the advantages (no “about”)."
      },
      {
        "para": 3,
        "wrong": "sleeps",
        "right": [
          "sleep"
        ],
        "category": "grammatik",
        "what": "Subject-verb agreement: teenagers … sleep (plural)."
      },
      {
        "para": 3,
        "wrong": "Eventually,",
        "right": [
          "Finally,",
          "Lastly,",
          "In addition,",
          "Moreover,",
          "Furthermore,"
        ],
        "category": "ausdruck",
        "what": "False friend: “eventually” means “in the end”, not “eventuell”; to add a last point use “Finally” or “Lastly”."
      },
      {
        "para": 4,
        "wrong": "On the other side",
        "right": [
          "On the other hand"
        ],
        "category": "ausdruck",
        "what": "Fixed phrase: on the one hand … on the other hand."
      },
      {
        "para": 4,
        "wrong": "Less people",
        "right": [
          "Fewer people"
        ],
        "category": "grammatik",
        "what": "“fewer” with countable nouns in the plural (people); “less” with uncountable nouns."
      },
      {
        "para": 5,
        "wrong": "risks, but they",
        "right": [
          "risks, they"
        ],
        "category": "grammatik",
        "what": "“although” and “but” are not used together in one sentence."
      },
      {
        "para": 5,
        "wrong": "responsible",
        "right": [
          "responsibly"
        ],
        "category": "grammatik",
        "what": "Adverb needed to describe how to use it: responsibly."
      },
      {
        "para": 5,
        "wrong": "Since years",
        "right": [
          "For years"
        ],
        "category": "grammatik",
        "what": "“for” with a period of time: for years."
      },
      {
        "para": 5,
        "wrong": "make a photo",
        "right": [
          "take a photo"
        ],
        "category": "ausdruck",
        "what": "Collocation: take a photo (German interference „ein Foto machen“)."
      },
      {
        "para": 6,
        "wrong": "depend on",
        "right": [
          "depends on"
        ],
        "category": "grammatik",
        "what": "A whether-clause as subject takes a singular verb: depends."
      }
    ],
    "correct": [
      {
        "para": 2,
        "text": "almost every teenager uses",
        "why": "“every” takes a singular verb; correct."
      },
      {
        "para": 3,
        "text": "a negative effect on teenagers' mental health",
        "why": "“effect” (noun) and plural possessive apostrophe; correct."
      },
      {
        "para": 4,
        "text": "Not only do young people find information for school projects, but they also discover",
        "why": "Inversion after “not only”; correct."
      },
      {
        "para": 5,
        "text": "the problem is not social media itself, but how we use it",
        "why": "Correct."
      },
      {
        "para": 5,
        "text": "My cousin Aisha, for example, deleted TikTok last year and says she feels much calmer now.",
        "why": "Correct."
      },
      {
        "para": 6,
        "text": "Had I known earlier how much time I was wasting, I would have set limits much sooner.",
        "why": "Inverted conditional; correct."
      }
    ],
    "neutral": [
      {
        "para": 2,
        "text": "But does social media",
        "why": "Starting a sentence with “But” is acceptable in an essay; some teachers prefer “However,”."
      },
      {
        "para": 3,
        "text": "compare themselves with",
        "why": "“compare … to” equally possible."
      },
      {
        "para": 4,
        "text": "young activists, who would",
        "why": "Defining relative clause without comma would fit better; with comma acceptable."
      }
    ]
  }
];
