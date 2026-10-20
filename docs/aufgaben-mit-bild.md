# Aufgaben mit Bild

Mathematik-Aufgaben, zu denen ein Bild gehört: ein **Zahlenstrahl** (auch Zahlengerade, mit ganzen Zahlen, negativen Zahlen, Dezimalzahlen und Brüchen), ein **Koordinatensystem** (Punkte, eine Gerade, zwei Geraden) eine **Figur** mit beschrifteten Längen (Rechteck, Quadrat, Dreieck mit Höhe, rechtwinkliges Dreieck, L-Form), ein **Kreis** (ganzer Kreis, Halbkreis, Viertelkreis, Kreissektor mit Winkel; Radius oder Durchmesser beschriftet, Fläche getönt) oder ein **Diagramm** (Säulen-, Balken- oder Liniendiagramm mit Gitterlinien). Das Bild ist kein eigenes Antwortformat: geantwortet wird wie immer als Rechnung, Multiple Choice, Lückentext, Rechenweg oder Mehrteilige Sachaufgabe. Darum prüft die App die Antwort mit derselben Prüfung wie bei jeder anderen Aufgabe, und Versuche, Lernstand und Fehlerarten laufen unverändert.

## Wo das Bild steht

Die Angaben zum Bild liegen in der Aufgabe selbst, in `tasks.data.figure` (Typ `Figur` in `lib/figur.ts`). Keine neue Tabelle, keine neue Spalte. Gespeichert werden nur Zahlen und kurze Texte:

| Art | Angaben |
|---|---|
| `zahlenstrahl` | Anfang, Länge eines Teilstücks (als Bruch), Anzahl Teilstücke, beschriftete Striche, Zahlformat (ganz, dezimal, Bruch), Marken (A, B, …) an Strichen, oder ein markiertes Intervall |
| `koordinaten` | Bereich von x und y, ein Kästchen ist wie viel, wo Zahlen stehen, Punkte mit Namen, Geraden y = k · x + d (k als Bruch) |
| `figur` | Form, Ecken, Beschriftung der Seiten (mit gesuchtem Wert „?“ und der Lösung dazu), Strecken wie Höhe oder Diagonale, rechte Winkel, Namen der Ecken |
| `kreis` | Teil (Kreis, Halbkreis, Viertelkreis, Sektor), Winkel des Sektors (1 bis 359°), eingezeichnete Strecke (Radius, Durchmesser oder keine) mit Beschriftung und Lösung, Name des Mittelpunkts, getönt, übriger Kreis gestrichelt, Winkel anschreiben |
| `diagramm` | Art (Säulen, Balken, Linie), Überschrift, was die Achse zählt, Achse von, bis und Abstand der Gitterlinien, an jeder wievielten Linie eine Zahl steht, Werte mit Namen (eine Säule oder ein Balken kann „gesucht“ sein), alle Werte anschreiben |

`leseFigur` prüft die Angaben beim Lesen und beim Speichern (`normalizeTask` in `lib/builder.ts`); `figurFehler` sagt in einem kurzen Satz, warum ein Bild nicht stimmt (etwa „Der Wert 14 bei Äpfel liegt außerhalb der Achse (0 bis 12).“). Ein kaputtes oder unbekanntes Bild wird nicht gespeichert und nirgends gezeichnet. Speichert die Lehrkraft im Editor ein Bild, das nicht stimmt, lehnt `saveTaskAction` ab und nennt den Grund, statt das Bild still wegzulassen. Eine KI-Aufgabe hat nie ein Bild; der KI-Weg ist unverändert.

## Ein Zeichner für alle Stellen

`figurSzene` macht aus den Angaben eine Szene aus einfachen Teilen (Linien, Wege, Punkte, Texte, Brüche). `figurSvg` macht daraus ein SVG. Alle Stellen nehmen dieses eine SVG:

