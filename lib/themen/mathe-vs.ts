import type { Bereich, Modul } from "./bauen";

/**
 * Maths topics of the Volksschule (1. to 4. Schulstufe): skills with a short explanation and the
 * typical errors students make, plus explanations and errors for the Volksschule skills of the
 * package curriculum/volksschule-eigene-struktur.json.
 *
 * Own structure and own wording. The topics follow the Lehrplan (curriculum/ris-vs-mathematik.json)
 * and were checked against the tables of contents of common Austrian Volksschule maths books, topic
 * names only: no task or text is taken from a book. The links to the Lehrplan are in
 * scripts/lehrplan_mapping.json.
 */
const VS = ["Volksschule"];

const BEREICHE: Bereich[] = [
  {
    area: "Zahlen und Zahlenraum",
    themen: [
      {
        id: "mathe.vs.zahlen.zerlegen",
        name: "Zahlen bis 10 zerlegen",
        stufen: [1, 2],
        schularten: VS,
        erklaerung: "Eine Zahl lässt sich auf verschiedene Arten in zwei Teile zerlegen. Systematisch: Der erste Teil wird immer um 1 größer, der zweite um 1 kleiner. Besonders wichtig sind die Zerlegungen der 10 für den Zehnerübergang. Beispiel: 6 = 0 + 6 = 1 + 5 = 2 + 4 = 3 + 3 = 4 + 2 = 5 + 1 = 6 + 0.",
        fehler: [
          "Ohne Reihenfolge gesucht und eine Zerlegung ausgelassen (bei 6 fehlt 2 + 4)",
          "Zehnerfreunde falsch gemerkt (7 und 4 ergeben 10)",
          "Die Zerlegungen mit 0 vergessen (6 = 0 + 6 und 6 = 6 + 0 fehlen)",
        ],
      },
      {
        id: "mathe.vs.zahlen.gerade",
        name: "Gerade und ungerade Zahlen",
        stufen: [1, 3],
        schularten: VS,
        erklaerung: "Eine Zahl ist gerade, wenn man sie in zwei gleich große Teile teilen kann, ohne dass etwas übrig bleibt. Man erkennt es an der Einerziffer: 0, 2, 4, 6 oder 8 heißt gerade, 1, 3, 5, 7 oder 9 heißt ungerade. Beispiel: 14 ist gerade (7 + 7), 37 ist ungerade.",
        fehler: [
          "Auf die Zehnerziffer statt auf die Einerziffer geschaut (34 ist ungerade, weil 3 ungerade ist)",
          "Die 0 an der Einerstelle nicht als gerade erkannt (30 für ungerade gehalten)",
          "Gedacht, ungerade plus ungerade ergibt wieder eine ungerade Zahl (3 + 5)",
        ],
      },
      {
        id: "mathe.vs.zahlen.zahlenstrahl",
        name: "Zahlenstrahl und Nachbarzahlen",
        stufen: [1, 4],
        schularten: VS,
        erklaerung: "Am Zahlenstrahl stehen die Zahlen der Größe nach, nach rechts werden sie größer. Zuerst prüfen, wie viel ein Teilstrich wert ist. Der Vorgänger ist um 1 kleiner, der Nachfolger um 1 größer, die Nachbarzehner sind die Zehnerzahlen davor und danach. Beispiel: 58 liegt zwischen 57 und 59, die Nachbarzehner sind 50 und 60.",
        fehler: [
          "Jeden Teilstrich als 1 gezählt, obwohl er 10 bedeutet (der Strich nach 300 als 301 statt 310 gelesen)",
          "Vorgänger und Nachfolger verwechselt (Vorgänger von 40 als 41)",
          "Den Vorgänger einer Zehnerzahl falsch gebildet (Vorgänger von 60 als 69)",
        ],
      },
      {
        id: "mathe.vs.zahlen.folgen",
        name: "Zahlenfolgen und Rechenmuster fortsetzen",
        stufen: [1, 4],
        schularten: VS,
        erklaerung: "Man sucht die Regel, mit der man von einer Zahl zur nächsten kommt, zum Beispiel immer plus 4 oder immer das Doppelte. Die Regel prüft man an allen Zahlen, bevor man weiterschreibt. Auch Aufgabenreihen haben Muster: 5 + 4, 6 + 4, 7 + 4, das Ergebnis wird jedes Mal um 1 größer. Beispiel: 3, 7, 11, 15 heißt immer plus 4, weiter mit 19 und 23.",
        fehler: [
          "Die Regel nur aus den ersten zwei Zahlen abgelesen (2, 4, 8, 16 mit 18 fortgesetzt statt mit 32)",
          "Bei kleiner werdenden Zahlen die Richtung übersehen (50, 45, 40 mit 45 statt 35 fortgesetzt)",
          "Bei zwei abwechselnden Regeln nur eine verwendet (1, 3, 2, 4, 3, 5 mit 7 statt 4 fortgesetzt)",
        ],
      },
    ],
  },
  {
    area: "Addition und Subtraktion",
    themen: [
      {
        id: "mathe.vs.addsub.verdoppeln",
        name: "Verdoppeln und Halbieren",
        stufen: [1, 3],
        schularten: VS,
        erklaerung: "Verdoppeln heißt, eine Zahl zweimal nehmen: 7 + 7 = 14. Halbieren heißt, in zwei gleich große Teile teilen, es ist die Umkehrung. Bei größeren Zahlen verdoppelt oder halbiert man Zehner und Einer getrennt. Beispiel: Das Doppelte von 36 ist 60 + 12 = 72, die Hälfte von 58 ist 25 + 4 = 29.",
        fehler: [
          "Verdoppeln und Halbieren verwechselt (die Hälfte von 8 ist 16)",
          "Nur die Einer oder nur die Zehner verdoppelt (das Doppelte von 34 als 38 oder 64)",
          "Zehnerzahlen mit ungerader Zehnerziffer falsch halbiert (die Hälfte von 50 als 20 statt 25)",
        ],
      },
      {
        id: "mathe.vs.addsub.ungleichungen",
        name: "Ungleichungen: passende Zahlen finden",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Bei einer Ungleichung passen oft mehrere Zahlen. Zuerst die Zahl suchen, bei der beide Seiten gleich wären, dann überlegen, ob kleinere oder größere Zahlen passen. Beispiel: 6 + □ < 10. Bei 4 wären beide Seiten gleich, also passen 0, 1, 2 und 3.",
        fehler: [
          "Nur eine Lösung angegeben, obwohl mehrere passen (6 + □ < 10 nur mit 3)",
          "Die Grenzzahl mitgenommen (bei 6 + □ < 10 auch die 4)",
          "Das Zeichen verkehrt gelesen und zu große Zahlen eingesetzt (6 + □ < 10 mit 5, 6 und 7)",
        ],
      },
      {
        id: "mathe.vs.addsub.vorteile",
        name: "Rechenvorteile beim Addieren und Subtrahieren",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Vor dem Rechnen schauen, ob es einen leichteren Weg gibt: Zahlen so tauschen, dass Zehnerfreunde zusammenkommen, oder mit einer Nachbarzahl rechnen und danach ausgleichen. Beispiel: 17 + 8 + 3 = 17 + 3 + 8 = 28; 46 + 29 = 46 + 30 − 1 = 75; 83 − 19 = 83 − 20 + 1 = 64.",
        fehler: [
          "Beim Minus in die falsche Richtung ausgeglichen (83 − 19 = 83 − 20 − 1 = 62)",
          "Beim Plus ausgeglichen wie beim Minus (46 + 29 = 46 + 30 + 1 = 77)",
          "Beim Zusammenfassen das Rechenzeichen übersehen (50 − 17 + 7 als 50 − 24 = 26 statt 40)",
        ],
      },
      {
        id: "mathe.vs.addsub.zr1000",
        name: "Plus und Minus bis 1000 (halbschriftlich)",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Leichte Aufgaben löst man mit der Analogie zum kleinen Zahlenraum: 3 + 4 = 7, also 300 + 400 = 700. Schwerere Aufgaben zerlegt man in Schritte, zuerst Hunderter, dann Zehner, dann Einer, und schreibt die Zwischenergebnisse auf. Beispiel: 712 − 385: 712 − 300 = 412, 412 − 80 = 332, 332 − 5 = 327.",
        fehler: [
          "Einer zu den Zehnern gezählt (456 + 3 = 486)",
          "Beim Minus über den Hunderter die kleinere von der größeren Ziffer abgezogen (412 − 80 = 472)",
          "Zwischenergebnis nicht notiert und einen Schritt vergessen (712 − 385 = 332)",
        ],
      },
    ],
  },
  {
    area: "Multiplikation und Division",
    themen: [
      {
        id: "mathe.vs.muldiv.halbschriftlich",
        name: "Halbschriftlich multiplizieren und dividieren",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Größere Malaufgaben zerlegt man in Zehner und Einer und addiert die Teilergebnisse. Bei Geteiltaufgaben zerlegt man die Zahl so, dass jeder Teil gut durch den Divisor teilbar ist. Beispiel: 6 · 34 = 6 · 30 + 6 · 4 = 180 + 24 = 204; 96 : 4 = 80 : 4 + 16 : 4 = 20 + 4 = 24.",
        fehler: [
          "Nur einen Teil multipliziert (6 · 34 = 6 · 30 + 4 = 184)",
          "So zerlegt, dass ein Teil nicht teilbar ist (96 : 4 als 90 : 4 + 6 : 4)",
          "Den Divisor statt der Zahl zerlegt (60 : 5 als 60 : 3 + 60 : 2 = 50 statt 12)",
        ],
      },
    ],
  },
  {
    area: "Schriftliche Rechenverfahren",
    themen: [
      {
        id: "mathe.vs.schriftlich.ueberschlag",
        name: "Überschlagen: Ergebnisse abschätzen",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Vor oder nach dem genauen Rechnen rundet man die Zahlen so, dass man im Kopf rechnen kann. Liegt das genaue Ergebnis weit weg vom Überschlag, sucht man den Fehler. Beispiel: 487 + 312 ist ungefähr 500 + 300 = 800; 38 · 6 ist ungefähr 40 · 6 = 240, genau sind es 228.",
        fehler: [
          "Den Überschlag als Ergebnis angegeben (487 + 312 = 800 statt 799)",
          "Auch den einstelligen Faktor gerundet (38 · 6 als 40 · 10 = 400)",
          "Einen großen Unterschied zum Überschlag nicht bemerkt (Überschlag 240, gerechnet 2 280)",
        ],
      },
      {
        id: "mathe.vs.schriftlich.zweistellig",
        name: "Schriftlich durch zweistellige Zahlen dividieren",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Von links so viele Stellen nehmen, dass der Divisor hineinpasst. Zum Schätzen rundet man den Divisor und prüft die Ziffer durch Malnehmen. Beispiel: 1 012 : 23. 101 : 23 geschätzt wie 100 : 20 = 5, aber 5 · 23 = 115 ist zu groß, also 4, Rest 9. Dann 92 : 23 = 4. Ergebnis 44, Probe 44 · 23 = 1 012.",
        fehler: [
          "Die geschätzte Ziffer nicht geprüft (101 : 23 = 5, obwohl 5 · 23 = 115 ist)",
          "Die Null im Ergebnis vergessen, wenn der Divisor nicht hineinpasst (2 415 : 23 = 15 statt 105)",
          "Beim Malnehmen mit dem Divisor den Übertrag vergessen (4 · 23 = 82)",
        ],
      },
    ],
  },
  {
    area: "Größen",
    themen: [
      {
        id: "mathe.vs.groessen.schaetzen",
        name: "Größen schätzen mit Stützpunkten",
        stufen: [1, 4],
        schularten: VS,
        erklaerung: "Zum Schätzen vergleicht man mit bekannten Größen: Ein Kinderfinger ist etwa 1 cm breit, eine Tür etwa 2 m hoch, eine große Milchpackung fasst 1 l, eine Tafel Schokolade wiegt 10 dag. Beispiel: Ein Klassenzimmer ist ungefähr eineinhalb Türen hoch, also etwa 3 m.",
        fehler: [
          "Eine unpassende Einheit gewählt (ein Bleistift ist 17 m lang)",
          "Ohne Vergleich geraten und weit danebengelegen (eine Schultasche wiegt 100 kg)",
          "Größe und Gewicht verwechselt (ein großer Luftballon ist schwerer als ein Apfel)",
        ],
      },
      {
        id: "mathe.vs.groessen.flaechenmasse",
        name: "Flächenmaße (mm², cm², dm², m², a, ha, km²)",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "1 cm² ist die Fläche eines Quadrats mit 1 cm Seitenlänge, 1 a die eines Quadrats mit 10 m Seitenlänge. Zwischen benachbarten Flächenmaßen ist die Umwandlungszahl 100: mm², cm², dm², m², a, ha, km². Beispiel: 1 m² = 100 dm² = 10 000 cm²; 3 ha = 300 a.",
        fehler: [
          "Mit 10 statt mit 100 umgewandelt (1 m² = 10 dm²)",
          "Wie bei Längen umgewandelt (1 m² = 100 cm², weil 1 m = 100 cm ist)",
          "Zwischen m² und ha das Ar ausgelassen (1 ha = 100 m²)",
        ],
      },
    ],
  },
  {
    area: "Geometrie",
    themen: [
      {
        id: "mathe.vs.geometrie.lage",
        name: "Lagebeziehungen: links, rechts, oben, unten",
        stufen: [1, 2],
        schularten: VS,
        erklaerung: "Lagewörter sagen, wo etwas ist: links, rechts, oben, unten, vor, hinter, neben, zwischen. Links und rechts hängen davon ab, von wo aus man schaut. Wege beschreibt man mit Richtung und Anzahl der Schritte. Beispiel: Vom Start 3 Kästchen nach rechts und 2 nach oben; der Ball liegt zwischen Tisch und Kasten.",
        fehler: [
          "Links und rechts verwechselt (Pfeil nach links als rechts gelesen)",
          "Bei einer gegenüberstehenden Person links und rechts aus der eigenen Sicht bestimmt",
          "Beim Gehen nach Pfeilen das Startkästchen mitgezählt (3 nach rechts endet ein Kästchen zu früh)",
        ],
      },
      {
        id: "mathe.vs.geometrie.muster",
        name: "Geometrische Muster und Parkette fortsetzen",
        stufen: [1, 4],
        schularten: VS,
        erklaerung: "Bei einem Muster wiederholt sich ein Teil immer wieder. Zuerst den kleinsten Teil suchen, der sich wiederholt, dann Form, Farbe, Lage und Anzahl genau gleich fortsetzen. Ein Parkett bedeckt eine Fläche ohne Lücken und ohne Überlappung. Beispiel: Kreis, Dreieck, Dreieck, Kreis, Dreieck, Dreieck: Als Nächstes kommt ein Kreis.",
        fehler: [
          "Nur die Form beachtet und Farbe oder Drehung übersehen (ein gedrehtes Dreieck gleich herum fortgesetzt)",
          "Den sich wiederholenden Teil zu kurz gewählt (Kreis, Dreieck, Dreieck als Kreis, Dreieck fortgesetzt)",
          "Beim Parkett Lücken gelassen oder Formen gewählt, die nicht lückenlos passen (Kreise)",
        ],
      },
      {
        id: "mathe.vs.geometrie.symmetrie",
        name: "Symmetrie: Spiegelachsen und Spiegelbilder",
        stufen: [1, 4],
        schularten: VS,
        erklaerung: "Eine Figur ist symmetrisch, wenn beide Hälften beim Falten entlang der Spiegelachse genau aufeinanderpassen. Beim Ergänzen auf Karopapier zählt man die Kästchen bis zur Achse und auf der anderen Seite gleich viele weiter. Beispiel: Ein längliches Rechteck hat 2 Spiegelachsen, ein Quadrat 4, ein Kreis unendlich viele.",
        fehler: [
          "Die Diagonale eines Rechtecks für eine Spiegelachse gehalten",
          "Die Hälfte verschoben statt gespiegelt (gleich herum noch einmal gezeichnet)",
          "Abstände zur Achse nicht gezählt (links 3 Kästchen, rechts nur 2)",
        ],
      },
      {
        id: "mathe.vs.geometrie.wuerfelgebaeude",
        name: "Würfelgebäude und Baupläne",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Ein Würfelgebäude beschreibt man mit einem Bauplan: Man zeichnet die Grundfläche von oben und schreibt in jedes Feld, wie viele Würfel dort übereinander stehen. Die Summe aller Zahlen ist die Anzahl der Würfel. Beispiel: Ein Bauplan mit den Zahlen 3, 1 und 2 gehört zu einem Gebäude aus 6 Würfeln.",
        fehler: [
          "Verdeckte Würfel nicht mitgezählt (nur die sichtbaren gezählt)",
          "Im Bauplan die Ansicht von vorne statt von oben gezeichnet",
          "Würfel doppelt gezählt, die man von zwei Seiten sieht",
        ],
      },
      {
        id: "mathe.vs.geometrie.strecken",
        name: "Strecken: parallel und normal",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Zwei Strecken sind parallel, wenn sie überall gleich weit voneinander entfernt sind und sich auch verlängert nie treffen. Sie stehen normal aufeinander, wenn sie einen rechten Winkel bilden. Beides prüft man mit dem Geodreieck. Beispiel: Im Rechteck sind gegenüberliegende Seiten parallel, benachbarte Seiten stehen normal aufeinander.",
        fehler: [
          "Nur waagrechte und senkrechte Strecken als parallel oder normal erkannt (schräge Parallelen übersehen)",
          "Strecken, die sich auf dem Blatt nicht berühren, für parallel gehalten, obwohl sie verlängert zusammenlaufen",
          "Einen fast rechten Winkel nach Augenmaß als rechten Winkel angenommen",
        ],
      },
      {
        id: "mathe.vs.geometrie.plaene",
        name: "Pläne lesen und zeichnen",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Ein Plan zeigt etwas von oben und verkleinert. Die Angabe „1 cm im Plan sind 1 m in Wirklichkeit“ (Maßstab 1 : 100) sagt, wie stark verkleinert ist. Die Legende erklärt die Zeichen. Beispiel: Ist das Zimmer im Plan 4 cm lang und 3 cm breit, ist es in Wirklichkeit 4 m lang und 3 m breit.",
        fehler: [
          "Gegenstände von der Seite statt von oben gezeichnet (Tisch mit Beinen)",
          "Mit der Länge im Plan statt mit der wirklichen Länge gerechnet (das Zimmer ist 4 cm lang)",
          "Nur eine Seite umgerechnet (Länge in Wirklichkeit, Breite noch im Plan)",
        ],
      },
      {
        id: "mathe.vs.geometrie.netze",
        name: "Körpernetze von Würfel und Quader",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Ein Netz ist die aufgeklappte Oberfläche eines Körpers. Ein Würfelnetz besteht aus 6 gleich großen Quadraten, ein Quadernetz aus 3 Paaren gleich großer Rechtecke. Ob ein Netz passt, prüft man durch Falten im Kopf: Zwei Flächen dürfen nicht aufeinanderliegen. Beispiel: Ein Kreuz aus 6 Quadraten ist ein Würfelnetz, 6 Quadrate in einer Reihe sind keines.",
        fehler: [
          "Jede Anordnung aus 6 Quadraten für ein Würfelnetz gehalten (6 Quadrate in einer Reihe)",
          "Beim Quadernetz gegenüberliegende Flächen verschieden groß gezeichnet",
          "Gegenüberliegende Flächen falsch bestimmt (beim Spielwürfel 1 und 6 nebeneinander statt gegenüber)",
        ],
      },
      {
        id: "mathe.vs.geometrie.zusammengesetzt",
        name: "Zusammengesetzte Figuren: Umfang und Flächeninhalt",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Für den Flächeninhalt zerlegt man die Figur in Rechtecke und Quadrate und addiert ihre Flächen. Für den Umfang zählt man nur die Außenseiten, fehlende Seitenlängen ergeben sich aus den gegebenen. Beispiel: Rechteck 6 cm mal 2 cm, darauf am linken Ende ein Quadrat mit 2 cm: A = 12 cm² + 4 cm² = 16 cm², u = 20 cm.",
        fehler: [
          "Die Umfänge der Teilfiguren addiert (16 cm + 8 cm = 24 cm statt 20 cm)",
          "Eine fehlende Seitenlänge falsch erschlossen (die ganze statt der restlichen Länge genommen)",
          "Teilflächen doppelt gezählt, weil die Zerlegung sich überlappt",
        ],
      },
      {
        id: "mathe.vs.geometrie.raster",
        name: "Figuren im Raster vergrößern und verkleinern",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Beim Vergrößern und Verkleinern werden alle Strecken gleich stark verändert: Beim Verdoppeln zählt man für jedes Kästchen der Vorlage 2 Kästchen, beim Halbieren für 2 Kästchen nur 1. Man überträgt zuerst die Eckpunkte und verbindet sie dann. Die Form bleibt gleich. Beispiel: Ein Rechteck mit 3 und 2 Kästchen wird verdoppelt zu 6 und 4 Kästchen.",
        fehler: [
          "Zu jeder Seite gleich viele Kästchen dazugezählt statt verdoppelt (3 und 2 Kästchen werden 5 und 4)",
          "Nur die Breite, nicht die Höhe vergrößert (3 und 2 Kästchen werden 6 und 2)",
          "Schräge Linien nach Augenmaß gezeichnet statt die Eckpunkte im Raster zu übertragen",
        ],
      },
    ],
  },
  {
    area: "Sachaufgaben",
    themen: [
      {
        id: "mathe.vs.sach.proportional",
        name: "Direkt proportionale Zusammenhänge in Tabellen",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Doppelte Menge, doppelter Preis: Solche Zusammenhänge schreibt man in eine Tabelle. Zuerst rechnet man den Wert für 1 Stück aus, dann den Wert für die gesuchte Anzahl. Beispiel: 3 Hefte kosten 12 €, 1 Heft kostet 12 € : 3 = 4 €, 5 Hefte kosten 5 · 4 € = 20 €.",
        fehler: [
          "Den Unterschied der Anzahlen dazugezählt (3 Hefte kosten 12 €, also 5 Hefte 14 €)",
          "Beim Schluss auf 1 Stück malgenommen statt geteilt (1 Heft kostet 36 €)",
          "Auch dort so gerechnet, wo nichts proportional ist (mit 8 Jahren 130 cm groß, also mit 16 Jahren 260 cm)",
        ],
      },
    ],
  },
  {
    area: "Daten und Zufall",
    themen: [
      {
        id: "mathe.vs.daten.strichliste",
        name: "Strichlisten und Tabellen",
        stufen: [1, 3],
        schularten: VS,
        erklaerung: "In einer Strichliste macht man für jedes gezählte Ding einen Strich, der fünfte Strich geht quer durch die vier anderen. So zählt man in Fünferbündeln schnell zusammen. In einer Tabelle schreibt man die Anzahlen als Zahlen. Beispiel: Drei Fünferbündel und zwei Striche sind 17.",
        fehler: [
          "Ein Fünferbündel nur als 4 gezählt (den Querstrich vergessen)",
          "Beim Erheben jemanden doppelt oder gar nicht gezählt (ein Kind zweimal befragt)",
          "Zeilen der Tabelle verwechselt (die Anzahl der Hunde in der Zeile der Katzen abgelesen)",
        ],
      },
      {
        id: "mathe.vs.daten.diagramme",
        name: "Säulendiagramme, Balkendiagramme und Piktogramme",
        stufen: [2, 4],
        schularten: VS,
        erklaerung: "Im Säulendiagramm zeigt die Höhe der Säule die Anzahl, im Balkendiagramm die Länge des Balkens. Zuerst die Beschriftung und die Einteilung der Achse lesen. Im Piktogramm steht ein Bild oft für mehrere Dinge. Beispiel: Steht ein Apfel für 2 Kinder, bedeuten 4 Äpfel 8 Kinder.",
        fehler: [
          "Die Einteilung der Achse nicht beachtet (jeden Strich als 1 gezählt, obwohl er 2 bedeutet)",
          "Im Piktogramm die Bilder gezählt statt mit ihrem Wert gerechnet (4 Äpfel als 4 statt 8 Kinder)",
          "Säulen verschieden breit oder ohne gemeinsame Grundlinie gezeichnet",
        ],
      },
      {
        id: "mathe.vs.daten.kombinatorik",
        name: "Kombinieren: alle Möglichkeiten finden",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Man geht systematisch vor: eine Möglichkeit festhalten, alle passenden dazu notieren, dann die nächste. Eine Tabelle oder ein Baumdiagramm hilft, nichts zu vergessen und nichts doppelt zu zählen. Beispiel: Mit den Ziffernkarten 1, 2 und 3 legt man 6 dreistellige Zahlen: 123, 132, 213, 231, 312, 321.",
        fehler: [
          "Ohne Ordnung probiert und Möglichkeiten vergessen (nur 4 der 6 Zahlen gefunden)",
          "Dieselbe Paarung doppelt gezählt (Anna gegen Tom und Tom gegen Anna als zwei Spiele)",
          "Anzahlen addiert statt multipliziert (3 T-Shirts und 2 Hosen ergeben 5 Möglichkeiten statt 6)",
        ],
      },
      {
        id: "mathe.vs.daten.wahrscheinlich",
        name: "Wahrscheinlichkeit: sicher, möglich, unmöglich",
        stufen: [3, 4],
        schularten: VS,
        erklaerung: "Ein Ereignis ist sicher, wenn es immer eintritt, unmöglich, wenn es nie eintritt, und möglich, wenn es eintreten kann, aber nicht muss. Was öfter vorkommen kann, ist wahrscheinlicher. Beispiel: In einem Sack sind 5 rote Kugeln und 1 blaue. Rot ziehen ist wahrscheinlicher als Blau, Grün ziehen ist unmöglich.",
        fehler: [
          "Möglich und sicher verwechselt (beim Würfeln kommt „sicher“ eine 6, weil sie vorkommen kann)",
          "Gedacht, eine Farbe kommt eher, weil sie lange nicht gekommen ist",
          "Nur die Farben beachtet, nicht die Anzahl der Kugeln (bei 5 roten und 1 blauen Rot und Blau gleich wahrscheinlich)",
        ],
      },
      {
        id: "mathe.vs.daten.zufallsexperimente",
        name: "Zufallsexperimente durchführen und auswerten",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Man führt ein Experiment viele Male gleich durch, zum Beispiel 20-mal würfeln, und hält jedes Ergebnis in einer Strichliste fest. Wie oft ein Ergebnis vorkommt, heißt absolute Häufigkeit. Bei wenigen Versuchen kann es anders ausgehen als erwartet. Beispiel: Ein Glücksrad hat 3 rote und 1 gelbes Feld, alle gleich groß: Rot kommt meistens öfter als Gelb.",
        fehler: [
          "Aus wenigen Versuchen eine feste Regel gemacht (in 10 Würfen keine 6, also kommt die 6 nie)",
          "Ergebnisse nicht gleich notiert, sondern nachher aus dem Gedächtnis geschätzt",
          "Beim Glücksrad nur die Anzahl der Felder beachtet, nicht ihre Größe",
        ],
      },
    ],
  },
  {
    area: "Brüche",
    themen: [
      {
        id: "mathe.vs.brueche.bruchteile",
        name: "Bruchteile erkennen und anschreiben",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Ein Ganzes wird in gleich große Teile geteilt. Der Nenner unten sagt, in wie viele Teile, der Zähler oben, wie viele Teile man nimmt. Beispiel: Ein Kuchen ist in 4 gleich große Stücke geteilt, 3 Stücke davon sind 3/4 des Kuchens, gelesen „drei Viertel“.",
        fehler: [
          "Ungleich große Teile als Bruchteile gezählt (ein Kreis in 4 verschieden große Stücke als Viertel)",
          "Zähler und Nenner vertauscht (3 von 4 Teilen als 4/3)",
          "Teile untereinander statt mit dem Ganzen verglichen (1 von 4 Teilen weiß, angeschrieben als 1/3 statt 1/4)",
        ],
      },
      {
        id: "mathe.vs.brueche.vergleichen",
        name: "Bruchteile vergleichen und zerlegen",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Je mehr gleich große Teile ein Ganzes hat, desto kleiner ist jeder Teil: 1/2 > 1/4 > 1/8. Ein Ganzes sind 2/2 = 4/4 = 8/8, eine Hälfte sind 2/4 = 4/8. Bruchteile kann man zusammensetzen und zerlegen. Beispiel: 3/4 = 1/2 + 1/4, und 3/4 > 5/8, denn 3/4 = 6/8.",
        fehler: [
          "Den Bruch mit dem größeren Nenner für größer gehalten (1/8 > 1/4)",
          "Bruchteile verschieden großer Ganzer gleichgesetzt (die Hälfte einer kleinen und einer großen Pizza)",
          "Beim Zusammensetzen Zähler und Nenner addiert (1/2 + 1/4 = 2/6)",
        ],
      },
      {
        id: "mathe.vs.brueche.vongroessen",
        name: "Bruchteile von Größen und Mengen",
        stufen: [4, 4],
        schularten: VS,
        erklaerung: "Man teilt durch den Nenner und nimmt das Ergebnis so oft, wie der Zähler sagt. Beispiel: 1/4 von 1 kg = 100 dag : 4 = 25 dag; 3/4 h = 3 · 15 min = 45 min; 3/8 von 24 Kugeln: 24 : 8 = 3, 3 · 3 = 9 Kugeln.",
        fehler: [
          "Nur durch den Nenner geteilt (3/8 von 24 = 3)",
          "Durch den Zähler statt durch den Nenner geteilt (3/4 von 12 = 4)",
          "Bei Zeit mit 100 statt mit 60 Minuten gerechnet (1/4 h = 25 min)",
        ],
      },
    ],
  },
];

