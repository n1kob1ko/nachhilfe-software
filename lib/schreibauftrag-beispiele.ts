/**
 * The examples of the Schreibaufträge: five Textbeilagen and a model text for every Textsorte, all written for the
 * DreamStudy. Authors, media, places and the people in the texts are invented; nothing comes from a newspaper, a
 * school book, the Aufgabenpool or Matura material. Used by the tests, the docs, the Teilübungen without a
 * Textbeilage of the teacher's own and the "So kann es aussehen" view while writing.
 *
 * The Textbeilagen are broken into lines of about 62 characters, as on a printed sheet, so the line numbers mean
 * something. The model texts follow the parts of the Schreibplan (lib/schreibauftrag.ts), stay within the word
 * range of the default target and get no "tipp" among the Hinweise; lib/schreibauftrag.test.ts checks both, and
 * every quote of the Textanalyse against its line.
 */
import type { AuftragView, SorteKey } from "./schreibauftrag";

type BeilageText = Pick<AuftragView, "title" | "author" | "year" | "medium" | "kind" | "text">;
export type BeispielDaten = { beilage: BeilageText; situation: string; teile: { teil: string; text: string }[] };

/** Kommentar, 32 Zeilen. */
const SCHLAF: BeilageText = {
  title: "Ausgeschlafen lernt es sich besser",
  author: "Helene Baumgartl",
  year: "12. März 2026",
  medium: "Der Talblick",
  kind: "Kommentar",
  text: `Es ist zehn vor acht, erste Stunde, Mathematik. In der dritten
Reihe stützt ein Sechzehnjähriger den Kopf auf die Hand, die
Augen halb geschlossen. Faul? Nein. Müde. Und das liegt nicht
an ihm, sondern an der Uhr.
Schlafforscherinnen und Schlafforscher weisen seit Jahren
darauf hin: Der innere Rhythmus von Jugendlichen verschiebt
sich in der Pubertät nach hinten. Wer fünfzehn ist, wird
abends später müde und braucht morgens länger, um wach zu
werden. Das ist keine Ausrede, das ist Biologie. Trotzdem
beginnt der Unterricht an den meisten Schulen noch immer vor
acht Uhr, als hätte sich seit hundert Jahren nichts geändert.
Die Folgen kennt jede Lehrerin und jeder Lehrer. Die ersten
Stunden rauschen an vielen Köpfen einfach vorbei. Wer zu wenig
schläft, merkt sich weniger, ist gereizter und wird öfter
krank. Wir verlangen von jungen Menschen Höchstleistungen und
rauben ihnen dafür den Schlaf.
Natürlich gibt es Einwände. Die Eltern müssen zur Arbeit, die
Busse fahren nach festen Plänen, und der Nachmittag wird
länger. Das alles stimmt. Aber Fahrpläne sind nicht in Stein
gemeißelt, und eine Betreuung am Morgen lässt sich
organisieren. Schulen, die es ausprobiert haben, berichten
Erstaunliches: Die Jugendlichen kommen pünktlicher, sie fehlen
seltener, und ihre Noten werden nicht schlechter, sondern
besser.
Eine Stunde später anzufangen kostet kein Geld. Es braucht nur
Mut, eine alte Gewohnheit zu ändern. Schulen, Gemeinden und
Verkehrsbetriebe sollten sich an einen Tisch setzen, statt die
Verantwortung hin und her zu schieben.
Denn am Ende geht es um eine einfache Frage: Wollen wir
Schülerinnen und Schüler, die anwesend sind, oder solche, die
wirklich da sind? Ausgeschlafene Köpfe lernen besser. Geben
wir ihnen die Stunde, die sie brauchen.`,
};

/** Bericht, 30 Zeilen. */
const JUGENDTREFF: BeilageText = {
  title: "Jugendtreff schließt künftig um 20 Uhr",
  author: "Lukas Steinmauer",
  year: "3. Februar 2026",
  medium: "Stadtzeitung Neustein",
  kind: "Bericht",
  text: `Der Jugendtreff in der alten Remise am Bahnhofsplatz hat ab
März kürzere Öffnungszeiten. Statt bis 22 Uhr bleibt er nur
noch bis 20 Uhr offen. Das hat der Gemeinderat in seiner
Sitzung am Donnerstag mit knapper Mehrheit beschlossen.
Grund für die Entscheidung sind Beschwerden aus der
Nachbarschaft. Anrainerinnen und Anrainer klagen seit dem
Sommer über Lärm am Abend, über laute Musik vor dem Gebäude
und über Müll auf dem Parkplatz. „Wir haben nichts gegen die
Jugendlichen, aber wir wollen ab zehn Uhr schlafen können“,
sagte ein Anrainer bei der Sitzung.
Der Jugendtreff wird an Wochentagen von rund vierzig
Jugendlichen zwischen zwölf und achtzehn Jahren besucht. Zwei
Jugendarbeiterinnen betreuen ihn. Sie kritisieren den
Beschluss scharf. „Gerade am Abend kommen die, die sonst
keinen Ort haben“, erklärte eine der beiden. Viele Jugendliche
hätten nach der Schule oder der Lehre erst ab 18 Uhr Zeit. Mit
zwei Stunden lohne sich der Weg für viele nicht mehr.
Auch im Gemeinderat war die Entscheidung umstritten. Eine
Fraktion schlug vor, eine Lärmschutzwand zu bauen und
zusätzliche Mistkübel aufzustellen, statt die Öffnungszeiten
zu kürzen. Der Vorschlag fand keine Mehrheit, weil die Kosten
von rund 15.000 Euro im Budget nicht vorgesehen sind.
Die Bürgermeisterin betonte, die neue Regelung gelte vorerst
bis Oktober. Dann wolle man gemeinsam mit den Jugendlichen und
der Nachbarschaft prüfen, wie es weitergeht. Eine
Bürgerversammlung zum Thema ist für April geplant.
Die Jugendlichen selbst wurden vor dem Beschluss nicht
gefragt. Eine Gruppe sammelt nun Unterschriften für längere
Öffnungszeiten. Bis Montag hatten bereits 230 Personen
unterschrieben.`,
};