| Stelle | Datei | Lösung im Bild |
|---|---|---|
| Schülergerät (Übung, Schülerlink, Laptop) | `components/Solver.tsx` | nie |
| Schnellrunde | `components/StudentQuickRound.tsx` | nie |
| Vorschau der Übung | `components/TaskPreview.tsx` | wenn „Lösungen zeigen“ an ist |
| Editor (ansehen, bearbeiten, entfernen) | `components/WorksheetEditor.tsx`, `components/FigurEditor.tsx` | ja |
| Ergebnis einer Übung | `app/(tutor)/schueler/[id]/ergebnis/[aid]/page.tsx` | ja |
| A4-Blatt, Schülerfassung | `components/arbeitsblatt/Sheet.tsx` | nie |
| A4-Blatt, Lehrerfassung und Lösungsseite | `components/arbeitsblatt/Sheet.tsx` | ja |
| Mappe | `components/arbeitsblatt/Mappe.tsx` | wie die Lösung in der Mappe |
| Whiteboard | `lib/whiteboard-templates.ts` (`figureTemplate`) | nie |

- Das SVG hat `role="img"` und ein `aria-label`, das das Bild beschreibt, ohne die Lösung zu verraten („Zahlenstrahl mit 10 gleich langen Teilstücken. Beschriftet sind 300, 350 und 400. Eine Stelle ist mit A markiert.“).
- Striche und Schrift sind in der Textfarbe (`currentColor`), im Druck schwarz. Das Gitter ist grau, Flächen sind ganz leicht getönt, ein Kreisteil oder eine Säule deutlicher (`fill-opacity`, auch im Druck sichtbar). Der übrige Kreis zu einem Kreisteil ist gestrichelt. Nichts hängt an CSS-Hintergründen, die beim Drucken wegfallen.
- Am Bildschirm wird das Bild höchstens so breit wie gezeichnet und schmal auf die verfügbare Breite verkleinert (nie seitlich zu schieben). Am Blatt hat jede Einheit der Zeichnung dieselbe Länge in Millimetern, damit die Schrift in allen Bildern gleich groß gedruckt wird.
- Am Blatt steht die Frage über dem Bild, die Lücken darunter („Lies die Koordinaten ab.“, Bild, „A( ___ | ___ )“). Wird abgelesen (Zahlenstrahl, Koordinatensystem, Diagramm), gibt es kein großes Rechenfeld, und die Lösungsseite zeigt das Bild noch einmal mit den Werten. Bei einer Figur und einem Kreis wird gerechnet: das karierte Feld steht zwischen Bild und Lücken (`zumAblesen` in `lib/figur.ts`).
- Ein leeres Koordinatensystem zum Zeichnen bekommt eine Aufgabe mit Bild nicht dazu.

### Was die Schülerseite bekommt

Der Server schickt dem Schülergerät nur das fertige SVG ohne Lösung (`figur` in `lib/solver-tasks.ts`), nie die Angaben dahinter: keine Werte der Marken, keine Seitenlänge und keinen Radius, die gesucht sind, keine Werte eines Diagramms. Eine gesuchte Säule ist nur ein „?“. Auch das `aria-label` nennt sie nicht. Ans Whiteboard geht über die Warteschlange (die auch das Schülergerät zeichnen darf) ebenfalls nur die Szene ohne Lösung (`boardTaskForStudent`).

### Whiteboard

Am Whiteboard wird das Bild aus gesperrten Excalidraw-Linien, Punkten und Texten gezeichnet, unter die Aufgabe und der Aufgabe zugeordnet wie der Text. Gibt es keine zeichenbare Szene, steht die Beschreibung als Text da („Bild: …“). „KI prüfen“ am Whiteboard sieht das Bild als Teil des Bildschirmfotos.

## Bild bearbeiten

Im Editor einer Übung steht das Bild mit den gesuchten Werten (wie in der Lehrerfassung). „Bild bearbeiten“ öffnet ein kleines Formular, je nach Art:

| Art | Felder |
|---|---|
| Zahlenstrahl | Anfang, Ende, ein Teilstück (10, 0,1 oder 1/4), Schreibweise, Zahlen unter den Strichen (mit ; getrennt), Marken mit Namen und Zahl; bei einem Intervall von, bis und ob die Ränder dazugehören |
| Koordinatensystem | x von, bis, y von, bis, ein Kästchen ist, Zahl an jedem wievielten Kästchen, Punkte mit Namen, x und y, Geraden mit Name, k (auch als Bruch) und d |
| Figur | Form, Längen im Bild (Breite und Höhe, Grundseite, Höhe und Fußpunkt, bei der L-Form die fehlende Ecke), Beschriftung jeder Seite mit Lösung, Höhe oder Diagonale, Namen der Ecken, Text in der Figur |
| Kreis | Teil, Winkel des Sektors, eingezeichnete Strecke mit Beschriftung und Lösung, Name des Mittelpunkts, getönt, übriger Kreis gestrichelt, Winkel anschreiben |
| Diagramm | Art, Überschrift, was die Achse zählt, Achse von, bis, Abstand der Linien, Zahl an jeder wievielten Linie, Werte mit Namen und „gesucht“, alle Werte anschreiben |

- Die Felder macht `felderAus` in `lib/figur-editor.ts` aus dem Bild, `figurAus` macht daraus wieder ein Bild. Jede Änderung geht durch `leseFigur`, wie beim Speichern; die Vorschau zeigt sofort das neue Bild. Stimmt etwas nicht (eine Marke liegt zwischen zwei Strichen, ein Punkt außerhalb des Bereichs, ein Wert über der Achse, ein Winkel über 359°), steht der Grund unter dem Bild. Das Bild bleibt dann, wie es zuletzt richtig war, und „Speichern“ sagt, was noch fehlt.
- Bei einer Figur bestimmen die Längen die Zeichnung, die Beschriftung steht daneben. Passt eine Beschriftung nicht zur Zeichnung („a = 8 cm“ an einer Seite, die 6 lang ist), erscheint ein Hinweis; gespeichert wird trotzdem. Eine Höhe bleibt beim Ändern unter der Spitze.
- Zahlenfelder öffnen am Handy die Zifferntastatur; die Felder stehen untereinander, nichts muss seitlich geschoben werden.
- Die Lösung der Aufgabe rechnet die App nicht neu aus. Der Editor sagt das dazu: wer Zahlen im Bild ändert, prüft Aufgabe, Lösung und Antworten.
- „Bild entfernen“ nimmt das Bild ganz weg.

## Welche Fähigkeiten Aufgaben mit Bild bekommen

Die eingebauten Generatoren in `lib/generators-figur.ts` bauen die Aufgaben, ganz ohne KI. Jede Antwort wird aus denselben Zahlen gerechnet, die gezeichnet werden; die Tests lesen sie für tausende Aufgaben wieder aus dem Bild ab. Teilfähigkeiten (z. B. `mathe.flaechen.rechteck.umfang`) nehmen die Aufgaben ihrer Fähigkeit.

