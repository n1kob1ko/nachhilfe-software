import type { Bereich, Modul } from "./bauen";

/**
 * German topics of the Oberstufe (9. to 13. Schulstufe: AHS 5th to 8th class, HAK and HTL I. to V.
 * Jahrgang): what is new or clearly harder after the Unterstufe. The Matura text types, argumenting,
 * style and rhetoric, analysing poems, prose and drama, the literary epochs (with Austrian
 * literature), media, academic writing (VWA, Diplomarbeit), language reflection and job applications.
 * Each skill has a short explanation with an example and the typical errors students make.
 *
 * Own structure and own wording. The topics follow the Lehrplan (curriculum/ris-ahs-deutsch.json,
 * classes 5 to 8, ris-hak-deutsch.json, ris-htl-deutsch.json) and were checked against the tables of
 * contents of common Austrian Oberstufe books, topic names only: no task or text is taken from a book.
 * The links to the Lehrplan are in scripts/lehrplan_mapping.json.
 */
const BEREICHE: Bereich[] = [
  {
    area: "Argumentieren",
    themen: [
      {
        id: "deutsch.os.argument.typen",
        name: "Argumenttypen unterscheiden",
        stufen: [9, 13],
        erklaerung: "Argumente stützen eine Behauptung verschieden: mit Fakten und Zahlen (Faktenargument), Aussagen von Fachleuten (Autoritätsargument), anerkannten Werten (normatives Argument), einem Vergleich (Analogie) oder Erfahrungen. Beispiel: „In Österreich gilt eine neunjährige Schulpflicht“ ist ein Faktenargument, „Jedes Kind hat ein Recht auf Bildung“ ein normatives.",
        fehler: [
          "Eine bloße Behauptung für ein Faktenargument gehalten („Jeder weiß doch, dass …“)",
          "Eine bekannte Person als Autorität für ein fremdes Fach verwendet (Fußballstar als Beleg für Ernährungsfragen)",
          "Eine Einzelerfahrung verallgemeinert (Mein Opa hat geraucht und wurde 90, also ist Rauchen harmlos)",
        ],
      },
      {
        id: "deutsch.os.argument.gegen",
        name: "Gegenargumente aufgreifen und entkräften",
        stufen: [9, 13],
        erklaerung: "Ein starkes Gegenargument nennt man fair, räumt ein, was daran stimmt, und zeigt dann, warum es nicht überzeugt: Es ist widerlegbar, betrifft nur Einzelfälle oder wiegt weniger schwer. Beispiel: „Zwar ist ein Handyverbot leicht zu kontrollieren, doch lernen Jugendliche so nicht, verantwortungsvoll mit dem Smartphone umzugehen.“",
        fehler: [
          "Das Gegenargument nur genannt und nicht entkräftet",
          "Die Gegenposition verzerrt, um sie leichter zu widerlegen („Die Gegner wollen, dass niemand mehr etwas lernt“)",
          "Nur schwache Gegenargumente ausgewählt und die starken weggelassen",
        ],
      },
      {
        id: "deutsch.os.argument.fehlschluss",
        name: "Scheinargumente und Argumentationsfehler erkennen",
        stufen: [9, 13],
        erklaerung: "Scheinargumente wirken überzeugend, halten einer Prüfung aber nicht stand: Angriff auf die Person statt auf die Sache, unzulässige Verallgemeinerung, falsches Entweder-oder, Berufung auf die Mehrheit oder Totschlagargumente. Beispiel: „Das hat noch nie funktioniert“ ist ein Totschlagargument, weil es keine Begründung liefert.",
        fehler: [
          "Einen Angriff auf die Person nicht erkannt („Sie ist zu jung, um das zu beurteilen“)",
          "Eine zeitliche Abfolge für eine Ursache gehalten (Seit es Handys gibt, sind die Noten schlechter, also …)",
          "Ein falsches Entweder-oder übernommen („Entweder wir verbieten es, oder es herrscht Chaos“)",
        ],
      },
      {
        id: "deutsch.os.argument.gliederung",
        name: "Argumentation gliedern: steigernd und dialektisch",
        stufen: [9, 13],
        erklaerung: "Steigernd (linear): die Argumente für eine Position vom schwächsten zum stärksten ordnen. Dialektisch: Pro und Kontra abwägen. Beim Sanduhr-Prinzip kommt zuerst die Gegenseite vom stärksten zum schwächsten Argument, dann die eigene Seite vom schwächsten zum stärksten, damit das stärkste eigene Argument am Ende steht.",
        fehler: [
          "Das stärkste Argument an den Anfang gestellt, danach wird die Argumentation immer schwächer",
          "Pro und Kontra unverbunden nebeneinandergestellt, ohne abzuwägen",
          "Am Schluss eine Position vertreten, die dem Hauptteil widerspricht",
        ],
      },
    ],
  },
  {
    area: "Matura-Textsorten",
    themen: [
      {
        id: "deutsch.os.matura.aufgabe",
        name: "Schreibaufgaben der Matura: Arbeitsaufträge und Operatoren",
        stufen: [9, 13],
        erklaerung: "Eine Schreibaufgabe nennt Thema und Textsorte, enthält eine oder mehrere Textbeilagen, oft eine Schreibsituation und meist mehrere Arbeitsaufträge mit je einem Operator wie „Geben Sie wieder“, „Analysieren Sie“, „Nehmen Sie Stellung“. Alle Aufträge werden vollständig erfüllt. Beispiel: „Erläutern Sie“ verlangt Erklären mit Beispielen, nicht bloßes Aufzählen.",
        fehler: [
          "Einen Arbeitsauftrag ausgelassen oder nur in einem Satz gestreift",
          "Einen Operator missverstanden („analysieren“ als bloßes Nacherzählen)",
          "Schreibsituation und Adressaten übersehen (ein Leserbrief ohne Bezug zur genannten Zeitung)",
        ],
      },
      {
        id: "deutsch.os.matura.zusammenfassung",
        name: "Zusammenfassung",
        stufen: [9, 13],
        erklaerung: "Die Zusammenfassung informiert sachlich über die Kernaussagen eines Textes: Einleitung mit Textsorte, Titel, Autorin oder Autor, Quelle und Thema, dann die wichtigsten Aussagen in eigenen Worten, im Präsens, ohne eigene Meinung, fremde Aussagen im Konjunktiv I. Beispiel: „Die Autorin kritisiert, die Schule biete zu wenig Bewegung an.“",
        fehler: [
          "Die eigene Meinung eingebaut („Der Autor hat völlig recht“)",
          "Ganze Sätze aus dem Text abgeschrieben statt in eigenen Worten formuliert",
          "Nebensächliche Beispiele und Zahlen wiedergegeben, die Kernaussage fehlt",
        ],
      },
      {
        id: "deutsch.os.matura.leserbrief",
        name: "Leserbrief",
        stufen: [8, 13],
        erklaerung: "Ein Leserbrief reagiert auf einen Zeitungs- oder Zeitschriftenbeitrag. Er nennt den Bezug (Titel, Medium, Datum), vertritt eine klare Meinung mit Argumenten und endet oft mit einer Forderung oder einem Appell. Beispiel: „Zu Ihrem Artikel über das Handyverbot vom 3. März: Als Schülerin sehe ich das anders, denn …“",
        fehler: [
          "Keinen Bezug zum Artikel hergestellt (Titel, Medium oder Datum fehlen)",
          "Den Artikel nur nacherzählt statt Stellung zu nehmen",
          "Unsachlich oder beleidigend geschrieben („Der Journalist hat keine Ahnung“)",
        ],
      },
      {
        id: "deutsch.os.matura.eroerterung",
        name: "Erörterung",
        stufen: [9, 13],
        erklaerung: "Die Erörterung untersucht eine strittige Frage sachlich von mehreren Seiten: Einleitung mit Hinführung, Hauptteil mit begründeten, gewichteten Argumenten und Gegenargumenten, Schluss mit begründeter eigener Position. Bei einer Textbeilage gibt man meist zuerst deren Position wieder. Beispiel: „Sollen Ziffernnoten in der Volksschule abgeschafft werden?“",
        fehler: [
          "Nur eine Seite betrachtet, obwohl Pro und Kontra abzuwägen sind",
          "Argumente bloß aufgezählt, ohne Begründung und Beispiel",
          "Im Schluss neue Argumente gebracht, statt ein Fazit zu ziehen",
        ],
      },
      {
        id: "deutsch.os.matura.kommentar",
        name: "Kommentar",
        stufen: [10, 13],
        erklaerung: "Der Kommentar ist eine meinungsbetonte journalistische Textsorte zu einem aktuellen Anlass: Anlass kurz darstellen, klar Stellung beziehen, begründen und mit einer pointierten Folgerung oder Forderung schließen. Prägnante Überschrift, Zuspitzung und rhetorische Mittel sind erwünscht. Beispiel für eine Überschrift: „Ein Verbot löst kein Problem“.",
        fehler: [
          "Den Anlass nicht genannt, die Leser wissen nicht, worum es geht",
          "Keine klare Position bezogen, sondern nur abgewogen wie in einer Erörterung",
          "Die Meinung behauptet, aber nicht begründet",
        ],
      },
      {
        id: "deutsch.os.matura.offenerbrief",
        name: "Offener Brief",
        stufen: [10, 13],
        erklaerung: "Ein offener Brief richtet sich an eine Person oder Institution, wird aber veröffentlicht, damit die Öffentlichkeit mitliest. Er hat Briefform (Ort, Datum, Anrede, Grußformel), nennt den Anlass, begründet die Kritik und endet mit einer konkreten Forderung. Beispiel: „Sehr geehrte Frau Bürgermeisterin, als Schülervertretung wenden wir uns an Sie, weil …“",
        fehler: [
          "Wie einen privaten Brief geschrieben, ohne an die Öffentlichkeit als Mitleser zu denken",
          "Den Adressaten nicht direkt angesprochen oder mitten im Text gewechselt",
          "Am Schluss keine konkrete Forderung gestellt (nur „Bitte denken Sie darüber nach“)",
        ],
      },
      {
        id: "deutsch.os.matura.empfehlung",
        name: "Empfehlung",
        stufen: [10, 13],
        erklaerung: "Eine Empfehlung rät einer bestimmten Zielgruppe zu etwas oder davon ab, zum Beispiel zu einem Buch, einem Film, einem Projekt oder einer Maßnahme. Sie informiert kurz über den Gegenstand, bewertet ihn begründet und spricht am Schluss eine klare Empfehlung aus. Beispiel: „Wer gern Krimis liest, sollte dieses Buch nicht verpassen, weil …“",
        fehler: [
          "Nur den Inhalt nacherzählt, ohne zu bewerten",
          "Bewertet, ohne zu begründen („Das Buch ist einfach super“)",
          "Die Zielgruppe nicht beachtet (für Volksschulkinder in Fachsprache geschrieben)",
        ],
      },
      {
        id: "deutsch.os.matura.meinungsrede",
        name: "Meinungsrede",
        stufen: [11, 13],
        erklaerung: "Die Meinungsrede wird für ein Publikum geschrieben und soll überzeugen. Sie beginnt mit Anrede und Bezug zum Anlass, vertritt eine Position mit Argumenten, spricht das Publikum direkt an, nutzt rhetorische Mittel und endet mit einem Appell, oft auch mit Dank fürs Zuhören. Beispiel: „Liebe Mitschülerinnen und Mitschüler, stellt euch vor, …“",
        fehler: [
          "Anrede und Bezug zur Redesituation vergessen",
          "Wie einen Aufsatz geschrieben, ohne das Publikum anzusprechen",
          "Rhetorische Mittel gehäuft, aber keine Argumente gebracht",
        ],
      },
      {
        id: "deutsch.os.matura.textanalyse",
        name: "Textanalyse",
        stufen: [10, 13],
        erklaerung: "Die Textanalyse untersucht, wie ein Text gemacht ist und wie er wirkt: kurz der Inhalt, dann Aufbau, Sprache (Wortwahl, Satzbau, Stilmittel) und Intention. Jede Beobachtung wird mit Zitat oder Zeilenangabe belegt und in ihrer Wirkung erklärt. Beispiel: „Mit den rhetorischen Fragen in Z. 4 und 7 bezieht der Autor die Leser direkt ein.“",
        fehler: [
          "Nur den Inhalt nacherzählt, statt die Gestaltung zu untersuchen",
          "Stilmittel aufgezählt, ohne ihre Wirkung zu erklären",
          "Behauptungen ohne Beleg aus dem Text (keine Zitate oder Zeilenangaben)",
        ],
      },
      {
        id: "deutsch.os.matura.textinterpretation",
        name: "Textinterpretation",
        stufen: [11, 13],
        erklaerung: "Die Textinterpretation deutet einen literarischen Text. Die Einleitung nennt Autor, Titel, Gattung, Entstehungszeit und eine Deutungshypothese; der Hauptteil prüft sie an Inhalt, Form und Sprache mit Textbelegen, auch Epoche oder Biografie können helfen. Beispiel für eine Hypothese: „Das Gedicht zeigt die Einsamkeit des Menschen in der Großstadt.“",
        fehler: [
          "Gedeutet ohne Belege aus dem Text, nur mit persönlichen Eindrücken",
          "Erzähler oder lyrisches Ich mit der Autorin oder dem Autor gleichgesetzt",
          "Form und Inhalt getrennt beschrieben, ohne den Zusammenhang zu deuten",
        ],
      },
    ],
  },
  {
    area: "Stil und Rhetorik",
    themen: [
      {
        id: "deutsch.os.stil.klang",
        name: "Klang- und Wiederholungsfiguren: Alliteration, Anapher, Epipher, Lautmalerei",
        stufen: [9, 13],
        erklaerung: "Alliteration: gleicher Anlaut benachbarter Wörter (mit Kind und Kegel). Anapher: gleicher Anfang aufeinanderfolgender Sätze oder Verse, Epipher: gleiches Ende. Lautmalerei: Wörter ahmen Geräusche nach (zischen, knistern). Alle betonen und machen Aussagen einprägsam. Beispiel: „Ich hoffe, ich warte, ich bleibe.“ ist eine Anapher.",
        fehler: [
          "Anapher und Epipher verwechselt (Anfang gegenüber Ende)",
          "Jede Wiederholung als Anapher bezeichnet, auch wenn sie mitten im Satz steht",
          "Alliteration bei Wörtern angenommen, die weit auseinanderstehen",
        ],
      },
      {
        id: "deutsch.os.stil.satzfiguren",
        name: "Satzfiguren: Parallelismus, Chiasmus, Ellipse, Klimax, Inversion",
        stufen: [9, 13],
        erklaerung: "Parallelismus: gleich gebaute Sätze. Chiasmus: Überkreuzstellung A B, B A (Groß war der Plan, die Mittel waren klein). Ellipse: bewusst unvollständiger Satz (Kein Wort mehr!). Klimax: Steigerung (Ich bitte, ich flehe, ich beschwöre dich). Inversion: ungewöhnliche Wortstellung zur Betonung (Groß war die Freude).",
        fehler: [
          "Parallelismus mit Anapher gleichgesetzt (gleicher Satzbau braucht keine gleichen Wörter)",
          "Einen Chiasmus angenommen, obwohl nichts überkreuzt ist",
          "Eine bloße Aufzählung als Klimax bezeichnet, obwohl nichts gesteigert wird",
        ],
      },
      {
        id: "deutsch.os.stil.gedankenfiguren",
        name: "Gedankenfiguren: rhetorische Frage, Ironie, Hyperbel, Antithese, Oxymoron, Euphemismus",
        stufen: [9, 13],
        erklaerung: "Rhetorische Frage: Die Antwort steht fest. Ironie: Gemeint ist das Gegenteil. Hyperbel: Übertreibung. Antithese: Gegenüberstellung. Oxymoron: Widerspruch in einem Ausdruck. Euphemismus: Beschönigung. Beispiel: „bittersüß“ ist ein Oxymoron, „Ich habe es dir tausendmal gesagt“ eine Hyperbel, „entschlafen“ für „sterben“ ein Euphemismus.",
        fehler: [
          "Jede Frage im Text als rhetorische Frage bezeichnet",
          "Antithese und Oxymoron verwechselt (das Oxymoron vereint den Widerspruch in einem Ausdruck)",
          "Ironie wörtlich genommen und die Aussage des Textes falsch gedeutet",
        ],
      },
      {
        id: "deutsch.os.stil.bilder",
        name: "Bildhafte Sprache: Symbol, Allegorie, Metonymie, Synästhesie",
        stufen: [9, 13],
        erklaerung: "Symbol: ein konkreter Gegenstand steht für etwas Abstraktes (die Taube für Frieden). Allegorie: ein abstrakter Begriff wird als Figur dargestellt (der Tod als Sensenmann). Metonymie: ein Wort ersetzt ein eng damit verbundenes (ein Glas trinken, das ganze Haus lachte). Synästhesie: Sinneseindrücke werden vermischt (schreiendes Rot, warme Stimme).",
        fehler: [
          "Jede Personifikation für eine Allegorie gehalten (die Sonne lacht)",
          "Symbol und Metapher verwechselt (das Symbol ist ein wirklicher Gegenstand im Text)",
          "Metonymie mit Metapher verwechselt (bei der Metonymie gibt es einen sachlichen Zusammenhang, keinen Vergleich)",
        ],
      },
      {
        id: "deutsch.os.stil.wirkung",
        name: "Wirkung von Stilmitteln beschreiben",
        stufen: [10, 13],
        erklaerung: "In Analyse und Interpretation genügt das Benennen nicht: Stilmittel nennen, mit Zitat und Zeile belegen und erklären, was es an genau dieser Stelle bewirkt. Beispiel: Die Anapher „Wir fordern“ (Z. 12 bis 14) verstärkt den Appell, die Forderungen klingen wie aus einem Mund.",
        fehler: [
          "Stilmittel nur aufgelistet (Z. 3 Metapher, Z. 5 Alliteration) ohne Deutung",
          "Leerformeln statt einer konkreten Wirkung („macht den Text interessanter“)",
          "Eine Wirkung behauptet, die nicht zur Textstelle passt",
        ],
      },
      {
        id: "deutsch.os.stil.satzbau",
        name: "Satzbau deuten: Parataxe und Hypotaxe",
        stufen: [10, 13],
        erklaerung: "Parataxe reiht Hauptsätze aneinander und wirkt knapp, schnell, abgehackt oder kindlich. Hypotaxe verbindet Haupt- und Nebensätze und drückt Zusammenhänge wie Grund, Folge oder Bedingung genau aus, wirkt aber schwerfällig, wenn sie zu lang wird. Beispiel: „Es regnete. Sie blieb. Er ging.“ ist parataktisch und wirkt kühl und distanziert.",
        fehler: [
          "Parataxe und Hypotaxe vertauscht",
          "Den Satzbau in der Analyse nur benannt, aber nicht gedeutet",
          "Im eigenen Text nur Schachtelsätze oder nur kurze Hauptsätze verwendet",
        ],
      },
      {
        id: "deutsch.os.stil.nominal",
        name: "Nominalstil und Verbalstil",
        stufen: [9, 13],
        erklaerung: "Nominalstil verdichtet mit Nomen (oft auf -ung, -heit, -keit) und wirkt sachlich, aber schwerfällig; Verbalstil verwendet Verben und wirkt lebendig und verständlich. In Fachtexten ist Nominalstil üblich, zu viel davon erschwert das Lesen. Beispiel: „Nach erfolgter Prüfung kam es zur Freigabe“ wird zu „Nachdem man es geprüft hatte, gab man es frei.“",
        fehler: [
          "Lange Nominalketten gebildet (zur Sicherstellung der Umsetzung der Durchführung)",
          "Aufgeblähte Funktionsverbgefüge verwendet (zur Durchführung bringen statt durchführen)",
          "Beim Umformen die Zeitform oder den Sinn verändert",
        ],
      },
      {
        id: "deutsch.os.stil.ausdruck",
        name: "Sachlich und treffend formulieren",
        stufen: [9, 13],
        erklaerung: "In Sachtexten und Matura-Texten gilt eine neutrale Standardsprache: keine Umgangssprache, keine Füllwörter und Floskeln, treffende Verben statt „machen“, „tun“, „geben“, abwechslungsreiche redeeinleitende Verben. Beispiel: „Der Autor macht Kritik an der Werbung“ wird zu „Der Autor kritisiert die Werbung“.",
        fehler: [
          "Umgangssprache verwendet (voll super, checken, mega)",
          "Füllwörter und Floskeln gehäuft (eigentlich, irgendwie, im Endeffekt)",
          "Immer dasselbe Verb wiederholt (er sagt, er sagt, er sagt) statt behauptet, betont, fordert",
        ],
      },
      {
        id: "deutsch.os.stil.ethos",
        name: "Überzeugungsmittel: Ethos, Logos, Pathos",
        stufen: [11, 13],
        erklaerung: "Nach Aristoteles überzeugt eine Rede durch Ethos (Glaubwürdigkeit der Sprecherin oder des Sprechers), Logos (sachliche Argumente und Belege) und Pathos (Gefühle des Publikums); gute Reden verbinden alle drei. Beispiel: „Als Notärztin erlebe ich jede Woche …“ setzt auf Ethos, eine Statistik auf Logos, ein bewegendes Einzelschicksal auf Pathos.",
        fehler: [
          "Ein bewegendes Einzelschicksal als sachliches Argument (Logos) gewertet",
          "Ethos übersehen, wenn sich die Sprecherin durch Erfahrung oder Fachwissen glaubwürdig macht",
          "Pathos von vornherein als unzulässig abgewertet, statt seine Funktion zu beschreiben",
        ],
      },
    ],
  },
  {
    area: "Lyrik",
    themen: [
      {
        id: "deutsch.os.lyrik.metrum",
        name: "Metrum bestimmen: Jambus, Trochäus, Daktylus, Anapäst",
        stufen: [9, 13],
        erklaerung: "Betonte und unbetonte Silben folgen einem Muster. Jambus: unbetont, betont (Gedicht). Trochäus: betont, unbetont (Sonne). Daktylus: betont, unbetont, unbetont (Königin). Anapäst: unbetont, unbetont, betont (Paradies). Laut lesen, Betonungen markieren, Hebungen zählen. Beispiel: „Ich gehe heim am Abend“ ist ein dreihebiger Jambus.",
        fehler: [
          "Gegen die natürliche Wortbetonung gelesen, damit es ins Schema passt",
          "Silben statt Hebungen gezählt (einen achtsilbigen Vers für achthebig gehalten)",
          "Eine unbetonte erste Silbe übersehen und den Jambus für einen Trochäus gehalten",
        ],
      },
      {
        id: "deutsch.os.lyrik.vers",
        name: "Kadenz, Enjambement und besondere Reime",
        stufen: [9, 13],
        erklaerung: "Kadenz ist das Versende: männlich (stumpf) mit betonter, weiblich (klingend) mit unbetonter letzter Silbe. Zeilenstil: Satz und Vers enden zusammen; Enjambement: der Satz läuft in den nächsten Vers weiter. Besondere Reime: Schweifreim (aabccb), Binnenreim, unreiner Reim (Glück, Blick). Beispiel für ein Enjambement: „Sie öffnet leise / die alte Tür“.",
        fehler: [
          "Männliche und weibliche Kadenz vertauscht",
          "Kadenz mit dem Reimschema verwechselt",
          "Jedes Versende ohne Satzzeichen als Enjambement gewertet, obwohl die Sinneinheit abgeschlossen ist",
        ],
      },
      {
        id: "deutsch.os.lyrik.formen",
        name: "Gedichtformen: Sonett, Volkslied, Ode, Hymne, freie Rhythmen",
        stufen: [10, 13],
        erklaerung: "Sonett: 14 Verse, meist in zwei Quartetten (je 4 Verse) und zwei Terzetten (je 3 Verse), oft mit einer Wende zwischen den Teilen. Volkslied: einfache Strophen, Reim, Wiederholungen. Ode und Hymne: feierlich, oft ohne Reim. Freie Rhythmen: ohne festes Metrum und ohne Reim, aber rhythmisch gestaltet.",
        fehler: [
          "Quartett und Terzett verwechselt (Quartett hat vier, Terzett drei Verse)",
          "Ein reimloses Gedicht mit festem Metrum für freie Rhythmen gehalten",
          "Die Form nur benannt, ohne zu deuten, wozu sie dient (Gegensatz zwischen Quartetten und Terzetten)",
        ],
      },
      {
        id: "deutsch.os.lyrik.versmasse",
        name: "Bekannte Versmaße: Alexandriner, Blankvers, Knittelvers",
        stufen: [10, 13],
        erklaerung: "Alexandriner: sechshebiger Jambus mit deutlicher Pause (Zäsur) nach der dritten Hebung, typisch für das Barock. Blankvers: fünfhebiger Jambus ohne Reim, im Versdrama seit Lessings „Nathan der Weise“, typisch für die Weimarer Klassik. Knittelvers: vier Hebungen, paarweise gereimt, oft mit unregelmäßig vielen unbetonten Silben (Teile von Goethes „Faust“).",
        fehler: [
          "Die Hebungen falsch gezählt und einen Blankvers für einen Alexandriner gehalten",
          "Den Blankvers wegen des fehlenden Reims für freie Rhythmen gehalten",
          "Die Zäsur im Alexandriner übersehen und den Gegensatz der beiden Vershälften nicht gedeutet",
        ],
      },
      {
        id: "deutsch.os.lyrik.analyse",
        name: "Gedichte analysieren: Inhalt, Form und Sprache verbinden",
        stufen: [9, 13],
        erklaerung: "Zuerst Thema und Situation des lyrischen Ichs klären, dann Aufbau (Strophen, Wendepunkte), Form (Metrum, Reim, Kadenz) und Sprache (Bilder, Klang, Wortwahl) untersuchen und immer fragen, wie die Form den Inhalt unterstützt. Beispiel: Ein gleichmäßiges Metrum kann Ruhe ausdrücken, ein Bruch im Rhythmus eine Störung oder einen Wendepunkt.",
        fehler: [
          "Das lyrische Ich mit der Dichterin oder dem Dichter gleichgesetzt",
          "Die Form als Liste beschrieben, ohne Bezug zum Inhalt",
          "Strophe für Strophe nacherzählt, statt zu deuten",
        ],
      },
    ],
  },
  {
    area: "Epik",
    themen: [
      {
        id: "deutsch.os.epik.erzaehler",
        name: "Erzählperspektive: Ich-Erzählung, auktorial, personal, neutral",
        stufen: [8, 13],
        erklaerung: "Erzählform: Ich- oder Er/Sie-Erzählung. Erzählverhalten: auktorial (weiß alles, kommentiert, blickt voraus), personal (aus der Sicht einer Figur), neutral (nur Äußeres, kein Blick ins Innere). Der Erzähler ist nie die Autorin oder der Autor. Beispiel: „Er ahnte nicht, dass er sie nie wiedersehen würde“ ist auktorial.",
        fehler: [
          "Den Erzähler mit der Autorin oder dem Autor gleichgesetzt",
          "Jede Er-Erzählung für auktorial gehalten, obwohl nur aus der Sicht einer Figur erzählt wird",
          "Ich-Erzählform und personales Erzählverhalten verwechselt",
        ],
      },
      {
        id: "deutsch.os.epik.zeit",
        name: "Erzählzeit und erzählte Zeit",
        stufen: [9, 13],
        erklaerung: "Erzählzeit ist die Zeit, die man zum Lesen braucht, erzählte Zeit die Zeitspanne der Handlung. Zeitraffung: Die Erzählzeit ist kürzer. Zeitdeckung: etwa gleich lang (Dialoge). Zeitdehnung: länger (Sekunden über eine Seite). Dazu kommen Rückblende und Vorausdeutung. Beispiel: „Die Jahre vergingen.“ rafft stark.",
        fehler: [
          "Erzählzeit und erzählte Zeit vertauscht",
          "Zeitraffung und Zeitdehnung verwechselt",
          "Eine Rückblende nicht erkannt und die Handlung falsch geordnet",
        ],
      },
      {
        id: "deutsch.os.epik.rede",
        name: "Figurenrede: erlebte Rede und innerer Monolog",
        stufen: [10, 13],
        erklaerung: "Erlebte Rede gibt Gedanken einer Figur ohne Redeeinleitung in der 3. Person und im Präteritum wieder: Morgen würde sie es ihm sagen. Ja, morgen! Der innere Monolog steht in der 1. Person und im Präsens, ebenfalls ohne Einleitung: Morgen sag ich es ihm. Ja, morgen. Beide zeigen das Innere einer Figur unmittelbar.",
        fehler: [
          "Erlebte Rede für indirekte Rede gehalten (es fehlen Redeeinleitung und Konjunktiv)",
          "Inneren Monolog und erlebte Rede verwechselt, ohne Person und Zeitform zu prüfen",
          "Die Gedanken in der erlebten Rede als Meinung des Erzählers statt der Figur gedeutet",
        ],
      },
      {
        id: "deutsch.os.epik.novelle",
        name: "Novelle",
        stufen: [9, 13],
        erklaerung: "Die Novelle erzählt in mittlerer Länge ein außergewöhnliches Ereignis, eine „unerhörte Begebenheit“: straffe Handlung mit deutlichem Wendepunkt, oft Rahmenhandlung und ein wiederkehrendes Dingsymbol. Beispiele: Gottfried Kellers „Kleider machen Leute“, Theodor Storms „Der Schimmelreiter“, Stefan Zweigs „Schachnovelle“.",
        fehler: [
          "Novelle und Roman nur nach der Seitenzahl unterschieden",
          "Den Wendepunkt nicht erkannt",
          "Novelle und Kurzgeschichte verwechselt (die Kurzgeschichte zeigt einen Alltagsmoment mit offenem Anfang)",
        ],
      },
      {
        id: "deutsch.os.epik.parabel",
        name: "Parabel",
        stufen: [9, 13],
        erklaerung: "Eine Parabel erzählt eine Geschichte (Bildebene), die man auf eine allgemeine Frage oder Lehre übertragen soll (Sachebene). Man sucht den Vergleichspunkt zwischen beiden Ebenen. Moderne Parabeln, etwa von Franz Kafka, bleiben oft rätselhaft und offen. Beispiel: Lessings Ringparabel steht für Toleranz zwischen Judentum, Christentum und Islam.",
        fehler: [
          "Nur die Bildebene nacherzählt, ohne auf die Sachebene zu übertragen",
          "Jede Einzelheit der Bildebene eins zu eins übersetzt",
          "Parabel und Fabel verwechselt (die Fabel hat meist Tiere und eine ausdrückliche Moral)",
        ],
      },
    ],
  },
  {
    area: "Drama",
    themen: [
      {
        id: "deutsch.os.drama.rede",
        name: "Dialog, Monolog, Mauerschau und Botenbericht",
        stufen: [9, 13],
        erklaerung: "Der Dialog treibt die Handlung voran, im Monolog zeigt eine Figur allein ihr Inneres, Beiseitesprechen hört nur das Publikum. Mauerschau (Teichoskopie) und Botenbericht zeigen, was nicht auf der Bühne geschieht: gleichzeitig beobachtet oder nachträglich erzählt. Regieanweisungen geben Hinweise zum Spiel.",
        fehler: [
          "Mauerschau und Botenbericht verwechselt (gleichzeitig gegenüber nachträglich)",
          "Regieanweisungen bei der Analyse übersehen",
          "Eine lange Rede im Gespräch für einen Monolog gehalten",
        ],
      },
      {
        id: "deutsch.os.drama.aufbau",
        name: "Aufbau des klassischen Dramas in fünf Akten",
        stufen: [10, 13],
        erklaerung: "Nach Gustav Freytag hat das klassische Drama fünf Akte: Exposition (Figuren und Konflikt werden eingeführt), steigende Handlung, Höhepunkt mit Wendepunkt (Peripetie), fallende Handlung mit retardierendem Moment (Verzögerung, letzte Hoffnung) und Katastrophe. Beispiel: In der Tragödie endet die Katastrophe oft mit dem Untergang der Hauptfigur.",
        fehler: [
          "Peripetie und Katastrophe verwechselt",
          "Das retardierende Moment für den Höhepunkt gehalten",
          "Das Schema auch auf Dramen der offenen Form übertragen, die nicht so gebaut sind",
        ],
      },
      {
        id: "deutsch.os.drama.form",
        name: "Geschlossene und offene Form des Dramas",
        stufen: [10, 13],
        erklaerung: "Geschlossene Form: Einheit von Ort, Zeit und Handlung, wenige Figuren meist hohen Standes, streng gebaute Akte, gehobene Sprache oft in Versen (Goethes „Iphigenie auf Tauris“). Offene Form: viele Schauplätze, Zeitsprünge, lose Szenenfolge, Figuren aus allen Schichten, Alltagssprache oder Dialekt (Büchners „Woyzeck“).",
        fehler: [
          "Die Einheit von Ort, Zeit und Handlung der offenen Form zugeordnet",
          "Eine lose Szenenfolge ohne Akte für unfertig gehalten statt für ein Merkmal der offenen Form",
          "Nur ein Merkmal geprüft (Prosa heißt nicht offene Form: Lessings „Emilia Galotti“ ist streng gebaut)",
        ],
      },
      {
        id: "deutsch.os.drama.gattungen",
        name: "Tragödie, Komödie, bürgerliches Trauerspiel und Volksstück",
        stufen: [10, 13],
        erklaerung: "Tragödie: Die Hauptfigur scheitert an einem unlösbaren Konflikt. Komödie: Verwicklungen lösen sich heiter. Bürgerliches Trauerspiel: Bürgerliche als tragische Figuren, oft gegen den Adel (Lessings „Emilia Galotti“). Volksstück: Figuren aus dem Volk, Witz, oft Mundart und Gesellschaftskritik (Johann Nestroy; kritisch erneuert von Ödön von Horváth).",
        fehler: [
          "Geglaubt, tragisch könnten nur Könige und Adelige sein, und das bürgerliche Trauerspiel nicht erkannt",
          "Komödie mit „lustig ohne Ernst“ gleichgesetzt, obwohl sie oft scharf kritisiert",
          "Das Volksstück für einfaches Laientheater gehalten statt für eine literarische Gattung",
        ],
      },
      {
        id: "deutsch.os.drama.episch",
        name: "Episches Theater nach Brecht",
        stufen: [11, 13],
        erklaerung: "Bertolt Brecht wollte, dass das Publikum nicht mitfühlt, sondern kritisch nachdenkt. Dazu dient der Verfremdungseffekt: Erzähler, Songs, Spruchbänder, Figuren, die das Publikum ansprechen, und Szenen, die für sich stehen. Das Gegenmodell ist das aristotelische Drama mit Einfühlung und Spannung. Beispiel: „Mutter Courage und ihre Kinder“.",
        fehler: [
          "Verfremdung als „fremdartig gestaltet“ verstanden statt als Mittel, Distanz zu schaffen",
          "Episches Theater mit dem Epos oder der Gattung Epik verwechselt",
          "Erwartet, dass sich das Publikum mit den Figuren identifizieren soll",
        ],
      },
    ],
  },
  {
    area: "Literatur",
    themen: [
      {
        id: "deutsch.os.literatur.motiv",
        name: "Stoff, Motiv und Symbol",
        stufen: [10, 13],
        erklaerung: "Ein Stoff ist eine bestimmte, oft bearbeitete Handlung mit Figuren (Faust, Romeo und Julia). Ein Motiv ist ein kleineres, wiederkehrendes Situationsmuster (verbotene Liebe, Doppelgänger, Reise). Ein Symbol ist ein Gegenstand mit tieferer Bedeutung (die blaue Blume der Romantik). Beispiel: Romeo und Julia enthält das Motiv der verbotenen Liebe.",
        fehler: [
          "Stoff und Motiv verwechselt (die verbotene Liebe als Stoff bezeichnet)",
          "Thema und Motiv gleichgesetzt",
          "Ein Symbol behauptet, ohne die Bedeutung am Text zu belegen",
        ],
      },
    ],
  },
  {
    area: "Literaturepochen",
    themen: [
      {
        id: "deutsch.os.epochen.mittelalter",
        name: "Literatur des Mittelalters",
        stufen: [10, 13],
        erklaerung: "Etwa 750 bis 1500, Blütezeit der höfischen Dichtung auf Mittelhochdeutsch um 1200. Typisch: Minnesang (Werben um eine unerreichbare adelige Dame), Heldenepos, höfischer Roman mit ritterlichen Idealen wie Treue und Maß. Beispiele: Walther von der Vogelweide (Minnelieder), „Nibelungenlied“ (Verfasser unbekannt), Hartmann von Aue („Der arme Heinrich“).",
        fehler: [
          "Die hohe Minne als erfüllte Liebesbeziehung gedeutet",
          "Dem „Nibelungenlied“ einen bekannten Verfasser zugeschrieben",
          "Mittelhochdeutsch für einen Dialekt statt für eine frühere Sprachstufe gehalten",
        ],
      },
      {
        id: "deutsch.os.epochen.barock",
        name: "Barock",
        stufen: [10, 13],
        erklaerung: "Etwa 1600 bis 1720, geprägt vom Dreißigjährigen Krieg. Das Lebensgefühl ist voller Gegensätze: Vergänglichkeit (vanitas, memento mori) und Lebensgenuss (carpe diem), Diesseits und Jenseits; beliebt sind Sonette in Alexandrinern. Beispiele: Andreas Gryphius („Es ist alles eitel“, „Tränen des Vaterlandes“), Grimmelshausen („Simplicissimus“).",
        fehler: [
          "„Vanitas“ als Eitelkeit im heutigen Sinn verstanden statt als Vergänglichkeit und Nichtigkeit",
          "„Carpe diem“ als bloßen Spaßaufruf gedeutet, ohne den Bezug zum Tod",
          "Die Antithese zwischen den Hälften des Alexandriners übersehen",
        ],
      },
      {
        id: "deutsch.os.epochen.aufklaerung",
        name: "Aufklärung",
        stufen: [10, 13],
        erklaerung: "Etwa 1720 bis 1800. Leitidee ist die Vernunft: Der Mensch soll selbst denken, Vorurteile und Aberglauben überwinden und tolerant handeln. Literatur soll belehren und unterhalten, beliebt sind Fabel, Lehrgedicht und Drama. Beispiele: Gotthold Ephraim Lessing („Nathan der Weise“, „Emilia Galotti“), Christian Fürchtegott Gellert (Fabeln).",
        fehler: [
          "Aufklärung und Sturm und Drang vertauscht (Gefühl und Genie statt Vernunft)",
          "Lessings „Nathan der Weise“ der Weimarer Klassik zugeordnet",
          "Die Fabel als Kindergeschichte statt als lehrhafte Gattung gesehen",
        ],
      },
      {
        id: "deutsch.os.epochen.sturmunddrang",
        name: "Sturm und Drang",
        stufen: [10, 13],
        erklaerung: "Etwa 1765 bis 1785. Junge Autoren lehnen sich gegen Regeln, Ständegesellschaft und bloße Vernunft auf; im Mittelpunkt stehen Gefühl, Natur, Freiheit und das schöpferische Genie, die Sprache ist leidenschaftlich. Beispiele: Johann Wolfgang von Goethe („Die Leiden des jungen Werthers“), Friedrich Schiller („Die Räuber“, „Kabale und Liebe“).",
        fehler: [
          "„Die Leiden des jungen Werthers“ der Romantik zugeordnet, weil es um Gefühle geht",
          "Sturm und Drang mit der Weimarer Klassik gleichgesetzt, weil dieselben Autoren schreiben",
          "„Genie“ als besonders intelligenten Menschen verstanden statt als schöpferisch freien Künstler",
        ],
      },
      {
        id: "deutsch.os.epochen.klassik",
        name: "Weimarer Klassik",
        stufen: [11, 13],
        erklaerung: "Etwa 1786 bis 1805, von Goethes Italienreise bis zu Schillers Tod. Ideal ist der harmonische, maßvolle, humane Mensch, Vorbild die Antike; die Werke sind formstreng und wollen durch Schönheit erziehen. Beispiele: Johann Wolfgang von Goethe („Iphigenie auf Tauris“), Friedrich Schiller („Maria Stuart“, „Wilhelm Tell“, „Die Bürgschaft“).",
        fehler: [
          "Merkmale von Klassik und Romantik vertauscht (Sehnsucht und Fragment der Klassik zugeschrieben)",
          "Goethes „Werther“ der Klassik zugeordnet",
          "„Klassisch“ im Sinn von „alt und berühmt“ verwendet und jedes ältere Werk Klassik genannt",
        ],
      },
      {
        id: "deutsch.os.epochen.romantik",
        name: "Romantik",
        stufen: [11, 13],
        erklaerung: "Etwa 1795 bis 1835. Gegen Vernunft und Nützlichkeit setzt die Romantik Gefühl, Fantasie und Sehnsucht; Motive sind Nacht, Traum, Wandern, Natur und Mittelalter, Märchen und Volkslieder werden gesammelt. Beispiele: Novalis („Heinrich von Ofterdingen“), Joseph von Eichendorff („Aus dem Leben eines Taugenichts“), E. T. A. Hoffmann („Der Sandmann“).",
        fehler: [
          "„Romantisch“ nur im Sinn von „verliebt“ verstanden",
          "Merkmale von Klassik und Romantik vertauscht (Maß und Harmonie der Romantik zugeschrieben)",
          "Die Brüder Grimm für Erfinder ihrer Märchen gehalten statt für Sammler und Bearbeiter",
        ],
      },
      {
        id: "deutsch.os.epochen.biedermeier",
        name: "Biedermeier und Vormärz",
        stufen: [11, 13],
        erklaerung: "Etwa 1815 bis 1848, vom Wiener Kongress bis zur Revolution. Unter strenger Zensur zieht sich das Biedermeier ins Private zurück (Idylle, Maß, Ordnung), der Vormärz dagegen ist politisch und fordert Freiheit. Beispiele: Adalbert Stifter („Brigitta“); Vormärz: Heinrich Heine („Deutschland. Ein Wintermärchen“), Georg Büchner („Woyzeck“).",
        fehler: [
          "Biedermeier und Vormärz vertauscht (den Rückzug ins Private dem Vormärz zugeschrieben)",
          "Büchner der Romantik oder dem Naturalismus zugeordnet",
          "Den Rückzug ins Private gedeutet, ohne an die Zensur der Zeit zu denken",
        ],
      },
      {
        id: "deutsch.os.epochen.realismus",
        name: "Realismus",
        stufen: [11, 13],
        erklaerung: "Etwa 1848 bis 1890. Erzählt wird die Wirklichkeit des bürgerlichen Lebens, aber „poetisch“ verklärt, ohne Elend in allen Einzelheiten, oft mit Humor; Leitgattungen sind Novelle und Roman. Beispiele: Theodor Fontane („Effi Briest“), Theodor Storm („Der Schimmelreiter“), Marie von Ebner-Eschenbach („Krambambuli“).",
        fehler: [
          "Realismus und Naturalismus verwechselt (Elend und Dialekt dem Realismus zugeschrieben)",
          "„Realistisch“ als „wahre Begebenheit“ missverstanden",
          "Fontanes Gesellschaftsromane dem Naturalismus zugeordnet",
        ],
      },
      {
        id: "deutsch.os.epochen.naturalismus",
        name: "Naturalismus",
        stufen: [11, 13],
        erklaerung: "Etwa 1880 bis 1900. Die Wirklichkeit soll fast wissenschaftlich genau abgebildet werden, auch Armut, Krankheit und Elend; der Mensch gilt als bestimmt durch Herkunft und Milieu. Typisch sind Dialekt, Umgangssprache und Sekundenstil. Beispiele: Gerhart Hauptmann („Die Weber“, „Bahnwärter Thiel“), Arno Holz und Johannes Schlaf („Papa Hamlet“).",
        fehler: [
          "Naturalismus mit Naturlyrik verwechselt",
          "Merkmale von Realismus und Naturalismus vertauscht",
          "Den Sekundenstil als besonders schnelles Erzählen verstanden statt als Erzählen fast in Echtzeit",
        ],
      },
      {
        id: "deutsch.os.epochen.wienermoderne",
        name: "Wiener Moderne",
        stufen: [11, 13],
        erklaerung: "Etwa 1890 bis 1918, Wien um die Jahrhundertwende. Gegen den Naturalismus rücken Seele, Stimmung und Traum in den Mittelpunkt, beeinflusst von der Psychoanalyse; Themen sind Ich-Krise, Sprachkrise, Liebe und Tod, neu ist der innere Monolog. Beispiele: Arthur Schnitzler („Leutnant Gustl“), Hugo von Hofmannsthal („Ein Brief“, „Jedermann“).",
        fehler: [
          "Wiener Moderne und Expressionismus gleichgesetzt",
          "Den inneren Monolog als Tagebuch oder als Rede an andere gedeutet",
          "Hofmannsthals „Ein Brief“ als echten Privatbrief gelesen statt als erfundenen Text über die Sprachkrise",
        ],
      },
      {
        id: "deutsch.os.epochen.expressionismus",
        name: "Expressionismus",
        stufen: [11, 13],
        erklaerung: "Etwa 1910 bis 1925. Junge Autoren drücken Angst, Aufbruch und Protest aus: Großstadt, Krieg, Weltuntergang und Zerfall des Ichs. Die Sprache ist ausdrucksstark und oft schockierend: kühne Bilder, Farbsymbolik, Reihungsstil, Ausrufe. Beispiele: Georg Trakl („Grodek“), Georg Heym („Der Gott der Stadt“), Jakob van Hoddis („Weltende“).",
        fehler: [
          "Expressionismus und Impressionismus verwechselt (Ausdruck gegenüber Eindruck)",
          "Den Reihungsstil als bloße Aufzählung ohne Wirkung beschrieben",
          "Hässliche und schockierende Bilder als Unvermögen statt als bewusste Provokation gedeutet",
        ],
      },
      {
        id: "deutsch.os.epochen.zwischenkrieg",
        name: "Literatur der Zwischenkriegszeit (Neue Sachlichkeit)",
        stufen: [12, 13],
        erklaerung: "1918 bis 1933, in Österreich bis 1938. Die Neue Sachlichkeit beschreibt nüchtern Großstadt, Arbeitslosigkeit und Alltag, oft in Zeitromanen; in Österreich kommen kritische Volksstücke und der Rückblick auf die Monarchie dazu. Beispiele: Erich Kästner („Fabian“), Ödön von Horváth („Geschichten aus dem Wiener Wald“), Joseph Roth („Radetzkymarsch“).",
        fehler: [
          "Neue Sachlichkeit und Naturalismus verwechselt, weil beide die Wirklichkeit zeigen",
          "Werke der Zwischenkriegszeit zur Exilliteratur gezählt, nur weil die Autoren später fliehen mussten",
          "Horváths Volksstücke für heitere Komödien gehalten",
        ],
      },
      {
        id: "deutsch.os.epochen.exil",
        name: "Exilliteratur",
        stufen: [12, 13],
        erklaerung: "1933 bis 1945. Vor der Verfolgung durch die Nationalsozialisten fliehen viele Autorinnen und Autoren ins Ausland, aus Österreich vor allem 1938. Themen: Verfolgung, Heimatverlust, Widerstand, Erinnerung. Beispiele: Anna Seghers („Das siebte Kreuz“), Stefan Zweig („Schachnovelle“), Bertolt Brecht („Mutter Courage und ihre Kinder“).",
        fehler: [
          "Exil und innere Emigration gleichgesetzt (innere Emigration heißt: im Land bleiben und sich innerlich vom Regime abwenden)",
          "Die Exilliteratur in die Zeit nach 1945 verlegt",
          "Exil als freiwilligen Auslandsaufenthalt statt als Flucht vor Verfolgung verstanden",
        ],
      },
      {
        id: "deutsch.os.epochen.nachkrieg",
        name: "Nachkriegsliteratur",
        stufen: [12, 13],
        erklaerung: "Etwa 1945 bis 1960. Mit schlichter, unbelasteter Sprache wollen Autorinnen und Autoren neu beginnen (Kahlschlag, Trümmerliteratur); Themen: Heimkehr, Schuld, Hunger, Zerstörung, typisch sind Kurzgeschichte und Hörspiel. Beispiele: Wolfgang Borchert („Draußen vor der Tür“), Heinrich Böll („Wanderer, kommst du nach Spa…“), Ilse Aichinger („Spiegelgeschichte“).",
        fehler: [
          "Die bewusst karge Sprache als Schwäche statt als Programm gedeutet",
          "Trümmerliteratur nur auf zerstörte Häuser bezogen, nicht auf zerstörte Menschen und Werte",
          "Nachkriegsliteratur und Exilliteratur verwechselt",
        ],
      },
      {
        id: "deutsch.os.epochen.experimentell",
        name: "Experimentelle Literatur und konkrete Poesie",
        stufen: [12, 13],
        erklaerung: "Ab etwa 1950. Die Sprache selbst wird zum Material: Laute, Buchstaben und Wörter werden zerlegt, wiederholt und auf der Fläche angeordnet, oft ist der Text zugleich Bild (konkrete Poesie). In Österreich prägen die Wiener Gruppe und Ernst Jandl diese Richtung. Beispiele: Ernst Jandl („Laut und Luise“), H. C. Artmann („med ana schwoazzn dintn“).",
        fehler: [
          "Experimentelle Texte als sinnlos abgetan, statt Klang und Anordnung zu deuten",
          "Konkrete Poesie mit Gedichten über konkrete Gegenstände verwechselt",
          "Die Dialektgedichte der Wiener Gruppe für Volksdichtung gehalten",
        ],
      },
      {
        id: "deutsch.os.epochen.oesterreich1945",
        name: "Österreichische Literatur nach 1945",
        stufen: [12, 13],
        erklaerung: "Ab 1945. Viele Autorinnen und Autoren setzen sich kritisch mit der verdrängten NS-Vergangenheit, mit Gewalt in Familie und Gesellschaft und mit der Sprache auseinander; die Anti-Heimatliteratur zeigt das Landleben von seiner dunklen Seite. Beispiele: Ingeborg Bachmann („Malina“), Thomas Bernhard („Heldenplatz“), Elfriede Jelinek („Die Klavierspielerin“).",
        fehler: [
          "Anti-Heimatliteratur mit dem Heimatroman verwechselt",
          "Bernhards Übertreibungen wörtlich als Tatsachenbehauptungen gelesen",
          "Handkes „Publikumsbeschimpfung“ für ein Drama mit Handlung gehalten",
        ],
      },
      {
        id: "deutsch.os.epochen.gegenwart",
        name: "Gegenwartsliteratur",
        stufen: [12, 13],
        erklaerung: "Etwa ab 1990. Die Literatur ist vielfältig: Themen sind Migration und Mehrsprachigkeit, Identität, Familiengeschichte und Erinnerung, Digitalisierung und Klimawandel; oft verschwimmen Erfundenes und Autobiografisches. Beispiele: Daniel Kehlmann („Die Vermessung der Welt“), Robert Seethaler („Der Trafikant“), Saša Stanišić („Herkunft“).",
        fehler: [
          "Autobiografisch klingende Romane als Tatsachenberichte gelesen (Autofiktion übersehen)",
          "Ein Werk nur nach dem Erscheinungsjahr eingeordnet, ohne Themen und Erzählweise zu beachten",
          "Texte mehrsprachiger Autorinnen und Autoren nicht zur deutschsprachigen Literatur gezählt",
        ],
      },
    ],
  },
  {
    area: "Sachtexte und Medien",
    themen: [
      {
        id: "deutsch.os.medien.journalismus",
        name: "Journalistische Textsorten: Nachricht, Reportage, Kommentar, Glosse",
        stufen: [9, 13],
        erklaerung: "Informierende Textsorten (Nachricht, Bericht, Interview) berichten sachlich, die Reportage verbindet Fakten mit Eindrücken vor Ort. Meinungsbetonte (Kommentar, Leitartikel, Kolumne, Glosse, Rezension) bewerten offen, die Glosse ironisch. Signale für Meinung: wertende Wörter, Ironie, Forderungen. Beispiel: „die längst überfällige Reform“ wertet.",
        fehler: [
          "Eine Glosse für eine sachliche Nachricht gehalten und die Ironie übersehen",
          "Wertende Wörter in einem Bericht nicht bemerkt",
          "Reportage und Bericht verwechselt (die Reportage enthält Szenen und Eindrücke vor Ort)",
        ],
      },
      {
        id: "deutsch.os.medien.infografik",
        name: "Infografiken und Diagramme in eigenen Texten auswerten",
        stufen: [9, 13],
        erklaerung: "Zuerst Titel, Quelle, Zeitraum und Einheit nennen, dann die Darstellungsform (Balken-, Kreis-, Liniendiagramm). Danach die wichtigsten Aussagen beschreiben: Höchst- und Tiefstwerte, Entwicklungen, auffällige Unterschiede, ohne jeden Wert aufzuzählen. Beispiel: „Der Anteil stieg von 2015 bis 2023 von 20 auf 35 Prozent, also um 15 Prozentpunkte.“",
        fehler: [
          "Quelle, Zeitraum oder Einheit nicht genannt",
          "Jeden einzelnen Wert aufgezählt, statt die wichtigsten Aussagen zu bündeln",
          "Prozent und Prozentpunkte verwechselt (von 20 auf 35 Prozent sind plus 15 Prozentpunkte, nicht plus 15 Prozent)",
        ],
      },
      {
        id: "deutsch.os.medien.werbung",
        name: "Werbung analysieren",
        stufen: [9, 13],
        erklaerung: "Werbung soll Aufmerksamkeit wecken, Interesse und Wunsch erzeugen und zum Kauf bewegen (AIDA-Formel: Attention, Interest, Desire, Action). Mittel sind Slogan, Hochwertwörter, Superlative, Anglizismen, Reim und Wortspiel, emotionale Bilder und bekannte Gesichter. Beispiel: „Natürlich. Frisch. Von hier.“ arbeitet mit Hochwertwörtern und Ellipsen.",
        fehler: [
          "Nur das Bild beschrieben, ohne Text und Bild aufeinander zu beziehen",
          "Die Zielgruppe nicht bestimmt",
          "Werbeaussagen für geprüfte Produktinformationen gehalten („natürlich“, „gesund“ ohne Beleg)",
        ],
      },
      {
        id: "deutsch.os.medien.manipulation",
        name: "Manipulation und Propaganda in der Sprache erkennen",
        stufen: [11, 13],
        erklaerung: "Beeinflussende Sprache arbeitet mit Hochwert- und Stigmawörtern, Wir-gegen-die-Gegensätzen, Beschönigungen, Verallgemeinerungen und Angstbildern. Man prüft: Welche Wörter werten? Wer wird ausgegrenzt? Fehlen Belege? Was wird verschwiegen? Beispiel: „Kollateralschaden“ beschönigt den Tod unbeteiligter Menschen.",
        fehler: [
          "Hochwertwörter wie „Freiheit“ oder „Sicherheit“ als Argument akzeptiert, obwohl nichts begründet wird",
          "Wir-gegen-die-Formulierungen übersehen, die eine Gruppe ausgrenzen",
          "Emotionale Bilder und Angstszenarien für Tatsachen gehalten",
        ],
      },
      {
        id: "deutsch.os.medien.film",
        name: "Filmsprache: Einstellungsgrößen, Perspektiven und Schnitt",
        stufen: [9, 13],
        erklaerung: "Einstellungsgrößen reichen von Weit und Totale über Halbtotale, Halbnah und Nah bis Groß und Detail: weite zeigen den Raum, nahe Mimik und Gefühle. Die Vogelperspektive lässt Figuren klein wirken, die Froschperspektive mächtig; Schnitt und Montage bestimmen Tempo und Zusammenhang. Beispiel: Eine Detailaufnahme der zitternden Hand zeigt Angst.",
        fehler: [
          "Vogel- und Froschperspektive vertauscht",
          "Totale und Großaufnahme verwechselt",
          "Kameramittel nur benannt, aber nicht in ihrer Wirkung gedeutet",
        ],
      },
    ],
  },
  {
    area: "Wissenschaftliches Arbeiten",
    themen: [
      {
        id: "deutsch.os.wiss.quellen",
        name: "Quellen recherchieren und bewerten",
        stufen: [10, 13],
        erklaerung: "Für wissenschaftliche Arbeiten zählen überprüfbare Quellen: Fachbücher, Fachzeitschriften, Studien, Seiten seriöser Institutionen. Man prüft Urheber, Datum, Belege und Absicht. Online-Lexika und KI-Antworten sind höchstens ein Einstieg, zitiert wird die Originalquelle. Beispiel: Eine Studie einer Universität ist verlässlicher als ein anonymer Blog.",
        fehler: [
          "Einen Online-Lexikonartikel oder eine KI-Antwort zitiert, statt die Originalquelle zu suchen",
          "Urheber und Datum einer Internetseite nicht geprüft",
          "Werbung oder Meinungsbeiträge als neutrale Information verwendet",
        ],
      },
      {
        id: "deutsch.os.wiss.zitieren",
        name: "Direkt und indirekt zitieren",
        stufen: [10, 13],
        erklaerung: "Direktes Zitat: wörtlich in Anführungszeichen; Auslassungen und eigene Ergänzungen werden gekennzeichnet, meist mit eckigen Klammern […]. Indirektes Zitat (Paraphrase): sinngemäß in eigenen Worten, ohne Anführungszeichen, oft mit „vgl.“. Beide brauchen eine Quellenangabe. Beispiel: „Sprache verändert sich ständig“ (Huber 2020, S. 15), sinngemäß: (vgl. Huber 2020, S. 15).",
        fehler: [
          "Fremde Gedanken ohne Quellenangabe übernommen (Plagiat)",
          "Paraphrase zu nah am Original, nur einzelne Wörter ausgetauscht",
          "Ein wörtliches Zitat verändert, ohne die Änderung zu kennzeichnen",
        ],
      },
      {
        id: "deutsch.os.wiss.verzeichnis",
        name: "Quellenangaben und Literaturverzeichnis",
        stufen: [10, 13],
        erklaerung: "Im Text steht ein Kurzbeleg (Autor Jahr, Seite) oder eine Fußnote, im Literaturverzeichnis die vollständige Angabe, alphabetisch nach Nachnamen. Den Zitierstil legt oft die Schule fest, wichtig ist, ihn einheitlich anzuwenden. Bei Internetquellen kommen URL und meist das Abrufdatum dazu. Beispiel: Huber, Anna (2020): Sprache im Wandel. Wien: Beispielverlag.",
        fehler: [
          "Bei Internetquellen URL oder Abrufdatum vergessen",
          "Zitierweisen gemischt (einmal Fußnote, einmal Kurzbeleg)",
          "Eine Quelle im Text belegt, aber im Literaturverzeichnis vergessen",
        ],
      },
      {
        id: "deutsch.os.wiss.thema",
        name: "Thema eingrenzen und Forschungsfrage formulieren",
        stufen: [11, 13],
        erklaerung: "Ein weites Thema wird zeitlich, räumlich, inhaltlich oder nach einer Personengruppe eingegrenzt. Die Forschungsfrage ist offen (keine Ja-Nein-Frage), klar und mit den verfügbaren Quellen im vorgegebenen Umfang beantwortbar. Beispiel: statt „Klimawandel“ die Frage „Welche Folgen hat der Gletscherrückgang seit 2000 für den Tourismus in Tirol?“",
        fehler: [
          "Das Thema zu breit gewählt (der Zweite Weltkrieg)",
          "Eine Ja-Nein-Frage oder eine längst beantwortete Frage gestellt",
          "Eine Frage gewählt, zu der es keine zugänglichen Quellen gibt",
        ],
      },
      {
        id: "deutsch.os.wiss.aufbau",
        name: "Aufbau einer VWA oder Diplomarbeit",
        stufen: [11, 13],
        erklaerung: "Typischer Aufbau: Titelblatt, Abstract, Inhaltsverzeichnis, Einleitung (Forschungsfrage, Methode, Aufbau), Hauptteil in Kapiteln, Fazit mit der Antwort auf die Forschungsfrage, Literaturverzeichnis, bei Bedarf Anhang. Das Abstract fasst Frage, Vorgehen und Ergebnis knapp zusammen. Beispiel: Kapitel 2 klärt Begriffe, Kapitel 3 wertet die Umfrage aus.",
        fehler: [
          "Im Fazit neue Inhalte gebracht, statt die Forschungsfrage zu beantworten",
          "Das Abstract wie eine Einleitung geschrieben, ohne das Ergebnis zu nennen",
          "Die Einleitung ohne Forschungsfrage und Methode geschrieben",
        ],
      },
    ],
  },
  {
    area: "Präsentieren",
    themen: [
      {
        id: "deutsch.os.praesentieren.wirkung",
        name: "Verbale, paraverbale und nonverbale Mittel beim Sprechen",
        stufen: [9, 13],
        erklaerung: "Verbal ist, was gesagt wird. Paraverbal ist, wie es klingt: Lautstärke, Tempo, Pausen, Betonung, Stimmlage. Nonverbal ist die Körpersprache: Blickkontakt, Haltung, Gestik, Mimik. Alle drei sollen zusammenpassen. Beispiel: Eine kurze Pause vor der Kernaussage erhöht die Aufmerksamkeit.",
        fehler: [
          "Paraverbal und nonverbal verwechselt (den Tonfall zur Körpersprache gezählt)",
          "Vom Blatt abgelesen und keinen Blickkontakt gehalten",
          "Zu schnell gesprochen und keine Pausen gesetzt",
        ],
      },
      {
        id: "deutsch.os.praesentieren.folien",
        name: "Präsentation mit Folien zielgruppengerecht gestalten",
        stufen: [9, 13],
        erklaerung: "Inhalt und Sprache richten sich nach dem Publikum und seinem Vorwissen. Folien unterstützen den Vortrag, ersetzen ihn aber nicht: wenige Stichworte, große Schrift, ein Gedanke pro Folie, Bilder mit Quelle; man spricht frei zum Publikum. Beispiel: Statt eines Absatzes stehen drei Schlagworte und eine Grafik.",
        fehler: [
          "Ganze Sätze auf die Folien geschrieben und diese vorgelesen",
          "Fachbegriffe verwendet, die das Publikum nicht kennt, ohne sie zu erklären",
          "Bilder und Grafiken ohne Quellenangabe übernommen",
        ],
      },
      {
        id: "deutsch.os.praesentieren.moderieren",
        name: "Diskussionen leiten und moderieren",
        stufen: [10, 13],
        erklaerung: "Die Moderation eröffnet mit Thema und Regeln, stellt die Teilnehmenden vor, erteilt das Wort, achtet auf Redezeit und Fairness, fasst Zwischenergebnisse zusammen und schließt mit einem Resümee, ohne selbst Partei zu ergreifen. Beispiel: „Frau Berger, Sie sehen das anders. Was entgegnen Sie Herrn Novak?“",
        fehler: [
          "Als Moderator selbst Stellung bezogen",
          "Vielredner nicht unterbrochen und stille Teilnehmende nicht einbezogen",
          "Am Ende kein Ergebnis zusammengefasst",
        ],
      },
    ],
  },
  {
    area: "Sprachreflexion",
    themen: [
      {
        id: "deutsch.os.sprache.vierseiten",
        name: "Kommunikationsmodell: die vier Seiten einer Nachricht",
        stufen: [9, 13],
        erklaerung: "Nach Friedemann Schulz von Thun hat jede Nachricht vier Seiten: Sachinhalt (worüber ich informiere), Selbstkundgabe (was ich von mir zeige), Beziehung (was ich von dir halte) und Appell (wozu ich dich bringen will). Wer mit einem anderen „Ohr“ hört, versteht anders. Beispiel: „Die Ampel ist grün.“ kann als Appell „Fahr los!“ ankommen.",
        fehler: [
          "Selbstkundgabe und Beziehungsseite verwechselt",
          "Einen Appell nur in Befehlssätzen gesucht, obwohl auch Aussagesätze auffordern",
          "Geglaubt, eine Nachricht habe nur eine richtige Bedeutung",
        ],
      },
      {
        id: "deutsch.os.sprache.axiome",
        name: "Kommunikationsregeln nach Watzlawick",
        stufen: [9, 13],
        erklaerung: "Paul Watzlawick nennt fünf Grundregeln: Man kann nicht nicht kommunizieren. Jede Mitteilung hat einen Inhalts- und einen Beziehungsaspekt. Ursache und Wirkung werden verschieden gedeutet. Kommunikation ist digital (Worte) und analog (Tonfall, Gestik), symmetrisch (gleichrangig) oder komplementär (ergänzend). Beispiel: Auch Schweigen teilt etwas mit.",
        fehler: [
          "Symmetrisch als „gut“ und komplementär als „schlecht“ gewertet",
          "„Digital“ als „am Computer“ verstanden",
          "Den Beziehungsaspekt übersehen, weil der Inhalt sachlich klingt",
        ],
      },
      {
        id: "deutsch.os.sprache.oesterreich",
        name: "Österreichisches Deutsch",
        stufen: [9, 13],
        erklaerung: "Deutsch ist plurizentrisch: Österreich, Deutschland und die Schweiz haben je eine eigene, gleichberechtigte Standardvarietät. Austriazismen sind korrektes Standarddeutsch, kein Dialekt: Jänner, Paradeiser, Matura, heuer, ich bin gesessen. Beispiel: „Topfen“ (in Österreich) und „Quark“ (in Deutschland) sind beide Standardsprache.",
        fehler: [
          "Austriazismen als Fehler oder Dialekt angesehen (Jänner zu Januar ausgebessert)",
          "Dialektwörter für österreichisches Standarddeutsch gehalten (Bua statt Bub)",
          "Die bundesdeutsche Form für das einzig richtige Hochdeutsch gehalten",
        ],
      },
      {
        id: "deutsch.os.sprache.varietaeten",
        name: "Sprachvarietäten und Register: Soziolekt, Fachsprache, Jugendsprache",
        stufen: [9, 13],
        erklaerung: "Neben Standardsprache, Umgangssprache und Dialekt gibt es Soziolekte (Sprache einer Gruppe, etwa Jugendsprache), Fachsprachen (genaue Begriffe eines Fachs) und den Idiolekt (Sprache einer einzelnen Person). Ein Register ist die Sprachform, die man je nach Situation wählt. Beispiel: Im Chat schreibt man „lol“, im Bewerbungsschreiben nicht.",
        fehler: [
          "Soziolekt und Dialekt verwechselt (Gruppe gegenüber Region)",
          "Das Register nicht an die Situation angepasst (Jugendsprache in einer Matura-Textsorte)",
          "Fachsprache mit Fremdwörtern gleichgesetzt",
        ],
      },
      {
        id: "deutsch.os.sprache.geschichte",
        name: "Sprachgeschichte: vom Althochdeutschen zum Neuhochdeutschen",
        stufen: [10, 13],
        erklaerung: "Deutsch gehört zu den germanischen Sprachen der indogermanischen Sprachfamilie. Sprachstufen: Althochdeutsch (etwa 750 bis 1050), Mittelhochdeutsch (etwa 1050 bis 1350), Frühneuhochdeutsch (etwa 1350 bis 1650, mit Buchdruck und Luthers Bibelübersetzung) und Neuhochdeutsch (ab etwa 1650). Beispiel: mittelhochdeutsch „hûs“ wurde zu „Haus“.",
        fehler: [
          "Geglaubt, Deutsch stamme vom Lateinischen ab",
          "Lehnwörter aus dem Lateinischen für urdeutsche Wörter gehalten (Fenster, Mauer)",
          "Sprachstufen mit Literaturepochen verwechselt",
        ],
      },
      {
        id: "deutsch.os.sprache.wandel",
        name: "Sprachwandel heute: Bedeutungswandel und Entlehnungen",
        stufen: [10, 13],
        erklaerung: "Wörter ändern ihre Bedeutung: Erweiterung, Verengung, Verbesserung, Verschlechterung. Neue Wörter entstehen durch Entlehnung (Anglizismen wie „Meeting“), Zusammensetzung oder Kürzung, auch die Grammatik wandelt sich. Beispiel: „Hochzeit“ bedeutete früher jedes hohe Fest (Verengung), „Weib“ war ein neutrales Wort (Verschlechterung).",
        fehler: [
          "Bedeutungsverengung und Bedeutungserweiterung verwechselt",
          "Jede Veränderung als Sprachverfall bewertet",
          "Scheinanglizismen für echtes Englisch gehalten (Handy, Beamer)",
        ],
      },
      {
        id: "deutsch.os.sprache.zeichen",
        name: "Zeichen und Zeichenarten: Ikon, Index, Symbol",
        stufen: [10, 13],
        erklaerung: "Ein sprachliches Zeichen verbindet eine Lautform (Ausdruck) mit einer Bedeutung (Inhalt). Diese Verbindung ist willkürlich und beruht auf Vereinbarung, deshalb heißt der Baum auf Englisch „tree“. Zeichenarten: Ikon (Ähnlichkeit, etwa ein Piktogramm), Index (Anzeichen, etwa Rauch für Feuer), Symbol (Vereinbarung, etwa Wörter und Ziffern).",
        fehler: [
          "Index und Symbol verwechselt (Rauch als Symbol für Feuer bezeichnet)",
          "Geglaubt, Wörter hätten eine natürliche Verbindung zu ihrem Gegenstand",
          "Ein Piktogramm als Symbol eingeordnet, obwohl es durch Ähnlichkeit wirkt",
        ],
      },
      {
        id: "deutsch.os.sprache.pragmatik",
        name: "Syntax, Semantik und Pragmatik",
        stufen: [10, 13],
        erklaerung: "Die Syntax untersucht, wie Zeichen zu Sätzen verbunden werden, die Semantik, was sie bedeuten, die Pragmatik, wie sie in einer Situation gebraucht werden und was gemeint ist. Beispiel: „Es zieht.“ heißt wörtlich, dass Luft strömt (Semantik), kann aber die Bitte sein, das Fenster zu schließen (Pragmatik).",
        fehler: [
          "Nur die wörtliche Bedeutung geprüft und die gemeinte Absicht übersehen",
          "Semantik und Syntax verwechselt",
          "Die Sprechabsicht nur an der Satzart erkannt („Kannst du das Fenster schließen?“ als Frage nach der Fähigkeit)",
        ],
      },
      {
        id: "deutsch.os.sprache.gender",
        name: "Geschlechtergerecht formulieren",
        stufen: [9, 13],
        erklaerung: "Möglich sind Paarform (Schülerinnen und Schüler), neutrale Formen (Lehrkräfte) und Schrägstrich mit Ergänzungsstrich (Schüler/-innen). Stern, Doppelpunkt und Unterstrich zählen laut Rat für deutsche Rechtschreibung nicht zum Kernbestand der Orthografie, das Binnen-I sieht das Regelwerk nicht vor. Eine Form wählen, durchhalten. Beispiel: „Jede Schülerin und jeder Schüler gibt ihr oder sein Heft ab.“",
        fehler: [
          "Mitten im Text die Form gewechselt (erst Paarform, dann nur männlich)",
          "Bei der Paarform das Pronomen nur männlich gelassen (jede Schülerin und jeder Schüler gibt sein Heft ab)",
          "Eine Kurzform gebildet, die ohne Endung kein Wort ergibt (Ärzt/-innen)",
        ],
      },
    ],
  },
  {
    area: "Beistrichsetzung",
    themen: [
      {
        id: "deutsch.os.beistrich.zusatz",
        name: "Beistrich bei Beisätzen und nachgestellten Erläuterungen",
        stufen: [9, 13],
        erklaerung: "Beisätze (Appositionen) und nachgestellte Erläuterungen, oft mit „und zwar“, „nämlich“, „vor allem“, „zum Beispiel“, trennt man mit Beistrich ab; stehen sie mitten im Satz, mit Beistrich davor und danach. Beispiel: „Anna, meine Schwester, studiert in Graz.“ „Viele Früchte, zum Beispiel Marillen, reifen im Sommer.“",
        fehler: [
          "Den schließenden Beistrich nach dem Einschub vergessen (Anna, meine Schwester studiert in Graz)",
          "Vor „und zwar“ oder „vor allem“ keinen Beistrich gesetzt (Ich mag Obst vor allem Marillen)",
          "Auch bei engen Beisätzen einen Beistrich gesetzt (die Stadt, Graz statt die Stadt Graz)",
        ],
      },
      {
        id: "deutsch.os.beistrich.vergleich",
        name: "Beistrich bei Vergleichen mit „als“ und „wie“",
        stufen: [9, 13],
        erklaerung: "Verbinden „als“ oder „wie“ nur Wörter oder Wortgruppen, steht kein Beistrich. Leiten sie einen Nebensatz mit eigenem gebeugtem Verb ein, steht ein Beistrich. Beispiel: „Sie ist größer als ihr Bruder.“ aber „Sie ist größer, als ich dachte.“ „Er läuft so schnell wie sie.“ aber „Er läuft so schnell, wie er kann.“",
        fehler: [
          "Vor jedem „als“ einen Beistrich gesetzt (Sie ist größer, als ihr Bruder)",
          "Beim Vergleichssatz den Beistrich vergessen (Es war schöner als ich dachte)",
          "„als“ und „wie“ vertauscht (größer wie ich statt größer als ich)",
        ],
      },
      {
        id: "deutsch.os.beistrich.strichpunkt",
        name: "Strichpunkt und Doppelpunkt",
        stufen: [9, 13],
        erklaerung: "Der Strichpunkt trennt gleichrangige Sätze, die eng zusammengehören: stärker als ein Beistrich, schwächer als ein Punkt. Der Doppelpunkt kündigt etwas an: Aufzählung, Erklärung, Folgerung, direkte Rede; folgt ein ganzer Satz, schreibt man groß weiter. Beispiel: „Es regnete stark; das Spiel fiel aus.“ „Er hatte ein Ziel: Er wollte gewinnen.“",
        fehler: [
          "Einen Strichpunkt vor einen Nebensatz gesetzt (Ich blieb daheim; weil es regnete)",
          "Nach dem Doppelpunkt einen ganzen Satz kleingeschrieben (Er hatte ein Ziel: er wollte gewinnen)",
          "Nach dem Strichpunkt großgeschrieben, obwohl kein Nomen folgt (Es regnete stark; Das Spiel fiel aus)",
        ],
      },
    ],
  },
  {
    area: "Grammatik",
    themen: [
      {
        id: "deutsch.os.grammatik.daswas",
        name: "Relativpronomen „das“ oder „was“",
        stufen: [9, 13],
        erklaerung: "Nach einem sächlichen Nomen steht „das“: das Buch, das ich lese. „was“ steht nach „alles“, „nichts“, „vieles“, nach einem nominalisierten Superlativ (das Beste, was) und wenn sich der Relativsatz auf einen ganzen Satz bezieht. Beispiel: „Er gewann, was niemand erwartet hatte.“",
        fehler: [
          "Nach einem Nomen „was“ gesetzt (das Auto, was vor der Tür steht)",
          "Nach „alles“ „das“ gesetzt (alles, das ich weiß)",
          "Bei Bezug auf einen ganzen Satz „das“ gesetzt (Er kam pünktlich, das mich wunderte)",
        ],
      },
    ],
  },
  {
    area: "Bewerbung",
    themen: [
      {
        id: "deutsch.os.bewerbung.lebenslauf",
        name: "Lebenslauf",
        stufen: [9, 13],
        erklaerung: "Der tabellarische Lebenslauf ordnet die Angaben in Blöcken: persönliche Daten, Ausbildung, Berufserfahrung und Praktika, Kenntnisse (Sprachen, EDV), Interessen; meist beginnt man mit der aktuellsten Station. Zeitangaben einheitlich und lückenlos, Sprachen mit Niveau. Beispiel: „09/2024 bis heute: HTL, Fachrichtung Informatik“.",
        fehler: [
          "Zeitangaben uneinheitlich oder mit Lücken",
          "Unwichtige Einzelheiten aufgelistet, wichtige Praktika vergessen",
          "Sprachkenntnisse ungenau angegeben (gut statt Niveau B2)",
        ],
      },
      {
        id: "deutsch.os.bewerbung.schreiben",
        name: "Bewerbungsschreiben",
        stufen: [9, 13],
        erklaerung: "Ein formeller Brief mit Absender, Empfänger, Ort und Datum, Betreff, Anrede, Text, Grußformel, Unterschrift und Beilagen. Einleitung mit Bezug auf die Stelle, Hauptteil mit Fähigkeiten, belegt durch Beispiele und auf das Unternehmen bezogen, Schluss mit der Bitte um ein Gespräch. Beispiel: „Mit freundlichen Grüßen“ steht ohne Beistrich.",
        fehler: [
          "Mit einer Floskel begonnen („Hiermit bewerbe ich mich …“) statt mit einem persönlichen Einstieg",
          "Fähigkeiten behauptet, aber nicht belegt („Ich bin teamfähig“ ohne Beispiel)",
          "Nach der Anrede großgeschrieben weitergemacht (Sehr geehrte Frau Huber, Ich …)",
        ],
      },
      {
        id: "deutsch.os.bewerbung.gespraech",
        name: "Bewerbungsgespräch",
        stufen: [9, 13],
        erklaerung: "Vorbereitung: Unternehmen und Stelle kennen, Stärken mit Beispielen belegen, Antworten auf typische Fragen überlegen (Warum gerade wir?) und eigene Fragen vorbereiten. Im Gespräch: pünktlich, höflich, Standardsprache, Blickkontakt, ausreden lassen. Beispiel: Statt „Ich bin flexibel“ erzählt man, wann man im Praktikum kurzfristig eingesprungen ist.",
        fehler: [
          "Nichts über das Unternehmen gewusst",
          "Bei der Frage nach Schwächen eine versteckte Stärke genannt („Ich bin zu perfektionistisch“)",
          "Keine eigenen Fragen vorbereitet",
        ],
      },
    ],
  },
];