/** Kolumne, 31 Zeilen. */
const HAUSUEBUNG: BeilageText = {
  title: "Schluss mit der Hausübung!",
  author: "Felix Wanninger",
  year: "Mai 2026",
  medium: "Familienjournal",
  kind: "Kolumne",
  text: `Es ist Dienstagabend, kurz nach acht. Am Küchentisch sitzt
eine Zwölfjährige vor einem Arbeitsblatt über Bruchrechnung
und weint. Neben ihr sitzt ihr Vater, der die Aufgabe auch
nicht versteht. So oder ähnlich sieht es in vielen Familien
aus. Ich meine: Es ist Zeit, die Hausübung abzuschaffen.
Das wichtigste Argument ist die Gerechtigkeit. Wer Eltern hat,
die Zeit haben und den Stoff verstehen, bekommt zu Hause
Hilfe. Wer allein ist, weil die Eltern bis spät arbeiten oder
selbst nie eine höhere Schule besucht haben, bleibt mit seinen
Fragen sitzen. So macht die Hausübung aus kleinen
Unterschieden große.
Dazu kommt der Druck. Nach sechs oder sieben Stunden
Unterricht noch eine Stunde Aufgaben, dazu Lernen für Tests:
Viele Kinder haben einen längeren Arbeitstag als ihre Eltern.
Für Sport, Musik, Freunde oder einfach für das Nichtstun
bleibt wenig Zeit. Dabei brauchen Kinder genau das, um gesund
zu bleiben.
Und bringt die Hausübung überhaupt etwas? In der Volksschule
ist ihr Nutzen umstritten. In höheren Klassen hilft Üben zwar,
aber nur, wenn jemand die Fehler bemerkt. Eine falsch
gerechnete Seite, die niemand ansieht, festigt vor allem die
Fehler.
Natürlich muss geübt werden. Niemand lernt Vokabeln oder
Rechenwege vom Zuschauen. Aber Üben gehört in die Schule, wo
Lehrerinnen und Lehrer helfen können. Eine Übungsstunde am
Ende des Schultags, in der Klasse und mit Betreuung, wäre
fairer und wirksamer.
Die Schule ist der Arbeitsplatz der Kinder. Wenn sie nach
Hause gehen, sollte die Arbeit erledigt sein. Für Erwachsene
halten wir das für selbstverständlich. Warum nicht für unsere
Kinder?`,
};

/** Zeitungsartikel, 32 Zeilen. */
const REGENWASSER: BeilageText = {
  title: "Jeder Tropfen zählt",
  author: "Agnes Pröll",
  year: "8. Mai 2026",
  medium: "Der Talblick",
  kind: "Zeitungsartikel",
  text: `Die letzten drei Sommer waren in der Region die trockensten
seit Beginn der Messungen. Im August mussten mehrere Gemeinden
verbieten, Gärten zu gießen und Pools zu befüllen. Fachleute
fordern nun, Regenwasser viel stärker zu nutzen als bisher.
„Wir lassen jedes Jahr Millionen Liter Wasser einfach in den
Kanal rinnen“, sagt eine Hydrologin, die für das Land die
Wasserversorgung plant. Auf ein durchschnittliches
Einfamilienhaus fallen im Jahr rund 80.000 Liter Regen. Ein
großer Teil davon könnte gesammelt und für den Garten, die
Toilettenspülung oder die Waschmaschine verwendet werden.
Trinkwasser sei dafür eigentlich zu kostbar.
Gesammeltes Regenwasser entlastet aber nicht nur die
Leitungen. Es hilft auch bei Starkregen. Wenn das Wasser
zuerst in Tonnen und Zisternen fließt, laufen Kanäle und
Keller seltener über. Gerade weil Trockenheit und heftige
Gewitter beide zunehmen, sei das Sammeln doppelt sinnvoll,
erklärt die Expertin.
Kritik kommt von manchen Hausbesitzerinnen und Hausbesitzern.
Eine Zisterne kostet je nach Größe mehrere tausend Euro, und
vor dem Winter muss sie gewartet werden. Zudem lohnt sich der
Einbau vor allem bei Neubauten, bei alten Häusern sind die
Arbeiten aufwendig.
Die Gemeinden der Region wollen deshalb helfen. Wer eine
Zisterne einbaut, bekommt künftig bis zu einem Drittel der
Kosten ersetzt. Für einfache Regentonnen gibt es einen
Zuschuss von 50 Euro. Außerdem sollen alle neuen öffentlichen
Gebäude, vom Kindergarten bis zum Bauhof, Regenwasser sammeln.
Die Hydrologin ist überzeugt, dass sich der Aufwand lohnt.
Wenn nur jeder dritte Haushalt mitmache, könne die Region im
Sommer bis zu einem Fünftel weniger Trinkwasser verbrauchen.
„Jeder Tropfen, den wir auffangen, ist ein Tropfen, den wir im
August nicht vermissen.“`,
};