/** Explanations of the Volksschule skills of the package (curriculum/volksschule-eigene-struktur.json). */
const ERKLAERUNG_BISHER: Record<string, string> = {
  "mathe.vs.zahlen.zr10":
    "Beim Zählen bekommt jeder Gegenstand genau ein Zahlwort, und die zuletzt genannte Zahl ist die Anzahl. Größere Anzahlen erkennt man schneller als „5 und noch etwas“. Beispiel: Eine volle Hand und noch 2 Finger sind 5 + 2 = 7 Finger.",
  "mathe.vs.zahlen.zr20":
    "Die Zahlen von 11 bis 19 bestehen aus einem Zehner und Einern: 14 sind 1 Zehner und 4 Einer, 20 sind 2 Zehner. Bei 13 bis 19 spricht man zuerst die Einer, schreibt aber zuerst den Zehner: „vierzehn“ wird 14 geschrieben. Beispiel: 17 liegt zwischen 16 und 18, bis 20 fehlen 3.",
  "mathe.vs.zahlen.zr100":
    "Zweistellige Zahlen bestehen aus Zehnern und Einern. Die linke Ziffer zeigt die Zehner, die rechte die Einer. Gesprochen werden zuerst die Einer. Beispiel: „dreiundsechzig“ sind 6 Zehner und 3 Einer, also 63; die Nachbarzehner sind 60 und 70.",
  "mathe.vs.zahlen.zr1000":
    "Dreistellige Zahlen haben Hunderter, Zehner und Einer. In der Stellenwerttafel bekommt jede Stelle eine Ziffer, eine leere Stelle bekommt eine 0. Beispiel: 4 H 0 Z 7 E = 407, gelesen „vierhundertsieben“, und 407 = 400 + 7.",
  "mathe.vs.zahlen.million":
    "Große Zahlen teilt man von rechts in Dreiergruppen: Einer, Zehner, Hunderter, dann Tausender, Zehntausender, Hunderttausender. Zwischen den Gruppen bleibt eine kleine Lücke. Beispiel: 305 040 heißt „dreihundertfünftausendvierzig“ und hat 3 HT, 0 ZT, 5 T, 0 H, 4 Z und 0 E.",
  "mathe.vs.zahlen.vergleichen":
    "Die Spitze des Zeichens zeigt zur kleineren Zahl, die offene Seite zur größeren. Eine Zahl mit mehr Stellen ist größer. Sonst vergleicht man von der höchsten Stelle an. Beispiel: 452 < 461, denn die Hunderter sind gleich und 5 Zehner sind weniger als 6 Zehner; 98 < 102.",
  "mathe.vs.zahlen.runden":
    "Man schaut auf die Ziffer rechts von der Rundungsstelle: bei 0, 1, 2, 3 oder 4 abrunden, bei 5, 6, 7, 8 oder 9 aufrunden. Alle Stellen rechts davon werden 0. Beispiel: 347 auf Zehner gerundet ist 350, auf Hunderter gerundet 300.",
  "mathe.vs.addsub.zr10":
    "Plus heißt dazugeben, Minus heißt wegnehmen. Bei Plus kann man von der größeren Zahl aus weiterzählen, die Tauschaufgabe hat dasselbe Ergebnis. Beispiel: 2 + 6 = 6 + 2 = 8; 9 − 3 = 6, denn von 9 Kugeln 3 wegnehmen lässt 6 übrig.",
  "mathe.vs.addsub.zehner":
    "Zuerst bis zum Zehner rechnen, dann den Rest dazu oder weg. Dafür zerlegt man die zweite Zahl passend. Beispiel: 8 + 5 = 8 + 2 + 3 = 13; 14 − 6 = 14 − 4 − 2 = 8.",
  "mathe.vs.addsub.zr100":
    "Schrittweise rechnen: zuerst die Zehner, dann die Einer dazu oder weg. Geht es über einen Zehner, hilft der Weg über den vollen Zehner. Beispiel: 47 + 28 = 47 + 20 + 8 = 67 + 8 = 75; 63 − 27 = 63 − 20 − 7 = 43 − 7 = 36.",
  "mathe.vs.addsub.umkehr":
    "Zu jeder Plusaufgabe gehören Minusaufgaben als Umkehraufgaben: Aus 5 + 3 = 8 folgen 8 − 3 = 5 und 8 − 5 = 3. Beim Ergänzen fragt man, wie viel fehlt, und rechnet von der kleineren Zahl bis zur größeren. Beispiel: Von 36 bis 50 fehlen 4 bis 40 und noch 10, also 14. Probe: 36 + 14 = 50.",
  "mathe.vs.muldiv.einmaleins":
    "Mal heißt, gleich große Gruppen zusammenzählen: 4 · 3 = 3 + 3 + 3 + 3 = 12. Tauschaufgaben haben dasselbe Ergebnis, und schwere Aufgaben leitet man aus leichten ab. Beispiel: 6 · 7 = 5 · 7 + 7 = 35 + 7 = 42.",
  "mathe.vs.muldiv.geteilt":
    "Dividieren heißt aufteilen oder gerecht verteilen. Man löst eine Geteiltaufgabe mit der passenden Malaufgabe: 24 : 6 = 4, weil 4 · 6 = 24. Beispiel: 20 Kekse gerecht auf 5 Kinder verteilt, jedes bekommt 4, denn 4 · 5 = 20.",
  "mathe.vs.muldiv.rest":
    "Man sucht die größte Zahl aus der Einmaleinsreihe des Divisors, die noch hineinpasst. Was übrig bleibt, ist der Rest, und er muss kleiner als der Divisor sein. Beispiel: 38 : 5 = 7 Rest 3, denn 7 · 5 = 35 und 35 + 3 = 38.",
  "mathe.vs.muldiv.zehner":
    "Man rechnet die Einmaleinsaufgabe und denkt an die Zehner oder Hunderter: 4 · 30 sind 4 · 3 Zehner = 12 Zehner = 120. Beim Dividieren ebenso: 600 : 3 sind 6 Hunderter : 3 = 2 Hunderter = 200. Beispiel: 5 · 80 = 40 Zehner = 400.",
  "mathe.vs.schriftlich.addieren":
    "Die Zahlen stellengerecht untereinander schreiben, Einer unter Einer, Zehner unter Zehner. Rechts beginnen. Ist eine Summe 10 oder mehr, schreibt man die Einer an und nimmt den Übertrag zur nächsten Stelle mit. Beispiel: 368 + 457: 8 + 7 = 15, schreibe 5, 1 weiter; 6 + 5 + 1 = 12; 3 + 4 + 1 = 8; Ergebnis 825.",
  "mathe.vs.schriftlich.subtrahieren":
    "Stellengerecht untereinander schreiben und von rechts ergänzen: von der unteren Ziffer (mit Übertrag) auf die obere. Ist die untere größer, ergänzt man auf die obere plus 10 und zählt bei der nächsten Stelle unten 1 dazu (Übertrag). Beispiel: 523 − 178: 8 auf 13 ist 5, 1 weiter; 7 + 1 = 8, 8 auf 12 ist 4, 1 weiter; 1 + 1 = 2, 2 auf 5 ist 3. Ergebnis 345.",
  "mathe.vs.schriftlich.multiplizieren":
    "Von rechts jede Stelle malnehmen, die Einer anschreiben und den Übertrag nach dem nächsten Malnehmen dazuzählen. Bei zweistelligem Multiplikator rechnet man zuerst mit der Zehnerziffer, dann mit der Einerziffer; diese zweite Zeile rückt eine Stelle nach rechts, dann addiert man. Beispiel: 274 · 3 = 822; 274 · 23 = 5 480 + 822 = 6 302.",
  "mathe.vs.schriftlich.dividieren":
    "Von links beginnen: Wie oft passt der Divisor in die erste Stelle oder in die ersten zwei Stellen? Ergebnisziffer anschreiben, malnehmen, Rest bilden, nächste Ziffer herunterholen. Passt der Divisor nicht hinein, kommt eine 0 ins Ergebnis. Beispiel: 936 : 4 = 234, Probe 234 · 4 = 936.",
  "mathe.vs.groessen.geld":
    "1 € = 100 c. Beträge schreibt man in Euro und Cent oder mit Komma, nach dem Komma stehen immer zwei Stellen für die Cent: 2 € 5 c = 2,05 €. Beispiel: 3,40 € + 1,80 € = 4 € + 120 c = 5,20 €.",
  "mathe.vs.groessen.laenge":
    "1 cm = 10 mm, 1 dm = 10 cm, 1 m = 100 cm und 1 km = 1 000 m. Beim Messen legt man das Lineal bei 0 an, nicht am Rand. Mehrnamige Längen rechnet man in die kleinere Einheit um. Beispiel: 3 m 25 cm = 325 cm; 2 km 40 m = 2 040 m.",
  "mathe.vs.groessen.zeit":
    "Der kleine Zeiger zeigt die Stunden, der große die Minuten. 1 h = 60 min, 1 min = 60 s, ein Tag hat 24 Stunden. Zeitspannen rechnet man in Schritten bis zur vollen Stunde. Beispiel: Von 7:40 bis 9:15 sind 20 min + 1 h + 15 min = 1 h 35 min.",
  "mathe.vs.groessen.masse":
    "1 dag = 10 g, 1 kg = 100 dag = 1 000 g und 1 t = 1 000 kg. Schwere Dinge wiegt man in kg oder t, leichte in dag oder g. Beispiel: 1 kg 25 dag = 125 dag; eine Tafel Schokolade wiegt 10 dag = 100 g.",
  "mathe.vs.groessen.hohlmass":
    "1 l = 1 000 ml, 1/2 l = 500 ml und 1/4 l = 250 ml. Eine große Milchpackung fasst 1 l, ein Teelöffel etwa 5 ml. Beispiel: 3 Becher mit je 250 ml sind 750 ml, also 250 ml weniger als 1 l.",
  "mathe.vs.geometrie.formen":
    "Flächen sind flach: Dreieck, Viereck, Rechteck, Quadrat, Kreis. Körper kann man angreifen und von allen Seiten anschauen: Würfel, Quader, Kugel, Zylinder, Kegel, Pyramide. Beispiel: Ein Würfel hat 6 gleich große quadratische Flächen, 12 Kanten und 8 Ecken.",
  "mathe.vs.geometrie.zeichnen":
    "Strecken zieht man mit dem Lineal und misst ab der 0. Für einen rechten Winkel legt man die Mittellinie des Geodreiecks genau auf die Strecke, den Nullpunkt auf den Eckpunkt, und zeichnet an der langen Kante entlang. Beispiel: Rechteck mit 5 cm und 3 cm: 5 cm zeichnen, an beiden Enden 3 cm im rechten Winkel, Endpunkte verbinden.",
  "mathe.vs.geometrie.umfang":
    "Der Umfang ist die Länge des Randes rundherum. Beim Rechteck: 2 · Länge + 2 · Breite, beim Quadrat: 4 · Seitenlänge. Beispiel: Rechteck mit 6 cm und 4 cm: u = 6 cm + 4 cm + 6 cm + 4 cm = 20 cm; Quadrat mit 5 cm: u = 4 · 5 cm = 20 cm.",
  "mathe.vs.geometrie.flaeche":
    "Der Flächeninhalt sagt, wie viele Einheitsquadrate in eine Figur passen. Beim Rechteck: Länge mal Breite, beim Quadrat: Seite mal Seite. Das Ergebnis hat eine Flächeneinheit wie cm² oder m². Beispiel: 6 cm lang und 4 cm breit: A = 6 cm · 4 cm = 24 cm², denn es sind 4 Reihen mit je 6 Zentimeterquadraten.",
  "mathe.vs.sach.einfach":
    "Den Text genau lesen, die Frage suchen und überlegen, was passiert: Kommt etwas dazu, wird etwas weggenommen, verteilt oder vervielfacht? Dann Rechnung, Ergebnis und Antwortsatz aufschreiben. Beispiel: Lea hat 12 Murmeln und schenkt Tom 5. R: 12 − 5 = 7. A: Lea hat noch 7 Murmeln.",
  "mathe.vs.sach.mehrschritt":
    "Zuerst klären, was gefragt ist und welche Zwischenergebnisse man dafür braucht. Jeden Schritt mit eigener Rechnung aufschreiben und am Ende prüfen, ob die Antwort passt. Beispiel: 3 Hefte zu je 2 € und ein Buch um 9 €, bezahlt mit 20 €: 3 · 2 = 6, 6 + 9 = 15, 20 − 15 = 5. A: Man bekommt 5 € zurück.",
};