/**
 * Order between the Oberstufe skills: [skill, skill that should sit before it]. Own didactic choices,
 * like PREREQUISITES in lib/curriculum.ts.
 */
const VORAUSSETZUNGEN: [string, string][] = [
  ["deutsch.os.matura.eroerterung", "deutsch.os.argument.gliederung"],
  ["deutsch.os.matura.zusammenfassung", "deutsch.text.verstehen"],
  ["deutsch.os.matura.textanalyse", "deutsch.os.stil.wirkung"],
  ["deutsch.os.matura.textinterpretation", "deutsch.os.matura.textanalyse"],
  ["deutsch.os.lyrik.vers", "deutsch.os.lyrik.metrum"],
  ["deutsch.os.lyrik.versmasse", "deutsch.os.lyrik.metrum"],
  ["deutsch.os.lyrik.analyse", "deutsch.os.lyrik.metrum"],
  ["deutsch.os.epik.rede", "deutsch.os.epik.erzaehler"],
  ["deutsch.os.drama.form", "deutsch.os.drama.aufbau"],
  ["deutsch.os.drama.episch", "deutsch.os.drama.form"],
  ["deutsch.os.wiss.verzeichnis", "deutsch.os.wiss.zitieren"],
  ["deutsch.os.wiss.aufbau", "deutsch.os.wiss.thema"],
  ["deutsch.os.beistrich.vergleich", "deutsch.beistrich.nebensatz"],
  ["deutsch.os.grammatik.daswas", "deutsch.recht.dasdass"],
];

export const DEUTSCH_OBERSTUFE: Modul = { fach: "Deutsch", bereiche: BEREICHE, voraussetzungen: VORAUSSETZUNGEN };
