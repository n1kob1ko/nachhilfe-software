# Probeschularbeit

niko, 2026-10-19, auf der Karte „bessere Übungen“: „Ein ganzer Test zum Stoffzettel mit Punkten und
Notenschlüssel, als A4 zum Drucken.“ Die Begriffe stehen in [CONTEXT.md](../CONTEXT.md):
**Probeschularbeit**, **Notenschlüssel**. Nicht verwechseln mit dem **Minitest** (ein paar Aufgaben zum
Stoff der letzten Einheit, ohne Note).

| Bereich | Ort |
|---|---|
| Aufbau, Punkte, Notenschlüssel (ohne Datenbank) | `lib/probeschularbeit-regeln.ts` |
| Erstellen, Punkte speichern, Ergebnis, Notenschlüssel speichern | `lib/probeschularbeit.ts` |
| Knöpfe und Formulare | `app/probeschularbeit-actions.ts`, `components/ProbeschularbeitForm.tsx` |
| Abschnitt „Probeschularbeit“ auf der Vorbereitung | `app/(tutor)/schueler/[id]/pruefung/[testId]/page.tsx` |
| Punkte je Aufgabe in der Vorschau | `components/WorksheetEditor.tsx` (`punkte`) |
| A4 mit Punkten und Notenschlüssel | `components/arbeitsblatt/Sheet.tsx` (`Punkte`, `Bewertung`) |
| Punkte und Note im Ergebnis | `app/(tutor)/schueler/[id]/ergebnis/[aid]/page.tsx` |
| Notenschlüssel einstellen | Mehr › Curriculum / Lehrplan › Einstellungen |

## Ablauf

1. Schülerprofil › Schule › bei der Schularbeit „Probeschularbeit“ (oder „Vorbereitung starten“ und dort
   nach unten). „Aus der App“ braucht Stoff, der Fähigkeiten zugeordnet ist. Ist er es noch nicht, führt der
   Knopf zur Karte „Stoff zuordnen“ ([stoff-zuordnen.md](stoff-zuordnen.md)) und nach „Zuordnen“ zurück zur
   Probeschularbeit. „Vom Stoffzettel“ (siehe unten) geht auch ohne.
2. Dauer wählen: 25, 50 oder 100 Minuten, das sind 5, 8 oder 12 Aufgaben. Mit KI (nur wenn verfügbar und
   angehakt) bekommen Themen ohne eingebaute Aufgaben echte Aufgaben, in einer Anfrage.
3. Der Entwurf öffnet sich in der Vorschau. Aufgaben und Punkte lassen sich ändern wie bei jeder Übung.
4. „PDF / Drucken“ macht das A4: Arbeitszeit im Kopf, rechts neben jeder Aufgabe „☐ / 3 P.“, unten
   „Gesamt: ___ von 24 Punkten“, „Note: ___“ und der Notenschlüssel als Punkte von–bis. Die Lehrerfassung
   hat die Lösungen und die Punkte.
5. Oder senden: am Gerät läuft sie wie ein Minitest (ohne Tipps, ein Versuch je Aufgabe), mit
   „Probeschularbeit“ am Anfang und am Ende. Das gilt für jeden Weg des Sendens
   (`repo.assignWorksheet` setzt den Modus `test`), eine Schnellrunde gibt es dafür nicht.
6. Das Ergebnis zeigt „x von y Punkten“ und die Note, sobald alle Aufgaben bearbeitet und die offenen
   bewertet sind. „Teilweise richtig“ zählt die halben Punkte. Die Vorbereitung listet alle
   Probeschularbeiten der Schularbeit mit diesem Stand.

## Aufbau

- Reihenfolge: etwa 30 % leicht, 50 % mittel, 20 % schwer (ab vier Aufgaben mindestens eine schwere),
  leichte zuerst (`schwierigkeiten`).
- Die Fähigkeiten reihum, die schwächsten zuerst (wie im Plan der Vorbereitung), so dass bei genug
  Aufgaben jede drankommt (`planeProbeschularbeit`).
- Die Aufgaben kommen wie bei der Diagnose: zuerst ungesehene aus der Aufgabenbibliothek, dann die KI nur
  für Fähigkeiten ohne Generator, dann die Generatoren in den Aufgabentypen der Fähigkeit. Ohne KI bekommen
  Fähigkeiten ohne Generator eine Erklär-Aufgabe; die Vorschau sagt, wie viele.
- Keine Aufgabe, die der Schüler schon gesehen hat, solange es andere gibt.