/** Typical errors of the Volksschule skills of the package. */
const FEHLER_BISHER: Record<string, string[]> = {
  "mathe.vs.zahlen.zr10": [
    "Beim Abzählen einen Gegenstand übersprungen oder doppelt gezählt (6 statt 7 Punkte)",
    "Ziffern verwechselt oder spiegelverkehrt geschrieben (6 statt 9, verkehrte 3)",
    "Die Null nicht als Anzahl verstanden (bei einem leeren Teller „keine Zahl“ statt 0)",
  ],
  "mathe.vs.zahlen.zr20": [
    "Ziffern in der Sprechreihenfolge geschrieben („vierzehn“ als 41)",
    "Zehner und Einer vertauscht (12 als 2 Zehner und 1 Einer gelegt)",
    "Beim Weiterzählen die Startzahl mitgezählt (von 12 aus 3 weiter auf 14 statt 15)",
  ],
  "mathe.vs.zahlen.zr100": [
    "Zahlendreher beim Schreiben nach Gehör („dreiundsechzig“ als 36)",
    "Zehner und Einer in der Stellenwerttafel vertauscht (4 Z 7 E als 74)",
    "Fehlende Einer nicht mit 0 angeschrieben (5 Zehner und 0 Einer als 5)",
  ],
  "mathe.vs.zahlen.zr1000": [
    "Zahlen so geschrieben, wie man sie spricht („vierhundertsieben“ als 4007)",
    "Die 0 für eine leere Stelle vergessen (3 H 5 E als 35 statt 305)",
    "Mehr als 9 in einer Stelle nicht gebündelt (2 H 13 Z 4 E als 2134 statt 334)",
  ],
  "mathe.vs.zahlen.million": [
    "Nullen für leere Stellen vergessen („zwanzigtausendfünf“ als 2 005 statt 20 005)",
    "Dreiergruppen von links statt von rechts gebildet (12 345 als 123 45 gegliedert)",
    "Den Stellenwert einer Ziffer verwechselt (in 352 000 steht die 5 für 5 000 statt 50 000)",
  ],
  "mathe.vs.zahlen.vergleichen": [
    "Das Zeichen verkehrt herum verwendet (7 > 9)",
    "Nur auf die Einerziffer geschaut (39 > 41, weil 9 größer als 1 ist)",
    "Die Zahl mit den größeren Ziffern für größer gehalten, obwohl sie weniger Stellen hat (98 > 102)",
  ],
  "mathe.vs.zahlen.runden": [
    "Auf die falsche Ziffer geschaut (347 auf Hunderter als 400, weil die Einer 7 sind)",
    "Beim Aufrunden über den Hunderter falsch weitergezählt (396 auf Zehner als 390 oder 3 100 statt 400)",
    "Die Stellen rechts nicht durch Nullen ersetzt (347 auf Zehner als 35)",
  ],
  "mathe.vs.addsub.zr10": [
    "Beim Weiterzählen die Startzahl mitgezählt (5 + 3 = 7)",
    "Plus und Minus verwechselt (7 − 2 = 9)",
    "Mit 0 falsch gerechnet (6 − 0 = 0 oder 4 + 0 = 5)",
  ],
  "mathe.vs.addsub.zehner": [
    "Falsch zerlegt und angenommen, man sei schon beim Zehner (7 + 6 = 7 + 2 + 4 = 14)",
    "Beim Minus den Rest dazugezählt statt weggenommen (14 − 6 = 14 − 4 + 2 = 12)",
    "Bei Minus die kleinere Einerziffer von der größeren abgezogen (14 − 6 = 12, weil 6 − 4 = 2)",
  ],
  "mathe.vs.addsub.zr100": [
    "Zehner und Einer getrennt gerechnet und den Übertrag vergessen (47 + 28 = 65)",
    "Beim Minus die kleinere von der größeren Einerziffer abgezogen (63 − 27 = 44)",
    "Einer zu den Zehnern gezählt (34 + 5 = 84)",
  ],
  "mathe.vs.addsub.umkehr": [
    "Bei einer Ergänzungsaufgabe die beiden Zahlen addiert (36 + ___ = 50 mit 86 gelöst)",
    "Die Umkehraufgabe mit derselben Rechenart gebildet (zu 8 − 3 = 5 als Umkehrung 5 − 3 = 2)",
    "Beim Ergänzen nur bis zum nächsten Zehner gezählt (von 36 bis 50 fehlen 4)",
  ],
  "mathe.vs.muldiv.einmaleins": [
    "Mal mit Plus verwechselt (4 · 3 = 7)",
    "Bei einer abgeleiteten Aufgabe die falsche Zahl dazugezählt (6 · 7 = 5 · 7 + 6 = 41)",
    "Mit 0 und 1 falsch gerechnet (5 · 0 = 5 oder 1 · 8 = 9)",
  ],
  "mathe.vs.muldiv.geteilt": [
    "Mit einer Malaufgabe kontrolliert, die nicht passt (24 : 6 = 3, weil 3 · 8 = 24)",
    "Beim Anschreiben die Zahlen vertauscht (5 : 20 = 4 statt 20 : 5 = 4)",
    "Mit 0 und 1 falsch gerechnet (0 : 5 = 5 oder 7 : 7 = 0)",
  ],
  "mathe.vs.muldiv.rest": [
    "Einen Rest stehen gelassen, der größer als der Divisor ist (38 : 5 = 6 Rest 8)",
    "Bei der Probe den Rest nicht dazugezählt und die richtige Lösung für falsch gehalten (7 · 5 = 35 statt 38)",
    "In der Sachaufgabe den Rest falsch gedeutet (38 Kinder, 5 pro Boot: 7 Boote statt 8)",
  ],
  "mathe.vs.muldiv.zehner": [
    "Die Null vergessen (4 · 30 = 12)",
    "Bei einem Einmaleins-Ergebnis mit Null zu wenige Nullen angehängt (5 · 80 = 40)",
    "Beim Dividieren die Null weggelassen (240 : 6 = 4 statt 40)",
  ],
  "mathe.vs.schriftlich.addieren": [
    "Den Übertrag vergessen (368 + 457 = 715)",
    "Verschieden lange Zahlen links bündig untereinander geschrieben (245 + 32 = 565)",
    "Die ganze Stellensumme angeschrieben statt einen Übertrag zu bilden (68 + 57 = 1115)",
  ],
  "mathe.vs.schriftlich.subtrahieren": [
    "Ist die obere Ziffer kleiner, von oben nach unten ergänzt (3 auf 8 ist 5; 523 − 178 = 455)",
    "Den Übertrag nicht zur nächsten unteren Ziffer dazugezählt (352 − 127 = 235)",
    "Bei einer 0 oben einfach 0 angeschrieben, statt auf 10 zu ergänzen (400 − 136 = 300)",
  ],
  "mathe.vs.schriftlich.multiplizieren": [
    "Den Übertrag vor statt nach dem Malnehmen dazugezählt (bei 274 · 3: (7 + 1) · 3 = 24 statt 7 · 3 + 1 = 22)",
    "Den Übertrag vergessen (274 · 3 = 612)",
    "Bei zweistelligem Multiplikator die zweite Zeile nicht eingerückt (274 · 23 = 548 + 822 = 1 370)",
  ],
  "mathe.vs.schriftlich.dividieren": [
    "Die Null im Ergebnis vergessen, wenn der Divisor nicht hineinpasst (824 : 4 = 26 statt 206)",
    "Eine zu kleine Ergebnisziffer gewählt, der Rest ist größer als der Divisor (9 : 4 = 1 Rest 5)",
    "Die letzte Ziffer nicht mehr heruntergeholt (936 : 4 = 23 Rest 1)",
  ],
  "mathe.vs.groessen.geld": [
    "Cent mit nur einer Stelle nach dem Komma geschrieben (2 € 5 c als 2,5 €)",
    "Mit 10 statt mit 100 umgerechnet (1 € = 10 c)",
    "Beim Herausgeben falsch ergänzt (von 6,70 € auf 10 € als 4,30 € statt 3,30 €)",
  ],
  "mathe.vs.groessen.laenge": [
    "Das Lineal am Rand statt bei 0 angelegt (die Strecke wird ein paar Millimeter zu kurz gemessen)",
    "Mit der falschen Umrechnungszahl gerechnet (1 m = 10 cm oder 1 km = 100 m)",
    "Beim Umwandeln die Null vergessen (2 km 40 m = 240 m statt 2 040 m)",
  ],
  "mathe.vs.groessen.zeit": [
    "Stunden- und Minutenzeiger verwechselt (3 Uhr als 12:15 gelesen)",
    "„Halb drei“ als 3:30 statt 2:30 verstanden",
    "Mit 100 statt mit 60 Minuten gerechnet (9:15 − 7:40 = 1 h 75 min)",
  ],
  "mathe.vs.groessen.masse": [
    "1 kg mit 10 dag oder 1 000 dag gleichgesetzt (richtig 100 dag)",
    "Dekagramm und Gramm gleichgesetzt (25 dag = 25 g statt 250 g)",
    "Eine mehrnamige Angabe falsch umgewandelt (1 kg 5 dag = 15 dag statt 105 dag)",
  ],
  "mathe.vs.groessen.hohlmass": [
    "1 l = 100 ml gerechnet (richtig 1 000 ml)",
    "Das höhere Gefäß für das größere gehalten, ohne auf die Breite zu achten",
    "Liter und Milliliter beim Addieren vermischt (1 l + 250 ml = 251 l statt 1 250 ml)",
  ],
  "mathe.vs.geometrie.formen": [
    "Fläche und Körper verwechselt (Würfel als Quadrat oder Ball als Kreis bezeichnet)",
    "Ein auf der Spitze stehendes Quadrat nicht als Quadrat erkannt",
    "Beim Würfel nur die sichtbaren Flächen gezählt (3 statt 6)",
  ],
  "mathe.vs.geometrie.zeichnen": [
    "Das Lineal bei 1 statt bei 0 angesetzt (die 5 cm lange Strecke wird 4 cm lang)",
    "Die Mittellinie des Geodreiecks nicht genau auf die Strecke gelegt, der Winkel wird schief",
    "Gegenüberliegende Seiten des Rechtecks verschieden lang gezeichnet (oben 5 cm, unten 6 cm)",
  ],
  "mathe.vs.geometrie.umfang": [
    "Nur zwei Seiten addiert (6 cm + 4 cm = 10 cm)",
    "Länge mal Breite gerechnet, also den Flächeninhalt (6 · 4 = 24)",
    "Seiten in verschiedenen Einheiten addiert (1 m + 50 cm = 51 cm)",
  ],
  "mathe.vs.geometrie.flaeche": [
    "Umfang und Flächeninhalt verwechselt (6 + 4 + 6 + 4 = 20 cm²)",
    "Die falsche Einheit angegeben (24 cm statt 24 cm²)",
    "Beim Auslegen mit Einheitsquadraten Lücken gelassen oder Quadrate doppelt gezählt",
  ],
  "mathe.vs.sach.einfach": [
    "Die Rechenart nach einem Signalwort gewählt (Tom hat 10, das sind 3 mehr als Lea, also Lea 13 statt 7)",
    "Einfach alle Zahlen aus dem Text zusammengezählt (12 + 5 = 17 statt 12 − 5)",
    "Antwortsatz vergessen oder ohne Einheit (A: 7.)",
  ],
  "mathe.vs.sach.mehrschritt": [
    "Ein Zwischenergebnis als Antwort genommen (15 € statt 5 € Rückgeld)",
    "Das Zwischenergebnis nicht weiterverwendet, sondern wieder mit einer Zahl aus dem Text gerechnet (20 − 9 = 11)",
    "Mehrfache Mengen nur einmal gezählt (3 Hefte zu je 2 € als 2 €)",
  ],
};

