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
   nach unten). Der Stoff muss Fähigkeiten zugeordnet sein; sonst sagt der Abschnitt das.
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