## Vom Stoffzettel

niko, 2026-11-08: „generell ist es gerade einfacher, es hier in Claude zu senden, und Claude macht eine Probe-SA
daraus“. Ist der Stoff gelesen (oder als Themen eingetragen) und die KI an, fragt das Formular zuerst „Aufgaben“:

- **Vom Stoffzettel** (die Vorgabe): die KI schreibt alle Aufgaben, jede Zeile des Stoffs kommt dran, auch eine,
  der keine Fähigkeit passt. Geht auch, bevor der Stoff Fähigkeiten zugeordnet ist.
- **Aus der App**: wie oben unter *Aufbau*, braucht zugeordnete Fähigkeiten.

So geht es (`lib/probeschularbeit.ts`, `lib/probeschularbeit-regeln.ts`):

- Die Zeilen (`stoffFuerProbe`): was die gelesenen Unterlagen als Prüfungsstoff nennen, ohne Umfang
  (Überschriften, „Teste dein Wissen“, Übungsbuch) und ohne, was nur für heute ist. Die Fähigkeit einer Zeile,
  wenn sie sicher oder von der Lehrkraft gewählt ist, sonst keine. Ohne gelesene Unterlagen die Themen der
  Prüfung. Dazu jede Fähigkeit, die die Lehrkraft selbst verknüpft hat und die keine Zeile nennt.
- Welche Zeile bei welcher Aufgabe (`planeVomStoff`): jede Zeile eine eigene Aufgabe. Mehr Zeilen als
  Aufgaben: zuerst teilen sich Zeilen derselben Fähigkeit eine Aufgabe, dann Nachbarn im selben Kapitel; solche
  Aufgaben stehen auf den schweren Plätzen, Zeilen verschiedener Themen in Mathematik als Sachaufgabe mit
  Teilfragen. Weniger Zeilen: sie kommen reihum noch einmal. Die Kapitel wechseln sich ab, leichte zuerst.
  nikos Zettel (11 Zeilen): 8 Aufgaben bei 50 Minuten, 12 bei 100.
- Eine Anfrage an die KI mit dem Aufgabenplan: je Aufgabe Typ, Fähigkeit (oder keine), Schwierigkeit und der
  Wortlaut der Zeilen (als Information, keine Anweisung). Die KI gibt die Nummer der Aufgabe in `topic` zurück,
  damit jede Aufgabe an ihren Platz kommt (`fillPlan`), auch wenn die Antwort vertauscht ist.
- Was die KI nicht passend liefert (oder ohne KI), macht die App: mit Fähigkeit aus den eingebauten Aufgaben,
  ohne eine Erklär-Aufgabe zum Wortlaut der Zeile. Eine Aufgabe zu einer Zeile ohne Fähigkeit hat keine: sie
  zählt für die Note, nicht für den Lernstand.
- Die Vorschau sagt „Alle 11 Zeilen vom Stoffzettel sind dabei, in 8 Aufgaben“ und, wenn etwas aus der App
  kommt, wie viel. Die Zeilen jeder Aufgabe stehen in `worksheets.settings.stoff`.

## Punkte und Notenschlüssel

- Vorgabe nach Schwierigkeit: sehr leicht 1, leicht 2, mittel 3, schwer 4, sehr schwer 5; eine Sachaufgabe
  mit mehreren Teilen je weiterem Teil einen Punkt mehr. Der Lehrer kann jede Aufgabe auf 0,5 bis 20
  Punkte setzen (`tasks.points`, leer = Vorgabe).
- Der Notenschlüssel gilt für alle Probeschularbeiten: Sehr gut ab 87,5 %, Gut ab 75 %, Befriedigend ab
  62,5 %, Genügend ab 50 % (Achtel). Das ist ein Vorschlag, keine Vorgabe der Schule; die Verwaltung
  ändert ihn unter Mehr › Curriculum / Lehrplan › Einstellungen.
- Die Grenzen werden auf halbe Punkte aufgerundet: bei 24 Punkten Sehr gut ab 21, Gut ab 18, Befriedigend
  ab 15, Genügend ab 12.

## Was es nicht macht

- Keine Note im Lernstand und keine Note bei der Schularbeit selbst: das echte Ergebnis trägt der Lehrer
  weiter bei der Schularbeit ein.
- Keine Aufgaben aus Schulbüchern; vom Stoffzettel kommen nur die Themen.
- Keine KI ohne Klick: die KI läuft nur beim Erstellen, nur wenn angehakt, und bekommt keine Namen.