| Fähigkeit | Bild | Formate | Aufgaben |
|---|---|---|---|
| Zahlenstrahl und Nachbarzahlen (VS) | Zahlenstrahl | Rechnung, MC, Lückentext | Welche Zahl ist bei A markiert? Welcher Buchstabe markiert 690? A und B ablesen |
| Große Zahlen am Zahlenstrahl | Zahlenstrahl | Rechnung, MC, Lückentext | dasselbe mit Tausendern bis Millionen |
| Ganze Zahlen auf der Zahlengeraden | Zahlengerade | Rechnung, MC, Lückentext | negative Zahlen ablesen |
| Rationale Zahlen | Zahlengerade | Rechnung, MC, Lückentext | negative Dezimalzahlen und Brüche ablesen |
| Dezimalzahlen vergleichen und ordnen | Zahlenstrahl | Rechnung, MC, Lückentext | Zehntel und Hundertstel ablesen |
| Brüche als Anteile | Zahlenstrahl | Rechnung, MC, Lückentext | Bruch bei A, Buchstabe zu einem Bruch |
| Brüche vergleichen und ordnen | Zahlenstrahl | Rechnung, MC, Lückentext | ablesen, dann <, > oder = einsetzen |
| Unechte Brüche und gemischte Zahlen | Zahlenstrahl | Rechnung, MC, Lückentext | als gemischte Zahl ablesen |
| Intervalle (Oberstufe) | Zahlengerade | MC | welches Intervall ist markiert (voller und leerer Punkt, Pfeil nach ∞) |
| Koordinatensystem: Punkte ablesen | Koordinatensystem | Rechnung, MC, Lückentext | Punkt zu Koordinaten, Quadrant, Koordinaten von A und B |
| Lineare Funktionen (k und d) | Koordinatensystem | Rechnung, MC, Lückentext, Rechenweg | k ablesen, d ablesen, Gleichung y = k · x + d, k aus zwei Punkten berechnen |
| Funktionen: Graph und Gleichung | Koordinatensystem | Rechnung, MC, Lückentext | f(x) ablesen, Funktionsgleichung zum Graphen |
| Gleichungssysteme grafisch | Koordinatensystem | Rechnung, MC, Lückentext | Lösung am Schnittpunkt ablesen |
| Rechteck und Quadrat | Figur | Rechnung, MC, Lückentext, Rechenweg, Sachaufgabe | Umfang, Flächeninhalt, Seite aus Umfang; Beet mit Zaun |
| Flächeninhalt von Dreiecken | Figur | Rechnung, MC, Lückentext, Rechenweg | A = c · h : 2 mit eingezeichneter Höhe |
| Zusammengesetzte Figuren (VS und Sek I) | Figur | Rechnung, MC, Lückentext, Rechenweg, Sachaufgabe | L-Form: Umfang, Flächeninhalt, fehlende Seite; Grundstück |
| Umkehraufgaben | Figur | Rechnung, MC, Lückentext, Rechenweg | Seite oder Höhe aus Flächeninhalt |
| Pythagoras: fehlende Seite | Figur | Rechnung, MC, Lückentext, Rechenweg | Hypotenuse oder Kathete |
| Pythagoras in Figuren | Figur | Rechnung, MC, Lückentext, Rechenweg | Diagonale im Rechteck, Höhe im gleichschenkligen Dreieck |
| Kreis: Mittelpunkt, Radius, Durchmesser | Kreis | Rechnung, MC, Lückentext | Durchmesser aus Radius und umgekehrt, Zirkel einstellen, Strecke benennen, Kreissektor erkennen |
| Kreis: Umfang und Flächeninhalt | Kreis | Rechnung, MC, Lückentext, Rechenweg, Sachaufgabe | u und A aus r oder d, ab „schwer“ auch rückwärts (d aus u, r aus A mit Wurzel); Trampolin, Teich, Beet mit Kosten |
| Kreisteile | Kreis | Rechnung, MC, Lückentext, Rechenweg, Sachaufgabe | Halbkreis und Viertelkreis (A und u), Kreissektor (A, Bogen b, Anteil als Bruch); Pizzastücke, Rasensprenger |
| Diagramme lesen (VS) | Diagramm | Rechnung, MC, Lückentext, Rechenweg | ablesen, wie viel mehr, wo am meisten, alles zusammen |
| Diagramme lesen und erstellen (Unterstufe) | Diagramm | Rechnung, MC, Lückentext, Rechenweg | dazu fehlende Säule aus der Gesamtzahl, abgeschnittene Achse erkennen, Liniendiagramm (Temperatur auch unter 0, Wachstum) |
| Absolute und relative Häufigkeit | Diagramm | Rechnung, MC, Lückentext, Rechenweg | relative Häufigkeit in Prozent, ab „mittel“ mit selbst gezählter Gesamtzahl |
| Mittelwert, Median, Spannweite | Diagramm | Rechnung, MC, Lückentext, Rechenweg | aus den abgelesenen Werten; Werte mit 0 zählen mit |

