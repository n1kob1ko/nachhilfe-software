# Aufgaben mit Bild

Mathematik-Aufgaben, zu denen ein Bild gehört: ein **Zahlenstrahl** (auch Zahlengerade, mit ganzen Zahlen, negativen Zahlen, Dezimalzahlen und Brüchen), ein **Koordinatensystem** (Punkte, eine Gerade, zwei Geraden) oder eine **Figur** mit beschrifteten Längen (Rechteck, Quadrat, Dreieck mit Höhe, rechtwinkliges Dreieck, L-Form). Das Bild ist kein eigenes Antwortformat: geantwortet wird wie immer als Rechnung, Multiple Choice, Lückentext, Rechenweg oder Mehrteilige Sachaufgabe. Darum prüft die App die Antwort mit derselben Prüfung wie bei jeder anderen Aufgabe, und Versuche, Lernstand und Fehlerarten laufen unverändert.

## Wo das Bild steht

Die Angaben zum Bild liegen in der Aufgabe selbst, in `tasks.data.figure` (Typ `Figur` in `lib/figur.ts`). Keine neue Tabelle, keine neue Spalte. Gespeichert werden nur Zahlen und kurze Texte:

| Art | Angaben |
|---|---|
| `zahlenstrahl` | Anfang, Länge eines Teilstücks (als Bruch), Anzahl Teilstücke, beschriftete Striche, Zahlformat (ganz, dezimal, Bruch), Marken (A, B, …) an Strichen, oder ein markiertes Intervall |
| `koordinaten` | Bereich von x und y, ein Kästchen ist wie viel, wo Zahlen stehen, Punkte mit Namen, Geraden y = k · x + d (k als Bruch) |
| `figur` | Form, Ecken, Beschriftung der Seiten (mit gesuchtem Wert „?“ und der Lösung dazu), Strecken wie Höhe oder Diagonale, rechte Winkel, Namen der Ecken |

`leseFigur` prüft die Angaben beim Lesen und beim Speichern (`normalizeTask` in `lib/builder.ts`). Ein kaputtes oder unbekanntes Bild wird nicht gespeichert und nirgends gezeichnet. Eine KI-Aufgabe hat nie ein Bild; der KI-Weg ist unverändert.

## Ein Zeichner für alle Stellen

`figurSzene` macht aus den Angaben eine Szene aus einfachen Teilen (Linien, Wege, Punkte, Texte, Brüche). `figurSvg` macht daraus ein SVG. Alle Stellen nehmen dieses eine SVG:

| Stelle | Datei | Lösung im Bild |
|---|---|---|
| Schülergerät (Übung, Schülerlink, Laptop) | `components/Solver.tsx` | nie |
| Schnellrunde | `components/StudentQuickRound.tsx` | nie |
| Vorschau der Übung | `components/TaskPreview.tsx` | wenn „Lösungen zeigen“ an ist |
| Editor (nur ansehen, „Bild entfernen“) | `components/WorksheetEditor.tsx` | ja |
| Ergebnis einer Übung | `app/(tutor)/schueler/[id]/ergebnis/[aid]/page.tsx` | ja |
| A4-Blatt, Schülerfassung | `components/arbeitsblatt/Sheet.tsx` | nie |
| A4-Blatt, Lehrerfassung und Lösungsseite | `components/arbeitsblatt/Sheet.tsx` | ja |
| Mappe | `components/arbeitsblatt/Mappe.tsx` | wie die Lösung in der Mappe |
| Whiteboard | `lib/whiteboard-templates.ts` (`figureTemplate`) | nie |

- Das SVG hat `role="img"` und ein `aria-label`, das das Bild beschreibt, ohne die Lösung zu verraten („Zahlenstrahl mit 10 gleich langen Teilstücken. Beschriftet sind 300, 350 und 400. Eine Stelle ist mit A markiert.“).
- Striche und Schrift sind in der Textfarbe (`currentColor`), im Druck schwarz. Das Gitter ist grau, Flächen sind ganz leicht getönt. Nichts hängt an CSS-Hintergründen, die beim Drucken wegfallen.
- Am Bildschirm wird das Bild höchstens so breit wie gezeichnet und schmal auf die verfügbare Breite verkleinert (nie seitlich zu schieben). Am Blatt hat jede Einheit der Zeichnung dieselbe Länge in Millimetern, damit die Schrift in allen Bildern gleich groß gedruckt wird.
- Am Blatt steht die Frage über dem Bild, die Lücken darunter („Lies die Koordinaten ab.“, Bild, „A( ___ | ___ )“). Wird abgelesen, gibt es kein Rechenfeld; bei einer Figur steht das karierte Feld zwischen Bild und Lücken.
- Ein leeres Koordinatensystem zum Zeichnen bekommt eine Aufgabe mit Bild nicht dazu.

