import type { Bereich, Modul } from "./bauen";

/**
 * German topics of the Volksschule and the Unterstufe (1. to 8. Schulstufe, Volksschule, Mittelschule
 * and AHS): skills with a short explanation and the typical errors students make. New Volksschule-only
 * skills are deutsch.vs.*; skills from the 5. Schulstufe on (or running from the Volksschule into the
 * Unterstufe) are deutsch.<thema>.*; the Oberstufe has its own module.
 *
 * Own structure and own wording. The topics follow the Lehrplan (curriculum/ris-vs-deutsch.json,
 * ris-ms-deutsch.json, ris-ahs-deutsch.json classes 1 to 4) and were checked against the tables of
 * contents of common Austrian German books, topic names only: no task or text is taken from a book.
 * Rules after the amtliche Regelung and the Österreichisches Wörterbuch, with the Austrian terms used
 * at school (Mitvergangenheit, Rufzeichen, Beistrich). The links to the Lehrplan are in
 * scripts/lehrplan_mapping.json.
 */
const VS = ["Volksschule"];

const BEREICHE: Bereich[] = [
  {
    area: "Sprachbetrachtung",
    themen: [
      {
        id: "deutsch.vs.sprache.laute",
        name: "Selbstlaute, Umlaute, Zwielaute und Mitlaute",
        stufen: [1, 2],
        schularten: VS,
        erklaerung: "Selbstlaute (Vokale) sind a, e, i, o, u. Umlaute sind ä, ö, ü, Zwielaute sind au, ei, eu, äu und ai. Alle anderen Laute sind Mitlaute (Konsonanten). Jede Silbe hat einen Selbstlaut, Umlaut oder Zwielaut. Beispiel: In „Mäuse“ stehen der Zwielaut äu und der Selbstlaut e, M und s sind Mitlaute.",
        fehler: [
          "ie als Zwielaut gezählt (in „Lied“ ist ie ein langes i)",
          "Einen Zwielaut auf zwei Silben aufgeteilt (Ha-us)",
          "Umlaute zu den Mitlauten gezählt (ü in „Tür“ als Mitlaut)",
        ],
      },
      {
        id: "deutsch.vs.sprache.mehrzahl",
        name: "Einzahl und Mehrzahl von Nomen",
        stufen: [1, 3],
        schularten: VS,
        erklaerung: "Die Mehrzahl zeigt, dass es mehrere gibt. Sie wird verschieden gebildet: mit -e, -er, -n, -en oder -s, oft mit Umlaut, manchmal ganz ohne Endung. Im 1. Fall heißt der Artikel in der Mehrzahl immer „die“. Beispiel: der Baum, die Bäume; das Kind, die Kinder; die Blume, die Blumen; das Auto, die Autos; der Lehrer, die Lehrer.",
        fehler: [
          "Überall -s angehängt (die Kinds, die Baums)",
          "Den Umlaut vergessen (die Baume statt die Bäume)",
          "Zwei Mehrzahlendungen hintereinander gesetzt (die Kinders)",
        ],
      },
      {
        id: "deutsch.vs.sprache.personalformen",
        name: "Verben: Grundform und Personalformen",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Die Grundform eines Verbs endet auf -en oder -n (laufen, wandern). Im Satz passt sich das Verb der Person an: ich spiele, du spielst, er/sie/es spielt, wir spielen, ihr spielt, sie spielen. Manche Verben ändern bei du und er/sie/es den Selbstlaut. Beispiel: lesen, du liest, er liest; fahren, du fährst, sie fährt.",
        fehler: [
          "Bei „du“ das -st vergessen (du spielt)",
          "Den Wechsel des Selbstlauts nicht gemacht (er lest, du fahrst)",
          "Bei „ihr“ die wir-Form verwendet (ihr spielen)",
        ],
      },
    ],
  },
  {
    area: "Rechtschreibung",
    suchwoerter: ["Orthografie", "Diktat"],
    themen: [
      {
        id: "deutsch.vs.recht.silbentrennung",
        name: "Wörter am Zeilenende trennen",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Man trennt nach Sprechsilben. Stehen mehrere Mitlaute zwischen zwei Selbstlauten, kommt nur der letzte in die nächste Zeile. ch, ck und sch bleiben zusammen, ein einzelner Selbstlaut am Wortanfang wird nicht abgetrennt. Beispiel: Ha-se, Kis-te, Kat-ze, Zu-cker, Ta-sche; „Ofen“ wird nicht getrennt.",
        fehler: [
          "ck getrennt (Zuk-ker oder Zuc-ker statt Zu-cker)",
          "sch auseinandergerissen (Tas-che statt Ta-sche)",
          "Einen einzelnen Selbstlaut am Wortanfang abgetrennt (O-fen)",
          "Ein einsilbiges Wort getrennt (Ha-us)",
        ],
      },
      {
        id: "deutsch.recht.woerterbuch",
        name: "Nach dem Abc ordnen und im Wörterbuch nachschlagen",
        stufen: [2, 5],
        erklaerung: "Wörter ordnet man nach dem ersten Buchstaben, bei gleichem Anfang nach dem zweiten und so weiter. Im Wörterbuch stehen Verben in der Grundform, Nomen in der Einzahl und Adjektive in der Grundstufe. In den meisten Wörterbüchern sind ä, ö und ü wie a, o und u eingeordnet: „Bär“ steht bei „Bar“. Beispiel: „Bäume“ sucht man unter „Baum“, „lief“ unter „laufen“.",
        fehler: [
          "Nur nach dem ersten Buchstaben geordnet (Bus vor Ball)",
          "Die gebeugte Form gesucht (ging statt gehen)",
          "Ein Nomen in der Mehrzahl gesucht (Häuser statt Haus)",
          "Ein Wort mit Umlaut erst hinter allen Wörtern mit a, o oder u gesucht („Bär“ hinter „Bauer“)",
        ],
      },
      {
        id: "deutsch.recht.gleichklang",
        name: "Gleich klingende Wörter: seit oder seid, wieder oder wider, tot oder Tod",
        stufen: [5, 8],
        erklaerung: "Die Bedeutung entscheidet. „seit“ gibt eine Zeit an, „seid“ ist eine Form von „sein“. „wieder“ heißt „noch einmal“, „wider“ heißt „gegen“. „tot“ ist ein Adjektiv, „der Tod“ ein Nomen. Die Vorsilbe „ent-“ schreibt man mit t, „end-“ nur in Wörtern, die von „Ende“ kommen. Beispiel: Seit Montag seid ihr wieder da. Endlich entdeckt sie den Fehler.",
        fehler: [
          "„seid“ und „seit“ verwechselt (Ihr seit zu spät.)",
          "„wieder“ geschrieben, wo „gegen“ gemeint ist (Wiederstand statt Widerstand)",
          "Das Adjektiv mit d geschrieben (Der Käfer ist tod.)",
          "„ent-“ und „end-“ verwechselt (entlich statt endlich)",
        ],
      },
      {
        id: "deutsch.recht.fremdwoerter",
        name: "Fremdwörter richtig schreiben",
        stufen: [5, 8],
        erklaerung: "Fremdwörter behalten oft die Schreibung ihrer Herkunftssprache, etwa th, ph, rh oder y. Ein langes i schreibt man in Fremdwörtern meist nur mit i, außer in Endungen wie -ie, -ier und -ieren. Endungen wie -ion, -ität oder -ik helfen beim Erkennen. Im Zweifel nachschlagen. Beispiel: Maschine, Rhythmus, Theater, Biologie, Papier, telefonieren.",
        fehler: [
          "Langes i mit ie geschrieben (Maschiene, Benzien)",
          "Das h in th oder rh vergessen (Teater, Rytmus)",
          "Mitlaute falsch verdoppelt (interresant statt interessant)",
        ],
      },
      {
        id: "deutsch.recht.getrennt-zusammen",
        name: "Getrennt- und Zusammenschreibung",
        stufen: [6, 9],
        erklaerung: "Zwei Verben schreibt man getrennt (spazieren gehen), Nomen und Verb meist auch (Rad fahren). Zusammen schreibt man, wenn eine neue Gesamtbedeutung entsteht (vor Gericht freisprechen, aber ohne Zettel frei sprechen) und wenn die Verbindung als Nomen gebraucht wird. Beispiel: Wir wollen Rad fahren. Beim Radfahren trage ich einen Helm.",
        fehler: [
          "Eine nominalisierte Verbindung getrennt geschrieben (beim Rad fahren)",
          "Zwei Verben zusammengeschrieben (spazierengehen)",
          "Verbindungen mit „irgend“ getrennt geschrieben (irgend etwas statt irgendetwas)",
          "Feste Zusammensetzungen getrennt geschrieben (Teil nehmen statt teilnehmen)",
        ],
      },
    ],
  },
  {
    area: "Wortarten",
    themen: [
      {
        id: "deutsch.wortarten.steigerung",
        name: "Adjektive steigern und vergleichen",
        stufen: [3, 6],
        erklaerung: "Viele Adjektive haben drei Stufen: Grundstufe (groß), Mehrstufe (größer) und Meiststufe (am größten). Manche steigert man unregelmäßig. Nach der Grundstufe vergleicht man mit „wie“, nach der Mehrstufe mit „als“. Beispiel: gut, besser, am besten; Tom ist größer als Lea, aber so schnell wie sie.",
        fehler: [
          "Nach der Mehrstufe „wie“ verwendet (Er ist größer wie ich.)",
          "Unregelmäßige Formen regelmäßig gebildet (gut, guter, am gutesten)",
          "Den Umlaut vergessen (alt, alter, am altesten)",
          "Doppelt gesteigert (mehr schöner, am bestesten)",
        ],
      },
    ],
  },
  {
    area: "Wortschatz",
    themen: [
      {
        id: "deutsch.wortschatz.zusammensetzung",
        name: "Zusammengesetzte Wörter: Grundwort und Bestimmungswort",
        stufen: [2, 6],
        erklaerung: "Ein zusammengesetztes Wort besteht aus Bestimmungswort und Grundwort. Das Grundwort steht hinten und bestimmt Wortart und Artikel, das Bestimmungswort sagt genauer, was gemeint ist. Manchmal steht dazwischen ein Fugen-s. Beispiel: das Haus und die Tür ergeben die Haustür; der Geburtstag (Geburt, s, Tag); dunkelblau.",
        fehler: [
          "Den Artikel des Bestimmungsworts genommen (das Haustür)",
          "Ein zusammengesetztes Nomen getrennt geschrieben (die Haus Tür)",
          "Grundwort und Bestimmungswort verwechselt (ein Schokoladenkuchen sei eine Schokolade)",
          "Das Fugen-s vergessen (Geburttag)",
        ],
      },
      {
        id: "deutsch.wortschatz.ableitung",
        name: "Wörter ableiten: Vorsilben und Nachsilben",
        stufen: [3, 7],
        erklaerung: "Mit Vorsilben wie be-, ver-, ent-, un- und Nachsilben wie -ung, -heit, -keit, -nis, -lich, -ig, -bar bildet man aus einem Wortstamm neue Wörter. Mit -ung, -heit, -keit und -nis entstehen Nomen, die man großschreibt. Beispiel: ordnen, die Ordnung; frei, die Freiheit; lesen, lesbar; Freund, freundlich; glauben, unglaublich.",
        fehler: [
          "Ein Nomen auf -ung, -heit, -keit oder -nis kleingeschrieben (die bewegung)",
          "-heit und -keit verwechselt (Freundlichheit statt Freundlichkeit)",
          "Die Mehrzahl von Wörtern auf -nis mit einem s geschrieben (die Ergebnise)",
        ],
      },
      {
        id: "deutsch.wortschatz.wortfelder",
        name: "Wortfelder: treffende Wörter wählen",
        stufen: [5, 7],
        erklaerung: "Ein Wortfeld sammelt Wörter mit ähnlicher Bedeutung, etwa zu „sagen“ oder „gehen“. Statt immer dasselbe Wort zu verwenden, wählt man das, was genau passt, denn jedes Wort hat eine eigene Bedeutung und Wirkung. Beispiel: Wortfeld „sagen“: flüstern, rufen, fragen, antworten, behaupten. „Sie flüstert“ ist genauer als „Sie sagt leise“.",
        fehler: [
          "Immer dasselbe Verb verwendet (sagte, sagte, sagte)",
          "Ein Wort gewählt, das nicht genau passt (Er flüsterte laut.)",
          "Wörter der Wortfamilie statt des Wortfelds gesammelt (zu „gehen“: Gang, Ausgang)",
        ],
      },
      {
        id: "deutsch.wortschatz.redewendungen",
        name: "Redewendungen und Sprichwörter verstehen",
        stufen: [5, 7],
        erklaerung: "Eine Redewendung hat eine übertragene Bedeutung, man darf sie nicht Wort für Wort verstehen. Ein Sprichwort ist ein fester Satz mit einer Lebensweisheit. Beide haben eine feste Form und passen nicht in jede Situation. Beispiel: „Jemandem einen Bären aufbinden“ heißt, jemandem etwas Unwahres erzählen. Sprichwort: „Übung macht den Meister.“",
        fehler: [
          "Eine Redewendung wörtlich verstanden (Tomaten auf den Augen haben: Gemüse im Gesicht)",
          "Zwei Redewendungen vermischt (Da liegt der Hase begraben.)",
          "Eine umgangssprachliche Redewendung in einem sachlichen Text verwendet (Bericht: Der Dieb machte sich aus dem Staub.)",
        ],
      },
      {
        id: "deutsch.wortschatz.sprachebenen",
        name: "Sprachebenen: Standardsprache, Umgangssprache und Dialekt",
        stufen: [5, 8],
        erklaerung: "Standardsprache verwendet man in der Schule, in Texten und mit Fremden, Umgangssprache und Dialekt im Alltag mit Familie und Freunden. Man wählt die Ebene, die zu Situation und Gegenüber passt. Österreichische Wörter wie Jänner oder Topfen sind Standardsprache. Beispiel: „Ich hab’s nicht gecheckt“ ist Umgangssprache, „Ich habe es nicht verstanden“ Standardsprache.",
        fehler: [
          "Umgangssprache in einem sachlichen Text verwendet (Das Experiment war voll cool.)",
          "Österreichische Standardwörter für Dialekt gehalten (Jänner, Topfen)",
          "Verkürzte gesprochene Formen geschrieben (hab, nix, is statt habe, nichts, ist)",
        ],
      },
    ],
  },
  {
    area: "Grammatik",
    themen: [
      {
        id: "deutsch.grammatik.imperativ",
        name: "Befehlsform (Imperativ)",
        stufen: [5, 6],
        erklaerung: "Mit dem Imperativ fordert man jemanden auf. Für eine Person nimmt man den Verbstamm, oft ohne Endung, für mehrere die ihr-Form ohne „ihr“, höflich die Form mit „Sie“. Verben, die bei „du“ e zu i oder ie ändern, tun das auch im Imperativ (Ausnahme: werden, werde!). Beispiel: Komm! Kommt! Kommen Sie! Lies den Text! Nimm das Heft!",
        fehler: [
          "Den Wechsel von e zu i oder ie nicht gemacht (Les den Text! Nehme das Heft!)",
          "Den Umlaut der du-Form übernommen (Fähr langsamer! statt Fahr langsamer!)",
          "Die Höflichkeitsform von „sein“ falsch gebildet (Sein Sie leise! statt Seien Sie leise!)",
        ],
      },
      {
        id: "deutsch.grammatik.plusquamperfekt",
        name: "Plusquamperfekt (Vorvergangenheit)",
        stufen: [5, 7],
        erklaerung: "Das Plusquamperfekt zeigt, dass etwas vor einem anderen Ereignis in der Vergangenheit geschehen war. Man bildet es mit „hatte“ oder „war“ und dem Partizip II. Oft steht es mit „nachdem“ neben dem Präteritum. Beispiel: Nachdem wir gegessen hatten, gingen wir hinaus. Der Zug war schon abgefahren.",
        fehler: [
          "Nach „nachdem“ Perfekt statt Plusquamperfekt verwendet (Nachdem wir gegessen haben, gingen wir.)",
          "„hatte“ und „war“ verwechselt (Der Zug hatte abgefahren.)",
          "Plusquamperfekt für ein gewöhnliches vergangenes Ereignis verwendet (Gestern war ich ins Kino gegangen.)",
        ],
      },
      {
        id: "deutsch.grammatik.futur",
        name: "Futur I und Futur II (Zukunft und Vorzukunft)",
        stufen: [5, 7],
        erklaerung: "Futur I: „werden“ im Präsens und die Grundform (ich werde lernen). Futur II zeigt, dass etwas in der Zukunft abgeschlossen sein wird: „werden“, Partizip II und „haben“ oder „sein“. Für die Zukunft verwendet man oft auch das Präsens mit einer Zeitangabe. Beispiel: Morgen werde ich lernen. Bis Freitag werde ich das Buch gelesen haben.",
        fehler: [
          "„werden“ mit dem Partizip statt mit der Grundform verbunden (Ich werde gelernt.)",
          "Im Futur II „haben“ oder „sein“ vergessen (Bis Freitag werde ich das Buch gelesen.)",
          "Bei Bewegungsverben „haben“ statt „sein“ verwendet (Bis dahin werde ich angekommen haben.)",
        ],
      },
      {
        id: "deutsch.grammatik.aktiv-passiv",
        name: "Aktiv und Passiv (Leideform)",
        stufen: [6, 8],
        erklaerung: "Im Aktiv steht im Vordergrund, wer etwas tut, im Passiv, was geschieht. Das Vorgangspassiv bildet man mit „werden“ und dem Partizip II. Das Akkusativobjekt wird zum Subjekt, der Täter kann mit „von“ genannt werden. Beispiel: Der Koch bereitet die Suppe zu. Die Suppe wird (vom Koch) zubereitet. Perfekt: Die Suppe ist zubereitet worden.",
        fehler: [
          "Im Perfekt „geworden“ statt „worden“ verwendet (Die Suppe ist zubereitet geworden.)",
          "Das Objekt im Akkusativ gelassen (Den Brief wird geschrieben.)",
          "Beim Umformen die Zeitform geändert (Der Koch kochte die Suppe. Die Suppe wird gekocht.)",
          "Den Täter ohne „von“ angeschlossen (Die Suppe wird der Koch zubereitet.)",
        ],
      },
      {
        id: "deutsch.grammatik.konjunktiv2",
        name: "Konjunktiv II: Wünsche, Bedingungen und höfliche Bitten",
        stufen: [6, 9],
        erklaerung: "Der Konjunktiv II drückt Unwirkliches, Wünsche und höfliche Bitten aus. Man bildet ihn vom Präteritum, oft mit Umlaut (kam, käme; hatte, hätte; war, wäre). Bei vielen Verben nimmt man die Umschreibung mit „würde“ und der Grundform. Für die Vergangenheit: „hätte“ oder „wäre“ mit dem Partizip II. Beispiel: Wenn ich Zeit hätte, würde ich dir helfen.",
        fehler: [
          "Indikativ statt Konjunktiv II verwendet (Wenn ich Zeit hatte, würde ich kommen.)",
          "Konjunktiv I statt Konjunktiv II verwendet (Wenn er Zeit habe, käme er.)",
          "Unwirkliches in der Vergangenheit im Indikativ gebildet (Wenn ich das gewusst habe, wäre ich gekommen.)",
        ],
      },
      {
        id: "deutsch.grammatik.indirekte-rede",
        name: "Indirekte Rede mit Konjunktiv I",
        stufen: [7, 10],
        erklaerung: "In der indirekten Rede gibt man ohne Anführungszeichen wieder, was jemand gesagt hat, mit Konjunktiv I: Verbstamm und e-Endung (er komme, sie habe), bei „sein“ er sei. Klingt er wie der Indikativ, nimmt man Konjunktiv II oder „würde“. Pronomen werden angepasst. Beispiel: Lea sagt: „Ich bin müde.“ Lea sagt, sie sei müde. Sie sagen, sie hätten keine Zeit.",
        fehler: [
          "Den Indikativ stehen gelassen (Lea sagt, sie ist müde.)",
          "Die Pronomen nicht angepasst (Lea sagt, ich sei müde.)",
          "Konjunktiv I verwendet, der wie der Indikativ klingt (Sie sagen, sie haben keine Zeit.)",
          "Die Vergangenheit nicht übertragen („Ich war krank.“ wird zu: er sei krank, statt: er sei krank gewesen)",
        ],
      },
    ],
  },
  {
    area: "Satzlehre",
    suchwoerter: ["Satzbau"],
    themen: [
      {
        id: "deutsch.satz.satzglieder",
        name: "Satzglieder mit der Umstellprobe bestimmen",
        stufen: [5, 6],
        erklaerung: "Was beim Umstellen zusammenbleibt, ist ein Satzglied. Das Prädikat (Satzaussage) kann zweiteilig sein: Der gebeugte Teil steht im Aussagesatz an zweiter Stelle, der Rest am Ende. Das Subjekt (Satzgegenstand) erfragt man mit „Wer oder was?“. Beispiel: Am Abend | hat | Lea | ihrem Bruder | ein Buch | geschenkt. Umgestellt: Ein Buch hat Lea am Abend ihrem Bruder geschenkt.",
        fehler: [
          "Nur den gebeugten Teil als Prädikat bestimmt (hat statt hat geschenkt)",
          "Zusammengehörende Wörter getrennt (am | Abend)",
          "Das erste Satzglied automatisch für das Subjekt gehalten (Am Abend als Subjekt)",
        ],
      },
      {
        id: "deutsch.satz.objekte",
        name: "Objekte: Dativobjekt und Akkusativobjekt",
        suchwoerter: ["Ergänzungen"],
        stufen: [4, 7],
        erklaerung: "Objekte (Ergänzungen) erfragt man mit dem ganzen Prädikat: „Wem?“ fragt nach dem Dativobjekt, „Wen oder was?“ nach dem Akkusativobjekt. Beispiel: Tom schenkt seiner Schwester einen Ball. Wem schenkt Tom einen Ball? Seiner Schwester (Dativobjekt). Wen oder was schenkt Tom? Einen Ball (Akkusativobjekt).",
        fehler: [
          "Nur mit „Was?“ gefragt und so Akkusativobjekt und Subjekt verwechselt (Das Buch liest Lea: das Buch als Subjekt)",
          "Dativ und Akkusativ nach Gefühl bestimmt (Ich helfe dir: dir als Akkusativobjekt)",
          "Eine Zeitangabe im Akkusativ für ein Objekt gehalten (Er arbeitet den ganzen Tag.)",
        ],
      },
      {
        id: "deutsch.satz.adverbiale",
        name: "Adverbiale Bestimmungen: Zeit, Ort, Art und Weise, Grund",
        suchwoerter: ["Umstandsbestimmungen"],
        stufen: [4, 8],
        erklaerung: "Adverbiale Bestimmungen (Umstandsergänzungen) nennen die Umstände: Zeit (Wann? Wie lange?), Ort (Wo? Wohin? Woher?), Art und Weise (Wie?) und Grund (Warum?). Sie bestehen aus einem Wort oder einer Wortgruppe. Beispiel: Wegen des Regens (Grund) spielten wir gestern (Zeit) im Turnsaal (Ort) leise (Art und Weise) Karten.",
        fehler: [
          "Jede Wortgruppe mit Präposition für eine Ortsangabe gehalten (wegen des Regens als Ort)",
          "Ein Präpositionalobjekt als Ortsangabe bestimmt (Ich warte auf den Bus.)",
          "Ein Attribut für eine adverbiale Bestimmung gehalten (Das Buch auf dem Tisch gehört mir.)",
        ],
      },
      {
        id: "deutsch.satz.attribute",
        name: "Attribute (Beifügungen) erkennen",
        stufen: [6, 8],
        erklaerung: "Ein Attribut ist kein eigenes Satzglied. Es bestimmt ein Nomen näher und bleibt beim Umstellen bei ihm. Attribute können Adjektive, Genitive, Wortgruppen mit Präposition oder Relativsätze sein. Beispiel: Das rote (Adjektiv) Fahrrad meines Bruders (Genitiv) mit der Klingel (mit Präposition) steht im Hof.",
        fehler: [
          "Ein Attribut als eigenes Satzglied bestimmt (meines Bruders als Objekt)",
          "Ein Attribut mit einer adverbialen Bestimmung verwechselt (Das Haus am See ist alt: am See als Ortsangabe)",
          "Ein Adjektiv nach „sein“ für ein Attribut gehalten (Das Auto ist rot.)",
        ],
      },
      {
        id: "deutsch.satz.satzreihe-gefuege",
        name: "Satzreihe und Satzgefüge",
        suchwoerter: ["Hauptsatz und Nebensatz", "Gliedsätze"],
        stufen: [6, 8],
        erklaerung: "Eine Satzreihe besteht aus Hauptsätzen, oft verbunden mit und, oder, aber, denn. Ein Satzgefüge besteht aus Hauptsatz und Gliedsatz; der Gliedsatz beginnt oft mit weil, dass, wenn oder einem Relativpronomen und hat das gebeugte Verb am Ende. Beispiel: Es regnet, aber wir gehen hinaus (Satzreihe). Wir bleiben drinnen, weil es regnet (Satzgefüge).",
        fehler: [
          "Einen Satz mit „denn“ für einen Gliedsatz gehalten (Wir bleiben drinnen, denn es regnet.)",
          "Eine Satzreihe nicht erkannt, weil vor „und“ kein Beistrich steht (Ich lese und Tom schläft.)",
          "Im Gliedsatz das Verb an die zweite Stelle gesetzt (…, weil es ist kalt.)",
        ],
      },
    ],
  },
  {
    area: "Beistrichsetzung",
    suchwoerter: ["Kommasetzung", "Komma", "Zeichensetzung", "Satzzeichen"],
    themen: [
      {
        id: "deutsch.beistrich.direkte-rede",
        name: "Satzzeichen bei der direkten Rede",
        suchwoerter: ["wörtliche Rede", "Anführungszeichen"],
        stufen: [3, 6],
        erklaerung: "Die direkte (wörtliche) Rede steht zwischen Anführungszeichen. Steht der Begleitsatz vorne, folgt ein Doppelpunkt. Steht er hinten, trennt ihn ein Beistrich ab, der Punkt der Rede fällt weg. Frage- und Rufzeichen der Rede bleiben. Beispiel: Lea sagt: „Ich komme mit.“ „Ich komme mit“, sagt Lea. „Kommst du mit?“, fragt Tom.",
        fehler: [
          "Den Doppelpunkt nach dem Begleitsatz vergessen (Lea sagt „Ich komme mit.“)",
          "Den Punkt der Rede vor dem nachgestellten Begleitsatz stehen gelassen („Ich komme mit.“, sagt Lea.)",
          "Nach Frage- oder Rufzeichen den Beistrich weggelassen („Kommst du mit?“ fragt Tom.)",
          "Die schließenden Anführungszeichen vergessen",
        ],
      },
    ],
  },
  {
    area: "Textverständnis",
    themen: [
      {
        id: "deutsch.text.lesestrategien",
        name: "Lesestrategien: vor, während und nach dem Lesen",
        stufen: [4, 8],
        erklaerung: "Vor dem Lesen Überschrift, Bilder und Aufgabe ansehen und überlegen, was man schon weiß. Beim Lesen unbekannte Wörter klären, Schlüsselwörter markieren und zu jedem Absatz eine kurze Notiz schreiben. Danach die Hauptaussage in eigenen Worten formulieren. Beispiel: Randnotiz zu einem Absatz über Bienen: „Wie Bienen Honig machen“.",
        fehler: [
          "Fast alles markiert statt nur die Schlüsselwörter",
          "Unbekannte Wörter übersprungen, obwohl sie für das Verständnis wichtig sind",
          "Ohne Blick auf Überschrift und Aufgabe drauflosgelesen",
          "Notizen aus dem Text abgeschrieben statt in eigenen Worten formuliert",
        ],
      },
      {
        id: "deutsch.text.sachtexte",
        name: "Sachtexte mit Tabellen und Diagrammen lesen",
        stufen: [5, 8],
        erklaerung: "Bei Tabellen und Diagrammen zuerst Titel, Achsen, Einheiten und Quelle lesen, dann die wichtigsten Werte und Unterschiede suchen. Text und Grafik ergänzen einander: Angaben vergleichen und prüfen, ob die Grafik die Aussage des Textes stützt. Beispiel: Laut Diagramm lesen 60 % der Befragten täglich; im Text steht „die Mehrheit“.",
        fehler: [
          "Einheit oder Achsenbeschriftung übersehen (Angaben in Tausend als einzelne Personen gelesen)",
          "Nur den Text gelesen und die Grafik übergangen",
          "Mehr herausgelesen, als die Grafik zeigt (aus zwei gleichzeitig steigenden Werten eine Ursache gemacht)",
        ],
      },
      {
        id: "deutsch.text.fakt-meinung",
        name: "Tatsachen und Meinungen unterscheiden",
        stufen: [6, 8],
        erklaerung: "Eine Tatsachenbehauptung kann man überprüfen: Sie stimmt oder sie stimmt nicht. Eine Meinung ist eine persönliche Bewertung, oft erkennbar an Wörtern wie „ich finde“, „schön“, „besser“ oder „sollte“. In Medien und Werbung werden Meinungen oft wie Tatsachen formuliert. Beispiel: „Die Schule beginnt um 8 Uhr“ ist eine Tatsache, „Die Schule beginnt viel zu früh“ eine Meinung.",
        fehler: [
          "Eine falsche Behauptung für eine Meinung gehalten (Wien liegt am Rhein.)",
          "Eine Meinung ohne „ich finde“ für eine Tatsache gehalten (Das ist das beste Handy.)",
          "Zahlen für glaubwürdig gehalten, ohne die Quelle zu prüfen",
        ],
      },
    ],
  },
  {
    area: "Literatur",
    themen: [
      {
        id: "deutsch.literatur.maerchen",
        name: "Märchen und ihre Merkmale",
        stufen: [4, 6],
        erklaerung: "Märchen spielen an keinem bestimmten Ort und zu keiner bestimmten Zeit („Es war einmal …“). Es gibt Zauberwesen und sprechende Tiere, Gut und Böse sind klar getrennt, Zahlen wie 3, 7 und 12 kommen oft vor, und das Gute siegt. Bekannt sind die Märchen der Brüder Grimm. Beispiel: In „Hänsel und Gretel“ überlisten die Kinder die böse Hexe.",
        fehler: [
          "Märchen und Sage verwechselt, weil in beiden Zauberwesen vorkommen",
          "Merkmale aufgezählt, ohne sie am Text zu zeigen",
          "Beim Märchenschreiben Ort und Zeit genau festgelegt (Am 3. Mai 2020 in Graz …)",
        ],
      },
      {
        id: "deutsch.literatur.sage",
        name: "Sagen und ihre Merkmale",
        stufen: [5, 6],
        erklaerung: "Sagen wurden lange mündlich weitererzählt. Anders als Märchen nennen sie einen bestimmten Ort, oft auch eine Zeit oder Person, und haben manchmal einen wahren Kern. Oft greifen übernatürliche Wesen ein, das Ende ist nicht immer gut. Es gibt Heldensagen und Volkssagen. Beispiel: Die Sage vom Basilisken erklärt, warum ein Haus in Wien Basiliskenhaus heißt.",
        fehler: [
          "Eine Sage für ein Märchen gehalten, weil die Ortsangabe übersehen wurde",
          "Geglaubt, alles in einer Sage sei wirklich passiert",
          "Beim Nacherzählen den Ort weggelassen, um den es in der Sage geht",
        ],
      },
      {
        id: "deutsch.literatur.fabel",
        name: "Fabeln: Aufbau und Lehre",
        stufen: [4, 6],
        erklaerung: "In einer Fabel handeln und sprechen Tiere wie Menschen und haben typische Eigenschaften, etwa der listige Fuchs. Nach einer Ausgangssituation und einem Konflikt folgt eine überraschende Lösung, oft steht am Ende eine Lehre für Menschen. Bekannte Fabeldichter sind Äsop und Lessing. Beispiel: In Äsops Fabel vom Fuchs und dem Raben heißt die Lehre: Trau keinem Schmeichler.",
        fehler: [
          "Die Lehre nur nacherzählt statt auf Menschen übertragen (Der Rabe hat das Fleisch verloren.)",
          "Eine Fabel für ein Märchen gehalten, weil Tiere sprechen",
          "Beim Schreiben einer Fabel die Lehre vergessen",
        ],
      },
      {
        id: "deutsch.literatur.gedicht",
        name: "Gedichte: Vers, Strophe und Reim",
        stufen: [4, 7],
        erklaerung: "Eine Zeile im Gedicht heißt Vers, mehrere Verse bilden eine Strophe. Wörter reimen sich, wenn sie ab dem letzten betonten Selbstlaut oder Zwielaut gleich klingen. Reime kennzeichnet man mit Buchstaben: Paarreim aabb, Kreuzreim abab, umarmender Reim abba. Beispiel: Haus, Maus, Tisch, Fisch am Versende ergeben einen Paarreim (aabb).",
        fehler: [
          "Vers und Strophe verwechselt (vier Verse als vier Strophen gezählt)",
          "Wörter mit gleicher Endung, aber anderem betontem Laut für Reime gehalten (laufen, rufen)",
          "Kreuzreim und umarmenden Reim verwechselt (abba als abab)",
        ],
      },
      {
        id: "deutsch.literatur.sprachbilder",
        name: "Sprachliche Bilder: Vergleich, Metapher, Personifikation",
        stufen: [6, 8],
        erklaerung: "Ein Vergleich verbindet zwei Dinge mit „wie“ oder „als ob“ (stark wie ein Bär). Eine Metapher sagt es ohne Vergleichswort (Er ist ein Bär). Bei einer Personifikation handeln Dinge oder die Natur wie Menschen (Der Wind flüstert). Wichtig ist auch die Wirkung des Bildes. Beispiel: „Das Meer schlief“ ist eine Personifikation, die Ruhe ausdrückt.",
        fehler: [
          "Vergleich und Metapher verwechselt (stark wie ein Bär als Metapher)",
          "Gewöhnliche Tätigkeiten von Tieren als Personifikation bestimmt (Der Hund bellt.)",
          "Nur das Stilmittel benannt, ohne seine Wirkung zu erklären",
        ],
      },
      {
        id: "deutsch.literatur.gattungen",
        name: "Epik, Lyrik und Dramatik unterscheiden",
        stufen: [7, 8],
        erklaerung: "Epik ist erzählende Literatur mit einer Erzählstimme (Märchen, Sage, Kurzgeschichte, Roman). Lyrik umfasst Gedichte in Versen, oft mit Strophen. Zur Dramatik gehören Texte für die Bühne, die vor allem aus Dialogen und Regieanweisungen bestehen. Beispiel: Ein Theaterstück gehört zur Dramatik, eine Ballade verbindet Merkmale aller drei Gattungen.",
        fehler: [
          "Einen Dramentext für eine Erzählung gehalten, weil er eine Handlung hat",
          "Die Erzählstimme mit der Autorin oder dem Autor gleichgesetzt",
          "Einen Sachtext einer literarischen Gattung zugeordnet (Zeitungsbericht als Epik)",
        ],
      },
      {
        id: "deutsch.literatur.ballade",
        name: "Balladen",
        stufen: [7, 8],
        erklaerung: "Eine Ballade ist ein Gedicht mit Strophen und Reimen, das eine spannende Geschichte erzählt. Sie verbindet Lyrik (Verse, Reime), Epik (Handlung, Erzähler) und Dramatik (Dialoge, Spannung). Bekannt sind „Der Zauberlehrling“ und „Erlkönig“ von Johann Wolfgang von Goethe. Beispiel: Im „Erlkönig“ sprechen Vater, Sohn und Erlkönig abwechselnd.",
        fehler: [
          "Nur die Handlung nacherzählt, ohne auf Strophen, Reim und Sprecher einzugehen",
          "Den Sprecherwechsel übersehen (Worte des Erlkönigs dem Vater zugeordnet)",
          "Eine Ballade für ein Märchen gehalten, weil übernatürliche Wesen vorkommen",
        ],
      },
      {
        id: "deutsch.literatur.kurzgeschichte",
        name: "Kurzgeschichten und ihre Merkmale",
        stufen: [7, 9],
        erklaerung: "Eine Kurzgeschichte beginnt meist ohne Einleitung mitten im Geschehen und endet oft offen. Sie zeigt einen Ausschnitt aus dem Alltag mit wenigen Figuren, oft mit einem Wendepunkt, in einfacher Sprache. Vieles wird nur angedeutet und muss erschlossen werden. Beispiel: „Das Brot“ von Wolfgang Borchert beginnt ohne Einleitung mitten in der Nacht.",
        fehler: [
          "Das offene Ende für einen Fehler der Geschichte gehalten",
          "Nur die Handlung wiedergegeben, ohne Angedeutetes zu deuten",
          "Jede kurze Geschichte als Kurzgeschichte bezeichnet (ein Märchen)",
        ],
      },
    ],
  },
  {
    area: "Schreiben",
    suchwoerter: ["Aufsatz", "Textsorten"],
    themen: [
      {
        id: "deutsch.vs.schreiben.bildgeschichte",
        name: "Zu einer Bildgeschichte schreiben",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Zuerst alle Bilder genau ansehen und überlegen, was zwischen ihnen passiert. Zu jedem Bild mindestens einen Satz schreiben, in der Mitvergangenheit erzählen und eine passende Überschrift finden. Gefühle und wörtliche Rede machen die Geschichte lebendig. Beispiel: Bild 1: Lea fand im Park einen kleinen Hund. Bild 2: Sie suchte seinen Besitzer.",
        fehler: [
          "Ein Bild ausgelassen oder die Reihenfolge vertauscht",
          "Nur beschrieben, was man sieht, statt zu erzählen (Auf dem Bild ist ein Hund.)",
          "Zwischen Gegenwart und Vergangenheit gewechselt (Lea fand den Hund. Sie sucht den Besitzer.)",
        ],
      },
      {
        id: "deutsch.vs.schreiben.brief",
        name: "Brief, Einladung und Nachricht schreiben",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Ein Brief hat Ort und Datum, eine Anrede, den Text und einen Gruß mit Namen. Nach der Anrede steht ein Beistrich, danach schreibt man klein weiter, außer bei einem Nomen. Eine Einladung sagt, wer wozu einlädt, wann und wo. Beispiel: oben „Linz, 3. Mai 2026“, dann „Liebe Oma, ich lade dich zu meinem Geburtstag am Samstag um 15 Uhr ein.“",
        fehler: [
          "Datum, Anrede oder Gruß vergessen",
          "Nach der Anrede groß weitergeschrieben (Liebe Oma, Ich lade dich …)",
          "In der Einladung Zeit oder Ort vergessen",
        ],
      },
      {
        id: "deutsch.schreiben.erzaehlung",
        name: "Spannend erzählen: Einleitung, Höhepunkt, Schluss",
        suchwoerter: ["Erlebniserzählung", "Fantasieerzählung"],
        stufen: [5, 7],
        erklaerung: "Die Einleitung stellt kurz Personen, Ort und Zeit vor. Im Hauptteil steigt die Spannung bis zum Höhepunkt, dazu helfen Gefühle, Gedanken, wörtliche Rede und treffende Verben. Der Schluss rundet kurz ab. Erzählt wird meist im Präteritum (Mitvergangenheit). Beispiel: Plötzlich hörte ich ein Knacken hinter mir. Mein Herz klopfte wie wild.",
        fehler: [
          "Den Höhepunkt zu früh erreicht oder in einem Satz abgehandelt",
          "Immer gleiche Satzanfänge verwendet (Dann … Dann … Und dann …)",
          "Zwischen Präteritum und Präsens gewechselt (Ich ging hinein. Plötzlich steht da ein Mann.)",
        ],
      },
      {
        id: "deutsch.schreiben.nacherzaehlung",
        name: "Nacherzählung",
        stufen: [5, 6],
        erklaerung: "Eine Nacherzählung gibt eine gelesene oder gehörte Geschichte in eigenen Worten wieder. Reihenfolge, Personen und wichtige Handlungsschritte bleiben gleich, nichts wird dazuerfunden. Erzählt wird im Präteritum, wörtliche Rede ist erlaubt. Beispiel: Zuerst die Handlungsschritte als Stichwörter notieren, dann jeden Schritt in eigenen Sätzen erzählen.",
        fehler: [
          "Eigene Ideen oder neue Personen dazuerfunden",
          "Wichtige Handlungsschritte ausgelassen oder vertauscht",
          "Ganze Sätze aus der Vorlage abgeschrieben",
        ],
      },
      {
        id: "deutsch.schreiben.inhaltsangabe",
        name: "Inhaltsangabe",
        stufen: [7, 9],
        erklaerung: "Die Einleitung nennt Textsorte, Titel, Autorin oder Autor und Thema. Der Hauptteil fasst die wichtigsten Handlungsschritte sachlich in eigenen Worten zusammen, im Präsens und ohne wörtliche Rede. Beispiel: In der Kurzgeschichte „Das Brot“ von Wolfgang Borchert durchschaut eine alte Frau in einer Hungerzeit die Notlüge ihres Mannes und schont ihn.",
        fehler: [
          "Im Präteritum erzählt wie bei einer Nacherzählung (Die Frau stand auf.)",
          "Wörtliche Rede übernommen statt indirekt wiedergegeben",
          "Spannung oder eigene Wertungen in den Hauptteil eingebaut (Plötzlich passierte etwas Schreckliches!)",
        ],
      },
      {
        id: "deutsch.schreiben.brief",
        name: "Formeller Brief und E-Mail: Anfrage und Beschwerde",
        stufen: [6, 8],
        erklaerung: "Ein formeller Brief hat Absender, Empfänger, Ort und Datum, einen Betreff, die Anrede „Sehr geehrte Frau …“ oder „Sehr geehrter Herr …“, einen sachlichen Text und den Gruß „Mit freundlichen Grüßen“. Die Höflichkeitsform Sie, Ihnen, Ihr schreibt man groß. In einer E-Mail steht der Betreff in der Betreffzeile. Beispiel für einen Betreff: Anfrage zur Sportwoche",
        fehler: [
          "Umgangssprachliche Anrede oder Grußformel verwendet (Hallo Herr Huber, lg)",
          "Die Höflichkeitsform kleingeschrieben (Ich danke ihnen für ihre Antwort.)",
          "Den Betreff vergessen oder das Anliegen erst am Ende genannt",
          "Nach dem Gruß einen Beistrich gesetzt (Mit freundlichen Grüßen,)",
        ],
      },
      {
        id: "deutsch.schreiben.ueberarbeiten",
        name: "Eigene Texte überarbeiten",
        stufen: [3, 8],
        erklaerung: "Den Text mit etwas Abstand noch einmal lesen, am besten laut. Dann gezielt prüfen: Passt der Inhalt zur Aufgabe? Gibt es Wortwiederholungen oder immer gleiche Satzanfänge? Stimmen Zeitform, Satzzeichen und Rechtschreibung? Beispiel: Aus „Dann ging ich heim. Dann aß ich. Dann schlief ich.“ wird „Ich ging heim, aß noch etwas und schlief bald ein.“",
        fehler: [
          "Nur Rechtschreibfehler gesucht und den Inhalt nicht geprüft",
          "Wortwiederholungen und gleiche Satzanfänge stehen gelassen (Dann … Dann …)",
          "Beim Abschreiben neue Fehler gemacht oder Teile vergessen",
        ],
      },
    ],
  },
  {
    area: "Beschreiben und Berichten",
    themen: [
      {
        id: "deutsch.beschreiben.gegenstand",
        name: "Gegenstandsbeschreibung",
        stufen: [5, 6],
        erklaerung: "Eine Gegenstandsbeschreibung ist sachlich und genau, damit man den Gegenstand erkennt. Zuerst der Gesamteindruck (Art, Größe, Form, Farbe), dann die Einzelheiten in einer sinnvollen Reihenfolge, etwa von oben nach unten. Zeitform ist das Präsens. Beispiel: Der Rucksack ist etwa 40 cm hoch und dunkelblau. Vorne befindet sich eine Tasche mit Reißverschluss.",
        fehler: [
          "Gefühle oder Erlebnisse eingebaut (Den Rucksack habe ich von meiner Oma, die ich sehr mag.)",
          "Ungenaue Angaben verwendet (ziemlich groß, irgendwie blau)",
          "Ohne Ordnung von Einzelheit zu Einzelheit gesprungen",
        ],
      },
      {
        id: "deutsch.beschreiben.person",
        name: "Personenbeschreibung",
        stufen: [5, 7],
        erklaerung: "Zuerst der Gesamteindruck (Alter, Größe, Gestalt), dann das Aussehen in einer festen Reihenfolge, meist vom Kopf bis zu den Füßen, dann Kleidung und besondere Merkmale. Man schreibt sachlich im Präsens und mit treffenden Adjektiven. Beispiel: Die Frau ist etwa 30 Jahre alt und schlank. Sie hat lange Haare und trägt eine grüne Brille.",
        fehler: [
          "Ohne Reihenfolge beschrieben (zuerst die Schuhe, dann die Haare, dann die Größe)",
          "Wertungen statt Beschreibung geschrieben (Sie sieht voll nett aus.)",
          "Immer dasselbe Verb verwendet (hat, hat, hat)",
        ],
      },
      {
        id: "deutsch.beschreiben.weg",
        name: "Wegbeschreibung",
        stufen: [5, 6],
        erklaerung: "Eine Wegbeschreibung führt Schritt für Schritt vom Start zum Ziel. Man nennt Richtungen (links, rechts, geradeaus), Entfernungen und gut sichtbare Orientierungspunkte und schreibt im Präsens, oft mit „du“ oder „Sie“. Beispiel: Du gehst bei der Ampel nach links und dann etwa 200 Meter geradeaus bis zur Apotheke. Dort biegst du rechts ab.",
        fehler: [
          "Links und rechts aus der falschen Blickrichtung angegeben",
          "Orientierungspunkte genannt, die ein Fremder nicht erkennt (beim großen Haus)",
          "Schritte ausgelassen, die für einen Fremden nötig wären",
        ],
      },
      {
        id: "deutsch.beschreiben.vorgang",
        name: "Vorgangsbeschreibung: Anleitung und Rezept",
        stufen: [5, 7],
        erklaerung: "Eine Vorgangsbeschreibung erklärt, wie etwas gemacht wird. Zuerst nennt man Materialien oder Zutaten, dann die Arbeitsschritte in der richtigen Reihenfolge, verbunden mit zuerst, danach, anschließend. Sie ist sachlich, im Präsens, mit „man“, Imperativ oder Passiv. Beispiel: Zuerst schlägt man die Eier in eine Schüssel. Danach rührt man den Zucker ein.",
        fehler: [
          "Arbeitsschritte vertauscht oder ausgelassen",
          "Zwischen „man“, „du“ und Imperativ gewechselt (Man nimmt Mehl. Rühr gut um!)",
          "Als Erlebnis in der Vergangenheit erzählt (Dann habe ich die Eier aufgeschlagen.)",
        ],
      },
      {
        id: "deutsch.beschreiben.bericht",
        name: "Bericht über ein Ereignis",
        stufen: [6, 8],
        erklaerung: "Ein Bericht informiert sachlich und knapp über ein Ereignis. Er beantwortet die W-Fragen: Wer? Was? Wann? Wo? Wie? Warum? Welche Folgen? Die Reihenfolge ist zeitlich, Zeitform ist das Präteritum, Gefühle, Spannung und wörtliche Rede fehlen. Beispiel: Am Montag, dem 3. März, stürzte gegen 7.45 Uhr ein Radfahrer in der Hauptstraße.",
        fehler: [
          "Spannend erzählt statt sachlich berichtet (Plötzlich krachte es fürchterlich!)",
          "W-Fragen nicht vollständig beantwortet (Zeit oder Ort fehlt)",
          "Vermutungen oder die eigene Meinung eingebaut (Der Fahrer war sicher zu schnell.)",
        ],
      },
    ],
  },
  {
    area: "Argumentieren",
    themen: [
      {
        id: "deutsch.argumentieren.argument",
        name: "Argumente aufbauen: Behauptung, Begründung, Beispiel",
        stufen: [5, 8],
        erklaerung: "Ein Argument besteht aus Behauptung, Begründung und Beispiel. Die Begründung erklärt, warum die Behauptung stimmt, das Beispiel macht sie anschaulich. Verbunden wird mit weil, denn oder deshalb. Beispiel: Haustiere sind gut für Kinder, weil Kinder dadurch Verantwortung lernen. Wer einen Hund hat, muss zum Beispiel täglich mit ihm hinaus.",
        fehler: [
          "Die Behauptung nur wiederholt statt begründet (Handys sind schlecht, weil sie nicht gut sind.)",
          "Ein Beispiel gebracht, das nicht zur Behauptung passt",
          "Eine einzelne Erfahrung als allgemeinen Beweis genommen (Mein Bruder hat das auch, also ist es für alle so.)",
        ],
      },
      {
        id: "deutsch.argumentieren.stellungnahme",
        name: "Stellungnahme schreiben",
        stufen: [7, 9],
        erklaerung: "In der Einleitung führt man zum Thema hin und nennt die eigene Meinung. Im Hauptteil folgen zwei oder drei Argumente, das stärkste zuletzt, dazu ein Gegenargument, das man entkräftet. Der Schluss fasst die Position zusammen, oft mit einem Vorschlag. Beispiel: „Manche meinen zwar, dass Hausübungen nur Stress machen, doch durch Üben merkt man sich den Stoff besser.“",
        fehler: [
          "Nur die eigene Meinung wiederholt, ohne sie zu begründen",
          "Ein Gegenargument genannt, aber nicht entkräftet",
          "Im Schluss neue Argumente gebracht oder die Meinung gewechselt",
        ],
      },
    ],
  },
  {
    area: "Präsentieren",
    themen: [
      {
        id: "deutsch.praesentieren.referat",
        name: "Referat vorbereiten und halten",
        stufen: [5, 8],
        erklaerung: "Thema eingrenzen, Informationen aus mehreren Quellen sammeln und die Quellen notieren. Das Referat gliedert man in Einleitung, Hauptteil und Schluss und spricht möglichst frei mit Stichwortkarten. Folien oder Plakate zeigen nur Stichwörter und Bilder. Beispiel: Stichwortkarte „Biber: Nagetier, bis etwa 30 kg, baut Dämme“.",
        fehler: [
          "Den ganzen Text vom Blatt abgelesen",
          "Folien mit langen Sätzen überladen",
          "Quellen nicht angegeben oder Internetseiten ungeprüft übernommen",
        ],
      },
    ],
  },
];