Die Zahlen sind wie im Schulbuch: ganze oder einfache Dezimalzahlen, pythagoreische Tripel oder schön gerundete Werte, Einheiten cm und m. Die Sachverhalte bei Kreisen und Diagrammen sind erfunden (Lieblingsobst, Schulweg, Kastanien, Gäste im Freibad, Kuchen beim Schulfest, Temperatur, Sonnenblume, Tore, gelesene Seiten). Nichts davon ist aus einem Schulbuch, von IQS oder aus der Matura übernommen.

### Kreise: rechnen mit π

- Jede Aufgabe mit π sagt dazu: „Rechne mit π ≈ 3,14.“ Die Lösung ist mit 3,14 gerechnet, wie im Schulbuch.
- Hat das Ergebnis mit 3,14 mehr als zwei Nachkommastellen, sagt die Aufgabe „Runde auf eine Nachkommastelle.“, und die Lösung hat genau eine (auch „95,0“). Bei mehreren Teilen (Lückentext, Sachaufgabe) gilt das für alle Teile.
- Wer mit der π-Taste rechnet und gleich rundet, bekommt manchmal etwas anderes (254,47 statt 254,34). Das zählt auch als richtig: beide Werte stehen in den richtigen Antworten.
- Beim Rechenweg prüft die App wie immer mit Einheit (`unit`) und, wenn gerundet wird, mit `round: 1` (`lib/math-check.ts`). Die Musterzeile zeigt die Rundung: „A = 5,5² · 3,14 = 94,985 ≈ 95,0“.
- Radien und Winkel sind so gewählt, dass keine endlosen Kommazahlen entstehen (beim Sektor mit 120° etwa ein Radius, der durch 3 teilbar ist).
- Winkel werden mit ° geschrieben und geprüft („45°“). In der Sachaufgabe mit Kosten rechnet c) mit dem Ergebnis aus a) weiter (Folgefehler zählen).

### Diagramme: genau ablesbar

- Jeder Wert liegt auf einer Gitterlinie. Ein Wert dazwischen (nur im Editor möglich) wird im Bild angeschrieben, damit er genau ablesbar bleibt.
- Nicht jede Linie hat eine Zahl: ab „mittel“ steht oft nur an jeder zweiten (oder vierten, fünften) Linie eine. Das ist Absicht; die Hilfen sagen, wie viel eine Linie ist.
- Die Zahlen an der Werteachse berühren sich nie: sind sie breit (etwa 240 beim Balkendiagramm), rücken die Gitterlinien auseinander. Erst bei sehr vielen Linien (nur im Editor möglich) steht an weniger Linien eine Zahl; die Gitterlinien bleiben alle.
- Eine Achse, die nicht bei 0 beginnt, hat ein Zackenzeichen; die Aufgabe dazu fragt, welche Aussage stimmt.
- Temperaturen werden nicht als Rechenweg gefragt (°C ist keine Einheit der Prüfung). Als Rechnung zählen „12“, „12 °C“, „12 Grad“ und „12°“.

### Typische Fehler