### Was die Schülerseite bekommt

Der Server schickt dem Schülergerät nur das fertige SVG ohne Lösung (`figur` in `lib/solver-tasks.ts`), nie die Angaben dahinter: keine Werte der Marken, keine Seitenlänge, die gesucht ist. Auch das `aria-label` nennt sie nicht. Ans Whiteboard geht über die Warteschlange (die auch das Schülergerät zeichnen darf) ebenfalls nur die Szene ohne Lösung (`boardTaskForStudent`).

### Whiteboard

Am Whiteboard wird das Bild aus gesperrten Excalidraw-Linien, Punkten und Texten gezeichnet, unter die Aufgabe und der Aufgabe zugeordnet wie der Text. Gibt es keine zeichenbare Szene, steht die Beschreibung als Text da („Bild: …“). „KI prüfen“ am Whiteboard sieht das Bild als Teil des Bildschirmfotos.

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

Die Zahlen sind wie im Schulbuch: ganze oder einfache Dezimalzahlen, pythagoreische Tripel oder schön gerundete Werte, Einheiten cm und m. Nichts davon ist aus einem Schulbuch, von IQS oder aus der Matura übernommen.

### Typische Fehler

Jede Aufgabe kennt die typischen falschen Antworten und benennt sie: um einen Teilstrich verzählt, jeden Teilstrich als 1 gezählt, Vorzeichen vergessen, x und y vertauscht, Quadranten im Uhrzeigersinn gezählt, k und d vertauscht, Flächeninhalt statt Umfang, beim Umfang nur a + b, durch 2 vergessen, bei gesuchter Kathete addiert statt subtrahiert, die Wurzel vergessen. Bei Multiple Choice sind das die falschen Antworten.

## Wo die Aufgaben entstehen

- **Übungs-Builder ohne KI**: `generateForSlot` in `lib/generators.ts` nimmt bei diesen Fähigkeiten zuerst eine Aufgabe mit Bild, im gewählten Format (Multiple Choice und Lückentext haben eigene Fragen zum Bild, „Fehler finden“ und „Lösungsweg ordnen“ behalten das Bild). Gemischte Übungen nehmen bei den Ablese-Fähigkeiten Rechnung, Lückentext und MC (`MIX_BY_SKILL` in `lib/curriculum.ts`).
- **Neu erstellen** einer einzelnen Aufgabe, **Diagnose** und **Minitest** nehmen dieselben Generatoren (`generateBuiltIn`).
- Doppelte erkennt die App am Text **und** am Bild (`aufgabenSchluessel`): „Welche Zahl ist bei A markiert?“ mit einem anderen Bild ist eine andere Aufgabe. Das gilt beim Builder, beim Neu-Erstellen und beim Minitest (schon bearbeitete Aufgaben).
- Mit KI bleibt alles wie bisher; KI-Aufgaben haben kein Bild.

## Grenzen

- Das Bild lässt sich im Editor nicht bearbeiten. Wer Zahlen im Text ändert, nimmt „Neu erstellen“ oder entfernt das Bild.
- Tausender mit Punkt („12.000“) liest die Prüfung wie bisher als Dezimalzahl 12; mit Leerzeichen („12 000“) oder ohne Trennung geht es.
- Kreise, Körper, Winkel zum Messen und Diagramme gibt es noch nicht.
- Am Handy wird ein breites Bild verkleinert; die Schrift bleibt lesbar, ist aber kleiner als am Tablet.

## Tests

`lib/figur.test.ts`: für jede Fähigkeit, jedes Format, jede Stufe und 40 Seeds wird die gespeicherte Antwort unabhängig aus dem Bild nachgerechnet (Marke am Strahl, Punkt, Schnittpunkt, Fläche und Umfang aus den Ecken), dazu: die App nimmt die Antwort an, typische Fehler bekommen ihr Etikett, keine Gedankenstriche. Außerdem: jede Art Bild wird gezeichnet, die Schülerseite bekommt nie die Lösung, das A4-Blatt druckt das SVG (Schülerfassung ohne, Lehrerfassung und Lösungsseite mit Werten), Mappe, Whiteboard, Builder ohne KI, Neu erstellen und Minitest.