/**
 * Typical errors of the German skills that were there before (lib/curriculum.ts BASE and SUBSKILLS,
 * the Volksschule package). Perfekt with „sein“ for sitzen, stehen, liegen is Austrian standard and
 * no error.
 */
const FEHLER_BISHER: Record<string, string[]> = {
  "deutsch.vs.lesen.buchstaben": [
    "Den Buchstabennamen statt des Lauts gesprochen (em-a statt m-a)",
    "Ähnlich aussehende Buchstaben verwechselt (b und d)",
    "Ähnlich klingende Laute verwechselt (d und t, g und k)",
  ],
  "deutsch.vs.lesen.silben": [
    "Laute einzeln aufgesagt, ohne sie zu verbinden (M-a-u-s statt Maus)",
    "Ein Wort nach den ersten Buchstaben geraten (Mama statt Mantel)",
    "Eine Silbe ausgelassen (Zi-ne statt Zi-tro-ne)",
  ],
  "deutsch.vs.lesen.fluessig": [
    "Satzzeichen überlesen und ohne Pause weitergelesen",
    "Wort für Wort gleich betont statt in Sinneinheiten gelesen",
    "Endungen geraten oder verschluckt (lief statt liefen)",
  ],
  "deutsch.vs.lesen.verstehen": [
    "Aus dem Gedächtnis geantwortet statt im Text nachzusehen",
    "Die Antwort mit eigenem Wissen statt mit dem Text begründet",
    "Nur nach denselben Wörtern wie in der Frage gesucht und Umschreibungen übersehen",
  ],
  "deutsch.vs.schreiben.saetze": [
    "Wörter ohne Abstand zusammengeschrieben (Derhundbellt.)",
    "Den Punkt am Satzende vergessen",
    "Unvollständige Sätze geschrieben (Im Park mit dem Ball.)",
  ],
  "deutsch.vs.schreiben.erzaehlen": [
    "Jeden Satz mit „und dann“ begonnen",
    "Das Ende vergessen oder die Geschichte einfach abgebrochen",
    "Zwischen Gegenwart und Vergangenheit gewechselt (Wir gingen in den Wald. Da sehen wir einen Fuchs.)",
  ],
  "deutsch.vs.schreiben.beschreiben": [
    "Erzählt statt beschrieben (Gestern habe ich …)",
    "Ungenaue Wörter verwendet (das Ding, irgendwie)",
    "Ohne Reihenfolge von einer Einzelheit zur nächsten gesprungen",
  ],
  "deutsch.vs.recht.lautgetreu": [
    "Laute ausgelassen (Blme statt Blume)",
    "Laute in der falschen Reihenfolge geschrieben (Bort statt Brot)",
    "Ähnlich klingende Laute verwechselt (Tose statt Dose)",
  ],
  "deutsch.vs.recht.satzanfang": [
    "Den Satzanfang kleingeschrieben, wenn das erste Wort kein Nomen ist (heute ist es warm.)",
    "Nach einem Fragezeichen klein weitergeschrieben (Wo bist du? ich suche dich.)",
    "Am Zeilenanfang großgeschrieben, obwohl der Satz weitergeht",
  ],
  "deutsch.vs.recht.dehnung": [
    "Nach langem Selbstlaut verdoppelt (Schaff statt Schaf)",
    "Ein langes i ohne e geschrieben (Libe statt Liebe)",
    "kk oder zz geschrieben (Zukker, Kazze)",
  ],
  "deutsch.vs.recht.ableiten": [
    "Am Wortende geschrieben, wie man hört (Hunt statt Hund)",
    "e statt ä geschrieben, obwohl es ein verwandtes Wort mit a gibt (Hende statt Hände)",
    "eu statt äu geschrieben (Beume statt Bäume)",
  ],
  "deutsch.vs.sprache.satzarten": [
    "Bei einer Frage mit Fragewort das Fragezeichen vergessen (Wann kommst du.)",
    "Eine Frage ohne Fragewort nicht erkannt (Kommst du mit.)",
    "Nach einem Aussagesatz mit „wo“ oder „wann“ ein Fragezeichen gesetzt (Ich weiß, wo er wohnt?)",
  ],
  "deutsch.vs.sprache.satzglieder": [
    "Nur das Nomen als Subjekt bestimmt (Hund statt der kleine Hund)",
    "Das erste Wort im Satz für das Subjekt gehalten (Heute als Subjekt)",
    "Ein Nomen oder Adjektiv für das Prädikat gehalten",
  ],
  "deutsch.vs.sprache.verbformen": [
    "Unregelmäßige Verben regelmäßig gebildet (er gehte, sie laufte)",
    "Das Hilfsverb vergessen (ich gespielt)",
    "Bei Verben der Bewegung „haben“ statt „sein“ verwendet (ich habe gelaufen)",
  ],
  "deutsch.vs.sprache.wortfamilie": [
    "Wortfamilie und Wortfeld verwechselt (rennen zur Wortfamilie von „laufen“ gezählt)",
    "Ähnlich aussehende Wörter zur Wortfamilie gezählt (Fahne zu „fahren“)",
    "Die Schreibung des Wortstamms nicht genutzt (Fahrad statt Fahrrad)",
  ],
  "deutsch.recht.dasdass": [
    "„das“ als Konjunktion geschrieben (Ich hoffe, das du kommst.)",
    "„dass“ als Relativpronomen geschrieben (Das Buch, dass ich lese, ist spannend.)",
    "Den Artikel am Satzanfang mit „dass“ verwechselt (Dass Auto ist neu.)",
  ],
  "deutsch.recht.gross": [
    "Nominalisierte Verben kleingeschrieben (beim lesen)",
    "Nominalisierte Adjektive nach etwas, nichts, viel kleingeschrieben (etwas schönes)",
    "Tageszeiten falsch geschrieben (heute morgen statt heute Morgen, Abends statt abends)",
  ],
  "deutsch.recht.sss": [
    "ß nach kurzem Selbstlaut geschrieben (Fluß, Schloß)",
    "ss nach langem Selbstlaut oder Zwielaut geschrieben (Strasse, heiss)",
    "Beim Wechsel der Wortform nicht neu geprüft (wir essen, aber er aß: er ass)",
  ],
  "deutsch.beistrich.aufzaehlung": [
    "Vor „und“ oder „oder“ einen Beistrich gesetzt (Äpfel, Birnen, und Bananen)",
    "Vor „aber“ oder „sondern“ den Beistrich vergessen (klein aber fein)",
    "Zwischen Subjekt und Prädikat einen Beistrich gesetzt (Tom, Lea und Anna, gehen ins Kino.)",
  ],
  "deutsch.beistrich.nebensatz": [
    "Den Beistrich vor „dass“ oder „weil“ vergessen (Ich weiß dass du kommst.)",
    "Das Ende eines eingeschobenen Gliedsatzes nicht abgetrennt (Das Buch, das ich lese ist spannend.)",
    "Vor „und“ zwischen zwei Gliedsätzen einen Beistrich gesetzt (…, weil es regnet, und weil es kalt ist.)",
  ],
  "deutsch.beistrich.infinitiv": [
    "Bei „um … zu“ den Beistrich vergessen (Sie kam um zu helfen.)",
    "Bei einem Hinweiswort den Beistrich vergessen (Er dachte nicht daran aufzuhören.)",
    "Eine Infinitivgruppe nach einem Nomen nicht abgetrennt (Sie hatte keine Lust heute zu lernen.)",
  ],
  "deutsch.grammatik.faelle": [
    "Mit „Wer oder was?“ nach dem Akkusativ gefragt und so Nominativ und Akkusativ verwechselt",
    "Dativ und Akkusativ verwechselt (Ich helfe dich.)",
    "„von“ mit Dativ für einen Genitiv gehalten (das Auto von meinem Vater)",
  ],
  "deutsch.grammatik.zeiten": [
    "Perfekt und Präteritum verwechselt (ich habe gesehen als Präteritum)",
    "Plusquamperfekt für Perfekt gehalten (ich hatte gegessen)",
    "Jede Form mit „werden“ für Futur gehalten (Das Haus wird gebaut.)",
  ],
  "deutsch.grammatik.artikel": [
    "Den Artikel geraten statt mitgelernt (der Messer statt das Messer)",
    "Bei zusammengesetzten Nomen den Artikel des ersten Wortes genommen (das Haustür)",
    "Den Artikel nicht an den Fall angepasst (Ich sehe der Hund.)",
  ],
  "deutsch.grammatik.adjektivdeklination": [
    "Nach dem bestimmten Artikel die Endung des unbestimmten verwendet (der kleiner Hund)",
    "Im Dativ -e statt -en verwendet (mit dem neue Auto)",
    "Nach „ein“ im Neutrum -e statt -es verwendet (ein kleine Kind)",
  ],
  "deutsch.grammatik.praepositionen": [
    "Nach „mit“ den Akkusativ verwendet (mit den Hund statt mit dem Hund)",
    "Bei Wechselpräpositionen Wo? und Wohin? verwechselt (Ich gehe in dem Park.)",
    "Nach „für“ oder „durch“ den Dativ verwendet (für dem Freund)",
  ],
  "deutsch.grammatik.praeteritum": [
    "Starke Verben schwach gebildet (er laufte, sie gehte)",
    "Gemischte Verben falsch gebildet (er denkte statt er dachte, er bringte statt er brachte)",
    "Die Endung nicht an die Person angepasst (du ging statt du gingst)",
  ],
  "deutsch.grammatik.perfekt": [
    "Bei Verben der Bewegung „haben“ statt „sein“ verwendet (Ich habe gelaufen.)",
    "Das Partizip II falsch gebildet (gelest, getrinkt)",
    "„ge-“ bei Verben auf -ieren oder mit untrennbarer Vorsilbe gesetzt (hat getelefoniert, hat gebesucht)",
  ],
  "deutsch.satz.hauptsatz-gliedsatz": [
    "Einen Gliedsatz am Satzanfang für den Hauptsatz gehalten (Weil es regnet, bleiben wir drinnen.)",
    "Einen Satz mit „denn“ für einen Gliedsatz gehalten (…, denn es regnet.)",
    "Einen Relativsatz nicht als Gliedsatz erkannt (…, das ich gestern gekauft habe.)",
  ],
  "deutsch.text.verstehen": [
    "Aus eigenem Wissen statt aus dem Text geantwortet",
    "Eine Textstelle abgeschrieben, die die Frage nicht beantwortet",
    "Nur wörtlich Gesagtes gesucht und Angedeutetes übersehen",
  ],
  "deutsch.wortarten.bestimmen": [
    "Nominalisierte Verben als Verb bestimmt (das Lesen)",
    "Adverb und Adjektiv verwechselt (gern als Adjektiv)",
    "Artikel und Pronomen verwechselt (das in „Das gefällt mir“ als Artikel)",
  ],
  "deutsch.wortarten.nomen": [
    "Nominalisierungen kleingeschrieben (beim schwimmen)",
    "Nomen für Gefühle und Gedanken nicht erkannt, weil man sie nicht angreifen kann (die angst)",
    "Ein Adjektiv vor dem Nomen großgeschrieben (der Große Hund)",
  ],
};