Jede Aufgabe kennt die typischen falschen Antworten und benennt sie: um einen Teilstrich verzählt, jeden Teilstrich als 1 gezählt, Vorzeichen vergessen, x und y vertauscht, Quadranten im Uhrzeigersinn gezählt, k und d vertauscht, Flächeninhalt statt Umfang, beim Umfang nur a + b, durch 2 vergessen, bei gesuchter Kathete addiert statt subtrahiert, die Wurzel vergessen. Bei Kreisen: Radius und Durchmesser verwechselt, Umfang und Flächeninhalt verwechselt, π vergessen, den ganzen Kreis statt des Anteils, den Anteil verkehrt (360° : α), beim Halbkreis den Durchmesser vergessen. Bei Diagrammen: die Einteilung der Achse nicht beachtet, um eine Linie verzählt, addiert statt subtrahiert, die abgeschnittene Achse übersehen, absolute und relative Häufigkeit verwechselt, nur addiert statt durch die Anzahl dividiert, den Median ohne Ordnen gesucht. Bei Multiple Choice sind das die falschen Antworten.

## Wo die Aufgaben entstehen

- **Übungs-Builder ohne KI**: `generateForSlot` in `lib/generators.ts` nimmt bei diesen Fähigkeiten zuerst eine Aufgabe mit Bild, im gewählten Format (Multiple Choice und Lückentext haben eigene Fragen zum Bild, „Fehler finden“ und „Lösungsweg ordnen“ behalten das Bild). Gemischte Übungen nehmen bei den Ablese-Fähigkeiten, beim Kreis benennen und bei Diagrammen Rechnung, Lückentext und MC, bei Häufigkeiten und Kennzahlen auch den Rechenweg (`MIX_BY_SKILL` in `lib/curriculum.ts`).
- **Neu erstellen** einer einzelnen Aufgabe, **Diagnose** und **Minitest** nehmen dieselben Generatoren (`generateBuiltIn`).
- Doppelte erkennt die App am Text **und** am Bild (`aufgabenSchluessel`): „Welche Zahl ist bei A markiert?“ mit einem anderen Bild ist eine andere Aufgabe. Das gilt beim Builder, beim Neu-Erstellen und beim Minitest (schon bearbeitete Aufgaben).
- Mit KI bleibt alles wie bisher; KI-Aufgaben haben kein Bild.

## Grenzen

- Beim Bearbeiten rechnet die App die Lösung nicht neu aus; die Lehrkraft prüft Aufgabe und Lösung selbst. Ein neues Bild für eine Aufgabe ohne Bild lässt sich im Editor nicht anlegen.
- Eine Figur hat im Editor die Lage, die die Generatoren zeichnen (Grundseite unten, bei der L-Form fehlt die Ecke rechts oben).
- Tausender mit Punkt („12.000“) liest die Prüfung wie bisher als Dezimalzahl 12; mit Leerzeichen („12 000“) oder ohne Trennung geht es.
- Kreisdiagramme, Körper und Winkel zum Messen gibt es noch nicht.
- Am Handy wird ein breites Bild verkleinert; die Schrift bleibt lesbar, ist aber kleiner als am Tablet.

## Tests

`lib/figur.test.ts`: für jede Fähigkeit, jedes Format, jede Stufe und 40 Seeds wird die gespeicherte Antwort unabhängig aus dem Bild nachgerechnet (Marke am Strahl, Punkt, Schnittpunkt, Fläche und Umfang aus den Ecken, beim Kreis mit 3,14 aus der Beschriftung, beim Diagramm aus den Werten im Bild, die alle auf einer Gitterlinie liegen), dazu: die App nimmt die Antwort an, typische Fehler bekommen ihr Etikett, keine Gedankenstriche. Außerdem: jede Art Bild wird gezeichnet, die Zahlen an der Achse eines Diagramms berühren sich nie, falsche Angaben werden mit Grund abgelehnt, Texte im SVG werden maskiert, das Formular im Editor ergibt unverändert dasselbe Bild und lehnt falsche Änderungen mit Grund ab, die Schülerseite bekommt nie die Lösung (auch keine Werte eines Diagramms), richtige Antworten zählen am Schülergerät, das A4-Blatt druckt das SVG (Schülerfassung ohne, Lehrerfassung und Lösungsseite mit Werten), Mappe, Whiteboard, Builder ohne KI, Neu erstellen und Minitest.