/** Reportage, 33 Zeilen. */
const REPARATURCAFE: BeilageText = {
  title: "Kaputt heißt nicht verloren",
  author: "Rosa Dornegger",
  year: "20. April 2026",
  medium: "Stadtzeitung Neustein",
  kind: "Reportage",
  text: `Ein Toaster, zwei Fahrräder, eine Nähmaschine und ein Handy
mit gesprungenem Display: Am ersten Samstag im Monat stapeln
sich im alten Feuerwehrhaus Dinge, die anderswo im Müll landen
würden. Seit einem Jahr gibt es hier das Reparaturcafé. Zwölf
Freiwillige, darunter eine pensionierte Elektrikerin, ein
Fahrradmechaniker und zwei Schüler einer HTL, helfen beim
Reparieren, und zwar kostenlos.
Das Prinzip ist einfach. Wer etwas Kaputtes bringt, repariert
es gemeinsam mit einer Helferin oder einem Helfer. Man schaut
zu, hält das Werkzeug und lernt dabei, wie ein Gerät aufgebaut
ist. „Die meisten sind überrascht, wie oft nur eine
Kleinigkeit fehlt“, sagt einer der Helfer. Im ersten Jahr
wurden rund 300 Dinge repariert, etwa zwei Drittel davon
erfolgreich.
Für Jugendliche ist das Reparaturcafé besonders interessant.
Fahrräder und Kopfhörer sind die häufigsten Fälle, und wer
einmal selbst einen Schlauch geflickt hat, braucht beim
nächsten Mal keine Hilfe mehr. Einige junge Leute kommen
inzwischen regelmäßig, um selbst mitzuhelfen.
Es gibt aber auch Grenzen. Manchmal muss man über eine Stunde
warten, bis jemand Zeit hat. Ersatzteile muss man selbst
bezahlen, und eine Garantie gibt es nicht. Bei manchen Handys
lässt sich das Gehäuse gar nicht öffnen, ohne es zu
beschädigen. Dann bleibt auch den Freiwilligen nur ein
Achselzucken.
Trotzdem ist der Andrang groß. Viele Besucherinnen und
Besucher kommen nicht nur wegen der Reparatur. Es gibt Kaffee
und Kuchen gegen eine freiwillige Spende, und an den langen
Tischen kommen Menschen ins Gespräch, die sich sonst nie
begegnen würden.
Das nächste Reparaturcafé findet am Samstag, dem 2. Mai, von
10 bis 14 Uhr statt. Eine Anmeldung ist nicht nötig. Wer
helfen möchte, kann einfach vorbeikommen.`,
};