/** Explanations of the German skills that were there before and have none in EXPLAIN. */
const ERKLAERUNG_BISHER: Record<string, string> = {
  "deutsch.vs.lesen.buchstaben": "Jeder Buchstabe steht für einen Laut. Beim Lesen spricht man den Laut, nicht den Buchstabennamen: „m“ wie in „Mama“, nicht „em“. Manche Laute schreibt man mit mehreren Buchstaben, etwa sch, ch, ei oder au. Beispiel: In „Schaf“ hört man drei Laute: sch, a, f.",
  "deutsch.vs.lesen.silben": "Die Laute einer Silbe zieht man zusammen, statt sie einzeln aufzusagen, dann verbindet man Silbe für Silbe zum Wort. Silbenbögen und Klatschen helfen. Jede Silbe hat einen Selbstlaut, Umlaut oder Zwielaut. Beispiel: Ro-se, Ta-sche, Zi-tro-ne.",
  "deutsch.vs.lesen.fluessig": "Flüssig liest man, wenn man Wörter schnell erkennt, in Sinneinheiten liest und an Satzzeichen die Stimme passend hebt oder senkt. Üben hilft: denselben Text mehrmals laut lesen, auch zu zweit im Wechsel. Beispiel: Bei „Kommst du mit?“ geht die Stimme am Ende nach oben.",
  "deutsch.vs.lesen.verstehen": "Zuerst die Frage lesen, dann im Text die passende Stelle suchen. Wichtige Wörter unterstreichen und die Antwort mit dem Text begründen. Manches steht nicht wörtlich da und muss erschlossen werden. Beispiel: „Lea setzte ihre Haube auf und zog die Handschuhe an.“ Daraus kann man schließen, dass es kalt ist.",
  "deutsch.vs.schreiben.saetze": "Ein Satz beginnt mit einem großen Buchstaben und endet mit einem Satzzeichen: Punkt, Fragezeichen oder Rufzeichen. Zwischen den Wörtern bleibt eine Lücke. Ein vollständiger Satz sagt, wer etwas tut und was passiert. Beispiel: Der Hund bellt. Wo ist die Katze?",
  "deutsch.vs.schreiben.erzaehlen": "Eine Geschichte hat einen Anfang (wer, wo, wann), eine Mitte, in der etwas Spannendes passiert, und ein Ende. Man erzählt in der richtigen Reihenfolge, meist in der Mitvergangenheit, mit verschiedenen Satzanfängen. Beispiel: Am Sonntag gingen Tom und Lea in den Wald. Plötzlich raschelte es im Gebüsch.",
  "deutsch.vs.schreiben.beschreiben": "Beim Beschreiben schreibt man genau und sachlich, wie etwas aussieht oder abläuft, damit andere es sich vorstellen oder nachmachen können. Man hält eine Reihenfolge ein, verwendet treffende Adjektive und schreibt in der Gegenwart. Beispiel: Mein Federpennal ist rot und rechteckig. Oben hat es einen Reißverschluss.",
  "deutsch.vs.recht.lautgetreu": "Lautgetreue Wörter schreibt man so, wie man sie deutlich spricht. Langsam in Silben mitsprechen und jeden Laut aufschreiben. Für manche Laute braucht man mehrere Buchstaben (sch, ch, ei, au). Beispiel: Ro-sa, Ma-ma, Schu-le.",
  "deutsch.vs.recht.satzanfang": "Das erste Wort eines Satzes schreibt man groß, egal welche Wortart es ist. Ein neuer Satz beginnt nach einem Punkt, Fragezeichen oder Rufzeichen. Beispiel: Wir spielen. Heute ist es warm. Wo bist du?",
  "deutsch.vs.recht.dehnung": "Zuerst hören, ob der Selbstlaut lang oder kurz ist. Nach einem kurzen Selbstlaut folgen meist zwei Mitlaute, hört man nur einen, wird er oft verdoppelt; statt kk steht ck, statt zz steht tz. Ein langes i schreibt man meist ie, nach anderen langen Selbstlauten steht manchmal ein h. Beispiel: Ratte, Zucker, Katze, Biene, Kuh, Zahl.",
  "deutsch.vs.recht.ableiten": "Was man am Wortende nicht sicher hört, findet man durch Verlängern: Mehrzahl bilden oder das Verb in die wir-Form setzen (Hund, Hunde; er gibt, wir geben). Bei ä und äu sucht man ein verwandtes Wort mit a oder au (Bäume, Baum; kälter, kalt). Beispiel: Rad mit d, weil man in „Räder“ ein d hört.",
  "deutsch.vs.sprache.satzarten": "Ein Aussagesatz endet mit einem Punkt, ein Fragesatz mit einem Fragezeichen, ein Ausrufe- oder Aufforderungssatz mit einem Rufzeichen. Beim Fragesatz steht das Verb oder ein Fragewort am Anfang. Beispiel: Tom liest. Liest Tom? Wann liest Tom? Lies jetzt!",
  "deutsch.vs.sprache.satzglieder": "Satzglieder findet man mit der Umstellprobe: Was beim Umstellen zusammenbleibt, ist ein Satzglied. Das Prädikat (Satzaussage) ist das Verb, im Aussagesatz an zweiter Stelle. Das Subjekt (Satzgegenstand) erfragt man mit „Wer oder was?“. Beispiel: Der kleine Hund bellt laut. Wer oder was bellt? Der kleine Hund.",
  "deutsch.vs.sprache.verbformen": "Verben zeigen die Zeit an: Gegenwart (ich spiele), Mitvergangenheit (ich spielte), Vergangenheit (ich habe gespielt) und Zukunft (ich werde spielen). Manche Verben ändern in der Mitvergangenheit den Selbstlaut (gehen, ging). Beispiel: Heute lese ich, gestern las ich, morgen werde ich lesen.",
  "deutsch.vs.sprache.wortfamilie": "Wörter einer Wortfamilie haben denselben Wortstamm, der meist gleich geschrieben wird. Wörter eines Wortfelds haben eine ähnliche Bedeutung, aber verschiedene Stämme. Beispiel: Wortfamilie „fahren“: Fahrer, Fahrrad, Abfahrt. Wortfeld „sagen“: rufen, flüstern, fragen.",
  "deutsch.wortarten.bestimmen": "Nomen bezeichnen Lebewesen, Dinge und Begriffe und haben einen Artikel. Verben sagen, was jemand tut oder was geschieht, und verändern sich mit der Person. Adjektive sagen, wie etwas ist. Entscheidend ist, wie ein Wort im Satz gebraucht wird. Beispiel: Der (Artikel) schnelle (Adjektiv) Hund (Nomen) läuft (Verb) über (Präposition) die Wiese.",
  "deutsch.wortarten.nomen": "Nomen erkennt man an der Artikelprobe (der, die, das, ein) und an Endungen wie -ung, -heit, -keit, -nis. Auch Verben und Adjektive werden zu Nomen, wenn ein Artikel oder ein Signalwort wie beim, zum, viel, etwas, nichts davorsteht. Nomen schreibt man groß. Beispiel: Beim Lesen lernt man viel Neues.",
};