/**
 * Order between the Volksschule maths skills: [skill, skill that should sit before it]. Own didactic
 * choices, like PREREQUISITES in lib/curriculum.ts.
 */
const VORAUSSETZUNGEN: [string, string][] = [
  ["mathe.vs.zahlen.zerlegen", "mathe.vs.zahlen.zr10"],
  ["mathe.vs.addsub.zehner", "mathe.vs.zahlen.zerlegen"],
  ["mathe.vs.addsub.verdoppeln", "mathe.vs.addsub.zr10"],
  ["mathe.vs.addsub.ungleichungen", "mathe.vs.zahlen.vergleichen"],
  ["mathe.vs.addsub.vorteile", "mathe.vs.addsub.zr100"],
  ["mathe.vs.addsub.zr1000", "mathe.vs.addsub.zr100"],
  ["mathe.vs.addsub.zr1000", "mathe.vs.zahlen.zr1000"],
  ["mathe.vs.muldiv.halbschriftlich", "mathe.vs.muldiv.zehner"],
  ["mathe.vs.schriftlich.ueberschlag", "mathe.vs.zahlen.runden"],
  ["mathe.vs.schriftlich.zweistellig", "mathe.vs.schriftlich.dividieren"],
  ["mathe.vs.groessen.flaechenmasse", "mathe.vs.geometrie.flaeche"],
  ["mathe.vs.geometrie.strecken", "mathe.vs.geometrie.zeichnen"],
  ["mathe.vs.geometrie.netze", "mathe.vs.geometrie.formen"],
  ["mathe.vs.geometrie.zusammengesetzt", "mathe.vs.geometrie.flaeche"],
  ["mathe.vs.sach.proportional", "mathe.vs.muldiv.geteilt"],
  ["mathe.vs.daten.diagramme", "mathe.vs.daten.strichliste"],
  ["mathe.vs.daten.zufallsexperimente", "mathe.vs.daten.wahrscheinlich"],
  ["mathe.vs.brueche.vergleichen", "mathe.vs.brueche.bruchteile"],
  ["mathe.vs.brueche.vongroessen", "mathe.vs.brueche.bruchteile"],
  ["mathe.vs.brueche.vongroessen", "mathe.vs.muldiv.geteilt"],
];

export const MATHE_VS: Modul = {
  fach: "Mathematik",
  bereiche: BEREICHE,
  fehlerBisher: FEHLER_BISHER,
  erklaerungBisher: ERKLAERUNG_BISHER,
  voraussetzungen: VORAUSSETZUNGEN,
};