/** A model text per Textsorte, part by part; a part with several paragraphs (Betreff, Anrede, Gruß) has them on lines of their own. */
export const BEISPIELE: Record<Exclude<SorteKey, "textinterpretation">, BeispielDaten> = {
  zusammenfassung: {
    beilage: REGENWASSER,
    situation: "",
    teile: [
      {
        teil: "einleitung",
        text: "Der Zeitungsartikel „Jeder Tropfen zählt“ von Agnes Pröll ist am 8. Mai 2026 in der Regionalzeitung „Der Talblick“ erschienen. Er behandelt die Frage, wie Haushalte und Gemeinden nach mehreren sehr trockenen Sommern Regenwasser sammeln und sinnvoll verwenden können, um Trinkwasser zu sparen.",
      },
      {
        teil: "position",
        text: "Die Autorin berichtet, dass die Region drei Sommer hintereinander so wenig Niederschlag erlebt habe wie noch nie. Im August hätten einige Gemeinden sogar das Bewässern von Gärten und das Füllen von Schwimmbecken untersagt. Fachleute verlangen deshalb, Regenwasser deutlich besser zu nutzen. Eine Hydrologin, die im Auftrag des Landes für die Versorgung mit Wasser zuständig ist, kritisiert, dass jährlich riesige Mengen ungenutzt im Kanal verschwinden. Trinkwasser sei zu wertvoll, um damit die Toilette zu spülen, den Rasen zu bewässern oder Wäsche zu waschen.",
      },
      {
        teil: "begruendung",
        text: "Auf das Dach eines gewöhnlichen Einfamilienhauses fallen laut Artikel jährlich etwa 80.000 Liter Niederschlag, von denen sich ein großer Teil auffangen ließe. Das Sammeln habe außerdem einen zweiten Vorteil: Bei Unwettern fließe das Wasser zunächst in Tonnen und Zisternen, sodass Kanäle und Keller weniger oft überlaufen. Weil sowohl Dürre als auch Gewitter häufiger würden, sei es nach Ansicht der Expertin doppelt sinnvoll, Regen aufzufangen. Der Artikel verschweigt aber auch die Einwände nicht. Manche Hausbesitzer kritisieren, dass eine Zisterne mehrere tausend Euro koste und jedes Jahr vor dem Winter gewartet werden müsse. Bei älteren Gebäuden sei der Einbau zudem aufwendig.",
      },
      {
        teil: "folgerung",
        text: "Die Gemeinden wollen den Umstieg erleichtern und reagieren mit Förderungen: Wer eine Zisterne baut, erhält bis zu einem Drittel des Preises zurück, für eine Regentonne gibt es 50 Euro. Auch neue öffentliche Bauten wie Kindergärten sollen künftig Regenwasser auffangen. Die Hydrologin folgert, dass der Verbrauch von Trinkwasser im Sommer um bis zu zwanzig Prozent sinken könnte, wenn sich nur jeder dritte Haushalt beteiligte. Was man im Frühjahr auffange, müsse man im August nicht vermissen.",
      },
    ],
  },
  leserbrief: {
    beilage: SCHLAF,
    situation: "Du schreibst als Schülerin oder Schüler einer Oberstufe aus der Region.",
    teile: [
      {
        teil: "einleitung",
        text: "Später anfangen, besser lernen\nSehr geehrte Damen und Herren der Redaktion,\nmit großem Interesse habe ich den Kommentar „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl gelesen, der am 12. März 2026 im „Talblick“ erschienen ist. Als Schülerin einer siebten Klasse kenne ich das Problem aus eigener Erfahrung und möchte dazu Stellung nehmen.",
      },
      {
        teil: "inhalt",
        text: "Die Autorin fordert, dass der Unterricht eine Stunde später beginnt. Sie begründet das mit dem Schlafrhythmus von Jugendlichen und mit guten Erfahrungen an Schulen, die es schon ausprobiert haben. Einwände wie die Arbeitszeiten der Eltern hält sie für lösbar.",
      },
      {
        teil: "meinung",
        text: "Ich stimme Frau Baumgartl völlig zu, denn ich erlebe das Problem jeden Tag. Mein Bus fährt um 6.40 Uhr, und in der ersten Stunde kann ich mich kaum konzentrieren. Vielen in meiner Klasse geht es genauso. Wer schon müde in den Tag startet, ist auch am Nachmittag erschöpft und lernt zu Hause weniger.\nAußerdem wäre ein späterer Beginn gesünder. Wenn wir ausgeschlafen sind, werden wir seltener krank und sind besser gelaunt. Davon profitieren auch die Lehrerinnen und Lehrer, weil der Unterricht ruhiger wird. An Tagen, an denen ich erst zur zweiten Stunde beginne, verstehe ich den Stoff viel schneller.\nDen Einwand, dass Eltern früh zur Arbeit müssen, nehme ich ernst. Man könnte aber zum Beispiel eine Betreuung ab sieben Uhr anbieten, etwa in der Bibliothek. Wer früh kommen muss, könnte dort lesen oder lernen. Auch die Busse ließen sich sicher anpassen.",
      },
      {
        teil: "schluss",
        text: "Ich appelliere deshalb an die Schulleitungen und die Gemeinden der Region: Probieren Sie den späteren Beginn wenigstens ein Semester lang aus und fragen Sie uns Schülerinnen und Schüler, wie es uns damit geht. Eine Stunde mehr Schlaf kostet nichts, kann aber viel verändern. Wir Jugendlichen sind nicht faul, wir brauchen nur eine Schule, die zu unserem Rhythmus passt.\nMit freundlichen Grüßen\nMira Lechner, 7B",
      },
    ],
  },
  eroerterung: {
    beilage: HAUSUEBUNG,
    situation: "Sollen Hausübungen abgeschafft werden?",
    teile: [
      {
        teil: "einleitung",
        text: "Hausübung: Last oder Lernhilfe?\nKaum ein Thema sorgt in Familien für so viel Streit wie die Hausübung: Kinder sitzen bis zum Abend über Arbeitsblättern, Eltern erklären Rechenwege, die sie selbst vergessen haben. Felix Wanninger fordert in seiner Kolumne „Schluss mit der Hausübung!“, die im Mai 2026 im „Familienjournal“ erschienen ist, sie ganz abzuschaffen. Doch sollen Hausübungen wirklich abgeschafft werden?",
      },
      {
        teil: "position",
        text: "Der Autor begründet seine Forderung vor allem mit der Gerechtigkeit: Kinder, deren Eltern Zeit haben und den Stoff verstehen, bekommen zu Hause Hilfe, andere bleiben allein. Außerdem seien viele Kinder durch Unterricht, Aufgaben und Tests überlastet. Er bezweifelt zudem den Nutzen, weil Fehler zu Hause oft niemand bemerke. Üben lehnt Wanninger nicht ab, es gehöre aber in die Schule, wo Lehrkräfte helfen können. Er schlägt deshalb eine betreute Übungsstunde am Ende des Schultags vor. Für ihn ist die Schule der Arbeitsplatz der Kinder, und nach der Arbeit sollte Freizeit sein.",
      },
      {
        teil: "gegenseite",
        text: "Für die Abschaffung spricht vor allem das Argument der Gerechtigkeit. Nicht alle Kinder haben zu Hause dieselben Voraussetzungen. Wer zum Beispiel ältere Geschwister oder Eltern mit Matura hat, kann bei Problemen nachfragen, während andere allein vor der Aufgabe sitzen. Die Hausübung kann so Unterschiede zwischen Familien vergrößern. Wer zu Hause keine Hilfe hat, bekommt schlechtere Noten, obwohl er vielleicht genauso begabt ist. Nachhilfe können sich wiederum nicht alle Familien leisten.\nEin weiteres Argument ist die Belastung. Wenn der Unterricht erst am Nachmittag endet und danach noch eine Stunde Aufgaben wartet, bleibt kaum Zeit für Sport, Musik oder Freunde. Manche Kinder haben dadurch einen längeren Arbeitstag als ihre Eltern. Gerade freie Zeit ist aber wichtig, weil Kinder Erholung brauchen, um gesund zu bleiben.\nSchließlich wird auch der Nutzen bezweifelt. Wer eine Rechnung falsch übt und von niemandem korrigiert wird, prägt sich im schlimmsten Fall den Fehler ein. Und wenn die Hausübung abgeschrieben oder von den Eltern erledigt wird, lernt das Kind gar nichts. Eine Übungsstunde in der Schule, wie Wanninger sie vorschlägt, hätte dieses Problem nicht.",
      },
      {
        teil: "eigeneseite",
        text: "Trotzdem halte ich eine völlige Abschaffung für falsch. Zwar stimmt es, dass nicht jedes Kind zu Hause Hilfe bekommt, doch dieses Problem lässt sich anders lösen, etwa durch eine Lernbetreuung am Nachmittag oder durch Erklärvideos der Lehrkräfte. Wer zu Hause keine Unterstützung hat, braucht mehr Hilfe, nicht weniger Übung.\nAußerdem lernt man durch Hausübungen, selbstständig zu arbeiten. Man muss sich die Zeit einteilen und dranbleiben, auch wenn eine Aufgabe schwierig ist. Wer nie allein geübt hat, tut sich vor der Matura schwer, wenn plötzlich ganze Kapitel ohne Hilfe wiederholt werden müssen. Diese Fähigkeit braucht man spätestens im Studium oder im Beruf.\nDas stärkste Argument ist jedoch, dass Üben Zeit braucht. In einer Schulstunde mit fünfundzwanzig Kindern kann nicht jedes so lange üben, wie es nötig wäre. Vokabeln zum Beispiel bleiben nur im Gedächtnis, wenn man sie mehrmals und über mehrere Tage verteilt wiederholt. Eine einzige Übungsstunde am Ende des Schultags reicht dafür nicht aus. Außerdem zeigt eine Hausübung den Lehrkräften, wo jemand noch Schwierigkeiten hat.",
      },
      {
        teil: "schluss",
        text: "Nach Abwägung der Argumente komme ich zu dem Schluss, dass Hausübungen nicht abgeschafft, aber verändert werden sollten. Wanninger hat recht, dass sie ungerecht sein können und Kinder oft überfordern. Die Lösung ist aber nicht, das Üben zu Hause ganz zu streichen. Hausübungen sollten kurz sein, regelmäßig besprochen werden und keine Hilfe der Eltern voraussetzen. Dann können sie leisten, was Wanninger vermisst: Sie festigen das Gelernte, statt Familien zu belasten. So bleibt das Üben erhalten, und die Ungerechtigkeit wird kleiner.",
      },
    ],
  },
  kommentar: {
    beilage: JUGENDTREFF,
    situation: "Dein Kommentar erscheint in der Schülerzeitung.",
    teile: [
      {
        teil: "einstieg",
        text: "Zwei Stunden Jugend sind zu wenig\nAb März müssen die Jugendlichen in Neustein um 20 Uhr ihren Treffpunkt verlassen. Nicht, weil sie etwas angestellt haben, sondern weil sich Nachbarn gestört fühlen. So hat es der Gemeinderat mit knapper Mehrheit beschlossen. Was nach einer kleinen Änderung der Öffnungszeiten klingt, ist in Wahrheit ein deutliches Signal an die Jugend der Stadt.",
      },
      {
        teil: "bezug",
        text: "Wie die „Stadtzeitung Neustein“ am 3. Februar berichtet hat, schließt der Jugendtreff in der alten Remise künftig zwei Stunden früher. Grund sind Beschwerden über Lärm und Müll. Die Jugendarbeiterinnen kritisieren den Beschluss, ein Vorschlag für eine Lärmschutzwand ist am Geld gescheitert. Die Regelung gilt vorerst bis Oktober, gefragt wurden die Jugendlichen vorher nicht. Inzwischen sammelt eine Gruppe von ihnen Unterschriften für längere Öffnungszeiten.",
      },
      {
        teil: "meinung",
        text: "Natürlich haben die Nachbarn ein Recht auf Ruhe. Wer um sechs Uhr aufstehen muss, will um zehn schlafen. Doch die Lösung ist die falsche, denn sie trifft genau jene, die den Treff am dringendsten brauchen. Lehrlinge zum Beispiel kommen oft erst um 18 Uhr von der Arbeit. Für sie bleiben zwei Stunden, und dafür lohnt sich der Weg kaum.\nWo werden diese Jugendlichen ihre Abende in Zukunft verbringen? Vermutlich auf dem Bahnhofsplatz oder im Park, ohne Betreuung und ohne Dach. Der Lärm verschwindet also nicht, er zieht nur ein paar Straßen weiter. Wer das für eine Lösung hält, macht es sich zu leicht. Denn dort gibt es keine Jugendarbeiterinnen, die ein Auge auf die Gruppe haben und bei Streit eingreifen.\nAuch das Argument mit dem Geld überzeugt mich nicht. 15.000 Euro sind viel, aber eine Lärmschutzwand wäre eine Lösung für viele Jahre: Die Nachbarn hätten ihre Ruhe, und der Treff könnte offen bleiben. Früher zuzusperren ist billiger, kostet aber etwas anderes, nämlich das Vertrauen der Jugendlichen. Und dieses Vertrauen ist schwerer zurückzugewinnen als jedes Budget.\nAm schwersten wiegt, dass die Jugendlichen nicht gefragt wurden. Man redet über sie, aber nicht mit ihnen. Dabei hätten sie vielleicht selbst Ideen gehabt, etwa einen Ordnerdienst am Abend oder eine gemeinsame Aufräumaktion. Dass schon 230 Menschen für längere Öffnungszeiten unterschrieben haben, zeigt, wie viele das genauso sehen.",
      },
      {
        teil: "schluss",
        text: "Die Bürgermeisterin will im Oktober gemeinsam mit allen Beteiligten prüfen, wie es weitergeht. Das ist ein Anfang, aber warum erst nach dem Beschluss? Der Gemeinderat sollte die Bürgerversammlung im April nutzen, um eine echte Lösung zu finden: mit Lärmschutz, mit klaren Regeln und mit den Jugendlichen am Tisch. Ein Treff, der um acht zusperrt, ist für viele kein Treff mehr, sondern ein verschlossenes Tor. Die Gemeinde sollte sich gut überlegen, ob sie das will. Sonst bleibt am Ende nur eine Botschaft hängen: Ihr seid hier nicht erwünscht.",
      },
    ],
  },
  meinungsrede: {
    beilage: HAUSUEBUNG,
    situation: "Du sprichst bei der Schulversammlung vor Mitschülerinnen, Mitschülern und Lehrkräften.",
    teile: [
      {
        teil: "anrede",
        text: "Sehr geehrte Frau Direktorin, liebe Lehrerinnen und Lehrer, liebe Mitschülerinnen und Mitschüler!\nWer von euch hat gestern nach acht Uhr abends noch an einer Hausübung gesessen? Ich sehe viele Hände. Ich war auch dabei: Mathematik, eine ganze Seite Gleichungen, und als ich fertig war, war es fast zehn. Habe ich dabei noch etwas gelernt? Ehrlich gesagt: nicht viel. Und am nächsten Morgen war ich so müde, dass ich in der ersten Stunde kaum zuhören konnte. Heute möchte ich mit euch darüber sprechen, ob das so sein muss.",
      },
      {
        teil: "bezug",
        text: "Vor Kurzem habe ich im „Familienjournal“ die Kolumne „Schluss mit der Hausübung!“ von Felix Wanninger gelesen. Er beschreibt ein Mädchen, das abends weinend über Bruchrechnungen sitzt, während der Vater selbst nicht weiterweiß. Wanninger fordert, die Hausübung abzuschaffen und das Üben ganz in die Schule zu verlegen. Das klingt radikal, aber es betrifft uns alle hier im Saal.",
      },
      {
        teil: "argumente",
        text: "Ich möchte euch heute für einen Mittelweg gewinnen: eine betreute Lernstunde am Ende des Schultags statt einer Hausübung in jedem Fach.\nMein erstes Argument ist ganz einfach: Wir sind müde. Nach sieben Stunden Unterricht ist unser Kopf voll. Wer dann noch zwei Stunden Hausübung macht, hat einen längeren Arbeitstag als viele Erwachsene. Und wann bleibt Zeit für den Fußballverein, für die Musikschule, für Freunde? Wir brauchen diese Zeit, denn ohne Pausen lernt niemand gut. Wer sich am Abend nicht erholt, sitzt am nächsten Morgen müde in der ersten Stunde.\nMein zweites Argument betrifft die Fairness. Manche von uns haben zu Hause jemanden, der Französisch kann oder Physik versteht. Andere haben das nicht, zum Beispiel weil die Eltern abends arbeiten. Ist es gerecht, wenn eine Note davon abhängt, wer zu Hause helfen kann? Unsere Schule will, dass alle die gleichen Chancen haben. Dann darf der Erfolg nicht vom Küchentisch abhängen.\nMein stärkstes Argument aber ist: Üben wirkt nur, wenn jemand die Fehler sieht. Wie oft habt ihr eine Aufgabe falsch gerechnet und es erst bei der Schularbeit bemerkt? In einer Lernstunde könnten Lehrerinnen und Lehrer sofort helfen. Wir würden genauso viel üben, aber richtig. Und niemand müsste allein vor einer Aufgabe sitzen. Stellt euch vor, ihr geht nach Hause und wisst: Die Arbeit ist erledigt, und zwar richtig. Genau so ist es für eure Eltern, wenn sie von der Arbeit kommen. Warum sollte es für uns anders sein?\nIch weiß, was manche jetzt denken: Dann wird der Schultag noch länger. Das stimmt, aber nur um eine Stunde, und danach haben wir wirklich frei. Andere werden sagen: Wir müssen doch lernen, allein zu arbeiten. Auch das stimmt. Aber selbstständig arbeiten kann man auch in einer Lernstunde, wenn die Lehrkraft erst hilft, wenn man sie fragt. Und für Vokabeln und Lesen bleibt zu Hause immer noch Zeit, nur eben ohne den Druck, jeden Abend fünf Fächer abzuarbeiten.",
      },
      {
        teil: "appell",
        text: "Hausübung in jedem Fach muss nicht sein. Wir können zeigen, dass wir in der Schule genauso gut üben, vielleicht sogar besser. Deshalb bitte ich euch: Unterstützt unseren Antrag im Schulgemeinschaftsausschuss, die Lernstunde ein Semester lang auszuprobieren. Redet mit euren Klassensprecherinnen und Klassensprechern und erzählt euren Eltern davon. Liebe Lehrerinnen und Lehrer, gebt uns diese Chance! Lasst uns gemeinsam herausfinden, ob wir so besser lernen, und nach dem Semester ehrlich Bilanz ziehen. Wenn es nicht funktioniert, kehren wir zurück. Aber wenn es funktioniert, haben wir alle gewonnen: bessere Noten, mehr Freizeit und weniger Streit am Küchentisch.\nDanke fürs Zuhören!",
      },
    ],
  },
  textanalyse: {
    beilage: SCHLAF,
    situation: "",
    teile: [
      {
        teil: "einleitung",
        text: "Der Kommentar „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl ist am 12. März 2026 in der Regionalzeitung „Der Talblick“ erschienen. Er beschäftigt sich mit der Frage, ob der Unterricht an Schulen später beginnen soll, und richtet sich an Eltern, Lehrkräfte und alle, die über Schule und Schulwege mitentscheiden. Der Text ist klar meinungsbetont.",
      },
      {
        teil: "inhalt",
        text: "Die Autorin fordert, den Schulbeginn um eine Stunde zu verschieben. Sie begründet das mit dem Schlafrhythmus von Jugendlichen, der sich in der Pubertät verschiebt. Wer fünfzehn ist, werde abends später müde und brauche morgens länger. Schon die Einstiegsszene soll zeigen, dass müde Jugendliche nicht faul sind. Die Folgen des Schlafmangels seien schlechtere Leistungen und mehr Krankheiten. Einwände wie die Arbeitszeiten der Eltern oder die Busfahrpläne hält sie für lösbar und verweist auf gute Erfahrungen anderer Schulen. Am Ende fordert sie Schulen, Gemeinden und Verkehrsbetriebe auf, gemeinsam eine Lösung zu finden.",
      },
      {
        teil: "aufbau",
        text: "Der Text ist klar gegliedert. Er beginnt mit einer kurzen Szene aus dem Unterricht (Z. 1–4), die das Problem anschaulich macht. Danach folgen die zentrale Begründung mit Ergebnissen der Schlafforschung (Z. 5–11) und eine Schilderung der Folgen (Z. 12–16). Im vierten Abschnitt (Z. 17–24) greift die Autorin mögliche Einwände auf und entkräftet sie mit den Erfahrungen anderer Schulen. Es folgt die eigentliche Forderung (Z. 25–28). Der Schluss (Z. 29–32) spitzt das Thema auf eine Frage zu und endet mit einem Appell. Der Kommentar folgt damit dem typischen Aufbau eines Meinungstextes: Anlass, These, Begründung, Einwand, Forderung. Die Argumentation verbindet ein Beispiel, Fachwissen und Erfahrungsberichte, wobei jeder Abschnitt einen neuen Gedanken bringt. Zahlen oder genaue Quellen nennt die Autorin allerdings nicht, sie beruft sich nur allgemein auf „Schlafforscherinnen und Schlafforscher“ (Z. 5).",
      },
      {
        teil: "sprache",
        text: "Sprachlich fällt zunächst der Einstieg auf. Die Ellipsen „Faul? Nein. Müde.“ (Z. 3) wirken wie ein Gespräch mit den Lesenden und lenken den Blick weg vom Schüler hin zur Uhrzeit. Die Antithese „Das ist keine Ausrede, das ist Biologie.“ (Z. 9) stellt ein Vorurteil einer wissenschaftlichen Tatsache gegenüber und wirkt dadurch überzeugend. Mit der Übertreibung „als hätte sich seit hundert Jahren nichts geändert“ (Z. 11) kritisiert die Autorin den starren Schulalltag. Die Metapher „rauschen an vielen Köpfen einfach vorbei“ (Z. 13) zeigt anschaulich, wie wenig in der ersten Stunde ankommt. Das Verb „rauben“ (Z. 16) klingt nach einem Verbrechen und verschärft den Vorwurf. Durch das Pronomen „wir“ (Z. 15) bezieht Baumgartl die Lesenden mit ein und macht das Problem zu einer gemeinsamen Aufgabe. Auch der Satzbau unterstützt die Wirkung: Der kurze Satz „Das alles stimmt.“ (Z. 19) wirkt ruhig und zugewandt, bevor die Autorin mit „Aber“ (Z. 19) zum Gegenargument ansetzt. Die rhetorische Frage am Ende unterscheidet zwischen Jugendlichen, „die anwesend sind“ (Z. 30), und solchen, „die wirklich da sind“ (Z. 30f.).",
      },
      {
        teil: "absicht",
        text: "Die Autorin will ihre Leserinnen und Leser überzeugen, dass ein späterer Schulbeginn sinnvoll und machbar ist. Sie sollen nicht nur informiert, sondern zum Handeln bewegt werden. Dazu verbindet Baumgartl sachliche Begründungen mit einer lebendigen Szene und einem Appell: „Geben wir ihnen die Stunde, die sie brauchen.“ (Z. 31f.) Der Text wirkt engagiert, an manchen Stellen aber auch etwas einseitig.",
      },
      {
        teil: "schluss",
        text: "Zusammenfassend ist der Kommentar ein gut gebauter Meinungstext: Er beginnt anschaulich, argumentiert nachvollziehbar und endet mit einer klaren Forderung. Seine Stärke liegt in der bildhaften, zugespitzten Sprache und in der Verbindung von Anfang und Ende: Der müde Schüler der ersten Szene steht am Schluss für alle, denen eine Stunde Schlaf fehlt. Mehr überprüfbare Belege hätten die Argumentation jedoch noch glaubwürdiger gemacht.",
      },
    ],
  },
  offenerbrief: {
    beilage: JUGENDTREFF,
    situation: "die Bürgermeisterin der Gemeinde",
    teile: [
      {
        teil: "einleitung",
        text: "Neustein, 10. Februar 2026\nOffener Brief: Lassen Sie den Jugendtreff länger offen!\nSehr geehrte Frau Bürgermeisterin,\nwir schreiben Ihnen als Schülervertretung der Schulen in Neustein. Wie wir am 3. Februar in der „Stadtzeitung Neustein“ gelesen haben, hat der Gemeinderat beschlossen, den Jugendtreff in der alten Remise ab März schon um 20 Uhr zu schließen. Viele von uns besuchen den Treff regelmäßig, deshalb wenden wir uns mit diesem offenen Brief an Sie.",
      },
      {
        teil: "kritik",
        text: "Wir verstehen, dass sich die Nachbarinnen und Nachbarn über Lärm und Müll ärgern, und nehmen ihre Beschwerden ernst. Die kürzeren Öffnungszeiten sind aber die falsche Antwort, denn sie treffen vor allem jene, die den Treff am meisten brauchen. Viele Lehrlinge kommen zum Beispiel erst gegen 18 Uhr nach Hause. Für zwei Stunden lohnt sich für sie der Weg nicht mehr. Für manche ist der Treff der einzige Ort, an dem sie am Abend sein können, ohne etwas kaufen zu müssen.\nAußerdem befürchten wir, dass sich das Problem nur verlagert. Wenn der Treff früher schließt, treffen sich die Jugendlichen eben auf dem Bahnhofsplatz oder im Park, ohne Betreuung durch die Jugendarbeiterinnen. Die Menschen, die dort wohnen, hätten dann dieselben Sorgen, nur ohne Ansprechperson. Damit wäre niemandem geholfen, weder den Jugendlichen noch der Nachbarschaft.\nBesonders enttäuscht hat uns, dass niemand mit uns gesprochen hat. Sie entscheiden über einen Ort, der für uns gemacht ist, aber unsere Meinung war nicht gefragt. Junge Menschen sollen lernen, sich in der Gemeinde zu beteiligen. Dann müssen sie aber auch gefragt werden, wenn es um sie geht. Über 230 Menschen haben inzwischen für längere Öffnungszeiten unterschrieben. Das zeigt, wie vielen Menschen in Neustein dieser Ort wichtig ist.",
      },
      {
        teil: "forderung",
        text: "Wir fordern Sie daher auf, den Beschluss bis zur Bürgerversammlung im April auszusetzen. Laden Sie zu dieser Versammlung ausdrücklich auch Jugendliche ein, damit wir gemeinsam mit der Nachbarschaft nach Lösungen suchen. Wir haben dafür schon Vorschläge: Jugendliche könnten abwechselnd am Abend vor dem Gebäude auf Ruhe achten, und eine Gruppe könnte einmal pro Woche den Parkplatz aufräumen. Ab 20 Uhr könnte die Musik nur noch drinnen laufen, bei geschlossenen Fenstern. Auch die Lärmschutzwand sollte noch einmal geprüft werden, vielleicht im nächsten Budget. Bitte setzen Sie sich außerdem dafür ein, dass Jugendliche künftig vor jedem Beschluss gehört werden, der sie betrifft, zum Beispiel über einen Jugendbeirat der Gemeinde. So ließen sich Konflikte lösen, bevor sie entstehen.",
      },
      {
        teil: "schluss",
        text: "Wir sind überzeugt, dass ein gutes Miteinander möglich ist, wenn alle an einem Tisch sitzen, und sind bereit, selbst Verantwortung zu übernehmen. Wir freuen uns auf Ihre Antwort und auf ein Gespräch mit Ihnen.\nMit freundlichen Grüßen\nLea Brandner und Jonas Wieser für die Schülervertretung Neustein",
      },
    ],
  },
  empfehlung: {
    beilage: REPARATURCAFE,
    situation: "die Leserinnen und Leser der Schulzeitung",
    teile: [
      {
        teil: "einleitung",
        text: "Reparieren statt wegwerfen: ein Samstag im Reparaturcafé\nEuer Fahrrad hat einen Platten, die Kopfhörer knacksen nur noch? Bevor ihr etwas Neues kauft, lohnt sich ein Blick ins Reparaturcafé im alten Feuerwehrhaus. Die „Stadtzeitung Neustein“ hat am 20. April in der Reportage „Kaputt heißt nicht verloren“ darüber berichtet.",
      },
      {
        teil: "information",
        text: "Das Reparaturcafé gibt es seit einem Jahr. Jeden ersten Samstag im Monat helfen zwölf Freiwillige, darunter eine Elektrikerin und zwei HTL-Schüler, beim Reparieren von Toastern, Handys oder Fahrrädern. Man bringt den kaputten Gegenstand einfach mit und repariert ihn gemeinsam mit einer Helferin oder einem Helfer. Die Hilfe ist kostenlos, nur Ersatzteile muss man selbst bezahlen. Im ersten Jahr wurden rund 300 Dinge repariert, zwei Drittel davon mit Erfolg.",
      },
      {
        teil: "bewertung",
        text: "Für uns Jugendliche spricht viel für einen Besuch. Am häufigsten werden Fahrräder und Kopfhörer gebracht, also genau die Dinge, die bei uns oft kaputtgehen. Wer zum Beispiel einmal selbst einen Schlauch geflickt hat, schafft es beim nächsten Mal allein. Das spart Geld und schont die Umwelt, weil weniger im Müll landet. Außerdem gibt es Kaffee und Kuchen gegen eine Spende, und man kommt mit Menschen ins Gespräch, die man sonst nie treffen würde.\nEin paar Nachteile solltet ihr aber kennen. Manchmal wartet man über eine Stunde, Ersatzteile muss man selbst zahlen, und eine Garantie gibt es nicht. Manche Handys lassen sich gar nicht öffnen, ohne sie zu beschädigen. Wer es eilig hat, ist in einem Fachgeschäft besser aufgehoben.",
      },
      {
        teil: "empfehlung",
        text: "Trotzdem empfehle ich euch das Reparaturcafé, besonders wenn ihr gern selbst etwas ausprobiert. Nehmt etwas Geduld mit und schaut am Samstag, dem 2. Mai, zwischen 10 und 14 Uhr vorbei. Anmelden müsst ihr euch nicht, und wer Lust hat, kann sogar selbst mithelfen. Im schlimmsten Fall geht ihr mit einem Stück Kuchen und einer guten Idee nach Hause.",
      },
    ],
  },
};