/**
 * Order between the German skills: [skill, skill that should sit before it]. Own didactic choices,
 * like PREREQUISITES in lib/curriculum.ts.
 */
const VORAUSSETZUNGEN: [string, string][] = [
  ["deutsch.vs.recht.silbentrennung", "deutsch.vs.lesen.silben"],
  ["deutsch.vs.recht.silbentrennung", "deutsch.vs.sprache.laute"],
  ["deutsch.vs.schreiben.bildgeschichte", "deutsch.vs.schreiben.saetze"],
  ["deutsch.wortarten.steigerung", "deutsch.wortarten.bestimmen"],
  ["deutsch.wortschatz.ableitung", "deutsch.vs.sprache.wortfamilie"],
  ["deutsch.recht.getrennt-zusammen", "deutsch.recht.gross"],
  ["deutsch.beistrich.direkte-rede", "deutsch.vs.sprache.satzarten"],
  ["deutsch.grammatik.plusquamperfekt", "deutsch.grammatik.perfekt"],
  ["deutsch.grammatik.plusquamperfekt", "deutsch.grammatik.praeteritum"],
  ["deutsch.grammatik.aktiv-passiv", "deutsch.grammatik.perfekt"],
  ["deutsch.grammatik.aktiv-passiv", "deutsch.satz.objekte"],
  ["deutsch.grammatik.konjunktiv2", "deutsch.grammatik.praeteritum"],
  ["deutsch.grammatik.indirekte-rede", "deutsch.grammatik.konjunktiv2"],
  ["deutsch.grammatik.indirekte-rede", "deutsch.beistrich.direkte-rede"],
  ["deutsch.satz.satzglieder", "deutsch.vs.sprache.satzglieder"],
  ["deutsch.satz.objekte", "deutsch.vs.sprache.satzglieder"],
  ["deutsch.satz.objekte", "deutsch.grammatik.faelle"],
  ["deutsch.satz.adverbiale", "deutsch.vs.sprache.satzglieder"],
  ["deutsch.satz.attribute", "deutsch.satz.satzglieder"],
  ["deutsch.satz.satzreihe-gefuege", "deutsch.satz.hauptsatz-gliedsatz"],
  ["deutsch.text.lesestrategien", "deutsch.vs.lesen.verstehen"],
  ["deutsch.literatur.ballade", "deutsch.literatur.gedicht"],
  ["deutsch.schreiben.erzaehlung", "deutsch.vs.schreiben.erzaehlen"],
  ["deutsch.schreiben.inhaltsangabe", "deutsch.grammatik.indirekte-rede"],
  ["deutsch.beschreiben.gegenstand", "deutsch.vs.schreiben.beschreiben"],
  ["deutsch.beschreiben.weg", "deutsch.vs.schreiben.beschreiben"],
  ["deutsch.beschreiben.vorgang", "deutsch.vs.schreiben.beschreiben"],
  ["deutsch.beschreiben.bericht", "deutsch.grammatik.praeteritum"],
  ["deutsch.argumentieren.stellungnahme", "deutsch.argumentieren.argument"],
];

/** Suchwörter of skills of lib/curriculum.ts: the names used in German books next to the Austrian ones. */
const SUCHWOERTER_BISHER: Record<string, string[]> = {
  "deutsch.grammatik.praeteritum": ["Mitvergangenheit"],
  "deutsch.grammatik.perfekt": ["Vergangenheit"],
  "deutsch.satz.hauptsatz-gliedsatz": ["Nebensatz"],
};

export const DEUTSCH_UNTERSTUFE: Modul = {
  fach: "Deutsch",
  bereiche: BEREICHE,
  fehlerBisher: FEHLER_BISHER,
  erklaerungBisher: ERKLAERUNG_BISHER,
  suchwoerterBisher: SUCHWOERTER_BISHER,
  voraussetzungen: VORAUSSETZUNGEN,
};
